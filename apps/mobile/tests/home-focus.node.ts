import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BUDGET_WARNING_RATIO, budgetState, categoryKey, initialRecord, initialTransferRecord, recurringForecastByCurrency, snapshotFromArchive, summarizeMonthlyBudgets, validateTransfer, type Account, type Entry,
  type LedgerArchive, type MonthlyBudget, type RecurringRule, type Transfer } from '@finanzapp/domain';
import { mergeActivity, type ActivityItem } from '../src/ui/presentation.ts';
import * as homeFocus from '../src/ui/home-focus.ts';
import { BUDGET_ATTENTION_ROWS, COMMITMENT_ROWS, COMMITMENT_WINDOW_DAYS, RECENT_ROWS, budgetAttentions, homeBudgetAttention, homeBudgets, homeCommitments, homeRecent, recentRowLimit,
  type HomeBudget } from '../src/ui/home-focus.ts';

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

// 24UX6C2 pinned «a category sublimit never reaches Inicio». The 24UX6D refinement supersedes it: category budgets now
// reach Inicio through `homeBudgets` (below); `homeBudgetAttention` itself still reads only the GENERAL budget.
test('24UX6C2, superseded by the 24UX6D refinement: homeBudgetAttention reads only the general budget; a category budget, even exceeded, is not its answer', () => {
  const summary = summarizeMonthlyBudgets(ledgerSpending(200000), [categoryBudget(1000)], 'ARS', october);
  assert.equal(summary.rows[0].exceeded, true, 'the sublimit is exceeded in the domain');
  assert.equal(summary.total, null);
  assert.equal(homeBudgetAttention(summary), null, 'the general budget\'s attention only');
  // Beside a calm general budget, an exceeded sublimit is not the general budget's attention either.
  assert.equal(attentionOf(200000, [totalBudget(1000000), categoryBudget(1000)]), null);
  // ...but it is one of the summary's attentions now, and Inicio shows it (24UX6D refinement).
  assert.equal(budgetAttentions(summarizeMonthlyBudgets(ledgerSpending(200000), [totalBudget(1000000), categoryBudget(1000)], 'ARS', october)).map(item => item.progress.budget.id).join(), 'cat');
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

// ---- 24UX6D refinement (owner): the general budget AND category budgets that need attention, two rows at most ----------
// Synthetic fixtures only: four accounts (two ARS, two USD), October expenses per category, budgets sized to the ratio a
// test names. Every figure is the domain's own (`summarizeMonthlyBudgets`); nothing is converted.
type Spend = [category: string, amountMinor: number, accountId?: string];
let spendSeq = 0;
/** A ledger whose October expenses are `spends` (ARS account by default), plus noise no October budget measures. */
const ledgerOf = (spends: Spend[]) => snapshotFromArchive({ accounts, transfers: [], records: [
  ...spends.map(([category, amountMinor, accountId = 'ars']) => entry('s' + spendSeq++, '2026-10-0' + (1 + (spendSeq % 9)), { category, amountMinor, accountId })),
  entry('income-' + spendSeq, '2026-10-03', { kind: 'income', amountMinor: 9000000 }),
  entry('september-' + spendSeq, '2026-09-30', { amountMinor: 9000000, category: 'Supermercado' }),
].map(initialRecord) });
const general = (id: string, amountMinor: number, extra: Partial<MonthlyBudget> = {}): MonthlyBudget =>
  ({ id, scope: 'total', currency: 'ARS', monthISO: october, amountMinor, active: true, createdAt: budgetAt, revision: 0, updatedAt: budgetAt, ...extra } as MonthlyBudget);
const sublimit = (id: string, category: string, amountMinor: number, extra: Partial<MonthlyBudget> = {}): MonthlyBudget =>
  ({ id, scope: 'category', category, currency: 'ARS', monthISO: october, amountMinor, active: true, createdAt: budgetAt, revision: 0, updatedAt: budgetAt, ...extra } as MonthlyBudget);
/** homeBudgets as Inicio calls it: by default «Solo ARS» while ARS and USD are held. */
const shown = (snapshot: ReturnType<typeof ledgerOf>, budgets: MonthlyBudget[], mode: 'single' | 'consolidated' = 'single', display: 'ARS' | 'USD' | 'EUR' = 'ARS', held = ['ARS', 'USD'] as const) =>
  homeBudgets(snapshot, budgets, [...held], mode, display, october);
/** «state:currency:id» per row, in order. */
const rowsOf = (items: readonly HomeBudget[]) => items.map(item => item.state + ':' + item.currency + ':' + item.progress.budget.id).join(',');
/** Every permutation of a short list (the input order must never matter). */
const permutations = <T,>(items: T[]): T[][] => items.length <= 1 ? [items] : items.flatMap((item, i) => permutations([...items.slice(0, i), ...items.slice(i + 1)]).map(rest => [item, ...rest]));

test('24UX6D refinement: Inicio shows at most two budget rows; the old single-general selector is gone', () => {
  assert.equal(BUDGET_ATTENTION_ROWS, 2);
  assert.equal(Object.hasOwn(homeFocus, 'homeBudget'), false, 'homeBudget (one general budget) was replaced by homeBudgets');
  assert.equal(typeof homeFocus.homeBudgets, 'function');
});

test('24UX6D refinement: budgetAttentions is every budget of one summary in warning or exceeded, the general first, the domain\'s progress untouched', () => {
  assert.deepEqual(budgetAttentions(null), []);
  const data = ledgerOf([['Supermercado', 9700], ['Transporte', 5000], ['Ocio', 3300]]);
  const summary = summarizeMonthlyBudgets(data, [general('g', 20000), sublimit('s', 'Supermercado', 10000), sublimit('t', 'Transporte', 10000)], 'ARS', october);
  const items = budgetAttentions(summary);
  assert.equal(items.map(item => item.state + ':' + item.progress.budget.id).join(), 'warning:g,warning:s', 'Transporte at 50 % is calm');
  assert.equal(items[0].progress, summary.total, 'the summary\'s own general progress');
  assert.equal(items[1].progress, summary.rows.find(row => row.budget.id === 's'), 'the summary\'s own category progress');
  for (const item of items) assert.equal(item.state, budgetState(item.progress), 'the state is the domain\'s budgetState');
  assert.deepEqual(budgetAttentions(summarizeMonthlyBudgets(data, [], 'ARS', october)), [], 'no budget: nothing');
});

test('24UX6D refinement: nothing needs attention means an empty list (no budget UI): no budgets, calm general and calm categories, archived or another month\'s', () => {
  const data = ledgerOf([['Supermercado', 8400], ['Transporte', 5000]]);
  assert.deepEqual(shown(data, []), [], 'no budgets');
  assert.deepEqual(shown(data, [general('g', 100000), sublimit('s', 'Supermercado', 10000), sublimit('t', 'Transporte', 10000)]), [], 'general 13 %, Supermercado 84 %, Transporte 50 %: all calm');
  // An archived (inactive) or other-month budget never appears, even far over its limit.
  assert.deepEqual(shown(data, [sublimit('s', 'Supermercado', 100, { active: false, revision: 1, updatedAt: '2026-10-02T12:00:00.000Z' })]), [], 'an archived category budget');
  assert.deepEqual(shown(data, [general('g', 100, { active: false, revision: 1, updatedAt: '2026-10-02T12:00:00.000Z' })]), [], 'an archived general budget');
  assert.deepEqual(shown(data, [sublimit('s', 'Supermercado', 100, { monthISO: '2026-09' })]), [], 'September\'s category budget (September spending exists)');
  assert.deepEqual(shown(data, [general('g', 100, { monthISO: '2026-11' })]), [], 'November\'s general budget');
});

test('24UX6D refinement: a general warning alone; a category warning beside a calm general; category-only budgets now appear', () => {
  const data = ledgerOf([['Supermercado', 9000], ['Transporte', 1000]]);
  const alone = shown(data, [general('g', 11000)]);
  assert.equal(rowsOf(alone), 'warning:ARS:g', 'general at 91 %');
  assert.equal(JSON.stringify([alone[0].labelsCurrency, alone[0].progress.spentMinor, alone[0].progress.budget.scope]), JSON.stringify([false, 10000, 'total']));
  const category = shown(data, [general('g', 100000), sublimit('s', 'Supermercado', 10000)]);
  assert.equal(rowsOf(category), 'warning:ARS:s', 'Supermercado at 90 % beside a calm general (10 %)');
  assert.equal(JSON.stringify([category[0].progress.spentMinor, category[0].progress.remainingMinor, category[0].progress.ratio]), JSON.stringify([9000, 1000, 0.9]));
  assert.equal(rowsOf(shown(data, [sublimit('s', 'Supermercado', 1000)])), 'exceeded:ARS:s', 'a category budget with no general budget at all');
});

test('24UX6D refinement: two category warnings come by ratio; more than two eligible budgets give exactly two', () => {
  const data = ledgerOf([['Supermercado', 8800], ['Transporte', 9600], ['Ocio', 9000], ['Salud', 9300]]);
  assert.equal(rowsOf(shown(data, [sublimit('s', 'Supermercado', 10000), sublimit('t', 'Transporte', 10000)])), 'warning:ARS:t,warning:ARS:s', '96 % before 88 %');
  const four = shown(data, [sublimit('s', 'Supermercado', 10000), sublimit('t', 'Transporte', 10000), sublimit('o', 'Ocio', 10000), sublimit('h', 'Salud', 10000)]);
  assert.equal(four.length, BUDGET_ATTENTION_ROWS);
  assert.equal(rowsOf(four), 'warning:ARS:t,warning:ARS:h', 'the two highest: 96 % and 93 %');
});

test('24UX6D refinement: five categories needing attention: the top two only, the exceeded one first', () => {
  const data = ledgerOf([['A', 8600], ['B', 9900], ['C', 9100], ['D', 9500], ['E', 11000]]);
  const budgets = ['A', 'B', 'C', 'D', 'E'].map(name => sublimit('c' + name, name, 10000));
  const summary = summarizeMonthlyBudgets(data, budgets, 'ARS', october);
  assert.equal(budgetAttentions(summary).length, 5, 'all five need attention in the domain');
  assert.equal(rowsOf(shown(data, budgets)), 'exceeded:ARS:cE,warning:ARS:cB');
});

test('24UX6D refinement: exceeded before warning, even a category exceeded before a general warning', () => {
  const data = ledgerOf([['Supermercado', 11000], ['Ocio', 7000]]);
  // General 18000 of 20000 (90 %, warning); Supermercado 11000 of 10000 (110 %, exceeded).
  assert.equal(rowsOf(shown(data, [general('g', 20000), sublimit('s', 'Supermercado', 10000)])), 'exceeded:ARS:s,warning:ARS:g');
  // Many warnings with a higher ratio do not pass an exceeded one at 100.01 %.
  const edge = ledgerOf([['Supermercado', 10001], ['Ocio', 9999], ['Salud', 9998]]);
  assert.equal(rowsOf(shown(edge, [sublimit('s', 'Supermercado', 10000), sublimit('o', 'Ocio', 10000), sublimit('h', 'Salud', 10000)])), 'exceeded:ARS:s,warning:ARS:o');
});

test('24UX6D refinement: within a state the general budget comes before category budgets, even when a category\'s ratio is higher', () => {
  const data = ledgerOf([['Supermercado', 9900], ['Ocio', 7000]]);
  // Warning: general 16900 of 19800 (85.4 %) before Supermercado at 99 %.
  assert.equal(rowsOf(shown(data, [general('g', 19800), sublimit('s', 'Supermercado', 10000)])), 'warning:ARS:g,warning:ARS:s');
  // Exceeded: general 16900 of 16800 (100.6 %) before Supermercado at 990 %.
  assert.equal(rowsOf(shown(data, [general('g', 16800), sublimit('s', 'Supermercado', 1000)])), 'exceeded:ARS:g,exceeded:ARS:s');
});

test('24UX6D refinement: equal ratios fall back to the category\'s key (accents and case folded), then the order never depends on the input', () => {
  const data = ledgerOf([['Árboles', 9000], ['bares', 9000], ['Ópera', 9000], ['Cafetería', 9000]]);
  const accented = [sublimit('z1', 'Ópera', 10000), sublimit('z2', 'bares', 10000), sublimit('z3', 'Árboles', 10000)];
  // Raw code units would put «bares» (b) before «Árboles» (Á) and «Ópera»; the key folds them: arboles < bares < opera.
  assert.equal(categoryKey('Árboles') < categoryKey('bares') && 'bares' < 'Árboles', true, 'the fixture tells folded from raw order');
  assert.equal(rowsOf(shown(data, accented)), 'warning:ARS:z3,warning:ARS:z2');
  // Case: raw «Cafetería» (C) would come before «bares» (b); folded, bares < cafeteria.
  assert.equal(rowsOf(shown(data, [sublimit('a1', 'Cafetería', 10000), sublimit('a2', 'bares', 10000)])), 'warning:ARS:a2,warning:ARS:a1');
  // The same answer for every input order of the budgets (a general, three categories, one calm).
  const mixed = [general('g', 40000), sublimit('k1', 'Ópera', 10000), sublimit('k2', 'bares', 10000), sublimit('k3', 'Árboles', 10000), sublimit('k4', 'Cafetería', 100000)];
  const expected = rowsOf(shown(data, mixed));
  assert.equal(expected, 'warning:ARS:g,warning:ARS:k3', 'general 36000 of 40000 (90 %) first, then the first category by key');
  for (const order of permutations(mixed)) assert.equal(rowsOf(shown(data, order)), expected, order.map(budget => budget.id).join());
  // The input is never reordered in place.
  const stored = [...mixed];
  shown(data, stored);
  assert.equal(stored.map(budget => budget.id).join(), mixed.map(budget => budget.id).join());
});

test('24UX6D refinement: equal ratios across currencies: the display currency first, then the currency code', () => {
  const data = ledgerOf([['Supermercado', 9000, 'ars'], ['Supermercado', 900, 'usd']]);
  const ars = general('g-ars', 10000), usd = general('g-usd', 1000, { currency: 'USD' });
  assert.equal(rowsOf(shown(data, [ars, usd], 'consolidated', 'USD')), 'warning:USD:g-usd,warning:ARS:g-ars', 'both 90 %: the display currency\'s first');
  assert.equal(rowsOf(shown(data, [usd, ars], 'consolidated', 'ARS')), 'warning:ARS:g-ars,warning:USD:g-usd');
  // Neither is the display currency (EUR shown, nothing held in it): the code decides, ARS before USD.
  for (const order of permutations([usd, ars])) assert.equal(rowsOf(shown(data, order, 'consolidated', 'EUR')), 'warning:ARS:g-ars,warning:USD:g-usd');
  // A higher ratio still wins over the display currency: the tie-break is only for equal ratios.
  const higher = ledgerOf([['Supermercado', 9500, 'ars'], ['Supermercado', 900, 'usd']]);
  assert.equal(rowsOf(shown(higher, [ars, usd], 'consolidated', 'USD')), 'warning:ARS:g-ars,warning:USD:g-usd', 'ARS 95 % before USD 90 %');
});

test('24UX6D refinement: the owner\'s three examples', () => {
  // 1. General 90 %, Supermercado 97 %, Transporte 50 %: the general and Supermercado, both warnings, the general first (rule 2).
  const one = ledgerOf([['Supermercado', 9700], ['Transporte', 5000], ['Ocio', 3300]]);
  const first = shown(one, [general('g', 20000), sublimit('s', 'Supermercado', 10000), sublimit('t', 'Transporte', 10000)]);
  assert.equal(JSON.stringify(first.map(item => [item.state, item.progress.budget.id, item.progress.ratio])), JSON.stringify([['warning', 'g', 0.9], ['warning', 's', 0.97]]));
  // 2. General 50 %, Supermercado 95 %, Transporte 88 %: Supermercado then Transporte.
  const two = ledgerOf([['Supermercado', 9500], ['Transporte', 8800]]);
  const second = shown(two, [general('g', 36600), sublimit('s', 'Supermercado', 10000), sublimit('t', 'Transporte', 10000)]);
  assert.equal(JSON.stringify(second.map(item => [item.state, item.progress.budget.id, item.progress.ratio])), JSON.stringify([['warning', 's', 0.95], ['warning', 't', 0.88]]));
  // 3. General exceeded, one category exceeded, several warnings: the general exceeded, then the category exceeded.
  const three = ledgerOf([['Supermercado', 12000], ['Transporte', 9000], ['Ocio', 9500], ['Salud', 8600]]);
  const third = shown(three, [general('g', 20000), sublimit('s', 'Supermercado', 10000), sublimit('t', 'Transporte', 10000), sublimit('o', 'Ocio', 10000), sublimit('h', 'Salud', 10000)]);
  assert.equal(rowsOf(third), 'exceeded:ARS:g,exceeded:ARS:s');
});

test('24UX6D refinement: the thresholds for a category budget are the domain\'s: 84 % absent, exactly 85 % warning, exactly 100 % warning, one minor unit over exceeded', () => {
  const at = (spent: number, limit = 10000) => shown(ledgerOf([['Supermercado', spent]]), [sublimit('s', 'Supermercado', limit)]);
  assert.deepEqual(at(8400), [], '84 %');
  assert.deepEqual(at(8499), [], 'one minor unit under 85 %');
  assert.equal(rowsOf(at(8500)), 'warning:ARS:s', 'exactly 85 %');
  const full = at(10000);
  assert.equal(rowsOf(full), 'warning:ARS:s', 'exactly 100 %: still a warning');
  assert.equal(JSON.stringify([full[0].progress.remainingMinor, full[0].progress.exceeded]), JSON.stringify([0, false]));
  const over = at(10001);
  assert.equal(rowsOf(over), 'exceeded:ARS:s', 'one minor unit over');
  assert.equal(over[0].progress.remainingMinor, -1, 'the amount over, never clamped');
  // The same edges for the general budget, through homeBudgets.
  const gen = (spent: number) => rowsOf(shown(ledgerOf([['Ocio', spent]]), [general('g', 10000)]));
  assert.equal([gen(8400), gen(8500), gen(10000), gen(10001)].join('|'), '|warning:ARS:g|warning:ARS:g|exceeded:ARS:g');
});

test('24UX6D refinement: a budget keeps its own currency: an ARS budget reads only ARS accounts, never a converted USD expense; consolidated USD names it', () => {
  // Supermercado: ARS 90,00 on two ARS accounts and USD 90.000,00 on a USD account (that would dwarf any ARS limit if added).
  const data = ledgerOf([['Supermercado', 5000, 'ars'], ['Supermercado', 4000, 'ars2'], ['Supermercado', 9000000, 'usd']]);
  const budgets = [sublimit('s', 'Supermercado', 10000)];
  const domainRow = summarizeMonthlyBudgets(data, budgets, 'ARS', october).rows[0];
  const single = shown(data, budgets);
  assert.equal(JSON.stringify([single[0].state, single[0].currency, single[0].labelsCurrency, single[0].progress.spentMinor]), JSON.stringify(['warning', 'ARS', false, 9000]));
  const consolidated = shown(data, budgets, 'consolidated', 'USD');
  assert.equal(consolidated.length, 1);
  assert.equal(JSON.stringify([consolidated[0].currency, consolidated[0].labelsCurrency]), JSON.stringify(['ARS', true]), 'named: Inicio shows USD');
  assert.equal(consolidated[0].progress.spentMinor, domainRow.spentMinor, 'exactly summarizeMonthlyBudgets\' ARS row');
  assert.equal(consolidated[0].progress.spentMinor, 9000, 'the USD expense neither added nor converted');
  assert.equal(JSON.stringify(consolidated[0].progress), JSON.stringify(domainRow));
  // A USD category budget measured on USD accounts only.
  const usd = shown(data, [sublimit('u', 'Supermercado', 10000000, { currency: 'USD' })], 'consolidated', 'ARS');
  assert.equal(JSON.stringify([usd[0].currency, usd[0].labelsCurrency, usd[0].progress.spentMinor, usd[0].state]), JSON.stringify(['USD', true, 9000000, 'warning']));
});

test('24UX6D refinement: single mode reads only the shown currency; consolidated reads the display currency and every held one, nothing else', () => {
  const data = ledgerOf([['Supermercado', 9000, 'ars'], ['Supermercado', 2000, 'usd']]);
  const arsOver = sublimit('s-ars', 'Supermercado', 1000), usdOver = sublimit('s-usd', 'Supermercado', 1000, { currency: 'USD' });
  assert.equal(rowsOf(shown(data, [arsOver, usdOver], 'single', 'ARS')), 'exceeded:ARS:s-ars', '«Solo ARS»: the USD budget is not considered');
  assert.equal(rowsOf(shown(data, [arsOver], 'single', 'USD')), '', '«Solo USD» with only an ARS budget: nothing');
  assert.equal(shown(data, [arsOver, usdOver], 'single', 'USD').every(item => !item.labelsCurrency), true, 'single mode never names a currency');
  // Consolidated in USD: both, the ARS one named; within «exceeded» the higher ratio comes first, whatever the display currency.
  const both = shown(data, [arsOver, usdOver], 'consolidated', 'USD');
  assert.equal(rowsOf(both), 'exceeded:ARS:s-ars,exceeded:USD:s-usd', 'both exceeded categories: 900 % before 200 %');
  assert.equal(JSON.stringify(both.map(item => item.labelsCurrency)), JSON.stringify([true, false]));
  // A budget in a currency neither held nor shown is never measured.
  assert.deepEqual(shown(data, [sublimit('e', 'Supermercado', 1, { currency: 'EUR' })], 'consolidated', 'ARS'), []);
});
