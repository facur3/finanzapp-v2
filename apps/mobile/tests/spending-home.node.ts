import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
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
/** The safe area of an iPhone with a Dynamic Island, portrait. */
const INSETS = { top: 47, bottom: 34, left: 0, right: 0 };

// Exercise the actual routes' data/handlers with host components replaced by
// descriptors. This is NOT a rendered iOS screen or gesture/animation test.
type Node = { type: string; props: Record<string, any> };
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
  const jsx = (type: string, props: Record<string, unknown>) => ({ type, props });
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
  const componentNames = ['AppText', 'Choices', 'DetailRow', 'EmptyState', 'IconButton', 'InfoButton', 'Money', 'PressFeedback', 'SectionTitle', 'Surface', 'CategoryBadge', 'Screen', 'EntryActions', 'EntryRow', 'ActionButton', 'GlyphTile', 'Stat', 'NavigationRow'];
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
    'react-native': { View: 'View', ScrollView: 'ScrollView', FlatList: 'FlatList', StyleSheet: { hairlineWidth: 1, create: <T,>(styles: T) => styles, absoluteFill: {} } },
    'react-native-reanimated': { __esModule: true, default: { View: 'Animated.View' },
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
    '../src/ui/charts': { DonutChart: 'DonutChart', MonthBars: 'MonthBars', OTHERS_KEY: '__others__',
      donutSlices: (items: { key: string; label: string; value: number }[]) => items.slice(0, 5).map((item, index) => ({ ...item, color: 'c' + index })) },
    '../src/ui/budget-presentation': budgetPresentation,
    '@expo/vector-icons/Ionicons': 'Ionicons',
    // 24UX6A: no insight row, no capture module and no quick actions are mapped: Inicio importing one fails loudly here.
    '../src/ui/home-modules': { CurrencyParts: 'CurrencyParts', FieldButton: 'FieldButton', MetricHelp: 'MetricHelp', UpcomingRecurringRow: 'UpcomingRecurringRow' },
    '../src/ui/home-focus': homeFocus,
    '../src/ui/category-color': categoryColor,
    '../src/ui/category-hues': { useCategoryColor: () => '#3E6FB0', useCategoryLabel: (s: string) => s, useCategoryDefinitions: () => [], useCategoryLook: (s: string) => ({ label: s, storedLabel: s, key: String(s).toLowerCase(), hex: '#3E6FB0', glyph: 'pricetag-outline' }), useCategoryLookOf: () => (s: string) => ({ label: s, storedLabel: s, key: String(s).toLowerCase(), hex: '#3E6FB0', glyph: glyphAliases.get(s) ?? 'glyph-' + String(s).toLowerCase() }), useAccountLook: () => ({ icon: 'wallet', color: 'cobalt', glyph: 'wallet-outline', hex: '#2557D6' }), useAccountNameOf: () => (account: any) => account.name, useAccountLookOf: () => () => ({ icon: 'wallet', color: 'cobalt', glyph: 'wallet-outline', hex: '#2557D6' }) },
    '../src/ui/motion': { ValueTransition: 'ValueTransition', Reflow: 'Reflow', selectionHaptic: () => {}, impactHaptic: () => {}, duration: { press: 100, release: 160, state: 200, data: 260, enter: 200, exit: 100, reveal: 480 }, timing: (kind: string, reduced: boolean) => ({ duration: reduced ? 0 : 260 }) },
    '../src/ui/theme': { useCurrentDay: () => '2026-09-12', useReduceMotion: () => false, space: { xs: 4, s: 8, m: 12, l: 16, xl: 20, xxl: 24, xxxl: 32 },
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
const SUBLINE = /por día|Sin gastos este mes|Saldo registrado|a day|No spending this month|Recorded balance/;
const sublineOf = (root: Node) => homeTexts(fieldOf(root)).find(text => SUBLINE.test(text));
const metricOf = (root: Node) => nodes(root).find(n => n.type === 'Choices' && (n.props.value === 'spending' || n.props.value === 'available'))!;
/** A synthetic rule due in this harness week (the harness day is 2026-09-12). */
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

test('24UX6A: the pine field comes first: the month and the accounts, the scope (two currencies), the number, what it covers, Gastado | Disponible; then the sections', () => {
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
  assert.equal(inField.join('|'), 'month|FieldButton|DisplayCurrencyButton|Money|subline|Choices');
  assert.equal(fieldChildren(root).map(n => n.type).join('|'), 'View|View|ValueTransition|Choices', 'row 1, the scope row, the number with its line, the metric');
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

test('24UX6A: with one currency the scope row is absent (no empty row) and the help sits beside the line; with two the chip is on the field with its help', () => {
  const onlyPesos: domain.LedgerSnapshot = { accounts: [homeData.accounts[0]], entries: homeData.entries.filter(entry => entry.accountId === 'a') };
  const single = routeHarness('(tabs)/index.tsx', {}, onlyPesos);
  let root = single.render();
  assert.equal(nodes(root).some(n => n.type === 'DisplayCurrencyButton'), false, 'one currency: nothing to choose');
  assert.equal(fieldChildren(root).map(n => n.type).join('|'), 'View|ValueTransition|Choices', 'no scope row, not even an empty one');
  metricOf(root).props.onChange('available');
  root = single.render();
  assert.equal(fieldChildren(root).map(n => n.type).join('|'), 'View|ValueTransition|Choices');
  const help = find(root, 'MetricHelp');
  assert.deepEqual([help.props.title, help.props.color], ['Disponible', lightPalette.heroSecondary]);
  const sublineRow = nodes(find(root, 'ValueTransition')).find(n => n.type === 'View' && [n.props.children].flat().includes(help));
  assert.ok(sublineRow, 'the help moves into the number\'s block, beside the line');
  assert.ok(nodes(sublineRow).some(n => n.type === 'AppText' && textOf(n) === 'Saldo registrado · 1 cuenta'));

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

test('24UX6A: the line under Gastado is the month so far and Reportes\' daily average, or «Sin gastos este mes»; Disponible never has a per-day figure', () => {
  const es = bindLocale('es-AR');
  const period = domain.spendingWindow('ARS', 'month', '2026-09-12');
  const view = routeHarness('(tabs)/index.tsx', {}, homeData);
  let root = view.render();
  const average = domain.dailyAverageMinor(300, period);
  assert.equal(average, Math.floor(300 / 12), 'twelve days of September so far');
  assert.equal(homeFocus.spendingPerDay({ status: 'ready', minor: 300 }, period), average, 'the screen\'s rule is Reportes\' figure');
  assert.equal(sublineOf(root), `Hasta hoy · ${es.moneyText(average, 'ARS')} por día`);
  // Consolidated: the same rule over the converted total, in the display currency.
  const consolidated = routeHarness('(tabs)/index.tsx', {}, homeData, {}, displayStore({ [displayCurrency.DISPLAY_MODE_KEY]: 'consolidated' }), { book: consolidatedRates() });
  assert.equal(sublineOf(consolidated.render()), `Hasta hoy · ${es.moneyText(domain.dailyAverageMinor(100 + 200 + 2000000, period), 'ARS')} por día`);
  // Nothing spent this month: no «0 por día».
  const quiet = routeHarness('(tabs)/index.tsx', {}, snapshot).render();
  assert.equal(sublineOf(quiet), 'Sin gastos este mes');
  assert.equal(homeTexts(quiet).some(text => /por día/.test(text)), false);
  // Disponible: a balance and how many accounts, never a daily figure, whatever the amount or the mode.
  for (const [label, harness] of [['single', view], ['consolidated', consolidated], ['quiet', routeHarness('(tabs)/index.tsx', {}, snapshot)],
    ['zero balance', routeHarness('(tabs)/index.tsx', {}, { accounts: [{ ...snapshot.accounts[0], openingMinor: 0 }], entries: [] })],
    ['huge balance', routeHarness('(tabs)/index.tsx', {}, { accounts: [{ ...snapshot.accounts[0], openingMinor: 9_999_999_999_999 }], entries: [] })]] as const) {
    metricOf(harness.render()).props.onChange('available');
    const available = harness.render();
    assert.equal(homeTexts(available).some(text => /por día|Hasta hoy|Sin gastos/.test(text)), false, label + ': no per-day figure under Disponible');
    assert.match(sublineOf(available) ?? '', /^Saldo registrado · \d+ cuentas?$/, label);
  }
  metricOf(view.render()).props.onChange('available');
  assert.equal(sublineOf(view.render()), 'Saldo registrado · 1 cuenta', 'single ARS: the one ARS account');
  metricOf(consolidated.render()).props.onChange('available');
  assert.equal(sublineOf(consolidated.render()), 'Saldo registrado · 2 cuentas', 'consolidated: every live account');
  // Without a rate there is no total, so no average of a partial sum either.
  const offline = routeHarness('(tabs)/index.tsx', {}, homeData, {}, displayStore({ [displayCurrency.DISPLAY_MODE_KEY]: 'consolidated', [displayCurrency.DISPLAY_CURRENCY_KEY]: 'EUR' }),
    { book: consolidatedRates(), activity: 'offline' }).render();
  assert.equal(homeTexts(offline).some(text => /por día/.test(text)), false);
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

test('24UX6A: the month\'s latest expenses and incomes, newest first, six alone and four under commitments; transfers stay in Movimientos; «Ver todos» selects Movimientos', () => {
  const at = '2026-09-01T12:00:00.000Z';
  const accounts: domain.Account[] = [{ id: 'a', name: 'Efectivo', currency: 'ARS', openingMinor: 0, createdAt: at }, { id: 'b', name: 'Banco', currency: 'ARS', openingMinor: 100000, createdAt: at },
    { id: 'u', name: 'Dólares', currency: 'USD', openingMinor: 0, createdAt: at }];
  const entry = (id: string, dateISO: string, kind: 'expense' | 'income' = 'expense', accountId = 'a'): domain.Entry =>
    ({ id, accountId, kind, amountMinor: 100, merchant: 'Comercio ' + id, category: kind === 'income' ? 'Sueldo' : 'Comida', dateISO, createdAt: dateISO + 'T10:00:00.000Z' });
  const data: domain.LedgerSnapshot = { accounts, entries: [entry('aug', '2026-08-31'), entry('s1', '2026-09-01'), entry('s2', '2026-09-02', 'income', 'b'), entry('s3', '2026-09-03'),
    entry('s4', '2026-09-05'), entry('s5', '2026-09-07', 'income'), entry('s6', '2026-09-09', 'expense', 'b'), entry('s7', '2026-09-11'), entry('s8', '2026-09-12'), entry('usd', '2026-09-12', 'expense', 'u')],
  transfers: [{ id: 't1', fromAccountId: 'b', toAccountId: 'a', amountMinor: 5000, note: 'Retiro', dateISO: '2026-09-12', createdAt: '2026-09-12T11:00:00.000Z' }] };
  const rows = (root: Node) => nodes(root).filter(n => n.type === 'EntryRow').map(n => n.props.entry.id).join();
  const alone = routeHarness('(tabs)/index.tsx', {}, data);
  let root = alone.render();
  assert.equal(rows(root), 's8,s7,s6,s5,s4,s3', 'ARS shown: six, newest first; August, USD and the transfer stay out');
  assert.equal(nodes(root).filter(n => n.type === 'EntryRow').every(n => n.props.entry.kind === 'expense' || n.props.entry.kind === 'income'), true);
  assert.equal(JSON.stringify(nodes(root).filter(n => n.type === 'EntryRow').map(n => n.props.entry.amountMinor)), JSON.stringify([100, 100, 100, 100, 100, 100]), 'each row keeps its own amount');
  const surface = nodes(root).find(n => n.type === 'Surface' && nodes(n).some(child => child.type === 'EntryRow'))!;
  assert.equal(surface.props.grouped, true, 'a grouped surface');
  assert.equal(nodes(surface).filter(n => n.type === 'EntryRow').at(-1)!.props.last, true);
  assert.equal(nodes(root).find(n => n.type === 'EntryRow')!.props.account.id, 'a', 'each row carries its own account');
  const title = nodes(root).find(n => n.type === 'SectionTitle' && n.props.children === 'Actividad reciente')!;
  assert.equal(title.props.action, 'Ver todos');
  title.props.onAction();
  assert.deepEqual([alone.navigated.at(-1), alone.pushed.length], ['/activity', 0], 'the tab root is selected, never pushed over Inicio');
  // A commitment this week: four rows under it.
  root = routeHarness('(tabs)/index.tsx', {}, data, { recurring: [dueRule()] }).render();
  assert.equal(sectionTitles(root).join('|'), 'Próximos compromisos|Actividad reciente');
  assert.equal(rows(root), 's8,s7,s6,s5');
  // Consolidated: every account, still six, still no transfer.
  root = routeHarness('(tabs)/index.tsx', {}, data, {}, displayStore({ [displayCurrency.DISPLAY_MODE_KEY]: 'consolidated' }), { book: consolidatedRates() }).render();
  assert.equal(rows(root).split(',').length, 6);
  assert.equal(rows(root).split(',').includes('usd'), true);
  assert.equal(/t1/.test(rows(root)), false);
  // A movement of last month alone: no section.
  root = routeHarness('(tabs)/index.tsx', {}, { accounts, entries: [entry('aug', '2026-08-31')] }).render();
  assert.equal(sectionTitles(root).includes('Actividad reciente'), false);
  assert.equal(nodes(root).some(n => n.type === 'EntryRow'), false);
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

test('24UX6A: no Registrar button, insight line, ranking, budget card, chart or Assistant banner on Inicio, in the tree or the source', () => {
  const at = '2026-09-01T12:00:00.000Z';
  // A ledger that once produced each retired module: a concentrated category, an exceeded general budget and sublimit, rules.
  const budgets: domain.MonthlyBudget[] = [{ id: 'total', scope: 'total', currency: 'ARS', monthISO: '2026-09', amountMinor: 100, active: true, createdAt: at, revision: 0, updatedAt: at },
    { id: 'salud', scope: 'category', category: 'Salud', currency: 'ARS', monthISO: '2026-09', amountMinor: 50, active: true, createdAt: at, revision: 0, updatedAt: at }];
  for (const root of [routeHarness('(tabs)/index.tsx', {}, homeData, { budgets, recurring: [dueRule()] }).render(), routeHarness('(tabs)/index.tsx', {}, snapshot).render(),
    routeHarness('(tabs)/index.tsx', {}, { accounts: [], entries: [] }).render()]) {
    assert.equal(nodes(root).filter(n => RETIRED.includes(n.type)).map(n => n.type).join(), '');
    assert.equal(homeTexts(root).some(text => /presupuesto|Registrar|Asistente|concentr/i.test(text) && !/Asistente\.$/.test(text)), false);
    assert.equal(nodes(root).filter(n => n.type === 'Money').length, 1, 'one hero; the rows draw their own amounts');
  }
  const imports = homeSource.match(/^import .*$/gm)!.join('\n');
  for (const gone of ['home-capture', 'capture-hub', 'quick-actions', 'charts', 'spending-chart', 'spending-timeline', 'budget', 'insight', 'assistant', 'Insight', 'Capture', 'QuickActions', 'AssistantEntry'])
    assert.equal(imports.includes(gone), false, 'Inicio does not import ' + gone);
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
test('Home keeps analysis in Reportes: no timeline bars, commitments only with a rule due this week, Disponible without cards', () => {
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
  // 24UX6A: a rule due after this week waits in Recurrentes.
  const later = routeHarness('(tabs)/index.tsx', {}, homeData, { recurring: [{ ...rule, anchorDateISO: '2026-09-19', nextDateISO: '2026-09-19' }] as domain.RecurringRule[] }).render();
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
  assert.equal(sublineOf(cardView.render()), 'Saldo registrado · 1 cuenta', 'the card is not an account of Disponible');
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

test('24UX6A: a budget, calm, nearly spent, exceeded or archived, never reaches Inicio: budgets live in Presupuestos and Reportes', () => {
  const createdAt = '2026-09-01T12:00:00.000Z';
  const total: domain.MonthlyBudget = { id: 'total', scope: 'total', currency: 'ARS', monthISO: '2026-09', amountMinor: 100000, active: true, createdAt, revision: 0, updatedAt: createdAt };
  const sublimit: domain.MonthlyBudget = { id: 'salud', scope: 'category', category: 'Salud', currency: 'ARS', monthISO: '2026-09', amountMinor: 250, active: true, createdAt, revision: 0, updatedAt: createdAt };
  const plain = routeHarness('(tabs)/index.tsx', {}, homeData).render();
  // All September ARS expenses are 300: a general budget of 330 is 91 % used, one of 250 in Salud is 50 over.
  for (const budgets of [[total], [{ ...total, amountMinor: 330 }], [sublimit], [{ ...sublimit, active: false, revision: 1, updatedAt: '2026-09-02T12:00:00.000Z' }]]) {
    const root = routeHarness('(tabs)/index.tsx', {}, homeData, { budgets }).render();
    assert.equal(nodes(root).some(n => RETIRED.includes(n.type)), false);
    assert.equal(find(root, 'Money').props.minor, 300, 'a budget never changes Gastado');
    assert.equal(JSON.stringify(homeTexts(root)), JSON.stringify(homeTexts(plain)), 'nothing on Inicio speaks of the budget');
    assert.equal(sectionTitles(root).join('|'), 'Actividad reciente', 'no budget section');
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
    assert.equal(sublineOf(root), `So far · ${bindLocale('en-AR').moneyText(25, 'ARS')} a day`, 'the same daily average, in English words');
    metric.props.onChange('available');
    const available = view.render();
    const help = find(available, 'MetricHelp');
    assert.equal(help.props.title, 'Available');
    assert.match(help.props.detail, /^The money recorded in your accounts/);
    assert.equal(sublineOf(available), 'Recorded balance · 1 account', 'plural of the account count; no per-day figure');
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
  assert.equal(sublineOf(root), `Hasta hoy · ${bindLocale('es-AR').moneyText(domain.dailyAverageMinor(2200, domain.spendingWindow('JPY', 'month', '2026-09-12')), 'JPY')} por día`, 'the daily average in yen');
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
  assert.equal(find(reports.render(), 'Money').props.currency, 'USD');
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
  assert.equal(find(reports.render(), 'Money').props.currency, 'ARS');
  assert.equal(nodes(reports.render()).some(n => n.type === 'DisplayCurrencyButton'), false, 'one currency: no chip on Reportes either');
});

test('24B6: a link into Reportes with a held currency shows it and makes it the shared choice; an unknown, malformed or unheld one shows the shared choice and never overwrites it', () => {
  const rows = new Map<string, string>([[displayCurrency.DISPLAY_CURRENCY_KEY, 'ARS']]);
  const preferences = () => ({ getItemSync: (key: string) => rows.get(key) ?? null, setItemSync: (key: string, value: string) => { rows.set(key, value); }, removeItemSync: (key: string) => rows.delete(key) });
  const shared = displayCurrency.createDisplayCurrencyStore(preferences);
  const linked = routeHarness('(tabs)/reports.tsx', { currency: 'USD', month: '2026-08' }, homeData, {}, shared);
  assert.equal(find(linked.render(), 'Money').props.currency, 'USD', 'the frame the link arrives already shows its currency');
  assert.equal(shared.getState(), 'USD', 'the explicit currency became the shared choice');
  assert.equal(rows.get(displayCurrency.DISPLAY_CURRENCY_KEY), 'USD');
  const home = routeHarness('(tabs)/index.tsx', {}, homeData, {}, shared);
  assert.equal(find(home.render(), 'DisplayCurrencyButton').props.currency, 'USD', 'Inicio agrees');
  // The switch on the linked screen still wins afterwards: the parameter is applied once, not on every render.
  find(linked.render(), 'DisplayCurrencyButton').props.onCurrency('ARS');
  assert.equal(find(linked.render(), 'Money').props.currency, 'ARS');
  assert.equal(find(linked.render(), 'Money').props.currency, 'ARS', 'a re-render does not re-apply the link');
  assert.equal(shared.getState(), 'ARS');
  for (const currency of ['usd', 'XAU', 'ZZZ', 'EUR', 'KWD', '', ['USD'], 42]) {
    const bad = routeHarness('(tabs)/reports.tsx', { currency, month: '2026-08' }, homeData, {}, shared);
    assert.equal(find(bad.render(), 'Money').props.currency, 'ARS', 'invalid ' + JSON.stringify(currency) + ': the shared choice');
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
  assert.equal(find(root, 'Money').props.currency, 'ARS', 'no euro account: the shared choice shows');
  assert.equal(shared.getState(), 'ARS', 'nothing applied');
  reports.render(); reports.render();
  assert.equal(shared.getState(), 'ARS', 'and nothing applied on later renders either');
  // The person creates the first euro account while Reportes stays mounted (the ledger provider re-renders the tab).
  const euro: domain.Account = { id: 'e', name: 'Euros', currency: 'EUR', openingMinor: 0, createdAt };
  const withEuro: domain.LedgerSnapshot = { ...homeData, accounts: [...homeData.accounts, euro] };
  reports.setData(withEuro);
  root = reports.render();
  assert.equal(find(root, 'Money').props.currency, 'EUR', 'the link is honoured the moment its currency is held');
  assert.equal(shared.getState(), 'EUR', 'and applied to the shared choice');
  assert.equal(rows.get(displayCurrency.DISPLAY_CURRENCY_KEY), 'EUR');
  assert.deepEqual(find(root, 'DisplayCurrencyButton').props.held, ['ARS', 'USD', 'EUR']);
  const home = routeHarness('(tabs)/index.tsx', {}, withEuro, {}, shared);
  assert.equal(find(home.render(), 'DisplayCurrencyButton').props.currency, 'EUR', 'Inicio follows');
  // The switch on Reportes wins from now on, and an unrelated ledger change does not re-impose the link.
  find(reports.render(), 'DisplayCurrencyButton').props.onCurrency('USD');
  assert.equal(find(reports.render(), 'Money').props.currency, 'USD');
  assert.equal(shared.getState(), 'USD');
  const more: domain.LedgerSnapshot = { ...withEuro, accounts: [...withEuro.accounts, { ...euro, id: 'e2', name: 'Más euros' }], entries: [...withEuro.entries, { ...withEuro.entries[0], id: 'e-1', accountId: 'e', amountMinor: 900 }] };
  reports.setData(more);
  assert.equal(find(reports.render(), 'Money').props.currency, 'USD', 'a new euro account and a euro movement do not bring the link back');
  assert.equal(shared.getState(), 'USD');
  // The euro accounts disappear (a restored older copy) and come back: still applied only once.
  reports.setData(homeData);
  assert.equal(find(reports.render(), 'Money').props.currency, 'USD');
  reports.setData(withEuro);
  assert.equal(find(reports.render(), 'Money').props.currency, 'USD', 'the link was already applied: the person\'s later choice stands');
  assert.equal(shared.getState(), 'USD');
  // Inicio, mounted or not, changes the choice and Reportes follows; the link still does not return.
  home.setData(withEuro);
  find(home.render(), 'DisplayCurrencyButton').props.onCurrency('ARS');
  assert.equal(find(reports.render(), 'Money').props.currency, 'ARS');
  const later = routeHarness('(tabs)/reports.tsx', {}, withEuro, {}, shared);
  assert.equal(find(later.render(), 'DisplayCurrencyButton').props.currency, 'ARS', 'a Reportes mounted later reads the same choice');
  // A link that can never be held (a malformed or unknown code) applies nothing, before or after the ledger grows.
  const bad = routeHarness('(tabs)/reports.tsx', { currency: 'ZZZ', month: '2026-08' }, homeData, {}, shared);
  assert.equal(find(bad.render(), 'Money').props.currency, 'ARS');
  bad.setData(more);
  assert.equal(find(bad.render(), 'Money').props.currency, 'ARS');
  assert.equal(shared.getState(), 'ARS');
  // A held link applied at once is not applied again when the ledger changes afterwards.
  const direct = routeHarness('(tabs)/reports.tsx', { currency: 'USD', month: '2026-08' }, withEuro, {}, shared);
  assert.equal(find(direct.render(), 'Money').props.currency, 'USD');
  assert.equal(shared.getState(), 'USD');
  find(direct.render(), 'DisplayCurrencyButton').props.onCurrency('EUR');
  direct.setData(more);
  assert.equal(find(direct.render(), 'Money').props.currency, 'EUR');
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
  assert.deepEqual([find(withIncome, 'Money').props.minor, find(withIncome, 'Money').props.color, sublineOf(withIncome)], [0, lightPalette.heroSecondary, 'Sin gastos este mes']);
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
test('24UX6A review: VoiceOver hears the Gastado line\'s daily average in words; the Disponible line carries no per-day label', () => {
  const es = bindLocale('es-AR');
  const period = domain.spendingWindow('ARS', 'month', '2026-09-12');
  const average = domain.dailyAverageMinor(300, period);
  const view = routeHarness('(tabs)/index.tsx', {}, homeData);
  const sublineNode = (root: Node) => { const node = nodes(fieldOf(root)).find(n => n.type === 'AppText' && SUBLINE.test(textOf(n))); assert.ok(node, 'Missing the subline'); return node; };
  let line = sublineNode(view.render());
  assert.equal(textOf(line), `Hasta hoy · ${es.moneyText(average, 'ARS')} por día`, 'the visible line keeps the region\'s digits');
  assert.equal(line.props.accessibilityLabel, `Hasta hoy · ${es.spokenMoney(average, 'ARS')} por día`, 'the same average, spoken');
  assert.notEqual(line.props.accessibilityLabel, textOf(line), 'never the visible formatter read aloud');
  // Nothing spent this month: no per-day figure, so no spoken twin either.
  const quietLine = sublineNode(routeHarness('(tabs)/index.tsx', {}, snapshot).render());
  assert.deepEqual([textOf(quietLine), quietLine.props.accessibilityLabel], ['Sin gastos este mes', undefined]);
  // Disponible: a balance and how many accounts, read as written.
  metricOf(view.render()).props.onChange('available');
  line = sublineNode(view.render());
  assert.deepEqual([textOf(line), line.props.accessibilityLabel], ['Saldo registrado · 1 cuenta', undefined]);
  // English: the spoken twin follows the language.
  locale = 'en-AR';
  try {
    const english = routeHarness('(tabs)/index.tsx', {}, homeData);
    assert.equal(sublineNode(english.render()).props.accessibilityLabel, `So far · ${bindLocale('en-AR').spokenMoney(average, 'ARS')} a day`);
  } finally { locale = 'es-AR'; }
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
// month and the accounts, the scope, the number, its line, the metric; then what is due, then the month's activity);
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
    .filter(type => ['month', 'FieldButton', 'DisplayCurrencyButton', 'Money', 'subline', 'Choices', 'UpcomingRecurringRow', 'EntryRow'].concat(RETIRED).includes(type) || /^(title|empty):/.test(type))
    .filter((type, index, all) => type !== all[index - 1]);
  // 24C1 / 25B2: the chip is part of the field only while two or more currencies are held.
  const expected = (modules: string[], chip = false) => ['month', 'FieldButton', ...(chip ? ['DisplayCurrencyButton'] : []), 'Money', 'subline', 'Choices', ...modules];

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
  assert.deepEqual(order(root), expected(['title:Próximos compromisos', 'UpcomingRecurringRow', 'title:Actividad reciente', 'EntryRow'], true));
  assert.equal(find(root, 'Money').props.minor, 9_999_999_999_999 + 500 + 300 + 200, 'the huge amount reaches the hero exactly (Money fits it to the width)');
  assert.equal(nodes(root).filter(node => node.type === 'UpcomingRecurringRow').map(node => node.props.rule.id).join(), 'on', 'paused and deleted rules are not upcoming');
  assert.equal(nodes(root).filter(node => node.type === 'EntryRow').length, 4, 'four rows under a commitment (five ARS movements this month)');
  // Switching the currency keeps the same order; what has nothing in USD simply stays out (the rule is an ARS account's).
  find(root, 'DisplayCurrencyButton').props.onCurrency('USD');
  root = view.render();
  assert.deepEqual(order(root), expected(['title:Actividad reciente', 'EntryRow'], true));
  assert.equal(nodes(root).filter(node => node.type === 'EntryRow').map(node => node.props.entry.id).join(), '6');
  // Several rules this week: two at most, soonest first.
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

test('24C1 review: with ARS and EUR budgets in the ledger, Inicio converts the total, never a budget, and shows no budget line in any mode', () => {
  const { data, extra, book } = budgetLedger();
  const display = displayStore({ [displayCurrency.DISPLAY_MODE_KEY]: 'single', [displayCurrency.DISPLAY_CURRENCY_KEY]: 'ARS' });
  const view = routeHarness('(tabs)/index.tsx', {}, data, extra, display, { book });
  let root = view.render();
  const noBudget = () => assert.equal(nodes(root).some(n => RETIRED.includes(n.type)) || homeTexts(root).some(text => /presupuesto/i.test(text)), false);
  assert.equal(find(root, 'Money').props.minor, 300, 'single ARS: the ARS expense alone');
  noBudget();
  // Consolidated, total read in ARS: the number converts the euros (€5 → US$10 → ARS 10.000).
  find(root, 'DisplayCurrencyButton').props.onMode('consolidated');
  root = view.render();
  assert.equal(find(root, 'Money').props.minor, 300 + 1000000, 'the total is every account');
  noBudget();
  // Total read in USD and in EUR: still no budget line, the rows keep their own currencies.
  find(root, 'DisplayCurrencyButton').props.onCurrency('USD');
  root = view.render();
  noBudget();
  assert.equal(nodes(root).filter(n => n.type === 'EntryRow').map(n => n.props.entry.id + ':' + n.props.entry.amountMinor).sort().join(), 'ars:300,eur:500');
  find(root, 'DisplayCurrencyButton').props.onCurrency('EUR');
  root = view.render();
  noBudget();
  // A missing rate hides the consolidated total and still shows no budget.
  root = routeHarness('(tabs)/index.tsx', {}, data, extra, displayStore({ [displayCurrency.DISPLAY_MODE_KEY]: 'consolidated', [displayCurrency.DISPLAY_CURRENCY_KEY]: 'USD' }), { book: domain.rateBook([]), activity: 'offline' }).render();
  assert.equal(nodes(root).some(n => n.type === 'Money'), false);
  noBudget();
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
  assert.equal(sublineOf(root), 'Saldo registrado · 1 cuenta', 'one live account counted');
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
