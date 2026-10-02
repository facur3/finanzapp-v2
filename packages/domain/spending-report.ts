import { accountIdsInCurrency, validDateISO, type Currency, type Entry, type LedgerSnapshot } from './ledger.ts';
import { summarizeMonth, type MonthSummary } from './month-summary.ts';
import { assertStorableCurrency } from './currency.ts';
import { isPurchaseLine } from './operations.ts';

// The chooser and reports share one identity rule. Keep original labels in
// storage; case, accents and extra spaces must not split a category's total.
export const categoryKey = (label: string) => label.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('es-AR').replace(/\s+/g, ' ').trim();

export interface ReportPeriod { currency: Currency; startISO: string; endISO: string }
/** `amountMinor` is the category's signed net: a devolución (24T3) is a negative expense line that nets in its own month
 * and category, so a category can be ≤ 0 (listed, never drawn as a slice). `count` is its purchase lines (`isPurchaseLine`,
 * A23): a devolución adds none and an adelanto adds one, so a category made only of devoluciones has count 0. */
export interface CategorySpending { key: string; category: string; amountMinor: number; count: number }
export type SpendingReport = MonthSummary & { categories: CategorySpending[] };

export function reportPeriod(currency: Currency, monthISO: string, asOfISO: string): ReportPeriod {
  assertStorableCurrency(currency);
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
// Every expense line is in scope, the projected ones too (a devolución's
// negative line, an adelanto's components), so a drill-down's rows add up to
// its header; counts are taken with `isPurchaseLine`, never `.length`.
export function expensesInPeriod(snapshot: LedgerSnapshot, period: ReportPeriod, key?: string): Entry[] {
  const accounts = accountIdsInCurrency(snapshot.accounts, period.currency);
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
    // Signed lines (24T3): a devolución is negative. `summarizeMonth` already
    // checked Σ|line| of these very lines for the safe range, and that bounds
    // every subgroup's sum whatever the signs or the order, so a category
    // cannot overflow on its own.
    const purchase = isPurchaseLine(entry) ? 1 : 0;
    if (group) { group.amountMinor += entry.amountMinor; group.count += purchase; }
    else groups.set(key, { key, category: entry.category.trim(), amountMinor: entry.amountMinor, count: purchase });
  }
  const categories = [...groups.values()].sort((a, b) => b.amountMinor - a.amountMinor || a.key.localeCompare(b.key, 'es-AR'));
  return { ...summary, categories };
}

/** 24T3: a devolución's projected line (a negative expense). It is not a purchase and never an income. */
export function isRefundLine(entry: Entry): boolean {
  return entry.kind === 'expense' && entry.refund !== undefined;
}

/** A period's spending as additive, non-negative facts (A25), for evidence that must never carry a negative number
 * (the Assistant's contract v1 refuses one). Spending is split instead of netted:
 * - `grossPurchasesMinor`: every expense line that is not a devolución (purchases, instalments and an adelanto's
 *   components), `purchaseCount` its purchase lines (`isPurchaseLine`: an adelanto counts once);
 * - `refundsMinor`: the devoluciones of the period as a positive amount, `refundCount` their lines;
 * - `categories`: gross per category, only those > 0, largest first, named by the most recent spelling of its lines;
 * - `incomeMinor`/`incomeCount`: incomes, counted directly (never derived by subtraction).
 * The net is never a fact: `grossPurchasesMinor − refundsMinor` equals the `spendingReport` `expenseMinor` of the same
 * period. `out-of-range` when a sum leaves the safe integer range. */
export type SpendingFacts = ReportPeriod & ({
  status: 'ready';
  grossPurchasesMinor: number; purchaseCount: number;
  refundsMinor: number; refundCount: number;
  incomeMinor: number; incomeCount: number;
  categories: CategorySpending[];
} | { status: 'out-of-range' });

export function spendingFacts(snapshot: LedgerSnapshot, period: ReportPeriod): SpendingFacts {
  assertStorableCurrency(period.currency);
  if (!validDateISO(period.startISO) || !validDateISO(period.endISO) || period.startISO > period.endISO) throw new Error('Período inválido.');
  const scope = { currency: period.currency, startISO: period.startISO, endISO: period.endISO };
  const accounts = accountIdsInCurrency(snapshot.accounts, period.currency);
  const lines = snapshot.entries.filter(entry => accounts.has(entry.accountId) && entry.dateISO >= period.startISO && entry.dateISO <= period.endISO)
    .sort((a, b) => b.dateISO.localeCompare(a.dateISO) || Date.parse(b.createdAt) - Date.parse(a.createdAt) || a.id.localeCompare(b.id));
  let gross = 0n, refunds = 0n, income = 0n, purchaseCount = 0, refundCount = 0, incomeCount = 0;
  const groups = new Map<string, { key: string; category: string; amount: bigint; count: number }>();
  for (const entry of lines) {
    const amount = BigInt(entry.amountMinor);
    if (entry.kind === 'income') { income += amount; incomeCount++; continue; }
    if (isRefundLine(entry)) { refunds -= amount; refundCount++; continue; }
    gross += amount;
    const purchase = isPurchaseLine(entry) ? 1 : 0;
    purchaseCount += purchase;
    const key = categoryKey(entry.category);
    const group = groups.get(key);
    if (group) { group.amount += amount; group.count += purchase; }
    else groups.set(key, { key, category: entry.category.trim(), amount, count: purchase });
  }
  const safe = (value: bigint) => value >= 0n && value <= BigInt(Number.MAX_SAFE_INTEGER);
  if (!safe(gross) || !safe(refunds) || !safe(income)) return { ...scope, status: 'out-of-range' };
  const categories = [...groups.values()].filter(group => group.amount > 0n)
    .map(group => ({ key: group.key, category: group.category, amountMinor: Number(group.amount), count: group.count }))
    .sort((a, b) => b.amountMinor - a.amountMinor || a.key.localeCompare(b.key, 'es-AR'));
  return { ...scope, status: 'ready', grossPurchasesMinor: Number(gross), purchaseCount, refundsMinor: Number(refunds), refundCount,
    incomeMinor: Number(income), incomeCount, categories };
}
