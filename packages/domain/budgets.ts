import { categoryKey } from './spending-report.ts';
import { accountIdsInCurrency, validDateISO, type Currency, type LedgerSnapshot } from './ledger.ts';
import { LEDGER_CURRENCIES, assertLedgerCurrency, assertStorableCurrency, type CurrencyGate } from './currency.ts';

/** A budget is a planning limit for one month and one currency. It never
 * changes what a movement is: expenses stay expenses, transfers stay
 * transfers, and a limit only says how much of the recorded spending was
 * planned for.
 *
 * Two scopes. A **total** budget is the ceiling for every recorded expense of
 * the month in that currency. A **category** budget is a sublimit inside it
 * for one normalised category. Sublimits never add up to a total: "Total
 * 500.000, Comida 150.000, Ocio 50.000" plans 500.000, not 700.000. A total
 * budget is not a category, so it carries no category string at all. */
export type BudgetScope = 'total' | 'category';

interface MonthlyBudgetBase {
  id: string;
  currency: Currency;
  monthISO: string;
  amountMinor: number;
  active: boolean;
  createdAt: string;
  revision: number;
  updatedAt: string;
}
export interface TotalMonthlyBudget extends MonthlyBudgetBase { scope: 'total'; category?: undefined }
export interface CategoryMonthlyBudget extends MonthlyBudgetBase { scope: 'category'; category: string }
export type MonthlyBudget = TotalMonthlyBudget | CategoryMonthlyBudget;

/** Where a limit stands: calm below the warning share, warning from that share
 * up to and including the limit, exceeded once spending passes it. One place
 * for the thresholds so every screen agrees. */
export const BUDGET_WARNING_RATIO = 0.85;
export type BudgetState = 'calm' | 'warning' | 'exceeded';
export function budgetState(progress: Pick<BudgetProgress, 'ratio' | 'exceeded'>): BudgetState {
  if (progress.exceeded) return 'exceeded';
  return progress.ratio >= BUDGET_WARNING_RATIO ? 'warning' : 'calm';
}

export interface BudgetProgress<B extends MonthlyBudget = MonthlyBudget> {
  budget: B;
  spentMinor: number;
  remainingMinor: number;
  ratio: number;
  exceeded: boolean;
}

export interface MonthlyBudgetSummary {
  currency: Currency;
  monthISO: string;
  /** The month's ceiling, measured against every recorded expense of the month, or null when none is active. */
  total: BudgetProgress<TotalMonthlyBudget> | null;
  /** Category sublimits, worst first. The sum of their limits is never the month's budget. */
  rows: BudgetProgress<CategoryMonthlyBudget>[];
  /** Sum of the category sublimits (not a total budget) and what those categories spent. */
  budgetedMinor: number;
  spentBudgetedMinor: number;
  remainingMinor: number;
  /** Every recorded expense of the month in this currency, budgeted or not. */
  totalSpentMinor: number;
  unbudgetedSpentMinor: number;
}

const BUDGET_KEYS = ['id', 'scope', 'category', 'currency', 'monthISO', 'amountMinor', 'active',
  'createdAt', 'revision', 'updatedAt'] as const;

function validId(value: string): boolean {
  return typeof value === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(value);
}
function validTimestamp(value: string): boolean {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}
export function validMonthISO(value: string): boolean {
  if (!/^\d{4}-\d{2}$/.test(value)) return false;
  return validDateISO(value + '-01');
}
export function currentMonthISO(dateISO: string): string {
  if (!validDateISO(dateISO)) throw new Error('Fecha inválida.');
  return dateISO.slice(0, 7);
}
export function shiftMonthISO(monthISO: string, amount: number): string {
  if (!validMonthISO(monthISO) || !Number.isInteger(amount)) throw new Error('Mes inválido.');
  const [year, month] = monthISO.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1 + amount, 1));
  return date.toISOString().slice(0, 7);
}
/** One active total per currency and month; one active sublimit per
 * normalised category, currency and month. */
export function budgetIdentityKey(budget: Pick<MonthlyBudget, 'currency' | 'monthISO' | 'scope' | 'category'>): string {
  return [budget.currency, budget.monthISO, budget.scope === 'total' ? 'total' : 'category:' + categoryKey(budget.category ?? '')].join('|');
}

/** Read acceptance for a stored budget: its currency must be a storable ISO fiat code (a budget
 * has no account, so its scale can only come from its code), never the creation gate. */
export function validateMonthlyBudget(budget: MonthlyBudget): void {
  if (!validId(budget.id)) throw new Error('Identificador de presupuesto inválido.');
  if (budget.scope !== 'total' && budget.scope !== 'category') throw new Error('Elegí un presupuesto general o por categoría.');
  if (budget.scope === 'category' && (typeof budget.category !== 'string' || !budget.category.trim() || budget.category.length > 60)) {
    throw new Error('Elegí una categoría de hasta 60 caracteres.');
  }
  if (budget.scope === 'total' && budget.category !== undefined) {
    throw new Error('Un presupuesto general no lleva categoría.');
  }
  assertStorableCurrency(budget.currency);
  if (!validMonthISO(budget.monthISO)) throw new Error('Elegí un mes válido.');
  if (!Number.isSafeInteger(budget.amountMinor) || budget.amountMinor <= 0) {
    throw new Error('El presupuesto debe ser mayor que cero y tener hasta dos decimales.');
  }
  if (typeof budget.active !== 'boolean' || !Number.isSafeInteger(budget.revision) || budget.revision < 0
    || !validTimestamp(budget.createdAt) || !validTimestamp(budget.updatedAt)) {
    throw new Error('Estado de presupuesto inválido.');
  }
  if (budget.revision === 0 && budget.updatedAt !== budget.createdAt) {
    throw new Error('Estado inicial de presupuesto inválido.');
  }
}

/** The creation gate on top of read acceptance: a **new** budget may only be planned in a
 * currency the gate offers (it needs no account in that currency, decision 7.6.3). */
export function validateNewMonthlyBudget(budget: MonthlyBudget, gate: CurrencyGate = LEDGER_CURRENCIES): void {
  validateMonthlyBudget(budget);
  assertLedgerCurrency(budget.currency, gate);
}

export function validateBudgetCollection(budgets: MonthlyBudget[]): void {
  const ids = new Set<string>();
  const activeKeys = new Set<string>();
  for (const budget of budgets) {
    validateMonthlyBudget(budget);
    if (ids.has(budget.id)) throw new Error('La copia repite un presupuesto.');
    ids.add(budget.id);
    if (!budget.active) continue;
    const key = budgetIdentityKey(budget);
    if (activeKeys.has(key)) {
      throw new Error(budget.scope === 'total' ? 'Ya existe un presupuesto general activo para esa moneda y mes.'
        : 'Ya existe un presupuesto activo para esa categoría, moneda y mes.');
    }
    activeKeys.add(key);
  }
}

export function sameMonthlyBudget(a: MonthlyBudget, b: MonthlyBudget): boolean {
  return BUDGET_KEYS.every(key => a[key] === b[key]);
}

/** A legacy record (schema 5/6 rows and v5/v6 backups, which had no scope)
 * is always a category budget; scoped records pass through unchanged. */
export function scopedMonthlyBudget(value: MonthlyBudgetBase & { scope?: BudgetScope; category?: string | null }): MonthlyBudget {
  const { scope, category, ...base } = value;
  if (scope === 'total') return { ...base, scope: 'total' };
  return { ...base, scope: 'category', category: category ?? '' };
}

function safeNumber(value: bigint): number {
  if (value > BigInt(Number.MAX_SAFE_INTEGER) || value < -BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error('El presupuesto supera el rango seguro.');
  }
  return Number(value);
}

export function summarizeMonthlyBudgets(snapshot: LedgerSnapshot, budgets: MonthlyBudget[], currency: Currency, monthISO: string): MonthlyBudgetSummary {
  // A view checks the code's shape (storable), never the gate: a stored budget in a currency no
  // longer offered still summarises. The currency has its own error, apart from the month's.
  assertStorableCurrency(currency);
  if (!validMonthISO(monthISO)) throw new Error('Período de presupuesto inválido.');
  validateBudgetCollection(budgets);
  const active = budgets.filter(budget => budget.active && budget.currency === currency && budget.monthISO === monthISO);
  const accountIds = accountIdsInCurrency(snapshot.accounts, currency);
  const spentByCategory = new Map<string, bigint>();
  let totalSpent = 0n;
  for (const entry of snapshot.entries) {
    if (entry.kind !== 'expense' || !accountIds.has(entry.accountId) || entry.dateISO.slice(0, 7) !== monthISO) continue;
    const amount = BigInt(entry.amountMinor);
    totalSpent += amount;
    const key = categoryKey(entry.category);
    spentByCategory.set(key, (spentByCategory.get(key) ?? 0n) + amount);
  }

  const progress = <B extends MonthlyBudget>(budget: B, spent: bigint): BudgetProgress<B> => {
    const limit = BigInt(budget.amountMinor);
    const spentMinor = safeNumber(spent);
    return {
      budget,
      spentMinor,
      remainingMinor: safeNumber(limit - spent),
      ratio: budget.amountMinor > 0 ? Math.max(0, spentMinor / budget.amountMinor) : 0,
      exceeded: spent > limit,
    };
  };
  // The total is measured against every expense of the month; the collection
  // validator above guarantees at most one active total per currency and month.
  const totalBudget = active.find((budget): budget is TotalMonthlyBudget => budget.scope === 'total') ?? null;
  const total = totalBudget ? progress(totalBudget, totalSpent) : null;

  let budgeted = 0n, spentBudgeted = 0n;
  const rows = active.filter((budget): budget is CategoryMonthlyBudget => budget.scope === 'category').map(budget => {
    const spent = spentByCategory.get(categoryKey(budget.category)) ?? 0n;
    budgeted += BigInt(budget.amountMinor);
    spentBudgeted += spent;
    return progress(budget, spent);
  }).sort((a, b) => Number(b.exceeded) - Number(a.exceeded)
    || b.ratio - a.ratio || categoryKey(a.budget.category).localeCompare(categoryKey(b.budget.category), 'es-AR'));

  const budgetedMinor = safeNumber(budgeted);
  const spentBudgetedMinor = safeNumber(spentBudgeted);
  const totalSpentMinor = safeNumber(totalSpent);
  return {
    currency,
    monthISO,
    total,
    budgetedMinor,
    spentBudgetedMinor,
    remainingMinor: safeNumber(budgeted - spentBudgeted),
    totalSpentMinor,
    unbudgetedSpentMinor: safeNumber(totalSpent - spentBudgeted),
    rows,
  };
}
