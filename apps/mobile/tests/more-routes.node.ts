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
import * as backupFile from '../src/ui/backup-file.ts';
import * as licenses from '../src/ui/licenses.ts';
import { createLocaleStore } from '../src/i18n/store.ts';
import { REGION_PREFERENCE_KEY } from '../src/i18n/preference.ts';
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
// 25Q2: the export's file system and share sheet, observable; every harness() call resets them.
const exportIo = { available: false as boolean | 'throw', files: new Map<string, string>(), shares: [] as { uri: string; options: Record<string, unknown>; text: string | undefined }[],
  failShare: false, failWrite: false, maxBytes: undefined as number | undefined, created: 0, now: undefined as Date | undefined };
class MemoryFile {
  uri: string;
  constructor(parent: string, name: string) { this.uri = parent + '/' + name; }
  get exists() { return exportIo.files.has(this.uri); }
  create() { if (this.exists) throw new Error('File exists'); exportIo.created++; exportIo.files.set(this.uri, ''); }
  write(text: string) { if (exportIo.failWrite) throw new Error('ENOSPC: no space left on device'); exportIo.files.set(this.uri, text); }
  delete() { exportIo.files.delete(this.uri); }
}
/** The QA profile a harness's bundle runs (`qa-profile.ts`); null: the person's own data. */
let qaProfile: string | null = null;

function harness(file: string, data: domain.LedgerArchive = archive, released?: ReleasedSets, locale: AppLocale | null = null, gate?: domain.CurrencyGate, dev = true,
  params: Record<string, string> = {}) {
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
  Object.assign(exportIo, { available: false, failShare: false, failWrite: false, maxBytes: undefined, created: 0, now: undefined });
  exportIo.files.clear();
  exportIo.shares.length = 0;
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
    'expo-router': { Stack: { Screen: 'Stack.Screen' }, Tabs: { Screen: 'Tabs.Screen' }, useLocalSearchParams: () => params,
      router: { push: (to: unknown) => pushed.push(to), navigate: (to: unknown) => pushed.push(to) } },
    'expo-file-system': { File: MemoryFile, Paths: { cache: '/cache' } },
    'expo-sharing': { isAvailableAsync: async () => { if (exportIo.available === 'throw') throw new Error('UIKit unavailable'); return exportIo.available; },
      shareAsync: async (uri: string, options: Record<string, unknown>) => {
      exportIo.shares.push({ uri, options, text: exportIo.files.get(uri) });
      if (exportIo.failShare) throw new Error('UIActivityViewController failed');
    } },
    // The real module; a test may lower the cap without building a 5 MB ledger.
    '../src/ui/backup-file': { ...backupFile, buildBackupFile: (data: domain.LedgerArchive, now?: Date) => backupFile.buildBackupFile(data, exportIo.now ?? now, exportIo.maxBytes) },
    '@finanzapp/domain': domain,
    '../src/storage/LedgerProvider': ledger, '../../src/storage/LedgerProvider': ledger,
 '../../src/storage/currency-gate': currencyGate, '../src/storage/currency-gate': currencyGate,
    '../src/ui/components': components, '../../src/ui/components': components,
    '../src/ui/categories': categories,
    '../src/ui/appearance': appearance, '../../src/ui/appearance': appearance,
    '../src/ui/category-hues': { useCategoryColor: () => '#3E6FB0', useCategoryLabel: (s: string) => s, useCategoryDefinitions: () => [], useCategoryLook: (s: string) => ({ label: s, storedLabel: s, key: String(s).toLowerCase(), hex: '#3E6FB0', glyph: 'pricetag-outline' }), useCategoryLookOf: () => (s: string) => ({ label: s, storedLabel: s, key: String(s).toLowerCase(), hex: '#3E6FB0', glyph: 'pricetag-outline' }), useAccountLook: () => ({ icon: 'wallet', color: 'cobalt', glyph: 'wallet-outline', hex: '#2557D6' }), useAccountNameOf: () => (account: any) => account.name, useAccountLookOf: () => () => ({ icon: 'wallet', color: 'cobalt', glyph: 'wallet-outline', hex: '#2557D6' }) }, '../../src/ui/category-hues': { useCategoryColor: () => '#3E6FB0', useCategoryLabel: (s: string) => s, useCategoryDefinitions: () => [], useCategoryLook: (s: string) => ({ label: s, storedLabel: s, key: String(s).toLowerCase(), hex: '#3E6FB0', glyph: 'pricetag-outline' }), useCategoryLookOf: () => (s: string) => ({ label: s, storedLabel: s, key: String(s).toLowerCase(), hex: '#3E6FB0', glyph: 'pricetag-outline' }), useAccountLook: () => ({ icon: 'wallet', color: 'cobalt', glyph: 'wallet-outline', hex: '#2557D6' }), useAccountNameOf: () => (account: any) => account.name, useAccountLookOf: () => () => ({ icon: 'wallet', color: 'cobalt', glyph: 'wallet-outline', hex: '#2557D6' }) },
    '../src/ui/theme': theme, '../../src/ui/theme': theme,
    '../src/ui/material': { useMaterialDecision: () => ({ material: 'opaque', reason: 'expo-go' }) }, '../../src/ui/material': { useMaterialDecision: () => ({ material: 'opaque', reason: 'expo-go' }) },
    // 25N1: Ajustes (app/preferences.tsx) reads these from the root; Finanzas no longer does.
    '../src/ui/locale-options': localeOptions, '../src/ui/marks': { LanguageMark: 'LanguageMark', RegionMark: 'RegionMark' },
    '../src/dev/qa-profile': { get BUILD_QA_PROFILE() { return qaProfile; } },
    '../src/ui/licenses': licenses, '../../src/ui/licenses': licenses,
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
  runInNewContext(code, { module, exports: module.exports, Date, Error, __DEV__: dev, require: (name: string) => {
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
// Finanzas, Ajustes and backup rows lead somewhere: title over subtitle, never a label/value pair competing for one line.
const rows = (root: Node) => nodes(root).filter(node => node.type === 'NavigationRow');
/** 24UX6C: a group under a small caps label: an AppText with the header role (the VoiceOver rotor reaches it) in the
 * eyebrow variant, never a SectionTitle. 25N1: Ajustes and Licencias have them; Finanzas is one list, under its title. */
const groupLabels = (root: Node) => nodes(root).filter(node => node.type === 'AppText' && node.props.accessibilityRole === 'header' && node.props.variant === 'eyebrow')
  .map(node => node.props.children);
/** 25N1: Finanzas' destinations, in order, and Ajustes' (Región only while two regions are released). Together they are
 * every Más destination before 25N1 but Movimientos deshechos (now Movimientos' bar button, tests/activity-route.node.ts),
 * plus Licencias. */
const FINANCE_ROUTES = ['/accounts', '/cards', '/budgets', '/recurring', '/debts', '/categories'];
const SETTINGS_ROUTES = ['/language', '/region', '/appearance', '/backup', '/licenses'];
const texts = (root: Node) => nodes(root).filter(node => node.type === 'AppText').map(node => String(node.props.children)).join(' ');
/** The trailing button Finanzas sets on its own bar (a `Tabs.Screen` inside the screen). */
const gearOf = (root: Node) => nodes(root).find(node => node.type === 'Tabs.Screen')!.props.options.headerRight();

test('25N1: Finanzas is one grouped list of the ledger\'s tools with live counts and tinted tiles; the gear of its bar opens Ajustes', () => {
  const view = harness('(tabs)/settings.tsx');
  const root = view.render();
  assert.deepEqual(groupLabels(root), [], 'one list under the tab\'s own title: no group label repeats «Finanzas»');
  assert.equal(nodes(root).filter(node => node.type === 'Surface').length, 1);
  assert.equal(nodes(root).some(node => node.type === 'SectionTitle'), false);
  const labels = rows(root).map(row => row.props.title);
  assert.deepEqual(labels, ['Cuentas', 'Tarjetas', 'Presupuestos', 'Recurrentes', 'Deudas y cobros', 'Categorías']);
  assert.equal(labels.includes('Asistente'), false, 'the Assistant is a root-stack screen opened from the dock\'s «+» capture hub, not a row');
  const value = (label: string) => rows(root).find(row => row.props.title === label)!.props.subtitle;
  assert.equal(value('Tarjetas'), 'Compras y resúmenes', 'no cards recorded: an honest placeholder');
  assert.equal(value('Recurrentes'), '1 activo');
  assert.equal(value('Deudas y cobros'), '1 pendiente');
  assert.equal(value('Presupuestos'), 'Plan mensual');
  assert.equal(value('Categorías'), 'Gastos e ingresos');
  for (const row of rows(root)) row.props.onPress();
  assert.deepEqual(view.pushed, FINANCE_ROUTES);
  assert.deepEqual(rows(root).filter(row => row.props.last).map(row => row.props.title), ['Categorías']);
  assert.equal(nodes(root).some(node => node.type === 'ActionButton'), false);
  // Every row carries a soft identity tile from the shared palette, 34 pt, six distinct restrained colours, no row painted.
  assert.equal(rows(root).every(row => row.props.leading.type === 'GlyphTile' && row.props.leading.props.size === 34), true);
  assert.equal(new Set(rows(root).map(row => row.props.leading.props.color)).size, 6);
  assert.equal(rows(root).every(row => typeof row.props.leading.props.color === 'string'), true);
  assert.equal(rows(root).some(row => 'icon' in row.props || 'value' in row.props || 'label' in row.props), false, 'no leftover icon, label or value props');
  // Nothing of Ajustes is left here: no preference, no backup, no version line, no diagnostics.
  assert.doesNotMatch(labels.join(','), /Idioma|Región|Apariencia|Copia de seguridad|Movimientos deshechos|Ajustes/);
  assert.doesNotMatch(texts(root), /FinanzApp 0\.1\.0|Material opaco/);
  const gear = gearOf(root);
  assert.deepEqual([gear.type, gear.props.name, gear.props.label], ['IconButton', 'settings-outline', 'Ajustes'], 'a 44 pt bar button VoiceOver calls «Ajustes»');
  gear.props.onPress();
  assert.equal(view.pushed.at(-1), '/preferences');
  const english = harness('(tabs)/settings.tsx', archive, undefined, 'en-AR');
  const englishRoot = english.render();
  assert.equal(rows(englishRoot).map(row => row.props.title).join(','), 'Accounts,Cards,Budgets,Recurring,Debts and IOUs,Categories');
  assert.equal(rows(englishRoot).find(row => row.props.title === 'Recurring')!.props.subtitle, '1 active');
  assert.equal(gearOf(englishRoot).props.label, 'Settings');
});

test('25N1: Ajustes groups Preferencias, Tus datos and Acerca de, and ends with the version line', () => {
  const view = harness('preferences.tsx');
  const root = view.render();
  assert.equal(groupLabels(root).join(','), 'Preferencias,Tus datos,Acerca de');
  assert.equal([root.type, root.props.gap].join(','), 'Screen,28', 'one 28 pt spacing between groups');
  const groups = (root.props.children as Node[]).filter(child => child && child.type === 'View' && nodes(child).some(node => node.type === 'Surface'));
  assert.equal(groups.map(group => group.props.style.gap).join(','), '8,8,8', '8 pt between a label and its rows');
  assert.deepEqual(rows(root).map(row => row.props.title), ['Idioma', 'Región', 'Apariencia', 'Copia de seguridad', 'Licencias']);
  for (const row of rows(root)) row.props.onPress();
  assert.deepEqual(view.pushed, SETTINGS_ROUTES);
  assert.deepEqual(rows(root).filter(row => row.props.last).map(row => row.props.title), ['Apariencia', 'Copia de seguridad', 'Licencias'], 'each group closes its last row');
  const value = (label: string) => rows(root).find(row => row.props.title === label)!.props.subtitle;
  assert.equal(value('Apariencia'), 'Sistema', '24UX6A: the default follows the device');
  assert.equal(value('Licencias'), 'Software y datos de terceros');
  // Idioma shows the mark of the variety its copy is written in, Región its region's flag (25O1); the others neutral tiles.
  assert.equal(rows(root).map(row => row.props.leading.type).join(','), 'LanguageMark,RegionMark,GlyphTile,GlyphTile,GlyphTile');
  assert.equal(rows(root).every(row => row.props.leading.props.size === 34), true, 'one tile size');
  assert.equal(rows(root).map(row => row.props.leading.props.icon ?? row.props.leading.props.region ?? row.props.leading.props.language).join(','),
    'es,AR,contrast-outline,save-outline,document-text-outline');
  assert.equal(rows(root).every(row => row.props.leading.props.color === undefined), true, 'Ajustes\' tiles stay neutral');
  assert.equal(nodes(root).some(node => node.type === 'ActionButton'), false);
  assert.match(texts(root), /FinanzApp 0\.1\.0 \(25A-UI\)/, 'the version line, like the About line of an iOS app');
  assert.match(texts(root), /Material opaco \(Expo Go\)/, 'a development build says which control material this session draws');
  assert.doesNotMatch(texts(root), /Piloto nativo|Producto 2/, '24UX5: no project vocabulary');
  assert.doesNotMatch(texts(root), /se guardan solo en este dispositivo/, '25O1: the local-storage footnote is gone (app-store-launch.md §13.1)');
});

test('23.1C2: Ajustes › Idioma and Región say what is in use and whether it follows the device; Región hides in a single-region build', () => {
  // The default harness store uses the release gate itself (RELEASED), as the app does.
  const view = harness('preferences.tsx');
  const root = view.render();
  assert.equal(rows(root).find(row => row.props.title === 'Idioma')!.props.subtitle, 'Español · según el dispositivo');
  const region = rows(root).find(row => row.props.title === 'Región')!;
  assert.equal(region.props.subtitle, 'Argentina · según el dispositivo');
  assert.deepEqual([region.props.leading.type, region.props.leading.props.region, region.props.leading.props.size], ['RegionMark', 'AR', 34],
    '25O1: the flag of the region the subtitle names, on the 34 pt tile of its neighbours');
  const languageMark = rows(root).find(row => row.props.title === 'Idioma')!.props.leading;
  assert.deepEqual([languageMark.type, languageMark.props.language, languageMark.props.size], ['LanguageMark', 'es', 34], 'Idioma: the mark of the language in use');
  assert.equal(region.props.last, undefined, '24UX6A: Apariencia closes Preferencias');
  region.props.onPress();
  assert.deepEqual(view.pushed, ['/region']);
  assert.equal(currentLocaleStore.setLanguage('es'), true);
  assert.equal(rows(view.render()).find(row => row.props.title === 'Idioma')!.props.subtitle, 'Español', 'an explicit choice reads plainly');
  assert.equal(currentLocaleStore.setRegion('US'), true);
  assert.equal(rows(view.render()).find(row => row.props.title === 'Región')!.props.subtitle, 'Estados Unidos', 'Spanish words, US conventions');
  assert.equal(rows(view.render()).find(row => row.props.title === 'Región')!.props.leading.props.region, 'US', 'the flag follows the choice');
  assert.equal(currentLocaleStore.setLanguage('en'), true, 'English is released: Ajustes can choose it');
  const english = rows(view.render());
  assert.equal(english.find(row => row.props.title === 'Language')!.props.subtitle, 'English', 'the screen re-renders in English');
  assert.equal(english.find(row => row.props.title === 'Region')!.props.subtitle, 'United States');
  // A build with a single released region (a narrower gate) hides Región; Apariencia still closes the group.
  const single = harness('preferences.tsx', archive, { languages: ['es'], regions: ['AR'] });
  const singleRows = rows(single.render());
  assert.equal(singleRows.some(row => row.props.title === 'Región'), false);
  assert.deepEqual(singleRows.filter(row => row.props.last).map(row => row.props.title), ['Apariencia', 'Copia de seguridad', 'Licencias']);
  for (const row of singleRows) row.props.onPress();
  assert.equal(single.pushed.join(','), SETTINGS_ROUTES.filter(route => route !== '/region').join(','), 'only Región goes; every other route stays in place');
});

test('25O1 review: Ajustes › Región leads with the flag of the region its subtitle names first: one kept from a preview build shows its own, never its stand-in\'s', () => {
  const view = harness('preferences.tsx');
  // The release gate (Saudi Arabia blocked) reading a choice saved by a development preview: kept, not applied; the
  // device's United States writes meanwhile.
  currentLocaleStore = createLocaleStore({ devices: () => ({ source: 'native', locales: [{ languageTag: 'es-AR', regionCode: 'US' }] }),
    store: () => ({ getItemSync: key => key === REGION_PREFERENCE_KEY ? 'SA' : null, setItemSync() {}, removeItemSync: () => false }) });
  const region = rows(view.render()).find(row => row.props.title === 'Región')!;
  assert.equal(region.props.subtitle, 'Arabia Saudí · formatos de Estados Unidos');
  assert.deepEqual([region.props.leading.type, region.props.leading.props.region, region.props.leading.props.size], ['RegionMark', 'SA', 34]);
});

test('25N1: every destination of Más before 25N1 is still one tap from Finanzas or Ajustes (Movimientos deshechos from Movimientos), in both languages', () => {
  for (const locale of [null, 'en-AR'] as const) {
    const finances = harness('(tabs)/settings.tsx', archive, undefined, locale);
    for (const row of rows(finances.render())) row.props.onPress();
    const settings = harness('preferences.tsx', archive, undefined, locale);
    for (const row of rows(settings.render())) row.props.onPress();
    assert.equal([...finances.pushed, ...settings.pushed].join(','), [...FINANCE_ROUTES, ...SETTINGS_ROUTES].join(','));
    assert.doesNotMatch(rows(settings.render()).map(row => row.props.title).join(','), /Ajustes|Settings/, 'Ajustes is the screen itself, never a row of it');
  }
});

test('Finanzas → Tarjetas counts active credit cards and opens the pushed Tarjetas screen', () => {
  const card: domain.CreditCardProfile = { id: 'card', accountId: cash.id, issuer: 'Visa', last4: '4009', creditLimitMinor: null, closingDay: 28, dueDay: 5, active: true, deleted: false, createdAt, revision: 0, updatedAt: createdAt };
  const view = harness('(tabs)/settings.tsx', { ...archive, cards: [card, { ...card, id: 'old', active: false }] });
  const root = view.render();
  const row = rows(root).find(item => item.props.title === 'Tarjetas')!;
  assert.equal(row.props.subtitle, '1 tarjeta de crédito');
  assert.equal(row.props.leading.props.icon, 'card-outline');
  row.props.onPress();
  assert.deepEqual(view.pushed, ['/cards']);
  const english = harness('(tabs)/settings.tsx', { ...archive, cards: [card, { ...card, id: 'two' }] }, undefined, 'en-AR').render();
  assert.equal(rows(english).find(item => item.props.title === 'Cards')!.props.subtitle, '2 credit cards');
});

test('Finanzas on an empty ledger shows honest placeholders instead of zero counts', () => {
  const root = harness('(tabs)/settings.tsx', { accounts: [], records: [] }).render();
  const value = (label: string) => rows(root).find(row => row.props.title === label)!.props.subtitle;
  assert.equal(value('Recurrentes'), 'Pagos e ingresos');
  assert.equal(value('Deudas y cobros'), 'Debo · me deben');
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

test('25Q2: the export writes one dated compact file in the cache, shares it as JSON and always deletes it; every failure says why in the app\'s words', async () => {
  const press = async (view: ReturnType<typeof harness>) => { await nodes(view.render()).find(node => node.type === 'ActionButton')!.props.onPress(); };
  const errorOf = (view: ReturnType<typeof harness>) => nodes(view.render()).find(node => node.type === 'ErrorMessage')!.props.message;
  // A ledger the domain backs up (the shared fixture's hand-made undone record is not a stored shape).
  const exportable: domain.LedgerArchive = { accounts: [cash, debtAccount], records: entries.map(domain.initialRecord) };
  let view = harness('backup.tsx', exportable);
  exportIo.available = true;
  await press(view);
  assert.equal(exportIo.shares.length, 1, 'error: ' + errorOf(view));
  const [share] = exportIo.shares;
  assert.match(share.uri, /^\/cache\/FinanzApp-backup-\d{4}-\d{2}-\d{2}-\d{4}\.json$/, 'named by its date, no «piloto», no epoch');
  assert.equal(JSON.stringify(share.options), JSON.stringify({ mimeType: 'application/json', UTI: 'public.json', dialogTitle: 'Guardar copia de FinanzApp' }));
  assert.equal(share.text!.includes('\n'), false, 'compact: one line');
  assert.equal(domain.parsePilotBackup(share.text!).archive.records.length, exportable.records.length, 'this app restores what it shared');
  assert.equal(exportIo.files.size, 0, 'the plaintext copy is deleted once the sheet closes');
  assert.equal(errorOf(view), null);
  // A second tap while the first export is still open (the sheet up) shares nothing more and leaves no second file.
  view = harness('backup.tsx', exportable); exportIo.available = true; exportIo.shares.length = 0;
  const onPress = nodes(view.render()).find(node => node.type === 'ActionButton')!.props.onPress;
  await Promise.all([onPress(), onPress()]);
  assert.deepEqual([exportIo.shares.length, exportIo.created, exportIo.files.size], [1, 1, 0], 'one file and one share: the tap that counted');
  // The sheet fails: its text never reaches the person, and the file still goes.
  view = harness('backup.tsx', exportable); exportIo.available = true; exportIo.failShare = true;
  await press(view);
  assert.deepEqual([errorOf(view), exportIo.files.size], ['backup.export.prepareFailed', 0]);
  assert.equal(bindLocale('es-AR').errorText('backup.export.prepareFailed'), 'No se pudo preparar la copia. Tus datos siguen en el dispositivo.');
  // Writing fails: nothing is shared.
  view = harness('backup.tsx', exportable); exportIo.available = true; exportIo.failWrite = true;
  await press(view);
  assert.deepEqual([errorOf(view), exportIo.shares.length, exportIo.files.size], ['backup.export.prepareFailed', 0, 0]);
  // Over the cap: its own sentence, before any file exists (before 25Q2 the import's «Elegí una copia JSON de hasta 5 MB»).
  view = harness('backup.tsx', exportable); exportIo.available = true; exportIo.maxBytes = 50;
  await press(view);
  assert.deepEqual([errorOf(view), exportIo.created, exportIo.shares.length], ['backup.export.tooLarge', 0, 0]);
  // No share sheet on this device; the check itself failing.
  view = harness('backup.tsx', exportable);
  await press(view);
  assert.deepEqual([errorOf(view), exportIo.created], ['backup.export.sharingUnavailable', 0]);
  view = harness('backup.tsx', exportable); exportIo.available = 'throw';
  await press(view);
  assert.deepEqual([errorOf(view), exportIo.created], ['backup.export.prepareFailed', 0]);
  // A copy left from an export in the same minute (the app ended mid-sheet) is replaced, not refused, and deleted after.
  view = harness('backup.tsx', exportable); exportIo.available = true; exportIo.now = new Date(2026, 9, 15, 14, 32);
  exportIo.files.set('/cache/FinanzApp-backup-2026-10-15-1432.json', 'stale');
  await press(view);
  assert.deepEqual([errorOf(view), exportIo.shares.length, exportIo.files.size], [null, 1, 0]);
  assert.notEqual(exportIo.shares[0].text, 'stale', 'the shared file is this export');
});

test('25Q2: the Backup screen and its Ajustes row say that deleting the app deletes the records', () => {
  const intro = (locale: AppLocale | null) => nodes(harness('backup.tsx', archive, undefined, locale).render()).filter(node => node.type === 'AppText')[0].props.children;
  assert.match(intro(null), /^Si borrás la app, tus registros se borran con ella\. Guardá tus cuentas/);
  assert.match(intro('en-AR'), /^If you delete the app, your records are deleted with it\. Save your accounts/);
  const row = (locale: AppLocale | null) => rows(harness('preferences.tsx', archive, undefined, locale).render()).find(item => item.props.title === (locale ? 'Backup' : 'Copia de seguridad'))!;
  assert.equal(row(null).props.subtitle, 'Antes de borrar la app o cambiar de teléfono');
  assert.equal(row('en-AR').props.subtitle, 'Before deleting the app or changing phones');
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

// Producto 23.1B2: Ajustes, Copia de seguridad and Categorías in English (Finanzas' English: its own test above). Words
// change; routes, counts, the stored category strings and the ledger do not.
test('23.1B2 English Ajustes: every row, group, note and the diagnostic footer are translated; routes and order are the same', () => {
  const view = harness('preferences.tsx', archive, undefined, 'en-AR');
  const root = view.render();
  assert.equal(groupLabels(root).join(','), 'Preferences,Your data,About');
  assert.equal(rows(root).map(row => row.props.title).join(','), 'Language,Region,Appearance,Backup,Licenses');
  const value = (label: string) => rows(root).find(row => row.props.title === label)!.props.subtitle;
  assert.equal(value('Language'), 'Español · same as device', 'a language is named in its own language');
  assert.equal(value('Region'), 'Argentina · same as device', 'a region is named in the interface language');
  assert.equal(value('Appearance'), 'System');
  assert.equal(value('Licenses'), 'Third-party software and data');
  for (const row of rows(root)) row.props.onPress();
  assert.equal(view.pushed.join(','), SETTINGS_ROUTES.join(','));
  assert.match(texts(root), /FinanzApp 0\.1\.0 \(25A-UI\)/);
  assert.match(texts(root), /Opaque material \(Expo Go\) · Language: default/);
  assert.doesNotMatch(texts(root), /saved only on this device/, '25O1: no local-storage footnote in either language');
  assert.doesNotMatch(texts(root), /Material opaco|Idioma|Región|sincronización/);
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

test('24B5: a release names no test currency in Ajustes; a development preview gate is announced under the footer so nobody mistakes it for production', () => {
  const release = harness('preferences.tsx').render();
  assert.doesNotMatch(texts(release), /Monedas de prueba/);
  const preview = harness('preferences.tsx', archive, undefined, null, currencyGate.PREVIEW_CURRENCIES).render();
  assert.match(texts(preview), /Monedas de prueba activas: BHD, IQD, JOD, KWD, LYD, OMR, TND\. Solo en esta compilación de desarrollo\./);
  const english = harness('preferences.tsx', archive, undefined, 'en-AR', currencyGate.PREVIEW_CURRENCIES).render();
  assert.match(texts(english), /Test currencies enabled: BHD, IQD, JOD, KWD, LYD, OMR, TND\. Only in this development build\./);
});

test('M1: a development bundle running a QA profile says so under the footer; the person\'s own data shows nothing', () => {
  assert.doesNotMatch(texts(harness('preferences.tsx').render()), /Perfil de prueba/);
  qaProfile = 'm1';
  try {
    assert.match(texts(harness('preferences.tsx').render()), /Perfil de prueba «m1»: tus datos no se abren\. Reiniciá Metro sin la variable para volver a ellos\./);
    assert.match(texts(harness('preferences.tsx', archive, undefined, 'en-AR').render()), /Test profile “m1”: your data is not opened\./);
  } finally { qaProfile = null; }
});

test('24UX5: a preview or store build shows the version, never the diagnostics (25O1: nor the local-storage footnote, §13.1)', () => {
  for (const locale of [null, 'en-AR'] as const) {
    const footer = texts(harness('preferences.tsx', archive, undefined, locale, undefined, false).render());
    assert.match(footer, /FinanzApp 0\.1\.0 \(25A-UI\)/);
    assert.doesNotMatch(footer, /Material|material|Idioma:|Language:/, 'no material or locale diagnostics outside a development build');
    assert.doesNotMatch(footer, locale ? /saved only on this device/ : /se guardan solo en este dispositivo/, 'the first opening says where the records live; Ajustes does not repeat it');
  }
});

test('24UX6A: Ajustes → Apariencia names the choice in use and opens the chooser: Sistema (what the device shows now), Claro, Oscuro', () => {
  const view = harness('preferences.tsx');
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
  assert.equal(chooser.props.note, undefined, '25O1: no note; the pinned row says what Sistema does');
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
  assert.equal(list.props.voided, true, '25N1: every row says it is undone (EntryRow and TransferRow, tests/ui-rows.node.ts)');
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
      assert.equal(rows(root).slice(1).map(row => row.props.title).join(','), 'Cuentas,Tarjetas,Presupuestos,Recurrentes,Deudas y cobros,Categorías',
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
    // The review file unavailable: the ledger's Finanzas is unchanged.
    reviewTray = 'unavailable';
    assert.equal(rows(harness('(tabs)/settings.tsx').render())[0].props.title, 'Cuentas');
  } finally { reviewTray = undefined; }
});

test('25N1: Ajustes › Licencias lists the third-party software and data under two labels, each row opening its notice; the rates\' source is a line under the data', () => {
  for (const locale of [null, 'en-AR'] as const) {
    const view = harness('licenses.tsx', archive, undefined, locale);
    const root = view.render();
    assert.equal(groupLabels(root).join(','), locale ? 'Software,Data and artwork' : 'Software,Datos e imágenes');
    const all = rows(root);
    const byGroup = (group: string) => licenses.LICENSE_NOTICES.filter(notice => notice.group === group);
    assert.deepEqual(all.map(row => row.props.title), [...byGroup('software'), ...byGroup('data')].map(notice => notice.name), 'names as published, in every language');
    assert.deepEqual(all.map(row => row.props.subtitle), [...byGroup('software'), ...byGroup('data')].map(notice => notice.licence));
    assert.deepEqual(all.filter(row => row.props.last).map(row => row.props.title), ['decode-uri-component', 'Unicode CLDR'], 'each group closes its last row');
    for (const row of all) row.props.onPress();
    assert.equal(JSON.stringify(view.pushed), JSON.stringify([...byGroup('software'), ...byGroup('data')].map(notice => ({ pathname: '/license/[id]', params: { id: notice.id } }))));
    assert.match(texts(root), locale ? /Each notice is shown as published\./ : /Cada aviso se muestra como fue publicado, en inglés\./);
    assert.match(texts(root), locale ? /Reference exchange rates come from Frankfurter \(frankfurter\.dev\)/ : /Los tipos de cambio de referencia vienen de Frankfurter \(frankfurter\.dev\)/);
  }
});

test('25N1: a notice shows its full text as published, read by VoiceOver in English and selectable, under its name; an unknown id says so', () => {
  const view = harness('license/[id].tsx', archive, undefined, null, undefined, true, { id: 'cldr' });
  const root = view.render();
  assert.equal(nodes(root).find(node => node.type === 'Stack.Screen')!.props.options.title, 'Unicode CLDR');
  const paragraphs = nodes(root).filter(node => node.type === 'AppText' && node.props.accessibilityLanguage === 'en');
  assert.deepEqual(paragraphs.map(node => node.props.children), licenses.licenseNotice('cldr')!.paragraphs);
  assert.equal(paragraphs.every(node => node.props.selectable === true), true, 'a licence can be selected and copied');
  assert.equal(nodes(root).filter(node => node.type === 'AppText').length, paragraphs.length, 'data copied into the source names no package');
  const expo = harness('license/[id].tsx', archive, undefined, 'en-AR', undefined, true, { id: 'expo' }).render();
  const covers = nodes(expo).filter(node => node.type === 'AppText' && node.props.accessibilityLanguage !== 'en').map(node => node.props.children);
  assert.equal(covers.length, 1);
  assert.match(covers[0], /^Includes: expo, expo-constants, .*expo-router/);
  const missing = harness('license/[id].tsx', archive, undefined, null, undefined, true, { id: 'nope' }).render();
  assert.equal(nodes(missing).find(node => node.type === 'EmptyState')!.props.title, 'No encontramos este aviso');
});
