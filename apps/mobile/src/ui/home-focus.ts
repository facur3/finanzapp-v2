import { addDaysISO, type Account, type Entry, type RecurringRule, type Transfer } from '@finanzapp/domain';
import { mergeActivity, type ActivityItem } from './presentation.ts';

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
