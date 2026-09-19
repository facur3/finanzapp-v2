import { spendingComparison, type Currency, type LedgerSnapshot } from '@finanzapp/domain';
import type { AssistantFact } from '../../../../packages/integrations/contracts.js';

/** Aggregate on-device; only send this scoped context after explicit consent. */
export function monthlyEvidence(snapshot: LedgerSnapshot, currency: Currency, todayISO: string): AssistantFact[] {
  const comparison = spendingComparison(snapshot, currency, todayISO.slice(0, 7), todayISO);
  if (comparison.status === 'out-of-range') return [];
  const facts: AssistantFact[] = [];
  for (const [prefix, report] of [['current', comparison.current], ['previous', comparison.previous]] as const) {
    if (!report || report.status !== 'ready') continue;
    const period = { startISO: report.startISO, endISO: report.endISO };
    // Do not turn an untracked period into evidence of zero actual spending.
    if (!report.count) continue;
    facts.push({ id: prefix + '.expenses', label: 'Gastos registrados', amountMinor: report.expenseMinor,
      count: report.categories.reduce((count, c) => count + c.count, 0), ...period });
    facts.push({ id: prefix + '.income', label: 'Ingresos registrados', amountMinor: report.incomeMinor,
      count: report.count - report.categories.reduce((count, c) => count + c.count, 0), ...period });
    report.categories.slice(0, 26).forEach((category, index) => facts.push({ id: prefix + '.category.' + index,
      label: 'Categoría de gasto: ' + category.category, amountMinor: category.amountMinor, count: category.count, ...period }));
  }
  return facts;
}
