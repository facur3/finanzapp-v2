import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as domain from '@finanzapp/domain';
import type { Account, CreditCardProfile, ReviewArchive } from '@finanzapp/domain';
import type { CaptureDraft } from '../../../packages/integrations/contracts.js';
import { completeDraft, optionText, resolveDraft, type DraftField, type ResolvedDraft } from '../src/assistant/conversation.ts';
import { assistantCapture, reviewDraftFromAssistant } from '../src/assistant/review-proposal.ts';
import { bindLocale } from '../src/i18n/bind.ts';
import { readArchive } from '../src/storage/database.ts';
import { reviewFiles } from './review-sqlite.ts';

// 25A-06, owner decision D (2026-10-08) applied on the device, ARS and USD only: the model keeps `null` for a currency
// the person did not say; the device resolves it from the destinations the domain offers for the kind, in the owner's
// order of precedence, and captures what it inferred, visible and editable in the review. Nothing about the accounts
// reaches the model; the screen's display currency is never captured. Synthetic accounts only (AGENTS rule 6).
const createdAt = '2026-09-01T12:00:00.000Z';
const at = '2026-09-21T10:00:00.000Z';
const day = '2026-09-21';
const cash: Account = { id: 'cash', name: 'Efectivo', currency: 'ARS', openingMinor: 500000, createdAt };
const bank: Account = { id: 'bank', name: 'Caja de ahorro Galicia', currency: 'ARS', openingMinor: 0, createdAt };
const usd: Account = { id: 'usd', name: 'Dólares', currency: 'USD', openingMinor: 10000, createdAt };
const usdBank: Account = { id: 'usd-bank', name: 'Cuenta Galicia USD', currency: 'USD', openingMinor: 0, createdAt };
const cardAccount: Account = { id: 'visa-acc', name: 'Visa', currency: 'ARS', openingMinor: 0, createdAt };
const card: CreditCardProfile = { id: 'visa', accountId: cardAccount.id, issuer: 'Banco', last4: '4009', creditLimitMinor: 1000000, closingDay: 20, dueDay: 5,
  active: true, deleted: false, createdAt, revision: 0, updatedAt: createdAt };
const archiveOf = (accounts: Account[], cards: CreditCardProfile[] = []): ReviewArchive => ({ accounts, records: [], cards, debts: [], categories: [] });
const es = bindLocale('es-AR');
const en = bindLocale('en-US');

/** A protocol proposal as the model returns it: the currency `null` when the person said none. */
const said = (change: Partial<CaptureDraft> = {}): CaptureDraft => ({ kind: 'expense', amountMinor: 1000000, currency: null, merchant: 'Kiosco', category: 'Comida',
  dateISO: null, paymentMethodRef: null, ...change });
const draftOf = (resolved: ReturnType<typeof resolveDraft>): ResolvedDraft => { assert.equal(resolved.kind, 'draft'); return resolved.kind === 'draft' ? resolved.draft : null!; };
const asked = (resolved: ReturnType<typeof resolveDraft>, field: DraftField) => { assert.equal(resolved.kind === 'clarification' && resolved.field, field); return resolved.kind === 'clarification' ? resolved : null!; };
const pendingOf = (resolved: ReturnType<typeof resolveDraft>) => resolved.kind === 'clarification' ? { draft: resolved.partial, field: resolved.field } : null!;
const captured = (draft: ResolvedDraft, accounts: Account[], cards: CreditCardProfile[] = []) => reviewDraftFromAssistant(draft, archiveOf(accounts, cards), at, day);

test('one ARS account, no currency said: the currency every destination shares is inferred, the one destination implied, both captured', () => {
  // The screen shows USD (a report currency): never what is captured.
  const resolved = draftOf(resolveDraft(said(), [cash], [], 'USD', day));
  assert.deepEqual([resolved.currency, resolved.currencyStated, resolved.currencyInferred, resolved.accountId, resolved.destinationStated], ['ARS', false, true, 'cash', false]);
  const review = captured(resolved, [cash]);
  assert.deepEqual([review.currency, review.destinationId, review.amountMinor], ['ARS', 'cash', 1000000]);
  assert.deepEqual(domain.reviewGaps(review, archiveOf([cash]), day), [], 'complete: confirmable in the review sheet, where the currency is shown and editable');
});

test('several ARS accounts, no currency said: the currency is inferred, the account is asked among them, never picked', () => {
  const question = asked(resolveDraft(said(), [cash, bank], [], 'ARS', day), 'paymentMethod');
  assert.equal(question.question, 'assistant.clarify.paidWith', 'no currency question: the destinations share one');
  assert.deepEqual(question.options.map(option => option.id), ['cash', 'bank']);
  assert.deepEqual([question.partial.currency, question.partial.currencyInferred, question.partial.accountId], ['ARS', true, null]);
  const chosen = completeDraft(pendingOf(resolveDraft(said(), [cash, bank], [], 'ARS', day)), 'bank', [cash, bank], [], day);
  assert.equal(chosen.content.kind, 'draft');
  const draft = chosen.content.kind === 'draft' ? chosen.content.draft : null!;
  assert.deepEqual([draft.currency, draft.currencyInferred, draft.accountId, draft.destinationStated], ['ARS', true, 'bank', true]);
  assert.deepEqual([captured(draft, [cash, bank]).currency, captured(draft, [cash, bank]).destinationId], ['ARS', 'bank']);
});

test('one ARS and one USD account, no currency said: the currency is asked with the currencies as chips, named in the interface language', () => {
  const question = asked(resolveDraft(said(), [cash, usd], [], 'ARS', day), 'currency');
  assert.equal(question.question, 'assistant.clarify.currency');
  assert.equal(es.t(question.question), '¿En qué moneda fue?');
  assert.equal(en.t(question.question), 'Which currency was it in?');
  assert.deepEqual(question.options, [{ id: 'ARS', currency: 'ARS' }, { id: 'USD', currency: 'USD' }]);
  assert.deepEqual(question.options.map(option => optionText(option, es.t, es.currencyName)), ['Pesos argentinos', 'Dólares estadounidenses']);
  assert.deepEqual(question.options.map(option => optionText(option, en.t, en.currencyName)), ['Argentine pesos', 'US dollars']);
  assert.deepEqual(question.options.map(option => optionText(option)), ['ARS', 'USD'], 'the code when nothing can name it');
  assert.deepEqual([question.partial.currencyInferred, question.partial.accountId], [false, null], 'nothing inferred: the screen\'s ARS stands in for the conversation only');
  // Chosen: dollars. The one USD account is implied; the chosen currency is the person's and is captured.
  const dollars = completeDraft(pendingOf(resolveDraft(said(), [cash, usd], [], 'ARS', day)), 'USD', [cash, usd], [], day);
  const draft = dollars.content.kind === 'draft' ? dollars.content.draft : null!;
  assert.deepEqual([draft.currency, draft.currencyStated, draft.currencyInferred, draft.accountId, draft.destinationStated], ['USD', false, true, 'usd', false]);
  assert.deepEqual([captured(draft, [cash, usd]).currency, captured(draft, [cash, usd]).destinationId], ['USD', 'usd']);
  // Chosen: pesos, with two ARS accounts: the account is asked next, among the ARS ones only; the amount is carried exactly.
  const pesos = completeDraft(pendingOf(resolveDraft(said({ amountMinor: 1850000 }), [cash, bank, usd], [], 'ARS', day)), 'ARS', [cash, bank, usd], [], day);
  assert.equal(pesos.content.kind === 'clarification' && pesos.content.field, 'paymentMethod');
  assert.deepEqual(pesos.content.kind === 'clarification' ? pesos.content.options.map(option => option.id) : [], ['cash', 'bank']);
  assert.deepEqual([pesos.pending?.draft.currency, pesos.pending?.draft.currencyInferred, pesos.pending?.draft.amountMinor, pesos.pending?.draft.merchant], ['ARS', true, 1850000, 'Kiosco']);
});

test('an explicit currency takes precedence: USD said with ARS and USD accounts goes to the one USD account; a stated currency is never inferred over', () => {
  const resolved = draftOf(resolveDraft(said({ currency: 'USD' }), [cash, bank, usd], [], 'ARS', day));
  assert.deepEqual([resolved.currency, resolved.currencyStated, resolved.currencyInferred, resolved.accountId, resolved.destinationStated], ['USD', true, false, 'usd', false]);
  assert.equal(captured(resolved, [cash, bank, usd]).currency, 'USD');
  // ARS said with two ARS accounts: the account is asked, among the ARS ones.
  const pesos = asked(resolveDraft(said({ currency: 'ARS' }), [cash, bank, usd], [], 'USD', day), 'paymentMethod');
  assert.deepEqual(pesos.options.map(option => option.id), ['cash', 'bank']);
  // USD said and no USD destination at all: asked, with no chips; the stated currency is kept, never replaced.
  const none = asked(resolveDraft(said({ currency: 'USD' }), [cash, bank], [], 'ARS', day), 'paymentMethod');
  assert.deepEqual([none.options, none.partial.currency], [[], 'USD']);
});

test('a uniquely named USD account lends its currency while the screen shows ARS', () => {
  // «con Dólares»: the leading preposition is dropped and the name matched by whole words (25A-04), in any currency.
  const resolved = draftOf(resolveDraft(said({ paymentMethodRef: 'con Dólares' }), [cash, bank, usd], [], 'ARS', day));
  assert.deepEqual([resolved.currency, resolved.currencyStated, resolved.currencyInferred, resolved.accountId, resolved.destinationStated], ['USD', false, true, 'usd', true]);
  assert.deepEqual([captured(resolved, [cash, bank, usd]).currency, captured(resolved, [cash, bank, usd]).destinationId], ['USD', 'usd']);
});

test('two similarly named accounts in different currencies: the destination is asked among the two, and the choice settles the currency', () => {
  const question = asked(resolveDraft(said({ paymentMethodRef: 'Galicia' }), [cash, bank, usd, usdBank], [], 'ARS', day), 'paymentMethod');
  assert.deepEqual(question.options.map(option => option.id), ['bank', 'usd-bank'], 'the accounts the name matches, in both currencies');
  assert.equal(question.partial.currencyInferred, false, 'no currency until the account is known');
  const chosen = completeDraft(pendingOf(resolveDraft(said({ paymentMethodRef: 'Galicia' }), [cash, bank, usd, usdBank], [], 'ARS', day)), 'usd-bank', [cash, bank, usd, usdBank], [], day);
  const draft = chosen.content.kind === 'draft' ? chosen.content.draft : null!;
  assert.deepEqual([draft.currency, draft.currencyInferred, draft.accountId, draft.destinationStated], ['USD', true, 'usd-bank', true]);
  assert.equal(captured(draft, [cash, bank, usd, usdBank]).currency, 'USD');
  // The same two names, one currency said: the match in that currency is the one.
  const pesos = draftOf(resolveDraft(said({ paymentMethodRef: 'Galicia', currency: 'ARS' }), [cash, bank, usd, usdBank], [], 'ARS', day));
  assert.deepEqual([pesos.currency, pesos.accountId, pesos.destinationStated], ['ARS', 'bank', true]);
});

test('an explicit currency that contradicts the only account the name matches is asked about, never converted and never silently replaced', () => {
  const question = asked(resolveDraft(said({ currency: 'ARS', paymentMethodRef: 'Dólares' }), [cash, bank, usd], [], 'ARS', day), 'paymentMethod');
  assert.equal(question.question, 'assistant.clarify.currencyConflict');
  assert.equal(es.t(question.question), 'Esa cuenta no está en la moneda que dijiste. ¿Con qué cuenta o tarjeta fue?');
  assert.deepEqual(question.options.map(option => option.id), ['cash', 'bank'], 'the destinations in the currency said');
  assert.deepEqual([question.partial.currency, question.partial.currencyStated, question.partial.accountId], ['ARS', true, null]);
  // The person picks a peso account: the stated currency and the chosen account agree; nothing was converted.
  const chosen = completeDraft(pendingOf(resolveDraft(said({ currency: 'ARS', paymentMethodRef: 'Dólares' }), [cash, bank, usd], [], 'ARS', day)), 'cash', [cash, bank, usd], [], day);
  const draft = chosen.content.kind === 'draft' ? chosen.content.draft : null!;
  assert.deepEqual([draft.currency, draft.currencyStated, draft.accountId, draft.amountMinor], ['ARS', true, 'cash', 1000000]);
  // A name that matches nothing in any currency is the 25A-04 rule, unchanged: asked, never the only eligible account.
  const nobody = asked(resolveDraft(said({ currency: 'ARS', paymentMethodRef: 'la Naranja' }), [cash, usd], [], 'ARS', day), 'paymentMethod');
  assert.deepEqual([nobody.question, nobody.options.map(option => option.id)], ['assistant.clarify.paidWith', ['cash']]);
});

test('no eligible destination: nothing is inferred, the person is asked with no chips, and the review keeps the currency and destination as gaps', () => {
  const question = asked(resolveDraft(said(), [], [], 'ARS', day), 'paymentMethod');
  assert.deepEqual([question.options, question.partial.currencyInferred, question.partial.currencyStated], [[], false, false]);
  const review = captured({ kind: 'expense', amountMinor: 1000000, currency: 'ARS', merchant: 'Kiosco', category: 'Comida', dateISO: day, accountId: null,
    currencyStated: false, currencyInferred: false, dateStated: false }, []);
  assert.deepEqual([review.currency, review.destinationId], [null, null], 'the screen\'s currency is never captured');
  assert.deepEqual(domain.reviewGaps(review, archiveOf([]), day), ['currency', 'destination']);
});

test('an income with a credit card present: the income pool is cash only, so the card never lends a currency nor is offered; an expense still asks between them', () => {
  const accounts = domain.postingAccountsFor('expense', [cash, cardAccount], [card]);
  const incomeAccounts = domain.postingAccountsFor('income', [cash, cardAccount], [card]);
  assert.deepEqual([accounts.map(account => account.id), incomeAccounts.map(account => account.id)], [['cash', 'visa-acc'], ['cash']]);
  const income = draftOf(resolveDraft(said({ kind: 'income', merchant: 'Empresa', category: 'Sueldo' }), accounts, [], 'USD', day, incomeAccounts));
  assert.deepEqual([income.currency, income.currencyInferred, income.accountId, income.destinationStated], ['ARS', true, 'cash', false]);
  assert.deepEqual([captured(income, [cash, cardAccount], [card]).currency, captured(income, [cash, cardAccount], [card]).destinationId], ['ARS', 'cash']);
  const expense = asked(resolveDraft(said(), accounts, [], 'USD', day, incomeAccounts), 'paymentMethod');
  assert.deepEqual([expense.options.map(option => option.id), expense.partial.currency, expense.partial.currencyInferred], [['cash', 'visa-acc'], 'ARS', true]);
  // An income whose named destination is the card: not in the income pool, so it is asked, and the card is never offered.
  const onCard = asked(resolveDraft(said({ kind: 'income', paymentMethodRef: 'Visa' }), accounts, [], 'ARS', day, incomeAccounts), 'paymentMethod');
  assert.deepEqual(onCard.options.map(option => option.id), ['cash']);
});

test('several turns: kind, then currency, then account; every answer keeps the draft context and the inferred currency never disappears', () => {
  const pool = [cash, bank, usd];
  const first = resolveDraft(said({ kind: null, amountMinor: 1850000, category: null }), pool, [], 'ARS', day, [cash, bank, usd]);
  assert.equal(first.kind === 'clarification' && first.field, 'kind');
  const afterKind = completeDraft(pendingOf(first), 'expense', pool, [], day);
  assert.equal(afterKind.content.kind === 'clarification' && afterKind.content.field, 'currency', 'the kind known, the currency is the next gap');
  assert.deepEqual([afterKind.pending?.draft.kind, afterKind.pending?.draft.amountMinor, afterKind.pending?.draft.merchant], ['expense', 1850000, 'Kiosco'], 'the context travels');
  const afterCurrency = completeDraft(afterKind.pending!, 'ARS', pool, [], day);
  assert.equal(afterCurrency.content.kind === 'clarification' && afterCurrency.content.field, 'paymentMethod');
  assert.deepEqual([afterCurrency.pending?.draft.currency, afterCurrency.pending?.draft.currencyInferred], ['ARS', true]);
  const afterAccount = completeDraft(afterCurrency.pending!, 'bank', pool, [], day);
  assert.equal(afterAccount.content.kind === 'clarification' && afterAccount.content.field, 'category', 'the category is the last gap; the currency was not asked again');
  assert.deepEqual([afterAccount.pending?.draft.currency, afterAccount.pending?.draft.currencyInferred, afterAccount.pending?.draft.accountId, afterAccount.pending?.draft.destinationStated], ['ARS', true, 'bank', true]);
  const done = completeDraft(afterAccount.pending!, 'Comida', pool, [], day);
  const draft = done.content.kind === 'draft' ? done.content.draft : null!;
  assert.deepEqual([draft.kind, draft.amountMinor, draft.currency, draft.currencyInferred, draft.accountId, draft.category, draft.merchant], ['expense', 1850000, 'ARS', true, 'bank', 'Comida', 'Kiosco']);
  assert.equal(done.pending, null);
  assert.deepEqual([captured(draft, pool).currency, captured(draft, pool).destinationId, captured(draft, pool).amountMinor], ['ARS', 'bank', 1850000]);
  // An inferred currency survives a category question too (one ARS account, no category).
  const inferred = resolveDraft(said({ category: null }), [cash], [], 'USD', day);
  assert.equal(inferred.kind === 'clarification' && inferred.field, 'category');
  const complete = completeDraft(pendingOf(inferred), 'Comida', [cash], [], day);
  assert.deepEqual([complete.content.kind === 'draft' && complete.content.draft.currency, complete.content.kind === 'draft' && complete.content.draft.currencyInferred], ['ARS', true]);
});

test('exact amounts: 1.99 USD stays 199 minor units and 10.000 ARS stays 1 000 000, whatever inferred the currency', () => {
  const cents = draftOf(resolveDraft(said({ amountMinor: 199 }), [usd], [], 'ARS', day));
  assert.deepEqual([cents.currency, cents.amountMinor], ['USD', 199]);
  assert.deepEqual([captured(cents, [usd]).amountMinor, captured(cents, [usd]).currency], [199, 'USD']);
  const pesos = draftOf(resolveDraft(said({ amountMinor: 1000000, paymentMethodRef: 'Efectivo' }), [cash, usd], [], 'USD', day));
  assert.deepEqual([pesos.currency, pesos.amountMinor, captured(pesos, [cash, usd]).amountMinor], ['ARS', 1000000, 1000000]);
});

test('on real SQLite: an inferred currency is captured, shown with its exact amount, editable, discardable and confirmed once; nothing is written before the confirmation', async () => {
  const files = await reviewFiles([cash, usd]);
  try {
    const archive = await readArchive(files.ledger);
    // «Gasté 1,99 en la cuenta Dólares»: the model states no currency; the named account lends USD.
    const resolved = draftOf(resolveDraft(said({ amountMinor: 199, paymentMethodRef: 'Dólares' }), [cash, usd], [], 'ARS', day));
    const capture = assistantCapture(resolved, archive, { id: 'item-usd', writeId: 'write-usd' }, at, day);
    assert.deepEqual([capture.draft.currency, capture.draft.destinationId, capture.draft.amountMinor], ['USD', 'usd', 199]);
    assert.deepEqual(await files.entries(), [], 'nothing written at capture');
    const stored = await files.store.capture(capture);
    assert.equal((await files.tray()).items[0].draft.currency, 'USD', 'the inferred currency is in the review item the sheet reads');
    // Edited in the review (the merchant): the currency and the exact amount stay.
    const edited = await files.store.updateDraft('item-usd', stored.item.revision, { ...capture.draft, merchant: 'Steam' }, at);
    assert.deepEqual([edited.draft.currency, edited.draft.amountMinor, edited.writeId], ['USD', 199, 'write-usd']);
    // Confirmed through the store: exactly one movement, in USD, under the frozen write id.
    await files.store.confirm('item-usd', { expectedRevision: edited.revision, todayISO: day, at });
    assert.deepEqual(await files.entries(), ['write-usd']);
    const record = (await readArchive(files.ledger)).records.find(item => item.entry.id === 'write-usd')!;
    assert.deepEqual([record.entry.accountId, record.entry.amountMinor], ['usd', 199]);
    // A second proposal with an inferred currency, discarded: no movement.
    const pesos = draftOf(resolveDraft(said({ paymentMethodRef: 'Efectivo' }), [cash, usd], [], 'USD', day));
    const second = await files.store.capture(assistantCapture(pesos, archive, { id: 'item-ars', writeId: 'write-ars' }, at, day));
    assert.equal(second.item.draft.currency, 'ARS');
    await files.store.dismiss('item-ars', second.item.revision, at);
    assert.deepEqual(await files.entries(), ['write-usd'], 'discarding writes nothing');
    assert.equal((await files.tray()).items.length, 0);
  } finally { await files.dispose(); }
});

test('only a currency the protocol carries is inferred, lent or offered: an account in another currency (JPY, MXN, COP) never lends one, and a ledger mixing one in asks instead of inferring', () => {
  // Codex review of PR #98: the model's amount is in the minor units of a protocol currency (centavos); a JPY account
  // lending its currency would turn 100 into ¥10 000. Such an account is never a destination the Assistant resolves to.
  const jpy: Account = { id: 'jpy', name: 'Yenes', currency: 'JPY', openingMinor: 0, createdAt };
  const mxn: Account = { id: 'mxn', name: 'Cuenta Banorte', currency: 'MXN', openingMinor: 0, createdAt };
  const cop: Account = { id: 'cop', name: 'Bancolombia', currency: 'COP', openingMinor: 0, createdAt };
  assert.deepEqual([domain.isLegacyCurrency('JPY'), domain.isLegacyCurrency('MXN'), domain.isLegacyCurrency('COP')], [false, false, false]);
  // A uniquely named JPY account: never lends JPY; asked, with the carried destinations, never replaced by one of them.
  const namedJpy = asked(resolveDraft(said({ paymentMethodRef: 'Yenes' }), [cash, jpy], [], 'ARS', day), 'paymentMethod');
  assert.deepEqual([namedJpy.question, namedJpy.options.map(option => option.id), namedJpy.partial.currencyInferred], ['assistant.clarify.paidWith', ['cash'], false]);
  // Nothing named, ARS and JPY accounts: the currency is in question, so it is asked, with the carried currency as the only chip.
  const mixed = asked(resolveDraft(said(), [cash, jpy], [], 'ARS', day), 'currency');
  assert.deepEqual([mixed.options, mixed.partial.currencyInferred], [[{ id: 'ARS', currency: 'ARS' }], false], 'never inferred over an account the protocol cannot carry');
  const three = asked(resolveDraft(said(), [cash, usd, jpy], [], 'ARS', day), 'currency');
  assert.deepEqual(three.options.map(option => option.id), ['ARS', 'USD'], 'the chips are the protocol\'s currencies only');
  // Chosen pesos: the one ARS destination is implied; the JPY account is never offered.
  const chosen = completeDraft(pendingOf(resolveDraft(said(), [cash, jpy], [], 'ARS', day)), 'ARS', [cash, jpy], [], day);
  assert.deepEqual([chosen.content.kind === 'draft' && chosen.content.draft.currency, chosen.content.kind === 'draft' && chosen.content.draft.accountId], ['ARS', 'cash']);
  // A Mexican person's accounts are MXN (or MXN and COP): nothing is inferred and no chip can offer them; the person is
  // asked for the destination with no chips, and the review keeps the currency a gap. The protocol's currency fields
  // (the next slice) are what carries MXN or COP; recorded as future coverage, never pretended supported.
  for (const accounts of [[mxn], [mxn, cop]]) {
    const question = asked(resolveDraft(said(), accounts, [], 'ARS', day), 'paymentMethod');
    assert.deepEqual([question.options, question.partial.currencyInferred], [[], false]);
  }
  // Explicit USD said against a named MXN account: the conflict question, with no carried USD destination to offer.
  const conflict = asked(resolveDraft(said({ currency: 'USD', paymentMethodRef: 'Banorte' }), [cash, mxn], [], 'ARS', day), 'paymentMethod');
  assert.deepEqual([conflict.question, conflict.options, conflict.partial.currency], ['assistant.clarify.currencyConflict', [], 'USD']);
});
