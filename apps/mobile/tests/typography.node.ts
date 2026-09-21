import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as geometry from '../src/ui/geometry.ts';
import * as moneyInput from '../src/ui/money-input.ts';

const { AMOUNT_FIELD, amountFieldLayout, amountWidthEm, fitFontSize } = geometry;

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

// The amount field's box: room for the last digit, the caret and a grouping
// dot that has just appeared, at every representative display string.
// Regression for the iPhone report where the caret overlapped the "0" of
// "3.000" in a field sized by the native input around its own text.
const DISPLAYS = ['3', '30', '300', '3.000', '30.000', '300.000', '3.000.000', '3.000.000,50', '9.999.999.999.999,99'];
test('the amount field box always leaves padding and caret room beyond the text, and shrinks only when the row is full', () => {
  for (const symbol of ['$', 'US$']) {
    let previous = 0;
    for (const text of DISPLAYS) {
      const { fontSize, width } = amountFieldLayout(text, PHONE, symbol, 6);
      const textWidth = amountWidthEm(text) * fontSize;
      assert.ok(width! - textWidth >= AMOUNT_FIELD.padding * 2 + AMOUNT_FIELD.caret - 1, `${symbol} ${text}: ${width} for ${textWidth.toFixed(1)} of text at ${fontSize}`);
      assert.ok(width! + amountWidthEm(symbol) * geometry.amountSymbolSize(fontSize) + 6 <= PHONE + 1, `${symbol} ${text} fits the row with its symbol`);
      assert.ok(fontSize >= AMOUNT_FIELD.min && fontSize <= AMOUNT_FIELD.base);
      const atBase = amountWidthEm(text) * AMOUNT_FIELD.base + AMOUNT_FIELD.padding * 2 + AMOUNT_FIELD.caret + amountWidthEm(symbol) * geometry.amountSymbolSize(AMOUNT_FIELD.base) + 6;
      assert.ok(fontSize < AMOUNT_FIELD.base ? atBase > PHONE : atBase <= PHONE + 1, `${text} shrinks exactly when it would not fit the row at the base size`);
      assert.ok(width! >= previous || fontSize < AMOUNT_FIELD.base, `${text}: the box never narrows as digits and dots arrive`);
      previous = fontSize === AMOUNT_FIELD.base ? width! : 0;
    }
  }
  // Typing 3 → 3.000: a grouping dot appears and the box grows with it in the same step.
  const before = amountFieldLayout('3000', PHONE, '$', 6).width!, after = amountFieldLayout('3.000', PHONE, '$', 6).width!;
  assert.ok(after > before, 'the dot widens the box');
  assert.equal(amountFieldLayout('3.000', PHONE, '$', 6).fontSize, 46, 'a short amount keeps the base size');
  assert.equal(amountFieldLayout('3.000.000,50', PHONE, '$', 6).fontSize, 46, 'a full price still fits at the base size on the reported iPhone');
  assert.ok(amountFieldLayout('9.999.999.999.999,99', PHONE, '$', 6).fontSize < 46, 'the longest safe amount shrinks to fit');
  assert.equal(amountFieldLayout('', PHONE, '$', 6).width, amountFieldLayout('0', PHONE, '$', 6).width, 'an empty field is sized for its placeholder');
  assert.equal(amountFieldLayout('3', PHONE, '$', 6).width, AMOUNT_FIELD.minWidth, 'a lone digit gets the minimum box');
  assert.deepEqual(amountFieldLayout('3.000', 0, '$', 6), { fontSize: 46, width: undefined, symbolSize: 32 }, 'before layout: base size, no width');
  // Dynamic Type: the capped scale is part of the fit and of the box.
  const large = amountFieldLayout('3.000.000,50', PHONE, '$', 6, 1.4);
  assert.ok(large.fontSize < 46 && large.width! <= PHONE);
  assert.ok(amountFieldLayout('3.000', PHONE, '$', 6, 1.4).width! > amountFieldLayout('3.000', PHONE, '$', 6).width!);
});

// The Money component itself: heroes measure their container and size from it;
// rows keep the native fit without a fixed line height.
test('Money sizes a hero from its measured width and leaves rows to the native fit', () => {
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
    './category-color': { tintOf: (c: string) => c }, './category-hues': { useCategoryColor: () => '#111' },
    './geometry': geometry, './money-input': moneyInput, './motion': { duration: {}, easeOut: {}, selectionHaptic: () => {}, timing: () => ({}) },
  };
  const module = { exports: {} as { Money?: (props: any) => any; AppText?: (props: any) => any } };
  runInNewContext(code, { module, exports: module.exports, require: (name: string) => {
    if (!Object.hasOwn(modules, name)) throw new Error('Unexpected components dependency: ' + name);
    return modules[name];
  } });
  const render = (props: any) => { cursor = 0; return module.exports.Money!(props); };
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
  const flatten = (style: any) => Object.assign({}, ...[style].flat(Infinity).filter(Boolean));
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
