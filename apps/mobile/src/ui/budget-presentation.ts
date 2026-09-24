import { budgetState, type BudgetProgress, type CategoryMonthlyBudget, type MonthlyBudgetSummary, type TotalMonthlyBudget } from '@finanzapp/domain';
import { translator, type Translate } from '../i18n/messages.ts';

/** Budget states map onto the existing semantic tones, and nothing else:
 * calm is neutral, approaching the limit is warning, exceeded is expense.
 * The thresholds live in the domain (budgetState) so every screen agrees. */
export type BudgetTone = 'neutral' | 'warning' | 'expense';
export function budgetTone(progress: Pick<BudgetProgress, 'ratio' | 'exceeded'>): BudgetTone {
  const state = budgetState(progress);
  return state === 'exceeded' ? 'expense' : state === 'warning' ? 'warning' : 'neutral';
}
export function percentUsed(progress: Pick<BudgetProgress, 'ratio'>): number {
  return Math.round(progress.ratio * 100);
}

/** What Home leads with. A total budget answers "how much of my month have I
 * used" directly. Without one, the tightest category sublimit stands in, with
 * the count of sublimits beside it; sublimits are never added up into a fake
 * monthly total. Nothing when there is no active budget. */
export type BudgetHomeHeadline =
  | { kind: 'total'; progress: BudgetProgress<TotalMonthlyBudget>; categories: number; exceededCategories: number }
  | { kind: 'category'; progress: BudgetProgress<CategoryMonthlyBudget>; categories: number; exceededCategories: number }
  | null;
export function budgetHomeHeadline(summary: MonthlyBudgetSummary): BudgetHomeHeadline {
  const categories = summary.rows.length;
  const exceededCategories = summary.rows.filter(row => row.exceeded).length;
  if (summary.total) return { kind: 'total', progress: summary.total, categories, exceededCategories };
  // Rows come worst first from the domain: exceeded, then highest ratio.
  if (summary.rows.length) return { kind: 'category', progress: summary.rows[0], categories, exceededCategories };
  return null;
}

/** "2 categorías en orden", "1 categoría excedida", or nothing without sublimits. */
export function categoriesStatus(categories: number, exceeded: number, t: Translate = translator('es')): string {
  if (!categories) return '';
  if (exceeded) return t('budgetStatus.exceeded', { count: exceeded });
  return t('budgetStatus.inOrder', { count: categories });
}

/** The caption of Presupuestos' "Por categoría" section: "3 categorías · 1
 * excedida · 1 cerca del límite", or "… · todas en orden" when none needs
 * attention; nothing without sublimits. */
export function budgetCategoriesCaption(categories: number, exceeded: number, near: number, t: Translate = translator('es')): string | undefined {
  if (!categories) return undefined;
  const parts = [t('budgets.caption.categories', { count: categories })];
  if (exceeded) parts.push(t('budgets.caption.exceeded', { count: exceeded }));
  if (near) parts.push(t('budgets.caption.near', { count: near }));
  if (!exceeded && !near) parts.push(t('budgets.caption.allInOrder'));
  return parts.join(' · ');
}
