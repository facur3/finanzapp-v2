import assert from 'node:assert/strict';
import { test } from 'node:test';
import { accountBalanceMinor, cardStatementActivity, initialRecord, interestCategoryLabel, interestFromTotalFinanced, materializeInstallmentPlan, newInstallmentPlan, newPlanPayoff,
  newPlanRefund, snapshotFromArchive, spendingReport, summarizeMonthlyBudgets, type Account, type CreditCardProfile, type Entry, type LedgerArchive, type MonthlyBudget,
  type Transfer } from '@finanzapp/domain';
import { summarizeCard } from '../src/ui/liability-presentation.ts';
import { cardPlanSummaries, planScheduleRows, purchasePreview } from '../src/ui/installment-presentation.ts';

// Producto 24T2: the card screens read the same ledger facts as Reportes and Presupuestos. No display-only total: the
// balance, the future instalments, the cycle dates and the report and budget figures are computed from one archive.
const createdAt = '2026-09-01T12:00:00.000Z';
const bank: Account = { id: 'bank', name: 'Banco', currency: 'ARS', openingMinor: 10000000, createdAt };
const cardAccount: Account = { id: 'card-account', name: 'Visa', currency: 'ARS', openingMinor: 0, createdAt };
const card: CreditCardProfile = { id: 'card', accountId: cardAccount.id, issuer: 'Banco', last4: '4009', creditLimitMinor: 300000000, closingDay: 28, dueDay: 5,
  active: true, deleted: false, createdAt, revision: 0, updatedAt: createdAt };
const purchase: Entry = { id: 'coffee', accountId: cardAccount.id, kind: 'expense', amountMinor: 2310000, merchant: 'Café', category: 'Comida', dateISO: '2026-09-10', createdAt };
const payment: Transfer = { id: 'payment', fromAccountId: bank.id, toAccountId: cardAccount.id, amountMinor: 5000000, note: 'Pago Visa', dateISO: '2026-10-05', createdAt };
/** ARS 1.200.000 in 12 instalments, «Total financiado» ARS 1.440.000: interest 240.000, 20.000 per instalment. */
const plan = newInstallmentPlan({ id: 'notebook', card, cardAccount, merchant: 'Notebook', category: 'Tecnología', purchaseDateISO: '2026-09-10', principalMinor: 120000000,
  count: 12, placement: 'current', interestMinor: interestFromTotalFinanced(120000000, 144000000), interestCategory: interestCategoryLabel(), createdAt });
const today = '2026-10-30';
const instalments = materializeInstallmentPlan(plan, card, today, new Set(), []);
const archive: LedgerArchive = { accounts: [bank, cardAccount], records: [purchase, ...instalments].map(initialRecord),
  transfers: [{ transfer: payment, revision: 0, voided: false, updatedAt: createdAt }], cards: [card], installmentPlans: [plan] };
const snapshot = snapshotFromArchive(archive);

test('the card balance, its future instalments and its dates are the ledger’s own facts', () => {
  assert.deepEqual(instalments.map(entry => entry.id), ['inst_notebook_001', 'insti_notebook_001', 'inst_notebook_002', 'insti_notebook_002'],
    'two statements closed: principal and interest of each, and nothing else');
  const summary = summarizeCard(card, snapshot, today, archive.installmentPlans, archive.records, archive.purchaseOperations)!;
  const expected = 2310000 + 2 * (10000000 + 2000000) - 5000000;
  assert.equal(summary.debtMinor, expected, 'saldo pendiente = purchases and recognised instalments minus payments');
  assert.equal(summary.debtMinor, -accountBalanceMinor(cardAccount, snapshot.entries, snapshot.transfers));
  assert.equal(summary.committedMinor, 10 * 10000000, 'cuotas futuras: the principal not recognised, never inside the balance');
  assert.equal(summary.availability, 'unknownWithPlans');
  assert.equal(summary.availableMinor, null, 'never zero, never a formula');
  assert.equal(summary.usage, null, 'no usage bar while the available credit is unknown');
  assert.deepEqual([summary.previousClosingISO, summary.nextDueISO, summary.nextDueOfISO, summary.closingISO, summary.openDueISO],
    ['2026-10-28', '2026-11-05', '2026-10-28', '2026-11-28', '2026-12-05']);
  assert.equal(summary.pendingPlans.length, 1);
  const [row] = cardPlanSummaries(card.id, archive.installmentPlans, archive.records, archive.purchaseOperations);
  assert.deepEqual([row.figures.recognisedCount, row.figures.recognisedMinor, row.figures.scheduledMinor, row.figures.remainingMinor, row.totalFinancedMinor],
    [2, 20000000, 100000000, 100000000, 144000000]);
  assert.equal(row.next!.billingDateISO, '2026-11-28');
  assert.deepEqual(planScheduleRows(plan, archive.records, []).slice(0, 4).map(item => item.state), ['recognised', 'recognised', 'next', 'future']);
});

test('Reportes and Presupuestos count each recognised share once, in its statement month and its own category; a future share nowhere; a payment never', () => {
  const september = spendingReport(snapshot, 'ARS', '2026-09', '2026-09-30');
  const october = spendingReport(snapshot, 'ARS', '2026-10', today);
  assert.equal(september.status, 'ready');
  assert.equal(october.status, 'ready');
  if (september.status !== 'ready' || october.status !== 'ready') return;
  assert.equal(september.expenseMinor, 2310000 + 10000000 + 2000000);
  assert.equal(october.expenseMinor, 10000000 + 2000000, 'the payment is a transfer, not an expense');
  assert.deepEqual(october.categories.map(item => [item.category, item.amountMinor]).sort(), [['Intereses', 2000000], ['Tecnología', 10000000]]);
  const budgets: MonthlyBudget[] = [{ id: 'nov', scope: 'total', currency: 'ARS', monthISO: '2026-11', amountMinor: 50000000, active: true, createdAt, revision: 0, updatedAt: createdAt }];
  assert.equal(summarizeMonthlyBudgets(snapshot, budgets, 'ARS', '2026-11').total!.spentMinor, 0, 'November’s instalment is still a commitment');
  const all = [september, october].reduce((sum, report) => sum + (report.status === 'ready' ? report.expenseMinor : 0), 0);
  assert.equal(all, 2310000 + 2 * 12000000, 'the parent purchase never adds its full price');
});

test('the purchase preview is the schedule the plan is written with', () => {
  const preview = purchasePreview({ card, cycleDates: [], purchaseDateISO: plan.purchaseDateISO, placement: 'current', principalMinor: plan.principalMinor, count: plan.count,
    interestMinor: plan.interestMinor, todayISO: '2026-09-10' })!;
  assert.equal(JSON.stringify(preview.schedule), JSON.stringify(plan.schedule));
  assert.deepEqual([preview.firstBillingISO, preview.firstDueISO, preview.even, preview.maxMinor, preview.firstAlreadyClosed], ['2026-09-28', '2026-10-05', true, 12000000, false]);
  const late = purchasePreview({ card, cycleDates: [], purchaseDateISO: plan.purchaseDateISO, placement: 'current', principalMinor: 100000001, count: 3, interestMinor: 0, todayISO: today })!;
  assert.deepEqual([late.even, late.maxMinor, late.minMinor, late.firstAlreadyClosed], [false, 33333334, 33333333, true], 'an uneven remainder is «aprox.»; a closed statement is recognised at save');
});

test('Codex review: a card whose plans add up beyond the exact range still opens; that sum is unknown, never a throw or a rounded figure', () => {
  // Ten valid plans, each near the ledger's bound in interest: every stored amount is exact, their future interest together is not.
  const plans = Array.from({ length: 10 }, (_, index) => newInstallmentPlan({ id: 'big' + index, card, cardAccount, merchant: 'Big ' + index, category: 'Hogar',
    purchaseDateISO: '2026-10-10', principalMinor: 2, count: 2, placement: 'current', interestMinor: 999999999999998, interestCategory: interestCategoryLabel(), createdAt }));
  const summary = summarizeCard(card, snapshot, today, plans, [], [], []);
  assert.ok(summary);
  assert.deepEqual([summary.committedMinor, summary.committedFinancingMinor], [20, null], 'the principal is exact; the interest sum is out of range');
  assert.equal(summary.futurePlanCount, 10);
  // One plan alone stays exact.
  assert.deepEqual([summarizeCard(card, snapshot, today, plans.slice(0, 1), [], [], [])!.committedMinor, summarizeCard(card, snapshot, today, plans.slice(0, 1), [], [], [])!.committedFinancingMinor],
    [2, 999999999999998]);
});

test('24T3: an adelanto and a devolución reach the card through the same ledger: balance, future instalments, pending plans and the plan figures agree', () => {
  const now = '2026-10-30T12:00:00.000Z';
  // The rest brought forward on Oct 30, its interest recognised: ten instalments of principal and interest join the balance once.
  const payoff = newPlanPayoff(archive, { id: 'po', planId: plan.id, financing: 'recognised', dateISO: today, todayISO: today, createdAt: now });
  const advanced = { ...archive, purchaseOperations: [payoff] };
  const advancedSnapshot = snapshotFromArchive(advanced);
  const summary = summarizeCard(card, advancedSnapshot, today, advanced.installmentPlans, advanced.records, advanced.purchaseOperations)!;
  const before = 2310000 + 2 * (10000000 + 2000000) - 5000000;
  assert.equal(summary.debtMinor, before + 10 * (10000000 + 2000000), 'each remaining share recognised once, on the adelanto\'s date');
  assert.deepEqual([summary.committedMinor, summary.committedFinancingMinor, summary.pendingPlans.length], [0, 0, 0], 'nothing still to come; the plan no longer pending');
  const [row] = cardPlanSummaries(card.id, advanced.installmentPlans, advanced.records, advanced.purchaseOperations);
  assert.deepEqual([row.status, row.figures.recognisedCount, row.figures.settledMinor, row.figures.remainingMinor], ['completed', 12, 100000000, 0]);
  assert.equal(planScheduleRows(plan, advanced.records, advanced.purchaseOperations).filter(item => item.state === 'settled').length, 10);
  // The card's cycle counts it as one purchase (its principal line), never as a payment.
  const cycle = cardStatementActivity(card, advancedSnapshot, today, []);
  assert.equal(cycle.paymentsMinor, 0);
  // A devolución of $ 300.000,00 instead: $ 200.000,00 recorded comes back as credit, $ 100.000,00 off the last instalment.
  const refund = newPlanRefund(archive, { id: 'rf', planId: plan.id, amountMinor: 30000000, dateISO: today, todayISO: today, createdAt: now });
  const returned = { ...archive, purchaseOperations: [refund] };
  const returnedSnapshot = snapshotFromArchive(returned);
  const after = summarizeCard(card, returnedSnapshot, today, returned.installmentPlans, returned.records, returned.purchaseOperations)!;
  assert.equal(after.debtMinor, before - 20000000, 'the credit lowers the balance now');
  assert.equal(after.committedMinor, 10 * 10000000 - 10000000, 'the reduction lowers what is still to come, with no spending line');
  assert.equal(after.committedFinancingMinor, 10 * 2000000, 'interest is never refunded from here');
  assert.equal(cardStatementActivity(card, returnedSnapshot, today, []).refundsMinor, 20000000, '«devoluciones» in the cycle caption');
  const [returnedRow] = cardPlanSummaries(card.id, returned.installmentPlans, returned.records, returned.purchaseOperations);
  assert.deepEqual([returnedRow.figures.refundedMinor, returnedRow.figures.refundedCreditMinor, returnedRow.figures.refundedFutureMinor, returnedRow.figures.scheduledMinor],
    [30000000, 20000000, 10000000, 90000000]);
});
