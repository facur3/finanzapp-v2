import { parseReviewDraft, reviewBasis, withDestination, type ReviewArchive, type ReviewDraft } from '@finanzapp/domain';
import type { AssistantCapture, ProposalContent, ResolvedDraft } from './conversation.ts';

/** Producto 25A-04: the one adapter from the Assistant's resolved draft to the canonical review draft (25A-01), so every
 * Assistant proposal is captured into «Para revisar» and confirmed there, through the review store's one write path.
 *
 * It keeps what the conversation established and nothing more:
 * - kind, amount, merchant and category as resolved (an empty merchant or category is missing, `null`);
 * - the currency and the date only when the model stated them (`currencyStated`, `dateStated`): the screen's currency
 *   and today are conversation conveniences, never captured as facts;
 * - the destination only when the person named it or it was the one account that fits; a card gets the domain's own
 *   choice, «Una vez» (`withDestination`), never cuotas; a destination the domain does not offer for the kind (an income
 *   on a card) is left unchosen, a gap;
 * - the basis from `reviewBasis` on the ledger it was reviewed against; the source is `assistant`.
 * A value the review draft cannot hold (a merchant over its length, a hidden character) is missing, never cut or
 * cleaned. Pure: no React, no storage, no randomness (the caller fixes the ids). */

/** A value that a review draft accepts in that field, or null. */
function accepted<K extends 'merchant' | 'category' | 'amountMinor'>(field: K, value: ReviewDraft[K], template: ReviewDraft): ReviewDraft[K] | null {
  if (value === null) return null;
  try { parseReviewDraft({ ...template, [field]: value }); return value; } catch { return null; }
}

export function reviewDraftFromAssistant(draft: ResolvedDraft, archive: ReviewArchive, capturedAt: string): ReviewDraft {
  const template: ReviewDraft = { version: 1, source: 'assistant', capturedAt, kind: draft.kind, amountMinor: null, currency: null, merchant: null,
    category: null, dateISO: null, destinationId: null, purchase: null, basis: [] };
  const base: ReviewDraft = {
    ...template,
    amountMinor: accepted('amountMinor', draft.amountMinor, template),
    currency: draft.currencyStated === false ? null : draft.currency,
    merchant: accepted('merchant', draft.merchant.trim() || null, template),
    category: accepted('category', draft.category.trim() || null, template),
    dateISO: draft.dateStated === false ? null : draft.dateISO,
  };
  let placed = base;
  if (draft.accountId) {
    try { placed = withDestination(base, draft.accountId, archive); } catch { placed = base; } // Not offered for this kind: a gap.
  }
  return parseReviewDraft({ ...placed, basis: reviewBasis(placed, archive) });
}

/** The frozen capture of one proposal: the caller's two fresh ids, a capture key naming this producer and item (so a
 * repeat of the same capture is recognised by the store and nothing else is), and the review draft. */
export function assistantCapture(draft: ResolvedDraft, archive: ReviewArchive, ids: { id: string; writeId: string }, at: string): AssistantCapture {
  return { id: ids.id, writeId: ids.writeId, captureKey: 'assistant:' + ids.id, at, draft: reviewDraftFromAssistant(draft, archive, at) };
}

/** The proposal a resolved draft becomes in the thread: captured next (`capturing`), or a preview in the fixture view,
 * which never reaches the review file. */
export function proposalContent(capture: AssistantCapture, preview: boolean): ProposalContent {
  return { kind: 'proposal', capture, status: preview ? 'preview' : 'capturing' };
}
