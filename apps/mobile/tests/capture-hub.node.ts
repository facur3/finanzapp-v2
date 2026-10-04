import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import type { Account } from '@finanzapp/domain';
import { createConversationSession, lastUserWords, type ConversationSession } from '../src/assistant/session.ts';
import { bindLocale } from '../src/i18n/bind.ts';
import type { AppLocale } from '../src/i18n/locale.ts';
import * as dockGeometry from '../src/ui/dock-geometry.ts';
import * as presentation from '../src/ui/presentation.ts';
import { lightPalette } from '../src/ui/palette.ts';
let locale: AppLocale = 'es-AR';
const i18nProvider = { useI18n: () => bindLocale(locale) };

// Producto 24UX6A (decision 005): the dock's «+» and the capture hub it opens, over the actual module with host
// components as descriptors. The session is the real one (src/assistant/session.ts, the real conversation reducer), the
// dock geometry and the currency helpers are the real pure modules. The hub's card itself (rise, Reduce Motion fade,
// VoiceOver modality and escape, the dismissal timing) is BottomSheet's, pinned in tests/date-field.node.ts. How the «+»,
// the hub and the first-choice hold feel on an iPhone remain device acceptance items.
const palette = { ...lightPalette, isDark: false };

// Synthetic fixtures only: a live ARS and USD account and a deleted EUR one (its history stays in the view's scope,
// but no new movement can be recorded in it).
const at = '2026-09-01T12:00:00Z';
const accounts: Account[] = [
  { id: 'ars', name: 'Cuenta de prueba', currency: 'ARS', openingMinor: 0, createdAt: at },
  { id: 'usd', name: 'Dólares de prueba', currency: 'USD', openingMinor: 0, createdAt: at },
  { id: 'eur', name: 'Euros cerrada', currency: 'EUR', openingMinor: 0, createdAt: at, deletedAt: '2026-09-10T12:00:00Z' },
];
const portrait = { top: 59, bottom: 34, left: 0, right: 0 };

type Route = { method: string; to: unknown };
function harness({ session = createConversationSession(), currency = 'ARS', insets = portrait, ledgerAccounts = accounts }:
  { session?: ConversationSession; currency?: string; insets?: typeof portrait; ledgerAccounts?: Account[] | null } = {}) {
  const source = readFileSync(new URL('../src/ui/capture-hub.tsx', import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const jsx = (type: any, props: any) => ({ type, props });
  // Hooks persist by call order across renders, like React's.
  const state: unknown[] = [];
  let cursor = 0;
  const routes: Route[] = [];
  const haptics: string[] = [];
  const held: string[][] = [];
  const subscribed: unknown[] = [];
  // Every property the module reads from the ledger: only the snapshot may be read; a write would show here.
  const ledgerReads: string[] = [];
  const ledger = new Proxy({ snapshot: ledgerAccounts ? { accounts: ledgerAccounts } : null } as Record<string, unknown>, {
    get: (target, key) => { ledgerReads.push(String(key)); return target[key as string]; },
  });
  const modules: Record<string, any> = {
    react: {
      useState: (initial: unknown) => { const index = cursor++; if (!(index in state)) state[index] = initial; return [state[index], (value: unknown) => { state[index] = value; }]; },
      useRef: (initial: unknown) => { const index = cursor++; if (!(index in state)) state[index] = { current: initial }; return state[index]; },
      useSyncExternalStore: (subscribe: unknown, getSnapshot: () => unknown) => { subscribed.push(subscribe); return getSnapshot(); },
    },
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'react-native': { StyleSheet: { create: (styles: unknown) => styles, hairlineWidth: 0.5 }, View: 'View' },
    'expo-router': { router: { push: (to: unknown) => routes.push({ method: 'push', to }), navigate: (to: unknown) => routes.push({ method: 'navigate', to }) } },
    '@expo/vector-icons/Ionicons': 'Ionicons',
    'react-native-safe-area-context': { useSafeAreaInsets: () => insets },
    '../assistant/session': { conversationSession: () => session, lastUserWords },
    '../storage/LedgerProvider': { useLedger: () => ledger },
    './components': { AppText: 'AppText', PressFeedback: 'PressFeedback', useStacked: () => false },
    './display-currency-provider': { useDisplayCurrency: (currencies: string[]) => { held.push([...currencies]); return { currency }; } },
    './dock-geometry': dockGeometry,
    './form-controls': { BottomSheet: 'BottomSheet' },
    './motion': { impactHaptic: () => { haptics.push('light'); } },
    './presentation': presentation,
    './theme': { space: { xs: 4, s: 8, m: 12, l: 16, xl: 20 }, usePalette: () => palette },
    '../i18n/provider': i18nProvider,
  };
  const module = { exports: {} as Record<string, any> };
  runInNewContext(code, { module, exports: module.exports, require: (name: string) => {
    if (!Object.hasOwn(modules, name)) throw new Error('Unexpected capture-hub dependency: ' + name);
    return modules[name];
  } });
  const render = () => {
    cursor = 0;
    const fragment = module.exports.CaptureAction();
    const [plus, sheet] = fragment.props.children;
    const [tileElement, rowsView] = sheet.props.children;
    const tile = tileElement.type(tileElement.props);
    const rows = rowsView.props.children.map((row: any) => ({ element: row, rendered: row.type(row.props) }));
    return { fragment, plus, sheet, tile, rowsView, rows, accessory: sheet.props.accessory };
  };
  return { render, routes, haptics, held, subscribed, ledgerReads, exports: module.exports, session };
}
const flatten = (value: any): any[] => !value || typeof value !== 'object' ? [] : Array.isArray(value) ? value.flatMap(flatten)
  : value.props ? [value, ...flatten(value.props.children)] : [];
const text = (node: any): string => [node.props.children].flat().join('');
const texts = (tree: any) => flatten(tree).filter(node => node.type === 'AppText').map(text);
const json = (value: unknown) => JSON.stringify(value);

test('24UX6A: the dock\'s «+» is a 60 pt sage-mint circle named «Registrar», an action, never a tab', () => {
  const { render, haptics } = harness();
  const { fragment, plus, sheet } = render();
  assert.equal(fragment.type, 'Fragment', 'the «+» and its hub, nothing else');
  assert.equal(plus.type, 'PressFeedback');
  assert.equal(plus.props.accessibilityRole, 'button', 'an action beside the tabs, not a tab');
  assert.equal(plus.props.accessibilityLabel, 'Registrar');
  assert.equal(plus.props.accessibilityHint, 'Abre las opciones para registrar');
  assert.equal(plus.props.accessibilityState, undefined, 'no selected state: it never reads as the current tab');
  assert.equal(plus.props.onLongPress, undefined, 'tap only: no long-press shortcut in v1');
  const [shape, material] = plus.props.style;
  assert.deepEqual([shape.width, shape.height, shape.borderRadius], [dockGeometry.DOCK.plus, dockGeometry.DOCK.plus, dockGeometry.DOCK.plus / 2]);
  assert.equal(dockGeometry.DOCK.plus, 60, 'a 60 pt circle, the dock\'s own height');
  assert.ok(shape.minHeight >= 44, 'a full target');
  assert.equal(material.backgroundColor, palette.accent, 'the accent fill');
  assert.equal(material.borderWidth, 0.5, 'a hairline edge on the pale canvas');
  assert.ok(material.shadowOpacity > 0, 'a soft lift in light mode');
  const glyph = plus.props.children;
  assert.deepEqual([glyph.type, glyph.props.name, glyph.props.color, glyph.props.accessible], ['Ionicons', 'add', palette.onAccent, false]);
  assert.equal(sheet.type, 'BottomSheet');
  assert.equal(sheet.props.visible, false, 'the hub waits for a tap');
  assert.equal(haptics.length, 0);
  const dark = harness().exports.plusMaterial({ ...palette, isDark: true });
  assert.equal(dark.shadowOpacity, undefined, 'no shadow on the OLED ground');
});

test('24UX6A: tapping «+» opens the hub floating above the dock, with a light haptic and a «Cerrar» where the «+» sits', () => {
  for (const insets of [portrait, { top: 0, bottom: 21, left: 59, right: 59 }, { top: 20, bottom: 0, left: 0, right: 0 }]) {
    const { render, haptics, routes } = harness({ insets });
    render().plus.props.onPress();
    assert.equal(json(haptics), json(['light']), 'one light impact');
    const { sheet, accessory } = render();
    assert.equal(sheet.props.visible, true);
    assert.equal(sheet.props.title, 'Registrar', 'the hub\'s small caps title');
    assert.equal(json(sheet.props.floating), json(dockGeometry.hubInset(insets)), 'the card floats above the dock');
    assert.equal(sheet.props.floating.bottom, dockGeometry.tabBarBottomGap(insets.bottom) + dockGeometry.DOCK.height + 12, '12 pt over the dock');
    assert.equal(sheet.props.onDone, undefined, 'a hub of actions: no Listo');
    assert.equal(accessory.type, 'PressFeedback');
    assert.equal(accessory.props.accessibilityRole, 'button');
    assert.equal(accessory.props.accessibilityLabel, 'Cerrar');
    const frame = dockGeometry.plusFrame(insets);
    assert.equal(json(accessory.props.containerStyle), json({ position: 'absolute', right: frame.right, bottom: frame.bottom }), 'exactly over the «+»');
    assert.equal(accessory.props.style[0].width, frame.size);
    assert.equal(accessory.props.style[1].backgroundColor, palette.accent, 'the same circle, its glyph turned');
    assert.deepEqual([accessory.props.children.props.name, accessory.props.children.props.color, accessory.props.children.props.accessible], ['close', palette.onAccent, false]);
    accessory.props.onPress();
    const closed = render().sheet;
    assert.equal(closed.props.visible, false, '«Cerrar» cancels');
    closed.props.onDismissed();
    assert.equal(routes.length, 0, 'a cancel opens nothing');
  }
});

test('24UX6A: the Assistant first and largest on the brand field, then Gasto, Ingreso and Transferencia with what each covers', () => {
  const { render, exports } = harness();
  assert.equal(exports.CAPTURE_CHOICES.join(','), 'assistant,expense,income,transfer');
  render().plus.props.onPress();
  const { sheet, tile, rowsView, rows } = render();
  assert.equal(sheet.props.children[0].type.name, 'AssistantTile', 'the Assistant comes first');
  assert.equal(tile.type, 'PressFeedback');
  assert.equal(tile.props.accessibilityRole, 'button');
  assert.equal(tile.props.accessibilityLabel, 'Asistente, Decilo con tus palabras o preguntá lo que quieras');
  assert.equal(tile.props.accessibilityHint, undefined);
  assert.equal(tile.props.style[1].backgroundColor, palette.hero, 'visually primary: the hero\'s field');
  assert.equal(texts(tile).join(' | '), 'Asistente | Decilo con tus palabras o preguntá lo que quieras');
  // 25VIS1: the field is lime, so the circle is the field's ink thumb with a lime glyph; an accent circle would vanish on it.
  const spark = flatten(tile).find(node => node.type === 'View' && node.props.style?.[1]?.backgroundColor === palette.heroThumb);
  assert.ok(spark, 'an ink circle on the field');
  assert.deepEqual([spark.props.children.props.name, spark.props.children.props.color], ['sparkles', palette.heroThumbInk]);
  assert.ok(flatten(tile).filter(node => node.type === 'AppText' || node.type === 'Ionicons').every(node => node.props.accessible === false), 'the tile speaks once');
  assert.equal(rowsView.props.style[1].backgroundColor, palette.surface);
  assert.equal(rows.length, 3, 'three movement rows');
  assert.equal(rows.map((row: any) => row.rendered.props.accessibilityLabel).join(' | '),
    'Gasto, Una compra o un pago | Ingreso, Sueldo, cobro u otro ingreso | Transferencia, Entre cuentas o pago de tarjeta');
  assert.equal(rows.map((row: any) => texts(row.rendered).join(' / ')).join(' | '),
    'Gasto / Una compra o un pago | Ingreso / Sueldo, cobro u otro ingreso | Transferencia / Entre cuentas o pago de tarjeta');
  const looks = rows.map((row: any) => { const tileView = flatten(row.rendered).find(node => node.type === 'View' && node.props.style?.[1]?.backgroundColor);
    const glyph = tileView.props.children; return [glyph.props.name, glyph.props.color, tileView.props.style[1].backgroundColor]; });
  // 24UX6C: a restrained hint of each kind's tone on its tile (the light palette's real tokens, src/ui/palette.ts): an expense
  // ink on the inset (never alarm red), an income its soft green, a transfer its soft blue-teal. The word still names the choice.
  assert.equal(json(looks), json([['arrow-up', palette.text, palette.inset], ['arrow-down', palette.income, palette.incomeSoft],
    ['swap-horizontal', palette.transfer, palette.transferSoft]]), 'tinted but calm tiles, one per kind');
  assert.equal(looks.some((look: string[]) => look.includes(palette.expense)), false, 'an expense is not painted red in the hub');
  assert.equal(new Set(looks.map((look: string[]) => look[2])).size, 3, 'the three tiles are told apart');
  for (const [index, { rendered }] of rows.entries()) {
    assert.equal(rendered.type, 'PressFeedback');
    assert.equal(rendered.props.accessibilityRole, 'button');
    assert.ok(rendered.props.style[0].minHeight >= 44, 'a full target');
    assert.equal(rendered.props.style[1].borderBottomWidth, index === 2 ? 0 : 0.5, 'hairlines between rows, none under the last');
    assert.ok(flatten(rendered).filter(node => node.type === 'AppText' || node.type === 'Ionicons').every(node => node.props.accessible === false), 'each row speaks once');
  }
  assert.equal(flatten(sheet.props.children).some(node => node.type === 'Ionicons' && /mic/.test(node.props.name)), false, 'no microphone: dictation is later Assistant work');
});

test('24UX6A: «Continuar» shows the person\'s real last words, only after an actual exchange; never empty, never after New chat', () => {
  const session = createConversationSession();
  const { render, subscribed } = harness({ session });
  render().plus.props.onPress();
  const chip = (tile: any) => flatten(tile).find(node => node.type === 'View' && node.props.style?.[1]?.backgroundColor === palette.heroControl);
  assert.equal(chip(render().tile), undefined, 'an empty conversation offers nothing to continue');
  assert.equal(subscribed.at(-1), session.subscribe, 'the tile follows the shared session');
  session.dispatch({ type: 'compose', text: 'Un borrador sin enviar' });
  assert.equal(chip(render().tile), undefined, 'words still in the composer were never said');
  session.dispatch({ type: 'send', text: 'Cuánto gasté en comida este mes' });
  session.dispatch({ type: 'answer', text: 'Respuesta sintética', content: null });
  const { tile } = render();
  const resume = chip(tile);
  assert.ok(resume, 'after a real exchange');
  assert.equal(texts(resume).join(''), 'Continuar: «Cuánto gasté en comida este mes»', 'exactly what the person wrote');
  // The resume line is part of the name (hints are optional in VoiceOver), in place of the detail the tile no longer shows.
  assert.equal(tile.props.accessibilityLabel, 'Asistente, Continuar: «Cuánto gasté en comida este mes»');
  assert.equal(tile.props.accessibilityHint, undefined, 'no hint: the words are in the label');
  assert.ok(flatten(resume).every(node => node.type === 'View' ? node.props.accessible === false || node === resume : node.props.accessible === false));
  session.dispatch({ type: 'send', text: 'Y en transporte' });
  assert.equal(texts(chip(render().tile)).join(''), 'Continuar: «Y en transporte»', 'the latest words, even while the answer is on its way');
  session.reset();
  assert.equal(chip(render().tile), undefined, 'New chat clears it');
  assert.equal(render().tile.props.accessibilityLabel, 'Asistente, Decilo con tus palabras o preguntá lo que quieras');
  assert.equal(render().tile.props.accessibilityHint, undefined);
  // Words that never left the device go back to the composer: there is no exchange to continue.
  session.dispatch({ type: 'send', text: 'Gasté 1500 en el super' });
  session.dispatch({ type: 'fail', reason: 'unavailable', text: 'assistant.reason.unavailable', sent: 'Gasté 1500 en el super' });
  assert.equal(chip(render().tile), undefined, 'a request that never left adds no «Continuar»');
  // A fresh process: a new session starts empty.
  assert.equal(chip(harness().render().tile), undefined, 'closing the app clears it');
});

test('24UX6A: a row opens its screen only once the hub has left; the Assistant is pushed as a stack screen; a cancel opens nothing', () => {
  const cases: [string, number | 'tile', { method: string; to: unknown }][] = [
    ['USD', 0, { method: 'push', to: { pathname: '/new-entry', params: { kind: 'expense', currency: 'USD' } } }],
    ['ARS', 1, { method: 'push', to: { pathname: '/new-entry', params: { kind: 'income', currency: 'ARS' } } }],
    ['ARS', 2, { method: 'push', to: { pathname: '/new-transfer', params: {} } }],
    ['USD', 'tile', { method: 'push', to: { pathname: '/assistant', params: { currency: 'USD' } } }],
    // EUR is only held by a deleted account: a movement cannot preselect it; the Assistant still gets the shown currency.
    ['EUR', 0, { method: 'push', to: { pathname: '/new-entry', params: { kind: 'expense' } } }],
    ['EUR', 1, { method: 'push', to: { pathname: '/new-entry', params: { kind: 'income' } } }],
    ['EUR', 'tile', { method: 'push', to: { pathname: '/assistant', params: { currency: 'EUR' } } }],
    ['BRL', 0, { method: 'push', to: { pathname: '/new-entry', params: { kind: 'expense' } } }],
  ];
  for (const [currency, choice, expected] of cases) {
    const { render, routes } = harness({ currency });
    render().plus.props.onPress();
    const view = render();
    if (choice === 'tile') view.tile.props.onPress(); else view.rows[choice].rendered.props.onPress();
    const { sheet } = render();
    assert.equal(sheet.props.visible, false, 'the hub leaves first');
    assert.equal(routes.length, 0, 'nothing is presented while the hub is still on screen');
    sheet.props.onDismissed();
    assert.equal(json(routes), json([expected]), currency + ' ' + choice);
    sheet.props.onDismissed();
    assert.equal(routes.length, 1, 'one screen per choice');
  }
  for (const close of ['scrim', 'accessory'] as const) {
    const { render, routes } = harness();
    render().plus.props.onPress();
    const view = render();
    if (close === 'scrim') view.sheet.props.onClose(); else view.accessory.props.onPress();
    const { sheet } = render();
    assert.equal(sheet.props.visible, false);
    sheet.props.onDismissed();
    assert.equal(routes.length, 0, 'the scrim, the back gesture, VoiceOver escape or «Cerrar» open nothing (' + close + ')');
  }
  const source = readFileSync(new URL('../src/ui/capture-hub.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /router\.navigate|router\.replace/, 'every choice is pushed over the tabs; the Assistant is no tab to switch to');
});

test('24UX6A: the first choice holds while the hub leaves: a second row, the tile, the scrim, «Cerrar» or «+» change nothing', () => {
  const { render, routes, haptics } = harness({ currency: 'USD' });
  render().plus.props.onPress();
  render().rows[0].rendered.props.onPress();
  const leaving = render();
  assert.equal(leaving.sheet.props.visible, false);
  leaving.rows[2].rendered.props.onPress();
  leaving.tile.props.onPress();
  render().sheet.props.onClose();
  render().accessory.props.onPress();
  render().plus.props.onPress();
  assert.equal(render().sheet.props.visible, false, 'a tap on «+» during the exit waits for the first choice');
  assert.equal(haptics.length, 1, 'and plays nothing');
  assert.equal(routes.length, 0);
  render().sheet.props.onDismissed();
  assert.equal(json(routes), json([{ method: 'push', to: { pathname: '/new-entry', params: { kind: 'expense', currency: 'USD' } } }]),
    'the first choice, exactly once');
  render().sheet.props.onDismissed();
  assert.equal(routes.length, 1);
  render().plus.props.onPress();
  assert.equal(render().sheet.props.visible, true, 'afterwards it opens as usual');
  assert.equal(haptics.length, 2);
});

test('24UX6A: captureDestination is the one table of where each choice goes', () => {
  const { exports } = harness();
  assert.equal(json(exports.captureDestination('expense', 'ARS', 'USD')), json({ pathname: '/new-entry', params: { kind: 'expense', currency: 'ARS' } }));
  assert.equal(json(exports.captureDestination('income')), json({ pathname: '/new-entry', params: { kind: 'income' } }), 'no live account holds it: the form picks');
  assert.equal(json(exports.captureDestination('transfer', 'USD', 'USD')), json({ pathname: '/new-transfer', params: {} }), 'a transfer chooses its accounts in its form');
  assert.equal(json(exports.captureDestination('assistant', 'ARS', 'USD')), json({ pathname: '/assistant', params: { currency: 'USD' } }), 'the currency Inicio shows');
  assert.equal(json(exports.captureDestination('assistant')), json({ pathname: '/assistant', params: {} }));
});

test('24UX6A: the hub reads the shown currency over the ledger\'s whole history and never writes', () => {
  const { render, held, ledgerReads, session } = harness({ currency: 'USD' });
  render().plus.props.onPress();
  render();
  assert.equal(json(held.at(-1)), json(presentation.historyCurrencies(accounts)), 'the display scope is every currency ever held, deleted accounts included');
  assert.equal(json([...new Set(ledgerReads)]), json(['snapshot']), 'only the snapshot is read from the ledger: no write is reachable');
  const empty = harness({ ledgerAccounts: null });
  empty.render().plus.props.onPress();
  const { routes } = empty;
  empty.render().rows[0].rendered.props.onPress();
  empty.render().sheet.props.onDismissed();
  assert.equal(json(routes), json([{ method: 'push', to: { pathname: '/new-entry', params: { kind: 'expense' } } }]), 'before the ledger opens, no currency is preselected');
  assert.equal(session.getState().conversation.messages.length, 0, 'opening the hub says nothing to the Assistant');
  // The code only (comments say «Nothing here writes», which is the point, not a call).
  const code = ts.transpileModule(readFileSync(new URL('../src/ui/capture-hub.tsx', import.meta.url), 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.Preserve, removeComments: true } }).outputText;
  assert.doesNotMatch(code, /assistant-engine|integrations|\.dispatch\(|\.reset\(|setWriting|\.writes\b|request\.current/,
    'a shortcut to the forms and the Assistant: nothing here records or speaks for the person');
  assert.doesNotMatch(code, /\b(add|save|update|delete|remove|record|undo|restore)[A-Z]\w*\(/,
    'no ledger write is called from the hub');
});

test('24UX6A: the «+», the hub and «Continuar» follow the interface language', () => {
  const session = createConversationSession();
  session.dispatch({ type: 'send', text: 'How much did I spend on food' });
  locale = 'en-US';
  try {
    const { render } = harness({ session });
    const { plus } = render();
    assert.equal(plus.props.accessibilityLabel, 'Record');
    assert.equal(plus.props.accessibilityHint, 'Shows the ways to record');
    plus.props.onPress();
    const { sheet, tile, rows, accessory } = render();
    assert.equal(sheet.props.title, 'Record');
    assert.equal(accessory.props.accessibilityLabel, 'Close');
    assert.equal(tile.props.accessibilityLabel, 'Assistant, Continue: “How much did I spend on food”', 'the words stay as the person wrote them');
    assert.equal(tile.props.accessibilityHint, undefined);
    assert.equal(rows.map((row: any) => row.rendered.props.accessibilityLabel).join(' | '),
      'Expense, A purchase or a payment | Income, Salary, a payment received or other income | Transfer, Between accounts or a card payment');
    // Without a conversation the tile says what it does.
    const quiet = harness();
    quiet.render().plus.props.onPress();
    const fresh = quiet.render().tile;
    assert.equal(fresh.props.accessibilityLabel, 'Assistant, Say it in your own words or ask anything');
    assert.equal(fresh.props.accessibilityHint, undefined);
  } finally { locale = 'es-AR'; }
});
