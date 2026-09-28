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
    'Screen', 'SectionTitle', 'Stat', 'Surface', 'AccountRow', 'AccountBadge'];
  let backs = 0;
  const theme = { space: { xs: 4, s: 8, m: 12, l: 16, xl: 20, xxl: 24, xxxl: 32 }, useCurrentDay: () => '2026-09-20', useReduceMotion: () => true,
    usePalette: () => ({ text: '#000', secondary: '#666', tertiary: '#999', line: '#ddd', inset: '#eee', expense: '#c00', income: '#080', warning: '#a60', primary: '#2557D6', background: '#fff', surface: '#fff' }) };
  const modules: Record<string, unknown> = {
    '../i18n/format': i18nFormat, '../src/i18n/format': i18nFormat, '../../src/i18n/format': i18nFormat, '../i18n/provider': i18nProvider, '../src/i18n/provider': i18nProvider, '../../src/i18n/provider': i18nProvider,
    react: { useEffect: (fn: () => unknown) => { fn(); }, useMemo: (fn: () => unknown) => fn(),
      useRef: (initial: unknown) => { const i = refCursor++; return refs[i] ??= { current: initial }; }, useState: (initial: unknown) => {
      const index = cursor++;
      if (!(index in state)) state[index] = typeof initial === 'function' ? (initial as () => unknown)() : initial;
      return [state[index], (value: unknown) => { state[index] = typeof value === 'function' ? (value as (current: unknown) => unknown)(state[index]) : value; }];
    } },
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'react-native': { View: 'View', SectionList: 'SectionList', Switch: 'Switch', StyleSheet: { hairlineWidth: 0.5 },
      Alert: { alert: (title: string, message: string, buttons: any[]) => alerts.push({ title, message, buttons }) } },
    'react-native-reanimated': { __esModule: true, default: { View: 'Animated.View' }, useSharedValue: (value: number) => ({ value }),
      withTiming: (value: number) => value, useAnimatedStyle: (fn: () => unknown) => fn() },
    'expo-haptics': { selectionAsync: async () => {}, notificationAsync: async () => {}, NotificationFeedbackType: { Success: 'Success' } },
    'expo-router': { Stack: { Screen: 'Stack.Screen' }, Redirect: 'Redirect', useLocalSearchParams: () => params,
      router: { push: (to: unknown) => pushed.push(to), replace: (to: unknown) => pushed.push(to), canGoBack: () => true, back: () => { backs++; } } },
    '@finanzapp/domain': domain,
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
  assert.ok(texts(root).some(text => text.startsWith('60 % utilizado')));
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
  assert.ok(texts(exceeded).some(text => text === '120 % utilizado · excedido'));
  assert.ok(texts(exceeded).some(text => text.includes('Sin límites por categoría este mes')));
  assert.equal(nodes(exceeded).filter(node => typeof node.type === 'function' && node.props.row).length, 0);
  const exact = harness('budgets.tsx', { currency: 'ARS' }, { ...archive, budgets: [{ ...total, amountMinor: 12000 }] }).render();
  assert.ok(texts(exact).some(text => text === '100 % utilizado · límite alcanzado'));
  const usd = harness('budgets.tsx', { currency: 'USD' }, { ...archive, budgets: [total, { ...total, id: 'usd-total', currency: 'USD', amountMinor: 50000 }] }).render();
  const usdPanel = nodes(usd).find(node => typeof node.type === 'function' && node.props.total)!;
  assert.equal(usdPanel.props.total.budget.id, 'usd-total');
  assert.equal(usdPanel.props.total.spentMinor, 0, 'ARS spending never counts against the USD budget');
});

test('recurrentes projects the next 30 days per currency and pausing advances nothing silently', async () => {
  const view = harness('recurring.tsx');
  const root = view.render();
  const stats = nodes(root).filter(node => node.type === 'Stat').map(node => node.props.label);
  assert.deepEqual(stats.slice(0, 3), ['Pagos\u00A0·\u00A0ARS', 'Vencimientos', 'Ingresos']);
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
  assert.equal(nodes(stats[0]).find(node => node.type === 'Money')!.props.minor, -12000);
  assert.equal(nodes(stats[1]).find(node => node.type === 'Money')!.props.minor, 50000);
  const actions = find(root, 'QuickActions');
  assert.equal(actions.props.accountId, 'cash');
  assert.equal(actions.props.currency, 'ARS');
  assert.equal(nodes(root).some(node => node.type === 'AppText' && /sincronizaci/.test(String(node.props.children))), false, 'no bank disclaimer copy');
  const redirect = harness('account/[id].tsx', { id: 'card-acc' }).render();
  assert.equal(redirect.type, 'Redirect');
  assert.equal(JSON.stringify(redirect.props.href), JSON.stringify({ pathname: '/card/[id]', params: { id: 'card' } }));
});

test('in English Recurrentes reads in English, keeps merchant and account names, and pausing writes what Spanish writes', async () => {
  const english = harness('recurring.tsx', {}, archive, 'en-AR'), spanish = harness('recurring.tsx');
  const root = english.render();
  assert.equal(find(root, 'Stack.Screen').props.options.title, 'Recurring');
  assert.equal(nodes(root).filter(node => node.type === 'Stat').map(node => node.props.label).slice(0, 3).join(','), 'Expenses · ARS,Due,Income');
  const sections = nodes(root).filter(node => node.type === 'SectionTitle').map(node => node.props.children);
  assert.equal(sections.join(','), 'Next 30 days,Active');
  const press = nodes(root).find(node => node.type === 'PressFeedback')!;
  // 25B3: the row is the rule, not an action: VoiceOver hears what it is and that it opens details; a tap opens the detail, never the form.
  assert.equal(press.props.accessibilityLabel, 'Alquiler, monthly, Hogar, 400.00 ARS, next Oct 1');
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
  assert.equal(nodes(paused).find(node => node.type === 'PressFeedback')!.props.accessibilityLabel, 'Alquiler, monthly, Hogar, 400.00 ARS, paused');
  assert.equal(nodes(paused).some(node => node.type === 'View' && node.props.style?.opacity !== undefined && node.props.style.opacity < 1), false);
  assert.equal(find(paused, 'SectionTitle', undefined).props.caption, 'Not recorded until you resume them');
  assert.equal(swipeLabels(paused), 'Resume,Delete');
});

test('23.1C2: a Recurrentes row due today says the day inside its VoiceOver sentence in lower case; the caption keeps it on its own', () => {
  // The harness day is 2026-09-20. The amount is spoken with the language's decimal mark, whatever the region writes.
  const due = { ...archive, recurring: [{ ...rule, nextDateISO: '2026-09-20' }] };
  const cases = [
    ['es-AR', 'Alquiler, mensual, Hogar, 400,00 ARS, próximo hoy', 'Hoy'],
    ['es-US', 'Alquiler, mensual, Hogar, 400,00 ARS, próximo hoy', 'Hoy'],
    ['en-AR', 'Alquiler, monthly, Hogar, 400.00 ARS, next today', 'Today'],
    ['en-US', 'Alquiler, monthly, Hogar, 400.00 ARS, next today', 'Today'],
  ] as const;
  for (const [locale, label, caption] of cases) {
    const root = harness('recurring.tsx', {}, due, locale).render();
    assert.equal(nodes(root).find(node => node.type === 'PressFeedback')!.props.accessibilityLabel, label, locale);
    assert.ok(texts(root).includes(caption), locale + ': ' + texts(root).join(' | '));
  }
  // A day that is not today or yesterday reads the same inline and on its own.
  const later = nodes(harness('recurring.tsx', {}, archive, 'es-AR').render()).find(node => node.type === 'PressFeedback')!;
  assert.equal(later.props.accessibilityLabel, 'Alquiler, mensual, Hogar, 400,00 ARS, próximo 1 oct');
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

// ---- Producto 24UX4: pause, resume and delete from the Recurrentes list -----------------------
const recorded = (dateISO: string): domain.Entry => ({ id: domain.recurringEntryId(rule.id, dateISO), accountId: cash.id, kind: 'expense', amountMinor: 40000,
  merchant: 'Alquiler', category: 'Hogar', dateISO, createdAt });

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
  assert.equal(fresh.alerts[0].message, 'It stops being recorded. No movement is deleted.');
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
  const texts = nodes(root).filter(node => node.type === 'AppText').map(node => String(node.props.children));
  assert.ok(texts.includes('Cuenta eliminada'));
  assert.ok(texts.some(text => text.startsWith('Sus movimientos y transferencias siguen aquí')));
  assert.equal(nodes(root).some(node => node.type === 'QuickActions'), false);
  assert.equal(nodes(root).find(node => node.type === 'Stack.Screen')!.props.options.headerRight, undefined);
  assert.equal(nodes(root).some(node => node.type === 'DetailRow' && node.props.label === 'Recurrentes'), false);
  assert.ok(nodes(root).some(node => node.type === 'Money'), 'the recorded balance, as history');
  assert.ok(find(root, 'EntryList').props.entries.length >= 1, 'its movements still list');
});

// ---- Producto 25B3: a rule's detail, read before it is edited ----------------------------------------------------------

const settle = () => new Promise(resolve => setImmediate(resolve));
const detailRows = (root: Node) => nodes(root).filter(node => node.type === 'DetailRow').map(node => node.props.label + '=' + node.props.value).join(',');
const buttons = (root: Node) => nodes(root).filter(node => node.type === 'ActionButton').map(node => node.props.label).join(',');

test('25B3: a rule\'s detail is its mark, its signed amount and its state, then only the facts it stores, Registrados and the row\'s own lifecycle; Editar in the header opens the form', () => {
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
  assert.equal(JSON.stringify([hero.props.minor, hero.props.currency, hero.props.large, hero.props.signed, hero.props.tone, hero.props.align]), JSON.stringify([-40000, 'ARS', true, true, 'expense', 'center']),
    'the amount reads as its row does: signed, in the expense tone');
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
  assert.ok(shown.some(text => text.startsWith('Pausado: no registra nada hasta que lo reanudes')));
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
  assert.ok(texts(root).some(text => /no pudo registrar este recurrente desde el 10 de septiembre de 2026/.test(text)));
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
  assert.ok(texts(root).includes('Pausado: su cuenta o tarjeta fue eliminada, así que no vuelve a registrarse. Podés elegir otra compatible desde Editar y después reanudarlo, o eliminar este recurrente.'), 'the note names the recovery path, not only Eliminar');
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
  // An income rule: the amount is positive in the income tone, under «Ingreso recurrente».
  const salary: domain.RecurringRule = { ...rule, id: 'pay', kind: 'income', merchant: 'Sueldo', category: 'Sueldo', amountMinor: 150000 };
  const income = harness('recurring/[id].tsx', { id: 'pay' }, { ...archive, recurring: [salary] }).render();
  assert.equal(JSON.stringify([find(income, 'Money').props.minor, find(income, 'Money').props.tone]), JSON.stringify([150000, 'income']));
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
