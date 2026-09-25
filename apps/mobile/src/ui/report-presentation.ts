import { categoryKey, isStorableCurrency, validDateISO, type Currency, type Entry, type LedgerSnapshot, type MerchantSpending, type ReportPeriod, type SpendingInsight } from '@finanzapp/domain';
import { availableCurrencies } from './presentation.ts';
import { formatMonth, formatPercent } from '../i18n/format.ts';
import { DEFAULT_LOCALE, type AppLocale } from '../i18n/locale.ts';
import { translator, type Translate } from '../i18n/messages.ts';

/** A route's currency parameter, accepted only when it is a storable code that an account
 * actually holds; anything else (an unknown code, a lowercase one, a currency with no
 * account) is null, never coerced to ARS or to the first held currency. The creation gate
 * plays no part: a stored currency stays reachable whatever the gate offers. */
export function heldCurrency(accounts: readonly { currency: Currency }[], param: unknown): Currency | null {
  return isStorableCurrency(param) && accounts.some(account => account.currency === param) ? param : null;
}

/** The Reportes tab's own selection: the route's currency when held, otherwise the first
 * currency of the ledger (ARS in an empty ledger, decision 7.6.4). Drill-downs use
 * `strictReportSelection`, which refuses instead of falling back. */
export function reportSelection(snapshot: LedgerSnapshot, currencyParam: unknown, monthParam: unknown, day: string) {
  const currencies = availableCurrencies(snapshot.accounts);
  const currency = heldCurrency(snapshot.accounts, currencyParam) ?? currencies[0] ?? 'ARS';
  const currentMonth = day.slice(0, 7);
  const monthISO = typeof monthParam === 'string' && /^\d{4}-\d{2}$/.test(monthParam)
    && validDateISO(monthParam + '-01') && monthParam <= currentMonth ? monthParam : currentMonth;
  const accounts = new Set(snapshot.accounts.filter(account => account.currency === currency).map(account => account.id));
  const earliestMonth = snapshot.entries.reduce((earliest, entry) => accounts.has(entry.accountId) && entry.dateISO <= day
    && entry.dateISO.slice(0, 7) < earliest ? entry.dateISO.slice(0, 7) : earliest, currentMonth);
  return { currency, currencies, monthISO, earliestMonth, currentMonth };
}

/** A drill-down opened with a currency: null when the parameter is present but unknown,
 * malformed or not held, so the screen shows its invalid state instead of another
 * currency's figures. A link without a currency opens the ledger's first one, as the tab does. */
export function strictReportSelection(snapshot: LedgerSnapshot, currencyParam: unknown, monthParam: unknown, day: string): ReturnType<typeof reportSelection> | null {
  if (currencyParam !== undefined && !heldCurrency(snapshot.accounts, currencyParam)) return null;
  return reportSelection(snapshot, currencyParam, monthParam, day);
}

export function shiftReportMonth(monthISO: string, delta: -1 | 1): string {
  const [year, month] = monthISO.split('-').map(Number);
  const date = new Date(year, month - 1 + delta, 1, 12);
  return String(date.getFullYear()).padStart(4, '0') + '-' + String(date.getMonth() + 1).padStart(2, '0');
}

export function reportMonthLabel(monthISO: string, locale: AppLocale = DEFAULT_LOCALE): string {
  return formatMonth(monthISO, locale);
}

/** "Hasta hoy · ARS", "Mes completo · ARS" or "Del 1 al 12 · ARS": which days a report covers. `withCurrency` false
 * (Reportes' own header, 24UX5 review) leaves the code out where the chip and «Gastado · ARS» already name it; the
 * category detail keeps it, since nothing else on that line says the currency. */
export function reportPeriodLabel(period: ReportPeriod, day: string, t: Translate = translator('es'), withCurrency = true): string {
  const [year, month] = period.endISO.split('-').map(Number);
  const lastDay = new Date(year, month, 0, 12).getDate();
  const label = period.endISO === day ? t('reports.period.untilToday') : Number(period.endISO.slice(-2)) === lastDay
    ? t('reports.period.fullMonth') : t('reports.period.untilDay', { day: Number(period.endISO.slice(-2)) });
  return withCurrency ? label + ' · ' + period.currency : label;
}

/** Optional comparison cutoff must stay within the requested month and today. */
export function reportCutoff(monthISO: string, through: unknown, today: string): string | null {
  if (through === undefined) return today;
  return typeof through === 'string' && validDateISO(through) && through.slice(0, 7) === monthISO && through <= today ? through : null;
}

export function changePercent(delta: number, previous: number, locale: AppLocale = DEFAULT_LOCALE): string {
  if (!Number.isSafeInteger(delta) || !Number.isSafeInteger(previous) || previous <= 0) return '—';
  return formatPercent(Math.abs(delta) / previous, locale);
}

/** "1–12 de agosto de 2026": a comparison period from the first of its month. */
export function dateRangeLabel(period: ReportPeriod, t: Translate = translator('es'), locale: AppLocale = DEFAULT_LOCALE): string {
  const month = period.startISO.slice(0, 7);
  return t('reports.period.range', { day: Number(period.endISO.slice(-2)), month: formatMonth(month, locale, 'month'), year: month.slice(0, 4) });
}

export function spendingShare(amountMinor: number, totalMinor: number, locale: AppLocale = DEFAULT_LOCALE): { fraction: number; label: string } {
  if (!Number.isSafeInteger(amountMinor) || !Number.isSafeInteger(totalMinor)
    || amountMinor < 0 || totalMinor <= 0 || amountMinor > totalMinor) return { fraction: 0, label: '—' };
  // Divide before multiplying: cents remain exact; the ratio is display-only.
  const fraction = amountMinor / totalMinor;
  return { fraction, label: formatPercent(fraction, locale) };
}

/** Producto 24UX5: the insights Reportes shows under "Dónde más gastaste". "Tu mayor gasto fue X" is dropped when the
 * ranking right above already shows that same single purchase (a row for its merchant with one purchase): the name,
 * the amount and the category are on screen, so the card would repeat them. When the merchant has several purchases the
 * largest single one is an extra, checkable fact and stays. Budget warnings and growth facts always stay. */
export function insightsBesideRanking(insights: readonly SpendingInsight[], ranking: readonly Pick<MerchantSpending, 'key' | 'count'>[],
  entries: readonly Pick<Entry, 'id' | 'merchant'>[]): SpendingInsight[] {
  return insights.filter(insight => {
    if (!insight.id.startsWith('largest:')) return true;
    const entry = entries.find(item => item.id === insight.id.slice('largest:'.length));
    return !entry || !ranking.some(row => row.key === categoryKey(entry.merchant) && row.count === 1);
  });
}
