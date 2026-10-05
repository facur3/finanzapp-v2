// The provider-neutral port. The handler, the protocol and the cost accounting know only this shape; an adapter
// (openai.js today) turns it into one vendor request and back. No adapter is given a tool, a conversation id or
// persistent state: one stateless request in, one JSON object out.
//
// respond(request, { signal }) → { output, usage, model, tier }
//   request: { instructions, input, schema, maxOutputTokens, reasoningEffort }
//   output:  the parsed JSON the model produced (still untrusted: the handler validates it with the protocol)
//   usage:   { inputTokens, cachedInputTokens, cacheWriteTokens, outputTokens, reasoningTokens } or null
//   model, tier: what the provider reports it actually served, or null
// A failure is a ProviderError with a closed category and, when the provider reported it, the usage it billed.
import { createOpenAIProvider } from './openai.js';

export const PROVIDER_FAILURES = ['http', 'timeout', 'network', 'incomplete', 'refusal', 'invalid', 'tool_call', 'spend_limit'];

export class ProviderError extends Error {
  constructor(category, usage = null, served = {}) {
    super('Provider failure: ' + category);
    this.category = PROVIDER_FAILURES.includes(category) ? category : 'invalid';
    this.usage = usage;
    this.model = served.model ?? null;
    this.tier = served.tier ?? null;
  }
}

export const PROVIDERS = ['openai'];

export function createProvider(config, fetcher = fetch) {
  // Resolved at call time: openai.js imports ProviderError from here, and a cycle read at load time could see nothing.
  const adapter = { openai: createOpenAIProvider }[config.provider];
  if (!adapter) throw new Error('Unknown provider');
  return adapter({ apiKey: config.apiKey, project: config.providerProject, model: config.model, serviceTier: config.serviceTier, timeoutMs: config.providerTimeoutMs, fetcher });
}
