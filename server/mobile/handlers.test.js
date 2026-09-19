import { describe, it, expect, vi } from 'vitest';
import { createMobileHandler, ApiError } from './handlers.js';
import { createOpenAIResponder } from './openai.js';
import { mobileDependencies } from './runtime.js';
import { validateAssistantRequest, validateCapture, isDate } from '../../packages/integrations/contracts.js';
import disabledCapture from '../../api/mobile/captures.js';

const draft = { kind: 'expense', amountMinor: 1500000, currency: 'ARS', merchant: 'Fixture', category: 'Supermercado', dateISO: '2026-09-19', paymentMethodRef: null };
const capture = { version: 1, requestId: 'fixture-event-0001', source: 'shortcut', draft };
const request = { version: 1, action: 'parse', text: 'Gasté 15 mil en el super', todayISO: '2026-09-19', currency: 'ARS', facts: [] };
const answer = { kind: 'draft', message: 'Revisá el gasto.', draft, factIds: [] };
const headers = { authorization: 'Bearer fixture-access-token', 'content-type': 'application/json' };
function response() { return { code: 0, body: null, headers: {}, status(n) { this.code = n; return this; }, json(body) { this.body = body; return this; }, setHeader(k,v) { this.headers[k] = v; } }; }
function ports() { return { authenticate: vi.fn(async () => ({ userId: 'owner-from-session' })),
  receiveCapture: vi.fn(async () => ({ id: 'receipt', duplicate: false })), reserveAIQuota: vi.fn(async () => true), respond: vi.fn(async () => answer) }; }
async function call(kind, body, deps = ports(), override = {}) { const res = response(); await createMobileHandler(kind, deps)({ method: 'POST', body, headers, ...override }, res); return res; }

describe('cloud integration boundary', () => {
  it('is closed by default and never makes network/model calls', async () => {
    expect(mobileDependencies('capture', {})).toBeNull();
    expect(mobileDependencies('assistant', { MOBILE_INTEGRATIONS_ENABLED: 'true' })).toBeNull();
    const res = response(); await disabledCapture({ method: 'POST' }, res); expect(res.code).toBe(503);
    expect(res.headers['Cache-Control']).toBe('no-store');
  });
  it('requires POST, verified auth, JSON, bounded body and owned scope', async () => {
    for (const [override, code] of [[{ method: 'GET' },405], [{ headers: {} },401], [{ headers: { ...headers, 'content-type': 'text/plain' } },415]]) {
      expect((await call('capture', capture, ports(), override)).code).toBe(code);
    }
    expect((await call('capture', { ...capture, userId: 'someone-else' })).code).toBe(400);
    expect((await call('capture', 'x'.repeat(24001))).code).toBe(413);
    expect((await call('capture', '{bad json')).code).toBe(400);
    const deps = ports(); deps.authenticate.mockResolvedValue(null);
    expect((await call('capture', capture, deps)).code).toBe(401); expect(deps.receiveCapture).not.toHaveBeenCalled();
  });
  it('rejects lossy amounts, unrecognized currencies and invalid dates', () => {
    for (const amountMinor of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, '15000']) {
      expect(() => validateCapture({ ...capture, draft: { ...draft, amountMinor } })).toThrow();
    }
    expect(() => validateCapture({ ...capture, draft: { ...draft, currency: 'EUR' } })).toThrow();
    for (const day of ['2026-13-01','2026-02-30','bad',null]) expect(isDate(day)).toBe(false);
    expect(isDate('2024-02-29')).toBe(true);
    expect(validateCapture({ ...capture, draft: { ...draft, amountMinor: null } }).draft.amountMinor).toBeNull();
  });
  it('returns only a durable pending receipt, never an expense confirmation', async () => {
    const deps = ports(); const res = await call('capture', capture, deps);
    expect(res.code).toBe(202); expect(res.body.status).toBe('needs_review');
    expect(deps.receiveCapture.mock.calls[0][0].userId).toBe('owner-from-session');
    deps.receiveCapture.mockResolvedValue({ id: 'receipt', duplicate: true });
    expect((await call('capture', capture, deps)).code).toBe(200);
    deps.receiveCapture.mockRejectedValue(new ApiError(409, 'Conflicto'));
    expect((await call('capture', capture, deps)).code).toBe(409);
    deps.receiveCapture.mockRejectedValue(new Error('secret provider/token text'));
    const failed = await call('capture', capture, deps); expect(failed.code).toBe(503); expect(JSON.stringify(failed.body)).not.toContain('secret');
  });
  it('reserves durable quota before any model call, even on repeated requests', async () => {
    const deps = ports(); deps.reserveAIQuota.mockResolvedValue(false);
    expect((await call('assistant', request, deps)).code).toBe(429); expect(deps.respond).not.toHaveBeenCalled();
    deps.reserveAIQuota.mockResolvedValue(true);
    expect((await call('assistant', request, deps)).code).toBe(200);
    expect(deps.receiveCapture).not.toHaveBeenCalled();
  });
  it('rejects malformed model output and fabricated evidence or future dates', async () => {
    const deps = ports();
    for (const invalid of [{ ...answer, factIds: ['invented'] }, { ...answer, draft: { ...draft, dateISO: '2026-09-20' } }, { ...answer, draft: { ...draft, amountMinor: 1.5 } }]) {
      deps.respond.mockResolvedValue(invalid);
      expect((await call('assistant', request, deps)).code).toBe(502);
    }
    deps.respond.mockResolvedValue({ kind: 'answer', message: 'Ahorraste', draft: null, factIds: [] });
    expect((await call('assistant', { ...request, action: 'explain' }, deps)).code).toBe(502);
  });
  it('requires complete fact provenance and returns the provided evidence with answers', async () => {
    const fact = { id: 'current.expenses', label: 'Gastos registrados', amountMinor: 1500000, count: 1, startISO: '2026-09-01', endISO: '2026-09-19' };
    const query = { ...request, action: 'explain', facts: [fact] };
    const deps = ports(); deps.respond.mockResolvedValue({ kind: 'answer', message: 'Hay un gasto registrado.', draft: null, factIds: [fact.id] });
    expect((await call('assistant', query, deps)).body.evidence).toEqual([fact]);
    expect(() => validateAssistantRequest({ ...query, facts: [fact, fact] })).toThrow();
  });
  it('bounds provider calls, disables storage, and handles refusal/incomplete/error without retry', async () => {
    const fetcher = vi.fn(async () => ({ ok: true, json: async () => ({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(answer) }] }] }) }));
    const respond = createOpenAIResponder({ apiKey: 'fixture-key', fetcher });
    expect(await respond(request)).toEqual(answer);
    const sent = JSON.parse(fetcher.mock.calls[0][1].body);
    expect(sent).toMatchObject({ store: false, max_output_tokens: 1800, model: 'gpt-5-mini' });
    expect(sent.text.format.strict).toBe(true);
    fetcher.mockResolvedValue({ ok: true, json: async () => ({ status: 'incomplete' }) });
    await expect(respond(request)).rejects.toMatchObject({ status: 502 });
    fetcher.mockResolvedValue({ ok: true, json: async () => ({ status: 'completed', output: [{ type: 'message', content: [{ type: 'refusal' }] }] }) });
    await expect(respond(request)).rejects.toMatchObject({ status: 422 });
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
  it('uses the verified session for database access and fails closed on quota outages', async () => {
    const fetcher = vi.fn(async () => ({ ok: true, json: async () => ({ id: 'verified-owner' }) }));
    const env = { MOBILE_INTEGRATIONS_ENABLED: 'true', MOBILE_SUPABASE_URL: 'https://example.supabase.co', MOBILE_SUPABASE_PUBLISHABLE_KEY: 'fixture-public' };
    const deps = mobileDependencies('capture', env, fetcher);
    const session = await deps.authenticate(headers.authorization);
    expect(session.userId).toBe('verified-owner');
    fetcher.mockResolvedValue({ ok: false, status: 500 });
    await expect(deps.reserveAIQuota(session)).rejects.toMatchObject({ status: 503 });
    expect(fetcher.mock.calls[1][1].headers.Authorization).toBe(headers.authorization);
  });
});
