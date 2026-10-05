import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as domain from '@finanzapp/domain';
import * as currencyGate from '../src/storage/currency-gate.ts';
import * as categories from '../src/ui/categories.ts';
import * as appearance from '../src/ui/appearance.ts';
import * as materialPolicy from '../src/ui/material-policy.ts';
import * as i18nFormat from '../src/i18n/format.ts';
import { bindLocale } from '../src/i18n/bind.ts';
import * as localeOptions from '../src/ui/locale-options.ts';
import * as operationPresentation from '../src/ui/operation-presentation.ts';
import { createLocaleStore } from '../src/i18n/store.ts';
import type { AppLocale, ReleasedSets } from '../src/i18n/locale.ts';
function localeStore(released?: ReleasedSets) {
  const rows = new Map<string, string>();
  return createLocaleStore({ devices: () => ({ source: 'native', locales: [{ languageTag: 'es-AR', regionCode: 'AR' }] }), released,
    store: () => ({ getItemSync: key => rows.get(key) ?? null, setItemSync: (key, value) => { rows.set(key, value); }, removeItemSync: key => rows.delete(key) }) });
}
let currentLocaleStore = localeStore();
// Renders a chosen locale without touching the store's device reading or saved choices (the 23.1B2 English tests).
// English is released since 23.1C2, so a test may also choose it through the store, as a person does in Más.
let forcedLocale: AppLocale | null = null;
const i18nProvider = { useI18n: () => bindLocale(forcedLocale ?? currentLocaleStore.getState().locale),
  useLocalePreferences: () => ({ state: currentLocaleStore.getState(), setLanguage: currentLocaleStore.setLanguage, setRegion: currentLocaleStore.setRegion }) };

// Producto 18: the Más hub, the backup screen and the read-only categories
// screen with native hosts replaced by descriptors. Not a rendered iOS screen.
type Node = { type: any; props: Record<string, any> };
const createdAt = '2026-09-01T12:00:00.000Z';
const cash: domain.Account = { id: 'cash', name: 'Banco', currency: 'ARS', openingMinor: 100000, createdAt };
const debtAccount: domain.Account = { id: 'debt-acc', name: 'Debo · Juan', currency: 'ARS', openingMinor: -30000, createdAt };
const debt: domain.PersonalDebtProfile = { id: 'debt', accountId: debtAccount.id, direction: 'owed_by_me', counterparty: 'Juan', dueDateISO: null,
  note: '', active: true, deleted: false, createdAt, revision: 0, updatedAt: createdAt };
const rule: domain.RecurringRule = { id: 'rent', accountId: cash.id, kind: 'expense', amountMinor: 40000, merchant: 'Alquiler', category: 'Hogar', frequency: 'monthly',
  anchorDateISO: '2026-10-01', nextDateISO: '2026-10-01', active: true, deleted: false, createdAt, revision: 0, updatedAt: createdAt };
const entries: domain.Entry[] = [
  { id: 'e1', accountId: cash.id, kind: 'expense', amountMinor: 3000, merchant: 'Prueba', category: 'sjsjn', dateISO: '2026-09-10', createdAt },
  { id: 'e2', accountId: cash.id, kind: 'expense', amountMinor: 9000, merchant: 'Prueba', category: 'JD', dateISO: '2026-09-12', createdAt },
  { id: 'e3', accountId: cash.id, kind: 'expense', amountMinor: 700, merchant: 'Super', category: 'Supermercado', dateISO: '2026-09-13', createdAt },
];
const undone = domain.initialRecord({ id: 'e4', accountId: cash.id, kind: 'expense', amountMinor: 100, merchant: 'Error', category: 'Otros', dateISO: '2026-09-14', createdAt });
const archive: domain.LedgerArchive = { accounts: [cash, debtAccount], records: [...entries.map(domain.initialRecord), { ...undone, voided: true }],
  debts: [debt], recurring: [rule], budgets: [] };

/** 24UX6E: what `useStacked` answers (Categorías rows) and the device hairline, a value no literal would match. */
let stackedRows = false;
/** 25A-03: the review store as LedgerProvider hands it; undefined (not provided) by default, as before 25A-03. */
let reviewTray: unknown = undefined;
const HAIRLINE = 0.33;
/** The appearance preference the harness hands the screens (24UX6A); reset by every harness. */
const appearanceState = { preference: 'system', system: 'light', saved: [] as string[], refuse: false };
function harness(file: string, data: domain.LedgerArchive = archive, released?: ReleasedSets, locale: AppLocale | null = null, gate?: domain.CurrencyGate, dev = true) {
  currentLocaleStore = localeStore(released);
  forcedLocale = locale;
  const source = readFileSync(new URL('../app/' + file, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const jsx = (type: unknown, props: Record<string, unknown>) => ({ type, props });
  const state: unknown[] = [];
  const pushed: any[] = [];
  let cursor = 0;
  const ledger = { useLedger: () => ({ ...(gate ? { gate } : {}), archive: data, snapshot: domain.snapshotFromArchive(data), review: reviewTray }) };
  const names = ['ActionButton', 'AppText', 'CategoryBadge', 'DetailRow', 'EmptyState', 'ErrorMessage', 'GlyphTile', 'IconButton', 'NavigationRow', 'PressFeedback', 'Screen', 'SectionTitle', 'Surface'];
  const components = Object.fromEntries(names.map(name => [name, name]));
  // 24UX6E: Categorías wraps a name instead of cutting it when rows stack (accessibility text sizes).
  (components as Record<string, unknown>).useStacked = () => stackedRows;
  appearanceState.preference = 'system'; appearanceState.system = 'light'; appearanceState.saved = []; appearanceState.refuse = false;
  const theme = { usePalette: () => ({ text: '#000', secondary: '#666', line: '#ddd', isDark: false }),
    // 24UX6A: the appearance preference as `useThemePreference` hands it (the store itself: tests/theme-preference.node.ts).
    useThemePreference: () => ({ preference: appearanceState.preference, system: appearanceState.system,
      setPreference: (value: string) => { if (appearanceState.refuse) return false; appearanceState.preference = value; appearanceState.saved.push(value); return true; } }) };
  const modules: Record<string, unknown> = {
    '../i18n/format': i18nFormat, '../src/i18n/format': i18nFormat, '../../src/i18n/format': i18nFormat, '../i18n/provider': i18nProvider, '../src/i18n/provider': i18nProvider, '../../src/i18n/provider': i18nProvider,
    react: { useMemo: (fn: () => unknown) => fn(), useRef: (initial: unknown) => ({ current: initial }), useState: (initial: unknown) => {
      const index = cursor++;
      if (!(index in state)) state[index] = typeof initial === 'function' ? (initial as () => unknown)() : initial;
      return [state[index], (value: unknown) => { state[index] = value; }];
    } },
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'react-native': { View: 'View', StyleSheet: { hairlineWidth: HAIRLINE } },
    'expo-router': { Stack: { Screen: 'Stack.Screen' }, router: { push: (to: unknown) => pushed.push(to), navigate: (to: unknown) => pushed.push(to) } },
    'expo-file-system': { File: class {}, Paths: { cache: '/cache' } },
    'expo-sharing': { isAvailableAsync: async () => false, shareAsync: async () => {} },
    '@finanzapp/domain': domain,
    '../src/storage/LedgerProvider': ledger, '../../src/storage/LedgerProvider': ledger,
 '../../src/storage/currency-gate': currencyGate, '../src/storage/currency-gate': currencyGate,
    '../src/ui/components': components, '../../src/ui/components': components,
    '../src/ui/categories': categories,
    '../src/ui/appearance': appearance, '../../src/ui/appearance': appearance,
    '../src/ui/category-hues': { useCategoryColor: () => '#3E6FB0', useCategoryLabel: (s: string) => s, useCategoryDefinitions: () => [], useCategoryLook: (s: string) => ({ label: s, storedLabel: s, key: String(s).toLowerCase(), hex: '#3E6FB0', glyph: 'pricetag-outline' }), useCategoryLookOf: () => (s: string) => ({ label: s, storedLabel: s, key: String(s).toLowerCase(), hex: '#3E6FB0', glyph: 'pricetag-outline' }), useAccountLook: () => ({ icon: 'wallet', color: 'cobalt', glyph: 'wallet-outline', hex: '#2557D6' }), useAccountNameOf: () => (account: any) => account.name, useAccountLookOf: () => () => ({ icon: 'wallet', color: 'cobalt', glyph: 'wallet-outline', hex: '#2557D6' }) }, '../../src/ui/category-hues': { useCategoryColor: () => '#3E6FB0', useCategoryLabel: (s: string) => s, useCategoryDefinitions: () => [], useCategoryLook: (s: string) => ({ label: s, storedLabel: s, key: String(s).toLowerCase(), hex: '#3E6FB0', glyph: 'pricetag-outline' }), useCategoryLookOf: () => (s: string) => ({ label: s, storedLabel: s, key: String(s).toLowerCase(), hex: '#3E6FB0', glyph: 'pricetag-outline' }), useAccountLook: () => ({ icon: 'wallet', color: 'cobalt', glyph: 'wallet-outline', hex: '#2557D6' }), useAccountNameOf: () => (account: any) => account.name, useAccountLookOf: () => () => ({ icon: 'wallet', color: 'cobalt', glyph: 'wallet-outline', hex: '#2557D6' }) },
    '../src/ui/theme': theme, '../../src/ui/theme': theme,
    '../src/ui/material': { useMaterialDecision: () => ({ material: 'opaque', reason: 'expo-go' }) }, '../../src/ui/material': { useMaterialDecision: () => ({ material: 'opaque', reason: 'expo-go' }) },
    '../../src/ui/locale-options': localeOptions,
    '../src/ui/material-policy': materialPolicy, '../../src/ui/material-policy': materialPolicy,
    '../src/ui/choice-screen': { ChoiceScreen: 'ChoiceScreen' },
    '../src/ui/entry-list': { EntryList: 'EntryList' },
    // 24T3: Movimientos deshechos also lists undone devoluciones and adelantos (their restore flow runs for real in
    // tests/refund-routes.node.ts); here the rows only need the pure projection and an idle action hook.
    '../src/ui/operation-presentation': operationPresentation,
    '../src/ui/operation-actions': { useOperationChange: () => ({ busyId: null, error: null, pending: null, check: () => ({ ok: true, inserts: [] }), ask: () => {} }) },
  };
  const module = { exports: {} as { default?: () => Node } };
  // A development build unless a test says otherwise (24UX5: the diagnostics line exists only there).
  runInNewContext(code, { module, exports: module.exports, Date, __DEV__: dev, require: (name: string) => {
    if (!Object.hasOwn(modules, name)) throw new Error('Unexpected Más dependency: ' + name);
    return modules[name];
  } });
  return { render: () => { cursor = 0; return module.exports.default!(); }, pushed };
}
function nodes(value: any): Node[] {
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!value.props) return [];
  const own = typeof value.type === 'function' ? nodes(value.type(value.props)) : [];
  return [value, ...own, ...nodes(value.props.children)];
}
// Más and backup rows lead somewhere: title over subtitle, never a label/value pair competing for one line.
const rows = (root: Node) => nodes(root).filter(node => node.type === 'NavigationRow');
/** 24UX6C: Más heads its two groups with a small caps label: an AppText with the header role (the VoiceOver rotor reaches it)
 * in the eyebrow variant, never a SectionTitle. */
const groupLabels = (root: Node) => nodes(root).filter(node => node.type === 'AppText' && node.props.accessibilityRole === 'header' && node.props.variant === 'eyebrow')
  .map(node => node.props.children);
/** Every Más destination, in order (Región only while two regions are released). */
const MORE_ROUTES = ['/accounts', '/cards', '/budgets', '/recurring', '/debts', '/categories', '/backup', '/undone-entries', '/language', '/region', '/appearance'];

test('Más groups permanent navigation into Finanzas and App y datos, with live counts', () => {
  const view = harness('(tabs)/settings.tsx');
  const root = view.render();
  assert.equal(groupLabels(root).join(','), 'Finanzas,App y datos');
  assert.equal(nodes(root).some(node => node.type === 'SectionTitle'), false, '24UX6C: small caps group labels replace the section titles');
  assert.equal([root.type, root.props.gap].join(','), 'Screen,28', '24UX6C: one 28 pt spacing between groups');
  const groups = (root.props.children as Node[]).filter(child => child && child.type === 'View' && nodes(child).some(node => node.type === 'Surface'));
  assert.equal(groups.map(group => group.props.style.gap).join(','), '8,8', '8 pt between a label and its rows');
  const labels = rows(root).map(row => row.props.title);
  assert.deepEqual(labels, ['Cuentas', 'Tarjetas', 'Presupuestos', 'Recurrentes', 'Deudas y cobros', 'Categorías', 'Copia de seguridad', 'Movimientos deshechos', 'Idioma', 'Región', 'Apariencia']);
  assert.equal(labels.includes('Asistente'), false, 'the Assistant is a root-stack screen opened from the dock\'s «+» capture hub, not a Más row');
  const value = (label: string) => rows(root).find(row => row.props.title === label)!.props.subtitle;
  assert.equal(value('Tarjetas'), 'Compras y resúmenes', 'no cards recorded: an honest placeholder');
  assert.equal(value('Recurrentes'), '1 activo');
  assert.equal(value('Deudas y cobros'), '1 pendiente');
  assert.equal(value('Presupuestos'), 'Plan mensual');
  assert.equal(value('Movimientos deshechos'), '1 recuperable');
  for (const row of rows(root)) row.props.onPress();
  assert.deepEqual(view.pushed, ['/accounts', '/cards', '/budgets', '/recurring', '/debts', '/categories', '/backup', '/undone-entries', '/language', '/region', '/appearance']);
  // Each group closes its last row; no export button or sharing lives on the hub any more.
  assert.deepEqual(rows(root).filter(row => row.props.last).map(row => row.props.title), ['Categorías', 'Apariencia']);
  assert.equal(value('Apariencia'), 'Sistema', '24UX6A: the default follows the device');
  assert.equal(nodes(root).some(node => node.type === 'ActionButton'), false);
  const texts = nodes(root).filter(node => node.type === 'AppText').map(node => String(node.props.children)).join(' ');
  assert.match(texts, /FinanzApp 0\.1\.0 \(25A-04\)/, 'the version line, like the About line of an iOS app');
  assert.match(texts, /Material opaco \(Expo Go\)/, 'a development build says which control material this session draws, so a tester can confirm the mode');
  assert.doesNotMatch(texts, /Piloto nativo|Producto 24/, '24UX5: no project vocabulary on the settings screen');
  assert.equal(value('Categorías'), 'Gastos e ingresos');
  // Finanzas rows carry a soft identity tile from the shared palette. 24UX6C: App y datos rows lead with neutral 34 pt tiles
  // (no colour: the component's own neutral fill), so both groups align on one leading edge; no row keeps a bare icon prop.
  const leading = rows(root).map(row => row.props.leading?.type ?? null);
  assert.equal(leading.join(','), Array(11).fill('GlyphTile').join(','));
  assert.equal(rows(root).every(row => row.props.leading.props.size === 34), true, 'one tile size in both groups');
  assert.equal(new Set(rows(root).slice(0, 6).map(row => row.props.leading.props.color)).size, 6, 'six distinct restrained colours, no row painted');
  assert.equal(rows(root).slice(0, 6).every(row => typeof row.props.leading.props.color === 'string'), true, 'Finanzas keeps its tinted identities');
  assert.equal(rows(root).slice(6).map(row => row.props.leading.props.icon).join(','), 'save-outline,arrow-undo-outline,language-outline,globe-outline,contrast-outline', 'App y datos keeps its glyphs, now in tiles');
  assert.equal(rows(root).slice(6).every(row => row.props.leading.props.color === undefined), true, 'App y datos tiles stay neutral');
  assert.equal(rows(root).some(row => 'icon' in row.props), false, 'no row keeps the old icon prop');
  assert.equal(rows(root).some(row => 'value' in row.props || 'label' in row.props), false, 'no leftover label/value props');
  assert.match(texts, /se guardan solo en este dispositivo y funcionan sin conexión/);
});

test('Más → App y datos (23.1C2): Idioma and Región say what is in use and whether it follows the device; Región hides in a single-region build', () => {
  // The default harness store uses the release gate itself (RELEASED), as the app does.
  const view = harness('(tabs)/settings.tsx');
  const root = view.render();
  assert.deepEqual(rows(root).slice(6).map(row => row.props.title), ['Copia de seguridad', 'Movimientos deshechos', 'Idioma', 'Región', 'Apariencia']);
  assert.equal(rows(root).find(row => row.props.title === 'Idioma')!.props.subtitle, 'Español · según el dispositivo');
  const region = rows(root).find(row => row.props.title === 'Región')!;
  assert.equal(region.props.subtitle, 'Argentina · según el dispositivo');
  assert.equal(region.props.leading.type, 'GlyphTile');
  assert.equal(region.props.leading.props.icon, 'globe-outline', '24UX6C: the glyph sits in a neutral tile');
  assert.equal(region.props.last, undefined, '24UX6A: Apariencia closes App y datos');
  region.props.onPress();
  assert.deepEqual(view.pushed, ['/region']);
  assert.equal(currentLocaleStore.setLanguage('es'), true);
  assert.equal(rows(view.render()).find(row => row.props.title === 'Idioma')!.props.subtitle, 'Español', 'an explicit choice reads plainly');
  assert.equal(currentLocaleStore.setRegion('US'), true);
  assert.equal(rows(view.render()).find(row => row.props.title === 'Región')!.props.subtitle, 'Estados Unidos', 'Spanish words, US conventions');
  assert.equal(currentLocaleStore.setLanguage('en'), true, 'English is released: Más can choose it');
  const english = rows(view.render());
  assert.equal(english.find(row => row.props.title === 'Language')!.props.subtitle, 'English', 'the hub re-renders in English');
  assert.equal(english.find(row => row.props.title === 'Region')!.props.subtitle, 'United States');
  // A build with a single released region (a narrower gate) hides Región; Apariencia still closes the group.
  const single = rows(harness('(tabs)/settings.tsx', archive, { languages: ['es'], regions: ['AR'] }).render());
  assert.equal(single.some(row => row.props.title === 'Región'), false);
  assert.deepEqual(single.filter(row => row.props.last).map(row => row.props.title), ['Categorías', 'Apariencia']);
});

test('24UX6C: the Más polish preserves every route, in the same order, in both languages; no «Ajustes» destination', () => {
  for (const locale of [null, 'en-AR'] as const) {
    const view = harness('(tabs)/settings.tsx', archive, undefined, locale);
    const root = view.render();
    const all = rows(root);
    assert.equal(all.length, MORE_ROUTES.length, 'no row added or removed');
    for (const row of all) row.props.onPress();
    assert.equal(view.pushed.join(','), MORE_ROUTES.join(','), 'every row opens the same screen as before');
    assert.equal(all.filter(row => row.props.last).length, 2, 'two groups, each closed by its last row');
    const titles = all.map(row => row.props.title).join(',');
    assert.doesNotMatch(titles, /Ajustes|Settings/, 'Más is the hub itself; there is no Ajustes row');
    assert.equal(groupLabels(root).length, 2, 'exactly two group labels');
  }
  // A single-region build drops only Región; every other route stays in place.
  const single = harness('(tabs)/settings.tsx', archive, { languages: ['es'], regions: ['AR'] });
  for (const row of rows(single.render())) row.props.onPress();
  assert.equal(single.pushed.join(','), MORE_ROUTES.filter(route => route !== '/region').join(','));
});

test('Más → Tarjetas counts active credit cards and opens the pushed Tarjetas screen', () => {
  const card: domain.CreditCardProfile = { id: 'card', accountId: cash.id, issuer: 'Visa', last4: '4009', creditLimitMinor: null, closingDay: 28, dueDay: 5, active: true, deleted: false, createdAt, revision: 0, updatedAt: createdAt };
  const view = harness('(tabs)/settings.tsx', { ...archive, cards: [card, { ...card, id: 'old', active: false }] });
  const root = view.render();
  const row = rows(root).find(item => item.props.title === 'Tarjetas')!;
  assert.equal(row.props.subtitle, '1 tarjeta de crédito');
  assert.equal(row.props.leading.props.icon, 'card-outline');
  row.props.onPress();
  assert.deepEqual(view.pushed, ['/cards']);
});

test('Más empty ledger shows honest placeholders instead of zero counts', () => {
  const root = harness('(tabs)/settings.tsx', { accounts: [], records: [] }).render();
  const value = (label: string) => rows(root).find(row => row.props.title === label)!.props.subtitle;
  assert.equal(value('Recurrentes'), 'Pagos e ingresos');
  assert.equal(value('Deudas y cobros'), 'Debo · me deben');
  assert.equal(value('Movimientos deshechos'), 'Ninguno');
});

test('24T3: Más counts an undone devolución among the undone movements (the screen it opens lists and restores it)', () => {
  const ledger: domain.LedgerArchive = { accounts: [cash], records: entries.map(domain.initialRecord) };
  const refund = domain.newEntryRefund(ledger, { id: 'r1', entryId: 'e1', amountMinor: 1000, dateISO: '2026-09-15', todayISO: '2026-09-20', createdAt: '2026-09-15T12:00:00.000Z' });
  const undoneRefund = domain.makeOperationChange('undo', refund, 'void', '2026-09-16T12:00:00.000Z').after;
  const value = (data: domain.LedgerArchive) => rows(harness('(tabs)/settings.tsx', data).render()).find(row => row.props.title === 'Movimientos deshechos')!.props.subtitle;
  assert.equal(value({ ...ledger, purchaseOperations: [undoneRefund] }), '1 recuperable', 'never «Ninguno» over a list that holds it');
  assert.equal(value({ ...ledger, purchaseOperations: [refund] }), 'Ninguno', 'a live devolución is not undone');
  assert.equal(value({ ...archive, purchaseOperations: [undoneRefund] }), '2 recuperables');
});

test('the backup screen keeps export and import together and links the review flow', () => {
  const view = harness('backup.tsx');
  const root = view.render();
  const button = nodes(root).find(node => node.type === 'ActionButton')!;
  assert.equal(button.props.label, 'Compartir copia');
  assert.equal(button.props.disabled, false);
  assert.equal(button.props.secondary, true);
  const importRow = rows(root).find(row => row.props.title === 'Importar copia')!;
  assert.equal(importRow.props.subtitle, 'Revisar el archivo antes de agregar');
  importRow.props.onPress();
  assert.deepEqual(view.pushed, ['/backup-import']);
  const disabled = harness('backup.tsx', { accounts: [], records: [] });
  assert.equal(nodes(disabled.render()).find(node => node.type === 'ActionButton')!.props.disabled, false, 'an empty ledger can still be backed up');
});

test('the categories screen lists presets, custom and historical categories with usage, opens the editor, and never edits the ledger', () => {
  const before = JSON.stringify(archive);
  const view = harness('categories.tsx');
  const root = view.render();
  assert.deepEqual(nodes(root).filter(node => node.type === 'SectionTitle').map(node => node.props.children), ['Gastos', 'Ingresos'], 'no Archivadas group without archived categories');
  const badges = nodes(root).filter(node => node.type === 'CategoryBadge').map(node => node.props.category);
  // 24T2: Intereses is latent (no movement, definition or plan with interest here).
  assert.deepEqual(badges.slice(0, 21), ['Comida', 'Supermercado', 'Restaurantes', 'Transporte', 'Combustible', 'Hogar', 'Alquiler', 'Servicios', 'Suscripciones', 'Salud',
    'Farmacia', 'Educación', 'Ropa', 'Tecnología', 'Ocio', 'Viajes', 'Mascotas', 'Regalos', 'Impuestos', 'Seguros', 'Otros']);
  assert.deepEqual(badges.slice(21, 23), ['JD', 'sjsjn'], 'historical custom categories stay, most used first, spelled as recorded');
  assert.deepEqual(badges.slice(23), ['Sueldo', 'Trabajo', 'Ventas', 'Inversiones', 'Regalos', 'Reembolsos', 'Préstamos', 'Otros']);
  const pressables = nodes(root).filter(node => node.type === 'PressFeedback');
  const labels = pressables.map(node => node.props.accessibilityLabel);
  assert.ok(labels.includes('JD, 1 movimiento · Histórica'));
  assert.ok(labels.includes('Supermercado, 1 movimiento · Predeterminada'));
  assert.ok(labels.includes('Comida, Predeterminada'));
  pressables.find(node => node.props.accessibilityLabel.startsWith('JD,'))!.props.onPress();
  assert.equal(JSON.stringify(view.pushed), JSON.stringify([{ pathname: '/edit-category', params: { kind: 'expense', key: 'jd' } }]));
  const header = nodes(root).find(node => node.type === 'Stack.Screen')!.props.options.headerRight();
  assert.equal(header.props.label, 'Nueva categoría');
  header.props.onPress();
  assert.equal(view.pushed[1], '/new-category');
  assert.equal(JSON.stringify(archive), before);
});

test('an archived definition moves its category to a quiet Archivadas group and a renamed preset shows its display name', () => {
  const renamed = domain.editedCategoryDefinition(domain.resolveCategory('expense', 'Comida'), { label: 'Alimentación', icon: 'cafe', color: 'green' }, createdAt);
  const archived = domain.editedCategoryDefinition(domain.resolveCategory('expense', 'sjsjn'), { archived: true }, createdAt);
  const root = harness('categories.tsx', { ...archive, categories: [renamed, archived] }).render();
  assert.deepEqual(nodes(root).filter(node => node.type === 'SectionTitle').map(node => node.props.children), ['Gastos', 'Ingresos', 'Archivadas']);
  const labels = nodes(root).filter(node => node.type === 'PressFeedback').map(node => node.props.accessibilityLabel);
  assert.ok(labels.includes('Alimentación, Predeterminada · editada'), labels.join(' | '));
  // 24UX6E: the archived row says its kind, spoken as a word in the sentence.
  assert.ok(labels.includes('sjsjn, gasto, 1 movimiento · Propia, archivada'), 'an adopted historical string is now the user\'s own definition');
  assert.equal(labels.filter(label => label.startsWith('sjsjn')).length, 1, 'archived once, in its own group');
});

// Producto 23.1B2: Más, Copia de seguridad and Categorías in English. Words
// change; routes, counts, the stored category strings and the ledger do not.
test('23.1B2 English Más: every row, count, note and the diagnostic footer are translated; routes and order are the same', () => {
  const view = harness('(tabs)/settings.tsx', archive, undefined, 'en-AR');
  const root = view.render();
  assert.equal(groupLabels(root).join(','), 'Finances,App and data');
  assert.equal(rows(root).map(row => row.props.title).join(','), 'Accounts,Cards,Budgets,Recurring,Debts and IOUs,Categories,Backup,Undone transactions,Language,Region,Appearance');
  const value = (label: string) => rows(root).find(row => row.props.title === label)!.props.subtitle;
  assert.equal(value('Recurring'), '1 active');
  assert.equal(value('Debts and IOUs'), '1 pending');
  assert.equal(value('Undone transactions'), '1 can be restored', 'the glossary word for recuperar, as on the screen it opens');
  assert.equal(value('Cards'), 'Purchases and statements');
  assert.equal(value('Language'), 'Español · same as device', 'a language is named in its own language');
  assert.equal(value('Region'), 'Argentina · same as device', 'a region is named in the interface language');
  assert.equal(value('Appearance'), 'System');
  for (const row of rows(root)) row.props.onPress();
  assert.equal(view.pushed.join(','), '/accounts,/cards,/budgets,/recurring,/debts,/categories,/backup,/undone-entries,/language,/region,/appearance');
  const texts = nodes(root).filter(node => node.type === 'AppText').map(node => String(node.props.children)).join(' ');
  assert.match(texts, /FinanzApp 0\.1\.0 \(25A-04\)/);
  assert.match(texts, /Opaque material \(Expo Go\) · Language: default/);
  assert.match(texts, /saved only on this device and work offline/);
  assert.doesNotMatch(texts, /Material opaco|Idioma|Región|sincronización/);
  const card: domain.CreditCardProfile = { id: 'card', accountId: cash.id, issuer: 'Visa', last4: '4009', creditLimitMinor: null, closingDay: 28, dueDay: 5, active: true, deleted: false, createdAt, revision: 0, updatedAt: createdAt };
  const cards = harness('(tabs)/settings.tsx', { ...archive, cards: [card, { ...card, id: 'two' }] }, undefined, 'en-AR').render();
  assert.equal(rows(cards).find(row => row.props.title === 'Cards')!.props.subtitle, '2 credit cards');
});

test('23.1B2 English backup screen and categories list: labels in English, stored category strings and routes untouched', () => {
  const backup = harness('backup.tsx', archive, undefined, 'en-AR').render();
  assert.equal(nodes(backup).find(node => node.type === 'ActionButton')!.props.label, 'Share backup');
  const importRow = rows(backup)[0];
  assert.equal([importRow.props.title, importRow.props.subtitle].join(' / '), 'Import backup / Review the file before adding');
  const before = JSON.stringify(archive);
  const renamed = domain.editedCategoryDefinition(domain.resolveCategory('expense', 'Comida'), { label: 'Alimentación' }, createdAt);
  const view = harness('categories.tsx', { ...archive, categories: [renamed] }, undefined, 'en-AR');
  const root = view.render();
  assert.equal(nodes(root).filter(node => node.type === 'SectionTitle').map(node => node.props.children).join(','), 'Expenses,Income');
  const badges = nodes(root).filter(node => node.type === 'CategoryBadge').map(node => node.props.category);
  assert.equal(badges.slice(0, 3).join(','), 'Comida,Supermercado,Restaurantes', 'the badge still receives the stored spelling');
  const labels = nodes(root).filter(node => node.type === 'PressFeedback').map(node => node.props.accessibilityLabel);
  assert.ok(labels.includes('Groceries, 1 transaction · Built-in'), labels.join(' | '));
  assert.ok(labels.includes('Alimentación, Built-in · edited'), 'a renamed preset keeps the person\'s name');
  assert.ok(labels.includes('JD, 1 transaction · From history'), 'a historical string is never translated');
  assert.ok(labels.includes('Salary, Built-in'));
  const names = nodes(root).filter(node => node.type === 'AppText' && node.props.numberOfLines === 2).map(node => node.props.children);
  assert.ok(names.includes('Groceries') && names.includes('Alimentación') && names.includes('sjsjn') && !names.includes('Supermercado'));
  nodes(root).find(node => node.type === 'PressFeedback' && node.props.accessibilityLabel.startsWith('Groceries'))!.props.onPress();
  assert.equal(JSON.stringify(view.pushed), JSON.stringify([{ pathname: '/edit-category', params: { kind: 'expense', key: 'supermercado' } }]), 'the route carries the identity key, never a label');
  assert.equal(nodes(root).find(node => node.type === 'Stack.Screen')!.props.options.headerRight().props.label, 'New category');
  assert.equal(JSON.stringify(archive), before);
});

test('24B5: a release names no test currency in Más; a development preview gate is announced under the footer so nobody mistakes it for production', () => {
  const release = harness('(tabs)/settings.tsx').render();
  const texts = (root: any) => nodes(root).filter(node => node.type === 'AppText').map(node => String(node.props.children)).join(' ');
  assert.doesNotMatch(texts(release), /Monedas de prueba/);
  const preview = harness('(tabs)/settings.tsx', archive, undefined, null, currencyGate.PREVIEW_CURRENCIES).render();
  assert.match(texts(preview), /Monedas de prueba activas: BHD, IQD, JOD, KWD, LYD, OMR, TND\. Solo en esta compilación de desarrollo\./);
  const english = harness('(tabs)/settings.tsx', archive, undefined, 'en-AR', currencyGate.PREVIEW_CURRENCIES).render();
  assert.match(texts(english), /Test currencies enabled: BHD, IQD, JOD, KWD, LYD, OMR, TND\. Only in this development build\./);
});

test('24UX5: a preview or store build shows the version and the local-storage note, never the diagnostics', () => {
  for (const locale of [null, 'en-AR'] as const) {
    const root = harness('(tabs)/settings.tsx', archive, undefined, locale, undefined, false).render();
    const texts = nodes(root).filter(node => node.type === 'AppText').map(node => String(node.props.children)).join(' ');
    assert.match(texts, /FinanzApp 0\.1\.0 \(25A-04\)/);
    assert.doesNotMatch(texts, /Material|material|Idioma:|Language:/, 'no material or locale diagnostics outside a development build');
    assert.match(texts, locale ? /saved only on this device/ : /se guardan solo en este dispositivo/, 'privacy and storage information stays');
  }
});

test('24UX6A: Más → Apariencia names the choice in use and opens the chooser: Sistema (what the device shows now), Claro, Oscuro', () => {
  const view = harness('(tabs)/settings.tsx');
  appearanceState.preference = 'dark';
  assert.equal(rows(view.render()).find(row => row.props.title === 'Apariencia')!.props.subtitle, 'Oscuro');
  appearanceState.preference = 'light';
  assert.equal(rows(view.render()).find(row => row.props.title === 'Apariencia')!.props.subtitle, 'Claro');
  const screen = harness('appearance.tsx');
  let chooser = screen.render() as any;
  assert.equal(chooser.type, 'ChoiceScreen');
  assert.equal(chooser.props.title, 'Apariencia');
  assert.equal(chooser.props.selected, 'system', 'a new installation follows the device');
  assert.equal(JSON.stringify([chooser.props.pinned.value, chooser.props.pinned.title, chooser.props.pinned.subtitle]), JSON.stringify(['system', 'Sistema', 'Según el dispositivo · ahora claro']));
  assert.equal(JSON.stringify(chooser.props.options), JSON.stringify([{ value: 'light', title: 'Claro' }, { value: 'dark', title: 'Oscuro' }]));
  assert.match(chooser.props.note, /^Cambia solo cómo se ve FinanzApp en este dispositivo\. No modifica tus movimientos, tus cuentas ni tus copias de seguridad\.$/);
  appearanceState.system = 'dark';
  assert.equal(screen.render().props.pinned.subtitle, 'Según el dispositivo · ahora oscuro', 'the device\'s current look, read live');
  assert.equal(chooser.props.onChoose('dark'), true);
  assert.deepEqual(appearanceState.saved, ['dark'], 'the store saves; the chooser only asks');
  chooser = screen.render();
  assert.equal(chooser.props.selected, 'dark');
  assert.equal(chooser.props.pinned.subtitle, 'Según el dispositivo', 'not selected: what Sistema would do');
  appearanceState.refuse = true;
  assert.equal(chooser.props.onChoose('light'), false, 'a refused save is reported, so the checkmark stays where it was');
  assert.equal(appearanceState.preference, 'dark');
  const english = harness('appearance.tsx', archive, undefined, 'en-AR').render() as any;
  assert.equal(JSON.stringify([english.props.title, english.props.pinned.title, english.props.options.map((option: any) => option.title)]), JSON.stringify(['Appearance', 'System', ['Light', 'Dark']]));
});

// 24UX6E (bug fix): Movimientos deshechos lists records that count nowhere, so its day sections carry no net
// (`dayNet: false`); the explanation is on the type scale (subhead, no raw size) and only over a list, never above the
// «Nada para recuperar» empty state.
test('24UX6E: Movimientos deshechos lists only undone records, with no day net, and explains them only when there is something to restore', () => {
  const list = harness('undone-entries.tsx').render() as any;
  assert.equal(list.type, 'EntryList');
  // Arrays built inside the route's context: compared as JSON, like the other route tests here.
  assert.equal(JSON.stringify([list.props.entries.map((entry: domain.Entry) => entry.id), list.props.transfers, list.props.dayNet]), JSON.stringify([['e4'], [], false]));
  assert.equal(list.props.header.type, 'AppText');
  assert.deepEqual([list.props.header.props.variant, list.props.header.props.secondary, list.props.header.props.style.fontSize], ['subhead', true, undefined]);
  assert.equal(list.props.header.props.children, 'Estos movimientos no cuentan en tus saldos ni reportes. Abrí uno para recuperarlo.');
  const nothing = harness('undone-entries.tsx', { ...archive, records: entries.map(domain.initialRecord) }).render() as any;
  assert.equal(JSON.stringify([nothing.props.entries, nothing.props.dayNet, nothing.props.header ?? null]), JSON.stringify([[], false, null]), 'nothing undone: no sentence over the empty state');
  assert.deepEqual([nothing.props.empty.type, nothing.props.empty.props.title, nothing.props.empty.props.icon], ['EmptyState', 'Nada para recuperar', 'arrow-undo-outline']);
  // An undone transfer alone is something to restore too: the sentence stands over it.
  const transfer: domain.Transfer = { id: 't1', fromAccountId: cash.id, toAccountId: debtAccount.id, amountMinor: 5000, note: 'Pago Juan', dateISO: '2026-09-15', createdAt };
  const onlyTransfer = harness('undone-entries.tsx', { ...archive, records: entries.map(domain.initialRecord),
    transfers: [{ transfer, revision: 1, voided: true, updatedAt: createdAt }] }).render() as any;
  assert.equal(JSON.stringify([onlyTransfer.props.entries, onlyTransfer.props.transfers.map((t: domain.Transfer) => t.id), onlyTransfer.props.dayNet]), JSON.stringify([[], ['t1'], false]));
  assert.equal(onlyTransfer.props.header.props.children, 'Estos movimientos no cuentan en tus saldos ni reportes. Abrí uno para recuperarlo.');
  const english = harness('undone-entries.tsx', archive, undefined, 'en-US').render() as any;
  assert.equal(english.props.header.props.children, 'These transactions do not count in your balances or reports. Open one to restore it.');
});

// 24UX6E: Categorías rows on the Forest row geometry; an archived row is never dimmed and names its kind.
test('24UX6E: category rows use the Forest geometry with hairlines and no chevron (a modal editor), and wrap names when stacked', () => {
  const root = harness('categories.tsx').render();
  const rowsOf = nodes(root).filter(node => node.type === 'PressFeedback');
  for (const row of rowsOf) {
    const { minHeight, paddingHorizontal, paddingVertical, opacity } = row.props.style;
    assert.deepEqual([minHeight, paddingHorizontal, paddingVertical, opacity], [64, 16, 12, undefined], row.props.accessibilityLabel);
  }
  const surfaces = nodes(root).filter(node => node.type === 'Surface');
  for (const surface of surfaces) {
    const own = nodes(surface).filter(node => node.type === 'PressFeedback');
    assert.deepEqual(own.map(row => row.props.style.borderBottomWidth), [...own.slice(1).map(() => HAIRLINE), 0], 'a hairline between rows, none after the last');
  }
  assert.equal(nodes(root).some(node => node.type === 'Ionicons' || node.props?.name === 'chevron-forward'), false, 'no chevron: the row opens a modal');
  const names = nodes(root).filter(node => node.type === 'AppText' && node.props.style?.fontWeight === '500');
  assert.ok(names.length > 0 && names.every(node => node.props.numberOfLines === 2));
  stackedRows = true;
  try {
    const stacked = harness('categories.tsx').render();
    const wrapped = nodes(stacked).filter(node => node.type === 'AppText' && node.props.style?.fontWeight === '500');
    assert.ok(wrapped.length > 0 && wrapped.every(node => node.props.numberOfLines === undefined), 'a long name is never cut at accessibility sizes');
  } finally { stackedRows = false; }
});

test('24UX6E: archived rows are not dimmed, lead with their kind, and the same preset archived in both kinds reads differently', () => {
  const expenseGifts = domain.editedCategoryDefinition(domain.resolveCategory('expense', 'Regalos'), { archived: true }, createdAt);
  const incomeGifts = domain.editedCategoryDefinition(domain.resolveCategory('income', 'Regalos'), { archived: true }, createdAt);
  const root = harness('categories.tsx', { ...archive, categories: [expenseGifts, incomeGifts] }).render();
  const archivedSection = (root.props.children as any[]).filter(Boolean).at(-1);
  const rows = nodes(archivedSection).filter(node => node.type === 'PressFeedback');
  assert.deepEqual(rows.map(row => row.props.accessibilityLabel), ['Regalos, gasto, Predeterminada · editada, archivada', 'Regalos, ingreso, Predeterminada · editada, archivada']);
  assert.ok(rows.every(row => row.props.style.opacity === undefined), 'never dimmed: the group and the spoken word carry the state');
  assert.ok(rows.every(row => row.props.accessibilityHint === 'Edita el nombre, el ícono y el color, o la desarchiva'));
  const details = nodes(archivedSection).filter(node => node.type === 'AppText' && node.props.variant === 'footnote').map(node => node.props.children);
  assert.deepEqual(details, ['Gasto · Predeterminada · editada', 'Ingreso · Predeterminada · editada'], 'the visible line leads with the capitalised kind');
  // The kind groups never repeat it; an active row keeps its plain hint.
  const active = nodes(root).filter(node => node.type === 'PressFeedback' && node.props.accessibilityLabel.startsWith('Comida,'))[0];
  assert.equal(active.props.accessibilityHint, 'Edita el nombre, el ícono y el color');
  const english = harness('categories.tsx', { ...archive, categories: [expenseGifts, incomeGifts] }, undefined, 'en-AR').render();
  const englishRows = nodes((english.props.children as any[]).filter(Boolean).at(-1)).filter(node => node.type === 'PressFeedback');
  assert.deepEqual(englishRows.map(row => row.props.accessibilityLabel), ['Gifts, expense, Built-in · edited, archived', 'Gifts, income, Built-in · edited, archived']);
});

test('25A-03: «Para revisar» leads Finanzas with the pending count while proposals wait, opens the tray, and is absent when nothing waits in a release build', () => {
  const item = (id: string) => ({ id, status: 'pending' });
  try {
    reviewTray = { writable: true, items: [item('a'), item('b')], unreadable: [], conflicts: [] };
    for (const dev of [true, false]) {
      const view = harness('(tabs)/settings.tsx', archive, undefined, null, undefined, dev);
      const root = view.render();
      const first = rows(root)[0];
      assert.deepEqual([first.props.title, first.props.subtitle], ['Para revisar', '2 propuestas']);
      first.props.onPress();
      assert.deepEqual(view.pushed, ['/review']);
      assert.equal(rows(root).slice(1).map(row => row.props.title).join(','), 'Cuentas,Tarjetas,Presupuestos,Recurrentes,Deudas y cobros,Categorías,Copia de seguridad,Movimientos deshechos,Idioma,Región,Apariencia',
        'every other row, in the same order');
    }
    const english = rows(harness('(tabs)/settings.tsx', archive, undefined, 'en-US').render())[0];
    assert.deepEqual([english.props.title, english.props.subtitle], ['To review', '2 proposals']);
    // Nothing pending: a release build shows no row; a development build keeps it (its test proposal is added there).
    reviewTray = { writable: true, items: [], unreadable: [], conflicts: [] };
    assert.equal(rows(harness('(tabs)/settings.tsx', archive, undefined, null, undefined, false).render())[0].props.title, 'Cuentas');
    assert.deepEqual([rows(harness('(tabs)/settings.tsx').render())[0].props.title, rows(harness('(tabs)/settings.tsx').render())[0].props.subtitle], ['Para revisar', 'Nada pendiente']);
    // An unreadable row alone still brings the row (the tray says it cannot be read), never as a counted proposal.
    reviewTray = { writable: true, items: [], unreadable: ['x'], conflicts: [] };
    const unreadable = rows(harness('(tabs)/settings.tsx', archive, undefined, null, undefined, false).render())[0];
    assert.deepEqual([unreadable.props.title, unreadable.props.subtitle], ['Para revisar', 'Nada pendiente']);
    // The review file unavailable: the ledger's Más is unchanged.
    reviewTray = 'unavailable';
    assert.equal(rows(harness('(tabs)/settings.tsx').render())[0].props.title, 'Cuentas');
  } finally { reviewTray = undefined; }
});
