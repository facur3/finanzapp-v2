import { minorUnitExponent } from '@finanzapp/domain';
import { validateCapture, type AssistantFact, type CaptureRequest } from '../../../../packages/integrations/contracts.js';
import { ASSISTANT_PROTOCOL_VERSION, toWireFacts, validateAssistantRequest, validateAssistantResultV2, validateDroppedFields, type AssistantRequestV5 } from '../../../../packages/integrations/assistant-protocol.js';

/** What a caller asks: the device's own facts in integer minor units of `currency`; the client adds the protocol version
 * and a fresh request id and writes each fact's amount as protocol v5's exact decimal with that currency's exponent. */
export type AssistantQuery = Omit<AssistantRequestV5, 'version' | 'requestId' | 'facts'> & { facts: AssistantFact[] };

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
    async assistant({ action, text, todayISO, currency, region, language, facts }: AssistantQuery) {
      const wire = facts.length ? toWireFacts(facts, minorUnitExponent(currency)) : [];
      const request = validateAssistantRequest({ version: ASSISTANT_PROTOCOL_VERSION, requestId: newId(), action, text: withoutInvisibles(text), todayISO, currency, region, language, facts: wire });
      // The server's reply is validated again here, against the request this device sent; its copy of the evidence is
      // dropped: the evidence is this device's own facts, the ones the validated result cites or offers as candidates.
      // `dropped` (25A-06, decision A) names the optional names the server boundary left null because the model copied
      // them past their bound; it is validated against the result (absent from an older server is none).
      const { evidence: _served, dropped: served, ...reply } = await post('assistant', request);
      const result = validateAssistantResultV2(reply, request);
      const dropped = validateDroppedFields(served, result);
      const named = new Set([...result.evidenceIds, ...(result.clarification?.candidateIds ?? [])]);
      // The local minor-unit facts, never the wire decimals: the device draws its evidence rows from its own integers.
      return { ...result, evidence: facts.filter(f => named.has(f.id)), dropped };
    },
  };
}

/** The person's text as the request carries it: the invisible characters a paste brings along (web pages, PDFs and bank
 * apps add them) that the request admits but the reply refuses in a name are taken out, so a merchant the model copies
 * verbatim is never refused (and billed) for a character nobody can see: the zero-width space, the word joiner and the
 * invisible operators, the BOM and the interlinear annotations go; a line or paragraph separator, a CR or a CRLF becomes a
 * line break and a tab a space (a reply refuses both, even in prose, which keeps only the line break).
 * Visible words are unchanged; the joiners of emoji and scripts (U+200C, U+200D) stay. The thread shows what was typed. */
export function withoutInvisibles(text: string): string {
  return text.replace(/[\u200b\u2060-\u2064\ufeff\ufff9-\ufffb]/g, '').replace(/\r\n?|[\u2028\u2029]/g, '\n').replace(/\t/g, ' ');
}
