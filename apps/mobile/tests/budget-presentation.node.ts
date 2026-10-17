import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { TotalMonthlyBudget, CategoryMonthlyBudget } from '@finanzapp/domain';
import { budgetCategoriesCaption, budgetTone, percentUsed } from '../src/ui/budget-presentation.ts';
import { translator } from '../src/i18n/messages.ts';

// Budget states use the domain thresholds and the three existing semantic tones only.
const createdAt = '2026-09-01T12:00:00.000Z';
const total: TotalMonthlyBudget = { id: 't', scope: 'total', currency: 'ARS', monthISO: '2026-09', amountMinor: 1000, active: true, createdAt, revision: 0, updatedAt: createdAt };
const food: CategoryMonthlyBudget = { ...total, id: 'f', scope: 'category', category: 'Comida' };
const progress = <B extends TotalMonthlyBudget | CategoryMonthlyBudget>(budget: B, spentMinor: number) =>
  ({ budget, spentMinor, remainingMinor: budget.amountMinor - spentMinor, ratio: spentMinor / budget.amountMinor, exceeded: spentMinor > budget.amountMinor });

test('states map to neutral, warning and expense at 85 % and past 100 %', () => {
  assert.equal(budgetTone(progress(total, 0)), 'neutral');
  assert.equal(budgetTone(progress(total, 849)), 'neutral');
  assert.equal(budgetTone(progress(total, 850)), 'warning');
  assert.equal(budgetTone(progress(total, 1000)), 'warning', 'exactly 100 % is reached, not exceeded');
  assert.equal(budgetTone(progress(total, 1001)), 'expense');
  assert.equal(percentUsed(progress(total, 644)), 64);
  assert.equal(percentUsed(progress(total, 1250)), 125);
});

test('25D2: the shown percent is the whole percent not above what was spent, so «85 %» is amber and «100 %» is the limit, every time (a recorded golden change: it rounded)', () => {
  const limit = { ...total, amountMinor: 10_000_000 };
  const shown = (spent: number) => [percentUsed(progress(limit, spent)), budgetTone(progress(limit, spent))];
  assert.deepEqual(shown(8_460_000), [84, 'neutral'], 'rounding showed a calm «85 %»');
  assert.deepEqual(shown(8_500_000), [85, 'warning']);
  assert.deepEqual(shown(9_960_000), [99, 'warning'], 'rounding showed «100 %» with money left');
  assert.deepEqual(shown(10_000_000), [100, 'warning']);
  assert.deepEqual(shown(10_000_001), [100, 'expense']);
  assert.deepEqual(shown(-5_000), [0, 'neutral'], 'devoluciones above the purchases: none of the limit used');
  // Exact integers: a binary tail never moves it (0.29 * 100 is 28.999… in floating point).
  assert.equal(percentUsed(progress({ ...total, amountMinor: 100 }, 29)), 29);
  assert.equal(percentUsed(progress({ ...total, amountMinor: 3 }, 1)), 33);
  assert.equal(percentUsed({ spentMinor: Number.MAX_SAFE_INTEGER, budget: { amountMinor: Number.MAX_SAFE_INTEGER - 1 } }), 100);
});

test('the Por categoría caption counts sublimits, exceeded and near ones, in Spanish and English', () => {
  const en = translator('en');
  assert.equal(budgetCategoriesCaption(0, 0, 0), undefined);
  assert.equal(budgetCategoriesCaption(1, 0, 0), '1 categoría · todas en orden');
  assert.equal(budgetCategoriesCaption(3, 1, 1), '3 categorías · 1 excedida · 1 cerca del límite');
  assert.equal(budgetCategoriesCaption(3, 2, 0), '3 categorías · 2 excedidas');
  assert.equal(budgetCategoriesCaption(1, 0, 0, en), '1 category · all on track');
  assert.equal(budgetCategoriesCaption(3, 1, 1, en), '3 categories · 1 over · 1 near the limit');
});
