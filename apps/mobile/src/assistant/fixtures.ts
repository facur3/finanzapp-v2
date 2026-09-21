import type { AssistantFact, AssistantResult } from '../../../../packages/integrations/contracts.js';
import type { AssistantAsk, AssistantClient, AssistantEvent } from './client.ts';

/** TEST FIXTURES. Deterministic, scripted Assistant replies so every UI state
 * (streaming, answer with evidence, draft, clarification, error) can be
 * rendered without a model. They are not production AI responses: the runtime
 * only selects this client in a development bundle started with
 * EXPO_PUBLIC_ASSISTANT_FIXTURES=1, and the screen then shows a visible
 * "Vista de prueba" banner and refuses to write anything to the ledger. */

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

export const FIXTURE_ANSWER: AssistantResult = { kind: 'answer', draft: null,
  message: 'Gastaste $84.300 más que el mes pasado, comparando los mismos 21 días. Restaurantes explica la mitad de la diferencia.',
  factIds: ['current.expenses', 'previous.expenses', 'current.category.0', 'previous.category.0', 'current.category.1', 'previous.category.1', 'current.category.2', 'previous.category.2'] };

export const FIXTURE_CATEGORY_ANSWER: AssistantResult = { kind: 'answer', draft: null,
  message: 'En Supermercado llevás $121.200 este mes, en 11 compras.', factIds: ['current.category.1'] };

export const FIXTURE_DRAFT: AssistantResult = { kind: 'draft', message: 'Preparé este gasto. Revisalo antes de guardarlo.', factIds: [],
  draft: { kind: 'expense', amountMinor: 1850000, currency: 'ARS', merchant: 'Carrefour', category: 'Supermercado', dateISO: null, paymentMethodRef: 'Visa' } };

/** Same sentence without a payment method: the app must ask, not guess. */
export const FIXTURE_DRAFT_NO_ACCOUNT: AssistantResult = { kind: 'draft', message: 'Preparé este gasto.', factIds: [],
  draft: { kind: 'expense', amountMinor: 1800000, currency: 'ARS', merchant: 'Súper', category: 'Supermercado', dateISO: null, paymentMethodRef: null } };

export const FIXTURE_CLARIFICATION: AssistantResult = { kind: 'clarification', draft: null, factIds: [],
  message: '¿Te referís a lo que gastaste este mes o al total del año?' };

type Script = { match: RegExp; reply: { result: AssistantResult; facts: AssistantFact[] } | { error: AssistantEvent & { type: 'error' } } };

const SCRIPTS: Script[] = [
  { match: /carrefour.*visa/i, reply: { result: FIXTURE_DRAFT, facts: [] } },
  { match: /s[uú]per/i, reply: { result: FIXTURE_DRAFT_NO_ACCOUNT, facts: [] } },
  { match: /por qu[eé] gast[eé] m[aá]s/i, reply: { result: FIXTURE_ANSWER, facts: FIXTURE_FACTS } },
  { match: /comida|supermercado/i, reply: { result: FIXTURE_CATEGORY_ANSWER, facts: FIXTURE_FACTS } },
  { match: /^error$/i, reply: { error: { type: 'error', reason: 'failed', message: 'No se pudo completar la consulta. Tus movimientos no cambiaron.' } } },
  { match: /^sin conexi[oó]n$/i, reply: { error: { type: 'error', reason: 'offline', message: 'Sin conexión.' } } },
  { match: /^l[ií]mite$/i, reply: { error: { type: 'error', reason: 'limit', message: 'Llegaste al límite de uso.' } } },
];

export function fixtureReply(ask: AssistantAsk): Script['reply'] {
  return SCRIPTS.find(script => script.match.test(ask.text))?.reply ?? { result: FIXTURE_CLARIFICATION, facts: [] };
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
