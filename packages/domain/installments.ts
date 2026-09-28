import { validDateISO, type Account, type Currency, type Entry } from './ledger.ts';
import { assertStorableCurrency } from './currency.ts';
import { MAX_ENTRY_MINOR } from './money.ts';
import { cardStatementsFrom, type CardCycleDates } from './card-cycles.ts';
import type { CreditCardProfile } from './liabilities.ts';

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
 * Gates for later deliveries: how pending instalments consume the issuer's available credit (24T2, decided in decision
 * 003 first; until then `cardAvailableLimitMinor` answers null for a card with a pending plan), refunds and early payoff
 * (24T3: no save changes a plan's money, count or dates, so those will be operations with their own records), and a
 * purchase whose currency differs from the card's billing currency (24C2: a plan is same-currency here). */
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
   * date-only: computed once from the card's closing day at purchase time; a later change of the card's days rewrites nothing. */
  billingDateISO: string;
  /** The payment due date of that statement, from the card's due day. Informative: paying stays a transfer the person records. */
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
export const PLAN_CARD_MESSAGE = 'Una compra en cuotas se registra en una tarjeta de crédito existente.';
export const PLAN_CURRENCY_MESSAGE = 'El plan de cuotas usa la moneda de su tarjeta.';
export const PLAN_STATE_MESSAGE = 'Estado de plan de cuotas inválido.';
export const PLAN_SCHEDULE_MESSAGE = 'El calendario de cuotas no coincide con el plan.';
export const PLAN_DELETED_MESSAGE = 'Este plan de cuotas fue eliminado.';
export const PLAN_CANCELLED_MESSAGE = 'Este plan de cuotas fue cancelado.';
export const PLAN_HISTORY_MESSAGE = 'Este plan ya registró cuotas. Cancelalo; no se puede eliminar.';
export const PLAN_CHANGE_MESSAGE = 'Un plan de cuotas no cambia su precio, sus cuotas ni sus fechas. Un ajuste es una operación propia del plan.';
export const PLAN_EXISTS_MESSAGE = 'Este plan de cuotas ya existe con otros datos. Volvé a abrir el formulario.';
export const PLAN_MISSING_MESSAGE = 'No encontramos este plan de cuotas.';
export const PLAN_DELETE_PATH_MESSAGE = 'Un plan de cuotas se cancela o elimina con su propia acción, no con un cambio de datos.';
export const INSTALLMENT_ENTRY_MESSAGE = 'Una cuota se corrige desde su plan: el importe, la fecha y la tarjeta no se editan en el movimiento.';
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
  if (!Number.isSafeInteger(totalFinancedMinor) || totalFinancedMinor <= 0 || totalFinancedMinor > MAX_ENTRY_MINOR) throw new Error(PLAN_FINANCING_MESSAGE);
  if (totalFinancedMinor < principalMinor) throw new Error(PLAN_TOTAL_BELOW_PRICE_MESSAGE);
  return totalFinancedMinor - principalMinor;
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
 * deleted) and its version move. A refund, an early payoff or an adjustment (24T3) is an operation of the plan with its
 * own record, never a rewrite of these fields. */
export function validateInstallmentPlanChange(before: InstallmentPlan, after: InstallmentPlan): void {
  if (before.deleted) throw new Error(PLAN_DELETED_MESSAGE);
  if (after.createdAt !== before.createdAt || after.revision !== before.revision + 1) throw new Error('El plan de cuotas cambió desde que lo abriste. Volvé a revisarlo.');
  if (PLAN_SCALAR_KEYS.some(key => before[key] !== after[key]) || !sameSchedule(before.schedule, after.schedule)) throw new Error(PLAN_CHANGE_MESSAGE);
  if (before.cancelledAt !== null && after.cancelledAt !== before.cancelledAt) throw new Error(PLAN_CANCELLED_MESSAGE);
}

function sameSchedule(a: readonly Installment[], b: readonly Installment[]): boolean {
  return a.length === b.length && a.every((row, index) => INSTALLMENT_KEYS.every(key => row[key] === b[index][key]));
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

// ---- state, derived from the ledger (never stored twice) ----------------------------------------------------------

/** What the ledger holds for a movement id: the minimal view of an `EntryRecord` this module needs (no import of the
 * archive module, which imports this one). */
export interface RecordedEntry { entry: Entry; voided: boolean }
export type InstallmentState = 'scheduled' | 'recognised' | 'undone';

/** The state of one component of one instalment, read from the ledger and never stored beside the schedule, so the plan
 * can never claim a movement the ledger lacks: **scheduled** (no movement yet: the statement has not closed, the
 * catch-up has not run, or the plan was cancelled before it), **recognised** (its movement is in the ledger and counts),
 * **undone** (the person voided that movement: it counts nowhere, the obligation is still open, and the catch-up never
 * recreates it; restoring the movement brings it back). Each component has its own movement and its own state: undoing
 * the principal leaves the interest as it is, and the other way round. */
export function installmentState(plan: Pick<InstallmentPlan, 'id'>, installment: Pick<Installment, 'number'>, records: readonly RecordedEntry[],
  component: InstallmentComponent = 'principal'): InstallmentState {
  const record = records.find(item => item.entry.id === installmentEntryId(plan.id, installment.number, component));
  if (!record) return 'scheduled';
  return record.voided ? 'undone' : 'recognised';
}

/** Every (instalment, component) pair of a plan that carries money: the units that are recognised, undone or scheduled. */
function shares(plan: InstallmentPlan): { row: Installment; component: InstallmentComponent; amountMinor: number }[] {
  return plan.schedule.flatMap(row => INSTALLMENT_COMPONENTS.filter(component => row[amountKey(component)] > 0)
    .map(component => ({ row, component, amountMinor: row[amountKey(component)] })));
}

export type InstallmentPlanStatus = 'active' | 'completed' | 'cancelled' | 'deleted';
/** Completed once every share of every component is recognised. */
export function installmentPlanStatus(plan: InstallmentPlan, records: readonly RecordedEntry[]): InstallmentPlanStatus {
  if (plan.deleted) return 'deleted';
  if (plan.cancelledAt !== null) return 'cancelled';
  return shares(plan).every(share => installmentState(plan, share.row, records, share.component) === 'recognised') ? 'completed' : 'active';
}

/** One component's figures: its total, what the ledger recognised, what the person undid, what is still to come (zero once
 * the plan is cancelled or deleted, when it moves to `cancelledMinor`) and what is not recognised (`remainingMinor`). */
export interface ComponentFigures { totalMinor: number; recognisedMinor: number; undoneMinor: number; scheduledMinor: number; cancelledMinor: number; remainingMinor: number }

/** The distinct figures of one plan (decision 003, rule 7), never merged. For the principal, at the top level: the
 * purchase price (`principalMinor`), the principal already recognised/billed (`recognisedMinor`), undone
 * (`undoneMinor`), the future committed principal (`scheduledMinor`), cancelled, and the principal still to recognise
 * (`remainingMinor`). Every component on its own in `components`, each derived from its own movements (a financing
 * share counts when its movement counts, whatever the principal's state). `financingRecognisedMinor` is interest + fee
 * + tax recognised. There is no «paid» figure: a general card payment is never assigned to a plan. */
export interface InstallmentPlanFigures {
  principalMinor: number; recognisedMinor: number; undoneMinor: number; scheduledMinor: number; cancelledMinor: number; remainingMinor: number;
  components: Record<InstallmentComponent, ComponentFigures>;
  financingRecognisedMinor: number; recognisedCount: number; count: number; status: InstallmentPlanStatus;
}
export function installmentPlanFigures(plan: InstallmentPlan, records: readonly RecordedEntry[]): InstallmentPlanFigures {
  const status = installmentPlanStatus(plan, records);
  const stopped = plan.cancelledAt !== null || plan.deleted;
  const sums = Object.fromEntries(INSTALLMENT_COMPONENTS.map(component => [component, { recognised: 0n, undone: 0n, scheduled: 0n, cancelled: 0n }])) as
    Record<InstallmentComponent, { recognised: bigint; undone: bigint; scheduled: bigint; cancelled: bigint }>;
  let recognisedCount = 0;
  for (const share of shares(plan)) {
    const state = installmentState(plan, share.row, records, share.component);
    const sum = sums[share.component], amount = BigInt(share.amountMinor);
    if (state === 'recognised') { sum.recognised += amount; if (share.component === 'principal') recognisedCount++; }
    else if (state === 'undone') sum.undone += amount;
    else if (stopped) sum.cancelled += amount;
    else sum.scheduled += amount;
  }
  const components = Object.fromEntries(INSTALLMENT_COMPONENTS.map(component => {
    const sum = sums[component], total = plan[amountKey(component)];
    return [component, { totalMinor: total, recognisedMinor: Number(sum.recognised), undoneMinor: Number(sum.undone), scheduledMinor: Number(sum.scheduled),
      cancelledMinor: Number(sum.cancelled), remainingMinor: total - Number(sum.recognised) }];
  })) as Record<InstallmentComponent, ComponentFigures>;
  const principal = components.principal;
  return { principalMinor: plan.principalMinor, recognisedMinor: principal.recognisedMinor, undoneMinor: principal.undoneMinor, scheduledMinor: principal.scheduledMinor,
    cancelledMinor: principal.cancelledMinor, remainingMinor: principal.remainingMinor, components,
    financingRecognisedMinor: FINANCING_COMPONENTS.reduce((total, component) => total + components[component].recognisedMinor, 0),
    recognisedCount, count: plan.count, status };
}

/** The plans of a card that still carry an obligation: live (not cancelled, not deleted) with a share of any component not
 * recognised (future, not yet recorded, or undone). Archiving keeps them; deleting the card is refused while one exists. */
export function pendingInstallmentPlans(card: Pick<CreditCardProfile, 'id'>, plans: readonly InstallmentPlan[], records: readonly RecordedEntry[]): InstallmentPlan[] {
  return plans.filter(plan => plan.cardId === card.id && !plan.deleted && plan.cancelledAt === null
    && shares(plan).some(share => installmentState(plan, share.row, records, share.component) !== 'recognised'));
}
export function cardHasPendingInstallments(card: Pick<CreditCardProfile, 'id'>, plans: readonly InstallmentPlan[] = [], records: readonly RecordedEntry[] = []): boolean {
  return pendingInstallmentPlans(card, plans, records).length > 0;
}
/** The future committed principal of a card (live plans): a commitment figure beside the balance due, never added into
 * it. The future financing of each plan is in its `components`. Exact; refuses the unsafe range. */
export function cardCommittedMinor(card: Pick<CreditCardProfile, 'id'>, plans: readonly InstallmentPlan[] = [], records: readonly RecordedEntry[] = []): number {
  let total = 0n;
  for (const plan of plans) {
    if (plan.cardId !== card.id || plan.deleted || plan.cancelledAt !== null) continue;
    total += BigInt(installmentPlanFigures(plan, records).scheduledMinor);
  }
  if (total > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('El total supera el rango seguro.');
  return Number(total);
}

// ---- materialization: deterministic and idempotent ----------------------------------------------------------------

/** The movements a plan should have in the ledger through `throughDateISO` and does not yet: every non-zero share of every
 * instalment whose statement has closed by then, in order. Idempotent by construction: an id already known (recorded,
 * edited, or undone by the person) is never produced again, so a catch-up run twice, after a crash, a retry or a restore
 * adds nothing; a cancelled or deleted plan produces nothing; a deleted card takes nothing (an archived card keeps its
 * existing plans running). Nothing here touches a `RecurringRule` and the recurring catch-up never calls this. */
export function materializeInstallmentPlan(plan: InstallmentPlan, card: CreditCardProfile, throughDateISO: string, known: ReadonlySet<string>): Entry[] {
  if (!validDateISO(throughDateISO)) throw new Error('Fecha de procesamiento inválida.');
  if (plan.deleted || plan.cancelledAt !== null || card.deleted || card.id !== plan.cardId) return [];
  const entries: Entry[] = [];
  for (const row of plan.schedule) {
    if (row.billingDateISO > throughDateISO) break;
    for (const entry of installmentEntries(plan, card.accountId, row)) if (!known.has(entry.id)) entries.push(entry);
  }
  return entries;
}

// ---- lifecycle -----------------------------------------------------------------------------------------------------

/** Cancelling stops every future share; the ones recognised stay in the ledger exactly as recorded (they were real
 * statements). Never twice; never on a deleted plan. */
export function cancelInstallmentPlan(plan: InstallmentPlan, nowISO: string): InstallmentPlan {
  if (plan.deleted) throw new Error(PLAN_DELETED_MESSAGE);
  if (plan.cancelledAt !== null) throw new Error(PLAN_CANCELLED_MESSAGE);
  if (!validTimestamp(nowISO)) throw new Error('Fecha de actualización inválida.');
  return { ...plan, cancelledAt: nowISO, revision: plan.revision + 1, updatedAt: nowISO };
}
/** A plan is deleted only while no component of it recorded anything (created by mistake); with history it is cancelled. */
export function assertInstallmentPlanDeletable(plan: InstallmentPlan, records: readonly RecordedEntry[]): void {
  if (plan.deleted) throw new Error(PLAN_DELETED_MESSAGE);
  if (shares(plan).some(share => installmentState(plan, share.row, records, share.component) !== 'scheduled')) throw new Error(PLAN_HISTORY_MESSAGE);
}
export function deleteInstallmentPlan(plan: InstallmentPlan, nowISO: string): InstallmentPlan {
  if (plan.deleted) throw new Error(PLAN_DELETED_MESSAGE);
  if (!validTimestamp(nowISO)) throw new Error('Fecha de actualización inválida.');
  return { ...plan, cancelledAt: null, deleted: true, revision: plan.revision + 1, updatedAt: nowISO };
}

// ---- guards between the schedule and the ledger --------------------------------------------------------------------

/** A movement a plan recorded keeps its amount, its date, its account and its kind: those are the plan's, and a change
 * to them is an operation of the plan (24T3). Its merchant and category may be corrected, and it may be undone and
 * restored (see `installmentState`). */
export function assertInstallmentEntryChange(before: Entry, after: Entry): void {
  if (!installmentOccurrenceOf(before.id)) return;
  if (after.id !== before.id || after.amountMinor !== before.amountMinor || after.dateISO !== before.dateISO || after.accountId !== before.accountId || after.kind !== before.kind) {
    throw new Error(INSTALLMENT_ENTRY_MESSAGE);
  }
}

/** The whole collection, and its agreement with the ledger: unique ids, each plan valid; every movement with an
 * instalment id belongs to an existing plan, instalment and component with a share above zero, and matches it (account,
 * amount, date, kind). Read on every archive validation, so a drift between the schedule and the ledger refuses the write
 * that would create it instead of being shown. */
export function validateInstallmentPlans(plans: readonly InstallmentPlan[], cards: readonly CreditCardProfile[], accounts: readonly Account[], records: readonly RecordedEntry[]): void {
  const byId = new Map<string, InstallmentPlan>();
  for (const plan of plans) {
    if (byId.has(plan.id)) throw new Error('La copia repite un plan de cuotas.');
    validateInstallmentPlan(plan, cards, accounts);
    byId.set(plan.id, plan);
  }
  for (const record of records) {
    const occurrence = installmentOccurrenceOf(record.entry.id);
    if (!occurrence) continue;
    const plan = byId.get(occurrence.planId);
    const row = plan?.schedule[occurrence.number - 1];
    const card = plan && cards.find(item => item.id === plan.cardId);
    if (!plan || !row || !card) throw new Error(INSTALLMENT_DRIFT_MESSAGE);
    const expected = row[amountKey(occurrence.component)];
    if (expected <= 0 || record.entry.accountId !== card.accountId || record.entry.kind !== 'expense' || record.entry.amountMinor !== expected || record.entry.dateISO !== row.billingDateISO) {
      throw new Error(INSTALLMENT_DRIFT_MESSAGE);
    }
  }
}
