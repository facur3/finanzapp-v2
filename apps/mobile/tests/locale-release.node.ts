import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as bind from '../src/i18n/bind.ts';
import * as device from '../src/i18n/device.ts';
import * as locale from '../src/i18n/locale.ts';
import * as storeModule from '../src/i18n/store.ts';
import * as localeOptions from '../src/ui/locale-options.ts';
import { PREVIEW, RELEASED, RELEASED_LANGUAGES, RELEASED_REGIONS, SUPPORTED_LANGUAGES, SUPPORTED_REGIONS, releasedForBuild } from '../src/i18n/locale.ts';
import type { PreferenceStore } from '../src/i18n/preference.ts';
import type { LocaleEnvironment } from '../src/i18n/store.ts';

// Producto 23.1C2: Spanish and English × Argentina and the United States are
// released, and no production bundle depends on EXPO_PUBLIC_LOCALE_PREVIEW.
// Three layers: the gate function; every place that could set or read the
// flag; and the real toolchain compiling the provider the way Metro compiles a
// release bundle, then running it. Not an EAS build: TestFlight and the iPhone
// have the last word.
const require = createRequire(import.meta.url);
const { transformSync } = require('@babel/core') as { transformSync: (code: string, options: object) => { code: string } | null };
const React = require('react') as typeof import('react');
const renderer = require('react-test-renderer') as typeof import('react-test-renderer');
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
// react-test-renderer announces its deprecation on every create; that notice is not a test failure. Everything else still prints.
const consoleError = console.error;
console.error = (...args: unknown[]) => { if (!String(args[0]).startsWith('react-test-renderer is deprecated')) consoleError(...args); };
const root = resolve(new URL('..', import.meta.url).pathname);
const FLAG = 'EXPO_PUBLIC_LOCALE_PREVIEW';

test('the release: Spanish and English, Argentina and the United States; the development preview adds nothing today', () => {
  assert.deepEqual([...RELEASED_LANGUAGES], ['es', 'en']);
  assert.deepEqual([...RELEASED_REGIONS], ['AR', 'US']);
  assert.deepEqual(RELEASED, { languages: ['es', 'en'], regions: ['AR', 'US'] });
  // A future catalogue may sit in LANGUAGES before RELEASED_LANGUAGES (previewable in FinanzApp Dev); update this line then.
  assert.deepEqual(PREVIEW, RELEASED, 'FinanzApp Dev started with the flag shows exactly what a release shows');
  for (const language of RELEASED_LANGUAGES) assert.ok(SUPPORTED_LANGUAGES.includes(language), 'a released language has a catalogue: ' + language);
  for (const region of RELEASED_REGIONS) assert.ok(SUPPORTED_REGIONS.includes(region), 'a released region has conventions: ' + region);
});

test('a release bundle gets the release gate itself, whatever the flag says', () => {
  // Identity, not equality: PREVIEW deep-equals RELEASED today, so only `===` tells which one the gate returned.
  for (const flag of [undefined, '', '0', '1', 'true', ' 1 ']) assert.equal(releasedForBuild(flag, false), RELEASED, `production, ${FLAG}=${JSON.stringify(flag)}`);
  assert.equal(releasedForBuild(undefined, true), RELEASED, 'a development bundle without the flag');
  assert.equal(releasedForBuild('true', true), RELEASED, 'only the documented value widens it');
  assert.equal(releasedForBuild('1', true), PREVIEW);
});

function sourceFiles(dir: string): string[] {
  return readdirSync(join(root, dir)).flatMap(name => {
    const path = join(dir, name);
    if (statSync(join(root, path)).isDirectory()) return name === 'node_modules' ? [] : sourceFiles(path);
    return /\.(tsx?|jsx?|mjs|cjs)$/.test(name) ? [path] : [];
  });
}
const withoutComments = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

test('nothing configures the flag for a build, and only the provider reads it, beside __DEV__', () => {
  const readers = ['app', 'src', 'scripts'].flatMap(sourceFiles).filter(file => withoutComments(readFileSync(join(root, file), 'utf8')).includes(FLAG));
  assert.deepEqual(readers, ['src/i18n/provider.tsx']);
  const provider = withoutComments(readFileSync(join(root, 'src/i18n/provider.tsx'), 'utf8'));
  assert.equal(provider.split(FLAG).length, 2, 'read once');
  assert.match(provider, /releasedForBuild\(process\.env\.EXPO_PUBLIC_LOCALE_PREVIEW, typeof __DEV__ !== 'undefined' && __DEV__\)/, 'by its literal name, so a release bundle inlines it');
  // Build configuration: app config, EAS profiles, Metro config and package scripts never set it.
  for (const file of ['app.config.ts', 'eas.json', 'metro.config.js', 'package.json']) assert.equal(readFileSync(join(root, file), 'utf8').includes(FLAG), false, file);
  const eas = JSON.parse(readFileSync(join(root, 'eas.json'), 'utf8')) as { build: Record<string, { env?: Record<string, string> }> };
  assert.deepEqual(Object.keys(eas.build), ['development', 'preview', 'testflight']);
  for (const [profile, settings] of Object.entries(eas.build)) assert.equal(Object.keys(settings.env ?? {}).some(key => key.startsWith('EXPO_PUBLIC_LOCALE')), false, 'eas.json ' + profile);
  // Expo CLI loads .env files into EXPO_PUBLIC_ variables. A local .env.local is fine (the README uses one for
  // EXPO_PUBLIC_EAS_PROJECT_ID; .gitignore keeps them out of Git), but none may define the preview flag.
  for (const name of readdirSync(root).filter(name => name.startsWith('.env'))) {
    assert.equal(new RegExp('^\\s*(export\\s+)?' + FLAG + '\\s*=', 'm').test(readFileSync(join(root, name), 'utf8')), false, name);
  }
});

/** A source file compiled by babel-preset-expo exactly as Metro compiles it
 * for iOS (the setup of tests/worklets.node.ts), with the flag set or unset in
 * the build's environment; the previous environment is restored. */
function compile(file: string, isDev: boolean, flag: string | undefined): string {
  const previous = process.env[FLAG];
  if (flag === undefined) delete process.env[FLAG]; else process.env[FLAG] = flag;
  try {
    const path = join(root, file);
    return transformSync(readFileSync(path, 'utf8'), { filename: path, babelrc: false, configFile: false,
      presets: [['babel-preset-expo', { jsxRuntime: 'automatic' }]], caller: { name: 'metro', platform: 'ios', bundler: 'metro', isDev } })!.code!;
  } finally {
    if (previous === undefined) delete process.env[FLAG]; else process.env[FLAG] = previous;
  }
}

/** Runs compiled code as a CommonJS module; `stubs` answer its imports, anything else (Babel's runtime helpers) is the real package. */
function run(code: string, stubs: Record<string, unknown>): Record<string, any> {
  const module = { exports: {} as Record<string, any> };
  runInNewContext(code, { module, exports: module.exports, require: (name: string) => Object.hasOwn(stubs, name) ? stubs[name] : require(name) });
  return module.exports;
}

function memory(): () => PreferenceStore {
  const rows = new Map<string, string>();
  const store: PreferenceStore = { getItemSync: key => rows.get(key) ?? null, setItemSync: (key, value) => { rows.set(key, value); }, removeItemSync: key => rows.delete(key) };
  return () => store;
}

/** The compiled provider, run with the real store behind a spy that records
 * the environment the provider creates its runtime store with. */
function loadProvider(code: string, deviceRuntime: Record<string, unknown>) {
  const created: LocaleEnvironment[] = [];
  const provider = run(code, {
    react: React, 'react-native': { AppState: { addEventListener: () => ({ remove() {} }) } },
    './bind.ts': bind, './locale.ts': locale, './device-runtime': deviceRuntime, './preference.ts': { defaultPreferenceStore: memory() },
    './store.ts': { ...storeModule, createLocaleStore: (environment: LocaleEnvironment) => { created.push(environment); return storeModule.createLocaleStore(environment); } },
  });
  return { provider, created };
}

const spanishDevice = { readRuntimeDeviceLocales: () => ({ source: 'native', locales: [{ languageTag: 'es-AR', languageCode: 'es', regionCode: 'AR' }] }),
  subscribeRuntimeLocaleChanges: () => () => {} };

test('compiled as Metro compiles a release bundle, the provider keeps no __DEV__ and no flag lookup: the gate is RELEASED with or without the flag', () => {
  for (const flag of [undefined, '1']) {
    const code = compile('src/i18n/provider.tsx', false, flag);
    assert.match(code, /releasedForBuild\)\((undefined|"1"),\s*typeof false\s*!==\s*'undefined'\s*&&\s*false\)/, 'the value is inlined; the development switch is the constant false');
    assert.equal(code.includes(flag === undefined ? 'releasedForBuild)(undefined,' : 'releasedForBuild)("1",'), true, 'the build-time value of the flag, not a run-time lookup');
    assert.equal(/__DEV__|EXPO_PUBLIC_LOCALE_PREVIEW|expo\/virtual\/env/.test(code), false, 'nothing is read at run time');
    const { provider, created } = loadProvider(code, spanishDevice);
    provider.createRuntimeLocaleStore();
    assert.equal(created.length, 1);
    assert.equal(created[0].released, RELEASED, `release bundle with ${FLAG}=${flag}: the release gate itself`);
  }
  // A development bundle reads the flag at run time from Expo's env module, beside the real __DEV__.
  assert.match(compile('src/i18n/provider.tsx', true, '1'), /releasedForBuild\)\(_env\d*\.env\.EXPO_PUBLIC_LOCALE_PREVIEW,\s*typeof __DEV__\s*!==\s*'undefined'\s*&&\s*__DEV__\)/);
});

/** A release bundle's provider and device wiring (both compiled for
 * production, flag unset) on an iPhone whose only language is `languageTag`,
 * with the native module a 23.1C2 build links, as Expo's probe returns it. */
function releaseBundle(languageTag: string, regionCode: string) {
  const events: string[] = [];
  const nativeModule = { addListener: (event: string) => { events.push('add ' + event); return { remove: () => events.push('remove ' + event) }; } };
  const expoLocalization = { getLocales: () => [{ languageTag, languageCode: languageTag.split('-')[0], regionCode }] };
  const runtime = run(compile('src/i18n/device-runtime.ts', false, undefined), {
    expo: { requireOptionalNativeModule: (name: string) => name === 'ExpoLocalization' ? nativeModule : null },
    'expo-localization': expoLocalization, './device': device,
  });
  return { ...loadProvider(compile('src/i18n/provider.tsx', false, undefined), runtime), events };
}

/** The Idioma / Región screen as the app ships it, with host components by name. */
function preferenceScreen(provider: Record<string, any>) {
  const source = readFileSync(join(root, 'src/ui/locale-preference.tsx'), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  return run(code, {
    react: React, 'react/jsx-runtime': require('react/jsx-runtime'), 'react-native': { View: 'View' }, 'expo-router': { Stack: { Screen: 'Stack.Screen' } },
    '../i18n/provider': provider, './components': { AppText: 'AppText', CheckRow: 'CheckRow', ErrorMessage: 'ErrorMessage', Screen: 'Screen', Surface: 'Surface' },
    './locale-options': localeOptions, './motion': { selectionHaptic() {} },
  }).LocalePreferenceScreen;
}

test('a release bundle mounted without a store prop, on an iPhone in English (United States), runs in en-US and offers English and the US region', () => {
  const { provider, created, events } = releaseBundle('en-US', 'US');
  const seen: { i18n?: bind.I18n; preferences?: { state: storeModule.LocaleState } } = {};
  function Probe() { seen.i18n = provider.useI18n(); seen.preferences = provider.useLocalePreferences(); return null; }
  let mounted!: ReturnType<typeof renderer.create>;
  React.act(() => { mounted = renderer.create(React.createElement(provider.I18nProvider, null, React.createElement(Probe))); });
  assert.equal(created.length, 1, 'the provider created its own runtime store');
  assert.equal(created[0].released, RELEASED);
  const { i18n, preferences } = seen;
  assert.equal(i18n!.locale, 'en-US');
  assert.equal(i18n!.localeSource, 'native');
  assert.equal(i18n!.t('preferences.language'), 'Language');
  assert.equal(i18n!.speechLanguage, undefined, 'the device and the interface agree: VoiceOver keeps the voice chosen in iOS Settings');
  assert.equal(i18n!.moneyText(123456, 'USD'), 'US$\u00a01,234.56');
  const state = preferences!.state;
  assert.equal(state.released, RELEASED);
  assert.deepEqual(localeOptions.languageOptions(state, i18n!.t).map(option => [option.value, option.title, option.language ?? '']),
    [['system', 'Same as device', ''], ['es', 'Español', 'es'], ['en', 'English', 'en']]);
  assert.deepEqual(localeOptions.regionOptions(state, i18n!.t).map(option => option.value), ['system', 'AR', 'US']);
  assert.equal(localeOptions.showsPreference('region', state), true, 'Más shows Región');
  assert.deepEqual(events, ['add onLocaleSettingsChanged'], "subscribed to iOS's locale-change event");
  React.act(() => mounted.unmount());
  assert.deepEqual(events, ['add onLocaleSettingsChanged', 'remove onLocaleSettingsChanged']);
});

test('the release bundle\'s Idioma lists Español and English, each spoken in its own language, and Región lists both regions; no "Spanish for now" note', () => {
  const { provider } = releaseBundle('es-AR', 'AR');
  const LocalePreferenceScreen = preferenceScreen(provider);
  let mounted!: ReturnType<typeof renderer.create>;
  React.act(() => { mounted = renderer.create(React.createElement(provider.I18nProvider, null, React.createElement(LocalePreferenceScreen, { kind: 'language' }))); });
  const rows = () => mounted.root.findAllByType('CheckRow' as never).map(row => row.props);
  const note = () => mounted.root.findAllByType('AppText' as never).map(node => String(node.props.children)).join(' ');
  assert.deepEqual(rows().map(row => [row.title, row.subtitle ?? '', row.accessibilityLanguage ?? '']),
    [['Según el dispositivo', 'Ahora: Español', ''], ['Español', '', 'es'], ['English', '', 'en']],
    '"English" is spoken by an English voice and "Español" by a Spanish one, as iOS Settings does; the device row keeps the interface voice');
  assert.equal(note(), 'Cambiar el idioma o la región no modifica tus movimientos, tus cuentas ni tus copias de seguridad.');
  React.act(() => rows()[2].onPress());
  assert.equal(mounted.root.findByType('Stack.Screen' as never).props.options.title, 'Language', 'English chosen in a release bundle applies in place');
  assert.equal(note(), 'Changing the language or the region does not modify your transactions, accounts or backups.');
  React.act(() => mounted.update(React.createElement(provider.I18nProvider, null, React.createElement(LocalePreferenceScreen, { kind: 'region' }))));
  assert.deepEqual(rows().map(row => [row.title, row.subtitle ?? '', row.accessibilityLanguage ?? '']),
    [['Same as device', 'Now: Argentina', ''], ['Argentina', '22/9/2026 · 1.234,56', ''], ['United States', '9/22/2026 · 1,234.56', '']]);
  React.act(() => mounted.unmount());
});
