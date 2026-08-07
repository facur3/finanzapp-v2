import { describe, it, expect } from 'vitest';
import { todayKey, parseDate, isoFromLabel, labelFromISO, timelineLabelFromISO, fullDateLabel, sortTransactionsNewestFirst } from './dates.js';

describe('dates.todayKey', () => {
  it('formats a local YYYY-MM-DD (month is 1-based)', () => {
    expect(todayKey(new Date(2026, 6, 1))).toBe('2026-07-01');
    expect(todayKey(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(todayKey(new Date(2026, 11, 31))).toBe('2026-12-31');
  });
});

describe('dates.parseDate', () => {
  const ref = new Date(2026, 6, 1); // 1 jul 2026

  it('parses "day month" near the reference', () => {
    const d = parseDate('3 jul', ref);
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(6);
    expect(d.getDate()).toBe(3);
  });

  it('returns null when there is no day number', () => {
    expect(parseDate('Hoy', ref)).toBe(null);
    expect(parseDate('', ref)).toBe(null);
  });

  it('resolves a far-future month to the previous year (nearest occurrence)', () => {
    // "30 dic" seen on 1 jan 2026 -> previous year's December
    const d = parseDate('30 dic', new Date(2026, 0, 1));
    expect(d.getFullYear()).toBe(2025);
    expect(d.getMonth()).toBe(11);
    expect(d.getDate()).toBe(30);
  });
});

describe('dates.isoFromLabel', () => {
  const ref = new Date(2026, 6, 15); // 15 jul 2026
  it('maps relative labels to ISO keys', () => {
    expect(isoFromLabel('Hoy', ref)).toBe('2026-07-15');
    expect(isoFromLabel('Ayer', ref)).toBe('2026-07-14');
    expect(isoFromLabel('Anteayer', ref)).toBe('2026-07-13');
    expect(isoFromLabel('', ref)).toBe('2026-07-15');
  });
  it('parses explicit "day month" labels', () => {
    expect(isoFromLabel('3 jul', ref)).toBe('2026-07-03');
  });
  it('falls back to today for unrecognizable labels', () => {
    expect(isoFromLabel('cualquier cosa', ref)).toBe('2026-07-15');
  });
  it('preserves a valid ISO date from a native calendar input', () => {
    expect(isoFromLabel('2024-06-05', ref)).toBe('2024-06-05');
  });
  it('rejects an impossible ISO date', () => {
    expect(isoFromLabel('2026-02-31', ref)).toBe('2026-07-15');
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
});

describe('dates timeline presentation', () => {
  const ref = new Date(2026, 7, 7, 12);

  it('shows relative context together with the real calendar date', () => {
    expect(timelineLabelFromISO('2026-08-07', ref)).toBe('Hoy · 7 ago');
    expect(timelineLabelFromISO('2026-08-06', ref)).toBe('Ayer · 6 ago');
    expect(timelineLabelFromISO('2026-08-02', ref)).toBe('2 ago');
  });

  it('formats an unambiguous full date for movement detail', () => {
    expect(fullDateLabel('2026-08-07')).toBe('7 de agosto de 2026');
  });
});

describe('dates.sortTransactionsNewestFirst', () => {
  it('uses the actual date instead of persisted array order', () => {
    const old = { id: 9, dateISO: '2026-07-01' };
    const newest = { id: 2, dateISO: '2026-08-07' };
    const middle = { id: 7, dateISO: '2026-08-06' };
    expect(sortTransactionsNewestFirst([old, newest, middle])).toEqual([newest, middle, old]);
  });

  it('uses the newest id first when two movements share a date', () => {
    expect(sortTransactionsNewestFirst([
      { id: 4, dateISO: '2026-08-07' },
      { id: 8, dateISO: '2026-08-07' },
    ]).map(item => item.id)).toEqual([8, 4]);
  });
});
