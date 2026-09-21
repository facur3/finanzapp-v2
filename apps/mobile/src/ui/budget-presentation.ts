import { budgetState, type BudgetProgress, type CategoryMonthlyBudget, type MonthlyBudgetSummary, type TotalMonthlyBudget } from '@finanzapp/domain';

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
export function categoriesStatus(categories: number, exceeded: number): string {
  if (!categories) return '';
  if (exceeded) return `${exceeded} ${exceeded === 1 ? 'categoría excedida' : 'categorías excedidas'}`;
  return `${categories} ${categories === 1 ? 'categoría en orden' : 'categorías en orden'}`;
}
