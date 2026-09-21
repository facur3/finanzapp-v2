import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as domain from '@finanzapp/domain';
import * as categories from '../src/ui/categories.ts';
import * as appearance from '../src/ui/appearance.ts';

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

function harness(file: string, data: domain.LedgerArchive = archive) {
  const source = readFileSync(new URL('../app/' + file, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const jsx = (type: unknown, props: Record<string, unknown>) => ({ type, props });
  const state: unknown[] = [];
  const pushed: any[] = [];
  let cursor = 0;
  const ledger = { useLedger: () => ({ archive: data, snapshot: domain.snapshotFromArchive(data) }) };
  const names = ['ActionButton', 'AppText', 'CategoryBadge', 'DetailRow', 'ErrorMessage', 'GlyphTile', 'IconButton', 'PressFeedback', 'Screen', 'SectionTitle', 'Surface'];
  const components = Object.fromEntries(names.map(name => [name, name]));
  const theme = { usePalette: () => ({ text: '#000', secondary: '#666', line: '#ddd', isDark: false }) };
  const modules: Record<string, unknown> = {
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
    '../src/ui/category-hues': { useCategoryColor: () => '#3E6FB0', useCategoryLabel: (s: string) => s, useCategoryDefinitions: () => [], useCategoryLook: (s: string) => ({ label: s, storedLabel: s, key: String(s).toLowerCase(), hex: '#3E6FB0', glyph: 'pricetag-outline' }), useCategoryLookOf: () => (s: string) => ({ label: s, storedLabel: s, key: String(s).toLowerCase(), hex: '#3E6FB0', glyph: 'pricetag-outline' }), useAccountLook: () => ({ icon: 'wallet', color: 'cobalt', glyph: 'wallet-outline', hex: '#2557D6' }), useAccountLookOf: () => () => ({ icon: 'wallet', color: 'cobalt', glyph: 'wallet-outline', hex: '#2557D6' }) }, '../../src/ui/category-hues': { useCategoryColor: () => '#3E6FB0', useCategoryLabel: (s: string) => s, useCategoryDefinitions: () => [], useCategoryLook: (s: string) => ({ label: s, storedLabel: s, key: String(s).toLowerCase(), hex: '#3E6FB0', glyph: 'pricetag-outline' }), useCategoryLookOf: () => (s: string) => ({ label: s, storedLabel: s, key: String(s).toLowerCase(), hex: '#3E6FB0', glyph: 'pricetag-outline' }), useAccountLook: () => ({ icon: 'wallet', color: 'cobalt', glyph: 'wallet-outline', hex: '#2557D6' }), useAccountLookOf: () => () => ({ icon: 'wallet', color: 'cobalt', glyph: 'wallet-outline', hex: '#2557D6' }) },
    '../src/ui/theme': theme, '../../src/ui/theme': theme,
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
const rows = (root: Node) => nodes(root).filter(node => node.type === 'DetailRow');

test('Más groups permanent navigation into Finanzas and App y datos, with live counts', () => {
  const view = harness('(tabs)/settings.tsx');
  const root = view.render();
  assert.deepEqual(nodes(root).filter(node => node.type === 'SectionTitle').map(node => node.props.children), ['Finanzas', 'App y datos']);
  const labels = rows(root).map(row => row.props.label);
  assert.deepEqual(labels, ['Cuentas', 'Presupuestos', 'Recurrentes', 'Deudas y cobros', 'Categorías', 'Asistente', 'Copia de seguridad', 'Movimientos deshechos']);
  assert.equal(labels.includes('Tarjetas'), false, 'Tarjetas is a primary tab, not a Más row');
  const value = (label: string) => rows(root).find(row => row.props.label === label)!.props.value;
  assert.equal(value('Recurrentes'), '1 activo');
  assert.equal(value('Deudas y cobros'), '1 pendiente');
  assert.equal(value('Presupuestos'), 'Plan mensual');
  assert.equal(value('Asistente'), 'Preguntá o registrá', 'the Assistant row describes the capability, not a model status');
  assert.equal(value('Movimientos deshechos'), '1 recuperable');
  for (const row of rows(root)) row.props.onPress();
  assert.deepEqual(view.pushed, ['/accounts', '/budgets', '/recurring', '/debts', '/categories', '/assistant', '/backup', '/undone-entries']);
  // Each group closes its last row; no export button or sharing lives on the hub any more.
  assert.deepEqual(rows(root).filter(row => row.props.last).map(row => row.props.label), ['Categorías', 'Movimientos deshechos']);
  assert.equal(nodes(root).some(node => node.type === 'ActionButton'), false);
  const texts = nodes(root).filter(node => node.type === 'AppText').map(node => String(node.props.children)).join(' ');
  assert.match(texts, /Producto 21/);
  assert.equal(value('Categorías'), 'Gastos e ingresos');
  // Finanzas rows carry a soft identity tile from the shared palette; App y datos rows stay neutral glyphs.
  const leading = rows(root).map(row => row.props.leading?.type ?? null);
  assert.deepEqual(leading, ['GlyphTile', 'GlyphTile', 'GlyphTile', 'GlyphTile', 'GlyphTile', null, null, null]);
  assert.equal(new Set(rows(root).slice(0, 5).map(row => row.props.leading.props.color)).size, 5, 'five distinct restrained colours, no row painted');
  assert.match(texts, /sincronización todavía no está activada/);
});

test('Más empty ledger shows honest placeholders instead of zero counts', () => {
  const root = harness('(tabs)/settings.tsx', { accounts: [], records: [] }).render();
  const value = (label: string) => rows(root).find(row => row.props.label === label)!.props.value;
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
  const importRow = rows(root).find(row => row.props.label === 'Importar copia')!;
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
