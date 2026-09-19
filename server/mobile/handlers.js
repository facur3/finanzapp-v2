import { InputError, validateAssistantRequest, validateAssistantResult, validateCapture } from '../../packages/integrations/contracts.js';

export class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
/** Dependencies are mandatory: never replace durable quotas/inbox with process memory. */
export function createMobileHandler(kind, dependencies) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Usá POST.' }); }
    if (!dependencies) return res.status(503).json({ error: 'La integración todavía no está habilitada.' });
    try {
      const token = req.headers?.authorization;
      if (typeof token !== 'string' || !/^Bearer [^\s]{16,4096}$/.test(token)) throw new ApiError(401, 'Iniciá sesión de nuevo.');
      const session = await dependencies.authenticate(token);
      if (!session?.userId) throw new ApiError(401, 'Sesión inválida.');
      if (!/^application\/json(?:;|$)/i.test(req.headers?.['content-type'] ?? '')) throw new ApiError(415, 'Enviá JSON.');
      const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      if (!raw || Buffer.byteLength(raw, 'utf8') > 24000) throw new ApiError(413, 'El mensaje es demasiado largo.');
      let body;
      try { body = JSON.parse(raw); } catch { throw new InputError('JSON inválido.'); }
      if (kind === 'capture') {
        const capture = validateCapture(body);
        // Server-derived owner, durable unique key and content conflict check.
        const receipt = await dependencies.receiveCapture(session, capture);
        return res.status(receipt.duplicate ? 200 : 202).json({ id: receipt.id, status: 'needs_review', duplicate: receipt.duplicate });
      }
      const request = validateAssistantRequest(body);
      if (!await dependencies.reserveAIQuota(session)) throw new ApiError(429, 'Llegaste al límite de consultas. Podés seguir registrando manualmente.');
      // One bounded call, no automatic retry or model-initiated ledger writes.
      const response = await dependencies.respond(request);
      let answer;
      try { answer = validateAssistantResult(response, request); }
      catch { throw new ApiError(502, 'La IA devolvió una respuesta inválida. No se guardó ningún movimiento.'); }
      return res.status(200).json({ ...answer, evidence: request.facts.filter(f => answer.factIds.includes(f.id)) });
    } catch (error) {
      const status = error instanceof InputError ? 400 : error instanceof ApiError ? error.status : 503;
      // Do not leak provider bodies, auth tokens, prompts, financial text or keys.
      return res.status(status).json({ error: error instanceof InputError ? error.message
        : error instanceof ApiError ? error.message : 'No se pudo completar. Tus movimientos no cambiaron.' });
    }
  };
}
