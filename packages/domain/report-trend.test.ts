import { describe, expect, it } from 'vitest';
import { dailyAverageMinor, monthlySpendingTrend, spendingInsights, topMerchants } from './report-trend';
import type { Entry, LedgerSnapshot } from './ledger';
import type { MonthlyBudget } from './budgets';
import { spendingReport } from './spending-report';

const createdAt = '2026-09-12T12:00:00Z';
const entry = (id: string, dateISO: string, amountMinor: number, merchant = 'Carrefour', category = 'Supermercado', accountId = 'a'): Entry =>
  ({ id, dateISO, amountMinor, merchant, category, accountId, kind: 'expense', createdAt });
const snapshot: LedgerSnapshot = { accounts: [
  { id: 'a', currency: 'ARS', name: 'Banco', openingMinor: 0, createdAt },
  { id: 'u', currency: 'USD', name: 'USD', openingMinor: 0, createdAt },
], entries: [
  entry('1', '2026-09-02', 10000), entry('2', '2026-09-10', 5000, '  carrefour ', 'SUPERMERCADO'), entry('3', '2026-09-12', 23100, 'Starbucks', 'Café'),
  entry('4', '2026-08-05', 8000), entry('5', '2026-08-30', 2000, 'Farmacia', 'Salud'), entry('6', '2026-04-01', 100),
  entry('7', '2026-09-11', 999, 'USD shop', 'Otros', 'u'),
  { ...entry('8', '2026-09-12', 70000), kind: 'income', merchant: 'Sueldo', category: 'Sueldo' },
  entry('9', '2026-09-30', 4000), // Later in the month: excluded from through-today reports, counted by whole-month budgets.
] };
const format = (minor: number) => '$ ' + (minor / 100).toFixed(2);

describe('report trend, merchants and insights', () => {
  it('builds a six-month trend with complete past months and a partial current month', () => {
    const trend = monthlySpendingTrend(snapshot, 'ARS', '2026-09', '2026-09-12');
    expect(trend.map(point => point.monthISO)).toEqual(['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09']);
    expect(trend.map(point => point.amountMinor)).toEqual([100, 0, 0, 0, 10000, 38100]);
    expect(trend.at(-1)).toMatchObject({ partial: true, count: 3 });
    expect(trend[4].partial).toBe(false);
    expect(monthlySpendingTrend(snapshot, 'ARS', '2026-08', '2026-09-12', 2).map(point => point.amountMinor)).toEqual([0, 10000]);
    expect(() => monthlySpendingTrend(snapshot, 'ARS', '2026-09', '2026-09-12', 0)).toThrow();
  });
  it('ranks merchants by normalized identity without rewriting their text', () => {
    const period = { currency: 'ARS' as const, startISO: '2026-09-01', endISO: '2026-09-12' };
    const merchants = topMerchants(snapshot, period, 5);
    expect(merchants.map(item => [item.merchant, item.amountMinor, item.count, item.category])).toEqual([
      ['Starbucks', 23100, 1, 'Café'], ['Carrefour', 15000, 2, 'Supermercado']]);
    expect(topMerchants(snapshot, period, 1)).toHaveLength(1);
    expect(snapshot.entries[1].merchant).toBe('  carrefour ');
  });
  it('averages per elapsed day with whole cents', () => {
    expect(dailyAverageMinor(38100, { currency: 'ARS', startISO: '2026-09-01', endISO: '2026-09-12' })).toBe(3175);
    expect(dailyAverageMinor(0, { currency: 'ARS', startISO: '2026-09-01', endISO: '2026-09-01' })).toBe(0);
    // Deliberate golden change (24T3, A24): a negative net (devoluciones that outweigh the period's purchases) used to
    // throw; it now has no spending to average and gives 0. A non-integer amount still throws.
    expect(dailyAverageMinor(-1, { currency: 'ARS', startISO: '2026-09-01', endISO: '2026-09-12' })).toBe(0);
    expect(dailyAverageMinor(-50000, { currency: 'ARS', startISO: '2026-09-01', endISO: '2026-09-12' })).toBe(0);
    expect(() => dailyAverageMinor(0.5, { currency: 'ARS', startISO: '2026-09-01', endISO: '2026-09-12' })).toThrow('Monto inválido.');
  });
  it('states facts only: over/near budget, the largest expense and the category that grew', () => {
    const budgets: MonthlyBudget[] = [
      { id: 'b1', scope: 'category', category: 'Supermercado', currency: 'ARS', monthISO: '2026-09', amountMinor: 12000, active: true, createdAt, revision: 0, updatedAt: createdAt },
      { id: 'b2', scope: 'category', category: 'Café', currency: 'ARS', monthISO: '2026-09', amountMinor: 25000, active: true, createdAt, revision: 0, updatedAt: createdAt },
    ];
    const insights = spendingInsights(snapshot, budgets, 'ARS', '2026-09', '2026-09-12', format);
    expect(insights.map(item => item.id)).toEqual(['over:b1', 'near:b2', 'largest:3', 'growth:cafe']);
    expect(insights[0]).toMatchObject({ tone: 'expense', detail: '$ 70.00 por encima de $ 120.00' });
    expect(insights[1]).toMatchObject({ tone: 'warning', detail: 'Quedan $ 19.00 de $ 250.00' });
    expect(insights[2].title).toBe('Tu mayor gasto fue Starbucks');
    expect(insights[3].detail).toBe('Frente a los mismos días del mes anterior');
    expect(spendingInsights({ accounts: snapshot.accounts, entries: [] }, [], 'ARS', '2026-09', '2026-09-12', format)).toEqual([]);
    // A total budget speaks first and without a category; September ARS spending is 42.100 over the whole month.
    const total: MonthlyBudget = { id: 't', scope: 'total', currency: 'ARS', monthISO: '2026-09', amountMinor: 40000, active: true, createdAt, revision: 0, updatedAt: createdAt };
    const withTotal = spendingInsights(snapshot, [total, ...budgets], 'ARS', '2026-09', '2026-09-12', format);
    expect(withTotal.map(item => item.id)).toEqual(['over:t', 'over:b1', 'near:b2', 'largest:3'], 'four facts at most; the total comes first');
    expect(withTotal[0]).toMatchObject({ tone: 'expense', title: 'Superaste tu presupuesto general', detail: '$ 21.00 por encima de $ 400.00' });
    expect(withTotal[0].category).toBeUndefined();
    const near = spendingInsights(snapshot, [{ ...total, amountMinor: 45000 }], 'ARS', '2026-09', '2026-09-12', format);
    expect(near[0]).toMatchObject({ id: 'near:t', tone: 'warning', title: 'Estás cerca de tu presupuesto general', detail: 'Quedan $ 29.00 de $ 450.00' });
    expect(spendingInsights(snapshot, [{ ...total, amountMinor: 100000 }], 'ARS', '2026-09', '2026-09-12', format).some(item => item.id.endsWith(':t'))).toBe(false);
  });
});

describe('24T3: devoluciones and adelantos in trend, merchants and insights (A23, A24)', () => {
  const refund = (id: string, target: string, dateISO: string, amountMinor: number, merchant: string, category: string): Entry =>
    ({ ...entry(id, dateISO, -amountMinor, merchant, category), refund: { operationId: id, targetEntryId: target } });
  const ledger = (...entries: Entry[]): LedgerSnapshot => ({ accounts: snapshot.accounts, entries });
  const september = { currency: 'ARS' as const, startISO: '2026-09-01', endISO: '2026-09-30' };

  it('the trend nets a devolución in its own month (which may go below zero) and counts purchase lines only', () => {
    const data = ledger(entry('tv', '2026-08-10', 50000, 'Electro', 'Hogar'), entry('food', '2026-09-03', 8000),
      refund('r', 'tv', '2026-09-15', 50000, 'Electro', 'Hogar'),
      { ...entry('p_p', '2026-07-20', 30000, 'Electro', 'Hogar'), payoff: { operationId: 'p', planId: 'x', component: 'principal' } },
      { ...entry('p_t', '2026-07-20', 300, 'Electro', 'Impuestos'), payoff: { operationId: 'p', planId: 'x', component: 'tax' } });
    expect(monthlySpendingTrend(data, 'ARS', '2026-09', '2026-09-30', 3).map(point => [point.monthISO, point.amountMinor, point.count]))
      .toEqual([['2026-07', 30300, 1], ['2026-08', 50000, 1], ['2026-09', -42000, 1]]);
  });

  it('merchants net their devoluciones, then a net ≤ 0 is dropped before the limit; counts are purchases', () => {
    const data = ledger(entry('a', '2026-09-02', 10000, 'Carrefour'), entry('b', '2026-09-05', 6000, 'Carrefour', 'Hogar'),
      refund('ra', 'a', '2026-09-08', 7000, 'Carrefour', 'Supermercado'),
      entry('c', '2026-09-03', 4000, 'Starbucks', 'Café'), refund('rc', 'c', '2026-09-04', 4000, 'Starbucks', 'Café'),
      entry('d', '2026-08-28', 20000, 'Zara', 'Ropa'), refund('rd', 'd', '2026-09-06', 20000, 'Zara', 'Ropa'),
      entry('e', '2026-09-09', 1000, 'Kiosco', 'Otros'));
    // Carrefour: 10.000 + 6.000 − 7.000 = 9.000 (2 purchases), its dominant net category is Hogar (6.000 > 3.000).
    // Starbucks nets 0 and Zara −20.000: neither is ranked, even with room in the limit.
    expect(topMerchants(data, september, 5).map(item => [item.merchant, item.amountMinor, item.count, item.category]))
      .toEqual([['Carrefour', 9000, 2, 'Hogar'], ['Kiosco', 1000, 1, 'Otros']]);
    expect(topMerchants(data, september, 1).map(item => item.merchant)).toEqual(['Carrefour']);
  });

  it('«Tu mayor gasto» is the purchase line with the largest amount net of its devoluciones; never a devolución, never ≤ 0', () => {
    const data = ledger(entry('tv', '2026-09-02', 90000, 'Electro', 'Hogar'), refund('r1', 'tv', '2026-09-05', 60000, 'Electro', 'Hogar'),
      entry('shoes', '2026-09-03', 40000, 'Zapatería', 'Ropa'), entry('food', '2026-09-04', 35000));
    const largest = (s: LedgerSnapshot, asOf = '2026-09-30') =>
      spendingInsights(s, [], 'ARS', '2026-09', asOf, format).find(item => item.id.startsWith('largest:'));
    // The TV nets 30.000 after its devolución; the shoes (40.000) are the largest.
    expect(largest(data)).toMatchObject({ id: 'largest:shoes', title: 'Tu mayor gasto fue Zapatería', detail: '$ 400.00 · Ropa · 3/09' });
    // Before the devolución (the period ends on the 4th) the TV is still 90.000.
    expect(largest(data, '2026-09-04')).toMatchObject({ id: 'largest:tv', detail: '$ 900.00 · Hogar · 2/09' });
    // A partial devolución: its net is the amount named.
    const partial = ledger(entry('tv', '2026-09-02', 90000, 'Electro', 'Hogar'), refund('r2', 'tv', '2026-09-05', 10000, 'Electro', 'Hogar'), entry('food', '2026-09-04', 35000));
    expect(largest(partial)).toMatchObject({ id: 'largest:tv', amountMinor: 80000, detail: '$ 800.00 · Hogar · 2/09' });
    // Only devoluciones (of an August purchase) or only fully refunded purchases: no «mayor gasto» at all.
    const onlyRefund = ledger(entry('aug', '2026-08-20', 50000), refund('r3', 'aug', '2026-09-02', 50000, 'Carrefour', 'Supermercado'));
    expect(largest(onlyRefund)).toBeUndefined();
    const fullyRefunded = ledger(entry('tv', '2026-09-02', 90000, 'Electro', 'Hogar'), refund('r4', 'tv', '2026-09-05', 90000, 'Electro', 'Hogar'));
    expect(largest(fullyRefunded)).toBeUndefined();
    // An adelanto competes through its principal line; its financing line is never named.
    const payoff = ledger(entry('food', '2026-09-04', 35000),
      { ...entry('p_i', '2026-09-20', 50000, 'Electro', 'Intereses'), payoff: { operationId: 'p', planId: 'x', component: 'interest' } },
      { ...entry('p_p', '2026-09-20', 40000, 'Electro', 'Hogar'), payoff: { operationId: 'p', planId: 'x', component: 'principal' } });
    expect(largest(payoff)?.id).toBe('largest:p_p');
  });

  it('«Tu mayor gasto» nets a plan devolución against the plan\'s principal lines (PR #76 Codex review)', () => {
    const largest = (s: LedgerSnapshot, monthISO = '2026-09', asOf = '2026-09-30') =>
      spendingInsights(s, [], 'ARS', monthISO, asOf, format).find(item => item.id.startsWith('largest:'));
    // A plan devolución line credits the plan (`targetPlanId`), never one instalment.
    const planRefund = (id: string, planId: string, dateISO: string, amountMinor: number): Entry =>
      ({ ...entry(id, dateISO, -amountMinor, 'Electro', 'Hogar'), refund: { operationId: id, targetPlanId: planId } });
    const instalment = (planId: string, n: number, dateISO: string, amountMinor: number): Entry =>
      entry(`inst_${planId}_${String(n).padStart(3, '0')}`, dateISO, amountMinor, 'Electro', 'Hogar');
    // Codex's case: a $ 900 instalment whose plan was refunded in full, and an unrelated $ 400 purchase.
    const refunded = ledger(instalment('tv', 1, '2026-09-20', 90000), planRefund('pr', 'tv', '2026-09-22', 90000), entry('shoes', '2026-09-03', 40000, 'Zapatería', 'Ropa'));
    expect(largest(refunded)).toMatchObject({ id: 'largest:shoes', amountMinor: 40000 });
    // Before the devolución is dated (the period ends on the 21st) the instalment is still the largest, at its gross.
    expect(largest(refunded, '2026-09', '2026-09-21')).toMatchObject({ id: 'largest:inst_tv_001', amountMinor: 90000 });
    // A partial plan devolución: the instalment counts what is left of the plan.
    const partial = ledger(instalment('tv', 1, '2026-09-20', 90000), planRefund('pr', 'tv', '2026-09-22', 30000), entry('shoes', '2026-09-03', 40000, 'Zapatería', 'Ropa'));
    expect(largest(partial)).toMatchObject({ id: 'largest:inst_tv_001', amountMinor: 60000, detail: '$ 600.00 · Hogar · 20/09' });
    // B2: the credit reversed principal recognised in earlier months, so a later instalment still recorded is real spending.
    const later = ledger(instalment('tv', 1, '2026-08-20', 50000), instalment('tv', 2, '2026-09-20', 50000), planRefund('pr', 'tv', '2026-08-25', 50000),
      entry('food', '2026-09-04', 10000));
    expect(largest(later)).toMatchObject({ id: 'largest:inst_tv_002', amountMinor: 50000 });
    // An adelanto's principal line is capped the same way; another plan's credit never touches it.
    const payoff = ledger({ ...entry('p_p', '2026-09-20', 80000, 'Electro', 'Hogar'), payoff: { operationId: 'p', planId: 'tv', component: 'principal' } },
      planRefund('pr', 'tv', '2026-09-21', 80000), planRefund('other', 'phone', '2026-09-21', 5000), entry('food', '2026-09-04', 10000));
    expect(largest(payoff)).toMatchObject({ id: 'largest:food', amountMinor: 10000 });
    const untouched = ledger(instalment('tv', 1, '2026-09-20', 90000), planRefund('other', 'phone', '2026-09-21', 5000), entry('food', '2026-09-04', 10000));
    expect(largest(untouched)).toMatchObject({ id: 'largest:inst_tv_001', amountMinor: 90000 });
  });

  it('the daily average of a negative net is 0', () => {
    const data = ledger(entry('aug', '2026-08-20', 50000), refund('r', 'aug', '2026-09-02', 50000, 'Carrefour', 'Supermercado'), entry('x', '2026-09-03', 1000));
    const report = spendingReport(data, 'ARS', '2026-09', '2026-09-12');
    expect(report.status === 'ready' && report.expenseMinor).toBe(-49000);
    expect(dailyAverageMinor(report.status === 'ready' ? report.expenseMinor : 0, report)).toBe(0);
  });
});

describe('24T3 verifier: growth is never claimed against a month a devolución left below zero', () => {
  const refund = (id: string, target: string, dateISO: string, amountMinor: number, category: string): Entry =>
    ({ ...entry(id, dateISO, -amountMinor, 'Tienda', category), refund: { operationId: id, targetEntryId: target } });
  it('Ropa at −30.000 in September and 5.000 in October is not «Ropa subió 35.000»; a real growth still is', () => {
    const data: LedgerSnapshot = { accounts: snapshot.accounts, entries: [entry('old', '2026-08-20', 30000, 'Tienda', 'Ropa'),
      entry('f', '2026-09-03', 1000, 'Súper', 'Comida'), refund('r', 'old', '2026-09-04', 30000, 'Ropa'),
      entry('f2', '2026-10-03', 3000, 'Súper', 'Comida'), entry('n', '2026-10-04', 5000, 'Tienda', 'Ropa')] };
    const insights = spendingInsights(data, [], 'ARS', '2026-10', '2026-10-31', format);
    // Comida grew 1.000 → 3.000 (+2.000); Ropa's +35.000 against a negative month is not claimed.
    expect(insights.filter(item => item.id.startsWith('growth:')).map(item => item.id)).toEqual(['growth:comida']);
    expect(insights.find(item => item.id.startsWith('largest:'))).toMatchObject({ id: 'largest:n', amountMinor: 5000 });
  });
});
