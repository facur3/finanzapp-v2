import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { main as probeMain, probeConfig, runProbe, RACE_PREFIX, INBOX_PROBE_ID } from './probe.js';
import { main as reconcileMain, providerDays, reconcile } from './reconcile.js';
import { TIMEOUTS_MS, CLIENT_TIMEOUT_MS } from '../runtime.js';
import { OPENAI_REQUEST_KEYS } from '../openai.js';

const root = new URL('../../../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');

describe('deployment configuration (vercel.json)', () => {
  const config = JSON.parse(read('vercel.json'));
  it('builds only Production deployments, so a Preview never runs the API at all', () => {
    // Exit 0 skips the build (Vercel's Ignored Build Step): every non-production deployment is skipped.
    expect(config.ignoreCommand).toBe('[ "$VERCEL_ENV" != production ]');
  });
  it('holds no variable: secrets live in the project settings, scoped to Production only', () => {
    expect(config.env).toBeUndefined();
    expect(config.build?.env).toBeUndefined();
    expect(read('vercel.json')).not.toMatch(/MOBILE_|sb_|sk-|proj_/);
  });
  it('pins one region and a duration above the handler budget, within every plan', () => {
    // São Paulo, next to the staging Supabase project in sa-east-1 (owner decision 2026-10-05, runbook §4.2).
    expect(config.regions).toEqual(['gru1']);
    const { maxDuration } = config.functions['api/mobile/*.js'];
    const budget = Object.values(TIMEOUTS_MS).reduce((a, b) => a + b, 0) / 1000;
    expect(maxDuration).toBeGreaterThanOrEqual(Math.ceil(CLIENT_TIMEOUT_MS / 1000) + 5);
    expect(maxDuration).toBeGreaterThan(budget);
    expect(maxDuration).toBeLessThanOrEqual(60); // Within every plan (the older non-Fluid Hobby limit was 60 s).
    expect(config.rewrites ?? config.routes ?? config.redirects).toBeUndefined();
  });
  it('declares the Node major the functions run on', () => {
    expect(JSON.parse(read('package.json')).engines).toEqual({ node: '24.x' });
  });
});

describe('one ephemeral conversation: no chat history anywhere server-side', () => {
  it('has no history table and never asks the provider to store or chain', () => {
    expect(read('server/mobile/schema.sql')).not.toMatch(/create table[^(]*(message|thread|conversation|chat)/i);
    expect(OPENAI_REQUEST_KEYS).not.toContain('previous_response_id');
    expect(OPENAI_REQUEST_KEYS).not.toContain('conversation');
  });
});

// ── Probe ───────────────────────────────────────────────────────────────────────────────────────────────────────────

const ENV = { MOBILE_ENVIRONMENT: 'staging', MOBILE_SUPABASE_URL: 'https://example.supabase.co', MOBILE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_fixtureOnlyNotAKey',
  MOBILE_SUPABASE_SECRET_KEY: 'sb_secret_fixtureOnlyNotAKey', STAGING_API_ORIGIN: 'https://staging.example.test',
  STAGING_PROBE_A_EMAIL: 'a@example.test', STAGING_PROBE_A_PASSWORD: 'fixture-password-a', STAGING_PROBE_B_EMAIL: 'b@example.test', STAGING_PROBE_B_PASSWORD: 'fixture-password-b' };
const part = value => Buffer.from(JSON.stringify(value)).toString('base64url');
const token = sub => [part({ alg: 'ES256' }), part({ sub }), 'sig'].join('.');
const A = '00000000-0000-4000-8000-00000000000a', B = '00000000-0000-4000-8000-00000000000b';
const json = (status, value) => ({ ok: status >= 200 && status < 300, status, json: async () => value });

/** A staging that behaves as designed: every client refused, the server path answering `disabled`/`environment`. */
function healthyStaging({ aiEnabled = false, leak = null } = {}) {
  const seen = new Set();
  const inbox = [];
  return vi.fn(async (url, init = {}) => {
    const path = url.replace(/^https:\/\/[^/]+/, '');
    const auth = init.headers?.Authorization;
    if (path.startsWith('/auth/v1/token')) return json(200, { access_token: token(JSON.parse(init.body).email.startsWith('a') ? A : B) });
    if (path === '/auth/v1/signup') return leak === 'anonymous' ? json(200, {}) : leak === 'rate' ? json(429, { error_code: 'over_request_rate_limit' })
      : json(422, { error_code: 'anonymous_provider_disabled' });
    if (path.startsWith('/rest/v1/rpc/')) {
      if (init.headers.apikey.startsWith('sb_secret_')) {
        const body = JSON.parse(init.body);
        if (path.endsWith('/mobile_receive_capture')) { inbox.push({ user_id: body.p_user_id, request_id: body.p_request_id }); return json(200, { id: 'c1', duplicate: false }); }
        if (body.p_request_id?.startsWith(RACE_PREFIX)) return json(200, seen.size < 3 && seen.add(body.p_request_id) ? { id: 'r' + seen.size } : { error: 'user_budget' });
        return json(200, { error: body.p_environment === 'staging' ? 'disabled' : 'environment' });
      }
      return json(leak === 'rpc' && auth ? 200 : 401, {});
    }
    if (path.startsWith('/rest/v1/mobile_capture_inbox')) {
      const sub = auth ? JSON.parse(Buffer.from(auth.split('.')[1], 'base64url').toString()).sub : null;
      return json(200, leak === 'inbox' ? inbox : inbox.filter(row => row.user_id === sub));
    }
    if (path.startsWith('/rest/v1/')) return json(leak === 'table' ? 200 : 401, leak === 'table' ? [{ enabled: false }] : {});
    if (path === '/api/mobile/assistant') {
      if (init.method !== 'POST') return json(405, {});
      if (!auth || !/^Bearer [^.]+\.[^.]+\.[^.]+$/.test(auth) || !auth.includes(token(A).split('.')[1])) return json(401, {});
      if (init.headers['Content-Type'] !== 'application/json') return json(415, {});
      if (leak === 'database') return json(503, { error: 'La integración no está disponible. No se registró el movimiento.' });
      if (!aiEnabled) return json(503, { error: 'El asistente no está disponible ahora. Podés registrar manualmente.' });
      const { requestId } = JSON.parse(init.body);
      if (seen.has(requestId)) return json(409, {});
      seen.add(requestId);
      return json(200, { type: 'proposal' });
    }
    throw new Error('unexpected ' + path);
  });
}
const run = async (mode, fetcher, flags = {}) => {
  const out = vi.fn();
  const results = await runProbe(mode, probeConfig(ENV, mode), { fetcher, out, flags });
  return { results, out, failed: results.filter(r => !r.pass).map(r => r.name) };
};

describe('staging probe (fake network only)', () => {
  it('is refused before any request unless the environment is staging, off Vercel, with the current key kinds', async () => {
    for (const env of [{}, { ...ENV, MOBILE_ENVIRONMENT: 'production' }, { ...ENV, VERCEL_ENV: 'production' }, { ...ENV, MOBILE_SUPABASE_SECRET_KEY: 'eyJ.legacy.jwt' },
      { ...ENV, MOBILE_SUPABASE_URL: 'http://example.supabase.co' }, { ...ENV, STAGING_PROBE_B_PASSWORD: '' }]) {
      const fetcher = vi.fn();
      const out = vi.fn();
      expect(await probeMain(['boundary'], env, { fetcher, out })).toBe(2);
      expect(fetcher).not.toHaveBeenCalled();
    }
    expect(await probeMain(['nonsense'], ENV, { fetcher: vi.fn(), out: vi.fn() })).toBe(2);
    // The API probe needs no secret key: it runs as the people do.
    expect(probeConfig({ ...ENV, MOBILE_SUPABASE_SECRET_KEY: undefined }, 'api').missing).toBeUndefined();
  });
  it('passes a staging that behaves as designed, and never prints a token, key or password', async () => {
    for (const [mode, flags, fetcher] of [['boundary', {}, healthyStaging()], ['api', {}, healthyStaging()], ['api', { aiEnabled: true }, healthyStaging({ aiEnabled: true })]]) {
      const { failed, out } = await run(mode, fetcher, flags);
      expect(failed, mode).toEqual([]);
      const printed = out.mock.calls.flat().join('\n');
      for (const secret of ['sb_secret_', 'sb_publishable_', 'fixture-password', token(A)]) expect(printed).not.toContain(secret);
    }
  });
  it('fails each leak it exists to find', async () => {
    expect((await run('boundary', healthyStaging({ leak: 'anonymous' }))).failed).toEqual(['anonymous sign-ins are disabled']);
    // A rate limit is not proof that the setting is off.
    expect((await run('boundary', healthyStaging({ leak: 'rate' }))).failed).toEqual(['anonymous sign-ins are disabled']);
    // A broken secret key or grant behind the API also answers 503, with other words: not a pass.
    expect((await run('api', healthyStaging({ leak: 'database' }))).failed).toEqual(['a valid request answers 503 while AI is off in the database']);
    expect((await run('boundary', healthyStaging({ leak: 'rpc' }))).failed).toEqual(expect.arrayContaining(['a signed-in person cannot execute mobile_ai_reserve',
      'a signed-in person cannot execute mobile_ai_settle']));
    expect((await run('boundary', healthyStaging({ leak: 'table' }))).failed).toContain('anon reads nothing of mobile_ai_control');
    // An open inbox policy: A sees B's probe capture (and anon would too).
    expect((await run('boundary', healthyStaging({ leak: 'inbox' }))).failed).toEqual(expect.arrayContaining(['A reads only their own inbox', 'anon reads nothing of mobile_capture_inbox']));
    // AI enabled in the database while the probe expects it off: the 503 check fails.
    expect((await run('api', healthyStaging({ aiEnabled: true }))).failed).toEqual(['a valid request answers 503 while AI is off in the database']);
  });
  it('stops when the test people cannot sign in', async () => {
    const { failed, results } = await run('boundary', vi.fn(async () => json(400, {})));
    expect(failed).toEqual(['the two staging test people sign in']);
    expect(results).toHaveLength(1);
  });
  it('race: passes only when the grants equal floor(ceiling / max), all through the server path', async () => {
    const fetcher = healthyStaging();
    expect((await run('race', fetcher, { max: 1000, ceiling: 3000 })).failed).toEqual([]);
    const reserves = fetcher.mock.calls.filter(([url]) => url.includes('/rpc/mobile_ai_reserve'));
    expect(reserves.length).toBe(8);
    expect(reserves.every(([, init]) => init.headers.apikey.startsWith('sb_secret_') && !init.headers.Authorization)).toBe(true);
    expect((await run('race', healthyStaging(), { max: 1000, ceiling: 2000 })).failed).toEqual(['concurrent reservations never exceed the ceiling']);
    expect((await run('race', healthyStaging(), { max: 0, ceiling: 1 })).failed).toEqual(['race needs --max and --ceiling (µUSD)']);
  });
});

// ── Reconciliation ──────────────────────────────────────────────────────────────────────────────────────────────────

const PROJECT = 'proj_fixtureOnly01';
const day = (d, extra = {}) => ({ day: d, settledMicroUsd: 50_000, chargedMicroUsd: 50_000, unsettled: 0, staleReserved: 0, estimateExceeded: 0, ...extra });
const ours = days => ({ kind: 'finanzapp.ai-usage.v1', environment: 'staging', days });
const bucket = (iso, value, project = PROJECT) => ({ object: 'bucket', start_time: Date.parse(iso + 'T00:00:00Z') / 1000,
  results: [{ object: 'organization.costs.result', amount: { value, currency: 'usd' }, project_id: project }] });
const costs = buckets => ({ object: 'page', data: buckets, has_more: false });
const live = (extra = {}) => ({ mode: 'live', ranOnUTC: '2026-10-06', finishedOnUTC: '2026-10-06', providerProject: PROJECT, metrics: { costTotalMicroUsd: 30_000 }, ...extra });

describe('staging cost reconciliation (offline)', () => {
  it('reads one complete Costs API page as integer µUSD per UTC day, for the staging project only', () => {
    const days = providerDays(costs([bucket('2026-10-06', 0.041234), bucket('2026-10-06', 1, 'proj_other0000001')]), PROJECT);
    expect([...days]).toEqual([['2026-10-06', 41_234]]);
    // Each of these would make a comparison meaningless: refused, never reported as pending.
    for (const [page, project] of [
      [costs([bucket('2026-10-06', 1)]), 'proj_typo0000000'], [costs([bucket('2026-10-06', 1)]), undefined],
      [{ ...costs([bucket('2026-10-06', 1)]), has_more: true }, PROJECT],
      [costs([{ ...bucket('2026-10-06', 1), results: [{ amount: { value: 1, currency: 'usd' }, project_id: null }] }]), PROJECT],
      [costs([{ ...bucket('2026-10-06', 1), results: [{ amount: { currency: 'usd' }, project_id: PROJECT }] }]), PROJECT],
      [costs([{ ...bucket('2026-10-06', 1), results: [{ amount: { value: 1, currency: 'eur' }, project_id: PROJECT }] }]), PROJECT],
      [costs([{ ...bucket('2026-10-06', 1), start_time: Date.parse('2026-10-06T03:00:00Z') / 1000 }]), PROJECT],
    ]) expect(() => providerDays(page, project), JSON.stringify(page).slice(0, 80)).toThrow();
  });
  it('accepts a bill at or a little below our estimate; investigates a bill above what we can have spent or any estimate_exceeded', () => {
    const verdicts = reconcile({ projectId: PROJECT, ours: ours([day('2026-10-06'), day('2026-10-07'), day('2026-10-08'), day('2026-10-09', { estimateExceeded: 1 }), day('2026-10-10')]),
      provider: costs([bucket('2026-10-06', 0.049), bucket('2026-10-07', 0.0501), bucket('2026-10-08', 0.02), bucket('2026-10-09', 0.05)]) });
    expect(verdicts.map(v => [v.day, v.status])).toEqual([['2026-10-06', 'ok'], ['2026-10-07', 'investigate'], ['2026-10-08', 'over_estimate'],
      ['2026-10-09', 'investigate'], ['2026-10-10', 'pending']]);
  });
  it('keeps comparing on a day with unsettled requests, against their maximum', () => {
    const unsettled = day('2026-10-06', { unsettled: 1, chargedMicroUsd: 60_000 });
    expect(reconcile({ projectId: PROJECT, ours: ours([unsettled]), provider: costs([bucket('2026-10-06', 0.055)]) })[0].status).toBe('ok');
    expect(reconcile({ projectId: PROJECT, ours: ours([unsettled]), provider: costs([bucket('2026-10-06', 5)]) })[0].status).toBe('investigate');
    // A request reserved at 23:59:50 UTC and billed after midnight: the next day may carry it, nothing more.
    const crossing = [day('2026-10-06', { nearMidnightMicroUsd: 20_000 }), day('2026-10-07', { settledMicroUsd: 10_000, chargedMicroUsd: 10_000 })];
    expect(reconcile({ projectId: PROJECT, ours: ours(crossing), provider: costs([bucket('2026-10-06', 0.03), bucket('2026-10-07', 0.03)]) }).map(v => v.status))
      .toEqual(['ok', 'ok']);
    expect(reconcile({ projectId: PROJECT, ours: ours(crossing), provider: costs([bucket('2026-10-06', 0.03), bucket('2026-10-07', 0.031)]) })[1].status).toBe('investigate');
    // Spend the provider billed on a day FinanzApp has no record of.
    expect(reconcile({ projectId: PROJECT, ours: ours([]), provider: costs([bucket('2026-10-06', 0.01)]) })[0].status).toBe('investigate');
  });
  it('adds a live evaluation\'s cost to its day, only for the same project and one UTC day', () => {
    expect(reconcile({ projectId: PROJECT, ours: ours([day('2026-10-06')]), provider: costs([bucket('2026-10-06', 0.08)]), evals: [live()] })[0])
      .toMatchObject({ status: 'ok', estimatedMicroUsd: 80_000, billedMicroUsd: 80_000 });
    for (const report of [{ mode: 'fixture', metrics: {} }, live({ providerProject: 'proj_other0000001' }), live({ finishedOnUTC: '2026-10-07' })]) {
      expect(() => reconcile({ projectId: PROJECT, ours: ours([]), provider: costs([bucket('2026-10-06', 0.08)]), evals: [report] })).toThrow();
    }
  });
  it('refuses a report that is not staging, and exits 1 when a day needs investigation, 2 when it cannot compare', () => {
    expect(() => reconcile({ projectId: PROJECT, ours: { ...ours([]), environment: 'production' }, provider: costs([bucket('2026-10-06', 1)]) })).toThrow();
    const files = { u: ours([day('2026-10-06')]), c: costs([bucket('2026-10-06', 1)]) };
    expect(reconcileMain(['--ours', 'u', '--provider', 'c', '--project', PROJECT], { read: name => files[name], out: vi.fn() })).toBe(1);
    expect(reconcileMain(['--ours', 'u', '--provider', 'c', '--project', 'proj_typo0000000'], { read: name => files[name], out: vi.fn() })).toBe(2);
    expect(reconcileMain(['--ours', 'u', '--provider', 'c'], { read: name => files[name], out: vi.fn() })).toBe(2);
  });
});
