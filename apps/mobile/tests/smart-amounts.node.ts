import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as domain from '@finanzapp/domain';
import * as presentation from '../src/ui/presentation.ts';
import * as liabilityPresentation from '../src/ui/liability-presentation.ts';
import * as moneyInput from '../src/ui/money-input.ts';
import * as i18nFormat from '../src/i18n/format.ts';
import { bindLocale } from '../src/i18n/bind.ts';
const i18nProvider = { useI18n: () => bindLocale('es-AR') };

// Producto 18 smart amount shortcuts on the actual transfer form: Usar todo,
// Pagar total, Saldar total and Cobrar total only fill the amount field from
// the recorded figures; saving stays explicit. Native hosts are descriptors;
// this is not a rendered iOS form.
type Node = { type: string | ((props: any) => Node); props: Record<string, any> };
const createdAt = '2026-01-01T12:00:00Z';
const ars: domain.Account = { id: 'a', name: 'Flor', currency: 'ARS', openingMinor: 20000000, createdAt };
const other: domain.Account = { id: 'b', name: 'Efectivo', currency: 'ARS', openingMinor: 5000, createdAt };
const usd: domain.Account = { id: 'u', name: 'Dólares', currency: 'USD', openingMinor: 123450, createdAt };
const empty: domain.Account = { id: 'z', name: 'Vacía', currency: 'ARS', openingMinor: 0, createdAt };
const overdrawn: domain.Account = { id: 'n', name: 'En rojo', currency: 'ARS', openingMinor: -50000, createdAt };
const expense: domain.Entry = { id: 'e', accountId: 'a', kind: 'expense', amountMinor: 983800, merchant: 'Super', category: 'Supermercado', dateISO: '2026-01-02', createdAt };
const cardAccount: domain.Account = { id: 'card-acc', name: 'Visa', currency: 'ARS', openingMinor: -5000, createdAt };
const debtAccount: domain.Account = { id: 'debt-acc', name: 'Debo · Juan', currency: 'ARS', openingMinor: -7000, createdAt };
const receivableAccount: domain.Account = { id: 'rec-acc', name: 'Me debe · Ana', currency: 'ARS', openingMinor: 4000, createdAt };
const card: domain.CreditCardProfile = { id: 'card', accountId: cardAccount.id, issuer: 'Banco', last4: '1234', creditLimitMinor: null,
  closingDay: 28, dueDay: 5, active: true, createdAt, revision: 0, updatedAt: createdAt };
const debt: domain.PersonalDebtProfile = { id: 'debt', accountId: debtAccount.id, direction: 'owed_by_me', counterparty: 'Juan', dueDateISO: null,
  note: '', active: true, deleted: false, createdAt, revision: 0, updatedAt: createdAt };
const receivable: domain.PersonalDebtProfile = { ...debt, id: 'receivable', accountId: receivableAccount.id, direction: 'owed_to_me', counterparty: 'Ana' };
const archive: domain.LedgerArchive = { accounts: [ars, other, usd, empty, overdrawn, cardAccount, debtAccount, receivableAccount],
  records: [domain.initialRecord(expense)], cards: [card], debts: [debt, receivable] };

function harness(props: any = {}, data: domain.LedgerArchive = archive, options: { addTransfer?: () => Promise<void> } = {}) {
  const source = readFileSync(new URL('../src/ui/transfer-form.tsx', import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const state: any[] = [], refs: any[] = [];
  let cursor = 0, refCursor = 0, uuid = 0;
  const transfers: domain.Transfer[] = [], changes: domain.TransferChange[] = [], entries: domain.Entry[] = [];
  const jsx = (type: Node['type'], props: Node['props']) => ({ type, props });
  const ledger = { useLedger: () => ({ archive: data, snapshot: domain.snapshotFromArchive(data),
    addEntry: async (value: domain.Entry) => { entries.push(value); },
    addTransfer: async (value: domain.Transfer) => { transfers.push(value); await options.addTransfer?.(); },
    updateTransfer: async (value: domain.TransferChange) => { changes.push(value); } }) };
  const components = Object.fromEntries(['Screen', 'EmptyState', 'ActionButton', 'AppText', 'AmountField', 'AmountShortcut', 'ErrorMessage', 'Field', 'IconButton',
    'Surface', 'DetailRow'].map(name => [name, name]));
  const modules: Record<string, unknown> = {
    '../i18n/format': i18nFormat, '../src/i18n/format': i18nFormat, '../../src/i18n/format': i18nFormat, '../i18n/provider': i18nProvider, '../src/i18n/provider': i18nProvider, '../../src/i18n/provider': i18nProvider,
    react: { useState: (initial: any) => { const i = cursor++; if (!(i in state)) state[i] = typeof initial === 'function' ? initial() : initial;
      return [state[i], (next: any) => { state[i] = typeof next === 'function' ? next(state[i]) : next; }]; },
    useRef: (initial: any) => { const i = refCursor++; return refs[i] ??= { current: initial }; } },
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'react-native': { View: 'View', Keyboard: { dismiss() {} } },
    'expo-router': { Stack: { Screen: 'Stack.Screen' }, router: { canGoBack: () => true, back: () => {}, push: () => {}, replace: () => {} } },
    'expo-crypto': { randomUUID: () => 'operation-' + (++uuid) },
    'expo-haptics': { NotificationFeedbackType: { Success: 'Success' }, notificationAsync: async () => {} },
    '@finanzapp/domain': domain,
    '../storage/LedgerProvider': ledger,
    './components': components,
    './form-controls': { AccountField: 'AccountField', DateField: 'DateField', SelectorCard: 'SelectorCard' },
    './presentation': presentation, './liability-presentation': liabilityPresentation,
    './money-input': moneyInput,
    './theme': { space: { xs: 4, s: 8, m: 12, l: 16, xl: 20, xxl: 24, xxxl: 32 }, usePalette: () => ({ primary: '#2557D6' }) },
  };
  const module = { exports: {} as Record<string, (props: any) => Node> };
  runInNewContext(code, { module, exports: module.exports, Date, Error, require: (name: string) => {
    if (!Object.hasOwn(modules, name)) throw new Error('Unexpected transfer dependency: ' + name);
    return modules[name];
  } });
  return { render: () => { cursor = 0; refCursor = 0; return module.exports.TransferForm(props); }, transfers, changes, entries };
}
function nodes(value: any): Node[] {
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!value.props) return [];
  return [value, ...nodes(value.props.children), ...nodes(value.props.action)];
}
function find(root: Node, type: string, label?: string): Node {
  const result = nodes(root).find(node => node.type === type && (!label || node.props.label === label));
  assert.ok(result, 'Missing ' + type + ' ' + (label ?? ''));
  return result;
}
const shortcut = (root: Node) => find(root, 'AmountShortcut').props;
const amount = (root: Node) => find(root, 'AmountField').props;

test('Usar todo fills the complete positive recorded balance of the source account in ARS, without submitting', async () => {
  const view = harness({ accountId: 'a' });
  let root = view.render();
  assert.equal(find(root, 'AccountField', 'Desde').props.value, 'a');
  // 200.000,00 opening − 9.838,00 expense = 190.162,00 recorded, shown clearly beside the action.
  assert.equal(shortcut(root).caption, 'Saldo registrado: ARS 190.162,00');
  assert.equal(shortcut(root).label, 'Usar todo');
  assert.equal(amount(root).value, '');
  shortcut(root).onPress();
  root = view.render();
  assert.equal(amount(root).value, '190.162', 'the canonical display string, as if typed');
  assert.equal(domain.parseMinorUnits(amount(root).value), 19016200);
  assert.equal(view.transfers.length, 0, 'filling never saves');
  assert.equal(view.entries.length, 0);
  // The person still reviews and confirms; the value can also be edited downward.
  find(root, 'AccountField', 'Hacia').props.onChange('b');
  root = view.render();
  assert.equal(find(root, 'DetailRow', 'Flor después').props.value, 'ARS\u00A00,00');
  await find(root, 'ActionButton', 'Registrar transferencia').props.onPress();
  assert.equal(view.transfers.length, 1);
  assert.deepEqual([view.transfers[0].fromAccountId, view.transfers[0].toAccountId, view.transfers[0].amountMinor], ['a', 'b', 19016200]);
  assert.equal(view.entries.length, 0, 'a transfer is never an expense or income');
});

test('changing the source account recalculates what "all" means and respects USD', () => {
  const view = harness({ accountId: 'a' });
  shortcut(view.render()).onPress();
  assert.equal(amount(view.render()).value, '190.162');
  find(view.render(), 'AccountField', 'Desde').props.onChange('u');
  let root = view.render();
  assert.equal(amount(root).currency, 'USD');
  assert.equal(shortcut(root).caption, 'Saldo registrado: USD 1.234,50');
  shortcut(root).onPress();
  root = view.render();
  assert.equal(amount(root).value, '1.234,50');
  assert.equal(domain.parseMinorUnits(amount(root).value), 123450);
  find(root, 'AccountField', 'Desde').props.onChange('b');
  root = view.render();
  assert.equal(shortcut(root).caption, 'Saldo registrado: ARS 50,00');
  shortcut(root).onPress();
  assert.equal(amount(view.render()).value, '50');
});

test('a zero or negative recorded balance shows the figure but offers no "all"', () => {
  let root = harness({ accountId: 'z' }).render();
  assert.equal(shortcut(root).caption, 'Saldo registrado: ARS 0,00');
  assert.equal(shortcut(root).label, undefined);
  assert.equal(shortcut(root).onPress, undefined);
  root = harness({ accountId: 'n' }).render();
  assert.equal(shortcut(root).caption, 'Saldo registrado: ARS -500,00');
  assert.equal(shortcut(root).label, undefined);
  assert.equal(shortcut(root).onPress, undefined);
});

test('Pagar total fills the recorded card debt, never more than the registered debt, and the payment stays a transfer', async () => {
  const view = harness({ toAccountId: 'card-acc', title: 'Pagar tarjeta', defaultNote: 'Pago Visa', maxAmountMinor: '5000' });
  let root = view.render();
  assert.equal(shortcut(root).caption, 'Deuda registrada: ARS 50,00');
  assert.equal(shortcut(root).label, 'Pagar total');
  shortcut(root).onPress();
  root = view.render();
  assert.equal(amount(root).value, '50');
  assert.equal(view.transfers.length, 0, 'filling never saves');
  // Editing upward past the debt is still refused on submit; downward is allowed.
  amount(root).onChangeText('60');
  await find(view.render(), 'ActionButton', 'Registrar pago').props.onPress();
  // The form stores the catalogue key; ErrorMessage shows it in the interface language.
  assert.equal(find(view.render(), 'ErrorMessage').props.message, 'transferForm.overCardDebt');
  assert.match(bindLocale('es-AR').errorText('transferForm.overCardDebt'), /supera la deuda/);
  assert.equal(view.transfers.length, 0);
  amount(view.render()).onChangeText('50');
  await find(view.render(), 'ActionButton', 'Registrar pago').props.onPress();
  assert.equal(view.transfers.length, 1);
  assert.deepEqual([view.transfers[0].fromAccountId, view.transfers[0].toAccountId, view.transfers[0].amountMinor], ['a', 'card-acc', 5000]);
  assert.equal(view.entries.length, 0, 'a card payment never posts a second expense');
});

test('Pagar total is bounded by both the live recorded debt and the caller cap', () => {
  // A stale, larger cap cannot raise the fill above the debt recorded right now.
  const stale = harness({ toAccountId: 'card-acc', maxAmountMinor: '9000' });
  let root = stale.render();
  assert.equal(shortcut(root).caption, 'Deuda registrada: ARS 50,00');
  shortcut(root).onPress();
  assert.equal(amount(stale.render()).value, '50', 'the live debt bounds the fill');
  const capped = harness({ toAccountId: 'card-acc', maxAmountMinor: '3000' });
  shortcut(capped.render()).onPress();
  assert.equal(amount(capped.render()).value, '30', 'a smaller cap bounds the fill');
  // A card in credit (no debt) offers nothing to pay.
  const credit = harness({ toAccountId: 'card-acc' }, { ...archive, accounts: archive.accounts.map(a => a.id === 'card-acc' ? { ...a, openingMinor: 2500 } : a) });
  root = credit.render();
  assert.equal(shortcut(root).caption, 'A favor: ARS 25,00');
  assert.equal(shortcut(root).label, undefined);
});

test('Saldar total fills the pending amount I owe and records one capped payment', async () => {
  const view = harness({ toAccountId: 'debt-acc', title: 'Registrar pago', defaultNote: 'Pago a Juan', maxAmountMinor: '7000' });
  let root = view.render();
  assert.equal(shortcut(root).caption, 'Pendiente: ARS 70,00');
  assert.equal(shortcut(root).label, 'Saldar total');
  shortcut(root).onPress();
  shortcut(view.render()).onPress(); // Pressing twice only fills again.
  root = view.render();
  assert.equal(amount(root).value, '70');
  assert.equal(view.transfers.length, 0);
  await find(root, 'ActionButton', 'Registrar pago').props.onPress();
  assert.equal(view.transfers.length, 1, 'one save, one record');
  assert.deepEqual([view.transfers[0].fromAccountId, view.transfers[0].toAccountId, view.transfers[0].amountMinor, view.transfers[0].id], ['a', 'debt-acc', 7000, 'operation-1']);
  assert.equal(view.entries.length, 0);
});

test('Cobrar total fills what they owe me and records one collection into cash', async () => {
  const view = harness({ fromAccountId: 'rec-acc', title: 'Registrar cobro', defaultNote: 'Cobro de Ana', maxAmountMinor: '4000' });
  let root = view.render();
  assert.equal(shortcut(root).caption, 'Pendiente: ARS 40,00');
  assert.equal(shortcut(root).label, 'Cobrar total');
  shortcut(root).onPress();
  root = view.render();
  assert.equal(amount(root).value, '40');
  assert.equal(find(root, 'AccountField', 'Hacia').props.value, 'a');
  await find(root, 'ActionButton', 'Registrar cobro').props.onPress();
  assert.equal(view.transfers.length, 1);
  assert.deepEqual([view.transfers[0].fromAccountId, view.transfers[0].toAccountId, view.transfers[0].amountMinor], ['rec-acc', 'a', 4000]);
  assert.equal(view.entries.length, 0, 'a collection is never income');
});

test('while editing a transfer, "all" excludes the effect of the transfer being edited', () => {
  const original = domain.initialTransferRecord({ id: 't', fromAccountId: 'a', toAccountId: 'b', amountMinor: 1000000, note: '', dateISO: '2026-01-03', createdAt });
  const view = harness({ original }, { ...archive, transfers: [original] });
  const root = view.render();
  assert.equal(amount(root).value, '10.000,00');
  assert.equal(shortcut(root).caption, 'Saldo registrado: ARS 190.162,00', 'the balance before this transfer');
  shortcut(root).onPress();
  assert.equal(amount(view.render()).value, '190.162');
  assert.equal(view.changes.length, 0);
});

test('a failed save keeps the same submission for retry and the shortcut cannot change it', async () => {
  let attempts = 0;
  const view = harness({ accountId: 'a' }, archive, { addTransfer: async () => { if (++attempts === 1) throw new Error('disco lleno'); } });
  shortcut(view.render()).onPress();
  find(view.render(), 'AccountField', 'Hacia').props.onChange('b');
  await find(view.render(), 'ActionButton', 'Registrar transferencia').props.onPress();
  let root = view.render();
  assert.equal(find(root, 'ErrorMessage').props.message, 'disco lleno');
  assert.equal(shortcut(root).disabled, true, 'locked until the same command is retried');
  assert.equal(amount(root).editable, false);
  await find(root, 'ActionButton', 'Reintentar guardado').props.onPress();
  assert.equal(view.transfers.length, 2, 'both attempts carried the same record');
  assert.equal(view.transfers[0].id, view.transfers[1].id, 'one operation ID, so storage can dedupe');
  assert.equal(view.transfers[1].amountMinor, 19016200);
});

test('24UX4: Saldar from a debt row opens the payment with the whole balance already typed; editing it is a new amount; a card is never prefilled', async () => {
  const view = harness({ toAccountId: 'debt-acc', maxAmountMinor: '7000', amountMinor: '7000' });
  let root = view.render();
  assert.equal(amount(root).value, '70,00', 'the outstanding 70,00 is in the field');
  assert.equal(view.transfers.length, 0, 'nothing is recorded until the person confirms');
  await find(root, 'ActionButton', 'Registrar pago').props.onPress();
  assert.deepEqual([view.transfers[0].toAccountId, view.transfers[0].amountMinor], ['debt-acc', 7000]);
  // The person may pay less: the typed text wins over the prefill.
  const partial = harness({ toAccountId: 'debt-acc', maxAmountMinor: '7000', amountMinor: '7000' });
  amount(partial.render()).onChangeText('25');
  await find(partial.render(), 'ActionButton', 'Registrar pago').props.onPress();
  assert.equal(partial.transfers[0].amountMinor, 2500);
  // A collection is prefilled the same way; a card payment or a malformed request starts empty.
  assert.equal(amount(harness({ fromAccountId: 'rec-acc', maxAmountMinor: '4000', amountMinor: '4000' }).render()).value, '40,00');
  assert.equal(amount(harness({ toAccountId: 'card-acc', maxAmountMinor: '5000', amountMinor: '5000' }).render()).value, '');
  assert.equal(amount(harness({ toAccountId: 'debt-acc', amountMinor: '70.5' }).render()).value, '');
  assert.equal(amount(harness({ toAccountId: 'debt-acc', amountMinor: '0' }).render()).value, '');
});
