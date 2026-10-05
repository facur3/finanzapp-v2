import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CANARY, problems, scanBundle, scanDirectory } from './check-bundle-secrets.mjs';

// A Hermes-like bytecode file: a binary header and NUL bytes around the string table, which `grep -I` skips.
const hbc = text => Buffer.concat([Buffer.from([0xc6, 0x1f, 0xbc, 0x03, 0xc1, 0x03, 0x19, 0x1f, 0, 0, 0, 0]), Buffer.from(text), Buffer.alloc(16)]);
// Fixture-only shapes, assembled so this file itself holds no key-shaped literal.
const SB = 'sb_' + 'secret_' + 'fixtureOnlyNotAKey000';
const SK = suffix => 'sk-' + suffix + 'fixtureOnlyNotAKey0000000';

describe('check-bundle-secrets', () => {
  it('finds a secret inside binary bytecode, where grep -I does not look', () => {
    const result = scanBundle([{ path: 'dist/entry.hbc', bytes: hbc(CANARY + '\0' + SB) }]);
    expect(result.hits).toEqual([{ path: 'dist/entry.hbc', name: 'a Supabase secret key' }]);
    expect(problems(result)).toEqual(['dist/entry.hbc: a Supabase secret key']);
  });

  it('finds every provider key prefix and every server secret name', () => {
    for (const value of [SK('proj-'), SK('svcacct-'), SK('admin-'), SK('ant-api03-'), 'MOBILE_AI_API_KEY', 'MOBILE_SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY']) {
      expect(scanBundle([{ path: 'x.hbc', bytes: hbc(CANARY + ' ' + value) }]).hits, value).toHaveLength(1);
    }
  });

  it('does not flag a publishable key or a word that ends in «sk-»', () => {
    const text = [CANARY, 'sb_publishable_fixtureOnly000000', 'task-identifier-long-enough-to-match', 'disk-cache_entry_name_long'].join('\0');
    expect(problems(scanBundle([{ path: 'x.hbc', bytes: hbc(text) }]))).toEqual([]);
  });

  it('fails when it did not read the bundle: no files, or no canary', () => {
    expect(problems(scanBundle([]))).toHaveLength(1);
    expect(problems(scanBundle([{ path: 'x.png', bytes: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0]) }]))[0]).toMatch(/did not read the app bundle/);
  });

  it('never prints the matched value', () => {
    expect(problems(scanBundle([{ path: 'x.hbc', bytes: hbc(SB) }])).join('\n')).not.toContain(SB);
  });

  it('walks nested export directories', () => {
    const dir = mkdtempSync(join(tmpdir(), 'bundle-scan-'));
    try {
      mkdirSync(join(dir, '_expo/static/js/ios'), { recursive: true });
      writeFileSync(join(dir, '_expo/static/js/ios/entry.hbc'), hbc(CANARY));
      writeFileSync(join(dir, 'metadata.json'), '{}');
      expect(problems(scanDirectory(dir))).toEqual([]);
      writeFileSync(join(dir, '_expo/static/js/ios/entry.hbc'), hbc(CANARY + '\0' + SK('proj-')));
      expect(scanDirectory(dir).hits).toEqual([{ path: join(dir, '_expo/static/js/ios/entry.hbc'), name: 'a provider API key' }]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
