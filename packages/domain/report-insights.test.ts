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

describe('24T3: devoluciones in daily spending and the comparison (A23)', () => {
  const refund = (id: string, target: string, dateISO: string, amountMinor: number, category = 'Salud'): Entry =>
    ({ ...entry(id, dateISO, -amountMinor, category), refund: { operationId: id, targetEntryId: target } });
  it('a day nets its devoluciones (and may be negative) and counts purchase lines only', () => {
    const s = ledger([entry('1', '2026-09-02', 500), refund('r1', '1', '2026-09-02', 200), refund('r0', 'old', '2026-09-03', 900),
      { ...entry('p_p', '2026-09-04', 3000, 'Hogar'), payoff: { operationId: 'p', planId: 'x', component: 'principal' } },
      { ...entry('p_i', '2026-09-04', 30, 'Intereses'), payoff: { operationId: 'p', planId: 'x', component: 'interest' } }]);
    expect(dailySpending(s, { currency: 'ARS', startISO: '2026-09-01', endISO: '2026-09-30' })).toEqual([
      { dateISO: '2026-09-04', amountMinor: 3030, count: 1 }, { dateISO: '2026-09-03', amountMinor: -900, count: 0 },
      { dateISO: '2026-09-02', amountMinor: 300, count: 1 }]);
  });
  it('a side made only of devoluciones is insufficient for a comparison, though it has a (negative) category', () => {
    const s = ledger([entry('aug', '2026-08-10', 1000), entry('jul', '2026-07-10', 5000), refund('r', 'jul', '2026-08-11', 5000, 'Ropa'),
      refund('r2', 'aug', '2026-09-05', 1000)]);
    const september = spendingComparison(s, 'ARS', '2026-09', '2026-09-12');
    expect([september.status, september.current.status === 'ready' && september.current.categories.length]).toEqual(['insufficient', 1]);
    // August has a purchase and a devolución of July; September only a devolución: no delta is claimed.
    expect(september.deltaMinor).toBeNull();
    // August against July: both sides have purchases, so it is ready; the July devolución nets in August's Ropa.
    const august = spendingComparison(s, 'ARS', '2026-08', '2026-09-12');
    expect(august).toMatchObject({ status: 'ready', deltaMinor: (1000 - 5000) - 5000 });
    expect(august.categories.map(c => [c.key, c.currentMinor, c.previousMinor, c.currentCount, c.previousCount]))
      .toEqual([['ropa', -5000, 0, 0, 0], ['salud', 1000, 5000, 1, 1]]);
  });
  it('signed lines: a day is bounded by Σ|line|, so a safe net never hides an unsafe day', () => {
    const s = ledger([entry('1', '2026-09-12', Number.MAX_SAFE_INTEGER), entry('2', '2026-09-12', 1), refund('r', '1', '2026-09-11', Number.MAX_SAFE_INTEGER)]);
    expect(() => dailySpending(s, { currency: 'ARS', startISO: '2026-09-01', endISO: '2026-09-12' })).toThrow('El total supera el rango seguro.');
  });
});
