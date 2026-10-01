import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dailyAverageMinor, spendingWindow, type Account, type Entry, type RecurringRule } from '@finanzapp/domain';
import * as homeFocus from '../src/ui/home-focus.ts';
import { COMMITMENT_HORIZON_DAYS, COMMITMENT_ROWS, RECENT_ROWS, homeCommitments, homeRecent, recentRowLimit, spendingPerDay } from '../src/ui/home-focus.ts';

// Producto 24UX6A: what Inicio shows under its number, as pure selections. Synthetic fixtures only.
const at = '2026-09-01T12:00:00.000Z';
const rule = (id: string, nextDateISO: string, extra: Partial<RecurringRule> = {}): RecurringRule => ({
  id, accountId: 'a', kind: 'expense', amountMinor: 1000, merchant: id, category: 'Suscripciones', frequency: 'monthly',
  anchorDateISO: nextDateISO, nextDateISO, active: true, deleted: false, createdAt: at, revision: 0, updatedAt: at, ...extra,
});
const everyAccount = () => true;
const ids = (items: readonly { id: string }[]) => items.map(item => item.id).join(',');

test('24UX6A: Inicio lists the expense commitments due within seven days, soonest first, two at most', () => {
  assert.equal(COMMITMENT_HORIZON_DAYS, 7);
  assert.equal(COMMITMENT_ROWS, 2);
  const today = '2026-09-28';
  const rules = [rule('later', '2026-10-05'), rule('edge', '2026-10-04'), rule('today', '2026-09-28'), rule('mid', '2026-10-01')];
  assert.equal(ids(homeCommitments(rules, today, everyAccount)), 'today,mid', 'the soonest two; the rest stay in Recurrentes');
  assert.equal(ids(homeCommitments([rule('edge', '2026-10-04'), rule('later', '2026-10-05')], today, everyAccount)), 'edge',
    'today plus six days is the last day inside the week; the eighth day waits');
  // A tie on the day reads by merchant, so the order never depends on storage.
  assert.equal(ids(homeCommitments([rule('b', '2026-09-29'), rule('a', '2026-09-29')], today, everyAccount)), 'a,b');
  // Many due the same week never grow the section past two rows.
  const week = ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02'].map((day, index) => rule('r' + index, day));
  assert.equal(homeCommitments(week, today, everyAccount).length, 2, 'two rows at most, whatever is due');
  // The input is not reordered in place: the screen's archive stays as stored.
  const stored = [rule('z', '2026-09-30'), rule('y', '2026-09-29')];
  homeCommitments(stored, today, everyAccount);
  assert.equal(ids(stored), 'z,y');
});

test('24UX6A: nothing due this week means no commitments section, and paused, deleted, income, overdue and hidden rules never appear', () => {
  const today = '2026-09-28';
  assert.equal(homeCommitments([rule('next-month', '2026-10-20')], today, everyAccount).length, 0, 'no section listing next month');
  assert.equal(homeCommitments(undefined, today, everyAccount).length, 0);
  assert.equal(homeCommitments([], today, everyAccount).length, 0);
  const excluded = [
    rule('paused', '2026-09-29', { active: false }),
    rule('deleted', '2026-09-29', { active: false, deleted: true }),
    rule('salary', '2026-09-29', { kind: 'income' }),
    rule('overdue', '2026-09-27'),
    rule('usd', '2026-09-29', { accountId: 'u' }),
  ];
  assert.equal(ids(homeCommitments(excluded, today, accountId => accountId === 'a')), '');
  assert.equal(ids(homeCommitments([rule('usd', '2026-09-29', { accountId: 'u' })], today, accountId => accountId === 'u')), 'usd', 'the display decides which accounts count');
  // A deletion record wins even when the rule still reads as active (a deletion is never undone by a stale flag).
  assert.equal(homeCommitments([rule('gone', '2026-09-29', { deleted: true })], today, everyAccount).length, 0);
  // Excluded rules never take a slot from a visible one.
  assert.equal(ids(homeCommitments([...excluded, rule('kept', '2026-10-02')], today, accountId => accountId === 'a')), 'kept');
});

test('24UX6A: the insight line is gone from Inicio (owner decision): home-focus no longer exports it', () => {
  const exported = Object.keys(homeFocus);
  for (const removed of ['homeInsight', 'CONCENTRATION_SHARE']) assert.equal(exported.includes(removed), false, removed + ' was removed with the insight line');
});

test('24UX6A: the recent activity lists four rows under the commitments and six when there are none', () => {
  assert.equal(RECENT_ROWS.withCommitments, 4);
  assert.equal(RECENT_ROWS.alone, 6);
  assert.equal(recentRowLimit(true), 4);
  assert.equal(recentRowLimit(false), 6);
});

const account = (id: string, currency: Account['currency'], extra: Partial<Account> = {}): Account => ({ id, name: 'Cuenta ' + id, currency, openingMinor: 0, createdAt: at, ...extra });
const entry = (id: string, dateISO: string, extra: Partial<Entry> = {}): Entry => ({
  id, accountId: 'ars', kind: 'expense', amountMinor: 1000, merchant: 'Comercio ' + id, category: 'Comida', dateISO, createdAt: dateISO + 'T10:00:00.000Z', ...extra,
});
const september = { startISO: '2026-09-01', endISO: '2026-09-30' };
const accounts = [account('ars', 'ARS'), account('usd', 'USD')];

test('24UX6A: the recent activity is this period\'s expenses and incomes in view, newest by day then by when recorded, at most the limit', () => {
  const entries = [
    entry('old', '2026-08-31'),
    entry('first', '2026-09-01'),
    entry('salary', '2026-09-05', { kind: 'income', amountMinor: 500000 }),
    entry('morning', '2026-09-20', { createdAt: '2026-09-20T08:00:00.000Z' }),
    entry('evening', '2026-09-20', { createdAt: '2026-09-20T21:00:00.000Z' }),
    entry('future', '2026-10-01'),
  ];
  const all = homeRecent(entries, accounts, september, everyAccount, 10);
  assert.equal(ids(all), 'evening,morning,salary,first', 'newest day first; on the same day the later recorded first; only the period');
  assert.equal(all.every(item => item.kind === 'expense' || item.kind === 'income'), true, 'activity is expenses and incomes: a transfer is not an Entry, so it never reaches the list');
  assert.equal(ids(homeRecent(entries, accounts, september, everyAccount, 2)), 'evening,morning', 'the limit keeps the newest');
  const busy = Array.from({ length: 9 }, (_, index) => entry('d' + (index + 1), '2026-09-' + String(index + 1).padStart(2, '0')));
  assert.equal(ids(homeRecent(busy, accounts, september, everyAccount, recentRowLimit(true))), 'd9,d8,d7,d6', 'four under the commitments');
  assert.equal(ids(homeRecent(busy, accounts, september, everyAccount, recentRowLimit(false))), 'd9,d8,d7,d6,d5,d4', 'six alone');
  // Each row keeps its own amount and currency: the selection never converts or rewrites an entry.
  const salary = homeRecent(entries, accounts, september, everyAccount, 10).find(item => item.id === 'salary');
  assert.equal(salary, entries[2], 'the stored entry itself, untouched');
  // An empty month has no section.
  assert.equal(homeRecent([entry('old', '2026-08-31')], accounts, september, everyAccount, 6).length, 0);
  assert.equal(homeRecent([], accounts, september, everyAccount, 6).length, 0);
});

test('24UX6A: the recent activity leaves out the accounts the display does not show, and entries of unknown accounts', () => {
  const entries = [
    entry('pesos', '2026-09-10'),
    entry('dollars', '2026-09-11', { accountId: 'usd' }),
    entry('orphan', '2026-09-12', { accountId: 'missing' }),
  ];
  const onlyArs = (item: Account) => item.currency === 'ARS';
  assert.equal(ids(homeRecent(entries, accounts, september, onlyArs, 6)), 'pesos', 'a single-currency view lists only its accounts');
  assert.equal(ids(homeRecent(entries, accounts, september, everyAccount, 6)), 'dollars,pesos', 'consolidated: every account, each in its own currency');
  assert.equal(homeRecent(entries, accounts, september, () => false, 6).length, 0);
});

test('24UX6A: Gastado\'s per-day line is the month so far divided by the days elapsed, the same daily average as Reportes', () => {
  const period = spendingWindow('ARS', 'month', '2026-09-10');
  assert.equal(period.startISO, '2026-09-01');
  assert.equal(period.endISO, '2026-09-10', 'until today, not the whole month');
  assert.equal(spendingPerDay({ status: 'ready', minor: 100000 }, period), 10000, 'ten days elapsed');
  assert.equal(spendingPerDay({ status: 'ready', minor: 100000 }, period), dailyAverageMinor(100000, period));
  assert.equal(spendingPerDay({ status: 'ready', minor: 1001 }, period), dailyAverageMinor(1001, period), 'rounded the way Reportes rounds');
  const first = spendingWindow('USD', 'month', '2026-09-01');
  assert.equal(spendingPerDay({ status: 'ready', minor: 2500 }, first), 2500, 'the first day of the month divides by one');
});

test('24UX6A: no per-day figure without a ready positive total; it never throws', () => {
  const period = spendingWindow('ARS', 'month', '2026-09-10');
  assert.equal(spendingPerDay({ status: 'ready', minor: 0 }, period), null, 'no spending says «Sin gastos este mes», never «0 por día»');
  assert.equal(spendingPerDay({ status: 'ready' }, period), null);
  assert.equal(spendingPerDay({ status: 'ready', minor: -500 }, period), null);
  assert.equal(spendingPerDay({ status: 'unavailable' }, period), null, 'a missing rate gives the currencies\' parts, never a partial per-day');
  assert.equal(spendingPerDay({ status: 'unavailable', minor: 9000 }, period), null);
  assert.equal(spendingPerDay({ status: 'out-of-range' }, period), null);
  // Malformed inputs fall back to no line instead of breaking Inicio.
  assert.doesNotThrow(() => spendingPerDay({ status: 'ready', minor: 1000 }, { currency: 'ARS', startISO: '2026-09-10', endISO: '2026-09-01' }));
  assert.equal(spendingPerDay({ status: 'ready', minor: 1000 }, { currency: 'ARS', startISO: '2026-09-10', endISO: '2026-09-01' }), null, 'an inverted period');
  assert.equal(spendingPerDay({ status: 'ready', minor: 1000 }, { currency: 'ARS', startISO: 'nope', endISO: '2026-09-01' }), null, 'an invalid date');
  assert.equal(spendingPerDay({ status: 'ready', minor: 0.5 }, period), null, 'a non-integer amount is not minor units');
  assert.equal(spendingPerDay({ status: 'ready', minor: Number.MAX_SAFE_INTEGER + 2 }, period), null, 'beyond safe integers');
});
