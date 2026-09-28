import { describe, expect, it } from 'vitest';
import { CARD_PLAN_MESSAGE, INSTALLMENT_DRIFT_MESSAGE, INSTALLMENT_ENTRY_MESSAGE, INSTALLMENT_ID_MESSAGE, MAX_INSTALLMENTS, PLAN_CANCELLED_MESSAGE, PLAN_CHANGE_MESSAGE,
  PLAN_COUNT_MESSAGE, PLAN_CURRENCY_MESSAGE, PLAN_DELETED_MESSAGE, PLAN_FINANCING_MESSAGE, PLAN_HISTORY_MESSAGE, PLAN_PRINCIPAL_MESSAGE, PLAN_SCHEDULE_MESSAGE, PLAN_STATE_MESSAGE,
  PLAN_TOO_SMALL_MESSAGE, assertInstallmentEntryChange, assertInstallmentPlanDeletable, assertNewEntryId, cancelInstallmentPlan, cardCommittedMinor, cardHasPendingInstallments,
  deleteInstallmentPlan, distributeMinor, installmentChargeEntryId, installmentEntries, installmentEntryId, installmentOccurrenceOf, installmentPlanFigures, installmentPlanStatus,
  installmentSchedule, installmentState, materializeInstallmentPlan, newInstallmentPlan, pendingInstallmentPlans, sameInstallmentPlan, statementClosingAfter, statementClosingOnOrAfter,
  statementDueDate, validateInstallmentPlan, validateInstallmentPlanChange, validateInstallmentPlans, type InstallmentPlan } from './installments';
import { MAX_ENTRY_MINOR } from './money';
import { accountBalanceMinor, type Account, type Entry, type LedgerSnapshot, type Transfer } from './ledger';
import { CARD_DEBT_MESSAGE, assertCardDeletable, cardAvailableLimitMinor, cardDebtMinor, debtTotalsByCurrency, deleteCreditCard, liquidTotalsByCurrency, validateLiabilityProfiles,
  type CreditCardProfile, type PersonalDebtProfile } from './liabilities';
import { materializeRecurringRule, pauseRecurringRule, recurringEntryId, recurringOccurrenceOf, type RecurringRule } from './recurring';
import { BACKUP_SCHEMA_V11, BACKUP_SCHEMA_V12, BACKUP_SCHEMA_V8, createRecoveryBackup, initialRecord, makeEntryChange, parsePilotBackup, previewBackupImport, snapshotFromArchive,
  validateArchive, validateEntryChange, type EntryRecord, type LedgerArchive } from './recovery';
import { spendingReport } from './spending-report';
import { summarizeMonth } from './month-summary';
import { summarizeMonthlyBudgets, type MonthlyBudget } from './budgets';

/** Producto 24T1: the instalment engine. A financed purchase is one purchase and one finite plan, never a recurring
 * rule; the principal is recognised instalment by instalment, exactly once, on the statement each one belongs to. */
const createdAt = '2026-09-01T12:00:00.000Z';
const now = '2026-09-28T10:00:00.000Z';
const bank: Account = { id: 'bank', name: 'Banco', currency: 'ARS', openingMinor: 500000, createdAt };
const cardAccount: Account = { id: 'card-acc', name: 'Visa', currency: 'ARS', openingMinor: 0, createdAt };
const card: CreditCardProfile = { id: 'card', accountId: cardAccount.id, issuer: 'Banco', last4: '4009', creditLimitMinor: 1000000, closingDay: 20, dueDay: 5,
  active: true, deleted: false, createdAt, revision: 0, updatedAt: createdAt };
const yenAccount: Account = { id: 'yen-acc', name: 'Visa JPY', currency: 'JPY', openingMinor: 0, createdAt };
const yenCard: CreditCardProfile = { ...card, id: 'yen-card', accountId: yenAccount.id };
const dinarAccount: Account = { id: 'kwd-acc', name: 'Visa KWD', currency: 'KWD', openingMinor: 0, createdAt };
const dinarCard: CreditCardProfile = { ...card, id: 'kwd-card', accountId: dinarAccount.id };
const debtAccount: Account = { id: 'debt-acc', name: 'Debo · Juan', currency: 'ARS', openingMinor: -30000, createdAt };
const debt: PersonalDebtProfile = { id: 'debt', accountId: debtAccount.id, direction: 'owed_by_me', counterparty: 'Juan', dueDateISO: null, note: '',
  active: true, deleted: false, createdAt, revision: 0, updatedAt: createdAt };
const accounts = [bank, cardAccount, yenAccount, dinarAccount, debtAccount];
const cards = [card, yenCard, dinarCard];

/** USD 1.200 in 12 × USD 100, in ARS cents here: 120.000,00 in 12 × 10.000,00, bought 2026-09-10 on a card closing on the 20th. */
const plan = (overrides: Partial<Parameters<typeof newInstallmentPlan>[0]> = {}): InstallmentPlan => newInstallmentPlan({
  id: 'tv', card, cardAccount, merchant: 'Electro', category: 'Hogar', purchaseDateISO: '2026-09-10', principalMinor: 120000 * 100 / 100, count: 12, placement: 'current', createdAt, ...overrides });
const records = (entries: Entry[], voided: string[] = []): EntryRecord[] => entries.map(entry => voided.includes(entry.id) ? { ...initialRecord(entry), revision: 1, voided: true, updatedAt: now } : initialRecord(entry));
const recognise = (item: InstallmentPlan, throughISO: string, known: Entry[] = []): Entry[] => [...known, ...materializeInstallmentPlan(item, card, throughISO, new Set(known.map(entry => entry.id)))];
const monthExpense = (snapshot: LedgerSnapshot, monthISO: string, asOf: string) => { const r = spendingReport(snapshot, 'ARS', monthISO, asOf); return r.status === 'ready' ? r.expenseMinor : r.status; };

describe('exact distribution of the principal', () => {
  it('splits into equal parts and gives the remainder, one unit each, to the first instalments; the parts always sum to the total', () => {
    expect(distributeMinor(120000, 12)).toEqual(Array(12).fill(10000));
    expect(distributeMinor(10000, 3)).toEqual([3334, 3333, 3333]);
    expect(distributeMinor(100, 3)).toEqual([34, 33, 33]);
    expect(distributeMinor(100000, 3)).toEqual([33334, 33333, 33333]);
    expect(distributeMinor(100, 2)).toEqual([50, 50]);
    expect(distributeMinor(1000, 2)).toEqual([500, 500]);
    expect(distributeMinor(5, 1)).toEqual([5]);
    expect(distributeMinor(7, 2)).toEqual([4, 3]);
    expect(distributeMinor(25, 24)).toEqual([2, ...Array(23).fill(1)]);
    for (const [total, count] of [[1, 1], [10000, 3], [99999, 7], [123456789, 12], [1000000001, 24], [MAX_ENTRY_MINOR, 120], [11, 4]]) {
      const parts = distributeMinor(total, count);
      expect(parts.length).toBe(count);
      expect(parts.reduce((sum, part) => sum + BigInt(part), 0n)).toBe(BigInt(total));
      expect(Math.max(...parts) - Math.min(...parts)).toBeLessThanOrEqual(1);
      expect(parts.every(part => part > 0)).toBe(true);
      expect(parts).toEqual([...parts].sort((a, b) => b - a));
    }
  });

  it('refuses a zero, negative, fractional, unsafe or out-of-bound principal, an absurd count, and instalments that would be empty; a financing total may be zero', () => {
    for (const total of [0, -1, 1.5, NaN, Infinity, 2 ** 53, MAX_ENTRY_MINOR + 1]) expect(() => distributeMinor(total, 3)).toThrow(PLAN_PRINCIPAL_MESSAGE);
    for (const count of [0, -1, 1.5, NaN, MAX_INSTALLMENTS + 1, 1000]) expect(() => distributeMinor(1000, count)).toThrow(PLAN_COUNT_MESSAGE);
    expect(() => distributeMinor(1, 2)).toThrow(PLAN_TOO_SMALL_MESSAGE);
    expect(() => distributeMinor(11, 12)).toThrow(PLAN_TOO_SMALL_MESSAGE);
    expect(distributeMinor(0, 3, { allowZero: true })).toEqual([0, 0, 0]);
    expect(distributeMinor(2, 3, { allowZero: true })).toEqual([1, 1, 0]);
    expect(() => distributeMinor(-1, 3, { allowZero: true })).toThrow(PLAN_FINANCING_MESSAGE);
  });
});

describe('the statement calendar', () => {
  it('assigns the first instalment to the current or the next statement, and keeps the closing day across short months, February, leap years and year ends', () => {
    expect(statementClosingOnOrAfter('2026-09-10', 20)).toBe('2026-09-20');
    expect(statementClosingOnOrAfter('2026-09-20', 20)).toBe('2026-09-20');
    expect(statementClosingOnOrAfter('2026-09-21', 20)).toBe('2026-10-20');
    expect(statementClosingOnOrAfter('2026-12-25', 20)).toBe('2027-01-20');
    expect(statementClosingOnOrAfter('2026-02-10', 30)).toBe('2026-02-28');
    expect(statementClosingOnOrAfter('2027-02-28', 29)).toBe('2027-02-28');
    expect(statementClosingOnOrAfter('2028-02-10', 29)).toBe('2028-02-29');
    const closings = (first: string, day: number, count: number) => Array.from({ length: count }, (_, index) => statementClosingAfter(first, day, index));
    expect(closings('2026-01-31', 31, 13)).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30', '2026-05-31', '2026-06-30', '2026-07-31', '2026-08-31', '2026-09-30', '2026-10-31', '2026-11-30', '2026-12-31', '2027-01-31']);
    expect(closings('2028-01-31', 31, 3)).toEqual(['2028-01-31', '2028-02-29', '2028-03-31']);
    expect(closings('2026-11-28', 28, 4)).toEqual(['2026-11-28', '2026-12-28', '2027-01-28', '2027-02-28']);
    expect(closings('2026-01-30', 30, 3)).toEqual(['2026-01-30', '2026-02-28', '2026-03-30']);
    expect(closings('2026-01-29', 29, 3)).toEqual(['2026-01-29', '2026-02-28', '2026-03-29']);
    // Due day before the closing day: the following month; after it: the same month; equal: the next statement's month.
    expect(statementDueDate('2026-09-20', 5)).toBe('2026-10-05');
    expect(statementDueDate('2026-09-05', 20)).toBe('2026-09-20');
    expect(statementDueDate('2026-09-20', 20)).toBe('2026-10-20');
    expect(statementDueDate('2026-12-20', 5)).toBe('2027-01-05');
    expect(statementDueDate('2026-01-31', 31)).toBe('2026-02-28');
    for (const bad of ['2026-02-30', 'hoy', '']) expect(() => statementClosingOnOrAfter(bad, 20)).toThrow('Fecha de cierre inválida.');
    for (const day of [0, 32, 1.5]) expect(() => statementClosingOnOrAfter('2026-09-10', day)).toThrow('Fecha de cierre inválida.');
    expect(() => statementDueDate('2026-09-20', 0)).toThrow('Fecha de vencimiento inválida.');
  });

  it('builds the exact schedule: one statement per instalment, dates only, principals and financing shares summing exactly; a purchase on the closing day is on that statement', () => {
    const current = installmentSchedule(card, '2026-09-10', 'current', 120000, 12);
    expect(current.map(row => row.billingDateISO)).toEqual(['2026-09-20', '2026-10-20', '2026-11-20', '2026-12-20', '2027-01-20', '2027-02-20', '2027-03-20', '2027-04-20', '2027-05-20', '2027-06-20', '2027-07-20', '2027-08-20']);
    expect(current.map(row => row.dueDateISO).slice(0, 5)).toEqual(['2026-10-05', '2026-11-05', '2026-12-05', '2027-01-05', '2027-02-05']);
    expect(current.map(row => row.number)).toEqual(Array.from({ length: 12 }, (_, i) => i + 1));
    expect(current.every(row => row.principalMinor === 10000 && row.financingMinor === 0)).toBe(true);
    const next = installmentSchedule(card, '2026-09-10', 'next', 120000, 12);
    expect(next[0].billingDateISO).toBe('2026-10-20');
    expect(installmentSchedule(card, '2026-09-20', 'current', 100, 1)[0].billingDateISO).toBe('2026-09-20');
    expect(installmentSchedule(card, '2026-09-21', 'current', 100, 1)[0].billingDateISO).toBe('2026-10-20');
    const financed = installmentSchedule(card, '2026-09-10', 'current', 10000, 3, 100);
    expect(financed.map(row => [row.principalMinor, row.financingMinor])).toEqual([[3334, 34], [3333, 33], [3333, 33]]);
    expect(() => installmentSchedule(card, '2026-09-10', 'later' as never, 100, 1)).toThrow(PLAN_SCHEDULE_MESSAGE);
    expect(() => installmentSchedule(card, '2026-13-10', 'current', 100, 1)).toThrow('Elegí una fecha válida.');
  });
});

describe('a plan', () => {
  it('is one purchase on one card in the card’s currency, with explicit financing components and a validated schedule; two identical purchases are two plans', () => {
    const tv = plan();
    expect(tv.currency).toBe('ARS');
    expect(tv.schedule.length).toBe(12);
    expect(tv.principalMinor).toBe(120000);
    expect(tv.interestMinor + tv.feeMinor + tv.taxMinor).toBe(0);
    expect(tv.financingCategory).toBe('');
    expect(() => validateInstallmentPlan(tv, cards, accounts)).not.toThrow();
    const twin = plan({ id: 'tv-2' });
    expect(sameInstallmentPlan(tv, twin)).toBe(false);
    expect(sameInstallmentPlan(tv, { ...tv })).toBe(true);
    expect(installmentEntryId('tv', 1)).not.toBe(installmentEntryId('tv-2', 1));
    // Financing: explicit, never principal; a category is required exactly when there is a charge.
    const financed = plan({ id: 'fin', interestMinor: 600, feeMinor: 300, taxMinor: 300, financingCategory: 'Intereses' });
    expect(financed.schedule.map(row => row.financingMinor)).toEqual(Array(12).fill(100));
    expect(financed.principalMinor).toBe(120000);
    expect(() => plan({ id: 'x', interestMinor: 100 })).toThrow(PLAN_FINANCING_MESSAGE);
    expect(() => plan({ id: 'x', financingCategory: 'Intereses' })).toThrow(PLAN_FINANCING_MESSAGE);
    expect(() => plan({ id: 'x', interestMinor: -1, financingCategory: 'Intereses' })).toThrow(PLAN_FINANCING_MESSAGE);
    // Refusals: the card must exist and hold the plan's currency; the money and count rules of the distribution apply.
    expect(() => validateInstallmentPlan({ ...tv, cardId: 'nope' }, cards, accounts)).toThrow('Una compra en cuotas se registra en una tarjeta de crédito existente.');
    expect(() => validateInstallmentPlan({ ...tv, currency: 'USD' }, cards, accounts)).toThrow(PLAN_CURRENCY_MESSAGE);
    expect(() => plan({ id: 'x', principalMinor: 0 })).toThrow(PLAN_PRINCIPAL_MESSAGE);
    expect(() => plan({ id: 'x', principalMinor: -5 })).toThrow(PLAN_PRINCIPAL_MESSAGE);
    expect(() => plan({ id: 'x', principalMinor: 2 ** 53 })).toThrow(PLAN_PRINCIPAL_MESSAGE);
    expect(() => plan({ id: 'x', count: 0 })).toThrow(PLAN_COUNT_MESSAGE);
    expect(() => plan({ id: 'x', count: 121 })).toThrow(PLAN_COUNT_MESSAGE);
    expect(() => plan({ id: 'x', principalMinor: 5, count: 12 })).toThrow(PLAN_TOO_SMALL_MESSAGE);
    expect(() => plan({ id: 'x', card: { ...card, accountId: 'bank' } })).toThrow('Una compra en cuotas se registra en una tarjeta de crédito existente.');
    // A stored schedule must agree with the plan: count, order, sums, dates after the purchase, positive principals.
    expect(() => validateInstallmentPlan({ ...tv, schedule: tv.schedule.slice(1) }, cards, accounts)).toThrow(PLAN_SCHEDULE_MESSAGE);
    expect(() => validateInstallmentPlan({ ...tv, schedule: tv.schedule.map((row, i) => i ? row : { ...row, principalMinor: 9999 }) }, cards, accounts)).toThrow(PLAN_SCHEDULE_MESSAGE);
    expect(() => validateInstallmentPlan({ ...tv, schedule: [...tv.schedule].reverse().map((row, i) => ({ ...row, number: i + 1 })) }, cards, accounts)).toThrow(PLAN_SCHEDULE_MESSAGE);
    expect(() => validateInstallmentPlan({ ...tv, schedule: tv.schedule.map((row, i) => i ? row : { ...row, billingDateISO: '2026-09-01' }) }, cards, accounts)).toThrow(PLAN_SCHEDULE_MESSAGE);
    expect(() => validateInstallmentPlan({ ...tv, schedule: tv.schedule.map(row => ({ ...row, dueDateISO: row.billingDateISO })) }, cards, accounts)).toThrow(PLAN_SCHEDULE_MESSAGE);
    expect(() => validateInstallmentPlan({ ...tv, deleted: true, cancelledAt: now, revision: 1, updatedAt: now }, cards, accounts)).toThrow(PLAN_STATE_MESSAGE);
    expect(() => validateInstallmentPlan({ ...tv, cancelledAt: now }, cards, accounts)).toThrow(PLAN_STATE_MESSAGE);
    expect(() => validateInstallmentPlan({ ...tv, updatedAt: now }, cards, accounts)).toThrow(PLAN_STATE_MESSAGE);
  });

  it('works in zero- and three-decimal currencies with the same rule', () => {
    const yen = newInstallmentPlan({ id: 'yen', card: yenCard, cardAccount: yenAccount, merchant: 'Konbini', category: 'Comida', purchaseDateISO: '2026-09-10', principalMinor: 100, count: 3, placement: 'current', createdAt });
    expect(yen.currency).toBe('JPY');
    expect(yen.schedule.map(row => row.principalMinor)).toEqual([34, 33, 33]);
    const dinar = newInstallmentPlan({ id: 'kwd', card: dinarCard, cardAccount: dinarAccount, merchant: 'Souq', category: 'Hogar', purchaseDateISO: '2026-09-10', principalMinor: 100000, count: 3, placement: 'current', createdAt });
    expect(dinar.schedule.map(row => row.principalMinor)).toEqual([33334, 33333, 33333]);
    expect(() => newInstallmentPlan({ id: 'x', card: yenCard, cardAccount: yenAccount, merchant: 'Konbini', category: 'Comida', purchaseDateISO: '2026-09-10', principalMinor: 1, count: 2, placement: 'current', createdAt })).toThrow(PLAN_TOO_SMALL_MESSAGE);
    expect(() => validateInstallmentPlan({ ...yen, currency: 'ARS' }, cards, accounts)).toThrow(PLAN_CURRENCY_MESSAGE);
  });
});

describe('recognition: the movements a plan records', () => {
  it('buying records nothing and moves no account; each instalment is one expense on the card, dated on its statement, with a deterministic id; financing is a separate expense in its own category', () => {
    const tv = plan();
    const before: LedgerSnapshot = { accounts, entries: [], transfers: [] };
    expect(materializeInstallmentPlan(tv, card, '2026-09-19', new Set())).toEqual([]);
    expect(accountBalanceMinor(bank, before.entries, before.transfers)).toBe(500000);
    expect(cardDebtMinor(card, before)).toBe(0);
    expect(liquidTotalsByCurrency(before, cards, [debt])).toEqual({ ARS: 500000 });
    const first = materializeInstallmentPlan(tv, card, '2026-09-20', new Set());
    expect(first).toEqual([installmentEntries(tv, card.accountId, tv.schedule[0])[0]]);
    expect(first[0]).toEqual({ id: 'inst_tv_001', accountId: 'card-acc', kind: 'expense', amountMinor: 10000, merchant: 'Electro', category: 'Hogar', dateISO: '2026-09-20', createdAt: '2026-09-20T12:00:00.000Z' });
    const after: LedgerSnapshot = { accounts, entries: first, transfers: [] };
    expect(cardDebtMinor(card, after)).toBe(10000);
    expect(accountBalanceMinor(bank, after.entries, after.transfers)).toBe(500000, 'no cash account moved');
    const financed = plan({ id: 'fin', interestMinor: 1200, financingCategory: 'Intereses' });
    const entries = materializeInstallmentPlan(financed, card, '2026-09-20', new Set());
    expect(entries.map(entry => [entry.id, entry.amountMinor, entry.category])).toEqual([['inst_fin_001', 10000, 'Hogar'], ['instc_fin_001', 100, 'Intereses']]);
    expect(installmentOccurrenceOf('inst_fin_001')).toEqual({ planId: 'fin', number: 1, part: 'principal' });
    expect(installmentOccurrenceOf('instc_fin_001')).toEqual({ planId: 'fin', number: 1, part: 'financing' });
    expect(installmentOccurrenceOf('inst_fin_000')).toBeNull();
    expect(installmentOccurrenceOf('inst_fin_1')).toBeNull();
    expect(installmentOccurrenceOf(recurringEntryId('fin', '2026-09-20'))).toBeNull();
    expect(() => assertNewEntryId('inst_tv_001')).toThrow(INSTALLMENT_ID_MESSAGE);
    expect(() => assertNewEntryId('instc_tv_001')).toThrow(INSTALLMENT_ID_MESSAGE);
    expect(() => assertNewEntryId('e-typed')).not.toThrow();
  });

  it('is idempotent and deterministic: a catch-up run twice, a duplicated invocation, a crash before the write or the app closed across several statements record each instalment exactly once, with its own date', () => {
    const tv = plan();
    let entries = recognise(tv, '2026-09-25');
    expect(entries.map(entry => entry.id)).toEqual(['inst_tv_001']);
    expect(recognise(tv, '2026-09-25', entries).length).toBe(1, 'run again: nothing new');
    expect(materializeInstallmentPlan(tv, card, '2026-09-25', new Set(entries.map(entry => entry.id)))).toEqual([]);
    // The app stays closed from September to January: the four statements that closed meanwhile are recorded with their own dates.
    entries = recognise(tv, '2027-01-25', entries);
    expect(entries.map(entry => entry.dateISO)).toEqual(['2026-09-20', '2026-10-20', '2026-11-20', '2026-12-20', '2027-01-20']);
    // A crash before the write: the same call produces the same entries; after the write, nothing.
    const again = materializeInstallmentPlan(tv, card, '2027-01-25', new Set(entries.slice(0, 2).map(entry => entry.id)));
    expect(again.map(entry => entry.id)).toEqual(['inst_tv_003', 'inst_tv_004', 'inst_tv_005']);
    expect(materializeInstallmentPlan(tv, card, '2027-01-25', new Set(entries.map(entry => entry.id)))).toEqual([]);
    // Through the end of the plan: twelve, no more, whatever the date.
    const all = recognise(tv, '2030-01-01');
    expect(all.length).toBe(12);
    expect(all.reduce((sum, entry) => sum + entry.amountMinor, 0)).toBe(120000);
    expect(recognise(tv, '2030-01-01', all).length).toBe(12);
    expect(() => materializeInstallmentPlan(tv, card, 'ayer', new Set())).toThrow('Fecha de procesamiento inválida.');
  });

  it('derives every state from the ledger and never from the plan: scheduled, recognised, undone (never recreated); the five figures stay distinct and a general payment assigns nothing', () => {
    const tv = plan();
    const entries = recognise(tv, '2026-11-25');
    const stored = records(entries, ['inst_tv_002']);
    expect(tv.schedule.slice(0, 4).map(row => installmentState(tv, row, stored))).toEqual(['recognised', 'undone', 'recognised', 'scheduled']);
    // The undone instalment is not recreated by the catch-up (its id is known), and it counts nowhere.
    expect(materializeInstallmentPlan(tv, card, '2026-11-25', new Set(stored.map(record => record.entry.id)))).toEqual([]);
    const figures = installmentPlanFigures(tv, stored);
    expect(figures).toEqual({ principalMinor: 120000, recognisedMinor: 20000, undoneMinor: 10000, scheduledMinor: 90000, cancelledMinor: 0, remainingMinor: 100000,
      financingRecognisedMinor: 0, recognisedCount: 2, count: 12, status: 'active' });
    // The card's balance due holds only the recognised instalments; the future ones are a commitment beside it.
    const snapshot: LedgerSnapshot = { accounts, entries: snapshotFromArchive({ accounts, records: stored }).entries, transfers: [] };
    expect(cardDebtMinor(card, snapshot)).toBe(20000);
    expect(cardCommittedMinor(card, [tv], stored)).toBe(90000);
    // A payment into the card lowers the balance due and changes no instalment figure: nothing is «paid» per plan.
    const payment: Transfer = { id: 't1', fromAccountId: 'bank', toAccountId: 'card-acc', amountMinor: 15000, note: 'Pago Visa', dateISO: '2026-11-26', createdAt };
    const paid: LedgerSnapshot = { ...snapshot, transfers: [payment] };
    expect(cardDebtMinor(card, paid)).toBe(5000);
    expect(installmentPlanFigures(tv, stored)).toEqual(figures);
    expect(Object.keys(figures)).not.toContain('paidMinor');
    expect(monthExpense(paid, '2026-11', '2026-11-30')).toBe(monthExpense(snapshot, '2026-11', '2026-11-30'), 'a payment is never an expense');
    expect(accountBalanceMinor(bank, paid.entries, paid.transfers)).toBe(500000 - 15000);
    // Restoring the undone movement brings the instalment back.
    const restored = stored.map(record => record.entry.id === 'inst_tv_002' ? { ...record, voided: false, revision: 2 } : record);
    expect(installmentState(tv, tv.schedule[1], restored)).toBe('recognised');
    expect(installmentPlanFigures(tv, restored).remainingMinor).toBe(90000);
    // Completed once every instalment is recognised.
    expect(installmentPlanStatus(tv, records(recognise(tv, '2027-08-20')))).toBe('completed');
    expect(installmentPlanStatus(tv, [])).toBe('active');
  });

  it('counts each recognised instalment exactly once, in its statement’s month and its original category, in reports, the month summary and budgets; a future instalment counts nowhere', () => {
    const tv = plan({ id: 'fin', interestMinor: 1200, financingCategory: 'Intereses' });
    const purchase: Entry = { id: 'p1', accountId: 'card-acc', kind: 'expense', amountMinor: 23100, merchant: 'Súper', category: 'Comida', dateISO: '2026-09-10', createdAt };
    const entries = [purchase, ...recognise(tv, '2026-10-25')];
    const snapshot: LedgerSnapshot = { accounts, entries, transfers: [] };
    // September: the plain purchase plus instalment 1 (statement of 2026-09-20) plus its financing. October: instalment 2. Nothing for November.
    const september = spendingReport(snapshot, 'ARS', '2026-09', '2026-09-30');
    expect(september.status === 'ready' && [september.expenseMinor, september.count]).toEqual([23100 + 10000 + 100, 3]);
    expect(september.categories.map(group => [group.category, group.amountMinor])).toEqual([['Comida', 23100], ['Hogar', 10000], ['Intereses', 100]]);
    expect(monthExpense(snapshot, '2026-10', '2026-10-31')).toBe(10100);
    expect(monthExpense(snapshot, '2026-11', '2026-11-30')).toBe(0);
    const month = summarizeMonth(snapshot, 'ARS', '2026-09-30');
    expect(month.status === 'ready' && month.expenseMinor).toBe(33200);
    const budget: MonthlyBudget = { id: 'b', scope: 'category', category: 'Hogar', currency: 'ARS', monthISO: '2026-09', amountMinor: 50000, active: true, createdAt, revision: 0, updatedAt: createdAt };
    const summary = summarizeMonthlyBudgets(snapshot, [budget], 'ARS', '2026-09');
    expect(summary.totalSpentMinor).toBe(33200);
    expect(summary.rows[0].spentMinor).toBe(10000, 'the principal in its own category, never the interest');
    // The parent purchase never adds the full price: the plan's total is a figure of the plan, not a movement.
    expect(entries.filter(entry => entry.amountMinor === 120000)).toEqual([]);
    expect(entries.filter(entry => installmentOccurrenceOf(entry.id)).reduce((sum, entry) => sum + entry.amountMinor, 0)).toBe(20200);
  });
});

describe('the card lifecycle with plans', () => {
  it('is deleted only with no balance due and no pending plan (one rule, assertCardDeletable); an archived card keeps recording and paying its instalments; a deleted card takes nothing', () => {
    const tv = plan();
    const stored = records(recognise(tv, '2026-09-25'));
    const paidSnapshot: LedgerSnapshot = { accounts, entries: stored.map(record => record.entry), transfers: [{ id: 't', fromAccountId: 'bank', toAccountId: 'card-acc', amountMinor: 10000, note: '', dateISO: '2026-09-26', createdAt }] };
    expect(cardDebtMinor(card, paidSnapshot)).toBe(0);
    expect(() => assertCardDeletable(card, paidSnapshot)).not.toThrow();
    expect(() => assertCardDeletable(card, paidSnapshot, [tv], stored)).toThrow(CARD_PLAN_MESSAGE);
    expect(() => assertCardDeletable(card, { ...paidSnapshot, transfers: [] }, [tv], stored)).toThrow(CARD_DEBT_MESSAGE);
    expect(cardHasPendingInstallments(card, [tv], stored)).toBe(true);
    expect(pendingInstallmentPlans(card, [tv], stored).map(item => item.id)).toEqual(['tv']);
    expect(cardHasPendingInstallments(yenCard, [tv], stored)).toBe(false);
    // Archived: every instalment keeps coming due and the card keeps taking payments.
    const archived = { ...card, active: false, revision: 1, updatedAt: now };
    expect(materializeInstallmentPlan(tv, archived, '2026-10-25', new Set(stored.map(record => record.entry.id))).map(entry => entry.id)).toEqual(['inst_tv_002']);
    expect(() => assertCardDeletable(archived, paidSnapshot, [tv], stored)).toThrow(CARD_PLAN_MESSAGE);
    // Finished and paid: deletable; the finished plan stays with the deleted card.
    const done = records(recognise(tv, '2027-08-20'));
    const settled: LedgerSnapshot = { accounts, entries: done.map(record => record.entry), transfers: [{ id: 't', fromAccountId: 'bank', toAccountId: 'card-acc', amountMinor: 120000, note: '', dateISO: '2027-08-21', createdAt }] };
    expect(cardHasPendingInstallments(card, [tv], done)).toBe(false);
    expect(() => assertCardDeletable(card, settled, [tv], done)).not.toThrow();
    const gone = deleteCreditCard(card, now);
    expect(materializeInstallmentPlan(tv, gone, '2030-01-01', new Set())).toEqual([], 'a deleted card takes no instalment, even one an inconsistent copy left');
    expect(installmentPlanStatus(tv, done)).toBe('completed');
    // An undone instalment keeps the plan pending: the obligation is still open.
    const undone = done.map(record => record.entry.id === 'inst_tv_012' ? { ...record, voided: true, revision: 1 } : record);
    expect(() => assertCardDeletable(card, settled, [tv], undone)).toThrow(CARD_PLAN_MESSAGE);
    // A cancelled plan no longer blocks deletion.
    const cancelled = cancelInstallmentPlan(tv, now);
    expect(() => assertCardDeletable(card, paidSnapshot, [cancelled], stored)).not.toThrow();
  });

  it('leaves the available credit unknown while a plan is pending (the issuer-reservation gate), and answers as before without plans', () => {
    const tv = plan();
    const empty: LedgerSnapshot = { accounts, entries: [], transfers: [] };
    expect(cardAvailableLimitMinor(card, empty)).toBe(1000000);
    expect(cardAvailableLimitMinor(card, empty, [tv], [])).toBeNull();
    expect(cardAvailableLimitMinor(card, empty, [cancelInstallmentPlan(tv, now)], [])).toBe(1000000);
    expect(cardAvailableLimitMinor({ ...card, creditLimitMinor: null }, empty, [tv], [])).toBeNull();
    const done = records(recognise(tv, '2027-08-20'));
    expect(cardAvailableLimitMinor(card, { accounts, entries: done.map(record => record.entry), transfers: [] }, [tv], done)).toBe(1000000 - 120000);
  });
});

describe('the plan lifecycle', () => {
  it('cancels (future instalments stop, recognised ones stay), deletes only without history, never twice, and never changes its price, count or dates through a save', () => {
    const tv = plan();
    const stored = records(recognise(tv, '2026-10-25'));
    const cancelled = cancelInstallmentPlan(tv, now);
    expect([cancelled.cancelledAt, cancelled.revision, cancelled.updatedAt]).toEqual([now, 1, now]);
    expect(() => validateInstallmentPlanChange(tv, cancelled)).not.toThrow();
    expect(materializeInstallmentPlan(cancelled, card, '2030-01-01', new Set())).toEqual([]);
    expect(installmentPlanFigures(cancelled, stored)).toMatchObject({ recognisedMinor: 20000, scheduledMinor: 0, cancelledMinor: 100000, remainingMinor: 100000, status: 'cancelled' });
    expect(() => cancelInstallmentPlan(cancelled, now)).toThrow(PLAN_CANCELLED_MESSAGE);
    expect(() => validateInstallmentPlanChange(cancelled, { ...cancelled, cancelledAt: null, revision: 2 })).toThrow(PLAN_CANCELLED_MESSAGE);
    expect(() => assertInstallmentPlanDeletable(tv, stored)).toThrow(PLAN_HISTORY_MESSAGE);
    expect(() => assertInstallmentPlanDeletable(tv, records(recognise(tv, '2026-09-25'), ['inst_tv_001']))).toThrow(PLAN_HISTORY_MESSAGE);
    expect(() => assertInstallmentPlanDeletable(tv, [])).not.toThrow();
    const gone = deleteInstallmentPlan(tv, now);
    expect([gone.deleted, gone.cancelledAt, gone.revision]).toEqual([true, null, 1]);
    expect(() => deleteInstallmentPlan(gone, now)).toThrow(PLAN_DELETED_MESSAGE);
    expect(() => cancelInstallmentPlan(gone, now)).toThrow(PLAN_DELETED_MESSAGE);
    expect(() => assertInstallmentPlanDeletable(gone, [])).toThrow(PLAN_DELETED_MESSAGE);
    expect(materializeInstallmentPlan(gone, card, '2030-01-01', new Set())).toEqual([]);
    expect(installmentPlanStatus(gone, [])).toBe('deleted');
    // Frozen fields: a refund, an early payoff or an adjustment is a plan operation of its own (24T3), never a rewrite.
    for (const change of [{ principalMinor: 110000 }, { count: 11 }, { merchant: 'Otro' }, { category: 'Otra' }, { cardId: 'yen-card' }, { purchaseDateISO: '2026-09-11' },
      { schedule: tv.schedule.map((row, i) => i ? row : { ...row, billingDateISO: '2026-09-21' }) }, { interestMinor: 1 }]) {
      expect(() => validateInstallmentPlanChange(tv, { ...tv, ...change, revision: 1, updatedAt: now })).toThrow(PLAN_CHANGE_MESSAGE);
    }
    expect(() => validateInstallmentPlanChange(tv, { ...tv, revision: 2, updatedAt: now })).toThrow('El plan de cuotas cambió desde que lo abriste.');
    expect(() => validateInstallmentPlanChange(gone, { ...gone, revision: 2 })).toThrow(PLAN_DELETED_MESSAGE);
    expect(() => cancelInstallmentPlan(tv, 'ayer')).toThrow('Fecha de actualización inválida.');
  });

  it('keeps the schedule and the ledger in step: an instalment movement keeps its amount, date, card and kind (labels and undo are fine), and an archive with a drifted or orphan instalment is refused', () => {
    const tv = plan();
    const [first] = recognise(tv, '2026-09-25');
    expect(() => assertInstallmentEntryChange(first, { ...first, merchant: 'Electro Hogar', category: 'Electrodomésticos' })).not.toThrow();
    for (const change of [{ amountMinor: 9999 }, { dateISO: '2026-09-21' }, { accountId: 'bank' }, { kind: 'income' as const }]) {
      expect(() => assertInstallmentEntryChange(first, { ...first, ...change })).toThrow(INSTALLMENT_ENTRY_MESSAGE);
    }
    const typed: Entry = { ...first, id: 'typed' };
    expect(() => assertInstallmentEntryChange(typed, { ...typed, amountMinor: 1 })).not.toThrow();
    // Undo and restore are ordinary changes of the movement.
    const record = initialRecord(first);
    expect(() => validateEntryChange(makeEntryChange('op', record, 'void', now), accounts)).not.toThrow();
    // The collection guard: the ledger against every plan.
    expect(() => validateInstallmentPlans([tv], cards, accounts, [record])).not.toThrow();
    expect(() => validateInstallmentPlans([tv], cards, accounts, [initialRecord({ ...first, amountMinor: 9999 })])).toThrow(INSTALLMENT_DRIFT_MESSAGE);
    expect(() => validateInstallmentPlans([tv], cards, accounts, [initialRecord({ ...first, dateISO: '2026-09-21' })])).toThrow(INSTALLMENT_DRIFT_MESSAGE);
    expect(() => validateInstallmentPlans([tv], cards, accounts, [initialRecord({ ...first, accountId: 'bank' })])).toThrow(INSTALLMENT_DRIFT_MESSAGE);
    expect(() => validateInstallmentPlans([], cards, accounts, [record])).toThrow(INSTALLMENT_DRIFT_MESSAGE);
    expect(() => validateInstallmentPlans([tv], cards, accounts, [initialRecord({ ...first, id: 'inst_tv_013' })])).toThrow(INSTALLMENT_DRIFT_MESSAGE);
    expect(() => validateInstallmentPlans([tv, tv], cards, accounts, [])).toThrow('La copia repite un plan de cuotas.');
    expect(() => validateArchive({ accounts, records: [record], cards, installmentPlans: [tv] })).not.toThrow();
    expect(() => validateArchive({ accounts, records: [record], cards })).toThrow(INSTALLMENT_DRIFT_MESSAGE);
  });
});

describe('what a plan is not', () => {
  it('is never a recurring rule: the same merchant, amount and date on both are two facts; pausing or deleting the rule touches no instalment and neither catch-up sees the other', () => {
    const tv = plan();
    const rule: RecurringRule = { id: 'tv', accountId: 'card-acc', kind: 'expense', amountMinor: 10000, merchant: 'Electro', category: 'Hogar', frequency: 'monthly',
      anchorDateISO: '2026-09-20', nextDateISO: '2026-09-20', active: true, deleted: false, createdAt, revision: 0, updatedAt: createdAt };
    const fromRule = materializeRecurringRule(rule, accounts, '2026-09-25', now).entries;
    const fromPlan = recognise(tv, '2026-09-25');
    expect(fromRule[0].id).toBe('rec_tv_20260920');
    expect(fromPlan[0].id).toBe('inst_tv_001');
    expect(recurringOccurrenceOf(fromPlan[0].id)).toBeNull();
    expect(installmentOccurrenceOf(fromRule[0].id)).toBeNull();
    // Both in the ledger: two expenses, never deduplicated into one.
    const both: LedgerSnapshot = { accounts, entries: [...fromRule, ...fromPlan], transfers: [] };
    expect(monthExpense(both, '2026-09', '2026-09-30')).toBe(20000);
    expect(cardDebtMinor(card, both)).toBe(20000);
    // The rule's lifecycle is not the plan's.
    const paused = pauseRecurringRule(rule, now);
    expect(materializeRecurringRule(paused, accounts, '2026-10-25', now).entries).toEqual([]);
    expect(recognise(tv, '2026-10-25', fromPlan).length).toBe(2);
    expect(materializeInstallmentPlan(tv, card, '2026-10-25', new Set(fromRule.map(entry => entry.id))).length).toBe(2, 'the rule\'s ids are not the plan\'s');
  });

  it('is never a personal debt: an instalment appears in no debt total, a debt is never part of the card balance, and one account holds one obligation', () => {
    const tv = plan();
    const snapshot: LedgerSnapshot = { accounts, entries: recognise(tv, '2026-10-25'), transfers: [] };
    expect(debtTotalsByCurrency([debt], snapshot)).toEqual([{ status: 'ready', currency: 'ARS', owedMinor: 30000, receivableMinor: 0 }]);
    expect(cardDebtMinor(card, snapshot)).toBe(20000);
    expect(() => validateLiabilityProfiles(cards, [{ ...debt, accountId: 'card-acc' }], accounts)).toThrow('Una cuenta interna no puede representar dos obligaciones.');
    expect(() => validateInstallmentPlan({ ...tv, cardId: 'debt' }, cards, accounts)).toThrow('Una compra en cuotas se registra en una tarjeta de crédito existente.');
    // Settling the debt is a transfer into its account; the plan's figures do not move.
    const settled: LedgerSnapshot = { ...snapshot, transfers: [{ id: 'd', fromAccountId: 'bank', toAccountId: 'debt-acc', amountMinor: 30000, note: '', dateISO: '2026-10-26', createdAt }] };
    expect(debtTotalsByCurrency([debt], settled)[0]).toMatchObject({ owedMinor: 0 });
    expect(installmentPlanFigures(tv, records(settled.entries))).toEqual(installmentPlanFigures(tv, records(snapshot.entries)));
    expect(cardDebtMinor(card, settled)).toBe(20000);
    expect(liquidTotalsByCurrency(settled, cards, [debt])).toEqual({ ARS: 500000 - 30000 });
  });
});

describe('backup v12', () => {
  const tv = plan({ id: 'fin', interestMinor: 1200, financingCategory: 'Intereses' });
  const archive: LedgerArchive = { accounts, records: records(recognise(tv, '2026-10-25')), cards, debts: [debt], installmentPlans: [tv] };

  it('is written as soon as a plan exists, round-trips every plan with its schedule, and stays v11 or older without plans', () => {
    const backup = createRecoveryBackup(archive, new Date(now));
    expect(backup.schema).toBe(BACKUP_SCHEMA_V12);
    expect(backup.installmentPlans).toEqual([tv]);
    expect(backup.cards.every(item => 'deleted' in item)).toBe(true);
    const parsed = parsePilotBackup(JSON.stringify(backup));
    expect(parsed.archive.installmentPlans).toEqual([tv]);
    expect(parsed.archive.records.length).toBe(4);
    expect(installmentPlanFigures(parsed.archive.installmentPlans![0], parsed.archive.records)).toMatchObject({ recognisedMinor: 20000, financingRecognisedMinor: 200 });
    // Without a plan: nothing new in the file.
    expect(createRecoveryBackup({ accounts: [bank], records: [] }, new Date(now)).schema).toBe(BACKUP_SCHEMA_V8);
    const v11 = createRecoveryBackup({ accounts: [bank, cardAccount], records: [], cards: [deleteCreditCard(card, now)] }, new Date(now));
    expect(v11.schema).toBe(BACKUP_SCHEMA_V11);
    expect('installmentPlans' in v11).toBe(false);
    // Import: identical plans count as identical, another version of the same id is a conflict, a new plan is added with its schedule.
    const preview = previewBackupImport(archive, parsed.archive);
    expect([preview.installmentPlans.length, preview.conflicts]).toEqual([0, 0]);
    expect(preview.identical).toBeGreaterThanOrEqual(1);
    const changed = previewBackupImport(archive, { ...parsed.archive, installmentPlans: [cancelInstallmentPlan(tv, now)] });
    expect(changed.conflicts).toBe(1);
    const fresh = previewBackupImport({ accounts, records: [], cards }, parsed.archive);
    expect(fresh.installmentPlans.map(item => item.id)).toEqual(['fin']);
    expect(fresh.records.length).toBe(4);
    expect(fresh.conflicts).toBe(0);
  });

  it('refuses a file that is not v1–v12, a v12 file without its plans key, a plan whose schedule disagrees, an instalment movement without its plan, and a v11 file carrying plans', () => {
    const backup = createRecoveryBackup(archive, new Date(now));
    expect(() => parsePilotBackup(JSON.stringify({ ...backup, schema: 'finanzapp.native-pilot.v13' }))).toThrow('versiones 1 a 12');
    const { installmentPlans: _plans, ...withoutPlans } = backup;
    expect(() => parsePilotBackup(JSON.stringify(withoutPlans))).toThrow('campos faltantes');
    expect(() => parsePilotBackup(JSON.stringify({ ...backup, schema: BACKUP_SCHEMA_V11 }))).toThrow('campos faltantes');
    expect(() => parsePilotBackup(JSON.stringify({ ...backup, installmentPlans: [{ ...tv, schedule: tv.schedule.slice(1) }] }))).toThrow(PLAN_SCHEDULE_MESSAGE);
    expect(() => parsePilotBackup(JSON.stringify({ ...backup, installmentPlans: [{ ...tv, principalMinor: 110000 }] }))).toThrow(PLAN_SCHEDULE_MESSAGE);
    expect(() => parsePilotBackup(JSON.stringify({ ...backup, installmentPlans: [] }))).toThrow(INSTALLMENT_DRIFT_MESSAGE);
    expect(() => parsePilotBackup(JSON.stringify({ ...backup, installmentPlans: [{ ...tv, extra: 1 }] }))).toThrow('campos faltantes');
    expect(() => parsePilotBackup(JSON.stringify({ ...backup, installmentPlans: [{ ...tv, deleted: true, cancelledAt: now, revision: 1, updatedAt: now }] }))).toThrow(PLAN_STATE_MESSAGE);
    expect(() => parsePilotBackup(JSON.stringify({ ...backup, installmentPlans: 'no' }))).toThrow('demasiados planes de cuotas');
  });
});
