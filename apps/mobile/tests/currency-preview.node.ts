import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { test } from 'node:test';
import { LEDGER_CURRENCIES, isStorableCurrency, minorUnitExponent } from '@finanzapp/domain';
import { CURRENCY_PREVIEW_FLAG, PREVIEW_CURRENCIES, currencyGateForBuild, isPreviewGate, previewOnlyCurrencies } from '../src/storage/currency-gate.ts';

// Producto 24B5: the development preview of currencies (docs/currency.md §7.5, stage 9). Like the
// locale preview, it widens the creation gate only in a development bundle started with the flag,
// and a release bundle compiles to the production gate whatever the flag says: proven with the real
// toolchain (babel-preset-expo as Metro runs it) on the ledger provider that reads the flag.
const require = createRequire(import.meta.url);
const { transformSync } = require('@babel/core') as { transformSync: (code: string, options: object) => { code: string } | null };
const root = resolve(new URL('..', import.meta.url).pathname);

test('the preview gate is the release pair plus five storable test currencies covering zero, two and three decimals; a release bundle gets the production gate whatever the flag says', () => {
  assert.deepEqual([...PREVIEW_CURRENCIES], ['ARS', 'USD', 'EUR', 'GBP', 'JPY', 'CLP', 'KWD']);
  assert.ok(PREVIEW_CURRENCIES.every(code => isStorableCurrency(code)));
  assert.deepEqual(PREVIEW_CURRENCIES.map(code => minorUnitExponent(code)), [2, 2, 2, 2, 0, 0, 3]);
  for (const flag of [undefined, '', '0', '1', 'true', ' 1 ']) assert.equal(currencyGateForBuild(flag, false), LEDGER_CURRENCIES, `production, ${CURRENCY_PREVIEW_FLAG}=${JSON.stringify(flag)}`);
  assert.equal(currencyGateForBuild(undefined, true), LEDGER_CURRENCIES, 'a development bundle without the flag');
  assert.equal(currencyGateForBuild('true', true), LEDGER_CURRENCIES, 'only the documented value widens it');
  assert.equal(currencyGateForBuild('1', true), PREVIEW_CURRENCIES);
  assert.equal(isPreviewGate(LEDGER_CURRENCIES), false);
  assert.equal(isPreviewGate(['ARS', 'USD']), false, 'the same pair in another array is still the release');
  assert.equal(isPreviewGate(PREVIEW_CURRENCIES), true);
  assert.deepEqual(previewOnlyCurrencies(PREVIEW_CURRENCIES), ['EUR', 'GBP', 'JPY', 'CLP', 'KWD']);
  assert.deepEqual(previewOnlyCurrencies(LEDGER_CURRENCIES), []);
});

test('the provider reads the flag by its literal name beside __DEV__, and no config, profile or committed .env sets it', () => {
  const provider = readFileSync(join(root, 'src/storage/LedgerProvider.tsx'), 'utf8');
  assert.match(provider, /currencyGateForBuild\(process\.env\.EXPO_PUBLIC_CURRENCY_PREVIEW, typeof __DEV__ !== 'undefined' && __DEV__\)/, 'by its literal name, so a release bundle inlines it');
  assert.match(provider, /createAccount\(db, account, appearance, BUILD_CURRENCY_GATE\)/);
  assert.match(provider, /saveMonthlyBudget\(db, budget, BUILD_CURRENCY_GATE\)/);
  assert.match(provider, /createCreditCard\(db, account, card, BUILD_CURRENCY_GATE\)/);
  assert.match(provider, /createPersonalDebt\(db, account, debt, BUILD_CURRENCY_GATE\)/);
  for (const file of ['app.config.ts', 'eas.json', 'metro.config.js', 'package.json']) assert.equal(readFileSync(join(root, file), 'utf8').includes(CURRENCY_PREVIEW_FLAG), false, file);
  const eas = JSON.parse(readFileSync(join(root, 'eas.json'), 'utf8')) as { build: Record<string, { env?: Record<string, string> }> };
  for (const [profile, settings] of Object.entries(eas.build)) assert.equal(Object.keys(settings.env ?? {}).some(key => key.startsWith('EXPO_PUBLIC_CURRENCY')), false, 'eas.json ' + profile);
  for (const name of readdirSync(root).filter(name => name.startsWith('.env'))) {
    assert.equal(readFileSync(join(root, name), 'utf8').includes(CURRENCY_PREVIEW_FLAG), false, name + ' must not define the preview flag');
  }
  const ci = readFileSync(join(root, '../../.github/workflows/ci.yml'), 'utf8');
  assert.equal(ci.includes(CURRENCY_PREVIEW_FLAG), false, 'CI builds nothing with the preview');
});

/** A source file compiled by babel-preset-expo exactly as Metro compiles it, with the flag set or unset in the environment. */
function compile(file: string, isDev: boolean, flag: string | undefined): string {
  const previous = process.env[CURRENCY_PREVIEW_FLAG];
  if (flag === undefined) delete process.env[CURRENCY_PREVIEW_FLAG]; else process.env[CURRENCY_PREVIEW_FLAG] = flag;
  try {
    const path = join(root, file);
    return transformSync(readFileSync(path, 'utf8'), { filename: path, babelrc: false, configFile: false,
      presets: [['babel-preset-expo', { jsxRuntime: 'automatic' }]], caller: { name: 'metro', platform: 'ios', bundler: 'metro', isDev } })!.code!;
  } finally {
    if (previous === undefined) delete process.env[CURRENCY_PREVIEW_FLAG]; else process.env[CURRENCY_PREVIEW_FLAG] = previous;
  }
}

test('compiled as Metro compiles a release bundle, the provider keeps no __DEV__ and no flag lookup: the gate is the production pair with or without the flag', () => {
  for (const flag of [undefined, '1']) {
    const code = compile('src/storage/LedgerProvider.tsx', false, flag);
    assert.match(code, /currencyGateForBuild\)\((undefined|"1"),\s*typeof false\s*!==\s*'undefined'\s*&&\s*false\)/, 'the value is inlined; the development switch is the constant false');
    assert.equal(/__DEV__|EXPO_PUBLIC_CURRENCY_PREVIEW|expo\/virtual\/env/.test(code), false, 'nothing is read at run time');
  }
  assert.match(compile('src/storage/LedgerProvider.tsx', true, '1'), /currencyGateForBuild\)\(_env\d*\.env\.EXPO_PUBLIC_CURRENCY_PREVIEW,\s*typeof __DEV__\s*!==\s*'undefined'\s*&&\s*__DEV__\)/, 'a development bundle reads the flag at run time beside the real __DEV__');
});
