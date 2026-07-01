import { describe, it, expect } from 'vitest';
import { inPeriod, periodTxns, categoryTotals, incomeExpense, effectiveISO } from './reports.js';

const ref = new Date(2026, 6, 15); // 15 jul 2026

const txns = [
  { type: 'gasto', cat: 'comida', val: 100, dateISO: '2026-07-10' }, // this month
  { type: 'gasto', cat: 'comida', val: 50, dateISO: '2026-07-14' },  // this month
  { type: 'ingreso', val: 1000, dateISO: '2026-07-01' },             // this month
  { type: 'gasto', cat: 'ocio', val: 200, dateISO: '2026-06-20' },   // last month, same year
  { type: 'gasto', cat: 'auto', val: 300, dateISO: '2025-12-01' },   // last year
  { type: 'transfer', from: 'a', to: 'b', val: 999, dateISO: '2026-07-05' }, // ignored by totals
];

describe('reports.inPeriod', () => {
  it('mes = same year+month; año = same year', () => {
    expect(inPeriod('2026-07-10', 0, ref)).toBe(true);
    expect(inPeriod('2026-06-20', 0, ref)).toBe(false);
    expect(inPeriod('2026-06-20', 2, ref)).toBe(true);
    expect(inPeriod('2025-12-01', 2, ref)).toBe(false);
  });
  it('semana spans the 7-day week around ref', () => {
    expect(inPeriod('2026-07-15', 1, ref)).toBe(true);   // ref itself
    expect(inPeriod('2026-07-01', 1, ref)).toBe(false);  // >7 days before
    expect(inPeriod('2026-07-28', 1, ref)).toBe(false);  // >7 days after
  });
  it('returns false for missing/invalid dates', () => {
    expect(inPeriod('', 0, ref)).toBe(false);
    expect(inPeriod(null, 0, ref)).toBe(false);
  });
});

describe('reports period totals', () => {
  it('Este mes: only this month contributes', () => {
    const tx = periodTxns(txns, 0, ref);
    expect(categoryTotals(tx)).toEqual({ comida: 150 });
    expect(incomeExpense(tx)).toEqual({ income: 1000, expense: 150 });
  });
  it('Este año: 2026 expenses add up, 2025 excluded', () => {
    const tx = periodTxns(txns, 2, ref);
    expect(categoryTotals(tx)).toEqual({ comida: 150, ocio: 200 });
    expect(incomeExpense(tx)).toEqual({ income: 1000, expense: 350 });
  });
});

describe('reports.effectiveISO fallback', () => {
  it('derives from dateLabel when dateISO is absent', () => {
    expect(effectiveISO({ dateLabel: 'Hoy', val: 1 })).toBe(
      new Date().getFullYear() +
        '-' +
        String(new Date().getMonth() + 1).padStart(2, '0') +
        '-' +
        String(new Date().getDate()).padStart(2, '0')
    );
    expect(effectiveISO({ dateISO: '2026-01-02', dateLabel: 'Hoy' })).toBe('2026-01-02');
  });
});
