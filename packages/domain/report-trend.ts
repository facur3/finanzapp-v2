import { validDateISO, type Currency, type Entry, type LedgerSnapshot } from './ledger.ts';
import { categoryKey, expensesInPeriod, reportPeriod, type ReportPeriod } from './spending-report.ts';
import { budgetState, shiftMonthISO, summarizeMonthlyBudgets, type MonthlyBudget } from './budgets.ts';
import { spendingComparison } from './report-insights.ts';
import { addMoney, moneyAmount, sumMoney } from './money.ts';
import { isPurchaseLine } from './operations.ts';
import { installmentOccurrenceOf } from './installments.ts';

export interface MonthlyTrendPoint {
  monthISO: string;
  amountMinor: number;
  count: number;
  /** True for the current month, which only covers dates through today. */
  partial: boolean;
}

/** Recorded expenses per calendar month for the `months` months ending at
 * `monthISO`. Past months are complete; the month of `asOfISO` stops today. A
 * month without records is zero recorded, not proof of zero spending.
 * 24T3: `amountMinor` is the month's signed net (a devolución nets in its own
 * month, so a point may be ≤ 0); `count` is its purchase lines (A23), the
 * measure of "a month with records", never `amountMinor > 0`. */
export function monthlySpendingTrend(snapshot: LedgerSnapshot, currency: Currency, monthISO: string, asOfISO: string, months = 6): MonthlyTrendPoint[] {
  if (!Number.isInteger(months) || months < 1 || months > 24) throw new Error('Cantidad de meses inválida.');
  const points: MonthlyTrendPoint[] = [];
  for (let offset = months - 1; offset >= 0; offset--) {
    const month = shiftMonthISO(monthISO, -offset);
    const period = reportPeriod(currency, month, asOfISO);
    const expenses = expensesInPeriod(snapshot, period);
    points.push({ monthISO: month, amountMinor: sumMoney(expenses.map(entry => moneyAmount(entry.amountMinor, currency)), currency).minor, count: expenses.filter(isPurchaseLine).length,
      partial: month === asOfISO.slice(0, 7) });
  }
  return points;
}

export interface MerchantSpending { key: string; merchant: string; amountMinor: number; count: number; category: string }

/** Largest merchants of a period by recorded amount. Identity ignores case,
 * accents and spacing like categories do; the stored text is not rewritten.
 * 24T3 (A24): a devolución nets against its merchant (its line carries the
 * purchase's merchant), then a merchant whose net is ≤ 0 is dropped, before
 * the limit; `count` is the merchant's purchase lines (A23). */
export function topMerchants(snapshot: LedgerSnapshot, period: ReportPeriod, limit = 5): MerchantSpending[] {
  if (!Number.isInteger(limit) || limit < 1) throw new Error('Límite inválido.');
  const groups = new Map<string, MerchantSpending & { categories: Map<string, number> }>();
  const expenses = expensesInPeriod(snapshot, period);
  for (const entry of expenses) {
    const key = categoryKey(entry.merchant);
    const group = groups.get(key) ?? { key, merchant: entry.merchant.trim(), amountMinor: 0, count: 0, category: entry.category, categories: new Map() };
    group.amountMinor = addMoney(moneyAmount(group.amountMinor, period.currency), moneyAmount(entry.amountMinor, period.currency)).minor;
    if (isPurchaseLine(entry)) group.count++;
    group.categories.set(categoryKey(entry.category), (group.categories.get(categoryKey(entry.category)) ?? 0) + entry.amountMinor);
    groups.set(key, group);
  }
  return [...groups.values()].filter(group => group.amountMinor > 0).map(group => {
    // Name the merchant's dominant (net) category, without inventing one.
    const [category] = [...group.categories.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
    const label = expenses.find(entry => categoryKey(entry.merchant) === group.key && categoryKey(entry.category) === category)?.category ?? group.category;
    return { key: group.key, merchant: group.merchant, amountMinor: group.amountMinor, count: group.count, category: label.trim() };
  }).sort((a, b) => b.amountMinor - a.amountMinor || a.key.localeCompare(b.key, 'es-AR')).slice(0, limit);
}

/** Whole-day average of recorded spending over the elapsed days of the period.
 * 24T3: a net ≤ 0 (devoluciones that outweigh the period's purchases) has no
 * spending to average and gives 0, never a negative average and never a throw;
 * the net itself is the figure a screen shows. */
export function dailyAverageMinor(expenseMinor: number, period: ReportPeriod): number {
  if (!validDateISO(period.startISO) || !validDateISO(period.endISO) || period.startISO > period.endISO) throw new Error('Período inválido.');
  const days = Math.round((Date.parse(period.endISO) - Date.parse(period.startISO)) / 86400000) + 1;
  if (!Number.isSafeInteger(expenseMinor)) throw new Error('Monto inválido.');
  if (expenseMinor <= 0) return 0;
  return Math.floor(expenseMinor / days);
}

export interface SpendingInsight {
  id: string;
  title: string;
  detail: string;
  tone: 'neutral' | 'warning' | 'expense' | 'income';
  category?: string;
  /** 24T3: on «largest», the amount the fact states: the purchase line net of its devoluciones (never the gross line). */
  amountMinor?: number;
}

/** The plan a principal line recognises: an instalment's principal record (`inst_<plan>_<n>`) or an adelanto's principal
 * line. Undefined for anything else (financing, an ordinary purchase, a devolución). */
function principalPlanOf(entry: Entry): string | undefined {
  if (entry.payoff) return entry.payoff.component === 'principal' ? entry.payoff.planId : undefined;
  const occurrence = installmentOccurrenceOf(entry.id);
  return occurrence?.component === 'principal' ? occurrence.planId : undefined;
}

/** Facts, not advice: over-budget categories, the largest recorded expense and
 * the category that grew most against the same elapsed days of last month.
 * 24T3 (A24): «Tu mayor gasto» is the purchase line (`isPurchaseLine`: never a
 * devolución, an adelanto through its principal line) with the largest amount
 * net of its live devoluciones dated up to the period's end (the same lines the
 * period's figures net); a purchase whose net is ≤ 0 is never named. A plan
 * devolución credits the plan, not one instalment (B2: it reverses principal
 * already recognised), so a plan's principal line (an instalment's or an
 * adelanto's) counts at most what is left of the plan's recognised principal
 * net of its credits dated up to the period's end. */
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
  const refunded = new Map<string, bigint>();
  for (const entry of snapshot.entries) {
    const target = entry.kind === 'expense' ? entry.refund?.targetEntryId : undefined;
    if (target !== undefined && entry.dateISO <= period.endISO) refunded.set(target, (refunded.get(target) ?? 0n) - BigInt(entry.amountMinor));
  }
  const planLeft = new Map<string, bigint>();
  for (const entry of snapshot.entries) {
    const planId = entry.kind === 'expense' && entry.dateISO <= period.endISO ? entry.refund?.targetPlanId ?? principalPlanOf(entry) : undefined;
    if (planId !== undefined) planLeft.set(planId, (planLeft.get(planId) ?? 0n) + BigInt(entry.amountMinor));
  }
  let largest: { entry: Entry; netMinor: number } | null = null;
  for (const entry of expensesInPeriod(snapshot, period)) {
    if (!isPurchaseLine(entry)) continue;
    let net = BigInt(entry.amountMinor) - (refunded.get(entry.id) ?? 0n);
    const planId = principalPlanOf(entry);
    if (planId !== undefined && (planLeft.get(planId) ?? 0n) < net) net = planLeft.get(planId) ?? 0n;
    if (net > 0n && (!largest || net > BigInt(largest.netMinor))) largest = { entry, netMinor: Number(net) };
  }
  if (largest) {
    const { entry, netMinor } = largest;
    insights.push({ id: 'largest:' + entry.id, category: entry.category, tone: 'neutral', amountMinor: netMinor,
      title: `Tu mayor gasto fue ${entry.merchant}`, detail: `${format(netMinor)} · ${entry.category} · ${entry.dateISO.slice(8, 10).replace(/^0/, '')}/${entry.dateISO.slice(5, 7)}` });
  }
  try {
    const comparison = spendingComparison(snapshot, currency, monthISO, asOfISO);
    if (comparison.status === 'ready') {
      // 24T3 (A24): a category whose previous net is below zero (a devolución outweighed that month's purchases) is
      // never claimed as growth: «Ropa subió $ 350» for $ 50 spent would read as spending that never happened.
      const growth = comparison.categories.filter(item => item.deltaMinor > 0 && item.previousMinor >= 0).sort((a, b) => b.deltaMinor - a.deltaMinor)[0];
      if (growth) {
        insights.push({ id: 'growth:' + growth.key, category: growth.category, tone: 'neutral',
          title: `${growth.category} subió ${format(growth.deltaMinor)}`,
          detail: comparison.mode === 'matching-days' ? 'Frente a los mismos días del mes anterior' : 'Frente al mes anterior completo' });
      }
    }
  } catch { /* A comparison that cannot be computed adds no insight. */ }
  return insights.slice(0, 4);
}
