import { addDaysISO, budgetState, sortCurrencies, summarizeMonthlyBudgets, type Account, type BudgetProgress, type Currency, type Entry, type LedgerSnapshot, type MonthlyBudget,
  type MonthlyBudgetSummary, type RecurringRule, type TotalMonthlyBudget, type Transfer } from '@finanzapp/domain';
import { mergeActivity, type ActivityItem } from './presentation.ts';

/** Producto 24UX6A (decision 005): what Inicio shows under its financial field, as pure selections, so the screen and the
 * tests read one rule. Inicio is the current month's dashboard: one number (Gastado or Disponible), the month's general
 * budget only while it needs attention (one contextual row, 24UX6C2), what is due soon, and what was recorded this
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

/** The one budget fact Inicio may show (24UX6C2, owner refinement): the month's GENERAL budget when it needs attention,
 * by the domain's own rule (`budgetState`: calm below BUDGET_WARNING_RATIO, 85 %; warning from 85 % through 100 %;
 * exceeded above 100 %). Never a category sublimit, never a calm budget, never a permanent card: null when there is no
 * active general budget or it is calm. The summary is measured on the real ledger in the budget's own currency (24C1). */
export type BudgetAttention = { state: 'warning' | 'exceeded'; progress: BudgetProgress<TotalMonthlyBudget> };
export function homeBudgetAttention(summary: MonthlyBudgetSummary | null): BudgetAttention | null {
  const total = summary?.total;
  if (!total) return null;
  const state = budgetState(total);
  return state === 'calm' ? null : { state, progress: total };
}

/** Whose general budget Inicio shows (24UX6C2 review). Only a month's GENERAL budget counts; a category sublimit never
 * makes a currency the candidate. A budget keeps its own currency (24C1) and is measured on the real ledger of that
 * currency's accounts, never a converted total. In `single` mode only the currency shown is considered. Consolidated,
 * the display currency first, then each held currency in grouping order: the first whose general budget is in warning
 * or exceeded is the one row, its currency named whenever it is not the display currency (`labelsCurrency`). So a
 * calm budget never hides another currency's exceeded one, and nothing is drawn when every general budget is calm. */
export type HomeBudget = BudgetAttention & { currency: Currency; labelsCurrency: boolean };
export function homeBudget(snapshot: LedgerSnapshot, budgets: readonly MonthlyBudget[], held: readonly Currency[], mode: 'consolidated' | 'single',
  display: Currency, monthISO: string): HomeBudget | null {
  const general = budgets.filter(budget => budget.active && budget.scope === 'total' && budget.monthISO === monthISO);
  const candidates = mode === 'single' ? [display] : [display, ...sortCurrencies(new Set(held)).filter(currency => currency !== display)];
  for (const currency of candidates) {
    if (!general.some(budget => budget.currency === currency)) continue;
    let attention: BudgetAttention | null;
    try { attention = homeBudgetAttention(summarizeMonthlyBudgets(snapshot, [...budgets], currency, monthISO)); } catch { continue; }
    if (attention) return { ...attention, currency, labelsCurrency: currency !== display };
  }
  return null;
}
