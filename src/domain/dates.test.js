import { describe, it, expect } from 'vitest';
import { todayKey, parseDate } from './dates.js';

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
