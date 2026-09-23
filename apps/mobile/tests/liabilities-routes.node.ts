import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as domain from '@finanzapp/domain';
import * as presentation from '../src/ui/presentation.ts';
import * as liabilityPresentation from '../src/ui/liability-presentation.ts';
import * as i18nFormat from '../src/i18n/format.ts';
import { bindLocale } from '../src/i18n/bind.ts';
const i18nProvider = { useI18n: () => bindLocale('es-AR') };

// Exercise the Cards tab, card detail and debts handlers with native hosts
// replaced by descriptors. Not a rendered iOS screen, carousel or gesture test.
type Node = { type: any; props: Record<string, any> };
const createdAt = '2026-09-01T12:00:00.000Z';
const cash: domain.Account = { id: 'cash', name: 'Banco', currency: 'ARS', openingMinor: 100000, createdAt };
const cardAccount: domain.Account = { id: 'card-acc', name: 'Visa Gold', currency: 'ARS', openingMinor: -20000, createdAt };
const usdCardAccount: domain.Account = { id: 'usd-card-acc', name: 'Amex USD', currency: 'USD', openingMinor: 0, createdAt };
const debtAccount: domain.Account = { id: 'debt-acc', name: 'Debo · Juan', currency: 'ARS', openingMinor: -30000, createdAt };
const card: domain.CreditCardProfile = { id: 'card', accountId: cardAccount.id, issuer: 'Galicia', last4: '4009', creditLimitMinor: 500000,
  closingDay: 28, dueDay: 5, active: true, createdAt, revision: 0, updatedAt: createdAt };
const usdCard: domain.CreditCardProfile = { ...card, id: 'usd-card', accountId: usdCardAccount.id, issuer: 'Amex', last4: '1001', creditLimitMinor: null };
const debt: domain.PersonalDebtProfile = { id: 'debt', accountId: debtAccount.id, direction: 'owed_by_me', counterparty: 'Juan', dueDateISO: '2026-10-01',
  note: '', active: true, createdAt, revision: 0, updatedAt: createdAt };
const purchase: domain.Entry = { id: 'purchase', accountId: cardAccount.id, kind: 'expense', amountMinor: 23100, merchant: 'Starbucks', category: 'Café', dateISO: '2026-09-12', createdAt };
const payment: domain.Transfer = { id: 'payment', fromAccountId: cash.id, toAccountId: cardAccount.id, amountMinor: 30000, note: 'Pago Visa Gold', dateISO: '2026-09-15', createdAt };
const archive: domain.LedgerArchive = { accounts: [cash, cardAccount, usdCardAccount, debtAccount], records: [domain.initialRecord(purchase)],
  transfers: [domain.initialTransferRecord(payment)], cards: [card, usdCard], debts: [debt] };
const empty: domain.LedgerArchive = { accounts: [cash], records: [] };

function harness(file: string, params: Record<string, unknown> = {}, data: domain.LedgerArchive = archive) {
  const source = readFileSync(new URL('../app/' + file, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const jsx = (type: unknown, props: Record<string, unknown>) => ({ type, props });
  const state: unknown[] = [];
  const pushed: any[] = [];
  let cursor = 0;
  const ledger = { useLedger: () => ({ archive: data, snapshot: domain.snapshotFromArchive(data) }) };
  const componentNames = ['ActionButton', 'AppText', 'DetailRow', 'EmptyState', 'GlyphTile', 'IconButton', 'Money', 'MovementRow', 'PressFeedback',
    'Screen', 'SectionTitle', 'Stat', 'Surface'];
  const components = { ...Object.fromEntries(componentNames.map(name => [name, name])), toneColors: () => ({ color: '#000', soft: '#eee' }) };
  const theme = { space: { xs: 4, s: 8, m: 12, l: 16, xl: 20, xxl: 24, xxxl: 32 }, useCurrentDay: () => '2026-09-20', useReduceMotion: () => true,
    usePalette: () => ({ text: '#000', secondary: '#666', tertiary: '#999', line: '#ddd', inset: '#eee', expense: '#c00', income: '#080', warning: '#a60', transfer: '#03c', primary: '#2557D6' }) };
  const modules: Record<string, unknown> = {
    '../i18n/format': i18nFormat, '../src/i18n/format': i18nFormat, '../../src/i18n/format': i18nFormat, '../i18n/provider': i18nProvider, '../src/i18n/provider': i18nProvider, '../../src/i18n/provider': i18nProvider,
    react: { useEffect: (fn: () => unknown) => { fn(); }, useMemo: (fn: () => unknown) => fn(), useState: (initial: unknown) => {
      const index = cursor++;
      if (!(index in state)) state[index] = typeof initial === 'function' ? (initial as () => unknown)() : initial;
      return [state[index], (value: unknown) => { state[index] = typeof value === 'function' ? (value as (current: unknown) => unknown)(state[index]) : value; }];
    } },
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'react-native': { View: 'View', useWindowDimensions: () => ({ width: 393, fontScale: 1 }) },
    'react-native-reanimated': { __esModule: true, default: { View: 'Animated.View' }, useSharedValue: (value: number) => ({ value }),
      withTiming: (value: number) => value, useAnimatedStyle: (fn: () => unknown) => fn() },
    'expo-router': { Stack: { Screen: 'Stack.Screen' }, useLocalSearchParams: () => params, router: { push: (to: unknown) => pushed.push(to), navigate: (to: unknown) => pushed.push(to) } },
    '@finanzapp/domain': domain,
    '../src/storage/LedgerProvider': ledger, '../../src/storage/LedgerProvider': ledger,
    '../src/ui/components': components, '../../src/ui/components': components,
    '../src/ui/card-visual': { CardCarousel: 'CardCarousel', CardFace: 'CardFace' }, '../../src/ui/card-visual': { CardCarousel: 'CardCarousel', CardFace: 'CardFace' },
    '../src/ui/entry-list': { EntryList: 'EntryList' }, '../../src/ui/entry-list': { EntryList: 'EntryList' },
    '../src/ui/liability-presentation': liabilityPresentation, '../../src/ui/liability-presentation': liabilityPresentation,
    '../src/ui/presentation': presentation, '../../src/ui/presentation': presentation,
    '../src/ui/theme': theme, '../../src/ui/theme': theme,
    '../src/ui/liability-rows': { DebtRow: 'DebtRow' }, '../../src/ui/liability-rows': { DebtRow: 'DebtRow' },
    '../src/ui/quick-actions': { QuickActions: 'QuickActions' }, '../../src/ui/quick-actions': { QuickActions: 'QuickActions' },
    '../src/ui/motion': { ValueTransition: 'ValueTransition', Reflow: 'Reflow', selectionHaptic: () => {}, impactHaptic: () => {}, timing: (kind: string, reduced: boolean) => ({ duration: reduced ? 0 : 260 }) }, '../../src/ui/motion': { ValueTransition: 'ValueTransition', Reflow: 'Reflow', selectionHaptic: () => {}, impactHaptic: () => {}, timing: (kind: string, reduced: boolean) => ({ duration: reduced ? 0 : 260 }) },
  };
  const module = { exports: {} as { default?: () => Node } };
  runInNewContext(code, { module, exports: module.exports, require: (name: string) => {
    if (!Object.hasOwn(modules, name)) throw new Error('Unexpected liabilities dependency: ' + name);
    return modules[name];
  } });
  return { render: () => { cursor = 0; return module.exports.default!(); }, pushed };
}

// Nested function components (CardPanel, UsageBar, DebtRow) are expanded so
// their descriptors can be inspected like the host components.
function nodes(value: any): Node[] {
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!value.props) return [];
  const own = typeof value.type === 'function' ? nodes(value.type(value.props)) : [];
  return [value, ...own, ...nodes(value.props.children), ...nodes(value.props.header), ...nodes(value.props.action),
    ...(typeof value.props.render === 'function' ? nodes(value.props.render(value.props.items?.[0], 353)) : [])];
}
function find(root: Node, type: string, label?: string): Node {
  const node = nodes(root).find(item => item.type === type && (!label || item.props.label === label || item.props.accessibilityLabel === label));
  assert.ok(node, 'Missing ' + type + ' ' + (label ?? ''));
  return node;
}

test('Tarjetas shows an honest empty state and a debts invitation without any card', () => {
  const root = harness('cards.tsx', {}, empty).render();
  assert.equal(find(root, 'EmptyState').props.title, 'Tus tarjetas, como en la billetera');
  assert.equal(nodes(root).some(node => node.type === 'CardCarousel'), false);
  find(root, 'EmptyState').props.action.props.onPress();
  assert.equal(nodes(root).some(node => node.type === 'DebtRow'), false);
  assert.equal(nodes(root).some(node => node.type === 'SectionTitle' && node.props.children === 'Deudas y cobros'), false, 'personal debts live under Más');
});

test('Tarjetas summarizes the selected card from recorded purchases and payments, never a synced balance', () => {
  const view = harness('cards.tsx');
  const root = view.render();
  // The screen is pushed from Más now; its "+" lives in its own header.
  const header = nodes(root).find(node => node.type === 'Stack.Screen')!.props.options;
  assert.equal(header.title, 'Tarjetas');
  const add = header.headerRight();
  assert.equal(add.type, 'IconButton');
  assert.equal(add.props.label, 'Agregar tarjeta');
  add.props.onPress();
  assert.equal(view.pushed.at(-1), '/new-card');
  const carousel = find(root, 'CardCarousel');
  assert.deepEqual(carousel.props.items.map((item: { id: string }) => item.id), ['card', 'usd-card']);
  const face = find(root, 'CardFace');
  assert.equal(face.props.name, 'Visa Gold');
  assert.equal(face.props.last4, '4009');
  assert.equal(face.props.currency, 'ARS');
  // 20.000 opening debt + 23.100 purchase − 30.000 payment.
  assert.equal(find(root, 'Money').props.minor, 13100);
  const purchases = nodes(root).filter(node => node.type === 'Money').map(node => node.props.minor);
  assert.ok(purchases.includes(500000 - 13100), 'available limit is limit minus recorded debt');
  const caption = nodes(root).find(node => node.type === 'SectionTitle' && node.props.action === 'Ver todo')!.props.caption;
  assert.match(caption, /^Resumen abierto desde .* · 1 compra · 1 pago$/, 'statement facts live in one caption line');
  assert.equal(nodes(root).filter(node => node.type === 'Surface').length >= 1, true);
  find(root, 'ActionButton', 'Registrar compra').props.onPress();
  assert.equal(JSON.stringify(view.pushed.at(-1)), JSON.stringify({ pathname: '/new-entry', params: { accountId: 'card-acc', kind: 'expense' } }));
  find(root, 'ActionButton', 'Pagar tarjeta').props.onPress();
  assert.equal(JSON.stringify(view.pushed.at(-1)), JSON.stringify({ pathname: '/new-transfer', params: { toAccountId: 'card-acc', title: 'Pagar tarjeta', note: 'Pago Visa Gold', maxAmountMinor: '13100' } }));
  const recent = nodes(root).filter(node => node.type === 'MovementRow');
  assert.equal(recent.length, 2);
  assert.ok(recent.every(node => node.props.context === 'card' && node.props.accountId === 'card-acc'));
  // Personal debts are a different obligation: the tab never lists them or links to them, even with an active debt recorded.
  assert.deepEqual(nodes(root).filter(node => node.type === 'DebtRow'), []);
  assert.equal(nodes(root).some(node => node.type === 'SectionTitle' && node.props.children === 'Deudas y cobros'), false);
  assert.equal(JSON.stringify(view.pushed).includes('/debts'), false);
  assert.equal(nodes(root).filter(node => node.type === 'SectionTitle').map(node => node.props.children).join(','), 'Recientes');
});

test('switching the carousel selection changes the panel, and a card without limit hides availability', () => {
  const view = harness('cards.tsx');
  find(view.render(), 'CardCarousel').props.onSelect(1);
  const root = view.render();
  assert.equal(find(root, 'CardCarousel').props.selectedIndex, 1);
  const panel = nodes(root).find(node => typeof node.type === 'function' && node.props.summary)!;
  assert.equal(panel.props.summary.card.id, 'usd-card');
  assert.equal(panel.props.summary.availableMinor, null);
  assert.equal(find(root, 'ActionButton', 'Pagar tarjeta').props.disabled, true, 'nothing to pay on a card without debt');
});

test('card detail lists only that card account with card context and links purchase/payment actions', () => {
  const view = harness('card/[id].tsx', { id: 'card' });
  const root = view.render();
  const list = find(root, 'EntryList');
  assert.equal(list.props.context, 'card');
  assert.equal(list.props.accountId, 'card-acc');
  assert.deepEqual(list.props.entries.map((entry: domain.Entry) => entry.id), ['purchase']);
  assert.deepEqual(list.props.transfers.map((transfer: domain.Transfer) => transfer.id), ['payment']);
  assert.equal(find(root, 'Money').props.minor, 13100);
  // Identity on the card face, one debt, three facts, primary above secondary, then activity. No detail table.
  assert.equal(nodes(root).some(node => node.type === 'DetailRow'), false);
  const stats = nodes(root).filter(node => node.type === 'Stat').map(node => node.props.label);
  assert.deepEqual(stats, ['Disponible', 'Cierre', 'Vencimiento']);
  assert.ok(nodes(root).filter(node => node.type === 'Money').map(node => node.props.minor).includes(500000 - 13100), 'available limit');
  assert.ok(nodes(root).some(node => node.type === 'AppText' && node.props.children?.[1] === '$ 5.000,00'), 'the limit is a caption under Disponible');
  const buttons = nodes(root).filter(node => node.type === 'ActionButton').map(node => node.props);
  assert.deepEqual(buttons.map(button => button.label), ['Registrar compra', 'Pagar tarjeta']);
  assert.equal(buttons[1].secondary, true);
  assert.ok(buttons.every(button => button.containerStyle === undefined), 'both actions span the full width');
  assert.match(find(root, 'SectionTitle').props.caption, /^Resumen abierto desde .* · 1 compra · 1 pago$/);
  assert.equal(find(harness('card/[id].tsx', { id: 'missing' }).render(), 'EmptyState').props.title, 'No encontramos esta tarjeta');
});

test('debts screen separates what I owe from what they owe me and never mixes currencies', () => {
  const receivableAccount: domain.Account = { id: 'rec-acc', name: 'Me deben · Ana', currency: 'USD', openingMinor: 4000, createdAt };
  const receivable: domain.PersonalDebtProfile = { ...debt, id: 'receivable', accountId: receivableAccount.id, direction: 'owed_to_me', counterparty: 'Ana', dueDateISO: null };
  const data = { ...archive, accounts: [...archive.accounts, receivableAccount], debts: [debt, receivable] };
  const root = harness('debts.tsx', {}, data).render();
  const rows = nodes(root).filter(node => node.type === 'DebtRow');
  assert.deepEqual(rows.map(row => row.props.debt.id), ['debt', 'receivable']);
  const totals = nodes(root).filter(node => node.type === 'Money').map(node => [node.props.currency, node.props.minor]);
  assert.deepEqual(totals, [['ARS', 30000], ['ARS', 0], ['USD', 0], ['USD', 4000]]);
  assert.equal(find(harness('debts.tsx', {}, empty).render(), 'EmptyState').props.title, 'Lo que debés y lo que te deben');
});

test('debt detail offers a capped payment into the debt and lists its settlements with debt context', () => {
  const view = harness('debt/[id].tsx', { id: 'debt' });
  const root = view.render();
  const list = find(root, 'EntryList');
  assert.equal(list.props.context, 'debt');
  assert.deepEqual(list.props.transfers, []);
  assert.equal(find(root, 'Money').props.minor, 30000);
  find(root, 'ActionButton', 'Registrar pago').props.onPress();
  assert.equal(JSON.stringify(view.pushed[0]), JSON.stringify({ pathname: '/new-transfer', params: { toAccountId: 'debt-acc', title: 'Registrar pago', note: 'Pago a Juan', maxAmountMinor: '30000' } }));
});
