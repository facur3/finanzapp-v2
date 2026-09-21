import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as domain from '@finanzapp/domain';
import * as categories from '../src/ui/categories.ts';

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
  const names = ['ActionButton', 'AppText', 'CategoryBadge', 'DetailRow', 'ErrorMessage', 'Screen', 'SectionTitle', 'Surface'];
  const components = Object.fromEntries(names.map(name => [name, name]));
  const theme = { usePalette: () => ({ text: '#000', secondary: '#666', line: '#ddd' }) };
  const modules: Record<string, unknown> = {
    react: { useMemo: (fn: () => unknown) => fn(), useRef: (initial: unknown) => ({ current: initial }), useState: (initial: unknown) => {
      const index = cursor++;
      if (!(index in state)) state[index] = typeof initial === 'function' ? (initial as () => unknown)() : initial;
      return [state[index], (value: unknown) => { state[index] = value; }];
    } },
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'react-native': { View: 'View' },
    'expo-router': { router: { push: (to: unknown) => pushed.push(to), navigate: (to: unknown) => pushed.push(to) } },
    'expo-file-system': { File: class {}, Paths: { cache: '/cache' } },
    'expo-sharing': { isAvailableAsync: async () => false, shareAsync: async () => {} },
    '@finanzapp/domain': domain,
    '../src/storage/LedgerProvider': ledger, '../../src/storage/LedgerProvider': ledger,
    '../src/ui/components': components, '../../src/ui/components': components,
    '../src/ui/categories': categories,
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
  assert.equal(value('Asistente'), 'Vista previa', 'the Assistant never claims to be active');
  assert.equal(value('Movimientos deshechos'), '1 recuperable');
  for (const row of rows(root)) row.props.onPress();
  assert.deepEqual(view.pushed, ['/accounts', '/budgets', '/recurring', '/debts', '/categories', '/assistant-preview', '/backup', '/undone-entries']);
  // Each group closes its last row; no export button or sharing lives on the hub any more.
  assert.deepEqual(rows(root).filter(row => row.props.last).map(row => row.props.label), ['Categorías', 'Movimientos deshechos']);
  assert.equal(nodes(root).some(node => node.type === 'ActionButton'), false);
  const texts = nodes(root).filter(node => node.type === 'AppText').map(node => String(node.props.children)).join(' ');
  assert.match(texts, /Producto 18/);
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

test('the categories screen lists defaults and recorded custom categories read-only, never editing the ledger', () => {
  const before = JSON.stringify(archive);
  const root = harness('categories.tsx').render();
  assert.deepEqual(nodes(root).filter(node => node.type === 'SectionTitle').map(node => node.props.children), ['Gastos', 'Ingresos']);
  const badges = nodes(root).filter(node => node.type === 'CategoryBadge').map(node => node.props.category);
  assert.deepEqual(badges.slice(0, 12), ['Comida', 'Supermercado', 'Transporte', 'Hogar', 'Servicios', 'Salud', 'Ropa', 'Ocio', 'Educación', 'Viajes', 'Mascotas', 'Otros']);
  assert.deepEqual(badges.slice(12, 14), ['JD', 'sjsjn'], 'historical custom categories stay, most used first');
  assert.deepEqual(badges.slice(14), ['Sueldo', 'Trabajo', 'Regalos', 'Reembolsos', 'Préstamos', 'Otros']);
  const labels = nodes(root).filter(node => node.type === 'View' && node.props.accessibilityLabel).map(node => node.props.accessibilityLabel);
  assert.ok(labels.includes('JD, 1 movimiento · Propia'));
  assert.ok(labels.includes('Supermercado, 1 movimiento'));
  assert.ok(labels.includes('Comida, Predeterminada'));
  assert.equal(nodes(root).some(node => node.type === 'ActionButton' || node.type === 'DetailRow'), false, 'nothing to tap: no rename, merge or delete yet');
  assert.equal(JSON.stringify(archive), before);
});
