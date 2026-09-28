import { describe, expect, it } from 'vitest';
import { accountBalanceMinor, type Account, type Entry, type LedgerSnapshot, type Transfer } from './ledger';
import { CARD_DEBT_MESSAGE, CARD_DELETED_MESSAGE, accountKind, assertCardDeletable, assertIncomeAccount, assertTransferSides, cardDebtMinor,
  debtTotalsByCurrency, deleteCreditCard, liquidTotalsByCurrency, postingAccountsFor, validateCreditCardProfile, validateLiabilityProfiles,
  type AccountKind, type CreditCardProfile, type PersonalDebtProfile } from './liabilities';
import { summarizeMonthlyBudgets, type MonthlyBudget } from './budgets';
import { summarizeMonth } from './month-summary';
import { spendingReport } from './spending-report';
import { CARD_PLAN_MESSAGE, INSTALLMENT_ENTRY_MESSAGE, PLAN_CARD_MESSAGE, PLAN_CHANGE_MESSAGE, PLAN_FINANCING_MESSAGE, PLAN_TOO_SMALL_MESSAGE, assertInstallmentEntryChange, cardCommittedMinor, distributeMinor,
  installmentEntryId, installmentOccurrenceOf, installmentPlanFigures, materializeInstallmentPlan, newInstallmentPlan, validateInstallmentPlan, validateInstallmentPlanChange } from './installments';
import { deleteRecurringRule, materializeRecurringRule, pauseRecurringRule, recurringEntryId, recurringOccurrenceOf, type RecurringRule } from './recurring';
import { initialRecord, type EntryRecord } from './recovery';
import { cardAvailableLimitMinor } from './liabilities';

/** The financial semantics of a credit card, recorded at the close of Producto 25B2 (decision 003,
 * «Invariantes contables de tarjetas»). Each block is one invariant; a change that breaks one is a
 * regression, not a redesign. 2 is a purchase **without** instalments (the full price, one expense, once).
 * 7 pins the lifecycle without plans; 7b is the 24T contract (revised 2026-09-28: the principal is recognised
 * instalment by instalment, never the full price up front), implemented by Producto 24T1. */
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

describe('2. a card purchase without instalments', () => {
  it('is recorded exactly once as an expense for its full price, raises the card balance due and leaves every cash account alone', () => {
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

// Decision 003, rule 7 (revised 2026-09-28), implemented by Producto 24T1 (`installments.ts`): one test per line of the
// contract. The refund/early-payoff operation itself and the foreign-currency record stay for 24T3 and 24C2: here the
// model proves it cannot drift into the states those deliveries will fill.
describe('7b. instalments (Producto 24T1)', () => {
  const tv = newInstallmentPlan({ id: 'tv', card, cardAccount, merchant: 'Electro', category: 'Hogar', purchaseDateISO: '2026-09-10', principalMinor: 120000, count: 12, placement: 'current', createdAt });
  const recognised = (throughISO: string) => materializeInstallmentPlan(tv, card, throughISO, new Set()).map(initialRecord);
  const withPlan = (records: EntryRecord[], transfers: Transfer[] = []): LedgerSnapshot => ({ accounts, entries: records.map(record => record.entry), transfers });

  it('a purchase in instalments is one purchase and one InstallmentPlan, never a RecurringRule', () => {
    expect(tv.count).toBe(12);
    expect(tv.schedule.length).toBe(12);
    expect(Object.keys(tv)).not.toContain('frequency');
    expect(recurringOccurrenceOf(installmentEntryId('tv', 1))).toBeNull();
    expect(installmentOccurrenceOf(recurringEntryId('tv', '2026-09-20'))).toBeNull();
    expect(() => validateInstallmentPlan({ ...tv, cardId: 'debt' }, [card], accounts)).toThrow(PLAN_CARD_MESSAGE);
  });
  it('buying in instalments moves no cash account and does not count the full price as an expense on the purchase date', () => {
    const bought: LedgerSnapshot = withPlan(recognised('2026-09-10'));
    expect(bought.entries).toEqual([]);
    expect(expenseOf(bought)).toEqual({ minor: 0, count: 0 });
    expect([balance(bank, bought), balance(wallet, bought)]).toEqual([100000, 20000]);
    expect(cardDebtMinor(card, bought)).toBe(0);
    expect(liquidTotalsByCurrency(bought, [card], [debt])).toEqual(liquidTotalsByCurrency(empty, [card], [debt]));
  });
  it('each principal instalment counts as an expense in its own period; the parent purchase never adds the full principal again', () => {
    const records = recognised('2026-10-25');
    const snapshot = withPlan(records);
    expect(expenseOf(snapshot)).toEqual({ minor: 10000, count: 1 });
    expect(monthOf(snapshot)).toEqual({ expense: 10000, income: 0, count: 1 });
    const october = spendingReport(snapshot, 'ARS', '2026-10', '2026-10-31');
    expect(october.status === 'ready' && october.expenseMinor).toBe(10000);
    expect(snapshot.entries.some(entry => entry.amountMinor === 120000)).toBe(false);
    expect(installmentPlanFigures(tv, records).recognisedMinor).toBe(20000);
  });
  it('the principal instalments sum exactly to the total principal in minor units (exponents 0, 2 and 3)', () => {
    expect(tv.schedule.reduce((sum, row) => sum + row.principalMinor, 0)).toBe(120000);
    expect(distributeMinor(100, 3)).toEqual([34, 33, 33]);
    expect(distributeMinor(10000, 3)).toEqual([3334, 3333, 3333]);
    expect(distributeMinor(100000, 3)).toEqual([33334, 33333, 33333]);
    expect(() => distributeMinor(1, 2)).toThrow(PLAN_TOO_SMALL_MESSAGE);
  });
  it('interest, fees and financing taxes are recorded separately, never as principal', () => {
    const financed = newInstallmentPlan({ id: 'fin', card, cardAccount, merchant: 'Electro', category: 'Hogar', purchaseDateISO: '2026-09-10', principalMinor: 120000, count: 12,
      placement: 'current', interestMinor: 600, interestCategory: 'Intereses', feeMinor: 300, feeCategory: 'Comisiones', taxMinor: 300, taxCategory: 'Impuestos', createdAt });
    expect(financed.principalMinor).toBe(120000);
    const entries = materializeInstallmentPlan(financed, card, '2026-09-20', new Set());
    expect(entries.map(entry => [entry.category, entry.amountMinor])).toEqual([['Hogar', 10000], ['Intereses', 50], ['Comisiones', 25], ['Impuestos', 25]]);
    expect(() => newInstallmentPlan({ id: 'x', card, cardAccount, merchant: 'E', category: 'H', purchaseDateISO: '2026-09-10', principalMinor: 100, count: 1, placement: 'current', interestMinor: 5, createdAt })).toThrow(PLAN_FINANCING_MESSAGE);
  });
  it('the card balance due holds only the instalments already on a statement; future instalments are separate commitments', () => {
    const records = recognised('2026-10-25');
    expect(cardDebtMinor(card, withPlan(records))).toBe(20000);
    expect(cardCommittedMinor(card, [tv], records)).toBe(100000);
    expect(installmentPlanFigures(tv, records).scheduledMinor).toBe(100000);
  });
  it('purchase price, billed balance due, future committed instalments, plan remaining and already recognised are distinct figures; nothing is «paid» from a general payment', () => {
    const records = recognised('2026-11-25');
    const payment: Transfer = { id: 't', fromAccountId: bank.id, toAccountId: cardAccount.id, amountMinor: 25000, note: 'Pago', dateISO: '2026-11-26', createdAt };
    const figures = installmentPlanFigures(tv, records);
    expect([figures.principalMinor, cardDebtMinor(card, withPlan(records, [payment])), figures.scheduledMinor, figures.remainingMinor, figures.recognisedMinor]).toEqual([120000, 5000, 90000, 90000, 30000]);
    expect(Object.keys(figures)).not.toContain('paidMinor');
    expect(installmentPlanFigures(tv, records)).toEqual(figures);
  });
  it('paying the statement stays a transfer and never a second expense', () => {
    const records = recognised('2026-09-25');
    const payment: Transfer = { id: 't', fromAccountId: bank.id, toAccountId: cardAccount.id, amountMinor: 10000, note: 'Pago', dateISO: '2026-09-26', createdAt };
    expect(() => assertTransferSides(payment, [card], [debt], accounts)).not.toThrow();
    expect(expenseOf(withPlan(records, [payment]))).toEqual(expenseOf(withPlan(records)));
    expect(cardDebtMinor(card, withPlan(records, [payment]))).toBe(0);
    expect(balance(bank, withPlan(records, [payment]))).toBe(100000 - 10000);
  });
  it('available credit with pending plans is not computed until the issuer-reservation gate is decided', () => {
    expect(cardAvailableLimitMinor(card, empty)).toBe(500000);
    expect(cardAvailableLimitMinor(card, empty, [tv], [])).toBeNull();
  });
  it('archiving keeps every plan payable; deleting is refused with a balance due or any pending plan; a deleted card keeps its finished plans', () => {
    const records = recognised('2026-09-25');
    const paid: Transfer = { id: 't', fromAccountId: bank.id, toAccountId: cardAccount.id, amountMinor: 10000, note: 'Pago', dateISO: '2026-09-26', createdAt };
    const archived = { ...card, active: false, revision: 1, updatedAt: now };
    expect(materializeInstallmentPlan(tv, archived, '2026-10-25', new Set(records.map(record => record.entry.id))).length).toBe(1);
    expect(() => assertTransferSides(paid, [archived], [debt], accounts)).not.toThrow();
    expect(() => assertCardDeletable(card, withPlan(records), [tv], records)).toThrow(CARD_DEBT_MESSAGE);
    expect(() => assertCardDeletable(card, withPlan(records, [paid]), [tv], records)).toThrow(CARD_PLAN_MESSAGE);
    const done = recognised('2027-08-20');
    const settled: Transfer = { ...paid, amountMinor: 120000 };
    expect(() => assertCardDeletable(card, withPlan(done, [settled]), [tv], done)).not.toThrow();
    const gone = deleteCreditCard(card, now);
    expect(materializeInstallmentPlan(tv, gone, '2030-01-01', new Set())).toEqual([]);
    expect(installmentPlanFigures(tv, done).status).toBe('completed');
  });
  it('pausing or deleting a recurring rule never touches an instalment plan', () => {
    const rule: RecurringRule = { id: 'tv', accountId: cardAccount.id, kind: 'expense', amountMinor: 10000, merchant: 'Electro', category: 'Hogar', frequency: 'monthly',
      anchorDateISO: '2026-09-20', nextDateISO: '2026-09-20', active: true, deleted: false, createdAt, revision: 0, updatedAt: createdAt };
    const known = new Set(materializeRecurringRule(rule, accounts, '2026-09-25', now).entries.map(entry => entry.id));
    expect(materializeInstallmentPlan(tv, card, '2026-09-25', known).map(entry => entry.id)).toEqual(['inst_tv_001']);
    for (const changed of [pauseRecurringRule(rule, now), deleteRecurringRule(rule, now)]) {
      expect(changed.id).toBe(tv.id);
      expect(materializeInstallmentPlan(tv, card, '2026-09-25', new Set()).length).toBe(1);
    }
  });
  it('a refund or an early payment is tied to the original purchase/plan and never duplicates an expense; a partial refund keeps the rest (24T3 fills the operation; the model refuses any other path)', () => {
    for (const change of [{ principalMinor: 100000 }, { count: 10 }, { schedule: tv.schedule.slice(0, 11) }]) {
      expect(() => validateInstallmentPlanChange(tv, { ...tv, ...change, revision: 1, updatedAt: now })).toThrow(PLAN_CHANGE_MESSAGE);
    }
    const [first] = materializeInstallmentPlan(tv, card, '2026-09-20', new Set());
    expect(() => assertInstallmentEntryChange(first, { ...first, amountMinor: 5000 })).toThrow(INSTALLMENT_ENTRY_MESSAGE);
    expect(() => assertIncomeAccount(cardAccount.id, [card], [debt])).toThrow('Un ingreso se registra en una cuenta normal, no en una tarjeta.');
  });
  it.todo('a foreign-currency plan keeps purchase, billing and paying currencies, the exact debited and credited amounts, and the rate/fees with provenance (24C2; a 24T1 plan is same-currency: PLAN_CURRENCY_MESSAGE)');
});

describe('8. visible copy', () => {
  it('the refusal to delete says «saldo pendiente», never «deuda» (that word is the Deudas y cobros section)', () => {
    expect(CARD_DEBT_MESSAGE).toBe('Esta tarjeta tiene saldo pendiente. Pagalo o archivala; no se puede eliminar.');
    expect(CARD_DEBT_MESSAGE).not.toMatch(/deuda/i);
  });
});
