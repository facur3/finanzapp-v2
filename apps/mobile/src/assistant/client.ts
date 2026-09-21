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
  | { type: 'error'; reason: AssistantReason; message: string };

export type AssistantMode = 'disconnected' | 'remote' | 'fixture';

export interface AssistantClient {
  mode: AssistantMode;
  ask(input: AssistantAsk, signal?: AbortSignal): AsyncIterable<AssistantEvent>;
}

export function disconnectedAssistant(reason: 'unavailable' | 'session' = 'unavailable'): AssistantClient {
  return { mode: 'disconnected', async *ask() { yield { type: 'error', reason, message: '' }; } };
}

/** Classify a failure of the integration client without depending on its exact copy. */
export function failureReason(cause: unknown): AssistantReason {
  const message = cause instanceof Error ? cause.message : String(cause);
  const name = cause instanceof Error ? cause.name : '';
  if (name === 'AbortError' || /network request failed|fetch failed|timed out/i.test(message)) return 'offline';
  if (/l[ií]mite/i.test(message)) return 'limit';
  if (/no est[aá] disponible/i.test(message)) return 'unavailable';
  if (/inici[aá] sesi[oó]n/i.test(message)) return 'session';
  return 'failed';
}

export function remoteAssistant(origin: string, getAccessToken: () => Promise<string | null>, fetcher: typeof fetch = fetch): AssistantClient {
  const client = integrationClient(origin, getAccessToken, fetcher);
  return { mode: 'remote', async *ask(input, signal) {
    if (signal?.aborted) return;
    try {
      const { evidence, ...result } = await client.assistant({ version: 1, ...input });
      if (signal?.aborted) return;
      yield { type: 'result', result, facts: evidence };
    } catch (cause) {
      if (signal?.aborted) return;
      yield { type: 'error', reason: failureReason(cause), message: cause instanceof Error ? cause.message : '' };
    }
  } };
}

/** What this build can reach. There is no mobile sign-in yet, so even a
 * configured origin has no session to present: the client stays disconnected
 * and no request is built. Activation (origin + session + consent) is the
 * next phase; it changes this function, not the screen. */
export function assistantForEnvironment(env: Record<string, string | undefined>, getAccessToken?: () => Promise<string | null>, fetcher?: typeof fetch): AssistantClient {
  const origin = env.EXPO_PUBLIC_MOBILE_API_ORIGIN?.trim();
  if (!origin) return disconnectedAssistant('unavailable');
  if (!getAccessToken) return disconnectedAssistant('session');
  try { return remoteAssistant(origin, getAccessToken, fetcher); }
  catch { return disconnectedAssistant('unavailable'); }
}
