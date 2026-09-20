import { describe, expect, it } from 'vitest';
import { currentMonthISO, shiftMonthISO, summarizeMonthlyBudgets, validateBudgetCollection,
  validateMonthlyBudget, type MonthlyBudget } from './budgets';
import type { Account, Entry, LedgerSnapshot } from './ledger';

const account: Account = {
  id: 'ars',
  name: 'Cuenta',
  currency: 'ARS',
  openingMinor: 0,
  createdAt: '2026-09-01T12:00:00.000Z',
};
const usd: Account = { ...account, id: 'usd', currency: 'USD' };
const entries: Entry[] = [
  { id: 'food-a', accountId: 'ars', kind: 'expense', amountMinor: 3000, merchant: 'A', category: 'Comida', dateISO: '2026-09-04', createdAt: account.createdAt },
  { id: 'food-b', accountId: 'ars', kind: 'expense', amountMinor: 2500, merchant: 'B', category: '  Cómida ', dateISO: '2026-09-10', createdAt: account.createdAt },
  { id: 'transport', accountId: 'ars', kind: 'expense', amountMinor: 1200, merchant: 'C', category: 'Transporte', dateISO: '2026-09-11', createdAt: account.createdAt },
  { id: 'income', accountId: 'ars', kind: 'income', amountMinor: 999999, merchant: 'Sueldo', category: 'Sueldo', dateISO: '2026-09-12', createdAt: account.createdAt },
  { id: 'usd-food', accountId: 'usd', kind: 'expense', amountMinor: 1000, merchant: 'D', category: 'Comida', dateISO: '2026-09-15', createdAt: account.createdAt },
  { id: 'october', accountId: 'ars', kind: 'expense', amountMinor: 5000, merchant: 'E', category: 'Comida', dateISO: '2026-10-01', createdAt: account.createdAt },
];
const snapshot: LedgerSnapshot = { accounts: [account, usd], entries };
const budget: MonthlyBudget = {
  id: 'food-budget',
  category: 'Comida',
  currency: 'ARS',
  monthISO: '2026-09',
  amountMinor: 5000,
  active: true,
  createdAt: '2026-09-01T12:00:00.000Z',
  revision: 0,
  updatedAt: '2026-09-01T12:00:00.000Z',
};

describe('monthly budgets', () => {
  it('normalizes category identity while keeping currencies and months separate', () => {
    const summary = summarizeMonthlyBudgets(snapshot, [budget], 'ARS', '2026-09');
    expect(summary.rows).toHaveLength(1);
    expect(summary.rows[0]).toMatchObject({ spentMinor: 5500, remainingMinor: -500, exceeded: true });
    expect(summary.budgetedMinor).toBe(5000);
    expect(summary.spentBudgetedMinor).toBe(5500);
    expect(summary.totalSpentMinor).toBe(6700);
    expect(summary.unbudgetedSpentMinor).toBe(1200);
    expect(summarizeMonthlyBudgets(snapshot, [budget], 'USD', '2026-09').totalSpentMinor).toBe(1000);
    expect(summarizeMonthlyBudgets(snapshot, [budget], 'ARS', '2026-10').totalSpentMinor).toBe(5000);
  });

  it('ignores income and inactive budgets instead of turning them into available spend', () => {
    const inactive = { ...budget, active: false, revision: 1, updatedAt: '2026-09-02T12:00:00.000Z' };
    const summary = summarizeMonthlyBudgets(snapshot, [inactive], 'ARS', '2026-09');
    expect(summary.rows).toEqual([]);
    expect(summary.budgetedMinor).toBe(0);
    expect(summary.totalSpentMinor).toBe(6700);
    expect(summary.unbudgetedSpentMinor).toBe(6700);
  });

  it('rejects duplicate active category budgets but permits an archived predecessor', () => {
    const duplicate = { ...budget, id: 'duplicate', category: 'cómida' };
    expect(() => validateBudgetCollection([budget, duplicate])).toThrow(/Ya existe/);
    validateBudgetCollection([{ ...budget, active: false }, duplicate]);
  });

  it('validates exact integer money, month format and immutable initial timestamps', () => {
    validateMonthlyBudget(budget);
    for (const patch of [
      { amountMinor: 0 }, { amountMinor: 1.2 }, { currency: 'EUR' }, { monthISO: '2026-13' },
      { category: '' }, { active: 1 }, { revision: -1 }, { updatedAt: 'invalid' },
    ]) expect(() => validateMonthlyBudget({ ...budget, ...patch } as MonthlyBudget)).toThrow();
  });

  it('moves calendar months without day/date drift', () => {
    expect(currentMonthISO('2026-09-20')).toBe('2026-09');
    expect(shiftMonthISO('2026-12', 1)).toBe('2027-01');
    expect(shiftMonthISO('2026-01', -1)).toBe('2025-12');
    expect(shiftMonthISO('2028-02', 12)).toBe('2029-02');
  });
});
