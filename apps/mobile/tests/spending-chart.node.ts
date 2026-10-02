import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as domain from '@finanzapp/domain';
import * as presentation from '../src/ui/report-presentation.ts';
import * as i18nFormat from '../src/i18n/format.ts';
import * as geometry from '../src/ui/geometry.ts';
import { bindLocale } from '../src/i18n/bind.ts';
import { DEFAULT_LOCALE, type AppLocale } from '../src/i18n/locale.ts';
const i18nProvider = { useI18n: () => bindLocale('es-AR') };
/** The real `rowAmountText` of components.tsx (the string a row amount renders, for width estimates), over the pure formatter. */
const rowAmountText = (minor: number, currency: domain.Currency, signed = false, locale: AppLocale = DEFAULT_LOCALE) =>
  Number.isSafeInteger(minor) ? i18nFormat.moneyText(minor, currency, locale, false, signed) : '—';

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
    './components': { AppText: 'AppText', CategoryBadge: 'CategoryBadge', Money: 'Money', PressFeedback: 'PressFeedback', useStacked: () => false, rowAmountText },
    './geometry': geometry,
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
/** The system text scale the charts harness reports (24UX6C2: the donut's centre readout depends on it). */
let chartFontScale = 1;
/** The window width the charts harness reports (24UX6D: the donut's default size comes from it). */
let chartWidth = 393;
function chartsModule(i18n: ReturnType<typeof bindLocale>) {
  const source = readFileSync(new URL('../src/ui/charts.tsx', import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const jsx = (type: any, props: any) => ({ type, props });
  const modules: Record<string, any> = {
    '../i18n/provider': { useI18n: () => i18n },
    react: { useEffect: () => {}, useMemo: (fn: () => any) => fn(), useRef: (value: any) => ({ current: value }) },
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'react-native': { View: 'View', Pressable: 'Pressable', StyleSheet: { absoluteFill: {}, hairlineWidth: 0.5 }, useWindowDimensions: () => ({ width: chartWidth, height: 852, fontScale: chartFontScale }) },
    './geometry': geometry,
    'react-native-reanimated': { __esModule: true, default: { View: 'AnimatedView', Text: 'AnimatedText', createAnimatedComponent: (c: any) => 'Animated(' + c + ')' },
      useSharedValue: (value: number) => ({ value }), useAnimatedStyle: (fn: () => any) => fn, useAnimatedProps: (fn: () => any) => fn, withTiming: (value: number) => value },
    'react-native-svg': { __esModule: true, default: 'Svg', Circle: 'Circle', Path: 'Path' },
    './components': { AppText: 'AppText', Money: 'Money', PressFeedback: 'PressFeedback' },
    './category-color': { categoryColor: () => '#111', othersColor: () => '#ccc' },
    './motion': { ValueTransition: 'ValueTransition', duration: { state: 200, data: 260, reveal: 480 }, timing: () => ({ duration: 0 }) },
    './theme': { useReduceMotion: () => true, usePalette: () => ({ inset: '#eee', text: '#000', secondary: '#666', tertiary: '#586961', primary: '#2557D6', isDark: false }) },
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
  const donut = (i18n: ReturnType<typeof bindLocale>) => chartsModule(i18n).DonutChart({ slices: [{ key: 'a', label: 'Food', value: 1, color: '#1' }], currency: 'ARS',
    caption: 'Total', shareOf: () => ({ label: '100 %', spoken: '100 %' }) });
  // 24UX6C2: the chart's root is an outer View (the readout can move under the donut), so the element is found by type.
  const pressOf = (tree: any) => flat(tree).find(node => node.type === 'Pressable');
  assert.equal(pressOf(donut(bindLocale('en-US', 'native', 'es'))).props.accessibilityLanguage, 'en');
  assert.equal(pressOf(donut(bindLocale('es-AR', 'native', 'es'))).props.accessibilityLanguage, undefined);
});

test('24B3: the MonthBars scale and the bar labels use each currency\'s own units: yen whole, dinars to the fil', () => {
  const points = [{ monthISO: '2026-03', amountMinor: 1234567, partial: false }, { monthISO: '2026-05', amountMinor: 5, partial: true }];
  const read = (locale: Parameters<typeof bindLocale>[0], currency: domain.Currency) => {
    const chart = chartsModule(bindLocale(locale)).MonthBars({ points, selected: '2026-05', onSelect: () => {}, currency });
    const caption = flat(chart).filter(node => node.type === 'AppText').map(node => node.props.children).find(text => /escala|scale/.test(String(text)));
    const bars = flat(chart).filter(node => typeof node.type === 'function').map(node => node.type(node.props).props.accessibilityLabel);
    return { caption, bars };
  };
  assert.deepEqual(read('es-AR', 'JPY'), { caption: 'Mes en curso hasta hoy · escala de 0 a JP¥ 1.234.567', bars: ['marzo 2026, 1234567 yenes japoneses', 'mayo 2026, 5 yenes japoneses, mes en curso'] });
  assert.deepEqual(read('en-US', 'KWD'), { caption: 'Month to date · scale 0 to KWD 1,235', bars: ['March 2026, 1234.567 Kuwaiti dinars', 'May 2026, 0.005 Kuwaiti dinars, month in progress'] });
  assert.equal(read('es-US', 'KWD').caption, 'Mes en curso hasta hoy · escala de 0 a KWD 1,235', 'the scale is whole dinars, rounded half up');
  assert.equal(read('en-AR', 'EUR').caption, 'Month to date · scale 0 to € 12.346');
  assert.equal(read('es-AR', 'CLP').bars[0], 'marzo 2026, 1234567 pesos chilenos');
});

test('24B3: a category row speaks its amount with the currency\'s own decimals and the code', () => {
  const source = readFileSync(new URL('../src/ui/spending-chart.tsx', import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const jsx = (type: any, props: any) => ({ type, props });
  const rows = (locale: Parameters<typeof bindLocale>[0]) => {
    const modules: Record<string, any> = {
      '../i18n/provider': { useI18n: () => bindLocale(locale) }, react: { useEffect: () => {} }, 'react/jsx-runtime': { jsx, jsxs: jsx },
      'react-native': { View: 'View', StyleSheet: { hairlineWidth: 0.5 }, useWindowDimensions: () => ({ fontScale: 1, width: 393 }) }, '@expo/vector-icons/Ionicons': 'Icon', '@finanzapp/domain': domain,
      'react-native-reanimated': { __esModule: true, default: { View: 'AnimatedView' }, useSharedValue: (value: number) => ({ value }), useAnimatedStyle: (fn: () => any) => fn, withTiming: (value: number) => value, cancelAnimation: () => {} },
      './components': { AppText: 'AppText', CategoryBadge: 'CategoryBadge', Money: 'Money', PressFeedback: 'PressFeedback', useStacked: () => false, rowAmountText },
      './geometry': geometry, './report-presentation': presentation, './motion': { timing: () => ({ duration: 0 }) }, './theme': { useReduceMotion: () => true, usePalette: () => ({ text: '#000', inset: '#ECEFF4', line: '#ddd', secondary: '#666', tertiary: '#999' }) },
      './category-hues': { useCategoryLook: (s: string) => ({ label: s, hex: '#3E6FB0', glyph: 'pricetag-outline' }) },
    };
    const module = { exports: {} as Record<string, (props: any) => any> };
    runInNewContext(code, { module, exports: module.exports, require: (name: string) => {
      if (!Object.hasOwn(modules, name)) throw new Error('Unexpected chart dependency: ' + name);
      return modules[name];
    } });
    return module.exports;
  };
  const category = { key: 'comida', category: 'Comida', amountMinor: 1234567, count: 2 };
  const es = rows('es-AR');
  assert.equal(es.CategorySpendingRow({ category, totalMinor: 2469134, currency: 'KWD', onPress: () => {} }).props.accessibilityLabel, 'Comida, 1234,567 KWD, 50 % del gasto del mes, 2 gastos');
  assert.equal(es.CategoryLegendRow({ category, totalMinor: 2469134, currency: 'JPY', onPress: () => {} }).props.accessibilityLabel, 'Comida, 1234567 JPY, 50 % del gasto del mes, 2 gastos');
  const en = rows('en-US');
  assert.equal(en.CategoryLegendRow({ category, totalMinor: 2469134, currency: 'KWD', onPress: () => {} }).props.accessibilityLabel, 'Comida, 1234.567 KWD, 50% of the month’s spending, 2 expenses');
  assert.equal(en.CategorySpendingRow({ category: { ...category, amountMinor: 123456 }, totalMinor: 246912, currency: 'ARS', onPress: () => {} }).props.accessibilityLabel, 'Comida, 1234.56 ARS, 50% of the month’s spending, 2 expenses', 'ARS unchanged');
});

// 24UX6B: the months that are not shown read as marks: 3:1 or more against the chart's surface in both themes (the inset
// grey they had held 1.2:1), while the shown month's brand bar stays the one strong mark.
function luminance(hex: string): number {
  const channel = (value: number) => { const c = value / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * channel(parseInt(hex.slice(1, 3), 16)) + 0.7152 * channel(parseInt(hex.slice(3, 5), 16)) + 0.0722 * channel(parseInt(hex.slice(5, 7), 16));
}
const ratio = (a: string, b: string) => { const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
/** An #RRGGBBAA colour composited over an opaque ground. */
const over = (color: string, ground: string) => {
  const alpha = parseInt(color.slice(7, 9), 16) / 255;
  const channel = (hex: string, i: number) => parseInt(hex.slice(i, i + 2), 16);
  return '#' + [1, 3, 5].map(i => Math.round(channel(color, i) * alpha + channel(ground, i) * (1 - alpha)).toString(16).padStart(2, '0')).join('');
};

test('24UX6B: idle month bars hold 3:1 on their surface in light and dark; the shown month keeps the brand', async () => {
  const { lightPalette, darkPalette } = await import('../src/ui/palette.ts');
  const charts = chartsModule(bindLocale('es-AR'));
  for (const [base, isDark] of [[lightPalette, false], [darkPalette, true]] as const) {
    const p = { ...base, isDark };
    const idle = charts.idleBarColor(p as never) as unknown as string;
    assert.match(idle, /^#[0-9A-F]{8}$/i, 'the tertiary ink with an alpha: no new colour');
    assert.equal(idle.slice(0, 7), p.tertiary);
    const shown = over(idle, p.surface);
    assert.ok(ratio(shown, p.surface) >= 3, `idle bar on the surface: ${ratio(shown, p.surface).toFixed(2)}`);
    assert.ok(ratio(shown, p.surface) < ratio(p.primary, p.surface), 'the shown month stays the strongest mark');
  }
  const points = [{ monthISO: '2026-08', amountMinor: 100, partial: false }, { monthISO: '2026-09', amountMinor: 50, partial: true }];
  const chart = charts.MonthBars({ points, selected: '2026-09', onSelect: () => {}, currency: 'ARS' });
  const bars = flat(chart).filter(node => typeof node.type === 'function').map(node => node.type(node.props));
  const fills = bars.map(bar => bar.props.children.props.style[0].backgroundColor);
  assert.deepEqual(fills, ['#586961B3', '#2557D6'], 'the other month in the idle ink, the shown one in the brand');
  // The month in progress keeps its outline when it is not the shown one: ink on the idle fill (the secondary edge vanished on it).
  const past = charts.MonthBars({ points, selected: '2026-08', onSelect: () => {}, currency: 'ARS' });
  const outline = flat(past).filter(node => typeof node.type === 'function').map(node => node.type(node.props))[1].props.children.props.style[0];
  assert.deepEqual([outline.backgroundColor, outline.borderColor, outline.borderWidth > 0], ['#586961B3', '#000', true]);
});

// 24UX6C2, recomposed in 24UX6D: the category donut. It is the head of Categorías and its centre carries the period's total
// («Total del período» over the exact amount: the «Gastado» KPI above it and 24UX6C2's quiet «Tocá una categoría» are both
// superseded) until a slice is chosen, then that category's name, exact amount and share. A chosen slice is drawn thicker
// and the others step back to 30 %. VoiceOver reaches the same choice as one adjustable element whose value, with none
// chosen, is the total.
const DONUT_SLICES = [
  { key: 'a', label: 'Supermercado', value: 2900, color: '#3E6FB0' },
  { key: 'b', label: 'Hogar', value: 5000, color: '#B0573E' },
  { key: 'c', label: 'Salud', value: 2100, color: '#3EB07A' },
];
const DONUT_TOTAL = 10000;
/** reports.tsx's `shareOf`: the rows' own formatter (spendingShare over the report's total) and the spoken percentage. */
const shareOfFor = (i18n: ReturnType<typeof bindLocale>, total = DONUT_TOTAL) => (value: number) => {
  const { fraction, label } = presentation.spendingShare(value, total, i18n.locale);
  return { label, spoken: i18n.spokenPercent(fraction) };
};
/** Every node of a tree, rendering local function components (Sweep, Slice) on the way. */
const expand = (value: any): any[] => !value || typeof value !== 'object' ? [] : Array.isArray(value) ? value.flatMap(expand)
  : typeof value.type === 'function' ? [value, ...expand(value.type(value.props))] : [value, ...expand(value.props?.children)];
const textOf = (node: any): string => [node.props?.children].flat(Infinity).map(part => typeof part === 'string' || typeof part === 'number' ? String(part) : '').join('');
/** The donut's parts, found by type through the tree (the root is an outer View, 24UX6D: the full-width neutral row,
 * holding the chart's square and, when the readout does not fit the hole, a View under it): the adjustable Pressable, the
 * centre overlay (the View with pointerEvents none inside the square) and the readout under the donut (absent unless it
 * moved there). `total` is the report's figure the screen hands the chart (the slices' sum by default). */
function donut(options: { chosen?: string | null; size?: number; locale?: Parameters<typeof bindLocale>[0]; onChoose?: (key: string | null) => void;
  slices?: typeof DONUT_SLICES; total?: number } = {}) {
  const i18n = bindLocale(options.locale ?? 'es-AR');
  const tree = chartsModule(i18n).DonutChart({ slices: options.slices ?? DONUT_SLICES, currency: 'ARS', total: options.total ?? DONUT_TOTAL, size: options.size,
    chosen: options.chosen ?? null, onChoose: options.onChoose ?? (() => {}), shareOf: shareOfFor(i18n, options.total), caption: i18n.t('reports.chart.byCategory') });
  const nodes = flat(tree);
  const press = nodes.find(node => node.type === 'Pressable');
  const square = nodes.find(node => node.type === 'ValueTransition');
  const centre = flat(square).find(node => node.type === 'View' && node.props.pointerEvents === 'none');
  const below = [tree.props.children].flat().find((child: any) => child && typeof child === 'object' && child !== square && child.type === 'View');
  return { tree, press, square, centre, below, i18n };
}
const pressAt = (press: any, x: number, y: number) => press.props.onPress({ nativeEvent: { locationX: x, locationY: y } });
type ChartGeometry = {
  donutGeometry: (width: number) => { size: number; thickness: number }; donutRoom: (size: number, thickness: number) => number;
  centreAmountSize: (text: string, room: number, fontScale: number) => number | null; CENTRE_AMOUNT_STEPS: readonly number[]; DONUT_RING: number;
};
const FOUR_MILLION = 402972700;

test('24UX6D: the donut takes 70 % of the content width (200–260 pt) with a 22 pt ring, so the hole is the focal point at 393 and 375 pt', () => {
  const charts = chartsModule(bindLocale('es-AR')) as unknown as ChartGeometry;
  assert.equal(charts.DONUT_RING, 22);
  assert.deepEqual({ ...charts.donutGeometry(393) }, { size: 247, thickness: 22 }, 'iPhone 15/16: content 353 pt');
  assert.deepEqual({ ...charts.donutGeometry(375) }, { size: 234, thickness: 22 }, 'iPhone SE/13 mini: content 335 pt');
  assert.deepEqual({ ...charts.donutGeometry(320) }, { size: 200, thickness: 22 }, 'never under 200 pt');
  assert.deepEqual({ ...charts.donutGeometry(430) }, { size: 260, thickness: 22 }, 'never over 260 pt');
  assert.deepEqual({ ...charts.donutGeometry(0) }, { size: 200, thickness: 22 }, 'before layout, the smallest');
  assert.deepEqual({ ...charts.donutGeometry(Number.NaN) }, { size: 200, thickness: 22 });
  // The ring is relatively thinner than the 176 pt donut's (22 of 176 = 12.5 %), so the hole grows from 112 pt to 183 / 170 pt.
  assert.ok(22 / 247 < 0.09 && 22 / 234 < 0.095);
  assert.equal(charts.donutRoom(247, 22), 183);
  assert.equal(charts.donutRoom(234, 22), 170);
  assert.equal(charts.donutRoom(176, 22), 112);
  // The centre amount steps 26 → 18 pt until it fits; an ARS total in the millions is 24 pt at 393 and 22 pt at 375.
  assert.deepEqual([...charts.CENTRE_AMOUNT_STEPS], [26, 24, 22, 20, 18]);
  const millions = i18nFormat.moneyText(FOUR_MILLION, 'ARS', 'es-AR');
  assert.equal(millions, '$ 4.029.727,00');
  assert.equal(charts.centreAmountSize(millions, 183, 1), 24);
  assert.equal(charts.centreAmountSize(millions, 170, 1), 22);
  assert.equal(charts.centreAmountSize(millions, 183, 1.2), 20, 'at 1.2× the same amount steps down');
  assert.equal(charts.centreAmountSize(i18nFormat.moneyText(2900, 'ARS', 'es-AR'), 183, 1), 26, 'a short amount at the largest step');
  assert.equal(charts.centreAmountSize(i18nFormat.moneyText(1234567890123, 'ARS', 'es-AR'), 183, 1), null, 'thirteen digits never fit at 18 pt: under the donut');
  // The chart itself is sized from the window: 247 pt at 393, 234 pt at 375.
  for (const [width, size] of [[393, 247], [375, 234]]) {
    chartWidth = width;
    try {
      const { press, square } = donut();
      assert.deepEqual([press.props.style.width, press.props.style.height, square.props.style.width], [size, size, size], width + ' pt');
    } finally { chartWidth = 393; }
  }
});

test('24UX6D: with nothing chosen the centre is «Total del período» over the exact period total, never «Tocá una categoría»', () => {
  const { centre, below, tree } = donut();
  assert.equal(below, undefined, 'the total sits in the hole');
  const texts = flat(centre).filter(node => node.type === 'AppText');
  assert.deepEqual(texts.map(textOf), ['Total del período']);
  assert.equal(texts[0].props.secondary, true, 'a quiet label');
  assert.equal(texts[0].props.variant, 'footnote');
  assert.equal(texts[0].props.maxFontSizeMultiplier, geometry.ROW_STACK_SCALE);
  const money = flat(centre).filter(node => node.type === 'Money');
  assert.equal(money.length, 1);
  assert.deepEqual({ ...money[0].props }, { minor: DONUT_TOTAL, currency: 'ARS', size: 26, weight: '700', align: 'center' }, 'the exact total in minor units');
  assert.equal(expand(tree).some(node => /Tocá una categoría|Tap a category/.test(textOf(node))), false, 'the 24UX6C2 hint is gone');
  // The total is the report's own figure as handed in, not a sum the chart makes up.
  assert.equal(flat(donut({ total: 12345 }).centre).find(node => node.type === 'Money').props.minor, 12345);
  // An ARS total in the millions steps down to fit: 24 pt at 393, 22 pt at 375; never shortened.
  const millions = [{ key: 'a', label: 'Supermercado', value: FOUR_MILLION, color: '#111' }];
  assert.equal(flat(donut({ slices: millions, total: FOUR_MILLION }).centre).find(node => node.type === 'Money').props.size, 24);
  chartWidth = 375;
  try { assert.equal(flat(donut({ slices: millions, total: FOUR_MILLION }).centre).find(node => node.type === 'Money').props.size, 22); } finally { chartWidth = 393; }
  // English.
  assert.deepEqual(flat(donut({ locale: 'en-US' }).centre).filter(node => node.type === 'AppText').map(textOf), ['Period total']);
});

test('24UX6C2: a chosen slice puts its name, its exact amount and its share of the spending in the centre', () => {
  const { centre } = donut({ chosen: 'a' });
  const nodes = flat(centre);
  const texts = nodes.filter(node => node.type === 'AppText');
  assert.equal(textOf(texts[0]), 'Supermercado');
  assert.equal(texts[0].props.style.fontWeight, '600');
  assert.equal(texts[0].props.variant, 'footnote');
  const money = nodes.filter(node => node.type === 'Money');
  assert.equal(money.length, 1);
  assert.deepEqual({ ...money[0].props }, { minor: 2900, currency: 'ARS', size: 26, weight: '700', align: 'center' }, 'the slice\'s exact value, in minor units');
  assert.equal(textOf(texts[1]), '29\u00A0% del gasto', 'the share from shareOf, the rows\' formatter');
  assert.ok(!nodes.some(node => textOf(node) === 'Total del período'), '24UX6D: the choice replaces the total in the centre');
  assert.equal(flat(donut({ chosen: 'a', size: 160 }).centre).find(node => node.type === 'Money').props.size, 24, 'a smaller hole (96 pt): one step down');
  // A share is the rows' own: an odd total keeps the same rounding as the legend row.
  const i18n = bindLocale('es-AR');
  assert.equal(shareOfFor(i18n, 3)(1).label, presentation.spendingShare(1, 3, 'es-AR').label);
  assert.equal(textOf(flat(donut({ chosen: 'b', locale: 'en-US' }).centre).filter(node => node.type === 'AppText')[1]), '50% of spending');
});

test('24UX6C2: the chosen slice is drawn thicker and the others step back to 30 %', () => {
  const paths = (chosen: string | null) => expand(donut({ chosen }).press).filter(node => node.type === 'Animated(Path)')
    .map(node => ({ color: node.props.stroke, width: node.props.strokeWidth, opacity: node.props.strokeOpacity }));
  const charts = chartsModule(bindLocale('es-AR'));
  const extra = charts.CHOSEN_EXTRA as unknown as number;
  assert.equal(extra, 6);
  assert.equal(JSON.stringify(paths(null)), JSON.stringify(DONUT_SLICES.map(slice => ({ color: slice.color, width: 22, opacity: 1 }))), 'none chosen: every slice alike');
  assert.equal(JSON.stringify(paths('a')), JSON.stringify([
    { color: '#3E6FB0', width: 22 + extra, opacity: 1 }, { color: '#B0573E', width: 22, opacity: 0.3 }, { color: '#3EB07A', width: 22, opacity: 0.3 },
  ]));
  assert.equal(JSON.stringify(paths('c').map(path => path.width)), JSON.stringify([22, 22, 28]));
  assert.equal(JSON.stringify(paths('zz').map(path => path.opacity)), JSON.stringify([1, 1, 1]), 'a key that is not a slice chooses nothing');
  // The ring leaves room for the thicker slice inside the chart's square (24UX6D: 247 pt at 393 pt).
  const circle = expand(donut().press).find(node => node.type === 'Circle');
  assert.equal(circle.props.r, (247 - 22 - extra) / 2);
  assert.ok(circle.props.r + (22 + extra) / 2 <= 247 / 2, 'the chosen slice\'s outer edge stays inside the square');
});

test('24UX6C2: the donut is one adjustable VoiceOver element that names the choice, amount and share (24UX6D: the total with none chosen)', () => {
  const { press } = donut();
  assert.equal(press.type, 'Pressable');
  assert.equal(press.props.accessible, true);
  assert.equal(press.props.accessibilityRole, 'adjustable');
  assert.equal(press.props.accessibilityLabel, 'Gasto por categoría: Supermercado 29 %, Hogar 50 %, Salud 21 %');
  assert.deepEqual({ ...press.props.accessibilityValue }, { text: 'Total del período, 100,00 pesos' }, 'none chosen: the period total, spoken');
  assert.equal(press.props.accessibilityHint, 'Deslizá hacia arriba o hacia abajo para elegir una categoría');
  assert.equal(press.props.accessibilityActions.map((action: { name: string }) => action.name).join(','), 'increment,decrement');
  assert.deepEqual({ ...donut({ chosen: 'a' }).press.props.accessibilityValue }, { text: 'Supermercado, 29,00 pesos, 29\u00A0% del gasto' });
  assert.deepEqual({ ...donut({ chosen: 'b' }).press.props.accessibilityValue }, { text: 'Hogar, 50,00 pesos, 50\u00A0% del gasto' });
  // The spoken value never carries a visible formatter's grouped money, with or without a choice.
  assert.ok(!donut({ chosen: 'a' }).press.props.accessibilityValue.text.includes('$'));
  assert.equal(donut({ total: FOUR_MILLION }).press.props.accessibilityValue.text, 'Total del período, 4029727,00 pesos', 'no grouping, no symbol');
  const english = donut({ chosen: 'a', locale: 'en-US' }).press;
  assert.equal(english.props.accessibilityValue.text, 'Supermercado, 29.00 pesos, 29% of spending');
  assert.equal(donut({ locale: 'en-US' }).press.props.accessibilityValue.text, 'Period total, 100.00 pesos');
  // Labelled actions: iOS lists every declared action in its Actions rotor, so neither reads as a raw «increment».
  const actions = (locale: Parameters<typeof bindLocale>[0]) => JSON.stringify(donut({ locale }).press.props.accessibilityActions);
  assert.equal(actions('es-AR'), JSON.stringify([{ name: 'increment', label: 'Categoría siguiente' }, { name: 'decrement', label: 'Categoría anterior' }]));
  assert.equal(actions('en-US'), JSON.stringify([{ name: 'increment', label: 'Next category' }, { name: 'decrement', label: 'Previous category' }]));
});

test('24UX6C2: a VoiceOver double-tap activates the donut without a synthetic centre tap that would clear the choice', () => {
  for (const chosen of [null, 'a', 'c']) {
    const calls: (string | null)[] = [];
    const { press } = donut({ chosen, size: 176, onChoose: key => calls.push(key) });
    assert.equal(typeof press.props.onAccessibilityTap, 'function', 'onAccessibilityTap is declared, so UIKit does not synthesize a tap');
    press.props.onAccessibilityTap();
    assert.equal(calls.length, 0, `double-tap with ${chosen ?? 'none'} chosen: no choice changes`);
    // An ordinary tap in the hole still clears (or keeps none), as before.
    pressAt(press, 88, 88);
    assert.equal(JSON.stringify(calls), JSON.stringify([null]));
  }
});

test('24UX6C2: the centre overlay and the readout under the donut are for the eye only; VoiceOver hears the choice once, as the value', () => {
  for (const chartFont of [1, 1.353]) {
    chartFontScale = chartFont;
    try {
      for (const [chosen, spoken] of [['a', 'Supermercado, 29,00 pesos, 29 % del gasto'], [null, 'Total del período, 100,00 pesos']] as [string | null, string][]) {
        const { centre, below, press } = donut({ chosen });
        assert.equal(centre.props.pointerEvents, 'none', 'touches pass through the centre to the Pressable');
        assert.equal(centre.props.accessibilityElementsHidden, true);
        assert.equal(centre.props.importantForAccessibility, 'no-hide-descendants');
        if (chartFont > 1.2) {
          assert.ok(below, 'at large text the readout moves under the donut, the total too (24UX6D)');
          assert.equal(below.props.accessibilityElementsHidden, true);
          assert.equal(below.props.importantForAccessibility, 'no-hide-descendants');
        } else assert.equal(below, undefined);
        // The same readout reaches VoiceOver once, through the adjustable element's value, at every text size.
        assert.equal(press.props.accessibilityValue.text, spoken);
        for (const node of flat(below ?? null).concat(flat(centre))) assert.notEqual(node.props.accessible, true, 'no readout node is its own element');
      }
    } finally { chartFontScale = 1; }
  }
});

test('24UX6C2: at the default text size a short amount stays in the hole, its texts capped at 1.2', () => {
  const { centre, below } = donut({ chosen: 'a' });
  assert.equal(below, undefined, 'no readout under the donut');
  const texts = flat(centre).filter(node => node.type === 'AppText');
  assert.equal(texts.map(textOf).join('|'), 'Supermercado|29 % del gasto');
  for (const text of texts) assert.equal(text.props.maxFontSizeMultiplier, geometry.ROW_STACK_SCALE, textOf(text));
  assert.equal(geometry.ROW_STACK_SCALE, 1.2);
  assert.equal(texts[0].props.numberOfLines, 2, 'the name keeps to two lines in the hole');
  assert.equal(flat(centre).filter(node => node.type === 'Money').length, 1);
  // The total's label is capped too.
  const label = flat(donut().centre).find(node => node.type === 'AppText');
  assert.equal(label.props.maxFontSizeMultiplier, 1.2);
});

/** The readout moved under the donut: the hole shows nothing, the View under it holds the heading (the total's label or
 * the category's name), the exact Money and, for a category, the share, uncapped and untruncated, and the Money is never
 * inside the hole. Under the donut the amount takes the row's width at the centre's largest step that fits it. */
function assertReadoutBelow(view: ReturnType<typeof donut>, expected: { texts: string[]; minor: number; size?: number }) {
  assert.ok(view.below, 'a View under the donut');
  assert.equal(flat(view.centre).filter(node => node.type === 'AppText' || node.type === 'Money').length, 0, 'the hole shows nothing');
  assert.equal(flat(view.square).filter(node => node.type === 'Money').length, 0, 'the amount is never inside the chart\'s square');
  const texts = flat(view.below).filter(node => node.type === 'AppText');
  assert.equal(texts.map(textOf).join('|'), expected.texts.join('|'));
  for (const text of texts) {
    assert.equal(text.props.maxFontSizeMultiplier, undefined, 'under the donut the text follows Dynamic Type');
    assert.equal(text.props.numberOfLines, undefined, 'never truncated');
  }
  const money = flat(view.below).filter(node => node.type === 'Money');
  assert.equal(money.length, 1);
  assert.deepEqual({ ...money[0].props }, { minor: expected.minor, currency: 'ARS', size: expected.size ?? 26, weight: '700', align: 'center' }, 'the exact value');
  assert.equal(view.below.props.style.alignSelf, 'stretch', 'the readout takes the card\'s width, not the hole\'s');
}

test('24UX6C2: at large text (1.353) the chosen readout moves under the donut; 24UX6D: the total\'s too', () => {
  chartFontScale = 1.353;
  try {
    assertReadoutBelow(donut({ chosen: 'a' }), { texts: ['Supermercado', '29 % del gasto'], minor: 2900 });
    assertReadoutBelow(donut({ chosen: 'b', locale: 'en-US' }), { texts: ['Hogar', '50% of spending'], minor: 5000 });
    assertReadoutBelow(donut({ chosen: 'c', size: 160 }), { texts: ['Salud', '21 % del gasto'], minor: 2100 });
    assertReadoutBelow(donut(), { texts: ['Total del período'], minor: DONUT_TOTAL });
    assertReadoutBelow(donut({ locale: 'en-US' }), { texts: ['Period total'], minor: DONUT_TOTAL });
  } finally { chartFontScale = 1; }
  // At the AX sizes a long total under the donut steps down to keep to the row (Money caps its own scale at 1.8×).
  chartFontScale = 3.1;
  try {
    const millions = [{ key: 'a', label: 'Supermercado', value: FOUR_MILLION, color: '#111' }];
    assertReadoutBelow(donut({ slices: millions, total: FOUR_MILLION }), { texts: ['Total del período'], minor: FOUR_MILLION, size: 26 });
    const huge = 1234567890123;
    assertReadoutBelow(donut({ slices: [{ key: 'a', label: 'Supermercado', value: huge, color: '#111' }], total: huge }), { texts: ['Total del período'], minor: huge, size: 18 });
  } finally { chartFontScale = 1; }
  // Exactly 1.2 still measures: a short amount stays in the hole, chosen or not.
  chartFontScale = 1.2;
  try {
    assert.equal(donut({ chosen: 'a' }).below, undefined);
    assert.equal(donut().below, undefined);
  } finally { chartFontScale = 1; }
});

test('24UX6C2: a 13-digit ARS amount at the default text size moves under the donut instead of overflowing the hole (24UX6D: the total too)', () => {
  const huge = 1234567890123;
  const slices = [{ key: 'a', label: 'Supermercado', value: huge, color: '#3E6FB0' }, { key: 'b', label: 'Hogar', value: 5000, color: '#B0573E' }];
  const total = huge + 5000;
  // The estimate: '$ 12.345.678.901,23' at 18 pt (the smallest step) needs about 191 pt; the hole of the 247 pt donut is 183 pt.
  const hole = 247 - 2 * (22 + 10);
  assert.ok(geometry.amountWidthEm(i18nFormat.moneyText(huge, 'ARS', 'es-AR')) * 18 > hole);
  const view = donut({ chosen: 'a', slices, total });
  assertReadoutBelow(view, { texts: ['Supermercado', shareOfFor(view.i18n, total)(huge).label + ' del gasto'], minor: huge });
  // The total, with nothing chosen, moves under the donut the same way.
  assertReadoutBelow(donut({ slices, total }), { texts: ['Total del período'], minor: total });
  // The other slice's everyday amount, in the same chart, stays in the hole.
  const small = donut({ chosen: 'b', slices, total });
  assert.equal(small.below, undefined);
  assert.equal(flat(small.centre).find(node => node.type === 'Money').props.minor, 5000);
});

test('24UX6C2: swiping up and down steps through the slices in order, and past either end back to none', () => {
  const step = (chosen: string | null, actionName: 'increment' | 'decrement') => {
    const calls: (string | null)[] = [];
    donut({ chosen, onChoose: key => calls.push(key) }).press.props.onAccessibilityAction({ nativeEvent: { actionName } });
    assert.equal(calls.length, 1, 'one choice per swipe');
    return calls[0];
  };
  assert.equal(step(null, 'increment'), 'a');
  assert.equal(step('a', 'increment'), 'b');
  assert.equal(step('b', 'increment'), 'c');
  assert.equal(step('c', 'increment'), null, 'past the last slice: none');
  assert.equal(step('c', 'decrement'), 'b');
  assert.equal(step('b', 'decrement'), 'a');
  assert.equal(step('a', 'decrement'), null, 'before the first slice: none');
  assert.equal(step(null, 'decrement'), 'c', 'from none, swiping down starts at the last slice');
});

test('24UX6C2: tapping a slice chooses it; tapping it again or the hole clears the choice', () => {
  // Default size 176, thickness 22: the ring's radius is 74 around (88, 88).
  const tap = (chosen: string | null, x: number, y: number) => {
    const calls: (string | null)[] = [];
    pressAt(donut({ chosen, size: 176, onChoose: key => calls.push(key) }).press, x, y);
    assert.equal(calls.length, 1);
    return calls[0];
  };
  assert.equal(tap(null, 88 + 74, 88), 'a', 'three o\'clock is inside the first 29 %');
  assert.equal(tap(null, 88, 88 + 74), 'b', 'six o\'clock is in the second slice');
  assert.equal(tap('a', 88 + 74, 88), null, 'the chosen slice again clears it');
  assert.equal(tap('a', 88, 88 + 74), 'b', 'another slice moves the choice');
  assert.equal(tap('a', 88, 88), null, 'the hole clears');
  assert.equal(tap(null, 88, 88), null, 'the hole with nothing chosen stays none');
  assert.equal(tap('b', 2, 2), null, 'a corner outside the ring clears too');
});

test('24UX6C2: donutArcs splits the ring clockwise from twelve with a 2 pt gap; sliceAt maps a touch to a slice', () => {
  const charts = chartsModule(bindLocale('es-AR')) as unknown as {
    donutArcs: (slices: readonly { key: string; value: number; color: string }[], size: number, thickness: number) => { key: string; start: number; end: number; color: string; radius: number }[];
    sliceAt: (arcs: readonly { key: string; start: number; end: number; color: string; radius: number }[], x: number, y: number, size: number, thickness: number) => string | null;
  };
  const near = (a: number, b: number, message?: string) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≈ ${b}${message ? ': ' + message : ''}`);
  const arcs = charts.donutArcs(DONUT_SLICES, 176, 22);
  assert.equal(arcs.map(arc => arc.key).join(','), 'a,b,c');
  const radius = (176 - 22 - 6) / 2;
  const gap = 2 / radius;
  for (const arc of arcs) assert.equal(arc.radius, radius);
  near(arcs[0].start, -Math.PI / 2 + gap / 2, 'the first slice starts at twelve');
  near(arcs[0].end, -Math.PI / 2 + 0.29 * Math.PI * 2 - gap / 2);
  near(arcs[1].start, -Math.PI / 2 + 0.29 * Math.PI * 2 + gap / 2, 'a 2 pt gap between slices');
  near(arcs[2].end, Math.PI * 3 / 2 - gap / 2, 'the last slice closes the circle');
  assert.equal(arcs.map(arc => arc.color).join(','), DONUT_SLICES.map(slice => slice.color).join(','));
  // One slice: the whole circle, no gap. No spending: no arcs. A zero slice draws nothing.
  const whole = charts.donutArcs([{ key: 'x', value: 5, color: '#1' }], 176, 22);
  near(whole[0].start, -Math.PI / 2);
  near(whole[0].end, Math.PI * 3 / 2);
  assert.equal(charts.donutArcs([{ key: 'x', value: 0, color: '#1' }], 176, 22).length, 0);
  assert.equal(charts.donutArcs([], 176, 22).length, 0);
  assert.equal(charts.donutArcs([{ key: 'x', value: 3, color: '#1' }, { key: 'z', value: 0, color: '#2' }, { key: 'y', value: 1, color: '#3' }], 176, 22).map(arc => arc.key).join(','), 'x,y');

  const at = (angle: number, distance = radius) => charts.sliceAt(arcs, 88 + distance * Math.cos(angle), 88 + distance * Math.sin(angle), 176, 22);
  // Angles from twelve, clockwise: a holds the first 29 % of the turn, b the next 50 %, c the last 21 %.
  assert.equal(at(-Math.PI / 2 + 0.1), 'a', 'just after twelve');
  assert.equal(at(0), 'a', 'three o\'clock');
  assert.equal(at(Math.PI / 2), 'b', 'six o\'clock');
  assert.equal(at(Math.PI), 'b', 'nine o\'clock (atan2 gives π)');
  assert.equal(at(-Math.PI * 2 / 3), 'c', 'eleven o\'clock: a negative atan2 angle wraps into [−π/2, 3π/2)');
  // A gap counts as the slice that starts after it; past the last slice's end, the first.
  assert.equal(at(-Math.PI / 2 + 0.29 * Math.PI * 2), 'b', 'the gap between a and b');
  assert.equal(at(-Math.PI / 2 + 0.79 * Math.PI * 2), 'c', 'the gap between b and c');
  assert.equal(at(-Math.PI / 2), 'a', 'exactly twelve, in the gap before the first slice');
  assert.equal(at(Math.PI * 3 / 2 - 0.001), 'a', 'just before twelve, past the last slice\'s end: the first');
  // The ring with 10 pt of slack either side; the hole and outside are none.
  assert.equal(at(0, radius - 11 - 9), 'a', 'inside edge within the slack');
  assert.equal(at(0, radius + 11 + 9), 'a', 'outside edge within the slack');
  assert.equal(at(0, radius - 11 - 11), null, 'the hole');
  assert.equal(at(0, radius + 11 + 11), null, 'outside the ring');
  assert.equal(charts.sliceAt(arcs, 88, 88, 176, 22), null, 'the centre');
  assert.equal(charts.sliceAt([], 88 + radius, 88, 176, 22), null, 'no arcs: nothing to choose');
});

test('Codex (PR #73): a long category name moves the readout under the donut even at the default text size; a short one stays in the hole', () => {
  chartFontScale = 1;
  const long = 'Comidas fuera de casa con amigos y familia los fines de semana';
  const slices = [{ key: 'long', label: long, value: 2900, color: '#111' }, { key: 'b', label: 'Hogar', value: 7100, color: '#222' }];
  const chosen = donut({ slices, chosen: 'long' });
  assertReadoutBelow(chosen, { texts: [long, chosen.i18n.t('reports.chart.share', { percent: i18nFormat.formatPercent(0.29, 'es-AR') })], minor: 2900 });
  const short = donut({ slices, chosen: 'b' });
  assert.equal(short.below, undefined, 'a short name and amount keep the readout in the hole');
});

test('Codex (PR #73): the «Otras» slice can never share its key with a category, whatever the person names one', async () => {
  const { categoryKey } = await import('@finanzapp/domain');
  const charts = chartsModule(bindLocale('es-AR'));
  const OTHERS = (charts as any).OTHERS_KEY as string;
  assert.equal(OTHERS.startsWith(' '), true, 'a leading space, which categoryKey always trims');
  for (const label of ['__others__', ' others', 'Others', '  OTRAS  ', 'otras']) assert.notEqual(categoryKey(label), OTHERS, label);
  // A real category literally named «__others__» among the leading slices and an aggregate tail: two distinct keys.
  const items = ['__others__', 'a', 'b', 'c', 'd', 'e'].map((key, index) => ({ key: categoryKey(key), label: key, value: 600 - index * 10 }));
  const slices = (charts as any).donutSlices(items, { isDark: false }, () => '#123', 'Otras') as { key: string; label: string; value: number }[];
  assert.equal(new Set(slices.map(slice => slice.key)).size, slices.length, 'every slice key is unique');
  const aggregate = slices.find(slice => slice.key === OTHERS)!;
  assert.deepEqual([aggregate.label, aggregate.value], ['Otras', 560 + 550], 'the tail after the four named slices');
  assert.ok(slices.some(slice => slice.key === '__others__' && slice.label === '__others__'), 'the real category keeps its own slice');
  // Choosing the aggregate shows the aggregate, not the category with the look-alike name.
  const view = donut({ slices: slices.map(slice => ({ ...slice, color: '#111' })), chosen: OTHERS, total: slices.reduce((sum, slice) => sum + slice.value, 0) });
  const names = flat(view.centre).filter(node => node.type === 'AppText').map(textOf);
  assert.equal(names[0], 'Otras');
});

test('24UX6D: a tap on the neutral space around the ring clears the choice; a drag, a scroll or nothing chosen never does', () => {
  const touch = (x: number, y: number) => ({ nativeEvent: { pageX: x, pageY: y } });
  const root = (chosen: string | null, calls: (string | null)[]) => donut({ chosen, onChoose: key => calls.push(key) });
  // The neutral space is the chart's own full-width row: the root View, never an accessibility element and never a Pressable
  // (the adjustable ring is the only one, and it claims its own touches first).
  const calls: (string | null)[] = [];
  const { tree, press } = root('a', calls);
  assert.equal(tree.type, 'View');
  assert.equal(tree.props.style.alignSelf, 'stretch', 'the whole row around the ring, not just the square');
  assert.notEqual(tree.props.accessible, true);
  assert.equal(flat(tree).filter(node => node.type === 'Pressable').length, 1, 'the ring is the only pressable');
  assert.equal(press.props.accessibilityRole, 'adjustable');
  // A tap (under 10 pt of travel) clears.
  assert.equal(tree.props.onStartShouldSetResponder(), true, 'with a choice, the row answers a touch');
  tree.props.onResponderGrant(touch(40, 120));
  tree.props.onResponderRelease(touch(44, 123));
  assert.equal(JSON.stringify(calls), JSON.stringify([null]));
  // A drag of 30 pt is not a tap.
  tree.props.onResponderGrant(touch(40, 120));
  tree.props.onResponderRelease(touch(40, 150));
  assert.equal(calls.length, 1, 'a drag keeps the choice');
  // The list taking the touch to scroll ends it: the release that may follow clears nothing.
  assert.equal(tree.props.onResponderTerminationRequest(), true, 'it never holds a touch the list wants for scrolling');
  tree.props.onResponderGrant(touch(40, 120));
  tree.props.onResponderTerminate();
  tree.props.onResponderRelease(touch(40, 120));
  assert.equal(calls.length, 1, 'a scroll keeps the choice');
  // With nothing chosen (the total in the centre) the row does not even take the touch.
  const idle: (string | null)[] = [];
  assert.equal(root(null, idle).tree.props.onStartShouldSetResponder(), false);
  // The ring: the chosen slice again, or the hole, clears; another slice moves the choice (24UX6C2, unchanged).
  const ring: (string | null)[] = [];
  const small = donut({ chosen: 'a', size: 176, onChoose: key => ring.push(key) }).press;
  pressAt(small, 88 + 74, 88);
  pressAt(small, 88, 88);
  pressAt(small, 88, 88 + 74);
  assert.equal(JSON.stringify(ring), JSON.stringify([null, null, 'b']));
});

// Producto 24T3 (A24): devoluciones net in their own month and category, so a category, a month or a span can be ≤ 0.
test('24T3 (A24): only categories above zero are slices; a category ≤ 0 is never drawn, never folded into «Otras», and the arcs never pass one turn', () => {
  const charts = chartsModule(bindLocale('es-AR')) as any;
  const items = [{ key: 'a', label: 'A', value: 500 }, { key: 'b', label: 'B', value: 400 }, { key: 'c', label: 'C', value: 300 }, { key: 'd', label: 'D', value: 200 },
    { key: 'e', label: 'E', value: 100 }, { key: 'f', label: 'F', value: 50 }, { key: 'zero', label: 'Cero', value: 0 }, { key: 'ropa', label: 'Ropa', value: -1000 }];
  const slices = charts.donutSlices(items, { isDark: false }, () => '#123', 'Otras') as { key: string; value: number }[];
  assert.equal(JSON.stringify(slices.map(slice => [slice.key, slice.value])), JSON.stringify([['a', 500], ['b', 400], ['c', 300], ['d', 200], [charts.OTHERS_KEY, 150]]),
    '«Otras» is E + F only: Ropa (−1 000) would have made it −850');
  assert.deepEqual((charts.donutSlices(items.slice(-2), { isDark: false }, () => '#123', 'Otras') as unknown[]).length, 0, 'nothing above zero: no slice at all');
  // Whatever a caller hands in, the arcs are each positive value's share of the positive sum: one turn, never more.
  const arcs = charts.donutArcs([{ key: 'x', value: 300, color: '#1' }, { key: 'neg', value: -200, color: '#2' }, { key: 'y', value: 100, color: '#3' }], 176, 22) as { key: string; start: number; end: number }[];
  assert.equal(arcs.map(arc => arc.key).join(), 'x,y');
  const gap = 2 / ((176 - 22 - 6) / 2);
  assert.ok(Math.abs(arcs[1].end - (Math.PI * 3 / 2 - gap / 2)) < 1e-9, 'the last arc closes the circle exactly');
  const sweep = arcs.reduce((sum, arc) => sum + (arc.end - arc.start), 0) + gap * arcs.length;
  assert.ok(sweep <= Math.PI * 2 + 1e-9, 'never more than one turn: ' + sweep);
  assert.ok(Math.abs((arcs[0].end - arcs[0].start + gap) / (Math.PI * 2) - 0.75) < 1e-9, 'x is 300 of 400, not 300 of 200');
  assert.equal(charts.donutArcs([{ key: 'neg', value: -5, color: '#1' }], 176, 22).length, 0, 'a negative sum draws nothing');
});

test('24T3 (A24): a month that nets to zero or less is a bar at zero, VoiceOver says «sin gasto neto», and the shown month\'s negative net is written under the bars', () => {
  const i18n = bindLocale('es-AR');
  const points = [{ monthISO: '2026-06', amountMinor: 0, partial: false, count: 0 }, { monthISO: '2026-07', amountMinor: 0, partial: false, count: 2 },
    { monthISO: '2026-08', amountMinor: 1000, partial: false, count: 1 }, { monthISO: '2026-09', amountMinor: -600, partial: true, count: 0 }];
  const chart = chartsModule(i18n).MonthBars({ points, selected: '2026-09', onSelect: () => {}, currency: 'ARS' });
  const bars = flat(chart).filter(node => typeof node.type === 'function');
  assert.deepEqual(bars.map(bar => bar.props.fraction), [0, 0, 1, 0], 'clamped at zero on a scale of 0 to the largest positive net');
  const labels = bars.map(bar => bar.type(bar.props).props.accessibilityLabel);
  assert.equal(labels[0], 'junio 2026, 0,00 pesos', 'a month without records is not «sin gasto neto»: no records is not no spending');
  assert.equal(labels[1], 'julio 2026, 0,00 pesos, sin gasto neto');
  assert.equal(labels[2], 'agosto 2026, 10,00 pesos');
  assert.equal(labels[3], 'septiembre 2026, ' + i18n.spokenMoney(-600, 'ARS') + ', sin gasto neto, mes en curso');
  for (const bar of bars) {
    const height = bar.type(bar.props).props.children.props.style[1]().height;
    assert.ok(height >= 0, 'never a bar below the axis');
  }
  const captions = flat(chart).filter(node => node.type === 'AppText').map(node => String(node.props.children));
  assert.ok(captions.includes('Mes en curso hasta hoy · escala de 0 a $ 10'), captions.join(' | '));
  assert.ok(captions.includes('Septiembre: las devoluciones superan lo gastado (' + i18n.moneyText(-600, 'ARS') + ')'), captions.join(' | '));
  // Its spoken twin: VoiceOver hears the net in words, never the visible «−$ 6,00».
  const caption = flat(chart).find(node => node.type === 'AppText' && String(node.props.children).startsWith('Septiembre: '))!;
  assert.equal(caption.props.accessibilityLabel, 'septiembre: las devoluciones superan lo gastado (' + i18n.spokenMoney(-600, 'ARS') + ')');
  assert.notEqual(i18n.spokenMoney(-600, 'ARS'), i18n.moneyText(-600, 'ARS'), 'the twin differs from what is shown');
  const august = chartsModule(i18n).MonthBars({ points, selected: '2026-08', onSelect: () => {}, currency: 'ARS' });
  assert.equal(flat(august).filter(node => node.type === 'AppText').length, 1, 'a month above zero gets no extra line');
  const english = chartsModule(bindLocale('en-US')).MonthBars({ points, selected: '2026-09', onSelect: () => {}, currency: 'ARS' });
  const englishBars = flat(english).filter(node => typeof node.type === 'function').map(bar => bar.type(bar.props).props.accessibilityLabel);
  assert.ok(englishBars[3].endsWith(', no net spending, month in progress'));
});

/** spending-chart.tsx and spending-timeline.tsx with their hosts as descriptors (24T3 guards). */
function realModule(file: string, i18n: ReturnType<typeof bindLocale>, extra: Record<string, unknown> = {}) {
  const source = readFileSync(new URL('../src/ui/' + file, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const jsx = (type: any, props: any) => ({ type, props });
  const modules: Record<string, any> = {
    '../i18n/provider': { useI18n: () => i18n }, '../i18n/format': i18nFormat, '../i18n/locale': { DEFAULT_LOCALE },
    react: { useEffect: () => {} },
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'react-native': { View: 'View', ScrollView: 'ScrollView', useWindowDimensions: () => ({ fontScale: 1, width: 393 }), StyleSheet: { hairlineWidth: 0.5 } },
    'react-native-reanimated': { __esModule: true, default: { View: 'AnimatedView' }, useSharedValue: (value: number) => ({ value }), useAnimatedStyle: (fn: () => any) => fn,
      withTiming: (value: number) => value, cancelAnimation: () => {} },
    'expo-router': { router: { push: () => {} } },
    '@expo/vector-icons/Ionicons': 'Icon', '@finanzapp/domain': domain,
    './components': { AppText: 'AppText', CategoryBadge: 'CategoryBadge', Money: 'Money', PressFeedback: 'PressFeedback', useStacked: () => false, rowAmountText },
    './geometry': geometry, './report-presentation': presentation,
    './category-hues': { useCategoryLook: (s: string) => ({ label: s, storedLabel: s, key: String(s).toLowerCase(), hex: '#3E6FB0', glyph: 'pricetag-outline' }) },
    './motion': { timing: () => ({ duration: 0 }) },
    './theme': { useReduceMotion: () => true, usePalette: () => ({ text: '#000', inset: '#ECEFF4', line: '#ddd', secondary: '#666', tertiary: '#999' }) },
    ...extra,
  };
  const module = { exports: {} as Record<string, (props: any) => any> };
  runInNewContext(code, { module, exports: module.exports, require: (name: string) => {
    if (!Object.hasOwn(modules, name)) throw new Error('Unexpected ' + file + ' dependency: ' + name);
    return modules[name];
  } });
  return module.exports;
}

test('24T3 (A24): a category row ≤ 0 reads «Sin gasto neto» (never «0 %» or a dash) and names its devoluciones; a row above zero keeps its share', () => {
  const i18n = bindLocale('es-AR');
  const rows = realModule('spending-chart.tsx', i18n);
  const ropa = { key: 'ropa', category: 'Ropa', amountMinor: -700, count: 0 };
  for (const name of ['CategoryLegendRow', 'CategorySpendingRow']) {
    const row = rows[name]({ category: ropa, totalMinor: 400, currency: 'ARS', onPress: () => {}, countLabel: '1 devolución' });
    assert.equal(row.props.accessibilityLabel, 'Ropa, ' + i18n.spokenMinor(-700, 'ARS') + ' ARS, sin gasto neto, 1 devolución', name);
    const shown = flat(row).filter(node => node.type === 'AppText').map(node => [node.props.children].flat().join(''));
    assert.ok(shown.some(text => text.startsWith('Sin gasto neto')), name + ': ' + shown.join(' | '));
    assert.equal(shown.some(text => /%|—|0 gastos/.test(text)), false, name + ': ' + shown.join(' | '));
    const comida = rows[name]({ category: { key: 'comida', category: 'Comida', amountMinor: 400, count: 1 }, totalMinor: 400, currency: 'ARS', onPress: () => {} });
    assert.match(comida.props.accessibilityLabel, /^Comida, 4,00 ARS, 100 % del gasto del mes, 1 gasto$/, name);
  }
});

test('24T3 (A24): the timeline clamps a span ≤ 0 at zero, says «sin gasto neto», and when nothing nets above zero it says so instead of a maximum', () => {
  const i18n = bindLocale('es-AR');
  const timeline = realModule('spending-timeline.tsx', i18n, { './components': { AppText: 'AppText', PressFeedback: 'PressFeedback' }, './motion': { timing: () => ({ duration: 0 }) },
    './theme': { useReduceMotion: () => true, usePalette: () => ({ text: '#000', line: '#ddd' }) } });
  const bucket = (startISO: string, amountMinor: number, count: number) => ({ currency: 'ARS', startISO, endISO: startISO, amountMinor, count });
  const tree = timeline.SpendingTimeline({ buckets: [bucket('2026-09-01', 500, 1), bucket('2026-09-02', -300, 0), bucket('2026-09-03', 0, 0)], currency: 'ARS' });
  const presses = flat(tree).filter(node => node.type === 'PressFeedback');
  assert.deepEqual(presses.map(press => flat(press).find(node => typeof node.type === 'function')!.props.fraction), [1, 0, 0]);
  assert.match(presses[1].props.accessibilityLabel, /, sin gasto neto, 0 gastos registrados$/);
  assert.equal(presses[2].props.accessibilityLabel.includes('sin gasto neto'), false, 'an empty span is not «sin gasto neto»');
  const negative = timeline.SpendingTimeline({ buckets: [bucket('2026-09-01', -300, 0), bucket('2026-09-02', 0, 0)], currency: 'ARS' });
  assert.ok(negative, 'a span of devoluciones is not «nothing to show»');
  assert.equal(String(flat(negative).find(node => node.type === 'AppText')!.props.children), 'Gasto registrado · sin gasto neto en estas fechas');
  assert.equal(timeline.SpendingTimeline({ buckets: [bucket('2026-09-01', 0, 0)], currency: 'ARS' }), null, 'no records at all: nothing');
});
