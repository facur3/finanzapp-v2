import { validDateISO, type Account, type Currency, type Entry } from './ledger.ts';
import { assertStorableCurrency } from './currency.ts';
import { MAX_ENTRY_MINOR } from './money.ts';
import type { CreditCardProfile } from './liabilities.ts';

/** Producto 24T1: a purchase in instalments is **one purchase and one finite plan** (decision 003, rule 7). The plan
 * belongs to a credit card and is never a `RecurringRule`: nothing here runs through the recurring catch-up, and a rule
 * with the same merchant, amount and date is a different fact. Buying moves no cash account and records no expense; the
 * principal is recognised instalment by instalment, each one as a normal expense on the card's hidden account, dated on
 * the statement closing it belongs to, with a deterministic id (`inst_<plan>_<nnn>`) so a catch-up run twice, a crash, a
 * retry or a restore can never record an instalment twice. Financing charges (interest, fees, taxes) are explicit
 * components of the plan, recognised beside each instalment as their own expense (`instc_<plan>_<nnn>`) in their own
 * category, never disguised as principal. Everything is integer minor units of the card's currency; the instalment
 * principals sum exactly to the plan's principal.
 *
 * Vocabulary (used by 24T2's design and the docs): **compra** (the purchase: merchant, price, date), **plan** (this
 * row), **cuota futura** (an instalment whose statement has not closed, or whose movement is not in the ledger yet: a
 * commitment, never an expense), **cuota reconocida / facturada** (an instalment whose movement is in the ledger, not
 * undone: it counts once, in its statement's month, in the original category, and raises the card's balance due),
 * **saldo pendiente actual** (the card account's negative balance: recognised purchases and instalments minus payments),
 * **pago** (a transfer into the card, never assigned to a plan: a payment says nothing about which instalment it covers),
 * **principal restante** (the principal not yet recognised). «Pagada» is never derived: a card mixes purchases, plans,
 * fees and refunds, so no instalment is ever marked paid from a general payment.
 *
 * What stays a gate for later deliveries: how pending instalments consume the issuer's available credit (24T2, decided
 * in decision 003 first; until then `cardAvailableLimitMinor` answers null for a card with a pending plan), refunds and
 * early payoff (24T3: the plan never changes its price, its instalments or its dates through a save, so a refund or a
 * payoff will be an operation of its own with its own audit), and a purchase whose currency differs from the card's
 * billing currency (24C2: a plan is same-currency here; the original-currency record, the rate, the fees and their
 * provenance will sit beside it, never replace it). */
export type StatementPlacement = 'current' | 'next';

export interface Installment {
  /** 1-based position in the plan. */
  number: number;
  /** The statement closing the instalment belongs to: its recognition date (the expense counts in this month). Contractual and
   * date-only: computed once from the card's closing day at purchase time; a later change of the card's days rewrites nothing. */
  billingDateISO: string;
  /** The payment due date of that statement, from the card's due day. Informative: paying stays a transfer the person records. */
  dueDateISO: string;
  /** Principal recognised by this instalment, > 0. The instalment principals sum exactly to the plan's principal. */
  principalMinor: number;
  /** This instalment's share of the plan's financing charges (interest + fees + taxes), >= 0. */
  financingMinor: number;
}

export interface InstallmentPlan {
  id: string;
  /** The credit card the plan belongs to; its hidden account takes every instalment. A plan never moves to another card. */
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
  /** Financing components, explicit and >= 0; never part of the principal. */
  interestMinor: number;
  feeMinor: number;
  taxMinor: number;
  /** The category the financing charges are recognised under; '' when the plan has none. */
  financingCategory: string;
  /** The exact calendar, one row per instalment, written once at creation. */
  schedule: Installment[];
  /** A cancelled plan records no further instalment; the ones already recognised stay in the ledger (24T3 fills the UX). */
  cancelledAt: string | null;
  /** A deletion record (only a plan that never recorded an instalment: created by mistake). The row stays. */
  deleted: boolean;
  createdAt: string;
  revision: number;
  updatedAt: string;
}

export const MAX_INSTALLMENTS = 120;

export const PLAN_PRINCIPAL_MESSAGE = 'El precio de la compra en cuotas debe ser mayor que cero.';
export const PLAN_COUNT_MESSAGE = 'Elegí entre 1 y 120 cuotas.';
export const PLAN_TOO_SMALL_MESSAGE = 'Cada cuota debe ser de al menos una unidad menor de la moneda.';
export const PLAN_FINANCING_MESSAGE = 'Los intereses, cargos e impuestos de financiación deben ser cero o positivos, con su propia categoría.';
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

const PLAN_KEYS = ['id', 'cardId', 'merchant', 'category', 'currency', 'purchaseDateISO', 'principalMinor', 'count', 'interestMinor', 'feeMinor', 'taxMinor',
  'financingCategory', 'cancelledAt', 'deleted', 'createdAt', 'revision', 'updatedAt'] as const;
export const INSTALLMENT_KEYS = ['number', 'billingDateISO', 'dueDateISO', 'principalMinor', 'financingMinor'] as const;
export const INSTALLMENT_PLAN_KEYS = [...PLAN_KEYS.slice(0, 12), 'schedule', ...PLAN_KEYS.slice(12)] as const;

function validId(value: string): boolean {
  return typeof value === 'string' && /^[a-zA-Z0-9_-]{1,70}$/.test(value);
}
function validTimestamp(value: string): boolean {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

// ---- money: exact distribution -------------------------------------------------------------------------------------

/** Splits `totalMinor` into `count` integer parts that sum exactly to it: `floor(total / count)` each, and the remainder
 * (always fewer units than instalments) goes one unit at a time to the **first** instalments, so the first instalment is
 * the largest by at most one minor unit and the rule is the same for any exponent (0, 2 or 3). Deterministic; never loses
 * or creates a unit. A principal is refused when it is not a positive safe integer within the ledger's bound or when
 * some instalment would be empty; a financing total may be zero. */
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

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0, 12).getDate();
}
function iso(year: number, monthIndex: number, day: number): string {
  return [year, String(monthIndex + 1).padStart(2, '0'), String(day).padStart(2, '0')].join('-');
}
function clampedDay(year: number, monthIndex: number, requestedDay: number): string {
  return iso(year, monthIndex, Math.min(requestedDay, daysInMonth(year, monthIndex)));
}
function parts(dateISO: string): [number, number] {
  const [year, month] = dateISO.split('-').map(Number);
  return [year, month - 1];
}
function addDays(dateISO: string, days: number): string {
  const [year, month, day] = dateISO.split('-').map(Number);
  const date = new Date(year, month - 1, day + days, 12);
  return iso(date.getFullYear(), date.getMonth(), date.getDate());
}
function validDay(day: number): boolean {
  return Number.isInteger(day) && day >= 1 && day <= 31;
}

/** The first statement closing on or after `dateISO` for a card closing on `closingDay` (a purchase on the closing day
 * itself belongs to that statement). Day 31 lands on the month's last day; the requested day is kept for the next months. */
export function statementClosingOnOrAfter(dateISO: string, closingDay: number): string {
  if (!validDateISO(dateISO) || !validDay(closingDay)) throw new Error('Fecha de cierre inválida.');
  const [year, monthIndex] = parts(dateISO);
  const candidate = clampedDay(year, monthIndex, closingDay);
  if (candidate >= dateISO) return candidate;
  return clampedDay(year + Math.floor((monthIndex + 1) / 12), (monthIndex + 1) % 12, closingDay);
}

/** The closing `months` statements after `closingISO`, on the card's closing day: the anchor is the configured day, so
 * a January 31 closing gives February 28 (29 in a leap year) and March 31, never a drift to the 28th for good. */
export function statementClosingAfter(closingISO: string, closingDay: number, months: number): string {
  if (!validDateISO(closingISO) || !validDay(closingDay) || !Number.isInteger(months) || months < 0) throw new Error('Fecha de cierre inválida.');
  const [year, monthIndex] = parts(closingISO);
  const total = monthIndex + months;
  return clampedDay(year + Math.floor(total / 12), total % 12, closingDay);
}

/** The due date of a statement: the card's due day after the closing (the day after the closing at the earliest, so a
 * due day before the closing day falls in the following month). Contractual; weekend or holiday shifts the issuer may
 * apply are not known here and are never simulated. */
export function statementDueDate(closingISO: string, dueDay: number): string {
  if (!validDateISO(closingISO) || !validDay(dueDay)) throw new Error('Fecha de vencimiento inválida.');
  return statementClosingOnOrAfter(addDays(closingISO, 1), dueDay);
}

/** The exact calendar of a plan: instalment 1 on the purchase's current statement (the first closing on or after the
 * purchase date) or on the next one, then one statement per instalment on the card's closing day, each with its due
 * date. Dates only; no time zone. Fixed at purchase time: the card's days may change later without rewriting it. */
export function installmentSchedule(card: Pick<CreditCardProfile, 'closingDay' | 'dueDay'>, purchaseDateISO: string, placement: StatementPlacement,
  principalMinor: number, count: number, financingMinor = 0): Installment[] {
  if (placement !== 'current' && placement !== 'next') throw new Error(PLAN_SCHEDULE_MESSAGE);
  if (!validDateISO(purchaseDateISO)) throw new Error('Elegí una fecha válida.');
  const principals = distributeMinor(principalMinor, count);
  const financing = distributeMinor(financingMinor, count, { allowZero: true });
  const first = statementClosingAfter(statementClosingOnOrAfter(purchaseDateISO, card.closingDay), card.closingDay, placement === 'next' ? 1 : 0);
  return principals.map((principal, index) => {
    const billingDateISO = statementClosingAfter(first, card.closingDay, index);
    return { number: index + 1, billingDateISO, dueDateISO: statementDueDate(billingDateISO, card.dueDay), principalMinor: principal, financingMinor: financing[index] };
  });
}

// ---- identity of the movements a plan records ---------------------------------------------------------------------

/** The deterministic id of the movement that recognises instalment `number` of a plan (its principal), and of the
 * financing movement beside it. Never generated by a form: `createEntry` refuses these prefixes. */
export function installmentEntryId(planId: string, number: number): string {
  return `inst_${planId}_${String(number).padStart(3, '0')}`;
}
export function installmentChargeEntryId(planId: string, number: number): string {
  return `instc_${planId}_${String(number).padStart(3, '0')}`;
}
/** The plan, the instalment and the part (principal or financing) behind a movement's id, or null for any other movement. */
export function installmentOccurrenceOf(entryId: string): { planId: string; number: number; part: 'principal' | 'financing' } | null {
  const match = /^inst(c?)_([a-zA-Z0-9_-]{1,70})_(\d{3})$/.exec(entryId);
  if (!match) return null;
  const number = Number(match[3]);
  if (number < 1 || number > MAX_INSTALLMENTS) return null;
  return { planId: match[2], number, part: match[1] ? 'financing' : 'principal' };
}
/** A new movement typed by a person never takes an instalment's id. */
export function assertNewEntryId(entryId: string): void {
  if (installmentOccurrenceOf(entryId)) throw new Error(INSTALLMENT_ID_MESSAGE);
}

/** The movements one instalment records: its principal on the card's hidden account, in the purchase's category, dated
 * on its statement closing; and, when the plan carries financing, that share in the financing category. */
export function installmentEntries(plan: Pick<InstallmentPlan, 'id' | 'merchant' | 'category' | 'financingCategory'>, cardAccountId: string, installment: Installment): Entry[] {
  const createdAt = installment.billingDateISO + 'T12:00:00.000Z';
  const principal: Entry = { id: installmentEntryId(plan.id, installment.number), accountId: cardAccountId, kind: 'expense', amountMinor: installment.principalMinor,
    merchant: plan.merchant, category: plan.category, dateISO: installment.billingDateISO, createdAt };
  if (installment.financingMinor <= 0) return [principal];
  return [principal, { id: installmentChargeEntryId(plan.id, installment.number), accountId: cardAccountId, kind: 'expense', amountMinor: installment.financingMinor,
    merchant: plan.merchant, category: plan.financingCategory, dateISO: installment.billingDateISO, createdAt }];
}

// ---- validation -----------------------------------------------------------------------------------------------------

function validateInstallment(row: Installment, previous: Installment | null, number: number): void {
  if (!row || typeof row !== 'object' || Object.keys(row).length !== INSTALLMENT_KEYS.length || INSTALLMENT_KEYS.some(key => !Object.hasOwn(row, key))) throw new Error(PLAN_SCHEDULE_MESSAGE);
  if (row.number !== number || !validDateISO(row.billingDateISO) || !validDateISO(row.dueDateISO) || row.dueDateISO <= row.billingDateISO) throw new Error(PLAN_SCHEDULE_MESSAGE);
  if (!Number.isSafeInteger(row.principalMinor) || row.principalMinor <= 0 || !Number.isSafeInteger(row.financingMinor) || row.financingMinor < 0) throw new Error(PLAN_SCHEDULE_MESSAGE);
  if (previous && row.billingDateISO <= previous.billingDateISO) throw new Error(PLAN_SCHEDULE_MESSAGE);
}

/** Read acceptance of one plan: its shape, its card (an existing profile whose account holds the plan's currency), its
 * money (a positive principal, zero-or-positive financing components with a category when any is positive) and its
 * schedule (one row per instalment, strictly increasing closings, principals summing exactly to the principal and
 * financing shares summing exactly to the financing total). */
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
  for (const component of [plan.interestMinor, plan.feeMinor, plan.taxMinor]) {
    if (!Number.isSafeInteger(component) || component < 0 || component > MAX_ENTRY_MINOR) throw new Error(PLAN_FINANCING_MESSAGE);
  }
  const financingMinor = plan.interestMinor + plan.feeMinor + plan.taxMinor;
  if (!Number.isSafeInteger(financingMinor) || financingMinor > MAX_ENTRY_MINOR) throw new Error(PLAN_FINANCING_MESSAGE);
  if (typeof plan.financingCategory !== 'string' || plan.financingCategory.length > 60 || (financingMinor > 0) !== (plan.financingCategory.trim().length > 0)) throw new Error(PLAN_FINANCING_MESSAGE);
  if (!Array.isArray(plan.schedule) || plan.schedule.length !== plan.count) throw new Error(PLAN_SCHEDULE_MESSAGE);
  let principal = 0n, financing = 0n;
  plan.schedule.forEach((row, index) => {
    validateInstallment(row, index ? plan.schedule[index - 1] : null, index + 1);
    principal += BigInt(row.principalMinor); financing += BigInt(row.financingMinor);
  });
  if (principal !== BigInt(plan.principalMinor) || financing !== BigInt(financingMinor)) throw new Error(PLAN_SCHEDULE_MESSAGE);
  if (plan.schedule[0].billingDateISO < plan.purchaseDateISO) throw new Error(PLAN_SCHEDULE_MESSAGE);
  if ((plan.cancelledAt !== null && !validTimestamp(plan.cancelledAt)) || typeof plan.deleted !== 'boolean' || (plan.deleted && plan.cancelledAt !== null)) throw new Error(PLAN_STATE_MESSAGE);
  if (!validTimestamp(plan.createdAt) || !validTimestamp(plan.updatedAt) || !Number.isSafeInteger(plan.revision) || plan.revision < 0) throw new Error(PLAN_STATE_MESSAGE);
  if (plan.revision === 0 && (plan.updatedAt !== plan.createdAt || plan.cancelledAt !== null || plan.deleted)) throw new Error(PLAN_STATE_MESSAGE);
}

/** A saved plan keeps its identity, its card, its money and its calendar: only its lifecycle (cancelled, deleted) and its
 * version move. A refund, an early payoff or an adjustment (24T3) is an operation of the plan with its own record, never a
 * rewrite of these fields. */
export function validateInstallmentPlanChange(before: InstallmentPlan, after: InstallmentPlan): void {
  if (before.deleted) throw new Error(PLAN_DELETED_MESSAGE);
  if (after.createdAt !== before.createdAt || after.revision !== before.revision + 1) throw new Error('El plan de cuotas cambió desde que lo abriste. Volvé a revisarlo.');
  const frozen = PLAN_KEYS.filter(key => !['cancelledAt', 'deleted', 'revision', 'updatedAt'].includes(key));
  if (frozen.some(key => before[key] !== after[key]) || !sameSchedule(before.schedule, after.schedule)) throw new Error(PLAN_CHANGE_MESSAGE);
  if (before.cancelledAt !== null && after.cancelledAt !== before.cancelledAt) throw new Error(PLAN_CANCELLED_MESSAGE);
}

function sameSchedule(a: readonly Installment[], b: readonly Installment[]): boolean {
  return a.length === b.length && a.every((row, index) => INSTALLMENT_KEYS.every(key => row[key] === b[index][key]));
}
export function sameInstallmentPlan(a: InstallmentPlan, b: InstallmentPlan): boolean {
  return PLAN_KEYS.every(key => a[key] === b[key]) && sameSchedule(a.schedule, b.schedule);
}

/** A new plan for a purchase on `card`: the schedule from the card's days, the plan's currency from the card's account,
 * revision 0. Financing components are optional and explicit. */
export function newInstallmentPlan(input: {
  id: string; card: CreditCardProfile; cardAccount: Account; merchant: string; category: string; purchaseDateISO: string; principalMinor: number; count: number;
  placement: StatementPlacement; interestMinor?: number; feeMinor?: number; taxMinor?: number; financingCategory?: string; createdAt: string;
}): InstallmentPlan {
  const interestMinor = input.interestMinor ?? 0, feeMinor = input.feeMinor ?? 0, taxMinor = input.taxMinor ?? 0;
  for (const component of [interestMinor, feeMinor, taxMinor]) if (!Number.isSafeInteger(component) || component < 0) throw new Error(PLAN_FINANCING_MESSAGE);
  const financingMinor = interestMinor + feeMinor + taxMinor;
  if (input.card.accountId !== input.cardAccount.id) throw new Error(PLAN_CARD_MESSAGE);
  const plan: InstallmentPlan = {
    id: input.id, cardId: input.card.id, merchant: input.merchant.trim(), category: input.category.trim(), currency: input.cardAccount.currency,
    purchaseDateISO: input.purchaseDateISO, principalMinor: input.principalMinor, count: input.count, interestMinor, feeMinor, taxMinor,
    financingCategory: (input.financingCategory ?? '').trim(),
    schedule: installmentSchedule(input.card, input.purchaseDateISO, input.placement, input.principalMinor, input.count, financingMinor),
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

/** An instalment's state is read from the ledger, never stored beside the schedule, so the plan can never claim a
 * movement the ledger lacks: **scheduled** (no movement yet: the statement has not closed, the catch-up has not run, or
 * the plan was cancelled before it), **recognised** (its principal movement is in the ledger and counts), **undone** (the
 * person voided that movement: it counts nowhere, the obligation is still open, and the catch-up never recreates it;
 * restoring the movement brings it back). */
export function installmentState(plan: Pick<InstallmentPlan, 'id'>, installment: Pick<Installment, 'number'>, records: readonly RecordedEntry[]): InstallmentState {
  const record = records.find(item => item.entry.id === installmentEntryId(plan.id, installment.number));
  if (!record) return 'scheduled';
  return record.voided ? 'undone' : 'recognised';
}

export type InstallmentPlanStatus = 'active' | 'completed' | 'cancelled' | 'deleted';
export function installmentPlanStatus(plan: InstallmentPlan, records: readonly RecordedEntry[]): InstallmentPlanStatus {
  if (plan.deleted) return 'deleted';
  if (plan.cancelledAt !== null) return 'cancelled';
  return plan.schedule.every(row => installmentState(plan, row, records) === 'recognised') ? 'completed' : 'active';
}

/** The distinct figures of one plan (decision 003, rule 7), never merged: the purchase price (`principalMinor`), what
 * the ledger already recognised (`recognisedMinor`: on statements, counted in reports and in the card's balance due),
 * what the person undid (`undoneMinor`), the future committed instalments (`scheduledMinor`: not yet an expense; zero once
 * the plan is cancelled, when it moves to `cancelledMinor`) and the principal still to recognise (`remainingMinor`).
 * There is no «paid» figure: a general card payment is never assigned to a plan. */
export interface InstallmentPlanFigures {
  principalMinor: number; recognisedMinor: number; undoneMinor: number; scheduledMinor: number; cancelledMinor: number; remainingMinor: number;
  financingRecognisedMinor: number; recognisedCount: number; count: number; status: InstallmentPlanStatus;
}
export function installmentPlanFigures(plan: InstallmentPlan, records: readonly RecordedEntry[]): InstallmentPlanFigures {
  const status = installmentPlanStatus(plan, records);
  let recognised = 0n, undone = 0n, scheduled = 0n, cancelled = 0n, financing = 0n, recognisedCount = 0;
  for (const row of plan.schedule) {
    const state = installmentState(plan, row, records);
    if (state === 'recognised') {
      recognised += BigInt(row.principalMinor); recognisedCount++;
      const charge = records.find(item => item.entry.id === installmentChargeEntryId(plan.id, row.number));
      if (charge && !charge.voided) financing += BigInt(charge.entry.amountMinor);
    } else if (state === 'undone') undone += BigInt(row.principalMinor);
    else if (plan.cancelledAt !== null || plan.deleted) cancelled += BigInt(row.principalMinor);
    else scheduled += BigInt(row.principalMinor);
  }
  return { principalMinor: plan.principalMinor, recognisedMinor: Number(recognised), undoneMinor: Number(undone), scheduledMinor: Number(scheduled),
    cancelledMinor: Number(cancelled), remainingMinor: plan.principalMinor - Number(recognised), financingRecognisedMinor: Number(financing), recognisedCount, count: plan.count, status };
}

/** The plans of a card that still carry an obligation: live (not cancelled, not deleted) with an instalment not recognised
 * (future, not yet recorded, or undone). Archiving keeps them; deleting the card is refused while one exists. */
export function pendingInstallmentPlans(card: Pick<CreditCardProfile, 'id'>, plans: readonly InstallmentPlan[], records: readonly RecordedEntry[]): InstallmentPlan[] {
  return plans.filter(plan => plan.cardId === card.id && !plan.deleted && plan.cancelledAt === null
    && plan.schedule.some(row => installmentState(plan, row, records) !== 'recognised'));
}
export function cardHasPendingInstallments(card: Pick<CreditCardProfile, 'id'>, plans: readonly InstallmentPlan[] = [], records: readonly RecordedEntry[] = []): boolean {
  return pendingInstallmentPlans(card, plans, records).length > 0;
}
/** The future committed instalments of a card (principal only, live plans): a commitment figure beside the balance due,
 * never added into it. Exact; refuses the unsafe range. */
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

/** The movements a plan should have in the ledger through `throughDateISO` and does not yet: every instalment whose
 * statement has closed by then, principal and financing, in order. Idempotent by construction: an id already known
 * (recorded, edited, or undone by the person) is never produced again, so a catch-up run twice, after a crash, a retry or a
 * restore adds nothing; a cancelled or deleted plan produces nothing; a deleted card takes nothing. Nothing here touches a
 * `RecurringRule` and the recurring catch-up never calls this. */
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

/** Cancelling stops every future instalment; the ones recognised stay in the ledger exactly as recorded (they were real
 * statements). Never twice; never on a deleted plan. */
export function cancelInstallmentPlan(plan: InstallmentPlan, nowISO: string): InstallmentPlan {
  if (plan.deleted) throw new Error(PLAN_DELETED_MESSAGE);
  if (plan.cancelledAt !== null) throw new Error(PLAN_CANCELLED_MESSAGE);
  if (!validTimestamp(nowISO)) throw new Error('Fecha de actualización inválida.');
  return { ...plan, cancelledAt: nowISO, revision: plan.revision + 1, updatedAt: nowISO };
}
/** A plan is deleted only while it recorded nothing (created by mistake); with history it is cancelled instead. */
export function assertInstallmentPlanDeletable(plan: InstallmentPlan, records: readonly RecordedEntry[]): void {
  if (plan.deleted) throw new Error(PLAN_DELETED_MESSAGE);
  if (plan.schedule.some(row => installmentState(plan, row, records) !== 'scheduled')) throw new Error(PLAN_HISTORY_MESSAGE);
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
 * instalment id belongs to an existing plan and instalment and matches it (account, amount, date, kind), and no plan
 * claims more than the ledger holds. Read on every archive validation, so a drift between the schedule and the ledger
 * refuses the write that would create it instead of being shown. */
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
    const expected = occurrence.part === 'principal' ? row.principalMinor : row.financingMinor;
    if (record.entry.accountId !== card.accountId || record.entry.kind !== 'expense' || record.entry.amountMinor !== expected || record.entry.dateISO !== row.billingDateISO) {
      throw new Error(INSTALLMENT_DRIFT_MESSAGE);
    }
  }
}
