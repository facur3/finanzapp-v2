import { ApiError } from './handlers.js';
import { createOpenAIResponder } from './openai.js';

/** Explicit opt-in, separate staging project; no service-role key required. */
export function mobileDependencies(kind, env = process.env, fetcher = fetch) {
  if (env.MOBILE_INTEGRATIONS_ENABLED !== 'true' || !env.MOBILE_SUPABASE_URL || !env.MOBILE_SUPABASE_PUBLISHABLE_KEY
    || (kind === 'assistant' && (!env.MOBILE_OPENAI_API_KEY || env.MOBILE_AI_ENABLED !== 'true'))) return null;
  const url = new URL(env.MOBILE_SUPABASE_URL);
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) return null;
  const headers = token => ({ apikey: env.MOBILE_SUPABASE_PUBLISHABLE_KEY, Authorization: token, 'Content-Type': 'application/json' });
  const rpc = async (session, name, body) => {
    const response = await fetcher(url.origin + '/rest/v1/rpc/' + name, { method: 'POST', headers: headers(session.token),
      body: JSON.stringify(body), signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new ApiError(503, 'La integración no está disponible. No se registró el movimiento.');
    return response.json();
  };
  return {
    authenticate: async token => {
      const response = await fetcher(url.origin + '/auth/v1/user', { headers: headers(token), signal: AbortSignal.timeout(10000) });
      if (response.status === 401 || response.status === 403) throw new ApiError(401, 'Iniciá sesión de nuevo.');
      if (!response.ok) throw new ApiError(503, 'No pudimos verificar tu sesión.');
      const user = await response.json();
      if (typeof user.id !== 'string' || user.is_anonymous) throw new ApiError(401, 'Necesitás una cuenta verificada.');
      return { userId: user.id, token };
    },
    receiveCapture: async (session, capture) => {
      const receipt = await rpc(session, 'mobile_receive_capture', { p_request_id: capture.requestId, p_source: capture.source, p_payload: capture.draft });
      if (receipt.error === 'conflict') throw new ApiError(409, 'Este identificador ya corresponde a otra captura.');
      if (receipt.error === 'limit') throw new ApiError(429, 'Llegaste al límite de capturas del día.');
      if (typeof receipt.id !== 'string' || typeof receipt.duplicate !== 'boolean') throw new Error('Invalid receipt');
      return receipt;
    },
    reserveAIQuota: async session => await rpc(session, 'mobile_reserve_usage', { p_kind: 'assistant' }) === true,
    respond: createOpenAIResponder({ apiKey: env.MOBILE_OPENAI_API_KEY, fetcher }),
  };
}
