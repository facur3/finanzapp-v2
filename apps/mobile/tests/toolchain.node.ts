import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';

const require = createRequire(import.meta.url);

test('the router query-string caller keeps its CommonJS API with the patched decoder', () => {
  const query = require('query-string');
  const values = query.parse('label=Caf%C3%A9+%26+t%C3%A9&tag=a&tag=b&empty=&escaped=%2520');
  assert.deepEqual({ ...values }, { label: 'Café & té', tag: ['a', 'b'], empty: '', escaped: '%20' });
  assert.deepEqual({ ...query.parse(query.stringify(values)) }, { ...values });
});

test('malformed percent-encoded query data completes within a bounded process', () => {
  // The child timeout makes a decoder regression fail instead of hanging CI.
  const output = execFileSync(process.execPath, ['-e',
    "const query = require('query-string'); const result = query.parse('label=' + '%E0%A4%A'.repeat(512)); process.stdout.write(typeof result.label);",
  ], { cwd: new URL('..', import.meta.url), timeout: 2500, encoding: 'utf8' });
  assert.equal(output, 'string');
});

test('the Xcode project generator still creates unique native IDs with patched uuid', () => {
  const project = require('xcode').project('unused-in-memory-project.pbxproj');
  project.hash = { project: { objects: {} } };
  const first = project.generateUuid();
  assert.match(first, /^[A-F0-9]{24}$/);
  assert.notEqual(project.generateUuid(), first);
});
