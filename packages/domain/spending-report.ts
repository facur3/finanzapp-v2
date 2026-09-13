import { validDateISO, type Currency, type Entry, type LedgerSnapshot } from './ledger.ts';
import { summarizeMonth, type MonthSummary } from './month-summary.ts';

// The chooser and reports share one identity rule. Keep original labels in
// storage; case, accents and extra spaces must not split a category's total.
export const categoryKey = (label: string) => label.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('es-AR').replace(/\s+/g, ' ').trim();

export interface ReportPeriod { currency: Currency; startISO: string; endISO: string }
export interface CategorySpending { key: string; category: string; amountMinor: number; count: number }
export type SpendingReport = MonthSummary & { categories: CategorySpending[] };

export function reportPeriod(currency: Currency, monthISO: string, asOfISO: string): ReportPeriod {
  if (!validDateISO(asOfISO) || !/^\d{4}-\d{2}$/.test(monthISO)
    || !validDateISO(monthISO + '-01') || monthISO > asOfISO.slice(0, 7)) {
    throw new Error('Período de reporte inválido.');
  }
  const [year, month] = monthISO.split('-').map(Number);
  const lastDay = new Date(year, month, 0, 12).getDate();
  return { currency, startISO: monthISO + '-01',
    endISO: monthISO === asOfISO.slice(0, 7) ? asOfISO : monthISO + '-' + String(lastDay).padStart(2, '0') };
}

// Both the chart and its drill-down use this exact scope. Filtering by a
// substring/search term would accidentally include similarly named categories.
export function expensesInPeriod(snapshot: LedgerSnapshot, period: ReportPeriod, key?: string): Entry[] {
  const accounts = new Set(snapshot.accounts.filter(account => account.currency === period.currency).map(account => account.id));
  return snapshot.entries.filter(entry => entry.kind === 'expense' && accounts.has(entry.accountId)
    && entry.dateISO >= period.startISO && entry.dateISO <= period.endISO
    && (key === undefined || categoryKey(entry.category) === key));
}

export function spendingReport(snapshot: LedgerSnapshot, currency: Currency, monthISO: string, asOfISO: string): SpendingReport {
  const period = reportPeriod(currency, monthISO, asOfISO);
  const summary = summarizeMonth(snapshot, currency, period.endISO);
  if (summary.status !== 'ready') return { ...summary, categories: [] };
  const groups = new Map<string, CategorySpending>();
  const expenses = expensesInPeriod(snapshot, period).sort((a, b) => b.dateISO.localeCompare(a.dateISO)
    || Date.parse(b.createdAt) - Date.parse(a.createdAt) || a.id.localeCompare(b.id));
  for (const entry of expenses) {
    const key = categoryKey(entry.category);
    const group = groups.get(key);
    // Positive amounts only, and summary already checked the full expense sum
    // for safe integer range. A subgroup cannot overflow independently of it.
    if (group) { group.amountMinor += entry.amountMinor; group.count++; }
    else groups.set(key, { key, category: entry.category.trim(), amountMinor: entry.amountMinor, count: 1 });
  }
  const categories = [...groups.values()].sort((a, b) => b.amountMinor - a.amountMinor || a.key.localeCompare(b.key, 'es-AR'));
  return { ...summary, categories };
}
