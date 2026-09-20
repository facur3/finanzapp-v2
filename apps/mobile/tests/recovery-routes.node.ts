import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as domain from '@finanzapp/domain';
import * as presentation from '../src/ui/presentation.ts';
import * as liabilityPresentation from '../src/ui/liability-presentation.ts';

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
  restore?: (value: domain.LedgerArchive, baseline: string) => Promise<void>; picker?: () => Promise<any> } = {}) {
  const source = readFileSync(new URL('../' + file, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const state: any[] = [];
  const refs: any[] = [];
  let cursor = 0, refCursor = 0, uuid = 0, backs = 0;
  const pushed: any[] = [], alerts: any[] = [], updates: domain.EntryChange[] = [], additions: domain.Entry[] = [], restores: any[] = [];
  const transfers: domain.Transfer[] = [], transferChanges: domain.TransferChange[] = [], accountChanges: domain.AccountChange[] = [], newAccounts: domain.Account[] = [];
  let data = options.data ?? archive;
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
  const components = Object.fromEntries(['Screen', 'EmptyState', 'ActionButton', 'AppText', 'AmountField', 'Choices', 'ErrorMessage', 'Field', 'IconButton', 'Surface',
    'CategoryBadge', 'DetailRow', 'Money', 'SectionTitle', 'GlyphTile'].map(name => [name, name]));
  const modules: Record<string, unknown> = {
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
    './form-controls': { AccountField: 'AccountField', CategoryField: 'CategoryField', DateField: 'DateField' },
    './presentation': presentation,
    './liability-presentation': liabilityPresentation,
    '../../src/ui/theme': { space: { xs: 4, s: 8, m: 12, l: 16, xl: 20, xxl: 24, xxxl: 32 },
      usePalette: () => ({ text: '#000', positive: '#070', income: '#070', expense: '#700', tint: '#00F', warning: '#a60', secondary: '#666', tertiary: '#999' }) },
    './theme': { space: { xs: 4, s: 8, m: 12, l: 16, xl: 20, xxl: 24, xxxl: 32 } },
  };
  const module = { exports: {} as Record<string, (props: any) => Node> };
  runInNewContext(code, { module, exports: module.exports, Date, require: (name: string) => {
    if (!Object.hasOwn(modules, name)) throw new Error('Unexpected recovery dependency: ' + name);
    return modules[name];
  } });
  return {
    render: () => { cursor = 0; refCursor = 0; let node = (module.exports.default ?? module.exports.EntryForm ?? module.exports.TransferForm)(props);
      while (typeof node.type === 'function') node = node.type(node.props);
      return node; },
    setData: (next: domain.LedgerArchive) => { data = next; },
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
  assert.match(find(view.render(), 'ErrorMessage').props.message, /5 MB/);
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
  assert.equal(find(root, 'DetailRow', 'Prueba ARS después').props.value, 'ARS 866,55');
  assert.equal(find(root, 'DetailRow', 'Destino después').props.value, 'ARS 10,00');
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
  assert.equal(find(view.render(), 'DetailRow', 'Prueba ARS después').props.value, 'ARS 856,55');
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
  assert.equal(find(view.render(), 'Choices').props.value, 'USD');
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
  assert.equal(find(root, 'DetailRow', 'Tarjeta').props.value, 'Visa');
  assert.equal(find(root, 'AccountField', 'Desde').props.value, 'a');
  assert.deepEqual(find(root, 'AccountField', 'Desde').props.accounts.map((item: domain.Account) => item.id), ['a']);
  assert.equal(find(root, 'Field').props.value, 'Pago Visa');
  find(root, 'AmountField').props.onChangeText('60');
  root = view.render();
  await find(root, 'ActionButton', 'Registrar pago').props.onPress();
  assert.match(find(view.render(), 'ErrorMessage').props.message, /supera la deuda/);
  assert.equal(view.transfers.length, 0);
  find(view.render(), 'AmountField').props.onChangeText('50');
  root = view.render();
  assert.equal(find(root, 'DetailRow', 'Visa después').props.value, 'ARS A favor 0,00');
  await find(root, 'ActionButton', 'Registrar pago').props.onPress();
  assert.equal(view.transfers.length, 1);
  assert.deepEqual([view.transfers[0].fromAccountId, view.transfers[0].toAccountId, view.transfers[0].amountMinor, view.transfers[0].note], ['a', 'card-acc', 5000, 'Pago Visa']);
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
  assert.equal(field.props.label, 'Cuenta o tarjeta');
  assert.deepEqual(field.props.accounts.map((item: domain.Account) => item.id), ['a', 'u', 'card-acc']);
  assert.equal(field.props.value, 'a');
  assert.equal(field.props.kindOf('card-acc'), 'Tarjeta de crédito');
  assert.equal(field.props.kindOf('a'), 'Cuenta');
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
  const budget: domain.MonthlyBudget = { id: 'b', category: 'salud', currency: 'ARS', monthISO: '2026-01', amountMinor: 20000, active: true, createdAt, revision: 0, updatedAt: createdAt };
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
