import { validateAssistantRequest, validateAssistantResult, validateCapture,
  type AssistantRequest, type CaptureRequest } from '../../../../packages/integrations/contracts.js';

/** Call only after explicit cloud consent. No API key and no financial data in URLs. */
export function integrationClient(baseURL: string, getAccessToken: () => Promise<string | null>, fetcher: typeof fetch = fetch) {
  const url = new URL(baseURL);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error('Usá el origen HTTPS del servidor.');
  async function post(path: string, body: unknown) {
    const token = await getAccessToken();
    if (!token) throw new Error('Iniciá sesión para usar la integración. El registro manual sigue disponible.');
    // React Native provides AbortController; do not depend on newer browser-only
    // AbortSignal static helpers being present in the installed Expo runtime.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 35000);
    try {
      const response = await fetcher(url.origin + '/api/mobile/' + path, { method: 'POST',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify(body), signal: controller.signal });
      if (!response.ok) throw new Error(response.status === 429 ? 'Llegaste al límite de uso. Podés registrar manualmente.'
        : response.status === 503 ? 'La integración todavía no está disponible.' : 'No se pudo completar la solicitud. Tus movimientos no cambiaron.');
      return await response.json();
    } finally {
      clearTimeout(timer);
    }
  }
  return {
    async capture(input: CaptureRequest) {
      const receipt = await post('captures', validateCapture(input));
      if (typeof receipt.id !== 'string' || receipt.status !== 'needs_review' || typeof receipt.duplicate !== 'boolean') throw new Error('No pudimos verificar la captura.');
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
