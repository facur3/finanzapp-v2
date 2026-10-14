import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { incompatibilities, B7_COMMIT, REVIEWED } from './check-deployed-revision.mjs';

const blobId = content => createHash('sha1').update(`blob ${Buffer.byteLength(content)}\0`).update(content).digest('hex');
const root = new URL('../', import.meta.url);

describe('the reviewed changes are the ones in this tree', () => {
  it('pins B7 run #3, the exact vercel.json and staging tests here, and the runbook runs this script', () => {
    expect(B7_COMMIT).toMatch(/^900ee77[0-9a-f]{33}$/);
    // Changing either file needs a reviewed update of REVIEWED and runbook §12.2 before B8 can accept a deployment.
    for (const [path, blob] of Object.entries(REVIEWED)) expect(blobId(readFileSync(new URL(path, root))), path).toBe(blob);
    expect(readFileSync(new URL('docs/ai-staging-runbook.md', root), 'utf8').includes('node scripts/check-deployed-revision.mjs "$S"')).toBe(true);
  });
});

describe('check-deployed-revision (a scratch repository)', () => {
  let dir, base;
  const git = (...args) => execFileSync('git', ['-c', 'user.name=fixture', '-c', 'user.email=fixture@example.test', '-c', 'commit.gpgsign=false',
    '-c', 'core.hooksPath=/dev/null', ...args], { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const write = files => { for (const [path, content] of Object.entries(files)) {
    if (content === null) rmSync(join(dir, path)); else { mkdirSync(dirname(join(dir, path)), { recursive: true }); writeFileSync(join(dir, path), content); }
  } };
  const commit = files => { write(files); git('add', '-A'); git('commit', '-q', '--allow-empty', '-m', 'fixture'); return git('rev-parse', 'HEAD'); };
  const reviewed = { 'vercel.json': blobId('{"git":{}}\n'), 'server/test.js': blobId('reviewed test\n') };
  const check = (sha, master = 'master') => incompatibilities(sha, { cwd: dir, base, reviewed, master });
  /** `files` on top of the base, as master's head. */
  const onMaster = files => { git('checkout', '-q', '-B', 'master', base); return commit(files); };

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'deployed-revision-'));
    git('init', '-q', '-b', 'master');
    commit({ 'server/old.js': 'before B7\n' });
    base = commit({ 'vercel.json': '{"ignoreCommand":"x"}\n', 'server/test.js': 'B7 test\n', 'server/old.js': 'B7\n', 'api/mobile/a.js': 'route\n',
      'packages/p.js': 'p\n', 'package.json': '{}\n', 'apps/mobile/app.ts': 'app\n', 'docs/a.md': 'doc\n', 'README.md': 'readme\n' });
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('accepts B7 itself, inert changes and exactly the reviewed ones', () => {
    expect(check(base)).toEqual([]);
    expect(check(onMaster({ 'apps/mobile/app.ts': 'app 2\n', 'docs/a.md': 'doc 2\n', 'README.md': 'r2\n', 'AGENTS.md': 'a\n',
      'scripts/s.mjs': 's\n', '.github/workflows/ci.yml': 'ci\n', 'LICENSES/x.txt': 'l\n', '.gitignore': 'x\n' }))).toEqual([]);
    expect(check(onMaster({ 'vercel.json': '{"git":{}}\n', 'server/test.js': 'reviewed test\n' }))).toEqual([]);
    expect(check(onMaster({ 'vercel.json': '{"git":{}}\n' }))).toEqual([]);
  });

  it('refuses any other content in a reviewed path, or its deletion', () => {
    expect(check(onMaster({ 'vercel.json': '{"git":{},"crons":[]}\n' }))).toEqual([`vercel.json is neither ${base.slice(0, 7)}'s nor the reviewed change`]);
    expect(check(onMaster({ 'server/test.js': 'other test\n' }))).toHaveLength(1);
    expect(check(onMaster({ 'vercel.json': null }))).toEqual([`vercel.json is neither ${base.slice(0, 7)}'s nor the reviewed change`]);
  });

  it('refuses every other change a deployment could build or run, including new root entrypoints', () => {
    for (const [path, content] of [['server/old.js', 'changed\n'], ['api/mobile/b.js', 'new route\n'], ['packages/p.js', 'p2\n'],
      ['package.json', '{"scripts":{"postinstall":"x"}}\n'], ['package-lock.json', '{}\n'], ['middleware.js', 'm\n'], ['proxy.ts', 'p\n'],
      ['vercel.ts', 'c\n'], ['.vercelignore', 'api\n'], ['.npmrc', 'r\n'], ['yarn.lock', 'y\n'], ['server/notes.md', 'n\n'], ['apps/other.js', 'o\n']]) {
      expect(check(onMaster({ [path]: content })), path).toEqual([`${path} differs from ${base.slice(0, 7)}`]);
    }
    expect(check(onMaster({ 'server/old.js': null, 'docs/old.js': 'B7\n' }))).toEqual([`server/old.js differs from ${base.slice(0, 7)}`]);
  });

  it('refuses a commit before B7, off master, or unknown', () => {
    expect(check(git('rev-parse', base + '~1'))).toContain(`it is not at or after ${base.slice(0, 7)}`);
    git('checkout', '-q', '-B', 'master', base);
    git('checkout', '-q', '-b', 'side');
    const side = commit({ 'docs/a.md': 'side\n' });
    expect(check(side)).toEqual(['it is not on master']);
    expect(check('0'.repeat(40))[0]).toMatch(/is not a commit in this clone/);
  });
});
