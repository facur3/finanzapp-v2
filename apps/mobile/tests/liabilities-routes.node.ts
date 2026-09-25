import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as domain from '@finanzapp/domain';
import * as presentation from '../src/ui/presentation.ts';
import * as moneyInput from '../src/ui/money-input.ts';
import { PREVIEW_CURRENCIES } from '../src/storage/currency-gate.ts';
import * as currencies from '../src/ui/currencies.ts';
import * as liabilityPresentation from '../src/ui/liability-presentation.ts';
import * as i18nFormat from '../src/i18n/format.ts';
import { bindLocale } from '../src/i18n/bind.ts';
import type { AppLocale } from '../src/i18n/locale.ts';
import { realModule, swipeActionsMock } from './real-module.ts';
// The locale every harness reads on render; an English test switches it and restores Spanish.
let activeLocale: AppLocale = 'es-AR';
const i18nProvider = { useI18n: () => bindLocale(activeLocale) };

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
  note: '', active: true, deleted: false, createdAt, revision: 0, updatedAt: createdAt };
const purchase: domain.Entry = { id: 'purchase', accountId: cardAccount.id, kind: 'expense', amountMinor: 23100, merchant: 'Starbucks', category: 'Café', dateISO: '2026-09-12', createdAt };
const payment: domain.Transfer = { id: 'payment', fromAccountId: cash.id, toAccountId: cardAccount.id, amountMinor: 30000, note: 'Pago Visa Gold', dateISO: '2026-09-15', createdAt };
const archive: domain.LedgerArchive = { accounts: [cash, cardAccount, usdCardAccount, debtAccount], records: [domain.initialRecord(purchase)],
  transfers: [domain.initialTransferRecord(payment)], cards: [card, usdCard], debts: [debt] };
const empty: domain.LedgerArchive = { accounts: [cash], records: [] };

// `file` is a route under app/, or a component module under src/ (its exports are returned too).
function harness(file: string, params: Record<string, unknown> = {}, data: domain.LedgerArchive = archive, gate?: domain.CurrencyGate) {
  const source = readFileSync(new URL((file.startsWith('src/') ? '../' : '../app/') + file, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const jsx = (type: unknown, props: Record<string, unknown>) => ({ type, props });
  const state: unknown[] = [];
  const pushed: any[] = [];
  let cursor = 0;
  const cards: { account: domain.Account; card: domain.CreditCardProfile }[] = [], debts: { account: domain.Account; debt: domain.PersonalDebtProfile }[] = [];
  const savedDebts: domain.PersonalDebtProfile[] = [], alerts: { title: string; message: string; buttons: any[] }[] = [];
  let backs = 0;
  const ledger = { useLedger: () => ({ archive: data, snapshot: domain.snapshotFromArchive(data), ...(gate ? { gate } : {}),
    addCard: async (account: domain.Account, card: domain.CreditCardProfile) => { cards.push({ account, card }); }, saveCard: async () => {},
    addDebt: async (account: domain.Account, debt: domain.PersonalDebtProfile) => { debts.push({ account, debt }); },
    saveDebt: async (debt: domain.PersonalDebtProfile) => { savedDebts.push(debt); } }) };
  const componentNames = ['ActionButton', 'AppText', 'DetailRow', 'EmptyState', 'GlyphTile', 'IconButton', 'Money', 'MovementRow', 'PressFeedback',
    'Screen', 'SectionTitle', 'Stat', 'Surface', 'AmountField', 'Field', 'Choices', 'ErrorMessage'];
  const components = { ...Object.fromEntries(componentNames.map(name => [name, name])), toneColors: () => ({ color: '#000', soft: '#eee' }), useStacked: () => false };
  const theme = { space: { xs: 4, s: 8, m: 12, l: 16, xl: 20, xxl: 24, xxxl: 32 }, useCurrentDay: () => '2026-09-20', useReduceMotion: () => true,
    usePalette: () => ({ text: '#000', secondary: '#666', tertiary: '#999', line: '#ddd', inset: '#eee', expense: '#c00', income: '#080', warning: '#a60', transfer: '#03c', primary: '#2557D6' }) };
  const modules: Record<string, unknown> = {
    'expo-haptics': { NotificationFeedbackType: { Success: 'Success' }, notificationAsync: async () => {}, selectionAsync: async () => {} },
    'expo-crypto': { randomUUID: () => 'id-' + Math.random().toString(36).slice(2, 8) },
    '../i18n/messages': {},
    './form-controls': { DateField: 'DateField' },
    './money-input': moneyInput,
    '../i18n/format': i18nFormat, '../src/i18n/format': i18nFormat, '../../src/i18n/format': i18nFormat, '../i18n/provider': i18nProvider, '../src/i18n/provider': i18nProvider, '../../src/i18n/provider': i18nProvider,
    react: { useRef: (initial: unknown) => ({ current: initial }), useEffect: (fn: () => unknown) => { fn(); }, useMemo: (fn: () => unknown) => fn(), useState: (initial: unknown) => {
      const index = cursor++;
      if (!(index in state)) state[index] = typeof initial === 'function' ? (initial as () => unknown)() : initial;
      return [state[index], (value: unknown) => { state[index] = typeof value === 'function' ? (value as (current: unknown) => unknown)(state[index]) : value; }];
    } },
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'react-native': { View: 'View', Alert: { alert: (title: string, message: string, buttons: any[]) => alerts.push({ title, message, buttons }) }, Keyboard: { dismiss() {} }, useWindowDimensions: () => ({ width: 393, fontScale: 1 }) },
    'react-native-reanimated': { __esModule: true, default: { View: 'Animated.View' }, useSharedValue: (value: number) => ({ value }),
      withTiming: (value: number) => value, useAnimatedStyle: (fn: () => unknown) => fn() },
    'expo-router': { Stack: { Screen: 'Stack.Screen' }, useLocalSearchParams: () => params, router: { push: (to: unknown) => pushed.push(to), navigate: (to: unknown) => pushed.push(to),
      canGoBack: () => true, back: () => { backs++; }, replace: (to: unknown) => pushed.push(to) } },
    '@finanzapp/domain': domain,
    '../src/storage/LedgerProvider': ledger, '../../src/storage/LedgerProvider': ledger, '../storage/LedgerProvider': ledger,
    '../src/ui/components': components, '../../src/ui/components': components, './components': components,
    './currencies': currencies, './currency-switch': { CurrencySwitch: 'CurrencySwitch' }, '../src/ui/currency-switch': { CurrencySwitch: 'CurrencySwitch' }, '../../src/ui/currency-switch': { CurrencySwitch: 'CurrencySwitch' },
    '../src/ui/card-visual': { CardCarousel: 'CardCarousel', CardFace: 'CardFace' }, '../../src/ui/card-visual': { CardCarousel: 'CardCarousel', CardFace: 'CardFace' },
    '../src/ui/entry-list': { EntryList: 'EntryList' }, '../../src/ui/entry-list': { EntryList: 'EntryList' },
    '../src/ui/liability-presentation': liabilityPresentation, '../../src/ui/liability-presentation': liabilityPresentation,
    '../src/ui/presentation': presentation, '../../src/ui/presentation': presentation,
    '../src/ui/theme': theme, '../../src/ui/theme': theme, './theme': theme,
    '../src/ui/liability-rows': { DebtRow: 'DebtRow' }, '../../src/ui/liability-rows': { DebtRow: 'DebtRow' },
    './swipe-actions': swipeActionsMock,
    '../src/ui/quick-actions': { QuickActions: 'QuickActions', AssistantEntry: 'AssistantEntry' }, '../../src/ui/quick-actions': { QuickActions: 'QuickActions', AssistantEntry: 'AssistantEntry' },
    '../src/ui/motion': { ValueTransition: 'ValueTransition', Reflow: 'Reflow', selectionHaptic: () => {}, impactHaptic: () => {}, timing: (kind: string, reduced: boolean) => ({ duration: reduced ? 0 : 260 }) }, '../../src/ui/motion': { ValueTransition: 'ValueTransition', Reflow: 'Reflow', selectionHaptic: () => {}, impactHaptic: () => {}, timing: (kind: string, reduced: boolean) => ({ duration: reduced ? 0 : 260 }) },
  };
  const require = (name: string) => {
    if (!Object.hasOwn(modules, name)) throw new Error('Unexpected liabilities dependency: ' + name);
    return modules[name];
  };
  // 24UX4: the management hooks run for real (Alert, saveDebt, router and haptics are the mocks above).
  const management = realModule('src/ui/commitment-actions.ts', require);
  modules['../src/ui/commitment-actions'] = management; modules['../../src/ui/commitment-actions'] = management;
  const module = { exports: {} as { default?: () => Node } & Record<string, (props: any) => Node> };
  runInNewContext(code, { module, exports: module.exports, require, Error });
  return { render: () => { cursor = 0; return module.exports.default!(); }, renderExport: (name: string, props: any = {}) => { cursor = 0; return module.exports[name](props); },
    pushed, cards, debts, savedDebts, alerts, backs: () => backs, exports: module.exports };
}

// Nested function components (CardPanel, UsageBar, DebtRow) are expanded so
// their descriptors can be inspected like the host components.
function nodes(value: any): Node[] {
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!value.props) return [];
  const own = typeof value.type === 'function' ? nodes(value.type(value.props)) : [];
  return [value, ...own, ...nodes(value.props.children), ...nodes(value.props.header), ...nodes(value.props.action), ...nodes(value.props.footer),
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
  assert.equal(JSON.stringify(view.pushed.at(-1)), JSON.stringify({ pathname: '/new-transfer', params: { toAccountId: 'card-acc', maxAmountMinor: '13100' } }), 'no visible title or note travels in the URL: the transfer form names the payment itself');
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
  assert.ok(nodes(root).some(node => node.type === 'AppText' && node.props.children === 'de $\u00A05.000,00'), 'the limit is a caption under Disponible (one catalogue string)');
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
  assert.equal(JSON.stringify(view.pushed[0]), JSON.stringify({ pathname: '/new-transfer', params: { toAccountId: 'debt-acc', maxAmountMinor: '30000' } }));
});

test('Tarjetas and Deudas read English labels, keep user names as typed and send the same payment parameters', () => {
  activeLocale = 'en-AR';
  try {
    const cardsView = harness('cards.tsx');
    const cardsRoot = cardsView.render();
    const header = nodes(cardsRoot).find(node => node.type === 'Stack.Screen')!.props.options;
    assert.equal(header.title, 'Cards');
    assert.deepEqual(nodes(cardsRoot).filter(node => node.type === 'Stat').map(node => node.props.label), ['Available', 'Closing', 'Due']);
    assert.match(find(cardsRoot, 'SectionTitle').props.caption, /^Statement open since .* · 1 purchase · 1 payment$/);
    find(cardsRoot, 'ActionButton', 'Pay card').props.onPress();
    assert.equal(JSON.stringify(cardsView.pushed.at(-1)), JSON.stringify({ pathname: '/new-transfer', params: { toAccountId: 'card-acc', maxAmountMinor: '13100' } }));
    const face = nodes(cardsRoot).find(node => node.type === 'CardFace')!;
    assert.equal(face.props.name, 'Visa Gold', 'the card name is user data');
    assert.equal(face.props.accessibilityHint, 'Opens the card details');

    const detail = harness('card/[id].tsx', { id: 'card' }).render();
    assert.ok(nodes(detail).some(node => node.type === 'AppText' && node.props.children === 'Recorded debt'), 'the same noun as the payment form (Recorded debt)');
    assert.equal(nodes(detail).find(node => node.type === 'Stack.Screen')!.props.options.title, 'Visa Gold');

    const debtView = harness('debt/[id].tsx', { id: 'debt' });
    const debtRoot = debtView.render();
    assert.equal(nodes(debtRoot).find(node => node.type === 'Stack.Screen')!.props.options.title, 'Juan', 'the counterparty is user data');
    assert.ok(nodes(debtRoot).some(node => node.type === 'AppText' && node.props.children === 'Due Oct 1'));
    const rows = nodes(debtRoot).filter(node => node.type === 'DetailRow').map(node => [node.props.label, node.props.value].join('='));
    assert.equal(rows.join(','), 'Type=I owe,Due date=Oct 1,Status=Due Oct 1');
    find(debtRoot, 'ActionButton', 'Record payment').props.onPress();
    assert.equal(JSON.stringify(debtView.pushed[0]), JSON.stringify({ pathname: '/new-transfer', params: { toAccountId: 'debt-acc', maxAmountMinor: '30000' } }));

    const debtsRoot = harness('debts.tsx').render();
    assert.equal(nodes(debtsRoot).find(node => node.type === 'Stack.Screen')!.props.options.title, 'Debts and IOUs', 'the same name as the Más row that opens it');
    assert.deepEqual(nodes(debtsRoot).filter(node => node.type === 'SectionTitle').map(node => node.props.children), ['I owe']);
  } finally { activeLocale = 'es-AR'; }
});

test('statement caption and due label keep the Spanish wording and follow a translator', () => {
  const statement = { startISO: '2026-08-29', purchaseCount: 2, paymentCount: 1 };
  const relative = (iso: string) => i18nFormat.relativeDate(iso, '2026-09-20');
  assert.equal(liabilityPresentation.statementCaption(statement, relative), 'Resumen abierto desde 29 ago · 2 compras · 1 pago');
  assert.equal(liabilityPresentation.statementCaption({ ...statement, purchaseCount: 1, paymentCount: 0 }, relative), 'Resumen abierto desde 29 ago · 1 compra · 0 pagos');
  assert.equal(liabilityPresentation.statementCaption(statement, iso => i18nFormat.relativeDate(iso, '2026-09-20', 'en-AR'), bindLocale('en-AR').t),
    'Statement open since Aug 29 · 2 purchases · 1 payment');
  assert.equal(liabilityPresentation.dueLabel('2026-09-19', '2026-09-20'), domain.labelFromISO('2026-09-19', new Date('2026-09-20T12:00:00')));
  assert.equal(liabilityPresentation.dueLabel('2026-10-01', '2026-09-20', 'en-US'), 'Oct 1');
});

test('23.1C2: a day inside a sentence starts in lower case; a day on its own keeps its capital', () => {
  const dueToday: domain.PersonalDebtProfile = { ...debt, dueDateISO: '2026-09-20' };
  const overdue: domain.PersonalDebtProfile = { ...debt, dueDateISO: '2026-09-19' };
  const detailOf = (profile: domain.PersonalDebtProfile) => {
    const root = harness('debt/[id].tsx', { id: 'debt' }, { ...archive, debts: [profile] }).render();
    return { status: nodes(root).find(node => node.type === 'AppText' && node.props.variant === 'subhead')!.props.children,
      rows: nodes(root).filter(node => node.type === 'DetailRow').map(node => [node.props.label, node.props.value].join('=')).join(',') };
  };
  const rowOf = (profile: domain.PersonalDebtProfile) => {
    const row = harness('src/ui/liability-rows.tsx', {}, { ...archive, debts: [profile] }).exports.DebtRow({ debt: profile, last: true });
    const caption = nodes(row).find(node => node.type === 'AppText' && node.props.variant === 'footnote')!.props.children;
    // 24UX4: the pressable row sits inside its SwipeRow.
    return { label: find(row, 'PressFeedback').props.accessibilityLabel, caption: [caption].flat().join('') };
  };
  assert.deepEqual(detailOf(dueToday), { status: 'Vence hoy', rows: 'Tipo=Yo debo,Vencimiento=Hoy,Estado=Vence hoy' });
  assert.deepEqual(detailOf(overdue), { status: 'Vencida · Ayer', rows: 'Tipo=Yo debo,Vencimiento=Ayer,Estado=Vencida · Ayer' });
  assert.deepEqual(rowOf(dueToday), { label: 'Debo a Juan, 300,00 ARS, Vence hoy', caption: 'Debo · Vence hoy' });
  assert.equal(rowOf(overdue).caption, 'Debo · Vencida · Ayer');
  assert.equal(rowOf(debt).caption, 'Debo · Vence 1 oct', 'a future date is never relative');
  // Closing day 18, today the 20th: the statement opened yesterday.
  const closedYesterday: domain.CreditCardProfile = { ...card, closingDay: 18 };
  const caption = (file: string) => nodes(harness(file, { id: 'card' }, { ...archive, cards: [closedYesterday, usdCard] }).render())
    .find(node => node.type === 'SectionTitle' && node.props.caption)!.props.caption;
  assert.match(caption('cards.tsx'), /^Resumen abierto desde ayer · /);
  assert.match(caption('card/[id].tsx'), /^Resumen abierto desde ayer · /);
  activeLocale = 'en-US';
  try {
    assert.deepEqual(detailOf(dueToday), { status: 'Due today', rows: 'Type=I owe,Due date=Today,Status=Due today' });
    assert.deepEqual(rowOf(dueToday), { label: 'I owe Juan, 300.00 ARS, Due today', caption: 'I owe · Due today' });
    assert.equal(detailOf(debt).status, 'Due Oct 1', 'an English short date keeps its capital month');
    assert.match(caption('cards.tsx'), /^Statement open since yesterday · /);
  } finally { activeLocale = 'es-AR'; }
  const inline = (locale: AppLocale) => (iso: string) => i18nFormat.relativeDate(iso, '2026-09-20', locale, true);
  const statement = { startISO: '2026-09-19', purchaseCount: 2, paymentCount: 1 };
  assert.equal(liabilityPresentation.statementCaption(statement, inline('es-AR')), 'Resumen abierto desde ayer · 2 compras · 1 pago');
  assert.equal(liabilityPresentation.statementCaption(statement, inline('en-AR'), bindLocale('en-AR').t), 'Statement open since yesterday · 2 purchases · 1 payment');
});

test('23.1C2: the card usage caption is shown in the region\'s format and spoken in the language\'s numbers', () => {
  // 13.100 of 5.000.000 cents used: 3 % of the limit.
  const usage = () => nodes(harness('cards.tsx').render()).find(node => node.type === 'AppText' && typeof node.props.accessibilityLabel === 'string')!;
  const expected: [AppLocale, string, string][] = [
    ['es-AR', '3 % del límite de $\u00A05.000,00', '3 % del límite de 5000,00 pesos'],
    ['es-US', '3 % del límite de AR$\u00A05,000.00', '3 % del límite de 5000,00 pesos'],
    ['en-AR', '3% of the $\u00A05.000,00 limit', '3% of the 5000.00 pesos limit'],
    ['en-US', '3% of the AR$\u00A05,000.00 limit', '3% of the 5000.00 pesos limit'],
  ];
  try {
    for (const [locale, shown, spoken] of expected) {
      activeLocale = locale;
      const caption = usage();
      assert.equal(caption.props.children, shown, locale + ' visible');
      assert.equal(caption.props.accessibilityLabel, spoken, locale + ' spoken');
    }
  } finally { activeLocale = 'es-AR'; }
});

// ---- Producto 24B5: the currency before the amount, over the build's gate ----------------------
function order(root: any, types: string[]): string[] {
  const seen: string[] = [];
  const walk = (value: any) => { if (!value || typeof value !== 'object') return; if (Array.isArray(value)) { value.forEach(walk); return; }
    if (types.includes(value.type)) seen.push(value.type); walk(value.props?.children); };
  walk(root);
  return seen;
}
test('24B5: the card and debt forms choose the currency before the amount, over the gate; with the preview gate a card in yen and a debt in dinars are created at their own scale', async () => {
  const forms = (file: string, gate?: domain.CurrencyGate) => {
    const view = harness(file, {}, empty, gate);
    const name = file.includes('card') ? 'CardForm' : 'DebtForm';
    return { ...view, render: () => view.renderExport(name, {}) };
  };
  // A release: exactly ARS and USD, and the switch precedes the amount field in both forms.
  for (const file of ['src/ui/card-form.tsx', 'src/ui/debt-form.tsx']) {
    const view = forms(file);
    const root = view.render();
    assert.deepEqual(find(root, 'CurrencySwitch').props.currencies, ['ARS', 'USD'], file);
    assert.deepEqual(order(root, ['CurrencySwitch', 'AmountField']).slice(0, 2), ['CurrencySwitch', 'AmountField'], file + ': the currency before the amount');
  }
  const card = forms('src/ui/card-form.tsx', PREVIEW_CURRENCIES);
  assert.deepEqual(find(card.render(), 'CurrencySwitch').props.currencies, [...PREVIEW_CURRENCIES]);
  find(card.render(), 'CurrencySwitch').props.onChange('JPY');
  assert.equal(find(card.render(), 'AmountField').props.currency, 'JPY', 'the field knows the currency before a digit is typed');
  find(card.render(), 'Field', 'Nombre de la tarjeta').props.onChangeText('Rakuten');
  find(card.render(), 'AmountField', 'Deuda actual (opcional)').props.onChangeText('1500');
  find(card.render(), 'Field', 'Día de cierre').props.onChangeText('28');
  find(card.render(), 'Field', 'Día de vencimiento').props.onChangeText('5');
  await find(card.render(), 'ActionButton', 'Crear tarjeta').props.onPress();
  assert.equal(card.cards.length, 1);
  assert.deepEqual([card.cards[0].account.currency, card.cards[0].account.openingMinor], ['JPY', -1500], '1500 yen owed, never 15.00');
  const debt = forms('src/ui/debt-form.tsx', PREVIEW_CURRENCIES);
  find(debt.render(), 'CurrencySwitch').props.onChange('KWD');
  find(debt.render(), 'AmountField').props.onChangeText('1,234');
  find(debt.render(), 'Field', 'Persona o entidad').props.onChangeText('Ana');
  await find(debt.render(), 'ActionButton', 'Crear deuda').props.onPress();
  assert.equal(debt.debts.length, 1);
  assert.deepEqual([debt.debts[0].account.currency, debt.debts[0].account.openingMinor], ['KWD', -1234], '1,234 dinars are 1234 fils');
  // The same forms with the release gate never see the preview currencies, whatever the route or the draft says.
  const release = forms('src/ui/debt-form.tsx');
  assert.equal(nodes(release.render()).some(node => node.type === 'CurrencySwitch' && node.props.currencies.includes('KWD')), false);
});

// ---- Producto 24UX4: settle, close, reopen and delete a debt tracker ---------------------------
const settledPayment: domain.Transfer = { id: 'settle-juan', fromAccountId: cash.id, toAccountId: debtAccount.id, amountMinor: 30000, note: 'Pago a Juan', dateISO: '2026-09-18', createdAt };
const settledData: domain.LedgerArchive = { ...archive, transfers: [...archive.transfers!, domain.initialTransferRecord(settledPayment)] };
const labelsOf = (actions: { label: string }[]) => actions.map(action => action.label).join(',');
const rowsOf = (root: Node) => nodes(root).filter(node => node.type === 'DebtRow');
const settle = async () => { await new Promise(resolve => setImmediate(resolve)); };

test('24UX4: a debt row swipes to Saldar (the whole balance, prefilled) and Eliminar; a settled one to Cerrar; a closed one to Reabrir', async () => {
  const view = harness('debts.tsx');
  const [row] = rowsOf(view.render());
  assert.equal(labelsOf(row.props.actions), 'Saldar,Eliminar');
  assert.equal(row.props.actions.map((action: { tone: string }) => action.tone).join(','), 'accent,destructive');
  row.props.actions[0].onPress();
  assert.equal(JSON.stringify(view.pushed.at(-1)), JSON.stringify({ pathname: '/new-transfer', params: { toAccountId: 'debt-acc', maxAmountMinor: '30000', amountMinor: '30000' } }),
    'Saldar opens the reviewed payment form; nothing is marked paid without a recorded transfer');
  assert.equal(view.savedDebts.length, 0);

  const settled = harness('debts.tsx', {}, settledData);
  const [settledRow] = rowsOf(settled.render());
  assert.equal(labelsOf(settledRow.props.actions), 'Cerrar,Eliminar');
  await settledRow.props.actions[0].onPress();
  await settle();
  assert.equal(settled.alerts.length, 0, 'closing a settled debt needs no confirmation');
  assert.equal(JSON.stringify({ ...settled.savedDebts[0], updatedAt: '' }), JSON.stringify({ ...debt, active: false, revision: 1, updatedAt: '' }));

  // Closed: out of the pending totals, listed under Cerradas, reopened from its row.
  const closed = harness('debts.tsx', {}, { ...settledData, debts: [settled.savedDebts[0]] });
  const root = closed.render();
  assert.equal(nodes(root).filter(node => node.type === 'SectionTitle').map(node => node.props.children).join(','), 'Cerradas');
  assert.equal(find(root, 'SectionTitle').props.caption, 'No cuentan como pendientes');
  assert.equal(nodes(root).some(node => node.type === 'Stat'), false, 'no open debt: no pending totals');
  const [closedRow] = rowsOf(root);
  assert.equal(labelsOf(closedRow.props.actions), 'Reabrir,Eliminar');
  await closedRow.props.actions[0].onPress();
  await settle();
  assert.equal(closed.savedDebts[0].active, true);
  assert.equal(closed.savedDebts[0].revision, 2);
});

test('24UX4: closing a debt with a balance left asks first and never records a payment', async () => {
  const view = harness('debt/[id].tsx', { id: 'debt' });
  const root = view.render();
  const buttons = nodes(root).filter(node => node.type === 'ActionButton').map(node => node.props.label).join(',');
  assert.equal(buttons, 'Registrar pago,Cerrar deuda,Eliminar deuda', 'the payment first; the management actions at the end of the screen');
  assert.equal(find(root, 'ActionButton', 'Eliminar deuda').props.tone, 'expense');
  find(root, 'ActionButton', 'Cerrar deuda').props.onPress();
  const alert = view.alerts[0];
  assert.equal(alert.title, '¿Cerrar la deuda con Juan?');
  assert.equal(alert.message, 'Todavía quedan $ 300,00 pendientes. Cerrarla la saca de pendientes sin registrar un pago; podés reabrirla.');
  assert.equal(alert.buttons.map((button: { text: string; style?: string }) => button.text + ':' + (button.style ?? '')).join(','), 'Cancelar:cancel,Cerrar:');
  assert.equal(view.savedDebts.length, 0);
  await alert.buttons[1].onPress();
  await settle();
  assert.equal(view.savedDebts[0].active, false);
  assert.equal(view.savedDebts[0].deleted, false);
  assert.equal(view.backs(), 0, 'closing keeps the detail open');
  // Closed: the state says Cerrada, no payment can be recorded, the action reopens.
  const closed = harness('debt/[id].tsx', { id: 'debt' }, { ...archive, debts: [view.savedDebts[0]] }).render();
  assert.ok(nodes(closed).some(node => node.type === 'DetailRow' && node.props.value === 'Cerrada'));
  assert.equal(find(closed, 'ActionButton', 'Registrar pago').props.disabled, true);
  find(closed, 'ActionButton', 'Reabrir deuda');
});

test('24UX4: deleting a debt asks first, names the payments that stay, writes only the tracker\'s deletion record and leaves the detail', async () => {
  const view = harness('debt/[id].tsx', { id: 'debt' }, settledData);
  find(view.render(), 'ActionButton', 'Eliminar deuda').props.onPress();
  const alert = view.alerts[0];
  assert.equal(alert.title, '¿Eliminar la deuda con Juan?');
  assert.equal(alert.message, 'Deja de seguirse. El pago registrado sigue en Movimientos.');
  assert.equal(alert.buttons.map((button: { text: string; style?: string }) => button.text + ':' + (button.style ?? '')).join(','), 'Cancelar:cancel,Eliminar:destructive');
  await alert.buttons[1].onPress();
  await settle();
  assert.equal(JSON.stringify({ ...view.savedDebts[0], updatedAt: '' }), JSON.stringify({ ...debt, active: false, deleted: true, revision: 1, updatedAt: '' }));
  assert.equal(view.backs(), 1);
  // Stored: gone from Deudas (no open, no closed row, no totals), a deep link finds nothing, the payment is still the ledger's.
  const deletedData = { ...settledData, debts: [view.savedDebts[0]] };
  const list = harness('debts.tsx', {}, deletedData).render();
  assert.equal(rowsOf(list).length, 0);
  assert.equal(find(list, 'EmptyState').props.title, 'Lo que debés y lo que te deben');
  assert.equal(find(harness('debt/[id].tsx', { id: 'debt' }, deletedData).render(), 'EmptyState').props.title, 'No encontramos esta deuda');
  assert.equal(domain.snapshotFromArchive(deletedData).transfers!.some(transfer => transfer.id === 'settle-juan'), true);
  // A receivable with no collection yet: its own wording.
  const receivableAccount: domain.Account = { id: 'rec-acc', name: 'Me deben · Ana', currency: 'ARS', openingMinor: 4000, createdAt };
  const receivable: domain.PersonalDebtProfile = { ...debt, id: 'receivable', accountId: receivableAccount.id, direction: 'owed_to_me', counterparty: 'Ana', dueDateISO: null };
  const other = harness('debts.tsx', {}, { ...archive, accounts: [...archive.accounts, receivableAccount], debts: [receivable] });
  rowsOf(other.render())[0].props.actions[1].onPress();
  assert.equal(other.alerts[0].title, '¿Eliminar lo que te debe Ana?');
  assert.equal(other.alerts[0].message, 'Deja de seguirse. No borra ningún movimiento.');
});

test('24UX4: a closed row says Cerrada and carries its actions for VoiceOver; English reads the same flow', () => {
  const closed = { ...debt, active: false, revision: 1 };
  const view = harness('src/ui/liability-rows.tsx', {}, { ...archive, debts: [closed] });
  const actions = [{ key: 'reopen', label: 'Reabrir', icon: 'arrow-undo', tone: 'accent', onPress: () => {} }];
  const row = view.exports.DebtRow({ debt: closed, last: true, actions });
  assert.equal(row.type, 'SwipeRow');
  const press = find(row, 'PressFeedback');
  assert.equal(press.props.accessibilityLabel, 'Debo a Juan, 300,00 ARS, Cerrada');
  assert.equal(JSON.stringify(press.props.accessibilityActions), JSON.stringify([{ name: 'reopen', label: 'Reabrir' }]));
  activeLocale = 'en-AR';
  try {
    const english = harness('debt/[id].tsx', { id: 'debt' });
    const root = english.render();
    assert.equal(nodes(root).filter(node => node.type === 'ActionButton').map(node => node.props.label).join(','), 'Record payment,Close debt,Delete debt');
    find(root, 'ActionButton', 'Delete debt').props.onPress();
    assert.equal(english.alerts[0].title, 'Delete your debt to Juan?');
    assert.equal(labelsOf(rowsOf(harness('debts.tsx').render())[0].props.actions), 'Settle,Delete');
  } finally { activeLocale = 'es-AR'; }
});
