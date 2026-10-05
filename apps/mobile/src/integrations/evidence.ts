import { spendingComparison, spendingFacts, type Currency, type LedgerSnapshot } from '@finanzapp/domain';
import type { AssistantFact } from '../../../../packages/integrations/contracts.js';
import { PROTOCOL_LIMITS, isSafeInputText } from '../../../../packages/integrations/assistant-protocol.js';

/** Fact labels are protocol data, not interface copy: they are what the
 * server (and the model) reads, validated by `packages/integrations/assistant-protocol.js`,
 * and they stay in Spanish whatever the interface language. The app never
 * shows them: an answer's evidence rows are named from the fact id (and, for a
 * category, the stored category name) in the interface language; see
 * `answerContent` in src/assistant/conversation.ts.
 * Protocol v2 carries the configured region but no language (it rejects unknown
 * keys) and the server answers in Spanish; how the interface language will reach
 * the model, and how facts become language-neutral, is docs/i18n.md §11. */
export const FACT_LABELS = { expenses: 'Gastos registrados', income: 'Ingresos registrados', refunds: 'Devoluciones', categoryPrefix: 'Categoría de gasto: ' } as const;

/** The stored category name a `*.category.N` fact is about, or null for any other fact.
 * The fact contract has no field for it, so the name travels inside the label
 * after `FACT_LABELS.categoryPrefix`; building and reading share that one
 * constant so they cannot drift. The kind of fact is decided by its id, never by its label. */
export function factCategory(fact: Pick<AssistantFact, 'id' | 'label'>): string | null {
  if (!/(^|\.)category\.\d+$/.test(fact.id)) return null;
  return fact.label.startsWith(FACT_LABELS.categoryPrefix) ? fact.label.slice(FACT_LABELS.categoryPrefix.length) : fact.label;
}

/** Aggregate on-device; only send this scoped context after explicit consent.
 *
 * 24T3 (A25): every fact is additive and never negative (the protocol refuses a negative amount). Spending is sent split,
 * never netted: `*.expenses` is the gross of the purchase lines (purchases, instalments, an adelanto's components) with
 * their purchase count, each `*.category.N` that category's gross (only those above zero), and one `*.refunds` fact
 * («Devoluciones») carries the period's devoluciones as a positive amount and their count, only when there are any. The
 * net Reportes shows is `expenses − refunds`; it is never sent as a total. Income is counted directly, so a devolución
 * never changes it. Two sides of at most 3 + 26 facts stay within the contract's 60. */
export function monthlyEvidence(snapshot: LedgerSnapshot, currency: Currency, todayISO: string): AssistantFact[] {
  const comparison = spendingComparison(snapshot, currency, todayISO.slice(0, 7), todayISO);
  if (comparison.status === 'out-of-range') return [];
  const facts: AssistantFact[] = [];
  for (const [prefix, report] of [['current', comparison.current], ['previous', comparison.previous]] as const) {
    if (!report || report.status !== 'ready') continue;
    const period = { startISO: report.startISO, endISO: report.endISO };
    const side = spendingFacts(snapshot, { currency, ...period });
    if (side.status !== 'ready') continue;
    // Do not turn an untracked period into evidence of zero actual spending.
    if (!side.purchaseCount && !side.incomeCount && !side.refundCount) continue;
    facts.push({ id: prefix + '.expenses', label: FACT_LABELS.expenses, amountMinor: side.grossPurchasesMinor, count: side.purchaseCount, ...period });
    facts.push({ id: prefix + '.income', label: FACT_LABELS.income, amountMinor: side.incomeMinor, count: side.incomeCount, ...period });
    if (side.refundCount) facts.push({ id: prefix + '.refunds', label: FACT_LABELS.refunds, amountMinor: side.refundsMinor, count: side.refundCount, ...period });
    side.categories.slice(0, 26).forEach((category, index) => {
      // 25A-05: a stored name the protocol refuses (a direction override, a control or a tag character) is left out, never
      // cleaned: one such category must not make every question fail, and its exact spelling is what links resolve.
      const label = FACT_LABELS.categoryPrefix + category.category;
      if (isSafeInputText(label, PROTOCOL_LIMITS.factLabelChars)) facts.push({ id: prefix + '.category.' + index, label, amountMinor: category.amountMinor, count: category.count, ...period });
    });
  }
  return facts;
}
