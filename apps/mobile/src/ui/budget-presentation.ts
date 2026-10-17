import { budgetState, sortCurrencies, type BudgetProgress, type Currency, type MonthlyBudget } from '@finanzapp/domain';
import { translator, type Translate } from '../i18n/messages.ts';

/** Budget states map onto the existing semantic tones, and nothing else:
 * calm is neutral, approaching the limit is warning, exceeded is expense.
 * The thresholds live in the domain (budgetState) so every screen agrees. */
export type BudgetTone = 'neutral' | 'warning' | 'expense';
export function budgetTone(progress: Pick<BudgetProgress, 'ratio' | 'exceeded'>): BudgetTone {
  const state = budgetState(progress);
  return state === 'exceeded' ? 'expense' : state === 'warning' ? 'warning' : 'neutral';
}
/** 25Q1: the currencies Presupuestos offers: the ones live accounts hold, plus any an active budget is in. A budget may be
 * in a currency no account holds (decision 7.6.3), and it must stay reachable to read, edit or delete. */
export function budgetCurrencies(held: readonly Currency[], budgets: readonly MonthlyBudget[]): Currency[] {
  return sortCurrencies(new Set([...held, ...budgets.filter(budget => budget.active).map(budget => budget.currency)]));
}

/** The whole percent of the limit spent, shown on Presupuestos, Inicio and Reportes: the largest whole percent not above
 * what was spent, in exact integers (25D2). So «85 %» appears exactly when the state turns amber (the domain's 0.85) and
 * «100 %» exactly when the limit is reached or passed; rounding showed «85 %» on a calm 84,6 % and «100 %» with money
 * left. A net at or below zero (devoluciones) is 0. */
export function percentUsed(progress: Pick<BudgetProgress, 'spentMinor'> & { budget: Pick<MonthlyBudget, 'amountMinor'> }): number {
  if (progress.spentMinor <= 0 || progress.budget.amountMinor <= 0) return 0;
  return Number(BigInt(progress.spentMinor) * 100n / BigInt(progress.budget.amountMinor));
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

/** A budget keeps its one currency whatever Inicio and Reportes show (24C1 review): it is always measured against the
 * recorded spending of the accounts in that currency, never against a converted total, so switching the display
 * mode or currency never changes what a budget tracks. This chooses whose budgets a screen shows: in `single` mode
 * the currency shown (as before); consolidated, the display currency when it has an active budget for the month,
 * otherwise the first held currency (grouping order) that has one, so an existing ARS budget stays on Inicio while
 * the total is read in USD. Null when no currency has a budget that month. The screen names the currency whenever
 * it differs from the display currency (`labelsCurrency`). */
export function budgetScope(budgets: readonly MonthlyBudget[], held: readonly Currency[], mode: 'consolidated' | 'single', display: Currency, monthISO: string):
  { currency: Currency; labelsCurrency: boolean } | null {
  const has = (currency: Currency) => budgets.some(budget => budget.active && budget.currency === currency && budget.monthISO === monthISO);
  if (mode === 'single') return has(display) ? { currency: display, labelsCurrency: false } : null;
  if (has(display)) return { currency: display, labelsCurrency: false };
  const other = sortCurrencies(new Set(held)).find(has);
  return other ? { currency: other, labelsCurrency: true } : null;
}
