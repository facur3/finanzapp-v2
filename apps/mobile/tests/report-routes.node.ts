import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as domain from '@finanzapp/domain';
import * as presentation from '../src/ui/presentation.ts';
import * as reportPresentation from '../src/ui/report-presentation.ts';
import * as categoryColor from '../src/ui/category-color.ts';
import * as liabilityPresentation from '../src/ui/liability-presentation.ts';

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

function routeHarness(file: string, params: Record<string, unknown>, data = snapshot) {
  const source = readFileSync(new URL('../app/' + file, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const jsx = (type: string, props: Record<string, unknown>) => ({ type, props });
  const state: unknown[] = [];
  const pushed: any[] = [];
  let cursor = 0;
  const componentNames = ['AppText', 'Choices', 'DetailRow', 'EmptyState', 'IconButton', 'Money', 'PressFeedback', 'SectionTitle', 'Surface', 'CategoryBadge', 'Screen', 'GlyphTile'];
  const modules: Record<string, unknown> = {
    react: { useMemo: (fn: () => unknown) => fn(), useState: (initial?: unknown) => {
      const index = cursor++;
      if (!(index in state)) state[index] = initial;
      return [state[index], (value: unknown) => { state[index] = value; }];
    } },
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'react-native': { View: 'View', FlatList: 'FlatList' },
    '@expo/vector-icons/Ionicons': 'Ionicons',
    'expo-router': { useLocalSearchParams: () => params, router: { push: (to: unknown) => pushed.push(to) } },
    '@finanzapp/domain': domain,
    '../src/storage/LedgerProvider': { useLedger: () => ({ snapshot: data, archive: { accounts: data.accounts, records: [] } }) },
    '../src/ui/charts': { DonutChart: 'DonutChart', MonthBars: 'MonthBars', OTHERS_KEY: '__others__',
      donutSlices: (items: { key: string; label: string; value: number }[]) => items.slice(0, 5).map((item, index) => ({ ...item, color: 'c' + index })) },
    '../src/ui/components': Object.fromEntries(componentNames.map(name => [name, name])),
    '../src/ui/entry-list': { EntryList: 'EntryList' },
    '../src/ui/presentation': presentation,
    '../src/ui/report-presentation': reportPresentation,
    '../src/ui/spending-chart': { CategorySpendingRow: 'CategorySpendingRow', CategoryLegendRow: 'CategoryLegendRow' },
    '../src/ui/liability-presentation': liabilityPresentation,
    '../src/ui/category-color': categoryColor,
    '../src/ui/category-hues': { useCategoryColor: () => '#3E6FB0' },
    '../src/ui/quick-actions': { QuickActions: 'QuickActions' },
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
  return { render: () => { cursor = 0; return module.exports.default!(); }, pushed };
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
  assert.equal(find(view.render(), 'Choices').props.value, 'ARS');
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
  find(report, 'Choices').props.onChange('USD');
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
