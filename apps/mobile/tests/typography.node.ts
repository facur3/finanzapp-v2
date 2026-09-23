import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as geometry from '../src/ui/geometry.ts';
import * as moneyInput from '../src/ui/money-input.ts';
import { bindLocale } from '../src/i18n/bind.ts';

const { AMOUNT_FIELD, amountFieldLayout, amountWidthEm, fitFontSize } = geometry;
const { displayAmount } = moneyInput;

// Responsive financial typography: a hero amount is one line, dominant, and
// shrinks only as much as its width requires. Regression for the iPhone
// report where a long ARS amount collapsed to a few points.
const PHONE = 393 - 40; // content width on the reported iPhone 14 Pro
const cases: [string, number][] = [
  ['$ 0,00', 44], ['$ 2.000,00', 44], ['$ 200.000,00', 44], ['$ 4.006.331,00', 44],
  ['$ 999.999.999,99', 40], ['US$ 999.999.999,99', 34.5],
];

test('hero amounts stay at full size until they need the width, then shrink gradually and never below half', () => {
  for (const [text, expected] of cases) assert.equal(fitFontSize(text, PHONE, 44, 22), expected, text);
  const sizes = cases.map(([text]) => fitFontSize(text, PHONE, 44, 22));
  for (let index = 1; index < sizes.length; index++) assert.ok(sizes[index] <= sizes[index - 1], 'longer amounts never grow');
  assert.equal(fitFontSize('US$ 999.999.999,99', 200, 44, 22), 22, 'the floor holds on a narrow container');
  assert.equal(fitFontSize('US$ 999.999.999,99', 0, 44, 22), 44, 'before layout the base size renders');
  assert.equal(fitFontSize('$ 0,00', 5000, 44, 22), 44, 'a wide container never enlarges past the base');
});

test('Dynamic Type is part of the fit: the rendered width uses the capped system scale', () => {
  assert.equal(fitFontSize('$ 4.006.331,00', PHONE, 44, 22, 1.4), 33.5);
  assert.equal(fitFontSize('US$ 999.999.999,99', PHONE, 44, 22, 1.4), 24.5);
  assert.ok(amountWidthEm('US$ 1,00') > amountWidthEm('$ 1,00'));
  assert.ok(amountWidthEm('−$ 1,00') > amountWidthEm('$ 1,00'), 'the sign takes width too');
});

// The amount field: the symbol is anchored, the digits grow from a fixed
// origin, and the size steps down only when the row is full. Regression for
// the iPhone reports where the caret overlapped the "0" of "3.000" in a field
// sized around its own text, and where the centred number and its estimated
// symbol position shifted at every digit and grouping dot.
const DISPLAYS = ['3', '30', '300', '3.000', '30.000', '300.000', '3.000.000', '3.000.000,50', '9.999.999.999.999,99'];
test('the amount field has no text-dependent position: only a size, identical for every amount that fits, dropping exactly when the row is full', () => {
  for (const symbol of ['$', 'US$']) {
    const typing = DISPLAYS.slice(0, 7); // 3 … 3.000.000
    const boxes = typing.map(text => amountFieldLayout(text, PHONE, symbol, 6));
    for (const box of boxes) assert.equal(Object.keys(box).sort().join(','), 'fontSize,symbolSize', `${symbol}: the layout is a size, never a position or an inset`);
    assert.ok(boxes.every(box => box.fontSize === AMOUNT_FIELD.base && box.symbolSize === boxes[0].symbolSize), `${symbol}: 3 … 3.000.000 all render at the base size on the reported iPhone`);
    // The two transitions that used to move everything: nothing about the layout changes.
    assert.deepEqual(amountFieldLayout('999', PHONE, symbol, 6), amountFieldLayout('1.000', PHONE, symbol, 6), symbol + ': 999 → 1.000');
    assert.deepEqual(amountFieldLayout('999.999', PHONE, symbol, 6), amountFieldLayout('1.000.000', PHONE, symbol, 6), symbol + ': 999.999 → 1.000.000');
    for (const text of DISPLAYS) {
      const box = amountFieldLayout(text, PHONE, symbol, 6);
      const room = geometry.amountTextRoom(PHONE, symbol, box.symbolSize, 6);
      assert.ok(room >= amountWidthEm(text) * box.fontSize, `${symbol} ${text} fits beside the symbol, the gap and the caret`);
      const atBase = amountWidthEm(text) * AMOUNT_FIELD.base;
      assert.ok(box.fontSize < AMOUNT_FIELD.base ? atBase > geometry.amountTextRoom(PHONE, symbol, geometry.amountSymbolSize(AMOUNT_FIELD.base), 6) : true,
        `${symbol} ${text}: the size drops only because the text would not fit at the base size`);
    }
  }
  const longest = amountFieldLayout('9.999.999.999.999,99', PHONE, '$', 6);
  assert.ok(longest.fontSize < AMOUNT_FIELD.base && longest.fontSize >= AMOUNT_FIELD.min, 'the longest safe amount shrinks to fit, never below the floor');
  assert.equal(amountFieldLayout('3.000.000,50', PHONE, '$', 6).fontSize, 46, 'a full price still fits at the base size');
  assert.deepEqual(amountFieldLayout('', PHONE, '$', 6), amountFieldLayout('0', PHONE, '$', 6), 'an empty field is laid out for its placeholder');
  assert.deepEqual(amountFieldLayout('3.000', 0, '$', 6), { fontSize: 46, symbolSize: 32 }, 'before layout the base size renders');
  // Dynamic Type: the capped scale is part of the fit; a larger scale can only shrink.
  const large = amountFieldLayout('3.000.000,50', PHONE, '$', 6, 1.4);
  assert.ok(large.fontSize < 46 && large.symbolSize <= 32);
  assert.equal(amountFieldLayout('3.000', PHONE, '$', 6, 1.4).fontSize, 46, 'a short amount keeps the base size at large text');
  // Fast entry: thirteen digits typed one by one never grow the size back, and each step keeps the layout of the previous one until the row fills.
  let previous: number = AMOUNT_FIELD.base, firstDrop = 0;
  for (let index = 1; index <= 13; index++) {
    const { fontSize } = amountFieldLayout(displayAmount('9'.repeat(index)), PHONE, 'US$', 6);
    assert.ok(fontSize <= previous, index + ' digits never enlarge the amount');
    if (fontSize < previous && !firstDrop) firstDrop = index;
    previous = fontSize;
  }
  assert.ok(firstDrop >= 8, 'seven digits with their grouping keep the base size; the size only steps down once the row is full: ' + firstDrop);
});

test('AmountField anchors the symbol before a left-aligned input that fills the row: no transform, no centring, tabular figures, one accessible name', () => {
  const { render } = loadComponents();
  const changes: string[] = [];
  let field = render('AmountField', { label: 'Gasto', currency: 'ARS', value: '', onChangeText: (text: string) => changes.push(text) });
  const rowOf = (node: any) => node.props.children.find((child: any) => child?.props?.onLayout);
  let row = rowOf(field);
  assert.equal(row.props.style.flexDirection, 'row', 'symbol and input share one row');
  const [symbol, input] = row.props.children;
  assert.equal(symbol.props.children, '$');
  assert.equal(symbol.props.accessible, false, 'the symbol is decoration; the field carries the name');
  assert.equal(symbol.props.style.transform, undefined, 'the symbol is placed by flexbox, never translated by an estimate');
  assert.equal(input.type, 'TextInput');
  const style = flatten(input.props.style);
  assert.equal(style.textAlign, 'left');
  assert.equal(style.flex, 1, 'the input takes the rest of the row, whatever the text');
  assert.equal(style.paddingLeft, 0, 'the digits start at a fixed origin right after the symbol');
  assert.equal(style.paddingRight, 4, 'the caret keeps its room');
  assert.equal(JSON.stringify(style.fontVariant), '["tabular-nums"]');
  assert.equal(style.fontSize, 46, 'the base size before layout');
  assert.equal(input.props.accessibilityLabel, 'Gasto en pesos argentinos');
  assert.equal(input.props.maxFontSizeMultiplier, 1.4);
  row.props.onLayout({ nativeEvent: { layout: { width: PHONE } } });
  // Typing 999 → 1.000 and 999.999 → 1.000.000: the rendered style is identical, the symbol untouched.
  for (const [before, after] of [['999', '1.000'], ['999.999', '1.000.000']]) {
    const a = render('AmountField', { label: 'Gasto', currency: 'ARS', value: before, onChangeText: () => {} });
    const b = render('AmountField', { label: 'Gasto', currency: 'ARS', value: after, onChangeText: () => {} });
    assert.equal(JSON.stringify(flatten(rowOf(a).props.children[1].props.style)), JSON.stringify(flatten(rowOf(b).props.children[1].props.style)), before + ' → ' + after);
    assert.equal(JSON.stringify(rowOf(a).props.children[0].props.style), JSON.stringify(rowOf(b).props.children[0].props.style));
  }
  // A keystroke goes through the canonical model and comes back formatted with the caret after the same digit.
  field = render('AmountField', { label: 'Gasto', currency: 'ARS', value: '', onChangeText: (text: string) => changes.push(text) });
  rowOf(field).props.children[1].props.onChange({ nativeEvent: { text: '1000', selection: { start: 4, end: 4 } } });
  assert.deepEqual(changes, ['1.000']);
  field = render('AmountField', { label: 'Gasto', currency: 'ARS', value: '1.000', onChangeText: (text: string) => changes.push(text) });
  assert.equal(JSON.stringify(rowOf(field).props.children[1].props.selection), '{"start":5,"end":5}', 'the caret sits after the last digit, past the new dot');
  const dollars = render('AmountField', { label: 'Pago', currency: 'USD', value: '12,5', onChangeText: () => {}, tone: 'transfer' });
  assert.equal(rowOf(dollars).props.children[0].props.children, 'US$', 'changing the currency only changes the anchored symbol');
  assert.equal(rowOf(dollars).props.children[1].props.accessibilityLabel, 'Pago en dólares');
  assert.equal(flatten(rowOf(dollars).props.children[1].props.style).color, '#03c', 'the tone colours the digits');
  const untitled = render('AmountField', { currency: 'ARS', value: '', onChangeText: () => {} });
  assert.equal(untitled.props.children[0].props.children.join(''), 'Monto · ARS', 'the default label comes from the catalogue');
});

// The Money component itself: heroes measure their container and size from it;
// rows keep the native fit without a fixed line height.
function loadComponents() {
  const source = readFileSync(new URL('../src/ui/components.tsx', import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const jsx = (type: any, props: any) => ({ type, props });
  const state: unknown[] = [];
  let cursor = 0;
  const modules: Record<string, any> = {
    react: { useEffect: () => {}, useId: () => 'id', useRef: (value: unknown) => ({ current: value }),
      useState: (initial: unknown) => { const index = cursor++; if (!(index in state)) state[index] = initial;
        return [state[index], (value: unknown) => { state[index] = value; }]; } },
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'react-native': { ActivityIndicator: 'ActivityIndicator', InputAccessoryView: 'InputAccessoryView', Keyboard: {}, Platform: { OS: 'ios' }, Pressable: 'Pressable',
      ScrollView: 'ScrollView', StyleSheet: { create: (styles: unknown) => styles, absoluteFill: {}, hairlineWidth: 0.5, flatten: (style: any) => Object.assign({}, ...[style].flat(Infinity).filter(Boolean)) }, Text: 'Text', TextInput: 'TextInput', View: 'View',
      useWindowDimensions: () => ({ width: 393, fontScale: 1 }) },
    'react-native-reanimated': { __esModule: true, default: { View: 'Animated.View', Text: 'Animated.Text' }, useSharedValue: (value: number) => ({ value }),
      withTiming: (value: number) => value, useAnimatedStyle: (fn: () => unknown) => fn() },
    '@expo/vector-icons/Ionicons': 'Ionicons',
    '@finanzapp/domain': { formatMinorUnits: (minor: number) => (minor / 100).toLocaleString('es-AR', { minimumFractionDigits: 2 }), accountBalanceMinor: () => 0, labelFromISO: () => '' },
    'expo-router': { router: {} },
    './theme': { radius: {}, space: {}, type: { body: { fontSize: 17, lineHeight: 22 } }, useCurrentDay: () => '2026-09-20', useReduceMotion: () => true, usePalette: () => ({ text: '#000', secondary: '#666', tertiary: '#999', income: '#008800', transfer: '#03c', warning: '#a60' }) },
    './categories': { categoryIcon: () => 'pricetag-outline' },
    './category-color': { tintOf: (c: string) => c }, './category-hues': { useCategoryColor: () => '#111', useCategoryLook: (label: string) => ({ label, hex: '#111', glyph: 'pricetag-outline' }), useAccountLook: () => ({ glyph: 'wallet-outline', hex: '#2557D6' }) },
    './geometry': geometry, './money-input': moneyInput, './motion': { duration: {}, easeOut: {}, selectionHaptic: () => {}, timing: () => ({}) },
    '../i18n/provider': { useI18n: () => bindLocale('es-AR') },
  };
  const module = { exports: {} as Record<string, (props: any) => any> };
  runInNewContext(code, { module, exports: module.exports, require: (name: string) => {
    if (!Object.hasOwn(modules, name)) throw new Error('Unexpected components dependency: ' + name);
    return modules[name];
  } });
  return { module, render: (component: string, props: any) => { cursor = 0; return module.exports[component]!(props); } };
}
const flatten = (style: any) => Object.assign({}, ...[style].flat(Infinity).filter(Boolean));

test('Money sizes a hero from its measured width and leaves rows to the native fit', () => {
  const { module, render: renderAny } = loadComponents();
  const render = (props: any) => renderAny('Money', props);
  let hero = render({ minor: 99999999999, currency: 'ARS', large: true });
  assert.equal(hero.type, 'View', 'a hero measures a stretched wrapper');
  assert.equal(hero.props.style.alignSelf, 'stretch');
  let text = hero.props.children;
  assert.equal(text.props.style.fontSize, 44, 'base size before layout');
  assert.equal(text.props.adjustsFontSizeToFit, false, 'no native shrink-to-fit on a hero');
  assert.equal(text.props.numberOfLines, 1);
  hero.props.onLayout({ nativeEvent: { layout: { width: PHONE } } });
  hero = render({ minor: 99999999999, currency: 'ARS', large: true });
  text = hero.props.children;
  // One amount, three quiet levels: the symbol and the cents are nested spans in the same size and baseline.
  const [symbol, whole, cents] = text.props.children.props.children;
  assert.equal(symbol.props.children + whole + cents.props.children, '$ 999.999.999,99', 'the parts are the whole string');
  assert.equal(symbol.type, 'Text'); assert.equal(cents.type, 'Text');
  assert.equal(symbol.props.style.color, '#666', 'the symbol steps back to secondary');
  assert.equal(cents.props.style.color, '#999', 'the cents step back to tertiary');
  assert.equal(symbol.props.style.fontSize, undefined, 'no size change: the fit and the baseline stay one');
  assert.equal(text.props.accessibilityLabel, '999.999.999,99 pesos', 'VoiceOver reads one amount');
  assert.equal(text.props.style.fontSize, 40, 'sized from the measured width');
  assert.equal(text.props.style.lineHeight, Math.round(40 * 1.18));
  assert.equal(text.props.maxFontSizeMultiplier, 1.4);
  const income = render({ minor: 1234, currency: 'USD', large: true, signed: true, tone: 'income' }).props.children;
  const [greenSymbol, greenWhole, greenCents] = income.props.children.props.children;
  assert.equal(greenSymbol.props.children + greenWhole + greenCents.props.children, '+US$ 12,34');
  assert.equal(greenSymbol.props.style.color, '#008800B3', 'a coloured hero keeps its hue and only lowers the alpha');
  assert.equal(income.props.style.color, '#008800');
  // Regression for the clipped category title: a larger fontSize on the body variant must not keep the 22 pt line box.
  const heading = flatten(module.exports.AppText!({ children: 'Comida', style: { fontSize: 26, fontWeight: '700' } }).props.style);
  assert.equal(heading.fontSize, 26);
  assert.ok(heading.lineHeight >= 26 * 1.2, 'the line box grows with the font');
  const explicit = flatten(module.exports.AppText!({ children: 'x', style: { fontSize: 26, lineHeight: 40 } }).props.style);
  assert.equal(explicit.lineHeight, 40, 'an explicit line height is respected');
  const body = flatten(module.exports.AppText!({ children: 'x' }).props.style);
  assert.equal(body.lineHeight, 22, 'the variant line box stays when nothing overrides the size');
  const row = render({ minor: 1234, currency: 'USD' });
  assert.equal(row.type, 'Text', 'a row amount is a plain text');
  assert.equal(row.props.children, 'US$ 12,34', 'row amounts stay one plain string');
  assert.equal(row.props.adjustsFontSizeToFit, true);
  assert.equal(row.props.minimumFontScale, 0.75);
  assert.equal(row.props.style.lineHeight, undefined, 'no fixed line height for the native fit');
  assert.equal(row.props.style.fontSize, 17);
});
