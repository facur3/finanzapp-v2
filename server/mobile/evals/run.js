// node server/mobile/evals/run.js         → the fixture responder; a JSON report; exit 1 if a threshold fails.
// node server/mobile/evals/run.js --live --approve-micro-usd <n>  → a real provider. Spends money. Refused (exit 2, before
//   any provider exists) unless every gate holds (docs/ai-staging-runbook.md §11): MOBILE_AI_EVAL_LIVE=1; a complete
//   STAGING Assistant configuration off Vercel (runtime.js aiConfig: MOBILE_ENVIRONMENT=staging, no VERCEL_ENV, a
//   project-scoped key and its project id); a price table read within PRICING_MAX_AGE_DAYS; and an owner-approved spend
//   <n> (µUSD) at least the run's worst case, every case at its reservation maximum. These calls bypass the database
//   reservations, so the approval and the provider project's hard limit are what bound them.
import { pathToFileURL } from 'node:url';
import { aiConfig } from '../runtime.js';
import { inputTokenBound, providerRequest } from '../assistant-prompt.js';
import { maxCostMicroUsd } from '../cost.js';
import { PRICING, PRICING_MAX_AGE_DAYS, pricingAgeDays } from '../pricing.js';
import { createProvider as defaultCreateProvider } from '../provider.js';
import { CASES } from './corpus.js';
import { CALL_OPTIONS, buildRequest, fixtureResponder, runEval } from './harness.js';
import { checkThresholds } from './thresholds.js';

const boundOf = (config, testCase) => inputTokenBound(providerRequest(buildRequest(testCase),
  { maxOutputTokens: config.maxOutputTokens, reasoningEffort: config.reasoningEffort }));

/** The most the corpus can cost under `config`: every case at its reservation maximum (what the server would reserve). */
export function worstCaseMicroUsd(config, cases = CASES) {
  return cases.reduce((sum, testCase) => sum + maxCostMicroUsd(config.price, { inputTokens: boundOf(config, testCase), outputTokens: config.maxOutputTokens }), 0);
}

export async function main(argv = process.argv.slice(2), env = process.env, { createProvider = defaultCreateProvider, out = console.log, err = console.error,
  clock = () => new Date().toISOString().slice(0, 10), today = clock() } = {}) {
  const live = argv.includes('--live');
  const ageDays = pricingAgeDays(today);
  const pricing = { readOn: PRICING.readOn, source: PRICING.source, ageDays, maxAgeDays: PRICING_MAX_AGE_DAYS };
  const stale = ageDays === null || ageDays > PRICING_MAX_AGE_DAYS;
  let respond = fixtureResponder(CASES), price, callOptions = CALL_OPTIONS, expected, model = 'fixture', spend;
  if (live) {
    const config = env.MOBILE_AI_EVAL_LIVE === '1' ? aiConfig(env, { deployed: false }) : null;
    if (!config) {
      err('Refused: --live needs MOBILE_AI_EVAL_LIVE=1 and a complete staging Assistant configuration (MOBILE_ENVIRONMENT=staging, no VERCEL_ENV, MOBILE_AI_*). No provider was created.');
      return 2;
    }
    if (stale) {
      err(`Refused: the price table was read on ${PRICING.readOn} (${ageDays ?? '?'} days ago, limit ${PRICING_MAX_AGE_DAYS}). Re-read ${PRICING.source} and record it in pricing.js in a reviewed commit. No provider was created.`);
      return 2;
    }
    // The server answers 413 above its input cap and never sends such a request: a corpus case above it would be billed
    // here and measure something production never does.
    const tooLarge = CASES.filter(testCase => boundOf(config, testCase) > config.maxInputTokens).map(testCase => testCase.id);
    if (tooLarge.length) {
      err(`Refused: ${tooLarge.length} case(s) exceed MOBILE_AI_MAX_INPUT_TOKENS (${config.maxInputTokens}); the server would refuse them. No provider was created.`);
      return 2;
    }
    const worst = worstCaseMicroUsd(config);
    const flag = argv.indexOf('--approve-micro-usd');
    const approved = flag >= 0 && /^\d{1,12}$/.test(argv[flag + 1] ?? '') ? Number(argv[flag + 1]) : null;
    if (approved === null || approved < worst) {
      err(`Refused: this run may cost up to ${worst} µUSD (every case at its maximum); pass --approve-micro-usd <n> with the owner-approved amount, at least that. No provider was created.`);
      return 2;
    }
    spend = { environment: config.environment, providerProject: config.providerProject, approvedMicroUsd: approved, worstCaseMicroUsd: worst };
    err(`WARNING: live evaluation against ${config.modelKey} in ${config.environment}. Every case is a billed request (${CASES.length} requests, at most ${worst} µUSD).`);
    const provider = createProvider(config);
    respond = call => provider.respond(call);
    price = config.price;
    callOptions = { maxOutputTokens: config.maxOutputTokens, reasoningEffort: config.reasoningEffort };
    expected = config;
    model = config.modelKey;
  }
  const { cases, metrics } = await runEval({ cases: CASES, respond, price, callOptions, expected });
  const verdict = checkThresholds(metrics);
  const imperfect = cases.filter(item => !item.typeCorrect || item.flags.length || Object.values(item.fieldScores).includes(false))
    .map(({ id, expectedType, type, fieldScores, flags }) => ({ id, expectedType, type, fieldScores, flags }));
  // A live run lists every refusal's words for a human reading: the refusal metrics are heuristics, not a judgement.
  const refusals = live ? cases.filter(item => item.expectedType === 'out_of_scope').map(({ id, type, message }) => ({ id, type, message })) : undefined;
  if (stale && !live) err(`WARNING: the price table was read on ${PRICING.readOn}; a live run or a release must re-read it first.`);
  // The provider files each request under the UTC day it ran; reconcile.js needs to know if the run crossed midnight.
  const finishedOnUTC = clock();
  out(JSON.stringify({ mode: live ? 'live' : 'fixture', model, ranOnUTC: today, finishedOnUTC, pricing, ...(spend ?? {}), metrics, verdict, imperfect, refusals }, null, 2));
  return verdict.pass ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = await main();
