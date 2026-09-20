import { categoryKey } from './spending-report.ts';
import { validDateISO, type Currency, type LedgerSnapshot } from './ledger.ts';

export interface MonthlyBudget {
  id: string;
  category: string;
  currency: Currency;
  monthISO: string;
  amountMinor: number;
  active: boolean;
  createdAt: string;
  revision: number;
  updatedAt: string;
}

export interface BudgetProgress {
  budget: MonthlyBudget;
  spentMinor: number;
  remainingMinor: number;
  ratio: number;
  exceeded: boolean;
}

export interface MonthlyBudgetSummary {
  currency: Currency;
  monthISO: string;
  budgetedMinor: number;
  spentBudgetedMinor: number;
  remainingMinor: number;
  totalSpentMinor: number;
  unbudgetedSpentMinor: number;
  rows: BudgetProgress[];
}

const BUDGET_KEYS = ['id', 'category', 'currency', 'monthISO', 'amountMinor', 'active',
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
export function budgetIdentityKey(budget: Pick<MonthlyBudget, 'currency' | 'monthISO' | 'category'>): string {
  return [budget.currency, budget.monthISO, categoryKey(budget.category)].join('|');
}

export function validateMonthlyBudget(budget: MonthlyBudget): void {
  if (!validId(budget.id)) throw new Error('Identificador de presupuesto inválido.');
  if (typeof budget.category !== 'string' || !budget.category.trim() || budget.category.length > 60) {
    throw new Error('Elegí una categoría de hasta 60 caracteres.');
  }
  if (!['ARS', 'USD'].includes(budget.currency)) throw new Error('Elegí ARS o USD.');
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

export function validateBudgetCollection(budgets: MonthlyBudget[]): void {
  const ids = new Set<string>();
  const activeKeys = new Set<string>();
  for (const budget of budgets) {
    validateMonthlyBudget(budget);
    if (ids.has(budget.id)) throw new Error('La copia repite un presupuesto.');
    ids.add(budget.id);
    if (!budget.active) continue;
    const key = budgetIdentityKey(budget);
    if (activeKeys.has(key)) throw new Error('Ya existe un presupuesto activo para esa categoría, moneda y mes.');
    activeKeys.add(key);
  }
}

export function sameMonthlyBudget(a: MonthlyBudget, b: MonthlyBudget): boolean {
  return BUDGET_KEYS.every(key => a[key] === b[key]);
}

function safeNumber(value: bigint): number {
  if (value > BigInt(Number.MAX_SAFE_INTEGER) || value < -BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error('El presupuesto supera el rango seguro.');
  }
  return Number(value);
}

export function summarizeMonthlyBudgets(snapshot: LedgerSnapshot, budgets: MonthlyBudget[], currency: Currency, monthISO: string): MonthlyBudgetSummary {
  if (!validMonthISO(monthISO) || !['ARS', 'USD'].includes(currency)) throw new Error('Período de presupuesto inválido.');
  validateBudgetCollection(budgets);
  const active = budgets.filter(budget => budget.active && budget.currency === currency && budget.monthISO === monthISO);
  const accountIds = new Set(snapshot.accounts.filter(account => account.currency === currency).map(account => account.id));
  const spentByCategory = new Map<string, bigint>();
  let totalSpent = 0n;
  for (const entry of snapshot.entries) {
    if (entry.kind !== 'expense' || !accountIds.has(entry.accountId) || entry.dateISO.slice(0, 7) !== monthISO) continue;
    const amount = BigInt(entry.amountMinor);
    totalSpent += amount;
    const key = categoryKey(entry.category);
    spentByCategory.set(key, (spentByCategory.get(key) ?? 0n) + amount);
  }

  let budgeted = 0n, spentBudgeted = 0n;
  const rows = active.map(budget => {
    const spent = spentByCategory.get(categoryKey(budget.category)) ?? 0n;
    const limit = BigInt(budget.amountMinor);
    budgeted += limit;
    spentBudgeted += spent;
    const spentMinor = safeNumber(spent);
    const remainingMinor = safeNumber(limit - spent);
    return {
      budget,
      spentMinor,
      remainingMinor,
      ratio: budget.amountMinor > 0 ? Math.max(0, spentMinor / budget.amountMinor) : 0,
      exceeded: spent > limit,
    };
  }).sort((a, b) => Number(b.exceeded) - Number(a.exceeded)
    || b.ratio - a.ratio || categoryKey(a.budget.category).localeCompare(categoryKey(b.budget.category), 'es-AR'));

  const budgetedMinor = safeNumber(budgeted);
  const spentBudgetedMinor = safeNumber(spentBudgeted);
  const totalSpentMinor = safeNumber(totalSpent);
  return {
    currency,
    monthISO,
    budgetedMinor,
    spentBudgetedMinor,
    remainingMinor: safeNumber(budgeted - spentBudgeted),
    totalSpentMinor,
    unbudgetedSpentMinor: safeNumber(totalSpent - spentBudgeted),
    rows,
  };
}
