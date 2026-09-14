import { describe, expect, it } from 'vitest';
import { dailySpending, spendingComparison } from './report-insights.ts';
import type { Entry, LedgerSnapshot } from './ledger.ts';

const createdAt = '2026-09-12T12:00:00Z';
const entry = (id: string, dateISO: string, amountMinor: number, category = 'Salud', accountId = 'a'): Entry =>
  ({ id, dateISO, amountMinor, category, accountId, merchant: 'Fixture', kind: 'expense', createdAt });
const ledger = (entries: Entry[]): LedgerSnapshot => ({ accounts: [
  { id: 'a', currency: 'ARS', name: 'Fixture', openingMinor: 999999, createdAt },
  { id: 'u', currency: 'USD', name: 'Fixture USD', openingMinor: 0, createdAt },
], entries });

describe('recorded spending insights', () => {
  it('groups exact daily cents without incomes, other currencies or missing days', () => {
    const s = ledger([entry('1', '2026-09-02', 101), entry('2', '2026-09-02', 202), entry('3', '2026-09-01', 10),
      entry('4', '2026-09-03', 100), entry('u', '2026-09-02', 999, 'Salud', 'u'),
      { ...entry('i', '2026-09-02', 500), kind: 'income' }]);
    const before = JSON.stringify(s);
    expect(dailySpending(s, { currency: 'ARS', startISO: '2026-09-01', endISO: '2026-09-02' })).toEqual([
      { dateISO: '2026-09-02', amountMinor: 303, count: 2 }, { dateISO: '2026-09-01', amountMinor: 10, count: 1 }]);
    expect(JSON.stringify(s)).toBe(before);
  });
  it('compares equivalent elapsed dates and reconciles normalized category differences', () => {
    const s = ledger([entry('1', '2026-09-10', 500, 'SALUD'), entry('2', '2026-09-12', 200, 'Comida'),
      entry('3', '2026-08-10', 300, 'Salud'), entry('4', '2026-08-12', 100, 'Ropa'), entry('5', '2026-08-31', 999)]);
    const c = spendingComparison(s, 'ARS', '2026-09', '2026-09-12');
    expect(c.status).toBe('ready'); expect(c.deltaMinor).toBe(300);
    expect(c.previous?.endISO).toBe('2026-08-12');
    expect(c.categories.reduce((n, r) => n + r.deltaMinor, 0)).toBe(300);
    expect(c.categories.find(r => r.key === 'salud')?.deltaMinor).toBe(200);
  });
  it.each([['2026', '28'], ['2024', '29']])('caps both sides to February in %s', (year, day) => {
    const c = spendingComparison(ledger([entry('1', `${year}-03-${day}`, 100), entry('2', `${year}-02-${day}`, 100), entry('3', `${year}-03-31`, 999)]), 'ARS', year + '-03', year + '-03-31');
    expect(c.capped).toBe(true); expect(c.current.endISO).toBe(`${year}-03-${day}`);
    expect(c.deltaMinor).toBe(0);
  });
  it('compares full historical months and handles the year boundary', () => {
    const c = spendingComparison(ledger([entry('1', '2026-01-31', 100), entry('2', '2025-12-31', 200)]), 'ARS', '2026-01', '2026-09-12');
    expect(c.mode).toBe('full-months'); expect(c.previous?.endISO).toBe('2025-12-31'); expect(c.deltaMinor).toBe(-100);
  });
  it.each([{ entries: [] }, { entries: [entry('1', '2026-09-12', 100)] }, { entries: [entry('2', '2026-08-12', 100)] }])('does not infer savings from missing records', ({ entries }) => {
    const c = spendingComparison(ledger(entries), 'ARS', '2026-09', '2026-09-12');
    expect(c.status).toBe('insufficient'); expect(c.deltaMinor).toBeNull(); expect(c.categories).toEqual([]);
  });
  it('handles the earliest supported date', () => {
    expect(spendingComparison(ledger([]), 'ARS', '1900-01', '1900-01-12').previous).toBeNull();
  });
  it('rejects unsafe totals instead of returning a partial result', () => {
    const s = ledger([entry('1', '2026-09-12', Number.MAX_SAFE_INTEGER), entry('2', '2026-09-12', 1)]);
    expect(spendingComparison(s, 'ARS', '2026-09', '2026-09-12').status).toBe('out-of-range');
    expect(() => dailySpending(s, { currency: 'ARS', startISO: '2026-09-01', endISO: '2026-09-12' })).toThrow();
  });
  it('rejects invalid or inverted dates', () => {
    expect(() => dailySpending(ledger([]), { currency: 'ARS', startISO: '2026-02-30', endISO: '2026-03-12' })).toThrow();
    expect(() => spendingComparison(ledger([]), 'ARS', '2026-10', '2026-09-12')).toThrow();
  });
});
