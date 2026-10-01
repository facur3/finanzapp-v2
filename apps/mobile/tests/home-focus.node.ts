import assert from 'node:assert/strict';
import { test } from 'node:test';
import { initialRecord, initialTransferRecord, snapshotFromArchive, validateTransfer, type Account, type Entry, type LedgerArchive, type RecurringRule, type Transfer } from '@finanzapp/domain';
import { mergeActivity, type ActivityItem } from '../src/ui/presentation.ts';
import * as homeFocus from '../src/ui/home-focus.ts';
import { COMMITMENT_HORIZON_DAYS, COMMITMENT_ROWS, RECENT_ROWS, homeCommitments, homeRecent, recentRowLimit } from '../src/ui/home-focus.ts';

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
/** A synthetic transfer between the two ARS accounts (the domain only accepts two accounts of one currency). */
const transfer = (id: string, dateISO: string, extra: Partial<Transfer> = {}): Transfer => ({
  id, fromAccountId: 'ars', toAccountId: 'ars2', amountMinor: 5000, note: '', dateISO, createdAt: dateISO + 'T10:00:00.000Z', ...extra,
});
const september = { startISO: '2026-09-01', endISO: '2026-09-30' };
const accounts = [account('ars', 'ARS'), account('usd', 'USD'), account('ars2', 'ARS'), account('usd2', 'USD')];
/** The rows' keys in order ('entry-<id>' / 'transfer-<id>'), the same keys Inicio renders with. */
const keys = (items: readonly ActivityItem[]) => items.map(item => item.key).join(',');
/** The ids of the rows in order, whatever their type. */
const rowIds = (items: readonly ActivityItem[]) => items.map(item => item.value.id).join(',');

test('24UX6A, 24UX6C2: the recent activity is this period\'s expenses and incomes in view, newest by day then by when recorded, at most the limit', () => {
  const entries = [
    entry('old', '2026-08-31'),
    entry('first', '2026-09-01'),
    entry('salary', '2026-09-05', { kind: 'income', amountMinor: 500000 }),
    entry('morning', '2026-09-20', { createdAt: '2026-09-20T08:00:00.000Z' }),
    entry('evening', '2026-09-20', { createdAt: '2026-09-20T21:00:00.000Z' }),
    entry('future', '2026-10-01'),
  ];
  const all = homeRecent(entries, [], accounts, september, everyAccount, 10);
  assert.equal(rowIds(all), 'evening,morning,salary,first', 'newest day first; on the same day the later recorded first; only the period');
  assert.equal(all.every(item => item.type === 'entry' && (item.value.kind === 'expense' || item.value.kind === 'income')), true,
    'with no transfers the activity is the expenses and incomes alone');
  assert.equal(keys(all), 'entry-evening,entry-morning,entry-salary,entry-first', 'each row keyed by its type and id');
  assert.equal(rowIds(homeRecent(entries, [], accounts, september, everyAccount, 2)), 'evening,morning', 'the limit keeps the newest');
  const busy = Array.from({ length: 9 }, (_, index) => entry('d' + (index + 1), '2026-09-' + String(index + 1).padStart(2, '0')));
  assert.equal(rowIds(homeRecent(busy, [], accounts, september, everyAccount, recentRowLimit(true))), 'd9,d8,d7,d6', 'four under the commitments');
  assert.equal(rowIds(homeRecent(busy, [], accounts, september, everyAccount, recentRowLimit(false))), 'd9,d8,d7,d6,d5,d4', 'six alone');
  // Each row keeps its own amount and currency: the selection never converts or rewrites an entry.
  const salary = homeRecent(entries, [], accounts, september, everyAccount, 10).find(item => item.value.id === 'salary');
  assert.equal(salary?.value, entries[2], 'the stored entry itself, untouched');
  // An empty month has no section.
  assert.equal(homeRecent([entry('old', '2026-08-31')], [], accounts, september, everyAccount, 6).length, 0);
  assert.equal(homeRecent([], [], accounts, september, everyAccount, 6).length, 0);
  // The inputs are not reordered in place.
  assert.equal(entries.map(item => item.id).join(','), 'old,first,salary,morning,evening,future');
});

test('24UX6A: the recent activity leaves out the accounts the display does not show, and entries of unknown accounts', () => {
  const entries = [
    entry('pesos', '2026-09-10'),
    entry('dollars', '2026-09-11', { accountId: 'usd' }),
    entry('orphan', '2026-09-12', { accountId: 'missing' }),
  ];
  const onlyArs = (item: Account) => item.currency === 'ARS';
  assert.equal(rowIds(homeRecent(entries, [], accounts, september, onlyArs, 6)), 'pesos', 'a single-currency view lists only its accounts');
  assert.equal(rowIds(homeRecent(entries, [], accounts, september, everyAccount, 6)), 'dollars,pesos', 'consolidated: every account, each in its own currency');
  assert.equal(homeRecent(entries, [], accounts, september, () => false, 6).length, 0);
});

test('24UX6C2: the recent activity mixes expenses, incomes and transfers, newest first, each a typed row keyed by its record', () => {
  const lunch = entry('lunch', '2026-09-14');
  const salary = entry('salary', '2026-09-10', { kind: 'income', amountMinor: 500000 });
  const move = transfer('move', '2026-09-12', { note: 'Ahorro' });
  const items = homeRecent([salary, lunch], [move], accounts, september, everyAccount, 10);
  assert.equal(keys(items), 'entry-lunch,transfer-move,entry-salary', 'one list, newest day first, whatever the type');
  assert.equal(items.map(item => item.type).join(','), 'entry,transfer,entry');
  // Each row is the stored record itself: the amount, the currency (through its account) and the note are untouched.
  assert.equal(items[0].value, lunch);
  assert.equal(items[1].value, move);
  assert.equal(items[2].value, salary);
  const shown = items[1];
  assert.equal(shown.type === 'transfer' && shown.value.amountMinor === 5000 && shown.value.fromAccountId === 'ars' && shown.value.toAccountId === 'ars2', true,
    'the transfer keeps its own amount and both accounts');
  // The same rule Movimientos uses: homeRecent is mergeActivity over what the view shows, cut after the merge.
  assert.equal(keys(items), keys(mergeActivity([salary, lunch], [move])));
});

test('24UX6C2: the order is the day, then when it was recorded, then the record\'s key, so equal times never shuffle', () => {
  const same = '2026-09-15T09:00:00.000Z';
  const entries = [
    entry('b', '2026-09-15', { createdAt: same }),
    entry('a', '2026-09-15', { createdAt: same }),
    entry('late', '2026-09-15', { createdAt: '2026-09-15T20:00:00.000Z' }),
    entry('yesterday', '2026-09-14', { createdAt: '2026-09-16T23:00:00.000Z' }),
  ];
  const transfers = [transfer('x', '2026-09-15', { createdAt: same }), transfer('early', '2026-09-15', { createdAt: '2026-09-15T07:00:00.000Z' })];
  const expected = 'entry-late,transfer-x,entry-b,entry-a,transfer-early,entry-yesterday';
  assert.equal(keys(homeRecent(entries, transfers, accounts, september, everyAccount, 10)), expected,
    'the day first (a later recording of an earlier day stays below), then the later recorded, then the key descending');
  // Any input order gives the same list.
  assert.equal(keys(homeRecent(entries.slice().reverse(), transfers.slice().reverse(), accounts, september, everyAccount, 10)), expected);
  assert.equal(keys(homeRecent([entries[2], entries[0], entries[3], entries[1]], [transfers[1], transfers[0]], accounts, september, everyAccount, 10)), expected);
});

test('24UX6C2: a transfer between two shown accounts is one row, never one per side', () => {
  const move = transfer('move', '2026-09-12');
  // Both ARS accounts are shown (a single ARS view and the consolidated one): the transfer still appears once.
  for (const [label, view] of [['single ARS', (item: Account) => item.currency === 'ARS'], ['consolidated', everyAccount]] as const) {
    const items = homeRecent([], [move], accounts, september, view, 10);
    assert.equal(keys(items), 'transfer-move', label + ': one record, one row');
  }
  // Even beside entries in both of its accounts.
  const items = homeRecent([entry('out', '2026-09-11'), entry('in', '2026-09-13', { accountId: 'ars2' })], [move], accounts, september, everyAccount, 10);
  assert.equal(keys(items), 'entry-in,transfer-move,entry-out');
  assert.equal(items.filter(item => item.type === 'transfer').length, 1);
});

test('24UX6C2: the limit applies after the merge: the newest rows overall, whatever their type', () => {
  const entries = [entry('e1', '2026-09-01'), entry('e3', '2026-09-03'), entry('e5', '2026-09-05')];
  const transfers = [transfer('t2', '2026-09-02'), transfer('t4', '2026-09-04'), transfer('t6', '2026-09-06')];
  assert.equal(keys(homeRecent(entries, transfers, accounts, september, everyAccount, recentRowLimit(true))), 'transfer-t6,entry-e5,transfer-t4,entry-e3',
    'three entries and three transfers with a limit of four: the four newest of the six');
  assert.equal(keys(homeRecent(entries, transfers, accounts, september, everyAccount, recentRowLimit(false))),
    'transfer-t6,entry-e5,transfer-t4,entry-e3,transfer-t2,entry-e1', 'six alone: all of them');
  // Never four entries plus four transfers: one cut over one list.
  const many = homeRecent(entries.concat([entry('e7', '2026-09-07')]), transfers.concat([transfer('t8', '2026-09-08')]), accounts, september, everyAccount, 4);
  assert.equal(many.length, 4);
  assert.equal(keys(many), 'transfer-t8,entry-e7,transfer-t6,entry-e5');
});

test('24UX6C2: a transfer outside the period or outside the view is left out', () => {
  const transfers = [transfer('aug', '2026-08-31'), transfer('sep', '2026-09-01'), transfer('end', '2026-09-30'), transfer('oct', '2026-10-01')];
  assert.equal(keys(homeRecent([], transfers, accounts, september, everyAccount, 10)), 'transfer-end,transfer-sep', 'only the period, its first and last days included');
  // Single mode on USD: an ARS transfer is not listed; a USD one is, at its own amount.
  const dollars = transfer('usd-move', '2026-09-10', { fromAccountId: 'usd', toAccountId: 'usd2', amountMinor: 700 });
  const pesos = transfer('ars-move', '2026-09-11');
  const onlyUsd = (item: Account) => item.currency === 'USD';
  const usdItems = homeRecent([], [pesos, dollars], accounts, september, onlyUsd, 10);
  assert.equal(keys(usdItems), 'transfer-usd-move', 'the ARS transfer stays out of a USD view');
  assert.equal(usdItems[0].value, dollars, 'the USD transfer itself, never converted');
  assert.equal(keys(homeRecent([], [pesos, dollars], accounts, september, (item: Account) => item.currency === 'ARS', 10)), 'transfer-ars-move');
  assert.equal(keys(homeRecent([], [pesos, dollars], accounts, september, everyAccount, 10)), 'transfer-ars-move,transfer-usd-move', 'consolidated: both, once each');
  assert.equal(homeRecent([], [pesos, dollars], accounts, september, () => false, 10).length, 0);
  // A transfer of an unknown account is never listed.
  assert.equal(homeRecent([], [transfer('orphan', '2026-09-12', { fromAccountId: 'missing' })], accounts, september, everyAccount, 10).length, 0);
  // Why the source account decides for both sides: the domain refuses a transfer between two currencies.
  assert.throws(() => validateTransfer(transfer('mixed', '2026-09-12', { toAccountId: 'usd' }), accounts), /misma moneda/);
});

test('24UX6C2: an undone transfer is absent: the snapshot Inicio reads holds only the live ones', () => {
  const kept = transfer('kept', '2026-09-10');
  const undone = transfer('undone', '2026-09-12');
  const archive: LedgerArchive = { accounts, records: [initialRecord(entry('lunch', '2026-09-11'))],
    transfers: [initialTransferRecord(kept), { ...initialTransferRecord(undone), revision: 1, voided: true, updatedAt: '2026-09-13T10:00:00.000Z' }] };
  const snapshot = snapshotFromArchive(archive);
  assert.equal(keys(homeRecent(snapshot.entries, snapshot.transfers ?? [], snapshot.accounts, september, everyAccount, 10)), 'entry-lunch,transfer-kept',
    'the voided transfer never reaches the list');
  // With every transfer undone the snapshot holds none (Inicio passes `snapshot.transfers ?? []`).
  const none = snapshotFromArchive({ ...archive, transfers: [{ ...initialTransferRecord(undone), revision: 1, voided: true, updatedAt: '2026-09-13T10:00:00.000Z' }] });
  assert.equal((none.transfers ?? []).length, 0);
  assert.equal(keys(homeRecent(none.entries, none.transfers ?? [], none.accounts, september, everyAccount, 10)), 'entry-lunch');
});

test('24UX6C: the line under Inicio\'s number is gone, and with it the per-day helper (the daily average lives in Reportes)', () => {
  assert.equal(Object.keys(homeFocus).includes('spendingPerDay'), false, 'spendingPerDay was removed with the Home subline');
});
