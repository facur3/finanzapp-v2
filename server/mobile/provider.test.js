import { describe, it, expect, vi } from 'vitest';
import { buildOpenAIRequest, parseOpenAIResponse, createOpenAIProvider, OPENAI_REQUEST_KEYS, OPENAI_RESPONSES_URL } from './openai.js';
import { ProviderError, createProvider } from './provider.js';
import { providerRequest, inputTokenBound, ASSISTANT_INSTRUCTIONS } from './assistant-prompt.js';
import { aiConfig } from './runtime.js';
import { maxCostMicroUsd, actualCostMicroUsd, usageOrNull, simulateMonthlyCost } from './cost.js';
import { PRICING } from './pricing.js';
import { ASSISTANT_RESULT_SCHEMA, validateAssistantRequestV2 } from '../../packages/integrations/assistant-protocol.js';

const request = validateAssistantRequestV2({ version: 2, requestId: 'fixture-request-0001', action: 'parse', text: 'Gasté 15 mil en el super', todayISO: '2026-09-19', currency: 'ARS', region: 'AR', facts: [] });
const output = { type: 'out_of_scope', message: 'Solo finanzas.', evidenceIds: [], navigation: null, proposals: [], clarification: null };
const completed = (extra = {}) => ({ status: 'completed', model: 'gpt-6-luna-2026-09-01', service_tier: 'default',
  output: [{ type: 'reasoning', summary: [] }, { type: 'message', content: [{ type: 'output_text', text: JSON.stringify(output) }] }],
  usage: { input_tokens: 3000, input_tokens_details: { cached_tokens: 1000, cache_write_tokens: 0 }, output_tokens: 400, output_tokens_details: { reasoning_tokens: 100 } }, ...extra });
const ai = aiConfig({ MOBILE_AI_ENABLED: 'true', MOBILE_AI_PROVIDER: 'openai', MOBILE_AI_MODEL: 'gpt-6-luna', MOBILE_AI_API_KEY: 'fixture-key' });
const luna = PRICING.models['openai:gpt-6-luna'];

describe('OpenAI request: stateless, tool-free, strict and bounded', () => {
  const call = providerRequest(request, ai);
  const body = buildOpenAIRequest(ai, call);
  it('sends only allowlisted keys and grants no capability', () => {
    expect(Object.keys(body).sort()).toEqual([...OPENAI_REQUEST_KEYS].sort());
    for (const forbidden of ['tools', 'tool_choice', 'parallel_tool_calls', 'previous_response_id', 'conversation', 'include', 'metadata', 'prompt', 'user'])
      expect(body).not.toHaveProperty(forbidden);
    expect(body).toMatchObject({ model: 'gpt-6-luna', store: false, background: false, max_output_tokens: 1500, reasoning: { effort: 'low' }, service_tier: 'default' });
    expect(body.text.format).toEqual({ type: 'json_schema', name: 'finanzapp_assistant_v2', strict: true, schema: ASSISTANT_RESULT_SCHEMA });
    expect(JSON.stringify(body)).not.toMatch(/web_search|code_interpreter|computer|mcp|shell|file_search|image_generation|function/i);
  });
  it('sends the person\'s data as one JSON input, never in the instructions, and nothing but the request fields', () => {
    expect(body.instructions).toBe(ASSISTANT_INSTRUCTIONS);
    expect(body.instructions).not.toContain('Gasté');
    expect(JSON.parse(body.input)).toEqual({ action: 'parse', text: 'Gasté 15 mil en el super', todayISO: '2026-09-19', currency: 'ARS', region: 'AR', facts: [] });
  });
  it('uses a schema that strict structured outputs accept: object root, every key required, no open objects', () => {
    const walk = (node, path) => {
      if (node.type === 'object' || (Array.isArray(node.type) && node.type.includes('object'))) {
        expect(node.additionalProperties, path).toBe(false);
        expect([...node.required].sort(), path).toEqual(Object.keys(node.properties).sort());
        for (const [key, child] of Object.entries(node.properties)) walk(child, path + '.' + key);
      }
      for (const child of node.anyOf ?? []) walk(child, path + '|');
      if (node.items) walk(node.items, path + '[]');
      for (const unsupported of ['allOf', 'not', 'if', 'then', 'else', 'minLength', 'maxLength', 'dependentRequired']) expect(node, path).not.toHaveProperty(unsupported);
    };
    expect(ASSISTANT_RESULT_SCHEMA.type).toBe('object');
    expect(ASSISTANT_RESULT_SCHEMA).not.toHaveProperty('anyOf');
    walk(ASSISTANT_RESULT_SCHEMA, '$');
  });
  it('bounds input tokens from bytes, above any byte-level tokenizer count', () => {
    const bound = inputTokenBound(call);
    const bytes = new TextEncoder().encode(call.instructions + call.input + JSON.stringify(call.schema)).length;
    expect(bound).toBeGreaterThan(bytes);
    expect(bound).toBeLessThan(ai.maxInputTokens);
  });
});

describe('OpenAI response: anything but a completed message is no answer', () => {
  it('parses a completed reply with its usage and served model and tier', () => {
    expect(parseOpenAIResponse(completed())).toEqual({ output, model: 'gpt-6-luna-2026-09-01', tier: 'default',
      usage: { inputTokens: 3000, cachedInputTokens: 1000, cacheWriteTokens: 0, outputTokens: 400, reasoningTokens: 100 } });
  });
  it('refuses tool calls, refusals, incomplete, empty or non-JSON output, keeping the billed usage', () => {
    const cases = [
      [completed({ output: [{ type: 'function_call', name: 'delete_ledger', arguments: '{}' }] }), 'tool_call'],
      [completed({ output: [{ type: 'web_search_call' }, ...completed().output] }), 'tool_call'],
      [completed({ output: [{ type: 'mcp_call' }] }), 'tool_call'],
      [completed({ output: [{ type: 'message', content: [{ type: 'refusal', refusal: 'no' }] }] }), 'refusal'],
      [completed({ status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' } }), 'incomplete'],
      [completed({ status: 'failed' }), 'incomplete'],
      [completed({ output: [] }), 'invalid'],
      [completed({ output: [{ type: 'message', content: [{ type: 'output_text', text: '{"type":' }] }] }), 'invalid'],
      [completed({ output: [{ type: 'message', content: [{ type: 'output_audio' }] }] }), 'invalid'],
    ];
    for (const [data, category] of cases) {
      let error;
      try { parseOpenAIResponse(data); } catch (caught) { error = caught; }
      expect(error, category).toBeInstanceOf(ProviderError);
      expect(error.category).toBe(category);
      expect(error.usage?.inputTokens).toBe(3000);
    }
  });
  it('calls the Responses API once with the key in a header, no retry, and classifies failures', async () => {
    const fetcher = vi.fn(async () => ({ ok: true, json: async () => completed() }));
    const provider = createProvider(ai, fetcher);
    expect((await provider.respond(providerRequest(request, ai))).output).toEqual(output);
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe(OPENAI_RESPONSES_URL);
    expect(init.headers.Authorization).toBe('Bearer fixture-key');
    expect(init.body).not.toContain('fixture-key');
    for (const [reply, category] of [
      [{ ok: false, status: 429, json: async () => ({ error: { code: 'project_spend_limit_exceeded', type: 'insufficient_quota' } }) }, 'spend_limit'],
      [{ ok: false, status: 429, json: async () => ({ error: { type: 'insufficient_quota' } }) }, 'spend_limit'],
      [{ ok: false, status: 429, json: async () => ({ error: { code: 'slow_down' } }) }, 'http'],
      [{ ok: false, status: 500, json: async () => { throw new Error('html'); } }, 'http'],
      [{ ok: true, json: async () => { throw new Error('not json'); } }, 'invalid'],
    ]) {
      fetcher.mockResolvedValueOnce(reply);
      await expect(provider.respond(providerRequest(request, ai))).rejects.toMatchObject({ category });
    }
    fetcher.mockRejectedValueOnce(Object.assign(new Error('t'), { name: 'TimeoutError' }));
    await expect(provider.respond(providerRequest(request, ai))).rejects.toMatchObject({ category: 'timeout' });
    fetcher.mockRejectedValueOnce(new TypeError('fetch failed'));
    await expect(provider.respond(providerRequest(request, ai))).rejects.toMatchObject({ category: 'network' });
    expect(fetcher).toHaveBeenCalledTimes(8);
    expect(() => createOpenAIProvider({ apiKey: '', model: 'gpt-6-luna', serviceTier: 'default', timeoutMs: 1 })).toThrow();
  });
});

describe('cost model: integer micro-USD, rounded up, worst case first', () => {
  it('prices the maximum with every input token at the highest input rate', () => {
    // 8000 × 0.125 (cache write, the highest) + 1500 × 0.50 USD per million tokens.
    expect(maxCostMicroUsd(luna, { inputTokens: 8000, outputTokens: 1500 })).toBe(1750);
    expect(maxCostMicroUsd(luna, { inputTokens: 1, outputTokens: 0 })).toBe(1); // 0.125 µUSD rounds up, never to zero.
    expect(() => maxCostMicroUsd(luna, { inputTokens: 1.5, outputTokens: 1 })).toThrow();
  });
  it('settles from usage, never above the bound computed from the same caps', () => {
    const usage = { inputTokens: 3000, cachedInputTokens: 1000, cacheWriteTokens: 500, outputTokens: 400, reasoningTokens: 100 };
    // 1500 × 0.10 + 1000 × 0.01 + 500 × 0.125 + 400 × 0.50 = 422.5 → 423.
    expect(actualCostMicroUsd(luna, usage)).toBe(423);
    expect(actualCostMicroUsd(luna, usage)).toBeLessThanOrEqual(maxCostMicroUsd(luna, { inputTokens: 3000, outputTokens: 400 }));
    for (const bad of [null, { ...usage, inputTokens: -1 }, { ...usage, cachedInputTokens: 3001 }, { ...usage, reasoningTokens: 401 }, { ...usage, outputTokens: 0.5 }]) {
      expect(usageOrNull(bad)).toBeNull();
      expect(() => actualCostMicroUsd(luna, bad)).toThrow();
    }
  });
  it('prices an unreported cache-write count at the highest input rate, never as zero writes (security review)', () => {
    const parsed = parseOpenAIResponse(completed({ usage: { input_tokens: 20000, input_tokens_details: { cached_tokens: 0 }, output_tokens: 300, output_tokens_details: { reasoning_tokens: 0 } } }));
    expect(parsed.usage.cacheWriteTokens).toBeNull();
    // 20 000 × 0.125 + 300 × 0.50 = 2 650 µUSD, the same as if every uncached token were a cache write.
    expect(actualCostMicroUsd(luna, parsed.usage)).toBe(2650);
    expect(actualCostMicroUsd(luna, { ...parsed.usage, cacheWriteTokens: 0 })).toBe(2150);
  });
  it('simulates monthly cost deterministically from sample requests', () => {
    const requests = [1, 2, 3, 4].map(n => ({ inputTokens: 1000 * n, cachedInputTokens: 0, cacheWriteTokens: 0, outputTokens: 200 * n, reasoningTokens: 0 }));
    const result = simulateMonthlyCost(luna, { requests, monthlyRequests: [30, 300], people: 2 });
    expect(result.perRequest).toEqual({ p50: 400, p95: 800, max: 800 });
    expect(result.months).toEqual([{ requests: 30, typicalMicroUsd: 24000, p95MicroUsd: 48000 }, { requests: 300, typicalMicroUsd: 240000, p95MicroUsd: 480000 }]);
    expect(() => simulateMonthlyCost(luna, { requests: [], monthlyRequests: [1] })).toThrow();
  });
  it('keeps prices as integer data with a dated source', () => {
    expect(PRICING.readOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    for (const price of Object.values(PRICING.models))
      for (const key of ['inputPerMTok', 'cachedInputPerMTok', 'cacheWritePerMTok', 'outputPerMTok']) expect(Number.isSafeInteger(price[key]) && price[key] > 0).toBe(true);
  });
});

describe('the model is configuration, never code', () => {
  it('names no model outside the price table in the request path', async () => {
    const { readdirSync, readFileSync } = await import('node:fs');
    const files = [...readdirSync('server/mobile').filter(f => f.endsWith('.js') && !f.endsWith('.test.js') && f !== 'pricing.js').map(f => 'server/mobile/' + f),
      ...readdirSync('api/mobile').map(f => 'api/mobile/' + f), 'packages/integrations/assistant-protocol.js'];
    for (const file of files) expect(readFileSync(file, 'utf8'), file).not.toMatch(/\b(?:gpt|claude|gemini|o\d)-[a-z0-9.]/i);
  });
});
