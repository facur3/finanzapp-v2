import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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

// Producto 22.1: the row and field components at source level (React Native
// replaced by descriptors). Structure, hierarchy and labels are checked here;
// wrapping at Dynamic Type sizes and narrow widths needs the iPhone.
type Node = { type: any; props: Record<string, any> };
function load(file: string, extra: Record<string, unknown> = {}, fontScale = 1) {
  const source = readFileSync(new URL('../src/ui/' + file, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const jsx = (type: any, props: any) => ({ type, props });
  const state: unknown[] = [];
  const alerts: { title: string; message: string; buttons?: { text: string }[] }[] = [];
  const haptics: string[] = [];
  let cursor = 0;
  const p = { isDark: false, surface: '#FFFFFF', inset: '#EEEEF3', text: '#0A0A0C', secondary: '#6E7078', tertiary: '#8E9098', line: '#E6E6EC', primary: '#2557D6', primaryFill: '#2557D6', onPrimary: '#FFF', primarySoft: '#E5ECFB', background: '#F2F2F6' };
  const modules: Record<string, unknown> = {
    react: { useState: (initial: unknown) => { const index = cursor++; if (!(index in state)) state[index] = initial; return [state[index], (value: unknown) => { state[index] = typeof value === 'function' ? (value as (c: unknown) => unknown)(state[index]) : value; }]; },
      useEffect: () => {}, useId: () => 'id', useRef: (initial: unknown) => ({ current: initial }), useMemo: (fn: () => unknown) => fn(),
      Children: { map: (children: unknown, fn: (child: unknown) => unknown) => (Array.isArray(children) ? children : [children]).map(fn) } },
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'react-native': { View: 'View', Text: 'Text', TextInput: 'TextInput', ScrollView: 'ScrollView', Pressable: 'Pressable', ActivityIndicator: 'ActivityIndicator', InputAccessoryView: 'InputAccessoryView',
      FlatList: 'FlatList', Modal: 'Modal', Platform: { OS: 'ios' }, Keyboard: { dismiss() {} }, StyleSheet: { hairlineWidth: 0.5, create: (styles: unknown) => styles, flatten: (style: any) => Object.assign({}, ...(Array.isArray(style) ? style.flat(Infinity).filter(Boolean) : [style])), absoluteFill: {} },
      useWindowDimensions: () => ({ fontScale, width: 390, height: 844 }), Alert: { alert: (title: string, message: string, buttons?: { text: string }[]) => alerts.push({ title, message, buttons }) } },
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
    './categories': {}, './category-color': { tintOf: () => '#EEE' }, './category-hues': { useAccountLook: () => ({ glyph: 'wallet-outline', hex: '#2557D6' }), useCategoryLook: () => ({ glyph: 'pricetag-outline', hex: '#3E6FB0', label: 'x' }), useAccountNameOf: () => (account: any) => account.name, useAccountLookOf: () => () => ({ glyph: 'wallet-outline', hex: '#2557D6' }), useCategoryDefinitions: () => [] },
    './geometry': geometry, './merchant-mark': merchantMark,
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

test('EmptyState is one calm card: a 44 pt glyph, a title3 headline and one line, never a full-screen illustration', () => {
  const ui = load('components.tsx');
  const empty = ui.render('EmptyState', { title: 'Nada recurrente todavía', detail: 'Programá un pago.', icon: 'repeat-outline', action: { type: 'ActionButton', props: {} } });
  const glyph = nodes(empty).find(node => is(node, 'GlyphTile'))!;
  assert.equal(glyph.props.size, 44);
  assert.equal(glyph.props.large, undefined);
  const [title, detail] = texts(empty);
  assert.equal(title.props.variant, 'title3');
  assert.equal(title.props.accessibilityRole, 'header');
  assert.equal(detail.props.variant, 'subhead');
  assert.equal(flat(empty.props.style).paddingVertical, 22);
  assert.ok(nodes(empty).some(node => is(node, 'ActionButton')));
});

test('the currency row stacks label, full name and code so "Dólares estadounidenses · USD" never breaks across lines; the sheet lists the two ledger currencies', () => {
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
  assert.deepEqual(list.props.data.map((item: any) => item.code), ['ARS', 'USD'], 'only the currencies the ledger can hold');
  const items = list.props.data.map((item: unknown) => list.props.renderItem({ item }));
  assert.deepEqual(items.map((item: Node) => item.props.accessibilityLabel), ['Pesos argentinos, ARS', 'Dólares estadounidenses, USD']);
  assert.deepEqual(items.map((item: Node) => item.props.accessibilityState.selected), [false, true]);
  assert.ok(nodes(items[1]).some(node => is(node, 'Ionicons') && node.props.name === 'checkmark-circle'), 'the current currency carries the checkmark');
  items[0].props.onPress();
  assert.deepEqual(chosen, ['ARS']);
  assert.deepEqual(ui.haptics, ['selection']);
  items[1].props.onPress();
  assert.deepEqual(ui.haptics, ['selection'], 'choosing the current currency again does not tick');
  assert.ok(nodes(list.props.ListFooterComponent).some(node => node.type === 'AppText' && /monedas disponibles hoy/.test(String(node.props.children))), 'the sheet says why the list is short, naming no currency');
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

test('24UX3 review: a plain EntryRow is an open ledger line, with the hairline under the text and a dim on press', () => {
  const ui = load('components.tsx');
  const account = { id: 'a', name: 'Banco', currency: 'ARS', openingMinor: 0, createdAt: 't' };
  const entry = { id: 'e', accountId: 'a', kind: 'expense', merchant: 'Café', category: 'Comida', amountMinor: 1200, dateISO: '2026-09-22', createdAt: 't' };
  const column = (root: Node) => nodes(root).find(node => is(node, 'View') && node.props.style?.flex === 1 && 'flexDirection' in node.props.style)!;
  const grouped = ui.render('EntryRow', { entry, account });
  assert.equal(grouped.props.feedback, 'highlight');
  assert.equal(column(grouped).props.style.borderBottomWidth, undefined, 'grouped: the separator belongs to the cell');
  const plain = ui.render('EntryRow', { entry, account, plain: true });
  assert.equal(plain.props.feedback, 'opacity', 'no cell to tint on the ground');
  assert.equal(plain.props.style.paddingHorizontal, undefined, 'aligned with the section title');
  assert.equal(column(plain).props.style.borderBottomWidth > 0, true, 'the hairline starts under the text');
  assert.equal(column(ui.render('EntryRow', { entry, account, plain: true, last: true })).props.style.borderBottomWidth, 0);
  assert.equal(plain.props.accessibilityLabel, grouped.props.accessibilityLabel, 'VoiceOver hears the same sentence');
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
  const wide = ui.render('TransferRow', { transfer, accounts: [account, usd], accountId: 'a' });
  assert.equal(rowOf(wide).props.style.flexDirection, 'column', 'a nine-digit signed transfer on a 390 pt screen stacks');
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

test('the currency list is exactly ARS and USD, with a search helper ready for the future currency screen', () => {
  assert.deepEqual(CURRENCIES.map(option => option.code), ['ARS', 'USD']);
  assert.equal(currencyOption('USD').name, 'Dólares estadounidenses');
  assert.equal(currencyOption('USD', 'en-US').name, 'US dollars', 'the name follows the interface language');
  // The symbol follows the region: a bare "$" is the peso in Argentina and the dollar in the United States.
  assert.deepEqual(currencyOptions('en-AR').map(option => option.code + ' ' + option.symbol), ['ARS $', 'USD US$']);
  assert.deepEqual(currencyOptions('es-AR').map(option => option.code + ' ' + option.symbol), ['ARS $', 'USD US$']);
  assert.deepEqual(currencyOptions('en-US').map(option => option.code + ' ' + option.symbol), ['ARS AR$', 'USD US$']);
  assert.deepEqual(currencyOptions('es-US').map(option => option.code + ' ' + option.symbol), ['ARS AR$', 'USD US$']);
  assert.equal(currencyOption('EUR').code, 'EUR', '24B5: a display lookup over the catalogue; the choices are still the gate\'s');
  assert.deepEqual(searchCurrencies('').map(o => o.code), ['ARS', 'USD']);
  assert.deepEqual(searchCurrencies('dol').map(o => o.code), ['USD']);
  assert.deepEqual(searchCurrencies('DÓLARES').map(o => o.code), ['USD']);
  assert.deepEqual(searchCurrencies('ars').map(o => o.code), ['ARS']);
  assert.deepEqual(searchCurrencies('euro'), []);
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
  assert.deepEqual(sheet.props.options.map((item: any) => item.code), [...gate], 'the gate, in its order, never the whole catalogue');
  assert.deepEqual(sheet.props.options.map((item: any) => item.name), ['Pesos argentinos', 'Dólares estadounidenses', 'Euros', 'Libras esterlinas', 'Yenes japoneses', 'Pesos chilenos', 'Dinares kuwaitíes']);
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
