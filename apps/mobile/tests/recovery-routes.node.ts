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
import * as entryPrefill from '../src/ui/entry-prefill.ts';
import * as appearance from '../src/ui/appearance.ts';
import * as i18nFormat from '../src/i18n/format.ts';
import { bindLocale } from '../src/i18n/bind.ts';
import type { AppLocale } from '../src/i18n/locale.ts';
import { realModule } from './real-module.ts';

// Actual screen/form handlers with native hosts replaced by descriptors.
// This does not render UIKit, the Files picker, animation frames or gestures.
type Node = { type: string | ((props: any) => Node); props: Record<string, any> };
const createdAt = '2026-01-01T12:00:00Z';
const account: domain.Account = { id: 'a', name: 'Prueba ARS', currency: 'ARS', openingMinor: 100000, createdAt };
const entry: domain.Entry = { id: 'e', accountId: 'a', kind: 'expense', amountMinor: 12345, merchant: 'Prueba', category: 'Salud', dateISO: '2026-01-01', createdAt };
const archive: domain.LedgerArchive = { accounts: [account, { ...account, id: 'u', currency: 'USD' }], records: [domain.initialRecord(entry)] };

function harness(file: string, props: any = {}, options: { data?: domain.LedgerArchive | null; params?: any;
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
  const transfers: domain.Transfer[] = [], transferChanges: domain.TransferChange[] = [], accountChanges: domain.AccountChange[] = [], newAccounts: domain.Account[] = [], rules: domain.RecurringRule[] = [];
  // null: the ledger has not hydrated yet; setData moves it on.
  let data = (options.data === undefined ? archive : options.data) as domain.LedgerArchive;
  // The locale is read on every render, like the live provider: switching it re-labels the next render and keeps the state.
  let locale: AppLocale = options.locale ?? 'es-AR';
  const i18nProvider = { useI18n: () => bindLocale(locale) };
  const jsx = (type: Node['type'], props: Node['props']) => ({ type, props });
  const ledger = { useLedger: () => ({ archive: data, snapshot: data ? domain.snapshotFromArchive(data) : null,
    addEntry: async (value: domain.Entry) => { additions.push(value); await options.add?.(value); },
    saveRecurring: async (value: domain.RecurringRule) => { rules.push(value); },
    updateEntry: async (value: domain.EntryChange) => { updates.push(value); await options.update?.(value); },
    addTransfer: async (value: domain.Transfer) => { transfers.push(value); await options.addTransfer?.(value); },
    updateTransfer: async (value: domain.TransferChange) => { transferChanges.push(value); await options.updateTransfer?.(value); },
    updateAccount: async (value: domain.AccountChange) => { accountChanges.push(value); await options.updateAccount?.(value); },
    addAccount: async (value: domain.Account) => { newAccounts.push(value); await options.addAccount?.(value); },
    restoreBackup: async (value: domain.LedgerArchive, baseline: string) => { restores.push({ value, baseline }); await options.restore?.(value, baseline); },
  }) };
  const components = Object.fromEntries(['Screen', 'EmptyState', 'ActionButton', 'AppText', 'AmountField', 'AmountShortcut', 'Choices', 'ErrorMessage', 'Field', 'FieldNote', 'IconButton', 'Surface',
    'CategoryBadge', 'DetailRow', 'Money', 'SectionTitle', 'GlyphTile', 'AccountBadge', 'EntryRow', 'MerchantBadge'].map(name => [name, name]));
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
    'expo-haptics': { NotificationFeedbackType: { Success: 'Success' }, notificationAsync: async () => {}, selectionAsync: async () => {} },
    'expo-file-system': { File: { pickFileAsync: options.picker ?? (async () => ({ canceled: true })) } },
    '@finanzapp/domain': domain,
    '@expo/vector-icons/Ionicons': 'Ionicons',
    '../storage/LedgerProvider': ledger, '../src/storage/LedgerProvider': ledger, '../../src/storage/LedgerProvider': ledger,
    './components': components, '../src/ui/components': components, '../../src/ui/components': components,
    './form-controls': { AccountField: 'AccountField', CategoryField: 'CategoryField', CurrencyField: 'CurrencyField', DateField: 'DateField', SelectorCard: 'SelectorCard' },
    '../src/ui/form-controls': { CurrencyField: 'CurrencyField' }, '../../src/ui/form-controls': { CurrencyField: 'CurrencyField' },
    '../src/ui/currencies': currencies, '../../src/ui/currencies': currencies,
    './presentation': presentation, './entry-prefill': entryPrefill,
    './budget-presentation': budgetPresentation, '../../src/ui/budget-presentation': budgetPresentation,
    './money-input': moneyInput, '../../src/ui/money-input': moneyInput, '../src/ui/money-input': moneyInput,
    './liability-presentation': liabilityPresentation,
    '../../src/ui/theme': { space: { xs: 4, s: 8, m: 12, l: 16, xl: 20, xxl: 24, xxxl: 32 },
      usePalette: () => ({ text: '#000', positive: '#070', income: '#070', expense: '#700', primary: '#2557D6', warning: '#a60', secondary: '#666', tertiary: '#999' }) },
    './theme': { space: { xs: 4, s: 8, m: 12, l: 16, xl: 20, xxl: 24, xxxl: 32 }, usePalette: () => ({ background: '#fff' }) },
    './entry-form': { EntryForm: 'EntryForm' }, './transfer-form': { TransferForm: 'TransferForm' },
    '../../src/ui/recurring-form': { RecurringForm: 'RecurringForm' },
    './motion': { ValueTransition: 'ValueTransition' },
    './category-hues': { useCategoryColor: () => '#3E6FB0', useCategoryLabel: (s: string) => s, useCategoryDefinitions: () => [], useCategoryLook: (s: string) => ({ label: s, storedLabel: s, key: String(s).toLowerCase(), hex: '#3E6FB0', glyph: 'pricetag-outline' }), useCategoryLookOf: () => (s: string) => ({ label: s, storedLabel: s, key: String(s).toLowerCase(), hex: '#3E6FB0', glyph: 'pricetag-outline' }), useAccountLook: () => ({ icon: 'wallet', color: 'cobalt', glyph: 'wallet-outline', hex: '#2557D6' }), useAccountNameOf: () => (account: any) => account.name, useAccountLookOf: () => () => ({ icon: 'wallet', color: 'cobalt', glyph: 'wallet-outline', hex: '#2557D6' }) }, '../src/ui/category-hues': { useCategoryColor: () => '#3E6FB0', useCategoryLabel: (s: string) => s, useCategoryDefinitions: () => [], useCategoryLook: (s: string) => ({ label: s, storedLabel: s, key: String(s).toLowerCase(), hex: '#3E6FB0', glyph: 'pricetag-outline' }), useCategoryLookOf: () => (s: string) => ({ label: s, storedLabel: s, key: String(s).toLowerCase(), hex: '#3E6FB0', glyph: 'pricetag-outline' }), useAccountLook: () => ({ icon: 'wallet', color: 'cobalt', glyph: 'wallet-outline', hex: '#2557D6' }), useAccountNameOf: () => (account: any) => account.name, useAccountLookOf: () => () => ({ icon: 'wallet', color: 'cobalt', glyph: 'wallet-outline', hex: '#2557D6' }) }, '../../src/ui/category-hues': { useCategoryColor: () => '#3E6FB0', useCategoryLabel: (s: string) => s, useCategoryDefinitions: () => [], useCategoryLook: (s: string) => ({ label: s, storedLabel: s, key: String(s).toLowerCase(), hex: '#3E6FB0', glyph: 'pricetag-outline' }), useCategoryLookOf: () => (s: string) => ({ label: s, storedLabel: s, key: String(s).toLowerCase(), hex: '#3E6FB0', glyph: 'pricetag-outline' }), useAccountLook: () => ({ icon: 'wallet', color: 'cobalt', glyph: 'wallet-outline', hex: '#2557D6' }), useAccountNameOf: () => (account: any) => account.name, useAccountLookOf: () => () => ({ icon: 'wallet', color: 'cobalt', glyph: 'wallet-outline', hex: '#2557D6' }) },
    '../src/ui/appearance': appearance, '../../src/ui/appearance': appearance,
    '../src/ui/appearance-picker': { IconColorPicker: 'IconColorPicker' }, '../../src/ui/appearance-picker': { IconColorPicker: 'IconColorPicker' },
  };
  const require = (name: string) => {
    if (!Object.hasOwn(modules, name)) throw new Error('Unexpected recovery dependency: ' + name);
    return modules[name];
  };
  // 24UX4: the recurring detail's management runs for real (Alert, saveRecurring, router and haptics are the mocks above).
  modules['./commitment-actions'] = realModule('src/ui/commitment-actions.ts', require);
  const module = { exports: {} as Record<string, (props: any) => Node> };
  runInNewContext(code, { module, exports: module.exports, Date, Error, require });
  return {
    render: () => { cursor = 0; refCursor = 0; let node = (module.exports.default ?? module.exports.EntryForm ?? module.exports.TransferForm ?? module.exports.MovementForm ?? module.exports.RecurringForm)(props);
      while (typeof node.type === 'function') node = node.type(node.props);
      return node; },
    setData: (next: domain.LedgerArchive | null) => { data = next as domain.LedgerArchive; },
    setLocale: (next: AppLocale) => { locale = next; },
    pushed, alerts, updates, additions, restores, transfers, transferChanges, accountChanges, newAccounts, rules, backs: () => backs,
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

test('24B4: a v9 copy in yen lists the scales it pins as a review row, imports once, and the formats note names v1 to v10; a v8 file naming yen is refused by name', async () => {
  const yen: domain.Account = { ...account, id: 'yen', name: 'Yenes', currency: 'JPY', openingMinor: 1500 };
  const yenArchive: domain.LedgerArchive = { accounts: [yen], records: [domain.initialRecord({ ...entry, id: 'y1', accountId: 'yen', amountMinor: 700 })] };
  const backup = domain.createRecoveryBackup(yenArchive);
  assert.equal(backup.schema, 'finanzapp.native-pilot.v9');
  const json = JSON.stringify(backup);
  const view = harness('app/backup-import.tsx', {}, { data: { accounts: [], records: [], currencyUnits: [] }, locale: 'en-AR',
    picker: async () => ({ canceled: false, result: { size: json.length, name: 'yen.json', text: async () => json } }) });
  await find(view.render(), 'ActionButton', 'Choose backup').props.onPress();
  const rows = nodes(view.render()).filter(node => node.type === 'DetailRow').map(node => [node.props.label, node.props.value]);
  assert.ok(rows.some(([label, value]) => label === 'New currency scales' && value === '1'), JSON.stringify(rows));
  assert.deepEqual({ minor: find(view.render(), 'Money').props.minor, currency: find(view.render(), 'Money').props.currency }, { minor: 800, currency: 'JPY' }, 'yen previewed as yen');
  assert.ok(nodes(view.render()).some(node => node.type === 'AppText' && String(node.props.children).startsWith('Native backups v1 to v10')));
  find(view.render(), 'ActionButton', 'Confirm import').props.onPress();
  view.alerts[0].buttons[1].onPress();
  await flush();
  assert.equal(view.restores.length, 1);
  assert.deepEqual(view.restores[0].value.currencyUnits, [domain.catalogueUnit('JPY')], 'the copy\'s pinned scale travels with the rows');
  // The same bytes with the v8 header: refused whole, before any preview, with the legacy sentence.
  const forged = JSON.stringify({ ...backup, schema: 'finanzapp.native-pilot.v8', currencyUnits: undefined });
  const refused = harness('app/backup-import.tsx', {}, { data: { accounts: [], records: [] }, locale: 'en-AR',
    picker: async () => ({ canceled: false, result: { size: forged.length, name: 'forged.json', text: async () => forged } }) });
  await find(refused.render(), 'ActionButton', 'Choose backup').props.onPress();
  assert.match(bindLocale('en-AR').errorText(find(refused.render(), 'ErrorMessage').props.message), /^Backups v1 to v8 can only contain accounts and budgets in ARS or USD/);
  assert.equal(refused.restores.length, 0);
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
  note: '', active: true, deleted: false, createdAt, revision: 0, updatedAt: createdAt };
const liabilityData: domain.LedgerArchive = { ...archive, accounts: [...archive.accounts, cardAccount, debtAccount], cards: [card], debts: [debt] };

test('card payment locks the card as destination, caps at the recorded debt and never becomes an expense', async () => {
  const view = harness('src/ui/transfer-form.tsx', { toAccountId: 'card-acc', title: 'Pagar tarjeta', defaultNote: 'Pago Visa', maxAmountMinor: '5000' }, { data: liabilityData });
  let root = view.render();
  assert.equal(nodes(root).some(node => node.type === 'AccountField' && node.props.label === 'Hacia'), false);
  assert.equal(find(root, 'SelectorCard', 'Tarjeta').props.value, 'Visa');
  assert.equal(find(root, 'SelectorCard', 'Tarjeta').props.detail, 'Deuda ARS 50,00');
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
  assert.equal(find(root, 'DetailRow', 'Visa después').props.value, 'Sin deuda', 'a card paid to zero owes nothing; it is not "in credit"');
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
  assert.equal(field.props.detail, 'Saldo registrado $\u00A0876,55');
  assert.equal(field.props.describe({ ...cardAccount }), 'deuda 50,00');
  find(view.render(), 'AccountField').props.onChange('card-acc');
  assert.equal(find(view.render(), 'AccountField').props.detail, 'Tarjeta de crédito · deuda $\u00A050,00');
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
  assert.equal(find(view.render(), 'CategoryField').props.detail, '$\u00A00,00 de $\u00A0500,00 este mes');
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
  assert.equal(find(english.root, 'AccountField').props.detail, 'Recorded balance $\u00A0876,55');
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
    'New accounts=2,New cards=0,New debts=0,New transactions=1,New transfers=0,New recurring items=0,New budgets=0,Undone records to keep=0,Records already here=0');
  assert.ok(nodes(root).some(node => node.type === 'AppText' && node.props.children === 'test.json'), 'the file name is shown as it is');
  assert.ok(nodes(root).some(node => node.type === 'SectionTitle' && node.props.children === 'Available after import'));
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
  assert.match(nodes(root).find(node => node.type === 'ErrorMessage' && node.props.message)!.props.message, /^1 record differs from the one on this device\. Nothing will be imported\./);
  assert.equal(nodes(root).some(node => node.props.label === 'Confirm import'), false);
  // The size limit is the form's own error, shown in English.
  const large = harness('app/backup-import.tsx', {}, { locale: 'en-AR', picker: async () => ({ canceled: false, result: { size: domain.BACKUP_MAX_BYTES + 1, text: async () => '{}' } }) });
  await find(large.render(), 'ActionButton', 'Choose backup').props.onPress();
  assert.equal(bindLocale('en-AR').errorText(find(large.render(), 'ErrorMessage').props.message), 'The backup is over 5 MB. Keep the file; nothing was imported.');
});

// Producto 23.1C2: English and the United States are released. A worded
// balance carries its currency code where the language puts it, the account
// sheet describes an option as the selected card does, and every amount a
// VoiceOver label carries is the spoken twin of what the screen shows: the
// region's separators on screen, the language's decimal mark and no grouping
// in speech (es-US and en-AR are the pairs where the two differ).
test('23.1C2: a worded balance carries its code where the language puts it; a cash account keeps its code and signed amount', async () => {
  const spanish = harness('src/ui/transfer-form.tsx', { toAccountId: 'card-acc', maxAmountMinor: '5000' }, { data: liabilityData });
  let root = spanish.render();
  assert.equal(find(root, 'SelectorCard', 'Tarjeta').props.detail, 'Deuda ARS 50,00', 'never "ARS Deuda 50,00"');
  assert.equal(find(root, 'AccountField', 'Desde').props.detail, 'ARS 876,55', 'a cash account is its code and amount, joined');
  assert.equal(find(root, 'AmountShortcut').props.caption, 'Deuda registrada: ARS 50,00');
  const english = harness('src/ui/transfer-form.tsx', { toAccountId: 'card-acc', maxAmountMinor: '5000' }, { data: liabilityData, locale: 'en-US' });
  root = english.render();
  assert.equal(find(root, 'SelectorCard', 'Card').props.detail, 'Owed ARS 50.00', 'never "ARS Owed 50.00"');
  assert.equal(find(root, 'AccountField', 'From').props.detail, 'ARS 876.55');
  find(root, 'AmountField').props.onChangeText('50');
  root = english.render();
  assert.equal(find(root, 'DetailRow', 'Visa afterwards').props.value, 'Nothing owed');
  assert.equal(find(root, 'DetailRow', 'Prueba ARS afterwards').props.value, 'ARS 826.55');
  // A debt is pending, in both languages; the collection side is a receivable.
  const debtForm = (locale: AppLocale) => harness('src/ui/transfer-form.tsx', { toAccountId: 'debt-acc', maxAmountMinor: '7000' }, { data: liabilityData, locale }).render();
  assert.equal(find(debtForm('es-AR'), 'SelectorCard', 'Deuda').props.detail, 'Pendiente ARS 70,00');
  assert.equal(find(debtForm('en-AR'), 'SelectorCard', 'Debt').props.detail, 'Pending ARS 70,00');
  // An overdrawn cash account keeps its sign.
  const overdrawn: domain.Account = { ...account, id: 'red', name: 'En rojo', openingMinor: -50000 };
  const red = harness('src/ui/transfer-form.tsx', { accountId: 'red' }, { data: { ...liabilityData, accounts: [...liabilityData.accounts, overdrawn] } }).render();
  assert.equal(find(red, 'AccountField', 'Desde').props.detail, 'ARS -500,00');
  assert.equal(find(red, 'AccountField', 'Desde').props.spokenDetail, 'ARS -500,00');
});

test('23.1C2: the transfer form gives VoiceOver the language’s numbers on the cards, the shortcut and the after rows', () => {
  const cases = [
    // [locale, card kind, after label, screen detail, spoken detail, screen caption, spoken caption, screen after, spoken after]
    ['es-US', 'Tarjeta', 'Visa después', 'Deuda ARS 50.00', 'Deuda ARS 50,00', 'Deuda registrada: ARS 50.00', 'Deuda registrada: ARS 50,00', 'Sin deuda', 'Sin deuda'],
    ['en-AR', 'Card', 'Visa afterwards', 'Owed ARS 50,00', 'Owed ARS 50.00', 'Recorded debt: ARS 50,00', 'Recorded debt: ARS 50.00', 'Nothing owed', 'Nothing owed'],
  ] as const;
  for (const [locale, kind, after, detail, spokenDetail, caption, spokenCaption, afterValue, spokenAfter] of cases) {
    const view = harness('src/ui/transfer-form.tsx', { toAccountId: 'card-acc', maxAmountMinor: '5000' }, { data: liabilityData, locale });
    let root = view.render();
    const card = find(root, 'SelectorCard', kind);
    assert.deepEqual([card.props.detail, card.props.spokenDetail].join('|'), detail + '|' + spokenDetail, locale);
    const shortcut = find(root, 'AmountShortcut');
    assert.deepEqual([shortcut.props.caption, shortcut.props.spokenCaption].join('|'), caption + '|' + spokenCaption, locale);
    const source = nodes(root).find(node => node.type === 'AccountField')!;
    assert.equal(source.props.spokenDetail, 'ARS ' + (locale === 'es-US' ? '876,55' : '876.55'), 'the spoken twin never groups and uses the language’s decimal mark');
    find(root, 'AmountField').props.onChangeText('50');
    root = view.render();
    const row = find(root, 'DetailRow', after);
    assert.deepEqual([row.props.value, row.props.spokenValue].join('|'), afterValue + '|' + spokenAfter, locale);
  }
  // A large amount: the screen groups, the spoken twin never does.
  const rich: domain.Account = { ...account, id: 'rich', name: 'Ahorro', openingMinor: 123456789 };
  const view = harness('src/ui/transfer-form.tsx', { accountId: 'rich' }, { data: { ...archive, accounts: [rich, { ...rich, id: 'other', name: 'Caja', openingMinor: 0 }] }, locale: 'es-US' });
  const shortcut = find(view.render(), 'AmountShortcut');
  assert.equal(shortcut.props.caption, 'Saldo registrado: ARS 1,234,567.89');
  assert.equal(shortcut.props.spokenCaption, 'Saldo registrado: ARS 1234567,89');
});

test('23.1C2: the account sheet describes an option as the selected card does: signed cash, a card owed, in credit or clear', () => {
  const overdrawn: domain.Account = { ...account, id: 'red', name: 'En rojo', openingMinor: -50000 };
  const creditCard: domain.Account = { ...cardAccount, id: 'credit-acc', name: 'Master', openingMinor: 2500 };
  const clearCard: domain.Account = { ...cardAccount, id: 'clear-acc', name: 'Amex', openingMinor: 0 };
  const data: domain.LedgerArchive = { ...liabilityData, accounts: [...liabilityData.accounts, overdrawn, creditCard, clearCard],
    cards: [card, { ...card, id: 'credit', accountId: creditCard.id }, { ...card, id: 'clear', accountId: clearCard.id }] };
  const view = harness('src/ui/entry-form.tsx', { kind: 'expense' }, { data });
  const describe = find(view.render(), 'AccountField').props.describe;
  // Before 23.1C2 an overdrawn account read "saldo 500,00" and a card in credit "deuda 25,00".
  assert.equal([account, overdrawn, cardAccount, creditCard, clearCard].map(describe).join('|'), 'saldo 876,55|saldo -500,00|deuda 50,00|a favor 25,00|sin deuda');
  const detail = (id: string) => { find(view.render(), 'AccountField').props.onChange(id); return find(view.render(), 'AccountField').props.detail; };
  assert.equal(detail('red'), 'Saldo registrado −$ 500,00', 'the selected card shows the same signed balance');
  assert.equal(detail('credit-acc'), 'Tarjeta de crédito · a favor $ 25,00');
  assert.equal(detail('clear-acc'), 'Tarjeta de crédito · sin deuda');
  const english = find(harness('src/ui/entry-form.tsx', { kind: 'expense' }, { data, locale: 'en-US' }).render(), 'AccountField').props.describe;
  assert.equal([account, overdrawn, cardAccount, creditCard, clearCard].map(english).join('|'), 'balance 876.55|balance -500.00|owed 50.00|in credit 25.00|nothing owed');
  // VoiceOver hears each option's line after its name, kind and currency: the spoken amount with the currency in words, as the selected card says it.
  const spoken = (locale: AppLocale) => find(harness('src/ui/entry-form.tsx', { kind: 'expense' }, { data, locale }).render(), 'AccountField').props.spokenDescribe;
  assert.equal([account, overdrawn, cardAccount, creditCard, clearCard].map(spoken('es-AR')).join('|'),
    'saldo 876,55 pesos|saldo Menos 500,00 pesos|deuda 50,00 pesos|a favor 25,00 pesos|sin deuda');
  assert.equal([account, overdrawn, cardAccount, creditCard, clearCard].map(spoken('en-US')).join('|'),
    'balance 876.55 pesos|balance Minus 500.00 pesos|owed 50.00 pesos|in credit 25.00 pesos|nothing owed');
  const rich: domain.Account = { ...account, id: 'rich', name: 'Ahorro', openingMinor: 123456789 };
  const wide = { ...data, accounts: [...data.accounts, rich] };
  const shown = find(harness('src/ui/entry-form.tsx', { kind: 'expense' }, { data: wide, locale: 'es-US' }).render(), 'AccountField').props;
  assert.equal(shown.describe(rich) + '|' + shown.spokenDescribe(rich), 'saldo 1,234,567.89|saldo 1234567,89 pesos', 'the sheet groups in the region\'s separators, the voice never does');
});

test('23.1C2: Save echoes the amount in the region\'s format on screen and in the spoken form for VoiceOver; editing and retrying have no echo', async () => {
  const cases = [
    ['es-AR', 'Guardar gasto\u00A0·\u00A0$\u00A01.234,50', 'Guardar gasto, 1234,50 pesos'],
    ['es-US', 'Guardar gasto\u00A0·\u00A0AR$\u00A01,234.50', 'Guardar gasto, 1234,50 pesos'],
    ['en-AR', 'Save expense\u00A0·\u00A0$\u00A01.234,50', 'Save expense, 1234.50 pesos'],
    ['en-US', 'Save expense\u00A0·\u00A0AR$\u00A01,234.50', 'Save expense, 1234.50 pesos'],
  ] as const;
  for (const [locale, shown, spoken] of cases) {
    const view = harness('src/ui/entry-form.tsx', { kind: 'expense' }, { data: liabilityData, locale });
    assert.equal(find(view.render(), 'ActionButton').props.spokenLabel, undefined, locale + ': no amount yet, nothing to echo');
    find(view.render(), 'AmountField').props.onChangeText('1234,5');
    const save = find(view.render(), 'ActionButton');
    assert.equal(save.props.label + '|' + save.props.spokenLabel, shown + '|' + spoken, locale);
  }
  const income = harness('src/ui/entry-form.tsx', { kind: 'income', currency: 'USD' }, { locale: 'en-US' });
  find(income.render(), 'AmountField').props.onChangeText('20');
  assert.equal(find(income.render(), 'ActionButton').props.spokenLabel, 'Save income, 20.00 dollars');
  const editing = harness('src/ui/entry-form.tsx', { original: archive.records[0] }, { update: async () => { throw new Error('Refresh failed after commit'); } });
  find(editing.render(), 'AmountField').props.onChangeText('1');
  assert.equal(find(editing.render(), 'ActionButton', 'Guardar cambios').props.spokenLabel, undefined);
  await find(editing.render(), 'ActionButton').props.onPress();
  assert.equal(find(editing.render(), 'ActionButton', 'Reintentar guardado').props.spokenLabel, undefined);
});

test('23.1C2: the entry form and the entry detail give VoiceOver the language’s numbers for the balance and the budget', () => {
  const budget: domain.MonthlyBudget = { id: 'b', scope: 'category', category: 'Salud', currency: 'ARS', monthISO: domain.todayKey().slice(0, 7), amountMinor: 50000, active: true, createdAt, revision: 0, updatedAt: createdAt };
  const cases = [
    ['es-US', 'Saldo registrado AR$ 876.55', 'Saldo registrado 876,55 pesos', 'AR$ 0.00 de AR$ 500.00 este mes', '0,00 pesos de 500,00 pesos este mes',
      'Tarjeta de crédito · deuda AR$ 50.00', 'Tarjeta de crédito · deuda 50,00 pesos'],
    ['en-AR', 'Recorded balance $ 876,55', 'Recorded balance 876.55 pesos', '$ 0,00 of $ 500,00 this month', '0.00 pesos of 500.00 pesos this month',
      'Credit card · owed $ 50,00', 'Credit card · owed 50.00 pesos'],
  ] as const;
  for (const [locale, balance, spokenBalance, budgetText, spokenBudget, cardText, spokenCard] of cases) {
    const view = harness('src/ui/entry-form.tsx', { kind: 'expense' }, { data: { ...liabilityData, budgets: [budget] }, locale });
    const field = find(view.render(), 'AccountField');
    assert.equal(field.props.detail + '|' + field.props.spokenDetail, balance + '|' + spokenBalance, locale);
    find(view.render(), 'CategoryField').props.onChange('Salud');
    const category = find(view.render(), 'CategoryField');
    assert.equal(category.props.detail + '|' + category.props.spokenDetail, budgetText + '|' + spokenBudget, locale);
    find(view.render(), 'AccountField').props.onChange('card-acc');
    const card = find(view.render(), 'AccountField');
    assert.equal(card.props.detail + '|' + card.props.spokenDetail, cardText + '|' + spokenCard, locale);
  }
  // The entry detail's budget row: the screen writes the region's separators, VoiceOver the language's, with the currency in words.
  const monthly: domain.MonthlyBudget = { ...budget, category: 'salud', monthISO: '2026-01', amountMinor: 20000 };
  const row = (locale: AppLocale, amountMinor = 20000) => {
    const node = find(harness('app/entry/[id].tsx', {}, { data: { ...archive, budgets: [{ ...monthly, amountMinor }] }, params: { id: entry.id }, locale }).render(),
      'DetailRow', locale.startsWith('en') ? 'Budget' : 'Presupuesto');
    return node.props.value + '|' + node.props.spokenValue;
  };
  assert.equal(row('es-AR'), '62 % usado · quedan 76,55|62 % usado · quedan 76,55 pesos');
  assert.equal(row('es-US'), '62 % usado · quedan 76.55|62 % usado · quedan 76,55 pesos');
  assert.equal(row('en-AR'), '62% used · 76,55 left|62% used · 76.55 pesos left');
  assert.equal(row('en-US', 10000), 'Over by 23.45|Over by 23.45 pesos');
  assert.equal(row('es-US', 10000), 'Excedido por 23.45|Excedido por 23,45 pesos');
});

test('23.1C2: the backup review groups its counts on screen and gives VoiceOver the plain digits', async () => {
  // 1.234 movements: "1,234" in the United States would be a decimal to a Spanish voice.
  const records = Array.from({ length: 1234 }, (_, index) => domain.initialRecord({ ...entry, id: 'bulk-' + index }));
  const json = JSON.stringify(domain.createRecoveryBackup({ ...archive, records }));
  const picker = async () => ({ canceled: false, result: { size: json.length, name: 'test.json', text: async () => json } });
  const view = harness('app/backup-import.tsx', {}, { data: { accounts: [], records: [] }, picker, locale: 'es-US' });
  await find(view.render(), 'ActionButton', 'Elegir copia').props.onPress();
  const rows = nodes(view.render()).filter(node => node.type === 'DetailRow');
  assert.equal(rows.map(row => row.props.value + '/' + row.props.spokenValue).join(','), '2/2,0/0,0/0,1,234/1234,0/0,0/0,0/0,0/0,0/0');
});

test('24B2: switching the account with a half-typed amount keeps the digits and blocks Save when the new currency cannot hold them exactly', async () => {
  const yen: domain.Account = { ...account, id: 'jpy', name: 'Yen', currency: 'JPY' };
  const view = harness('src/ui/entry-form.tsx', {}, { data: { ...archive, accounts: [...archive.accounts, yen] } });
  find(view.render(), 'AmountField').props.onChangeText('12,50');
  find(view.render(), 'CategoryField').props.onChange('Comida');
  find(view.render(), 'Field').props.onChangeText('Kiosco');
  assert.equal(find(view.render(), 'ActionButton').props.disabled, false);
  find(view.render(), 'AccountField').props.onChange('jpy');
  let root = view.render();
  assert.equal(find(root, 'AmountField').props.value, '12,50', 'the draft is kept exactly, never truncated or rescaled');
  assert.equal(find(root, 'AmountField').props.currency, 'JPY');
  assert.equal(find(root, 'ActionButton').props.disabled, true, 'Save is blocked while the amount cannot be kept in yen');
  assert.equal(view.additions.length, 0);
  find(root, 'AccountField').props.onChange('u');
  root = view.render();
  assert.deepEqual([find(root, 'AmountField').props.value, find(root, 'AmountField').props.currency, find(root, 'ActionButton').props.disabled], ['12,50', 'USD', false], 'ARS ↔ USD is a no-op');
  find(root, 'AmountField').props.onChangeText('13');
  find(view.render(), 'AccountField').props.onChange('jpy');
  root = view.render();
  assert.equal(find(root, 'ActionButton').props.disabled, false);
  await find(root, 'ActionButton').props.onPress();
  assert.deepEqual([view.additions[0].accountId, view.additions[0].amountMinor], ['jpy', 13], 'thirteen yen, not thirteen hundred');
});

test('24B2 review: a movement whose stored amount exceeds the entry bound (a restored backup) can be corrected without re-typing it; an edited amount is re-read', async () => {
  const huge: domain.Entry = { ...entry, id: 'huge', amountMinor: domain.MAX_ENTRY_MINOR + 1 };
  domain.validateEntry(huge, [account]); // a valid stored amount: any safe integer
  const data: domain.LedgerArchive = { ...archive, accounts: [...archive.accounts, { ...account, id: 'jpy', name: 'Yen', currency: 'JPY' }], records: [domain.initialRecord(huge)] };
  let view = harness('src/ui/entry-form.tsx', { original: data.records[0] }, { data });
  assert.equal(find(view.render(), 'AmountField').props.value, '10.000.000.000.000,00');
  assert.equal(find(view.render(), 'ActionButton').props.disabled, false);
  find(view.render(), 'CategoryField').props.onChange('Regalo');
  await find(view.render(), 'ActionButton', 'Guardar cambios').props.onPress();
  assert.equal(view.updates.length, 1);
  assert.deepEqual([view.updates[0].after.entry.amountMinor, view.updates[0].after.entry.category], [domain.MAX_ENTRY_MINOR + 1, 'Regalo'], 'the stored amount is kept exactly');
  // Editing the text re-reads it with the entry bound: refused, nothing written.
  view = harness('src/ui/entry-form.tsx', { original: data.records[0] }, { data });
  find(view.render(), 'AmountField').props.onChangeText('10.000.000.000.000,01');
  assert.equal(find(view.render(), 'ActionButton').props.disabled, true, 'Save is blocked while the edited amount does not fit');
  await find(view.render(), 'ActionButton').props.onPress();
  assert.equal(view.updates.length, 0);
  // Moving the untouched draft to an account in another currency is not "unchanged": the currency guard still applies.
  view = harness('src/ui/entry-form.tsx', { original: data.records[0] }, { data });
  assert.deepEqual(find(view.render(), 'AccountField').props.accounts.map((a: domain.Account) => a.id), ['a'], 'an edit only offers accounts in the movement\'s currency, so the kept amount can never change currency');
});

// ---- Producto 24B6: cards carry purchases and payments, never a plain income -------------------------------

test('24B6: the income form offers cash accounts only; the expense form keeps cash and cards; switching Gasto → Ingreso with a card chosen falls back to cash in the same currency and finds the card again on the way back', () => {
  const income = harness('src/ui/entry-form.tsx', { kind: 'income', accountId: 'card-acc' }, { data: liabilityData });
  let field = find(income.render(), 'AccountField');
  assert.equal(field.props.label, 'Ingresa en');
  assert.deepEqual(field.props.accounts.map((item: domain.Account) => item.id), ['a', 'u'], 'no card, no debt');
  assert.equal(field.props.value, 'a', 'a card asked for by the link gives way to cash in the same currency');
  assert.equal(find(income.render(), 'Stack.Screen').props.options.title, 'Registrar ingreso');
  // The hosted form: the same instance switches kind as state (movement-form), so the chosen card must not leak into the income.
  let kind = 'expense';
  const hosted = harness('src/ui/entry-form.tsx', { get kind() { return kind; }, accountId: 'a', onKindChange: () => {} }, { data: liabilityData });
  find(hosted.render(), 'AccountField').props.onChange('card-acc');
  field = find(hosted.render(), 'AccountField');
  assert.deepEqual([field.props.value, field.props.accounts.map((item: domain.Account) => item.id)], ['card-acc', ['a', 'u', 'card-acc']]);
  kind = 'income';
  field = find(hosted.render(), 'AccountField');
  assert.deepEqual([field.props.value, field.props.accounts.map((item: domain.Account) => item.id)], ['a', ['a', 'u']], 'Ingreso: cash in the card\'s currency');
  assert.equal(find(hosted.render(), 'AmountField').props.currency, 'ARS');
  kind = 'expense';
  assert.equal(find(hosted.render(), 'AccountField').props.value, 'card-acc', 'back on Gasto the card is still the choice');
});

test('24B6: a historical income on a card (a refund from before) opens on that card, is corrected in place and saved with the same account; a new income can never be saved on a card', async () => {
  const refund: domain.Entry = { ...entry, id: 'refund', kind: 'income', accountId: 'card-acc', amountMinor: 2500, merchant: 'Devolución', category: 'Café' };
  const data: domain.LedgerArchive = { ...liabilityData, records: [...liabilityData.records, domain.initialRecord(refund)] };
  const editing = harness('src/ui/entry-form.tsx', { original: domain.initialRecord(refund) }, { data });
  let root = editing.render();
  const field = find(root, 'AccountField');
  assert.deepEqual([field.props.value, field.props.accounts.map((item: domain.Account) => item.id)], ['card-acc', ['a', 'card-acc']], 'the card stays offered for its own historical income, beside cash in that currency');
  assert.equal(field.props.typeOf('card-acc'), 'card');
  find(root, 'AmountField').props.onChangeText('26');
  await find(editing.render(), 'ActionButton', 'Guardar cambios').props.onPress();
  assert.equal(editing.updates.length, 1);
  assert.deepEqual([editing.updates[0].after.entry.accountId, editing.updates[0].after.entry.kind, editing.updates[0].after.entry.amountMinor], ['card-acc', 'income', 2600]);
  // A new income with the storage refusing a card: the form shows the sentence and keeps the draft.
  const refused = harness('src/ui/entry-form.tsx', { kind: 'income' }, { data: liabilityData, add: async () => { throw new Error('Un ingreso se registra en una cuenta normal, no en una tarjeta.'); } });
  root = refused.render();
  find(root, 'AmountField').props.onChangeText('10');
  find(root, 'Field').props.onChangeText('Sueldo');
  find(root, 'CategoryField').props.onChange('Sueldo');
  await find(refused.render(), 'ActionButton').props.onPress();
  assert.equal(find(refused.render(), 'ErrorMessage').props.message, 'Un ingreso se registra en una cuenta normal, no en una tarjeta.');
  assert.equal(find(refused.render(), 'AmountField').props.value, '10', 'the draft is kept');
});

test('24B6: the plain transfer never offers a card on either side, a link asking to transfer out of a card opens a plain transfer, and Pagar tarjeta still fixes the card as the destination with same-currency cash sources', () => {
  const usdCard: domain.Account = { ...cardAccount, id: 'usd-card', name: 'Visa USD', currency: 'USD' };
  const data: domain.LedgerArchive = { ...liabilityData, accounts: [...liabilityData.accounts, usdCard], cards: [card, { ...card, id: 'usd', accountId: usdCard.id }] };
  const plain = harness('src/ui/transfer-form.tsx', { accountId: 'a' }, { data });
  assert.deepEqual(find(plain.render(), 'AccountField', 'Desde').props.accounts.map((item: domain.Account) => item.id), ['a', 'u']);
  assert.deepEqual(find(plain.render(), 'AccountField', 'Hacia').props.accounts.map((item: domain.Account) => item.id), [], 'no other ARS cash account: nothing to pick, never the card or the debt');
  const outOfCard = harness('src/ui/transfer-form.tsx', { fromAccountId: 'card-acc' }, { data });
  const root = outOfCard.render();
  assert.equal(nodes(root).some(node => node.type === 'SelectorCard'), false, 'the card is not locked as a source');
  assert.equal(find(root, 'Stack.Screen').props.options.title, 'Entre mis cuentas', 'a plain transfer, not a collection');
  assert.deepEqual(find(root, 'AccountField', 'Desde').props.accounts.map((item: domain.Account) => item.id), ['a', 'u']);
  const payment = harness('src/ui/transfer-form.tsx', { toAccountId: 'usd-card', maxAmountMinor: '5000' }, { data });
  const paying = payment.render();
  assert.equal(find(paying, 'Stack.Screen').props.options.title, 'Pagar tarjeta');
  assert.equal(find(paying, 'SelectorCard').props.value, 'Visa USD', 'the card is the fixed destination');
  assert.deepEqual(find(paying, 'AccountField', 'Desde').props.accounts.map((item: domain.Account) => item.id), ['u'], 'only cash in the card\'s currency');
  assert.equal(find(paying, 'AmountField').props.currency, 'USD');
});

test('24B6: a recurring income offers cash accounts only, a card chosen for a recurring expense gives way to cash when the kind flips, and a rule already paying an income into a card keeps that card while it is edited', async () => {
  const view = harness('src/ui/recurring-form.tsx', { accountId: 'card-acc' }, { data: liabilityData });
  let root = view.render();
  assert.deepEqual([find(root, 'AccountField').props.value, find(root, 'AccountField').props.accounts.map((item: domain.Account) => item.id)], ['card-acc', ['a', 'u', 'card-acc']], 'a recurring purchase on the card is fine');
  find(root, 'Choices').props.onChange('income');
  root = view.render();
  assert.deepEqual([find(root, 'AccountField').props.value, find(root, 'AccountField').props.accounts.map((item: domain.Account) => item.id)], ['a', ['a', 'u']], 'Ingreso: cash in the card\'s currency');
  find(root, 'AmountField').props.onChangeText('100');
  find(root, 'Field').props.onChangeText('Sueldo');
  find(root, 'CategoryField').props.onChange('Sueldo');
  await find(view.render(), 'ActionButton').props.onPress();
  assert.deepEqual([view.rules[0].kind, view.rules[0].accountId], ['income', 'a']);
  const legacy: domain.RecurringRule = { id: 'cashback', accountId: 'card-acc', kind: 'income', amountMinor: 500, merchant: 'Cashback', category: 'Otros', frequency: 'monthly',
    anchorDateISO: '2026-01-05', nextDateISO: '2026-10-05', active: true, deleted: false, createdAt, revision: 0, updatedAt: createdAt };
  const editing = harness('src/ui/recurring-form.tsx', { original: legacy }, { data: { ...liabilityData, recurring: [legacy] } });
  const field = find(editing.render(), 'AccountField');
  assert.deepEqual([field.props.value, field.props.accounts.map((item: domain.Account) => item.id)], ['card-acc', ['a', 'card-acc']], 'its own card stays offered beside cash in that currency');
});

// ---- 24B6 review: a ledger holding only cards ---------------------------------------------------------------

const cardOnly: domain.LedgerArchive = { accounts: [cardAccount, { ...cardAccount, id: 'usd-card', name: 'Visa USD', currency: 'USD' }], records: [],
  cards: [card, { ...card, id: 'usd', accountId: 'usd-card' }] };

test('24B6 review: with only cards, Gasto still records a card purchase; Ingreso shows the no-account state with Agregar cuenta (pushed, the card\'s currency prefilled) and keeps the expense draft for the way back; a mixed ledger never shows it', async () => {
  let kind = 'expense';
  const view = harness('src/ui/entry-form.tsx', { get kind() { return kind; }, accountId: 'usd-card', onKindChange: () => {} }, { data: cardOnly });
  let root = view.render();
  assert.deepEqual([find(root, 'AccountField').props.value, find(root, 'AccountField').props.accounts.map((item: domain.Account) => item.id)], ['usd-card', ['card-acc', 'usd-card']]);
  assert.equal(find(root, 'Stack.Screen').props.options.title, 'Compra con tarjeta');
  assert.equal(nodes(root).some(node => node.type === 'EmptyState'), false);
  find(root, 'AmountField').props.onChangeText('12,50');
  find(root, 'Field').props.onChangeText('Steam');
  kind = 'income';
  root = view.render();
  const empty = find(root, 'EmptyState');
  assert.equal(empty.props.title, 'Primero, una cuenta');
  assert.equal(empty.props.detail, 'Un ingreso se registra en una cuenta normal, no en una tarjeta. Agregá una para continuar.');
  assert.equal(nodes(root).some(node => node.type === 'AccountField' || node.type === 'AmountField' || node.type === 'ActionButton' && node.props.label !== 'Agregar cuenta'), false, 'no empty picker, no disabled Save');
  assert.equal(nodes(root).some(node => node.type === 'Choices'), false, 'the host owns the Gasto / Ingreso switch');
  empty.props.action.props.onPress();
  assert.equal(JSON.stringify(view.pushed[0]), JSON.stringify({ pathname: '/new-account', params: { currency: 'USD' } }), 'pushed over the modal, in the carried card\'s currency');
  kind = 'expense';
  root = view.render();
  assert.equal(nodes(root).some(node => node.type === 'EmptyState'), false);
  assert.deepEqual([find(root, 'AccountField').props.value, find(root, 'AmountField').props.value, find(root, 'Field').props.value], ['usd-card', '12,50', 'Steam'], 'the draft and the card survive the round trip');
  find(root, 'CategoryField').props.onChange('Juegos');
  await find(view.render(), 'ActionButton').props.onPress();
  assert.deepEqual([view.additions[0].kind, view.additions[0].accountId, view.additions[0].amountMinor], ['expense', 'usd-card', 1250], 'a card purchase, saved once');
  // The form's own switch stays visible above the empty state, so Gasto is one tap away.
  const own = harness('src/ui/entry-form.tsx', { kind: 'income', accountId: 'card-acc' }, { data: cardOnly });
  root = own.render();
  assert.equal(find(root, 'EmptyState').props.title, 'Primero, una cuenta');
  assert.equal(find(root, 'Choices').props.value, 'income');
  find(root, 'Choices').props.onChange('expense');
  root = own.render();
  assert.equal(nodes(root).some(node => node.type === 'EmptyState'), false);
  assert.equal(find(root, 'AccountField').props.value, 'card-acc');
  // An empty ledger keeps the original no-account state (replace, no currency).
  const none = harness('src/ui/entry-form.tsx', { kind: 'income' }, { data: { accounts: [], records: [] } });
  root = none.render();
  assert.equal(find(root, 'EmptyState').props.detail, 'Cada movimiento necesita una cuenta para actualizar su saldo.');
  assert.equal(nodes(root).some(node => node.type === 'Choices'), false, 'nothing to switch between without an account');
  find(root, 'EmptyState').props.action.props.onPress();
  assert.equal(none.pushed[0], '/new-account');
  // A mixed ledger: an income lands on cash, never on the empty state.
  const mixed = harness('src/ui/entry-form.tsx', { kind: 'income', accountId: 'card-acc' }, { data: liabilityData });
  root = mixed.render();
  assert.equal(nodes(root).some(node => node.type === 'EmptyState'), false);
  assert.equal(find(root, 'AccountField').props.value, 'a');
});

test('24B6 review: a historical card income in a card-only ledger still opens on its card and saves there with the same identity and revision', async () => {
  const refund: domain.Entry = { ...entry, id: 'refund', kind: 'income', accountId: 'card-acc', amountMinor: 2500, merchant: 'Devolución', category: 'Café' };
  const data: domain.LedgerArchive = { ...cardOnly, records: [domain.initialRecord(refund)] };
  const view = harness('src/ui/entry-form.tsx', { original: domain.initialRecord(refund) }, { data });
  let root = view.render();
  assert.equal(nodes(root).some(node => node.type === 'EmptyState'), false, 'its own card is eligible');
  assert.deepEqual([find(root, 'AccountField').props.value, find(root, 'AccountField').props.accounts.map((item: domain.Account) => item.id)], ['card-acc', ['card-acc']]);
  find(root, 'AmountField').props.onChangeText('30');
  await find(view.render(), 'ActionButton', 'Guardar cambios').props.onPress();
  assert.equal(view.updates.length, 1);
  assert.deepEqual([view.updates[0].before.entry.id, view.updates[0].after.entry.id, view.updates[0].after.entry.accountId, view.updates[0].after.entry.kind, view.updates[0].after.revision, view.updates[0].after.entry.amountMinor],
    ['refund', 'refund', 'card-acc', 'income', 1, 3000]);
});

test('24B6 review: a recurring income in a card-only ledger shows the no-account state under the switch, Gasto brings the card and the draft back, and a historical card income rule is edited without changing its identity', async () => {
  const view = harness('src/ui/recurring-form.tsx', { accountId: 'card-acc' }, { data: cardOnly });
  let root = view.render();
  assert.deepEqual([find(root, 'AccountField').props.value, find(root, 'AccountField').props.accounts.map((item: domain.Account) => item.id)], ['card-acc', ['card-acc', 'usd-card']]);
  find(root, 'AmountField').props.onChangeText('999');
  find(root, 'Choices').props.onChange('income');
  root = view.render();
  const empty = find(root, 'EmptyState');
  assert.equal(empty.props.title, 'Primero, una cuenta');
  assert.equal(empty.props.detail, 'Un ingreso recurrente se registra en una cuenta normal, no en una tarjeta. Agregá una para continuar.');
  assert.equal(find(root, 'Choices').props.value, 'income', 'the switch stays above the empty state');
  assert.equal(nodes(root).some(node => node.type === 'AccountField' || node.type === 'AmountField'), false, 'no empty selector, no disabled Create');
  empty.props.action.props.onPress();
  assert.equal(JSON.stringify(view.pushed[0]), JSON.stringify({ pathname: '/new-account', params: { currency: 'ARS' } }));
  find(root, 'Choices').props.onChange('expense');
  root = view.render();
  assert.equal(nodes(root).some(node => node.type === 'EmptyState'), false);
  assert.deepEqual([find(root, 'AccountField').props.value, find(root, 'AmountField').props.value], ['card-acc', '999'], 'the card and the draft come back');
  assert.equal(view.rules.length, 0, 'nothing was written');
  const none = harness('src/ui/recurring-form.tsx', {}, { data: { accounts: [], records: [] } });
  root = none.render();
  assert.equal(find(root, 'EmptyState').props.detail, 'Los recurrentes necesitan una cuenta para registrar cada vencimiento en la moneda correcta.');
  assert.equal(nodes(root).some(node => node.type === 'Choices'), false);
  const legacy: domain.RecurringRule = { id: 'cashback', accountId: 'card-acc', kind: 'income', amountMinor: 500, merchant: 'Cashback', category: 'Otros', frequency: 'monthly',
    anchorDateISO: '2026-01-05', nextDateISO: '2026-10-05', active: true, deleted: false, createdAt, revision: 0, updatedAt: createdAt };
  const editing = harness('src/ui/recurring-form.tsx', { original: legacy }, { data: { ...cardOnly, recurring: [legacy] } });
  root = editing.render();
  assert.equal(nodes(root).some(node => node.type === 'EmptyState'), false, 'its own card is eligible');
  assert.deepEqual([find(root, 'AccountField').props.value, find(root, 'AccountField').props.accounts.map((item: domain.Account) => item.id)], ['card-acc', ['card-acc']]);
  find(root, 'AmountField').props.onChangeText('6');
  await find(editing.render(), 'ActionButton').props.onPress();
  assert.equal(editing.rules.length, 1);
  assert.deepEqual([editing.rules[0].id, editing.rules[0].accountId, editing.rules[0].kind, editing.rules[0].amountMinor, editing.rules[0].revision, editing.rules[0].createdAt],
    ['cashback', 'card-acc', 'income', 600, 1, createdAt], 'same rule, same card, one revision up');
});

// ---- 24UX2: what a recurring rule actually recorded ------------------------------------------------------------

const streaming: domain.RecurringRule = { id: 'netflix', accountId: 'a', kind: 'expense', amountMinor: 899900, merchant: 'Netflix', category: 'Suscripciones', frequency: 'monthly',
  anchorDateISO: '2026-07-05', nextDateISO: '2026-10-05', active: true, deleted: false, createdAt, revision: 3, updatedAt: createdAt };
const occurrence = (dateISO: string): domain.Entry => ({ id: domain.recurringEntryId(streaming.id, dateISO), accountId: 'a', kind: 'expense', amountMinor: 899900,
  merchant: 'Netflix', category: 'Suscripciones', dateISO, createdAt: dateISO + 'T12:00:00.000Z' });
const historyOf = (root: Node) => {
  const section = nodes(root).find(node => typeof node.type === 'function' && node.type.name === 'RecurringHistory');
  assert.ok(section, 'the history section');
  return (section.type as (props: any) => Node)(section.props);
};

test('24UX2: a rule\'s detail lists only the movements it recorded, newest first, and never its scheduled dates', () => {
  const manual: domain.Entry = { ...occurrence('2026-09-05'), id: 'manual-netflix' };
  const data: domain.LedgerArchive = { ...archive, recurring: [streaming],
    records: [...archive.records, ...['2026-07-05', '2026-08-05', '2026-09-05'].map(date => domain.initialRecord(occurrence(date))), domain.initialRecord(manual)] };
  const history = historyOf(harness('src/ui/recurring-form.tsx', { original: streaming }, { data }).render());
  assert.equal(find(history, 'SectionTitle').props.children, 'Registrados');
  assert.match(find(history, 'SectionTitle').props.caption, /estimación/);
  const rows = nodes(history).filter(node => node.type === 'EntryRow');
  assert.equal(rows.map(node => node.props.entry.dateISO).join(','), '2026-09-05,2026-08-05,2026-07-05', 'the typed movement of the same merchant is not claimed');
  assert.equal(rows.every(node => node.props.showAccount === false), true);
  assert.equal(rows.some(node => node.props.entry.dateISO === streaming.nextDateISO), false, 'the next date is not a payment');
  // A rule that has not recorded anything says so; a new rule shows no history at all.
  const fresh = historyOf(harness('src/ui/recurring-form.tsx', { original: streaming }, { data: { ...archive, recurring: [streaming] } }).render());
  assert.equal(nodes(fresh).filter(node => node.type === 'AppText').map(node => node.props.children).join('|'), 'Todavía no registró ningún movimiento.');
  assert.equal(nodes(harness('src/ui/recurring-form.tsx', {}, { data: archive }).render()).some(node => typeof node.type === 'function' && node.type.name === 'RecurringHistory'), false);
});

test('24UX2: a long history shows the latest twelve and counts the rest; an undone occurrence is not listed', () => {
  const dates = Array.from({ length: 15 }, (_, index) => `2025-${String((index % 12) + 1).padStart(2, '0')}-${index < 12 ? '05' : '06'}`);
  const records = dates.map(date => domain.initialRecord(occurrence(date)));
  records[0] = { ...records[0], voided: true };
  const history = historyOf(harness('src/ui/recurring-form.tsx', { original: streaming }, { data: { ...archive, recurring: [streaming], records } }).render());
  assert.equal(nodes(history).filter(node => node.type === 'EntryRow').length, 12);
  assert.ok(nodes(history).some(node => node.type === 'AppText' && node.props.children === 'Y 2 registros anteriores en Movimientos.'));
});

test('24UX2: a movement a rule recorded links back to its rule from the detail; any other movement does not, and neither does one whose rule is gone', () => {
  const recorded = occurrence('2026-09-05');
  const data: domain.LedgerArchive = { ...archive, recurring: [streaming], records: [...archive.records, domain.initialRecord(recorded)] };
  const view = harness('app/entry/[id].tsx', {}, { data, params: { id: recorded.id } });
  const row = find(view.render(), 'DetailRow', 'Recurrente');
  assert.equal(row.props.value, 'Mensual');
  row.props.onPress();
  assert.equal(JSON.stringify(view.pushed.at(-1)), JSON.stringify({ pathname: '/edit-recurring/[id]', params: { id: 'netflix' } }));
  const badge = find(view.render(), 'MerchantBadge');
  assert.equal(JSON.stringify([badge.props.merchant, badge.props.category, badge.props.large]), JSON.stringify(['Netflix', 'Suscripciones', true]));
  assert.equal(nodes(harness('app/entry/[id].tsx', {}, { params: { id: entry.id } }).render()).some(node => node.type === 'DetailRow' && node.props.label === 'Recurrente'), false);
  const orphan = harness('app/entry/[id].tsx', {}, { data: { ...data, recurring: [] }, params: { id: recorded.id } });
  assert.equal(nodes(orphan.render()).some(node => node.type === 'DetailRow' && node.props.label === 'Recurrente'), false);
});

test('24UX2 review: the history names each row\'s own account when the rule moved or an occurrence was corrected, and hides it only when every row is in the rule\'s current account', () => {
  const second: domain.Account = { ...account, id: 'a2', name: 'Efectivo ARS' };
  const dates = ['2026-07-05', '2026-08-05', '2026-09-05'];
  const rowsOf = (rule: domain.RecurringRule, entries: domain.Entry[]) => {
    const data: domain.LedgerArchive = { ...archive, accounts: [...archive.accounts, second], recurring: [rule], records: entries.map(domain.initialRecord) };
    return nodes(historyOf(harness('src/ui/recurring-form.tsx', { original: rule }, { data }).render())).filter(node => node.type === 'EntryRow');
  };
  const owned = (rows: Node[]) => rows.map(node => node.props.entry.dateISO + '@' + node.props.account.id + (node.props.showAccount ? '+name' : '')).join(',');
  // Every occurrence in the rule's current account: the name would repeat the form above.
  assert.equal(owned(rowsOf(streaming, dates.map(occurrence))), '2026-09-05@a,2026-08-05@a,2026-07-05@a');
  // The rule moved to Efectivo ARS after recording in Prueba ARS: every row names Prueba ARS, never the current account.
  assert.equal(owned(rowsOf({ ...streaming, accountId: 'a2' }, dates.map(occurrence))), '2026-09-05@a+name,2026-08-05@a+name,2026-07-05@a+name');
  // One occurrence corrected onto Efectivo ARS: every row names its own account.
  const corrected = dates.map(occurrence).map(entry => entry.dateISO === '2026-08-05' ? { ...entry, accountId: 'a2' } : entry);
  assert.equal(owned(rowsOf(streaming, corrected)), '2026-09-05@a+name,2026-08-05@a2+name,2026-07-05@a+name');
});

// ---- Producto 24UX4: pause, resume and delete from a rule's detail --------------------------------------------
const settleAsync = async () => { await new Promise(resolve => setImmediate(resolve)); };

test('24UX4: a rule\'s detail ends with Pausar recurrente and a red Eliminar recurrente; pausing saves the stored rule, not the draft, then closes', async () => {
  const data: domain.LedgerArchive = { ...archive, recurring: [streaming] };
  const view = harness('src/ui/recurring-form.tsx', { original: streaming }, { data });
  const root = view.render();
  const labels = nodes(root).filter(node => node.type === 'ActionButton').map(node => node.props.label).join(',');
  assert.equal(labels, 'Guardar cambios,Pausar recurrente,Eliminar recurrente');
  assert.equal(find(root, 'ActionButton', 'Eliminar recurrente').props.tone, 'expense');
  // An edited, unsaved draft is not what Pausar writes.
  find(root, 'Field', 'Comercio o concepto').props.onChangeText?.('Otro nombre');
  await find(view.render(), 'ActionButton', 'Pausar recurrente').props.onPress();
  await settleAsync();
  assert.equal(view.rules.length, 1);
  assert.equal(JSON.stringify({ ...view.rules[0], updatedAt: '' }), JSON.stringify({ ...streaming, active: false, revision: 4, updatedAt: '' }));
  assert.equal(view.backs(), 1, 'the detail closes after a durable save');
  // Paused: the detail says what pausing means and offers Reanudar.
  const paused = { ...streaming, active: false, revision: 4 };
  const pausedRoot = harness('src/ui/recurring-form.tsx', { original: paused }, { data: { ...archive, recurring: [paused] } }).render();
  assert.ok(nodes(pausedRoot).some(node => node.type === 'AppText' && String(node.props.children).startsWith('Pausado: no registra nada')));
  find(pausedRoot, 'ActionButton', 'Reanudar recurrente');
});

test('24UX4: Eliminar recurrente asks first, names the recorded movements, and on confirmation writes the deletion record and closes', async () => {
  const data: domain.LedgerArchive = { ...archive, recurring: [streaming], records: [...archive.records, domain.initialRecord(occurrence('2026-09-05'))] };
  const view = harness('src/ui/recurring-form.tsx', { original: streaming }, { data });
  find(view.render(), 'ActionButton', 'Eliminar recurrente').props.onPress();
  assert.equal(view.rules.length, 0);
  const alert = view.alerts[0];
  assert.equal(alert.title, '¿Eliminar «Netflix»?');
  assert.equal(alert.message, 'Deja de registrarse. El movimiento que ya registró sigue en Movimientos.');
  await alert.buttons[1].onPress();
  await settleAsync();
  assert.equal(JSON.stringify({ ...view.rules[0], updatedAt: '' }), JSON.stringify({ ...streaming, active: false, deleted: true, revision: 4, updatedAt: '' }));
  assert.equal(view.backs(), 1);
  // While the screen closes on a rule just deleted, the form stays drawn without its actions (no «not found» flash).
  const closing = harness('app/edit-recurring/[id].tsx', {}, { data, params: { id: 'netflix' } });
  assert.equal(closing.render().type, 'RecurringForm', 'opened on the live rule');
  closing.setData({ ...data, recurring: [view.rules[0]] });
  const kept = closing.render();
  assert.equal(nodes(kept).some(node => node.type === 'EmptyState'), false);
  assert.equal(kept.type, 'RecurringForm');
  // A deep link to a deleted rule finds nothing; the movement it recorded is a plain movement.
  const deletedData = { ...data, recurring: [view.rules[0]] };
  assert.equal(find(harness('app/edit-recurring/[id].tsx', {}, { data: deletedData, params: { id: 'netflix' } }).render(), 'EmptyState').props.title, 'No encontramos este recurrente');
  const movement = harness('app/entry/[id].tsx', {}, { data: deletedData, params: { id: occurrence('2026-09-05').id } }).render();
  assert.equal(nodes(movement).some(node => node.type === 'DetailRow' && node.props.label === 'Recurrente'), false);
});

test('24UX4 review: a rule detail opened before the ledger hydrates shows the form once it loads, and after its own deletion keeps it locked until it closes; a link to a deleted rule is not found', async () => {
  const data: domain.LedgerArchive = { ...archive, recurring: [streaming] };
  const deleted = domain.deleteRecurringRule(streaming, '2026-09-25T12:00:00.000Z');
  const view = harness('app/edit-recurring/[id].tsx', {}, { data: null, params: { id: 'netflix' } });
  assert.equal(find(view.render(), 'EmptyState').props.title, 'No encontramos este recurrente', 'nothing to show before the ledger loads');
  view.setData(data);
  assert.equal(view.render().type, 'RecurringForm', 'the rule appears when the ledger arrives');
  view.setData({ ...data, recurring: [deleted] });
  const closing = view.render();
  assert.equal(closing.type, 'RecurringForm', 'deleted from this screen: no «not found» flash while it closes');
  assert.equal(closing.props.original.deleted, true);
  // A cold link straight to the deleted rule, before and after hydration, is not found.
  const cold = harness('app/edit-recurring/[id].tsx', {}, { data: null, params: { id: 'netflix' } });
  cold.render();
  cold.setData({ ...data, recurring: [deleted] });
  assert.equal(find(cold.render(), 'EmptyState').props.title, 'No encontramos este recurrente');
  // The form of a deleted rule cannot be saved, paused, resumed or deleted again.
  const form = harness('src/ui/recurring-form.tsx', { original: deleted }, { data: { ...data, recurring: [deleted] } });
  const root = form.render();
  assert.equal(nodes(root).filter(node => node.type === 'ActionButton').map(node => node.props.label).join(','), 'Guardar cambios');
  const save = find(root, 'ActionButton', 'Guardar cambios');
  assert.equal(save.props.disabled, true);
  await save.props.onPress();
  assert.equal(form.rules.length, 0, 'nothing is written');
  assert.equal(find(root, 'Field', 'Comercio o concepto').props.editable, false);
});
