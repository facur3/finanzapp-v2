import { MAX_INSTALLMENTS, assertInstallmentPlanCancellable, assertInstallmentPlanDeletable, cardStatementsFrom, effectiveShares, installmentAmounts, installmentEntryId,
  installmentOccurrenceOf, installmentPlanFigures, installmentSchedule, isPlanRefund, type CardCycleDates, type CardStatement, type CreditCardProfile, type EffectiveShare,
  type Installment, type InstallmentComponent, type InstallmentPlan, type InstallmentPlanFigures, type InstallmentPlanStatus, type PlanRefund, type PurchaseOperation,
  type RecordedEntry, type StatementPlacement } from '@finanzapp/domain';

/** Producto 24T2: what the screens show of a purchase in instalments, derived from the plan and the ledger (never stored
 * twice). Pure: no React, so Node tests load it directly. Words are chosen by the screens; this module names states. */

/** The counts the purchase form offers as one tap, before «Otra»; 24 and every other count from 2 to 120 are typed (five
 * segments are the most that fit the narrowest iPhone, see `QUICK_COUNTS`). One instalment is a normal purchase («Una
 * vez»), so the form never offers it as financing. */
export const INSTALLMENT_COUNT_CHOICES = [3, 6, 12, 18] as const;
export const MIN_PLAN_COUNT = 2;

/** A typed count, or null when it is not a whole number from 2 to 120. */
export function parseInstallmentCount(text: string): number | null {
  if (!/^\d{1,3}$/.test(text.trim())) return null;
  const count = Number(text.trim());
  return count >= MIN_PLAN_COUNT && count <= MAX_INSTALLMENTS ? count : null;
}

/** The state of one row of a plan's schedule, read from the effective shares of its components (each share has its own
 * movement and its own state, `effectiveShares`, 24T3 A2):
 * - `recognised`: every share is in the ledger and counts;
 * - `undone`: the person undid every share (none counts, none is recreated);
 * - `settled` («Adelantada», never «pagada»): a live adelanto de cuotas brought its shares forward (financing it recorded as
 *   not charged may sit beside it);
 * - `waived` («No se cobró»): every share left is financing an adelanto recorded as not charged;
 * - `refunded`: devoluciones reduced its principal to zero before it was recorded, and it has no other share left;
 * - `partial`: shares in different states (`recognisedMinor` says what counts);
 * - `next` (the first one still to come), `future`, or `cancelled` (the plan stopped before it).
 * A share refunded to zero is neutral: the row reads as its other shares. «Pagada» is never a state: a card payment is not
 * assigned to an instalment. */
export type ScheduleRowState = 'recognised' | 'partial' | 'next' | 'future' | 'undone' | 'cancelled' | 'settled' | 'waived' | 'refunded';
export interface PlanScheduleRow {
  number: number;
  billingDateISO: string;
  dueDateISO: string;
  /** What the instalment charged by contract: its principal share plus its financing shares (before any devolución). */
  totalMinor: number;
  principalMinor: number;
  financingMinor: number;
  /** What it charges after live devoluciones: `totalMinor − reducedMinor`. */
  effectiveMinor: number;
  /** The principal live devoluciones took off it («Reducida por devolución»); 0 when none did. */
  reducedMinor: number;
  /** The shares of this instalment whose movements count now, and the ones the person undid (effective amounts). */
  recognisedMinor: number;
  undoneMinor: number;
  /** The shares a live adelanto brought forward (they count, on the adelanto's date), and the financing it recorded as not charged. */
  settledMinor: number;
  waivedMinor: number;
  state: ScheduleRowState;
  /** The movement that recognises this instalment's principal (a recognised, partial or undone row opens it). */
  entryId: string;
  /** 24T3 (A26): the operation a settled or refunded row opens (`/operation/[id]`): the adelanto covering it, or the latest
   * live devolución that reduced its principal; null otherwise. */
  operationId: string | null;
}

/** The latest live devolución of `plan` reducing each instalment (by date, then creation, then id). */
function reducingRefunds(plan: InstallmentPlan, operations: readonly PurchaseOperation[]): Map<number, string> {
  const result = new Map<number, string>();
  const refunds = operations.filter((operation): operation is PlanRefund => !operation.voided && isPlanRefund(operation) && operation.target.planId === plan.id)
    .sort((a, b) => a.dateISO.localeCompare(b.dateISO) || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  for (const refund of refunds) for (const row of refund.reductions) result.set(row.number, refund.id);
  return result;
}

export function planScheduleRows(plan: InstallmentPlan, records: readonly RecordedEntry[], operationsInput: readonly PurchaseOperation[]): PlanScheduleRow[] {
  const operations = operationsInput ?? []; // Required (A3); tolerated missing at run time while a caller is being moved.
  const byNumber = new Map<number, EffectiveShare[]>();
  for (const share of effectiveShares(plan, records, operations)) {
    const list = byNumber.get(share.number);
    if (list) list.push(share); else byNumber.set(share.number, [share]);
  }
  const reducedBy = reducingRefunds(plan, operations);
  let nextGiven = false;
  return plan.schedule.map(row => {
    const shares = byNumber.get(row.number) ?? [];
    const sum = (states: readonly EffectiveShare['state'][]) => shares.filter(share => states.includes(share.state)).reduce((total, share) => total + share.amountMinor, 0);
    const counted = shares.filter(share => share.state !== 'refunded');
    const every = (...states: EffectiveShare['state'][]) => counted.length > 0 && counted.every(share => states.includes(share.state));
    let state: ScheduleRowState;
    if (!counted.length) state = 'refunded';
    else if (every('recognised')) state = 'recognised';
    else if (every('undone')) state = 'undone';
    else if (every('waived')) state = 'waived';
    else if (every('settled', 'waived')) state = 'settled';
    else if (every('cancelled')) state = 'cancelled';
    else if (every('scheduled')) {
      if (!nextGiven) { state = 'next'; nextGiven = true; } else state = 'future';
    } else state = 'partial';
    const reducedMinor = shares.reduce((total, share) => total + Math.min(share.reducedMinor, share.scheduleMinor), 0);
    const financingMinor = row.interestMinor + row.feeMinor + row.taxMinor;
    const totalMinor = row.principalMinor + financingMinor;
    const payoffId = shares.find(share => share.payoffId !== null)?.payoffId ?? null;
    const operationId = state === 'settled' || state === 'waived' ? payoffId : state === 'refunded' || reducedMinor > 0 ? reducedBy.get(row.number) ?? null : null;
    return { number: row.number, billingDateISO: row.billingDateISO, dueDateISO: row.dueDateISO, totalMinor, principalMinor: row.principalMinor, financingMinor,
      effectiveMinor: totalMinor - reducedMinor, reducedMinor, recognisedMinor: sum(['recognised']), undoneMinor: sum(['undone']),
      settledMinor: sum(['settled']), waivedMinor: sum(['waived']), state, entryId: installmentEntryId(plan.id, row.number, 'principal'), operationId };
  });
}

export interface PlanSummary {
  plan: InstallmentPlan;
  /** The distinct figures (decision 003, rule 7): price, recognised, undone, future committed, cancelled, remaining; since
   * 24T3 also brought forward (`settledMinor`), returned (`refundedMinor`, credit and future) and waived financing. */
  figures: InstallmentPlanFigures;
  status: InstallmentPlanStatus;
  /** The first instalment still to come, when the plan is live. */
  next: PlanScheduleRow | null;
  /** Interest, fee and tax of the whole plan (this form records interest only). */
  financingMinor: number;
  /** Price plus financing: «Total financiado». Equal to the price without financing. */
  totalFinancedMinor: number;
  /** A live plan with nothing recorded yet and no devolución or adelanto, undone ones included (created by mistake): it may be
   * deleted. Never for a stopped or deleted plan (storage refuses both). */
  deletable: boolean;
  /** 24T3: a live plan with a share still scheduled may stop being followed («Dejar de seguir el plan»); never offered together
   * with `deletable` (A16: a plan created by mistake is deleted, not stopped). */
  cancellable: boolean;
}

export function planSummary(plan: InstallmentPlan, records: readonly RecordedEntry[], operationsInput: readonly PurchaseOperation[]): PlanSummary {
  const operations = operationsInput ?? []; // Required (A3); tolerated missing at run time while a caller is being moved.
  const figures = installmentPlanFigures(plan, records, operations);
  const rows = planScheduleRows(plan, records, operations);
  const financingMinor = plan.interestMinor + plan.feeMinor + plan.taxMinor;
  const passes = (check: () => void) => { try { check(); return true; } catch { return false; } };
  const deletable = !plan.deleted && plan.cancelledAt === null && passes(() => assertInstallmentPlanDeletable(plan, records, operations));
  const cancellable = !deletable && passes(() => assertInstallmentPlanCancellable(plan, records, operations));
  return { plan, figures, status: figures.status, next: rows.find(row => row.state === 'next') ?? null, financingMinor,
    totalFinancedMinor: plan.principalMinor + financingMinor, deletable, cancellable };
}

/** 24UX6D: a plan detail draws one segment per instalment up to this count (a 24-instalment plan keeps segments about
 * 12 pt wide on a 375 pt iPhone); a longer plan (up to 120) draws one continuous bar instead of slivers too thin to read. */
export const PLAN_SEGMENT_MAX = 24;

export interface PlanProgress {
  /** Instalments whose principal the ledger recognised (the domain's `recognisedCount`), of `total`. Never «pagadas». */
  recognisedCount: number;
  total: number;
  /** One state per instalment, in schedule order, when the plan has `PLAN_SEGMENT_MAX` instalments or fewer; else null. */
  segments: ScheduleRowState[] | null;
  /** `recognisedCount / total`, 0–1, for the continuous bar. */
  fraction: number;
}

/** The compact progress of a plan's schedule (24UX6D): the count comes from the domain's figures, never from the card's
 * payments (a payment is not assigned to an instalment), and each segment is its row's state as the Calendario names it,
 * so an undone or partly undone instalment is not drawn as recognised. Pure presentation: no figure is computed here. */
export function planProgress(summary: Pick<PlanSummary, 'figures' | 'plan'>, rows: readonly PlanScheduleRow[]): PlanProgress {
  const total = summary.plan.count;
  const recognisedCount = summary.figures.recognisedCount;
  const segmented = rows.length !== 0 && rows.length <= PLAN_SEGMENT_MAX;
  return { recognisedCount, total, segments: segmented ? rows.map(row => row.state) : null,
    fraction: total > 0 ? Math.min(1, Math.max(0, recognisedCount / total)) : 0 };
}

/** A card's plans for its detail: live ones first (by their next instalment; a live plan with nothing left to come, only
 * undone shares, after them), then completed, then cancelled. Deleted plans (created by mistake, nothing recorded) are gone. */
export function cardPlanSummaries(cardId: string, plans: readonly InstallmentPlan[] | undefined, records: readonly RecordedEntry[] | undefined,
  operations: readonly PurchaseOperation[] | undefined): PlanSummary[] {
  const rank: Record<InstallmentPlanStatus, number> = { active: 0, completed: 1, cancelled: 2, deleted: 3 };
  const nextOf = (summary: PlanSummary) => summary.next?.billingDateISO ?? '9999-12-31';
  return (plans ?? []).filter(plan => plan.cardId === cardId && !plan.deleted).map(plan => planSummary(plan, records ?? [], operations ?? []))
    .sort((a, b) => rank[a.status] - rank[b.status] || nextOf(a).localeCompare(nextOf(b))
      || b.plan.purchaseDateISO.localeCompare(a.plan.purchaseDateISO) || a.plan.id.localeCompare(b.plan.id));
}

/** The plan, the instalment and the component behind a movement, or null for any other movement. */
export function installmentOfEntry(entryId: string, plans: readonly InstallmentPlan[] = []): {
  plan: InstallmentPlan; number: number; count: number; component: InstallmentComponent;
  /** The instalment has another share besides this movement's (its principal and its interest are two movements), so
   * undoing or correcting this one leaves the other as it is. */
  shared: boolean;
} | null {
  const occurrence = installmentOccurrenceOf(entryId);
  if (!occurrence) return null;
  const plan = plans.find(item => item.id === occurrence.planId);
  if (!plan) return null;
  const row = plan.schedule[occurrence.number - 1];
  const shares: Record<InstallmentComponent, number> = row
    ? { principal: row.principalMinor, interest: row.interestMinor, fee: row.feeMinor, tax: row.taxMinor } : { principal: 0, interest: 0, fee: 0, tax: 0 };
  const shared = (Object.keys(shares) as InstallmentComponent[]).some(component => component !== occurrence.component && shares[component] > 0);
  return { plan, number: occurrence.number, count: plan.count, component: occurrence.component, shared };
}

/** The two statements the first instalment may go to: the one the purchase belongs to, and the one after it. */
export function placementOptions(card: Pick<CreditCardProfile, 'id' | 'closingDay' | 'dueDay'>, cycleDates: readonly CardCycleDates[], purchaseDateISO: string): Record<StatementPlacement, CardStatement> | null {
  try {
    const [current, next] = cardStatementsFrom(card, cycleDates.filter(row => row.cardId === card.id), purchaseDateISO, 0, 2);
    return { current, next };
  } catch { return null; }
}

/** What the purchase form shows before Save, from exactly the schedule the plan will be written with. */
export interface PurchasePreview {
  schedule: Installment[];
  firstBillingISO: string;
  firstDueISO: string;
  /** Per-instalment totals: equal, or «aprox.» when a remainder makes some of them larger by a few minor units. */
  maxMinor: number;
  minMinor: number;
  even: boolean;
  /** The first statement already closed (a purchase recorded late: its closing is before today). */
  firstAlreadyClosed: boolean;
  /** The first instalment is recognised as soon as the plan is saved: its statement closed, or closes today (on its
   * closing day a statement is still open, and its instalment is recorded that day). */
  firstRecordedAtSave: boolean;
}

export function purchasePreview(input: { card: Pick<CreditCardProfile, 'id' | 'closingDay' | 'dueDay'>; cycleDates: readonly CardCycleDates[]; purchaseDateISO: string;
  placement: StatementPlacement; principalMinor: number; count: number; interestMinor: number; todayISO: string }): PurchasePreview | null {
  try {
    const schedule = installmentSchedule(input.card, input.purchaseDateISO, input.placement, input.principalMinor, input.count,
      { interestMinor: input.interestMinor, feeMinor: 0, taxMinor: 0 }, input.cycleDates.filter(row => row.cardId === input.card.id));
    const amounts = installmentAmounts(schedule);
    return { schedule, firstBillingISO: schedule[0].billingDateISO, firstDueISO: schedule[0].dueDateISO, maxMinor: amounts.maxMinor, minMinor: amounts.minMinor,
      even: amounts.even, firstAlreadyClosed: schedule[0].billingDateISO < input.todayISO, firstRecordedAtSave: schedule[0].billingDateISO <= input.todayISO };
  } catch { return null; }
}
