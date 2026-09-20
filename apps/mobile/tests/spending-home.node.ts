import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as domain from '@finanzapp/domain';
import * as presentation from '../src/ui/presentation.ts';
import * as reportPresentation from '../src/ui/report-presentation.ts';
import { monthlyEvidence } from '../src/integrations/evidence.ts';
import { integrationClient } from '../src/integrations/client.ts';

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
  const componentNames = ['AppText', 'Choices', 'DetailRow', 'EmptyState', 'IconButton', 'Money', 'PressFeedback', 'SectionTitle', 'Surface', 'CategoryBadge', 'Screen', 'EntryActions', 'EntryRow', 'ActionButton'];
  const modules: Record<string, unknown> = {
    react: { useEffect: (fn: () => unknown) => { fn(); }, useMemo: (fn: () => unknown) => fn(), useState: (initial?: unknown) => {
      const index = cursor++;
      if (!(index in state)) state[index] = initial;
      return [state[index], (value: unknown) => { state[index] = typeof value === 'function' ? (value as (current: unknown) => unknown)(state[index]) : value; }];
    } },
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'react-native': { View: 'View', FlatList: 'FlatList' },
    'react-native-reanimated': { __esModule: true, default: { View: 'Animated.View' },
      useSharedValue: (value: number) => ({ value }), withTiming: (value: number) => value,
      useAnimatedStyle: (fn: () => unknown) => fn() },
    'expo-router': { useLocalSearchParams: () => params, router: { push: (to: unknown) => pushed.push(to), navigate: (to: unknown) => pushed.push(to) } },
    '@finanzapp/domain': domain,
    '../src/storage/LedgerProvider': { useLedger: () => ({ snapshot: data }) },
    '../src/ui/components': Object.fromEntries(componentNames.map(name => [name, name])),
    '../src/ui/entry-list': { EntryList: 'EntryList' },
    '../src/ui/presentation': presentation,
    '../src/ui/report-presentation': reportPresentation,
    '../src/ui/spending-chart': { CategorySpendingRow: 'CategorySpendingRow' },
    '../src/ui/theme': { useCurrentDay: () => '2026-09-12', useReduceMotion: () => false,
      usePalette: () => ({ background: '#F5F6F8', surface: '#FFFFFF', accent: '#2467DC',
        negative: '#C73535', text: '#111111', secondary: '#666666', inset: '#EEEEEE', line: '#DDDDDD' }) },
  };
  modules['../src/ui/spending-timeline'] = { SpendingTimeline: 'SpendingTimeline', periodLabel: (p: any) => p.startISO + '–' + p.endISO };
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


const homeData = { ...snapshot, entries: [...snapshot.entries,
  { ...snapshot.entries[0], id: 'early', dateISO: '2026-09-01', amountMinor: 100 },
  { ...snapshot.entries[0], id: 'now', dateISO: '2026-09-11', amountMinor: 200 },
  { ...snapshot.entries[0], id: 'income', kind: 'income' as const, dateISO: '2026-09-12', amountMinor: 500 },
  { ...snapshot.entries[0], id: 'usd', accountId: 'u', dateISO: '2026-09-11', amountMinor: 1000 },
] };
test('Home scopes spending, recent entries, categories and actions to week and currency', () => {
  const view = routeHarness('(tabs)/index.tsx', {}, homeData);
  assert.equal(find(view.render(), 'Money').props.minor, 300);
  nodes(view.render()).find(n => n.type === 'Choices' && n.props.value === 'month')!.props.onChange('week');
  assert.equal(find(view.render(), 'Money').props.minor, 200);
  assert.deepEqual(nodes(view.render()).filter(n => n.type === 'EntryRow').map(n => n.props.entry.id), ['income','now']);
  nodes(view.render()).find(n => n.type === 'Choices' && n.props.value === 'ARS')!.props.onChange('USD');
  assert.equal(find(view.render(), 'Money').props.minor, 1000);
  assert.equal(find(view.render(), 'EntryActions').props.currency, 'USD');
  assert.equal(find(view.render(), 'CategorySpendingRow').props.totalMinor, 1000);
});
test('weekly category opens matching dates, and returning keeps the selected period', () => {
  const view = routeHarness('(tabs)/index.tsx', {}, homeData);
  nodes(view.render()).find(n => n.type === 'Choices' && n.props.value === 'month')!.props.onChange('week');
  find(view.render(), 'CategorySpendingRow').props.onPress();
  assert.equal(view.pushed[0].pathname, '/spending-detail');
  const detail = routeHarness('spending-detail.tsx', view.pushed[0].params, homeData).render();
  assert.deepEqual(detail.props.entries.map((e: domain.Entry) => e.id), ['now']);
  assert.equal(find(detail, 'Money').props.minor, 200);
  assert.equal(find(view.render(), 'Money').props.minor, 200);
});
test('empty and overflow Home never invent a chart or partial total', () => {
  const empty = routeHarness('(tabs)/index.tsx', {}).render();
  assert.equal(find(empty, 'Money').props.minor, 0);
  assert.equal(nodes(empty).some(n => n.type === 'SpendingTimeline'), false);
  const huge = { ...homeData, entries: homeData.entries.filter(e => e.id === 'early' || e.id === 'now').map(e => ({ ...e, amountMinor: Number.MAX_SAFE_INTEGER })) };
  assert.equal(nodes(routeHarness('(tabs)/index.tsx', {}, huge).render()).some(n => n.type === 'Money'), false);
});
test('expense detail rejects malformed scope and a category miss never opens all entries', () => {
  const valid = { currency: 'ARS', startISO: '2026-09-01', endISO: '2026-09-12' };
  for (const override of [{ endISO: '2026-09-13' }, { startISO: '2026-07-01' }, { category: ['salud'] }, { currency: 'EUR' }]) {
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
