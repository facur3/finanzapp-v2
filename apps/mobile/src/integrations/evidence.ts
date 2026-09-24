import { spendingComparison, type Currency, type LedgerSnapshot } from '@finanzapp/domain';
import type { AssistantFact } from '../../../../packages/integrations/contracts.js';

/** Fact labels are protocol data, not interface copy: they are what the
 * server (and the model) reads, validated by `packages/integrations/contracts.js`,
 * and they stay in Spanish whatever the interface language. The app never
 * shows them: an answer's evidence rows are named from the fact id (and, for a
 * category, the stored category name) in the interface language; see
 * `answerContent` in src/assistant/conversation.ts.
 * TODO(i18n): the request should later carry the interface language so the
 * model answers in it; that is a contract change, out of scope here. */
export const FACT_LABELS = { expenses: 'Gastos registrados', income: 'Ingresos registrados', categoryPrefix: 'Categoría de gasto: ' } as const;

/** The stored category name a `*.category.N` fact is about, or null for any other fact.
 * The fact contract has no field for it, so the name travels inside the label
 * after `FACT_LABELS.categoryPrefix`; building and reading share that one
 * constant so they cannot drift. The kind of fact is decided by its id, never by its label. */
export function factCategory(fact: Pick<AssistantFact, 'id' | 'label'>): string | null {
  if (!/(^|\.)category\.\d+$/.test(fact.id)) return null;
  return fact.label.startsWith(FACT_LABELS.categoryPrefix) ? fact.label.slice(FACT_LABELS.categoryPrefix.length) : fact.label;
}

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
    facts.push({ id: prefix + '.expenses', label: FACT_LABELS.expenses, amountMinor: report.expenseMinor,
      count: report.categories.reduce((count, c) => count + c.count, 0), ...period });
    facts.push({ id: prefix + '.income', label: FACT_LABELS.income, amountMinor: report.incomeMinor,
      count: report.count - report.categories.reduce((count, c) => count + c.count, 0), ...period });
    report.categories.slice(0, 26).forEach((category, index) => facts.push({ id: prefix + '.category.' + index,
      label: FACT_LABELS.categoryPrefix + category.category, amountMinor: category.amountMinor, count: category.count, ...period }));
  }
  return facts;
}
