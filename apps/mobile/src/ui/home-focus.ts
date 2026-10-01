import { addDaysISO, dailyAverageMinor, type Account, type Entry, type RecurringRule } from '@finanzapp/domain';
import { selectEntries } from './presentation.ts';

/** Producto 24UX6A (decision 005): what Inicio shows under its financial field, as pure selections, so the screen and the
 * tests read one rule. Inicio is the current month's dashboard: one number (Gastado or Disponible), what is due soon,
 * and what was recorded this month; nothing else. No rankings, charts, budget cards, insight lines, Registrar button or
 * Assistant banner: the analysis lives in Reportes, recording in the dock's «+». No React, so Node tests load it. */

/** The commitments Inicio lists: the ones due within this many days (today included). Later ones live in Recurrentes. */
export const COMMITMENT_HORIZON_DAYS = 7;
/** At most this many rows; «Ver todos» opens the rest. */
export const COMMITMENT_ROWS = 2;

/** The active expense rules shown on Inicio: due from today to the horizon, soonest first (a tie by merchant), at most two;
 * none when nothing falls due that soon, so the section disappears instead of listing next month. `inView` keeps the
 * rules whose account the display shows (one currency, or every account when consolidated).
 *
 * Only recurring rules: they are the one upcoming commitment the ledger can state with its amount and date. A card's
 * statement has no recorded amount (its balance due is not a statement amount) and its future instalments are already
 * part of that card, so neither is listed here (decision 005). */
export function homeCommitments(rules: readonly RecurringRule[] = [], todayISO: string, inView: (accountId: string) => boolean): RecurringRule[] {
  const horizon = addDaysISO(todayISO, COMMITMENT_HORIZON_DAYS - 1);
  return rules.filter(rule => rule.active && !rule.deleted && rule.kind === 'expense' && rule.nextDateISO >= todayISO && rule.nextDateISO <= horizon && inView(rule.accountId))
    .sort((a, b) => a.nextDateISO.localeCompare(b.nextDateISO) || a.merchant.localeCompare(b.merchant))
    .slice(0, COMMITMENT_ROWS);
}

/** How many of the month's latest movements Inicio lists: four under the commitments, six when there are none (the
 * activity then takes the commitments' place). A count, not a height: larger text scrolls, it never drops rows. */
export const RECENT_ROWS = { withCommitments: 4, alone: 6 } as const;
export function recentRowLimit(hasCommitments: boolean): number {
  return hasCommitments ? RECENT_ROWS.withCommitments : RECENT_ROWS.alone;
}

/** The month's latest recorded expenses and incomes (24UX3's rule, restored): the movements of `period` in the accounts
 * the display shows (`inView`), newest first (the day, then when it was recorded), at most `limit`. Each row keeps its
 * own amount and currency; transfers are not activity here (they stay in Movimientos). */
export function homeRecent(entries: readonly Entry[], accounts: Account[], period: { startISO: string; endISO: string }, inView: (account: Account) => boolean, limit: number): Entry[] {
  const shown = new Set(accounts.filter(inView).map(account => account.id));
  return selectEntries(entries.filter(entry => shown.has(entry.accountId) && entry.dateISO >= period.startISO && entry.dateISO <= period.endISO), accounts)
    .slice(0, limit);
}

/** The line under Gastado: the month's spending so far divided by the days elapsed (the same daily average as Reportes,
 * `dailyAverageMinor`). Null when there is nothing to divide (no spending yet, or the figure is not a ready total), so the
 * screen says "no spending this month" instead of "0 a day". Disponible never has a per-day figure: it is a balance, not
 * an allowance. */
export function spendingPerDay(hero: { status: string; minor?: number }, period: { currency: string; startISO: string; endISO: string }): number | null {
  if (hero.status !== 'ready' || typeof hero.minor !== 'number' || hero.minor <= 0) return null;
  try { return dailyAverageMinor(hero.minor, period as Parameters<typeof dailyAverageMinor>[1]); } catch { return null; }
}
