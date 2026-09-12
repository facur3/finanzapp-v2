import { describe, expect, it } from 'vitest';
import { summarizeMonth } from './month-summary';
import type { Entry, LedgerSnapshot } from './ledger';

// Synthetic fixtures only. Opening balances must never become report income.
const createdAt = '2026-09-12T12:00:00Z';
const snapshot: LedgerSnapshot = {
  accounts: [
    { id: 'ars', name: 'Cuenta de prueba', currency: 'ARS', openingMinor: 987654321, createdAt },
    { id: 'usd', name: 'Dólares de prueba', currency: 'USD', openingMinor: 100000, createdAt },
  ], entries: [],
};
const entry = (data: Partial<Entry>): Entry => ({ id: 'e', accountId: 'ars', kind: 'expense', amountMinor: 101,
  merchant: 'Concepto de prueba', category: 'Otros', dateISO: '2026-09-12', createdAt, ...data });

describe('native monthly recorded flow', () => {
  it('has no fabricated flow from opening balances or an empty ledger', () => {
    expect(summarizeMonth(snapshot, 'ARS', '2026-09-12')).toEqual({ currency: 'ARS', startISO: '2026-09-01', endISO: '2026-09-12', status: 'ready', incomeMinor: 0, expenseMinor: 0, count: 0 });
  });
  it('keeps expenses and income separate, exact in integer cents', () => {
    expect(summarizeMonth({ ...snapshot, entries: [entry({}), entry({ id: 'b', amountMinor: 202 }), entry({ id: 'c', kind: 'income', amountMinor: 505 })] }, 'ARS', '2026-09-12'))
      .toMatchObject({ incomeMinor: 505, expenseMinor: 303, count: 3 });
  });
  it('separates ARS/USD, including when only the other currency has movements', () => {
    const data = { ...snapshot, entries: [entry({ amountMinor: 5000 }), entry({ id: 'u', accountId: 'usd', amountMinor: 100 })] };
    expect(summarizeMonth(data, 'USD', '2026-09-12')).toMatchObject({ expenseMinor: 100, count: 1 });
    expect(summarizeMonth({ ...snapshot, entries: [entry({})] }, 'USD', '2026-09-12')).toMatchObject({ expenseMinor: 0, count: 0 });
  });
  it('uses the transaction date, not when it was entered, through today inclusive', () => {
    const data = { ...snapshot, entries: [entry({ dateISO: '2026-08-31' }), entry({ id: 'b', dateISO: '2026-09-01' }), entry({ id: 'c' }), entry({ id: 'd', dateISO: '2026-09-13' })] };
    expect(summarizeMonth(data, 'ARS', '2026-09-12')).toMatchObject({ expenseMinor: 202, count: 2 });
  });
  it('handles year boundaries without mixing December into January', () => {
    const data = { ...snapshot, entries: [entry({ dateISO: '2025-12-31' }), entry({ id: 'b', dateISO: '2026-01-01' })] };
    expect(summarizeMonth(data, 'ARS', '2026-01-01')).toMatchObject({ startISO: '2026-01-01', endISO: '2026-01-01', expenseMinor: 101, count: 1 });
  });
  it('rejects invalid report dates', () => {
    expect(() => summarizeMonth(snapshot, 'ARS', '2026-02-30')).toThrow('Fecha de resumen inválida');
  });
  it.each(['income', 'expense'] as const)('does not crash Home or round an out-of-range %s sum', kind => {
    const data = { ...snapshot, entries: [entry({ kind, amountMinor: Number.MAX_SAFE_INTEGER }), entry({ id: 'b', kind, amountMinor: 1 })] };
    expect(summarizeMonth(data, 'ARS', '2026-09-12')).toEqual({ currency: 'ARS', startISO: '2026-09-01', endISO: '2026-09-12', status: 'out-of-range' });
  });
  it('does not mutate source records or their ordering', () => {
    const data = { ...snapshot, entries: [entry({}), entry({ id: 'b', dateISO: '2026-09-01' })] };
    const before = JSON.stringify(data);
    summarizeMonth(data, 'ARS', '2026-09-12');
    expect(JSON.stringify(data)).toBe(before);
  });
});
