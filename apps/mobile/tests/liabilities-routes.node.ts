import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as domain from '@finanzapp/domain';
import { offeredCurrencies } from '../src/ui/currencies.ts';
import * as presentation from '../src/ui/presentation.ts';
import * as moneyInput from '../src/ui/money-input.ts';
import { PREVIEW_CURRENCIES } from '../src/storage/currency-gate.ts';
import * as currencies from '../src/ui/currencies.ts';
import * as liabilityPresentation from '../src/ui/liability-presentation.ts';
import * as geometry from '../src/ui/geometry.ts';
import * as installmentPresentation from '../src/ui/installment-presentation.ts';
import * as i18nFormat from '../src/i18n/format.ts';
import { bindLocale } from '../src/i18n/bind.ts';
import type { AppLocale } from '../src/i18n/locale.ts';
import { realModule, swipeActionsMock } from './real-module.ts';
// 24T2 (stream B): the card form's statement dates (pure, real in the harness).
import * as cardCycleForm from '../src/ui/card-cycle-form.ts';
// The locale every harness reads on render; an English test switches it and restores Spanish.
let activeLocale: AppLocale = 'es-AR';
const i18nProvider = { useI18n: () => bindLocale(activeLocale) };

// Exercise the Cards tab, card detail and debts handlers with native hosts
// replaced by descriptors. Not a rendered iOS screen, deck animation or gesture test.
type Node = { type: any; props: Record<string, any> };
const createdAt = '2026-09-01T12:00:00.000Z';
const cash: domain.Account = { id: 'cash', name: 'Banco', currency: 'ARS', openingMinor: 100000, createdAt };
const cardAccount: domain.Account = { id: 'card-acc', name: 'Visa Gold', currency: 'ARS', openingMinor: -20000, createdAt };
const usdCardAccount: domain.Account = { id: 'usd-card-acc', name: 'Amex USD', currency: 'USD', openingMinor: 0, createdAt };
const debtAccount: domain.Account = { id: 'debt-acc', name: 'Debo · Juan', currency: 'ARS', openingMinor: -30000, createdAt };
const card: domain.CreditCardProfile = { id: 'card', accountId: cardAccount.id, issuer: 'Galicia', last4: '4009', creditLimitMinor: 500000,
  closingDay: 28, dueDay: 5, active: true, deleted: false, createdAt, revision: 0, updatedAt: createdAt };
const usdCard: domain.CreditCardProfile = { ...card, id: 'usd-card', accountId: usdCardAccount.id, issuer: 'Amex', last4: '1001', creditLimitMinor: null };
const debt: domain.PersonalDebtProfile = { id: 'debt', accountId: debtAccount.id, direction: 'owed_by_me', counterparty: 'Juan', dueDateISO: '2026-10-01',
  note: '', active: true, deleted: false, createdAt, revision: 0, updatedAt: createdAt };
const purchase: domain.Entry = { id: 'purchase', accountId: cardAccount.id, kind: 'expense', amountMinor: 23100, merchant: 'Starbucks', category: 'Café', dateISO: '2026-09-12', createdAt };
const payment: domain.Transfer = { id: 'payment', fromAccountId: cash.id, toAccountId: cardAccount.id, amountMinor: 30000, note: 'Pago Visa Gold', dateISO: '2026-09-15', createdAt };
const archive: domain.LedgerArchive = { accounts: [cash, cardAccount, usdCardAccount, debtAccount], records: [domain.initialRecord(purchase)],
  transfers: [domain.initialTransferRecord(payment)], cards: [card, usdCard], debts: [debt] };
const empty: domain.LedgerArchive = { accounts: [cash], records: [] };

// `file` is a route under app/, or a component module under src/ (its exports are returned too).
function harness(file: string, params: Record<string, unknown> = {}, initial: domain.LedgerArchive | null = archive, gate?: domain.CurrencyGate) {
  // null: the ledger has not hydrated yet (LedgerProvider reads SQLite asynchronously); setData moves it on.
  let data = initial as domain.LedgerArchive;
  const source = readFileSync(new URL((file.startsWith('src/') ? '../' : '../app/') + file, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const jsx = (type: unknown, props: Record<string, unknown>) => ({ type, props });
  const state: unknown[] = [];
  const pushed: any[] = [];
  let cursor = 0;
  const cards: { account: domain.Account; card: domain.CreditCardProfile }[] = [], debts: { account: domain.Account; debt: domain.PersonalDebtProfile }[] = [];
  const savedDebts: domain.PersonalDebtProfile[] = [], removedDebts: string[] = [], alerts: { title: string; message: string; buttons: any[] }[] = [];
  let backs = 0;
  const ledger = { useLedger: () => ({ archive: data, snapshot: data ? domain.snapshotFromArchive(data) : null, ...(gate ? { gate } : {}),
    addCard: async (account: domain.Account, card: domain.CreditCardProfile) => { cards.push({ account, card }); }, saveCard: async () => {},
    addDebt: async (account: domain.Account, debt: domain.PersonalDebtProfile) => { debts.push({ account, debt }); },
    saveDebt: async (debt: domain.PersonalDebtProfile) => { savedDebts.push(debt); },
    // 25B2 close: what storage's `deletePersonalDebt` writes (the rule checked again, then the deletion record).
    removeDebt: async (id: string) => {
      const debt = data!.debts!.find(item => item.id === id)!;
      domain.assertDebtDeletable(debt, domain.snapshotFromArchive(data!));
      removedDebts.push(id); savedDebts.push(domain.deletePersonalDebt(debt, new Date().toISOString()));
    } }) };
  const componentNames = ['ActionButton', 'AppText', 'DetailRow', 'EmptyState', 'GlyphTile', 'IconButton', 'Money', 'MovementRow', 'PressFeedback',
    'Screen', 'SectionTitle', 'Stat', 'Surface', 'AmountField', 'Field', 'Choices', 'ErrorMessage', 'LifecycleNote'];
  const components = { ...Object.fromEntries(componentNames.map(name => [name, name])), toneColors: () => ({ color: '#000', soft: '#eee' }), useStacked: () => false };
  const theme = { space: { xs: 4, s: 8, m: 12, l: 16, xl: 20, xxl: 24, xxxl: 32 }, useCurrentDay: () => '2026-09-20', useReduceMotion: () => true,
    usePalette: () => ({ text: '#000', secondary: '#666', tertiary: '#999', line: '#ddd', inset: '#eee', expense: '#c00', income: '#080', warning: '#a60', transfer: '#03c', primary: '#2557D6' }) };
  // 24T2 (stream A): the deck replaces the carousel; the face keeps its width rule.
  const cardVisual = { CardDeck: 'CardDeck', CardFace: 'CardFace', cardFaceWidth: (windowWidth: number) => Math.min(windowWidth - 40, 420), cardFaceHeight: (width: number) => Math.round(width / 1.586) };
  const GATE = (typeof gate !== 'undefined' && gate) || domain.LEDGER_CURRENCIES;
  const defaults = { useDefaultCurrency: ({ accountCurrency, requested }: { accountCurrency?: string | null; requested?: unknown } = {}) => accountCurrency ?? (domain.isLedgerCurrency(requested, GATE) ? requested : 'ARS') };
  const modules: Record<string, unknown> = {
    'expo-haptics': { NotificationFeedbackType: { Success: 'Success' }, notificationAsync: async () => {}, selectionAsync: async () => {} },
    'expo-crypto': { randomUUID: () => 'id-' + Math.random().toString(36).slice(2, 8) },
    '../i18n/messages': {},
    './form-controls': { DateField: 'DateField' },
    './use-default-currency': defaults, '../src/ui/use-default-currency': defaults,
    './commitment-actions': { useCardManagement: () => ({ busyId: null, error: null, remove: () => {} }), useDebtManagement: () => ({ busyId: null, error: null, actions: () => [], remove: () => {}, settle: () => {}, close: () => {}, reopen: () => {} }), useRecurringManagement: () => ({ busyId: null, error: null, actions: () => [], remove: () => {} }), useAccountManagement: () => ({ busyId: null, error: null, actions: () => [], remove: () => {} }) },
    './money-input': moneyInput,
    '../i18n/format': i18nFormat, '../src/i18n/format': i18nFormat, '../../src/i18n/format': i18nFormat, '../i18n/provider': i18nProvider, '../src/i18n/provider': i18nProvider, '../../src/i18n/provider': i18nProvider,
    react: { useRef: (initial: unknown) => ({ current: initial }), useEffect: (fn: () => unknown) => { fn(); }, useMemo: (fn: () => unknown) => fn(), useState: (initial: unknown) => {
      const index = cursor++;
      if (!(index in state)) state[index] = typeof initial === 'function' ? (initial as () => unknown)() : initial;
      return [state[index], (value: unknown) => { state[index] = typeof value === 'function' ? (value as (current: unknown) => unknown)(state[index]) : value; }];
    } },
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'react-native': { View: 'View', Alert: { alert: (title: string, message: string, buttons: any[]) => alerts.push({ title, message, buttons }) }, Keyboard: { dismiss() {} }, useWindowDimensions: () => ({ width: 393, fontScale: 1 }),
      // 24UX6E: the debt row's hairline separator (a value no literal could fake).
      StyleSheet: { hairlineWidth: 0.33, create: (styles: unknown) => styles } },
    'react-native-reanimated': { __esModule: true, default: { View: 'Animated.View' }, useSharedValue: (value: number) => ({ value }),
      withTiming: (value: number) => value, useAnimatedStyle: (fn: () => unknown) => fn() },
    'expo-router': { Stack: { Screen: 'Stack.Screen' }, useLocalSearchParams: () => params, router: { push: (to: unknown) => pushed.push(to), navigate: (to: unknown) => pushed.push(to),
      canGoBack: () => true, back: () => { backs++; }, replace: (to: unknown) => pushed.push(to) } },
    '@finanzapp/domain': domain,
    '../src/storage/LedgerProvider': ledger, '../../src/storage/LedgerProvider': ledger, '../storage/LedgerProvider': ledger,
    '../src/ui/components': components, '../../src/ui/components': components, './components': components,
    './currencies': currencies, './currency-switch': { CurrencySwitch: 'CurrencySwitch' }, '../src/ui/currency-switch': { CurrencySwitch: 'CurrencySwitch' }, '../../src/ui/currency-switch': { CurrencySwitch: 'CurrencySwitch' },
    '../src/ui/card-visual': cardVisual, '../../src/ui/card-visual': cardVisual, '../src/ui/geometry': geometry,
    '../src/ui/entry-list': { EntryList: 'EntryList' }, '../../src/ui/entry-list': { EntryList: 'EntryList' },
    '../src/ui/liability-presentation': liabilityPresentation, '../../src/ui/liability-presentation': liabilityPresentation,
    '../src/ui/presentation': presentation, '../../src/ui/presentation': presentation,
    '../src/ui/theme': theme, '../../src/ui/theme': theme, './theme': theme,
    '../src/ui/liability-rows': { DebtRow: 'DebtRow' }, '../../src/ui/liability-rows': { DebtRow: 'DebtRow' },
    './swipe-actions': swipeActionsMock,
    '../src/ui/quick-actions': { QuickActions: 'QuickActions', AssistantEntry: 'AssistantEntry' }, '../../src/ui/quick-actions': { QuickActions: 'QuickActions', AssistantEntry: 'AssistantEntry' },
    '../src/ui/motion': { ValueTransition: 'ValueTransition', Reflow: 'Reflow', selectionHaptic: () => {}, impactHaptic: () => {}, timing: (kind: string, reduced: boolean) => ({ duration: reduced ? 0 : 260 }) }, '../../src/ui/motion': { ValueTransition: 'ValueTransition', Reflow: 'Reflow', selectionHaptic: () => {}, impactHaptic: () => {}, timing: (kind: string, reduced: boolean) => ({ duration: reduced ? 0 : 260 }) },
    // 24T2 (stream B): the card form's statement dates (real) and its «Usar estos días todos los meses» switch (a descriptor).
    './card-cycle-form': cardCycleForm, './switch-row': { SwitchRow: 'SwitchRow' },
  };
  // 24T2 (stream A): the rows of the card surfaces as descriptors, the plan presentation and the snapshot's own imports.
  Object.assign(components, { StatRow: 'StatRow' });
  const cardRows = { FutureInstallmentsRow: 'FutureInstallmentsRow', ArchivedCardRow: 'ArchivedCardRow', PlanRow: 'PlanRow', ScheduleRow: 'ScheduleRow' };
  Object.assign(modules, { '../src/ui/card-rows': cardRows, '../../src/ui/card-rows': cardRows, '../../src/ui/installment-presentation': installmentPresentation,
    './liability-presentation': liabilityPresentation, './motion': modules['../src/ui/motion'], '@expo/vector-icons/Ionicons': 'Ionicons' });
  const require = (name: string) => {
    if (!Object.hasOwn(modules, name)) throw new Error('Unexpected liabilities dependency: ' + name);
    return modules[name];
  };
  // 24UX4: the management hooks run for real (Alert, saveDebt, router and haptics are the mocks above).
  const management = realModule('src/ui/commitment-actions.ts', require);
  modules['../src/ui/commitment-actions'] = management; modules['../../src/ui/commitment-actions'] = management;
  // 24T2 (stream A): the balance, the three facts and the usage bar run for real, so the screens' figures are inspected as rendered.
  const panel = realModule('src/ui/card-panel.tsx', require);
  modules['../src/ui/card-panel'] = panel; modules['../../src/ui/card-panel'] = panel;
  const module = { exports: {} as { default?: () => Node } & Record<string, (props: any) => Node> };
  runInNewContext(code, { module, exports: module.exports, require, Error });
  return { render: () => { cursor = 0; return module.exports.default!(); }, renderExport: (name: string, props: any = {}) => { cursor = 0; return module.exports[name](props); },
    pushed, cards, debts, savedDebts, removedDebts, alerts, backs: () => backs, exports: module.exports,
    setData: (next: domain.LedgerArchive | null) => { data = next as domain.LedgerArchive; } };
}

// Nested function components (CardSnapshot, CardFacts, UsageBar, DebtRow) are expanded so
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
/** 24UX6E: a text node's words with its nested text nodes flattened (a row caption's toned state segment). */
function textOf(node: any): string {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node !== 'object') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  return textOf(node.props?.children);
}

test('Tarjetas shows an honest empty state and a debts invitation without any card', () => {
  const root = harness('cards.tsx', {}, empty).render();
  assert.equal(find(root, 'EmptyState').props.title, 'Tus tarjetas, como en la billetera');
  assert.equal(nodes(root).some(node => node.type === 'CardDeck'), false);
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
  // 24T2: a vertical deck in the stored order, the first card in front until another is chosen.
  const deck = find(root, 'CardDeck');
  assert.equal(deck.props.cards.map((item: { id: string }) => item.id).join(','), 'card,usd-card');
  assert.equal(deck.props.selectedId, 'card');
  const face = deck.props.cards[0];
  assert.equal(face.name, 'Visa Gold');
  assert.equal(face.last4, '4009');
  assert.equal(face.currency, 'ARS');
  assert.equal(face.issuer, 'Galicia');
  assert.equal(face.color, null, 'no colour chosen in Editar cuenta: the face keeps its hash tone');
  assert.equal(deck.props.showCurrency, true, 'cards in ARS and USD: each face prints its code');
  // 20.000 opening debt + 23.100 purchase − 30.000 payment.
  assert.equal(find(root, 'Money').props.minor, 13100);
  const purchases = nodes(root).filter(node => node.type === 'Money').map(node => node.props.minor);
  assert.ok(purchases.includes(500000 - 13100), 'available limit is limit minus recorded debt');
  // 24UX6D: Recientes reads like Inicio's sections: a quiet «Ver todos» that opens the card's detail.
  const recentTitle = nodes(root).find(node => node.type === 'SectionTitle' && node.props.action === 'Ver todos')!;
  assert.equal(recentTitle.props.quiet, true);
  const caption = recentTitle.props.caption;
  assert.match(caption, /^Este ciclo, desde .* · 1 compra · 1 pago$/, 'the open cycle\'s facts live in one caption line');
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

test('choosing another card in the deck changes the snapshot, and a card without limit says so instead of a figure', () => {
  const view = harness('cards.tsx');
  find(view.render(), 'CardDeck').props.onSelect('usd-card');
  const root = view.render();
  assert.equal(find(root, 'CardDeck').props.selectedId, 'usd-card', 'the selection is the card, not a position');
  const panel = nodes(root).find(node => typeof node.type === 'function' && node.props.summary)!;
  assert.equal(panel.props.summary.card.id, 'usd-card');
  assert.equal(panel.props.summary.availableMinor, null);
  assert.ok(nodes(root).some(node => node.type === 'AppText' && node.props.children === 'Sin límite cargado'));
  assert.equal(find(root, 'ActionButton', 'Pagar tarjeta').props.disabled, true, 'nothing to pay on a card without debt');
  // 24T2 review: the snapshot's height follows the card, so the blocks under the balance slide into place (Reflow) instead of jumping.
  assert.ok(nodes(root).filter(node => node.type === 'Reflow').length >= 3);
});

test('24T2 review: choosing a card whose front place is below the fold scrolls it into view; one in view leaves the page still', () => {
  const view = harness('cards.tsx');
  const scrolls: { y: number; animated: boolean }[] = [];
  const wire = (deckTop: number, viewportHeight: number) => {
    const root = view.render();
    const box = nodes(root).find(node => node.type === 'View' && node.props.ref)!;
    box.props.onLayout({ nativeEvent: { layout: { y: 20 } } });
    box.props.ref.current = { measureInWindow: (callback: (x: number, y: number) => void) => callback(0, deckTop) };
    const screen = nodes(root).find(node => node.type === 'Screen')!;
    screen.props.scrollRef.current = { scrollTo: (to: { y: number; animated: boolean }) => scrolls.push(to),
      getNativeScrollRef: () => ({ measureInWindow: (callback: (x: number, y: number, width: number, height: number) => void) => callback(0, 0, 393, viewportHeight) }) };
    return find(root, 'CardDeck');
  };
  // At rest under a 103 pt header (the deck 20 pt into the content, at 123 on screen): the front card of two is in view.
  wire(123, 852).props.onSelect('usd-card');
  assert.equal(scrolls.length, 0);
  assert.equal(find(view.render(), 'CardDeck').props.selectedId, 'usd-card');
  // A viewport too short for the front card (its top at 173, a 223 pt face, 200 pt visible): the page scrolls it to a
  // quarter of the viewport. The offset comes from the two measurements: −(123 − 20) now, 173 − 50 further.
  wire(123, 200).props.onSelect('card');
  assert.equal(scrolls.length, 1);
  assert.deepEqual([scrolls[0].y, scrolls[0].animated], [-103 + 173 - 50, false], 'Reduce Motion: no animation');
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
  assert.equal(stats.join(','), 'Vence,Cierra,Disponible', '24T2: the next due date first, then the next closing, then what is available');
  assert.ok(nodes(root).filter(node => node.type === 'Money').map(node => node.props.minor).includes(500000 - 13100), 'available limit');
  assert.ok(nodes(root).some(node => node.type === 'AppText' && node.props.children === 'de $\u00A05.000,00'), 'the limit is a caption under Disponible (one catalogue string)');
  const buttons = nodes(root).filter(node => node.type === 'ActionButton').map(node => node.props);
  assert.deepEqual(buttons.map(button => button.label), ['Registrar compra', 'Pagar tarjeta']);
  assert.equal(buttons[1].secondary, true);
  assert.ok(buttons.every(button => button.containerStyle === undefined), 'both actions span the full width');
  assert.match(find(root, 'SectionTitle').props.caption, /^Este ciclo, desde .* · 1 compra · 1 pago$/);
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
    assert.equal(nodes(cardsRoot).filter(node => node.type === 'Stat').map(node => node.props.label).join(','), 'Due,Closes,Available');
    assert.match(find(cardsRoot, 'SectionTitle').props.caption, /^This cycle, since .* · 1 purchase · 1 payment$/);
    find(cardsRoot, 'ActionButton', 'Pay card').props.onPress();
    assert.equal(JSON.stringify(cardsView.pushed.at(-1)), JSON.stringify({ pathname: '/new-transfer', params: { toAccountId: 'card-acc', maxAmountMinor: '13100' } }));
    // The deck's hints and labels are spoken by card-visual itself (cards-deck.node.ts).
    assert.equal(find(cardsRoot, 'CardDeck').props.cards[0].name, 'Visa Gold', 'the card name is user data');

    const detail = harness('card/[id].tsx', { id: 'card' }).render();
    assert.ok(nodes(detail).some(node => node.type === 'AppText' && node.props.children === 'Outstanding balance\u00A0·\u00A0ARS'), 'the same noun as the payment form (Outstanding balance), with its currency as in Tarjetas');
    assert.equal(nodes(detail).find(node => node.type === 'Stack.Screen')!.props.options.title, 'Visa Gold');

    const debtView = harness('debt/[id].tsx', { id: 'debt' });
    const debtRoot = debtView.render();
    assert.equal(nodes(debtRoot).find(node => node.type === 'Stack.Screen')!.props.options.title, 'Juan', 'the counterparty is user data');
    const dueLine = nodes(debtRoot).find(node => node.type === 'AppText' && node.props.children === 'Due Oct 1')!;
    assert.equal(dueLine.props.accessibilityLabel, 'Due October 1, 2026', '24UX6E: VoiceOver hears the day written out');
    // 24UX6E: no detail table repeating the eyebrow (Type) and the state line (Due date, Status).
    assert.deepEqual(nodes(debtRoot).filter(node => node.type === 'DetailRow'), []);
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
  assert.equal(liabilityPresentation.statementCaption(statement, relative), 'Este ciclo, desde 29 ago · 2 compras · 1 pago');
  assert.equal(liabilityPresentation.statementCaption({ ...statement, purchaseCount: 1, paymentCount: 0 }, relative), 'Este ciclo, desde 29 ago · 1 compra · 0 pagos');
  assert.equal(liabilityPresentation.statementCaption(statement, iso => i18nFormat.relativeDate(iso, '2026-09-20', 'en-AR'), bindLocale('en-AR').t),
    'This cycle, since Aug 29 · 2 purchases · 1 payment');
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
    const caption = nodes(row).find(node => node.type === 'AppText' && node.props.variant === 'footnote')!;
    // 24UX4: the pressable row sits inside its SwipeRow. 24UX6E: the state words are their own text inside the caption.
    return { label: find(row, 'PressFeedback').props.accessibilityLabel, caption: textOf(caption) };
  };
  // 24UX6E: the state line carries the day while the debt is due, so there is no Vencimiento row (nor Tipo, nor Estado).
  assert.deepEqual(detailOf(dueToday), { status: 'Vence hoy', rows: '' });
  assert.deepEqual(detailOf(overdue), { status: 'Vencida · Ayer', rows: '' });
  assert.deepEqual(rowOf(dueToday), { label: 'Debo a Juan, 300,00 ARS, Vence hoy', caption: 'Debo · Vence hoy' });
  assert.equal(rowOf(overdue).caption, 'Debo · Vencida · Ayer');
  assert.equal(rowOf(debt).caption, 'Debo · Vence 1 oct', 'a future date is never relative');
  // Closing day 18, today the 20th: the statement opened yesterday.
  const closedYesterday: domain.CreditCardProfile = { ...card, closingDay: 18 };
  const caption = (file: string) => nodes(harness(file, { id: 'card' }, { ...archive, cards: [closedYesterday, usdCard] }).render())
    .find(node => node.type === 'SectionTitle' && node.props.caption)!.props.caption;
  assert.match(caption('cards.tsx'), /^Este ciclo, desde ayer · /);
  assert.match(caption('card/[id].tsx'), /^Este ciclo, desde ayer · /);
  activeLocale = 'en-US';
  try {
    assert.deepEqual(detailOf(dueToday), { status: 'Due today', rows: '' });
    assert.deepEqual(rowOf(dueToday), { label: 'I owe Juan, 300.00 ARS, Due today', caption: 'I owe · Due today' });
    assert.equal(detailOf(debt).status, 'Due Oct 1', 'an English short date keeps its capital month');
    assert.match(caption('cards.tsx'), /^This cycle, since yesterday · /);
  } finally { activeLocale = 'es-AR'; }
  const inline = (locale: AppLocale) => (iso: string) => i18nFormat.relativeDate(iso, '2026-09-20', locale, true);
  const statement = { startISO: '2026-09-19', purchaseCount: 2, paymentCount: 1 };
  assert.equal(liabilityPresentation.statementCaption(statement, inline('es-AR')), 'Este ciclo, desde ayer · 2 compras · 1 pago');
  assert.equal(liabilityPresentation.statementCaption(statement, inline('en-AR'), bindLocale('en-AR').t), 'This cycle, since yesterday · 2 purchases · 1 payment');
});

test('23.1C2: the card usage caption is shown in the region\'s format and spoken in the language\'s numbers', () => {
  // 13.100 of 5.000.000 cents used: 3 % of the limit.
  // 24T2: the dates above it carry their spoken form too; the usage caption is the one under the bar (caption size).
  const usage = () => nodes(harness('cards.tsx').render()).find(node => node.type === 'AppText' && node.props.variant === 'caption' && typeof node.props.accessibilityLabel === 'string')!;
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
  // A release (24M): the 146 gated currencies, ARS and USD first, and the switch precedes the amount field in both forms.
  for (const file of ['src/ui/card-form.tsx', 'src/ui/debt-form.tsx']) {
    const view = forms(file);
    const root = view.render();
    assert.deepEqual(find(root, 'CurrencySwitch').props.currencies, offeredCurrencies(domain.LEDGER_CURRENCIES, 'es-AR'), file);
    assert.deepEqual(order(root, ['CurrencySwitch', 'AmountField']).slice(0, 2), ['CurrencySwitch', 'AmountField'], file + ': the currency before the amount');
  }
  const card = forms('src/ui/card-form.tsx', PREVIEW_CURRENCIES);
  assert.deepEqual(find(card.render(), 'CurrencySwitch').props.currencies, offeredCurrencies(PREVIEW_CURRENCIES, 'es-AR'));
  find(card.render(), 'CurrencySwitch').props.onChange('JPY');
  assert.equal(find(card.render(), 'AmountField').props.currency, 'JPY', 'the field knows the currency before a digit is typed');
  find(card.render(), 'Field', 'Nombre de la tarjeta').props.onChangeText('Rakuten');
  find(card.render(), 'AmountField', 'Saldo pendiente hoy (opcional)').props.onChangeText('1500');
  // 24T2: the statement dates on a calendar (the harness day is 2026-09-20): the next closing and the due of that closing.
  find(card.render(), 'DateField', 'Próximo cierre').props.onChange(new Date(2026, 8, 28, 12));
  find(card.render(), 'DateField', 'Vencimiento').props.onChange(new Date(2026, 9, 5, 12));
  await find(card.render(), 'ActionButton', 'Crear tarjeta').props.onPress();
  assert.equal(card.cards.length, 1);
  assert.deepEqual([card.cards[0].account.currency, card.cards[0].account.openingMinor], ['JPY', -1500], '1500 yen owed, never 15.00');
  assert.deepEqual([card.cards[0].card.closingDay, card.cards[0].card.dueDay], [28, 5], '24T2: the usual days are the days of the dates entered');
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
  // Closed: 24UX6E: a note under the hero says so (it was an Estado row reading Cerrada), no payment can be recorded, the action reopens.
  const closed = harness('debt/[id].tsx', { id: 'debt' }, { ...archive, debts: [view.savedDebts[0]] }).render();
  assert.equal(find(closed, 'LifecycleNote').props.title, 'Deuda cerrada');
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
  assert.equal(JSON.stringify(view.removedDebts), JSON.stringify(['debt']), 'through its own storage path (25B2 close)');
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
  // 25B2 close: no collection yet, so a tracker created by mistake: deleting says the balance is not collected.
  assert.equal(other.alerts[0].message.replace(/\u00a0/g, ' '), 'Deja de seguirse sin registrar ningún cobro: los $ 40,00 no se cobran. No tiene cobros registrados.');
});

test('25B2 close: from the detail, a debt with a balance and a recorded payment is not deleted; the dialog offers Saldar or Cerrar and writes nothing on its own', async () => {
  const partial = domain.initialTransferRecord({ ...settledPayment, id: 'partial-juan', amountMinor: 10000 });
  const view = harness('debt/[id].tsx', { id: 'debt' }, { ...archive, transfers: [...archive.transfers!, partial] });
  find(view.render(), 'ActionButton', 'Eliminar deuda').props.onPress();
  const alert = view.alerts[0];
  assert.equal(alert.title, 'Todavía no se puede eliminar');
  assert.match(alert.message.replace(/\u00a0/g, ' '), /^Todavía le debés \$ 200,00 a Juan y ya hay pagos registrados\./);
  assert.equal(alert.buttons.map((button: { text: string; style?: string }) => button.text + ':' + (button.style ?? '')).join(','), 'Cancelar:cancel,Saldar:,Cerrar:');
  assert.equal(view.savedDebts.length + view.removedDebts.length + view.pushed.length + view.backs(), 0, 'opening the dialog writes nothing');
  await alert.buttons[2].onPress();
  await settle();
  assert.equal(JSON.stringify([view.savedDebts.length, view.savedDebts[0].active, view.savedDebts[0].deleted, view.removedDebts.length]), JSON.stringify([1, false, false, 0]), 'Cerrar closes, keeping the balance');
  assert.equal(view.backs(), 0, 'closing keeps the detail on screen, as its own Cerrar button does');
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

test('24UX4 review: a debt detail opened before the ledger hydrates shows the debt once it loads, and after its own deletion stays drawn without actions until it closes; a link to a deleted debt is not found', async () => {
  const view = harness('debt/[id].tsx', { id: 'debt' }, null);
  assert.equal(find(view.render(), 'EmptyState').props.title, 'No encontramos esta deuda', 'nothing to show before the ledger loads');
  view.setData(archive);
  const live = view.render();
  assert.equal(nodes(live).some(node => node.type === 'EmptyState'), false, 'the debt appears when the ledger arrives');
  assert.equal(find(live, 'Money').props.minor, 30000);
  find(live, 'ActionButton', 'Eliminar deuda').props.onPress();
  await view.alerts[0].buttons[1].onPress();
  await settle();
  assert.equal(view.backs(), 1);
  // The store now holds the deletion record while the screen pops: no «not found» flash, and nothing to edit or restore.
  view.setData({ ...archive, debts: [view.savedDebts[0]] });
  const closing = view.render();
  assert.equal(nodes(closing).some(node => node.type === 'EmptyState'), false);
  assert.equal(find(closing, 'Money').props.minor, 30000);
  assert.equal(nodes(closing).filter(node => node.type === 'ActionButton').map(node => node.props.label).join(','), 'Registrar pago');
  assert.equal(find(closing, 'ActionButton', 'Registrar pago').props.disabled, true);
  assert.equal(nodes(closing).find(node => node.type === 'Stack.Screen')!.props.options.headerRight(), null, 'no edit button');
  // A cold link straight to the deleted tracker, before and after hydration, is not found.
  const cold = harness('debt/[id].tsx', { id: 'debt' }, null);
  cold.render();
  cold.setData({ ...archive, debts: [view.savedDebts[0]] });
  assert.equal(find(cold.render(), 'EmptyState').props.title, 'No encontramos esta deuda');
});

// ---- Producto 24UX6E: Deudas in the Forest design -------------------------------------------------
const receivableAccount6E: domain.Account = { id: 'rec-acc', name: 'Me deben · Ana', currency: 'ARS', openingMinor: 4000, createdAt };
const receivable6E: domain.PersonalDebtProfile = { ...debt, id: 'receivable', accountId: receivableAccount6E.id, direction: 'owed_to_me', counterparty: 'Ana', dueDateISO: '2026-09-22' };
const rowParts = (profile: domain.PersonalDebtProfile, data: domain.LedgerArchive = { ...archive, debts: [profile] }) => {
  const row = harness('src/ui/liability-rows.tsx', {}, data).exports.DebtRow({ debt: profile, last: false });
  const caption = nodes(row).find(node => node.type === 'AppText' && node.props.variant === 'footnote')!;
  const segment = nodes(caption.props.children).find(node => node.type === 'AppText')!;
  return { row, press: find(row, 'PressFeedback'), caption, segment, tile: find(row, 'GlyphTile') };
};
const detailParts = (profile: domain.PersonalDebtProfile, data: domain.LedgerArchive = { ...archive, debts: [profile] }) => {
  const root = harness('debt/[id].tsx', { id: profile.id }, data).render();
  return { root, stateLine: nodes(root).find(node => node.type === 'AppText' && node.props.variant === 'subhead'),
    rows: nodes(root).filter(node => node.type === 'DetailRow'), grouped: nodes(root).filter(node => node.type === 'Surface' && node.props.grouped),
    note: nodes(root).find(node => node.type === 'LifecycleNote') };
};

test('24UX6E: one due-state rule for a debt\'s row and detail: closed first, then settled, undated, overdue, soon (≤ 3 days, a debt I owe) and due', () => {
  const state = (profile: Partial<domain.PersonalDebtProfile>, outstanding = 30000) => liabilityPresentation.debtDueState({ ...debt, ...profile }, outstanding, '2026-09-20');
  assert.equal(state({ active: false, dueDateISO: '2026-09-19' }), 'closed', 'a closed debt is never overdue, whatever its date');
  assert.equal(state({ active: false }, 0), 'closed');
  assert.equal(state({ dueDateISO: '2026-09-19' }, 0), 'settled');
  assert.equal(state({ dueDateISO: null }), 'none');
  assert.equal(state({ dueDateISO: '2026-09-19' }), 'overdue');
  assert.equal(state({ dueDateISO: '2026-09-19', direction: 'owed_to_me' }), 'overdue', 'overdue in both directions');
  assert.equal(state({ dueDateISO: '2026-09-20' }), 'soon');
  assert.equal(state({ dueDateISO: '2026-09-23' }), 'soon', 'three days away: the card rule');
  assert.equal(state({ dueDateISO: '2026-09-24' }), 'due');
  assert.equal(state({ dueDateISO: '2026-09-22', direction: 'owed_to_me' }), 'due', 'what someone owes me is never amber');
  // The spoken day: a relative word stays; a plain day is written out.
  assert.equal(liabilityPresentation.spokenDueDay('2026-10-01', '2026-09-20', 'es-AR', true), '1 de octubre de 2026');
  assert.equal(liabilityPresentation.spokenDueDay('2026-09-20', '2026-09-20', 'es-AR', true), 'hoy');
  assert.equal(liabilityPresentation.spokenDueDay('2026-09-19', '2026-09-20', 'en-US'), 'Yesterday');
  assert.equal(liabilityPresentation.spokenDueDay('2027-01-05', '2026-09-20', 'en-US'), 'January 5, 2027');
});

test('24UX6E: colour marks the due state, not the direction: neutral tiles, ink totals, and only the state words of a row take a tone', () => {
  // A future debt and a receivable: calm everywhere.
  const owed = rowParts(debt);
  assert.equal(owed.tile.props.icon, 'arrow-up-outline');
  assert.equal(owed.tile.props.tone, undefined, 'no amber for every debt I owe');
  assert.equal(owed.caption.props.style, undefined);
  assert.equal(owed.segment.props.style, undefined);
  assert.equal(owed.segment.props.secondary, true);
  const data = { ...archive, accounts: [...archive.accounts, receivableAccount6E], debts: [receivable6E] };
  const receivable = rowParts(receivable6E, data);
  assert.equal(receivable.tile.props.icon, 'arrow-down-outline');
  assert.equal(receivable.tile.props.tone, undefined, 'no green for every receivable');
  assert.equal(receivable.segment.props.style, undefined, 'a receivable two days away is not amber');
  assert.equal(textOf(receivable.caption), 'Me deben · Vence 22 sep');
  const hero = detailParts(debt);
  assert.equal(find(hero.root, 'GlyphTile').props.tone, undefined);
  assert.equal(find(hero.root, 'GlyphTile').props.large, true);
  // Overdue: the state words in the alert colour, «Debo» stays secondary.
  const overdue = rowParts({ ...debt, dueDateISO: '2026-09-19' });
  assert.equal(overdue.caption.props.style, undefined, 'the direction word is not painted');
  assert.equal(JSON.stringify(overdue.segment.props.style), JSON.stringify({ color: '#c00', fontWeight: '500' }));
  assert.equal(textOf(overdue.caption), 'Debo · Vencida · Ayer');
  // Due within three days, a debt I owe: amber on the row and on the detail's state line.
  const soonDebt = { ...debt, dueDateISO: '2026-09-22' };
  const soon = rowParts(soonDebt);
  assert.equal(JSON.stringify(soon.segment.props.style), JSON.stringify({ color: '#a60', fontWeight: '500' }));
  const soonDetail = detailParts(soonDebt);
  assert.equal(soonDetail.stateLine!.props.children, 'Vence 22 sep');
  assert.equal(JSON.stringify(soonDetail.stateLine!.props.style), JSON.stringify({ color: '#a60', fontWeight: '600' }));
  assert.equal(JSON.stringify(detailParts({ ...debt, dueDateISO: '2026-09-19' }).stateLine!.props.style), JSON.stringify({ color: '#c00', fontWeight: '600' }));
  assert.equal(JSON.stringify(hero.stateLine!.props.style), JSON.stringify({ color: '#666', fontWeight: '400' }), 'a debt due later reads calm');
  // The totals: ink, flat on the canvas (no padded card per currency).
  const list = harness('debts.tsx', {}, { ...archive, accounts: [...archive.accounts, receivableAccount6E], debts: [debt, receivable6E] }).render();
  const totals = nodes(list).filter(node => node.type === 'Money');
  assert.deepEqual(totals.map(node => [node.props.minor, node.props.color, node.props.tone]), [[30000, undefined, undefined], [4000, undefined, undefined]]);
  assert.equal(nodes(list).filter(node => node.type === 'Surface' && !node.props.grouped).length, 0, 'only the grouped lists are containers');
  assert.equal(nodes(list).filter(node => node.type === 'StatRow').length, 1);
});

test('24UX6E: a sum beyond the safe range is said for its currency as a plain line, without a card', () => {
  const big = Number.MAX_SAFE_INTEGER - 1;
  const a1: domain.Account = { id: 'big-1', name: 'Debo · A', currency: 'ARS', openingMinor: -big, createdAt };
  const a2: domain.Account = { id: 'big-2', name: 'Debo · B', currency: 'ARS', openingMinor: -big, createdAt };
  const debts = [{ ...debt, id: 'd1', accountId: a1.id, counterparty: 'A' }, { ...debt, id: 'd2', accountId: a2.id, counterparty: 'B' }];
  const list = harness('debts.tsx', {}, { accounts: [cash, a1, a2], records: [], debts }).render();
  const line = nodes(list).find(node => node.type === 'AppText' && node.props.children === 'Total fuera de rango · ARS')!;
  assert.ok(line, 'the out-of-range line is shown');
  assert.equal(line.props.secondary, true);
  assert.equal(nodes(list).filter(node => node.type === 'Surface' && !node.props.grouped).length, 0);
  assert.equal(nodes(list).some(node => node.type === 'StatRow'), false);
});

test('24UX6E: a closed debt is never drawn as overdue; a calm note under its hero says it is closed, and the Vencimiento fact returns', () => {
  const closed = { ...debt, active: false, dueDateISO: '2026-09-19', revision: 1 };
  const detail = detailParts(closed);
  assert.equal(detail.stateLine, undefined, 'no state line: the note says it');
  assert.equal(nodes(detail.root).some(node => node.type === 'AppText' && typeof node.props.children === 'string' && node.props.children.startsWith('Vencida')), false);
  assert.equal(nodes(detail.root).some(node => node.props.style?.color === '#c00'), false, 'no alert colour on a closed debt');
  assert.equal(JSON.stringify(detail.note!.props), JSON.stringify({ icon: 'archive-outline', title: 'Deuda cerrada',
    detail: 'No cuenta como pendiente. Conserva su saldo y sus pagos; «Reabrir deuda» la vuelve a pendientes.' }));
  assert.equal(find(detail.root, 'ActionButton', 'Registrar pago').props.disabled, true);
  find(detail.root, 'ActionButton', 'Reabrir deuda');
  assert.deepEqual(detail.rows.map(row => [row.props.label, row.props.value, row.props.spokenValue].join('=')), ['Vencimiento=Ayer=Ayer']);
  assert.equal(textOf(rowParts(closed).caption), 'Debo · Cerrada');
  assert.equal(rowParts(closed).segment.props.style, undefined);
  // A receivable's note names collections; English reads the same.
  const data = { ...archive, accounts: [...archive.accounts, receivableAccount6E], debts: [{ ...receivable6E, active: false }] };
  assert.equal(detailParts({ ...receivable6E, active: false }, data).note!.props.detail,
    'No cuenta como pendiente. Conserva su saldo y sus cobros; «Reabrir deuda» la vuelve a pendientes.');
  activeLocale = 'en-AR';
  try {
    const english = detailParts(closed);
    assert.equal(english.note!.props.title, 'Debt closed');
    assert.equal(english.note!.props.detail, 'Not counted as pending. It keeps its balance and payments; Reopen debt brings it back to pending.');
  } finally { activeLocale = 'es-AR'; }
  // An active debt shows no note; neither does one deleted while its screen pops.
  assert.equal(detailParts(debt).note, undefined);
  const view = harness('debt/[id].tsx', { id: 'debt' });
  view.render();
  view.setData({ ...archive, debts: [{ ...debt, active: false, deleted: true, revision: 1 }] });
  assert.equal(nodes(view.render()).some(node => node.type === 'LifecycleNote'), false);
});

test('24UX6E: the detail keeps only the facts the hero does not say: a settled debt\'s date (spoken written out) and the note', () => {
  const settled = detailParts(debt, settledData);
  assert.equal(settled.stateLine!.props.children, 'Saldada');
  assert.deepEqual(settled.rows.map(row => [row.props.label, row.props.value, row.props.spokenValue].join('=')), ['Vencimiento=1 oct=1 de octubre de 2026']);
  assert.equal(settled.rows[0].props.last, true);
  // Undated, no note: no grouped facts at all; with a note, only the note.
  const undated = { ...debt, dueDateISO: null };
  const bare = detailParts(undated);
  assert.equal(bare.stateLine!.props.children, 'Sin vencimiento');
  assert.equal(bare.grouped.length, 0, 'no empty table');
  const noted = detailParts({ ...undated, note: 'Préstamo del auto' });
  assert.deepEqual(noted.rows.map(row => [row.props.label, row.props.value].join('=')), ['Nota=Préstamo del auto']);
  assert.equal(noted.grouped.length, 1);
  // The state line's spoken twin writes the day out; a relative word stays as it is.
  assert.equal(detailParts(debt).stateLine!.props.accessibilityLabel, 'Vence 1 de octubre de 2026');
  assert.equal(detailParts({ ...debt, dueDateISO: '2026-09-20' }).stateLine!.props.accessibilityLabel, 'Vence hoy');
});

test('24UX6E: a debt row reads its day written out, hints that it opens the detail and draws a hairline separator', () => {
  const { press } = rowParts(debt);
  assert.equal(press.props.accessibilityLabel, 'Debo a Juan, 300,00 ARS, Vence 1 de octubre de 2026');
  assert.equal(press.props.accessibilityHint, 'Abre el detalle de la deuda');
  assert.equal(press.props.style.borderBottomWidth, 0.33, 'StyleSheet.hairlineWidth, never 0.5');
  const last = harness('src/ui/liability-rows.tsx').exports.DebtRow({ debt, last: true });
  assert.equal(find(last, 'PressFeedback').props.style.borderBottomWidth, 0);
  assert.equal(rowParts({ ...debt, dueDateISO: '2026-09-19' }).press.props.accessibilityLabel, 'Debo a Juan, 300,00 ARS, Vencida · Ayer');
  activeLocale = 'en-US';
  try {
    const english = rowParts(debt).press;
    assert.equal(english.props.accessibilityLabel, 'I owe Juan, 300.00 ARS, Due October 1, 2026');
    assert.equal(english.props.accessibilityHint, 'Opens the debt details');
  } finally { activeLocale = 'es-AR'; }
});

test('24UX6E: the edit form summarises what cannot change (the kind and the currency), never the name being edited', () => {
  const view = harness('src/ui/debt-form.tsx');
  const root = view.renderExport('DebtForm', { original: debt });
  assert.equal(nodes(root).filter(node => node.type === 'DetailRow').map(node => [node.props.label, node.props.value].join('=')).join(','), 'Tipo=Yo debo,Moneda=ARS');
  find(root, 'Field', 'Persona o entidad').props.onChangeText('Juan Pérez');
  assert.equal(nodes(view.renderExport('DebtForm', { original: debt })).some(node => node.type === 'DetailRow' && node.props.value === 'Juan'), false);
  activeLocale = 'en-AR';
  try {
    const data = { ...archive, accounts: [...archive.accounts, receivableAccount6E], debts: [receivable6E] };
    const english = harness('src/ui/debt-form.tsx', {}, data).renderExport('DebtForm', { original: receivable6E });
    assert.equal(nodes(english).filter(node => node.type === 'DetailRow').map(node => [node.props.label, node.props.value].join('=')).join(','), 'Type=Owed to me,Currency=ARS');
  } finally { activeLocale = 'es-AR'; }
});
