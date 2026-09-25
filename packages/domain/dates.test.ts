import { describe, it, expect } from 'vitest';
import { labelFromISO, todayKey } from './dates.ts';

// Regression of the legacy src/domain/dates.js behaviour the native app consumes
// (its dates.test.js cases for these two functions are kept verbatim below, then
// the edges the app relies on: presentation.ts, format.ts and theme.ts).

describe('dates.todayKey', () => {
  it('formats a local YYYY-MM-DD (month is 1-based)', () => {
    expect(todayKey(new Date(2026, 6, 1))).toBe('2026-07-01');
    expect(todayKey(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(todayKey(new Date(2026, 11, 31))).toBe('2026-12-31');
  });

  it('uses the local calendar day, not UTC, and defaults to now', () => {
    const lateEvening = new Date(2026, 6, 1, 23, 59, 59);
    expect(todayKey(lateEvening)).toBe('2026-07-01');
    expect(todayKey()).toBe(todayKey(new Date()));
  });
});

describe('dates.labelFromISO', () => {
  const ref = new Date(2026, 6, 1); // 1 jul 2026

  it('uses relative labels only when they are actually relative to today', () => {
    expect(labelFromISO('2026-07-01', ref)).toBe('Hoy');
    expect(labelFromISO('2026-06-30', ref)).toBe('Ayer');
    expect(labelFromISO('2026-06-29', ref)).toBe('Anteayer');
  });

  it('shows the real calendar date for older movements', () => {
    expect(labelFromISO('2026-06-05', ref)).toBe('5 jun');
    expect(labelFromISO('2025-12-30', ref)).toBe('30 dic 2025');
  });

  it('never makes a future day relative and keeps the year only outside the reference year', () => {
    expect(labelFromISO('2026-07-02', ref)).toBe('2 jul');
    expect(labelFromISO('2026-12-31', ref)).toBe('31 dic');
    expect(labelFromISO('2027-01-01', ref)).toBe('1 ene 2027');
  });

  it('ignores the time of day on both sides', () => {
    const noon = new Date(2026, 6, 1, 12, 30);
    expect(labelFromISO('2026-07-01', noon)).toBe('Hoy');
    expect(labelFromISO('2026-06-30', new Date(2026, 6, 1, 0, 0, 1))).toBe('Ayer');
  });

  it('returns anything that is not a valid ISO day unchanged, as a string', () => {
    expect(labelFromISO('Hoy', ref)).toBe('Hoy');
    expect(labelFromISO('2026-7-1', ref)).toBe('2026-7-1');
    expect(labelFromISO('', ref)).toBe('');
    expect(labelFromISO(null, ref)).toBe('');
    expect(labelFromISO(undefined, ref)).toBe('');
  });

  it('follows JavaScript Date overflow for impossible days, as the legacy module did', () => {
    expect(labelFromISO('2026-02-31', ref)).toBe('3 mar');
  });
});
