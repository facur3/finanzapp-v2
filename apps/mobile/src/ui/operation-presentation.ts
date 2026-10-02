import { INSTALLMENT_COMPONENTS, applyOperationChange, effectiveShares, entryRefundSummary, installmentOccurrenceOf, isEntryRefund, isPlanPayoff, isPlanRefund,
  makeOperationChange, newEntryRefund, newPlanRefund, operationPlanId, planCatchUpInserts, planRefundAvailability, projectOperationLines, withOperation,
  type Entry, type EntryRecord, type EntryRefund, type InstallmentComponent, type LedgerArchive, type PlanPayoff, type PlanRefund, type PurchaseOperation } from '@finanzapp/domain';

/** Producto 24T3: what the refund form, the operation detail, the movement detail and Movimientos deshechos read about a
 * devolución or an adelanto de cuotas. Pure (no React), so Node tests load it directly; every decision is the domain's
 * (`newEntryRefund`, `newPlanRefund`, `applyOperationChange` as dry runs), never a second copy of a rule here. */

/** Instalment numbers as the copy writes them: contiguous runs joined by an en dash ("7–9"), the rest by commas ("3, 5–6"). */
export function numberRanges(numbers: readonly number[]): string {
  const sorted = [...new Set(numbers)].sort((a, b) => a - b);
  const runs: string[] = [];
  for (let index = 0; index < sorted.length;) {
    let end = index;
    while (end + 1 < sorted.length && sorted[end + 1] === sorted[end] + 1) end++;
    runs.push(end === index ? String(sorted[index]) : sorted[index] + '–' + sorted[end]);
    index = end + 1;
  }
  return runs.join(', ');
}

/** The archive storage will allocate on (A8): the plan's instalments whose statement closed through today recorded first,
 * so the preview equals the commit when the app stayed open across a closing. Anything else is returned as it is. */
export function caughtUp(archive: LedgerArchive, planId: string | null, todayISO: string): LedgerArchive {
  if (planId === null) return archive;
  try {
    const inserts = planCatchUpInserts(archive, planId, todayISO);
    return inserts.length ? { ...archive, records: [...archive.records, ...inserts] } : archive;
  } catch { return archive; }
}

export type RefundTarget = { entryId: string; planId?: undefined } | { planId: string; entryId?: undefined };
export type RefundPreview =
  /** Nothing typed yet (or zero): no sentence and no Save. */
  | { status: 'empty' }
  /** The domain refused this draft; `message` is its sentence (translated when shown). */
  | { status: 'invalid'; message: string }
  | { status: 'ready'; refund: EntryRefund | PlanRefund;
    /** The ledger line it adds (a devolución of an ordinary purchase, or a plan's credit), with its category resolved as
     * the ledger will read it (A30); null when it only lowers future instalments. */
    line: Entry | null;
    /** A plan devolución whose reductions touch instalments that also carry interest, a fee or a tax. */
    interestOnTail: boolean;
    /** A17: after it no price is left to record while financing is still scheduled. */
    financingStays: boolean };

/** What Save would record for this draft, computed with the domain's own creation on the archive storage will see. The
 * form shows exactly this and sends exactly this (A13). */
export function previewRefund(archive: LedgerArchive, target: RefundTarget,
  input: { id: string; amountMinor: number | null; dateISO: string; todayISO: string; createdAt: string }): RefundPreview {
  if (input.amountMinor === null || !(input.amountMinor > 0)) return { status: 'empty' };
  const base = caughtUp(archive, target.planId ?? null, input.todayISO);
  let refund: EntryRefund | PlanRefund;
  try {
    refund = target.entryId !== undefined
      ? newEntryRefund(base, { id: input.id, entryId: target.entryId, amountMinor: input.amountMinor, dateISO: input.dateISO, todayISO: input.todayISO, createdAt: input.createdAt })
      : newPlanRefund(base, { id: input.id, planId: target.planId, amountMinor: input.amountMinor, dateISO: input.dateISO, todayISO: input.todayISO, createdAt: input.createdAt });
  } catch (cause) {
    return { status: 'invalid', message: cause instanceof Error ? cause.message : String(cause) };
  }
  const after = withOperation(base, refund);
  const line = projectOperationLines(after).find(item => item.id === refund.id) ?? null;
  let interestOnTail = false, financingStays = false;
  if (isPlanRefund(refund) && refund.reductions.length) {
    const plan = (after.installmentPlans ?? []).find(item => item.id === refund.target.planId);
    if (plan) {
      interestOnTail = refund.reductions.some(row => {
        const instalment = plan.schedule[row.number - 1];
        return !!instalment && instalment.interestMinor + instalment.feeMinor + instalment.taxMinor > 0;
      });
      const shares = effectiveShares(plan, after.records, after.purchaseOperations ?? []);
      financingStays = !shares.some(share => share.component === 'principal' && share.state === 'scheduled')
        && shares.some(share => share.component !== 'principal' && share.state === 'scheduled');
    }
  }
  return { status: 'ready', refund, line, interestOnTail, financingStays };
}

/** What a target can still return, and its dates: the shortcut's figure and the date wheel's bounds. Null when the target
 * is gone (a deleted plan, a purchase no longer in the ledger). */
export interface RefundBounds { availableMinor: number; refundedMinor: number; minimumISO: string; currency: string }
export function refundBounds(archive: LedgerArchive, target: RefundTarget, todayISO: string): RefundBounds | null {
  try {
    if (target.entryId !== undefined) {
      const record = archive.records.find(item => item.entry.id === target.entryId);
      const account = archive.accounts.find(item => item.id === record?.entry.accountId);
      if (!record || !account) return null;
      const summary = entryRefundSummary(archive, target.entryId);
      return { availableMinor: summary.availableMinor, refundedMinor: summary.refundedMinor, minimumISO: record.entry.dateISO, currency: account.currency };
    }
    const plan = (archive.installmentPlans ?? []).find(item => item.id === target.planId);
    if (!plan || plan.deleted) return null;
    const base = caughtUp(archive, plan.id, todayISO);
    const availability = planRefundAvailability(base, plan.id);
    const refunded = (base.purchaseOperations ?? []).filter((item): item is PlanRefund => !item.voided && isPlanRefund(item) && item.target.planId === plan.id)
      .reduce((sum, item) => sum + item.amountMinor, 0);
    return { availableMinor: availability.availableMinor, refundedMinor: refunded, minimumISO: availability.floorISO, currency: plan.currency };
  } catch { return null; }
}

/** Whether «Registrar devolución» belongs on an ordinary purchase's detail: the domain's own creation as a dry run with
 * everything still returnable, dated today (a voided purchase, an income, an instalment, a deleted account or nothing left
 * all refuse). No dead button. */
export function canRefundEntry(archive: LedgerArchive, entryId: string, todayISO: string, nowISO: string): boolean {
  const available = entryRefundSummary(archive, entryId).availableMinor;
  if (available <= 0) return false;
  try {
    newEntryRefund(archive, { id: 'refund-dry-run', entryId, amountMinor: available, dateISO: todayISO, todayISO, createdAt: nowISO });
    return true;
  } catch { return false; }
}

export type OperationCheck = { ok: true; inserts: EntryRecord[] } | { ok: false; reason: string };
/** The undo (live) or restore (undone) of an operation, as a dry run on the current archive: storage applies exactly this
 * (`applyOperationChange`, with the plan's catch-up). `inserts` are the instalments it would record on their own closings. */
export function checkOperationChange(archive: LedgerArchive, operation: PurchaseOperation, todayISO: string, nowISO: string): OperationCheck {
  try {
    const change = makeOperationChange('dry-run', operation, operation.voided ? 'restore' : 'void', nowISO);
    return { ok: true, inserts: applyOperationChange(archive, change, todayISO).inserts };
  } catch (cause) {
    return { ok: false, reason: cause instanceof Error ? cause.message : String(cause) };
  }
}

/** The instalments a catch-up records: their numbers (unique) and the money they add. */
export function recordedShares(inserts: readonly EntryRecord[]): { numbers: number[]; amountMinor: number } {
  const numbers = new Set<number>();
  let total = 0;
  for (const record of inserts) {
    const occurrence = installmentOccurrenceOf(record.entry.id);
    if (occurrence) numbers.add(occurrence.number);
    total += record.entry.amountMinor;
  }
  return { numbers: [...numbers].sort((a, b) => a - b), amountMinor: total };
}

/** What an adelanto brought forward, per component (Σ covered), and which instalments. */
export function payoffParts(payoff: PlanPayoff): { component: InstallmentComponent; minor: number }[] {
  return INSTALLMENT_COMPONENTS.map(component => ({ component, minor: payoff.covered.filter(row => row.component === component).reduce((sum, row) => sum + row.minor, 0) }))
    .filter(part => part.minor > 0);
}
export function payoffNumbers(payoff: PlanPayoff): number[] {
  return [...new Set(payoff.covered.map(row => row.number))].sort((a, b) => a - b);
}

/** Movimientos deshechos (A26): one row per undone operation, shaped like the line it projected while live so the same
 * row draws it and opens its detail. A devolución shows its whole amount (a plan's included, even one that only lowered
 * future instalments and had no line); an adelanto shows the price it brought forward. Nothing here counts anywhere. */
export function undoneOperationLines(archive: LedgerArchive): Entry[] {
  const records = new Map(archive.records.map(record => [record.entry.id, record]));
  const plans = new Map((archive.installmentPlans ?? []).map(plan => [plan.id, plan]));
  const lines: Entry[] = [];
  for (const operation of archive.purchaseOperations ?? []) {
    if (!operation.voided) continue;
    if (isEntryRefund(operation)) {
      const target = records.get(operation.target.entryId);
      if (!target) continue;
      lines.push({ id: operation.id, accountId: operation.accountId, kind: 'expense', amountMinor: -operation.amountMinor, merchant: target.entry.merchant,
        category: target.entry.category, dateISO: operation.dateISO, createdAt: operation.createdAt, refund: { operationId: operation.id, targetEntryId: target.entry.id } });
      continue;
    }
    const plan = plans.get(operationPlanId(operation) ?? '');
    if (!plan) continue;
    if (isPlanPayoff(operation)) {
      lines.push({ id: operation.id + '_p', accountId: operation.accountId, kind: 'expense', amountMinor: operation.amountMinor, merchant: plan.merchant,
        category: plan.category, dateISO: operation.dateISO, createdAt: operation.createdAt, payoff: { operationId: operation.id, planId: plan.id, component: 'principal' } });
    } else {
      // The category its credit line counted in while live (A30: the latest recorded price share's), as the detail shows it.
      const live = projectOperationLines({ records: archive.records, installmentPlans: archive.installmentPlans, purchaseOperations: [{ ...operation, voided: false }] });
      lines.push({ id: operation.id, accountId: operation.accountId, kind: 'expense', amountMinor: -operation.amountMinor, merchant: plan.merchant,
        category: live[0]?.category ?? plan.category, dateISO: operation.dateISO, createdAt: operation.createdAt, refund: { operationId: operation.id, targetPlanId: plan.id } });
    }
  }
  return lines.sort((a, b) => a.dateISO !== b.dateISO ? (a.dateISO < b.dateISO ? 1 : -1) : b.createdAt.localeCompare(a.createdAt));
}

/** The operation behind a ledger line (a devolución's or an adelanto's), or null for a movement. */
export function operationIdOf(entry: Pick<Entry, 'refund' | 'payoff'>): string | null {
  return entry.refund?.operationId ?? entry.payoff?.operationId ?? null;
}
