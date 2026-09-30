import { addDaysISO, budgetState, type BudgetProgress, type CategorySpending, type Currency, type MonthlyBudgetSummary, type RecurringRule } from '@finanzapp/domain';

/** Producto 24UX6A: what Inicio shows under its number besides the capture button, as pure selections, so the screen and
 * the tests read one rule. Inicio answers three questions (how am I, what needs my attention, how do I record something)
 * and stops there: every list and every analysis keeps its own screen (Movimientos, Reportes, Presupuestos, Recurrentes).
 * No React, so Node tests load it directly. */

/** The commitments Inicio lists: the ones due within this many days (today included). Later ones live in Recurrentes. */
export const COMMITMENT_HORIZON_DAYS = 7;
/** At most this many rows; «Ver todos» opens the rest. */
export const COMMITMENT_ROWS = 2;

/** The active expense rules shown on Inicio: due from today to the horizon, soonest first (a tie by merchant), at most two;
 * none when nothing falls due that soon, so the section disappears instead of listing next month. `inView` keeps the
 * rules whose account the display shows (one currency, or every account when consolidated). */
export function homeCommitments(rules: readonly RecurringRule[] = [], todayISO: string, inView: (accountId: string) => boolean): RecurringRule[] {
  const horizon = addDaysISO(todayISO, COMMITMENT_HORIZON_DAYS - 1);
  return rules.filter(rule => rule.active && !rule.deleted && rule.kind === 'expense' && rule.nextDateISO >= todayISO && rule.nextDateISO <= horizon && inView(rule.accountId))
    .sort((a, b) => a.nextDateISO.localeCompare(b.nextDateISO) || a.merchant.localeCompare(b.merchant))
    .slice(0, COMMITMENT_ROWS);
}

/** A single category this large a share of the month's spending is worth one line; below it, nothing is said. */
export const CONCENTRATION_SHARE = 0.4;

/** The one contextual line Inicio may show, from computed facts only (never a cause, never advice), in priority order:
 *   1. a budget of the month that is exceeded, the total before a category, then the worst category;
 *   2. a budget at 85 % or more (`budgetState` warning), the tightest first: what share is left;
 *   3. one category concentrating at least 40 % of the month's spending (with two categories or more);
 *   4. nothing.
 * `category` is the stored category of a category budget or of the concentrated spending (the screen shows its label). */
export type HomeInsight =
  | { kind: 'budgetExceeded'; scope: 'total' | 'category'; category: string | null; currency: Currency; overMinor: number }
  | { kind: 'budgetLow'; scope: 'total' | 'category'; category: string | null; currency: Currency; leftShare: number }
  | { kind: 'concentration'; category: string; key: string; currency: Currency; share: number }
  | null;

export function homeInsight(budget: MonthlyBudgetSummary | null, categories: readonly CategorySpending[] | null, expenseMinor: number, currency: Currency): HomeInsight {
  if (budget) {
    const candidates: { progress: BudgetProgress; scope: 'total' | 'category'; category: string | null }[] = [
      ...(budget.total ? [{ progress: budget.total as BudgetProgress, scope: 'total' as const, category: null }] : []),
      ...budget.rows.map(row => ({ progress: row as BudgetProgress, scope: 'category' as const, category: row.budget.category ?? null })),
    ];
    // Exceeded before near the limit; among the exceeded, the month's total before a category; then the highest ratio.
    const order = (item: { state: string; scope: 'total' | 'category'; progress: BudgetProgress }) =>
      [item.state === 'exceeded' ? 0 : 1, item.state === 'exceeded' && item.scope === 'category' ? 1 : 0, -item.progress.ratio];
    const worst = candidates.map(item => ({ ...item, state: budgetState(item.progress) })).filter(item => item.state !== 'calm')
      .sort((a, b) => { const x = order(a), y = order(b); return x[0] - y[0] || x[1] - y[1] || x[2] - y[2]; })[0];
    if (worst?.state === 'exceeded') return { kind: 'budgetExceeded', scope: worst.scope, category: worst.category, currency: budget.currency, overMinor: -worst.progress.remainingMinor };
    if (worst) return { kind: 'budgetLow', scope: worst.scope, category: worst.category, currency: budget.currency, leftShare: Math.max(0, 1 - worst.progress.ratio) };
  }
  if (categories && categories.length >= 2 && expenseMinor > 0) {
    const top = [...categories].sort((a, b) => b.amountMinor - a.amountMinor)[0];
    const share = top.amountMinor / expenseMinor;
    if (share >= CONCENTRATION_SHARE) return { kind: 'concentration', category: top.category, key: top.key, currency, share };
  }
  return null;
}
