import { isLiveAccount, validDateISO, validateEntry, type Account, type Currency, type Entry, type EntryKind } from './ledger.ts';
import { isStorableCurrency } from './currency.ts';
import { isEntryMinor } from './money.ts';
import { categoryKey } from './spending-report.ts';
import { findCategoryDefinition, resolveCategory } from './categories.ts';
import { assertAcceptsNewObligation, assertIncomeAccount, assertOpenAccount, assertPostingAccount, postingAccountsFor } from './liabilities.ts';
import { MAX_INSTALLMENTS, assertNewEntryId, newInstallmentPlan, type InstallmentPlan, type StatementPlacement } from './installments.ts';
import type { LedgerArchive } from './recovery.ts';

/** Producto 25A-01: the review draft, the one typed proposal every producer of a financial write ends in (the Assistant,
 * a Wallet capture, a future inbox, a dev fixture). A draft is **not** a ledger record: it is untrusted, possibly
 * incomplete, and writes nothing on its own. A producer only suggests fields; this module decides what is valid.
 *
 * - **Untrusted input.** `parseReviewDraft` is the boundary between a producer (a model, a Shortcut, the network) and
 *   the domain: exact keys, exact types, nothing invented, nothing defaulted. An unknown value is `null`, never zero.
 * - **Gaps.** `reviewGaps` names what still stops a write (`ReviewGap`). Missing data stays a gap: a missing currency is
 *   never the person's default currency, an instalment count is never 12 or any other number the producer left out, and
 *   a destination is never guessed (this module receives account ids; it never matches a name).
 * - **Destinations.** The accounts a movement of that kind may post to (`postingAccountsFor`): a live cash account or an
 *   active card for an expense, a live cash account for an income; never a debt or receivable, never a deleted account,
 *   never an archived or deleted card. A card destination carries a purchase mode: «Una vez» (one expense on the card,
 *   decision 003 rule 2) or cuotas (one `InstallmentPlan`, rule 7, its count chosen by the person).
 * - **Currency.** The draft's currency must be the destination's. Nothing is converted and no rate is looked up: a
 *   purchase in another currency waits for the foreign-purchase subflow (24C2), so a mismatch is a `currency` gap.
 * - **Basis.** The versions of what the proposal was reviewed against (`reviewBasis`): the destination account, its card,
 *   and the category's stored definition. `isStaleReviewDraft` says when any of them changed or was never recorded; a
 *   stale draft never writes.
 * - **Exactly one write.** `writeForReviewDraft` returns one `Entry` or one `InstallmentPlan` (never both for one purchase:
 *   a plan recognises its principal instalment by instalment and records nothing on the purchase date), built by the
 *   same domain builders and guards a form uses, with the id the caller fixed (`REVIEW_WRITE_ID`). The same draft,
 *   archive and options always give a deep-equal write, so a retry under the same id is an idempotent create.
 *
 * First version: expense and income. Transfers, devoluciones and edits arrive in later 25A slices as new kinds, without
 * changing these. Pure: no storage, no clock, no randomness, no import from outside this package. */

export const REVIEW_DRAFT_VERSION = 1;
export const REVIEW_SOURCES = ['assistant', 'wallet', 'inbox', 'fixture'] as const;
export type ReviewSource = typeof REVIEW_SOURCES[number];
export const REVIEW_KINDS = ['expense', 'income'] as const;
export type ReviewKind = typeof REVIEW_KINDS[number];

/** How a purchase on a card is recorded. Only a card destination carries one. «Una vez» is the plain purchase; cuotas are
 * one plan whose count (2 to 120) is the person's own choice (`null` until chosen: no default exists in the domain) and whose first
 * instalment lands on the current or the next statement. Financing (interest, fees, taxes) is not part of a draft yet:
 * a plan from a draft has none, and a financed purchase is recorded through the purchase form. */
export type ReviewPurchase = { mode: 'once' } | { mode: 'installments'; count: number | null; placement: StatementPlacement };

/** One thing the proposal was reviewed against, at the version it had then. A category's version is its stored
 * definition's; a category without a definition (a preset or a historical spelling) has nothing that can change. */
export type ReviewBasis =
  | { kind: 'account'; id: string; revision: number }
  | { kind: 'card'; id: string; revision: number }
  | { kind: 'category'; entryKind: EntryKind; key: string; revision: number };

export interface ReviewDraft {
  version: 1;
  source: ReviewSource;
  /** When the producer captured the proposal (an ISO 8601 UTC timestamp). Informative: never the movement's date. */
  capturedAt: string;
  kind: ReviewKind | null;
  /** Integer minor units of `currency`, > 0. Meaningless without a currency, which fixes its scale. */
  amountMinor: number | null;
  currency: Currency | null;
  merchant: string | null;
  /** The category as written (a stored label or a spelling of one); resolved to its identity's stored label on write. */
  category: string | null;
  dateISO: string | null;
  /** The account the movement posts to: a cash account, or a card's hidden account. An id, never a name. */
  destinationId: string | null;
  purchase: ReviewPurchase | null;
  basis: ReviewBasis[];
}

/** What still stops a write, in this order:
 * - `kind`: gasto or ingreso not chosen;
 * - `amount`: no amount;
 * - `currency`: no currency, or one that is not the destination's;
 * - `destination`: no destination, or one that is not (or no longer) offered for this kind;
 * - `purchase`: a card without a purchase mode, or a purchase mode on something that is not a card;
 * - `installmentCount`: cuotas without a count, or more instalments than minor units;
 * - `merchant`, `category`, `date`: missing; a category that is archived or that the person has never used; a date
 *   after today (a movement is never recorded in the future). */
export const REVIEW_GAPS = ['kind', 'amount', 'currency', 'destination', 'purchase', 'installmentCount', 'merchant', 'category', 'date'] as const;
export type ReviewGap = typeof REVIEW_GAPS[number];

/** What a draft needs from the ledger: its accounts and records, and the card, debt, category, plan and statement rows. */
export type ReviewArchive = Pick<LedgerArchive, 'accounts' | 'records' | 'cards' | 'debts' | 'categories' | 'installmentPlans' | 'cardCycleDates'>;

/** The one write a complete draft produces. */
export type ReviewWrite = { type: 'entry'; entry: Entry } | { type: 'plan'; plan: InstallmentPlan };

/** The id a caller fixes for a draft's write before the first attempt and reuses on every retry. Letters, digits and
 * hyphens, up to 70: valid as a movement id, a plan id and an operation id at once (a UUID fits), and never one of the
 * derived ids (an instalment's `inst_…`, a recurring occurrence's `rec_…`, an operation's `…_p` lines all hold `_`). */
export const REVIEW_WRITE_ID = /^[A-Za-z0-9-]{1,70}$/;

export const REVIEW_DRAFT_INVALID_MESSAGE = 'La propuesta tiene datos inválidos. No se registró nada.';
export const REVIEW_INCOMPLETE_MESSAGE = 'Completá la propuesta antes de confirmarla. No se registró nada.';
export const REVIEW_STALE_MESSAGE = 'La cuenta, la tarjeta o la categoría cambió desde la propuesta. Revisala de nuevo.';
export const REVIEW_DESTINATION_MESSAGE = 'Elegí una cuenta o tarjeta disponible para este movimiento.';
export const REVIEW_WRITE_ID_MESSAGE = 'Identificador de propuesta inválido.';

const DRAFT_KEYS = ['version', 'source', 'capturedAt', 'kind', 'amountMinor', 'currency', 'merchant', 'category', 'dateISO',
  'destinationId', 'purchase', 'basis'] as const;
const MAX_BASIS = 16;
/** Cuotas are two or more, as in the purchase form: a single payment is «Una vez», never a one-instalment plan. */
export const MIN_REVIEW_INSTALLMENTS = 2;
const MAX_MERCHANT = 120;
const MAX_CATEGORY = 60;
/** A category key is its label folded (`categoryKey`): decomposition may lengthen it (a Hangul syllable becomes up to three
 * jamo), so a key's bound is wider than the label's. */
const MAX_CATEGORY_KEY = MAX_CATEGORY * 4;
/** Controls and invisible formatting that can disguise a name: C0/C1 controls, the zero-width space, line and paragraph
 * separators, bidirectional embeddings, overrides and isolates, invisible operators, the BOM and interlinear annotations.
 * Joiners (ZWJ in emoji, ZWNJ in Persian or Indic text), directional marks and soft hyphens are ordinary text and pass. */
const HIDDEN_CHARACTERS = /[\u0000-\u001f\u007f-\u009f\u200b\u2028-\u202e\u2060-\u2064\u2066-\u2069\ufeff\ufff9-\ufffb]/;
const TIMESTAMP = /^(\d{4}-\d{2}-\d{2})T([01]\d|2[0-3]):([0-5]\d):([0-5]\d)(?:\.\d{1,3})?Z$/;
const ACCOUNT_ID = /^[a-zA-Z0-9_-]{1,100}$/;

function invalid(): never {
  throw new Error(REVIEW_DRAFT_INVALID_MESSAGE);
}
/** A plain JSON-like object with exactly these own keys. */
function exactObject(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid();
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) invalid();
  const own = Reflect.ownKeys(value);
  if (own.length !== keys.length || keys.some(key => !Object.hasOwn(value, key))) invalid();
  return value as Record<string, unknown>;
}
/** An ISO 8601 UTC timestamp whose calendar day exists (`Date.parse` alone rolls 30 February over into March). */
function timestamp(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = TIMESTAMP.exec(value);
  return !!match && validDateISO(match[1]) && Number.isFinite(Date.parse(value));
}
/** A name as a person reads it: trimmed, non-empty, bounded, with no hidden characters. */
function name(value: unknown, max: number): string | null {
  if (value === null) return null;
  if (typeof value !== 'string' || !value || value.length > max || value !== value.trim() || HIDDEN_CHARACTERS.test(value)) invalid();
  return value;
}
function revision(value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) invalid();
  return value as number;
}
function purchaseValue(value: unknown): ReviewPurchase | null {
  if (value === null) return null;
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid();
  const mode = (value as { mode?: unknown }).mode;
  if (mode === 'once') {
    exactObject(value, ['mode']);
    return { mode: 'once' };
  }
  if (mode !== 'installments') invalid();
  const row = exactObject(value, ['mode', 'count', 'placement']);
  const count = row.count;
  if (count !== null && (!Number.isSafeInteger(count) || (count as number) < MIN_REVIEW_INSTALLMENTS || (count as number) > MAX_INSTALLMENTS)) invalid();
  if (row.placement !== 'current' && row.placement !== 'next') invalid();
  return { mode: 'installments', count: count as number | null, placement: row.placement };
}
function basisValue(value: unknown): ReviewBasis {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid();
  const kind = (value as { kind?: unknown }).kind;
  if (kind === 'account' || kind === 'card') {
    const row = exactObject(value, ['kind', 'id', 'revision']);
    if (typeof row.id !== 'string' || !ACCOUNT_ID.test(row.id)) invalid();
    return { kind, id: row.id, revision: revision(row.revision) };
  }
  if (kind !== 'category') invalid();
  const row = exactObject(value, ['kind', 'entryKind', 'key', 'revision']);
  if (row.entryKind !== 'expense' && row.entryKind !== 'income') invalid();
  if (typeof row.key !== 'string' || !row.key || row.key.length > MAX_CATEGORY_KEY || row.key !== categoryKey(row.key) || HIDDEN_CHARACTERS.test(row.key)) invalid();
  return { kind, entryKind: row.entryKind, key: row.key, revision: revision(row.revision) };
}
const basisIdentity = (item: ReviewBasis) => item.kind === 'category' ? `category|${item.entryKind}|${item.key}` : `${item.kind}|${item.id}`;

/** Reads an untrusted proposal. Refuses (with one message, revealing nothing) any unknown or missing key, any value of
 * the wrong type, an amount that is not a positive integer within the entry range, a code that is not a storable ISO
 * currency, a malformed date or timestamp, an unknown source or kind, a malformed purchase or basis, and a purchase on
 * an income. Missing data stays `null`; nothing is defaulted, trimmed or converted. Returns a fresh copy. */
export function parseReviewDraft(value: unknown): ReviewDraft {
  const row = exactObject(value, DRAFT_KEYS);
  if (row.version !== REVIEW_DRAFT_VERSION) invalid();
  if (typeof row.source !== 'string' || !(REVIEW_SOURCES as readonly string[]).includes(row.source)) invalid();
  if (!timestamp(row.capturedAt)) invalid();
  if (row.kind !== null && (typeof row.kind !== 'string' || !(REVIEW_KINDS as readonly string[]).includes(row.kind))) invalid();
  if (row.amountMinor !== null && (!isEntryMinor(row.amountMinor) || (row.amountMinor as number) <= 0)) invalid();
  if (row.currency !== null && !isStorableCurrency(row.currency)) invalid();
  if (row.dateISO !== null && (typeof row.dateISO !== 'string' || !validDateISO(row.dateISO))) invalid();
  if (row.destinationId !== null && (typeof row.destinationId !== 'string' || !ACCOUNT_ID.test(row.destinationId))) invalid();
  const purchase = purchaseValue(row.purchase);
  if (purchase !== null && row.kind === 'income') invalid();
  if (!Array.isArray(row.basis) || row.basis.length > MAX_BASIS) invalid();
  const basis = Array.from(row.basis as unknown[], basisValue); // a hole reads as undefined and is refused
  if (new Set(basis.map(basisIdentity)).size !== basis.length) invalid();
  return {
    version: REVIEW_DRAFT_VERSION, source: row.source as ReviewSource, capturedAt: row.capturedAt, kind: row.kind as ReviewKind | null,
    amountMinor: row.amountMinor as number | null, currency: row.currency as Currency | null,
    merchant: name(row.merchant, MAX_MERCHANT), category: name(row.category, MAX_CATEGORY), dateISO: row.dateISO as string | null,
    destinationId: row.destinationId as string | null, purchase, basis,
  };
}

/** The accounts a movement of this kind may post to now: live cash accounts, plus active cards for an expense. Never a
 * debt or receivable, a deleted account, or an archived or deleted card. */
export function reviewDestinations(kind: ReviewKind, archive: ReviewArchive): Account[] {
  return postingAccountsFor(kind, archive.accounts, archive.cards ?? [], archive.debts ?? []);
}

function destinationOf(draft: Pick<ReviewDraft, 'kind' | 'destinationId'>, archive: ReviewArchive): Account | null {
  if (draft.destinationId === null) return null;
  // With the kind still open, the widest set (an expense's) decides; the income rules apply once it is chosen.
  return reviewDestinations(draft.kind ?? 'expense', archive).find(account => account.id === draft.destinationId) ?? null;
}
function cardOf(accountId: string, archive: ReviewArchive) {
  return (archive.cards ?? []).find(card => card.accountId === accountId) ?? null;
}

/** Whether the category is one the person already has for this kind: a built-in one, one with a stored definition, or a
 * spelling a live movement or plan already uses; never an archived one. A producer never creates a category: a new
 * name is the person's to type, in the form. */
function knownCategory(kind: ReviewKind, category: string, archive: ReviewArchive): boolean {
  const identity = resolveCategory(kind, category, archive.categories ?? []);
  if (!identity.key || identity.archived) return false;
  if (identity.source !== 'historical') return true;
  return archive.records.some(record => !record.voided && record.entry.kind === kind && categoryKey(record.entry.category) === identity.key)
    || (kind === 'expense' && (archive.installmentPlans ?? []).some(plan => !plan.deleted && categoryKey(plan.category) === identity.key));
}

/** What still stops this draft from writing (see `ReviewGap`), in `REVIEW_GAPS` order; empty when it may be confirmed.
 * `todayISO` is the person's local date: a later date is a gap. */
export function reviewGaps(draft: ReviewDraft, archive: ReviewArchive, todayISO: string): ReviewGap[] {
  if (!validDateISO(todayISO)) throw new Error('Fecha de procesamiento inválida.');
  const gaps = new Set<ReviewGap>();
  const destination = destinationOf(draft, archive);
  const card = destination && cardOf(destination.id, archive);
  if (draft.kind === null) gaps.add('kind');
  if (draft.amountMinor === null) gaps.add('amount');
  if (draft.currency === null || (destination && destination.currency !== draft.currency)) gaps.add('currency');
  if (!destination) gaps.add('destination');
  else if (card ? draft.purchase === null : draft.purchase !== null) gaps.add('purchase');
  if (draft.purchase?.mode === 'installments'
    && (draft.purchase.count === null || (draft.amountMinor !== null && draft.amountMinor < draft.purchase.count))) gaps.add('installmentCount');
  if (draft.merchant === null) gaps.add('merchant');
  if (draft.category === null || (draft.kind !== null && !knownCategory(draft.kind, draft.category, archive))) gaps.add('category');
  if (draft.dateISO === null || draft.dateISO > todayISO) gaps.add('date');
  return REVIEW_GAPS.filter(gap => gaps.has(gap));
}

/** The versions the draft depends on now: its destination account, that account's card, and its category's stored
 * definition, each present only when it exists. Deterministic order. */
export function reviewBasis(draft: Pick<ReviewDraft, 'kind' | 'destinationId' | 'category'>, archive: ReviewArchive): ReviewBasis[] {
  const basis: ReviewBasis[] = [];
  const account = draft.destinationId === null ? undefined : archive.accounts.find(item => item.id === draft.destinationId);
  if (account) {
    basis.push({ kind: 'account', id: account.id, revision: account.revision ?? 0 });
    const card = cardOf(account.id, archive);
    if (card) basis.push({ kind: 'card', id: card.id, revision: card.revision });
  }
  if (draft.kind !== null && draft.category !== null) {
    const definition = findCategoryDefinition(draft.kind, categoryKey(draft.category), archive.categories ?? []);
    if (definition) basis.push({ kind: 'category', entryKind: definition.kind, key: definition.key, revision: definition.revision });
  }
  return basis;
}

/** Whether what the draft was reviewed against changed: an item of its basis is gone, deleted or at another revision, or
 * the current destination, card or category definition is missing from it (never reviewed). A stale draft is shown
 * again; it never writes. */
export function isStaleReviewDraft(draft: ReviewDraft, archive: ReviewArchive): boolean {
  const current = reviewBasis(draft, archive);
  const recorded = new Map(draft.basis.map(item => [basisIdentity(item), item.revision]));
  if (current.some(item => recorded.get(basisIdentity(item)) !== item.revision)) return true;
  return draft.basis.some(item => {
    if (item.kind === 'account') {
      const account = archive.accounts.find(row => row.id === item.id);
      return !account || !isLiveAccount(account) || (account.revision ?? 0) !== item.revision;
    }
    if (item.kind === 'card') {
      const card = (archive.cards ?? []).find(row => row.id === item.id);
      return !card || card.deleted || card.revision !== item.revision;
    }
    const definition = findCategoryDefinition(item.entryKind, item.key, archive.categories ?? []);
    return !definition || definition.revision !== item.revision;
  });
}

/** The draft with `destinationId` chosen (by the person, or from an explicit mapping), re-based on it. The destination
 * must be offered for the draft's kind (an expense's when the kind is open). A card gets «Una vez» unless it already
 * had a purchase mode; any other account has none. The currency is left as it is: a mismatch stays a gap. */
export function withDestination(draft: ReviewDraft, destinationId: string, archive: ReviewArchive): ReviewDraft {
  const checked = parseReviewDraft(draft);
  const destination = destinationOf({ kind: checked.kind, destinationId }, archive);
  if (!destination) throw new Error(REVIEW_DESTINATION_MESSAGE);
  const purchase: ReviewPurchase | null = cardOf(destination.id, archive) ? checked.purchase ?? { mode: 'once' } : null;
  const next = { ...checked, destinationId: destination.id, purchase };
  const kept = checked.basis.filter(item => item.kind === 'category');
  return { ...next, basis: [...reviewBasis({ ...next, category: null }, archive), ...kept] };
}

/** The one write a complete, current draft produces, with the caller's fixed `writeId` and `createdAt`. Refuses an
 * invalid draft or id, any gap, and a stale basis; then builds with the domain's own builders and guards:
 * - a cash account, or a card in «Una vez»: one `Entry` (`id` = `writeId`) on that account, the category written as its
 *   identity's stored label;
 * - a card in cuotas: one `InstallmentPlan` (`id` = `writeId`) from `newInstallmentPlan`: principal = the amount, the
 *   person's count and placement, the card's calendar, no financing, and no movement on the purchase date.
 * Deterministic: the same draft, archive and options give a deep-equal write. */
export function writeForReviewDraft(draft: ReviewDraft, archive: ReviewArchive, options: { writeId: string; createdAt: string; todayISO: string }): ReviewWrite {
  const checked = parseReviewDraft(draft);
  if (typeof options.writeId !== 'string' || !REVIEW_WRITE_ID.test(options.writeId)) throw new Error(REVIEW_WRITE_ID_MESSAGE);
  if (!timestamp(options.createdAt)) throw new Error('Fecha de creación inválida.');
  if (reviewGaps(checked, archive, options.todayISO).length) throw new Error(REVIEW_INCOMPLETE_MESSAGE);
  if (isStaleReviewDraft(checked, archive)) throw new Error(REVIEW_STALE_MESSAGE);
  // After the gaps: kind, amount, currency, merchant, category and date are present, the destination is offered.
  const kind = checked.kind!, account = destinationOf(checked, archive)!;
  const card = cardOf(account.id, archive);
  const category = resolveCategory(kind, checked.category!, archive.categories ?? []).storedLabel;
  if (card && checked.purchase?.mode === 'installments') {
    const plan = newInstallmentPlan({
      id: options.writeId, card, cardAccount: account, merchant: checked.merchant!, category, purchaseDateISO: checked.dateISO!,
      principalMinor: checked.amountMinor!, count: checked.purchase.count!, placement: checked.purchase.placement,
      createdAt: options.createdAt, cycleDates: archive.cardCycleDates ?? [],
    });
    return { type: 'plan', plan };
  }
  const entry: Entry = { id: options.writeId, accountId: account.id, kind, amountMinor: checked.amountMinor!, merchant: checked.merchant!,
    category, dateISO: checked.dateISO!, createdAt: options.createdAt };
  // The guards `createEntry` runs on the movement itself, so a draft is refused here, never first in storage. Whether the
  // id is already taken (the same write retried, or another record) is storage's to answer, in its own transaction.
  validateEntry(entry, archive.accounts);
  assertNewEntryId(entry.id);
  assertPostingAccount(entry.accountId, archive.debts ?? []);
  assertOpenAccount(entry.accountId, archive.accounts, archive.cards ?? [], archive.debts ?? []);
  if (kind === 'income') assertIncomeAccount(entry.accountId, archive.cards ?? [], archive.debts ?? []);
  else assertAcceptsNewObligation(entry.accountId, archive.cards ?? []);
  return { type: 'entry', entry };
}
