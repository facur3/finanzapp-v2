import { validateCapture, type CaptureRequest } from '../../../../packages/integrations/contracts.js';
import { validateAssistantRequestV2, validateAssistantResultV2, type AssistantRequestV2 } from '../../../../packages/integrations/assistant-protocol.js';

/** What a caller asks; the client adds the protocol version and a fresh request id. */
export type AssistantQuery = Omit<AssistantRequestV2, 'version' | 'requestId'>;

/** Call only after explicit cloud consent. No API key and no financial data in URLs.
 * Its own failures are thrown as catalogue keys (`assistant.integration.*`):
 * stable ids that callers classify (see `failureReason`) and that the screen
 * translates at display through `errorText`. Contract validation errors from
 * packages/integrations are thrown as they are; the Assistant client lets only
 * the keys reach the screen (`failureMessage` in src/assistant/client.ts).
 * `newId` makes each Assistant request id (the app passes expo-crypto's `randomUUID`; the default serves Node). */
export function integrationClient(baseURL: string, getAccessToken: () => Promise<string | null>, fetcher: typeof fetch = fetch, // i18n-ignore: a generic type, not copy
  newId: () => string = () => globalThis.crypto.randomUUID()) {
  const url = new URL(baseURL);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error('assistant.integration.httpsOrigin');
  async function post(path: string, body: unknown) {
    const token = await getAccessToken();
    if (!token) throw new Error('assistant.integration.signIn');
    // React Native provides AbortController; do not depend on newer browser-only
    // AbortSignal static helpers being present in the installed Expo runtime.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 35000);
    try {
      const response = await fetcher(url.origin + '/api/mobile/' + path, { method: 'POST',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, // i18n-ignore: HTTP header, not copy
        body: JSON.stringify(body), signal: controller.signal });
      // 409 (a request id already used), 413 and 422 are failures like any other: nothing was recorded.
      if (!response.ok) throw new Error(response.status === 429 ? 'assistant.integration.limit'
        : response.status === 503 ? 'assistant.integration.unavailable' : 'assistant.integration.failed');
      return await response.json();
    } finally {
      clearTimeout(timer);
    }
  }
  return {
    async capture(input: CaptureRequest) {
      const receipt = await post('captures', validateCapture(input));
      if (typeof receipt.id !== 'string' || receipt.status !== 'needs_review' || typeof receipt.duplicate !== 'boolean') throw new Error('assistant.integration.captureUnverified');
      // Inbox receipt is NOT an Entry or a bank payment confirmation.
      return { id: receipt.id as string, status: 'needs_review' as const, duplicate: receipt.duplicate as boolean };
    },
    async assistant({ action, text, todayISO, currency, region, facts }: AssistantQuery) {
      const request = validateAssistantRequestV2({ version: 2, requestId: newId(), action, text, todayISO, currency, region, facts });
      // The server's reply is validated again here, against the request this device sent; its copy of the evidence is
      // dropped: the evidence is this device's own facts, the ones the validated result cites or offers as candidates.
      const { evidence: _served, ...reply } = await post('assistant', request);
      const result = validateAssistantResultV2(reply, request);
      const named = new Set([...result.evidenceIds, ...(result.clarification?.candidateIds ?? [])]);
      return { ...result, evidence: request.facts.filter(f => named.has(f.id)) };
    },
  };
}
