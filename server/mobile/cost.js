// The Assistant's cost model: pure integer arithmetic in micro-USD (µUSD). Server accounting only (the reservation and
// its settlement, the cost simulator); never used for anything in the person's ledger. Every rounding goes up, so an
// estimate is never below what the provider bills.
const MILLION = 1_000_000n;
const ceilDiv = (a, b) => (a + b - 1n) / b;
const count = value => Number.isSafeInteger(value) && value >= 0;

function micro(total) {
  const value = Number(ceilDiv(total, MILLION));
  if (!Number.isSafeInteger(value)) throw new RangeError('Cost out of range');
  return value;
}

/** The most a request can cost: every input token at the highest input rate (uncached, cache write or cached), plus
 * the output cap (which includes reasoning tokens) at the output rate. */
export function maxCostMicroUsd(price, { inputTokens, outputTokens }) {
  if (!count(inputTokens) || !count(outputTokens)) throw new RangeError('Invalid token bound');
  const input = BigInt(Math.max(price.inputPerMTok, price.cacheWritePerMTok, price.cachedInputPerMTok));
  return micro(BigInt(inputTokens) * input + BigInt(outputTokens) * BigInt(price.outputPerMTok));
}

/** Normalized usage, or null when it cannot be trusted for settlement (missing, negative, inconsistent). */
export function usageOrNull(usage) {
  if (!usage || ![usage.inputTokens, usage.cachedInputTokens, usage.cacheWriteTokens, usage.outputTokens, usage.reasoningTokens].every(count)) return null;
  if (usage.cachedInputTokens + usage.cacheWriteTokens > usage.inputTokens || usage.reasoningTokens > usage.outputTokens) return null;
  return { inputTokens: usage.inputTokens, cachedInputTokens: usage.cachedInputTokens, cacheWriteTokens: usage.cacheWriteTokens,
    outputTokens: usage.outputTokens, reasoningTokens: usage.reasoningTokens };
}

/** What a completed request actually cost, from the provider's reported usage. */
export function actualCostMicroUsd(price, usage) {
  const used = usageOrNull(usage);
  if (!used) throw new RangeError('Untrusted usage');
  const uncached = used.inputTokens - used.cachedInputTokens - used.cacheWriteTokens;
  return micro(BigInt(uncached) * BigInt(price.inputPerMTok) + BigInt(used.cachedInputTokens) * BigInt(price.cachedInputPerMTok)
    + BigInt(used.cacheWriteTokens) * BigInt(price.cacheWritePerMTok) + BigInt(used.outputTokens) * BigInt(price.outputPerMTok));
}

const percentile = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1)];

/** A deterministic monthly-cost simulation for sizing staging and production ceilings (never a price shown to anyone).
 * `requests`: sample usages of single requests (measured on staging, or synthetic). `monthlyRequests`: requests per
 * person per month to evaluate (for example [30, 300, 1500]). Each person's month is costed at the sample's p50 and p95
 * request, the second a pessimistic bound. */
export function simulateMonthlyCost(price, { requests, monthlyRequests, people = 1 }) {
  if (!Array.isArray(requests) || !requests.length || !Array.isArray(monthlyRequests) || !monthlyRequests.every(count) || !count(people)) throw new RangeError('Invalid simulation');
  const costs = requests.map(usage => actualCostMicroUsd(price, usage)).sort((a, b) => a - b);
  const perRequest = { p50: percentile(costs, 0.5), p95: percentile(costs, 0.95), max: costs.at(-1) };
  return { perRequest, months: monthlyRequests.map(n => ({ requests: n, typicalMicroUsd: n * perRequest.p50 * people, p95MicroUsd: n * perRequest.p95 * people })) };
}
