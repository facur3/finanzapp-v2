import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as domain from '@finanzapp/domain';
import * as presentation from '../src/ui/presentation.ts';
import * as reportPresentation from '../src/ui/report-presentation.ts';
import * as categoryColor from '../src/ui/category-color.ts';
import { monthlyEvidence } from '../src/integrations/evidence.ts';
import { integrationClient } from '../src/integrations/client.ts';
import * as i18nFormat from '../src/i18n/format.ts';
import { bindLocale } from '../src/i18n/bind.ts';
import type { AppLocale } from '../src/i18n/locale.ts';
// Read on every render, like the live provider; a test may switch it and must restore it.
let locale: AppLocale = 'es-AR';
const i18nProvider = { useI18n: () => bindLocale(locale) };

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

function routeHarness(file: string, params: Record<string, unknown>, data = snapshot, extra: Partial<domain.LedgerArchive> = {}) {
  const source = readFileSync(new URL('../app/' + file, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const jsx = (type: string, props: Record<string, unknown>) => ({ type, props });
  const state: unknown[] = [];
  const pushed: any[] = [];
  let cursor = 0;
  const componentNames = ['AppText', 'Choices', 'DetailRow', 'EmptyState', 'IconButton', 'Money', 'PressFeedback', 'SectionTitle', 'Surface', 'CategoryBadge', 'Screen', 'EntryActions', 'EntryRow', 'ActionButton', 'GlyphTile', 'Stat'];
  const modules: Record<string, unknown> = {
    '../i18n/format': i18nFormat, '../src/i18n/format': i18nFormat, '../../src/i18n/format': i18nFormat, '../i18n/provider': i18nProvider, '../src/i18n/provider': i18nProvider, '../../src/i18n/provider': i18nProvider,
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
    '../src/storage/LedgerProvider': { useLedger: () => ({ snapshot: data, archive: { accounts: data.accounts, records: [], ...extra } }) },
    '../src/ui/components': { ...Object.fromEntries(componentNames.map(name => [name, name])), useStacked: () => false },
    '../src/ui/currency-switch': { CurrencySwitch: 'CurrencySwitch' },
    '../src/ui/entry-list': { EntryList: 'EntryList' },
    '../src/ui/presentation': presentation,
    '../src/ui/report-presentation': reportPresentation,
    '../src/ui/spending-chart': { CategorySpendingRow: 'CategorySpendingRow' },
    '../src/ui/home-modules': { BudgetHomeCard: 'BudgetHomeCard', CategoryRanking: 'CategoryRanking', MetricHelp: 'MetricHelp', UpcomingRecurringRow: 'UpcomingRecurringRow' },
    '../src/ui/category-color': categoryColor,
    '../src/ui/category-hues': { useCategoryColor: () => '#3E6FB0', useCategoryLabel: (s: string) => s, useCategoryDefinitions: () => [], useCategoryLook: (s: string) => ({ label: s, storedLabel: s, key: String(s).toLowerCase(), hex: '#3E6FB0', glyph: 'pricetag-outline' }), useCategoryLookOf: () => (s: string) => ({ label: s, storedLabel: s, key: String(s).toLowerCase(), hex: '#3E6FB0', glyph: 'pricetag-outline' }), useAccountLook: () => ({ icon: 'wallet', color: 'cobalt', glyph: 'wallet-outline', hex: '#2557D6' }), useAccountNameOf: () => (account: any) => account.name, useAccountLookOf: () => () => ({ icon: 'wallet', color: 'cobalt', glyph: 'wallet-outline', hex: '#2557D6' }) },
    '../src/ui/quick-actions': { QuickActions: 'QuickActions' },
    '../src/ui/motion': { ValueTransition: 'ValueTransition', Reflow: 'Reflow', selectionHaptic: () => {}, impactHaptic: () => {}, duration: { press: 100, release: 160, state: 200, data: 260, enter: 200, exit: 100, reveal: 480 }, timing: (kind: string, reduced: boolean) => ({ duration: reduced ? 0 : 260 }) },
    '../src/ui/theme': { useCurrentDay: () => '2026-09-12', useReduceMotion: () => false, space: { xs: 4, s: 8, m: 12, l: 16, xl: 20, xxl: 24, xxxl: 32 },
      usePalette: () => ({ background: '#F5F6F8', surface: '#FFFFFF', primary: '#2557D6', primaryFill: '#2557D6', onPrimary: '#fff', expense: '#C42F39',
        negative: '#C73535', text: '#111111', secondary: '#666666', tertiary: '#999999', inset: '#EEEEEE', line: '#DDDDDD' }) },
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
test('Home shows the current month only, scoped to the currency, with quick actions and ranked categories', () => {
  const view = routeHarness('(tabs)/index.tsx', {}, homeData);
  let root = view.render();
  assert.equal(find(root, 'Money').props.minor, 300, 'September expenses in ARS');
  assert.equal(nodes(root).some(n => n.type === 'Choices' && (n.props.value === 'month' || n.props.value === 'week')), false, 'no period control: Home is the month');
  assert.deepEqual(nodes(root).filter(n => n.type === 'EntryRow').map(n => n.props.entry.id), ['income', 'now', 'early']);
  const texts = nodes(root).filter(n => n.type === 'AppText').map(n => String(n.props.children));
  assert.equal(texts.some(text => /gastos? registrados?|–|Gastado ·/.test(text)), false, 'no count or date-range copy near the hero');
  assert.ok(texts.includes('Septiembre'), 'the month names the number');
  find(root, 'CurrencySwitch').props.onChange('USD');
  root = view.render();
  assert.equal(find(root, 'Money').props.minor, 1000);
  assert.equal(find(root, 'QuickActions').props.currency, 'USD');
  const ranking = find(root, 'CategoryRanking');
  assert.equal(ranking.props.totalMinor, 1000);
  assert.deepEqual(ranking.props.categories.map((c: domain.CategorySpending) => c.key), ['salud']);
});
test('a ranked category opens this month\'s matching expenses in the selected currency', () => {
  const view = routeHarness('(tabs)/index.tsx', {}, homeData);
  const ranking = find(view.render(), 'CategoryRanking');
  ranking.props.onPressCategory(ranking.props.categories[0]);
  assert.equal(view.pushed[0].pathname, '/spending-detail');
  assert.equal(view.pushed[0].params.startISO, '2026-09-01');
  const detail = routeHarness('spending-detail.tsx', view.pushed[0].params, homeData).render();
  assert.deepEqual(detail.props.entries.map((e: domain.Entry) => e.id), ['now', 'early']);
  assert.equal(find(detail, 'Money').props.minor, 300);
});
test('empty and overflow Home never invent a chart, budget or partial total', () => {
  const empty = routeHarness('(tabs)/index.tsx', {}).render();
  assert.equal(find(empty, 'Money').props.minor, 0);
  assert.equal(nodes(empty).some(n => n.type === 'SpendingTimeline' || n.type === 'CategoryRanking' || n.type === 'BudgetHomeCard' || n.type === 'UpcomingRecurringRow'), false);
  assert.equal(nodes(empty).some(n => n.type === 'SectionTitle' && n.props.children === 'Próximos compromisos'), false, 'no empty commitments block');
  const huge = { ...homeData, entries: homeData.entries.filter(e => e.id === 'early' || e.id === 'now').map(e => ({ ...e, amountMinor: Number.MAX_SAFE_INTEGER })) };
  assert.equal(nodes(routeHarness('(tabs)/index.tsx', {}, huge).render()).some(n => n.type === 'Money'), false);
});
test('Home keeps analysis in Reportes: no timeline bars, a Reportes link on categories and commitments only with stored rules', () => {
  const view = routeHarness('(tabs)/index.tsx', {}, homeData);
  const root = view.render();
  assert.equal(nodes(root).some(n => n.type === 'SpendingTimeline'), false);
  find(root, 'SectionTitle', 'Reportes');
  nodes(root).find(n => n.type === 'SectionTitle' && n.props.action === 'Reportes')!.props.onAction();
  assert.equal(view.pushed.at(-1).pathname, '/reports');
  assert.equal(nodes(root).some(n => n.type === 'UpcomingRecurringRow' || (n.type === 'SectionTitle' && n.props.action === 'Programar')), false, 'no commitments block without rules');
  // No disclaimer copy on screen: the definition lives behind contextual help.
  const texts = nodes(root).filter(n => n.type === 'AppText').map(n => String(n.props.children));
  assert.equal(texts.some(text => /saldo bancario|patrimonio/.test(text)), false);
  const rule = { id: 'r', kind: 'expense' as const, accountId: 'a', amountMinor: 700, merchant: 'Alquiler', category: 'Hogar', frequency: 'monthly' as const,
    nextDateISO: '2026-09-20', active: true, createdAt, revision: 0, updatedAt: createdAt };
  const withRule = routeHarness('(tabs)/index.tsx', {}, homeData, { recurring: [rule] as domain.RecurringRule[] });
  assert.equal(find(withRule.render(), 'UpcomingRecurringRow').props.rule.id, 'r');
  nodes(withRule.render()).find(n => n.type === 'SectionTitle' && n.props.action === 'Ver todos' && n.props.children === 'Próximos compromisos')!.props.onAction();
  assert.equal(withRule.pushed.at(-1), '/recurring');
  // Disponible excludes a card account's negative balance.
  const withCard = { ...homeData, accounts: [...homeData.accounts, { id: 'card-acc', name: 'Visa', currency: 'ARS' as const, openingMinor: -5000, createdAt }] };
  const cardView = routeHarness('(tabs)/index.tsx', {}, withCard, { cards: [{ id: 'card', accountId: 'card-acc', issuer: '', last4: '', creditLimitMinor: null,
    closingDay: 1, dueDay: 10, active: true, createdAt, revision: 0, updatedAt: createdAt }] });
  nodes(cardView.render()).find(n => n.type === 'Choices' && n.props.value === 'spending')!.props.onChange('available');
  // Account "a": opening 10000, expenses 101 + 202 + 303 + 100 + 200, income 500. The card's −5000 is excluded.
  assert.equal(find(cardView.render(), 'Money').props.minor, 10000 - 101 - 202 - 303 - 100 - 200 + 500);
  assert.equal(nodes(cardView.render()).some(n => n.type === 'AppText' && /saldo bancario|patrimonio/.test(String(n.props.children))), false);
  assert.equal(find(cardView.render(), 'MetricHelp').props.title, 'Disponible');
});
test('24B1: Disponible for a currency held only by a card is a true US$ 0,00, never a dropped total', () => {
  const cardOnly = { ...homeData, accounts: [homeData.accounts[0], { id: 'usd-card', name: 'Visa USD', currency: 'USD' as const, openingMinor: -5000, createdAt }] };
  const view = routeHarness('(tabs)/index.tsx', {}, cardOnly, { cards: [{ id: 'card', accountId: 'usd-card', issuer: '', last4: '', creditLimitMinor: null,
    closingDay: 1, dueDay: 10, active: true, createdAt, revision: 0, updatedAt: createdAt }] });
  assert.deepEqual(presentation.availableCurrencies(cardOnly.accounts), ['ARS', 'USD'], 'the card account still makes USD a currency of the ledger');
  nodes(view.render()).find(n => n.type === 'Choices' && n.props.value === 'spending')!.props.onChange('available');
  find(view.render(), 'CurrencySwitch').props.onChange('USD');
  const money = find(view.render(), 'Money');
  assert.deepEqual({ minor: money.props.minor, currency: money.props.currency }, { minor: 0, currency: 'USD' });
  assert.equal(i18nFormat.moneyText(0, 'USD'), 'US$\u00A00,00');
  assert.deepEqual(domain.liquidTotalsByCurrency(cardOnly, [{ id: 'card', accountId: 'usd-card', issuer: '', last4: '', creditLimitMinor: null,
    closingDay: 1, dueDay: 10, active: true, createdAt, revision: 0, updatedAt: createdAt }]), { ARS: 10000 - 101 - 202 - 303 - 100 - 200 + 500 }, 'no liquid USD account: no USD key, so Home shows a true zero');
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

test('Home shows the budget module for a general budget alone, for sublimits alone, and never for archived budgets', () => {
  const createdAt = '2026-09-01T12:00:00.000Z';
  const total: domain.MonthlyBudget = { id: 'total', scope: 'total', currency: 'ARS', monthISO: '2026-09', amountMinor: 100000, active: true, createdAt, revision: 0, updatedAt: createdAt };
  const sublimit: domain.MonthlyBudget = { id: 'salud', scope: 'category', category: 'Salud', currency: 'ARS', monthISO: '2026-09', amountMinor: 1000, active: true, createdAt, revision: 0, updatedAt: createdAt };
  const withTotal = routeHarness('(tabs)/index.tsx', {}, homeData, { budgets: [total] }).render();
  const card = nodes(withTotal).find(n => n.type === 'BudgetHomeCard')!;
  assert.ok(card, 'a general budget alone is enough for the module');
  assert.equal(card.props.summary.total.budget.id, 'total');
  assert.equal(card.props.summary.total.spentMinor, 300, 'all September ARS expenses');
  assert.deepEqual(card.props.summary.rows, []);
  const withSublimit = routeHarness('(tabs)/index.tsx', {}, homeData, { budgets: [sublimit] }).render();
  assert.equal(nodes(withSublimit).find(n => n.type === 'BudgetHomeCard')!.props.summary.total, null);
  const archived = routeHarness('(tabs)/index.tsx', {}, homeData, { budgets: [{ ...total, active: false, revision: 1, updatedAt: '2026-09-02T12:00:00.000Z' }] }).render();
  assert.equal(nodes(archived).some(n => n.type === 'BudgetHomeCard'), false);
  assert.equal(nodes(archived).some(n => n.type === 'SectionTitle' && n.props.children === 'Presupuesto del mes'), false);
});

test('23.1B1: Home in English keeps the same numbers and routes; only words change, and the language can switch in place', () => {
  const view = routeHarness('(tabs)/index.tsx', {}, homeData);
  const spanish = view.render();
  locale = 'en-AR';
  try {
    const root = view.render();
    assert.equal(find(root, 'Money').props.minor, find(spanish, 'Money').props.minor, 'the figure never depends on the language');
    const metric = nodes(root).find(n => n.type === 'Choices' && n.props.value === 'spending')!;
    assert.equal(metric.props.options.map((option: any) => option.label).join(','), 'Spending,Available');
    const texts = nodes(root).filter(n => n.type === 'AppText').map(n => String(n.props.children));
    assert.ok(texts.includes('September'), 'the month is named in English');
    const titles = nodes(root).filter(n => n.type === 'SectionTitle').map(n => String(n.props.children) + '|' + n.props.action);
    assert.ok(titles.includes('Where your money went|Reports'), titles.join(' / '));
    assert.ok(titles.includes('Latest transactions|See all'), titles.join(' / '));
    metric.props.onChange('available');
    const available = view.render();
    const help = find(available, 'MetricHelp');
    assert.equal(help.props.title, 'Available');
    assert.match(help.props.detail, /^The money recorded in your accounts/);
    assert.ok(nodes(available).some(n => n.type === 'AppText' && String(n.props.children) === '1 account'), 'plural of the account count');
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
  const control = find(root, 'CurrencySwitch');
  assert.deepEqual(control.props.currencies, ['ARS', 'USD', 'JPY'], 'the currencies present, ARS and USD first, then by code');
  assert.equal(control.props.labels, 'code', 'Inicio keeps the compact codes beside the metric control');
  assert.equal(control.props.value, 'ARS');
  assert.equal(find(root, 'Money').props.minor, 300, 'ARS figures unchanged by the third currency');
  control.props.onChange('JPY');
  root = view.render();
  assert.deepEqual({ minor: find(root, 'Money').props.minor, currency: find(root, 'Money').props.currency }, { minor: 2200, currency: 'JPY' }, 'yen are summed as yen, never as cents');
  assert.equal(find(root, 'QuickActions').props.currency, 'JPY');
  assert.deepEqual(nodes(root).filter(n => n.type === 'EntryRow').map(n => n.props.entry.id), ['yen-2', 'yen-1'], 'only the yen movements');
  assert.deepEqual(find(root, 'CategoryRanking').props.categories.map((c: domain.CategorySpending) => [c.key, c.amountMinor]), [['comida', 1500], ['salud', 700]]);
  assert.equal(find(root, 'CategoryRanking').props.currency, 'JPY');
});
