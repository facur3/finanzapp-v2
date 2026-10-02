import { accountIdsInCurrency, validDateISO, type Currency, type LedgerSnapshot } from './ledger.ts';
import { isPurchaseLine } from './operations.ts';

export type MonthSummary = {
  currency: Currency;
  startISO: string;
  endISO: string;
} & ({ status: 'ready'; incomeMinor: number; expenseMinor: number; count: number }
  | { status: 'out-of-range' });

// Operates on a validated ledger snapshot. This is recorded cash flow, not
// net worth, a bank statement, a budget, or an estimate of unrecorded spending.
//
// Producto 24T3: `expenseMinor` is the signed net of every expense line, so a
// devolución (a projected line with a negative amount) nets in its own month
// and may leave the month's net below zero; it is never income. `count` is the
// movements a person recorded: incomes plus purchase lines (`isPurchaseLine`,
// A23), so a devolución is not counted and an adelanto counts once.
export function summarizeMonth(snapshot: LedgerSnapshot, currency: Currency, asOfISO: string): MonthSummary {
  if (!validDateISO(asOfISO)) throw new Error('Fecha de resumen inválida.');
  const period = { currency, startISO: asOfISO.slice(0, 7) + '-01', endISO: asOfISO };
  const accounts = accountIdsInCurrency(snapshot.accounts, currency);
  let incomeMinor = 0;
  let expenseMinor = 0;
  // Σ|expense line|: it bounds the net and every subgroup of these lines (a
  // category, a day, a merchant) whatever their signs and order.
  let grossMinor = 0;
  let count = 0;
  for (const entry of snapshot.entries) {
    if (!accounts.has(entry.accountId) || entry.dateISO < period.startISO || entry.dateISO > period.endISO) continue;
    if (entry.kind === 'income') { incomeMinor += entry.amountMinor; count++; }
    else {
      expenseMinor += entry.amountMinor;
      grossMinor += Math.abs(entry.amountMinor);
      if (isPurchaseLine(entry)) count++;
    }
    // Valid closing balances can still have very large accumulated cash flows.
    // Never round an unsafe total or let this optional card blank the whole Home.
    if (!Number.isSafeInteger(incomeMinor) || !Number.isSafeInteger(grossMinor)) return { ...period, status: 'out-of-range' };
  }
  return { ...period, status: 'ready', incomeMinor, expenseMinor, count };
}
