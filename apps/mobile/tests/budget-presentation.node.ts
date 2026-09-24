import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { MonthlyBudgetSummary, TotalMonthlyBudget, CategoryMonthlyBudget } from '@finanzapp/domain';
import { budgetCategoriesCaption, budgetHomeHeadline, budgetTone, categoriesStatus, percentUsed } from '../src/ui/budget-presentation.ts';
import { translator } from '../src/i18n/messages.ts';

// Budget states use the domain thresholds and the three existing semantic tones only.
const createdAt = '2026-09-01T12:00:00.000Z';
const total: TotalMonthlyBudget = { id: 't', scope: 'total', currency: 'ARS', monthISO: '2026-09', amountMinor: 1000, active: true, createdAt, revision: 0, updatedAt: createdAt };
const food: CategoryMonthlyBudget = { ...total, id: 'f', scope: 'category', category: 'Comida' };
const progress = <B extends TotalMonthlyBudget | CategoryMonthlyBudget>(budget: B, spentMinor: number) =>
  ({ budget, spentMinor, remainingMinor: budget.amountMinor - spentMinor, ratio: spentMinor / budget.amountMinor, exceeded: spentMinor > budget.amountMinor });
const summary = (patch: Partial<MonthlyBudgetSummary>): MonthlyBudgetSummary => ({ currency: 'ARS', monthISO: '2026-09', total: null, rows: [],
  budgetedMinor: 0, spentBudgetedMinor: 0, remainingMinor: 0, totalSpentMinor: 0, unbudgetedSpentMinor: 0, ...patch });

test('states map to neutral, warning and expense at 85 % and past 100 %', () => {
  assert.equal(budgetTone(progress(total, 0)), 'neutral');
  assert.equal(budgetTone(progress(total, 849)), 'neutral');
  assert.equal(budgetTone(progress(total, 850)), 'warning');
  assert.equal(budgetTone(progress(total, 1000)), 'warning', 'exactly 100 % is reached, not exceeded');
  assert.equal(budgetTone(progress(total, 1001)), 'expense');
  assert.equal(percentUsed(progress(total, 644)), 64);
  assert.equal(percentUsed(progress(total, 1250)), 125);
});

test('Home leads with the general budget, otherwise the tightest sublimit, otherwise nothing', () => {
  assert.equal(budgetHomeHeadline(summary({})), null);
  const tight = progress(food, 990), over = progress({ ...food, id: 'o', category: 'Ocio' }, 1200);
  const general = budgetHomeHeadline(summary({ total: progress(total, 640), rows: [over, tight] }));
  assert.equal(general!.kind, 'total');
  assert.equal(general!.progress.budget.id, 't');
  assert.deepEqual([general!.categories, general!.exceededCategories], [2, 1]);
  const fallback = budgetHomeHeadline(summary({ rows: [over, tight] }));
  assert.equal(fallback!.kind, 'category');
  assert.equal(fallback!.progress.budget.id, 'o', 'rows arrive worst first from the domain');
  assert.equal(categoriesStatus(0, 0), '');
  assert.equal(categoriesStatus(1, 0), '1 categoría en orden');
  assert.equal(categoriesStatus(3, 0), '3 categorías en orden');
  assert.equal(categoriesStatus(3, 1), '1 categoría excedida');
  assert.equal(categoriesStatus(3, 2), '2 categorías excedidas');
});

test('the Por categoría caption counts sublimits, exceeded and near ones, in Spanish and English', () => {
  const en = translator('en');
  assert.equal(budgetCategoriesCaption(0, 0, 0), undefined);
  assert.equal(budgetCategoriesCaption(1, 0, 0), '1 categoría · todas en orden');
  assert.equal(budgetCategoriesCaption(3, 1, 1), '3 categorías · 1 excedida · 1 cerca del límite');
  assert.equal(budgetCategoriesCaption(3, 2, 0), '3 categorías · 2 excedidas');
  assert.equal(budgetCategoriesCaption(1, 0, 0, en), '1 category · all on track');
  assert.equal(budgetCategoriesCaption(3, 1, 1, en), '3 categories · 1 over · 1 near the limit');
  assert.equal(categoriesStatus(3, 2, en), '2 categories over');
});
