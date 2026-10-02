import { describe, expect, it } from 'vitest';
import type { Account, Entry, LedgerSnapshot } from './ledger';
import { categoryKey, expensesInPeriod, isRefundLine, reportPeriod, spendingFacts, spendingReport } from './spending-report';
import { summarizeMonth } from './month-summary';
import { newInstallmentPlan, planCatchUpInserts } from './installments';
import type { CreditCardProfile } from './liabilities';
import { isPurchaseLine, makeOperationChange, newEntryRefund, newPlanPayoff, newPlanRefund } from './operations';
import { applyNewOperation, applyOperationChange, initialRecord, snapshotFromArchive, type LedgerArchive } from './recovery';
import { spendingOverview, spendingWindow } from './spending-overview';
import { dailyAverageMinor, monthlySpendingTrend, spendingInsights, topMerchants } from './report-trend';
import { dailySpending, spendingComparison } from './report-insights';
import { budgetState, summarizeMonthlyBudgets, type CategoryMonthlyBudget } from './budgets';

// Synthetic ledger fixtures only; never seeded into a user's database.
const createdAt = '2026-09-12T12:00:00Z';
const base: LedgerSnapshot = { accounts: [
  { id: 'a', name: 'Cuenta de prueba', currency: 'ARS', openingMinor: 999999, createdAt },
  { id: 'b', name: 'Segunda cuenta de prueba', currency: 'ARS', openingMinor: 0, createdAt },
  { id: 'u', name: 'Dólares de prueba', currency: 'USD', openingMinor: 500, createdAt },
], entries: [] };
const entry = (id: string, patch: Partial<Entry> = {}): Entry => ({ id, accountId: 'a', kind: 'expense', amountMinor: 101,
  merchant: 'Concepto de prueba', category: 'Comida', dateISO: '2026-09-12', createdAt, ...patch });
const report = (entries: Entry[], currency: 'ARS' | 'USD' = 'ARS', month = '2026-09') => spendingReport({ ...base, entries }, currency, month, '2026-09-12');

describe('native spending reports', () => {
  it('starts empty; opening balances do not create categories or cash flow', () => {
    expect(report([])).toMatchObject({ status: 'ready', count: 0, incomeMinor: 0, expenseMinor: 0, categories: [] });
  });
  it('sums integer cents across same-currency accounts, ordered by total', () => {
    const result = report([entry('a', { amountMinor: 101 }), entry('b', { accountId: 'b', amountMinor: 202 }),
      entry('c', { amountMinor: 400, category: 'Transporte' }), entry('d', { kind: 'income', amountMinor: 1500 })]);
    expect(result).toMatchObject({ incomeMinor: 1500, expenseMinor: 703, count: 4,
      categories: [{ key: 'transporte', amountMinor: 400, count: 1 }, { key: 'comida', amountMinor: 303, count: 2 }] });
  });
  it('never includes the other currency or income in expense categories', () => {
    const entries = [entry('a'), entry('u', { accountId: 'u', amountMinor: 250 }), entry('i', { kind: 'income', amountMinor: 900 })];
    expect(report(entries, 'ARS')).toMatchObject({ expenseMinor: 101, categories: [{ amountMinor: 101, count: 1 }] });
    expect(report(entries, 'USD')).toMatchObject({ incomeMinor: 0, expenseMinor: 250, categories: [{ amountMinor: 250, count: 1 }] });
    expect(report([entry('i', { kind: 'income' })])).toMatchObject({ expenseMinor: 0, categories: [] });
  });
  it('groups accents/case/whitespace and uses the most recent spelling without rewriting entries', () => {
    const entries = [entry('old', { category: 'Café', dateISO: '2026-09-01' }),
      entry('new', { category: '  CAFÉ  ' }), entry('space', { category: 'Cafe', dateISO: '2026-09-10' })];
    expect(report(entries).categories).toEqual([{ key: 'cafe', category: 'CAFÉ', amountMinor: 303, count: 3 }]);
    expect(report([...entries].reverse()).categories).toEqual(report(entries).categories);
    expect(entries[1].category).toBe('  CAFÉ  ');
  });
  it('does not confuse different category names just because they share a symbol or substring', () => {
    const entries = [entry('a', { category: 'Comida' }), entry('b', { category: 'Comidas' }), entry('c', { category: 'Comida del gato' })];
    expect(report(entries).categories).toHaveLength(3);
    expect(expensesInPeriod({ ...base, entries }, reportPeriod('ARS', '2026-09', '2026-09-12'), 'comida').map(e => e.id)).toEqual(['a']);
  });
  it('allows arbitrary custom categories, including object prototype names', () => {
    const result = report([entry('a', { category: 'constructor' }), entry('b', { category: '__proto__' }), entry('c', { category: 'toString' })]);
    expect(result.categories).toHaveLength(3);
    expect(result.categories.reduce((sum, c) => sum + c.amountMinor, 0)).toBe(303);
  });
  it('includes both date boundaries, excludes future entries, and uses entry date rather than creation date', () => {
    expect(report([entry('a', { dateISO: '2026-08-31' }), entry('b', { dateISO: '2026-09-01' }),
      entry('c'), entry('d', { dateISO: '2026-09-13' })])).toMatchObject({ count: 2, expenseMinor: 202, categories: [{ count: 2 }] });
  });
  it('historical months include the whole month, not just the same day as today', () => {
    expect(report([entry('a', { dateISO: '2026-08-31' }), entry('b', { dateISO: '2026-08-01' }), entry('c')], 'ARS', '2026-08'))
      .toMatchObject({ startISO: '2026-08-01', endISO: '2026-08-31', expenseMinor: 202 });
  });
  it('handles leap years and year boundaries', () => {
    expect(reportPeriod('ARS', '2024-02', '2026-09-12').endISO).toBe('2024-02-29');
    expect(reportPeriod('ARS', '2025-02', '2026-09-12').endISO).toBe('2025-02-28');
    expect(reportPeriod('ARS', '2025-12', '2026-01-01').endISO).toBe('2025-12-31');
    expect(reportPeriod('ARS', '2026-01', '2026-01-01').endISO).toBe('2026-01-01');
  });
  it.each(['2026-13', '2026-9', '2026-10', '1899-12', 'no-date'])('rejects invalid or future month %s', month => {
    expect(() => reportPeriod('ARS', month, '2026-09-12')).toThrow('Período de reporte inválido');
  });
  it('rejects invalid as-of dates instead of silently shifting a calendar date', () => {
    expect(() => reportPeriod('ARS', '2026-02', '2026-02-30')).toThrow();
  });
  it('every drill-down exactly reconciles with its category and the report total', () => {
    const entries = [entry('a'), entry('b', { category: 'Salud', amountMinor: 303 }), entry('c', { category: 'SALUD', amountMinor: 202 }),
      entry('d', { accountId: 'u' }), entry('e', { kind: 'income' }), entry('f', { dateISO: '2026-10-01' })];
    const snapshot = { ...base, entries };
    const result = report(entries);
    if (result.status !== 'ready') throw new Error('Expected a valid report');
    expect(result.categories.reduce((total, category) => total + category.amountMinor, 0)).toBe(result.expenseMinor);
    for (const category of result.categories) {
      const matching = expensesInPeriod(snapshot, result, category.key);
      expect(matching.length).toBe(category.count);
      expect(matching.reduce((total, e) => total + e.amountMinor, 0)).toBe(category.amountMinor);
      expect(matching.every(e => categoryKey(e.category) === category.key)).toBe(true);
    }
    expect(expensesInPeriod(snapshot, result, 'does-not-exist')).toEqual([]);
  });
  it('handles cent-sized categories alongside large valid amounts', () => {
    expect(report([entry('a', { amountMinor: Number.MAX_SAFE_INTEGER - 1 }), entry('b', { amountMinor: 1, category: 'Otra' })]))
      .toMatchObject({ status: 'ready', expenseMinor: Number.MAX_SAFE_INTEGER, categories: [{ amountMinor: Number.MAX_SAFE_INTEGER - 1 }, { amountMinor: 1 }] });
  });
  it('withholds an unsafe aggregate without showing a partial or rounded chart', () => {
    expect(report([entry('a', { amountMinor: Number.MAX_SAFE_INTEGER }), entry('b')]))
      .toMatchObject({ status: 'out-of-range', categories: [] });
  });
  it('leaves source entries, amounts and ordering unchanged', () => {
    const entries = [entry('b'), entry('a', { category: 'Viajes' })];
    const before = structuredClone({ ...base, entries });
    report(entries);
    expect({ ...base, entries }).toEqual(before);
  });
});

/** Producto 24T3 (A23, A25): devoluciones and adelantos read through the real projection (`snapshotFromArchive`). Synthetic
 * fixtures only. A bank account and a card closing on the 20th. */
describe('24T3: devoluciones and adelantos in the spending report', () => {
  const T0 = '2026-01-01T12:00:00.000Z';
  const at = (date: string) => `${date}T15:00:00.000Z`;
  const bank: Account = { id: 'bank', name: 'Banco', currency: 'ARS', openingMinor: 1000000, createdAt: T0 };
  const cardAccount: Account = { id: 'card-acc', name: 'Visa', currency: 'ARS', openingMinor: 0, createdAt: T0 };
  const card: CreditCardProfile = { id: 'card', accountId: cardAccount.id, issuer: 'Banco', last4: '4009', creditLimitMinor: 1000000, closingDay: 20, dueDay: 5,
    active: true, deleted: false, createdAt: T0, revision: 0, updatedAt: T0 };
  const buy = (id: string, amountMinor: number, dateISO: string, category: string, merchant: string): Entry =>
    ({ id, accountId: bank.id, kind: 'expense', amountMinor, merchant, category, dateISO, createdAt: at(dateISO) });
  const salary: Entry = { ...buy('salary', 200000, '2026-09-01', 'Sueldo', 'Empresa'), kind: 'income' };
  const archiveOf = (...entries: Entry[]): LedgerArchive =>
    ({ accounts: [bank, cardAccount], records: entries.map(initialRecord), cards: [card], debts: [], installmentPlans: [] });
  const refund = (archive: LedgerArchive, id: string, entryId: string, amountMinor: number, dateISO: string) =>
    applyNewOperation(archive, newEntryRefund(archive, { id, entryId, amountMinor, dateISO, todayISO: dateISO, createdAt: at(dateISO) }), dateISO);
  const september = (archive: LedgerArchive) => spendingReport(snapshotFromArchive(archive), 'ARS', '2026-09', '2026-10-31');
  const october = (archive: LedgerArchive) => spendingReport(snapshotFromArchive(archive), 'ARS', '2026-10', '2026-10-31');
  const purchases = archiveOf(salary, buy('shoes', 30000, '2026-09-05', 'Ropa', 'Zapatería'), buy('food', 10000, '2026-09-06', 'Comida', 'Súper'),
    buy('lunch', 5000, '2026-10-02', 'Comida', 'Súper'));

  it('a devolución in the purchase’s month nets that month and category; it is not a purchase and never an income', () => {
    const refunded = refund(purchases, 'r-1', 'shoes', 12000, '2026-09-10');
    const line = snapshotFromArchive(refunded).entries.find(entry => entry.id === 'r-1')!;
    expect([isRefundLine(line), isPurchaseLine(line), line.amountMinor, line.category]).toEqual([true, false, -12000, 'Ropa']);
    // 30.000 + 10.000 − 12.000 = 28.000; count = the income and the two purchases (the devolución is not a movement count).
    expect(september(refunded)).toMatchObject({ status: 'ready', expenseMinor: 28000, incomeMinor: 200000, count: 3, categories: [
      { key: 'ropa', amountMinor: 18000, count: 1 }, { key: 'comida', amountMinor: 10000, count: 1 }] });
    expect(september(purchases)).toMatchObject({ expenseMinor: 40000, incomeMinor: 200000, count: 3 });
    // The drill-down lists the devolución too, so its rows add up to the category; its count is purchase lines.
    const ropa = expensesInPeriod(snapshotFromArchive(refunded), reportPeriod('ARS', '2026-09', '2026-10-31'), 'ropa');
    expect([ropa.map(entry => entry.id), ropa.reduce((sum, entry) => sum + entry.amountMinor, 0), ropa.filter(isPurchaseLine).length]).toEqual([['shoes', 'r-1'], 18000, 1]);
  });

  it('a devolución in a later month nets that later month and may leave its category (and the month) below zero', () => {
    const refunded = refund(purchases, 'r-2', 'shoes', 30000, '2026-10-03');
    // September keeps the purchase whole: the devolución lives in its own month.
    expect(september(refunded)).toMatchObject({ expenseMinor: 40000, count: 3, categories: [{ key: 'ropa', amountMinor: 30000, count: 1 }, { key: 'comida', amountMinor: 10000 }] });
    // October: 5.000 − 30.000 = −25.000. Ropa is listed at −30.000 with no purchase line, after the positive category.
    expect(october(refunded)).toMatchObject({ status: 'ready', expenseMinor: -25000, incomeMinor: 0, count: 1, categories: [
      { key: 'comida', amountMinor: 5000, count: 1 }, { key: 'ropa', category: 'Ropa', amountMinor: -30000, count: 0 }] });
    const result = october(refunded);
    expect(result.categories.reduce((sum, category) => sum + category.amountMinor, 0)).toBe(result.status === 'ready' ? result.expenseMinor : null);
    expect(summarizeMonth(snapshotFromArchive(refunded), 'ARS', '2026-10-31')).toMatchObject({ expenseMinor: -25000, incomeMinor: 0, count: 1 });
  });

  it('an adelanto puts the remaining instalments in its own month, once: one purchase line, financing lines are not purchases', () => {
    const plan = newInstallmentPlan({ id: 'tv', card, cardAccount, merchant: 'Electro', category: 'Hogar', purchaseDateISO: '2026-07-10',
      principalMinor: 120000, count: 12, placement: 'current', interestMinor: 1200, interestCategory: 'Intereses', createdAt: at('2026-07-10') });
    let archive: LedgerArchive = { ...archiveOf(), installmentPlans: [plan] };
    archive = { ...archive, records: [...archive.records, ...planCatchUpInserts(archive, 'tv', '2026-09-25')] };
    // July, August and September closings are recorded: 3 × (10.000 principal + 100 interest).
    expect(september(archive)).toMatchObject({ expenseMinor: 10100, count: 2 });
    const payoff = newPlanPayoff(archive, { id: 'p-1', planId: 'tv', financing: 'recognised', dateISO: '2026-09-25', todayISO: '2026-09-25', createdAt: at('2026-09-25') });
    const brought = applyNewOperation(archive, payoff, '2026-09-25');
    const lines = snapshotFromArchive(brought).entries.filter(entry => entry.payoff);
    expect(lines.map(entry => [entry.id, entry.amountMinor, entry.category, isPurchaseLine(entry)])).toEqual([
      ['p-1_p', 90000, 'Hogar', true], ['p-1_i', 900, 'Intereses', false]]);
    // September: the share closing on the 20th (10.100) plus the lump (90.000 + 900). Counts: the share's two records and
    // the adelanto once.
    expect(september(brought)).toMatchObject({ expenseMinor: 101000, count: 3, categories: [
      { key: 'hogar', amountMinor: 100000, count: 2 }, { key: 'intereses', amountMinor: 1000, count: 1 }] });
    // Nothing is left to recognise in October: the lump is never counted twice.
    expect(october({ ...brought, records: [...brought.records, ...planCatchUpInserts(brought, 'tv', '2026-10-31')] })).toMatchObject({ expenseMinor: 0, count: 0 });
  });

  it('spendingFacts: gross purchases, devoluciones and incomes as non-negative facts that reconcile with the net', () => {
    const refunded = refund(refund(purchases, 'r-3', 'shoes', 12000, '2026-09-10'), 'r-4', 'food', 10000, '2026-10-03');
    const facts = (month: string) => spendingFacts(snapshotFromArchive(refunded), reportPeriod('ARS', month, '2026-10-31'));
    expect(facts('2026-09')).toEqual({ currency: 'ARS', startISO: '2026-09-01', endISO: '2026-09-30', status: 'ready',
      grossPurchasesMinor: 40000, purchaseCount: 2, refundsMinor: 12000, refundCount: 1, incomeMinor: 200000, incomeCount: 1,
      categories: [{ key: 'ropa', category: 'Ropa', amountMinor: 30000, count: 1 }, { key: 'comida', category: 'Comida', amountMinor: 10000, count: 1 }] });
    // October: the food devolución outweighs October's lunch in Comida (net −5.000); the facts stay gross and positive.
    expect(facts('2026-10')).toMatchObject({ grossPurchasesMinor: 5000, purchaseCount: 1, refundsMinor: 10000, refundCount: 1, incomeMinor: 0, incomeCount: 0,
      categories: [{ key: 'comida', amountMinor: 5000, count: 1 }] });
    for (const month of ['2026-09', '2026-10']) {
      const result = facts(month), report = spendingReport(snapshotFromArchive(refunded), 'ARS', month, '2026-10-31');
      if (result.status !== 'ready' || report.status !== 'ready') throw new Error('Expected ready figures');
      expect(result.grossPurchasesMinor - result.refundsMinor).toBe(report.expenseMinor);
      expect(result.purchaseCount + result.incomeCount).toBe(report.count);
      const numbers = [result.grossPurchasesMinor, result.purchaseCount, result.refundsMinor, result.refundCount, result.incomeMinor, result.incomeCount,
        ...result.categories.flatMap(category => [category.amountMinor, category.count])];
      expect(numbers.every(value => Number.isSafeInteger(value) && value >= 0)).toBe(true);
      expect(result.categories.every(category => category.amountMinor > 0)).toBe(true);
    }
    // The Assistant's income count, derived today as report.count − Σ category counts, is unchanged by a devolución.
    for (const archive of [purchases, refunded]) {
      const report = september(archive);
      if (report.status !== 'ready') throw new Error('Expected ready figures');
      expect(report.count - report.categories.reduce((sum, category) => sum + category.count, 0)).toBe(1);
    }
  });

  it('spendingFacts: an adelanto counts once, its financing is gross spending; an empty period and an unsafe one', () => {
    const lines: Entry[] = [entry('pay_p', { amountMinor: 90000, category: 'Hogar', payoff: { operationId: 'pay', planId: 'tv', component: 'principal' } }),
      entry('pay_i', { amountMinor: 900, category: 'Intereses', payoff: { operationId: 'pay', planId: 'tv', component: 'interest' } })];
    expect(spendingFacts({ ...base, entries: lines }, reportPeriod('ARS', '2026-09', '2026-09-12'))).toMatchObject({
      grossPurchasesMinor: 90900, purchaseCount: 1, refundsMinor: 0, refundCount: 0,
      categories: [{ key: 'hogar', amountMinor: 90000, count: 1 }, { key: 'intereses', amountMinor: 900, count: 0 }] });
    expect(spendingFacts(base, reportPeriod('ARS', '2026-09', '2026-09-12'))).toMatchObject({ status: 'ready', grossPurchasesMinor: 0, purchaseCount: 0, categories: [] });
    expect(spendingFacts({ ...base, entries: [entry('a', { amountMinor: Number.MAX_SAFE_INTEGER }), entry('b')] }, reportPeriod('ARS', '2026-09', '2026-09-12')))
      .toEqual({ currency: 'ARS', startISO: '2026-09-01', endISO: '2026-09-12', status: 'out-of-range' });
    expect(() => spendingFacts(base, { currency: 'ARS', startISO: '2026-09-12', endISO: '2026-09-01' })).toThrow('Período inválido.');
  });

  it('signed lines: the overflow guard bounds every category by Σ|line|, so a category never overflows behind a safe net', () => {
    // Net = 1, but each category alone would leave the safe range: withheld, never a rounded category.
    const lines = [entry('big', { amountMinor: Number.MAX_SAFE_INTEGER, category: 'A' }), entry('big2', { amountMinor: 1, category: 'A' }),
      entry('back', { amountMinor: -Number.MAX_SAFE_INTEGER, category: 'B', refund: { operationId: 'back', targetEntryId: 'big' } })];
    expect(report(lines)).toMatchObject({ status: 'out-of-range', categories: [] });
    expect(summarizeMonth({ ...base, entries: lines }, 'ARS', '2026-09-12').status).toBe('out-of-range');
  });
});

/** 24T3 independent verification: every reader at once, through the real projection. Synthetic fixtures only. */
describe('24T3 verifier: every reader agrees on devoluciones and adelantos', () => {
  const T0 = '2026-01-01T12:00:00.000Z';
  const at = (date: string) => `${date}T15:00:00.000Z`;
  const bank: Account = { id: 'bank', name: 'Banco', currency: 'ARS', openingMinor: 1000000, createdAt: T0 };
  const cardAccount: Account = { id: 'card-acc', name: 'Visa', currency: 'ARS', openingMinor: 0, createdAt: T0 };
  const card: CreditCardProfile = { id: 'card', accountId: cardAccount.id, issuer: 'Banco', last4: '4009', creditLimitMinor: 1000000, closingDay: 20, dueDay: 5,
    active: true, deleted: false, createdAt: T0, revision: 0, updatedAt: T0 };
  const buy = (id: string, amountMinor: number, dateISO: string, category: string, merchant: string): Entry =>
    ({ id, accountId: bank.id, kind: 'expense', amountMinor, merchant, category, dateISO, createdAt: at(dateISO) });
  const archiveOf = (...entries: Entry[]): LedgerArchive =>
    ({ accounts: [bank, cardAccount], records: entries.map(initialRecord), cards: [card], debts: [], installmentPlans: [] });
  const refund = (archive: LedgerArchive, id: string, entryId: string, amountMinor: number, dateISO: string) =>
    applyNewOperation(archive, newEntryRefund(archive, { id, entryId, amountMinor, dateISO, todayISO: dateISO, createdAt: at(dateISO) }), dateISO);
  const october = { currency: 'ARS' as const, startISO: '2026-10-01', endISO: '2026-10-31' };
  const format = (minor: number) => `$ ${(minor / 100).toFixed(2)}`;
  const ropaBudget: CategoryMonthlyBudget = { id: 'ropa-oct', scope: 'category', category: 'Ropa', currency: 'ARS', monthISO: '2026-10', amountMinor: 10000,
    active: true, createdAt: T0, revision: 0, updatedAt: T0 };

  it('a month whose only line is a devolución: a negative net everywhere, nothing counted, nothing ranked or claimed', () => {
    const archive = refund(archiveOf(buy('shoes', 30000, '2026-09-05', 'Ropa', 'Zapatería')), 'r-1', 'shoes', 30000, '2026-10-03');
    const snap = snapshotFromArchive(archive);
    expect(spendingReport(snap, 'ARS', '2026-10', '2026-10-31')).toMatchObject({ status: 'ready', expenseMinor: -30000, incomeMinor: 0, count: 0,
      categories: [{ key: 'ropa', category: 'Ropa', amountMinor: -30000, count: 0 }] });
    expect(summarizeMonth(snap, 'ARS', '2026-10-31')).toMatchObject({ expenseMinor: -30000, count: 0 });
    expect(spendingOverview(snap, spendingWindow('ARS', 'month', '2026-10-31'))).toMatchObject({ status: 'ready', expenseMinor: -30000, expenseCount: 0,
      categories: [{ key: 'ropa', amountMinor: -30000, count: 0 }] });
    expect(monthlySpendingTrend(snap, 'ARS', '2026-10', '2026-10-31', 2).map(point => [point.monthISO, point.amountMinor, point.count]))
      .toEqual([['2026-09', 30000, 1], ['2026-10', -30000, 0]]);
    expect(topMerchants(snap, october)).toEqual([]);
    expect(dailySpending(snap, october)).toEqual([{ dateISO: '2026-10-03', amountMinor: -30000, count: 0 }]);
    expect(dailyAverageMinor(-30000, october)).toBe(0);
    // No «mayor gasto» (no purchase line) and no growth claim (October has no purchase: insufficient).
    expect(spendingComparison(snap, 'ARS', '2026-10', '2026-10-31').status).toBe('insufficient');
    expect(spendingInsights(snap, [], 'ARS', '2026-10', '2026-10-31', format)).toEqual([]);
    // Assistant facts stay non-negative: no category, the devolución as its own fact.
    expect(spendingFacts(snap, october)).toMatchObject({ status: 'ready', grossPurchasesMinor: 0, purchaseCount: 0, refundsMinor: 30000, refundCount: 1,
      incomeMinor: 0, incomeCount: 0, categories: [] });
    // Budgets: spent −30.000 of 10.000, calm, no negative share; nothing unbudgeted.
    const budgets = summarizeMonthlyBudgets(snap, [ropaBudget], 'ARS', '2026-10');
    expect(budgets.rows[0]).toMatchObject({ spentMinor: -30000, remainingMinor: 40000, ratio: 0, exceeded: false });
    expect(budgetState(budgets.rows[0])).toBe('calm');
    expect([budgets.totalSpentMinor, budgets.unbudgetedSpentMinor]).toEqual([-30000, 0]);
  });

  it('two partial devoluciones of one purchase across months; «mayor gasto» nets only those up to the period’s end', () => {
    let archive = archiveOf(buy('shoes', 30000, '2026-09-05', 'Ropa', 'Zapatería'), buy('food', 15000, '2026-09-06', 'Comida', 'Súper'),
      buy('lunch', 5000, '2026-10-02', 'Comida', 'Súper'));
    archive = refund(refund(archive, 'r-a', 'shoes', 10000, '2026-09-10'), 'r-b', 'shoes', 20000, '2026-10-03');
    const snap = snapshotFromArchive(archive);
    const largest = (month: string) => spendingInsights(snap, [], 'ARS', month, '2026-10-31', format).find(item => item.id.startsWith('largest:'));
    // September: 30.000 − 10.000 (the October devolución is not yet) = 20.000 > 15.000.
    expect(largest('2026-09')).toMatchObject({ id: 'largest:shoes', amountMinor: 20000, detail: '$ 200.00 · Ropa · 5/09' });
    // October: the shoes are not October's purchase; the lunch is the only one.
    expect(largest('2026-10')).toMatchObject({ id: 'largest:lunch', amountMinor: 5000 });
    // A full refund inside September (both devoluciones in September) hands «mayor gasto» to the food.
    const inSeptember = snapshotFromArchive(refund(refund(archiveOf(buy('shoes', 30000, '2026-09-05', 'Ropa', 'Zapatería'),
      buy('food', 15000, '2026-09-06', 'Comida', 'Súper')), 'r-c', 'shoes', 10000, '2026-09-10'), 'r-d', 'shoes', 20000, '2026-09-11'));
    expect(spendingInsights(inSeptember, [], 'ARS', '2026-09', '2026-09-30', format).find(item => item.id.startsWith('largest:')))
      .toMatchObject({ id: 'largest:food', amountMinor: 15000 });
    expect(spendingReport(inSeptember, 'ARS', '2026-09', '2026-09-30')).toMatchObject({ expenseMinor: 15000, count: 2,
      categories: [{ key: 'comida', amountMinor: 15000, count: 1 }, { key: 'ropa', amountMinor: 0, count: 1 }] });
    expect(topMerchants(inSeptember, { currency: 'ARS', startISO: '2026-09-01', endISO: '2026-09-30' }).map(item => item.merchant)).toEqual(['Súper']);
  });

  it('a plan devolución (credit line) and an adelanto: counts agree across every reader, the credit is never a purchase', () => {
    const plan = newInstallmentPlan({ id: 'tv', card, cardAccount, merchant: 'Electro', category: 'Hogar', purchaseDateISO: '2026-07-10',
      principalMinor: 120000, count: 12, placement: 'current', interestMinor: 1200, interestCategory: 'Intereses', createdAt: at('2026-07-10') });
    let archive: LedgerArchive = { ...archiveOf(buy('food', 7000, '2026-09-03', 'Comida', 'Súper'), { ...buy('pay', 50000, '2026-09-01', 'Sueldo', 'Empresa'), kind: 'income' }),
      installmentPlans: [plan] };
    archive = { ...archive, records: [...archive.records, ...planCatchUpInserts(archive, 'tv', '2026-09-25')] };
    // 15.000 back: recognised principal first (3 × 10.000 recognised), so all of it is a credit line now (B2).
    const planRefund = newPlanRefund(archive, { id: 'pr-1', planId: 'tv', amountMinor: 15000, dateISO: '2026-09-25', todayISO: '2026-09-25', createdAt: at('2026-09-25') });
    archive = applyNewOperation(archive, planRefund, '2026-09-25');
    archive = applyNewOperation(archive, newPlanPayoff(archive, { id: 'po-1', planId: 'tv', financing: 'recognised', dateISO: '2026-09-26', todayISO: '2026-09-26',
      createdAt: at('2026-09-26') }), '2026-09-26');
    const snap = snapshotFromArchive(archive);
    const credit = snap.entries.find(entry => entry.id === 'pr-1')!;
    expect([isRefundLine(credit), isPurchaseLine(credit), credit.amountMinor, credit.category, credit.refund?.targetPlanId]).toEqual([true, false, -15000, 'Hogar', 'tv']);
    const period = { currency: 'ARS' as const, startISO: '2026-09-01', endISO: '2026-09-30' };
    const report = spendingReport(snap, 'ARS', '2026-09', '2026-09-30');
    if (report.status !== 'ready') throw new Error('Expected a ready report');
    // Purchase lines in September: the food, the 20th share's principal, its interest record, the adelanto's principal line.
    const purchases = snap.entries.filter(entry => entry.kind === 'expense' && entry.dateISO.startsWith('2026-09') && isPurchaseLine(entry)).length;
    expect(purchases).toBe(4);
    const overview = spendingOverview(snap, period);
    const facts = spendingFacts(snap, period);
    if (overview.status !== 'ready' || facts.status !== 'ready') throw new Error('Expected ready figures');
    expect([report.count - 1, report.categories.reduce((sum, c) => sum + c.count, 0), overview.expenseCount,
      monthlySpendingTrend(snap, 'ARS', '2026-09', '2026-09-30', 1)[0].count, dailySpending(snap, period).reduce((sum, day) => sum + day.count, 0),
      facts.purchaseCount]).toEqual([purchases, purchases, purchases, purchases, purchases, purchases]);
    // Nets agree too, and the facts reconcile with them without a negative number.
    expect([overview.expenseMinor, facts.grossPurchasesMinor - facts.refundsMinor]).toEqual([report.expenseMinor, report.expenseMinor]);
    expect([facts.refundsMinor, facts.refundCount, facts.incomeCount]).toEqual([15000, 1, 1]);
    // «Mayor gasto» is a purchase line (the adelanto's principal lump), never the credit line.
    const largest = spendingInsights(snap, [], 'ARS', '2026-09', '2026-09-30', format).find(item => item.id.startsWith('largest:'));
    expect(largest?.id).toBe('largest:po-1_p');
  });

  it('undoing a devolución gives every reader back the purchase; restoring it nets again', () => {
    const before = archiveOf(buy('shoes', 30000, '2026-09-05', 'Ropa', 'Zapatería'));
    const refunded = refund(before, 'r-1', 'shoes', 30000, '2026-10-03');
    const op = refunded.purchaseOperations![0];
    const undone = applyOperationChange(refunded, makeOperationChange('c-1', op, 'void', at('2026-10-04')), '2026-10-04').archive;
    const undoneSnap = snapshotFromArchive(undone);
    expect(undoneSnap.entries.some(entry => entry.refund)).toBe(false);
    expect(spendingReport(undoneSnap, 'ARS', '2026-10', '2026-10-31')).toMatchObject({ expenseMinor: 0, count: 0, categories: [] });
    expect(spendingFacts(undoneSnap, october)).toMatchObject({ refundsMinor: 0, refundCount: 0 });
    const voided = undone.purchaseOperations![0];
    const restored = applyOperationChange(undone, makeOperationChange('c-2', voided, 'restore', at('2026-10-05')), '2026-10-05').archive;
    expect(spendingReport(snapshotFromArchive(restored), 'ARS', '2026-10', '2026-10-31')).toMatchObject({ expenseMinor: -30000, count: 0 });
  });
});
