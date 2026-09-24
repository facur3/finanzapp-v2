import { validateAssistantRequest, validateAssistantResult, validateCapture,
  type AssistantRequest, type CaptureRequest } from '../../../../packages/integrations/contracts.js';

/** Call only after explicit cloud consent. No API key and no financial data in URLs.
 * Its own failures are thrown as catalogue keys (`assistant.integration.*`):
 * stable ids that callers classify (see `failureReason`) and that the screen
 * translates at display through `errorText`. Contract validation errors from
 * packages/integrations are thrown as they are; the Assistant client lets only
 * the keys reach the screen (`failureMessage` in src/assistant/client.ts). */
export function integrationClient(baseURL: string, getAccessToken: () => Promise<string | null>, fetcher: typeof fetch = fetch) { // i18n-ignore: a generic type, not copy
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
    async assistant(input: AssistantRequest) {
      const request = validateAssistantRequest(input);
      const { kind, message, draft, factIds } = await post('assistant', request);
      const result = validateAssistantResult({ kind, message, draft, factIds }, request);
      return { ...result, evidence: request.facts.filter(f => result.factIds.includes(f.id)) };
    },
  };
}
