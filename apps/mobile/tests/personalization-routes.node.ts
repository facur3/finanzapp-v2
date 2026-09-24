import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as domain from '@finanzapp/domain';
import * as appearance from '../src/ui/appearance.ts';
import * as currencies from '../src/ui/currencies.ts';
import * as categories from '../src/ui/categories.ts';
import * as i18nFormat from '../src/i18n/format.ts';
import { bindLocale } from '../src/i18n/bind.ts';
const i18nProvider = { useI18n: () => bindLocale('es-AR') };

// Producto 20: the account forms, the category form and the selectors, with
// native hosts replaced by descriptors. Handler logic only; not a rendered
// iOS screen, picker gesture or haptic.
type Node = { type: string | ((props: any) => Node); props: Record<string, any> };
const createdAt = '2026-09-01T12:00:00.000Z';
const cash: domain.Account = { id: 'cash', name: 'Cocos', currency: 'ARS', openingMinor: 100000, createdAt };
const usd: domain.Account = { id: 'usd', name: 'Dólares', currency: 'USD', openingMinor: 300, createdAt };
const cardAccount: domain.Account = { id: 'card-acc', name: 'Visa', currency: 'ARS', openingMinor: -20000, createdAt };
const card: domain.CreditCardProfile = { id: 'card', accountId: cardAccount.id, issuer: '', last4: '', creditLimitMinor: null, closingDay: 28, dueDay: 5, active: true, createdAt, revision: 0, updatedAt: createdAt };
const bankLook = domain.makeAccountAppearance(cash.id, 'bank', 'azure', createdAt);
const entry: domain.Entry = { id: 'e1', accountId: cash.id, kind: 'expense', amountMinor: 3000, merchant: 'Kiosco', category: 'sjsjn', dateISO: '2026-09-10', createdAt };
const archive: domain.LedgerArchive = { accounts: [cash, usd, cardAccount], records: [domain.initialRecord(entry)], cards: [card], appearances: [bankLook] };

function harness(file: string, props: any = {}, options: { data?: domain.LedgerArchive; params?: any; fail?: () => void } = {}) {
  const source = readFileSync(new URL('../' + file, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const state: any[] = [], refs: any[] = [];
  let cursor = 0, refCursor = 0, uuid = 0, backs = 0;
  const pushed: any[] = [], alerts: any[] = [];
  const added: { account: domain.Account; appearance?: domain.AccountAppearance }[] = [];
  const changed: { change: domain.AccountChange; appearance?: domain.AccountAppearance }[] = [];
  const looks: domain.AccountAppearance[] = [], definitions: domain.CategoryDefinition[] = [];
  const data = options.data ?? archive;
  const jsx = (type: Node['type'], props: Node['props']) => ({ type, props });
  const ledger = { useLedger: () => ({ archive: data, snapshot: domain.snapshotFromArchive(data),
    addAccount: async (account: domain.Account, look?: domain.AccountAppearance) => { added.push({ account, appearance: look }); options.fail?.(); },
    updateAccount: async (change: domain.AccountChange, look?: domain.AccountAppearance) => { changed.push({ change, appearance: look }); options.fail?.(); },
    saveAppearance: async (look: domain.AccountAppearance) => { looks.push(look); options.fail?.(); },
    saveCategory: async (definition: domain.CategoryDefinition) => { definitions.push(definition); options.fail?.(); } }) };
  const identity = { definitions: data.categories ?? [], appearances: data.appearances ?? [], hues: new Map<string, number>() };
  const p = { isDark: false, surface: '#fff', text: '#000', primary: '#2557D6', primarySoft: '#E5ECFB', secondary: '#666', tertiary: '#999', background: '#fff', inset: '#eee' };
  const hues = { useCategoryDefinitions: () => identity.definitions, useCategoryLook: (s: string, kind = 'expense') => appearance.resolveCategoryLook(kind as domain.EntryKind, s, identity, p),
    useCategoryLabel: (s: string, kind = 'expense') => appearance.resolveCategoryLook(kind as domain.EntryKind, s, identity, p).label,
    useAccountLook: (id: string) => appearance.resolveAccountLook(id, identity.appearances, p), useAccountLookOf: () => (id: string) => appearance.resolveAccountLook(id, identity.appearances, p) };
  const components = Object.fromEntries(['Screen', 'ActionButton', 'AmountField', 'AppText', 'Choices', 'DetailRow', 'SelectionRow', 'EmptyState', 'ErrorMessage', 'Field', 'FieldNote', 'IconButton', 'InfoButton', 'NavigationRow', 'Surface',
    'CategoryBadge', 'AccountBadge', 'GlyphTile', 'PressFeedback', 'SectionTitle'].map(name => [name, name]));
  (components as any).surfaceShadow = () => ({});
  const modules: Record<string, unknown> = {
    '../i18n/format': i18nFormat, '../src/i18n/format': i18nFormat, '../../src/i18n/format': i18nFormat, '../i18n/provider': i18nProvider, '../src/i18n/provider': i18nProvider, '../../src/i18n/provider': i18nProvider,
    react: { useState: (initial: any) => { const i = cursor++; if (!(i in state)) state[i] = typeof initial === 'function' ? initial() : initial;
      return [state[i], (next: any) => { state[i] = typeof next === 'function' ? next(state[i]) : next; }]; },
    useRef: (initial: any) => { const i = refCursor++; return refs[i] ??= { current: initial }; }, useMemo: (fn: () => any) => fn() },
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'react-native': { View: 'View', FlatList: 'FlatList', Modal: 'Modal', Platform: { OS: 'ios' }, Keyboard: { dismiss() {} },
      Alert: { alert: (title: string, message: string, buttons: any[]) => alerts.push({ title, message, buttons }) } },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
    '@react-native-community/datetimepicker': 'DateTimePicker',
    '@expo/vector-icons/Ionicons': 'Ionicons',
    'expo-router': { Stack: { Screen: 'Stack.Screen' }, useLocalSearchParams: () => options.params ?? {},
      router: { canGoBack: () => true, back: () => { backs++; }, push: (value: any) => pushed.push(value), replace: (value: any) => pushed.push(value) } },
    'expo-crypto': { randomUUID: () => 'op-' + (++uuid) },
    'expo-haptics': { NotificationFeedbackType: { Success: 'Success' }, notificationAsync: async () => {} },
    '@finanzapp/domain': domain,
    '../storage/LedgerProvider': ledger, '../src/storage/LedgerProvider': ledger, '../../src/storage/LedgerProvider': ledger,
    './components': components, '../src/ui/components': components, '../../src/ui/components': components,
    './appearance': appearance, '../src/ui/appearance': appearance, '../../src/ui/appearance': appearance,
    './appearance-picker': { IconColorPicker: 'IconColorPicker' }, '../src/ui/appearance-picker': { IconColorPicker: 'IconColorPicker' }, '../../src/ui/appearance-picker': { IconColorPicker: 'IconColorPicker' },
    './category-hues': hues, '../src/ui/category-hues': hues, '../../src/ui/category-hues': hues,
    './categories': categories, '../src/ui/category-form': { CategoryForm: 'CategoryForm' },
    './currencies': currencies, '../src/ui/currencies': currencies, '../../src/ui/currencies': currencies,
    '../src/ui/form-controls': { CurrencyField: 'CurrencyField' }, '../../src/ui/form-controls': { CurrencyField: 'CurrencyField' },
    './motion': { selectionHaptic: () => {} },
    './theme': { space: { xs: 4, s: 8, m: 12, l: 16, xl: 20, xxl: 24, xxxl: 32 }, radius: { group: 16 }, usePalette: () => p, useReduceMotion: () => true },
  };
  const module = { exports: {} as Record<string, (props: any) => Node> };
  runInNewContext(code, { module, exports: module.exports, Date, Error, require: (name: string) => {
    if (!Object.hasOwn(modules, name)) throw new Error('Unexpected personalization dependency: ' + name);
    return modules[name];
  } });
  return {
    render: (component?: string) => { cursor = 0; refCursor = 0; let node = (component ? module.exports[component] : module.exports.default ?? module.exports.CategoryForm)(props);
      while (typeof node.type === 'function') node = node.type(node.props); return node; },
    pushed, alerts, added, changed, looks, definitions, backs: () => backs,
  };
}
function nodes(value: any): Node[] {
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!value.props) return [];
  return [value, ...nodes(value.props.children), ...nodes(value.props.action), ...nodes(value.props.leading)];
}
function find(root: Node, type: string, label?: string): Node {
  const result = nodes(root).find(node => node.type === type && (!label || node.props.label === label));
  assert.ok(result, 'Missing ' + type + ' ' + (label ?? ''));
  return result;
}
const flush = () => new Promise<void>(resolve => setImmediate(resolve));

test('new account: name, icon, colour, currency and opening balance; the look is saved with the account in one call and defaults to wallet on cobalt', async () => {
  const view = harness('app/new-account.tsx');
  let root = view.render();
  const picker = find(root, 'IconColorPicker');
  assert.equal(picker.props.icons, appearance.ACCOUNT_ICON_CHOICES, 'the account icon set, not the category set');
  assert.equal(picker.props.colors, appearance.COLOR_CHOICES);
  assert.deepEqual([picker.props.icon, picker.props.color], ['wallet', 'cobalt']);
  find(root, 'Field').props.onChangeText('Banco Galicia');
  picker.props.onIconChange('bank');
  picker.props.onColorChange('azure');
  find(root, 'AmountField').props.onChangeText('1.500');
  root = view.render();
  assert.equal(find(root, 'IconColorPicker').props.previewLabel, 'Banco Galicia');
  await find(root, 'ActionButton').props.onPress();
  assert.equal(view.added.length, 1);
  const { account, appearance: look } = view.added[0];
  assert.deepEqual([account.name, account.currency, account.openingMinor], ['Banco Galicia', 'ARS', 150000]);
  assert.deepEqual(look, { accountId: account.id, icon: 'bank', color: 'azure', createdAt: account.createdAt, revision: 0, updatedAt: account.createdAt });
  assert.equal(Object.keys(account).sort().join(','), 'createdAt,currency,id,name,openingMinor', 'the account row carries no appearance field');
  assert.equal(view.backs(), 1);
});
test('new account: a failed save freezes the same account and look for retry; an invalid choice is refused before any write', async () => {
  let attempts = 0;
  const view = harness('app/new-account.tsx', {}, { fail: () => { if (++attempts === 1) throw new Error('Refresh failed'); } });
  find(view.render(), 'Field').props.onChangeText('Efectivo');
  find(view.render(), 'IconColorPicker').props.onIconChange('cash');
  await find(view.render(), 'ActionButton').props.onPress();
  assert.equal(find(view.render(), 'IconColorPicker').props.disabled, true, 'inputs lock while a submission is pending');
  await find(view.render(), 'ActionButton', 'Reintentar guardado').props.onPress();
  assert.equal(JSON.stringify(view.added[0]), JSON.stringify(view.added[1]));
  const bad = harness('app/new-account.tsx');
  find(bad.render(), 'Field').props.onChangeText('Rota');
  find(bad.render(), 'IconColorPicker').props.onIconChange('rocket');
  await find(bad.render(), 'ActionButton').props.onPress();
  assert.match(find(bad.render(), 'ErrorMessage').props.message, /ícono/);
  assert.equal(bad.added.length, 0);
});
test('edit account: changing only the look calls the appearance write, never the account correction or its audit', async () => {
  const view = harness('app/edit-account/[id].tsx', {}, { params: { id: 'cash' } });
  let root = view.render();
  assert.deepEqual([find(root, 'IconColorPicker').props.icon, find(root, 'IconColorPicker').props.color], ['bank', 'azure'], 'prefilled from the stored look');
  find(root, 'IconColorPicker').props.onColorChange('green');
  root = view.render();
  find(root, 'ActionButton').props.onPress(); await flush();
  assert.equal(view.changed.length, 0);
  assert.equal(view.alerts.length, 0);
  assert.deepEqual(view.looks, [{ ...bankLook, color: 'green', revision: 1, updatedAt: view.looks[0].updatedAt }]);
  assert.equal(view.backs(), 1);
});
test('edit account: a rename with a new look goes through one call; unchanged save closes without writing; balance correction still asks', async () => {
  const view = harness('app/edit-account/[id].tsx', {}, { params: { id: 'cash' } });
  find(view.render(), 'ActionButton').props.onPress(); await flush();
  assert.equal(view.changed.length + view.looks.length, 0);
  assert.equal(view.backs(), 1);
  find(view.render(), 'Field').props.onChangeText('Cocos Capital');
  find(view.render(), 'IconColorPicker').props.onIconChange('investment');
  find(view.render(), 'ActionButton').props.onPress(); await flush();
  assert.equal(view.looks.length, 0);
  assert.equal(view.changed.length, 1);
  assert.equal(view.changed[0].change.after.name, 'Cocos Capital');
  assert.equal(view.changed[0].change.after.openingMinor, cash.openingMinor);
  assert.equal(view.changed[0].change.expectedBalanceMinor, null);
  assert.deepEqual(view.changed[0].appearance, { ...bankLook, icon: 'investment', revision: 1, updatedAt: view.changed[0].appearance!.updatedAt });
  assert.equal(Object.keys(view.changed[0].change.after).includes('icon'), false, 'the audit before/after never carries the look');
  const correction = harness('app/edit-account/[id].tsx', {}, { params: { id: 'usd' } });
  find(correction.render(), 'AmountField').props.onChangeText('5');
  find(correction.render(), 'ActionButton').props.onPress(); await flush();
  assert.equal(correction.alerts.length, 1);
  assert.equal(correction.changed.length, 0, 'a balance correction waits for confirmation');
  assert.deepEqual([find(correction.render(), 'IconColorPicker').props.icon, find(correction.render(), 'IconColorPicker').props.color], ['wallet', 'cobalt'], 'an account without a stored look edits from the default');
});
test('category form: create adds a definition available at once; a taken name is refused without writing', async () => {
  const view = harness('src/ui/category-form.tsx', { kind: 'income' });
  let root = view.render();
  assert.equal(find(root, 'Choices').props.value, 'income');
  assert.equal(find(root, 'IconColorPicker').props.icons, appearance.CATEGORY_ICON_CHOICES);
  find(root, 'Choices').props.onChange('expense');
  find(root, 'Field').props.onChangeText('  Kiosco ');
  find(root, 'IconColorPicker').props.onIconChange('cafe');
  find(root, 'IconColorPicker').props.onColorChange('ochre');
  root = view.render();
  await find(root, 'ActionButton', 'Crear categoría').props.onPress();
  assert.equal(view.definitions.length, 1);
  assert.deepEqual(view.definitions[0], { kind: 'expense', key: 'kiosco', storedLabel: 'Kiosco', label: 'Kiosco', icon: 'cafe', color: 'ochre', archived: false,
    createdAt: view.definitions[0].createdAt, revision: 0, updatedAt: view.definitions[0].createdAt });
  assert.ok(domain.categoryOptions('expense', view.definitions).some(item => item.label === 'Kiosco'), 'the picker offers it immediately');
  const taken = harness('src/ui/category-form.tsx', {});
  find(taken.render(), 'Field').props.onChangeText('comida');
  await find(taken.render(), 'ActionButton').props.onPress();
  assert.match(find(taken.render(), 'ErrorMessage').props.message, /Ya existe/);
  assert.equal(taken.definitions.length, 0);
});
test('category form: renaming a preset keeps its stored spelling and identity; an unchanged save closes without writing', async () => {
  const original = domain.resolveCategory('expense', 'Comida');
  const view = harness('src/ui/category-form.tsx', { original });
  let root = view.render();
  assert.equal(nodes(root).some(node => node.type === 'Choices'), false, 'the kind is fixed once a category exists');
  assert.equal(find(root, 'Field').props.value, 'Comida');
  assert.deepEqual([find(root, 'IconColorPicker').props.icon, find(root, 'IconColorPicker').props.color], ['food', 'terracotta']);
  await find(root, 'ActionButton', 'Guardar cambios').props.onPress();
  assert.equal(view.definitions.length, 0);
  assert.equal(view.backs(), 1);
  find(root, 'Field').props.onChangeText('Alimentación');
  find(root, 'IconColorPicker').props.onColorChange('green');
  root = view.render();
  const note = nodes(root).filter(node => node.type === 'AppText').map(node => [node.props.children].flat().join('')).join(' ');
  assert.match(note, /se siguen registrando como «Comida»/);
  await find(root, 'ActionButton', 'Guardar cambios').props.onPress();
  assert.deepEqual(view.definitions[0], { kind: 'expense', key: 'comida', storedLabel: 'Comida', label: 'Alimentación', icon: 'food', color: 'green', archived: false,
    createdAt: view.definitions[0].createdAt, revision: 0, updatedAt: view.definitions[0].createdAt });
});
test('category form: a historical string is archived after confirmation, as a definition with its recorded spelling', async () => {
  const original = domain.resolveCategory('expense', 'sjsjn');
  const view = harness('src/ui/category-form.tsx', { original });
  const root = view.render();
  find(root, 'ActionButton', 'Archivar categoría').props.onPress();
  assert.equal(view.definitions.length, 0);
  assert.equal(view.alerts.length, 1);
  assert.match(view.alerts[0].message, /anteriores la conservan/);
  view.alerts[0].buttons[0].onPress();
  assert.equal(view.definitions.length, 0, 'cancel writes nothing');
  find(view.render(), 'ActionButton', 'Archivar categoría').props.onPress();
  view.alerts[1].buttons[1].onPress(); await flush();
  assert.deepEqual(view.definitions[0], { kind: 'expense', key: 'sjsjn', storedLabel: 'sjsjn', label: 'sjsjn', icon: 'other', color: 'graphite', archived: true,
    createdAt: view.definitions[0].createdAt, revision: 0, updatedAt: view.definitions[0].createdAt });
  const restore = harness('src/ui/category-form.tsx', { original: domain.resolveCategory('expense', 'sjsjn', view.definitions) });
  assert.equal(find(restore.render(), 'ActionButton', 'Desarchivar categoría').props.label, 'Desarchivar categoría');
});
test('edit-category route resolves presets and historical strings by (kind, key) and refuses unknown keys', () => {
  const preset = harness('app/edit-category.tsx', {}, { params: { kind: 'expense', key: 'comida' } }).render();
  assert.equal(preset.type, 'CategoryForm');
  assert.equal(preset.props.original.label, 'Comida');
  const historical = harness('app/edit-category.tsx', {}, { params: { kind: 'expense', key: 'sjsjn' } }).render();
  assert.equal(historical.props.original.source, 'historical');
  const income = harness('app/edit-category.tsx', {}, { params: { kind: 'income', key: 'regalos' } }).render();
  assert.equal(income.props.original.kind, 'income');
  const missing = harness('app/edit-category.tsx', {}, { params: { kind: 'expense', key: 'nunca' } }).render();
  assert.equal(nodes(missing).some(node => node.type === 'EmptyState'), true);
});
test('account selectors use the account identity: a cash account shows its own glyph and colour, a card keeps the card glyph', () => {
  const view = harness('src/ui/form-controls.tsx', { accounts: [cash, cardAccount], value: 'cash', onChange: () => {}, prominent: true,
    kindOf: (id: string) => id === 'card-acc' ? 'Tarjeta de crédito' : 'Cuenta', typeOf: (id: string) => id === 'card-acc' ? 'card' : 'cash' });
  // The selector card unwraps to a PressFeedback whose first child is the identity tile.
  const selector = (root: any) => { let card = root.props.children[0]; while (typeof card.type === 'function') card = card.type(card.props); return card.props.children[0]; };
  let chosen = selector(view.render('AccountField'));
  assert.equal(chosen.props.icon, 'business-outline', 'Cocos was dressed as a bank');
  assert.equal(chosen.props.color, '#0B6BB3', 'in azure, not the generic primary');
  const asCard = harness('src/ui/form-controls.tsx', { accounts: [cash, cardAccount], value: 'card-acc', onChange: () => {}, prominent: true,
    kindOf: (id: string) => id === 'card-acc' ? 'Tarjeta de crédito' : 'Cuenta', typeOf: (id: string) => id === 'card-acc' ? 'card' : 'cash' });
  chosen = selector(asCard.render('AccountField'));
  assert.equal(chosen.props.icon, 'card-outline');
  assert.equal(chosen.props.color, '#2557D6');
  const plain = harness('src/ui/form-controls.tsx', { accounts: [usd], value: 'usd', onChange: () => {}, prominent: true });
  chosen = selector(plain.render('AccountField'));
  assert.deepEqual([chosen.props.icon, chosen.props.color], ['wallet-outline', '#2557D6'], 'an undressed account keeps the default look');
  // The glyph follows what the account is (typeOf), never its translated kind name: an English "Credit card" is still a card.
  const english = harness('src/ui/form-controls.tsx', { accounts: [cash, cardAccount], value: 'card-acc', onChange: () => {}, prominent: true,
    kindOf: (id: string) => id === 'card-acc' ? 'Credit card' : 'Account', typeOf: (id: string) => id === 'card-acc' ? 'card' : 'cash' });
  assert.equal(selector(english.render('AccountField')).props.icon, 'card-outline');
  // The sheet rows use the same identity: a cash account is an AccountBadge, a card a plain tile.
  const sheet = nodes(view.render('AccountField')).find(node => node.type === 'FlatList')!;
  const rows = [cash, cardAccount].map(item => sheet.props.renderItem({ item }));
  assert.equal(nodes(rows[0]).some(node => node.type === 'AccountBadge' && node.props.accountId === 'cash'), true);
  assert.equal(nodes(rows[1]).some(node => node.type === 'GlyphTile' && node.props.icon === 'card-outline'), true);
});
test('the category picker shows display names, records the stored spelling, and keeps an archived current value valid', () => {
  const renamed = domain.editedCategoryDefinition(domain.resolveCategory('expense', 'Comida'), { label: 'Alimentación' }, createdAt);
  const archived = domain.editedCategoryDefinition(domain.resolveCategory('expense', 'sjsjn'), { archived: true }, createdAt);
  const data = { ...archive, categories: [renamed, archived] };
  const chosen: string[] = [];
  const view = harness('src/ui/form-controls.tsx', { entries: data.records.map(record => record.entry), kind: 'expense', value: 'sjsjn', onChange: (value: string) => chosen.push(value), prominent: true }, { data });
  const root = view.render('CategoryField');
  let card = root.props.children[0]; while (typeof card.type === 'function') card = card.type(card.props);
  assert.match(card.props.accessibilityLabel, /Categoría: sjsjn/, 'an archived value still shows on the card');
  const list = nodes(root).find(node => node.type === 'FlatList')!;
  const options: domain.CategoryIdentity[] = list.props.data;
  assert.equal(options[0].key, 'sjsjn', 'the current value stays first even though it is archived');
  assert.equal(options[0].archived, true);
  const food = options.find(item => item.key === 'comida')!;
  assert.equal(food.label, 'Alimentación');
  const row = list.props.renderItem({ item: food });
  assert.equal(row.props.accessibilityLabel, 'Alimentación');
  row.props.onPress();
  assert.deepEqual(chosen, ['Comida'], 'the movement records the stored spelling, so reports keep one group');
});

// The shared picker on its own module: names for VoiceOver, one haptic per
// change, no motion under Reduce Motion. Layout and touch need the iPhone.
function pickerHarness(props: any, reduced: boolean) {
  const source = readFileSync(new URL('../src/ui/appearance-picker.tsx', import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const jsx = (type: Node['type'], props: Node['props']) => ({ type, props });
  let haptics = 0;
  const modules: Record<string, unknown> = {
    '../i18n/format': i18nFormat, '../src/i18n/format': i18nFormat, '../../src/i18n/format': i18nFormat, '../i18n/provider': i18nProvider, '../src/i18n/provider': i18nProvider, '../../src/i18n/provider': i18nProvider,
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'react-native': { View: 'View', StyleSheet: { create: (styles: unknown) => styles } },
    'react-native-reanimated': { __esModule: true, default: { View: 'Animated.View' } },
    '@expo/vector-icons/Ionicons': 'Ionicons',
    './components': { AppText: 'AppText', GlyphTile: 'GlyphTile', PressFeedback: 'PressFeedback' },
    './appearance': appearance,
    '@finanzapp/domain': domain,
    './category-color': { tintOf: (color: string) => color + '24' },
    './motion': { duration: { state: 200 }, selectionHaptic: () => { haptics++; } },
    './theme': { space: { l: 16 }, usePalette: () => ({ isDark: false, surface: '#fff', inset: '#eee', secondary: '#666' }), useReduceMotion: () => reduced },
  };
  const module = { exports: {} as Record<string, (props: any) => Node> };
  runInNewContext(code, { module, exports: module.exports, require: (name: string) => {
    if (!Object.hasOwn(modules, name)) throw new Error('Unexpected picker dependency: ' + name);
    return modules[name];
  } });
  const render = () => { let node = module.exports.IconColorPicker(props); while (typeof node.type === 'function') node = node.type(node.props); return node; };
  return { render, haptics: () => haptics };
}
function deep(value: any): Node[] {
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value)) return value.flatMap(deep);
  if (!value.props) return [];
  const own = typeof value.type === 'function' ? deep(value.type(value.props)) : [];
  return [value, ...own, ...deep(value.props.children)];
}
test('the picker names every option for VoiceOver, marks the chosen ones, ticks one haptic per change and previews the result', () => {
  const chosen: string[] = [];
  const view = pickerHarness({ icons: appearance.ACCOUNT_ICON_CHOICES, colors: appearance.COLOR_CHOICES, icon: 'bank', color: 'azure',
    onIconChange: (id: string) => chosen.push('icon:' + id), onColorChange: (id: string) => chosen.push('color:' + id), previewLabel: 'Banco Galicia' }, false);
  const root = view.render();
  const radios = deep(root).filter(node => node.type === 'PressFeedback' && node.props.accessibilityRole === 'radio');
  assert.equal(radios.length, appearance.ACCOUNT_ICON_CHOICES.length + appearance.COLOR_CHOICES.length);
  const labels = radios.map(node => node.props.accessibilityLabel);
  assert.ok(labels.includes('Banco') && labels.includes('Celeste') && labels.includes('Cobalto'));
  assert.ok(!labels.some(label => /círculo|circle|#/.test(label)), 'colour names, never "blue circle" or a hex');
  assert.deepEqual(radios.filter(node => node.props.accessibilityState.selected).map(node => node.props.accessibilityLabel), ['Banco', 'Celeste']);
  const preview = deep(root).find(node => node.type === 'View' && node.props.accessibilityLabel?.startsWith('Vista previa'))!;
  assert.equal(preview.props.accessibilityLabel, 'Vista previa: Banco en Celeste');
  assert.equal(deep(root).find(node => node.type === 'GlyphTile')!.props.color, '#0B6BB3');
  radios.find(node => node.props.accessibilityLabel === 'Banco')!.props.onPress();
  assert.equal(view.haptics(), 0, 'tapping the current value does nothing');
  radios.find(node => node.props.accessibilityLabel === 'Efectivo')!.props.onPress();
  radios.find(node => node.props.accessibilityLabel === 'Verde')!.props.onPress();
  assert.deepEqual(chosen, ['icon:cash', 'color:green']);
  assert.equal(view.haptics(), 2);
  const animated = deep(root).filter(node => node.type === 'Animated.View');
  assert.ok(animated.every(node => [node.props.style].flat().some(style => style?.transitionDuration === 200)), 'a colour change animates 200 ms');
});
test('Reduce Motion removes the picker transitions; disabled locks every option', () => {
  const view = pickerHarness({ icons: appearance.CATEGORY_ICON_CHOICES, colors: appearance.COLOR_CHOICES, icon: 'food', color: 'terracotta',
    onIconChange: () => {}, onColorChange: () => {}, disabled: true }, true);
  const root = view.render();
  const animated = deep(root).filter(node => node.type === 'Animated.View');
  assert.ok(animated.length > 0);
  assert.ok(animated.every(node => [node.props.style].flat().some(style => style?.transitionDuration === 0)));
  const radios = deep(root).filter(node => node.type === 'PressFeedback' && node.props.accessibilityRole === 'radio');
  assert.ok(radios.every(node => node.props.disabled && node.props.accessibilityState.disabled));
  assert.equal(deep(root).find(node => node.type === 'AppText' && String(node.props.children).includes('Sin nombre')) !== undefined, true, 'no name yet reads honestly');
});
