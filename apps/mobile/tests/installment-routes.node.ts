import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as domain from '@finanzapp/domain';
import * as presentation from '../src/ui/presentation.ts';
import * as liabilityPresentation from '../src/ui/liability-presentation.ts';
import * as geometry from '../src/ui/geometry.ts';
import * as installmentPresentation from '../src/ui/installment-presentation.ts';
import * as budgetPresentation from '../src/ui/budget-presentation.ts';
import * as cardFaces from '../src/ui/card-faces.ts';
import * as i18nFormat from '../src/i18n/format.ts';
import { bindLocale } from '../src/i18n/bind.ts';
import type { AppLocale } from '../src/i18n/locale.ts';
import { realModule } from './real-module.ts';
import * as movementAmount from '../src/ui/movement-amount.ts';
import * as operationPresentation from '../src/ui/operation-presentation.ts';

// Producto 24T2: the card surfaces with instalment plans (Tarjetas, a card's detail, a plan's detail and the movement an
// instalment recorded), their real handlers against descriptor hosts. The snapshot pieces (card-panel) and the rows
// (card-rows) run for real, so what VoiceOver hears is read as rendered. No UIKit, deck animation or gesture here
// (cards-deck.node.ts covers the deck itself).

type Node = { type: any; props: Record<string, any>; rendered?: Node | null };
const NBSP = ' ';
const createdAt = '2026-08-01T12:00:00.000Z';
const cash: domain.Account = { id: 'cash', name: 'Banco', currency: 'ARS', openingMinor: 500000000, createdAt };
const cardAccount: domain.Account = { id: 'card-acc', name: 'Visa Gold', currency: 'ARS', openingMinor: 0, createdAt };
const amexAccount: domain.Account = { id: 'amex-acc', name: 'Amex', currency: 'USD', openingMinor: 0, createdAt };
// Closing day 28, due day 5; a limit of $ 3.000.000,00.
const card: domain.CreditCardProfile = { id: 'card', accountId: cardAccount.id, issuer: 'Galicia', last4: '4009', creditLimitMinor: 300000000,
  closingDay: 28, dueDay: 5, active: true, deleted: false, createdAt, revision: 0, updatedAt: createdAt };
const amex: domain.CreditCardProfile = { ...card, id: 'amex', accountId: amexAccount.id, issuer: 'Amex', last4: '1001', creditLimitMinor: null };
// $ 1.200.000,00 in 12 cuotas from the August statement (closes Aug 28): two recognised by Oct 1, ten to come.
const tv = domain.newInstallmentPlan({ id: 'tv', card, cardAccount, merchant: 'Electro', category: 'Hogar', purchaseDateISO: '2026-08-10', principalMinor: 120000000,
  count: 12, placement: 'current', createdAt: '2026-08-10T15:00:00.000Z' });
const recognised = (plan: domain.InstallmentPlan, numbers: number[], accountId = cardAccount.id) =>
  numbers.flatMap(number => domain.installmentEntries(plan, accountId, plan.schedule[number - 1])).map(entry => domain.initialRecord(entry));
// Paid by transfer on Sep 4 (the August statement): a payment is never assigned to an instalment.
const payment: domain.Transfer = { id: 'pay-aug', fromAccountId: cash.id, toAccountId: cardAccount.id, amountMinor: 10000000, note: '', dateISO: '2026-09-04', createdAt };
const archive: domain.LedgerArchive = { accounts: [cash, cardAccount, amexAccount], records: recognised(tv, [1, 2]), transfers: [domain.initialTransferRecord(payment)],
  cards: [card, amex], installmentPlans: [tv] };

function harness(file: string, options: { params?: Record<string, string>; data?: domain.LedgerArchive | null; day?: string; locale?: AppLocale;
  remove?: (id: string) => Promise<void>; stacked?: boolean;
  /** 24T3: the plan's writes (an adelanto, a stop, a reactivation), recorded in `writes`; a throw is a failed write. */
  write?: (action: 'payoff' | 'stop' | 'reactivate', arg: unknown) => Promise<void> } = {}) {
  const source = readFileSync(new URL('../app/' + file, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  let data = (options.data === undefined ? archive : options.data) as domain.LedgerArchive;
  let locale: AppLocale = options.locale ?? 'es-AR';
  const day = options.day ?? '2026-10-01';
  const i18nProvider = { useI18n: () => bindLocale(locale) };
  const state: unknown[] = [], refs: { current: unknown }[] = [];
  let cursor = 0, refCursor = 0, backs = 0, haptics = 0, uuid = 0;
  const pushed: unknown[] = [], alerts: { title: string; message: string; buttons: any[] }[] = [], updates: domain.EntryChange[] = [], removals: string[] = [];
  const writes: { action: 'payoff' | 'stop' | 'reactivate'; arg: unknown }[] = [];
  const write = async (action: 'payoff' | 'stop' | 'reactivate', arg: unknown) => { writes.push({ action, arg }); await options.write?.(action, arg); };
  const jsx = (type: unknown, props: Record<string, unknown>) => ({ type, props });
  const ledger = { useLedger: () => ({ archive: data, snapshot: data ? domain.snapshotFromArchive(data) : null,
    updateEntry: async (change: domain.EntryChange) => { updates.push(change); },
    removeInstallmentPlan: async (id: string) => { removals.push(id); await options.remove?.(id); },
    addPayoff: (payoff: domain.PlanPayoff) => write('payoff', payoff),
    cancelInstallmentPlan: (planId: string, expectedRevision: number) => write('stop', { planId, expectedRevision }),
    reactivateInstallmentPlan: (planId: string, expectedRevision: number) => write('reactivate', { planId, expectedRevision }) }) };
  const componentNames = ['AccountBadge', 'ActionButton', 'AppText', 'CheckRow', 'DetailRow', 'EmptyState', 'ErrorMessage', 'GlyphTile', 'IconButton', 'LifecycleNote',
    'MerchantBadge', 'Money', 'MovementRow', 'PressFeedback', 'Screen', 'SectionTitle', 'Stat', 'StatRow', 'Surface'];
  // `stacked`: the largest text sizes or an amount too wide for its row (the real rule is in components.tsx).
  const components = { ...Object.fromEntries(componentNames.map(name => [name, name])), toneColors: () => ({ color: '#c00', soft: '#fee' }), useStacked: () => options.stacked ?? false };
  const palette = { isDark: false, text: '#000', secondary: '#666', tertiary: '#999', line: '#ddd', inset: '#eee', expense: '#c00', income: '#080', warning: '#a60', warningSoft: '#fec',
    transfer: '#03c', primary: '#2557D6' };
  const theme = { space: { xs: 4, s: 8, m: 12, l: 16, xl: 20, xxl: 24, xxxl: 32 }, radius: { tile: 12, group: 16, creditCard: 18 },
    useCurrentDay: () => day, useReduceMotion: () => true, usePalette: () => palette };
  const motion = { ValueTransition: 'ValueTransition', Reflow: 'Reflow', timing: (kind: string, reduced: boolean) => ({ duration: reduced ? 0 : 260 }), successHaptic: () => { haptics++; }, selectionHaptic: () => {} };
  const hues = { useCategoryLabel: (stored: string) => stored };
  const cardVisual = { CardDeck: 'CardDeck', CardFace: 'CardFace', cardFaceWidth: (width: number) => Math.min(width - 40, 420), cardFaceHeight: (width: number) => Math.round(width / 1.586) };
  const both = (path: string, value: unknown) => ({ ['../src/' + path]: value, ['../../src/' + path]: value });
  const modules: Record<string, unknown> = {
    react: {
      useState: (initial: unknown) => {
        const index = cursor++;
        if (!(index in state)) state[index] = typeof initial === 'function' ? (initial as () => unknown)() : initial;
        return [state[index], (value: unknown) => { state[index] = typeof value === 'function' ? (value as (current: unknown) => unknown)(state[index]) : value; }];
      },
      useRef: (initial: unknown) => { const index = refCursor++; return refs[index] ??= { current: initial }; },
      useEffect: (fn: () => void) => { fn(); }, useMemo: (fn: () => unknown) => fn(),
    },
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'react-native': { View: 'View', StyleSheet: { create: (styles: unknown) => styles, hairlineWidth: 0.5 }, useWindowDimensions: () => ({ width: 393, fontScale: 1 }),
      Alert: { alert: (title: string, message: string, buttons: any[]) => alerts.push({ title, message, buttons }) } },
    'react-native-reanimated': { __esModule: true, default: { View: 'Animated.View' }, useSharedValue: (value: number) => ({ value }), withTiming: (value: number) => value,
      useAnimatedStyle: (fn: () => unknown) => fn() },
    '@expo/vector-icons/Ionicons': 'Ionicons',
    'expo-router': { Stack: { Screen: 'Stack.Screen' }, useLocalSearchParams: () => options.params ?? {},
      router: { push: (to: unknown) => pushed.push(to), navigate: (to: unknown) => pushed.push(to), replace: (to: unknown) => pushed.push(to), back: () => { backs++; }, canGoBack: () => true } },
    'expo-crypto': { randomUUID: () => 'op-' + (++uuid) },
    'expo-haptics': { NotificationFeedbackType: { Success: 'Success' }, notificationAsync: async () => {}, selectionAsync: async () => {} },
    '@finanzapp/domain': domain,
    ...both('storage/LedgerProvider', ledger), ...both('ui/components', components), ...both('ui/card-visual', cardVisual), ...both('ui/entry-list', { EntryList: 'EntryList' }),
    ...both('ui/geometry', geometry), ...both('ui/movement-amount', movementAmount),
    ...both('ui/liability-presentation', liabilityPresentation), ...both('ui/installment-presentation', installmentPresentation), ...both('ui/presentation', presentation),
    ...both('ui/budget-presentation', budgetPresentation), ...both('ui/motion', motion), ...both('ui/theme', theme), ...both('ui/category-hues', hues),
    ...both('i18n/format', i18nFormat), ...both('i18n/provider', i18nProvider),
    // 24T3: the adelanto sheet's date row (a descriptor; its bounds are props).
    ...both('ui/form-controls', { DateField: 'DateField' }),
    // 24T3: the operations lane's pure reader (instalment number runs, the movement detail's refund check), run for real.
    ...both('ui/operation-presentation', operationPresentation),
    // What the real card-panel.tsx and card-rows.tsx import from src/ui.
    './components': components, './theme': theme, './card-faces': cardFaces, './liability-presentation': liabilityPresentation, './motion': motion,
    // 24UX6D: the plan detail's progress reads the pure `planProgress` (card-rows.tsx).
    './installment-presentation': installmentPresentation,
    '../i18n/format': i18nFormat, '../i18n/provider': i18nProvider,
  };
  const require = function require(name: string) {
    if (!Object.hasOwn(modules, name)) throw new Error('Unexpected card surface dependency: ' + name);
    return modules[name];
  };
  Object.assign(modules, both('ui/card-panel', realModule('src/ui/card-panel.tsx', require)), both('ui/card-rows', realModule('src/ui/card-rows.tsx', require)));
  const module = { exports: {} as { default: () => Node } };
  runInNewContext(code, { module, exports: module.exports, require, Error, Date });
  return {
    render: () => { cursor = 0; refCursor = 0; return module.exports.default(); },
    setData: (next: domain.LedgerArchive | null) => { data = next as domain.LedgerArchive; },
    setLocale: (next: AppLocale) => { locale = next; },
    pushed, alerts, updates, removals, writes, backs: () => backs, haptics: () => haptics,
  };
}

/** Every node, with local and real function components expanded once per element (their hooks run once per render). */
function nodes(value: any): Node[] {
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!value.props) return [];
  if (typeof value.type === 'function' && !('rendered' in value)) value.rendered = value.type(value.props);
  return [value, ...nodes(value.rendered), ...nodes(value.props.children), ...nodes(value.props.header), ...nodes(value.props.empty), ...nodes(value.props.footer), ...nodes(value.props.action)];
}
function find(root: Node, type: string, label?: string): Node {
  const found = nodes(root).find(node => node.type === type && (!label || node.props.label === label || node.props.accessibilityLabel === label));
  assert.ok(found, 'Missing ' + type + ' ' + (label ?? ''));
  return found;
}
const byName = (root: Node, name: string) => nodes(root).filter(node => typeof node.type === 'function' && node.type.name === name);
const text = (node: Node) => [node.props.children].flat().filter(part => typeof part === 'string' || typeof part === 'number').join('');
const texts = (root: Node) => nodes(root).filter(node => node.type === 'AppText').map(text);
const statsOf = (root: Node) => nodes(root).filter(node => node.type === 'Stat').map(node => [node.props.label, nodes(node.props.children).filter(item => item.type === 'AppText')
  .map(item => text(item).trim() + (item.props.accessibilityLabel ? ' (' + item.props.accessibilityLabel + ')' : '')).join(' | ')].join(': '));
const settle = () => new Promise<void>(resolve => setImmediate(resolve));
const rowsOf = (root: Node) => nodes(root).filter(node => node.type === 'DetailRow').map(node => node.props.label + '=' + node.props.value + (node.props.spokenValue ? ' (' + node.props.spokenValue + ')' : ''));

// ---- Tarjetas ---------------------------------------------------------------------------------------------------------

test('Tarjetas with a pending plan: the balance, «Vence» of the statement that closed and «Cierra» of the open one, availability not calculated, and the future instalments beside the balance', () => {
  const view = harness('cards.tsx');
  const root = view.render();
  const deck = find(root, 'CardDeck');
  assert.equal(deck.props.cards.map((item: { id: string }) => item.id).join(','), 'card,amex');
  // Two instalments recognised (2 × $ 100.000,00) minus the August payment ($ 100.000,00).
  assert.equal(find(root, 'Money').props.minor, 10000000);
  assert.ok(texts(root).includes('Saldo pendiente' + NBSP + '·' + NBSP + 'ARS'));
  // On Oct 1 the statement that closed on Sep 28 is still due on Oct 5; the open one closes on Oct 28: two facts, never merged.
  assert.deepEqual(statsOf(root), ['Vence: 5 oct (5 de octubre de 2026)', 'Cierra: 28 oct (28 de octubre de 2026)', 'Disponible: No calculado con cuotas']);
  // No figure, no zero, no bar: the issuer's reservation for instalments is not assumed; the reason is one tap away.
  const unknown = find(root, 'PressFeedback', 'No calculado con cuotas');
  assert.equal(unknown.props.accessibilityHint, 'Más información sobre disponible con cuotas');
  unknown.props.onPress();
  assert.equal(view.alerts[0].title, 'Disponible con cuotas');
  assert.match(view.alerts[0].message, /^Cada emisor reserva el límite de las compras en cuotas a su manera/);
  assert.equal(byName(root, 'UsageBar').length, 0);
  assert.equal(nodes(root).some(node => node.type === 'Money' && node.props.minor === 300000000 - 10000000), false, 'never limit minus balance while a plan is pending');
  // Cuotas futuras: the principal still to come, in how many plans; it opens the card's detail.
  const future = byName(root, 'FutureInstallmentsRow')[0];
  assert.equal(future.props.committedMinor, 100000000);
  const futureRow = future.rendered!;
  assert.equal(futureRow.props.accessibilityLabel, 'Cuotas futuras, 1000000,00 pesos, en 1 plan');
  assert.equal(futureRow.props.accessibilityHint, 'Abre el detalle de la tarjeta');
  futureRow.props.onPress();
  assert.equal(JSON.stringify(view.pushed.at(-1)), JSON.stringify({ pathname: '/card/[id]', params: { id: 'card' } }));
  // The open cycle began on Sep 29 («anteayer»): nothing recorded in it yet (the Sep 28 instalment belongs to the statement that closed).
  assert.equal(nodes(root).find(node => node.type === 'SectionTitle' && node.props.action === 'Ver todos')!.props.caption, 'Este ciclo, desde anteayer · 0 compras · 0 pagos');
  find(root, 'ActionButton', 'Pagar tarjeta').props.onPress();
  assert.equal(JSON.stringify(view.pushed.at(-1)), JSON.stringify({ pathname: '/new-transfer', params: { toAccountId: 'card-acc', maxAmountMinor: '10000000' } }));
  // The card in front opens its detail; a colour chosen for its account in Editar cuenta reaches its face.
  deck.props.onOpen('card');
  assert.equal(JSON.stringify(view.pushed.at(-1)), JSON.stringify({ pathname: '/card/[id]', params: { id: 'card' } }));
  const appearances: domain.AccountAppearance[] = [{ accountId: cardAccount.id, icon: 'card', color: 'cobalt', createdAt, revision: 0, updatedAt: createdAt }];
  const colored = find(harness('cards.tsx', { data: { ...archive, appearances } }).render(), 'CardDeck');
  assert.equal(colored.props.cards.map((item: { color: string | null }) => String(item.color)).join(','), 'cobalt,null');
});

test('Tarjetas: selecting a card without limit or balance changes the whole snapshot; Vence turns amber three days ahead only with a balance', () => {
  const view = harness('cards.tsx');
  find(view.render(), 'CardDeck').props.onSelect('amex');
  const root = view.render();
  assert.equal(find(root, 'CardDeck').props.selectedId, 'amex');
  assert.equal(find(root, 'Money').props.minor, 0);
  assert.ok(texts(root).includes('Sin saldo pendiente en esta tarjeta.'));
  assert.equal(statsOf(root)[2], 'Disponible: Sin límite cargado');
  assert.equal(find(root, 'ActionButton', 'Pagar tarjeta').props.disabled, true);
  assert.equal(byName(root, 'FutureInstallmentsRow').length, 0, 'no plan, no future instalments row');
  // Oct 2: the due date is three days away and something is owed.
  const soon = harness('cards.tsx', { day: '2026-10-02' }).render();
  const due = nodes(find(soon, 'Stat', 'Vence').props.children).find(node => node.type === 'AppText')!;
  assert.equal(due.props.style.color, '#a60');
  const calm = nodes(find(harness('cards.tsx').render(), 'Stat', 'Vence').props.children).find(node => node.type === 'AppText')!;
  assert.equal(calm.props.style.color, '#000', 'four days ahead it stays ink');
  const amexOnly = { ...archive, cards: [amex] };
  const idle = nodes(find(harness('cards.tsx', { data: amexOnly, day: '2026-10-02' }).render(), 'Stat', 'Vence').props.children).find(node => node.type === 'AppText')!;
  assert.equal(idle.props.style.color, '#000', 'nothing owed: no warning');
});

test('Tarjetas: over the limit the available figure is negative in the expense tone with the bar; a balance in the person\'s favour reads in the income tone', () => {
  const overAccount: domain.Account = { ...cardAccount, openingMinor: -6000000 };
  const small: domain.CreditCardProfile = { ...card, creditLimitMinor: 5000000 };
  const over = harness('cards.tsx', { data: { accounts: [cash, overAccount], records: [], cards: [small] } }).render();
  const available = nodes(find(over, 'Stat', 'Disponible').props.children).find(node => node.type === 'Money')!;
  assert.equal(available.props.minor, -1000000);
  assert.equal(available.props.color, '#c00');
  const bar = byName(over, 'UsageBar')[0];
  assert.equal(bar.props.tone, 'expense');
  assert.equal(bar.props.label, '120 % del límite de $' + NBSP + '50.000,00');
  assert.equal(bar.props.spokenLabel, '120 % del límite de 50000,00 pesos');
  // Paid $ 50,00 more than owed: no balance, a credit line spoken with the spoken amount.
  const creditAccount: domain.Account = { ...cardAccount, openingMinor: 5000 };
  const credit = harness('cards.tsx', { data: { accounts: [cash, creditAccount], records: [], cards: [card] } }).render();
  assert.equal(find(credit, 'Money').props.minor, 0);
  const line = nodes(credit).find(node => node.type === 'AppText' && text(node).startsWith('Saldo a favor'))!;
  assert.equal(text(line), 'Saldo a favor · $' + NBSP + '50,00');
  assert.equal(line.props.accessibilityLabel, 'Saldo a favor · 50,00 pesos');
  assert.equal(line.props.style.color, '#080');
  assert.equal(texts(credit).includes('Sin saldo pendiente en esta tarjeta.'), false);
  assert.equal(find(credit, 'ActionButton', 'Pagar tarjeta').props.disabled, true);
});

test('Tarjetas: archived cards stay reachable under Archivadas with their balance; a deleted card never appears; with only archived cards the deck gives way to a short invitation', () => {
  const oldAccount: domain.Account = { id: 'old-acc', name: 'Visa Vieja', currency: 'ARS', openingMinor: -13100, createdAt };
  const goneAccount: domain.Account = { id: 'gone-acc', name: 'Master Borrada', currency: 'ARS', openingMinor: 0, createdAt };
  const old: domain.CreditCardProfile = { ...card, id: 'old', accountId: oldAccount.id, active: false };
  const gone: domain.CreditCardProfile = { ...card, id: 'gone', accountId: goneAccount.id, active: false, deleted: true };
  const appearances: domain.AccountAppearance[] = [{ accountId: oldAccount.id, icon: 'card', color: 'rose', createdAt, revision: 0, updatedAt: createdAt }];
  const data = { ...archive, accounts: [...archive.accounts, oldAccount, goneAccount], cards: [card, amex, old, gone], appearances };
  const view = harness('cards.tsx', { data });
  const root = view.render();
  assert.equal(find(root, 'CardDeck').props.cards.map((item: { id: string }) => item.id).join(','), 'card,amex', 'only active cards in the deck');
  const archived = nodes(root).find(node => node.type === 'SectionTitle' && node.props.children === 'Archivadas')!;
  assert.equal(archived.props.caption, 'Siguen recibiendo pagos y registrando sus cuotas.');
  const rows = byName(root, 'ArchivedCardRow');
  assert.equal(rows.map(row => row.props.summary.id).join(','), 'old', 'a deleted card is never listed');
  assert.equal(rows[0].props.color, 'rose');
  const row = rows[0].rendered!;
  assert.equal(row.props.accessibilityLabel, 'Visa Vieja, Saldo pendiente 131,00 pesos');
  assert.ok(texts(row).includes('Saldo pendiente $' + NBSP + '131,00'));
  assert.equal(nodes(row).find(node => node.type === 'View' && node.props.style?.[1]?.backgroundColor)!.props.style[1].backgroundColor, cardFaces.COLOR_FACES.rose.base, 'its face colour, small');
  row.props.onPress();
  assert.equal(JSON.stringify(view.pushed.at(-1)), JSON.stringify({ pathname: '/card/[id]', params: { id: 'old' } }));
  // Only archived cards: the invitation replaces the deck, the archived list stays.
  const onlyArchived = harness('cards.tsx', { data: { ...data, cards: [old, gone] } }).render();
  assert.equal(nodes(onlyArchived).some(node => node.type === 'CardDeck'), false);
  assert.equal(find(onlyArchived, 'EmptyState').props.title, 'Ninguna tarjeta activa');
  assert.equal(byName(onlyArchived, 'ArchivedCardRow').length, 1);
  // No card at all: the first invitation; an empty Archivadas never shows.
  const none = harness('cards.tsx', { data: { accounts: [cash], records: [], cards: [gone], } }).render();
  assert.equal(find(none, 'EmptyState').props.title, 'Tus tarjetas, como en la billetera');
  assert.match(find(none, 'EmptyState').props.detail, /en cuotas, cada cuota cuenta cuando cierra su resumen/);
  assert.equal(nodes(none).some(node => node.type === 'SectionTitle'), false);
  // An archived card with nothing owed says so.
  const clear = harness('cards.tsx', { data: { ...data, accounts: [...archive.accounts, { ...oldAccount, openingMinor: 0 }, goneAccount] } }).render();
  assert.equal(byName(clear, 'ArchivedCardRow')[0].rendered!.props.accessibilityLabel, 'Visa Vieja, Sin saldo pendiente');
});

test('Tarjetas in English: Due, Closes and Available; availability not calculated with installments; the same future and archived rows', () => {
  const oldAccount: domain.Account = { id: 'old-acc', name: 'Visa Vieja', currency: 'ARS', openingMinor: -13100, createdAt };
  const old: domain.CreditCardProfile = { ...card, id: 'old', accountId: oldAccount.id, active: false };
  const root = harness('cards.tsx', { locale: 'en-US', data: { ...archive, accounts: [...archive.accounts, oldAccount], cards: [card, amex, old] } }).render();
  assert.deepEqual(statsOf(root), ['Due: Oct 5 (October 5, 2026)', 'Closes: Oct 28 (October 28, 2026)', 'Available: Not calculated with installments']);
  assert.ok(texts(root).includes('Outstanding balance' + NBSP + '·' + NBSP + 'ARS'));
  assert.equal(byName(root, 'FutureInstallmentsRow')[0].rendered!.props.accessibilityLabel, 'Future installments, 1000000.00 pesos, in 1 plan');
  assert.equal(nodes(root).find(node => node.type === 'SectionTitle' && node.props.action === 'See all')!.props.caption, 'This cycle, since Sep 29 · 0 purchases · 0 payments');
  assert.equal(nodes(root).find(node => node.type === 'SectionTitle' && node.props.children === 'Archived')!.props.caption, 'They still take payments and record their installments.');
  assert.equal(byName(root, 'ArchivedCardRow')[0].rendered!.props.accessibilityLabel, 'Visa Vieja, Outstanding balance 131.00 pesos');
});

// ---- The card detail --------------------------------------------------------------------------------------------------

const nb = domain.newInstallmentPlan({ id: 'nb', card, cardAccount, merchant: 'Notebook', category: 'Tecnología', purchaseDateISO: '2026-09-20', principalMinor: 90000000,
  count: 3, placement: 'next', interestMinor: 9000000, interestCategory: 'Intereses', createdAt: '2026-09-20T18:00:00.000Z' });
const phone = domain.newInstallmentPlan({ id: 'ph', card, cardAccount, merchant: 'Teléfono', category: 'Tecnología', purchaseDateISO: '2026-07-01', principalMinor: 2000000,
  count: 2, placement: 'current', createdAt: '2026-07-01T12:00:00.000Z' });
const withPlans: domain.LedgerArchive = { ...archive, records: [...recognised(tv, [1, 2]), ...recognised(phone, [1, 2])], installmentPlans: [tv, nb, phone] };

test('card detail: its face, the same balance and facts with the limit, then Cuotas (live plans first, never «pagadas») before its movements', () => {
  const view = harness('card/[id].tsx', { params: { id: 'card' }, data: withPlans });
  const root = view.render();
  const face = find(root, 'CardFace');
  assert.equal(JSON.stringify([face.props.name, face.props.last4, face.props.width, face.props.showCurrency]), JSON.stringify(['Visa Gold', '4009', 353, true]));
  assert.deepEqual(statsOf(root).map(item => item.split(':')[0]), ['Vence', 'Cierra', 'Disponible']);
  assert.ok(texts(root).includes('de $' + NBSP + '3.000.000,00'), 'the limit under Disponible');
  const sections = nodes(root).filter(node => node.type === 'SectionTitle');
  assert.equal(sections.map(node => node.props.children).join(','), 'Cuotas,Movimientos');
  // tv: $ 1.000.000,00 to come; nb: $ 900.000,00 (principal only: the interest still to come is named beside it, never added in).
  assert.equal(sections[0].props.caption, 'Cuotas futuras $' + NBSP + '1.900.000,00 · + interés $' + NBSP + '90.000,00');
  assert.equal(sections[0].props.captionLabel, 'Cuotas futuras 1900000,00 pesos · + interés 90000,00 pesos');
  assert.equal(sections[1].props.caption, 'Este ciclo, desde anteayer · 0 compras · 0 pagos');
  const plans = byName(root, 'PlanRow');
  assert.equal(plans.map(row => row.props.summary.plan.id).join(','), 'nb,tv,ph', 'live plans by their next instalment (the newer purchase first on a tie), then completed');
  const [notebook, electro, telephone] = plans.map(row => row.rendered!);
  assert.equal(electro.props.accessibilityLabel, 'Electro, 12 cuotas, 2 de 12 registradas, 1000000,00 pesos restantes, próxima cuota el 28 de octubre de 2026');
  assert.deepEqual(texts(electro), ['Electro', '12 cuotas · 2/12 registradas', 'Próxima cuota · 28 oct', 'restantes']);
  assert.equal(nodes(electro).find(node => node.type === 'Money')!.props.minor, 100000000);
  // A plan with interest: its remaining figure is the principal, and says so.
  assert.equal(notebook.props.accessibilityLabel, 'Notebook, 3 cuotas, 0 de 3 registradas, 900000,00 pesos de principal restante, próxima cuota el 28 de octubre de 2026');
  assert.ok(texts(notebook).includes('principal restante'));
  assert.equal(telephone.props.accessibilityLabel, 'Teléfono, 2 cuotas, 2 de 2 registradas, Completo');
  assert.equal(nodes(telephone).some(node => node.type === 'Money'), false, 'a completed plan shows no amount left');
  assert.equal(JSON.stringify([...texts(root)]).includes('pagada'), false);
  electro.props.onPress();
  assert.equal(JSON.stringify(view.pushed.at(-1)), JSON.stringify({ pathname: '/installment/[id]', params: { id: 'tv' } }));
  assert.equal(nodes(root).find(node => node.type === 'Stack.Screen')!.props.options.headerRight().props.label, 'Editar tarjeta');
  // Without plans, no Cuotas section.
  assert.equal(nodes(harness('card/[id].tsx', { params: { id: 'amex' } }).render()).filter(node => node.type === 'SectionTitle').map(node => node.props.children).join(','), 'Movimientos');
});

test('card detail: an archived card is paid but takes no purchase; a deleted one only reads, without Editar', () => {
  const archivedCard = { ...card, active: false, revision: 1 };
  const archivedRoot = harness('card/[id].tsx', { params: { id: 'card' }, data: { ...withPlans, cards: [archivedCard, amex] } }).render();
  assert.ok(texts(archivedRoot).includes('Tarjeta archivada'));
  assert.equal(nodes(archivedRoot).filter(node => node.type === 'ActionButton').map(node => node.props.label).join(','), 'Pagar tarjeta');
  assert.equal(find(archivedRoot, 'ActionButton', 'Pagar tarjeta').props.disabled, false, 'something is owed');
  assert.ok(nodes(archivedRoot).find(node => node.type === 'Stack.Screen')!.props.options.headerRight, 'Editar reactivates it');
  assert.equal(byName(archivedRoot, 'PlanRow').length, 3, 'its plans keep running and stay listed');
  // Archived with nothing owed: no action at all.
  const settled = { ...withPlans, accounts: [cash, { ...cardAccount, openingMinor: 12000000 }, amexAccount], cards: [archivedCard, amex] };
  assert.equal(nodes(harness('card/[id].tsx', { params: { id: 'card' }, data: settled }).render()).some(node => node.type === 'ActionButton'), false);
  const deletedCard = { ...card, active: false, deleted: true, revision: 1 };
  const deletedRoot = harness('card/[id].tsx', { params: { id: 'card' }, data: { ...archive, cards: [deletedCard, amex] } }).render();
  assert.ok(texts(deletedRoot).includes('Tarjeta eliminada'));
  assert.equal(nodes(deletedRoot).some(node => node.type === 'ActionButton'), false);
  assert.equal(nodes(deletedRoot).find(node => node.type === 'Stack.Screen')!.props.options.headerRight, undefined);
  assert.equal(find(deletedRoot, 'CardFace').props.showCurrency, true, 'the deleted card shown here counts with the live ones');
});

test('card detail in English: Installments and its caption, plan rows recorded (never paid), the cycle caption', () => {
  const root = harness('card/[id].tsx', { params: { id: 'card' }, data: withPlans, locale: 'en-US' }).render();
  const sections = nodes(root).filter(node => node.type === 'SectionTitle');
  assert.equal(sections.map(node => node.props.children).join(','), 'Installments,Transactions');
  assert.equal(sections[0].props.caption, 'Future installments AR$' + NBSP + '1,900,000.00 · + interest AR$' + NBSP + '90,000.00');
  assert.equal(sections[1].props.caption, 'This cycle, since Sep 29 · 0 purchases · 0 payments');
  const electro = byName(root, 'PlanRow')[1].rendered!;
  assert.equal(electro.props.accessibilityLabel, 'Electro, 12 installments, 2 of 12 recorded, 1000000.00 pesos left, next installment on October 28, 2026');
  assert.deepEqual(texts(electro), ['Electro', '12 installments · 2/12 recorded', 'Next installment · Oct 28', 'left']);
});

// ---- The plan detail --------------------------------------------------------------------------------------------------

test('plan detail: the price first, then only its figures (recorded, future, remaining; never «pagado») and its calendar, each recorded row opening its movement', () => {
  const view = harness('installment/[id].tsx', { params: { id: 'tv' }, data: withPlans });
  const root = view.render();
  const options = nodes(root).find(node => node.type === 'Stack.Screen')!.props.options;
  assert.equal(JSON.stringify([options.title, options.gestureEnabled, options.headerBackVisible]), JSON.stringify(['Electro', true, true]));
  assert.equal(JSON.stringify(find(root, 'MerchantBadge').props), JSON.stringify({ merchant: 'Electro', category: 'Hogar', large: true }));
  assert.ok(texts(root).includes('Compra en cuotas' + NBSP + '·' + NBSP + 'ARS'));
  assert.equal(find(root, 'Money').props.minor, 120000000, 'the price is the hero');
  assert.ok(texts(root).includes('12 cuotas sin interés'), '24UX6D: one phrase under the price');
  const status = nodes(root).find(node => node.type === 'AppText' && text(node) === 'Activo')!;
  assert.equal(status.props.accessibilityLiveRegion, 'polite');
  // 24UX6D: the progress under the hero: «2 de 12 registradas» (the domain's recognised count), the next instalment and
  // the principal still to come, one VoiceOver element; the facts list no longer repeats the count or the live remaining.
  const progress = byName(root, 'PlanProgressSummary')[0].rendered!;
  assert.equal(progress.props.accessible, true);
  assert.equal(progress.props.accessibilityLabel, '2 de 12 registradas, 1000000,00 pesos restantes, próxima cuota el 28 de octubre de 2026');
  assert.deepEqual(texts(progress), ['2 de 12 registradas', 'Próxima cuota · 28 oct', 'restantes']);
  const liveSegments = [byName(root, 'PlanBar')[0].rendered!.props.children].flat().map((segment: Node) => Object.assign({}, ...[segment.props.style].flat()));
  assert.equal(liveSegments.map(style => style.backgroundColor === '#000' ? 'ink' : style.borderColor === '#999' && !style.borderStyle ? 'outline' : '?').join(','),
    'ink,ink' + ',outline'.repeat(10), '24UX6D review: still to come is a solid tertiary outline, distinct from recorded and from cancelled');
  assert.equal(nodes(progress).find(node => node.type === 'Money')!.props.minor, installmentPresentation.planSummary(tv, withPlans.records, withPlans.purchaseOperations ?? []).figures.remainingMinor);
  assert.deepEqual(rowsOf(root), [
    'Tarjeta=Visa Gold', 'Categoría=Hogar', 'Fecha de compra=10 ago 2026 (10 de agosto de 2026)', 'Precio=$ 1.200.000,00 (1200000,00 pesos)',
    'Ya registrado=$ 200.000,00 (200000,00 pesos)', 'Cuotas futuras=$ 1.000.000,00 (1000000,00 pesos)',
  ].map(row => row.replace(/\$ /g, '$' + NBSP)));
  // The hero, then the progress, then the facts, then the Calendario.
  const order = nodes(root).map(node => node.type === 'Money' && node.props.minor === 120000000 ? 'hero' : typeof node.type === 'function' && node.type.name === 'PlanProgressSummary' ? 'progress'
    : node.type === 'DetailRow' ? 'facts' : node.type === 'SectionTitle' ? 'schedule' : null).filter((item, index, all) => item && all.indexOf(item) === index);
  assert.deepEqual(order, ['hero', 'progress', 'facts', 'schedule'])
  find(root, 'DetailRow', 'Tarjeta').props.onPress();
  assert.equal(JSON.stringify(view.pushed.at(-1)), JSON.stringify({ pathname: '/card/[id]', params: { id: 'card' } }));
  // The calendar: one row per instalment, its statement's closing and due, its state.
  const schedule = nodes(root).find(node => node.type === 'SectionTitle' && node.props.children === 'Calendario')!;
  assert.equal(schedule.props.caption, 'Cada cuota cuenta como gasto cuando cierra su resumen.');
  const rows = byName(root, 'ScheduleRow');
  assert.equal(rows.length, 12);
  assert.equal(rows.map(row => row.props.row.state).join(','), 'recognised,recognised,next,future,future,future,future,future,future,future,future,future');
  const [first, , third] = rows.map(row => row.rendered!);
  assert.equal(first.props.accessibilityLabel, 'Cuota 1 de 12, 100000,00 pesos, Registrada, cierra 28 de agosto de 2026, vence 5 de septiembre de 2026');
  assert.deepEqual(texts(first), ['Cuota 1 de 12', 'Cierra 28 ago · vence 5 sep', 'Registrada']);
  assert.equal(first.props.accessibilityHint, 'Abre el movimiento de la cuota');
  first.props.onPress();
  assert.equal(JSON.stringify(view.pushed.at(-1)), JSON.stringify({ pathname: '/entry/[id]', params: { id: 'inst_tv_001' } }));
  assert.equal(third.type, 'View', 'an instalment still to come has no movement to open');
  assert.equal(third.props.accessibilityLabel, 'Cuota 3 de 12, 100000,00 pesos, Próxima, cierra 28 de octubre de 2026, vence 5 de noviembre de 2026');
  const last = rows.at(-1)!.rendered!;
  assert.deepEqual(texts(last), ['Cuota 12 de 12', 'Cierra 28 jul 2027 · vence 5 ago 2027', 'Futura'], 'a date in another year carries it');
  // 24T3 (deliberate change: 24T2 offered no action once something was recorded): a live plan with history offers its
  // three operations, each because storage would accept it; the stop is never beside «Eliminar plan». A devolución and an
  // adelanto open their own reviewed forms; nothing is written from here without its form or its alert.
  assert.deepEqual(nodes(root).filter(node => node.type === 'ActionButton').map(node => node.props.label),
    ['Registrar devolución', 'Registrar adelanto de cuotas', 'Dejar de seguir el plan']);
  find(root, 'ActionButton', 'Registrar devolución').props.onPress();
  assert.equal(JSON.stringify(view.pushed.at(-1)), JSON.stringify({ pathname: '/new-refund', params: { planId: 'tv' } }));
  find(root, 'ActionButton', 'Registrar adelanto de cuotas').props.onPress();
  assert.equal(JSON.stringify(view.pushed.at(-1)), JSON.stringify({ pathname: '/plan-payoff/[id]', params: { id: 'tv' } }));
  assert.equal(view.writes.length + view.alerts.length, 0, 'opening a form writes nothing and asks nothing');
  assert.equal(JSON.stringify(texts(root)).includes('pagad'), false);
});

test('plan detail: an undone instalment counts nowhere, stays pending and opens its movement; a cancelled plan says so and nothing is still to come', () => {
  const [one, two] = recognised(tv, [1, 2]);
  const undone: domain.EntryRecord = { ...two, voided: true, revision: 1, updatedAt: '2026-09-29T12:00:00.000Z' };
  const view = harness('installment/[id].tsx', { params: { id: 'tv' }, data: { ...withPlans, records: [one, undone] } });
  const root = view.render();
  assert.equal(byName(root, 'ScheduleRow').slice(0, 3).map(row => row.props.row.state).join(','), 'recognised,undone,next');
  assert.deepEqual(rowsOf(root).slice(4), ['Ya registrado=$ 100.000,00 (100000,00 pesos)', 'Cuotas futuras=$ 1.000.000,00 (1000000,00 pesos)',
    'Deshecho=$ 100.000,00 (100000,00 pesos)'].map(row => row.replace(/\$ /g, '$' + NBSP)));
  // The undone instalment never counts as recorded: «1 de 12», its segment drawn as undone, the principal left $ 1.100.000,00.
  const undoneProgress = byName(root, 'PlanProgressSummary')[0].rendered!;
  assert.equal(undoneProgress.props.accessibilityLabel, '1 de 12 registrada, 1100000,00 pesos restantes, próxima cuota el 28 de octubre de 2026');
  assert.equal(nodes(undoneProgress).find(node => node.type === 'Money')!.props.minor, 110000000);
  const second = byName(root, 'ScheduleRow')[1].rendered!;
  assert.ok(texts(second).includes('Deshecha'));
  second.props.onPress();
  assert.equal(JSON.stringify(view.pushed.at(-1)), JSON.stringify({ pathname: '/entry/[id]', params: { id: 'inst_tv_002' } }));
  // Cancelled after two instalments: they stay recorded; the rest is cancelled, never «future». 24T3 (A28, deliberate
  // copy change): the state reads «Sin seguimiento» and says what it means under the hero; the rest «No se registra».
  const cancelled = domain.cancelInstallmentPlan(tv, '2026-09-30T12:00:00.000Z');
  const stopped = harness('installment/[id].tsx', { params: { id: 'tv' }, data: { ...withPlans, installmentPlans: [cancelled, nb, phone] } }).render();
  assert.ok(texts(stopped).includes('Sin seguimiento'));
  assert.equal(find(stopped, 'LifecycleNote').props.detail, 'Las cuotas que faltaban no se registran. Las ya registradas siguen en Movimientos y en tus reportes.');
  assert.equal(JSON.stringify(texts(stopped)).includes('Cancelad'), false);
  assert.equal(byName(stopped, 'ScheduleRow').map(row => row.props.row.state).join(','), 'recognised,recognised' + ',cancelled'.repeat(10));
  const labels = rowsOf(stopped).map(row => row.split('=')[0]);
  assert.equal(labels.includes('Cuotas futuras'), false);
  // A stopped plan has nothing still to come: its progress says what was recorded, and its remaining figure stays a fact row.
  const stoppedProgress = byName(stopped, 'PlanProgressSummary')[0].rendered!;
  assert.equal(stoppedProgress.props.accessibilityLabel, '2 de 12 registradas');
  // 24UX6D review: the segments stand out from the canvas: recorded ones are ink, cancelled ones a dashed tertiary outline,
  // so a stopped plan never reads like a live one with the same count.
  const segmentsOf = (bar: Node) => [bar.props.children].flat().map((segment: Node) => Object.assign({}, ...[segment.props.style].flat()));
  const stoppedSegments = segmentsOf(byName(stopped, 'PlanBar')[0].rendered!);
  assert.equal(stoppedSegments.map(style => style.borderStyle === 'dashed' ? 'dashed' : style.backgroundColor === '#000' ? 'ink' : '?').join(','), 'ink,ink' + ',dashed'.repeat(10));
  assert.equal(stoppedSegments.slice(2).every(style => style.borderColor === '#999' && style.backgroundColor === 'transparent'), true, 'the tertiary ink, never the faint line colour');
  assert.equal(nodes(stoppedProgress).some(node => node.type === 'Money'), false);
  assert.ok(rowsOf(stopped).includes('Restante=$' + NBSP + '1.000.000,00 (1000000,00 pesos)'));
  assert.ok(rowsOf(stopped).includes('No se registra=$' + NBSP + '1.000.000,00 (1000000,00 pesos)'));
  assert.ok(texts(byName(stopped, 'ScheduleRow')[5].rendered!).includes('No se registra'));
  // 24T3 (deliberate change: 24T2 offered nothing on a cancelled plan): the recorded principal is still returnable, and the
  // stop can be undone; no adelanto (refused on a plan without tracking) and no stop.
  assert.deepEqual(nodes(stopped).filter(node => node.type === 'ActionButton').map(node => node.props.label), ['Registrar devolución', 'Reactivar plan']);
});

test('plan detail with interest: the total financed and the interest are their own figures, each instalment says what interest it includes', () => {
  const root = harness('installment/[id].tsx', { params: { id: 'nb' }, data: withPlans }).render();
  assert.ok(texts(root).includes('3 cuotas con interés'));
  // With interest, the progress names its figure as principal, like the plan's row in the card detail.
  assert.equal(byName(root, 'PlanProgressSummary')[0].rendered!.props.accessibilityLabel, '0 de 3 registradas, 900000,00 pesos de principal restante, próxima cuota el 28 de octubre de 2026');
  assert.equal(find(root, 'Money').props.minor, 90000000, 'the price, never the price plus interest');
  const rows = rowsOf(root);
  assert.ok(rows.includes('Total financiado=$' + NBSP + '990.000,00 (990000,00 pesos)'));
  assert.ok(rows.includes('Interés total=$' + NBSP + '90.000,00 (90000,00 pesos)'));
  // With interest, the figures are named as principal and the interest still to come has its own row, never added in.
  assert.ok(rows.includes('Principal futuro=$' + NBSP + '900.000,00 (900000,00 pesos)'), 'the future principal, interest apart');
  assert.ok(rows.includes('Interés futuro=$' + NBSP + '90.000,00 (90000,00 pesos)'));
  assert.ok(rows.includes('Principal registrado=$' + NBSP + '0,00 (0,00 pesos)'));
  assert.equal(rows.some(row => row.startsWith('Principal restante=')), false, 'a live plan\'s remaining principal is in its progress summary');
  assert.equal(rows.some(row => row.startsWith('Cuotas futuras=') || row.startsWith('Ya registrado=')), false);
  const first = byName(root, 'ScheduleRow')[0].rendered!;
  assert.deepEqual(texts(first), ['Cuota 1 de 3', 'Cierra 28 oct · vence 5 nov', 'Incluye interés $' + NBSP + '30.000,00', 'Próxima']);
  assert.equal(first.props.accessibilityLabel, 'Cuota 1 de 3, 330000,00 pesos, Próxima, cierra 28 de octubre de 2026, vence 5 de noviembre de 2026, Incluye interés 30000,00 pesos');
  assert.equal(nodes(first).find(node => node.type === 'Money')!.props.minor, 33000000, 'what the instalment charges: principal and interest');
  // Without interest nothing says interest.
  const plain = harness('installment/[id].tsx', { params: { id: 'tv' }, data: withPlans }).render();
  assert.equal(rowsOf(plain).some(row => /Total financiado|Interés/.test(row)), false);
  assert.equal(texts(plain).some(item => item.startsWith('Incluye')), false);
});

test('plan detail: a plan that recorded nothing can be deleted after a confirmation; the screen holds its back gesture while writing and closes once', async () => {
  let release: () => void = () => {};
  const view = harness('installment/[id].tsx', { params: { id: 'nb' }, data: withPlans, remove: () => new Promise<void>(resolve => { release = resolve; }) });
  // 24T3: nothing recorded yet, so it is deleted, never stopped (A16); a devolución or an adelanto may still be recorded.
  assert.deepEqual(nodes(view.render()).filter(node => node.type === 'ActionButton').map(node => node.props.label),
    ['Registrar devolución', 'Registrar adelanto de cuotas', 'Eliminar plan']);
  const button = find(view.render(), 'ActionButton', 'Eliminar plan');
  assert.equal(JSON.stringify([button.props.secondary, button.props.tone, button.props.icon]), JSON.stringify([true, 'expense', 'trash-outline']));
  button.props.onPress();
  const alert = view.alerts[0];
  assert.equal(alert.title, '¿Eliminar este plan de cuotas?');
  assert.equal(alert.message, 'Todavía no registró ninguna cuota. Se elimina el plan y ningún saldo cambia.');
  assert.equal(alert.buttons.map((item: { text: string; style?: string }) => item.text + ':' + item.style).join(','), 'Cancelar:cancel,Eliminar:destructive');
  assert.equal(view.removals.length, 0, 'asking writes nothing');
  alert.buttons[1].onPress();
  assert.equal(JSON.stringify(view.removals), JSON.stringify(['nb']));
  // While the write is in flight: no back gesture, no native back, the button busy.
  const writing = view.render();
  const options = nodes(writing).find(node => node.type === 'Stack.Screen')!.props.options;
  // 24T3: the other actions wait for it (disabled), the deletion's own button is the busy one.
  assert.equal(JSON.stringify([options.gestureEnabled, options.headerBackVisible, find(writing, 'ActionButton', 'Eliminar plan').props.busy]), JSON.stringify([false, false, true]));
  assert.equal(find(writing, 'ActionButton', 'Registrar devolución').props.disabled, true);
  find(writing, 'ActionButton', 'Eliminar plan').props.onPress();
  assert.equal(view.alerts.length, 1, 'a second tap while writing asks nothing and writes nothing');
  release();
  await settle();
  assert.equal(JSON.stringify([view.backs(), view.haptics(), view.removals.length]), JSON.stringify([1, 1, 1]));
  // The store holds the deletion record while the screen pops: still drawn, without its action; a later link finds nothing.
  const deleted = { ...withPlans, installmentPlans: [tv, domain.deleteInstallmentPlan(nb, '2026-10-01T12:00:00.000Z'), phone] };
  view.setData(deleted);
  const closing = view.render();
  assert.equal(nodes(closing).some(node => node.type === 'EmptyState'), false);
  assert.equal(nodes(closing).some(node => node.type === 'ActionButton'), false);
  assert.equal(find(harness('installment/[id].tsx', { params: { id: 'nb' }, data: deleted }).render(), 'EmptyState').props.title, 'No encontramos este plan de cuotas');
  assert.equal(find(harness('installment/[id].tsx', { params: { id: 'missing' } }).render(), 'EmptyState').props.title, 'No encontramos este plan de cuotas');
  // Nothing recorded yet is what makes it deletable: the card detail lists it until then.
  assert.equal(installmentPresentation.planSummary(nb, withPlans.records, withPlans.purchaseOperations ?? []).deletable, true);
  assert.equal(installmentPresentation.planSummary(tv, withPlans.records, withPlans.purchaseOperations ?? []).deletable, false);
});

test('plan detail: a failed deletion keeps the plan and the error; Reintentar sends the same deletion again without asking twice', async () => {
  let attempts = 0;
  const view = harness('installment/[id].tsx', { params: { id: 'nb' }, data: withPlans, remove: async () => { attempts++; if (attempts === 1) throw new Error('No pudimos guardar: disco lleno.'); } });
  find(view.render(), 'ActionButton', 'Eliminar plan').props.onPress();
  view.alerts[0].buttons[1].onPress();
  await settle();
  const failed = view.render();
  assert.equal(find(failed, 'ErrorMessage').props.message, 'No pudimos guardar: disco lleno.');
  const retry = find(failed, 'ActionButton', 'Reintentar cambio');
  assert.equal(view.backs(), 0, 'nothing was deleted: the screen stays');
  retry.props.onPress();
  assert.equal(view.alerts.length, 1, 'the retry asks nothing new');
  await settle();
  assert.equal(JSON.stringify([attempts, view.removals.join(','), view.backs()]), JSON.stringify([2, 'nb,nb', 1]));
});

test('plan detail in English: the same figures and calendar words', () => {
  const root = harness('installment/[id].tsx', { params: { id: 'tv' }, data: withPlans, locale: 'en-US' }).render();
  assert.ok(texts(root).includes('Purchase in installments' + NBSP + '·' + NBSP + 'ARS'));
  assert.ok(texts(root).includes('12 installments, interest-free'));
  assert.ok(texts(root).includes('Active'));
  assert.deepEqual(rowsOf(root).map(row => row.split('=')[0]), ['Card', 'Category', 'Purchase date', 'Price', 'Already recorded', 'Future installments']);
  const progress = byName(root, 'PlanProgressSummary')[0].rendered!;
  assert.deepEqual(texts(progress), ['2 of 12 recorded', 'Next installment · Oct 28', 'left']);
  assert.equal(progress.props.accessibilityLabel, '2 of 12 recorded, 1000000.00 pesos left, next installment on October 28, 2026');
  assert.ok(Object.hasOwn(progress.props, 'accessibilityLanguage'), 'a raw accessible View names the interface language (none when it is the device\'s)');
  const rows = byName(root, 'ScheduleRow').map(row => row.rendered!);
  assert.deepEqual(texts(rows[0]), ['Installment 1 of 12', 'Closes Aug 28 · due Sep 5', 'Recorded']);
  assert.equal(rows[2].props.accessibilityLabel, 'Installment 3 of 12, 100000.00 pesos, Next, closes October 28, 2026, due November 5, 2026');
  assert.ok(texts(rows[3]).includes('Upcoming'));
  const deletable = harness('installment/[id].tsx', { params: { id: 'nb' }, data: withPlans, locale: 'en-US' });
  find(deletable.render(), 'ActionButton', 'Delete plan').props.onPress();
  assert.equal(deletable.alerts[0].title, 'Delete this installment plan?');
});

// ---- 24T3: the plan's actions by state, its figures and Calendario with devoluciones and adelantos ----------------------

const opNow = '2026-10-01T12:00:00.000Z';
const money$ = (text: string) => text.replace(/\$ /g, '$' + NBSP);
const actionsOf = (root: Node) => nodes(root).filter(node => node.type === 'ActionButton').map(node => node.props.label);
/** An adelanto of every remaining instalment of `planId`, as the sheet builds it on Oct 1. */
const payoffOf = (planId: string, financing: domain.PayoffFinancing, id = 'po1') =>
  domain.newPlanPayoff(withPlans, { id, planId, financing, dateISO: '2026-10-01', todayISO: '2026-10-01', createdAt: opNow });

test('24T3: an adelanto brings the rest forward: «Adelantado», 12 de 12 counted, «Adelantada» rows that open the adelanto, and only a devolución left to offer', () => {
  const data = { ...withPlans, purchaseOperations: [payoffOf('tv', 'recognised')] };
  const view = harness('installment/[id].tsx', { params: { id: 'tv' }, data });
  const root = view.render();
  assert.ok(texts(root).includes('Adelantado'), 'the plan reads brought forward, never «pagado»');
  assert.equal(byName(root, 'PlanProgressSummary')[0].rendered!.props.accessibilityLabel, '12 de 12 registradas', 'a brought-forward instalment counts as recorded');
  const rows = byName(root, 'ScheduleRow');
  assert.equal(rows.map(row => row.props.row.state).join(','), 'recognised,recognised' + ',settled'.repeat(10));
  const third = rows[2].rendered!;
  assert.deepEqual(texts(third), ['Cuota 3 de 12', 'Cierra 28 oct · vence 5 nov', 'Adelantada']);
  assert.equal(third.props.accessibilityLabel, 'Cuota 3 de 12, 100000,00 pesos, Adelantada, cierra 28 de octubre de 2026, vence 5 de noviembre de 2026');
  assert.equal(third.props.accessibilityHint, 'Abre el adelanto de cuotas');
  third.props.onPress();
  assert.equal(JSON.stringify(view.pushed.at(-1)), JSON.stringify({ pathname: '/operation/[id]', params: { id: 'po1' } }));
  const segments = [byName(root, 'PlanBar')[0].rendered!.props.children].flat().map((segment: Node) => Object.assign({}, ...[segment.props.style].flat()));
  assert.equal(segments.every(style => style.backgroundColor === '#000'), true, 'brought forward is drawn as counted');
  assert.deepEqual(rowsOf(root).slice(4), ['Ya registrado=$ 1.200.000,00 (1200000,00 pesos)', 'Cuotas adelantadas=$ 1.000.000,00 (1000000,00 pesos)',
    'Cuotas futuras=$ 0,00 (0,00 pesos)', 'Restante=$ 0,00 (0,00 pesos)',
    // A26: the adelanto is listed under «Devoluciones y adelantos» too.
    'Adelanto de cuotas · 1 de octubre de 2026=$ 1.000.000,00 (1000000,00 pesos)'].map(money$));
  assert.deepEqual(actionsOf(root), ['Registrar devolución'], 'nothing left to bring forward or to stop');
  assert.equal(/pagad/i.test(JSON.stringify(texts(root))), false);
  // The card detail's row says the same word.
  const card = harness('card/[id].tsx', { params: { id: 'card' }, data }).render();
  const electro = byName(card, 'PlanRow').find(row => row.props.summary.plan.id === 'tv')!.rendered!;
  assert.equal(electro.props.accessibilityLabel, 'Electro, 12 cuotas, 12 de 12 registradas, Adelantado');
  // English: "Brought forward", never "paid".
  const english = harness('installment/[id].tsx', { params: { id: 'tv' }, data, locale: 'en-US' }).render();
  assert.ok(texts(english).includes('Brought forward'));
  assert.deepEqual(texts(byName(english, 'ScheduleRow')[2].rendered!), ['Installment 3 of 12', 'Closes Oct 28 · due Nov 5', 'Brought forward']);
  assert.ok(rowsOf(english).some(row => row.startsWith('Installments brought forward=')));
  assert.equal(/paid/i.test(JSON.stringify(texts(english))), false);
});

test('24T3: an adelanto whose interest the issuer did not charge: each row says so, «Interés no cobrado» is its own figure, and the principal figures say principal', () => {
  const data = { ...withPlans, purchaseOperations: [payoffOf('nb', 'waived', 'po2')] };
  const root = harness('installment/[id].tsx', { params: { id: 'nb' }, data }).render();
  const rows = byName(root, 'ScheduleRow');
  assert.equal(rows.map(row => row.props.row.state).join(','), 'settled,settled,settled');
  const first = rows[0].rendered!;
  // Verifier: the row charges what the adelanto recognised ($ 300.000,00 of principal); the interest not charged is said apart,
  // never inside the amount nor as «Incluye interés» (the card's balance holds $ 300.000,00 for it, not $ 330.000,00).
  assert.deepEqual(texts(first), ['Cuota 1 de 3', 'Cierra 28 oct · vence 5 nov', 'Interés no cobrado $' + NBSP + '30.000,00', 'Adelantada']);
  assert.equal(nodes(first).find(node => node.type === 'Money')!.props.minor, 30000000);
  assert.equal(first.props.accessibilityLabel, 'Cuota 1 de 3, 300000,00 pesos, Adelantada, Interés no cobrado 30000,00 pesos, cierra 28 de octubre de 2026, vence 5 de noviembre de 2026');
  // Recognised with the principal, the same row includes its interest and says so.
  const charged = byName(harness('installment/[id].tsx', { params: { id: 'nb' }, data: { ...withPlans, purchaseOperations: [payoffOf('nb', 'recognised', 'po3')] } }).render(), 'ScheduleRow')[0].rendered!;
  assert.deepEqual(texts(charged), ['Cuota 1 de 3', 'Cierra 28 oct · vence 5 nov', 'Incluye interés $' + NBSP + '30.000,00', 'Adelantada']);
  assert.equal(nodes(charged).find(node => node.type === 'Money')!.props.minor, 33000000);
  const facts = rowsOf(root);
  for (const row of ['Principal registrado=$ 900.000,00 (900000,00 pesos)', 'Principal adelantado=$ 900.000,00 (900000,00 pesos)',
    'Interés no cobrado=$ 90.000,00 (90000,00 pesos)', 'Principal restante=$ 0,00 (0,00 pesos)'].map(money$)) assert.ok(facts.includes(row), row);
  assert.equal(facts.some(row => row.startsWith('Interés futuro=')), false, 'no interest is still to come');
  // An operation names the plan: it is no longer deleted, only returned.
  assert.deepEqual(actionsOf(root), ['Registrar devolución']);
});

test('24T3: a devolución lowers the last instalments: the reduced row shows what it charges now and why, the one returned whole reads «Devuelta», both open the devolución', () => {
  // $ 350.000,00 returned on Oct 1: the $ 200.000,00 recorded comes back to the card, the rest lowers instalments 12 and 11.
  const refund = domain.newPlanRefund(withPlans, { id: 'rf1', planId: 'tv', amountMinor: 35000000, dateISO: '2026-10-01', todayISO: '2026-10-01', createdAt: opNow });
  assert.equal(JSON.stringify([refund.creditMinor, refund.reductions]), JSON.stringify([20000000, [{ number: 11, minor: 5000000 }, { number: 12, minor: 10000000 }]]));
  const view = harness('installment/[id].tsx', { params: { id: 'tv' }, data: { ...withPlans, purchaseOperations: [refund] } });
  const root = view.render();
  const rows = byName(root, 'ScheduleRow');
  assert.equal(rows.map(row => row.props.row.state).join(','), 'recognised,recognised,next' + ',future'.repeat(8) + ',refunded');
  const eleventh = rows[10].rendered!;
  assert.deepEqual(texts(eleventh), ['Cuota 11 de 12', 'Cierra 28 jun 2027 · vence 5 jul 2027', 'Reducida por devolución: $' + NBSP + '50.000,00', 'Futura']);
  assert.equal(nodes(eleventh).find(node => node.type === 'Money')!.props.minor, 5000000, 'what it charges now');
  assert.equal(eleventh.props.accessibilityLabel, 'Cuota 11 de 12, 50000,00 pesos, Futura, Reducida por devolución: 50000,00 pesos, cierra 28 de junio de 2027, vence 5 de julio de 2027');
  assert.equal(eleventh.props.accessibilityHint, 'Abre la devolución');
  eleventh.props.onPress();
  assert.equal(JSON.stringify(view.pushed.at(-1)), JSON.stringify({ pathname: '/operation/[id]', params: { id: 'rf1' } }));
  const twelfth = rows[11].rendered!;
  assert.deepEqual(texts(twelfth), ['Cuota 12 de 12', 'Cierra 28 jul 2027 · vence 5 ago 2027', 'Devuelta']);
  const amount = nodes(twelfth).find(node => node.type === 'Money')!.props;
  assert.equal(JSON.stringify([amount.minor, amount.color]), JSON.stringify([10000000, '#999']), 'its contractual amount, faded beside «Devuelta»');
  // An instalment still to come with nothing on it opens nothing.
  assert.equal(rows[3].rendered!.type, 'View');
  const segments = [byName(root, 'PlanBar')[0].rendered!.props.children].flat().map((segment: Node) => Object.assign({}, ...[segment.props.style].flat()));
  assert.equal(segments[11].borderStyle, 'dashed', 'returned whole: never recorded');
  // Two figures, never merged: the credit to the card and the future instalments lowered; the future principal is what is left.
  assert.deepEqual(rowsOf(root).slice(4), ['Ya registrado=$ 200.000,00 (200000,00 pesos)', 'Cuotas futuras=$ 850.000,00 (850000,00 pesos)',
    'Devuelto a la tarjeta=$ 200.000,00 (200000,00 pesos)', 'Cuotas reducidas por devolución=$ 150.000,00 (150000,00 pesos)',
    'Devolución · 1 de octubre de 2026=$ 350.000,00 (350000,00 pesos)'].map(money$));
  assert.equal(byName(root, 'PlanProgressSummary')[0].rendered!.props.accessibilityLabel, '2 de 12 registradas, 850000,00 pesos restantes, próxima cuota el 28 de octubre de 2026');
  assert.deepEqual(actionsOf(root), ['Registrar devolución', 'Registrar adelanto de cuotas', 'Dejar de seguir el plan']);
  const english = harness('installment/[id].tsx', { params: { id: 'tv' }, data: { ...withPlans, purchaseOperations: [refund] }, locale: 'en-US' }).render();
  assert.deepEqual(texts(byName(english, 'ScheduleRow')[10].rendered!), ['Installment 11 of 12', 'Closes Jun 28, 2027 · due Jul 5, 2027', 'Reduced by a refund: AR$' + NBSP + '50,000.00', 'Upcoming']);
  assert.ok(texts(byName(english, 'ScheduleRow')[11].rendered!).includes('Refunded'));
  assert.ok(rowsOf(english).some(row => row.startsWith('Refunded to the card=')));
  assert.ok(rowsOf(english).some(row => row.startsWith('Installments reduced by refunds=')));
});

test('24T3 review: a row whose principal a devolución took to zero opens the interest movement it recorded (or undid), never a principal movement that does not exist', () => {
  // Notebook, 3 × $ 300.000,00 + $ 30.000,00 interest: instalment 1 recorded; on Nov 1 $ 600.000,00 returned: $ 300.000,00 back
  // to the card, the rest takes instalment 3's principal whole. Through Jan 2 the closings record only its interest.
  const before: domain.LedgerArchive = { ...withPlans, records: [...withPlans.records, ...recognised(nb, [1])] };
  const refund = domain.newPlanRefund(before, { id: 'rf-n', planId: 'nb', amountMinor: 60000000, dateISO: '2026-11-01', todayISO: '2026-11-01', createdAt: opNow });
  assert.equal(JSON.stringify([refund.creditMinor, refund.reductions]), JSON.stringify([30000000, [{ number: 3, minor: 30000000 }]]));
  const inserts = domain.planCatchUpInserts({ ...before, purchaseOperations: [refund] }, 'nb', '2027-01-02');
  const data: domain.LedgerArchive = { ...before, records: [...before.records, ...inserts], purchaseOperations: [refund] };
  const interest3 = domain.installmentEntryId('nb', 3, 'interest');
  assert.equal(data.records.some(record => record.entry.id === domain.installmentEntryId('nb', 3, 'principal')), false, 'its principal was never recorded');
  assert.equal(data.records.some(record => record.entry.id === interest3), true);
  const view = harness('installment/[id].tsx', { params: { id: 'nb' }, data, day: '2027-01-02' });
  const third = byName(view.render(), 'ScheduleRow')[2];
  assert.equal(third.props.row.state, 'recognised');
  assert.equal(third.rendered!.props.accessibilityHint, 'Abre el movimiento de la cuota');
  third.rendered!.props.onPress();
  assert.equal(JSON.stringify(view.pushed.at(-1)), JSON.stringify({ pathname: '/entry/[id]', params: { id: interest3 } }));
  // Its interest undone: the row reads undone and still opens that movement (to restore it).
  const undone = { ...data, records: data.records.map(record => record.entry.id === interest3 ? { ...record, voided: true, revision: 1, updatedAt: opNow } : record) };
  const again = harness('installment/[id].tsx', { params: { id: 'nb' }, data: undone, day: '2027-01-02' });
  const row = byName(again.render(), 'ScheduleRow')[2];
  assert.equal(row.props.row.state, 'undone');
  row.rendered!.props.onPress();
  assert.equal(JSON.stringify(again.pushed.at(-1)), JSON.stringify({ pathname: '/entry/[id]', params: { id: interest3 } }));
});

test('24T3 review: «Devoluciones y adelantos» lists every operation of the plan, live and undone, newest first, each opening its own detail (A26)', () => {
  // Nothing recorded yet: devolución A lowers instalment 3; B then lowers 3 (by the rest) and 2, so rows 2 and 3 open B and
  // A is reached only from this list; C was undone and is listed to be restored.
  const a = domain.newPlanRefund(withPlans, { id: 'rf-a', planId: 'nb', amountMinor: 15000000, dateISO: '2026-10-01', todayISO: '2026-10-01', createdAt: opNow });
  const b = domain.newPlanRefund({ ...withPlans, purchaseOperations: [a] }, { id: 'rf-b', planId: 'nb', amountMinor: 45000000, dateISO: '2026-10-01', todayISO: '2026-10-01',
    createdAt: '2026-10-01T13:00:00.000Z' });
  const c = { ...domain.newPlanRefund({ ...withPlans, purchaseOperations: [a, b] }, { id: 'rf-c', planId: 'nb', amountMinor: 1000000, dateISO: '2026-10-01', todayISO: '2026-10-01',
    createdAt: '2026-10-01T14:00:00.000Z' }), voided: true, revision: 1 };
  assert.equal(JSON.stringify([a.creditMinor, a.reductions]), JSON.stringify([0, [{ number: 3, minor: 15000000 }]]), 'only reductions: no line in Movimientos');
  const data = { ...withPlans, purchaseOperations: [a, b, c] };
  const view = harness('installment/[id].tsx', { params: { id: 'nb' }, data });
  const root = view.render();
  assert.deepEqual(byName(root, 'ScheduleRow').slice(1).map(row => row.props.row.operationId), ['rf-b', 'rf-b']);
  assert.ok(nodes(root).some(node => node.type === 'SectionTitle' && text(node) === 'Devoluciones y adelantos'));
  const listed = nodes(root).filter(node => node.type === 'DetailRow' && node.props.icon === 'arrow-undo-outline');
  assert.deepEqual(listed.map(node => node.props.label + '=' + node.props.value + ' (' + node.props.spokenValue + ')'), [
    'Devolución deshecha · 1 de octubre de 2026=$ 10.000,00 (10000,00 pesos)', 'Devolución · 1 de octubre de 2026=$ 450.000,00 (450000,00 pesos)',
    'Devolución · 1 de octubre de 2026=$ 150.000,00 (150000,00 pesos)'].map(money$));
  listed[2].props.onPress();
  assert.equal(JSON.stringify(view.pushed.at(-1)), JSON.stringify({ pathname: '/operation/[id]', params: { id: 'rf-a' } }));
  listed[0].props.onPress();
  assert.equal(JSON.stringify(view.pushed.at(-1)), JSON.stringify({ pathname: '/operation/[id]', params: { id: 'rf-c' } }));
  // An undone adelanto too, with its own glyph.
  const payoff = { ...payoffOf('tv', 'recognised', 'po-u'), voided: true, revision: 1 };
  const tvRoot = harness('installment/[id].tsx', { params: { id: 'tv' }, data: { ...withPlans, purchaseOperations: [payoff] } }).render();
  assert.ok(rowsOf(tvRoot).includes(money$('Adelanto deshecho · 1 de octubre de 2026=$ 1.000.000,00 (1000000,00 pesos)')));
  assert.equal(nodes(tvRoot).find(node => node.type === 'DetailRow' && node.props.label.startsWith('Adelanto deshecho'))!.props.icon, 'play-forward-circle-outline');
  // A plan with no operation has no such section; English reads the same list.
  assert.equal(nodes(harness('installment/[id].tsx', { params: { id: 'tv' }, data: withPlans }).render()).some(node => node.type === 'SectionTitle' && text(node) === 'Devoluciones y adelantos'), false);
  const english = harness('installment/[id].tsx', { params: { id: 'nb' }, data, locale: 'en-US' }).render();
  assert.ok(nodes(english).some(node => node.type === 'SectionTitle' && text(node) === 'Refunds and installments brought forward'));
  assert.deepEqual(nodes(english).filter(node => node.type === 'DetailRow' && node.props.icon === 'arrow-undo-outline').map(node => node.props.label),
    ['Undone refund · October 1, 2026', 'Refund · October 1, 2026', 'Refund · October 1, 2026']);
});

test('24T3: a completed plan offers a devolución while something is returnable; returned whole it reads «Devuelto» and offers nothing; a deleted card offers nothing', () => {
  const completed = harness('installment/[id].tsx', { params: { id: 'ph' }, data: withPlans }).render();
  assert.ok(texts(completed).includes('Completo'));
  assert.deepEqual(actionsOf(completed), ['Registrar devolución']);
  const whole = domain.newPlanRefund(withPlans, { id: 'rf2', planId: 'ph', amountMinor: 2000000, dateISO: '2026-10-01', todayISO: '2026-10-01', createdAt: opNow });
  const data = { ...withPlans, purchaseOperations: [whole] };
  const refunded = harness('installment/[id].tsx', { params: { id: 'ph' }, data }).render();
  assert.ok(texts(refunded).includes('Devuelto'));
  assert.deepEqual(actionsOf(refunded), [], 'nothing returnable, nothing to bring forward or stop');
  const row = byName(harness('card/[id].tsx', { params: { id: 'card' }, data }).render(), 'PlanRow').find(item => item.props.summary.plan.id === 'ph')!.rendered!;
  assert.equal(row.props.accessibilityLabel, 'Teléfono, 2 cuotas, 2 de 2 registradas, Devuelto');
  // A stopped plan on a card deleted since: its history only reads.
  const gone = { ...withPlans, installmentPlans: [domain.cancelInstallmentPlan(tv, '2026-09-30T12:00:00.000Z'), nb, phone], cards: [{ ...card, active: false, deleted: true, revision: 1 }, amex] };
  assert.deepEqual(actionsOf(harness('installment/[id].tsx', { params: { id: 'tv' }, data: gone }).render()), []);
});

test('24T3: «Dejar de seguir el plan» says what stops, what stays and what it is not; a failed stop is retried unchanged without asking twice and the plan stays on screen', async () => {
  let attempts = 0;
  const view = harness('installment/[id].tsx', { params: { id: 'tv' }, data: withPlans, write: async () => { attempts++; if (attempts === 1) throw new Error('No pudimos guardar: disco lleno.'); } });
  const button = find(view.render(), 'ActionButton', 'Dejar de seguir el plan');
  assert.equal(JSON.stringify([button.props.secondary, button.props.tone, button.props.icon]), JSON.stringify([true, 'expense', 'stop-circle-outline']));
  button.props.onPress();
  const alert = view.alerts[0];
  assert.equal(alert.title, '¿Dejar de seguir este plan?');
  assert.equal(alert.message, 'Las cuotas que faltan ($' + NBSP + '1.000.000,00) dejan de registrarse. Las ya registradas siguen en Movimientos. No es una devolución ni un pago: '
    + 'si devolviste la compra, usá Registrar devolución; si adelantaste las cuotas, Registrar adelanto de cuotas.');
  assert.equal(alert.buttons.map((item: { text: string; style?: string }) => item.text + ':' + item.style).join(','), 'Cancelar:cancel,Dejar de seguir:destructive');
  assert.equal(view.writes.length, 0, 'asking writes nothing');
  alert.buttons[1].onPress();
  assert.deepEqual(view.writes.map(item => [item.action, JSON.stringify(item.arg)]), [['stop', JSON.stringify({ planId: 'tv', expectedRevision: 0 })]]);
  await settle();
  const failed = view.render();
  assert.equal(find(failed, 'ErrorMessage').props.message, 'No pudimos guardar: disco lleno.');
  assert.equal(find(failed, 'ActionButton', 'Registrar devolución').props.disabled, true, 'nothing else starts while the outcome is unknown');
  find(failed, 'ActionButton', 'Reintentar cambio').props.onPress();
  assert.equal(view.alerts.length, 1, 'the retry asks nothing new');
  await settle();
  assert.deepEqual(view.writes.map(item => JSON.stringify(item.arg)), [JSON.stringify({ planId: 'tv', expectedRevision: 0 }), JSON.stringify({ planId: 'tv', expectedRevision: 0 })],
    'the same stop, with the revision the person saw');
  assert.equal(JSON.stringify([view.backs(), view.haptics()]), JSON.stringify([0, 1]), 'a stopped plan stays on screen');
  assert.equal(nodes(view.render()).some(node => node.type === 'ErrorMessage' && node.props.message), false);
});

test('24T3: a stop storage refuses before writing (the plan changed) releases it: the screen reads the plan again and the next tap asks again', async () => {
  const view = harness('installment/[id].tsx', { params: { id: 'tv' }, data: withPlans,
    write: async () => { throw new Error('El plan de cuotas cambió desde que lo abriste. Volvé a revisarlo.'); } });
  find(view.render(), 'ActionButton', 'Dejar de seguir el plan').props.onPress();
  view.alerts[0].buttons[1].onPress();
  await settle();
  const refused = view.render();
  assert.equal(find(refused, 'ErrorMessage').props.message, 'El plan de cuotas cambió desde que lo abriste. Volvé a revisarlo.');
  assert.equal(find(refused, 'ActionButton', 'Registrar devolución').props.disabled, false);
  find(refused, 'ActionButton', 'Dejar de seguir el plan').props.onPress();
  assert.equal(view.alerts.length, 2, 'released: asked again');
  // In English the message is the catalogue's.
  const english = harness('installment/[id].tsx', { params: { id: 'tv' }, data: withPlans, locale: 'en-US' });
  find(english.render(), 'ActionButton', 'Stop tracking the plan').props.onPress();
  assert.equal(english.alerts[0].title, 'Stop tracking this plan?');
  assert.match(english.alerts[0].message, /^The remaining installments \(AR\$.1,000,000\.00\) stop being recorded\. .* It isn’t a refund or a payment: /);
  assert.equal(english.alerts[0].buttons[1].text, 'Stop tracking');
});

test('24T3: a stop whose outcome was unknown and that the ledger later shows done needs no retry: the screen reads the stopped plan', async () => {
  const view = harness('installment/[id].tsx', { params: { id: 'tv' }, data: withPlans, write: async () => { throw new Error('No pudimos guardar: disco lleno.'); } });
  find(view.render(), 'ActionButton', 'Dejar de seguir el plan').props.onPress();
  view.alerts[0].buttons[1].onPress();
  await settle();
  assert.ok(find(view.render(), 'ActionButton', 'Reintentar cambio'));
  // It had committed: the next read brings the stopped plan, one revision on.
  view.setData({ ...withPlans, installmentPlans: [domain.cancelInstallmentPlan(tv, '2026-10-01T12:00:00.000Z'), nb, phone] });
  view.render();
  const root = view.render();
  assert.deepEqual(actionsOf(root), ['Registrar devolución', 'Reactivar plan']);
  assert.equal(find(root, 'ActionButton', 'Registrar devolución').props.disabled, false);
  assert.equal(nodes(root).some(node => node.type === 'ErrorMessage' && node.props.message), false);
});

test('24T3: stopping after a closing the app has not recorded yet says the closed instalment is recorded first (M3)', () => {
  // Oct 29: instalment 3 closed on Oct 28; storage records it before the stop, and the alert says so.
  const view = harness('installment/[id].tsx', { params: { id: 'tv' }, data: withPlans, day: '2026-10-29' });
  find(view.render(), 'ActionButton', 'Dejar de seguir el plan').props.onPress();
  assert.equal(view.alerts[0].message.split('. Las ya registradas')[0],
    'Antes se registra la cuota 3, que ya cerró ($' + NBSP + '100.000,00). Las cuotas que faltan ($' + NBSP + '900.000,00) dejan de registrarse');
});

test('24T3: «Reactivar plan» names the closings recorded now, on their own dates, and sends the revision it showed', async () => {
  const stopped = { ...withPlans, installmentPlans: [domain.cancelInstallmentPlan(tv, '2026-09-30T12:00:00.000Z'), nb, phone] };
  const view = harness('installment/[id].tsx', { params: { id: 'tv' }, data: stopped, day: '2026-12-01' });
  const button = find(view.render(), 'ActionButton', 'Reactivar plan');
  assert.equal(JSON.stringify([button.props.secondary, button.props.tone, button.props.icon]), JSON.stringify([true, undefined, 'play-circle-outline']));
  button.props.onPress();
  const alert = view.alerts[0];
  assert.equal(alert.title, '¿Reactivar este plan?');
  assert.equal(alert.message, 'Sus cuotas vuelven a registrarse cuando cierra cada resumen. Las cuotas 3–4 cerraron mientras no se seguía: se registran ahora por $'
    + NBSP + '200.000,00, con la fecha de sus cierres (28 oct 2026 a 28 nov 2026).');
  assert.equal(alert.buttons.map((item: { text: string; style?: string }) => item.text + ':' + item.style).join(','), 'Cancelar:cancel,Reactivar:undefined');
  alert.buttons[1].onPress();
  await settle();
  assert.deepEqual(view.writes.map(item => [item.action, JSON.stringify(item.arg)]), [['reactivate', JSON.stringify({ planId: 'tv', expectedRevision: 1 })]]);
  assert.equal(view.haptics(), 1);
  // Nothing closed in between: the alert says only that it follows again.
  const calm = harness('installment/[id].tsx', { params: { id: 'tv' }, data: stopped });
  find(calm.render(), 'ActionButton', 'Reactivar plan').props.onPress();
  assert.equal(calm.alerts[0].message, 'Sus cuotas vuelven a registrarse cuando cierra cada resumen.');
  const english = harness('installment/[id].tsx', { params: { id: 'tv' }, data: stopped, day: '2026-12-01', locale: 'en-US' });
  const englishRoot = english.render();
  assert.deepEqual(actionsOf(englishRoot), ['Record refund', 'Reactivate plan']);
  assert.ok(texts(englishRoot).includes('Not tracked'));
  find(englishRoot, 'ActionButton', 'Reactivate plan').props.onPress();
  assert.equal(english.alerts[0].message, 'Its installments are recorded again as each statement closes. Installments 3–4 closed while the plan wasn’t tracked: '
    + 'they’re recorded now for AR$' + NBSP + '200,000.00, dated on their closings (Oct 28, 2026 to Nov 28, 2026).');
});

// ---- 24T3: «Registrar adelanto de cuotas» (/plan-payoff/[id]) -----------------------------------------------------------

test('24T3 adelanto: the sheet lists what is brought forward, bounds the date, says what is recorded and what is not, and Save echoes the amount', () => {
  const view = harness('plan-payoff/[id].tsx', { params: { id: 'tv' }, data: withPlans });
  const root = view.render();
  const options = nodes(root).find(node => node.type === 'Stack.Screen')!.props.options;
  assert.equal(JSON.stringify([options.title, options.gestureEnabled]), JSON.stringify(['Registrar adelanto de cuotas', true]));
  assert.equal(options.headerLeft().props.label, 'Cerrar');
  assert.ok(texts(root).includes('Cuotas que faltaban' + NBSP + '·' + NBSP + 'ARS'));
  assert.equal(find(root, 'Money').props.minor, 100000000, 'the hero is what Save records');
  assert.deepEqual(rowsOf(root), ['Cuotas=3–12', 'Importe=$ 1.000.000,00 (1000000,00 pesos)'].map(money$));
  assert.equal(nodes(root).some(node => node.type === 'CheckRow'), false, 'no financing: no choice to make');
  const date = find(root, 'DateField').props;
  assert.equal(JSON.stringify([date.label, domain.todayKey(date.value), domain.todayKey(date.minimumDate), domain.todayKey(date.maximumDate)]),
    JSON.stringify(['Fecha del adelanto', '2026-10-01', '2026-09-28', '2026-10-01']), 'between the last recorded closing and today (A6)');
  const sentence = nodes(root).find(node => node.type === 'AppText' && text(node).startsWith('FinanzApp registra'))!;
  assert.equal(text(sentence), 'FinanzApp registra con fecha 1 oct 2026 las cuotas que faltaban ($' + NBSP + '1.000.000,00) en el saldo pendiente de la tarjeta. '
    + 'El pago a la tarjeta se registra aparte, con Pagar tarjeta.');
  assert.equal(sentence.props.accessibilityLabel, 'FinanzApp registra con fecha 1 de octubre de 2026 las cuotas que faltaban (1000000,00 pesos) en el saldo pendiente de la tarjeta. '
    + 'El pago a la tarjeta se registra aparte, con Pagar tarjeta.');
  const save = find(root, 'ActionButton');
  assert.equal(JSON.stringify([save.props.label, save.props.spokenLabel, save.props.disabled]),
    JSON.stringify(['Registrar adelanto' + NBSP + '·' + NBSP + '$' + NBSP + '1.000.000,00', 'Registrar adelanto, 1000000,00 pesos', false]));
  assert.equal(view.writes.length, 0, 'opening the sheet writes nothing');
  assert.equal(/pagad/i.test(JSON.stringify(texts(root))), false);
});

test('24T3 adelanto: with future interest the person chooses, with nothing preselected; the hero, the echo and the adelanto follow the choice', async () => {
  const view = harness('plan-payoff/[id].tsx', { params: { id: 'nb' }, data: withPlans });
  let root = view.render();
  assert.deepEqual(rowsOf(root), ['Cuotas=1–3', 'Principal de las cuotas=$ 900.000,00 (900000,00 pesos)', 'Interés=$ 90.000,00 (90000,00 pesos)'].map(money$));
  const section = nodes(root).find(node => node.type === 'SectionTitle' && node.props.children === 'Intereses y cargos futuros')!;
  assert.equal(section.props.caption, 'Elegí qué pasó con ellos. Un cargo por adelantar se registra aparte, como un gasto de la tarjeta.');
  const choices = nodes(root).filter(node => node.type === 'CheckRow');
  assert.deepEqual(choices.map(node => [node.props.title, node.props.subtitle, node.props.selected]), [
    ['Los registro ahora', 'Se suman al adelanto, con la misma fecha.', false], ['El emisor no los cobró', 'No se registran; el plan los muestra como no cobrados.', false]]);
  assert.equal(find(root, 'Money').props.minor, 90000000, 'before the choice, only the principal is sure to be recorded');
  assert.equal(JSON.stringify([find(root, 'ActionButton').props.label, find(root, 'ActionButton').props.disabled]), JSON.stringify(['Registrar adelanto', true]));
  assert.equal(domain.todayKey(find(root, 'DateField').props.minimumDate), '2026-09-20', 'nothing recorded yet: the purchase date');
  choices[0].props.onPress();
  root = view.render();
  assert.equal(find(root, 'Money').props.minor, 99000000);
  assert.equal(find(root, 'ActionButton').props.spokenLabel, 'Registrar adelanto, 990000,00 pesos');
  nodes(root).filter(node => node.type === 'CheckRow')[1].props.onPress();
  root = view.render();
  assert.deepEqual(nodes(root).filter(node => node.type === 'CheckRow').map(node => node.props.selected), [false, true]);
  assert.equal(find(root, 'ActionButton').props.label, 'Registrar adelanto' + NBSP + '·' + NBSP + '$' + NBSP + '900.000,00');
  find(root, 'ActionButton').props.onPress();
  await settle();
  const sent = view.writes[0].arg as domain.PlanPayoff;
  assert.equal(JSON.stringify([view.writes[0].action, sent.id, sent.financing, sent.dateISO, sent.amountMinor, sent.covered.length]),
    JSON.stringify(['payoff', 'op-1', 'waived', '2026-10-01', 90000000, 6]), 'the financing rows stay in it, recorded as not charged');
});

test('24T3 adelanto: a write with an unknown outcome is retried unchanged; recorded, the sheet offers «Pagar tarjeta» prefilled with what the card owes now', async () => {
  let attempts = 0;
  const view = harness('plan-payoff/[id].tsx', { params: { id: 'tv' }, data: withPlans, write: async () => { attempts++; if (attempts === 1) throw new Error('No pudimos guardar: disco lleno.'); } });
  find(view.render(), 'ActionButton').props.onPress();
  await settle();
  let root = view.render();
  assert.equal(find(root, 'ErrorMessage').props.message, 'No pudimos guardar: disco lleno.');
  assert.ok(texts(root).includes('Conservamos el envío: Reintentar nunca registra el adelanto dos veces. Para cambiarlo, cerrá y revisá primero el plan.'));
  assert.equal(find(root, 'DateField').props.disabled, true, 'frozen: nothing changes under the retry');
  find(root, 'ActionButton', 'Reintentar guardado').props.onPress();
  await settle();
  assert.equal(view.writes.length, 2);
  assert.equal(view.writes[1].arg, view.writes[0].arg, 'the same adelanto, the same id');
  assert.equal(view.haptics(), 1);
  // The provider refreshed: the card now owes the instalments brought forward ($ 120.000,00 + $ 1.000.000,00).
  view.setData({ ...withPlans, purchaseOperations: [view.writes[0].arg as domain.PlanPayoff] });
  root = view.render();
  assert.ok(texts(root).includes('Adelanto registrado'));
  assert.ok(texts(root).includes('Las cuotas que faltaban ya están en el saldo pendiente de Visa Gold. Cuando pagues la tarjeta, registralo con Pagar tarjeta.'));
  assert.deepEqual(actionsOf(root), ['Pagar tarjeta', 'Listo']);
  find(root, 'ActionButton', 'Pagar tarjeta').props.onPress();
  assert.equal(JSON.stringify(view.pushed.at(-1)), JSON.stringify({ pathname: '/new-transfer', params: { toAccountId: 'card-acc', maxAmountMinor: '112000000' } }));
  find(root, 'ActionButton', 'Listo').props.onPress();
  assert.equal(view.backs(), 1);
});

test('24T3 adelanto: one whose outcome was unknown and that the ledger later holds is recorded: no retry, the next step is offered', async () => {
  const view = harness('plan-payoff/[id].tsx', { params: { id: 'tv' }, data: withPlans, write: async () => { throw new Error('No pudimos guardar: disco lleno.'); } });
  find(view.render(), 'ActionButton').props.onPress();
  await settle();
  assert.ok(find(view.render(), 'ActionButton', 'Reintentar guardado'));
  view.setData({ ...withPlans, purchaseOperations: [view.writes[0].arg as domain.PlanPayoff] });
  view.render();
  const root = view.render();
  assert.ok(texts(root).includes('Adelanto registrado'));
  assert.deepEqual(actionsOf(root), ['Pagar tarjeta', 'Listo']);
  assert.equal(view.writes.length, 1, 'nothing sent again');
});

test('24T3 adelanto: a refusal storage gave before writing (the instalments changed) releases the draft: the sheet previews again and Save rebuilds it with the same id', async () => {
  const view = harness('plan-payoff/[id].tsx', { params: { id: 'tv' }, data: withPlans, write: async () => { throw new Error(domain.OPERATION_CHANGED_MESSAGE); } });
  find(view.render(), 'ActionButton').props.onPress();
  await settle();
  // Meanwhile a devolución recorded elsewhere lowered instalment 12 by $ 50.000,00 (the provider read the ledger again).
  const refund = domain.newPlanRefund(withPlans, { id: 'rf3', planId: 'tv', amountMinor: 25000000, dateISO: '2026-10-01', todayISO: '2026-10-01', createdAt: opNow });
  view.setData({ ...withPlans, purchaseOperations: [refund] });
  const root = view.render();
  assert.equal(find(root, 'ErrorMessage').props.message, 'Las cuotas cambiaron desde que abriste el formulario; revisá.');
  assert.equal(find(root, 'DateField').props.disabled, false);
  assert.deepEqual(rowsOf(root), ['Cuotas=3–12', 'Importe=$ 950.000,00 (950000,00 pesos)'].map(money$));
  const save = find(root, 'ActionButton');
  assert.equal(save.props.label, 'Registrar adelanto' + NBSP + '·' + NBSP + '$' + NBSP + '950.000,00');
  save.props.onPress();
  await settle();
  const [first, second] = view.writes.map(item => item.arg as domain.PlanPayoff);
  assert.equal(JSON.stringify([first.id, second.id, first.amountMinor, second.amountMinor, second.covered.at(-1)]),
    JSON.stringify(['op-1', 'op-1', 100000000, 95000000, { number: 12, component: 'principal', minor: 5000000 }]));
});

test('24T3 adelanto (verifier): a day below the plan\'s floor (a statement closed while the sheet stayed open) moves up to the floor; the sheet never turns into «No hay cuotas»', async () => {
  // Oct 29: instalment 3 closed on Oct 28 and the app has not recorded it yet; storage will, before the adelanto (A8).
  const view = harness('plan-payoff/[id].tsx', { params: { id: 'tv' }, data: withPlans, day: '2026-10-29' });
  let root = view.render();
  assert.equal(domain.todayKey(find(root, 'DateField').props.minimumDate), '2026-10-28', 'the floor is the closing the catch-up records');
  // The day the sheet held from before that closing (or a wheel value below the bound): the sheet shows and sends the floor.
  find(root, 'DateField').props.onChange(new Date('2026-10-20T12:00:00'));
  root = view.render();
  assert.equal(nodes(root).some(node => node.type === 'EmptyState'), false);
  assert.equal(domain.todayKey(find(root, 'DateField').props.value), '2026-10-28');
  assert.ok(rowsOf(root).includes('Cuotas=4–12'));
  find(root, 'ActionButton').props.onPress();
  await settle();
  const sent = view.writes[0].arg as domain.PlanPayoff;
  assert.equal(JSON.stringify([sent.dateISO, sent.covered[0].number]), JSON.stringify(['2026-10-28', 4]));
  // What it sends is exactly what storage computes on its caught-up archive (A13).
  const caught = { ...withPlans, records: [...withPlans.records, ...domain.planCatchUpInserts(withPlans, 'tv', '2026-10-29')] };
  const expected = domain.newPlanPayoff(caught, { id: sent.id, planId: 'tv', financing: 'recognised', dateISO: '2026-10-28', todayISO: '2026-10-29', createdAt: sent.createdAt });
  assert.equal(JSON.stringify(sent), JSON.stringify(expected));
});

test('24T3 adelanto: undone instalments stay pending and the sheet says so; a plan without tracking has nothing to bring forward', () => {
  const [one, two] = recognised(tv, [1, 2]);
  const undone = { ...two, voided: true, revision: 1, updatedAt: '2026-09-29T12:00:00.000Z' };
  const root = harness('plan-payoff/[id].tsx', { params: { id: 'tv' }, data: { ...withPlans, records: [one, undone, ...recognised(phone, [1, 2])] } }).render();
  assert.equal(find(root, 'LifecycleNote').props.detail, 'La cuota 2 está deshecha: no se adelanta y sigue pendiente en el plan.');
  assert.equal(find(root, 'LifecycleNote').props.tone, 'warning');
  assert.ok(rowsOf(root).includes('Cuotas=3–12'));
  const stopped = { ...withPlans, installmentPlans: [domain.cancelInstallmentPlan(tv, '2026-09-30T12:00:00.000Z'), nb, phone] };
  const empty = find(harness('plan-payoff/[id].tsx', { params: { id: 'tv' }, data: stopped }).render(), 'EmptyState');
  assert.equal(JSON.stringify([empty.props.title, empty.props.detail]), JSON.stringify(['No hay cuotas para adelantar', 'Este plan no se sigue. Reactivalo primero.']));
  assert.equal(find(harness('plan-payoff/[id].tsx', { params: { id: 'missing' } }).render(), 'EmptyState').props.title, 'No encontramos este plan de cuotas');
});

test('24T3 adelanto in English: the same sheet, "Brought forward" words, the choice and the sentence', () => {
  const root = harness('plan-payoff/[id].tsx', { params: { id: 'nb' }, data: withPlans, locale: 'en-US' }).render();
  assert.equal(nodes(root).find(node => node.type === 'Stack.Screen')!.props.options.title, 'Record installments brought forward');
  assert.deepEqual(rowsOf(root).map(row => row.split('=')[0]), ['Installments', 'Installments’ principal', 'Interest']);
  assert.deepEqual(nodes(root).filter(node => node.type === 'CheckRow').map(node => node.props.title), ['Record them now', 'The issuer didn’t charge them']);
  const sentence = nodes(root).find(node => node.type === 'AppText' && text(node).startsWith('FinanzApp records'))!;
  assert.equal(text(sentence), 'FinanzApp records the remaining installments (AR$' + NBSP + '900,000.00) on Oct 1, 2026 in the card’s outstanding balance. '
    + 'The payment to the card is recorded separately, with Pay card.');
  assert.equal(find(root, 'ActionButton').props.label, 'Record installments');
  assert.equal(/paid/i.test(JSON.stringify(texts(root))), false);
});

// ---- The movement an instalment recorded ------------------------------------------------------------------------------

test('movement detail of an instalment: «Cuota de tarjeta», a «Cuota 2 de 12» row that opens its plan, and an undo that says the instalment stays pending', async () => {
  const view = harness('entry/[id].tsx', { params: { id: 'inst_tv_002' }, data: withPlans });
  const root = view.render();
  assert.equal(nodes(root).find(node => node.type === 'Stack.Screen')!.props.options.title, 'Cuota de tarjeta');
  assert.deepEqual(rowsOf(root), ['Categoría=Hogar', 'Tarjeta=Visa Gold', 'Cuota=2 de 12', 'Moneda=Pesos argentinos']);
  // 24UX6C: the hero is the instalment's stored magnitude (one 1/12 share, never the full price), unsigned, in ink.
  const hero = find(root, 'Money').props;
  assert.equal(hero.minor, 10000000, 'the recognised share as stored');
  assert.equal(hero.signed, false, 'no minus on an expense: the title says what it is');
  assert.equal(hero.tone, 'expense');
  assert.equal(withPlans.records.find(record => record.entry.id === 'inst_tv_002')!.entry.amountMinor, 10000000, 'the stored amount is unchanged by the render');
  find(root, 'DetailRow', 'Cuota').props.onPress();
  assert.equal(JSON.stringify(view.pushed.at(-1)), JSON.stringify({ pathname: '/installment/[id]', params: { id: 'tv' } }));
  // Editar still opens the movement form (it only lets merchant and category change for an instalment).
  find(root, 'ActionButton', 'Editar movimiento').props.onPress();
  assert.equal(JSON.stringify(view.pushed.at(-1)), JSON.stringify({ pathname: '/edit-entry/[id]', params: { id: 'inst_tv_002' } }));
  find(root, 'ActionButton', 'Deshacer movimiento').props.onPress();
  assert.equal(view.alerts[0].message, 'Se sumarán 100.000,00 ARS a Visa Gold. Dejará de contar en tus saldos y reportes. Podés recuperarlo después. '
    + 'La cuota queda deshecha: no se vuelve a registrar sola y sigue pendiente en su plan.');
  view.alerts[0].buttons[1].onPress();
  await settle();
  assert.equal(view.updates[0].action, 'void');
  // Restoring it says nothing about the plan: it counts again.
  const undoneData = { ...withPlans, records: withPlans.records.map(record => record.entry.id === 'inst_tv_002' ? view.updates[0].after : record) };
  const undone = harness('entry/[id].tsx', { params: { id: 'inst_tv_002' }, data: undoneData });
  const undoneRoot = undone.render();
  assert.equal(nodes(undoneRoot).find(node => node.type === 'Stack.Screen')!.props.options.title, 'Movimiento deshecho');
  find(undoneRoot, 'ActionButton', 'Recuperar movimiento').props.onPress();
  assert.equal(undone.alerts[0].message.includes('La cuota queda deshecha'), false);
});

test('movement detail: a financing share says which component it is; a plain card purchase and an ordinary movement are unchanged', () => {
  const fin = domain.newInstallmentPlan({ id: 'fin', card, cardAccount, merchant: 'Heladera', category: 'Hogar', purchaseDateISO: '2026-08-12', principalMinor: 30000000,
    count: 3, placement: 'current', interestMinor: 3000000, interestCategory: 'Intereses', createdAt: '2026-08-12T12:00:00.000Z' });
  const purchase: domain.Entry = { id: 'purchase', accountId: cardAccount.id, kind: 'expense', amountMinor: 23100, merchant: 'Starbucks', category: 'Café', dateISO: '2026-09-30', createdAt };
  const data = { ...withPlans, records: [...withPlans.records, ...recognised(fin, [1]), domain.initialRecord(purchase)], installmentPlans: [...withPlans.installmentPlans!, fin] };
  const interestView = harness('entry/[id].tsx', { params: { id: 'insti_fin_001' }, data });
  const interest = interestView.render();
  assert.equal(nodes(interest).find(node => node.type === 'Stack.Screen')!.props.options.title, 'Interés de cuota');
  assert.ok(rowsOf(interest).includes('Cuota=1 de 3 · interés'));
  assert.ok(rowsOf(interest).includes('Categoría=Intereses'), 'the interest keeps its own category');
  // 24UX6C: the hero shows the stored magnitude, unsigned in ink: the title already says it is a charge.
  const interestHero = find(interest, 'Money').props;
  assert.equal(interestHero.minor, 1000000, 'the interest share as stored, never negated');
  assert.equal(interestHero.signed, false);
  assert.equal(interestHero.tone, 'expense');
  // Undoing one share of an instalment that has another says only that part is undone (its principal keeps counting).
  find(interest, 'ActionButton', 'Deshacer movimiento').props.onPress();
  assert.match(interestView.alerts[0].message, / Solo esta parte de la cuota queda deshecha: no se vuelve a registrar sola y sigue pendiente en su plan\. La otra parte de la cuota no cambia\.$/);
  const principalView = harness('entry/[id].tsx', { params: { id: 'inst_fin_001' }, data });
  const principal = principalView.render();
  assert.equal(nodes(principal).find(node => node.type === 'Stack.Screen')!.props.options.title, 'Cuota de tarjeta');
  assert.ok(rowsOf(principal).includes('Cuota=1 de 3'));
  find(principal, 'ActionButton', 'Deshacer movimiento').props.onPress();
  assert.match(principalView.alerts[0].message, /La otra parte de la cuota no cambia\.$/, 'the principal of an instalment with interest is one part too');
  const plain = harness('entry/[id].tsx', { params: { id: 'purchase' }, data }).render();
  assert.equal(nodes(plain).find(node => node.type === 'Stack.Screen')!.props.options.title, 'Compra con tarjeta');
  assert.deepEqual(rowsOf(plain), ['Categoría=Café', 'Tarjeta=Visa Gold', 'Moneda=Pesos argentinos']);
  assert.equal(JSON.stringify((({ minor, signed, tone }) => ({ minor, signed, tone }))(find(plain, 'Money').props)), JSON.stringify({ minor: 23100, signed: false, tone: 'expense' }),
    'a plain card purchase: the stored amount, no sign (24UX6C)');
  const english = harness('entry/[id].tsx', { params: { id: 'inst_tv_002' }, data: withPlans, locale: 'en-US' });
  const englishRoot = english.render();
  assert.equal(nodes(englishRoot).find(node => node.type === 'Stack.Screen')!.props.options.title, 'Card installment');
  assert.ok(rowsOf(englishRoot).includes('Installment=2 of 12'));
  assert.ok(rowsOf(harness('entry/[id].tsx', { params: { id: 'insti_fin_001' }, data, locale: 'en-US' }).render()).includes('Installment=1 of 3 · interest'));
  find(englishRoot, 'ActionButton', 'Undo transaction').props.onPress();
  assert.match(english.alerts[0].message, / The installment stays undone: it isn’t recorded again on its own and stays pending in its plan\.$/);
});

test('24T2 review: at the largest text sizes the plan, schedule and future rows stack; a long merchant and a large amount keep every word and figure', () => {
  const merchant = 'Electrodomésticos del Centro Comercial Norte, Sucursal 14';
  const big = domain.newInstallmentPlan({ id: 'big', card, cardAccount, merchant, category: 'Hogar', purchaseDateISO: '2026-09-10', principalMinor: 99999999999900,
    count: 12, placement: 'current', createdAt: '2026-09-10T15:00:00.000Z' });
  const data: domain.LedgerArchive = { ...archive, records: [...archive.records, ...recognised(big, [1])], installmentPlans: [big, tv] };
  const detail = harness('card/[id].tsx', { params: { id: 'card' }, data, stacked: true }).render();
  const row = byName(detail, 'PlanRow').find(item => item.props.summary.plan.id === 'big')!.rendered!;
  const body = nodes(row).find(node => node.type === 'View' && [node.props.style].flat().some((style: any) => style?.flexDirection === 'column'));
  assert.ok(body, 'the row stacks its text over its amount');
  const name = nodes(row).find(node => node.type === 'AppText' && node.props.children === merchant)!;
  assert.equal(name.props.numberOfLines, undefined, 'a stacked row never truncates the merchant');
  assert.equal(nodes(row).find(node => node.type === 'Money')!.props.minor, 99999999999900 - big.schedule[0].principalMinor);
  assert.match(row.props.accessibilityLabel, new RegExp('^' + merchant + ', 12 cuotas, 1 de 12 registrada, 916666666665,75 pesos restantes, '));
  const plan = harness('installment/[id].tsx', { params: { id: 'big' }, data, stacked: true }).render();
  const first = byName(plan, 'ScheduleRow')[0].rendered!;
  assert.ok(nodes(first).some(node => node.type === 'View' && [node.props.style].flat().some((style: any) => style?.flexDirection === 'column')));
  assert.equal(nodes(first).find(node => node.type === 'Money')!.props.minor, big.schedule[0].principalMinor);
  const cards = harness('cards.tsx', { data, stacked: true }).render();
  const future = byName(cards, 'FutureInstallmentsRow')[0].rendered!;
  assert.ok(nodes(future).some(node => node.type === 'View' && [node.props.style].flat().some((style: any) => style?.flexDirection === 'column')));
});

test('24T2 review: a plan in a currency without decimals (JPY) and one with three (KWD) show exact amounts on the plan detail', () => {
  for (const [currency, principalMinor] of [['JPY', 120000], ['KWD', 1234567]] as const) {
    const account: domain.Account = { id: 'fx-acc', name: 'Tarjeta ' + currency, currency, openingMinor: 0, createdAt };
    const fxCard: domain.CreditCardProfile = { ...card, id: 'fx', accountId: account.id, creditLimitMinor: null };
    const plan = domain.newInstallmentPlan({ id: 'fx-plan', card: fxCard, cardAccount: account, merchant: 'Tienda', category: 'Hogar', purchaseDateISO: '2026-09-10',
      principalMinor, count: 3, placement: 'current', createdAt: '2026-09-10T15:00:00.000Z' });
    const data: domain.LedgerArchive = { ...archive, accounts: [...archive.accounts, account], cards: [...archive.cards!, fxCard], installmentPlans: [plan],
      records: recognised(plan, [1], account.id) };
    const root = harness('installment/[id].tsx', { params: { id: 'fx-plan' }, data }).render();
    const i18n = bindLocale('es-AR');
    assert.equal(find(root, 'Money').props.minor, principalMinor);
    assert.ok(rowsOf(root).includes('Precio=' + i18n.moneyText(principalMinor, currency) + ' (' + i18n.spokenMoney(principalMinor, currency) + ')'), currency);
    const amounts = byName(root, 'ScheduleRow').map(row => nodes(row.rendered!).find(node => node.type === 'Money')!.props.minor);
    assert.equal(amounts.reduce((sum: number, minor: number) => sum + minor, 0), principalMinor, currency + ': the instalments add up to the price exactly');
    assert.ok(rowsOf(root).includes('Ya registrado=' + i18n.moneyText(plan.schedule[0].principalMinor, currency) + ' (' + i18n.spokenMoney(plan.schedule[0].principalMinor, currency) + ')'));
  }
});

test('Codex review: when a card\'s plans add up beyond the exact range, Tarjetas and the card detail still open and say «Total fuera de rango»', () => {
  const plans = Array.from({ length: 10 }, (_, index) => domain.newInstallmentPlan({ id: 'big' + index, card, cardAccount, merchant: 'Big ' + index, category: 'Hogar',
    purchaseDateISO: '2026-10-10', principalMinor: 2, count: 2, placement: 'current', interestMinor: 999999999999998, interestCategory: 'Intereses', createdAt: '2026-10-10T12:00:00.000Z' }));
  const data: domain.LedgerArchive = { ...archive, installmentPlans: [tv, ...plans] };
  const cards = harness('cards.tsx', { data }).render();
  const future = byName(cards, 'FutureInstallmentsRow')[0].rendered!;
  assert.ok(texts(future).includes('Total fuera de rango'));
  assert.equal(nodes(future).some(node => node.type === 'Money'), false, 'no rounded figure');
  assert.equal(future.props.accessibilityLabel, 'Cuotas futuras, Total fuera de rango, en 11 planes');
  const detail = harness('card/[id].tsx', { params: { id: 'card' }, data }).render();
  const sections = nodes(detail).filter(node => node.type === 'SectionTitle');
  assert.deepEqual([sections[0].props.children, sections[0].props.caption], ['Cuotas', 'Cuotas futuras: total fuera de rango']);
  assert.equal(byName(detail, 'PlanRow').length, 11, 'every plan still listed, each with its own exact figures');
  const english = harness('card/[id].tsx', { params: { id: 'card' }, data, locale: 'en-US' }).render();
  assert.equal(nodes(english).filter(node => node.type === 'SectionTitle')[0].props.caption, 'Future installments: total out of range');
});

// ---- 24UX6D: Tarjetas in Forest ---------------------------------------------------------------------------------------

/** Six active cards (1 and 2 are the fixture's; four more with balances 1–4 × $ 1.000,00), for the deck and the snapshot. */
function sixCards(): domain.LedgerArchive {
  const extra = [1, 2, 3, 4].map(index => ({
    account: { id: 'c' + index + '-acc', name: index === 4 ? 'Visa Signature Banco de la Provincia de Buenos Aires' : 'Tarjeta ' + index, currency: 'ARS' as const,
      openingMinor: -100000 * index, createdAt },
    card: { ...card, id: 'c' + index, accountId: 'c' + index + '-acc', last4: '000' + index, creditLimitMinor: null } as domain.CreditCardProfile }));
  return { ...archive, accounts: [...archive.accounts, ...extra.map(item => item.account)], cards: [card, amex, ...extra.map(item => item.card)] };
}

test('24UX6D: with six cards one is always in front, a strip brings its card forward, only the selected card feeds the snapshot, and the front card opens its detail', () => {
  const view = harness('cards.tsx', { data: sixCards() });
  const snapshots = (root: Node) => byName(root, 'CardSnapshot');
  let root = view.render();
  const deck = find(root, 'CardDeck');
  assert.equal(deck.props.cards.map((item: { id: string }) => item.id).join(','), 'card,amex,c1,c2,c3,c4', 'every active card, in the stored order');
  assert.equal(deck.props.selectedId, 'card', 'no «choose a card first» state: the first card is in front');
  assert.equal(snapshots(root).length, 1);
  assert.equal(snapshots(root)[0].props.summary.id, 'card');
  deck.props.onSelect('c3');
  root = view.render();
  assert.equal(find(root, 'CardDeck').props.selectedId, 'c3');
  assert.equal(JSON.stringify(snapshots(root).map(node => node.props.summary.id)), JSON.stringify(['c3']), 'only the selected card drives the snapshot');
  assert.equal(nodes(snapshots(root)[0]).find(node => node.type === 'Money')!.props.minor, 300000, 'its own balance');
  find(root, 'ActionButton', 'Pagar tarjeta').props.onPress();
  assert.equal(JSON.stringify(view.pushed.at(-1)), JSON.stringify({ pathname: '/new-transfer', params: { toAccountId: 'c3-acc', maxAmountMinor: '300000' } }));
  find(root, 'CardDeck').props.onOpen('c3');
  assert.equal(JSON.stringify(view.pushed.at(-1)), JSON.stringify({ pathname: '/card/[id]', params: { id: 'c3' } }));
  // The long name reaches the deck whole (the face gives it two lines in front; VoiceOver hears all of it).
  assert.equal(find(root, 'CardDeck').props.cards[5].name, 'Visa Signature Banco de la Provincia de Buenos Aires');
});

test('24UX6D: choosing a card in a six-card deck scrolls with the compact 44 pt strips', () => {
  const view = harness('cards.tsx', { data: sixCards() });
  const scrolls: { y: number; animated: boolean }[] = [];
  const root = view.render();
  const box = nodes(root).find(node => node.type === 'View' && node.props.ref)!;
  box.props.onLayout({ nativeEvent: { layout: { y: 20 } } });
  box.props.ref.current = { measureInWindow: (callback: (x: number, y: number) => void) => callback(0, 123) };
  find(root, 'Screen').props.scrollRef.current = { scrollTo: (to: { y: number; animated: boolean }) => scrolls.push(to),
    getNativeScrollRef: () => ({ measureInWindow: (callback: (x: number, y: number, width: number, height: number) => void) => callback(0, 0, 393, 300) }) };
  find(root, 'CardDeck').props.onSelect('c2');
  // The front card's top: 123 + 5 × 44 = 343, below a 300 pt viewport: scrolled to a quarter of it (offset −103 + 343 − 75).
  assert.equal(geometry.deckExposure(1, 6), 44);
  assert.deepEqual(scrolls.map(item => [item.y, item.animated]), [[165, false]]);
});

test('24UX6D: the snapshot reads identity → Saldo pendiente → Vence · Cierra → Disponible → actions → Cuotas futuras → Recientes, with the balance and facts flat on the canvas', () => {
  const root = harness('cards.tsx').render();
  const snapshot = byName(root, 'CardSnapshot')[0];
  const order = nodes(snapshot).map(node => node.type === 'Money' && node.props.minor === 10000000 ? 'balance'
    : node.type === 'Stat' ? 'fact:' + node.props.label : node.type === 'ActionButton' ? 'action:' + node.props.label
    : typeof node.type === 'function' && node.type.name === 'FutureInstallmentsRow' ? 'future' : node.type === 'SectionTitle' ? 'recent:' + node.props.children : null)
    .filter((item, index, all) => item && all.indexOf(item) === index);
  assert.deepEqual(order, ['balance', 'fact:Vence', 'fact:Cierra', 'fact:Disponible', 'action:Registrar compra', 'action:Pagar tarjeta', 'future', 'recent:Recientes']);
  // No surface around the balance or the facts: the only surfaces are the grouped lists (future instalments, recent).
  const surfaces = nodes(snapshot).filter(node => node.type === 'Surface');
  assert.ok(surfaces.length >= 1);
  assert.ok(surfaces.every(node => node.props.grouped === true), 'no padded white card of equal weight');
  assert.equal(surfaces.some(node => nodes(node).some(inner => inner.type === 'Stat' || (inner.type === 'Money' && inner.props.minor === 10000000))), false);
  // The two dates share a row; Disponible has its own, full width (a seven-digit amount keeps its row size).
  const row = find(snapshot, 'StatRow');
  assert.deepEqual(nodes(row).filter(node => node.type === 'Stat').map(node => node.props.label), ['Vence', 'Cierra']);
  assert.equal(nodes(snapshot).filter(node => node.type === 'Stat' && node.props.label === 'Disponible').length, 1);
  const recent = nodes(snapshot).find(node => node.type === 'SectionTitle')!;
  assert.deepEqual([recent.props.quiet, recent.props.action], [true, 'Ver todos']);
  // English reads the same order.
  const english = byName(harness('cards.tsx', { locale: 'en-US' }).render(), 'CardSnapshot')[0];
  assert.deepEqual(nodes(find(english, 'StatRow')).filter(node => node.type === 'Stat').map(node => node.props.label), ['Due', 'Closes']);
  assert.deepEqual([nodes(english).find(node => node.type === 'SectionTitle')!.props.action], ['See all']);
});

test('24UX6D: an archived card says what it still does under its face (still paid, no new purchase); a deleted one only reads', () => {
  const archivedRoot = harness('card/[id].tsx', { params: { id: 'card' }, data: { ...withPlans, cards: [{ ...card, active: false, revision: 1 }, amex] } }).render();
  const note = byName(archivedRoot, 'CardLifecycleNote')[0];
  assert.equal(note.props.state, 'archived');
  assert.deepEqual(texts(note.rendered!), ['Tarjeta archivada', 'Sigue recibiendo pagos y registrando sus cuotas. Para usarla de nuevo, reactivala en Editar tarjeta.']);
  // Right under the face, before the balance.
  const balance = find(archivedRoot, 'Money').props.minor;
  const kinds = nodes(archivedRoot).map(node => node.type === 'CardFace' ? 'face' : typeof node.type === 'function' && node.type.name === 'CardLifecycleNote' ? 'note'
    : node.type === 'Money' && node.props.minor === balance && node.props.large ? 'balance' : null).filter((item, index, all) => item && all.indexOf(item) === index);
  assert.deepEqual(kinds, ['face', 'note', 'balance']);
  assert.equal(nodes(archivedRoot).filter(node => node.type === 'ActionButton').map(node => node.props.label).join(','), 'Pagar tarjeta', 'paid, no Registrar compra');
  const deletedRoot = harness('card/[id].tsx', { params: { id: 'card' }, data: { ...archive, cards: [{ ...card, active: false, deleted: true, revision: 1 }, amex] } }).render();
  assert.deepEqual(texts(byName(deletedRoot, 'CardLifecycleNote')[0].rendered!), ['Tarjeta eliminada',
    'Sus compras y pagos siguen en Movimientos y en sus reportes. No se edita ni acepta movimientos nuevos.']);
  assert.equal(nodes(deletedRoot).some(node => node.type === 'ActionButton'), false);
  assert.equal(byName(harness('card/[id].tsx', { params: { id: 'card' } }).render(), 'CardLifecycleNote').length, 0, 'an active card shows no state line');
  const english = harness('card/[id].tsx', { params: { id: 'card' }, locale: 'en-US', data: { ...withPlans, cards: [{ ...card, active: false, revision: 1 }, amex] } }).render();
  assert.deepEqual(texts(byName(english, 'CardLifecycleNote')[0].rendered!), ['Archived card',
    'It still takes payments and records its installments. To use it again, reactivate it in Edit card.']);
});

test('24UX6D: the card detail keeps the snapshot\'s words and order (balance, Vence · Cierra, Disponible with its limit, actions, Cuotas, Movimientos) and never «pagadas»', () => {
  const root = harness('card/[id].tsx', { params: { id: 'card' }, data: withPlans }).render();
  const order = nodes(root).map(node => node.type === 'CardFace' ? 'face' : node.type === 'Money' && node.props.large ? 'balance'
    : node.type === 'Stat' ? 'fact:' + node.props.label : node.type === 'ActionButton' ? 'action:' + node.props.label
    : node.type === 'SectionTitle' ? 'section:' + node.props.children : null).filter((item, index, all) => item && all.indexOf(item) === index);
  assert.deepEqual(order, ['face', 'balance', 'fact:Vence', 'fact:Cierra', 'fact:Disponible', 'action:Registrar compra', 'action:Pagar tarjeta', 'section:Cuotas', 'section:Movimientos']);
  assert.equal(nodes(root).filter(node => node.type === 'Surface').every(node => node.props.grouped === true), true, 'the facts are flat; the plans one grouped list');
  assert.equal(find(root, 'CardFace').props.nameLines, undefined, 'the detail face takes the default two lines for a long name');
  assert.equal(/pagad/i.test(JSON.stringify(texts(root))), false);
});
