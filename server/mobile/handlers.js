import { InputError, validateCapture } from '../../packages/integrations/contracts.js';
import { PROTOCOL_LIMITS, recoverAssistantResultV2, validateAssistantRequest } from '../../packages/integrations/assistant-protocol.js';
import { providerRequest, inputTokenBound } from './assistant-prompt.js';
import { actualCostMicroUsd, maxCostMicroUsd, usageOrNull } from './cost.js';

export class ApiError extends Error {
  constructor(status, message, category = 'internal') { super(message); this.status = status; this.category = category; }
}

/** Operational telemetry: only these keys, only identifiers, enums and integers. Never a prompt, a merchant, an
 * account or card name, an amount of the person's money, provider prose, a key or a bearer token. `dropped` counts the
 * optional names the boundary dropped from a proposal (never which, never their text), so a model's miss of the stated
 * bound stays visible once it no longer ends in `output_invalid`. */
const TELEMETRY_KEYS = ['route', 'requestId', 'userId', 'status', 'category', 'latencyMs', 'model', 'tier', 'inputTokens', 'cachedInputTokens',
  'cacheWriteTokens', 'outputTokens', 'reasoningTokens', 'inputTokenBound', 'reservedMicroUsd', 'chargedMicroUsd', 'settlement', 'dropped'];
const TOKEN = /^[A-Za-z0-9_.:-]{1,100}$/;
export function telemetryEvent(fields) {
  const event = {};
  for (const key of TELEMETRY_KEYS) {
    const value = fields[key];
    if ((typeof value === 'string' && TOKEN.test(value)) || (Number.isSafeInteger(value) && value >= 0)) event[key] = value;
  }
  return event;
}
const defaultLog = event => console.log(JSON.stringify(event));

/** A failed reservation as a closed category, its status and the person's words (no detail of the budget). */
const RESERVATION_ERRORS = {
  disabled: [503, 'El asistente no está disponible ahora. Podés registrar manualmente.'],
  duplicate: [409, 'Esta consulta ya se procesó. Escribila de nuevo si querés otra respuesta.'],
  rate: [429, 'Estás haciendo muchas consultas seguidas. Probá en un rato; podés registrar manualmente.'],
  busy: [429, 'Ya hay una consulta en curso. Esperá a que termine.'],
  user_budget: [429, 'Llegaste al límite de uso del asistente por ahora. Podés seguir registrando manualmente.'],
  request_too_large: [413, 'El mensaje es demasiado largo.'],
  global_budget: [503, 'El asistente no está disponible ahora. Podés registrar manualmente.'],
  // The database belongs to another environment than this deployment: a configuration error, never retried.
  environment: [503, 'El asistente no está disponible ahora. Podés registrar manualmente.'],
};
export function reservationError(code) {
  const [status, message] = RESERVATION_ERRORS[code] ?? [503, 'El asistente no está disponible ahora. Podés registrar manualmente.'];
  return new ApiError(status, message, RESERVATION_ERRORS[code] ? code : 'reservation_unknown');
}

const PROVIDER_STATUS = { refusal: [422, 'No se pudo interpretar. Probá reformular el mensaje.'], spend_limit: [503, 'El asistente no está disponible ahora. Podés registrar manualmente.'] };

/** Whether the provider reports serving the configured model (or one of its snapshots) on the priced tier. The
 * evaluation harness applies the same rule, so a run served by another model is never scored as the candidate. */
export function servedAsConfigured(ai, served) {
  return typeof served.model === 'string' && (served.model === ai.model || served.model.startsWith(ai.model + '-')) && served.tier === ai.serviceTier;
}

/** Usage the settlement may rely on: complete, consistent, for the configured model, on the priced tier. */
function trustedUsage(ai, served) {
  const usage = usageOrNull(served.usage);
  return usage && servedAsConfigured(ai, served) ? usage : null;
}

/** The Assistant route after the session and the body are verified. Order, each step before the next:
 * validate the request → bound its input tokens and price its worst case → reserve that worst case atomically
 * (kill switch, idempotency, rate, concurrency, per-user and global ceilings: all in the database) → one provider call,
 * no retry → settle (actual cost only from trustworthy usage; otherwise the reservation stays at its maximum) →
 * validate the output again with the protocol → reply with the result and the cited evidence. The output validation has
 * one recovery (25A-06, decision A): a proposal whose only fault is an over-long merchant or category comes back with
 * that name null and `dropped` naming it, never cut; every other refusal is 502 `output_invalid`, nothing saved. */
async function assistant(session, body, deps, telemetry) {
  const request = validateAssistantRequest(body);
  telemetry.requestId = request.requestId;
  const { ai } = deps;
  const call = providerRequest(request, ai);
  const bound = inputTokenBound(call);
  telemetry.inputTokenBound = bound;
  if (bound > ai.maxInputTokens) throw new ApiError(413, 'El mensaje es demasiado largo.', 'too_large');
  const maxMicroUsd = maxCostMicroUsd(ai.price, { inputTokens: bound, outputTokens: ai.maxOutputTokens });
  const reservation = await deps.reserveAI(session, { requestId: request.requestId, model: ai.modelKey, maxMicroUsd, inputTokens: bound, outputTokens: ai.maxOutputTokens });
  if (reservation.error) throw reservationError(reservation.error);
  telemetry.reservedMicroUsd = maxMicroUsd;
  telemetry.model = ai.model;

  let served, failure = null;
  try { served = await deps.provider.respond(call); }
  catch (error) { failure = error; served = { usage: error?.usage ?? null, model: error?.model ?? null, tier: error?.tier ?? null }; }
  const usage = trustedUsage(ai, served);
  Object.assign(telemetry, usage ?? {}, { tier: served.tier ?? undefined });
  const charged = usage ? actualCostMicroUsd(ai.price, usage) : null;
  try {
    // Exactly once, guarded by state in the database. Unknown cost stays reserved at the maximum: never released.
    await deps.settleAI(session, reservation.id, charged === null ? { state: 'unsettled', chargedMicroUsd: null, usage: null }
      : { state: 'settled', chargedMicroUsd: charged, usage });
    telemetry.chargedMicroUsd = charged ?? maxMicroUsd;
  } catch {
    telemetry.settlement = 'failed'; // The reservation stays `reserved` at its maximum: counted, never freed.
  }
  if (failure) {
    const category = 'provider_' + (failure.category ?? 'invalid');
    const [status, message] = PROVIDER_STATUS[failure.category] ?? [502, 'La IA no respondió. No se guardó ningún movimiento.'];
    throw new ApiError(status, message, category);
  }
  let result, dropped;
  try { ({ result, dropped } = recoverAssistantResultV2(served.output, request)); }
  catch { throw new ApiError(502, 'La IA devolvió una respuesta inválida. No se guardó ningún movimiento.', 'output_invalid'); }
  if (dropped.length) telemetry.dropped = dropped.length;
  // `dropped` rides only on a recovered reply: the normal path keeps its wire shape, so a client built before this
  // recovery still takes every reply it took before (and refuses a recovered one, which it got as a 502 until now).
  return { ...result, ...(dropped.length ? { dropped } : {}), evidence: request.facts.filter(fact => result.evidenceIds.includes(fact.id)) };
}

/** Dependencies are mandatory: never replace durable quotas/inbox with process memory. */
export function createMobileHandler(kind, dependencies) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Usá POST.' }); }
    if (!dependencies) return res.status(503).json({ error: 'La integración todavía no está habilitada.' });
    const started = (dependencies.now ?? Date.now)();
    const telemetry = { route: kind };
    let status = 500;
    try {
      const token = req.headers?.authorization;
      if (typeof token !== 'string' || !/^Bearer [^\s]{16,4096}$/.test(token)) throw new ApiError(401, 'Iniciá sesión de nuevo.', 'auth');
      const session = await dependencies.authenticate(token);
      if (!session?.userId) throw new ApiError(401, 'Sesión inválida.', 'auth');
      telemetry.userId = session.userId;
      if (!/^application\/json(?:;|$)/i.test(req.headers?.['content-type'] ?? '')) throw new ApiError(415, 'Enviá JSON.', 'input');
      const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      if (!raw || Buffer.byteLength(raw, 'utf8') > PROTOCOL_LIMITS.requestBytes) throw new ApiError(413, 'El mensaje es demasiado largo.', 'too_large');
      let body;
      try { body = JSON.parse(raw); } catch { throw new InputError('JSON inválido.'); }
      if (kind === 'capture') {
        const capture = validateCapture(body);
        // Server-derived owner, durable unique key and content conflict check.
        const receipt = await dependencies.receiveCapture(session, capture);
        status = receipt.duplicate ? 200 : 202;
        telemetry.category = 'ok';
        return res.status(status).json({ id: receipt.id, status: 'needs_review', duplicate: receipt.duplicate });
      }
      const reply = await assistant(session, body, dependencies, telemetry);
      status = 200;
      telemetry.category = 'ok';
      return res.status(200).json(reply);
    } catch (error) {
      status = error instanceof InputError ? 400 : error instanceof ApiError ? error.status : 503;
      telemetry.category = error instanceof InputError ? 'input' : error instanceof ApiError ? error.category : 'internal';
      // Do not leak provider bodies, auth tokens, prompts, financial text or keys.
      return res.status(status).json({ error: error instanceof InputError ? error.message
        : error instanceof ApiError ? error.message : 'No se pudo completar. Tus movimientos no cambiaron.' });
    } finally {
      telemetry.status = status;
      telemetry.latencyMs = Math.max(0, Math.round((dependencies.now ?? Date.now)() - started));
      try { (dependencies.log ?? defaultLog)(telemetryEvent(telemetry)); } catch { /* Telemetry never changes the reply. */ }
    }
  };
}
