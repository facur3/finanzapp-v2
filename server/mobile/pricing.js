// Reference model prices: data, not code. Integer micro-USD (µUSD, 1 USD = 1 000 000 µUSD) per one million tokens, so
// every cost computed from them stays an integer. Re-read the source before staging and at every release; a model
// missing here cannot be configured (the server refuses to reserve a cost it cannot bound).
//
// Source: https://developers.openai.com/api/docs/pricing (Standard tier, short context), read 2026-10-05. Cache writes
// are billed at 1.25 × the uncached input rate (model page of gpt-6-luna, same date). Only the Standard tier is
// priced: the request pins `service_tier: "default"`, and a reply served on any other tier is settled at its maximum.
export const PRICING = Object.freeze({
  readOn: '2026-10-05',
  source: 'https://developers.openai.com/api/docs/pricing',
  models: Object.freeze({
    // The 25A-06 staging candidate, not a choice: the evaluation decides (docs/production-plan.md §5.8).
    'openai:gpt-6-luna': Object.freeze({ inputPerMTok: 100_000, cachedInputPerMTok: 10_000, cacheWritePerMTok: 125_000, outputPerMTok: 500_000,
      // Above this many input tokens the long-context price applies; caps stay far below it.
      shortContextTokens: 272_000, reasoningEfforts: Object.freeze(['none', 'low']) }),
    // A comparison only if the candidate fails a required threshold.
    'openai:gpt-5.6-luna': Object.freeze({ inputPerMTok: 200_000, cachedInputPerMTok: 20_000, cacheWritePerMTok: 250_000, outputPerMTok: 1_200_000,
      shortContextTokens: 272_000, reasoningEfforts: Object.freeze(['low']) }),
  }),
});

/** How old the table may be when a live evaluation or a release relies on it (docs/ai-staging-runbook.md §9): past
 * this, `run.js --live` refuses until a person re-reads the source and records a new `readOn` in a reviewed commit. A
 * date moved forward without a re-read defeats the check; a price changed to make a run pass is never allowed. */
export const PRICING_MAX_AGE_DAYS = 30;

/** Whole days from `readOn` to `todayISO` (both YYYY-MM-DD, UTC); null when either is not a date or readOn is later. */
export function pricingAgeDays(todayISO, readOn = PRICING.readOn) {
  const days = (Date.parse(todayISO + 'T00:00:00Z') - Date.parse(readOn + 'T00:00:00Z')) / 86_400_000;
  return Number.isSafeInteger(days) && days >= 0 ? days : null;
}
