import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as domain from '@finanzapp/domain';
import * as presentation from '../src/ui/report-presentation.ts';
import * as i18nFormat from '../src/i18n/format.ts';
import { bindLocale } from '../src/i18n/bind.ts';
const i18nProvider = { useI18n: () => bindLocale('es-AR') };

// A source/behavior guard over the actual component; animation timing/visual
// quality and VoiceOver are still physical-device acceptance items.
test('bars retain real proportions, animate data changes only, and honor reduced motion', () => {
  const source = readFileSync(new URL('../src/ui/spending-chart.tsx', import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const jsx = (type: any, props: any) => ({ type, props });
  let reduced = false;
  let previousDeps: unknown[] = [];
  let shared: { value: number } | undefined;
  let effect: (() => any) | undefined;
  const timings: { value: number; duration: number }[] = [];
  const modules: Record<string, any> = {
    '../i18n/format': i18nFormat, '../src/i18n/format': i18nFormat, '../../src/i18n/format': i18nFormat, '../i18n/provider': i18nProvider, '../src/i18n/provider': i18nProvider, '../../src/i18n/provider': i18nProvider,
    react: { useEffect: (fn: () => any, deps: unknown[]) => {
      if (deps.some((dep, index) => dep !== previousDeps[index])) { previousDeps = deps; effect = fn; }
    } },
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': { View: 'View', useWindowDimensions: () => ({ fontScale: 1, width: 393 }), StyleSheet: { hairlineWidth: 0.5 } },
    'react-native-reanimated': { __esModule: true, default: { View: 'AnimatedView' },
      useSharedValue: (value: number) => shared ??= { value }, useAnimatedStyle: (fn: () => any) => fn,
      withTiming: (value: number, options: { duration: number }) => { timings.push({ value, duration: options.duration }); return value; }, cancelAnimation: () => {} },
    '@expo/vector-icons/Ionicons': 'Icon', '@finanzapp/domain': domain,
    './components': { AppText: 'AppText', CategoryBadge: 'CategoryBadge', Money: 'Money', PressFeedback: 'PressFeedback', useStacked: () => false },
    './report-presentation': presentation,
    './category-hues': { useCategoryColor: () => '#3E6FB0', useCategoryLabel: (s: string) => s, useCategoryDefinitions: () => [], useCategoryLook: (s: string) => ({ label: s, storedLabel: s, key: String(s).toLowerCase(), hex: '#3E6FB0', glyph: 'pricetag-outline' }), useCategoryLookOf: () => (s: string) => ({ label: s, storedLabel: s, key: String(s).toLowerCase(), hex: '#3E6FB0', glyph: 'pricetag-outline' }), useAccountLook: () => ({ icon: 'wallet', color: 'cobalt', glyph: 'wallet-outline', hex: '#2557D6' }), useAccountNameOf: () => (account: any) => account.name, useAccountLookOf: () => () => ({ icon: 'wallet', color: 'cobalt', glyph: 'wallet-outline', hex: '#2557D6' }) },
    './motion': { timing: (kind: string, isReduced: boolean) => ({ duration: isReduced ? 0 : 260 }) },
    './theme': { useReduceMotion: () => reduced, usePalette: () => ({ text: '#000', inset: '#ECEFF4' }) },
  };
  const module = { exports: {} as { CategorySpendingRow?: (props: any) => any } };
  runInNewContext(code, { module, exports: module.exports, require: (name: string) => {
    if (!Object.hasOwn(modules, name)) throw new Error('Unexpected chart dependency: ' + name);
    return modules[name];
  } });
  const category = { key: 'comida', category: 'Comida', amountMinor: 300, count: 1 };
  const row = module.exports.CategorySpendingRow!({ category, totalMinor: 1000, currency: 'ARS', onPress: () => {} });
  assert.equal(row.props.accessibilityRole, 'button');
  assert.match(row.props.accessibilityLabel, /30\u00A0% del gasto del mes/);
  const bar = row.props.children[1].props.children[1];
  assert.equal(bar.props.fraction, 0.3);
  let view = bar.type(bar.props);
  assert.equal(shared!.value, 0.3, 'first frame uses the actual proportion, not zero');
  assert.equal(view.props.accessibilityElementsHidden, true);
  effect!(); effect = undefined;
  assert.equal(view.props.children.props.style[1]().width, '30%');
  view = bar.type({ fraction: 0.6 });
  effect!(); effect = undefined;
  assert.equal(timings.at(-1)!.duration, 260);
  assert.equal(view.props.children.props.style[1]().width, '60%');
  bar.type({ fraction: 0.6 });
  assert.equal(effect, undefined, 'returning with the same data must not replay');
  reduced = true;
  bar.type({ fraction: 0.5 });
  effect!();
  assert.equal(timings.at(-1)!.duration, 0);
});

// 23.1C2: the month bars and the donut in charts.tsx. The axis keeps the short
// month; VoiceOver hears the full name ("mar" or "may" alone reads as a word).
function chartsModule(i18n: ReturnType<typeof bindLocale>) {
  const source = readFileSync(new URL('../src/ui/charts.tsx', import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const jsx = (type: any, props: any) => ({ type, props });
  const modules: Record<string, any> = {
    '../i18n/provider': { useI18n: () => i18n },
    react: { useEffect: () => {}, useMemo: (fn: () => any) => fn(), useRef: (value: any) => ({ current: value }) },
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': { View: 'View', StyleSheet: { absoluteFill: {}, hairlineWidth: 0.5 } },
    'react-native-reanimated': { __esModule: true, default: { View: 'AnimatedView', Text: 'AnimatedText', createAnimatedComponent: (c: any) => 'Animated(' + c + ')' },
      useSharedValue: (value: number) => ({ value }), useAnimatedStyle: (fn: () => any) => fn, useAnimatedProps: (fn: () => any) => fn, withTiming: (value: number) => value },
    'react-native-svg': { __esModule: true, default: 'Svg', Circle: 'Circle', Path: 'Path' },
    './components': { AppText: 'AppText', Money: 'Money', PressFeedback: 'PressFeedback' },
    './category-color': { categoryColor: () => '#111', othersColor: () => '#ccc' },
    './motion': { ValueTransition: 'ValueTransition', duration: { state: 200, data: 260, reveal: 480 }, timing: () => ({ duration: 0 }) },
    './theme': { useReduceMotion: () => true, usePalette: () => ({ inset: '#eee', text: '#000', secondary: '#666', primary: '#2557D6' }) },
  };
  const module = { exports: {} as Record<string, (props: any) => any> };
  runInNewContext(code, { module, exports: module.exports, require: (name: string) => {
    if (!Object.hasOwn(modules, name)) throw new Error('Unexpected chart dependency: ' + name);
    return modules[name];
  } });
  return module.exports;
}
const flat = (value: any): any[] => !value || typeof value !== 'object' ? [] : Array.isArray(value) ? value.flatMap(flat) : [value, ...flat(value.props?.children)];

test('24B1: the MonthBars scale caption for ARS and USD, whole units from cents, in the four locales', () => {
  const points = [{ monthISO: '2026-03', amountMinor: 123456789, partial: false }, { monthISO: '2026-05', amountMinor: 50, partial: true }];
  const caption = (locale: Parameters<typeof bindLocale>[0], currency: 'ARS' | 'USD') => {
    const chart = chartsModule(bindLocale(locale)).MonthBars({ points, selected: '2026-05', onSelect: () => {}, currency });
    return flat(chart).filter(node => node.type === 'AppText').map(node => node.props.children).find(text => /escala|scale/.test(String(text)));
  };
  assert.equal(caption('es-AR', 'ARS'), 'Mes en curso hasta hoy · escala de 0 a $\u00A01.234.568');
  assert.equal(caption('es-AR', 'USD'), 'Mes en curso hasta hoy · escala de 0 a US$\u00A01.234.568');
  assert.equal(caption('en-US', 'ARS'), 'Month to date · scale 0 to AR$\u00A01,234,568');
  assert.equal(caption('en-US', 'USD'), 'Month to date · scale 0 to US$\u00A01,234,568');
  assert.equal(caption('en-AR', 'ARS'), 'Month to date · scale 0 to $\u00A01.234.568');
  assert.equal(caption('es-US', 'USD'), 'Mes en curso hasta hoy · escala de 0 a US$\u00A01,234,568');
});

test('23.1C2: a month bar speaks the full month name and the axis keeps the short one', () => {
  const points = [{ monthISO: '2026-03', amountMinor: 123456, partial: false }, { monthISO: '2026-05', amountMinor: 50000, partial: true }];
  const read = (i18n: ReturnType<typeof bindLocale>) => {
    const chart = chartsModule(i18n).MonthBars({ points, selected: '2026-05', onSelect: () => {}, currency: 'ARS' });
    const bars = flat(chart).filter(node => typeof node.type === 'function').map(node => node.type(node.props));
    const axis = flat(chart).filter(node => node.type === 'AnimatedText');
    return { labels: bars.map(bar => bar.props.accessibilityLabel), axis: axis.map(node => node.props.children), languages: axis.map(node => node.props.accessibilityLanguage) };
  };
  const spanish = read(bindLocale('es-AR'));
  assert.deepEqual(spanish.labels, ['marzo 2026, 1234,56 pesos', 'mayo 2026, 500,00 pesos, mes en curso']);
  assert.deepEqual(spanish.axis, ['mar', 'may']);
  assert.deepEqual(spanish.languages, [undefined, undefined], 'a device in the interface language keeps its own voice');
  const english = read(bindLocale('en-US', 'native', 'es'));
  assert.deepEqual(english.labels, ['March 2026, 1234.56 pesos', 'May 2026, 500.00 pesos, month in progress']);
  assert.deepEqual(english.axis, ['Mar', 'May']);
  assert.deepEqual(english.languages, ['en', 'en'], 'English chosen on a Spanish iPhone: the axis is read with an English voice');
  const donut = (i18n: ReturnType<typeof bindLocale>) => chartsModule(i18n).DonutChart({ slices: [{ key: 'a', label: 'Food', value: 1, color: '#1' }], total: 1, currency: 'ARS', caption: 'Total' }).props.children[0];
  assert.equal(donut(bindLocale('en-US', 'native', 'es')).props.accessibilityLanguage, 'en');
  assert.equal(donut(bindLocale('es-AR', 'native', 'es')).props.accessibilityLanguage, undefined);
});
