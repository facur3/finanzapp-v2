import { describe, expect, it } from 'vitest';
import { accountBalanceMinor, totalsByCurrency, type Account, type Entry, type LedgerSnapshot, type Transfer } from './ledger';
import { spendingOverview } from './spending-overview';
import { summarizeMonthlyBudgets, type MonthlyBudget } from './budgets';
import { accountKind, assertPostingAccount, cardAvailableLimitMinor, cardCreditMinor, cardCycle, cardDebtMinor, cardStatementActivity,
  debtOutstandingMinor, hiddenLiabilityAccountIds, liquidTotalsByCurrency, nextDayOfMonthISO, previousDayOfMonthISO,
  validateCreditCardProfile, validateLiabilityProfiles, validatePersonalDebtProfile,
  type CreditCardProfile, type PersonalDebtProfile } from './liabilities';

const createdAt = '2026-09-01T12:00:00.000Z';
const cash: Account = { id: 'cash', name: 'Banco', currency: 'ARS', openingMinor: 100000, createdAt };
const cardAccount: Account = { id: 'card-acc', name: 'Visa Gold', currency: 'ARS', openingMinor: -20000, createdAt };
const debtAccount: Account = { id: 'debt-acc', name: 'Debo · Juan', currency: 'ARS', openingMinor: -30000, createdAt };
const receivableAccount: Account = { id: 'rec-acc', name: 'Me deben · Ana', currency: 'ARS', openingMinor: 15000, createdAt };
const usd: Account = { id: 'usd', name: 'Dólares', currency: 'USD', openingMinor: 500, createdAt };
const accounts = [cash, cardAccount, debtAccount, receivableAccount, usd];

const card: CreditCardProfile = { id: 'card', accountId: cardAccount.id, issuer: 'Galicia', last4: '4009', creditLimitMinor: 500000,
  closingDay: 28, dueDay: 5, active: true, createdAt, revision: 0, updatedAt: createdAt };
const debt: PersonalDebtProfile = { id: 'debt', accountId: debtAccount.id, direction: 'owed_by_me', counterparty: 'Juan',
  dueDateISO: '2026-10-01', note: '', active: true, createdAt, revision: 0, updatedAt: createdAt };
const receivable: PersonalDebtProfile = { ...debt, id: 'receivable', accountId: receivableAccount.id, direction: 'owed_to_me', counterparty: 'Ana', dueDateISO: null };

const purchase: Entry = { id: 'purchase', accountId: cardAccount.id, kind: 'expense', amountMinor: 23100, merchant: 'Starbucks', category: 'Café', dateISO: '2026-09-12', createdAt };
const cashExpense: Entry = { id: 'cash-expense', accountId: cash.id, kind: 'expense', amountMinor: 5000, merchant: 'Kiosco', category: 'Otros', dateISO: '2026-09-13', createdAt };
const payment: Transfer = { id: 'payment', fromAccountId: cash.id, toAccountId: cardAccount.id, amountMinor: 30000, note: 'Pago Visa', dateISO: '2026-09-15', createdAt };
const debtPayment: Transfer = { id: 'debt-payment', fromAccountId: cash.id, toAccountId: debtAccount.id, amountMinor: 10000, note: 'Pago a Juan', dateISO: '2026-09-15', createdAt };
const collection: Transfer = { id: 'collection', fromAccountId: receivableAccount.id, toAccountId: cash.id, amountMinor: 5000, note: 'Cobro de Ana', dateISO: '2026-09-16', createdAt };

const snapshot: LedgerSnapshot = { accounts, entries: [purchase, cashExpense], transfers: [payment, debtPayment, collection] };

describe('credit card accounting', () => {
  it('counts a card purchase as an expense exactly once and increases the card debt', () => {
    const before: LedgerSnapshot = { accounts, entries: [], transfers: [] };
    expect(cardDebtMinor(card, before)).toBe(20000);
    const after: LedgerSnapshot = { accounts, entries: [purchase], transfers: [] };
    expect(cardDebtMinor(card, after)).toBe(43100);
    const overview = spendingOverview(after, { currency: 'ARS', startISO: '2026-09-01', endISO: '2026-09-30' });
    expect(overview.status === 'ready' && overview.expenseMinor).toBe(23100);
    expect(overview.status === 'ready' && overview.expenseCount).toBe(1);
    // Cash is untouched by the purchase itself.
    expect(accountBalanceMinor(cash, after.entries, after.transfers)).toBe(100000);
  });

  it('a card payment lowers cash and card debt without adding a second expense', () => {
    const overview = spendingOverview(snapshot, { currency: 'ARS', startISO: '2026-09-01', endISO: '2026-09-30' });
    expect(overview.status === 'ready' && overview.expenseMinor).toBe(23100 + 5000);
    expect(overview.status === 'ready' && overview.expenseCount).toBe(2);
    expect(cardDebtMinor(card, snapshot)).toBe(20000 + 23100 - 30000);
    expect(accountBalanceMinor(cash, snapshot.entries, snapshot.transfers)).toBe(100000 - 5000 - 30000 - 10000 + 5000);
  });

  it('card purchases consume the category budget; the payment transfer does not', () => {
    const budget: MonthlyBudget = { id: 'b', category: 'Café', currency: 'ARS', monthISO: '2026-09', amountMinor: 50000, active: true, createdAt, revision: 0, updatedAt: createdAt };
    const summary = summarizeMonthlyBudgets(snapshot, [budget], 'ARS', '2026-09');
    expect(summary.rows[0].spentMinor).toBe(23100);
    expect(summary.totalSpentMinor).toBe(28100);
  });

  it('overpaying a card produces a credit in favour, not negative debt', () => {
    const overpaid: LedgerSnapshot = { accounts, entries: [], transfers: [{ ...payment, amountMinor: 25000 }] };
    expect(cardDebtMinor(card, overpaid)).toBe(0);
    expect(cardCreditMinor(card, overpaid)).toBe(5000);
    expect(cardAvailableLimitMinor(card, overpaid)).toBe(500000);
    expect(cardAvailableLimitMinor({ ...card, creditLimitMinor: null }, overpaid)).toBeNull();
  });

  it('Disponible excludes card, debt and receivable accounts while validation still covers every account', () => {
    expect(liquidTotalsByCurrency(snapshot, [card], [debt, receivable])).toEqual({ ARS: 60000, USD: 500 });
    expect(totalsByCurrency(snapshot)).toEqual({ ARS: 60000 + (-13100) + (-20000) + 10000, USD: 500 });
    expect(liquidTotalsByCurrency({ accounts: [cardAccount], entries: [] }, [card], [])).toEqual({});
    expect([...hiddenLiabilityAccountIds([card], [debt])].sort()).toEqual(['card-acc', 'debt-acc']);
    expect(accountKind('card-acc', [card], [debt])).toBe('card');
    expect(accountKind('debt-acc', [card], [debt])).toBe('debt');
    expect(accountKind('cash', [card], [debt])).toBe('cash');
  });
});

describe('personal debts and receivables', () => {
  it('partial payments and collections reduce the outstanding balance and never go below zero', () => {
    expect(debtOutstandingMinor(debt, snapshot)).toBe(20000);
    expect(debtOutstandingMinor(receivable, snapshot)).toBe(10000);
    const settled: LedgerSnapshot = { accounts, entries: [], transfers: [{ ...debtPayment, amountMinor: 30000 }, { ...collection, amountMinor: 15000 }] };
    expect(debtOutstandingMinor(debt, settled)).toBe(0);
    expect(debtOutstandingMinor(receivable, settled)).toBe(0);
    expect(debtOutstandingMinor(debt, { accounts, entries: [], transfers: [{ ...debtPayment, amountMinor: 31000 }] })).toBe(0);
  });

  it('refuses expenses or income posted directly to a debt account', () => {
    expect(() => assertPostingAccount(debtAccount.id, [debt])).toThrow(/pagos o cobros/);
    expect(() => assertPostingAccount(cardAccount.id, [debt])).not.toThrow();
    expect(() => assertPostingAccount(cash.id, [])).not.toThrow();
  });
});

describe('liability validation', () => {
  it('accepts the fixtures and rejects invalid cards and debts', () => {
    validateLiabilityProfiles([card], [debt, receivable], accounts);
    for (const patch of [
      { accountId: 'missing' }, { last4: '40' }, { last4: 'abcd' }, { creditLimitMinor: 0 }, { creditLimitMinor: 1.5 },
      { closingDay: 0 }, { closingDay: 32 }, { dueDay: 1.5 }, { issuer: 'x'.repeat(81) }, { active: 1 }, { revision: -1 },
      { updatedAt: 'later' },
    ]) expect(() => validateCreditCardProfile({ ...card, ...patch } as CreditCardProfile, accounts)).toThrow();
    for (const patch of [
      { accountId: 'missing' }, { direction: 'sideways' }, { counterparty: ' ' }, { dueDateISO: '2026-02-30' },
      { note: 'x'.repeat(121) }, { active: 'yes' }, { revision: 0, updatedAt: '2026-09-02T12:00:00.000Z' },
    ]) expect(() => validatePersonalDebtProfile({ ...debt, ...patch } as PersonalDebtProfile, accounts)).toThrow();
  });

  it('one internal account cannot represent two obligations and IDs stay unique', () => {
    expect(() => validateLiabilityProfiles([card, { ...card, id: 'other' }], [], accounts)).toThrow(/dos obligaciones/);
    expect(() => validateLiabilityProfiles([card], [{ ...debt, accountId: card.accountId }], accounts)).toThrow(/dos obligaciones/);
    expect(() => validateLiabilityProfiles([card], [{ ...debt, id: card.id }], accounts)).toThrow(/repite/);
  });
});

describe('card calendar', () => {
  it('finds the next and previous day of month, clamping short months', () => {
    expect(nextDayOfMonthISO('2026-09-20', 28)).toBe('2026-09-28');
    expect(nextDayOfMonthISO('2026-09-28', 28)).toBe('2026-09-28');
    expect(nextDayOfMonthISO('2026-09-29', 28)).toBe('2026-10-28');
    expect(nextDayOfMonthISO('2026-01-31', 31)).toBe('2026-01-31');
    expect(nextDayOfMonthISO('2026-02-01', 31)).toBe('2026-02-28');
    expect(nextDayOfMonthISO('2028-02-01', 30)).toBe('2028-02-29');
    expect(nextDayOfMonthISO('2026-12-31', 5)).toBe('2027-01-05');
    expect(previousDayOfMonthISO('2026-09-28', 28)).toBe('2026-08-28');
    expect(previousDayOfMonthISO('2026-03-01', 31)).toBe('2026-02-28');
    expect(previousDayOfMonthISO('2027-01-04', 5)).toBe('2026-12-05');
    expect(() => nextDayOfMonthISO('2026-02-30', 5)).toThrow();
    expect(() => nextDayOfMonthISO('2026-02-10', 0)).toThrow();
  });

  it('derives the open statement window and a due date after the closing', () => {
    expect(cardCycle(card, '2026-09-20')).toEqual({ startISO: '2026-08-29', closingISO: '2026-09-28', dueISO: '2026-10-05' });
    expect(cardCycle(card, '2026-09-28')).toEqual({ startISO: '2026-08-29', closingISO: '2026-09-28', dueISO: '2026-10-05' });
    expect(cardCycle(card, '2026-09-29')).toEqual({ startISO: '2026-09-29', closingISO: '2026-10-28', dueISO: '2026-11-05' });
    expect(cardCycle({ closingDay: 31, dueDay: 10 }, '2026-02-10')).toEqual({ startISO: '2026-02-01', closingISO: '2026-02-28', dueISO: '2026-03-10' });
    expect(cardCycle({ closingDay: 10, dueDay: 20 }, '2026-12-15')).toEqual({ startISO: '2026-12-11', closingISO: '2027-01-10', dueISO: '2027-01-20' });
  });

  it('sums only this statement window from the card account, separating purchases, refunds and payments', () => {
    const activity = cardStatementActivity(card, { accounts, entries: [purchase, cashExpense,
      { ...purchase, id: 'old', dateISO: '2026-08-28' }, { ...purchase, id: 'refund', kind: 'income', amountMinor: 100, dateISO: '2026-09-01' }],
    transfers: [payment, { ...payment, id: 'old-payment', dateISO: '2026-08-20' }, debtPayment] }, '2026-09-20');
    expect(activity).toMatchObject({ startISO: '2026-08-29', closingISO: '2026-09-28', purchasesMinor: 23100, purchaseCount: 1,
      refundsMinor: 100, paymentsMinor: 30000, paymentCount: 1 });
  });
});
