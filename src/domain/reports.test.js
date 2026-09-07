import { describe, it, expect } from 'vitest';
import { inPeriod, periodTxns, periodTxnsOffset, periodBounds, comparablePreviousPeriodBounds, comparablePreviousPeriodTxns, reportBuckets, categoryTotals, incomeExpense, effectiveISO } from './reports.js';

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

  it('compares against the immediately preceding period', () => {
    expect(periodTxnsOffset(txns, 0, -1, ref)).toEqual([
      { type: 'gasto', cat: 'ocio', val: 200, dateISO: '2026-06-20' },
    ]);
    expect(periodBounds(1, ref, -1)).toMatchObject({ startISO: '2026-07-06', endISO: '2026-07-13' });
  });

  it('compares only equivalent elapsed days, not a partial month against a full month', () => {
    const rows = [
      { type: 'gasto', val: 10, dateISO: '2026-06-15' },
      { type: 'gasto', val: 20, dateISO: '2026-06-16' },
      { type: 'gasto', val: 30, dateISO: '2026-06-30' },
    ];
    expect(comparablePreviousPeriodBounds(0, ref)).toMatchObject({ startISO: '2026-06-01', endISO: '2026-06-16', elapsedDays: 15 });
    expect(comparablePreviousPeriodTxns(rows, 0, ref)).toEqual([rows[0]]);
  });

  it('uses the same elapsed weekdays for a weekly comparison', () => {
    expect(comparablePreviousPeriodBounds(1, ref)).toMatchObject({ startISO: '2026-07-06', endISO: '2026-07-09', elapsedDays: 3 });
  });

  it('builds stable month buckets and sums only expenses', () => {
    const buckets = reportBuckets(txns, 0, ref);
    expect(buckets.map(row => row.label)).toEqual(['1–7', '8–14', '15–21', '22–28', '29–31']);
    expect(buckets.map(row => row.value)).toEqual([0, 150, 0, 0, 0]);
  });

  it('uses one bucket per weekday and accepts a currency converter', () => {
    const buckets = reportBuckets(txns, 1, ref, t => t.type === 'gasto' ? t.val * 2 : 0);
    expect(buckets.map(row => row.label)).toEqual(['L', 'M', 'X', 'J', 'V', 'S', 'D']);
    expect(buckets.map(row => row.value)).toEqual([0, 100, 0, 0, 0, 0, 0]);
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
