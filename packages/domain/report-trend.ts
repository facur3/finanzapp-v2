import { validDateISO, type Currency, type LedgerSnapshot } from './ledger.ts';
import { categoryKey, expensesInPeriod, reportPeriod, type ReportPeriod } from './spending-report.ts';
import { budgetState, shiftMonthISO, summarizeMonthlyBudgets, type MonthlyBudget } from './budgets.ts';
import { spendingComparison } from './report-insights.ts';
import { addMoney, moneyAmount, sumMoney } from './money.ts';

export interface MonthlyTrendPoint {
  monthISO: string;
  amountMinor: number;
  count: number;
  /** True for the current month, which only covers dates through today. */
  partial: boolean;
}

/** Recorded expenses per calendar month for the `months` months ending at
 * `monthISO`. Past months are complete; the month of `asOfISO` stops today. A
 * month without records is zero recorded, not proof of zero spending. */
export function monthlySpendingTrend(snapshot: LedgerSnapshot, currency: Currency, monthISO: string, asOfISO: string, months = 6): MonthlyTrendPoint[] {
  if (!Number.isInteger(months) || months < 1 || months > 24) throw new Error('Cantidad de meses inválida.');
  const points: MonthlyTrendPoint[] = [];
  for (let offset = months - 1; offset >= 0; offset--) {
    const month = shiftMonthISO(monthISO, -offset);
    const period = reportPeriod(currency, month, asOfISO);
    const expenses = expensesInPeriod(snapshot, period);
    points.push({ monthISO: month, amountMinor: sumMoney(expenses.map(entry => moneyAmount(entry.amountMinor, currency)), currency).minor, count: expenses.length,
      partial: month === asOfISO.slice(0, 7) });
  }
  return points;
}

export interface MerchantSpending { key: string; merchant: string; amountMinor: number; count: number; category: string }

/** Largest merchants of a period by recorded amount. Identity ignores case,
 * accents and spacing like categories do; the stored text is not rewritten. */
export function topMerchants(snapshot: LedgerSnapshot, period: ReportPeriod, limit = 5): MerchantSpending[] {
  if (!Number.isInteger(limit) || limit < 1) throw new Error('Límite inválido.');
  const groups = new Map<string, MerchantSpending & { categories: Map<string, number> }>();
  for (const entry of expensesInPeriod(snapshot, period)) {
    const key = categoryKey(entry.merchant);
    const group = groups.get(key) ?? { key, merchant: entry.merchant.trim(), amountMinor: 0, count: 0, category: entry.category, categories: new Map() };
    group.amountMinor = addMoney(moneyAmount(group.amountMinor, period.currency), moneyAmount(entry.amountMinor, period.currency)).minor;
    group.count++;
    group.categories.set(categoryKey(entry.category), (group.categories.get(categoryKey(entry.category)) ?? 0) + entry.amountMinor);
    groups.set(key, group);
  }
  return [...groups.values()].map(group => {
    // Name the merchant's dominant category, without inventing one.
    const [category] = [...group.categories.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
    const label = expensesInPeriod(snapshot, period).find(entry => categoryKey(entry.merchant) === group.key && categoryKey(entry.category) === category)?.category ?? group.category;
    return { key: group.key, merchant: group.merchant, amountMinor: group.amountMinor, count: group.count, category: label.trim() };
  }).sort((a, b) => b.amountMinor - a.amountMinor || a.key.localeCompare(b.key, 'es-AR')).slice(0, limit);
}

/** Whole-day average of recorded spending over the elapsed days of the period. */
export function dailyAverageMinor(expenseMinor: number, period: ReportPeriod): number {
  if (!validDateISO(period.startISO) || !validDateISO(period.endISO) || period.startISO > period.endISO) throw new Error('Período inválido.');
  const days = Math.round((Date.parse(period.endISO) - Date.parse(period.startISO)) / 86400000) + 1;
  if (!Number.isSafeInteger(expenseMinor) || expenseMinor < 0) throw new Error('Monto inválido.');
  return Math.floor(expenseMinor / days);
}

export interface SpendingInsight {
  id: string;
  title: string;
  detail: string;
  tone: 'neutral' | 'warning' | 'expense' | 'income';
  category?: string;
}

/** Facts, not advice: over-budget categories, the largest recorded expense and
 * the category that grew most against the same elapsed days of last month. */
export function spendingInsights(snapshot: LedgerSnapshot, budgets: MonthlyBudget[], currency: Currency, monthISO: string, asOfISO: string,
  format: (minor: number) => string): SpendingInsight[] {
  const insights: SpendingInsight[] = [];
  const period = reportPeriod(currency, monthISO, asOfISO);
  let summary: ReturnType<typeof summarizeMonthlyBudgets> | null = null;
  try { summary = summarizeMonthlyBudgets(snapshot, budgets, currency, monthISO); } catch { summary = null; }
  // The month's ceiling first, then category sublimits. Same thresholds as every screen.
  const total = summary?.total;
  if (total && budgetState(total) === 'exceeded') {
    insights.push({ id: 'over:' + total.budget.id, tone: 'expense',
      title: 'Superaste tu presupuesto general', detail: `${format(-total.remainingMinor)} por encima de ${format(total.budget.amountMinor)}` });
  } else if (total && budgetState(total) === 'warning') {
    insights.push({ id: 'near:' + total.budget.id, tone: 'warning',
      title: 'Estás cerca de tu presupuesto general', detail: `Quedan ${format(total.remainingMinor)} de ${format(total.budget.amountMinor)}` });
  }
  for (const row of summary?.rows ?? []) {
    const state = budgetState(row);
    if (state === 'exceeded') {
      insights.push({ id: 'over:' + row.budget.id, category: row.budget.category, tone: 'expense',
        title: `${row.budget.category} superó su presupuesto`, detail: `${format(-row.remainingMinor)} por encima de ${format(row.budget.amountMinor)}` });
    } else if (state === 'warning') {
      insights.push({ id: 'near:' + row.budget.id, category: row.budget.category, tone: 'warning',
        title: `${row.budget.category} está cerca del límite`, detail: `Quedan ${format(row.remainingMinor)} de ${format(row.budget.amountMinor)}` });
    }
  }
  const expenses = expensesInPeriod(snapshot, period);
  const largest = expenses.reduce<typeof expenses[number] | null>((best, entry) => !best || entry.amountMinor > best.amountMinor ? entry : best, null);
  if (largest) {
    insights.push({ id: 'largest:' + largest.id, category: largest.category, tone: 'neutral',
      title: `Tu mayor gasto fue ${largest.merchant}`, detail: `${format(largest.amountMinor)} · ${largest.category} · ${largest.dateISO.slice(8, 10).replace(/^0/, '')}/${largest.dateISO.slice(5, 7)}` });
  }
  try {
    const comparison = spendingComparison(snapshot, currency, monthISO, asOfISO);
    if (comparison.status === 'ready') {
      const growth = comparison.categories.filter(item => item.deltaMinor > 0).sort((a, b) => b.deltaMinor - a.deltaMinor)[0];
      if (growth) {
        insights.push({ id: 'growth:' + growth.key, category: growth.category, tone: 'neutral',
          title: `${growth.category} subió ${format(growth.deltaMinor)}`,
          detail: comparison.mode === 'matching-days' ? 'Frente a los mismos días del mes anterior' : 'Frente al mes anterior completo' });
      }
    }
  } catch { /* A comparison that cannot be computed adds no insight. */ }
  return insights.slice(0, 4);
}
