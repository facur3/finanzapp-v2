import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as domain from '@finanzapp/domain';
import * as presentation from '../src/ui/presentation.ts';
import * as reportPresentation from '../src/ui/report-presentation.ts';
import * as budgetPresentation from '../src/ui/budget-presentation.ts';
import * as i18nFormat from '../src/i18n/format.ts';
import { bindLocale } from '../src/i18n/bind.ts';
import type { AppLocale } from '../src/i18n/locale.ts';
import { realModule, swipeActionsMock } from './real-module.ts';
import * as movementAmount from '../src/ui/movement-amount.ts';
import * as geometry from '../src/ui/geometry.ts';

// Budgets, Recurrentes, Cuentas and account detail handlers with native hosts
// replaced by descriptors. Not a rendered iOS screen or gesture test.
type Node = { type: any; props: Record<string, any> };
const createdAt = '2026-09-01T12:00:00.000Z';
const cash: domain.Account = { id: 'cash', name: 'Banco', currency: 'ARS', openingMinor: 100000, createdAt };
const wallet: domain.Account = { id: 'wallet', name: 'Efectivo', currency: 'ARS', openingMinor: 5000, createdAt };
const usd: domain.Account = { id: 'usd', name: 'Dólares', currency: 'USD', openingMinor: 300, createdAt };
const cardAccount: domain.Account = { id: 'card-acc', name: 'Visa', currency: 'ARS', openingMinor: -20000, createdAt };
const card: domain.CreditCardProfile = { id: 'card', accountId: cardAccount.id, issuer: '', last4: '', creditLimitMinor: null, closingDay: 28, dueDay: 5, active: true, deleted: false, createdAt, revision: 0, updatedAt: createdAt };
const entries: domain.Entry[] = [
  { id: 'e1', accountId: cash.id, kind: 'expense', amountMinor: 3000, merchant: 'Café', category: 'Café', dateISO: '2026-09-10', createdAt },
  { id: 'e2', accountId: cash.id, kind: 'expense', amountMinor: 9000, merchant: 'Super', category: 'Supermercado', dateISO: '2026-09-12', createdAt },
  { id: 'e3', accountId: cash.id, kind: 'income', amountMinor: 50000, merchant: 'Sueldo', category: 'Sueldo', dateISO: '2026-09-05', createdAt },
  { id: 'e4', accountId: cash.id, kind: 'expense', amountMinor: 700, merchant: 'Viejo', category: 'Café', dateISO: '2026-08-30', createdAt },
];
const budgets: domain.MonthlyBudget[] = [
  { id: 'b-cafe', scope: 'category', category: 'Café', currency: 'ARS', monthISO: '2026-09', amountMinor: 2500, active: true, createdAt, revision: 0, updatedAt: createdAt },
  { id: 'b-super', scope: 'category', category: 'Supermercado', currency: 'ARS', monthISO: '2026-09', amountMinor: 10000, active: true, createdAt, revision: 0, updatedAt: createdAt },
];
const rule: domain.RecurringRule = { id: 'rent', accountId: cash.id, kind: 'expense', amountMinor: 40000, merchant: 'Alquiler', category: 'Hogar', frequency: 'monthly',
  anchorDateISO: '2026-10-01', nextDateISO: '2026-10-01', active: true, deleted: false, createdAt, revision: 0, updatedAt: createdAt };
const archive: domain.LedgerArchive = { accounts: [cash, wallet, usd, cardAccount], records: entries.map(domain.initialRecord), cards: [card], budgets, recurring: [rule] };

/** 24UX6E: the window the screens read (`useWindowDimensions`); a test sets it and restores it. */
let windowSize = { width: 390, height: 844, scale: 3, fontScale: 1 };
function withWindow<T>(size: Partial<typeof windowSize>, run: () => T): T {
  const before = windowSize;
  windowSize = { ...before, ...size };
  try { return run(); } finally { windowSize = before; }
}
function harness(file: string, params: Record<string, unknown> = {}, data: domain.LedgerArchive = archive, locale: AppLocale = 'es-AR') {
  const i18nProvider = { useI18n: () => bindLocale(locale) };
  const source = readFileSync(new URL('../app/' + file, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const jsx = (type: unknown, props: Record<string, unknown>) => ({ type, props });
  const state: unknown[] = [];
  const pushed: any[] = [];
  const saved: domain.RecurringRule[] = [];
  const removedIds: string[] = [];
  const alerts: { title: string; message: string; buttons: any[] }[] = [];
  const refs: any[] = [];
  let cursor = 0, refCursor = 0, failNext: Error | null = null, held: Promise<void> | null = null;
  const ledger = { useLedger: () => ({ archive: data, snapshot: domain.snapshotFromArchive(data), removeAccount: async (id: string) => { if (failNext) { const cause = failNext; failNext = null; throw cause; } removedIds.push(id); }, saveRecurring: async (next: domain.RecurringRule) => {
    if (held) { const pending = held; held = null; await pending; }
    if (failNext) { const cause = failNext; failNext = null; throw cause; }
    saved.push(next);
  } }) };
  const names = ['ActionButton', 'AppText', 'CategoryBadge', 'MerchantBadge', 'Choices', 'DetailRow', 'EmptyState', 'EntryRow', 'ErrorMessage', 'IconButton', 'Money', 'PressFeedback',
    'Screen', 'SectionTitle', 'Stat', 'StatRow', 'Surface', 'AccountRow', 'AccountBadge', 'LifecycleNote'];
  let backs = 0;
  const theme = { space: { xs: 4, s: 8, m: 12, l: 16, xl: 20, xxl: 24, xxxl: 32 }, useCurrentDay: () => '2026-09-20', useReduceMotion: () => true,
    usePalette: () => ({ text: '#000', secondary: '#666', tertiary: '#999', line: '#ddd', inset: '#eee', expense: '#c00', income: '#080', warning: '#a60', primary: '#2557D6', link: '#1D5647', background: '#fff', surface: '#fff' }) };
  const modules: Record<string, unknown> = {
    // 24UX6C: the transaction presentation rule, a pure module.
    '../src/ui/movement-amount': movementAmount, '../../src/ui/movement-amount': movementAmount,
    '../i18n/format': i18nFormat, '../src/i18n/format': i18nFormat, '../../src/i18n/format': i18nFormat, '../i18n/provider': i18nProvider, '../src/i18n/provider': i18nProvider, '../../src/i18n/provider': i18nProvider,
    react: { useEffect: (fn: () => unknown) => { fn(); }, useMemo: (fn: () => unknown) => fn(),
      useRef: (initial: unknown) => { const i = refCursor++; return refs[i] ??= { current: initial }; }, useState: (initial: unknown) => {
      const index = cursor++;
      if (!(index in state)) state[index] = typeof initial === 'function' ? (initial as () => unknown)() : initial;
      return [state[index], (value: unknown) => { state[index] = typeof value === 'function' ? (value as (current: unknown) => unknown)(state[index]) : value; }];
    } },
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'react-native': { View: 'View', SectionList: 'SectionList', Switch: 'Switch', StyleSheet: { hairlineWidth: 0.5 }, useWindowDimensions: () => windowSize,
      Alert: { alert: (title: string, message: string, buttons: any[]) => alerts.push({ title, message, buttons }) } },
    'react-native-reanimated': { __esModule: true, default: { View: 'Animated.View' }, useSharedValue: (value: number) => ({ value }),
      withTiming: (value: number) => value, useAnimatedStyle: (fn: () => unknown) => fn() },
    'expo-haptics': { selectionAsync: async () => {}, notificationAsync: async () => {}, NotificationFeedbackType: { Success: 'Success' } },
    'expo-router': { Stack: { Screen: 'Stack.Screen' }, Redirect: 'Redirect', useLocalSearchParams: () => params,
      router: { push: (to: unknown) => pushed.push(to), replace: (to: unknown) => pushed.push(to), canGoBack: () => true, back: () => { backs++; } } },
    '@finanzapp/domain': domain,
    '@expo/vector-icons/Ionicons': 'Ionicons',
    '../src/ui/geometry': geometry, '../../src/ui/geometry': geometry,
    '../src/storage/LedgerProvider': ledger, '../../src/storage/LedgerProvider': ledger, '../storage/LedgerProvider': ledger,
    '../src/ui/swipe-actions': swipeActionsMock, '../../src/ui/swipe-actions': swipeActionsMock,
    './components': { ...Object.fromEntries(names.map(name => [name, name])), useStacked: () => false },
    '../src/ui/components': { ...Object.fromEntries(names.map(name => [name, name])), useStacked: () => false }, '../../src/ui/components': { ...Object.fromEntries(names.map(name => [name, name])), useStacked: () => false },
    '../src/ui/entry-list': { EntryList: 'EntryList' }, '../../src/ui/entry-list': { EntryList: 'EntryList' },
    '../src/ui/currency-switch': { CurrencySwitch: 'CurrencySwitch' }, '../../src/ui/currency-switch': { CurrencySwitch: 'CurrencySwitch' },
    '../src/ui/quick-actions': { QuickActions: 'QuickActions', AssistantEntry: 'AssistantEntry' }, '../../src/ui/quick-actions': { QuickActions: 'QuickActions', AssistantEntry: 'AssistantEntry' },
    '../src/ui/motion': { ValueTransition: 'ValueTransition', Reflow: 'Reflow', selectionHaptic: () => {}, impactHaptic: () => {}, duration: { press: 100, release: 160, state: 200, data: 260, enter: 200, exit: 100, reveal: 480 }, timing: (kind: string, reduced: boolean) => ({ duration: reduced ? 0 : 260 }) }, '../../src/ui/motion': { ValueTransition: 'ValueTransition', Reflow: 'Reflow', selectionHaptic: () => {}, impactHaptic: () => {}, duration: { press: 100, release: 160, state: 200, data: 260, enter: 200, exit: 100, reveal: 480 }, timing: (kind: string, reduced: boolean) => ({ duration: reduced ? 0 : 260 }) },
    './presentation': presentation, '../src/ui/presentation': presentation, '../../src/ui/presentation': presentation, '../src/ui/report-presentation': reportPresentation,
    '../src/ui/budget-presentation': budgetPresentation, '../../src/ui/budget-presentation': budgetPresentation,
    './theme': theme, '../src/ui/theme': theme, '../../src/ui/theme': theme,
    '../src/ui/use-default-currency': { useDefaultCurrency: () => 'ARS' },
    '../src/ui/category-hues': { useCategoryColor: () => '#3E6FB0', useCategoryLabel: (s: string) => s, useCategoryDefinitions: () => [], useCategoryLook: (s: string) => ({ label: s, storedLabel: s, key: String(s).toLowerCase(), hex: '#3E6FB0', glyph: 'pricetag-outline' }), useCategoryLookOf: () => (s: string) => ({ label: s, storedLabel: s, key: String(s).toLowerCase(), hex: '#3E6FB0', glyph: 'pricetag-outline' }), useAccountLook: () => ({ icon: 'wallet', color: 'cobalt', glyph: 'wallet-outline', hex: '#2557D6' }), useAccountNameOf: () => (account: any) => account.name, useAccountLookOf: () => () => ({ icon: 'wallet', color: 'cobalt', glyph: 'wallet-outline', hex: '#2557D6' }) }, '../../src/ui/category-hues': { useCategoryColor: () => '#3E6FB0', useCategoryLabel: (s: string) => s, useCategoryDefinitions: () => [], useCategoryLook: (s: string) => ({ label: s, storedLabel: s, key: String(s).toLowerCase(), hex: '#3E6FB0', glyph: 'pricetag-outline' }), useCategoryLookOf: () => (s: string) => ({ label: s, storedLabel: s, key: String(s).toLowerCase(), hex: '#3E6FB0', glyph: 'pricetag-outline' }), useAccountLook: () => ({ icon: 'wallet', color: 'cobalt', glyph: 'wallet-outline', hex: '#2557D6' }), useAccountNameOf: () => (account: any) => account.name, useAccountLookOf: () => () => ({ icon: 'wallet', color: 'cobalt', glyph: 'wallet-outline', hex: '#2557D6' }) },
  };
  const require = (name: string) => {
    if (!Object.hasOwn(modules, name)) throw new Error('Unexpected polish dependency: ' + name);
    return modules[name];
  };
  // 24UX4: the management hooks run for real (their Alert, save and haptic are the mocks above); 25B3: so does the
  // rule detail's history (its rows are the EntryRow descriptor).
  modules['../src/ui/commitment-actions'] = modules['../../src/ui/commitment-actions'] = realModule('src/ui/commitment-actions.ts', require);
  modules['../../src/ui/recurring-history'] = realModule('src/ui/recurring-history.tsx', require);
  const module = { exports: {} as { default?: () => Node } };
  runInNewContext(code, { module, exports: module.exports, require, Error });
  return { render: () => { cursor = 0; refCursor = 0; return module.exports.default!(); }, pushed, saved, alerts, removedIds, backs: () => backs, failSave: (cause: Error) => { failNext = cause; },
    // The next save waits until the returned function is called: the screen is observed mid-write.
    holdSave: () => { let release!: () => void; held = new Promise<void>(resolve => { release = resolve; }); return release; } };
}
function nodes(value: any): Node[] {
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!value.props) return [];
  const own = typeof value.type === 'function' ? nodes(value.type(value.props)) : [];
  return [value, ...own, ...nodes(value.props.children), ...nodes(value.props.header), ...nodes(value.props.action),
    ...nodes(value.props.ListHeaderComponent), ...nodes(value.props.ListFooterComponent)];
}
function find(root: Node, type: string, label?: string): Node {
  const node = nodes(root).find(item => item.type === type && (!label || item.props.label === label || item.props.accessibilityLabel === label || item.props.action === label));
  assert.ok(node, 'Missing ' + type + ' ' + (label ?? ''));
  return node;
}

/** The trailing swipe actions of the first rule row, and one of them by key. */
const swipeLabels = (root: Node) => find(root, 'SwipeRow').props.actions.map((action: { label: string }) => action.label).join(',');
const swipe = (root: Node, key: string) => find(root, 'SwipeRow').props.actions.find((action: { key: string }) => action.key === key);
const total: domain.MonthlyBudget = { id: 'b-total', scope: 'total', currency: 'ARS', monthISO: '2026-09', amountMinor: 20000, active: true, createdAt, revision: 0, updatedAt: createdAt };
const texts = (root: Node) => nodes(root).filter(node => node.type === 'AppText').map(node => Array.isArray(node.props.children) ? node.props.children.join('') : String(node.props.children));

test('budgets without a general budget list the sublimits, offer a compact general action and never sum sublimits into a total', () => {
  const view = harness('budgets.tsx', { currency: 'ARS' });
  const root = view.render();
  // Café: 3000 of 2500 (exceeded). Supermercado: 9000 of 10000 (90 %, near). No invented 12.500 monthly total.
  assert.equal(nodes(root).some(node => node.type === 'Money' && node.props.large), false, 'no summed hero');
  assert.equal(nodes(root).some(node => node.type === 'Money' && node.props.minor === 500), false, 'sublimits are never added up');
  const add = find(root, 'ActionButton', 'Agregar presupuesto general');
  assert.equal(add.props.compact, true);
  add.props.onPress();
  assert.equal(JSON.stringify(view.pushed.at(-1)), JSON.stringify({ pathname: '/new-budget', params: { currency: 'ARS', month: '2026-09', scope: 'total' } }));
  const rows = nodes(root).filter(node => typeof node.type === 'function' && node.props.row);
  assert.deepEqual(rows.map(node => [node.props.row.budget.category, node.props.row.exceeded, Math.round(node.props.row.ratio * 100)]), [['Café', true, 120], ['Supermercado', false, 90]]);
  const labels = nodes(root).filter(node => node.type === 'PressFeedback').map(node => node.props.accessibilityLabel).filter(Boolean);
  assert.ok(labels.some(label => /Café: 30,00 pesos de 25,00 pesos, 120 por ciento\. Excedido por 5,00 pesos/.test(label)));
  assert.ok(labels.some(label => /Supermercado.*90 por ciento\. Quedan 10,00 pesos/.test(label)));
  const section = find(root, 'SectionTitle', 'Agregar');
  assert.equal(section.props.children, 'Por categoría');
  assert.match(section.props.caption, /2 categorías · 1 excedida · 1 cerca del límite/);
  section.props.onAction();
  assert.equal(JSON.stringify(view.pushed.at(-1)), JSON.stringify({ pathname: '/new-budget', params: { currency: 'ARS', month: '2026-09', scope: 'category' } }));
  assert.equal(texts(root).some(text => text.includes('Además gastaste')), false, 'every September expense has a sublimit here, so no unbudgeted line');
  const partial = harness('budgets.tsx', { currency: 'ARS' }, { ...archive, budgets: [budgets[0]] }).render();
  assert.ok(texts(partial).some(text => text.includes('Además gastaste $\u00A090,00 en categorías sin límite propio')), 'unbudgeted spending stays visible');
  find(root, 'IconButton', 'Mes siguiente').props.onPress();
  assert.equal(find(view.render(), 'EmptyState').props.title, 'Dale un límite a tu mes');
});

test('a general budget is the primary summary over all recorded expenses, with sublimits under it', () => {
  const view = harness('budgets.tsx', { currency: 'ARS' }, { ...archive, budgets: [...budgets, total] });
  const root = view.render();
  // September ARS expenses: 3.000 + 9.000 = 12.000 of 20.000 (60 %); income and the card are not spending.
  const panel = nodes(root).find(node => typeof node.type === 'function' && node.props.total)!;
  assert.equal(panel.props.total.spentMinor, 12000);
  assert.equal(panel.props.total.remainingMinor, 8000);
  const hero = nodes(root).find(node => node.type === 'Money' && node.props.large)!;
  assert.equal(hero.props.minor, 8000, 'disponible of the general budget');
  const stats = nodes(root).filter(node => node.type === 'Stat').map(node => node.props.label);
  assert.deepEqual(stats, ['Gastado', 'Límite']);
  assert.ok(texts(root).some(text => text.startsWith('60\u00A0% utilizado')), '24UX6E: formatPercent, the string Inicio shows');
  const general = find(root, 'SectionTitle', 'Editar');
  assert.equal(general.props.children, 'Presupuesto general');
  general.props.onAction();
  assert.equal(JSON.stringify(view.pushed.at(-1)), JSON.stringify({ pathname: '/edit-budget/[id]', params: { id: 'b-total' } }));
  assert.equal(nodes(root).some(node => node.type === 'ActionButton' && node.props.label === 'Agregar presupuesto general'), false);
  assert.equal(nodes(root).filter(node => typeof node.type === 'function' && node.props.row).length, 2, 'sublimits still listed');
  const label = nodes(root).find(node => node.type === 'View' && typeof node.props.accessibilityLabel === 'string' && node.props.accessibilityLabel.startsWith('Presupuesto general'))!;
  assert.equal(label.props.accessibilityLabel, 'Presupuesto general: 120,00 pesos de 200,00 pesos, 60 por ciento usado. Disponible 80,00 pesos');
});

test('an exceeded general budget and a general budget alone are both honest', () => {
  const exceeded = harness('budgets.tsx', { currency: 'ARS' }, { ...archive, budgets: [{ ...total, amountMinor: 10000 }] }).render();
  assert.equal(nodes(exceeded).find(node => node.type === 'Money' && node.props.large)!.props.minor, 2000, 'excedido por 20,00');
  assert.ok(texts(exceeded).some(text => text === '120\u00A0% utilizado · excedido'));
  assert.ok(texts(exceeded).some(text => text.includes('Sin límites por categoría este mes')));
  assert.equal(nodes(exceeded).filter(node => typeof node.type === 'function' && node.props.row).length, 0);
  const exact = harness('budgets.tsx', { currency: 'ARS' }, { ...archive, budgets: [{ ...total, amountMinor: 12000 }] }).render();
  assert.ok(texts(exact).some(text => text === '100\u00A0% utilizado · límite alcanzado'));
  const usd = harness('budgets.tsx', { currency: 'USD' }, { ...archive, budgets: [total, { ...total, id: 'usd-total', currency: 'USD', amountMinor: 50000 }] }).render();
  const usdPanel = nodes(usd).find(node => typeof node.type === 'function' && node.props.total)!;
  assert.equal(usdPanel.props.total.budget.id, 'usd-total');
  assert.equal(usdPanel.props.total.spentMinor, 0, 'ARS spending never counts against the USD budget');
});

test('recurrentes projects the next 30 days per currency and pausing advances nothing silently', async () => {
  const view = harness('recurring.tsx');
  const root = view.render();
  const stats = nodes(root).filter(node => node.type === 'Stat').map(node => node.props.label);
  // 24UX6E: «Gastos» (never «Pagos»: nothing is paid) on its own row; nothing comes in, so no «Ingresos $ 0,00».
  assert.deepEqual(stats.slice(0, 2), ['Gastos\u00A0·\u00A0ARS', 'Vencimientos']);
  assert.equal(find(root, 'Money').props.minor, 40000);
  const row = nodes(root).find(node => typeof node.type === 'function' && node.props.rule)!;
  assert.equal(row.props.rule.id, 'rent');
  assert.equal(nodes(root).some(node => node.type === 'Switch'), false, '24UX4: the row switch gave way to the swipe actions');
  await swipe(root, 'pause').onPress();
  assert.equal(view.saved[0].active, false);
  assert.equal(view.saved[0].nextDateISO, '2026-10-01');
  assert.equal(view.saved[0].revision, 1);
});

test('24UX5 review: Recurrentes opens with a rule more than 366 dates behind beside a normal one; the forecast counts only the next 30 days', () => {
  // Before the fix, recurringForecastByCurrency threw for the stale rule during render and the screen never appeared.
  const stale: domain.RecurringRule = { ...rule, id: 'stale', merchant: 'Gimnasio', frequency: 'weekly', amountMinor: 1000, anchorDateISO: '2010-01-07', nextDateISO: '2010-01-07' };
  const data = { ...archive, recurring: [rule, stale] };
  assert.throws(() => domain.recurringOccurrencesThrough(stale, '2026-10-20'), /demasiados/, 'the fixture really is past the 366 guard');
  for (const locale of ['es-AR', 'en-AR'] as AppLocale[]) {
    const root = harness('recurring.tsx', {}, data, locale).render();
    const rows = nodes(root).filter(node => typeof node.type === 'function' && node.props.rule).map(node => node.props.rule.id);
    assert.deepEqual(rows, ['stale', 'rent'], locale + ': both rules are listed');
    // Next 30 days from 2026-09-20: rent on 2026-10-01 and the weekly rule's own dates inside the window (Thursdays
    // 24 Sep, 1, 8, 15 Oct), never its past backlog.
    const forecast = nodes(root).filter(node => node.type === 'Money')[0];
    assert.equal(forecast.props.minor, 40000 + 4 * 1000);
  }
  // The pure projection stays defensive on its own too.
  assert.deepEqual(domain.recurringForecastByCurrency([stale], [cash], '2026-09-20', 30).map(item => item.status === 'ready' && item.count), [4]);
});

test('accounts list shows liquid totals per currency and hides card accounts', () => {
  const root = harness('accounts.tsx').render();
  const list = find(root, 'SectionList');
  assert.deepEqual(list.props.sections.map((section: { currency: string; data: domain.Account[] }) => [section.currency, section.data.map(account => account.id)]),
    [['ARS', ['cash', 'wallet']], ['USD', ['usd']]]);
  const header = list.props.renderSectionHeader({ section: list.props.sections[0] });
  // Banco 100000 + 50000 − 3000 − 9000 − 700 + Efectivo 5000; the card's −20000 is excluded.
  assert.equal(find(header, 'Money').props.minor, 142300);
  assert.equal(find(list.props.renderSectionHeader({ section: list.props.sections[1] }), 'Money').props.minor, 300);
});

test('account detail shows this month in and out, three actions and redirects obligations to their own screens', () => {
  const view = harness('account/[id].tsx', { id: 'cash' });
  const root = view.render();
  assert.equal(find(root, 'Money').props.minor, 137300);
  const stats = nodes(root).filter(node => node.type === 'Stat');
  assert.deepEqual(stats.map(node => node.props.label), ['Gastos este mes', 'Ingresos este mes']);
  // 24UX6E: «Gastos este mes» is a labelled sum, unsigned in ink (24UX6C); «Ingresos este mes» keeps its «+» in green.
  const spent = nodes(stats[0]).find(node => node.type === 'Money')!;
  assert.equal(spent.props.minor, 12000);
  assert.equal(spent.props.signed, undefined);
  assert.equal(spent.props.tone, undefined);
  assert.equal(spent.props.color, undefined);
  const earned = nodes(stats[1]).find(node => node.type === 'Money')!;
  assert.equal(earned.props.minor, 50000);
  assert.equal(earned.props.signed, true);
  assert.equal(earned.props.tone, 'income');
  const actions = find(root, 'QuickActions');
  assert.equal(actions.props.accountId, 'cash');
  assert.equal(actions.props.currency, 'ARS');
  assert.equal(nodes(root).some(node => node.type === 'AppText' && /sincronizaci/.test(String(node.props.children))), false, 'no bank disclaimer copy');
  const redirect = harness('account/[id].tsx', { id: 'card-acc' }).render();
  assert.equal(redirect.type, 'Redirect');
  assert.equal(JSON.stringify(redirect.props.href), JSON.stringify({ pathname: '/card/[id]', params: { id: 'card' } }));
});

test('24T3 (review): a cash account whose devoluciones net the month below zero reads «Devoluciones netas este mes» with the excess; the ledger and the balance are untouched', () => {
  // The account's September (the clock is 2026-09-20): Café 30,00 and Super 90,00 bought, plus an August TV of 200,00.
  // Devoluciones are negative expense lines in their own month and account (24T3); the account detail only words the net.
  const tv: domain.Entry = { id: 'tv', accountId: cash.id, kind: 'expense', amountMinor: 20000, merchant: 'Electro', category: 'Hogar', dateISO: '2026-08-20', createdAt };
  const base: domain.LedgerArchive = { ...archive, records: [...entries, tv].map(domain.initialRecord) };
  const refund = (data: domain.LedgerArchive, id: string, entryId: string, amountMinor: number, dateISO: string) => domain.applyNewOperation(data,
    domain.newEntryRefund(data, { id, entryId, amountMinor, dateISO, todayISO: '2026-09-20', createdAt: dateISO + 'T15:00:00.000Z' }), '2026-09-20');
  const facts = (root: Node) => nodes(root).filter(node => node.type === 'Stat').map(node => node.props.label + '=' + nodes(node).find(item => item.type === 'Money')!.props.minor);
  // Balance: the opening 1000,00, income 500,00, the purchases (30 + 90 + 7 + 200) and every devolución back.
  const balance = (data: domain.LedgerArchive) => find(harness('account/[id].tsx', { id: 'cash' }, data).render(), 'Money').props.minor;
  const cases: [string, domain.LedgerArchive, string, number][] = [
    ['spending > refunds', refund(base, 'r1', 'e2', 2000, '2026-09-15'), 'Gastos este mes=10000', 2000],
    ['spending == refunds', refund(refund(base, 'r1', 'e2', 9000, '2026-09-15'), 'r2', 'e1', 3000, '2026-09-16'), 'Gastos este mes=0', 12000],
    ['refunds > spending', refund(base, 'r1', 'tv', 15000, '2026-09-18'), 'Devoluciones netas este mes=3000', 15000],
  ];
  for (const [name, data, fact, back] of cases) {
    const root = harness('account/[id].tsx', { id: 'cash' }, data).render();
    assert.equal(facts(root).join(','), fact + ',Ingresos este mes=50000', name);
    const shown = nodes(root).filter(node => node.type === 'Money').map(node => node.props);
    assert.equal(shown.some(props => props.minor < 0), false, name + ': no negative amount on screen');
    const spent = nodes(nodes(root).find(node => node.type === 'Stat')!).find(node => node.type === 'Money')!;
    assert.equal(JSON.stringify([spent.props.signed, spent.props.tone, spent.props.color]), JSON.stringify([undefined, undefined, undefined]), name + ': unsigned ink, never income green');
    // The balance is what the ledger says (the devolución is money back in the account), the same with or without this wording.
    assert.equal(balance(data), 100000 + 50000 - 3000 - 9000 - 700 - 20000 + back, name);
    assert.equal(balance(data), domain.accountBalanceMinor(cash, domain.snapshotFromArchive(data).entries.filter(entry => entry.accountId === 'cash'), []), name);
  }
  // The refund stays a negative expense line in the ledger every reader shares (Inicio, Reportes, Presupuestos net it).
  const over = cases[2][1];
  const line = domain.snapshotFromArchive(over).entries.find(entry => entry.accountId === 'cash' && entry.amountMinor < 0)!;
  assert.equal(JSON.stringify([line.kind, line.amountMinor, line.dateISO, line.category]), JSON.stringify(['expense', -15000, '2026-09-18', 'Hogar']));
  // VoiceOver: one element that says what the fact means and the excess, spoken; the ordinary fact keeps Stat + Money.
  const spanish = harness('account/[id].tsx', { id: 'cash' }, over).render();
  const group = nodes(spanish).find(node => node.type === 'View' && node.props.accessible && /Devoluciones netas/.test(node.props.accessibilityLabel ?? ''))!;
  assert.ok(group, 'the net-refunds fact is one accessible element');
  assert.equal(group.props.accessibilityLabel, 'Devoluciones netas este mes: las devoluciones superan lo gastado en 30,00 pesos');
  assert.ok(Object.hasOwn(group.props, 'accessibilityLanguage'), 'VoiceOver\'s language follows the interface (speechLanguage)');
  assert.equal(nodes(group).find(node => node.type === 'Stat')!.props.label, 'Devoluciones netas este mes');
  assert.equal(nodes(harness('account/[id].tsx', { id: 'cash' }).render()).some(node => node.type === 'View' && node.props.accessible), false, 'an ordinary month adds no wrapper');
  const english = harness('account/[id].tsx', { id: 'cash' }, over, 'en-AR').render();
  assert.equal(facts(english).join(','), 'Net refunds this month=3000,Income this month=50000');
  const spoken = nodes(english).find(node => node.type === 'View' && node.props.accessible)!;
  assert.match(spoken.props.accessibilityLabel, /^Net refunds this month: refunds exceed spending by 30\.00 /);
  assert.doesNotMatch(spoken.props.accessibilityLabel, /\$|-|−/, 'spoken, unsigned');
  // A card's account keeps its own screen (no monthly fact there); its lines would read the same if a surface ever asked.
  const cardBuy: domain.Entry = { id: 'card-buy', accountId: cardAccount.id, kind: 'expense', amountMinor: 8000, merchant: 'Tienda', category: 'Ropa', dateISO: '2026-08-25', createdAt };
  const onCard = refund({ ...archive, records: [...entries, cardBuy].map(domain.initialRecord) }, 'rc', 'card-buy', 5000, '2026-09-19');
  assert.equal(harness('account/[id].tsx', { id: 'card-acc' }, onCard).render().type, 'Redirect');
  const cardLines = domain.snapshotFromArchive(onCard).entries.filter(entry => entry.accountId === cardAccount.id);
  assert.equal(JSON.stringify(presentation.accountMonthFacts(cardLines, '2026-09-20')), JSON.stringify({ spending: { kind: 'netRefunds', minor: 5000 }, incomeMinor: 0 }));
  // The rule on its own: zero is ordinary spending; only below zero is the excess of devoluciones.
  assert.equal(JSON.stringify([-1, 0, 1].map(presentation.monthSpending)), JSON.stringify([{ kind: 'netRefunds', minor: 1 }, { kind: 'spent', minor: 0 }, { kind: 'spent', minor: 1 }]));
  assert.equal(presentation.accountMonthFacts([{ ...entries[0], amountMinor: Number.MAX_SAFE_INTEGER }, { ...entries[1], amountMinor: Number.MAX_SAFE_INTEGER }], '2026-09-20'), null, 'unsafe sums: no figure');
  // Exact sums: a running total that passes the safe range and comes back with devoluciones is still exact (a Number sum
  // here gives 7999999999999990).
  const huge = (amountMinor: number, index: number): domain.Entry => ({ ...entries[0], id: 'h' + index, amountMinor });
  const swing = [...Array.from({ length: 9 }, () => 999999999999999), 1, 999999999999997, -999999999999999, -999999999999999].map(huge);
  assert.equal(JSON.stringify(presentation.accountMonthFacts(swing, '2026-09-20')), JSON.stringify({ spending: { kind: 'spent', minor: 7999999999999991 }, incomeMinor: 0 }));
});

test('in English Recurrentes reads in English, keeps merchant and account names, and pausing writes what Spanish writes', async () => {
  const english = harness('recurring.tsx', {}, archive, 'en-AR'), spanish = harness('recurring.tsx');
  const root = english.render();
  assert.equal(find(root, 'Stack.Screen').props.options.title, 'Recurring');
  assert.equal(nodes(root).filter(node => node.type === 'Stat').map(node => node.props.label).slice(0, 2).join(','), 'Expenses · ARS,Due');
  const sections = nodes(root).filter(node => node.type === 'SectionTitle').map(node => node.props.children);
  assert.equal(sections.join(','), 'Next 30 days,Active');
  const press = nodes(root).find(node => node.type === 'PressFeedback')!;
  // 25B3: the row is the rule, not an action: VoiceOver hears what it is and that it opens details; a tap opens the detail, never the form.
  assert.equal(press.props.accessibilityLabel, 'Alquiler, expense, monthly, Hogar, 400.00 ARS, next Oct 1');
  assert.equal(press.props.accessibilityHint, 'Opens the details of this recurring item');
  press.props.onPress();
  assert.equal(JSON.stringify(english.pushed.at(-1)), JSON.stringify({ pathname: '/recurring/[id]', params: { id: 'rent' } }));
  const spanishPress = nodes(spanish.render()).find(node => node.type === 'PressFeedback')!;
  assert.equal(spanishPress.props.accessibilityHint, 'Abre el detalle del recurrente');
  spanishPress.props.onPress();
  assert.equal(JSON.stringify(spanish.pushed.at(-1)), JSON.stringify({ pathname: '/recurring/[id]', params: { id: 'rent' } }));
  const captions = texts(root);
  // 24UX2: frequency · category · account on the left; the due day once, beside the amount (beyond a week, the date).
  assert.ok(captions.includes('Monthly · Hogar · Banco'), 'merchant, category and account name stay as the user wrote them');
  assert.ok(captions.includes('Oct 1'));
  assert.equal(captions.some(caption => /In 11 days|Oct 1 ·/.test(caption)), false, 'the date is not repeated');
  assert.ok(texts(spanish.render()).includes('Mensual · Hogar · Banco'));
  assert.ok(texts(spanish.render()).includes('1 oct'));
  assert.equal(swipeLabels(root), 'Pause,Delete');
  await swipe(root, 'pause').onPress();
  await swipe(spanish.render(), 'pause').onPress();
  const stable = (rule: domain.RecurringRule) => JSON.stringify({ ...rule, updatedAt: '' });
  assert.equal(stable(english.saved[0]), stable(spanish.saved[0]));
  const paused = harness('recurring.tsx', {}, { ...archive, recurring: [{ ...rule, active: false }] }, 'en-AR').render();
  assert.ok(texts(paused).includes('Paused'));
  // 24UX2: a paused rule keeps full-contrast ink and never announces a next date.
  assert.equal(nodes(paused).find(node => node.type === 'PressFeedback')!.props.accessibilityLabel, 'Alquiler, expense, monthly, Hogar, 400.00 ARS, paused');
  assert.equal(nodes(paused).some(node => node.type === 'View' && node.props.style?.opacity !== undefined && node.props.style.opacity < 1), false);
  assert.equal(find(paused, 'SectionTitle', undefined).props.caption, 'Not recorded until you resume them');
  assert.equal(swipeLabels(paused), 'Resume,Delete');
});

test('23.1C2: a Recurrentes row due today says the day inside its VoiceOver sentence in lower case; the caption keeps it on its own', () => {
  // The harness day is 2026-09-20. The amount is spoken with the language's decimal mark, whatever the region writes.
  const due = { ...archive, recurring: [{ ...rule, nextDateISO: '2026-09-20' }] };
  const cases = [
    ['es-AR', 'Alquiler, gasto, mensual, Hogar, 400,00 ARS, próximo hoy', 'Hoy'],
    ['es-US', 'Alquiler, gasto, mensual, Hogar, 400,00 ARS, próximo hoy', 'Hoy'],
    ['en-AR', 'Alquiler, expense, monthly, Hogar, 400.00 ARS, next today', 'Today'],
    ['en-US', 'Alquiler, expense, monthly, Hogar, 400.00 ARS, next today', 'Today'],
  ] as const;
  for (const [locale, label, caption] of cases) {
    const root = harness('recurring.tsx', {}, due, locale).render();
    assert.equal(nodes(root).find(node => node.type === 'PressFeedback')!.props.accessibilityLabel, label, locale);
    assert.ok(texts(root).includes(caption), locale + ': ' + texts(root).join(' | '));
  }
  // A day that is not today or yesterday reads the same inline and on its own.
  const later = nodes(harness('recurring.tsx', {}, archive, 'es-AR').render()).find(node => node.type === 'PressFeedback')!;
  assert.equal(later.props.accessibilityLabel, 'Alquiler, gasto, mensual, Hogar, 400,00 ARS, próximo 1 oct');
});

test('in English Presupuestos names the month, the states and the VoiceOver sentences in English; category names are untouched', () => {
  const root = harness('budgets.tsx', { currency: 'ARS', month: '2026-09' }, { ...archive, budgets: [...budgets, total] }, 'en-AR').render();
  assert.equal(find(root, 'Stack.Screen').props.options.title, 'Budgets');
  const shown = texts(root);
  assert.ok(shown.includes('September 2026'));
  assert.ok(shown.includes('Current month'));
  const byCategory = nodes(root).find(node => node.type === 'SectionTitle' && node.props.children === 'By category')!;
  assert.equal(byCategory.props.caption, '2 categories · 1 over · 1 near the limit');
  const spanish = harness('budgets.tsx', { currency: 'ARS', month: '2026-09' }, { ...archive, budgets: [...budgets, total] }).render();
  assert.equal(nodes(spanish).find(node => node.type === 'SectionTitle' && node.props.children === 'Por categoría')!.props.caption,
    '2 categorías · 1 excedida · 1 cerca del límite');
  const labels = nodes(root).map(node => node.props.accessibilityLabel).filter(Boolean);
  assert.ok(labels.some(label => /^Café budget: 30\.00 pesos of 25\.00 pesos, 120 percent\. Over by 5\.00 pesos$/.test(label)), 'the category keeps its stored name');
  assert.ok(labels.some(label => /^Overall budget: 120\.00 pesos of 200\.00 pesos, 60 percent used\. 80\.00 pesos available$/.test(label)));
  assert.ok(shown.includes('60% used'));
  assert.ok(shown.includes('Supermercado'));
  assert.equal(nodes(root).filter(node => node.type === 'Stat').map(node => node.props.label).join(','), 'Spent,Limit');
});

test('in English Cuentas and the account detail read in English; account names stay as written', () => {
  const list = harness('accounts.tsx', {}, archive, 'en-AR').render();
  const sectionList = find(list, 'SectionList');
  assert.ok(texts(sectionList.props.renderSectionHeader({ section: sectionList.props.sections[0] })).includes('Argentine pesos'));
  const spanishList = find(harness('accounts.tsx').render(), 'SectionList');
  assert.ok(texts(spanishList.props.renderSectionHeader({ section: spanishList.props.sections[1] })).includes('Dólares estadounidenses'));
  const root = harness('account/[id].tsx', { id: 'cash' }, archive, 'en-AR').render();
  assert.equal(find(root, 'Stack.Screen').props.options.title, 'Banco');
  assert.equal(nodes(root).filter(node => node.type === 'Stat').map(node => node.props.label).join(','), 'Spent this month,Income this month');
  const rows = nodes(root).filter(node => node.type === 'DetailRow');
  assert.equal(rows.map(node => node.props.label).join(','), 'Recurring', '25B3: the opening balance is no longer a row');
  assert.equal(rows[0].props.value, '1 active');
  assert.equal(find(harness('account/[id].tsx', { id: 'cash' }).render(), 'DetailRow').props.value, '1 activo');
  const missing = harness('account/[id].tsx', { id: 'nope' }, archive, 'en-AR').render();
  assert.equal(find(missing, 'EmptyState').props.title, 'We couldn’t find this account');
});

test('25B3: the account detail prints no opening balance in either language; the recorded balance still starts from openingMinor, which is untouched', () => {
  // Until 25B3 the group under the quick actions ended with «Saldo inicial / Opening balance» (23.1C2 pinned its grouping and
  // its spoken twin). The opening balance stays in storage and in every backup; on screen only the balance it starts is a fact.
  const rich = { ...archive, accounts: archive.accounts.map(account => account.id === 'cash' ? { ...account, openingMinor: 123456789 } : account) };
  for (const locale of ['es-AR', 'en-AR', 'es-US'] as AppLocale[]) {
    const root = harness('account/[id].tsx', { id: 'cash' }, rich, locale).render();
    const rows = nodes(root).filter(node => node.type === 'DetailRow');
    assert.equal(rows.map(node => node.props.label).join(','), locale.startsWith('es') ? 'Recurrentes' : 'Recurring', locale);
    assert.equal(rows[0].props.last, true, 'the group closes on its one row');
    const printed = texts(root).concat(nodes(root).map(node => String(node.props.spokenValue ?? node.props.value ?? ''))).join(' | ');
    assert.doesNotMatch(printed, /Saldo inicial|Opening balance|1\.234\.567|1,234,567|1234567/, locale + ': the opening amount is not printed or spoken anywhere');
    // The hero is the opening balance plus this account's recorded movements: 1.234.567,89 + 500,00 − 30,00 − 90,00 − 7,00.
    assert.equal(find(root, 'Money').props.minor, 123456789 + 50000 - 3000 - 9000 - 700, locale);
  }
  // The stored opening (100000) with the same movements gives 137300: changing openingMinor moves the hero and nothing else.
  assert.equal(find(harness('account/[id].tsx', { id: 'cash' }).render(), 'Money').props.minor, 137300);
  assert.equal(archive.accounts[0].openingMinor, 100000, 'the field is read, never rewritten');
  // A deleted account keeps its balance (25B2) and, with no Recurrentes row, draws no empty group at all.
  const at = '2026-09-27T10:00:00.000Z';
  const gone = nodes(harness('account/[id].tsx', { id: 'cash' }, { ...rich, accounts: rich.accounts.map(item => item.id === 'cash' ? { ...item, revision: 1, updatedAt: at, deletedAt: at } : item) }).render());
  assert.equal(gone.some(node => node.type === 'DetailRow'), false);
  assert.equal(gone.some(node => node.type === 'Surface' && node.props.grouped), false, 'no grouped surface without rows');
  assert.equal(gone.find(node => node.type === 'Money')!.props.minor, 123456789 + 50000 - 3000 - 9000 - 700);
});

test('24B3: Presupuestos with three currencies switches among the currencies present, and a yen budget is measured in yen', () => {
  const yen: domain.Account = { id: 'yen', name: 'Yenes', currency: 'JPY', openingMinor: 0, createdAt };
  const yenBudget: domain.MonthlyBudget = { id: 'b-yen', scope: 'total', currency: 'JPY', monthISO: '2026-09', amountMinor: 20000, active: true, createdAt, revision: 0, updatedAt: createdAt };
  const yenEntry: domain.Entry = { id: 'y1', accountId: yen.id, kind: 'expense', amountMinor: 1500, merchant: 'Konbini', category: 'Comida', dateISO: '2026-09-10', createdAt };
  const data: domain.LedgerArchive = { ...archive, accounts: [...archive.accounts, yen], records: [...archive.records, domain.initialRecord(yenEntry)], budgets: [...budgets, yenBudget] };
  const view = harness('budgets.tsx', { currency: 'ARS' }, data);
  let root = view.render();
  const control = nodes(root).find(node => node.type === 'CurrencySwitch')!;
  assert.deepEqual(control.props.currencies, ['ARS', 'USD', 'JPY']);
  assert.equal(control.props.value, 'ARS');
  control.props.onChange('JPY');
  root = view.render();
  assert.equal(nodes(root).find(node => node.type === 'CurrencySwitch')!.props.value, 'JPY');
  const moneys = nodes(root).filter(node => node.type === 'Money').map(node => [node.props.currency, node.props.minor]);
  assert.deepEqual(moneys, [['JPY', 18500], ['JPY', 1500], ['JPY', 20000]], 'left, spent and limit in yen: 20000 − 1500, never read as cents');
  assert.equal(harness('budgets.tsx', { currency: 'JPY' }, data).render() && nodes(harness('budgets.tsx', { currency: 'JPY' }, data).render()).find(node => node.type === 'CurrencySwitch')!.props.value, 'JPY', 'a link to a held currency opens it');
});

// ---- Producto 24UX6E: Presupuestos in the Forest design -------------------------------------
/** One sublimit row's own nodes (the row component evaluated, so read them inside `withWindow` when the window matters). */
const budgetRow = (root: Node, category: string): Node[] => {
  const row = nodes(root).find(node => typeof node.type === 'function' && node.props.row?.budget.category === category);
  assert.ok(row, 'Missing budget row ' + category);
  return nodes(row);
};
const textOf = (node: Node) => Array.isArray(node.props.children) ? node.props.children.join('') : String(node.props.children);
const appText = (list: Node[], text: string) => {
  const node = list.find(item => item.type === 'AppText' && textOf(item) === text);
  assert.ok(node, 'Missing text ' + JSON.stringify(text) + ' in ' + JSON.stringify(list.filter(item => item.type === 'AppText').map(textOf)));
  return node;
};
const barOf = (list: Node[]) => {
  const fill = list.find(item => item.type === 'Animated.View');
  assert.ok(fill, 'Missing bar');
  return { ...fill.props.style[0], ...fill.props.style[1] } as { height: number; backgroundColor: string; width: string };
};
const NB = ' ';

test('24UX6E: a sublimit row is the category\'s own tile, the name beside the percent Inicio shows, a 4 pt bar of the domain ratio and one quiet line; no chevron (a modal editor), a hint, the spoken sentence unchanged', () => {
  const calm: domain.MonthlyBudget = { ...budgets[1], scope: 'category', id: 'b-hogar', category: 'Hogar', amountMinor: 100000 };
  const root = harness('budgets.tsx', { currency: 'ARS' }, { ...archive, budgets: [...budgets, calm] }).render();
  assert.deepEqual(nodes(root).filter(node => typeof node.type === 'function' && node.props.row).map(node => node.props.row.budget.category), ['Café', 'Supermercado', 'Hogar']);
  for (const category of ['Café', 'Supermercado', 'Hogar']) {
    const row = budgetRow(root, category);
    // M1: the tile is identity only; the state rides on the percent, the bar and the glyph.
    assert.equal(row.find(node => node.type === 'CategoryBadge')!.props.tone, undefined, category + ': the tile keeps its own hue');
    assert.equal(row.some(node => node.type === 'Ionicons' && node.props.name === 'chevron-forward'), false, category + ': a modal editor has no chevron');
    const press = row.find(node => node.type === 'PressFeedback')!;
    assert.equal(press.props.accessibilityHint, 'Abre el presupuesto para editarlo');
    assert.equal(press.props.style.minHeight, 64);
    assert.equal(press.props.style.flexDirection, 'row');
    assert.equal(/\$/.test(press.props.accessibilityLabel), false, category + ': no visible amount in the spoken sentence');
    const detail = row.filter(node => node.type === 'AppText' && node.props.variant === 'footnote');
    assert.equal(detail.length, 1, category + ': one quiet line');
    assert.equal(detail[0].props.secondary, true);
    assert.equal(detail[0].props.style, undefined, category + ': the line is never coloured');
    const track = row.find(node => node.type === 'View' && node.props.importantForAccessibility === 'no-hide-descendants')!;
    assert.equal(track.props.accessible, false);
  }
  const cafe = budgetRow(root, 'Café');
  assert.equal(appText(cafe, '120' + NB + '%').props.style.color, '#c00');
  assert.ok(cafe.some(node => node.type === 'Ionicons' && node.props.name === 'alert-circle' && node.props.color === '#c00'), 'exceeded adds the alert glyph');
  appText(cafe, '$' + NB + '5,00 por encima de $' + NB + '25,00');
  assert.deepEqual([barOf(cafe).height, barOf(cafe).width, barOf(cafe).backgroundColor], [4, '100%', '#c00'], 'drawn full past 100 %');
  assert.match(cafe.find(node => node.type === 'PressFeedback')!.props.accessibilityLabel, /^Presupuesto Café: 30,00 pesos de 25,00 pesos, 120 por ciento\. Excedido por 5,00 pesos$/);
  const supermercado = budgetRow(root, 'Supermercado');
  assert.equal(appText(supermercado, '90' + NB + '%').props.style.color, '#a60');
  assert.equal(supermercado.some(node => node.type === 'Ionicons'), false, 'a warning has no glyph');
  appText(supermercado, 'Quedan $' + NB + '10,00 de $' + NB + '100,00');
  assert.deepEqual([barOf(supermercado).width, barOf(supermercado).backgroundColor], ['90%', '#a60']);
  const hogar = budgetRow(root, 'Hogar');
  assert.equal(appText(hogar, '0' + NB + '%').props.style.color, '#000');
  appText(hogar, 'Quedan $' + NB + '1.000,00 de $' + NB + '1.000,00');
  assert.deepEqual([barOf(hogar).width, barOf(hogar).backgroundColor], ['0%', '#000']);
  assert.equal(texts(root).some(text => text.includes(' de $' + NB + '25,00') && !text.includes('por encima')), false, 'the old «$ 30,00 de $ 25,00» line is gone');
  // Exactly at the limit, and a share past 1000 % printed as Inicio prints it.
  const reached = harness('budgets.tsx', { currency: 'ARS' }, { ...archive, budgets: [{ ...budgets[0], amountMinor: 3000 }] }).render();
  const exact = budgetRow(reached, 'Café');
  assert.equal(appText(exact, '100' + NB + '%').props.style.color, '#a60');
  appText(exact, 'Límite alcanzado · $' + NB + '30,00');
  const huge = budgetRow(harness('budgets.tsx', { currency: 'ARS' }, { ...archive, budgets: [{ ...budgets[0], amountMinor: 243 }] }).render(), 'Café');
  appText(huge, '1.235' + NB + '%');
});

test('24UX6E: a sublimit\'s name and percent share a line only when both fit; at large text or with a long name the row stacks and the name is never truncated', () => {
  const long = 'Supermercado mayorista del barrio con entrega a domicilio';
  assert.ok(long.length <= 60);
  const longBudget: domain.MonthlyBudget = { ...budgets[1], scope: 'category', id: 'b-long', category: long, amountMinor: 50000 };
  const data: domain.LedgerArchive = { ...archive, budgets: [...budgets, longBudget] };
  const line = (row: Node[]) => row.find(node => node.type === 'View' && node.props.style?.justifyContent === 'space-between')!.props.style.flexDirection;
  const name = (row: Node[], text: string) => appText(row, text).props.numberOfLines;
  const root = harness('budgets.tsx', { currency: 'ARS' }, data).render();
  const inline = budgetRow(root, 'Supermercado');
  assert.deepEqual([line(inline), name(inline, 'Supermercado')], ['row', 2]);
  withWindow({ fontScale: 1.35 }, () => {
    const row = budgetRow(harness('budgets.tsx', { currency: 'ARS' }, data).render(), 'Supermercado');
    assert.deepEqual([line(row), name(row, 'Supermercado')], ['column', undefined]);
  });
  withWindow({ width: 375 }, () => {
    const row = budgetRow(harness('budgets.tsx', { currency: 'ARS' }, data).render(), long);
    assert.deepEqual([line(row), name(row, long)], ['column', undefined]);
  });
});

test('24UX6E: the general budget is flat on the canvas (no padded card): «Disponible» over a 40 pt hero in ink up to the limit, the 6 pt bar of the domain ratio with the share used under it, then Gastado · Límite', () => {
  const block = (root: Node) => nodes(root).find(node => node.type === 'View' && typeof node.props.accessibilityLabel === 'string' && node.props.accessibilityLabel.startsWith('Presupuesto general'))!;
  const calm = harness('budgets.tsx', { currency: 'ARS' }, { ...archive, budgets: [...budgets, total] }).render();
  assert.ok(nodes(calm).filter(node => node.type === 'Surface').every(node => node.props.grouped), 'the only container is the grouped sublimit list');
  const view = block(calm);
  assert.equal(view.props.style.gap, 20);
  assert.equal(view.props.children.at(-1).type, 'StatRow', 'the facts come last');
  // The order: «Disponible» and the hero, then the bar with the share used right under it, then the facts.
  assert.equal(view.props.children.length, 3);
  const [heroGroup, progressGroup] = (view.props.children as Node[]).map(child => nodes(child));
  assert.deepEqual([heroGroup.some(node => node.type === 'Money' && node.props.large), heroGroup.some(node => node.type === 'Animated.View')], [true, false]);
  const progressOrder = progressGroup.filter(node => node.type === 'Animated.View' || node.type === 'AppText').map(node => node.type === 'AppText' ? textOf(node) : 'bar');
  assert.deepEqual(progressOrder, ['bar', '60' + NB + '% utilizado'], 'the status line sits under the bar, before Gastado · Límite');
  const inside = nodes(view);
  const hero = inside.find(node => node.type === 'Money' && node.props.large)!;
  assert.deepEqual([hero.props.minor, hero.props.size, hero.props.color], [8000, 40, undefined]);
  const eyebrow = appText(inside, 'Disponible');
  assert.deepEqual([eyebrow.props.variant, eyebrow.props.secondary], ['footnote', true], 'no currency code: the switch above names it');
  assert.deepEqual([barOf(inside).height, barOf(inside).width, barOf(inside).backgroundColor], [6, '60%', '#000']);
  assert.equal(appText(inside, '60' + NB + '% utilizado').props.style.color, '#666');
  assert.equal(inside.some(node => node.type === 'Ionicons'), false);
  // 12.000 of 13.000: 92 %, amber on the bar and the status line; the hero stays ink.
  const warning = nodes(block(harness('budgets.tsx', { currency: 'ARS' }, { ...archive, budgets: [{ ...total, amountMinor: 13000 }] }).render()));
  assert.equal(warning.find(node => node.type === 'Money' && node.props.large)!.props.color, undefined);
  assert.deepEqual([barOf(warning).width, barOf(warning).backgroundColor], [12000 / 13000 * 100 + '%', '#a60'], 'the domain ratio, unrounded');
  const near = appText(warning, '92' + NB + '% utilizado · cerca del límite');
  assert.deepEqual([near.props.style.color, near.props.style.fontWeight], ['#a60', '600']);
  assert.equal(warning.some(node => node.type === 'Ionicons'), false);
  // 12.000 of 10.000: the hero in the alert tone beside «Excedido», the glyph before the status line, the bar full.
  const over = nodes(block(harness('budgets.tsx', { currency: 'ARS' }, { ...archive, budgets: [{ ...total, amountMinor: 10000 }] }).render()));
  assert.deepEqual([over.find(node => node.type === 'Money' && node.props.large)!.props.color, over.find(node => node.type === 'Money' && node.props.large)!.props.minor], ['#c00', 2000]);
  appText(over, 'Excedido');
  assert.ok(over.some(node => node.type === 'Ionicons' && node.props.name === 'alert-circle'));
  assert.deepEqual([barOf(over).width, barOf(over).backgroundColor], ['100%', '#c00']);
});

test('24UX6E: Presupuestos never fails on a malformed month or a month it cannot sum; the unbudgeted line has a spoken twin; «Este mes» is a link with a 44 pt reach', () => {
  const es = bindLocale('es-AR');
  const malformed = harness('budgets.tsx', { currency: 'ARS', month: '2026-13' }).render();
  assert.ok(texts(malformed).includes(es.formatMonthTitle('2026-09')), 'an invalid month opens the current one');
  // Two expenses at the largest safe amount: the month's sum leaves the safe range, so the summary refuses it.
  const big = (id: string): domain.Entry => ({ id, accountId: cash.id, kind: 'expense', amountMinor: Number.MAX_SAFE_INTEGER, merchant: 'X', category: 'Café', dateISO: '2026-09-11', createdAt });
  const data = { ...archive, records: [...archive.records, domain.initialRecord(big('big1')), domain.initialRecord(big('big2'))] };
  assert.throws(() => domain.summarizeMonthlyBudgets(domain.snapshotFromArchive(data), budgets, 'ARS', '2026-09'), /rango seguro/, 'the fixture really overflows');
  const view = harness('budgets.tsx', { currency: 'ARS' }, data);
  let root = view.render();
  assert.deepEqual([find(root, 'EmptyState').props.title, find(root, 'EmptyState').props.detail], ['No pudimos calcular este mes', 'Tus presupuestos y movimientos siguen guardados.']);
  find(root, 'IconButton', 'Mes anterior').props.onPress();
  root = view.render();
  assert.ok(texts(root).includes(es.formatMonthTitle('2026-08')), 'the month stepper stays usable');
  assert.equal(nodes(root).some(node => node.type === 'EmptyState' && node.props.title === 'No pudimos calcular este mes'), false);
  const back = find(root, 'PressFeedback', 'Volver al mes actual');
  assert.equal(JSON.stringify(back.props.hitSlop), JSON.stringify({ top: 8, bottom: 8, left: 8, right: 8 }));
  assert.equal(nodes(back).find(node => node.type === 'AppText')!.props.style.color, '#1D5647', 'the link token');
  const english = harness('budgets.tsx', { currency: 'ARS' }, data, 'en-AR').render();
  assert.equal(find(english, 'EmptyState').props.title, 'We couldn’t calculate this month');
  const partial = harness('budgets.tsx', { currency: 'ARS' }, { ...archive, budgets: [budgets[0]] }).render();
  const unbudgeted = nodes(partial).find(node => node.type === 'AppText' && textOf(node).startsWith('Además gastaste'))!;
  assert.equal(unbudgeted.props.accessibilityLabel, 'Además gastaste 90,00 pesos en categorías sin límite propio.');
});

test('24UX6E: in English a sublimit row reads «left of» / «over», hints in English and keeps the category as stored', () => {
  const en = bindLocale('en-AR');
  const root = harness('budgets.tsx', { currency: 'ARS' }, { ...archive, budgets: [...budgets, total] }, 'en-AR').render();
  const cafe = budgetRow(root, 'Café');
  appText(cafe, en.moneyText(500, 'ARS') + ' over ' + en.moneyText(2500, 'ARS'));
  appText(cafe, '120%');
  assert.equal(cafe.find(node => node.type === 'PressFeedback')!.props.accessibilityHint, 'Opens the budget to edit it');
  appText(budgetRow(root, 'Supermercado'), en.moneyText(1000, 'ARS') + ' left of ' + en.moneyText(10000, 'ARS'));
  appText(nodes(root), '60% used');
});

// ---- Producto 24UX4: pause, resume and delete from the Recurrentes list -----------------------
const recorded = (dateISO: string): domain.Entry => ({ id: domain.recurringEntryId(rule.id, dateISO), accountId: cash.id, kind: 'expense', amountMinor: 40000,
  merchant: 'Alquiler', category: 'Hogar', dateISO, createdAt });

test('24UX6C: a rule row shows its amount as stored: no sign on an expense, «+» on an income; the stored rule is untouched', () => {
  const rowMoney = (root: Node, id: string) => {
    const row = nodes(root).find(node => typeof node.type === 'function' && node.props.rule?.id === id)!;
    assert.ok(row, 'the row of ' + id);
    return nodes(row).find(node => node.type === 'Money')!.props;
  };
  const salary: domain.RecurringRule = { ...rule, id: 'pay', kind: 'income', merchant: 'Sueldo', category: 'Sueldo', amountMinor: 150000 };
  const before = JSON.stringify([rule, salary]);
  for (const locale of ['es-AR', 'en-AR'] as AppLocale[]) {
    const root = harness('recurring.tsx', {}, { ...archive, recurring: [rule, salary] }, locale).render();
    const rent = rowMoney(root, 'rent');
    assert.equal(JSON.stringify([rent.minor, rent.currency, rent.signed, rent.tone]), JSON.stringify([40000, 'ARS', false, 'expense']), locale + ': the expense as stored, unsigned, in ink');
    const pay = rowMoney(root, 'pay');
    assert.equal(JSON.stringify([pay.minor, pay.currency, pay.signed, pay.tone]), JSON.stringify([150000, 'ARS', true, 'income']), locale + ': the income with its «+»');
    // Without the minus the kind must still reach VoiceOver: the row's sentence names it, right after the merchant.
    const label = (id: string) => nodes(nodes(root).find(node => typeof node.type === 'function' && node.props.rule?.id === id)!)
      .find(node => node.type === 'PressFeedback')!.props.accessibilityLabel as string;
    const [expenseWord, incomeWord] = locale === 'es-AR' ? ['gasto', 'ingreso'] : ['expense', 'income'];
    assert.ok(label('rent').startsWith('Alquiler, ' + expenseWord + ', '), locale + ': ' + label('rent'));
    assert.ok(label('pay').startsWith('Sueldo, ' + incomeWord + ', '), locale + ': ' + label('pay'));
  }
  assert.equal(JSON.stringify([rule, salary]), before, 'rendering never changes a stored rule');
});

test('24UX4: each rule row swipes to Pausar/Reanudar and Eliminar, the same actions VoiceOver lists on the row', () => {
  const root = harness('recurring.tsx').render();
  assert.equal(swipeLabels(root), 'Pausar,Eliminar');
  const tones = find(root, 'SwipeRow').props.actions.map((action: { tone: string }) => action.tone).join(',');
  assert.equal(tones, 'neutral,destructive', 'delete is the red one, at the far edge');
  const press = nodes(root).find(node => node.type === 'PressFeedback')!;
  assert.equal(JSON.stringify(press.props.accessibilityActions), JSON.stringify([{ name: 'pause', label: 'Pausar' }, { name: 'delete', label: 'Eliminar' }]));
  const paused = harness('recurring.tsx', {}, { ...archive, recurring: [{ ...rule, active: false }] }).render();
  assert.equal(swipeLabels(paused), 'Reanudar,Eliminar');
  assert.equal(find(paused, 'SwipeRow').props.actions[0].tone, 'accent');
});

test('24UX4: resuming never records what fell due while paused: the next date moves to today or later on the rule\'s own day', async () => {
  const stale: domain.RecurringRule = { ...rule, active: false, anchorDateISO: '2026-01-31', nextDateISO: '2026-01-31', revision: 3 };
  const view = harness('recurring.tsx', {}, { ...archive, recurring: [stale] });
  await swipe(view.render(), 'resume').onPress();
  const resumed = view.saved[0];
  assert.equal(resumed.active, true);
  assert.equal(resumed.revision, 4);
  assert.ok(resumed.nextDateISO >= domain.todayKey(), 'nothing before today is left to catch up');
  assert.equal(resumed.anchorDateISO, '2026-01-31');
  assert.equal(domain.recurringOccurrencesThrough(resumed, domain.todayKey()).length <= 1, true, 'at most today is recorded');
});

test('24UX4: deleting asks first, names the movements that stay, and writes only the rule\'s deletion record', async () => {
  const data = { ...archive, records: [...archive.records, ...['2026-07-01', '2026-08-01', '2026-09-01'].map(day => domain.initialRecord(recorded(day)))] };
  const view = harness('recurring.tsx', {}, data);
  swipe(view.render(), 'delete').onPress();
  assert.equal(view.saved.length, 0, 'nothing is written before the confirmation');
  const alert = view.alerts[0];
  assert.equal(alert.title, '¿Eliminar «Alquiler»?');
  assert.equal(alert.message, 'Deja de registrarse. Los 3 movimientos que ya registró siguen en Movimientos.');
  assert.equal(alert.buttons.map((button: { text: string; style?: string }) => button.text + ':' + (button.style ?? '')).join(','), 'Cancelar:cancel,Eliminar:destructive');
  alert.buttons[0].onPress?.();
  assert.equal(view.saved.length, 0, 'Cancelar changes nothing');
  await alert.buttons[1].onPress();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(view.saved.length, 1);
  assert.equal(JSON.stringify({ ...view.saved[0], updatedAt: '' }), JSON.stringify({ ...rule, active: false, deleted: true, revision: 1, updatedAt: '' }));
  // Once stored, the rule leaves the list; the movements it recorded are untouched by this screen.
  const after = harness('recurring.tsx', {}, { ...data, recurring: [view.saved[0]] }).render();
  assert.equal(nodes(after).some(node => node.type === 'SwipeRow'), false);
  assert.equal(find(after, 'EmptyState').props.title, 'Nada recurrente todavía');
  // A rule that never recorded anything says so; English reads the same flow.
  const fresh = harness('recurring.tsx', {}, archive, 'en-AR');
  swipe(fresh.render(), 'delete').onPress();
  assert.equal(fresh.alerts[0].title, 'Delete “Alquiler”?');
  assert.equal(fresh.alerts[0].message, 'It stops being recorded. No transaction is deleted.');
});

test('24UX4: a failed pause keeps the rule as it was and says so; a retry writes the same change once', async () => {
  const view = harness('recurring.tsx');
  view.failSave(new Error('Disk full'));
  await swipe(view.render(), 'pause').onPress();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(view.saved.length, 0);
  assert.equal(find(view.render(), 'ErrorMessage').props.message, 'Disk full');
  await swipe(view.render(), 'pause').onPress();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(view.saved.length, 1);
  assert.equal(view.saved[0].active, false);
  assert.equal(find(view.render(), 'ErrorMessage').props.message, null);
});


// ---- Producto 25B2: deleting a normal account from Cuentas; a deleted account's detail -----------------------------

test('25B2: every Cuentas row swipes to one destructive Eliminar (the same action in VoiceOver\'s rotor); the action only asks, Eliminar writes the record once, a deleted account leaves the list', async () => {
  const view = harness('accounts.tsx');
  const root = view.render();
  // A SectionList's rows are drawn by `renderItem`: rendered here per section item, like the header test above. The swipe
  // container is whatever the harness stands in for SwipeRow: found by its `actions`, the row inside it by its type.
  const list = find(root, 'SectionList');
  const rendered = list.props.sections.flatMap((section: { data: domain.Account[] }) => section.data.map((item: domain.Account, index: number) => list.props.renderItem({ item, index, section })));
  const rows = nodes(rendered).filter(node => Array.isArray(node.props?.actions) && nodes(node.props.children).some(child => child.type === 'AccountRow'));
  assert.equal(rows.length, 3, 'the three liquid accounts; the card\'s account is not here');
  for (const row of rows) {
    assert.equal(JSON.stringify(row.props.actions.map((action: any) => [action.key, action.tone, action.label])), JSON.stringify([['delete', 'destructive', 'Eliminar']]));
    const account = nodes(row.props.children).find(node => node.type === 'AccountRow')!;
    assert.equal(account.props.accessibility.accessibilityActions[0].label, 'Eliminar');
  }
  // The action (a tap on the revealed button, or the rotor) opens the confirmation; nothing is written yet.
  rows[0].props.actions[0].onPress();
  assert.equal(view.alerts.length, 1);
  assert.equal(view.alerts[0].title, '¿Eliminar Banco?');
  assert.match(view.alerts[0].message, /^Deja de aparecer en tus cuentas, en Disponible y en los formularios\. No borra nada: \d+ movimientos y \d+ transferencias? siguen en Movimientos/);
  assert.equal(view.removedIds.length, 0);
  view.alerts[0].buttons[0].onPress?.();
  assert.equal(view.removedIds.length, 0, 'Cancelar writes nothing');
  view.alerts[0].buttons[1].onPress();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(JSON.stringify(view.removedIds), JSON.stringify(['cash']), 'Eliminar writes the record once');
  // Deleted: gone from the list; the other rows stay.
  const at = '2026-09-27T10:00:00.000Z';
  const data = { ...archive, accounts: archive.accounts.map(item => item.id === 'cash' ? { ...item, revision: 1, updatedAt: at, deletedAt: at } : item) };
  const after = harness('accounts.tsx', {}, data).render();
  const sections = find(after, 'SectionList').props.sections.map((section: { currency: string; data: domain.Account[] }) => [section.currency, section.data.map(account => account.id)]);
  assert.equal(JSON.stringify(sections), JSON.stringify([['ARS', ['wallet']], ['USD', ['usd']]]));
});

test('25B2: a deleted account\'s detail reads its history and balance, with no edit button, no actions and no recurring row', () => {
  const at = '2026-09-27T10:00:00.000Z';
  const data = { ...archive, accounts: archive.accounts.map(item => item.id === 'cash' ? { ...item, revision: 1, updatedAt: at, deletedAt: at } : item) };
  const root = harness('account/[id].tsx', { id: 'cash' }, data).render();
  // 24UX6E: the state is said once in a calm LifecycleNote at the top; the hero keeps its own label.
  const note = find(root, 'LifecycleNote');
  assert.equal(note.props.icon, 'trash-outline');
  assert.equal(note.props.title, 'Cuenta eliminada');
  assert.match(note.props.detail, /^Sus movimientos y transferencias siguen aquí/);
  assert.equal(note.props.tone, undefined, 'no alarm colour');
  const header = find(root, 'EntryList').props.header;
  assert.equal(header.props.children.find(Boolean), note, 'the note is the first thing under the navigation title');
  assert.ok(texts(root).includes('Saldo registrado\u00A0·\u00A0ARS'), 'the balance keeps its label');
  assert.equal(texts(root).includes('Cuenta eliminada'), false, 'the state no longer replaces the eyebrow');
  assert.equal(find(root, 'Money').props.minor, 137300, 'the balance as recorded');
  assert.equal(find(root, 'Money').props.size, 40);
  assert.deepEqual(nodes(root).filter(node => node.type === 'Stat').map(node => node.props.label), ['Gastos este mes', 'Ingresos este mes'], 'its month facts stay, as history');
  assert.equal(nodes(root).some(node => node.type === 'Surface' && !node.props.grouped), false, 'no padded surface');
  assert.equal(nodes(root).some(node => node.type === 'QuickActions'), false);
  assert.equal(nodes(root).find(node => node.type === 'Stack.Screen')!.props.options.headerRight, undefined);
  assert.equal(nodes(root).some(node => node.type === 'DetailRow' && node.props.label === 'Recurrentes'), false);
  assert.ok(nodes(root).some(node => node.type === 'Money'), 'the recorded balance, as history');
  assert.ok(find(root, 'EntryList').props.entries.length >= 1, 'its movements still list');
});

test('24UX6E: the account detail is one flat status block: «Saldo registrado · ARS» with the badge, a 40 pt hero, the month facts on the canvas; no padded Surface and no note while live', () => {
  for (const [locale, id, eyebrow] of [['es-AR', 'cash', 'Saldo registrado · ARS'], ['en-AR', 'usd', 'Recorded balance · USD']] as const) {
    const root = harness('account/[id].tsx', { id }, archive, locale).render();
    assert.equal(nodes(root).some(node => node.type === 'Surface' && !node.props.grouped), false, locale + ': the facts are not in a padded card');
    const hero = find(root, 'Money');
    assert.equal(hero.props.large, true);
    assert.equal(hero.props.size, 40, 'the card and debt hero size');
    assert.equal(hero.props.color, undefined, 'a positive balance is ink');
    assert.ok(texts(root).includes(eyebrow), locale + ': ' + texts(root).join(' | '));
    const label = nodes(root).find(node => node.type === 'AppText' && node.props.children === eyebrow)!;
    assert.equal(label.props.variant, 'footnote');
    assert.equal(find(root, 'AccountBadge').props.size, 32);
    assert.equal(nodes(root).filter(node => node.type === 'StatRow').length, 1, locale + ': the month facts, even at zero');
    assert.equal(nodes(root).some(node => node.type === 'LifecycleNote'), false, 'a live account says nothing about its state');
    assert.equal(nodes(root).some(node => node.type === 'ValueTransition'), false, 'no motion on the hero');
  }
  // The status block: the hero group (eyebrow row, then Money) and the facts, 20 pt apart.
  const header = find(harness('account/[id].tsx', { id: 'cash' }).render(), 'EntryList').props.header;
  const block = header.props.children.find((child: any) => child && child.type === 'View');
  assert.equal(block.props.style.gap, 20);
  assert.equal(block.props.children[0].props.style.gap, 6);
  assert.equal(block.props.children[1].type, 'StatRow');
  // Only income this month: the expenses read as an unsigned zero, never «−$ 0».
  const incomeOnly = harness('account/[id].tsx', { id: 'cash' }, { ...archive, records: archive.records.filter(record => record.entry.id === 'e3') }).render();
  const zero = nodes(nodes(incomeOnly).filter(node => node.type === 'Stat')[0]).find(node => node.type === 'Money')!;
  assert.equal(zero.props.minor, 0);
  assert.equal(zero.props.signed, undefined);
  assert.equal(nodes(nodes(incomeOnly).filter(node => node.type === 'Stat')[1]).find(node => node.type === 'Money')!.props.minor, 50000, 'the income is still counted');
  // A real negative balance keeps the expense tone (its minus is Money's own).
  const overdrawn = harness('account/[id].tsx', { id: 'cash' }, { ...archive, accounts: archive.accounts.map(item => item.id === 'cash' ? { ...item, openingMinor: -1000000 } : item) }).render();
  assert.equal(find(overdrawn, 'Money').props.minor, -1000000 + 37300);
  assert.equal(find(overdrawn, 'Money').props.color, '#c00');
});

test('24UX6E: a Cuentas section header is one VoiceOver header naming what its figure is; the name reads as a heading in ink and the total stays secondary', () => {
  const sectionHeader = (locale: AppLocale = 'es-AR', data: domain.LedgerArchive = archive, index = 0) => {
    const list = find(harness('accounts.tsx', {}, data, locale).render(), 'SectionList');
    return list.props.renderSectionHeader({ section: list.props.sections[index] }) as Node;
  };
  const header = sectionHeader();
  assert.equal(header.type, 'View');
  assert.equal(header.props.accessible, true);
  assert.equal(header.props.accessibilityRole, 'header');
  assert.ok('accessibilityLanguage' in header.props, 'a raw accessible View names its language');
  assert.equal(header.props.accessibilityLabel, 'Pesos argentinos, saldo registrado 1423,00 pesos');
  const name = find(header, 'AppText');
  assert.equal(name.props.children, 'Pesos argentinos');
  assert.equal(name.props.variant, 'subhead');
  assert.equal(name.props.secondary, undefined, 'ink, like a Movimientos day');
  assert.equal(name.props.style.fontWeight, '600');
  assert.equal(name.props.style.flexShrink, 1);
  assert.equal(name.props.accessibilityRole, undefined, 'the header is the View, read once');
  assert.equal(find(header, 'Money').props.color, '#666');
  assert.equal(sectionHeader('en-AR').props.accessibilityLabel, 'Argentine pesos, recorded balance 1423.00 pesos');
  assert.equal(sectionHeader('es-AR', archive, 1).props.accessibilityLabel, 'Dólares estadounidenses, saldo registrado 3,00 dólares');
  // A negative total keeps its minus (Money's own) and the expense tone; VoiceOver says «Menos».
  const overdrawn = { ...archive, accounts: archive.accounts.map(item => item.id === 'cash' ? { ...item, openingMinor: -1000000 } : item) };
  const negative = sectionHeader('es-AR', overdrawn);
  assert.equal(find(negative, 'Money').props.minor, -1000000 + 37300 + 5000);
  assert.equal(find(negative, 'Money').props.color, '#c00');
  assert.equal(negative.props.accessibilityLabel, 'Pesos argentinos, saldo registrado Menos 9577,00 pesos');
});

test('24UX6E: a Cuentas section header puts its total under the name at large text or when both do not fit, never shrinking the money', () => {
  const direction = (data: domain.LedgerArchive = archive, index = 0) => {
    const list = find(harness('accounts.tsx', {}, data).render(), 'SectionList');
    return (list.props.renderSectionHeader({ section: list.props.sections[index] }) as Node).props.style.flexDirection;
  };
  assert.equal(direction(), 'row', 'the fixture totals sit beside the name at 390 pt');
  assert.equal(withWindow({ width: 375 }, () => direction(archive, 1)), 'row', '«Dólares estadounidenses» and US$ 3,00 fit at 375 pt');
  assert.equal(withWindow({ fontScale: 1.5 }, () => direction()), 'column', 'large text stacks');
  const rich = { ...archive, accounts: archive.accounts.map(item => item.id === 'usd' ? { ...item, openingMinor: 99999999999900 } : item) };
  assert.equal(withWindow({ width: 375 }, () => direction(rich, 1)), 'column', 'a twelve-digit total beside «Dólares estadounidenses» goes under it');
});

// ---- Producto 25B3: a rule's detail, read before it is edited ----------------------------------------------------------

const settle = () => new Promise(resolve => setImmediate(resolve));
const detailRows = (root: Node) => nodes(root).filter(node => node.type === 'DetailRow').map(node => node.props.label + '=' + node.props.value).join(',');
const buttons = (root: Node) => nodes(root).filter(node => node.type === 'ActionButton').map(node => node.props.label).join(',');

test('25B3: a rule\'s detail is its mark, its amount as stored (24UX6C: no sign on an expense) and its state, then only the facts it stores, Registrados and the row\'s own lifecycle; Editar in the header opens the form', () => {
  const view = harness('recurring/[id].tsx', { id: 'rent' });
  const root = view.render();
  const screen = find(root, 'Stack.Screen').props.options;
  assert.equal(screen.title, 'Alquiler', 'the merchant is the title, as a debt\'s counterparty is');
  const edit = screen.headerRight();
  assert.equal(JSON.stringify([edit.type, edit.props.name, edit.props.label]), JSON.stringify(['IconButton', 'create-outline', 'Editar recurrente']));
  edit.props.onPress();
  assert.equal(JSON.stringify(view.pushed.at(-1)), JSON.stringify({ pathname: '/edit-recurring/[id]', params: { id: 'rent' } }), 'the form is one step past the detail, never the row\'s target');
  const badge = find(root, 'MerchantBadge');
  assert.equal(JSON.stringify([badge.props.merchant, badge.props.category, badge.props.kind, badge.props.large]), JSON.stringify(['Alquiler', 'Hogar', 'expense', true]));
  const hero = find(root, 'Money');
  assert.equal(JSON.stringify([hero.props.minor, hero.props.currency, hero.props.large, hero.props.signed, hero.props.tone, hero.props.align]), JSON.stringify([40000, 'ARS', true, false, 'expense', 'center']),
    'the amount reads as its row does (24UX6C): the stored magnitude, no minus, in the expense (ink) tone');
  assert.equal(rule.amountMinor, 40000, 'the stored rule is unchanged by the render');
  const shown = texts(root);
  assert.ok(shown.includes('Gasto recurrente · ARS'), shown.join(' | '));
  assert.ok(shown.includes('Activo'));
  assert.equal(detailRows(root), 'Próxima fecha=1 oct,Frecuencia=Mensual,Categoría=Hogar,Cuenta=Banco', 'the next date once, then frequency, category and the account');
  const accountRow = nodes(root).find(node => node.type === 'DetailRow' && node.props.label === 'Cuenta')!;
  assert.equal(accountRow.props.leading.type, 'AccountBadge');
  assert.equal(accountRow.props.last, true);
  accountRow.props.onPress();
  assert.equal(JSON.stringify(view.pushed.at(-1)), JSON.stringify({ pathname: '/account/[id]', params: { id: 'cash' } }));
  // 24UX2: the history, now on the detail; a rule that recorded nothing says so.
  assert.equal(find(root, 'SectionTitle').props.children, 'Registrados');
  assert.match(find(root, 'SectionTitle').props.caption, /estimación/);
  assert.ok(shown.includes('Todavía no registró ningún movimiento.'));
  // 24UX4: the same two actions as the row's swipe, named; delete is red and last.
  assert.equal(buttons(root), 'Pausar recurrente,Eliminar recurrente');
  assert.equal(find(root, 'ActionButton', 'Eliminar recurrente').props.tone, 'expense');
  assert.equal(nodes(root).some(node => node.type === 'Field' || node.type === 'AmountField' || node.type === 'Choices'), false, 'a detail, not a form');
});

test('25B3: pausing from the detail writes the stored rule and keeps the screen; a paused rule says why, hides its next date and offers Reanudar', async () => {
  const view = harness('recurring/[id].tsx', { id: 'rent' });
  await find(view.render(), 'ActionButton', 'Pausar recurrente').props.onPress();
  await settle();
  assert.equal(JSON.stringify({ ...view.saved[0], updatedAt: '' }), JSON.stringify({ ...rule, active: false, revision: 1, updatedAt: '' }));
  assert.equal(view.backs(), 0, 'the detail stays: the state under the amount now reads Pausado');
  const paused = harness('recurring/[id].tsx', { id: 'rent' }, { ...archive, recurring: [{ ...rule, active: false, revision: 1 }] });
  const root = paused.render();
  const shown = texts(root);
  assert.ok(shown.includes('Pausado'));
  // 24UX6E: why, right under the state it explains (the shared lifecycle note), without repeating «Pausado».
  assert.equal(find(root, 'LifecycleNote').props.detail, 'No registra nada hasta que lo reanudes. Lo que venza mientras tanto no se registra.');
  assert.equal(detailRows(root), 'Frecuencia=Mensual,Categoría=Hogar,Cuenta=Banco', '24UX2: a paused rule never announces a next date');
  assert.equal(buttons(root), 'Reanudar recurrente,Eliminar recurrente');
  await find(root, 'ActionButton', 'Reanudar recurrente').props.onPress();
  await settle();
  assert.equal(paused.saved[0].active, true);
  assert.equal(paused.saved[0].revision, 2);
  assert.equal(paused.backs(), 0);
});

test('25B3: an active rule the catch-up set aside reads Revisar in amber, explains since when, and Continuar desde hoy resumes it without recording the backlog', async () => {
  const behind = { ...rule, nextDateISO: '2026-09-10', anchorDateISO: '2026-09-10' };
  const view = harness('recurring/[id].tsx', { id: 'rent' }, { ...archive, recurring: [behind] });
  const root = view.render();
  const state = nodes(root).find(node => node.type === 'AppText' && node.props.children === 'Revisar')!;
  assert.equal(JSON.stringify([state.props.style.color, state.props.style.fontWeight]), JSON.stringify(['#a60', '600']));
  const next = nodes(root).find(node => node.type === 'DetailRow' && node.props.label === 'Próxima fecha')!;
  assert.equal(JSON.stringify([next.props.value, next.props.tone]), JSON.stringify(['10 sep', 'warning']), 'the date it failed since, in the warning tone');
  assert.match(find(root, 'LifecycleNote').props.detail, /no pudo registrar este recurrente desde el 10 de septiembre de 2026/);
  assert.equal(buttons(root), 'Continuar desde hoy,Pausar recurrente,Eliminar recurrente');
  await find(root, 'ActionButton', 'Continuar desde hoy').props.onPress();
  await settle();
  assert.equal(view.saved[0].active, true);
  assert.ok(view.saved[0].nextDateISO >= domain.todayKey(), 'resumed from today: nothing before today is left to record');
  assert.equal(view.backs(), 0);
});

test('25B3: a rule on a deleted account (paused by the deletion) offers Eliminar only, says why, and still opens its form and its account\'s history', () => {
  const at = '2026-09-27T10:00:00.000Z';
  const data = { ...archive, accounts: archive.accounts.map(item => item.id === 'cash' ? { ...item, revision: 1, updatedAt: at, deletedAt: at } : item), recurring: [{ ...rule, active: false, revision: 1 }] };
  const view = harness('recurring/[id].tsx', { id: 'rent' }, data);
  const root = view.render();
  assert.equal(buttons(root), 'Eliminar recurrente', '25B2: never resumed onto a closed row');
  assert.equal(find(root, 'LifecycleNote').props.detail, 'Su cuenta o tarjeta fue eliminada, así que no vuelve a registrarse. Podés elegir otra compatible desde Editar y después reanudarlo, o eliminar este recurrente.', 'the note names the recovery path, not only Eliminar');
  assert.ok(find(root, 'Stack.Screen').props.options.headerRight, 'its history stays editable in place');
  find(root, 'DetailRow', 'Cuenta').props.onPress();
  assert.equal(JSON.stringify(view.pushed.at(-1)), JSON.stringify({ pathname: '/account/[id]', params: { id: 'cash' } }));
});

test('25B3: Eliminar recurrente asks first with the row\'s confirmation, Cancelar writes nothing, Eliminar writes the deletion record and goes back; the history lists what stays', async () => {
  const data = { ...archive, records: [...archive.records, ...['2026-07-01', '2026-08-01', '2026-09-01'].map(day => domain.initialRecord(recorded(day)))] };
  const view = harness('recurring/[id].tsx', { id: 'rent' }, data);
  const root = view.render();
  const rows = nodes(root).filter(node => node.type === 'EntryRow');
  assert.equal(rows.map(node => node.props.entry.dateISO).join(','), '2026-09-01,2026-08-01,2026-07-01', 'newest first, the scheduled date never among them');
  assert.equal(rows.every(node => node.props.showAccount === false && node.props.account.id === 'cash'), true);
  find(root, 'ActionButton', 'Eliminar recurrente').props.onPress();
  assert.equal(view.saved.length, 0, 'nothing is written before the confirmation');
  const alert = view.alerts[0];
  assert.equal(alert.title, '¿Eliminar «Alquiler»?');
  assert.equal(alert.message, 'Deja de registrarse. Los 3 movimientos que ya registró siguen en Movimientos.');
  assert.equal(alert.buttons.map((button: { text: string; style?: string }) => button.text + ':' + (button.style ?? '')).join(','), 'Cancelar:cancel,Eliminar:destructive');
  alert.buttons[0].onPress?.();
  assert.equal(view.saved.length + view.backs(), 0, 'Cancelar changes nothing and stays');
  await alert.buttons[1].onPress();
  await settle();
  assert.equal(JSON.stringify({ ...view.saved[0], updatedAt: '' }), JSON.stringify({ ...rule, active: false, deleted: true, revision: 1, updatedAt: '' }));
  assert.equal(view.backs(), 1, 'deleting goes back to the list');
  // A failed write keeps the rule and says so on the detail.
  const failing = harness('recurring/[id].tsx', { id: 'rent' });
  failing.failSave(new Error('Disk full'));
  await find(failing.render(), 'ActionButton', 'Pausar recurrente').props.onPress();
  await settle();
  assert.equal(failing.saved.length, 0);
  assert.equal(find(failing.render(), 'ErrorMessage').props.message, 'Disk full');
});

test('25B3: in English the detail reads in English and keeps the merchant, category and account names; a card rule names its card and opens it; an income is positive', () => {
  const view = harness('recurring/[id].tsx', { id: 'rent' }, archive, 'en-AR');
  const root = view.render();
  const screen = find(root, 'Stack.Screen').props.options;
  assert.equal(screen.title, 'Alquiler');
  assert.equal(screen.headerRight().props.label, 'Edit recurring item');
  const shown = texts(root);
  assert.ok(shown.includes('Recurring expense · ARS'));
  assert.ok(shown.includes('Active'));
  assert.equal(detailRows(root), 'Next date=Oct 1,Frequency=Monthly,Category=Hogar,Account=Banco');
  assert.equal(find(root, 'SectionTitle').props.children, 'Recorded');
  assert.ok(shown.includes('Nothing recorded yet.'));
  assert.equal(buttons(root), 'Pause recurring item,Delete recurring item');
  // The same words for a rule whose next date is today, in both languages, and the Spanish state of a paused rule.
  assert.ok(texts(harness('recurring/[id].tsx', { id: 'rent' }, { ...archive, recurring: [{ ...rule, active: false }] }, 'en-AR').render()).includes('Paused'));
  // A rule on a card: the row says Tarjeta / Card and opens the card's detail.
  const onCard: domain.RecurringRule = { ...rule, id: 'sub', accountId: 'card-acc', merchant: 'Netflix', category: 'Suscripciones', amountMinor: 899900 };
  const cardView = harness('recurring/[id].tsx', { id: 'sub' }, { ...archive, recurring: [onCard] }, 'en-AR');
  const cardRoot = cardView.render();
  const cardRow = nodes(cardRoot).find(node => node.type === 'DetailRow' && node.props.label === 'Card')!;
  assert.equal(JSON.stringify([cardRow.props.value, cardRow.props.icon, cardRow.props.leading]), JSON.stringify(['Visa', 'card-outline', undefined]));
  cardRow.props.onPress();
  assert.equal(JSON.stringify(cardView.pushed.at(-1)), JSON.stringify({ pathname: '/card/[id]', params: { id: 'card' } }));
  assert.equal(nodes(harness('recurring/[id].tsx', { id: 'sub' }, { ...archive, recurring: [onCard] }).render()).find(node => node.type === 'DetailRow' && node.props.label === 'Tarjeta')!.props.value, 'Visa');
  // An income rule: the amount is positive with its «+» in the income tone, under «Ingreso recurrente».
  const salary: domain.RecurringRule = { ...rule, id: 'pay', kind: 'income', merchant: 'Sueldo', category: 'Sueldo', amountMinor: 150000 };
  const income = harness('recurring/[id].tsx', { id: 'pay' }, { ...archive, recurring: [salary] }).render();
  assert.equal(JSON.stringify([find(income, 'Money').props.minor, find(income, 'Money').props.signed, find(income, 'Money').props.tone]), JSON.stringify([150000, true, 'income']));
  assert.ok(texts(income).includes('Ingreso recurrente · ARS'));
  assert.equal(find(income, 'MerchantBadge').props.tone, 'income');
});

test('25B3: an unknown or deleted rule, or one without its account, is not found in both languages', () => {
  assert.equal(find(harness('recurring/[id].tsx', { id: 'nope' }).render(), 'EmptyState').props.title, 'No encontramos este recurrente');
  assert.equal(find(harness('recurring/[id].tsx', { id: 'nope' }, archive, 'en-AR').render(), 'EmptyState').props.title, 'We couldn’t find this recurring item');
  const deleted = domain.deleteRecurringRule(rule, '2026-09-19T12:00:00.000Z');
  assert.equal(find(harness('recurring/[id].tsx', { id: 'rent' }, { ...archive, recurring: [deleted] }).render(), 'EmptyState').props.title, 'No encontramos este recurrente', 'a cold link to a deleted rule');
  assert.equal(find(harness('recurring/[id].tsx', { id: 'rent' }, { ...archive, accounts: archive.accounts.filter(item => item.id !== 'cash') }).render(), 'EmptyState').props.title, 'No encontramos este recurrente', 'no account, no currency to show');
});

test('25B3 review: while a pause, a resume or a confirmed deletion is being written the detail holds navigation (no native back, no back swipe, Editar disabled); success or failure gives it back, a failed write keeps the screen with its error, and a deletion pops exactly once', async () => {
  const nav = (root: Node) => { const options = find(root, 'Stack.Screen').props.options; return [options.gestureEnabled, options.headerBackVisible, options.headerRight?.().props.disabled]; };
  const busyButtons = (root: Node) => nodes(root).filter(node => node.type === 'ActionButton').map(node => node.props.busy || node.props.disabled).every(Boolean);
  // Pausar pending.
  const pausing = harness('recurring/[id].tsx', { id: 'rent' });
  assert.deepEqual(nav(pausing.render()), [true, true, false], 'at rest the screen navigates as usual');
  let release = pausing.holdSave();
  const pausePress = find(pausing.render(), 'ActionButton', 'Pausar recurrente').props.onPress();
  assert.deepEqual(nav(pausing.render()), [false, false, true], 'mid-write: back, swipe and Editar held');
  assert.equal(busyButtons(pausing.render()), true);
  release(); await pausePress; await settle();
  assert.deepEqual(nav(pausing.render()), [true, true, false], 'released after the durable save');
  assert.equal(pausing.backs(), 0);
  // Reanudar pending.
  const resuming = harness('recurring/[id].tsx', { id: 'rent' }, { ...archive, recurring: [{ ...rule, active: false, revision: 1 }] });
  release = resuming.holdSave();
  const resumePress = find(resuming.render(), 'ActionButton', 'Reanudar recurrente').props.onPress();
  assert.deepEqual(nav(resuming.render()), [false, false, true]);
  release(); await resumePress; await settle();
  assert.deepEqual(nav(resuming.render()), [true, true, false]);
  assert.equal(resuming.saved[0].active, true);
  // Eliminar confirmed and pending: held, then exactly one back.
  const deleting = harness('recurring/[id].tsx', { id: 'rent' });
  find(deleting.render(), 'ActionButton', 'Eliminar recurrente').props.onPress();
  assert.deepEqual(nav(deleting.render()), [true, true, false], 'the question alone holds nothing');
  release = deleting.holdSave();
  const confirm = deleting.alerts[0].buttons[1].onPress();
  assert.deepEqual(nav(deleting.render()), [false, false, true]);
  assert.equal(deleting.backs(), 0, 'no pop before the record is written');
  release(); await confirm; await settle();
  assert.equal(deleting.backs(), 1, 'exactly one back');
  assert.equal(deleting.saved[0].deleted, true);
  // A failed write: navigation comes back, the screen stays with its error, nothing popped.
  const failing = harness('recurring/[id].tsx', { id: 'rent' });
  failing.failSave(new Error('Disk full'));
  release = failing.holdSave();
  const failPress = find(failing.render(), 'ActionButton', 'Pausar recurrente').props.onPress();
  assert.deepEqual(nav(failing.render()), [false, false, true]);
  release(); await failPress; await settle();
  assert.deepEqual(nav(failing.render()), [true, true, false]);
  assert.equal(find(failing.render(), 'ErrorMessage').props.message, 'Disk full');
  assert.equal(failing.backs() + failing.saved.length, 0);
  // A failed deletion neither pops nor unmounts.
  const failingDelete = harness('recurring/[id].tsx', { id: 'rent' });
  failingDelete.failSave(new Error('Disk full'));
  find(failingDelete.render(), 'ActionButton', 'Eliminar recurrente').props.onPress();
  await failingDelete.alerts[0].buttons[1].onPress(); await settle();
  assert.deepEqual(nav(failingDelete.render()), [true, true, false]);
  assert.equal(find(failingDelete.render(), 'ErrorMessage').props.message, 'Disk full');
  assert.equal(failingDelete.backs(), 0);
  // Editar still opens the form at rest, and the recovery path of a rule on a deleted account is untouched.
  find(pausing.render(), 'Stack.Screen').props.options.headerRight().props.onPress();
  assert.equal(JSON.stringify(pausing.pushed.at(-1)), JSON.stringify({ pathname: '/edit-recurring/[id]', params: { id: 'rent' } }));
  const at = '2026-09-27T10:00:00.000Z';
  const closedRoot = harness('recurring/[id].tsx', { id: 'rent' }, { ...archive, accounts: archive.accounts.map(item => item.id === 'cash' ? { ...item, revision: 1, updatedAt: at, deletedAt: at } : item), recurring: [{ ...rule, active: false, revision: 1 }] }).render();
  assert.deepEqual(nav(closedRoot), [true, true, false]);
  assert.equal(buttons(closedRoot), 'Eliminar recurrente');
});

// ---- Producto 24UX6E: Recurrentes in the Forest design (flat forecast, lifecycle under the hero, closed rules) -------

const ruleRow = (root: Node, id: string) => nodes(root).find(node => typeof node.type === 'function' && node.props.rule?.id === id)!;
const caption = (row: Node, text: string) => nodes(row).find(node => node.type === 'AppText' && node.props.variant === 'caption' && node.props.children === text)!;
const deletedCash = (at = '2026-09-27T10:00:00.000Z') => archive.accounts.map(item => item.id === 'cash' ? { ...item, revision: 1, updatedAt: at, deletedAt: at } : item);

test('24UX6E: the 30-day forecast is flat on the canvas; «Gastos · ARS» has the full width at row size, then Ingresos (only when something comes in) and Vencimientos', () => {
  const salary: domain.RecurringRule = { ...rule, id: 'pay', kind: 'income', merchant: 'Sueldo', category: 'Sueldo', amountMinor: 150000, anchorDateISO: '2026-09-30', nextDateISO: '2026-09-30' };
  for (const locale of ['es-AR', 'en-AR'] as AppLocale[]) {
    const root = harness('recurring.tsx', {}, { ...archive, recurring: [rule, salary] }, locale).render();
    assert.equal(nodes(root).some(node => node.type === 'Surface' && !node.props.grouped), false, locale + ': no padded card around the forecast');
    const stats = nodes(root).filter(node => node.type === 'Stat');
    const es = locale === 'es-AR';
    assert.deepEqual(stats.map(node => node.props.label), es ? ['Gastos · ARS', 'Ingresos', 'Vencimientos'] : ['Expenses · ARS', 'Income', 'Due']);
    // The expense projection: its own row (never a third of a StatRow), a row-size figure (22, not a hero), in ink.
    const statRow = find(root, 'StatRow');
    assert.equal(nodes(statRow).includes(stats[0]), false, 'Gastos is not squeezed into a column');
    const expense = nodes(stats[0]).find(node => node.type === 'Money')!.props;
    assert.equal(JSON.stringify([expense.minor, expense.size, expense.weight, expense.large, expense.tone, expense.color]), JSON.stringify([40000, 22, '700', undefined, undefined, undefined]));
    const income = nodes(stats[1]).find(node => node.type === 'Money')!.props;
    assert.equal(JSON.stringify([income.minor, income.signed, income.tone]), JSON.stringify([150000, true, 'income']), '24UX6C: «+» in green');
    assert.equal(nodes(stats[2]).find(node => node.type === 'AppText')!.props.children, 2);
  }
  // Two currencies: two flat blocks, never summed; an expense-only currency shows no «Ingresos $ 0,00».
  const dollars: domain.RecurringRule = { ...rule, id: 'host', accountId: 'usd', merchant: 'Hosting', amountMinor: 1200 };
  const both = harness('recurring.tsx', {}, { ...archive, recurring: [rule, dollars] }).render();
  assert.deepEqual(nodes(both).filter(node => node.type === 'Stat').map(node => node.props.label), ['Gastos · ARS', 'Vencimientos', 'Gastos · USD', 'Vencimientos']);
  assert.deepEqual(nodes(both).filter(node => node.type === 'Stat' && /Gastos/.test(node.props.label)).map(node => nodes(node).find(child => child.type === 'Money')!.props.minor), [40000, 1200]);
  // A projection beyond the safe range is said as plain secondary text, on the canvas.
  const huge: domain.RecurringRule = { ...rule, id: 'huge', frequency: 'weekly', amountMinor: Number.MAX_SAFE_INTEGER, anchorDateISO: '2026-09-24', nextDateISO: '2026-09-24' };
  const out = harness('recurring.tsx', {}, { ...archive, recurring: [huge] }).render();
  const said = nodes(out).find(node => node.type === 'AppText' && node.props.children === 'Total fuera de rango · ARS')!;
  assert.ok(said, texts(out).join(' | '));
  assert.equal(said.props.secondary, true);
  assert.equal(nodes(out).some(node => node.type === 'Surface' && !node.props.grouped), false);
});

test('24UX6E: amber «Hoy» / «Mañana» marks an expense only; an income due today reads «Hoy» in secondary; «Revisar» stays amber for both', () => {
  const salary: domain.RecurringRule = { ...rule, id: 'pay', kind: 'income', merchant: 'Sueldo', category: 'Sueldo', amountMinor: 150000, nextDateISO: '2026-09-20' };
  const rent: domain.RecurringRule = { ...rule, nextDateISO: '2026-09-21' };
  const root = harness('recurring.tsx', {}, { ...archive, recurring: [rent, salary] }).render();
  const tomorrow = caption(ruleRow(root, 'rent'), 'Mañana');
  assert.equal(JSON.stringify([tomorrow.props.style.color, tomorrow.props.style.fontWeight]), JSON.stringify(['#a60', '600']));
  const today = caption(ruleRow(root, 'pay'), 'Hoy');
  assert.equal(JSON.stringify([today.props.style.color, today.props.style.fontWeight]), JSON.stringify(['#666', '400']), 'incoming money is not an alert');
  const behind = harness('recurring.tsx', {}, { ...archive, recurring: [{ ...salary, nextDateISO: '2026-09-10', anchorDateISO: '2026-09-10' }] }).render();
  assert.equal(caption(ruleRow(behind, 'pay'), 'Revisar').props.style.color, '#a60');
});

test('24UX6E: opened for one account, the rows leave its name out (the header says it); the empty state offers «un gasto o ingreso»', () => {
  const root = harness('recurring.tsx', { accountId: 'cash' }).render();
  assert.equal(find(root, 'Stack.Screen').props.options.title, 'Banco');
  assert.ok(texts(root).includes('Mensual · Hogar'), texts(root).join(' | '));
  assert.equal(texts(root).some(text => text.includes('· Banco')), false);
  assert.ok(texts(harness('recurring.tsx').render()).includes('Mensual · Hogar · Banco'), 'the full list still names it');
  const empty = harness('recurring.tsx', { accountId: 'wallet' }).render();
  assert.equal(find(empty, 'EmptyState').props.detail, 'Creá un gasto o ingreso recurrente para esta cuenta.');
});

test('24UX6E: a rule on a deleted account or card says so on its row (calm, never amber) and offers Eliminar only; an active rule on a live account is unchanged', () => {
  for (const [locale, word, label] of [['es-AR', 'Cuenta eliminada', 'Alquiler, gasto, mensual, Hogar, 400,00 ARS, pausado: Cuenta eliminada'],
    ['en-AR', 'Account deleted', 'Alquiler, expense, monthly, Hogar, 400.00 ARS, paused: Account deleted']] as const) {
    const root = harness('recurring.tsx', {}, { ...archive, accounts: deletedCash(), recurring: [{ ...rule, active: false, revision: 1 }] }, locale).render();
    const row = ruleRow(root, 'rent');
    const shown = caption(row, word);
    assert.ok(shown, locale + ': ' + texts(root).join(' | '));
    assert.equal(JSON.stringify([shown.props.style.color, shown.props.style.fontWeight]), JSON.stringify(['#666', '400']));
    assert.equal(texts(row).includes(locale === 'es-AR' ? 'Pausado' : 'Paused'), false, 'not a bare «Pausado»');
    assert.equal(find(row, 'PressFeedback').props.accessibilityLabel, label);
    assert.equal(swipeLabels(root), locale === 'es-AR' ? 'Eliminar' : 'Delete');
  }
  // A rule on a deleted card names the card.
  const onCard: domain.RecurringRule = { ...rule, id: 'sub', accountId: 'card-acc', merchant: 'Netflix', active: false, revision: 1 };
  const deadCard = { ...card, active: false, deleted: true, revision: 1, updatedAt: '2026-09-27T10:00:00.000Z' };
  for (const [locale, word, spoken] of [['es-AR', 'Tarjeta eliminada', 'pausado: Tarjeta eliminada'], ['en-AR', 'Card deleted', 'paused: Card deleted']] as const) {
    const root = harness('recurring.tsx', {}, { ...archive, cards: [deadCard], recurring: [onCard] }, locale).render();
    const row = ruleRow(root, 'sub');
    assert.ok(caption(row, word), locale + ': ' + texts(root).join(' | '));
    // VoiceOver names what the row shows (the card), never a vaguer «cuenta o tarjeta».
    assert.ok(String(find(row, 'PressFeedback').props.accessibilityLabel).endsWith(', ' + spoken), find(row, 'PressFeedback').props.accessibilityLabel);
  }
  // An old or imported rule still active on a deleted account: the deletion wins over «Hoy» or «Revisar», never amber.
  const stillActive = harness('recurring.tsx', {}, { ...archive, accounts: deletedCash(), recurring: [{ ...rule, nextDateISO: '2026-09-10', anchorDateISO: '2026-09-10' }] }).render();
  assert.equal(caption(ruleRow(stillActive, 'rent'), 'Cuenta eliminada').props.style.color, '#666');
  // Review fix: it never records again (the catch-up skips it), so «Próximos 30 días» never projects it.
  assert.equal(texts(stillActive).includes('Próximos 30 días'), false, 'a closed rule alone projects nothing');
  assert.equal(nodes(stillActive).filter(node => node.type === 'Stat').length, 0);
  const beside = harness('recurring.tsx', {}, { ...archive, accounts: deletedCash(),
    recurring: [{ ...rule, nextDateISO: '2026-09-10', anchorDateISO: '2026-09-10' }, { ...rule, id: 'gym', accountId: 'wallet', merchant: 'Gimnasio', amountMinor: 3000 }] }).render();
  assert.deepEqual(nodes(beside).filter(node => node.type === 'Money').slice(0, 1).map(node => node.props.minor), [3000], 'only the live rule is projected');
});

test('24UX6E: the detail says why right under its hero (the shared lifecycle note), before the facts and Registrados; an active rule shows none', () => {
  const order = (root: Node) => nodes(root).filter(node => ['LifecycleNote', 'DetailRow', 'SectionTitle', 'ActionButton', 'ErrorMessage'].includes(node.type))
    .map(node => node.type === 'DetailRow' ? 'DetailRow' : node.type === 'SectionTitle' ? node.props.children : node.type === 'ActionButton' ? node.props.label : node.type)
    .filter((item, index, all) => item !== 'DetailRow' || all[index - 1] !== 'DetailRow').join(',');
  assert.equal(nodes(harness('recurring/[id].tsx', { id: 'rent' }).render()).some(node => node.type === 'LifecycleNote'), false);
  // Paused: the note under the state, not repeating «Pausado»; the actions stay at the end with the one error line.
  const paused = harness('recurring/[id].tsx', { id: 'rent' }, { ...archive, recurring: [{ ...rule, active: false, revision: 1 }] }).render();
  const pausedNote = find(paused, 'LifecycleNote').props;
  assert.equal(JSON.stringify([pausedNote.icon, pausedNote.title, pausedNote.tone]), JSON.stringify(['pause-circle-outline', undefined, undefined]));
  assert.equal(order(paused), 'LifecycleNote,DetailRow,Registrados,ErrorMessage,Reanudar recurrente,Eliminar recurrente');
  assert.equal(nodes(paused).some(node => node.props.accessibilityLiveRegion && node.type !== 'AppText'), false, 'only the state is a live region');
  // Review: the warning note, then «Continuar desde hoy» and the one error line, all before the facts; Pausar and Eliminar stay last.
  const behind = { ...rule, nextDateISO: '2026-09-10', anchorDateISO: '2026-09-10' };
  const view = harness('recurring/[id].tsx', { id: 'rent' }, { ...archive, recurring: [behind] });
  const review = view.render();
  const reviewNote = find(review, 'LifecycleNote').props;
  assert.equal(JSON.stringify([reviewNote.icon, reviewNote.tone]), JSON.stringify(['alert-circle-outline', 'warning']));
  assert.equal(order(review), 'LifecycleNote,Continuar desde hoy,ErrorMessage,DetailRow,Registrados,Pausar recurrente,Eliminar recurrente');
  assert.equal(nodes(review).filter(node => node.type === 'ErrorMessage').length, 1);
  // English reads the same note.
  const english = harness('recurring/[id].tsx', { id: 'rent' }, { ...archive, recurring: [{ ...rule, active: false, revision: 1 }] }, 'en-AR').render();
  assert.equal(find(english, 'LifecycleNote').props.detail, 'Nothing is recorded until you resume it. Anything due in the meantime is not recorded.');
});

test('24UX6E: in review a failed Pausar says so once, under «Continuar desde hoy»', async () => {
  const behind = { ...rule, nextDateISO: '2026-09-10', anchorDateISO: '2026-09-10' };
  const view = harness('recurring/[id].tsx', { id: 'rent' }, { ...archive, recurring: [behind] });
  view.failSave(new Error('Disk full'));
  await find(view.render(), 'ActionButton', 'Pausar recurrente').props.onPress();
  await settle();
  const after = nodes(view.render());
  const errors = after.filter(node => node.type === 'ErrorMessage');
  assert.equal(errors.length, 1);
  assert.equal(errors[0].props.message, 'Disk full');
  const at = (node: Node | undefined) => { assert.ok(node); return after.indexOf(node); };
  assert.ok(at(after.find(node => node.type === 'ActionButton' && node.props.label === 'Continuar desde hoy')) < at(errors[0]) && at(errors[0]) < at(after.find(node => node.type === 'DetailRow')),
    'the error line sits under «Continuar desde hoy», above the facts');
  assert.equal(view.saved.length, 0);
});

test('24UX6E: a rule on a deleted account or card says «Cuenta eliminada» / «Tarjeta eliminada» in its hero, calm, with the recovery note under it', () => {
  const root = harness('recurring/[id].tsx', { id: 'rent' }, { ...archive, accounts: deletedCash(), recurring: [{ ...rule, active: false, revision: 1 }] }).render();
  const state = nodes(root).find(node => node.type === 'AppText' && node.props.accessibilityLiveRegion === 'polite')!;
  assert.equal(JSON.stringify([state.props.children, state.props.style.color, state.props.style.fontWeight]), JSON.stringify(['Cuenta eliminada', '#666', '400']));
  assert.equal(texts(root).includes('Pausado'), false);
  assert.equal(find(root, 'LifecycleNote').props.icon, 'unlink-outline');
  const onCard: domain.RecurringRule = { ...rule, id: 'sub', accountId: 'card-acc', merchant: 'Netflix', active: false, revision: 1 };
  const deadCard = { ...card, active: false, deleted: true, revision: 1, updatedAt: '2026-09-27T10:00:00.000Z' };
  const cardRoot = harness('recurring/[id].tsx', { id: 'sub' }, { ...archive, cards: [deadCard], recurring: [onCard] }, 'en-AR').render();
  assert.equal(nodes(cardRoot).find(node => node.type === 'AppText' && node.props.accessibilityLiveRegion === 'polite')!.props.children, 'Card deleted');
  assert.equal(find(cardRoot, 'LifecycleNote').props.detail, 'Its account or card was deleted, so it is not recorded again. Choose another compatible account or card from Edit and then resume it, or delete this recurring item.');
  // Still active on the deleted account (old or imported data) with a past date: the closed note, never review's CTA.
  const stale = harness('recurring/[id].tsx', { id: 'rent' }, { ...archive, accounts: deletedCash(), recurring: [{ ...rule, nextDateISO: '2026-09-10', anchorDateISO: '2026-09-10' }] }).render();
  assert.equal(find(stale, 'LifecycleNote').props.icon, 'unlink-outline');
  assert.equal(buttons(stale), 'Eliminar recurrente');
  assert.equal(nodes(stale).filter(node => node.type === 'ErrorMessage').length, 1);
  // Review fix: a rule that never records again announces no next date (24UX2's paused rule).
  assert.equal(detailRows(stale).includes('Próxima fecha'), false, detailRows(stale));
});

test('24UX6E: VoiceOver reads the detail\'s next date written out; a relative word stays as it is', () => {
  const next = (root: Node) => find(root, 'DetailRow', 'Próxima fecha').props;
  const es = next(harness('recurring/[id].tsx', { id: 'rent' }).render());
  assert.equal(JSON.stringify([es.value, es.spokenValue]), JSON.stringify(['1 oct', '1 de octubre de 2026']));
  const en = find(harness('recurring/[id].tsx', { id: 'rent' }, archive, 'en-AR').render(), 'DetailRow', 'Next date').props;
  assert.equal(JSON.stringify([en.value, en.spokenValue]), JSON.stringify(['Oct 1', 'October 1, 2026']));
  const today = next(harness('recurring/[id].tsx', { id: 'rent' }, { ...archive, recurring: [{ ...rule, nextDateISO: '2026-09-20' }] }).render());
  assert.equal(JSON.stringify([today.value, today.spokenValue]), JSON.stringify(['Hoy', 'Hoy']));
});

test('24UX6E: in English the history points to Activity, the real tab, beyond its twelve rows', () => {
  const dates = Array.from({ length: 13 }, (_, index) => `${2025 + Math.floor((index + 8) / 12)}-${String((index + 8) % 12 + 1).padStart(2, '0')}-01`);
  const data = { ...archive, records: [...archive.records, ...dates.map(day => domain.initialRecord(recorded(day)))] };
  const root = harness('recurring/[id].tsx', { id: 'rent' }, data, 'en-AR').render();
  assert.equal(nodes(root).filter(node => node.type === 'EntryRow').length, 12);
  assert.ok(texts(root).includes('And 1 earlier record in Activity.'), texts(root).join(' | '));
  assert.ok(texts(harness('recurring/[id].tsx', { id: 'rent' }, data).render()).includes('Y 1 registro anterior en Movimientos.'));
});
