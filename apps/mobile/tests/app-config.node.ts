import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

// The dynamic Expo config, evaluated with a chosen environment. Guards the EAS
// link and the isolated pilot identities; it is not an EAS build or a store check.
function config(env: Record<string, string>) {
  const source = readFileSync(new URL('../app.config.ts', import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
  const module = { exports: {} as { default?: any } };
  runInNewContext(code, { module, exports: module.exports, process: { env }, Error });
  return module.exports.default!;
}

test('the EAS project is linked by default, with the owner, and the ID can still be overridden', () => {
  const dev = config({});
  assert.equal(dev.owner, 'facur3');
  assert.equal(dev.slug, 'finanzapp-mobile');
  assert.equal(dev.extra.eas.projectId, 'b1cd9780-7e6a-4de3-9248-d446d0c77520');
  assert.equal(dev.ios.bundleIdentifier, 'com.facur3.finanzapp.dev');
  assert.equal(dev.name, 'FinanzApp Dev');
  const preview = config({ APP_VARIANT: 'preview' });
  assert.equal(preview.ios.bundleIdentifier, 'com.facur3.finanzapp.preview');
  assert.equal(preview.extra.eas.projectId, 'b1cd9780-7e6a-4de3-9248-d446d0c77520');
  assert.equal(config({ EXPO_PUBLIC_EAS_PROJECT_ID: '00000000-0000-4000-8000-000000000000' }).extra.eas.projectId, '00000000-0000-4000-8000-000000000000');
  assert.equal(config({ EXPO_PUBLIC_EAS_PROJECT_ID: '  ' }).extra.eas.projectId, 'b1cd9780-7e6a-4de3-9248-d446d0c77520', 'a blank override falls back to the real project');
  assert.throws(() => config({ EXPO_PUBLIC_EAS_PROJECT_ID: 'not-a-uuid' }), /UUID real/);
  assert.throws(() => config({ APP_VARIANT: 'production' }), /development o preview/, 'the production identity stays disabled in the pilot');
  assert.equal(JSON.stringify(dev).includes('com.facur3.finanzapp"'), false, 'never the legacy production bundle identifier');
});
