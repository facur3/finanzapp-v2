import { describe, expect, it } from 'vitest';
import type { Entry, LedgerSnapshot } from './ledger';
import { categoryKey, expensesInPeriod, reportPeriod, spendingReport } from './spending-report';

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
