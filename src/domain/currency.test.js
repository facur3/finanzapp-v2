import { describe, expect, it } from 'vitest';
import { accountBalanceARS, convertCurrency, sumAccountsARS, transactionAmountARS } from './currency.js';

describe('currency conversion', () => {
  it('converts between ARS and USD with the same quote', () => {
    expect(convertCurrency(100, 'USD', 'ARS', 1300)).toBe(130000);
    expect(convertCurrency(130000, 'ARS', 'USD', 1300)).toBe(100);
  });

  it('sums mixed-currency liquid accounts in ARS', () => {
    const accounts = { ars: { currency: 'ARS', kind: 'liquid' }, usd: { currency: 'USD', kind: 'liquid' } };
    expect(sumAccountsARS(['ars', 'usd'], { ars: 50000, usd: 100 }, accounts, 1300)).toBe(180000);
  });

  it('does not double-convert an investment portfolio whose prices are already ARS', () => {
    const accounts = { broker: { currency: 'USD', kind: 'invest' } };
    expect(accountBalanceARS('broker', { broker: 250000 }, accounts, 1300, { broker: [{ ticker: 'AAPL' }] })).toBe(250000);
  });

  it('infers a legacy transaction currency from its account', () => {
    const accounts = { usd: { currency: 'USD' } };
    expect(transactionAmountARS({ amount: -10, account: 'usd' }, accounts, 1300)).toBe(-13000);
  });
});
