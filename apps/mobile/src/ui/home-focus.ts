import { addDaysISO, budgetState, categoryKey, sortCurrencies, summarizeMonthlyBudgets, type Account, type BudgetProgress, type Currency, type Entry, type LedgerSnapshot, type MonthlyBudget,
  type MonthlyBudgetSummary, type RecurringRule, type TotalMonthlyBudget, type Transfer } from '@finanzapp/domain';
import { mergeActivity, type ActivityItem } from './presentation.ts';

/** Producto 24UX6A (decision 005): what Inicio shows under its financial field, as pure selections, so the screen and the
 * tests read one rule. Inicio is the current month's dashboard: one number (Gastado or Disponible), the month's budgets
 * only while they need attention (at most two compact rows: the general budget and category budgets, 24UX6C2/24UX6D),
 * what is due soon, and what was recorded this
 * month; nothing else. No rankings, charts, permanent budget card, insight lines, Registrar button or Assistant banner:
 * the analysis lives in Reportes, recording in the dock's «+». No React, so Node tests load it. */

/** The commitments Inicio considers (Producto 24UX6C2, owner refinement): a rolling window from today, never "this
 * calendar month". A rule counts when its next date falls from today through today plus this many days, BOTH ends
 * inclusive: on 2026-10-01 the window is 2026-10-01 … 2026-10-31. It is the same boundary as Recurrentes' «próximos 30
 * días» forecast (`recurringForecastByCurrency`: today through today + 30 days). One difference is deliberate: a rule
 * whose next date has already passed waits for review in Recurrentes and is not listed here (the forecast still counts
 * its next occurrence). */
export const COMMITMENT_WINDOW_DAYS = 30;
/** At most this many rows; «Ver todos» opens the rest. */
export const COMMITMENT_ROWS = 2;

/** The active expense rules shown on Inicio: due inside the window (today through today + COMMITMENT_WINDOW_DAYS, both
 * inclusive), soonest first (a tie by merchant, then by id, so the order never depends on storage), and only then cut to
 * two; none in the window means no section at all. «Ver todos» opens Recurrentes for the rest. A recurring income is
 * never a commitment. `inView` keeps the rules whose account the display shows (one currency, or every account when
 * consolidated). A paused or deleted rule never appears.
 *
 * Only recurring rules: they are the one upcoming commitment the ledger can state with its amount and date. A card's
 * statement has no recorded amount (its balance due is not a statement amount) and its future instalments are already
 * part of that card, so neither is listed here (decision 005). */
export function homeCommitments(rules: readonly RecurringRule[] = [], todayISO: string, inView: (accountId: string) => boolean): RecurringRule[] {
  const through = addDaysISO(todayISO, COMMITMENT_WINDOW_DAYS);
  return rules.filter(rule => rule.active && !rule.deleted && rule.kind === 'expense' && rule.nextDateISO >= todayISO && rule.nextDateISO <= through && inView(rule.accountId))
    .sort((a, b) => a.nextDateISO.localeCompare(b.nextDateISO) || a.merchant.localeCompare(b.merchant) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .slice(0, COMMITMENT_ROWS);
}

/** How many of the month's latest movements Inicio lists: four under the commitments, six when there are none (the
 * activity then takes the commitments' place). A count, not a height: larger text scrolls, it never drops rows. */
export const RECENT_ROWS = { withCommitments: 4, alone: 6 } as const;
export function recentRowLimit(hasCommitments: boolean): number {
  return hasCommitments ? RECENT_ROWS.withCommitments : RECENT_ROWS.alone;
}

/** The month's latest activity (Producto 24UX6C2): its expenses, incomes AND transfers in the accounts the display
 * shows (`inView`), merged and ordered newest first exactly as Movimientos orders them (`mergeActivity`: the day, then
 * when it was recorded, then the record's key, so equal times never shuffle), with the limit applied after the merge.
 *
 * A transfer is one record, so it is one row, never one per side, even when both of its accounts are shown. The domain
 * refuses a transfer between two currencies (ledger.ts), so its two accounts share one currency and the view shows
 * both or neither: it is included when its source account is shown, at its own amount, never converted. A transfer is
 * activity, not spending or income: listing it here never touches Gastado or Disponible, which come from their own
 * figures. Each row keeps its own amount and currency. */
export function homeRecent(entries: readonly Entry[], transfers: readonly Transfer[], accounts: Account[], period: { startISO: string; endISO: string },
  inView: (account: Account) => boolean, limit: number): ActivityItem[] {
  const shown = new Set(accounts.filter(inView).map(account => account.id));
  const inPeriod = (dateISO: string) => dateISO >= period.startISO && dateISO <= period.endISO;
  return mergeActivity(entries.filter(entry => shown.has(entry.accountId) && inPeriod(entry.dateISO)),
    transfers.filter(transfer => shown.has(transfer.fromAccountId) && inPeriod(transfer.dateISO))).slice(0, limit);
}

/** One budget that needs attention (24UX6C2; category budgets since the 24UX6D refinement): its domain state, `warning`
 * or `exceeded` (`budgetState`: 85 % through 100 % inclusive is warning, above 100 % exceeded; calm never appears) and
 * the domain's own progress, untouched. */
export type BudgetAttention = { state: 'warning' | 'exceeded'; progress: BudgetProgress<MonthlyBudget> };
/** The month's GENERAL budget when it needs attention, or null (no summary, no general budget, or calm). */
export function homeBudgetAttention(summary: MonthlyBudgetSummary | null): (BudgetAttention & { progress: BudgetProgress<TotalMonthlyBudget> }) | null {
  const total = summary?.total;
  if (!total) return null;
  const state = budgetState(total);
  return state === 'calm' ? null : { state, progress: total };
}
/** Every budget of one summary that needs attention: the general budget and each category budget, by the same rule. */
export function budgetAttentions(summary: MonthlyBudgetSummary | null): BudgetAttention[] {
  if (!summary) return [];
  const items: BudgetAttention[] = [];
  for (const progress of [...(summary.total ? [summary.total] : []), ...summary.rows]) {
    const state = budgetState(progress);
    if (state !== 'calm') items.push({ state, progress });
  }
  return items;
}

/** Inicio shows at most this many budget rows (24UX6D refinement): Home is never a budget dashboard; the rest stay in
 * Presupuestos. */
export const BUDGET_ATTENTION_ROWS = 2;

/** The budgets Inicio shows (24UX6D refinement, owner): the month's general budget AND its category budgets, only those
 * in warning or exceeded (`budgetState`), at most `BUDGET_ATTENTION_ROWS`, the limit applied after the order:
 *   1. exceeded before warning;
 *   2. within a state, a general budget before category budgets;
 *   3. then the higher ratio first (spent / limit, the domain's own ratio);
 *   4. then, stable: the display currency's before another currency's, the currency code, the category's key
 *      (`categoryKey`: accents and case folded) and the budget id.
 * Which currencies: in `single` mode only the currency shown; consolidated, every held currency (and the display one).
 * A budget keeps its own currency (24C1) and is measured with `summarizeMonthlyBudgets` on the real ledger of that
 * currency's accounts, never converted; a row names its currency whenever it is not the display currency
 * (`labelsCurrency`). Nothing needs attention: an empty list, and Inicio draws no budget UI at all. */
export type HomeBudget = BudgetAttention & { currency: Currency; labelsCurrency: boolean };
export function homeBudgets(snapshot: LedgerSnapshot, budgets: readonly MonthlyBudget[], held: readonly Currency[], mode: 'consolidated' | 'single',
  display: Currency, monthISO: string): HomeBudget[] {
  const active = budgets.filter(budget => budget.active && budget.monthISO === monthISO);
  const candidates = mode === 'single' ? [display] : [display, ...sortCurrencies(new Set(held)).filter(currency => currency !== display)];
  const items: HomeBudget[] = [];
  for (const currency of candidates) {
    if (!active.some(budget => budget.currency === currency)) continue;
    let summary: MonthlyBudgetSummary;
    try { summary = summarizeMonthlyBudgets(snapshot, [...budgets], currency, monthISO); } catch { continue; }
    for (const attention of budgetAttentions(summary)) items.push({ ...attention, currency, labelsCurrency: currency !== display });
  }
  const rank = (item: HomeBudget) => [item.state === 'exceeded' ? 0 : 1, item.progress.budget.scope === 'total' ? 0 : 1] as const;
  const key = (item: HomeBudget) => item.progress.budget.scope === 'category' ? categoryKey(item.progress.budget.category) : '';
  const text = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
  return items.sort((a, b) => rank(a)[0] - rank(b)[0] || rank(a)[1] - rank(b)[1] || b.progress.ratio - a.progress.ratio
    || Number(a.currency !== display) - Number(b.currency !== display) || text(a.currency, b.currency) || text(key(a), key(b))
    || text(a.progress.budget.id, b.progress.budget.id)).slice(0, BUDGET_ATTENTION_ROWS);
}
