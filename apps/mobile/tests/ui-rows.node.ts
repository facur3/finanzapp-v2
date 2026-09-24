import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { CURRENCIES, currencyOption, currencyOptions, searchCurrencies } from '../src/ui/currencies.ts';
import { bindLocale } from '../src/i18n/bind.ts';
import * as geometry from '../src/ui/geometry.ts';
import { formatMinorUnits } from '@finanzapp/domain';

// Producto 22.1: the row and field components at source level (React Native
// replaced by descriptors). Structure, hierarchy and labels are checked here;
// wrapping at Dynamic Type sizes and narrow widths needs the iPhone.
type Node = { type: any; props: Record<string, any> };
function load(file: string, extra: Record<string, unknown> = {}, fontScale = 1) {
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
      useEffect: () => {}, useId: () => 'id', useRef: (initial: unknown) => ({ current: initial }), useMemo: (fn: () => unknown) => fn(),
      Children: { map: (children: unknown, fn: (child: unknown) => unknown) => (Array.isArray(children) ? children : [children]).map(fn) } },
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'react-native': { View: 'View', Text: 'Text', TextInput: 'TextInput', ScrollView: 'ScrollView', Pressable: 'Pressable', ActivityIndicator: 'ActivityIndicator', InputAccessoryView: 'InputAccessoryView',
      FlatList: 'FlatList', Modal: 'Modal', Platform: { OS: 'ios' }, Keyboard: { dismiss() {} }, StyleSheet: { hairlineWidth: 0.5, create: (styles: unknown) => styles, flatten: (style: any) => Object.assign({}, ...(Array.isArray(style) ? style.flat(Infinity).filter(Boolean) : [style])), absoluteFill: {} },
      useWindowDimensions: () => ({ fontScale, width: 390, height: 844 }), Alert: { alert: (title: string, message: string) => alerts.push({ title, message }) } },
    'react-native-reanimated': { __esModule: true, default: { View: 'Animated.View', Text: 'Animated.Text' }, useSharedValue: (value: number) => ({ value }), withTiming: (value: number) => value, useAnimatedStyle: (fn: () => unknown) => fn() },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
    '@react-native-community/datetimepicker': 'DateTimePicker',
    '@expo/vector-icons/Ionicons': 'Ionicons',
    'expo-router': { router: { push: () => {} } },
    '@finanzapp/domain': { accountBalanceMinor: () => 0, formatMinorUnits, labelFromISO: (d: string) => d, categoryKey: (s: string) => s.toLowerCase(), todayKey: (d: Date) => d.toISOString().slice(0, 10) },
    '../i18n/provider': { useI18n: () => bindLocale('es-AR') },
    './theme': { radius: { chip: 14, tile: 12, group: 16, card: 20, sheet: 24, creditCard: 18, button: 14 }, space: { xs: 4, s: 8, m: 12, l: 16, xl: 20, xxl: 24, xxxl: 32 },
      type: { body: { fontSize: 17 }, subhead: { fontSize: 15 }, footnote: { fontSize: 13 }, caption: { fontSize: 12 }, title2: { fontSize: 22 }, title3: { fontSize: 20 }, headline: { fontSize: 17 }, eyebrow: {} },
      usePalette: () => p, useReduceMotion: () => true, useCurrentDay: () => '2026-09-22' },
    './categories': {}, './category-color': { tintOf: () => '#EEE' }, './category-hues': { useAccountLook: () => ({ glyph: 'wallet-outline', hex: '#2557D6' }), useCategoryLook: () => ({ glyph: 'pricetag-outline', hex: '#3E6FB0', label: 'x' }), useAccountNameOf: () => (account: any) => account.name, useAccountLookOf: () => () => ({ glyph: 'wallet-outline', hex: '#2557D6' }), useCategoryDefinitions: () => [] },
    './geometry': geometry,
    './motion': { duration: { press: 100, release: 160 }, easeOut: 'ease', selectionHaptic: () => haptics.push('selection'), timing: () => ({}) },
    './money-input': { EMPTY_AMOUNT: '', amountFromCanonical: () => '', readAmountChange: () => ({}), renderAmount: () => ({ text: '', caret: 0 }), settleAmount: () => ({}), splitAmount: () => null },
    './presentation': {}, './currencies': { CURRENCIES, currencyOption, searchCurrencies },
    './components': Object.fromEntries(['AccountBadge', 'AppText', 'CategoryBadge', 'DetailRow', 'SelectionRow', 'Field', 'GlyphTile', 'PressFeedback', 'Surface'].map(name => [name, name])),
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
  assert.ok(nodes(list.props.ListFooterComponent).some(node => node.type === 'AppText' && /pesos o en dólares/.test(String(node.props.children))), 'the sheet says why the list is short');
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
  assert.equal(currencyOption('USD', 'en-US').name, 'US dollars', 'the name follows the interface language; code and symbol do not');
  assert.deepEqual(currencyOptions('en-US').map(option => option.code + ' ' + option.symbol), ['ARS $', 'USD US$']);
  assert.equal(currencyOption('EUR').code, 'ARS', 'an unknown code falls back instead of inventing a currency');
  assert.deepEqual(searchCurrencies('').map(o => o.code), ['ARS', 'USD']);
  assert.deepEqual(searchCurrencies('dol').map(o => o.code), ['USD']);
  assert.deepEqual(searchCurrencies('DÓLARES').map(o => o.code), ['USD']);
  assert.deepEqual(searchCurrencies('ars').map(o => o.code), ['ARS']);
  assert.deepEqual(searchCurrencies('euro'), []);
});
