import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as domain from '@finanzapp/domain';
import * as i18nFormat from '../src/i18n/format.ts';
import { bindLocale } from '../src/i18n/bind.ts';
const i18nProvider = { useI18n: () => bindLocale('es-AR') };

// Producto 19: the budget form on the actual module, with native hosts replaced
// by descriptors. The kind of limit (General / Por categoría) is the first
// question; a general budget never carries a category; saving stays explicit.
type Node = { type: string | ((props: any) => Node); props: Record<string, any> };
const createdAt = '2026-09-01T12:00:00.000Z';
const account: domain.Account = { id: 'a', name: 'Banco', currency: 'ARS', openingMinor: 100000, createdAt };
const entry: domain.Entry = { id: 'e', accountId: 'a', kind: 'expense', amountMinor: 3000, merchant: 'Super', category: 'Supermercado', dateISO: '2026-09-10', createdAt };
const total: domain.MonthlyBudget = { id: 'total', scope: 'total', currency: 'ARS', monthISO: '2026-09', amountMinor: 500000, active: true, createdAt, revision: 0, updatedAt: createdAt };
const food: domain.MonthlyBudget = { id: 'food', scope: 'category', category: 'Comida', currency: 'ARS', monthISO: '2026-09', amountMinor: 150000, active: true, createdAt, revision: 0, updatedAt: createdAt };
const archive: domain.LedgerArchive = { accounts: [account], records: [domain.initialRecord(entry)], budgets: [total, food] };

function harness(props: any, data: domain.LedgerArchive = archive, save?: (budget: domain.MonthlyBudget) => Promise<void>) {
  const source = readFileSync(new URL('../src/ui/budget-form.tsx', import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const state: any[] = [], refs: any[] = [];
  let cursor = 0, refCursor = 0, uuid = 0, backs = 0;
  const saved: domain.MonthlyBudget[] = [];
  const alerts: any[] = [];
  const jsx = (type: Node['type'], props: Node['props']) => ({ type, props });
  const ledger = { useLedger: () => ({ archive: data, snapshot: domain.snapshotFromArchive(data),
    saveBudget: async (budget: domain.MonthlyBudget) => { saved.push(budget); await save?.(budget); } }) };
  const components = Object.fromEntries(['Screen', 'ActionButton', 'AmountField', 'AppText', 'Choices', 'ErrorMessage', 'IconButton'].map(name => [name, name]));
  const modules: Record<string, unknown> = {
    '../i18n/format': i18nFormat, '../src/i18n/format': i18nFormat, '../../src/i18n/format': i18nFormat, '../i18n/provider': i18nProvider, '../src/i18n/provider': i18nProvider, '../../src/i18n/provider': i18nProvider,
    react: { useState: (initial: any) => { const i = cursor++; if (!(i in state)) state[i] = typeof initial === 'function' ? initial() : initial;
      return [state[i], (next: any) => { state[i] = typeof next === 'function' ? next(state[i]) : next; }]; },
    useRef: (initial: any) => { const i = refCursor++; return refs[i] ??= { current: initial }; } },
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'react-native': { View: 'View', Keyboard: { dismiss() {} }, Alert: { alert: (title: string, message: string, buttons: any[]) => alerts.push({ title, message, buttons }) } },
    'expo-router': { Stack: { Screen: 'Stack.Screen' }, router: { canGoBack: () => true, back: () => { backs++; }, push: () => {}, replace: () => {} } },
    'expo-crypto': { randomUUID: () => 'budget-' + (++uuid) },
    'expo-haptics': { NotificationFeedbackType: { Success: 'Success' }, notificationAsync: async () => {} },
    '@finanzapp/domain': domain,
    '../storage/LedgerProvider': ledger,
    './components': components,
    './form-controls': { CategoryField: 'CategoryField' },
  };
  const module = { exports: {} as Record<string, (props: any) => Node> };
  runInNewContext(code, { module, exports: module.exports, Date, Error, require: (name: string) => {
    if (!Object.hasOwn(modules, name)) throw new Error('Unexpected budget-form dependency: ' + name);
    return modules[name];
  } });
  return { render: () => { cursor = 0; refCursor = 0; return module.exports.BudgetForm(props); }, saved, alerts, backs: () => backs };
}
function nodes(value: any): Node[] {
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!value.props) return [];
  return [value, ...nodes(value.props.children)];
}
function find(root: Node, type: string, label?: string): Node {
  const result = nodes(root).find(node => node.type === type && (!label || node.props.label === label));
  assert.ok(result, 'Missing ' + type + ' ' + (label ?? ''));
  return result;
}
const choice = (root: Node, value: string) => nodes(root).find(node => node.type === 'Choices' && node.props.options.some((option: any) => option.value === value))!;
const texts = (root: Node) => nodes(root).filter(node => node.type === 'AppText').map(node => Array.isArray(node.props.children) ? node.props.children.join('') : String(node.props.children));

test('a new budget asks for its kind first; General hides the category picker and saves a total without any category', async () => {
  const view = harness({ monthISO: '2026-10', currency: 'ARS' }, { ...archive, budgets: [] });
  let root = view.render();
  const kind = choice(root, 'total');
  assert.deepEqual(kind.props.options.map((option: any) => option.label).join(','), 'General,Por categoría');
  assert.equal(kind.props.value, 'category', 'a sublimit unless the caller asked for a general budget');
  assert.ok(nodes(root).some(node => node.type === 'CategoryField'));
  kind.props.onChange('total');
  root = view.render();
  assert.equal(nodes(root).some(node => node.type === 'CategoryField'), false, 'no category for a general budget');
  assert.ok(texts(root).includes('Presupuesto general'));
  assert.ok(texts(root).some(text => text.includes('techo de todos los gastos registrados')));
  assert.equal(find(root, 'AmountField').props.currency, 'ARS');
  assert.equal(find(root, 'ActionButton', 'Crear presupuesto').props.disabled, true, 'an amount is still required');
  find(root, 'AmountField').props.onChangeText('500.000');
  root = view.render();
  assert.equal(find(root, 'ActionButton', 'Crear presupuesto').props.disabled, false, 'no category needed');
  await find(root, 'ActionButton', 'Crear presupuesto').props.onPress();
  assert.equal(view.saved.length, 1);
  assert.equal(JSON.stringify({ ...view.saved[0] }), JSON.stringify({ id: 'budget-1', currency: 'ARS', monthISO: '2026-10', amountMinor: 50000000, active: true, createdAt: view.saved[0].createdAt, revision: 0, updatedAt: view.saved[0].createdAt, scope: 'total' }));
  assert.equal(Object.hasOwn(view.saved[0], 'category'), false);
  assert.equal(view.backs(), 1);
});

test('the scope parameter preselects General, and Por categoría still requires a category and keeps its semantics', async () => {
  const view = harness({ monthISO: '2026-10', currency: 'USD', scope: 'total' }, { ...archive, budgets: [] });
  let root = view.render();
  assert.equal(choice(root, 'total').props.value, 'total');
  assert.equal(find(root, 'AmountField').props.currency, 'USD');
  choice(root, 'total').props.onChange('category');
  root = view.render();
  assert.ok(texts(root).includes('Límite por categoría'));
  assert.ok(texts(root).some(text => text.includes('sublímite') && text.includes('no se suma al presupuesto general')));
  find(root, 'AmountField').props.onChangeText('1.500');
  root = view.render();
  assert.equal(find(root, 'ActionButton', 'Crear presupuesto').props.disabled, true, 'a sublimit needs its category');
  find(root, 'CategoryField').props.onChange(' Comida ');
  root = view.render();
  await find(root, 'ActionButton', 'Crear presupuesto').props.onPress();
  assert.deepEqual([view.saved[0].scope, view.saved[0].category, view.saved[0].currency, view.saved[0].amountMinor], ['category', 'Comida', 'USD', 150000]);
});

test('editing keeps the kind fixed: a total edits its amount only, a sublimit keeps its category and identity', async () => {
  const editTotal = harness({ original: total, monthISO: total.monthISO });
  let root = editTotal.render();
  assert.equal(nodes(root).some(node => node.type === 'Choices'), false, 'kind and currency are not editable');
  assert.equal(nodes(root).some(node => node.type === 'CategoryField'), false);
  assert.equal(find(root, 'AmountField').props.value, '5.000,00');
  find(root, 'AmountField').props.onChangeText('600.000');
  root = editTotal.render();
  await find(root, 'ActionButton', 'Guardar cambios').props.onPress();
  assert.equal(JSON.stringify(editTotal.saved[0]), JSON.stringify({ ...total, amountMinor: 60000000, revision: 1, updatedAt: editTotal.saved[0].updatedAt }));
  assert.equal(Object.hasOwn(editTotal.saved[0], 'category'), false);
  const editFood = harness({ original: food, monthISO: food.monthISO });
  root = editFood.render();
  assert.equal(find(root, 'CategoryField').props.value, 'Comida');
  await find(root, 'ActionButton', 'Guardar cambios').props.onPress();
  assert.equal(editFood.saved.length, 0, 'an unchanged budget closes without writing');
  assert.equal(editFood.backs(), 1);
});

test('a duplicate general budget, a zero amount and a failed save keep the draft, and archiving asks first', async () => {
  const duplicate = harness({ monthISO: '2026-09', currency: 'ARS', scope: 'total' }, archive, async () => { throw new Error('Ya existe un presupuesto general activo para esa moneda y mes.'); });
  find(duplicate.render(), 'AmountField').props.onChangeText('1');
  await find(duplicate.render(), 'ActionButton', 'Crear presupuesto').props.onPress();
  let root = duplicate.render();
  assert.match(find(root, 'ErrorMessage').props.message, /general activo/);
  assert.equal(find(root, 'AmountField').props.editable, false, 'the same submission stays frozen for retry');
  assert.equal(find(root, 'ActionButton', 'Reintentar guardado').props.label, 'Reintentar guardado');
  const zero = harness({ monthISO: '2026-09', currency: 'ARS', scope: 'total' }, { ...archive, budgets: [] });
  find(zero.render(), 'AmountField').props.onChangeText('0');
  await find(zero.render(), 'ActionButton', 'Crear presupuesto').props.onPress();
  root = zero.render();
  assert.match(find(root, 'ErrorMessage').props.message, /mayor que cero/);
  assert.equal(zero.saved.length, 0);
  assert.equal(find(root, 'AmountField').props.editable, true, 'invalid input never freezes the draft');
  const negative = harness({ monthISO: '2026-09', currency: 'ARS', scope: 'total' }, { ...archive, budgets: [] });
  find(negative.render(), 'AmountField').props.onChangeText('-5');
  await find(negative.render(), 'ActionButton', 'Crear presupuesto').props.onPress();
  assert.ok(find(negative.render(), 'ErrorMessage').props.message, 'a negative limit is refused');
  assert.equal(negative.saved.length, 0);
  const archiving = harness({ original: total, monthISO: total.monthISO });
  await find(archiving.render(), 'ActionButton', 'Eliminar presupuesto').props.onPress();
  assert.equal(archiving.alerts.length, 1);
  assert.equal(archiving.saved.length, 0, 'nothing until the person confirms');
  archiving.alerts[0].buttons[1].onPress();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual([archiving.saved[0].scope, archiving.saved[0].active, archiving.saved[0].revision], ['total', false, 1]);
});
