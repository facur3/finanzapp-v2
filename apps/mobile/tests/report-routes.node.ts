import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as domain from '@finanzapp/domain';
import * as presentation from '../src/ui/presentation.ts';
import * as reportPresentation from '../src/ui/report-presentation.ts';
import * as displayCurrency from '../src/ui/display-currency.ts';
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
  const rows = new Map(Object.entries(initial));
  const faults = { set: false };
  return { rows, faults, store: () => ({ getItemSync: (key: string) => rows.get(key) ?? null,
    setItemSync: (key: string, value: string) => { if (faults.set) throw new Error('disk full'); rows.set(key, value); }, removeItemSync: (key: string) => rows.delete(key) }) };
}

function routeHarness(file: string, params: Record<string, unknown>, data = snapshot, { locale = 'es-AR' as AppLocale, display = displayCurrency.createDisplayCurrencyStore(memoryPreferences().store) } = {}) {
  const i18nProvider = { useI18n: () => bindLocale(locale) };
  // The shared display currency, as the provider's hook gives it: the real store and resolution, no React context.
  const displayProvider = { useDisplayCurrency: (held: readonly domain.Currency[]) => ({ currency: displayCurrency.resolveDisplayCurrency(display.getState(), held), preferred: display.getState(), setCurrency: (currency: domain.Currency) => { display.set(currency); } }) };
  const source = readFileSync(new URL('../app/' + file, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const jsx = (type: string, props: Record<string, unknown>) => ({ type, props });
  const state: unknown[] = [];
  const deps: unknown[][] = [];
  const pushed: any[] = [];
  let cursor = 0, effectCursor = 0;
  const componentNames = ['AppText', 'Choices', 'DetailRow', 'EmptyState', 'IconButton', 'Money', 'PressFeedback', 'SectionTitle', 'Surface', 'CategoryBadge', 'Screen', 'GlyphTile'];
  const modules: Record<string, unknown> = {
    '../i18n/format': i18nFormat, '../src/i18n/format': i18nFormat, '../../src/i18n/format': i18nFormat, '../i18n/provider': i18nProvider, '../src/i18n/provider': i18nProvider, '../../src/i18n/provider': i18nProvider,
    // Effects run in place, once per change of their dependencies (a route parameter arriving), like React's after commit.
    react: { useMemo: (fn: () => unknown) => fn(), useState: (initial?: unknown) => {
      const index = cursor++;
      if (!(index in state)) state[index] = initial;
      return [state[index], (value: unknown) => { state[index] = value; }];
    }, useEffect: (fn: () => void, next?: unknown[]) => { const index = effectCursor++; const previous = deps[index];
      if (!previous || !next || next.length !== previous.length || next.some((item, i) => item !== previous[i])) { deps[index] = next ?? []; fn(); } } },
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'react-native': { View: 'View', FlatList: 'FlatList' },
    '@expo/vector-icons/Ionicons': 'Ionicons',
    'expo-router': { useLocalSearchParams: () => params, router: { push: (to: unknown) => pushed.push(to) } },
    '../src/ui/display-currency-provider': displayProvider, '../src/ui/display-currency': displayCurrency,
    '@finanzapp/domain': domain,
    '../src/storage/LedgerProvider': { useLedger: () => ({ snapshot: data, archive: { accounts: data.accounts, records: [] } }) },
    '../src/ui/charts': { DonutChart: 'DonutChart', MonthBars: 'MonthBars', OTHERS_KEY: '__others__',
      donutSlices: (items: { key: string; label: string; value: number }[]) => items.slice(0, 5).map((item, index) => ({ ...item, color: 'c' + index })) },
    '../src/ui/components': Object.fromEntries(componentNames.map(name => [name, name])),
    '../src/ui/currency-switch': { CurrencySwitch: 'CurrencySwitch' },
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
    '../src/ui/theme': { useCurrentDay: () => '2026-09-12', space: { xs: 4, s: 8, m: 12, l: 16, xl: 20, xxl: 24, xxxl: 32 },
      usePalette: () => ({ background: '#F5F6F8', surface: '#FFFFFF', primary: '#2557D6', primaryFill: '#2557D6', onPrimary: '#fff', text: '#000', secondary: '#666', tertiary: '#999', line: '#ddd', inset: '#eee', expense: '#c00', warning: '#a60', isDark: false }) },
  };
  // Tab routes live one level deeper than stack routes.
  for (const name of Object.keys(modules)) if (name.startsWith('../src/')) modules['../' + name] = modules[name];
  const module = { exports: {} as { default?: () => Node } };
  runInNewContext(code, { module, exports: module.exports, require: (name: string) => {
    if (!Object.hasOwn(modules, name)) throw new Error('Unexpected report dependency: ' + name);
    return modules[name];
  } });
  return { render: () => { cursor = 0; effectCursor = 0; return module.exports.default!(); }, pushed, display };
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
  assert.equal(find(view.render(), 'CurrencySwitch').props.value, 'ARS');
  assert.equal(find(view.render(), 'Money').props.minor, 606);
});
test('return-to-current-month works even when opened with a historical route parameter', () => {
  const view = routeHarness('(tabs)/reports.tsx', { month: '2026-08', currency: 'ARS' });
  find(view.render(), 'PressFeedback', 'Volver al mes actual').props.onPress();
  const current = view.render();
  assert.equal(find(current, 'IconButton', 'Mes siguiente').props.disabled, true);
  assert.equal(find(current, 'Money').props.minor, 0);
});
test('month and currency controls update report data and enforce the available bounds', () => {
  const view = routeHarness('(tabs)/reports.tsx', {});
  find(view.render(), 'IconButton', 'Mes anterior').props.onPress();
  let report = view.render();
  assert.equal(find(report, 'Money').props.minor, 606);
  assert.equal(find(report, 'IconButton', 'Mes anterior').props.disabled, true);
  find(report, 'CurrencySwitch').props.onChange('USD');
  report = view.render();
  assert.equal(find(report, 'Money').props.currency, 'USD');
  assert.equal(find(report, 'Money').props.minor, 999);
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
  const data = { ...snapshot, entries: [...snapshot.entries, { ...snapshot.entries[0], id: 'now', dateISO: '2026-09-10', amountMinor: 400 }] };
  const view = routeHarness('(tabs)/reports.tsx', { currency: 'ARS' }, data);
  let root = view.render();
  const bars = find(root, 'MonthBars');
  assert.deepEqual(bars.props.points.map((point: { monthISO: string; amountMinor: number }) => [point.monthISO, point.amountMinor]).slice(-2), [['2026-08', 606], ['2026-09', 400]]);
  assert.equal(bars.props.selected, '2026-09');
  assert.equal(find(root, 'DonutChart').props.total, 400);
  assert.equal(find(root, 'DonutChart').props.slices[0].key, 'salud');
  bars.props.onSelect('2026-08');
  root = view.render();
  assert.equal(find(root, 'Money').props.minor, 606);
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
  find(root, 'IconButton', 'Previous month');
  find(root, 'IconButton', 'Next month');
  assert.ok(words.includes('August 2026'));
  assert.ok(words.includes('Full month · ARS'));
  assert.ok(words.includes('Spent\u00A0·\u00A0ARS'));
  assert.equal(find(root, 'DonutChart').props.caption, 'Period total');
  assert.ok(words.includes('Your largest expense was Prueba'), 'the merchant is the person\'s own words');
  assert.ok(words.includes('Recorded income') && words.includes('Net flow'));
  assert.ok(words.includes('Compare with previous month'), 'the row opens the month before the selected one, which may be a past month');
  assert.equal(words.some(text => /Gastado|Mes anterior|Flujo neto|Tu mayor gasto|Solo movimientos/.test(text)), false, 'no Spanish copy left: ' + words.join(' | '));
  // Same numbers and the same data behind the words.
  assert.equal(find(root, 'Money').props.minor, find(es.render(), 'Money').props.minor);
  assert.equal(root.props.data.map((item: domain.CategorySpending) => item.key + ':' + item.amountMinor).join(','),
    es.render().props.data.map((item: domain.CategorySpending) => item.key + ':' + item.amountMinor).join(','));
  // Day by day: a plural count and the same drill-down route.
  nodes(root).find(n => n.type === 'Choices' && n.props.value === 'categories')!.props.onChange('days');
  const days = en.render();
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
    const data = { ...snapshot, entries: [...snapshot.entries, { ...snapshot.entries[0], id: 'big', amountMinor: 5000, dateISO }] };
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
  const control = find(root, 'CurrencySwitch');
  assert.deepEqual(control.props.currencies, ['ARS', 'USD', 'JPY']);
  assert.equal(control.props.value, 'ARS');
  assert.equal(find(root, 'Money').props.minor, 606, 'the ARS report is unchanged');
  control.props.onChange('JPY');
  root = view.render();
  assert.deepEqual({ minor: find(root, 'Money').props.minor, currency: find(root, 'Money').props.currency }, { minor: 1500, currency: 'JPY' });
  assert.equal(find(root, 'CurrencySwitch').props.value, 'JPY');
  const link = routeHarness('(tabs)/reports.tsx', { month: '2026-08', currency: 'JPY' }, data).render();
  assert.equal(find(link, 'Money').props.currency, 'JPY', 'a link naming a held currency opens it');
  assert.equal(find(routeHarness('(tabs)/reports.tsx', { month: '2026-08', currency: 'KWD' }, data).render(), 'Money').props.currency, 'ARS', 'a currency no account holds is not offered: the tab opens its first one');
});
