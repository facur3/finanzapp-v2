import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as domain from '@finanzapp/domain';
import * as conversation from '../src/assistant/conversation.ts';
import * as evidence from '../src/integrations/evidence.ts';
import * as liabilityPresentation from '../src/ui/liability-presentation.ts';
import * as presentation from '../src/ui/presentation.ts';
import * as moneyInput from '../src/ui/money-input.ts';
import type { AssistantClient, AssistantEvent } from '../src/assistant/client.ts';
import { disconnectedAssistant } from '../src/assistant/client.ts';
import { FIXTURE_ANSWER, FIXTURE_DRAFT, FIXTURE_DRAFT_NO_ACCOUNT, FIXTURE_FACTS, fixtureAssistant } from '../src/assistant/fixtures.ts';
import * as i18nFormat from '../src/i18n/format.ts';
import { bindLocale } from '../src/i18n/bind.ts';
import type { AppLocale } from '../src/i18n/locale.ts';
const es = bindLocale('es-AR');

// Producto 21: the Assistant screen's handlers, with React, native hosts and the
// UI modules replaced by descriptors and a scripted client. Not a rendered
// iOS screen: keyboard, VoiceOver order and gestures need the iPhone.
type Node = { type: any; props: Record<string, any> };
const createdAt = '2026-09-01T12:00:00.000Z';
const visa: domain.Account = { id: 'visa', name: 'Visa Galicia', currency: 'ARS', openingMinor: 0, createdAt };
const cash: domain.Account = { id: 'cash', name: 'Efectivo', currency: 'ARS', openingMinor: 500000, createdAt };
const usd: domain.Account = { id: 'usd', name: 'Dólares', currency: 'USD', openingMinor: 10000, createdAt };
const entries: domain.Entry[] = [
  { id: 'e1', accountId: 'cash', kind: 'expense', amountMinor: 1000, merchant: 'Kiosco', category: 'Comida', dateISO: '2026-09-02', createdAt },
  { id: 'e2', accountId: 'visa', kind: 'expense', amountMinor: 2000, merchant: 'Coto', category: 'Supermercado', dateISO: '2026-08-04', createdAt },
];

/** A client the test drives by hand: it resolves whatever events the test queues, when the test says so. */
function scriptedClient(mode: AssistantClient['mode'] = 'remote') {
  const asks: any[] = [];
  const signals: (AbortSignal | undefined)[] = [];
  let queue: AssistantEvent[] = [];
  let release: (() => void) | null = null;
  const client: AssistantClient = { mode, async *ask(input, signal) {
    asks.push(input);
    signals.push(signal);
    await new Promise<void>(resolve => { release = resolve; });
    for (const event of queue) { if (signal?.aborted) return; yield event; }
  } };
  return { client, asks, signals, reply(events: AssistantEvent[]) { queue = events; release?.(); release = null; }, get waiting() { return release !== null; } };
}

function harness({ client, accounts = [visa, cash, usd], data = entries, params = {}, reduced = false, addEntry, locale = 'es-AR', deviceLanguage = null }: {
  client: AssistantClient; accounts?: domain.Account[]; data?: domain.Entry[]; params?: Record<string, string>; reduced?: boolean; addEntry?: (entry: domain.Entry) => Promise<void>; locale?: AppLocale;
  /** The device's first language, for `speechLanguage` (null: nothing read, so it is never set). */
  deviceLanguage?: string | null;
}) {
  let i18n = bindLocale(locale, 'none', deviceLanguage);
  const i18nProvider = { useI18n: () => i18n };
  const source = readFileSync(new URL('../app/(tabs)/assistant.tsx', import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const jsx = (type: unknown, props: Record<string, unknown>) => ({ type, props });
  const state: unknown[] = [];
  const pushed: any[] = [];
  const written: domain.Entry[] = [];
  const scrolled: any[] = [];
  const haptics: string[] = [];
  const effects: (() => void)[] = [];
  let cursor = 0;
  const slot = (initial: () => unknown) => { const index = cursor++; if (!(index in state)) state[index] = initial(); return index; };
  const snapshot: domain.LedgerSnapshot = { accounts, entries: data, transfers: [] };
  const modules: Record<string, unknown> = {
    '../i18n/format': i18nFormat, '../src/i18n/format': i18nFormat, '../../src/i18n/format': i18nFormat, '../i18n/provider': i18nProvider, '../src/i18n/provider': i18nProvider, '../../src/i18n/provider': i18nProvider,
    react: {
      useState: (initial: unknown) => { const index = slot(() => typeof initial === 'function' ? (initial as () => unknown)() : initial); return [state[index], (value: unknown) => { state[index] = typeof value === 'function' ? (value as (c: unknown) => unknown)(state[index]) : value; }]; },
      useReducer: (reducer: (s: unknown, a: unknown) => unknown, initial: unknown) => { const index = slot(() => initial); return [state[index], (action: unknown) => { state[index] = reducer(state[index], action); }]; },
      useRef: (initial: unknown) => { const index = slot(() => ({ current: initial })); return state[index]; },
      useMemo: (fn: () => unknown) => fn(), useCallback: (fn: unknown) => fn,
      // Like React: an effect runs on mount and again only when a dependency changed, after its previous
      // cleanup. So an effect that aborted the request on a language change (deps [t]) would really abort here.
      useEffect: (fn: () => unknown, deps?: unknown[]) => {
        const index = slot(() => ({ deps: null as unknown[] | null, cleanup: undefined as unknown }));
        const cell = state[index] as { deps: unknown[] | null; cleanup: unknown };
        if (cell.deps && deps && deps.length === cell.deps.length && deps.every((dep, i) => Object.is(dep, cell.deps![i]))) return;
        if (typeof cell.cleanup === 'function') (cell.cleanup as () => void)();
        cell.cleanup = fn();
        cell.deps = deps ?? null;
        if (typeof cell.cleanup === 'function') effects.push(cell.cleanup as () => void);
      },
    },
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'react-native': { View: 'View', FlatList: 'FlatList' },
    'expo-router': { Tabs: { Screen: 'Tabs.Screen' }, useLocalSearchParams: () => params, router: { push: (to: unknown) => pushed.push(to) } },
    'expo-crypto': { randomUUID: () => 'uuid-' + (written.length + 1) },
    '@finanzapp/domain': domain,
    '../src/assistant/runtime': { assistantForBuild: () => client },
    '../src/assistant/conversation': conversation,
    '../src/integrations/evidence': evidence,
    '../src/storage/LedgerProvider': { useLedger: () => ({ snapshot, archive: { accounts, records: [], debts: [] }, addEntry: addEntry ?? (async (entry: domain.Entry) => { written.push(entry); }) }) },
    '../src/ui/assistant-composer': { AssistantComposer: 'AssistantComposer' },
    '../src/ui/assistant-messages': Object.fromEntries(['AnswerEvidence', 'AssistantText', 'ClarificationChoices', 'DraftCard', 'Suggestions', 'SystemNote', 'UserMessage'].map(n => [n, n])),
    '../src/ui/components': { AppText: 'AppText', IconButton: 'IconButton' },
    '../src/ui/liability-presentation': liabilityPresentation,
    '../src/ui/money-input': moneyInput,
    '../src/ui/motion': { Appear: 'Appear', impactHaptic: () => haptics.push('impact'), successHaptic: () => haptics.push('success') },
    '../src/ui/presentation': presentation,
    '../src/ui/theme': { space: { xs: 4, s: 8, m: 12, l: 16, xl: 20, xxl: 24, xxxl: 32 }, useCurrentDay: () => '2026-09-21', useReduceMotion: () => reduced,
      usePalette: () => ({ background: '#F2F2F6', warning: '#B45309', warningSoft: '#FCF1E0', isDark: false }) },
  };
  // The screen is a tab root now, one level deeper than the stack routes.
  for (const name of Object.keys(modules)) if (name.startsWith('../src/')) modules['../' + name] = modules[name];
  const module = { exports: {} as { default?: () => Node } };
  runInNewContext(code, { module, exports: module.exports, Error, AbortController, Promise, Map, Date, require: (name: string) => {
    if (!Object.hasOwn(modules, name)) throw new Error('Unexpected assistant dependency: ' + name);
    return modules[name];
  } });
  const render = () => {
    cursor = 0;
    const root = module.exports.default!();
    const list = nodes(root).find(node => node.type === 'FlatList')!;
    // Give the list a ref so scrollToEnd can be observed, then render each message through renderItem.
    list.props.ref.current = { scrollToEnd: (options: unknown) => scrolled.push(options) };
    const items: Node[] = list.props.data.map((item: unknown) => list.props.renderItem({ item }));
    const composer = nodes(root).find(node => node.type === 'AssistantComposer')!;
    const screen = nodes(root).find(node => node.type === 'Tabs.Screen')!;
    return { root, list, items, composer, screen, empty: list.props.ListEmptyComponent as Node, messages: list.props.data as conversation.Message[] };
  };
  return { render, pushed, written, scrolled, haptics, effects, setLocale: (next: AppLocale) => { i18n = bindLocale(next, 'none', deviceLanguage); } };
}
function nodes(value: any): Node[] {
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!value.props) return [];
  return [value, ...nodes(value.props.children), ...nodes(value.props.ListEmptyComponent), ...nodes(value.props.note)];
}
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
const settle = async () => { for (let i = 0; i < 6; i++) await tick(); };
const find = (items: Node[], type: string) => items.flatMap(nodes).filter(node => node.type === type);

test('a new conversation is quiet: no messages, four suggestions, an empty composer and no New chat button', () => {
  const view = harness({ client: disconnectedAssistant() });
  const { messages, empty, composer, screen, list } = view.render();
  assert.equal(messages.length, 0);
  assert.equal(empty.type, 'Suggestions');
  assert.deepEqual([...empty.props.items], conversation.SUGGESTIONS.map(key => es.t(key)));
  assert.deepEqual([...empty.props.items], ['¿Por qué gasté más este mes?', '¿Cuánto gasté en comida?', 'Registrar un gasto', '¿Cómo voy con mi presupuesto?']);
  assert.equal(empty.props.items.length, 4);
  assert.equal(composer.props.value, '');
  assert.equal(composer.props.busy, false);
  assert.equal(screen.props.options.title, 'Asistente');
  assert.equal(screen.props.options.headerRight, undefined);
  assert.equal(list.props.contentContainerStyle.justifyContent, 'center', 'the empty composition sits in the middle, not at the top');
  assert.equal(list.props.keyboardDismissMode, 'interactive');
  assert.equal(list.props.contentInsetAdjustmentBehavior, 'automatic');
  // The disconnected build says so under the composer, in one caption, before anyone sends.
  const note = nodes(composer.props.note).find(node => node.type === 'AppText')!;
  assert.match(String(note.props.children), /No conectado en esta versión/);
});

test('in the disconnected build a suggestion or a typed message never leaves the device: the words return to the composer and one note explains', async () => {
  const view = harness({ client: disconnectedAssistant() });
  let screen = view.render();
  screen.empty.props.onPick('¿Cuánto gasté en comida?');
  await settle();
  screen = view.render();
  assert.equal(screen.messages.length, 1);
  assert.equal(screen.messages[0].role, 'system');
  assert.equal(screen.messages[0].role === 'system' && screen.messages[0].reason, 'unavailable');
  assert.equal(screen.composer.props.value, '¿Cuánto gasté en comida?', 'the suggestion is kept as the draft');
  assert.equal(screen.items[0].props.children.type, 'SystemNote');
  assert.equal(screen.composer.props.note, null, 'the caption under the composer is not repeated once the note is in the thread');
  assert.deepEqual(view.haptics, ['impact'], 'one subtle haptic on send');
  // Typing keeps the exact text, spaces included, and the send is again refused without a request.
  screen.composer.props.onChange('  Gasté 500 en el kiosco ');
  screen = view.render();
  assert.equal(screen.composer.props.value, '  Gasté 500 en el kiosco ');
  screen.composer.props.onSend();
  await settle();
  screen = view.render();
  assert.equal(screen.composer.props.value, '  Gasté 500 en el kiosco ');
  assert.deepEqual(screen.messages.map(message => message.role), ['system', 'system']);
  assert.equal(view.written.length, 0);
  assert.equal(view.pushed.length, 0);
});

test('the composer is busy while a request is in flight, streaming grows one message, and Stop aborts it keeping the partial text', async () => {
  const scripted = scriptedClient();
  const view = harness({ client: scripted.client });
  let screen = view.render();
  screen.composer.props.onChange('¿Por qué gasté más este mes?');
  screen = view.render();
  screen.composer.props.onSend();
  await tick();
  screen = view.render();
  assert.equal(screen.composer.props.busy, true);
  assert.equal(screen.composer.props.value, '');
  assert.equal(screen.messages.length, 1, 'the user message is in the thread while thinking');
  assert.equal(screen.messages[0].text, '¿Por qué gasté más este mes?');
  assert.equal(scripted.asks[0].action, 'explain', 'a question is explained');
  assert.ok(Array.isArray(scripted.asks[0].facts), 'with on-device evidence');
  assert.equal(scripted.asks[0].currency, 'ARS');
  assert.equal(scripted.asks[0].todayISO, '2026-09-21');
  assert.equal(scripted.asks[0].text, '¿Por qué gasté más este mes?');
  assert.equal(screen.empty.props.disabled, true, 'suggestions cannot start a second request');
  assert.equal(typeof screen.screen.props.options.headerRight, 'function', 'New chat appears once there is a conversation');
  scripted.reply([{ type: 'delta', text: 'Gastaste ' }, { type: 'delta', text: 'más ' }]);
  await settle();
  screen = view.render();
  const streaming = screen.items[1];
  const text = find([streaming], 'AssistantText')[0];
  assert.equal(text.props.status, 'streaming');
  assert.equal(text.props.text, 'Gastaste más ');
  assert.equal(screen.composer.props.busy, true);
  // Stop: the request is aborted, the partial answer stays and is marked as interrupted, the composer is free again.
  screen.composer.props.onStop();
  screen = view.render();
  assert.equal(screen.composer.props.busy, false);
  assert.equal(find([screen.items[1]], 'AssistantText')[0].props.status, 'stopped');
  assert.equal(find([screen.items[1]], 'AssistantText')[0].props.text, 'Gastaste más ');
  assert.equal(screen.messages.length, 2);
});

test('an answer renders its text and evidence rows/links from the cited facts, and a link opens the FinanzApp screen', async () => {
  const scripted = scriptedClient();
  const view = harness({ client: scripted.client });
  let screen = view.render();
  screen.empty.props.onPick('¿Por qué gasté más este mes?');
  await tick();
  scripted.reply([{ type: 'result', result: FIXTURE_ANSWER, facts: FIXTURE_FACTS }]);
  await settle();
  screen = view.render();
  assert.equal(screen.messages.length, 2);
  const answer = screen.items[1];
  assert.equal(find([answer], 'AssistantText')[0].props.status, 'done');
  assert.equal(find([answer], 'AssistantText')[0].props.text, FIXTURE_ANSWER.message);
  const proof = find([answer], 'AnswerEvidence')[0];
  assert.deepEqual(proof.props.content.rows.map((row: any) => conversation.evidenceLabel(row)), ['Gastos registrados', 'Restaurantes', 'Supermercado', 'Transporte']);
  assert.equal(proof.props.content.rows[1].amountMinor, 4250000);
  assert.equal(proof.props.content.currency, 'ARS', 'the rows keep the currency the facts were computed in');
  assert.deepEqual(proof.props.content.links.map((link: any) => link.id), ['movements']);
  proof.props.onOpen(proof.props.content.links[0].href);
  assert.deepEqual(view.pushed, ['/activity']);
  assert.equal(screen.composer.props.busy, false);
  // A single-category answer links the category's dated expenses.
  const single = scriptedClient();
  const view2 = harness({ client: single.client });
  view2.render().empty.props.onPick('¿Cuánto gasté en comida?');
  await tick();
  single.reply([{ type: 'result', result: { kind: 'answer', draft: null, message: 'En Supermercado llevás $121.200.', factIds: ['current.category.1'] }, facts: FIXTURE_FACTS }]);
  await settle();
  const links = find([view2.render().items[1]], 'AnswerEvidence')[0].props.content.links;
  assert.deepEqual(links.map((link: any) => link.id), ['category', 'movements']);
  find([view2.render().items[1]], 'AnswerEvidence')[0].props.onOpen(links[0].href);
  assert.equal(JSON.stringify(view2.pushed.at(-1)), JSON.stringify({ pathname: '/spending-detail', params: { currency: 'ARS', startISO: '2026-09-01', endISO: '2026-09-21', category: 'Supermercado' } }));
});

test('a structured draft renders as a card and writes nothing until Confirmar; confirming validates with the domain and writes exactly once', async () => {
  const scripted = scriptedClient();
  const view = harness({ client: scripted.client });
  let screen = view.render();
  screen.composer.props.onChange('Gasté 18.500 en Carrefour con la Visa');
  screen = view.render();
  screen.composer.props.onSend();
  await tick();
  assert.equal(scripted.asks[0].action, 'parse', 'a sentence is parsed');
  assert.equal(scripted.asks[0].facts.length, 0, 'parse sends no evidence');
  scripted.reply([{ type: 'result', result: FIXTURE_DRAFT, facts: [] }]);
  await settle();
  screen = view.render();
  const card = find([screen.items[1]], 'DraftCard')[0];
  assert.ok(card, 'the draft card is rendered');
  assert.equal(card.props.content.status, 'pending');
  assert.equal(JSON.stringify(card.props.content.draft), JSON.stringify({ kind: 'expense', amountMinor: 1850000, currency: 'ARS', merchant: 'Carrefour', category: 'Supermercado', dateISO: '2026-09-21', accountId: 'visa' }));
  assert.deepEqual(card.props.accounts.map((account: domain.Account) => account.id), ['visa', 'cash', 'usd']);
  assert.equal(view.written.length, 0, 'rendering a draft never writes');
  assert.equal(card.props.busy, false);
  card.props.onConfirm();
  await settle();
  screen = view.render();
  assert.equal(view.written.length, 1, 'confirm wrote exactly one entry');
  const entry = view.written[0];
  assert.doesNotThrow(() => domain.validateEntry(entry, [visa, cash, usd]));
  assert.equal(entry.accountId, 'visa');
  assert.equal(entry.amountMinor, 1850000);
  assert.equal(entry.merchant, 'Carrefour');
  assert.equal(entry.dateISO, '2026-09-21');
  assert.deepEqual(view.haptics, ['impact', 'success']);
  const confirmed = find([screen.items[1]], 'DraftCard')[0];
  assert.equal(confirmed.props.content.status, 'confirmed');
  assert.equal(confirmed.props.content.entryId, entry.id);
  confirmed.props.onOpenEntry(entry.id);
  assert.equal(JSON.stringify(view.pushed.at(-1)), JSON.stringify({ pathname: '/entry/[id]', params: { id: entry.id } }));
  // A second confirm on the same card is a no-op: the reducer refuses a status change and the screen wrote once.
  confirmed.props.onConfirm();
  await settle();
  assert.equal(view.written.length, 1);
});

test('a failed confirm keeps the draft pending and a retry reuses the same Entry id; Descartar collapses it without writing', async () => {
  let fail = true;
  const attempts: domain.Entry[] = [];
  const scripted = scriptedClient();
  const view = harness({ client: scripted.client, addEntry: async entry => { attempts.push(entry); if (fail) throw new Error('No se pudo guardar. Reintentá.'); } });
  view.render().empty.props.onPick('Gasté 18.500 en Carrefour con la Visa');
  await tick();
  scripted.reply([{ type: 'result', result: FIXTURE_DRAFT, facts: [] }]);
  await settle();
  let screen = view.render();
  find([screen.items[1]], 'DraftCard')[0].props.onConfirm();
  await settle();
  screen = view.render();
  assert.equal(attempts.length, 1);
  assert.equal(find([screen.items[1]], 'DraftCard')[0].props.content.status, 'pending', 'a failed write leaves the draft to retry');
  assert.equal(screen.messages.at(-1)?.role, 'system');
  assert.match(String(screen.messages.at(-1)?.text), /No se pudo guardar/);
  assert.equal(view.haptics.includes('success'), false);
  fail = false;
  find([screen.items[1]], 'DraftCard')[0].props.onConfirm();
  await settle();
  screen = view.render();
  assert.equal(attempts.length, 2);
  assert.equal(attempts[1].id, attempts[0].id, 'the retry repeats the same command, never a second movement');
  assert.equal(find([screen.items[1]], 'DraftCard')[0].props.content.status, 'confirmed');
  // Discarding another draft writes nothing.
  const other = scriptedClient();
  const view2 = harness({ client: other.client });
  view2.render().empty.props.onPick('Gasté 18.500 en Carrefour con la Visa');
  await tick();
  other.reply([{ type: 'result', result: FIXTURE_DRAFT, facts: [] }]);
  await settle();
  find([view2.render().items[1]], 'DraftCard')[0].props.onCancel();
  const cancelled = find([view2.render().items[1]], 'DraftCard')[0];
  assert.equal(cancelled.props.content.status, 'cancelled');
  assert.equal(view2.written.length, 0);
});

test('Editar hands the draft to the entry form prefilled and marks the card as edited, so the form\'s save is the only write', async () => {
  const scripted = scriptedClient();
  const view = harness({ client: scripted.client });
  view.render().empty.props.onPick('Gasté 18.500 en Carrefour con la Visa');
  await tick();
  scripted.reply([{ type: 'result', result: FIXTURE_DRAFT, facts: [] }]);
  await settle();
  find([view.render().items[1]], 'DraftCard')[0].props.onEdit();
  assert.equal(JSON.stringify(view.pushed), JSON.stringify([{ pathname: '/new-entry', params: { kind: 'expense', currency: 'ARS', accountId: 'visa', amount: '18.500,00', merchant: 'Carrefour', category: 'Supermercado', date: '2026-09-21' } }]));
  assert.equal(find([view.render().items[1]], 'DraftCard')[0].props.content.status, 'edited');
  assert.equal(view.written.length, 0);
});

test('a draft without a payment method asks with the accounts of that currency; the choice becomes the user\'s words and completes the draft', async () => {
  const scripted = scriptedClient();
  const view = harness({ client: scripted.client });
  view.render().empty.props.onPick('Gasté 18 mil en el súper');
  await tick();
  scripted.reply([{ type: 'result', result: FIXTURE_DRAFT_NO_ACCOUNT, facts: [] }]);
  await settle();
  let screen = view.render();
  const question = screen.items[1];
  assert.equal(find([question], 'AssistantText')[0].props.text, '¿Con qué lo pagaste?');
  const choices = find([question], 'ClarificationChoices')[0];
  assert.equal(JSON.stringify(choices.props.options), JSON.stringify([{ id: 'visa', label: 'Visa Galicia' }, { id: 'cash', label: 'Efectivo' }]), 'USD accounts are not offered for an ARS expense');
  assert.equal(choices.props.chosen, null);
  assert.equal(find([question], 'DraftCard').length, 0, 'no card until the account is known');
  choices.props.onChoose(choices.props.options[1]);
  screen = view.render();
  assert.deepEqual(screen.messages.map(message => message.role), ['user', 'assistant', 'user', 'assistant']);
  assert.equal(find([screen.items[1]], 'ClarificationChoices')[0].props.chosen, 'cash');
  assert.equal(find([screen.items[2]], 'UserMessage')[0].props.text, 'Efectivo');
  const card = find([screen.items[3]], 'DraftCard')[0];
  assert.equal(card.props.content.draft.accountId, 'cash');
  assert.equal(card.props.content.status, 'pending');
  assert.equal(view.written.length, 0);
  assert.equal(scripted.asks.length, 1, 'completing a clarification is local: no second request');
  // The model's own clarification (no draft) is a question the user answers by typing: text, no chips.
  const other = scriptedClient();
  const view2 = harness({ client: other.client });
  view2.render().empty.props.onPick('¿Cuánto gasté?');
  await tick();
  other.reply([{ type: 'result', result: { kind: 'clarification', draft: null, message: '¿Este mes o el año?', factIds: [] }, facts: [] }]);
  await settle();
  const item = view2.render().items[1];
  assert.equal(find([item], 'AssistantText')[0].props.text, '¿Este mes o el año?');
  assert.deepEqual(find([item], 'ClarificationChoices')[0].props.options, []);
});

test('a remote failure keeps the user message, explains, and Reintentar sends the same text again', async () => {
  const scripted = scriptedClient();
  const view = harness({ client: scripted.client });
  view.render().empty.props.onPick('¿Cuánto gasté en comida?');
  await tick();
  scripted.reply([{ type: 'error', reason: 'offline', message: '' }]);
  await settle();
  let screen = view.render();
  assert.deepEqual(screen.messages.map(message => message.role), ['user', 'system']);
  assert.equal(screen.messages[1].text, conversation.REASON_TEXT.offline);
  const note = find([screen.items[1]], 'SystemNote')[0];
  assert.equal(note.props.message.retryText, '¿Cuánto gasté en comida?');
  note.props.onRetry(note.props.message.retryText);
  await tick();
  assert.equal(scripted.asks.length, 2);
  assert.equal(scripted.asks[1].text, '¿Cuánto gasté en comida?');
  scripted.reply([{ type: 'error', reason: 'failed', message: 'Respuesta inválida del servidor.' }]);
  await settle();
  screen = view.render();
  assert.equal(screen.messages.at(-1)?.text, 'Respuesta inválida del servidor.', 'a specific failure message is shown as-is');
});

test('the fixture client shows a visible test banner and a confirm never writes', async () => {
  const view = harness({ client: fixtureAssistant(0) });
  let screen = view.render();
  const banner = nodes(screen.root).filter(node => node.type === 'AppText').map(node => String(node.props.children));
  assert.ok(banner.some(text => /Vista de prueba/.test(text)));
  screen.empty.props.onPick('Gasté 18.500 en Carrefour con la Visa');
  await settle();
  screen = view.render();
  const card = find([screen.items[1]], 'DraftCard')[0];
  assert.ok(card);
  card.props.onConfirm();
  await settle();
  screen = view.render();
  assert.equal(view.written.length, 0, 'fixture drafts are examples, never records');
  assert.equal(find([screen.items[1]], 'DraftCard')[0].props.content.status, 'pending');
  assert.equal(screen.messages.at(-1)?.text, 'assistant.fixtureConfirmRefused', 'the note is stored as its key');
  assert.match(es.errorText(String(screen.messages.at(-1)?.text)), /Vista de prueba/);
  assert.equal(view.haptics.includes('success'), false);
});

test('autoscroll follows only a reader who is near the end, and Reduce Motion scrolls without animation', () => {
  const view = harness({ client: disconnectedAssistant() });
  const { list } = view.render();
  list.props.onLayout({ nativeEvent: { layout: { height: 600 } } });
  list.props.onContentSizeChange(0, 400);
  assert.equal(view.scrolled.length, 2, 'short content: always at the end');
  list.props.onScroll({ nativeEvent: { contentOffset: { y: 200 } } });
  list.props.onContentSizeChange(0, 1700);
  assert.equal(view.scrolled.length, 2, 'scrolled up to read: a new message does not pull the list down');
  list.props.onScroll({ nativeEvent: { contentOffset: { y: 1150 } } });
  list.props.onContentSizeChange(0, 1800);
  assert.equal(view.scrolled.length, 3);
  assert.equal(JSON.stringify(view.scrolled.at(-1)), JSON.stringify({ animated: true }));
  const still = harness({ client: disconnectedAssistant(), reduced: true });
  const reducedList = still.render().list;
  reducedList.props.onLayout({ nativeEvent: { layout: { height: 600 } } });
  assert.equal(JSON.stringify(still.scrolled.at(-1)), JSON.stringify({ animated: false }));
});

test('New chat aborts any request and returns to the empty conversation; leaving the screen aborts too', async () => {
  const scripted = scriptedClient();
  const view = harness({ client: scripted.client });
  view.render().empty.props.onPick('¿Por qué gasté más este mes?');
  await tick();
  let screen = view.render();
  screen.screen.props.options.headerRight().props.onPress();
  screen = view.render();
  assert.equal(screen.messages.length, 0);
  assert.equal(screen.composer.props.busy, false);
  assert.equal(screen.screen.props.options.headerRight, undefined);
  scripted.reply([{ type: 'delta', text: 'late' }]);
  await settle();
  assert.equal(view.render().messages.length, 0, 'events from the aborted request are ignored');
  const header = screen.screen.props.options.headerRight;
  assert.equal(header, undefined);
  // The unmount effect aborts an in-flight request.
  assert.ok(view.effects.length >= 1);
  const { pushed } = view;
  assert.equal(pushed.length, 0);
});

test('the Assistant is the centre tab and the Home quick action lands on it; the old preview and the stack route are gone', () => {
  const layout = readFileSync(new URL('../app/_layout.tsx', import.meta.url), 'utf8');
  assert.equal(layout.includes('name="assistant"'), false, 'no duplicate stack screen: one conversation, one route');
  assert.match(layout, /name="cards"/);
  assert.equal(layout.includes('assistant-preview'), false);
  const tabs = readFileSync(new URL('../app/(tabs)/_layout.tsx', import.meta.url), 'utf8');
  assert.match(tabs, /name="assistant"/);
  const home = readFileSync(new URL('../app/(tabs)/index.tsx', import.meta.url), 'utf8');
  assert.match(home, /<QuickActions currency=\{currency\} assistant \/>/);
  const actions = readFileSync(new URL('../src/ui/quick-actions.tsx', import.meta.url), 'utf8');
  assert.match(actions, /router\.navigate\(\{ pathname: '\/assistant'/, 'navigate, not push: switching to the tab, never stacking a copy');
  assert.throws(() => readFileSync(new URL('../app/assistant-preview.tsx', import.meta.url)));
  assert.throws(() => readFileSync(new URL('../app/assistant.tsx', import.meta.url)));
});

test('English: the screen\'s own words are English, the model\'s answer and the user\'s words are untouched, and a confirmed draft writes the same Entry', async () => {
  const scripted = scriptedClient();
  const view = harness({ client: scripted.client, locale: 'en-AR' });
  let screen = view.render();
  assert.equal(screen.screen.props.options.title, 'Assistant');
  assert.deepEqual([...screen.empty.props.items], ['Why did I spend more this month?', 'How much did I spend on food?', 'Record an expense', 'How am I doing on my budget?']);
  // A tapped chip sends its English text; an English question is still explained against evidence.
  screen.empty.props.onPick('Why did I spend more this month?');
  await tick();
  assert.equal(scripted.asks[0].text, 'Why did I spend more this month?');
  assert.equal(scripted.asks[0].action, 'explain');
  // Protocol labels sent to the server do not follow the interface language.
  assert.ok(scripted.asks[0].facts.every((fact: any) => /^(Gastos registrados|Ingresos registrados|Categoría de gasto: )/.test(fact.label)));
  scripted.reply([{ type: 'result', result: FIXTURE_ANSWER, facts: FIXTURE_FACTS }]);
  await settle();
  screen = view.render();
  assert.equal(find([screen.items[1]], 'AssistantText')[0].props.text, FIXTURE_ANSWER.message, 'the model\'s words are content, never translated');
  assert.equal(typeof screen.screen.props.options.headerRight().props.label, 'string');
  assert.equal(screen.screen.props.options.headerRight().props.label, 'New chat');
  // The app's own question reads in English; the account chips are the user's names; choosing writes nothing yet.
  const ask = scriptedClient();
  const english = harness({ client: ask.client, locale: 'en-AR' });
  english.render().empty.props.onPick('Spent 18k at the grocery store');
  await tick();
  assert.equal(ask.asks[0].action, 'parse');
  ask.reply([{ type: 'result', result: FIXTURE_DRAFT_NO_ACCOUNT, facts: [] }]);
  await settle();
  let items = english.render().items;
  assert.equal(find([items[1]], 'AssistantText')[0].props.text, 'What did you pay with?');
  const choices = find([items[1]], 'ClarificationChoices')[0];
  assert.equal(JSON.stringify(choices.props.options), JSON.stringify([{ id: 'visa', label: 'Visa Galicia' }, { id: 'cash', label: 'Efectivo' }]), 'account names are never translated');
  choices.props.onChoose(choices.props.options[0], 'Visa Galicia');
  items = english.render().items;
  assert.equal(find([items[2]], 'UserMessage')[0].props.text, 'Visa Galicia');
  assert.equal(find([items[3]], 'AssistantText')[0].props.text, 'Review the draft before saving it.');
  assert.deepEqual([find([items[1]], 'AssistantText')[0].props.ownWords, find([items[3]], 'AssistantText')[0].props.ownWords], [true, true],
    'the app\'s own questions are marked so VoiceOver reads them in the interface language, not as the model\'s Spanish prose');
  // The same question follows a language change already on screen: it is stored as a key.
  english.setLocale('es-AR');
  assert.equal(find([english.render().items[1]], 'AssistantText')[0].props.text, '¿Con qué lo pagaste?');
  english.setLocale('en-AR');
  find([english.render().items[3]], 'DraftCard')[0].props.onConfirm();
  await settle();
  assert.equal(english.written.length, 1);
  // The same flow in Spanish writes the identical Entry: language never reaches the ledger.
  const spanishAsk = scriptedClient();
  const spanish = harness({ client: spanishAsk.client });
  spanish.render().empty.props.onPick('Gasté 18 mil en el súper');
  await tick();
  spanishAsk.reply([{ type: 'result', result: FIXTURE_DRAFT_NO_ACCOUNT, facts: [] }]);
  await settle();
  const spanishChoices = find([spanish.render().items[1]], 'ClarificationChoices')[0];
  spanishChoices.props.onChoose(spanishChoices.props.options[0], 'Visa Galicia');
  find([spanish.render().items[3]], 'DraftCard')[0].props.onConfirm();
  await settle();
  const stable = (written: domain.Entry[]) => JSON.stringify(written.map(({ createdAt: _stamp, ...entry }) => entry));
  assert.equal(stable(english.written), stable(spanish.written), 'identical except the write timestamp');
  assert.equal(english.written[0].category, 'Supermercado', 'the stored category stays the stored string');
  // Notes are stored as keys and read in English; a remote failure's specific message is shown through errorText.
  const offline = scriptedClient();
  const noted = harness({ client: offline.client, locale: 'en-AR' });
  noted.render().empty.props.onPick('How much did I spend on food?');
  await tick();
  offline.reply([{ type: 'error', reason: 'offline', message: '' }]);
  await settle();
  const note = noted.render().messages[1];
  assert.equal(note.text, 'assistant.reasons.offline');
  assert.equal(bindLocale('en-AR').errorText(note.text), 'No connection. Your transactions didn’t change; you can retry.');
  // The disconnected caption and the test banner.
  const quiet = harness({ client: disconnectedAssistant(), locale: 'en-AR' });
  const caption = nodes(quiet.render().composer.props.note).find(node => node.type === 'AppText')!;
  assert.equal(caption.props.children, 'Not connected in this version. What you type stays on your iPhone.');
  const banner = nodes(harness({ client: fixtureAssistant(0), locale: 'en-AR' }).render().root).filter(node => node.type === 'AppText').map(node => String(node.props.children));
  assert.ok(banner.includes('Test view: sample replies, nothing is saved.'));
});

test('a language or region change while the Assistant answers: nothing is re-sent or aborted, the answer lands in the same thread untouched, and a failure note reads in the new language', async () => {
  const scripted = scriptedClient();
  const view = harness({ client: scripted.client });
  view.render().empty.props.onPick('¿Por qué gasté más este mes?');
  await tick();
  // Más: English and the United States at once, while the request is still waiting.
  view.setLocale('en-US');
  let screen = view.render();
  assert.equal(screen.composer.props.busy, true, 'still answering after the change');
  assert.equal(screen.screen.props.options.title, 'Assistant');
  assert.equal(screen.screen.props.options.headerRight().props.label, 'New chat');
  assert.equal(scripted.signals[0]?.aborted, false, 'the change did not abort the request');
  scripted.reply([{ type: 'result', result: FIXTURE_ANSWER, facts: FIXTURE_FACTS }]);
  await settle();
  screen = view.render();
  assert.equal(scripted.asks.length, 1, 'no second request');
  const v1 = ['action', 'currency', 'facts', 'text', 'todayISO'];
  assert.equal(Object.keys(scripted.asks[0]).sort().join(), v1.join(), 'no language or region reaches a v1 request');
  assert.equal(scripted.asks[0].currency, 'ARS', 'the region never changes the currency asked about');
  assert.equal(screen.messages.map(message => message.id).join(), 'u-1,a-2');
  assert.equal(screen.messages[0].text, '¿Por qué gasté más este mes?', 'the user\'s words keep the language they were sent in');
  assert.equal(find([screen.items[1]], 'AssistantText')[0].props.text, FIXTURE_ANSWER.message, 'the model\'s words are content');
  assert.equal(find([screen.items[1]], 'AssistantText')[0].props.ownWords, false, 'the model\'s prose keeps its own voice');
  assert.equal(find([screen.items[1]], 'AnswerEvidence')[0].props.content.rows[1].amountMinor, 4250000, 'the evidence keeps its numbers');
  // The next question goes out in the new language with the same v1 keys: the language is never on the wire.
  view.render().composer.props.onChange('Why did I spend more this month?');
  view.render().composer.props.onSend();
  await tick();
  assert.equal(scripted.asks.length, 2);
  assert.equal(Object.keys(scripted.asks[1]).sort().join(), v1.join());
  // A fixture failure carries no words: the note is the reason's key, read in the language on screen when shown.
  const failing = harness({ client: fixtureAssistant(0), locale: 'en-US' });
  failing.render().composer.props.onChange('error');
  failing.render().composer.props.onSend();
  await settle();
  const note = failing.render().messages.at(-1)!;
  assert.equal(note.text, conversation.REASON_TEXT.failed);
  assert.equal(bindLocale('en-US').errorText(note.text), 'The request couldn’t be completed. Your transactions didn’t change.');
  failing.setLocale('es-AR');
  assert.equal(es.errorText(failing.render().messages.at(-1)!.text), 'No se pudo completar la consulta. Tus movimientos no cambiaron.');
});

test('VoiceOver: the test banner speaks the interface language when it differs from the device\'s', () => {
  const banner = (deviceLanguage: string | null, locale: AppLocale) => nodes(harness({ client: fixtureAssistant(0), locale, deviceLanguage }).render().root)
    .find(node => node.type === 'View' && node.props.accessible)!;
  assert.equal(banner('es', 'en-US').props.accessibilityLanguage, 'en');
  assert.equal(banner('en', 'es-AR').props.accessibilityLanguage, 'es');
  assert.equal(banner('es', 'es-AR').props.accessibilityLanguage, undefined, 'device and app agree: the voice chosen in iOS Settings');
});
