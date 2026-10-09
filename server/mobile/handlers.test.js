import { describe, it, expect, vi } from 'vitest';
import { createMobileHandler, ApiError, telemetryEvent } from './handlers.js';
import { aiConfig, mobileDependencies, environmentOf, plausibleAccessToken, ENABLED_ENVIRONMENTS, TIMEOUTS_MS, CLIENT_TIMEOUT_MS } from './runtime.js';
import { PRICING } from './pricing.js';
import { validateCapture, isDate } from '../../packages/integrations/contracts.js';
import disabledCapture from '../../api/mobile/captures.js';
import disabledAssistant from '../../api/mobile/assistant.js';

const draft = { kind: 'expense', amountMinor: 1500000, currency: 'ARS', merchant: 'Fixture', category: 'Supermercado', dateISO: '2026-09-19', paymentMethodRef: null };
const capture = { version: 1, requestId: 'fixture-event-0001', source: 'shortcut', draft };
const request = { version: 2, requestId: 'fixture-request-0001', action: 'parse', text: 'Gasté 15 mil en el super', todayISO: '2026-09-19', currency: 'ARS', region: 'AR', facts: [] };
// What a model writes (protocol v4: the amount as an exact decimal in major units); a v2 request gets it in cents.
const { amountMinor: _cents, ...said } = draft;
const proposal = { type: 'proposal', message: 'Revisá el gasto.', evidenceIds: [], navigation: null, proposals: [{ kind: 'expense', amount: '15000', ...said, merchant: 'Kiosco Secreto', paymentMethodRef: 'Visa Secreta' }], clarification: null };
const usage = { inputTokens: 3000, cachedInputTokens: 1000, cacheWriteTokens: 0, outputTokens: 400, reasoningTokens: 100 };
const headers = { authorization: 'Bearer fixture-access-token', 'content-type': 'application/json' };
// Fixture Supabase keys of the current kinds, too short to match the repository's secret scanner (never real keys).
const PUBLISHABLE = 'sb_publishable_fixtureOnlyNotAKey';
const SECRET = 'sb_secret_fixtureOnlyNotAKey';
/** An unsigned token shaped like a Supabase access token of the fixture project (the remote check is faked). */
function accessToken(claims = {}) {
  const part = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  return 'Bearer ' + [part({ alg: 'ES256' }), part({ iss: 'https://example.supabase.co/auth/v1', aud: 'authenticated', role: 'authenticated',
    sub: '00000000-0000-4000-8000-000000000001', is_anonymous: false, exp: Math.floor(Date.now() / 1000) + 3600, ...claims }), 'c2lnbmF0dXJl'].join('.');
}
const STAGING_AI = { MOBILE_ENVIRONMENT: 'staging', VERCEL_ENV: 'production', MOBILE_AI_ENABLED: 'true', MOBILE_AI_PROVIDER: 'openai', MOBILE_AI_MODEL: 'gpt-6-luna',
  MOBILE_AI_API_KEY: 'sk-proj-fixture-only', MOBILE_AI_PROVIDER_PROJECT: 'proj_fixtureOnly01' };
const ai = aiConfig(STAGING_AI);
function response() { return { code: 0, body: null, headers: {}, status(n) { this.code = n; return this; }, json(body) { this.body = body; return this; }, setHeader(k, v) { this.headers[k] = v; } }; }
function ports() {
  return { authenticate: vi.fn(async () => ({ userId: '00000000-0000-4000-8000-000000000001' })),
    receiveCapture: vi.fn(async () => ({ id: 'receipt', duplicate: false })), ai, log: vi.fn(),
    reserveAI: vi.fn(async () => ({ id: 'reservation-1' })), settleAI: vi.fn(async () => {}),
    provider: { respond: vi.fn(async () => ({ output: proposal, usage, model: 'gpt-6-luna-2026-09-01', tier: 'default' })) } };
}
async function call(kind, body, deps = ports(), override = {}) { const res = response(); await createMobileHandler(kind, deps)({ method: 'POST', body, headers, ...override }, res); return res; }

describe('cloud integration boundary', () => {
  it('is closed by default and never makes network/model calls', async () => {
    expect(mobileDependencies('capture', {})).toBeNull();
    expect(mobileDependencies('assistant', { MOBILE_INTEGRATIONS_ENABLED: 'true' })).toBeNull();
    for (const route of [disabledCapture, disabledAssistant]) {
      const res = response(); await route({ method: 'POST' }, res); expect(res.code).toBe(503);
      expect(res.headers['Cache-Control']).toBe('no-store');
    }
  });
  it('requires POST, verified auth, JSON, bounded body and owned scope', async () => {
    for (const [override, code] of [[{ method: 'GET' }, 405], [{ headers: {} }, 401], [{ headers: { ...headers, 'content-type': 'text/plain' } }, 415]]) {
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
    for (const day of ['2026-13-01', '2026-02-30', 'bad', null]) expect(isDate(day)).toBe(false);
    expect(isDate('2024-02-29')).toBe(true);
    expect(validateCapture({ ...capture, draft: { ...draft, amountMinor: null } }).draft.amountMinor).toBeNull();
  });
  it('returns only a durable pending receipt, never an expense confirmation', async () => {
    const deps = ports(); const res = await call('capture', capture, deps);
    expect(res.code).toBe(202); expect(res.body.status).toBe('needs_review');
    expect(deps.receiveCapture.mock.calls[0][0].userId).toBe('00000000-0000-4000-8000-000000000001');
    deps.receiveCapture.mockResolvedValue({ id: 'receipt', duplicate: true });
    expect((await call('capture', capture, deps)).code).toBe(200);
    deps.receiveCapture.mockRejectedValue(new ApiError(409, 'Conflicto'));
    expect((await call('capture', capture, deps)).code).toBe(409);
    deps.receiveCapture.mockRejectedValue(new Error('secret provider/token text'));
    const failed = await call('capture', capture, deps); expect(failed.code).toBe(503); expect(JSON.stringify(failed.body)).not.toContain('secret');
  });
});

describe('assistant route: order, reservation and settlement', () => {
  it('validates, bounds, reserves the worst case, calls once and settles the actual cost', async () => {
    const deps = ports();
    const res = await call('assistant', request, deps);
    expect(res.code).toBe(200);
    expect(res.body.type).toBe('proposal');
    expect(res.body.proposals[0].paymentMethodRef).toBe('Visa Secreta');
    const plan = deps.reserveAI.mock.calls[0][1];
    expect(plan).toMatchObject({ requestId: request.requestId, model: 'openai:gpt-6-luna', outputTokens: ai.maxOutputTokens });
    expect(Number.isSafeInteger(plan.maxMicroUsd) && plan.maxMicroUsd > 0).toBe(true);
    expect(plan.inputTokens).toBeLessThanOrEqual(ai.maxInputTokens);
    expect(deps.provider.respond).toHaveBeenCalledTimes(1);
    expect(deps.reserveAI.mock.invocationCallOrder[0]).toBeLessThan(deps.provider.respond.mock.invocationCallOrder[0]);
    const [, id, settlement] = deps.settleAI.mock.calls[0];
    expect(id).toBe('reservation-1');
    // 2000 uncached × 0.10 + 1000 cached × 0.01 + 400 output × 0.50 USD per million tokens = 410 µUSD.
    expect(settlement).toEqual({ state: 'settled', chargedMicroUsd: 410, usage });
    expect(settlement.chargedMicroUsd).toBeLessThan(plan.maxMicroUsd);
  });
  it('makes no provider call when the reservation is refused, whatever the reason', async () => {
    const expected = { disabled: 503, duplicate: 409, rate: 429, busy: 429, user_budget: 429, global_budget: 503, request_too_large: 413, surprising: 503 };
    for (const [error, code] of Object.entries(expected)) {
      const deps = ports(); deps.reserveAI.mockResolvedValue({ error });
      const res = await call('assistant', request, deps);
      expect(res.code).toBe(code);
      expect(deps.provider.respond).not.toHaveBeenCalled();
      expect(deps.settleAI).not.toHaveBeenCalled();
      expect(deps.log.mock.calls[0][0].category).toBe(error === 'surprising' ? 'reservation_unknown' : error);
    }
    const deps = ports(); deps.reserveAI.mockRejectedValue(new Error('database down'));
    expect((await call('assistant', request, deps)).code).toBe(503);
    expect(deps.provider.respond).not.toHaveBeenCalled();
  });
  it('refuses oversized, malformed or v1 requests before any reservation or provider call', async () => {
    const deps = ports();
    const facts = Array.from({ length: 60 }, (_, i) => ({ id: 'current.category.' + i, label: 'Categoría de gasto: ' + 'x'.repeat(140), amountMinor: 1, count: 1, startISO: '2026-09-01', endISO: '2026-09-19' }));
    const huge = { ...request, action: 'explain', text: '¿'.repeat(1999) + '?', facts };
    const small = { ...deps, ai: aiConfig({ ...STAGING_AI, MOBILE_AI_MAX_INPUT_TOKENS: '6000' }) };
    expect((await call('assistant', huge, small)).code).toBe(413);
    for (const bad of [{ ...request, version: 1 }, { ...request, region: 'ar' }, { ...request, requestId: 'short' }, { ...request, locale: { language: 'en' } },
      { ...request, text: 'x'.repeat(2001) }, { ...request, text: 'Gasté 500 \u202Eodnum' }, { ...request, facts: facts.slice(0, 1) }]) {
      expect((await call('assistant', bad, deps)).code).toBe(400);
    }
    expect(deps.reserveAI).not.toHaveBeenCalled();
    expect(deps.provider.respond).not.toHaveBeenCalled();
  });
  // 25A-06: protocol v3 (v2 plus the interface `language` the reply is written in) is accepted next to v2; the model reads
  // the language only when it was sent, and a language never rides on a v2 request (docs/i18n.md §11, server first).
  it('accepts protocol v3 next to v2 and hands the model the language only when it was sent', async () => {
    const v3 = { ...request, version: 3, language: 'en' };
    const deps = ports();
    expect((await call('assistant', v3, deps)).code).toBe(200);
    expect(JSON.parse(deps.provider.respond.mock.calls[0][0].input)).toMatchObject({ language: 'en', region: 'AR', currency: 'ARS' });
    const legacy = ports();
    expect((await call('assistant', request, legacy)).code).toBe(200);
    expect(JSON.parse(legacy.provider.respond.mock.calls[0][0].input)).not.toHaveProperty('language');
    for (const bad of [{ ...request, language: 'en' }, { ...request, version: 3 }, { ...v3, language: 'EN' }, { ...v3, language: 'spa' }, { ...v3, language: null }, { ...v3, locale: { language: 'en' } }]) {
      const refused = ports();
      expect((await call('assistant', bad, refused)).code, JSON.stringify(bad)).toBe(400);
      expect(refused.reserveAI).not.toHaveBeenCalled();
      expect(refused.provider.respond).not.toHaveBeenCalled();
    }
  });
  // 25A-06: the model writes v4 (the amount as an exact decimal in major units, for the device to scale once it knows the
  // currency); a v4 client reads it as written and a v2 or v3 client reads the same amount in cents, as it always did.
  it('replies to v4 with the decimal amount and to v2 and v3 with the same amount in exact cents', async () => {
    const v3 = { ...request, version: 3, language: 'es' };
    const v4 = { ...v3, version: 4 };
    const reply = async (asked, amount) => {
      const deps = ports(); deps.provider.respond.mockResolvedValue({ output: { ...proposal, proposals: [{ ...proposal.proposals[0], amount }] }, usage, model: 'gpt-6-luna', tier: 'default' });
      const res = await call('assistant', asked, deps);
      return res.code === 200 ? res.body.proposals[0] : res.code;
    };
    expect(await reply(v4, '1.99')).toEqual({ ...proposal.proposals[0], amount: '1.99' });
    expect(await reply(v4, '15000.005')).toMatchObject({ amount: '15000.005' }); // the device decides with the currency's exponent
    for (const legacy of [request, v3]) {
      expect(await reply(legacy, '1.99')).toEqual({ kind: 'expense', amountMinor: 199, ...said, merchant: 'Kiosco Secreto', paymentMethodRef: 'Visa Secreta' });
      expect(Object.keys(await reply(legacy, '0.5'))).toEqual(['kind', 'amountMinor', 'currency', 'merchant', 'category', 'dateISO', 'paymentMethodRef']);
      expect((await reply(legacy, '0.5')).amountMinor).toBe(50);
      expect((await reply(legacy, '10000')).amountMinor).toBe(1000000);
      expect((await reply(legacy, '9999999999999.99')).amountMinor).toBe(10 ** 15 - 1);
      expect((await reply(legacy, '1.990')).amountMinor).toBe(199); // trailing zeros are exact
      for (const unrepresentable of ['1.999', '10000000000000']) expect(await reply(legacy, unrepresentable), unrepresentable).toBe(502);
    }
  });
  it('keeps the reservation at its maximum when the cost is unknown, never releasing it', async () => {
    const cases = [
      [{ category: 'timeout' }, 502], [{ category: 'network' }, 502], [{ category: 'http' }, 502], [{ category: 'spend_limit' }, 503], [{ category: 'refusal' }, 422],
    ];
    for (const [failure, code] of cases) {
      const deps = ports(); deps.provider.respond.mockRejectedValue(Object.assign(new Error('boom'), failure));
      const res = await call('assistant', request, deps);
      expect(res.code).toBe(code);
      expect(deps.settleAI.mock.calls[0][2]).toEqual({ state: 'unsettled', chargedMicroUsd: null, usage: null });
      expect(deps.log.mock.calls[0][0].category).toBe('provider_' + failure.category);
    }
    // Usage on another tier, another model or inconsistent numbers is not trusted for settlement.
    for (const served of [{ tier: 'priority' }, { model: 'gpt-5.6-terra' }, { usage: { ...usage, cachedInputTokens: 9999 } }, { usage: null }]) {
      const deps = ports(); deps.provider.respond.mockResolvedValue({ output: proposal, usage, model: 'gpt-6-luna', tier: 'default', ...served });
      await call('assistant', request, deps);
      expect(deps.settleAI.mock.calls[0][2].state).toBe('unsettled');
    }
  });
  it('settles a billed failure from its reported usage, and still answers if settlement fails', async () => {
    const deps = ports();
    deps.provider.respond.mockRejectedValue(Object.assign(new Error('x'), { category: 'incomplete', usage, model: 'gpt-6-luna', tier: 'default' }));
    expect((await call('assistant', request, deps)).code).toBe(502);
    expect(deps.settleAI.mock.calls[0][2]).toMatchObject({ state: 'settled', chargedMicroUsd: 410 });
    const down = ports(); down.settleAI.mockRejectedValue(new Error('db down'));
    expect((await call('assistant', request, down)).code).toBe(200);
    expect(down.log.mock.calls[0][0].settlement).toBe('failed');
  });
  it('refuses malicious or invalid model output after settling, and never saves anything', async () => {
    const explain = { ...request, action: 'explain', facts: [{ id: 'current.expenses', label: 'Gastos registrados', amountMinor: 1500000, count: 1, startISO: '2026-09-01', endISO: '2026-09-19' }] };
    const answer = { type: 'answer', message: 'Llevás $15.000.', evidenceIds: ['current.expenses'], navigation: null, proposals: [], clarification: null };
    const p = proposal.proposals[0];
    const invalid = [
      [request, { ...proposal, proposals: [p, p] }], // duplicated proposal
      [request, { ...proposal, proposals: [] }],
      [request, { ...proposal, proposals: [{ ...p, accountId: 'acct-1' }] }], // a model-created id
      [request, { ...proposal, proposals: [{ ...p, amount: '-5' }] }],
      [request, { ...proposal, proposals: [{ ...p, amount: '1' + '0'.repeat(15) }] }], // 16 whole digits
      [request, { ...proposal, proposals: [{ ...p, amount: 1.5 }] }], // a number, not the decimal text
      [request, { ...proposal, proposals: [{ ...p, amount: '15.000,50' }] }], // grouped: never read by the server
      [request, { ...proposal, proposals: [{ ...p, amount: '15000.005' }] }], // valid v4, but a v2 client reads cents: never rounded
      [request, { ...proposal, proposals: [{ kind: 'expense', amountMinor: 1500000, ...said }] }], // v2's field from a model
      [request, { ...proposal, proposals: [{ ...p, currency: 'EUR' }] }],
      [request, { ...proposal, proposals: [{ ...p, kind: 'transfer' }] }],
      [request, { ...proposal, proposals: [{ ...p, dateISO: '2026-09-20' }] }], // future
      [request, { ...proposal, proposals: [{ ...p, merchant: 'x'.repeat(121) }] }], // over-long and not the person's words: refused, never recovered
      [request, { ...proposal, proposals: [{ ...p, paymentMethodRef: 'x'.repeat(81) }] }], // over its bound: never dropped, refused
      [request, { ...proposal, proposals: [{ ...p, merchant: 'x'.repeat(121) + '\u200b' }] }], // over-long and hidden: refused, never dropped
      [request, { ...proposal, proposals: [{ ...p, merchant: 'x'.repeat(121), amount: '0' }] }], // over-long beside another fault: refused
      [request, { ...proposal, proposals: [{ ...p, merchant: 'Kiosco\u200b' }] }],
      [request, { ...proposal, proposals: [{ ...p, merchant: 'https://evil.example' }] }],
      [request, { ...proposal, message: 'Entrá a www.evil.example para confirmar' }],
      [request, { ...proposal, message: 'Ejecutá ```rm -rf /```' }],
      [request, { ...proposal, message: '[confirmar](javascript:alert(1))' }],
      [request, { ...proposal, message: '' }],
      [request, { ...proposal, action: 'delete_database' }], // an extra key
      [request, { ...proposal, type: 'tool_call' }],
      [request, { ...answer, evidenceIds: [] }], // an answer on parse
      [explain, { ...answer, evidenceIds: ['invented'] }],
      [explain, { ...answer, evidenceIds: [] }], // uncited
      [explain, { ...answer, navigation: { target: 'category', factId: 'current.expenses' } }],
      [explain, { ...answer, navigation: { target: 'movements', factId: 'previous.expenses' } }],
      [explain, { ...answer, navigation: { target: 'https://evil', factId: 'current.expenses' } }],
      [explain, { ...answer, navigation: { target: 'movements', factId: 'current.expenses', url: '/x' } }],
      [explain, { ...proposal }], // a proposal on a question
      [explain, { type: 'clarification', message: '¿Qué mes?', evidenceIds: [], navigation: null, proposals: [], clarification: { field: 'period', candidateIds: ['acct-1'] } }],
      [explain, { type: 'clarification', message: '¿Qué mes?', evidenceIds: [], navigation: null, proposals: [], clarification: { field: 'sql', candidateIds: [] } }],
      [explain, { type: 'out_of_scope', message: 'No.', evidenceIds: ['current.expenses'], navigation: null, proposals: [], clarification: null }],
      [request, 'not an object'], [request, null],
    ];
    for (const [asked, output] of invalid) {
      const deps = ports(); deps.provider.respond.mockResolvedValue({ output, usage, model: 'gpt-6-luna', tier: 'default' });
      const res = await call('assistant', asked, deps);
      expect(res.code, JSON.stringify(output)).toBe(502);
      expect(deps.settleAI).toHaveBeenCalledTimes(1); // Billed even though the output is refused.
      expect(deps.receiveCapture).not.toHaveBeenCalled();
    }
    const ok = ports(); ok.provider.respond.mockResolvedValue({ output: { ...answer, navigation: { target: 'movements', factId: 'current.expenses' } }, usage, model: 'gpt-6-luna', tier: 'default' });
    const res = await call('assistant', explain, ok);
    expect(res.code).toBe(200);
    expect(res.body.evidence).toEqual(explain.facts);
    expect(res.body).not.toHaveProperty('dropped');
    const scope = ports(); scope.provider.respond.mockResolvedValue({ output: { type: 'out_of_scope', message: 'Solo puedo ayudarte con tus finanzas en FinanzApp.', evidenceIds: [], navigation: null, proposals: [], clarification: null }, usage, model: 'gpt-6-luna', tier: 'default' });
    expect((await call('assistant', { ...request, text: 'Escribí un script de Python' }, scope)).body).toMatchObject({ type: 'out_of_scope', proposals: [], evidence: [] });
  });
  // 25A-06, owner decision A (2026-10-09): B7 runs #1 and #2 both copied an over-long merchant or category verbatim, every
  // other field right, and the whole draft was lost to a billed 502. The boundary keeps it with that name null and says so.
  it('keeps a proposal whose only fault is an over-long optional name the person wrote: 200 with that name null and `dropped` naming it, every other field exact, billed once, nothing saved', async () => {
    const long = 'Almacén de Ramos Generales y Despensa La Esquina del Barrio Sucursal Norte Número Dos Abierto Las Veinticuatro Horas Todos Los Días'; // 131 characters
    const longCategory = 'Gastos varios del hogar y mantenimiento general de la casa y el jardín'; // 70
    expect([long.length > 120, longCategory.length > 60]).toEqual([true, true]);
    const said = { ...request, text: 'Gasté 15 mil en ' + long }; // the person's words, copied past the bound
    const deps = ports(); deps.provider.respond.mockResolvedValue({ output: { ...proposal, proposals: [{ ...proposal.proposals[0], merchant: long }] }, usage, model: 'gpt-6-luna', tier: 'default' });
    const res = await call('assistant', said, deps);
    expect(res.code).toBe(200);
    expect(res.body.proposals[0]).toEqual({ kind: 'expense', amountMinor: 1500000, currency: 'ARS', merchant: null, category: 'Supermercado', dateISO: '2026-09-19', paymentMethodRef: 'Visa Secreta' });
    expect(res.body.dropped).toEqual(['merchant']);
    expect(JSON.stringify(res.body)).not.toContain('Ramos'); // dropped, never cut, never echoed
    expect(deps.settleAI).toHaveBeenCalledTimes(1);
    expect(deps.receiveCapture).not.toHaveBeenCalled();
    expect(deps.log.mock.calls[0][0]).toMatchObject({ status: 200, category: 'ok', dropped: 1 });
    expect(JSON.stringify(deps.log.mock.calls)).not.toContain('Ramos');
    // The same name the person did not write (Codex review of PR #99): invented, refused as any invalid output, billed once.
    // The text is longer than the name, so the length alone never grounds it: only the words do.
    const other = { ...request, text: 'Gasté 15 mil en el super de siempre, ' + 'el de la esquina de casa, '.repeat(5).trim() };
    expect(other.text.length).toBeGreaterThan(long.length);
    const made = ports(); made.provider.respond.mockResolvedValue({ output: { ...proposal, proposals: [{ ...proposal.proposals[0], merchant: long }] }, usage, model: 'gpt-6-luna', tier: 'default' });
    expect((await call('assistant', other, made)).code).toBe(502);
    expect(made.settleAI).toHaveBeenCalledTimes(1);
    expect(made.log.mock.calls[0][0]).toMatchObject({ status: 502, category: 'output_invalid' });
    // Both names over their bounds, both the person's: both dropped. The normal path keeps its wire shape (no `dropped` key) and no telemetry count.
    const saidBoth = { ...request, text: `Gasté 15 mil en ${long}, categoría: ${longCategory}` };
    const both = ports(); both.provider.respond.mockResolvedValue({ output: { ...proposal, proposals: [{ ...proposal.proposals[0], merchant: long, category: longCategory }] }, usage, model: 'gpt-6-luna', tier: 'default' });
    expect((await call('assistant', saidBoth, both)).body).toMatchObject({ dropped: ['merchant', 'category'], proposals: [{ merchant: null, category: null, amountMinor: 1500000 }] });
    const plain = ports();
    const kept = await call('assistant', request, plain);
    expect(Object.keys(kept.body).sort()).toEqual(['clarification', 'evidence', 'evidenceIds', 'message', 'navigation', 'proposals', 'type']);
    expect(kept.body.proposals[0].merchant).toBe('Kiosco Secreto');
    expect(plain.log.mock.calls[0][0]).not.toHaveProperty('dropped');
  });
  it('logs operational telemetry only: no prompt, merchant, amount, account, prose, key or token', async () => {
    const deps = ports();
    deps.provider.respond.mockRejectedValue(Object.assign(new Error('provider said: sk-proj-' + 'a'.repeat(40) + ' Kiosco Secreto'), { category: 'http' }));
    await call('assistant', { ...request, text: 'Gasté 15 mil en Kiosco Secreto con la Visa Secreta' }, deps);
    await call('assistant', request, ports());
    const ok = ports(); await call('assistant', request, ok);
    for (const sink of [deps.log, ok.log]) {
      const line = JSON.stringify(sink.mock.calls);
      for (const leak of ['Kiosco', 'Visa', 'Gasté', '1500000', '15 mil', 'sk-proj', 'fixture-access-token', 'fixture-key', 'Bearer', 'Revisá']) expect(line).not.toContain(leak);
    }
    expect(ok.log.mock.calls[0][0]).toMatchObject({ route: 'assistant', status: 200, category: 'ok', model: 'gpt-6-luna', inputTokens: 3000, chargedMicroUsd: 410, requestId: request.requestId });
    expect(telemetryEvent({ category: 'Gasté 15 mil', userId: 'a b', inputTokens: -1, latencyMs: 1.5, note: 'x' })).toEqual({});
  });
});

describe('server configuration fails closed and keeps the model out of code', () => {
  const env = STAGING_AI;
  it('needs every value, an allowlisted provider, a priced model and a bounded effort and caps', () => {
    expect(aiConfig(env)).toMatchObject({ model: 'gpt-6-luna', reasoningEffort: 'low', serviceTier: 'default', maxOutputTokens: 1500, maxInputTokens: 32000 });
    expect(aiConfig({ ...env, MOBILE_AI_MODEL: 'gpt-5.6-luna' }).model).toBe('gpt-5.6-luna'); // A model change is configuration.
    for (const broken of [{ MOBILE_AI_ENABLED: 'false' }, { MOBILE_AI_ENABLED: 'TRUE' }, { MOBILE_AI_PROVIDER: undefined }, { MOBILE_AI_PROVIDER: 'anthropic' },
      { MOBILE_AI_MODEL: undefined }, { MOBILE_AI_MODEL: 'gpt-5.6-terra' }, { MOBILE_AI_MODEL: 'gpt-6-luna; rm -rf' }, { MOBILE_AI_API_KEY: '' },
      { MOBILE_AI_REASONING_EFFORT: 'high' }, { MOBILE_AI_REASONING_EFFORT: 'xhigh' }, { MOBILE_AI_MAX_OUTPUT_TOKENS: '100000' },
      { MOBILE_AI_MAX_INPUT_TOKENS: '999999' }, { MOBILE_AI_MAX_INPUT_TOKENS: '-1' }, { MOBILE_AI_MAX_OUTPUT_TOKENS: '1e3' }]) {
      expect(aiConfig({ ...env, ...broken }), JSON.stringify(broken)).toBeNull();
    }
    expect(Object.keys(PRICING.models)).toContain('openai:gpt-6-luna');
  });
  it('disables the assistant route without the AI switch, the integration switch or the server-only secret key', () => {
    const base = { ...env, MOBILE_INTEGRATIONS_ENABLED: 'true', MOBILE_SUPABASE_URL: 'https://example.supabase.co', MOBILE_SUPABASE_PUBLISHABLE_KEY: PUBLISHABLE, MOBILE_SUPABASE_SECRET_KEY: SECRET };
    expect(mobileDependencies('assistant', base)).not.toBeNull();
    for (const off of [{ MOBILE_AI_ENABLED: 'false' }, { MOBILE_INTEGRATIONS_ENABLED: 'false' }, { MOBILE_SUPABASE_SECRET_KEY: '' }, { MOBILE_SUPABASE_URL: 'http://example.supabase.co' }]) {
      expect(mobileDependencies('assistant', { ...base, ...off })).toBeNull();
    }
    // A disabled AI never touches captures, and captures never need the AI.
    expect(mobileDependencies('capture', { ...base, MOBILE_AI_ENABLED: 'false' })).not.toBeNull();
  });
  it('fits the whole handler inside the time the app waits', () => {
    expect(Object.values(TIMEOUTS_MS).reduce((a, b) => a + b, 0)).toBeLessThan(CLIENT_TIMEOUT_MS);
  });
});

describe('Supabase: session verified with the publishable key, privileged calls with the secret key only', () => {
  const env = { ...STAGING_AI, MOBILE_INTEGRATIONS_ENABLED: 'true', MOBILE_SUPABASE_URL: 'https://example.supabase.co', MOBILE_SUPABASE_PUBLISHABLE_KEY: PUBLISHABLE,
    MOBILE_SUPABASE_SECRET_KEY: SECRET };
  const owner = '00000000-0000-4000-8000-000000000001';
  it('verifies the person, then passes the verified owner to server-only functions without their token', async () => {
    const fetcher = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ id: owner }) }));
    const deps = mobileDependencies('assistant', env, fetcher);
    const session = await deps.authenticate(accessToken());
    expect(session).toEqual({ userId: owner });
    expect(fetcher.mock.calls[0][1].headers).toEqual({ apikey: PUBLISHABLE, Authorization: accessToken() });
    fetcher.mockResolvedValue({ ok: true, json: async () => ({ id: 'reservation-1' }) });
    expect(await deps.reserveAI(session, { requestId: request.requestId, model: 'openai:gpt-6-luna', maxMicroUsd: 1750, inputTokens: 8000, outputTokens: 1500 })).toEqual({ id: 'reservation-1' });
    const [url, init] = fetcher.mock.calls[1];
    expect(url).toBe('https://example.supabase.co/rest/v1/rpc/mobile_ai_reserve');
    // The secret key alone: with a user token the call would run as that user, not as the server.
    expect(init.headers).toEqual({ apikey: SECRET, 'Content-Type': 'application/json' });
    expect(JSON.parse(init.body)).toEqual({ p_user_id: owner, p_request_id: request.requestId, p_model: 'openai:gpt-6-luna', p_max_micro_usd: 1750, p_input_tokens: 8000,
      p_output_tokens: 1500, p_environment: 'staging' });
    fetcher.mockResolvedValue({ ok: true, json: async () => ({ error: 'global_budget' }) });
    expect(await deps.reserveAI(session, { requestId: request.requestId, model: 'm', maxMicroUsd: 1, inputTokens: 1, outputTokens: 1 })).toEqual({ error: 'global_budget' });
    fetcher.mockResolvedValue({ ok: true, json: async () => false });
    await expect(deps.settleAI(session, 'reservation-1', { state: 'unsettled', chargedMicroUsd: null, usage: null })).rejects.toThrow();
    expect(JSON.parse(fetcher.mock.calls.at(-1)[1].body)).toMatchObject({ p_user_id: owner, p_reservation_id: 'reservation-1', p_state: 'unsettled', p_charged_micro_usd: null });
  });
  it('refuses anonymous or malformed users and fails closed on outages', async () => {
    for (const user of [{ id: owner, is_anonymous: true }, { id: 'not-a-uuid' }, {}]) {
      const deps = mobileDependencies('capture', env, vi.fn(async () => ({ ok: true, status: 200, json: async () => user })));
      await expect(deps.authenticate(accessToken())).rejects.toMatchObject({ status: 401 });
    }
    const fetcher = vi.fn(async () => ({ ok: false, status: 500 }));
    const deps = mobileDependencies('assistant', env, fetcher);
    await expect(deps.authenticate(accessToken())).rejects.toMatchObject({ status: 503 });
    await expect(deps.reserveAI({ userId: owner }, { requestId: 'r', model: 'm', maxMicroUsd: 1, inputTokens: 1, outputTokens: 1 })).rejects.toMatchObject({ status: 503 });
    await expect(deps.receiveCapture({ userId: owner }, validateCapture(capture))).rejects.toMatchObject({ status: 503 });
  });
});

describe('environment identity and key kinds fail closed (25A-06)', () => {
  const env = { ...STAGING_AI, MOBILE_INTEGRATIONS_ENABLED: 'true', MOBILE_SUPABASE_URL: 'https://example.supabase.co', MOBILE_SUPABASE_PUBLISHABLE_KEY: PUBLISHABLE,
    MOBILE_SUPABASE_SECRET_KEY: SECRET };
  it('runs only as staging in a Production-scoped Vercel deployment; never preview, development, production or unnamed', () => {
    expect(ENABLED_ENVIRONMENTS).toEqual(['staging']);
    expect(environmentOf(env)).toBe('staging');
    for (const off of [{ VERCEL_ENV: 'preview' }, { VERCEL_ENV: 'development' }, { VERCEL_ENV: undefined }, { MOBILE_ENVIRONMENT: 'production' },
      { MOBILE_ENVIRONMENT: 'development' }, { MOBILE_ENVIRONMENT: 'preview' }, { MOBILE_ENVIRONMENT: 'Staging' }, { MOBILE_ENVIRONMENT: undefined }]) {
      expect(environmentOf({ ...env, ...off }), JSON.stringify(off)).toBeNull();
      expect(mobileDependencies('capture', { ...env, ...off }), JSON.stringify(off)).toBeNull();
      expect(mobileDependencies('assistant', { ...env, ...off }), JSON.stringify(off)).toBeNull();
    }
    // Off Vercel (the evaluation and probe scripts) VERCEL_ENV must be absent.
    expect(environmentOf({ MOBILE_ENVIRONMENT: 'staging' }, { deployed: false })).toBe('staging');
    expect(environmentOf({ MOBILE_ENVIRONMENT: 'staging', VERCEL_ENV: 'preview' }, { deployed: false })).toBeNull();
    expect(aiConfig({ ...STAGING_AI, VERCEL_ENV: undefined }, { deployed: false }).environment).toBe('staging');
  });
  it('accepts only the current Supabase key kinds, in the right slots', () => {
    const legacy = 'eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.fixture';
    for (const keys of [{ MOBILE_SUPABASE_PUBLISHABLE_KEY: legacy }, { MOBILE_SUPABASE_SECRET_KEY: legacy },
      { MOBILE_SUPABASE_PUBLISHABLE_KEY: SECRET, MOBILE_SUPABASE_SECRET_KEY: PUBLISHABLE }, { MOBILE_SUPABASE_SECRET_KEY: SECRET.slice(0, 15) }]) {
      expect(mobileDependencies('capture', { ...env, ...keys }), JSON.stringify(keys)).toBeNull();
    }
  });
  it('accepts only a project-scoped provider key together with its project id', () => {
    for (const key of ['sk-fixture-legacy-user-key', 'sk-admin-fixture-only', 'fixture-key', '', 'sk-proj-short']) {
      expect(aiConfig({ ...STAGING_AI, MOBILE_AI_API_KEY: key }), key).toBeNull();
    }
    expect(aiConfig({ ...STAGING_AI, MOBILE_AI_API_KEY: 'sk-svcacct-fixture-only' })).not.toBeNull();
    for (const project of [undefined, '', 'proj_', 'org_fixtureOnly01', 'proj_fixture only']) expect(aiConfig({ ...STAGING_AI, MOBILE_AI_PROVIDER_PROJECT: project })).toBeNull();
  });
  it('rejects malformed, expired, anonymous and other projects\' tokens without a network call', async () => {
    const now = Math.floor(Date.now() / 1000);
    const issuer = 'https://example.supabase.co/auth/v1';
    expect(plausibleAccessToken(accessToken(), issuer, now)).toBe(true);
    for (const token of ['Bearer fixture-access-token', 'Bearer a.b', 'Bearer a.b.c.d', 'Bearer !!.@@.##', accessToken().replace('Bearer ', ''), 'Bearer x.' + 'e30' + '.y',
      accessToken({ exp: now - 1 }), accessToken({ exp: String(now + 60) }), accessToken({ is_anonymous: true }), accessToken({ iss: 'https://other.supabase.co/auth/v1' }),
      accessToken({ aud: 'anon' }), accessToken({ role: 'anon' }), accessToken({ role: 'service_role' }), accessToken({ sub: undefined }), undefined, null]) {
      expect(plausibleAccessToken(token, issuer, now), String(token)).toBe(false);
    }
    const fetcher = vi.fn();
    const deps = mobileDependencies('assistant', env, fetcher);
    for (const token of [headers.authorization, accessToken({ is_anonymous: true }), accessToken({ exp: now - 1 })]) {
      await expect(deps.authenticate(token)).rejects.toMatchObject({ status: 401 });
    }
    expect(fetcher).not.toHaveBeenCalled();
    // A plausible token still meets Supabase, which decides (a signature or a signed-out session fails there).
    fetcher.mockResolvedValue({ ok: false, status: 403 });
    await expect(deps.authenticate(accessToken())).rejects.toMatchObject({ status: 401 });
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it('names its environment on every privileged call and fails closed when the database is another one', async () => {
    const fetcher = vi.fn(async () => ({ ok: true, json: async () => ({ error: 'environment' }) }));
    const deps = mobileDependencies('assistant', env, fetcher);
    const session = { userId: '00000000-0000-4000-8000-000000000001' };
    await expect(deps.receiveCapture(session, validateCapture(capture))).rejects.toMatchObject({ status: 503, category: 'environment' });
    expect(JSON.parse(fetcher.mock.calls[0][1].body).p_environment).toBe('staging');
    expect(await deps.reserveAI(session, { requestId: request.requestId, model: 'm', maxMicroUsd: 1, inputTokens: 1, outputTokens: 1 })).toEqual({ error: 'environment' });
    const ports_ = ports(); ports_.reserveAI.mockResolvedValue({ error: 'environment' });
    const res = await call('assistant', request, ports_);
    expect(res.code).toBe(503);
    expect(ports_.provider.respond).not.toHaveBeenCalled();
    expect(ports_.log.mock.calls[0][0].category).toBe('environment');
  });
});
