import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as geometry from '../src/ui/geometry.ts';
import * as domain from '@finanzapp/domain';
import * as presentation from '../src/ui/presentation.ts';
import * as reportPresentation from '../src/ui/report-presentation.ts';
import * as displayCurrency from '../src/ui/display-currency.ts';
import * as financeView from '../src/fx/finance-view.ts';
import * as fxCopy from '../src/fx/fx-copy.ts';
import * as ratesStore from '../src/fx/rates-store.ts';
import * as budgetPresentation from '../src/ui/budget-presentation.ts';
import * as categoryColor from '../src/ui/category-color.ts';
import * as homeFocus from '../src/ui/home-focus.ts';
import { darkPalette, lightPalette } from '../src/ui/palette.ts';
import { monthlyEvidence } from '../src/integrations/evidence.ts';
import { integrationClient } from '../src/integrations/client.ts';
import * as i18nFormat from '../src/i18n/format.ts';
import { bindLocale } from '../src/i18n/bind.ts';
import type { AppLocale } from '../src/i18n/locale.ts';
import { home as esHome } from '../src/i18n/messages/es/home.ts';
import { home as enHome } from '../src/i18n/messages/en/home.ts';
// Read on every render, like the live provider; a test may switch it and must restore it.
let locale: AppLocale = 'es-AR';
const i18nProvider = { useI18n: () => bindLocale(locale) };
/** The harness's category glyphs are one per category name; a test may alias a category onto another's glyph. */
const glyphAliases = new Map<string, string>();
/** The scheme the harness palette follows (the real Forest values); a test may switch it and must restore it. */
let dark = false;
const harnessPalette = () => {
  const base = dark ? darkPalette : lightPalette;
  return { ...base, isDark: dark, positive: base.income, negative: base.expense, positiveSoft: base.incomeSoft, negativeSoft: base.expenseSoft };
};
/** The day the harness's `useCurrentDay` answers; a test may move it and must restore it. */
let today = '2026-09-12';
// 25OPS1: what the shared dock hook hands a tab root; off the tabs by default, a test sets the in-tabs value.
let dock: { extraPadding: number; indicator: { bottom: number } | undefined } = { extraPadding: 0, indicator: undefined };
/** The safe area of an iPhone with a Dynamic Island, portrait. */
const INSETS = { top: 47, bottom: 34, left: 0, right: 0 };

// Exercise the actual routes' data/handlers with host components replaced by
// descriptors. This is NOT a rendered iOS screen or gesture/animation test.
type Node = { type: string; props: Record<string, any>; key?: string };
const createdAt = '2026-09-12T12:00:00Z';
const snapshot: domain.LedgerSnapshot = { accounts: [
  { id: 'a', name: 'ARS de prueba', currency: 'ARS', openingMinor: 10000, createdAt },
  { id: 'u', name: 'USD de prueba', currency: 'USD', openingMinor: 10000, createdAt },
], entries: [
  { id: 'a', accountId: 'a', kind: 'expense', amountMinor: 101, merchant: 'Prueba', category: 'Salud', dateISO: '2026-08-31', createdAt },
  { id: 'b', accountId: 'a', kind: 'expense', amountMinor: 202, merchant: 'Prueba', category: 'SALUD', dateISO: '2026-08-10', createdAt },
  { id: 'c', accountId: 'a', kind: 'expense', amountMinor: 303, merchant: 'Prueba', category: 'Salud extra', dateISO: '2026-08-10', createdAt },
  { id: 'u', accountId: 'u', kind: 'expense', amountMinor: 999, merchant: 'Prueba', category: 'Salud', dateISO: '2026-08-10', createdAt },
] };

/** The shared display currency of Inicio and Reportes (24B6), on the real store over a key-value store in memory; a test may hand one store to two screens.
 * The tests written before 24C1 exercise one currency at a time, so the harness starts in `single` mode unless a test says otherwise. */
function displayStore(initial: Record<string, string> = {}) {
  const rows = new Map(Object.entries({ [displayCurrency.DISPLAY_MODE_KEY]: 'single', ...initial }));
  return displayCurrency.createDisplayCurrencyStore(() => ({ getItemSync: (key: string) => rows.get(key) ?? null, setItemSync: (key: string, value: string) => { rows.set(key, value); }, removeItemSync: (key: string) => rows.delete(key) }));
}

function routeHarness(file: string, params: Record<string, unknown>, initialData = snapshot, extra: Partial<domain.LedgerArchive> = {}, display = displayStore(),
  rates: { book: domain.RateBook; activity?: ratesStore.RatesActivity; ensured?: { months: readonly string[]; quotes: readonly string[] }[] } = { book: domain.rateBook([]) }) {
  // The ledger as the provider hands it; `setData` stands for a write landing while the screen stays mounted.
  let data = initialData;
  const displayProvider = { useDisplayCurrency: (held: readonly domain.Currency[]) => ({ currency: displayCurrency.resolveDisplayCurrency(display.getState(), held, display.getMode()),
    preferred: display.getState(), mode: display.getMode(), setCurrency: (currency: domain.Currency) => { display.set(currency); }, setMode: (mode: displayCurrency.DisplayMode) => { display.setMode(mode); } }) };
  // 24C1: the finance view as the provider builds it, over a fixed rate book (no network); `ensured` records what the screen asked for.
  const ratesProvider = { useFinanceView: (months: readonly string[], currency?: domain.Currency) => {
    const held = presentation.historyCurrencies(data.accounts);
    // 25B2: with one currency in the whole history the view is that currency's own ledger, whatever the preference says (rates-provider.tsx).
    const mode = held.length <= 1 ? 'single' : display.getMode();
    const target = currency ?? (held.length <= 1 ? held[0] ?? displayCurrency.resolveDisplayCurrency(display.getState(), held, mode) : displayCurrency.resolveDisplayCurrency(display.getState(), held, mode));
    const built = financeView.financeView(data, mode, target, rates.book);
    if (built.quotes.length) rates.ensured?.push({ months, quotes: built.quotes });
    return { ...built, activity: rates.activity ?? 'idle', loaded: true, lastFetchedAt: null, book: rates.book, held };
  } };
  const source = readFileSync(new URL('../app/' + file, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  // The element's key is kept (the JSX runtime passes it apart from the props), so a test can read a row's key.
  const jsx = (type: string, props: Record<string, unknown>, key?: string) => key === undefined ? { type, props } : { type, props, key };
  const state: unknown[] = [];
  const deps: unknown[][] = [];
  const refs: { current: unknown }[] = [];
  /** `router.push` and `router.navigate` are recorded apart: a tab root is selected (navigate), a screen is pushed. */
  const pushed: any[] = [];
  const navigated: any[] = [];
  /** Every `setStatusBarStyle(style)` the screen asked for, in order. */
  const statusBar: string[] = [];
  // Inicio's focus effect: run once when the screen first renders focused (like React Navigation on mount), its cleanup on blur.
  let focusEffect: (() => void | (() => void)) | undefined, focusCleanup: void | (() => void), focusedOnce = false;
  let cursor = 0, effectCursor = 0, refCursor = 0;
  const componentNames = ['AppText', 'Choices', 'DetailRow', 'EmptyState', 'IconButton', 'InfoButton', 'Money', 'PressFeedback', 'SectionTitle', 'Surface', 'CategoryBadge', 'Screen', 'EntryActions', 'EntryRow', 'TransferRow', 'ActionButton', 'GlyphTile', 'Stat', 'NavigationRow'];
  const modules: Record<string, unknown> = {
    '../i18n/format': i18nFormat, '../src/i18n/format': i18nFormat, '../../src/i18n/format': i18nFormat, '../i18n/provider': i18nProvider, '../src/i18n/provider': i18nProvider, '../../src/i18n/provider': i18nProvider,
    // Effects run in place, once per change of their dependencies (a route parameter arriving), like React's after commit.
    react: { useEffect: (fn: () => void, next?: unknown[]) => { const index = effectCursor++; const previous = deps[index];
      if (!previous || !next || next.length !== previous.length || next.some((item, i) => item !== previous[i])) { deps[index] = next ?? []; fn(); } },
    useMemo: (fn: () => unknown) => fn(), useCallback: <T,>(fn: T) => fn,
    // A ref persists by call order across renders, like React's.
    useRef: (initial?: unknown) => { const index = refCursor++; return refs[index] ??= { current: initial }; },
    useState: (initial?: unknown) => {
      const index = cursor++;
      if (!(index in state)) state[index] = initial;
      return [state[index], (value: unknown) => { state[index] = typeof value === 'function' ? (value as (current: unknown) => unknown)(state[index]) : value; }];
    } },
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'react-native': { View: 'View', ScrollView: 'ScrollView', FlatList: 'FlatList', StyleSheet: { hairlineWidth: 1, create: <T,>(styles: T) => styles, absoluteFill: {} }, useWindowDimensions: () => ({ width: 393, height: 852, fontScale: 1, scale: 3 }) },
    'react-native-reanimated': { __esModule: true, default: { View: 'Animated.View', FlatList: 'FlatList' },
      useSharedValue: (value: number) => ({ value }), withTiming: (value: number) => value,
      useAnimatedStyle: (fn: () => unknown) => fn() },
    'react-native-safe-area-context': { useSafeAreaInsets: () => INSETS },
    'expo-status-bar': { setStatusBarStyle: (style: string) => { statusBar.push(style); } },
    'expo-router': { useLocalSearchParams: () => params, router: { push: (to: unknown) => pushed.push(to), navigate: (to: unknown) => navigated.push(to) },
      useFocusEffect: (effect: () => void | (() => void)) => { focusEffect = effect; if (!focusedOnce) { focusedOnce = true; focusCleanup = effect(); } } },
    '@finanzapp/domain': domain,
    '../src/storage/LedgerProvider': { useLedger: () => ({ snapshot: data, archive: { accounts: data.accounts, records: [], ...extra } }) },
    '../src/ui/components': { ...Object.fromEntries(componentNames.map(name => [name, name])), useStacked: () => false },
    '../src/ui/currency-switch': { CurrencySwitch: 'CurrencySwitch', DisplayCurrencyButton: 'DisplayCurrencyButton' },
    '../src/ui/display-currency-provider': displayProvider, '../src/ui/display-currency': displayCurrency,
    '../src/fx/rates-provider': ratesProvider, '../src/fx/finance-view': financeView, '../src/fx/fx-copy': fxCopy, '../src/fx/rates-store': ratesStore,
    '../src/ui/entry-list': { EntryList: 'EntryList' },
    '../src/ui/presentation': presentation,
    '../src/ui/report-presentation': reportPresentation,
    '../src/ui/spending-chart': { CategorySpendingRow: 'CategorySpendingRow', CategoryLegendRow: 'CategoryLegendRow' },
    '../src/ui/geometry': geometry,
    '../src/ui/charts': { DonutChart: 'DonutChart', MonthBars: 'MonthBars', OTHERS_KEY: ' others', MONEY_MAX_SCALE: 1.8,
      donutSlices: (items: { key: string; label: string; value: number }[]) => items.slice(0, 5).map((item, index) => ({ ...item, color: 'c' + index })) },
    '../src/ui/budget-presentation': budgetPresentation,
    '@expo/vector-icons/Ionicons': 'Ionicons',
    // 24UX6A: no insight row, no capture module and no quick actions are mapped: Inicio importing one fails loudly here.
    // 24UX6C2: the general budget's attention row is the one budget module Inicio may draw.
    '../src/ui/home-modules': { BudgetAttentionRow: 'BudgetAttentionRow', CurrencyParts: 'CurrencyParts', FieldButton: 'FieldButton', MetricHelp: 'MetricHelp', UpcomingRecurringRow: 'UpcomingRecurringRow' },
    '../src/ui/home-focus': homeFocus,
    '../src/ui/category-color': categoryColor,
    '../src/ui/category-hues': { useCategoryColor: () => '#3E6FB0', useCategoryLabel: (s: string) => s, useCategoryDefinitions: () => [], useCategoryLook: (s: string) => ({ label: s, storedLabel: s, key: String(s).toLowerCase(), hex: '#3E6FB0', glyph: 'pricetag-outline' }), useCategoryLookOf: () => (s: string) => ({ label: s, storedLabel: s, key: String(s).toLowerCase(), hex: '#3E6FB0', glyph: glyphAliases.get(s) ?? 'glyph-' + String(s).toLowerCase() }), useAccountLook: () => ({ icon: 'wallet', color: 'cobalt', glyph: 'wallet-outline', hex: '#2557D6' }), useAccountNameOf: () => (account: any) => account.name, useAccountLookOf: () => () => ({ icon: 'wallet', color: 'cobalt', glyph: 'wallet-outline', hex: '#2557D6' }) },
    '../src/ui/dock-clearance': { useDockInset: () => dock },
    '../src/ui/motion': { ValueTransition: 'ValueTransition', Reflow: 'Reflow', rowReorder: 'rowReorder', selectionHaptic: () => {}, impactHaptic: () => {}, duration: { press: 100, release: 160, state: 200, data: 260, enter: 200, exit: 100, reveal: 480 }, timing: (kind: string, reduced: boolean) => ({ duration: reduced ? 0 : 260 }) },
    '../src/ui/theme': { useCurrentDay: () => today, useReduceMotion: () => false, space: { xs: 4, s: 8, m: 12, l: 16, xl: 20, xxl: 24, xxxl: 32 },
      usePalette: harnessPalette },
  };
  modules['../src/ui/spending-timeline'] = { SpendingTimeline: 'SpendingTimeline', periodLabel: (p: any) => p.startISO + '–' + p.endISO };
  for (const name of Object.keys(modules)) if (name.startsWith('../src/')) modules['../' + name] = modules[name];
  const module = { exports: {} as { default?: () => Node } };
  runInNewContext(code, { module, exports: module.exports, require: (name: string) => {
    if (!Object.hasOwn(modules, name)) throw new Error('Unexpected report dependency: ' + name);
    return modules[name];
  } });
  return { render: () => { cursor = 0; effectCursor = 0; refCursor = 0; return module.exports.default!(); }, pushed, navigated, statusBar, display,
    setData: (next: domain.LedgerSnapshot) => { data = next; },
    /** Another screen comes in front (the focus effect's cleanup), and Inicio comes back (the effect again). */
    blur: () => { if (typeof focusCleanup === 'function') focusCleanup(); focusCleanup = undefined; },
    focus: () => { focusCleanup = focusEffect?.(); } };
}
const homeSource = readFileSync(new URL('../app/(tabs)/index.tsx', import.meta.url), 'utf8');

function nodes(value: any): Node[] {
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!value.props) return [];
  return [value, ...nodes(value.props.children), ...nodes(value.props.ListHeaderComponent),
    ...nodes(value.props.ListEmptyComponent), ...nodes(value.props.ListFooterComponent), ...nodes(value.props.header)];
}
function find(root: Node, type: string, label?: string) {
  const node = nodes(root).find(item => item.type === type && (!label || item.props.label === label || item.props.accessibilityLabel === label || item.props.action === label));
  assert.ok(node, 'Missing ' + type + ' ' + (label ?? ''));
  return node;
}
/** 24UX6D: Reportes has no KPI amount any more; its currency is the donut's (Categorías) or, without one, the chip's. */
const reportsCurrency = (root: Node) => (nodes(root).find(n => n.type === 'DonutChart') ?? find(root, 'DisplayCurrencyButton')).props.currency;


const homeData = { ...snapshot, entries: [...snapshot.entries,
  { ...snapshot.entries[0], id: 'early', dateISO: '2026-09-01', amountMinor: 100 },
  { ...snapshot.entries[0], id: 'now', dateISO: '2026-09-11', amountMinor: 200 },
  { ...snapshot.entries[0], id: 'income', kind: 'income' as const, dateISO: '2026-09-12', amountMinor: 500 },
  { ...snapshot.entries[0], id: 'usd', accountId: 'u', dateISO: '2026-09-11', amountMinor: 1000 },
] };
// Synthetic rates from a fixed book (no network): 1 USD = 1000 ARS from the 1st, 2000 ARS from the 10th.
const consolidatedRates = () => domain.rateBook([
  { base: 'USD', quote: 'ARS', rate: '1000', effectiveDate: '2026-09-01', source: 'Frankfurter', fetchedAt: '2026-09-12T12:00:00.000Z' },
  { base: 'USD', quote: 'ARS', rate: '2000', effectiveDate: '2026-09-10', source: 'Frankfurter', fetchedAt: '2026-09-12T12:00:00.000Z' },
]);
/** The text of an `AppText` (an interpolated child is an array). */
const textOf = (node: Node) => [node.props.children].flat().join('');
const homeTexts = (root: Node) => nodes(root).filter(node => node.type === 'AppText').map(textOf);
const sectionTitles = (root: Node) => nodes(root).filter(node => node.type === 'SectionTitle').map(node => node.props.children);
/** The pine financial field: the one view that measures itself for the status bar. */
const fieldOf = (root: Node) => { const field = nodes(root).find(node => node.type === 'View' && typeof node.props.onLayout === 'function'); assert.ok(field, 'Missing the financial field'); return field; };
const monthOf = (root: Node) => { const month = nodes(fieldOf(root)).find(node => node.type === 'AppText' && node.props.accessibilityRole === 'header'); assert.ok(month, 'Missing the month'); return month; };
const fieldChildren = (root: Node) => [fieldOf(root).props.children].flat().filter(Boolean) as Node[];
/** The line 24UX6A drew under the number (24UX6C removed it): any of its forms, in Spanish or English. */
const SUBLINE = /por día|Hasta hoy|Sin gastos este mes|Saldo registrado|cuentas? *$|a day|So far|No spending this month|Recorded balance|accounts? *$/;
const sublineOf = (root: Node) => homeTexts(fieldOf(root)).find(text => SUBLINE.test(text));
/** 24UX6C: no line under the number, anywhere on Inicio (the field's only text is the month, unless the number is out of range). */
const assertNoSubline = (root: Node, label: string) => {
  assert.equal(sublineOf(root), undefined, label + ': no line under the number');
  assert.equal(homeTexts(root).some(text => SUBLINE.test(text)), false, label + ': no per-day, «Sin gastos» or «Saldo registrado» text on Inicio');
  // The number's block holds the number (or the currencies' parts, or the out-of-range notice) and its help; never a caption.
  const outOfRange = [esHome.home.spendingOutOfRange, esHome.home.balanceOutOfRange, enHome.home.spendingOutOfRange, enHome.home.balanceOutOfRange];
  assert.equal(nodes(find(root, 'ValueTransition')).filter(n => n.type === 'AppText').every(n => outOfRange.includes(textOf(n))), true, label + ': the number\'s block holds no caption');
};
const metricOf = (root: Node) => nodes(root).find(n => n.type === 'Choices' && (n.props.value === 'spending' || n.props.value === 'available'))!;
/** A synthetic rule due three days after the harness day (2026-09-12), inside the 30-day commitment window. */
const dueRule = (id = 'r', overrides: Partial<domain.RecurringRule> = {}): domain.RecurringRule => ({ id, accountId: 'a', kind: 'expense', amountMinor: 100, merchant: 'Netflix',
  category: 'Suscripciones', frequency: 'monthly', anchorDateISO: '2026-09-15', nextDateISO: '2026-09-15', active: true, deleted: false, createdAt, revision: 0, updatedAt: createdAt, ...overrides });
/** Every type on Inicio that would be a retired module: capture, insight, ranking, budget, chart, Assistant banner. */
const RETIRED = ['CaptureButton', 'CaptureAction', 'CaptureHub', 'HomeInsightRow', 'QuickActions', 'AssistantEntry', 'AssistantBanner', 'CategoryRanking', 'CategorySpendingRow',
  'CategoryLegendRow', 'BudgetHomeCard', 'DonutChart', 'MonthBars', 'SpendingTimeline', 'EntryList'];

test('24UX6A: Inicio shows the current month only, scoped to the currency, with no capture button and no period control', () => {
  const view = routeHarness('(tabs)/index.tsx', {}, homeData);
  let root = view.render();
  assert.equal(find(root, 'Money').props.minor, 300, 'September expenses in ARS');
  assert.equal(nodes(root).some(n => n.type === 'Choices' && (n.props.value === 'month' || n.props.value === 'week')), false, 'no period control: Home is the month');
  const texts = homeTexts(root);
  assert.equal(texts.some(text => /gastos? registrados?|–|Gastado ·/.test(text)), false, 'no count or date-range copy near the hero');
  assert.ok(texts.includes('Septiembre'), 'the month names the number');
  assert.equal(nodes(root).some(n => RETIRED.includes(n.type)), false, 'recording is the dock\'s «+», not a button on Inicio');
  find(root, 'DisplayCurrencyButton').props.onCurrency('USD');
  root = view.render();
  assert.equal(find(root, 'Money').props.minor, 1000);
  assert.deepEqual(nodes(root).filter(n => n.type === 'EntryRow').map(n => n.props.entry.id).join(), 'usd', 'the month\'s activity follows the currency shown');
});

test('24UX6A, 24UX6C: the pine field comes first: the month and the accounts, the scope (two currencies), the number, Gastado | Disponible; then the sections', () => {
  const view = routeHarness('(tabs)/index.tsx', {}, homeData, { recurring: [dueRule()] });
  const root = view.render();
  assert.equal(root.type, 'ScrollView', 'Inicio scrolls on its own, with no navigation header');
  assert.equal(root.props.contentInsetAdjustmentBehavior, 'never', 'the field meets the top edge itself');
  const field = fieldOf(root);
  assert.equal(nodes(root).find(n => n.type === 'View' && n.props.style?.backgroundColor === lightPalette.hero && typeof n.props.onLayout === 'function'), field);
  assert.deepEqual([field.props.style.backgroundColor, field.props.style.paddingTop, field.props.style.borderBottomLeftRadius, field.props.style.borderBottomRightRadius],
    [lightPalette.hero, INSETS.top + 12, 32, 32], 'pine, under the status bar plus 12 pt, 32 pt bottom corners');
  // The field's own order.
  const inField = nodes(field).map(n => n.type === 'AppText' && n.props.accessibilityRole === 'header' ? 'month' : n.type === 'AppText' && SUBLINE.test(textOf(n)) ? 'subline' : n.type)
    .filter(type => ['month', 'FieldButton', 'DisplayCurrencyButton', 'MetricHelp', 'Money', 'CurrencyParts', 'subline', 'Choices'].includes(type));
  assert.equal(inField.join('|'), 'month|FieldButton|DisplayCurrencyButton|Money|Choices', '24UX6C: no line under the number');
  assert.equal(fieldChildren(root).map(n => n.type).join('|'), 'View|View|ValueTransition|Choices', 'row 1, the scope row, the number, the metric');
  assertNoSubline(root, 'two currencies, Gastado');
  // Everything outside the field follows it.
  const all = nodes(root);
  const afterField = all.slice(all.indexOf(field) + nodes(field).length);
  assert.equal(afterField.filter(n => n.type === 'SectionTitle').map(n => n.props.children).join('|'), 'Próximos compromisos|Actividad reciente');
  assert.equal(nodes(field).some(n => n.type === 'SectionTitle' || n.type === 'EntryRow' || n.type === 'UpcomingRecurringRow'), false);
  // The accounts shortcut.
  const wallet = find(field, 'FieldButton');
  assert.deepEqual([wallet.props.icon, wallet.props.label], ['wallet-outline', 'Ver mis cuentas']);
  wallet.props.onPress();
  assert.equal(view.pushed.at(-1), '/accounts');
  // The number: 46 pt, the field's ink.
  const hero = find(root, 'Money');
  assert.deepEqual([hero.props.large, hero.props.size, hero.props.color], [true, 46, lightPalette.heroInk]);
  // Gastado | Disponible on the field.
  const metric = find(field, 'Choices');
  assert.equal(metric.props.onField, true);
  assert.equal(metric.props.value, 'spending', 'Gastado first');
  assert.equal(metric.props.options.map((option: { value: string; label: string }) => option.value + ':' + option.label).join(), 'spending:Gastado,available:Disponible');
  assert.equal(nodes(root).filter(n => n.type === 'Choices').length, 1, 'one control on the field');
  assert.equal(homeTexts(root).includes('Inicio'), false, 'the selected tab names the screen');
});

test('24UX6A: the month is the current one, a header label, never a control: no press, no chevron, it opens nothing', () => {
  const view = routeHarness('(tabs)/index.tsx', {}, homeData);
  const root = view.render();
  const month = monthOf(root);
  assert.equal(textOf(month), 'Septiembre', 'the harness day is 2026-09-12');
  assert.equal(month.props.color ?? month.props.style?.color, lightPalette.heroInk);
  for (const prop of ['onPress', 'onLongPress', 'onPressIn', 'accessibilityHint', 'accessibilityActions']) assert.equal(prop in month.props, false, 'the month has no ' + prop);
  assert.equal(month.props.accessibilityRole, 'header', 'a header, not a button');
  // No ancestor turns it into a control.
  const pressable = nodes(root).filter(n => typeof n.props.onPress === 'function' || typeof n.props.onLongPress === 'function');
  assert.equal(pressable.some(n => nodes(n).includes(month)), false, 'no pressable wraps the month');
  const row = nodes(fieldOf(root)).find(n => n.type === 'View' && [n.props.children].flat().includes(month))!;
  assert.equal([row.props.children].flat().filter(Boolean).map((n: Node) => n.type).join('|'), 'AppText|FieldButton', 'the month and the accounts, nothing else in the row');
  assert.equal(typeof row.props.onPress, 'undefined');
  assert.equal(nodes(fieldOf(root)).some(n => /chevron/.test(String(n.props.name ?? n.props.icon ?? ''))), false, 'no chevron on the field');
  assert.equal(/chevron/.test(homeSource), false, 'Inicio draws no chevron');
  assert.equal(/formatDate\(day, 'month'\)/.test(homeSource), true, 'the label is today\'s month');
  // The day moves, the label follows; nothing on Inicio picks another month.
  assert.equal(nodes(root).some(n => n.type === 'Choices' && n.props.value !== 'spending' && n.props.value !== 'available'), false);
  assert.equal(view.pushed.length + view.navigated.length, 0, 'rendering opens nothing');
});

test('24UX6C: with one currency the scope row is absent (no empty row) and the help sits beside the number; with two the chip is on the field with its help', () => {
  const onlyPesos: domain.LedgerSnapshot = { accounts: [homeData.accounts[0]], entries: homeData.entries.filter(entry => entry.accountId === 'a') };
  const single = routeHarness('(tabs)/index.tsx', {}, onlyPesos);
  let root = single.render();
  assert.equal(nodes(root).some(n => n.type === 'DisplayCurrencyButton'), false, 'one currency: nothing to choose');
  assert.equal(fieldChildren(root).map(n => n.type).join('|'), 'View|ValueTransition|Choices', 'no scope row, not even an empty one');
  // Gastado in its own currency: nothing converted, so nothing to explain: the number alone in its row.
  const numberRow = (at: Node) => [find(at, 'ValueTransition').props.children].flat().filter(Boolean) as Node[];
  assert.equal(numberRow(root).map(n => n.type).join('|'), 'View', 'Gastado unconverted: no help');
  assert.equal(nodes(root).some(n => n.type === 'MetricHelp'), false);
  assert.ok(nodes(numberRow(root)[0]).some(n => n.type === 'Money'), 'the number fills the row');
  assertNoSubline(root, 'one currency, Gastado');
  metricOf(root).props.onChange('available');
  root = single.render();
  assert.equal(fieldChildren(root).map(n => n.type).join('|'), 'View|ValueTransition|Choices');
  const help = find(root, 'MetricHelp');
  assert.deepEqual([help.props.title, help.props.detail, help.props.color], ['Disponible', bindLocale('es-AR').t('home.availableHelp'), lightPalette.heroSecondary]);
  // The help is a direct child of the number's row (the keyed ValueTransition), beside the number's own view.
  const transition = find(root, 'ValueTransition');
  assert.equal(transition.props.style.flexDirection, 'row', 'the number and its help share one row');
  assert.equal(numberRow(root).map(n => n.type).join('|'), 'View|MetricHelp', 'the help beside the number, after it');
  assert.equal(numberRow(root)[1], help);
  assert.ok(nodes(numberRow(root)[0]).some(n => n.type === 'Money'));
  assert.equal(nodes(root).filter(n => n.type === 'MetricHelp').length, 1, 'one help');
  assertNoSubline(root, 'one currency, Disponible');

  const two = routeHarness('(tabs)/index.tsx', {}, homeData);
  root = two.render();
  const scopeRow = fieldChildren(root)[1];
  assert.equal(scopeRow.type, 'View');
  const chip = find(scopeRow, 'DisplayCurrencyButton');
  assert.equal(chip.props.onField, true, 'the chip is drawn for the pine field');
  assert.deepEqual(chip.props.held, ['ARS', 'USD']);
  assert.equal(nodes(find(root, 'ValueTransition')).some(n => n.type === 'DisplayCurrencyButton'), false, 'outside the keyed crossfade');
  metricOf(root).props.onChange('available');
  root = two.render();
  const row = fieldChildren(root)[1];
  assert.equal([row.props.children].flat().filter(Boolean).map((n: Node) => n.type).join('|'), 'DisplayCurrencyButton|MetricHelp', 'the chip and its help share the row');
  assert.equal(nodes(find(root, 'ValueTransition')).some(n => n.type === 'MetricHelp'), false, 'one help, in the scope row');
  // Consolidated spending: the rate's help, in the same row.
  const consolidated = routeHarness('(tabs)/index.tsx', {}, homeData, {}, displayStore({ [displayCurrency.DISPLAY_MODE_KEY]: 'consolidated' }), { book: consolidatedRates() }).render();
  assert.equal([fieldChildren(consolidated)[1].props.children].flat().filter(Boolean).map((n: Node) => n.type).join('|'), 'DisplayCurrencyButton|MetricHelp');
});

test('24UX6C: no line under the number in Gastado or Disponible, in Spanish or English, with one or several currencies, in any mode or amount', () => {
  const onlyPesos: domain.LedgerSnapshot = { accounts: [homeData.accounts[0]], entries: homeData.entries.filter(entry => entry.accountId === 'a') };
  const consolidatedStore = () => displayStore({ [displayCurrency.DISPLAY_MODE_KEY]: 'consolidated' });
  const cases = () => [
    ['one currency', routeHarness('(tabs)/index.tsx', {}, onlyPesos)],
    ['two currencies, single', routeHarness('(tabs)/index.tsx', {}, homeData)],
    ['two currencies, consolidated', routeHarness('(tabs)/index.tsx', {}, homeData, {}, consolidatedStore(), { book: consolidatedRates() })],
    ['quiet month', routeHarness('(tabs)/index.tsx', {}, snapshot)],
    ['zero balance', routeHarness('(tabs)/index.tsx', {}, { accounts: [{ ...snapshot.accounts[0], openingMinor: 0 }], entries: [] })],
    ['huge balance', routeHarness('(tabs)/index.tsx', {}, { accounts: [{ ...snapshot.accounts[0], openingMinor: 9_999_999_999_999 }], entries: [] })],
    ['missing rate', routeHarness('(tabs)/index.tsx', {}, homeData, {}, displayStore({ [displayCurrency.DISPLAY_MODE_KEY]: 'consolidated', [displayCurrency.DISPLAY_CURRENCY_KEY]: 'EUR' }),
      { book: consolidatedRates(), activity: 'offline' })],
  ] as const;
  for (const language of ['es-AR', 'en-AR'] as const) {
    locale = language;
    try {
      for (const [label, harness] of cases()) {
        assertNoSubline(harness.render(), language + ', ' + label + ', Gastado');
        metricOf(harness.render()).props.onChange('available');
        assertNoSubline(harness.render(), language + ', ' + label + ', Disponible');
      }
    } finally { locale = 'es-AR'; }
  }
  // With a ready number the field's only words are the month: the number, the scope chip, the help and the metric speak for themselves.
  assert.equal(JSON.stringify(homeTexts(fieldOf(routeHarness('(tabs)/index.tsx', {}, homeData).render()))), JSON.stringify(['Septiembre']));
  // The copy and the helper are gone, not merely hidden.
  for (const key of ['perDay', 'noSpending', 'availableLine', 'recordedBalance', 'accounts']) {
    assert.equal(Object.hasOwn(esHome.home, key), false, 'es home.' + key + ' removed');
    assert.equal(Object.hasOwn(enHome.home, key), false, 'en home.' + key + ' removed');
    assert.equal(homeSource.includes("'home." + key), false, 'Inicio does not read home.' + key);
  }
  assert.equal(Object.hasOwn(homeFocus, 'spendingPerDay'), false, 'the per-day helper left with the line');
  assert.equal(/spendingPerDay|dailyAverageMinor|accountCount/.test(homeSource), false, 'Inicio computes no per-day figure or account count');
});

test('24UX6C: the hero numbers are byte-identical to the domain figures: Gastado the month to date, Disponible liquid accounts without cards or debts, consolidated per date', () => {
  const today = '2026-09-12';
  const card: domain.CreditCardProfile = { id: 'card', accountId: 'card-acc', issuer: '', last4: '', creditLimitMinor: null, closingDay: 1, dueDay: 10, active: true, deleted: false, createdAt, revision: 0, updatedAt: createdAt };
  const withCard: domain.LedgerSnapshot = { ...homeData, accounts: [...homeData.accounts, { id: 'card-acc', name: 'Visa', currency: 'ARS', openingMinor: -5000, createdAt }] };
  const deletedAt = '2026-09-20T10:00:00.000Z';
  const deletedUsd: domain.LedgerSnapshot = { ...homeData, accounts: homeData.accounts.map(account => account.id === 'u' ? { ...account, revision: 1, updatedAt: deletedAt, deletedAt } : account) };
  // Each case: the ledger, the mode and currency shown, the rate book and the cards; then the figures the domain gives and the values pinned before 24UX6C.
  const cases: { label: string; data: domain.LedgerSnapshot; mode: displayCurrency.DisplayMode; currency: domain.Currency; book: domain.RateBook; cards?: domain.CreditCardProfile[];
    spent: number; available: number }[] = [
    { label: 'single ARS', data: homeData, mode: 'single', currency: 'ARS', book: domain.rateBook([]), spent: 300, available: 9594 },
    { label: 'single USD', data: homeData, mode: 'single', currency: 'USD', book: domain.rateBook([]), spent: 1000, available: 10000 - 999 - 1000 },
    { label: 'consolidated ARS', data: homeData, mode: 'consolidated', currency: 'ARS', book: consolidatedRates(), spent: 100 + 200 + 2000000, available: 9594 + 16002000 },
    { label: 'card excluded', data: withCard, mode: 'single', currency: 'ARS', book: domain.rateBook([]), cards: [card], spent: 300, available: 10000 - 101 - 202 - 303 - 100 - 200 + 500 },
    { label: 'deleted USD account', data: deletedUsd, mode: 'consolidated', currency: 'ARS', book: consolidatedRates(), spent: 100 + 200 + 2000000, available: 9594 },
  ];
  for (const item of cases) {
    const view = financeView.financeView(item.data, item.mode, item.currency, item.book);
    const period = domain.spendingWindow(item.currency, 'month', today);
    const spent = financeView.spendingFigure(item.data, view, period, 'idle', true);
    const available = financeView.availableFigure(item.data, view, item.book, today, 'idle', true, item.cards ?? [], []);
    assert.equal(spent.status, 'ready', item.label);
    assert.equal(available.status, 'ready', item.label);
    if (spent.status !== 'ready' || available.status !== 'ready') continue;
    assert.deepEqual([spent.minor, available.minor], [item.spent, item.available], item.label + ': the domain figures as pinned before the change');
    const harness = routeHarness('(tabs)/index.tsx', {}, item.data, item.cards ? { cards: item.cards } : {},
      displayStore({ [displayCurrency.DISPLAY_MODE_KEY]: item.mode, [displayCurrency.DISPLAY_CURRENCY_KEY]: item.currency }), { book: item.book });
    const shown = (root: Node) => { const money = find(root, 'Money'); return JSON.stringify({ minor: money.props.minor, currency: money.props.currency }); };
    assert.equal(shown(harness.render()), JSON.stringify({ minor: spent.minor, currency: item.currency }), item.label + ': Gastado is spendingFigure, byte for byte');
    metricOf(harness.render()).props.onChange('available');
    assert.equal(shown(harness.render()), JSON.stringify({ minor: available.minor, currency: item.currency }), item.label + ': Disponible is availableFigure, byte for byte');
    assert.equal(Number.isInteger(spent.minor) && Number.isInteger(available.minor), true, 'integer minor units');
  }
});

test('24UX6A: the number is the field\'s ink at 46 pt, and the secondary ink when it is exactly zero; dark keeps the dark field', () => {
  let root = routeHarness('(tabs)/index.tsx', {}, homeData).render();
  assert.deepEqual([find(root, 'Money').props.size, find(root, 'Money').props.color], [46, lightPalette.heroInk]);
  root = routeHarness('(tabs)/index.tsx', {}, snapshot).render();
  assert.deepEqual([find(root, 'Money').props.minor, find(root, 'Money').props.color], [0, lightPalette.heroSecondary], 'a true zero reads quieter');
  assert.equal(/const HERO_SIZE = 46;/.test(homeSource), true);
  dark = true;
  try {
    root = routeHarness('(tabs)/index.tsx', {}, homeData).render();
    assert.deepEqual([fieldOf(root).props.style.backgroundColor, find(root, 'Money').props.color], [darkPalette.hero, darkPalette.heroInk]);
    assert.equal(monthOf(root).props.style.color, darkPalette.heroInk);
  } finally { dark = false; }
});

test('24UX6A: the status bar is light over the field, the scheme\'s own after scrolling past it or when another screen is in front', () => {
  const view = routeHarness('(tabs)/index.tsx', {}, homeData);
  let root = view.render();
  assert.equal(view.statusBar.join(), 'light', 'focused at the top: light content over the pine field');
  fieldOf(root).props.onLayout({ nativeEvent: { layout: { height: 320 } } });
  root.props.onScroll({ nativeEvent: { contentOffset: { y: 100 } } });
  assert.equal(view.statusBar.join(), 'light', 'still over the field: nothing changes');
  root.props.onScroll({ nativeEvent: { contentOffset: { y: 320 - INSETS.top + 1 } } });
  assert.equal(view.statusBar.at(-1), 'dark', 'past the field in light: dark text on the light canvas');
  root = view.render();
  root.props.onScroll({ nativeEvent: { contentOffset: { y: 0 } } });
  assert.equal(view.statusBar.at(-1), 'light', 'back over the field');
  view.blur();
  assert.equal(view.statusBar.at(-1), 'dark', 'another screen in front: the light scheme\'s own');
  const count = view.statusBar.length;
  root.props.onScroll({ nativeEvent: { contentOffset: { y: 5 } } });
  assert.equal(view.statusBar.length, count, 'no change while still over the field');
  view.focus();
  assert.equal(view.statusBar.at(-1), 'light', 'focused again at the top');
  dark = true;
  try {
    const night = routeHarness('(tabs)/index.tsx', {}, homeData);
    const nightRoot = night.render();
    assert.equal(night.statusBar.at(-1), 'light');
    fieldOf(nightRoot).props.onLayout({ nativeEvent: { layout: { height: 320 } } });
    nightRoot.props.onScroll({ nativeEvent: { contentOffset: { y: 600 } } });
    assert.equal(night.statusBar.at(-1), 'light', 'dark scheme: its own style is light too');
    night.blur();
    assert.equal(night.statusBar.at(-1), 'light');
  } finally { dark = false; }
});

/** Inicio's recent rows in order, an entry or a transfer, by the stored record's id. */
const recentRows = (root: Node) => nodes(root).filter(n => n.type === 'EntryRow' || n.type === 'TransferRow');
const recentIds = (root: Node) => recentRows(root).map(n => n.type === 'EntryRow' ? n.props.entry.id : n.props.transfer.id).join();

test('24UX6A, 24UX6C2: the month\'s latest expenses, incomes and transfers, newest first, six alone and four under commitments, counted after the merge; «Ver todos» selects Movimientos', () => {
  const at = '2026-09-01T12:00:00.000Z';
  const accounts: domain.Account[] = [{ id: 'a', name: 'Efectivo', currency: 'ARS', openingMinor: 0, createdAt: at }, { id: 'b', name: 'Banco', currency: 'ARS', openingMinor: 100000, createdAt: at },
    { id: 'u', name: 'Dólares', currency: 'USD', openingMinor: 0, createdAt: at }];
  const entry = (id: string, dateISO: string, kind: 'expense' | 'income' = 'expense', accountId = 'a'): domain.Entry =>
    ({ id, accountId, kind, amountMinor: 100, merchant: 'Comercio ' + id, category: kind === 'income' ? 'Sueldo' : 'Comida', dateISO, createdAt: dateISO + 'T10:00:00.000Z' });
  const data: domain.LedgerSnapshot = { accounts, entries: [entry('aug', '2026-08-31'), entry('s1', '2026-09-01'), entry('s2', '2026-09-02', 'income', 'b'), entry('s3', '2026-09-03'),
    entry('s4', '2026-09-05'), entry('s5', '2026-09-07', 'income'), entry('s6', '2026-09-09', 'expense', 'b'), entry('s7', '2026-09-11'), entry('s8', '2026-09-12'), entry('usd', '2026-09-12', 'expense', 'u')],
  transfers: [{ id: 't1', fromAccountId: 'b', toAccountId: 'a', amountMinor: 5000, note: 'Retiro', dateISO: '2026-09-12', createdAt: '2026-09-12T11:00:00.000Z' }] };
  const alone = routeHarness('(tabs)/index.tsx', {}, data);
  let root = alone.render();
  assert.equal(recentIds(root), 't1,s8,s7,s6,s5,s4', 'ARS shown: six rows, newest first, the transfer (recorded later the same day) among them; August and USD stay out');
  assert.equal(nodes(root).filter(n => n.type === 'EntryRow').every(n => n.props.entry.kind === 'expense' || n.props.entry.kind === 'income'), true);
  assert.equal(JSON.stringify(nodes(root).filter(n => n.type === 'EntryRow').map(n => n.props.entry.amountMinor)), JSON.stringify([100, 100, 100, 100, 100]), 'each row keeps its own amount');
  assert.equal(nodes(root).filter(n => n.type === 'TransferRow').length, 1, 'the transfer is one row');
  assert.equal(find(root, 'TransferRow').props.transfer.amountMinor, 5000, 'at its own amount');
  const surface = nodes(root).find(n => n.type === 'Surface' && nodes(n).some(child => child.type === 'EntryRow'))!;
  assert.equal(surface.props.grouped, true, 'a grouped surface');
  assert.equal(nodes(surface).some(n => n.type === 'TransferRow'), true, 'the transfer is in the same grouped list');
  assert.equal(recentRows(surface).at(-1)!.props.last, true);
  assert.equal(recentRows(surface).slice(0, -1).every(n => n.props.last === false), true, 'only the last row of the merged list is last');
  assert.equal(nodes(root).find(n => n.type === 'EntryRow')!.props.account.id, 'a', 'each row carries its own account');
  const title = nodes(root).find(n => n.type === 'SectionTitle' && n.props.children === 'Actividad reciente')!;
  assert.equal(title.props.action, 'Ver todos');
  title.props.onAction();
  assert.deepEqual([alone.navigated.at(-1), alone.pushed.length], ['/activity', 0], 'the tab root is selected, never pushed over Inicio');
  // A commitment this week: four rows under it, the transfer counted among the four.
  root = routeHarness('(tabs)/index.tsx', {}, data, { recurring: [dueRule()] }).render();
  assert.equal(sectionTitles(root).join('|'), 'Próximos compromisos|Actividad reciente');
  assert.equal(recentIds(root), 't1,s8,s7,s6');
  // Consolidated: every account, still six rows in all, the transfer once.
  root = routeHarness('(tabs)/index.tsx', {}, data, {}, displayStore({ [displayCurrency.DISPLAY_MODE_KEY]: 'consolidated' }), { book: consolidatedRates() }).render();
  assert.equal(recentIds(root), 't1,usd,s8,s7,s6,s5', 'equal times read by the record\'s key, so the order never shuffles');
  assert.equal(recentIds(root).split(',').filter(id => id === 't1').length, 1);
  // A movement of last month alone: no section.
  root = routeHarness('(tabs)/index.tsx', {}, { accounts, entries: [entry('aug', '2026-08-31')] }).render();
  assert.equal(sectionTitles(root).includes('Actividad reciente'), false);
  assert.equal(recentRows(root).length, 0);
  // A transfer of last month alone: no section either.
  root = routeHarness('(tabs)/index.tsx', {}, { accounts, entries: [], transfers: [{ ...data.transfers![0], dateISO: '2026-08-31', createdAt: '2026-08-31T10:00:00.000Z' }] }).render();
  assert.equal(sectionTitles(root).includes('Actividad reciente'), false);
  assert.equal(recentRows(root).length, 0);
});

test('24UX6C2: a recent transfer is a TransferRow with every account, no account or context of its own, keyed by its record; an entry stays an EntryRow', () => {
  const at = '2026-09-01T12:00:00.000Z';
  const accounts: domain.Account[] = [{ id: 'a', name: 'Efectivo', currency: 'ARS', openingMinor: 0, createdAt: at }, { id: 'b', name: 'Banco', currency: 'ARS', openingMinor: 100000, createdAt: at }];
  const move: domain.Transfer = { id: 'm1', fromAccountId: 'b', toAccountId: 'a', amountMinor: 2500, note: '', dateISO: '2026-09-11', createdAt: '2026-09-11T09:00:00.000Z' };
  const lunch: domain.Entry = { id: 'e1', accountId: 'a', kind: 'expense', amountMinor: 1200, merchant: 'Parrilla', category: 'Restaurantes', dateISO: '2026-09-12', createdAt: '2026-09-12T13:00:00.000Z' };
  const pay: domain.Entry = { id: 'e2', accountId: 'b', kind: 'income', amountMinor: 90000, merchant: 'Sueldo', category: 'Sueldo', dateISO: '2026-09-10', createdAt: '2026-09-10T08:00:00.000Z' };
  const data: domain.LedgerSnapshot = { accounts, entries: [pay, lunch], transfers: [move] };
  const root = routeHarness('(tabs)/index.tsx', {}, data).render();
  assert.equal(recentRows(root).map(n => n.type + ':' + n.key).join(), 'EntryRow:entry-e1,TransferRow:transfer-m1,EntryRow:entry-e2', 'merged order, each keyed by its type and record');
  const row = find(root, 'TransferRow');
  assert.equal(row.props.transfer, move, 'the stored transfer itself: its amount, note and accounts untouched');
  assert.equal(row.props.accounts, data.accounts, 'every account, so the row names the origin and the destination');
  // No account and no context: the row reads as a plain transfer (origin → destination, «Transferencia» for VoiceOver,
  // unsigned in the transfer tone; tested on TransferRow in ui-rows), never as one side or as a card or debt payment.
  assert.equal(row.props.accountId, undefined);
  assert.equal(row.props.context, undefined);
  assert.equal(row.props.showDate, undefined, 'the date shows, as on every recent row');
  assert.equal(row.props.last, false);
  assert.equal(Object.keys(row.props).sort().join(), 'accounts,last,transfer', 'nothing else is passed');
  // The entries stay EntryRows with their own account; the rows span two accounts (the transfer by its origin), so each entry names its own.
  const entries = nodes(root).filter(n => n.type === 'EntryRow');
  assert.equal(entries.map(n => n.props.entry.id + ':' + n.props.account.id + ':' + n.props.showAccount).join(), 'e1:a:true,e2:b:true');
  assert.equal(entries.every(n => n.props.entry === data.entries.find(item => item.id === n.props.entry.id)), true, 'the stored entries themselves');
  assert.equal(entries.at(-1)!.props.last, true);
  // A transfer from the same account as every entry adds no second account: no entry repeats the name.
  const oneAccount = routeHarness('(tabs)/index.tsx', {}, { accounts, entries: [lunch], transfers: [{ ...move, fromAccountId: 'a', toAccountId: 'b' }] }).render();
  assert.equal(nodes(oneAccount).filter(n => n.type === 'EntryRow').map(n => n.props.showAccount).join(), 'false');
  // The screen's source passes no account or context to the transfer row.
  assert.equal(/<TransferRow key=\{item\.key\} transfer=\{item\.value\} accounts=\{snapshot\.accounts\} last=\{[^}]+\} \/>/.test(homeSource), true);
});

test('24UX6C2 review: a recent transfer counts for the account rule by its real side: a debt collection by the account that received it, a card payment by the paying account', () => {
  const at = '2026-09-01T12:00:00.000Z';
  // Two real accounts and the hidden accounts of one card and one personal debt (synthetic fixtures).
  const accounts: domain.Account[] = [{ id: 'cash', name: 'Efectivo', currency: 'ARS', openingMinor: 0, createdAt: at },
    { id: 'bank', name: 'Banco', currency: 'ARS', openingMinor: 100000, createdAt: at },
    { id: 'card-acc', name: 'Visa', currency: 'ARS', openingMinor: 0, createdAt: at },
    { id: 'debt-acc', name: 'Juan', currency: 'ARS', openingMinor: 0, createdAt: at }];
  const card: domain.CreditCardProfile = { id: 'card', accountId: 'card-acc', issuer: 'Visa', last4: '1234', creditLimitMinor: null,
    closingDay: 1, dueDay: 10, active: true, deleted: false, createdAt: at, revision: 0, updatedAt: at };
  const debt: domain.PersonalDebtProfile = { id: 'debt', accountId: 'debt-acc', direction: 'owed_to_me', counterparty: 'Juan', dueDateISO: null, note: '',
    active: true, deleted: false, createdAt: at, revision: 0, updatedAt: at };
  const groceries: domain.Entry = { id: 'e1', accountId: 'bank', kind: 'expense', amountMinor: 1200, merchant: 'Coto', category: 'Supermercado', dateISO: '2026-09-12', createdAt: '2026-09-12T13:00:00.000Z' };
  const move = (id: string, fromAccountId: string, toAccountId: string): domain.Transfer => ({ id, fromAccountId, toAccountId, amountMinor: 2500, note: '', dateISO: '2026-09-11', createdAt: '2026-09-11T09:00:00.000Z' });
  const extra = { cards: [card], debts: [debt] };
  const render = (transfer: domain.Transfer, archive: Partial<domain.LedgerArchive> = extra) => routeHarness('(tabs)/index.tsx', {}, { accounts, entries: [groceries], transfers: [transfer] }, archive).render();
  const names = (root: Node) => nodes(root).filter(n => n.type === 'EntryRow').map(n => n.props.entry.id + ':' + n.props.showAccount).join();
  const listed = (root: Node) => recentRows(root).map(n => n.type + ':' + n.key).join();

  // A debt collection: from the debt's hidden account into «Banco». It counts as «Banco», the expense's own account: names stay off.
  const collection = render(move('t-debt', 'debt-acc', 'bank'));
  assert.equal(listed(collection), 'EntryRow:entry-e1,TransferRow:transfer-t-debt', 'the collection is listed (its origin is in view)');
  assert.equal(names(collection), 'e1:false', 'a debt collection into «Banco» beside a «Banco» expense is one account: no row repeats it');
  // A card payment: from «Banco» into the card's hidden account. It counts as «Banco», the paying account: names stay off.
  const payment = render(move('t-card', 'bank', 'card-acc'));
  assert.equal(listed(payment), 'EntryRow:entry-e1,TransferRow:transfer-t-card');
  assert.equal(names(payment), 'e1:false', 'a card payment from «Banco» beside a «Banco» expense is one account');
  // An ordinary transfer from «Efectivo» into «Banco» counts as «Efectivo»: two real accounts, so the expense names its own.
  const ordinary = render(move('t-cash', 'cash', 'bank'));
  assert.equal(listed(ordinary), 'EntryRow:entry-e1,TransferRow:transfer-t-cash');
  assert.equal(names(ordinary), 'e1:true', 'a transfer from «Efectivo» beside a «Banco» expense spans two accounts');
  // The rule reads the archive's cards and debts: the same collection with no debt on record counts by its origin (another account).
  assert.equal(names(render(move('t-debt', 'debt-acc', 'bank'), { cards: [card] })), 'e1:true', 'without the debt profile its account is an ordinary origin');
  assert.equal(/hiddenLiabilityAccountIds\(archive\?\.cards, archive\?\.debts\)/.test(homeSource), true, 'Inicio reads the hidden accounts from the archive');
});

test('24UX6C2: a transfer never changes Gastado or Disponible: the figures with and without it are identical, in one currency or consolidated', () => {
  const at = '2026-09-01T12:00:00.000Z';
  const accounts: domain.Account[] = [{ id: 'a', name: 'Efectivo', currency: 'ARS', openingMinor: 20000, createdAt: at }, { id: 'b', name: 'Banco', currency: 'ARS', openingMinor: 300000, createdAt: at },
    { id: 'u', name: 'Dólares', currency: 'USD', openingMinor: 5000, createdAt: at }];
  const entries: domain.Entry[] = [
    { id: 'e1', accountId: 'a', kind: 'expense', amountMinor: 1500, merchant: 'Café', category: 'Comida', dateISO: '2026-09-05', createdAt: '2026-09-05T09:00:00.000Z' },
    { id: 'e2', accountId: 'b', kind: 'income', amountMinor: 80000, merchant: 'Sueldo', category: 'Sueldo', dateISO: '2026-09-02', createdAt: '2026-09-02T09:00:00.000Z' },
    { id: 'e3', accountId: 'u', kind: 'expense', amountMinor: 700, merchant: 'App', category: 'Suscripciones', dateISO: '2026-09-08', createdAt: '2026-09-08T09:00:00.000Z' },
  ];
  const move: domain.Transfer = { id: 't1', fromAccountId: 'b', toAccountId: 'a', amountMinor: 45000, note: 'Retiro', dateISO: '2026-09-10', createdAt: '2026-09-10T09:00:00.000Z' };
  const without: domain.LedgerSnapshot = { accounts, entries };
  const withTransfer: domain.LedgerSnapshot = { accounts, entries, transfers: [move] };
  const cases: { label: string; mode: displayCurrency.DisplayMode; currency: domain.Currency; book: domain.RateBook }[] = [
    { label: 'single ARS', mode: 'single', currency: 'ARS', book: domain.rateBook([]) },
    { label: 'consolidated ARS', mode: 'consolidated', currency: 'ARS', book: consolidatedRates() },
  ];
  const figures = (data: domain.LedgerSnapshot, item: typeof cases[number]) => {
    const harness = routeHarness('(tabs)/index.tsx', {}, data, {}, displayStore({ [displayCurrency.DISPLAY_MODE_KEY]: item.mode, [displayCurrency.DISPLAY_CURRENCY_KEY]: item.currency }), { book: item.book });
    let root = harness.render();
    const spent = find(root, 'Money').props;
    metricOf(root).props.onChange('available');
    root = harness.render();
    const available = find(root, 'Money').props;
    return { spent: { minor: spent.minor, currency: spent.currency }, available: { minor: available.minor, currency: available.currency }, transfers: nodes(root).filter(n => n.type === 'TransferRow').length };
  };
  for (const item of cases) {
    const before = figures(without, item), after = figures(withTransfer, item);
    assert.equal(after.transfers, 1, item.label + ': the transfer is listed');
    assert.equal(before.transfers, 0);
    assert.equal(JSON.stringify(after.spent), JSON.stringify(before.spent), item.label + ': Gastado is the same with the transfer');
    // Both accounts are liquid: the transfer moves money inside Disponible, so the total is the same to the minor unit.
    assert.equal(JSON.stringify(after.available), JSON.stringify(before.available), item.label + ': Disponible is the same with the transfer');
    assert.equal(Number.isInteger(after.spent.minor) && Number.isInteger(after.available.minor), true, 'integer minor units');
    // And both are the domain's own figures.
    const view = financeView.financeView(withTransfer, item.mode, item.currency, item.book);
    const spent = financeView.spendingFigure(withTransfer, view, domain.spendingWindow(item.currency, 'month', '2026-09-12'), 'idle', true);
    const available = financeView.availableFigure(withTransfer, view, item.book, '2026-09-12', 'idle', true, [], []);
    assert.equal(spent.status === 'ready' && spent.minor === after.spent.minor, true, item.label + ': Gastado is spendingFigure');
    assert.equal(available.status === 'ready' && available.minor === after.available.minor, true, item.label + ': Disponible is availableFigure');
  }
  // The single ARS figures, pinned: Gastado is the one ARS expense; Disponible the two liquid ARS balances.
  const pinned = figures(withTransfer, cases[0]);
  assert.equal(JSON.stringify([pinned.spent.minor, pinned.available.minor]), JSON.stringify([1500, 20000 + 300000 - 1500 + 80000]));
});

test('24UX6C2: with two currencies, «Solo USD» leaves an ARS transfer out; the consolidated view lists it once, at its own amount in its own accounts\' currency', () => {
  const at = '2026-09-01T12:00:00.000Z';
  const accounts: domain.Account[] = [{ id: 'a', name: 'Efectivo', currency: 'ARS', openingMinor: 0, createdAt: at }, { id: 'b', name: 'Banco', currency: 'ARS', openingMinor: 100000, createdAt: at },
    { id: 'u', name: 'Dólares', currency: 'USD', openingMinor: 10000, createdAt: at }, { id: 'v', name: 'Ahorro USD', currency: 'USD', openingMinor: 0, createdAt: at }];
  const pesos: domain.Transfer = { id: 'ars-move', fromAccountId: 'b', toAccountId: 'a', amountMinor: 45000, note: '', dateISO: '2026-09-10', createdAt: '2026-09-10T09:00:00.000Z' };
  const dollars: domain.Transfer = { id: 'usd-move', fromAccountId: 'u', toAccountId: 'v', amountMinor: 3000, note: '', dateISO: '2026-09-09', createdAt: '2026-09-09T09:00:00.000Z' };
  const usdExpense: domain.Entry = { id: 'usd-lunch', accountId: 'u', kind: 'expense', amountMinor: 1200, merchant: 'Lunch', category: 'Comida', dateISO: '2026-09-11', createdAt: '2026-09-11T09:00:00.000Z' };
  const data: domain.LedgerSnapshot = { accounts, entries: [usdExpense], transfers: [pesos, dollars] };
  const show = (mode: displayCurrency.DisplayMode, currency: domain.Currency) => routeHarness('(tabs)/index.tsx', {}, data, {},
    displayStore({ [displayCurrency.DISPLAY_MODE_KEY]: mode, [displayCurrency.DISPLAY_CURRENCY_KEY]: currency }), { book: consolidatedRates() }).render();
  let root = show('single', 'USD');
  assert.equal(recentIds(root), 'usd-lunch,usd-move', '«Solo USD»: the USD expense and the USD transfer; the ARS transfer is not listed');
  root = show('single', 'ARS');
  assert.equal(recentIds(root), 'ars-move', '«Solo ARS»: only the ARS transfer');
  root = show('consolidated', 'USD');
  assert.equal(recentIds(root), 'usd-lunch,ars-move,usd-move', 'consolidated: every record once, newest first');
  const listed = nodes(root).filter(n => n.type === 'TransferRow' && n.props.transfer.id === 'ars-move');
  assert.equal(listed.length, 1, 'the ARS transfer once');
  const row = listed[0];
  assert.equal(row.props.transfer, pesos, 'at its own amount, never converted into the display currency');
  assert.equal(row.props.transfer.amountMinor, 45000);
  const currencyOf = (id: string) => (row.props.accounts as domain.Account[]).find(account => account.id === id)!.currency;
  assert.equal(currencyOf(pesos.fromAccountId) + '→' + currencyOf(pesos.toAccountId), 'ARS→ARS', 'its accounts keep their real currency in the consolidated view');
  assert.equal(row.props.accounts, data.accounts, 'the stored accounts themselves');
});

test('24UX6A: commitments without activity show only the commitments; with neither, one quiet line and no action; with no account, the start', () => {
  const account: domain.Account = { id: 'a', name: 'Efectivo', currency: 'ARS', openingMinor: 0, createdAt };
  let view = routeHarness('(tabs)/index.tsx', {}, { accounts: [account], entries: [] }, { recurring: [dueRule('r1'), dueRule('r2', { merchant: 'Spotify' }), dueRule('r3', { merchant: 'Gimnasio', nextDateISO: '2026-09-13', anchorDateISO: '2026-09-13' })] });
  let root = view.render();
  assert.equal(sectionTitles(root).join('|'), 'Próximos compromisos', 'only the commitments');
  assert.equal(nodes(root).filter(n => n.type === 'UpcomingRecurringRow').map(n => n.props.rule.id).join(), 'r3,r1', 'two at most, soonest first');
  assert.equal(nodes(root).some(n => n.type === 'EmptyState'), false, 'no quiet line under commitments');
  const surface = nodes(root).find(n => n.type === 'Surface' && nodes(n).some(child => child.type === 'UpcomingRecurringRow'))!;
  assert.equal(surface.props.grouped, true);
  nodes(root).find(n => n.type === 'SectionTitle' && n.props.children === 'Próximos compromisos')!.props.onAction();
  assert.equal(view.pushed.at(-1), '/recurring');
  // Neither: the quiet line, no action (the dock's «+» and the Assistant are the actions).
  view = routeHarness('(tabs)/index.tsx', {}, { accounts: [account], entries: [] });
  root = view.render();
  assert.equal(sectionTitles(root).length, 0, 'no section header, no placeholder');
  const quiet = find(root, 'EmptyState');
  assert.deepEqual([quiet.props.title, quiet.props.detail], ['Todavía no hay movimientos este mes', 'Registrá un gasto con el botón Registrar (+) o contáselo al Asistente.'],
    'one currency held: the line names no currency; the detail names the dock\'s button by its label');
  assert.equal(quiet.props.action, undefined, 'no button: recording is the dock\'s');
  assert.equal(nodes(root).filter(n => n.type === 'EmptyState').length, 1);
  assert.equal(nodes(root).some(n => n.type === 'ActionButton' || n.type === 'Surface'), false);
  // No account: the start.
  view = routeHarness('(tabs)/index.tsx', {}, { accounts: [], entries: [] });
  root = view.render();
  const start = find(root, 'EmptyState');
  assert.equal(start.props.title, 'Entendé tus gastos.');
  assert.equal(start.props.action.type, 'ActionButton');
  assert.equal(start.props.action.props.label, 'Empezar');
  start.props.action.props.onPress();
  assert.equal(view.pushed.at(-1), '/new-account');
  assert.equal(sectionTitles(root).length, 0);
});

test('24UX6A: no Registrar button, insight line, ranking, budget card, chart or Assistant banner on Inicio, in the tree or the source (24UX6C2\'s «one budget row at most» superseded by the 24UX6D refinement: two compact rows at most)', () => {
  const at = '2026-09-01T12:00:00.000Z';
  // A ledger that once produced each retired module: a concentrated category, an exceeded general budget and sublimit, rules.
  const budgets: domain.MonthlyBudget[] = [{ id: 'total', scope: 'total', currency: 'ARS', monthISO: '2026-09', amountMinor: 100, active: true, createdAt: at, revision: 0, updatedAt: at },
    { id: 'salud', scope: 'category', category: 'Salud', currency: 'ARS', monthISO: '2026-09', amountMinor: 50, active: true, createdAt: at, revision: 0, updatedAt: at }];
  const roots = [routeHarness('(tabs)/index.tsx', {}, homeData, { budgets, recurring: [dueRule()] }).render(), routeHarness('(tabs)/index.tsx', {}, snapshot).render(),
    routeHarness('(tabs)/index.tsx', {}, { accounts: [], entries: [] }).render()];
  // 24UX6C2 drew the exceeded general budget alone; since the 24UX6D refinement the exceeded sublimit is a second compact
  // row (the general first within «exceeded»), still never a card.
  assert.equal(JSON.stringify(roots.map(root => nodes(root).filter(n => n.type === 'BudgetAttentionRow').map(n => n.props.attention.state + ':' + n.props.attention.progress.budget.id))),
    JSON.stringify([['exceeded:total', 'exceeded:salud'], [], []]));
  for (const root of roots) {
    assert.equal(nodes(root).filter(n => RETIRED.includes(n.type)).map(n => n.type).join(), '');
    assert.equal(homeTexts(root).some(text => /presupuesto|Registrar|Asistente|concentr/i.test(text) && !/Asistente\.$/.test(text)), false);
    assert.equal(nodes(root).filter(n => n.type === 'Money').length, 1, 'one hero; the rows draw their own amounts');
  }
  const imports = homeSource.match(/^import .*$/gm)!.join('\n');
  for (const gone of ['home-capture', 'capture-hub', 'quick-actions', 'charts', 'spending-chart', 'spending-timeline', 'BudgetHomeCard', 'budget-card', 'BudgetCard', 'BudgetRow', 'insight', 'assistant', 'Insight', 'Capture', 'QuickActions', 'AssistantEntry'])
    assert.equal(imports.includes(gone), false, 'Inicio does not import ' + gone);
  // The only budget imports are the attention row and its rule: 24UX6C2's `homeBudget` (one general budget) became
  // `homeBudgets` with the 24UX6D refinement (the general and category budgets that need attention, two at most).
  assert.equal(imports.match(/[\w-]*[Bb]udget[\w-]*/g)!.sort().join(), 'BudgetAttentionRow,homeBudgets');
  assert.equal(/homeInsight|HomeInsightRow|CaptureButton|CaptureAction/.test(homeSource.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')), false, 'nor uses them');
  assert.equal(Object.hasOwn(homeFocus, 'homeInsight') || Object.hasOwn(homeFocus, 'CONCENTRATION_SHARE'), false, 'the insight rule is gone');
});
test('the spending detail opens this month\'s matching expenses in the chosen currency', () => {
  const params = { currency: 'ARS', startISO: '2026-09-01', endISO: '2026-09-12', category: 'salud' };
  const detail = routeHarness('spending-detail.tsx', params, homeData).render();
  assert.deepEqual(detail.props.entries.map((e: domain.Entry) => e.id), ['now', 'early']);
  assert.equal(find(detail, 'Money').props.minor, 300);
});
test('empty and overflow Home never invent a chart, budget line or partial total', () => {
  const empty = routeHarness('(tabs)/index.tsx', {}).render();
  assert.equal(find(empty, 'Money').props.minor, 0);
  assert.equal(nodes(empty).some(n => RETIRED.includes(n.type) || n.type === 'UpcomingRecurringRow' || n.type === 'EntryRow'), false);
  assert.equal(nodes(empty).some(n => n.type === 'SectionTitle'), false, 'no empty commitments or activity block');
  const huge = { ...homeData, entries: homeData.entries.filter(e => e.id === 'early' || e.id === 'now').map(e => ({ ...e, amountMinor: Number.MAX_SAFE_INTEGER })) };
  assert.equal(nodes(routeHarness('(tabs)/index.tsx', {}, huge).render()).some(n => n.type === 'Money'), false);
});
test('Home keeps analysis in Reportes: no timeline bars, commitments only with a rule due within 30 days, Disponible without cards', () => {
  const view = routeHarness('(tabs)/index.tsx', {}, homeData);
  const root = view.render();
  assert.equal(nodes(root).some(n => n.type === 'SpendingTimeline'), false);
  assert.equal(sectionTitles(root).join('|'), 'Actividad reciente', '24UX6A: only the month\'s activity; no commitments section without a rule');
  assert.equal(nodes(root).some(n => n.type === 'UpcomingRecurringRow'), false, 'no commitments block without rules');
  // No disclaimer copy on screen: the definition lives behind contextual help.
  const texts = homeTexts(root);
  assert.equal(texts.some(text => /saldo bancario|patrimonio/.test(text)), false);
  const rule = { id: 'r', kind: 'expense' as const, accountId: 'a', amountMinor: 700, merchant: 'Alquiler', category: 'Hogar', frequency: 'monthly' as const,
    anchorDateISO: '2026-09-15', nextDateISO: '2026-09-15', active: true, deleted: false, createdAt, revision: 0, updatedAt: createdAt };
  const withRule = routeHarness('(tabs)/index.tsx', {}, homeData, { recurring: [rule] as domain.RecurringRule[] });
  assert.equal(find(withRule.render(), 'UpcomingRecurringRow').props.rule.id, 'r');
  nodes(withRule.render()).find(n => n.type === 'SectionTitle' && n.props.action === 'Ver todos' && n.props.children === 'Próximos compromisos')!.props.onAction();
  assert.equal(withRule.pushed.at(-1), '/recurring');
  // 24UX6C2: the window is today through today + 30 days (2026-09-12 … 2026-10-12): a rule a week away is listed; one a day past the window waits in Recurrentes.
  const nextWeek = routeHarness('(tabs)/index.tsx', {}, homeData, { recurring: [{ ...rule, anchorDateISO: '2026-09-19', nextDateISO: '2026-09-19' }] as domain.RecurringRule[] }).render();
  assert.equal(find(nextWeek, 'UpcomingRecurringRow').props.rule.nextDateISO, '2026-09-19', 'no longer cut at seven days');
  const lastDay = routeHarness('(tabs)/index.tsx', {}, homeData, { recurring: [{ ...rule, anchorDateISO: '2026-10-12', nextDateISO: '2026-10-12' }] as domain.RecurringRule[] }).render();
  assert.equal(find(lastDay, 'UpcomingRecurringRow').props.rule.nextDateISO, '2026-10-12', 'today + 30 is inside');
  const later = routeHarness('(tabs)/index.tsx', {}, homeData, { recurring: [{ ...rule, anchorDateISO: '2026-10-13', nextDateISO: '2026-10-13' }] as domain.RecurringRule[] }).render();
  assert.equal(nodes(later).some(n => n.type === 'UpcomingRecurringRow'), false);
  assert.equal(sectionTitles(later).includes('Próximos compromisos'), false, 'no header, no placeholder');
  // Disponible excludes a card account's negative balance.
  const withCard = { ...homeData, accounts: [...homeData.accounts, { id: 'card-acc', name: 'Visa', currency: 'ARS' as const, openingMinor: -5000, createdAt }] };
  const cardView = routeHarness('(tabs)/index.tsx', {}, withCard, { cards: [{ id: 'card', accountId: 'card-acc', issuer: '', last4: '', creditLimitMinor: null,
    closingDay: 1, dueDay: 10, active: true, deleted: false, createdAt, revision: 0, updatedAt: createdAt }] });
  nodes(cardView.render()).find(n => n.type === 'Choices' && n.props.value === 'spending')!.props.onChange('available');
  // Account "a": opening 10000, expenses 101 + 202 + 303 + 100 + 200, income 500. The card's −5000 is excluded.
  assert.equal(find(cardView.render(), 'Money').props.minor, 10000 - 101 - 202 - 303 - 100 - 200 + 500);
  assert.equal(homeTexts(cardView.render()).some(text => /saldo bancario|patrimonio/.test(text)), false);
  assertNoSubline(cardView.render(), 'Disponible with a card');
  assert.equal(find(cardView.render(), 'MetricHelp').props.title, 'Disponible');
});
test('24B1: Disponible for a currency held only by a card is a true US$ 0,00, never a dropped total', () => {
  const cardOnly = { ...homeData, accounts: [homeData.accounts[0], { id: 'usd-card', name: 'Visa USD', currency: 'USD' as const, openingMinor: -5000, createdAt }] };
  const view = routeHarness('(tabs)/index.tsx', {}, cardOnly, { cards: [{ id: 'card', accountId: 'usd-card', issuer: '', last4: '', creditLimitMinor: null,
    closingDay: 1, dueDay: 10, active: true, deleted: false, createdAt, revision: 0, updatedAt: createdAt }] });
  assert.deepEqual(presentation.availableCurrencies(cardOnly.accounts), ['ARS', 'USD'], 'the card account still makes USD a currency of the ledger');
  nodes(view.render()).find(n => n.type === 'Choices' && n.props.value === 'spending')!.props.onChange('available');
  find(view.render(), 'DisplayCurrencyButton').props.onCurrency('USD');
  const money = find(view.render(), 'Money');
  assert.deepEqual({ minor: money.props.minor, currency: money.props.currency }, { minor: 0, currency: 'USD' });
  assert.equal(i18nFormat.moneyText(0, 'USD'), 'US$\u00A00,00');
  assert.deepEqual(domain.liquidTotalsByCurrency(cardOnly, [{ id: 'card', accountId: 'usd-card', issuer: '', last4: '', creditLimitMinor: null,
    closingDay: 1, dueDay: 10, active: true, deleted: false, createdAt, revision: 0, updatedAt: createdAt }]), { ARS: 10000 - 101 - 202 - 303 - 100 - 200 + 500 }, 'no liquid USD account: no USD key, so Home shows a true zero');
});
test('expense detail rejects malformed scope and a category miss never opens all entries', () => {
  const valid = { currency: 'ARS', startISO: '2026-09-01', endISO: '2026-09-12' };
  // 'XAU' is never money in the ledger; 'CHF' is a ready catalogue currency outside the gate that no account holds.
  for (const override of [{ endISO: '2026-09-13' }, { startISO: '2026-07-01' }, { category: ['salud'] }, { currency: 'XAU' }, { currency: 'CHF' }, { currency: 'ars' }]) {
    assert.equal(find(routeHarness('spending-detail.tsx', { ...valid, ...override }, homeData).render(), 'EmptyState').props.title, 'Período no válido');
  }
  assert.equal(routeHarness('spending-detail.tsx', { ...valid, category: 'sal' }, homeData).render().props.entries.length, 0);
});
test('cloud context contains deterministic scoped totals and counts, no merchant or account history', () => {
  const facts = monthlyEvidence(homeData, 'ARS', '2026-09-12');
  assert.equal(facts.find(f => f.id === 'current.expenses')!.amountMinor, 300);
  assert.equal(facts.find(f => f.id === 'current.expenses')!.count, 2);
  assert.equal(JSON.stringify(facts).includes('Prueba'), false);
  assert.ok(facts.every(f => f.endISO.endsWith('-12')));
});
test('cloud client requires HTTPS/session and returns an inbox receipt, never a posted entry', async () => {
  assert.throws(() => integrationClient('http://example.test', async () => null));
  let calls = 0;
  const fetcher = (async (_url: unknown, options: RequestInit) => {
    calls++;
    assert.ok(options.signal instanceof AbortSignal);
    return { ok: true, json: async () => ({ id: 'fixture', status: 'needs_review', duplicate: true }) };
  }) as unknown as typeof fetch;
  const input = { version: 1 as const, requestId: 'fixture-event-0001', source: 'shortcut' as const,
    draft: { kind: 'expense' as const, amountMinor: 100, currency: 'ARS' as const, merchant: null, category: null, dateISO: null, paymentMethodRef: null } };
  await assert.rejects(integrationClient('https://example.test', async () => null, fetcher).capture(input));
  assert.equal(calls, 0);
  const originalTimeout = AbortSignal.timeout;
  try {
    AbortSignal.timeout = () => { throw new Error('Static timeout unavailable in this runtime'); };
    assert.equal((await integrationClient('https://example.test', async () => 'fixture-token', fetcher).capture(input)).status, 'needs_review');
  } finally {
    AbortSignal.timeout = originalTimeout;
  }
  assert.equal(calls, 1);
});

test('24UX6A, 24UX6C2 (its «category-only never reaches Inicio» superseded by the 24UX6D refinement): a calm or archived budget never reaches Inicio; a general or category budget that needs attention is a row, never a card or a section', () => {
  const createdAt = '2026-09-01T12:00:00.000Z';
  const total: domain.MonthlyBudget = { id: 'total', scope: 'total', currency: 'ARS', monthISO: '2026-09', amountMinor: 100000, active: true, createdAt, revision: 0, updatedAt: createdAt };
  const sublimit: domain.MonthlyBudget = { id: 'salud', scope: 'category', category: 'Salud', currency: 'ARS', monthISO: '2026-09', amountMinor: 250, active: true, createdAt, revision: 0, updatedAt: createdAt };
  const archived = { revision: 1, updatedAt: '2026-09-02T12:00:00.000Z', active: false };
  const plain = routeHarness('(tabs)/index.tsx', {}, homeData).render();
  // All September ARS expenses are 300: a general budget of 330 is 91 % used, one of 250 in Salud is 50 over.
  const cases: [string, domain.MonthlyBudget[], string][] = [['calm general', [total], ''], ['91 % general', [{ ...total, amountMinor: 330 }], 'warning'],
    // 24UX6D refinement: an exceeded sublimit is a row now, alone or beside a calm general budget.
    ['exceeded sublimit alone', [sublimit], 'exceeded'], ['archived sublimit', [{ ...sublimit, ...archived }], ''], ['archived exceeded general', [{ ...total, amountMinor: 200, ...archived }], ''],
    ['calm general and an exceeded sublimit', [total, sublimit], 'exceeded']];
  for (const [label, budgets, state] of cases) {
    const root = routeHarness('(tabs)/index.tsx', {}, homeData, { budgets }).render();
    assert.equal(nodes(root).some(n => RETIRED.includes(n.type)), false, label);
    assert.equal(find(root, 'Money').props.minor, 300, label + ': a budget never changes Gastado');
    assert.equal(nodes(root).filter(n => n.type === 'BudgetAttentionRow').map(n => n.props.attention.state).join(), state, label);
    assert.equal(JSON.stringify(homeTexts(root)), JSON.stringify(homeTexts(plain)), label + ': nothing else on Inicio speaks of the budget');
    assert.equal(sectionTitles(root).join('|'), 'Actividad reciente', label + ': no budget section');
  }
});
test('23.1B1: Home in English keeps the same numbers and routes; only words change, and the language can switch in place', () => {
  const view = routeHarness('(tabs)/index.tsx', {}, homeData, { recurring: [dueRule('r', { merchant: 'Netflix' })] });
  const spanish = view.render();
  locale = 'en-AR';
  try {
    const root = view.render();
    assert.equal(find(root, 'Money').props.minor, find(spanish, 'Money').props.minor, 'the figure never depends on the language');
    const metric = metricOf(root);
    assert.equal(metric.props.options.map((option: any) => option.label).join(','), 'Spent,Available');
    assert.ok(homeTexts(root).includes('September'), 'the month is named in English');
    assert.equal(textOf(monthOf(root)), 'September');
    const titles = nodes(root).filter(n => n.type === 'SectionTitle').map(n => String(n.props.children) + '|' + n.props.action);
    assert.equal(titles.join(' / '), 'Coming up|See all / Recent activity|See all');
    assert.equal(find(root, 'FieldButton').props.label, 'View my accounts');
    assertNoSubline(root, 'English, Spent');
    metric.props.onChange('available');
    const available = view.render();
    const help = find(available, 'MetricHelp');
    assert.equal(help.props.title, 'Available');
    assert.match(help.props.detail, /^The money recorded in your accounts/);
    assertNoSubline(available, 'English, Available');
    locale = 'es-AR';
    const back = view.render();
    assert.equal(find(back, 'MetricHelp').props.title, 'Disponible', 'the chosen metric survives the switch');
  } finally { locale = 'es-AR'; }
});
test('24B3: Home with three currencies lists them in the switch and shows each currency\'s own figures, converting nothing', () => {
  // A stored JPY account is read acceptance (no gate opens in production): the ledger holds ARS, USD and JPY.
  const yen: domain.Account = { id: 'y', name: 'Yenes', currency: 'JPY', openingMinor: 0, createdAt };
  const data: domain.LedgerSnapshot = { ...homeData, accounts: [...homeData.accounts, yen], entries: [...homeData.entries,
    { ...homeData.entries[0], id: 'yen-1', accountId: 'y', dateISO: '2026-09-11', amountMinor: 1500, category: 'Comida' }, { ...homeData.entries[0], id: 'yen-2', accountId: 'y', dateISO: '2026-09-12', amountMinor: 700, category: 'Salud' }] };
  const view = routeHarness('(tabs)/index.tsx', {}, data);
  let root = view.render();
  const control = find(root, 'DisplayCurrencyButton');
  assert.deepEqual(control.props.held, ['ARS', 'USD', 'JPY'], 'the currencies present, ARS and USD first, then by code');
  assert.equal(control.props.onField, true, 'Inicio draws the chip on its pine field');
  assert.equal(control.props.currency, 'ARS');
  assert.equal(find(root, 'Money').props.minor, 300, 'ARS figures unchanged by the third currency');
  control.props.onCurrency('JPY');
  root = view.render();
  assert.deepEqual({ minor: find(root, 'Money').props.minor, currency: find(root, 'Money').props.currency }, { minor: 2200, currency: 'JPY' }, 'yen are summed as yen, never as cents');
  assert.equal(nodes(root).filter(n => n.type === 'EntryRow').map(n => n.props.entry.id).join(), 'yen-2,yen-1', 'the activity is the yen movements alone');
  // 24UX6A: a concentrated category (yen 1500 of 2200 in Comida) no longer makes a line on Inicio; Reportes has the ranking.
  assert.equal(nodes(root).some(n => RETIRED.includes(n.type)), false);
  assertNoSubline(root, 'three currencies, yen');
});

// ---- Producto 24B6: one display currency shared by Inicio and Reportes ------------------------------------

test('24B6: choosing a currency on Inicio changes Reportes and choosing on Reportes changes Inicio, through one persisted preference; a switch within either screen keeps working', () => {
  const rows = new Map<string, string>([[displayCurrency.DISPLAY_MODE_KEY, 'single']]); // 24C1: the one-currency filter of 24B6
  const shared = displayCurrency.createDisplayCurrencyStore(() => ({ getItemSync: (key: string) => rows.get(key) ?? null, setItemSync: (key: string, value: string) => { rows.set(key, value); }, removeItemSync: (key: string) => rows.delete(key) }));
  const home = routeHarness('(tabs)/index.tsx', {}, homeData, {}, shared);
  const reports = routeHarness('(tabs)/reports.tsx', {}, homeData, {}, shared);
  assert.equal(find(home.render(), 'DisplayCurrencyButton').props.currency, 'ARS', 'no preference yet: the first currency held');
  assert.equal(find(reports.render(), 'DisplayCurrencyButton').props.currency, 'ARS');
  find(home.render(), 'DisplayCurrencyButton').props.onCurrency('USD');
  assert.equal(find(home.render(), 'Money').props.currency, 'USD');
  assert.equal(find(reports.render(), 'DisplayCurrencyButton').props.currency, 'USD', 'Reportes follows Inicio without being told');
  assert.equal(reportsCurrency(reports.render()), 'USD');
  assert.equal(rows.get(displayCurrency.DISPLAY_CURRENCY_KEY), 'USD', 'persisted outside the ledger, under its own key');
  find(reports.render(), 'DisplayCurrencyButton').props.onCurrency('ARS');
  assert.equal(find(home.render(), 'DisplayCurrencyButton').props.currency, 'ARS', 'and Inicio follows Reportes');
  assert.equal(find(home.render(), 'Money').props.minor, 300);
  assert.equal(rows.get(displayCurrency.DISPLAY_CURRENCY_KEY), 'ARS');
  // A screen mounted later reads the same preference.
  const later = routeHarness('(tabs)/reports.tsx', {}, homeData, {}, shared);
  assert.equal(find(later.render(), 'DisplayCurrencyButton').props.currency, 'ARS');
  // Reportes' month and view stay its own: switching the currency changes neither.
  nodes(reports.render()).find(n => n.type === 'Choices' && n.props.value === 'categories')!.props.onChange('days');
  find(reports.render(), 'DisplayCurrencyButton').props.onCurrency('USD');
  assert.equal(nodes(reports.render()).some(n => n.type === 'Choices' && n.props.value === 'days'), true, 'the days view survives the currency change');
  assert.equal(nodes(home.render()).some(n => n.type === 'Choices' && n.props.value === 'spending'), true, 'Inicio\'s metric is untouched');
});

test('24B6: a stored preference survives a relaunch; one no account holds any more shows the first currency held and is kept, so it returns with an account', () => {
  const rows = new Map<string, string>([[displayCurrency.DISPLAY_CURRENCY_KEY, 'USD']]);
  const preferences = () => ({ getItemSync: (key: string) => rows.get(key) ?? null, setItemSync: (key: string, value: string) => { rows.set(key, value); }, removeItemSync: (key: string) => rows.delete(key) });
  const relaunched = routeHarness('(tabs)/index.tsx', {}, homeData, {}, displayCurrency.createDisplayCurrencyStore(preferences));
  assert.equal(find(relaunched.render(), 'Money').props.currency, 'USD', 'the saved choice opens');
  const onlyPesos: domain.LedgerSnapshot = { ...homeData, accounts: homeData.accounts.filter(account => account.currency === 'ARS') };
  const withoutDollars = routeHarness('(tabs)/index.tsx', {}, onlyPesos, {}, displayCurrency.createDisplayCurrencyStore(preferences));
  const root = withoutDollars.render();
  assert.equal(find(root, 'Money').props.currency, 'ARS', 'no USD account: the first currency held');
  // 25B2: one currency held offers nothing to choose: no chip; the number is simply that currency's total.
  assert.equal(nodes(root).some(n => n.type === 'DisplayCurrencyButton'), false, 'one currency: no chip');
  assert.equal(rows.get(displayCurrency.DISPLAY_CURRENCY_KEY), 'USD', 'the preference is not rewritten; nothing else is touched');
  const reports = routeHarness('(tabs)/reports.tsx', {}, onlyPesos, {}, displayCurrency.createDisplayCurrencyStore(preferences));
  assert.equal(reportsCurrency(reports.render()), 'ARS');
  assert.equal(nodes(reports.render()).some(n => n.type === 'DisplayCurrencyButton'), false, 'one currency: no chip on Reportes either');
});

test('24B6: a link into Reportes with a held currency shows it and makes it the shared choice; an unknown, malformed or unheld one shows the shared choice and never overwrites it', () => {
  const rows = new Map<string, string>([[displayCurrency.DISPLAY_CURRENCY_KEY, 'ARS']]);
  const preferences = () => ({ getItemSync: (key: string) => rows.get(key) ?? null, setItemSync: (key: string, value: string) => { rows.set(key, value); }, removeItemSync: (key: string) => rows.delete(key) });
  const shared = displayCurrency.createDisplayCurrencyStore(preferences);
  const linked = routeHarness('(tabs)/reports.tsx', { currency: 'USD', month: '2026-08' }, homeData, {}, shared);
  assert.equal(reportsCurrency(linked.render()), 'USD', 'the frame the link arrives already shows its currency');
  assert.equal(shared.getState(), 'USD', 'the explicit currency became the shared choice');
  assert.equal(rows.get(displayCurrency.DISPLAY_CURRENCY_KEY), 'USD');
  const home = routeHarness('(tabs)/index.tsx', {}, homeData, {}, shared);
  assert.equal(find(home.render(), 'DisplayCurrencyButton').props.currency, 'USD', 'Inicio agrees');
  // The switch on the linked screen still wins afterwards: the parameter is applied once, not on every render.
  find(linked.render(), 'DisplayCurrencyButton').props.onCurrency('ARS');
  assert.equal(reportsCurrency(linked.render()), 'ARS');
  assert.equal(reportsCurrency(linked.render()), 'ARS', 'a re-render does not re-apply the link');
  assert.equal(shared.getState(), 'ARS');
  for (const currency of ['usd', 'XAU', 'ZZZ', 'EUR', 'KWD', '', ['USD'], 42]) {
    const bad = routeHarness('(tabs)/reports.tsx', { currency, month: '2026-08' }, homeData, {}, shared);
    assert.equal(reportsCurrency(bad.render()), 'ARS', 'invalid ' + JSON.stringify(currency) + ': the shared choice');
    assert.equal(shared.getState(), 'ARS', 'invalid ' + JSON.stringify(currency) + ': not overwritten');
    assert.equal(rows.get(displayCurrency.DISPLAY_CURRENCY_KEY), 'ARS');
  }
  // 24UX6A: Inicio carries no link into Reportes any more (the concentration line is gone); the tab and the shared preference agree.
  assert.equal(nodes(home.render()).some(n => n.type === 'HomeInsightRow'), false);
  assert.equal(/'\/reports'/.test(homeSource), false, 'Inicio pushes no Reportes route');
});

test('24B6 review: a Reportes link naming a currency nobody holds yet is applied once the first account in it exists, then the switch, Inicio and later ledger changes decide; an invalid link never applies', () => {
  const rows = new Map<string, string>([[displayCurrency.DISPLAY_CURRENCY_KEY, 'ARS']]);
  const shared = displayCurrency.createDisplayCurrencyStore(() => ({ getItemSync: (key: string) => rows.get(key) ?? null, setItemSync: (key: string, value: string) => { rows.set(key, value); }, removeItemSync: (key: string) => rows.delete(key) }));
  const reports = routeHarness('(tabs)/reports.tsx', { currency: 'EUR', month: '2026-08' }, homeData, {}, shared);
  let root = reports.render();
  assert.equal(reportsCurrency(root), 'ARS', 'no euro account: the shared choice shows');
  assert.equal(shared.getState(), 'ARS', 'nothing applied');
  reports.render(); reports.render();
  assert.equal(shared.getState(), 'ARS', 'and nothing applied on later renders either');
  // The person creates the first euro account while Reportes stays mounted (the ledger provider re-renders the tab).
  const euro: domain.Account = { id: 'e', name: 'Euros', currency: 'EUR', openingMinor: 0, createdAt };
  const withEuro: domain.LedgerSnapshot = { ...homeData, accounts: [...homeData.accounts, euro] };
  reports.setData(withEuro);
  root = reports.render();
  assert.equal(reportsCurrency(root), 'EUR', 'the link is honoured the moment its currency is held');
  assert.equal(shared.getState(), 'EUR', 'and applied to the shared choice');
  assert.equal(rows.get(displayCurrency.DISPLAY_CURRENCY_KEY), 'EUR');
  assert.deepEqual(find(root, 'DisplayCurrencyButton').props.held, ['ARS', 'USD', 'EUR']);
  const home = routeHarness('(tabs)/index.tsx', {}, withEuro, {}, shared);
  assert.equal(find(home.render(), 'DisplayCurrencyButton').props.currency, 'EUR', 'Inicio follows');
  // The switch on Reportes wins from now on, and an unrelated ledger change does not re-impose the link.
  find(reports.render(), 'DisplayCurrencyButton').props.onCurrency('USD');
  assert.equal(reportsCurrency(reports.render()), 'USD');
  assert.equal(shared.getState(), 'USD');
  const more: domain.LedgerSnapshot = { ...withEuro, accounts: [...withEuro.accounts, { ...euro, id: 'e2', name: 'Más euros' }], entries: [...withEuro.entries, { ...withEuro.entries[0], id: 'e-1', accountId: 'e', amountMinor: 900 }] };
  reports.setData(more);
  assert.equal(reportsCurrency(reports.render()), 'USD', 'a new euro account and a euro movement do not bring the link back');
  assert.equal(shared.getState(), 'USD');
  // The euro accounts disappear (a restored older copy) and come back: still applied only once.
  reports.setData(homeData);
  assert.equal(reportsCurrency(reports.render()), 'USD');
  reports.setData(withEuro);
  assert.equal(reportsCurrency(reports.render()), 'USD', 'the link was already applied: the person\'s later choice stands');
  assert.equal(shared.getState(), 'USD');
  // Inicio, mounted or not, changes the choice and Reportes follows; the link still does not return.
  home.setData(withEuro);
  find(home.render(), 'DisplayCurrencyButton').props.onCurrency('ARS');
  assert.equal(reportsCurrency(reports.render()), 'ARS');
  const later = routeHarness('(tabs)/reports.tsx', {}, withEuro, {}, shared);
  assert.equal(find(later.render(), 'DisplayCurrencyButton').props.currency, 'ARS', 'a Reportes mounted later reads the same choice');
  // A link that can never be held (a malformed or unknown code) applies nothing, before or after the ledger grows.
  const bad = routeHarness('(tabs)/reports.tsx', { currency: 'ZZZ', month: '2026-08' }, homeData, {}, shared);
  assert.equal(reportsCurrency(bad.render()), 'ARS');
  bad.setData(more);
  assert.equal(reportsCurrency(bad.render()), 'ARS');
  assert.equal(shared.getState(), 'ARS');
  // A held link applied at once is not applied again when the ledger changes afterwards.
  const direct = routeHarness('(tabs)/reports.tsx', { currency: 'USD', month: '2026-08' }, withEuro, {}, shared);
  assert.equal(reportsCurrency(direct.render()), 'USD');
  assert.equal(shared.getState(), 'USD');
  find(direct.render(), 'DisplayCurrencyButton').props.onCurrency('EUR');
  direct.setData(more);
  assert.equal(reportsCurrency(direct.render()), 'EUR');
  assert.equal(shared.getState(), 'EUR');
});

// ---- 24UX2: Home refinement --------------------------------------------------------------------------------------

test('24UX6A: a quiet month is the number and one quiet line: no empty section, no button', () => {
  // The fixture's movements are all in August; the harness day is 2026-09-12.
  const root = routeHarness('(tabs)/index.tsx', {}, snapshot).render();
  assert.equal(find(root, 'Money').props.minor, 0, 'a true zero for the month');
  assert.equal(sectionTitles(root).length, 0, 'no section to say that nothing happened');
  assert.equal(nodes(root).some(n => RETIRED.includes(n.type) || n.type === 'ActionButton'), false, 'recording is the dock\'s «+»');
  // The fixture holds ARS and USD and the harness shows ARS alone: the line names the currency it speaks of.
  assert.equal(nodes(root).filter(n => n.type === 'EmptyState').map(n => n.props.title).join(), 'Todavía no hay movimientos en ARS este mes', 'one quiet line');
  assert.equal(homeTexts(root).some(text => /Tus categorías aparecerán/.test(text)), false);
  // Only an income this month: the number (no spending) and the income in the month's activity, nothing else.
  const single = { ...snapshot, accounts: [snapshot.accounts[0]], entries: snapshot.entries.filter(entry => entry.accountId === 'a') };
  const incomeOnly = { ...single, entries: [...single.entries, { ...snapshot.entries[0], id: 'pay', kind: 'income' as const, category: 'Sueldo', dateISO: '2026-09-10' }] };
  const withIncome = routeHarness('(tabs)/index.tsx', {}, incomeOnly).render();
  assert.equal(sectionTitles(withIncome).join(), 'Actividad reciente');
  assert.equal(nodes(withIncome).filter(n => n.type === 'EntryRow').map(n => n.props.entry.id).join(), 'pay');
  assert.equal(nodes(withIncome).some(n => n.type === 'EmptyState'), false);
  assert.deepEqual([find(withIncome, 'Money').props.minor, find(withIncome, 'Money').props.color], [0, lightPalette.heroSecondary], 'a true zero reads quieter');
  assertNoSubline(withIncome, '24UX6C: no «Sin gastos este mes» under a zero');
});
test('24UX6A review: the quiet line names the currency shown when another one is held, and its detail names the dock\'s Registrar (+) button', () => {
  const at = '2026-09-01T12:00:00.000Z';
  const pesos: domain.Account = { id: 'a', name: 'Efectivo', currency: 'ARS', openingMinor: 0, createdAt: at };
  const dollars: domain.Account = { id: 'u', name: 'Dólares', currency: 'USD', openingMinor: 0, createdAt: at };
  // This month only has a USD movement; no commitment is due.
  const usdOnly: domain.LedgerSnapshot = { accounts: [pesos, dollars],
    entries: [{ id: 'usd', accountId: 'u', kind: 'expense', amountMinor: 1000, merchant: 'Comercio', category: 'Comida', dateISO: '2026-09-10', createdAt: at }] };
  const DETAIL = 'Registrá un gasto con el botón Registrar (+) o contáselo al Asistente.';
  const quietOf = (root: Node) => nodes(root).filter(n => n.type === 'EmptyState');
  // Single mode on ARS with ARS and USD held: «this month» alone would be false (there is a USD movement), so it names ARS.
  const view = routeHarness('(tabs)/index.tsx', {}, usdOnly, {}, displayStore({ [displayCurrency.DISPLAY_CURRENCY_KEY]: 'ARS' }));
  let root = view.render();
  assert.equal(find(root, 'DisplayCurrencyButton').props.currency, 'ARS');
  assert.equal(quietOf(root).length, 1, 'one quiet line');
  assert.deepEqual([quietOf(root)[0].props.title, quietOf(root)[0].props.detail], ['Todavía no hay movimientos en ARS este mes', DETAIL]);
  assert.equal(quietOf(root)[0].props.action, undefined, 'no button: recording is the dock\'s');
  // Switching to USD shows the movement: no quiet line.
  find(root, 'DisplayCurrencyButton').props.onCurrency('USD');
  root = view.render();
  assert.equal(quietOf(root).length, 0);
  assert.equal(nodes(root).filter(n => n.type === 'EntryRow').map(n => n.props.entry.id).join(), 'usd');
  // One currency held: nothing to tell apart, the plain line.
  root = routeHarness('(tabs)/index.tsx', {}, { accounts: [pesos], entries: [] }).render();
  assert.deepEqual([quietOf(root).length, quietOf(root)[0].props.title, quietOf(root)[0].props.detail], [1, 'Todavía no hay movimientos este mes', DETAIL]);
  // Consolidated over both currencies with an empty month: every account is shown, so no currency is named.
  root = routeHarness('(tabs)/index.tsx', {}, { accounts: [pesos, dollars], entries: [] }, {}, displayStore({ [displayCurrency.DISPLAY_MODE_KEY]: 'consolidated' }), { book: consolidatedRates() }).render();
  assert.equal(quietOf(root).map(n => n.props.title).join(), 'Todavía no hay movimientos este mes');
  // English follows the same rule.
  locale = 'en-AR';
  try {
    root = routeHarness('(tabs)/index.tsx', {}, usdOnly, {}, displayStore({ [displayCurrency.DISPLAY_CURRENCY_KEY]: 'ARS' })).render();
    assert.equal(quietOf(root).map(n => n.props.title).join(), 'No transactions in ARS this month yet');
  } finally { locale = 'es-AR'; }
});
test('24UX6C: with two or more currencies the chip and its help stay in the scope row; Gastado shows a help only when converted, Disponible always', () => {
  const rowOf = (root: Node) => [fieldChildren(root)[1].props.children].flat().filter(Boolean).map((n: Node) => n.type).join('|');
  const inNumber = (root: Node) => nodes(find(root, 'ValueTransition')).some(n => n.type === 'MetricHelp');
  // Single mode on ARS with USD held: Gastado is unconverted, so no help; Disponible explains itself in the scope row.
  const single = routeHarness('(tabs)/index.tsx', {}, homeData);
  assert.deepEqual([rowOf(single.render()), inNumber(single.render())], ['DisplayCurrencyButton', false], 'Gastado unconverted: the chip alone');
  metricOf(single.render()).props.onChange('available');
  assert.deepEqual([rowOf(single.render()), inNumber(single.render())], ['DisplayCurrencyButton|MetricHelp', false]);
  assert.equal(find(single.render(), 'MetricHelp').props.title, 'Disponible');
  // Consolidated: Gastado converted, so the rate's help, in the scope row, never beside the number.
  const consolidated = routeHarness('(tabs)/index.tsx', {}, homeData, {}, displayStore({ [displayCurrency.DISPLAY_MODE_KEY]: 'consolidated' }), { book: consolidatedRates() });
  assert.deepEqual([rowOf(consolidated.render()), inNumber(consolidated.render())], ['DisplayCurrencyButton|MetricHelp', false]);
  assert.equal(find(consolidated.render(), 'MetricHelp').props.title, bindLocale('es-AR').t('fx.infoTitle'));
  metricOf(consolidated.render()).props.onChange('available');
  assert.deepEqual([rowOf(consolidated.render()), inNumber(consolidated.render())], ['DisplayCurrencyButton|MetricHelp', false]);
  // The number's row carries no help with a scope row: the number alone.
  assert.equal([find(consolidated.render(), 'ValueTransition').props.children].flat().filter(Boolean).map((n: Node) => n.type).join('|'), 'View');
  // The chip is quieter in 24UX6C (weight 500) but keeps its place and props on the field.
  const chip = find(consolidated.render(), 'DisplayCurrencyButton');
  assert.deepEqual([chip.props.onField, chip.props.mode, chip.props.currency], [true, 'consolidated', 'ARS']);
});
test('24UX5 review, 24UX6A: Inicio\'s recent rows name their account only when the visible rows come from more than one account', () => {
  const at = '2026-09-10T12:00:00Z';
  // Two ARS accounts owned: owning two is not enough, the visible rows decide (Inicio passes visibleNamesAccount(recent)).
  const accounts: domain.Account[] = [{ id: 'a', name: 'Efectivo', currency: 'ARS', openingMinor: 0, createdAt: at }, { id: 'b', name: 'Banco', currency: 'ARS', openingMinor: 0, createdAt: at }];
  const entry = (id: string, accountId: string, merchant: string, category: string): domain.Entry => ({ id, accountId, kind: 'expense', amountMinor: 100, merchant, category, dateISO: '2026-09-10', createdAt: at });
  const shown = (root: Node) => nodes(root).filter(node => node.type === 'EntryRow').map(node => node.props.showAccount);
  const oneVisible: domain.LedgerSnapshot = { accounts, entries: [entry('1', 'a', 'Parrilla', 'Restaurantes'), entry('2', 'a', 'Coto', 'Supermercado')] };
  assert.equal(presentation.visibleNamesAccount(oneVisible.entries), false);
  assert.equal(shown(routeHarness('(tabs)/index.tsx', {}, oneVisible).render()).join(), 'false,false', 'every visible row in «Efectivo»: no row repeats it');
  const twoVisible: domain.LedgerSnapshot = { accounts, entries: [...oneVisible.entries, entry('3', 'b', 'Farmacia', 'Salud')] };
  assert.equal(presentation.visibleNamesAccount(twoVisible.entries), true);
  const root = routeHarness('(tabs)/index.tsx', {}, twoVisible).render();
  assert.equal(shown(root).join(), 'true,true,true', 'the visible rows span two accounts: each row names its own');
  assert.equal(nodes(root).filter(n => n.type === 'EntryRow').map(n => n.props.entry.id + ':' + n.props.account.name).sort().join(), '1:Efectivo,2:Efectivo,3:Banco');
  // A row of the second account that falls outside the visible rows (last month) does not make the visible ones name theirs.
  const lastMonth: domain.LedgerSnapshot = { accounts, entries: [...oneVisible.entries, { ...entry('old', 'b', 'Farmacia', 'Salud'), dateISO: '2026-08-20' }] };
  assert.equal(shown(routeHarness('(tabs)/index.tsx', {}, lastMonth).render()).join(), 'false,false');
});
test('24UX5 review: a commitment names its account only when the visible rules come from more than one account', () => {
  const at = '2026-09-10T12:00:00Z';
  const accounts: domain.Account[] = [{ id: 'a', name: 'a', currency: 'ARS', openingMinor: 0, createdAt: at }, { id: 'b', name: 'Banco', currency: 'ARS', openingMinor: 0, createdAt: at }];
  const entries: domain.Entry[] = [{ id: '1', accountId: 'a', kind: 'expense', amountMinor: 100, merchant: 'Parrilla', category: 'Restaurantes', dateISO: '2026-09-10', createdAt: at },
    { id: '3', accountId: 'b', kind: 'expense', amountMinor: 100, merchant: 'Farmacia', category: 'Salud', dateISO: '2026-09-10', createdAt: at }];
  const shown = (root: Node) => nodes(root).filter(node => node.type === 'UpcomingRecurringRow').map(node => node.props.showAccount);
  const rule = (id: string, accountId: string, merchant = 'Netflix'): domain.RecurringRule => ({ id, accountId, kind: 'expense', amountMinor: 4321, merchant, category: 'Suscripciones',
    frequency: 'monthly', anchorDateISO: '2026-09-16', nextDateISO: '2026-09-16', active: true, deleted: false, createdAt: at, revision: 0, updatedAt: at });
  let root = routeHarness('(tabs)/index.tsx', {}, { accounts, entries }, { recurring: [rule('r1', 'a'), rule('r2', 'a', 'aa')] }).render();
  assert.equal(shown(root).join(), 'false,false', 'both rules in one account, even though the month\'s movements span two');
  const upcoming = nodes(root).filter(node => node.type === 'UpcomingRecurringRow');
  assert.equal(upcoming.map(node => node.props.rule.merchant + ':' + node.props.showCategory).join(), 'aa:true,Netflix:false', '"aa" keeps its category in the agenda');
  assert.equal(upcoming.map(node => node.props.rule.amountMinor + '@' + node.props.rule.nextDateISO).join(), '4321@2026-09-16,4321@2026-09-16');
  root = routeHarness('(tabs)/index.tsx', {}, { accounts, entries }, { recurring: [rule('r1', 'a'), rule('r2', 'b')] }).render();
  assert.equal(shown(root).join(), 'true,true');
});
test('24UX6A: Inicio keeps one number and nothing that is not about now', () => {
  const root = routeHarness('(tabs)/index.tsx', {}, homeData, { recurring: [dueRule()] }).render();
  assert.equal(sectionTitles(root).join('|'), 'Próximos compromisos|Actividad reciente', 'no «En qué gastaste»');
  for (const gone of RETIRED.concat(['ActionButton', 'IconButton'])) assert.equal(nodes(root).some(node => node.type === gone), false, gone + ' left Inicio');
  assert.equal(nodes(root).filter(node => node.type === 'Choices').length, 1, 'Gastado / Disponible');
  assert.equal(nodes(root).filter(node => node.type === 'DisplayCurrencyButton').length, 1);
  assert.equal(nodes(root).filter(node => node.type === 'Money').length, 1, 'one hero; the commitments and rows draw their own amounts');
});
// ---- 24UX3: Home hierarchy ---------------------------------------------------------------------------------------

test('24UX6A: no root title, the accounts on the field, the number in a keyed crossfade without the chip, and grouped sections that move calmly', () => {
  const view = routeHarness('(tabs)/index.tsx', {}, homeData, { recurring: [dueRule()] });
  const root = view.render();
  assert.equal(homeTexts(root).includes('Inicio'), false, 'the selected tab names the screen');
  assert.equal(find(root, 'DisplayCurrencyButton').props.onField, true);
  assert.equal(find(root, 'Choices').props.onField, true);
  // Review of 24UX6A: the chip's sheet changes the crossfade's key (mode, currency), so the chip lives outside it and is never remounted with its sheet open.
  const crossfade = find(root, 'ValueTransition');
  assert.equal(crossfade.props.id, 'spending|single|ARS');
  assert.ok(nodes(crossfade).some(node => node.type === 'Money'));
  assert.equal(nodes(crossfade).some(node => node.type === 'DisplayCurrencyButton' || node.type === 'Choices'), false);
  const titles = nodes(root).filter(node => node.type === 'SectionTitle');
  assert.equal(titles.every(node => node.props.quiet === true && typeof node.props.onAction === 'function' && node.props.action === 'Ver todos'), true, 'quiet links');
  const surfaces = nodes(root).filter(node => node.type === 'Surface');
  assert.equal(surfaces.length, 2);
  assert.equal(surfaces.every(surface => surface.props.grouped === true), true, '24UX6A: each section is one grouped surface');
  assert.ok(nodes(surfaces[0]).some(node => node.type === 'UpcomingRecurringRow'));
  assert.ok(nodes(surfaces[1]).some(node => node.type === 'EntryRow'));
  assert.equal(nodes(root).filter(node => node.type === 'Reflow').length, 2, 'a module that appears or leaves moves the layout calmly (Reflow honours Reduce Motion)');
});
// 24UX5: glyphs per category in the harness (the default mock gave every category one glyph); a test may alias two.
test('24UX5: a commitment names its category only when it adds something', () => {
  const at = '2026-09-12T12:00:00Z';
  const cash: domain.Account = { id: 'a', name: 'Efectivo', currency: 'ARS', openingMinor: 0, createdAt: at };
  const rule = (id: string, merchant: string, category: string): domain.RecurringRule => ({ id, accountId: 'a', kind: 'expense', amountMinor: 100, merchant, category, frequency: 'monthly',
    anchorDateISO: '2026-09-15', nextDateISO: '2026-09-15', active: true, deleted: false, createdAt: at, revision: 0, updatedAt: at });
  const shows = (root: Node) => Object.fromEntries(nodes(root).filter(n => n.type === 'UpcomingRecurringRow').map(n => [n.props.rule.id, n.props.showCategory]));
  const data = { accounts: [cash], entries: [] };
  let root = routeHarness('(tabs)/index.tsx', {}, data, { recurring: [rule('named', 'Netflix', 'Suscripciones'), rule('short', 'f', 'Comida')] }).render();
  assert.deepEqual(shows(root), { named: false, short: true }, 'a clear name keeps the date alone; "f" keeps its category');
  root = routeHarness('(tabs)/index.tsx', {}, data, { recurring: [rule('generic', 'Varios', 'Hogar'), rule('same', 'Transporte', 'Transporte')] }).render();
  assert.deepEqual(shows(root), { generic: true, same: false }, '"Varios" keeps its category; a name that is the category never repeats it');
  // Two categories that draw the same glyph each say which they are.
  glyphAliases.set('Comida', 'glyph-suscripciones');
  try {
    root = routeHarness('(tabs)/index.tsx', {}, data, { recurring: [rule('named', 'Netflix', 'Suscripciones'), rule('short', 'f', 'Comida')] }).render();
    assert.deepEqual(shows(root), { named: true, short: true });
  } finally { glyphAliases.clear(); }
});
// 24UX5 §8, 24UX6A: the composition with more data. Whatever the ledger holds, Inicio keeps one order (the field: the
// month and the accounts, the scope, the number (24UX6C: no line under it), the metric; then what is due, then the month's activity);
// nothing appears to show a feature.
test('24UX6A: Inicio keeps its hierarchy with no account, one or several accounts and currencies, budgets, rules and huge amounts', () => {
  const at = '2026-09-01T12:00:00.000Z';
  const account = (id: string, currency: domain.Currency, name = id): domain.Account => ({ id, name, currency, openingMinor: 0, createdAt: at });
  const spend = (id: string, accountId: string, category: string, amountMinor: number, kind: 'expense' | 'income' = 'expense'): domain.Entry =>
    ({ id, accountId, kind, amountMinor, merchant: 'Comercio ' + id, category, dateISO: '2026-09-10', createdAt: at });
  const rule = (id: string, overrides: Partial<domain.RecurringRule> = {}): domain.RecurringRule => ({ id, accountId: 'a', kind: 'expense', amountMinor: 100, merchant: 'Regla ' + id,
    category: 'Servicios', frequency: 'monthly', anchorDateISO: '2026-09-15', nextDateISO: '2026-09-15', active: true, deleted: false, createdAt: at, revision: 0, updatedAt: at, ...overrides });
  const total = (amountMinor: number): domain.MonthlyBudget => ({ id: 'total', scope: 'total', currency: 'ARS', monthISO: '2026-09', amountMinor, active: true, createdAt: at, revision: 0, updatedAt: at });
  const order = (root: Node) => nodes(root).map(node => node.type === 'SectionTitle' ? 'title:' + node.props.children
    : node.type === 'AppText' && node.props.accessibilityRole === 'header' ? 'month' : node.type === 'AppText' && SUBLINE.test(textOf(node)) ? 'subline'
      : node.type === 'EmptyState' ? 'empty:' + node.props.title : node.type)
    .filter(type => ['month', 'FieldButton', 'DisplayCurrencyButton', 'Money', 'subline', 'Choices', 'BudgetAttentionRow', 'UpcomingRecurringRow', 'EntryRow'].concat(RETIRED).includes(type) || /^(title|empty):/.test(type))
    .filter((type, index, all) => type !== all[index - 1]);
  // 24C1 / 25B2: the chip is part of the field only while two or more currencies are held.
  // 24UX6C: no line under the number; a «subline» in the order would fail here.
  const expected = (modules: string[], chip = false) => ['month', 'FieldButton', ...(chip ? ['DisplayCurrencyButton'] : []), 'Money', 'Choices', ...modules];

  // No account: the field and the start, nothing else.
  assert.deepEqual(order(routeHarness('(tabs)/index.tsx', {}, { accounts: [], entries: [] }).render()), expected(['empty:Entendé tus gastos.']));
  // One account, nothing recorded: the field and one quiet line.
  assert.deepEqual(order(routeHarness('(tabs)/index.tsx', {}, { accounts: [account('a', 'ARS')], entries: [] }).render()), expected(['empty:Todavía no hay movimientos este mes']));
  // Several categories, incomes and expenses, several accounts of one currency, a second currency, an overall budget
  // already exceeded, one active rule this week, one paused and one deleted (neither shown), and an amount of 13 digits.
  const data = { accounts: [account('a', 'ARS', 'Efectivo'), account('b', 'ARS', 'Banco'), account('u', 'USD', 'Dólares')],
    entries: [spend('1', 'a', 'Comida', 9_999_999_999_999), spend('2', 'b', 'Transporte', 500), spend('3', 'a', 'Salud', 300), spend('4', 'a', 'Ocio', 200),
      spend('5', 'b', 'Sueldo', 900_000, 'income'), spend('6', 'u', 'Viajes', 4_000)] };
  const extra = { budgets: [total(1000)], recurring: [rule('on'), rule('paused', { active: false }), rule('gone', { active: false, deleted: true })] };
  const view = routeHarness('(tabs)/index.tsx', {}, data, extra);
  let root = view.render();
  // 24UX6C2: the exceeded general budget is one row before what is due.
  assert.deepEqual(order(root), expected(['BudgetAttentionRow', 'title:Próximos compromisos', 'UpcomingRecurringRow', 'title:Actividad reciente', 'EntryRow'], true));
  assert.equal(find(root, 'BudgetAttentionRow').props.attention.state, 'exceeded');
  assert.equal(find(root, 'Money').props.minor, 9_999_999_999_999 + 500 + 300 + 200, 'the huge amount reaches the hero exactly (Money fits it to the width)');
  assert.equal(nodes(root).filter(node => node.type === 'UpcomingRecurringRow').map(node => node.props.rule.id).join(), 'on', 'paused and deleted rules are not upcoming');
  assert.equal(nodes(root).filter(node => node.type === 'EntryRow').length, 4, 'four rows under a commitment (five ARS movements this month)');
  // Switching the currency keeps the same order; what has nothing in USD simply stays out (the rule is an ARS account's, the budget an ARS one).
  find(root, 'DisplayCurrencyButton').props.onCurrency('USD');
  root = view.render();
  assert.deepEqual(order(root), expected(['title:Actividad reciente', 'EntryRow'], true));
  assert.equal(nodes(root).filter(node => node.type === 'EntryRow').map(node => node.props.entry.id).join(), '6');
  // Several rules in the window: two at most, soonest first.
  const many = routeHarness('(tabs)/index.tsx', {}, data, { recurring: ['d', 'b', 'a', 'c'].map((id, index) => rule(id, { nextDateISO: '2026-09-1' + (3 + index), anchorDateISO: '2026-09-1' + (3 + index) })) }).render();
  assert.equal(nodes(many).filter(node => node.type === 'UpcomingRecurringRow').map(node => node.props.rule.id).join(), 'd,b');
});
// ---- Producto 24C1: the consolidated total ------------------------------------------------------------------
// The synthetic rates (`consolidatedRates`) are defined with the fixtures above.

test('24C1: a new installation opens Inicio on the consolidated total: every account, each expense at its own date, original rows, the rate behind an info button', () => {
  const display = displayStore({ [displayCurrency.DISPLAY_MODE_KEY]: 'consolidated' });
  const ensured: { months: readonly string[]; quotes: readonly string[] }[] = [];
  const view = routeHarness('(tabs)/index.tsx', {}, homeData, {}, display, { book: consolidatedRates(), ensured });
  let root = view.render();
  // ARS 1,00 + 2,00, and USD 10,00 of the 11th at 2000 → ARS 20.000,00.
  assert.deepEqual([find(root, 'Money').props.minor, find(root, 'Money').props.currency], [100 + 200 + 2000000, 'ARS']);
  assert.equal(nodes(root).filter(n => n.type === 'Money').length, 1, 'one number: no equivalent under it');
  assert.equal(find(root, 'DisplayCurrencyButton').props.mode, 'consolidated');
  assert.match(find(root, 'MetricHelp').props.detail, /^Gastos de todas tus cuentas en Pesos argentinos\. .*Frankfurter.*10\/9\/2026/);
  assert.equal(nodes(root).some(n => RETIRED.includes(n.type)), false, 'no concentration line');
  // Original rows: each movement keeps its own amount and currency in the month's activity.
  assert.equal(nodes(root).filter(n => n.type === 'EntryRow').map(n => n.props.entry.id + ':' + n.props.entry.amountMinor + ':' + n.props.account.currency).join(),
    'income:500:ARS,usd:1000:USD,now:200:ARS,early:100:ARS', 'newest first; a same-day tie by when it was recorded, then by id, as in Movimientos');
  assert.equal(JSON.stringify(ensured.at(-1)), JSON.stringify({ months: ['2026-09'], quotes: ['ARS'] }), 'only the month shown and the one quote it needs');
  // Disponible: ARS 95,94 and USD 80,01 at today's rate (the 10th's, 2000) → ARS 160.020,00.
  nodes(root).find(n => n.type === 'Choices' && n.props.value === 'spending')!.props.onChange('available');
  root = view.render();
  assert.equal(find(root, 'Money').props.minor, 9594 + 16002000);
  assert.match(find(root, 'MetricHelp').props.detail, /^Dinero registrado en todas tus cuentas, en Pesos argentinos, con la cotización de referencia del 10\/9\/2026/);
  // The secondary option: one currency only, the 24B6 filter.
  find(root, 'DisplayCurrencyButton').props.onMode('single');
  root = view.render();
  assert.equal(find(root, 'Money').props.minor, 9594, 'the ARS accounts alone, nothing converted');
  assert.equal(display.getMode(), 'single');
});

test('24C1: without a rate Inicio shows each currency\'s own figure and why, never a partial sum; a display currency no account holds is allowed', () => {
  const display = displayStore({ [displayCurrency.DISPLAY_MODE_KEY]: 'consolidated', [displayCurrency.DISPLAY_CURRENCY_KEY]: 'EUR' });
  const ensured: { months: readonly string[]; quotes: readonly string[] }[] = [];
  const root = routeHarness('(tabs)/index.tsx', {}, homeData, {}, display, { book: consolidatedRates(), activity: 'offline', ensured }).render();
  assert.equal(nodes(root).some(n => n.type === 'Money'), false, 'no total');
  const parts = find(root, 'CurrencyParts');
  assert.equal(JSON.stringify(parts.props.parts), JSON.stringify([{ currency: 'ARS', minor: 300 }, { currency: 'USD', minor: 1000 }]));
  assert.equal(parts.props.line, 'Sin cotización para sumarlo en EUR');
  assert.match(parts.props.detail, /^Sin conexión: no pudimos obtener la cotización USD → EUR del 1\/9\/2026/);
  assert.equal(nodes(root).some(n => RETIRED.includes(n.type)), false, 'no category shares of a partial month');
  assert.equal(parts.props.onField, true, 'drawn in the field\'s ink');
  assert.equal(homeTexts(root).some(text => /por día/.test(text)), false, 'no daily average of a partial sum');
  assert.equal(ensured.at(-1)?.quotes.join(), 'ARS,EUR');
  assert.equal(find(root, 'DisplayCurrencyButton').props.currency, 'EUR', 'the display currency no account holds is shown');
});

test('24C1: a ledger in one currency shown in that currency asks the provider nothing and reads as before', () => {
  const onlyPesos: domain.LedgerSnapshot = { ...homeData, accounts: homeData.accounts.filter(account => account.currency === 'ARS'), entries: homeData.entries.filter(entry => entry.accountId === 'a') };
  const ensured: { months: readonly string[]; quotes: readonly string[] }[] = [];
  const root = routeHarness('(tabs)/index.tsx', {}, onlyPesos, {}, displayStore({ [displayCurrency.DISPLAY_MODE_KEY]: 'consolidated' }), { book: domain.rateBook([]), ensured }).render();
  assert.equal(find(root, 'Money').props.minor, 300);
  assert.equal(ensured.length, 0);
  assert.equal(nodes(root).some(n => n.type === 'MetricHelp'), false, 'nothing converted: no rate to explain');
});

// ---- 24C1 review: the consolidated total with budgets in the ledger ---------------------------------------------

const budgetLedger = (): { data: domain.LedgerSnapshot; extra: Partial<domain.LedgerArchive>; book: domain.RateBook } => {
  const accounts: domain.Account[] = [{ id: 'a', name: 'Pesos', currency: 'ARS', openingMinor: 100000, createdAt }, { id: 'e', name: 'Euros', currency: 'EUR', openingMinor: 100000, createdAt }];
  const entries: domain.Entry[] = [
    { id: 'ars', accountId: 'a', kind: 'expense', amountMinor: 300, merchant: 'Kiosco', category: 'Comida', dateISO: '2026-09-11', createdAt },
    { id: 'eur', accountId: 'e', kind: 'expense', amountMinor: 500, merchant: 'Bäckerei', category: 'Comida', dateISO: '2026-09-11', createdAt },
  ];
  const budget = (id: string, currency: domain.Currency, amountMinor: number): domain.MonthlyBudget =>
    ({ id, scope: 'total', currency, monthISO: '2026-09', amountMinor, active: true, createdAt, revision: 0, updatedAt: createdAt });
  const book = domain.rateBook([
    { base: 'USD', quote: 'ARS', rate: '1000', effectiveDate: '2026-09-10', source: 'Frankfurter', fetchedAt: '2026-09-12T12:00:00.000Z' },
    { base: 'USD', quote: 'EUR', rate: '0.5', effectiveDate: '2026-09-10', source: 'Frankfurter', fetchedAt: '2026-09-12T12:00:00.000Z' },
  ]);
  return { data: { accounts, entries }, extra: { budgets: [budget('b-ars', 'ARS', 320), budget('b-eur', 'EUR', 520)] }, book };
};
const sectionText = (node: Node) => Array.isArray(node.props.children) ? node.props.children.join('') : String(node.props.children);

test('24C1 review, 24UX6C2, 24UX6D refinement: with ARS and EUR budgets in the ledger, Inicio converts the total, never a budget: each budget row is measured in its own currency in every mode', () => {
  const { data, extra, book } = budgetLedger();
  const display = displayStore({ [displayCurrency.DISPLAY_MODE_KEY]: 'single', [displayCurrency.DISPLAY_CURRENCY_KEY]: 'ARS' });
  const view = routeHarness('(tabs)/index.tsx', {}, data, extra, display, { book });
  let root = view.render();
  // ARS 3,00 of 3,20 (94 %) and EUR 5,00 of 5,20 (96 %): both warnings. Each row is its budget's own ledger, never a
  // converted total. 24UX6C2 showed one of them; since the 24UX6D refinement both, the higher ratio (EUR) first.
  type Expected = [currency: domain.Currency, labelsCurrency: boolean, spentMinor: number, limitMinor: number];
  const ars = (labelsCurrency: boolean): Expected => ['ARS', labelsCurrency, 300, 320];
  const eur = (labelsCurrency: boolean): Expected => ['EUR', labelsCurrency, 500, 520];
  const budgetRow = (label: string, ...expected: Expected[]) => {
    assert.equal(nodes(root).some(n => RETIRED.includes(n.type)) || homeTexts(root).some(text => /presupuesto/i.test(text)), false, label + ': no budget card or line');
    const rows = nodes(root).filter(n => n.type === 'BudgetAttentionRow');
    assert.equal(JSON.stringify(rows.map(row => [row.props.currency, row.props.labelsCurrency, row.props.attention.state, row.props.attention.progress.budget.currency,
      row.props.attention.progress.spentMinor, row.props.attention.progress.budget.amountMinor])),
    JSON.stringify(expected.map(([currency, labelsCurrency, spentMinor, limitMinor]) => [currency, labelsCurrency, 'warning', currency, spentMinor, limitMinor])), label);
  };
  assert.equal(find(root, 'Money').props.minor, 300, 'single ARS: the ARS expense alone');
  budgetRow('single ARS', ars(false));
  // Consolidated, total read in ARS: the number converts the euros (€5 → US$10 → ARS 10.000); the ARS budget still reads the ARS 3,00 alone.
  find(root, 'DisplayCurrencyButton').props.onMode('consolidated');
  root = view.render();
  assert.equal(find(root, 'Money').props.minor, 300 + 1000000, 'the total is every account');
  budgetRow('consolidated ARS', eur(true), ars(false));
  // Total read in USD: no USD budget; both held currencies' budgets, named; the rows keep their own currencies.
  find(root, 'DisplayCurrencyButton').props.onCurrency('USD');
  root = view.render();
  budgetRow('consolidated USD', eur(true), ars(true));
  assert.equal(nodes(root).filter(n => n.type === 'EntryRow').map(n => n.props.entry.id + ':' + n.props.entry.amountMinor).sort().join(), 'ars:300,eur:500');
  find(root, 'DisplayCurrencyButton').props.onCurrency('EUR');
  root = view.render();
  budgetRow('consolidated EUR', eur(false), ars(true));
  // A missing rate hides the consolidated total; the budget needs no rate, so its row stays, unconverted.
  root = routeHarness('(tabs)/index.tsx', {}, data, extra, displayStore({ [displayCurrency.DISPLAY_MODE_KEY]: 'consolidated', [displayCurrency.DISPLAY_CURRENCY_KEY]: 'USD' }), { book: domain.rateBook([]), activity: 'offline' }).render();
  assert.equal(nodes(root).some(n => n.type === 'Money'), false);
  budgetRow('consolidated USD offline', eur(true), ars(true));
});
test('24C1 review: the chip says what the number covers: "Total · USD" for every account converted, "Solo USD" for that currency alone', () => {
  const { data, extra, book } = budgetLedger();
  const display = displayStore({ [displayCurrency.DISPLAY_MODE_KEY]: 'consolidated', [displayCurrency.DISPLAY_CURRENCY_KEY]: 'USD' });
  const view = routeHarness('(tabs)/index.tsx', {}, data, extra, display, { book });
  let chip = find(view.render(), 'DisplayCurrencyButton');
  assert.deepEqual([chip.props.mode, chip.props.currency], ['consolidated', 'USD']);
  const es = bindLocale('es-AR').t, en = bindLocale('en-US').t;
  assert.deepEqual([es('display.total', { code: 'USD' }), es('display.only', { code: 'USD' })], ['Total · USD', 'Solo USD']);
  assert.deepEqual([en('display.total', { code: 'USD' }), en('display.only', { code: 'USD' })], ['Total · USD', 'USD only']);
  assert.deepEqual([es('display.chipConsolidated', { name: 'dólares estadounidenses' }), es('display.chipSingle', { name: 'dólares estadounidenses' })],
    ['Total consolidado en dólares estadounidenses', 'Solo dólares estadounidenses'], 'VoiceOver says the scope in words');
  chip.props.onMode('single');
  chip = find(view.render(), 'DisplayCurrencyButton');
  assert.deepEqual([chip.props.mode, chip.props.currency], ['single', 'ARS'], 'USD is not held: the first held currency, as 24B6 resolved it');
});

// ---- 25B2 review: a deleted account's currency stays in the history ------------------------------------------

test('25B2 review: deleting the last USD account keeps its movements on Inicio: the consolidated total counts them, the chip stays, "Solo USD" still reads them, and without a rate the parts say so', () => {
  const deletedAt = '2026-09-20T10:00:00.000Z';
  const data: domain.LedgerSnapshot = { ...homeData, accounts: homeData.accounts.map(account => account.id === 'u' ? { ...account, revision: 1, updatedAt: deletedAt, deletedAt } : account) };
  const display = displayStore({ [displayCurrency.DISPLAY_MODE_KEY]: 'consolidated', [displayCurrency.DISPLAY_CURRENCY_KEY]: 'ARS' });
  const ensured: { months: readonly string[]; quotes: readonly string[] }[] = [];
  const view = routeHarness('(tabs)/index.tsx', {}, data, {}, display, { book: consolidatedRates(), ensured });
  let root = view.render();
  assert.deepEqual([find(root, 'Money').props.minor, find(root, 'Money').props.currency], [100 + 200 + 2000000, 'ARS'], 'the USD expense of the 11th still converts at its date');
  const chip = find(root, 'DisplayCurrencyButton');
  assert.deepEqual([chip.props.mode, chip.props.currency], ['consolidated', 'ARS'], 'two currencies in the history: the chip stays');
  assert.equal(JSON.stringify(ensured.at(-1)), JSON.stringify({ months: ['2026-09'], quotes: ['ARS'] }), 'the provider is still asked for the USD → ARS rate');
  // Each recent row carries the stored account it was recorded in, the deleted USD one included, with that account's own currency.
  const recentRows = nodes(root).filter(n => n.type === 'EntryRow');
  assert.equal(JSON.stringify(recentRows.map(n => [n.props.entry.id, n.props.account.currency])), JSON.stringify([['income', 'ARS'], ['usd', 'USD'], ['now', 'ARS'], ['early', 'ARS']]),
    'the deleted account\'s row keeps its currency');
  assert.equal(recentRows.every(n => n.props.account === data.accounts.find(account => account.id === n.props.entry.accountId)), true, 'the stored account itself, not a copy or a live substitute');
  assert.equal(recentRows.find(n => n.props.entry.id === 'usd')!.props.account.deletedAt, deletedAt);
  // Disponible counts live accounts only: the deleted USD balance is history.
  nodes(root).find(n => n.type === 'Choices' && n.props.value === 'spending')!.props.onChange('available');
  root = view.render();
  assert.equal(find(root, 'Money').props.minor, 9594, 'ARS 95,94 alone: no USD balance converted');
  assertNoSubline(root, 'deleted USD account, Disponible');
  // "Solo USD" is still a view of the history: the USD expense alone, in its own currency.
  chip.props.onMode('single');
  chip.props.onCurrency?.('USD');
  display.set('USD');
  nodes(view.render()).find(n => n.type === 'Choices' && n.props.value === 'available')!.props.onChange('spending');
  root = view.render();
  assert.deepEqual([find(root, 'Money').props.minor, find(root, 'Money').props.currency], [1000, 'USD']);
  assert.deepEqual([find(root, 'DisplayCurrencyButton').props.mode, find(root, 'DisplayCurrencyButton').props.currency], ['single', 'USD']);
  assert.equal(nodes(root).filter(n => n.type === 'EntryRow').map(n => n.props.entry.id).join(), 'usd', 'the deleted account\'s movement is still this month\'s activity');
  // Without the rate, consolidated: the parts name both currencies, never a partial ARS sum.
  const offline = routeHarness('(tabs)/index.tsx', {}, data, {}, displayStore({ [displayCurrency.DISPLAY_MODE_KEY]: 'consolidated', [displayCurrency.DISPLAY_CURRENCY_KEY]: 'ARS' }), { book: domain.rateBook([]), activity: 'offline' }).render();
  assert.equal(nodes(offline).some(n => n.type === 'Money'), false);
  assert.equal(JSON.stringify(find(offline, 'CurrencyParts').props.parts), JSON.stringify([{ currency: 'ARS', minor: 300 }, { currency: 'USD', minor: 1000 }]));
  // With every USD account deleted and no USD movement left, the history is ARS alone: no chip, that currency's own ledger.
  const arsOnly: domain.LedgerSnapshot = { ...data, accounts: data.accounts.filter(account => account.currency === 'ARS') };
  const plain = routeHarness('(tabs)/index.tsx', {}, arsOnly, {}, displayStore({ [displayCurrency.DISPLAY_MODE_KEY]: 'consolidated', [displayCurrency.DISPLAY_CURRENCY_KEY]: 'USD' })).render();
  assert.equal(nodes(plain).some(n => n.type === 'DisplayCurrencyButton'), false);
  assert.deepEqual([find(plain, 'Money').props.minor, find(plain, 'Money').props.currency], [300, 'ARS']);
});

// ---- 24UX6C2: commitments in a 30-day window ---------------------------------------------------------------------

test('24UX6C2: from 2026-10-01 the commitments are the rules due 2026-10-01 … 2026-10-31, both ends inclusive, the same window as Recurrentes\' forecast; two at most, soonest first', () => {
  const at = '2026-09-20T12:00:00.000Z';
  const account: domain.Account = { id: 'a', name: 'Efectivo', currency: 'ARS', openingMinor: 0, createdAt: at };
  const entries: domain.Entry[] = ['1', '2', '3', '4', '5', '6', '7'].map(id => ({ id: 'oct' + id, accountId: 'a', kind: 'expense', amountMinor: 100, merchant: 'Comercio ' + id,
    category: 'Comida', dateISO: '2026-10-01', createdAt: '2026-10-01T0' + id + ':00:00.000Z' }));
  const due = (id: string, nextDateISO: string, overrides: Partial<domain.RecurringRule> = {}) => dueRule(id, { merchant: 'Regla ' + id, nextDateISO, anchorDateISO: nextDateISO, ...overrides });
  const data: domain.LedgerSnapshot = { accounts: [account], entries };
  today = '2026-10-01';
  try {
    const render = (recurring: domain.RecurringRule[]) => routeHarness('(tabs)/index.tsx', {}, data, { recurring }).render();
    const listed = (root: Node) => nodes(root).filter(n => n.type === 'UpcomingRecurringRow').map(n => n.props.rule.id).join();
    // Due on the 10th and on the 30th: both are listed, the 10th first; the activity is four rows under them.
    let root = render([due('oct30', '2026-10-30'), due('oct10', '2026-10-10')]);
    assert.equal(listed(root), 'oct10,oct30', 'nine and twenty-nine days away: both inside the window');
    assert.equal(sectionTitles(root).join('|'), 'Próximos compromisos|Actividad reciente');
    assert.equal(recentRows(root).length, 4, 'four recent rows under the commitments');
    assert.equal(nodes(root).filter(n => n.type === 'UpcomingRecurringRow').every(n => n.props.day === '2026-10-01'), true, 'each row reads its day from today');
    // The edges: today and today + 30 are in; a rule overdue since yesterday and one due the day after the window are not.
    assert.equal(listed(render([due('today', '2026-10-01')])), 'today', 'today is inside');
    assert.equal(listed(render([due('last', '2026-10-31')])), 'last', 'today + 30 days is inside');
    for (const outside of [due('next', '2026-11-01'), due('yesterday', '2026-09-30'), due('december', '2026-12-01')]) {
      root = render([outside]);
      assert.equal(listed(root), '', outside.nextDateISO + ' is outside the window');
      assert.equal(sectionTitles(root).join('|'), 'Actividad reciente', 'no commitments section, no placeholder');
      assert.equal(recentRows(root).length, 6, 'without commitments the activity has six rows');
    }
    // The same boundary as Recurrentes' «próximos 30 días» (recurringForecastByCurrency over today … today + 30).
    for (const rule of [due('today', '2026-10-01'), due('oct10', '2026-10-10'), due('last', '2026-10-31'), due('next', '2026-11-01')]) {
      const forecast = domain.recurringForecastByCurrency([rule], [account], today).length > 0;
      assert.equal(listed(render([rule])) === rule.id, forecast, rule.nextDateISO + ': Inicio and Recurrentes agree');
    }
    // Two at most, soonest first, cut only after sorting; a same-day tie by merchant.
    root = render([due('d', '2026-10-31'), due('c', '2026-10-20', { merchant: 'Zeta' }), due('b', '2026-10-20', { merchant: 'Alfa' }), due('far', '2026-11-02'), due('a', '2026-10-25')]);
    assert.equal(listed(root), 'b,c', 'the two soonest of four in the window; the tie on the 20th by merchant');
    // Never a recurring income, a paused or a deleted rule, however close.
    root = render([due('income', '2026-10-02', { kind: 'income', category: 'Sueldo' }), due('paused', '2026-10-02', { active: false }), due('gone', '2026-10-02', { deleted: true })]);
    assert.equal(listed(root), '');
    assert.equal(sectionTitles(root).includes('Próximos compromisos'), false);
    // «Ver todos» still opens Recurrentes.
    const view = routeHarness('(tabs)/index.tsx', {}, data, { recurring: [due('oct10', '2026-10-10')] });
    nodes(view.render()).find(n => n.type === 'SectionTitle' && n.props.children === 'Próximos compromisos')!.props.onAction();
    assert.equal(view.pushed.at(-1), '/recurring');
  } finally { today = '2026-09-12'; }
  assert.equal(homeFocus.COMMITMENT_WINDOW_DAYS, 30);
  assert.equal(homeFocus.COMMITMENT_ROWS, 2);
  assert.equal('COMMITMENT_HORIZON_DAYS' in homeFocus, false, 'the seven-day horizon is gone');
});

// ---- 24UX6C2: the general budget when it needs attention ---------------------------------------------------------

/** One ARS account with ARS 85,00 spent in September (two expenses), a rule due on the 15th and the synthetic budgets a test passes. */
const budgetHome = () => {
  const at = '2026-09-01T12:00:00.000Z';
  const data: domain.LedgerSnapshot = { accounts: [{ id: 'a', name: 'Banco', currency: 'ARS', openingMinor: 100000, createdAt: at }],
    entries: [{ id: 'super', accountId: 'a', kind: 'expense', amountMinor: 6000, merchant: 'Coto', category: 'Supermercado', dateISO: '2026-09-05', createdAt: at },
      { id: 'cine', accountId: 'a', kind: 'expense', amountMinor: 2500, merchant: 'Cine', category: 'Ocio', dateISO: '2026-09-10', createdAt: at }] };
  const total = (amountMinor: number, currency: domain.Currency = 'ARS', monthISO = '2026-09'): domain.MonthlyBudget =>
    ({ id: 'total-' + currency + '-' + monthISO, scope: 'total', currency, monthISO, amountMinor, active: true, createdAt: at, revision: 0, updatedAt: at });
  const category = (name: string, amountMinor: number): domain.MonthlyBudget =>
    ({ id: 'cat-' + name, scope: 'category', category: name, currency: 'ARS', monthISO: '2026-09', amountMinor, active: true, createdAt: at, revision: 0, updatedAt: at });
  return { data, total, category };
};
const budgetRows = (root: Node) => nodes(root).filter(n => n.type === 'BudgetAttentionRow');

test('24UX6C2, 24UX6D refinement: no budget, calm general and category budgets, or archived and last month\'s ones draw no budget UI at all (no row, no surface)', () => {
  const { data, total, category } = budgetHome();
  const archived = (budget: domain.MonthlyBudget): domain.MonthlyBudget => ({ ...budget, active: false, revision: 1, updatedAt: '2026-09-02T12:00:00.000Z' });
  const cases: [string, domain.MonthlyBudget[]][] = [['no budget', []], ['calm general (84 %)', [total(10120)]], ['a calm category (84 %)', [category('Ocio', 2977)]],
    ['calm general and calm categories', [total(20000), category('Supermercado', 7200), category('Ocio', 5000)]],
    ['an archived exceeded category', [archived(category('Supermercado', 1000))]], ['last month\'s exceeded general budget', [total(100, 'ARS', '2026-08')]]];
  for (const [label, budgets] of cases) {
    const root = routeHarness('(tabs)/index.tsx', {}, data, { budgets, recurring: [dueRule()] }).render();
    assert.equal(budgetRows(root).length, 0, label);
    assert.equal(nodes(root).filter(n => n.type === 'Surface').length, 2, label + ': only the commitments and the activity, no budget surface');
    assert.equal(nodes(root).some(n => n.type === 'Surface' && [n.props.children].flat().length === 0), false, label + ': no empty surface');
    assert.equal(sectionTitles(root).join('|'), 'Próximos compromisos|Actividad reciente', label);
  }
  assert.equal(domain.budgetState(domain.summarizeMonthlyBudgets(data, [total(10120)], 'ARS', '2026-09').total!), 'calm', 'the calm case is calm by the domain\'s own rule');
  assert.equal(domain.budgetState(domain.summarizeMonthlyBudgets(data, [category('Ocio', 2977)], 'ARS', '2026-09').rows[0]), 'calm');
});

test('24UX6D refinement (supersedes 24UX6C2\'s «category budgets alone draw no row»): a category budget in warning or exceeded is a row, its attention carrying the category budget', () => {
  const { data, total, category } = budgetHome();
  const cases: [string, domain.MonthlyBudget[], string][] = [['a category at 100 %', [category('Supermercado', 6000)], 'warning:cat-Supermercado'],
    ['a category at 85 %', [category('Ocio', 2941)], 'warning:cat-Ocio'], ['categories over their limits', [category('Supermercado', 1000), category('Ocio', 100)], 'exceeded:cat-Ocio,exceeded:cat-Supermercado'],
    ['a calm general budget beside an exceeded category', [total(20000), category('Supermercado', 1000)], 'exceeded:cat-Supermercado']];
  for (const [label, budgets, expected] of cases) {
    const root = routeHarness('(tabs)/index.tsx', {}, data, { budgets, recurring: [dueRule()] }).render();
    const rows = budgetRows(root);
    assert.equal(rows.map(row => row.props.attention.state + ':' + row.props.attention.progress.budget.id).join(), expected, label);
    for (const row of rows) {
      const stored: domain.MonthlyBudget = row.props.attention.progress.budget;
      assert.equal(stored.scope, 'category', label);
      assert.equal(stored, budgets.find(item => item.id === stored.id), label + ': the stored category budget itself');
      assert.equal(row.props.attention.progress.spentMinor, domain.summarizeMonthlyBudgets(data, budgets, 'ARS', '2026-09').rows.find(item => item.budget.id === stored.id)!.spentMinor, label);
    }
    assert.equal(nodes(root).filter(n => n.type === 'Surface').length, 3, label + ': one budget surface');
    assert.equal(sectionTitles(root).join('|'), 'Próximos compromisos|Actividad reciente', label + ': no budget section title');
  }
});

test('24UX6C2: a general budget at exactly 85 % is one warning row in a grouped surface after the field and before the commitments and the activity; tapping opens Presupuestos on its currency and month', () => {
  const { data, total } = budgetHome();
  const view = routeHarness('(tabs)/index.tsx', {}, data, { budgets: [total(10000)], recurring: [dueRule()] });
  const root = view.render();
  const rows = budgetRows(root);
  assert.equal(rows.length, 1);
  const row = rows[0];
  assert.equal(row.props.attention.state, 'warning', 'ARS 85,00 of ARS 100,00: the warning starts at 85 %');
  assert.equal(JSON.stringify([row.props.attention.progress.spentMinor, row.props.attention.progress.remainingMinor, row.props.attention.progress.ratio, row.props.attention.progress.budget.id]),
    JSON.stringify([8500, 1500, 0.85, 'total-ARS-2026-09']), 'the domain\'s own progress, in minor units');
  assert.equal(JSON.stringify([row.props.currency, row.props.labelsCurrency]), JSON.stringify(['ARS', false]), 'one currency held: nothing to name');
  // A grouped surface of its own, holding only the row.
  const surface = nodes(root).find(n => n.type === 'Surface' && nodes(n).includes(row))!;
  assert.equal(surface.props.grouped, true);
  assert.equal([surface.props.children].flat().filter(Boolean).length, 1, 'the row alone');
  assert.equal(nodes(fieldOf(root)).includes(row), false, 'outside the financial field');
  // The order: the field, the budget row, «Próximos compromisos», «Actividad reciente».
  const all = nodes(root);
  const position = (node: Node | undefined) => { assert.ok(node); return all.indexOf(node); };
  const titled = (title: string) => all.find(n => n.type === 'SectionTitle' && n.props.children === title);
  const order = [fieldOf(root), surface, titled('Próximos compromisos'), titled('Actividad reciente')].map(position);
  assert.equal(order.every((index, i) => i === 0 || index > order[i - 1]), true, 'field < budget < commitments < activity: ' + order.join());
  assert.equal(nodes(fieldOf(root)).length + position(fieldOf(root)) <= position(surface), true, 'after the whole field');
  assert.equal(sectionTitles(root).join('|'), 'Próximos compromisos|Actividad reciente', 'the row has no section title');
  assert.equal(nodes(root).filter(n => n.type === 'Surface').length, 3);
  // Tapping opens Presupuestos on the budget's currency and the current month.
  row.props.onPress();
  assert.equal(JSON.stringify(view.pushed.at(-1)), JSON.stringify({ pathname: '/budgets', params: { currency: 'ARS', month: '2026-09' } }));
  assert.equal(view.navigated.length, 0);
});

test('24UX6C2: a general budget at exactly 100 % is still a warning; one minor unit over is exceeded', () => {
  const { data, total } = budgetHome();
  const state = (limit: number) => budgetRows(routeHarness('(tabs)/index.tsx', {}, data, { budgets: [total(limit)] }).render()).map(n => n.props.attention.state).join();
  assert.equal(state(8500), 'warning', 'exactly the limit');
  assert.equal(state(8499), 'exceeded', 'one cent over');
  assert.equal(state(1000), 'exceeded');
  const over = budgetRows(routeHarness('(tabs)/index.tsx', {}, data, { budgets: [total(8000)] }).render())[0];
  assert.equal(JSON.stringify([over.props.attention.progress.spentMinor, over.props.attention.progress.remainingMinor, over.props.attention.progress.exceeded]), JSON.stringify([8500, -500, true]));
  // A future expense of this month counts in the budget as in Presupuestos (the whole month), never in Gastado to date.
  const later: domain.LedgerSnapshot = { ...data, entries: [...data.entries, { ...data.entries[0], id: 'later', amountMinor: 100, dateISO: '2026-09-25' }] };
  const root = routeHarness('(tabs)/index.tsx', {}, later, { budgets: [total(8500)] }).render();
  assert.equal(budgetRows(root)[0].props.attention.progress.spentMinor, domain.summarizeMonthlyBudgets(later, [total(8500)], 'ARS', '2026-09').total!.spentMinor);
  assert.equal(budgetRows(root)[0].props.attention.state, 'exceeded');
});

test('24UX6C2: the budget row\'s currency: consolidated in USD with only an ARS general budget names ARS and reads the ARS ledger unconverted; «Solo USD» shows none', () => {
  const at = '2026-09-01T12:00:00.000Z';
  const data: domain.LedgerSnapshot = { accounts: [{ id: 'a', name: 'Pesos', currency: 'ARS', openingMinor: 100000, createdAt: at }, { id: 'u', name: 'Dólares', currency: 'USD', openingMinor: 10000, createdAt: at }],
    entries: [{ id: 'ars', accountId: 'a', kind: 'expense', amountMinor: 9000, merchant: 'Coto', category: 'Supermercado', dateISO: '2026-09-05', createdAt: at },
      { id: 'usd', accountId: 'u', kind: 'expense', amountMinor: 700, merchant: 'App', category: 'Suscripciones', dateISO: '2026-09-11', createdAt: at }] };
  const arsBudget: domain.MonthlyBudget = { id: 'b-ars', scope: 'total', currency: 'ARS', monthISO: '2026-09', amountMinor: 10000, active: true, createdAt: at, revision: 0, updatedAt: at };
  const show = (mode: displayCurrency.DisplayMode, currency: domain.Currency, budgets: domain.MonthlyBudget[] = [arsBudget]) => routeHarness('(tabs)/index.tsx', {}, data, { budgets },
    displayStore({ [displayCurrency.DISPLAY_MODE_KEY]: mode, [displayCurrency.DISPLAY_CURRENCY_KEY]: currency }), { book: consolidatedRates() });
  const view = show('consolidated', 'USD');
  const root = view.render();
  assert.equal(find(root, 'DisplayCurrencyButton').props.currency, 'USD');
  const row = find(root, 'BudgetAttentionRow');
  assert.equal(JSON.stringify([row.props.currency, row.props.labelsCurrency, row.props.attention.state]), JSON.stringify(['ARS', true, 'warning']), 'the ARS budget, named, beside a USD total');
  // Measured on the real ARS ledger: the ARS expense alone, in ARS minor units; the USD expense neither added nor converted.
  assert.equal(row.props.attention.progress.spentMinor, 9000);
  assert.equal(row.props.attention.progress.spentMinor, domain.summarizeMonthlyBudgets(data, [arsBudget], 'ARS', '2026-09').total!.spentMinor);
  assert.equal(JSON.stringify([row.props.attention.progress.budget.currency, row.props.attention.progress.budget.amountMinor, row.props.attention.progress.remainingMinor]), JSON.stringify(['ARS', 10000, 1000]));
  row.props.onPress();
  assert.equal(JSON.stringify(view.pushed.at(-1)), JSON.stringify({ pathname: '/budgets', params: { currency: 'ARS', month: '2026-09' } }), 'Presupuestos opens on the budget\'s currency, not the display\'s');
  // «Solo USD» with only an ARS budget: no row. «Solo ARS»: the row, nothing to name.
  assert.equal(budgetRows(show('single', 'USD').render()).length, 0, 'single mode shows the shown currency\'s budget only');
  const pesos = find(show('single', 'ARS').render(), 'BudgetAttentionRow');
  assert.equal(JSON.stringify([pesos.props.currency, pesos.props.labelsCurrency, pesos.props.attention.progress.spentMinor]), JSON.stringify(['ARS', false, 9000]));
  // Consolidated in ARS: the display currency's own budget, unnamed.
  const inPesos = find(show('consolidated', 'ARS').render(), 'BudgetAttentionRow');
  assert.equal(JSON.stringify([inPesos.props.currency, inPesos.props.labelsCurrency]), JSON.stringify(['ARS', false]));
  // A USD general budget too (USD 7,00 of 8,00, 87.5 %). 24UX6C2 showed the display currency's alone; since the 24UX6D
  // refinement both are rows and the higher ratio comes first (ARS 90 %, named), the display currency only breaking ties.
  const usdBudget: domain.MonthlyBudget = { ...arsBudget, id: 'b-usd', currency: 'USD', amountMinor: 800 };
  const dollars = budgetRows(show('consolidated', 'USD', [arsBudget, usdBudget]).render());
  assert.equal(JSON.stringify(dollars.map(row => [row.props.currency, row.props.labelsCurrency, row.props.attention.progress.spentMinor])), JSON.stringify([['ARS', true, 9000], ['USD', false, 700]]));
});

test('24UX6C2 review (its «only general budgets» and «one row, never two» superseded by the 24UX6D refinement): a calm sublimit or a calm general budget never hides another currency\'s budget that needs attention', () => {
  const at = '2026-09-01T12:00:00.000Z';
  const data: domain.LedgerSnapshot = { accounts: [{ id: 'a', name: 'Pesos', currency: 'ARS', openingMinor: 100000, createdAt: at }, { id: 'u', name: 'Dólares', currency: 'USD', openingMinor: 10000, createdAt: at }],
    entries: [{ id: 'ars', accountId: 'a', kind: 'expense', amountMinor: 9000, merchant: 'Coto', category: 'Comida', dateISO: '2026-09-05', createdAt: at },
      { id: 'usd', accountId: 'u', kind: 'expense', amountMinor: 1200, merchant: 'App', category: 'Suscripciones', dateISO: '2026-09-11', createdAt: at }] };
  const budget = (id: string, currency: domain.Currency, amountMinor: number, category?: string): domain.MonthlyBudget => category
    ? { id, scope: 'category', category, currency, monthISO: '2026-09', amountMinor, active: true, createdAt: at, revision: 0, updatedAt: at }
    : { id, scope: 'total', currency, monthISO: '2026-09', amountMinor, active: true, createdAt: at, revision: 0, updatedAt: at };
  const usdOver = budget('b-usd', 'USD', 1000); // USD 12,00 of 10,00: 120 %
  const show = (mode: displayCurrency.DisplayMode, currency: domain.Currency, budgets: domain.MonthlyBudget[]) => routeHarness('(tabs)/index.tsx', {}, data, { budgets },
    displayStore({ [displayCurrency.DISPLAY_MODE_KEY]: mode, [displayCurrency.DISPLAY_CURRENCY_KEY]: currency }), { book: consolidatedRates() });
  const summary = (row: Node) => JSON.stringify([row.props.currency, row.props.labelsCurrency, row.props.attention.state, row.props.attention.progress.budget.id]);
  // An ARS category sublimit alone does not make ARS the candidate: the exceeded USD general budget is the row, named.
  const viaCategory = show('consolidated', 'ARS', [budget('c-ars', 'ARS', 100000, 'Comida'), usdOver]);
  const row = find(viaCategory.render(), 'BudgetAttentionRow');
  assert.equal(summary(row), JSON.stringify(['USD', true, 'exceeded', 'b-usd']));
  assert.equal(row.props.attention.progress.spentMinor, 1200, 'the USD ledger alone, unconverted');
  row.props.onPress();
  assert.equal(JSON.stringify(viaCategory.pushed.at(-1)), JSON.stringify({ pathname: '/budgets', params: { currency: 'USD', month: '2026-09' } }));
  // A calm ARS general budget (9,00 of 1000,00) does not hide it either.
  assert.equal(summary(find(show('consolidated', 'ARS', [budget('b-ars', 'ARS', 100000), usdOver]).render(), 'BudgetAttentionRow')), JSON.stringify(['USD', true, 'exceeded', 'b-usd']));
  // When both need attention (24UX6D refinement): two rows, the exceeded USD one first, then the ARS warning, unnamed.
  const both = show('consolidated', 'ARS', [budget('b-ars', 'ARS', 10000), usdOver]).render();
  assert.equal(budgetRows(both).length, 2);
  assert.equal(JSON.stringify(budgetRows(both).map(summary)), JSON.stringify([summary(row), JSON.stringify(['ARS', false, 'warning', 'b-ars'])]));
  // «Solo ARS» considers ARS only: a calm ARS budget and an exceeded USD one draw nothing.
  assert.equal(budgetRows(show('single', 'ARS', [budget('b-ars', 'ARS', 100000), usdOver]).render()).length, 0);
  // Every general budget calm: nothing.
  assert.equal(budgetRows(show('consolidated', 'ARS', [budget('b-ars', 'ARS', 100000), budget('b-usd', 'USD', 100000)]).render()).length, 0);
});

test('24UX6C2: the hero numbers are the same with or without the budget row, in Gastado and Disponible, single or consolidated', () => {
  const { data: pesos, total } = budgetHome();
  const cases: { label: string; data: domain.LedgerSnapshot; mode: displayCurrency.DisplayMode; currency: domain.Currency; budgets: domain.MonthlyBudget[] }[] = [
    { label: 'single ARS, warning', data: pesos, mode: 'single', currency: 'ARS', budgets: [total(10000)] },
    { label: 'single ARS, exceeded', data: pesos, mode: 'single', currency: 'ARS', budgets: [total(100)] },
    { label: 'consolidated USD, ARS exceeded', data: homeData, mode: 'consolidated', currency: 'USD', budgets: [total(100)] },
  ];
  for (const item of cases) {
    const figures = (budgets: domain.MonthlyBudget[]) => {
      const harness = routeHarness('(tabs)/index.tsx', {}, item.data, { budgets }, displayStore({ [displayCurrency.DISPLAY_MODE_KEY]: item.mode, [displayCurrency.DISPLAY_CURRENCY_KEY]: item.currency }), { book: consolidatedRates() });
      let root = harness.render();
      const rows = budgetRows(root).length;
      const spent = find(root, 'Money').props;
      metricOf(root).props.onChange('available');
      root = harness.render();
      const available = find(root, 'Money').props;
      assert.equal(budgetRows(root).length, rows, item.label + ': the row does not depend on the metric');
      return { rows, numbers: JSON.stringify([spent.minor, spent.currency, available.minor, available.currency]) };
    };
    const without = figures([]), withBudget = figures(item.budgets);
    assert.equal(without.rows, 0);
    assert.equal(withBudget.rows, 1, item.label + ': the row is shown');
    assert.equal(withBudget.numbers, without.numbers, item.label + ': Gastado and Disponible unchanged');
  }
});

test('24UX6C2: the budget row opens Presupuestos on the current month, whatever month the budget was created in', () => {
  const at = '2026-09-20T12:00:00.000Z';
  const data: domain.LedgerSnapshot = { accounts: [{ id: 'a', name: 'Banco', currency: 'ARS', openingMinor: 0, createdAt: at }],
    entries: [{ id: 'oct', accountId: 'a', kind: 'expense', amountMinor: 900, merchant: 'Coto', category: 'Supermercado', dateISO: '2026-10-01', createdAt: '2026-10-01T10:00:00.000Z' },
      { id: 'sep', accountId: 'a', kind: 'expense', amountMinor: 5000, merchant: 'Coto', category: 'Supermercado', dateISO: '2026-09-20', createdAt: at }] };
  const budget = (monthISO: string): domain.MonthlyBudget => ({ id: 'b-' + monthISO, scope: 'total', currency: 'ARS', monthISO, amountMinor: 1000, active: true, createdAt: at, revision: 0, updatedAt: at });
  today = '2026-10-01';
  try {
    assert.equal(budgetRows(routeHarness('(tabs)/index.tsx', {}, data, { budgets: [budget('2026-09')] }).render()).length, 0, 'September\'s exceeded budget is not this month\'s');
    const view = routeHarness('(tabs)/index.tsx', {}, data, { budgets: [budget('2026-09'), budget('2026-10')] });
    const row = find(view.render(), 'BudgetAttentionRow');
    assert.equal(JSON.stringify([row.props.attention.state, row.props.attention.progress.spentMinor, row.props.attention.progress.budget.monthISO]), JSON.stringify(['warning', 900, '2026-10']),
      'October\'s budget reads October\'s expenses only');
    row.props.onPress();
    assert.equal(JSON.stringify(view.pushed.at(-1)), JSON.stringify({ pathname: '/budgets', params: { currency: 'ARS', month: '2026-10' } }));
  } finally { today = '2026-09-12'; }
});

// 24UX6D pinned «the same four props, the same homeBudget choice»; the 24UX6D refinement supersedes it: five props (the
// grouped surface's `last`), and the rows are exactly `homeBudgets`' choice, in its order.
test('24UX6D, as refined: Inicio hands each budget row five props (attention, currency, labelsCurrency, last, onPress), exactly homeBudgets\' choice and the domain\'s progress', () => {
  // [state, currency, labelsCurrency, spent, remaining, ratio, budget id] per row.
  const { data, total, category } = budgetHome();
  const cases: [string, domain.MonthlyBudget[], unknown[][]][] = [
    ['calm (84 %)', [total(10120)], []],
    ['exactly 85 %', [total(10000)], [['warning', 'ARS', false, 8500, 1500, 0.85, 'total-ARS-2026-09']]],
    ['exactly 100 %', [total(8500)], [['warning', 'ARS', false, 8500, 0, 1, 'total-ARS-2026-09']]],
    ['one minor unit over', [total(8499)], [['exceeded', 'ARS', false, 8500, -1, 8500 / 8499, 'total-ARS-2026-09']]],
    ['a category over its limit only (no row in 24UX6C2)', [category('Supermercado', 1000)], [['exceeded', 'ARS', false, 6000, -5000, 6, 'cat-Supermercado']]],
    ['a general warning and an exceeded category', [total(9000), category('Supermercado', 5000)],
      [['exceeded', 'ARS', false, 6000, -1000, 1.2, 'cat-Supermercado'], ['warning', 'ARS', false, 8500, 500, 8500 / 9000, 'total-ARS-2026-09']]],
  ];
  for (const [label, budgets, expected] of cases) {
    const view = routeHarness('(tabs)/index.tsx', {}, data, { budgets });
    const rows = budgetRows(view.render());
    const chosen = homeFocus.homeBudgets(data, budgets, ['ARS'], 'single', 'ARS', '2026-09');
    assert.equal(rows.length, expected.length, label);
    assert.equal(chosen.length, expected.length, label);
    rows.forEach((row, index) => {
      assert.equal(Object.keys(row.props).sort().join(), 'attention,currency,labelsCurrency,last,onPress', label + ': the row derives its look itself; `last` draws the separator');
      assert.equal(row.props.last, index === rows.length - 1, label + ': only the last row has no hairline');
      const { progress } = row.props.attention;
      assert.equal(JSON.stringify([row.props.attention.state, row.props.currency, row.props.labelsCurrency, progress.spentMinor, progress.remainingMinor, progress.ratio, progress.budget.id]),
        JSON.stringify(expected[index]), label);
      assert.equal(JSON.stringify(row.props.attention), JSON.stringify(chosen[index]), label + ': exactly homeBudgets\' choice (the route hands the whole HomeBudget as `attention`)');
      assert.equal(JSON.stringify([row.props.currency, row.props.labelsCurrency]), JSON.stringify([chosen[index].currency, chosen[index].labelsCurrency]), label);
      row.props.onPress();
      assert.equal(JSON.stringify(view.pushed.at(-1)), JSON.stringify({ pathname: '/budgets', params: { currency: 'ARS', month: '2026-09' } }), label);
    });
  }
  // The call site: one grouped surface mapping homeBudgets' rows, each with its own currency, `last` and Presupuestos link.
  const route = readFileSync(new URL('../app/(tabs)/index.tsx', import.meta.url), 'utf8');
  assert.match(route, /<Surface grouped>\{budgets\.map\(\(budget, index\) => <BudgetAttentionRow key=\{[^}]+\} attention=\{budget\}\s+currency=\{budget\.currency\} labelsCurrency=\{budget\.labelsCurrency\} last=\{index === budgets\.length - 1\}\s+onPress=\{\(\) => router\.push\(\{ pathname: '\/budgets', params: \{ currency: budget\.currency, month \} \}\)\} \/>\)\}<\/Surface>/);
});

test('24UX6D refinement: two budget rows share ONE grouped surface (the first with a hairline, the last without), after the field and before «Próximos compromisos» and «Actividad reciente»', () => {
  const { data, total, category } = budgetHome();
  // General 8500 of 9000 (94 %, warning); Supermercado 6000 of 5000 (120 %, exceeded); Ocio 2500 of 2600 (96 %, warning, third: left out).
  const view = routeHarness('(tabs)/index.tsx', {}, data, { budgets: [total(9000), category('Supermercado', 5000), category('Ocio', 2600)], recurring: [dueRule()] });
  const root = view.render();
  const rows = budgetRows(root);
  assert.equal(rows.map(row => row.props.attention.state + ':' + row.props.attention.progress.budget.id).join(), 'exceeded:cat-Supermercado,warning:total-ARS-2026-09', 'two rows at most');
  const surfaces = nodes(root).filter(n => n.type === 'Surface' && rows.some(row => nodes(n).includes(row)));
  assert.equal(surfaces.length, 1, 'one surface holds both rows');
  const [surface] = surfaces;
  assert.equal(surface.props.grouped, true);
  const children = [surface.props.children].flat(2).filter(Boolean) as Node[];
  assert.equal(JSON.stringify(children.map(child => child.type)), JSON.stringify(['BudgetAttentionRow', 'BudgetAttentionRow']), 'the two rows and nothing else');
  assert.equal(JSON.stringify(children.map(child => child.props.last)), JSON.stringify([false, true]), 'a hairline between them, none under the last');
  assert.equal(new Set(children.map(child => child.key)).size, 2, 'each row keyed apart');
  assert.equal(nodes(root).filter(n => n.type === 'Surface').length, 3, 'the budgets, the commitments and the activity');
  assert.equal(nodes(fieldOf(root)).includes(surface), false, 'outside the financial field');
  const all = nodes(root);
  const position = (node: Node | undefined) => { assert.ok(node); return all.indexOf(node); };
  const titled = (title: string) => all.find(n => n.type === 'SectionTitle' && n.props.children === title);
  const order = [fieldOf(root), surface, titled('Próximos compromisos'), titled('Actividad reciente')].map(position);
  assert.equal(order.every((index, i) => i === 0 || index > order[i - 1]), true, 'field < budgets < commitments < activity: ' + order.join());
  assert.equal(nodes(fieldOf(root)).length + position(fieldOf(root)) <= position(surface), true, 'after the whole field');
  assert.equal(sectionTitles(root).join('|'), 'Próximos compromisos|Actividad reciente', 'the budgets have no section title');
  // One row alone is still `last` (no hairline under a single row).
  const single = budgetRows(routeHarness('(tabs)/index.tsx', {}, data, { budgets: [total(9000)] }).render());
  assert.equal(JSON.stringify(single.map(row => row.props.last)), JSON.stringify([true]));
});

test('24UX6D refinement: each budget row opens Presupuestos on its own currency and the month, a USD category budget too while Inicio shows ARS consolidated', () => {
  const at = '2026-09-01T12:00:00.000Z';
  const data: domain.LedgerSnapshot = { accounts: [{ id: 'a', name: 'Pesos', currency: 'ARS', openingMinor: 100000, createdAt: at }, { id: 'u', name: 'Dólares', currency: 'USD', openingMinor: 10000, createdAt: at }],
    entries: [{ id: 'ars', accountId: 'a', kind: 'expense', amountMinor: 9000, merchant: 'Coto', category: 'Supermercado', dateISO: '2026-09-05', createdAt: at },
      { id: 'usd', accountId: 'u', kind: 'expense', amountMinor: 700, merchant: 'App', category: 'Suscripciones', dateISO: '2026-09-11', createdAt: at }] };
  const arsTotal: domain.MonthlyBudget = { id: 'b-ars', scope: 'total', currency: 'ARS', monthISO: '2026-09', amountMinor: 10000, active: true, createdAt: at, revision: 0, updatedAt: at };
  const usdCategory: domain.MonthlyBudget = { id: 'c-usd', scope: 'category', category: 'Suscripciones', currency: 'USD', monthISO: '2026-09', amountMinor: 600, active: true, createdAt: at, revision: 0, updatedAt: at };
  const view = routeHarness('(tabs)/index.tsx', {}, data, { budgets: [arsTotal, usdCategory] },
    displayStore({ [displayCurrency.DISPLAY_MODE_KEY]: 'consolidated', [displayCurrency.DISPLAY_CURRENCY_KEY]: 'ARS' }), { book: consolidatedRates() });
  const rows = budgetRows(view.render());
  // USD 7,00 of 6,00 (117 %, exceeded) first, named; then ARS 90,00 of 100,00 (90 %, warning), unnamed.
  assert.equal(JSON.stringify(rows.map(row => [row.props.attention.progress.budget.id, row.props.attention.progress.budget.scope, row.props.currency, row.props.labelsCurrency, row.props.attention.state,
    row.props.attention.progress.spentMinor])), JSON.stringify([['c-usd', 'category', 'USD', true, 'exceeded', 700], ['b-ars', 'total', 'ARS', false, 'warning', 9000]]));
  assert.equal(rows[0].props.attention.progress.budget, usdCategory, 'the category row carries the category budget itself');
  assert.equal(rows[0].props.attention.progress.spentMinor, domain.summarizeMonthlyBudgets(data, [arsTotal, usdCategory], 'USD', '2026-09').rows[0].spentMinor, 'the USD ledger alone, unconverted');
  rows[0].props.onPress();
  assert.equal(JSON.stringify(view.pushed.at(-1)), JSON.stringify({ pathname: '/budgets', params: { currency: 'USD', month: '2026-09' } }), 'the USD row opens USD');
  rows[1].props.onPress();
  assert.equal(JSON.stringify(view.pushed.at(-1)), JSON.stringify({ pathname: '/budgets', params: { currency: 'ARS', month: '2026-09' } }), 'the ARS row opens ARS');
  assert.equal(view.pushed.length, 2);
  assert.equal(view.navigated.length, 0, 'pushed, never a tab switch');
});

// Producto 24T3 (A24): a devolución is a negative expense line projected from a purchase operation; it nets in its month.
test('24T3 (A24): Gastado below zero keeps the exact net and gets one quiet line, outside the number\'s block; never in Disponible or a month above zero', () => {
  const account = snapshot.accounts[0];
  const august: domain.Entry = { id: 'aug', accountId: 'a', kind: 'expense', amountMinor: 1000, merchant: 'Tienda', category: 'Ropa', dateISO: '2026-08-20', createdAt };
  const september: domain.Entry = { id: 'sep', accountId: 'a', kind: 'expense', amountMinor: 100, merchant: 'Almacén', category: 'Comida', dateISO: '2026-09-03', createdAt };
  const refund: domain.EntryRefund = { id: 'dev-1', kind: 'refund', target: { entryId: 'aug' }, accountId: 'a', currency: 'ARS', amountMinor: 600, dateISO: '2026-09-05',
    voided: false, createdAt, revision: 0, updatedAt: createdAt };
  const data = domain.snapshotFromArchive({ accounts: [account], records: [august, september].map(domain.initialRecord), purchaseOperations: [refund] });
  const caption = 'Las devoluciones superan lo gastado';
  const view = routeHarness('(tabs)/index.tsx', {}, data);
  let root = view.render();
  assert.equal(find(root, 'Money').props.minor, 100 - 600, 'the number is the month\'s exact net, never clamped');
  assert.ok(homeTexts(fieldOf(root)).includes(caption), 'one quiet line on the field');
  assert.equal(nodes(find(root, 'ValueTransition')).some(node => node.type === 'AppText'), false, 'outside the number\'s block (24UX6C)');
  assert.equal(nodes(fieldOf(root)).find(node => node.type === 'AppText' && textOf(node) === caption)!.props.style.color, lightPalette.heroSecondary);
  metricOf(root).props.onChange('available');
  root = view.render();
  assert.equal(homeTexts(root).includes(caption), false, 'Disponible is a balance: no such line');
  assert.equal(homeTexts(routeHarness('(tabs)/index.tsx', {}, homeData).render()).includes(caption), false, 'a month above zero: no line');
  locale = 'en-AR';
  try { assert.ok(homeTexts(fieldOf(routeHarness('(tabs)/index.tsx', {}, data).render())).includes('Refunds exceed what was spent')); } finally { locale = 'es-AR'; }
  // The month's spending detail lists both lines (they add up to the header) and counts the devolución apart.
  const detail = routeHarness('spending-detail.tsx', { currency: 'ARS', startISO: '2026-09-01', endISO: '2026-09-12' }, data).render();
  assert.equal(detail.props.entries.length, 2);
  assert.equal(find(detail, 'Money').props.minor, -500);
  assert.ok(homeTexts(detail).includes('1 gasto registrado · 1 devolución'));
});

test('24T3 (A23, verifier): a missing rate lists every currency with lines, also one whose period holds only devoluciones (its subtotal below zero is never dropped)', () => {
  const ars: domain.Account = { id: 'ars', name: 'Pesos', currency: 'ARS', openingMinor: 0, createdAt };
  const usd: domain.Account = { id: 'usd', name: 'Dólares', currency: 'USD', openingMinor: 0, createdAt };
  const pesos: domain.Entry = { id: 'p', accountId: 'ars', kind: 'expense', amountMinor: 1000, merchant: 'Almacén', category: 'Comida', dateISO: '2026-09-03', createdAt };
  const shoes: domain.Entry = { id: 'shoes', accountId: 'usd', kind: 'expense', amountMinor: 8000, merchant: 'Tienda', category: 'Ropa', dateISO: '2026-08-20', createdAt };
  const refund: domain.EntryRefund = { id: 'dev-usd', kind: 'refund', target: { entryId: 'shoes' }, accountId: 'usd', currency: 'USD', amountMinor: 3000, dateISO: '2026-09-05',
    voided: false, createdAt, revision: 0, updatedAt: createdAt };
  const eur: domain.Account = { id: 'eur', name: 'Euros', currency: 'EUR', openingMinor: 0, createdAt };
  const data = domain.snapshotFromArchive({ accounts: [ars, usd, eur], records: [pesos, shoes].map(domain.initialRecord), purchaseOperations: [refund] });
  const period = { startISO: '2026-09-01', endISO: '2026-09-12' };
  const figure = financeView.spendingFigure(data, financeView.financeView(data, 'consolidated', 'ARS', domain.rateBook([])), period, 'offline', true);
  assert.equal(figure.status, 'unavailable');
  assert.deepEqual(figure.status === 'unavailable' && figure.parts, [{ currency: 'ARS', minor: 1000 }, { currency: 'USD', minor: -3000 }],
    'USD has no purchase in September but a devolución of −30,00: its subtotal is shown, not left out; EUR, with no line at all, is still left out (no records is not a zero)');
});

test('25OPS1: Inicio ends its content the dock\'s height above the window\'s bottom, as padding, with no native content inset', () => {
  assert.equal(routeHarness('(tabs)/index.tsx', {}, homeData).render().props.contentContainerStyle.paddingBottom, 48, 'the harness default (no dock): the root\'s own padding');
  dock = { extraPadding: 88, indicator: { bottom: 88.125 } };
  try {
    const root = routeHarness('(tabs)/index.tsx', {}, homeData).render();
    assert.equal(root.type, 'ScrollView');
    assert.equal(root.props.contentContainerStyle.paddingBottom, 48 + 88, 'true scrollable space: the last recent movement rests above the dock');
    assert.equal(root.props.contentContainerStyle.flexGrow, 1);
    assert.equal(root.props.contentInset, undefined, 'nothing the native scroll view could lose');
    assert.equal(root.props.scrollIndicatorInsets, dock.indicator, 'the indicator ends above the dock');
    assert.equal(root.props.contentInsetAdjustmentBehavior, 'never');
  } finally { dock = { extraPadding: 0, indicator: undefined }; }
});
