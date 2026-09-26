import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { liquidTotalsByCurrency, rateBook, type Account, type Currency, type Entry, type ExchangeRate, type LedgerSnapshot, type Transfer } from '@finanzapp/domain';
import { FRANKFURTER_SOURCE, RateFetchError, fetchFrankfurter, frankfurterUrl, parseRates, rateText, type FetchLike, type RateRequest } from '../src/fx/frankfurter.ts';
import { REFRESH_MS, RETRY_MS, createRatesStore, monthRequest, monthsEnding, needsFetch, type RateCache } from '../src/fx/rates-store.ts';
import { availableFigure, financeView, listingSnapshot, spendingFigure } from '../src/fx/finance-view.ts';
import { figureInfo, reportInfo, shortfallDetail } from '../src/fx/fx-copy.ts';
import { RATES_DATABASE_VERSION, initializeRatesDatabase, readRates, saveRates, type RateCoverage, type RatesDatabase } from '../src/storage/rates-database.ts';
import { runExclusiveTransaction, type TransactionConnection } from '../src/storage/transaction.ts';
import { DISPLAY_CURRENCY_KEY, DISPLAY_MODE_KEY, createDisplayCurrencyStore, displayCurrencyForRoute, readDisplayMode, resolveDisplayCurrency } from '../src/ui/display-currency.ts';
import { displayTargets } from '../src/ui/currencies.ts';
import { bindLocale } from '../src/i18n/bind.ts';
import type { PreferenceStore } from '../src/i18n/preference.ts';

// Producto 24C1. Synthetic, deterministic data only: a stub provider (no network), invented rates chosen for
// arithmetic, disposable SQLite files. Nothing here reaches a person's app or claims to be market history.

const fetchedAt = '2026-09-20T12:00:00.000Z';
const rate = (quote: Currency, effectiveDate: string, value: string, at = fetchedAt): ExchangeRate =>
  ({ base: 'USD', quote, rate: value, effectiveDate, source: FRANKFURTER_SOURCE, fetchedAt: at });

// ---- the provider's client ---------------------------------------------------------------------------------

test('the request names only a date window and the quotes against USD; no key, amount or account travels', () => {
  const request: RateRequest = { from: '2026-08-25', to: '2026-09-25', quotes: ['JPY', 'ARS', 'EUR'] };
  assert.equal(frankfurterUrl(request), 'https://api.frankfurter.dev/v2/rates?from=2026-08-25&to=2026-09-25&base=USD&quotes=ARS,EUR,JPY');
  assert.deepEqual(monthRequest('2026-09', ['EUR', 'ARS'], '2026-09-25'), { from: '2026-08-25', to: '2026-09-25', quotes: ['ARS', 'EUR'] }, 'the week before the month, through today');
  assert.deepEqual(monthRequest('2026-02', ['ARS'], '2026-09-25'), { from: '2026-01-25', to: '2026-02-28', quotes: ['ARS'] }, 'a past month through its last day');
  assert.deepEqual(monthsEnding('2026-02', 3), ['2025-12', '2026-01', '2026-02']);
});

test('a rate the provider sends as a JSON number is recovered as its exact decimal text, or dropped', () => {
  assert.equal(rateText(1508.19), '1508.19');
  assert.equal(rateText(0.86598), '0.86598');
  assert.equal(rateText(154), '154');
  assert.equal(rateText(1368393), '1368393');
  assert.equal(rateText(1.23e-7), '0.000000123');
  assert.equal(rateText(0.0000123), '0.0000123');
  assert.equal(rateText(1.5e21), null, 'beyond the rate text limits');
  assert.equal(rateText(0.1 + 0.2), null, '0.30000000000000004 has 17 significant digits: not a published figure, dropped');
  for (const bad of [0, -1, NaN, Infinity, '1.5', null, undefined]) assert.equal(rateText(bad), null, String(bad));
});

test('a response is read strictly: another base, an unasked quote, a date outside the window or a bad rate is dropped', () => {
  const request: RateRequest = { from: '2026-09-01', to: '2026-09-05', quotes: ['ARS', 'EUR'] };
  const rows = parseRates([
    { date: '2026-09-01', base: 'USD', quote: 'ARS', rate: 1511.18 },
    { date: '2026-09-02', base: 'USD', quote: 'EUR', rate: 0.86 },
    { date: '2026-09-02', base: 'EUR', quote: 'ARS', rate: 1700 },
    { date: '2026-09-02', base: 'USD', quote: 'JPY', rate: 150 },
    { date: '2026-09-09', base: 'USD', quote: 'ARS', rate: 1500 },
    { date: '2026-02-30', base: 'USD', quote: 'ARS', rate: 1500 },
    { date: '2026-09-03', base: 'USD', quote: 'ARS', rate: '1500' },
    { date: '2026-09-03', base: 'USD', quote: 'ARS', rate: -1 },
    null, 'x',
  ], request, fetchedAt);
  assert.deepEqual(rows, [rate('ARS', '2026-09-01', '1511.18'), rate('EUR', '2026-09-02', '0.86')]);
  assert.throws(() => parseRates({ error: 'nope' }, request, fetchedAt));
});

test('a failed download is `offline` (no network, timeout) or `provider` (HTTP error, unreadable body), never a partial set', async () => {
  const request: RateRequest = { from: '2026-09-01', to: '2026-09-05', quotes: ['ARS'] };
  const offline: FetchLike = async () => { throw new TypeError('Network request failed'); };
  const failing: FetchLike = async () => ({ ok: false, status: 429, json: async () => ({}) });
  const garbled: FetchLike = async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('bad json'); } });
  const wrongShape: FetchLike = async () => ({ ok: true, status: 200, json: async () => ({ rates: {} }) });
  for (const [impl, kind] of [[offline, 'offline'], [failing, 'provider'], [garbled, 'provider'], [wrongShape, 'provider']] as const) {
    await assert.rejects(fetchFrankfurter(request, impl), (error: unknown) => error instanceof RateFetchError && error.kind === kind);
  }
  let asked = '';
  const ok: FetchLike = async url => { asked = url; return { ok: true, status: 200, json: async () => [{ date: '2026-09-01', base: 'USD', quote: 'ARS', rate: 1511.18 }] }; };
  assert.deepEqual(await fetchFrankfurter(request, ok, () => new Date(fetchedAt)), [rate('ARS', '2026-09-01', '1511.18')]);
  assert.match(asked, /^https:\/\/api\.frankfurter\.dev\/v2\/rates\?/);
});

// ---- the cache on real SQLite -----------------------------------------------------------------------------

const cleanups: (() => void)[] = [];
afterEach(() => { for (const cleanup of cleanups.splice(0).reverse()) cleanup(); });

function connection(path: string): TransactionConnection {
  const db = new DatabaseSync(path);
  return {
    execAsync: async sql => { db.exec(sql); },
    runAsync: async (sql, ...params) => ({ changes: Number(db.prepare(sql).run(...params).changes) }),
    getFirstAsync: async <T>(sql: string, ...params: (string | number | null)[]) => { const row = db.prepare(sql).get(...params); return row ? { ...row } as T : null; },
    getAllAsync: async <T>(sql: string, ...params: (string | number | null)[]) => db.prepare(sql).all(...params).map(row => ({ ...row })) as T[],
    closeAsync: async () => { db.close(); },
  };
}
function ratesDatabase(): { db: RatesDatabase; path: string } {
  const directory = mkdtempSync(join(tmpdir(), 'finanzapp-rates-'));
  const path = join(directory, 'rates.sqlite');
  const base = connection(path);
  cleanups.push(() => { void base.closeAsync(); rmSync(directory, { recursive: true, force: true }); });
  return { path, db: { ...base, withExclusiveTransactionAsync: work => runExclusiveTransaction(async () => connection(path), work) } };
}

test('the rate cache is its own SQLite file: rates with source and dates, and the months already asked, saved in one transaction', async () => {
  const { db } = ratesDatabase();
  assert.equal(await initializeRatesDatabase(db), true);
  assert.equal((await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version, RATES_DATABASE_VERSION);
  assert.equal(await initializeRatesDatabase(db), true, 'opening again changes nothing');
  const coverage: RateCoverage[] = [{ quote: 'ARS', monthISO: '2026-09', throughISO: '2026-09-20', fetchedAt }];
  await saveRates(db, [rate('ARS', '2026-09-18', '1500'), rate('EUR', '2026-09-18', '0.9')], coverage);
  const read = await readRates(db);
  assert.deepEqual(read.rates, [rate('ARS', '2026-09-18', '1500'), rate('EUR', '2026-09-18', '0.9')]);
  assert.deepEqual(read.coverage, coverage);
  // A CHECK refuses a malformed row and the whole download is rolled back.
  await assert.rejects(saveRates(db, [rate('JPY', '2026-09-18', '150'), { ...rate('JPY', '2026-09-19', '151'), base: 'EUR' }], []));
  assert.equal((await readRates(db)).rates.some(row => row.quote === 'JPY'), false, 'nothing of the failed download landed');
});

test('a rate fetched on its own day is provisional and replaced by a later download; one fetched after its day is final and never rewritten', async () => {
  const { db } = ratesDatabase();
  await initializeRatesDatabase(db);
  await saveRates(db, [rate('ARS', '2026-09-20', '1500', '2026-09-20T10:00:00.000Z'), rate('ARS', '2026-09-18', '1490', '2026-09-20T10:00:00.000Z')], []);
  await saveRates(db, [rate('ARS', '2026-09-20', '1505', '2026-09-21T09:00:00.000Z'), rate('ARS', '2026-09-18', '9999', '2026-09-21T09:00:00.000Z')], []);
  const rows = Object.fromEntries((await readRates(db)).rates.map(row => [row.effectiveDate, row.rate]));
  assert.deepEqual(rows, { '2026-09-18': '1490', '2026-09-20': '1505' }, 'the 18th was final when first fetched; the 20th was the same day');
  await saveRates(db, [rate('ARS', '2026-09-20', '7777', '2026-09-22T09:00:00.000Z')], []);
  assert.equal((await readRates(db)).rates.find(row => row.effectiveDate === '2026-09-20')?.rate, '1505', 'final once fetched after its day');
});

test('a cache written by a newer build is read and never written, and nothing is deleted', async () => {
  const { db } = ratesDatabase();
  await initializeRatesDatabase(db);
  await saveRates(db, [rate('ARS', '2026-09-18', '1500')], []);
  await db.execAsync('PRAGMA user_version = 99');
  assert.equal(await initializeRatesDatabase(db), false);
  assert.equal((await readRates(db)).rates.length, 1);
  assert.equal((await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version, 99);
});

// ---- when the app asks the provider ------------------------------------------------------------------------

function memoryCache(initial: { rates?: ExchangeRate[]; coverage?: RateCoverage[] } = {}, faults = { load: false, save: false }) {
  const stored = { rates: [...(initial.rates ?? [])], coverage: [...(initial.coverage ?? [])] };
  const cache: RateCache = {
    load: async () => { if (faults.load) throw new Error('locked'); return { rates: [...stored.rates], coverage: [...stored.coverage] }; },
    save: async (rates, coverage) => { if (faults.save) throw new Error('disk full'); stored.rates.push(...rates); stored.coverage.push(...coverage); },
  };
  return { cache, stored, faults };
}
function stubProvider(rows: (request: RateRequest) => ExchangeRate[] = request => request.quotes.map(quote => rate(quote, request.to, '2'))) {
  const requests: RateRequest[] = [];
  let failWith: RateFetchError | null = null;
  return { requests, fail: (kind: 'offline' | 'provider' | null) => { failWith = kind ? new RateFetchError(kind) : null; },
    fetchRates: async (request: RateRequest) => { requests.push(request); if (failWith) throw failWith; return rows(request); } };
}

test('needsFetch: nothing for the future or an already final month; the running month again only after the refresh interval', () => {
  const now = new Date('2026-09-25T12:00:00.000Z');
  assert.equal(needsFetch(undefined, '2026-10', '2026-09-25', now), false, 'the future');
  assert.equal(needsFetch(undefined, '2026-09', '2026-09-25', now), true);
  assert.equal(needsFetch({ quote: 'ARS', monthISO: '2026-08', throughISO: '2026-08-31', fetchedAt: '2026-09-02T00:00:00.000Z' }, '2026-08', '2026-09-25', now), false, 'final');
  assert.equal(needsFetch({ quote: 'ARS', monthISO: '2026-08', throughISO: '2026-08-30', fetchedAt: '2026-08-30T00:00:00.000Z' }, '2026-08', '2026-09-25', now), true, 'asked while it ran');
  const recent: RateCoverage = { quote: 'ARS', monthISO: '2026-09', throughISO: '2026-09-25', fetchedAt: new Date(now.getTime() - REFRESH_MS + 1000).toISOString() };
  assert.equal(needsFetch(recent, '2026-09', '2026-09-25', now), false);
  assert.equal(needsFetch({ ...recent, fetchedAt: new Date(now.getTime() - REFRESH_MS).toISOString() }, '2026-09', '2026-09-25', now), true);
});

test('the store reads the cache first, asks once per month for what is missing, and never asks again for a final month', async () => {
  let clock = new Date('2026-09-25T12:00:00.000Z');
  const { cache, stored } = memoryCache({ rates: [rate('ARS', '2026-08-31', '1400')], coverage: [{ quote: 'ARS', monthISO: '2026-08', throughISO: '2026-08-31', fetchedAt: '2026-09-02T00:00:00.000Z' }] });
  const provider = stubProvider();
  const store = createRatesStore({ cache, fetchRates: provider.fetchRates, now: () => clock });
  assert.equal(store.activity(['2026-09'], ['ARS']), 'loading');
  store.ensure(['2026-08', '2026-09'], ['ARS', 'EUR'], '2026-09-25');
  await store.settled();
  assert.deepEqual(provider.requests.map(request => [request.from, request.to, request.quotes.join()]),
    [['2026-07-25', '2026-08-31', 'EUR'], ['2026-08-25', '2026-09-25', 'ARS,EUR']], 'August only for EUR; September for both');
  assert.equal(store.getState().loaded, true);
  assert.equal(store.getState().book.lookup('ARS', '2026-08-31').status, 'ok', 'the cached rate is in the book');
  assert.equal(stored.coverage.length, 1 + 3, 'the downloads were saved with their coverage');
  // Everything again, same moment: nothing to ask.
  store.ensure(['2026-08', '2026-09'], ['ARS', 'EUR'], '2026-09-25');
  await store.settled();
  assert.equal(provider.requests.length, 2);
  // A quote nobody needs (single mode, or one currency shown in itself) asks nothing.
  store.ensure(['2026-01'], [], '2026-09-25');
  await store.settled();
  assert.equal(provider.requests.length, 2);
  // Six hours later the running month is asked again; August stays final.
  clock = new Date(clock.getTime() + REFRESH_MS);
  store.ensure(['2026-08', '2026-09'], ['ARS', 'EUR'], '2026-09-25');
  await store.settled();
  assert.deepEqual(provider.requests.slice(2).map(request => request.to), ['2026-09-25']);
});

test('offline: the cached rates keep working, the failure is reported, and the provider is asked again only after the retry interval', async () => {
  let clock = new Date('2026-09-25T12:00:00.000Z');
  const { cache } = memoryCache({ rates: [rate('ARS', '2026-09-18', '1500')] });
  const provider = stubProvider();
  provider.fail('offline');
  const store = createRatesStore({ cache, fetchRates: provider.fetchRates, now: () => clock });
  await store.settled(); // the cache has been read
  const snapshots = [store.getState()];
  store.subscribe(() => snapshots.push(store.getState()));
  store.ensure(['2026-09'], ['ARS'], '2026-09-25');
  await store.settled();
  assert.equal(store.activity(['2026-09'], ['ARS']), 'offline');
  assert.ok(snapshots.length >= 3 && new Set(snapshots).size === snapshots.length, 'fetching and the failure each give a new snapshot (a React subscriber re-renders)');
  assert.equal(snapshots.at(-1)!.book, snapshots[0].book, 'the same book: nothing was converted again');
  assert.equal(store.getState().book.lookup('ARS', '2026-09-20').status, 'ok', 'the cache still answers');
  store.ensure(['2026-09'], ['ARS'], '2026-09-25');
  await store.settled();
  assert.equal(provider.requests.length, 1, 'no hammering while offline');
  clock = new Date(clock.getTime() + RETRY_MS);
  provider.fail(null);
  store.ensure(['2026-09'], ['ARS'], '2026-09-25');
  await store.settled();
  assert.equal(provider.requests.length, 2);
  assert.equal(store.activity(['2026-09'], ['ARS']), 'idle');
});

function retryHarness(clock: { now: Date }) {
  const timers: { run: () => void; ms: number; cancelled: boolean }[] = [];
  const provider = stubProvider();
  const store = createRatesStore({ cache: memoryCache().cache, fetchRates: provider.fetchRates, now: () => clock.now,
    schedule: (run, ms) => { const timer = { run, ms, cancelled: false }; timers.push(timer); return () => { timer.cancelled = true; }; } });
  const fire = () => { const timer = timers.shift()!; assert.ok(timer && !timer.cancelled, 'a live retry timer'); clock.now = new Date(clock.now.getTime() + timer.ms); timer.run(); };
  return { timers, provider, store, fire };
}

test('after a failure the store retries by itself once the back-off has passed, while the view that asked is still active', async () => {
  const clock = { now: new Date('2026-09-25T12:00:00.000Z') };
  const { timers, provider, store, fire } = retryHarness(clock);
  provider.fail('offline');
  const release = store.watch(['2026-09'], ['EUR'], '2026-09-25');
  await store.settled();
  assert.equal(store.activity(['2026-09'], ['EUR']), 'offline');
  assert.deepEqual(timers.map(timer => timer.ms), [RETRY_MS], 'one retry scheduled at the back-off');
  // Still offline: the retry fails again and schedules the next one; never more than one per month.
  fire();
  await store.settled();
  assert.equal(provider.requests.length, 2);
  assert.equal(timers.length, 1);
  provider.fail(null);
  fire();
  await store.settled();
  assert.equal(provider.requests.length, 3, 'asked again without any call from a screen');
  assert.equal(store.activity(['2026-09'], ['EUR']), 'idle');
  assert.equal(store.getState().book.lookup('EUR', '2026-09-25').status, 'ok');
  assert.equal(timers.length, 0, 'a success schedules nothing');
  release();
});

test('a view that leaves (navigation, or a switch to one currency only) cancels its retries; repeated failures create no persistent requests', async () => {
  const clock = { now: new Date('2026-09-25T12:00:00.000Z') };
  const { timers, provider, store, fire } = retryHarness(clock);
  provider.fail('offline');
  // Reportes browses six months offline, then the person goes elsewhere.
  const release = store.watch(['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09'], ['EUR'], '2026-09-25');
  await store.settled();
  assert.equal(provider.requests.length, 6);
  assert.equal(timers.filter(timer => !timer.cancelled).length, 6, 'one retry per failed month while the view is active');
  release();
  assert.equal(timers.filter(timer => !timer.cancelled).length, 0, 'every retry cancelled the moment nothing watches those months');
  // A timer that had already fired its callback path finds no watcher and asks nothing (belt and braces).
  timers.length = 0;
  const again = store.watch(['2026-09'], ['EUR'], '2026-09-25');
  await store.settled();
  assert.equal(provider.requests.length, 6, 'within the back-off: no new request');
  clock.now = new Date(clock.now.getTime() + RETRY_MS);
  store.ensure(['2026-09'], ['EUR'], '2026-09-25');
  await store.settled();
  assert.equal(provider.requests.length, 7, 'past the back-off, an active view asks again');
  again();
  const pending = timers.find(timer => !timer.cancelled);
  assert.equal(pending, undefined, 'and leaving cancels the retry that failure scheduled');
  // Without a watcher, a stray retry callback asks nothing.
  const stray = timers[timers.length - 1];
  clock.now = new Date(clock.now.getTime() + RETRY_MS);
  stray.run();
  await store.settled();
  assert.equal(provider.requests.length, 7, 'no request for a month nobody watches');
  // Ensure alone (no watch) never schedules a retry: only a watching view keeps recovery alive.
  store.ensure(['2026-03'], ['EUR'], '2026-09-25');
  await store.settled();
  assert.equal(timers.filter(timer => !timer.cancelled).length, 0);
});

test('while one view keeps watching a month, another view leaving does not cancel its recovery', async () => {
  const clock = { now: new Date('2026-09-25T12:00:00.000Z') };
  const { timers, provider, store, fire } = retryHarness(clock);
  provider.fail('provider');
  const home = store.watch(['2026-09'], ['EUR'], '2026-09-25');
  const reports = store.watch(['2026-08', '2026-09'], ['EUR'], '2026-09-25');
  await store.settled();
  reports();
  assert.deepEqual(timers.filter(timer => !timer.cancelled).length, 1, 'August cancelled; September still watched by Inicio');
  provider.fail(null);
  fire();
  await store.settled();
  assert.equal(store.getState().book.lookup('EUR', '2026-09-25').status, 'ok');
  home();
});

test('a request for one currency in flight never blocks another currency of the same month (two screens, a quick change)', async () => {
  const { cache } = memoryCache();
  let release: () => void = () => {};
  const gate = new Promise<void>(resolve => { release = resolve; });
  const requests: RateRequest[] = [];
  const store = createRatesStore({ cache, now: () => new Date('2026-09-25T12:00:00.000Z'),
    fetchRates: async request => { requests.push(request); await gate; return request.quotes.map(quote => rate(quote, request.to, '2')); } });
  await store.settled();
  store.ensure(['2026-09'], ['EUR'], '2026-09-25');
  store.ensure(['2026-09'], ['EUR', 'JPY'], '2026-09-25');
  store.ensure(['2026-09'], ['EUR', 'JPY'], '2026-09-25');
  assert.deepEqual(requests.map(request => request.quotes.join()), ['EUR', 'JPY'], 'JPY asked at once; nothing asked twice');
  assert.equal(store.activity(['2026-09'], ['JPY']), 'fetching');
  release();
  await store.settled();
  assert.equal(store.getState().book.lookup('JPY', '2026-09-25').status, 'ok');
  assert.equal(store.activity(['2026-09'], ['EUR', 'JPY']), 'idle');
});

test('a cache that cannot be read or written leaves the session\'s rates in memory and deletes nothing', async () => {
  const { cache, faults, stored } = memoryCache({ rates: [rate('ARS', '2026-09-18', '1500')] }, { load: true, save: true });
  const provider = stubProvider();
  const store = createRatesStore({ cache, fetchRates: provider.fetchRates, now: () => new Date('2026-09-25T12:00:00.000Z') });
  store.ensure(['2026-09'], ['EUR'], '2026-09-25');
  await store.settled();
  assert.equal(store.getState().loaded, true);
  assert.equal(store.getState().book.lookup('EUR', '2026-09-25').status, 'ok', 'the download is used although it could not be saved');
  assert.equal(stored.rates.length, 1, 'the unreadable cache was not replaced');
  assert.equal(faults.save, true);
});

// ---- the display mode and its transition -------------------------------------------------------------------

function preferences(initial: Record<string, string> = {}, faults = { set: false }) {
  const rows = new Map(Object.entries(initial));
  const store: PreferenceStore = { getItemSync: key => rows.get(key) ?? null, setItemSync: (key, value) => { if (faults.set) throw new Error('disk full'); rows.set(key, value); },
    removeItemSync: key => rows.delete(key) };
  return { rows, faults, store: () => store };
}

test('a new installation starts consolidated; a device that chose a display currency under 24B6 keeps its one-currency view; the transition is written once', () => {
  const fresh = preferences();
  assert.equal(readDisplayMode(fresh.store), 'consolidated');
  assert.equal(fresh.rows.get(DISPLAY_MODE_KEY), 'consolidated');
  const upgraded = preferences({ [DISPLAY_CURRENCY_KEY]: 'USD' });
  assert.equal(readDisplayMode(upgraded.store), 'single');
  assert.deepEqual(Object.fromEntries(upgraded.rows), { [DISPLAY_CURRENCY_KEY]: 'USD', [DISPLAY_MODE_KEY]: 'single' }, 'the currency is kept as it was');
  upgraded.rows.set(DISPLAY_CURRENCY_KEY, 'EUR');
  assert.equal(readDisplayMode(upgraded.store), 'single', 'once written, the stored mode decides');
  const junk = preferences({ [DISPLAY_CURRENCY_KEY]: 'xx', [DISPLAY_MODE_KEY]: 'both' });
  assert.equal(readDisplayMode(junk.store), 'consolidated', 'an unreadable mode and no valid currency: consolidated');
  const readOnly = preferences({ [DISPLAY_CURRENCY_KEY]: 'USD' }, { set: true });
  assert.equal(readDisplayMode(readOnly.store), 'single');
  assert.equal(readDisplayMode(readOnly.store), 'single', 'an unwritable store gives the same answer each time');
});

test('the mode is applied to every subscriber and persisted; a consolidated total may be in a currency no account holds; a single view only in one held', () => {
  const saved = preferences({ [DISPLAY_CURRENCY_KEY]: 'EUR', [DISPLAY_MODE_KEY]: 'consolidated' });
  const store = createDisplayCurrencyStore(saved.store);
  let notified = 0;
  store.subscribe(() => notified++);
  assert.equal(store.getMode(), 'consolidated');
  assert.equal(resolveDisplayCurrency(store.getState(), ['ARS', 'USD'], store.getMode()), 'EUR');
  assert.equal(store.setMode('single'), true);
  assert.deepEqual([store.getMode(), notified, saved.rows.get(DISPLAY_MODE_KEY)], ['single', 1, 'single']);
  assert.equal(resolveDisplayCurrency(store.getState(), ['ARS', 'USD'], store.getMode()), 'ARS', 'EUR is not held: the first held currency, the preference kept');
  assert.equal(saved.rows.get(DISPLAY_CURRENCY_KEY), 'EUR');
  assert.equal(store.setMode('single'), true);
  assert.equal(notified, 1, 'the same mode again is silent');
  assert.equal(store.setMode('both' as never), false);
  saved.faults.set = true;
  assert.equal(store.setMode('consolidated'), false, 'an unwritable store reports it');
  assert.equal(store.getMode(), 'consolidated', 'and keeps the choice for the session');
  const accounts: Account[] = [{ id: 'a', name: 'a', currency: 'ARS', openingMinor: 0, createdAt: fetchedAt }];
  assert.deepEqual(displayCurrencyForRoute(accounts, 'JPY', null, 'consolidated'), { currency: 'JPY', apply: 'JPY' });
  assert.deepEqual(displayCurrencyForRoute(accounts, 'JPY', null, 'single'), { currency: 'ARS', apply: null });
  assert.deepEqual(displayCurrencyForRoute(accounts, 'jpy', 'USD', 'consolidated'), { currency: 'USD', apply: null });
  assert.deepEqual(displayTargets(['ARS', 'KWD'], ['ARS', 'USD', 'EUR', 'JPY'], 'es-AR'), ['ARS', 'KWD', 'USD', 'EUR', 'JPY'],
    'held first (a retained three-decimal currency stays reachable), then the gate: ARS and USD, then by name');
});

// ---- consolidated figures ----------------------------------------------------------------------------------

const createdAt = '2026-09-01T12:00:00.000Z';
const account = (id: string, currency: Currency, openingMinor = 0): Account => ({ id, name: id, currency, openingMinor, createdAt });
const spend = (id: string, accountId: string, amountMinor: number, dateISO: string, kind: Entry['kind'] = 'expense'): Entry =>
  ({ id, accountId, kind, amountMinor, merchant: 'M' + id, category: 'Varios', dateISO, createdAt });
// ARS cash (negative balance), USD cash, EUR cash, a JPY account, and an ARS card with a payment from ARS.
const ledger: LedgerSnapshot = {
  accounts: [account('ars', 'ARS', 100000), account('usd', 'USD', 10000), account('eur', 'EUR', 5000), account('yen', 'JPY', 30000), account('card', 'ARS')],
  entries: [spend('a1', 'ars', 300000, '2026-09-05'), spend('u1', 'usd', 1234, '2026-09-10'), spend('e1', 'eur', 999, '2026-09-11'),
    spend('y1', 'yen', 1500, '2026-09-12'), spend('c1', 'card', 60000, '2026-09-12'), spend('in', 'usd', 5000, '2026-09-15', 'income')],
  transfers: [{ id: 'pay', fromAccountId: 'ars', toAccountId: 'card', amountMinor: 60000, note: 'Pago', dateISO: '2026-09-20', createdAt } as Transfer],
};
const cards = [{ id: 'card-p', accountId: 'card', issuer: 'V', last4: '0000', creditLimitMinor: null, closingDay: 20, dueDay: 5, active: true, createdAt, revision: 0, updatedAt: createdAt }] as never[];
const rates = [
  rate('ARS', '2026-09-04', '1500'), rate('EUR', '2026-09-04', '0.9'), rate('JPY', '2026-09-04', '150'),
  rate('ARS', '2026-09-11', '1600'), rate('EUR', '2026-09-11', '0.8'), rate('JPY', '2026-09-11', '160'),
  rate('ARS', '2026-09-24', '2000'), rate('EUR', '2026-09-24', '0.5'), rate('JPY', '2026-09-24', '200'),
];
const september = { startISO: '2026-09-01', endISO: '2026-09-25' };

test('consolidated spending in ARS, USD, EUR and JPY: every account, each expense at its own date, card purchase once, the card payment never', () => {
  const book = rateBook(rates);
  const before = JSON.stringify(ledger);
  const total = (currency: Currency) => { const figure = spendingFigure(ledger, financeView(ledger, 'consolidated', currency, book), september, 'idle', true);
    return figure.status === 'ready' ? figure.minor : figure.status; };
  // USD: ARS 3000 @1500 = 2.00; 12.34; EUR 9.99 @0.8 = 12.4875 → 12.49; JPY 1500 @160 = 9.375 → 9.38; ARS 600 @1600 = 0.375 → 0.38.
  assert.equal(total('USD'), 200 + 1234 + 1249 + 938 + 38);
  // The USD expense of the 10th takes the publication of the 4th (the latest on or before it), never a later one.
  // ARS: 3000; 12.34 @1500 = 18510; 9.99/0.8×1600 = 19980; 1500/160×1600 = 15000; 600.
  assert.equal(total('ARS'), 300000 + 1851000 + 1998000 + 1500000 + 60000);
  // EUR: 3000/1500×0.9 = 1.80; 12.34×0.9 = 11.106 → 11.11; 9.99; 1500/160×0.8 = 7.50; 600/1600×0.8 = 0.30.
  assert.equal(total('EUR'), 180 + 1111 + 999 + 750 + 30);
  // JPY (no decimals): 3000/1500×150 = 300; 12.34×150 = 1851; 9.99/0.8×160 = 1998; 1500; 600/1600×160 = 60.
  assert.equal(total('JPY'), 300 + 1851 + 1998 + 1500 + 60);
  assert.equal(JSON.stringify(ledger), before, 'nothing in the ledger changed: amounts, balances and currencies are the recorded ones');
});

test('Disponible converts each liquid balance with today\'s rate, leaves cards out, keeps negatives exact, and is unknown rather than partial', () => {
  const book = rateBook(rates);
  const view = financeView(ledger, 'consolidated', 'USD', book);
  const liquid = liquidTotalsByCurrency(ledger, cards, []);
  assert.deepEqual(liquid, { ARS: 100000 - 300000 - 60000, USD: 10000 - 1234 + 5000, EUR: 5000 - 999, JPY: 30000 - 1500 }, 'the card is not liquid money');
  const figure = availableFigure(ledger, view, book, '2026-09-25', 'idle', true, cards, []);
  // ARS −2600.00 @2000 → −1.30; USD 137.66; EUR 40.01 @0.5 → 80.02; JPY 28500 @200 → 142.50.
  assert.deepEqual(figure.status === 'ready' && [figure.minor, figure.converted, figure.provenance?.newest], [-130 + 13766 + 8002 + 14250, true, '2026-09-24']);
  const single = availableFigure(ledger, financeView(ledger, 'single', 'EUR', book), book, '2026-09-25', 'idle', true, cards, []);
  assert.deepEqual(single, { status: 'ready', currency: 'EUR', minor: 4001, converted: false, provenance: null }, 'single mode: the EUR accounts only, nothing converted');
  // A week after the last JPY publication there is no JPY rate: each currency on its own, the reason and the last date named.
  const noYen = rateBook(rates.filter(row => !(row.quote === 'JPY' && row.effectiveDate === '2026-09-24')));
  const unknown = availableFigure(ledger, financeView(ledger, 'consolidated', 'USD', noYen), noYen, '2026-09-25', 'idle', true, cards, []);
  assert.equal(unknown.status, 'unavailable');
  if (unknown.status !== 'unavailable') return;
  assert.deepEqual(unknown.parts, [{ currency: 'ARS', minor: -260000 }, { currency: 'USD', minor: 13766 }, { currency: 'EUR', minor: 4001 }, { currency: 'JPY', minor: 28500 }]);
  assert.deepEqual([unknown.reason, unknown.missing], ['stale', { currency: 'JPY', date: '2026-09-25', latest: '2026-09-11' }]);
  const words = { t: bindLocale('es-AR').t, date: bindLocale('es-AR').formatNumericDate, currencyName: bindLocale('es-AR').currencyName };
  assert.match(shortfallDetail(unknown, words), /USD → JPY.*11\/9\/2026.*25\/9\/2026/);
});

test('a missing rate gives per-currency subtotals and its reason (fetching, offline, provider, missing), never a partial total or a zero', () => {
  const empty = rateBook([]);
  const view = financeView(ledger, 'consolidated', 'USD', empty);
  const reasons = (['fetching', 'offline', 'provider', 'idle'] as const).map(activity => { const figure = spendingFigure(ledger, view, september, activity, true); return figure.status === 'unavailable' ? figure.reason : figure.status; });
  assert.deepEqual(reasons, ['fetching', 'offline', 'provider', 'missing']);
  const notLoaded = spendingFigure(ledger, view, september, 'idle', false);
  assert.equal(notLoaded.status === 'unavailable' && notLoaded.reason, 'fetching', 'before the cache is read nothing is called missing');
  const figure = spendingFigure(ledger, view, september, 'offline', true);
  assert.deepEqual(figure.status === 'unavailable' && figure.parts, [{ currency: 'ARS', minor: 360000 }, { currency: 'USD', minor: 1234 }, { currency: 'EUR', minor: 999 }, { currency: 'JPY', minor: 1500 }]);
  const es = bindLocale('es-AR'), en = bindLocale('en-US');
  if (figure.status !== 'unavailable') return;
  assert.match(shortfallDetail(figure, { t: es.t, date: es.formatNumericDate, currencyName: es.currencyName }), /^Sin conexión: no pudimos obtener la cotización USD → ARS del 5\/9\/2026/);
  assert.match(shortfallDetail(figure, { t: en.t, date: en.formatNumericDate, currencyName: en.currencyName }), /^No connection: we could not get the USD → ARS rate for 9\/5\/2026/);
});

test('the info texts name the source and the rate dates; nothing is said when nothing was converted', () => {
  const es = bindLocale('es-AR');
  const words = { t: es.t, date: es.formatNumericDate, currencyName: es.currencyName };
  const book = rateBook(rates);
  const view = financeView(ledger, 'consolidated', 'USD', book);
  const figure = spendingFigure(ledger, view, september, 'idle', true);
  assert.match(figureInfo(figure, 'spending', words)!, /^Gastos de todas tus cuentas en Dólares estadounidenses\. .*Frankfurter.*11\/9\/2026/);
  assert.match(reportInfo('USD', view.provenance('2026-09-01', '2026-09-30', 'expense'), words)!, /del 4\/9\/2026 al 11\/9\/2026, nunca la de hoy para un mes pasado/);
  const onlyUsd: LedgerSnapshot = { accounts: [account('usd', 'USD')], entries: [spend('u', 'usd', 100, '2026-09-10')] };
  const plain = spendingFigure(onlyUsd, financeView(onlyUsd, 'consolidated', 'USD', rateBook([])), september, 'idle', true);
  assert.deepEqual(plain, { status: 'ready', currency: 'USD', minor: 100, converted: false, provenance: { converted: 0, oldest: null, newest: null, sources: [] } });
  assert.equal(figureInfo(plain, 'spending', words), null);
  assert.deepEqual(financeView(onlyUsd, 'consolidated', 'USD', rateBook([])).quotes, [], 'one currency shown in itself: no request at all');
});

test('a drill-down lists the real movements with their original amounts and currencies, every account in consolidated mode', () => {
  const view = financeView(ledger, 'consolidated', 'EUR', rateBook(rates));
  const listing = listingSnapshot(ledger, view);
  assert.equal(listing.entries, ledger.entries, 'the same entries, amounts untouched');
  assert.ok(listing.accounts.every(item => item.currency === 'EUR'), 'scoped like the view');
  assert.equal(listingSnapshot(ledger, financeView(ledger, 'single', 'EUR', rateBook(rates))), ledger);
});
