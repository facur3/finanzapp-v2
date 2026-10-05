import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as conversation from '../src/assistant/conversation.ts';
import * as domain from '@finanzapp/domain';
import * as reviewPresentation from '../src/ui/review-presentation.ts';
import * as materialPolicy from '../src/ui/material-policy.ts';
import * as presentation from '../src/ui/presentation.ts';
import * as i18nFormat from '../src/i18n/format.ts';
import { bindLocale } from '../src/i18n/bind.ts';
import { translate, type MessageKey } from '../src/i18n/messages.ts';
import type { AppLocale } from '../src/i18n/locale.ts';

// Producto 21: the composer and the message components at source level, with
// React Native, Reanimated and the safe area replaced by descriptors. This
// checks structure, labels and state logic; rendering, VoiceOver order,
// keyboard tracking and the pulse need the iPhone.
type Node = { type: any; props: Record<string, any> };
function load(file: string, { reduced = false, fontScale = 1, dark = false, bottomInset = 34, material = 'opaque' as 'opaque' | 'glass', locale = 'es-AR' as AppLocale,
  deviceLanguage = null as string | null } = {}) {
  const i18n = bindLocale(locale, 'none', deviceLanguage);
  const i18nProvider = { useI18n: () => i18n };
  // A built-in category reads in the interface language (the real resolver's rule, reduced to the catalogue lookup) and is only
  // found under its own kind (Sueldo is an income preset, not an expense one); anything else is the user's word.
  const categoryLabel = (stored: string, kind: 'expense' | 'income' = 'expense') => {
    const key = `categories.${kind}.${stored.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()}` as MessageKey;
    const text = translate(i18n.language, key);
    return text === key ? stored : text;
  };
  const source = readFileSync(new URL('../src/ui/' + file, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const jsx = (type: any, props: any) => ({ type, props });
  const state: unknown[] = [];
  const shared: { value: number }[] = [];
  const haptics: string[] = [];
  let cursor = 0;
  const palette = dark
    ? { isDark: true, background: '#000', surface: '#1C1C1E', inset: '#2C2C2E', text: '#F5F5F7', secondary: '#A0A0A8', tertiary: '#7C7C84', line: '#2C2C30', primary: '#5B87FF', primaryFill: '#3565EA', onPrimary: '#FFF', primarySoft: '#122048', accent: '#86C9B0', onAccent: '#05211A', income: '#3DBE86', warning: '#E8A030' }
    : { isDark: false, background: '#F2F2F6', surface: '#FFFFFF', inset: '#EEEEF3', text: '#0A0A0C', secondary: '#6E7078', tertiary: '#8E9098', line: '#E6E6EC', primary: '#2557D6', primaryFill: '#2557D6', onPrimary: '#FFF', primarySoft: '#E5ECFB', accent: '#9FD8C1', onAccent: '#0F2A22', income: '#15804F', warning: '#B45309' };
  const modules: Record<string, any> = {
    '../i18n/format': i18nFormat, '../src/i18n/format': i18nFormat, '../../src/i18n/format': i18nFormat, '../i18n/provider': i18nProvider, '../src/i18n/provider': i18nProvider, '../../src/i18n/provider': i18nProvider,
    react: { useState: (initial: unknown) => { const index = cursor++; if (!(index in state)) state[index] = initial; return [state[index], (value: unknown) => { state[index] = typeof value === 'function' ? (value as (c: unknown) => unknown)(state[index]) : value; }]; },
      useRef: (initial: unknown) => { const index = cursor++; if (!(index in state)) state[index] = { current: initial }; return state[index]; },
      useEffect: (fn: () => unknown) => { fn(); } },
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'react-native': { View: 'View', TextInput: 'TextInput', StyleSheet: { hairlineWidth: 0.5, create: (styles: unknown) => styles }, Platform: { OS: 'ios' }, useWindowDimensions: () => ({ fontScale, width: 390, height: 844 }) },
    './material': { ControlSurface: 'ControlSurface', useMaterial: () => material },
    './material-policy': materialPolicy,
    'react-native-reanimated': { __esModule: true, default: { View: 'Animated.View' }, Easing: { inOut: (f: unknown) => f, quad: 'quad' },
      useAnimatedKeyboard: () => ({ height: { value: 0 }, state: { value: 0 } }),
      useAnimatedStyle: (fn: () => unknown) => fn, useSharedValue: (value: number) => { const item = { value }; shared.push(item); return item; },
      withTiming: (value: number) => value, withSequence: (...steps: number[]) => steps[0], withRepeat: (value: number) => value },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 59, bottom: bottomInset, left: 0, right: 0 }) },
    '@expo/vector-icons/Ionicons': 'Ionicons',
    './components': Object.fromEntries(['AccountBadge', 'ActionButton', 'AppText', 'CategoryBadge', 'Money', 'PressFeedback', 'Surface'].map(name => [name, name])),
    './motion': { Appear: 'Appear', Reflow: 'Reflow', selectionHaptic: () => haptics.push('selection') },
    './presentation': presentation,
    './theme': { radius: { chip: 14, tile: 12, group: 16, card: 20, sheet: 24, creditCard: 18, button: 14 }, space: { xs: 4, s: 8, m: 12, l: 16, xl: 20, xxl: 24, xxxl: 32 },
      usePalette: () => palette, useReduceMotion: () => reduced, useCurrentDay: () => '2026-09-21' },
    '../assistant/conversation': conversation,
    '@finanzapp/domain': domain,
    './review-presentation': reviewPresentation,
    './category-hues': { useCategoryLook: (stored: string, kind?: 'expense' | 'income') => ({ label: categoryLabel(stored, kind) }),
      useCategoryLookOf: (kind?: 'expense' | 'income') => (stored: string) => ({ label: categoryLabel(stored, kind) }) },
  };
  const module = { exports: {} as Record<string, (props: any) => Node> };
  runInNewContext(code, { module, exports: module.exports, require: (name: string) => {
    if (!Object.hasOwn(modules, name)) throw new Error('Unexpected ' + file + ' dependency: ' + name);
    return modules[name];
  } });
  return { exports: module.exports, render: (component: string, props: any) => { cursor = 0; return module.exports[component](props); }, shared, haptics };
}
function nodes(value: any): Node[] {
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!value.props) return [];
  const own = typeof value.type === 'function' ? nodes(value.type(value.props)) : [];
  return [value, ...own, ...nodes(value.props.children)];
}
const byLabel = (root: Node, label: string) => nodes(root).find(node => node.props.accessibilityLabel === label);
const flat = (style: any) => Object.assign({}, ...(Array.isArray(style) ? style.flat(Infinity).filter(Boolean) : [style]));
const textOf = (node: Node) => Array.isArray(node.props.children) ? node.props.children.map((child: unknown) => typeof child === 'string' ? child : '').join('') : String(node.props.children);

test('the composer labels its field and send (no microphone until dictation exists); send is disabled when empty and becomes Stop while busy', () => {
  const ui = load('assistant-composer.tsx');
  const events: string[] = [];
  const props = { value: '', onChange: () => {}, onSend: () => events.push('send'), onStop: () => events.push('stop'), busy: false };
  let root = ui.render('AssistantComposer', props);
  const input = nodes(root).find(node => node.type === 'TextInput')!;
  assert.equal(input.props.accessibilityLabel, 'Mensaje para el Asistente');
  assert.equal(input.props.placeholder, bindLocale('es-AR').t(ui.exports.COMPOSER_PLACEHOLDER as unknown as MessageKey));
  assert.equal(input.props.placeholder, 'Preguntá o registrá algo…');
  assert.equal(input.props.multiline, true);
  assert.equal(flat(input.props.style).maxHeight, 22 * 5, 'about five lines, then the field scrolls inside');
  // 24UX6C: no microphone (it only opened a note) until dictation exists in Producto 25A.
  assert.equal(byLabel(root, 'Dictar'), undefined);
  assert.equal(nodes(root).some(node => node.type === 'Ionicons' && /^mic/.test(String(node.props.name))), false, 'no mic glyph');
  // (nodes() walks a local function component's children twice, so compare the distinct labels.)
  assert.equal([...new Set(nodes(root).filter(node => node.type === 'PressFeedback').map(node => String(node.props.accessibilityLabel)))].join(','), 'Enviar', 'send is the only control');
  const send = byLabel(root, 'Enviar')!;
  assert.equal(send.props.disabled, true);
  assert.equal(send.props.accessibilityState.disabled, true);
  assert.equal(byLabel(root, 'Detener respuesta'), undefined);
  // Whitespace is not a message.
  root = ui.render('AssistantComposer', { ...props, value: '   ' });
  assert.equal(byLabel(root, 'Enviar')!.props.disabled, true);
  root = ui.render('AssistantComposer', { ...props, value: 'Gasté 500' });
  const ready = byLabel(root, 'Enviar')!;
  assert.equal(ready.props.disabled, false);
  assert.equal(flat(nodes(ready).find(node => node.type === 'View')!.props.style).backgroundColor, '#2557D6', 'the filled cobalt send');
  ready.props.onPress();
  assert.deepEqual(events, ['send']);
  root = ui.render('AssistantComposer', { ...props, value: 'Gasté 500', busy: true });
  assert.equal(byLabel(root, 'Enviar'), undefined);
  byLabel(root, 'Detener respuesta')!.props.onPress();
  assert.deepEqual(events, ['send', 'stop']);
  // No dictation note either, and no line under the bar when no note is passed (the disconnected caption is gone).
  root = ui.render('AssistantComposer', props);
  assert.equal(nodes(root).some(node => node.type === 'AppText'), false);
  assert.equal(byLabel(ui.render('AssistantComposer', { ...props, busy: true }), 'Dictar'), undefined);
  // Large text: the field may grow more before it scrolls, capped so the thread stays visible.
  const large = load('assistant-composer.tsx', { fontScale: 2 });
  assert.equal(flat(nodes(large.render('AssistantComposer', props)).find(node => node.type === 'TextInput')!.props.style).maxHeight, Math.round(22 * 1.6 * 5));
});

test('the composer clears the safe area or the keyboard, minus what already sits below it (a tab bar), and rides the keyboard on the UI thread', () => {
  const ui = load('assistant-composer.tsx', { bottomInset: 34 });
  const root = ui.render('AssistantComposer', { value: '', onChange: () => {}, onSend: () => {}, onStop: () => {}, busy: false });
  const space = nodes(root).find(node => node.type === 'Animated.View')!;
  const animated = space.props.style[1] as () => { paddingBottom: number };
  assert.equal(animated().paddingBottom, 34 + 8, 'in a stack: home indicator clear, plus the bar\'s own breathing room');
  // As a tab root, the measured tab bar below the screen is subtracted: nothing to add while the keyboard is down.
  space.props.ref.current = { measureInWindow: (done: (x: number, y: number, w: number, h: number) => void) => done(0, 100, 390, 844 - 100 - 83) };
  space.props.onLayout();
  const again = nodes(ui.render('AssistantComposer', { value: '', onChange: () => {}, onSend: () => {}, onStop: () => {}, busy: false })).find(node => node.type === 'Animated.View')!;
  assert.equal((again.props.style[1] as () => { paddingBottom: number })().paddingBottom, 8);
  assert.equal(materialPolicy.composerBottomPadding(336, 34, 83), 253, 'keyboard up over a tab bar: the bar rises to the keyboard\'s top edge');
  assert.equal(materialPolicy.composerBottomPadding(336, 34, 0), 336, 'keyboard up in a stack');
  assert.equal(materialPolicy.composerBottomPadding(0, 0, 0), 0);
  const source = readFileSync(new URL('../src/ui/assistant-composer.tsx', import.meta.url), 'utf8');
  assert.match(source, /useAnimatedKeyboard\(\)/, 'keyboard tracking on the UI thread, no manual offset guessing');
  assert.equal(source.includes('KeyboardAvoidingView'), false);
});

test('the composer bar is a control surface: native glass when the material allows it, the opaque pill otherwise; the send button stays solid', () => {
  const props = { value: 'hola', onChange: () => {}, onSend: () => {}, onStop: () => {}, busy: false };
  const opaque = nodes(load('assistant-composer.tsx').render('AssistantComposer', props)).find(node => node.type === 'ControlSurface')!;
  assert.equal(opaque.props.material, 'opaque');
  assert.equal(opaque.props.opaque.backgroundColor, '#FFFFFF');
  assert.equal(opaque.props.opaque.borderWidth, 0.5, 'hairline edge on the opaque pill');
  assert.ok(opaque.props.opaque.shadowOpacity <= 0.08);
  assert.equal(flat(opaque.props.style).borderRadius, 24);
  const dark = nodes(load('assistant-composer.tsx', { dark: true }).render('AssistantComposer', props)).find(node => node.type === 'ControlSurface')!;
  assert.equal(dark.props.opaque.backgroundColor, '#1C1C1E');
  assert.equal(dark.props.opaque.shadowOpacity, undefined, 'no shadow in dark');
  const glass = nodes(load('assistant-composer.tsx', { material: 'glass' }).render('AssistantComposer', props)).find(node => node.type === 'ControlSurface')!;
  assert.equal(glass.props.material, 'glass');
  assert.equal(glass.props.tint, undefined, 'the composer is untinted glass: the text keeps its own contrast');
  assert.ok(nodes(glass).some(node => node.type === 'TextInput'), 'the field is content of the glass view');
  const send = byLabel(glass, 'Enviar')!;
  assert.equal(flat(nodes(send).find(node => node.type === 'View')!.props.style).backgroundColor, '#2557D6', 'the send button is solid on glass too');
});

// 25A-04: the proposal card. A captured proposal is read from its review item; it is never confirmed in the chat.
const proposalAccounts = [{ id: 'visa', name: 'Visa Galicia', currency: 'ARS', openingMinor: 0, createdAt: '2026-09-01T12:00:00.000Z' },
  { id: 'card-acc', name: 'Mastercard', currency: 'ARS', openingMinor: 0, createdAt: '2026-09-01T12:00:00.000Z' }];
const proposalArchive = { accounts: proposalAccounts, records: [], debts: [], categories: [],
  cards: [{ id: 'mc', accountId: 'card-acc', issuer: 'Banco', last4: '1234', creditLimitMinor: 100000, closingDay: 20, dueDay: 5, active: true, deleted: false,
    createdAt: '2026-09-01T12:00:00.000Z', revision: 0, updatedAt: '2026-09-01T12:00:00.000Z' }] };
const reviewDraft = (change: Partial<domain.ReviewDraft> = {}): domain.ReviewDraft => {
  const draft: domain.ReviewDraft = { version: 1, source: 'assistant', capturedAt: '2026-09-21T10:00:00.000Z', kind: 'expense', amountMinor: 1850000, currency: 'ARS',
    merchant: 'Carrefour', category: 'Supermercado', dateISO: '2026-09-21', destinationId: 'visa', purchase: null, basis: [], ...change };
  return { ...draft, basis: domain.reviewBasis(draft, proposalArchive as domain.ReviewArchive) };
};
const proposal = (draft = reviewDraft(), status: conversation.ProposalContent['status'] = 'captured'): conversation.ProposalContent =>
  ({ kind: 'proposal', status, capture: { id: 'item-1', writeId: 'write-1', captureKey: 'assistant:item-1', at: '2026-09-21T10:00:00.000Z', draft } });
const itemOf = (draft: domain.ReviewDraft) => ({ id: 'item-1', source: 'assistant', captureKey: 'assistant:item-1', draft, writeId: 'write-1', status: 'pending',
  attempt: null, receipt: null, createdAt: '2026-09-21T10:00:00.000Z', updatedAt: '2026-09-21T10:00:00.000Z', revision: 0 });

test('25A-04: a proposal card shows what the review item holds, says what it needs, and leads to «Para revisar»; it never confirms', () => {
  const ui = load('assistant-messages.tsx');
  const calls: string[] = [];
  const handlers = { archive: proposalArchive, onReview: (id: string) => calls.push('review:' + id), onRetry: () => calls.push('retry'),
    onOpenRecord: (record: string, id: string) => calls.push(record + ':' + id) };
  // The live item, edited since the capture: the card reads it, not the snapshot.
  const live = itemOf(reviewDraft({ merchant: 'Carrefour Express' }));
  const pending = ui.render('ProposalCard', { content: proposal(), state: { kind: 'pending', item: live, conflict: false, writable: true }, ...handlers });
  const all = nodes(pending);
  const labels = all.filter(node => typeof node.props.accessibilityLabel === 'string').map(node => node.props.accessibilityLabel);
  assert.deepEqual(labels.filter(label => label.includes(': ')), ['Comercio: Carrefour Express', 'Categoría: Supermercado', 'Dónde se registra: Visa Galicia',
    'Fecha: 21 de septiembre de 2026']);
  assert.equal(all.find(node => node.type === 'Money')!.props.minor, 1850000);
  assert.equal(all.some(node => node.type === 'AppText' && textOf(node) === 'Para revisar · Gasto'), true);
  assert.ok(all.some(node => node.type === 'AppText' && textOf(node) === 'Lista para confirmar en Para revisar.'));
  assert.deepEqual(all.filter(node => node.type === 'ActionButton').map(node => [node.props.label, node.props.secondary]), [['Revisar', true]],
    'one way on: the review; no Confirmar, Editar or Descartar in the chat, and no lime');
  all.find(node => node.type === 'ActionButton')!.props.onPress();
  assert.deepEqual(calls, ['review:item-1']);
  assert.equal(pending.type, 'Appear');
  // Missing facts read as missing, neutral, never invented: no amount, no date (never «Hoy»).
  const gappy = itemOf(reviewDraft({ amountMinor: null, currency: null, dateISO: null, merchant: null }));
  const incomplete = nodes(ui.render('ProposalCard', { content: proposal(), state: { kind: 'pending', item: gappy, conflict: false, writable: true }, ...handlers }));
  assert.equal(incomplete.some(node => node.type === 'Money'), false);
  assert.ok(incomplete.some(node => node.type === 'AppText' && textOf(node) === 'Sin monto'));
  assert.ok(incomplete.some(node => node.props.accessibilityLabel === 'Fecha: Falta completar'));
  assert.ok(incomplete.some(node => node.props.accessibilityLabel === 'Comercio: Falta completar'));
  const line = incomplete.find(node => node.type === 'AppText' && /Faltan 4 datos/.test(textOf(node)))!;
  assert.equal(line.props.style.color, '#6E7078', 'incomplete is neutral, never a warning or an error');
  // A card destination shows the purchase mode the domain chose: «Una vez».
  const onCard = nodes(ui.render('ProposalCard', { content: proposal(), state: { kind: 'pending', item: itemOf(reviewDraft({ destinationId: 'card-acc', purchase: { mode: 'once' } })), conflict: false, writable: true }, ...handlers }));
  assert.ok(onCard.some(node => node.props.accessibilityLabel === 'Pago: Una vez'));
  // Capturing, failed, preview: the snapshot, and what is happening; Reintentar only after a failure.
  const capturing = nodes(ui.render('ProposalCard', { content: proposal(reviewDraft(), 'capturing'), state: { kind: 'capturing' }, ...handlers }));
  assert.ok(capturing.some(node => node.type === 'AppText' && textOf(node) === 'Guardando en Para revisar…'));
  assert.equal(capturing.some(node => node.type === 'ActionButton'), false);
  const failed = nodes(ui.render('ProposalCard', { content: proposal(reviewDraft(), 'failed'), state: { kind: 'failed' }, ...handlers }));
  assert.ok(failed.some(node => node.type === 'AppText' && textOf(node) === 'No se pudo guardar en Para revisar. No se registró nada.'));
  failed.find(node => node.type === 'ActionButton' && node.props.label === 'Reintentar')!.props.onPress();
  assert.equal(calls.at(-1), 'retry');
  const preview = nodes(ui.render('ProposalCard', { content: proposal(reviewDraft(), 'preview'), state: { kind: 'preview' }, ...handlers }));
  assert.ok(preview.some(node => node.type === 'AppText' && textOf(node) === 'Vista de prueba: esta propuesta no se guarda ni se puede registrar.'));
  assert.equal(preview.some(node => node.type === 'ActionButton'), false, 'nothing a preview could save or record');
  // Confirmed there: a receipt and the link to what was recorded; dismissed or gone: one quiet line, nothing to press.
  // Confirmed after an edit in «Para revisar»: the card draws the recorded item, never the capture's snapshot.
  const recorded = { ...itemOf(reviewDraft({ merchant: 'Kiosco Pepe', amountMinor: 990000, dateISO: '2026-09-19' })), status: 'confirmed' };
  const confirmed = nodes(ui.render('ProposalCard', { content: proposal(), state: { kind: 'confirmed', item: recorded, record: 'plan' }, ...handlers }));
  assert.ok(confirmed.some(node => node.props.accessibilityLabel === 'Comercio: Kiosco Pepe'));
  assert.equal(confirmed.some(node => node.props.accessibilityLabel === 'Comercio: Carrefour'), false);
  assert.equal(confirmed.find(node => node.type === 'Money')!.props.minor, 990000);
  assert.ok(confirmed.some(node => node.props.accessibilityLabel === 'Fecha: 19 de septiembre de 2026'));
  assert.ok(confirmed.some(node => node.type === 'AppText' && textOf(node) === 'Registrado desde Para revisar.'));
  assert.deepEqual(confirmed.filter(node => node.type === 'ActionButton').map(node => node.props.label), ['Ver plan']);
  confirmed.find(node => node.type === 'ActionButton')!.props.onPress();
  assert.equal(calls.at(-1), 'plan:write-1');
  const dismissed = ui.render('ProposalCard', { content: proposal(), state: { kind: 'dismissed' }, ...handlers });
  assert.equal(dismissed.props.accessibilityLabel, 'Propuesta descartada. No se registró nada.');
  assert.equal(nodes(dismissed).some(node => node.type === 'ActionButton'), false);
  assert.equal(ui.render('ProposalCard', { content: proposal(), state: { kind: 'gone' }, ...handlers }).props.accessibilityLabel, 'Esta propuesta ya no está pendiente.');
  // Income: «Origen», «+», and the review's own words for a stale one (amber).
  const income = nodes(ui.render('ProposalCard', { content: proposal(), state: { kind: 'pending', item: itemOf({ ...reviewDraft({ kind: 'income', merchant: 'Sueldo', category: 'Sueldo' }), basis: [] }), conflict: false, writable: true }, ...handlers }));
  assert.ok(income.some(node => node.props.accessibilityLabel === 'Origen: Sueldo'));
  assert.equal(income.find(node => node.type === 'Money')!.props.signed, true);
  assert.ok(income.some(node => node.type === 'AppText' && textOf(node) === 'Revisala de nuevo' && node.props.style.color === '#B45309'));
});

test('suggestions cap at four with VoiceOver names; clarification chips tick once and leave after a choice', () => {
  const ui = load('assistant-messages.tsx');
  const picked: string[] = [];
  const suggestions = ui.render('Suggestions', { items: ['a', 'b', 'c', 'd', 'e', 'f'], onPick: (text: string) => picked.push(text) });
  const chips = nodes(suggestions).filter(node => node.props.accessibilityRole === 'button');
  assert.equal(chips.length, 4);
  assert.ok(nodes(suggestions).some(node => node.props.accessibilityRole === 'header' && node.props.children === '¿En qué te ayudo?'));
  // 24UX6C: the empty conversation's mark is the accent circle with the onAccent sparkles, as in the capture hub.
  const sparkles = nodes(suggestions).find(node => node.type === 'Ionicons')!;
  assert.equal(sparkles.props.name, 'sparkles');
  assert.equal(sparkles.props.color, '#0F2A22');
  const glyphTile = nodes(suggestions).find(node => node.type === 'View' && node.props.children === sparkles)!;
  assert.equal(flat(glyphTile.props.style).backgroundColor, '#9FD8C1');
  const darkSparkles = nodes(load('assistant-messages.tsx', { dark: true }).render('Suggestions', { items: ['a'], onPick: () => {} }));
  assert.equal(darkSparkles.find(node => node.type === 'Ionicons')!.props.color, '#05211A');
  assert.ok(darkSparkles.some(node => node.type === 'View' && flat(node.props.style).backgroundColor === '#86C9B0'));
  chips[0].props.onPress();
  assert.deepEqual(picked, ['a']);
  const chosen: string[] = [];
  const options = [{ id: 'visa', label: 'Visa Galicia' }, { id: 'cash', label: 'Efectivo' }];
  const open = ui.render('ClarificationChoices', { options, chosen: null, onChoose: (option: any) => chosen.push(option.id) });
  assert.equal(open.type, 'Reflow');
  const choices = nodes(open).filter(node => node.props.accessibilityRole === 'button');
  assert.deepEqual(choices.map(node => node.props.accessibilityLabel), ['Visa Galicia', 'Efectivo']);
  choices[1].props.onPress();
  assert.deepEqual(chosen, ['cash']);
  assert.deepEqual(ui.haptics, ['selection'], 'one selection tick per choice');
  assert.equal(ui.render('ClarificationChoices', { options, chosen: 'cash', onChoose: () => {} }), null, 'chips leave once chosen');
  assert.equal(ui.render('ClarificationChoices', { options: [], chosen: null, onChoose: () => {} }), null, 'a typed clarification shows no chips');
});

test('assistant text, thinking and system notes are said in words; the pulse stops under Reduce Motion; retry only when the message was sent', () => {
  const ui = load('assistant-messages.tsx');
  const done = ui.render('AssistantText', { text: 'Gastaste más.', status: 'done' });
  assert.equal(done.props.accessibilityLabel, 'Asistente: Gastaste más.');
  const stopped = ui.render('AssistantText', { text: 'Gastaste', status: 'stopped' });
  assert.ok(nodes(stopped).some(node => node.type === 'AppText' && node.props.children === 'Respuesta interrumpida.'));
  const thinking = ui.render('AssistantText', { text: '', status: 'streaming' });
  const pulse = nodes(thinking).find(node => node.props.accessibilityLabel === 'Asistente: pensando')!;
  assert.equal(pulse.props.accessibilityState.busy, true);
  assert.ok(nodes(pulse).some(node => node.type === 'AppText' && node.props.children === 'Pensando…'), 'the state is written, not only pulsed');
  assert.equal(ui.shared.at(-1)!.value, 0.3, 'the dot pulses');
  const still = load('assistant-messages.tsx', { reduced: true });
  nodes(still.render('AssistantText', { text: '', status: 'streaming' }));
  assert.equal(still.shared.at(-1)!.value, 1, 'Reduce Motion: no pulse, the words carry the state');
  const user = ui.render('UserMessage', { text: 'Gasté 500' });
  assert.equal(nodes(user).find(node => node.props.accessibilityLabel)!.props.accessibilityLabel, 'Vos: Gasté 500');
  const retried: string[] = [];
  const offline = ui.render('SystemNote', { message: { id: 's', role: 'system', reason: 'offline', text: 'Sin conexión.', retryText: 'hola' }, onRetry: (text: string) => retried.push(text) });
  byLabel(offline, 'Reintentar')!.props.onPress();
  assert.deepEqual(retried, ['hola']);
  assert.equal(nodes(offline).find(node => node.type === 'Ionicons')!.props.name, 'cloud-offline-outline');
  const unavailable = ui.render('SystemNote', { message: { id: 's', role: 'system', reason: 'unavailable', text: 'No conectado.', retryText: null }, onRetry: () => {} });
  assert.equal(byLabel(unavailable, 'Reintentar'), undefined, 'nothing was sent, so there is nothing to retry');
});

test('answer evidence renders rows with the shared Money component and links as text buttons; nothing when there is no evidence', () => {
  const ui = load('assistant-messages.tsx');
  const opened: unknown[] = [];
  const content = conversation.answerContent({ factIds: ['current.category.1', 'previous.category.1'] },
    [{ id: 'current.category.1', label: 'Categoría de gasto: Supermercado', amountMinor: 12120000, count: 11, startISO: '2026-09-01', endISO: '2026-09-21' },
      { id: 'previous.category.1', label: 'Categoría de gasto: Supermercado', amountMinor: 9000000, count: 10, startISO: '2026-08-01', endISO: '2026-08-21' }], 'ARS');
  const root = ui.render('AnswerEvidence', { content, currency: 'ARS', onOpen: (href: unknown) => opened.push(href) });
  const money = nodes(root).filter(node => node.type === 'Money');
  assert.equal(money.length, 1);
  assert.equal(money[0].props.minor, 3120000);
  assert.equal(money[0].props.signed, true);
  assert.equal(money[0].props.currency, 'ARS');
  // The row is one VoiceOver element: its label says the amount too, in spoken form (no grouping), not only the name.
  assert.deepEqual(nodes(root).filter(node => node.type === 'View' && node.props.accessible).map(node => node.props.accessibilityLabel), ['Supermercado, 31200,00 pesos más'], 'a difference that grew says so; the screen shows +$ 31.200,00');
  const links = nodes(root).filter(node => node.props.accessibilityRole === 'link');
  assert.deepEqual(links.map(node => node.props.accessibilityLabel), ['Ver categoría', 'Ver movimientos']);
  links[1].props.onPress();
  assert.equal(JSON.stringify(opened), JSON.stringify([{ pathname: '/activity' }]));
  assert.equal(ui.render('AnswerEvidence', { content: { kind: 'answer', rows: [], links: [] }, currency: 'ARS', onOpen: () => {} }), null);
});

test('English: every word the Assistant UI says is English; account names, merchants, custom categories and the model\'s text are untouched', () => {
  const ui = load('assistant-messages.tsx', { locale: 'en-AR' });
  const handlers = { archive: proposalArchive, onReview: () => {}, onRetry: () => {}, onOpenRecord: () => {} };
  const pending = ui.render('ProposalCard', { content: proposal(), state: { kind: 'pending', item: itemOf(reviewDraft()), conflict: false, writable: true }, ...handlers });
  const labels = nodes(pending).map(node => node.props.accessibilityLabel).filter((label): label is string => typeof label === 'string');
  assert.deepEqual(labels.filter(label => label.includes(': ')), ['Merchant: Carrefour', 'Category: Groceries', 'Recorded in: Visa Galicia', 'Date: September 21, 2026']);
  assert.ok(nodes(pending).some(node => node.type === 'CategoryBadge' && node.props.category === 'Supermercado'), 'the stored category is what the badge receives');
  assert.ok(nodes(pending).some(node => node.type === 'AppText' && textOf(node) === 'To review · Expense'));
  assert.deepEqual(nodes(pending).filter(node => node.type === 'ActionButton').map(node => node.props.label), ['Review']);
  const custom = ui.render('ProposalCard', { content: proposal(), state: { kind: 'pending', item: itemOf(reviewDraft({ category: 'Kiosco Pepe', merchant: null, destinationId: null })), conflict: false, writable: true }, ...handlers });
  const customLabels = nodes(custom).map(node => node.props.accessibilityLabel);
  assert.ok(customLabels.includes('Category: Kiosco Pepe'), 'a custom category is the user\'s word');
  assert.ok(customLabels.includes('Merchant: Missing'));
  assert.ok(customLabels.includes('Recorded in: Missing'));
  assert.ok(nodes(custom).some(node => node.type === 'AppText' && textOf(node) === '3 details missing: complete them in To review.'));
  const income = ui.render('ProposalCard', { content: proposal(reviewDraft({ kind: 'income', merchant: 'Sueldo', category: 'Sueldo' })), state: { kind: 'confirmed', item: { ...itemOf(reviewDraft({ kind: 'income', merchant: 'Sueldo', category: 'Sueldo' })), status: 'confirmed' }, record: 'entry' }, ...handlers });
  assert.ok(nodes(income).some(node => node.props.accessibilityLabel === 'Source: Sueldo'));
  assert.ok(nodes(income).some(node => node.type === 'AppText' && textOf(node) === 'Recorded · Income'));
  assert.deepEqual(nodes(income).filter(node => node.type === 'ActionButton').map(node => node.props.label), ['View transaction']);
  assert.equal(ui.render('ProposalCard', { content: proposal(), state: { kind: 'dismissed' }, ...handlers }).props.accessibilityLabel, 'Proposal discarded. Nothing was recorded.');
  // The model's text is shown as it arrived; only the frame around it is English.
  const answer = ui.render('AssistantText', { text: 'Gastaste más.', status: 'stopped' });
  assert.equal(answer.props.accessibilityLabel, 'Assistant: Gastaste más.');
  assert.ok(nodes(answer).some(node => node.type === 'AppText' && node.props.children === 'Response stopped.'));
  assert.equal(nodes(ui.render('UserMessage', { text: 'Gasté 500' })).find(node => node.props.accessibilityLabel)!.props.accessibilityLabel, 'You: Gasté 500');
  const thinking = nodes(ui.render('AssistantText', { text: '', status: 'streaming' }));
  assert.ok(thinking.some(node => node.props.accessibilityLabel === 'Assistant: thinking'));
  assert.ok(thinking.some(node => node.type === 'AppText' && node.props.children === 'Thinking…'));
  // A note stored as a key reads in English; a caught sentence nobody translated is shown as it was thrown.
  const note = ui.render('SystemNote', { message: { id: 's', role: 'system', reason: 'offline', text: 'assistant.reasons.offline', retryText: 'hola' }, onRetry: () => {} });
  assert.equal(note.props.accessibilityLabel, 'No connection. Your transactions didn’t change; you can retry.');
  assert.ok(byLabel(note, 'Retry'));
  assert.equal(ui.render('SystemNote', { message: { id: 's', role: 'system', reason: 'failed', text: 'Respuesta inválida del servidor.', retryText: null } }).props.accessibilityLabel, 'Respuesta inválida del servidor.');
  // Clarification chips: the app's words translate, account names do not, a built-in category reads localized and is echoed as shown.
  const chosen: string[] = [];
  const kinds = nodes(ui.render('ClarificationChoices', { options: [{ id: 'expense', labelKey: 'movement.expense' }, { id: 'income', labelKey: 'movement.income' }], chosen: null, onChoose: (_o: unknown, shown: string) => chosen.push(shown) }))
    .filter(node => node.props.accessibilityRole === 'button');
  assert.deepEqual(kinds.map(node => node.props.accessibilityLabel), ['Expense', 'Income']);
  kinds[1].props.onPress();
  const categories = nodes(ui.render('ClarificationChoices', { options: conversation.categoryOptions([
    { id: 'a', accountId: 'visa', kind: 'expense', amountMinor: 1, merchant: 'x', category: 'Supermercado', dateISO: '2026-09-01', createdAt: 'x' },
    { id: 'b', accountId: 'visa', kind: 'expense', amountMinor: 1, merchant: 'x', category: 'Kiosco Pepe', dateISO: '2026-09-01', createdAt: 'x' }], 'expense'), chosen: null,
  onChoose: (option: any, shown: string) => chosen.push(option.id + '=' + shown) })).filter(node => node.props.accessibilityRole === 'button');
  assert.deepEqual(categories.map(node => node.props.accessibilityLabel), ['Kiosco Pepe', 'Groceries']);
  categories[1].props.onPress();
  assert.deepEqual(chosen, ['Income', 'Supermercado=Groceries'], 'the option id stays the stored category; the echo is what was shown');
  // An income draft asks with income categories: a built-in one is found as income, so it reads in English too.
  const incomeChips = nodes(ui.render('ClarificationChoices', { options: conversation.categoryOptions([
    { id: 'c', accountId: 'visa', kind: 'income', amountMinor: 1, merchant: 'x', category: 'Sueldo', dateISO: '2026-09-01', createdAt: 'x' },
    { id: 'd', accountId: 'visa', kind: 'income', amountMinor: 1, merchant: 'x', category: 'Sueldo', dateISO: '2026-09-02', createdAt: 'x' },
    { id: 'e', accountId: 'visa', kind: 'income', amountMinor: 1, merchant: 'x', category: 'Clases de piano', dateISO: '2026-09-01', createdAt: 'x' }], 'income'), chosen: null,
  onChoose: (option: any, shown: string) => chosen.push(option.id + '=' + shown) })).filter(node => node.props.accessibilityRole === 'button');
  assert.deepEqual(incomeChips.map(node => node.props.accessibilityLabel), ['Salary', 'Clases de piano']);
  incomeChips[0].props.onPress();
  assert.equal(chosen.at(-1), 'Sueldo=Salary', 'the stored income category is what the draft receives');
  const accountsChips = nodes(ui.render('ClarificationChoices', { options: [{ id: 'visa', label: 'Visa Galicia' }], chosen: null, onChoose: () => {} })).filter(node => node.props.accessibilityRole === 'button');
  assert.deepEqual(accountsChips.map(node => node.props.accessibilityLabel), ['Visa Galicia']);
  // Evidence: rows named from the fact id in English, built-in categories localized; links from their stable ids.
  const content = conversation.answerContent({ factIds: ['current.expenses', 'current.category.1', 'previous.category.0'] }, [
    { id: 'current.expenses', label: 'Gastos registrados', amountMinor: 5, count: 1, startISO: '2026-09-01', endISO: '2026-09-21' },
    { id: 'current.category.1', label: 'Categoría de gasto: Supermercado', amountMinor: 3, count: 1, startISO: '2026-09-01', endISO: '2026-09-21' },
    { id: 'previous.category.0', label: 'Categoría de gasto: Kiosco Pepe', amountMinor: 2, count: 1, startISO: '2026-08-01', endISO: '2026-08-21' }], 'ARS');
  const evidence = ui.render('AnswerEvidence', { content, currency: 'ARS', onOpen: () => {} });
  const rows = nodes(evidence).filter(node => node.type === 'View' && node.props.accessible).map(node => node.props.accessibilityLabel);
  assert.deepEqual(rows, ['Recorded expenses, 0.05 pesos', 'Groceries, 0.03 pesos', 'Kiosco Pepe (previous month), 0.02 pesos']);
  assert.deepEqual(nodes(evidence).filter(node => node.props.accessibilityRole === 'link').map(node => node.props.accessibilityLabel), ['View category', 'View transactions']);
  const suggestions = ui.render('Suggestions', { items: ['Record an expense'], onPick: () => {} });
  assert.ok(nodes(suggestions).some(node => node.props.accessibilityRole === 'header' && node.props.children === 'How can I help?'));
  // The composer.
  const composer = load('assistant-composer.tsx', { locale: 'en-AR' });
  let bar = composer.render('AssistantComposer', { value: '', onChange: () => {}, onSend: () => {}, onStop: () => {}, busy: false });
  const input = nodes(bar).find(node => node.type === 'TextInput')!;
  assert.equal(input.props.placeholder, 'Ask or record something…');
  assert.equal(input.props.accessibilityLabel, 'Message for the Assistant');
  assert.equal(byLabel(bar, 'Dictate'), undefined, 'no microphone in English either');
  assert.ok(byLabel(bar, 'Send'));
  bar = composer.render('AssistantComposer', { value: 'x', onChange: () => {}, onSend: () => {}, onStop: () => {}, busy: true });
  assert.ok(byLabel(bar, 'Stop response'));
  assert.equal(nodes(bar).some(node => node.type === 'AppText'), false, 'no dictation note');
});

test('VoiceOver: with an interface language that differs from the device\'s, every element the Assistant builds speaks it; amounts are said in spoken form', () => {
  // English chosen in Más on a Spanish iPhone: each element VoiceOver reaches that is not a shared component carries the interface language.
  const english = load('assistant-messages.tsx', { locale: 'en-US', deviceLanguage: 'es' });
  const handlers = { archive: proposalArchive, onReview: () => {}, onRetry: () => {}, onOpenRecord: () => {} };
  const content = conversation.answerContent({ factIds: ['current.category.1', 'previous.category.1'] },
    [{ id: 'current.category.1', label: 'Categoría de gasto: Supermercado', amountMinor: 12120000, count: 11, startISO: '2026-09-01', endISO: '2026-09-21' },
      { id: 'previous.category.1', label: 'Categoría de gasto: Supermercado', amountMinor: 12200000, count: 10, startISO: '2026-08-01', endISO: '2026-08-21' }], 'ARS');
  const rendered = (ui: ReturnType<typeof load>) => [
    ui.render('UserMessage', { text: 'Spent 500' }),
    ui.render('AssistantText', { text: 'Gastaste más.', status: 'done' }),
    ui.render('AssistantText', { text: '', status: 'streaming' }),
    ui.render('SystemNote', { message: { id: 's', role: 'system', reason: 'offline', text: 'assistant.reasons.offline', retryText: null } }),
    ui.render('AnswerEvidence', { content, currency: 'ARS', onOpen: () => {} }),
    ui.render('ProposalCard', { content: proposal(), state: { kind: 'pending', item: itemOf(reviewDraft()), conflict: false, writable: true }, ...handlers }),
    ui.render('ProposalCard', { content: proposal(), state: { kind: 'dismissed' }, ...handlers }),
  ].flatMap(nodes).filter(node => node.type === 'View' && node.props.accessible);
  const elements = rendered(english);
  assert.equal(elements.length, 10, 'user, answer, thinking, note, one evidence row, four proposal rows, the collapsed card');
  const answerLabel = (node: { props: { accessibilityLabel?: string } }) => /^Assistant: /.test(String(node.props.accessibilityLabel));
  assert.deepEqual([...new Set(elements.filter(node => !answerLabel(node)).map(node => node.props.accessibilityLanguage))], ['en']);
  // The model's prose is content: the v1 server writes Spanish, so it keeps a Spanish voice whatever the interface says.
  assert.equal(elements.find(answerLabel)!.props.accessibilityLanguage, 'es');
  const englishDevice = nodes(load('assistant-messages.tsx', { locale: 'en-US', deviceLanguage: 'en' }).render('AssistantText', { text: 'Gastaste más.', status: 'done' }))
    .find(node => node.type === 'View' && node.props.accessible)!;
  assert.equal(englishDevice.props.accessibilityLanguage, 'es', 'an English iPhone reading an English interface still hears the Spanish answer in Spanish');
  // The app's own turns (a clarification question, "review the draft") are interface copy, not model prose: the usual rule.
  const own = (locale: AppLocale, deviceLanguage: string) => nodes(load('assistant-messages.tsx', { locale, deviceLanguage })
    .render('AssistantText', { text: 'What did you pay with?', status: 'done', ownWords: true })).find(node => node.type === 'View' && node.props.accessible)!.props.accessibilityLanguage;
  assert.deepEqual([own('en-US', 'en'), own('en-AR', 'es'), own('es-AR', 'es'), own('es-US', 'en')], [undefined, 'en', undefined, 'es']);
  // An answer keeps the currency it was computed in, and a difference that grew says so in English too.
  const dollars = conversation.answerContent({ factIds: ['current.category.1', 'previous.category.1'] },
    [{ id: 'current.category.1', label: 'Categoría de gasto: Supermercado', amountMinor: 50000, count: 2, startISO: '2026-09-01', endISO: '2026-09-21' },
      { id: 'previous.category.1', label: 'Categoría de gasto: Supermercado', amountMinor: 20000, count: 1, startISO: '2026-08-01', endISO: '2026-08-21' }], 'USD');
  const usd = nodes(load('assistant-messages.tsx', { locale: 'en-US', deviceLanguage: 'en' }).render('AnswerEvidence', { content: dollars, onOpen: () => {} }));
  assert.equal(usd.find(node => node.type === 'Money')!.props.currency, 'USD');
  assert.deepEqual(usd.filter(node => node.type === 'View' && node.props.accessible).map(node => node.props.accessibilityLabel), ['Groceries, 300.00 dollars more']);
  // A difference below zero is said as such, in the language's words and decimal mark.
  assert.ok(elements.some(node => node.props.accessibilityLabel === 'Groceries, Minus 800.00 pesos'));
  const field = nodes(load('assistant-composer.tsx', { locale: 'en-US', deviceLanguage: 'es' }).render('AssistantComposer', { value: '', onChange: () => {}, onSend: () => {}, onStop: () => {}, busy: false }))
    .find(node => node.type === 'TextInput')!;
  assert.equal(field.props.accessibilityLanguage, 'en', 'the message field too');
  // Device and app agree: nothing is set, so VoiceOver keeps the voice chosen in iOS Settings.
  assert.deepEqual([...new Set(rendered(load('assistant-messages.tsx', { deviceLanguage: 'es' })).map(node => node.props.accessibilityLanguage))], [undefined]);
  assert.equal(nodes(load('assistant-composer.tsx').render('AssistantComposer', { value: '', onChange: () => {}, onSend: () => {}, onStop: () => {}, busy: false }))
    .find(node => node.type === 'TextInput')!.props.accessibilityLanguage, undefined);
  // Spanish chosen on an English iPhone: the Spanish voice, and the Spanish decimal mark in the spoken amount.
  const spanish = rendered(load('assistant-messages.tsx', { locale: 'es-US', deviceLanguage: 'en' }));
  assert.deepEqual([...new Set(spanish.map(node => node.props.accessibilityLanguage))], ['es']);
  assert.ok(spanish.some(node => node.props.accessibilityLabel === 'Supermercado, Menos 800,00 pesos'));
});
