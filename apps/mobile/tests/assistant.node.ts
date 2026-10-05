import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import type { Account, Entry } from '@finanzapp/domain';
import { REASON_TEXT, SUGGESTIONS, answerContent, categoryOptions, classifyIntent, completeDraft, contentFromResult, conversationReducer,
  emptyConversation, evidenceLabel, optionText, ownsPending, resolveDraft, shouldAutoscroll, type ConversationState } from '../src/assistant/conversation.ts';
import { FACT_LABELS, monthlyEvidence } from '../src/integrations/evidence.ts';
import { integrationClient } from '../src/integrations/client.ts';
import { translator } from '../src/i18n/messages.ts';
import { bindLocale } from '../src/i18n/bind.ts';
import { assistantForEnvironment, disconnectedAssistant, failureMessage, failureReason, remoteAssistant, type AssistantEvent } from '../src/assistant/client.ts';
import { validateAssistantRequestV2, validateAssistantResultV2, type AssistantRequestV2 } from '../../../packages/integrations/assistant-protocol.js';
import type { CaptureDraft } from '../../../packages/integrations/contracts.js';
import { assistantForBuild } from '../src/assistant/runtime.ts';
import { FIXTURE_ANSWER, FIXTURE_CATEGORY_ANSWER, FIXTURE_CLARIFICATION, FIXTURE_DRAFT, FIXTURE_DRAFT_NO_ACCOUNT, FIXTURE_FACTS, FIXTURE_OUT_OF_SCOPE, fixtureAssistant,
  fixtureReply } from '../src/assistant/fixtures.ts';
import type { AssistantCapture, ClarificationContent } from '../src/assistant/conversation.ts';

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
/** A draft re-read with a gap a v2 proposal never leaves (no kind), parked as the screen parks a clarification. */
function parked(draft: CaptureDraft, accounts: Account[], incomeAccounts = accounts) {
  const resolved = resolveDraft(draft, accounts, entries, 'ARS', today, incomeAccounts);
  assert.ok(resolved.kind === 'clarification');
  return { field: resolved.field, pending: { draft: resolved.partial, field: resolved.field } };
}
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
  const done = run([{ type: 'answer', text: 'Gastaste $84.300 más que el mes pasado.', content: { kind: 'answer', rows: [], links: [], currency: 'ARS' } }], started);
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
  const named = resolveDraft(FIXTURE_DRAFT.proposals[0], [visa, cash, usd], entries, 'ARS', today);
  assert.equal(named.kind, 'draft');
  assert.equal(named.kind === 'draft' && named.draft.accountId, 'visa', 'matched by name, accent and case insensitive');
  assert.equal(named.kind === 'draft' && named.draft.dateISO, today, 'a missing date is today, shown as such');
  const ambiguous = resolveDraft(FIXTURE_DRAFT_NO_ACCOUNT.proposals[0], [visa, cash, usd], entries, 'ARS', today);
  assert.equal(ambiguous.kind, 'clarification');
  assert.equal(ambiguous.kind === 'clarification' && ambiguous.field, 'paymentMethod');
  assert.equal(ambiguous.kind === 'clarification' && ambiguous.question, 'assistant.clarify.paidWith', 'the app\'s own question is a catalogue key');
  assert.equal(es(ambiguous.kind === 'clarification' ? ambiguous.question : 'common.cancel'), '¿Con qué lo pagaste?');
  assert.deepEqual(ambiguous.kind === 'clarification' ? ambiguous.options.map(o => o.id) : [], ['visa', 'cash'], 'only accounts in the draft currency');
  const single = resolveDraft(FIXTURE_DRAFT_NO_ACCOUNT.proposals[0], [cash, usd], entries, 'ARS', today);
  assert.equal(single.kind === 'draft' && single.draft.accountId, 'cash', 'one eligible account is implied, not guessed among several');
  const noKind = resolveDraft({ ...FIXTURE_DRAFT.proposals[0], kind: null }, [visa], entries, 'ARS', today);
  assert.equal(noKind.kind === 'clarification' && noKind.field, 'kind');
  assert.deepEqual(noKind.kind === 'clarification' ? noKind.options.map(o => optionText(o)) : [], ['Gasto', 'Ingreso']);
  assert.deepEqual(noKind.kind === 'clarification' ? noKind.options.map(o => optionText(o, en)) : [], ['Expense', 'Income']);
  const noAmount = resolveDraft({ ...FIXTURE_DRAFT.proposals[0], amountMinor: null }, [visa], entries, 'ARS', today);
  assert.equal(noAmount.kind === 'clarification' && noAmount.field, 'amount');
  assert.equal(noAmount.kind === 'clarification' && noAmount.options.length, 0, 'an amount is typed, not picked');
  const noCategory = resolveDraft({ ...FIXTURE_DRAFT.proposals[0], category: null }, [visa], entries, 'ARS', today);
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
  assert.equal(next.pending, null);
  // Two gaps in a row (a parked draft without a kind; a v2 proposal always names one): kind first, then the account.
  const twoGaps = parked({ ...FIXTURE_DRAFT_NO_ACCOUNT.proposals[0], kind: null }, [visa, cash]);
  assert.equal(twoGaps.field, 'kind');
  const afterKind = completeDraft(twoGaps.pending!, 'expense', [visa, cash], entries, today);
  assert.equal(afterKind.content.kind === 'clarification' && afterKind.content.field, 'paymentMethod');
  assert.equal(afterKind.textKey, 'assistant.clarify.paidWith');
  assert.ok(afterKind.pending);
  const afterAccount = completeDraft(afterKind.pending!, 'visa', [visa, cash], entries, today);
  assert.equal(afterAccount.content.kind === 'draft' && afterAccount.content.draft.accountId, 'visa');
  assert.equal(afterAccount.content.kind === 'draft' && afterAccount.content.draft.kind, 'expense');
});

test('the reducer records a choice as the user\'s own words; a proposal\'s capture only moves forward and never confirms anything', () => {
  const asked = contentFromResult(FIXTURE_DRAFT_NO_ACCOUNT, [], [visa, cash], entries, 'ARS', today);
  const state = run([{ type: 'send', text: 'Gasté 18 mil en el súper' }, { type: 'answer', text: asked.text, textKey: asked.textKey, content: asked.content as ClarificationContent, pending: asked.pending }]);
  assert.equal(state.messages[1].role === 'assistant' && state.messages[1].textKey, 'assistant.clarify.paidWith');
  const clarification = state.messages[1];
  const resolved = completeDraft(state.pending!, 'visa', [visa, cash], entries, today);
  assert.equal(resolved.content.kind, 'draft', 'a resolved draft, which the screen turns into a proposal before it reaches the reducer');
  const capture: AssistantCapture = { id: 'item-1', writeId: 'write-1', captureKey: 'assistant:item-1', at: '2026-09-21T10:00:00.000Z',
    draft: { version: 1, source: 'assistant', capturedAt: '2026-09-21T10:00:00.000Z', kind: 'expense', amountMinor: 1800000, currency: null, merchant: 'Súper',
      category: 'Supermercado', dateISO: null, destinationId: 'visa', purchase: null, basis: [] } };
  const next = { ...resolved, content: { kind: 'proposal' as const, capture, status: 'capturing' as const } };
  const chosen = run([{ type: 'choose', messageId: clarification.id, optionId: 'visa', label: 'Visa Galicia', next }], state);
  assert.deepEqual(chosen.messages.map(message => message.role), ['user', 'assistant', 'user', 'assistant']);
  assert.equal(chosen.messages[1].role === 'assistant' && chosen.messages[1].content?.kind === 'clarification' && chosen.messages[1].content.chosen, 'visa');
  assert.equal(chosen.messages[2].text, 'Visa Galicia');
  const proposal = chosen.messages[3];
  const status = (s: ConversationState) => { const m = s.messages[3]; return m.role === 'assistant' && m.content?.kind === 'proposal' ? m.content.status : null; };
  assert.equal(status(chosen), 'capturing');
  // Choosing again on the same clarification is ignored.
  assert.equal(run([{ type: 'choose', messageId: clarification.id, optionId: 'cash', label: 'Efectivo', next }], chosen), chosen);
  const failed = run([{ type: 'proposal', messageId: proposal.id, status: 'failed' }], chosen);
  assert.equal(status(failed), 'failed');
  const captured = run([{ type: 'proposal', messageId: proposal.id, status: 'capturing' }, { type: 'proposal', messageId: proposal.id, status: 'captured' }], failed);
  assert.equal(status(captured), 'captured');
  // Captured is final: the review item is the source of truth from then on.
  assert.equal(run([{ type: 'proposal', messageId: proposal.id, status: 'failed' }], captured), captured);
  assert.equal(run([{ type: 'proposal', messageId: proposal.id, status: 'capturing' }], captured), captured);
  // A preview (the fixture view) never captures.
  const preview = run([{ type: 'choose', messageId: clarification.id, optionId: 'visa', label: 'Visa', next: { ...next, content: { ...next.content, status: 'preview' as const } } }], state);
  assert.equal(run([{ type: 'proposal', messageId: preview.messages[3].id, status: 'captured' }], preview), preview);
  // Nothing in the conversation builds or writes an Entry.
  const source = readFileSync(new URL('../src/assistant/conversation.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /entryFromDraft|validateEntry|addEntry|createEntry/);
});

test('answer rows and links come from the cited evidence: signed differences when both months are cited, absolute otherwise', () => {
  const content = answerContent(FIXTURE_ANSWER, FIXTURE_FACTS, 'ARS');
  assert.deepEqual(content.rows.map(row => [evidenceLabel(row), row.amountMinor, row.signed]), [
    ['Gastos registrados', 8430000, true], ['Restaurantes', 4250000, true], ['Supermercado', 3120000, true], ['Transporte', 890000, true]]);
  assert.deepEqual(content.rows.map(row => row.subject.kind), ['expenses', 'category', 'category', 'category'], 'rows are named from the fact id, not its label');
  assert.deepEqual(content.links.map(link => link.id), ['movements'], 'three categories cited: no single category link');
  const single = answerContent({ evidenceIds: ['current.category.1'] }, FIXTURE_FACTS, 'ARS');
  assert.deepEqual(single.rows.map(row => [evidenceLabel(row), row.amountMinor, row.signed]), [['Supermercado', 12120000, false]]);
  assert.deepEqual(single.links.map(link => link.id), ['category', 'movements']);
  assert.deepEqual(single.links[0].href, { pathname: '/spending-detail', params: { currency: 'ARS', startISO: '2026-09-01', endISO: '2026-09-21', category: 'Supermercado' } });
  const none = answerContent({ evidenceIds: [] }, FIXTURE_FACTS, 'ARS');
  assert.deepEqual(none, { kind: 'answer', rows: [], links: [], currency: 'ARS' }, 'prose without evidence gets no numbers and no links; it keeps the currency asked about');
  const unknown = answerContent({ evidenceIds: ['ghost'] }, FIXTURE_FACTS, 'ARS');
  assert.equal(unknown.rows.length, 0, 'an id that is not local evidence is ignored, never invented');
  const budget = answerContent({ evidenceIds: ['budget.total'] }, [{ id: 'budget.total', label: 'Presupuesto general', amountMinor: 1, count: 1, startISO: today, endISO: today }], 'ARS');
  assert.deepEqual(budget.links.map(link => link.id), ['budget', 'movements']);
  const unnamed = answerContent({ evidenceIds: ['current.budget.total'] }, [{ id: 'current.budget.total', label: 'Presupuesto general', amountMinor: 1, count: 1, startISO: today, endISO: today }], 'ARS');
  assert.equal(evidenceLabel(unnamed.rows[0], en), 'Presupuesto general', 'a fact this build cannot name shows its protocol label');
  const previousOnly = answerContent({ evidenceIds: ['previous.category.0'] }, FIXTURE_FACTS, 'ARS');
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
  const events = await collect(disconnectedAssistant().ask({ action: 'parse', text: 'x', todayISO: today, currency: 'ARS', region: 'AR', facts: [] }));
  assert.deepEqual(events, [{ type: 'error', reason: 'unavailable', message: '' }]);
  assert.equal(assistantForEnvironment({}).mode, 'disconnected');
  let fetched = 0;
  const withOrigin = assistantForEnvironment({ EXPO_PUBLIC_MOBILE_API_ORIGIN: 'https://finanzapp.example' }, undefined, (async () => { fetched += 1; throw new Error('never'); }) as unknown as typeof fetch);
  assert.equal(withOrigin.mode, 'disconnected', 'an origin without a session is still disconnected');
  const sessionless = await collect(withOrigin.ask({ action: 'parse', text: 'x', todayISO: today, currency: 'ARS', region: 'AR', facts: [] }));
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
    // The server's own copy of the evidence is never what the device shows: here it is tampered with.
    return { ok: true, status: 200, json: async () => ({ ...FIXTURE_ANSWER, evidenceIds: ['current.expenses'], evidence: [{ ...FIXTURE_FACTS[0], amountMinor: 1 }] }) };
  }) as unknown as typeof fetch;
  const client = remoteAssistant('https://finanzapp.example', async () => 'jwt', fetcher);
  assert.equal(client.mode, 'remote');
  const facts = FIXTURE_FACTS.slice(0, 1);
  const events = await collect(client.ask({ action: 'explain', text: '¿Por qué gasté más?', todayISO: today, currency: 'ARS', region: 'AR', facts }));
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://finanzapp.example/api/mobile/assistant');
  assert.equal(calls[0].auth, 'Bearer jwt');
  assert.equal(calls[0].body.version, 2);
  assert.match(calls[0].body.requestId, /^[A-Za-z0-9_-]{16,100}$/);
  assert.equal(calls[0].body.region, 'AR');
  assert.equal(events.length, 1);
  assert.equal(events[0].type, 'result');
  assert.deepEqual(events[0].type === 'result' && events[0].facts, facts, 'the evidence attached is the local fact the answer cites, never the server\'s copy');
  assert.equal(events[0].type === 'result' && 'evidence' in events[0].result, false);
  const refused = await collect(remoteAssistant('https://finanzapp.example', async () => 'jwt', (async () => ({ ok: false, status: 503 })) as unknown as typeof fetch)
    .ask({ action: 'parse', text: 'x', todayISO: today, currency: 'ARS', region: 'AR', facts: [] }));
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
  assert.deepEqual(await collect(client.ask({ action: 'parse', text: 'x', todayISO: today, currency: 'ARS', region: 'AR', facts: [] }, controller.signal)), []);
});

test('fixtures are scripted, stream word by word and stay out of the production client module', async () => {
  const client = fixtureAssistant(0);
  assert.equal(client.mode, 'fixture');
  const events = await collect(client.ask({ action: 'explain', text: '¿Por qué gasté más este mes?', todayISO: today, currency: 'ARS', region: 'AR', facts: [] }));
  assert.equal(events.at(-1)?.type, 'result');
  assert.equal(events.filter(event => event.type === 'delta').map(event => event.type === 'delta' ? event.text : '').join(''), FIXTURE_ANSWER.message);
  assert.equal('result' in fixtureReply({ action: 'parse', text: 'Gasté 18.500 en Carrefour con la Visa', todayISO: today, currency: 'ARS', region: 'AR', facts: [] }), true);
  const failed = await collect(client.ask({ action: 'parse', text: 'error', todayISO: today, currency: 'ARS', region: 'AR', facts: [] }));
  assert.deepEqual(failed.map(event => event.type), ['error']);
  const controller = new AbortController();
  const aborted = client.ask({ action: 'explain', text: '¿Por qué gasté más este mes?', todayISO: today, currency: 'ARS', region: 'AR', facts: [] }, controller.signal);
  const first = await aborted[Symbol.asyncIterator]().next();
  controller.abort();
  assert.equal(first.done, false);
  // Runtime separation: the production client module never imports the fixtures; only runtime.ts does, behind the development flag.
  const clientSource = readFileSync(new URL('../src/assistant/client.ts', import.meta.url), 'utf8');
  assert.equal(/from '\.\/fixtures/.test(clientSource), false);
  // 24UX6A: the Assistant is a root-stack screen opened from the capture hub, no longer a tab.
  const route = readFileSync(new URL('../app/assistant.tsx', import.meta.url), 'utf8');
  assert.equal(/fixtures/.test(route), false, 'the screen asks the runtime for a client and never touches fixtures');
  const session = readFileSync(new URL('../src/assistant/session.ts', import.meta.url), 'utf8');
  assert.equal(/fixtures/.test(session), false, 'the in-memory conversation session never touches fixtures');
});

test('English: the app\'s own words translate, the model\'s words, the user\'s data and the protocol stay as they are', async () => {
  // Evidence rows are named from the fact id; a built-in category name is resolved by the screen, a custom one is the user's.
  const content = answerContent(FIXTURE_ANSWER, FIXTURE_FACTS, 'ARS');
  const names: Record<string, string> = { Restaurantes: 'Restaurants', Supermercado: 'Groceries', Transporte: 'Transport' };
  assert.deepEqual(content.rows.map(row => evidenceLabel(row, en, stored => names[stored] ?? stored)), ['Recorded expenses', 'Restaurants', 'Groceries', 'Transport']);
  assert.equal(evidenceLabel(answerContent({ evidenceIds: ['previous.category.0'] }, [{ ...FIXTURE_FACTS[3], id: 'previous.category.0', label: FACT_LABELS.categoryPrefix + 'Kiosco Pepe' }], 'ARS').rows[0], en),
    'Kiosco Pepe (previous month)', 'a custom category is never translated');
  // The link to the category still carries the stored name, whatever the language.
  const single = answerContent({ evidenceIds: ['current.category.1'] }, FIXTURE_FACTS, 'ARS');
  assert.equal(single.links[0].href.params?.category, 'Supermercado');
  assert.deepEqual(single.links.map(link => en(`assistant.links.${link.id}`)), ['View category', 'View transactions']);
  // Clarifications and notes: keys that read in English; the model's message is never touched.
  const draft = contentFromResult(FIXTURE_DRAFT, [], [visa, cash], entries, 'ARS', today);
  assert.equal(draft.text, FIXTURE_DRAFT.message, 'the model\'s prose is content, stored as it arrived');
  assert.equal(draft.textKey, undefined);
  const asked = contentFromResult(FIXTURE_DRAFT_NO_ACCOUNT, [], [visa, cash], entries, 'ARS', today);
  assert.equal(en(asked.textKey!), 'What did you pay with?');
  assert.equal(en(completeDraft(asked.pending!, 'cash', [visa, cash], entries, today).textKey), 'Review the proposal before recording it.');
  const english = bindLocale('en-AR');
  assert.equal(english.errorText('assistant.reasons.offline'), 'No connection. Your transactions didn’t change; you can retry.');
  // The draft a proposal is made of does not depend on the language.
  const resolved = resolveDraft(FIXTURE_DRAFT.proposals[0], [visa, cash], entries, 'ARS', today);
  assert.equal(resolved.kind === 'draft' && resolved.draft.category, 'Supermercado');
  // Protocol: the facts sent to the server keep their Spanish labels.
  const snapshot: import('@finanzapp/domain').LedgerSnapshot = { accounts: [cash], entries: [
    { id: 'x1', accountId: 'cash', kind: 'expense', amountMinor: 1000, merchant: 'Coto', category: 'Supermercado', dateISO: '2026-09-02', createdAt }], transfers: [] };
  const facts = monthlyEvidence(snapshot, 'ARS', today);
  assert.ok(facts.some(fact => fact.label === 'Gastos registrados'));
  assert.ok(facts.some(fact => fact.label === 'Categoría de gasto: Supermercado'));
  // The integration client's own failures are keys, translated at display.
  assert.throws(() => integrationClient('http://insecure', async () => 't'), /^Error: assistant\.integration\.httpsOrigin$/);
  const signedOut = integrationClient('https://finanzapp.example', async () => null);
  await assert.rejects(signedOut.assistant({ action: 'parse', text: 'x', todayISO: today, currency: 'ARS', region: 'AR', facts: [] }), /^Error: assistant\.integration\.signIn$/);
  assert.equal(bindLocale('es-AR').errorText('assistant.integration.signIn'), 'Iniciá sesión para usar la integración. El registro manual sigue disponible.');
  assert.equal(english.errorText('assistant.integration.signIn'), 'Sign in to use the integration. Manual entry is still available.');
});

test('a failure carries only the integration client\'s own keys: a contract rejection or an engine message becomes the reason\'s note in the interface language', async () => {
  const origin = 'https://finanzapp.example';
  const ask = { action: 'parse' as const, text: 'Spent 12 at Target', todayISO: today, currency: 'ARS' as const, region: 'AR', facts: [] };
  const replying = (body: () => unknown, status = 200) => remoteAssistant(origin, async () => 'jwt', (async () => ({ ok: status < 400, status, json: async () => body() })) as unknown as typeof fetch);
  const failed = [{ type: 'error', reason: 'failed', message: '' }];
  // 200 with a result the protocol refuses (an answer to a parse): "Datos del asistente inválidos." never reaches the screen.
  assert.deepEqual(await collect(replying(() => ({ ...FIXTURE_ANSWER, evidenceIds: [] })).ask(ask)), failed);
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

test('25A-05: the client posts protocol v2 only: version 2, a fresh request id per ask (injectable), the configured region, no language', async () => {
  const bodies: any[] = [];
  const fetcher = (async (_url: string, init: any) => { bodies.push(JSON.parse(init.body)); return { ok: true, status: 200, json: async () => FIXTURE_CLARIFICATION }; }) as unknown as typeof fetch;
  const ask = { action: 'parse' as const, text: 'Spent 12 at Target', todayISO: today, currency: 'ARS' as const, region: 'US', facts: [] };
  const client = integrationClient('https://finanzapp.example', async () => 'jwt', fetcher);
  await client.assistant(ask);
  await client.assistant(ask);
  // Even a caller that still names version 1 posts version 2: the client sets it.
  await client.assistant({ ...ask, version: 1 } as unknown as typeof ask);
  assert.deepEqual(bodies.map(body => body.version), [2, 2, 2], 'never version 1');
  assert.ok(bodies.every(body => /^[A-Za-z0-9_-]{16,100}$/.test(body.requestId)));
  assert.equal(new Set(bodies.map(body => body.requestId)).size, 3, 'every ask has its own request id');
  assert.ok(bodies.every(body => body.region === 'US'), 'the region asked with');
  assert.deepEqual(Object.keys(bodies[0]).sort(), ['action', 'currency', 'facts', 'region', 'requestId', 'text', 'todayISO', 'version'], 'no language, no locale');
  let n = 0;
  const fixed = integrationClient('https://finanzapp.example', async () => 'jwt', fetcher, () => 'fixed-request-id-' + String(++n).padStart(4, '0'));
  await fixed.assistant(ask);
  assert.equal(bodies.at(-1).requestId, 'fixed-request-id-0001', 'the id generator is injected (the app passes expo-crypto\'s randomUUID)');
  // The wire shape is exactly the protocol's: a locale or a language is refused, so the server must accept one before any client sends it.
  const request: AssistantRequestV2 = bodies[0];
  assert.deepEqual(validateAssistantRequestV2(request), request);
  assert.throws(() => validateAssistantRequestV2({ ...request, locale: { language: 'en', region: 'US' } }));
  assert.throws(() => validateAssistantRequestV2({ ...request, replyLanguage: 'en-US' }));
  assert.throws(() => validateAssistantRequestV2({ ...request, language: 'en' }));
  // A request the protocol refuses never leaves the device (a region that is not two capitals, a bad id generator).
  const before = bodies.length;
  await assert.rejects(client.assistant({ ...ask, region: 'es-AR' }));
  await assert.rejects(integrationClient('https://finanzapp.example', async () => 'jwt', fetcher, () => 'short').assistant(ask));
  assert.equal(bodies.length, before);
  // The screen sends the interface's region and reaches the client through the runtime with expo-crypto's generator.
  const route = readFileSync(new URL('../app/assistant.tsx', import.meta.url), 'utf8');
  assert.match(route, /client\.ask\(\{ action, text, todayISO: day, currency, region, facts \}/);
  assert.match(route, /assistantForBuild\(undefined, undefined, randomUUID\)/);
});

test('25A-05: the device validates the server\'s reply again against its own request: anything the protocol refuses is a failure, nothing is shown', async () => {
  const origin = 'https://finanzapp.example';
  const replying = (body: unknown, status = 200) => remoteAssistant(origin, async () => 'jwt', (async () => ({ ok: status < 400, status, json: async () => body })) as unknown as typeof fetch);
  const parse = { action: 'parse' as const, text: 'Gasté 18.500 en Carrefour con la Visa', todayISO: today, currency: 'ARS' as const, region: 'AR', facts: [] };
  const explain = { ...parse, action: 'explain' as const, text: '¿Por qué gasté más?', facts: FIXTURE_FACTS };
  const failed = [{ type: 'error', reason: 'failed', message: '' }];
  const proposal = FIXTURE_DRAFT.proposals[0];
  const refused: [string, unknown, typeof parse | typeof explain][] = [
    ['an invented evidence id', { ...FIXTURE_ANSWER, evidenceIds: ['current.expenses', 'ghost'] }, explain],
    ['an account id in a proposal', { ...FIXTURE_DRAFT, proposals: [{ ...proposal, accountId: 'visa' }] }, parse],
    ['a card id in a proposal', { ...FIXTURE_DRAFT, proposals: [{ ...proposal, cardId: 'visa' }] }, parse],
    ['an account id beside the result', { ...FIXTURE_DRAFT, accountId: 'visa' }, parse],
    ['a URL in the message', { ...FIXTURE_DRAFT, message: 'Revisalo en https://finanzapp.example/x' }, parse],
    ['a markdown link in the message', { ...FIXTURE_ANSWER, message: 'Mirá [acá](budgets)' }, explain],
    ['two proposals', { ...FIXTURE_DRAFT, proposals: [proposal, proposal] }, parse],
    ['a proposal to a question', FIXTURE_DRAFT, explain],
    ['a future date', { ...FIXTURE_DRAFT, proposals: [{ ...proposal, dateISO: '2026-09-22' }] }, parse],
    ['an extra key', { ...FIXTURE_DRAFT, tool: 'sql' }, parse],
    ['a navigation intent to a fact it does not cite', { ...FIXTURE_CATEGORY_ANSWER, navigation: { target: 'category', factId: 'current.category.0' } }, explain],
    ['an answer to a sentence', FIXTURE_ANSWER, parse],
    ['not an object', null, parse],
  ];
  for (const [what, body, ask] of refused) assert.deepEqual(await collect(replying(body).ask(ask)), failed, what);
  // The same replies, well formed, pass; the server's extra `evidence` is dropped, not refused.
  assert.equal((await collect(replying({ ...FIXTURE_DRAFT, evidence: [] }).ask(parse)))[0].type, 'result');
  assert.equal((await collect(replying(FIXTURE_OUT_OF_SCOPE).ask(parse)))[0].type, 'result');
  // A duplicate request id (409), a request too large (413) and one the server refuses (422) are failures; 429 and 503 keep their reasons.
  for (const status of [409, 413, 422]) assert.deepEqual(await collect(replying({}, status).ask(parse)), [{ type: 'error', reason: 'failed', message: 'assistant.integration.failed' }], String(status));
  assert.deepEqual(await collect(replying({}, 429).ask(parse)), [{ type: 'error', reason: 'limit', message: 'assistant.integration.limit' }]);
  assert.deepEqual(await collect(replying({}, 503).ask(parse)), [{ type: 'error', reason: 'unavailable', message: 'assistant.integration.unavailable' }]);
});

test('25A-05: every development fixture is a valid protocol v2 result for the request it scripts', () => {
  const request = (action: 'parse' | 'explain', facts = action === 'explain' ? FIXTURE_FACTS : []) =>
    validateAssistantRequestV2({ version: 2, requestId: 'fixture-request-0001', action, text: 'x', todayISO: today, currency: 'ARS', region: 'AR', facts });
  for (const result of [FIXTURE_DRAFT, FIXTURE_DRAFT_NO_ACCOUNT, FIXTURE_CLARIFICATION, FIXTURE_OUT_OF_SCOPE]) assert.deepEqual(validateAssistantResultV2(result, request('parse')), result);
  for (const result of [FIXTURE_ANSWER, FIXTURE_CATEGORY_ANSWER]) assert.deepEqual(validateAssistantResultV2(result, request('explain')), result);
  const program = fixtureReply({ action: 'parse', text: 'Escribime un programa en Python', todayISO: today, currency: 'ARS', region: 'AR', facts: [] });
  assert.equal('result' in program && program.result, FIXTURE_OUT_OF_SCOPE, 'a programming request is out of scope');
});

test('25A-05: out of scope is the model\'s words alone; a clarification gets chips only from facts the device sent; a navigation intent never adds a link', () => {
  const outside = contentFromResult(FIXTURE_OUT_OF_SCOPE, FIXTURE_FACTS, [visa, cash], entries, 'ARS', today);
  assert.deepEqual(outside, { text: FIXTURE_OUT_OF_SCOPE.message, content: null, pending: null }, 'prose only: no draft, no evidence, no links');
  // Clarifications: the model's question as it arrived; a field the conversation knows, or none.
  const period = contentFromResult(FIXTURE_CLARIFICATION, [], [visa, cash], entries, 'ARS', today);
  assert.deepEqual(period, { text: FIXTURE_CLARIFICATION.message, content: { kind: 'clarification', field: null, options: [], chosen: null }, pending: null });
  const ask = (field: 'kind' | 'amount' | 'category' | 'destination' | 'currency', candidateIds: string[] = []) =>
    ({ ...FIXTURE_CLARIFICATION, clarification: { field, candidateIds } });
  const fieldOf = (result: ReturnType<typeof contentFromResult>) => result.content?.kind === 'clarification' ? result.content.field : 'none';
  assert.deepEqual((['kind', 'amount', 'category', 'destination', 'currency'] as const).map(field => fieldOf(contentFromResult(ask(field), [], [visa, cash], entries, 'ARS', today))),
    ['kind', 'amount', 'category', 'paymentMethod', null]);
  const candidates = contentFromResult(ask('category', ['current.category.1', 'current.expenses', 'ghost']), FIXTURE_FACTS, [visa, cash], entries, 'ARS', today);
  assert.equal(JSON.stringify(candidates.content?.kind === 'clarification' && candidates.content.options),
    JSON.stringify([{ id: 'current.category.1', label: 'Supermercado', category: 'expense' }, { id: 'current.expenses', labelKey: 'assistant.evidence.expenses' }]),
    'named like their evidence rows; an id that is no local fact is no chip');
  const unsent = contentFromResult(ask('category', ['current.category.1']), [], [visa, cash], entries, 'ARS', today);
  assert.equal(unsent.content?.kind === 'clarification' && unsent.content.options.length, 0, 'a candidate the device did not send is no option');
  assert.equal(unsent.pending, null, 'the model\'s clarification parks nothing');
  // Navigation: it may only move a link the cited evidence already gives first.
  const cited = { ...FIXTURE_CATEGORY_ANSWER, navigation: null };
  assert.deepEqual(answerContent(cited, FIXTURE_FACTS, 'ARS').links.map(link => link.id), ['category', 'movements']);
  const movementsFirst = answerContent({ ...cited, navigation: { target: 'movements', factId: 'current.category.1' } }, FIXTURE_FACTS, 'ARS');
  assert.deepEqual(movementsFirst.links.map(link => link.id), ['movements', 'category'], 'the intent picks which derived link comes first');
  assert.deepEqual(movementsFirst.links[1].href, answerContent(cited, FIXTURE_FACTS, 'ARS').links[0].href, 'the route is the one derived from the evidence');
  for (const navigation of [{ target: 'budget' as const, factId: 'current.category.1' }, { target: 'category' as const, factId: 'current.category.0' },
    { target: 'movements' as const, factId: 'ghost' }]) {
    assert.deepEqual(answerContent({ ...cited, navigation }, FIXTURE_FACTS, 'ARS').links.map(link => link.id), ['category', 'movements'], JSON.stringify(navigation) + ': never a new link or order');
  }
  const answered = contentFromResult({ ...cited, navigation: { target: 'movements', factId: 'current.category.1' } }, FIXTURE_FACTS, [visa, cash], entries, 'ARS', today);
  assert.deepEqual(answered.content?.kind === 'answer' && answered.content.links.map(link => link.id), ['movements', 'category']);
  // A proposal never carries an account: the device resolves the person's words against its own accounts, as before.
  const resolved = contentFromResult(FIXTURE_DRAFT, [], [visa, cash], entries, 'ARS', today);
  assert.equal(resolved.content?.kind === 'draft' && resolved.content.draft.accountId, 'visa');
});

test('24B6: an income draft is never implied to land on a card: with cash and a card, the cash account is implied for an income and the card is not offered; an expense still asks', () => {
  const income = { ...FIXTURE_DRAFT_NO_ACCOUNT.proposals[0], kind: 'income' as const, merchant: 'Sueldo', category: 'Sueldo' };
  const resolved = resolveDraft(income, [visa, cash], entries, 'ARS', today, [cash]);
  assert.equal(resolved.kind, 'draft', 'one eligible cash account: implied');
  assert.equal(resolved.kind === 'draft' && resolved.draft.accountId, 'cash');
  const expense = resolveDraft(FIXTURE_DRAFT_NO_ACCOUNT.proposals[0], [visa, cash], entries, 'ARS', today, [cash]);
  assert.equal(expense.kind === 'clarification' && expense.field, 'paymentMethod', 'an expense may go to the card, so it asks');
  assert.deepEqual(expense.kind === 'clarification' ? expense.options.map(o => o.id) : [], ['visa', 'cash']);
  const named = resolveDraft({ ...income, paymentMethodRef: 'visa' }, [visa, cash], entries, 'ARS', today, [cash]);
  assert.equal(named.kind === 'clarification' && named.field, 'paymentMethod', 'a card named for an income is not matched, and the only cash account is not implied in its place: it asks');
  assert.deepEqual(named.kind === 'clarification' ? named.options.map(o => o.id) : [], ['cash'], 'and never offers the card');
  // Through the reducer path: kind asked first, "income" chosen, then no account question with a single cash account.
  const asked = parked({ ...FIXTURE_DRAFT_NO_ACCOUNT.proposals[0], kind: null }, [visa, cash], [cash]);
  const afterKind = completeDraft(asked.pending!, 'income', [visa, cash], entries, today, [cash]);
  assert.equal(afterKind.content.kind === 'draft' && afterKind.content.draft.accountId, 'cash');
  const afterExpense = completeDraft(asked.pending!, 'expense', [visa, cash], entries, today, [cash]);
  assert.equal(afterExpense.content.kind === 'clarification' && afterExpense.content.field, 'paymentMethod');
  assert.equal(resolveDraft(income, [visa, cash], entries, 'ARS', today).kind, 'clarification', 'without the income list (older callers) nothing changes');
});

test('25A-04: a named payment method is resolved only against the named destinations: no match or several ask, never the only eligible account', () => {
  // The owner's fixture: «Gasté 18500 en Carrefour con la Visa» with a cash account «a» and cards «b» and «sksk»; nothing is the Visa.
  const a: Account = { id: 'a', name: 'a', currency: 'ARS', openingMinor: 0, createdAt };
  const b: Account = { id: 'b', name: 'b', currency: 'ARS', openingMinor: 0, createdAt };
  const sksk: Account = { id: 'sksk', name: 'sksk', currency: 'ARS', openingMinor: 0, createdAt };
  const fixture = resolveDraft(FIXTURE_DRAFT.proposals[0], [a, b, sksk], entries, 'ARS', today, [a]);
  assert.equal(fixture.kind === 'clarification' && fixture.field, 'paymentMethod', '«a» is a letter inside «Visa», not a match');
  assert.deepEqual(fixture.kind === 'clarification' ? fixture.options.map(o => o.id) : [], ['a', 'b', 'sksk']);
  const onlyCash = resolveDraft(FIXTURE_DRAFT.proposals[0], [cash], entries, 'ARS', today);
  assert.equal(onlyCash.kind === 'clarification' && onlyCash.field, 'paymentMethod', 'zero matches with one eligible cash account: asks, not the cash account');
  assert.deepEqual(onlyCash.kind === 'clarification' ? onlyCash.options.map(o => o.id) : [], ['cash']);
  assert.equal(onlyCash.kind === 'clarification' && onlyCash.partial.accountId, null);
  for (const words of ['Visa a crédito', 'débito a cuenta', 'la Visa']) {
    const extra = resolveDraft({ ...FIXTURE_DRAFT.proposals[0], paymentMethodRef: words }, [a, b, sksk], entries, 'ARS', today, [a]);
    assert.equal(extra.kind === 'clarification' && extra.field, 'paymentMethod', `«${words}»: the word «a» inside the reference is not account «a»`);
  }
  for (const symbol of ['💳', '$']) {
    const unnamed = resolveDraft({ ...FIXTURE_DRAFT.proposals[0], paymentMethodRef: symbol }, [a], entries, 'ARS', today, [a]);
    assert.equal(unnamed.kind === 'clarification' && unnamed.field, 'paymentMethod', `«${symbol}» names something that matches nothing: asks`);
  }
  const marks = resolveDraft({ ...FIXTURE_DRAFT.proposals[0], paymentMethodRef: 'गैस' }, [{ ...a, name: 'ग' }, b], entries, 'ARS', today);
  assert.equal(marks.kind === 'clarification' && marks.field, 'paymentMethod', 'a combining mark is part of the word, not a separator');
  const one = resolveDraft({ ...FIXTURE_DRAFT.proposals[0], paymentMethodRef: 'visa  GALICIA' }, [visa, cash], entries, 'ARS', today);
  assert.equal(one.kind === 'draft' && one.draft.accountId, 'visa', 'exactly one name match: that destination');
  assert.equal(one.kind === 'draft' && one.draft.destinationStated, true);
  const sole = resolveDraft({ ...FIXTURE_DRAFT.proposals[0], paymentMethodRef: 'Efectivo' }, [cash], entries, 'ARS', today);
  assert.equal(sole.kind === 'draft' && sole.draft.accountId, 'cash', 'a named destination that is also the only one: used, as stated');
  assert.equal(sole.kind === 'draft' && sole.draft.destinationStated, true);
  const visaMacro: Account = { id: 'visa-macro', name: 'Visa Macro', currency: 'ARS', openingMinor: 0, createdAt };
  const several = resolveDraft(FIXTURE_DRAFT.proposals[0], [visa, visaMacro, cash], entries, 'ARS', today);
  assert.equal(several.kind === 'clarification' && several.field, 'paymentMethod', 'two matches: asks');
  assert.deepEqual(several.kind === 'clarification' ? several.options.map(o => o.id) : [], ['visa', 'visa-macro', 'cash']);
  const implied = resolveDraft(FIXTURE_DRAFT_NO_ACCOUNT.proposals[0], [cash], entries, 'ARS', today);
  assert.equal(implied.kind === 'draft' && implied.draft.accountId, 'cash', 'nothing named and one eligible destination: still implied');
  assert.equal(implied.kind === 'draft' && implied.draft.destinationStated, false, 'implied, not stated');
  const blank = resolveDraft({ ...FIXTURE_DRAFT.proposals[0], paymentMethodRef: ' ' }, [cash], entries, 'ARS', today);
  assert.equal(blank.kind === 'draft' && blank.draft.accountId, 'cash', 'a blank reference names nothing');
  const income = resolveDraft({ ...FIXTURE_DRAFT.proposals[0], kind: 'income', paymentMethodRef: 'Visa Galicia' }, [visa, cash], entries, 'ARS', today, [cash]);
  assert.equal(income.kind === 'clarification' && income.field, 'paymentMethod', 'an income never resolves to a card, even one named exactly');
  assert.deepEqual(income.kind === 'clarification' ? income.options.map(o => o.id) : [], ['cash']);
  // Through the screen path: the clarification is answered and the draft takes the chosen destination, as stated.
  const asked = contentFromResult(FIXTURE_DRAFT, [], [a, b, sksk], entries, 'ARS', today, [a]);
  const chosen = completeDraft(asked.pending!, 'b', [a, b, sksk], entries, today, [a]);
  assert.equal(chosen.content.kind === 'draft' && chosen.content.draft.accountId, 'b');
  assert.equal(chosen.content.kind === 'draft' && chosen.content.draft.destinationStated, true);
  // A named destination survives an earlier question: kind asked first, the unmatched name still asks for the destination.
  const noKind = parked({ ...FIXTURE_DRAFT.proposals[0], kind: null }, [cash]);
  const afterKind = completeDraft(noKind.pending!, 'expense', [cash], entries, today);
  assert.equal(afterKind.content.kind === 'clarification' && afterKind.content.field, 'paymentMethod');
});

// Producto 24T3 (A25): the evidence stays additive and never negative. Spending is sent gross (purchase lines), plus one
// «Devoluciones» fact; the net is never a total. Synthetic fixtures through the real projection (`snapshotFromArchive`).
test('24T3 (A25): devoluciones reach the evidence as one positive «Devoluciones» fact; categories are gross, nothing is negative and the income count is unchanged', async () => {
  const domain = await import('@finanzapp/domain');
  const ropa: Entry = { id: 'ropa', accountId: 'cash', kind: 'expense', amountMinor: 80000, merchant: 'Tienda', category: 'Ropa', dateISO: '2026-08-10', createdAt };
  const comida: Entry = { id: 'comida', accountId: 'cash', kind: 'expense', amountMinor: 10000, merchant: 'Almacén', category: 'Comida', dateISO: '2026-09-10', createdAt };
  const sueldo: Entry = { id: 'sueldo', accountId: 'cash', kind: 'income', amountMinor: 300000, merchant: 'Empresa', category: 'Sueldo', dateISO: '2026-09-05', createdAt };
  const refund = (amountMinor: number, dateISO: string): import('@finanzapp/domain').EntryRefund => ({ id: 'dev-1', kind: 'refund', target: { entryId: 'ropa' }, accountId: 'cash',
    currency: 'ARS', amountMinor, dateISO, voided: false, createdAt, revision: 0, updatedAt: createdAt });
  const archive = (operations: import('@finanzapp/domain').PurchaseOperation[]) => domain.snapshotFromArchive({ accounts: [cash], records: [ropa, comida, sueldo].map(domain.initialRecord), purchaseOperations: operations });
  const without = monthlyEvidence(archive([]), 'ARS', today);
  // A devolución of August's purchase dated in September leaves September's Ropa at −30.000 and its net at −20.000.
  const facts = monthlyEvidence(archive([refund(30000, '2026-09-08')]), 'ARS', today);
  const byId = (list: typeof facts, id: string) => list.find(fact => fact.id === id);
  const report = domain.spendingReport(archive([refund(30000, '2026-09-08')]), 'ARS', '2026-09', today);
  assert.equal(report.status === 'ready' && report.expenseMinor, -20000, 'the report\'s net is below zero');
  assert.ok(facts.every(fact => fact.amountMinor >= 0 && fact.count >= 0), 'never a negative number');
  assert.deepEqual(byId(facts, 'current.expenses'), { ...byId(without, 'current.expenses'), amountMinor: 10000, count: 1 }, 'gross purchases, as without the devolución');
  assert.deepEqual(byId(facts, 'current.refunds'), { id: 'current.refunds', label: FACT_LABELS.refunds, amountMinor: 30000, count: 1, startISO: '2026-09-01', endISO: today });
  assert.equal(FACT_LABELS.refunds, 'Devoluciones', 'protocol data, Spanish whatever the interface language');
  assert.deepEqual(byId(facts, 'current.income'), byId(without, 'current.income'), 'a devolución never changes income or its count');
  assert.equal(byId(facts, 'current.income')!.count, 1);
  assert.deepEqual(facts.filter(fact => fact.id.startsWith('current.category.')).map(fact => [fact.label, fact.amountMinor, fact.count]), [['Categoría de gasto: Comida', 10000, 1]],
    'Ropa (only the devolución this month) is no gross category');
  assert.equal(byId(without, 'current.refunds'), undefined, 'no «Devoluciones» fact without one');
  assert.equal(byId(facts, 'previous.refunds'), undefined, 'August had none');
  // Net = gross − devoluciones: the facts reconcile with the report without ever sending the net.
  assert.equal(byId(facts, 'current.expenses')!.amountMinor - byId(facts, 'current.refunds')!.amountMinor, -20000);
  // The request the server receives passes protocol v2 (which refuses negatives) and stays within its 60 facts.
  assert.doesNotThrow(() => validateAssistantRequestV2({ version: 2, requestId: 'req-0000000000000001', action: 'explain', text: '¿Cuánto gasté?', todayISO: today, currency: 'ARS', region: 'AR', facts }));
  // A month made only of a devolución is still evidence (not an untracked month), with gross spending 0.
  const only = monthlyEvidence(domain.snapshotFromArchive({ accounts: [cash], records: [ropa].map(domain.initialRecord), purchaseOperations: [refund(5000, '2026-09-08')] }), 'ARS', today);
  assert.deepEqual(only.filter(fact => fact.id.startsWith('current.')).map(fact => [fact.id, fact.amountMinor, fact.count]),
    [['current.expenses', 0, 0], ['current.income', 0, 0], ['current.refunds', 5000, 1]]);
});

// Security review of 25A-05.
test('25A-05: a chip on an older clarification never completes, clears or changes the draft parked behind a newer one', () => {
  const ask: ClarificationContent = { kind: 'clarification', field: null, options: [{ id: 'current.category.0', label: 'Restaurantes' }], chosen: null };
  const parked = resolveDraft({ ...FIXTURE_DRAFT.proposals[0], category: null }, [visa, cash], entries, 'ARS', today);
  assert.ok(parked.kind === 'clarification' && parked.field === 'category');
  let state = conversationReducer(emptyConversation, { type: 'send', text: '¿Este mes o el año?' });
  state = conversationReducer(state, { type: 'answer', text: '¿Qué período?', content: ask });
  const older = state.messages.at(-1)!.id;
  state = conversationReducer(state, { type: 'send', text: 'Gasté 18500 en Carrefour con la Visa' });
  state = conversationReducer(state, { type: 'answer', text: '', textKey: parked.question,
    content: { kind: 'clarification', field: parked.field, options: parked.options, chosen: null }, pending: { draft: parked.partial, field: parked.field } });
  const newer = state.messages.at(-1)!.id;
  assert.equal(ownsPending(state, older), false);
  assert.equal(ownsPending(state, newer), true);
  const after = conversationReducer(state, { type: 'choose', messageId: older, optionId: 'current.category.0', label: 'Restaurantes', next: null });
  assert.equal(JSON.stringify(after.pending), JSON.stringify(state.pending), 'the newer question still holds its draft, untouched');
  assert.equal(after.messages.at(-1)!.role, 'user');
});

test('25A-05: a payment reference made only of a preposition or article names no account («con la» is not «La Caja»)', () => {
  const caja: Account = { id: 'caja', name: 'La Caja', currency: 'ARS', openingMinor: 0, createdAt };
  for (const ref of ['con la', 'la', 'my', 'con']) {
    const resolved = resolveDraft({ ...FIXTURE_DRAFT.proposals[0], paymentMethodRef: ref }, [caja, cash], entries, 'ARS', today);
    assert.ok(resolved.kind === 'clarification' && resolved.field === 'paymentMethod', ref);
  }
  const named = resolveDraft({ ...FIXTURE_DRAFT.proposals[0], paymentMethodRef: 'con la Caja' }, [caja, cash], entries, 'ARS', today);
  assert.ok(named.kind === 'draft' && named.draft.accountId === 'caja');
});

test('25A-05: a stored category name the protocol refuses is left out of the evidence, and every other fact still travels', () => {
  const snapshot: import('@finanzapp/domain').LedgerSnapshot = { accounts: [cash], entries: [
    { id: 'x1', accountId: 'cash', kind: 'expense', amountMinor: 1000, merchant: 'Coto', category: 'Supermercado', dateISO: '2026-09-02', createdAt },
    { id: 'x2', accountId: 'cash', kind: 'expense', amountMinor: 2000, merchant: 'Kiosco', category: 'a\u2068b\u2069', dateISO: '2026-09-03', createdAt }], transfers: [] };
  const facts = monthlyEvidence(snapshot, 'ARS', today);
  assert.ok(facts.some(fact => fact.label === 'Categoría de gasto: Supermercado'));
  assert.ok(!facts.some(fact => fact.label.includes('\u2068')));
  assert.doesNotThrow(() => validateAssistantRequestV2({ version: 2, requestId: 'fixture-request-0001', action: 'explain', text: '¿Cuánto gasté?', todayISO: today, currency: 'ARS', region: 'AR', facts }));
});
