import { describe, expect, it } from 'vitest';
import { accountBalanceMinor, createPilotBackup, deleteAccount, PROJECTED_ENTRY_MESSAGE, type Account, type Entry, type Transfer } from './ledger';
import { CARD_CREDIT_MESSAGE, CARD_DELETED_MESSAGE, assertCardDeletable, cardCreditMinor, cardDebtMinor, cardStatementActivity, deleteCreditCard,
  type CreditCardProfile, type PersonalDebtProfile } from './liabilities';
import { CARD_PLAN_MESSAGE, PLAN_CANCELLED_MESSAGE, PLAN_DELETED_MESSAGE, PLAN_HISTORY_MESSAGE, assertInstallmentPlanCancellable, assertInstallmentPlanDeletable, cancelInstallmentPlan,
  cardCommittedFinancingMinor, cardCommittedMinor, effectiveShares, installmentEntryId, installmentPlanFigures, installmentPlanStatus, newInstallmentPlan,
  pendingInstallmentPlans, planCatchUpInserts, reactivateInstallmentPlan, validateInstallmentPlanChange, INSTALLMENT_COMPONENTS, type InstallmentPlan } from './installments';
import { BACKUP_SCHEMA_V12, BACKUP_SCHEMA_V13, BACKUP_SCHEMA_V14, applyNewOperation, applyOperationChange, createRecoveryBackup, initialRecord, parsePilotBackup,
  previewBackupImport, snapshotFromArchive, validateArchive, type EntryRecord, type LedgerArchive } from './recovery';
import { OPERATION_ACCOUNT_DELETED_MESSAGE, OPERATION_CHANGED_MESSAGE, OPERATION_EXISTS_MESSAGE, OPERATION_HISTORY_DELETED_MESSAGE, OPERATION_ID_MESSAGE,
  OPERATION_IMPORT_MESSAGE, OPERATION_INVALID_MESSAGE, OPERATION_PLAN_STOPPED_MESSAGE, OPERATION_STATE_MESSAGE, OPERATION_TARGET_MESSAGE, PAYOFF_DATE_MESSAGE,
  PAYOFF_FINANCING_MESSAGE, PAYOFF_NOTHING_MESSAGE, PAYOFF_PRINCIPAL_MESSAGE, PLAN_NOT_CANCELLED_MESSAGE, PLAN_NOTHING_TO_STOP_MESSAGE, PLAN_OPERATION_DATE_MESSAGE,
  PLAN_OPERATION_HISTORY_MESSAGE, REFUND_AMOUNT_MESSAGE, REFUND_DATE_MESSAGE, REFUND_OVER_MESSAGE, REFUND_TARGET_MESSAGE, assertExpectedAllocation, entryRefundSummary,
  isPurchaseLine, makeOperationChange, newEntryRefund, newPlanPayoff, newPlanRefund, operationFromRow, operationGuardMessage, operationToRow, planOperationFloorISO,
  planRefundAvailability, projectOperationLines, sameOperationAllocation, sameOperationInputs, validateOperationChange, validatePurchaseOperation,
  type EntryRefund, type PayoffFinancing, type PlanPayoff, type PlanRefund, type PurchaseOperation } from './operations';
import { spendingReport } from './spending-report';
import { summarizeMonth } from './month-summary';

/** Producto 24T3: devoluciones (refunds) and adelantos de cuotas (early payoffs) as purchase operations, projected into the
 * ledger. Fixtures are synthetic. A card closing on the 20th; a TV of 1.200,00 in 12 × 100,00 bought 2026-01-10, so its
 * instalments close on the 20th of every month of 2026. */
const T0 = '2026-01-01T12:00:00.000Z';
const at = (date: string) => `${date}T15:00:00.000Z`;
const bank: Account = { id: 'bank', name: 'Banco', currency: 'ARS', openingMinor: 500000, createdAt: T0 };
const wallet: Account = { id: 'wallet', name: 'Billetera', currency: 'ARS', openingMinor: 0, createdAt: T0 };
const cardAccount: Account = { id: 'card-acc', name: 'Visa', currency: 'ARS', openingMinor: 0, createdAt: T0 };
const usd: Account = { id: 'usd', name: 'Dólares', currency: 'USD', openingMinor: 100000, createdAt: T0 };
const debtAccount: Account = { id: 'debt-acc', name: 'Debo · Juan', currency: 'ARS', openingMinor: -30000, createdAt: T0 };
const card: CreditCardProfile = { id: 'card', accountId: cardAccount.id, issuer: 'Banco', last4: '4009', creditLimitMinor: 1000000, closingDay: 20, dueDay: 5,
  active: true, deleted: false, createdAt: T0, revision: 0, updatedAt: T0 };
const debt: PersonalDebtProfile = { id: 'debt', accountId: debtAccount.id, direction: 'owed_by_me', counterparty: 'Juan', dueDateISO: null, note: '',
  active: true, deleted: false, createdAt: T0, revision: 0, updatedAt: T0 };
const tv: InstallmentPlan = newInstallmentPlan({ id: 'tv', card, cardAccount, merchant: 'Electro', category: 'Hogar', purchaseDateISO: '2026-01-10',
  principalMinor: 120000, count: 12, placement: 'current', createdAt: at('2026-01-10') });
const fin: InstallmentPlan = newInstallmentPlan({ id: 'fin', card, cardAccount, merchant: 'Electro', category: 'Hogar', purchaseDateISO: '2026-01-10',
  principalMinor: 120000, count: 12, placement: 'current', interestMinor: 1200, interestCategory: 'Intereses', createdAt: at('2026-01-10') });
const expense = (id: string, accountId: string, amountMinor: number, dateISO: string, category = 'Hogar', merchant = 'Ferretería'): Entry =>
  ({ id, accountId, kind: 'expense', amountMinor, merchant, category, dateISO, createdAt: at(dateISO) });
const base = (extra: Partial<LedgerArchive> = {}): LedgerArchive =>
  ({ accounts: [bank, wallet, cardAccount, usd, debtAccount], records: [], cards: [card], debts: [debt], installmentPlans: [], ...extra });

let sequence = 0;
const uid = () => `op-${++sequence}`;
function catchUp(archive: LedgerArchive, todayISO: string): LedgerArchive {
  let next = archive;
  for (const plan of archive.installmentPlans ?? []) next = { ...next, records: [...next.records, ...planCatchUpInserts(next, plan.id, todayISO)] };
  validateArchive(next);
  return next;
}
function refundEntry(archive: LedgerArchive, entryId: string, amountMinor: number, dateISO: string, todayISO = dateISO) {
  const op = newEntryRefund(archive, { id: uid(), entryId, amountMinor, dateISO, todayISO, createdAt: at(todayISO) });
  return { archive: applyNewOperation(archive, op, todayISO), op };
}
function refundPlan(archive: LedgerArchive, planId: string, amountMinor: number, dateISO: string, todayISO = dateISO) {
  const caught = catchUp(archive, todayISO);
  const op = newPlanRefund(caught, { id: uid(), planId, amountMinor, dateISO, todayISO, createdAt: at(todayISO) });
  return { archive: applyNewOperation(caught, op, todayISO), op };
}
function payoff(archive: LedgerArchive, planId: string, financing: PayoffFinancing, dateISO: string, todayISO = dateISO) {
  const caught = catchUp(archive, todayISO);
  const op = newPlanPayoff(caught, { id: uid(), planId, financing, dateISO, todayISO, createdAt: at(todayISO) });
  return { archive: applyNewOperation(caught, op, todayISO), op };
}
function change(archive: LedgerArchive, operationId: string, action: 'void' | 'restore', todayISO: string) {
  const op = archive.purchaseOperations!.find(item => item.id === operationId)!;
  return applyOperationChange(archive, makeOperationChange(uid(), op, action, at(todayISO)), todayISO);
}
const undo = (archive: LedgerArchive, id: string, todayISO: string) => change(archive, id, 'void', todayISO).archive;
const restore = (archive: LedgerArchive, id: string, todayISO: string) => change(archive, id, 'restore', todayISO).archive;
/** A movement edited, undone or restored like storage's changeEntry: one revision on, then the whole archive validated. */
function editRecord(archive: LedgerArchive, entryId: string, edit: (record: EntryRecord) => Partial<EntryRecord>, context: 'edit' | 'void' | 'restore' = 'edit'): LedgerArchive {
  const next = { ...archive, records: archive.records.map(record => record.entry.id === entryId
    ? { ...record, ...edit(record), revision: record.revision + 1, updatedAt: at('2026-12-31') } : record) };
  validateArchive(next, context);
  return next;
}
const voidRecord = (archive: LedgerArchive, entryId: string) => editRecord(archive, entryId, () => ({ voided: true }), 'void');
const restoreRecord = (archive: LedgerArchive, entryId: string) => editRecord(archive, entryId, () => ({ voided: false }), 'restore');
const withRecords = (archive: LedgerArchive, ...entries: Entry[]) => ({ ...archive, records: [...archive.records, ...entries.map(initialRecord)] });
const withTransfer = (archive: LedgerArchive, transfer: Transfer): LedgerArchive =>
  ({ ...archive, transfers: [...archive.transfers ?? [], { transfer, revision: 0, voided: false, updatedAt: transfer.createdAt }] });
const payment = (amountMinor: number, dateISO: string, id = 'pay-' + dateISO): Transfer =>
  ({ id, fromAccountId: bank.id, toAccountId: cardAccount.id, amountMinor, note: 'Pago Visa', dateISO, createdAt: at(dateISO) });
const balance = (archive: LedgerArchive, account: Account) => { const s = snapshotFromArchive(archive); return accountBalanceMinor(account, s.entries, s.transfers); };
const monthExpense = (archive: LedgerArchive, monthISO: string, currency: 'ARS' | 'USD' = 'ARS') => {
  const report = spendingReport(snapshotFromArchive(archive), currency, monthISO, '2027-12-31');
  return report.status === 'ready' ? report.expenseMinor : null;
};
const categoryOf = (archive: LedgerArchive, monthISO: string, category: string) => {
  const report = spendingReport(snapshotFromArchive(archive), 'ARS', monthISO, '2027-12-31');
  return report.status === 'ready' ? report.categories.find(group => group.category === category)?.amountMinor ?? 0 : null;
};
const incomeOf = (archive: LedgerArchive, monthEndISO: string) => { const month = summarizeMonth(snapshotFromArchive(archive), 'ARS', monthEndISO); return month.status === 'ready' ? month.incomeMinor : null; };
const figures = (archive: LedgerArchive, plan: InstallmentPlan = archive.installmentPlans![0]) => installmentPlanFigures(plan, archive.records, archive.purchaseOperations ?? []);
const plain = (plan: InstallmentPlan = tv) => base({ installmentPlans: [plan] });
const ops = (archive: LedgerArchive) => archive.purchaseOperations ?? [];

describe('A. a devolución of an ordinary expense', () => {
  const bought = withRecords(base(), expense('p1', 'bank', 30000, '2026-03-05'));

  it('cash, partial then full: credits the account, nets out of that month and category, never reaches income, and refuses an over-refund', () => {
    const first = refundEntry(bought, 'p1', 10000, '2026-03-10');
    const line = snapshotFromArchive(first.archive).entries.find(entry => entry.id === first.op.id)!;
    expect(line).toEqual({ id: first.op.id, accountId: 'bank', kind: 'expense', amountMinor: -10000, merchant: 'Ferretería', category: 'Hogar', dateISO: '2026-03-10',
      createdAt: at('2026-03-10'), refund: { operationId: first.op.id, targetEntryId: 'p1' } });
    expect(balance(first.archive, bank)).toBe(500000 - 30000 + 10000);
    expect([monthExpense(first.archive, '2026-03'), categoryOf(first.archive, '2026-03', 'Hogar'), incomeOf(first.archive, '2026-03-31')]).toEqual([20000, 20000, 0]);
    expect(entryRefundSummary(first.archive, 'p1')).toMatchObject({ refundedMinor: 10000, availableMinor: 20000 });
    const full = refundEntry(first.archive, 'p1', 20000, '2026-03-12');
    expect([balance(full.archive, bank), monthExpense(full.archive, '2026-03'), incomeOf(full.archive, '2026-03-31')]).toEqual([500000, 0, 0]);
    expect(entryRefundSummary(full.archive, 'p1').availableMinor).toBe(0);
    expect(() => refundEntry(full.archive, 'p1', 1, '2026-03-12')).toThrow(REFUND_OVER_MESSAGE);
    expect(() => refundEntry(bought, 'p1', 30001, '2026-03-12')).toThrow(REFUND_OVER_MESSAGE);
    for (const amount of [0, -5, 1.5, NaN, 2 ** 53]) expect(() => refundEntry(bought, 'p1', amount, '2026-03-12')).toThrow(REFUND_AMOUNT_MESSAGE);
  });

  it('a card purchase without instalments, partial then full: the balance due goes down; after the card was paid it becomes a credit in the holder’s favour', () => {
    const onCard = withRecords(base(), expense('c1', 'card-acc', 50000, '2026-03-05', 'Ropa', 'Tienda'));
    const partial = refundEntry(onCard, 'c1', 20000, '2026-03-08');
    expect([cardDebtMinor(card, snapshotFromArchive(partial.archive)), monthExpense(partial.archive, '2026-03'), incomeOf(partial.archive, '2026-03-31')]).toEqual([30000, 30000, 0]);
    const full = refundEntry(partial.archive, 'c1', 30000, '2026-03-09');
    expect([cardDebtMinor(card, snapshotFromArchive(full.archive)), cardCreditMinor(card, snapshotFromArchive(full.archive)), monthExpense(full.archive, '2026-03')]).toEqual([0, 0, 0]);
    // Paid first, refunded later: a credit, and the card is archived rather than deleted (B3).
    const paid = withTransfer(onCard, payment(50000, '2026-03-06'));
    const refunded = refundEntry(paid, 'c1', 20000, '2026-03-10').archive;
    const snapshot = snapshotFromArchive(refunded);
    expect([cardDebtMinor(card, snapshot), cardCreditMinor(card, snapshot)]).toEqual([0, 20000]);
    expect(() => assertCardDeletable(card, snapshot, [], refunded.records, ops(refunded))).toThrow(CARD_CREDIT_MESSAGE);
    // A19: the open cycle counts the purchase once, the payment as a payment and the devolución as a refund, never a purchase.
    expect(cardStatementActivity(card, snapshot, '2026-03-10')).toMatchObject({ purchasesMinor: 50000, purchaseCount: 1, refundsMinor: 20000, paymentsMinor: 50000, financingMinor: 0 });
    // An archived card still takes the devolución of its own purchase (a refund lowers an obligation, it is not a new one).
    const archived = { ...onCard, cards: [{ ...card, active: false, revision: 1, updatedAt: at('2026-03-07') }] };
    expect(() => refundEntry(archived, 'c1', 1000, '2026-03-08')).not.toThrow();
  });

  it('counts in its own month and in the purchase’s category, resolved at read time (an edit of the purchase moves it)', () => {
    const february = withRecords(base(), expense('p2', 'bank', 30000, '2026-02-25'));
    const { archive, op } = refundEntry(february, 'p2', 10000, '2026-03-02');
    expect([monthExpense(archive, '2026-02'), monthExpense(archive, '2026-03'), categoryOf(archive, '2026-03', 'Hogar')]).toEqual([30000, -10000, -10000]);
    const recategorised = editRecord(archive, 'p2', record => ({ entry: { ...record.entry, category: 'Casa', merchant: 'Corralón' } }));
    expect(snapshotFromArchive(recategorised).entries.find(entry => entry.id === op.id)).toMatchObject({ category: 'Casa', merchant: 'Corralón', amountMinor: -10000 });
    expect([categoryOf(recategorised, '2026-03', 'Casa'), categoryOf(recategorised, '2026-03', 'Hogar')]).toEqual([-10000, 0]);
  });

  it('is idempotent by its form id at the domain level: the same id twice is refused, a retry with the same inputs is recognised, another form id counts against the cap', () => {
    const { archive, op } = refundEntry(bought, 'p1', 30000, '2026-03-10');
    expect(() => applyNewOperation(archive, op, '2026-03-10')).toThrow(OPERATION_EXISTS_MESSAGE);
    expect(() => newEntryRefund(archive, { id: op.id, entryId: 'p1', amountMinor: 30000, dateISO: '2026-03-10', todayISO: '2026-03-10', createdAt: op.createdAt })).toThrow(OPERATION_EXISTS_MESSAGE);
    expect(sameOperationInputs(op, { ...op })).toBe(true);
    expect(sameOperationInputs(op, { ...op, amountMinor: 20000 })).toBe(false);
    expect(sameOperationInputs(op, { ...op, dateISO: '2026-03-11' })).toBe(false);
    expect(sameOperationInputs({ ...op, voided: true, revision: 1 }, op)).toBe(false);
    // A second form (another UUID) after a refresh failure meets the cap: no double devolución.
    expect(() => refundEntry(archive, 'p1', 30000, '2026-03-10')).toThrow(REFUND_OVER_MESSAGE);
    expect(sameOperationAllocation(op, { ...op })).toBe(true);
  });

  it('keeps its purchase: undoing, lowering, flipping to income, moving the date after it or moving it to another account is refused while a devolución lives (A10)', () => {
    const { archive, op } = refundEntry(bought, 'p1', 10000, '2026-03-10');
    const linked = operationGuardMessage('refund-link');
    expect(linked).toBe('Esta compra tiene devoluciones registradas. Deshacelas primero.');
    expect(() => voidRecord(archive, 'p1')).toThrow(linked);
    expect(() => editRecord(archive, 'p1', record => ({ entry: { ...record.entry, amountMinor: 9999 } }))).toThrow(linked);
    expect(() => editRecord(archive, 'p1', record => ({ entry: { ...record.entry, kind: 'income' } }))).toThrow(linked);
    expect(() => editRecord(archive, 'p1', record => ({ entry: { ...record.entry, dateISO: '2026-03-11' } }))).toThrow(linked);
    expect(() => editRecord(archive, 'p1', record => ({ entry: { ...record.entry, accountId: 'wallet' } }))).toThrow(linked);
    expect(() => editRecord(archive, 'p1', record => ({ entry: { ...record.entry, amountMinor: 10000, merchant: 'Otro' } }))).not.toThrow();
    // Undone, the purchase is free again; a restore of the devolución onto an undone purchase names the restore.
    const free = voidRecord(undo(archive, op.id, '2026-03-11'), 'p1');
    expect(() => restore(free, op.id, '2026-03-12')).toThrow('La compra de esta devolución cambió o se deshizo; no se puede restaurar.');
    expect(operationGuardMessage('refund-link', 'import')).toBe(OPERATION_IMPORT_MESSAGE);
  });

  it('targets only a live stored expense that is not an instalment, dated between the purchase and today', () => {
    const plan = catchUp(withRecords(plain(), expense('p1', 'bank', 30000, '2026-03-05'), { ...expense('i1', 'bank', 1000, '2026-03-05'), kind: 'income' }), '2026-03-10');
    expect(() => refundEntry(plan, installmentEntryId('tv', 1), 1000, '2026-03-10')).toThrow(REFUND_TARGET_MESSAGE);
    expect(() => refundEntry(plan, 'i1', 100, '2026-03-10')).toThrow(REFUND_TARGET_MESSAGE);
    expect(() => refundEntry(plan, 'nope', 100, '2026-03-10')).toThrow(REFUND_TARGET_MESSAGE);
    expect(() => refundEntry(voidRecord(plan, 'p1'), 'p1', 100, '2026-03-10')).toThrow(REFUND_TARGET_MESSAGE);
    expect(() => refundEntry(plan, 'p1', 100, '2026-03-04', '2026-03-10')).toThrow(REFUND_DATE_MESSAGE);
    expect(() => refundEntry(plan, 'p1', 100, '2026-03-11', '2026-03-10')).toThrow(REFUND_DATE_MESSAGE);
    expect(() => refundEntry(plan, 'p1', 100, '2026-03-05', '2026-03-10')).not.toThrow();
  });

  it('a deleted account takes no new devolución, and undo or restore never rewrites its history (A9)', () => {
    const onWallet = withRecords(base(), expense('w1', 'wallet', 5000, '2026-03-05'));
    const { archive, op } = refundEntry(onWallet, 'w1', 2000, '2026-03-06');
    const gone = { ...archive, accounts: archive.accounts.map(account => account.id === 'wallet' ? deleteAccount(account, at('2026-03-07')) : account) };
    validateArchive(gone); // a deletion is never an archive conflict (A7)
    expect(() => refundEntry(gone, 'w1', 1000, '2026-03-08')).toThrow(OPERATION_ACCOUNT_DELETED_MESSAGE);
    expect(() => undo(gone, op.id, '2026-03-08')).toThrow(OPERATION_HISTORY_DELETED_MESSAGE);
  });

  it('undo and restore toggle the line, one revision at a time; a stale or repeated change is refused', () => {
    const { archive, op } = refundEntry(bought, 'p1', 10000, '2026-03-10');
    const undone = undo(archive, op.id, '2026-03-11');
    expect(snapshotFromArchive(undone).entries.some(entry => entry.id === op.id)).toBe(false);
    expect(ops(undone)[0]).toMatchObject({ voided: true, revision: 1, updatedAt: at('2026-03-11') });
    expect(monthExpense(undone, '2026-03')).toBe(30000);
    const back = restore(undone, op.id, '2026-03-12');
    expect(ops(back)[0]).toMatchObject({ voided: false, revision: 2 });
    expect(monthExpense(back, '2026-03')).toBe(20000);
    expect(() => makeOperationChange('c', op, 'restore', at('2026-03-12'))).toThrow(OPERATION_STATE_MESSAGE);
    expect(() => applyOperationChange(undone, makeOperationChange('c', op, 'void', at('2026-03-12')), '2026-03-12')).toThrow(OPERATION_STATE_MESSAGE);
    const changeRecord = makeOperationChange('c', op, 'void', at('2026-03-12'));
    expect(() => validateOperationChange(changeRecord)).not.toThrow();
    expect(() => validateOperationChange({ ...changeRecord, after: { ...changeRecord.after, amountMinor: 1 } })).toThrow(OPERATION_STATE_MESSAGE);
  });
});

describe('B. a devolución of an instalment plan (principal): recognised first, then the tail (B2)', () => {
  it('before the first instalment is recognised: no credit, the last instalments go down and are never recorded, and the plan still totals the price minus the devolución', () => {
    const { archive, op } = refundPlan(plain(), 'tv', 15000, '2026-01-15');
    expect([op.creditMinor, op.reductions]).toEqual([0, [{ number: 11, minor: 5000 }, { number: 12, minor: 10000 }]]);
    expect(snapshotFromArchive(archive).entries).toEqual([]);
    expect(figures(archive)).toMatchObject({ refundedMinor: 15000, refundedCreditMinor: 0, refundedFutureMinor: 15000, scheduledMinor: 105000, remainingMinor: 105000, status: 'active' });
    expect(cardCommittedMinor(card, [tv], archive.records, ops(archive))).toBe(105000);
    const shares = effectiveShares(tv, archive.records, ops(archive));
    expect(shares.slice(10).map(share => [share.number, share.amountMinor, share.reducedMinor, share.state])).toEqual([[11, 5000, 5000, 'scheduled'], [12, 0, 10000, 'refunded']]);
    const year = catchUp(archive, '2027-01-01');
    expect(year.records.length).toBe(11);
    expect(year.records.find(record => record.entry.id === installmentEntryId('tv', 11))!.entry.amountMinor).toBe(5000);
    expect([monthExpense(year, '2026-11'), monthExpense(year, '2026-12')]).toEqual([5000, 0]);
    expect(figures(year)).toMatchObject({ recognisedMinor: 105000, scheduledMinor: 0, remainingMinor: 0, status: 'completed' });
    expect(pendingInstallmentPlans(card, [tv], year.records, ops(year))).toEqual([]);
    // The date: between the purchase (the floor without records) and today.
    expect(() => refundPlan(plain(), 'tv', 100, '2026-01-09', '2026-01-15')).toThrow(PLAN_OPERATION_DATE_MESSAGE);
    expect(() => refundPlan(plain(), 'tv', 100, '2026-01-16', '2026-01-15')).toThrow(PLAN_OPERATION_DATE_MESSAGE);
  });

  it('smaller than what was recognised: all credit, one line on the card in the refund’s month, the commitment unchanged; dated on or after the last recorded instalment (A6)', () => {
    const april = catchUp(plain(), '2026-04-25');
    expect(planOperationFloorISO(tv, april.records, [])).toBe('2026-04-20');
    expect(planRefundAvailability(april, 'tv')).toEqual({ creditAvailableMinor: 40000, futureAvailableMinor: 80000, availableMinor: 120000, floorISO: '2026-04-20' });
    const { archive, op } = refundPlan(april, 'tv', 15000, '2026-04-22', '2026-04-25');
    expect([op.creditMinor, op.reductions]).toEqual([15000, []]);
    expect(snapshotFromArchive(archive).entries.at(-1)).toEqual({ id: op.id, accountId: 'card-acc', kind: 'expense', amountMinor: -15000, merchant: 'Electro', category: 'Hogar',
      dateISO: '2026-04-22', createdAt: op.createdAt, refund: { operationId: op.id, targetPlanId: 'tv' } });
    expect([monthExpense(archive, '2026-04'), cardDebtMinor(card, snapshotFromArchive(archive)), cardCommittedMinor(card, [tv], archive.records, ops(archive))]).toEqual([-5000, 25000, 80000]);
    expect(() => refundPlan(april, 'tv', 15000, '2026-04-19', '2026-04-25')).toThrow(PLAN_OPERATION_DATE_MESSAGE);
  });

  it('larger than what was recognised: the credit reverses it all and the rest lowers the last instalments, each to zero before the previous one', () => {
    const april = catchUp(plain(), '2026-04-25');
    const larger = refundPlan(april, 'tv', 70000, '2026-04-25');
    expect([larger.op.creditMinor, larger.op.reductions]).toEqual([40000, [{ number: 10, minor: 10000 }, { number: 11, minor: 10000 }, { number: 12, minor: 10000 }]]);
    expect([cardDebtMinor(card, snapshotFromArchive(larger.archive)), cardCommittedMinor(card, [tv], larger.archive.records, ops(larger.archive))]).toEqual([0, 50000]);
    const f = figures(larger.archive);
    expect(f.recognisedMinor - f.refundedCreditMinor + f.scheduledMinor).toBe(f.principalMinor - f.refundedMinor);
    const partial = refundPlan(april, 'tv', 45000, '2026-04-25');
    expect(partial.op.reductions).toEqual([{ number: 12, minor: 5000 }]);
  });

  it('the full price of a partly recognised plan: the plan completes, is not pending, and the paid card is deletable', () => {
    const april = catchUp(plain(), '2026-04-25');
    expect(() => refundPlan(april, 'tv', 120001, '2026-04-25')).toThrow(REFUND_OVER_MESSAGE);
    const { archive, op } = refundPlan(april, 'tv', 120000, '2026-04-25');
    expect([op.creditMinor, op.reductions.length]).toEqual([40000, 8]);
    expect(installmentPlanStatus(tv, archive.records, ops(archive))).toBe('completed');
    expect(pendingInstallmentPlans(card, [tv], archive.records, ops(archive))).toEqual([]);
    expect(catchUp(archive, '2027-06-01').records.length).toBe(4);
    expect(() => assertCardDeletable(card, snapshotFromArchive(archive), [tv], archive.records, ops(archive))).not.toThrow();
    expect(() => refundPlan(archive, 'tv', 1, '2026-04-25')).toThrow(REFUND_OVER_MESSAGE);
  });

  it('after every instalment was recognised: all credit, in the refund’s month (a net below zero is exact, never clamped here)', () => {
    const { archive, op } = refundPlan(plain(), 'tv', 120000, '2027-01-05');
    expect([op.creditMinor, op.reductions, archive.records.length]).toEqual([120000, [], 12]);
    expect([monthExpense(archive, '2027-01'), cardDebtMinor(card, snapshotFromArchive(archive)), incomeOf(archive, '2027-01-31')]).toEqual([-120000, 0, 0]);
  });

  it('several partial devoluciones: each allocates against what is left; Σ devoluciones = Σ credit + Σ reductions', () => {
    let archive = catchUp(plain(), '2026-04-25');
    const r1 = refundPlan(archive, 'tv', 10000, '2026-04-25'); archive = r1.archive;
    const r2 = refundPlan(archive, 'tv', 35000, '2026-04-25'); archive = r2.archive;
    const r3 = refundPlan(archive, 'tv', 10000, '2026-04-25'); archive = r3.archive;
    expect([r1.op.creditMinor, r2.op.creditMinor, r3.op.creditMinor]).toEqual([10000, 30000, 0]);
    expect([r2.op.reductions, r3.op.reductions]).toEqual([[{ number: 12, minor: 5000 }], [{ number: 11, minor: 5000 }, { number: 12, minor: 5000 }]]);
    const f = figures(archive);
    expect([f.refundedMinor, f.refundedCreditMinor, f.refundedFutureMinor]).toEqual([55000, 40000, 15000]);
    expect(planRefundAvailability(archive, 'tv')).toMatchObject({ creditAvailableMinor: 0, futureAvailableMinor: 65000 });
  });

  it('with an undone instalment: undone principal is neither credit nor future; undoing a share a devolución reversed is refused', () => {
    let archive = voidRecord(catchUp(plain(), '2026-04-25'), installmentEntryId('tv', 4));
    expect(planRefundAvailability(archive, 'tv')).toMatchObject({ creditAvailableMinor: 30000, futureAvailableMinor: 80000 });
    const r = refundPlan(archive, 'tv', 40000, '2026-04-25');
    expect([r.op.creditMinor, r.op.reductions]).toEqual([30000, [{ number: 12, minor: 10000 }]]);
    archive = restoreRecord(r.archive, installmentEntryId('tv', 4));
    archive = refundPlan(archive, 'tv', 10000, '2026-04-25').archive;
    expect(figures(archive)).toMatchObject({ refundedCreditMinor: 40000, recognisedMinor: 40000 });
    expect(() => voidRecord(archive, installmentEntryId('tv', 4))).toThrow('Una devolución usa estas cuotas. Deshacé la devolución primero.');
  });

  it('an over-refund is refused at creation and as an archive invariant', () => {
    const april = catchUp(plain(), '2026-04-25');
    const forged: PlanRefund = { id: 'forged', kind: 'refund', target: { planId: 'tv' }, accountId: 'card-acc', currency: 'ARS', amountMinor: 50000, creditMinor: 50000,
      reductions: [], dateISO: '2026-04-25', voided: false, createdAt: at('2026-04-25'), revision: 0, updatedAt: at('2026-04-25') };
    expect(() => validateArchive({ ...april, purchaseOperations: [forged] })).toThrow(operationGuardMessage('refund-credit'));
    expect(() => validateArchive({ ...april, purchaseOperations: [forged] }, 'create')).toThrow(REFUND_OVER_MESSAGE);
    expect(() => validateArchive({ ...april, purchaseOperations: [{ ...forged, creditMinor: 0, reductions: [{ number: 12, minor: 10001 }], amountMinor: 10001 }] })).toThrow(OPERATION_INVALID_MESSAGE);
    const twice = [{ ...forged, id: 'r1', creditMinor: 0, amountMinor: 10000, reductions: [{ number: 12, minor: 10000 }] },
      { ...forged, id: 'r2', creditMinor: 0, amountMinor: 10000, reductions: [{ number: 12, minor: 10000 }] }];
    expect(() => validateArchive({ ...april, purchaseOperations: twice })).toThrow('Otra devolución ya redujo esas cuotas.');
  });

  it('on a stopped plan: only credit (up to what was recognised); a devolución with reductions made before the stop stays, and is neither undone nor restored until the plan is reactivated', () => {
    const april = catchUp(plain(), '2026-04-25');
    const stopped = { ...april, installmentPlans: [cancelInstallmentPlan(tv, at('2026-04-25'))] };
    expect(planRefundAvailability(stopped, 'tv')).toMatchObject({ creditAvailableMinor: 40000, futureAvailableMinor: 0 });
    expect(() => refundPlan(stopped, 'tv', 50000, '2026-04-26')).toThrow(REFUND_OVER_MESSAGE);
    const credit = refundPlan(stopped, 'tv', 40000, '2026-04-26');
    expect(credit.op.reductions).toEqual([]);
    expect(figures(credit.archive)).toMatchObject({ cancelledMinor: 80000, refundedCreditMinor: 40000, status: 'cancelled' });
    expect(() => payoff(stopped, 'tv', 'recognised', '2026-04-26')).toThrow(OPERATION_PLAN_STOPPED_MESSAGE);
    // Reductions first, then the stop: figures still add up; the devolución is frozen until «Reactivar plan».
    const reduced = refundPlan(april, 'tv', 70000, '2026-04-25');
    const later = { ...reduced.archive, installmentPlans: [cancelInstallmentPlan(tv, at('2026-04-26'))] };
    validateArchive(later, 'cancel');
    const f = figures(later);
    expect([f.recognisedMinor, f.cancelledMinor, f.refundedFutureMinor, f.recognisedMinor + f.cancelledMinor + f.refundedFutureMinor]).toEqual([40000, 50000, 30000, 120000]);
    expect(() => undo(later, reduced.op.id, '2026-04-27')).toThrow(OPERATION_PLAN_STOPPED_MESSAGE);
    expect(() => undo(credit.archive, credit.op.id, '2026-04-27')).not.toThrow(); // credit only: allowed on a stopped plan
  });

  it('a plan credit line takes the category of the latest live recorded principal share, else the plan’s (A30)', () => {
    let april = catchUp(plain(), '2026-04-25');
    april = editRecord(april, installmentEntryId('tv', 4), record => ({ entry: { ...record.entry, category: 'Tecnología' } }));
    const { archive, op } = refundPlan(april, 'tv', 5000, '2026-04-25');
    expect(snapshotFromArchive(archive).entries.find(entry => entry.id === op.id)!.category).toBe('Tecnología');
    expect(categoryOf(archive, '2026-04', 'Tecnología')).toBe(10000 - 5000);
    const lines = projectOperationLines({ records: [], installmentPlans: [tv], purchaseOperations: [{ ...op }] });
    expect(lines[0].category).toBe('Hogar');
  });

  it('undo: refused once a reduced instalment was recorded at its reduced amount; allowed when the reduced share was never recorded, recording it on its own closing date; restore then refused', () => {
    const april = catchUp(plain(), '2026-04-25');
    const partial = refundPlan(april, 'tv', 45000, '2026-04-25');
    const december = catchUp(partial.archive, '2026-12-25');
    expect(december.records.find(record => record.entry.id === installmentEntryId('tv', 12))!.entry.amountMinor).toBe(5000);
    expect(() => undo(december, partial.op.id, '2026-12-26')).toThrow('Ya se registraron cuotas que esta devolución redujo; no se puede deshacer.');
    const whole = refundPlan(april, 'tv', 50000, '2026-04-25');
    const late = catchUp(whole.archive, '2026-12-25');
    expect(late.records.some(record => record.entry.id === installmentEntryId('tv', 12))).toBe(false);
    const undone = change(late, whole.op.id, 'void', '2026-12-26');
    expect(undone.inserts.map(record => [record.entry.id, record.entry.dateISO, record.entry.amountMinor])).toEqual([[installmentEntryId('tv', 12), '2026-12-20', 10000]]);
    expect(() => restore(undone.archive, whole.op.id, '2026-12-27')).toThrow('Ya se registraron cuotas que esta devolución reduce; no se puede restaurar.');
    expect(operationGuardMessage('refund-recorded', 'import')).toBe(OPERATION_IMPORT_MESSAGE);
  });

  it('the expected allocation travels with the submission: a changed allocation is refused (A13)', () => {
    const april = catchUp(plain(), '2026-04-25');
    const previewed = newPlanRefund(catchUp(plain(), '2026-03-25'), { id: 'form-1', planId: 'tv', amountMinor: 45000, dateISO: '2026-03-25', todayISO: '2026-03-25', createdAt: at('2026-03-25') });
    const computed = newPlanRefund(april, { id: 'form-1', planId: 'tv', amountMinor: 45000, dateISO: '2026-04-25', todayISO: '2026-04-25', createdAt: at('2026-03-25') });
    expect([previewed.creditMinor, computed.creditMinor]).toEqual([30000, 40000]);
    expect(() => assertExpectedAllocation(computed, previewed)).toThrow(OPERATION_CHANGED_MESSAGE);
    expect(() => assertExpectedAllocation(computed, { ...computed })).not.toThrow();
  });
});

describe('C. an adelanto de cuotas (B1): the remaining shares recognised once, on its date; the payment stays a transfer', () => {
  it('future only: before any closing, the whole remaining principal is recognised on the adelanto’s date, and the catch-up never records it again', () => {
    const { archive, op } = payoff(plain(), 'tv', 'recognised', '2026-01-15');
    expect([op.amountMinor, op.covered.length, op.covered.every(row => row.component === 'principal' && row.minor === 10000)]).toEqual([120000, 12, true]);
    expect(snapshotFromArchive(archive).entries).toEqual([{ id: op.id + '_p', accountId: 'card-acc', kind: 'expense', amountMinor: 120000, merchant: 'Electro', category: 'Hogar',
      dateISO: '2026-01-15', createdAt: op.createdAt, payoff: { operationId: op.id, planId: 'tv', component: 'principal' } }]);
    const year = catchUp(archive, '2027-06-01');
    expect(year.records).toEqual([]);
    expect(figures(year)).toMatchObject({ recognisedMinor: 120000, settledMinor: 120000, scheduledMinor: 0, remainingMinor: 0, recognisedCount: 12, status: 'completed' });
    expect(effectiveShares(tv, year.records, ops(year)).every(share => share.state === 'settled' && share.payoffId === op.id)).toBe(true);
  });

  it('partly recognised: the rest lands once in the adelanto’s month; the card owes the price until a payment (a transfer) is recorded; the plan completes; figures reconcile before and after', () => {
    const april = catchUp(plain(), '2026-04-25');
    expect(figures(april)).toMatchObject({ recognisedMinor: 40000, scheduledMinor: 80000, remainingMinor: 80000, status: 'active' });
    // A generic card payment never creates an adelanto, never moves a plan figure.
    const paidOnly = withTransfer(april, payment(80000, '2026-04-25', 'generic'));
    expect([figures(paidOnly), ops(paidOnly), cardCommittedMinor(card, [tv], paidOnly.records, ops(paidOnly))]).toEqual([figures(april), [], 80000]);
    expect(monthExpense(paidOnly, '2026-04')).toBe(monthExpense(april, '2026-04'));
    const { archive, op } = payoff(april, 'tv', 'recognised', '2026-04-25');
    expect([op.amountMinor, op.covered.map(row => row.number)]).toEqual([80000, [5, 6, 7, 8, 9, 10, 11, 12]]);
    expect([monthExpense(archive, '2026-04'), cardDebtMinor(card, snapshotFromArchive(archive))]).toEqual([90000, 120000]);
    expect(figures(archive)).toMatchObject({ recognisedMinor: 120000, settledMinor: 80000, scheduledMinor: 0, remainingMinor: 0, recognisedCount: 12, status: 'completed' });
    expect(pendingInstallmentPlans(card, [tv], archive.records, ops(archive))).toEqual([]);
    const paid = withTransfer(archive, payment(120000, '2026-04-26'));
    expect([cardDebtMinor(card, snapshotFromArchive(paid)), monthExpense(paid, '2026-04')]).toEqual([0, 90000]);
    expect(() => assertCardDeletable(card, snapshotFromArchive(paid), [tv], paid.records, ops(paid))).not.toThrow();
    // Never a second expense: over the whole life of the plan the principal is recognised exactly once.
    const life = catchUp(paid, '2027-06-01');
    const principal = snapshotFromArchive(life).entries.filter(entry => entry.id.startsWith('inst_tv') || entry.payoff?.planId === 'tv').reduce((sum, entry) => sum + entry.amountMinor, 0);
    expect(principal).toBe(120000);
    expect(Object.keys(figures(life)).some(key => /paid/i.test(key))).toBe(false);
  });

  it('the final instalment near its closing: the day before it is brought forward; on the closing day it is already recorded and nothing is left', () => {
    const eve = catchUp(plain(), '2026-12-19');
    expect(eve.records.length).toBe(11);
    const { archive, op } = payoff(eve, 'tv', 'recognised', '2026-12-19');
    expect(op.covered).toEqual([{ number: 12, component: 'principal', minor: 10000 }]);
    expect(catchUp(archive, '2026-12-25').records.length).toBe(11);
    expect(() => payoff(eve, 'tv', 'recognised', '2026-12-20')).toThrow(PAYOFF_NOTHING_MESSAGE);
    // Without the catch-up the helper would cover a share whose statement already closed: refused.
    expect(() => newPlanPayoff(eve, { id: 'late', planId: 'tv', financing: 'recognised', dateISO: '2026-12-20', todayISO: '2026-12-20', createdAt: at('2026-12-20') })).toThrow(PAYOFF_DATE_MESSAGE);
  });

  it('future financing: recognised now with the principal, or recorded as not charged (waived), as the person states; never assumed', () => {
    const april = catchUp(plain(fin), '2026-04-25');
    const recognised = payoff(april, 'fin', 'recognised', '2026-04-25');
    expect(snapshotFromArchive(recognised.archive).entries.filter(entry => entry.payoff).map(entry => [entry.id, entry.amountMinor, entry.category]))
      .toEqual([[recognised.op.id + '_p', 80000, 'Hogar'], [recognised.op.id + '_i', 800, 'Intereses']]);
    expect(categoryOf(recognised.archive, '2026-04', 'Intereses')).toBe(100 + 800);
    const waived = payoff(april, 'fin', 'waived', '2026-04-25');
    expect(snapshotFromArchive(waived.archive).entries.filter(entry => entry.payoff).map(entry => entry.id)).toEqual([waived.op.id + '_p']);
    expect(waived.op.covered.filter(row => row.component === 'interest').length).toBe(8);
    const f = figures(waived.archive);
    expect([f.financingWaivedMinor, f.components.interest.waivedMinor, f.components.interest.remainingMinor, f.status]).toEqual([800, 800, 0, 'completed']);
    expect(cardCommittedFinancingMinor(card, [fin], waived.archive.records, ops(waived.archive))).toBe(0);
    expect(() => payoff(april, 'fin', 'maybe' as PayoffFinancing, '2026-04-25')).toThrow(PAYOFF_FINANCING_MESSAGE);
    // A19: the adelanto's principal is one purchase of the open cycle; its interest is financing.
    expect(cardStatementActivity(card, snapshotFromArchive(recognised.archive), '2026-04-25')).toMatchObject({ purchasesMinor: 80000, purchaseCount: 1, financingMinor: 800, refundsMinor: 0 });
  });

  it('undo: the covered shares return; those whose closing passed are recorded on their own closing dates; then the adelanto can no longer be restored', () => {
    const april = catchUp(plain(), '2026-04-25');
    const { archive, op } = payoff(april, 'tv', 'recognised', '2026-04-25');
    const sameDay = undo(archive, op.id, '2026-04-25');
    expect(() => restore(sameDay, op.id, '2026-04-25')).not.toThrow();
    const july = change(archive, op.id, 'void', '2026-07-25');
    expect(july.inserts.map(record => record.entry.dateISO)).toEqual(['2026-05-20', '2026-06-20', '2026-07-20']);
    expect(figures(july.archive)).toMatchObject({ recognisedMinor: 70000, scheduledMinor: 50000, settledMinor: 0 });
    expect(() => restore(july.archive, op.id, '2026-07-26')).toThrow('Algunas cuotas ya se registraron o se adelantaron; registrá un adelanto nuevo.');
  });

  it('two live adelantos never cover the same share (A4a): undo, a new adelanto, then restoring the first is refused', () => {
    const april = catchUp(plain(), '2026-04-25');
    const first = payoff(april, 'tv', 'recognised', '2026-04-25');
    const undone = undo(first.archive, first.op.id, '2026-04-25');
    const second = payoff(undone, 'tv', 'recognised', '2026-04-25');
    expect(() => restore(second.archive, first.op.id, '2026-04-25')).toThrow(operationGuardMessage('payoff-overlap', 'restore'));
    expect(() => validateArchive({ ...second.archive, purchaseOperations: [...ops(second.archive).map(item => ({ ...item, voided: false }))] })).toThrow(operationGuardMessage('payoff-overlap'));
  });

  it('refuses an adelanto with no principal left (A4(d)), on a stopped plan, on a deleted card, or before the plan’s floor; stopping a plan with nothing scheduled is refused', () => {
    const april = catchUp(plain(fin), '2026-04-25');
    const allBack = refundPlan(april, 'fin', 120000, '2026-04-25');
    expect(() => payoff(allBack.archive, 'fin', 'recognised', '2026-04-25')).toThrow(PAYOFF_PRINCIPAL_MESSAGE);
    expect(installmentPlanStatus(fin, allBack.archive.records, ops(allBack.archive))).toBe('active'); // its interest is still scheduled (A17)
    const done = payoff(april, 'fin', 'recognised', '2026-04-25');
    expect(() => assertInstallmentPlanCancellable(fin, done.archive.records, ops(done.archive))).toThrow(PLAN_NOTHING_TO_STOP_MESSAGE);
    expect(() => payoff(april, 'fin', 'recognised', '2026-04-19', '2026-04-25')).toThrow(PLAN_OPERATION_DATE_MESSAGE);
    const goneCard = { ...april, cards: [deleteCreditCard(card, at('2026-04-21'))] };
    expect(() => payoff(goneCard, 'fin', 'recognised', '2026-04-25')).toThrow(CARD_DELETED_MESSAGE);
    expect(() => undo({ ...done.archive, cards: [deleteCreditCard(card, at('2026-04-26'))] }, done.op.id, '2026-04-26')).toThrow(OPERATION_HISTORY_DELETED_MESSAGE);
    const archived = { ...april, cards: [{ ...card, active: false, revision: 1, updatedAt: at('2026-04-21') }] };
    expect(() => payoff(archived, 'fin', 'recognised', '2026-04-25')).not.toThrow();
  });

  it('with devoluciones: a devolución after an adelanto is all credit; undoing the adelanto it relies on is refused; undoing a devolución an adelanto absorbed is refused (A4b, A4e)', () => {
    const april = catchUp(plain(), '2026-04-25');
    const p = payoff(april, 'tv', 'recognised', '2026-04-25');
    expect(planOperationFloorISO(tv, p.archive.records, ops(p.archive))).toBe('2026-04-25');
    const r = refundPlan(p.archive, 'tv', 100000, '2026-04-26');
    expect([r.op.creditMinor, r.op.reductions]).toEqual([100000, []]);
    expect(() => undo(r.archive, p.op.id, '2026-04-26')).toThrow('Una devolución usa estas cuotas. Deshacé la devolución primero.');
    // A share partly reduced, then covered at its reduced amount: undoing the devolución would lose principal.
    const reduced = refundPlan(april, 'tv', 45000, '2026-04-25');
    const covered = payoff(reduced.archive, 'tv', 'recognised', '2026-04-25');
    expect(covered.op.covered.at(-1)).toEqual({ number: 12, component: 'principal', minor: 5000 });
    expect(() => undo(covered.archive, reduced.op.id, '2026-04-25')).toThrow('Un adelanto usa esas cuotas. Deshacé el adelanto primero.');
    // A share reduced to zero is not covered; undoing that devolución would leave it to record after the adelanto: refused too.
    const zero = refundPlan(april, 'tv', 50000, '2026-04-25');
    const afterZero = payoff(zero.archive, 'tv', 'recognised', '2026-04-25');
    expect(afterZero.op.covered.map(row => row.number)).toEqual([5, 6, 7, 8, 9, 10, 11]);
    expect(() => undo(afterZero.archive, zero.op.id, '2026-04-25')).toThrow('Un adelanto usa esas cuotas. Deshacé el adelanto primero.');
    // Restoring a devolución across an adelanto made meanwhile is refused (the adelanto covers the share at its full amount).
    // Verifier change (deliberate): the refusal names both operations instead of «registrá un adelanto nuevo», which is
    // wrong advice when the row being restored is a devolución (guard 'payoff-refund', A22).
    const undoneRefund = undo(zero.archive, zero.op.id, '2026-04-25');
    const p2 = payoff(undoneRefund, 'tv', 'recognised', '2026-04-25');
    expect(() => restore(p2.archive, zero.op.id, '2026-04-25')).toThrow(operationGuardMessage('payoff-refund', 'restore'));
  });
});

describe('D. stop, reactivate, delete; deleting a card', () => {
  it('stops only with something scheduled, reactivates (cancelled → null, one revision on) and records the shares whose closing passed meanwhile on their own dates', () => {
    const april = catchUp(plain(), '2026-04-25');
    expect(() => assertInstallmentPlanCancellable(tv, april.records, [])).not.toThrow();
    const stopped = cancelInstallmentPlan(tv, at('2026-04-25'));
    expect(() => assertInstallmentPlanCancellable(stopped, april.records, [])).toThrow(PLAN_CANCELLED_MESSAGE);
    const stoppedArchive = { ...april, installmentPlans: [stopped] };
    expect(catchUp(stoppedArchive, '2026-07-25').records.length).toBe(4);
    const back = reactivateInstallmentPlan(stopped, at('2026-07-25'));
    expect([back.cancelledAt, back.revision, back.updatedAt]).toEqual([null, 2, at('2026-07-25')]);
    expect(() => validateInstallmentPlanChange(stopped, back)).not.toThrow();
    const inserts = planCatchUpInserts({ ...april, installmentPlans: [back] }, 'tv', '2026-07-25');
    expect(inserts.map(record => record.entry.dateISO)).toEqual(['2026-05-20', '2026-06-20', '2026-07-20']);
    expect(() => reactivateInstallmentPlan(back, at('2026-07-26'))).toThrow(PLAN_NOT_CANCELLED_MESSAGE);
    expect(() => reactivateInstallmentPlan({ ...tv, deleted: true, revision: 1 }, at('2026-07-26'))).toThrow(PLAN_DELETED_MESSAGE);
    expect(() => planCatchUpInserts(april, 'nope', '2026-07-25')).toThrow('No encontramos este plan de cuotas.');
    // A14: the catch-up reads a local date key; on the eve of a closing (21:30 in UTC−3 is already the next UTC day) storage
    // passes todayKey(), so the share of the next day is not recorded early.
    expect(planCatchUpInserts(plain(), 'tv', '2026-01-19')).toEqual([]);
    expect(planCatchUpInserts(plain(), 'tv', '2026-01-20').map(record => record.entry.dateISO)).toEqual(['2026-01-20']);
  });

  it('deletes a plan only without history and without any operation, an undone one included (A16)', () => {
    const r = refundPlan(plain(), 'tv', 1000, '2026-01-12');
    const undone = undo(r.archive, r.op.id, '2026-01-12');
    expect(() => assertInstallmentPlanDeletable(tv, undone.records, ops(undone))).toThrow(PLAN_OPERATION_HISTORY_MESSAGE);
    expect(() => assertInstallmentPlanDeletable(tv, [], [])).not.toThrow();
    expect(() => assertInstallmentPlanDeletable(tv, catchUp(plain(), '2026-01-25').records, [])).toThrow(PLAN_HISTORY_MESSAGE);
  });

  it('a card is deleted with completed, stopped, refunded or brought-forward plans once nothing is due and nothing is in its favour; a pending plan or a credit keeps it (B3)', () => {
    const deletable = (archive: LedgerArchive) => () => assertCardDeletable(card, snapshotFromArchive(archive), archive.installmentPlans!, archive.records, ops(archive));
    const completed = catchUp(plain(), '2027-01-01');
    expect(deletable(withTransfer(completed, payment(120000, '2027-01-02')))).not.toThrow();
    const stopped = { ...catchUp(plain(), '2026-02-25'), installmentPlans: [cancelInstallmentPlan(tv, at('2026-02-25'))] };
    expect(deletable(withTransfer(stopped, payment(20000, '2026-02-26')))).not.toThrow();
    expect(deletable(refundPlan(plain(), 'tv', 120000, '2026-01-15').archive)).not.toThrow();
    const brought = payoff(catchUp(plain(), '2026-02-25'), 'tv', 'recognised', '2026-02-25').archive;
    expect(deletable(brought)).toThrow('Esta tarjeta tiene saldo pendiente.');
    expect(deletable(withTransfer(brought, payment(120000, '2026-02-26')))).not.toThrow();
    expect(deletable(withTransfer(brought, payment(130000, '2026-02-26')))).toThrow(CARD_CREDIT_MESSAGE);
    // An adelanto with an undone share left is still pending (A2).
    const undoneFirst = voidRecord(catchUp(plain(), '2026-02-25'), installmentEntryId('tv', 2));
    const partial = payoff(undoneFirst, 'tv', 'recognised', '2026-02-25').archive;
    expect(deletable(withTransfer(partial, payment(110000, '2026-02-26')))).toThrow(CARD_PLAN_MESSAGE);
  });
});

describe('G. invariants', () => {
  it('a transfer is never spending, a card payment never an expense, a devolución never an income, and no currency is converted', () => {
    let archive = withRecords(base(), expense('p1', 'bank', 30000, '2026-03-05'), expense('u1', 'usd', 5000, '2026-03-05'));
    archive = withTransfer(archive, { id: 'move', fromAccountId: 'bank', toAccountId: 'wallet', amountMinor: 1000, note: '', dateISO: '2026-03-06', createdAt: at('2026-03-06') });
    archive = withTransfer(archive, payment(1000, '2026-03-06'));
    expect([monthExpense(archive, '2026-03'), incomeOf(archive, '2026-03-31')]).toEqual([30000, 0]);
    const refunded = refundEntry(archive, 'u1', 2000, '2026-03-07');
    expect(refunded.op.currency).toBe('USD');
    expect([monthExpense(refunded.archive, '2026-03', 'USD'), monthExpense(refunded.archive, '2026-03', 'ARS'), balance(refunded.archive, usd)]).toEqual([3000, 30000, 100000 - 3000]);
    expect(snapshotFromArchive(refunded.archive).entries.every(entry => entry.kind === 'expense')).toBe(true);
    // An operation whose currency is not its account's is refused (never reinterpreted).
    expect(() => validateArchive({ ...refunded.archive, purchaseOperations: [{ ...refunded.op, currency: 'ARS' }] })).toThrow(OPERATION_INVALID_MESSAGE);
  });

  it('isPurchaseLine (A23): a devolución line is no purchase; an adelanto counts once, through its principal line', () => {
    const april = catchUp(withRecords(plain(fin), expense('p1', 'bank', 30000, '2026-03-05')), '2026-04-25');
    const refunded = refundEntry(april, 'p1', 1000, '2026-04-25').archive;
    const paidOff = payoff(refunded, 'fin', 'recognised', '2026-04-25').archive;
    const lines = snapshotFromArchive(paidOff).entries;
    expect(lines.filter(entry => entry.refund).map(isPurchaseLine)).toEqual([false]);
    expect(lines.filter(entry => entry.payoff).map(isPurchaseLine)).toEqual([true, false]);
    expect(isPurchaseLine(lines[0])).toBe(true);
    expect(isPurchaseLine({ ...lines[0], kind: 'income' })).toBe(false);
  });

  it('projected lines come after the records, in a deterministic order, and are never stored (A11)', () => {
    const april = catchUp(withRecords(plain(fin), expense('p1', 'bank', 30000, '2026-03-05')), '2026-04-25');
    const a = refundEntry(april, 'p1', 1000, '2026-04-24', '2026-04-25').archive;
    const b = payoff(a, 'fin', 'recognised', '2026-04-25').archive;
    const lines = snapshotFromArchive(b).entries;
    expect(lines.slice(0, b.records.length).every(entry => !entry.refund && !entry.payoff)).toBe(true);
    expect(lines.slice(b.records.length).map(entry => entry.dateISO)).toEqual(['2026-04-24', '2026-04-25', '2026-04-25']);
    expect(snapshotFromArchive({ ...b, purchaseOperations: [...ops(b)].reverse() }).entries).toEqual(lines);
    // A projected line is never a stored movement.
    expect(() => validateArchive({ ...b, records: [...b.records, initialRecord({ ...lines.at(-1)!, id: 'stored', amountMinor: 5 })] })).toThrow(PROJECTED_ENTRY_MESSAGE);
    // Ids: disjoint from movements, transfers, plans and projected line ids; a form id never has '_'.
    const op = ops(b)[0];
    expect(() => validateArchive({ ...b, purchaseOperations: [{ ...op, id: 'p1' }] })).toThrow(OPERATION_ID_MESSAGE);
    expect(() => validateArchive({ ...b, purchaseOperations: [{ ...op, id: 'fin' }] })).toThrow(OPERATION_ID_MESSAGE);
    expect(() => validateArchive({ ...b, purchaseOperations: [op, op] })).toThrow(OPERATION_ID_MESSAGE);
    expect(() => validateArchive({ ...b, purchaseOperations: [{ ...op, id: 'with_underscore' }] })).toThrow(OPERATION_INVALID_MESSAGE);
    const payoffOp = ops(b)[1];
    expect(() => validateArchive({ ...b, records: [...b.records, initialRecord(expense(payoffOp.id + '_p', 'bank', 1, '2026-04-25'))] })).toThrow(OPERATION_ID_MESSAGE);
    // The legacy v1 export has no place for them (A11).
    expect(() => createPilotBackup(snapshotFromArchive(b))).toThrow('Usá la copia actual');
  });

  it('a dangling reference is refused: an operation names a movement or a plan that exists', () => {
    const { archive, op } = refundEntry(withRecords(base(), expense('p1', 'bank', 30000, '2026-03-05')), 'p1', 1000, '2026-03-06');
    expect(() => validateArchive({ ...archive, purchaseOperations: [{ ...op, target: { entryId: 'ghost' } }] })).toThrow(OPERATION_TARGET_MESSAGE);
    expect(() => validateArchive({ ...archive, purchaseOperations: [{ ...op, voided: true, revision: 1, target: { entryId: 'ghost' } }] })).toThrow(OPERATION_TARGET_MESSAGE);
    const plan: PlanRefund = { ...op, target: { planId: 'ghost' }, accountId: 'card-acc', creditMinor: 1000, reductions: [] };
    expect(() => validateArchive({ ...archive, purchaseOperations: [plan] })).toThrow(OPERATION_TARGET_MESSAGE);
    expect(() => validateArchive({ ...archive, purchaseOperations: [{ ...op, accountId: 'ghost' }] })).toThrow(OPERATION_TARGET_MESSAGE);
    expect(projectOperationLines({ records: [], purchaseOperations: [op] })).toEqual([]); // the projection never stops the ledger from opening
  });

  it('shape: exact keys, canonical detail rows, positive amounts; the SQLite row and its detail round-trip', () => {
    const april = catchUp(plain(fin), '2026-04-25');
    const refund = refundPlan(april, 'fin', 70000, '2026-04-25');
    const brought = payoff(refund.archive, 'fin', 'waived', '2026-04-25');
    const entry = refundEntry(withRecords(base(), expense('p1', 'bank', 30000, '2026-03-05')), 'p1', 1000, '2026-03-06').op;
    for (const operation of [entry, refund.op, brought.op] as PurchaseOperation[]) {
      expect(operationFromRow(operationToRow(operation))).toEqual(operation);
      expect(() => validatePurchaseOperation({ ...operation, extra: 1 } as never)).toThrow(OPERATION_INVALID_MESSAGE);
      expect(() => validatePurchaseOperation({ ...operation, amountMinor: 0 })).toThrow(OPERATION_INVALID_MESSAGE);
      expect(() => validatePurchaseOperation({ ...operation, revision: 0, voided: true })).toThrow(OPERATION_INVALID_MESSAGE);
    }
    expect(operationToRow(entry)).toMatchObject({ targetEntryId: 'p1', targetPlanId: null, creditMinor: null, detailJSON: '{}' });
    expect(operationToRow(refund.op)).toMatchObject({ targetEntryId: null, targetPlanId: 'fin', creditMinor: 40000 });
    const r = refund.op as PlanRefund, p = brought.op as PlanPayoff;
    expect(() => validatePurchaseOperation({ ...r, reductions: [...r.reductions].reverse() })).toThrow(OPERATION_INVALID_MESSAGE);
    expect(() => validatePurchaseOperation({ ...r, amountMinor: r.amountMinor + 1 })).toThrow(OPERATION_INVALID_MESSAGE);
    expect(() => validatePurchaseOperation({ ...r, reductions: [{ number: 12, minor: 0 }], creditMinor: r.amountMinor })).toThrow(OPERATION_INVALID_MESSAGE);
    expect(() => validatePurchaseOperation({ ...p, covered: [...p.covered].reverse() })).toThrow(OPERATION_INVALID_MESSAGE);
    expect(() => validatePurchaseOperation({ ...p, covered: p.covered.filter(row => row.component !== 'principal'), amountMinor: 1 })).toThrow(OPERATION_INVALID_MESSAGE);
    expect(() => validatePurchaseOperation({ ...p, financing: 'maybe' as PayoffFinancing })).toThrow(OPERATION_INVALID_MESSAGE);
    expect(() => validatePurchaseOperation({ ...p, kind: 'refund' } as never)).toThrow(OPERATION_INVALID_MESSAGE);
    expect(() => operationFromRow({ ...operationToRow(p), detailJSON: '{' })).toThrow(OPERATION_INVALID_MESSAGE);
    expect(() => operationFromRow({ ...operationToRow(p), detailJSON: JSON.stringify({ financing: 'waived', covered: p.covered, extra: 1 }) })).toThrow(OPERATION_INVALID_MESSAGE);
    expect(() => operationFromRow({ ...operationToRow(entry), targetPlanId: 'fin' })).toThrow(OPERATION_INVALID_MESSAGE);
    expect(() => operationFromRow({ ...operationToRow(entry), creditMinor: 5 })).toThrow(OPERATION_INVALID_MESSAGE);
  });

  it('property: over random sequences of devoluciones, adelantos, undo/restore of operations and instalments, stops, reactivations and catch-ups, every figure reconciles (A1) and the ledger agrees', () => {
    let seed = 24_3;
    const random = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
    const pick = <T,>(items: readonly T[]): T | undefined => items.length ? items[Math.floor(random() * items.length)] : undefined;
    const addDays = (iso: string, days: number) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); };
    const plan = newInstallmentPlan({ id: 'prop', card, cardAccount, merchant: 'Electro', category: 'Hogar', purchaseDateISO: '2026-01-10', principalMinor: 100003, count: 7,
      placement: 'current', interestMinor: 1201, interestCategory: 'Intereses', feeMinor: 36, feeCategory: 'Comisiones', createdAt: at('2026-01-10') });
    const known = new Set(['El total supera el rango seguro.']);
    let refusals = 0, steps = 0;
    for (let run = 0; run < 30; run++) {
      let archive: LedgerArchive = base({ installmentPlans: [plan] });
      let today = '2026-01-12';
      for (let step = 0; step < 40; step++) {
        const current = archive.installmentPlans![0];
        const attempt = (action: () => LedgerArchive) => {
          try { archive = action(); steps++; } catch (error) {
            expect(error).not.toBeInstanceOf(TypeError);
            expect(error).not.toBeInstanceOf(RangeError);
            known.add((error as Error).message); refusals++;
          }
        };
        const choice = Math.floor(random() * 9);
        if (choice === 0) { today = addDays(today, 1 + Math.floor(random() * 40)); archive = catchUp(archive, today); }
        else if (choice === 1) attempt(() => {
          const available = planRefundAvailability(catchUp(archive, today), 'prop');
          const date = random() < 0.5 ? today : available.floorISO;
          return refundPlan(archive, 'prop', 1 + Math.floor(random() * Math.max(1, available.availableMinor)), date, today).archive;
        });
        else if (choice === 2) attempt(() => payoff(archive, 'prop', random() < 0.5 ? 'recognised' : 'waived', today).archive);
        else if (choice === 3) { const op = pick(ops(archive).filter(item => !item.voided)); if (op) attempt(() => undo(archive, op.id, today)); }
        else if (choice === 4) { const op = pick(ops(archive).filter(item => item.voided)); if (op) attempt(() => restore(archive, op.id, today)); }
        else if (choice === 5) { const record = pick(archive.records.filter(item => !item.voided)); if (record) attempt(() => voidRecord(archive, record.entry.id)); }
        else if (choice === 6) { const record = pick(archive.records.filter(item => item.voided)); if (record) attempt(() => restoreRecord(archive, record.entry.id)); }
        else if (choice === 7 && current.cancelledAt === null) attempt(() => {
          const caught = catchUp(archive, today);
          assertInstallmentPlanCancellable(current, caught.records, ops(caught));
          const next = { ...caught, installmentPlans: [cancelInstallmentPlan(current, at(today))] };
          validateArchive(next, 'cancel');
          return next;
        });
        else if (choice === 8 && current.cancelledAt !== null) attempt(() => {
          const next = { ...archive, installmentPlans: [reactivateInstallmentPlan(current, at(today))] };
          validateInstallmentPlanChange(current, next.installmentPlans[0]);
          return catchUp(next, today);
        });
        // Invariants after every step.
        validateArchive(archive);
        const livePlan = archive.installmentPlans![0];
        const f = installmentPlanFigures(livePlan, archive.records, ops(archive));
        for (const component of INSTALLMENT_COMPONENTS) {
          const c = f.components[component];
          expect(c.recognisedMinor + c.scheduledMinor + c.refundedFutureMinor + c.undoneMinor + c.cancelledMinor + c.waivedMinor, component).toBe(c.totalMinor);
          expect(c.remainingMinor).toBe(c.scheduledMinor + c.undoneMinor + c.cancelledMinor);
        }
        expect(f.refundedMinor).toBe(f.refundedCreditMinor + f.refundedFutureMinor);
        if (f.undoneMinor === 0 && f.cancelledMinor === 0) expect(f.recognisedMinor - f.refundedCreditMinor + f.scheduledMinor).toBe(f.principalMinor - f.refundedMinor);
        const counted = INSTALLMENT_COMPONENTS.reduce((sum, component) => sum + f.components[component].recognisedMinor, 0) - f.refundedCreditMinor;
        expect(0 - balance(archive, cardAccount)).toBe(counted);
        const snapshot = snapshotFromArchive(archive);
        expect(snapshot.entries.every(entry => entry.kind === 'expense')).toBe(true);
        expect(snapshot.entries.filter(entry => entry.refund).every(entry => entry.amountMinor < 0)).toBe(true);
        expect(snapshot.entries.filter(entry => !entry.refund).every(entry => entry.amountMinor > 0)).toBe(true);
        expect(new Set(snapshot.entries.map(entry => entry.id)).size).toBe(snapshot.entries.length);
        expect(f.status === 'completed').toBe(livePlan.cancelledAt === null && f.scheduledMinor === 0 && f.undoneMinor === 0
          && INSTALLMENT_COMPONENTS.every(component => f.components[component].scheduledMinor === 0 && f.components[component].undoneMinor === 0));
      }
    }
    expect(steps).toBeGreaterThan(300);
    expect(refusals).toBeGreaterThan(10);
    // Every refusal met was a domain message (no crash, no unknown text).
    for (const message of known) expect(message).toMatch(/^[A-ZÁÉÍÓÚÑ¿¡]/);
  });

  it('no figure or state ever says «paid»', () => {
    const april = catchUp(plain(), '2026-04-25');
    const done = payoff(april, 'tv', 'recognised', '2026-04-25').archive;
    const states = new Set(effectiveShares(tv, done.records, ops(done)).map(share => share.state));
    expect([...states].some(state => /paid|pagad/i.test(state))).toBe(false);
    expect(JSON.stringify(figures(done))).not.toMatch(/paid|pagad/i);
  });

  it('validates a large ledger quickly (A21): 50 plans × 480 shares, 5.000 movements, with operations', () => {
    const plans = Array.from({ length: 50 }, (_, index) => newInstallmentPlan({ id: `big${index}`, card, cardAccount, merchant: 'M', category: 'Hogar', purchaseDateISO: '2020-01-10',
      principalMinor: 1200000, count: 120, placement: 'current', interestMinor: 12000, interestCategory: 'Intereses', feeMinor: 1200, feeCategory: 'Comisiones',
      taxMinor: 600, taxCategory: 'Impuestos', createdAt: at('2020-01-10') }));
    let archive = catchUp(base({ installmentPlans: plans }), '2022-01-25');
    expect(archive.records.length).toBe(50 * 25 * 4);
    const operations: PurchaseOperation[] = plans.map((plan, index) => newPlanRefund(archive, { id: `big-r-${index}`, planId: plan.id, amountMinor: 20000 + index,
      dateISO: '2022-01-25', todayISO: '2022-01-25', createdAt: at('2022-01-25') }));
    archive = { ...archive, purchaseOperations: operations };
    const start = performance.now();
    validateArchive(archive);
    const snapshot = snapshotFromArchive(archive);
    pendingInstallmentPlans(card, plans, archive.records, operations);
    cardCommittedMinor(card, plans, archive.records, operations);
    const elapsed = performance.now() - start;
    expect(snapshot.entries.length).toBe(5000 + 50);
    expect(elapsed).toBeLessThan(3000);
  });
});

describe('backup v14', () => {
  const build = () => {
    let archive = catchUp(withRecords(plain(), expense('p1', 'bank', 30000, '2026-03-05')), '2026-04-25');
    const entry = refundEntry(archive, 'p1', 10000, '2026-04-25'); archive = entry.archive;
    const plan = refundPlan(archive, 'tv', 45000, '2026-04-25'); archive = plan.archive;
    const brought = payoff(archive, 'tv', 'recognised', '2026-04-25'); archive = brought.archive;
    archive = undo(archive, brought.op.id, '2026-04-25');
    return { archive, entry: entry.op as EntryRefund, plan: plan.op as PlanRefund, brought: brought.op as PlanPayoff };
  };

  it('is written as soon as an operation exists (an undone one included), round-trips every operation, and stays v12/v13 without one', () => {
    const { archive } = build();
    const backup = createRecoveryBackup(archive, new Date(at('2026-04-26')));
    expect(backup.schema).toBe(BACKUP_SCHEMA_V14);
    expect([backup.installmentPlans, backup.cardCycleDates, backup.purchaseOperations!.length]).toEqual([[tv], [], 3]);
    expect(backup.purchaseOperations!.map(item => item.id)).toEqual([...backup.purchaseOperations!.map(item => item.id)].sort());
    const parsed = parsePilotBackup(JSON.stringify(backup));
    expect([...parsed.archive.purchaseOperations!].sort((a, b) => a.id.localeCompare(b.id))).toEqual([...ops(archive)].sort((a, b) => a.id.localeCompare(b.id)));
    expect(snapshotFromArchive(parsed.archive).entries).toEqual(snapshotFromArchive({ ...archive, records: [...archive.records].sort((a, b) => a.entry.id.localeCompare(b.entry.id)) }).entries);
    const again = previewBackupImport(archive, parsed.archive);
    expect([again.purchaseOperations.length, again.conflicts]).toEqual([0, 0]);
    const fresh = previewBackupImport({ accounts: [], records: [] }, parsed.archive);
    expect([fresh.purchaseOperations.length, fresh.conflicts]).toEqual([3, 0]);
    expect(fresh.after).toEqual(liquidAfter(archive));
    const single = refundEntry(withRecords(base(), expense('p1', 'bank', 30000, '2026-03-05')), 'p1', 1, '2026-03-06');
    expect(createRecoveryBackup(undo(single.archive, single.op.id, '2026-03-07')).schema).toBe(BACKUP_SCHEMA_V14);
    expect(createRecoveryBackup(catchUp(plain(), '2026-04-25')).schema).toBe(BACKUP_SCHEMA_V12);
  });

  it('a v13 file imports additively into a device with operations, and a v14 file adds its operations to a device without any', () => {
    const { archive } = build();
    const v12 = createRecoveryBackup(catchUp(plain(), '2026-04-25'));
    const v13 = { ...v12, schema: BACKUP_SCHEMA_V13, cardCycleDates: [] };
    const older = parsePilotBackup(JSON.stringify(v13));
    const preview = previewBackupImport(archive, older.archive);
    expect([preview.conflicts, preview.purchaseOperations.length, preview.records.length]).toEqual([0, 0, 0]);
    const device = catchUp(withRecords(plain(), expense('p1', 'bank', 30000, '2026-03-05')), '2026-04-25');
    const newer = previewBackupImport(device, parsePilotBackup(JSON.stringify(createRecoveryBackup(archive))).archive);
    expect([newer.conflicts, newer.purchaseOperations.length]).toEqual([0, 3]);
    expect(() => parsePilotBackup(JSON.stringify({ ...v13, purchaseOperations: [] }))).toThrow('campos faltantes');
  });

  it('never resurrects an undone operation: a copy taken before the undo conflicts with it (A20)', () => {
    const { archive, entry } = build();
    const before = parsePilotBackup(JSON.stringify(createRecoveryBackup(archive))).archive;
    const undone = undo(archive, entry.id, '2026-04-26');
    const preview = previewBackupImport(undone, before);
    expect([preview.conflicts, preview.after]).toEqual([1, null]);
    expect(snapshotFromArchive(undone).entries.some(line => line.id === entry.id)).toBe(false);
  });

  it('refuses a newer file, a dangling reference, a malformed operation, too many operations, and a copy whose operations contradict this device’s instalments', () => {
    const { archive } = build();
    const backup = createRecoveryBackup(archive);
    expect(() => parsePilotBackup(JSON.stringify({ ...backup, schema: 'finanzapp.native-pilot.v15' }))).toThrow('versiones 1 a 14');
    const [first, ...rest] = backup.purchaseOperations!;
    const ghost = first.kind === 'refund' && 'entryId' in first.target ? { ...first, target: { entryId: 'ghost' } } : { ...first, target: { planId: 'ghost' } };
    expect(() => parsePilotBackup(JSON.stringify({ ...backup, purchaseOperations: [ghost, ...rest] }))).toThrow(OPERATION_TARGET_MESSAGE);
    expect(() => parsePilotBackup(JSON.stringify({ ...backup, purchaseOperations: [{ ...first, extra: true }, ...rest] }))).toThrow(OPERATION_INVALID_MESSAGE);
    expect(() => parsePilotBackup(JSON.stringify({ ...backup, purchaseOperations: 'no' }))).toThrow('demasiadas devoluciones o adelantos');
    const { purchaseOperations: _ops, ...withoutKey } = backup;
    expect(() => parsePilotBackup(JSON.stringify(withoutKey))).toThrow('campos faltantes');
    // This device recorded instalment 12 at its full amount; the copy reduced it: nothing is imported.
    const device = catchUp(plain(), '2026-12-25');
    const copy = refundPlan(catchUp(plain(), '2026-04-25'), 'tv', 45000, '2026-04-25').archive;
    expect(() => previewBackupImport(device, parsePilotBackup(JSON.stringify(createRecoveryBackup(copy))).archive)).toThrow(OPERATION_IMPORT_MESSAGE);
  });
});

function liquidAfter(archive: LedgerArchive) {
  return previewBackupImport(archive, { accounts: [], records: [] }).before;
}
