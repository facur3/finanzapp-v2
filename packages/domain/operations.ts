import { CARD_DELETED_MESSAGE, assertOpenAccount, assertPostingAccount } from './liabilities.ts';
import { validDateISO, type Currency, type Entry } from './ledger.ts';
import { assertStorableCurrency } from './currency.ts';
import { MAX_ENTRY_MINOR } from './money.ts';
import { INSTALLMENT_COMPONENTS, MAX_INSTALLMENTS, PLAN_CARD_MESSAGE, PLAN_DELETED_MESSAGE, PLAN_MISSING_MESSAGE, componentCategory, effectiveShares,
  installmentOccurrenceOf, type InstallmentComponent, type InstallmentPlan, type RecordedEntry } from './installments.ts';
import { OPERATION_ACCOUNT_DELETED_MESSAGE, OPERATION_EXISTS_MESSAGE, OPERATION_HISTORY_DELETED_MESSAGE, OPERATION_ID_MESSAGE, OPERATION_INVALID_MESSAGE,
  OPERATION_PLAN_STOPPED_MESSAGE, OPERATION_STATE_MESSAGE, OPERATION_TARGET_MESSAGE, PAYOFF_DATE_MESSAGE, PAYOFF_FINANCING_MESSAGE, PAYOFF_NOTHING_MESSAGE,
  PAYOFF_PRINCIPAL_MESSAGE, PLAN_OPERATION_DATE_MESSAGE, REFUND_AMOUNT_MESSAGE, REFUND_DATE_MESSAGE, REFUND_OVER_MESSAGE, REFUND_TARGET_MESSAGE,
  OPERATION_CHANGED_MESSAGE, operationGuardMessage, type OperationContext } from './operation-messages.ts';
import type { EntryRecord, LedgerArchive } from './recovery.ts';

export * from './operation-messages.ts';

/** Producto 24T3: **purchase operations**, the devoluciones (refunds) and adelantos de cuotas (early payoffs) of a
 * purchase. They are append-only typed rows of their own collection (`LedgerArchive.purchaseOperations`, SQLite
 * `purchase_operations`, backup v14). Nothing stored before 24T3 is rewritten by one: no plan field, no schedule row, no
 * recorded instalment, no card payment. Their money effect is **projected** by `snapshotFromArchive` into
 * `snapshot.entries` as derived lines (`projectOperationLines`), so balances, Movimientos, reports, budgets and FX read them
 * through the one source they already read. Undo and restore toggle `voided` (revision + 1), like movements.
 *
 * - `EntryRefund`: a devolución of an ordinary expense (cash, a card purchase without instalments, a recurring occurrence).
 *   It credits the purchase's account and nets out of spending in its own month, in the purchase's category (resolved
 *   at read time): a contra-expense (`kind: 'expense'`, negative amount), never an income.
 * - `PlanRefund`: a devolución of an instalment plan's principal, allocated recognised first, then the tail (owner decision
 *   B2): `creditMinor` reverses principal already recognised (one credit line on the card, dated on the devolución), the
 *   rest lowers future principal from the last instalment backwards (`reductions`, frozen; no line: it was never spending).
 *   Financing is untouched.
 * - `PlanPayoff`: an adelanto de cuotas (owner decision B1): every share not yet recorded is recognised once, on the
 *   adelanto's date, in its component's category, on the card; the card payment stays a separate transfer. Future
 *   financing is either recognised now or recorded as not charged (`financing: 'waived'`), never assumed. Never «pagada».
 *
 * Which rules are archive invariants (checked by `validateArchive` on every write, import and read) and which are
 * creation-only (A7: today's date, a deleted account or card, a stopped plan) is said at each function. */
export type PurchaseOperationKind = 'refund' | 'payoff';
export type PayoffFinancing = 'recognised' | 'waived';
export const PAYOFF_FINANCING_CHOICES: readonly PayoffFinancing[] = ['recognised', 'waived'];
/** Future principal no longer to be recognised on instalment `number`. */
export interface PlanReduction { number: number; minor: number }
/** One share an adelanto brought forward, at its amount after live reductions when it was created (frozen). */
export interface PayoffShare { number: number; component: InstallmentComponent; minor: number }

interface OperationBase {
  /** A form UUID frozen in the draft (retries reuse it): letters, digits and '-', at most 97 characters, never '_' (A11). */
  id: string;
  kind: PurchaseOperationKind;
  /** The account the operation moves: the purchase's account (a devolución of an ordinary expense) or the card's hidden account. */
  accountId: string;
  /** The target's currency; never converted. */
  currency: Currency;
  /** > 0. A devolución: the amount returned. An adelanto: Σ covered principal (for display; validated equal). */
  amountMinor: number;
  /** The effective date: the month it counts in. */
  dateISO: string;
  /** Undone by the person; restorable. */
  voided: boolean;
  createdAt: string;
  revision: number;
  updatedAt: string;
}
export interface EntryRefund extends OperationBase { kind: 'refund'; target: { entryId: string } }
export interface PlanRefund extends OperationBase {
  kind: 'refund';
  target: { planId: string };
  /** >= 0: recognised principal reversed now (the projected credit line). */
  creditMinor: number;
  /** >= 0 rows, by instalment number: future principal no longer to be recognised. amountMinor = credit + Σ reductions. */
  reductions: PlanReduction[];
}
export interface PlanPayoff extends OperationBase {
  kind: 'payoff';
  target: { planId: string };
  /** Future interest, fee and tax: recognised now with the principal, or recorded as not charged by the issuer. */
  financing: PayoffFinancing;
  /** Every share not recorded when the adelanto was created (financing kept even when waived, so the waiver is auditable). */
  covered: PayoffShare[];
}
export type PurchaseOperation = EntryRefund | PlanRefund | PlanPayoff;

/** The archive parts the operations read. */
export type OperationArchive = Pick<LedgerArchive, 'accounts' | 'records'>
  & Partial<Pick<LedgerArchive, 'transfers' | 'cards' | 'debts' | 'installmentPlans' | 'purchaseOperations'>>;

const BASE_KEYS = ['id', 'kind', 'target', 'accountId', 'currency', 'amountMinor', 'dateISO', 'voided', 'createdAt', 'revision', 'updatedAt'] as const;
export const ENTRY_REFUND_KEYS = BASE_KEYS;
export const PLAN_REFUND_KEYS = [...BASE_KEYS, 'creditMinor', 'reductions'] as const;
export const PLAN_PAYOFF_KEYS = [...BASE_KEYS, 'financing', 'covered'] as const;
const REDUCTION_KEYS = ['number', 'minor'] as const;
const COVERED_KEYS = ['number', 'component', 'minor'] as const;
/** The suffix of each projected adelanto line (A11): ':' would fail every id rule. */
export const PAYOFF_LINE_SUFFIX: Record<InstallmentComponent, string> = { principal: '_p', interest: '_i', fee: '_f', tax: '_t' };
const COMPONENT_ORDER = new Map(INSTALLMENT_COMPONENTS.map((component, index) => [component, index]));
const SAFE = BigInt(Number.MAX_SAFE_INTEGER);

export function isEntryRefund(operation: PurchaseOperation): operation is EntryRefund {
  return operation.kind === 'refund' && 'entryId' in operation.target;
}
export function isPlanRefund(operation: PurchaseOperation): operation is PlanRefund {
  return operation.kind === 'refund' && 'planId' in operation.target;
}
export function isPlanPayoff(operation: PurchaseOperation): operation is PlanPayoff {
  return operation.kind === 'payoff';
}
/** The plan an operation belongs to, or null for a devolución of an ordinary purchase. */
export function operationPlanId(operation: PurchaseOperation): string | null {
  return 'planId' in operation.target ? operation.target.planId : null;
}
/** The ids of the lines an operation projects while live (a devolución: its own id; an adelanto: one per component). */
export function operationLineIds(operation: PurchaseOperation): string[] {
  return isPlanPayoff(operation) ? INSTALLMENT_COMPONENTS.map(component => operation.id + PAYOFF_LINE_SUFFIX[component]) : [operation.id];
}
/** A23: whether a ledger line is a purchase for every count (a movement, a report, a trend, the Assistant's evidence). A
 * devolución line is not a purchase; an adelanto counts once per operation, through its principal line. */
export function isPurchaseLine(entry: Entry): boolean {
  return entry.kind === 'expense' && entry.refund === undefined && (entry.payoff === undefined || entry.payoff.component === 'principal');
}

// ---- shape -----------------------------------------------------------------------------------------------------------

const validOperationId = (value: unknown): value is string => typeof value === 'string' && /^[a-zA-Z0-9-]{1,97}$/.test(value);
const validId = (value: unknown, max = 100): value is string => typeof value === 'string' && value.length <= max && /^[a-zA-Z0-9_-]+$/.test(value) && value.length > 0;
const validTimestamp = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value));
const positiveMinor = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) > 0 && (value as number) <= MAX_ENTRY_MINOR;
function exactKeys(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
}
/** The same check without narrowing (a target that is neither shape is not `never`). */
const hasExactKeys = (value: unknown, keys: readonly string[]): boolean => exactKeys(value, keys);
function invalid(): never { throw new Error(OPERATION_INVALID_MESSAGE); }

/** Read acceptance of one operation (A20): its exact keys for its kind, its ids (an operation id is a form UUID, A11), its
 * money (integer minor units, every amount > 0, `amountMinor` = credit + Σ reductions for a plan devolución and = Σ
 * covered principal > 0 for an adelanto), its dates, its version, and the canonical order of its detail rows (reductions by
 * instalment number, covered shares by number then component order; no zero, no duplicate). Links to the ledger are
 * archive invariants (`validatePurchaseOperationLinks`). */
export function validatePurchaseOperation(operation: PurchaseOperation): void {
  if (!operation || typeof operation !== 'object') invalid();
  const keys = operation.kind === 'payoff' ? PLAN_PAYOFF_KEYS : operation.kind === 'refund'
    ? (exactKeys(operation.target, ['planId']) ? PLAN_REFUND_KEYS : ENTRY_REFUND_KEYS) : null;
  if (!keys || !exactKeys(operation, keys)) invalid();
  if (!validOperationId(operation.id) || !validId(operation.accountId)) invalid();
  const target = operation.target as Record<string, unknown>;
  if (hasExactKeys(target, ['entryId'])) { if (operation.kind !== 'refund' || !validId(target.entryId)) invalid(); }
  else if (hasExactKeys(target, ['planId'])) { if (!validId(target.planId, 70)) invalid(); }
  else invalid();
  try { assertStorableCurrency(operation.currency); } catch { invalid(); }
  if (!positiveMinor(operation.amountMinor) || !validDateISO(operation.dateISO)) invalid();
  if (typeof operation.voided !== 'boolean' || !validTimestamp(operation.createdAt) || !validTimestamp(operation.updatedAt)
    || !Number.isSafeInteger(operation.revision) || operation.revision < 0) invalid();
  if (operation.revision === 0 && (operation.voided || operation.updatedAt !== operation.createdAt)) invalid();
  if (isPlanRefund(operation)) {
    if (!Number.isSafeInteger(operation.creditMinor) || operation.creditMinor < 0 || !Array.isArray(operation.reductions) || operation.reductions.length > MAX_INSTALLMENTS) invalid();
    let sum = BigInt(operation.creditMinor), previous = 0;
    for (const row of operation.reductions) {
      if (!exactKeys(row, REDUCTION_KEYS) || !Number.isInteger(row.number) || row.number <= previous || row.number > MAX_INSTALLMENTS || !positiveMinor(row.minor)) invalid();
      previous = row.number;
      sum += BigInt(row.minor);
    }
    if (sum !== BigInt(operation.amountMinor)) invalid();
  } else if (isPlanPayoff(operation)) {
    if (!PAYOFF_FINANCING_CHOICES.includes(operation.financing) || !Array.isArray(operation.covered) || !operation.covered.length
      || operation.covered.length > MAX_INSTALLMENTS * INSTALLMENT_COMPONENTS.length) invalid();
    let principal = 0n, previous = -1;
    for (const row of operation.covered) {
      if (!exactKeys(row, COVERED_KEYS) || !Number.isInteger(row.number) || row.number < 1 || row.number > MAX_INSTALLMENTS
        || !COMPONENT_ORDER.has(row.component) || !positiveMinor(row.minor)) invalid();
      const position = row.number * 4 + COMPONENT_ORDER.get(row.component)!;
      if (position <= previous) invalid();
      previous = position;
      if (row.component === 'principal') principal += BigInt(row.minor);
    }
    if (principal === 0n || principal !== BigInt(operation.amountMinor)) invalid();
  }
}

/** Builds one operation from untrusted data (a backup row, a SQLite detail): exact keys, a fresh object in canonical key
 * order, validated. The one strict parser of `readArchive` and `parsePilotBackup` (A20). */
export function parsePurchaseOperation(value: unknown): PurchaseOperation {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid();
  const row = value as Record<string, unknown>;
  const target = row.target as Record<string, unknown>;
  const plan = hasExactKeys(target, ['planId']);
  const keys = row.kind === 'payoff' ? PLAN_PAYOFF_KEYS : row.kind === 'refund' ? (plan ? PLAN_REFUND_KEYS : ENTRY_REFUND_KEYS) : invalid();
  if (!exactKeys(row, keys)) invalid();
  const base = { id: row.id, kind: row.kind, target: plan ? { planId: target.planId } : hasExactKeys(target, ['entryId']) ? { entryId: target.entryId } : invalid(),
    accountId: row.accountId, currency: row.currency, amountMinor: row.amountMinor, dateISO: row.dateISO, voided: row.voided,
    createdAt: row.createdAt, revision: row.revision, updatedAt: row.updatedAt };
  let operation: PurchaseOperation;
  if (row.kind === 'payoff') {
    if (!Array.isArray(row.covered)) invalid();
    operation = { ...base, financing: row.financing, covered: row.covered.map(item => exactKeys(item, COVERED_KEYS)
      ? { number: item.number, component: item.component, minor: item.minor } : invalid()) } as PlanPayoff;
  } else if (plan) {
    if (!Array.isArray(row.reductions)) invalid();
    operation = { ...base, creditMinor: row.creditMinor, reductions: row.reductions.map(item => exactKeys(item, REDUCTION_KEYS)
      ? { number: item.number, minor: item.minor } : invalid()) } as PlanRefund;
  } else operation = base as EntryRefund;
  validatePurchaseOperation(operation);
  return operation;
}
/** Content equality (every field, the version included): backup import compares with it (same id, other revision or
 * voided state → a conflict). */
export function samePurchaseOperation(a: PurchaseOperation, b: PurchaseOperation): boolean {
  return JSON.stringify(parsePurchaseOperation(a)) === JSON.stringify(parsePurchaseOperation(b));
}

/** The SQLite shape (schema 14): scalar columns plus a strict `detailJSON` (empty for a devolución of an ordinary purchase,
 * `{ reductions }` for a plan devolución, `{ financing, covered }` for an adelanto). `creditMinor` is null except on a plan
 * devolución. */
export interface PurchaseOperationRow {
  id: string; kind: PurchaseOperationKind; targetEntryId: string | null; targetPlanId: string | null; accountId: string; currency: string;
  amountMinor: number; creditMinor: number | null; detailJSON: string; dateISO: string; voided: boolean; createdAt: string; revision: number; updatedAt: string;
}
export function operationToRow(operation: PurchaseOperation): PurchaseOperationRow {
  validatePurchaseOperation(operation);
  const detail = isPlanPayoff(operation) ? { financing: operation.financing, covered: operation.covered.map(row => ({ number: row.number, component: row.component, minor: row.minor })) }
    : isPlanRefund(operation) ? { reductions: operation.reductions.map(row => ({ number: row.number, minor: row.minor })) } : {};
  return { id: operation.id, kind: operation.kind, targetEntryId: isEntryRefund(operation) ? operation.target.entryId : null,
    targetPlanId: operationPlanId(operation), accountId: operation.accountId, currency: operation.currency, amountMinor: operation.amountMinor,
    creditMinor: isPlanRefund(operation) ? operation.creditMinor : null, detailJSON: JSON.stringify(detail), dateISO: operation.dateISO,
    voided: operation.voided, createdAt: operation.createdAt, revision: operation.revision, updatedAt: operation.updatedAt };
}
/** Reads a stored row back; a malformed row or detail throws the recoverable `OPERATION_INVALID_MESSAGE`. */
export function operationFromRow(row: PurchaseOperationRow): PurchaseOperation {
  let detail: unknown;
  try { detail = JSON.parse(row.detailJSON); } catch { invalid(); }
  if ((row.targetEntryId === null) === (row.targetPlanId === null)) invalid();
  const base = { id: row.id, kind: row.kind, target: row.targetPlanId !== null ? { planId: row.targetPlanId } : { entryId: row.targetEntryId },
    accountId: row.accountId, currency: row.currency, amountMinor: row.amountMinor, dateISO: row.dateISO, voided: row.voided,
    createdAt: row.createdAt, revision: row.revision, updatedAt: row.updatedAt };
  if (row.kind === 'payoff') {
    if (row.creditMinor !== null || !exactKeys(detail, ['financing', 'covered'])) invalid();
    return parsePurchaseOperation({ ...base, financing: detail.financing, covered: detail.covered });
  }
  if (row.targetPlanId !== null) {
    if (!exactKeys(detail, ['reductions'])) invalid();
    return parsePurchaseOperation({ ...base, creditMinor: row.creditMinor, reductions: detail.reductions });
  }
  if (row.creditMinor !== null || !exactKeys(detail, [])) invalid();
  return parsePurchaseOperation(base);
}

// ---- reading the ledger ---------------------------------------------------------------------------------------------

function liveOperations(archive: Pick<OperationArchive, 'purchaseOperations'>): PurchaseOperation[] {
  return (archive.purchaseOperations ?? []).filter(operation => !operation.voided);
}
function sumMinor(values: Iterable<number>): bigint {
  let total = 0n;
  for (const value of values) total += BigInt(value);
  return total;
}
function safe(value: bigint): number {
  if (value > SAFE || value < -SAFE) throw new Error('El total supera el rango seguro.');
  return Number(value);
}
function findPlan(archive: OperationArchive, planId: string): InstallmentPlan {
  const plan = (archive.installmentPlans ?? []).find(item => item.id === planId);
  if (!plan) throw new Error(PLAN_MISSING_MESSAGE);
  return plan;
}

/** What a purchase (an ordinary expense) has returned: its live devoluciones, their sum, and what is still returnable. */
export interface EntryRefundSummary { refunds: EntryRefund[]; refundedMinor: number; availableMinor: number }
export function entryRefundSummary(archive: OperationArchive, entryId: string): EntryRefundSummary {
  const record = archive.records.find(item => item.entry.id === entryId);
  const refunds = liveOperations(archive).filter((operation): operation is EntryRefund => isEntryRefund(operation) && operation.target.entryId === entryId);
  const refunded = sumMinor(refunds.map(refund => refund.amountMinor));
  const available = record && !record.voided && record.entry.kind === 'expense' ? BigInt(record.entry.amountMinor) - refunded : 0n;
  return { refunds, refundedMinor: safe(refunded), availableMinor: available > 0n ? safe(available) : 0 };
}

/** A6: the earliest date a new devolución or adelanto of a plan may carry: the purchase date, the latest closing among the
 * plan's recorded shares (any component, undone included) and the date of its latest live adelanto. With today as the upper
 * bound, a backdated credit never reverses recognition that came later and no adelanto lands in a closed statement. */
export function planOperationFloorISO(plan: InstallmentPlan, records: readonly RecordedEntry[], operations: readonly PurchaseOperation[]): string {
  let floor = plan.purchaseDateISO;
  for (const share of effectiveShares(plan, records, operations)) {
    if ((share.state === 'recognised' || share.state === 'undone') && share.billingDateISO > floor) floor = share.billingDateISO;
  }
  for (const operation of operations) {
    if (!operation.voided && isPlanPayoff(operation) && operation.target.planId === plan.id && operation.dateISO > floor) floor = operation.dateISO;
  }
  return floor;
}

/** What a plan can still return, principal only (A17): `creditAvailableMinor` = principal recognised (instalments and
 * adelantos) − the live devoluciones' credit; `futureAvailableMinor` = principal still scheduled after reductions (zero once
 * the plan stops). Undone principal counts in neither (restore it first). */
export interface PlanRefundAvailability { creditAvailableMinor: number; futureAvailableMinor: number; availableMinor: number; floorISO: string }
export function planRefundAvailability(archive: OperationArchive, planId: string): PlanRefundAvailability {
  const plan = findPlan(archive, planId);
  const operations = archive.purchaseOperations ?? [];
  let recognised = 0n, future = 0n;
  for (const share of effectiveShares(plan, archive.records, operations)) {
    if (share.component !== 'principal') continue;
    if (share.state === 'recognised' || share.state === 'settled') recognised += BigInt(share.amountMinor);
    else if (share.state === 'scheduled') future += BigInt(share.amountMinor);
  }
  const credit = sumMinor(liveOperations(archive).filter(isPlanRefund).filter(refund => refund.target.planId === planId).map(refund => refund.creditMinor));
  const creditAvailable = recognised - credit > 0n ? recognised - credit : 0n;
  const futureAvailable = plan.deleted || plan.cancelledAt !== null ? 0n : future;
  return { creditAvailableMinor: safe(creditAvailable), futureAvailableMinor: safe(futureAvailable), availableMinor: safe(creditAvailable + futureAvailable),
    floorISO: planOperationFloorISO(plan, archive.records, operations) };
}

// ---- creation (pure: the caller passes the archive after the plan's catch-up through today) --------------------------

interface CreationInput { id: string; dateISO: string; todayISO: string; createdAt: string }
function assertAmount(amountMinor: number): void {
  if (!positiveMinor(amountMinor)) throw new Error(REFUND_AMOUNT_MESSAGE);
}
function assertNewId(archive: OperationArchive, id: string): void {
  if (!validOperationId(id)) throw new Error(OPERATION_INVALID_MESSAGE);
  if ((archive.purchaseOperations ?? []).some(operation => operation.id === id)) throw new Error(OPERATION_EXISTS_MESSAGE);
}

/** A devolución of an ordinary expense (§2): a live stored expense that is not an instalment, credited to the purchase's
 * account (live; an archived card is accepted, a deleted one refused), capped at the purchase's amount minus its live
 * devoluciones (exact BigInt), dated between the purchase and today. */
export function newEntryRefund(archive: OperationArchive, input: CreationInput & { entryId: string; amountMinor: number }): EntryRefund {
  assertNewId(archive, input.id);
  const record = archive.records.find(item => item.entry.id === input.entryId);
  if (!record || record.voided || record.entry.kind !== 'expense' || installmentOccurrenceOf(record.entry.id)) throw new Error(REFUND_TARGET_MESSAGE);
  const account = archive.accounts.find(item => item.id === record.entry.accountId);
  if (!account) throw new Error(REFUND_TARGET_MESSAGE);
  assertAmount(input.amountMinor);
  if (BigInt(input.amountMinor) > BigInt(entryRefundSummary(archive, input.entryId).availableMinor)) throw new Error(REFUND_OVER_MESSAGE);
  const refund: EntryRefund = { id: input.id, kind: 'refund', target: { entryId: input.entryId }, accountId: record.entry.accountId, currency: account.currency,
    amountMinor: input.amountMinor, dateISO: input.dateISO, voided: false, createdAt: input.createdAt, revision: 0, updatedAt: input.createdAt };
  assertOperationApplicable(archive, refund, 'create', input.todayISO);
  return refund;
}

/** A devolución of a plan's principal (§3, owner decision B2): `creditMinor` = min(R, principal recognised − earlier credit),
 * the rest lowers future principal from the last instalment backwards (each share down to zero before the previous one is
 * touched; so one creation reduces at most one share partially). Capped at what is available
 * (`planRefundAvailability`); a stopped plan only takes credit. Dated between the plan's floor (A6) and today. */
export function newPlanRefund(archive: OperationArchive, input: CreationInput & { planId: string; amountMinor: number }): PlanRefund {
  assertNewId(archive, input.id);
  const plan = findPlan(archive, input.planId);
  if (plan.deleted) throw new Error(PLAN_DELETED_MESSAGE);
  const card = (archive.cards ?? []).find(item => item.id === plan.cardId);
  if (!card) throw new Error(PLAN_CARD_MESSAGE);
  assertAmount(input.amountMinor);
  const availability = planRefundAvailability(archive, plan.id);
  if (input.amountMinor > availability.availableMinor) throw new Error(REFUND_OVER_MESSAGE);
  const creditMinor = Math.min(input.amountMinor, availability.creditAvailableMinor);
  let rest = BigInt(input.amountMinor - creditMinor);
  const reductions: PlanReduction[] = [];
  const scheduled = effectiveShares(plan, archive.records, archive.purchaseOperations ?? [])
    .filter(share => share.component === 'principal' && share.state === 'scheduled');
  for (let index = scheduled.length - 1; index >= 0 && rest > 0n; index--) {
    const take = rest < BigInt(scheduled[index].amountMinor) ? rest : BigInt(scheduled[index].amountMinor);
    reductions.unshift({ number: scheduled[index].number, minor: Number(take) });
    rest -= take;
  }
  if (rest > 0n) throw new Error(REFUND_OVER_MESSAGE);
  const refund: PlanRefund = { id: input.id, kind: 'refund', target: { planId: plan.id }, accountId: card.accountId, currency: plan.currency,
    amountMinor: input.amountMinor, dateISO: input.dateISO, voided: false, createdAt: input.createdAt, revision: 0, updatedAt: input.createdAt,
    creditMinor, reductions };
  assertOperationApplicable(archive, refund, 'create', input.todayISO);
  return refund;
}

/** An adelanto de cuotas (§4, owner decision B1): covers every share still scheduled (after reductions, financing
 * included), recognised once on the adelanto's date; future financing is recognised or recorded as not charged, as the
 * person states. Refused on a stopped or deleted plan, with nothing left, or with no principal left (A4(d)). Undone shares
 * stay undone. Dated between the plan's floor (A6) and today, and before the closing of every share it covers. */
export function newPlanPayoff(archive: OperationArchive, input: CreationInput & { planId: string; financing: PayoffFinancing }): PlanPayoff {
  assertNewId(archive, input.id);
  const plan = findPlan(archive, input.planId);
  if (plan.deleted) throw new Error(PLAN_DELETED_MESSAGE);
  if (plan.cancelledAt !== null) throw new Error(OPERATION_PLAN_STOPPED_MESSAGE);
  const card = (archive.cards ?? []).find(item => item.id === plan.cardId);
  if (!card) throw new Error(PLAN_CARD_MESSAGE);
  if (!PAYOFF_FINANCING_CHOICES.includes(input.financing)) throw new Error(PAYOFF_FINANCING_MESSAGE);
  const covered = effectiveShares(plan, archive.records, archive.purchaseOperations ?? []).filter(share => share.state === 'scheduled')
    .map(share => ({ number: share.number, component: share.component, minor: share.amountMinor }));
  if (!covered.length) throw new Error(PAYOFF_NOTHING_MESSAGE);
  const principal = sumMinor(covered.filter(row => row.component === 'principal').map(row => row.minor));
  if (principal === 0n) throw new Error(PAYOFF_PRINCIPAL_MESSAGE);
  const payoff: PlanPayoff = { id: input.id, kind: 'payoff', target: { planId: plan.id }, accountId: card.accountId, currency: plan.currency,
    amountMinor: safe(principal), dateISO: input.dateISO, voided: false, createdAt: input.createdAt, revision: 0, updatedAt: input.createdAt,
    financing: input.financing, covered };
  assertOperationApplicable(archive, payoff, 'create', input.todayISO);
  return payoff;
}

/** A12: whether a retried creation is the one already stored: the person's inputs (kind, target, amount of a devolución,
 * date, financing choice, createdAt), and the stored row still at revision 0 and live. Derived fields (credit, reductions,
 * covered) are never compared: a retry returns success before any catch-up or allocation. */
export function sameOperationInputs(stored: PurchaseOperation, candidate: PurchaseOperation): boolean {
  if (stored.revision !== 0 || stored.voided || stored.id !== candidate.id || stored.kind !== candidate.kind || stored.dateISO !== candidate.dateISO
    || stored.createdAt !== candidate.createdAt || JSON.stringify(stored.target) !== JSON.stringify(candidate.target)) return false;
  if (stored.kind === 'refund') return stored.amountMinor === candidate.amountMinor;
  return (candidate as PlanPayoff).financing === stored.financing;
}
/** A13: whether two operations allocate the same money (credit and reductions; the covered shares). The form sends the
 * allocation it previewed; storage recomputes after its catch-up and refuses a mismatch (`assertExpectedAllocation`). */
export function sameOperationAllocation(a: PurchaseOperation, b: PurchaseOperation): boolean {
  if (a.kind !== b.kind || a.amountMinor !== b.amountMinor) return false;
  if (isPlanPayoff(a)) return isPlanPayoff(b) && JSON.stringify(a.covered.map(row => [row.number, row.component, row.minor]))
    === JSON.stringify(b.covered.map(row => [row.number, row.component, row.minor]));
  if (isPlanRefund(a)) return isPlanRefund(b) && a.creditMinor === b.creditMinor
    && JSON.stringify(a.reductions.map(row => [row.number, row.minor])) === JSON.stringify(b.reductions.map(row => [row.number, row.minor]));
  return isEntryRefund(b);
}
export function assertExpectedAllocation(computed: PurchaseOperation, expected: PurchaseOperation): void {
  if (!sameOperationAllocation(computed, expected)) throw new Error(OPERATION_CHANGED_MESSAGE);
}

/** A7: the creation preconditions that are not archive invariants (they depend on today or on liveness, so they never go
 * into `validateArchive`, where a clock change or a deleted account would make the file unreadable). One function for
 * `create`, `void` and `restore`, and for the UI's canUndo/canRestore dry runs:
 * - create only: the date is on or before `todayISO`; an ordinary purchase's devolución targets a live expense that is
 *   not an instalment, dated on or after it; a plan operation is on or after the plan's floor (A6) and an adelanto before
 *   every closing it covers; the account or card is not deleted («La cuenta de esta compra fue eliminada»).
 * - void and restore: the account or card is not deleted («su historial no cambia», A9).
 * - every context: the plan exists and is not deleted; on a stopped plan no adelanto and no devolución with reductions is
 *   created, undone or restored («Reactivalo primero», A9). Restore = these preconditions minus the date and the allocation;
 *   the archive invariants then decide (`validateArchive` after the plan's catch-up). */
export function assertOperationApplicable(archive: OperationArchive, operation: PurchaseOperation, context: 'create' | 'void' | 'restore', todayISO?: string): void {
  validatePurchaseOperation(operation);
  const cards = archive.cards ?? [], debts = archive.debts ?? [];
  const open = (accountId: string) => {
    try { assertOpenAccount(accountId, archive.accounts, cards, debts); }
    catch (error) {
      if (context !== 'create') throw new Error(OPERATION_HISTORY_DELETED_MESSAGE);
      throw new Error(error instanceof Error && error.message === CARD_DELETED_MESSAGE && operationPlanId(operation) !== null ? CARD_DELETED_MESSAGE : OPERATION_ACCOUNT_DELETED_MESSAGE);
    }
  };
  if (context === 'create') {
    if (!todayISO || !validDateISO(todayISO)) throw new Error('Fecha de procesamiento inválida.');
    if (operation.dateISO > todayISO) throw new Error(isEntryRefund(operation) ? REFUND_DATE_MESSAGE : PLAN_OPERATION_DATE_MESSAGE);
  }
  if (isEntryRefund(operation)) {
    const record = archive.records.find(item => item.entry.id === operation.target.entryId);
    if (!record) throw new Error(OPERATION_TARGET_MESSAGE);
    if (context === 'create') {
      if (record.voided || record.entry.kind !== 'expense' || installmentOccurrenceOf(record.entry.id) || record.entry.accountId !== operation.accountId) throw new Error(REFUND_TARGET_MESSAGE);
      if (operation.dateISO < record.entry.dateISO) throw new Error(REFUND_DATE_MESSAGE);
      assertPostingAccount(operation.accountId, debts);
    }
    open(operation.accountId);
    return;
  }
  const plan = (archive.installmentPlans ?? []).find(item => item.id === operationPlanId(operation));
  if (!plan) throw new Error(OPERATION_TARGET_MESSAGE);
  if (plan.deleted) throw new Error(PLAN_DELETED_MESSAGE);
  const card = cards.find(item => item.id === plan.cardId);
  if (!card) throw new Error(OPERATION_TARGET_MESSAGE);
  open(card.accountId);
  open(operation.accountId);
  if (plan.cancelledAt !== null && (isPlanPayoff(operation) || (isPlanRefund(operation) && operation.reductions.length > 0))) throw new Error(OPERATION_PLAN_STOPPED_MESSAGE);
  if (context === 'create') {
    const others = (archive.purchaseOperations ?? []).filter(item => item.id !== operation.id);
    if (operation.dateISO < planOperationFloorISO(plan, archive.records, others)) throw new Error(PLAN_OPERATION_DATE_MESSAGE);
    if (isPlanPayoff(operation)) {
      for (const row of operation.covered) {
        if (plan.schedule[row.number - 1] && plan.schedule[row.number - 1].billingDateISO <= operation.dateISO) throw new Error(PAYOFF_DATE_MESSAGE);
      }
    }
  }
}

// ---- undo and restore ----------------------------------------------------------------------------------------------

export interface OperationChange { id: string; action: 'void' | 'restore'; before: PurchaseOperation; after: PurchaseOperation }
/** Undo («Deshacer devolución / adelanto») or restore: the same row one revision on with `voided` toggled, like
 * `makeEntryChange`; the change id is the idempotency key of the receipt. An operation is never edited: it is corrected by
 * an undo and a new one. */
export function makeOperationChange(id: string, before: PurchaseOperation, action: OperationChange['action'], nowISO: string): OperationChange {
  if (before.voided !== (action === 'restore') || !validTimestamp(nowISO)) throw new Error(OPERATION_STATE_MESSAGE);
  return { id, action, before, after: { ...before, voided: action === 'void', revision: before.revision + 1, updatedAt: nowISO } };
}
export function validateOperationChange(change: OperationChange): void {
  const { before, after, action } = change;
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(change.id) || (action !== 'void' && action !== 'restore')) throw new Error(OPERATION_STATE_MESSAGE);
  validatePurchaseOperation(before);
  validatePurchaseOperation(after);
  const strip = (operation: PurchaseOperation) => JSON.stringify({ ...parsePurchaseOperation(operation), voided: null, revision: null, updatedAt: null });
  if (after.revision !== before.revision + 1 || before.voided !== (action === 'restore') || after.voided !== (action === 'void') || strip(before) !== strip(after)) {
    throw new Error(OPERATION_STATE_MESSAGE);
  }
}

/** The archive with `operation` added, or replacing the one with its id. */
export function withOperation<T extends OperationArchive>(archive: T, operation: PurchaseOperation): T {
  const operations = archive.purchaseOperations ?? [];
  const exists = operations.some(item => item.id === operation.id);
  return { ...archive, purchaseOperations: exists ? operations.map(item => item.id === operation.id ? operation : item) : [...operations, operation] };
}

// ---- archive invariants ---------------------------------------------------------------------------------------------

/** Every link between the operations and the ledger, checked by `validateArchive` on every write, import and read (maps
 * built once, A21). Shapes are checked before (`validatePurchaseOperation`), and the movements of a plan against its
 * effective shares in `validateInstallmentPlans`. Guards that involve a live operation are worded by `context` (A22).
 * - ids (A11): unique, and disjoint from movement, transfer and plan ids and from the projected line ids;
 * - every operation (undone included): its target exists (no dangling reference), its account exists and holds its
 *   currency; an ordinary purchase's devolución never targets an instalment or a debt's account (A10); a plan operation
 *   uses the plan's card account and currency, and its rows name real shares with money (a reduction ≤ the principal share);
 * - a live devolución of an ordinary purchase (§2, A10): its purchase is a live expense on the same account, dated on or
 *   before it, and Σ live devoluciones ≤ the purchase's amount;
 * - a live plan operation (A5): its plan is not deleted and it is dated on or after the purchase; Σ live reductions per
 *   share ≤ the share; Σ live credit ≤ principal recognised (live instalment movements + shares adelantos brought forward);
 * - a live adelanto (A4): each share covered by at most one live adelanto, at its current amount (schedule − live
 *   reductions); no recorded share after its date, no covered share on or before it, and no share after its date left to
 *   record (every one is covered or refunded to zero). */
export function validatePurchaseOperationLinks(archive: OperationArchive, context?: OperationContext): void {
  const operations = archive.purchaseOperations ?? [];
  if (!operations.length) return;
  const accounts = new Map(archive.accounts.map(account => [account.id, account]));
  const records = new Map(archive.records.map(record => [record.entry.id, record]));
  const plans = new Map((archive.installmentPlans ?? []).map(plan => [plan.id, plan]));
  const cards = new Map((archive.cards ?? []).map(card => [card.id, card]));
  const debtAccounts = new Set((archive.debts ?? []).map(debt => debt.accountId));
  const taken = new Set<string>([...records.keys(), ...(archive.transfers ?? []).map(record => record.transfer.id), ...plans.keys()]);
  const seen = new Set<string>();
  for (const operation of operations) {
    if (seen.has(operation.id)) throw new Error(OPERATION_ID_MESSAGE);
    seen.add(operation.id);
  }
  for (const operation of operations) {
    for (const id of new Set([operation.id, ...operationLineIds(operation)])) {
      if (taken.has(id) || (id !== operation.id && seen.has(id))) throw new Error(OPERATION_ID_MESSAGE);
    }
  }
  const refundedByEntry = new Map<string, bigint>();
  const byPlan = new Map<string, PurchaseOperation[]>();
  for (const operation of operations) {
    const account = accounts.get(operation.accountId);
    if (!account) throw new Error(OPERATION_TARGET_MESSAGE);
    if (account.currency !== operation.currency) throw new Error(OPERATION_INVALID_MESSAGE);
    if (isEntryRefund(operation)) {
      const record = records.get(operation.target.entryId);
      if (!record) throw new Error(OPERATION_TARGET_MESSAGE);
      if (installmentOccurrenceOf(record.entry.id) || debtAccounts.has(operation.accountId)) throw new Error(OPERATION_INVALID_MESSAGE);
      if (operation.voided) continue;
      if (record.voided || record.entry.kind !== 'expense' || record.entry.accountId !== operation.accountId || record.entry.dateISO > operation.dateISO) {
        throw new Error(operationGuardMessage('refund-link', context));
      }
      refundedByEntry.set(record.entry.id, (refundedByEntry.get(record.entry.id) ?? 0n) + BigInt(operation.amountMinor));
      continue;
    }
    const plan = plans.get(operationPlanId(operation)!);
    if (!plan) throw new Error(OPERATION_TARGET_MESSAGE);
    const card = cards.get(plan.cardId);
    if (!card || card.accountId !== operation.accountId || plan.currency !== operation.currency) throw new Error(OPERATION_INVALID_MESSAGE);
    if (isPlanRefund(operation)) {
      for (const row of operation.reductions) if (row.number > plan.count || row.minor > plan.schedule[row.number - 1].principalMinor) throw new Error(OPERATION_INVALID_MESSAGE);
    } else if (isPlanPayoff(operation)) {
      for (const row of operation.covered) if (row.number > plan.count || plan.schedule[row.number - 1][`${row.component}Minor`] <= 0) throw new Error(OPERATION_INVALID_MESSAGE);
    }
    if (!operation.voided && (plan.deleted || operation.dateISO < plan.purchaseDateISO)) throw new Error(OPERATION_INVALID_MESSAGE);
    const list = byPlan.get(plan.id);
    if (list) list.push(operation); else byPlan.set(plan.id, [operation]);
  }
  for (const [entryId, refunded] of refundedByEntry) {
    if (refunded > BigInt(records.get(entryId)!.entry.amountMinor)) throw new Error(operationGuardMessage('refund-cap', context));
  }
  for (const [planId, planOperations] of byPlan) validatePlanOperations(plans.get(planId)!, archive.records, planOperations, context);
}

function validatePlanOperations(plan: InstallmentPlan, records: readonly EntryRecord[], operations: readonly PurchaseOperation[], context?: OperationContext): void {
  const live = operations.filter(operation => !operation.voided);
  const reductions = new Map<number, bigint>();
  for (const refund of live.filter(isPlanRefund)) {
    for (const row of refund.reductions) reductions.set(row.number, (reductions.get(row.number) ?? 0n) + BigInt(row.minor));
  }
  for (const [number, reduced] of reductions) {
    if (reduced > BigInt(plan.schedule[number - 1].principalMinor)) throw new Error(operationGuardMessage('refund-overlap', context));
  }
  const payoffs = live.filter(isPlanPayoff);
  const coveredBy = new Map<string, PlanPayoff>();
  for (const payoff of payoffs) {
    for (const row of payoff.covered) {
      const key = row.number + '|' + row.component;
      if (coveredBy.has(key)) throw new Error(operationGuardMessage('payoff-overlap', context));
      coveredBy.set(key, payoff);
      const share = BigInt(plan.schedule[row.number - 1][`${row.component}Minor`]) - (row.component === 'principal' ? reductions.get(row.number) ?? 0n : 0n);
      if (BigInt(row.minor) !== share) throw new Error(operationGuardMessage('payoff-refund', context));
    }
  }
  // The plan's movements, undone ones included (an undone share was recorded on its closing all the same).
  const recorded: { number: number; component: InstallmentComponent; billingDateISO: string; record: EntryRecord }[] = [];
  for (const record of records) {
    const occurrence = installmentOccurrenceOf(record.entry.id);
    if (!occurrence || occurrence.planId !== plan.id) continue;
    const row = plan.schedule[occurrence.number - 1];
    if (!row) continue; // a movement without its instalment is the drift guard's
    recorded.push({ number: occurrence.number, component: occurrence.component, billingDateISO: row.billingDateISO, record });
    if (coveredBy.has(occurrence.number + '|' + occurrence.component)) throw new Error(operationGuardMessage('payoff-overlap', context));
  }
  for (const payoff of payoffs) {
    if (recorded.some(item => item.billingDateISO > payoff.dateISO)) throw new Error(operationGuardMessage('payoff-overlap', context));
    if (payoff.covered.some(row => plan.schedule[row.number - 1].billingDateISO <= payoff.dateISO)) throw new Error(operationGuardMessage('payoff-overlap', context));
    const recordedKeys = new Set(recorded.map(item => item.number + '|' + item.component));
    for (const row of plan.schedule) {
      if (row.billingDateISO <= payoff.dateISO) continue;
      for (const component of INSTALLMENT_COMPONENTS) {
        const share = BigInt(row[`${component}Minor`]) - (component === 'principal' ? reductions.get(row.number) ?? 0n : 0n);
        const key = row.number + '|' + component;
        if (share > 0n && !coveredBy.has(key) && !recordedKeys.has(key)) throw new Error(operationGuardMessage('payoff-overlap', context));
      }
    }
  }
  // Σ live credit ≤ principal recognised: live principal movements plus the principal adelantos brought forward.
  const credit = sumMinor(live.filter(isPlanRefund).map(refund => refund.creditMinor));
  if (credit > 0n) {
    const recognised = sumMinor(recorded.filter(item => item.component === 'principal' && !item.record.voided).map(item => item.record.entry.amountMinor))
      + sumMinor(payoffs.flatMap(payoff => payoff.covered.filter(row => row.component === 'principal').map(row => row.minor)));
    if (credit > recognised) throw new Error(operationGuardMessage('refund-credit', context));
  }
}

// ---- projection: what the ledger reads -------------------------------------------------------------------------------

/** The lines live operations add to `snapshot.entries` (after the records, in a deterministic order: date, creation, id),
 * merchant and category resolved at read time:
 * - an ordinary purchase's devolución: one line, id = the operation's, `kind: 'expense'` with a **negative** amount on the
 *   account it credited, in the purchase's current merchant and category (an edit of the purchase moves it), with
 *   `refund: { operationId, targetEntryId }`;
 * - a plan devolución with credit: one line of −credit on the card, the plan's merchant, in the category of the plan's
 *   latest live recorded principal share, else the plan's category (A30), with `refund: { operationId, targetPlanId }`;
 * - an adelanto: one positive line per component it recognises (`${id}_p|_i|_f|_t`; financing skipped when waived), in the
 *   component's category, with `payoff: { operationId, planId, component }`.
 * An operation whose target is missing projects nothing (the projection never stops the ledger from opening; the archive
 * validation reports it). */
export function projectOperationLines(archive: Pick<OperationArchive, 'records' | 'installmentPlans' | 'purchaseOperations'>): Entry[] {
  const live = liveOperations(archive);
  if (!live.length) return [];
  const records = new Map(archive.records.map(record => [record.entry.id, record]));
  const plans = new Map((archive.installmentPlans ?? []).map(plan => [plan.id, plan]));
  let latestPrincipal: Map<string, { number: number; category: string }> | null = null;
  const latestCategory = (plan: InstallmentPlan) => {
    if (!latestPrincipal) {
      latestPrincipal = new Map();
      for (const record of archive.records) {
        const occurrence = record.voided ? null : installmentOccurrenceOf(record.entry.id);
        if (!occurrence || occurrence.component !== 'principal') continue;
        const current = latestPrincipal.get(occurrence.planId);
        if (!current || occurrence.number > current.number) latestPrincipal.set(occurrence.planId, { number: occurrence.number, category: record.entry.category });
      }
    }
    return latestPrincipal.get(plan.id)?.category ?? plan.category;
  };
  const lines: Entry[] = [];
  const ordered = [...live].sort((a, b) => a.dateISO.localeCompare(b.dateISO) || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  for (const operation of ordered) {
    if (isEntryRefund(operation)) {
      const target = records.get(operation.target.entryId);
      if (!target) continue;
      lines.push({ id: operation.id, accountId: operation.accountId, kind: 'expense', amountMinor: -operation.amountMinor, merchant: target.entry.merchant,
        category: target.entry.category, dateISO: operation.dateISO, createdAt: operation.createdAt, refund: { operationId: operation.id, targetEntryId: target.entry.id } });
      continue;
    }
    const plan = plans.get(operationPlanId(operation)!);
    if (!plan) continue;
    if (isPlanRefund(operation)) {
      if (operation.creditMinor > 0) lines.push({ id: operation.id, accountId: operation.accountId, kind: 'expense', amountMinor: -operation.creditMinor,
        merchant: plan.merchant, category: latestCategory(plan), dateISO: operation.dateISO, createdAt: operation.createdAt,
        refund: { operationId: operation.id, targetPlanId: plan.id } });
      continue;
    }
    const payoff = operation as PlanPayoff;
    for (const component of INSTALLMENT_COMPONENTS) {
      if (component !== 'principal' && payoff.financing === 'waived') continue;
      const total = sumMinor(payoff.covered.filter(row => row.component === component).map(row => row.minor));
      if (total <= 0n) continue;
      lines.push({ id: payoff.id + PAYOFF_LINE_SUFFIX[component], accountId: payoff.accountId, kind: 'expense', amountMinor: safe(total), merchant: plan.merchant,
        category: componentCategory(plan, component), dateISO: payoff.dateISO, createdAt: payoff.createdAt, payoff: { operationId: payoff.id, planId: plan.id, component } });
    }
  }
  return lines;
}
