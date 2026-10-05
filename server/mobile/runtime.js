import { ApiError } from './handlers.js';
import { PRICING } from './pricing.js';
import { PROVIDERS, createProvider } from './provider.js';

/** One timeout budget for the whole handler, below the app's 35 s wait: session check, reservation, the provider call
 * and the settlement, each bounded, in that order. Never a retry inside it. */
export const TIMEOUTS_MS = Object.freeze({ authenticate: 5000, reserve: 5000, provider: 20000, settle: 4000 });
export const CLIENT_TIMEOUT_MS = 35000;

const tokens = (raw, fallback, min, max) => {
  if (raw === undefined || raw === '') return fallback;
  const value = /^\d{1,6}$/.test(raw) ? Number(raw) : NaN;
  return value >= min && value <= max ? value : null;
};

/** The Assistant's server configuration, or null (fail closed) when anything is missing or outside its allowlist.
 * The model is configuration, never a code default: changing it is an environment change, not an app build. A model
 * without a price in pricing.js, an effort it does not take or a token cap outside the bounds disables the route. */
export function aiConfig(env) {
  if (env.MOBILE_AI_ENABLED !== 'true') return null;
  const provider = env.MOBILE_AI_PROVIDER;
  const model = env.MOBILE_AI_MODEL;
  if (!PROVIDERS.includes(provider) || typeof model !== 'string' || !/^[a-z0-9][a-z0-9.-]{0,63}$/.test(model)) return null;
  const modelKey = provider + ':' + model;
  const price = PRICING.models[modelKey];
  const reasoningEffort = env.MOBILE_AI_REASONING_EFFORT || 'low';
  const maxInputTokens = tokens(env.MOBILE_AI_MAX_INPUT_TOKENS, 32000, 6000, 32000);
  const maxOutputTokens = tokens(env.MOBILE_AI_MAX_OUTPUT_TOKENS, 1500, 256, 4000);
  if (!price || !price.reasoningEfforts.includes(reasoningEffort) || maxInputTokens === null || maxOutputTokens === null
    || maxInputTokens >= price.shortContextTokens || typeof env.MOBILE_AI_API_KEY !== 'string' || !env.MOBILE_AI_API_KEY) return null;
  return Object.freeze({ provider, model, modelKey, price, reasoningEffort, maxInputTokens, maxOutputTokens, serviceTier: 'default',
    providerTimeoutMs: TIMEOUTS_MS.provider, apiKey: env.MOBILE_AI_API_KEY });
}

/** Explicit opt-in, separate staging project. Two Supabase keys, both server-side only (never `EXPO_PUBLIC_*`):
 * - the publishable key verifies the person's session (`/auth/v1/user` with their token);
 * - the secret key calls the privileged functions (inbox, reservations, settlement), which no client role may execute.
 *   It travels only in the `apikey` header and never with a person's token, so those calls run as `service_role`
 *   after the session was verified, and the owner id they receive is the verified one. */
export function mobileDependencies(kind, env = process.env, fetcher = fetch) {
  if (env.MOBILE_INTEGRATIONS_ENABLED !== 'true' || !env.MOBILE_SUPABASE_URL || !env.MOBILE_SUPABASE_PUBLISHABLE_KEY || !env.MOBILE_SUPABASE_SECRET_KEY) return null;
  const ai = kind === 'assistant' ? aiConfig(env) : null;
  if (kind === 'assistant' && !ai) return null;
  const url = new URL(env.MOBILE_SUPABASE_URL);
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) return null;
  const rpc = async (name, body, timeout) => {
    const response = await fetcher(url.origin + '/rest/v1/rpc/' + name, { method: 'POST',
      headers: { apikey: env.MOBILE_SUPABASE_SECRET_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(body), signal: AbortSignal.timeout(timeout) });
    if (!response.ok) throw new ApiError(503, 'La integración no está disponible. No se registró el movimiento.', 'database');
    return response.json();
  };
  const dependencies = {
    authenticate: async token => {
      const response = await fetcher(url.origin + '/auth/v1/user', { headers: { apikey: env.MOBILE_SUPABASE_PUBLISHABLE_KEY, Authorization: token },
        signal: AbortSignal.timeout(TIMEOUTS_MS.authenticate) });
      if (response.status === 401 || response.status === 403) throw new ApiError(401, 'Iniciá sesión de nuevo.', 'auth');
      if (!response.ok) throw new ApiError(503, 'No pudimos verificar tu sesión.', 'auth_unavailable');
      const user = await response.json();
      if (typeof user.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(user.id) || user.is_anonymous) throw new ApiError(401, 'Necesitás una cuenta verificada.', 'auth');
      return { userId: user.id };
    },
    receiveCapture: async (session, capture) => {
      const receipt = await rpc('mobile_receive_capture', { p_user_id: session.userId, p_request_id: capture.requestId, p_source: capture.source, p_payload: capture.draft }, TIMEOUTS_MS.reserve);
      if (receipt.error === 'conflict') throw new ApiError(409, 'Este identificador ya corresponde a otra captura.', 'conflict');
      if (receipt.error === 'limit') throw new ApiError(429, 'Llegaste al límite de capturas del día.', 'rate');
      if (typeof receipt.id !== 'string' || typeof receipt.duplicate !== 'boolean') throw new Error('Invalid receipt');
      return receipt;
    },
  };
  if (!ai) return dependencies;
  return { ...dependencies, ai, provider: createProvider(ai, fetcher),
    reserveAI: async (session, plan) => {
      const reply = await rpc('mobile_ai_reserve', { p_user_id: session.userId, p_request_id: plan.requestId, p_model: plan.model,
        p_max_micro_usd: plan.maxMicroUsd, p_input_tokens: plan.inputTokens, p_output_tokens: plan.outputTokens }, TIMEOUTS_MS.reserve);
      if (typeof reply?.error === 'string') return { error: reply.error };
      if (typeof reply?.id !== 'string') throw new ApiError(503, 'El asistente no está disponible ahora. Podés registrar manualmente.', 'reservation_unknown');
      return { id: reply.id };
    },
    settleAI: async (session, id, settlement) => {
      const usage = settlement.usage;
      const settled = await rpc('mobile_ai_settle', { p_user_id: session.userId, p_reservation_id: id, p_state: settlement.state,
        p_charged_micro_usd: settlement.chargedMicroUsd, p_input_tokens: usage?.inputTokens ?? null, p_cached_input_tokens: usage?.cachedInputTokens ?? null,
        p_cache_write_tokens: usage?.cacheWriteTokens ?? null, p_output_tokens: usage?.outputTokens ?? null, p_reasoning_tokens: usage?.reasoningTokens ?? null }, TIMEOUTS_MS.settle);
      if (settled !== true) throw new Error('Not settled');
    },
  };
}
