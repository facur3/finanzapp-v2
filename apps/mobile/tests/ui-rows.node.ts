import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { CURRENCIES, currencyOption, searchCurrencies } from '../src/ui/currencies.ts';

// Producto 22.1: the row and field components at source level (React Native
// replaced by descriptors). Structure, hierarchy and labels are checked here;
// wrapping at Dynamic Type sizes and narrow widths needs the iPhone.
type Node = { type: any; props: Record<string, any> };
function load(file: string, extra: Record<string, unknown> = {}) {
  const source = readFileSync(new URL('../src/ui/' + file, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const jsx = (type: any, props: any) => ({ type, props });
  const state: unknown[] = [];
  const alerts: { title: string; message: string }[] = [];
  const haptics: string[] = [];
  let cursor = 0;
  const p = { isDark: false, surface: '#FFFFFF', inset: '#EEEEF3', text: '#0A0A0C', secondary: '#6E7078', tertiary: '#8E9098', line: '#E6E6EC', primary: '#2557D6', primaryFill: '#2557D6', onPrimary: '#FFF', primarySoft: '#E5ECFB', background: '#F2F2F6' };
  const modules: Record<string, unknown> = {
    react: { useState: (initial: unknown) => { const index = cursor++; if (!(index in state)) state[index] = initial; return [state[index], (value: unknown) => { state[index] = typeof value === 'function' ? (value as (c: unknown) => unknown)(state[index]) : value; }]; },
      useEffect: () => {}, useId: () => 'id', useRef: (initial: unknown) => ({ current: initial }), useMemo: (fn: () => unknown) => fn() },
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'react-native': { View: 'View', Text: 'Text', TextInput: 'TextInput', ScrollView: 'ScrollView', Pressable: 'Pressable', ActivityIndicator: 'ActivityIndicator', InputAccessoryView: 'InputAccessoryView',
      FlatList: 'FlatList', Modal: 'Modal', Platform: { OS: 'ios' }, Keyboard: { dismiss() {} }, StyleSheet: { hairlineWidth: 0.5, create: (styles: unknown) => styles, flatten: (style: any) => Object.assign({}, ...(Array.isArray(style) ? style.flat(Infinity).filter(Boolean) : [style])), absoluteFill: {} },
      useWindowDimensions: () => ({ fontScale: 1, width: 390, height: 844 }), Alert: { alert: (title: string, message: string) => alerts.push({ title, message }) } },
    'react-native-reanimated': { __esModule: true, default: { View: 'Animated.View' }, useSharedValue: (value: number) => ({ value }), withTiming: (value: number) => value, useAnimatedStyle: (fn: () => unknown) => fn() },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
    '@react-native-community/datetimepicker': 'DateTimePicker',
    '@expo/vector-icons/Ionicons': 'Ionicons',
    'expo-router': { router: { push: () => {} } },
    '@finanzapp/domain': { accountBalanceMinor: () => 0, formatMinorUnits: (n: number) => String(n), labelFromISO: (d: string) => d, categoryKey: (s: string) => s.toLowerCase() },
    './theme': { radius: { chip: 14, tile: 12, group: 16, card: 20, sheet: 24, creditCard: 18, button: 14 }, space: { xs: 4, s: 8, m: 12, l: 16, xl: 20, xxl: 24, xxxl: 32 },
      type: { body: { fontSize: 17 }, subhead: { fontSize: 15 }, footnote: { fontSize: 13 }, caption: { fontSize: 12 }, title2: { fontSize: 22 }, title3: { fontSize: 20 }, headline: { fontSize: 17 }, eyebrow: {} },
      usePalette: () => p, useReduceMotion: () => true, useCurrentDay: () => '2026-09-22' },
    './categories': {}, './category-color': { tintOf: () => '#EEE' }, './category-hues': { useAccountLook: () => ({ glyph: 'wallet-outline', hex: '#2557D6' }), useCategoryLook: () => ({ glyph: 'pricetag-outline', hex: '#3E6FB0', label: 'x' }), useAccountLookOf: () => () => ({ glyph: 'wallet-outline', hex: '#2557D6' }), useCategoryDefinitions: () => [] },
    './geometry': { SEGMENT_GAP: 2, SEGMENT_PADDING: 2, amountFieldLayout: () => ({}), fitFontSize: () => 17, segmentLayout: () => ({}) },
    './motion': { duration: { press: 100, release: 160 }, easeOut: 'ease', selectionHaptic: () => haptics.push('selection'), timing: () => ({}) },
    './money-input': { EMPTY_AMOUNT: '', amountFromCanonical: () => '', readAmountChange: () => ({}), renderAmount: () => ({ text: '', caret: 0 }), settleAmount: () => ({}), splitAmount: () => null },
    './presentation': {}, './currencies': { CURRENCIES, currencyOption, searchCurrencies },
    './components': Object.fromEntries(['AccountBadge', 'AppText', 'CategoryBadge', 'DetailRow', 'Field', 'GlyphTile', 'PressFeedback', 'Surface'].map(name => [name, name])),
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
  assert.deepEqual(ui.alerts, [{ title: 'Saldo inicial', message: 'La explicación completa.' }]);
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

test('the currency row shows name and code, opens a sheet with the two ledger currencies and a checkmark, and ticks once on a change', () => {
  const ui = load('form-controls.tsx');
  const chosen: string[] = [];
  let field = ui.render('CurrencyField', { value: 'ARS', onChange: (code: string) => chosen.push(code) });
  const row = nodes(field).find(node => node.type === 'DetailRow')!;
  assert.equal(row.props.label, 'Moneda');
  assert.equal(row.props.value, 'Pesos argentinos · ARS');
  assert.equal(row.props.icon, 'cash-outline');
  assert.equal(row.props.last, true);
  const sheet = nodes(field).find(node => node.type === 'Modal')!;
  assert.equal(sheet.props.visible, false);
  row.props.onPress();
  field = ui.render('CurrencyField', { value: 'ARS', onChange: (code: string) => chosen.push(code) });
  assert.equal(nodes(field).find(node => node.type === 'Modal')!.props.visible, true);
  assert.equal(nodes(field).find(node => node.type === 'Modal')!.props.presentationStyle, 'pageSheet');
  const list = nodes(field).find(node => node.type === 'FlatList')!;
  assert.deepEqual(list.props.data.map((item: any) => item.code), ['ARS', 'USD'], 'only the currencies the ledger can hold');
  const items = list.props.data.map((item: unknown) => list.props.renderItem({ item }));
  assert.deepEqual(items.map((item: Node) => item.props.accessibilityLabel), ['Pesos argentinos, ARS', 'Dólares estadounidenses, USD']);
  assert.deepEqual(items.map((item: Node) => item.props.accessibilityState.selected), [true, false]);
  assert.ok(nodes(items[0]).some(node => is(node, 'Ionicons') && node.props.name === 'checkmark-circle'), 'the current currency carries the checkmark');
  assert.equal(nodes(items[1]).some(node => is(node, 'Ionicons') && node.props.name === 'checkmark-circle'), false);
  items[1].props.onPress();
  assert.deepEqual(chosen, ['USD']);
  assert.deepEqual(ui.haptics, ['selection']);
  items[0].props.onPress();
  assert.deepEqual(ui.haptics, ['selection'], 'choosing the current currency again does not tick');
  assert.ok(nodes(list.props.ListFooterComponent).some(node => node.type === 'AppText' && /pesos o en dólares/.test(String(node.props.children))), 'the sheet says why the list is short');
  const disabled = ui.render('CurrencyField', { value: 'USD', onChange: () => {}, disabled: true });
  assert.equal(nodes(disabled).find(node => node.type === 'DetailRow')!.props.disabled, true);
  assert.equal(nodes(disabled).find(node => node.type === 'DetailRow')!.props.value, 'Dólares estadounidenses · USD');
});

test('the currency list is exactly ARS and USD, with a search helper ready for the future currency screen', () => {
  assert.deepEqual(CURRENCIES.map(option => option.code), ['ARS', 'USD']);
  assert.equal(currencyOption('USD').name, 'Dólares estadounidenses');
  assert.equal(currencyOption('EUR').code, 'ARS', 'an unknown code falls back instead of inventing a currency');
  assert.deepEqual(searchCurrencies('').map(o => o.code), ['ARS', 'USD']);
  assert.deepEqual(searchCurrencies('dol').map(o => o.code), ['USD']);
  assert.deepEqual(searchCurrencies('DÓLARES').map(o => o.code), ['USD']);
  assert.deepEqual(searchCurrencies('ars').map(o => o.code), ['ARS']);
  assert.deepEqual(searchCurrencies('euro'), []);
});
