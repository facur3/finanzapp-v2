import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { DEFAULT_LANGUAGE, RELEASED_LANGUAGES } from '../src/i18n/locale.ts';

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

// Producto 23.1C2: what iOS is told about the app's languages. Checked on the
// evaluated config and through expo-localization's own config plugin (the code
// EAS runs when it generates the iOS project); an Xcode build and the iPhone's
// Settings → Apps → FinanzApp → Language still have the last word.
type PluginEntry = string | [string, unknown];
const VARIANTS: { env: Record<string, string>; bundle: string }[] = [
  { env: {}, bundle: 'com.facur3.finanzapp.dev' }, { env: { APP_VARIANT: 'preview' }, bundle: 'com.facur3.finanzapp.preview' }];
/** The evaluated config copied out of the sandbox (its objects and arrays belong to another realm). */
const plain = (env: Record<string, string>) => JSON.parse(JSON.stringify(config(env)));
const localizationEntries = (evaluated: { plugins: PluginEntry[] }) =>
  evaluated.plugins.filter(plugin => (Array.isArray(plugin) ? plugin[0] : plugin) === 'expo-localization');

test('23.1C2: iOS declares exactly the released languages, falls back to Spanish and always offers the per-app language', () => {
  for (const { env, bundle } of VARIANTS) {
    const evaluated = plain(env);
    const entries = localizationEntries(evaluated);
    assert.equal(entries.length, 1, 'expo-localization is declared once');
    assert.ok(Array.isArray(entries[0]) && entries[0].length === 2, 'as a [name, options] tuple');
    const [, options] = entries[0] as [string, { supportedLocales: { ios: string[] } }];
    assert.deepEqual(options, { supportedLocales: { ios: [...RELEASED_LANGUAGES] } },
      'the object form with only its ios key (no Android locale files in the pilot), naming exactly RELEASED_LANGUAGES');
    for (const tag of options.supportedLocales.ios) assert.match(tag, /^[a-z]{2}$/, 'a bare language designator: the region is its own preference');
    const plist = evaluated.ios.infoPlist as Record<string, unknown>;
    assert.equal(plist.CFBundleDevelopmentRegion, DEFAULT_LANGUAGE, "iOS's fallback for its own text is the app's fallback language");
    assert.equal(plist.UIPrefersShowingLanguageSettings, true);
    for (const key of ['CFBundleLocalizations', 'CFBundleAllowMixedLocalizations']) assert.equal(key in plist, false, key + ' is written only by the plugin, never by hand');
    assert.equal(evaluated.ios.bundleIdentifier, bundle, 'the pilot identities are unchanged');
    assert.equal(evaluated.android.package, bundle);
  }
  assert.equal(/LOCALE_PREVIEW/.test(readFileSync(new URL('../app.config.ts', import.meta.url), 'utf8')), false, 'the app config never reads the development preview flag');
});

test("23.1C2: expo-localization's own plugin writes CFBundleLocalizations [es, en] and registers no dangerous or Gradle mod", () => {
  const plugin = createRequire(import.meta.url)('expo-localization/app.plugin.js') as { default?: unknown };
  const withLocalization = (plugin.default ?? plugin) as (config: any, options: unknown) => any;
  for (const { env } of VARIANTS) {
    const evaluated = plain(env);
    const [, options] = localizationEntries(evaluated)[0] as [string, unknown];
    const out = withLocalization({ ...evaluated, _internal: { projectRoot: new URL('..', import.meta.url).pathname } }, options);
    assert.deepEqual(out.ios.infoPlist.CFBundleLocalizations, ['es', 'en']);
    assert.deepEqual(out.ios.infoPlist.CFBundleLocalizations, [...RELEASED_LANGUAGES]);
    assert.equal(out.ios.infoPlist.CFBundleDevelopmentRegion, 'es', 'the plugin keeps the fallback language');
    assert.deepEqual(Object.keys(out.mods ?? {}), ['android'], 'iOS gets plain Info.plist keys, no iOS mod');
    const android = Object.keys(out.mods.android);
    assert.deepEqual(android.sort(), ['manifest', 'strings'], 'Android: the default configChanges and an RTL-strings pass that writes nothing; no locales_config.xml or localeConfig');
    assert.equal(android.includes('dangerous') || android.some(mod => /gradle/i.test(mod)), false);
  }
});
