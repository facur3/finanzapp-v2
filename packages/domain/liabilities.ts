import { ACCOUNT_DELETED_MESSAGE, accountBalanceMinor, isLiveAccount, validDateISO, type Account, type Currency, type Entry, type EntryKind, type LedgerSnapshot, type Transfer } from './ledger.ts';
import { assertStorableCurrency, sortCurrencies } from './currency.ts';
import { CARD_PLAN_MESSAGE, cardHasPendingInstallments, type InstallmentPlan, type RecordedEntry } from './installments.ts';
import { cardCycleView, type CardCycleDates } from './card-cycles.ts';

/** A credit card is a hidden internal ledger account. A purchase (without
 * instalments) is an expense posted to that account exactly once for its full price
 * (it counts in reports and budgets and increases the card's negative balance); a
 * purchase in instalments (an `InstallmentPlan`, installments.ts) recognises its principal
 * instalment by instalment instead, decision 003 rule 7. A payment is an internal transfer from
 * a cash account into the card account: it lowers liquid money and lowers the
 * card's balance due without ever creating a second expense. The card is tied to
 * no cash account: each payment names its source when it is recorded (a preferred
 * account, if it ever exists, is a form preselection, never an imputation). The
 * balance due is not a personal debt (`PersonalDebtProfile`): the two never share
 * an account or a total. Decision 003, «Invariantes contables de tarjetas»;
 * `card-invariants.test.ts` pins each rule. */
export interface CreditCardProfile {
  id: string;
  /** The hidden internal account that holds the balance due. The only account link a card has. */
  accountId: string;
  issuer: string;
  last4: string;
  creditLimitMinor: number | null;
  /** The usual days (24T2: «días habituales»): the grid of the card's statements. Exact dates of particular statements
   * live apart, in `CardCycleDates` (card-cycles.ts), and win over the grid where they exist. */
  closingDay: number;
  dueDay: number;
  active: boolean;
  /** Producto 25B2: a deletion record. The card leaves Tarjetas and every form; its hidden account, every purchase
   * and every payment stay in the ledger exactly as recorded and are still read as this card's. A deleted card is
   * never active, takes no purchase and no payment, and never changes again. */
  deleted: boolean;
  createdAt: string;
  revision: number;
  updatedAt: string;
}

export const CARD_DELETED_MESSAGE = 'Esta tarjeta fue eliminada.';
/** 24T1 review: an archived card keeps its history, its plans and its payments, and takes no new obligation (a typed
 * purchase, a new plan, a new recurring rule or a movement or rule moved onto it). Reactivating it lifts this. */
export const CARD_ARCHIVED_MESSAGE = 'Esta tarjeta está archivada. Reactivala para registrar compras nuevas.';
/** A card with a balance due is paid or archived, never deleted: deleting would leave money owed with no card to pay
 * it from (a deleted card takes no payment). A pending instalment plan blocks deletion the same way (24T1,
 * `assertCardDeletable`); archiving never erases a plan either. The copy says «saldo pendiente», never «deuda»: that
 * word names the Deudas y cobros section (personal debts). */
export const CARD_DEBT_MESSAGE = 'Esta tarjeta tiene saldo pendiente. Pagalo o archivala; no se puede eliminar.';
/** The deletion record is written by `deleteCreditCard` in storage (it also stops the card's rules); a plain save never flips it. */
export const CARD_DELETE_PATH_MESSAGE = 'Una tarjeta se elimina con su propia acción, no con un cambio de datos.';

export type DebtDirection = 'owed_by_me' | 'owed_to_me';

export const DEBT_DELETED_MESSAGE = 'Esta deuda fue eliminada.';
/** Producto 25B2 close: a debt or receivable with a balance left and a payment or collection already recorded is
 * settled or closed, never deleted: a deleted tracker takes no new transfer, so a partly settled obligation would be
 * stranded. Closing keeps it (balance, history, Reabrir) without implying a payment or a pardon. */
export const DEBT_OUTSTANDING_MESSAGE = 'Esta deuda tiene saldo pendiente y pagos o cobros registrados. Saldala o cerrala; no se puede eliminar.';
/** The deletion record is written by `deletePersonalDebt` in storage (it checks the rule above); a plain save never flips it. */
export const DEBT_DELETE_PATH_MESSAGE = 'Una deuda se elimina con su propia acción, no con un cambio de datos.';

/** A personal debt or receivable is also a hidden account. "I owe" starts with a
 * negative balance and is settled by transfers into it; "they owe me" starts
 * positive and is collected by transfers out of it. Neither is income or spending. */
export interface PersonalDebtProfile {
  id: string;
  accountId: string;
  direction: DebtDirection;
  counterparty: string;
  dueDateISO: string | null;
  note: string;
  /** false = closed: kept under Cerradas, no longer pending (Producto 24UX4; «archivada» before). */
  active: boolean;
  /** Producto 24UX4: a deletion record. The tracker leaves every list and total; its hidden account, the
   * opening amount and every payment or collection stay in the ledger exactly as recorded, still read as this
   * debt's (so a payment keeps its «Debo · Juan» side and never becomes a plain account). A deleted debt is
   * never active and never changes again. */
  deleted: boolean;
  createdAt: string;
  revision: number;
  updatedAt: string;
}

export type AccountKind = 'cash' | 'card' | 'debt';

const CARD_KEYS = ['id', 'accountId', 'issuer', 'last4', 'creditLimitMinor', 'closingDay', 'dueDay',
  'active', 'deleted', 'createdAt', 'revision', 'updatedAt'] as const;
const DEBT_KEYS = ['id', 'accountId', 'direction', 'counterparty', 'dueDateISO', 'note',
  'active', 'deleted', 'createdAt', 'revision', 'updatedAt'] as const;

function validId(value: string): boolean {
  return typeof value === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(value);
}
function validTimestamp(value: string): boolean {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}
function accountFor(accountId: string, accounts: Account[]): Account {
  const account = accounts.find(item => item.id === accountId);
  if (!account) throw new Error('La obligación debe usar una cuenta interna existente.');
  return account;
}
function validateVersion(createdAt: string, revision: number, updatedAt: string): void {
  if (!validTimestamp(createdAt) || !validTimestamp(updatedAt) || !Number.isSafeInteger(revision) || revision < 0) {
    throw new Error('Estado de obligación inválido.');
  }
  if (revision === 0 && createdAt !== updatedAt) throw new Error('Estado inicial de obligación inválido.');
}

export function validateCreditCardProfile(card: CreditCardProfile, accounts: Account[]): void {
  if (!validId(card.id) || !validId(card.accountId)) throw new Error('Identificador de tarjeta inválido.');
  accountFor(card.accountId, accounts);
  if (typeof card.issuer !== 'string' || card.issuer.length > 80) throw new Error('El emisor debe tener hasta 80 caracteres.');
  if (typeof card.last4 !== 'string' || (card.last4 && !/^\d{4}$/.test(card.last4))) {
    throw new Error('Los últimos cuatro dígitos deben tener exactamente 4 números.');
  }
  if (card.creditLimitMinor !== null && (!Number.isSafeInteger(card.creditLimitMinor) || card.creditLimitMinor <= 0)) {
    throw new Error('El límite debe ser mayor que cero.');
  }
  if (!Number.isInteger(card.closingDay) || card.closingDay < 1 || card.closingDay > 31
    || !Number.isInteger(card.dueDay) || card.dueDay < 1 || card.dueDay > 31) {
    throw new Error('Elegí días de cierre y vencimiento entre 1 y 31.');
  }
  if (typeof card.active !== 'boolean' || typeof card.deleted !== 'boolean' || (card.deleted && card.active)) throw new Error('Estado de tarjeta inválido.');
  validateVersion(card.createdAt, card.revision, card.updatedAt);
}

export function validatePersonalDebtProfile(debt: PersonalDebtProfile, accounts: Account[]): void {
  if (!validId(debt.id) || !validId(debt.accountId)) throw new Error('Identificador de deuda inválido.');
  accountFor(debt.accountId, accounts);
  if (!['owed_by_me', 'owed_to_me'].includes(debt.direction)) throw new Error('Elegí si debés o te deben.');
  if (typeof debt.counterparty !== 'string' || !debt.counterparty.trim() || debt.counterparty.length > 80) {
    throw new Error('Ingresá una persona o concepto de hasta 80 caracteres.');
  }
  if (debt.dueDateISO !== null && !validDateISO(debt.dueDateISO)) throw new Error('La fecha de vencimiento no es válida.');
  if (typeof debt.note !== 'string' || debt.note.length > 120) throw new Error('La nota debe tener hasta 120 caracteres.');
  if (typeof debt.active !== 'boolean' || typeof debt.deleted !== 'boolean' || (debt.deleted && debt.active)) throw new Error('Estado de deuda inválido.');
  validateVersion(debt.createdAt, debt.revision, debt.updatedAt);
}

/** One internal account represents at most one obligation, so a balance can
 * never be read as both a card debt and a personal debt. */
export function validateLiabilityProfiles(cards: CreditCardProfile[], debts: PersonalDebtProfile[], accounts: Account[]): void {
  const ids = new Set<string>();
  const accountIds = new Set<string>();
  for (const card of cards) {
    validateCreditCardProfile(card, accounts);
    if (ids.has(card.id)) throw new Error('La copia repite una tarjeta.');
    if (accountIds.has(card.accountId)) throw new Error('Una cuenta interna no puede representar dos obligaciones.');
    ids.add(card.id); accountIds.add(card.accountId);
  }
  for (const debt of debts) {
    validatePersonalDebtProfile(debt, accounts);
    if (ids.has(debt.id)) throw new Error('La copia repite una obligación.');
    if (accountIds.has(debt.accountId)) throw new Error('Una cuenta interna no puede representar dos obligaciones.');
    ids.add(debt.id); accountIds.add(debt.accountId);
  }
}

/** An obligation never moves to another internal account (its currency and its balance live
 * there), never changes its creation date, and advances exactly one revision per save. */
export function validateCreditCardChange(before: CreditCardProfile, after: CreditCardProfile): void {
  if (before.deleted) throw new Error(CARD_DELETED_MESSAGE);
  if (after.accountId !== before.accountId || after.createdAt !== before.createdAt || after.revision !== before.revision + 1) {
    throw new Error('La tarjeta cambió desde que la abriste. Volvé a revisarla.');
  }
}
export function validatePersonalDebtChange(before: PersonalDebtProfile, after: PersonalDebtProfile): void {
  if (before.deleted) throw new Error(DEBT_DELETED_MESSAGE);
  if (after.accountId !== before.accountId || after.direction !== before.direction
    || after.createdAt !== before.createdAt || after.revision !== before.revision + 1) {
    throw new Error('La deuda cambió desde que la abriste. Volvé a revisarla.');
  }
}

export function sameCreditCardProfile(a: CreditCardProfile, b: CreditCardProfile): boolean {
  return CARD_KEYS.every(key => a[key] === b[key]);
}
export function samePersonalDebtProfile(a: PersonalDebtProfile, b: PersonalDebtProfile): boolean {
  return DEBT_KEYS.every(key => a[key] === b[key]);
}

export function hiddenLiabilityAccountIds(cards: CreditCardProfile[] = [], debts: PersonalDebtProfile[] = []): Set<string> {
  return new Set([...cards.map(card => card.accountId), ...debts.map(debt => debt.accountId)]);
}

export function accountKind(accountId: string, cards: CreditCardProfile[] = [], debts: PersonalDebtProfile[] = []): AccountKind {
  if (cards.some(card => card.accountId === accountId)) return 'card';
  if (debts.some(debt => debt.accountId === accountId)) return 'debt';
  return 'cash';
}

/** Expenses, income and recurring rules may post to cash accounts and cards.
 * A personal debt only changes through payments/collections (transfers). */
export function assertPostingAccount(accountId: string, debts: PersonalDebtProfile[] = []): void {
  if (debts.some(debt => debt.accountId === accountId)) {
    throw new Error('Una deuda se salda con pagos o cobros, no con gastos o ingresos.');
  }
}

/** Producto 25B2: nothing new lands on a deleted account, a deleted card or a deleted debt. Stored rows on them stay
 * readable; a new posting, a new transfer side or an active rule is refused with the record's own message. */
export function assertOpenAccount(accountId: string, accounts: readonly Account[], cards: readonly CreditCardProfile[] = [], debts: readonly PersonalDebtProfile[] = []): void {
  const account = accounts.find(item => item.id === accountId);
  if (account && !isLiveAccount(account)) throw new Error(ACCOUNT_DELETED_MESSAGE);
  if (cards.some(card => card.deleted && card.accountId === accountId)) throw new Error(CARD_DELETED_MESSAGE);
  if (debts.some(debt => debt.deleted && debt.accountId === accountId)) throw new Error(DEBT_DELETED_MESSAGE);
}

/** 24T1 review: whether a new obligation may land on `accountId`. A deleted card refuses (as `assertOpenAccount`); an
 * archived card refuses a new purchase, a new instalment plan, a new recurring rule, or a movement or rule moved onto it.
 * It never refuses what already lives there: history is edited in place, pending plans keep being recognised, stored
 * rules keep their own semantics, and payments (transfers into the card) are accepted. Not a card: nothing to check. */
export function assertAcceptsNewObligation(accountId: string, cards: readonly CreditCardProfile[] = []): void {
  const card = cards.find(item => item.accountId === accountId);
  if (!card) return;
  if (card.deleted) throw new Error(CARD_DELETED_MESSAGE);
  if (!card.active) throw new Error(CARD_ARCHIVED_MESSAGE);
}

/** Whether a card may be deleted now: no balance due and (24T1) no pending instalment plan: a live plan with an instalment
 * not yet recognised (future, not recorded, or undone). The one place of that rule: storage and the UI both call it. */
export function assertCardDeletable(card: CreditCardProfile, snapshot: LedgerSnapshot, plans: readonly InstallmentPlan[] = [], records: readonly RecordedEntry[] = []): void {
  if (card.deleted) throw new Error(CARD_DELETED_MESSAGE);
  if (cardDebtMinor(card, snapshot) > 0) throw new Error(CARD_DEBT_MESSAGE);
  if (cardHasPendingInstallments(card, plans, records)) throw new Error(CARD_PLAN_MESSAGE);
}

/** The deletion record of a card (25B2): inactive, deleted, one revision on. Never twice. */
export function deleteCreditCard(card: CreditCardProfile, nowISO: string): CreditCardProfile {
  if (card.deleted) throw new Error(CARD_DELETED_MESSAGE);
  if (!validTimestamp(nowISO)) throw new Error('Fecha de actualización inválida.');
  return { ...card, active: false, deleted: true, revision: card.revision + 1, updatedAt: nowISO };
}

/** A new income posts to a cash account only (Producto 24B6). A card is paid by a
 * transfer; what an issuer gives back (a refund, a reversal, a bonus) is a refund
 * tied to its purchase in a later delivery (the cards and instalments entry of the
 * roadmap), never a plain income hidden inside the card's debt, where it would read
 * as salary in reports and budgets. Historical incomes already stored on a card stay
 * readable and editable in place (`keepsHistoricalCardIncome`). */
export function assertIncomeAccount(accountId: string, cards: CreditCardProfile[] = [], debts: PersonalDebtProfile[] = []): void {
  assertPostingAccount(accountId, debts);
  if (cards.some(card => card.accountId === accountId)) {
    throw new Error('Un ingreso se registra en una cuenta normal, no en una tarjeta.');
  }
}

/** The one case a card may carry an income: a posting that already was an income on that
 * card is corrected (amount, date, label) or restored without leaving it. */
export function keepsHistoricalCardIncome(before: Pick<Entry, 'kind' | 'accountId'>, after: Pick<Entry, 'kind' | 'accountId'>): boolean {
  return before.kind === 'income' && after.kind === 'income' && before.accountId === after.accountId;
}

/** The accounts a posting of that kind may use: cash and cards for an expense (a purchase
 * is an expense that raises the card's debt), cash only for an income; never a debt. */
export function postingAccountsFor(kind: EntryKind, accounts: readonly Account[], cards: CreditCardProfile[] = [], debts: PersonalDebtProfile[] = []): Account[] {
  return accounts.filter(account => {
    // 25B2: a deleted account or card is history, never a choice. 24T1 review: nor is an archived card (the forms keep a
    // stored movement's or rule's own row offered while it is edited, so history is still corrected in place).
    if (!isLiveAccount(account) || cards.some(card => (card.deleted || !card.active) && card.accountId === account.id)) return false;
    const kindOfAccount = accountKind(account.id, cards, debts);
    return kindOfAccount === 'cash' || (kind === 'expense' && kindOfAccount === 'card');
  });
}

/** The sides a new transfer may have (24B6): cash to cash, cash into a card (its payment),
 * cash into a debt (its payment) or out of a receivable (its collection). A card is never
 * the source (a cash advance or a balance transfer is not this ledger's transfer), and
 * two obligations never face each other. Stored transfers are read as they are;
 * `sameTransferSides` lets an edit keep historical sides. */
export function assertTransferSides(transfer: Pick<Transfer, 'fromAccountId' | 'toAccountId'>, cards: CreditCardProfile[] = [], debts: PersonalDebtProfile[] = [], accounts: readonly Account[] = []): void {
  const from = accountKind(transfer.fromAccountId, cards, debts), to = accountKind(transfer.toAccountId, cards, debts);
  // 24UX4 / 25B2: a deleted tracker, card or account keeps its recorded transfers, but takes no new one.
  assertOpenAccount(transfer.fromAccountId, accounts, cards, debts);
  assertOpenAccount(transfer.toAccountId, accounts, cards, debts);
  if (from === 'card') throw new Error('Una tarjeta se paga desde una cuenta; no puede ser el origen de una transferencia.');
  if (from !== 'cash' && to !== 'cash') throw new Error('Una transferencia entre dos obligaciones no se puede registrar.');
}
export function sameTransferSides(a: Pick<Transfer, 'fromAccountId' | 'toAccountId'>, b: Pick<Transfer, 'fromAccountId' | 'toAccountId'>): boolean {
  return a.fromAccountId === b.fromAccountId && a.toAccountId === b.toAccountId;
}

function safeBigInt(value: bigint): number {
  if (value > BigInt(Number.MAX_SAFE_INTEGER) || value < -BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error('El saldo supera el rango seguro.');
  }
  return Number(value);
}

/** Recorded liquid money: normal accounts only. Card debt, personal debts and
 * receivables are excluded, so "Disponible" never nets a loan against cash. */
export function liquidTotalsByCurrency(snapshot: LedgerSnapshot, cards: CreditCardProfile[] = [], debts: PersonalDebtProfile[] = []): Partial<Record<Currency, number>> {
  const hidden = hiddenLiabilityAccountIds(cards, debts);
  const totals = new Map<Currency, bigint>();
  for (const account of snapshot.accounts) {
    // 25B2: a deleted account's balance is history, not available money.
    if (hidden.has(account.id) || !isLiveAccount(account)) continue;
    assertStorableCurrency(account.currency);
    const balance = BigInt(accountBalanceMinor(account, snapshot.entries, snapshot.transfers));
    totals.set(account.currency, (totals.get(account.currency) ?? 0n) + balance);
  }
  // Every currency a liquid account holds gets a key, in grouping order (ARS, USD, then by
  // code): a missing key is a true "no liquid account in that currency", never a dropped total.
  const result: Partial<Record<Currency, number>> = {};
  for (const currency of sortCurrencies(totals.keys())) result[currency] = safeBigInt(totals.get(currency)!);
  return result;
}

/** Outstanding personal debts and receivables per currency, exact and never added across
 * currencies. `out-of-range` names the currency whose sum left the safe range instead of
 * rounding it or dropping it. */
export type DebtTotals = { status: 'ready'; currency: Currency; owedMinor: number; receivableMinor: number } | { status: 'out-of-range'; currency: Currency };
export function debtTotalsByCurrency(debts: readonly PersonalDebtProfile[], snapshot: LedgerSnapshot): DebtTotals[] {
  const sums = new Map<Currency, { owed: bigint; receivable: bigint }>();
  for (const debt of debts) {
    const account = snapshot.accounts.find(item => item.id === debt.accountId);
    if (!account) continue;
    assertStorableCurrency(account.currency);
    const current = sums.get(account.currency) ?? { owed: 0n, receivable: 0n };
    current[debt.direction === 'owed_by_me' ? 'owed' : 'receivable'] += BigInt(debtOutstandingMinor(debt, snapshot));
    sums.set(account.currency, current);
  }
  return sortCurrencies(sums.keys()).map(currency => {
    const { owed, receivable } = sums.get(currency)!;
    try { return { status: 'ready', currency, owedMinor: safeBigInt(owed), receivableMinor: safeBigInt(receivable) }; }
    catch { return { status: 'out-of-range', currency }; }
  });
}

export function cardDebtMinor(card: CreditCardProfile, snapshot: LedgerSnapshot): number {
  const account = accountFor(card.accountId, snapshot.accounts);
  return Math.max(0, -accountBalanceMinor(account, snapshot.entries, snapshot.transfers));
}
/** Balance in the card holder's favour (overpayment or refund). */
export function cardCreditMinor(card: CreditCardProfile, snapshot: LedgerSnapshot): number {
  const account = accountFor(card.accountId, snapshot.accounts);
  return Math.max(0, accountBalanceMinor(account, snapshot.entries, snapshot.transfers));
}
/** The limit left, or null without a limit. Gate (decision 003, rule 7): how the issuer reserves credit for pending
 * instalments (the whole plan, or only the billed part) is not assumed, so a card with a pending plan answers null
 * (unknown). 24T2 shows that state as «No calculado con cuotas», never as zero or an invented figure; the caller tells
 * «no limit» (`creditLimitMinor === null`) from «unknown» (a limit and a pending plan). */
export function cardAvailableLimitMinor(card: CreditCardProfile, snapshot: LedgerSnapshot, plans: readonly InstallmentPlan[] = [], records: readonly RecordedEntry[] = []): number | null {
  if (card.creditLimitMinor === null) return null;
  if (cardHasPendingInstallments(card, plans, records)) return null;
  return card.creditLimitMinor - cardDebtMinor(card, snapshot);
}

export function debtOutstandingMinor(debt: PersonalDebtProfile, snapshot: LedgerSnapshot): number {
  const account = accountFor(debt.accountId, snapshot.accounts);
  const balance = accountBalanceMinor(account, snapshot.entries, snapshot.transfers);
  return debt.direction === 'owed_by_me' ? Math.max(0, -balance) : Math.max(0, balance);
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0, 12).getDate();
}
function iso(year: number, monthIndex: number, day: number): string {
  return [year, String(monthIndex + 1).padStart(2, '0'), String(day).padStart(2, '0')].join('-');
}
function dayOfMonth(year: number, monthIndex: number, requestedDay: number): string {
  return iso(year, monthIndex, Math.min(requestedDay, daysInMonth(year, monthIndex)));
}

/** First calendar date on or after `referenceISO` whose day of month is
 * `requestedDay`, clamped to short months (day 31 becomes Feb 28/29). */
export function nextDayOfMonthISO(referenceISO: string, requestedDay: number): string {
  if (!validDateISO(referenceISO) || !Number.isInteger(requestedDay) || requestedDay < 1 || requestedDay > 31) {
    throw new Error('Fecha mensual inválida.');
  }
  const [year, month] = referenceISO.split('-').map(Number);
  const candidate = dayOfMonth(year, month - 1, requestedDay);
  if (candidate >= referenceISO) return candidate;
  const nextMonth = month; // month is 1-based, so `month` is the next 0-based index.
  return dayOfMonth(year + Math.floor(nextMonth / 12), nextMonth % 12, requestedDay);
}

/** Last calendar date strictly before `referenceISO` with that day of month. */
export function previousDayOfMonthISO(referenceISO: string, requestedDay: number): string {
  if (!validDateISO(referenceISO) || !Number.isInteger(requestedDay) || requestedDay < 1 || requestedDay > 31) {
    throw new Error('Fecha mensual inválida.');
  }
  const [year, month] = referenceISO.split('-').map(Number);
  const candidate = dayOfMonth(year, month - 1, requestedDay);
  if (candidate < referenceISO) return candidate;
  const previous = month - 2; // 0-based index of the previous month, may be -1.
  return dayOfMonth(previous < 0 ? year - 1 : year, (previous + 12) % 12, requestedDay);
}

export interface CardCycle {
  /** First day of the open statement (the day after the previous closing). */
  startISO: string;
  /** The open statement's closing, on or after today (on the closing day the statement is still open). */
  closingISO: string;
  /** The due date of THAT closing (the open statement's own due). It is not always the next due date: the statement that
   * closed last may still be due first. The next due date is `cardCycleView(...).nextDue` (24T2). */
  dueISO: string;
}

/** The open statement of a card on `todayISO`, from its usual days and (24T2) its exact cycle dates (`cycleDates`, the
 * card's own rows). A calendar estimate, not a statement received from the bank. */
export function cardCycle(card: Pick<CreditCardProfile, 'closingDay' | 'dueDay'>, todayISO: string, cycleDates: readonly CardCycleDates[] = []): CardCycle {
  const view = cardCycleView(card, cycleDates, todayISO);
  return { startISO: view.openStartISO, closingISO: view.open.closingISO, dueISO: view.open.dueISO };
}

export interface CardStatementActivity extends CardCycle {
  purchasesMinor: number;
  refundsMinor: number;
  paymentsMinor: number;
  purchaseCount: number;
  paymentCount: number;
}

/** Recorded purchases (expenses, instalments included), refunds (income) and payments (transfers into the card) inside
 * the open statement window: «Este ciclo», the activity the ledger holds, never a statement amount. Exact minor units. */
export function cardStatementActivity(card: CreditCardProfile, snapshot: LedgerSnapshot, todayISO: string, cycleDates: readonly CardCycleDates[] = []): CardStatementActivity {
  const cycle = cardCycle(card, todayISO, cycleDates.filter(row => row.cardId === card.id));
  const inWindow = (dateISO: string) => dateISO >= cycle.startISO && dateISO <= cycle.closingISO;
  let purchases = 0n, refunds = 0n, payments = 0n, purchaseCount = 0, paymentCount = 0;
  for (const entry of snapshot.entries) {
    if (entry.accountId !== card.accountId || !inWindow(entry.dateISO)) continue;
    if (entry.kind === 'expense') { purchases += BigInt(entry.amountMinor); purchaseCount++; }
    else refunds += BigInt(entry.amountMinor);
  }
  for (const transfer of snapshot.transfers ?? []) {
    if (transfer.toAccountId !== card.accountId || !inWindow(transfer.dateISO)) continue;
    payments += BigInt(transfer.amountMinor); paymentCount++;
  }
  return { ...cycle, purchasesMinor: safeBigInt(purchases), refundsMinor: safeBigInt(refunds),
    paymentsMinor: safeBigInt(payments), purchaseCount, paymentCount };
}

/** Movements that belong to one obligation account, newest first. */
export function liabilityActivity(accountId: string, snapshot: LedgerSnapshot): { entries: Entry[]; transfers: Transfer[] } {
  return {
    entries: snapshot.entries.filter(entry => entry.accountId === accountId),
    transfers: (snapshot.transfers ?? []).filter(transfer => transfer.fromAccountId === accountId || transfer.toAccountId === accountId),
  };
}

/** Closing (Producto 24UX4) takes a debt out of the pending lists and totals and keeps it under Cerradas; its
 * balance, payments and collections are untouched. Reopening brings it back as it was. */
export function closePersonalDebt(debt: PersonalDebtProfile, nowISO: string): PersonalDebtProfile {
  return debtStateChange(debt, { active: false }, nowISO);
}
export function reopenPersonalDebt(debt: PersonalDebtProfile, nowISO: string): PersonalDebtProfile {
  return debtStateChange(debt, { active: true }, nowISO);
}
/** Whether a payment or collection (or any posting) was ever recorded on the tracker's account. The opening amount is
 * the account itself, not history: a tracker created by mistake has none. */
export function debtHasHistory(debt: PersonalDebtProfile, snapshot: LedgerSnapshot): boolean {
  const activity = liabilityActivity(debt.accountId, snapshot);
  return activity.entries.length > 0 || activity.transfers.length > 0;
}
/** What deleting a tracker means now (25B2 close): `settled` (nothing outstanding) and `untouched` (a balance, but no
 * payment or collection yet: a tracker created by mistake) may be deleted after a confirmation; `blocked` (a balance and
 * recorded history) is settled or closed instead. Deleting never records a payment and never touches the ledger. */
export type DebtDeletion = { kind: 'settled' } | { kind: 'untouched'; outstandingMinor: number } | { kind: 'blocked'; outstandingMinor: number };
export function debtDeletion(debt: PersonalDebtProfile, snapshot: LedgerSnapshot): DebtDeletion {
  const outstandingMinor = debtOutstandingMinor(debt, snapshot);
  if (outstandingMinor === 0) return { kind: 'settled' };
  return debtHasHistory(debt, snapshot) ? { kind: 'blocked', outstandingMinor } : { kind: 'untouched', outstandingMinor };
}
export function assertDebtDeletable(debt: PersonalDebtProfile, snapshot: LedgerSnapshot): void {
  if (debt.deleted) throw new Error(DEBT_DELETED_MESSAGE);
  if (debtDeletion(debt, snapshot).kind === 'blocked') throw new Error(DEBT_OUTSTANDING_MESSAGE);
}
/** The deletion record of a debt tracker: its account and every transfer that touched it stay as recorded. Storage
 * writes it only after `assertDebtDeletable`. */
export function deletePersonalDebt(debt: PersonalDebtProfile, nowISO: string): PersonalDebtProfile {
  return debtStateChange(debt, { active: false, deleted: true }, nowISO);
}
function debtStateChange(debt: PersonalDebtProfile, change: Partial<Pick<PersonalDebtProfile, 'active' | 'deleted'>>, nowISO: string): PersonalDebtProfile {
  if (debt.deleted) throw new Error(DEBT_DELETED_MESSAGE);
  if (!validTimestamp(nowISO)) throw new Error('Estado de obligación inválido.');
  return { ...debt, ...change, revision: debt.revision + 1, updatedAt: nowISO };
}
