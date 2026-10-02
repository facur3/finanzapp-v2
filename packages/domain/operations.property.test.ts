import { describe, expect, it } from 'vitest';
import {
  INSTALLMENT_COMPONENTS, accountBalanceMinor, applyNewOperation, applyOperationChange, assertInstallmentPlanCancellable, cancelInstallmentPlan,
  cardCommittedFinancingMinor, cardCommittedMinor, createRecoveryBackup, effectiveShares, initialRecord, installmentEntryId, installmentOccurrenceOf,
  installmentPlanFigures, installmentPlanStatus, isEntryRefund, isPlanPayoff, isPlanRefund, isPurchaseLine, makeOperationChange, newEntryRefund,
  newInstallmentPlan, newPlanPayoff, newPlanRefund, parsePilotBackup, pendingInstallmentPlans, planCatchUpInserts, planRefundAvailability,
  previewBackupImport, reactivateInstallmentPlan, sameOperationAllocation, sameOperationInputs, snapshotFromArchive, summarizeMonth,
  validateArchive, validateInstallmentPlanChange,
  type Account, type CreditCardProfile, type Entry, type EntryRecord, type InstallmentComponent, type InstallmentPlan, type InstallmentState,
  type LedgerArchive, type PayoffFinancing, type PurchaseOperation, type TransferRecord,
} from './index';

/** Producto 24T3, independent adversarial verification: a random walk over every public write of the domain core
 * (catch-up, instalment undo/restore, devoluciones, adelantos, their undo/restore, stop/reactivate, card payments and edits
 * of refunded purchases), with every invariant recomputed from the raw archive (records + operations) after every step
 * that the domain accepted. Synthetic fixtures only. */

function prng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const addDays = (iso: string, days: number) => new Date(Date.parse(iso + 'T00:00:00Z') + days * 86400000).toISOString().slice(0, 10);
const stamp = (iso: string) => `${iso}T18:00:00.000Z`;
const amountOf = (row: InstallmentPlan['schedule'][number], component: InstallmentComponent) => row[`${component}Minor`];

const T0 = '2025-12-01T12:00:00.000Z';
const bank: Account = { id: 'bank', name: 'Banco', currency: 'ARS', openingMinor: 900_000_000, createdAt: T0 };
const cardAccount: Account = { id: 'visa-acc', name: 'Visa', currency: 'ARS', openingMinor: 0, createdAt: T0 };

interface World { archive: LedgerArchive; today: string; card: CreditCardProfile }

function buildWorld(random: () => number): World {
  const int = (min: number, max: number) => min + Math.floor(random() * (max - min + 1));
  const odd = (min: number, max: number) => int(min, max) | 1;
  const card: CreditCardProfile = { id: 'visa', accountId: cardAccount.id, issuer: 'Banco', last4: '1234', creditLimitMinor: null, closingDay: int(1, 28),
    dueDay: int(1, 28), active: true, deleted: false, createdAt: T0, revision: 0, updatedAt: T0 };
  const financing = () => {
    const interestMinor = random() < 0.5 ? odd(1, 300_001) : 0, feeMinor = random() < 0.3 ? odd(1, 9_999) : 0, taxMinor = random() < 0.3 ? odd(1, 7_777) : 0;
    return { interestMinor, interestCategory: interestMinor ? 'Intereses' : '', feeMinor, feeCategory: feeMinor ? 'Comisiones' : '', taxMinor, taxCategory: taxMinor ? 'Impuestos' : '' };
  };
  const plans: InstallmentPlan[] = [];
  const planCount = int(1, 3);
  for (let index = 0; index < planCount; index++) {
    const count = int(1, 24);
    const purchaseDateISO = addDays('2026-01-01', int(0, 50));
    plans.push(newInstallmentPlan({ id: `plan${index}`, card, cardAccount, merchant: `Tienda ${index}`, category: 'Hogar', purchaseDateISO,
      principalMinor: odd(count, 2_400_001), count, placement: random() < 0.5 ? 'current' : 'next', ...financing(), createdAt: stamp(purchaseDateISO) }));
  }
  const records: EntryRecord[] = [];
  for (let index = 0; index < int(2, 5); index++) {
    const dateISO = addDays('2026-01-01', int(0, 50));
    records.push(initialRecord({ id: `buy${index}`, accountId: random() < 0.5 ? bank.id : cardAccount.id, kind: 'expense', amountMinor: odd(1, 900_001),
      merchant: `Comercio ${index}`, category: random() < 0.5 ? 'Ropa' : 'Super', dateISO, createdAt: stamp(dateISO) }));
  }
  records.push(initialRecord({ id: 'salary', accountId: bank.id, kind: 'income', amountMinor: 5_000_000, merchant: 'Empleador', category: 'Sueldo',
    dateISO: '2026-01-05', createdAt: stamp('2026-01-05') }));
  const today = '2026-02-20';
  let archive: LedgerArchive = { accounts: [bank, cardAccount], records, cards: [card], installmentPlans: plans };
  archive = catchUpAll(archive, today);
  validateArchive(archive);
  return { archive, today, card };
}

function catchUpPlan(archive: LedgerArchive, planId: string, today: string): LedgerArchive {
  const inserts = planCatchUpInserts(archive, planId, today);
  return inserts.length ? { ...archive, records: [...archive.records, ...inserts] } : archive;
}
function catchUpAll(archive: LedgerArchive, today: string): LedgerArchive {
  let next = archive;
  for (const plan of archive.installmentPlans ?? []) next = catchUpPlan(next, plan.id, today);
  return next;
}
const replacePlan = (archive: LedgerArchive, plan: InstallmentPlan): LedgerArchive =>
  ({ ...archive, installmentPlans: archive.installmentPlans!.map(item => item.id === plan.id ? plan : item) });

/** Every invariant, recomputed from the raw archive (never from the figures it checks). */
function checkInvariants(archive: LedgerArchive, today: string, card: CreditCardProfile): void {
  validateArchive(archive);
  const operations = archive.purchaseOperations ?? [];
  const live = operations.filter(operation => !operation.voided);
  const records = new Map(archive.records.map(record => [record.entry.id, record]));
  let planCreditTotal = 0n, payoffRecognisedTotal = 0n, instalmentRecognisedTotal = 0n, figuresRecognisedTotal = 0n, figuresCreditTotal = 0n;
  let committedPrincipal = 0n, committedFinancing = 0n;
  const pending = new Set(pendingInstallmentPlans(card, archive.installmentPlans ?? [], archive.records, operations).map(plan => plan.id));

  for (const plan of archive.installmentPlans ?? []) {
    const planLive = live.filter(operation => isPlanRefund(operation) || isPlanPayoff(operation)).filter(operation => (operation.target as { planId: string }).planId === plan.id);
    const refunds = planLive.filter(isPlanRefund), payoffs = planLive.filter(isPlanPayoff);
    const reductions = new Map<number, bigint>();
    for (const refund of refunds) for (const row of refund.reductions) reductions.set(row.number, (reductions.get(row.number) ?? 0n) + BigInt(row.minor));
    const coverage = new Map<string, { financing: PayoffFinancing; minor: number }>();
    for (const payoff of payoffs) {
      for (const row of payoff.covered) {
        const key = `${row.number}|${row.component}`;
        expect(coverage.has(key), `share ${key} of ${plan.id} covered by two live adelantos`).toBe(false);
        coverage.set(key, { financing: payoff.financing, minor: row.minor });
        if (row.component === 'principal' || payoff.financing === 'recognised') payoffRecognisedTotal += BigInt(row.minor);
      }
    }
    type Sums = Record<'recognised' | 'settled' | 'scheduled' | 'undone' | 'cancelled' | 'waived' | 'reduced', bigint>;
    const sums = Object.fromEntries(INSTALLMENT_COMPONENTS.map(component => [component,
      { recognised: 0n, settled: 0n, scheduled: 0n, undone: 0n, cancelled: 0n, waived: 0n, reduced: 0n }])) as Record<InstallmentComponent, Sums>;
    const expectedStates = new Map<string, InstallmentState>();
    let liveShareOpen = false;
    const stopped = plan.cancelledAt !== null || plan.deleted;
    for (const row of plan.schedule) {
      for (const component of INSTALLMENT_COMPONENTS) {
        const schedule = BigInt(amountOf(row, component));
        if (schedule <= 0n) continue;
        const reduced = component === 'principal' ? reductions.get(row.number) ?? 0n : 0n;
        expect(reduced <= schedule, `reductions over share ${row.number}`).toBe(true);
        const effective = schedule - reduced;
        const sum = sums[component];
        sum.reduced += reduced;
        const record = records.get(installmentEntryId(plan.id, row.number, component));
        const cover = coverage.get(`${row.number}|${component}`);
        let state: InstallmentState;
        if (record) {
          // No share is recognised twice: never a movement and an adelanto for one share.
          expect(cover, `share ${row.number}/${component} of ${plan.id} has a movement and an adelanto`).toBeUndefined();
          expect(BigInt(record.entry.amountMinor)).toBe(effective);
          expect(record.entry.dateISO).toBe(row.billingDateISO);
          if (record.voided) { sum.undone += effective; state = 'undone'; }
          else { sum.recognised += effective; instalmentRecognisedTotal += effective; state = 'recognised'; }
        } else if (cover) {
          expect(BigInt(cover.minor)).toBe(effective);
          if (component !== 'principal' && cover.financing === 'waived') { sum.waived += effective; state = 'waived'; }
          else { sum.recognised += effective; sum.settled += effective; state = 'settled'; }
        } else if (effective === 0n) state = 'refunded';
        else if (stopped) { sum.cancelled += effective; state = 'cancelled'; }
        else {
          sum.scheduled += effective;
          state = 'scheduled';
          // The catch-up never leaves a closed statement behind on a live plan.
          expect(row.billingDateISO > today, `share ${row.number}/${component} of ${plan.id} closed ${row.billingDateISO} and is still unrecorded on ${today}`).toBe(true);
          if (component === 'principal') committedPrincipal += effective; else committedFinancing += effective;
        }
        if (state === 'scheduled' || state === 'undone') liveShareOpen = true;
        expectedStates.set(`${row.number}|${component}`, state);
      }
    }
    // The effective shares agree with the raw classification.
    for (const share of effectiveShares(plan, archive.records, operations)) {
      expect(share.state, `state of ${plan.id} ${share.number}/${share.component}`).toBe(expectedStates.get(`${share.number}|${share.component}`));
    }
    const figures = installmentPlanFigures(plan, archive.records, operations);
    const credit = refunds.reduce((total, refund) => total + BigInt(refund.creditMinor), 0n);
    const refunded = refunds.reduce((total, refund) => total + BigInt(refund.amountMinor), 0n);
    const reducedTotal = [...reductions.values()].reduce((total, value) => total + value, 0n);
    // Σ refunds = Σ credit + Σ reductions.
    expect(refunded).toBe(credit + reducedTotal);
    expect([figures.refundedMinor, figures.refundedCreditMinor, figures.refundedFutureMinor]).toEqual([Number(refunded), Number(credit), Number(reducedTotal)]);
    for (const component of INSTALLMENT_COMPONENTS) {
      const sum = sums[component], c = figures.components[component];
      expect([c.recognisedMinor, c.settledMinor, c.scheduledMinor, c.undoneMinor, c.cancelledMinor, c.waivedMinor, c.refundedFutureMinor],
        `figures of ${plan.id}/${component}`).toEqual([sum.recognised, sum.settled, sum.scheduled, sum.undone, sum.cancelled, sum.waived, sum.reduced].map(Number));
      // A1 gross: recognised (movements + adelantos) + scheduled + reductions + undone + cancelled + waived = total.
      expect(BigInt(c.recognisedMinor + c.scheduledMinor + c.refundedFutureMinor + c.undoneMinor + c.cancelledMinor + c.waivedMinor)).toBe(BigInt(plan[`${component}Minor`]));
      expect(c.remainingMinor).toBe(c.scheduledMinor + c.undoneMinor + c.cancelledMinor);
    }
    // A1 net, with nothing undone or cancelled.
    const principal = figures.components.principal;
    if (principal.undoneMinor === 0 && principal.cancelledMinor === 0) {
      expect(BigInt(principal.recognisedMinor) - credit + BigInt(principal.scheduledMinor)).toBe(BigInt(plan.principalMinor) - refunded);
    }
    // Σ credit never exceeds principal recognised (movements that count + adelantos).
    expect(credit <= BigInt(principal.recognisedMinor)).toBe(true);
    // Status and pending follow the effective shares.
    const status = plan.deleted ? 'deleted' : plan.cancelledAt !== null ? 'cancelled' : liveShareOpen ? 'active' : 'completed';
    expect(installmentPlanStatus(plan, archive.records, operations)).toBe(status);
    expect(figures.status).toBe(status);
    expect(pending.has(plan.id)).toBe(status === 'active');
    expect(figures.recognisedCount).toBe([...expectedStates].filter(([key, state]) => key.endsWith('|principal') && (state === 'recognised' || state === 'settled')).length);
    planCreditTotal += credit;
    figuresCreditTotal += credit;
    for (const component of INSTALLMENT_COMPONENTS) figuresRecognisedTotal += BigInt(figures.components[component].recognisedMinor);
  }
  expect(cardCommittedMinor(card, archive.installmentPlans ?? [], archive.records, operations)).toBe(Number(committedPrincipal));
  expect(cardCommittedFinancingMinor(card, archive.installmentPlans ?? [], archive.records, operations)).toBe(Number(committedFinancing));

  // Ordinary purchases: Σ live devoluciones ≤ the purchase, the purchase live, same account, dated on or before.
  const entryRefunds = live.filter(isEntryRefund);
  const byTarget = new Map<string, bigint>();
  for (const refund of entryRefunds) {
    const target = records.get(refund.target.entryId)!;
    expect(target && !target.voided && target.entry.kind === 'expense' && target.entry.accountId === refund.accountId && target.entry.dateISO <= refund.dateISO).toBe(true);
    byTarget.set(refund.target.entryId, (byTarget.get(refund.target.entryId) ?? 0n) + BigInt(refund.amountMinor));
  }
  for (const [entryId, total] of byTarget) expect(total <= BigInt(records.get(entryId)!.entry.amountMinor)).toBe(true);

  // The projection.
  const snapshot = snapshotFromArchive(archive);
  const ids = new Set<string>();
  for (const entry of snapshot.entries) {
    expect(ids.has(entry.id), `duplicate ledger id ${entry.id}`).toBe(false);
    ids.add(entry.id);
    if (entry.refund || entry.payoff) {
      expect(entry.amountMinor, `projected line ${entry.id} with amount 0`).not.toBe(0);
      expect(entry.kind).toBe('expense');
      expect(!!entry.refund && !!entry.payoff).toBe(false);
      if (entry.refund) { expect(entry.amountMinor).toBeLessThan(0); expect(isPurchaseLine(entry)).toBe(false); }
      if (entry.payoff) expect(entry.amountMinor).toBeGreaterThan(0);
    } else {
      expect(records.get(entry.id)?.entry).toBe(entry);
    }
    // A refund is never an income: every income line is a stored income movement.
    if (entry.kind === 'income') expect(records.get(entry.id)?.entry.kind).toBe('income');
  }
  const expectedLines = entryRefunds.length + live.filter(isPlanRefund).filter(refund => refund.creditMinor > 0).length
    + live.filter(isPlanPayoff).reduce((total, payoff) => total + INSTALLMENT_COMPONENTS.filter(component =>
      (component === 'principal' || payoff.financing === 'recognised') && payoff.covered.some(row => row.component === component)).length, 0);
  expect(snapshot.entries.filter(entry => entry.refund || entry.payoff).length).toBe(expectedLines);
  // Determinism: the same archive, and the same archive with its operations in another order, read the same.
  expect(JSON.stringify(snapshotFromArchive(archive))).toBe(JSON.stringify(snapshot));
  expect(JSON.stringify(snapshotFromArchive({ ...archive, purchaseOperations: [...operations].reverse() }))).toBe(JSON.stringify(snapshot));
  // Spending in every month: income is the stored income only.
  for (const month of new Set(snapshot.entries.map(entry => entry.dateISO.slice(0, 7)))) {
    const end = addDays(addDays(month + '-01', 32).slice(0, 7) + '-01', -1);
    const summary = summarizeMonth(snapshot, 'ARS', end);
    const income = archive.records.filter(record => !record.voided && record.entry.kind === 'income' && record.entry.dateISO.startsWith(month))
      .reduce((total, record) => total + record.entry.amountMinor, 0);
    expect(summary.status === 'ready' && summary.incomeMinor).toBe(income);
  }

  // Card balance, recomputed from the raw rows: opening − ordinary card purchases + their devoluciones − instalment movements
  // − adelanto recognition + plan credit + payments.
  const transfers = (archive.transfers ?? []).filter(record => !record.voided).map(record => record.transfer);
  let cardBalance = BigInt(cardAccount.openingMinor);
  let ordinaryCard = 0n, entryRefundCard = 0n;
  for (const record of archive.records) {
    if (record.voided || record.entry.accountId !== cardAccount.id || installmentOccurrenceOf(record.entry.id)) continue;
    if (record.entry.kind === 'expense') ordinaryCard += BigInt(record.entry.amountMinor); else cardBalance += BigInt(record.entry.amountMinor);
  }
  for (const refund of entryRefunds) if (refund.accountId === cardAccount.id) entryRefundCard += BigInt(refund.amountMinor);
  cardBalance += -ordinaryCard + entryRefundCard - instalmentRecognisedTotal - payoffRecognisedTotal + planCreditTotal;
  for (const transfer of transfers) {
    if (transfer.toAccountId === cardAccount.id) cardBalance += BigInt(transfer.amountMinor);
    if (transfer.fromAccountId === cardAccount.id) cardBalance -= BigInt(transfer.amountMinor);
  }
  expect(BigInt(accountBalanceMinor(cardAccount, snapshot.entries, snapshot.transfers))).toBe(cardBalance);
  // The same balance through the plan figures (what Tarjetas and the plan detail show).
  expect(figuresRecognisedTotal - figuresCreditTotal).toBe(instalmentRecognisedTotal + payoffRecognisedTotal - planCreditTotal);
  let bankBalance = BigInt(bank.openingMinor);
  for (const record of archive.records) {
    if (record.voided || record.entry.accountId !== bank.id) continue;
    bankBalance += record.entry.kind === 'income' ? BigInt(record.entry.amountMinor) : -BigInt(record.entry.amountMinor);
  }
  for (const refund of entryRefunds) if (refund.accountId === bank.id) bankBalance += BigInt(refund.amountMinor);
  for (const transfer of transfers) {
    if (transfer.toAccountId === bank.id) bankBalance += BigInt(transfer.amountMinor);
    if (transfer.fromAccountId === bank.id) bankBalance -= BigInt(transfer.amountMinor);
  }
  expect(BigInt(accountBalanceMinor(bank, snapshot.entries, snapshot.transfers))).toBe(bankBalance);
}

type Action = 'advance' | 'toggle-instalment' | 'entry-refund' | 'plan-refund' | 'payoff' | 'change-operation' | 'cancel' | 'reactivate' | 'pay'
  | 'edit-purchase' | 'recategorise' | 'backup';
const ACTIONS: [Action, number][] = [['advance', 16], ['toggle-instalment', 8], ['entry-refund', 9], ['plan-refund', 14], ['payoff', 10],
  ['change-operation', 16], ['cancel', 5], ['reactivate', 5], ['pay', 4], ['edit-purchase', 7], ['recategorise', 3], ['backup', 2]];

function runWalk(seed: number, steps: number, tally: Map<string, number>, refusals: Map<string, number>): void {
  const random = prng(seed);
  const int = (min: number, max: number) => min + Math.floor(random() * (max - min + 1));
  const pick = <T,>(items: readonly T[]): T | undefined => items.length ? items[Math.floor(random() * items.length)] : undefined;
  const world = buildWorld(random);
  let { archive, today } = world;
  const { card } = world;
  checkInvariants(archive, today, card);
  const totalWeight = ACTIONS.reduce((total, [, weight]) => total + weight, 0);
  for (let step = 0; step < steps; step++) {
    let roll = random() * totalWeight;
    const action = ACTIONS.find(([, weight]) => (roll -= weight) < 0)![0];
    const id = `op-${seed}-${step}`;
    const plans = archive.installmentPlans ?? [];
    let next: LedgerArchive | null = null;
    // A refusal must be a domain refusal (a plain Error with a message), never a crash.
    const attempt = (write: () => LedgerArchive | null) => {
      try { next = write(); }
      catch (error) {
        // A failed assertion of this test, or a crash (TypeError, RangeError…), is never a refusal.
        if (!(error instanceof Error) || error.constructor !== Error) throw error;
        expect((error as Error).message.length).toBeGreaterThan(0);
        refusals.set(`${action}: ${(error as Error).message}`, (refusals.get(`${action}: ${(error as Error).message}`) ?? 0) + 1);
        next = null;
      }
    };
    switch (action) {
      case 'advance': {
        // The foreground catch-up never fails on a valid archive.
        today = addDays(today, int(0, 62));
        next = catchUpAll(archive, today);
        validateArchive(next);
        break;
      }
      case 'toggle-instalment': {
        const record = pick(archive.records.filter(item => installmentOccurrenceOf(item.entry.id)));
        if (!record) break;
        attempt(() => {
          const changed = { ...archive, records: archive.records.map(item => item === record
            ? { ...item, voided: !item.voided, revision: item.revision + 1, updatedAt: stamp(today) } : item) };
          validateArchive(changed, record.voided ? 'restore' : 'void');
          return changed;
        });
        break;
      }
      case 'entry-refund': {
        const target = pick(archive.records.filter(item => !installmentOccurrenceOf(item.entry.id)));
        if (!target) break;
        attempt(() => {
          const available = Math.max(0, target.entry.amountMinor - (archive.purchaseOperations ?? []).filter(item => !item.voided && isEntryRefund(item)
            && item.target.entryId === target.entry.id).reduce((total, item) => total + item.amountMinor, 0));
          const amountMinor = random() < 0.1 ? available + int(1, 50) : random() < 0.3 ? available : int(1, Math.max(1, available));
          const dateISO = addDays(target.entry.dateISO, int(-3, 40));
          const operation = newEntryRefund(archive, { id, entryId: target.entry.id, amountMinor, dateISO: dateISO > today && random() < 0.8 ? today : dateISO, todayISO: today, createdAt: stamp(today) });
          return applyNewOperation(archive, operation, today);
        });
        break;
      }
      case 'plan-refund':
      case 'payoff': {
        const plan = pick(plans);
        if (!plan) break;
        attempt(() => {
          const caught = catchUpPlan(archive, plan.id, today);
          const availability = planRefundAvailability(caught, plan.id);
          const floor = availability.floorISO;
          const span = Math.max(0, Math.round((Date.parse(today) - Date.parse(floor)) / 86400000));
          const dateISO = random() < 0.1 ? addDays(floor, -int(1, 20)) : addDays(floor, int(0, span));
          let operation: PurchaseOperation;
          if (action === 'plan-refund') {
            const cap = availability.availableMinor;
            const amountMinor = random() < 0.08 ? cap + 1 : random() < 0.25 ? cap : int(1, Math.max(1, cap));
            operation = newPlanRefund(caught, { id, planId: plan.id, amountMinor, dateISO, todayISO: today, createdAt: stamp(today) });
            // The allocation is deterministic: the same inputs on the same ledger allocate the same money (A13).
            expect(sameOperationAllocation(operation, newPlanRefund(caught, { id: id + 'x', planId: plan.id, amountMinor, dateISO, todayISO: today, createdAt: stamp(today) }))).toBe(true);
            // A single creation leaves at most one of the shares it reduces above zero (the tail goes first).
            const before = new Map(effectiveShares(plan, caught.records, caught.purchaseOperations ?? []).filter(share => share.component === 'principal')
              .map(share => [share.number, share.amountMinor]));
            expect('reductions' in operation && operation.reductions.filter(row => row.minor < before.get(row.number)!).length <= 1).toBe(true);
          } else {
            operation = newPlanPayoff(caught, { id, planId: plan.id, financing: random() < 0.5 ? 'recognised' : 'waived', dateISO, todayISO: today, createdAt: stamp(today) });
          }
          const result = applyNewOperation(caught, operation, today);
          // A12: a retry with the same inputs is recognised as the stored row, whatever was recomputed since.
          expect(sameOperationInputs(operation, { ...operation })).toBe(true);
          return result;
        });
        break;
      }
      case 'change-operation': {
        const operation = pick(archive.purchaseOperations ?? []);
        if (!operation) break;
        attempt(() => applyOperationChange(archive, makeOperationChange(`ch-${seed}-${step}`, operation, operation.voided ? 'restore' : 'void', stamp(today)), today).archive);
        break;
      }
      case 'cancel': {
        const plan = pick(plans);
        if (!plan) break;
        attempt(() => {
          const caught = catchUpPlan(archive, plan.id, today);
          assertInstallmentPlanCancellable(plan, caught.records, caught.purchaseOperations ?? []);
          const after = cancelInstallmentPlan(plan, stamp(today));
          validateInstallmentPlanChange(plan, after);
          const changed = replacePlan(caught, after);
          validateArchive(changed, 'cancel');
          return changed;
        });
        break;
      }
      case 'reactivate': {
        const plan = pick(plans.filter(item => item.cancelledAt !== null));
        if (!plan) break;
        attempt(() => {
          const after = reactivateInstallmentPlan(plan, stamp(today));
          validateInstallmentPlanChange(plan, after);
          const changed = catchUpPlan(replacePlan(archive, after), plan.id, today);
          validateArchive(changed, 'reactivate');
          return changed;
        });
        break;
      }
      case 'pay': {
        const amountMinor = int(1, 3_000_000);
        const transfer: TransferRecord = { transfer: { id: `pay-${seed}-${step}`, fromAccountId: bank.id, toAccountId: cardAccount.id, amountMinor, note: 'Pago', dateISO: today,
          createdAt: stamp(today) }, revision: 0, voided: false, updatedAt: stamp(today) };
        attempt(() => { const changed = { ...archive, transfers: [...archive.transfers ?? [], transfer] }; validateArchive(changed); return changed; });
        break;
      }
      case 'edit-purchase': {
        // A refunded purchase keeps its account, kind, a date on or before its first devolución and an amount ≥ what was
        // returned (A10); anything else of it may change. The refusal is predicted from the raw rows.
        const record = pick(archive.records.filter(item => !installmentOccurrenceOf(item.entry.id) && item.entry.kind === 'expense'));
        if (!record) break;
        const refunds = (archive.purchaseOperations ?? []).filter(item => !item.voided && isEntryRefund(item) && item.target.entryId === record.entry.id);
        const refunded = refunds.reduce((total, item) => total + item.amountMinor, 0);
        const kind = int(0, 5);
        const entry: Entry = { ...record.entry };
        let voided = record.voided;
        if (kind === 0) entry.amountMinor = Math.max(1, refunded - int(-5, 5));
        else if (kind === 1) entry.accountId = entry.accountId === bank.id ? cardAccount.id : bank.id;
        else if (kind === 2) entry.category = entry.category === 'Ropa' ? 'Super' : 'Ropa';
        else if (kind === 3) voided = !voided;
        else if (kind === 4) entry.dateISO = addDays(entry.dateISO, int(-5, 30));
        else entry.kind = 'income';
        const firstRefund = refunds.map(item => item.dateISO).sort()[0];
        const refusedExpected = refunds.length > 0 && (entry.amountMinor < refunded || entry.accountId !== record.entry.accountId || voided
          || entry.kind !== 'expense' || entry.dateISO > firstRefund);
        let refused = false;
        attempt(() => {
          const changed = { ...archive, records: archive.records.map(item => item === record ? { entry, voided, revision: item.revision + 1, updatedAt: stamp(today) } : item) };
          try { validateArchive(changed, 'edit'); } catch (error) { refused = true; throw error; }
          return changed;
        });
        expect(refused, `edit ${kind} of ${record.entry.id} with ${refunded} returned`).toBe(refusedExpected);
        break;
      }
      case 'recategorise': {
        // A30: a recorded instalment may change category; a plan devolución's credit follows the latest recorded principal share.
        const record = pick(archive.records.filter(item => installmentOccurrenceOf(item.entry.id)?.component === 'principal'));
        if (!record) break;
        attempt(() => {
          const changed = { ...archive, records: archive.records.map(item => item === record
            ? { ...item, entry: { ...item.entry, category: item.entry.category === 'Hogar' ? 'Tecnología' : 'Hogar' }, revision: item.revision + 1, updatedAt: stamp(today) } : item) };
          validateArchive(changed, 'edit');
          return changed;
        });
        break;
      }
      case 'backup': {
        // v14 round trip: the copy reads back as the same archive and imports onto itself as identical.
        const parsed = parsePilotBackup(JSON.stringify(createRecoveryBackup(archive, new Date(stamp(today))))).archive;
        const preview = previewBackupImport(archive, parsed);
        expect([preview.conflicts, preview.purchaseOperations.length, preview.records.length]).toEqual([0, 0, 0]);
        expect(JSON.stringify(snapshotFromArchive(parsed).entries.map(entry => entry.id).sort())).toBe(JSON.stringify(snapshotFromArchive(archive).entries.map(entry => entry.id).sort()));
        next = archive;
        break;
      }
    }
    if (next) {
      archive = next;
      tally.set(action, (tally.get(action) ?? 0) + 1);
      checkInvariants(archive, today, card);
      // A13/A30: a plan devolución's credit line is in the category of the latest live recorded principal share.
      for (const line of snapshotFromArchive(archive).entries.filter(entry => entry.refund?.targetPlanId)) {
        const planId = line.refund!.targetPlanId!;
        const latest = archive.records.filter(record => !record.voided && installmentOccurrenceOf(record.entry.id)?.planId === planId
          && installmentOccurrenceOf(record.entry.id)?.component === 'principal').sort((a, b) => b.entry.id.localeCompare(a.entry.id))[0];
        expect(line.category).toBe(latest?.entry.category ?? plans.find(plan => plan.id === planId)!.category);
      }
    }
  }
}

describe('24T3 adversarial property: every public write keeps the ledger whole', () => {
  it('random plans (1–24 instalments, odd amounts, financing) under random operations, undo, restore, stop, reactivate and edits', () => {
    const tally = new Map<string, number>(), refusals = new Map<string, number>();
    for (let seed = 1; seed <= 60; seed++) runWalk(seed * 7919, 70, tally, refusals);
    // Every kind of write was accepted at least once (the walk is not vacuous).
    for (const [action] of ACTIONS) expect(tally.get(action) ?? 0, `${action} never accepted`).toBeGreaterThan(0);
    expect(tally.get('change-operation')!).toBeGreaterThan(30);
    expect(refusals.size).toBeGreaterThan(5);
  }, 60000);
});

// ---- targeted adversarial scenarios (crit-accounting, crit-state-machine, crit-retry-undo) ----------------------------------

const visa: CreditCardProfile = { id: 'visa', accountId: cardAccount.id, issuer: 'Banco', last4: '1234', creditLimitMinor: 5_000_000, closingDay: 20, dueDay: 5,
  active: true, deleted: false, createdAt: T0, revision: 0, updatedAt: T0 };
const usdAccount: Account = { id: 'usd', name: 'Dólares', currency: 'USD', openingMinor: 0, createdAt: T0 };
/** 12 × 100,00 bought 2026-01-10; instalment k closes on 2026-k-20. */
const tv = newInstallmentPlan({ id: 'tv', card: visa, cardAccount, merchant: 'Electro', category: 'Hogar', purchaseDateISO: '2026-01-10', principalMinor: 120000,
  count: 12, placement: 'current', createdAt: stamp('2026-01-10') });
const tvi = newInstallmentPlan({ id: 'tvi', card: visa, cardAccount, merchant: 'Electro', category: 'Hogar', purchaseDateISO: '2026-01-10', principalMinor: 120000,
  count: 12, placement: 'current', interestMinor: 12000, interestCategory: 'Intereses', createdAt: stamp('2026-01-10') });
const shirt: Entry = { id: 'shirt', accountId: bank.id, kind: 'expense', amountMinor: 30000, merchant: 'Tienda', category: 'Ropa', dateISO: '2026-03-05', createdAt: stamp('2026-03-05') };
const onCard: Entry = { id: 'jacket', accountId: cardAccount.id, kind: 'expense', amountMinor: 50000, merchant: 'Tienda', category: 'Ropa', dateISO: '2026-03-05', createdAt: stamp('2026-03-05') };
let opSequence = 0;
const nextId = () => `adv-${++opSequence}`;
const ledger = (today: string, plans: InstallmentPlan[] = [tv], extra: Partial<LedgerArchive> = {}): LedgerArchive =>
  catchUpAll({ accounts: [bank, cardAccount, usdAccount], records: [initialRecord(shirt), initialRecord(onCard)], cards: [visa], installmentPlans: plans, ...extra }, today);
const operationOf = (archive: LedgerArchive, id: string) => archive.purchaseOperations!.find(item => item.id === id)!;
function planRefund(archive: LedgerArchive, planId: string, amountMinor: number, dateISO: string, today = dateISO) {
  const caught = catchUpAll(archive, today);
  const op = newPlanRefund(caught, { id: nextId(), planId, amountMinor, dateISO, todayISO: today, createdAt: stamp(today) });
  return { archive: applyNewOperation(caught, op, today), op };
}
function payoff(archive: LedgerArchive, planId: string, financing: PayoffFinancing, dateISO: string, today = dateISO) {
  const caught = catchUpAll(archive, today);
  const op = newPlanPayoff(caught, { id: nextId(), planId, financing, dateISO, todayISO: today, createdAt: stamp(today) });
  return { archive: applyNewOperation(caught, op, today), op };
}
function entryRefund(archive: LedgerArchive, entryId: string, amountMinor: number, dateISO: string, today = dateISO) {
  const op = newEntryRefund(archive, { id: nextId(), entryId, amountMinor, dateISO, todayISO: today, createdAt: stamp(today) });
  return { archive: applyNewOperation(archive, op, today), op };
}
const toggle = (archive: LedgerArchive, id: string, action: 'void' | 'restore', today: string) =>
  applyOperationChange(archive, makeOperationChange(nextId(), operationOf(archive, id), action, stamp(today)), today);
const voidOp = (archive: LedgerArchive, id: string, today: string) => toggle(archive, id, 'void', today).archive;
const restoreOp = (archive: LedgerArchive, id: string, today: string) => toggle(archive, id, 'restore', today).archive;
const editRecord = (archive: LedgerArchive, id: string, change: (record: EntryRecord) => EntryRecord, context: 'edit' | 'void' | 'restore' = 'edit') => {
  const next = { ...archive, records: archive.records.map(record => record.entry.id === id ? { ...change(record), revision: record.revision + 1, updatedAt: stamp('2026-12-31') } : record) };
  validateArchive(next, context);
  return next;
};
const withCard = (archive: LedgerArchive, card: CreditCardProfile) => ({ ...archive, cards: [card] });
const pay = (archive: LedgerArchive, amountMinor: number, dateISO: string): LedgerArchive => ({ ...archive, transfers: [...archive.transfers ?? [],
  { transfer: { id: `pay-${dateISO}-${amountMinor}`, fromAccountId: bank.id, toAccountId: cardAccount.id, amountMinor, note: 'Pago', dateISO, createdAt: stamp(dateISO) },
    revision: 0, voided: false, updatedAt: stamp(dateISO) }] });

describe('24T3 adversarial scenarios', () => {
  it('two live adelantos never cover one share: undo P1, create P2, restore P1; a double tap; an import (accounting 2, retry-undo 2)', () => {
    const april = ledger('2026-04-25');
    const p1 = payoff(april, 'tv', 'recognised', '2026-04-25');
    const undone = voidOp(p1.archive, p1.op.id, '2026-04-26');
    const p2 = payoff(undone, 'tv', 'recognised', '2026-04-26');
    expect(() => restoreOp(p2.archive, p1.op.id, '2026-04-27')).toThrow('Algunas cuotas ya se registraron o se adelantaron; registrá un adelanto nuevo.');
    // Double tap: two sheets allocated on the same ledger, two ids; the second commit is refused, not double counted.
    const caught = catchUpAll(april, '2026-04-25');
    const first = newPlanPayoff(caught, { id: nextId(), planId: 'tv', financing: 'recognised', dateISO: '2026-04-25', todayISO: '2026-04-25', createdAt: stamp('2026-04-25') });
    const second = newPlanPayoff(caught, { id: nextId(), planId: 'tv', financing: 'recognised', dateISO: '2026-04-25', todayISO: '2026-04-25', createdAt: stamp('2026-04-25') });
    expect(() => applyNewOperation(applyNewOperation(caught, first, '2026-04-25'), second, '2026-04-25')).toThrow('Las cuotas cambiaron desde que abriste el formulario; revisá.');
    // Import: a copy holding P1 onto a device that made P2.
    const copy = parsePilotBackup(JSON.stringify(createRecoveryBackup(p1.archive))).archive;
    const device = payoff(april, 'tv', 'recognised', '2026-04-25').archive;
    expect(() => previewBackupImport(device, copy)).toThrow('La copia tiene devoluciones o adelantos que no encajan con las cuotas de este dispositivo. No se importó nada.');
  });

  it('a devolución and an adelanto never drift apart: undo a devolución an adelanto absorbed; restore either across the other (accounting 3–4)', () => {
    const april = ledger('2026-04-25');
    // 4 shares recognised (40000); R = 95000: credit 40000, reductions 12 … 8 → 0 and 7 → 5000.
    const r = planRefund(april, 'tv', 95000, '2026-04-25');
    expect([r.op.creditMinor, r.op.reductions]).toEqual([40000, [{ number: 7, minor: 5000 }, { number: 8, minor: 10000 }, { number: 9, minor: 10000 },
      { number: 10, minor: 10000 }, { number: 11, minor: 10000 }, { number: 12, minor: 10000 }]]);
    const p = payoff(r.archive, 'tv', 'recognised', '2026-04-25');
    expect(p.op.covered.map(row => [row.number, row.minor])).toEqual([[5, 10000], [6, 10000], [7, 5000]]);
    expect(() => voidOp(p.archive, r.op.id, '2026-04-26')).toThrow('Un adelanto usa esas cuotas. Deshacé el adelanto primero.');
    // Payoff first, undone; a devolución reduces the tail; the payoff restored would cover share 12 at its full amount.
    const p1 = payoff(april, 'tv', 'recognised', '2026-04-25');
    const r1 = planRefund(voidOp(p1.archive, p1.op.id, '2026-04-25'), 'tv', 50000, '2026-04-25');
    expect(r1.op.reductions).toEqual([{ number: 12, minor: 10000 }]);
    expect(() => restoreOp(r1.archive, p1.op.id, '2026-04-25')).toThrow('Una devolución y un adelanto usan las mismas cuotas; no se puede restaurar.');
    // The reverse order: the devolución undone, an adelanto made, the devolución restored.
    const r2 = planRefund(april, 'tv', 50000, '2026-04-25');
    const p2 = payoff(voidOp(r2.archive, r2.op.id, '2026-04-25'), 'tv', 'waived', '2026-04-25');
    expect(() => restoreOp(p2.archive, r2.op.id, '2026-04-25')).toThrow('Una devolución y un adelanto usan las mismas cuotas; no se puede restaurar.');
  });

  it('backdated and future-dated plan operations are refused at creation; crafted ones are refused by the archive (accounting 5–7, A4e, A6)', () => {
    const october = ledger('2026-10-25');
    for (const date of ['2026-01-05', '2026-08-20', '2026-10-19', '2026-10-26']) {
      expect(() => planRefund(october, 'tv', 1000, date, '2026-10-25')).toThrow('Elegí una fecha entre la última cuota registrada del plan y hoy.');
      expect(() => payoff(october, 'tv', 'recognised', date, '2026-10-25')).toThrow('Elegí una fecha entre la última cuota registrada del plan y hoy.');
    }
    expect(planRefund(october, 'tv', 1000, '2026-10-20', '2026-10-25').op.creditMinor).toBe(1000);
    const done = payoff(october, 'tv', 'recognised', '2026-10-21', '2026-10-25');
    // Crafted (an import, a bug): the same adelanto dated after a covered closing, or before a recorded one, or leaving a share.
    const replace = (patch: Partial<PurchaseOperation>) => ({ ...done.archive, purchaseOperations: [{ ...done.op, ...patch } as PurchaseOperation] });
    expect(() => validateArchive(replace({ dateISO: '2026-11-25' }))).toThrow('Un adelanto usa esas cuotas. Deshacé el adelanto primero.');
    expect(() => validateArchive(replace({ dateISO: '2026-09-25' }))).toThrow('Un adelanto usa esas cuotas. Deshacé el adelanto primero.');
    const partial = { ...done.op, covered: done.op.covered.slice(0, -1), amountMinor: done.op.amountMinor - 10000 } as PurchaseOperation;
    expect(() => validateArchive({ ...done.archive, purchaseOperations: [partial] })).toThrow('Un adelanto usa esas cuotas. Deshacé el adelanto primero.');
    // A plan devolución dated before the purchase is refused by the archive itself.
    const early = planRefund(october, 'tv', 1000, '2026-10-20', '2026-10-25');
    expect(() => validateArchive({ ...early.archive, purchaseOperations: [{ ...early.op, dateISO: '2026-01-01' }] })).toThrow('Una devolución o un adelanto de cuotas no es válido. No se modificó nada.');
  });

  it('a refunded purchase keeps its account, kind, amount floor and date; voiding it is refused until its devoluciones are undone (accounting 8, A10)', () => {
    const base = ledger('2026-03-10');
    const r = entryRefund(base, 'shirt', 30000, '2026-03-10');
    const linked = 'Esta compra tiene devoluciones registradas. Deshacelas primero.';
    expect(() => editRecord(r.archive, 'shirt', record => ({ ...record, entry: { ...record.entry, accountId: cardAccount.id } }))).toThrow(linked);
    expect(() => editRecord(r.archive, 'shirt', record => ({ ...record, entry: { ...record.entry, accountId: usdAccount.id } }))).toThrow(linked);
    expect(() => editRecord(r.archive, 'shirt', record => ({ ...record, entry: { ...record.entry, kind: 'income' } }))).toThrow(linked);
    expect(() => editRecord(r.archive, 'shirt', record => ({ ...record, entry: { ...record.entry, amountMinor: 29999 } }))).toThrow(linked);
    expect(() => editRecord(r.archive, 'shirt', record => ({ ...record, entry: { ...record.entry, dateISO: '2026-03-11' } }))).toThrow(linked);
    expect(() => editRecord(r.archive, 'shirt', record => ({ ...record, voided: true }), 'void')).toThrow(linked);
    // A category edit moves the devolución with it (read time).
    const moved = editRecord(r.archive, 'shirt', record => ({ ...record, entry: { ...record.entry, category: 'Regalos' } }));
    expect(snapshotFromArchive(moved).entries.find(entry => entry.id === r.op.id)!.category).toBe('Regalos');
    const free = voidOp(r.archive, r.op.id, '2026-03-11');
    expect(() => editRecord(free, 'shirt', record => ({ ...record, voided: true }), 'void')).not.toThrow();
    // Restoring a devolución another one replaced since names that, not a changed purchase.
    const again = entryRefund(free, 'shirt', 30000, '2026-03-11');
    expect(() => restoreOp(again.archive, r.op.id, '2026-03-12')).toThrow('Otra devolución ya usa lo que queda por devolver de esta compra; no se puede restaurar.');
    // Over-refund at creation; a target that is an instalment; an income; dated before the purchase or after today.
    expect(() => entryRefund(r.archive, 'shirt', 1, '2026-03-10')).toThrow('La devolución supera lo que queda por devolver de esta compra.');
    expect(() => entryRefund(ledger('2026-03-25'), installmentEntryId('tv', 1), 100, '2026-03-25')).toThrow('Una devolución se registra sobre un gasto guardado que no sea una cuota.');
    expect(() => entryRefund(base, 'shirt', 100, '2026-03-04', '2026-03-10')).toThrow('Elegí una fecha entre la de la compra y hoy.');
    expect(() => entryRefund(base, 'shirt', 100, '2026-03-11', '2026-03-10')).toThrow('Elegí una fecha entre la de la compra y hoy.');
  });

  it('undo and restore never touch a deleted card or account; creation on them is refused (accounting 9, retry-undo 5, A9)', () => {
    const april = ledger('2026-04-25');
    const p = payoff(april, 'tv', 'recognised', '2026-04-25');
    const snapshot = snapshotFromArchive(p.archive);
    const zero = pay(p.archive, -accountBalanceMinor(cardAccount, snapshot.entries, snapshot.transfers), '2026-04-26');
    const zeroSnapshot = snapshotFromArchive(zero);
    expect(accountBalanceMinor(cardAccount, zeroSnapshot.entries, zeroSnapshot.transfers)).toBe(0);
    const gone = withCard(zero, { ...visa, active: false, deleted: true, revision: 1, updatedAt: stamp('2026-04-27') });
    const deleted = 'La tarjeta o la cuenta fue eliminada; su historial no cambia.';
    expect(() => voidOp(gone, p.op.id, '2026-04-28')).toThrow(deleted);
    expect(() => toggle(gone, p.op.id, 'void', '2026-04-28')).toThrow(deleted);
    const undoneThenGone = withCard(voidOp(zero, p.op.id, '2026-04-26'), { ...visa, active: false, deleted: true, revision: 1, updatedAt: stamp('2026-04-27') });
    expect(() => restoreOp(undoneThenGone, p.op.id, '2026-04-28')).toThrow(deleted);
    expect(() => planRefund(gone, 'tv', 100, '2026-04-28')).toThrow('Esta tarjeta fue eliminada.');
    // A cash devolución on a deleted account.
    const cash = entryRefund(april, 'shirt', 1000, '2026-04-25');
    const closed = { ...cash.archive, accounts: cash.archive.accounts.map(account => account.id === bank.id ? { ...account, deletedAt: stamp('2026-04-26'), revision: 1, updatedAt: stamp('2026-04-26') } : account) };
    expect(() => voidOp(closed, cash.op.id, '2026-04-27')).toThrow(deleted);
    expect(() => entryRefund(closed, 'shirt', 1000, '2026-04-27')).toThrow('La cuenta de esta compra fue eliminada.');
  });

  it('a card holding a credit after a devolución is archived, never deleted (accounting 10, B3)', async () => {
    const { assertCardDeletable } = await import('./index');
    const paid = pay(ledger('2026-03-10', []), 50000, '2026-03-06');
    const r = entryRefund(paid, 'jacket', 20000, '2026-03-10');
    expect(() => assertCardDeletable(visa, snapshotFromArchive(r.archive), [], r.archive.records, r.archive.purchaseOperations!)).toThrow('Tiene saldo a favor; archivala.');
  });

  it('a plan devolución’s credit follows the category of the latest recorded principal share (accounting 11, A30)', () => {
    const april = ledger('2026-04-25');
    const recategorised = [1, 2, 3, 4].reduce((archive, number) => editRecord(archive, installmentEntryId('tv', number),
      record => ({ ...record, entry: { ...record.entry, category: 'Tecnología' } })), april);
    const r = planRefund(recategorised, 'tv', 30000, '2026-04-25');
    const line = snapshotFromArchive(r.archive).entries.find(entry => entry.id === r.op.id)!;
    expect([line.category, line.amountMinor]).toEqual(['Tecnología', -30000]);
    const april2026 = summarizeMonth(snapshotFromArchive(r.archive), 'ARS', '2026-04-30');
    expect(april2026.status === 'ready' && april2026.incomeMinor).toBe(0);
  });

  it('the open cycle counts an adelanto with interest as one purchase plus financing, and a devolución as a refund (accounting 12, A19)', async () => {
    const { cardStatementActivity } = await import('./index');
    const april = ledger('2026-04-25', [tvi]);
    const p = payoff(april, 'tvi', 'recognised', '2026-04-25');
    const r = planRefund(p.archive, 'tvi', 5000, '2026-04-26');
    const activity = cardStatementActivity(visa, snapshotFromArchive(r.archive), '2026-04-26');
    expect([activity.purchasesMinor, activity.purchaseCount, activity.financingMinor, activity.refundsMinor]).toEqual([80000, 1, 8000, 5000]);
  });

  it('a principal refunded to zero is done: no financing → completed, not pending; financing left → still pending (accounting 17, state-machine 7, 13)', () => {
    const april = ledger('2026-04-25', [tv, tvi]);
    const all = planRefund(planRefund(april, 'tv', 120000, '2026-04-25').archive, 'tvi', 120000, '2026-04-25');
    const operations = all.archive.purchaseOperations!;
    expect(installmentPlanStatus(tv, all.archive.records, operations)).toBe('completed');
    expect(installmentPlanStatus(tvi, all.archive.records, operations)).toBe('active');
    expect(pendingInstallmentPlans(visa, [tv, tvi], all.archive.records, operations).map(plan => plan.id)).toEqual(['tvi']);
    expect(cardCommittedMinor(visa, [tv, tvi], all.archive.records, operations)).toBe(0);
    expect(cardCommittedFinancingMinor(visa, [tv, tvi], all.archive.records, operations)).toBe(8000);
    // Nothing of the principal is left to bring forward: a financing-only adelanto is refused (state-machine 24, A4d).
    expect(() => payoff(all.archive, 'tvi', 'waived', '2026-04-25')).toThrow('No queda precio por adelantar. Para dejar de registrar el interés, dejá de seguir el plan.');
    // The catch-up never records a share reduced to zero.
    const later = catchUpAll(all.archive, '2026-12-31');
    expect(later.records.filter(record => installmentOccurrenceOf(record.entry.id)?.planId === 'tv')).toHaveLength(4);
  });

  it('a stale preview is refused; a retry of a committed operation is recognised by its inputs (accounting 19, state-machine 8–9, retry-undo 13–14)', async () => {
    const { assertExpectedAllocation, OPERATION_CHANGED_MESSAGE } = await import('./index');
    const april = ledger('2026-04-25');
    const input = { id: 'retry-1', planId: 'tv', amountMinor: 50000, dateISO: '2026-04-25', todayISO: '2026-04-25', createdAt: stamp('2026-04-25') };
    const previewed = newPlanRefund(april, input);
    expect([previewed.creditMinor, previewed.reductions]).toEqual([40000, [{ number: 12, minor: 10000 }]]);
    // Meanwhile another screen undid instalment 4: storage allocates again and refuses what the person did not see.
    const changed = editRecord(april, installmentEntryId('tv', 4), record => ({ ...record, voided: true }), 'void');
    const committed = newPlanRefund(changed, input);
    expect(() => assertExpectedAllocation(committed, previewed)).toThrow(OPERATION_CHANGED_MESSAGE);
    // A closing passed between the sheet and the commit: the date is now before the plan's floor (A6), a deterministic refusal.
    const eve = ledger('2026-04-19');
    const evening = newPlanRefund(eve, { ...input, id: 'retry-2', dateISO: '2026-04-19', todayISO: '2026-04-19' });
    expect(() => newPlanRefund(catchUpAll(eve, '2026-04-20'), { ...input, id: 'retry-2', dateISO: '2026-04-19', todayISO: '2026-04-20' }))
      .toThrow('Elegí una fecha entre la última cuota registrada del plan y hoy.');
    // The same commit without the catch-up is refused by the pure step itself (A8): it would reduce a closed statement.
    expect(() => applyNewOperation(eve, evening, '2026-04-20')).toThrow(OPERATION_CHANGED_MESSAGE);
    // Committed, then the refresh failed; the retry arrives after a closing: same inputs → the stored row, whatever was recomputed.
    const stored = applyNewOperation(april, previewed, '2026-04-25');
    expect(sameOperationInputs(operationOf(stored, 'retry-1'), previewed)).toBe(true);
    expect(sameOperationInputs(operationOf(stored, 'retry-1'), { ...previewed, creditMinor: 0, reductions: [{ number: 8, minor: 50000 }] } as PurchaseOperation)).toBe(true);
    expect(sameOperationInputs(operationOf(stored, 'retry-1'), { ...previewed, amountMinor: 50001 })).toBe(false);
    // An operation is created live at revision 0, never undone or advanced.
    const fresh = newPlanPayoff(april, { id: 'retry-3', planId: 'tv', financing: 'recognised', dateISO: '2026-04-25', todayISO: '2026-04-25', createdAt: stamp('2026-04-25') });
    expect(() => applyNewOperation(april, { ...fresh, voided: true, revision: 1, updatedAt: stamp('2026-04-26') }, '2026-04-25'))
      .toThrow('Una devolución o un adelanto de cuotas no es válido. No se modificó nada.');
  });

  it('stopping, reactivating and the operations of a stopped plan (state-machine 15–16, retry-undo 1, 6–7, A9, A15)', () => {
    const april = ledger('2026-04-25');
    const p = payoff(april, 'tv', 'recognised', '2026-04-25');
    expect(() => assertInstallmentPlanCancellable(tv, p.archive.records, p.archive.purchaseOperations!)).toThrow('Este plan no tiene cuotas por registrar; no hay nada que dejar de seguir.');
    // Payoff undone, plan stopped: restoring the payoff is refused until the plan is reactivated.
    const undone = voidOp(p.archive, p.op.id, '2026-04-26');
    assertInstallmentPlanCancellable(tv, undone.records, undone.purchaseOperations!);
    const stoppedPlan = cancelInstallmentPlan(tv, stamp('2026-04-26'));
    validateInstallmentPlanChange(tv, stoppedPlan);
    const stopped = replacePlan(undone, stoppedPlan);
    validateArchive(stopped, 'cancel');
    expect(() => restoreOp(stopped, p.op.id, '2026-04-27')).toThrow('Este plan no se sigue. Reactivalo primero.');
    expect(() => payoff(stopped, 'tv', 'recognised', '2026-04-27')).toThrow('Este plan no se sigue. Reactivalo primero.');
    // A stopped plan takes credit only.
    expect(planRefund(stopped, 'tv', 40000, '2026-04-27').op).toMatchObject({ creditMinor: 40000, reductions: [] });
    expect(() => planRefund(stopped, 'tv', 40001, '2026-04-27')).toThrow('La devolución supera lo que queda por devolver de esta compra.');
    // Reactivated in July: May–July closings are recorded on their own dates, once; the payoff is then not restorable.
    const reactivatedPlan = reactivateInstallmentPlan(stoppedPlan, stamp('2026-07-25'));
    validateInstallmentPlanChange(stoppedPlan, reactivatedPlan);
    expect(() => validateInstallmentPlanChange(stoppedPlan, { ...stoppedPlan, cancelledAt: stamp('2026-07-25'), revision: stoppedPlan.revision + 1 })).toThrow();
    const back = catchUpPlan(replacePlan(stopped, reactivatedPlan), 'tv', '2026-07-25');
    expect(back.records.filter(record => installmentOccurrenceOf(record.entry.id)?.planId === 'tv').map(record => record.entry.dateISO).slice(4))
      .toEqual(['2026-05-20', '2026-06-20', '2026-07-20']);
    validateArchive(back, 'reactivate');
    expect(() => restoreOp(back, p.op.id, '2026-07-25')).toThrow('Algunas cuotas ya se registraron o se adelantaron; registrá un adelanto nuevo.');
    // A devolución with reductions on a plan stopped since: undo and restore wait for reactivation.
    const r = planRefund(april, 'tv', 50000, '2026-04-25');
    const stoppedAfter = replacePlan(r.archive, cancelInstallmentPlan(tv, stamp('2026-04-26')));
    validateArchive(stoppedAfter, 'cancel');
    expect(() => voidOp(stoppedAfter, r.op.id, '2026-04-27')).toThrow('Este plan no se sigue. Reactivalo primero.');
  });

  it('undoing an adelanto validates after the catch-up; a devolución resting on it decides (retry-undo 10, state-machine 10, C9)', () => {
    const july = ledger('2026-07-01');
    const p = payoff(july, 'tv', 'recognised', '2026-07-01');
    const r = planRefund(p.archive, 'tv', 90000, '2026-08-01');
    expect(r.op).toMatchObject({ creditMinor: 90000, reductions: [] });
    // In August only share 7 closed: 70000 recognised < 90000 credit.
    expect(() => voidOp(r.archive, p.op.id, '2026-08-01')).toThrow('Una devolución usa estas cuotas. Deshacé la devolución primero.');
    // In October shares 7–9 are recorded on their own closings inside the same step: 90000 = 90000.
    const october = toggle(r.archive, p.op.id, 'void', '2026-10-01');
    expect(october.inserts.map(record => [record.entry.id, record.entry.dateISO])).toEqual([[installmentEntryId('tv', 7), '2026-07-20'],
      [installmentEntryId('tv', 8), '2026-08-20'], [installmentEntryId('tv', 9), '2026-09-20']]);
    checkInvariants(october.archive, '2026-10-01', visa);
  });

  it('undoing a devolución whose reduced shares closed records them on their closings (state-machine 11, C9); a recorded reduced share refuses it', () => {
    const feb = ledger('2026-02-25');
    const r = planRefund(feb, 'tv', 50000, '2026-02-25');
    expect(r.op.reductions.map(row => row.number)).toEqual([10, 11, 12]);
    const later = catchUpAll(r.archive, '2026-11-25');
    expect(later.records.some(record => record.entry.id === installmentEntryId('tv', 10))).toBe(false);
    const undone = toggle(later, r.op.id, 'void', '2026-11-25');
    expect(undone.inserts.map(record => record.entry.dateISO)).toEqual(['2026-10-20', '2026-11-20']);
    // Partly reduced share recorded at its reduced amount, then undone: the devolución cannot be undone (drift includes undone records).
    const partial = planRefund(feb, 'tv', 45000, '2026-02-25');
    const recorded = catchUpAll(partial.archive, '2026-10-25');
    expect(recorded.records.find(record => record.entry.id === installmentEntryId('tv', 10))!.entry.amountMinor).toBe(5000);
    const shareUndone = editRecord(recorded, installmentEntryId('tv', 10), record => ({ ...record, voided: true }), 'void');
    expect(() => voidOp(shareUndone, partial.op.id, '2026-10-25')).toThrow('Ya se registraron cuotas que esta devolución redujo; no se puede deshacer.');
  });

  it('ids, shapes and links of crafted operations (accounting 31, 33–34; state-machine 14–15, 23)', async () => {
    const april = ledger('2026-04-25');
    const r = planRefund(april, 'tv', 50000, '2026-04-25');
    const p = payoff(april, 'tv', 'recognised', '2026-04-25');
    const repeated = 'Una devolución o un adelanto de cuotas repite un identificador. No se modificó nada.';
    const invalid = 'Una devolución o un adelanto de cuotas no es válido. No se modificó nada.';
    expect(() => validateArchive({ ...r.archive, purchaseOperations: [{ ...r.op, id: 'shirt' }] })).toThrow(repeated);
    expect(() => validateArchive({ ...r.archive, purchaseOperations: [{ ...r.op, id: 'tv' }] })).toThrow(repeated);
    expect(() => validateArchive({ ...r.archive, purchaseOperations: [r.op, { ...r.op }] })).toThrow(repeated);
    const lineClash: Entry = { ...shirt, id: p.op.id + '_p' };
    expect(() => validateArchive({ ...p.archive, records: [...p.archive.records, initialRecord(lineClash)] })).toThrow(repeated);
    const transferClash = pay(r.archive, 100, '2026-04-25');
    expect(() => validateArchive({ ...transferClash, purchaseOperations: [{ ...r.op, id: transferClash.transfers![0].transfer.id.replace(/[^a-zA-Z0-9-]/g, '') }],
      transfers: transferClash.transfers!.map(item => ({ ...item, transfer: { ...item.transfer, id: item.transfer.id.replace(/[^a-zA-Z0-9-]/g, '') } })) })).toThrow(repeated);
    for (const bad of [{ id: 'has_underscore' }, { accountId: bank.id }, { currency: 'USD' }, { creditMinor: r.op.creditMinor + 1 },
      { reductions: [{ number: 12, minor: 0 }] }, { reductions: [{ number: 12, minor: 5000 }, { number: 12, minor: 5000 }] }, { reductions: [{ number: 13, minor: 10000 }] }]) {
      expect(() => validateArchive({ ...r.archive, purchaseOperations: [{ ...r.op, ...bad } as PurchaseOperation] }), JSON.stringify(bad)).toThrow();
    }
    expect(() => validateArchive({ ...r.archive, purchaseOperations: [{ ...r.op, accountId: bank.id }] })).toThrow(invalid);
    for (const bad of [{ covered: [...p.op.covered, { number: 12, component: 'principal', minor: 10000 }] }, { amountMinor: p.op.amountMinor + 1 },
      { covered: p.op.covered.map((row, index) => index === 0 ? { ...row, minor: 0 } : row) }, { financing: 'maybe' }]) {
      expect(() => validateArchive({ ...p.archive, purchaseOperations: [{ ...p.op, ...bad } as PurchaseOperation] }), JSON.stringify(bad)).toThrow(invalid);
    }
    // A live operation on a deleted plan; a deleted plan takes no devolución; a plan with any operation is never deleted.
    const deletedPlan = { ...tv, deleted: true, revision: 1, updatedAt: stamp('2026-04-26') };
    expect(() => validateArchive(replacePlan(r.archive, deletedPlan))).toThrow(invalid);
    expect(() => planRefund(replacePlan(april, deletedPlan), 'tv', 100, '2026-04-26')).toThrow('Este plan de cuotas fue eliminado.');
    // A plan with nothing recorded and one devolución, undone since, is still never deleted (A16; retry-undo 22 kept by design).
    const { assertInstallmentPlanDeletable } = await import('./index');
    const january = ledger('2026-01-11');
    const early = planRefund(january, 'tv', 10000, '2026-01-11');
    expect(early.op).toMatchObject({ creditMinor: 0, reductions: [{ number: 12, minor: 10000 }] });
    expect(snapshotFromArchive(early.archive).entries.some(entry => entry.refund)).toBe(false);
    const undone = voidOp(early.archive, early.op.id, '2026-01-12');
    expect(() => assertInstallmentPlanDeletable(tv, undone.records, undone.purchaseOperations!))
      .toThrow('Este plan tiene devoluciones o adelantos registrados. Dejá de seguirlo; no se puede eliminar.');
    expect(() => assertInstallmentPlanDeletable(tv, undone.records, [])).not.toThrow();
  });

  it('the projection never stops the ledger from opening: an orphan operation projects nothing (accounting 30)', () => {
    const r = entryRefund(ledger('2026-03-10'), 'shirt', 1000, '2026-03-10');
    const orphan = { ...r.archive, records: r.archive.records.filter(record => record.entry.id !== 'shirt') };
    expect(() => snapshotFromArchive(orphan)).not.toThrow();
    expect(snapshotFromArchive(orphan).entries.some(entry => entry.refund)).toBe(false);
    expect(() => validateArchive(orphan)).toThrow('Una devolución o un adelanto de cuotas no encuentra su compra. No se modificó nada.');
  });

  it('an import whose operations contradict this device’s instalments is refused with the import sentence (retry-undo 19, A20, A22)', () => {
    // The copy was taken in February with a devolución that reduced instalments 11–12; this device (restored from an older
    // copy) recorded every instalment through December at full amount.
    const february = ledger('2026-02-25');
    const r = planRefund(february, 'tv', 40000, '2026-02-25');
    expect(r.op.reductions.map(row => row.number)).toEqual([11, 12]);
    const copy = parsePilotBackup(JSON.stringify(createRecoveryBackup(r.archive))).archive;
    const device = catchUpAll(february, '2026-12-25');
    expect(() => previewBackupImport(device, copy)).toThrow('La copia tiene devoluciones o adelantos que no encajan con las cuotas de este dispositivo. No se importó nada.');
    // The same copy onto a device that has recorded nothing new imports the operation, additive by id.
    const preview = previewBackupImport(february, copy);
    expect([preview.conflicts, preview.purchaseOperations.map(item => item.id)]).toEqual([0, [r.op.id]]);
    // The same id undone on one side and live on the other is a conflict, never merged.
    const undoneHere = voidOp(r.archive, r.op.id, '2026-02-26');
    expect(previewBackupImport(undoneHere, copy).conflicts).toBe(1);
  });

  it('an undone share is not brought forward and keeps the plan pending after an adelanto (accounting 37)', () => {
    const april = ledger('2026-04-25');
    const share4 = editRecord(april, installmentEntryId('tv', 4), record => ({ ...record, voided: true }), 'void');
    const p = payoff(share4, 'tv', 'recognised', '2026-04-25');
    expect(p.op.covered.map(row => row.number)).toEqual([5, 6, 7, 8, 9, 10, 11, 12]);
    expect(installmentPlanStatus(tv, p.archive.records, p.archive.purchaseOperations!)).toBe('active');
    const restored = editRecord(p.archive, installmentEntryId('tv', 4), record => ({ ...record, voided: false }), 'restore');
    expect(installmentPlanStatus(tv, restored.records, restored.purchaseOperations!)).toBe('completed');
    checkInvariants(restored, '2026-04-25', visa);
  });
});
