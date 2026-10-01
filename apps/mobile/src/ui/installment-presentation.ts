import { INSTALLMENT_COMPONENTS, MAX_INSTALLMENTS, assertInstallmentPlanDeletable, cardStatementsFrom, installmentAmounts, installmentEntryId, installmentOccurrenceOf,
  installmentPlanFigures, installmentSchedule, installmentState, type CardCycleDates, type CardStatement, type CreditCardProfile, type Installment,
  type InstallmentComponent, type InstallmentPlan, type InstallmentPlanFigures, type InstallmentPlanStatus, type RecordedEntry, type StatementPlacement } from '@finanzapp/domain';

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

/** The state of one row of a plan's schedule, read from the movements of its components (each share has its own):
 * `recognised` (every share is in the ledger and counts), `undone` (the person undid every share: none counts, none is
 * recreated), `partial` (some shares count and some were undone: `recognisedMinor` says what counts), `next` (the first
 * one still to come), `future`, or `cancelled` (the plan stopped before it). «Pagada» is never a state: a card payment is
 * not assigned to an instalment. */
export type ScheduleRowState = 'recognised' | 'partial' | 'next' | 'future' | 'undone' | 'cancelled';
export interface PlanScheduleRow {
  number: number;
  billingDateISO: string;
  dueDateISO: string;
  /** What the instalment charges: its principal share plus its financing shares. */
  totalMinor: number;
  principalMinor: number;
  financingMinor: number;
  /** The shares of this instalment whose movements count now, and the ones the person undid. */
  recognisedMinor: number;
  undoneMinor: number;
  state: ScheduleRowState;
  /** The movement that recognises this instalment's principal (a recognised, partial or undone row opens it). */
  entryId: string;
}

export function planScheduleRows(plan: InstallmentPlan, records: readonly RecordedEntry[]): PlanScheduleRow[] {
  const stopped = plan.cancelledAt !== null || plan.deleted;
  let nextGiven = false;
  return plan.schedule.map(row => {
    const shares = INSTALLMENT_COMPONENTS.map(component => ({ amount: row[`${component}Minor`], state: installmentState(plan, row, records, component) }))
      .filter(share => share.amount > 0);
    const recognisedMinor = shares.filter(share => share.state === 'recognised').reduce((sum, share) => sum + share.amount, 0);
    const undoneMinor = shares.filter(share => share.state === 'undone').reduce((sum, share) => sum + share.amount, 0);
    const scheduled = shares.every(share => share.state === 'scheduled');
    let state: ScheduleRowState;
    if (shares.every(share => share.state === 'recognised')) state = 'recognised';
    else if (shares.every(share => share.state === 'undone')) state = 'undone';
    else if (!scheduled) state = 'partial';
    else if (stopped) state = 'cancelled';
    else if (!nextGiven) { state = 'next'; nextGiven = true; }
    else state = 'future';
    const financingMinor = row.interestMinor + row.feeMinor + row.taxMinor;
    return { number: row.number, billingDateISO: row.billingDateISO, dueDateISO: row.dueDateISO, totalMinor: row.principalMinor + financingMinor,
      principalMinor: row.principalMinor, financingMinor, recognisedMinor, undoneMinor, state, entryId: installmentEntryId(plan.id, row.number, 'principal') };
  });
}

export interface PlanSummary {
  plan: InstallmentPlan;
  /** The distinct figures (decision 003, rule 7): price, recognised, undone, future committed, cancelled, remaining. */
  figures: InstallmentPlanFigures;
  status: InstallmentPlanStatus;
  /** The first instalment still to come, when the plan is live. */
  next: PlanScheduleRow | null;
  /** Interest, fee and tax of the whole plan (this form records interest only). */
  financingMinor: number;
  /** Price plus financing: «Total financiado». Equal to the price without financing. */
  totalFinancedMinor: number;
  /** A live plan with nothing recorded yet (created by mistake): the one lifecycle action 24T2 offers is deleting it.
   * Never for a cancelled or deleted plan (storage refuses both). */
  deletable: boolean;
}

export function planSummary(plan: InstallmentPlan, records: readonly RecordedEntry[]): PlanSummary {
  const figures = installmentPlanFigures(plan, records);
  const rows = planScheduleRows(plan, records);
  const financingMinor = plan.interestMinor + plan.feeMinor + plan.taxMinor;
  let deletable = !plan.deleted && plan.cancelledAt === null;
  if (deletable) { try { assertInstallmentPlanDeletable(plan, records); } catch { deletable = false; } }
  return { plan, figures, status: figures.status, next: rows.find(row => row.state === 'next') ?? null, financingMinor,
    totalFinancedMinor: plan.principalMinor + financingMinor, deletable };
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
export function cardPlanSummaries(cardId: string, plans: readonly InstallmentPlan[] = [], records: readonly RecordedEntry[] = []): PlanSummary[] {
  const rank: Record<InstallmentPlanStatus, number> = { active: 0, completed: 1, cancelled: 2, deleted: 3 };
  const nextOf = (summary: PlanSummary) => summary.next?.billingDateISO ?? '9999-12-31';
  return plans.filter(plan => plan.cardId === cardId && !plan.deleted).map(plan => planSummary(plan, records))
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
