import { validDateISO, type Currency, type LedgerSnapshot } from './ledger.ts';
import { expensesInPeriod, reportPeriod, spendingReport, type ReportPeriod, type SpendingReport } from './spending-report.ts';

export interface DailySpending { dateISO: string; amountMinor: number; count: number }
export function dailySpending(snapshot: LedgerSnapshot, period: ReportPeriod): DailySpending[] {
  if (!validDateISO(period.startISO) || !validDateISO(period.endISO) || period.startISO > period.endISO) throw new Error('Período inválido.');
  const days = new Map<string, DailySpending>();
  let total = 0;
  for (const entry of expensesInPeriod(snapshot, period)) {
    total += entry.amountMinor;
    if (!Number.isSafeInteger(total)) throw new Error('El total supera el rango seguro.');
    const day = days.get(entry.dateISO);
    if (day) { day.amountMinor += entry.amountMinor; day.count++; }
    else days.set(entry.dateISO, { dateISO: entry.dateISO, amountMinor: entry.amountMinor, count: 1 });
  }
  // Missing days mean no recorded expenses, not proof of zero actual spending.
  return [...days.values()].sort((a, b) => b.dateISO.localeCompare(a.dateISO));
}
export interface CategoryChange {
  key: string; category: string; currentMinor: number; previousMinor: number; deltaMinor: number;
  currentCount: number; previousCount: number;
}
export interface SpendingComparison {
  current: SpendingReport;
  previous: SpendingReport | null;
  mode: 'matching-days' | 'full-months';
  capped: boolean;
  status: 'ready' | 'insufficient' | 'out-of-range';
  deltaMinor: number | null;
  categories: CategoryChange[];
}
export function spendingComparison(snapshot: LedgerSnapshot, currency: Currency, monthISO: string, asOfISO: string): SpendingComparison {
  const requested = reportPeriod(currency, monthISO, asOfISO);
  const [year, month] = monthISO.split('-').map(Number);
  const previousDate = new Date(year, month - 2, 1, 12);
  const previousMonth = `${previousDate.getFullYear()}-${String(previousDate.getMonth() + 1).padStart(2, '0')}`;
  const mode: SpendingComparison['mode'] = monthISO === asOfISO.slice(0, 7) ? 'matching-days' : 'full-months';
  const lastPreviousDay = new Date(year, month - 1, 0, 12).getDate();
  const elapsed = Number(requested.endISO.slice(-2));
  const comparisonDays = mode === 'matching-days' ? Math.min(elapsed, lastPreviousDay) : lastPreviousDay;
  const currentEnd = mode === 'matching-days' ? monthISO + '-' + String(comparisonDays).padStart(2, '0') : requested.endISO;
  const current = spendingReport(snapshot, currency, monthISO, currentEnd);
  const previous = validDateISO(previousMonth + '-01')
    ? spendingReport(snapshot, currency, previousMonth, previousMonth + '-' + String(comparisonDays).padStart(2, '0')) : null;
  const base = { current, previous, mode, capped: currentEnd !== requested.endISO };
  if (current.status !== 'ready' || (previous && previous.status !== 'ready')) return { ...base, status: 'out-of-range', deltaMinor: null, categories: [] };
  // With no recorded expenses on one side, never invent a percentage saving,
  // an infinite increase, or a claim that tracking covers the whole period.
  if (!previous || previous.status !== 'ready' || !current.categories.length || !previous.categories.length) {
    return { ...base, status: 'insufficient', deltaMinor: null, categories: [] };
  }
  const keys = new Set([...current.categories, ...previous.categories].map(c => c.key));
  const now = new Map(current.categories.map(c => [c.key, c]));
  const then = new Map(previous.categories.map(c => [c.key, c]));
  const categories = [...keys].map(key => {
    const a = now.get(key), b = then.get(key);
    return { key, category: a?.category ?? b!.category, currentMinor: a?.amountMinor ?? 0, previousMinor: b?.amountMinor ?? 0,
      deltaMinor: (a?.amountMinor ?? 0) - (b?.amountMinor ?? 0), currentCount: a?.count ?? 0, previousCount: b?.count ?? 0 };
  }).sort((a, b) => Math.abs(b.deltaMinor) - Math.abs(a.deltaMinor) || a.key.localeCompare(b.key));
  return { ...base, status: 'ready', deltaMinor: current.expenseMinor - previous.expenseMinor, categories };
}
