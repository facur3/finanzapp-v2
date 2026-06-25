#!/usr/bin/env node
/* Repository hygiene check. No dependencies.
   Fails if forbidden generated/local files are tracked by git. */
import { execSync } from 'node:child_process';

const FORBIDDEN = [/^node_modules\//, /^dist\//, /^\.vite\//, /^\.env(\..*)?$/];

let tracked = '';
try {
  tracked = execSync('git ls-files', { encoding: 'utf8' });
} catch (e) {
  console.error('check:repo — unable to run "git ls-files":', e.message);
  process.exit(1);
}

const offenders = tracked
  .split('\n')
  .map((s) => s.trim())
  .filter(Boolean)
  .filter((f) => FORBIDDEN.some((re) => re.test(f)));

if (offenders.length) {
  console.error('check:repo — FAIL: forbidden files are tracked by git:');
  offenders.forEach((f) => console.error('  - ' + f));
  console.error('\nUntrack them, e.g.: git rm -r --cached <path>');
  process.exit(1);
}

console.log('check:repo — OK: no forbidden generated files are tracked.');
