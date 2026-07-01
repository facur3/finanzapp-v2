import { describe, it, expect } from 'vitest';
import { liquidIds, investIds, debtIds, sumIds, cardDebt, netWorth } from './balances.js';

const state = {
  order: ['a', 'b', 'c', 'x'],
  accounts: {
    a: { liquid: true },
    b: { kind: 'invest' },
    c: { kind: 'debt' },
    x: { liquid: true },
  },
  archived: { x: true }, // archived accounts are excluded everywhere
  balances: { a: 1000, b: 500, c: 200, x: 9999 },
  cards: [{ saldo: 300 }, { saldo: 100 }],
};

describe('balances account classification', () => {
  it('splits liquid / invest / debt and skips archived', () => {
    expect(liquidIds(state)).toEqual(['a']);
    expect(investIds(state)).toEqual(['b']);
    expect(debtIds(state)).toEqual(['c']);
  });
});

describe('balances.sumIds / cardDebt', () => {
  it('sums balances for the given ids', () => {
    expect(sumIds(state.balances, ['a', 'b'])).toBe(1500);
    expect(sumIds(state.balances, [])).toBe(0);
  });
  it('adds up all card saldos', () => {
    expect(cardDebt(state)).toBe(400);
  });
});

describe('balances.netWorth', () => {
  it('pat = disponible + invertido − (cards + debt accounts)', () => {
    // disp=1000, inv=500, debt=cards(400)+debtAcc(200)=600 -> pat=900
    expect(netWorth(state)).toEqual({ disp: 1000, inv: 500, pat: 900 });
  });
});
