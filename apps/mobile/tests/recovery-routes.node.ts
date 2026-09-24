import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as currencies from '../src/ui/currencies.ts';
import * as domain from '@finanzapp/domain';
import * as presentation from '../src/ui/presentation.ts';
import * as budgetPresentation from '../src/ui/budget-presentation.ts';
import * as liabilityPresentation from '../src/ui/liability-presentation.ts';
import * as moneyInput from '../src/ui/money-input.ts';
import * as appearance from '../src/ui/appearance.ts';
import * as i18nFormat from '../src/i18n/format.ts';
import { bindLocale } from '../src/i18n/bind.ts';
import type { AppLocale } from '../src/i18n/locale.ts';

// Actual screen/form handlers with native hosts replaced by descriptors.
// This does not render UIKit, the Files picker, animation frames or gestures.
type Node = { type: string | ((props: any) => Node); props: Record<string, any> };
const createdAt = '2026-01-01T12:00:00Z';
const account: domain.Account = { id: 'a', name: 'Prueba ARS', currency: 'ARS', openingMinor: 100000, createdAt };
const entry: domain.Entry = { id: 'e', accountId: 'a', kind: 'expense', amountMinor: 12345, merchant: 'Prueba', category: 'Salud', dateISO: '2026-01-01', createdAt };
const archive: domain.LedgerArchive = { accounts: [account, { ...account, id: 'u', currency: 'USD' }], records: [domain.initialRecord(entry)] };

function harness(file: string, props: any = {}, options: { data?: domain.LedgerArchive; params?: any;
  add?: (value: domain.Entry) => Promise<void>; update?: (value: domain.EntryChange) => Promise<void>;
  addTransfer?: (value: domain.Transfer) => Promise<void>; updateTransfer?: (value: domain.TransferChange) => Promise<void>;
  updateAccount?: (value: domain.AccountChange) => Promise<void>; addAccount?: (value: domain.Account) => Promise<void>;
  restore?: (value: domain.LedgerArchive, baseline: string) => Promise<void>; picker?: () => Promise<any>; locale?: AppLocale } = {}) {
  const source = readFileSync(new URL('../' + file, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const state: any[] = [];
  const refs: any[] = [];
  let cursor = 0, refCursor = 0, uuid = 0, backs = 0;
  const pushed: any[] = [], alerts: any[] = [], updates: domain.EntryChange[] = [], additions: domain.Entry[] = [], restores: any[] = [];
  const transfers: domain.Transfer[] = [], transferChanges: domain.TransferChange[] = [], accountChanges: domain.AccountChange[] = [], newAccounts: domain.Account[] = [];
  let data = options.data ?? archive;
  // The locale is read on every render, like the live provider: switching it re-labels the next render and keeps the state.
  let locale: AppLocale = options.locale ?? 'es-AR';
  const i18nProvider = { useI18n: () => bindLocale(locale) };
  const jsx = (type: Node['type'], props: Node['props']) => ({ type, props });
  const ledger = { useLedger: () => ({ archive: data, snapshot: domain.snapshotFromArchive(data),
    addEntry: async (value: domain.Entry) => { additions.push(value); await options.add?.(value); },
    updateEntry: async (value: domain.EntryChange) => { updates.push(value); await options.update?.(value); },
    addTransfer: async (value: domain.Transfer) => { transfers.push(value); await options.addTransfer?.(value); },
    updateTransfer: async (value: domain.TransferChange) => { transferChanges.push(value); await options.updateTransfer?.(value); },
    updateAccount: async (value: domain.AccountChange) => { accountChanges.push(value); await options.updateAccount?.(value); },
    addAccount: async (value: domain.Account) => { newAccounts.push(value); await options.addAccount?.(value); },
    restoreBackup: async (value: domain.LedgerArchive, baseline: string) => { restores.push({ value, baseline }); await options.restore?.(value, baseline); },
  }) };
  const components = Object.fromEntries(['Screen', 'EmptyState', 'ActionButton', 'AppText', 'AmountField', 'AmountShortcut', 'Choices', 'ErrorMessage', 'Field', 'FieldNote', 'IconButton', 'Surface',
    'CategoryBadge', 'DetailRow', 'Money', 'SectionTitle', 'GlyphTile', 'AccountBadge'].map(name => [name, name]));
  const modules: Record<string, unknown> = {
    '../i18n/format': i18nFormat, '../src/i18n/format': i18nFormat, '../../src/i18n/format': i18nFormat, '../i18n/provider': i18nProvider, '../src/i18n/provider': i18nProvider, '../../src/i18n/provider': i18nProvider,
    react: { useState: (initial: any) => { const i = cursor++; if (!(i in state)) state[i] = typeof initial === 'function' ? initial() : initial;
      return [state[i], (next: any) => { state[i] = typeof next === 'function' ? next(state[i]) : next; }]; },
    useRef: (initial: any) => { const i = refCursor++; return refs[i] ??= { current: initial }; }, useMemo: (fn: () => any) => fn() },
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'react-native': { View: 'View', Keyboard: { dismiss() {} }, Alert: { alert: (title: string, message: string, buttons: any[]) => alerts.push({ title, message, buttons }) } },
    'expo-router': { Stack: { Screen: 'Stack.Screen' }, useLocalSearchParams: () => options.params ?? {},
      router: { canGoBack: () => true, back: () => { backs++; }, push: (value: any) => pushed.push(value), replace: (value: any) => pushed.push(value) } },
    'expo-crypto': { randomUUID: () => 'operation-' + (++uuid) },
    'expo-haptics': { NotificationFeedbackType: { Success: 'Success' }, notificationAsync: async () => {} },
    'expo-file-system': { File: { pickFileAsync: options.picker ?? (async () => ({ canceled: true })) } },
    '@finanzapp/domain': domain,
    '@expo/vector-icons/Ionicons': 'Ionicons',
    '../storage/LedgerProvider': ledger, '../src/storage/LedgerProvider': ledger, '../../src/storage/LedgerProvider': ledger,
    './components': components, '../src/ui/components': components, '../../src/ui/components': components,
    './form-controls': { AccountField: 'AccountField', CategoryField: 'CategoryField', CurrencyField: 'CurrencyField', DateField: 'DateField', SelectorCard: 'SelectorCard' },
    '../src/ui/form-controls': { CurrencyField: 'CurrencyField' }, '../../src/ui/form-controls': { CurrencyField: 'CurrencyField' },
    '../src/ui/currencies': currencies, '../../src/ui/currencies': currencies,
    './presentation': presentation,
    './budget-presentation': budgetPresentation, '../../src/ui/budget-presentation': budgetPresentation,
    './money-input': moneyInput,
    './liability-presentation': liabilityPresentation,
    '../../src/ui/theme': { space: { xs: 4, s: 8, m: 12, l: 16, xl: 20, xxl: 24, xxxl: 32 },
      usePalette: () => ({ text: '#000', positive: '#070', income: '#070', expense: '#700', primary: '#2557D6', warning: '#a60', secondary: '#666', tertiary: '#999' }) },
    './theme': { space: { xs: 4, s: 8, m: 12, l: 16, xl: 20, xxl: 24, xxxl: 32 }, usePalette: () => ({ background: '#fff' }) },
    './entry-form': { EntryForm: 'EntryForm' }, './transfer-form': { TransferForm: 'TransferForm' },
    './motion': { ValueTransition: 'ValueTransition' },
    './category-hues': { useCategoryColor: () => '#3E6FB0', useCategoryLabel: (s: string) => s, useCategoryDefinitions: () => [], useCategoryLook: (s: string) => ({ label: s, storedLabel: s, key: String(s).toLowerCase(), hex: '#3E6FB0', glyph: 'pricetag-outline' }), useCategoryLookOf: () => (s: string) => ({ label: s, storedLabel: s, key: String(s).toLowerCase(), hex: '#3E6FB0', glyph: 'pricetag-outline' }), useAccountLook: () => ({ icon: 'wallet', color: 'cobalt', glyph: 'wallet-outline', hex: '#2557D6' }), useAccountNameOf: () => (account: any) => account.name, useAccountLookOf: () => () => ({ icon: 'wallet', color: 'cobalt', glyph: 'wallet-outline', hex: '#2557D6' }) }, '../src/ui/category-hues': { useCategoryColor: () => '#3E6FB0', useCategoryLabel: (s: string) => s, useCategoryDefinitions: () => [], useCategoryLook: (s: string) => ({ label: s, storedLabel: s, key: String(s).toLowerCase(), hex: '#3E6FB0', glyph: 'pricetag-outline' }), useCategoryLookOf: () => (s: string) => ({ label: s, storedLabel: s, key: String(s).toLowerCase(), hex: '#3E6FB0', glyph: 'pricetag-outline' }), useAccountLook: () => ({ icon: 'wallet', color: 'cobalt', glyph: 'wallet-outline', hex: '#2557D6' }), useAccountNameOf: () => (account: any) => account.name, useAccountLookOf: () => () => ({ icon: 'wallet', color: 'cobalt', glyph: 'wallet-outline', hex: '#2557D6' }) }, '../../src/ui/category-hues': { useCategoryColor: () => '#3E6FB0', useCategoryLabel: (s: string) => s, useCategoryDefinitions: () => [], useCategoryLook: (s: string) => ({ label: s, storedLabel: s, key: String(s).toLowerCase(), hex: '#3E6FB0', glyph: 'pricetag-outline' }), useCategoryLookOf: () => (s: string) => ({ label: s, storedLabel: s, key: String(s).toLowerCase(), hex: '#3E6FB0', glyph: 'pricetag-outline' }), useAccountLook: () => ({ icon: 'wallet', color: 'cobalt', glyph: 'wallet-outline', hex: '#2557D6' }), useAccountNameOf: () => (account: any) => account.name, useAccountLookOf: () => () => ({ icon: 'wallet', color: 'cobalt', glyph: 'wallet-outline', hex: '#2557D6' }) },
    '../src/ui/appearance': appearance, '../../src/ui/appearance': appearance,
    '../src/ui/appearance-picker': { IconColorPicker: 'IconColorPicker' }, '../../src/ui/appearance-picker': { IconColorPicker: 'IconColorPicker' },
  };
  const module = { exports: {} as Record<string, (props: any) => Node> };
  runInNewContext(code, { module, exports: module.exports, Date, Error, require: (name: string) => {
    if (!Object.hasOwn(modules, name)) throw new Error('Unexpected recovery dependency: ' + name);
    return modules[name];
  } });
  return {
    render: () => { cursor = 0; refCursor = 0; let node = (module.exports.default ?? module.exports.EntryForm ?? module.exports.TransferForm ?? module.exports.MovementForm)(props);
      while (typeof node.type === 'function') node = node.type(node.props);
      return node; },
    setData: (next: domain.LedgerArchive) => { data = next; },
    setLocale: (next: AppLocale) => { locale = next; },
    pushed, alerts, updates, additions, restores, transfers, transferChanges, accountChanges, newAccounts, backs: () => backs,
  };
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
const flush = () => new Promise<void>(resolve => setImmediate(resolve));

test('edit form prefills every field, keeps currency and submits the same identity/revision', async () => {
  const view = harness('src/ui/entry-form.tsx', { original: archive.records[0] });
  let root = view.render();
  assert.equal(find(root, 'AmountField').props.value, '123,45');
  assert.equal(find(root, 'Field').props.value, 'Prueba');
  assert.equal(find(root, 'CategoryField').props.value, 'Salud');
  assert.deepEqual(find(root, 'AccountField').props.accounts.map((a: domain.Account) => a.id), ['a']);
  assert.equal(domain.todayKey(find(root, 'DateField').props.value), entry.dateISO);
  find(root, 'AmountField').props.onChangeText('98,76');
  find(root, 'Choices').props.onChange('income');
  find(root, 'CategoryField').props.onChange('Regalo');
  root = view.render();
  await find(root, 'ActionButton', 'Guardar cambios').props.onPress();
  assert.equal(view.updates.length, 1);
  assert.equal(view.additions.length, 0);
  assert.equal(view.updates[0].before.revision, 0);
  assert.equal(view.updates[0].after.entry.id, entry.id);
  assert.equal(view.updates[0].after.entry.amountMinor, 9876);
  assert.equal(view.updates[0].after.entry.category, 'Regalo');
  assert.equal(view.backs(), 1);
});
test('cancel and unchanged save close without writing; invalid input preserves the editable draft', async () => {
  const view = harness('src/ui/entry-form.tsx', { original: archive.records[0] });
  find(view.render(), 'Stack.Screen').props.options.headerLeft().props.onPress();
  assert.equal(view.updates.length, 0);
  await find(view.render(), 'ActionButton').props.onPress();
  assert.equal(view.updates.length, 0);
  find(view.render(), 'AmountField').props.onChangeText('12abc');
  await find(view.render(), 'ActionButton').props.onPress();
  assert.ok(find(view.render(), 'ErrorMessage').props.message);
  assert.equal(find(view.render(), 'AmountField').props.value, '12abc');
  assert.equal(find(view.render(), 'AmountField').props.editable, true);
});
test('while saving neither a double tap nor closing posts twice or closes before durable completion', async () => {
  let finish!: () => void;
  const view = harness('src/ui/entry-form.tsx', { original: archive.records[0] }, { update: () => new Promise<void>(resolve => { finish = resolve; }) });
  find(view.render(), 'AmountField').props.onChangeText('1');
  const root = view.render();
  const saving = find(root, 'ActionButton').props.onPress();
  await find(root, 'ActionButton').props.onPress();
  find(view.render(), 'Stack.Screen').props.options.headerLeft().props.onPress();
  assert.equal(view.backs(), 0);
  assert.equal(view.updates.length, 1);
  finish();
  await saving;
  assert.equal(view.backs(), 1);
});
test('refresh failure keeps a frozen exact submission for retry, even after the record version changes', async () => {
  let attempts = 0;
  const view = harness('src/ui/entry-form.tsx', { original: archive.records[0] }, { update: async () => { if (++attempts === 1) throw new Error('Refresh failed after commit'); } });
  find(view.render(), 'AmountField').props.onChangeText('1');
  await find(view.render(), 'ActionButton').props.onPress();
  assert.equal(view.backs(), 0);
  assert.equal(find(view.render(), 'AmountField').props.editable, false);
  view.setData({ ...archive, records: [view.updates[0].after] });
  await find(view.render(), 'ActionButton', 'Reintentar guardado').props.onPress();
  assert.deepEqual(view.updates[0], view.updates[1]);
  assert.equal(view.backs(), 1);
});
test('new-entry mode keeps income/account selection and creates no edit command', async () => {
  const view = harness('src/ui/entry-form.tsx', { kind: 'income', currency: 'USD' });
  let root = view.render();
  assert.equal(find(root, 'AccountField').props.value, 'u');
  find(root, 'AmountField').props.onChangeText('0,01');
  find(root, 'Field').props.onChangeText('Ingreso');
  find(root, 'CategoryField').props.onChange('Otros');
  root = view.render();
  await find(root, 'ActionButton').props.onPress();
  assert.equal(view.additions[0].kind, 'income');
  assert.equal(view.additions[0].amountMinor, 1);
  assert.equal(view.additions[0].accountId, 'u');
  assert.equal(view.updates.length, 0);
});
test('detail opens the native edit route; undo requires confirmation and canceled undo does nothing', async () => {
  const view = harness('app/entry/[id].tsx', {}, { params: { id: entry.id } });
  find(view.render(), 'ActionButton', 'Editar movimiento').props.onPress();
  assert.equal(view.pushed[0].pathname, '/edit-entry/[id]');
  assert.equal(view.pushed[0].params.id, entry.id);
  find(view.render(), 'ActionButton', 'Deshacer movimiento').props.onPress();
  assert.equal(view.updates.length, 0);
  assert.match(view.alerts[0].message, /Se sumarán 123,45 ARS a Prueba ARS/);
  view.alerts[0].buttons[0].onPress();
  assert.equal(view.updates.length, 0);
  find(view.render(), 'ActionButton', 'Deshacer movimiento').props.onPress();
  view.alerts[1].buttons[1].onPress();
  await flush();
  assert.equal(view.updates[0].action, 'void');
  assert.equal(view.backs(), 0); // Status updates in place; no redirect through a tab.
  view.setData({ ...archive, records: [view.updates[0].after] });
  assert.equal(nodes(view.render()).some(node => node.props.label === 'Editar movimiento'), false);
  find(view.render(), 'ActionButton', 'Recuperar movimiento').props.onPress();
  assert.match(view.alerts[2].message, /Se descontarán/);
  view.alerts[2].buttons[1].onPress();
  await flush();
  assert.equal(view.updates[1].action, 'restore');
});

test('choosing/canceling the file picker and invalid backups never mutate the ledger', async () => {
  for (const picker of [async () => ({ canceled: true }), async () => ({ canceled: false, result: { size: 4, name: 'invalid.json', text: async () => '{}' } })]) {
    const view = harness('app/backup-import.tsx', {}, { picker });
    await find(view.render(), 'ActionButton', 'Elegir copia').props.onPress();
    assert.equal(view.restores.length, 0);
    assert.equal(nodes(view.render()).some(node => node.props.label === 'Confirmar importación'), false);
  }
});
test('oversized files are rejected before reading their content', async () => {
  let reads = 0;
  const view = harness('app/backup-import.tsx', {}, { picker: async () => ({ canceled: false,
    result: { size: domain.BACKUP_MAX_BYTES + 1, text: async () => { reads++; return '{}'; } } }) });
  await find(view.render(), 'ActionButton', 'Elegir copia').props.onPress();
  assert.equal(reads, 0);
  const message = find(view.render(), 'ErrorMessage').props.message;
  assert.equal(message, 'backup.import.tooLarge');
  assert.match(bindLocale('es-AR').errorText(message), /^La copia supera 5 MB/);
});
test('backup preview shows exact totals, cancel stays read-only, confirm waits for storage', async () => {
  const json = JSON.stringify(domain.createRecoveryBackup(archive));
  const view = harness('app/backup-import.tsx', {}, { data: { accounts: [], records: [] },
    picker: async () => ({ canceled: false, result: { size: json.length, name: 'test.json', text: async () => json } }) });
  await find(view.render(), 'ActionButton', 'Elegir copia').props.onPress();
  assert.equal(find(view.render(), 'Money').props.minor, 87655);
  assert.equal(view.restores.length, 0);
  find(view.render(), 'ActionButton', 'Confirmar importación').props.onPress();
  view.alerts[0].buttons[0].onPress();
  assert.equal(view.restores.length, 0);
  find(view.render(), 'ActionButton', 'Confirmar importación').props.onPress();
  view.alerts[1].buttons[1].onPress();
  await flush();
  assert.equal(view.restores.length, 1);
  assert.equal(view.restores[0].baseline, domain.archiveKey({ accounts: [], records: [] }));
  assert.equal(find(view.render(), 'EmptyState').props.title, 'Copia incorporada');
});
test('identical or conflicting backups cannot show an enabled import action', async () => {
  const json = JSON.stringify(domain.createRecoveryBackup(archive));
  for (const data of [archive, { ...archive, records: [domain.makeEntryChange('undo', archive.records[0], 'void', createdAt).after] }]) {
    const view = harness('app/backup-import.tsx', {}, { data,
      picker: async () => ({ canceled: false, result: { size: json.length, name: 'test.json', text: async () => json } }) });
    await find(view.render(), 'ActionButton', 'Elegir copia').props.onPress();
    assert.equal(nodes(view.render()).some(node => node.props.label === 'Confirmar importación'), false);
    assert.equal(view.restores.length, 0);
  }
});

const destination: domain.Account = { ...account, id: 'b', name: 'Destino', openingMinor: 0 };
const transfer: domain.Transfer = { id: 'transfer', fromAccountId: 'a', toAccountId: 'b', amountMinor: 1000, note: '', dateISO: entry.dateISO, createdAt };
const transferData: domain.LedgerArchive = { ...archive, accounts: [...archive.accounts, destination] };
function fillTransfer(view: ReturnType<typeof harness>) {
  find(view.render(), 'AmountField').props.onChangeText('10');
  find(view.render(), 'AccountField', 'Hacia').props.onChange('b');
}
test('transfer form previews exact two-account balances and only offers same-currency destinations', async () => {
  const view = harness('src/ui/transfer-form.tsx', { accountId: 'a' }, { data: transferData });
  assert.deepEqual(find(view.render(), 'AccountField', 'Hacia').props.accounts.map((a: domain.Account) => a.id), ['b']);
  fillTransfer(view);
  const root = view.render();
  assert.equal(find(root, 'DetailRow', 'Prueba ARS después').props.value, 'ARS\u00A0866,55');
  assert.equal(find(root, 'DetailRow', 'Destino después').props.value, 'ARS\u00A010,00');
  await find(root, 'ActionButton', 'Registrar transferencia').props.onPress();
  assert.equal(view.transfers.length, 1);
  assert.equal(view.transfers[0].amountMinor, 1000);
  assert.equal(view.transfers[0].fromAccountId, 'a');
  assert.equal(view.transfers[0].toAccountId, 'b');
  assert.equal(view.additions.length, 0);
  assert.equal(view.backs(), 1);
});
test('changing transfer source clears an incompatible target; validation keeps invalid drafts editable', async () => {
  const view = harness('src/ui/transfer-form.tsx', { accountId: 'a' }, { data: transferData });
  fillTransfer(view);
  find(view.render(), 'AccountField', 'Desde').props.onChange('u');
  assert.equal(find(view.render(), 'AccountField', 'Hacia').props.value, '');
  assert.equal(find(view.render(), 'AmountField').props.currency, 'USD');
  assert.equal(find(view.render(), 'EmptyState').props.title, 'Falta otra cuenta en esta moneda');
  find(view.render(), 'AccountField', 'Desde').props.onChange('a');
  find(view.render(), 'AccountField', 'Hacia').props.onChange('b');
  find(view.render(), 'AmountField').props.onChangeText('12abc');
  await find(view.render(), 'ActionButton', 'Registrar transferencia').props.onPress();
  assert.ok(find(view.render(), 'ErrorMessage').props.message);
  assert.equal(find(view.render(), 'AmountField').props.editable, true);
  assert.equal(view.transfers.length, 0);
});
test('a transfer submission freezes across failed refresh and ignores duplicate taps while saving', async () => {
  let finish!: () => void, attempts = 0;
  const view = harness('src/ui/transfer-form.tsx', { accountId: 'a' }, { data: transferData, addTransfer: async () => {
    if (++attempts === 1) { await new Promise<void>(resolve => { finish = resolve; }); throw new Error('Refresh failed'); }
  } });
  fillTransfer(view);
  const root = view.render();
  const saving = find(root, 'ActionButton').props.onPress();
  await find(root, 'ActionButton').props.onPress();
  find(view.render(), 'Stack.Screen').props.options.headerLeft().props.onPress();
  assert.equal(view.transfers.length, 1);
  assert.equal(view.backs(), 0);
  finish(); await saving;
  assert.equal(find(view.render(), 'AmountField').props.editable, false);
  view.setData({ ...transferData, transfers: [domain.initialTransferRecord(view.transfers[0])] });
  await find(view.render(), 'ActionButton', 'Reintentar guardado').props.onPress();
  assert.deepEqual(view.transfers[0], view.transfers[1]);
  assert.equal(view.backs(), 1);
});
test('editing a transfer removes its previous effect in preview and retains its identity', async () => {
  const original = domain.initialTransferRecord(transfer);
  const view = harness('src/ui/transfer-form.tsx', { original }, { data: { ...transferData, transfers: [original] } });
  assert.equal(find(view.render(), 'AmountField').props.value, '10,00');
  find(view.render(), 'AmountField').props.onChangeText('20');
  assert.equal(find(view.render(), 'DetailRow', 'Prueba ARS después').props.value, 'ARS\u00A0856,55');
  await find(view.render(), 'ActionButton', 'Guardar cambios').props.onPress();
  assert.equal(view.transferChanges.length, 1);
  assert.equal(view.transferChanges[0].after.transfer.id, transfer.id);
  assert.equal(view.transferChanges[0].after.revision, 1);
  assert.equal(view.transfers.length, 0);
});
test('transfer undo requires confirmation, affects both sides, and updates detail without redirecting', async () => {
  const original = domain.initialTransferRecord(transfer);
  const view = harness('app/transfer/[id].tsx', {}, { data: { ...transferData, transfers: [original] }, params: { id: transfer.id } });
  find(view.render(), 'ActionButton', 'Deshacer transferencia').props.onPress();
  assert.match(view.alerts[0].message, /Destino/);
  assert.match(view.alerts[0].message, /Prueba ARS/);
  view.alerts[0].buttons[0].onPress();
  assert.equal(view.transferChanges.length, 0);
  find(view.render(), 'ActionButton', 'Deshacer transferencia').props.onPress();
  view.alerts[1].buttons[1].onPress(); await flush();
  view.setData({ ...transferData, transfers: [view.transferChanges[0].after] });
  assert.equal(find(view.render(), 'ActionButton', 'Recuperar transferencia').props.disabled, undefined);
  assert.equal(view.backs(), 0);
  assert.equal(view.pushed.length, 0);
});
test('account correction prefills actual available balance and waits for explicit confirmation', async () => {
  const data = { ...transferData, transfers: [domain.initialTransferRecord(transfer)] };
  const view = harness('app/edit-account/[id].tsx', {}, { data, params: { id: 'a' } });
  assert.equal(find(view.render(), 'AmountField').props.value, '866,55');
  find(view.render(), 'AmountField').props.onChangeText('500');
  find(view.render(), 'ActionButton').props.onPress();
  assert.equal(view.accountChanges.length, 0);
  view.alerts[0].buttons[0].onPress();
  assert.equal(view.accountChanges.length, 0);
  find(view.render(), 'ActionButton').props.onPress();
  view.alerts[1].buttons[1].onPress(); await flush();
  assert.equal(view.accountChanges.length, 1);
  assert.equal(view.accountChanges[0].after.openingMinor, 63345);
  assert.equal(view.accountChanges[0].expectedBalanceMinor, 86655);
  assert.equal(view.backs(), 1);
});
test('account rename does not change its balance; unchanged save and close never write', async () => {
  const view = harness('app/edit-account/[id].tsx', {}, { data: transferData, params: { id: 'a' } });
  find(view.render(), 'ActionButton').props.onPress();
  assert.equal(view.accountChanges.length, 0);
  find(view.render(), 'Field').props.onChangeText('Renombrada');
  find(view.render(), 'ActionButton').props.onPress(); await flush();
  assert.equal(view.alerts.length, 0);
  assert.equal(view.accountChanges[0].expectedBalanceMinor, null);
  assert.equal(view.accountChanges[0].after.openingMinor, account.openingMinor);
});
test('new account retry is frozen and honors requested USD currency', async () => {
  let attempts = 0;
  const view = harness('app/new-account.tsx', {}, { params: { currency: 'USD' }, addAccount: async () => { if (++attempts === 1) throw new Error('Refresh failed'); } });
  assert.equal(find(view.render(), 'CurrencyField').props.value, 'USD', 'the requested currency is preselected in the currency row');
  find(view.render(), 'Field').props.onChangeText('Nueva');
  find(view.render(), 'AmountField').props.onChangeText('100');
  await find(view.render(), 'ActionButton').props.onPress();
  assert.equal(find(view.render(), 'Field').props.editable, false);
  await find(view.render(), 'ActionButton', 'Reintentar guardado').props.onPress();
  assert.deepEqual(view.newAccounts[0], view.newAccounts[1]);
  assert.equal(view.backs(), 1);
});
test('a backup containing only a new transfer still offers import with correct counts', async () => {
  const json = JSON.stringify(domain.createRecoveryBackup({ ...transferData, transfers: [domain.initialTransferRecord(transfer)] }));
  const view = harness('app/backup-import.tsx', {}, { data: transferData,
    picker: async () => ({ canceled: false, result: { size: json.length, name: 'test.json', text: async () => json } }) });
  await find(view.render(), 'ActionButton', 'Elegir copia').props.onPress();
  assert.equal(find(view.render(), 'DetailRow', 'Transferencias nuevas').props.value, '1');
  assert.ok(find(view.render(), 'ActionButton', 'Confirmar importación'));
});

test('starting without a bank balance creates a zero tracking baseline, not an income', async () => {
  const view = harness('app/new-account.tsx');
  find(view.render(), 'Field').props.onChangeText('Mi registro');
  assert.equal(find(view.render(), 'ActionButton').props.disabled, false);
  await find(view.render(), 'ActionButton').props.onPress();
  assert.equal(view.newAccounts[0].openingMinor, 0);
  assert.equal(view.additions.length, 0);
});

const cardAccount: domain.Account = { ...account, id: 'card-acc', name: 'Visa', openingMinor: -5000 };
const debtAccount: domain.Account = { ...account, id: 'debt-acc', name: 'Debo · Juan', openingMinor: -7000 };
const card: domain.CreditCardProfile = { id: 'card', accountId: cardAccount.id, issuer: 'Banco', last4: '1234', creditLimitMinor: null,
  closingDay: 28, dueDay: 5, active: true, createdAt, revision: 0, updatedAt: createdAt };
const debt: domain.PersonalDebtProfile = { id: 'debt', accountId: debtAccount.id, direction: 'owed_by_me', counterparty: 'Juan', dueDateISO: null,
  note: '', active: true, createdAt, revision: 0, updatedAt: createdAt };
const liabilityData: domain.LedgerArchive = { ...archive, accounts: [...archive.accounts, cardAccount, debtAccount], cards: [card], debts: [debt] };

test('card payment locks the card as destination, caps at the recorded debt and never becomes an expense', async () => {
  const view = harness('src/ui/transfer-form.tsx', { toAccountId: 'card-acc', title: 'Pagar tarjeta', defaultNote: 'Pago Visa', maxAmountMinor: '5000' }, { data: liabilityData });
  let root = view.render();
  assert.equal(nodes(root).some(node => node.type === 'AccountField' && node.props.label === 'Hacia'), false);
  assert.equal(find(root, 'SelectorCard', 'Tarjeta').props.value, 'Visa');
  assert.equal(find(root, 'SelectorCard', 'Tarjeta').props.detail, 'ARS Deuda 50,00');
  assert.equal(find(root, 'AccountField', 'Desde').props.value, 'a');
  assert.deepEqual(find(root, 'AccountField', 'Desde').props.accounts.map((item: domain.Account) => item.id), ['a']);
  assert.equal(find(root, 'Field').props.value, 'Pago Visa');
  find(root, 'AmountField').props.onChangeText('60');
  root = view.render();
  await find(root, 'ActionButton', 'Registrar pago').props.onPress();
  // The form stores the catalogue key; ErrorMessage shows it in the interface language.
  assert.equal(find(view.render(), 'ErrorMessage').props.message, 'transferForm.overCardDebt');
  assert.match(bindLocale('es-AR').errorText('transferForm.overCardDebt'), /supera la deuda/);
  assert.equal(view.transfers.length, 0);
  find(view.render(), 'AmountField').props.onChangeText('50');
  root = view.render();
  assert.equal(find(root, 'DetailRow', 'Visa después').props.value, 'ARS\u00A0A favor 0,00');
  await find(root, 'ActionButton', 'Registrar pago').props.onPress();
  assert.equal(view.transfers.length, 1);
  assert.deepEqual([view.transfers[0].fromAccountId, view.transfers[0].toAccountId, view.transfers[0].amountMinor, view.transfers[0].note], ['a', 'card-acc', 5000, 'Pago Visa']);
  assert.equal(view.additions.length, 0);
});

test('a card payment, debt payment and collection name themselves and write the default note in the active language', async () => {
  const receivableAccount: domain.Account = { ...account, id: 'rec-acc', name: 'Me deben · Ana', openingMinor: 4000 };
  const receivable: domain.PersonalDebtProfile = { ...debt, id: 'rec', accountId: receivableAccount.id, direction: 'owed_to_me', counterparty: 'Ana' };
  const data = { ...liabilityData, accounts: [...liabilityData.accounts, receivableAccount], debts: [debt, receivable] };
  const title = (root: Node) => nodes(root).find(node => node.type === 'Stack.Screen')!.props.options.title;
  const cases = [
    [{ toAccountId: 'card-acc', maxAmountMinor: '5000' }, 'Pagar tarjeta', 'Pago Visa', 'Pay card', 'Visa payment'],
    [{ toAccountId: 'debt-acc', maxAmountMinor: '7000' }, 'Registrar pago', 'Pago a Juan', 'Record payment', 'Payment to Juan'],
    [{ fromAccountId: 'rec-acc', maxAmountMinor: '4000' }, 'Registrar cobro', 'Cobro de Ana', 'Record collection', 'Collection from Ana'],
  ] as const;
  for (const [props, esTitle, esNote, enTitle, enNote] of cases) {
    const spanish = harness('src/ui/transfer-form.tsx', props, { data }).render();
    assert.equal(title(spanish), esTitle);
    assert.equal(find(spanish, 'Field').props.value, esNote);
    const view = harness('src/ui/transfer-form.tsx', props, { data, locale: 'en-AR' });
    const english = view.render();
    assert.equal(title(english), enTitle);
    assert.equal(find(english, 'Field').props.value, enNote, 'the counterparty and card name stay as typed');
    // The title follows a language change; the note is the user's text from the moment the form opened.
    view.setLocale('es-AR');
    assert.equal(title(view.render()), esTitle);
    assert.equal(find(view.render(), 'Field').props.value, enNote);
  }
  // An older deep link with a Spanish title no longer fixes the header; a caller's note still wins.
  const legacy = harness('src/ui/transfer-form.tsx', { toAccountId: 'card-acc', title: 'Pagar tarjeta', defaultNote: 'Resumen julio' }, { data, locale: 'en-AR' });
  assert.equal(title(legacy.render()), 'Pay card');
  assert.equal(find(legacy.render(), 'Field').props.value, 'Resumen julio');
  // Saving writes the same record shape in English: amounts, accounts and the note as shown.
  const view = harness('src/ui/transfer-form.tsx', { toAccountId: 'card-acc', maxAmountMinor: '5000' }, { data, locale: 'en-AR' });
  find(view.render(), 'AmountField').props.onChangeText('50');
  await find(view.render(), 'ActionButton', 'Record payment').props.onPress();
  assert.deepEqual([view.transfers[0].fromAccountId, view.transfers[0].toAccountId, view.transfers[0].amountMinor, view.transfers[0].note], ['a', 'card-acc', 5000, 'Visa payment']);
  assert.equal(view.additions.length, 0);
});

test('a plain transfer between accounts never lists cards or debts, while editing one keeps its original accounts', async () => {
  const view = harness('src/ui/transfer-form.tsx', { accountId: 'a' }, { data: liabilityData });
  assert.deepEqual(find(view.render(), 'AccountField', 'Desde').props.accounts.map((item: domain.Account) => item.id), ['a', 'u']);
  assert.deepEqual(find(view.render(), 'AccountField', 'Hacia').props.accounts.map((item: domain.Account) => item.id), []);
  const original = domain.initialTransferRecord({ id: 'pay', fromAccountId: 'a', toAccountId: 'card-acc', amountMinor: 100, note: 'Pago', dateISO: entry.dateISO, createdAt });
  const editing = harness('src/ui/transfer-form.tsx', { original }, { data: { ...liabilityData, transfers: [original] } });
  assert.deepEqual(find(editing.render(), 'AccountField', 'Hacia').props.accounts.map((item: domain.Account) => item.id), ['card-acc']);
});

test('expense form offers cash accounts and cards but never a personal debt account', () => {
  const view = harness('src/ui/entry-form.tsx', { accountId: 'debt-acc' }, { data: liabilityData });
  const field = find(view.render(), 'AccountField');
  assert.equal(field.props.label, 'Pagado con');
  assert.equal(field.props.prominent, true);
  assert.deepEqual(field.props.accounts.map((item: domain.Account) => item.id), ['a', 'u', 'card-acc']);
  assert.equal(field.props.value, 'a');
  assert.equal(field.props.kindOf('card-acc'), 'Tarjeta de crédito');
  assert.equal(field.props.kindOf('a'), 'Cuenta');
  assert.equal(field.props.typeOf('card-acc'), 'card', 'the glyph follows the ledger kind, not the translated name');
  assert.equal(field.props.typeOf('a'), 'cash');
  assert.equal(field.props.detail, 'Saldo registrado $ 876,55');
  assert.equal(field.props.describe({ ...cardAccount }), 'deuda 50,00');
  find(view.render(), 'AccountField').props.onChange('card-acc');
  assert.equal(find(view.render(), 'AccountField').props.detail, 'Tarjeta de crédito · deuda $ 50,00');
  assert.equal(find(view.render(), 'Stack.Screen').props.options.title, 'Compra con tarjeta');
});

test('the movement modal switches Gasto / Ingreso / Transferencia as state, never as navigation', () => {
  const view = harness('src/ui/movement-form.tsx', { kind: 'expense', accountId: 'a' }, { data: liabilityData });
  let root = view.render();
  const choices = find(root, 'Choices');
  assert.equal(choices.props.options.map((option: { value: string }) => option.value).join(','), 'expense,income,transfer');
  assert.equal(choices.props.value, 'expense');
  assert.equal(find(root, 'EntryForm').props.kind, 'expense');
  assert.equal(find(root, 'EntryForm').props.accountId, 'a');
  find(root, 'EntryForm').props.onAccountChange('b');
  choices.props.onChange('transfer');
  root = view.render();
  assert.equal(find(root, 'Choices').props.value, 'transfer');
  assert.equal(find(root, 'TransferForm').props.accountId, 'b', 'the chosen account carries over into the transfer');
  assert.equal(find(root, 'ValueTransition').props.id, 'transfer');
  assert.equal(nodes(root).some(node => node.type === 'EntryForm'), false);
  find(root, 'Choices').props.onChange('income');
  root = view.render();
  assert.equal(find(root, 'EntryForm').props.kind, 'income');
  assert.equal(find(root, 'ValueTransition').props.id, 'entry');
  assert.equal(view.pushed.length, 0, 'switching modes never navigates');
});

test('a hosted entry form renders no switch of its own and follows the host kind', () => {
  const view = harness('src/ui/entry-form.tsx', { kind: 'income', accountId: 'a', onKindChange: () => {} }, { data: liabilityData });
  const root = view.render();
  assert.equal(nodes(root).some(node => node.type === 'Choices'), false);
  assert.equal(find(root, 'AmountField').props.label, 'Ingreso');
  assert.equal(find(root, 'AccountField').props.label, 'Ingresa en');
});

test('the entry form shows the category budget live and echoes the amount on Save', () => {
  const budget: domain.MonthlyBudget = { id: 'b', scope: 'category', category: 'Salud', currency: 'ARS', monthISO: domain.todayKey().slice(0, 7), amountMinor: 50000, active: true, createdAt, revision: 0, updatedAt: createdAt };
  const view = harness('src/ui/entry-form.tsx', { kind: 'expense' }, { data: { ...liabilityData, budgets: [budget] } });
  assert.equal(find(view.render(), 'CategoryField').props.detail, undefined);
  find(view.render(), 'CategoryField').props.onChange('salud');
  assert.equal(find(view.render(), 'CategoryField').props.detail, '$ 0,00 de $ 500,00 este mes');
  find(view.render(), 'AmountField').props.onChangeText('1234,5');
  assert.equal(find(view.render(), 'ActionButton').props.label, 'Guardar gasto\u00A0·\u00A0$\u00A01.234,50');
  // On its own (edit mode and tests) the form keeps a Gasto / Ingreso switch; Transferencia is the host's job.
  const choices = find(view.render(), 'Choices');
  assert.equal(choices.props.options.map((option: { value: string }) => option.value).join(','), 'expense,income');
  assert.equal(view.pushed.length, 0);
  assert.equal(view.additions.length, 0);
});

test('a card purchase detail links to the card, not to a generic account screen', () => {
  const cardPurchase = { ...entry, id: 'cp', accountId: 'card-acc' };
  const view = harness('app/entry/[id].tsx', {}, { data: { ...liabilityData, records: [domain.initialRecord(cardPurchase)] }, params: { id: 'cp' } });
  const row = find(view.render(), 'DetailRow', 'Tarjeta');
  assert.equal(row.props.value, 'Visa');
  row.props.onPress();
  assert.equal(JSON.stringify(view.pushed[0]), JSON.stringify({ pathname: '/card/[id]', params: { id: 'card' } }));
});

test('entry detail shows budget context only for a matching active budget, and links to that month', () => {
  const budget: domain.MonthlyBudget = { id: 'b', scope: 'category', category: 'salud', currency: 'ARS', monthISO: '2026-01', amountMinor: 20000, active: true, createdAt, revision: 0, updatedAt: createdAt };
  const view = harness('app/entry/[id].tsx', {}, { data: { ...archive, budgets: [budget] }, params: { id: entry.id } });
  const row = find(view.render(), 'DetailRow', 'Presupuesto');
  assert.equal(row.props.value, '62 % usado · quedan 76,55');
  assert.equal(row.props.tone, 'neutral');
  row.props.onPress();
  assert.equal(JSON.stringify(view.pushed[0]), JSON.stringify({ pathname: '/budgets', params: { currency: 'ARS', month: '2026-01' } }));
  const other = harness('app/entry/[id].tsx', {}, { data: { ...archive, budgets: [{ ...budget, monthISO: '2026-02' }] }, params: { id: entry.id } });
  assert.equal(nodes(other.render()).some(node => node.type === 'DetailRow' && node.props.label === 'Presupuesto'), false);
  const exceeded = harness('app/entry/[id].tsx', {}, { data: { ...archive, budgets: [{ ...budget, amountMinor: 10000 }] }, params: { id: entry.id } });
  assert.equal(find(exceeded.render(), 'DetailRow', 'Presupuesto').props.tone, 'expense');
});

// Producto 23.1B1: the same forms in English. The interface language changes
// words only; what is saved (amount, category string, date, account) is
// identical, and a language switch in the middle of a draft keeps the draft.
async function recordExpense(locale: AppLocale) {
  const view = harness('src/ui/entry-form.tsx', { kind: 'expense' }, { locale });
  let root = view.render();
  find(root, 'AmountField').props.onChangeText('1.234,50');
  find(root, 'Field').props.onChangeText('Kiosco');
  find(root, 'CategoryField').props.onChange('Comida');
  root = view.render();
  const save = nodes(root).find(node => node.type === 'ActionButton')!;
  await save.props.onPress();
  return { view, root, save };
}

test('English entry form: every label comes from the catalogue and the saved movement is identical to the Spanish one', async () => {
  const spanish = await recordExpense('es-AR');
  const english = await recordExpense('en-AR');
  assert.equal(nodes(english.root).find(node => node.type === 'Stack.Screen')!.props.options.title, 'Record an expense');
  assert.equal(find(english.root, 'AmountField').props.label, 'Expense');
  assert.equal(find(english.root, 'AccountField').props.label, 'Paid with');
  assert.equal(find(english.root, 'AccountField').props.detail, 'Recorded balance $ 876,55');
  assert.equal(find(english.root, 'Field').props.label, 'Merchant or description');
  assert.equal(find(english.root, 'Field').props.placeholder, 'e.g. Supermarket');
  assert.match(english.save.props.label, /^Save expense/);
  assert.equal(find(english.root, 'AccountField').props.kindOf('a'), 'Account');
  assert.equal(spanish.view.additions.length, 1);
  assert.equal(english.view.additions.length, 1);
  const saved = ({ createdAt, ...rest }: domain.Entry) => JSON.stringify(rest);
  assert.equal(saved(english.view.additions[0]), saved(spanish.view.additions[0]), 'language never reaches the ledger');
  assert.equal(english.view.additions[0].category, 'Comida', 'the stored category string stays the built-in Spanish identity');
  assert.equal(english.view.additions[0].amountMinor, 123450);
});

test('switching the language in the middle of a draft re-labels the form and keeps every field', () => {
  const view = harness('src/ui/entry-form.tsx', { kind: 'expense' }, { locale: 'en-AR' });
  let root = view.render();
  find(root, 'AmountField').props.onChangeText('50');
  find(root, 'Field').props.onChangeText('Farmacia del centro');
  find(root, 'CategoryField').props.onChange('Farmacia');
  root = view.render();
  assert.equal(find(root, 'Field').props.label, 'Merchant or description');
  view.setLocale('es-AR');
  root = view.render();
  assert.equal(find(root, 'Field').props.label, 'Comercio o concepto');
  assert.equal(find(root, 'AmountField').props.value, '50');
  assert.equal(find(root, 'Field').props.value, 'Farmacia del centro');
  assert.equal(find(root, 'CategoryField').props.value, 'Farmacia');
  assert.equal(view.additions.length, 0, 'switching never saves');
});

test('form errors are stored as keys or thrown messages and shown in the interface language', async () => {
  const view = harness('src/ui/entry-form.tsx', { kind: 'expense' }, { locale: 'en-AR' });
  let root = view.render();
  find(root, 'AmountField').props.onChangeText('0');
  find(root, 'Field').props.onChangeText('Kiosco');
  find(root, 'CategoryField').props.onChange('Comida');
  root = view.render();
  await nodes(root).find(node => node.type === 'ActionButton')!.props.onPress();
  const domainMessage = find(view.render(), 'ErrorMessage').props.message;
  assert.equal(domainMessage, 'El monto debe ser mayor que cero y tener hasta dos decimales.', 'the domain message is kept as thrown');
  assert.equal(bindLocale('en-AR').errorText(domainMessage), 'The amount must be greater than zero, with up to two decimals.');
  assert.equal(bindLocale('es-AR').errorText(domainMessage), domainMessage);
  assert.equal(view.additions.length, 0, 'a refused draft is not saved and stays on screen');
  assert.equal(find(view.render(), 'Field').props.value, 'Kiosco');

  const future = harness('src/ui/entry-form.tsx', { kind: 'expense' }, { locale: 'en-AR' });
  root = future.render();
  find(root, 'AmountField').props.onChangeText('10');
  find(root, 'Field').props.onChangeText('Kiosco');
  find(root, 'CategoryField').props.onChange('Comida');
  find(root, 'DateField').props.onChange(new Date(Date.now() + 3 * 86400000));
  await nodes(future.render()).find(node => node.type === 'ActionButton')!.props.onPress();
  const key = find(future.render(), 'ErrorMessage').props.message;
  assert.equal(key, 'entryForm.futureDate');
  assert.match(bindLocale('en-AR').errorText(key), /^Choose today or an earlier date/);
  assert.match(bindLocale('es-AR').errorText(key), /^Elegí hoy o una fecha anterior/);
});

test('English movement detail and transfer form: titles, rows, confirmation and buttons are translated; values are not', () => {
  const detail = harness('app/entry/[id].tsx', {}, { params: { id: 'e' }, locale: 'en-AR' });
  const root = detail.render();
  assert.equal(nodes(root).find(node => node.type === 'Stack.Screen')!.props.options.title, 'Expense');
  const rows = nodes(root).filter(node => node.type === 'DetailRow').map(node => node.props.label + '=' + node.props.value);
  assert.deepEqual(rows, ['Category=Salud', 'Account=Prueba ARS', 'Currency=Argentine pesos'], 'the stored name and the account name are not translated');
  find(root, 'ActionButton', 'Undo transaction').props.onPress();
  assert.equal(detail.alerts[0].title, 'Undo transaction?');
  assert.equal(detail.alerts[0].message, '123,45 ARS will be added to Prueba ARS. It will stop counting in your balances and reports. You can restore it later.');
  assert.equal(detail.alerts[0].buttons.map((button: any) => button.text).join(','), 'Cancel,Undo');
  assert.equal(detail.updates.length, 0, 'asking never writes');

  const transfer = harness('src/ui/transfer-form.tsx', { accountId: 'a' }, { locale: 'en-AR',
    data: { ...archive, accounts: [account, { ...account, id: 'b', name: 'Caja' }] } });
  const form = transfer.render();
  assert.equal(nodes(form).find(node => node.type === 'Stack.Screen')!.props.options.title, 'Between my accounts');
  assert.deepEqual(nodes(form).filter(node => node.type === 'AccountField').map(node => node.props.label), ['From', 'To']);
  assert.equal(find(form, 'AmountField').props.label, 'Transfer');
  assert.equal(find(form, 'Field').props.label, 'Note (optional)');
  assert.equal(find(form, 'ActionButton').props.label, 'Record transfer');
});

test('in English the account forms and the balance correction read in English and write exactly what Spanish writes', async () => {
  const correct = async (locale: AppLocale) => {
    const view = harness('app/edit-account/[id].tsx', {}, { params: { id: 'a' }, locale });
    find(view.render(), 'AmountField').props.onChangeText('500');
    find(view.render(), 'ActionButton').props.onPress();
    view.alerts[0].buttons[1].onPress(); await flush();
    return view;
  };
  const english = await correct('en-AR'), spanish = await correct('es-AR');
  const root = english.render();
  assert.equal(find(root, 'Stack.Screen').props.options.title, 'Edit account');
  assert.equal(find(root, 'Field').props.label, 'Account name');
  assert.equal(find(root, 'Field').props.value, 'Prueba ARS', 'the account name is never translated');
  assert.equal(find(root, 'AmountField').props.label, 'Recorded balance');
  assert.equal(english.alerts[0].title, 'Correct the balance?');
  assert.equal(english.alerts[0].message, 'Prueba ARS: from 876,55 to 500,00 ARS. The opening balance will be adjusted; your transactions don’t change. This is not income or a transfer.');
  assert.equal(spanish.alerts[0].message, 'Prueba ARS: de 876,55 a 500,00 ARS. Se ajustará el saldo inicial; tus movimientos no cambian. No es un ingreso ni una transferencia.');
  assert.equal(english.alerts[0].buttons.map((button: any) => button.text).join(','), 'Cancel,Correct balance');
  const stable = (change: domain.AccountChange) => JSON.stringify({ ...change, id: '', createdAt: '', after: { ...change.after, updatedAt: '' } });
  assert.equal(stable(english.accountChanges[0]), stable(spanish.accountChanges[0]));
  const created = harness('app/new-account.tsx', {}, { locale: 'en-AR' });
  let form = created.render();
  assert.equal(find(form, 'Field').props.placeholder, 'e.g. Bank, Cash, Brokerage');
  assert.equal(find(form, 'AmountField').props.label, 'Opening balance');
  assert.equal(find(form, 'ActionButton').props.label, 'Save account');
  find(form, 'Field').props.onChangeText('Caja de ahorro');
  await find(created.render(), 'ActionButton').props.onPress();
  assert.equal(created.newAccounts[0].name, 'Caja de ahorro');
  assert.equal(created.newAccounts[0].openingMinor, 0);
});

// Producto 23.1B2: the backup review in English. The copy, the counts'
// labels, the confirmation and the conflict message change; the file that is
// read, the preview and what is restored are exactly the Spanish ones.
test('23.1B2 English backup import: review, confirmation and result are translated; the restored archive is identical to the Spanish import', async () => {
  const json = JSON.stringify(domain.createRecoveryBackup(archive));
  const picker = async () => ({ canceled: false, result: { size: json.length, name: 'test.json', text: async () => json } });
  const empty = { accounts: [], records: [] };
  const run = async (locale: AppLocale) => {
    const view = harness('app/backup-import.tsx', {}, { data: empty, picker, locale });
    return view;
  };
  const english = await run('en-AR');
  let root = english.render();
  assert.equal(find(root, 'EmptyState').props.title, 'Recover your records');
  await find(root, 'ActionButton', 'Choose backup').props.onPress();
  root = english.render();
  assert.equal(nodes(root).filter(node => node.type === 'DetailRow').map(node => node.props.label + '=' + node.props.value).join(','),
    'New accounts=2,New cards=0,New debts=0,New transactions=1,New transfers=0,New recurring items=0,New budgets=0,Undone to keep=0,Records already here=0');
  assert.ok(nodes(root).some(node => node.type === 'AppText' && node.props.children === 'test.json'), 'the file name is shown as it is');
  assert.ok(nodes(root).some(node => node.type === 'SectionTitle' && node.props.children === 'Available afterward'));
  find(root, 'ActionButton', 'Confirm import').props.onPress();
  assert.equal(english.alerts[0].title, 'Import this backup?');
  assert.equal(english.alerts[0].buttons.map((button: any) => button.text).join(','), 'Cancel,Import');
  english.alerts[0].buttons[1].onPress(); await flush();
  assert.equal(find(english.render(), 'EmptyState').props.title, 'Backup imported');
  const spanish = await run('es-AR');
  await find(spanish.render(), 'ActionButton', 'Elegir copia').props.onPress();
  find(spanish.render(), 'ActionButton', 'Confirmar importación').props.onPress();
  spanish.alerts[0].buttons[1].onPress(); await flush();
  assert.equal(JSON.stringify(english.restores), JSON.stringify(spanish.restores), 'the language never changes what is restored');
  // A conflicting backup says so in English, with the count, and offers nothing to import.
  const conflicting = harness('app/backup-import.tsx', {}, { data: { ...archive, records: [domain.makeEntryChange('undo', archive.records[0], 'void', createdAt).after] }, picker, locale: 'en-AR' });
  await find(conflicting.render(), 'ActionButton', 'Choose backup').props.onPress();
  root = conflicting.render();
  assert.match(nodes(root).find(node => node.type === 'ErrorMessage' && node.props.message)!.props.message, /^1 record has different changes\. Nothing will be imported\./);
  assert.equal(nodes(root).some(node => node.props.label === 'Confirm import'), false);
  // The size limit is the form's own error, shown in English.
  const large = harness('app/backup-import.tsx', {}, { locale: 'en-AR', picker: async () => ({ canceled: false, result: { size: domain.BACKUP_MAX_BYTES + 1, text: async () => '{}' } }) });
  await find(large.render(), 'ActionButton', 'Choose backup').props.onPress();
  assert.equal(bindLocale('en-AR').errorText(find(large.render(), 'ErrorMessage').props.message), 'The backup is over 5 MB. Keep the file; nothing was imported.');
});
