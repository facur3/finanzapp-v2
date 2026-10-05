// Staging cost reconciliation (Producto 25A-06; docs/ai-staging-runbook.md §9). Compares what FinanzApp settled (the
// usage report of usage-report.sql, plus any live evaluation reports, whose calls bypass the reservations) with what the
// provider billed (OpenAI's Costs API response, saved by the owner with an admin key that this script never sees).
// Offline: two or more local JSON files in, a verdict out. Exit 1 when a day needs investigation.
//
//   node server/mobile/staging/reconcile.js --ours usage.json --provider costs.json --project proj_… [--eval eval.json …]
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

/** Our estimate rounds every token up and prices unknown cache writes at the highest rate, so it may sit above the bill,
 * never below it. Above by more than this is reported (a stale price table, an unpriced discount), not failed. */
export const OVER_ESTIMATE = Object.freeze({ ratio: 0.05, slackMicroUsd: 1000 });

const DAY = 86_400;

/** The provider's daily cost in µUSD, from one complete Costs API page (`data[].results[].amount`), for one project.
 * Refuses what it cannot compare honestly: a truncated page, a result without a project (fetched without
 * `group_by=project_id`), a non-USD or non-numeric amount, a bucket not aligned on a UTC day, or no result at all for
 * the project (a mistyped id, or the spend billed to another project). */
export function providerDays(costs, projectId) {
  if (!/^proj_[A-Za-z0-9]{8,64}$/.test(projectId ?? '')) throw new Error('Pass --project with the staging project id');
  if (costs?.has_more) throw new Error('The Costs API page is truncated (has_more): fetch the whole period');
  const days = new Map();
  let matched = 0;
  for (const bucket of costs?.data ?? []) {
    if (!Number.isSafeInteger(bucket.start_time) || bucket.start_time % DAY !== 0) throw new Error('A cost bucket is not one UTC day (bucket_width=1d)');
    const day = new Date(bucket.start_time * 1000).toISOString().slice(0, 10);
    for (const result of bucket.results ?? []) {
      if (typeof result.project_id !== 'string') throw new Error('A cost result has no project: fetch with group_by=project_id');
      const value = result.amount?.value;
      if (String(result.amount?.currency ?? '').toLowerCase() !== 'usd' || typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw new Error('A cost amount is not a USD number');
      if (result.project_id !== projectId) continue;
      matched++;
      days.set(day, (days.get(day) ?? 0) + Math.round(value * 1_000_000));
    }
  }
  if (!matched) throw new Error('No provider cost belongs to ' + projectId + ': check the id and the period');
  return days;
}

/** One verdict per day. `evals`: live evaluation reports (run.js), each `{ mode, ranOnUTC, finishedOnUTC, providerProject,
 * metrics.costTotalMicroUsd }`; their calls bypass the reservations, so their cost is added to their day. */
export function reconcile({ ours, provider, evals = [], projectId }) {
  if (ours?.kind !== 'finanzapp.ai-usage.v1' || ours.environment !== 'staging') throw new Error('Not a staging usage report');
  const billed = providerDays(provider, projectId);
  const evalCost = new Map();
  for (const report of evals) {
    if (report?.mode !== 'live' || !Number.isSafeInteger(report.metrics?.costTotalMicroUsd)) throw new Error('Not a live evaluation report');
    if (report.providerProject !== projectId) throw new Error('A live evaluation ran against another provider project');
    // The provider files each request under the UTC day it ran; a run across midnight cannot be split here.
    if (report.finishedOnUTC !== report.ranOnUTC) throw new Error('A live evaluation crossed UTC midnight: reconcile those two days by hand');
    evalCost.set(report.ranOnUTC, (evalCost.get(report.ranOnUTC) ?? 0) + report.metrics.costTotalMicroUsd);
  }
  const empty = { settledMicroUsd: 0, chargedMicroUsd: 0, unsettled: 0, staleReserved: 0, estimateExceeded: 0 };
  const days = new Set([...ours.days.map(d => d.day), ...evalCost.keys(), ...billed.keys()]);
  return [...days].sort().map(day => {
    const row = { ...empty, ...ours.days.find(d => d.day === day) };
    const extra = evalCost.get(day) ?? 0;
    // `estimated`: what FinanzApp knows it spent. `bound`: the most it can have spent (unknown costs at their maximum).
    const estimated = row.settledMicroUsd + extra;
    const bound = Math.max(row.chargedMicroUsd, row.settledMicroUsd) + extra;
    const actual = billed.get(day);
    const notes = [];
    let status = 'ok';
    if (row.unsettled || row.staleReserved) notes.push(`${row.unsettled + row.staleReserved} request(s) without a settled cost (counted at their maximum)`);
    if (row.estimateExceeded) { status = 'investigate'; notes.push(`${row.estimateExceeded} estimate_exceeded`); }
    if (actual === undefined) {
      if (estimated > 0 && status === 'ok') { status = 'pending'; notes.push('no provider cost for this day yet'); }
    } else if (actual > bound) { status = 'investigate'; notes.push('the provider billed more than FinanzApp can have spent'); }
    else if (!(row.unsettled || row.staleReserved) && estimated > actual * (1 + OVER_ESTIMATE.ratio) + OVER_ESTIMATE.slackMicroUsd && status === 'ok') {
      status = 'over_estimate'; notes.push('FinanzApp settled noticeably more than billed');
    }
    return { day, status, estimatedMicroUsd: estimated, boundMicroUsd: bound, billedMicroUsd: actual ?? null, notes };
  });
}

export function main(argv = process.argv.slice(2), { read = path => JSON.parse(readFileSync(path, 'utf8')), out = console.log } = {}) {
  const value = flag => { const i = argv.indexOf(flag); return i >= 0 ? argv[i + 1] : undefined; };
  const evals = argv.flatMap((arg, i) => arg === '--eval' ? [read(argv[i + 1])] : []);
  if (!value('--ours') || !value('--provider') || !value('--project')) { out('Usage: reconcile.js --ours usage.json --provider costs.json --project proj_… [--eval eval.json]'); return 2; }
  let days;
  try { days = reconcile({ ours: read(value('--ours')), provider: read(value('--provider')), evals, projectId: value('--project') }); }
  catch (error) { out('Refused: ' + error.message); return 2; }
  out(JSON.stringify(days, null, 2));
  return days.some(d => d.status === 'investigate') ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = main();
