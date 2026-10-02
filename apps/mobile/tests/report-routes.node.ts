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
import * as liabilityPresentation from '../src/ui/liability-presentation.ts';
import * as i18nFormat from '../src/i18n/format.ts';
import { bindLocale } from '../src/i18n/bind.ts';
import type { AppLocale } from '../src/i18n/locale.ts';

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

/** A key-value store in memory for the shared display currency (24B6); `faults.set` makes every write fail. */
function memoryPreferences(initial: Record<string, string> = {}) {
  // The tests written before 24C1 exercise one currency at a time: `single` unless a test stores another mode.
  const rows = new Map(Object.entries({ [displayCurrency.DISPLAY_MODE_KEY]: 'single', ...initial }));
  const faults = { set: false };
  return { rows, faults, store: () => ({ getItemSync: (key: string) => rows.get(key) ?? null,
    setItemSync: (key: string, value: string) => { if (faults.set) throw new Error('disk full'); rows.set(key, value); }, removeItemSync: (key: string) => rows.delete(key) }) };
}

function routeHarness(file: string, params: Record<string, unknown>, data = snapshot, { locale = 'es-AR' as AppLocale, display = displayCurrency.createDisplayCurrencyStore(memoryPreferences().store),
  book = domain.rateBook([]), activity = 'idle' as ratesStore.RatesActivity, ensured = [] as { months: readonly string[]; quotes: readonly string[] }[],
  archive = {} as Partial<domain.LedgerArchive>, window = { width: 393, height: 852, fontScale: 1, scale: 3 } } = {}) {
  const i18nProvider = { useI18n: () => bindLocale(locale) };
  // The shared display currency, as the provider's hook gives it: the real store and resolution, no React context.
  const displayProvider = { useDisplayCurrency: (held: readonly domain.Currency[]) => ({ currency: displayCurrency.resolveDisplayCurrency(display.getState(), held, display.getMode()),
    preferred: display.getState(), mode: display.getMode(), setCurrency: (currency: domain.Currency) => { display.set(currency); }, setMode: (mode: displayCurrency.DisplayMode) => { display.setMode(mode); } }) };
  // 24C1: the finance view over a fixed rate book (no network); `ensured` records what the screen asked the provider for.
  const ratesProvider = { useFinanceView: (months: readonly string[], currency?: domain.Currency) => {
    const held = presentation.historyCurrencies(data.accounts);
    // 25B2: with one currency in the whole history the view is that currency's own ledger, whatever the preference says (rates-provider.tsx).
    const mode = held.length <= 1 ? 'single' : display.getMode();
    const target = currency ?? (held.length <= 1 ? held[0] ?? displayCurrency.resolveDisplayCurrency(display.getState(), held, mode) : displayCurrency.resolveDisplayCurrency(display.getState(), held, mode));
    const built = financeView.financeView(data, mode, target, book);
    if (built.quotes.length) ensured.push({ months: [...months], quotes: built.quotes });
    return { ...built, activity, loaded: true, lastFetchedAt: null, book, held };
  } };
  const source = readFileSync(new URL('../app/' + file, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const jsx = (type: string, props: Record<string, unknown>) => ({ type, props });
  const state: unknown[] = [];
  const deps: unknown[][] = [];
  const pushed: any[] = [];
  let cursor = 0, effectCursor = 0;
  const componentNames = ['AppText', 'Choices', 'DetailRow', 'EmptyState', 'IconButton', 'Money', 'PressFeedback', 'SectionTitle', 'Surface', 'CategoryBadge', 'Screen', 'GlyphTile', 'InfoButton', 'NavigationRow'];
  const modules: Record<string, unknown> = {
    '../i18n/format': i18nFormat, '../src/i18n/format': i18nFormat, '../../src/i18n/format': i18nFormat, '../i18n/provider': i18nProvider, '../src/i18n/provider': i18nProvider, '../../src/i18n/provider': i18nProvider,
    // Effects run in place, once per change of their dependencies (a route parameter arriving), like React's after commit.
    react: { useMemo: (fn: () => unknown) => fn(), useRef: (initial?: unknown) => {
      // Refs persist by call order, like React's; a test hands the list a fake `scrollToOffset` through `current`.
      const index = cursor++;
      if (!(index in state)) state[index] = { current: initial };
      return state[index];
    }, useState: (initial?: unknown) => {
      const index = cursor++;
      if (!(index in state)) state[index] = initial;
      return [state[index], (value: unknown) => { state[index] = value; }];
    }, useEffect: (fn: () => void, next?: unknown[]) => { const index = effectCursor++; const previous = deps[index];
      if (!previous || !next || next.length !== previous.length || next.some((item, i) => item !== previous[i])) { deps[index] = next ?? []; fn(); } } },
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'react-native': { View: 'View', FlatList: 'FlatList', StyleSheet: { hairlineWidth: 0.5 }, useWindowDimensions: () => window },
    '@expo/vector-icons/Ionicons': 'Ionicons',
    'expo-router': { useLocalSearchParams: () => params, router: { push: (to: unknown) => pushed.push(to) } },
    '../src/ui/display-currency-provider': displayProvider, '../src/ui/display-currency': displayCurrency,
    '../src/fx/rates-provider': ratesProvider, '../src/fx/finance-view': financeView, '../src/fx/fx-copy': fxCopy, '../src/fx/rates-store': ratesStore,
    '../src/ui/home-modules': { CurrencyParts: 'CurrencyParts', MetricHelp: 'MetricHelp' },
    '@finanzapp/domain': domain,
    '../src/storage/LedgerProvider': { useLedger: () => ({ snapshot: data, archive: { accounts: data.accounts, records: [], ...archive } }) },
    '../src/ui/geometry': geometry,
    '../src/ui/charts': { DonutChart: 'DonutChart', MonthBars: 'MonthBars', OTHERS_KEY: ' others', MONEY_MAX_SCALE: 1.8,
      // Like the real one: at most five slices, the tail grouped into one neutral «Otras» slice keyed OTHERS_KEY.
      donutSlices: (items: { key: string; label: string; value: number }[], _p: unknown, _hues: unknown, othersLabel: string) => {
        const head = items.slice(0, items.length > 5 ? 4 : 5).map((item, index) => ({ ...item, color: 'c' + index }));
        const tail = items.slice(head.length);
        return tail.length ? head.concat([{ key: ' others', label: othersLabel, value: tail.reduce((sum, item) => sum + item.value, 0), color: 'grey' }]) : head;
      } },
    '../src/ui/components': Object.fromEntries(componentNames.map(name => [name, name])),
    '../src/ui/currency-switch': { CurrencySwitch: 'CurrencySwitch', DisplayCurrencyButton: 'DisplayCurrencyButton' },
    '../src/ui/entry-list': { EntryList: 'EntryList' },
    '../src/ui/presentation': presentation,
    '../src/ui/budget-presentation': budgetPresentation, '../../src/ui/budget-presentation': budgetPresentation,
    '../src/ui/report-presentation': reportPresentation,
    '../src/ui/spending-chart': { CategorySpendingRow: 'CategorySpendingRow', CategoryLegendRow: 'CategoryLegendRow' },
    '../src/ui/liability-presentation': liabilityPresentation,
    '../src/ui/category-color': categoryColor,
    '../src/ui/category-hues': { useCategoryColor: () => '#3E6FB0', useCategoryLabel: (s: string) => s, useCategoryDefinitions: () => [], useCategoryLook: (s: string) => ({ label: s, storedLabel: s, key: String(s).toLowerCase(), hex: '#3E6FB0', glyph: 'pricetag-outline' }), useCategoryLookOf: () => (s: string) => ({ label: s, storedLabel: s, key: String(s).toLowerCase(), hex: '#3E6FB0', glyph: 'pricetag-outline' }), useAccountLook: () => ({ icon: 'wallet', color: 'cobalt', glyph: 'wallet-outline', hex: '#2557D6' }), useAccountNameOf: () => (account: any) => account.name, useAccountLookOf: () => () => ({ icon: 'wallet', color: 'cobalt', glyph: 'wallet-outline', hex: '#2557D6' }) },
    '../src/ui/quick-actions': { QuickActions: 'QuickActions', AssistantEntry: 'AssistantEntry' },
    '../src/ui/motion': { ValueTransition: 'ValueTransition', Reflow: 'Reflow', selectionHaptic: () => {}, impactHaptic: () => {}, timing: (kind: string, reduced: boolean) => ({ duration: reduced ? 0 : 260 }) },
    '../src/ui/theme': { useCurrentDay: () => '2026-09-12', useReduceMotion: () => false, space: { xs: 4, s: 8, m: 12, l: 16, xl: 20, xxl: 24, xxxl: 32 },
      usePalette: () => ({ background: '#F5F6F8', surface: '#FFFFFF', primary: '#2557D6', primaryFill: '#2557D6', onPrimary: '#fff', text: '#000', secondary: '#666', tertiary: '#999', line: '#ddd', inset: '#eee', expense: '#c00', warning: '#a60', isDark: false }) },
  };
  // Tab routes live one level deeper than stack routes.
  for (const name of Object.keys(modules)) if (name.startsWith('../src/')) modules['../' + name] = modules[name];
  const module = { exports: {} as { default?: () => Node } };
  runInNewContext(code, { module, exports: module.exports, require: (name: string) => {
    if (!Object.hasOwn(modules, name)) throw new Error('Unexpected report dependency: ' + name);
    return modules[name];
  } });
  return { render: () => { cursor = 0; effectCursor = 0; return module.exports.default!(); }, pushed, display, ensured };
}

function nodes(value: any): Node[] {
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!value.props) return [];
  return [value, ...nodes(value.props.children), ...nodes(value.props.ListHeaderComponent),
    ...nodes(value.props.ListEmptyComponent), ...nodes(value.props.ListFooterComponent), ...nodes(value.props.header)];
}
function find(root: Node, type: string, label?: string) {
  const node = nodes(root).find(item => item.type === type && (!label || item.props.label === label || item.props.accessibilityLabel === label));
  assert.ok(node, 'Missing ' + type + ' ' + (label ?? ''));
  return node;
}
/** 24UX6D: the period total Reportes shows. There is no KPI above the analysis any more: in Categorías the total is the
 * donut's `total` (its centre, the report's own figure), in Día a día the compact line's Money. */
function shownTotal(root: Node): { minor: number; currency: string } {
  const donut = nodes(root).find(item => item.type === 'DonutChart');
  if (donut) return { minor: donut.props.total, currency: donut.props.currency };
  const money = find(root, 'Money');
  return { minor: money.props.minor, currency: money.props.currency };
}

test('report row pushes a scoped category detail; underlying period and currency stay selected', () => {
  const view = routeHarness('(tabs)/reports.tsx', { currency: 'ARS', month: '2026-08' });
  const list = view.render();
  const category = list.props.data.find((item: domain.CategorySpending) => item.key === 'salud');
  const row = list.props.renderItem({ item: category, index: 0 });
  assert.equal(find(row, 'CategoryLegendRow').props.category.key, 'salud', 'the legend row carries its category; the tile owns the hue');
  find(row, 'CategoryLegendRow').props.onPress();
  assert.equal(view.pushed[0].pathname, '/report-category');
  assert.equal(JSON.stringify(view.pushed[0].params), JSON.stringify({ currency: 'ARS', month: '2026-08', category: 'salud' }));
  const detail = routeHarness('report-category.tsx', view.pushed[0].params).render();
  assert.equal(detail.type, 'EntryList');
  assert.deepEqual(detail.props.entries.map((e: domain.Entry) => e.id), ['a', 'b']);
  assert.equal(find(detail, 'Money').props.minor, category.amountMinor);
  assert.equal(find(view.render(), 'DisplayCurrencyButton').props.currency, 'ARS');
  assert.equal(shownTotal(view.render()).minor, 606);
});
test('return-to-current-month works even when opened with a historical route parameter', () => {
  const view = routeHarness('(tabs)/reports.tsx', { month: '2026-08', currency: 'ARS' });
  find(view.render(), 'PressFeedback', 'Volver al mes actual').props.onPress();
  const current = view.render();
  assert.equal(find(current, 'IconButton', 'Mes siguiente').props.disabled, true);
  // September has no spending: no donut (24UX6D: its total lived in the KPI, now gone), the empty card says so.
  assert.equal(nodes(current).some(n => n.type === 'DonutChart' || n.type === 'Money'), false);
  assert.equal(current.props.ListEmptyComponent.props.title, 'Sin gastos en este período');
});
test('month and currency controls update report data and enforce the available bounds', () => {
  const view = routeHarness('(tabs)/reports.tsx', {});
  find(view.render(), 'IconButton', 'Mes anterior').props.onPress();
  let report = view.render();
  assert.equal(shownTotal(report).minor, 606);
  assert.equal(find(report, 'IconButton', 'Mes anterior').props.disabled, true);
  find(report, 'DisplayCurrencyButton').props.onCurrency('USD');
  report = view.render();
  assert.equal(shownTotal(report).currency, 'USD');
  assert.equal(shownTotal(report).minor, 999);
  find(report, 'IconButton', 'Mes siguiente').props.onPress();
  assert.equal(find(view.render(), 'IconButton', 'Mes siguiente').props.disabled, true);
});
test('empty and overflow reports do not render a fake or partial category list', () => {
  const empty = routeHarness('(tabs)/reports.tsx', {}).render();
  assert.equal(empty.props.data.length, 0);
  assert.equal(find(empty, 'EmptyState').props.title, 'Sin gastos en este período');
  const huge = { ...snapshot, entries: snapshot.entries.slice(0, 2).map(e => ({ ...e, amountMinor: Number.MAX_SAFE_INTEGER })) };
  const overflow = routeHarness('(tabs)/reports.tsx', { month: '2026-08' }, huge).render();
  assert.equal(overflow.props.data.length, 0);
  assert.equal(nodes(overflow).some(n => n.type === 'Money'), false);
});
test('an unknown/malformed category cannot show every expense by accident', () => {
  for (const category of [undefined, ['salud'], 'missing', 'sal']) {
    const detail = routeHarness('report-category.tsx', { month: '2026-08', category }).render();
    assert.equal(detail.type, 'Screen');
    assert.equal(find(detail, 'EmptyState').props.title, 'No hay gastos de esta categoría');
  }
});

test('daily view opens only expenses in the selected date and currency', () => {
  const view = routeHarness('(tabs)/reports.tsx', { currency: 'ARS', month: '2026-08' });
  nodes(view.render()).find(n => n.type === 'Choices' && n.props.value === 'categories')!.props.onChange('days');
  const list = view.render();
  assert.equal(list.props.data.length, 2);
  const row = list.props.renderItem({ item: list.props.data[1], index: 1 });
  find(row, 'DetailRow').props.onPress();
  const detail = routeHarness('report-day.tsx', view.pushed[0].params).render();
  assert.deepEqual(detail.props.entries.map((e: domain.Entry) => e.id).sort(), ['b', 'c']);
  assert.equal(find(detail, 'Money').props.minor, 505);
});
test('day and comparison cutoff reject malformed or future scope', () => {
  for (const date of [['2026-08-10'], '2026-02-30', '2026-09-13', undefined]) {
    assert.equal(find(routeHarness('report-day.tsx', { currency: 'ARS', date }).render(), 'EmptyState').props.title, 'Día no válido');
  }
  for (const through of [['2026-08-12'], '2026-09-12', 'bad']) {
    assert.equal(find(routeHarness('report-category.tsx', { currency: 'ARS', month: '2026-08', category: 'salud', through }).render(), 'EmptyState').props.title, 'Período no válido');
  }
});
test('comparison category drilldown preserves the cutoff, not the whole previous month', () => {
  const data = { ...snapshot, entries: [...snapshot.entries, { ...snapshot.entries[0], id: 'now', dateISO: '2026-09-10', amountMinor: 400 }] };
  const view = routeHarness('report-comparison.tsx', { currency: 'ARS', month: '2026-09' }, data);
  const list = view.render();
  const category = list.props.data.find((item: domain.CategoryChange) => item.key === 'salud');
  const row = list.props.renderItem({ item: category });
  find(row, 'DetailRow', 'Anterior').props.onPress();
  assert.equal(view.pushed[0].params.through, '2026-08-12');
  const detail = routeHarness('report-category.tsx', view.pushed[0].params, data).render();
  assert.deepEqual(detail.props.entries.map((e: domain.Entry) => e.id), ['b']);
  assert.equal(find(detail, 'Money').props.minor, 202);
});
test('comparison never presents an invented change when history is absent', () => {
  const list = routeHarness('report-comparison.tsx', { currency: 'ARS', month: '2026-09' }).render();
  assert.equal(list.props.data.length, 0);
  assert.equal(nodes(list).some(n => n.type === 'Money'), false);
  assert.equal(find(list, 'EmptyState').props.title, 'Todavía no hay suficiente información');
});

test('reports show a six-month trend that selects months, a donut for categories and factual footers', () => {
  const data = { ...snapshot, entries: [...snapshot.entries, { ...snapshot.entries[0], id: 'now', dateISO: '2026-09-10', amountMinor: 400 },
    { ...snapshot.entries[0], id: 'july', dateISO: '2026-07-20', amountMinor: 50 }] };
  const view = routeHarness('(tabs)/reports.tsx', { currency: 'ARS' }, data);
  let root = view.render();
  const scrolls: unknown[] = [];
  root.props.ref.current = { scrollToOffset: (options: unknown) => scrolls.push(options) };
  const bars = find(root, 'MonthBars');
  assert.deepEqual(bars.props.points.map((point: { monthISO: string; amountMinor: number }) => [point.monthISO, point.amountMinor]).slice(-2), [['2026-08', 606], ['2026-09', 400]]);
  assert.equal(bars.props.selected, '2026-09');
  // 24UX6D (supersedes 24UX6C2's «the KPI owns the total»): the donut's centre carries the period's total, the report's own figure.
  assert.equal(find(root, 'DonutChart').props.total, 400, 'the month\'s total is the donut\'s centre');
  assert.equal(nodes(root.props.ListHeaderComponent).some(n => n.type === 'Money'), false, 'no KPI amount above the analysis');
  assert.equal(find(root, 'DonutChart').props.caption, 'Gasto por categoría');
  assert.equal(find(root, 'DonutChart').props.chosen, null, 'no category is chosen until one is tapped');
  assert.equal(find(root, 'DonutChart').props.slices[0].key, 'salud');
  bars.props.onSelect('2026-08');
  assert.equal(JSON.stringify(scrolls), JSON.stringify([{ offset: 0, animated: true }]), '24UX6B: the bars sit under the analysis, so opening a month brings its title and total into view');
  root = view.render();
  assert.equal(shownTotal(root).minor, 606);
  assert.equal(find(root, 'MonthBars').props.selected, '2026-08');
  assert.equal(nodes(root).some(node => node.type === 'DetailRow' && node.props.label === 'Flujo neto'), true);
  // History keeps the trend visible for an empty current month; no history at all shows neither chart.
  assert.equal(nodes(routeHarness('(tabs)/reports.tsx', {}).render()).some(node => node.type === 'DonutChart'), false);
  const empty = routeHarness('(tabs)/reports.tsx', {}, { ...snapshot, entries: [] }).render();
  assert.equal(nodes(empty).some(node => node.type === 'DonutChart' || node.type === 'MonthBars'), false);
});

function texts(root: any): string[] {
  return nodes(root).flatMap(node => [node.props.label, node.props.title, node.props.detail, node.props.accessibilityLabel, node.props.caption,
    ...[node.props.children].flat().filter(child => typeof child === 'string' || typeof child === 'number')]).filter(value => value !== undefined).map(String);
}

test('Spanish insights rebuilt by the screen read exactly as the domain states them', () => {
  const view = routeHarness('(tabs)/reports.tsx', { currency: 'ARS', month: '2026-08' });
  const money = (minor: number) => '$\u00A0' + domain.formatMinorUnits(minor);
  const facts = domain.spendingInsights(snapshot, [], 'ARS', '2026-08', '2026-09-12', money);
  assert.ok(facts.length > 0);
  const shown = texts(view.render());
  for (const fact of facts) {
    assert.ok(shown.includes(fact.title), 'missing ' + fact.title);
    assert.ok(shown.includes(fact.detail), 'missing ' + fact.detail);
  }
});

test('23.1B2: Reportes in English changes only words; amounts, user data and routes stay the same', () => {
  const params = { currency: 'ARS', month: '2026-08' };
  const es = routeHarness('(tabs)/reports.tsx', params);
  const en = routeHarness('(tabs)/reports.tsx', params, snapshot, { locale: 'en-AR' });
  const root = en.render(), words = texts(root);
  // 24T3 carry-in: the analysis switch is the prominent variant, its words in English.
  const control = find(root, 'Choices');
  assert.equal(control.props.prominent, true);
  assert.equal(control.props.options.map((option: { label: string }) => option.label).join(','), 'Categories,Day by day');
  assert.equal(find(es.render(), 'Choices').props.options.map((option: { label: string }) => option.label).join(','), 'Categorías,Día a día');
  find(root, 'IconButton', 'Previous month');
  find(root, 'IconButton', 'Next month');
  assert.ok(words.includes('August 2026'));
  assert.ok(words.includes('Full month'), '24UX5 review: no «· ARS» beside the period; the eyebrow names it');
  assert.equal(words.some(text => /^Spent/.test(text)), false, '24UX6D: no «Spent · ARS» KPI; the total is the donut\'s centre');
  assert.equal(find(root, 'DonutChart').props.total, 606);
  assert.equal(find(root, 'DonutChart').props.caption, 'Spending by category');
  assert.ok(words.includes('Your largest expense was Prueba'), 'the merchant is the person\'s own words');
  assert.ok(words.includes('Recorded income') && words.includes('Net flow'));
  assert.ok(words.includes('Compare with previous month'), 'the row opens the month before the selected one, which may be a past month');
  assert.equal(words.some(text => /Gastado|Mes anterior|Flujo neto|Tu mayor gasto|Solo movimientos/.test(text)), false, 'no Spanish copy left: ' + words.join(' | '));
  // Same numbers and the same data behind the words.
  assert.equal(shownTotal(root).minor, shownTotal(es.render()).minor);
  assert.equal(root.props.data.map((item: domain.CategorySpending) => item.key + ':' + item.amountMinor).join(','),
    es.render().props.data.map((item: domain.CategorySpending) => item.key + ':' + item.amountMinor).join(','));
  // Day by day: a plural count and the same drill-down route.
  nodes(root).find(n => n.type === 'Choices' && n.props.value === 'categories')!.props.onChange('days');
  const days = en.render();
  assert.ok(texts(days).includes('Total'), '24UX6D: Day by day keeps the total as one compact line');
  const row = days.props.renderItem({ item: days.props.data[1], index: 1 });
  assert.equal(find(row, 'DetailRow').props.label, 'Aug 10 · 2 expenses');
  const first = days.props.renderItem({ item: days.props.data[0], index: 0 });
  assert.equal(find(first, 'DetailRow').props.label, 'Aug 31 · 1 expense');
  find(row, 'DetailRow').props.onPress();
  assert.equal(JSON.stringify(en.pushed[0]), JSON.stringify({ pathname: '/report-day', params: { currency: 'ARS', date: '2026-08-10' } }));
  const day = routeHarness('report-day.tsx', en.pushed[0].params, snapshot, { locale: 'en-AR' }).render();
  assert.equal(find(day, 'Money').props.minor, 505);
  assert.ok(texts(day).includes('August 10, 2026'));
  assert.ok(texts(day).includes('2 recorded expenses\u00A0·\u00A0ARS'));
  // Spanish keeps its wording, plural included.
  nodes(es.render()).find(n => n.type === 'Choices' && n.props.value === 'categories')!.props.onChange('days');
  const esDays = es.render();
  assert.equal(find(esDays.props.renderItem({ item: esDays.props.data[0], index: 0 }), 'DetailRow').props.label.endsWith(' · 1 gasto'), true);
  assert.equal(find(esDays.props.renderItem({ item: esDays.props.data[1], index: 1 }), 'DetailRow').props.label.endsWith(' · 2 gastos'), true);
});

test('23.1B2: category and comparison details in English', () => {
  const data = { ...snapshot, entries: [...snapshot.entries, { ...snapshot.entries[0], id: 'now', dateISO: '2026-09-10', amountMinor: 400 }] };
  const detail = routeHarness('report-category.tsx', { currency: 'ARS', month: '2026-08', category: 'salud' }, data, { locale: 'en-AR' }).render();
  assert.ok(texts(detail).includes('2 recorded expenses'));
  assert.ok(texts(detail).includes('Transactions'));
  const empty = routeHarness('report-category.tsx', { currency: 'ARS', month: '2026-08', category: 'missing' }, data, { locale: 'en-AR' }).render();
  assert.equal(find(empty, 'EmptyState').props.title, 'No expenses in this category');
  const view = routeHarness('report-comparison.tsx', { currency: 'ARS', month: '2026-09' }, data, { locale: 'en-AR' });
  const list = view.render();
  assert.ok(texts(list).includes('September 1–12, 2026'), texts(list).join(' | '));
  assert.ok(texts(list).includes('August 1–12, 2026'));
  const row = list.props.renderItem({ item: list.props.data.find((item: domain.CategoryChange) => item.key === 'salud') });
  find(row, 'DetailRow', 'Previous').props.onPress();
  assert.equal(view.pushed[0].params.through, '2026-08-12');
  assert.equal(find(routeHarness('report-day.tsx', { currency: 'ARS', date: 'bad' }, data, { locale: 'en-AR' }).render(), 'EmptyState').props.title, 'Invalid day');
});

test('23.1C2: the largest expense names its day in the region\'s order; Argentina keeps the domain\'s text', () => {
  const insightDetail = (root: Node) => texts(root).find(text => / · Salud · /.test(text))!;
  for (const [dateISO, month, argentina, unitedStates] of [['2026-08-22', '2026-08', '22/08', '8/22'], ['2026-09-05', '2026-09', '5/09', '9/5']]) {
    // A second purchase from the same merchant: the largest single one is then a fact the ranking does not show (24UX5).
    const data = { ...snapshot, entries: [...snapshot.entries, { ...snapshot.entries[0], id: 'big', amountMinor: 5000, dateISO },
      { ...snapshot.entries[0], id: 'small', amountMinor: 100, dateISO }] };
    const params = { currency: 'ARS', month };
    const esAR = insightDetail(routeHarness('(tabs)/reports.tsx', params, data).render());
    const domainText = domain.spendingInsights(data, [], 'ARS', month, '2026-09-12', minor => '$\u00A0' + domain.formatMinorUnits(minor)).find(fact => fact.id === 'largest:big')!.detail;
    assert.equal(esAR, domainText, 'Spanish in Argentina is the domain\'s own sentence');
    assert.ok(esAR.endsWith(' · ' + argentina), esAR);
    assert.ok(insightDetail(routeHarness('(tabs)/reports.tsx', params, data, { locale: 'en-AR' }).render()).endsWith(' · ' + argentina), 'the region orders the day, not the language');
    for (const locale of ['en-US', 'es-US'] as AppLocale[]) {
      const detail = insightDetail(routeHarness('(tabs)/reports.tsx', params, data, { locale }).render());
      assert.ok(detail.endsWith(' · ' + unitedStates), locale + ': ' + detail);
    }
  }
});

test('24UX5: "your largest expense" is left out when the ranking right above shows that same single purchase; budget facts stay', () => {
  const at = '2026-09-12T12:00:00Z';
  const cash: domain.Account = { id: 'a', name: 'Caja', currency: 'ARS', openingMinor: 0, createdAt: at };
  const entry = (id: string, merchant: string, amountMinor: number): domain.Entry => ({ id, accountId: 'a', kind: 'expense', amountMinor, merchant, category: 'Hogar', dateISO: '2026-09-05', createdAt: at });
  const titles = (root: Node) => texts(root);
  // One purchase at Carrefour: the ranking's first row already says Carrefour, 1 compra, the amount and the category.
  const single = { accounts: [cash], entries: [entry('big', 'Carrefour', 90000), entry('a', 'Kiosco', 1000), entry('b', 'Kiosco', 2000)] };
  const alone = routeHarness('(tabs)/reports.tsx', { currency: 'ARS', month: '2026-09' }, single).render();
  assert.equal(titles(alone).some(text => text.startsWith('Tu mayor gasto fue')), false);
  assert.ok(nodes(alone).some(node => node.props.merchant?.merchant === 'Carrefour' && node.props.merchant.count === 1), 'the ranking keeps the purchase');
  // Two purchases at Carrefour: the ranking shows their total, so the single largest one is an extra, checkable fact.
  const repeated = { accounts: [cash], entries: [...single.entries, entry('again', 'Carrefour', 500)] };
  assert.ok(titles(routeHarness('(tabs)/reports.tsx', { currency: 'ARS', month: '2026-09' }, repeated).render()).includes('Tu mayor gasto fue Carrefour'));
  // The pure rule: only a "largest" fact is ever dropped.
  const facts = [{ id: 'over:b1', title: '', detail: '', tone: 'expense' as const }, { id: 'largest:big', title: '', detail: '', tone: 'neutral' as const }];
  assert.equal(reportPresentation.insightsBesideRanking(facts, [{ key: 'carrefour', count: 1 }], single.entries).map(fact => fact.id).join(), 'over:b1');
  assert.equal(reportPresentation.insightsBesideRanking(facts, [{ key: 'carrefour', count: 2 }], single.entries).length, 2);
});

test('24UX5: what the report counts is behind an information button (24UX6D: beside the period line), not a permanent paragraph', () => {
  const data = { ...snapshot, entries: [...snapshot.entries, { ...snapshot.entries[0], id: 'big', amountMinor: 5000, dateISO: '2026-09-05' }] };
  for (const [locale, title] of [['es-AR', 'Qué cuenta este reporte'], ['en-US', 'What this report counts']] as [AppLocale, string][]) {
    const root = routeHarness('(tabs)/reports.tsx', { currency: 'ARS', month: '2026-09' }, data, { locale }).render();
    const info = nodes(root).find(node => node.type === 'InfoButton')!;
    assert.equal(info.props.title, title);
    assert.match(info.props.detail, /ARS/, 'names the currency the report is limited to');
    const printed = nodes(root).filter(node => node.type === 'AppText').flatMap(node => [node.props.children].flat()).filter(child => typeof child === 'string');
    assert.equal(printed.some(text => /saldos iniciales|Opening balances/.test(text)), false, 'the methodology is no longer printed on the screen');
  }
});

test('23.1C2: VoiceOver hears the day row and the totals in the language\'s numbers, not the region\'s', () => {
  const data = { ...snapshot, entries: [...snapshot.entries, { ...snapshot.entries[0], id: 'big', amountMinor: 123456, dateISO: '2026-08-22' },
    { ...snapshot.entries[0], id: 'pay', kind: 'income' as const, amountMinor: 200000, merchant: 'Sueldo', category: 'Sueldo', dateISO: '2026-08-01' }] };
  const dayRow = (locale: AppLocale) => {
    const view = routeHarness('(tabs)/reports.tsx', { currency: 'ARS', month: '2026-08' }, data, { locale });
    nodes(view.render()).find(n => n.type === 'Choices' && n.props.value === 'categories')!.props.onChange('days');
    const list = view.render();
    const index = list.props.data.findIndex((item: domain.DailySpending) => item.dateISO === '2026-08-22');
    return { row: find(list.props.renderItem({ item: list.props.data[index], index }), 'DetailRow'), root: list };
  };
  for (const [locale, spoken, visible, income] of [['es-AR', '1234,56 pesos', '$\u00A01.234,56', '2000,00 pesos'], ['es-US', '1234,56 pesos', 'AR$\u00A01,234.56', '2000,00 pesos'],
    ['en-AR', '1234.56 pesos', '$\u00A01.234,56', '2000.00 pesos'], ['en-US', '1234.56 pesos', 'AR$\u00A01,234.56', '2000.00 pesos']] as [AppLocale, string, string, string][]) {
    const { row, root } = dayRow(locale);
    assert.equal(row.props.value, visible, locale + ': the screen keeps the region\'s format');
    assert.equal(row.props.spokenValue, spoken, locale + ': the pressable row speaks the amount in the language\'s numbers');
    assert.ok(typeof row.props.onPress === 'function', 'the day row is the pressable DetailRow whose label includes the value');
    assert.equal(nodes(root).find(n => n.type === 'DetailRow' && n.props.icon === 'add-circle-outline')!.props.spokenValue, income, locale + ': recorded income');
  }
});

test('23.1C2: the comparison rows speak their coded amounts without grouping', () => {
  const data = { ...snapshot, entries: [...snapshot.entries, { ...snapshot.entries[0], id: 'now', dateISO: '2026-09-10', amountMinor: 123456 }] };
  for (const [locale, spoken] of [['es-US', '1234,56 ARS'], ['en-AR', '1234.56 ARS']] as [AppLocale, string][]) {
    const list = routeHarness('report-comparison.tsx', { currency: 'ARS', month: '2026-09' }, data, { locale }).render();
    const row = list.props.renderItem({ item: list.props.data.find((item: domain.CategoryChange) => item.key === 'salud') });
    const current = nodes(row).find(n => n.type === 'DetailRow' && typeof n.props.onPress === 'function')!;
    assert.equal(current.props.spokenValue, spoken, locale);
    assert.notEqual(current.props.value, spoken, 'the visible value keeps the code first and the region\'s separators');
  }
});

test('24B2: report-day, report-category and report-comparison refuse a currency that is unknown, malformed or not held, never falling back to ARS', () => {
  const emptyTitle = (root: any) => nodes(root).find(node => node.type === 'EmptyState')?.props.title;
  for (const currency of ['ars', 'usd', 'XAU', 'ZZZ', 'CHF', 'EUR', '']) {
    assert.equal(emptyTitle(routeHarness('report-day.tsx', { currency, date: '2026-08-10' }).render()), 'Día no válido', 'day ' + JSON.stringify(currency));
    assert.equal(emptyTitle(routeHarness('report-category.tsx', { currency, month: '2026-08', category: 'salud' }).render()), 'Período no válido', 'category ' + JSON.stringify(currency));
    assert.equal(emptyTitle(routeHarness('report-comparison.tsx', { currency, month: '2026-09' }).render()), 'Comparación no válida', 'comparison ' + JSON.stringify(currency));
  }
  assert.equal(nodes(routeHarness('report-day.tsx', { currency: 'ARS', date: '2026-08-10' }).render()).some(node => node.type === 'EmptyState' && node.props.title === 'Día no válido'), false);
  assert.equal(find(routeHarness('report-day.tsx', { date: '2026-08-10' }).render(), 'EmptyState').props.title, 'Día no válido', 'a day link always names its currency');
  assert.equal(nodes(routeHarness('report-comparison.tsx', { month: '2026-09' }).render()).some(node => node.type === 'EmptyState' && node.props.title === 'Comparación no válida'), false, 'a link without a currency opens the ledger\'s first one, as the tab does');
  // A currency held by an account in a currency the gate does not offer still opens (read acceptance, never the gate).
  const withYen = { ...snapshot, accounts: [...snapshot.accounts, { id: 'jpy', name: 'Yen', currency: 'JPY' as const, openingMinor: 1500, createdAt: snapshot.accounts[0].createdAt }] };
  assert.equal(nodes(routeHarness('report-day.tsx', { currency: 'JPY', date: '2026-08-10' }, withYen).render()).some(node => node.type === 'EmptyState' && node.props.title === 'Día no válido'), false);
  assert.equal(nodes(routeHarness('report-comparison.tsx', { currency: 'JPY', month: '2026-09' }, withYen).render()).some(node => node.type === 'EmptyState' && node.props.title === 'Comparación no válida'), false);
});

test('24B3: Reportes with three currencies offers the switch over the currencies present and reports each one on its own', () => {
  const yen: domain.Account = { id: 'y', name: 'Yenes', currency: 'JPY', openingMinor: 0, createdAt };
  const data: domain.LedgerSnapshot = { accounts: [...snapshot.accounts, yen], entries: [...snapshot.entries,
    { id: 'y1', accountId: 'y', kind: 'expense', amountMinor: 1500, merchant: 'Konbini', category: 'Comida', dateISO: '2026-08-10', createdAt }] };
  const view = routeHarness('(tabs)/reports.tsx', { month: '2026-08' }, data);
  let root = view.render();
  const control = find(root, 'DisplayCurrencyButton');
  assert.deepEqual(control.props.held, ['ARS', 'USD', 'JPY']);
  assert.equal(control.props.currency, 'ARS');
  assert.equal(shownTotal(root).minor, 606, 'the ARS report is unchanged');
  control.props.onCurrency('JPY');
  root = view.render();
  assert.deepEqual({ minor: shownTotal(root).minor, currency: shownTotal(root).currency }, { minor: 1500, currency: 'JPY' });
  assert.equal(find(root, 'DisplayCurrencyButton').props.currency, 'JPY');
  const link = routeHarness('(tabs)/reports.tsx', { month: '2026-08', currency: 'JPY' }, data).render();
  assert.equal(shownTotal(link).currency, 'JPY', 'a link naming a held currency opens it');
  assert.equal(shownTotal(routeHarness('(tabs)/reports.tsx', { month: '2026-08', currency: 'KWD' }, data).render()).currency, 'ARS', 'a currency no account holds is not offered: the tab opens its first one');
});

test('24UX3 review: Dónde más gastaste is an open ranked list on the ground, not a second grouped slab', () => {
  const list = routeHarness('(tabs)/reports.tsx', { currency: 'ARS', month: '2026-08' }).render();
  const footer = nodes(list.props.ListFooterComponent);
  const title = footer.find(node => node.type === 'SectionTitle' && node.props.children === 'Dónde más gastaste');
  assert.ok(title, 'the merchants section renders for a month with expenses');
  assert.equal(title.props.caption, undefined, 'no subtitle restating the title');
  const cells = (root: Node) => nodes(root).filter(node => (node.type as unknown as { name?: string })?.name === 'MerchantCells');
  assert.ok(cells({ type: 'root', props: { children: list.props.ListFooterComponent } } as Node).length > 0);
  assert.equal(footer.filter(node => node.type === 'Surface').some(surface => cells(surface).length > 0), false);
  const section = footer.find(node => node.type === 'View' && [node.props.children].flat().includes(title))!;
  const badges = nodes(section).filter(node => node.type === 'CategoryBadge');
  assert.ok(badges.length > 0);
  assert.equal(badges.every(badge => badge.props.size === 32), true, 'compact marks, lighter than the category card');
});

test('24UX5 review: the month heading raises only its first letter, and the period line does not repeat the currency the chip names', () => {
  const data = { ...snapshot, entries: [...snapshot.entries, { ...snapshot.entries[0], id: 'sep', amountMinor: 500, dateISO: '2026-09-05' }] };
  for (const [locale, heading, period] of [['es-AR', 'Septiembre de 2026', 'Hasta hoy'], ['en-US', 'September 2026', 'Through today']] as [AppLocale, string, string][]) {
    const root = routeHarness('(tabs)/reports.tsx', { currency: 'ARS', month: '2026-09' }, data, { locale }).render();
    const title = nodes(root).find(node => node.type === 'AppText' && node.props.accessibilityRole === 'header' && node.props.variant === 'title3')!;
    assert.equal(title.props.children, heading, locale);
    assert.equal(title.props.style.textTransform, undefined, 'no style-level capitalize («Septiembre De 2026»)');
    const words = texts(root);
    assert.ok(words.includes(period), locale + ': the period alone');
    assert.equal(words.some(text => text.startsWith(period + ' · ')), false, 'no «· ARS» after the period');
    // 24UX6D: the «Gastado · ARS» eyebrow is gone; with two currencies the chip names the one shown.
    assert.equal(words.some(text => /Gastado|Spent/.test(text)), false);
    assert.equal(find(root, 'DisplayCurrencyButton').props.currency, 'ARS', 'the chip names the currency');
    assert.ok(nodes(root).some(node => node.type === 'InfoButton'), 'the method button stays');
  }
  // 24UX6D: with one currency there is no chip, so the period line names it.
  const pesos = { accounts: [snapshot.accounts[0]], entries: data.entries.filter(entry => entry.accountId === 'a') };
  const single = routeHarness('(tabs)/reports.tsx', { month: '2026-09' }, pesos).render();
  assert.equal(nodes(single).some(node => node.type === 'DisplayCurrencyButton'), false);
  assert.ok(texts(single).includes('Hasta hoy · ARS'), texts(single).join(' | '));
});

// ---- Producto 24C1: consolidated reports use each expense's own date ----------------------------------------

test('24C1: a consolidated past month converts each expense at the rate of its date, never today\'s; drill-downs keep the original amounts', () => {
  const book = domain.rateBook([
    { base: 'USD', quote: 'ARS', rate: '1000', effectiveDate: '2026-08-07', source: 'Frankfurter', fetchedAt: '2026-09-01T00:00:00.000Z' },
    { base: 'USD', quote: 'ARS', rate: '1000', effectiveDate: '2026-08-28', source: 'Frankfurter', fetchedAt: '2026-09-01T00:00:00.000Z' },
    { base: 'USD', quote: 'ARS', rate: '1500', effectiveDate: '2026-09-11', source: 'Frankfurter', fetchedAt: '2026-09-12T00:00:00.000Z' },
  ]);
  const display = displayCurrency.createDisplayCurrencyStore(memoryPreferences({ [displayCurrency.DISPLAY_MODE_KEY]: 'consolidated', [displayCurrency.DISPLAY_CURRENCY_KEY]: 'USD' }).store);
  const ensured: { months: readonly string[]; quotes: readonly string[] }[] = [];
  const view = routeHarness('(tabs)/reports.tsx', { month: '2026-08' }, snapshot, { display, book, ensured });
  const root = view.render();
  // August in USD: ARS 1,01 + 2,02 + 3,03 at 1000 (not today's 1500) → 0,00101… each: 0 + 0 + 0; USD 9,99.
  // (Tiny ARS amounts round to zero cents each: every movement is rounded once and the parts add up.)
  assert.deepEqual([shownTotal(root).minor, shownTotal(root).currency], [999, 'USD']);
  assert.match(find(root, 'InfoButton').props.detail, /del 7\/8\/2026 al 28\/8\/2026, nunca la de hoy para un mes pasado/);
  assert.equal(ensured.at(-1)!.months.join(), '2026-03,2026-04,2026-05,2026-06,2026-07,2026-08', 'the month and the five before it, for the trend');
  const bigger: domain.LedgerSnapshot = { ...snapshot, entries: snapshot.entries.map(entry => entry.accountId === 'a' ? { ...entry, amountMinor: entry.amountMinor * 1000 } : entry) };
  const scaled = routeHarness('(tabs)/reports.tsx', { month: '2026-08' }, bigger, { display, book }).render();
  assert.equal(shownTotal(scaled).minor, 101 + 202 + 303 + 999, 'ARS 1.010 + 2.020 + 3.030 at 1000 → USD 6,06, plus USD 9,99');
  assert.equal(JSON.stringify(scaled.props.data.map((row: domain.CategorySpending) => [row.key, row.amountMinor])), JSON.stringify([['salud', 101 + 202 + 999], ['salud extra', 303]]));
  const detail = routeHarness('report-category.tsx', { currency: 'USD', month: '2026-08', category: 'salud' }, bigger, { display, book }).render();
  assert.equal(find(detail, 'Money').props.minor, 101 + 202 + 999);
  assert.equal(JSON.stringify(detail.props.entries.map((entry: domain.Entry) => [entry.id, entry.amountMinor])), JSON.stringify([['a', 101000], ['u', 999], ['b', 202000]]), 'the rows are the recorded amounts, newest first');
  assert.equal(detail.props.accounts, bigger.accounts, 'drawn with the real accounts and their currencies');
});

test('24C1: a consolidated month with an expense that has no rate shows per-currency subtotals, no trend, no comparison and no partial category list', () => {
  const display = displayCurrency.createDisplayCurrencyStore(memoryPreferences({ [displayCurrency.DISPLAY_MODE_KEY]: 'consolidated', [displayCurrency.DISPLAY_CURRENCY_KEY]: 'EUR' }).store);
  const root = routeHarness('(tabs)/reports.tsx', { month: '2026-08' }, snapshot, { display, activity: 'idle' }).render();
  assert.equal(nodes(root).some(n => n.type === 'Money' || n.type === 'MonthBars' || n.type === 'DonutChart'), false);
  assert.equal(root.props.data.length, 0, 'no category rows');
  const parts = find(root, 'CurrencyParts');
  assert.equal(JSON.stringify(parts.props.parts), JSON.stringify([{ currency: 'ARS', minor: 606 }, { currency: 'USD', minor: 999 }]));
  assert.match(parts.props.detail, /^No hay una cotización USD → ARS para el 31\/8\/2026\./);
  const comparison = routeHarness('report-comparison.tsx', { currency: 'EUR', month: '2026-08' }, snapshot, { display }).render();
  assert.equal(find(comparison, 'EmptyState').props.detail, 'Sin cotización para sumarlo en EUR', 'no difference is claimed');
});

test('24C1 review: comparing two complete past months is not blocked by a later month still waiting for its rate', () => {
  const book = domain.rateBook([
    { base: 'USD', quote: 'ARS', rate: '1000', effectiveDate: '2026-08-07', source: 'Frankfurter', fetchedAt: '2026-09-01T00:00:00.000Z' },
    { base: 'USD', quote: 'ARS', rate: '1000', effectiveDate: '2026-08-28', source: 'Frankfurter', fetchedAt: '2026-09-01T00:00:00.000Z' },
  ]);
  const display = displayCurrency.createDisplayCurrencyStore(memoryPreferences({ [displayCurrency.DISPLAY_MODE_KEY]: 'consolidated', [displayCurrency.DISPLAY_CURRENCY_KEY]: 'USD' }).store);
  const later: domain.LedgerSnapshot = { ...snapshot, entries: [...snapshot.entries,
    { id: 'sep', accountId: 'a', kind: 'expense', amountMinor: 5000, merchant: 'Prueba', category: 'Salud', dateISO: '2026-09-11', createdAt }] };
  const august = routeHarness('report-comparison.tsx', { currency: 'USD', month: '2026-08' }, later, { display, book }).render();
  assert.equal(nodes(august).some(n => n.type === 'EmptyState' && n.props.title === 'Cotizaciones'), false, 'August against July needs no September rate');
  const september = routeHarness('report-comparison.tsx', { currency: 'USD', month: '2026-09' }, later, { display, book }).render();
  assert.equal(find(september, 'EmptyState').props.title, 'Cotizaciones', 'September itself has no rate: no difference is claimed');
});

test('24C1 review: Reportes keeps budgets in their own currency on the real ledger; consolidated, the section names it and its rows are in it', () => {
  const accounts: domain.Account[] = [{ id: 'a', name: 'Pesos', currency: 'ARS', openingMinor: 0, createdAt }, { id: 'e', name: 'Euros', currency: 'EUR', openingMinor: 0, createdAt }];
  const data: domain.LedgerSnapshot = { accounts, entries: [
    { id: 'ars', accountId: 'a', kind: 'expense', amountMinor: 300, merchant: 'Kiosco', category: 'Comida', dateISO: '2026-09-11', createdAt },
    { id: 'eur', accountId: 'e', kind: 'expense', amountMinor: 500, merchant: 'Bäckerei', category: 'Comida', dateISO: '2026-09-11', createdAt }] };
  const budget: domain.MonthlyBudget = { id: 'b-ars', scope: 'total', currency: 'ARS', monthISO: '2026-09', amountMinor: 400, active: true, createdAt, revision: 0, updatedAt: createdAt };
  const book = domain.rateBook([
    { base: 'USD', quote: 'ARS', rate: '1000', effectiveDate: '2026-09-10', source: 'Frankfurter', fetchedAt: '2026-09-12T12:00:00.000Z' },
    { base: 'USD', quote: 'EUR', rate: '0.5', effectiveDate: '2026-09-10', source: 'Frankfurter', fetchedAt: '2026-09-12T12:00:00.000Z' }]);
  const rows = (root: Node) => nodes(root).filter(n => typeof n.type === 'function' && (n.type as { name: string }).name === 'BudgetStatusRow');
  const harness = (mode: displayCurrency.DisplayMode, currency: string) => {
    const display = displayCurrency.createDisplayCurrencyStore(memoryPreferences({ [displayCurrency.DISPLAY_MODE_KEY]: mode, [displayCurrency.DISPLAY_CURRENCY_KEY]: currency }).store);
    return routeHarness('(tabs)/reports.tsx', {}, data, { display, book, archive: { budgets: [budget] } });
  };
  // Consolidated in USD: the total converts both accounts (ARS 3,00 → 0,00 USD; EUR 5,00 → 10,00 USD); the ARS budget counts ARS 3,00 only.
  const usd = harness('consolidated', 'USD');
  let root = usd.render();
  assert.equal(shownTotal(root).minor, 0 + 1000);
  assert.equal(rows(root).length, 1);
  assert.equal(JSON.stringify([rows(root)[0].props.spent, rows(root)[0].props.limit, rows(root)[0].props.money(300).replace(/\u00a0/g, ' ')]), JSON.stringify([300, 400, '$ 3,00']), 'ARS 3,00 of 4,00, written in pesos');
  const title = nodes(root).find(n => n.type === 'SectionTitle' && String(n.props.children).startsWith('Presupuestos'))!;
  assert.equal(String(title.props.children).replace(/\u00a0/g, ' '), 'Presupuestos · ARS');
  title.props.onAction();
  assert.equal(JSON.stringify(usd.pushed.at(-1)), JSON.stringify({ pathname: '/budgets', params: { currency: 'ARS', month: '2026-09' } }), 'Administrar opens the budget\'s own currency');
  // The over-budget insight is a fact about the ARS budget, in pesos, beside the largest expense of the shown ledger.
  const insightTitles = nodes(root).filter(n => n.type === 'AppText' && typeof n.props.children === 'string').map(n => n.props.children as string);
  assert.ok(!insightTitles.some(text => /Superaste/.test(text)), 'ARS 3,00 of 4,00 is not exceeded');
  // Consolidated in ARS: the budget is the display currency's; the section keeps its plain title; spent stays 3,00 (not 3,00 + converted euros).
  root = harness('consolidated', 'ARS').render();
  assert.equal(shownTotal(root).minor, 300 + 1000000);
  assert.equal(JSON.stringify([rows(root)[0].props.spent, String(nodes(root).find(n => n.type === 'SectionTitle' && String(n.props.children).startsWith('Presupuestos'))!.props.children)]), JSON.stringify([300, 'Presupuestos']));
  // Single ARS: exactly as before 24C1.
  root = harness('single', 'ARS').render();
  assert.equal(JSON.stringify([shownTotal(root).minor, rows(root)[0].props.spent]), JSON.stringify([300, 300]));
  // Single EUR: no EUR budget, no section.
  assert.equal(rows(harness('single', 'EUR').render()).length, 0);
});

// ---- 25B2 review: a deleted account's currency stays in the reports -------------------------------------------

test('25B2 review: a past month keeps the movements of a deleted USD account: consolidated at their dates, filterable as "Solo USD", the previous month reachable, no partial sum without a rate', () => {
  const deletedAt = '2026-09-20T10:00:00.000Z';
  const data: domain.LedgerSnapshot = { ...snapshot, accounts: snapshot.accounts.map(account => account.id === 'u' ? { ...account, revision: 1, updatedAt: deletedAt, deletedAt } : account),
    entries: [...snapshot.entries, { id: 'july', accountId: 'u', kind: 'expense', amountMinor: 250, merchant: 'Prueba', category: 'Salud', dateISO: '2026-07-15', createdAt }] };
  const book = domain.rateBook([
    { base: 'USD', quote: 'ARS', rate: '1000', effectiveDate: '2026-07-15', source: 'Frankfurter', fetchedAt: '2026-09-01T00:00:00.000Z' },
    { base: 'USD', quote: 'ARS', rate: '1000', effectiveDate: '2026-08-10', source: 'Frankfurter', fetchedAt: '2026-09-01T00:00:00.000Z' },
    { base: 'USD', quote: 'ARS', rate: '1000', effectiveDate: '2026-08-31', source: 'Frankfurter', fetchedAt: '2026-09-01T00:00:00.000Z' },
  ]);
  // Consolidated in ARS: August's USD 9,99 at 1000 → ARS 9.990,00 joins the pesos, though no USD account is live.
  const consolidated = displayCurrency.createDisplayCurrencyStore(memoryPreferences({ [displayCurrency.DISPLAY_MODE_KEY]: 'consolidated', [displayCurrency.DISPLAY_CURRENCY_KEY]: 'ARS' }).store);
  const root = routeHarness('(tabs)/reports.tsx', { month: '2026-08' }, data, { display: consolidated, book }).render();
  assert.deepEqual([shownTotal(root).minor, shownTotal(root).currency], [101 + 202 + 303 + 999000, 'ARS']);
  assert.deepEqual([find(root, 'DisplayCurrencyButton').props.mode, find(root, 'DisplayCurrencyButton').props.currency], ['consolidated', 'ARS'], 'the chip stays: the history holds two currencies');
  // "Solo USD": the deleted account's own month, and the previous one too (the comparison reads July's USD 2,50).
  const single = displayCurrency.createDisplayCurrencyStore(memoryPreferences({ [displayCurrency.DISPLAY_MODE_KEY]: 'single', [displayCurrency.DISPLAY_CURRENCY_KEY]: 'USD' }).store);
  const usd = routeHarness('(tabs)/reports.tsx', { month: '2026-08' }, data, { display: single, book }).render();
  assert.deepEqual([shownTotal(usd).minor, shownTotal(usd).currency], [999, 'USD']);
  assert.equal(JSON.stringify(usd.props.data.map((row: domain.CategorySpending) => [row.key, row.amountMinor])), JSON.stringify([['salud', 999]]));
  const july = routeHarness('(tabs)/reports.tsx', { month: '2026-07' }, data, { display: single, book }).render();
  assert.deepEqual([shownTotal(july).minor, shownTotal(july).currency], [250, 'USD'], 'the previous period is still there');
  const comparison = routeHarness('report-comparison.tsx', { currency: 'USD', month: '2026-08' }, data, { display: single, book }).render();
  assert.equal(nodes(comparison).some(n => n.type === 'EmptyState'), false, 'August against July compares the deleted account\'s own months');
  const detail = routeHarness('report-category.tsx', { currency: 'USD', month: '2026-08', category: 'salud' }, data, { display: single, book }).render();
  assert.equal(JSON.stringify(detail.props.entries.map((entry: domain.Entry) => entry.id)), JSON.stringify(['u']), 'the drill-down reaches the movement');
  // Without a rate, consolidated: per-currency parts, never a sum that silently drops the deleted account.
  const missing = routeHarness('(tabs)/reports.tsx', { month: '2026-08' }, data, { display: consolidated, book: domain.rateBook([]) }).render();
  assert.equal(nodes(missing).some(n => n.type === 'Money'), false);
  assert.equal(JSON.stringify(find(missing, 'CurrencyParts').props.parts), JSON.stringify([{ currency: 'ARS', minor: 606 }, { currency: 'USD', minor: 999 }]));
});

// Producto 24UX6B: the Forest reading order of Reportes. Scope and period, the month's analysis (categories first, or
// day by day; 24UX6D: the month's total is no longer a KPI between them but the donut's centre or Día a día's line), then the six-month history, then the details. A descriptor-level guard of the order
// and the copy; how the screen reads on an iPhone (VoiceOver order, Dynamic Type, scrolling) stays a device item.
const withSeptember = { ...snapshot, entries: [...snapshot.entries, { ...snapshot.entries[0], id: 'now', dateISO: '2026-09-10', amountMinor: 400 }] };
const sectionTitles = (value: any) => nodes(value).filter(n => n.type === 'SectionTitle').map(n => [n.props.children].flat().join(''));

test('24UX6B, recomposed in 24UX6D: the period, then the analysis with categories first (the donut carries the total), then the history, then the details', () => {
  const root = routeHarness('(tabs)/reports.tsx', { currency: 'ARS' }, withSeptember).render();
  const header = nodes(root.props.ListHeaderComponent);
  const at = (predicate: (n: Node) => boolean) => header.findIndex(predicate);
  const period = at(n => n.type === 'IconButton' && n.props.label === 'Mes anterior');
  const analysis = at(n => n.type === 'Choices');
  const donut = at(n => n.type === 'DonutChart');
  const byCategory = at(n => n.type === 'SectionTitle' && n.props.children === 'Por categoría');
  assert.ok(period >= 0 && period < analysis && analysis < donut && donut < byCategory,
    'period → Categorías | Día a día → donut → «Por categoría»: ' + [period, analysis, donut, byCategory].join(','));
  assert.equal(at(n => n.type === 'Money'), -1, '24UX6D: no KPI between the period and the analysis');
  assert.equal(header[donut].props.total, 400, 'the donut carries the month\'s total');
  assert.equal(header.some(n => n.type === 'MonthBars'), false, 'the six months are no longer the first chart');
  assert.equal(find(root, 'Choices').props.value, 'categories', 'categories are the default reading');
  assert.equal(root.props.data.length, 1, 'every category of the month is a row under the donut');
  // The footer opens with the history, before the lower-priority details.
  const footer = root.props.ListFooterComponent;
  assert.deepEqual(sectionTitles(footer), ['Evolución', 'Dónde más gastaste', 'Para tener en cuenta']);
  assert.ok(nodes(footer).some(n => n.type === 'MonthBars'), 'the history sits under the analysis');
  assert.equal(nodes(footer).find(n => n.type === 'SectionTitle' && n.props.children === 'Evolución')!.props.caption, 'Tocá un mes para verlo');
  const lastBlock = nodes(footer).filter(n => n.type === 'DetailRow').map(n => n.props.label);
  assert.deepEqual(lastBlock, ['Ingresos registrados', 'Flujo neto', 'Frente a los mismos días del mes anterior'],
    'income and net flow stay, last; 24UX6D: the change against last month joins them');
  // With a budget of the month, the history still opens the footer, and the budgets follow it.
  const budget: domain.MonthlyBudget = { id: 'b', scope: 'total', currency: 'ARS', monthISO: '2026-09', amountMinor: 1000, active: true, createdAt, revision: 0, updatedAt: createdAt };
  const withBudget = routeHarness('(tabs)/reports.tsx', { currency: 'ARS' }, withSeptember, { archive: { budgets: [budget] } }).render();
  assert.deepEqual(sectionTitles(withBudget.props.ListFooterComponent).slice(0, 2), ['Evolución', 'Presupuestos']);
});

test('24UX6B: the day-by-day state keeps the order: no donut, «Por día» with its note over the day rows', () => {
  const view = routeHarness('(tabs)/reports.tsx', { currency: 'ARS', month: '2026-08' });
  find(view.render(), 'Choices').props.onChange('days');
  const root = view.render();
  assert.equal(nodes(root).some(n => n.type === 'DonutChart'), false);
  const title = nodes(root.props.ListHeaderComponent).find(n => n.type === 'SectionTitle')!;
  assert.deepEqual([title.props.children, title.props.caption], ['Por día', 'Solo días con gastos registrados.']);
  assert.equal(root.props.data.length, 2, 'the two days of August with expenses');
  assert.equal(sectionTitles(root.props.ListFooterComponent)[0], 'Evolución', 'the history stays under the analysis in either state');
});

test('24UX6B: an empty month is an intentional state in both views: one card, no orphan headings', () => {
  const view = routeHarness('(tabs)/reports.tsx', { currency: 'ARS' });
  let root = view.render();
  // 24UX6D: no KPI with a zero and no donut: the one card says there is no spending; what the report counts stays reachable.
  assert.equal(nodes(root.props.ListHeaderComponent).some(n => n.type === 'Money' || n.type === 'DonutChart'), false);
  assert.ok(nodes(root.props.ListHeaderComponent).some(n => n.type === 'InfoButton'), 'the method stays beside the period line');
  assert.equal(sectionTitles(root.props.ListHeaderComponent).length, 0, 'no «Por categoría» over nothing');
  let empty = root.props.ListEmptyComponent;
  assert.deepEqual([empty.props.title, empty.props.icon, empty.props.detail],
    ['Sin gastos en este período', 'pie-chart-outline', 'Los gastos que registres en esta moneda aparecen acá, por categoría.']);
  find(root, 'Choices').props.onChange('days');
  root = view.render();
  assert.equal(nodes(root.props.ListHeaderComponent).some(n => n.type === 'Money'), false, 'no compact total over an empty month either');
  empty = root.props.ListEmptyComponent;
  assert.deepEqual([empty.props.icon, empty.props.detail], ['calendar-outline', 'Cada día con gastos en esta moneda aparece acá, con su total.'],
    'the day view says what it would list, not «por categoría»');
});

test('24UX6B: when the shown month is the only one of its six with spending the history is one quiet line, never a lone bar', () => {
  const onlyNow = { ...snapshot, entries: [{ ...snapshot.entries[0], id: 'now', dateISO: '2026-09-10', amountMinor: 400 }] };
  const root = routeHarness('(tabs)/reports.tsx', { currency: 'ARS' }, onlyNow).render();
  assert.equal(nodes(root).some(n => n.type === 'MonthBars'), false);
  assert.deepEqual(sectionTitles(root.props.ListFooterComponent).slice(0, 1), ['Evolución']);
  assert.ok(texts(root.props.ListFooterComponent).includes('Con más meses de gastos registrados vas a ver la evolución acá.'));
  // A past month alone in its own window (March–August holds only August) gets the same line: its six bars end at it,
  // so they never led forward; the arrows and «Este mes» do.
  const pastAlone = routeHarness('(tabs)/reports.tsx', { currency: 'ARS', month: '2026-08' }, withSeptember).render();
  assert.equal(nodes(pastAlone).some(n => n.type === 'MonthBars'), false);
  assert.ok(texts(pastAlone.props.ListFooterComponent).includes('Con más meses de gastos registrados vas a ver la evolución acá.'));
  // An empty current month with August recorded keeps the bars: another month is there to open.
  assert.ok(nodes(routeHarness('(tabs)/reports.tsx', { currency: 'ARS' }).render()).some(n => n.type === 'MonthBars'));
  // No month of the six with spending: neither bars nor the note.
  const none = routeHarness('(tabs)/reports.tsx', { currency: 'ARS' }, { ...snapshot, entries: [] }).render();
  assert.equal(nodes(none).some(n => n.type === 'MonthBars'), false);
  assert.equal(texts(none).some(text => text.includes('evolución acá')), false);
});

test('24UX6D: the change against last month is a row of the lower facts (it left the KPI line), spoken in the language\'s numbers', () => {
  const root = routeHarness('(tabs)/reports.tsx', { currency: 'ARS' }, withSeptember).render();
  const es = bindLocale('es-AR');
  // September 1–12 against August 1–12 (matching days, ARS): 400 against 202 + 303 = 505, 105 less.
  const row = nodes(root.props.ListFooterComponent).find(n => n.type === 'DetailRow' && n.props.label === 'Frente a los mismos días del mes anterior')!;
  assert.ok(row, 'the row is in the lower facts');
  assert.equal(row.props.value, es.t('reports.delta.less', { percent: reportPresentation.changePercent(105, 505, 'es-AR') }));
  assert.equal(row.props.value, '20,8\u00A0% menos');
  assert.equal(row.props.spokenValue, es.t('reports.delta.less', { percent: es.spokenPercent(105 / 505) }));
  assert.equal(row.props.icon, 'trending-down-outline');
  assert.equal(row.props.onPress, undefined, 'a fact, not a second way into the comparison');
  // It sits right above «Comparar con el mes anterior», which still opens the full comparison.
  const surface = nodes(root.props.ListFooterComponent).filter(n => n.type === 'Surface' && n.props.grouped).at(-1)!;
  const children = [surface.props.children].flat(Infinity).filter(Boolean) as Node[];
  assert.deepEqual(children.map(child => child.type), ['DetailRow', 'DetailRow', 'DetailRow', 'NavigationRow']);
  assert.equal(children[3].props.title, 'Comparar con el mes anterior');
  // Nothing about the change is left at the top.
  assert.equal(texts(root.props.ListHeaderComponent).some(text => /menos que|más que|por día/.test(text)), false);
  // English in Argentina shows «20,8%» but speaks «20.8%».
  const english = routeHarness('(tabs)/reports.tsx', { currency: 'ARS' }, withSeptember, { locale: 'en-AR' }).render();
  const spokenRow = nodes(english.props.ListFooterComponent).find(n => n.type === 'DetailRow' && n.props.label === 'Compared with the same days last month')!;
  assert.equal(spokenRow.props.value, '20,8% less');
  assert.match(spokenRow.props.spokenValue, /20\.8%/);
  assert.doesNotMatch(spokenRow.props.spokenValue, /20,8/, 'never the visible, region-formatted percent');
  // A full previous month (a past month) names it so; without a complete previous month there is no row.
  const august = routeHarness('(tabs)/reports.tsx', { currency: 'ARS', month: '2026-08' }, withSeptember).render();
  assert.equal(nodes(august).some(n => n.type === 'DetailRow' && /^Frente a/.test(n.props.label)), false, 'July has no spending: nothing to compare');
});

// Producto 24UX6C2: a chosen category on the donut. (24UX6C2's «the month's total stays the KPI above the analysis» is
// deliberately superseded by 24UX6D: the total is the donut's centre while nothing is chosen.)
// Descriptor-level checks of the choice's state and scope; how the tap, the outline and VoiceOver's adjustable swipe
// feel on an iPhone stays a device item.
const keysOf = (root: any): string[] => root.props.data.map((item: domain.CategorySpending) => item.key);
/** Each category row's key with the `chosen` flag the screen hands its CategoryLegendRow. */
function rowChoices(root: any): string {
  return root.props.data.map((item: domain.CategorySpending, index: number) =>
    item.key + ':' + find(root.props.renderItem({ item, index }), 'CategoryLegendRow').props.chosen).join(',');
}
const noneChosen = (root: any) => keysOf(root).map(key => key + ':false').join(',');

test('24UX6D (supersedes 24UX6C2\'s KPI): no «Gastado» KPI, amount or average above the analysis; the donut carries the exact total', () => {
  const view = routeHarness('(tabs)/reports.tsx', { currency: 'ARS', month: '2026-08' });
  const report = domain.spendingReport(snapshot, 'ARS', '2026-08', '2026-09-12');
  assert.equal(report.status, 'ready');
  for (const tab of ['categories', 'days'] as const) {
    find(view.render(), 'Choices').props.onChange(tab);
    const root = view.render();
    const header = nodes(root.props.ListHeaderComponent);
    const words = texts(root.props.ListHeaderComponent);
    assert.equal(words.some(text => /Gastado/.test(text)), false, tab + ': no «Gastado · ARS» eyebrow');
    assert.equal(words.some(text => /por día/.test(text)), false, tab + ': no average per day');
    assert.equal(header.some(n => n.type === 'Money' && n.props.large), false, tab + ': no large amount');
    const analysis = header.findIndex(n => n.type === 'Choices');
    const period = header.findIndex(n => n.type === 'IconButton' && n.props.label === 'Mes siguiente');
    assert.ok(period < analysis, tab + ': the controls, then Categorías | Día a día');
    if (tab === 'categories') {
      const donut = header.findIndex(n => n.type === 'DonutChart');
      assert.ok(analysis < donut, 'the donut right under the control');
      assert.equal(header.slice(0, donut).some(n => n.type === 'Money'), false, 'no total before the donut');
      assert.equal(header[donut].props.total, report.status === 'ready' ? report.expenseMinor : NaN, 'the report\'s own figure, in minor units');
      assert.equal(header[donut].props.total, 606);
      assert.equal(header[donut].props.currency, 'ARS');
    } else assert.equal(header.some(n => n.type === 'DonutChart'), false, 'the donut belongs to Categorías only');
  }
});

test('24UX6D: Día a día keeps the period total as one compact line: «Total» secondary, the exact amount at 20 pt semibold, spoken once', () => {
  for (const [locale, label, spoken] of [['es-AR', 'Total', 'Total del período, 6,06 pesos'], ['en-US', 'Total', 'Period total, 6.06 pesos']] as [AppLocale, string, string][]) {
    const view = routeHarness('(tabs)/reports.tsx', { currency: 'ARS', month: '2026-08' }, snapshot, { locale });
    find(view.render(), 'Choices').props.onChange('days');
    const header = nodes(view.render().props.ListHeaderComponent);
    const line = header.find(n => n.type === 'View' && n.props.accessible === true)!;
    assert.ok(line, locale + ': one accessible line');
    assert.equal(line.props.accessibilityLabel, spoken, locale + ': the spoken total, never the grouped visible one');
    assert.equal(line.props.style.flexDirection, 'row');
    assert.equal(line.props.style.flexWrap, 'wrap', 'the amount wraps under the label when the two do not share the line, whole');
    const parts = [line.props.children].flat();
    assert.equal(parts[0].type, 'AppText');
    assert.equal(parts[0].props.secondary, true);
    assert.equal(parts[0].props.children, label);
    assert.deepEqual({ ...parts[1].props }, { minor: 606, currency: 'ARS', size: 20, weight: '600' }, 'the exact total, no hero');
    const analysis = header.findIndex(n => n.type === 'Choices');
    assert.ok(analysis < header.indexOf(line), 'under Categorías | Día a día');
  }
});

test('24UX6D review: a 13-digit total that would not fit at 20 pt (320 pt, AX text) takes its own line as a fitted hero, never truncated', () => {
  const at = '2026-08-01T12:00:00.000Z';
  const huge: domain.LedgerSnapshot = { accounts: [{ id: 'a', name: 'Banco', currency: 'ARS', openingMinor: 0, createdAt: at }],
    entries: [{ id: 'h', accountId: 'a', kind: 'expense', amountMinor: 123_456_789_012_345, merchant: 'Casa', category: 'Hogar', dateISO: '2026-08-03', createdAt: at }], transfers: [] };
  const line = (window: { width: number; height: number; fontScale: number; scale: number }) => {
    const view = routeHarness('(tabs)/reports.tsx', { currency: 'ARS', month: '2026-08' }, huge, { window });
    find(view.render(), 'Choices').props.onChange('days');
    return nodes(view.render().props.ListHeaderComponent).find(n => n.type === 'View' && n.props.accessible === true)!;
  };
  const amounts = (row: Node) => nodes(row).filter(n => n.type === 'Money').map(n => JSON.stringify({ size: n.props.size, large: !!n.props.large }));
  assert.deepEqual(amounts(line({ width: 393, height: 852, fontScale: 1, scale: 3 })), [JSON.stringify({ size: 20, large: false })], 'fits at 20 pt on a 393 pt phone');
  const tight = line({ width: 320, height: 568, fontScale: 3.1, scale: 2 });
  assert.deepEqual(amounts(tight), [JSON.stringify({ size: 28, large: true })], 'a hero sizes itself to its line instead of truncating');
  assert.equal(nodes(tight).find(n => n.type === 'View' && n.props.style?.flexBasis === '100%') !== undefined, true, 'on its own line, under «Total»');
});

test('24UX6D review: the period line wraps and centres, and the caption gives way, so «Este mes» never spills over the forward arrow at larger text', () => {
  const header = nodes(routeHarness('(tabs)/reports.tsx', { currency: 'ARS', month: '2026-07' }).render().props.ListHeaderComponent);
  const thisMonth = header.find(n => n.type === 'PressFeedback' && n.props.accessibilityLabel === 'Volver al mes actual')!;
  assert.ok(thisMonth, 'a past month offers «Este mes»');
  const row = header.find(n => n.type === 'View' && [n.props.children].flat().includes(thisMonth))!;
  assert.equal(JSON.stringify([row.props.style.flexWrap, row.props.style.justifyContent]), JSON.stringify(['wrap', 'center']));
  const caption = header.find(n => n.type === 'AppText' && n.props.variant === 'caption' && n.props.secondary)!;
  assert.equal(caption.props.style.flexShrink, 1);
});

test('24UX6C2: a chosen slice marks the donut and its row only; choosing none, or a key that is not a slice, clears both', () => {
  const view = routeHarness('(tabs)/reports.tsx', { currency: 'ARS', month: '2026-08' });
  let root = view.render();
  assert.ok(keysOf(root).includes('salud') && keysOf(root).length > 1);
  assert.equal(find(root, 'DonutChart').props.chosen, null);
  assert.equal(rowChoices(root), noneChosen(root));
  find(root, 'DonutChart').props.onChoose('salud');
  root = view.render();
  assert.equal(find(root, 'DonutChart').props.chosen, 'salud');
  assert.equal(rowChoices(root), keysOf(root).map(key => key + ':' + (key === 'salud')).join(','), 'only the matching row is chosen');
  assert.equal(shownTotal(root).minor, 606, 'a choice never changes the month\'s total');
  // The row still opens its category, choice or not.
  const salud = root.props.data.find((item: domain.CategorySpending) => item.key === 'salud');
  find(root.props.renderItem({ item: salud, index: 0 }), 'CategoryLegendRow').props.onPress();
  assert.equal(JSON.stringify(view.pushed[0]), JSON.stringify({ pathname: '/report-category', params: { currency: 'ARS', month: '2026-08', category: 'salud' } }));
  find(root, 'DonutChart').props.onChoose(null);
  root = view.render();
  assert.equal(find(root, 'DonutChart').props.chosen, null, 'tapping the chosen slice or the hole clears the choice');
  assert.equal(rowChoices(root), noneChosen(root));
  find(root, 'DonutChart').props.onChoose('missing');
  root = view.render();
  assert.equal(find(root, 'DonutChart').props.chosen, null, 'a key that is not one of this month\'s slices is never shown as chosen');
  assert.equal(rowChoices(root), noneChosen(root));
});

test('24UX6C2: the choice resets when the month changes, by the arrows, a bar or «Este mes», and the month navigation still works', () => {
  // September and August both have «Salud», so a reset cannot come from the key merely being absent.
  const view = routeHarness('(tabs)/reports.tsx', { currency: 'ARS' }, withSeptember);
  const title = (root: any) => texts(root.props.ListHeaderComponent).find(text => /^(Agosto|Septiembre) de 2026$/.test(text));
  let root = view.render();
  find(root, 'DonutChart').props.onChoose('salud');
  root = view.render();
  assert.equal(find(root, 'DonutChart').props.chosen, 'salud');
  // The arrow opens the previous month.
  find(root, 'IconButton', 'Mes anterior').props.onPress();
  root = view.render();
  assert.equal(title(root), 'Agosto de 2026');
  assert.equal(shownTotal(root).minor, 606);
  assert.ok(keysOf(root).includes('salud'));
  assert.equal(find(root, 'DonutChart').props.chosen, null, 'a new month starts with no category chosen');
  assert.equal(rowChoices(root), noneChosen(root));
  // Chosen in August, «Este mes» returns to September with none chosen.
  find(root, 'DonutChart').props.onChoose('salud');
  assert.equal(find(view.render(), 'DonutChart').props.chosen, 'salud');
  find(view.render(), 'PressFeedback', 'Volver al mes actual').props.onPress();
  root = view.render();
  assert.equal(title(root), 'Septiembre de 2026');
  assert.equal(find(root, 'IconButton', 'Mes siguiente').props.disabled, true);
  assert.equal(shownTotal(root).minor, 400);
  assert.equal(find(root, 'DonutChart').props.chosen, null);
  assert.equal(rowChoices(root), noneChosen(root));
  // Chosen in September, a bar opens August with none chosen.
  find(root, 'DonutChart').props.onChoose('salud');
  root = view.render();
  assert.equal(find(root, 'DonutChart').props.chosen, 'salud');
  find(root, 'MonthBars').props.onSelect('2026-08');
  root = view.render();
  assert.equal(title(root), 'Agosto de 2026', 'a bar opens its month');
  assert.equal(shownTotal(root).minor, 606);
  assert.equal(find(root, 'DonutChart').props.chosen, null);
  assert.equal(rowChoices(root), noneChosen(root));
  // Coming back to the month it was chosen in does not bring the choice back: a month change cleared it.
  find(root, 'PressFeedback', 'Volver al mes actual').props.onPress();
  root = view.render();
  assert.equal(title(root), 'Septiembre de 2026');
  assert.equal(find(root, 'DonutChart').props.chosen, null, 'cleared, not merely hidden');
});

test('24UX6C2: the choice resets when the currency changes, even to a currency with the same category', () => {
  const view = routeHarness('(tabs)/reports.tsx', { month: '2026-08' });
  let root = view.render();
  assert.equal(shownTotal(root).currency, 'ARS');
  find(root, 'DonutChart').props.onChoose('salud');
  root = view.render();
  assert.equal(find(root, 'DonutChart').props.chosen, 'salud');
  find(root, 'DisplayCurrencyButton').props.onCurrency('USD');
  root = view.render();
  assert.equal(shownTotal(root).currency, 'USD');
  assert.equal(shownTotal(root).minor, 999);
  assert.ok(keysOf(root).includes('salud'), 'USD in August has «Salud» too');
  assert.equal(find(root, 'DonutChart').props.chosen, null, 'another currency starts with no category chosen');
  assert.equal(rowChoices(root), noneChosen(root));
  find(root, 'DisplayCurrencyButton').props.onCurrency('ARS');
  root = view.render();
  assert.equal(shownTotal(root).currency, 'ARS');
  assert.equal(find(root, 'DonutChart').props.chosen, null, 'back in ARS the earlier choice stays cleared');
});

test('24UX6C2: the donut\'s share is the rows\' own formatter over the report\'s exact total, with its spoken twin', () => {
  for (const locale of ['es-AR', 'en-AR', 'en-US'] as AppLocale[]) {
    const root = routeHarness('(tabs)/reports.tsx', { currency: 'ARS', month: '2026-08' }, snapshot, { locale }).render();
    const donut = find(root, 'DonutChart');
    const bound = bindLocale(locale);
    for (const value of [101, 303, 606]) {
      const expected = reportPresentation.spendingShare(value, 606, locale);
      const share = donut.props.shareOf(value);
      assert.equal(share.label, expected.label, locale + ': the centre\'s percentage is the rows\' label for ' + value);
      assert.equal(share.spoken, bound.spokenPercent(expected.fraction), locale + ': VoiceOver hears the spoken twin');
    }
    // The rows divide by the same total.
    for (const [index, item] of root.props.data.entries()) {
      assert.equal(find(root.props.renderItem({ item, index }), 'CategoryLegendRow').props.totalMinor, 606);
    }
  }
  // English in Argentina shows «16,7%» but speaks «16.7%».
  const english = find(routeHarness('(tabs)/reports.tsx', { currency: 'ARS', month: '2026-08' }, snapshot, { locale: 'en-AR' }).render(), 'DonutChart');
  assert.doesNotMatch(english.props.shareOf(101).spoken, /,/, 'never the visible, region-formatted percent');
});

test('24UX6C2: the «Otras» slice can be chosen without marking any category row', () => {
  const amounts = [600, 500, 400, 300, 200, 100];
  const sixCategories = { ...snapshot, entries: amounts.map((amountMinor, index) =>
    ({ ...snapshot.entries[0], id: 'six-' + index, category: 'Categoría ' + index, dateISO: '2026-09-0' + (index + 1), amountMinor })) };
  const view = routeHarness('(tabs)/reports.tsx', { currency: 'ARS' }, sixCategories);
  let root = view.render();
  const slices = find(root, 'DonutChart').props.slices as { key: string; value: number }[];
  assert.equal(slices.length, 5);
  assert.equal(slices[4].key, ' others');
  assert.equal(slices[4].value, 300, 'the two smallest categories, grouped');
  assert.equal(root.props.data.length, 6, 'every category keeps its own row');
  find(root, 'DonutChart').props.onChoose(' others');
  root = view.render();
  assert.equal(find(root, 'DonutChart').props.chosen, ' others');
  assert.equal(rowChoices(root), noneChosen(root), '«Otras» is not one category, so no row is marked');
  assert.equal(find(root, 'DonutChart').props.shareOf(300).label, reportPresentation.spendingShare(300, 2100, 'es-AR').label);
  assert.equal(shownTotal(root).minor, 2100);
});

test('24UX6C2 review: the choice resets when the display mode changes, through the chip or on Inicio, and stays cleared on the way back', () => {
  // A synthetic rate book for August, so the consolidated month is complete and keeps its donut.
  const book = domain.rateBook([
    { base: 'USD', quote: 'ARS', rate: '1000', effectiveDate: '2026-08-10', source: 'Frankfurter', fetchedAt: '2026-09-01T00:00:00.000Z' },
    { base: 'USD', quote: 'ARS', rate: '1000', effectiveDate: '2026-08-31', source: 'Frankfurter', fetchedAt: '2026-09-01T00:00:00.000Z' },
  ]);
  const display = displayCurrency.createDisplayCurrencyStore(memoryPreferences({ [displayCurrency.DISPLAY_CURRENCY_KEY]: 'ARS' }).store);
  const view = routeHarness('(tabs)/reports.tsx', { month: '2026-08' }, snapshot, { display, book });
  // The consolidated August is complete (every rate known), so its donut is drawn in both modes.
  const chosenIn = (root: any) => find(root, 'DonutChart').props.chosen;
  let root = view.render();
  assert.equal(find(root, 'DisplayCurrencyButton').props.mode, 'single');
  find(root, 'DonutChart').props.onChoose('salud');
  root = view.render();
  assert.equal(find(root, 'DonutChart').props.chosen, 'salud');
  // The chip: «Total · ARS» (every account converted), then back to «Solo ARS».
  find(root, 'DisplayCurrencyButton').props.onMode('consolidated');
  root = view.render();
  assert.equal(find(root, 'DisplayCurrencyButton').props.mode, 'consolidated');
  assert.equal(shownTotal(root).currency, 'ARS', 'the same currency: only the mode changed');
  assert.equal(chosenIn(root), null, 'the consolidated view starts with no category chosen');
  find(root, 'DisplayCurrencyButton').props.onMode('single');
  root = view.render();
  assert.equal(find(root, 'DisplayCurrencyButton').props.mode, 'single');
  assert.equal(shownTotal(root).minor, 606, 'back in «Solo ARS», the month\'s own total');
  assert.equal(find(root, 'DonutChart').props.chosen, null, 'back in the mode it was chosen in, the choice stays cleared');
  assert.equal(rowChoices(root), noneChosen(root));
  // The same mode change made on Inicio through the shared preference (Reportes stays mounted and only re-renders).
  find(root, 'DonutChart').props.onChoose('salud');
  root = view.render();
  assert.equal(find(root, 'DonutChart').props.chosen, 'salud');
  display.setMode('consolidated');
  root = view.render();
  assert.equal(find(root, 'DisplayCurrencyButton').props.mode, 'consolidated');
  assert.equal(chosenIn(root), null);
  display.setMode('single');
  root = view.render();
  assert.equal(find(root, 'DisplayCurrencyButton').props.mode, 'single');
  assert.equal(find(root, 'DonutChart').props.chosen, null, 'cleared by the mode change itself, not merely hidden while it lasted');
  assert.equal(rowChoices(root), noneChosen(root));
});

test('24UX6C2 review: a display currency chosen on Inicio clears the choice on Reportes, and switching back does not restore it', () => {
  const display = displayCurrency.createDisplayCurrencyStore(memoryPreferences({ [displayCurrency.DISPLAY_CURRENCY_KEY]: 'ARS' }).store);
  const view = routeHarness('(tabs)/reports.tsx', { month: '2026-08' }, snapshot, { display });
  let root = view.render();
  assert.equal(shownTotal(root).currency, 'ARS');
  find(root, 'DonutChart').props.onChoose('salud');
  root = view.render();
  assert.equal(find(root, 'DonutChart').props.chosen, 'salud');
  // Inicio writes the shared preference directly (its own chip); Reportes never sees its onCurrency handler run.
  display.set('USD');
  root = view.render();
  assert.equal(shownTotal(root).currency, 'USD');
  assert.equal(shownTotal(root).minor, 999);
  assert.ok(keysOf(root).includes('salud'), 'USD in August has «Salud» too');
  assert.equal(find(root, 'DonutChart').props.chosen, null, 'another currency starts with no category chosen');
  assert.equal(rowChoices(root), noneChosen(root));
  display.set('ARS');
  root = view.render();
  assert.equal(shownTotal(root).currency, 'ARS');
  assert.equal(shownTotal(root).minor, 606);
  assert.equal(find(root, 'DonutChart').props.chosen, null, 'back in ARS the earlier choice stays cleared');
  assert.equal(rowChoices(root), noneChosen(root));
});

test('24UX6C2 review: a route parameter that changes the month clears the choice, and returning to the month does not restore it', () => {
  // The route parameters as expo-router hands them to a mounted screen: the same object, a new month.
  const params: Record<string, unknown> = { currency: 'ARS', month: '2026-08' };
  const view = routeHarness('(tabs)/reports.tsx', params, withSeptember);
  const title = (root: any) => texts(root.props.ListHeaderComponent).find(text => /^(Agosto|Septiembre) de 2026$/.test(text));
  let root = view.render();
  assert.equal(title(root), 'Agosto de 2026');
  find(root, 'DonutChart').props.onChoose('salud');
  root = view.render();
  assert.equal(find(root, 'DonutChart').props.chosen, 'salud');
  params.month = '2026-09';
  root = view.render();
  assert.equal(title(root), 'Septiembre de 2026');
  assert.equal(shownTotal(root).minor, 400);
  assert.ok(keysOf(root).includes('salud'), 'September has «Salud» too');
  assert.equal(find(root, 'DonutChart').props.chosen, null, 'a linked month starts with no category chosen');
  assert.equal(rowChoices(root), noneChosen(root));
  params.month = '2026-08';
  root = view.render();
  assert.equal(title(root), 'Agosto de 2026');
  assert.equal(find(root, 'DonutChart').props.chosen, null, 'cleared, not merely hidden');
  assert.equal(rowChoices(root), noneChosen(root));
});

test('24UX6D: Categorías ↔ Día a día clears the choice; coming back, the donut shows the total again and no row is marked', () => {
  const view = routeHarness('(tabs)/reports.tsx', { currency: 'ARS', month: '2026-08' });
  let root = view.render();
  find(root, 'DonutChart').props.onChoose('salud');
  root = view.render();
  assert.equal(find(root, 'DonutChart').props.chosen, 'salud');
  assert.equal(rowChoices(root), keysOf(root).map(key => key + ':' + (key === 'salud')).join(','));
  find(root, 'Choices').props.onChange('days');
  root = view.render();
  assert.equal(nodes(root).some(n => n.type === 'DonutChart'), false);
  find(root, 'Choices').props.onChange('categories');
  root = view.render();
  assert.equal(find(root, 'DonutChart').props.chosen, null, 'cleared by the mode change itself, not merely hidden while it lasted');
  assert.equal(find(root, 'DonutChart').props.total, 606, 'the centre is the period total again');
  assert.equal(rowChoices(root), noneChosen(root));
});

// Producto 24T3 (A23, A24): devoluciones are negative expense lines projected by `snapshotFromArchive` from a purchase
// operation; they net in their own month and category. Synthetic fixtures, through the real projection.
const ars: domain.Account = { id: 'a', name: 'ARS de prueba', currency: 'ARS', openingMinor: 100000, createdAt };
const purchase = (id: string, amountMinor: number, category: string, dateISO: string, merchant = 'Tienda'): domain.Entry =>
  ({ id, accountId: 'a', kind: 'expense', amountMinor, merchant, category, dateISO, createdAt });
const devolucion = (id: string, target: domain.Entry, amountMinor: number, dateISO: string): domain.EntryRefund =>
  ({ id, kind: 'refund', target: { entryId: target.id }, accountId: target.accountId, currency: 'ARS', amountMinor, dateISO, voided: false, createdAt, revision: 0, updatedAt: createdAt });
const projected = (entries: domain.Entry[], operations: domain.PurchaseOperation[]): domain.LedgerSnapshot =>
  domain.snapshotFromArchive({ accounts: [ars], records: entries.map(domain.initialRecord), purchaseOperations: operations });
const rowOf = (root: Node, item: unknown, index = 0) => {
  const view = root.props.renderItem({ item, index }) as Node;
  return nodes(view).find(node => node.type === 'CategoryLegendRow' || node.type === 'DetailRow')!;
};

test('24T3 (A24): a devolución in a later month makes its category negative there: the donut draws the positive categories only, over their sum, and the centre stays the net', () => {
  const ropa = purchase('ropa', 1000, 'Ropa', '2026-08-03');
  const comida = purchase('comida', 400, 'Comida', '2026-09-10', 'Almacén');
  const data = projected([ropa, comida], [devolucion('dev-1', ropa, 700, '2026-09-05')]);
  assert.equal(data.entries.find(entry => entry.id === 'dev-1')!.amountMinor, -700, 'the real projection: a negative expense line');
  const view = routeHarness('(tabs)/reports.tsx', { currency: 'ARS' }, data);
  let root = view.render();
  const donut = find(root, 'DonutChart');
  assert.equal(donut.props.total, 400 - 700, 'the centre is the report\'s exact net, below zero');
  assert.deepEqual(donut.props.slices.map((slice: { key: string }) => slice.key), ['comida'], 'Ropa (−700) is never a slice and never folded into «Otras»');
  assert.equal(donut.props.shareOf(400).label, reportPresentation.spendingShare(400, 400, 'es-AR').label, 'shares are over the positive sum: Comida is 100 %, not 400 / −300');
  assert.deepEqual(root.props.data.map((item: domain.CategorySpending) => [item.key, item.amountMinor, item.count]), [['comida', 400, 1], ['ropa', -700, 0]],
    'the category ≤ 0 is listed, last, with no purchase counted');
  const comidaRow = rowOf(root, root.props.data[0]), ropaRow = rowOf(root, root.props.data[1], 1);
  assert.equal(comidaRow.props.totalMinor, 400, 'the rows share the donut\'s base');
  assert.equal(ropaRow.props.totalMinor, 400);
  assert.equal(comidaRow.props.countLabel, '1 gasto');
  assert.equal(ropaRow.props.countLabel, '1 devolución', 'a devolución is named as such, never «0 gastos»');
  // The history: both months have purchase lines, so both are recorded months; September's point is its net.
  const bars = find(root, 'MonthBars');
  assert.deepEqual(bars.props.points.slice(-2).map((point: { monthISO: string; amountMinor: number; count: number }) => [point.monthISO, point.amountMinor, point.count]),
    [['2026-08', 1000, 1], ['2026-09', -300, 1]]);
  // Día a día: the devolución's day is listed with its net and counted as a devolución.
  find(root, 'Choices').props.onChange('days');
  root = view.render();
  const days = root.props.data as domain.DailySpending[];
  const refundDay = days.findIndex(item => item.dateISO === '2026-09-05');
  assert.equal(days[refundDay].amountMinor, -700);
  assert.ok(rowOf(root, days[refundDay], refundDay).props.label.endsWith(' · 1 devolución'));
  // Its drill-downs list every line (they add up to the header) and count purchases and devoluciones apart.
  const category = routeHarness('report-category.tsx', { currency: 'ARS', month: '2026-09', category: 'ropa' }, data).render();
  assert.equal(category.props.entries.map((entry: domain.Entry) => entry.id).join(), 'dev-1');
  assert.equal(nodes(category).find(node => node.type === 'Money' && node.props.large)!.props.minor, -700);
  assert.ok(texts(category).includes('1 devolución'));
  assert.equal(texts(category).some(text => /0 gastos/.test(text)), false);
  const dayView = routeHarness('report-day.tsx', { currency: 'ARS', date: '2026-09-05' }, data).render();
  assert.equal(nodes(dayView).find(node => node.type === 'Money')!.props.minor, -700);
  assert.ok(texts(dayView).includes('1 devolución · ARS'));
});

test('24T3 (A24): a month made only of devoluciones gets a quiet state: no donut, the net total as a line, and why', () => {
  const ropa = purchase('ropa', 1000, 'Ropa', '2026-08-03');
  const data = projected([ropa], [devolucion('dev-1', ropa, 600, '2026-09-05')]);
  const root = routeHarness('(tabs)/reports.tsx', { currency: 'ARS' }, data).render();
  assert.equal(nodes(root).some(node => node.type === 'DonutChart'), false, 'nothing positive to draw');
  assert.ok(texts(root).includes('Sin gasto neto en este período: las devoluciones igualan o superan lo gastado.'));
  assert.equal(nodes(root.props.ListHeaderComponent).find(node => node.type === 'Money')!.props.minor, -600, 'the exact net, never clamped');
  assert.equal(rowOf(root, root.props.data[0]).props.countLabel, '1 devolución');
  // A recorded month is one with purchase lines: August is, September (only a devolución) is not, so the history still shows.
  const bars = find(root, 'MonthBars');
  assert.deepEqual(bars.props.points.slice(-2).map((point: { amountMinor: number; count: number }) => [point.amountMinor, point.count]), [[1000, 1], [-600, 0]]);
  assert.equal(root.props.data.length, 1, 'the list has its row, so «Sin gastos en este período» never shows');
  // Día a día keeps its compact total line with the same net, and the day counts its devolución.
  const view = routeHarness('(tabs)/reports.tsx', { currency: 'ARS' }, data);
  find(view.render(), 'Choices').props.onChange('days');
  const days = view.render();
  assert.equal(nodes(days.props.ListHeaderComponent).find(node => node.type === 'Money')!.props.minor, -600);
  assert.ok(rowOf(days, days.props.data[0]).props.label.endsWith(' · 1 devolución'));
});

test('24T3 (A24): a previous period that nets to zero or less gets no percentage, on Reportes or the comparison', () => {
  const july = purchase('july', 1000, 'Ropa', '2026-07-10');
  const august = purchase('aug', 100, 'Comida', '2026-08-05', 'Almacén');
  const september = purchase('sep', 300, 'Comida', '2026-09-10', 'Almacén');
  const data = projected([july, august, september], [devolucion('dev-1', july, 500, '2026-08-06')]);
  const comparison = domain.spendingComparison(data, 'ARS', '2026-09', '2026-09-12');
  assert.equal(comparison.status, 'ready');
  assert.equal(comparison.previous?.status === 'ready' && comparison.previous.expenseMinor, -400);
  const reports = routeHarness('(tabs)/reports.tsx', { currency: 'ARS' }, data).render();
  assert.equal(nodes(reports).some(node => node.type === 'DetailRow' && /Frente a/.test(node.props.label)), false, 'no «— más» row');
  const list = routeHarness('report-comparison.tsx', { currency: 'ARS', month: '2026-09' }, data).render();
  assert.ok(texts(list).includes('Más gasto registrado'));
  assert.equal(texts(list).some(text => text.includes('—')), false);
  // Ropa has only the devolución in August: its previous side opens the drill-down that lists it.
  const ropa = list.props.data.findIndex((item: domain.CategoryChange) => item.key === 'ropa');
  const rows = nodes(list.props.renderItem({ item: list.props.data[ropa] })).filter(node => node.type === 'DetailRow');
  assert.equal(rows[0].props.onPress, undefined, 'nothing this period');
  assert.equal(typeof rows[1].props.onPress, 'function', 'a side made of a devolución has lines to list');
});

test('24T3 (A24): «Tu mayor gasto» states the purchase net of its devoluciones, the amount the domain ranked', () => {
  const big = purchase('big', 900, 'Ropa', '2026-09-03');
  const data = projected([big, purchase('small', 100, 'Ropa', '2026-09-02'), purchase('food', 500, 'Comida', '2026-09-04', 'Almacén')],
    [devolucion('dev-1', big, 300, '2026-09-08')]);
  const insight = domain.spendingInsights(data, [], 'ARS', '2026-09', '2026-09-12', String).find(item => item.id.startsWith('largest:'))!;
  assert.deepEqual([insight.id, insight.amountMinor], ['largest:big', 600]);
  const shown = texts(routeHarness('(tabs)/reports.tsx', { currency: 'ARS' }, data).render());
  assert.ok(shown.some(text => text.startsWith('$ 6,00 · Ropa')), 'the net 6,00, never the gross 9,00');
  assert.equal(shown.some(text => text.startsWith('$ 9,00 · Ropa')), false);
});
