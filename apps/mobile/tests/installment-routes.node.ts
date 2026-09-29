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
  remove?: (id: string) => Promise<void>; stacked?: boolean } = {}) {
  const source = readFileSync(new URL('../app/' + file, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  let data = (options.data === undefined ? archive : options.data) as domain.LedgerArchive;
  let locale: AppLocale = options.locale ?? 'es-AR';
  const day = options.day ?? '2026-10-01';
  const i18nProvider = { useI18n: () => bindLocale(locale) };
  const state: unknown[] = [], refs: { current: unknown }[] = [];
  let cursor = 0, refCursor = 0, backs = 0, haptics = 0, uuid = 0;
  const pushed: unknown[] = [], alerts: { title: string; message: string; buttons: any[] }[] = [], updates: domain.EntryChange[] = [], removals: string[] = [];
  const jsx = (type: unknown, props: Record<string, unknown>) => ({ type, props });
  const ledger = { useLedger: () => ({ archive: data, snapshot: data ? domain.snapshotFromArchive(data) : null,
    updateEntry: async (change: domain.EntryChange) => { updates.push(change); },
    removeInstallmentPlan: async (id: string) => { removals.push(id); await options.remove?.(id); } }) };
  const componentNames = ['AccountBadge', 'ActionButton', 'AppText', 'DetailRow', 'EmptyState', 'ErrorMessage', 'GlyphTile', 'IconButton', 'MerchantBadge', 'Money',
    'MovementRow', 'PressFeedback', 'Screen', 'SectionTitle', 'Stat', 'StatRow', 'Surface'];
  // `stacked`: the largest text sizes or an amount too wide for its row (the real rule is in components.tsx).
  const components = { ...Object.fromEntries(componentNames.map(name => [name, name])), toneColors: () => ({ color: '#c00', soft: '#fee' }), useStacked: () => options.stacked ?? false };
  const palette = { isDark: false, text: '#000', secondary: '#666', tertiary: '#999', line: '#ddd', inset: '#eee', expense: '#c00', income: '#080', warning: '#a60', transfer: '#03c', primary: '#2557D6' };
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
    ...both('ui/geometry', geometry),
    ...both('ui/liability-presentation', liabilityPresentation), ...both('ui/installment-presentation', installmentPresentation), ...both('ui/presentation', presentation),
    ...both('ui/budget-presentation', budgetPresentation), ...both('ui/motion', motion), ...both('ui/theme', theme), ...both('ui/category-hues', hues),
    ...both('i18n/format', i18nFormat), ...both('i18n/provider', i18nProvider),
    // What the real card-panel.tsx and card-rows.tsx import from src/ui.
    './components': components, './theme': theme, './card-faces': cardFaces, './liability-presentation': liabilityPresentation, './motion': motion,
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
    pushed, alerts, updates, removals, backs: () => backs, haptics: () => haptics,
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
  assert.equal(nodes(root).find(node => node.type === 'SectionTitle' && node.props.action === 'Ver todo')!.props.caption, 'Este ciclo, desde anteayer · 0 compras · 0 pagos');
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
  assert.ok(texts(root).includes('12 cuotas · Sin interés'));
  const status = nodes(root).find(node => node.type === 'AppText' && text(node) === 'Activo')!;
  assert.equal(status.props.accessibilityLiveRegion, 'polite');
  assert.deepEqual(rowsOf(root), [
    'Tarjeta=Visa Gold', 'Categoría=Hogar', 'Fecha de compra=10 ago 2026 (10 de agosto de 2026)', 'Precio=$ 1.200.000,00 (1200000,00 pesos)',
    'Registradas=2 de 12', 'Ya registrado=$ 200.000,00 (200000,00 pesos)', 'Cuotas futuras=$ 1.000.000,00 (1000000,00 pesos)', 'Restante=$ 1.000.000,00 (1000000,00 pesos)',
  ].map(row => row.replace(/\$ /g, '$' + NBSP)));
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
  // Something recorded already: no action is offered (cancelling is 24T3).
  assert.equal(nodes(root).some(node => node.type === 'ActionButton'), false);
  assert.equal(JSON.stringify(texts(root)).includes('pagad'), false);
});

test('plan detail: an undone instalment counts nowhere, stays pending and opens its movement; a cancelled plan says so and nothing is still to come', () => {
  const [one, two] = recognised(tv, [1, 2]);
  const undone: domain.EntryRecord = { ...two, voided: true, revision: 1, updatedAt: '2026-09-29T12:00:00.000Z' };
  const view = harness('installment/[id].tsx', { params: { id: 'tv' }, data: { ...withPlans, records: [one, undone] } });
  const root = view.render();
  assert.equal(byName(root, 'ScheduleRow').slice(0, 3).map(row => row.props.row.state).join(','), 'recognised,undone,next');
  assert.deepEqual(rowsOf(root).slice(4), ['Registradas=1 de 12', 'Ya registrado=$ 100.000,00 (100000,00 pesos)', 'Cuotas futuras=$ 1.000.000,00 (1000000,00 pesos)',
    'Restante=$ 1.100.000,00 (1100000,00 pesos)', 'Deshecho=$ 100.000,00 (100000,00 pesos)'].map(row => row.replace(/\$ /g, '$' + NBSP)));
  const second = byName(root, 'ScheduleRow')[1].rendered!;
  assert.ok(texts(second).includes('Deshecha'));
  second.props.onPress();
  assert.equal(JSON.stringify(view.pushed.at(-1)), JSON.stringify({ pathname: '/entry/[id]', params: { id: 'inst_tv_002' } }));
  // Cancelled after two instalments: they stay recorded; the rest is cancelled, never «future».
  const cancelled = domain.cancelInstallmentPlan(tv, '2026-09-30T12:00:00.000Z');
  const stopped = harness('installment/[id].tsx', { params: { id: 'tv' }, data: { ...withPlans, installmentPlans: [cancelled, nb, phone] } }).render();
  assert.ok(texts(stopped).includes('Cancelado'));
  assert.equal(byName(stopped, 'ScheduleRow').map(row => row.props.row.state).join(','), 'recognised,recognised' + ',cancelled'.repeat(10));
  const labels = rowsOf(stopped).map(row => row.split('=')[0]);
  assert.equal(labels.includes('Cuotas futuras'), false);
  assert.ok(rowsOf(stopped).includes('Cancelado=$' + NBSP + '1.000.000,00 (1000000,00 pesos)'));
  assert.ok(texts(byName(stopped, 'ScheduleRow')[5].rendered!).includes('Cancelada'));
  assert.equal(nodes(stopped).some(node => node.type === 'ActionButton'), false);
});

test('plan detail with interest: the total financed and the interest are their own figures, each instalment says what interest it includes', () => {
  const root = harness('installment/[id].tsx', { params: { id: 'nb' }, data: withPlans }).render();
  assert.ok(texts(root).includes('3 cuotas · Con interés'));
  assert.equal(find(root, 'Money').props.minor, 90000000, 'the price, never the price plus interest');
  const rows = rowsOf(root);
  assert.ok(rows.includes('Total financiado=$' + NBSP + '990.000,00 (990000,00 pesos)'));
  assert.ok(rows.includes('Interés total=$' + NBSP + '90.000,00 (90000,00 pesos)'));
  // With interest, the figures are named as principal and the interest still to come has its own row, never added in.
  assert.ok(rows.includes('Principal futuro=$' + NBSP + '900.000,00 (900000,00 pesos)'), 'the future principal, interest apart');
  assert.ok(rows.includes('Interés futuro=$' + NBSP + '90.000,00 (90000,00 pesos)'));
  assert.ok(rows.includes('Principal registrado=$' + NBSP + '0,00 (0,00 pesos)'));
  assert.ok(rows.includes('Principal restante=$' + NBSP + '900.000,00 (900000,00 pesos)'));
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
  assert.equal(JSON.stringify([options.gestureEnabled, options.headerBackVisible, find(writing, 'ActionButton').props.busy]), JSON.stringify([false, false, true]));
  find(writing, 'ActionButton').props.onPress();
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
  assert.equal(installmentPresentation.planSummary(nb, withPlans.records).deletable, true);
  assert.equal(installmentPresentation.planSummary(tv, withPlans.records).deletable, false);
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
  assert.ok(texts(root).includes('12 installments · No interest'));
  assert.ok(texts(root).includes('Active'));
  assert.deepEqual(rowsOf(root).map(row => row.split('=')[0]), ['Card', 'Category', 'Purchase date', 'Price', 'Recorded installments', 'Already recorded', 'Future installments', 'Remaining']);
  assert.ok(rowsOf(root).includes('Recorded installments=2 of 12'));
  const rows = byName(root, 'ScheduleRow').map(row => row.rendered!);
  assert.deepEqual(texts(rows[0]), ['Installment 1 of 12', 'Closes Aug 28 · due Sep 5', 'Recorded']);
  assert.equal(rows[2].props.accessibilityLabel, 'Installment 3 of 12, 100000.00 pesos, Next, closes October 28, 2026, due November 5, 2026');
  assert.ok(texts(rows[3]).includes('Upcoming'));
  const deletable = harness('installment/[id].tsx', { params: { id: 'nb' }, data: withPlans, locale: 'en-US' });
  find(deletable.render(), 'ActionButton', 'Delete plan').props.onPress();
  assert.equal(deletable.alerts[0].title, 'Delete this installment plan?');
});

// ---- The movement an instalment recorded ------------------------------------------------------------------------------

test('movement detail of an instalment: «Cuota de tarjeta», a «Cuota 2 de 12» row that opens its plan, and an undo that says the instalment stays pending', async () => {
  const view = harness('entry/[id].tsx', { params: { id: 'inst_tv_002' }, data: withPlans });
  const root = view.render();
  assert.equal(nodes(root).find(node => node.type === 'Stack.Screen')!.props.options.title, 'Cuota de tarjeta');
  assert.deepEqual(rowsOf(root), ['Categoría=Hogar', 'Tarjeta=Visa Gold', 'Cuota=2 de 12', 'Moneda=Pesos argentinos']);
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
  assert.equal(find(interest, 'Money').props.minor, -1000000);
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
