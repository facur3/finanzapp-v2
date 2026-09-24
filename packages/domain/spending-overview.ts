import { accountIdsInCurrency, validDateISO, type Currency, type LedgerSnapshot } from './ledger.ts';
import { assertStorableCurrency } from './currency.ts';
import { categoryKey, type CategorySpending, type ReportPeriod } from './spending-report.ts';

export type SpendingWindow = 'month' | 'week';
export interface SpendingBucket extends ReportPeriod { amountMinor: number; count: number }
export type SpendingOverview = ReportPeriod & {
  categories: CategorySpending[]; buckets: SpendingBucket[];
} & ({ status: 'ready'; expenseMinor: number; incomeMinor: number; expenseCount: number }
  | { status: 'out-of-range' });

export function spendingWindow(currency: Currency, window: SpendingWindow, today: string): ReportPeriod {
  assertStorableCurrency(currency);
  if (!validDateISO(today) || !['month', 'week'].includes(window)) throw new Error('Período inválido.');
  const date = new Date(today + 'T12:00:00Z');
  if (window === 'month') date.setUTCDate(1);
  else date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
  return { currency, startISO: date.toISOString().slice(0, 10), endISO: today };
}

/** Recorded flow only. No bank balance, portfolio, transfer or inferred spending. */
export function spendingOverview(snapshot: LedgerSnapshot, period: ReportPeriod): SpendingOverview {
  // The currency is checked by its shape (a storable code, its own error), never by the gate.
  assertStorableCurrency(period.currency);
  if (!validDateISO(period.startISO) || !validDateISO(period.endISO) || period.startISO > period.endISO) throw new Error('Período inválido.');
  const dayCount = Math.round((Date.parse(period.endISO) - Date.parse(period.startISO)) / 86400000) + 1;
  if (dayCount > 31) throw new Error('Elegí un período de hasta 31 días.');
  const size = dayCount <= 7 ? 1 : 7;
  const buckets: SpendingBucket[] = [];
  for (let offset = 0; offset < dayCount; offset += size) {
    const start = new Date(Date.parse(period.startISO) + offset * 86400000).toISOString().slice(0, 10);
    const end = new Date(Date.parse(period.startISO) + Math.min(offset + size - 1, dayCount - 1) * 86400000).toISOString().slice(0, 10);
    buckets.push({ currency: period.currency, startISO: start, endISO: end, amountMinor: 0, count: 0 });
  }
  const accountIds = accountIdsInCurrency(snapshot.accounts, period.currency);
  const groups = new Map<string, CategorySpending>();
  let expenseMinor = 0, incomeMinor = 0, expenseCount = 0;
  for (const entry of snapshot.entries) {
    if (!accountIds.has(entry.accountId) || entry.dateISO < period.startISO || entry.dateISO > period.endISO) continue;
    if (entry.kind === 'income') incomeMinor += entry.amountMinor;
    else {
      expenseMinor += entry.amountMinor;
      expenseCount++;
      const key = categoryKey(entry.category);
      const group = groups.get(key) ?? { key, category: entry.category.trim(), count: 0, amountMinor: 0 };
      group.amountMinor += entry.amountMinor; group.count++;
      groups.set(key, group);
      const bucket = buckets.find(b => entry.dateISO >= b.startISO && entry.dateISO <= b.endISO)!;
      bucket.amountMinor += entry.amountMinor; bucket.count++;
    }
    if (!Number.isSafeInteger(expenseMinor) || !Number.isSafeInteger(incomeMinor)) {
      return { ...period, status: 'out-of-range', categories: [], buckets: [] };
    }
  }
  return { ...period, status: 'ready', expenseMinor, incomeMinor, expenseCount, buckets,
    categories: [...groups.values()].sort((a, b) => b.amountMinor - a.amountMinor || a.key.localeCompare(b.key, 'es-AR')) };
}
