import { describe, expect, it } from 'vitest';
import { accountBalanceMinor, createPilotBackup, formatMinorUnits, parseMinorUnits, totalsByCurrency, validDateISO, validateEntry, type Account, type Entry } from './ledger';

// Synthetic fixtures only. These never enter the application or a user database.
const account: Account = { id: 'account-test', name: 'Test', currency: 'ARS', openingMinor: 10000, createdAt: '2026-09-11T12:00:00.000Z' };
const expense: Entry = { id: 'entry-test', accountId: account.id, kind: 'expense', amountMinor: 1250, merchant: 'Fixture', category: 'Fixture', dateISO: '2026-09-11', createdAt: account.createdAt };

describe('native integer-cent ledger', () => {
  it.each([
    ['0', 0], ['0,01', 1], ['1.234,56', 123456], ['1,234.56', 123456],
    ['1234.56', 123456], ['1234,5', 123450], ['10.000', 1000000],
    ['-1.234,56', -123456], [' 125 ', 12500], ['0.29', 29],
  ])('parses %s without floating-point rounding', (input, expected) => {
    expect(parseMinorUnits(input)).toBe(expected);
  });
  it.each(['', 'mil', '12abc', '1.23.4', '1,234,56', '12,3456', '-0.001', 'Infinity', '1e3', '$120', '999999999999999999999999999'])('rejects %s', input => {
    expect(() => parseMinorUnits(input)).toThrow();
  });
  it('keeps opening balance separate from income', () => {
    expect(accountBalanceMinor(account, [])).toBe(10000);
    expect(accountBalanceMinor(account, [expense])).toBe(8750);
  });
  it('formats cents without losing precision at the safe integer boundary', () => {
    expect(formatMinorUnits(1)).toBe('0,01');
    expect(formatMinorUnits(-123456)).toBe('-1.234,56');
    expect(formatMinorUnits(Number.MAX_SAFE_INTEGER)).toBe('90.071.992.547.409,91');
    expect(parseMinorUnits(formatMinorUnits(Number.MAX_SAFE_INTEGER))).toBe(Number.MAX_SAFE_INTEGER);
    expect(() => formatMinorUnits(1.5)).toThrow();
  });
  it('does not add ARS and USD', () => {
    expect(totalsByCurrency({ accounts: [account, { ...account, id: 'usd', currency: 'USD', openingMinor: 500 }], entries: [expense] })).toEqual({ ARS: 8750, USD: 500 });
  });
  it('starts empty without a pretend zero valuation', () => {
    expect(totalsByCurrency({ accounts: [], entries: [] })).toEqual({});
  });
  it('validates actual dates and leap years', () => {
    expect(validDateISO('2024-02-29')).toBe(true);
    expect(validDateISO('2025-02-29')).toBe(false);
    expect(validDateISO('2026-13-01')).toBe(false);
  });
  it('rejects missing accounts, non-positive amounts and non-entry kinds', () => {
    expect(() => validateEntry(expense, [])).toThrow();
    expect(() => validateEntry({ ...expense, amountMinor: 0 }, [account])).toThrow();
    expect(() => validateEntry({ ...expense, amountMinor: 1.2 }, [account])).toThrow();
    expect(() => validateEntry({ ...expense, kind: 'transfer' as never }, [account])).toThrow();
  });
  it('rejects overflow instead of silently rounding balances', () => {
    expect(() => accountBalanceMinor({ ...account, openingMinor: Number.MAX_SAFE_INTEGER }, [{ ...expense, kind: 'income' }])).toThrow();
  });
  it('exports a clearly distinct backup without changing data', () => {
    const snapshot = { accounts: [account], entries: [expense] };
    const backup = createPilotBackup(snapshot, new Date(account.createdAt));
    expect(backup.schema).toBe('finanzapp.native-pilot.v1');
    expect(backup.moneyUnit).toBe('integer-minor-units');
    expect(snapshot.accounts[0].openingMinor).toBe(10000);
    expect(backup.entries).toEqual([expense]);
  });
});
