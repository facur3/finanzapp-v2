import { describe, it, expect } from 'vitest';
import { fmtNum, fmtInt, abbr, signed } from './money.js';

// Characterization tests: lock the exact strings the v53 app produces.
describe('money.fmtNum', () => {
  it('formats AR thousands + 2 decimals', () => {
    expect(fmtNum(944490)).toBe('944.490,00');
    expect(fmtNum(1234.5)).toBe('1.234,50');
    expect(fmtNum(0)).toBe('0,00');
  });
  it('uses absolute value', () => {
    expect(fmtNum(-1000)).toBe('1.000,00');
  });
});

describe('money.fmtInt', () => {
  it('rounds and groups thousands, no decimals', () => {
    expect(fmtInt(1512)).toBe('1.512');
    expect(fmtInt(944490)).toBe('944.490');
    expect(fmtInt(1234.6)).toBe('1.235');
  });
});

describe('money.abbr', () => {
  it('abbreviates thousands with K', () => {
    expect(abbr(78144)).toBe('78K');
    expect(abbr(500)).toBe('500');
    expect(abbr(999)).toBe('999');
    expect(abbr(1000)).toBe('1K');
  });
});

describe('money.signed', () => {
  it('prefixes sign and $', () => {
    expect(signed(-1000)).toBe('-$1.000,00');
    expect(signed(1000)).toBe('+$1.000,00');
    expect(signed(0)).toBe('+$0,00');
  });
});
