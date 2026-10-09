import type { AssistantFact } from '../../../../packages/integrations/contracts.js';
import type { AssistantResultV2 } from '../../../../packages/integrations/assistant-protocol.js';
import type { AssistantAsk, AssistantClient, AssistantEvent } from './client.ts';

/** TEST FIXTURES. Deterministic, scripted Assistant replies so every UI state
 * (streaming, answer with evidence, proposal, clarification, out of scope, error) can be
 * rendered without a model, in protocol v2 shapes. They are not production AI responses: the runtime
 * only selects this client in a development bundle started with
 * EXPO_PUBLIC_ASSISTANT_FIXTURES=1, and the screen then shows a visible
 * "Vista de prueba" banner and refuses to write anything to the ledger.
 *
 * Language: these replies stand in for the model's output, which is content,
 * not interface copy, so they are deliberately left in Spanish and never go
 * through the catalogue (the interface around them is translated). The fact
 * labels are protocol data (see FACT_LABELS in src/integrations/evidence.ts). */

export const FIXTURE_FACTS: AssistantFact[] = [
  { id: 'current.expenses', label: 'Gastos registrados', amountMinor: 41230000, count: 38, startISO: '2026-09-01', endISO: '2026-09-21' },
  { id: 'previous.expenses', label: 'Gastos registrados', amountMinor: 32800000, count: 35, startISO: '2026-08-01', endISO: '2026-08-21' },
  { id: 'current.category.0', label: 'Categoría de gasto: Restaurantes', amountMinor: 9850000, count: 9, startISO: '2026-09-01', endISO: '2026-09-21' },
  { id: 'previous.category.0', label: 'Categoría de gasto: Restaurantes', amountMinor: 5600000, count: 6, startISO: '2026-08-01', endISO: '2026-08-21' },
  { id: 'current.category.1', label: 'Categoría de gasto: Supermercado', amountMinor: 12120000, count: 11, startISO: '2026-09-01', endISO: '2026-09-21' },
  { id: 'previous.category.1', label: 'Categoría de gasto: Supermercado', amountMinor: 9000000, count: 10, startISO: '2026-08-01', endISO: '2026-08-21' },
  { id: 'current.category.2', label: 'Categoría de gasto: Transporte', amountMinor: 3190000, count: 8, startISO: '2026-09-01', endISO: '2026-09-21' },
  { id: 'previous.category.2', label: 'Categoría de gasto: Transporte', amountMinor: 2300000, count: 7, startISO: '2026-08-01', endISO: '2026-08-21' },
];

const none = { evidenceIds: [], navigation: null, proposals: [], clarification: null };

export const FIXTURE_ANSWER: AssistantResultV2 = { ...none, type: 'answer',
  // Decision B (2026-10-08): the model names the verified amounts and compares in words; the device draws the difference.
  message: 'Gastaste más este mes: $412.300 contra $328.000 a esta altura del mes pasado, comparando los mismos 21 días. En Restaurantes, $98.500 contra $56.000.',
  evidenceIds: ['current.expenses', 'previous.expenses', 'current.category.0', 'previous.category.0', 'current.category.1', 'previous.category.1', 'current.category.2', 'previous.category.2'] };

export const FIXTURE_CATEGORY_ANSWER: AssistantResultV2 = { ...none, type: 'answer',
  message: 'En Supermercado llevás $121.200 este mes, en 11 compras.', evidenceIds: ['current.category.1'], navigation: { target: 'category', factId: 'current.category.1' } };

export const FIXTURE_DRAFT: AssistantResultV2 = { ...none, type: 'proposal', message: 'Preparé este gasto. Revisalo antes de guardarlo.',
  proposals: [{ kind: 'expense', amountMinor: 1850000, currency: 'ARS', merchant: 'Carrefour', category: 'Supermercado', dateISO: null, paymentMethodRef: 'Visa' }] };

/** Same sentence without a payment method: the app must ask, not guess. */
export const FIXTURE_DRAFT_NO_ACCOUNT: AssistantResultV2 = { ...none, type: 'proposal', message: 'Preparé este gasto.',
  proposals: [{ kind: 'expense', amountMinor: 1800000, currency: 'ARS', merchant: 'Súper', category: 'Supermercado', dateISO: null, paymentMethodRef: null }] };

export const FIXTURE_CLARIFICATION: AssistantResultV2 = { ...none, type: 'clarification', clarification: { field: 'period', candidateIds: [] },
  message: '¿Te referís a lo que gastaste este mes o al total del año?' };

/** A request FinanzApp does not serve (writing code): a redirection in prose, nothing else. */
export const FIXTURE_OUT_OF_SCOPE: AssistantResultV2 = { ...none, type: 'out_of_scope',
  message: 'Eso no lo puedo hacer. Puedo ayudarte a registrar un gasto o un ingreso, o a entender en qué gastaste.' };

/** The same scripted replies in English, for an ask whose `language` is 'en': protocol v3 sends the interface language
 * and the reply follows it (docs/i18n.md §11). Only the prose changes; evidence, drafts and clarification fields are the
 * same. Category and account names stay the person's own words, never translated; the amounts keep the writing of
 * the fixture ledger (Argentine), as a model told region AR would write them. */
const ENGLISH = new Map<AssistantResultV2, string>([
  [FIXTURE_ANSWER, 'You spent more this month: $412.300 against $328.000 at this point last month, over the same 21 days. In Restaurantes, $98.500 against $56.000.'],
  [FIXTURE_CATEGORY_ANSWER, 'In Supermercado you have spent $121.200 this month, across 11 purchases.'],
  [FIXTURE_DRAFT, 'I prepared this expense. Review it before saving it.'],
  [FIXTURE_DRAFT_NO_ACCOUNT, 'I prepared this expense.'],
  [FIXTURE_CLARIFICATION, 'Do you mean what you spent this month, or the total for the year?'],
  [FIXTURE_OUT_OF_SCOPE, 'I can’t do that. I can help you record an expense or an income, or understand what you spent on.'],
]);

type Script = { match: RegExp; reply: { result: AssistantResultV2; facts: AssistantFact[] } | { error: AssistantEvent & { type: 'error' } } };

const SCRIPTS: Script[] = [
  { match: /carrefour.*visa/i, reply: { result: FIXTURE_DRAFT, facts: [] } },
  { match: /s[uú]per/i, reply: { result: FIXTURE_DRAFT_NO_ACCOUNT, facts: [] } },
  // The English suggestion chips reach the same scripted replies; the replies stay Spanish (content, as the server answers).
  { match: /por qu[eé] gast[eé] m[aá]s|why did i spend more/i, reply: { result: FIXTURE_ANSWER, facts: FIXTURE_FACTS } },
  { match: /comida|supermercado|food|groceries/i, reply: { result: FIXTURE_CATEGORY_ANSWER, facts: FIXTURE_FACTS } },
  { match: /c[oó]digo|programa|python|javascript|\bcode\b/i, reply: { result: FIXTURE_OUT_OF_SCOPE, facts: [] } },
  // A failure's words are the app's, not the model's: no message, so the screen shows the reason's note in the interface language.
  { match: /^error$/i, reply: { error: { type: 'error', reason: 'failed', message: '' } } },
  { match: /^(sin conexi[oó]n|offline)$/i, reply: { error: { type: 'error', reason: 'offline', message: '' } } },
  { match: /^(l[ií]mite|limit)$/i, reply: { error: { type: 'error', reason: 'limit', message: '' } } },
];

/** The scripted reply for an ask, in the language the ask names ('en' gets the English twin; anything else the Spanish
 * original): the fixture behaves like a server that follows protocol v3's `language`. */
export function fixtureReply(ask: AssistantAsk): Script['reply'] {
  const reply = SCRIPTS.find(script => script.match.test(ask.text))?.reply ?? { result: FIXTURE_CLARIFICATION, facts: [] };
  if ('error' in reply || ask.language !== 'en') return reply;
  return { result: { ...reply.result, message: ENGLISH.get(reply.result) ?? reply.result.message }, facts: reply.facts };
}

/** Replays the scripted reply word by word so the streaming states can be seen; `delayMs` 0 keeps tests instant. */
export function fixtureAssistant(delayMs = 45, wait: (ms: number) => Promise<void> = ms => new Promise(resolve => setTimeout(resolve, ms))): AssistantClient {
  return { mode: 'fixture', async *ask(input, signal) {
    const reply = fixtureReply(input);
    await wait(delayMs * 8);
    if (signal?.aborted) return;
    if ('error' in reply) { yield reply.error; return; }
    for (const word of reply.result.message.split(/(?<=\s)/)) {
      if (signal?.aborted) return;
      yield { type: 'delta', text: word };
      if (delayMs) await wait(delayMs);
    }
    if (signal?.aborted) return;
    yield { type: 'result', result: reply.result, facts: reply.facts };
  } };
}
