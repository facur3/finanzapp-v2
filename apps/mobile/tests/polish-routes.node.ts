import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as domain from '@finanzapp/domain';
import * as presentation from '../src/ui/presentation.ts';

// Budgets, Recurrentes, Cuentas and account detail handlers with native hosts
// replaced by descriptors. Not a rendered iOS screen or gesture test.
type Node = { type: any; props: Record<string, any> };
const createdAt = '2026-09-01T12:00:00.000Z';
const cash: domain.Account = { id: 'cash', name: 'Banco', currency: 'ARS', openingMinor: 100000, createdAt };
const wallet: domain.Account = { id: 'wallet', name: 'Efectivo', currency: 'ARS', openingMinor: 5000, createdAt };
const usd: domain.Account = { id: 'usd', name: 'Dólares', currency: 'USD', openingMinor: 300, createdAt };
const cardAccount: domain.Account = { id: 'card-acc', name: 'Visa', currency: 'ARS', openingMinor: -20000, createdAt };
const card: domain.CreditCardProfile = { id: 'card', accountId: cardAccount.id, issuer: '', last4: '', creditLimitMinor: null, closingDay: 28, dueDay: 5, active: true, createdAt, revision: 0, updatedAt: createdAt };
const entries: domain.Entry[] = [
  { id: 'e1', accountId: cash.id, kind: 'expense', amountMinor: 3000, merchant: 'Café', category: 'Café', dateISO: '2026-09-10', createdAt },
  { id: 'e2', accountId: cash.id, kind: 'expense', amountMinor: 9000, merchant: 'Super', category: 'Supermercado', dateISO: '2026-09-12', createdAt },
  { id: 'e3', accountId: cash.id, kind: 'income', amountMinor: 50000, merchant: 'Sueldo', category: 'Sueldo', dateISO: '2026-09-05', createdAt },
  { id: 'e4', accountId: cash.id, kind: 'expense', amountMinor: 700, merchant: 'Viejo', category: 'Café', dateISO: '2026-08-30', createdAt },
];
const budgets: domain.MonthlyBudget[] = [
  { id: 'b-cafe', category: 'Café', currency: 'ARS', monthISO: '2026-09', amountMinor: 2500, active: true, createdAt, revision: 0, updatedAt: createdAt },
  { id: 'b-super', category: 'Supermercado', currency: 'ARS', monthISO: '2026-09', amountMinor: 10000, active: true, createdAt, revision: 0, updatedAt: createdAt },
];
const rule: domain.RecurringRule = { id: 'rent', accountId: cash.id, kind: 'expense', amountMinor: 40000, merchant: 'Alquiler', category: 'Hogar', frequency: 'monthly',
  anchorDateISO: '2026-10-01', nextDateISO: '2026-10-01', active: true, createdAt, revision: 0, updatedAt: createdAt };
const archive: domain.LedgerArchive = { accounts: [cash, wallet, usd, cardAccount], records: entries.map(domain.initialRecord), cards: [card], budgets, recurring: [rule] };

function harness(file: string, params: Record<string, unknown> = {}, data: domain.LedgerArchive = archive) {
  const source = readFileSync(new URL('../app/' + file, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const jsx = (type: unknown, props: Record<string, unknown>) => ({ type, props });
  const state: unknown[] = [];
  const pushed: any[] = [];
  const saved: domain.RecurringRule[] = [];
  let cursor = 0;
  const ledger = { useLedger: () => ({ archive: data, snapshot: domain.snapshotFromArchive(data), saveRecurring: async (next: domain.RecurringRule) => { saved.push(next); } }) };
  const names = ['ActionButton', 'AppText', 'CategoryBadge', 'Choices', 'DetailRow', 'EmptyState', 'ErrorMessage', 'IconButton', 'Money', 'PressFeedback',
    'Screen', 'SectionTitle', 'Stat', 'Surface', 'AccountRow'];
  const theme = { space: { xs: 4, s: 8, m: 12, l: 16, xl: 20, xxl: 24, xxxl: 32 }, useCurrentDay: () => '2026-09-20', useReduceMotion: () => true,
    usePalette: () => ({ text: '#000', secondary: '#666', tertiary: '#999', line: '#ddd', inset: '#eee', expense: '#c00', income: '#080', warning: '#a60', primary: '#2557D6', background: '#fff', surface: '#fff' }) };
  const modules: Record<string, unknown> = {
    react: { useEffect: (fn: () => unknown) => { fn(); }, useMemo: (fn: () => unknown) => fn(), useState: (initial: unknown) => {
      const index = cursor++;
      if (!(index in state)) state[index] = typeof initial === 'function' ? (initial as () => unknown)() : initial;
      return [state[index], (value: unknown) => { state[index] = typeof value === 'function' ? (value as (current: unknown) => unknown)(state[index]) : value; }];
    } },
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'react-native': { View: 'View', SectionList: 'SectionList', Switch: 'Switch', StyleSheet: { hairlineWidth: 0.5 } },
    'react-native-reanimated': { __esModule: true, default: { View: 'Animated.View' }, useSharedValue: (value: number) => ({ value }),
      withTiming: (value: number) => value, useAnimatedStyle: (fn: () => unknown) => fn() },
    'expo-haptics': { selectionAsync: async () => {} },
    'expo-router': { Stack: { Screen: 'Stack.Screen' }, Redirect: 'Redirect', useLocalSearchParams: () => params, router: { push: (to: unknown) => pushed.push(to) } },
    '@finanzapp/domain': domain,
    '../src/storage/LedgerProvider': ledger, '../../src/storage/LedgerProvider': ledger,
    '../src/ui/components': Object.fromEntries(names.map(name => [name, name])), '../../src/ui/components': Object.fromEntries(names.map(name => [name, name])),
    '../src/ui/entry-list': { EntryList: 'EntryList' }, '../../src/ui/entry-list': { EntryList: 'EntryList' },
    '../src/ui/quick-actions': { QuickActions: 'QuickActions' }, '../../src/ui/quick-actions': { QuickActions: 'QuickActions' },
    '../src/ui/motion': { ValueTransition: 'ValueTransition', Reflow: 'Reflow', selectionHaptic: () => {}, impactHaptic: () => {}, duration: { press: 100, release: 160, state: 200, data: 260, enter: 200, exit: 100, reveal: 480 }, timing: (kind: string, reduced: boolean) => ({ duration: reduced ? 0 : 260 }) }, '../../src/ui/motion': { ValueTransition: 'ValueTransition', Reflow: 'Reflow', selectionHaptic: () => {}, impactHaptic: () => {}, duration: { press: 100, release: 160, state: 200, data: 260, enter: 200, exit: 100, reveal: 480 }, timing: (kind: string, reduced: boolean) => ({ duration: reduced ? 0 : 260 }) },
    '../src/ui/presentation': presentation, '../../src/ui/presentation': presentation,
    '../src/ui/theme': theme, '../../src/ui/theme': theme,
  };
  const module = { exports: {} as { default?: () => Node } };
  runInNewContext(code, { module, exports: module.exports, require: (name: string) => {
    if (!Object.hasOwn(modules, name)) throw new Error('Unexpected polish dependency: ' + name);
    return modules[name];
  } });
  return { render: () => { cursor = 0; return module.exports.default!(); }, pushed, saved };
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

test('budgets show what is left, mark exceeded and near-limit categories, and never count cards or transfers twice', () => {
  const view = harness('budgets.tsx', { currency: 'ARS' });
  const root = view.render();
  // Café: 3000 of 2500 (exceeded). Supermercado: 9000 of 10000 (90 %, near). Remaining total: 12500 − 12000 = 500.
  assert.equal(find(root, 'Money').props.minor, 500);
  const rows = nodes(root).filter(node => typeof node.type === 'function' && node.props.row);
  assert.deepEqual(rows.map(node => [node.props.row.budget.category, node.props.row.exceeded, Math.round(node.props.row.ratio * 100)]), [['Café', true, 120], ['Supermercado', false, 90]]);
  const labels = nodes(root).filter(node => node.type === 'PressFeedback').map(node => node.props.accessibilityLabel).filter(Boolean);
  assert.ok(labels.some(label => /Café: \$ 30,00 de \$ 25,00, 120 por ciento\. Excedido por \$ 5,00/.test(label)));
  assert.ok(labels.some(label => /Supermercado.*90 por ciento\. Quedan \$ 10,00/.test(label)));
  assert.ok(nodes(root).some(node => node.type === 'AppText' && String(node.props.children?.join?.('') ?? node.props.children).includes('1 excedida')));
  find(root, 'IconButton', 'Mes siguiente').props.onPress();
  assert.equal(find(view.render(), 'EmptyState').props.title, 'Dale un límite a tu mes');
});

test('recurrentes projects the next 30 days per currency and pausing advances nothing silently', async () => {
  const view = harness('recurring.tsx');
  const root = view.render();
  const stats = nodes(root).filter(node => node.type === 'Stat').map(node => node.props.label);
  assert.deepEqual(stats.slice(0, 3), ['Pagos · ARS', 'Vencimientos', 'Ingresos']);
  assert.equal(find(root, 'Money').props.minor, 40000);
  const row = nodes(root).find(node => typeof node.type === 'function' && node.props.rule)!;
  assert.equal(row.props.rule.id, 'rent');
  await find(root, 'Switch', 'Pausar Alquiler').props.onValueChange();
  assert.equal(view.saved[0].active, false);
  assert.equal(view.saved[0].nextDateISO, '2026-10-01');
  assert.equal(view.saved[0].revision, 1);
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
