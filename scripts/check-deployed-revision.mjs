#!/usr/bin/env node
/* B8's deployed-revision check (docs/ai-staging-runbook.md §12.2). No dependencies. On an up-to-date clone:
   `node scripts/check-deployed-revision.mjs <the Production deployment's commit>` prints COMPATIBLE, or each reason it
   is not and exits 1.

   COMPATIBLE: the commit is on origin/master, at or after the commit B7 run #3 passed with, and everything a Vercel
   deployment can build, bundle or run is that commit's, except the reviewed changes below, each pinned to its exact
   content. Deny by default: only the paths in INERT may differ freely, so a new root file (middleware.js, proxy.js,
   vercel.ts, .vercelignore, .npmrc, another lockfile) fails it, which the previous `git diff -- api server packages
   vercel.json package.json package-lock.json` let through. */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

/** B7 run #3 passed from this commit (2026-10-11). */
export const B7_COMMIT = '900ee77115453b8be1fe0f2a18b9841bc7aaa884';

/** Never built, bundled or run by the deployment: the app, the docs, CI, these scripts, licences and root prose. */
export const INERT = ['apps/mobile', 'docs', '.github', 'scripts', 'LICENSES', '.gitignore', ':(glob)*.md'];

/** Reviewed changes since B7, by git blob id: each path holds B7's content or exactly this one, nothing else. */
export const REVIEWED = Object.freeze({
  // git.deploymentEnabled replaces ignoreCommand, which canceled every Git-triggered Production build (runbook §2.3).
  'vercel.json': '35d041aa222dcb55001701b3205938c841e2b9a4',
  // Its tests: the new vercel.json, and the deployed entrypoints closed outside Production with every secret present.
  'server/mobile/staging/staging.test.js': '9e20b1d91a6b218414ccb39e02b3539f13c5fbca',
});

const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const attempt = (cwd, ...args) => { try { return git(cwd, ...args); } catch { return null; } };
const exclude = path => path.startsWith(':(') ? ':(top,exclude,' + path.slice(2) : ':(top,exclude)' + path;

/** Why `commit` is not COMPATIBLE; empty when it is. */
export function incompatibilities(commit, { cwd = process.cwd(), base = B7_COMMIT, reviewed = REVIEWED, master = 'origin/master' } = {}) {
  const sha = attempt(cwd, 'rev-parse', '--verify', '--quiet', commit + '^{commit}');
  if (!sha) return [`${commit} is not a commit in this clone (run git fetch origin first)`];
  const short = base.slice(0, 7);
  const reasons = [];
  if (attempt(cwd, 'merge-base', '--is-ancestor', base, sha) === null) reasons.push(`it is not at or after ${short}`);
  if (attempt(cwd, 'merge-base', '--is-ancestor', sha, master) === null) reasons.push(`it is not on ${master}`);
  const changed = git(cwd, 'diff', '--no-renames', '--name-only', base, sha, '--', ':/', ...[...INERT, ...Object.keys(reviewed)].map(exclude));
  for (const path of changed ? changed.split('\n') : []) reasons.push(`${path} differs from ${short}`);
  for (const [path, blob] of Object.entries(reviewed)) {
    const now = attempt(cwd, 'rev-parse', `${sha}:${path}`);
    if (!now || (now !== attempt(cwd, 'rev-parse', `${base}:${path}`) && now !== blob)) reasons.push(`${path} is neither ${short}'s nor the reviewed change`);
  }
  return reasons;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [commit] = process.argv.slice(2);
  if (!commit) { console.error('usage: node scripts/check-deployed-revision.mjs <deployment commit>'); process.exit(2); }
  const reasons = incompatibilities(commit);
  if (reasons.length) { reasons.forEach(reason => console.error('NOT COMPATIBLE: ' + reason)); process.exit(1); }
  console.log('COMPATIBLE');
}
