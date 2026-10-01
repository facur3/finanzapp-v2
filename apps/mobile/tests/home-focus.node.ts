import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BUDGET_WARNING_RATIO, initialRecord, initialTransferRecord, recurringForecastByCurrency, snapshotFromArchive, summarizeMonthlyBudgets, validateTransfer, type Account, type Entry,
  type LedgerArchive, type MonthlyBudget, type RecurringRule, type Transfer } from '@finanzapp/domain';
import { mergeActivity, type ActivityItem } from '../src/ui/presentation.ts';
import * as homeFocus from '../src/ui/home-focus.ts';
import { COMMITMENT_ROWS, COMMITMENT_WINDOW_DAYS, RECENT_ROWS, homeBudgetAttention, homeCommitments, homeRecent, recentRowLimit } from '../src/ui/home-focus.ts';

// Producto 24UX6A: what Inicio shows under its number, as pure selections. Synthetic fixtures only.
const at = '2026-09-01T12:00:00.000Z';
const rule = (id: string, nextDateISO: string, extra: Partial<RecurringRule> = {}): RecurringRule => ({
  id, accountId: 'a', kind: 'expense', amountMinor: 1000, merchant: id, category: 'Suscripciones', frequency: 'monthly',
  anchorDateISO: nextDateISO, nextDateISO, active: true, deleted: false, createdAt: at, revision: 0, updatedAt: at, ...extra,
});
const everyAccount = () => true;
const ids = (items: readonly { id: string }[]) => items.map(item => item.id).join(',');

test('24UX6C2: Inicio\'s commitments window is thirty days from today, two rows at most', () => {
  assert.equal(COMMITMENT_WINDOW_DAYS, 30);
  assert.equal(COMMITMENT_ROWS, 2);
  assert.equal(Object.keys(homeFocus).includes('COMMITMENT_HORIZON_DAYS'), false, 'the seven-day horizon is gone');
});

test('24UX6C2: the owner\'s examples: on October 1 everything due through October 31 counts, soonest two shown', () => {
  const today = '2026-10-01';
  assert.equal(ids(homeCommitments([rule('oct5', '2026-10-05'), rule('oct15', '2026-10-15')], today, everyAccount)), 'oct5,oct15', 'Oct 5 and Oct 15: both');
  assert.equal(ids(homeCommitments([rule('oct10', '2026-10-10'), rule('oct30', '2026-10-30')], today, everyAccount)), 'oct10,oct30', 'Oct 10 and Oct 30: both');
  assert.equal(ids(homeCommitments([rule('oct5', '2026-10-05'), rule('oct10', '2026-10-10'), rule('oct30', '2026-10-30')], today, everyAccount)), 'oct5,oct10',
    'three in the window: the soonest two; Oct 30 is left to Recurrentes');
  // The window rolls from today, never the calendar month: on October 15 it crosses into November.
  assert.equal(ids(homeCommitments([rule('nov10', '2026-11-10'), rule('oct30', '2026-10-30')], '2026-10-15', everyAccount)), 'oct30,nov10',
    'Oct 30 and Nov 10 from Oct 15: both, across the month');
  // The input is not reordered in place: the screen\'s archive stays as stored.
  const stored = [rule('z', '2026-10-20'), rule('y', '2026-10-02')];
  homeCommitments(stored, today, everyAccount);
  assert.equal(ids(stored), 'z,y');
});

test('24UX6C2: the window is inclusive at both ends: today and today + 30 in, yesterday and today + 31 out', () => {
  const today = '2026-10-01';
  const one = (nextDateISO: string) => ids(homeCommitments([rule('r', nextDateISO)], today, everyAccount));
  assert.equal(one('2026-10-01'), 'r', 'today is included');
  assert.equal(one('2026-10-31'), 'r', 'today + 30 days (Oct 31 for Oct 1) is included');
  assert.equal(one('2026-11-01'), '', 'today + 31 days (Nov 1) is outside');
  assert.equal(one('2026-09-30'), '', 'yesterday (a rule still catching up) is outside');
  // Thirty days, never "one month": from February 1 (a 28-day February) the window reaches March 3, not March 1.
  assert.equal(ids(homeCommitments([rule('in', '2026-03-03'), rule('out', '2026-03-04')], '2026-02-01', everyAccount)), 'in');
  // Nothing in the window means no section at all.
  assert.equal(homeCommitments([rule('later', '2026-11-01'), rule('past', '2026-09-30')], today, everyAccount).length, 0);
  assert.equal(homeCommitments(undefined, today, everyAccount).length, 0);
  assert.equal(homeCommitments([], today, everyAccount).length, 0);
});

test('24UX6C2: Inicio\'s window is the same as Recurrentes\' «próximos 30 días» forecast', () => {
  const today = '2026-10-01';
  const accountsInView = [{ id: 'a', currency: 'ARS' as const }];
  for (const [day, expected] of [['2026-10-01', 1], ['2026-10-31', 1], ['2026-11-01', 0]] as const) {
    const rules = [rule('r', day)];
    const forecast = recurringForecastByCurrency(rules, accountsInView, today);
    const counted = forecast.reduce((sum, item) => sum + (item.status === 'ready' ? item.count : 0), 0);
    assert.equal(counted, expected, day + ' in the forecast');
    assert.equal(homeCommitments(rules, today, everyAccount).length, expected, day + ' on Inicio, the same answer');
  }
});

test('24UX6C2: paused, deleted, income and out-of-view rules never appear, and never take a slot', () => {
  const today = '2026-10-01';
  const excluded = [
    rule('paused', '2026-10-02', { active: false }),
    rule('deleted', '2026-10-02', { active: false, deleted: true }),
    rule('salary', '2026-10-02', { kind: 'income' }),
    rule('overdue', '2026-09-30'),
    rule('usd', '2026-10-02', { accountId: 'u' }),
  ];
  assert.equal(ids(homeCommitments(excluded, today, accountId => accountId === 'a')), '');
  assert.equal(ids(homeCommitments([rule('usd', '2026-10-02', { accountId: 'u' })], today, accountId => accountId === 'u')), 'usd', 'the display decides which accounts count');
  // A deletion record wins even when the rule still reads as active (a deletion is never undone by a stale flag).
  assert.equal(homeCommitments([rule('gone', '2026-10-02', { deleted: true })], today, everyAccount).length, 0);
  // Excluded rules due sooner never push a visible one out of the two rows.
  assert.equal(ids(homeCommitments(excluded.concat([rule('kept', '2026-10-25'), rule('also', '2026-10-28')]), today, accountId => accountId === 'a')), 'kept,also');
});

test('24UX6C2: the order is deterministic (date, then merchant, then id) and the cut to two comes after the filter and the sort', () => {
  const today = '2026-10-01';
  // A tie on the day reads by merchant; a tie on day and merchant reads by id.
  assert.equal(ids(homeCommitments([rule('b', '2026-10-03'), rule('a', '2026-10-03')], today, everyAccount)), 'a,b');
  assert.equal(ids(homeCommitments([rule('x', '2026-10-03', { merchant: 'Zeta' }), rule('y', '2026-10-03', { merchant: 'Alfa' })], today, everyAccount)), 'y,x',
    'merchant, not id, breaks a tie on the day');
  assert.equal(ids(homeCommitments([rule('id-2', '2026-10-03', { merchant: 'Netflix' }), rule('id-1', '2026-10-03', { merchant: 'Netflix' })], today, everyAccount)), 'id-1,id-2',
    'same day and merchant: by id');
  // Five in the window given in a scrambled order, mixed with rules outside it: always the same two.
  const five = [rule('r3', '2026-10-20'), rule('r5', '2026-10-31'), rule('r1', '2026-10-02'), rule('r4', '2026-10-25'), rule('r2', '2026-10-09')];
  const noise = [rule('before', '2026-09-29'), rule('after', '2026-11-02'), rule('paused', '2026-10-01', { active: false })];
  const orders = [five, five.slice().reverse(), [five[2], five[4], five[0], five[3], five[1]], noise.concat(five), five.concat(noise)];
  for (const order of orders) assert.equal(ids(homeCommitments(order, today, everyAccount)), 'r1,r2', 'the soonest two, whatever the stored order');
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

// 24UX6C2 (owner refinement): the one budget fact Inicio may show, read from real domain summaries of a synthetic ledger.
const budgetAt = '2026-10-01T12:00:00.000Z';
const october = '2026-10';
const totalBudget = (amountMinor: number, extra: Partial<MonthlyBudget> = {}): MonthlyBudget =>
  ({ id: 'total', scope: 'total', currency: 'ARS', monthISO: october, amountMinor, active: true, createdAt: budgetAt, revision: 0, updatedAt: budgetAt, ...extra } as MonthlyBudget);
const categoryBudget = (amountMinor: number, category = 'Comida'): MonthlyBudget =>
  ({ id: 'cat', scope: 'category', category, currency: 'ARS', monthISO: october, amountMinor, active: true, createdAt: budgetAt, revision: 0, updatedAt: budgetAt });
/** A synthetic ledger whose October ARS expenses add up to `spentMinor` (two entries), plus noise the budget never measures. */
const ledgerSpending = (spentMinor: number) => {
  const half = Math.floor(spentMinor / 2);
  const entries = [
    entry('a', '2026-10-02', { amountMinor: half }),
    entry('b', '2026-10-05', { amountMinor: spentMinor - half, category: 'Transporte' }),
    entry('income', '2026-10-03', { kind: 'income', amountMinor: 9000000 }),
    entry('september', '2026-09-30', { amountMinor: 9000000 }),
    entry('dollars', '2026-10-04', { accountId: 'usd', amountMinor: 9000000 }),
  ].filter(item => item.amountMinor > 0);
  return snapshotFromArchive({ accounts, records: entries.map(initialRecord), transfers: [] });
};
const attentionOf = (spentMinor: number, budgets: MonthlyBudget[]) => homeBudgetAttention(summarizeMonthlyBudgets(ledgerSpending(spentMinor), budgets, 'ARS', october));

test('24UX6C2: no summary, or no general budget, means no budget row on Inicio', () => {
  assert.equal(homeBudgetAttention(null), null);
  assert.equal(attentionOf(5000000, []), null, 'no budget at all');
  assert.equal(attentionOf(5000000, [totalBudget(100000, { active: false })]), null, 'an inactive general budget is no budget');
  assert.equal(attentionOf(5000000, [totalBudget(100000, { monthISO: '2026-09' })]), null, 'last month\'s budget is not this month\'s');
  assert.equal(attentionOf(5000000, [totalBudget(100000, { currency: 'USD' })]), null, 'another currency\'s budget is not measured in ARS');
});

test('24UX6C2: a category sublimit never reaches Inicio, even exceeded', () => {
  const summary = summarizeMonthlyBudgets(ledgerSpending(200000), [categoryBudget(1000)], 'ARS', october);
  assert.equal(summary.rows[0].exceeded, true, 'the sublimit is exceeded in the domain');
  assert.equal(summary.total, null);
  assert.equal(homeBudgetAttention(summary), null, 'Inicio shows only the general budget');
  // Beside a calm general budget, an exceeded sublimit still shows nothing.
  assert.equal(attentionOf(200000, [totalBudget(1000000), categoryBudget(1000)]), null);
});

test('24UX6C2: the thresholds are the domain\'s: calm below 85 %, warning from 85 % through 100 %, exceeded above', () => {
  assert.equal(BUDGET_WARNING_RATIO, 0.85);
  const limit = [totalBudget(10000000)];
  assert.equal(attentionOf(0, limit), null, 'nothing spent: calm');
  assert.equal(attentionOf(8400000, limit), null, '84 %: calm, no row');
  assert.equal(attentionOf(8499999, limit), null, 'just under 85 %: calm');
  assert.equal(attentionOf(8500000, limit)?.state, 'warning', 'exactly 85 %: warning');
  assert.equal(attentionOf(9200000, limit)?.state, 'warning', '92 %: warning');
  const full = attentionOf(10000000, limit);
  assert.equal(full?.state, 'warning', 'exactly 100 %: still warning, never exceeded');
  assert.equal(full?.progress.exceeded, false);
  assert.equal(full?.progress.remainingMinor, 0);
  assert.equal(attentionOf(10001000, limit)?.state, 'exceeded', '100.01 %: exceeded');
  assert.equal(attentionOf(10000001, limit)?.state, 'exceeded', 'one minor unit over: exceeded');
  assert.equal(attentionOf(25000000, limit)?.state, 'exceeded', 'far over: exceeded');
});

test('24UX6C2: the attention carries the general budget\'s progress untouched, measured on the real ledger', () => {
  const budgets = [totalBudget(10000000), categoryBudget(100)];
  const summary = summarizeMonthlyBudgets(ledgerSpending(9000000), budgets, 'ARS', october);
  const warning = homeBudgetAttention(summary);
  assert.equal(warning?.state, 'warning');
  assert.equal(warning?.progress, summary.total, 'the summary\'s own total progress, not a copy or a recomputation');
  assert.equal(warning?.progress.budget.scope, 'total');
  assert.equal(warning?.progress.spentMinor, 9000000, 'only October\'s ARS expenses: no income, no other month, no other currency');
  assert.equal(warning?.progress.remainingMinor, 1000000);
  const overSummary = summarizeMonthlyBudgets(ledgerSpending(12500000), budgets, 'ARS', october);
  const over = homeBudgetAttention(overSummary);
  assert.equal(over?.state, 'exceeded');
  assert.equal(over?.progress, overSummary.total);
  assert.equal(over?.progress.remainingMinor, -2500000, 'the amount over is the negative remainder, never clamped to zero');
  assert.equal(over?.progress.spentMinor, 12500000);
});
