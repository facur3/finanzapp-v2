import { describe, expect, it } from 'vitest';
import { CATEGORY_PRESETS, categoryCatalog, categoryNameTaken, categoryOptions, customCategoryName, editedCategoryDefinition,
  newCategoryDefinition, resolveCategory, sameCategoryDefinition, validateCategoryDefinition, validateCategoryDefinitions, type CategoryDefinition } from './categories';
import { categoryKey, spendingReport } from './spending-report';
import { summarizeMonthlyBudgets, type MonthlyBudget } from './budgets';
import { validateRecurringRule, type RecurringRule } from './recurring';
import type { Account, Entry } from './ledger';

const createdAt = '2026-09-01T12:00:00Z';
const now = '2026-09-21T12:00:00Z';
const account: Account = { id: 'a', name: 'Banco', currency: 'ARS', openingMinor: 100000, createdAt };
const entry = (id: string, category: string, dateISO = '2026-09-10', kind: Entry['kind'] = 'expense', amountMinor = 1000): Entry =>
  ({ id, accountId: 'a', kind, amountMinor, merchant: 'Prueba', category, dateISO, createdAt });
// Historical strings from the owner's device: never presets, never renamed.
const history: Entry[] = [entry('h1', 'sjsjn', '2026-09-15'), entry('h2', 'JD', '2026-09-16'), entry('h3', 'JD', '2026-09-17'),
  entry('h4', 'Comida', '2026-09-18'), entry('h5', 'EDUCACION', '2026-09-12'), entry('h6', 'Sueldo', '2026-09-01', 'income')];
const expensePresets = ['Comida', 'Supermercado', 'Restaurantes', 'Transporte', 'Combustible', 'Hogar', 'Alquiler', 'Servicios', 'Suscripciones', 'Salud',
  'Farmacia', 'Educación', 'Ropa', 'Tecnología', 'Ocio', 'Viajes', 'Mascotas', 'Regalos', 'Impuestos', 'Seguros', 'Otros'];
const incomePresets = ['Sueldo', 'Trabajo', 'Ventas', 'Inversiones', 'Regalos', 'Reembolsos', 'Préstamos', 'Otros'];

describe('presets', () => {
  it('are the restrained default catalogue, in order, with icon and colour', () => {
    expect(CATEGORY_PRESETS.filter(p => p.kind === 'expense').map(p => p.label)).toEqual(expensePresets);
    expect(CATEGORY_PRESETS.filter(p => p.kind === 'income').map(p => p.label)).toEqual(incomePresets);
    for (const p of CATEGORY_PRESETS) { expect(p.key).toBe(categoryKey(p.label)); expect(p.icon).toBeTruthy(); expect(p.color).toBeTruthy(); }
    expect(new Set(CATEGORY_PRESETS.map(p => p.kind + '|' + p.key)).size).toBe(CATEGORY_PRESETS.length);
  });
  it('resolve historical spellings to the preset identity without touching the string', () => {
    const before = JSON.stringify(history);
    const identity = resolveCategory('expense', 'EDUCACION');
    expect(identity).toMatchObject({ key: 'educacion', label: 'Educación', storedLabel: 'Educación', icon: 'education', source: 'preset', archived: false });
    expect(resolveCategory('expense', '  comida ').label).toBe('Comida');
    expect(JSON.stringify(history)).toBe(before);
  });
  it('are kind-scoped: Regalos as expense and as income are two identities', () => {
    expect(resolveCategory('expense', 'Regalos').icon).toBe('gifts');
    expect(resolveCategory('income', 'Regalos').source).toBe('preset');
    expect(resolveCategory('income', 'Comida').source).toBe('historical');
  });
});

describe('historical and unknown strings', () => {
  it('render as stored with no icon or colour claim, never as a preset', () => {
    for (const label of ['sjsjn', 'JD', '__proto__', 'constructor', '<script>']) {
      const identity = resolveCategory('expense', label);
      expect(identity).toMatchObject({ label, storedLabel: label, icon: null, color: null, source: 'historical', archived: false, definition: null });
    }
    expect(resolveCategory('expense', '').key).toBe('');
  });
  it('appear in the catalogue after the presets, most used first, with counts', () => {
    const rows = categoryCatalog('expense', [], history);
    expect(rows.slice(0, 21).map(row => row.identity.label)).toEqual(expensePresets);
    expect(rows.slice(21).map(row => [row.identity.label, row.identity.source, row.count])).toEqual([['JD', 'historical', 2], ['sjsjn', 'historical', 1]]);
    expect(rows.find(row => row.identity.key === 'comida')?.count).toBe(1);
    expect(rows.find(row => row.identity.key === 'educacion')?.count).toBe(1);
    expect(categoryCatalog('income', [], history).filter(row => row.count)).toEqual([{ identity: resolveCategory('income', 'Sueldo'), count: 1 }]);
  });
});

describe('custom categories', () => {
  const alimentos = newCategoryDefinition('expense', '  Kiosco ', 'cafe', 'ochre', now);
  it('are created from the typed name with a stable key and stored spelling', () => {
    expect(alimentos).toEqual({ kind: 'expense', key: 'kiosco', storedLabel: 'Kiosco', label: 'Kiosco', icon: 'cafe', color: 'ochre', archived: false, createdAt: now, revision: 0, updatedAt: now });
    expect(() => validateCategoryDefinition(alimentos)).not.toThrow();
    expect(resolveCategory('expense', 'kiosco', [alimentos])).toMatchObject({ label: 'Kiosco', icon: 'cafe', color: 'ochre', source: 'custom', definition: alimentos });
  });
  it('become available in the picker immediately, and a name already taken is refused', () => {
    expect(categoryOptions('expense', [alimentos]).map(i => i.label)).toContain('Kiosco');
    expect(categoryOptions('income', [alimentos]).map(i => i.label)).not.toContain('Kiosco');
    expect(categoryNameTaken('expense', 'KIOSCO', [alimentos])).toBe(true);
    expect(categoryNameTaken('expense', 'comida', [])).toBe(true);
    expect(categoryNameTaken('income', 'Kiosco', [alimentos])).toBe(false);
    expect(categoryNameTaken('expense', '', [])).toBe(false);
  });
  it('validate ids, names, key consistency and versions', () => {
    expect(() => validateCategoryDefinition({ ...alimentos, icon: 'emoji' as never })).toThrow(/ícono/);
    expect(() => validateCategoryDefinition({ ...alimentos, color: 'neon' as never })).toThrow(/color/);
    expect(() => validateCategoryDefinition({ ...alimentos, key: 'otro' })).toThrow(/identidad/);
    expect(() => validateCategoryDefinition({ ...alimentos, label: ' ' })).toThrow(/nombre/);
    expect(() => validateCategoryDefinition({ ...alimentos, label: 'x'.repeat(61) })).toThrow(/nombre/);
    expect(() => validateCategoryDefinition({ ...alimentos, kind: 'transfer' as never })).toThrow(/gasto o de ingreso/);
    expect(() => validateCategoryDefinition({ ...alimentos, updatedAt: '2026-09-22T00:00:00Z' })).toThrow(/inicial/);
    expect(() => validateCategoryDefinitions([alimentos, alimentos])).toThrow(/repite/);
  });
});

describe('rename as display identity', () => {
  const renamed = editedCategoryDefinition(resolveCategory('expense', 'Comida'), { label: 'Alimentación', color: 'green' }, now);
  it('adopts a preset as a definition that keeps recording the original string', () => {
    expect(renamed).toMatchObject({ kind: 'expense', key: 'comida', storedLabel: 'Comida', label: 'Alimentación', icon: 'food', color: 'green', archived: false, revision: 0 });
    const identity = resolveCategory('expense', 'comida', [renamed]);
    expect(identity.label).toBe('Alimentación');
    expect(identity.storedLabel).toBe('Comida');
    expect(identity.source).toBe('preset');
  });
  it('never splits one logical category into two report groups', () => {
    const entries = [entry('old', 'Comida', '2026-09-02', 'expense', 700), entry('new', renamed.storedLabel, '2026-09-03', 'expense', 300)];
    const report = spendingReport({ accounts: [account], entries }, 'ARS', '2026-09', '2026-09-21');
    expect(report.categories).toHaveLength(1);
    expect(report.categories[0]).toMatchObject({ key: 'comida', amountMinor: 1000, count: 2 });
    expect(resolveCategory('expense', report.categories[0].category, [renamed]).label).toBe('Alimentación');
  });
  it('keeps budgets and recurring rules linked through the same key', () => {
    const budget: MonthlyBudget = { id: 'b', scope: 'category', category: 'Comida', currency: 'ARS', monthISO: '2026-09', amountMinor: 5000, active: true, createdAt, revision: 0, updatedAt: createdAt };
    const summary = summarizeMonthlyBudgets({ accounts: [account], entries: [entry('x', renamed.storedLabel, '2026-09-05', 'expense', 1200)] }, [budget], 'ARS', '2026-09');
    expect(summary.rows[0].spentMinor).toBe(1200);
    expect(resolveCategory('expense', summary.rows[0].budget.category, [renamed]).label).toBe('Alimentación');
    const rule: RecurringRule = { id: 'r', accountId: 'a', kind: 'expense', amountMinor: 100, merchant: 'Delivery', category: 'Comida', frequency: 'monthly',
      anchorDateISO: '2026-10-01', nextDateISO: '2026-10-01', active: true, createdAt, revision: 0, updatedAt: createdAt };
    expect(() => validateRecurringRule(rule, [account])).not.toThrow();
    expect(resolveCategory(rule.kind, rule.category, [renamed]).label).toBe('Alimentación');
  });
  it('edits an existing definition as the next revision', () => {
    const again = editedCategoryDefinition(resolveCategory('expense', 'Comida', [renamed]), { icon: 'restaurant' }, '2026-09-22T00:00:00Z');
    expect(again).toMatchObject({ label: 'Alimentación', icon: 'restaurant', revision: 1, updatedAt: '2026-09-22T00:00:00Z', createdAt: now });
    expect(sameCategoryDefinition(renamed, again)).toBe(false);
  });
  it('refuses a display name that reads as another category', () => {
    const kiosco = newCategoryDefinition('expense', 'Kiosco', 'cafe', 'ochre', now);
    expect(() => validateCategoryDefinitions([renamed, { ...kiosco, label: 'Alimentación' }])).toThrow(/Ya existe/);
    expect(() => validateCategoryDefinitions([{ ...kiosco, label: 'Supermercado' }])).toThrow(/otra categoría/);
    expect(() => validateCategoryDefinitions([renamed, { ...kiosco, label: 'Comida' }])).toThrow(/otra categoría/);
    expect(() => validateCategoryDefinitions([renamed, kiosco])).not.toThrow();
    // The same display name in the other kind is fine: identities are kind-scoped.
    expect(() => validateCategoryDefinitions([renamed, newCategoryDefinition('income', 'Alimentación', 'food', 'green', now)])).not.toThrow();
  });
});

describe('archive', () => {
  const jd = editedCategoryDefinition(resolveCategory('expense', 'JD'), { archived: true }, now);
  const definitions: CategoryDefinition[] = [jd];
  it('adopts a historical string with its recorded spelling and hides it from new choices', () => {
    expect(jd).toMatchObject({ key: 'jd', storedLabel: 'JD', label: 'JD', archived: true, icon: 'other', color: 'graphite', revision: 0 });
    const options = categoryOptions('expense', definitions, history);
    expect(options.map(i => i.label)).not.toContain('JD');
    expect(options.map(i => i.label)).toContain('sjsjn');
    expect(options.map(i => i.label)).toContain('Comida');
  });
  it('keeps historical movements resolvable and the current value selectable while editing', () => {
    expect(resolveCategory('expense', 'jd', definitions)).toMatchObject({ label: 'JD', archived: true, source: 'custom' });
    expect(categoryOptions('expense', definitions, history, '', 'JD')[0].label).toBe('JD');
    expect(categoryCatalog('expense', definitions, history).find(row => row.identity.key === 'jd')).toEqual({ identity: resolveCategory('expense', 'JD', definitions), count: 2 });
  });
  it('an archived name is not offered as a new custom category; other names are', () => {
    const options = categoryOptions('expense', definitions, history, 'jd');
    expect(customCategoryName('expense', 'JD', options, definitions)).toBeNull();
    expect(customCategoryName('expense', ' Kiosco ', categoryOptions('expense', definitions, history, 'kiosco'), definitions)).toBe('Kiosco');
    expect(customCategoryName('expense', 'comida', categoryOptions('expense', definitions, history, 'comida'), definitions)).toBeNull();
    expect(customCategoryName('expense', 'x'.repeat(61), [], definitions)).toBeNull();
  });
});

describe('picker options', () => {
  it('offer recorded categories most recent first, then the catalogue, and never mutate the ledger', () => {
    const before = JSON.stringify(history);
    const labels = categoryOptions('expense', [], history).map(i => i.label);
    expect(labels.slice(0, 4)).toEqual(['Comida', 'JD', 'sjsjn', 'Educación']);
    expect(labels).toHaveLength(expensePresets.length + 2);
    expect(categoryOptions('income', [], history).map(i => i.label)).toEqual(incomePresets);
    expect(categoryOptions('expense', [], []).map(i => i.label)).toEqual(expensePresets);
    expect(JSON.stringify(history)).toBe(before);
  });
  it('search matches accents, all words and the stored key', () => {
    expect(categoryOptions('expense', [], history, 'EDUCACION').map(i => i.label)).toEqual(['Educación']);
    const renamed = editedCategoryDefinition(resolveCategory('expense', 'Comida'), { label: 'Alimentación' }, now);
    expect(categoryOptions('expense', [renamed], [], 'comida').map(i => i.label)).toEqual(['Alimentación']);
    expect(categoryOptions('expense', [], [], 'ción edu').map(i => i.label)).toEqual(['Educación']);
  });
});
