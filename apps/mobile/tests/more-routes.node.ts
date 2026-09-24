import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as domain from '@finanzapp/domain';
import * as categories from '../src/ui/categories.ts';
import * as appearance from '../src/ui/appearance.ts';
import * as materialPolicy from '../src/ui/material-policy.ts';
import * as i18nFormat from '../src/i18n/format.ts';
import { bindLocale } from '../src/i18n/bind.ts';
import * as localeOptions from '../src/ui/locale-options.ts';
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
  note: '', active: true, createdAt, revision: 0, updatedAt: createdAt };
const rule: domain.RecurringRule = { id: 'rent', accountId: cash.id, kind: 'expense', amountMinor: 40000, merchant: 'Alquiler', category: 'Hogar', frequency: 'monthly',
  anchorDateISO: '2026-10-01', nextDateISO: '2026-10-01', active: true, createdAt, revision: 0, updatedAt: createdAt };
const entries: domain.Entry[] = [
  { id: 'e1', accountId: cash.id, kind: 'expense', amountMinor: 3000, merchant: 'Prueba', category: 'sjsjn', dateISO: '2026-09-10', createdAt },
  { id: 'e2', accountId: cash.id, kind: 'expense', amountMinor: 9000, merchant: 'Prueba', category: 'JD', dateISO: '2026-09-12', createdAt },
  { id: 'e3', accountId: cash.id, kind: 'expense', amountMinor: 700, merchant: 'Super', category: 'Supermercado', dateISO: '2026-09-13', createdAt },
];
const undone = domain.initialRecord({ id: 'e4', accountId: cash.id, kind: 'expense', amountMinor: 100, merchant: 'Error', category: 'Otros', dateISO: '2026-09-14', createdAt });
const archive: domain.LedgerArchive = { accounts: [cash, debtAccount], records: [...entries.map(domain.initialRecord), { ...undone, voided: true }],
  debts: [debt], recurring: [rule], budgets: [] };

function harness(file: string, data: domain.LedgerArchive = archive, released?: ReleasedSets, locale: AppLocale | null = null) {
  currentLocaleStore = localeStore(released);
  forcedLocale = locale;
  const source = readFileSync(new URL('../app/' + file, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const jsx = (type: unknown, props: Record<string, unknown>) => ({ type, props });
  const state: unknown[] = [];
  const pushed: any[] = [];
  let cursor = 0;
  const ledger = { useLedger: () => ({ archive: data, snapshot: domain.snapshotFromArchive(data) }) };
  const names = ['ActionButton', 'AppText', 'CategoryBadge', 'DetailRow', 'ErrorMessage', 'GlyphTile', 'IconButton', 'NavigationRow', 'PressFeedback', 'Screen', 'SectionTitle', 'Surface'];
  const components = Object.fromEntries(names.map(name => [name, name]));
  const theme = { usePalette: () => ({ text: '#000', secondary: '#666', line: '#ddd', isDark: false }) };
  const modules: Record<string, unknown> = {
    '../i18n/format': i18nFormat, '../src/i18n/format': i18nFormat, '../../src/i18n/format': i18nFormat, '../i18n/provider': i18nProvider, '../src/i18n/provider': i18nProvider, '../../src/i18n/provider': i18nProvider,
    react: { useMemo: (fn: () => unknown) => fn(), useRef: (initial: unknown) => ({ current: initial }), useState: (initial: unknown) => {
      const index = cursor++;
      if (!(index in state)) state[index] = typeof initial === 'function' ? (initial as () => unknown)() : initial;
      return [state[index], (value: unknown) => { state[index] = value; }];
    } },
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'react-native': { View: 'View' },
    'expo-router': { Stack: { Screen: 'Stack.Screen' }, router: { push: (to: unknown) => pushed.push(to), navigate: (to: unknown) => pushed.push(to) } },
    'expo-file-system': { File: class {}, Paths: { cache: '/cache' } },
    'expo-sharing': { isAvailableAsync: async () => false, shareAsync: async () => {} },
    '@finanzapp/domain': domain,
    '../src/storage/LedgerProvider': ledger, '../../src/storage/LedgerProvider': ledger,
    '../src/ui/components': components, '../../src/ui/components': components,
    '../src/ui/categories': categories,
    '../src/ui/appearance': appearance, '../../src/ui/appearance': appearance,
    '../src/ui/category-hues': { useCategoryColor: () => '#3E6FB0', useCategoryLabel: (s: string) => s, useCategoryDefinitions: () => [], useCategoryLook: (s: string) => ({ label: s, storedLabel: s, key: String(s).toLowerCase(), hex: '#3E6FB0', glyph: 'pricetag-outline' }), useCategoryLookOf: () => (s: string) => ({ label: s, storedLabel: s, key: String(s).toLowerCase(), hex: '#3E6FB0', glyph: 'pricetag-outline' }), useAccountLook: () => ({ icon: 'wallet', color: 'cobalt', glyph: 'wallet-outline', hex: '#2557D6' }), useAccountNameOf: () => (account: any) => account.name, useAccountLookOf: () => () => ({ icon: 'wallet', color: 'cobalt', glyph: 'wallet-outline', hex: '#2557D6' }) }, '../../src/ui/category-hues': { useCategoryColor: () => '#3E6FB0', useCategoryLabel: (s: string) => s, useCategoryDefinitions: () => [], useCategoryLook: (s: string) => ({ label: s, storedLabel: s, key: String(s).toLowerCase(), hex: '#3E6FB0', glyph: 'pricetag-outline' }), useCategoryLookOf: () => (s: string) => ({ label: s, storedLabel: s, key: String(s).toLowerCase(), hex: '#3E6FB0', glyph: 'pricetag-outline' }), useAccountLook: () => ({ icon: 'wallet', color: 'cobalt', glyph: 'wallet-outline', hex: '#2557D6' }), useAccountNameOf: () => (account: any) => account.name, useAccountLookOf: () => () => ({ icon: 'wallet', color: 'cobalt', glyph: 'wallet-outline', hex: '#2557D6' }) },
    '../src/ui/theme': theme, '../../src/ui/theme': theme,
    '../src/ui/material': { useMaterialDecision: () => ({ material: 'opaque', reason: 'expo-go' }) }, '../../src/ui/material': { useMaterialDecision: () => ({ material: 'opaque', reason: 'expo-go' }) },
    '../../src/ui/locale-options': localeOptions,
    '../src/ui/material-policy': materialPolicy, '../../src/ui/material-policy': materialPolicy,
  };
  const module = { exports: {} as { default?: () => Node } };
  runInNewContext(code, { module, exports: module.exports, Date, require: (name: string) => {
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

test('Más groups permanent navigation into Finanzas and App y datos, with live counts', () => {
  const view = harness('(tabs)/settings.tsx');
  const root = view.render();
  assert.deepEqual(nodes(root).filter(node => node.type === 'SectionTitle').map(node => node.props.children), ['Finanzas', 'App y datos']);
  const labels = rows(root).map(row => row.props.title);
  assert.deepEqual(labels, ['Cuentas', 'Tarjetas', 'Presupuestos', 'Recurrentes', 'Deudas y cobros', 'Categorías', 'Copia de seguridad', 'Movimientos deshechos', 'Idioma', 'Región']);
  assert.equal(labels.includes('Asistente'), false, 'the Assistant is the centre tab, not a Más row');
  const value = (label: string) => rows(root).find(row => row.props.title === label)!.props.subtitle;
  assert.equal(value('Tarjetas'), 'Compras y resúmenes', 'no cards recorded: an honest placeholder');
  assert.equal(value('Recurrentes'), '1 activo');
  assert.equal(value('Deudas y cobros'), '1 pendiente');
  assert.equal(value('Presupuestos'), 'Plan mensual');
  assert.equal(value('Movimientos deshechos'), '1 recuperable');
  for (const row of rows(root)) row.props.onPress();
  assert.deepEqual(view.pushed, ['/accounts', '/cards', '/budgets', '/recurring', '/debts', '/categories', '/backup', '/undone-entries', '/language', '/region']);
  // Each group closes its last row; no export button or sharing lives on the hub any more.
  assert.deepEqual(rows(root).filter(row => row.props.last).map(row => row.props.title), ['Categorías', 'Región']);
  assert.equal(nodes(root).some(node => node.type === 'ActionButton'), false);
  const texts = nodes(root).filter(node => node.type === 'AppText').map(node => String(node.props.children)).join(' ');
  assert.match(texts, /Producto 24B1 /);
  assert.match(texts, /Material opaco \(Expo Go\)/, 'the footer says which control material this session draws, so a tester can confirm the mode');
  assert.equal(value('Categorías'), 'Gastos e ingresos');
  // Finanzas rows carry a soft identity tile from the shared palette; App y datos rows stay neutral glyphs.
  const leading = rows(root).map(row => row.props.leading?.type ?? null);
  assert.deepEqual(leading, ['GlyphTile', 'GlyphTile', 'GlyphTile', 'GlyphTile', 'GlyphTile', 'GlyphTile', null, null, null, null]);
  assert.equal(new Set(rows(root).slice(0, 6).map(row => row.props.leading.props.color)).size, 6, 'six distinct restrained colours, no row painted');
  assert.deepEqual(rows(root).slice(6).map(row => row.props.icon), ['save-outline', 'arrow-undo-outline', 'language-outline', 'globe-outline'], 'App y datos keeps neutral glyphs');
  assert.equal(rows(root).some(row => 'value' in row.props || 'label' in row.props), false, 'no leftover label/value props');
  assert.match(texts, /sincronización todavía no está activada/);
});

test('Más → App y datos (23.1C2): Idioma and Región say what is in use and whether it follows the device; Región hides in a single-region build', () => {
  // The default harness store uses the release gate itself (RELEASED), as the app does.
  const view = harness('(tabs)/settings.tsx');
  const root = view.render();
  assert.deepEqual(rows(root).slice(6).map(row => row.props.title), ['Copia de seguridad', 'Movimientos deshechos', 'Idioma', 'Región']);
  assert.equal(rows(root).find(row => row.props.title === 'Idioma')!.props.subtitle, 'Español · según el dispositivo');
  const region = rows(root).find(row => row.props.title === 'Región')!;
  assert.equal(region.props.subtitle, 'Argentina · según el dispositivo');
  assert.equal(region.props.icon, 'globe-outline');
  assert.equal(region.props.last, true, 'Región closes App y datos');
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
  // A build with a single released region (a narrower gate) hides Región and closes the group with Idioma.
  const single = rows(harness('(tabs)/settings.tsx', archive, { languages: ['es'], regions: ['AR'] }).render());
  assert.equal(single.some(row => row.props.title === 'Región'), false);
  assert.deepEqual(single.filter(row => row.props.last).map(row => row.props.title), ['Categorías', 'Idioma']);
});

test('Más → Tarjetas counts active credit cards and opens the pushed Tarjetas screen', () => {
  const card: domain.CreditCardProfile = { id: 'card', accountId: cash.id, issuer: 'Visa', last4: '4009', creditLimitMinor: null, closingDay: 28, dueDay: 5, active: true, createdAt, revision: 0, updatedAt: createdAt };
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
  assert.ok(labels.includes('sjsjn, 1 movimiento · Propia, archivada'), 'an adopted historical string is now the user\'s own definition');
  assert.equal(labels.filter(label => label.startsWith('sjsjn')).length, 1, 'archived once, in its own group');
});

// Producto 23.1B2: Más, Copia de seguridad and Categorías in English. Words
// change; routes, counts, the stored category strings and the ledger do not.
test('23.1B2 English Más: every row, count, note and the diagnostic footer are translated; routes and order are the same', () => {
  const view = harness('(tabs)/settings.tsx', archive, undefined, 'en-AR');
  const root = view.render();
  assert.equal(nodes(root).filter(node => node.type === 'SectionTitle').map(node => node.props.children).join(','), 'Finances,App and data');
  assert.equal(rows(root).map(row => row.props.title).join(','), 'Accounts,Cards,Budgets,Recurring,Debts and IOUs,Categories,Backup,Undone transactions,Language,Region');
  const value = (label: string) => rows(root).find(row => row.props.title === label)!.props.subtitle;
  assert.equal(value('Recurring'), '1 active');
  assert.equal(value('Debts and IOUs'), '1 pending');
  assert.equal(value('Undone transactions'), '1 can be restored', 'the glossary word for recuperar, as on the screen it opens');
  assert.equal(value('Cards'), 'Purchases and statements');
  assert.equal(value('Language'), 'Español · same as device', 'a language is named in its own language');
  assert.equal(value('Region'), 'Argentina · same as device', 'a region is named in the interface language');
  for (const row of rows(root)) row.props.onPress();
  assert.equal(view.pushed.join(','), '/accounts,/cards,/budgets,/recurring,/debts,/categories,/backup,/undone-entries,/language,/region');
  const texts = nodes(root).filter(node => node.type === 'AppText').map(node => String(node.props.children)).join(' ');
  assert.match(texts, /FinanzApp · Native pilot 0\.1\.0 · Producto 24B1 · Opaque material \(Expo Go\) · Language: default/);
  assert.match(texts, /Sync is not turned on yet/);
  assert.doesNotMatch(texts, /Material opaco|Idioma|Región|sincronización/);
  const card: domain.CreditCardProfile = { id: 'card', accountId: cash.id, issuer: 'Visa', last4: '4009', creditLimitMinor: null, closingDay: 28, dueDay: 5, active: true, createdAt, revision: 0, updatedAt: createdAt };
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
