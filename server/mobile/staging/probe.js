// Staging probes (Producto 25A-06; docs/ai-staging-runbook.md §6 and §12). Run by the owner from their machine against
// STAGING only, with the variables of a local env file kept outside the repository. Prints one PASS/FAIL line per
// check, never a token, a key, a password or a response body; exit 1 on any FAIL. Tests inject a fake fetch.
//
//   node --env-file=<staging.env> server/mobile/staging/probe.js boundary   Supabase grants seen from the network (one fixed capture for B)
//   node --env-file=<staging.env> server/mobile/staging/probe.js api        the deployed staging API, AI off in the database
//   node --env-file=<staging.env> server/mobile/staging/probe.js api --ai-enabled   … after the owner enabled it (1–2 billed requests)
//   node --env-file=<staging.env> server/mobile/staging/probe.js race --max <µUSD> --ceiling <µUSD>   after the race setup SQL
import { pathToFileURL } from 'node:url';
import { environmentOf } from '../runtime.js';

const PUBLISHABLE_KEY = /^sb_publishable_[A-Za-z0-9_-]{16,}$/;
const SECRET_KEY = /^sb_secret_[A-Za-z0-9_-]{16,}$/;
export const RACE_PREFIX = 'stagingprobe-race-';
export const INBOX_PROBE_ID = 'stagingprobe-inbox-0001';
// The handler's words for a refused reservation (disabled), distinct from a database or session outage (handlers.js).
const UNAVAILABLE = 'El asistente no está disponible ahora. Podés registrar manualmente.';
const TODAY = () => new Date().toISOString().slice(0, 10);

/** The probe's configuration, or a list of what is missing. Staging only, off Vercel, current key kinds only. */
export function probeConfig(env, mode) {
  const missing = [];
  if (!environmentOf(env, { deployed: false })) missing.push('MOBILE_ENVIRONMENT=staging (and no VERCEL_ENV)');
  let supabase = null;
  try { const url = new URL(env.MOBILE_SUPABASE_URL); if (url.protocol === 'https:' && url.pathname === '/' && !url.search) supabase = url.origin; } catch { /* below */ }
  if (!supabase) missing.push('MOBILE_SUPABASE_URL');
  if (!PUBLISHABLE_KEY.test(env.MOBILE_SUPABASE_PUBLISHABLE_KEY ?? '')) missing.push('MOBILE_SUPABASE_PUBLISHABLE_KEY');
  if (mode !== 'api' && !SECRET_KEY.test(env.MOBILE_SUPABASE_SECRET_KEY ?? '')) missing.push('MOBILE_SUPABASE_SECRET_KEY');
  let api = null;
  if (mode === 'api') {
    try { const url = new URL(env.STAGING_API_ORIGIN); if (url.protocol === 'https:' && url.pathname === '/') api = url.origin; } catch { /* below */ }
    if (!api) missing.push('STAGING_API_ORIGIN');
  }
  for (const name of ['STAGING_PROBE_A_EMAIL', 'STAGING_PROBE_A_PASSWORD', 'STAGING_PROBE_B_EMAIL', 'STAGING_PROBE_B_PASSWORD']) if (!env[name]) missing.push(name);
  return missing.length ? { missing } : { supabase, api, publishable: env.MOBILE_SUPABASE_PUBLISHABLE_KEY, secret: env.MOBILE_SUPABASE_SECRET_KEY,
    people: [[env.STAGING_PROBE_A_EMAIL, env.STAGING_PROBE_A_PASSWORD], [env.STAGING_PROBE_B_EMAIL, env.STAGING_PROBE_B_PASSWORD]] };
}

const subOf = token => { try { return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8')).sub ?? null; } catch { return null; } };
async function body(response) { try { return await response.json(); } catch { return null; } }

export async function runProbe(mode, config, { fetcher = fetch, out = console.log, flags = {}, newId = () => crypto.randomUUID() } = {}) {
  const results = [];
  const check = (name, pass) => { results.push({ name, pass }); out(`${pass ? 'PASS' : 'FAIL'} ${name}`); };
  const post = (url, headers, payload, contentType = 'application/json') => fetcher(url, { method: 'POST',
    headers: { ...headers, 'Content-Type': contentType }, body: typeof payload === 'string' ? payload : JSON.stringify(payload), signal: AbortSignal.timeout(40000) });
  const anon = { apikey: config.publishable };
  const signIn = async ([email, password]) => {
    const response = await post(config.supabase + '/auth/v1/token?grant_type=password', anon, { email, password });
    const token = response.ok ? (await body(response))?.access_token : null;
    return typeof token === 'string' ? token : null;
  };
  const tokens = [];
  for (const person of config.people) tokens.push(await signIn(person));
  check('the two staging test people sign in', tokens.every(Boolean));
  if (!tokens.every(Boolean)) return results;
  const [a, b] = tokens.map(subOf);
  const rpc = (name, headers, payload) => post(config.supabase + '/rest/v1/rpc/' + name, headers, payload);

  if (mode === 'boundary') {
    // Refused for that reason, not for a rate limit, a CAPTCHA or an outage that would hide an enabled setting.
    const anonymous = await post(config.supabase + '/auth/v1/signup', anon, {});
    const refusal = anonymous.ok ? null : (await body(anonymous))?.error_code;
    check('anonymous sign-ins are disabled', ['anonymous_provider_disabled', 'signup_disabled'].includes(refusal));
    const calls = {
      mobile_ai_reserve: { p_user_id: a, p_request_id: 'stagingprobe-client-01', p_model: 'm', p_max_micro_usd: 1, p_input_tokens: 1, p_output_tokens: 1, p_environment: 'staging' },
      mobile_ai_settle: { p_user_id: a, p_reservation_id: newId(), p_state: 'settled', p_charged_micro_usd: 0, p_input_tokens: null, p_cached_input_tokens: null,
        p_cache_write_tokens: null, p_output_tokens: null, p_reasoning_tokens: null },
      mobile_receive_capture: { p_user_id: a, p_request_id: 'stagingprobe-client-01', p_source: 'shortcut', p_payload: {}, p_environment: 'staging' },
      mobile_reserve_usage: { p_user_id: a },
    };
    for (const [who, headers] of [['anon', anon], ['a signed-in person', { ...anon, Authorization: 'Bearer ' + tokens[0] }]]) {
      for (const [name, payload] of Object.entries(calls)) check(`${who} cannot execute ${name}`, !(await rpc(name, headers, payload)).ok);
      for (const table of ['mobile_ai_control', 'mobile_ai_reservations', 'mobile_api_usage']) {
        const response = await fetcher(config.supabase + `/rest/v1/${table}?select=*`, { headers, signal: AbortSignal.timeout(40000) });
        const rows = response.ok ? await body(response) : null;
        check(`${who} reads nothing of ${table}`, !response.ok || (Array.isArray(rows) && rows.length === 0));
      }
    }
    // The server path, as the API calls it: the secret key alone. It writes exactly one row, ever: B's capture with a
    // fixed request id (a repeat is a duplicate), so isolation is tested against a row that exists (runbook §6.5).
    const server = { apikey: config.secret };
    const own = await rpc('mobile_receive_capture', server, { ...calls.mobile_receive_capture, p_user_id: b, p_request_id: INBOX_PROBE_ID, p_payload: { probe: true } });
    check('the server path stores a capture for B', own.ok && typeof (await body(own))?.id === 'string');
    for (const [token, sub, who, expected] of [[tokens[0], a, 'A', false], [tokens[1], b, 'B', true]]) {
      const response = await fetcher(config.supabase + '/rest/v1/mobile_capture_inbox?select=user_id,request_id', { headers: { ...anon, Authorization: 'Bearer ' + token }, signal: AbortSignal.timeout(40000) });
      const rows = response.ok ? await body(response) : null;
      check(`${who} reads only their own inbox`, Array.isArray(rows) && rows.every(row => row.user_id === sub)
        && rows.some(row => row.request_id === INBOX_PROBE_ID) === expected);
    }
    const anonInbox = await fetcher(config.supabase + '/rest/v1/mobile_capture_inbox?select=user_id', { headers: anon, signal: AbortSignal.timeout(40000) });
    const anonRows = anonInbox.ok ? await body(anonInbox) : null;
    check('anon reads nothing of mobile_capture_inbox', !anonInbox.ok || (Array.isArray(anonRows) && anonRows.length === 0));
    const off = await rpc('mobile_ai_reserve', server, { ...calls.mobile_ai_reserve, p_request_id: 'stagingprobe-server-01' });
    check('the server path reaches mobile_ai_reserve and AI starts disabled', off.ok && (await body(off))?.error === 'disabled');
    const other = await rpc('mobile_ai_reserve', server, { ...calls.mobile_ai_reserve, p_request_id: 'stagingprobe-server-02', p_environment: 'production' });
    check('this database refuses another environment', other.ok && (await body(other))?.error === 'environment');
  }

  if (mode === 'api') {
    const route = config.api + '/api/mobile/assistant';
    const bearer = { Authorization: 'Bearer ' + tokens[0] };
    const ask = (requestId = 'stagingprobe-' + newId()) => ({ version: 2, requestId, action: 'parse', text: 'Gasté 1500 en el kiosco', todayISO: TODAY(), currency: 'ARS', region: 'AR', facts: [] });
    check('GET is refused (405)', (await fetcher(route, { signal: AbortSignal.timeout(40000) })).status === 405);
    check('no session is refused (401)', (await post(route, {}, ask())).status === 401);
    check('a malformed bearer is refused (401)', (await post(route, { Authorization: 'Bearer not.a-token' }, ask())).status === 401);
    check('another project\'s or a forged token is refused (401)', (await post(route, { Authorization: 'Bearer ' + forged(config.supabase) }, ask())).status === 401);
    check('a non-JSON body is refused (415)', (await post(route, bearer, 'x', 'text/plain')).status === 415);
    if (!flags.aiEnabled) {
      // 503 with the reservation's words: the database answered `disabled`, so the secret key and the grants work.
      const off = await post(route, bearer, ask());
      check('a valid request answers 503 while AI is off in the database', off.status === 503 && (await body(off))?.error === UNAVAILABLE);
    } else {
      const request = ask();
      const first = await post(route, bearer, request);
      const reply = first.ok ? await body(first) : null;
      check('a valid request answers 200 with a protocol result', first.status === 200 && ['proposal', 'clarification', 'answer', 'out_of_scope'].includes(reply?.type));
      check('the same request id is refused as a duplicate (409)', (await post(route, bearer, request)).status === 409);
    }
  }

  if (mode === 'race') {
    // N parallel reservations through the real PostgREST and database; the owner's race setup sized the person's month to
    // `ceiling` and raised every other limit (runbook §6). Nothing reaches the provider.
    const { max, ceiling } = flags;
    if (!Number.isSafeInteger(max) || !Number.isSafeInteger(ceiling) || max <= 0 || ceiling < max) { check('race needs --max and --ceiling (µUSD)', false); return results; }
    const server = { apikey: config.secret };
    const replies = await Promise.all(Array.from({ length: Math.floor(ceiling / max) + 5 }, (_, i) => rpc('mobile_ai_reserve', server,
      { p_user_id: a, p_request_id: RACE_PREFIX + String(i).padStart(4, '0') + '-' + newId().slice(0, 8), p_model: 'm', p_max_micro_usd: max, p_input_tokens: 1, p_output_tokens: 1, p_environment: 'staging' })
      .then(body).catch(() => null)));
    const granted = replies.filter(reply => typeof reply?.id === 'string').length;
    out(`race: ${granted} of ${replies.length} reserved at ${max} µUSD each, ceiling ${ceiling} µUSD`);
    check('concurrent reservations never exceed the ceiling', granted * max <= ceiling && granted === Math.floor(ceiling / max));
  }
  return results;
}

/** A token shaped like a Supabase access token but unsigned: the API must refuse it (local precheck or Supabase). */
function forged(supabase) {
  const part = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  return [part({ alg: 'HS256', typ: 'JWT' }), part({ iss: supabase + '/auth/v1', aud: 'authenticated', role: 'authenticated', sub: '00000000-0000-4000-8000-000000000000',
    exp: Math.floor(Date.now() / 1000) + 600 }), 'c2lnbmF0dXJl'].join('.');
}

export async function main(argv = process.argv.slice(2), env = process.env, options = {}) {
  const out = options.out ?? console.log;
  const mode = argv[0];
  if (!['boundary', 'api', 'race'].includes(mode)) { out('Usage: probe.js boundary | api [--ai-enabled] | race --max <µUSD> --ceiling <µUSD>'); return 2; }
  const config = probeConfig(env, mode);
  if (config.missing) { out('Refused, nothing was sent. Missing or invalid: ' + config.missing.join(', ')); return 2; }
  const number = flag => { const i = argv.indexOf(flag); return i >= 0 && /^\d{1,9}$/.test(argv[i + 1] ?? '') ? Number(argv[i + 1]) : null; };
  const results = await runProbe(mode, config, { ...options, out, flags: { aiEnabled: argv.includes('--ai-enabled'), max: number('--max'), ceiling: number('--ceiling') } });
  return results.length && results.every(r => r.pass) ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = await main();
