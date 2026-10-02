import { validDateISO, type Account, type Currency, type Entry } from './ledger.ts';
import { assertStorableCurrency } from './currency.ts';
import { MAX_ENTRY_MINOR } from './money.ts';
import { cardStatementsFrom, type CardCycleDates } from './card-cycles.ts';
import type { CreditCardProfile } from './liabilities.ts';
import type { PlanPayoff, PlanRefund, PurchaseOperation } from './operations.ts';
import type { EntryRecord, LedgerArchive } from './recovery.ts';
import { PLAN_NOT_CANCELLED_MESSAGE, PLAN_NOTHING_TO_STOP_MESSAGE, PLAN_OPERATION_HISTORY_MESSAGE, operationGuardMessage,
  type OperationContext } from './operation-messages.ts';

/** Producto 24T1: a purchase in instalments is **one purchase and one finite plan** (decision 003, rule 7). The plan
 * belongs to a credit card and is never a `RecurringRule`: nothing here runs through the recurring catch-up, and a rule
 * with the same merchant, amount and date is a different fact. Buying moves no cash account and records no expense.
 *
 * A plan has four **components**, each its own money with its own identity, never inferred from a combined total:
 * **principal** (the purchase price, in the purchase's category), **interest**, **fee** (comisión) and **tax** (financing
 * taxes), each of the last three with its own category when it is above zero. Every component is split exactly across
 * the instalments (integer minor units of the card's currency; the remainder on the first instalments) and every
 * non-zero share is recognised as its own ordinary expense on the card's hidden account, dated on the statement closing
 * it belongs to, with a deterministic id (`inst_`, `insti_`, `instf_`, `instt_` + plan + instalment number), so a
 * catch-up run twice, a crash, a retry or a restore never records a share twice, and each share is undone or restored on
 * its own. A zero component records nothing.
 *
 * Vocabulary (used by 24T2's design and the docs): **compra** (the purchase: merchant, price, date), **plan** (this
 * row), **cuota futura** (a share whose movement is not in the ledger: a commitment, never an expense), **cuota
 * reconocida / facturada** (a share whose movement is in the ledger, not undone: it counts once, in its statement's
 * month, in its component's category, and raises the card's balance due), **saldo pendiente actual** (the card
 * account's negative balance: recognised purchases and shares minus payments), **pago** (a transfer into the card,
 * never assigned to a plan), **principal restante** (the principal not yet recognised). scheduled ≠ recognised/billed ≠
 * paid: «pagada» is never derived, because a card mixes purchases, plans, charges and refunds and a general payment says
 * nothing about which share it covers.
 *
 * Gates for later deliveries: how pending instalments consume the issuer's available credit stays open (decision 003:
 * `cardAvailableLimitMinor` answers null for a card with a pending plan, and 24T2 shows «No calculado con cuotas», never a
 * formula), refunds and early payoff (24T3: no save changes a plan's money, count or dates, so those will be operations
 * with their own records), and a purchase whose currency differs from the card's billing currency (24C2: a plan is
 * same-currency here). Since 24T2 a new plan's calendar is the card's effective calendar at creation (its usual days and
 * its exact statement dates, card-cycles.ts); once written, the schedule never follows a later change. */
export type StatementPlacement = 'current' | 'next';

/** The four components of a plan, in a fixed order. Each one's per-instalment share is `<component>Minor` on an
 * `Installment` and its total is `<component>Minor` on the plan. */
export const INSTALLMENT_COMPONENTS = ['principal', 'interest', 'fee', 'tax'] as const;
export type InstallmentComponent = typeof INSTALLMENT_COMPONENTS[number];
export const FINANCING_COMPONENTS = ['interest', 'fee', 'tax'] as const;
export type FinancingComponent = typeof FINANCING_COMPONENTS[number];
const PREFIX: Record<InstallmentComponent, string> = { principal: 'inst', interest: 'insti', fee: 'instf', tax: 'instt' };
const COMPONENT_OF_PREFIX: Record<string, InstallmentComponent> = { '': 'principal', i: 'interest', f: 'fee', t: 'tax' };

export interface Installment {
  /** 1-based position in the plan. */
  number: number;
  /** The statement closing the instalment belongs to: its recognition date (its shares count in this month). Contractual and
   * date-only: computed once from the card's calendar at purchase time (its closing day, and since 24T2 its exact statement
   * dates); a later change of the card's days or dates rewrites nothing. */
  billingDateISO: string;
  /** The payment due date of that statement (the card's due day after its closing, or the statement's exact due date).
   * Informative: paying stays a transfer the person records. */
  dueDateISO: string;
  /** Principal recognised by this instalment, > 0. The principal shares sum exactly to the plan's principal. */
  principalMinor: number;
  /** This instalment's share of each financing component, >= 0; each sums exactly to its component's total. */
  interestMinor: number;
  feeMinor: number;
  taxMinor: number;
}

export interface InstallmentPlan {
  id: string;
  /** The credit card the plan belongs to; its hidden account takes every share. A plan never moves to another card. */
  cardId: string;
  merchant: string;
  /** The category of the principal (the purchase's own). */
  category: string;
  /** The card's currency (24T1: the purchase, billing and instalment currency are one; 24C2 adds the original-currency record). */
  currency: Currency;
  purchaseDateISO: string;
  /** The purchase price: the total principal, > 0. */
  principalMinor: number;
  count: number;
  /** Financing components: each total >= 0, each with its own category when above zero ('' when zero). Never principal. */
  interestMinor: number;
  interestCategory: string;
  feeMinor: number;
  feeCategory: string;
  taxMinor: number;
  taxCategory: string;
  /** The exact calendar, one row per instalment, written once at creation. */
  schedule: Installment[];
  /** A cancelled plan records no further share; the ones already recognised stay in the ledger (24T3 fills the UX). */
  cancelledAt: string | null;
  /** A deletion record (only a plan that never recorded a share: created by mistake). The row stays. */
  deleted: boolean;
  createdAt: string;
  revision: number;
  updatedAt: string;
}

export const MAX_INSTALLMENTS = 120;

export const PLAN_PRINCIPAL_MESSAGE = 'El precio de la compra en cuotas debe ser mayor que cero.';
export const PLAN_COUNT_MESSAGE = 'Elegí entre 1 y 120 cuotas.';
export const PLAN_TOO_SMALL_MESSAGE = 'Cada cuota debe ser de al menos una unidad menor de la moneda.';
export const PLAN_FINANCING_MESSAGE = 'Los intereses, las comisiones y los impuestos de financiación deben ser cero o positivos, cada uno con su propia categoría.';
/** 24T2: the one financing field of the purchase form («Total financiado») never goes below the price. */
export const PLAN_TOTAL_BELOW_PRICE_MESSAGE = 'El total financiado no puede ser menor que el precio.';
/** 24T2: a purchase form left open while the card's calendar changed: its preview no longer says when the plan bills. */
export const PLAN_CALENDAR_MESSAGE = 'El calendario de la tarjeta cambió desde que abriste la compra. Revisá la primera cuota y guardá de nuevo.';
export const PLAN_CARD_MESSAGE = 'Una compra en cuotas se registra en una tarjeta de crédito existente.';
export const PLAN_CURRENCY_MESSAGE = 'El plan de cuotas usa la moneda de su tarjeta.';
export const PLAN_STATE_MESSAGE = 'Estado de plan de cuotas inválido.';
export const PLAN_SCHEDULE_MESSAGE = 'El calendario de cuotas no coincide con el plan.';
export const PLAN_DELETED_MESSAGE = 'Este plan de cuotas fue eliminado.';
export const PLAN_CANCELLED_MESSAGE = 'Este plan de cuotas no se sigue.';
export const PLAN_HISTORY_MESSAGE = 'Este plan ya registró cuotas. Dejá de seguirlo; no se puede eliminar.';
/** 24T3 (A27): no «ajuste» exists; what changes a plan's money is a devolución or an adelanto, each an operation of its own. */
export const PLAN_CHANGE_MESSAGE = 'Un plan de cuotas no cambia su precio, sus cuotas ni sus fechas. Una devolución o un adelanto de cuotas se registra desde el plan.';
export const PLAN_EXISTS_MESSAGE = 'Este plan de cuotas ya existe con otros datos. Volvé a abrir el formulario.';
export const PLAN_MISSING_MESSAGE = 'No encontramos este plan de cuotas.';
export const PLAN_DELETE_PATH_MESSAGE = 'Un plan de cuotas deja de seguirse o se elimina con su propia acción, no con un cambio de datos.';
export const INSTALLMENT_ENTRY_MESSAGE = 'El importe, la fecha y la tarjeta de una cuota no se editan. Una devolución o un adelanto de cuotas se registra desde su plan.';
export const INSTALLMENT_ID_MESSAGE = 'Un movimiento nuevo no puede usar el identificador de una cuota.';
export const INSTALLMENT_DRIFT_MESSAGE = 'Una cuota registrada no coincide con su plan. No se modificó nada.';
/** A card with a pending plan is archived, never deleted: its instalments keep coming due and a deleted card takes nothing. */
export const CARD_PLAN_MESSAGE = 'Esta tarjeta tiene cuotas pendientes. Archivala; no se puede eliminar.';

const PLAN_SCALAR_KEYS = ['id', 'cardId', 'merchant', 'category', 'currency', 'purchaseDateISO', 'principalMinor', 'count',
  'interestMinor', 'interestCategory', 'feeMinor', 'feeCategory', 'taxMinor', 'taxCategory'] as const;
const PLAN_STATE_KEYS = ['cancelledAt', 'deleted', 'createdAt', 'revision', 'updatedAt'] as const;
export const INSTALLMENT_KEYS = ['number', 'billingDateISO', 'dueDateISO', 'principalMinor', 'interestMinor', 'feeMinor', 'taxMinor'] as const;
export const INSTALLMENT_PLAN_KEYS = [...PLAN_SCALAR_KEYS, 'schedule', ...PLAN_STATE_KEYS] as const;

function validId(value: string): boolean {
  return typeof value === 'string' && /^[a-zA-Z0-9_-]{1,70}$/.test(value);
}
function validTimestamp(value: string): boolean {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}
const amountKey = (component: InstallmentComponent) => `${component}Minor` as const;
/** The category a component's movements are recorded under. */
export function componentCategory(plan: Pick<InstallmentPlan, 'category' | 'interestCategory' | 'feeCategory' | 'taxCategory'>, component: InstallmentComponent): string {
  return component === 'principal' ? plan.category : plan[`${component}Category`];
}

// ---- money: exact distribution -------------------------------------------------------------------------------------

/** Splits `totalMinor` into `count` integer parts that sum exactly to it: `floor(total / count)` each, and the remainder
 * (always fewer units than instalments) goes one unit at a time to the **first** instalments, so the first instalment is
 * the largest by at most one minor unit and the rule is the same for any exponent (0, 2 or 3). Deterministic; never loses
 * or creates a unit. A principal is refused when it is not a positive safe integer within the ledger's bound or when
 * some instalment would be empty; a financing component may be zero. */
export function distributeMinor(totalMinor: number, count: number, { allowZero = false } = {}): number[] {
  if (!Number.isInteger(count) || count < 1 || count > MAX_INSTALLMENTS) throw new Error(PLAN_COUNT_MESSAGE);
  if (!Number.isSafeInteger(totalMinor) || totalMinor < 0 || totalMinor > MAX_ENTRY_MINOR || (!allowZero && totalMinor === 0)) {
    throw new Error(allowZero ? PLAN_FINANCING_MESSAGE : PLAN_PRINCIPAL_MESSAGE);
  }
  if (!allowZero && totalMinor < count) throw new Error(PLAN_TOO_SMALL_MESSAGE);
  const base = Math.floor(totalMinor / count);
  const remainder = totalMinor - base * count;
  return Array.from({ length: count }, (_, index) => base + (index < remainder ? 1 : 0));
}

// ---- calendar -------------------------------------------------------------------------------------------------------

/** The grid of the usual days lives in card-cycles.ts since 24T2 (with the card's exact cycle dates); the three 24T1 names
 * stay exported from here, unchanged. */
export { statementClosingAfter, statementClosingOnOrAfter, statementDueDate } from './card-cycles.ts';

/** Producto 24T2's financing UI: by default «Sin interés» (no field at all); «Con interés» shows one field, «Total
 * financiado». The interest is that total minus the price, exact in minor units (decision 003, rule 7). A total equal to
 * the price is no interest (never an invented charge); below the price it is refused. Fee and tax stay zero from this flow;
 * the engine keeps them. */
export function interestFromTotalFinanced(principalMinor: number, totalFinancedMinor: number): number {
  if (!Number.isSafeInteger(principalMinor) || principalMinor <= 0 || principalMinor > MAX_ENTRY_MINOR) throw new Error(PLAN_PRINCIPAL_MESSAGE);
  if (!Number.isSafeInteger(totalFinancedMinor)) throw new Error(PLAN_FINANCING_MESSAGE);
  if (totalFinancedMinor > MAX_ENTRY_MINOR) throw new Error('El monto es demasiado grande.');
  if (totalFinancedMinor < principalMinor) throw new Error(PLAN_TOTAL_BELOW_PRICE_MESSAGE);
  return totalFinancedMinor - principalMinor;
}

/** The financing a purchase form sends to `newInstallmentPlan`: «Sin interés» (`totalFinancedMinor` null) or a total
 * financed equal to the price is no interest and no interest category (a zero component never carries one); a larger
 * total is the difference, in `interestCategory` (the Intereses identity, `interestCategoryLabel`). */
/** Producto 24T2: the categories the financing of saved plans records in (interest, and fee or tax in older plans), so a
 * latent category such as Intereses is listed from the moment a plan needs it, before its first instalment is recorded.
 * A deleted plan (created by mistake, nothing recorded) needs nothing. */
export function planFinancingCategories(plans: readonly InstallmentPlan[] = []): string[] {
  const categories = new Set<string>();
  for (const plan of plans) {
    if (plan.deleted) continue;
    if (plan.interestMinor > 0 && plan.interestCategory) categories.add(plan.interestCategory);
    if (plan.feeMinor > 0 && plan.feeCategory) categories.add(plan.feeCategory);
    if (plan.taxMinor > 0 && plan.taxCategory) categories.add(plan.taxCategory);
  }
  return [...categories];
}

export function planFinancing(principalMinor: number, totalFinancedMinor: number | null, interestCategory: string): { interestMinor: number; interestCategory: string } {
  const interestMinor = totalFinancedMinor === null ? 0 : interestFromTotalFinanced(principalMinor, totalFinancedMinor);
  return { interestMinor, interestCategory: interestMinor > 0 ? interestCategory : '' };
}

/** What each instalment of a schedule charges in total (principal and every financing share), and whether they are all
 * the same. Each component places its remainder on the first instalments on its own, so two instalments may differ by a
 * few minor units: a form says «aprox.» then, never that they are equal. */
export function installmentAmounts(schedule: readonly Installment[]): { amounts: number[]; maxMinor: number; minMinor: number; even: boolean } {
  const amounts = schedule.map(row => row.principalMinor + row.interestMinor + row.feeMinor + row.taxMinor);
  const maxMinor = Math.max(...amounts), minMinor = Math.min(...amounts);
  return { amounts, maxMinor, minMinor, even: maxMinor === minMinor };
}

/** The financing totals of a plan, each component on its own. */
export type FinancingTotals = { interestMinor: number; feeMinor: number; taxMinor: number };
const NO_FINANCING: FinancingTotals = { interestMinor: 0, feeMinor: 0, taxMinor: 0 };

/** The exact calendar of a plan: instalment 1 on the purchase's current statement (the first closing on or after the
 * purchase date) or on the next one, then one statement per instalment, each with its due date. The statements are the
 * card's effective calendar when the plan is created (24T2): its exact cycle dates (`cycleDates`, the card's own rows)
 * where it has them, the usual days elsewhere; without exact dates this is 24T1's grid on the card's closing day, date
 * for date. Every component (principal, interest, fee, tax) is split on its own with the same rule. Dates only. Fixed at
 * purchase time: the card's days or exact dates may change later without rewriting it. */
export function installmentSchedule(card: Pick<CreditCardProfile, 'closingDay' | 'dueDay'>, purchaseDateISO: string, placement: StatementPlacement,
  principalMinor: number, count: number, financing: FinancingTotals = NO_FINANCING, cycleDates: readonly CardCycleDates[] = []): Installment[] {
  if (placement !== 'current' && placement !== 'next') throw new Error(PLAN_SCHEDULE_MESSAGE);
  if (!validDateISO(purchaseDateISO)) throw new Error('Elegí una fecha válida.');
  const principal = distributeMinor(principalMinor, count);
  const interest = distributeMinor(financing.interestMinor, count, { allowZero: true });
  const fee = distributeMinor(financing.feeMinor, count, { allowZero: true });
  const tax = distributeMinor(financing.taxMinor, count, { allowZero: true });
  const statements = cardStatementsFrom(card, cycleDates, purchaseDateISO, placement === 'next' ? 1 : 0, count);
  return principal.map((share, index) => ({ number: index + 1, billingDateISO: statements[index].closingISO, dueDateISO: statements[index].dueISO,
    principalMinor: share, interestMinor: interest[index], feeMinor: fee[index], taxMinor: tax[index] }));
}

// ---- identity of the movements a plan records ---------------------------------------------------------------------

/** The deterministic id of the movement that recognises one component of instalment `number`. Never generated by a
 * form: `createEntry` refuses these prefixes. */
export function installmentEntryId(planId: string, number: number, component: InstallmentComponent = 'principal'): string {
  return `${PREFIX[component]}_${planId}_${String(number).padStart(3, '0')}`;
}
/** The plan, the instalment and the component behind a movement's id, or null for any other movement. */
export function installmentOccurrenceOf(entryId: string): { planId: string; number: number; component: InstallmentComponent } | null {
  const match = /^inst([ift]?)_([a-zA-Z0-9_-]{1,70})_(\d{3})$/.exec(entryId);
  if (!match) return null;
  const number = Number(match[3]);
  if (number < 1 || number > MAX_INSTALLMENTS) return null;
  return { planId: match[2], number, component: COMPONENT_OF_PREFIX[match[1]] };
}
/** A new movement typed by a person never takes an instalment's id. */
export function assertNewEntryId(entryId: string): void {
  if (installmentOccurrenceOf(entryId)) throw new Error(INSTALLMENT_ID_MESSAGE);
}

/** The movements one instalment records: one per component whose share is above zero, each on the card's hidden
 * account, in its component's category, dated on the instalment's statement closing. A zero share records nothing. */
export function installmentEntries(plan: Pick<InstallmentPlan, 'id' | 'merchant' | 'category' | 'interestCategory' | 'feeCategory' | 'taxCategory'>,
  cardAccountId: string, installment: Installment): Entry[] {
  const createdAt = installment.billingDateISO + 'T12:00:00.000Z';
  return INSTALLMENT_COMPONENTS.filter(component => installment[amountKey(component)] > 0).map(component => ({
    id: installmentEntryId(plan.id, installment.number, component), accountId: cardAccountId, kind: 'expense' as const,
    amountMinor: installment[amountKey(component)], merchant: plan.merchant, category: componentCategory(plan, component),
    dateISO: installment.billingDateISO, createdAt,
  }));
}

// ---- validation -----------------------------------------------------------------------------------------------------

function validateInstallment(row: Installment, previous: Installment | null, number: number): void {
  if (!row || typeof row !== 'object' || Object.keys(row).length !== INSTALLMENT_KEYS.length || INSTALLMENT_KEYS.some(key => !Object.hasOwn(row, key))) throw new Error(PLAN_SCHEDULE_MESSAGE);
  if (row.number !== number || !validDateISO(row.billingDateISO) || !validDateISO(row.dueDateISO) || row.dueDateISO <= row.billingDateISO) throw new Error(PLAN_SCHEDULE_MESSAGE);
  if (!Number.isSafeInteger(row.principalMinor) || row.principalMinor <= 0) throw new Error(PLAN_SCHEDULE_MESSAGE);
  for (const component of FINANCING_COMPONENTS) {
    const share = row[amountKey(component)];
    if (!Number.isSafeInteger(share) || share < 0) throw new Error(PLAN_SCHEDULE_MESSAGE);
  }
  if (previous && row.billingDateISO <= previous.billingDateISO) throw new Error(PLAN_SCHEDULE_MESSAGE);
}

/** Read acceptance of one plan: its shape, its card (an existing profile whose account holds the plan's currency), its
 * money (a positive principal; each financing component zero or positive, with its own category exactly when it is
 * above zero) and its schedule (one row per instalment, strictly increasing closings, and every component's shares
 * summing exactly to that component's total). */
export function validateInstallmentPlan(plan: InstallmentPlan, cards: readonly CreditCardProfile[], accounts: readonly Account[]): void {
  if (!plan || typeof plan !== 'object' || !validId(plan.id) || !validId(plan.cardId)) throw new Error('Identificador de plan de cuotas inválido.');
  const card = cards.find(item => item.id === plan.cardId);
  const account = card && accounts.find(item => item.id === card.accountId);
  if (!card || !account) throw new Error(PLAN_CARD_MESSAGE);
  assertStorableCurrency(plan.currency);
  if (plan.currency !== account.currency) throw new Error(PLAN_CURRENCY_MESSAGE);
  if (typeof plan.merchant !== 'string' || !plan.merchant.trim() || plan.merchant.length > 120) throw new Error('Ingresá un comercio o concepto de hasta 120 caracteres.');
  if (typeof plan.category !== 'string' || !plan.category.trim() || plan.category.length > 60) throw new Error('Ingresá una categoría de hasta 60 caracteres.');
  if (!validDateISO(plan.purchaseDateISO)) throw new Error('Elegí una fecha válida.');
  if (!Number.isSafeInteger(plan.principalMinor) || plan.principalMinor <= 0 || plan.principalMinor > MAX_ENTRY_MINOR) throw new Error(PLAN_PRINCIPAL_MESSAGE);
  if (!Number.isInteger(plan.count) || plan.count < 1 || plan.count > MAX_INSTALLMENTS) throw new Error(PLAN_COUNT_MESSAGE);
  for (const component of FINANCING_COMPONENTS) {
    const total = plan[amountKey(component)], category = plan[`${component}Category`];
    if (!Number.isSafeInteger(total) || total < 0 || total > MAX_ENTRY_MINOR) throw new Error(PLAN_FINANCING_MESSAGE);
    if (typeof category !== 'string' || category.length > 60 || (total > 0) !== (category.trim().length > 0)) throw new Error(PLAN_FINANCING_MESSAGE);
  }
  if (!Array.isArray(plan.schedule) || plan.schedule.length !== plan.count) throw new Error(PLAN_SCHEDULE_MESSAGE);
  plan.schedule.forEach((row, index) => validateInstallment(row, index ? plan.schedule[index - 1] : null, index + 1));
  for (const component of INSTALLMENT_COMPONENTS) {
    const sum = plan.schedule.reduce((total, row) => total + BigInt(row[amountKey(component)]), 0n);
    if (sum !== BigInt(plan[amountKey(component)])) throw new Error(PLAN_SCHEDULE_MESSAGE);
  }
  if (plan.schedule[0].billingDateISO < plan.purchaseDateISO) throw new Error(PLAN_SCHEDULE_MESSAGE);
  if ((plan.cancelledAt !== null && !validTimestamp(plan.cancelledAt)) || typeof plan.deleted !== 'boolean' || (plan.deleted && plan.cancelledAt !== null)) throw new Error(PLAN_STATE_MESSAGE);
  if (!validTimestamp(plan.createdAt) || !validTimestamp(plan.updatedAt) || !Number.isSafeInteger(plan.revision) || plan.revision < 0) throw new Error(PLAN_STATE_MESSAGE);
  if (plan.revision === 0 && (plan.updatedAt !== plan.createdAt || plan.cancelledAt !== null || plan.deleted)) throw new Error(PLAN_STATE_MESSAGE);
}

/** A saved plan keeps its identity, its card, its money, its categories and its calendar: only its lifecycle (cancelled,
 * deleted) and its version move. A devolución or an adelanto de cuotas (24T3, operations.ts) is an operation of the plan
 * with its own record, never a rewrite of these fields. Since 24T3 (A15) a stopped plan may be reactivated: `cancelledAt`
 * goes from a date back to null (one revision on, never deleted at once); any other change of a stop is refused. */
export function validateInstallmentPlanChange(before: InstallmentPlan, after: InstallmentPlan): void {
  if (before.deleted) throw new Error(PLAN_DELETED_MESSAGE);
  if (after.createdAt !== before.createdAt || after.revision !== before.revision + 1) throw new Error('El plan de cuotas cambió desde que lo abriste. Volvé a revisarlo.');
  if (PLAN_SCALAR_KEYS.some(key => before[key] !== after[key]) || !sameSchedule(before.schedule, after.schedule)) throw new Error(PLAN_CHANGE_MESSAGE);
  if (before.cancelledAt !== null && after.cancelledAt !== before.cancelledAt && (after.cancelledAt !== null || after.deleted)) throw new Error(PLAN_CANCELLED_MESSAGE);
}

function sameSchedule(a: readonly Installment[], b: readonly Installment[]): boolean {
  return a.length === b.length && a.every((row, index) => INSTALLMENT_KEYS.every(key => row[key] === b[index][key]));
}
/** 24T2: whether a new plan's schedule is exactly the one the card's calendar gives now (its usual days and its exact
 * statement dates), for either placement. Storage checks it when a plan is created, never on an existing or imported plan
 * (their schedules are contractual). */
export function planFollowsCalendar(plan: InstallmentPlan, card: Pick<CreditCardProfile, 'id' | 'closingDay' | 'dueDay'>, cycleDates: readonly CardCycleDates[] = []): boolean {
  const rows = cycleDates.filter(row => row.cardId === card.id);
  const financing = { interestMinor: plan.interestMinor, feeMinor: plan.feeMinor, taxMinor: plan.taxMinor };
  return (['current', 'next'] as const).some(placement => {
    try { return sameSchedule(installmentSchedule(card, plan.purchaseDateISO, placement, plan.principalMinor, plan.count, financing, rows), plan.schedule); } catch { return false; }
  });
}
export function sameInstallmentPlan(a: InstallmentPlan, b: InstallmentPlan): boolean {
  return [...PLAN_SCALAR_KEYS, ...PLAN_STATE_KEYS].every(key => a[key] === b[key]) && sameSchedule(a.schedule, b.schedule);
}

/** A new plan for a purchase on `card`: the schedule from the card's calendar as known now (its usual days and its exact
 * cycle dates, `cycleDates`), the plan's currency from the card's account, revision 0. Each financing component is
 * optional and explicit, with its own category. An archived or deleted card takes no new plan (it keeps the ones it has). */
export function newInstallmentPlan(input: {
  id: string; card: CreditCardProfile; cardAccount: Account; merchant: string; category: string; purchaseDateISO: string; principalMinor: number; count: number;
  placement: StatementPlacement; interestMinor?: number; interestCategory?: string; feeMinor?: number; feeCategory?: string; taxMinor?: number; taxCategory?: string; createdAt: string;
  cycleDates?: readonly CardCycleDates[];
}): InstallmentPlan {
  if (input.card.accountId !== input.cardAccount.id) throw new Error(PLAN_CARD_MESSAGE);
  if (input.card.deleted) throw new Error('Esta tarjeta fue eliminada.');
  if (!input.card.active) throw new Error('Esta tarjeta está archivada. Reactivala para registrar compras nuevas.'); // CARD_ARCHIVED_MESSAGE (no runtime import: liabilities imports this module)
  const financing = { interestMinor: input.interestMinor ?? 0, feeMinor: input.feeMinor ?? 0, taxMinor: input.taxMinor ?? 0 };
  for (const total of Object.values(financing)) if (!Number.isSafeInteger(total) || total < 0) throw new Error(PLAN_FINANCING_MESSAGE);
  const plan: InstallmentPlan = {
    id: input.id, cardId: input.card.id, merchant: input.merchant.trim(), category: input.category.trim(), currency: input.cardAccount.currency,
    purchaseDateISO: input.purchaseDateISO, principalMinor: input.principalMinor, count: input.count,
    interestMinor: financing.interestMinor, interestCategory: (input.interestCategory ?? '').trim(),
    feeMinor: financing.feeMinor, feeCategory: (input.feeCategory ?? '').trim(),
    taxMinor: financing.taxMinor, taxCategory: (input.taxCategory ?? '').trim(),
    schedule: installmentSchedule(input.card, input.purchaseDateISO, input.placement, input.principalMinor, input.count, financing,
      (input.cycleDates ?? []).filter(row => row.cardId === input.card.id)),
    cancelledAt: null, deleted: false, createdAt: input.createdAt, revision: 0, updatedAt: input.createdAt,
  };
  validateInstallmentPlan(plan, [input.card], [input.cardAccount]);
  return plan;
}

// ---- state, derived from the ledger and the plan's operations (never stored twice) --------------------------------

/** What the ledger holds for a movement id: the minimal view of an `EntryRecord` this module needs (no runtime import of
 * the archive module, which imports this one). */
export interface RecordedEntry { entry: Entry; voided: boolean }

/** The state of one share (one component of one instalment), read from the ledger and the plan's live operations
 * (24T3, A2), never stored beside the schedule:
 * - **recognised**: its movement is in the ledger and counts;
 * - **undone**: the person voided that movement: it counts nowhere, the obligation is still open, and the catch-up never
 *   recreates it (restoring the movement brings it back);
 * - **settled** («Adelantada»): a live adelanto de cuotas recognised it on the adelanto's date (never «pagada»);
 * - **waived** («No se cobró»): a financing share an adelanto recorded as not charged by the issuer;
 * - **refunded** («Reembolsada»): live devoluciones reduced its principal to zero before it was recorded;
 * - **cancelled** («No se registra»): the plan stopped (or was deleted) before the share was recorded;
 * - **scheduled**: still to come (its statement has not closed, or the catch-up has not run).
 * Each component has its own movement and its own state: undoing the principal leaves the interest as it is. */
export type InstallmentState = 'scheduled' | 'recognised' | 'undone' | 'settled' | 'waived' | 'refunded' | 'cancelled';

/** One share with its effective amount: the contractual share minus the live devoluciones' reductions on it (principal
 * only), the single source every reader uses (figures, status, pending, commitments, rows, materialization, drift). */
export interface EffectiveShare {
  number: number;
  component: InstallmentComponent;
  billingDateISO: string;
  dueDateISO: string;
  /** The deterministic id of the movement that recognises (or recognised) this share. */
  entryId: string;
  /** The contractual share, from the schedule. */
  scheduleMinor: number;
  /** Σ of the live reductions on it («Reducida por devolución»); always 0 for a financing share. */
  reducedMinor: number;
  /** schedule − reductions: what is (or will be) recognised for it. */
  amountMinor: number;
  state: InstallmentState;
  /** The live adelanto covering it (settled or waived), null otherwise. */
  payoffId: string | null;
}

const shareKey = (number: number, component: InstallmentComponent) => `${number}|${component}`;
/** The plan an operation belongs to, or null for a devolución of an ordinary purchase. */
function planIdOf(operation: PurchaseOperation): string | null {
  return 'planId' in operation.target ? operation.target.planId : null;
}

interface PlanOperations {
  /** Live devoluciones and adelantos of the plan. */
  refunds: PlanRefund[];
  payoffs: PlanPayoff[];
  /** Σ of live reductions per instalment number (principal). */
  reductions: Map<number, bigint>;
  /** The first live adelanto covering each share, with the frozen amount it covers. */
  covered: Map<string, { payoff: PlanPayoff; minor: number }>;
  /** Every operation of the plan, undone ones included. */
  all: readonly PurchaseOperation[];
}
function indexPlanOperations(all: readonly PurchaseOperation[]): PlanOperations {
  const refunds: PlanRefund[] = [], payoffs: PlanPayoff[] = [];
  const reductions = new Map<number, bigint>();
  const covered = new Map<string, { payoff: PlanPayoff; minor: number }>();
  for (const operation of all) {
    if (operation.voided) continue;
    if (operation.kind === 'payoff') {
      payoffs.push(operation);
      for (const row of operation.covered) {
        const key = shareKey(row.number, row.component);
        if (!covered.has(key)) covered.set(key, { payoff: operation, minor: row.minor });
      }
    } else {
      const refund = operation as PlanRefund; // grouped by plan: an ordinary purchase's devolución never reaches here
      refunds.push(refund);
      for (const row of refund.reductions) reductions.set(row.number, (reductions.get(row.number) ?? 0n) + BigInt(row.minor));
    }
  }
  return { refunds, payoffs, reductions, covered, all };
}
function operationsOfPlan(planId: string, operations: readonly PurchaseOperation[]): PlanOperations {
  return indexPlanOperations(operations.filter(operation => planIdOf(operation) === planId));
}
/** Every operation grouped by its plan, built once for readers that walk several plans (A21). */
function operationsByPlan(operations: readonly PurchaseOperation[]): Map<string, PurchaseOperation[]> {
  const result = new Map<string, PurchaseOperation[]>();
  for (const operation of operations) {
    const planId = planIdOf(operation);
    if (planId === null) continue;
    const list = result.get(planId);
    if (list) list.push(operation); else result.set(planId, [operation]);
  }
  return result;
}
function recordMap(records: readonly RecordedEntry[]): Map<string, RecordedEntry> {
  return new Map(records.map(record => [record.entry.id, record]));
}

function shareOf(plan: InstallmentPlan, row: Installment, component: InstallmentComponent, record: RecordedEntry | undefined, operations: PlanOperations): EffectiveShare {
  const scheduleMinor = row[amountKey(component)];
  const reduced = component === 'principal' ? operations.reductions.get(row.number) ?? 0n : 0n;
  const amount = BigInt(scheduleMinor) - reduced;
  const cover = operations.covered.get(shareKey(row.number, component));
  let state: InstallmentState;
  if (record) state = record.voided ? 'undone' : 'recognised';
  else if (cover) state = component !== 'principal' && cover.payoff.financing === 'waived' ? 'waived' : 'settled';
  else if (scheduleMinor > 0 && amount <= 0n) state = 'refunded';
  else if (plan.cancelledAt !== null || plan.deleted) state = 'cancelled';
  else state = 'scheduled';
  return { number: row.number, component, billingDateISO: row.billingDateISO, dueDateISO: row.dueDateISO, entryId: installmentEntryId(plan.id, row.number, component),
    scheduleMinor, reducedMinor: Number(reduced), amountMinor: amount > 0n ? Number(amount) : 0, state, payoffId: cover?.payoff.id ?? null };
}
/** Every share that carries money (a zero share records nothing and has no state of its own), in schedule order. */
function shareList(plan: InstallmentPlan, records: ReadonlyMap<string, RecordedEntry>, operations: PlanOperations): EffectiveShare[] {
  const result: EffectiveShare[] = [];
  for (const row of plan.schedule) {
    for (const component of INSTALLMENT_COMPONENTS) {
      if (row[amountKey(component)] <= 0) continue;
      result.push(shareOf(plan, row, component, records.get(installmentEntryId(plan.id, row.number, component)), operations));
    }
  }
  return result;
}

/** The effective shares of a plan (A2): every (instalment, component) with money, its amount after live reductions and its
 * state. `operations` is every purchase operation of the ledger (undone ones included; only the plan's live ones count). */
export function effectiveShares(plan: InstallmentPlan, records: readonly RecordedEntry[], operations: readonly PurchaseOperation[]): EffectiveShare[] {
  return shareList(plan, recordMap(records), operationsOfPlan(plan.id, operations));
}

/** The state of one component of one instalment (see `InstallmentState`). A zero share has no money of its own: it reads
 * as its movement says, or as scheduled/cancelled. */
export function installmentState(plan: InstallmentPlan, installment: Pick<Installment, 'number'>, records: readonly RecordedEntry[],
  operations: readonly PurchaseOperation[], component: InstallmentComponent = 'principal'): InstallmentState {
  const row = plan.schedule.find(item => item.number === installment.number);
  const id = installmentEntryId(plan.id, installment.number, component);
  const record = records.find(item => item.entry.id === id);
  if (!row || row[amountKey(component)] <= 0) {
    if (record) return record.voided ? 'undone' : 'recognised';
    return plan.cancelledAt !== null || plan.deleted ? 'cancelled' : 'scheduled';
  }
  return shareOf(plan, row, component, record, operationsOfPlan(plan.id, operations)).state;
}

export type InstallmentPlanStatus = 'active' | 'completed' | 'cancelled' | 'deleted';
function statusOf(plan: InstallmentPlan, shares: readonly EffectiveShare[]): InstallmentPlanStatus {
  if (plan.deleted) return 'deleted';
  if (plan.cancelledAt !== null) return 'cancelled';
  return shares.some(share => share.state === 'scheduled' || share.state === 'undone') ? 'active' : 'completed';
}
/** Completed once a live plan has nothing scheduled and nothing undone: every share is recognised, brought forward by an
 * adelanto, waived, or refunded to zero (A2). A plan whose principal was all returned while its financing is still
 * scheduled stays active (A17). */
export function installmentPlanStatus(plan: InstallmentPlan, records: readonly RecordedEntry[], operations: readonly PurchaseOperation[]): InstallmentPlanStatus {
  return statusOf(plan, effectiveShares(plan, records, operations));
}

/** One component's figures, every amount after live reductions (A1, A2): its total; what counts (`recognisedMinor`: the
 * recorded movements plus the shares an adelanto brought forward, `settledMinor` being the latter); what the person undid;
 * what is still to come (zero once the plan stops, when it moves to `cancelledMinor`); what an adelanto recorded as not
 * charged (`waivedMinor`, financing only); the principal returned by devoluciones, as a credit that reverses recognised
 * principal (`refundedCreditMinor`) and as reductions of shares not yet recorded (`refundedFutureMinor`, whatever the
 * share's state since); and what is left to recognise (`remainingMinor` = total − recognised − reductions − waived = scheduled
 * + undone + cancelled). Per component: recognised + scheduled + refundedFuture + undone + cancelled + waived = total. */
export interface ComponentFigures {
  totalMinor: number; recognisedMinor: number; settledMinor: number; undoneMinor: number; scheduledMinor: number; cancelledMinor: number;
  waivedMinor: number; refundedCreditMinor: number; refundedFutureMinor: number; remainingMinor: number;
}

/** The distinct figures of one plan (decision 003, rule 7), never merged. For the principal, at the top level: the purchase
 * price (`principalMinor`), the principal recognised (`recognisedMinor`, adelantos included, `settledMinor` their part),
 * undone, future committed (`scheduledMinor`), cancelled, still to recognise (`remainingMinor`), and the devoluciones:
 * `refundedMinor` = Σ live devoluciones = `refundedCreditMinor` + `refundedFutureMinor`. Every component on its own in
 * `components`. `financingRecognisedMinor` is interest + fee + tax recognised; `financingWaivedMinor` what an adelanto
 * recorded as not charged. `recognisedCount` counts principal shares recognised or brought forward. With nothing undone or
 * cancelled: recognised − refundedCredit + scheduled = principal − refunded. There is no «paid» figure: a general card
 * payment is never assigned to a plan. */
export interface InstallmentPlanFigures {
  principalMinor: number; recognisedMinor: number; settledMinor: number; undoneMinor: number; scheduledMinor: number; cancelledMinor: number; remainingMinor: number;
  refundedMinor: number; refundedCreditMinor: number; refundedFutureMinor: number;
  components: Record<InstallmentComponent, ComponentFigures>;
  financingRecognisedMinor: number; financingWaivedMinor: number; recognisedCount: number; count: number; status: InstallmentPlanStatus;
}
function figuresOf(plan: InstallmentPlan, shares: readonly EffectiveShare[], operations: PlanOperations): InstallmentPlanFigures {
  type Sums = { recognised: bigint; settled: bigint; undone: bigint; scheduled: bigint; cancelled: bigint; waived: bigint; reduced: bigint };
  const sums = Object.fromEntries(INSTALLMENT_COMPONENTS.map(component => [component,
    { recognised: 0n, settled: 0n, undone: 0n, scheduled: 0n, cancelled: 0n, waived: 0n, reduced: 0n }])) as Record<InstallmentComponent, Sums>;
  let recognisedCount = 0;
  for (const share of shares) {
    const sum = sums[share.component], amount = BigInt(share.amountMinor);
    sum.reduced += BigInt(Math.min(share.reducedMinor, share.scheduleMinor));
    if (share.state === 'recognised' || share.state === 'settled') {
      sum.recognised += amount;
      if (share.state === 'settled') sum.settled += amount;
      if (share.component === 'principal') recognisedCount++;
    } else if (share.state === 'undone') sum.undone += amount;
    else if (share.state === 'scheduled') sum.scheduled += amount;
    else if (share.state === 'cancelled') sum.cancelled += amount;
    else if (share.state === 'waived') sum.waived += amount;
  }
  const credit = operations.refunds.reduce((total, refund) => total + BigInt(refund.creditMinor), 0n);
  const refunded = operations.refunds.reduce((total, refund) => total + BigInt(refund.amountMinor), 0n);
  const components = Object.fromEntries(INSTALLMENT_COMPONENTS.map(component => {
    const sum = sums[component], total = BigInt(plan[amountKey(component)]);
    return [component, { totalMinor: Number(total), recognisedMinor: Number(sum.recognised), settledMinor: Number(sum.settled), undoneMinor: Number(sum.undone),
      scheduledMinor: Number(sum.scheduled), cancelledMinor: Number(sum.cancelled), waivedMinor: Number(sum.waived),
      refundedCreditMinor: component === 'principal' ? Number(credit) : 0, refundedFutureMinor: Number(sum.reduced),
      remainingMinor: Number(total - sum.recognised - sum.reduced - sum.waived) }];
  })) as Record<InstallmentComponent, ComponentFigures>;
  const principal = components.principal;
  return { principalMinor: plan.principalMinor, recognisedMinor: principal.recognisedMinor, settledMinor: principal.settledMinor, undoneMinor: principal.undoneMinor,
    scheduledMinor: principal.scheduledMinor, cancelledMinor: principal.cancelledMinor, remainingMinor: principal.remainingMinor,
    refundedMinor: Number(refunded), refundedCreditMinor: principal.refundedCreditMinor, refundedFutureMinor: principal.refundedFutureMinor, components,
    financingRecognisedMinor: FINANCING_COMPONENTS.reduce((total, component) => total + components[component].recognisedMinor, 0),
    financingWaivedMinor: FINANCING_COMPONENTS.reduce((total, component) => total + components[component].waivedMinor, 0),
    recognisedCount, count: plan.count, status: statusOf(plan, shares) };
}
export function installmentPlanFigures(plan: InstallmentPlan, records: readonly RecordedEntry[], operations: readonly PurchaseOperation[]): InstallmentPlanFigures {
  const planOperations = operationsOfPlan(plan.id, operations);
  return figuresOf(plan, shareList(plan, recordMap(records), planOperations), planOperations);
}

/** The plans of a card that still carry an obligation (A2): live (not cancelled, not deleted) with a share scheduled or
 * undone. A completed, stopped, fully refunded (financing included) or brought-forward plan is not pending; an adelanto
 * with an undone share left is still pending. Archiving keeps them; deleting the card is refused while one exists. */
export function pendingInstallmentPlans(card: Pick<CreditCardProfile, 'id'>, plans: readonly InstallmentPlan[], records: readonly RecordedEntry[],
  operations: readonly PurchaseOperation[]): InstallmentPlan[] {
  const recorded = recordMap(records), grouped = operationsByPlan(operations);
  return plans.filter(plan => plan.cardId === card.id && !plan.deleted && plan.cancelledAt === null
    && shareList(plan, recorded, indexPlanOperations(grouped.get(plan.id) ?? [])).some(share => share.state === 'scheduled' || share.state === 'undone'));
}
export function cardHasPendingInstallments(card: Pick<CreditCardProfile, 'id'>, plans: readonly InstallmentPlan[], records: readonly RecordedEntry[],
  operations: readonly PurchaseOperation[]): boolean {
  return pendingInstallmentPlans(card, plans, records, operations).length > 0;
}
function committed(card: Pick<CreditCardProfile, 'id'>, plans: readonly InstallmentPlan[], records: readonly RecordedEntry[], operations: readonly PurchaseOperation[],
  counts: (component: InstallmentComponent) => boolean): number {
  const recorded = recordMap(records), grouped = operationsByPlan(operations);
  let total = 0n;
  for (const plan of plans) {
    if (plan.cardId !== card.id || plan.deleted || plan.cancelledAt !== null) continue;
    for (const share of shareList(plan, recorded, indexPlanOperations(grouped.get(plan.id) ?? []))) {
      if (share.state === 'scheduled' && counts(share.component)) total += BigInt(share.amountMinor);
    }
  }
  if (total > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('El total supera el rango seguro.');
  return Number(total);
}
/** The future committed principal of a card (live plans, after reductions): a commitment figure beside the balance due,
 * never added into it. The future financing of each plan is in its `components`. Exact; refuses the unsafe range. */
export function cardCommittedMinor(card: Pick<CreditCardProfile, 'id'>, plans: readonly InstallmentPlan[], records: readonly RecordedEntry[],
  operations: readonly PurchaseOperation[]): number {
  return committed(card, plans, records, operations, component => component === 'principal');
}
/** Producto 24T2: the future financing (interest, fee and tax not recognised yet) of a card's live plans: what its future
 * instalments add to the future committed principal, shown beside it and never inside it (decision 003, rule 7). */
export function cardCommittedFinancingMinor(card: Pick<CreditCardProfile, 'id'>, plans: readonly InstallmentPlan[], records: readonly RecordedEntry[],
  operations: readonly PurchaseOperation[]): number {
  return committed(card, plans, records, operations, component => component !== 'principal');
}

// ---- materialization: deterministic and idempotent ----------------------------------------------------------------

/** The movements a plan should have in the ledger through `throughDateISO` and does not yet: every scheduled share (its
 * effective amount, after live reductions) of every instalment whose statement has closed by then, in order. A share an
 * adelanto covers, or one refunded to zero, is never produced (A2): each share is recognised once, by its movement or by
 * the adelanto. Idempotent by construction: an id already known (recorded, edited, or undone by the person) is never
 * produced again, so a catch-up run twice, after a crash, a retry or a restore adds nothing; a cancelled or deleted plan
 * produces nothing; a deleted card takes nothing (an archived card keeps its existing plans running). Nothing here touches
 * a `RecurringRule` and the recurring catch-up never calls this. */
export function materializeInstallmentPlan(plan: InstallmentPlan, card: CreditCardProfile, throughDateISO: string, known: ReadonlySet<string>,
  operations: readonly PurchaseOperation[]): Entry[] {
  if (!validDateISO(throughDateISO)) throw new Error('Fecha de procesamiento inválida.');
  if (plan.deleted || plan.cancelledAt !== null || card.deleted || card.id !== plan.cardId) return [];
  const planOperations = operationsOfPlan(plan.id, operations);
  const entries: Entry[] = [];
  for (const row of plan.schedule) {
    if (row.billingDateISO > throughDateISO) break;
    for (const component of INSTALLMENT_COMPONENTS) {
      if (row[amountKey(component)] <= 0) continue;
      const share = shareOf(plan, row, component, undefined, planOperations);
      if (share.state !== 'scheduled' || known.has(share.entryId)) continue;
      entries.push({ id: share.entryId, accountId: card.accountId, kind: 'expense', amountMinor: share.amountMinor, merchant: plan.merchant,
        category: componentCategory(plan, component), dateISO: row.billingDateISO, createdAt: row.billingDateISO + 'T12:00:00.000Z' });
    }
  }
  return entries;
}

/** Producto 24T3 (A8): the one pure catch-up of one plan through `todayISO` (a local date key, never a UTC slice): the
 * records to insert, with their deterministic ids, on their own closing dates. Every plan write (an operation created,
 * undone or restored; a plan stopped or reactivated) reads the archive, applies its change, appends these inserts and
 * validates the result once, in one exclusive transaction; the foreground catch-up runs it for every plan. */
export function planCatchUpInserts(archive: Pick<LedgerArchive, 'records' | 'cards' | 'installmentPlans' | 'purchaseOperations'>, planId: string, todayISO: string): EntryRecord[] {
  const plan = (archive.installmentPlans ?? []).find(item => item.id === planId);
  if (!plan) throw new Error(PLAN_MISSING_MESSAGE);
  const card = (archive.cards ?? []).find(item => item.id === plan.cardId);
  if (!card) return [];
  const known = new Set(archive.records.map(record => record.entry.id));
  return materializeInstallmentPlan(plan, card, todayISO, known, archive.purchaseOperations ?? [])
    .map(entry => ({ entry, revision: 0, voided: false, updatedAt: entry.createdAt }));
}

// ---- lifecycle -----------------------------------------------------------------------------------------------------

/** Stopping tracking («Dejar de seguir el plan», domain state `cancelled`) stops every future share; the ones recognised
 * stay in the ledger exactly as recorded (they were real statements). Never twice; never on a deleted plan. Storage first
 * runs the plan's catch-up through today in the same transaction (A8, bug M3) and checks `assertInstallmentPlanCancellable`. */
export function cancelInstallmentPlan(plan: InstallmentPlan, nowISO: string): InstallmentPlan {
  if (plan.deleted) throw new Error(PLAN_DELETED_MESSAGE);
  if (plan.cancelledAt !== null) throw new Error(PLAN_CANCELLED_MESSAGE);
  if (!validTimestamp(nowISO)) throw new Error('Fecha de actualización inválida.');
  return { ...plan, cancelledAt: nowISO, revision: plan.revision + 1, updatedAt: nowISO };
}
/** 24T3 (A9): a plan is stopped only while something is still scheduled, so a stop never coexists with an adelanto that
 * brought everything forward and never stops nothing. */
export function assertInstallmentPlanCancellable(plan: InstallmentPlan, records: readonly RecordedEntry[], operations: readonly PurchaseOperation[]): void {
  if (plan.deleted) throw new Error(PLAN_DELETED_MESSAGE);
  if (plan.cancelledAt !== null) throw new Error(PLAN_CANCELLED_MESSAGE);
  if (!effectiveShares(plan, records, operations).some(share => share.state === 'scheduled')) throw new Error(PLAN_NOTHING_TO_STOP_MESSAGE);
}
/** 24T3 (A15): «Reactivar plan», the undo of a stop: `cancelledAt` back to null, one revision on. Storage then runs the
 * plan's catch-up in the same transaction: shares whose closing passed while the plan was stopped are recorded on their
 * own closing dates, once. Allowed on an archived card (an existing obligation); storage refuses a deleted card. */
export function reactivateInstallmentPlan(plan: InstallmentPlan, nowISO: string): InstallmentPlan {
  if (plan.deleted) throw new Error(PLAN_DELETED_MESSAGE);
  if (plan.cancelledAt === null) throw new Error(PLAN_NOT_CANCELLED_MESSAGE);
  if (!validTimestamp(nowISO)) throw new Error('Fecha de actualización inválida.');
  return { ...plan, cancelledAt: null, revision: plan.revision + 1, updatedAt: nowISO };
}
/** A plan is deleted only while no component of it recorded anything and no operation (devolución or adelanto, undone
 * included, A16) names it: a plan created by mistake. With history it is stopped instead. */
export function assertInstallmentPlanDeletable(plan: InstallmentPlan, records: readonly RecordedEntry[], operations: readonly PurchaseOperation[]): void {
  if (plan.deleted) throw new Error(PLAN_DELETED_MESSAGE);
  const recorded = recordMap(records);
  if (shareList(plan, recorded, indexPlanOperations([])).some(share => share.state === 'recognised' || share.state === 'undone')) throw new Error(PLAN_HISTORY_MESSAGE);
  if (operations.some(operation => planIdOf(operation) === plan.id)) throw new Error(PLAN_OPERATION_HISTORY_MESSAGE);
}
export function deleteInstallmentPlan(plan: InstallmentPlan, nowISO: string): InstallmentPlan {
  if (plan.deleted) throw new Error(PLAN_DELETED_MESSAGE);
  if (!validTimestamp(nowISO)) throw new Error('Fecha de actualización inválida.');
  return { ...plan, cancelledAt: null, deleted: true, revision: plan.revision + 1, updatedAt: nowISO };
}

// ---- guards between the schedule and the ledger --------------------------------------------------------------------

/** A movement a plan recorded keeps its amount, its date, its account and its kind: those are the plan's. What changes a
 * plan's money is a devolución or an adelanto de cuotas (24T3, operations.ts). Its merchant and category may be corrected,
 * and it may be undone and restored (see `installmentState`). */
export function assertInstallmentEntryChange(before: Entry, after: Entry): void {
  if (!installmentOccurrenceOf(before.id)) return;
  if (after.id !== before.id || after.amountMinor !== before.amountMinor || after.dateISO !== before.dateISO || after.accountId !== before.accountId || after.kind !== before.kind) {
    throw new Error(INSTALLMENT_ENTRY_MESSAGE);
  }
}

/** The whole collection, and its agreement with the ledger: unique ids, each plan valid; every movement with an
 * instalment id (undone ones included) belongs to an existing plan, instalment and component with a share above zero, and
 * matches it (account, date, kind, and since 24T3 the **effective** amount: the share minus the live devoluciones'
 * reductions on it). Read on every archive validation, so a drift between the schedule and the ledger refuses the write
 * that would create it instead of being shown. The operation-aware checks run before the generic drift message (A22): a
 * movement over a share an adelanto covers, or a mismatch on a share a devolución reduced (now or before), names the
 * operation, worded by `context`. */
export function validateInstallmentPlans(plans: readonly InstallmentPlan[], cards: readonly CreditCardProfile[], accounts: readonly Account[], records: readonly RecordedEntry[],
  operations: readonly PurchaseOperation[], context?: OperationContext): void {
  const byId = new Map<string, InstallmentPlan>();
  for (const plan of plans) {
    if (byId.has(plan.id)) throw new Error('La copia repite un plan de cuotas.');
    validateInstallmentPlan(plan, cards, accounts);
    byId.set(plan.id, plan);
  }
  const grouped = operationsByPlan(operations);
  const indexed = new Map<string, PlanOperations>();
  for (const record of records) {
    const occurrence = installmentOccurrenceOf(record.entry.id);
    if (!occurrence) continue;
    const plan = byId.get(occurrence.planId);
    const row = plan?.schedule[occurrence.number - 1];
    const card = plan && cards.find(item => item.id === plan.cardId);
    if (!plan || !row || !card) throw new Error(INSTALLMENT_DRIFT_MESSAGE);
    const scheduled = row[amountKey(occurrence.component)];
    if (scheduled <= 0 || record.entry.accountId !== card.accountId || record.entry.kind !== 'expense' || record.entry.dateISO !== row.billingDateISO) {
      throw new Error(INSTALLMENT_DRIFT_MESSAGE);
    }
    let planOperations = indexed.get(plan.id);
    if (!planOperations) { planOperations = indexPlanOperations(grouped.get(plan.id) ?? []); indexed.set(plan.id, planOperations); }
    if (planOperations.covered.has(shareKey(occurrence.number, occurrence.component))) throw new Error(operationGuardMessage('payoff-overlap', context));
    const reduced = occurrence.component === 'principal' ? planOperations.reductions.get(occurrence.number) ?? 0n : 0n;
    // Reductions over the share: two devoluciones over one instalment (a restore across another one), worded by context.
    if (reduced > BigInt(scheduled)) throw new Error(operationGuardMessage('refund-overlap', context));
    if (BigInt(record.entry.amountMinor) !== BigInt(scheduled) - reduced) {
      const touched = occurrence.component === 'principal' && planOperations.all.some(operation => operation.kind === 'refund'
        && (operation as PlanRefund).reductions.some(reduction => reduction.number === occurrence.number));
      throw new Error(touched ? operationGuardMessage('refund-recorded', context) : INSTALLMENT_DRIFT_MESSAGE);
    }
  }
}
