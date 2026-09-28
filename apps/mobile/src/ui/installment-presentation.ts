import { MAX_INSTALLMENTS, assertInstallmentPlanDeletable, cardStatementsFrom, installmentAmounts, installmentEntryId, installmentOccurrenceOf, installmentPlanFigures,
  installmentSchedule, installmentState, type CardCycleDates, type CardStatement, type CreditCardProfile, type Installment, type InstallmentComponent,
  type InstallmentPlan, type InstallmentPlanFigures, type InstallmentPlanStatus, type RecordedEntry, type StatementPlacement } from '@finanzapp/domain';

/** Producto 24T2: what the screens show of a purchase in instalments, derived from the plan and the ledger (never stored
 * twice). Pure: no React, so Node tests load it directly. Words are chosen by the screens; this module names states. */

/** The counts the purchase form offers as one tap; any other count from 2 to 120 is typed. One instalment is a normal
 * purchase («Una vez»), so the form never offers it as financing. */
export const INSTALLMENT_COUNT_CHOICES = [3, 6, 12, 18, 24] as const;
export const MIN_PLAN_COUNT = 2;

/** A typed count, or null when it is not a whole number from 2 to 120. */
export function parseInstallmentCount(text: string): number | null {
  if (!/^\d{1,3}$/.test(text.trim())) return null;
  const count = Number(text.trim());
  return count >= MIN_PLAN_COUNT && count <= MAX_INSTALLMENTS ? count : null;
}

/** The state of one row of a plan's schedule, read from its principal's movement: `recognised` (in the ledger, it counts),
 * `undone` (the person undid it: it counts nowhere and is never recreated), `next` (the first one still to come), `future`,
 * or `cancelled` (the plan stopped before it). «Pagada» is never a state: a card payment is not assigned to an instalment. */
export type ScheduleRowState = 'recognised' | 'next' | 'future' | 'undone' | 'cancelled';
export interface PlanScheduleRow {
  number: number;
  billingDateISO: string;
  dueDateISO: string;
  /** What the instalment charges: its principal share plus its financing shares. */
  totalMinor: number;
  principalMinor: number;
  financingMinor: number;
  state: ScheduleRowState;
  /** The movement that recognises this instalment's principal (a recognised or undone row opens it). */
  entryId: string;
}

export function planScheduleRows(plan: InstallmentPlan, records: readonly RecordedEntry[]): PlanScheduleRow[] {
  const stopped = plan.cancelledAt !== null || plan.deleted;
  let nextGiven = false;
  return plan.schedule.map(row => {
    const principal = installmentState(plan, row, records, 'principal');
    let state: ScheduleRowState;
    if (principal === 'recognised') state = 'recognised';
    else if (principal === 'undone') state = 'undone';
    else if (stopped) state = 'cancelled';
    else if (!nextGiven) { state = 'next'; nextGiven = true; }
    else state = 'future';
    const financingMinor = row.interestMinor + row.feeMinor + row.taxMinor;
    return { number: row.number, billingDateISO: row.billingDateISO, dueDateISO: row.dueDateISO, totalMinor: row.principalMinor + financingMinor,
      principalMinor: row.principalMinor, financingMinor, state, entryId: installmentEntryId(plan.id, row.number, 'principal') };
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
  /** Nothing recorded yet (a plan created by mistake): the one lifecycle action 24T2 offers is deleting it. */
  deletable: boolean;
}

export function planSummary(plan: InstallmentPlan, records: readonly RecordedEntry[]): PlanSummary {
  const figures = installmentPlanFigures(plan, records);
  const rows = planScheduleRows(plan, records);
  const financingMinor = plan.interestMinor + plan.feeMinor + plan.taxMinor;
  let deletable = true;
  try { assertInstallmentPlanDeletable(plan, records); } catch { deletable = false; }
  return { plan, figures, status: figures.status, next: rows.find(row => row.state === 'next') ?? null, financingMinor,
    totalFinancedMinor: plan.principalMinor + financingMinor, deletable };
}

/** A card's plans for its detail: live ones first (by their next instalment), then completed, then cancelled. Deleted
 * plans (created by mistake, nothing recorded) are gone. */
export function cardPlanSummaries(cardId: string, plans: readonly InstallmentPlan[] = [], records: readonly RecordedEntry[] = []): PlanSummary[] {
  const rank: Record<InstallmentPlanStatus, number> = { active: 0, completed: 1, cancelled: 2, deleted: 3 };
  return plans.filter(plan => plan.cardId === cardId && !plan.deleted).map(plan => planSummary(plan, records))
    .sort((a, b) => rank[a.status] - rank[b.status] || (a.next?.billingDateISO ?? '').localeCompare(b.next?.billingDateISO ?? '')
      || b.plan.purchaseDateISO.localeCompare(a.plan.purchaseDateISO) || a.plan.id.localeCompare(b.plan.id));
}

/** The plan, the instalment and the component behind a movement, or null for any other movement. */
export function installmentOfEntry(entryId: string, plans: readonly InstallmentPlan[] = []): { plan: InstallmentPlan; number: number; count: number; component: InstallmentComponent } | null {
  const occurrence = installmentOccurrenceOf(entryId);
  if (!occurrence) return null;
  const plan = plans.find(item => item.id === occurrence.planId);
  return plan ? { plan, number: occurrence.number, count: plan.count, component: occurrence.component } : null;
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
  /** The first statement already closed (a purchase recorded late): that instalment is recognised when the plan is saved. */
  firstAlreadyClosed: boolean;
}

export function purchasePreview(input: { card: Pick<CreditCardProfile, 'id' | 'closingDay' | 'dueDay'>; cycleDates: readonly CardCycleDates[]; purchaseDateISO: string;
  placement: StatementPlacement; principalMinor: number; count: number; interestMinor: number; todayISO: string }): PurchasePreview | null {
  try {
    const schedule = installmentSchedule(input.card, input.purchaseDateISO, input.placement, input.principalMinor, input.count,
      { interestMinor: input.interestMinor, feeMinor: 0, taxMinor: 0 }, input.cycleDates.filter(row => row.cardId === input.card.id));
    const amounts = installmentAmounts(schedule);
    return { schedule, firstBillingISO: schedule[0].billingDateISO, firstDueISO: schedule[0].dueDateISO, maxMinor: amounts.maxMinor, minMinor: amounts.minMinor,
      even: amounts.even, firstAlreadyClosed: schedule[0].billingDateISO <= input.todayISO };
  } catch { return null; }
}
