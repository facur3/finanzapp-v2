import { describe, expect, it } from 'vitest';
import { dailyAverageMinor, monthlySpendingTrend, spendingInsights, topMerchants } from './report-trend';
import type { Entry, LedgerSnapshot } from './ledger';
import type { MonthlyBudget } from './budgets';

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
    expect(() => dailyAverageMinor(-1, { currency: 'ARS', startISO: '2026-09-01', endISO: '2026-09-12' })).toThrow();
  });
  it('states facts only: over/near budget, the largest expense and the category that grew', () => {
    const budgets: MonthlyBudget[] = [
      { id: 'b1', category: 'Supermercado', currency: 'ARS', monthISO: '2026-09', amountMinor: 12000, active: true, createdAt, revision: 0, updatedAt: createdAt },
      { id: 'b2', category: 'Café', currency: 'ARS', monthISO: '2026-09', amountMinor: 25000, active: true, createdAt, revision: 0, updatedAt: createdAt },
    ];
    const insights = spendingInsights(snapshot, budgets, 'ARS', '2026-09', '2026-09-12', format);
    expect(insights.map(item => item.id)).toEqual(['over:b1', 'near:b2', 'largest:3', 'growth:cafe']);
    expect(insights[0]).toMatchObject({ tone: 'expense', detail: '$ 70.00 por encima de $ 120.00' });
    expect(insights[1]).toMatchObject({ tone: 'warning', detail: 'Quedan $ 19.00 de $ 250.00' });
    expect(insights[2].title).toBe('Tu mayor gasto fue Starbucks');
    expect(insights[3].detail).toBe('Frente a los mismos días del mes anterior');
    expect(spendingInsights({ accounts: snapshot.accounts, entries: [] }, [], 'ARS', '2026-09', '2026-09-12', format)).toEqual([]);
  });
});
