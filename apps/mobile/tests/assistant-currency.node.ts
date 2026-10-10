import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as domain from '@finanzapp/domain';
import type { Account, CreditCardProfile, ReviewArchive } from '@finanzapp/domain';
import type { DraftInput } from '../src/assistant/conversation.ts';
import { completeDraft, optionText, resolveDraft, type DraftField, type ResolvedDraft } from '../src/assistant/conversation.ts';
import { assistantCapture, reviewDraftFromAssistant } from '../src/assistant/review-proposal.ts';
import { bindLocale } from '../src/i18n/bind.ts';
import { readArchive } from '../src/storage/database.ts';
import { reviewFiles } from './review-sqlite.ts';

// 25A-06, owner decision D (2026-10-08) applied on the device (ARS and USD first; every ledger currency since the ledger-currencies slice): the model keeps `null` for a currency
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
const said = (change: Partial<DraftInput> = {}): DraftInput => ({ kind: 'expense', amount: '10000', currency: null, merchant: 'Kiosco', category: 'Comida',
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
  const pesos = completeDraft(pendingOf(resolveDraft(said({ amount: '18500' }), [cash, bank, usd], [], 'ARS', day)), 'ARS', [cash, bank, usd], [], day);
  assert.equal(pesos.content.kind === 'clarification' && pesos.content.field, 'paymentMethod');
  assert.deepEqual(pesos.content.kind === 'clarification' ? pesos.content.options.map(option => option.id) : [], ['cash', 'bank']);
  assert.deepEqual([pesos.pending?.draft.currency, pesos.pending?.draft.currencyInferred, pesos.pending?.draft.amount, pesos.pending?.draft.merchant], ['ARS', true, '18500', 'Kiosco']);
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
  const first = resolveDraft(said({ kind: null, amount: '18500', category: null }), pool, [], 'ARS', day, [cash, bank, usd]);
  assert.equal(first.kind === 'clarification' && first.field, 'kind');
  const afterKind = completeDraft(pendingOf(first), 'expense', pool, [], day);
  assert.equal(afterKind.content.kind === 'clarification' && afterKind.content.field, 'currency', 'the kind known, the currency is the next gap');
  assert.deepEqual([afterKind.pending?.draft.kind, afterKind.pending?.draft.amount, afterKind.pending?.draft.merchant], ['expense', '18500', 'Kiosco'], 'the context travels');
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
  const cents = draftOf(resolveDraft(said({ amount: '1.99' }), [usd], [], 'ARS', day));
  assert.deepEqual([cents.currency, cents.amountMinor], ['USD', 199]);
  assert.deepEqual([captured(cents, [usd]).amountMinor, captured(cents, [usd]).currency], [199, 'USD']);
  const pesos = draftOf(resolveDraft(said({ amount: '10000', paymentMethodRef: 'Efectivo' }), [cash, usd], [], 'USD', day));
  assert.deepEqual([pesos.currency, pesos.amountMinor, captured(pesos, [cash, usd]).amountMinor], ['ARS', 1000000, 1000000]);
});

test('on real SQLite: an inferred currency is captured, shown with its exact amount, editable, discardable and confirmed once; nothing is written before the confirmation', async () => {
  const files = await reviewFiles([cash, usd]);
  try {
    const archive = await readArchive(files.ledger);
    // «Gasté 1,99 en la cuenta Dólares»: the model states no currency; the named account lends USD.
    const resolved = draftOf(resolveDraft(said({ amount: '1.99', paymentMethodRef: 'Dólares' }), [cash, usd], [], 'ARS', day));
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

test('a name is ambiguous against every destination offered for the kind, carried or not: the carried match is never picked for being the only one the protocol can carry', () => {
  // Independent review of PR #98 at 6ab95d0: «Gasté 500 con Galicia» with a «Galicia» in pesos and a «Galicia MXN» silently
  // took the peso account. Since 25A-06 both are carried, so both are offered; a held (three-decimal) account still never is.
  const galicia: Account = { id: 'galicia', name: 'Galicia', currency: 'ARS', openingMinor: 0, createdAt };
  const galiciaMxn: Account = { id: 'galicia-mxn', name: 'Galicia MXN', currency: 'MXN', openingMinor: 0, createdAt };
  const galiciaKwd: Account = { id: 'galicia-kwd', name: 'Galicia KWD', currency: 'KWD', openingMinor: 0, createdAt };
  const chase: Account = { id: 'chase', name: 'Chase', currency: 'USD', openingMinor: 0, createdAt };
  const chaseJpy: Account = { id: 'chase-jpy', name: 'Chase JPY', currency: 'JPY', openingMinor: 0, createdAt };
  const jpy: Account = { id: 'jpy', name: 'Yenes', currency: 'JPY', openingMinor: 0, createdAt };
  const banorte: Account = { id: 'banorte', name: 'Banorte', currency: 'MXN', openingMinor: 0, createdAt };
  assert.equal(domain.isLedgerCurrency('KWD'), false, 'KWD is held');
  // ARS and MXN accounts matching «Galicia»: both offered; nothing inferred, no draft.
  const pesos = asked(resolveDraft(said({ amount: '500', paymentMethodRef: 'con Galicia' }), [cash, galicia, galiciaMxn], [], 'ARS', day), 'paymentMethod');
  assert.deepEqual([pesos.question, pesos.options.map(option => option.id), pesos.partial.currencyInferred, pesos.partial.accountId], ['assistant.clarify.paidWith', ['galicia', 'galicia-mxn'], false, null]);
  // A held match beside a carried one: still asked (the name is ambiguous), the held account never a chip.
  const held = asked(resolveDraft(said({ amount: '500', paymentMethodRef: 'con Galicia' }), [cash, galicia, galiciaKwd], [], 'ARS', day), 'paymentMethod');
  assert.deepEqual([held.options.map(option => option.id), held.partial.currencyInferred], [['galicia'], false]);
  // USD and JPY accounts matching the same reference: both offered, neither taken silently.
  const dollars = asked(resolveDraft(said({ paymentMethodRef: 'Chase' }), [cash, chase, chaseJpy], [], 'ARS', day), 'paymentMethod');
  assert.deepEqual([dollars.options.map(option => option.id), dollars.partial.currencyInferred], [['chase', 'chase-jpy'], false]);
  // The person chooses the MXN one: it lends MXN and the stated decimal is scaled by MXN's exponent.
  const confirmed = completeDraft(pendingOf(resolveDraft(said({ amount: '500', paymentMethodRef: 'con Galicia' }), [cash, galicia, galiciaMxn], [], 'ARS', day)), 'galicia-mxn', [cash, galicia, galiciaMxn], [], day);
  const draft = confirmed.content.kind === 'draft' ? confirmed.content.draft : null!;
  assert.deepEqual([draft.currency, draft.currencyInferred, draft.accountId, draft.destinationStated, draft.amountMinor], ['MXN', true, 'galicia-mxn', true, 50000]);
  assert.deepEqual([captured(draft, [cash, galicia, galiciaMxn]).currency, captured(draft, [cash, galicia, galiciaMxn]).destinationId], ['MXN', 'galicia-mxn']);
  // A genuinely unique match while accounts in other currencies exist: resolved, its currency lent.
  const unique = draftOf(resolveDraft(said({ paymentMethodRef: 'Galicia' }), [cash, bank, jpy, banorte], [], 'USD', day));
  assert.deepEqual([unique.currency, unique.currencyInferred, unique.accountId, unique.destinationStated], ['ARS', true, 'bank', true]);
  // A uniquely named JPY account lends JPY: «100» is 100 yen, never 10 000.
  const yen = draftOf(resolveDraft(said({ amount: '100', paymentMethodRef: 'Yenes' }), [cash, usd, jpy], [], 'ARS', day));
  assert.deepEqual([yen.currency, yen.currencyInferred, yen.accountId, yen.amountMinor, captured(yen, [cash, usd, jpy]).amountMinor], ['JPY', true, 'jpy', 100, 100]);
  const yenOnlyPesos = asked(resolveDraft(said({ paymentMethodRef: 'Yenes' }), [cash, bank], [], 'USD', day), 'paymentMethod');
  assert.deepEqual([yenOnlyPesos.options.map(option => option.id), yenOnlyPesos.partial.currency, yenOnlyPesos.partial.currencyInferred], [['cash', 'bank'], 'ARS', true],
    'a name that matches nothing with every destination in pesos: the currency is inferred, the destination asked');
  // An explicit currency keeps its precedence: «pesos» said with the two Galicias goes to the one in pesos.
  const stated = draftOf(resolveDraft(said({ currency: 'ARS', paymentMethodRef: 'Galicia' }), [cash, galicia, galiciaMxn], [], 'ARS', day));
  assert.deepEqual([stated.currency, stated.accountId, stated.destinationStated], ['ARS', 'galicia', true]);
});

// 25A-06: every currency of the domain's creation gate is inferred, lent, offered and scaled exactly; the held
// (three-decimal) ones never are. Driven by the catalogue itself, so a currency opened later is covered without a test edit.
const accountIn = (currency: domain.IsoCurrencyCode, id = 'acc-' + currency): Account => ({ id, name: 'Cuenta ' + currency, currency, openingMinor: 0, createdAt });
test('every ledger currency: inferred from a lone account, lent by a named one, stated, offered as a chip, scaled by its own exponent', () => {
  assert.equal(domain.LEDGER_CURRENCIES.length, 146);
  for (const code of domain.LEDGER_CURRENCIES) {
    const account = accountIn(code);
    const exponent = domain.minorUnitExponent(code);
    // Inferred (rule 3): «100» is 100 whole units of that currency, captured exactly.
    const inferred = draftOf(resolveDraft(said({ amount: '100' }), [account], [], 'ARS', day));
    assert.deepEqual([inferred.currency, inferred.currencyInferred, inferred.accountId, inferred.amountMinor], [code, true, account.id, 100 * 10 ** exponent], code);
    const review = captured(inferred, [account]);
    assert.deepEqual([review.currency, review.destinationId, review.amountMinor], [code, account.id, 100 * 10 ** exponent], code);
    assert.deepEqual(domain.reviewGaps(review, archiveOf([account]), day), [], code + ': confirmable in review, amount, currency and destination shown and editable');
    // Lent by a uniquely named account beside a peso one (rule 2), and stated explicitly (rule 1).
    if (code !== 'ARS') {
      const lent = draftOf(resolveDraft(said({ amount: '100', paymentMethodRef: 'Cuenta ' + code }), [cash, account], [], 'ARS', day));
      assert.deepEqual([lent.currency, lent.accountId, lent.amountMinor], [code, account.id, 100 * 10 ** exponent], code);
      const stated = draftOf(resolveDraft(said({ amount: '100', currency: code }), [cash, account], [], 'ARS', day));
      assert.deepEqual([stated.currency, stated.currencyStated, stated.accountId], [code, true, account.id], code);
      // Several currencies, nothing said: asked, with both as chips; the chip chosen scales the parked decimal.
      const question = asked(resolveDraft(said({ amount: '1.99' }), [cash, account], [], 'ARS', day), 'currency');
      assert.deepEqual(question.options.map(option => option.id), ['ARS', code], code);
      const chosen = completeDraft(pendingOf(resolveDraft(said({ amount: '1.99' }), [cash, account], [], 'ARS', day)), code, [cash, account], [], day);
      if (exponent === 2) assert.deepEqual(chosen.content.kind === 'draft' ? [chosen.content.draft.currency, chosen.content.draft.amountMinor] : null, [code, 199], code);
      // «1.99» in a zero-decimal currency has no exact value: the amount is asked again, never rounded to 2.
      else assert.deepEqual([chosen.content.kind, chosen.textKey, chosen.pending?.draft.amount, chosen.pending?.draft.currency], ['clarification', 'assistant.clarify.amount', undefined, code], code);
    }
    // Named in the interface language on a chip, in Spanish and English.
    assert.ok(es.currencyName(code) && en.currencyName(code), code + ': a chip can name it');
  }
  // Held currencies: never inferred, lent or offered; beside a carried one, the currency is asked with the carried chip only.
  for (const code of Object.keys(domain.HELD_CURRENCIES) as domain.IsoCurrencyCode[]) {
    const account = accountIn(code);
    const alone = asked(resolveDraft(said({ amount: '100' }), [account], [], 'ARS', day), 'paymentMethod');
    assert.deepEqual([alone.options, alone.partial.currencyInferred, alone.partial.amount, alone.partial.amountMinor], [[], false, '100', undefined], code);
    const mixed = asked(resolveDraft(said({ amount: '100' }), [cash, account], [], 'ARS', day), 'currency');
    assert.deepEqual(mixed.options.map(option => option.id), ['ARS'], code);
  }
});

test('the owner\'s scenarios: MXN «10 mil pesos», COP «20 lucas», JPY «100 yenes», mixed ledgers and explicit conflicts, exact amounts', () => {
  const mxn = accountIn('MXN', 'mxn');
  const cop = accountIn('COP', 'cop');
  const jpy = accountIn('JPY', 'jpy');
  const eur = accountIn('EUR', 'eur');
  // Mexico, one MXN account: «Gasté 10 mil pesos» → amount «10000»; the model names MXN (region MX) or leaves it null.
  for (const currency of ['MXN', null] as const) {
    const draft = draftOf(resolveDraft(said({ amount: '10000', currency }), [mxn], [], 'MXN', day));
    assert.deepEqual([draft.currency, draft.amountMinor, draft.accountId, captured(draft, [mxn]).amountMinor], ['MXN', 1000000, 'mxn', 1000000], String(currency));
  }
  // Colombia, only COP accounts: «Me gasté 20 lucas» → «20000», COP inferred (or stated), 20 000 pesos exactly.
  for (const currency of ['COP', null] as const) {
    const draft = draftOf(resolveDraft(said({ amount: '20000', currency }), [cop], [], 'COP', day));
    assert.deepEqual([draft.currency, draft.amountMinor], ['COP', 2000000], String(currency));
  }
  // One JPY account: «Gasté 100 yenes» → exactly 100 yen, never 10 000.
  const yen = draftOf(resolveDraft(said({ amount: '100', currency: 'JPY' }), [jpy], [], 'JPY', day));
  assert.deepEqual([yen.currency, yen.amountMinor, captured(yen, [jpy]).amountMinor], ['JPY', 100, 100]);
  // Exact cents: 1.99 and 0.50 euros.
  assert.equal(draftOf(resolveDraft(said({ amount: '1.99', currency: 'EUR' }), [eur], [], 'EUR', day)).amountMinor, 199);
  assert.equal(draftOf(resolveDraft(said({ amount: '0.50' }), [eur], [], 'ARS', day)).amountMinor, 50);
  // «pesos» never implies ARS on the device: with ARS and MXN accounts and nothing the model could resolve, it is asked.
  const pesos = asked(resolveDraft(said({ amount: '10000' }), [cash, mxn], [], 'ARS', day), 'currency');
  assert.deepEqual(pesos.options.map(option => option.id), ['ARS', 'MXN']);
  // The screen's (display) currency never decides: an MXN screen with ARS and MXN accounts still asks.
  assert.equal(resolveDraft(said({ amount: '10000' }), [cash, mxn], [], 'MXN', day).kind, 'clarification');
  // MXN and COP only, nothing said: asked with both chips; chosen COP scales «20000» to 2 000 000 and takes the COP account.
  const both = completeDraft(pendingOf(resolveDraft(said({ amount: '20000' }), [mxn, cop], [], 'ARS', day)), 'COP', [mxn, cop], [], day);
  assert.deepEqual(both.content.kind === 'draft' ? [both.content.draft.currency, both.content.draft.amountMinor, both.content.draft.accountId] : null, ['COP', 2000000, 'cop']);
  // Explicit USD against a named MXN account: the conflict question, with the USD destinations as chips, never converted.
  const conflict = asked(resolveDraft(said({ currency: 'USD', paymentMethodRef: 'Cuenta MXN' }), [cash, usd, mxn], [], 'ARS', day), 'paymentMethod');
  assert.deepEqual([conflict.question, conflict.options.map(option => option.id), conflict.partial.currency], ['assistant.clarify.currencyConflict', ['usd'], 'USD']);
  // Explicit EUR with only peso accounts: no destination in euros, so the destination is asked with no chips; nothing
  // becomes pesos and no account is invented.
  const euros = asked(resolveDraft(said({ amount: '50', currency: 'EUR' }), [cash, bank], [], 'ARS', day), 'paymentMethod');
  assert.deepEqual([euros.options, euros.partial.currency, euros.partial.accountId], [[], 'EUR', null]);
  // The parked decimal and the stated currency survive a kind question, then resolve exactly.
  const noKind = resolveDraft(said({ kind: null, amount: '10000', currency: 'MXN' }), [mxn], [], 'ARS', day);
  const afterKind = completeDraft(pendingOf(noKind), 'expense', [mxn], [], day);
  assert.deepEqual(afterKind.content.kind === 'draft' ? [afterKind.content.draft.currency, afterKind.content.draft.amountMinor, afterKind.content.draft.currencyStated] : null, ['MXN', 1000000, true]);
  // English chips name the currencies too.
  assert.deepEqual(pesos.options.map(option => optionText(option, en.t, en.currencyName)), ['Argentine pesos', 'Mexican pesos']);
  assert.deepEqual(pesos.options.map(option => optionText(option, es.t, es.currencyName)), ['Pesos argentinos', 'Pesos mexicanos']);
});

// 25A-06, protocol v4: the model states the amount the person meant as an exact decimal in major units; the device
// scales it with the resolved currency's exponent (`majorStringToMinor`) only once that currency is known, and asks again
// for an amount the currency cannot hold exactly. Nothing is rounded, cut or scaled before the currency is resolved.
test('protocol v4: the stated decimal is scaled to minor units by the resolved currency, exactly, and asked again when it does not fit', () => {
  for (const [amount, accounts, currency, minor] of [['1.99', [usd], 'USD', 199], ['0.50', [cash], 'ARS', 50], ['10000', [cash], 'ARS', 1000000],
    ['0.01', [usd], 'USD', 1], ['45.9', [usd], 'USD', 4590], ['9999999999999.99', [cash], 'ARS', 999999999999999]] as const) {
    const draft = draftOf(resolveDraft(said({ amount }), [...accounts], [], 'ARS', day));
    assert.deepEqual([draft.currency, draft.amountMinor, draft.amount], [currency, minor, amount], amount);
    assert.equal(captured(draft, [...accounts]).amountMinor, minor, amount + ': captured exactly');
  }
  // More decimals than the currency has, or more digits than an amount may hold: the amount is asked again, the stated
  // decimal dropped from the parked draft (never rounded to 2.00 or cut), the currency already resolved kept.
  for (const amount of ['1.999', '0.001', '99999999999999']) {
    const question = asked(resolveDraft(said({ amount }), [cash], [], 'ARS', day), 'amount');
    assert.deepEqual([question.question, question.options, question.partial.amount, question.partial.amountMinor, question.partial.currency], ['assistant.clarify.amount', [], undefined, undefined, 'ARS'], amount);
  }
  // Trailing zeros past the currency's decimals are the same exact amount.
  assert.equal(draftOf(resolveDraft(said({ amount: '1.9900' }), [usd], [], 'ARS', day)).amountMinor, 199);
  // Parked before the currency is known (ARS and USD accounts, nothing said): the decimal travels unscaled and is scaled
  // by the currency the person chooses.
  const parked = asked(resolveDraft(said({ amount: '1.99' }), [cash, usd], [], 'ARS', day), 'currency');
  assert.deepEqual([parked.partial.amount, parked.partial.amountMinor], ['1.99', undefined]);
  const dollars = completeDraft(pendingOf(resolveDraft(said({ amount: '1.99' }), [cash, usd], [], 'ARS', day)), 'USD', [cash, usd], [], day);
  assert.deepEqual(dollars.content.kind === 'draft' ? [dollars.content.draft.currency, dollars.content.draft.amountMinor, dollars.content.draft.accountId] : null, ['USD', 199, 'usd']);
});

// Codex review of PR #100: with no destination in a currency the device can resolve (an empty ledger, or only accounts
// in a held currency), the currency is unknown, so the decimal is never scaled by the
// screen's stand-in: it stays parked exactly as stated, «1.999» included, and the destination is asked.
test('protocol v4: an unresolved currency never scales the decimal; it stays parked exactly as stated', () => {
  const heldOnly: Account = { id: 'kwd', name: 'Dinares', currency: 'KWD', openingMinor: 0, createdAt }; // a held currency since 25A-06
  for (const accounts of [[], [heldOnly]]) for (const amount of ['1.99', '1.999', '100']) {
    const question = asked(resolveDraft(said({ amount }), accounts, [], 'ARS', day), 'paymentMethod');
    assert.deepEqual([question.partial.amount, question.partial.amountMinor, question.partial.currencyInferred, question.options],
      [amount, undefined, false, []], `${amount} with ${accounts.length} account(s)`);
  }
});
