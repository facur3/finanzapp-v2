import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as domain from '@finanzapp/domain';
import * as presentation from '../src/ui/presentation.ts';

// Actual screen/form handlers with native hosts replaced by descriptors.
// This does not render UIKit, the Files picker, animation frames or gestures.
type Node = { type: string | ((props: any) => Node); props: Record<string, any> };
const createdAt = '2026-01-01T12:00:00Z';
const account: domain.Account = { id: 'a', name: 'Prueba ARS', currency: 'ARS', openingMinor: 100000, createdAt };
const entry: domain.Entry = { id: 'e', accountId: 'a', kind: 'expense', amountMinor: 12345, merchant: 'Prueba', category: 'Salud', dateISO: '2026-01-01', createdAt };
const archive: domain.LedgerArchive = { accounts: [account, { ...account, id: 'u', currency: 'USD' }], records: [domain.initialRecord(entry)] };

function harness(file: string, props: any = {}, options: { data?: domain.LedgerArchive; params?: any;
  add?: (value: domain.Entry) => Promise<void>; update?: (value: domain.EntryChange) => Promise<void>;
  restore?: (value: domain.LedgerArchive, baseline: string) => Promise<void>; picker?: () => Promise<any> } = {}) {
  const source = readFileSync(new URL('../' + file, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const state: any[] = [];
  const refs: any[] = [];
  let cursor = 0, refCursor = 0, uuid = 0, backs = 0;
  const pushed: any[] = [], alerts: any[] = [], updates: domain.EntryChange[] = [], additions: domain.Entry[] = [], restores: any[] = [];
  let data = options.data ?? archive;
  const jsx = (type: Node['type'], props: Node['props']) => ({ type, props });
  const ledger = { useLedger: () => ({ archive: data, snapshot: domain.snapshotFromArchive(data),
    addEntry: async (value: domain.Entry) => { additions.push(value); await options.add?.(value); },
    updateEntry: async (value: domain.EntryChange) => { updates.push(value); await options.update?.(value); },
    restoreBackup: async (value: domain.LedgerArchive, baseline: string) => { restores.push({ value, baseline }); await options.restore?.(value, baseline); },
  }) };
  const components = Object.fromEntries(['Screen', 'EmptyState', 'ActionButton', 'AppText', 'AmountField', 'Choices', 'ErrorMessage', 'Field', 'IconButton', 'Surface',
    'CategoryBadge', 'DetailRow', 'Money', 'SectionTitle'].map(name => [name, name]));
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
    '../storage/LedgerProvider': ledger, '../src/storage/LedgerProvider': ledger, '../../src/storage/LedgerProvider': ledger,
    './components': components, '../src/ui/components': components, '../../src/ui/components': components,
    './form-controls': { AccountField: 'AccountField', CategoryField: 'CategoryField', DateField: 'DateField' },
    './presentation': presentation,
    '../../src/ui/theme': { usePalette: () => ({ text: '#000', positive: '#070' }) },
  };
  const module = { exports: {} as Record<string, (props: any) => Node> };
  runInNewContext(code, { module, exports: module.exports, Date, require: (name: string) => {
    if (!Object.hasOwn(modules, name)) throw new Error('Unexpected recovery dependency: ' + name);
    return modules[name];
  } });
  return {
    render: () => { cursor = 0; refCursor = 0; let node = (module.exports.default ?? module.exports.EntryForm)(props);
      while (typeof node.type === 'function') node = node.type(node.props);
      return node; },
    setData: (next: domain.LedgerArchive) => { data = next; },
    pushed, alerts, updates, additions, restores, backs: () => backs,
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
