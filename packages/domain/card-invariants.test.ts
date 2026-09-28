import { describe, expect, it } from 'vitest';
import { accountBalanceMinor, type Account, type Entry, type LedgerSnapshot, type Transfer } from './ledger';
import { CARD_DEBT_MESSAGE, CARD_DELETED_MESSAGE, accountKind, assertCardDeletable, assertIncomeAccount, assertTransferSides, cardDebtMinor,
  debtTotalsByCurrency, deleteCreditCard, liquidTotalsByCurrency, postingAccountsFor, validateCreditCardProfile, validateLiabilityProfiles,
  type AccountKind, type CreditCardProfile, type PersonalDebtProfile } from './liabilities';
import { summarizeMonthlyBudgets, type MonthlyBudget } from './budgets';
import { summarizeMonth } from './month-summary';
import { spendingReport } from './spending-report';

/** The financial semantics of a credit card, recorded at the close of Producto 25B2 (decision 003,
 * «Invariantes contables de tarjetas»). Each block is one invariant; a change that breaks one is a
 * regression, not a redesign. Instalments (24T) are not modelled yet: 7 covers what exists today. */
const createdAt = '2026-09-01T12:00:00.000Z';
const now = '2026-09-28T10:00:00.000Z';
const bank: Account = { id: 'bank', name: 'Banco', currency: 'ARS', openingMinor: 100000, createdAt };
const wallet: Account = { id: 'wallet', name: 'Billetera', currency: 'ARS', openingMinor: 20000, createdAt };
const cardAccount: Account = { id: 'card-acc', name: 'Visa', currency: 'ARS', openingMinor: 0, createdAt };
const debtAccount: Account = { id: 'debt-acc', name: 'Debo · Juan', currency: 'ARS', openingMinor: -30000, createdAt };
const card: CreditCardProfile = { id: 'card', accountId: cardAccount.id, issuer: 'Banco', last4: '4009', creditLimitMinor: 500000,
  closingDay: 20, dueDay: 5, active: true, deleted: false, createdAt, revision: 0, updatedAt: createdAt };
const debt: PersonalDebtProfile = { id: 'debt', accountId: debtAccount.id, direction: 'owed_by_me', counterparty: 'Juan',
  dueDateISO: null, note: '', active: true, deleted: false, createdAt, revision: 0, updatedAt: createdAt };
const accounts = [bank, wallet, cardAccount, debtAccount];
const purchase: Entry = { id: 'p1', accountId: cardAccount.id, kind: 'expense', amountMinor: 23100, merchant: 'Súper', category: 'Comida', dateISO: '2026-09-10', createdAt };
const payment: Transfer = { id: 't1', fromAccountId: bank.id, toAccountId: cardAccount.id, amountMinor: 23100, note: 'Pago Visa', dateISO: '2026-09-15', createdAt };
const empty: LedgerSnapshot = { accounts, entries: [], transfers: [] };
const bought: LedgerSnapshot = { accounts, entries: [purchase], transfers: [] };
const paid: LedgerSnapshot = { accounts, entries: [purchase], transfers: [payment] };

const expenseOf = (snapshot: LedgerSnapshot) => {
  const report = spendingReport(snapshot, 'ARS', '2026-09', '2026-09-28');
  return report.status === 'ready' ? { minor: report.expenseMinor, count: report.count } : report.status;
};
const monthOf = (snapshot: LedgerSnapshot) => {
  const month = summarizeMonth(snapshot, 'ARS', '2026-09-28');
  return month.status === 'ready' ? { expense: month.expenseMinor, income: month.incomeMinor, count: month.count } : month.status;
};
const balance = (account: Account, snapshot: LedgerSnapshot) => accountBalanceMinor(account, snapshot.entries, snapshot.transfers);

describe('1. a card is not tied to a bank account per purchase', () => {
  it('the profile has no payment or funding account: a payment names its source when it is recorded', () => {
    // Type-level: the profile never grows a link to a cash account.
    type ForbiddenKeys = Extract<keyof CreditCardProfile, `${string}ccount${string}` | `${string}ayment${string}`>;
    const only: ForbiddenKeys extends 'accountId' ? true : never = true;
    expect(only).toBe(true);
    expect(Object.keys(card).filter(key => /account|payment|bank|source/i.test(key))).toEqual(['accountId']);
    // Two purchases on the same card can be paid from two different cash accounts; nothing pre-assigns one.
    const twice: LedgerSnapshot = { accounts, entries: [purchase, { ...purchase, id: 'p2', dateISO: '2026-09-11' }],
      transfers: [{ ...payment, id: 't-bank' }, { ...payment, id: 't-wallet', fromAccountId: wallet.id }] };
    expect(cardDebtMinor(card, twice)).toBe(0);
    expect(balance(bank, twice)).toBe(100000 - 23100);
    expect(balance(wallet, twice)).toBe(20000 - 23100);
  });
});

describe('2. a card purchase', () => {
  it('is recorded exactly once as an expense, raises the card balance due and leaves every cash account alone', () => {
    expect(expenseOf(empty)).toEqual({ minor: 0, count: 0 });
    expect(expenseOf(bought)).toEqual({ minor: 23100, count: 1 });
    expect(monthOf(bought)).toEqual({ expense: 23100, income: 0, count: 1 });
    const budget: MonthlyBudget = { id: 'b', scope: 'total', currency: 'ARS', monthISO: '2026-09', amountMinor: 50000, active: true, createdAt, revision: 0, updatedAt: createdAt };
    expect(summarizeMonthlyBudgets(bought, [budget], 'ARS', '2026-09').totalSpentMinor).toBe(23100);
    expect(cardDebtMinor(card, empty)).toBe(0);
    expect(cardDebtMinor(card, bought)).toBe(23100);
    expect(balance(bank, bought)).toBe(100000);
    expect(balance(wallet, bought)).toBe(20000);
    expect(liquidTotalsByCurrency(bought, [card], [debt])).toEqual(liquidTotalsByCurrency(empty, [card], [debt]));
  });
});

describe('3. paying a card', () => {
  it('is a transfer from a cash account into the card account: cash down, balance due down, no second expense', () => {
    expect(() => assertTransferSides(payment, [card], [debt], accounts)).not.toThrow();
    expect(balance(bank, paid)).toBe(100000 - 23100);
    expect(cardDebtMinor(card, paid)).toBe(0);
    expect(expenseOf(paid)).toEqual(expenseOf(bought));
    expect(monthOf(paid)).toEqual(monthOf(bought));
    expect(liquidTotalsByCurrency(paid, [card], [debt])).toEqual({ ARS: 100000 - 23100 + 20000 });
    // The payment is never modelled as an expense on the cash account, nor as an income on the card.
    expect(() => assertIncomeAccount(cardAccount.id, [card], [debt])).toThrow('Un ingreso se registra en una cuenta normal, no en una tarjeta.');
    expect(() => assertTransferSides({ fromAccountId: cardAccount.id, toAccountId: bank.id }, [card], [debt], accounts)).toThrow('no puede ser el origen');
  });
});

describe('4. a preferred payment account, if it ever exists, is a UX preselection only', () => {
  it('the profile carries none today, and the ledger derives nothing from a card to a cash account', () => {
    const keys: (keyof CreditCardProfile)[] = ['id', 'accountId', 'issuer', 'last4', 'creditLimitMinor', 'closingDay', 'dueDay', 'active', 'deleted', 'createdAt', 'revision', 'updatedAt'];
    expect(Object.keys(card).sort()).toEqual([...keys].sort());
    // A purchase with no payment leaves every cash account exactly as recorded: nothing is imputed.
    expect(accounts.filter(account => accountKind(account.id, [card], [debt]) === 'cash').map(account => balance(account, bought)))
      .toEqual([100000, 20000]);
  });
});

describe('5. personal debts are independent of cards', () => {
  it('the balance due of a card never enters Deudas y cobros, and one account never represents both', () => {
    expect(debtTotalsByCurrency([debt], bought)).toEqual([{ status: 'ready', currency: 'ARS', owedMinor: 30000, receivableMinor: 0 }]);
    expect(debtTotalsByCurrency([], bought)).toEqual([]);
    expect(cardDebtMinor(card, bought)).toBe(23100);
    expect(() => validateLiabilityProfiles([card], [{ ...debt, accountId: cardAccount.id }], accounts)).toThrow('Una cuenta interna no puede representar dos obligaciones.');
    expect(accountKind(cardAccount.id, [card], [debt])).toBe('card');
    expect(accountKind(debtAccount.id, [card], [debt])).toBe('debt');
  });
});

describe('6. no debit card ledger', () => {
  it('the account kinds are cash, card and debt; a debit card would be a cash account, never a fourth ledger', () => {
    const kinds: AccountKind[] = ['cash', 'card', 'debt'];
    const exhaustive: Exclude<AccountKind, 'cash' | 'card' | 'debt'> extends never ? true : never = true;
    expect(exhaustive).toBe(true);
    expect(kinds.map(kind => accountKind(kind === 'cash' ? bank.id : kind === 'card' ? cardAccount.id : debtAccount.id, [card], [debt]))).toEqual(kinds);
    // Money kept in a cash account is liquid and takes expenses and incomes directly.
    expect(postingAccountsFor('income', accounts, [card], [debt]).map(account => account.id)).toEqual(['bank', 'wallet']);
    expect(postingAccountsFor('expense', accounts, [card], [debt]).map(account => account.id)).toEqual(['bank', 'wallet', 'card-acc']);
  });
});

describe('7. lifecycle (what exists before 24T)', () => {
  it('archiving keeps the balance due payable; deleting is refused while a balance is due and allowed at zero; a deleted card takes no payment', () => {
    const archived = { ...card, active: false, revision: 1, updatedAt: now };
    expect(() => validateCreditCardProfile(archived, accounts)).not.toThrow();
    expect(cardDebtMinor(archived, bought)).toBe(23100);
    expect(() => assertTransferSides(payment, [archived], [debt], accounts)).not.toThrow();
    expect(() => assertCardDeletable(card, bought)).toThrow(CARD_DEBT_MESSAGE);
    expect(() => assertCardDeletable(archived, bought)).toThrow(CARD_DEBT_MESSAGE);
    expect(() => assertCardDeletable(card, paid)).not.toThrow();
    const gone = deleteCreditCard(card, now);
    expect(() => assertTransferSides(payment, [gone], [debt], accounts)).toThrow(CARD_DELETED_MESSAGE);
    expect(postingAccountsFor('expense', accounts, [gone], [debt]).map(account => account.id)).toEqual(['bank', 'wallet']);
    // History stays: the purchase and the payment are still read as this card's.
    expect(expenseOf({ ...paid, accounts })).toEqual({ minor: 23100, count: 1 });
    expect(cardDebtMinor(gone, paid)).toBe(0);
  });
});

describe('8. visible copy', () => {
  it('the refusal to delete says «saldo pendiente», never «deuda» (that word is the Deudas y cobros section)', () => {
    expect(CARD_DEBT_MESSAGE).toBe('Esta tarjeta tiene saldo pendiente. Pagalo o archivala; no se puede eliminar.');
    expect(CARD_DEBT_MESSAGE).not.toMatch(/deuda/i);
  });
});
