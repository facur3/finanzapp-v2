// node server/mobile/evals/run.js         → the fixture responder; a JSON report; exit 1 if a threshold fails.
// node server/mobile/evals/run.js --live  → a real provider. Spends money. Refused (exit 2, before any provider exists)
//   unless MOBILE_AI_EVAL_LIVE=1 AND the environment holds a complete Assistant configuration (runtime.js aiConfig).
import { pathToFileURL } from 'node:url';
import { aiConfig } from '../runtime.js';
import { createProvider as defaultCreateProvider } from '../provider.js';
import { CASES } from './corpus.js';
import { CALL_OPTIONS, fixtureResponder, runEval } from './harness.js';
import { checkThresholds } from './thresholds.js';

export async function main(argv = process.argv.slice(2), env = process.env, { createProvider = defaultCreateProvider, out = console.log, err = console.error } = {}) {
  const live = argv.includes('--live');
  let respond = fixtureResponder(CASES), price, callOptions = CALL_OPTIONS, model = 'fixture';
  if (live) {
    const config = env.MOBILE_AI_EVAL_LIVE === '1' ? aiConfig(env) : null;
    if (!config) {
      err('Refused: --live needs MOBILE_AI_EVAL_LIVE=1 and a complete Assistant configuration (MOBILE_AI_*). No provider was created.');
      return 2;
    }
    err(`WARNING: live evaluation against ${config.modelKey}. Every case is a billed request (${CASES.length} requests).`);
    const provider = createProvider(config);
    respond = call => provider.respond(call);
    price = config.price;
    callOptions = { maxOutputTokens: config.maxOutputTokens, reasoningEffort: config.reasoningEffort };
    model = config.modelKey;
  }
  const { cases, metrics } = await runEval({ cases: CASES, respond, price, callOptions });
  const verdict = checkThresholds(metrics);
  const imperfect = cases.filter(item => !item.typeCorrect || item.flags.length || Object.values(item.fieldScores).includes(false))
    .map(({ id, expectedType, type, fieldScores, flags }) => ({ id, expectedType, type, fieldScores, flags }));
  out(JSON.stringify({ mode: live ? 'live' : 'fixture', model, metrics, verdict, imperfect }, null, 2));
  return verdict.pass ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = await main();
