import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as domain from '@finanzapp/domain';
import type { Account, CreditCardProfile, ReviewArchive } from '@finanzapp/domain';
import type { ResolvedDraft } from '../src/assistant/conversation.ts';
import { completeDraft, resolveDraft } from '../src/assistant/conversation.ts';
import { assistantCapture, proposalContent, reviewDraftFromAssistant } from '../src/assistant/review-proposal.ts';
import { FIXTURE_DRAFT } from '../src/assistant/fixtures.ts';
import { createCreditCard, readArchive } from '../src/storage/database.ts';
import { openReviewStore } from '../src/storage/review-database.ts';
import { reviewFiles } from './review-sqlite.ts';

// Producto 25A-04: the Assistant → review draft adapter, and its capture on real SQLite (disposable files, synthetic
// accounts only). The screen's use of it is in tests/assistant-routes.node.ts.
const createdAt = '2026-09-01T12:00:00.000Z';
const at = '2026-09-21T10:00:00.000Z';
/** The device's local day at capture (the capture rule's "today"). */
const day = '2026-09-21';
const cash: Account = { id: 'cash', name: 'Efectivo', currency: 'ARS', openingMinor: 500000, createdAt };
const cardAccount: Account = { id: 'visa-acc', name: 'Visa', currency: 'ARS', openingMinor: 0, createdAt };
const card: CreditCardProfile = { id: 'visa', accountId: cardAccount.id, issuer: 'Banco', last4: '4009', creditLimitMinor: 1000000, closingDay: 20, dueDay: 5,
  active: true, deleted: false, createdAt, revision: 0, updatedAt: createdAt };
const archive: ReviewArchive = { accounts: [cash, cardAccount], records: [], cards: [card], debts: [], categories: [] };
const resolved = (change: Partial<ResolvedDraft> = {}): ResolvedDraft => ({ kind: 'expense', amountMinor: 1850000, currency: 'ARS', merchant: 'Carrefour',
  category: 'Supermercado', dateISO: '2026-09-21', accountId: 'cash', currencyStated: true, dateStated: true, ...change });

test('every fact the conversation established maps to the review draft, the source is assistant and the basis is the domain\'s', () => {
  const draft = reviewDraftFromAssistant(resolved(), archive, at, day);
  assert.deepEqual(draft, domain.parseReviewDraft(draft), 'a canonical, strictly parsed review draft');
  assert.deepEqual([draft.version, draft.source, draft.capturedAt, draft.kind, draft.amountMinor, draft.currency, draft.merchant, draft.category, draft.dateISO,
    draft.destinationId, draft.purchase], [1, 'assistant', at, 'expense', 1850000, 'ARS', 'Carrefour', 'Supermercado', '2026-09-21', 'cash', null]);
  assert.equal(JSON.stringify(draft.basis), JSON.stringify(domain.reviewBasis(draft, archive)));
  assert.deepEqual(domain.reviewGaps(draft, archive, '2026-09-21'), []);
  assert.equal(domain.isStaleReviewDraft(draft, archive), false);
});

test('nothing is invented: an unstated currency, an unchosen account and an empty merchant or category stay unknown', () => {
  const draft = reviewDraftFromAssistant(resolved({ currencyStated: false, accountId: null, merchant: '  ', category: '' }), archive, at, day);
  assert.deepEqual([draft.currency, draft.destinationId, draft.merchant, draft.category, draft.purchase], [null, null, null, null, null]);
  assert.deepEqual(domain.reviewGaps(draft, archive, day), ['currency', 'destination', 'merchant', 'category']);
  // What the model said and the device completed: resolveDraft marks the currency unstated but inferred (decision D, 25A-06:
  // every destination offered for the kind is in ARS), so it is captured, visible and editable; the destination is implied.
  const fromModel = resolveDraft({ ...FIXTURE_DRAFT.proposals[0], currency: null, dateISO: null, paymentMethodRef: null }, [cash], [], 'USD', '2026-09-20');
  assert.equal(fromModel.kind, 'draft');
  assert.deepEqual([fromModel.kind === 'draft' && fromModel.draft.currencyStated, fromModel.kind === 'draft' && fromModel.draft.currencyInferred], [false, true]);
  const mapped = reviewDraftFromAssistant(fromModel.kind === 'draft' ? fromModel.draft : null!, archive, at, day);
  assert.deepEqual([mapped.currency, mapped.destinationId], ['ARS', 'cash'],
    'the one currency the accounts hold is inferred and captured; the screen\'s USD is never captured');
  // With accounts in two currencies and nothing named, nothing is inferred: the currency is asked, and a draft parked
  // behind that question captures no currency.
  const usd: Account = { id: 'usd', name: 'Dólares', currency: 'USD', openingMinor: 0, createdAt };
  const asked = resolveDraft({ ...FIXTURE_DRAFT.proposals[0], currency: null, dateISO: null, paymentMethodRef: null }, [cash, usd], [], 'ARS', '2026-09-20');
  assert.equal(asked.kind === 'clarification' && asked.field, 'currency');
  assert.equal(asked.kind === 'clarification' && asked.partial.currencyInferred, false);
  // A value a review draft cannot hold is missing, never cut: a merchant over 120 characters, a hidden character.
  assert.equal(reviewDraftFromAssistant(resolved({ merchant: 'x'.repeat(121) }), archive, at, day).merchant, null);
  assert.equal(reviewDraftFromAssistant(resolved({ category: 'Super​mercado' }), archive, at, day).category, null);
  assert.equal(reviewDraftFromAssistant(resolved({ merchant: '  Coto  ' }), archive, at, day).merchant, 'Coto', 'surrounding spaces are not content');
});

test('the capture date rule: an Assistant record command with no date happens today (the local day at capture); a stated or resolved date wins', () => {
  // «Gasté 10 mil pesos en el supermercado»: no date → the device's local day at capture, not the conversation's day.
  // No destination named: the one cash account is implied (a named «Visa» would be asked, 25A-04).
  const fromModel = resolveDraft({ ...FIXTURE_DRAFT.proposals[0], dateISO: null, paymentMethodRef: null }, [cash], [], 'ARS', '2026-09-20');
  const omitted = reviewDraftFromAssistant(fromModel.kind === 'draft' ? fromModel.draft : null!, archive, at, day);
  assert.equal(omitted.dateISO, day, 'captured on 21/09 after a conversation that started on 20/09: today at capture');
  assert.equal(domain.reviewGaps(omitted, archive, day).includes('date'), false, 'an explicit day is stored: no date gap');
  // «Gasté ayer…» (the model resolves «ayer») and «el 2 de octubre…»: the stated day, never replaced.
  for (const stated of ['2026-09-20', '2026-09-02']) {
    const draft = resolveDraft({ ...FIXTURE_DRAFT.proposals[0], dateISO: stated, paymentMethodRef: null }, [cash], [], 'ARS', '2026-09-21');
    assert.equal(reviewDraftFromAssistant(draft.kind === 'draft' ? draft.draft : null!, archive, at, day).dateISO, stated);
  }
  // A stated date after today is kept as stated, and the domain makes it a gap (never recorded in the future).
  const future = reviewDraftFromAssistant(resolved({ dateISO: '2026-12-01' }), archive, at, day);
  assert.equal(future.dateISO, '2026-12-01');
  assert.ok(domain.reviewGaps(future, archive, day).includes('date'));
});

test('currency: a stated currency is kept; with none stated, a destination the person named or chose lends its own; an implied one does not', () => {
  const usdAccount: Account = { id: 'usd', name: 'Dólares', currency: 'USD', openingMinor: 0, createdAt };
  const withUsd: ReviewArchive = { ...archive, accounts: [cash, cardAccount, usdAccount] };
  // Named («con la Visa»): the card's ARS.
  const named = resolveDraft({ ...FIXTURE_DRAFT.proposals[0], currency: null, paymentMethodRef: 'Visa' }, [cash, cardAccount], [], 'ARS', day);
  assert.equal(named.kind === 'draft' && named.draft.destinationStated, true);
  assert.equal(reviewDraftFromAssistant(named.kind === 'draft' ? named.draft : null!, archive, at, day).currency, 'ARS');
  // Chosen in a clarification (two accounts fit): that account's currency.
  const asked = resolveDraft({ ...FIXTURE_DRAFT.proposals[0], currency: null, paymentMethodRef: null }, [cash, cardAccount], [], 'ARS', day);
  assert.equal(asked.kind, 'clarification');
  const chosen = completeDraft(asked.kind === 'clarification' ? { draft: asked.partial, field: asked.field } : null!, 'cash', [cash, cardAccount], [], day);
  assert.equal(chosen.content.kind === 'draft' && chosen.content.draft.destinationStated, true);
  assert.equal(reviewDraftFromAssistant(chosen.content.kind === 'draft' ? chosen.content.draft : null!, archive, at, day).currency, 'ARS');
  // Implied destination (the only account): since decision D (25A-06) its currency is the one every destination shares,
  // inferred and captured; the destination itself stays implied, not stated.
  const implied = resolveDraft({ ...FIXTURE_DRAFT.proposals[0], currency: null, paymentMethodRef: null }, [cash], [], 'ARS', day);
  assert.equal(implied.kind === 'draft' && implied.draft.destinationStated, false);
  assert.equal(implied.kind === 'draft' && implied.draft.currencyInferred, true);
  assert.equal(reviewDraftFromAssistant(implied.kind === 'draft' ? implied.draft : null!, archive, at, day).currency, 'ARS');
  // A draft the conversation never resolved a currency for (no destination at all) captures none: a gap the person completes.
  assert.equal(reviewDraftFromAssistant(resolved({ currencyStated: false, currencyInferred: false, accountId: null }), archive, at, day).currency, null);
  // Stated USD is kept even when the account chosen is in ARS: the mismatch is the domain's gap, never a conversion.
  const mismatch = reviewDraftFromAssistant(resolved({ currency: 'USD', accountId: cash.id }), withUsd, at, day);
  assert.equal(mismatch.currency, 'USD');
  assert.ok(domain.reviewGaps(mismatch, withUsd, day).includes('currency'));
  // A chosen account carries through a later clarification (the category asked after it).
  const twoTurns = completeDraft({ draft: { kind: 'expense', amountMinor: 1000, amount: '10', currency: 'ARS', merchant: 'X', category: '', dateISO: day, accountId: 'cash',
    currencyStated: false, dateStated: false, destinationStated: true }, field: 'category' }, 'Supermercado', [cash], [], day);
  assert.equal(twoTurns.content.kind === 'draft' && twoTurns.content.draft.destinationStated, true);
});

test('a card gets the domain\'s one-time purchase, never cuotas; an income never lands on a card', () => {
  const onCard = reviewDraftFromAssistant(resolved({ accountId: cardAccount.id }), archive, at, day);
  assert.deepEqual([onCard.destinationId, JSON.stringify(onCard.purchase)], [cardAccount.id, '{"mode":"once"}']);
  assert.deepEqual(onCard.basis.map(item => item.kind), ['account', 'card']);
  assert.equal(domain.writeForReviewDraft(onCard, archive, { writeId: 'w-1', createdAt: at, todayISO: '2026-09-21' }).type, 'entry', 'one card expense');
  const income = reviewDraftFromAssistant(resolved({ kind: 'income', category: 'Sueldo', merchant: 'Empresa', accountId: cardAccount.id }), archive, at, day);
  assert.deepEqual([income.destinationId, income.purchase], [null, null], 'not offered for an income: a gap, never the card');
  assert.ok(domain.reviewGaps(income, archive, '2026-09-21').includes('destination'));
  const incomeCash = reviewDraftFromAssistant(resolved({ kind: 'income', category: 'Sueldo', merchant: 'Empresa' }), archive, at, day);
  assert.deepEqual([incomeCash.destinationId, incomeCash.purchase], ['cash', null]);
});

test('the capture is frozen: its ids are the caller\'s, its key names the producer and the item, and the same inputs give the same capture', () => {
  const ids = { id: '11111111-1111-4111-8111-111111111111', writeId: '22222222-2222-4222-8222-222222222222' };
  const first = assistantCapture(resolved(), archive, ids, at, day);
  assert.deepEqual([first.id, first.writeId, first.captureKey, first.at], [ids.id, ids.writeId, 'assistant:' + ids.id, at]);
  assert.equal(JSON.stringify(assistantCapture(resolved(), archive, ids, at, day)), JSON.stringify(first));
  assert.deepEqual([proposalContent(first, false).status, proposalContent(first, true).status], ['capturing', 'preview']);
});

test('on real SQLite: a repeated capture is one item; a failed capture stores nothing and writes nothing; an edit is never overwritten; confirmation writes once', async () => {
  const files = await reviewFiles([cash]);
  try {
    await createCreditCard(files.ledger, cardAccount, card);
    const capture = assistantCapture(resolved({ accountId: cardAccount.id }), await readArchive(files.ledger), { id: 'item-a', writeId: 'write-a' }, at, day);
    // A failing write (a full disk): nothing stored, nothing in the ledger.
    const failing = { ...files.review, withExclusiveTransactionAsync: () => Promise.reject(new Error('disk I/O error')) };
    await assert.rejects((await openReviewStore(failing, files.ledger)).capture(capture));
    assert.equal((await files.tray()).items.length, 0);
    assert.deepEqual(await files.entries(), []);
    // The retry, twice: one item, in the tray (the count and the badge read the tray).
    const once = await files.store.capture(capture);
    const twice = await files.store.capture(capture);
    assert.deepEqual([once.duplicate, twice.duplicate, twice.item.id], [false, true, 'item-a']);
    const tray = await files.tray();
    assert.deepEqual([tray.items.length, tray.items[0].source, tray.items[0].captureKey], [1, 'assistant', 'assistant:item-a']);
    // Edited in «Para revisar», then the original capture again: the edit stays.
    const edited = await files.store.updateDraft('item-a', 0, { ...capture.draft, merchant: 'Carrefour Express' }, at);
    assert.equal((await files.store.capture(capture)).item.draft.merchant, 'Carrefour Express');
    // Confirmed through the store: one movement, under the frozen write id; a second confirmation is refused.
    await files.store.confirm('item-a', { expectedRevision: edited.revision, todayISO: '2026-09-21', at });
    assert.deepEqual(await files.entries(), ['write-a']);
    await assert.rejects(files.store.confirm('item-a', { expectedRevision: edited.revision + 1, todayISO: '2026-09-21', at }));
    assert.equal((await files.store.capture(capture)).item.status, 'confirmed', 'a repeat of the capture never reopens it');
    assert.deepEqual(await files.entries(), ['write-a']);
    assert.equal((await files.tray()).items.length, 0);
  } finally { await files.dispose(); }
});
