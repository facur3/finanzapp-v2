import assert from 'node:assert/strict';
import * as moneyInput from '../src/ui/money-input.ts';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as domain from '@finanzapp/domain';
import * as appearance from '../src/ui/appearance.ts';
import * as currencies from '../src/ui/currencies.ts';
import * as categories from '../src/ui/categories.ts';
import * as i18nFormat from '../src/i18n/format.ts';
import { PREVIEW_CURRENCIES } from '../src/storage/currency-gate.ts';
import { bindLocale } from '../src/i18n/bind.ts';
import type { AppLocale } from '../src/i18n/locale.ts';

// Producto 20: the account forms, the category form and the selectors, with
// native hosts replaced by descriptors. Handler logic only; not a rendered
// iOS screen, picker gesture or haptic.
type Node = { type: string | ((props: any) => Node); props: Record<string, any> };
const createdAt = '2026-09-01T12:00:00.000Z';
const cash: domain.Account = { id: 'cash', name: 'Cocos', currency: 'ARS', openingMinor: 100000, createdAt };
const usd: domain.Account = { id: 'usd', name: 'Dólares', currency: 'USD', openingMinor: 300, createdAt };
const cardAccount: domain.Account = { id: 'card-acc', name: 'Visa', currency: 'ARS', openingMinor: -20000, createdAt };
const card: domain.CreditCardProfile = { id: 'card', accountId: cardAccount.id, issuer: '', last4: '', creditLimitMinor: null, closingDay: 28, dueDay: 5, active: true, deleted: false, createdAt, revision: 0, updatedAt: createdAt };
const bankLook = domain.makeAccountAppearance(cash.id, 'bank', 'azure', createdAt);
const entry: domain.Entry = { id: 'e1', accountId: cash.id, kind: 'expense', amountMinor: 3000, merchant: 'Kiosco', category: 'sjsjn', dateISO: '2026-09-10', createdAt };
const archive: domain.LedgerArchive = { accounts: [cash, usd, cardAccount], records: [domain.initialRecord(entry)], cards: [card], appearances: [bankLook] };

/** 25B2: the account lifecycle hook as the screens see it (its own confirmation flow is tested in lifecycle-actions.node.ts). */
const removed: domain.Account[] = [];
const accountManagement = { useAccountManagement: () => ({ busyId: null, error: null,
  remove: (account: domain.Account, done?: () => void) => { removed.push(account); done?.(); },
  actions: (account: domain.Account, done?: () => void) => [{ key: 'delete', label: 'Eliminar', icon: 'trash', tone: 'destructive', onPress: () => { removed.push(account); done?.(); } }],
  consequences: () => ({ movements: 0, transfers: 0, recurring: 0 }) }) };
const swipe = { SwipeRow: 'SwipeRow', swipeAccessibility: (actions: { key: string; label: string; onPress: () => void }[]) => ({ accessibilityActions: actions.map(action => ({ name: action.key, label: action.label })),
  onAccessibilityAction: (event: { nativeEvent: { actionName: string } }) => actions.find(action => action.key === event.nativeEvent.actionName)?.onPress() }) };
function harness(file: string, props: any = {}, options: { data?: domain.LedgerArchive; params?: any; fail?: () => void; locale?: AppLocale; gate?: domain.CurrencyGate; root?: boolean } = {}) {
  // Read on every render, like the live provider: switching it re-labels the next render and keeps the form state.
  let locale: AppLocale = options.locale ?? 'es-AR';
  const i18nProvider = { useI18n: () => bindLocale(locale) };
  const source = readFileSync(new URL('../' + file, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const state: any[] = [], refs: any[] = [];
  let cursor = 0, refCursor = 0, uuid = 0, backs = 0;
  const pushed: any[] = [], alerts: any[] = [], dismissed: any[] = [];
  const added: { account: domain.Account; appearance?: domain.AccountAppearance }[] = [];
  const changed: { change: domain.AccountChange; appearance?: domain.AccountAppearance }[] = [];
  const looks: domain.AccountAppearance[] = [], definitions: domain.CategoryDefinition[] = [];
  const data = options.data ?? archive;
  const jsx = (type: Node['type'], props: Node['props']) => ({ type, props });
  const ledger = { useLedger: () => ({ archive: data, snapshot: domain.snapshotFromArchive(data), ...(options.gate ? { gate: options.gate } : {}),
    addAccount: async (account: domain.Account, look?: domain.AccountAppearance) => { added.push({ account, appearance: look }); options.fail?.(); },
    updateAccount: async (change: domain.AccountChange, look?: domain.AccountAppearance) => { changed.push({ change, appearance: look }); options.fail?.(); },
    saveAppearance: async (look: domain.AccountAppearance) => { looks.push(look); options.fail?.(); },
    saveCategory: async (definition: domain.CategoryDefinition) => { definitions.push(definition); options.fail?.(); } }) };
  const identity = { definitions: data.categories ?? [], appearances: data.appearances ?? [], hues: new Map<string, number>() };
  const p = { isDark: false, surface: '#fff', text: '#000', primary: '#2557D6', primarySoft: '#E5ECFB', secondary: '#666', tertiary: '#999', background: '#fff', inset: '#eee' };
  const hues = { useCategoriesInUse: () => [], useCategoryDefinitions: () => identity.definitions, useCategoryLook: (s: string, kind = 'expense') => appearance.resolveCategoryLook(kind as domain.EntryKind, s, identity, p),
    useCategoryLabel: (s: string, kind = 'expense') => appearance.resolveCategoryLook(kind as domain.EntryKind, s, identity, p).label,
    useAccountLook: (id: string) => appearance.resolveAccountLook(id, identity.appearances, p), useAccountLookOf: () => (id: string) => appearance.resolveAccountLook(id, identity.appearances, p) };
  const components = Object.fromEntries(['Screen', 'ActionButton', 'AmountField', 'AppText', 'Choices', 'DetailRow', 'SelectionRow', 'EmptyState', 'ErrorMessage', 'Field', 'FieldNote', 'IconButton', 'InfoButton', 'NavigationRow', 'Surface',
    'CategoryBadge', 'AccountBadge', 'GlyphTile', 'PressFeedback', 'SectionTitle', 'LifecycleNote'].map(name => [name, name]));
  (components as any).surfaceShadow = () => ({});
  const GATE = options.gate ?? domain.LEDGER_CURRENCIES;
  const defaults = { useDefaultCurrency: ({ accountCurrency, requested }: { accountCurrency?: string | null; requested?: unknown } = {}) => accountCurrency ?? (domain.isLedgerCurrency(requested, GATE) ? requested : 'ARS') };
  const modules: Record<string, unknown> = {
    '../i18n/format': i18nFormat, '../src/i18n/format': i18nFormat, '../../src/i18n/format': i18nFormat, '../i18n/provider': i18nProvider, '../src/i18n/provider': i18nProvider, '../../src/i18n/provider': i18nProvider,
    react: { useState: (initial: any) => { const i = cursor++; if (!(i in state)) state[i] = typeof initial === 'function' ? initial() : initial;
      return [state[i], (next: any) => { state[i] = typeof next === 'function' ? next(state[i]) : next; }]; },
    useRef: (initial: any) => { const i = refCursor++; return refs[i] ??= { current: initial }; }, useMemo: (fn: () => any) => fn(), useEffect: () => {} },
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'react-native': { View: 'View', FlatList: 'FlatList', Modal: 'Modal', Platform: { OS: 'ios' }, Keyboard: { dismiss() {} }, Pressable: 'Pressable', StyleSheet: { absoluteFill: 'absoluteFill' },
      Alert: { alert: (title: string, message: string, buttons: any[]) => alerts.push({ title, message, buttons }) } },
    // The date field's compact sheet (24B6) animates with Reanimated and reads the safe area; date-field.node.ts exercises it.
    'react-native-reanimated': { __esModule: true, default: { View: 'Animated.View' }, useSharedValue: (value: unknown) => ({ value }), useAnimatedStyle: (fn: () => unknown) => fn(), runOnJS: (fn: unknown) => fn, withTiming: (value: unknown) => value },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView', useSafeAreaInsets: () => ({ top: 59, bottom: 34, left: 0, right: 0 }) },
    '@react-native-community/datetimepicker': 'DateTimePicker',
    '@expo/vector-icons/Ionicons': 'Ionicons',
    'expo-router': { Stack: { Screen: 'Stack.Screen' }, useLocalSearchParams: () => options.params ?? {},
      // 24UX6E: `root` opens the modal with nothing behind it; `dismissTo` is recorded on its own.
      router: { canGoBack: () => !options.root, back: () => { backs++; }, push: (value: any) => pushed.push(value), replace: (value: any) => pushed.push(value),
        dismissTo: (value: any) => dismissed.push(value) } },
    'expo-crypto': { randomUUID: () => 'op-' + (++uuid) },
    'expo-haptics': { NotificationFeedbackType: { Success: 'Success' }, notificationAsync: async () => {} },
    '@finanzapp/domain': domain,
    '../storage/LedgerProvider': ledger, '../src/storage/LedgerProvider': ledger, '../../src/storage/LedgerProvider': ledger,
    './components': components, '../src/ui/components': components, '../../src/ui/components': components,
    './money-input': moneyInput, '../src/ui/money-input': moneyInput, '../../src/ui/money-input': moneyInput,
    './appearance': appearance, '../src/ui/appearance': appearance, '../../src/ui/appearance': appearance,
    './appearance-picker': { IconColorPicker: 'IconColorPicker' }, '../src/ui/appearance-picker': { IconColorPicker: 'IconColorPicker' }, '../../src/ui/appearance-picker': { IconColorPicker: 'IconColorPicker' },
    './category-hues': hues, '../src/ui/category-hues': hues, '../../src/ui/category-hues': hues,
    './categories': categories, '../src/ui/category-form': { CategoryForm: 'CategoryForm' },
    // 24UX6E: the edit modals' not-found branches (their forms are tested in their own suites).
    '../../src/ui/budget-form': { BudgetForm: 'BudgetForm' }, '../../src/ui/debt-form': { DebtForm: 'DebtForm' }, '../../src/ui/recurring-form': { RecurringForm: 'RecurringForm' },
    './currencies': currencies, '../src/ui/currencies': currencies, '../../src/ui/currencies': currencies,
    '../src/ui/form-controls': { CurrencyField: 'CurrencyField' }, '../../src/ui/form-controls': { CurrencyField: 'CurrencyField' },
    // 25B2: the one default-currency rule (its branches are tested in currency-defaults.node.ts; here it answers ARS) and the account lifecycle hook.
    '../src/ui/use-default-currency': defaults, '../../src/ui/use-default-currency': defaults,
    '../../src/ui/commitment-actions': accountManagement, '../src/ui/commitment-actions': accountManagement,
    '../src/ui/swipe-actions': swipe, '../../src/ui/swipe-actions': swipe,
    './motion': { selectionHaptic: () => {}, timing: () => ({ duration: 0 }) },
    './theme': { space: { xs: 4, s: 8, m: 12, l: 16, xl: 20, xxl: 24, xxxl: 32 }, radius: { group: 16, sheet: 24 }, usePalette: () => p, useReduceMotion: () => true },
  };
  const module = { exports: {} as Record<string, (props: any) => Node> };
  runInNewContext(code, { module, exports: module.exports, Date, Error, require: (name: string) => {
    if (!Object.hasOwn(modules, name)) throw new Error('Unexpected personalization dependency: ' + name);
    return modules[name];
  } });
  return {
    render: (component?: string) => { cursor = 0; refCursor = 0; let node = (component ? module.exports[component] : module.exports.default ?? module.exports.CategoryForm)(props);
      while (typeof node.type === 'function') node = node.type(node.props); return node; },
    pushed, alerts, added, changed, looks, definitions, removed, dismissed, backs: () => backs, setLocale: (next: AppLocale) => { locale = next; },
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
  const takenMessage = find(taken.render(), 'ErrorMessage').props.message;
  assert.equal(takenMessage, 'categoryManager.form.nameTaken', 'the form stores its own error as a catalogue key');
  assert.match(bindLocale('es-AR').errorText(takenMessage), /^Ya existe una categoría con ese nombre/);
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
  const note = nodes(root).filter(node => node.type === 'AppText' || node.type === 'FieldNote').map(node => [node.props.children].flat().join('')).join(' ');
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

test('25A-03: «allowCreate={false}» lists existing categories (a stored custom one included) and never offers a typed new name; the default still does', () => {
  const custom = domain.editedCategoryDefinition(domain.resolveCategory('expense', 'Mascotas'), { label: 'Mascotas' }, createdAt);
  const data = { ...archive, categories: [custom] };
  const entries = data.records.map(record => record.entry);
  const offer = (allowCreate: boolean | undefined, query: string) => {
    const chosen: string[] = [];
    const view = harness('src/ui/form-controls.tsx', { entries, kind: 'expense', value: '', onChange: (value: string) => chosen.push(value), prominent: true,
      ...(allowCreate === undefined ? {} : { allowCreate }) }, { data });
    const header = (root: Node) => nodes(nodes(root).find(node => node.type === 'FlatList')!.props.ListHeaderComponent);
    nodes(header(view.render('CategoryField'))).find(node => node.type === 'Field')!.props.onChangeText(query);
    const root = view.render('CategoryField');
    const list = nodes(root).find(node => node.type === 'FlatList')!;
    const create = header(root).find(node => node.type === 'PressFeedback');
    return { keys: (list.props.data as domain.CategoryIdentity[]).map(item => item.key), create, list, chosen };
  };
  const restricted = offer(false, 'Mascotas');
  assert.ok(restricted.keys.includes('mascotas'), 'a stored custom category is offered');
  restricted.list.props.renderItem({ item: (restricted.list.props.data as domain.CategoryIdentity[]).find(item => item.key === 'mascotas') }).props.onPress();
  assert.deepEqual(restricted.chosen, ['Mascotas']);
  const unknown = offer(false, 'Zzz nueva');
  assert.equal(unknown.keys.length, 0);
  assert.equal(unknown.create, undefined, 'no «Usar …» row for a name that does not exist');
  for (const allowCreate of [undefined, true]) {
    const ordinary = offer(allowCreate, 'Zzz nueva');
    assert.match(ordinary.create!.props.accessibilityLabel, /Zzz nueva/, 'every other caller keeps creating a category from the search');
  }
});

// The shared picker on its own module: names for VoiceOver, one haptic per
// change, no motion under Reduce Motion. Layout and touch need the iPhone.
function pickerHarness(props: any, reduced: boolean, locale: AppLocale = 'es-AR', deviceLanguage: string | null = null) {
  const i18nProvider = { useI18n: () => bindLocale(locale, 'native', deviceLanguage) };
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

// Producto 23.1B2: the category form and the picker in English. Only words
// change: a built-in category shows its English name, but its identity, its
// stored spelling and the definition's label stay the Spanish ones, so an
// untouched English name is never saved as a rename.
// 24UX6E: the rename note is a FieldNote under the name field.
const texts = (root: Node) => nodes(root).filter(node => node.type === 'AppText' || node.type === 'FieldNote').map(node => [node.props.children].flat().join('')).join(' ');
test('23.1B2 English category form: a built-in category is prefilled in English, and saving it untouched never stores the English word', async () => {
  const original = domain.resolveCategory('expense', 'Comida');
  const view = harness('src/ui/category-form.tsx', { original }, { locale: 'en-AR' });
  let root = view.render();
  assert.equal(find(root, 'Field').props.value, 'Food', 'the displayed name follows the language');
  assert.equal(find(root, 'Field').props.label, 'Name');
  assert.equal(nodes(root).find(node => node.type === 'Stack.Screen')!.props.options.title, 'Edit category');
  assert.ok(find(root, 'ActionButton', 'Save changes'));
  assert.ok(find(root, 'ActionButton', 'Archive category'));
  assert.doesNotMatch(texts(root), /still recorded as/, 'the English prefill is not a rename');
  await find(root, 'ActionButton', 'Save changes').props.onPress();
  assert.equal(view.definitions.length, 0, 'an untouched save writes nothing');
  assert.equal(view.backs(), 1);
  // A look-only change adopts the preset with its Spanish label and spelling, exactly as in Spanish.
  find(root, 'IconColorPicker').props.onColorChange('green');
  root = view.render();
  await find(root, 'ActionButton', 'Save changes').props.onPress();
  const spanish = harness('src/ui/category-form.tsx', { original });
  find(spanish.render(), 'IconColorPicker').props.onColorChange('green');
  await find(spanish.render(), 'ActionButton', 'Guardar cambios').props.onPress();
  assert.deepEqual({ ...view.definitions[0], createdAt: '', updatedAt: '' }, { ...spanish.definitions[0], createdAt: '', updatedAt: '' });
  assert.deepEqual([view.definitions[0].key, view.definitions[0].storedLabel, view.definitions[0].label, view.definitions[0].color], ['comida', 'Comida', 'Comida', 'green']);
  // A preset that already has a definition (only its look changed) keeps its label on the next revision too.
  const decorated = domain.resolveCategory('expense', 'Comida', [view.definitions[0]]);
  const next = harness('src/ui/category-form.tsx', { original: decorated }, { locale: 'en-AR' });
  assert.equal(find(next.render(), 'Field').props.value, 'Food');
  find(next.render(), 'IconColorPicker').props.onIconChange('cafe');
  await find(next.render(), 'ActionButton', 'Save changes').props.onPress();
  assert.deepEqual([next.definitions[0].label, next.definitions[0].storedLabel, next.definitions[0].icon, next.definitions[0].revision], ['Comida', 'Comida', 'cafe', 1]);
  // Switching to Spanish with the English prefill still on screen does not turn it into a rename either.
  const switching = harness('src/ui/category-form.tsx', { original }, { locale: 'en-AR' });
  switching.render();
  switching.setLocale('es-AR');
  root = switching.render();
  assert.equal(find(root, 'Field').props.value, 'Food', 'the draft is kept across the switch');
  assert.ok(find(root, 'ActionButton', 'Guardar cambios'));
  await find(root, 'ActionButton', 'Guardar cambios').props.onPress();
  assert.equal(switching.definitions.length, 0);
});
test('23.1B2 English category form: a typed name is a real rename; custom and renamed names are never translated; archive and create read in English', async () => {
  const original = domain.resolveCategory('expense', 'Comida');
  const view = harness('src/ui/category-form.tsx', { original }, { locale: 'en-AR' });
  find(view.render(), 'Field').props.onChangeText('Meals');
  let root = view.render();
  assert.match(texts(root), /Transactions are still recorded as “Comida” and shown as “Meals”\./);
  await find(root, 'ActionButton', 'Save changes').props.onPress();
  assert.deepEqual([view.definitions[0].key, view.definitions[0].storedLabel, view.definitions[0].label], ['comida', 'Comida', 'Meals']);
  // The person's own words read the same in every language.
  const renamed = domain.editedCategoryDefinition(original, { label: 'Alimentación' }, createdAt);
  assert.equal(find(harness('src/ui/category-form.tsx', { original: domain.resolveCategory('expense', 'Comida', [renamed]) }, { locale: 'en-AR' }).render(), 'Field').props.value, 'Alimentación');
  assert.equal(find(harness('src/ui/category-form.tsx', { original: domain.resolveCategory('expense', 'sjsjn') }, { locale: 'en-AR' }).render(), 'Field').props.value, 'sjsjn');
  // Archiving asks in English, names the category as shown, and stores the Spanish identity.
  const archiving = harness('src/ui/category-form.tsx', { original }, { locale: 'en-AR' });
  find(archiving.render(), 'ActionButton', 'Archive category').props.onPress();
  assert.equal(archiving.alerts[0].title, 'Archive category?');
  assert.match(archiving.alerts[0].message, /^“Food” will no longer be offered/);
  assert.equal(archiving.alerts[0].buttons.map((button: any) => button.text).join(','), 'Cancel,Archive');
  archiving.alerts[0].buttons[1].onPress(); await flush();
  assert.deepEqual([archiving.definitions[0].label, archiving.definitions[0].storedLabel, archiving.definitions[0].archived], ['Comida', 'Comida', true]);
  // Creating: English labels, the same definition as Spanish, and the form's own error in English.
  const create = harness('src/ui/category-form.tsx', {}, { locale: 'en-AR' });
  root = create.render();
  assert.equal(nodes(root).find(node => node.type === 'Stack.Screen')!.props.options.title, 'New category');
  assert.equal(find(root, 'Choices').props.options.map((option: any) => option.label).join(','), 'Expense,Income');
  assert.equal(find(root, 'Field').props.placeholder, 'e.g. Snacks');
  assert.match(texts(root), /available right away when recording expenses/);
  find(root, 'Field').props.onChangeText('Kiosco');
  await find(create.render(), 'ActionButton', 'Create category').props.onPress();
  assert.deepEqual([create.definitions[0].storedLabel, create.definitions[0].label], ['Kiosco', 'Kiosco']);
  const taken = harness('src/ui/category-form.tsx', {}, { locale: 'en-AR' });
  find(taken.render(), 'Field').props.onChangeText('comida');
  await find(taken.render(), 'ActionButton').props.onPress();
  assert.equal(bindLocale('en-AR').errorText(find(taken.render(), 'ErrorMessage').props.message), 'A category with that name already exists. Edit it from the list or choose another name.');
  assert.equal(taken.definitions.length, 0);
});
test('23.1B2 English picker: icon and colour names come from the catalogue by id; the account set reads its own names; ids are unchanged', () => {
  const chosen: string[] = [];
  const view = pickerHarness({ icons: appearance.ACCOUNT_ICON_CHOICES, colors: appearance.COLOR_CHOICES, icon: 'investment', color: 'azure',
    onIconChange: (id: string) => chosen.push(id), onColorChange: (id: string) => chosen.push(id), previewLabel: 'Banco Galicia' }, false, 'en-AR');
  const root = view.render();
  const radios = deep(root).filter(node => node.type === 'PressFeedback' && node.props.accessibilityRole === 'radio');
  const labels = radios.map(node => node.props.accessibilityLabel);
  assert.ok(labels.includes('Bank') && labels.includes('Digital wallet') && labels.includes('Sky blue') && labels.includes('Graphite'), labels.join(','));
  assert.equal(labels.some(label => /[áéíóú]|Billetera|Celeste/.test(label)), false, 'no Spanish name left');
  assert.equal(deep(root).find(node => node.type === 'View' && node.props.accessible)!.props.accessibilityLabel, 'Preview: Investment in Sky blue');
  assert.ok(deep(root).some(node => node.type === 'AppText' && String(node.props.children) === 'Banco Galicia'), 'the account name is the person\'s, untranslated');
  assert.ok(deep(root).some(node => node.type === 'AppText' && String(node.props.children) === 'Icon'));
  radios.find(node => node.props.accessibilityLabel === 'Cash')!.props.onPress();
  radios.find(node => node.props.accessibilityLabel === 'Teal')!.props.onPress();
  assert.deepEqual(chosen, ['cash', 'teal'], 'the stored values are ids, never names');
  const categories = pickerHarness({ icons: appearance.CATEGORY_ICON_CHOICES, colors: appearance.COLOR_CHOICES, icon: 'investment', color: 'rose',
    onIconChange: () => {}, onColorChange: () => {} }, false, 'en-AR').render();
  assert.equal(deep(categories).find(node => node.type === 'View' && node.props.accessible)!.props.accessibilityLabel, 'Preview: Investments in Rose', 'the category set names the same id differently');
  assert.ok(deep(categories).some(node => node.type === 'AppText' && String(node.props.children) === 'No name'));
  // Spanish reads the same names the domain always had.
  const spanish = pickerHarness({ icons: appearance.CATEGORY_ICON_CHOICES, colors: appearance.COLOR_CHOICES, icon: 'investment', color: 'rose', onIconChange: () => {}, onColorChange: () => {} }, false).render();
  assert.equal(deep(spanish).find(node => node.type === 'View' && node.props.accessible)!.props.accessibilityLabel, 'Vista previa: Inversiones en Rosa');
  const es = bindLocale('es-AR').t;
  for (const [group, list] of [['icons', domain.CATEGORY_ICONS], ['accountIcons', domain.ACCOUNT_ICONS], ['colors', domain.APPEARANCE_COLORS]] as const) {
    for (const item of list) assert.equal(es(`categoryManager.${group}.${item.id}` as any), item.name, 'the Spanish catalogue matches the domain name of ' + group + '.' + item.id);
  }
});

test('23.1C2: the preview tile speaks the interface language only when it differs from the device language', () => {
  const props = { icons: appearance.CATEGORY_ICON_CHOICES, colors: appearance.COLOR_CHOICES, icon: 'transport', color: 'teal', onIconChange: () => {}, onColorChange: () => {} };
  const preview = (locale: AppLocale, device: string | null) => deep(pickerHarness(props, false, locale, device).render()).find(node => node.type === 'View' && node.props.accessible)!.props;
  // English chosen in Más on a Spanish iPhone: VoiceOver reads the English label with an English voice.
  assert.equal(preview('en-AR', 'es').accessibilityLanguage, 'en');
  assert.equal(preview('en-AR', 'es').accessibilityLabel, 'Preview: Transportation in Teal');
  // Spanish on a Portuguese iPhone (the fallback language): a Spanish voice.
  assert.equal(preview('es-AR', 'pt').accessibilityLanguage, 'es');
  // Device and app agree: nothing is set, so the person's own VoiceOver voice is untouched.
  assert.equal(preview('es-AR', 'es').accessibilityLanguage, undefined);
  assert.equal(preview('en-US', 'en').accessibilityLanguage, undefined);
  assert.equal(preview('es-AR', null).accessibilityLanguage, undefined);
  // The icon section title uses the accented rioplatense spelling, like every other Spanish "ícono".
  assert.ok(deep(pickerHarness(props, false).render()).some(node => node.type === 'AppText' && String(node.props.children) === 'Ícono'));
});

test('24B2 review: an account whose balance exceeds the entry bound can still be renamed and re-dressed; only an edited balance is re-read', async () => {
  // Opening 9e14 plus an income of 2e14: a valid balance of 1,100,000,000,000,000 minor units, above MAX_ENTRY_MINOR (999,999,999,999,999) and safe.
  const big: domain.Account = { ...cash, id: 'big', name: 'Grande', openingMinor: 900000000000000 };
  const income: domain.Entry = { ...entry, id: 'big-income', accountId: 'big', kind: 'income', amountMinor: 200000000000000 };
  const data: domain.LedgerArchive = { ...archive, accounts: [...archive.accounts, big], records: [...archive.records, domain.initialRecord(income)], appearances: [bankLook, domain.makeAccountAppearance('big', 'bank', 'azure', createdAt)] };
  const balance = domain.accountBalanceMinor(big, domain.snapshotFromArchive(data).entries, []);
  assert.ok(balance > domain.MAX_ENTRY_MINOR && Number.isSafeInteger(balance));
  // The prefill shows the stored balance whole.
  let view = harness('app/edit-account/[id].tsx', {}, { data, params: { id: 'big' } });
  assert.equal(find(view.render(), 'AmountField').props.value, '11.000.000.000.000,00');
  assert.equal(JSON.stringify(find(view.render(), 'AmountField').props.stored), JSON.stringify({ minor: balance, currency: 'ARS', draft: '11.000.000.000.000,00' }));
  assert.equal(find(view.render(), 'ActionButton').props.disabled, false);
  // Rename only: saved through the account change with the balance untouched, no correction, no confirmation.
  find(view.render(), 'Field').props.onChangeText('Grande renombrada');
  find(view.render(), 'ActionButton').props.onPress(); await flush();
  assert.equal(view.alerts.length, 0);
  assert.equal(view.changed.length, 1);
  assert.deepEqual([view.changed[0].change.after.name, view.changed[0].change.after.openingMinor, view.changed[0].change.expectedBalanceMinor], ['Grande renombrada', big.openingMinor, null]);
  assert.equal(view.changed[0].appearance, undefined, 'no look change travels with the rename');
  assert.equal(view.backs(), 1);
  // Look only: the appearance write alone, no account change.
  view = harness('app/edit-account/[id].tsx', {}, { data, params: { id: 'big' } });
  find(view.render(), 'IconColorPicker').props.onColorChange('green');
  find(view.render(), 'ActionButton').props.onPress(); await flush();
  assert.equal(view.changed.length, 0);
  assert.equal(view.alerts.length, 0);
  assert.equal(view.looks.length, 1);
  assert.equal(view.looks[0].color, 'green');
  // Nothing edited: no write at all.
  view = harness('app/edit-account/[id].tsx', {}, { data, params: { id: 'big' } });
  find(view.render(), 'ActionButton').props.onPress(); await flush();
  assert.equal(view.changed.length + view.looks.length + view.alerts.length, 0);
  assert.equal(view.backs(), 1);
  // Editing the balance itself beyond the entry bound is still refused, with the entry sentence, and nothing is written.
  view = harness('app/edit-account/[id].tsx', {}, { data, params: { id: 'big' } });
  find(view.render(), 'AmountField').props.onChangeText('11.000.000.000.000,01');
  find(view.render(), 'ActionButton').props.onPress(); await flush();
  assert.equal(find(view.render(), 'ErrorMessage').props.message, 'El monto es demasiado grande.');
  assert.equal(view.changed.length + view.looks.length + view.alerts.length, 0);
  // Retyping exactly the prefill counts as untouched; a valid different balance still asks for confirmation as before.
  find(view.render(), 'AmountField').props.onChangeText('11.000.000.000.000,00');
  find(view.render(), 'Field').props.onChangeText('Otra');
  find(view.render(), 'ActionButton').props.onPress(); await flush();
  assert.equal(view.alerts.length, 0);
  assert.equal(view.changed[0].change.expectedBalanceMinor, null);
  view = harness('app/edit-account/[id].tsx', {}, { data, params: { id: 'big' } });
  find(view.render(), 'AmountField').props.onChangeText('5');
  find(view.render(), 'ActionButton').props.onPress(); await flush();
  assert.equal(view.alerts.length, 1, 'a real correction waits for confirmation');
  assert.equal(view.changed.length, 0);
});

test('24B5: a new account chooses its currency before the opening balance over the build\'s gate; the preview gate creates euro and yen accounts at their own scale, the release gate never sees them', async () => {
  const release = harness('app/new-account.tsx', {}, { params: { currency: 'KWD' } });
  const field = find(release.render(), 'CurrencyField');
  assert.deepEqual(field.props.currencies, domain.LEDGER_CURRENCIES, '24M: the production gate, 146 currencies');
  assert.equal(field.props.value, 'ARS', 'a route currency outside the gate (held KWD) is never coerced in');
  assert.equal(find(harness('app/new-account.tsx', {}, { params: { currency: 'EUR' } }).render(), 'CurrencyField').props.value, 'EUR', '24M: the release offers EUR');
  const preview = harness('app/new-account.tsx', {}, { params: { currency: 'EUR' }, gate: PREVIEW_CURRENCIES });
  assert.deepEqual(find(preview.render(), 'CurrencyField').props.currencies, [...PREVIEW_CURRENCIES]);
  assert.equal(find(preview.render(), 'CurrencyField').props.value, 'EUR');
  assert.equal(find(preview.render(), 'AmountField').props.currency, 'EUR');
  find(preview.render(), 'Field', 'Nombre de la cuenta').props.onChangeText('N26');
  find(preview.render(), 'AmountField').props.onChangeText('1.234,56');
  await find(preview.render(), 'ActionButton', 'Guardar cuenta').props.onPress();
  assert.deepEqual([preview.added[0].account.currency, preview.added[0].account.openingMinor], ['EUR', 123456]);
  const yen = harness('app/new-account.tsx', {}, { gate: PREVIEW_CURRENCIES });
  find(yen.render(), 'CurrencyField').props.onChange('JPY');
  assert.equal(find(yen.render(), 'AmountField').props.currency, 'JPY', 'the field is retargeted before the first digit');
  find(yen.render(), 'Field', 'Nombre de la cuenta').props.onChangeText('Yenes');
  find(yen.render(), 'AmountField').props.onChangeText('1500');
  await find(yen.render(), 'ActionButton', 'Guardar cuenta').props.onPress();
  assert.deepEqual([yen.added[0].account.currency, yen.added[0].account.openingMinor], ['JPY', 1500], '1500 yen, never 15.00');
});


// ---- Producto 25B2: Editar cuenta and the deletion record ----------------------------------------------------

test('25B2: Editar cuenta offers «Eliminar cuenta» last, in the destructive tone, for a cash account only; a deleted account is not edited again', () => {
  const live = harness('app/edit-account/[id].tsx', {}, { params: { id: 'cash' } }).render();
  const labels = nodes(live).filter(node => node.type === 'ActionButton').map(node => node.props.label);
  assert.deepEqual(labels.slice(-2), ['Guardar cambios', 'Eliminar cuenta']);
  const button = nodes(live).find(node => node.type === 'ActionButton' && node.props.label === 'Eliminar cuenta')!;
  assert.deepEqual([button.props.tone, button.props.secondary, button.props.icon], ['expense', true, 'trash-outline']);
  removed.length = 0;
  button.props.onPress();
  assert.equal(removed.length, 1, 'the button hands the account to the confirmation flow (tested in lifecycle-actions.node.ts)');
  assert.equal(removed[0].id, 'cash');
  const cardEdit = harness('app/edit-account/[id].tsx', {}, { params: { id: cardAccount.id } }).render();
  assert.equal(nodes(cardEdit).some(node => node.type === 'ActionButton' && node.props.label === 'Eliminar cuenta'), false, 'a card\'s internal account is deleted from its own screen');
  const at = '2026-09-27T10:00:00.000Z';
  const deleted = { ...cash, revision: 1, updatedAt: at, deletedAt: at };
  const data = { ...archive, accounts: archive.accounts.map(item => item.id === 'cash' ? deleted : item) };
  const gone = harness('app/edit-account/[id].tsx', {}, { data, params: { id: 'cash' } }).render();
  assert.equal(nodes(gone).find(node => node.type === 'EmptyState')!.props.title, 'Cuenta eliminada');
  assert.equal(nodes(gone).some(node => node.type === 'Field'), false, 'no form for a deleted account');
});

// ---- 24UX6E: Categorías, the edit modals' exits and the post-delete navigation ----------------------------------------

test('24UX6E: an untouched save of a historical category closes without writing, so it is never adopted, recoloured or re-glyphed', async () => {
  const view = harness('src/ui/category-form.tsx', { original: domain.resolveCategory('expense', 'sjsjn') });
  await find(view.render(), 'ActionButton', 'Guardar cambios').props.onPress();
  assert.equal(view.definitions.length, 0);
  assert.equal(view.backs(), 1);
  // A mapped synonym opens on the curated icon whose glyph the list already draws for it; the derived hue is no palette colour.
  const nafta = harness('src/ui/category-form.tsx', { original: domain.resolveCategory('expense', 'nafta') });
  const picker = find(nafta.render(), 'IconColorPicker');
  assert.deepEqual([picker.props.icon, picker.props.color], ['fuel', 'graphite']);
  assert.equal(appearance.categoryGlyph('fuel'), appearance.identityGlyph(domain.resolveCategory('expense', 'nafta')), 'the glyph it already shows');
  await find(nafta.render(), 'ActionButton', 'Guardar cambios').props.onPress();
  assert.equal(nafta.definitions.length, 0, 'untouched: no write');
  assert.equal(find(harness('src/ui/category-form.tsx', { original: domain.resolveCategory('expense', 'sjsjn') }).render(), 'IconColorPicker').props.icon, 'other', 'an unmapped string opens on «other»');
  // A real change still adopts it, keeping the glyph it opened on unless the person picked another.
  const renamed = harness('src/ui/category-form.tsx', { original: domain.resolveCategory('expense', 'nafta') });
  find(renamed.render(), 'Field').props.onChangeText('Combustible auto');
  await find(renamed.render(), 'ActionButton', 'Guardar cambios').props.onPress();
  assert.deepEqual([renamed.definitions[0].label, renamed.definitions[0].storedLabel, renamed.definitions[0].icon], ['Combustible auto', 'nafta', 'fuel']);
  // Archiving a never-adopted synonym keeps its glyph too.
  const archiving = harness('src/ui/category-form.tsx', { original: domain.resolveCategory('expense', 'nafta') });
  find(archiving.render(), 'ActionButton', 'Archivar categoría').props.onPress();
  archiving.alerts[0].buttons[1].onPress(); await flush();
  assert.deepEqual([archiving.definitions[0].archived, archiving.definitions[0].icon, archiving.definitions[0].storedLabel], [true, 'fuel', 'nafta']);
});

test('24UX6E: a rename into another category\'s name is refused before any write and the form stays editable (both storage rules)', async () => {
  const view = harness('src/ui/category-form.tsx', { original: domain.resolveCategory('expense', 'Comida') });
  find(view.render(), 'Field').props.onChangeText('Supermercado');
  await find(view.render(), 'ActionButton', 'Guardar cambios').props.onPress();
  let root = view.render();
  assert.equal(view.definitions.length, 0, 'nothing reached storage');
  assert.equal(bindLocale('es-AR').errorText(find(root, 'ErrorMessage').props.message), '«Supermercado» ya es el nombre de otra categoría.');
  assert.equal(find(root, 'Field').props.editable, true, 'an input error, never a frozen retry');
  assert.equal(find(root, 'IconColorPicker').props.disabled, false);
  assert.ok(find(root, 'ActionButton', 'Guardar cambios'), 'the button still saves the form, never «Reintentar guardado»');
  assert.equal(nodes(root).some(node => node.type === 'AppText' && /Reintentá el mismo guardado/.test(String(node.props.children))), false);
  // Fixing the name saves.
  find(root, 'Field').props.onChangeText('Alimentación');
  await find(view.render(), 'ActionButton', 'Guardar cambios').props.onPress();
  assert.equal(view.definitions[0].label, 'Alimentación');
  // The second rule: another definition already shows that name (Comida renamed «Alimentación», then Supermercado renamed the same).
  const data = { ...archive, categories: [view.definitions[0]] };
  const clash = harness('src/ui/category-form.tsx', { original: domain.resolveCategory('expense', 'Supermercado', data.categories) }, { data });
  find(clash.render(), 'Field').props.onChangeText('Alimentación');
  await find(clash.render(), 'ActionButton', 'Guardar cambios').props.onPress();
  root = clash.render();
  assert.equal(clash.definitions.length, 0);
  assert.equal(bindLocale('es-AR').errorText(find(root, 'ErrorMessage').props.message), 'Ya existe una categoría llamada «Alimentación».');
  assert.equal(find(root, 'Field').props.editable, true);
  assert.equal(bindLocale('en-AR').errorText(find(root, 'ErrorMessage').props.message).includes('Alimentación'), true, 'translated with the name');
  // A real storage failure still freezes the same write for an honest retry.
  let attempts = 0;
  const failing = harness('src/ui/category-form.tsx', { original: domain.resolveCategory('expense', 'Comida') }, { fail: () => { if (++attempts === 1) throw new Error('disk'); } });
  find(failing.render(), 'Field').props.onChangeText('Comidas del mes');
  find(failing.render(), 'ActionButton', 'Guardar cambios').props.onPress(); await flush();
  assert.equal(find(failing.render(), 'Field').props.editable, false);
  assert.ok(find(failing.render(), 'ActionButton', 'Reintentar guardado'));
});

test('24UX6E review: archiving runs the same storage name rules first, so a clash is an editable error, never a frozen retry', async () => {
  // Combustible renamed «Nafta», while movements still carry the historical string «nafta»: archiving that string's row
  // would write a second definition shown as «Nafta», which storage refuses (validateArchive).
  const renamed = domain.editedCategoryDefinition(domain.resolveCategory('expense', 'Combustible'), { label: 'Nafta' }, '2026-09-20T10:00:00.000Z');
  const data = { ...archive, categories: [renamed] };
  const view = harness('src/ui/category-form.tsx', { original: domain.resolveCategory('expense', 'nafta', data.categories) }, { data });
  find(view.render(), 'ActionButton', 'Archivar categoría').props.onPress();
  await flush();
  const root = view.render();
  assert.equal(view.alerts.length, 0, 'no confirmation for a write storage would refuse');
  assert.equal(view.definitions.length, 0, 'nothing reached storage');
  assert.equal(bindLocale('es-AR').errorText(find(root, 'ErrorMessage').props.message), '«Nafta» ya es el nombre de otra categoría.');
  assert.equal(find(root, 'Field').props.editable, true);
  assert.ok(find(root, 'ActionButton', 'Guardar cambios'), 'never «Reintentar guardado»');
  // Without the clash the same row archives as before.
  const plain = harness('src/ui/category-form.tsx', { original: domain.resolveCategory('expense', 'nafta') });
  find(plain.render(), 'ActionButton', 'Archivar categoría').props.onPress();
  plain.alerts[0].buttons[1].onPress(); await flush();
  assert.equal(plain.definitions[0].archived, true);
});

test('24UX6E: an archived category\'s editor opens with the lifecycle note; an active one has none; the rename note sits under the name field', () => {
  const archived = domain.editedCategoryDefinition(domain.resolveCategory('expense', 'sjsjn'), { archived: true }, createdAt);
  const data = { ...archive, categories: [archived] };
  const root = harness('src/ui/category-form.tsx', { original: domain.resolveCategory('expense', 'sjsjn', [archived]) }, { data }).render();
  const order = nodes(root).map(node => node.type);
  const note = find(root, 'LifecycleNote');
  assert.deepEqual([note.props.icon, note.props.title, note.props.tone], ['archive-outline', 'Archivada', undefined], 'calm: no alarm tone');
  assert.match(note.props.detail, /^No se ofrece al registrar\. .*desarchivala para volver a ofrecerla\.$/);
  assert.ok(order.indexOf('LifecycleNote') < order.indexOf('Field'), 'first, above the name');
  assert.doesNotMatch(texts(root), /Archivada:/, 'the bottom paragraph no longer repeats the state');
  assert.match(texts(root), /no modifica ningún movimiento/);
  const english = harness('src/ui/category-form.tsx', { original: domain.resolveCategory('expense', 'sjsjn', [archived]) }, { data, locale: 'en-AR' }).render();
  assert.equal(find(english, 'LifecycleNote').props.title, 'Archived');
  const active = harness('src/ui/category-form.tsx', { original: domain.resolveCategory('expense', 'Comida') });
  assert.equal(nodes(active.render()).some(node => node.type === 'LifecycleNote'), false);
  assert.equal(nodes(active.render()).some(node => node.type === 'FieldNote'), false, 'no rename note before a rename');
  find(active.render(), 'Field').props.onChangeText('Alimentación');
  const renamed = active.render();
  const types = nodes(renamed).map(node => node.type);
  assert.equal(types.indexOf('FieldNote'), types.indexOf('Field') + 1, 'right under the field that causes it');
  assert.ok(types.indexOf('FieldNote') < types.indexOf('IconColorPicker'));
  assert.equal(find(renamed, 'FieldNote').props.children, 'Los movimientos se siguen registrando como «Comida» y se muestran como «Alimentación».');
});

test('24UX6E: every edit modal keeps a close button when there is nothing to edit, with its form\'s own fallback', () => {
  const routes: [string, string][] = [['app/edit-category.tsx', '/categories'], ['app/edit-budget/[id].tsx', '/budgets'], ['app/edit-debt/[id].tsx', '/debts'],
    ['app/edit-recurring/[id].tsx', '/recurring']];
  for (const [file, fallback] of routes) {
    const params = { id: 'nunca', kind: 'expense', key: 'nunca' };
    const view = harness(file, {}, { params });
    const root = view.render();
    assert.ok(find(root, 'EmptyState'), file);
    const close = nodes(root).find(node => node.type === 'Stack.Screen')!.props.options.headerLeft();
    assert.deepEqual([close.type, close.props.name, close.props.label], ['IconButton', 'close', 'Cerrar'], file);
    close.props.onPress();
    assert.equal(view.backs(), 1, file);
    const alone = harness(file, {}, { params, root: true });
    nodes(alone.render()).find(node => node.type === 'Stack.Screen')!.props.options.headerLeft().props.onPress();
    assert.deepEqual([alone.backs(), alone.pushed], [0, [fallback]], file + ': nothing behind it');
  }
  // Editar cuenta: an unknown and a deleted account both keep the close; with nothing behind, it goes to Cuentas.
  const at = '2026-09-27T10:00:00.000Z';
  const data = { ...archive, accounts: archive.accounts.map(item => item.id === 'cash' ? { ...cash, revision: 1, updatedAt: at, deletedAt: at } : item) };
  for (const options of [{ params: { id: 'nunca' } }, { data, params: { id: 'cash' } }]) {
    const view = harness('app/edit-account/[id].tsx', {}, options);
    const close = nodes(view.render()).find(node => node.type === 'Stack.Screen')!.props.options.headerLeft();
    assert.equal(close.props.label, 'Cerrar');
    close.props.onPress();
    assert.equal(view.backs(), 1);
    const alone = harness('app/edit-account/[id].tsx', {}, { ...options, root: true });
    nodes(alone.render()).find(node => node.type === 'Stack.Screen')!.props.options.headerLeft().props.onPress();
    assert.deepEqual([alone.dismissed, alone.pushed], [['/accounts'], []]);
  }
});

test('24UX6E: after «Eliminar cuenta» the editor dismisses to Cuentas in one step; its close falls back to Cuentas the same way', async () => {
  const view = harness('app/edit-account/[id].tsx', {}, { params: { id: 'cash' } });
  removed.length = 0;
  find(view.render(), 'ActionButton', 'Eliminar cuenta').props.onPress();
  assert.equal(removed.length, 1);
  assert.deepEqual(view.dismissed, ['/accounts'], 'pops to Cuentas when it is in the stack (dismissTo)');
  assert.deepEqual(view.pushed, [], 'never a replace on top of the stack');
  const alone = harness('app/edit-account/[id].tsx', {}, { params: { id: 'cash' }, root: true });
  await find(alone.render(), 'ActionButton', 'Guardar cambios').props.onPress();
  assert.deepEqual([alone.backs(), alone.dismissed, alone.changed.length], [0, ['/accounts'], 0], 'an unchanged save closes to Cuentas');
});
