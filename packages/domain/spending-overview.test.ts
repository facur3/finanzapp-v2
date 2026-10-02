import { describe, it, expect } from 'vitest';
import { spendingOverview, spendingWindow } from './spending-overview';
import type { LedgerSnapshot } from './ledger';
const createdAt = '2026-09-19T12:00:00Z';
const snapshot: LedgerSnapshot = { accounts: [
  { id: 'a', name: 'Fixture ARS', currency: 'ARS', openingMinor: 999999, createdAt },
  { id: 'u', name: 'Fixture USD', currency: 'USD', openingMinor: 0, createdAt },
], entries: [
  { id: '1', accountId: 'a', kind: 'expense', amountMinor: 100, dateISO: '2026-09-01', merchant: 'Fixture', category: 'Comida', createdAt },
  { id: '2', accountId: 'a', kind: 'expense', amountMinor: 200, dateISO: '2026-09-14', merchant: 'Fixture', category: 'COMIDA', createdAt },
  { id: '3', accountId: 'a', kind: 'income', amountMinor: 500, dateISO: '2026-09-18', merchant: 'Fixture', category: 'Sueldo', createdAt },
  { id: '4', accountId: 'u', kind: 'expense', amountMinor: 1000, dateISO: '2026-09-18', merchant: 'Fixture', category: 'Comida', createdAt },
  { id: '5', accountId: 'a', kind: 'expense', amountMinor: 1000, dateISO: '2026-09-20', merchant: 'Fixture', category: 'Comida', createdAt },
], transfers: [{ id: 't', fromAccountId: 'a', toAccountId: 'other', amountMinor: 12345, dateISO: '2026-09-18', note: '', createdAt }] };
describe('spending-first overview', () => {
  it('keeps period, currency, income, transfers and initial balance distinct', () => {
    const before = JSON.stringify(snapshot);
    const report = spendingOverview(snapshot, spendingWindow('ARS', 'month', '2026-09-19'));
    expect(report).toMatchObject({ status: 'ready', expenseMinor: 300, incomeMinor: 500, expenseCount: 2 });
    expect(report.categories).toHaveLength(1);
    expect(report.buckets.reduce((sum, b) => sum + b.amountMinor, 0)).toBe(300);
    expect(JSON.stringify(snapshot)).toBe(before);
  });
  it('starts weeks on Monday across month/year boundaries, independent of local timezone', () => {
    expect(spendingWindow('ARS', 'week', '2026-01-01').startISO).toBe('2025-12-29');
    expect(spendingWindow('ARS', 'week', '2026-09-20').startISO).toBe('2026-09-14');
    expect(spendingWindow('ARS', 'week', '2026-09-21').startISO).toBe('2026-09-21');
    expect(spendingOverview(snapshot, spendingWindow('ARS', 'week', '2026-09-19'))).toMatchObject({ expenseMinor: 200, incomeMinor: 500 });
  });
  it('preserves leap day and short final buckets without inventing future days', () => {
    const report = spendingOverview({ accounts: [], entries: [] }, spendingWindow('ARS', 'month', '2024-02-29'));
    expect(report.buckets).toHaveLength(5);
    expect(report.buckets.at(-1)).toMatchObject({ startISO: '2024-02-29', endISO: '2024-02-29', amountMinor: 0, count: 0 });
    expect(report.categories).toEqual([]);
  });
  it('never renders a partial unsafe total', () => {
    const data = { ...snapshot, entries: snapshot.entries.slice(0, 2).map(e => ({ ...e, amountMinor: Number.MAX_SAFE_INTEGER })) };
    expect(spendingOverview(data, spendingWindow('ARS', 'month', '2026-09-19'))).toMatchObject({ status: 'out-of-range', categories: [], buckets: [] });
  });
  it('rejects reversed, malformed and excessive periods', () => {
    for (const [startISO, endISO] of [['2026-02-30','2026-03-01'], ['2026-09-19','2026-09-01'], ['2026-01-01','2026-09-19']]) {
      expect(() => spendingOverview(snapshot, { currency: 'ARS', startISO, endISO })).toThrow();
    }
  });
});

describe('24T3: devoluciones and adelantos in the overview (A23)', () => {
  it('nets a devolución in its own week and category with no purchase count; an adelanto counts once', () => {
    const at = (id: string, amountMinor: number, dateISO: string, category = 'Comida') =>
      ({ id, accountId: 'a', kind: 'expense' as const, amountMinor, dateISO, merchant: 'Fixture', category, createdAt });
    const data: LedgerSnapshot = { accounts: snapshot.accounts, entries: [
      at('buy', 10000, '2026-09-02'), at('other', 2000, '2026-09-03', 'Ropa'),
      { ...at('r', -10000, '2026-09-15'), refund: { operationId: 'r', targetEntryId: 'buy' } },
      { ...at('p_p', 50000, '2026-09-16', 'Hogar'), payoff: { operationId: 'p', planId: 'tv', component: 'principal' } },
      { ...at('p_f', 500, '2026-09-16', 'Cargos'), payoff: { operationId: 'p', planId: 'tv', component: 'fee' } },
    ] };
    const report = spendingOverview(data, spendingWindow('ARS', 'month', '2026-09-19'));
    if (report.status !== 'ready') throw new Error('Expected a ready overview');
    // 10.000 + 2.000 − 10.000 + 50.000 + 500 = 52.500; purchases: buy, other and the adelanto once.
    expect([report.expenseMinor, report.expenseCount]).toEqual([52500, 3]);
    expect(report.categories.map(c => [c.key, c.amountMinor, c.count])).toEqual([['hogar', 50000, 1], ['ropa', 2000, 1], ['cargos', 500, 0], ['comida', 0, 1]]);
    // Weekly buckets: 1–7 (12.000, 2), 8–14 (0, 0), 15–19 (−10.000 + 50.500, 1).
    expect(report.buckets.map(b => [b.startISO, b.amountMinor, b.count])).toEqual([['2026-09-01', 12000, 2], ['2026-09-08', 0, 0], ['2026-09-15', 40500, 1]]);
    expect(report.buckets.reduce((sum, b) => sum + b.amountMinor, 0)).toBe(report.expenseMinor);
    // A week of only the devolución: a negative net, nothing counted.
    expect(spendingOverview(data, { currency: 'ARS', startISO: '2026-09-15', endISO: '2026-09-15' })).toMatchObject({ expenseMinor: -10000, expenseCount: 0 });
  });
});
