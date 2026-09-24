import assert from 'node:assert/strict';
import { test } from 'node:test';
import { editedCategoryDefinition, newCategoryDefinition, resolveCategory, type CategoryDefinition, type Entry } from '@finanzapp/domain';
import { categoryChoices, categoryIcon, categoryKey, categorySearchText, customCategory, identityGlyph } from '../src/ui/categories.ts';
import { resolveCategoryLook } from '../src/ui/appearance.ts';
import { assignCategoryHues, hueColor } from '../src/ui/category-color.ts';

const entry: Entry = { id: 'entry', accountId: 'account', kind: 'expense', amountMinor: 100, merchant: 'Concepto de prueba', category: 'Categoría propia', dateISO: '2026-09-12', createdAt: '2026-09-12T12:00:00Z' };
const now = '2026-09-21T12:00:00Z';
const light = { isDark: false }, dark = { isDark: true };

test('category glyphs come from the curated icon for presets and from the synonym map for historical strings, never rewriting labels', () => {
  assert.equal(categoryIcon('  EDUCACIÓN  '), 'school-outline');
  assert.equal(categoryIcon('Café'), 'cafe-outline', 'a historical synonym still gets a glyph');
  assert.equal(categoryIcon('nafta'), 'car-outline');
  assert.equal(categoryIcon('Categoría propia'), 'pricetag-outline');
  assert.equal(categoryIcon('Comida'), 'restaurant-outline');
  assert.equal(categoryIcon('Regalos', 'income'), 'gift-outline');
  assert.equal(entry.category, 'Categoría propia');
});
test('arbitrary user category strings never resolve to object prototypes or break', () => {
  for (const label of ['__proto__', 'constructor', 'toString', '<script>', '']) assert.equal(categoryIcon(label), 'pricetag-outline');
  assert.equal(identityGlyph({ icon: 'not-an-icon' as never, key: 'x' }), 'ellipsis-horizontal', 'an unknown curated id falls back to the default glyph');
});
test('a definition changes the glyph, the colour and the display name of a stored string', () => {
  const renamed = editedCategoryDefinition(resolveCategory('expense', 'Comida'), { label: 'Alimentación', icon: 'cafe', color: 'green' }, now);
  const identity = { definitions: [renamed], hues: new Map<string, number>() };
  const look = resolveCategoryLook('expense', 'COMIDA', identity, light);
  assert.equal(look.label, 'Alimentación');
  assert.equal(look.glyph, 'cafe-outline');
  assert.equal(look.hex, '#15804F');
  assert.equal(resolveCategoryLook('expense', 'comida', identity, dark).hex, '#3DBE86');
  assert.equal(look.storedLabel, 'Comida', 'new movements keep recording the original spelling');
});
test('a historical string keeps its stored label and a deterministic hue, and an unknown colour id falls back instead of breaking', () => {
  const entries = [entry, { ...entry, id: 'b', category: 'sjsjn', dateISO: '2026-09-13' }];
  const hues = assignCategoryHues(entries);
  const identity = { definitions: [], hues };
  const look = resolveCategoryLook('expense', 'sjsjn', identity, light);
  assert.equal(look.label, 'sjsjn');
  assert.equal(look.glyph, 'pricetag-outline');
  assert.equal(look.hex, hueColor(hues.get('sjsjn')!, light));
  assert.equal(resolveCategoryLook('expense', 'sjsjn', identity, light).hex, look.hex, 'stable across calls');
  const broken: CategoryDefinition = { ...newCategoryDefinition('expense', 'Rota', 'other', 'graphite', now), color: 'neon' as never };
  assert.equal(resolveCategoryLook('expense', 'Rota', { definitions: [broken], hues }, light).hex, '#2557D6', 'default colour, not a crash');
});
test('picker offers identities without creating ledger records; presets first on an empty ledger', () => {
  const records: Entry[] = [];
  assert.ok(categoryChoices(records, 'expense').some(item => item.label === 'Comida'));
  assert.ok(categoryChoices(records, 'income').some(item => item.label === 'Sueldo'));
  assert.ok(!categoryChoices(records, 'expense').some(item => item.label === 'Sueldo'));
  assert.deepEqual(records, []);
});
test('the preset display name wins over an odd recorded spelling; the recorded key still groups', () => {
  const options = categoryChoices([{ ...entry, category: 'EDUCACION' }, { ...entry, id: 'b', category: 'Educación' }], 'expense');
  const educacion = options.filter(item => item.key === 'educacion');
  assert.equal(educacion.length, 1);
  assert.equal(educacion[0].label, 'Educación');
  assert.equal(educacion[0].storedLabel, 'Educación');
});
test('custom/current category remains selectable after changing entry kind, and an archived one stays valid while editing', () => {
  assert.equal(categoryChoices([entry], 'income', '', 'Categoría propia')[0].label, 'Categoría propia');
  const archived = editedCategoryDefinition(resolveCategory('expense', 'Categoría propia'), { archived: true }, now);
  assert.ok(!categoryChoices([entry], 'expense', '', '', [archived]).some(item => item.key === 'categoria propia'));
  assert.equal(categoryChoices([entry], 'expense', '', 'Categoría propia', [archived])[0].archived, true);
});
test('search handles accents and all query words; creating requires a distinct valid name', () => {
  assert.deepEqual(categoryChoices([entry], 'expense', 'PROPIA categoria').map(item => item.label), ['Categoría propia']);
  const choices = categoryChoices([], 'expense', 'educacion');
  assert.equal(customCategory(' EDUCACION ', choices), null);
  assert.equal(customCategory(' ', []), null);
  assert.equal(customCategory('x'.repeat(61), []), null);
  assert.equal(customCategory(' Mi categoría ', []), 'Mi categoría');
  assert.equal(categorySearchText('expense', 'Comida'), 'Comida');
  const renamed = editedCategoryDefinition(resolveCategory('expense', 'Comida'), { label: 'Alimentación' }, now);
  assert.equal(categorySearchText('expense', 'Comida', [renamed]), 'Alimentación Comida', 'searching either name finds the movement');
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
const expensePresets = ['Comida', 'Supermercado', 'Restaurantes', 'Transporte', 'Combustible', 'Hogar', 'Alquiler', 'Servicios', 'Suscripciones', 'Salud',
  'Farmacia', 'Educación', 'Ropa', 'Tecnología', 'Ocio', 'Viajes', 'Mascotas', 'Regalos', 'Impuestos', 'Seguros', 'Otros'];
const incomePresets = ['Sueldo', 'Trabajo', 'Ventas', 'Inversiones', 'Regalos', 'Reembolsos', 'Préstamos', 'Otros'];

test('test-looking categories are not presets: an empty ledger offers exactly the defaults', () => {
  assert.deepEqual(categoryChoices([], 'expense').map(item => item.label), expensePresets);
  assert.deepEqual(categoryChoices([], 'income').map(item => item.label), incomePresets);
  assert.ok(categoryChoices([], 'expense').every(item => item.source === 'preset' && item.icon && item.color));
});
test('historical custom categories stay selectable and unrenamed next to the intact defaults', () => {
  const before = JSON.stringify(history);
  const choices = categoryChoices(history, 'expense');
  assert.deepEqual(choices.slice(0, 3).map(item => item.label), ['Comida', 'JD', 'sjsjn'], 'recorded first, most recent first');
  assert.deepEqual(choices.slice(1, 3).map(item => item.source), ['historical', 'historical']);
  for (const label of expensePresets) assert.ok(choices.some(item => item.label === label), label + ' preset intact');
  assert.equal(choices.length, expensePresets.length + 2);
  assert.deepEqual(categoryChoices(history, 'income').map(item => item.label), incomePresets, 'expense-only history never leaks into income');
  assert.equal(JSON.stringify(history), before, 'nothing in the ledger was renamed or deleted');
  assert.equal(categoryKey('  JD '), 'jd');
});

// Producto 23.1C2 declares Spanish and English to iOS, so Hermes' default
// collator on a Spanish iPhone moves from English to Spanish. assignCategoryHues
// breaks ties with localeCompare and no locale; this pins that the change can
// never recolour a category: the one letter the two collations order apart (ñ)
// never reaches the comparison, because categoryKey drops the tilde and the
// first-use stamps are ASCII dates.
test('23.1C2: hue tie-breaks order the same under Spanish and English collation, so no category changes colour', () => {
  const tied = ['Ñandú', 'Nube', 'Niño', 'nafta', 'Oso', 'Øl', 'Straße', 'Æble', 'Café', 'cafe 2'].map((category, index) =>
    ({ ...entry, id: 'tie-' + index, category, dateISO: '2026-09-01', createdAt: '2026-09-01T12:00:00Z' }));
  const staggered = tied.map((item, index) => ({ ...item, createdAt: `2026-09-01T12:00:0${index % 3}${index % 2 ? '.000' : ''}Z` }));
  const native = String.prototype.localeCompare;
  const under = (locale: string, entries: Entry[]) => {
    String.prototype.localeCompare = function (this: string, that: string) { return new Intl.Collator(locale).compare(String(this), that); };
    try { return JSON.stringify([...assignCategoryHues(entries)]); } finally { String.prototype.localeCompare = native; }
  };
  for (const entries of [tied, staggered]) {
    const english = under('en', entries);
    assert.equal(under('es', entries), english, 'the assignment and its order are identical');
    assert.equal(under('es-AR', entries), english);
    assert.equal(JSON.stringify([...assignCategoryHues(entries)]), english, 'and equal to this runtime’s default');
  }
  // The collations do differ on a raw ñ; the key never carries one.
  assert.ok(new Intl.Collator('es').compare('ña', 'nz') > 0 && new Intl.Collator('en').compare('ña', 'nz') < 0);
  assert.equal(categoryKey('Ñandú'), 'nandu');
});
