import { describe, it, expect } from 'vitest';
import { applyTxn, reverseTxn } from './transactions.js';

// Characterization tests locking the v53 apply/reverse behaviour, plus the core
// financial invariant: reverse(apply(x)) === x.
describe('transactions.applyTxn', () => {
  it('expense lowers the account, raises category total + monthExpense', () => {
    const t = { type: 'gasto', account: 'a', cat: 'comida', amount: -500, val: 500 };
    const r = applyTxn(t, { a: 1000 }, {}, 0, 0);
    expect(r.b.a).toBe(500);
    expect(r.ct.comida).toBe(500);
    expect(r.me).toBe(500);
    expect(r.mi).toBe(0);
  });

  it('income raises the account + monthIncome, not category totals', () => {
    const t = { type: 'ingreso', account: 'a', amount: 500, val: 500 };
    const r = applyTxn(t, { a: 1000 }, {}, 0, 0);
    expect(r.b.a).toBe(1500);
    expect(r.mi).toBe(500);
    expect(r.me).toBe(0);
    expect(r.ct).toEqual({});
  });

  it('transfer moves between accounts and does not touch net worth totals', () => {
    const t = { type: 'transfer', from: 'a', to: 'b', val: 500 };
    const r = applyTxn(t, { a: 1000, b: 200 }, {}, 0, 0);
    expect(r.b.a).toBe(500);
    expect(r.b.b).toBe(700);
    expect(r.mi).toBe(0);
    expect(r.me).toBe(0);
  });

  it('does not mutate the input balances/category objects', () => {
    const b = { a: 1000 };
    const ct = {};
    applyTxn({ type: 'gasto', account: 'a', cat: 'comida', amount: -500, val: 500 }, b, ct, 0, 0);
    expect(b).toEqual({ a: 1000 });
    expect(ct).toEqual({});
  });
});

describe('transactions round-trip', () => {
  const cases = [
    { type: 'gasto', account: 'a', cat: 'comida', amount: -500, val: 500 },
    { type: 'ingreso', account: 'a', amount: 500, val: 500 },
    { type: 'transfer', from: 'a', to: 'b', val: 500 },
  ];
  it('reverse undoes apply for every type', () => {
    for (const t of cases) {
      const b0 = { a: 1000, b: 200 }, ct0 = { comida: 100 }, mi0 = 10, me0 = 20;
      const a = applyTxn(t, b0, ct0, mi0, me0);
      const r = reverseTxn(t, a.b, a.ct, a.mi, a.me);
      expect(r.b).toEqual(b0);
      expect(r.ct).toEqual(ct0);
      expect(r.mi).toBe(mi0);
      expect(r.me).toBe(me0);
    }
  });
});
