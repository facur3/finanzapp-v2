import type { AssistantFact, AssistantRequest, AssistantResult } from '../../../../packages/integrations/contracts.js';
import { integrationClient } from '../integrations/client.ts';
import type { AssistantReason } from './conversation.ts';

/** The client boundary the Assistant screen talks to. It is event-based so a
 * future token stream (deltas, then the validated result) and today's single
 * JSON reply from POST /api/mobile/assistant render through the same code.
 *
 * Modes are explicit and visible to the screen:
 * - `disconnected`: this build has no server origin or no session. Nothing
 *   leaves the device; every ask yields one `error` with reason `unavailable`.
 * - `remote`: wraps the existing integration client (HTTPS origin, bearer
 *   session, strict contracts on both directions, 35 s timeout). It yields the
 *   validated result and the local facts it cites; it never writes the ledger.
 * - `fixture`: deterministic scripted replies for UI development and tests,
 *   defined in fixtures.ts, never in this module. */
export type AssistantAsk = Omit<AssistantRequest, 'version'>;

export type AssistantEvent =
  | { type: 'delta'; text: string }
  | { type: 'result'; result: AssistantResult; facts: AssistantFact[] }
  /** `message` is a catalogue key the screen translates, or '' for the reason's own note (see `failureMessage`). */
  | { type: 'error'; reason: AssistantReason; message: string };

export type AssistantMode = 'disconnected' | 'remote' | 'fixture';

export interface AssistantClient {
  mode: AssistantMode;
  ask(input: AssistantAsk, signal?: AbortSignal): AsyncIterable<AssistantEvent>;
}

export function disconnectedAssistant(reason: 'unavailable' | 'session' = 'unavailable'): AssistantClient {
  return { mode: 'disconnected', async *ask() { yield { type: 'error', reason, message: '' }; } };
}

/** Classify a failure of the integration client by its catalogue key
 * (`assistant.integration.*`), never by translated copy. The Spanish patterns
 * remain for a message thrown as a sentence (a server or an older client). */
export function failureReason(cause: unknown): AssistantReason {
  const message = cause instanceof Error ? cause.message : String(cause);
  const name = cause instanceof Error ? cause.name : '';
  if (name === 'AbortError' || /network request failed|fetch failed|timed out/i.test(message)) return 'offline';
  if (message === 'assistant.integration.limit') return 'limit';
  if (message === 'assistant.integration.unavailable' || message === 'assistant.integration.httpsOrigin') return 'unavailable';
  if (message === 'assistant.integration.signIn') return 'session';
  if (/l[ií]mite/i.test(message)) return 'limit';
  if (/no est[aá] disponible/i.test(message)) return 'unavailable';
  if (/inici[aá] sesi[oó]n/i.test(message)) return 'session';
  return 'failed';
}

/** The words a failure may carry to the screen: only the integration client's own
 * catalogue keys (`assistant.integration.*`). A contract rejection ("Datos de captura
 * inválidos."), an engine message (a JSON or network TypeError) or anything else is
 * not interface copy: it yields no message, and the screen shows the reason's note in
 * the interface language instead. */
export function failureMessage(cause: unknown): string {
  const message = cause instanceof Error ? cause.message : '';
  return /^assistant\.integration\.[a-zA-Z]+$/.test(message) ? message : '';
}

export function remoteAssistant(origin: string, getAccessToken: () => Promise<string | null>, fetcher: typeof fetch = fetch): AssistantClient { // i18n-ignore: a generic type, not copy
  const client = integrationClient(origin, getAccessToken, fetcher);
  return { mode: 'remote', async *ask(input, signal) {
    if (signal?.aborted) return;
    try {
      const { evidence, ...result } = await client.assistant({ version: 1, ...input });
      if (signal?.aborted) return;
      yield { type: 'result', result, facts: evidence };
    } catch (cause) {
      if (signal?.aborted) return;
      yield { type: 'error', reason: failureReason(cause), message: failureMessage(cause) };
    }
  } };
}

/** What this build can reach. There is no mobile sign-in yet, so even a
 * configured origin has no session to present: the client stays disconnected
 * and no request is built. Activation (origin + session + consent) is the
 * next phase; it changes this function, not the screen. */
export function assistantForEnvironment(env: Record<string, string | undefined>, getAccessToken?: () => Promise<string | null>, fetcher?: typeof fetch): AssistantClient { // i18n-ignore: a generic type, not copy
  const origin = env.EXPO_PUBLIC_MOBILE_API_ORIGIN?.trim();
  if (!origin) return disconnectedAssistant('unavailable');
  if (!getAccessToken) return disconnectedAssistant('session');
  try { return remoteAssistant(origin, getAccessToken, fetcher); }
  catch { return disconnectedAssistant('unavailable'); }
}
