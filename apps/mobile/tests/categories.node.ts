import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Entry } from '@finanzapp/domain';
import { categoryCatalog, categoryChoices, categoryIcon, categoryKey, customCategory } from '../src/ui/categories.ts';

const entry: Entry = { id: 'entry', accountId: 'account', kind: 'expense', amountMinor: 100, merchant: 'Concepto de prueba', category: 'Categoría propia', dateISO: '2026-09-12', createdAt: '2026-09-12T12:00:00Z' };

test('category glyphs tolerate case and accents without rewriting labels', () => {
  assert.equal(categoryIcon('  EDUCACIÓN  '), 'school-outline');
  assert.equal(categoryIcon('Café'), 'cafe-outline');
  assert.equal(categoryIcon('Categoría propia'), 'pricetag-outline');
  assert.equal(entry.category, 'Categoría propia');
});
test('arbitrary user category strings never resolve to object prototypes', () => {
  for (const label of ['__proto__', 'constructor', 'toString', '<script>', '']) assert.equal(categoryIcon(label), 'pricetag-outline');
});
test('picker offers useful choices without creating ledger records', () => {
  const records: Entry[] = [];
  assert.ok(categoryChoices(records, 'expense').includes('Comida'));
  assert.ok(categoryChoices(records, 'income').includes('Sueldo'));
  assert.ok(!categoryChoices(records, 'expense').includes('Sueldo'));
  assert.deepEqual(records, []);
});
test('existing spelling wins over a preset and duplicate variants', () => {
  const options = categoryChoices([{ ...entry, category: 'EDUCACION' }, { ...entry, id: 'b', category: 'Educación' }], 'expense');
  assert.deepEqual(options.filter(label => categoryKey(label) === 'educacion'), ['EDUCACION']);
});
test('custom/current category remains selectable after changing entry kind', () => {
  assert.equal(categoryChoices([entry], 'income', '', 'Categoría propia')[0], 'Categoría propia');
});
test('search handles accents and all query words; creating requires a distinct valid name', () => {
  assert.deepEqual(categoryChoices([entry], 'expense', 'PROPIA categoria'), ['Categoría propia']);
  assert.equal(customCategory(' EDUCACION ', ['Educación']), null);
  assert.equal(customCategory(' ', []), null);
  assert.equal(customCategory('x'.repeat(61), []), null);
  assert.equal(customCategory(' Mi categoría ', []), 'Mi categoría');
});
test('picker never changes stored dates/categories/order when ranking', () => {
  const records = [entry, { ...entry, id: 'b', category: 'Anterior', dateISO: '2026-08-01' }];
  const before = JSON.stringify(records);
  categoryChoices(records, 'expense');
  assert.equal(JSON.stringify(records), before);
});

// The owner's device has categories such as "sjsjn" and "JD". They are not
// presets: they can only come from recorded entries, and they must keep working.
const history: Entry[] = [
  { ...entry, id: 'h1', category: 'sjsjn', dateISO: '2026-09-15' },
  { ...entry, id: 'h2', category: 'JD', dateISO: '2026-09-16' },
  { ...entry, id: 'h3', category: 'JD', dateISO: '2026-09-17' },
  { ...entry, id: 'h4', category: 'Comida', dateISO: '2026-09-18' },
  { ...entry, id: 'h5', kind: 'income', category: 'Sueldo', dateISO: '2026-09-01' },
];
const expensePresets = ['Comida', 'Supermercado', 'Transporte', 'Hogar', 'Servicios', 'Salud', 'Ropa', 'Ocio', 'Educación', 'Viajes', 'Mascotas', 'Otros'];
const incomePresets = ['Sueldo', 'Trabajo', 'Regalos', 'Reembolsos', 'Préstamos', 'Otros'];

test('test-looking categories are not presets: an empty ledger offers exactly the defaults', () => {
  assert.deepEqual(categoryChoices([], 'expense'), expensePresets);
  assert.deepEqual(categoryChoices([], 'income'), incomePresets);
  assert.deepEqual(categoryCatalog([], 'expense').map(row => [row.label, row.preset, row.count]), expensePresets.map(label => [label, true, 0]));
});
test('historical custom categories stay selectable and unrenamed next to the intact defaults', () => {
  const before = JSON.stringify(history);
  const choices = categoryChoices(history, 'expense');
  assert.deepEqual(choices.slice(0, 3), ['Comida', 'JD', 'sjsjn'], 'recorded spellings first, most recent first');
  for (const label of expensePresets) assert.ok(choices.includes(label), label + ' preset intact');
  assert.equal(choices.length, expensePresets.length + 2);
  assert.deepEqual(categoryChoices(history, 'income'), incomePresets, 'expense-only history never leaks into income');
  assert.equal(JSON.stringify(history), before, 'nothing in the ledger was renamed or deleted');
});
test('the read-only catalogue lists presets in order, then recorded custom categories by use, without touching entries', () => {
  const before = JSON.stringify(history);
  const rows = categoryCatalog(history, 'expense');
  assert.deepEqual(rows.slice(0, 12).map(row => row.label), expensePresets);
  assert.deepEqual(rows.slice(12).map(row => [row.label, row.preset, row.count]), [['JD', false, 2], ['sjsjn', false, 1]]);
  assert.deepEqual(rows.find(row => row.label === 'Comida'), { label: 'Comida', preset: true, count: 1 });
  assert.deepEqual(categoryCatalog(history, 'income').filter(row => row.count), [{ label: 'Sueldo', preset: true, count: 1 }]);
  assert.equal(JSON.stringify(history), before);
});
