import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as geometry from '../src/ui/geometry.ts';

const { amountWidthEm, fitFontSize } = geometry;

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
      ScrollView: 'ScrollView', StyleSheet: { create: (styles: unknown) => styles, absoluteFill: {}, hairlineWidth: 0.5 }, Text: 'Text', TextInput: 'TextInput', View: 'View',
      useWindowDimensions: () => ({ width: 393, fontScale: 1 }) },
    'react-native-reanimated': { __esModule: true, default: { View: 'Animated.View', Text: 'Animated.Text' }, useSharedValue: (value: number) => ({ value }),
      withTiming: (value: number) => value, useAnimatedStyle: (fn: () => unknown) => fn() },
    '@expo/vector-icons/Ionicons': 'Ionicons',
    '@finanzapp/domain': { formatMinorUnits: (minor: number) => (minor / 100).toLocaleString('es-AR', { minimumFractionDigits: 2 }), accountBalanceMinor: () => 0, labelFromISO: () => '' },
    'expo-router': { router: {} },
    './theme': { radius: {}, space: {}, type: {}, useCurrentDay: () => '2026-09-20', useReduceMotion: () => true, usePalette: () => ({ text: '#000', income: '#080', transfer: '#03c', warning: '#a60' }) },
    './categories': { categoryIcon: () => 'pricetag-outline' },
    './category-color': { tintOf: (c: string) => c }, './category-hues': { useCategoryColor: () => '#111' },
    './geometry': geometry, './motion': { duration: {}, easeOut: {}, selectionHaptic: () => {}, timing: () => ({}) },
  };
  const module = { exports: {} as { Money?: (props: any) => any } };
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
  assert.equal(text.props.children, '$ 999.999.999,99');
  assert.equal(text.props.style.fontSize, 40, 'sized from the measured width');
  assert.equal(text.props.style.lineHeight, Math.round(40 * 1.18));
  assert.equal(text.props.maxFontSizeMultiplier, 1.4);
  const row = render({ minor: 1234, currency: 'USD' });
  assert.equal(row.type, 'Text', 'a row amount is a plain text');
  assert.equal(row.props.adjustsFontSizeToFit, true);
  assert.equal(row.props.minimumFontScale, 0.75);
  assert.equal(row.props.style.lineHeight, undefined, 'no fixed line height for the native fit');
  assert.equal(row.props.style.fontSize, 17);
});
