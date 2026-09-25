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

/** The shared display currency of Inicio and Reportes (24B6), on the real store over a key-value store in memory; a test may hand one store to two screens. */
function displayStore(initial: Record<string, string> = {}) {
  const rows = new Map(Object.entries(initial));
  return displayCurrency.createDisplayCurrencyStore(() => ({ getItemSync: (key: string) => rows.get(key) ?? null, setItemSync: (key: string, value: string) => { rows.set(key, value); }, removeItemSync: (key: string) => rows.delete(key) }));
}

function routeHarness(file: string, params: Record<string, unknown>, initialData = snapshot, extra: Partial<domain.LedgerArchive> = {}, display = displayStore()) {
  // The ledger as the provider hands it; `setData` stands for a write landing while the screen stays mounted.
  let data = initialData;
  const displayProvider = { useDisplayCurrency: (held: readonly domain.Currency[]) => ({ currency: displayCurrency.resolveDisplayCurrency(display.getState(), held), preferred: display.getState(), setCurrency: (currency: domain.Currency) => { display.set(currency); } }) };
  const source = readFileSync(new URL('../app/' + file, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const jsx = (type: string, props: Record<string, unknown>) => ({ type, props });
  const state: unknown[] = [];
  const deps: unknown[][] = [];
  const pushed: any[] = [];
  let cursor = 0, effectCursor = 0;
  const componentNames = ['AppText', 'Choices', 'DetailRow', 'EmptyState', 'IconButton', 'Money', 'PressFeedback', 'SectionTitle', 'Surface', 'CategoryBadge', 'Screen', 'EntryActions', 'EntryRow', 'ActionButton', 'GlyphTile', 'Stat', 'NavigationRow'];
  const modules: Record<string, unknown> = {
    '../i18n/format': i18nFormat, '../src/i18n/format': i18nFormat, '../../src/i18n/format': i18nFormat, '../i18n/provider': i18nProvider, '../src/i18n/provider': i18nProvider, '../../src/i18n/provider': i18nProvider,
    // Effects run in place, once per change of their dependencies (a route parameter arriving), like React's after commit.
    react: { useEffect: (fn: () => void, next?: unknown[]) => { const index = effectCursor++; const previous = deps[index];
      if (!previous || !next || next.length !== previous.length || next.some((item, i) => item !== previous[i])) { deps[index] = next ?? []; fn(); } },
    useMemo: (fn: () => unknown) => fn(), useState: (initial?: unknown) => {
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
    '../src/ui/display-currency-provider': displayProvider, '../src/ui/display-currency': displayCurrency,
    '../src/ui/entry-list': { EntryList: 'EntryList' },
    '../src/ui/presentation': presentation,
    '../src/ui/report-presentation': reportPresentation,
    '../src/ui/spending-chart': { CategorySpendingRow: 'CategorySpendingRow', CategoryLegendRow: 'CategoryLegendRow' },
    '../src/ui/charts': { DonutChart: 'DonutChart', MonthBars: 'MonthBars', OTHERS_KEY: '__others__',
      donutSlices: (items: { key: string; label: string; value: number }[]) => items.slice(0, 5).map((item, index) => ({ ...item, color: 'c' + index })) },
    '../src/ui/budget-presentation': budgetPresentation,
    '@expo/vector-icons/Ionicons': 'Ionicons',
    '../src/ui/home-modules': { BudgetHomeCard: 'BudgetHomeCard', CategoryRanking: 'CategoryRanking', MetricHelp: 'MetricHelp', UpcomingRecurringRow: 'UpcomingRecurringRow' },
    '../src/ui/category-color': categoryColor,
    '../src/ui/category-hues': { useCategoryColor: () => '#3E6FB0', useCategoryLabel: (s: string) => s, useCategoryDefinitions: () => [], useCategoryLook: (s: string) => ({ label: s, storedLabel: s, key: String(s).toLowerCase(), hex: '#3E6FB0', glyph: 'pricetag-outline' }), useCategoryLookOf: () => (s: string) => ({ label: s, storedLabel: s, key: String(s).toLowerCase(), hex: '#3E6FB0', glyph: glyphAliases.get(s) ?? 'glyph-' + String(s).toLowerCase() }), useAccountLook: () => ({ icon: 'wallet', color: 'cobalt', glyph: 'wallet-outline', hex: '#2557D6' }), useAccountNameOf: () => (account: any) => account.name, useAccountLookOf: () => () => ({ icon: 'wallet', color: 'cobalt', glyph: 'wallet-outline', hex: '#2557D6' }) },
    '../src/ui/quick-actions': { QuickActions: 'QuickActions', AssistantEntry: 'AssistantEntry' },
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
  return { render: () => { cursor = 0; effectCursor = 0; return module.exports.default!(); }, pushed, display, setData: (next: domain.LedgerSnapshot) => { data = next; } };
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
    assert.ok(titles.includes('By category|Reports'), titles.join(' / '));
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

// ---- Producto 24B6: one display currency shared by Inicio and Reportes ------------------------------------

test('24B6: choosing a currency on Inicio changes Reportes and choosing on Reportes changes Inicio, through one persisted preference; a switch within either screen keeps working', () => {
  const rows = new Map<string, string>();
  const shared = displayCurrency.createDisplayCurrencyStore(() => ({ getItemSync: (key: string) => rows.get(key) ?? null, setItemSync: (key: string, value: string) => { rows.set(key, value); }, removeItemSync: (key: string) => rows.delete(key) }));
  const home = routeHarness('(tabs)/index.tsx', {}, homeData, {}, shared);
  const reports = routeHarness('(tabs)/reports.tsx', {}, homeData, {}, shared);
  assert.equal(find(home.render(), 'CurrencySwitch').props.value, 'ARS', 'no preference yet: the first currency held');
  assert.equal(find(reports.render(), 'CurrencySwitch').props.value, 'ARS');
  find(home.render(), 'CurrencySwitch').props.onChange('USD');
  assert.equal(find(home.render(), 'Money').props.currency, 'USD');
  assert.equal(find(reports.render(), 'CurrencySwitch').props.value, 'USD', 'Reportes follows Inicio without being told');
  assert.equal(find(reports.render(), 'Money').props.currency, 'USD');
  assert.equal(rows.get(displayCurrency.DISPLAY_CURRENCY_KEY), 'USD', 'persisted outside the ledger, under its own key');
  find(reports.render(), 'CurrencySwitch').props.onChange('ARS');
  assert.equal(find(home.render(), 'CurrencySwitch').props.value, 'ARS', 'and Inicio follows Reportes');
  assert.equal(find(home.render(), 'Money').props.minor, 300);
  assert.equal(rows.get(displayCurrency.DISPLAY_CURRENCY_KEY), 'ARS');
  // A screen mounted later reads the same preference.
  const later = routeHarness('(tabs)/reports.tsx', {}, homeData, {}, shared);
  assert.equal(find(later.render(), 'CurrencySwitch').props.value, 'ARS');
  // Reportes' month and view stay its own: switching the currency changes neither.
  nodes(reports.render()).find(n => n.type === 'Choices' && n.props.value === 'categories')!.props.onChange('days');
  find(reports.render(), 'CurrencySwitch').props.onChange('USD');
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
  assert.equal(nodes(root).some(n => n.type === 'CurrencySwitch'), false, 'one currency: no switch');
  assert.equal(rows.get(displayCurrency.DISPLAY_CURRENCY_KEY), 'USD', 'the preference is not rewritten; nothing else is touched');
  const reports = routeHarness('(tabs)/reports.tsx', {}, onlyPesos, {}, displayCurrency.createDisplayCurrencyStore(preferences));
  assert.equal(find(reports.render(), 'Money').props.currency, 'ARS');
  assert.equal(nodes(reports.render()).some(n => n.type === 'CurrencySwitch'), false);
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
  assert.equal(find(home.render(), 'CurrencySwitch').props.value, 'USD', 'Inicio agrees');
  // The switch on the linked screen still wins afterwards: the parameter is applied once, not on every render.
  find(linked.render(), 'CurrencySwitch').props.onChange('ARS');
  assert.equal(find(linked.render(), 'Money').props.currency, 'ARS');
  assert.equal(find(linked.render(), 'Money').props.currency, 'ARS', 'a re-render does not re-apply the link');
  assert.equal(shared.getState(), 'ARS');
  for (const currency of ['usd', 'XAU', 'ZZZ', 'EUR', 'KWD', '', ['USD'], 42]) {
    const bad = routeHarness('(tabs)/reports.tsx', { currency, month: '2026-08' }, homeData, {}, shared);
    assert.equal(find(bad.render(), 'Money').props.currency, 'ARS', 'invalid ' + JSON.stringify(currency) + ': the shared choice');
    assert.equal(shared.getState(), 'ARS', 'invalid ' + JSON.stringify(currency) + ': not overwritten');
    assert.equal(rows.get(displayCurrency.DISPLAY_CURRENCY_KEY), 'ARS');
  }
  // Inicio's own link to Reportes carries the currency it shows, so the two agree even on a phone that never stored a choice.
  const fresh = displayCurrency.createDisplayCurrencyStore(() => ({ getItemSync: () => null, setItemSync: () => {}, removeItemSync: () => false }));
  const origin = routeHarness('(tabs)/index.tsx', {}, homeData, {}, fresh);
  find(origin.render(), 'CurrencySwitch').props.onChange('USD');
  nodes(origin.render()).find(n => n.type === 'SectionTitle' && n.props.action === 'Reportes')!.props.onAction();
  assert.equal(JSON.stringify(origin.pushed.at(-1)), JSON.stringify({ pathname: '/reports', params: { currency: 'USD' } }));
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
  assert.deepEqual(find(root, 'CurrencySwitch').props.currencies, ['ARS', 'USD', 'EUR']);
  const home = routeHarness('(tabs)/index.tsx', {}, withEuro, {}, shared);
  assert.equal(find(home.render(), 'CurrencySwitch').props.value, 'EUR', 'Inicio follows');
  // The switch on Reportes wins from now on, and an unrelated ledger change does not re-impose the link.
  find(reports.render(), 'CurrencySwitch').props.onChange('USD');
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
  find(home.render(), 'CurrencySwitch').props.onChange('ARS');
  assert.equal(find(reports.render(), 'Money').props.currency, 'ARS');
  const later = routeHarness('(tabs)/reports.tsx', {}, withEuro, {}, shared);
  assert.equal(find(later.render(), 'CurrencySwitch').props.value, 'ARS', 'a Reportes mounted later reads the same choice');
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
  find(direct.render(), 'CurrencySwitch').props.onChange('EUR');
  direct.setData(more);
  assert.equal(find(direct.render(), 'Money').props.currency, 'EUR');
  assert.equal(shared.getState(), 'EUR');
});

// ---- 24UX2: Home refinement --------------------------------------------------------------------------------------

const homeTexts = (root: Node) => nodes(root).filter(node => node.type === 'AppText').map(node => [node.props.children].flat().join(''));
const sectionTitles = (root: Node) => nodes(root).filter(node => node.type === 'SectionTitle').map(node => node.props.children);

test('24UX2: a month with nothing recorded in the currency says so once, under Últimos movimientos, with the currency when several are held', () => {
  // The fixture's movements are all in August; the harness day is 2026-09-12.
  const root = routeHarness('(tabs)/index.tsx', {}, snapshot).render();
  assert.equal(sectionTitles(root).join('|'), 'Últimos movimientos', 'no second empty section');
  const shown = homeTexts(root);
  assert.ok(shown.includes('Todavía no hay movimientos en ARS este mes.'));
  assert.equal(shown.some(text => /Tus categorías aparecerán/.test(text)), false, 'the near-identical sentence is gone');
  // One currency: the plain sentence.
  const single = { ...snapshot, accounts: [snapshot.accounts[0]], entries: snapshot.entries.filter(entry => entry.accountId === 'a') };
  assert.ok(homeTexts(routeHarness('(tabs)/index.tsx', {}, single).render()).includes('Todavía no hay movimientos este mes.'));
  // Only an income this month: the categories block stays, with its own sentence, because there is a movement to list.
  const incomeOnly = { ...single, entries: [...single.entries, { ...snapshot.entries[0], id: 'pay', kind: 'income' as const, category: 'Sueldo', dateISO: '2026-09-10' }] };
  const withIncome = routeHarness('(tabs)/index.tsx', {}, incomeOnly).render();
  assert.equal(sectionTitles(withIncome).join('|'), 'En qué gastaste|Últimos movimientos');
  assert.ok(homeTexts(withIncome).includes('Tus categorías aparecerán cuando registres un gasto este mes.'));
});

test('24UX5 review: Home rows name the account only when the visible rows of that list come from more than one account', () => {
  const at = '2026-09-10T12:00:00Z';
  const accounts: domain.Account[] = [{ id: 'a', name: 'a', currency: 'ARS', openingMinor: 0, createdAt: at }, { id: 'b', name: 'Banco', currency: 'ARS', openingMinor: 0, createdAt: at }];
  const entry = (id: string, accountId: string, merchant: string, category: string): domain.Entry => ({ id, accountId, kind: 'expense', amountMinor: 100, merchant, category, dateISO: '2026-09-10', createdAt: at });
  const shown = (root: Node, type: string) => nodes(root).filter(node => node.type === type).map(node => node.props.showAccount);
  // The owner's screenshot: two ARS accounts owned, every visible movement in «a» → «Restaurantes · a · Hoy» on each row. No more.
  const oneVisible = { accounts, entries: [entry('1', 'a', 'Parrilla', 'Restaurantes'), entry('2', 'a', 'Coto', 'Supermercado')] };
  assert.equal(shown(routeHarness('(tabs)/index.tsx', {}, oneVisible).render(), 'EntryRow').join(), 'false,false');
  // Two accounts among the visible rows: each row names its own.
  const twoVisible = { accounts, entries: [...oneVisible.entries, entry('3', 'b', 'Farmacia', 'Salud')] };
  assert.equal(shown(routeHarness('(tabs)/index.tsx', {}, twoVisible).render(), 'EntryRow').join(), 'true,true,true');
  // Ambiguous names keep their category either way ("f", "aa").
  const ambiguous = { accounts, entries: [entry('4', 'a', 'f', 'Comida'), entry('5', 'a', 'aa', 'Hogar'), entry('6', 'a', 'Carrefour', 'Supermercado')] };
  const rows = nodes(routeHarness('(tabs)/index.tsx', {}, ambiguous).render()).filter(node => node.type === 'EntryRow');
  assert.equal(rows.map(row => row.props.entry.merchant + ':' + row.props.showCategory + ':' + row.props.showAccount).sort().join(), 'Carrefour:false:false,aa:true:false,f:true:false');
  // Próximos compromisos decides on its own rows, independently of the movements; amounts and dates are untouched.
  const rule = (id: string, accountId: string, merchant = 'Netflix'): domain.RecurringRule => ({ id, accountId, kind: 'expense', amountMinor: 4321, merchant, category: 'Suscripciones',
    frequency: 'monthly', anchorDateISO: '2026-09-20', nextDateISO: '2026-09-20', active: true, deleted: false, createdAt: at, revision: 0, updatedAt: at });
  let root = routeHarness('(tabs)/index.tsx', {}, twoVisible, { recurring: [rule('r1', 'a'), rule('r2', 'a', 'aa')] }).render();
  assert.equal(shown(root, 'UpcomingRecurringRow').join(), 'false,false', 'both rules in one account, even though the movements span two');
  assert.equal(shown(root, 'EntryRow').join(), 'true,true,true');
  const upcoming = nodes(root).filter(node => node.type === 'UpcomingRecurringRow');
  assert.equal(upcoming.map(node => node.props.rule.merchant + ':' + node.props.showCategory).join(), 'aa:true,Netflix:false', '"aa" keeps its category in the agenda too');
  assert.equal(upcoming.map(node => node.props.rule.amountMinor + '@' + node.props.rule.nextDateISO).join(), '4321@2026-09-20,4321@2026-09-20');
  root = routeHarness('(tabs)/index.tsx', {}, oneVisible, { recurring: [rule('r1', 'a'), rule('r2', 'b')] }).render();
  assert.equal(shown(root, 'UpcomingRecurringRow').join(), 'true,true');
  assert.equal(shown(root, 'EntryRow').join(), 'false,false');
});

test('24UX2: Home keeps its modules and adds none', () => {
  const rule: domain.RecurringRule = { id: 'r', accountId: 'a', kind: 'expense', amountMinor: 100, merchant: 'Netflix', category: 'Suscripciones', frequency: 'monthly',
    anchorDateISO: '2026-09-20', nextDateISO: '2026-09-20', active: true, deleted: false, createdAt, revision: 0, updatedAt: createdAt };
  const root = routeHarness('(tabs)/index.tsx', {}, homeData, { recurring: [rule] }).render();
  assert.equal(sectionTitles(root).join('|'), 'En qué gastaste|Próximos compromisos|Últimos movimientos');
  assert.equal(nodes(root).filter(node => node.type === 'QuickActions').length, 1);
  assert.equal(find(root, 'QuickActions').props.assistant, undefined, '24UX3: the movements are three pills; the Assistant has its own entry');
  assert.equal(nodes(root).filter(node => node.type === 'AssistantEntry').length, 1, 'the Assistant keeps its prominent entry');
  assert.equal(find(root, 'AssistantEntry').props.currency, 'ARS', 'it carries the currency Inicio shows');
  assert.equal(nodes(root).filter(node => node.type === 'Choices').length, 1, 'Gastos / Disponible');
  assert.equal(nodes(root).filter(node => node.type === 'CurrencySwitch').length, 1);
});

// ---- 24UX3: Home hierarchy ---------------------------------------------------------------------------------------

test('24UX3: a quiet header, a larger number, movements then the Assistant, quiet section links and three section shapes', () => {
  const rule: domain.RecurringRule = { id: 'r', accountId: 'a', kind: 'expense', amountMinor: 100, merchant: 'Netflix', category: 'Suscripciones', frequency: 'monthly',
    anchorDateISO: '2026-09-20', nextDateISO: '2026-09-20', active: true, deleted: false, createdAt, revision: 0, updatedAt: createdAt };
  const root = routeHarness('(tabs)/index.tsx', {}, homeData, { recurring: [rule] }).render();
  // The header is the compact variant: the metric and the currency chip no longer weigh like the number.
  assert.equal(find(root, 'Choices').props.compact, true);
  assert.equal(find(root, 'CurrencySwitch').props.compact, true);
  // The number is Inicio's own size, a step above the 44 pt hero elsewhere.
  const hero = find(root, 'Money');
  assert.equal(hero.props.large, true);
  assert.equal(hero.props.size, 48);
  // Movements, then the Assistant below them (nearer the thumb), in that order.
  const order = nodes(root).map(node => node.type).filter(type => type === 'QuickActions' || type === 'AssistantEntry');
  assert.equal(order.join('|'), 'QuickActions|AssistantEntry');
  // Every section link stays (same targets) but is quiet: no row of cobalt words competing with the Assistant.
  const titles = nodes(root).filter(node => node.type === 'SectionTitle');
  assert.equal(titles.map(node => node.props.action).join('|'), 'Reportes|Ver todos|Ver todos');
  assert.equal(titles.every(node => node.props.quiet === true && typeof node.props.onAction === 'function'), true);
  // One card (CategoryRanking draws its own surface), then two open lists on the ground: never card → list → card (24UX3 review).
  const surfaces = nodes(root).filter(node => node.type === 'Surface');
  assert.equal(surfaces.some(surface => nodes(surface).some(node => node.type === 'UpcomingRecurringRow')), false, 'commitments are an open agenda, not a card');
  assert.equal(surfaces.some(surface => nodes(surface).some(node => node.type === 'EntryRow')), false, 'the latest transactions are an open ledger, not a second slab');
  const ledger = nodes(root).filter(node => node.type === 'EntryRow');
  assert.ok(ledger.length > 0);
  assert.equal(ledger.every(row => row.props.variant === 'home'), true, '24UX5: the explicit Home variant, not a global change of EntryRow');
});

// 24UX5: glyphs per category in the harness (the default mock gave every category one glyph); a test may alias two.
test('24UX5: Home rows name the category only when it adds something, and both lists share one rule', () => {
  const at = '2026-09-12T12:00:00Z';
  const cash: domain.Account = { id: 'a', name: 'Efectivo', currency: 'ARS', openingMinor: 0, createdAt: at };
  const entry = (id: string, merchant: string, category: string, kind: 'expense' | 'income' = 'expense'): domain.Entry =>
    ({ id, accountId: 'a', kind, amountMinor: 100, merchant, category, dateISO: '2026-09-10', createdAt: at });
  const data = { accounts: [cash], entries: [entry('named', 'Carrefour', 'Supermercado'), entry('short', 'f', 'Comida'), entry('generic', 'Varios', 'Hogar'),
    entry('same', 'Transporte', 'Transporte')] };
  const rule: domain.RecurringRule = { id: 'r', accountId: 'a', kind: 'expense', amountMinor: 100, merchant: 'Netflix', category: 'Suscripciones', frequency: 'monthly',
    anchorDateISO: '2026-09-20', nextDateISO: '2026-09-20', active: true, deleted: false, createdAt: at, revision: 0, updatedAt: at };
  const shows = (root: Node) => Object.fromEntries(nodes(root).filter(n => n.type === 'EntryRow' || n.type === 'UpcomingRecurringRow')
    .map(n => [(n.props.entry ?? n.props.rule).id, n.props.showCategory]));
  let root = routeHarness('(tabs)/index.tsx', {}, data, { recurring: [rule] }).render();
  assert.deepEqual(shows(root), { r: false, named: false, short: true, generic: true, same: false },
    'a clear name keeps the date alone; "f" and "Varios" keep their category; a name that is the category never repeats it');
  // Two categories that draw the same glyph on one screen (across both lists) each say which they are.
  glyphAliases.set('Supermercado', 'glyph-suscripciones');
  try {
    root = routeHarness('(tabs)/index.tsx', {}, data, { recurring: [rule] }).render();
    assert.deepEqual(shows(root), { r: true, named: true, short: true, generic: true, same: false });
  } finally { glyphAliases.clear(); }
});

test('24UX5: Home keeps the account in a row only when another account of the currency could be meant, and its links keep their targets', () => {
  const at = '2026-09-12T12:00:00Z';
  const accounts: domain.Account[] = [{ id: 'a', name: 'Efectivo', currency: 'ARS', openingMinor: 0, createdAt: at },
    { id: 'b', name: 'Banco', currency: 'ARS', openingMinor: 0, createdAt: at }, { id: 'u', name: 'Dólares', currency: 'USD', openingMinor: 0, createdAt: at }];
  const entries: domain.Entry[] = [{ id: 'e', accountId: 'a', kind: 'expense', amountMinor: 100, merchant: 'Café', category: 'Comida', dateISO: '2026-09-10', createdAt: at }];
  const oneArs = routeHarness('(tabs)/index.tsx', {}, { accounts: [accounts[0], accounts[2]], entries }).render();
  assert.equal(find(oneArs, 'EntryRow').props.showAccount, false, 'one ARS account (a USD one does not make it ambiguous)');
  const view = routeHarness('(tabs)/index.tsx', {}, { accounts, entries });
  const twoArs = view.render();
  assert.equal(find(twoArs, 'EntryRow').props.showAccount, false, '24UX5 review: two accounts owned, one visible: no name');
  const links = nodes(twoArs).filter(node => node.type === 'SectionTitle');
  for (const link of links) link.props.onAction();
  assert.equal(JSON.stringify(view.pushed), JSON.stringify([{ pathname: '/reports', params: { currency: 'ARS' } }, '/activity']), 'Reportes keeps the currency; Ver todos opens Movimientos');
});

// 24UX5 §8: the composition with more data. Whatever the ledger holds, Inicio keeps one order (header, number,
// movements, the Assistant, then the sections) and each section its own shape; nothing new appears to show a feature.
test('24UX5: Inicio keeps its hierarchy with no account, one or several accounts and currencies, categories, budgets, rules and huge amounts', () => {
  const at = '2026-09-01T12:00:00.000Z';
  const account = (id: string, currency: domain.Currency, name = id): domain.Account => ({ id, name, currency, openingMinor: 0, createdAt: at });
  const spend = (id: string, accountId: string, category: string, amountMinor: number, kind: 'expense' | 'income' = 'expense'): domain.Entry =>
    ({ id, accountId, kind, amountMinor, merchant: 'Comercio ' + id, category, dateISO: '2026-09-10', createdAt: at });
  const rule = (id: string, overrides: Partial<domain.RecurringRule> = {}): domain.RecurringRule => ({ id, accountId: 'a', kind: 'expense', amountMinor: 100, merchant: 'Regla ' + id,
    category: 'Servicios', frequency: 'monthly', anchorDateISO: '2026-09-20', nextDateISO: '2026-09-20', active: true, deleted: false, createdAt: at, revision: 0, updatedAt: at, ...overrides });
  const total = (amountMinor: number): domain.MonthlyBudget => ({ id: 'total', scope: 'total', currency: 'ARS', monthISO: '2026-09', amountMinor, active: true, createdAt: at, revision: 0, updatedAt: at });
  const order = (root: Node) => nodes(root).map(node => node.type === 'SectionTitle' ? 'title:' + node.props.children : node.type)
    .filter(type => ['Choices', 'CurrencySwitch', 'Money', 'QuickActions', 'AssistantEntry', 'BudgetHomeCard', 'CategoryRanking', 'UpcomingRecurringRow', 'EntryRow', 'EmptyState'].includes(type) || type.startsWith('title:'))
    .filter((type, index, all) => type !== all[index - 1]);
  const expected = (sections: string[]) => ['Choices', 'Money', 'QuickActions', 'AssistantEntry', ...sections];

  // No account: one calm empty state, nothing else.
  assert.deepEqual(order(routeHarness('(tabs)/index.tsx', {}, { accounts: [], entries: [] }).render()), ['EmptyState']);
  // One account, nothing recorded: the month says so once, under Últimos movimientos; no category card.
  assert.deepEqual(order(routeHarness('(tabs)/index.tsx', {}, { accounts: [account('a', 'ARS')], entries: [] }).render()), expected(['title:Últimos movimientos']));
  // Three or more categories, incomes and expenses, several accounts of one currency, a second currency, an overall
  // budget already exceeded, one active rule, one paused and one deleted (neither shown), and an amount of 13 digits.
  const data = { accounts: [account('a', 'ARS', 'Efectivo'), account('b', 'ARS', 'Banco'), account('u', 'USD', 'Dólares')],
    entries: [spend('1', 'a', 'Comida', 9_999_999_999_999), spend('2', 'b', 'Transporte', 500), spend('3', 'a', 'Salud', 300), spend('4', 'a', 'Ocio', 200),
      spend('5', 'b', 'Sueldo', 900_000, 'income'), spend('6', 'u', 'Viajes', 4_000)] };
  const extra = { budgets: [total(1000)], recurring: [rule('on'), rule('paused', { active: false }), rule('gone', { active: false, deleted: true })] };
  const view = routeHarness('(tabs)/index.tsx', {}, data, extra);
  let root = view.render();
  const full = expected(['title:Presupuesto del mes', 'BudgetHomeCard', 'title:En qué gastaste', 'CategoryRanking', 'title:Próximos compromisos', 'UpcomingRecurringRow',
    'title:Últimos movimientos', 'EntryRow']);
  full.splice(1, 0, 'CurrencySwitch');
  assert.deepEqual(order(root), full);
  assert.equal(find(root, 'Money').props.minor, 9_999_999_999_999 + 500 + 300 + 200, 'the huge amount reaches the hero exactly (Money fits it to the width)');
  assert.equal(find(root, 'CategoryRanking').props.categories.length, 4, 'every category is handed over; the card shows its three');
  assert.equal(nodes(root).filter(node => node.type === 'UpcomingRecurringRow').map(node => node.props.rule.id).join(), 'on', 'paused and deleted rules are not upcoming');
  assert.equal(nodes(root).filter(node => node.type === 'EntryRow').every(node => node.props.showAccount), true, 'two ARS accounts: rows name theirs');
  assert.ok(find(root, 'BudgetHomeCard').props.summary.total.exceeded, 'the exceeded budget keeps its place and its own card');
  // Switching the currency keeps the same order; sections with nothing in USD simply stay out.
  find(root, 'CurrencySwitch').props.onChange('USD');
  root = view.render();
  const usd = expected(['title:En qué gastaste', 'CategoryRanking', 'title:Últimos movimientos', 'EntryRow']);
  usd.splice(1, 0, 'CurrencySwitch');
  assert.deepEqual(order(root), usd);
  assert.equal(nodes(root).filter(node => node.type === 'EntryRow').every(node => node.props.showAccount === false), true, 'one USD account: no account name');
  // Several upcoming rules: at most three, soonest first.
  const many = routeHarness('(tabs)/index.tsx', {}, data, { recurring: ['d', 'b', 'a', 'c'].map((id, index) => rule(id, { nextDateISO: '2026-09-2' + index, anchorDateISO: '2026-09-2' + index })) }).render();
  assert.equal(nodes(many).filter(node => node.type === 'UpcomingRecurringRow').map(node => node.props.rule.id).join(), 'd,b,a');
});
