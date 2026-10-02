import { CARD_DELETED_MESSAGE, INSTALLMENT_DRIFT_MESSAGE, MAX_INSTALLMENTS, OPERATION_ACCOUNT_DELETED_MESSAGE, OPERATION_CHANGED_MESSAGE, OPERATION_HISTORY_DELETED_MESSAGE,
  OPERATION_ID_MESSAGE, OPERATION_INVALID_MESSAGE, OPERATION_PLAN_STOPPED_MESSAGE, OPERATION_STATE_MESSAGE, OPERATION_TARGET_MESSAGE, PAYOFF_DATE_MESSAGE,
  PAYOFF_FINANCING_MESSAGE, PAYOFF_NOTHING_MESSAGE, PAYOFF_PRINCIPAL_MESSAGE, PLAN_CANCELLED_MESSAGE, PLAN_CARD_MESSAGE, PLAN_DELETED_MESSAGE, PLAN_MISSING_MESSAGE,
  PLAN_NOT_CANCELLED_MESSAGE, PLAN_NOTHING_TO_STOP_MESSAGE, PLAN_OPERATION_DATE_MESSAGE, assertInstallmentPlanCancellable, assertInstallmentPlanDeletable, cardStatementsFrom,
  effectiveShares, installmentAmounts, installmentOccurrenceOf, installmentPlanFigures, installmentSchedule, isPlanRefund, newPlanPayoff, newPlanRefund,
  operationGuardMessages, planCatchUpInserts, planOperationFloorISO, planRefundAvailability, reactivateInstallmentPlan, validateArchive, type CardCycleDates,
  type CardStatement, type CreditCardProfile, type EffectiveShare, type EntryRecord, type Installment, type InstallmentComponent, type InstallmentPlan,
  type InstallmentPlanFigures, type InstallmentPlanStatus, type LedgerArchive, type PayoffFinancing, type PlanPayoff, type PlanRefund, type PurchaseOperation,
  type RecordedEntry, type StatementPlacement } from '@finanzapp/domain';
import { errors } from '../i18n/messages/es/errors.ts';

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
  /** The movement a recognised, partial or undone row opens: its principal's, or, when devoluciones took the principal
   * to zero before it was recorded, the first of its other shares that has a movement (recorded or undone). Null while
   * no share of it has one (a principal id never recorded is never opened: the movement screen would not find it). */
  entryId: string | null;
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
    // Only a share recorded (or recorded and undone) has a movement; the principal's first, else its financing's.
    const withMovement = (share: EffectiveShare) => share.state === 'recognised' || share.state === 'undone';
    const opened = shares.find(share => share.component === 'principal' && withMovement(share)) ?? shares.find(withMovement);
    return { number: row.number, billingDateISO: row.billingDateISO, dueDateISO: row.dueDateISO, totalMinor, principalMinor: row.principalMinor, financingMinor,
      effectiveMinor: totalMinor - reducedMinor, reducedMinor, recognisedMinor: sum(['recognised']), undoneMinor: sum(['undone']),
      settledMinor: sum(['settled']), waivedMinor: sum(['waived']), state, entryId: opened?.entryId ?? null, operationId };
  });
}

/** What a Calendario row opens (24T3, A26): its movement while it has one (recognised, partial or undone, `entryId`); the
 * adelanto that brought it forward (settled, waived); the devolución that lowered it (returned whole, or reduced and still
 * to come, or a row with no movement of its own); nothing for an instalment still to come or not recorded with no
 * operation on it. */
export function scheduleRowOpens(row: Pick<PlanScheduleRow, 'state' | 'operationId' | 'entryId'>): 'entry' | 'payoff' | 'refund' | null {
  if ((row.state === 'recognised' || row.state === 'undone' || row.state === 'partial') && row.entryId) return 'entry';
  if (!row.operationId) return null;
  return row.state === 'settled' || row.state === 'waived' ? 'payoff' : 'refund';
}

/** 24T3 (A26): every devolución and adelanto of a plan, live or undone, as the plan detail lists them (newest first), each
 * opening its own detail (`/operation/[id]`). The one place a devolución made only of reductions (no ledger line) or one
 * whose instalments a later devolución also lowered is reached from; an undone one is listed too, to restore it. */
export interface PlanOperationRow { id: string; kind: 'refund' | 'payoff'; dateISO: string; amountMinor: number; voided: boolean }
export function planOperationRows(planId: string, operations: readonly PurchaseOperation[]): PlanOperationRow[] {
  return operations.filter((operation): operation is PlanRefund | PlanPayoff => 'planId' in operation.target && operation.target.planId === planId)
    .sort((a, b) => b.dateISO.localeCompare(a.dateISO) || b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))
    .map(operation => ({ id: operation.id, kind: operation.kind, dateISO: operation.dateISO, amountMinor: operation.amountMinor, voided: operation.voided }));
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

/** 24T3: the word a plan's state reads as (the detail's hero, the card detail's row). Status adds nothing new to the domain
 * (A2): a completed plan whose whole price devoluciones returned reads «Devuelto», one whose remaining instalments an
 * adelanto brought forward «Adelantado» (never «pagado»); a stopped one reads «Sin seguimiento» (`stopped`). */
export type PlanStateWord = 'active' | 'completed' | 'broughtForward' | 'refunded' | 'stopped' | 'deleted';
export function planStateWord(summary: Pick<PlanSummary, 'figures' | 'status' | 'plan'>): PlanStateWord {
  const { figures, status, plan } = summary;
  if (status === 'cancelled') return 'stopped';
  if (status !== 'completed') return status;
  if (figures.refundedMinor >= plan.principalMinor) return 'refunded';
  return figures.settledMinor > 0 ? 'broughtForward' : 'completed';
}

/** 24T3 (A8): the archive as storage will read it for a write on this plan: its catch-up through `todayISO` appended (the
 * instalments whose statement closed while the app stayed open). The screens preview and offer actions on this view, so
 * what they show is what storage computes; nothing is written here. */
export function planCaughtUp(archive: LedgerArchive, planId: string, todayISO: string): LedgerArchive {
  try {
    const inserts = planCatchUpInserts(archive, planId, todayISO);
    return inserts.length ? { ...archive, records: [...archive.records, ...inserts] } : archive;
  } catch { return archive; }
}

/** 24T3 (A6): the day a plan form shows and sends, within the plan's floor and today on the caught-up view. A day chosen
 * before a floor that moved since (a statement closed while the form stayed open, past midnight) moves up to the floor, and
 * one after today down to today, so the form keeps previewing a valid adelanto instead of a refusal the person cannot read
 * on the wheel; the row shows the day it sends. A floor after today (a clock set back) is left to the domain's refusal. */
export function planOperationDate(archive: LedgerArchive, planId: string, chosenISO: string, todayISO: string): { dateISO: string; floorISO: string | null } {
  const plan = archive.installmentPlans?.find(item => item.id === planId);
  if (!plan) return { dateISO: chosenISO, floorISO: null };
  const caught = planCaughtUp(archive, planId, todayISO);
  const floorISO = planOperationFloorISO(plan, caught.records, caught.purchaseOperations ?? []);
  if (floorISO > todayISO) return { dateISO: chosenISO, floorISO: null };
  return { dateISO: chosenISO > todayISO ? todayISO : chosenISO < floorISO ? floorISO : chosenISO, floorISO };
}

/** Instalments a write records on their own closing dates (a stop's catch-up first, or a reactivation's): their numbers,
 * what they add up to (every component) and the first and last closing, for the confirmation that names them. */
export interface PlanClosings { numbers: number[]; totalMinor: number; firstClosingISO: string; lastClosingISO: string }
function closingsOf(inserts: readonly EntryRecord[]): PlanClosings | null {
  if (!inserts.length) return null;
  const numbers = [...new Set(inserts.map(record => installmentOccurrenceOf(record.entry.id)?.number ?? 0).filter(number => number > 0))].sort((a, b) => a - b);
  const dates = inserts.map(record => record.entry.dateISO).sort();
  return { numbers, totalMinor: inserts.reduce((total, record) => total + record.entry.amountMinor, 0), firstClosingISO: dates[0], lastClosingISO: dates.at(-1)! };
}

/** 24T3: what a plan's detail offers, each one only when storage would accept it (the domain's own dry runs, on the
 * caught-up view), so no button ends in a refusal:
 * - `refund` («Registrar devolución»): something is still returnable (`planRefundAvailability`), and a devolución of all of
 *   it today passes `newPlanRefund` (a deleted card, a deleted plan refuse it); on a plan without tracking, only the
 *   principal already recorded is returnable;
 * - `payoff` («Registrar adelanto de cuotas»): an adelanto dated today passes `newPlanPayoff` (a live plan with principal
 *   still to come, on a card not deleted);
 * - `stop` («Dejar de seguir el plan»): a share is still scheduled after the catch-up, and the plan is not `deletable` (a
 *   plan created by mistake is deleted, never stopped: the two are never offered together, A16);
 * - `reactivate` («Reactivar plan»): a plan without tracking whose reactivation, with its catch-up, passes `validateArchive`;
 * - `remove` («Eliminar plan»): `planSummary.deletable`.
 * `stopClosings` and `reactivateClosings` name the instalments those writes record first, on their own closing dates. */
export interface PlanActions {
  refund: boolean; payoff: boolean; stop: boolean; reactivate: boolean; remove: boolean;
  /** What `stop` stops recording (every component still scheduled after the catch-up). */
  stopMinor: number;
  stopClosings: PlanClosings | null;
  reactivateClosings: PlanClosings | null;
}
const passes = (check: () => void) => { try { check(); return true; } catch { return false; } };
export function planActions(archive: LedgerArchive, planId: string, todayISO: string, nowISO: string): PlanActions {
  const none: PlanActions = { refund: false, payoff: false, stop: false, reactivate: false, remove: false, stopMinor: 0, stopClosings: null, reactivateClosings: null };
  const plan = archive.installmentPlans?.find(item => item.id === planId);
  if (!plan || plan.deleted) return none;
  const operations = archive.purchaseOperations ?? [];
  const caught = planCaughtUp(archive, planId, todayISO);
  const remove = planSummary(plan, archive.records, operations).deletable;
  const draft = { id: 'dry-run', dateISO: todayISO, todayISO, createdAt: nowISO };
  let refund = false;
  try {
    const available = planRefundAvailability(caught, planId).availableMinor;
    refund = available > 0 && passes(() => newPlanRefund(caught, { ...draft, planId, amountMinor: available }));
  } catch { refund = false; }
  const payoff = plan.cancelledAt === null && passes(() => newPlanPayoff(caught, { ...draft, planId, financing: 'recognised' }));
  const stop = !remove && passes(() => assertInstallmentPlanCancellable(plan, caught.records, operations));
  const stopMinor = stop ? effectiveShares(plan, caught.records, operations).filter(share => share.state === 'scheduled').reduce((total, share) => total + share.amountMinor, 0) : 0;
  let reactivate = false, reactivateClosings: PlanClosings | null = null;
  const card = archive.cards?.find(item => item.id === plan.cardId);
  if (plan.cancelledAt !== null && card && !card.deleted) {
    try {
      const reactivated = reactivateInstallmentPlan(plan, nowISO);
      const next = { ...archive, installmentPlans: archive.installmentPlans!.map(item => item.id === planId ? reactivated : item) };
      const inserts = planCatchUpInserts(next, planId, todayISO);
      validateArchive({ ...next, records: [...next.records, ...inserts] }, 'reactivate');
      reactivate = true;
      reactivateClosings = closingsOf(inserts);
    } catch { reactivate = false; }
  }
  let stopClosings: PlanClosings | null = null;
  if (stop) { try { stopClosings = closingsOf(planCatchUpInserts(archive, planId, todayISO)); } catch { stopClosings = null; } }
  return { refund, payoff, stop, reactivate, remove, stopMinor, stopClosings, reactivateClosings };
}

/** What one adelanto brings forward, read from its frozen `covered` rows (so a sent submission shows exactly what it
 * sends): per component, principal first; the principal; the financing; what it records on its date (the principal,
 * plus the financing when recognised); the instalments it covers. */
export interface PayoffFigures {
  components: { component: InstallmentComponent; minor: number }[];
  principalMinor: number;
  financingMinor: number;
  recordedMinor: number;
  numbers: number[];
}
export function payoffFigures(payoff: PlanPayoff): PayoffFigures {
  const order: InstallmentComponent[] = ['principal', 'interest', 'fee', 'tax'];
  const sums = new Map<InstallmentComponent, number>();
  for (const row of payoff.covered) sums.set(row.component, (sums.get(row.component) ?? 0) + row.minor);
  const components = order.filter(component => (sums.get(component) ?? 0) > 0).map(component => ({ component, minor: sums.get(component)! }));
  const principalMinor = sums.get('principal') ?? 0;
  const financingMinor = components.filter(item => item.component !== 'principal').reduce((total, item) => total + item.minor, 0);
  return { components, principalMinor, financingMinor, recordedMinor: principalMinor + (payoff.financing === 'recognised' ? financingMinor : 0),
    numbers: [...new Set(payoff.covered.map(row => row.number))].sort((a, b) => a - b) };
}
export interface PayoffPreview extends PayoffFigures {
  payoff: PlanPayoff;
  undoneNumbers: number[];
  floorISO: string;
  /** Future financing exists and the person has not said yet whether it is recorded or was not charged (A18). */
  choiceNeeded: boolean;
}
/** 24T3: «Registrar adelanto de cuotas» as data, so the sheet, its preview and its Save read one derivation (A13: the
 * preview is the commit). `payoff` is exactly what Save sends: built by `newPlanPayoff` on the caught-up view with the
 * person's date and financing choice (while none is chosen, as if «Los registro ahora», and `choiceNeeded` holds Save).
 * Per component what is brought forward (`components`, principal first; financing listed even when it will be recorded as
 * not charged, so the choice is made on what it is about), the instalments it covers, the undone ones it leaves pending,
 * the date floor (A6) and what Save records on that date (`recordedMinor`: the principal, plus the financing when
 * recognised). A refusal (nothing left, a stopped or deleted plan, a deleted card, a date out of bounds) is its message. */
export function payoffPreview(archive: LedgerArchive, planId: string, input: { id: string; createdAt: string; financing: PayoffFinancing | null; dateISO: string; todayISO: string }):
  { ok: true; preview: PayoffPreview } | { ok: false; message: string } {
  const plan = archive.installmentPlans?.find(item => item.id === planId);
  if (!plan) return { ok: false, message: PLAN_MISSING_MESSAGE };
  const caught = planCaughtUp(archive, planId, input.todayISO);
  const operations = caught.purchaseOperations ?? [];
  let payoff: PlanPayoff;
  try {
    payoff = newPlanPayoff(caught, { id: input.id, planId, financing: input.financing ?? 'recognised', dateISO: input.dateISO, todayISO: input.todayISO, createdAt: input.createdAt });
  } catch (cause) { return { ok: false, message: cause instanceof Error ? cause.message : PAYOFF_NOTHING_MESSAGE }; }
  const parts = payoffFigures(payoff);
  const shares = effectiveShares(plan, caught.records, operations);
  return { ok: true, preview: { payoff, ...parts,
    undoneNumbers: [...new Set(shares.filter(share => share.state === 'undone').map(share => share.number))].sort((a, b) => a - b),
    floorISO: planOperationFloorISO(plan, caught.records, operations), choiceNeeded: parts.financingMinor > 0 && input.financing === null } };
}

/** 24T3 (A13): the refusals a plan write (an adelanto, a stop, a reactivation) gets from the plan and the ledger as they are,
 * before anything is written: the form or the detail releases its frozen submission on one of these and reads the plan
 * again. Anything else (a failed disk write, a refresh that failed after the commit) leaves the outcome unknown: the
 * submission stays frozen and Reintentar sends it unchanged. */
const PLAN_WRITE_REFUSALS = new Set<string>([
  OPERATION_CHANGED_MESSAGE, OPERATION_STATE_MESSAGE, OPERATION_INVALID_MESSAGE, OPERATION_TARGET_MESSAGE, OPERATION_ID_MESSAGE, OPERATION_ACCOUNT_DELETED_MESSAGE,
  OPERATION_HISTORY_DELETED_MESSAGE, OPERATION_PLAN_STOPPED_MESSAGE, PAYOFF_NOTHING_MESSAGE, PAYOFF_PRINCIPAL_MESSAGE, PAYOFF_FINANCING_MESSAGE, PAYOFF_DATE_MESSAGE,
  PLAN_OPERATION_DATE_MESSAGE, PLAN_NOTHING_TO_STOP_MESSAGE, PLAN_NOT_CANCELLED_MESSAGE, PLAN_CANCELLED_MESSAGE, PLAN_DELETED_MESSAGE, PLAN_MISSING_MESSAGE,
  PLAN_CARD_MESSAGE, CARD_DELETED_MESSAGE, INSTALLMENT_DRIFT_MESSAGE, ...operationGuardMessages(),
  // Storage's stale-revision refusal of a stop or a reactivation (`planLifecycleRetry`): the catalogue holds its exact text.
  errors.errors.installments.changed,
]);
export function isPlanWriteRefusal(message: string): boolean {
  return PLAN_WRITE_REFUSALS.has(message);
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
