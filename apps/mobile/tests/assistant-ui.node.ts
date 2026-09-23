import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as conversation from '../src/assistant/conversation.ts';
import * as materialPolicy from '../src/ui/material-policy.ts';
import * as presentation from '../src/ui/presentation.ts';
import * as i18nFormat from '../src/i18n/format.ts';
import { bindLocale } from '../src/i18n/bind.ts';
const i18nProvider = { useI18n: () => bindLocale('es-AR') };

// Producto 21: the composer and the message components at source level, with
// React Native, Reanimated and the safe area replaced by descriptors. This
// checks structure, labels and state logic; rendering, VoiceOver order,
// keyboard tracking and the pulse need the iPhone.
type Node = { type: any; props: Record<string, any> };
function load(file: string, { reduced = false, fontScale = 1, dark = false, bottomInset = 34, material = 'opaque' as 'opaque' | 'glass' } = {}) {
  const source = readFileSync(new URL('../src/ui/' + file, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const jsx = (type: any, props: any) => ({ type, props });
  const state: unknown[] = [];
  const shared: { value: number }[] = [];
  const haptics: string[] = [];
  let cursor = 0;
  const palette = dark
    ? { isDark: true, background: '#000', surface: '#1C1C1E', inset: '#2C2C2E', text: '#F5F5F7', secondary: '#A0A0A8', tertiary: '#7C7C84', line: '#2C2C30', primary: '#5B87FF', primaryFill: '#3565EA', onPrimary: '#FFF', primarySoft: '#122048', income: '#3DBE86', warning: '#E8A030' }
    : { isDark: false, background: '#F2F2F6', surface: '#FFFFFF', inset: '#EEEEF3', text: '#0A0A0C', secondary: '#6E7078', tertiary: '#8E9098', line: '#E6E6EC', primary: '#2557D6', primaryFill: '#2557D6', onPrimary: '#FFF', primarySoft: '#E5ECFB', income: '#15804F', warning: '#B45309' };
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

test('the composer labels its field, microphone and send; send is disabled when empty and becomes Stop while busy', () => {
  const ui = load('assistant-composer.tsx');
  const events: string[] = [];
  const props = { value: '', onChange: () => {}, onSend: () => events.push('send'), onStop: () => events.push('stop'), busy: false };
  let root = ui.render('AssistantComposer', props);
  const input = nodes(root).find(node => node.type === 'TextInput')!;
  assert.equal(input.props.accessibilityLabel, 'Mensaje para el Asistente');
  assert.equal(input.props.placeholder, ui.exports.COMPOSER_PLACEHOLDER as unknown as string);
  assert.equal(input.props.multiline, true);
  assert.equal(flat(input.props.style).maxHeight, 22 * 5, 'about five lines, then the field scrolls inside');
  const mic = byLabel(root, 'Dictar')!;
  assert.equal(mic.props.accessibilityHint, 'Todavía no disponible en esta versión');
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
  // The microphone opens the boundary note instead of a recorder; nothing native is touched.
  root = ui.render('AssistantComposer', props);
  assert.equal(nodes(root).some(node => node.type === 'AppText' && /development build/.test(String(node.props.children))), false);
  byLabel(root, 'Dictar')!.props.onPress();
  root = ui.render('AssistantComposer', props);
  assert.ok(nodes(root).some(node => node.type === 'AppText' && /development build/.test(String(node.props.children))));
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

test('a draft card lists kind, amount, merchant, category, account and date, confirms only when complete, and collapses when cancelled or edited', () => {
  const ui = load('assistant-messages.tsx');
  const accounts = [{ id: 'visa', name: 'Visa Galicia', currency: 'ARS', openingMinor: 0, createdAt: 'x' }];
  const draft = { kind: 'expense', amountMinor: 1850000, currency: 'ARS', merchant: 'Carrefour', category: 'Supermercado', dateISO: '2026-09-21', accountId: 'visa' };
  const calls: string[] = [];
  const handlers = { accounts, onConfirm: () => calls.push('confirm'), onEdit: () => calls.push('edit'), onCancel: () => calls.push('cancel'), onOpenEntry: (id: string) => calls.push('open:' + id) };
  const pending = ui.render('DraftCard', { content: { kind: 'draft', draft, status: 'pending', entryId: null }, ...handlers });
  const all = nodes(pending);
  const labels = all.filter(node => typeof node.props.accessibilityLabel === 'string').map(node => node.props.accessibilityLabel);
  assert.deepEqual(labels.filter(label => label.includes(': ')), ['Comercio: Carrefour', 'Categoría: Supermercado', 'Pagado con: Visa Galicia', 'Fecha: Hoy · 21 sep']);
  assert.equal(all.find(node => node.type === 'Money')!.props.minor, 1850000);
  assert.equal(all.find(node => node.type === 'Money')!.props.tone, 'expense');
  assert.ok(all.some(node => node.type === 'CategoryBadge' && node.props.category === 'Supermercado'));
  assert.ok(all.some(node => node.type === 'AccountBadge' && node.props.accountId === 'visa'));
  assert.equal(all.some(node => node.type === 'AppText' && /Borrador · Gasto/.test(textOf(node))), true);
  const buttons = all.filter(node => node.type === 'ActionButton').map(node => node.props.label);
  assert.deepEqual(buttons, ['Confirmar', 'Editar']);
  assert.equal(all.find(node => node.type === 'ActionButton' && node.props.label === 'Confirmar')!.props.disabled, false);
  all.find(node => node.type === 'ActionButton' && node.props.label === 'Confirmar')!.props.onPress();
  all.find(node => node.type === 'ActionButton' && node.props.label === 'Editar')!.props.onPress();
  byLabel(pending, 'Descartar borrador')!.props.onPress();
  assert.deepEqual(calls, ['confirm', 'edit', 'cancel']);
  assert.equal(pending.type, 'Appear', 'the card reveals with the shared motion (fade only under Reduce Motion)');
  // A gap (no account, no merchant) disables Confirmar and says what is missing.
  const gappy = ui.render('DraftCard', { content: { kind: 'draft', draft: { ...draft, accountId: null, merchant: '' }, status: 'pending', entryId: null }, ...handlers });
  assert.equal(nodes(gappy).find(node => node.type === 'ActionButton' && node.props.label === 'Confirmar')!.props.disabled, true);
  assert.ok(nodes(gappy).some(node => node.type === 'AppText' && /Completá los datos que faltan/.test(textOf(node))));
  assert.ok(nodes(gappy).some(node => node.props.accessibilityLabel === 'Pagado con: Falta elegir'));
  // Income wording.
  const income = ui.render('DraftCard', { content: { kind: 'draft', draft: { ...draft, kind: 'income', merchant: 'Sueldo' }, status: 'pending', entryId: null }, ...handlers });
  assert.ok(nodes(income).some(node => node.props.accessibilityLabel === 'Ingresa en: Visa Galicia'));
  assert.ok(nodes(income).some(node => node.props.accessibilityLabel === 'Origen: Sueldo'));
  // Confirmed: a receipt with the link to the movement, no more Confirmar.
  const confirmed = ui.render('DraftCard', { content: { kind: 'draft', draft, status: 'confirmed', entryId: 'e-1' }, ...handlers });
  assert.deepEqual(nodes(confirmed).filter(node => node.type === 'ActionButton').map(node => node.props.label), ['Ver movimiento']);
  nodes(confirmed).find(node => node.type === 'ActionButton')!.props.onPress();
  assert.equal(calls.at(-1), 'open:e-1');
  assert.ok(nodes(confirmed).some(node => node.type === 'AppText' && /Guardado · Gasto/.test(textOf(node))));
  // Cancelled and edited collapse to one line that says so.
  const cancelled = ui.render('DraftCard', { content: { kind: 'draft', draft, status: 'cancelled', entryId: null }, ...handlers });
  assert.equal(cancelled.props.accessibilityLabel, 'Borrador descartado');
  assert.equal(nodes(cancelled).some(node => node.type === 'ActionButton'), false);
  const edited = ui.render('DraftCard', { content: { kind: 'draft', draft, status: 'edited', entryId: null }, ...handlers });
  assert.equal(edited.props.accessibilityLabel, 'Borrador abierto en el formulario');
});

test('suggestions cap at four with VoiceOver names; clarification chips tick once and leave after a choice', () => {
  const ui = load('assistant-messages.tsx');
  const picked: string[] = [];
  const suggestions = ui.render('Suggestions', { items: ['a', 'b', 'c', 'd', 'e', 'f'], onPick: (text: string) => picked.push(text) });
  const chips = nodes(suggestions).filter(node => node.props.accessibilityRole === 'button');
  assert.equal(chips.length, 4);
  assert.ok(nodes(suggestions).some(node => node.props.accessibilityRole === 'header' && node.props.children === '¿En qué te ayudo?'));
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
  const links = nodes(root).filter(node => node.props.accessibilityRole === 'link');
  assert.deepEqual(links.map(node => node.props.accessibilityLabel), ['Ver categoría', 'Ver movimientos']);
  links[1].props.onPress();
  assert.equal(JSON.stringify(opened), JSON.stringify([{ pathname: '/activity' }]));
  assert.equal(ui.render('AnswerEvidence', { content: { kind: 'answer', rows: [], links: [] }, currency: 'ARS', onOpen: () => {} }), null);
});
