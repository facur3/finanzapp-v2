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
  { id: 'b-cafe', scope: 'category', category: 'Café', currency: 'ARS', monthISO: '2026-09', amountMinor: 2500, active: true, createdAt, revision: 0, updatedAt: createdAt },
  { id: 'b-super', scope: 'category', category: 'Supermercado', currency: 'ARS', monthISO: '2026-09', amountMinor: 10000, active: true, createdAt, revision: 0, updatedAt: createdAt },
];
const rule: domain.RecurringRule = { id: 'rent', accountId: cash.id, kind: 'expense', amountMinor: 40000, merchant: 'Alquiler', category: 'Hogar', frequency: 'monthly',
  anchorDateISO: '2026-10-01', nextDateISO: '2026-10-01', active: true, createdAt, revision: 0, updatedAt: createdAt };
const archive: domain.LedgerArchive = { accounts: [cash, wallet, usd, cardAccount], records: entries.map(domain.initialRecord), cards: [card], budgets, recurring: [rule] };

function harness(file: string, params: Record<string, unknown> = {}, data: domain.LedgerArchive = archive, locale: AppLocale = 'es-AR') {
  const i18nProvider = { useI18n: () => bindLocale(locale) };
  const source = readFileSync(new URL('../app/' + file, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const jsx = (type: unknown, props: Record<string, unknown>) => ({ type, props });
  const state: unknown[] = [];
  const pushed: any[] = [];
  const saved: domain.RecurringRule[] = [];
  let cursor = 0;
  const ledger = { useLedger: () => ({ archive: data, snapshot: domain.snapshotFromArchive(data), saveRecurring: async (next: domain.RecurringRule) => { saved.push(next); } }) };
  const names = ['ActionButton', 'AppText', 'CategoryBadge', 'MerchantBadge', 'Choices', 'DetailRow', 'EmptyState', 'ErrorMessage', 'IconButton', 'Money', 'PressFeedback',
    'Screen', 'SectionTitle', 'Stat', 'Surface', 'AccountRow', 'AccountBadge'];
  const theme = { space: { xs: 4, s: 8, m: 12, l: 16, xl: 20, xxl: 24, xxxl: 32 }, useCurrentDay: () => '2026-09-20', useReduceMotion: () => true,
    usePalette: () => ({ text: '#000', secondary: '#666', tertiary: '#999', line: '#ddd', inset: '#eee', expense: '#c00', income: '#080', warning: '#a60', primary: '#2557D6', background: '#fff', surface: '#fff' }) };
  const modules: Record<string, unknown> = {
    '../i18n/format': i18nFormat, '../src/i18n/format': i18nFormat, '../../src/i18n/format': i18nFormat, '../i18n/provider': i18nProvider, '../src/i18n/provider': i18nProvider, '../../src/i18n/provider': i18nProvider,
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
    '../src/ui/components': { ...Object.fromEntries(names.map(name => [name, name])), useStacked: () => false }, '../../src/ui/components': { ...Object.fromEntries(names.map(name => [name, name])), useStacked: () => false },
    '../src/ui/entry-list': { EntryList: 'EntryList' }, '../../src/ui/entry-list': { EntryList: 'EntryList' },
    '../src/ui/currency-switch': { CurrencySwitch: 'CurrencySwitch' }, '../../src/ui/currency-switch': { CurrencySwitch: 'CurrencySwitch' },
    '../src/ui/quick-actions': { QuickActions: 'QuickActions', AssistantEntry: 'AssistantEntry' }, '../../src/ui/quick-actions': { QuickActions: 'QuickActions', AssistantEntry: 'AssistantEntry' },
    '../src/ui/motion': { ValueTransition: 'ValueTransition', Reflow: 'Reflow', selectionHaptic: () => {}, impactHaptic: () => {}, duration: { press: 100, release: 160, state: 200, data: 260, enter: 200, exit: 100, reveal: 480 }, timing: (kind: string, reduced: boolean) => ({ duration: reduced ? 0 : 260 }) }, '../../src/ui/motion': { ValueTransition: 'ValueTransition', Reflow: 'Reflow', selectionHaptic: () => {}, impactHaptic: () => {}, duration: { press: 100, release: 160, state: 200, data: 260, enter: 200, exit: 100, reveal: 480 }, timing: (kind: string, reduced: boolean) => ({ duration: reduced ? 0 : 260 }) },
    '../src/ui/presentation': presentation, '../../src/ui/presentation': presentation, '../src/ui/report-presentation': reportPresentation,
    '../src/ui/budget-presentation': budgetPresentation, '../../src/ui/budget-presentation': budgetPresentation,
    '../src/ui/theme': theme, '../../src/ui/theme': theme,
    '../src/ui/category-hues': { useCategoryColor: () => '#3E6FB0', useCategoryLabel: (s: string) => s, useCategoryDefinitions: () => [], useCategoryLook: (s: string) => ({ label: s, storedLabel: s, key: String(s).toLowerCase(), hex: '#3E6FB0', glyph: 'pricetag-outline' }), useCategoryLookOf: () => (s: string) => ({ label: s, storedLabel: s, key: String(s).toLowerCase(), hex: '#3E6FB0', glyph: 'pricetag-outline' }), useAccountLook: () => ({ icon: 'wallet', color: 'cobalt', glyph: 'wallet-outline', hex: '#2557D6' }), useAccountNameOf: () => (account: any) => account.name, useAccountLookOf: () => () => ({ icon: 'wallet', color: 'cobalt', glyph: 'wallet-outline', hex: '#2557D6' }) }, '../../src/ui/category-hues': { useCategoryColor: () => '#3E6FB0', useCategoryLabel: (s: string) => s, useCategoryDefinitions: () => [], useCategoryLook: (s: string) => ({ label: s, storedLabel: s, key: String(s).toLowerCase(), hex: '#3E6FB0', glyph: 'pricetag-outline' }), useCategoryLookOf: () => (s: string) => ({ label: s, storedLabel: s, key: String(s).toLowerCase(), hex: '#3E6FB0', glyph: 'pricetag-outline' }), useAccountLook: () => ({ icon: 'wallet', color: 'cobalt', glyph: 'wallet-outline', hex: '#2557D6' }), useAccountNameOf: () => (account: any) => account.name, useAccountLookOf: () => () => ({ icon: 'wallet', color: 'cobalt', glyph: 'wallet-outline', hex: '#2557D6' }) },
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

test('in English Recurrentes reads in English, keeps merchant and account names, and pausing writes what Spanish writes', async () => {
  const english = harness('recurring.tsx', {}, archive, 'en-AR'), spanish = harness('recurring.tsx');
  const root = english.render();
  assert.equal(find(root, 'Stack.Screen').props.options.title, 'Recurring');
  assert.equal(nodes(root).filter(node => node.type === 'Stat').map(node => node.props.label).slice(0, 3).join(','), 'Expenses · ARS,Due,Income');
  const sections = nodes(root).filter(node => node.type === 'SectionTitle').map(node => node.props.children);
  assert.equal(sections.join(','), 'Next 30 days,Active');
  const press = nodes(root).find(node => node.type === 'PressFeedback')!;
  assert.equal(press.props.accessibilityLabel, 'Edit recurring Alquiler, monthly, Hogar, 400.00 ARS, next Oct 1');
  const captions = texts(root);
  // 24UX2: frequency · category · account on the left; the due day once, beside the amount (beyond a week, the date).
  assert.ok(captions.includes('Monthly · Hogar · Banco'), 'merchant, category and account name stay as the user wrote them');
  assert.ok(captions.includes('Oct 1'));
  assert.equal(captions.some(caption => /In 11 days|Oct 1 ·/.test(caption)), false, 'the date is not repeated');
  assert.ok(texts(spanish.render()).includes('Mensual · Hogar · Banco'));
  assert.ok(texts(spanish.render()).includes('1 oct'));
  await find(root, 'Switch', 'Pause Alquiler').props.onValueChange();
  await find(spanish.render(), 'Switch', 'Pausar Alquiler').props.onValueChange();
  const stable = (rule: domain.RecurringRule) => JSON.stringify({ ...rule, updatedAt: '' });
  assert.equal(stable(english.saved[0]), stable(spanish.saved[0]));
  const paused = harness('recurring.tsx', {}, { ...archive, recurring: [{ ...rule, active: false }] }, 'en-AR').render();
  assert.ok(texts(paused).includes('Paused'));
  // 24UX2: a paused rule keeps full-contrast ink and never announces a next date.
  assert.equal(nodes(paused).find(node => node.type === 'PressFeedback')!.props.accessibilityLabel, 'Edit recurring Alquiler, monthly, Hogar, 400.00 ARS, paused');
  assert.equal(nodes(paused).some(node => node.type === 'View' && node.props.style?.opacity !== undefined && node.props.style.opacity < 1), false);
  assert.equal(find(paused, 'SectionTitle', undefined).props.caption, 'Not recorded until you turn them back on');
});

test('23.1C2: a Recurrentes row due today says the day inside its VoiceOver sentence in lower case; the caption keeps it on its own', () => {
  // The harness day is 2026-09-20. The amount is spoken with the language's decimal mark, whatever the region writes.
  const due = { ...archive, recurring: [{ ...rule, nextDateISO: '2026-09-20' }] };
  const cases = [
    ['es-AR', 'Editar recurrente Alquiler, mensual, Hogar, 400,00 ARS, próximo hoy', 'Hoy'],
    ['es-US', 'Editar recurrente Alquiler, mensual, Hogar, 400,00 ARS, próximo hoy', 'Hoy'],
    ['en-AR', 'Edit recurring Alquiler, monthly, Hogar, 400.00 ARS, next today', 'Today'],
    ['en-US', 'Edit recurring Alquiler, monthly, Hogar, 400.00 ARS, next today', 'Today'],
  ] as const;
  for (const [locale, label, caption] of cases) {
    const root = harness('recurring.tsx', {}, due, locale).render();
    assert.equal(nodes(root).find(node => node.type === 'PressFeedback')!.props.accessibilityLabel, label, locale);
    assert.ok(texts(root).includes(caption), locale + ': ' + texts(root).join(' | '));
  }
  // A day that is not today or yesterday reads the same inline and on its own.
  const later = nodes(harness('recurring.tsx', {}, archive, 'es-AR').render()).find(node => node.type === 'PressFeedback')!;
  assert.equal(later.props.accessibilityLabel, 'Editar recurrente Alquiler, mensual, Hogar, 400,00 ARS, próximo 1 oct');
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
  assert.equal(rows.map(node => node.props.label).join(','), 'Recurring,Opening balance');
  assert.equal(rows[0].props.value, '1 active');
  assert.equal(find(harness('account/[id].tsx', { id: 'cash' }).render(), 'DetailRow').props.value, '1 activo');
  const missing = harness('account/[id].tsx', { id: 'nope' }, archive, 'en-AR').render();
  assert.equal(find(missing, 'EmptyState').props.title, 'We couldn’t find this account');
});

test('23.1C2: the opening balance row groups on screen and gives VoiceOver the language’s numbers without grouping', () => {
  const rich = { ...archive, accounts: archive.accounts.map(account => account.id === 'cash' ? { ...account, openingMinor: 123456789 } : account) };
  const opening = (locale: AppLocale) => {
    const row = nodes(harness('account/[id].tsx', { id: 'cash' }, rich, locale).render()).filter(node => node.type === 'DetailRow')[1];
    return row.props.value + '|' + row.props.spokenValue;
  };
  assert.equal(opening('es-AR'), 'ARS 1.234.567,89|1234567,89 ARS');
  assert.equal(opening('en-AR'), 'ARS 1.234.567,89|1234567.89 ARS', 'an English voice gets the decimal point, not the Argentine grouping');
  assert.equal(opening('es-US'), 'ARS 1,234,567.89|1234567,89 ARS', 'a Spanish voice gets the decimal comma, not the US grouping');
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
