// OpenAI adapter of the provider port (provider.js): the Responses API by plain fetch. Implementable but disabled: it
// runs only when the server configuration enables AI (runtime.js), and every test injects a fake fetch.
//
// The request is stateless and tool-free by construction: `store: false`, `background: false`, no `tools`,
// `tool_choice`, `previous_response_id`, `conversation`, `include` or `metadata`; a strict JSON schema is the only
// output channel; the output cap (which includes reasoning tokens), the effort and the service tier are explicit.
// A reply holding anything but a message and reasoning (a tool call of any kind) is refused, not parsed.
import { ProviderError } from './provider.js';

export const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';
/** Every key the adapter may send. Tests pin that nothing outside it (above all a tool) is ever added. */
export const OPENAI_REQUEST_KEYS = ['model', 'store', 'background', 'instructions', 'input', 'max_output_tokens', 'reasoning', 'service_tier', 'text'];
const ALLOWED_OUTPUT_ITEMS = ['message', 'reasoning'];
const BILLING_CODES = ['insufficient_quota', 'project_spend_limit_exceeded', 'organization_spend_limit_exceeded', 'organization_usage_limit_exceeded', 'credit_balance_exhausted'];

export function buildOpenAIRequest({ model, serviceTier }, request) {
  return {
    model, store: false, background: false,
    instructions: request.instructions, input: request.input,
    max_output_tokens: request.maxOutputTokens, reasoning: { effort: request.reasoningEffort }, service_tier: serviceTier,
    text: { format: { type: 'json_schema', name: 'finanzapp_assistant_v2', strict: true, schema: request.schema } },
  };
}

const int = value => Number.isSafeInteger(value) && value >= 0 ? value : null;
function usageOf(data) {
  const usage = data?.usage;
  if (!usage) return null;
  return { inputTokens: int(usage.input_tokens), cachedInputTokens: int(usage.input_tokens_details?.cached_tokens ?? 0),
    cacheWriteTokens: int(usage.input_tokens_details?.cache_write_tokens ?? 0), outputTokens: int(usage.output_tokens),
    reasoningTokens: int(usage.output_tokens_details?.reasoning_tokens ?? 0) };
}
const text = value => typeof value === 'string' && value.length <= 100 ? value : null;

/** One Responses API body → the port's result, or a ProviderError. Never returns partial output. */
export function parseOpenAIResponse(data) {
  const usage = usageOf(data);
  const served = { model: text(data?.model), tier: text(data?.service_tier) };
  if (data?.status !== 'completed') throw new ProviderError('incomplete', usage, served);
  const items = Array.isArray(data.output) ? data.output : [];
  if (items.some(item => !ALLOWED_OUTPUT_ITEMS.includes(item?.type))) throw new ProviderError('tool_call', usage, served);
  const parts = items.filter(item => item.type === 'message').flatMap(item => Array.isArray(item.content) ? item.content : []);
  if (parts.some(part => part?.type === 'refusal')) throw new ProviderError('refusal', usage, served);
  if (!parts.length || parts.some(part => part?.type !== 'output_text' || typeof part.text !== 'string')) throw new ProviderError('invalid', usage, served);
  try { return { output: JSON.parse(parts.map(part => part.text).join('')), usage, ...served }; }
  catch { throw new ProviderError('invalid', usage, served); }
}

export function createOpenAIProvider({ apiKey, model, serviceTier, timeoutMs, fetcher = fetch }) {
  if (typeof apiKey !== 'string' || !apiKey) throw new Error('Missing provider key');
  return {
    async respond(request, { signal } = {}) {
      const timeout = AbortSignal.timeout(timeoutMs);
      let response;
      try {
        response = await fetcher(OPENAI_RESPONSES_URL, { method: 'POST',
          headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
          body: JSON.stringify(buildOpenAIRequest({ model, serviceTier }, request)),
          signal: signal ? AbortSignal.any([signal, timeout]) : timeout });
      } catch (cause) {
        throw new ProviderError(cause?.name === 'TimeoutError' || cause?.name === 'AbortError' ? 'timeout' : 'network');
      }
      let data = null;
      try { data = await response.json(); } catch { /* A body that is not JSON is only a status. */ }
      if (!response.ok) {
        // Billing and spend-limit refusals are final: never retried, reported to the owner by category.
        const code = data?.error?.code ?? data?.error?.type;
        throw new ProviderError(response.status === 429 && BILLING_CODES.includes(code) ? 'spend_limit' : 'http');
      }
      if (data === null) throw new ProviderError('invalid');
      return parseOpenAIResponse(data);
    },
  };
}
