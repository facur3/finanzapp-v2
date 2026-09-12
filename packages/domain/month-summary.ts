import { validDateISO, type Currency, type LedgerSnapshot } from './ledger.ts';

export type MonthSummary = {
  currency: Currency;
  startISO: string;
  endISO: string;
} & ({ status: 'ready'; incomeMinor: number; expenseMinor: number; count: number }
  | { status: 'out-of-range' });

// Operates on a validated ledger snapshot. This is recorded cash flow, not
// net worth, a bank statement, a budget, or an estimate of unrecorded spending.
export function summarizeMonth(snapshot: LedgerSnapshot, currency: Currency, asOfISO: string): MonthSummary {
  if (!validDateISO(asOfISO)) throw new Error('Fecha de resumen inválida.');
  const period = { currency, startISO: asOfISO.slice(0, 7) + '-01', endISO: asOfISO };
  const accounts = new Set(snapshot.accounts.filter(account => account.currency === currency).map(account => account.id));
  let incomeMinor = 0;
  let expenseMinor = 0;
  let count = 0;
  for (const entry of snapshot.entries) {
    if (!accounts.has(entry.accountId) || entry.dateISO < period.startISO || entry.dateISO > period.endISO) continue;
    count++;
    if (entry.kind === 'income') incomeMinor += entry.amountMinor;
    else expenseMinor += entry.amountMinor;
    // Valid closing balances can still have very large accumulated cash flows.
    // Never round an unsafe total or let this optional card blank the whole Home.
    if (!Number.isSafeInteger(incomeMinor) || !Number.isSafeInteger(expenseMinor)) return { ...period, status: 'out-of-range' };
  }
  return { ...period, status: 'ready', incomeMinor, expenseMinor, count };
}
