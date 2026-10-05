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
import * as sessionModule from '../src/assistant/session.ts';
import * as reviewProposal from '../src/assistant/review-proposal.ts';
import { loadReviewTray, type ReviewCapture, type ReviewItem, type ReviewStore, type ReviewTray } from '../src/storage/review-database.ts';
import { reviewFiles } from './review-sqlite.ts';
import { createConversationSession, type ConversationSession } from '../src/assistant/session.ts';
import * as i18nFormat from '../src/i18n/format.ts';
import { bindLocale } from '../src/i18n/bind.ts';
import type { AppLocale } from '../src/i18n/locale.ts';
const es = bindLocale('es-AR');

// Producto 21: the Assistant screen's handlers, with React, native hosts and the
// UI modules replaced by descriptors and a scripted client. Not a rendered
// iOS screen: keyboard, VoiceOver order and gestures need the iPhone.
// Producto 24UX6A: the screen is a root-stack route (app/assistant.tsx) and its
// conversation lives in the in-memory app session (src/assistant/session.ts). Each
// harness gets its own real session unless a test passes one, so a test can
// unmount the screen and mount it again over the same conversation.
type Node = { type: any; props: Record<string, any> };
const createdAt = '2026-09-01T12:00:00.000Z';
const visa: domain.Account = { id: 'visa', name: 'Visa Galicia', currency: 'ARS', openingMinor: 0, createdAt };
const cash: domain.Account = { id: 'cash', name: 'Efectivo', currency: 'ARS', openingMinor: 500000, createdAt };
const usd: domain.Account = { id: 'usd', name: 'Dólares', currency: 'USD', openingMinor: 10000, createdAt };
const entries: domain.Entry[] = [
  { id: 'e1', accountId: 'cash', kind: 'expense', amountMinor: 1000, merchant: 'Kiosco', category: 'Comida', dateISO: '2026-09-02', createdAt },
  { id: 'e2', accountId: 'visa', kind: 'expense', amountMinor: 2000, merchant: 'Coto', category: 'Supermercado', dateISO: '2026-08-04', createdAt },
];

/** A client the test drives by hand: it resolves whatever events the test queues, when the test says so.
 * `reply(events)` ends the stream after those events; `reply(events, { more: true })` keeps it open for the next reply,
 * like an answer still streaming. */
function scriptedClient(mode: AssistantClient['mode'] = 'remote') {
  const asks: any[] = [];
  const signals: (AbortSignal | undefined)[] = [];
  let queue: AssistantEvent[] = [];
  let open = false;
  let release: (() => void) | null = null;
  const client: AssistantClient = { mode, async *ask(input, signal) {
    asks.push(input);
    signals.push(signal);
    for (;;) {
      await new Promise<void>(resolve => { release = resolve; });
      const batch = queue;
      const more = open;
      for (const event of batch) { if (signal?.aborted) return; yield event; }
      if (!more) return;
    }
  } };
  return { client, asks, signals, reply(events: AssistantEvent[], { more = false }: { more?: boolean } = {}) { queue = events; open = more; release?.(); release = null; },
    get waiting() { return release !== null; } };
}

/** 25A-04: what the screen's `useLedger()` offers of the review store: the tray it reads, its capture and its lookup. The
 * default keeps items in memory (as the store does: a repeat of a capture returns the item already there, never a second
 * one); `sqliteReview` puts a real store on real SQLite behind the same three calls. */
interface ReviewBacking { tray: () => ReviewTray | 'unavailable' | null; capture: (input: ReviewCapture) => Promise<ReviewItem>; get: (id: string) => Promise<ReviewItem | null>;
  captures: ReviewCapture[]; failNext: (count?: number) => void }
function memoryReview(): ReviewBacking {
  const items = new Map<string, ReviewItem>();
  const captures: ReviewCapture[] = [];
  let failures = 0;
  return { captures, failNext: (count = 1) => { failures = count; },
    tray: () => ({ writable: true, items: [...items.values()].filter(item => item.status === 'pending'), unreadable: [], conflicts: [] }),
    capture: async input => {
      captures.push(input);
      if (failures > 0) { failures--; throw new Error('disk I/O error'); }
      const existing = items.get(input.id);
      if (existing) return existing;
      const item: ReviewItem = { id: input.id, source: 'assistant', captureKey: input.captureKey, draft: input.draft as domain.ReviewDraft, writeId: input.writeId,
        status: 'pending', attempt: null, receipt: null, createdAt: input.at, updatedAt: input.at, revision: 0 };
      items.set(input.id, item);
      return item;
    },
    get: async id => items.get(id) ?? null };
}
async function sqliteReview(store: () => ReviewStore): Promise<ReviewBacking & { refresh: () => Promise<void>; gets: string[] }> {
  const gets: string[] = [];
  let tray: ReviewTray = await loadReviewTray(store(), new Date().toISOString());
  const captures: ReviewCapture[] = [];
  let failures = 0;
  const refresh = async () => { tray = await loadReviewTray(store(), new Date().toISOString()); };
  return { captures, refresh, failNext: (count = 1) => { failures = count; }, tray: () => tray,
    capture: async input => {
      captures.push(input);
      if (failures > 0) { failures--; throw new Error('disk I/O error'); }
      const { item } = await store().capture(input);
      await refresh();
      return item;
    },
    get: id => { gets.push(id); return store().get(id); }, gets };
}

function harness({ client, accounts = [visa, cash, usd], data = entries, params = {}, reduced = false, review = memoryReview(), refreshReview = async () => {}, locale = 'es-AR', deviceLanguage = null, session = createConversationSession() }: {
  client: AssistantClient; accounts?: domain.Account[]; data?: domain.Entry[]; params?: Record<string, string>; reduced?: boolean; review?: ReviewBacking; locale?: AppLocale;
  refreshReview?: () => Promise<void>;
  /** The device's first language, for `speechLanguage` (null: nothing read, so it is never set). */
  deviceLanguage?: string | null;
  /** The app session the screen reads (`conversationSession()`): a fresh real one by default, so tests are isolated. */
  session?: ConversationSession;
}) {
  let i18n = bindLocale(locale, 'none', deviceLanguage);
  const i18nProvider = { useI18n: () => i18n };
  const source = readFileSync(new URL('../app/assistant.tsx', import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const jsx = (type: unknown, props: Record<string, unknown>) => ({ type, props });
  const state: unknown[] = [];
  const pushed: any[] = [];
  const navigated: any[] = [];
  const dismissed: any[] = [];
  let uuids = 0;
  const subscriptions: unknown[] = [];
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
      // The screen reads the app session through useSyncExternalStore: every render reads its current state.
      useSyncExternalStore: (subscribe: unknown, getSnapshot: () => unknown) => { subscriptions.push(subscribe); return getSnapshot(); },
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
    'expo-router': { Stack: { Screen: 'Stack.Screen' }, useLocalSearchParams: () => params,
      router: { push: (to: unknown) => pushed.push(to), navigate: (to: unknown) => navigated.push(to), dismissTo: (to: unknown) => dismissed.push(to) } },
    // A fresh id on every call: a retry that called randomUUID again would get other ids, so only the proposal's frozen
    // capture keeps a retry idempotent.
    'expo-crypto': { randomUUID: () => '00000000-0000-4000-8000-' + String(++uuids).padStart(12, '0') },
    '@finanzapp/domain': domain,
    '../src/assistant/runtime': { assistantForBuild: () => client },
    '../src/assistant/conversation': conversation,
    '../src/assistant/session': { ...sessionModule, conversationSession: () => session },
    '../src/integrations/evidence': evidence,
    '../src/assistant/review-proposal': reviewProposal,
    // No ledger write is offered to the screen at all: only the review store's capture and lookup.
    '../src/storage/LedgerProvider': { useLedger: () => ({ snapshot, archive: { accounts, records: [], debts: [] }, review: review.tray(), captureReview: review.capture, getReviewItem: review.get, refreshReview }) },
    '../src/ui/assistant-composer': { AssistantComposer: 'AssistantComposer' },
    '../src/ui/assistant-messages': Object.fromEntries(['AnswerEvidence', 'AssistantText', 'ClarificationChoices', 'ProposalCard', 'Suggestions', 'SystemNote', 'UserMessage'].map(n => [n, n])),
    '../src/ui/components': { AppText: 'AppText', IconButton: 'IconButton' },
    '../src/ui/liability-presentation': liabilityPresentation,
    '../src/ui/money-input': moneyInput,
    '../src/ui/motion': { Appear: 'Appear', impactHaptic: () => haptics.push('impact') },
    '../src/ui/presentation': presentation,
    '../src/ui/theme': { space: { xs: 4, s: 8, m: 12, l: 16, xl: 20, xxl: 24, xxxl: 32 }, useCurrentDay: () => '2026-09-21', useReduceMotion: () => reduced,
      usePalette: () => ({ background: '#F2F2F6', warning: '#B45309', warningSoft: '#FCF1E0', isDark: false }) },
  };
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
    const screen = nodes(root).find(node => node.type === 'Stack.Screen')!;
    return { root, list, items, composer, screen, empty: list.props.ListEmptyComponent as Node, messages: list.props.data as conversation.Message[] };
  };
  /** Leave the screen: React runs the effects' cleanups and drops the component's state; the app session stays. */
  const unmount = () => { for (const cleanup of effects.splice(0)) cleanup(); state.length = 0; };
  return { render, unmount, session, review, subscriptions, pushed, navigated, dismissed, scrolled, haptics, effects, setLocale: (next: AppLocale) => { i18n = bindLocale(next, 'none', deviceLanguage); } };
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
  assert.ok(view.subscriptions.length > 0 && view.subscriptions.every(subscribe => subscribe === view.session.subscribe), 'the screen reads the app session, not state of its own');
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
  // 24UX6C: no permanent «No conectado en esta versión…» caption under the composer; the limitation is said where it
  // matters, when a message is sent (next test).
  assert.equal(composer.props.note, undefined, 'the composer carries no note');
  const words = nodes(view.render().root).filter(node => node.type === 'AppText').map(node => [node.props.children].flat().join(''));
  assert.ok(!words.some(text => /No conectado en esta versión/.test(text)), 'no permanent disconnected caption on screen');
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
  // The limitation is explained at the point of use: the in-thread note says the Assistant is not connected and the
  // words stay written.
  const unavailable = screen.messages[0];
  assert.equal(unavailable.text, conversation.REASON_TEXT.unavailable);
  assert.equal(es.errorText(unavailable.text), 'El Asistente todavía no está conectado en esta versión. Tu mensaje quedó escrito para cuando lo esté.');
  assert.equal(screen.items[0].props.children.props.message.reason, 'unavailable');
  assert.equal(screen.composer.props.note, undefined, 'no caption under the composer either');
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
  assert.equal(view.review.captures.length, 0);
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
  scripted.reply([{ type: 'delta', text: 'Gastaste ' }, { type: 'delta', text: 'más ' }], { more: true });
  await settle();
  screen = view.render();
  const streaming = screen.items[1];
  const text = find([streaming], 'AssistantText')[0];
  assert.equal(text.props.status, 'streaming');
  assert.equal(text.props.text, 'Gastaste más ');
  assert.equal(screen.composer.props.busy, true);
  // Stop: the request is aborted, the partial answer stays and is marked as interrupted, the composer is free again.
  assert.ok(view.session.request.current, 'the answer is still streaming');
  screen.composer.props.onStop();
  assert.equal(scripted.signals[0]?.aborted, true, 'Stop aborts the request');
  assert.equal(view.session.request.current, null);
  screen = view.render();
  assert.equal(screen.composer.props.busy, false);
  assert.equal(find([screen.items[1]], 'AssistantText')[0].props.status, 'stopped');
  assert.equal(find([screen.items[1]], 'AssistantText')[0].props.text, 'Gastaste más ');
  assert.equal(screen.messages.length, 2);
});

test('an answer renders its text and evidence rows/links from the cited facts, and a link opens the FinanzApp screen (a tab root by dismissTo, anything else by push)', async () => {
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
  // Movimientos is a tab root: the link pops back to the existing tabs and selects it (dismissTo), never stacking a
  // second copy of the tabs over the Assistant (navigate from this root-stack screen would push one).
  assert.equal(JSON.stringify(view.dismissed), JSON.stringify(['/activity']));
  assert.equal(view.pushed.length, 0);
  for (const root of ['/', '/reports', '/settings']) proof.props.onOpen({ pathname: root });
  assert.equal(JSON.stringify(view.dismissed), JSON.stringify(['/activity', '/', '/reports', '/settings']));
  proof.props.onOpen({ pathname: '/budgets', params: { currency: 'ARS' } });
  assert.equal(JSON.stringify(view.pushed), JSON.stringify([{ pathname: '/budgets', params: { currency: 'ARS' } }]), 'a screen of the stack is pushed over the Assistant, so back returns to it');
  assert.equal(view.dismissed.length, 4, 'a non-tab screen is never reached by dismissTo');
  assert.equal(view.navigated.length, 0, 'router.navigate is never used for a link');
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
  assert.equal(view2.dismissed.length, 0);
  assert.equal(view2.navigated.length, 0);
});

test('25A-04: a resolved draft becomes a proposal captured into «Para revisar» on real SQLite: one item, the source assistant, nothing in the ledger, and the card leads to the review', async () => {
  const files = await reviewFiles([visa, cash, usd]);
  try {
    const review = await sqliteReview(() => files.store);
    const scripted = scriptedClient();
    const view = harness({ client: scripted.client, review });
    let screen = view.render();
    screen.composer.props.onChange('Gasté 18.500 en Carrefour con la Visa');
    view.render().composer.props.onSend();
    await tick();
    assert.equal(scripted.asks[0].action, 'parse', 'a sentence is parsed');
    assert.equal(scripted.asks[0].facts.length, 0, 'parse sends no evidence');
    scripted.reply([{ type: 'result', result: FIXTURE_DRAFT, facts: [] }]);
    await settle();
    screen = view.render();
    const card = find([screen.items[1]], 'ProposalCard')[0];
    assert.equal(card.props.content.status, 'captured');
    const { capture } = card.props.content as conversation.ProposalContent;
    assert.match(capture.id, domain.REVIEW_WRITE_ID);
    assert.notEqual(capture.id, capture.writeId);
    assert.equal(capture.captureKey, 'assistant:' + capture.id);
    // The review item is what the card reads, and it is in the tray (and so in the count and the Más badge).
    const tray = await files.tray();
    assert.deepEqual(tray.items.map(item => item.id), [capture.id]);
    assert.equal(card.props.state.kind, 'pending');
    assert.equal(card.props.state.item.id, capture.id);
    const item = tray.items[0];
    assert.deepEqual([item.source, item.writeId, item.status, item.draft.kind, item.draft.amountMinor, item.draft.merchant, item.draft.category, item.draft.destinationId],
      ['assistant', capture.writeId, 'pending', 'expense', 1850000, 'Carrefour', 'Supermercado', 'visa']);
    assert.deepEqual([item.draft.currency, item.draft.dateISO], ['ARS', null], 'the currency the model stated; the date it did not state stays unknown');
    assert.deepEqual(await files.entries(), [], 'a proposal never writes the ledger');
    card.props.onReview(capture.id);
    assert.equal(JSON.stringify(view.pushed.at(-1)), JSON.stringify({ pathname: '/review/[id]', params: { id: capture.id } }));
    assert.equal(Object.hasOwn(card.props, 'onConfirm'), false, 'no Assistant-specific confirmation');
  } finally { await files.dispose(); }
});

test('25A-04: a capture that fails writes nothing anywhere and says so; Reintentar resends the same frozen capture, and a repeat never makes a second item (real SQLite)', async () => {
  const files = await reviewFiles([visa, cash, usd]);
  try {
    const review = await sqliteReview(() => files.store);
    review.failNext();
    const scripted = scriptedClient();
    const view = harness({ client: scripted.client, review });
    view.render().empty.props.onPick('Gasté 18.500 en Carrefour con la Visa');
    await tick();
    scripted.reply([{ type: 'result', result: FIXTURE_DRAFT, facts: [] }]);
    await settle();
    let card = find([view.render().items[1]], 'ProposalCard')[0];
    assert.deepEqual([card.props.content.status, card.props.state.kind], ['failed', 'failed'], 'never reported as saved');
    assert.equal((await files.tray()).items.length, 0);
    assert.deepEqual(await files.entries(), []);
    card.props.onRetry();
    await settle();
    card = find([view.render().items[1]], 'ProposalCard')[0];
    assert.equal(card.props.content.status, 'captured');
    assert.equal(review.captures.length, 2);
    assert.equal(JSON.stringify(review.captures[1]), JSON.stringify(review.captures[0]), 'the retry is the same capture: same ids, same draft, same time');
    // The store answers a repeat of a capture that already landed with that item: still one.
    await files.store.capture(review.captures[0]);
    card.props.onRetry();
    await settle();
    assert.equal(review.captures.length, 2, 'a captured proposal is never sent again');
    assert.equal((await files.tray()).items.length, 1);
    assert.deepEqual(await files.entries(), []);
  } finally { await files.dispose(); }
});

test('25A-04: an edit in «Para revisar» is what the card shows, and nothing from the chat can overwrite it; a confirmed or dismissed proposal says so and offers nothing to write (real SQLite)', async () => {
  const files = await reviewFiles([visa, cash, usd]);
  try {
    const review = await sqliteReview(() => files.store);
    const scripted = scriptedClient();
    const view = harness({ client: scripted.client, review });
    view.render().empty.props.onPick('Gasté 18.500 en Carrefour con la Visa');
    await tick();
    scripted.reply([{ type: 'result', result: FIXTURE_DRAFT, facts: [] }]);
    await settle();
    const { capture } = find([view.render().items[1]], 'ProposalCard')[0].props.content as conversation.ProposalContent;
    // Editar in the review UI (the store's update at the shown revision): a date and another merchant.
    const edited = await files.store.updateDraft(capture.id, 0, { ...capture.draft, merchant: 'Carrefour Palermo', dateISO: '2026-09-20' }, new Date().toISOString());
    await review.refresh();
    let card = find([view.render().items[1]], 'ProposalCard')[0];
    assert.equal(card.props.state.item.draft.merchant, 'Carrefour Palermo', 'the card reads the item, not the conversation snapshot');
    assert.equal(card.props.content.capture.draft.merchant, 'Carrefour', 'the snapshot is never edited and never sent again');
    card.props.onRetry();
    await files.store.capture(review.captures[0]); // Even a repeat of the original capture keeps the edit.
    await settle();
    assert.equal((await files.store.get(capture.id))!.draft.merchant, 'Carrefour Palermo');
    assert.equal(review.captures.length, 1);
    // Confirmed in «Para revisar»: one movement, the card says so and links to it; nothing can write it again from the chat.
    await files.store.confirm(capture.id, { expectedRevision: edited.revision, todayISO: domain.todayKey(), at: new Date().toISOString() });
    await review.refresh();
    view.render();
    await settle();
    card = find([view.render().items[1]], 'ProposalCard')[0];
    assert.deepEqual([card.props.state.kind, card.props.state.record, card.props.state.item.status, card.props.state.item.writeId], ['confirmed', 'entry', 'confirmed', capture.writeId]);
    assert.equal(card.props.state.item.draft.merchant, 'Carrefour Palermo', 'the confirmed card draws what was recorded, not the capture');
    card.props.onOpenRecord('entry', capture.writeId);
    assert.equal(JSON.stringify(view.pushed.at(-1)), JSON.stringify({ pathname: '/entry/[id]', params: { id: capture.writeId } }));
    card.props.onRetry();
    await settle();
    assert.deepEqual(await files.entries(), [capture.writeId], 'exactly one movement, under the frozen write id');
    for (let i = 0; i < 4; i++) { view.render(); await settle(); }
    assert.equal(review.gets.filter(id => id === capture.id).length, 1, 'a proposal that left the tray is looked up once, never in a render loop');
    // Another proposal dismissed there: the card says it was discarded.
    view.render().composer.props.onChange('Gasté 18.500 en Carrefour con la Visa');
    view.render().composer.props.onSend();
    await tick();
    scripted.reply([{ type: 'result', result: FIXTURE_DRAFT, facts: [] }]);
    await settle();
    const second = (find([view.render().items[3]], 'ProposalCard')[0].props.content as conversation.ProposalContent).capture;
    await files.store.dismiss(second.id, 0, new Date().toISOString());
    await review.refresh();
    view.render();
    await settle();
    assert.equal(find([view.render().items[3]], 'ProposalCard')[0].props.state.kind, 'dismissed');
    assert.deepEqual(await files.entries(), [capture.writeId]);
  } finally { await files.dispose(); }
});

test('25A-04 (Codex review of #85): edited in «Para revisar» (amount, merchant, category, account, date) and confirmed, the card shows exactly what was recorded; one write (real SQLite)', async () => {
  const files = await reviewFiles([visa, cash, usd]);
  try {
    const review = await sqliteReview(() => files.store);
    const scripted = scriptedClient();
    const view = harness({ client: scripted.client, review });
    view.render().empty.props.onPick('Gasté 18.500 en Carrefour con la Visa');
    await tick();
    scripted.reply([{ type: 'result', result: FIXTURE_DRAFT, facts: [] }]);
    await settle();
    const { capture } = find([view.render().items[1]], 'ProposalCard')[0].props.content as conversation.ProposalContent;
    const archive = { accounts: [visa, cash, usd], records: [] } as domain.ReviewArchive;
    const changed = { ...capture.draft, amountMinor: 990000, merchant: 'Kiosco Pepe', category: 'Transporte', destinationId: cash.id, dateISO: '2026-09-19' };
    const edited = await files.store.updateDraft(capture.id, 0, { ...changed, basis: domain.reviewBasis(changed, archive) }, new Date().toISOString());
    await files.store.confirm(capture.id, { expectedRevision: edited.revision, todayISO: domain.todayKey(), at: new Date().toISOString() });
    await review.refresh();
    view.unmount();
    // Back in the Assistant: the card is read from the confirmed item.
    const back = harness({ client: scripted.client, review, session: view.session });
    back.render();
    await settle();
    const card = find([back.render().items[1]], 'ProposalCard')[0];
    assert.equal(card.props.state.kind, 'confirmed');
    const shown = card.props.state.item.draft as domain.ReviewDraft;
    assert.deepEqual([shown.amountMinor, shown.merchant, shown.category, shown.destinationId, shown.dateISO], [990000, 'Kiosco Pepe', 'Transporte', cash.id, '2026-09-19']);
    const recorded = (await files.store.get(capture.id))!;
    assert.equal(JSON.stringify(shown), JSON.stringify(recorded.draft), 'exactly the stored draft');
    assert.deepEqual(await files.entries(), [capture.writeId], 'one movement');
    card.props.onRetry();
    await settle();
    assert.deepEqual(await files.entries(), [capture.writeId], 'nothing in the chat can write it again');
    assert.equal(review.captures.length, 1);
  } finally { await files.dispose(); }
});

test('25A-04 (Codex review of #85): a capture that committed while the tray could not be read again is shown from the store, «Revisar» opens it, and the tray is asked to reload (real SQLite)', async () => {
  const files = await reviewFiles([visa, cash, usd]);
  try {
    const review = await sqliteReview(() => files.store);
    const before = review.tray();
    const stale: ReviewBacking = { ...review, tray: () => before };
    let refreshes = 0;
    const scripted = scriptedClient();
    const view = harness({ client: scripted.client, review: stale, refreshReview: async () => { refreshes++; } });
    view.render().empty.props.onPick('Gasté 18.500 en Carrefour con la Visa');
    await tick();
    scripted.reply([{ type: 'result', result: FIXTURE_DRAFT, facts: [] }]);
    await settle();
    view.render();
    await settle();
    const card = find([view.render().items[1]], 'ProposalCard')[0];
    const { capture } = card.props.content as conversation.ProposalContent;
    assert.equal(card.props.content.status, 'captured');
    assert.deepEqual([card.props.state.kind, card.props.state.item.id, card.props.state.item.status], ['pending', capture.id, 'pending'], 'the stored item, not «unknown» or «gone»');
    assert.ok(refreshes >= 1, 'the tray is asked to reload');
    card.props.onReview(capture.id);
    assert.equal(JSON.stringify(view.pushed.at(-1)), JSON.stringify({ pathname: '/review/[id]', params: { id: capture.id } }), 'the detail reads the store too (tests/review-routes.node.ts)');
    // Rendering again does not read it again: one lookup while the tray is unchanged.
    for (let i = 0; i < 3; i++) { view.render(); await settle(); }
    assert.equal(review.gets.filter(id => id === capture.id).length, 1);
    // Unreadable or failing reads keep «Revisar» (never «gone»).
    const failing: ReviewBacking = { ...stale, get: async () => { throw new Error('disk I/O error'); } };
    const other = harness({ client: scripted.client, review: failing, session: view.session, refreshReview: async () => {} });
    other.render();
    await settle();
    assert.equal(find([other.render().items[1]], 'ProposalCard')[0].props.state.kind, 'unknown');
    assert.deepEqual(await files.entries(), []);
  } finally { await files.dispose(); }
});

test('25A-04: New chat, leaving the screen and an app restart never remove a captured proposal (real SQLite)', async () => {
  const files = await reviewFiles([visa, cash, usd]);
  try {
    const review = await sqliteReview(() => files.store);
    const scripted = scriptedClient();
    const view = harness({ client: scripted.client, review });
    view.render().empty.props.onPick('Gasté 18.500 en Carrefour con la Visa');
    await tick();
    scripted.reply([{ type: 'result', result: FIXTURE_DRAFT, facts: [] }]);
    await settle();
    const { capture } = find([view.render().items[1]], 'ProposalCard')[0].props.content as conversation.ProposalContent;
    view.unmount();
    assert.deepEqual((await files.tray()).items.map(item => item.id), [capture.id], 'leaving the screen');
    view.render().screen.props.options.headerRight().props.onPress();
    assert.equal(view.session.getState().conversation.messages.length, 0, 'New chat clears the conversation');
    assert.deepEqual((await files.tray()).items.map(item => item.id), [capture.id], 'and keeps the proposal in «Para revisar»');
    const restarted = await files.reopen();
    const item = await restarted.get(capture.id);
    assert.deepEqual([item?.status, item?.writeId, item?.draft.merchant], ['pending', capture.writeId, 'Carrefour'], 'an app restart finds it');
    assert.deepEqual(await files.entries(), []);
  } finally { await files.dispose(); }
});

test('25A-04: the Assistant screen has no ledger write path left', () => {
  const source = readFileSync(new URL('../app/assistant.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /addEntry|entryFromDraft|validateEntry|createEntry|addInstallmentPlan|confirmReview|session\.writes|setWriting|new-entry/);
  assert.match(source, /captureReview\(\{ id: frozen\.id, writeId: frozen\.writeId, captureKey: frozen\.captureKey, draft: frozen\.draft, at: frozen\.at \}\)/);
  for (const file of ['../src/assistant/session.ts', '../src/assistant/conversation.ts', '../src/assistant/review-proposal.ts', '../src/ui/assistant-messages.tsx']) {
    assert.doesNotMatch(readFileSync(new URL(file, import.meta.url), 'utf8').replace(/\/\*\*[\s\S]*?\*\//g, ''), /addEntry|createEntry|validateEntry|confirmReview|store\.confirm/, file);
  }
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
  assert.equal(find([question], 'ProposalCard').length, 0, 'no proposal until the account is known');
  assert.equal(view.review.captures.length, 0, 'nothing captured while a question is open');
  choices.props.onChoose(choices.props.options[1]);
  screen = view.render();
  assert.deepEqual(screen.messages.map(message => message.role), ['user', 'assistant', 'user', 'assistant']);
  assert.equal(find([screen.items[1]], 'ClarificationChoices')[0].props.chosen, 'cash');
  assert.equal(find([screen.items[2]], 'UserMessage')[0].props.text, 'Efectivo');
  await settle();
  const card = find([view.render().items[3]], 'ProposalCard')[0];
  assert.equal(card.props.content.capture.draft.destinationId, 'cash');
  assert.deepEqual([card.props.content.capture.draft.currency, card.props.content.capture.draft.dateISO], ['ARS', null], 'the currency the model stated; no date stated, none invented');
  assert.equal(card.props.content.status, 'captured');
  assert.equal(view.review.captures.length, 1);
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

test('the fixture client shows a visible test banner, and its proposal is a preview: never captured, never written', async () => {
  const view = harness({ client: fixtureAssistant(0) });
  let screen = view.render();
  const banner = nodes(screen.root).filter(node => node.type === 'AppText').map(node => String(node.props.children));
  assert.ok(banner.some(text => /Vista de prueba/.test(text)));
  screen.empty.props.onPick('Gasté 18.500 en Carrefour con la Visa');
  await settle();
  screen = view.render();
  const card = find([screen.items[1]], 'ProposalCard')[0];
  assert.deepEqual([card.props.content.status, card.props.state.kind], ['preview', 'preview']);
  card.props.onRetry();
  await settle();
  assert.equal(view.review.captures.length, 0, 'fixture proposals never reach the review file');
  assert.equal(find([view.render().items[1]], 'ProposalCard')[0].props.content.status, 'preview');
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

test('New chat (session.reset) aborts the request in flight and empties the conversation; a late event from it is ignored', async () => {
  const scripted = scriptedClient();
  const view = harness({ client: scripted.client });
  view.render().empty.props.onPick('¿Por qué gasté más este mes?');
  await tick();
  let screen = view.render();
  assert.ok(view.session.request.current, 'the request in flight lives in the session');
  const newChat = screen.screen.props.options.headerRight();
  assert.equal(newChat.type, 'IconButton');
  assert.equal(newChat.props.label, 'Nuevo chat');
  assert.equal(newChat.props.label, es.t('assistant.newChat'));
  assert.equal(newChat.props.onPress, view.session.reset, 'New chat is the session\'s reset');
  newChat.props.onPress();
  assert.equal(scripted.signals[0]?.aborted, true, 'New chat aborts the request');
  assert.equal(view.session.request.current, null);
  screen = view.render();
  assert.equal(screen.messages.length, 0);
  assert.equal(screen.composer.props.busy, false);
  assert.equal(screen.composer.props.value, '');
  assert.equal(screen.screen.props.options.headerRight, undefined);
  scripted.reply([{ type: 'delta', text: 'late' }]);
  await settle();
  assert.equal(view.render().messages.length, 0, 'events from the aborted request are ignored');
  assert.equal(view.session.getState().conversation.messages.length, 0);
  assert.equal(view.render().screen.props.options.headerRight, undefined);
  assert.equal(view.pushed.length, 0);
  assert.equal(view.navigated.length + view.dismissed.length, 0);
  // The next question starts a new exchange; message ids keep increasing, so nothing of the old one is reused.
  view.render().composer.props.onChange('¿Cuánto gasté en comida?');
  view.render().composer.props.onSend();
  await tick();
  assert.equal(scripted.asks.length, 2);
  assert.equal(view.render().messages.map(message => message.id).join(), 'u-2');
});

test('leaving the screen does not lose the conversation: mounted again over the same session it shows the thread and the draft words, and opens at the last exchange once', async () => {
  const scripted = scriptedClient();
  const view = harness({ client: scripted.client });
  view.render().empty.props.onPick('¿Por qué gasté más este mes?');
  await tick();
  scripted.reply([{ type: 'result', result: FIXTURE_ANSWER, facts: FIXTURE_FACTS }]);
  await settle();
  view.render().composer.props.onChange('Y en comida');
  view.unmount();
  // Back to the tabs and «+» → Asistente again: a new mount of the screen over the same app session.
  const again = harness({ client: scripted.client, session: view.session });
  const screen = again.render();
  assert.equal(screen.messages.map(message => message.id).join(), 'u-1,a-2');
  assert.equal(screen.messages[0].text, '¿Por qué gasté más este mes?');
  assert.equal(find([screen.items[1]], 'AssistantText')[0].props.text, FIXTURE_ANSWER.message);
  assert.equal(find([screen.items[1]], 'AnswerEvidence')[0].props.content.rows[1].amountMinor, 4250000);
  assert.equal(screen.composer.props.value, 'Y en comida', 'the unsent words are still in the composer');
  assert.equal(screen.composer.props.busy, false);
  assert.equal(typeof screen.screen.props.options.headerRight, 'function', 'New chat is offered for the conversation that is there');
  assert.equal(screen.list.props.contentContainerStyle.justifyContent, 'flex-start');
  // Returning to an existing conversation opens at its last exchange, without animation, once; afterwards the usual rule.
  screen.list.props.onContentSizeChange(0, 2000);
  assert.equal(again.scrolled.length, 0, 'the viewport is not measured yet: no jump and no animated follow of a long thread');
  screen.list.props.onLayout({ nativeEvent: { layout: { height: 600 } } });
  assert.equal(JSON.stringify(again.scrolled), JSON.stringify([{ animated: false }]), 'one jump to the last exchange, not an animated scroll');
  screen.list.props.onScroll({ nativeEvent: { contentOffset: { y: 200 } } });
  screen.list.props.onContentSizeChange(0, 2100);
  assert.equal(again.scrolled.length, 1, 'the jump happens once: a reader who scrolled up is not pulled down again');
  // Measured the other way round (layout first, over a list whose content is not measured yet), the jump is still the one non-animated scroll of the long thread.
  const other = harness({ client: scripted.client, session: view.session });
  const otherList = other.render().list;
  otherList.props.onLayout({ nativeEvent: { layout: { height: 600 } } });
  otherList.props.onContentSizeChange(0, 2000);
  assert.equal(JSON.stringify(other.scrolled.at(-1)), JSON.stringify({ animated: false }));
  otherList.props.onContentSizeChange(0, 2100);
  assert.equal(JSON.stringify(other.scrolled.at(-1)), JSON.stringify({ animated: false }), 'no further scroll after the jump for a reader at the top');
  assert.equal(other.scrolled.filter(options => JSON.stringify(options) === JSON.stringify({ animated: false })).length, 1);
  // A first visit never jumps: the list starts empty.
  const first = harness({ client: disconnectedAssistant() });
  const list = first.render().list;
  list.props.onLayout({ nativeEvent: { layout: { height: 600 } } });
  list.props.onContentSizeChange(0, 2000);
  assert.equal(first.scrolled.length, 1);
  assert.equal(JSON.stringify(first.scrolled[0]), JSON.stringify({ animated: true }), 'the short empty content followed as usual, not the returning jump');
});

test('an answer streaming while the screen is closed still lands in the session, and a capture that finishes while it is closed lands once', async () => {
  const scripted = scriptedClient();
  const view = harness({ client: scripted.client });
  view.render().empty.props.onPick('¿Por qué gasté más este mes?');
  await tick();
  scripted.reply([{ type: 'delta', text: 'Gastaste ' }], { more: true });
  await settle();
  view.unmount();
  assert.equal(scripted.signals[0]?.aborted, false, 'leaving the screen does not abort the request');
  assert.ok(view.session.request.current, 'the request stays in the session');
  assert.equal(view.session.getState().conversation.phase, 'streaming');
  const again = harness({ client: scripted.client, session: view.session });
  let screen = again.render();
  assert.equal(screen.composer.props.busy, true, 'still answering when the person comes back');
  assert.equal(find([screen.items[1]], 'AssistantText')[0].props.text, 'Gastaste ');
  // A second send while that request is in flight is refused: one request at a time, across mounts.
  screen.composer.props.onChange('otra');
  again.render().composer.props.onSend();
  await tick();
  assert.equal(scripted.asks.length, 1);
  assert.equal(again.render().messages.length, 2);
  // The rest of the answer arrives while the screen is closed again.
  again.unmount();
  scripted.reply([{ type: 'delta', text: 'más ' }, { type: 'result', result: FIXTURE_ANSWER, facts: FIXTURE_FACTS }]);
  await settle();
  const state = view.session.getState().conversation;
  assert.equal(state.phase, 'idle');
  assert.equal(view.session.request.current, null);
  screen = harness({ client: scripted.client, session: view.session }).render();
  assert.equal(screen.messages.length, 2);
  assert.equal(find([screen.items[1]], 'AssistantText')[0].props.status, 'done');
  assert.equal(find([screen.items[1]], 'AssistantText')[0].props.text, FIXTURE_ANSWER.message);
  assert.equal(find([screen.items[1]], 'AnswerEvidence')[0].props.content.links[0].id, 'movements');
  assert.equal(screen.composer.props.busy, false);

  // A capture still in flight when the person leaves: it lands in the session, once, and the remounted card shows it.
  const drafts = scriptedClient();
  let finish: (() => void) | null = null;
  const base = memoryReview();
  const slow: ReviewBacking = { ...base, capture: async input => { const pending = base.capture(input); await new Promise<void>(resolve => { finish = resolve; }); return pending; } };
  const writer = harness({ client: drafts.client, review: slow });
  writer.render().empty.props.onPick('Gasté 18.500 en Carrefour con la Visa');
  await tick();
  drafts.reply([{ type: 'result', result: FIXTURE_DRAFT, facts: [] }]);
  await settle();
  assert.equal(base.captures.length, 1);
  writer.unmount();
  const back = harness({ client: drafts.client, session: writer.session, review: slow });
  const busyCard = find([back.render().items[1]], 'ProposalCard')[0];
  assert.equal(busyCard.props.state.kind, 'capturing', 'the capture in progress shows on the card after coming back');
  busyCard.props.onRetry();
  await settle();
  assert.equal(base.captures.length, 1, 'one capture at a time, whether or not the screen is open');
  finish!();
  await settle();
  const done = find([back.render().items[1]], 'ProposalCard')[0];
  assert.equal(done.props.content.status, 'captured');
  assert.equal(done.props.state.kind, 'pending');
  assert.equal(writer.session.capturing.size, 0);
});

test('the Assistant is a root stack route reached from the capture hub; there is no Assistant tab and no tab route file', () => {
  const layout = readFileSync(new URL('../app/_layout.tsx', import.meta.url), 'utf8');
  assert.equal(layout.match(/<Stack\.Screen name="assistant"/g)?.length, 1, 'one stack screen: one conversation, one route');
  assert.match(layout, /<Stack\.Screen name="assistant" options=\{\{ title: t\('assistant\.title'\) \}\} \/>/);
  assert.match(layout, /name="cards"/);
  assert.equal(layout.includes('assistant-preview'), false);
  const tabs = readFileSync(new URL('../app/(tabs)/_layout.tsx', import.meta.url), 'utf8');
  assert.equal(tabs.includes('name="assistant"'), false, 'the Assistant is not a tab');
  assert.equal([...tabs.matchAll(/<Tabs\.Screen name="([^"]+)"/g)].map(match => match[1]).join(), 'index,activity,reports,settings');
  assert.throws(() => readFileSync(new URL('../app/(tabs)/assistant.tsx', import.meta.url)), 'the tab route file is gone');
  assert.throws(() => readFileSync(new URL('../app/assistant-preview.tsx', import.meta.url)));
  assert.ok(readFileSync(new URL('../app/assistant.tsx', import.meta.url), 'utf8').includes('export default function AssistantScreen'));
  // The capture hub pushes /assistant over the tabs (back returns where «+» was tapped), with the currency on display.
  const capture = readFileSync(new URL('../src/ui/capture-hub.tsx', import.meta.url), 'utf8');
  assert.match(capture, /return \{ pathname: '\/assistant', params: assistantCurrency \? \{ currency: assistantCurrency \} : \{\} \};/);
  assert.match(capture, /router\.push\(captureDestination\(choice, movementCurrency, currency\)\)/);
  assert.equal(capture.includes('router.navigate'), false, 'pushed, never a tab switch');
  assert.throws(() => readFileSync(new URL('../src/ui/home-capture.tsx', import.meta.url)));
  // Inicio no longer carries its own capture button: the dock's «+» is the one way in.
  const home = readFileSync(new URL('../app/(tabs)/index.tsx', import.meta.url), 'utf8');
  assert.equal(/CaptureButton|home-capture/.test(home), false);
});

test('English: the screen\'s own words are English, the model\'s answer and the user\'s words are untouched, and a proposal captures the same review draft', async () => {
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
  assert.equal(find([items[3]], 'AssistantText')[0].props.text, 'Review it in To review before recording it.');
  assert.deepEqual([find([items[1]], 'AssistantText')[0].props.ownWords, find([items[3]], 'AssistantText')[0].props.ownWords], [true, true],
    'the app\'s own questions are marked so VoiceOver reads them in the interface language, not as the model\'s Spanish prose');
  // The same question follows a language change already on screen: it is stored as a key.
  english.setLocale('es-AR');
  assert.equal(find([english.render().items[1]], 'AssistantText')[0].props.text, '¿Con qué lo pagaste?');
  english.setLocale('en-AR');
  await settle();
  assert.equal(english.review.captures.length, 1);
  // The same flow in Spanish captures the identical review draft: language never reaches the proposal.
  const spanishAsk = scriptedClient();
  const spanish = harness({ client: spanishAsk.client });
  spanish.render().empty.props.onPick('Gasté 18 mil en el súper');
  await tick();
  spanishAsk.reply([{ type: 'result', result: FIXTURE_DRAFT_NO_ACCOUNT, facts: [] }]);
  await settle();
  const spanishChoices = find([spanish.render().items[1]], 'ClarificationChoices')[0];
  spanishChoices.props.onChoose(spanishChoices.props.options[0], 'Visa Galicia');
  await settle();
  const stable = (captures: ReviewCapture[]) => JSON.stringify(captures.map(({ draft }) => ({ ...(draft as domain.ReviewDraft), capturedAt: '' })));
  assert.equal(stable(english.review.captures), stable(spanish.review.captures), 'identical except the capture time');
  assert.equal((english.review.captures[0].draft as domain.ReviewDraft).category, 'Supermercado', 'the stored category stays the stored string');
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
  // The disconnected build has no permanent caption (24UX6C); a sent message explains it in English, and the test banner.
  const quiet = harness({ client: disconnectedAssistant(), locale: 'en-AR' });
  assert.equal(quiet.render().composer.props.note, undefined);
  quiet.render().empty.props.onPick('How much did I spend on food?');
  await settle();
  const unavailable = quiet.render();
  assert.equal(unavailable.messages[0].text, conversation.REASON_TEXT.unavailable);
  assert.equal(bindLocale('en-AR').errorText(unavailable.messages[0].text), 'The Assistant isn’t connected in this version yet. Your message stays in the text field until it is.');
  assert.equal(unavailable.composer.props.value, 'How much did I spend on food?');
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
