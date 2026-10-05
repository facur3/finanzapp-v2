import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as merchantMark from '../src/ui/merchant-mark.ts';
import * as currencies from '../src/ui/currencies.ts';
import { CURRENCIES, currencyOption, currencyOptions, searchCurrencies } from '../src/ui/currencies.ts';
import { bindLocale } from '../src/i18n/bind.ts';
import * as geometry from '../src/ui/geometry.ts';
import { formatMinorUnits } from '@finanzapp/domain';
import * as i18nFormat from '../src/i18n/format.ts';
import * as i18nLocale from '../src/i18n/locale.ts';
import * as moneyInput from '../src/ui/money-input.ts';
import type { AppLocale } from '../src/i18n/locale.ts';
import * as movementAmount from '../src/ui/movement-amount.ts';
import * as presentation from '../src/ui/presentation.ts';
import { darkPalette, lightPalette } from '../src/ui/palette.ts';

// Producto 22.1: the row and field components at source level (React Native
// replaced by descriptors). Structure, hierarchy and labels are checked here;
// wrapping at Dynamic Type sizes and narrow widths needs the iPhone.
type Node = { type: any; props: Record<string, any> };
function load(file: string, extra: Record<string, unknown> = {}, fontScale = 1, width = 390, palette?: Record<string, unknown>) {
  const source = readFileSync(new URL('../src/ui/' + file, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const jsx = (type: any, props: any) => ({ type, props });
  const state: unknown[] = [];
  const alerts: { title: string; message: string; buttons?: { text: string }[] }[] = [];
  const haptics: string[] = [];
  let cursor = 0;
  const p = palette ?? { isDark: false, surface: '#FFFFFF', inset: '#EEEEF3', text: '#0A0A0C', secondary: '#6E7078', tertiary: '#8E9098', line: '#E6E6EC', primary: '#2557D6', primaryFill: '#2557D6', onPrimary: '#FFF', primarySoft: '#E5ECFB', background: '#F2F2F6',
    income: '#1F7A4D', expense: '#C0392B', warning: '#B26A00', transfer: '#2D6476', transferSoft: '#E2EDF1', incomeSoft: '#E3F1E8' };
  const modules: Record<string, unknown> = {
    react: { useState: (initial: unknown) => { const index = cursor++; if (!(index in state)) state[index] = initial; return [state[index], (value: unknown) => { state[index] = typeof value === 'function' ? (value as (c: unknown) => unknown)(state[index]) : value; }]; },
      useEffect: () => {}, useId: () => 'id', useRef: (initial: unknown) => ({ current: initial }), useMemo: (fn: () => unknown) => fn(),
      Children: { map: (children: unknown, fn: (child: unknown) => unknown) => (Array.isArray(children) ? children : [children]).map(fn) } },
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'react-native': { View: 'View', Text: 'Text', TextInput: 'TextInput', ScrollView: 'ScrollView', Pressable: 'Pressable', ActivityIndicator: 'ActivityIndicator', InputAccessoryView: 'InputAccessoryView',
      FlatList: 'FlatList', Modal: 'Modal', Platform: { OS: 'ios' }, Keyboard: { dismiss() {} }, StyleSheet: { hairlineWidth: 0.5, create: (styles: unknown) => styles, flatten: (style: any) => Object.assign({}, ...(Array.isArray(style) ? style.flat(Infinity).filter(Boolean) : [style])), absoluteFill: {} },
      useWindowDimensions: () => ({ fontScale, width, height: 844 }), Alert: { alert: (title: string, message: string, buttons?: { text: string }[]) => alerts.push({ title, message, buttons }) } },
    'react-native-reanimated': { __esModule: true, default: { View: 'Animated.View', Text: 'Animated.Text' }, useSharedValue: (value: number) => ({ value }), withTiming: (value: number) => value, useAnimatedStyle: (fn: () => unknown) => fn() },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
    '@react-native-community/datetimepicker': 'DateTimePicker',
    '@expo/vector-icons/Ionicons': 'Ionicons',
    'expo-router': { router: { push: () => {} } },
    '@finanzapp/domain': { accountBalanceMinor: () => 0, formatMinorUnits, labelFromISO: (d: string) => d, categoryKey: (s: string) => s.toLowerCase(), todayKey: (d: Date) => d.toISOString().slice(0, 10) },
    '../i18n/provider': { useI18n: () => bindLocale('es-AR') }, '../i18n/format': i18nFormat, '../i18n/locale': i18nLocale,
    './theme': { radius: { chip: 14, tile: 12, group: 16, card: 20, sheet: 24, creditCard: 18, button: 14 }, space: { xs: 4, s: 8, m: 12, l: 16, xl: 20, xxl: 24, xxxl: 32 },
      type: { body: { fontSize: 17 }, subhead: { fontSize: 15 }, footnote: { fontSize: 13 }, caption: { fontSize: 12 }, title2: { fontSize: 22 }, title3: { fontSize: 20 }, headline: { fontSize: 17 }, eyebrow: {} },
      usePalette: () => p, useReduceMotion: () => true, useCurrentDay: () => '2026-09-22' },
    './categories': {}, './dock-clearance': { useDockInset: () => ({ extraPadding: 0, indicator: undefined }) }, './category-color': { tintOf: () => '#EEE' }, './category-hues': { useAccountLook: () => ({ glyph: 'wallet-outline', hex: '#2557D6' }), useCategoryLook: () => ({ glyph: 'pricetag-outline', hex: '#3E6FB0', label: 'x' }), useAccountNameOf: () => (account: any) => account.name, useAccountLookOf: () => () => ({ glyph: 'wallet-outline', hex: '#2557D6' }), useCategoriesInUse: () => [], useCategoryDefinitions: () => [] },
    './geometry': geometry, './merchant-mark': merchantMark, './movement-amount': movementAmount,
    './motion': { duration: { press: 100, release: 160 }, easeOut: 'ease', selectionHaptic: () => haptics.push('selection'), timing: () => ({}) },
    './money-input': moneyInput,
    './presentation': {}, './currencies': currencies,
    './components': { ...Object.fromEntries(['AccountBadge', 'AppText', 'CategoryBadge', 'DetailRow', 'SelectionRow', 'Field', 'GlyphTile', 'PressFeedback', 'Surface'].map(name => [name, name])), surfaceShadow: () => ({}) },
    ...extra,
  };
  const module = { exports: {} as Record<string, (props: any) => Node> };
  runInNewContext(code, { module, exports: module.exports, require: (name: string) => {
    if (!Object.hasOwn(modules, name)) throw new Error('Unexpected ' + file + ' dependency: ' + name);
    return modules[name];
  } });
  return { exports: module.exports, render: (component: string, props: any) => { cursor = 0; return module.exports[component](props); }, alerts, haptics };
}
function nodes(value: any): Node[] {
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!value.props) return [];
  const own = typeof value.type === 'function' ? nodes(value.type(value.props)) : [];
  return [value, ...own, ...nodes(value.props.children), ...nodes(value.props.ListFooterComponent)];
}
const flat = (style: any) => Object.assign({}, ...(Array.isArray(style) ? style.flat(Infinity).filter(Boolean) : [style]));
// Inside components.tsx the building blocks are the real functions, so match them by name as well as by descriptor.
const is = (node: Node, name: string) => node.type === name || node.type?.name === name;
// A real PressFeedback re-emits its children inside the Pressable, so the same node can be met twice: count each once.
const texts = (root: Node) => [...new Set(nodes(root).filter(node => is(node, 'AppText')))];

test('NavigationRow stacks the title over the subtitle with the tile and a chevron, and names both for VoiceOver', () => {
  const ui = load('components.tsx');
  let pressed = 0;
  const row = ui.render('NavigationRow', { title: 'Deudas y cobros', subtitle: 'Debo · me deben', leading: { type: 'GlyphTile', props: {} }, onPress: () => { pressed += 1; } });
  const press = nodes(row).find(node => is(node, 'PressFeedback'))!;
  assert.equal(press.props.accessibilityRole, 'button');
  assert.equal(press.props.accessibilityLabel, 'Deudas y cobros, Debo · me deben');
  assert.equal(press.props.feedback, 'highlight', 'a full-width row highlights, it does not shrink');
  const [title, subtitle] = texts(row);
  assert.equal(title.props.children, 'Deudas y cobros');
  assert.equal(flat(title.props.style).fontWeight, '600', 'the title carries the hierarchy');
  assert.equal(title.props.numberOfLines, 2);
  assert.equal(subtitle.props.children, 'Debo · me deben');
  assert.equal(subtitle.props.secondary, true);
  assert.equal(subtitle.props.variant, 'footnote');
  const column = nodes(row).find(node => is(node, 'View') && node.props.style?.flex === 1)!;
  assert.equal(column.props.style.minWidth, 0, 'the text column may shrink and wrap instead of pushing the chevron out');
  assert.ok(nodes(row).some(node => is(node, 'Ionicons') && node.props.name === 'chevron-forward'));
  assert.ok(nodes(row).some(node => is(node, 'GlyphTile')), 'the leading tile is rendered');
  assert.equal(flat(press.props.style).minHeight, 60, 'two lines fit in a comfortable 60 pt target');
  press.props.onPress();
  assert.equal(pressed, 1);
  // Without a tile: a neutral glyph in a fixed 30 pt column so titles align across rows; without a subtitle: one line, one label.
  const plain = ui.render('NavigationRow', { title: 'Copia de seguridad', icon: 'save-outline', onPress: () => {}, last: true });
  assert.ok(nodes(plain).some(node => is(node, 'Ionicons') && node.props.name === 'save-outline' && node.props.color === '#6E7078'));
  assert.equal(nodes(plain).find(node => is(node, 'PressFeedback'))!.props.accessibilityLabel, 'Copia de seguridad');
  assert.equal(flat(nodes(plain).find(node => is(node, 'PressFeedback'))!.props.style).borderBottomWidth, 0);
  assert.equal(texts(plain).length, 1);
  const disabled = ui.render('NavigationRow', { title: 'Importar copia', subtitle: 'x', onPress: () => {}, disabled: true });
  assert.equal(nodes(disabled).find(node => is(node, 'PressFeedback'))!.props.accessibilityState.disabled, true);
});

test('FieldNote keeps one short line under a field and opens the full explanation from its information glyph', () => {
  const ui = load('components.tsx');
  const note = ui.render('FieldNote', { children: 'Opcional. No cuenta como ingreso.', help: { title: 'Saldo inicial', detail: 'La explicación completa.' } });
  assert.equal(texts(note)[0].props.children, 'Opcional. No cuenta como ingreso.');
  assert.equal(texts(note)[0].props.variant, 'footnote');
  const info = nodes(note).find(node => is(node, 'PressFeedback'))!;
  assert.equal(info.props.accessibilityRole, 'button');
  assert.equal(info.props.accessibilityLabel, 'Más información sobre saldo inicial');
  assert.equal(info.props.hitSlop, 8, 'a small glyph with a comfortable target');
  info.props.onPress();
  // The button is named from the catalogue: left to iOS it would read "OK" in the bundle's language, whatever Más says.
  assert.equal(JSON.stringify(ui.alerts), JSON.stringify([{ title: 'Saldo inicial', message: 'La explicación completa.', buttons: [{ text: 'OK', style: 'cancel' }] }]), 'the catalogue\'s OK, still the cancel action');
  const bare = ui.render('FieldNote', { children: 'Solo texto.' });
  assert.equal(nodes(bare).some(node => is(node, 'PressFeedback')), false);
});

test('EmptyState is one calm card: a 44 pt glyph on the brand tint, a title3 headline and one line, never a full-screen illustration', () => {
  const ui = load('components.tsx');
  const empty = ui.render('EmptyState', { title: 'Nada recurrente todavía', detail: 'Programá un pago.', icon: 'repeat-outline', action: { type: 'ActionButton', props: {} } });
  const glyph = nodes(empty).find(node => is(node, 'GlyphTile'))!;
  assert.equal(glyph.props.size, 44);
  assert.equal(glyph.props.large, undefined);
  // 24UX6C: the glyph tile takes the pine brand tint (the neutral inset tile nearly vanished on the surface).
  assert.equal(glyph.props.color, '#2557D6', 'the tile is tinted with palette.primary');
  assert.equal(glyph.props.icon, 'repeat-outline');
  const [title, detail] = texts(empty);
  assert.equal(title.props.variant, 'title3');
  assert.equal(title.props.accessibilityRole, 'header');
  assert.equal(detail.props.variant, 'subhead');
  assert.equal(flat(empty.props.style).paddingVertical, 22);
  assert.ok(nodes(empty).some(node => is(node, 'ActionButton')));
});

test('the currency row stacks label, full name and code so "Dólares estadounidenses · USD" never breaks across lines; the sheet lists the ledger currencies', () => {
  const ui = load('form-controls.tsx');
  const chosen: string[] = [];
  let field = ui.render('CurrencyField', { value: 'USD', onChange: (code: string) => chosen.push(code) });
  const row = nodes(field).find(node => node.type === 'SelectionRow')!;
  assert.equal(row.props.label, 'Moneda');
  assert.equal(row.props.value, 'Dólares estadounidenses', 'the full name is the primary line, on its own');
  assert.equal(row.props.detail, 'USD · US$', 'the code and symbol are the detail line, never appended to the name');
  assert.equal(row.props.icon, 'cash-outline');
  assert.equal(row.props.last, true);
  assert.equal(typeof row.props.onPress, 'function');
  assert.equal(nodes(field).some(node => node.type === 'DetailRow'), false, 'no label/value pair that could wrap the code alone');
  const sheet = nodes(field).find(node => node.type === 'Modal')!;
  assert.equal(sheet.props.visible, false);
  row.props.onPress();
  field = ui.render('CurrencyField', { value: 'USD', onChange: (code: string) => chosen.push(code) });
  assert.equal(nodes(field).find(node => node.type === 'Modal')!.props.visible, true);
  assert.equal(nodes(field).find(node => node.type === 'Modal')!.props.presentationStyle, 'pageSheet');
  const list = nodes(field).find(node => node.type === 'FlatList')!;
  // 24M: the 146 currencies the ledger can create, ARS and USD first, then by name; a window of rows, the keyboard insetting the list.
  assert.equal(list.props.data.length, 146, 'only the currencies the ledger can hold');
  assert.deepEqual(list.props.data.slice(0, 4).map((item: any) => item.code), ['ARS', 'USD', 'AFN', 'MGA']);
  assert.deepEqual([list.props.initialNumToRender, list.props.windowSize, list.props.automaticallyAdjustKeyboardInsets, list.props.keyboardDismissMode], [14, 7, true, 'interactive']);
  const items = list.props.data.slice(0, 2).map((item: unknown) => list.props.renderItem({ item }));
  assert.deepEqual(items.map((item: Node) => item.props.accessibilityLabel), ['Pesos argentinos, ARS', 'Dólares estadounidenses, USD']);
  assert.deepEqual(items.map((item: Node) => item.props.accessibilityState.selected), [false, true]);
  assert.ok(nodes(items[1]).some(node => is(node, 'Ionicons') && node.props.name === 'checkmark-circle'), 'the current currency carries the checkmark');
  items[0].props.onPress();
  assert.deepEqual(chosen, ['ARS']);
  assert.deepEqual(ui.haptics, ['selection']);
  items[1].props.onPress();
  assert.deepEqual(ui.haptics, ['selection'], 'choosing the current currency again does not tick');
  assert.ok(nodes(list.props.ListFooterComponent).some(node => node.type === 'AppText' && /nunca se suman ni se convierten/.test(String(node.props.children))), 'the sheet says currencies are never added or converted, naming none (24M)');
  const disabled = ui.render('CurrencyField', { value: 'USD', onChange: () => {}, disabled: true });
  assert.equal(nodes(disabled).find(node => node.type === 'SelectionRow')!.props.disabled, true);
  // Read-only (an existing account): the same row shape, no chooser at all.
  const fixed = ui.render('CurrencyField', { value: 'ARS' });
  const fact = nodes(fixed).find(node => node.type === 'SelectionRow')!;
  assert.equal(fact.props.value, 'Pesos argentinos');
  assert.equal(fact.props.detail, 'ARS · $');
  assert.equal(fact.props.onPress, undefined, 'no chevron and nothing to press');
  assert.equal(nodes(fixed).some(node => node.type === 'Modal'), false);
});

test('SelectionRow stacks label, value and detail in one column with the glyph and the chevron, and reads as one VoiceOver label', () => {
  const ui = load('components.tsx');
  let pressed = 0;
  const row = ui.render('SelectionRow', { label: 'Moneda', value: 'Dólares estadounidenses', detail: 'USD · US$', icon: 'cash-outline', onPress: () => { pressed += 1; }, last: true });
  const press = nodes(row).find(node => is(node, 'PressFeedback'))!;
  assert.equal(press.props.accessibilityRole, 'button');
  assert.equal(press.props.accessibilityLabel, 'Moneda: Dólares estadounidenses, USD · US$');
  assert.equal(press.props.feedback, 'highlight');
  assert.equal(flat(press.props.style).minHeight, 64, 'three lines of text fit a comfortable target');
  const [label, value, detail] = texts(row);
  assert.equal(label.props.children, 'Moneda');
  assert.equal(label.props.variant, 'footnote');
  assert.equal(label.props.secondary, true);
  assert.equal(value.props.children, 'Dólares estadounidenses');
  assert.equal(flat(value.props.style).fontWeight, '600', 'the value is the primary line');
  assert.equal(value.props.numberOfLines, 3, 'a long name wraps rather than truncating');
  assert.equal(detail.props.children, 'USD · US$');
  assert.equal(detail.props.variant, 'footnote');
  const column = nodes(row).find(node => is(node, 'View') && node.props.style?.flex === 1)!;
  assert.equal(column.props.style.minWidth, 0, 'the column shrinks and wraps instead of pushing the chevron out');
  assert.equal(column.props.style.flexDirection, undefined, 'a column, never label and value side by side');
  assert.ok(nodes(row).some(node => is(node, 'Ionicons') && node.props.name === 'chevron-forward'));
  assert.ok(nodes(row).some(node => is(node, 'Ionicons') && node.props.name === 'cash-outline'));
  press.props.onPress();
  assert.equal(pressed, 1);
  const prompt = ui.render('SelectionRow', { label: 'Cuenta', value: 'Elegir cuenta', placeholder: true, icon: 'wallet-outline', onPress: () => {} });
  assert.equal(flat(texts(prompt)[1].props.style).color, '#2557D6', 'a prompt reads in the primary colour');
  assert.equal(texts(prompt).length, 2, 'no detail line when there is nothing to say');
  const fact = ui.render('SelectionRow', { label: 'Moneda', value: 'Pesos argentinos', detail: 'ARS · $', icon: 'cash-outline' });
  assert.equal(nodes(fact).some(node => is(node, 'PressFeedback')), false, 'a fact is not a button');
  assert.equal(fact.props.accessibilityLabel, 'Moneda: Pesos argentinos, ARS · $');
  assert.equal(nodes(fact).some(node => is(node, 'Ionicons') && node.props.name === 'chevron-forward'), false);
});

test('DetailRow keeps short pairs on one line and stacks a long pair, so a value never wraps into right-aligned fragments', () => {
  const ui = load('components.tsx');
  const column = (row: Node) => nodes(row).find(node => is(node, 'View') && node.props.style?.flex === 1)!.props.style;
  assert.equal(column(ui.render('DetailRow', { label: 'Moneda', value: 'ARS' })).flexDirection, 'row');
  assert.equal(column(ui.render('DetailRow', { label: 'Banco Galicia después', value: 'ARS 1.234.567,00' })).flexDirection, 'column', 'a long name and an amount stack');
  assert.equal(column(ui.render('DetailRow', { label: 'Moneda', value: 'Dólares estadounidenses · USD' })).flexDirection, 'column');
  assert.equal(column(ui.render('DetailRow', { label: 'Banco Galicia después', value: 'ARS 1.234.567,00', layout: 'inline' })).flexDirection, 'row', 'inline only stacks at large text');
  assert.equal(column(ui.render('DetailRow', { label: 'Moneda', value: 'ARS', layout: 'stacked' })).flexDirection, 'column');
  const stacked = ui.render('DetailRow', { label: 'Banco Galicia después', value: 'ARS 1.234.567,00' });
  assert.equal(flat(texts(stacked)[1].props.style).textAlign, 'left', 'a stacked value reads under its label');
});

test('Stat rows stack at large text and every Stat may shrink, so amounts and dates stay whole between two or three columns', () => {
  const ui = load('components.tsx');
  const stat = ui.render('Stat', { label: 'Gastado', children: 'x' });
  assert.equal(stat.props.style.flexShrink, 1);
  assert.equal(stat.props.style.minWidth, 0);
  const row = ui.render('StatRow', { children: [{ type: 'Stat', props: {} }, { type: 'Stat', props: {} }, null] });
  assert.equal(row.props.style.flexDirection, 'row', 'side by side at the default text size');
  const cells = row.props.children.filter(Boolean);
  assert.equal(cells.length, 2, 'an absent child leaves no empty column');
  assert.ok(cells.every((cell: Node) => cell.props.style.flex === 1 && cell.props.style.minWidth === 0), 'equal shares that may shrink');
  const large = load('components.tsx', {}, 1.5);
  assert.equal(large.render('StatRow', { children: [{ type: 'Stat', props: {} }, { type: 'Stat', props: {} }] }).props.style.flexDirection, 'column', 'one under the other at large text');
  const column = nodes(large.render('DetailRow', { label: 'Moneda', value: 'ARS' })).find(node => is(node, 'View') && node.props.style?.flex === 1)!;
  assert.equal(column.props.style.flexDirection, 'column', 'DetailRow stacks at large text too');
});

test('EntryRow keeps the full caption (category · account · date) in a grouped cell; VoiceOver hears the full sentence', () => {
  const ui = load('components.tsx');
  const account = { id: 'a', name: 'Banco', currency: 'ARS', openingMinor: 0, createdAt: 't' };
  const entry = { id: 'e', accountId: 'a', kind: 'expense', merchant: 'Café', category: 'Comida', amountMinor: 1200, dateISO: '2026-09-22', createdAt: 't' };
  const column = (root: Node) => nodes(root).find(node => is(node, 'View') && node.props.style?.flex === 1 && 'flexDirection' in node.props.style)!;
  const caption = (root: Node) => nodes(root).filter(node => is(node, 'AppText')).map(node => [node.props.children].flat().join(''))[1];
  const grouped = ui.render('EntryRow', { entry, account });
  assert.equal(grouped.props.feedback, 'highlight');
  assert.equal(column(grouped).props.style.borderBottomWidth, undefined, 'grouped: the separator belongs to the cell');
  const label = caption(grouped).split(' · ')[0];
  assert.equal(caption(grouped), label + ' · Banco · Hoy');
  assert.equal(caption(ui.render('EntryRow', { entry, account, showAccount: false })), label + ' · Hoy', 'inside an account, its name is not repeated');
  assert.ok(grouped.props.accessibilityLabel.startsWith('Café, ') && grouped.props.accessibilityLabel.endsWith(', ' + label + ', Banco, Hoy'));
});

test('EntryRow gives the merchant two lines beside a bounded amount column at normal sizes, and stacks the amount under the name when it would not fit', () => {
  const ui = load('components.tsx');
  const account = { id: 'a', name: 'Cuenta sueldo Banco de la Provincia de Buenos Aires', currency: 'ARS', openingMinor: 0, createdAt: 't' };
  const entry = (amountMinor: number) => ({ id: 'e', accountId: 'a', kind: 'expense', merchant: 'Supermercado Carrefour Market Palermo Hollywood', category: 'Comida', amountMinor, dateISO: '2026-09-22', createdAt: 't' });
  const rowOf = (root: Node) => nodes(root).find(node => is(node, 'View') && node.props.style?.flex === 1 && 'flexDirection' in node.props.style)!;
  const everyday = ui.render('EntryRow', { entry: entry(1250000), account });
  assert.equal(rowOf(everyday).props.style.flexDirection, 'row', 'an everyday amount sits beside the name');
  const [merchant, detail] = texts(everyday);
  assert.equal(merchant.props.numberOfLines, 2, 'a long merchant wraps to two lines instead of truncating');
  assert.equal(detail.props.numberOfLines, 2, 'so does the category · account · date line');
  const amountColumn = nodes(everyday).find(node => is(node, 'View') && node.props.style?.alignItems === 'flex-end')!;
  assert.equal(amountColumn.props.style.maxWidth, '56%', 'the amount column is bounded so the name keeps room');
  const money = nodes(everyday).find(node => is(node, 'Money') || node.type?.name === 'Money')!;
  assert.equal(money.props.currency, 'ARS');
  const huge = ui.render('EntryRow', { entry: entry(999999999999999), account });
  assert.equal(rowOf(huge).props.style.flexDirection, 'column', 'a 13-digit amount takes the whole row under the name');
  assert.equal(texts(huge)[0].props.numberOfLines, undefined, 'stacked: the name is not limited');
  assert.equal(nodes(huge).find(node => is(node, 'View') && node.props.style?.alignItems === 'flex-end')!.props.style.maxWidth, '100%');
  const large = load('components.tsx', {}, 1.5);
  assert.equal(rowOf(large.render('EntryRow', { entry: entry(1250000), account })).props.style.flexDirection, 'column', 'large text stacks every row');
  // The same rule serves accounts and transfers.
  const balance = ui.render('AccountRow', { account, entries: [], transfers: [] });
  assert.equal(texts(balance)[0].props.numberOfLines, 2);
  assert.equal(rowOf(balance).props.style.flexDirection, 'row');
  const usd = { ...account, id: 'b', name: 'Caja de ahorro en dólares', currency: 'USD' };
  const transfer = { id: 't', fromAccountId: 'a', toAccountId: 'b', amountMinor: 99999999999, dateISO: '2026-09-22', createdAt: 't', note: '' };
  // 24UX6C: a transfer is shown unsigned in every context, so a nine-digit one now fits beside the name; a ten-digit one stacks.
  assert.equal(rowOf(ui.render('TransferRow', { transfer, accounts: [account, usd], accountId: 'a' })).props.style.flexDirection, 'row', 'a nine-digit unsigned transfer fits beside the name');
  const wide = ui.render('TransferRow', { transfer: { ...transfer, amountMinor: 999999999999 }, accounts: [account, usd], accountId: 'a' });
  assert.equal(rowOf(wide).props.style.flexDirection, 'column', 'a ten-digit transfer on a 390 pt screen stacks');
  assert.equal(texts(ui.render('TransferRow', { transfer: { ...transfer, amountMinor: 150000 }, accounts: [account, usd] }))[0].props.numberOfLines, 2);
});

test('segmented labels cap their scaling and fit their segment instead of truncating', () => {
  const ui = load('components.tsx');
  const control = ui.render('Choices', { value: 'expense', onChange: () => {}, options: [{ value: 'expense', label: 'Gasto' }, { value: 'income', label: 'Ingreso' }, { value: 'transfer', label: 'Transferencia' }] });
  const labels = nodes(control).filter(node => node.type === 'Animated.Text');
  assert.equal(labels.length, 3);
  for (const label of labels) {
    assert.equal(label.props.adjustsFontSizeToFit, true);
    assert.equal(label.props.minimumFontScale, 0.8);
    assert.equal(label.props.maxFontSizeMultiplier, 1.3);
  }
});

test('24T3 carry-in: Reportes\' prominent switch reads at the subhead size, semibold/medium, never shrinks, 44 pt; the others stay as they were', () => {
  const ui = load('components.tsx');
  const options = [{ value: 'categories', label: 'Categorías' }, { value: 'days', label: 'Día a día' }];
  const control = ui.render('Choices', { prominent: true, value: 'categories', onChange: () => {}, options });
  const labels = nodes(control).filter(node => node.type === 'Animated.Text');
  assert.equal(labels.length, 2);
  for (const label of labels) {
    // No shrink-to-fit path at all: on iOS's new architecture its floor is 4 pt, the «tiny label» found on the iPhone.
    assert.notEqual(label.props.adjustsFontSizeToFit, true);
    assert.equal(label.props.minimumFontScale, undefined);
    assert.equal(label.props.maxFontSizeMultiplier, 1.3);
    assert.equal(label.props.numberOfLines, 1);
    assert.deepEqual([flat(label.props.style).fontSize, flat(label.props.style).lineHeight], [15, 20]);
  }
  assert.deepEqual(labels.map(label => flat(label.props.style).fontWeight), ['600', '500'], 'semibold chosen, medium other');
  const segments = [...new Set(nodes(control).filter(node => node.type === 'Pressable'))];
  assert.equal(segments.length, 2);
  for (const segment of segments) assert.ok(flat(segment.props.style).minHeight + 2 * geometry.SEGMENT_PADDING >= 44, 'a 44 pt track');
  // Every other caller keeps the 13 pt default with its shrink (Movimientos' four short labels need it).
  const plain = nodes(ui.render('Choices', { value: 'categories', onChange: () => {}, options })).filter(node => node.type === 'Animated.Text');
  assert.equal(flat(plain[0].props.style).fontSize, 13);
  assert.equal(plain[0].props.adjustsFontSizeToFit, true);
});

test('25VIS1 final: Inicio\'s Gastado | Disponible on the field: a white thumb with an ink label, the other label secondary; accessibilityState says which', () => {
  for (const palette of [lightPalette, darkPalette]) {
    const ui = load('components.tsx', {}, 1, 390, { ...palette, isDark: palette === darkPalette });
    const props = { onField: true, value: 'spent', onChange: () => {}, options: [{ value: 'spent', label: 'Gastado' }, { value: 'available', label: 'Disponible' }] };
    // The thumb is drawn once the track is measured.
    ui.render('Choices', props).props.onLayout({ nativeEvent: { layout: { width: 300 } } });
    const control = ui.render('Choices', props);
    assert.equal(flat(control.props.style).backgroundColor, palette.heroControl, 'the track is unchanged');
    const thumb = nodes(control).find(node => node.type === 'Animated.View')!;
    assert.equal(flat(thumb.props.style).backgroundColor, palette.heroThumb);
    assert.deepEqual([palette.heroThumb, palette.heroThumbInk], [lightPalette.surface, palette.heroInk], 'white thumb, ink label, in both themes');
    const labels = nodes(control).filter(node => node.type === 'Animated.Text');
    assert.deepEqual(labels.map(label => flat(label.props.style).color), [palette.heroThumbInk, palette.heroSecondary]);
    assert.deepEqual(labels.map(label => flat(label.props.style).fontWeight), ['600', '500'], 'weight marks the chosen one too, not colour alone');
    const segments = [...new Set(nodes(control).filter(node => node.type === 'Pressable'))];
    assert.deepEqual(segments.map(segment => segment.props.accessibilityState.selected), [true, false]);
  }
});

test('24T3 carry-in: the prominent labels fit their segment on a 375 pt screen at the 1.3× cap, in Spanish and English', () => {
  const room = geometry.segmentLayout(375 - 40, 2, 0).width - 16; // Reportes' 20 pt padding each side; 8 pt inside each segment
  for (const locale of ['es-AR', 'en-AR'] as const) {
    const t = bindLocale(locale).t;
    for (const label of [t('reports.viewCategories'), t('reports.viewDays')]) {
      // labelWidthEm already errs wide; 6 % more for the semibold weight.
      const width = geometry.labelWidthEm(label) * geometry.PROMINENT_SEGMENT.fontSize * geometry.PROMINENT_SEGMENT.maxScale * 1.06;
      assert.ok(width <= room, `${locale} «${label}» needs ${width.toFixed(1)} of ${room.toFixed(1)} pt`);
    }
  }
});

test('24T3 carry-in: only Reportes\' analysis switch is prominent', () => {
  const files = (dir: string): string[] => readdirSync(new URL(dir, import.meta.url)).flatMap(name => {
    const path = dir + name;
    if (statSync(new URL(path, import.meta.url)).isDirectory()) return files(path + '/');
    return path.endsWith('.tsx') ? [path] : [];
  });
  const users = [...files('../app/'), ...files('../src/ui/')].filter(path => /<Choices\b[^>]*\bprominent\b/.test(readFileSync(new URL(path, import.meta.url), 'utf8')));
  assert.deepEqual(users.join(','), '../app/(tabs)/reports.tsx');
});

test('the currency list is the 146 gated currencies (24M), ARS and USD first, with a search helper', () => {
  assert.deepEqual([CURRENCIES.length, ...CURRENCIES.slice(0, 2).map(option => option.code)], [146, 'ARS', 'USD']);
  assert.equal(currencyOption('USD').name, 'Dólares estadounidenses');
  assert.equal(currencyOption('USD', 'en-US').name, 'US dollars', 'the name follows the interface language');
  // The symbol follows the region: a bare "$" is the peso in Argentina and the dollar in the United States.
  assert.deepEqual(currencyOptions('en-AR').slice(0, 2).map(option => option.code + ' ' + option.symbol), ['ARS $', 'USD US$']);
  assert.deepEqual(currencyOptions('es-AR').slice(0, 2).map(option => option.code + ' ' + option.symbol), ['ARS $', 'USD US$']);
  assert.deepEqual(currencyOptions('en-US').slice(0, 2).map(option => option.code + ' ' + option.symbol), ['ARS AR$', 'USD US$']);
  assert.deepEqual(currencyOptions('es-US').slice(0, 2).map(option => option.code + ' ' + option.symbol), ['ARS AR$', 'USD US$']);
  assert.equal(currencyOption('EUR').code, 'EUR', '24B5: a display lookup over the catalogue; the choices are still the gate\'s');
  assert.equal(searchCurrencies('').length, 146);
  assert.equal(searchCurrencies('dol')[0].code, 'USD');
  assert.equal(searchCurrencies('DÓLARES')[0].code, 'USD');
  assert.deepEqual(searchCurrencies('ars').map(o => o.code), ['ARS']);
  assert.deepEqual(searchCurrencies('euro').map(o => o.code), ['EUR']);
  assert.deepEqual(searchCurrencies('kuwait').map(o => o.code), [], 'a held three-decimal currency is not offered');
});

// ---- Producto 23.1C2: what VoiceOver hears ---------------------------------

/** The provider as the device would give it: `device` is the iPhone's first language (null: nothing read). */
const speaking = (locale: AppLocale, device: string | null) => ({ '../i18n/provider': { useI18n: () => bindLocale(locale, 'native', device) } });

test('a pressable DetailRow reads its spoken twin, a plain one gives it to the value text, and the screen keeps the visible value', () => {
  const ui = load('components.tsx');
  const pressable = ui.render('DetailRow', { label: 'Viernes 22', value: '$ 1.234,56', spokenValue: '1234,56 pesos', onPress: () => {} });
  assert.equal(nodes(pressable).find(node => is(node, 'PressFeedback'))!.props.accessibilityLabel, 'Viernes 22: 1234,56 pesos');
  assert.equal(texts(pressable)[1].props.children, '$ 1.234,56', 'the screen keeps the region\'s grouping');
  const plain = ui.render('DetailRow', { label: 'Banco después', value: 'ARS 1.234,56', spokenValue: '1234,56 ARS' });
  assert.equal(texts(plain)[1].props.accessibilityLabel, '1234,56 ARS', 'VoiceOver reads the value text by itself: it says the twin');
  assert.equal(texts(plain)[1].props.children, 'ARS 1.234,56');
  // Without a twin nothing changes: the label is the visible pair, the value text has no label of its own.
  const bare = ui.render('DetailRow', { label: 'Moneda', value: 'ARS', onPress: () => {} });
  assert.equal(nodes(bare).find(node => is(node, 'PressFeedback'))!.props.accessibilityLabel, 'Moneda: ARS');
  assert.equal(texts(ui.render('DetailRow', { label: 'Moneda', value: 'ARS' }))[1].props.accessibilityLabel, undefined);
});

test('AmountShortcut and SelectionRow read their spoken twins; the visible caption and detail are untouched', () => {
  const ui = load('components.tsx');
  const shortcut = ui.render('AmountShortcut', { label: 'Usar todo', caption: 'Banco: ARS 1.234,56', spokenCaption: 'Banco: ARS 1234,56', onPress: () => {} });
  assert.equal(nodes(shortcut).find(node => is(node, 'PressFeedback'))!.props.accessibilityLabel, 'Usar todo, Banco: ARS 1234,56');
  const caption = texts(shortcut)[0];
  assert.equal([caption.props.children].flat().join(''), 'Banco: ARS 1.234,56 ·');
  assert.equal(caption.props.accessibilityLabel, 'Banco: ARS 1234,56', 'the caption text is read on its own too, without the visual separator');
  const plain = ui.render('AmountShortcut', { label: 'Usar todo', caption: 'Saldo', onPress: () => {} });
  assert.equal(nodes(plain).find(node => is(node, 'PressFeedback'))!.props.accessibilityLabel, 'Usar todo, Saldo');
  assert.equal(texts(plain)[0].props.accessibilityLabel, undefined);
  const row = ui.render('SelectionRow', { label: 'Cuenta', value: 'Banco', detail: 'Saldo $ 1.234,56', spokenDetail: 'Saldo 1234,56 pesos', onPress: () => {} });
  assert.equal(nodes(row).find(node => is(node, 'PressFeedback'))!.props.accessibilityLabel, 'Cuenta: Banco, Saldo 1234,56 pesos');
  assert.equal(texts(row)[2].props.children, 'Saldo $ 1.234,56');
  const fact = ui.render('SelectionRow', { label: 'Cuenta', value: 'Banco', detail: 'Saldo $ 1.234,56', spokenDetail: 'Saldo 1234,56 pesos' });
  assert.equal(fact.props.accessibilityLabel, 'Cuenta: Banco, Saldo 1234,56 pesos', 'the read-only fact too');
});

test('SelectorCard, AccountField and CategoryField read the spoken detail instead of the visible one', () => {
  const ui = load('form-controls.tsx', { './categories': { categoryChoices: () => [], categoryKey: (label: string) => label.toLowerCase(), customCategory: () => null } });
  const card = ui.render('SelectorCard', { label: 'Categoría', value: 'Comida', placeholder: 'Elegir', detail: 'Te quedan $ 1.234,56', spokenDetail: 'Te quedan 1234,56 pesos', icon: 'pricetag-outline', onPress: () => {} });
  assert.equal(card.props.accessibilityLabel, 'Categoría: Comida, Te quedan 1234,56 pesos');
  assert.ok(nodes(card).some(node => node.type === 'AppText' && node.props.children === 'Te quedan $ 1.234,56'), 'the card shows the region\'s amount');
  assert.equal(ui.render('SelectorCard', { label: 'Categoría', value: 'Comida', placeholder: 'Elegir', detail: 'Límite', icon: 'pricetag-outline', onPress: () => {} }).props.accessibilityLabel,
    'Categoría: Comida, Límite', 'without a twin the visible detail is read');
  assert.equal(ui.render('SelectorCard', { label: 'Categoría', placeholder: 'Elegir categoría', icon: 'pricetag-outline', onPress: () => {} }).props.accessibilityLabel, 'Categoría: Elegir categoría');
  const cardOf = (root: Node) => nodes(root).find(node => node.type === 'PressFeedback' && String(node.props.accessibilityLabel).includes(':'))!;
  const accounts = [{ id: 'a', name: 'Banco', currency: 'ARS', openingMinor: 0, createdAt: 't' }];
  const account = ui.render('AccountField', { accounts, value: 'a', onChange: () => {}, prominent: true, detail: 'Saldo registrado $ 1.234,56', spokenDetail: 'Saldo registrado 1234,56 pesos' });
  assert.equal(cardOf(account).props.accessibilityLabel, 'Cuenta: Banco, Saldo registrado 1234,56 pesos');
  const plainAccount = ui.render('AccountField', { accounts, value: 'a', onChange: () => {}, prominent: true });
  assert.equal(cardOf(plainAccount).props.accessibilityLabel, 'Cuenta: Banco, Cuenta · ARS', 'the default detail has no amount and no twin');
  const category = ui.render('CategoryField', { entries: [], kind: 'expense', value: 'Comida', onChange: () => {}, prominent: true,
    detail: 'Presupuesto: 50 % usado · te quedan $ 1.234,56', spokenDetail: 'Presupuesto: 50 % usado · te quedan 1234,56 pesos' });
  assert.equal(cardOf(category).props.accessibilityLabel, 'Categoría: x, Presupuesto: 50 % usado · te quedan 1234,56 pesos');
});

test('ActionButton reads its spoken label and shows the visible one; the account sheet speaks an option\'s line only from its spoken twin', () => {
  const ui = load('components.tsx');
  const visible = 'Guardar gasto\u00A0·\u00A0AR$\u00A01,234.50';
  const save = ui.render('ActionButton', { label: visible, spokenLabel: 'Guardar gasto, 1234,50 pesos', onPress: () => {} });
  assert.equal(nodes(save).find(node => is(node, 'PressFeedback'))!.props.accessibilityLabel, 'Guardar gasto, 1234,50 pesos');
  assert.ok(nodes(save).some(node => node.type === 'Text' && node.props.children === visible), 'the button shows the region\'s amount');
  assert.equal(nodes(ui.render('ActionButton', { label: 'Guardar cambios', onPress: () => {} })).find(node => is(node, 'PressFeedback'))!.props.accessibilityLabel, 'Guardar cambios');
  const forms = load('form-controls.tsx', { './categories': { categoryChoices: () => [], categoryKey: (label: string) => label.toLowerCase(), customCategory: () => null } });
  const accounts = [{ id: 'a', name: 'Banco', currency: 'ARS', openingMinor: 0, createdAt: 't' }];
  const option = (props: Record<string, unknown>) => nodes(forms.render('AccountField', { accounts, value: 'a', onChange: () => {}, ...props }))
    .find(node => node.type === 'FlatList')!.props.renderItem({ item: accounts[0] });
  const spoken = option({ describe: () => 'saldo 1.234,56', spokenDescribe: (account: { currency: string }) => 'saldo 1234,56 ' + (account.currency === 'ARS' ? 'pesos' : '?') });
  assert.equal(spoken.props.accessibilityLabel, 'Banco, Cuenta, ARS, saldo 1234,56 pesos');
  assert.ok(nodes(spoken).some(node => node.type === 'AppText' && [node.props.children].flat().join('') === 'Cuenta · ARS · saldo 1.234,56'), 'the sheet shows the region\'s amount');
  // Without a twin the label stays name, kind and currency: a line in the region's separators is shown, never spoken.
  assert.equal(option({ describe: () => 'saldo 1.234,56' }).props.accessibilityLabel, 'Banco, Cuenta, ARS');
  assert.equal(option({}).props.accessibilityLabel, 'Banco, Cuenta, ARS');
});

test('every wrapper VoiceOver focuses names the interface language when it differs from the device\'s, and names none when they agree', () => {
  const hosts = (root: Node, type: string) => nodes(root).filter(node => node.type === type);
  for (const [locale, device, expected] of [['en-AR', 'es', 'en'], ['es-US', 'pt', 'es'], ['es-AR', 'es', undefined], ['en-US', 'en', undefined], ['en-US', null, undefined]] as [AppLocale, string | null, string | undefined][]) {
    const ui = load('components.tsx', speaking(locale, device));
    const name = `${locale} on a ${device ?? 'silent'} device`;
    // AppText and the Pressable inside PressFeedback (every row, button and chip goes through them).
    const text = ui.render('AppText', { children: 'x' });
    assert.equal(text.props.accessibilityLanguage, expected, name + ': AppText');
    const row = ui.render('NavigationRow', { title: 'Backup', onPress: () => {} });
    assert.equal(hosts(row, 'Pressable')[0].props.accessibilityLanguage, expected, name + ': PressFeedback');
    // Money's Text carries the spoken amount and its language.
    assert.equal(ui.render('Money', { minor: 123456, currency: 'USD' }).props.accessibilityLanguage, expected, name + ': Money');
    // The text field, the segments, the error, the read-only fact.
    assert.equal(hosts(ui.render('Field', { label: 'Name', value: '' }), 'TextInput')[0].props.accessibilityLanguage, expected, name + ': Field');
    const segments = hosts(ui.render('Choices', { value: 'a', onChange: () => {}, options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }] }), 'Pressable');
    assert.equal(segments.length, 2);
    assert.ok(segments.every(segment => segment.props.accessibilityLanguage === expected), name + ': Choices');
    const error = hosts(ui.render('ErrorMessage', { message: 'errors.storage.openFailed' }), 'Text').find(node => node.props.accessibilityRole === 'alert')!;
    assert.equal(error.props.accessibilityLanguage, expected, name + ': ErrorMessage');
    const fact = ui.render('SelectionRow', { label: 'Currency', value: 'ARS' });
    assert.equal(fact.props.accessible, true);
    assert.equal(fact.props.accessibilityLanguage, expected, name + ': the read-only SelectionRow');
    // A CheckRow follows the interface unless its caller names the option's own language (an autonym).
    const option = ui.render('CheckRow', { title: 'Same as device', selected: true, onPress: () => {} });
    assert.equal(hosts(option, 'Pressable')[0].props.accessibilityLanguage, expected, name + ': CheckRow');
    const autonym = ui.render('CheckRow', { title: 'Español', selected: false, onPress: () => {}, accessibilityLanguage: 'es' });
    assert.equal(hosts(autonym, 'Pressable')[0].props.accessibilityLanguage, 'es', name + ': "Español" is spoken in Spanish whatever the interface');
    // An explicit language from any caller wins over the interface's.
    assert.equal(ui.render('AppText', { children: 'English', accessibilityLanguage: 'en' }).props.accessibilityLanguage, 'en');
    assert.equal(hosts(ui.render('Field', { label: 'x', value: '', accessibilityLanguage: 'fr' }), 'TextInput')[0].props.accessibilityLanguage, 'fr');
  }
});

test('24B3: the currency sheet lists exactly the options it is given, searches by code or name when asked, and clears the search on a choice', () => {
  const ui = load('form-controls.tsx');
  const chosen: string[] = [];
  const options = ['ARS', 'USD', 'EUR', 'JPY', 'KWD', 'CLP', 'CAD'].map(code => ({ code, name: i18nFormat.currencyName(code as any), symbol: i18nFormat.currencySymbol(code as any) }));
  const props = { visible: true, title: 'Elegir moneda', options, value: 'JPY', searchable: true, onClose: () => {}, onChange: (code: string) => chosen.push(code) };
  let sheet = ui.render('CurrencySheet', props);
  const list = () => nodes(sheet).find(node => node.type === 'FlatList')!;
  assert.deepEqual(list().props.data.map((item: any) => item.code), ['ARS', 'USD', 'EUR', 'JPY', 'KWD', 'CLP', 'CAD'], 'the options given, in their order');
  const field = nodes(list().props.ListHeaderComponent).find(node => node.type === 'Field')!;
  assert.equal(field.props.label, 'Buscar moneda');
  field.props.onChangeText('pesos');
  sheet = ui.render('CurrencySheet', props);
  assert.deepEqual(list().props.data.map((item: any) => item.code), ['ARS', 'CLP'], 'by name, accent- and case-insensitive');
  field.props.onChangeText('kw');
  sheet = ui.render('CurrencySheet', props);
  assert.deepEqual(list().props.data.map((item: any) => item.code), ['KWD'], 'by code');
  field.props.onChangeText('zzz');
  sheet = ui.render('CurrencySheet', props);
  assert.deepEqual(list().props.data, []);
  assert.ok(nodes(list().props.ListEmptyComponent).some(node => node.type === 'AppText' && /Ninguna moneda/.test(String(node.props.children))));
  field.props.onChangeText('yen');
  sheet = ui.render('CurrencySheet', props);
  const items = list().props.data.map((item: unknown) => list().props.renderItem({ item }));
  assert.deepEqual(items.map((item: Node) => [item.props.accessibilityLabel, item.props.accessibilityState.selected]), [['Yenes japoneses, JPY', true]]);
  items[0].props.onPress();
  assert.deepEqual(chosen, ['JPY']);
  assert.deepEqual(ui.haptics, [], 'choosing the current currency does not tick');
  sheet = ui.render('CurrencySheet', props);
  assert.equal(list().props.data.length, 7, 'the search is cleared by a choice');
  // Without `searchable` (three currencies) there is no field and the whole list shows.
  sheet = ui.render('CurrencySheet', { ...props, searchable: false, options: options.slice(0, 3) });
  assert.equal(list().props.ListHeaderComponent, null);
  assert.equal(list().props.ListEmptyComponent, null);
  assert.equal(list().props.data.length, 3);
  assert.equal(list().props.ListFooterComponent, null, 'no note unless the caller gives one');
});

test('24B5: the currency field lists the gate\'s currencies with search over code, name, symbol and territory from six on, and a read-only row shows any stored code by its own name', () => {
  const ui = load('form-controls.tsx');
  const gate = ['ARS', 'USD', 'EUR', 'GBP', 'JPY', 'CLP', 'KWD'] as const;
  const chosen: string[] = [];
  const field = ui.render('CurrencyField', { value: 'ARS', onChange: (code: string) => chosen.push(code), currencies: gate });
  const sheet = nodes(field).find(node => typeof node.type === 'function' && node.type.name === 'CurrencySheet')!;
  assert.deepEqual(sheet.props.options.map((item: any) => item.code), ['ARS', 'USD', 'KWD', 'EUR', 'GBP', 'CLP', 'JPY'], 'the gate, never the whole catalogue: ARS and USD first, then by name (24M)');
  assert.deepEqual(sheet.props.options.map((item: any) => item.name), ['Pesos argentinos', 'Dólares estadounidenses', 'Dinares kuwaitíes', 'Euros', 'Libras esterlinas', 'Pesos chilenos', 'Yenes japoneses']);
  assert.equal(sheet.props.searchable, true, 'seven currencies: a search field');
  assert.equal(sheet.props.title, 'Elegir moneda');
  assert.ok(sheet.props.options.every((item: any) => typeof item.searchText === 'string' && item.searchText.length > 0), 'every choice carries the catalogue\'s search text');
  const release = nodes(ui.render('CurrencyField', { value: 'USD', onChange: () => {}, currencies: ['ARS', 'USD'] })).find(node => typeof node.type === 'function' && node.type.name === 'CurrencySheet')!;
  assert.equal(release.props.searchable, false, 'two currencies (a release): no search field, as before');
  assert.deepEqual(release.props.options.map((item: any) => item.code), ['ARS', 'USD']);
  // The search itself, on the sheet: exact code, code prefix, name prefix, then territory or symbol; the gate's order within a rank.
  const sheetUi = load('form-controls.tsx'); // Its own state slots: the harness shares them per module instance.
  let view = sheetUi.render('CurrencySheet', { visible: true, title: 'Elegir moneda', options: sheet.props.options, value: 'ARS', searchable: true, onClose: () => {}, onChange: (code: string) => chosen.push(code) });
  const list = () => nodes(view).find(node => node.type === 'FlatList')!;
  const search = nodes(list().props.ListHeaderComponent).find(node => node.type === 'Field')!;
  assert.equal(search.props.label, 'Buscar moneda');
  const query = (text: string) => { search.props.onChangeText(text); view = sheetUi.render('CurrencySheet', { visible: true, title: 'Elegir moneda', options: sheet.props.options, value: 'ARS', searchable: true, onClose: () => {}, onChange: (code: string) => chosen.push(code) }); return list().props.data.map((item: any) => item.code); };
  assert.deepEqual(query('yen'), ['JPY']);
  assert.deepEqual(query('japón'), ['JPY'], 'a territory name in the interface language');
  assert.deepEqual(query('reino unido'), ['GBP']);
  assert.deepEqual(query('€'), ['EUR'], 'a symbol');
  assert.deepEqual(query('pesos'), ['ARS', 'CLP'], 'name prefixes keep the gate\'s order');
  assert.deepEqual(query('kw'), ['KWD']);
  assert.deepEqual(query('chile'), ['CLP']);
  assert.deepEqual(query('gbp'), ['GBP'], 'an exact code');
  assert.deepEqual(query('zzz'), []);
  assert.deepEqual(query('dinar'), ['KWD']);
  const row = list().props.renderItem({ item: list().props.data[0] });
  assert.equal(row.props.accessibilityLabel, 'Dinares kuwaitíes, KWD');
  row.props.onPress();
  assert.deepEqual(chosen, ['KWD']);
  // Read-only: a stored euro account names itself, never ARS; a KWD one shows its code as its symbol.
  const euro = nodes(ui.render('CurrencyField', { value: 'EUR' })).find(node => node.type === 'SelectionRow')!;
  assert.deepEqual([euro.props.value, euro.props.detail, euro.props.onPress], ['Euros', 'EUR · €', undefined]);
  const dinar = nodes(ui.render('CurrencyField', { value: 'KWD' })).find(node => node.type === 'SelectionRow')!;
  assert.deepEqual([dinar.props.value, dinar.props.detail], ['Dinares kuwaitíes', 'KWD · KWD']);
});

// ---- 24UX2: the merchant mark --------------------------------------------------------------------------------

test('24UX2: MerchantBadge draws the category glyph for every merchant in production, recognized or not', () => {
  const ui = load('components.tsx');
  for (const merchant of ['Netflix', 'App Store', 'Apple', 'Almacén Don Pepe', '']) {
    const badge = ui.render('MerchantBadge', { merchant, category: 'Suscripciones', kind: 'expense', tone: 'neutral' });
    assert.equal(is(badge, 'CategoryBadge'), true, merchant);
    assert.equal(JSON.stringify([badge.props.category, badge.props.kind, badge.props.tone]), JSON.stringify(['Suscripciones', 'expense', 'neutral']));
  }
  const income = ui.render('MerchantBadge', { merchant: 'Sueldo', category: 'Sueldo', kind: 'income', tone: 'income', large: true });
  assert.equal(JSON.stringify([income.props.tone, income.props.large]), JSON.stringify(['income', true]), 'the income tone and the size pass through');
});

test('24UX2: the development monogram is a neutral tile with a fixed-size initial, never announced', () => {
  const ui = load('components.tsx', { './merchant-mark': { ...merchantMark, merchantMark: () => ({ kind: 'monogram', brand: { id: 'spotify', name: 'Spotify', aliases: [], domain: 'spotify.com' }, letter: 'S' }) } });
  const tile = ui.render('MerchantBadge', { merchant: 'Spotify', category: 'Suscripciones', large: true });
  assert.equal(JSON.stringify([tile.props.accessible, tile.props.style.width, tile.props.style.backgroundColor]), JSON.stringify([false, 56, '#EEEEF3']));
  const letter = nodes(tile).find(node => is(node, 'AppText'))!;
  assert.equal(JSON.stringify([letter.props.children, letter.props.allowFontScaling]), JSON.stringify(['S', false]));
});

test('24UX2: a movement row shows the name as typed beside its merchant mark, keeps the category in its caption and names the account only when asked', () => {
  const ui = load('components.tsx');
  const entry = { id: 'e', accountId: 'a', kind: 'expense', amountMinor: 899900, merchant: 'netflix.com', category: 'Suscripciones', dateISO: '2026-09-22', createdAt: '' };
  const account = { id: 'a', name: 'Banco', currency: 'ARS', openingMinor: 0, createdAt: '' };
  const row = ui.render('EntryRow', { entry, account, showAccount: false });
  const badge = nodes(row).find(node => is(node, 'MerchantBadge'))!;
  assert.equal(JSON.stringify([badge.props.merchant, badge.props.category]), JSON.stringify(['netflix.com', 'Suscripciones']));
  const shown = texts(row).map(node => [node.props.children].flat().join(''));
  assert.ok(shown.includes('netflix.com'), 'the typed name, never the brand spelling');
  assert.ok(shown.some(text => text.startsWith('x · ')), 'the category label leads the caption');
  assert.equal(shown.some(text => text.includes('Banco')), false);
  assert.ok(texts(ui.render('EntryRow', { entry, account })).map(node => [node.props.children].flat().join('')).some(text => text.includes('Banco')));
  // VoiceOver names the row's own account either way, so a hidden caption never hides which account paid.
  const spoken = (props: any) => nodes(ui.render('EntryRow', props)).find(node => is(node, 'PressFeedback'))!.props.accessibilityLabel;
  assert.equal(spoken({ entry, account, showAccount: false }), 'netflix.com, gasto, 8999,00 ARS, x, Banco, Hoy');
  assert.equal(spoken({ entry: { ...entry, accountId: 'b' }, account: { ...account, id: 'b', name: 'Efectivo' }, showAccount: true }), 'netflix.com, gasto, 8999,00 ARS, x, Efectivo, Hoy');
});

// ---- 24UX6C: a typed movement is shown as stored; its kind says what it is ------------------------------------

// A real PressFeedback re-emits its children, so the same Money node can be met twice: count each once.
const moneyOf = (root: Node) => [...new Set(nodes(root).filter(node => node.type?.name === 'Money'))];
/** Every string the row draws (AppText children, Money's Text), to prove no minus reaches the screen. */
const drawn = (root: Node) => nodes(root).filter(node => is(node, 'AppText') || node.type === 'Text')
  .flatMap(node => [node.props.children].flat(Infinity)).filter(child => typeof child === 'string' || typeof child === 'number').map(String);
const pressOf = (root: Node) => nodes(root).find(node => is(node, 'PressFeedback'))!;

test('24UX6C: an expense row shows the stored magnitude unsigned in ink, an income row a «+» in the income green; the entry is never changed', () => {
  const ui = load('components.tsx');
  const account = { id: 'a', name: 'Banco', currency: 'ARS', openingMinor: 0, createdAt: 't' };
  const expense = Object.freeze({ id: 'e', accountId: 'a', kind: 'expense', merchant: 'Café', category: 'Comida', amountMinor: 123450, dateISO: '2026-09-22', createdAt: 't' });
  const before = JSON.stringify(expense);
  const row = ui.render('EntryRow', { entry: expense, account });
  const [money] = moneyOf(row);
  assert.equal(moneyOf(row).length, 1);
  assert.equal(money.props.minor, 123450, 'the stored amount, positive: never negated for display');
  assert.equal(money.props.signed, false, 'no sign on an expense');
  assert.equal(money.props.tone, 'expense');
  const ink = nodes(row).find(node => node.type === 'Text' && typeof node.props.accessibilityLabel === 'string' && node.props.style?.fontVariant)!;
  assert.equal(ink.props.style.color, '#0A0A0C', 'the expense tone is ink (palette.text), never the alarm red');
  assert.ok(drawn(row).length > 0);
  assert.equal(drawn(row).some(text => /[-−]/.test(text)), false, 'no minus anywhere in the row: ' + drawn(row).join(' | '));
  assert.ok(drawn(row).includes('$ 1.234,50'), 'the amount reads as stored: ' + drawn(row).join(' | '));
  assert.equal(JSON.stringify(expense), before, 'rendering never changes the entry');
  // VoiceOver still names the kind and the magnitude.
  assert.equal(pressOf(row).props.accessibilityLabel, 'Café, gasto, 1234,50 ARS, x, Banco, Hoy');

  const income = { ...expense, id: 'i', kind: 'income', merchant: 'Sueldo', category: 'Sueldo', amountMinor: 500000 };
  const incomeRow = ui.render('EntryRow', { entry: income, account });
  const [plus] = moneyOf(incomeRow);
  assert.equal(plus.props.minor, 500000);
  assert.equal(plus.props.signed, true, 'an income carries its «+»');
  assert.equal(plus.props.tone, 'income');
  assert.ok(drawn(incomeRow).some(text => text.startsWith('+')), 'the «+» is drawn: ' + drawn(incomeRow).join(' | '));
  assert.equal(nodes(incomeRow).find(node => node.type === 'Text' && node.props.style?.fontVariant)!.props.style.color, '#1F7A4D', 'in the income green');
  assert.equal(pressOf(incomeRow).props.accessibilityLabel, 'Sueldo, ingreso, 5000,00 ARS, x, Banco, Hoy');
  assert.equal(income.amountMinor, 500000);
});

test('24UX6C: a transfer row shows the stored amount unsigned in the transfer tone in every context, and VoiceOver names the kind', () => {
  const ui = load('components.tsx');
  const bank = { id: 'a', name: 'Banco', currency: 'ARS', openingMinor: 0, createdAt: 't' };
  const cash = { id: 'b', name: 'Efectivo', currency: 'ARS', openingMinor: 0, createdAt: 't' };
  const transfer = Object.freeze({ id: 't', fromAccountId: 'a', toAccountId: 'b', amountMinor: 250000, dateISO: '2026-09-22', createdAt: 't', note: '' });
  const before = JSON.stringify(transfer);
  const contexts: [string, Record<string, unknown>][] = [
    ['no account', {}], ['account context, outgoing', { accountId: 'a' }], ['account context, incoming', { accountId: 'b' }],
    ['card context, payment', { accountId: 'b', context: 'card' }], ['card context, outgoing', { accountId: 'a', context: 'card' }],
    ['debt context, payment', { accountId: 'b', context: 'debt' }], ['debt context, collection', { accountId: 'a', context: 'debt' }],
  ];
  for (const [name, props] of contexts) {
    const row = ui.render('TransferRow', { transfer, accounts: [bank, cash], ...props });
    const money = moneyOf(row);
    assert.equal(money.length, 1, name);
    assert.equal(money[0].props.minor, 250000, name + ': the stored amount, never negated');
    assert.equal(money[0].props.signed, false, name + ': no sign');
    assert.equal(money[0].props.tone, 'transfer', name + ': the transfer tone');
    assert.equal(money[0].props.color, undefined, name + ': no forced ink');
    assert.equal(nodes(row).find(node => node.type === 'Text' && node.props.style?.fontVariant)!.props.style.color, '#2D6476', name + ': drawn in palette.transfer');
    assert.equal(drawn(row).some(text => /[-−+]/.test(text)), false, name + ': no sign drawn: ' + drawn(row).join(' | '));
  }
  assert.equal(JSON.stringify(transfer), before, 'rendering never changes the transfer');
  const spoken = (props: Record<string, unknown>) => pressOf(ui.render('TransferRow', { accounts: [bank, cash], ...props })).props.accessibilityLabel;
  assert.equal(spoken({ transfer }), 'Transferencia, de Banco a Efectivo, 2500,00 ARS, Hoy', 'an untitled transfer says its kind once');
  assert.equal(spoken({ transfer: { ...transfer, note: 'Alquiler' } }), 'Transferencia, Alquiler, de Banco a Efectivo, 2500,00 ARS, Hoy',
    'a note titles the row: the kind leads and the note is not repeated');
  assert.equal(spoken({ transfer: { ...transfer, note: 'Alquiler' }, accountId: 'a' }), 'Transferencia, Alquiler, de Banco a Efectivo, 2500,00 ARS, Hoy');
  // Card and debt contexts keep their own titles.
  assert.equal(spoken({ transfer, accountId: 'b', context: 'card' }), 'Pago de tarjeta, de Banco a Efectivo, 2500,00 ARS, Hoy');
  assert.equal(spoken({ transfer, accountId: 'a', context: 'card' }), 'Transferencia, de Banco a Efectivo, 2500,00 ARS, Hoy');
  assert.equal(spoken({ transfer, accountId: 'b', context: 'debt' }), 'Pago, de Banco a Efectivo, 2500,00 ARS, Hoy');
  assert.equal(spoken({ transfer, accountId: 'a', context: 'debt' }), 'Cobro, de Banco a Efectivo, 2500,00 ARS, Hoy');
  assert.equal(spoken({ transfer: { ...transfer, note: 'Cuota' }, accountId: 'b', context: 'card' }), 'Pago de tarjeta, de Banco a Efectivo, 2500,00 ARS, Hoy, Cuota',
    'in a card context the note is still read after the facts');
});

test('24UX6C: a computed sign is kept: a negative account balance still renders with its minus', () => {
  const ui = load('components.tsx', { '@finanzapp/domain': { accountBalanceMinor: () => -45000, formatMinorUnits, labelFromISO: (d: string) => d, categoryKey: (s: string) => s.toLowerCase(), todayKey: (d: Date) => d.toISOString().slice(0, 10) } });
  const account = { id: 'a', name: 'Banco', currency: 'ARS', openingMinor: 0, createdAt: 't' };
  const row = ui.render('AccountRow', { account, entries: [], transfers: [] });
  const [money] = moneyOf(row);
  assert.ok(money.props.minor < 0, 'the balance is passed negative');
  assert.equal(money.props.minor, -45000);
  assert.equal(money.props.color, '#C0392B', 'a negative balance keeps its warning colour');
  assert.ok(drawn(row).some(text => /^[-−]/.test(text)), 'the minus is drawn: ' + drawn(row).join(' | '));
});

test('24UX6E: LifecycleNote says a state calmly: a secondary glyph hidden from VoiceOver, an optional subhead title and one footnote line; amber only on the words of a review', () => {
  const ui = load('components.tsx');
  const note = ui.render('LifecycleNote', { icon: 'trash-outline', title: 'Cuenta eliminada', detail: 'Sus movimientos siguen aquí.' });
  const glyph = nodes(note).find(node => is(node, 'Ionicons'))!;
  assert.equal(glyph.props.name, 'trash-outline');
  assert.equal(glyph.props.accessible, false);
  assert.equal(glyph.props.color, '#6E7078');
  const [title, detail] = texts(note);
  assert.equal(title.props.children, 'Cuenta eliminada');
  assert.equal(title.props.variant, 'subhead');
  assert.equal(flat(title.props.style).fontWeight, '600');
  assert.equal(detail.props.children, 'Sus movimientos siguen aquí.');
  assert.equal(detail.props.variant, 'footnote');
  assert.equal(detail.props.secondary, true);
  assert.equal(nodes(note).some(node => is(node, 'Surface')), false, 'no surface, no banner');
  assert.equal(JSON.stringify(note).includes('#C0392B'), false, 'never the alarm colour');
  const plain = ui.render('LifecycleNote', { icon: 'pause-outline', detail: 'Pausada.' });
  assert.equal(texts(plain).length, 1, 'without a title, one line');
  const review = ui.render('LifecycleNote', { icon: 'alert-circle-outline', detail: 'Revisala.', tone: 'warning' });
  assert.equal(nodes(review).find(node => is(node, 'Ionicons'))!.props.color, '#6E7078', 'the glyph stays secondary');
  assert.equal(flat(texts(review)[0].props.style).color, '#B26A00');
});

test('24UX6E: AccountRow draws the name and the balance only (no «Cuenta · ARS» line); VoiceOver still reads the name and the balance', () => {
  const ui = load('components.tsx');
  const account = { id: 'a', name: 'Banco', currency: 'ARS', openingMinor: 0, createdAt: 't' };
  const row = ui.render('AccountRow', { account, entries: [], transfers: [] });
  const shown = texts(row).map(node => String(node.props.children));
  assert.deepEqual(shown, ['Banco'], 'only the name is an AppText: ' + shown.join(' | '));
  assert.equal(drawn(row).some(text => /Cuenta|·/.test(text)), false, drawn(row).join(' | '));
  assert.equal(nodes(row).find(node => is(node, 'PressFeedback'))!.props.accessibilityLabel, 'Ver cuenta Banco, saldo 0,00 ARS');
  assert.ok(nodes(row).some(node => is(node, 'Ionicons') && node.props.name === 'chevron-forward'), 'it still pushes the detail');
});

test('24UX6E: AccountRow counts its chevron (ROW_CHEVRON) when it decides to stack: a seven-digit ARS balance with cents goes under the name at 375 pt, stays beside it at 430 pt, and any balance stacks at large text', () => {
  assert.equal(geometry.ROW_CHEVRON, 28, 'the 16 pt chevron and the 12 pt gap before it');
  const domainWith = (balance: number) => ({ '@finanzapp/domain': { accountBalanceMinor: () => balance, formatMinorUnits, labelFromISO: (d: string) => d, categoryKey: (s: string) => s.toLowerCase(), todayKey: (d: Date) => d.toISOString().slice(0, 10) } });
  const account = { id: 'a', name: 'Banco', currency: 'ARS', openingMinor: 0, createdAt: 't' };
  const direction = (balance: number, width: number, fontScale = 1) => {
    const row = load('components.tsx', domainWith(balance), fontScale, width).render('AccountRow', { account, entries: [], transfers: [] });
    return nodes(row).find(node => is(node, 'View') && node.props.style?.flex === 1 && 'flexDirection' in node.props.style)!.props.style.flexDirection;
  };
  // «$ 1.234.567,89» is about 127 pt at 17 pt: under the 141 pt the row had without the chevron, over the 125 pt it really has.
  assert.equal(geometry.rowStacks(375, 1, '$ 1.234.567,89'), false, 'the old estimate (no chevron) kept it beside the name');
  assert.equal(direction(123456789, 375), 'column', 'at 375 pt it stacks instead of shrinking');
  assert.equal(direction(123456789, 430), 'row', 'at 430 pt it fits beside the name');
  assert.equal(direction(150000, 375), 'row', 'an everyday balance stays beside the name');
  assert.equal(direction(0, 430, 1.5), 'column', 'large text stacks every row');
});

test('24UX6D: in a card\'s lists a purchase and a recorded instalment are unsigned ink, a payment is a transfer («Pago de tarjeta», the transfer tone, no sign)', () => {
  const ui = load('components.tsx');
  const bank = { id: 'bank', name: 'Banco', currency: 'ARS', openingMinor: 0, createdAt: 't' };
  const card = { id: 'card-acc', name: 'Visa Gold', currency: 'ARS', openingMinor: 0, createdAt: 't' };
  const accounts = [bank, card];
  const purchase = Object.freeze({ id: 'p', accountId: 'card-acc', kind: 'expense', merchant: 'Starbucks', category: 'Café', amountMinor: 23100, dateISO: '2026-09-22', createdAt: 't' });
  // An instalment's principal share is an ordinary expense on the card's hidden account (domain `installmentEntries`).
  const instalment = Object.freeze({ id: 'inst_tv_002', accountId: 'card-acc', kind: 'expense', merchant: 'Electro', category: 'Hogar', amountMinor: 10000000, dateISO: '2026-09-22', createdAt: 't' });
  for (const entry of [purchase, instalment]) {
    const row = ui.render('MovementRow', { item: { type: 'entry', key: entry.id, value: entry }, accounts, accountId: 'card-acc', context: 'card' });
    const [money] = moneyOf(row);
    assert.equal(JSON.stringify([money.props.minor, money.props.signed, money.props.tone]), JSON.stringify([entry.amountMinor, false, 'expense']), entry.id);
    assert.equal(nodes(row).find(node => node.type === 'Text' && node.props.style?.fontVariant)!.props.style.color, '#0A0A0C', entry.id + ': ink, never the alarm red');
    assert.equal(drawn(row).some(text => /[-−+]/.test(text)), false, entry.id + ': no sign: ' + drawn(row).join(' | '));
    assert.equal(drawn(row).some(text => text.includes('Visa Gold')), false, entry.id + ': inside the card the row does not repeat the card\'s name');
  }
  const payment = Object.freeze({ id: 'pay', fromAccountId: 'bank', toAccountId: 'card-acc', amountMinor: 30000, dateISO: '2026-09-22', createdAt: 't', note: 'Pago Visa Gold' });
  const row = ui.render('MovementRow', { item: { type: 'transfer', key: 'pay', value: payment }, accounts, accountId: 'card-acc', context: 'card' });
  const [money] = moneyOf(row);
  assert.equal(JSON.stringify([money.props.minor, money.props.signed, money.props.tone]), JSON.stringify([30000, false, 'transfer']), 'a payment is a transfer, never an expense');
  assert.equal(nodes(row).find(node => node.type === 'Text' && node.props.style?.fontVariant)!.props.style.color, '#2D6476');
  assert.ok(drawn(row).includes('Pago de tarjeta'), drawn(row).join(' | '));
  assert.match(pressOf(row).props.accessibilityLabel, /^Pago de tarjeta, de Banco a Visa Gold, 300,00 ARS, /);
});

// ---- 24T3: the lines a devolución and an adelanto de cuotas project (A26) ---------------------------------------

test('24T3: a devolución line reads «Devolución · comercio», unsigned in ink with its own glyph, and opens its operation; an adelanto names its component', () => {
  const pushed: unknown[] = [];
  const ui = load('components.tsx', { 'expo-router': { router: { push: (to: unknown) => pushed.push(to) } } });
  const account = { id: 'a', name: 'Banco', currency: 'ARS', openingMinor: 0, createdAt: 't' };
  // A contra-expense: stored negative in the ledger line, shown as the amount returned.
  const refund = Object.freeze({ id: 'r1', accountId: 'a', kind: 'expense', amountMinor: -20000, merchant: 'Zara', category: 'Ropa', dateISO: '2026-09-22', createdAt: 't',
    refund: { operationId: 'r1', targetEntryId: 'buy' } });
  const row = ui.render('EntryRow', { entry: refund, account });
  const [money] = moneyOf(row);
  assert.equal(JSON.stringify([money.props.minor, money.props.signed, money.props.tone]), JSON.stringify([20000, false, 'expense']), 'the amount returned, no sign, ink');
  assert.equal(drawn(row).some(text => /[-−+]/.test(text)), false, 'no sign drawn: ' + drawn(row).join(' | '));
  assert.ok(drawn(row).includes('Devolución · Zara'), drawn(row).join(' | '));
  assert.equal(nodes(row).some(node => is(node, 'MerchantBadge')), false, 'its own glyph, not the purchase\'s');
  assert.equal(nodes(row).find(node => is(node, 'GlyphTile'))!.props.icon, 'arrow-undo-outline');
  assert.equal(pressOf(row).props.accessibilityLabel, 'Devolución, Zara, 200,00 ARS, x, Banco, Hoy', 'the kind word first');
  pressOf(row).props.onPress();
  assert.equal(JSON.stringify(pushed.pop()), JSON.stringify({ pathname: '/operation/[id]', params: { id: 'r1' } }));
  assert.equal(refund.amountMinor, -20000, 'the line is never changed');

  const principal = { id: 'p1_p', accountId: 'a', kind: 'expense', amountMinor: 40000, merchant: 'Electro', category: 'Hogar', dateISO: '2026-09-22', createdAt: 't',
    payoff: { operationId: 'p1', planId: 'tv', component: 'principal' } };
  const payoff = ui.render('EntryRow', { entry: principal, account });
  assert.ok(drawn(payoff).includes('Adelanto de cuotas · Electro'));
  assert.ok(nodes(payoff).some(node => is(node, 'MerchantBadge')), 'recognised card spending keeps the purchase\'s tile');
  assert.equal(pressOf(payoff).props.accessibilityLabel, 'Adelanto de cuotas, Electro, 400,00 ARS, x, Banco, Hoy');
  pressOf(payoff).props.onPress();
  assert.equal(JSON.stringify(pushed.pop()), JSON.stringify({ pathname: '/operation/[id]', params: { id: 'p1' } }));
  const interest = ui.render('EntryRow', { entry: { ...principal, id: 'p1_i', amountMinor: 400, payoff: { ...principal.payoff, component: 'interest' } }, account });
  assert.ok(drawn(interest).includes('Adelanto de cuotas · interés · Electro'));
  assert.equal(pressOf(interest).props.accessibilityLabel, 'Adelanto de cuotas, interés, Electro, 4,00 ARS, x, Banco, Hoy');
  // An ordinary movement keeps its row and its route.
  const plain = ui.render('EntryRow', { entry: { ...principal, id: 'e', payoff: undefined }, account });
  pressOf(plain).props.onPress();
  assert.equal(JSON.stringify(pushed.pop()), JSON.stringify({ pathname: '/entry/[id]', params: { id: 'e' } }));
  assert.equal(pressOf(plain).props.accessibilityLabel, 'Electro, gasto, 400,00 ARS, x, Banco, Hoy');
});

test('25OPS1: Screen and EntryList (Más, Movimientos) take the dock clearance as bottom padding; a pushed screen keeps its own', () => {
  const tabs = { './dock-clearance': { useDockInset: () => ({ extraPadding: 88, indicator: { bottom: 88.125 } }) } };
  // Más (and every tab root drawn with Screen).
  const root = load('components.tsx', tabs).exports.Screen({ children: null });
  assert.equal(root.type, 'ScrollView');
  assert.equal(flat(root.props.contentContainerStyle).paddingBottom, 48 + 88, 'true scrollable space: the version line rests above the dock');
  assert.equal(root.props.contentInset, undefined, 'no native content inset');
  assert.deepEqual(root.props.scrollIndicatorInsets, { bottom: 88.125 });
  assert.equal(root.props.contentInsetAdjustmentBehavior, 'never', 'the safe area is never added on top of the clearance');
  assert.equal(root.props.automaticallyAdjustKeyboardInsets, true, 'the keyboard still lifts the content');
  // A pushed screen or a modal: exactly as before.
  const pushed = load('components.tsx').exports.Screen({ children: null });
  assert.equal(flat(pushed.props.contentContainerStyle).paddingBottom, 48);
  assert.deepEqual([pushed.props.contentInset, pushed.props.scrollIndicatorInsets, pushed.props.contentInsetAdjustmentBehavior], [undefined, undefined, 'automatic']);
  // Movimientos (and a pushed list, which keeps 40).
  const list = (extra: Record<string, unknown>) => load('entry-list.tsx', { 'react-native': { SectionList: 'SectionList', View: 'View' },
    './components': { AppText: 'AppText', MovementRow: 'MovementRow' }, './presentation': presentation, ...extra }).exports.EntryList({ entries: [], accounts: [] });
  const activity = list(tabs);
  assert.equal(activity.type, 'SectionList');
  assert.equal(activity.props.contentContainerStyle.paddingBottom, 40 + 88, 'the oldest movement rests above the dock');
  assert.equal(activity.props.contentInset, undefined);
  assert.deepEqual(activity.props.scrollIndicatorInsets, { bottom: 88.125 });
  assert.equal(activity.props.contentInsetAdjustmentBehavior, 'never');
  assert.equal(activity.props.automaticallyAdjustKeyboardInsets, true, 'the search keyboard still lifts the list');
  const account = list({});
  assert.equal(account.props.contentContainerStyle.paddingBottom, 40);
  assert.deepEqual([account.props.contentInset, account.props.scrollIndicatorInsets, account.props.contentInsetAdjustmentBehavior], [undefined, undefined, 'automatic']);
});
