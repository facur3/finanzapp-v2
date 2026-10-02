import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as domain from '@finanzapp/domain';
import * as presentation from '../src/ui/presentation.ts';
import * as operationPresentation from '../src/ui/operation-presentation.ts';
import * as budgetPresentation from '../src/ui/budget-presentation.ts';
import * as liabilityPresentation from '../src/ui/liability-presentation.ts';
import * as installmentPresentation from '../src/ui/installment-presentation.ts';
import * as moneyInput from '../src/ui/money-input.ts';
import * as entryPrefill from '../src/ui/entry-prefill.ts';
import * as purchasePlan from '../src/ui/purchase-plan.ts';
import * as movementAmount from '../src/ui/movement-amount.ts';
import * as i18nFormat from '../src/i18n/format.ts';
import { bindLocale } from '../src/i18n/bind.ts';
import type { AppLocale } from '../src/i18n/locale.ts';
import { realModule } from './real-module.ts';

// Producto 24T3: the refund form (`app/new-refund.tsx`), the operation's detail (`app/operation/[id].tsx`), the movement
// detail of a purchase with devoluciones (`app/entry/[id].tsx`), the movement form editing one (`src/ui/entry-form.tsx`)
// and Movimientos deshechos (`app/undone-entries.tsx`), with native hosts replaced by descriptors and the domain, the
// presentation and the undo/restore hook (`src/ui/operation-actions.ts`) running for real. Not a rendered iPhone screen.
// The clock is fixed at 2026-10-02 (noon, local): `new Date()` inside the screens and `todayKey()` both read it.
type Node = { type: string | ((props: any) => Node); props: Record<string, any>; rendered?: Node };
const TODAY = '2026-10-02';
const NOW = new Date(TODAY + 'T12:00:00').getTime();
class FixedDate extends Date {
  constructor(...args: unknown[]) {
    if (args.length) super(...(args as [string]));
    else super(NOW);
  }
  static now() { return NOW; }
}
const clockDomain = { ...domain, todayKey: (date?: Date) => domain.todayKey(date ?? new FixedDate()) };

const T0 = '2026-01-01T12:00:00.000Z';
const at = (date: string) => `${date}T15:00:00.000Z`;
const bank: domain.Account = { id: 'bank', name: 'Banco', currency: 'ARS', openingMinor: 500000, createdAt: T0 };
const wallet: domain.Account = { id: 'wallet', name: 'Billetera', currency: 'ARS', openingMinor: 0, createdAt: T0 };
const cardAccount: domain.Account = { id: 'card-acc', name: 'Visa', currency: 'ARS', openingMinor: 0, createdAt: T0 };
const card: domain.CreditCardProfile = { id: 'card', accountId: cardAccount.id, issuer: 'Banco', last4: '4009', creditLimitMinor: 1000000, closingDay: 20, dueDay: 5,
  active: true, deleted: false, createdAt: T0, revision: 0, updatedAt: T0 };
/** A TV of $ 1.200,00 in 12 × $ 100,00, bought 2026-01-10: its instalments close on the 20th of every month of 2026. */
const tv = domain.newInstallmentPlan({ id: 'tv', card, cardAccount, merchant: 'Electro', category: 'Hogar', purchaseDateISO: '2026-01-10',
  principalMinor: 120000, count: 12, placement: 'current', createdAt: at('2026-01-10') });
const buy: domain.Entry = { id: 'buy', accountId: bank.id, kind: 'expense', amountMinor: 50000, merchant: 'Zara', category: 'Ropa', dateISO: '2026-09-15', createdAt: at('2026-09-15') };
const salary: domain.Entry = { id: 'salary', accountId: bank.id, kind: 'income', amountMinor: 900000, merchant: 'Empresa', category: 'Sueldo', dateISO: '2026-09-01', createdAt: at('2026-09-01') };

const base = (extra: Partial<domain.LedgerArchive> = {}): domain.LedgerArchive => ({ accounts: [bank, wallet, cardAccount], records: [buy, salary].map(domain.initialRecord),
  cards: [card], installmentPlans: [], ...extra });
/** The ledger with the TV's instalments recorded through `through` (the catch-up storage runs on open). */
function withPlan(through: string | null = TODAY): domain.LedgerArchive {
  const archive = base({ installmentPlans: [tv] });
  return through ? { ...archive, records: [...archive.records, ...domain.planCatchUpInserts(archive, tv.id, through)] } : archive;
}
function refundOf(archive: domain.LedgerArchive, id: string, amountMinor: number, dateISO: string): domain.LedgerArchive {
  const op = domain.newEntryRefund(archive, { id, entryId: buy.id, amountMinor, dateISO, todayISO: TODAY, createdAt: at(dateISO) });
  return domain.applyNewOperation(archive, op, TODAY);
}
function undoOf(archive: domain.LedgerArchive, id: string, todayISO = TODAY): domain.LedgerArchive {
  const op = archive.purchaseOperations!.find(item => item.id === id)!;
  return domain.applyOperationChange(archive, domain.makeOperationChange('undo-' + id, op, 'void', at(todayISO)), todayISO).archive;
}

function harness(file: string, options: { data?: domain.LedgerArchive; params?: Record<string, string>; props?: any; locale?: AppLocale;
  addRefund?: (value: domain.EntryRefund | domain.PlanRefund) => Promise<void>; change?: (value: domain.OperationChange) => Promise<void>;
  update?: (value: domain.EntryChange) => Promise<void> } = {}) {
  const source = readFileSync(new URL('../' + file, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const state: unknown[] = [];
  const refs: unknown[] = [];
  let cursor = 0, refCursor = 0, uuid = 0, backs = 0;
  const pushed: any[] = [], alerts: { title: string; message: string; buttons: { text: string; style?: string; onPress?: () => void }[] }[] = [];
  const refunds: (domain.EntryRefund | domain.PlanRefund)[] = [], changes: domain.OperationChange[] = [], updates: domain.EntryChange[] = [];
  let haptics = 0;
  let data = options.data ?? base();
  const locale: AppLocale = options.locale ?? 'es-AR';
  const i18nProvider = { useI18n: () => bindLocale(locale) };
  const jsx = (type: Node['type'], props: Node['props']) => ({ type, props });
  const ledger = { useLedger: () => ({ archive: data, snapshot: domain.snapshotFromArchive(data),
    addRefund: async (value: domain.EntryRefund | domain.PlanRefund) => { refunds.push(value); await options.addRefund?.(value); },
    voidOperation: async (value: domain.OperationChange) => { changes.push(value); await options.change?.(value); },
    restoreOperation: async (value: domain.OperationChange) => { changes.push(value); await options.change?.(value); },
    updateEntry: async (value: domain.EntryChange) => { updates.push(value); await options.update?.(value); },
    addEntry: async () => {}, addInstallmentPlan: async () => {} }) };
  const components = Object.fromEntries(['Screen', 'EmptyState', 'ActionButton', 'AppText', 'AmountField', 'AmountShortcut', 'Choices', 'ErrorMessage', 'Field', 'IconButton',
    'Surface', 'DetailRow', 'Money', 'SectionTitle', 'GlyphTile', 'AccountBadge', 'EntryRow', 'MerchantBadge', 'LifecycleNote'].map(name => [name, name]));
  const look = (s: string) => ({ label: s, storedLabel: s, key: String(s).toLowerCase(), hex: '#3E6FB0', glyph: 'pricetag-outline' });
  const hues = { useCategoryLabel: (s: string) => s, useCategoryLook: look, useCategoryLookOf: () => look, useAccountNameOf: () => (account: domain.Account) => account.name,
    useAccountLook: () => ({ glyph: 'wallet-outline', hex: '#2557D6' }) };
  const theme = { space: { xs: 4, s: 8, m: 12, l: 16, xl: 20, xxl: 24, xxxl: 32 }, useCurrentDay: () => TODAY,
    usePalette: () => ({ text: '#000', income: '#070', expense: '#700', primary: '#2557D6', warning: '#a60', secondary: '#666', tertiary: '#999', background: '#fff' }) };
  /** One module under the three relative spellings the routes and `src/ui` use. */
  const ui = (name: string, value: unknown) => ({ ['./' + name]: value, ['../src/ui/' + name]: value, ['../../src/ui/' + name]: value });
  const modules: Record<string, unknown> = {
    react: { useState: (initial: unknown) => { const i = cursor++; if (!(i in state)) state[i] = typeof initial === 'function' ? (initial as () => unknown)() : initial;
      return [state[i], (next: unknown) => { state[i] = typeof next === 'function' ? (next as (value: unknown) => unknown)(state[i]) : next; }]; },
    useRef: (initial: unknown) => { const i = refCursor++; return refs[i] ??= { current: initial }; }, useMemo: (fn: () => unknown) => fn() },
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'react-native': { View: 'View', Keyboard: { dismiss() {} }, Alert: { alert: (title: string, message: string, buttons: any[]) => alerts.push({ title, message, buttons }) } },
    'expo-router': { Stack: { Screen: 'Stack.Screen' }, useLocalSearchParams: () => options.params ?? {},
      router: { canGoBack: () => true, back: () => { backs++; }, push: (value: unknown) => pushed.push(value), replace: (value: unknown) => pushed.push(value) } },
    'expo-crypto': { randomUUID: () => 'operation-' + (++uuid) },
    'expo-haptics': { NotificationFeedbackType: { Success: 'Success' }, notificationAsync: async () => { haptics++; } },
    '@finanzapp/domain': clockDomain,
    '../storage/LedgerProvider': ledger, '../src/storage/LedgerProvider': ledger, '../../src/storage/LedgerProvider': ledger,
    '../i18n/format': i18nFormat, '../src/i18n/format': i18nFormat, '../i18n/provider': i18nProvider, '../src/i18n/provider': i18nProvider, '../../src/i18n/provider': i18nProvider,
    ...ui('components', components), ...ui('theme', theme), ...ui('category-hues', hues),
    ...ui('presentation', presentation), ...ui('operation-presentation', operationPresentation), ...ui('money-input', moneyInput),
    ...ui('budget-presentation', budgetPresentation), ...ui('liability-presentation', liabilityPresentation), ...ui('installment-presentation', installmentPresentation),
    ...ui('movement-amount', movementAmount), ...ui('entry-prefill', entryPrefill), ...ui('purchase-plan', purchasePlan),
    ...ui('form-controls', { AccountField: 'AccountField', CategoryField: 'CategoryField', DateField: 'DateField', SelectorCard: 'SelectorCard' }),
    ...ui('installment-purchase', { InstallmentPurchase: 'InstallmentPurchase' }), ...ui('entry-list', { EntryList: 'EntryList' }),
  };
  const require = function require(name: string) {
    if (!Object.hasOwn(modules, name)) throw new Error('Unexpected refund route dependency: ' + name);
    return modules[name];
  };
  Object.assign(modules, ui('operation-actions', realModule('src/ui/operation-actions.ts', require)));
  const module = { exports: {} as Record<string, (props: any) => Node> };
  runInNewContext(code, { module, exports: module.exports, Date: FixedDate, Error, require });
  return {
    render: () => {
      cursor = 0; refCursor = 0;
      let node = (module.exports.default ?? module.exports.EntryForm)(options.props ?? {});
      while (typeof node.type === 'function') node = node.type(node.props);
      return node;
    },
    setData: (next: domain.LedgerArchive) => { data = next; },
    pushed, alerts, refunds, changes, updates, backs: () => backs, haptics: () => haptics,
  };
}
function nodes(value: any): Node[] {
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!value.props) return [];
  const own = typeof value.type === 'function' ? nodes(value.rendered ??= value.type(value.props)) : [];
  return [value, ...own, ...nodes(value.props.children), ...nodes(value.props.header), ...nodes(value.props.empty), ...nodes(value.props.action)];
}
function find(root: Node, type: string, label?: string): Node {
  const result = nodes(root).find(node => node.type === type && (label === undefined || node.props.label === label));
  assert.ok(result, 'Missing ' + type + ' ' + (label ?? ''));
  return result;
}
const has = (root: Node, type: string, label?: string) => nodes(root).some(node => node.type === type && (label === undefined || node.props.label === label));
const text = (node: Node) => [node.props.children].flat(Infinity).filter(child => typeof child === 'string' || typeof child === 'number').join('');
const texts = (root: Node) => nodes(root).filter(node => node.type === 'AppText').map(text);
const flush = () => new Promise<void>(resolve => setImmediate(resolve));
const NB = ' ';

// ---- pure ----------------------------------------------------------------------------------------------------------

test('24T3: instalment ranges, the drafts a refusal releases, and the search and type filter of devolución and adelanto lines', () => {
  assert.equal(operationPresentation.numberRanges([11, 7, 8, 9, 3, 5, 6, 9]), '3, 5–9, 11');
  assert.equal(operationPresentation.numberRanges([12]), '12');
  for (const message of [domain.REFUND_OVER_MESSAGE, domain.OPERATION_CHANGED_MESSAGE, domain.PLAN_CALENDAR_MESSAGE, domain.operationGuardMessage('refund-link', 'edit')]) {
    assert.equal(presentation.releasesDraft(message), true, message);
  }
  // An unknown outcome (a refresh that failed after the commit) keeps the submission frozen, and so does «ya existe».
  for (const message of ['Refresh failed after commit', domain.OPERATION_EXISTS_MESSAGE, 'entryForm.saveUnverified']) assert.equal(presentation.releasesDraft(message), false, message);

  const archive = refundOf(base(), 'r1', 20000, TODAY);
  const lines = domain.snapshotFromArchive(archive).entries;
  const ids = (list: domain.Entry[]) => list.map(entry => entry.id).sort().join(',');
  assert.equal(ids(presentation.selectEntries(lines, archive.accounts, 'expense')), 'buy,r1', 'a devolución is listed under Gastos');
  assert.equal(ids(presentation.selectEntries(lines, archive.accounts, 'all')), 'buy,r1,salary');
  assert.equal(ids(presentation.selectEntries(lines, archive.accounts, 'income')), 'salary', 'never under Ingresos');
  assert.equal(ids(presentation.selectEntries(lines, archive.accounts, 'all', 'devolución')), 'r1', 'its kind word finds it');
  assert.equal(ids(presentation.selectEntries(lines, archive.accounts, 'all', 'refund')), 'r1');
  assert.equal(ids(presentation.selectEntries(lines, archive.accounts, 'all', 'zara')), 'buy,r1', 'and its purchase\'s merchant');
});

test('24T3: Movimientos deshechos rows: one per undone operation, a plan devolución without a ledger line included', () => {
  let archive = refundOf(withPlan(), 'r1', 20000, TODAY);
  const plan = domain.newPlanRefund(archive, { id: 'pr1', planId: tv.id, amountMinor: 10000, dateISO: TODAY, todayISO: TODAY, createdAt: at(TODAY) });
  archive = domain.applyNewOperation(archive, plan, TODAY);
  assert.equal(operationPresentation.undoneOperationLines(archive).length, 0, 'nothing undone');
  archive = undoOf(undoOf(archive, 'r1'), 'pr1');
  const lines = operationPresentation.undoneOperationLines(archive);
  assert.equal(JSON.stringify(lines.map(line => [line.id, line.amountMinor, line.merchant, operationPresentation.operationIdOf(line)]).sort()),
    JSON.stringify([['pr1', -10000, 'Electro', 'pr1'], ['r1', -20000, 'Zara', 'r1']]));
});

// ---- the refund form: an ordinary purchase -------------------------------------------------------------------------

test('24T3: «Registrar devolución» of a purchase: the facts, «Total disponible», a preview of exactly what is recorded, the Save echo, one write and close', async () => {
  const view = harness('app/new-refund.tsx', { params: { entryId: buy.id } });
  let root = view.render();
  assert.equal(find(root, 'Stack.Screen').props.options.title, 'Registrar devolución');
  assert.ok(texts(root).includes('Zara'));
  assert.equal(find(root, 'Money').props.minor, 50000, 'the purchase\'s price on top');
  assert.equal(find(root, 'DetailRow', 'Cuenta').props.value, 'Banco');
  const shortcut = find(root, 'AmountShortcut');
  assert.equal(shortcut.props.caption, 'Disponible para devolver: ARS 500,00');
  assert.match(shortcut.props.spokenCaption, /500 pesos|500,00/);
  assert.equal(shortcut.props.label, 'Total disponible');
  const date = find(root, 'DateField');
  assert.equal(JSON.stringify([domain.todayKey(date.props.minimumDate), domain.todayKey(date.props.value)]), JSON.stringify([buy.dateISO, TODAY]), 'from the purchase to today');
  assert.equal(find(root, 'ActionButton').props.disabled, true, 'nothing typed: no Save');
  assert.equal(has(root, 'SectionTitle'), false, 'no preview yet');
  shortcut.props.onPress();
  root = view.render();
  assert.equal(find(root, 'AmountField').props.value, '500', 'the shortcut only fills the field');
  find(root, 'AmountField').props.onChangeText('200');
  root = view.render();
  const sentence = nodes(root).find(node => node.type === 'AppText' && /Se acreditan/.test(text(node)))!;
  assert.equal(text(sentence), `Se acreditan $${NB}200,00 en Banco con fecha 2 de octubre de 2026 y se restan de Ropa en octubre de 2026. No es un ingreso.`);
  assert.ok(sentence.props.accessibilityLabel && !sentence.props.accessibilityLabel.includes('$'), 'VoiceOver hears the spoken amount: ' + sentence.props.accessibilityLabel);
  const save = find(root, 'ActionButton');
  assert.equal(save.props.label, `Registrar devolución${NB}·${NB}$${NB}200,00`);
  assert.match(save.props.spokenLabel, /^Registrar devolución, 200/);
  assert.equal(view.refunds.length, 0, 'typing and previewing write nothing');
  await save.props.onPress();
  assert.equal(view.refunds.length, 1);
  const [refund] = view.refunds;
  assert.equal(JSON.stringify([refund.id, refund.kind, refund.target, refund.accountId, refund.currency, refund.amountMinor, refund.dateISO, refund.voided, refund.revision]),
    JSON.stringify(['operation-1', 'refund', { entryId: 'buy' }, 'bank', 'ARS', 20000, TODAY, false, 0]));
  assert.equal(view.backs(), 1);
  assert.equal(view.haptics(), 1, 'success haptic once');
});

test('24T3: the refund form keeps the submission frozen on an unknown outcome and releases it on a refusal storage decided before writing', async () => {
  let attempts = 0;
  const view = harness('app/new-refund.tsx', { params: { entryId: buy.id }, addRefund: async () => { if (++attempts === 1) throw new Error('Refresh failed after commit'); } });
  find(view.render(), 'AmountField').props.onChangeText('200');
  await find(view.render(), 'ActionButton').props.onPress();
  let root = view.render();
  assert.equal(view.backs(), 0);
  assert.equal(find(root, 'AmountField').props.editable, false, 'frozen while the outcome is unknown');
  assert.equal(find(root, 'ActionButton').props.label, 'Reintentar guardado');
  assert.ok(texts(root).includes('Reintentá: se envía la misma devolución y no se registra dos veces.'));
  // The commit happened: the ledger now holds it; the retry sends the very same devolución (storage's retry is a no-op).
  view.setData(domain.applyNewOperation(base(), view.refunds[0], TODAY));
  await find(view.render(), 'ActionButton').props.onPress();
  assert.equal(JSON.stringify(view.refunds[1]), JSON.stringify(view.refunds[0]));
  assert.equal(view.backs(), 1);

  let refused = true;
  const again = harness('app/new-refund.tsx', { params: { entryId: buy.id }, addRefund: async () => { if (refused) { refused = false; throw new Error(domain.REFUND_OVER_MESSAGE); } } });
  find(again.render(), 'AmountField').props.onChangeText('200');
  await find(again.render(), 'ActionButton').props.onPress();
  root = again.render();
  assert.equal(find(root, 'ErrorMessage').props.message, domain.REFUND_OVER_MESSAGE);
  assert.equal(bindLocale('en-US').errorText(domain.REFUND_OVER_MESSAGE) !== domain.REFUND_OVER_MESSAGE, true, 'the refusal is catalogued in English too');
  assert.equal(find(root, 'AmountField').props.editable, true, 'released: the person reviews the draft');
  assert.notEqual(find(root, 'ActionButton').props.label, 'Reintentar guardado');
  find(root, 'AmountField').props.onChangeText('150');
  await find(again.render(), 'ActionButton').props.onPress();
  assert.equal(JSON.stringify(again.refunds.map(item => [item.id, item.amountMinor])), JSON.stringify([['operation-1', 20000], ['operation-1', 15000]]), 'the same id, built again');
  assert.equal(again.backs(), 1);
});

test('24T3: an amount over what is left is refused live with Save disabled; a purchase returned in full and an income offer no form', () => {
  const view = harness('app/new-refund.tsx', { params: { entryId: buy.id }, data: refundOf(base(), 'r1', 20000, '2026-09-20') });
  let root = view.render();
  assert.equal(find(root, 'AmountShortcut').props.caption, 'Disponible para devolver: ARS 300,00');
  assert.equal(find(root, 'DetailRow', 'Ya devuelto').props.value, `$${NB}200,00`);
  assert.match(find(root, 'DetailRow', 'Ya devuelto').props.spokenValue, /200/);
  find(root, 'AmountField').props.onChangeText('300,01');
  root = view.render();
  assert.equal(find(root, 'ErrorMessage').props.message, domain.REFUND_OVER_MESSAGE);
  assert.equal(find(root, 'ActionButton').props.disabled, true);
  assert.equal(has(root, 'SectionTitle'), false, 'no preview for a draft the domain refuses');

  const full = harness('app/new-refund.tsx', { params: { entryId: buy.id }, data: refundOf(base(), 'r1', 50000, '2026-09-20') }).render();
  assert.equal(JSON.stringify([find(full, 'EmptyState').props.title, has(full, 'AmountField'), has(full, 'ActionButton')]), JSON.stringify(['No queda nada por devolver', false, false]));
  const income = harness('app/new-refund.tsx', { params: { entryId: salary.id } }).render();
  assert.equal(find(income, 'EmptyState').props.title, 'No queda nada por devolver');
  const missing = harness('app/new-refund.tsx', { params: { entryId: 'nope' } }).render();
  assert.equal(find(missing, 'EmptyState').props.title, 'No encontramos esta compra');
  // A deleted account: the domain's reason, no form.
  const gone = harness('app/new-refund.tsx', { params: { entryId: buy.id }, data: { ...base(), accounts: [{ ...bank, deletedAt: at('2026-09-30') }, wallet, cardAccount] } }).render();
  assert.equal(find(gone, 'EmptyState').props.title, 'No se puede registrar una devolución');
  assert.equal(find(gone, 'EmptyState').props.detail, 'La cuenta de esta compra fue eliminada.');
});

// ---- the refund form: an instalment plan ----------------------------------------------------------------------------

test('24T3: a plan devolución previews recognised first (a credit to the card) then the last instalments, on the ledger storage will see', async () => {
  // The ledger as last read before September's closing was recorded: the preview catches the plan up as storage will.
  for (const data of [withPlan(TODAY), withPlan('2026-09-01')]) {
    const view = harness('app/new-refund.tsx', { params: { planId: tv.id }, data });
    let root = view.render();
    assert.equal(find(root, 'DetailRow', 'Tarjeta').props.value, 'Visa');
    assert.equal(find(root, 'Money').props.minor, 120000);
    assert.equal(find(root, 'AmountShortcut').props.caption, 'Hasta ARS 1.200,00: el precio; el interés no se devuelve desde acá');
    assert.equal(domain.todayKey(find(root, 'DateField').props.minimumDate), '2026-09-20', 'not before the last recorded instalment (A6)');
    find(root, 'AmountField').props.onChangeText('1050');
    root = view.render();
    const shown = texts(root);
    assert.ok(shown.includes(`$${NB}900,00 vuelven a Visa con fecha 2 de octubre de 2026 y se restan de Hogar en octubre de 2026. No es un ingreso.`), shown.join(' | '));
    assert.ok(shown.includes(`Las cuotas 11 a 12 bajan $${NB}150,00 en total y no se registran por esa parte.`), shown.join(' | '));
    assert.equal(shown.some(line => /interés de esas cuotas/.test(line)), false, 'no interest to mention');
    await find(root, 'ActionButton').props.onPress();
    const [refund] = view.refunds as domain.PlanRefund[];
    assert.equal(JSON.stringify([refund.target, refund.accountId, refund.amountMinor, refund.creditMinor, refund.reductions]),
      JSON.stringify([{ planId: 'tv' }, 'card-acc', 105000, 90000, [{ number: 11, minor: 5000 }, { number: 12, minor: 10000 }]]));
  }
});

// ---- the operation's detail ------------------------------------------------------------------------------------------

test('24T3: a devolución\'s detail: hero, purchase link, what it records, and an undo confirmed with its outcome; the status updates in place', async () => {
  const data = refundOf(base(), 'r1', 20000, '2026-09-20');
  const view = harness('app/operation/[id].tsx', { params: { id: 'r1' }, data });
  let root = view.render();
  assert.equal(find(root, 'Stack.Screen').props.options.title, 'Devolución');
  assert.equal(JSON.stringify([find(root, 'Money').props.minor, find(root, 'GlyphTile').props.icon]), JSON.stringify([20000, 'arrow-undo-outline']));
  assert.ok(texts(root).includes('Registrada · resta del gasto, no es un ingreso'));
  find(root, 'DetailRow', 'Compra').props.onPress();
  assert.equal(JSON.stringify(view.pushed.pop()), JSON.stringify({ pathname: '/entry/[id]', params: { id: 'buy' } }));
  assert.equal(find(root, 'DetailRow', 'Categoría').props.value, 'Ropa');
  assert.ok(texts(root).includes(`Acredita $${NB}200,00 en Banco y resta del gasto de Ropa en septiembre de 2026. No es un ingreso.`), texts(root).join(' | '));
  find(root, 'ActionButton', 'Deshacer devolución').props.onPress();
  assert.equal(view.alerts[0].title, '¿Deshacer devolución?');
  assert.equal(view.alerts[0].message, `Deja de acreditar $${NB}200,00 en Banco y la compra vuelve a contar entera en Ropa. Podés restaurarla después desde Movimientos deshechos.`);
  view.alerts[0].buttons[0].onPress?.();
  assert.equal(view.changes.length, 0, 'cancelled: nothing sent');
  find(view.render(), 'ActionButton', 'Deshacer devolución').props.onPress();
  view.alerts[1].buttons[1].onPress?.();
  await flush();
  assert.equal(JSON.stringify([view.changes[0].action, view.changes[0].before.id, view.changes[0].after.voided, view.changes[0].after.revision]), JSON.stringify(['void', 'r1', true, 1]));
  assert.equal(view.backs(), 0, 'stays: the status updates in place');
  view.setData(domain.applyOperationChange(data, view.changes[0], TODAY).archive);
  root = view.render();
  assert.ok(texts(root).includes('Deshecha · no cuenta en saldos ni reportes'));
  find(root, 'ActionButton', 'Restaurar devolución').props.onPress();
  assert.equal(view.alerts[2].title, '¿Restaurar devolución?');
  assert.equal(view.alerts[2].message, `Vuelve a acreditar $${NB}200,00 en Banco con fecha 20 de septiembre de 2026.`);
});

test('24T3: an undo whose outcome is unknown keeps the change for «Reintentar cambio»; a restore the domain would refuse shows the reason instead of a button', async () => {
  let attempts = 0;
  const data = refundOf(base(), 'r1', 20000, '2026-09-20');
  const view = harness('app/operation/[id].tsx', { params: { id: 'r1' }, data, change: async () => { if (++attempts === 1) throw new Error('Refresh failed after commit'); } });
  find(view.render(), 'ActionButton', 'Deshacer devolución').props.onPress();
  view.alerts[0].buttons[1].onPress?.();
  await flush();
  const root = view.render();
  assert.equal(find(root, 'ErrorMessage').props.message, 'Refresh failed after commit');
  find(root, 'ActionButton', 'Reintentar cambio').props.onPress();
  await flush();
  assert.equal(view.alerts.length, 1, 'no second confirmation');
  assert.equal(JSON.stringify(view.changes[1]), JSON.stringify(view.changes[0]), 'the same change, resent');

  // Undone, then another devolución took everything that was left: restoring it would exceed the purchase.
  const blocked = refundOf(undoOf(data, 'r1'), 'r2', 50000, '2026-09-25');
  const detail = harness('app/operation/[id].tsx', { params: { id: 'r1' }, data: blocked }).render();
  assert.equal(has(detail, 'ActionButton'), false, 'no dead button');
  const note = find(detail, 'LifecycleNote');
  assert.equal(JSON.stringify([note.props.title, note.props.detail]),
    JSON.stringify(['No se puede restaurar ahora', 'Otra devolución ya usa lo que queda por devolver de esta compra; no se puede restaurar.']));
});

test('24T3: an adelanto\'s detail lists what it brought forward; its undo names the instalments the catch-up records and that it cannot come back', () => {
  // Brought forward on 2026-08-25 (instalments 9 to 12); September's closing has passed since.
  const august = withPlan('2026-08-25');
  const payoff = domain.newPlanPayoff(august, { id: 'p1', planId: tv.id, financing: 'recognised', dateISO: '2026-08-25', todayISO: '2026-08-25', createdAt: at('2026-08-25') });
  const data = domain.applyNewOperation(august, payoff, '2026-08-25');
  const view = harness('app/operation/[id].tsx', { params: { id: 'p1' }, data });
  const root = view.render();
  assert.equal(find(root, 'Stack.Screen').props.options.title, 'Adelanto de cuotas');
  assert.equal(find(root, 'DetailRow', 'Cuotas').props.value, 'Cuotas 9–12');
  assert.equal(find(root, 'DetailRow', 'Precio adelantado').props.value, `$${NB}400,00`);
  find(root, 'DetailRow', 'Plan de cuotas').props.onPress();
  assert.equal(JSON.stringify(view.pushed.pop()), JSON.stringify({ pathname: '/installment/[id]', params: { id: 'tv' } }));
  assert.ok(texts(root).some(line => /Pagar tarjeta/.test(line)), 'the card payment is its own transfer');
  assert.equal(texts(root).some(line => /pagad/i.test(line)), false, 'never «pagada»');
  find(root, 'ActionButton', 'Deshacer adelanto').props.onPress();
  assert.equal(view.alerts[0].title, '¿Deshacer adelanto?');
  assert.equal(view.alerts[0].message, `Las cuotas adelantadas ($${NB}400,00 de precio) vuelven a quedar pendientes y dejan de contar con esta fecha. `
    + `Se registra la cuota 9 en su cierre ($${NB}100,00). Este adelanto no podrá restaurarse.`);
});

// ---- the movement detail of a purchase with devoluciones ------------------------------------------------------------

test('24T3: a purchase lists its devoluciones with «Devuelto … de …», offers «Registrar devolución» while something is left, and is not undone before them', () => {
  const data = refundOf(base(), 'r1', 20000, '2026-09-20');
  const view = harness('app/entry/[id].tsx', { params: { id: buy.id }, data });
  const root = view.render();
  const section = find(root, 'SectionTitle');
  assert.equal(text(section), 'Devoluciones');
  assert.equal(section.props.caption, `Devuelto $${NB}200,00 de $${NB}500,00`);
  assert.ok(section.props.captionLabel && !section.props.captionLabel.includes('$'), section.props.captionLabel);
  const row = nodes(root).find(node => node.type === 'DetailRow' && node.props.icon === 'arrow-undo-outline')!;
  assert.equal(JSON.stringify([row.props.label, row.props.value]), JSON.stringify(['20 de septiembre de 2026', `$${NB}200,00`]), 'the date written out: VoiceOver reads the label first');
  row.props.onPress();
  assert.equal(JSON.stringify(view.pushed.pop()), JSON.stringify({ pathname: '/operation/[id]', params: { id: 'r1' } }));
  find(root, 'ActionButton', 'Registrar devolución').props.onPress();
  assert.equal(JSON.stringify(view.pushed.pop()), JSON.stringify({ pathname: '/new-refund', params: { entryId: 'buy' } }));
  find(root, 'ActionButton', 'Deshacer movimiento').props.onPress();
  assert.equal(JSON.stringify([view.alerts[0].title, view.alerts[0].message, view.alerts[0].buttons.map(button => button.text)]),
    JSON.stringify(['Esta compra tiene devoluciones', 'Para deshacerla, primero deshacé su devolución.', ['Cancelar', 'Ver devoluciones']]));
  view.alerts[0].buttons[1].onPress?.();
  assert.equal(JSON.stringify(view.pushed.pop()), JSON.stringify({ pathname: '/operation/[id]', params: { id: 'r1' } }));
  assert.equal(view.updates.length, 0, 'nothing built or sent');

  const full = harness('app/entry/[id].tsx', { params: { id: buy.id }, data: refundOf(base(), 'r1', 50000, '2026-09-20') }).render();
  assert.equal(has(full, 'ActionButton', 'Registrar devolución'), false, 'returned in full: no dead button');
  const plain = harness('app/entry/[id].tsx', { params: { id: buy.id } }).render();
  assert.equal(JSON.stringify([has(plain, 'ActionButton', 'Registrar devolución'), has(plain, 'SectionTitle')]), JSON.stringify([true, false]));
  const income = harness('app/entry/[id].tsx', { params: { id: salary.id } }).render();
  assert.equal(has(income, 'ActionButton', 'Registrar devolución'), false, 'an income is never refunded');
  const english = harness('app/entry/[id].tsx', { params: { id: buy.id }, data, locale: 'en-US' }).render();
  assert.equal(find(english, 'SectionTitle').props.caption, `Refunded AR$${NB}200.00 of AR$${NB}500.00`);
  assert.ok(has(english, 'ActionButton', 'Record refund'));
});

// ---- the movement form editing a purchase with devoluciones ------------------------------------------------------------

test('24T3: editing a purchase with devoluciones: an expense on its account, not below what was returned, not after the first devolución', async () => {
  let refuse = false;
  const data = refundOf(base(), 'r1', 20000, '2026-09-20');
  const original = data.records.find(record => record.entry.id === buy.id)!;
  const view = harness('src/ui/entry-form.tsx', { props: { original }, data, update: async () => { if (refuse) throw new Error(domain.operationGuardMessage('refund-cap', 'edit')); } });
  let root = view.render();
  assert.equal(find(root, 'Choices').props.disabled, true, 'it stays an expense');
  assert.equal(JSON.stringify(find(root, 'AccountField').props.accounts.map((account: domain.Account) => account.id)), JSON.stringify(['bank']), 'on its own account');
  assert.equal(domain.todayKey(find(root, 'DateField').props.maximumDate), '2026-09-20');
  const note = nodes(root).find(node => node.type === 'AppText' && /devoluciones por/.test(text(node)))!;
  assert.match(text(note), new RegExp(`devoluciones por \\$${NB}200,00`));
  assert.ok(!note.props.accessibilityLabel.includes('$'));
  find(root, 'AmountField').props.onChangeText('199,99');
  await find(view.render(), 'ActionButton').props.onPress();
  root = view.render();
  assert.equal(find(root, 'ErrorMessage').props.message, 'operations.edit.belowRefunded');
  assert.equal(bindLocale('es-AR').errorText('operations.edit.belowRefunded'), 'El monto no puede ser menor que lo ya devuelto de esta compra.');
  assert.equal(view.updates.length, 0);
  find(root, 'AmountField').props.onChangeText('300');
  refuse = true;
  await find(view.render(), 'ActionButton').props.onPress();
  root = view.render();
  assert.equal(view.updates.length, 1);
  assert.equal(find(root, 'AmountField').props.editable, true, 'a refusal storage decided before writing releases the draft');
  refuse = false;
  await find(root, 'ActionButton').props.onPress();
  assert.equal(JSON.stringify([view.updates[1].id, view.updates[1].after.entry.amountMinor]), JSON.stringify([view.updates[0].id, 30000]), 'the same change id');
  assert.equal(view.backs(), 1);
});

test('24T3: the income preset «Reembolsos» points to «Registrar devolución»; other categories say nothing', () => {
  const view = harness('src/ui/entry-form.tsx', { props: { kind: 'income' } });
  find(view.render(), 'CategoryField').props.onChange('Reembolsos');
  const field = find(view.render(), 'CategoryField');
  assert.equal(field.props.detail, '¿Te devolvieron una compra? Registrala desde la compra con «Registrar devolución»: no es un ingreso.');
  assert.equal(field.props.spokenDetail, field.props.detail);
  find(view.render(), 'CategoryField').props.onChange('Sueldo');
  assert.equal(find(view.render(), 'CategoryField').props.detail, undefined);
});

// ---- Movimientos deshechos ----------------------------------------------------------------------------------------------

test('24T3: Movimientos deshechos lists an undone devolución with «Restaurar» when it can come back, and the reason when it cannot', async () => {
  const undone = undoOf(refundOf(base(), 'r1', 20000, '2026-09-20'), 'r1');
  const view = harness('app/undone-entries.tsx', { data: undone });
  const list = view.render();
  assert.equal(list.type, 'EntryList');
  assert.equal(list.props.empty, undefined, 'something to restore: no «Nada para recuperar»');
  const header = list.props.header as Node;
  assert.equal(text(find(header, 'SectionTitle')), 'Devoluciones y adelantos');
  const row = find(header, 'EntryRow');
  assert.equal(JSON.stringify([row.props.entry.id, row.props.entry.amountMinor, row.props.entry.refund.operationId, row.props.account.id]), JSON.stringify(['r1', -20000, 'r1', 'bank']));
  find(header, 'ActionButton', 'Restaurar').props.onPress();
  assert.equal(view.alerts[0].title, '¿Restaurar devolución?');
  view.alerts[0].buttons[1].onPress?.();
  await flush();
  assert.equal(JSON.stringify([view.changes[0].action, view.changes[0].before.id]), JSON.stringify(['restore', 'r1']));

  const blocked = harness('app/undone-entries.tsx', { data: refundOf(undone, 'r2', 50000, '2026-09-25') }).render();
  const blockedHeader = blocked.props.header as Node;
  assert.equal(has(blockedHeader, 'ActionButton'), false);
  assert.ok(texts(blockedHeader).includes('Otra devolución ya usa lo que queda por devolver de esta compra; no se puede restaurar.'));
});

// ---- verifier additions -----------------------------------------------------------------------------------------------

test('24T3 (verify): a plan with interest: the tail sentence, «el interés sigue» and A17\'s «financing continues» when no price is left', async () => {
  const tvi = domain.newInstallmentPlan({ id: 'tvi', card, cardAccount, merchant: 'Electro', category: 'Hogar', purchaseDateISO: '2026-01-10',
    principalMinor: 120000, count: 12, placement: 'current', interestMinor: 12000, interestCategory: 'Intereses', createdAt: at('2026-01-10') });
  const archive = base({ installmentPlans: [tvi] });
  const data = { ...archive, records: [...archive.records, ...domain.planCatchUpInserts(archive, tvi.id, TODAY)] };
  const view = harness('app/new-refund.tsx', { params: { planId: tvi.id }, data });
  let root = view.render();
  assert.equal(find(root, 'AmountShortcut').props.caption, 'Hasta ARS 1.200,00: el precio; el interés no se devuelve desde acá', 'principal only');
  find(root, 'AmountShortcut').props.onPress();
  root = view.render();
  const shown = texts(root);
  assert.ok(shown.includes(`$${NB}900,00 vuelven a Visa con fecha 2 de octubre de 2026 y se restan de Hogar en octubre de 2026. No es un ingreso.`), shown.join(' | '));
  assert.ok(shown.includes(`Las cuotas 10 a 12 bajan $${NB}300,00 en total y no se registran por esa parte.`), shown.join(' | '));
  assert.ok(shown.includes('El interés de esas cuotas sigue como estaba.'));
  assert.ok(shown.some(line => /^No queda precio por registrar/.test(line)), 'A17: the financing continues, said before Save');
  const save = find(root, 'ActionButton');
  assert.equal(save.props.label, `Registrar devolución${NB}·${NB}$${NB}1.200,00`);
  await save.props.onPress();
  const [refund] = view.refunds as domain.PlanRefund[];
  assert.equal(JSON.stringify([refund.creditMinor, refund.reductions]),
    JSON.stringify([90000, [{ number: 10, minor: 10000 }, { number: 11, minor: 10000 }, { number: 12, minor: 10000 }]]), 'exactly what the preview said');
  // What storage commits from that submission equals the preview (A13): applying it to the same ledger is accepted as is.
  const committed = domain.applyNewOperation(data, refund, TODAY);
  assert.equal(committed.purchaseOperations!.length, 1);
});

test('24T3 (verify): a live plan devolución whose reduced instalment was recorded since offers no undo; the reason is shown instead', () => {
  // Recorded on 2026-08-25 (instalments 1–8 recognised): $ 1.150 = $ 800 back to the card, 12 to 10 down to zero and 9 down by $ 50.
  const august = withPlan('2026-08-25');
  const op = domain.newPlanRefund(august, { id: 'pr', planId: tv.id, amountMinor: 115000, dateISO: '2026-08-25', todayISO: '2026-08-25', createdAt: at('2026-08-25') });
  assert.equal(JSON.stringify([op.creditMinor, op.reductions[0]]), JSON.stringify([80000, { number: 9, minor: 5000 }]));
  let data = domain.applyNewOperation(august, op, '2026-08-25');
  // September's closing recorded instalment 9 at what was left of it ($ 50).
  data = { ...data, records: [...data.records, ...domain.planCatchUpInserts(data, tv.id, TODAY)] };
  const view = harness('app/operation/[id].tsx', { params: { id: 'pr' }, data });
  const root = view.render();
  assert.equal(has(root, 'ActionButton'), false, 'no dead «Deshacer devolución»');
  const note = find(root, 'LifecycleNote');
  assert.equal(note.props.title, 'No se puede deshacer ahora');
  assert.equal(note.props.detail, bindLocale('es-AR').errorText(domain.operationGuardMessage('refund-recorded', 'void')), 'the domain\'s reason');
  assert.equal(JSON.stringify(nodes(root).filter(node => node.type === 'DetailRow' && /^Cuota /.test(node.props.label)).map(node => node.props.label)),
    JSON.stringify(['Cuota 9', 'Cuota 10', 'Cuota 11', 'Cuota 12']), 'each reduced instalment listed');
  assert.equal(view.alerts.length + view.changes.length, 0);
});

test('24T3 (verify): two devoluciones: the plural block, «Ver devoluciones» opens the newest; a card purchase names its card', () => {
  const data = refundOf(refundOf(base(), 'r1', 10000, '2026-09-18'), 'r2', 5000, '2026-09-25');
  const view = harness('app/entry/[id].tsx', { params: { id: buy.id }, data });
  const root = view.render();
  assert.equal(find(root, 'SectionTitle').props.caption, `Devuelto $${NB}150,00 de $${NB}500,00`);
  assert.equal(JSON.stringify(nodes(root).filter(node => node.type === 'DetailRow' && node.props.icon === 'arrow-undo-outline').map(node => node.props.value)),
    JSON.stringify([`$${NB}50,00`, `$${NB}100,00`]), 'newest first');
  find(root, 'ActionButton', 'Deshacer movimiento').props.onPress();
  assert.equal(view.alerts[0].message, 'Para deshacerla, primero deshacé sus 2 devoluciones; están en su detalle.');
  view.alerts[0].buttons[1].onPress?.();
  assert.equal(JSON.stringify(view.pushed.pop()), JSON.stringify({ pathname: '/operation/[id]', params: { id: 'r2' } }));
  assert.equal(view.updates.length, 0);

  const cardBuy: domain.Entry = { id: 'card-buy', accountId: cardAccount.id, kind: 'expense', amountMinor: 30000, merchant: 'Librería', category: 'Ocio', dateISO: '2026-09-28', createdAt: at('2026-09-28') };
  const form = harness('app/new-refund.tsx', { params: { entryId: cardBuy.id }, data: { ...base(), records: [...base().records, domain.initialRecord(cardBuy)] } }).render();
  assert.equal(JSON.stringify([find(form, 'DetailRow', 'Tarjeta').props.value, has(form, 'DetailRow', 'Cuenta')]), JSON.stringify(['Visa', false]));
});

test('24T3 (verify): editing a purchase with a devolución to a date after it is refused before anything is sent', async () => {
  const data = refundOf(base(), 'r1', 20000, '2026-09-20');
  const original = data.records.find(record => record.entry.id === buy.id)!;
  const view = harness('src/ui/entry-form.tsx', { props: { original }, data });
  find(view.render(), 'DateField').props.onChange(new FixedDate('2026-09-22T12:00:00'));
  await find(view.render(), 'ActionButton').props.onPress();
  const root = view.render();
  assert.equal(find(root, 'ErrorMessage').props.message, 'operations.edit.afterRefund');
  assert.equal(bindLocale('en-US').errorText('operations.edit.afterRefund'), 'The date cannot be after the first refund of this purchase.');
  assert.equal(view.updates.length, 0);
  assert.equal(find(root, 'AmountField').props.editable, true, 'nothing frozen: the person fixes the date');
});

test('24T3 (verify): Movimientos deshechos draws an undone adelanto as its price line, opening the adelanto', () => {
  const august = withPlan('2026-08-25');
  const payoff = domain.newPlanPayoff(august, { id: 'p1', planId: tv.id, financing: 'recognised', dateISO: '2026-08-25', todayISO: '2026-08-25', createdAt: at('2026-08-25') });
  const undone = undoOf(domain.applyNewOperation(august, payoff, '2026-08-25'), 'p1');
  const lines = operationPresentation.undoneOperationLines(undone);
  assert.equal(JSON.stringify(lines.map(line => [line.id, line.amountMinor, line.category, line.payoff?.component, operationPresentation.operationIdOf(line)])),
    JSON.stringify([['p1_p', 40000, 'Hogar', 'principal', 'p1']]));
  // Undone after September's closing recorded instalment 9: it cannot come back, and the row says why instead of «Restaurar».
  const header = harness('app/undone-entries.tsx', { data: undone }).render().props.header as Node;
  assert.equal(find(header, 'EntryRow').props.entry.id, 'p1_p');
  assert.equal(has(header, 'ActionButton'), false);
  assert.equal(texts(header).some(line => line.length > 10 && line !== 'Devoluciones y adelantos'), true);
});
