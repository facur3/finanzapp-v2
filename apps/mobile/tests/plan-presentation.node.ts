import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cancelInstallmentPlan, initialRecord, installmentEntryId, materializeInstallmentPlan, newInstallmentPlan, type Account, type CreditCardProfile, type Entry,
  type EntryRecord } from '@finanzapp/domain';
import { cardPlanSummaries, planScheduleRows, planSummary, purchasePreview } from '../src/ui/installment-presentation.ts';

// Producto 24T2 review round: a plan's rows are read component by component (each share has its own movement), a
// cancelled plan is never offered as deletable, the plan list keeps plans with nothing left to come last, and the closing
// day is not «already closed».
const createdAt = '2026-09-01T12:00:00.000Z';
const now = '2026-10-02T12:00:00.000Z';
const cardAccount: Account = { id: 'card-account', name: 'Visa', currency: 'ARS', openingMinor: 0, createdAt };
const card: CreditCardProfile = { id: 'card', accountId: cardAccount.id, issuer: '', last4: '', creditLimitMinor: null, closingDay: 28, dueDay: 5,
  active: true, deleted: false, createdAt, revision: 0, updatedAt: createdAt };
const financed = newInstallmentPlan({ id: 'nb', card, cardAccount, merchant: 'Notebook', category: 'Tecnología', purchaseDateISO: '2026-09-10', principalMinor: 120000,
  count: 3, placement: 'current', interestMinor: 30000, interestCategory: 'Intereses', createdAt });
const voided = (entry: Entry): EntryRecord => ({ ...initialRecord(entry), revision: 1, voided: true, updatedAt: now });

test('each row reads every share of its instalment: recognised, undone, or partial when only one of them was undone', () => {
  const [principal, interest] = materializeInstallmentPlan(financed, card, '2026-09-30', new Set());
  assert.deepEqual([principal.id, interest.id], [installmentEntryId('nb', 1, 'principal'), installmentEntryId('nb', 1, 'interest')]);
  const both = planScheduleRows(financed, [initialRecord(principal), initialRecord(interest)]);
  assert.deepEqual([both[0].state, both[0].recognisedMinor, both[0].undoneMinor, both[0].totalMinor], ['recognised', 50000, 0, 50000]);
  assert.deepEqual(both.slice(1).map(row => row.state), ['next', 'future']);
  const principalUndone = planScheduleRows(financed, [voided(principal), initialRecord(interest)])[0];
  assert.deepEqual([principalUndone.state, principalUndone.recognisedMinor, principalUndone.undoneMinor], ['partial', 10000, 40000], 'the interest still counts');
  const interestUndone = planScheduleRows(financed, [initialRecord(principal), voided(interest)])[0];
  assert.deepEqual([interestUndone.state, interestUndone.recognisedMinor, interestUndone.undoneMinor], ['partial', 40000, 10000]);
  const allUndone = planScheduleRows(financed, [voided(principal), voided(interest)])[0];
  assert.deepEqual([allUndone.state, allUndone.recognisedMinor, allUndone.undoneMinor], ['undone', 0, 50000]);
});

test('only a live plan that recorded nothing is deletable: never a cancelled one, never one with a share recorded or undone', () => {
  assert.equal(planSummary(financed, []).deletable, true);
  assert.equal(planSummary(cancelInstallmentPlan(financed, now), []).deletable, false, 'storage refuses to delete a cancelled plan');
  const [principal] = materializeInstallmentPlan(financed, card, '2026-09-30', new Set());
  assert.equal(planSummary(financed, [initialRecord(principal)]).deletable, false);
  assert.equal(planSummary(financed, [voided(principal)]).deletable, false, 'an undone share is history too');
});

test('the card’s plan list puts live plans by their next instalment, and a live plan with nothing left to come after them', () => {
  const fresh = newInstallmentPlan({ id: 'fresh', card, cardAccount, merchant: 'Heladera', category: 'Hogar', purchaseDateISO: '2026-09-29', principalMinor: 3000, count: 3,
    placement: 'current', createdAt });
  const old = newInstallmentPlan({ id: 'old', card, cardAccount, merchant: 'Tele', category: 'Hogar', purchaseDateISO: '2026-06-10', principalMinor: 2000, count: 2,
    placement: 'current', createdAt });
  const [first, second] = materializeInstallmentPlan(old, card, '2026-09-30', new Set());
  const records = [initialRecord(first), voided(second)];
  const order = cardPlanSummaries(card.id, [old, fresh], records).map(summary => [summary.plan.id, summary.status, summary.next?.billingDateISO ?? 'none'].join(' '));
  assert.deepEqual(order, ['fresh active 2026-10-28', 'old active none']);
});

test('on the closing day the first instalment is recorded at save, but its statement has not closed yet', () => {
  const preview = (todayISO: string) => purchasePreview({ card, cycleDates: [], purchaseDateISO: '2026-09-28', placement: 'current', principalMinor: 3000, count: 3, interestMinor: 0, todayISO })!;
  assert.deepEqual([preview('2026-09-28').firstRecordedAtSave, preview('2026-09-28').firstAlreadyClosed], [true, false]);
  assert.deepEqual([preview('2026-09-29').firstRecordedAtSave, preview('2026-09-29').firstAlreadyClosed], [true, true]);
  assert.deepEqual([preview('2026-09-27').firstRecordedAtSave, preview('2026-09-27').firstAlreadyClosed], [false, false]);
});
