import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as domain from '@finanzapp/domain';
import * as presentation from '../src/ui/presentation.ts';
import * as reportPresentation from '../src/ui/report-presentation.ts';

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
  const componentNames = ['AppText', 'Choices', 'DetailRow', 'EmptyState', 'IconButton', 'Money', 'PressFeedback', 'SectionTitle', 'Surface', 'CategoryBadge', 'Screen'];
  const modules: Record<string, unknown> = {
    react: { useMemo: (fn: () => unknown) => fn(), useState: (initial?: unknown) => {
      const index = cursor++;
      if (!(index in state)) state[index] = initial;
      return [state[index], (value: unknown) => { state[index] = value; }];
    } },
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'react-native': { View: 'View', FlatList: 'FlatList' },
    'expo-router': { useLocalSearchParams: () => params, router: { push: (to: unknown) => pushed.push(to) } },
    '@finanzapp/domain': domain,
    '../src/storage/LedgerProvider': { useLedger: () => ({ snapshot: data }) },
    '../src/ui/components': Object.fromEntries(componentNames.map(name => [name, name])),
    '../src/ui/entry-list': { EntryList: 'EntryList' },
    '../src/ui/presentation': presentation,
    '../src/ui/report-presentation': reportPresentation,
    '../src/ui/spending-chart': { CategorySpendingRow: 'CategorySpendingRow' },
    '../src/ui/theme': { useCurrentDay: () => '2026-09-12', usePalette: () => ({ background: '#F5F6F8', surface: '#FFFFFF', accent: '#2467DC' }) },
  };
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
  const view = routeHarness('reports.tsx', { currency: 'ARS', month: '2026-08' });
  const list = view.render();
  const category = list.props.data.find((item: domain.CategorySpending) => item.key === 'salud');
  const row = list.props.renderItem({ item: category, index: 0 });
  find(row, 'CategorySpendingRow').props.onPress();
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
  const view = routeHarness('reports.tsx', { month: '2026-08', currency: 'ARS' });
  find(view.render(), 'PressFeedback', 'Volver al mes actual').props.onPress();
  const current = view.render();
  assert.equal(find(current, 'IconButton', 'Mes siguiente').props.disabled, true);
  assert.equal(find(current, 'Money').props.minor, 0);
});
test('month and currency controls update report data and enforce the available bounds', () => {
  const view = routeHarness('reports.tsx', {});
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
  const empty = routeHarness('reports.tsx', {}).render();
  assert.equal(empty.props.data.length, 0);
  assert.equal(find(empty, 'EmptyState').props.title, 'Sin gastos en este período');
  const huge = { ...snapshot, entries: snapshot.entries.slice(0, 2).map(e => ({ ...e, amountMinor: Number.MAX_SAFE_INTEGER })) };
  const overflow = routeHarness('reports.tsx', { month: '2026-08' }, huge).render();
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
