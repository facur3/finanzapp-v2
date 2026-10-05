import { isStaleReviewDraft, parseReviewDraft, reviewBasis, reviewDestinations, reviewGaps, type Account, type CreditCardProfile, type Currency,
  type ReviewArchive, type ReviewDraft, type ReviewGap, type ReviewKind, type ReviewPurchase } from '@finanzapp/domain';
import type { ReviewItem } from '../storage/review-database.ts';

/** Producto 25A-03: «Para revisar» as data, so the tray, the detail, the editor and the tests read one derivation. Every
 * judgement is the domain's (25A-01: `reviewGaps`, `isStaleReviewDraft`) or the store's (25A-02: the frozen write, a
 * reconciliation conflict); this module only names it for the screens. Pure: no React, Node-loadable (`.ts` imports). */

/** What a row and the detail say first, in this order of precedence:
 * - `conflict`: the ledger already holds this item's write id with other content (reconciliation); nothing can be confirmed;
 * - `interrupted`: a write was frozen and its outcome is unknown; Confirmar retries exactly that write (or finds it saved);
 * - `incomplete`: the domain names gaps;
 * - `stale`: the account, card or category changed since the draft was reviewed;
 * - `ready`: complete and current. */
export type ReviewState = 'conflict' | 'interrupted' | 'incomplete' | 'stale' | 'ready';

export interface ReviewFacts {
  kind: ReviewKind | null;
  /** Both or neither: an amount without its currency has no scale, so it is shown as missing. */
  amount: { minor: number; currency: Currency } | null;
  merchant: string | null;
  category: string | null;
  dateISO: string | null;
  /** The account the draft names, whatever its state now (a deleted one still has its name); null when it names none or
   * an id the ledger does not know. Whether it is still offered is the `destination` gap. */
  destination: Account | null;
  /** The card behind that account, when it is a card's. */
  card: CreditCardProfile | null;
  purchase: ReviewPurchase | null;
  gaps: ReviewGap[];
  stale: boolean;
  state: ReviewState;
  /** Confirmar may be offered: the store is writable, there is no conflict, and the draft is complete and current (or an
   * interrupted write waits, which the store re-checks against the ledger before anything else). */
  canConfirm: boolean;
}

export interface ReviewContext { todayISO: string; writable: boolean; conflicts: readonly string[] }

export function reviewFacts(item: ReviewItem, archive: ReviewArchive, context: ReviewContext): ReviewFacts {
  const { draft } = item;
  const gaps = reviewGaps(draft, archive, context.todayISO);
  const stale = isStaleReviewDraft(draft, archive);
  const conflict = context.conflicts.includes(item.id);
  const interrupted = item.attempt !== null;
  const destination = draft.destinationId === null ? null : archive.accounts.find(account => account.id === draft.destinationId) ?? null;
  const card = destination ? (archive.cards ?? []).find(row => row.accountId === destination.id) ?? null : null;
  const state: ReviewState = conflict ? 'conflict' : interrupted ? 'interrupted' : gaps.length ? 'incomplete' : stale ? 'stale' : 'ready';
  return {
    kind: draft.kind,
    amount: draft.amountMinor !== null && draft.currency !== null ? { minor: draft.amountMinor, currency: draft.currency } : null,
    merchant: draft.merchant, category: draft.category, dateISO: draft.dateISO, destination, card, purchase: draft.purchase,
    gaps, stale, state,
    canConfirm: context.writable && !conflict && (interrupted || (!gaps.length && !stale)),
  };
}

/** The tone of a state's line: neutral while something is merely missing (an incomplete draft is not an error), amber when
 * the person must look again, the negative tone only for a conflict the ledger reports. Never lime: lime is Confirmar. */
export function stateTone(state: ReviewState): 'neutral' | 'warning' | 'expense' {
  return state === 'conflict' ? 'expense' : state === 'stale' || state === 'interrupted' ? 'warning' : 'neutral';
}

/** What the editor changes. Every field is the person's: nothing here fills one in. */
export interface ReviewEdit {
  kind: ReviewKind | null;
  amountMinor: number | null;
  currency: Currency | null;
  merchant: string | null;
  category: string | null;
  dateISO: string | null;
  destinationId: string | null;
  purchase: ReviewPurchase | null;
}

/** The draft the editor saves: the person's fields over the item's own source and capture time, re-based on the ledger
 * the person just reviewed it against (`reviewBasis`), and parsed strictly. A purchase mode only stays on an expense
 * paid with a card: on an income or a cash account it is dropped (never turned into cuotas), since the domain refuses it
 * there. An empty merchant or category is missing, never an empty string. */
export function editedReviewDraft(draft: ReviewDraft, edit: ReviewEdit, archive: ReviewArchive): ReviewDraft {
  const onCard = edit.destinationId !== null && (archive.cards ?? []).some(card => card.accountId === edit.destinationId);
  const purchase = edit.kind === 'income' || !onCard ? null : edit.purchase;
  const text = (value: string | null) => value === null || !value.trim() ? null : value.trim();
  const next = { ...draft, ...edit, merchant: text(edit.merchant), category: text(edit.category), purchase };
  return parseReviewDraft({ ...next, basis: reviewBasis(next, archive) });
}

/** The destinations the editor offers: those the domain allows for the kind (an expense's while the kind is open), in the
 * draft's currency when it has one (a producer's currency is never reinterpreted: a mismatch stays a gap). */
export function editorDestinations(kind: ReviewKind | null, currency: Currency | null, archive: ReviewArchive): Account[] {
  return reviewDestinations(kind ?? 'expense', archive).filter(account => currency === null || account.currency === currency);
}
