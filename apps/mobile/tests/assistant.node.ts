import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import type { Account, Entry } from '@finanzapp/domain';
import { REASON_TEXT, SUGGESTIONS, answerContent, categoryOptions, classifyIntent, completeDraft, contentFromResult, conversationReducer, draftGaps,
  emptyConversation, entryFromDraft, evidenceLabel, optionText, resolveDraft, shouldAutoscroll, type ConversationState } from '../src/assistant/conversation.ts';
import { FACT_LABELS, monthlyEvidence } from '../src/integrations/evidence.ts';
import { integrationClient } from '../src/integrations/client.ts';
import { translator } from '../src/i18n/messages.ts';
import { bindLocale } from '../src/i18n/bind.ts';
import { assistantForEnvironment, disconnectedAssistant, failureMessage, failureReason, remoteAssistant, type AssistantEvent } from '../src/assistant/client.ts';
import { validateAssistantRequest } from '../../../packages/integrations/contracts.js';
import { assistantForBuild } from '../src/assistant/runtime.ts';
import { FIXTURE_ANSWER, FIXTURE_DRAFT, FIXTURE_DRAFT_NO_ACCOUNT, FIXTURE_FACTS, fixtureAssistant, fixtureReply } from '../src/assistant/fixtures.ts';

// Producto 21: the Assistant conversation model, its client boundary and the
// fixtures, as pure Node tests. No React, no SQLite, no network.
const createdAt = '2026-09-01T12:00:00.000Z';
const today = '2026-09-21';
const visa: Account = { id: 'visa', name: 'Visa Galicia', currency: 'ARS', openingMinor: 0, createdAt };
const cash: Account = { id: 'cash', name: 'Efectivo', currency: 'ARS', openingMinor: 500000, createdAt };
const usd: Account = { id: 'usd', name: 'Dólares', currency: 'USD', openingMinor: 10000, createdAt };
const entries: Entry[] = [
  { id: 'e1', accountId: 'cash', kind: 'expense', amountMinor: 1000, merchant: 'Kiosco', category: 'Comida', dateISO: '2026-09-02', createdAt },
  { id: 'e2', accountId: 'cash', kind: 'expense', amountMinor: 1000, merchant: 'Kiosco', category: 'comida', dateISO: '2026-09-03', createdAt },
  { id: 'e3', accountId: 'visa', kind: 'expense', amountMinor: 1000, merchant: 'Coto', category: 'Supermercado', dateISO: '2026-09-04', createdAt },
  { id: 'e4', accountId: 'cash', kind: 'income', amountMinor: 1000, merchant: 'Sueldo', category: 'Trabajo', dateISO: '2026-09-05', createdAt },
];
const es = translator('es');
const en = translator('en');
const run = (actions: Parameters<typeof conversationReducer>[1][], from: ConversationState = emptyConversation) => actions.reduce(conversationReducer, from);
async function collect(events: AsyncIterable<AssistantEvent>) { const out: AssistantEvent[] = []; for await (const event of events) out.push(event); return out; }

test('an empty conversation offers at most four suggestions and no messages', () => {
  assert.equal(emptyConversation.messages.length, 0);
  assert.ok(SUGGESTIONS.length >= 3 && SUGGESTIONS.length <= 4);
  assert.equal(emptyConversation.phase, 'idle');
});

test('send adds the user message, clears the composer and enters thinking; a blank send is ignored', () => {
  const composed = run([{ type: 'compose', text: '  ' }, { type: 'send', text: '  ' }]);
  assert.equal(composed.messages.length, 0);
  const sent = run([{ type: 'compose', text: 'Gasté 18.500 en Carrefour' }, { type: 'send', text: 'Gasté 18.500 en Carrefour' }]);
  assert.equal(sent.messages.length, 1);
  assert.equal(sent.messages[0].role, 'user');
  assert.equal(sent.composer, '');
  assert.equal(sent.phase, 'thinking');
  // A second send while the first is in flight does nothing.
  assert.equal(run([{ type: 'send', text: 'otra' }], sent), sent);
});

test('streaming grows one assistant message in place, the answer finalizes it and stop keeps the partial text', () => {
  const started = run([{ type: 'send', text: 'hola' }, { type: 'delta', text: 'Gastaste ' }, { type: 'delta', text: '$84.300 más' }]);
  assert.equal(started.phase, 'streaming');
  assert.equal(started.messages.length, 2);
  const streaming = started.messages[1];
  assert.equal(streaming.role, 'assistant');
  assert.equal(streaming.role === 'assistant' && streaming.status, 'streaming');
  assert.equal(streaming.text, 'Gastaste $84.300 más');
  const done = run([{ type: 'answer', text: 'Gastaste $84.300 más que el mes pasado.', content: { kind: 'answer', rows: [], links: [] } }], started);
  assert.equal(done.messages.length, 2, 'the final answer replaces the streaming message rather than adding one');
  assert.equal(done.messages[1].role === 'assistant' && done.messages[1].status, 'done');
  assert.equal(done.phase, 'idle');
  const stopped = run([{ type: 'stop' }], started);
  assert.equal(stopped.phase, 'idle');
  assert.equal(stopped.messages[1].role === 'assistant' && stopped.messages[1].status, 'stopped');
  assert.equal(stopped.messages[1].text, 'Gastaste $84.300 más');
  // Stopping before any token arrived leaves no empty bubble behind.
  const early = run([{ type: 'send', text: 'hola' }, { type: 'stop' }]);
  assert.equal(early.messages.length, 1);
});

test('a disconnected build keeps the exact text in the composer and shows one calm note; a remote failure keeps the message and offers retry', () => {
  const text = '  Gasté 18.500 en Carrefour con la Visa ';
  const unavailable = run([{ type: 'compose', text }, { type: 'send', text }, { type: 'fail', reason: 'unavailable', text: 'No conectado', sent: text }]);
  assert.equal(unavailable.composer, text, 'nothing left the device, so the words go back untouched');
  assert.equal(unavailable.messages.length, 1);
  assert.equal(unavailable.messages[0].role, 'system');
  assert.equal(unavailable.messages[0].role === 'system' && unavailable.messages[0].retryText, null);
  assert.equal(unavailable.phase, 'idle');
  const offline = run([{ type: 'send', text }, { type: 'delta', text: '' }, { type: 'fail', reason: 'offline', text: 'Sin conexión', sent: text }]);
  assert.deepEqual(offline.messages.map(message => message.role), ['user', 'system'], 'an empty streaming bubble is dropped, the user message stays');
  assert.equal(offline.messages[1].role === 'system' && offline.messages[1].retryText, text);
  assert.equal(offline.composer, '');
});

test('reset returns to the empty conversation without reusing ids', () => {
  const state = run([{ type: 'send', text: 'a' }, { type: 'answer', text: 'b', content: null }, { type: 'reset' }]);
  assert.equal(state.messages.length, 0);
  assert.ok(state.nextId > emptyConversation.nextId);
});

test('questions are explained against evidence; sentences are parsed as actions', () => {
  for (const t of [es, en]) {
    const suggestions = SUGGESTIONS.map(key => t(key));
    for (const question of suggestions.filter(s => s.includes('?'))) assert.equal(classifyIntent(question), 'explain', question);
    assert.equal(classifyIntent(t('assistant.suggestions.recordExpense')), 'parse');
  }
  assert.equal(classifyIntent('how much did I spend on food'), 'explain');
  assert.equal(classifyIntent('cuánto gasté en comida'), 'explain');
  assert.equal(classifyIntent('Cómo voy con el presupuesto'), 'explain');
  assert.equal(classifyIntent('Registrar un gasto'), 'parse');
  assert.equal(classifyIntent('Gasté 18.500 en Carrefour con la Visa'), 'parse');
});

test('autoscroll follows new content only when the reader is already near the end', () => {
  assert.equal(shouldAutoscroll(0, 400, 600), true, 'short content always sits at the end');
  assert.equal(shouldAutoscroll(1050, 1700, 600), true, 'within the threshold');
  assert.equal(shouldAutoscroll(200, 1700, 600), false, 'scrolled up to read: never pulled down');
});

test('a draft with a named account resolves; with several possible accounts it asks instead of guessing', () => {
  const named = resolveDraft(FIXTURE_DRAFT.draft!, [visa, cash, usd], entries, 'ARS', today);
  assert.equal(named.kind, 'draft');
  assert.equal(named.kind === 'draft' && named.draft.accountId, 'visa', 'matched by name, accent and case insensitive');
  assert.equal(named.kind === 'draft' && named.draft.dateISO, today, 'a missing date is today, shown as such');
  const ambiguous = resolveDraft(FIXTURE_DRAFT_NO_ACCOUNT.draft!, [visa, cash, usd], entries, 'ARS', today);
  assert.equal(ambiguous.kind, 'clarification');
  assert.equal(ambiguous.kind === 'clarification' && ambiguous.field, 'paymentMethod');
  assert.equal(ambiguous.kind === 'clarification' && ambiguous.question, 'assistant.clarify.paidWith', 'the app\'s own question is a catalogue key');
  assert.equal(es(ambiguous.kind === 'clarification' ? ambiguous.question : 'common.cancel'), '¿Con qué lo pagaste?');
  assert.deepEqual(ambiguous.kind === 'clarification' ? ambiguous.options.map(o => o.id) : [], ['visa', 'cash'], 'only accounts in the draft currency');
  const single = resolveDraft(FIXTURE_DRAFT_NO_ACCOUNT.draft!, [cash, usd], entries, 'ARS', today);
  assert.equal(single.kind === 'draft' && single.draft.accountId, 'cash', 'one eligible account is implied, not guessed among several');
  const noKind = resolveDraft({ ...FIXTURE_DRAFT.draft!, kind: null }, [visa], entries, 'ARS', today);
  assert.equal(noKind.kind === 'clarification' && noKind.field, 'kind');
  assert.deepEqual(noKind.kind === 'clarification' ? noKind.options.map(o => optionText(o)) : [], ['Gasto', 'Ingreso']);
  assert.deepEqual(noKind.kind === 'clarification' ? noKind.options.map(o => optionText(o, en)) : [], ['Expense', 'Income']);
  const noAmount = resolveDraft({ ...FIXTURE_DRAFT.draft!, amountMinor: null }, [visa], entries, 'ARS', today);
  assert.equal(noAmount.kind === 'clarification' && noAmount.field, 'amount');
  assert.equal(noAmount.kind === 'clarification' && noAmount.options.length, 0, 'an amount is typed, not picked');
  const noCategory = resolveDraft({ ...FIXTURE_DRAFT.draft!, category: null }, [visa], entries, 'ARS', today);
  assert.equal(noCategory.kind === 'clarification' && noCategory.field, 'category');
  assert.deepEqual(noCategory.kind === 'clarification' ? noCategory.options.map(o => o.label) : [], ['Comida', 'Supermercado'], 'recorded expense categories, most used first, spelling-insensitive');
});

test('choosing an option completes the parked draft, or asks the next question, and the draft still needs confirmation', () => {
  const asked = contentFromResult(FIXTURE_DRAFT_NO_ACCOUNT, [], [visa, cash], entries, 'ARS', today);
  assert.equal(asked.content?.kind, 'clarification');
  assert.equal(asked.textKey, 'assistant.clarify.paidWith');
  assert.equal(asked.text, '', 'no Spanish sentence is stored for the app\'s own question');
  assert.ok(asked.pending);
  const next = completeDraft(asked.pending!, 'cash', [visa, cash], entries, today);
  assert.equal(next.content.kind, 'draft');
  assert.equal(next.content.kind === 'draft' && next.content.draft.accountId, 'cash');
  assert.equal(next.content.kind === 'draft' && next.content.status, 'pending');
  assert.equal(next.pending, null);
  // Two gaps in a row: kind first, then the account.
  const twoGaps = contentFromResult({ ...FIXTURE_DRAFT_NO_ACCOUNT, draft: { ...FIXTURE_DRAFT_NO_ACCOUNT.draft!, kind: null } }, [], [visa, cash], entries, 'ARS', today);
  assert.equal(twoGaps.content?.kind === 'clarification' && twoGaps.content.field, 'kind');
  const afterKind = completeDraft(twoGaps.pending!, 'expense', [visa, cash], entries, today);
  assert.equal(afterKind.content.kind === 'clarification' && afterKind.content.field, 'paymentMethod');
  assert.equal(afterKind.textKey, 'assistant.clarify.paidWith');
  assert.ok(afterKind.pending);
  const afterAccount = completeDraft(afterKind.pending!, 'visa', [visa, cash], entries, today);
  assert.equal(afterAccount.content.kind === 'draft' && afterAccount.content.draft.accountId, 'visa');
  assert.equal(afterAccount.content.kind === 'draft' && afterAccount.content.draft.kind, 'expense');
});

test('the reducer records a choice as the user\'s own words and never confirms a draft on its own', () => {
  const asked = contentFromResult(FIXTURE_DRAFT_NO_ACCOUNT, [], [visa, cash], entries, 'ARS', today);
  const state = run([{ type: 'send', text: 'Gasté 18 mil en el súper' }, { type: 'answer', text: asked.text, textKey: asked.textKey, content: asked.content, pending: asked.pending }]);
  assert.equal(state.messages[1].role === 'assistant' && state.messages[1].textKey, 'assistant.clarify.paidWith');
  const clarification = state.messages[1];
  const next = completeDraft(state.pending!, 'visa', [visa, cash], entries, today);
  const chosen = run([{ type: 'choose', messageId: clarification.id, optionId: 'visa', label: 'Visa Galicia', next }], state);
  assert.deepEqual(chosen.messages.map(message => message.role), ['user', 'assistant', 'user', 'assistant']);
  assert.equal(chosen.messages[1].role === 'assistant' && chosen.messages[1].content?.kind === 'clarification' && chosen.messages[1].content.chosen, 'visa');
  assert.equal(chosen.messages[2].text, 'Visa Galicia');
  const draft = chosen.messages[3];
  assert.equal(draft.role === 'assistant' && draft.content?.kind === 'draft' && draft.content.status, 'pending');
  // Choosing again on the same clarification is ignored.
  assert.equal(run([{ type: 'choose', messageId: clarification.id, optionId: 'cash', label: 'Efectivo', next }], chosen), chosen);
  const confirmed = run([{ type: 'draft-confirmed', messageId: draft.id, entryId: 'entry-1' }], chosen);
  assert.equal(confirmed.messages[3].role === 'assistant' && confirmed.messages[3].content?.kind === 'draft' && confirmed.messages[3].content.status, 'confirmed');
  assert.equal(confirmed.messages[3].role === 'assistant' && confirmed.messages[3].content?.kind === 'draft' && confirmed.messages[3].content.entryId, 'entry-1');
  const cancelled = run([{ type: 'draft-cancelled', messageId: draft.id }], chosen);
  assert.equal(cancelled.messages[3].role === 'assistant' && cancelled.messages[3].content?.kind === 'draft' && cancelled.messages[3].content.status, 'cancelled');
  // A cancelled draft cannot be confirmed afterwards.
  assert.equal(run([{ type: 'draft-confirmed', messageId: draft.id, entryId: 'x' }], cancelled), cancelled);
});

test('a confirmed draft becomes exactly one Entry for the domain to validate; gaps block it', () => {
  const resolved = resolveDraft(FIXTURE_DRAFT.draft!, [visa, cash], entries, 'ARS', today);
  assert.equal(resolved.kind, 'draft');
  const draft = resolved.kind === 'draft' ? resolved.draft : null!;
  assert.deepEqual(draftGaps(draft), []);
  const entry = entryFromDraft(draft, 'op-1', '2026-09-21T10:00:00.000Z');
  assert.deepEqual(entry, { id: 'op-1', accountId: 'visa', kind: 'expense', amountMinor: 1850000, merchant: 'Carrefour', category: 'Supermercado', dateISO: today, createdAt: '2026-09-21T10:00:00.000Z' });
  assert.deepEqual(draftGaps({ ...draft, merchant: ' ', accountId: null }), ['merchant', 'account']);
  assert.throws(() => entryFromDraft({ ...draft, accountId: null }, 'op-2', createdAt), /^Error: assistant\.draft\.accountRequired$/);
  assert.equal(bindLocale('es-AR').errorText('assistant.draft.accountRequired'), 'Elegí con qué cuenta se pagó antes de confirmar.');
});

test('answer rows and links come from the cited evidence: signed differences when both months are cited, absolute otherwise', () => {
  const content = answerContent(FIXTURE_ANSWER, FIXTURE_FACTS, 'ARS');
  assert.deepEqual(content.rows.map(row => [evidenceLabel(row), row.amountMinor, row.signed]), [
    ['Gastos registrados', 8430000, true], ['Restaurantes', 4250000, true], ['Supermercado', 3120000, true], ['Transporte', 890000, true]]);
  assert.deepEqual(content.rows.map(row => row.subject.kind), ['expenses', 'category', 'category', 'category'], 'rows are named from the fact id, not its label');
  assert.deepEqual(content.links.map(link => link.id), ['movements'], 'three categories cited: no single category link');
  const single = answerContent({ factIds: ['current.category.1'] }, FIXTURE_FACTS, 'ARS');
  assert.deepEqual(single.rows.map(row => [evidenceLabel(row), row.amountMinor, row.signed]), [['Supermercado', 12120000, false]]);
  assert.deepEqual(single.links.map(link => link.id), ['category', 'movements']);
  assert.deepEqual(single.links[0].href, { pathname: '/spending-detail', params: { currency: 'ARS', startISO: '2026-09-01', endISO: '2026-09-21', category: 'Supermercado' } });
  const none = answerContent({ factIds: [] }, FIXTURE_FACTS, 'ARS');
  assert.deepEqual(none, { kind: 'answer', rows: [], links: [] }, 'prose without evidence gets no numbers and no links');
  const unknown = answerContent({ factIds: ['ghost'] }, FIXTURE_FACTS, 'ARS');
  assert.equal(unknown.rows.length, 0, 'an id that is not local evidence is ignored, never invented');
  const budget = answerContent({ factIds: ['budget.total'] }, [{ id: 'budget.total', label: 'Presupuesto general', amountMinor: 1, count: 1, startISO: today, endISO: today }], 'ARS');
  assert.deepEqual(budget.links.map(link => link.id), ['budget', 'movements']);
  const unnamed = answerContent({ factIds: ['current.budget.total'] }, [{ id: 'current.budget.total', label: 'Presupuesto general', amountMinor: 1, count: 1, startISO: today, endISO: today }], 'ARS');
  assert.equal(evidenceLabel(unnamed.rows[0], en), 'Presupuesto general', 'a fact this build cannot name shows its protocol label');
  const previousOnly = answerContent({ factIds: ['previous.category.0'] }, FIXTURE_FACTS, 'ARS');
  assert.equal(evidenceLabel(previousOnly.rows[0]), 'Restaurantes (mes anterior)');
});

test('categoryOptions counts by identity and caps the chips', () => {
  assert.deepEqual(categoryOptions(entries, 'expense', 1).map(o => o.label), ['Comida']);
  assert.deepEqual(categoryOptions(entries, 'income').map(o => o.label), ['Trabajo']);
  // A chip carries its kind, so the screen finds an income preset (Sueldo) as income, never as an expense category.
  assert.deepEqual(categoryOptions(entries, 'income').map(o => o.category), ['income']);
  assert.deepEqual(categoryOptions(entries, 'expense').map(o => o.category), ['expense', 'expense']);
});

test('the disconnected client sends nothing and reports unavailable; a fixture-free environment stays disconnected', async () => {
  const events = await collect(disconnectedAssistant().ask({ action: 'parse', text: 'x', todayISO: today, currency: 'ARS', facts: [] }));
  assert.deepEqual(events, [{ type: 'error', reason: 'unavailable', message: '' }]);
  assert.equal(assistantForEnvironment({}).mode, 'disconnected');
  let fetched = 0;
  const withOrigin = assistantForEnvironment({ EXPO_PUBLIC_MOBILE_API_ORIGIN: 'https://finanzapp.example' }, undefined, (async () => { fetched += 1; throw new Error('never'); }) as unknown as typeof fetch);
  assert.equal(withOrigin.mode, 'disconnected', 'an origin without a session is still disconnected');
  const sessionless = await collect(withOrigin.ask({ action: 'parse', text: 'x', todayISO: today, currency: 'ARS', facts: [] }));
  assert.equal(sessionless[0].type === 'error' && sessionless[0].reason, 'session');
  assert.equal(fetched, 0);
  assert.equal(assistantForEnvironment({ EXPO_PUBLIC_MOBILE_API_ORIGIN: 'http://insecure' }, async () => 't').mode, 'disconnected', 'a non-HTTPS origin is refused by the integration client');
  // The production runtime never selects fixtures, even with the flag, outside a development bundle.
  assert.equal(assistantForBuild({ EXPO_PUBLIC_ASSISTANT_FIXTURES: '1' }, false).mode, 'disconnected');
  assert.equal(assistantForBuild({}, true).mode, 'disconnected');
  assert.equal(assistantForBuild({ EXPO_PUBLIC_ASSISTANT_FIXTURES: '1' }, true).mode, 'fixture');
});

test('the remote client wraps the existing endpoint contract and maps failures to reasons', async () => {
  const calls: { url: string; body: any; auth: string }[] = [];
  const fetcher = (async (url: string, init: any) => {
    calls.push({ url, body: JSON.parse(init.body), auth: init.headers.Authorization });
    return { ok: true, status: 200, json: async () => ({ ...FIXTURE_ANSWER, factIds: ['current.expenses'] }) };
  }) as unknown as typeof fetch;
  const client = remoteAssistant('https://finanzapp.example', async () => 'jwt', fetcher);
  assert.equal(client.mode, 'remote');
  const facts = FIXTURE_FACTS.slice(0, 1);
  const events = await collect(client.ask({ action: 'explain', text: '¿Por qué gasté más?', todayISO: today, currency: 'ARS', facts }));
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://finanzapp.example/api/mobile/assistant');
  assert.equal(calls[0].auth, 'Bearer jwt');
  assert.equal(calls[0].body.version, 1);
  assert.equal(events.length, 1);
  assert.equal(events[0].type, 'result');
  assert.deepEqual(events[0].type === 'result' && events[0].facts, facts, 'the evidence attached is the local fact the answer cites');
  const refused = await collect(remoteAssistant('https://finanzapp.example', async () => 'jwt', (async () => ({ ok: false, status: 503 })) as unknown as typeof fetch)
    .ask({ action: 'parse', text: 'x', todayISO: today, currency: 'ARS', facts: [] }));
  assert.equal(refused[0].type === 'error' && refused[0].reason, 'unavailable');
  assert.equal(failureReason(Object.assign(new Error('x'), { name: 'AbortError' })), 'offline');
  assert.equal(failureReason(new TypeError('Network request failed')), 'offline');
  assert.equal(failureReason(new Error('Llegaste al límite de uso.')), 'limit');
  assert.equal(failureReason(new Error('Iniciá sesión para usar la integración.')), 'session');
  assert.equal(failureReason(new Error('boom')), 'failed');
  // The integration client throws catalogue keys; classification reads the key, never translated copy.
  assert.equal(failureReason(new Error('assistant.integration.limit')), 'limit');
  assert.equal(failureReason(new Error('assistant.integration.unavailable')), 'unavailable');
  assert.equal(failureReason(new Error('assistant.integration.signIn')), 'session');
  assert.equal(failureReason(new Error('assistant.integration.failed')), 'failed');
  // An aborted ask yields nothing after the abort: the screen stopped listening.
  const controller = new AbortController();
  controller.abort();
  assert.deepEqual(await collect(client.ask({ action: 'parse', text: 'x', todayISO: today, currency: 'ARS', facts: [] }, controller.signal)), []);
});

test('fixtures are scripted, stream word by word and stay out of the production client module', async () => {
  const client = fixtureAssistant(0);
  assert.equal(client.mode, 'fixture');
  const events = await collect(client.ask({ action: 'explain', text: '¿Por qué gasté más este mes?', todayISO: today, currency: 'ARS', facts: [] }));
  assert.equal(events.at(-1)?.type, 'result');
  assert.equal(events.filter(event => event.type === 'delta').map(event => event.type === 'delta' ? event.text : '').join(''), FIXTURE_ANSWER.message);
  assert.equal('result' in fixtureReply({ action: 'parse', text: 'Gasté 18.500 en Carrefour con la Visa', todayISO: today, currency: 'ARS', facts: [] }), true);
  const failed = await collect(client.ask({ action: 'parse', text: 'error', todayISO: today, currency: 'ARS', facts: [] }));
  assert.deepEqual(failed.map(event => event.type), ['error']);
  const controller = new AbortController();
  const aborted = client.ask({ action: 'explain', text: '¿Por qué gasté más este mes?', todayISO: today, currency: 'ARS', facts: [] }, controller.signal);
  const first = await aborted[Symbol.asyncIterator]().next();
  controller.abort();
  assert.equal(first.done, false);
  // Runtime separation: the production client module never imports the fixtures; only runtime.ts does, behind the development flag.
  const clientSource = readFileSync(new URL('../src/assistant/client.ts', import.meta.url), 'utf8');
  assert.equal(/from '\.\/fixtures/.test(clientSource), false);
  const route = readFileSync(new URL('../app/(tabs)/assistant.tsx', import.meta.url), 'utf8');
  assert.equal(/fixtures/.test(route), false, 'the screen asks the runtime for a client and never touches fixtures');
});

test('English: the app\'s own words translate, the model\'s words, the user\'s data and the protocol stay as they are', async () => {
  // Evidence rows are named from the fact id; a built-in category name is resolved by the screen, a custom one is the user's.
  const content = answerContent(FIXTURE_ANSWER, FIXTURE_FACTS, 'ARS');
  const names: Record<string, string> = { Restaurantes: 'Restaurants', Supermercado: 'Groceries', Transporte: 'Transport' };
  assert.deepEqual(content.rows.map(row => evidenceLabel(row, en, stored => names[stored] ?? stored)), ['Recorded expenses', 'Restaurants', 'Groceries', 'Transport']);
  assert.equal(evidenceLabel(answerContent({ factIds: ['previous.category.0'] }, [{ ...FIXTURE_FACTS[3], id: 'previous.category.0', label: FACT_LABELS.categoryPrefix + 'Kiosco Pepe' }], 'ARS').rows[0], en),
    'Kiosco Pepe (previous month)', 'a custom category is never translated');
  // The link to the category still carries the stored name, whatever the language.
  const single = answerContent({ factIds: ['current.category.1'] }, FIXTURE_FACTS, 'ARS');
  assert.equal(single.links[0].href.params?.category, 'Supermercado');
  assert.deepEqual(single.links.map(link => en(`assistant.links.${link.id}`)), ['View category', 'View transactions']);
  // Clarifications and notes: keys that read in English; the model's message is never touched.
  const draft = contentFromResult(FIXTURE_DRAFT, [], [visa, cash], entries, 'ARS', today);
  assert.equal(draft.text, FIXTURE_DRAFT.message, 'the model\'s prose is content, stored as it arrived');
  assert.equal(draft.textKey, undefined);
  const asked = contentFromResult(FIXTURE_DRAFT_NO_ACCOUNT, [], [visa, cash], entries, 'ARS', today);
  assert.equal(en(asked.textKey!), 'What did you pay with?');
  assert.equal(en(completeDraft(asked.pending!, 'cash', [visa, cash], entries, today).textKey), 'Review the draft before saving it.');
  const english = bindLocale('en-AR');
  assert.equal(english.errorText('assistant.reasons.offline'), 'No connection. Your transactions didn’t change; you can retry.');
  assert.equal(english.errorText('assistant.draft.accountRequired'), 'Choose the account you paid with before confirming.');
  // The Entry a confirmed draft becomes does not depend on the language.
  const resolved = resolveDraft(FIXTURE_DRAFT.draft!, [visa, cash], entries, 'ARS', today);
  assert.deepEqual(entryFromDraft(resolved.kind === 'draft' ? resolved.draft : null!, 'op-1', createdAt).category, 'Supermercado');
  // Protocol: the facts sent to the server keep their Spanish labels.
  const snapshot: import('@finanzapp/domain').LedgerSnapshot = { accounts: [cash], entries: [
    { id: 'x1', accountId: 'cash', kind: 'expense', amountMinor: 1000, merchant: 'Coto', category: 'Supermercado', dateISO: '2026-09-02', createdAt }], transfers: [] };
  const facts = monthlyEvidence(snapshot, 'ARS', today);
  assert.ok(facts.some(fact => fact.label === 'Gastos registrados'));
  assert.ok(facts.some(fact => fact.label === 'Categoría de gasto: Supermercado'));
  // The integration client's own failures are keys, translated at display.
  assert.throws(() => integrationClient('http://insecure', async () => 't'), /^Error: assistant\.integration\.httpsOrigin$/);
  const signedOut = integrationClient('https://finanzapp.example', async () => null);
  await assert.rejects(signedOut.assistant({ version: 1, action: 'parse', text: 'x', todayISO: today, currency: 'ARS', facts: [] }), /^Error: assistant\.integration\.signIn$/);
  assert.equal(bindLocale('es-AR').errorText('assistant.integration.signIn'), 'Iniciá sesión para usar la integración. El registro manual sigue disponible.');
  assert.equal(english.errorText('assistant.integration.signIn'), 'Sign in to use the integration. Manual entry is still available.');
});

test('a failure carries only the integration client\'s own keys: a contract rejection or an engine message becomes the reason\'s note in the interface language', async () => {
  const origin = 'https://finanzapp.example';
  const ask = { action: 'parse' as const, text: 'Spent 12 at Target', todayISO: today, currency: 'ARS' as const, facts: [] };
  const replying = (body: () => unknown, status = 200) => remoteAssistant(origin, async () => 'jwt', (async () => ({ ok: status < 400, status, json: async () => body() })) as unknown as typeof fetch);
  const failed = [{ type: 'error', reason: 'failed', message: '' }];
  // 200 with a result the contract refuses (an answer to a parse): "Datos de captura inválidos." never reaches the screen.
  assert.deepEqual(await collect(replying(() => ({ kind: 'answer', message: 'x', draft: null, factIds: [] })).ask(ask)), failed);
  // 200 with a body that is not JSON: the engine's English text never reaches a Spanish screen.
  assert.deepEqual(await collect(replying(() => JSON.parse('<html>')).ask(ask)), failed);
  // A request the contract refuses before sending (more than 2 000 characters).
  assert.deepEqual(await collect(replying(() => ({})).ask({ ...ask, text: 'a'.repeat(2001) })), failed);
  // The client's own keys still pass and are translated at display.
  assert.deepEqual(await collect(replying(() => ({}), 500).ask(ask)), [{ type: 'error', reason: 'failed', message: 'assistant.integration.failed' }]);
  assert.equal(failureMessage(new Error('assistant.integration.limit')), 'assistant.integration.limit');
  assert.equal(failureMessage(new Error('Datos de captura inválidos.')), '');
  assert.equal(failureMessage(new Error('assistant.integration.limit extra')), '', 'a key, whole, or nothing');
  assert.equal(failureMessage('assistant.integration.failed'), '', 'only an Error carries a key');
  assert.equal(bindLocale('en-US').errorText(REASON_TEXT.failed), 'The request couldn’t be completed. Your transactions didn’t change.');
  // The development fixtures fail the same way, and the English chips reach the same scripted replies (still Spanish: content).
  for (const [text, reason] of [['error', 'failed'], ['offline', 'offline'], ['sin conexión', 'offline'], ['limit', 'limit'], ['límite', 'limit']] as const) {
    assert.deepEqual(await collect(fixtureAssistant(0).ask({ ...ask, text })), [{ type: 'error', reason, message: '' }], text);
  }
  const explain = { ...ask, action: 'explain' as const };
  const why = fixtureReply({ ...explain, text: en('assistant.suggestions.whySpentMore') });
  assert.equal(why, fixtureReply({ ...explain, text: es('assistant.suggestions.whySpentMore') }));
  assert.equal('result' in why && why.result, FIXTURE_ANSWER, 'the scripted answer, still in Spanish');
  assert.equal(fixtureReply({ ...explain, text: en('assistant.suggestions.foodSpending') }), fixtureReply({ ...explain, text: es('assistant.suggestions.foodSpending') }));
});

test('the v1 Assistant contract carries no language: a locale is refused, so the server must accept it before any client sends it', () => {
  const request = { version: 1, action: 'parse', text: 'Spent 12 at Target', todayISO: today, currency: 'ARS', facts: [] };
  assert.deepEqual(validateAssistantRequest(request), request, 'the validated request is the exact wire shape the client posts');
  assert.throws(() => validateAssistantRequest({ ...request, locale: { language: 'en', region: 'US' } }));
  assert.throws(() => validateAssistantRequest({ ...request, replyLanguage: 'en-US' }));
  assert.throws(() => validateAssistantRequest({ ...request, language: 'en' }));
});
