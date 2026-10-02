import assert from 'node:assert/strict';
import { test } from 'node:test';
import { OPERATION_CHANGED_MESSAGE, PLAN_NOTHING_TO_STOP_MESSAGE, cancelInstallmentPlan, initialRecord, installmentEntryId, materializeInstallmentPlan, newInstallmentPlan,
  newPlanPayoff, newPlanRefund, type Account, type CreditCardProfile, type Entry, type EntryRecord, type LedgerArchive } from '@finanzapp/domain';
import { PLAN_SEGMENT_MAX, cardPlanSummaries, isPlanWriteRefusal, payoffPreview, planActions, planOperationDate, planOperationRows, planProgress, planScheduleRows, planStateWord, planSummary, purchasePreview,
  scheduleRowOpens } from '../src/ui/installment-presentation.ts';

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
  const [principal, interest] = materializeInstallmentPlan(financed, card, '2026-09-30', new Set(), []);
  assert.deepEqual([principal.id, interest.id], [installmentEntryId('nb', 1, 'principal'), installmentEntryId('nb', 1, 'interest')]);
  const both = planScheduleRows(financed, [initialRecord(principal), initialRecord(interest)], []);
  assert.deepEqual([both[0].state, both[0].recognisedMinor, both[0].undoneMinor, both[0].totalMinor], ['recognised', 50000, 0, 50000]);
  assert.deepEqual(both.slice(1).map(row => row.state), ['next', 'future']);
  const principalUndone = planScheduleRows(financed, [voided(principal), initialRecord(interest)], [])[0];
  assert.deepEqual([principalUndone.state, principalUndone.recognisedMinor, principalUndone.undoneMinor], ['partial', 10000, 40000], 'the interest still counts');
  const interestUndone = planScheduleRows(financed, [initialRecord(principal), voided(interest)], [])[0];
  assert.deepEqual([interestUndone.state, interestUndone.recognisedMinor, interestUndone.undoneMinor], ['partial', 40000, 10000]);
  const allUndone = planScheduleRows(financed, [voided(principal), voided(interest)], [])[0];
  assert.deepEqual([allUndone.state, allUndone.recognisedMinor, allUndone.undoneMinor], ['undone', 0, 50000]);
});

test('only a live plan that recorded nothing is deletable: never a cancelled one, never one with a share recorded or undone', () => {
  assert.equal(planSummary(financed, [], []).deletable, true);
  assert.equal(planSummary(cancelInstallmentPlan(financed, now), [], []).deletable, false, 'storage refuses to delete a cancelled plan');
  const [principal] = materializeInstallmentPlan(financed, card, '2026-09-30', new Set(), []);
  assert.equal(planSummary(financed, [initialRecord(principal)], []).deletable, false);
  assert.equal(planSummary(financed, [voided(principal)], []).deletable, false, 'an undone share is history too');
});

test('the card’s plan list puts live plans by their next instalment, and a live plan with nothing left to come after them', () => {
  const fresh = newInstallmentPlan({ id: 'fresh', card, cardAccount, merchant: 'Heladera', category: 'Hogar', purchaseDateISO: '2026-09-29', principalMinor: 3000, count: 3,
    placement: 'current', createdAt });
  const old = newInstallmentPlan({ id: 'old', card, cardAccount, merchant: 'Tele', category: 'Hogar', purchaseDateISO: '2026-06-10', principalMinor: 2000, count: 2,
    placement: 'current', createdAt });
  const [first, second] = materializeInstallmentPlan(old, card, '2026-09-30', new Set(), []);
  const records = [initialRecord(first), voided(second)];
  const order = cardPlanSummaries(card.id, [old, fresh], records, []).map(summary => [summary.plan.id, summary.status, summary.next?.billingDateISO ?? 'none'].join(' '));
  assert.deepEqual(order, ['fresh active 2026-10-28', 'old active none']);
});

test('on the closing day the first instalment is recorded at save, but its statement has not closed yet', () => {
  const preview = (todayISO: string) => purchasePreview({ card, cycleDates: [], purchaseDateISO: '2026-09-28', placement: 'current', principalMinor: 3000, count: 3, interestMinor: 0, todayISO })!;
  assert.deepEqual([preview('2026-09-28').firstRecordedAtSave, preview('2026-09-28').firstAlreadyClosed], [true, false]);
  assert.deepEqual([preview('2026-09-29').firstRecordedAtSave, preview('2026-09-29').firstAlreadyClosed], [true, true]);
  assert.deepEqual([preview('2026-09-27').firstRecordedAtSave, preview('2026-09-27').firstAlreadyClosed], [false, false]);
});

test('24UX6D: a plan\'s progress is the domain\'s recognised count, one segment per instalment up to 24 and a continuous bar beyond; an undone share never counts', () => {
  assert.equal(PLAN_SEGMENT_MAX, 24);
  const progress = (plan: typeof financed, records: EntryRecord[]) => planProgress(planSummary(plan, records, []), planScheduleRows(plan, records, []));
  assert.equal(JSON.stringify(progress(financed, [])), JSON.stringify({ recognisedCount: 0, total: 3, segments: ['next', 'future', 'future'], fraction: 0 }));
  const [principal, interest] = materializeInstallmentPlan(financed, card, '2026-09-30', new Set(), []);
  const one = progress(financed, [initialRecord(principal), initialRecord(interest)]);
  assert.equal(JSON.stringify([one.recognisedCount, one.segments, one.fraction]), JSON.stringify([1, ['recognised', 'next', 'future'], 1 / 3]));
  assert.equal(one.recognisedCount, planSummary(financed, [initialRecord(principal), initialRecord(interest)], []).figures.recognisedCount, 'the count is the domain figure, never re-derived');
  // The interest undone, the principal kept: the principal counts (1 of 3) and the segment says «partial».
  const partial = progress(financed, [initialRecord(principal), voided(interest)]);
  assert.equal(JSON.stringify([partial.recognisedCount, partial.segments![0]]), JSON.stringify([1, 'partial']));
  // Every share undone: nothing is recorded, and the segment says so.
  const undone = progress(financed, [voided(principal), voided(interest)]);
  assert.equal(JSON.stringify([undone.recognisedCount, undone.segments![0], undone.fraction]), JSON.stringify([0, 'undone', 0]));
  // A cancelled plan: the rest is cancelled, never future.
  assert.deepEqual(progress(cancelInstallmentPlan(financed, now), []).segments, ['cancelled', 'cancelled', 'cancelled']);
  // 24 instalments: segments; 25 or 120: one bar.
  const long = (count: number) => newInstallmentPlan({ id: 'long' + count, card, cardAccount, merchant: 'Auto', category: 'Transporte', purchaseDateISO: '2026-09-10',
    principalMinor: 1200000, count, placement: 'current', createdAt });
  assert.equal(progress(long(24), []).segments!.length, 24);
  for (const count of [25, 120]) {
    const bar = progress(long(count), []);
    assert.equal(JSON.stringify([bar.segments, bar.total, bar.fraction]), JSON.stringify([null, count, 0]));
  }
});

// ---- 24T3: actions by state, the state word, what a row opens, the adelanto preview, which refusals release a draft ----

const ledgerOf = (records: EntryRecord[], plan = financed, extra: Partial<LedgerArchive> = {}): LedgerArchive =>
  ({ accounts: [cardAccount], records, cards: [card], installmentPlans: [plan], ...extra });
const shares = (through: string) => materializeInstallmentPlan(financed, card, through, new Set(), []).map(initialRecord);

test('24T3: each action is offered only when storage would accept it (the domain dry runs on the caught-up plan), stop and delete never together', () => {
  const offered = (archive: LedgerArchive, today: string) => {
    const actions = planActions(archive, 'nb', today, now);
    return (['refund', 'payoff', 'stop', 'reactivate', 'remove'] as const).filter(key => actions[key]).join(',');
  };
  assert.equal(offered(ledgerOf([]), '2026-09-20'), 'refund,payoff,remove', 'nothing recorded: deleted, never stopped');
  const first = shares('2026-09-30');
  assert.equal(offered(ledgerOf(first), '2026-10-02'), 'refund,payoff,stop');
  const live = planActions(ledgerOf(first), 'nb', '2026-10-02', now);
  assert.equal(JSON.stringify([live.stopMinor, live.stopClosings]), JSON.stringify([100000, null]), 'two instalments of principal and interest stop');
  // Oct 29: instalment 2 closed while the app stayed open; the stop records it first, and says so.
  const late = planActions(ledgerOf(first), 'nb', '2026-10-29', now);
  assert.equal(JSON.stringify([late.stop, late.stopMinor, late.stopClosings]),
    JSON.stringify([true, 50000, { numbers: [2], totalMinor: 50000, firstClosingISO: '2026-10-28', lastClosingISO: '2026-10-28' }]));
  // Stopped after the first: the recorded principal is still returnable, and the stop is undone with the closings since named.
  const stopped = ledgerOf(first, cancelInstallmentPlan(financed, now));
  assert.equal(offered(stopped, '2026-12-01'), 'refund,reactivate');
  assert.equal(JSON.stringify(planActions(stopped, 'nb', '2026-12-01', now).reactivateClosings),
    JSON.stringify({ numbers: [2, 3], totalMinor: 100000, firstClosingISO: '2026-10-28', lastClosingISO: '2026-11-28' }));
  // Its card deleted since: its history only reads.
  assert.equal(offered({ ...stopped, cards: [{ ...card, active: false, deleted: true }] }, '2026-12-01'), '');
  // Everything brought forward: nothing left to bring forward or stop; the price is still returnable.
  const payoff = newPlanPayoff(ledgerOf(first), { id: 'po', planId: 'nb', financing: 'recognised', dateISO: '2026-10-02', todayISO: '2026-10-02', createdAt: now });
  assert.equal(offered(ledgerOf(first, financed, { purchaseOperations: [payoff] }), '2026-10-02'), 'refund');
  assert.equal(JSON.stringify(planActions(ledgerOf([]), 'missing', '2026-09-20', now)), JSON.stringify({ refund: false, payoff: false, stop: false, reactivate: false,
    remove: false, stopMinor: 0, stopClosings: null, reactivateClosings: null }));
});

test('24T3 (verifier, A6): a plan form\'s day stays between the caught-up floor and today; a floor after today is left to the domain', () => {
  const first = shares('2026-09-30');
  // Oct 29: instalment 2 closed on Oct 28 and is recorded first, so the floor is that closing.
  assert.deepEqual(planOperationDate(ledgerOf(first), 'nb', '2026-10-01', '2026-10-29'), { dateISO: '2026-10-28', floorISO: '2026-10-28' });
  assert.deepEqual(planOperationDate(ledgerOf(first), 'nb', '2026-10-28', '2026-10-29'), { dateISO: '2026-10-28', floorISO: '2026-10-28' });
  assert.deepEqual(planOperationDate(ledgerOf(first), 'nb', '2026-11-05', '2026-10-29'), { dateISO: '2026-10-29', floorISO: '2026-10-28' });
  assert.deepEqual(planOperationDate(ledgerOf(first), 'nb', '2026-10-10', '2026-10-20'), { dateISO: '2026-10-10', floorISO: '2026-09-28' });
  assert.deepEqual(planOperationDate(ledgerOf(first), 'nb', '2026-09-25', '2026-09-26'), { dateISO: '2026-09-25', floorISO: null }, 'a clock set back');
  assert.deepEqual(planOperationDate(ledgerOf([]), 'missing', '2026-10-01', '2026-10-01'), { dateISO: '2026-10-01', floorISO: null });
});

test('24T3: the state word reads the figures: brought forward, returned whole, stopped; never «pagado»', () => {
  const all = shares('2026-11-30');
  assert.equal(planStateWord(planSummary(financed, [], [])), 'active');
  assert.equal(planStateWord(planSummary(financed, all, [])), 'completed');
  assert.equal(planStateWord(planSummary(cancelInstallmentPlan(financed, now), [], [])), 'stopped');
  const first = shares('2026-09-30');
  const payoff = newPlanPayoff(ledgerOf(first), { id: 'po', planId: 'nb', financing: 'waived', dateISO: '2026-10-02', todayISO: '2026-10-02', createdAt: now });
  assert.equal(planStateWord(planSummary(financed, first, [payoff])), 'broughtForward');
  const whole = newPlanRefund(ledgerOf(all), { id: 'rf', planId: 'nb', amountMinor: 120000, dateISO: '2026-12-01', todayISO: '2026-12-01', createdAt: now });
  assert.equal(planStateWord(planSummary(financed, all, [whole])), 'refunded');
  const part = newPlanRefund(ledgerOf(all), { id: 'rf', planId: 'nb', amountMinor: 1000, dateISO: '2026-12-01', todayISO: '2026-12-01', createdAt: now });
  assert.equal(planStateWord(planSummary(financed, all, [part])), 'completed', 'a partial devolución leaves it completed');
});

test('24T3: a Calendario row opens its movement while it has one, else the operation behind its state; nothing for a plain instalment still to come', () => {
  const first = shares('2026-09-30');
  const refund = newPlanRefund(ledgerOf(first), { id: 'rf', planId: 'nb', amountMinor: 40000 + 50000, dateISO: '2026-10-02', todayISO: '2026-10-02', createdAt: now });
  const rows = planScheduleRows(financed, first, [refund]);
  // $ 900,00: $ 400,00 recorded comes back as credit; $ 500,00 takes instalment 3's principal whole and $ 100,00 off instalment
  // 2's; instalment 3 keeps its interest, so it is still to come (its row shows what it charges now).
  assert.deepEqual(rows.map(row => [row.state, row.reducedMinor, row.effectiveMinor, row.operationId, scheduleRowOpens(row)]), [
    ['recognised', 0, 50000, null, 'entry'], ['next', 10000, 40000, 'rf', 'refund'], ['future', 40000, 10000, 'rf', 'refund']]);
  const payoff = newPlanPayoff(ledgerOf(first), { id: 'po', planId: 'nb', financing: 'waived', dateISO: '2026-10-02', todayISO: '2026-10-02', createdAt: now });
  const settled = planScheduleRows(financed, first, [payoff]);
  assert.deepEqual(settled.map(row => [row.state, row.settledMinor, row.waivedMinor, scheduleRowOpens(row)]),
    [['recognised', 0, 0, 'entry'], ['settled', 40000, 10000, 'payoff'], ['settled', 40000, 10000, 'payoff']]);
  assert.equal(scheduleRowOpens({ state: 'future', operationId: null, entryId: null }), null);
  assert.equal(scheduleRowOpens({ state: 'cancelled', operationId: null, entryId: null }), null);
});

test('24T3 review: a row whose principal a devolución returned whole before it was recorded opens the financing movement it has, never the principal id', () => {
  // Instalment 1 recorded; $ 800,00 on Oct 2: $ 400,00 back to the card and instalment 3's principal whole. Through Dec 1 the
  // closings record instalment 2 and only the interest of instalment 3.
  const first = shares('2026-09-30');
  const refund = newPlanRefund(ledgerOf(first), { id: 'rf', planId: 'nb', amountMinor: 80000, dateISO: '2026-10-02', todayISO: '2026-10-02', createdAt: now });
  assert.equal(JSON.stringify([refund.creditMinor, refund.reductions]), JSON.stringify([40000, [{ number: 3, minor: 40000 }]]));
  const records = [...first, ...materializeInstallmentPlan(financed, card, '2026-12-01', new Set(first.map(record => record.entry.id)), [refund]).map(initialRecord)];
  const exists = (id: string | null) => records.some(record => record.entry.id === id);
  const third = planScheduleRows(financed, records, [refund])[2];
  assert.deepEqual([third.state, third.entryId, third.operationId, scheduleRowOpens(third)], ['recognised', installmentEntryId('nb', 3, 'interest'), 'rf', 'entry']);
  assert.equal(exists(third.entryId), true, 'the movement it opens exists');
  assert.equal(exists(installmentEntryId('nb', 3, 'principal')), false);
  const undone = planScheduleRows(financed, records.map(record => record.entry.id === third.entryId ? { ...record, voided: true, revision: 1 } : record), [refund])[2];
  assert.deepEqual([undone.state, undone.entryId, scheduleRowOpens(undone)], ['undone', installmentEntryId('nb', 3, 'interest'), 'entry']);
  // Recorded rows keep their principal's movement; a row with no movement of its own never opens one.
  assert.equal(planScheduleRows(financed, records, [refund])[0].entryId, installmentEntryId('nb', 1, 'principal'));
  assert.equal(scheduleRowOpens({ state: 'partial', operationId: 'rf', entryId: null }), 'refund');
  assert.equal(scheduleRowOpens({ state: 'partial', operationId: null, entryId: null }), null);
});

test('24T3 review: a plan\'s devoluciones and adelantos, live and undone, newest first, and nobody else\'s (A26)', () => {
  const first = shares('2026-09-30');
  const a = newPlanRefund(ledgerOf(first), { id: 'rf-a', planId: 'nb', amountMinor: 1000, dateISO: '2026-10-01', todayISO: '2026-10-02', createdAt: now });
  const b = { ...newPlanRefund(ledgerOf(first, financed, { purchaseOperations: [a] }), { id: 'rf-b', planId: 'nb', amountMinor: 2000, dateISO: '2026-10-02', todayISO: '2026-10-02',
    createdAt: now }), voided: true };
  const payoff = newPlanPayoff(ledgerOf(first, financed, { purchaseOperations: [a] }), { id: 'po', planId: 'nb', financing: 'waived', dateISO: '2026-10-02', todayISO: '2026-10-02',
    createdAt: '2026-10-02T13:00:00.000Z' });
  const other = { ...a, id: 'rf-x', target: { planId: 'other' } };
  assert.deepEqual(planOperationRows('nb', [a, other, b, payoff]).map(row => [row.id, row.kind, row.dateISO, row.amountMinor, row.voided]),
    [['po', 'payoff', '2026-10-02', payoff.amountMinor, false], ['rf-b', 'refund', '2026-10-02', 2000, true], ['rf-a', 'refund', '2026-10-01', 1000, false]]);
  assert.deepEqual(planOperationRows('nb', []), []);
});

test('24T3: the adelanto preview is what Save sends, on the caught-up plan: per component, the choice it still needs, the date floor and the undone shares it leaves', () => {
  const first = shares('2026-09-30');
  const input = (financing: 'recognised' | 'waived' | null, todayISO = '2026-10-02') => ({ id: 'op-1', createdAt: now, financing, dateISO: todayISO, todayISO });
  const open = payoffPreview(ledgerOf(first), 'nb', input(null));
  assert.ok(open.ok);
  assert.equal(JSON.stringify([open.preview.components, open.preview.numbers, open.preview.principalMinor, open.preview.financingMinor, open.preview.choiceNeeded, open.preview.floorISO]),
    JSON.stringify([[{ component: 'principal', minor: 80000 }, { component: 'interest', minor: 20000 }], [2, 3], 80000, 20000, true, '2026-09-28']));
  const recognised = payoffPreview(ledgerOf(first), 'nb', input('recognised'));
  const waived = payoffPreview(ledgerOf(first), 'nb', input('waived'));
  assert.ok(recognised.ok && waived.ok);
  assert.equal(JSON.stringify([recognised.preview.recordedMinor, recognised.preview.choiceNeeded, waived.preview.recordedMinor, waived.preview.payoff.financing]),
    JSON.stringify([100000, false, 80000, 'waived']));
  assert.equal(JSON.stringify(recognised.preview.payoff), JSON.stringify(newPlanPayoff(ledgerOf(first), { id: 'op-1', planId: 'nb', financing: 'recognised',
    dateISO: '2026-10-02', todayISO: '2026-10-02', createdAt: now })), 'exactly the domain\'s adelanto');
  // Oct 29: instalment 2 closed; storage records it before the adelanto, and so does the preview (A13: the preview is the commit).
  const late = payoffPreview(ledgerOf(first), 'nb', input('recognised', '2026-10-29'));
  assert.ok(late.ok);
  assert.equal(JSON.stringify([late.preview.numbers, late.preview.floorISO, late.preview.recordedMinor]), JSON.stringify([[3], '2026-10-28', 50000]));
  // An undone share stays undone and pending.
  const undone = payoffPreview(ledgerOf(first.map(record => ({ ...record, voided: true, revision: 1, updatedAt: now }))), 'nb', input('recognised'));
  assert.ok(undone.ok);
  assert.deepEqual([undone.preview.undoneNumbers, undone.preview.numbers], [[1], [2, 3]]);
  const refused = payoffPreview(ledgerOf(first, cancelInstallmentPlan(financed, now)), 'nb', input('recognised'));
  assert.equal(JSON.stringify(refused), JSON.stringify({ ok: false, message: 'Este plan no se sigue. Reactivalo primero.' }));
});

test('24T3 (A13): a refusal storage gives before writing releases the draft; a failed or unverified write keeps it frozen', () => {
  for (const message of [OPERATION_CHANGED_MESSAGE, PLAN_NOTHING_TO_STOP_MESSAGE, 'El plan de cuotas cambió desde que lo abriste. Volvé a revisarlo.',
    'No quedan cuotas por adelantar.', 'Un adelanto usa esas cuotas. Deshacé el adelanto primero.']) assert.equal(isPlanWriteRefusal(message), true, message);
  for (const message of ['No pudimos guardar: disco lleno.', 'El guardado terminó, pero no pudimos actualizar la vista. Verificá de nuevo antes de registrar otro movimiento; no lo cargues otra vez.',
    'installments.payoff.saveFailed']) assert.equal(isPlanWriteRefusal(message), false, message);
});
