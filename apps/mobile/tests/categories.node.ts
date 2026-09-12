import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Entry } from '@finanzapp/domain';
import { categoryChoices, categoryKey, categorySymbol, customCategory } from '../src/ui/categories.ts';

const entry: Entry = { id: 'entry', accountId: 'account', kind: 'expense', amountMinor: 100, merchant: 'Concepto de prueba', category: 'Categoría propia', dateISO: '2026-09-12', createdAt: '2026-09-12T12:00:00Z' };

test('category symbols tolerate case and accents without rewriting labels', () => {
  assert.equal(categorySymbol('  EDUCACIÓN  '), '📚');
  assert.equal(categorySymbol('Café'), '☕');
  assert.equal(categorySymbol('Categoría propia'), '🧾');
  assert.equal(entry.category, 'Categoría propia');
});
test('arbitrary user category strings never resolve to object prototypes', () => {
  for (const label of ['__proto__', 'constructor', 'toString', '<script>', '']) assert.equal(categorySymbol(label), '🧾');
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
