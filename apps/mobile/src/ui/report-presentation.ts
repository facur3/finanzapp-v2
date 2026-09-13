import { validDateISO, type Currency, type LedgerSnapshot, type ReportPeriod } from '@finanzapp/domain';
import { availableCurrencies } from './presentation.ts';

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

export function reportMonthLabel(monthISO: string): string {
  return new Date(monthISO + '-01T12:00:00').toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
}

export function reportPeriodLabel(period: ReportPeriod, day: string): string {
  return (period.endISO === day ? 'Hasta hoy' : 'Mes completo') + ' · ' + period.currency;
}

export function spendingShare(amountMinor: number, totalMinor: number): { fraction: number; label: string } {
  if (!Number.isSafeInteger(amountMinor) || !Number.isSafeInteger(totalMinor)
    || amountMinor < 0 || totalMinor <= 0 || amountMinor > totalMinor) return { fraction: 0, label: '—' };
  // Divide before multiplying: cents remain exact; the ratio is display-only.
  const fraction = amountMinor / totalMinor;
  const label = fraction > 0 && fraction < 0.001 ? '<0,1 %'
    : (fraction * 100).toLocaleString('es-AR', { maximumFractionDigits: 1 }) + ' %';
  return { fraction, label };
}
