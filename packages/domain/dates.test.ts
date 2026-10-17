import { describe, it, expect } from 'vitest';
import { labelFromISO, todayKey } from './dates.ts';
import { advanceRecurringDate } from './recurring.ts';

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

// 25R1: what must hold in every zone CI runs the suites in (UTC, Buenos Aires, New York with its daylight saving, Auckland
// ahead of UTC): the day is the device's local calendar day, and date-only arithmetic never moves across a DST change.
describe('the local calendar in any zone', () => {
  it('takes the local day at 23:30 and at 00:30, never the UTC one', () => {
    expect(todayKey(new Date(2026, 8, 25, 23, 30))).toBe('2026-09-25');
    expect(todayKey(new Date(2026, 8, 26, 0, 30))).toBe('2026-09-26');
    expect(todayKey(new Date(2026, 0, 1, 0, 30))).toBe('2026-01-01');
    expect(todayKey(new Date(2026, 11, 31, 23, 30))).toBe('2026-12-31');
  });
  it('steps a weekly rule across the DST changes of New York and Auckland by exactly seven days', () => {
    for (const [from, to] of [['2026-03-07', '2026-03-14'], ['2026-10-31', '2026-11-07'], ['2027-04-03', '2027-04-10'], ['2026-09-26', '2026-10-03']]) {
      expect(advanceRecurringDate(from, 'weekly', from)).toBe(to);
    }
  });
  it('keeps a monthly rule anchored on the 31st through February and back', () => {
    expect(advanceRecurringDate('2026-01-31', 'monthly', '2026-01-31')).toBe('2026-02-28');
    expect(advanceRecurringDate('2026-02-28', 'monthly', '2026-01-31')).toBe('2026-03-31');
    expect(advanceRecurringDate('2028-01-31', 'monthly', '2028-01-31')).toBe('2028-02-29');
  });
});
