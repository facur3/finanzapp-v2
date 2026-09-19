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
