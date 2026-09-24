import { describe, expect, it } from 'vitest';
import { BUDGET_WARNING_RATIO, budgetIdentityKey, budgetState, currentMonthISO, scopedMonthlyBudget, shiftMonthISO, summarizeMonthlyBudgets,
  validateBudgetCollection, validateMonthlyBudget, type CategoryMonthlyBudget, type MonthlyBudget, type TotalMonthlyBudget } from './budgets';
import type { Account, Entry, LedgerSnapshot } from './ledger';
import { initialRecord, snapshotFromArchive, type LedgerArchive } from './recovery';
import { initialTransferRecord } from './transfers';

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
const budget: CategoryMonthlyBudget = {
  id: 'food-budget',
  scope: 'category',
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
      { amountMinor: 0 }, { amountMinor: -5000 }, { amountMinor: 1.2 }, { currency: 'XAU' }, { currency: 'ZZZ' }, { currency: 'ars' }, { monthISO: '2026-13' },
      { category: '' }, { category: undefined }, { scope: 'general' }, { active: 1 }, { revision: -1 }, { updatedAt: 'invalid' },
    ]) expect(() => validateMonthlyBudget({ ...budget, ...patch } as MonthlyBudget)).toThrow();
  });

  it('moves calendar months without day/date drift', () => {
    expect(currentMonthISO('2026-09-20')).toBe('2026-09');
    expect(shiftMonthISO('2026-12', 1)).toBe('2027-01');
    expect(shiftMonthISO('2026-01', -1)).toBe('2025-12');
    expect(shiftMonthISO('2028-02', 12)).toBe('2029-02');
  });

  it('resolves budget rows and the summary shape a screen can rely on', () => {
    const summary = summarizeMonthlyBudgets(snapshot, [budget], 'ARS', '2026-09');
    expect(summary.total).toBeNull();
    expect(summary.rows[0].budget.scope).toBe('category');
  });
});

// A total budget is the ceiling for every recorded expense of the month. The
// fixtures below mix cash, a credit card, a personal debt, transfers, income
// and a voided entry so each exclusion is explicit.
const createdAt = '2026-09-01T12:00:00.000Z';
const cash: Account = { id: 'cash', name: 'Banco', currency: 'ARS', openingMinor: 1000000, createdAt };
const cardAccount: Account = { id: 'card', name: 'Visa', currency: 'ARS', openingMinor: 0, createdAt };
const debtAccount: Account = { id: 'debt', name: 'Debo · Juan', currency: 'ARS', openingMinor: -30000, createdAt };
const usdCash: Account = { id: 'usd-cash', name: 'Dólares', currency: 'USD', openingMinor: 100000, createdAt };
const expense = (id: string, accountId: string, amountMinor: number, category: string, dateISO = '2026-09-10'): Entry =>
  ({ id, accountId, kind: 'expense', amountMinor, merchant: id, category, dateISO, createdAt });
const monthArchive: LedgerArchive = {
  accounts: [cash, cardAccount, debtAccount, usdCash],
  records: [
    initialRecord(expense('cash-food', cash.id, 120000, 'Comida')),
    initialRecord(expense('card-food', cardAccount.id, 30000, 'comida')), // a card purchase: one expense, once
    initialRecord(expense('cash-fun', cash.id, 55000, 'Ocio')),
    initialRecord(expense('cash-other', cash.id, 115000, 'Transporte')),
    initialRecord({ ...expense('salary', cash.id, 900000, 'Sueldo'), kind: 'income' }),
    initialRecord(expense('usd-food', usdCash.id, 4000, 'Comida')),
    initialRecord(expense('last-month', cash.id, 999999, 'Comida', '2026-08-31')),
    initialRecord(expense('next-month', cash.id, 999999, 'Comida', '2026-10-01')),
    { ...initialRecord(expense('voided', cash.id, 777777, 'Comida')), voided: true, revision: 1, updatedAt: '2026-09-11T12:00:00.000Z' },
  ],
  transfers: [
    initialTransferRecord({ id: 'card-payment', fromAccountId: cash.id, toAccountId: cardAccount.id, amountMinor: 30000, note: 'Pago Visa', dateISO: '2026-09-15', createdAt }),
    initialTransferRecord({ id: 'debt-payment', fromAccountId: cash.id, toAccountId: debtAccount.id, amountMinor: 10000, note: 'Pago Juan', dateISO: '2026-09-16', createdAt }),
  ],
};
const monthSnapshot = snapshotFromArchive(monthArchive);
const total: TotalMonthlyBudget = { id: 'total-sep', scope: 'total', currency: 'ARS', monthISO: '2026-09', amountMinor: 500000, active: true, createdAt, revision: 0, updatedAt: createdAt };
const food: CategoryMonthlyBudget = { id: 'food-sep', scope: 'category', category: 'Comida', currency: 'ARS', monthISO: '2026-09', amountMinor: 150000, active: true, createdAt, revision: 0, updatedAt: createdAt };
const fun: CategoryMonthlyBudget = { ...food, id: 'fun-sep', category: 'Ocio', amountMinor: 50000 };

describe('total monthly budget', () => {
  it('measures every recorded expense of the month and currency: cash and card purchases once, nothing else', () => {
    const summary = summarizeMonthlyBudgets(monthSnapshot, [total], 'ARS', '2026-09');
    // 120.000 + 30.000 (card purchase) + 55.000 + 115.000 = 320.000. Income, the card payment, the debt payment,
    // the voided entry and other months are not spending.
    expect(summary.totalSpentMinor).toBe(320000);
    expect(summary.total).toMatchObject({ spentMinor: 320000, remainingMinor: 180000, exceeded: false });
    expect(summary.total!.ratio).toBeCloseTo(0.64);
    expect(budgetState(summary.total!)).toBe('calm');
    expect(summary.rows).toEqual([]);
    expect(summary.budgetedMinor).toBe(0);
  });

  it('keeps ARS and USD apart: a USD total sees only USD expenses', () => {
    const usdTotal: TotalMonthlyBudget = { ...total, id: 'total-usd', currency: 'USD', amountMinor: 5000 };
    const ars = summarizeMonthlyBudgets(monthSnapshot, [total, usdTotal], 'ARS', '2026-09');
    const usd = summarizeMonthlyBudgets(monthSnapshot, [total, usdTotal], 'USD', '2026-09');
    expect(ars.total!.budget.id).toBe('total-sep');
    expect(ars.totalSpentMinor).toBe(320000);
    expect(usd.total!.budget.id).toBe('total-usd');
    expect(usd.total).toMatchObject({ spentMinor: 4000, remainingMinor: 1000 });
    expect(summarizeMonthlyBudgets(monthSnapshot, [total], 'ARS', '2026-08').total).toBeNull();
  });

  it('coexists with category sublimits that are never added to it', () => {
    const summary = summarizeMonthlyBudgets(monthSnapshot, [total, food, fun], 'ARS', '2026-09');
    expect(summary.total!.budget.amountMinor).toBe(500000);
    expect(summary.total!.spentMinor).toBe(320000);
    expect(summary.rows.map(row => [row.budget.category, row.spentMinor, row.exceeded])).toEqual([['Ocio', 55000, true], ['Comida', 150000, false]]);
    // The sublimits sum to 200.000 for their own line; the month's budget is still 500.000.
    expect(summary.budgetedMinor).toBe(200000);
    expect(summary.spentBudgetedMinor).toBe(205000);
    expect(summary.unbudgetedSpentMinor).toBe(115000);
    expect(summary.total!.remainingMinor).toBe(180000);
  });

  it('reports exceeded, exactly reached and approaching totals through the shared state thresholds', () => {
    const exceeded = summarizeMonthlyBudgets(monthSnapshot, [{ ...total, amountMinor: 300000 }], 'ARS', '2026-09').total!;
    expect(exceeded).toMatchObject({ remainingMinor: -20000, exceeded: true });
    expect(budgetState(exceeded)).toBe('exceeded');
    const exact = summarizeMonthlyBudgets(monthSnapshot, [{ ...total, amountMinor: 320000 }], 'ARS', '2026-09').total!;
    expect(exact).toMatchObject({ remainingMinor: 0, ratio: 1, exceeded: false });
    expect(budgetState(exact)).toBe('warning');
    const near = summarizeMonthlyBudgets(monthSnapshot, [{ ...total, amountMinor: 370000 }], 'ARS', '2026-09').total!;
    expect(near.ratio).toBeGreaterThanOrEqual(BUDGET_WARNING_RATIO);
    expect(budgetState(near)).toBe('warning');
    expect(budgetState({ ratio: 0.849, exceeded: false })).toBe('calm');
    expect(budgetState({ ratio: 0.85, exceeded: false })).toBe('warning');
    // Exceeded category sublimits stay category facts; the total stays calm.
    const mixed = summarizeMonthlyBudgets(monthSnapshot, [total, fun], 'ARS', '2026-09');
    expect(budgetState(mixed.rows[0])).toBe('exceeded');
    expect(budgetState(mixed.total!)).toBe('calm');
  });

  it('with no expenses the total is untouched, and with no budgets there is nothing to show', () => {
    const quiet = summarizeMonthlyBudgets({ accounts: [cash], entries: [] }, [total], 'ARS', '2026-09');
    expect(quiet.total).toMatchObject({ spentMinor: 0, remainingMinor: 500000, ratio: 0, exceeded: false });
    expect(quiet.totalSpentMinor).toBe(0);
    const none = summarizeMonthlyBudgets(monthSnapshot, [], 'ARS', '2026-09');
    expect(none.total).toBeNull();
    expect(none.rows).toEqual([]);
    expect(none.totalSpentMinor).toBe(320000);
    const archived = summarizeMonthlyBudgets(monthSnapshot, [{ ...total, active: false, revision: 1, updatedAt: '2026-09-02T12:00:00.000Z' }], 'ARS', '2026-09');
    expect(archived.total).toBeNull();
  });

  it('allows one active total per currency and month, an archived predecessor, and totals beside sublimits', () => {
    expect(() => validateBudgetCollection([total, { ...total, id: 'second-total' }])).toThrow(/general activo/);
    validateBudgetCollection([{ ...total, active: false }, { ...total, id: 'second-total' }]);
    validateBudgetCollection([total, { ...total, id: 'oct', monthISO: '2026-10' }, { ...total, id: 'usd', currency: 'USD' }, food, fun]);
    expect(() => validateBudgetCollection([food, { ...food, id: 'dup', category: ' CÓMIDA ' }])).toThrow(/esa categoría/);
    expect(budgetIdentityKey(total)).toBe('ARS|2026-09|total');
    expect(budgetIdentityKey(food)).toBe('ARS|2026-09|category:comida');
    expect(budgetIdentityKey({ ...food, category: 'cómida ' })).toBe(budgetIdentityKey(food));
  });

  it('never accepts a fake category on a total, a missing category on a sublimit, or a non-positive limit', () => {
    validateMonthlyBudget(total);
    expect(() => validateMonthlyBudget({ ...total, category: 'General' } as unknown as MonthlyBudget)).toThrow(/no lleva categoría/);
    expect(() => validateMonthlyBudget({ ...total, category: '' } as unknown as MonthlyBudget)).toThrow(/no lleva categoría/);
    expect(() => validateMonthlyBudget({ ...food, category: undefined } as unknown as MonthlyBudget)).toThrow(/categoría/);
    expect(() => validateMonthlyBudget({ ...total, amountMinor: 0 })).toThrow(/mayor que cero/);
    expect(() => validateMonthlyBudget({ ...total, amountMinor: -1 })).toThrow(/mayor que cero/);
    expect(() => validateMonthlyBudget({ ...total, scope: 'general' } as unknown as MonthlyBudget)).toThrow(/general o por categoría/);
  });

  it('reads legacy records without a scope as category budgets, exactly as stored', () => {
    const { scope: _scope, ...legacy } = food;
    expect(scopedMonthlyBudget(legacy)).toEqual(food);
    expect(scopedMonthlyBudget({ ...legacy, scope: 'category' })).toEqual(food);
    const { category: _category, ...storedTotal } = total;
    expect(scopedMonthlyBudget({ ...storedTotal, category: null })).toEqual(total);
    expect(Object.hasOwn(scopedMonthlyBudget({ ...storedTotal, category: null }), 'category')).toBe(false);
  });
});
