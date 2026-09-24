import { validDateISO, type Currency, type LedgerSnapshot, type ReportPeriod } from '@finanzapp/domain';
import { availableCurrencies } from './presentation.ts';
import { formatMonth, formatPercent } from '../i18n/format.ts';
import { DEFAULT_LOCALE, type AppLocale } from '../i18n/locale.ts';
import { translator, type Translate } from '../i18n/messages.ts';

export function reportSelection(snapshot: LedgerSnapshot, currencyParam: unknown, monthParam: unknown, day: string) {
  const currencies = availableCurrencies(snapshot.accounts);
  const currency = currencies.includes(currencyParam as Currency) ? currencyParam as Currency : currencies[0] ?? 'ARS';
  const currentMonth = day.slice(0, 7);
  const monthISO = typeof monthParam === 'string' && /^\d{4}-\d{2}$/.test(monthParam)
    && validDateISO(monthParam + '-01') && monthParam <= currentMonth ? monthParam : currentMonth;
  const accounts = new Set(snapshot.accounts.filter(account => account.currency === currency).map(account => account.id));
  const earliestMonth = snapshot.entries.reduce((earliest, entry) => accounts.has(entry.accountId) && entry.dateISO <= day
    && entry.dateISO.slice(0, 7) < earliest ? entry.dateISO.slice(0, 7) : earliest, currentMonth);
  return { currency, currencies, monthISO, earliestMonth, currentMonth };
}

export function shiftReportMonth(monthISO: string, delta: -1 | 1): string {
  const [year, month] = monthISO.split('-').map(Number);
  const date = new Date(year, month - 1 + delta, 1, 12);
  return String(date.getFullYear()).padStart(4, '0') + '-' + String(date.getMonth() + 1).padStart(2, '0');
}

export function reportMonthLabel(monthISO: string, locale: AppLocale = DEFAULT_LOCALE): string {
  return formatMonth(monthISO, locale);
}

/** "Hasta hoy · ARS", "Mes completo · ARS" or "Del 1 al 12 · ARS": which days a report covers. */
export function reportPeriodLabel(period: ReportPeriod, day: string, t: Translate = translator('es')): string {
  const [year, month] = period.endISO.split('-').map(Number);
  const lastDay = new Date(year, month, 0, 12).getDate();
  const label = period.endISO === day ? t('reports.period.untilToday') : Number(period.endISO.slice(-2)) === lastDay
    ? t('reports.period.fullMonth') : t('reports.period.untilDay', { day: Number(period.endISO.slice(-2)) });
  return label + ' · ' + period.currency;
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
