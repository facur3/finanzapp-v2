/** The rates the app holds and the rule for asking the provider (Producto 24C1). Pure: no React,
 * no SQLite, no network of its own; the cache and the fetch are injected, so tests drive it with
 * a stub provider and an in-memory cache.
 *
 * When a request is made (docs/currency.md §8.2):
 *   - only when a screen needs a month in a currency it holds and the target differs
 *     (`quotesNeeded`); a ledger in one currency shown in that currency never asks anything;
 *   - one request per calendar month for the currencies that month still lacks, over the month
 *     plus the week before it (the first days of a month may take the last publication of the
 *     previous one), through today at most;
 *   - a month asked after it ended is final and never asked again; the current month (or one
 *     asked while it was still running) is asked again at most every REFRESH_MS;
 *   - a failure (offline, provider error) is remembered for RETRY_MS, so a screen that
 *     re-renders never hammers the provider; the cached rates keep working meanwhile.
 * The cache is read before anything is asked. A cache that cannot be read or written leaves the
 * rates of this session in memory; nothing is deleted. */
import { rateBook, shiftMonthISO, type Currency, type ExchangeRate, type RateBook } from '@finanzapp/domain';
import type { RateCoverage } from '../storage/rates-database.ts';
import { RateFetchError, type RateRequest } from './frankfurter.ts';

export const REFRESH_MS = 6 * 60 * 60 * 1000;
export const RETRY_MS = 60 * 1000;
/** The furthest back a screen can ask for (a person's records may start earlier; those months simply have no total). */
export const EARLIEST_RATE_MONTH = '1999-01';

export interface RateCache {
  load(): Promise<{ rates: ExchangeRate[]; coverage: RateCoverage[] }>;
  save(rates: readonly ExchangeRate[], coverage: readonly RateCoverage[]): Promise<void>;
}

export type RatesActivity = 'idle' | 'loading' | 'fetching' | 'offline' | 'provider';

export interface RatesSnapshot {
  book: RateBook;
  /** False until the cache has been read: a screen shows "obteniendo" instead of "falta" meanwhile. */
  loaded: boolean;
  /** When the last successful download happened (ISO), or null. */
  lastFetchedAt: string | null;
}

export interface RatesStore {
  getState(): RatesSnapshot;
  subscribe(listener: () => void): () => void;
  /** Asks for whatever `months` × `quotes` still needs; returns at once (the answer arrives through `subscribe`). */
  ensure(months: readonly string[], quotes: readonly Currency[], today: string): void;
  /** What is happening for these months and quotes: a request in flight, a recent failure, or nothing. */
  activity(months: readonly string[], quotes: readonly Currency[]): RatesActivity;
  /** Resolves when every request started so far has settled (tests; a pull-to-refresh). */
  settled(): Promise<void>;
}

function monthEnd(monthISO: string): string {
  const [year, month] = monthISO.split('-').map(Number);
  return monthISO + '-' + String(new Date(year, month, 0, 12).getDate()).padStart(2, '0');
}

function dayBefore(dateISO: string, days: number): string {
  return new Date(Date.parse(dateISO + 'T12:00:00Z') - days * 86400000).toISOString().slice(0, 10);
}

/** Whether a (quote, month) needs a request now. */
export function needsFetch(coverage: RateCoverage | undefined, monthISO: string, today: string, now: Date): boolean {
  if (monthISO > today.slice(0, 7) || monthISO < EARLIEST_RATE_MONTH) return false;
  if (!coverage) return true;
  const end = monthEnd(monthISO);
  // Asked after the month ended: final.
  if (coverage.fetchedAt.slice(0, 10) > end && coverage.throughISO >= end) return false;
  return now.getTime() - Date.parse(coverage.fetchedAt) >= REFRESH_MS;
}

/** The request for one month: the month and the week before it, through today at most. */
export function monthRequest(monthISO: string, quotes: readonly Currency[], today: string): RateRequest {
  const end = monthEnd(monthISO);
  return { from: dayBefore(monthISO + '-01', 7), to: end < today ? end : today, quotes: [...quotes].sort() };
}

/** The months of a report window: `count` months ending at `monthISO`, oldest first. */
export function monthsEnding(monthISO: string, count: number): string[] {
  return Array.from({ length: count }, (_, index) => shiftMonthISO(monthISO, index - count + 1));
}

export function createRatesStore({ cache, fetchRates, now = () => new Date() }: {
  cache: RateCache;
  fetchRates: (request: RateRequest) => Promise<ExchangeRate[]>;
  now?: () => Date;
}): RatesStore {
  let rates: ExchangeRate[] = [];
  const coverage = new Map<string, RateCoverage>();
  let state: RatesSnapshot = { book: rateBook([]), loaded: false, lastFetchedAt: null };
  const listeners = new Set<() => void>();
  // In flight and failed are tracked per (quote, month): a request for EUR in September never blocks one for JPY
  // in September started while it is pending (two screens, or two quick changes of the display currency).
  const inFlight = new Map<string, Promise<void>>(); // by request (month and its quotes)
  const pendingQuotes = new Set<string>();           // quote|month keys being fetched
  const failures = new Map<string, { at: number; kind: 'offline' | 'provider' }>(); // by quote|month
  const waiting: { months: string[]; quotes: Currency[]; today: string }[] = [];
  const key = (quote: Currency, month: string) => quote + '|' + month;
  // Every notification carries a new snapshot object (same book when only the activity changed), so a
  // `useSyncExternalStore` subscriber re-renders for "fetching" and "offline" too, not only for new rates.
  const emit = () => { state = { ...state }; for (const listener of [...listeners]) listener(); };
  const publish = (lastFetchedAt = state.lastFetchedAt) => { state = { book: rateBook(rates), loaded: true, lastFetchedAt }; for (const listener of [...listeners]) listener(); };

  const loading = cache.load().then(loaded => {
    rates = loaded.rates;
    for (const item of loaded.coverage) coverage.set(key(item.quote, item.monthISO), item);
    const latest = loaded.coverage.reduce<string | null>((best, item) => best === null || item.fetchedAt > best ? item.fetchedAt : best, null);
    publish(latest);
  }, () => { publish(); }).then(() => {
    for (const request of waiting.splice(0)) store.ensure(request.months, request.quotes, request.today);
  });

  const fetchMonth = (month: string, quotes: Currency[], today: string) => {
    const request = monthRequest(month, quotes, today);
    const keys = quotes.map(quote => key(quote, month));
    for (const item of keys) pendingQuotes.add(item);
    const requestKey = month + ':' + request.quotes.join(',');
    const task = (async () => {
      try {
        const fetched = await fetchRates(request);
        const fetchedAt = now().toISOString();
        const covered = quotes.map(quote => ({ quote, monthISO: month, throughISO: request.to, fetchedAt }));
        // Memory first: the session sees the rates even if the cache cannot be written.
        const replaced = new Map(rates.map(rate => [rate.quote + '|' + rate.effectiveDate, rate]));
        for (const rate of fetched) {
          const previous = replaced.get(rate.quote + '|' + rate.effectiveDate);
          if (!previous || previous.fetchedAt.slice(0, 10) <= previous.effectiveDate) replaced.set(rate.quote + '|' + rate.effectiveDate, rate);
        }
        rates = [...replaced.values()];
        for (const item of covered) coverage.set(key(item.quote, item.monthISO), item);
        for (const item of keys) failures.delete(item);
        try { await cache.save(fetched, covered); } catch { /* kept in memory for this session */ }
        publish(fetchedAt);
      } catch (error) {
        const failure = { at: now().getTime(), kind: error instanceof RateFetchError ? error.kind : 'provider' as const };
        for (const item of keys) failures.set(item, failure);
        emit();
      } finally {
        inFlight.delete(requestKey);
        for (const item of keys) pendingQuotes.delete(item);
      }
    })();
    inFlight.set(requestKey, task);
    emit();
  };

  const store: RatesStore = {
    getState: () => state,
    subscribe: listener => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    ensure(months, quotes, today) {
      if (!quotes.length || !months.length) return;
      if (!state.loaded) { waiting.push({ months: [...months], quotes: [...quotes], today }); return; }
      const moment = now();
      for (const month of new Set(months)) {
        const missing = quotes.filter(quote => {
          const item = key(quote, month), failure = failures.get(item);
          if (pendingQuotes.has(item) || (failure && moment.getTime() - failure.at < RETRY_MS)) return false;
          return needsFetch(coverage.get(item), month, today, moment);
        });
        if (missing.length) fetchMonth(month, missing, today);
      }
    },
    activity(months, quotes) {
      if (!quotes.length) return 'idle';
      if (!state.loaded) return 'loading';
      const keys = months.flatMap(month => quotes.map(quote => key(quote, month)));
      if (keys.some(item => pendingQuotes.has(item))) return 'fetching';
      const failure = keys.map(item => failures.get(item)).find(Boolean);
      return failure ? failure.kind : 'idle';
    },
    async settled() {
      await loading;
      while (inFlight.size) await Promise.all([...inFlight.values()]);
    },
  };
  return store;
}
