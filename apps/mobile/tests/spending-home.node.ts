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
    '../src/ui/home-modules': { CurrencyParts: 'CurrencyParts', HomeInsightRow: 'HomeInsightRow', MetricHelp: 'MetricHelp', UpcomingRecurringRow: 'UpcomingRecurringRow' },
    '../src/ui/home-capture': { CaptureButton: 'CaptureButton' },
    '../src/ui/home-focus': homeFocus,
    '../src/ui/category-color': categoryColor,
    '../src/ui/category-hues': { useCategoryColor: () => '#3E6FB0', useCategoryLabel: (s: string) => s, useCategoryDefinitions: () => [], useCategoryLook: (s: string) => ({ label: s, storedLabel: s, key: String(s).toLowerCase(), hex: '#3E6FB0', glyph: 'pricetag-outline' }), useCategoryLookOf: () => (s: string) => ({ label: s, storedLabel: s, key: String(s).toLowerCase(), hex: '#3E6FB0', glyph: glyphAliases.get(s) ?? 'glyph-' + String(s).toLowerCase() }), useAccountLook: () => ({ icon: 'wallet', color: 'cobalt', glyph: 'wallet-outline', hex: '#2557D6' }), useAccountNameOf: () => (account: any) => account.name, useAccountLookOf: () => () => ({ icon: 'wallet', color: 'cobalt', glyph: 'wallet-outline', hex: '#2557D6' }) },
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
test('24UX6A: Inicio shows the current month only, scoped to the currency, with one capture button and no movement list', () => {
  const view = routeHarness('(tabs)/index.tsx', {}, homeData);
  let root = view.render();
  assert.equal(find(root, 'Money').props.minor, 300, 'September expenses in ARS');
  assert.equal(nodes(root).some(n => n.type === 'Choices' && (n.props.value === 'month' || n.props.value === 'week')), false, 'no period control: Home is the month');
  assert.equal(nodes(root).some(n => n.type === 'EntryRow' || n.type === 'EntryList'), false, '24UX6A: the movements live in Movimientos');
  const texts = nodes(root).filter(n => n.type === 'AppText').map(n => String(n.props.children));
  assert.equal(texts.some(text => /gastos? registrados?|–|Gastado ·/.test(text)), false, 'no count or date-range copy near the hero');
  assert.ok(texts.includes('Septiembre'), 'the month names the number');
  assert.deepEqual([find(root, 'CaptureButton').props.movementCurrency, find(root, 'CaptureButton').props.assistantCurrency], ['ARS', 'ARS']);
  find(root, 'DisplayCurrencyButton').props.onCurrency('USD');
  root = view.render();
  assert.equal(find(root, 'Money').props.minor, 1000);
  assert.deepEqual([find(root, 'CaptureButton').props.movementCurrency, find(root, 'CaptureButton').props.assistantCurrency], ['USD', 'USD'], 'a new movement starts in the currency shown');
  assert.equal(nodes(root).some(n => n.type === 'HomeInsightRow'), false, 'one category is not a concentration: nothing to say');
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
  assert.equal(nodes(empty).some(n => n.type === 'SpendingTimeline' || n.type === 'HomeInsightRow' || n.type === 'UpcomingRecurringRow'), false);
  assert.equal(nodes(empty).some(n => n.type === 'SectionTitle'), false, 'no empty commitments block');
  const huge = { ...homeData, entries: homeData.entries.filter(e => e.id === 'early' || e.id === 'now').map(e => ({ ...e, amountMinor: Number.MAX_SAFE_INTEGER })) };
  assert.equal(nodes(routeHarness('(tabs)/index.tsx', {}, huge).render()).some(n => n.type === 'Money'), false);
});
test('Home keeps analysis in Reportes: no timeline bars, commitments only with a rule due this week, Disponible without cards', () => {
  const view = routeHarness('(tabs)/index.tsx', {}, homeData);
  const root = view.render();
  assert.equal(nodes(root).some(n => n.type === 'SpendingTimeline'), false);
  assert.equal(nodes(root).some(n => n.type === 'SectionTitle'), false, '24UX6A: no section links without something to show');
  assert.equal(nodes(root).some(n => n.type === 'UpcomingRecurringRow'), false, 'no commitments block without rules');
  // No disclaimer copy on screen: the definition lives behind contextual help.
  const texts = nodes(root).filter(n => n.type === 'AppText').map(n => String(n.props.children));
  assert.equal(texts.some(text => /saldo bancario|patrimonio/.test(text)), false);
  const rule = { id: 'r', kind: 'expense' as const, accountId: 'a', amountMinor: 700, merchant: 'Alquiler', category: 'Hogar', frequency: 'monthly' as const,
    anchorDateISO: '2026-09-15', nextDateISO: '2026-09-15', active: true, deleted: false, createdAt, revision: 0, updatedAt: createdAt };
  const withRule = routeHarness('(tabs)/index.tsx', {}, homeData, { recurring: [rule] as domain.RecurringRule[] });
  assert.equal(find(withRule.render(), 'UpcomingRecurringRow').props.rule.id, 'r');
  nodes(withRule.render()).find(n => n.type === 'SectionTitle' && n.props.action === 'Ver todos' && n.props.children === 'Próximos compromisos')!.props.onAction();
  assert.equal(withRule.pushed.at(-1), '/recurring');
  // 24UX6A: a rule due after this week waits in Recurrentes.
  const later = routeHarness('(tabs)/index.tsx', {}, homeData, { recurring: [{ ...rule, anchorDateISO: '2026-09-19', nextDateISO: '2026-09-19' }] as domain.RecurringRule[] }).render();
  assert.equal(nodes(later).some(n => n.type === 'UpcomingRecurringRow' || n.type === 'SectionTitle'), false);
  // Disponible excludes a card account's negative balance.
  const withCard = { ...homeData, accounts: [...homeData.accounts, { id: 'card-acc', name: 'Visa', currency: 'ARS' as const, openingMinor: -5000, createdAt }] };
  const cardView = routeHarness('(tabs)/index.tsx', {}, withCard, { cards: [{ id: 'card', accountId: 'card-acc', issuer: '', last4: '', creditLimitMinor: null,
    closingDay: 1, dueDay: 10, active: true, deleted: false, createdAt, revision: 0, updatedAt: createdAt }] });
  nodes(cardView.render()).find(n => n.type === 'Choices' && n.props.value === 'spending')!.props.onChange('available');
  // Account "a": opening 10000, expenses 101 + 202 + 303 + 100 + 200, income 500. The card's −5000 is excluded.
  assert.equal(find(cardView.render(), 'Money').props.minor, 10000 - 101 - 202 - 303 - 100 - 200 + 500);
  assert.equal(nodes(cardView.render()).some(n => n.type === 'AppText' && /saldo bancario|patrimonio/.test(String(n.props.children))), false);
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

test('24UX6A: a budget reaches Inicio only when it needs attention, general or sublimit, and never when archived or calm', () => {
  const createdAt = '2026-09-01T12:00:00.000Z';
  const total: domain.MonthlyBudget = { id: 'total', scope: 'total', currency: 'ARS', monthISO: '2026-09', amountMinor: 100000, active: true, createdAt, revision: 0, updatedAt: createdAt };
  const sublimit: domain.MonthlyBudget = { id: 'salud', scope: 'category', category: 'Salud', currency: 'ARS', monthISO: '2026-09', amountMinor: 250, active: true, createdAt, revision: 0, updatedAt: createdAt };
  const insightOf = (budgets: domain.MonthlyBudget[]) => nodes(routeHarness('(tabs)/index.tsx', {}, homeData, { budgets }).render()).find(n => n.type === 'HomeInsightRow');
  assert.equal(insightOf([total]), undefined, 'a calm general budget (300 of 1000,00) says nothing on Inicio');
  // All September ARS expenses are 300: a general budget of 330 is 91 % used, one of 250 in Salud is 50 over.
  const low = insightOf([{ ...total, amountMinor: 330 }])!;
  assert.equal(low.props.insight.kind, 'budgetLow');
  assert.ok(Math.abs(low.props.insight.leftShare - 30 / 330) < 1e-9);
  assert.deepEqual({ ...insightOf([sublimit])!.props.insight }, { kind: 'budgetExceeded', scope: 'category', category: 'Salud', currency: 'ARS', overMinor: 50 });
  const view = routeHarness('(tabs)/index.tsx', {}, homeData, { budgets: [sublimit] });
  find(view.render(), 'HomeInsightRow').props.onPress();
  assert.equal(JSON.stringify(view.pushed.at(-1)), JSON.stringify({ pathname: '/budgets', params: { currency: 'ARS' } }), 'the line opens Presupuestos in the budget\'s currency');
  assert.equal(insightOf([{ ...sublimit, active: false, revision: 1, updatedAt: '2026-09-02T12:00:00.000Z' }]), undefined, 'an archived budget is gone');
  assert.equal(nodes(routeHarness('(tabs)/index.tsx', {}, homeData, { budgets: [sublimit] }).render()).some(n => n.type === 'SectionTitle'), false, 'no budget section, one line');
});
test('23.1B1: Home in English keeps the same numbers and routes; only words change, and the language can switch in place', () => {
  const rule: domain.RecurringRule = { id: 'r', accountId: 'a', kind: 'expense', amountMinor: 100, merchant: 'Netflix', category: 'Suscripciones', frequency: 'monthly',
    anchorDateISO: '2026-09-15', nextDateISO: '2026-09-15', active: true, deleted: false, createdAt, revision: 0, updatedAt: createdAt };
  const view = routeHarness('(tabs)/index.tsx', {}, homeData, { recurring: [rule] });
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
    assert.equal(titles.join(' / '), 'Coming up|See all');
    assert.equal(find(root, 'IconButton').props.label, 'View my accounts');
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
  const control = find(root, 'DisplayCurrencyButton');
  assert.deepEqual(control.props.held, ['ARS', 'USD', 'JPY'], 'the currencies present, ARS and USD first, then by code');
  assert.equal(control.props.compact, true, 'Inicio keeps the compact chip beside the metric control');
  assert.equal(control.props.currency, 'ARS');
  assert.equal(find(root, 'Money').props.minor, 300, 'ARS figures unchanged by the third currency');
  control.props.onCurrency('JPY');
  root = view.render();
  assert.deepEqual({ minor: find(root, 'Money').props.minor, currency: find(root, 'Money').props.currency }, { minor: 2200, currency: 'JPY' }, 'yen are summed as yen, never as cents');
  assert.equal(find(root, 'CaptureButton').props.movementCurrency, 'JPY');
  // 24UX6A: yen 1500 of 2200 in Comida is the month's one line, measured in yen alone.
  const insight = find(root, 'HomeInsightRow').props.insight;
  assert.deepEqual([insight.kind, insight.category, insight.currency], ['concentration', 'Comida', 'JPY']);
  assert.ok(Math.abs(insight.share - 1500 / 2200) < 1e-9);
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
  // Inicio's own link to Reportes (24UX6A: the concentration line) carries the currency it shows, so the two agree even on a phone that never stored a choice.
  const fresh = displayCurrency.createDisplayCurrencyStore(() => ({ getItemSync: () => null, setItemSync: () => {}, removeItemSync: () => false }));
  const concentrated = { ...homeData, entries: [...homeData.entries, { ...homeData.entries[0], id: 'usd-food', accountId: 'u', dateISO: '2026-09-11', amountMinor: 100, category: 'Comida' }] };
  const origin = routeHarness('(tabs)/index.tsx', {}, concentrated, {}, fresh);
  // Only the dollars (a new phone reads the consolidated total, whose shares need a rate this harness does not have).
  find(origin.render(), 'DisplayCurrencyButton').props.onMode('single');
  find(origin.render(), 'DisplayCurrencyButton').props.onCurrency('USD');
  find(origin.render(), 'HomeInsightRow').props.onPress();
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

const homeTexts = (root: Node) => nodes(root).filter(node => node.type === 'AppText').map(node => [node.props.children].flat().join(''));
const sectionTitles = (root: Node) => nodes(root).filter(node => node.type === 'SectionTitle').map(node => node.props.children);

test('24UX6A: a quiet month is the number and the button: no empty section, no filler sentence', () => {
  // The fixture's movements are all in August; the harness day is 2026-09-12.
  const root = routeHarness('(tabs)/index.tsx', {}, snapshot).render();
  assert.equal(find(root, 'Money').props.minor, 0, 'a true zero for the month');
  assert.equal(sectionTitles(root).length, 0, 'no section to say that nothing happened');
  assert.equal(nodes(root).some(n => n.type === 'HomeInsightRow' || n.type === 'EmptyState'), false);
  assert.equal(homeTexts(root).some(text => /Todavía no hay movimientos|Tus categorías aparecerán/.test(text)), false);
  assert.equal(nodes(root).filter(n => n.type === 'CaptureButton').length, 1, 'recording stays one tap away');
  // Only an income this month: still the number (no spending) and the button, nothing else.
  const single = { ...snapshot, accounts: [snapshot.accounts[0]], entries: snapshot.entries.filter(entry => entry.accountId === 'a') };
  const incomeOnly = { ...single, entries: [...single.entries, { ...snapshot.entries[0], id: 'pay', kind: 'income' as const, category: 'Sueldo', dateISO: '2026-09-10' }] };
  const withIncome = routeHarness('(tabs)/index.tsx', {}, incomeOnly).render();
  assert.equal(sectionTitles(withIncome).length, 0);
  assert.equal(find(withIncome, 'Money').props.minor, 0);
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
test('24UX6A: Inicio keeps one number, one capture button and nothing that is not about now', () => {
  const rule: domain.RecurringRule = { id: 'r', accountId: 'a', kind: 'expense', amountMinor: 100, merchant: 'Netflix', category: 'Suscripciones', frequency: 'monthly',
    anchorDateISO: '2026-09-15', nextDateISO: '2026-09-15', active: true, deleted: false, createdAt, revision: 0, updatedAt: createdAt };
  const root = routeHarness('(tabs)/index.tsx', {}, homeData, { recurring: [rule] }).render();
  assert.equal(sectionTitles(root).join('|'), 'Próximos compromisos', 'no «En qué gastaste», no «Últimos movimientos»');
  assert.equal(nodes(root).filter(node => node.type === 'CaptureButton').length, 1, 'one way to record');
  for (const gone of ['QuickActions', 'AssistantEntry', 'EntryRow', 'CategoryRanking', 'BudgetHomeCard']) assert.equal(nodes(root).some(node => node.type === gone), false, gone + ' left Inicio');
  assert.equal(nodes(root).filter(node => node.type === 'Choices').length, 1, 'Gastos / Disponible');
  assert.equal(nodes(root).filter(node => node.type === 'DisplayCurrencyButton').length, 1);
  assert.equal(nodes(root).filter(node => node.type === 'Money').length, 1, 'one hero; the commitments draw their own amounts');
});
// ---- 24UX3: Home hierarchy ---------------------------------------------------------------------------------------

test('24UX6A: no root title, the accounts beside the metric, a larger number, the capture button under it and quiet commitments on the ground', () => {
  const rule: domain.RecurringRule = { id: 'r', accountId: 'a', kind: 'expense', amountMinor: 100, merchant: 'Netflix', category: 'Suscripciones', frequency: 'monthly',
    anchorDateISO: '2026-09-15', nextDateISO: '2026-09-15', active: true, deleted: false, createdAt, revision: 0, updatedAt: createdAt };
  const view = routeHarness('(tabs)/index.tsx', {}, homeData, { recurring: [rule] });
  const root = view.render();
  assert.equal(homeTexts(root).includes('Inicio'), false, 'the selected tab names the screen');
  // The metric and the currency chip are compact: they do not weigh like the number.
  assert.equal(find(root, 'Choices').props.compact, true);
  assert.equal(find(root, 'DisplayCurrencyButton').props.compact, true);
  const wallet = find(root, 'IconButton');
  assert.deepEqual([wallet.props.name, wallet.props.label], ['wallet-outline', 'Ver mis cuentas'], 'the accounts stay one tap away, where the title was');
  wallet.props.onPress();
  assert.equal(view.pushed.at(-1), '/accounts');
  const hero = find(root, 'Money');
  assert.equal(hero.props.large, true);
  assert.equal(hero.props.size, 48);
  const order = nodes(root).map(node => node.type).filter(type => ['Choices', 'IconButton', 'Money', 'DisplayCurrencyButton', 'CaptureButton', 'SectionTitle', 'UpcomingRecurringRow'].includes(type));
  assert.equal(order.join('|'), 'Choices|IconButton|Money|DisplayCurrencyButton|CaptureButton|SectionTitle|UpcomingRecurringRow', 'what the number covers sits under it; the button follows');
  const titles = nodes(root).filter(node => node.type === 'SectionTitle');
  assert.equal(titles.every(node => node.props.quiet === true && typeof node.props.onAction === 'function'), true, 'a quiet link, no cobalt word competing with the button');
  const surfaces = nodes(root).filter(node => node.type === 'Surface');
  assert.equal(surfaces.some(surface => nodes(surface).some(node => node.type === 'UpcomingRecurringRow')), false, 'commitments are an open agenda, not a card');
  assert.equal(nodes(root).filter(node => node.type === 'Reflow').length, 1, 'a module that appears or leaves moves the layout calmly (Reflow honours Reduce Motion)');
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
// 24UX5 §8, 24UX6A: the composition with more data. Whatever the ledger holds, Inicio keeps one order (the controls,
// the number, the button, then only what needs attention); nothing appears to show a feature.
test('24UX6A: Inicio keeps its hierarchy with no account, one or several accounts and currencies, budgets, rules and huge amounts', () => {
  const at = '2026-09-01T12:00:00.000Z';
  const account = (id: string, currency: domain.Currency, name = id): domain.Account => ({ id, name, currency, openingMinor: 0, createdAt: at });
  const spend = (id: string, accountId: string, category: string, amountMinor: number, kind: 'expense' | 'income' = 'expense'): domain.Entry =>
    ({ id, accountId, kind, amountMinor, merchant: 'Comercio ' + id, category, dateISO: '2026-09-10', createdAt: at });
  const rule = (id: string, overrides: Partial<domain.RecurringRule> = {}): domain.RecurringRule => ({ id, accountId: 'a', kind: 'expense', amountMinor: 100, merchant: 'Regla ' + id,
    category: 'Servicios', frequency: 'monthly', anchorDateISO: '2026-09-15', nextDateISO: '2026-09-15', active: true, deleted: false, createdAt: at, revision: 0, updatedAt: at, ...overrides });
  const total = (amountMinor: number): domain.MonthlyBudget => ({ id: 'total', scope: 'total', currency: 'ARS', monthISO: '2026-09', amountMinor, active: true, createdAt: at, revision: 0, updatedAt: at });
  const order = (root: Node) => nodes(root).map(node => node.type === 'SectionTitle' ? 'title:' + node.props.children : node.type)
    .filter(type => ['Choices', 'IconButton', 'DisplayCurrencyButton', 'Money', 'CaptureButton', 'UpcomingRecurringRow', 'HomeInsightRow', 'EmptyState', 'EntryRow', 'QuickActions'].includes(type) || type.startsWith('title:'))
    .filter((type, index, all) => type !== all[index - 1]);
  // 24C1 / 25B2: the chip is part of the hero only while two or more currencies are held.
  const expected = (modules: string[], chip = false) => ['Choices', 'IconButton', 'Money', ...(chip ? ['DisplayCurrencyButton'] : []), 'CaptureButton', ...modules];

  // No account: the accounts shortcut and one calm empty state, nothing else.
  assert.deepEqual(order(routeHarness('(tabs)/index.tsx', {}, { accounts: [], entries: [] }).render()), ['IconButton', 'EmptyState']);
  // One account, nothing recorded: the number and the button.
  assert.deepEqual(order(routeHarness('(tabs)/index.tsx', {}, { accounts: [account('a', 'ARS')], entries: [] }).render()), expected([]));
  // Several categories, incomes and expenses, several accounts of one currency, a second currency, an overall budget
  // already exceeded, one active rule this week, one paused and one deleted (neither shown), and an amount of 13 digits.
  const data = { accounts: [account('a', 'ARS', 'Efectivo'), account('b', 'ARS', 'Banco'), account('u', 'USD', 'Dólares')],
    entries: [spend('1', 'a', 'Comida', 9_999_999_999_999), spend('2', 'b', 'Transporte', 500), spend('3', 'a', 'Salud', 300), spend('4', 'a', 'Ocio', 200),
      spend('5', 'b', 'Sueldo', 900_000, 'income'), spend('6', 'u', 'Viajes', 4_000)] };
  const extra = { budgets: [total(1000)], recurring: [rule('on'), rule('paused', { active: false }), rule('gone', { active: false, deleted: true })] };
  const view = routeHarness('(tabs)/index.tsx', {}, data, extra);
  let root = view.render();
  assert.deepEqual(order(root), expected(['title:Próximos compromisos', 'UpcomingRecurringRow', 'HomeInsightRow'], true));
  assert.equal(find(root, 'Money').props.minor, 9_999_999_999_999 + 500 + 300 + 200, 'the huge amount reaches the hero exactly (Money fits it to the width)');
  assert.equal(nodes(root).filter(node => node.type === 'UpcomingRecurringRow').map(node => node.props.rule.id).join(), 'on', 'paused and deleted rules are not upcoming');
  const insight = find(root, 'HomeInsightRow').props.insight;
  assert.deepEqual([insight.kind, insight.scope, insight.overMinor], ['budgetExceeded', 'total', 9_999_999_999_999 + 500 + 300 + 200 - 1000], 'the exceeded budget, before the concentrated category, exactly');
  // Switching the currency keeps the same order; what has nothing in USD simply stays out.
  find(root, 'DisplayCurrencyButton').props.onCurrency('USD');
  root = view.render();
  assert.deepEqual(order(root), expected([], true));
  // Several rules this week: two at most, soonest first.
  const many = routeHarness('(tabs)/index.tsx', {}, data, { recurring: ['d', 'b', 'a', 'c'].map((id, index) => rule(id, { nextDateISO: '2026-09-1' + (3 + index), anchorDateISO: '2026-09-1' + (3 + index) })) }).render();
  assert.equal(nodes(many).filter(node => node.type === 'UpcomingRecurringRow').map(node => node.props.rule.id).join(), 'd,b');
});
// ---- Producto 24C1: the consolidated total ------------------------------------------------------------------
// Synthetic rates from a fixed book (no network): 1 USD = 1000 ARS from the 1st, 2000 ARS from the 10th.

const consolidatedRates = () => domain.rateBook([
  { base: 'USD', quote: 'ARS', rate: '1000', effectiveDate: '2026-09-01', source: 'Frankfurter', fetchedAt: '2026-09-12T12:00:00.000Z' },
  { base: 'USD', quote: 'ARS', rate: '2000', effectiveDate: '2026-09-10', source: 'Frankfurter', fetchedAt: '2026-09-12T12:00:00.000Z' },
]);

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
  assert.equal(nodes(root).some(n => n.type === 'HomeInsightRow'), false, 'one category, converted: no concentration line');
  assert.deepEqual([find(root, 'CaptureButton').props.movementCurrency, find(root, 'CaptureButton').props.assistantCurrency], ['ARS', 'ARS']);
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
  assert.equal(nodes(root).some(n => n.type === 'HomeInsightRow'), false, 'no category shares of a partial month');
  assert.equal(ensured.at(-1)?.quotes.join(), 'ARS,EUR');
  assert.equal(find(root, 'CaptureButton').props.movementCurrency, undefined, 'no EUR account to preselect');
  assert.equal(find(root, 'CaptureButton').props.assistantCurrency, 'EUR', 'the Assistant hears the currency shown');
});

test('24C1: a ledger in one currency shown in that currency asks the provider nothing and reads as before', () => {
  const onlyPesos: domain.LedgerSnapshot = { ...homeData, accounts: homeData.accounts.filter(account => account.currency === 'ARS'), entries: homeData.entries.filter(entry => entry.accountId === 'a') };
  const ensured: { months: readonly string[]; quotes: readonly string[] }[] = [];
  const root = routeHarness('(tabs)/index.tsx', {}, onlyPesos, {}, displayStore({ [displayCurrency.DISPLAY_MODE_KEY]: 'consolidated' }), { book: domain.rateBook([]), ensured }).render();
  assert.equal(find(root, 'Money').props.minor, 300);
  assert.equal(ensured.length, 0);
  assert.equal(nodes(root).some(n => n.type === 'MetricHelp'), false, 'nothing converted: no rate to explain');
});

// ---- 24C1 review: a budget keeps its currency whatever Inicio shows ---------------------------------------------

/** ARS and EUR accounts, one expense each this month, and a general budget in each currency, both nearly spent (300 of
 * 320, 500 of 520: a converted figure would exceed either). Rates: 1 USD = 1000 ARS, 1 USD = 0.5 EUR. */
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

test('24C1 review: an existing ARS budget tracks ARS spending only, in single and in consolidated mode, whatever currency the total is read in', () => {
  const { data, extra, book } = budgetLedger();
  const display = displayStore({ [displayCurrency.DISPLAY_MODE_KEY]: 'single', [displayCurrency.DISPLAY_CURRENCY_KEY]: 'ARS' });
  const view = routeHarness('(tabs)/index.tsx', {}, data, extra, display, { book });
  let root = view.render();
  const line = () => find(root, 'HomeInsightRow');
  const facts = () => [line().props.insight.kind, line().props.insight.currency, Math.round(line().props.insight.leftShare * 10000), line().props.labelsCurrency];
  assert.deepEqual(facts(), ['budgetLow', 'ARS', 625, false], 'single ARS: 300 of 320, 6,25 % left');
  // Consolidated, total read in ARS: the number converts the euros (€5 → US$10 → ARS 10.000), the budget does not.
  find(root, 'DisplayCurrencyButton').props.onMode('consolidated');
  root = view.render();
  assert.equal(find(root, 'Money').props.minor, 300 + 1000000, 'the total is every account');
  assert.deepEqual(facts(), ['budgetLow', 'ARS', 625, false], 'the ARS budget still counts ARS spending only (converted, it would be exceeded)');
  // Total read in USD, a currency with no budget: the ARS budget stays on Inicio and its amount names its currency.
  find(root, 'DisplayCurrencyButton').props.onCurrency('USD');
  root = view.render();
  assert.deepEqual(facts(), ['budgetLow', 'ARS', 625, true], 'labelled with its currency');
  line().props.onPress();
  assert.equal(JSON.stringify(view.pushed.at(-1)), JSON.stringify({ pathname: '/budgets', params: { currency: 'ARS' } }), 'the line opens the budget\'s own currency');
  // Total read in EUR: the EUR budget takes the line, measured in euros only.
  find(root, 'DisplayCurrencyButton').props.onCurrency('EUR');
  root = view.render();
  assert.deepEqual(facts(), ['budgetLow', 'EUR', Math.round((1 - 500 / 520) * 10000), false]);
  // Back to single mode in EUR: identical.
  find(root, 'DisplayCurrencyButton').props.onMode('single');
  root = view.render();
  assert.deepEqual(facts().slice(0, 2), ['budgetLow', 'EUR']);
  // A missing rate hides the consolidated total, never the budget (it needs no rate).
  const offline = routeHarness('(tabs)/index.tsx', {}, data, extra, displayStore({ [displayCurrency.DISPLAY_MODE_KEY]: 'consolidated', [displayCurrency.DISPLAY_CURRENCY_KEY]: 'USD' }), { book: domain.rateBook([]), activity: 'offline' }).render();
  assert.equal(nodes(offline).some(n => n.type === 'Money'), false);
  assert.deepEqual([find(offline, 'HomeInsightRow').props.insight.kind, find(offline, 'HomeInsightRow').props.insight.currency], ['budgetLow', 'ARS']);
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
  // Disponible counts live accounts only: the deleted USD balance is history.
  nodes(root).find(n => n.type === 'Choices' && n.props.value === 'spending')!.props.onChange('available');
  root = view.render();
  assert.equal(find(root, 'Money').props.minor, 9594, 'ARS 95,94 alone: no USD balance converted');
  assert.equal(nodes(root).filter(n => n.type === 'AppText').map(n => String(n.props.children)).some(text => text === '1 cuenta'), true, 'one live account counted');
  // "Solo USD" is still a view of the history: the USD expense alone, in its own currency.
  chip.props.onMode('single');
  chip.props.onCurrency?.('USD');
  display.set('USD');
  nodes(view.render()).find(n => n.type === 'Choices' && n.props.value === 'available')!.props.onChange('spending');
  root = view.render();
  assert.deepEqual([find(root, 'Money').props.minor, find(root, 'Money').props.currency], [1000, 'USD']);
  assert.deepEqual([find(root, 'DisplayCurrencyButton').props.mode, find(root, 'DisplayCurrencyButton').props.currency], ['single', 'USD']);
  assert.equal(find(root, 'CaptureButton').props.movementCurrency, undefined, 'no live USD account to preselect for a new movement');
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
