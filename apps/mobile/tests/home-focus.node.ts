import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { BudgetProgress, CategorySpending, MonthlyBudget, MonthlyBudgetSummary, RecurringRule } from '@finanzapp/domain';
import { COMMITMENT_HORIZON_DAYS, COMMITMENT_ROWS, CONCENTRATION_SHARE, homeCommitments, homeInsight } from '../src/ui/home-focus.ts';

// Producto 24UX6A: what Inicio shows under its number, as pure selections. Synthetic fixtures only.
const at = '2026-09-01T12:00:00.000Z';
const rule = (id: string, nextDateISO: string, extra: Partial<RecurringRule> = {}): RecurringRule => ({
  id, accountId: 'a', kind: 'expense', amountMinor: 1000, merchant: id, category: 'Suscripciones', frequency: 'monthly',
  anchorDateISO: nextDateISO, nextDateISO, active: true, deleted: false, createdAt: at, revision: 0, updatedAt: at, ...extra,
});
const everyAccount = () => true;
const ids = (rules: RecurringRule[]) => rules.map(item => item.id).join(',');

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
});

test('24UX6A: nothing due this week means no commitments section, and paused, deleted, income, overdue and hidden rules never appear', () => {
  const today = '2026-09-28';
  assert.equal(homeCommitments([rule('next-month', '2026-10-20')], today, everyAccount).length, 0, 'no section listing next month');
  assert.equal(homeCommitments(undefined, today, everyAccount).length, 0);
  const excluded = [
    rule('paused', '2026-09-29', { active: false }),
    rule('deleted', '2026-09-29', { active: false, deleted: true }),
    rule('salary', '2026-09-29', { kind: 'income' }),
    rule('overdue', '2026-09-27'),
    rule('usd', '2026-09-29', { accountId: 'u' }),
  ];
  assert.equal(ids(homeCommitments(excluded, today, accountId => accountId === 'a')), '');
  assert.equal(ids(homeCommitments([rule('usd', '2026-09-29', { accountId: 'u' })], today, accountId => accountId === 'u')), 'usd', 'the display decides which accounts count');
});

const budget = (scope: 'total' | 'category', amountMinor: number, category?: string): MonthlyBudget => ({
  id: scope + (category ?? ''), scope, currency: 'ARS', monthISO: '2026-09', amountMinor, active: true, createdAt: at, revision: 0, updatedAt: at,
  ...(category ? { category } : {}),
} as MonthlyBudget);
const progress = (item: MonthlyBudget, spentMinor: number): BudgetProgress => ({
  budget: item, spentMinor, remainingMinor: item.amountMinor - spentMinor, ratio: spentMinor / item.amountMinor, exceeded: spentMinor > item.amountMinor,
});
const summary = (total: BudgetProgress | null, rows: BudgetProgress[]): MonthlyBudgetSummary => ({
  currency: 'ARS', monthISO: '2026-09', total, rows, budgetedMinor: 0, spentBudgetedMinor: 0, remainingMinor: 0, totalSpentMinor: 0, unbudgetedSpentMinor: 0,
} as MonthlyBudgetSummary);
const spent = (key: string, amountMinor: number): CategorySpending => ({ key, category: key, amountMinor, count: 1 });

test('24UX6A: one line at most, the most urgent first: an exceeded budget (the total before a category), then one nearly spent', () => {
  const food = progress(budget('category', 10000, 'Comida'), 12000);
  const fun = progress(budget('category', 10000, 'Ocio'), 19000);
  const total = progress(budget('total', 100000), 101000);
  assert.deepEqual(homeInsight(summary(total, [food, fun]), null, 0, 'ARS'),
    { kind: 'budgetExceeded', scope: 'total', category: null, currency: 'ARS', overMinor: 1000 }, 'the month\'s ceiling before any sublimit');
  assert.deepEqual(homeInsight(summary(progress(budget('total', 100000), 50000), [food, fun]), null, 0, 'ARS'),
    { kind: 'budgetExceeded', scope: 'category', category: 'Ocio', currency: 'ARS', overMinor: 9000 }, 'then the category furthest over');
  const near = progress(budget('category', 10000, 'Comida'), 8600);
  const nearer = progress(budget('category', 10000, 'Ocio'), 9500);
  const low = homeInsight(summary(null, [near, nearer]), [spent('Comida', 9000), spent('Ocio', 1000)], 10000, 'ARS');
  assert.equal(low?.kind === 'budgetLow' && [low.scope, low.category, low.currency].join(), 'category,Ocio,ARS', 'a budget before the concentration line, the tightest first');
  assert.ok(low?.kind === 'budgetLow' && Math.abs(low.leftShare - 0.05) < 1e-9, 'what is left, as a share of the limit');
  // Exactly at the limit is not exceeded: nothing is left, and it says so as a share.
  const full = homeInsight(summary(progress(budget('total', 10000), 10000), []), null, 0, 'ARS');
  assert.equal(full?.kind, 'budgetLow');
  assert.equal(full?.kind === 'budgetLow' && full.leftShare, 0);
  assert.equal(homeInsight(summary(progress(budget('total', 10000), 8400), []), null, 0, 'ARS'), null, 'below 85 % a budget is calm and says nothing');
});

test('24UX6A: without an urgent budget, one category holding 40 % or more of the month is the line; otherwise nothing', () => {
  assert.equal(CONCENTRATION_SHARE, 0.4);
  assert.deepEqual(homeInsight(null, [spent('Ocio', 3000), spent('Comida', 4000), spent('Salud', 3000)], 10000, 'USD'),
    { kind: 'concentration', category: 'Comida', key: 'Comida', currency: 'USD', share: 0.4 });
  assert.equal(homeInsight(null, [spent('Comida', 3900), spent('Ocio', 3100), spent('Salud', 3000)], 10000, 'ARS'), null, 'an even month needs no line');
  assert.equal(homeInsight(null, [spent('Comida', 5000)], 5000, 'ARS'), null, 'a single category is not a concentration');
  assert.equal(homeInsight(null, null, 10000, 'ARS'), null, 'incomplete or converted-without-rate figures give no line');
  assert.equal(homeInsight(null, [], 0, 'ARS'), null, 'a month with no spending gives no line');
  assert.equal(homeInsight(summary(progress(budget('total', 10000), 100), []), [spent('Comida', 9000), spent('Ocio', 1000)], 10000, 'ARS')?.kind, 'concentration',
    'a calm budget leaves the line to the month\'s spending');
});
