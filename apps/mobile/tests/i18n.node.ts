import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatMinorUnits, labelFromISO } from '@finanzapp/domain';
import { readdirSync, readFileSync } from 'node:fs';
import { LOCALE_CHANGED_EVENT, deviceLocales, primaryLanguageOf, readDeviceLocales, subscribeDeviceLocaleChanges } from '../src/i18n/device.ts';
import { codedAmount, currencyName, currencySymbol, dateFromISO, daysAgo, formatAmount, formatCount, formatDate, formatDateTime, formatDayMonth, formatMonth, formatNumericDate,
  formatPercent, moneyText, pickerLocale, relativeDate, relativeDayName, speechLocale, spokenAmount, spokenMoney, spokenNumber, spokenPercent, withCurrencyCode } from '../src/i18n/format.ts';
import { DEFAULT_LOCALE, LANGUAGES, PREVIEW, REGIONS, RELEASED, RELEASED_LANGUAGES, RELEASED_REGIONS, releasedForBuild, SUPPORTED_LANGUAGES, SUPPORTED_REGIONS, composeLocale, languageForTag,
  languageOf, languagePreferenceFrom, regionForCode, regionForTag, regionOf, regionPreferenceFrom, resolveLanguage, resolveLocale, resolveRegion, type AppLocale,
  type ReleasedSets } from '../src/i18n/locale.ts';
import { catalogue, interpolate, messageKeys, translate, translator } from '../src/i18n/messages.ts';
import { es } from '../src/i18n/messages/es/index.ts';
import { en } from '../src/i18n/messages/en/index.ts';
import { LANGUAGE_PREFERENCE_KEY, REGION_PREFERENCE_KEY, readLanguagePreference, readLocalePreferences, readRegionPreference, writeLanguagePreference, writeRegionPreference,
  type PreferenceStore } from '../src/i18n/preference.ts';
import { bindLocale } from '../src/i18n/bind.ts';

// Producto 23.0: the localization foundation. Language, region, an account's
// currency and the stored amount are four separate things; translating a
// label never touches SQLite. English and the United States were released in
// 23.1C2; the gate itself stays (a future catalogue is held back the same
// way), so it is exercised here through an explicit narrower gate.

const LOCALES: AppLocale[] = ['es-AR', 'en-AR', 'es-US', 'en-US'];
/** The gate as it stood until 23.1C1, standing in for any build with a language or region not yet released. */
const SPANISH_ONLY: ReleasedSets = { languages: ['es'], regions: ['AR'] };

test('language and region are two registries; a locale is only their composition, and the four combinations exist', () => {
  assert.deepEqual(SUPPORTED_LANGUAGES, ['es', 'en']);
  assert.deepEqual(SUPPORTED_REGIONS, ['AR', 'US']);
  assert.equal(LANGUAGES.es.name, 'Español', 'a language is listed by its own name');
  assert.equal(LANGUAGES.en.name, 'English');
  assert.deepEqual([...RELEASED_LANGUAGES], ['es', 'en'], 'English is released in 23.1C2, once 23.1B translated every screen');
  assert.deepEqual([...RELEASED_REGIONS], ['AR', 'US'], 'the US region is released in 23.1C2, now that the amount field types US separators');
  assert.deepEqual(RELEASED, { languages: SUPPORTED_LANGUAGES, regions: SUPPORTED_REGIONS }, 'everything the build carries is released');
  for (const language of SUPPORTED_LANGUAGES) for (const region of SUPPORTED_REGIONS) {
    const locale = composeLocale(language, region);
    assert.equal(locale, language + '-' + region);
    assert.equal(languageOf(locale), language);
    assert.equal(regionOf(locale), region);
  }
  assert.equal(languageOf('xx-AR' as AppLocale), 'es', 'an unknown half reads as the default, never undefined');
  assert.equal(regionOf('es-ZZ' as AppLocale), 'AR');
  assert.deepEqual(REGIONS.AR, { decimal: ',', group: '.', dateOrder: 'dmy', hour12: false, dollarSignCurrency: 'ARS' });
  assert.deepEqual(REGIONS.US, { decimal: '.', group: ',', dateOrder: 'mdy', hour12: true, dollarSignCurrency: 'USD' });
});

test('a device tag gives a language by its first subtag and a region by a later one; unsupported values give nothing', () => {
  assert.equal(languageForTag('es-AR'), 'es');
  assert.equal(languageForTag('es-MX'), 'es', 'every Spanish variety reads the Spanish catalogue');
  assert.equal(languageForTag('EN_gb'), 'en');
  assert.equal(languageForTag('pt-BR'), null);
  assert.equal(languageForTag(''), null);
  assert.equal(languageForTag(undefined), null);
  assert.equal(regionForTag('en-US'), 'US');
  assert.equal(regionForTag('es_ar'), 'AR');
  assert.equal(regionForTag('zh-Hant-TW'), null, 'script skipped, Taiwan unsupported');
  assert.equal(regionForTag('es-419'), null, 'a numeric region (Latin America) is not a country');
  assert.equal(regionForTag('ar'), null, 'the Arabic language tag is never read as Argentina');
  assert.equal(regionForTag('es'), null);
  assert.equal(regionForCode('us'), 'US');
  assert.equal(regionForCode('UY'), null);
  assert.equal(regionForCode(null), null);
});

test('language resolution: a released preference wins, then the first released device language, then Spanish; a language outside the gate never surfaces', () => {
  const english = [{ languageTag: 'en-US', languageCode: 'en', regionCode: 'US' }];
  assert.equal(resolveLanguage(english), 'en', 'since 23.1C2 the device language decides: an English iPhone reads English');
  assert.equal(resolveLanguage(english, 'en'), 'en');
  assert.equal(resolveLanguage([], 'system'), 'es');
  assert.equal(resolveLanguage([{ languageTag: 'es-AR' }, { languageTag: 'en-US' }]), 'es', 'the first preferred language wins');
  assert.equal(resolveLanguage([{ languageTag: 'pt-BR' }, { languageTag: 'en-GB' }]), 'en', 'an unsupported first language falls through to the next');
  assert.equal(resolveLanguage([{ languageTag: 'pt-BR' }, { languageTag: 'fr-FR' }]), 'es', 'no supported device language: Spanish');
  assert.equal(resolveLanguage(english, 'es'), 'es', 'an explicit preference beats the device');
  assert.equal(resolveLanguage([{ languageTag: 'es-AR' }], 'en'), 'en');
  assert.equal(resolveLanguage([{ languageTag: '', languageCode: 'en' }]), 'en', 'a bare language code still counts');
  // The gate, for the next catalogue: a language outside it is neither followed nor applied when stored.
  assert.equal(resolveLanguage(english, 'system', SPANISH_ONLY.languages), 'es', 'a device language outside the gate reads Spanish rather than half an app');
  assert.equal(resolveLanguage(english, 'en', SPANISH_ONLY.languages), 'es', 'a stored preference outside the gate is ignored, not an error');
  assert.equal(resolveLanguage([{ languageTag: 'en-GB' }, { languageTag: 'es-MX' }], 'system', SPANISH_ONLY.languages), 'es', 'the next released device language');
});

test('region resolution: a released preference wins, then the device region setting, then Argentina; never the region of a second language', () => {
  const usIPhone = [{ languageTag: 'es-AR', languageCode: 'es', regionCode: 'US' }];
  assert.equal(resolveRegion(usIPhone), 'US', 'the Region setting, not the language tag, decides');
  assert.equal(resolveRegion(usIPhone, 'US'), 'US');
  assert.equal(resolveRegion([{ languageTag: 'en-US', regionCode: 'AR' }]), 'AR', 'English language, Argentine region');
  assert.equal(resolveRegion([{ languageTag: 'en-US' }]), 'US', 'Intl only: the tag carries the region');
  assert.equal(resolveRegion([{ languageTag: 'es-UY', regionCode: 'UY' }, { languageTag: 'en-US', regionCode: 'US' }]), 'AR',
    'an unsupported device region reads the default, not the region of the next language');
  assert.equal(resolveRegion([]), 'AR');
  assert.equal(resolveRegion(usIPhone, 'AR'), 'AR', 'an explicit region beats the device');
  assert.equal(resolveRegion([{ languageTag: 'es-AR', regionCode: 'AR' }], 'US'), 'US');
  // A region outside the gate is neither followed nor applied when stored.
  assert.equal(resolveRegion(usIPhone, 'system', SPANISH_ONLY.regions), 'AR', 'a device region outside the gate reads Argentine conventions');
  assert.equal(resolveRegion(usIPhone, 'US', SPANISH_ONLY.regions), 'AR', 'a stored region outside the gate is ignored');
});

test('each half resolves on its own: every language × region combination and "both follow the device"', () => {
  const device = (languageTag: string, regionCode: string) => [{ languageTag, regionCode }];
  const cases: [ReturnType<typeof device>, Parameters<typeof resolveLocale>[1], AppLocale][] = [
    [device('es-AR', 'AR'), { language: 'es', region: 'AR' }, 'es-AR'],
    [device('es-AR', 'AR'), { language: 'es', region: 'US' }, 'es-US'],
    [device('es-AR', 'AR'), { language: 'en', region: 'AR' }, 'en-AR'],
    [device('es-AR', 'AR'), { language: 'en', region: 'US' }, 'en-US'],
    [device('en-US', 'US'), { language: 'system', region: 'system' }, 'en-US'],
    [device('en-GB', 'AR'), { language: 'system', region: 'system' }, 'en-AR'],
    [device('es-US', 'US'), { language: 'system', region: 'system' }, 'es-US'],
    [device('en-US', 'US'), { language: 'es', region: 'system' }, 'es-US'],
    [device('en-US', 'US'), { language: 'system', region: 'AR' }, 'en-AR'],
    [device('pt-BR', 'BR'), { language: 'system', region: 'system' }, 'es-AR'],
  ];
  for (const [devices, preferences, expected] of cases) {
    const resolved = resolveLocale(devices, preferences);
    assert.equal(resolved.locale, expected, JSON.stringify([devices, preferences]));
    assert.equal(resolved.language + '-' + resolved.region, expected);
    assert.equal(resolveLocale(devices, preferences, PREVIEW).locale, expected, 'the default gate is the preview set since 23.1C2');
  }
  for (const [devices, preferences] of cases) assert.equal(resolveLocale(devices, preferences, SPANISH_ONLY).locale, 'es-AR', 'a Spanish-only gate makes every case es-AR');
  assert.equal(resolveLocale([{ languageTag: 'en-US', regionCode: 'US' }], { language: 'system', region: 'system' }, { languages: ['es', 'en'], regions: ['AR'] }).locale, 'en-AR',
    'each half has its own gate');
  assert.equal(resolveLocale([]).locale, DEFAULT_LOCALE);
});

test('stored preferences are validated on read; the 23.0 tag shape keeps only its language', () => {
  assert.equal(languagePreferenceFrom('en'), 'en');
  assert.equal(languagePreferenceFrom('system'), 'system');
  assert.equal(languagePreferenceFrom('en-US'), 'en', 'a 23.0-style full tag keeps its language; the region is its own preference now');
  assert.equal(languagePreferenceFrom('pt-BR'), 'system');
  assert.equal(languagePreferenceFrom('fr'), 'system', 'an unknown stored value follows the device');
  assert.equal(languagePreferenceFrom(null), 'system');
  assert.equal(languagePreferenceFrom(42), 'system');
  assert.equal(regionPreferenceFrom('US'), 'US');
  assert.equal(regionPreferenceFrom('us'), 'system', 'stored values are exact; only the writer produces them');
  assert.equal(regionPreferenceFrom('UY'), 'system');
  assert.equal(regionPreferenceFrom(undefined), 'system');
});

// The device reader, both scenarios. The failure it guards against: in a
// development build compiled before expo-localization was added, evaluating
// the package runs requireNativeModule('ExpoLocalization'), which throws, and
// Metro's dev runtime shows that throw even when the caller catches it. So the
// package may only be evaluated after the optional-module probe says yes.
function deps(registered: boolean, native: { languageTag: string; languageCode?: string | null; regionCode?: string | null }[] = [], intl: string | null = 'es-AR') {
  const calls = { probe: 0, load: 0, intl: 0 };
  return { calls, deps: {
    nativeRegistered: () => { calls.probe++; return registered; },
    load: () => { calls.load++; if (!registered) throw new Error("Cannot find native module 'ExpoLocalization'"); return { getLocales: () => native }; },
    intlLocale: () => { calls.intl++; return intl ?? undefined; },
  } };
}

test('module registered: expo-localization is loaded once, after the probe, and its ordered list is used', () => {
  const { calls, deps: d } = deps(true, [{ languageTag: 'en-US', languageCode: 'en', regionCode: 'US' }, { languageTag: 'es-AR', languageCode: 'es', regionCode: 'AR' }]);
  const read = readDeviceLocales(d);
  assert.equal(read.source, 'native');
  assert.equal(read.locales.map(locale => locale.languageTag).join(','), 'en-US,es-AR');
  assert.equal(read.locales[0].regionCode, 'US');
  assert.deepEqual(calls, { probe: 1, load: 1, intl: 0 }, 'Intl is not consulted when the native list is usable');
  assert.equal(deviceLocales(deps(true, [{ languageTag: 'es-AR' }]).deps).map(locale => locale.languageTag).join(','), 'es-AR');
  // A registered module that answers nothing usable still falls back to Intl.
  const empty = deps(true, [], 'en-US');
  assert.equal(readDeviceLocales(empty.deps).source, 'intl');
  assert.deepEqual(empty.calls, { probe: 1, load: 1, intl: 1 });
});

test('module absent (an older development build): the package is never evaluated, Intl answers silently, Spanish when nothing is usable', () => {
  const absent = deps(false, [], 'en-GB');
  const read = readDeviceLocales(absent.deps);
  assert.equal(absent.calls.load, 0, 'expo-localization is never loaded when the native module is not registered');
  assert.equal(read.source, 'intl');
  assert.equal(read.locales.map(locale => locale.languageTag).join(','), 'en-GB', 'the device language still arrives through Intl');
  const nothing = deps(false, [], null);
  const bare = readDeviceLocales(nothing.deps);
  assert.equal(nothing.calls.load, 0);
  assert.equal(bare.source, 'none');
  assert.equal(bare.locales.length, 0);
  assert.equal(resolveLocale(bare.locales).locale, 'es-AR', 'no module and no Intl: Spanish, Argentina');
});

test('a fault in a registered module is not disguised as a missing one', () => {
  const broken = { nativeRegistered: () => true, load: () => ({ getLocales: (): never => { throw new TypeError('getLocales is broken'); } }), intlLocale: () => 'es-AR' };
  assert.throws(() => readDeviceLocales(broken), /getLocales is broken/);
  const probeFault = { nativeRegistered: (): boolean => { throw new Error('probe fault'); }, load: () => ({ getLocales: () => [] }), intlLocale: () => 'es-AR' };
  assert.throws(() => readDeviceLocales(probeFault), /probe fault/);
});

test('the device\'s first language is read as its primary subtag, catalogue or not; nothing usable is null', () => {
  assert.equal(primaryLanguageOf([{ languageTag: 'es-AR', languageCode: 'es', regionCode: 'AR' }]), 'es');
  assert.equal(primaryLanguageOf([{ languageTag: 'EN_us' }]), 'en', 'case and separator of the tag do not matter');
  assert.equal(primaryLanguageOf([{ languageTag: 'pt-BR' }, { languageTag: 'es-AR' }]), 'pt', 'only the first language; one without a catalogue still counts');
  assert.equal(primaryLanguageOf([{ languageTag: 'zh-Hant-TW' }]), 'zh');
  assert.equal(primaryLanguageOf([{ languageTag: 'yue-Hant-HK' }]), 'yue', 'three-letter language subtags');
  assert.equal(primaryLanguageOf([{ languageTag: '', languageCode: 'fr' }]), 'fr', 'a bare language code when the tag is empty');
  assert.equal(primaryLanguageOf([{ languageTag: ' es-AR ' }]), 'es');
  assert.equal(primaryLanguageOf([]), null, 'nothing was read');
  for (const tag of ['', 'x', '419', 'e1-AR', 'español']) assert.equal(primaryLanguageOf([{ languageTag: tag }]), null, 'not a language subtag: ' + JSON.stringify(tag));
  assert.equal(primaryLanguageOf([{ languageTag: undefined as never, languageCode: null }]), null, 'a malformed native entry is not a language');
});

test('iOS\'s locale-change event: subscribed as a method call on the native emitter, only that event, removed once; anything else is a no-op', () => {
  assert.equal(LOCALE_CHANGED_EVENT, 'onLocaleSettingsChanged', 'the event expo-localization\'s module sends on NSCurrentLocaleDidChangeNotification');
  // An older binary (no module), Node, or a module object without an emitter: nothing to subscribe, nothing thrown.
  for (const module of [null, undefined, { getLocales: () => [] }, { addListener: 'not a function' }]) {
    let heard = 0;
    const unsubscribe = subscribeDeviceLocaleChanges(module, () => heard++);
    assert.equal(typeof unsubscribe, 'function');
    unsubscribe();
    unsubscribe();
    assert.equal(heard, 0);
  }
  // A class-based emitter, like Expo's native module object: its methods need `this`.
  class Emitter {
    listeners = new Map<string, Set<(...args: unknown[]) => void>>();
    subscribed: string[] = [];
    removed = 0;
    addListener(event: string, listener: (...args: unknown[]) => void) {
      this.subscribed.push(event);
      const set = this.listeners.get(event) ?? new Set();
      this.listeners.set(event, set.add(listener));
      return { remove: () => { this.removed++; set.delete(listener); } };
    }
    emit(event: string, ...args: unknown[]) { for (const listener of this.listeners.get(event) ?? []) listener(...args); }
  }
  const native = new Emitter();
  const calls: unknown[][] = [];
  const unsubscribe = subscribeDeviceLocaleChanges(native, (...args: unknown[]) => { calls.push(args); });
  assert.equal(native.subscribed.join(','), 'onLocaleSettingsChanged', 'only the locale event');
  native.emit('onCalendarSettingsChanged');
  assert.equal(calls.length, 0, 'another event of the same module is not a locale change');
  native.emit('onLocaleSettingsChanged', { payload: true });
  assert.equal(JSON.stringify(calls), '[[]]', 'heard once, with no payload passed on');
  unsubscribe();
  unsubscribe();
  assert.equal(native.removed, 1, 'unsubscribing twice removes the native subscription once');
  native.emit('onLocaleSettingsChanged');
  assert.equal(calls.length, 1, 'nothing is heard after unsubscribing');
});

test('the runtime wiring probes with requireOptionalNativeModule and only then requires expo-localization; nothing imports it statically', () => {
  const runtime = readFileSync(new URL('../src/i18n/device-runtime.ts', import.meta.url), 'utf8');
  assert.match(runtime, /import \{ requireOptionalNativeModule \} from 'expo';/, 'the official optional probe from the expo package');
  assert.match(runtime, /nativeRegistered: \(\) => requireOptionalNativeModule\('ExpoLocalization'\) != null/);
  assert.match(runtime, /load: \(\) => require\('expo-localization'\)/, 'a lazy require inside the loader, evaluated only when called');
  assert.equal(/^import [^\n]*'expo-localization'/m.test(runtime), false);
  assert.match(runtime, /subscribeDeviceLocaleChanges\(requireOptionalNativeModule\('ExpoLocalization'\), listener\)/,
    'the locale-change event comes from the probed module object, never from evaluating the package');
  const offenders: string[] = [];
  const walk = (dir: URL) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules') continue;
      const url = new URL(entry.name + (entry.isDirectory() ? '/' : ''), dir);
      if (entry.isDirectory()) walk(url);
      else if (/\.tsx?$/.test(entry.name) && /(from|require\()\s*'expo-localization'/.test(readFileSync(url, 'utf8')) && !url.pathname.endsWith('src/i18n/device-runtime.ts')) offenders.push(url.pathname);
    }
  };
  walk(new URL('../src/', import.meta.url));
  walk(new URL('../app/', import.meta.url));
  assert.equal(offenders.join(','), '', 'only the runtime adapter imports or requires the package');
  const pure = readFileSync(new URL('../src/i18n/device.ts', import.meta.url), 'utf8');
  assert.equal(/require\(|from 'expo'/.test(pure), false, 'the pure reader neither requires nor imports Expo');
  const provider = readFileSync(new URL('../src/i18n/provider.tsx', import.meta.url), 'utf8');
  assert.match(provider, /createLocaleStore\(\{ devices: readRuntimeDeviceLocales, store: defaultPreferenceStore,/, 'the app reads the device through the probed adapter');
});

function memoryStore() {
  const rows = new Map<string, string>();
  const store: PreferenceStore = { getItemSync: key => rows.get(key) ?? null, setItemSync: (key, value) => { rows.set(key, value); }, removeItemSync: key => rows.delete(key) };
  return { rows, store };
}

test('language and region are two keys in the key-value store, validated on read; a broken store means "follow the device"', () => {
  const { rows, store } = memoryStore();
  assert.deepEqual(readLocalePreferences(() => store), { language: 'system', region: 'system' });
  assert.equal(writeLanguagePreference('en', () => store), true);
  assert.equal(writeRegionPreference('US', () => store), true);
  assert.equal(rows.get(LANGUAGE_PREFERENCE_KEY), 'en');
  assert.equal(rows.get(REGION_PREFERENCE_KEY), 'US');
  assert.notEqual(LANGUAGE_PREFERENCE_KEY, REGION_PREFERENCE_KEY);
  assert.deepEqual(readLocalePreferences(() => store), { language: 'en', region: 'US' });
  assert.equal(writeLanguagePreference('system', () => store), true);
  assert.equal(rows.has(LANGUAGE_PREFERENCE_KEY), false, '"system" removes the entry');
  assert.equal(rows.get(REGION_PREFERENCE_KEY), 'US', 'the other preference is untouched');
  rows.set(LANGUAGE_PREFERENCE_KEY, 'klingon');
  rows.set(REGION_PREFERENCE_KEY, 'Narnia');
  assert.equal(readLanguagePreference(() => store), 'system', 'garbage in the store is not a language');
  assert.equal(readRegionPreference(() => store), 'system');
  rows.set(LANGUAGE_PREFERENCE_KEY, 'es-AR');
  assert.equal(readLanguagePreference(() => store), 'es', 'the 23.0 value shape still reads');
  const broken = () => { throw new Error('database locked'); };
  assert.deepEqual(readLocalePreferences(broken), { language: 'system', region: 'system' });
  assert.equal(writeLanguagePreference('es', broken), false, 'a failed write reports false instead of throwing');
  assert.equal(writeRegionPreference('AR', broken), false);
  const failingSet: PreferenceStore = { getItemSync: () => null, setItemSync: () => { throw new Error('disk full'); }, removeItemSync: () => { throw new Error('disk full'); } };
  assert.equal(writeLanguagePreference('es', () => failingSet), false);
  assert.equal(writeRegionPreference('system', () => failingSet), false, 'removing can fail too');
});

test('preferences are not ledger data: the preference module never touches the ledger, a backup or SQLite tables', () => {
  const source = readFileSync(new URL('../src/i18n/preference.ts', import.meta.url), 'utf8');
  assert.match(source, /require\('expo-sqlite\/kv-store'\)/, 'the separate key-value store bundled with expo-sqlite');
  assert.equal(/storage\/|backup|LedgerArchive|openDatabase|execAsync|runAsync/.test(source.replace(/\/\*[\s\S]*?\*\//g, '')), false, 'no ledger, backup or SQL access');
  for (const file of readdirSync(new URL('../src/storage/', import.meta.url))) {
    const text = readFileSync(new URL('../src/storage/' + file, import.meta.url), 'utf8');
    assert.equal(/finanzapp\.(language|region)|i18n\//.test(text), false, 'the ledger and its backups know nothing of the preferences: ' + file);
  }
});

test('dates are written from tables, identically on every device: Spanish keeps the ledger abbreviations, English uses US order', () => {
  assert.deepEqual(dateFromISO('2026-09-22'), { year: 2026, month: 9, day: 22, weekday: 2 });
  assert.equal(dateFromISO('2026-02-30'), null, 'an impossible date is not rolled into March');
  assert.equal(dateFromISO('22/09/2026'), null);
  assert.equal(formatDate('2026-09-22', 'day'), '22 sep');
  assert.equal(formatDate('2026-09-22', 'dayYear'), '22 sep 2026', 'the field abbreviation matches the rows ("sep", not the device\'s "sept")');
  assert.equal(formatDate('2026-09-22', 'long'), '22 de septiembre de 2026');
  assert.equal(formatDate('2026-09-22', 'weekdayLong'), 'martes, 22 de septiembre de 2026');
  assert.equal(formatDate('2026-09-22', 'month'), 'septiembre');
  assert.equal(formatDate('2026-09-22', 'monthYear'), 'septiembre de 2026');
  assert.equal(formatDate('2026-01-05', 'dayYear'), '5 ene 2026', 'no zero padding, as before');
  assert.equal(formatDate('2026-09-22', 'day', 'en-US'), 'Sep 22');
  assert.equal(formatDate('2026-09-22', 'dayYear', 'en-US'), 'Sep 22, 2026');
  assert.equal(formatDate('2026-09-22', 'long', 'en-US'), 'September 22, 2026');
  assert.equal(formatDate('2026-09-22', 'weekdayLong', 'en-US'), 'Tuesday, September 22, 2026');
  assert.equal(formatDate('2026-09-22', 'monthYear', 'en-US'), 'September 2026');
  assert.equal(formatDate('garbage', 'long'), 'garbage', 'a malformed date is shown as stored, never invented');
  assert.equal(formatMonth('2026-09'), 'septiembre de 2026');
  assert.equal(formatMonth('2026-09', 'en-US', 'month'), 'September');
  assert.equal(formatMonth('2026-13'), '2026-13');
  assert.equal(daysAgo('2026-09-20', '2026-09-22'), 2);
  assert.equal(daysAgo('2026-09-25', '2026-09-22'), -3);
  assert.equal(daysAgo('x', '2026-09-22'), null);
  assert.equal(relativeDayName('2026-09-22', '2026-09-22'), 'Hoy');
  assert.equal(relativeDayName('2026-09-21', '2026-09-22'), 'Ayer');
  assert.equal(relativeDayName('2026-09-20', '2026-09-22'), 'Anteayer');
  assert.equal(relativeDayName('2026-09-17', '2026-09-22'), 'jueves');
  assert.equal(relativeDayName('2026-09-15', '2026-09-22'), null, 'a week ago is a plain date');
  assert.equal(relativeDayName('2026-09-23', '2026-09-22'), null, 'the future has no relative name');
  assert.equal(relativeDayName('2026-09-22', '2026-09-22', 'en-US'), 'Today');
  assert.equal(relativeDayName('2026-09-21', '2026-09-22', 'en-US'), 'Yesterday');
  assert.equal(relativeDayName('2026-09-20', '2026-09-22', 'en-US'), 'Sunday', 'English has no "Anteayer"');
  assert.equal(formatDateTime('2026-09-22T14:03:05'), '22/9/2026, 14:03');
  assert.equal(formatDateTime('2026-09-22T09:03:05', 'en-US'), '9/22/2026, 9:03\u00A0AM');
  assert.equal(formatDateTime('2026-09-22T00:30:00', 'en-US'), '9/22/2026, 12:30\u00A0AM');
  assert.equal(formatDateTime('not a time'), 'not a time');
});

test('counts and percentages follow the locale; the ratio is display only and small shares never read as zero', () => {
  assert.equal(formatCount(1234567), '1.234.567');
  assert.equal(formatCount(1234567, 'en-US'), '1,234,567');
  assert.equal(formatCount(-12), '-12');
  assert.equal(formatPercent(0.3), '30\u00A0%');
  assert.equal(formatPercent(1), '100\u00A0%');
  assert.equal(formatPercent(0.1235), '12,4\u00A0%', 'half up on the decimal value, as the device formatter did');
  assert.equal(formatPercent(0.1225), '12,3\u00A0%');
  assert.equal(formatPercent(0.0004), '<0,1\u00A0%');
  assert.equal(formatPercent(12.345), '1.234,5\u00A0%', 'a ratio above one groups its thousands');
  assert.equal(formatPercent(0), '0\u00A0%');
  assert.equal(formatPercent(-0.5), '−50\u00A0%');
  assert.equal(formatPercent(Number.NaN), '—');
  assert.equal(formatPercent(0.3, 'en-US'), '30%');
  assert.equal(formatPercent(0.1235, 'en-US'), '12.4%');
  assert.equal(formatPercent(0.0004, 'en-US'), '<0.1%');
});

test('money presentation: Spanish output is the domain string, English only swaps separators; symbols, codes and spoken forms never split the number', () => {
  for (const minor of [0, 1, 99, 100, 123456, 100000000, -4599, 999999999999999]) {
    assert.equal(formatAmount(minor), formatMinorUnits(minor), 'es-AR is byte-identical to the ledger formatter: ' + minor);
  }
  assert.equal(formatAmount(123456789, 'en-US'), '1,234,567.89');
  assert.equal(formatAmount(-4599, 'en-US'), '-45.99');
  assert.equal(formatAmount(5, 'en-US'), '0.05');
  assert.equal(currencySymbol('ARS'), '$');
  assert.equal(currencySymbol('USD'), 'US$');
  assert.equal(currencySymbol('ARS', 'en-US'), 'AR$', 'in the United States a bare "$" would read as dollars');
  assert.equal(currencySymbol('USD', 'en-US'), 'US$');
  assert.equal(moneyText(123456, 'ARS'), '$\u00A01.234,56');
  assert.equal(moneyText(-123456, 'USD'), '−US$\u00A01.234,56');
  assert.equal(moneyText(-123456, 'USD', 'es-AR', true), 'US$\u00A01.234,56', 'absolute for callers that word the sign');
  assert.equal(moneyText(123456, 'USD', 'en-US'), 'US$\u00A01,234.56');
  assert.equal(codedAmount(123456, 'ARS'), 'ARS\u00A01.234,56');
  assert.equal(codedAmount(-100, 'USD', 'en-US'), 'USD\u00A0-1.00');
  assert.equal(withCurrencyCode('Deuda registrada', 'ARS'), 'Deuda registrada\u00A0·\u00A0ARS');
  assert.equal(spokenMoney(123456, 'ARS'), '1234,56 pesos', 'VoiceOver gets the digits ungrouped: a separator before three digits is one a voice can misread');
  assert.equal(spokenMoney(-100, 'USD'), 'Menos 1,00 dólares');
  assert.equal(spokenMoney(-100, 'USD', 'en-US'), 'Minus 1.00 dollars');
  assert.equal(currencyName('ARS'), 'Pesos argentinos');
  assert.equal(currencyName('USD', 'en-US'), 'US dollars');
});

test('words follow the language, conventions follow the region: English with Argentine formats and Spanish with US formats', () => {
  // English words, Argentine numbers, day-first numeric dates and a 24-hour clock.
  assert.equal(formatDate('2026-09-22', 'dayYear', 'en-AR'), 'Sep 22, 2026');
  assert.equal(relativeDayName('2026-09-21', '2026-09-22', 'en-AR'), 'Yesterday');
  assert.equal(formatAmount(123456789, 'en-AR'), '1.234.567,89', 'identical to the ledger formatter');
  assert.equal(moneyText(123456, 'ARS', 'en-AR'), '$\u00A01.234,56', 'in Argentina "$" is the peso whatever the language');
  assert.equal(currencySymbol('USD', 'en-AR'), 'US$');
  assert.equal(formatDateTime('2026-09-22T14:03:05', 'en-AR'), '22/9/2026, 14:03');
  assert.equal(formatNumericDate('2026-09-22', 'en-AR'), '22/9/2026');
  assert.equal(formatCount(1234567, 'en-AR'), '1.234.567');
  assert.equal(formatPercent(0.1235, 'en-AR'), '12,4%', 'the decimal comes from the region, the spacing from the language');
  assert.equal(spokenMoney(-100, 'USD', 'en-AR'), 'Minus 1.00 dollars', 'VoiceOver reads English numbers to an English voice; the screen keeps 1,00');
  assert.equal(currencyName('ARS', 'en-AR'), 'Argentine pesos');
  // Spanish words, US numbers, month-first numeric dates and a 12-hour clock.
  assert.equal(formatDate('2026-09-22', 'long', 'es-US'), '22 de septiembre de 2026');
  assert.equal(relativeDayName('2026-09-20', '2026-09-22', 'es-US'), 'Anteayer');
  assert.equal(formatAmount(123456789, 'es-US'), '1,234,567.89');
  assert.equal(moneyText(123456, 'ARS', 'es-US'), 'AR$\u00A01,234.56', 'in the United States a peso is never a bare "$"');
  assert.equal(moneyText(-123456, 'USD', 'es-US'), '−US$\u00A01,234.56');
  assert.equal(formatDateTime('2026-09-22T14:03:05', 'es-US'), '9/22/2026, 2:03\u00A0p.\u00A0m.');
  assert.equal(formatDateTime('2026-09-22T09:03:05', 'es-US'), '9/22/2026, 9:03\u00A0a.\u00A0m.');
  assert.equal(formatNumericDate('2026-09-22', 'es-US'), '9/22/2026');
  assert.equal(formatPercent(0.1235, 'es-US'), '12.4\u00A0%');
  assert.equal(spokenMoney(123456, 'ARS', 'es-US'), '1234,56 pesos', 'the Spanish voice gets a Spanish decimal comma and no grouping; the screen shows 1,234.56');
  assert.equal(currencyName('USD', 'es-US'), 'Dólares estadounidenses');
  assert.equal(formatNumericDate('garbage', 'es-US'), 'garbage');
  // The default is byte-identical to the ledger for every amount.
  for (const minor of [0, 7, 123456, -4599, 999999999999999]) {
    assert.equal(formatAmount(minor, DEFAULT_LOCALE), formatMinorUnits(minor));
    assert.equal(formatAmount(minor, 'en-AR'), formatMinorUnits(minor));
  }
});

test('both catalogues carry the same keys with the same placeholders, and lookups interpolate, pluralise and fall back', () => {
  const keys = messageKeys(es);
  assert.deepEqual(messageKeys(en).join('\n'), keys.join('\n'), 'the English catalogue matches the Spanish one key for key');
  assert.ok(keys.length >= 20);
  const placeholders = (text: string) => [...text.matchAll(/\{([a-zA-Z0-9_]+)\}/g)].map(match => match[1]).sort().join(',');
  for (const key of keys) {
    const a = translate('es', key as never, { count: 2 }), b = translate('en', key as never, { count: 2 });
    assert.notEqual(a, key, 'every key resolves in Spanish: ' + key);
    assert.notEqual(b, key, 'every key resolves in English: ' + key);
  }
  const walk = (a: object, b: object, path = '') => {
    for (const [key, value] of Object.entries(a)) {
      const other = (b as Record<string, unknown>)[key];
      if (typeof value === 'string') assert.equal(placeholders(other as string), placeholders(value), 'same placeholders at ' + path + key);
      else walk(value as object, other as object, path + key + '.');
    }
  };
  walk(es, en);
  assert.equal(translate('es', 'common.cancel'), 'Cancelar');
  assert.equal(translate('en', 'common.cancel'), 'Cancel');
  assert.equal(translate('es', 'common.moreInfoAbout', { title: 'saldo inicial' }), 'Más información sobre saldo inicial');
  assert.equal(translate('es', 'count.movements', { count: 1 }), '1 movimiento');
  assert.equal(translate('es', 'count.movements', { count: 3 }), '3 movimientos');
  assert.equal(translate('en', 'count.expenses', { count: 0 }), '0 expenses');
  assert.equal(translate('es', 'amount.accessibility', { label: 'Gasto', currency: translate('es', 'amount.inPesos') }), 'Gasto en pesos argentinos');
  assert.equal(interpolate('Hola {name}, {missing}', { name: 'Ana' }), 'Hola Ana, {missing}', 'a missing parameter stays visible rather than blank');
  assert.equal(translate('es', 'no.such.key' as never), 'no.such.key', 'an unknown key shows itself, never an empty label');
  const t = translator('en');
  assert.equal(t('selection.chooseCurrency'), 'Choose currency');
  assert.equal(catalogue('en').common.done, 'Done');
});

test('a bound locale gives components one object of translator and formatters', () => {
  const es = bindLocale('es-AR');
  assert.equal(es.locale, 'es-AR');
  assert.equal(es.localeSource, 'none');
  assert.equal(bindLocale('es-AR', 'native').localeSource, 'native');
  assert.equal(es.t('common.done'), 'Listo');
  assert.equal(es.formatDate('2026-09-22', 'dayYear'), '22 sep 2026');
  assert.equal(es.formatMonth('2026-09'), 'septiembre de 2026');
  assert.equal(es.formatPercent(0.5), '50\u00A0%');
  assert.equal(es.moneyText(150000, 'USD'), 'US$\u00A01.500,00');
  assert.equal(es.spokenMoney(150000, 'USD'), '1500,00 dólares');
  assert.equal(es.currencyName('USD'), 'Dólares estadounidenses');
  assert.equal(es.language, 'es');
  assert.equal(es.region, 'AR');
  assert.equal(es.formatCount(1234), '1.234');
  const mixed = bindLocale('en-AR');
  assert.equal(mixed.t('common.done'), 'Done', 'the catalogue follows the language only');
  assert.equal(mixed.moneyText(150000, 'ARS'), '$\u00A01.500,00', 'amounts follow the region only');
  const en = bindLocale('en-US');
  assert.equal(en.t('common.done'), 'Done');
  assert.equal(en.formatDate('2026-09-22', 'weekdayLong'), 'Tuesday, September 22, 2026');
  assert.equal(en.moneyText(150000, 'ARS'), 'AR$\u00A01,500.00');
  assert.equal(en.formatDayMonth('2026-09-05'), '9/5');
  assert.equal(es.formatDayMonth('2026-09-05'), '5/09');
  assert.equal(en.relativeDate('2026-09-21', '2026-09-22', true), 'yesterday', 'the inline form reaches components');
  assert.equal(es.relativeDate('2026-09-21', '2026-09-22'), 'Ayer', 'and the row form stays the default');
  assert.deepEqual([es.t('common.ok'), en.t('common.ok')], ['OK', 'OK'], 'the alert button is written by the app, in the interface language');
});

test('VoiceOver\'s language is named only when the interface language differs from the device\'s first language', () => {
  const cases: [AppLocale, string | null, string | undefined][] = [
    ['es-AR', 'es', undefined], ['es-US', 'es', undefined], ['en-US', 'en', undefined], ['en-AR', 'en', undefined],
    ['en-AR', 'es', 'en'], ['en-US', 'es', 'en'], ['es-AR', 'en', 'es'], ['es-US', 'en', 'es'],
    ['es-AR', 'pt', 'es'], ['es-US', 'fr', 'es'], ['en-US', 'pt', 'en'],
    ['es-AR', null, undefined], ['en-US', null, undefined],
  ];
  for (const [locale, device, expected] of cases) {
    const i18n = bindLocale(locale, 'native', device);
    assert.equal(i18n.speechLanguage, expected, locale + ' on a device in ' + device);
  }
  assert.equal(bindLocale('en-US').speechLanguage, undefined, 'nothing read about the device: VoiceOver keeps the voice chosen in iOS Settings');
  assert.equal(bindLocale('en-US', 'intl').speechLanguage, undefined);
});

test('Producto 23.1C1: every format in the four language × region combinations (spoken forms and the date wheel as of 23.1C2)', () => {
  type Row = { amount: string; big: string; negative: string; ars: string; usd: string; coded: string; spoken: string; spokenCoded: string;
    percent: string; small: string; count: string; numeric: string; dayMonth: string; time: string; long: string; picker: string; decimal: string; group: string };
  const rows: Record<AppLocale, Row> = {
    'es-AR': { amount: '1.234,56', big: '9.999.999.999.999,99', negative: '-45,99', ars: '$\u00A01.234,56', usd: '−US$\u00A01.234,56', coded: 'ARS\u00A01.234,56',
      spoken: '1234,56 pesos', spokenCoded: '1234,56 ARS', percent: '12,4\u00A0%', small: '<0,1\u00A0%', count: '1.234.567', numeric: '22/9/2026', dayMonth: '22/09',
      time: '22/9/2026, 14:03', long: '22 de septiembre de 2026', picker: 'es_AR', decimal: ',', group: '.' },
    'en-AR': { amount: '1.234,56', big: '9.999.999.999.999,99', negative: '-45,99', ars: '$\u00A01.234,56', usd: '−US$\u00A01.234,56', coded: 'ARS\u00A01.234,56',
      spoken: '1234.56 pesos', spokenCoded: '1234.56 ARS', percent: '12,4%', small: '<0,1%', count: '1.234.567', numeric: '22/9/2026', dayMonth: '22/09',
      time: '22/9/2026, 14:03', long: 'September 22, 2026', picker: 'en_US', decimal: ',', group: '.' },
    'es-US': { amount: '1,234.56', big: '9,999,999,999,999.99', negative: '-45.99', ars: 'AR$\u00A01,234.56', usd: '−US$\u00A01,234.56', coded: 'ARS\u00A01,234.56',
      spoken: '1234,56 pesos', spokenCoded: '1234,56 ARS', percent: '12.4\u00A0%', small: '<0.1\u00A0%', count: '1,234,567', numeric: '9/22/2026', dayMonth: '9/22',
      time: '9/22/2026, 2:03\u00A0p.\u00A0m.', long: '22 de septiembre de 2026', picker: 'es_AR', decimal: '.', group: ',' },
    'en-US': { amount: '1,234.56', big: '9,999,999,999,999.99', negative: '-45.99', ars: 'AR$\u00A01,234.56', usd: '−US$\u00A01,234.56', coded: 'ARS\u00A01,234.56',
      spoken: '1234.56 pesos', spokenCoded: '1234.56 ARS', percent: '12.4%', small: '<0.1%', count: '1,234,567', numeric: '9/22/2026', dayMonth: '9/22',
      time: '9/22/2026, 2:03\u00A0PM', long: 'September 22, 2026', picker: 'en_US', decimal: '.', group: ',' },
  };
  for (const [locale, row] of Object.entries(rows) as [AppLocale, Row][]) {
    const i18n = bindLocale(locale);
    const got: Row = {
      amount: i18n.formatAmount(123456), big: i18n.formatAmount(999999999999999), negative: i18n.formatAmount(-4599),
      ars: i18n.moneyText(123456, 'ARS'), usd: i18n.moneyText(-123456, 'USD'), coded: i18n.codedAmount(123456, 'ARS'),
      spoken: i18n.spokenMoney(123456, 'ARS'), spokenCoded: i18n.spokenAmount(123456, 'ARS'), percent: i18n.formatPercent(0.1235), small: i18n.formatPercent(0.0004),
      count: i18n.formatCount(1234567), numeric: i18n.formatNumericDate('2026-09-22'), dayMonth: i18n.formatDayMonth('2026-09-22'), time: i18n.formatDateTime('2026-09-22T14:03:05'),
      long: i18n.formatDate('2026-09-22', 'long'), picker: i18n.pickerLocale, decimal: i18n.amountFormat.decimal, group: i18n.amountFormat.group,
    };
    assert.deepEqual(got, row, locale);
    // The amount itself never changes: only its writing. No floating point, no rounding, the sign and the cents kept.
    assert.equal(i18n.formatAmount(123456).replace(/[.,]/g, ''), '123456');
    assert.equal(i18n.spokenNumber(-5), locale.startsWith('en') ? '-0.05' : '-0,05');
    assert.equal(i18n.moneyText(5, 'USD', false, true), '+US$\u00A0' + (locale.endsWith('US') ? '0.05' : '0,05'), 'income sign');
    assert.equal(i18n.moneyText(-5, 'ARS', true), (locale.endsWith('US') ? 'AR$' : '$') + '\u00A0' + (locale.endsWith('US') ? '0.05' : '0,05'), 'absolute');
    assert.equal(i18n.spokenPercent(0.1235), locale.startsWith('en') ? '12.4%' : '12,4\u00A0%', 'a spoken percentage follows the language');
    assert.equal(i18n.moneyText(0, 'ARS').endsWith('0' + i18n.amountFormat.decimal + '00'), true);
  }
  assert.equal(speechLocale('en-AR'), 'en-US');
  assert.equal(speechLocale('es-US'), 'es-AR');
  assert.equal(spokenNumber(123456, 'es-US'), '1234,56');
  assert.equal(spokenAmount(-100, 'USD', 'en-AR'), '-1.00 USD');
  assert.equal(spokenPercent(0.5, 'es-US'), '50\u00A0%');
  assert.equal(spokenPercent(12.345, 'es-US'), '1234,5\u00A0%', 'a spoken percentage above a thousand is not grouped either');
  assert.equal(spokenPercent(12.345, 'en-AR'), '1234.5%');
  // The date wheel takes the language with its home region: the worded wheel reads like the row it opens from, never a mixed pair.
  assert.deepEqual(LOCALES.map(locale => [locale, pickerLocale(locale)]), [['es-AR', 'es_AR'], ['en-AR', 'en_US'], ['es-US', 'es_AR'], ['en-US', 'en_US']]);
  assert.deepEqual([...new Set(LOCALES.map(locale => pickerLocale(locale)))].sort(), ['en_US', 'es_AR'], 'iOS is only ever given es_AR or en_US');
  assert.equal(pickerLocale(), 'es_AR');
  // The currency of an account is never decided by the language or the region: the same amount in both currencies, four ways.
  for (const locale of ['es-AR', 'en-AR', 'es-US', 'en-US'] as AppLocale[]) {
    assert.ok(moneyText(100, 'ARS', locale) !== moneyText(100, 'USD', locale), locale + ': pesos and dollars never look alike');
    assert.match(moneyText(100, 'USD', locale), /^US\$/, 'the dollar keeps its prefix everywhere');
  }
});

test('money reaches the screen only through the central formatters; 23.1C2 releases English and the US region and keeps the gate for the next language', () => {
  // Screens and components never format money themselves: no domain formatter, no hand-written currency sign.
  const offenders: string[] = [];
  const walk = (dir: URL) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const url = new URL(entry.name + (entry.isDirectory() ? '/' : ''), dir);
      if (entry.isDirectory()) { walk(url); continue; }
      if (!/\.tsx?$/.test(entry.name) || url.pathname.endsWith('src/ui/money-input.ts')) continue;
      const source = readFileSync(url, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      if (/\bformatMinorUnits\b/.test(source)) offenders.push(entry.name + ': formatMinorUnits');
      // 24B1: the machine form, the digit splitter, the web float helpers and the device's names never reach a screen either.
      if (/\b(minorToMajorString|splitMinor|fmtNum|parseMoneyInput)\b|Intl\.DisplayNames/.test(source)) offenders.push(entry.name + ': a domain amount helper or device name lookup');
      // A glyph-width table key ('$': 0.62) is not a sign shown to anyone.
      if (/['"`](?:US|AR)?\$ ['"`]|['"`](?:US|AR)?\$['"`](?!\s*:)/.test(source)) offenders.push(entry.name + ': a hand-written currency sign');
      if (/toLocaleString|Intl\.NumberFormat|toFixed\(/.test(source)) offenders.push(entry.name + ': a device number formatter');
    }
  };
  walk(new URL('../app/', import.meta.url));
  walk(new URL('../src/ui/', import.meta.url));
  assert.deepEqual(offenders, [], 'visible amounts go through moneyText/formatAmount, VoiceOver through spoken*, drafts through money-input');
  // 23.1C2 opens the gate (the native language list is app-config's to check, tests/app-config.node.ts).
  assert.deepEqual([...RELEASED_LANGUAGES], ['es', 'en']);
  assert.deepEqual([...RELEASED_REGIONS], ['AR', 'US']);
  // The preview flag stays for the next catalogue: only a development bundle started with it widens the gate,
  // and since everything this build carries is released, it widens nothing today.
  assert.deepEqual(releasedForBuild('1', true), { languages: ['es', 'en'], regions: ['AR', 'US'] });
  assert.deepEqual(PREVIEW, RELEASED, 'a tripwire for the next language: once a catalogue is held back, the preview is wider than the release');
  assert.equal(releasedForBuild('1', false), RELEASED, 'a release bundle ignores the flag');
  assert.equal(releasedForBuild(undefined, true), RELEASED, 'a normal development bundle keeps the gate');
  assert.equal(releasedForBuild('true', true), RELEASED, 'only the documented value opens it');
  const provider = readFileSync(new URL('../src/i18n/provider.tsx', import.meta.url), 'utf8');
  assert.match(provider, /releasedForBuild\(process\.env\.EXPO_PUBLIC_LOCALE_PREVIEW, typeof __DEV__ !== 'undefined' && __DEV__\)/, 'read by its literal name so Expo inlines it');
});

// ---- Producto 23.1C2 ---------------------------------------------------------

/** "YYYY-MM-DD" `days` after `iso` (negative for before), by the calendar, not by a zone. */
function shiftISO(iso: string, days: number): string {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

test('a day of the period without its year is ordered by the region: 5/09 in Argentina, 9/5 in the United States', () => {
  for (const locale of LOCALES) {
    const us = regionOf(locale) === 'US';
    assert.equal(formatDayMonth('2026-09-05', locale), us ? '9/5' : '5/09', locale);
    assert.equal(formatDayMonth('2026-12-25', locale), us ? '12/25' : '25/12', locale);
    assert.equal(formatDayMonth('2026-01-31', locale), us ? '1/31' : '31/01', locale);
    for (const malformed of ['garbage', '2026-02-30', '2026-9-5', '05/09/2026', '']) assert.equal(formatDayMonth(malformed, locale), malformed, 'shown as stored, never invented: ' + malformed);
    // Every day of a year agrees with the numeric date of the same region; only Argentina pads the month, as the domain's reports do.
    for (let day = 0; day < 365; day++) {
      const iso = shiftISO('2026-01-01', day), numeric = formatNumericDate(iso, locale), short = formatDayMonth(iso, locale);
      if (us) assert.equal(short + '/2026', numeric, iso);
      else assert.equal(short.replace(/\/0(\d)$/, '/$1') + '/2026', numeric, iso);
    }
  }
  assert.equal(formatDayMonth('2026-09-05'), '5/09', 'the default locale is Argentine');
  assert.equal(formatDayMonth(undefined as never), '');
});

test('relativeDate inline: hoy, ayer, anteayer, today, yesterday in lower case inside a sentence; the row form is unchanged byte for byte', () => {
  const today = '2026-09-22';
  assert.deepEqual(LOCALES.map(locale => [0, 1, 2].map(days => relativeDate(shiftISO(today, -days), today, locale, true)).join(',')),
    ['hoy,ayer,anteayer', 'today,yesterday,Sep 20', 'hoy,ayer,anteayer', 'today,yesterday,Sep 20'], 'English has no "the day before yesterday": a date, as in a row');
  assert.deepEqual(LOCALES.map(locale => [0, 1, 2].map(days => relativeDate(shiftISO(today, -days), today, locale)).join(',')),
    ['Hoy,Ayer,Anteayer', 'Today,Yesterday,Sep 20', 'Hoy,Ayer,Anteayer', 'Today,Yesterday,Sep 20']);
  assert.equal(relativeDate('2026-09-15', today, 'es-AR', true), '15 sep', 'a short date is the same inline');
  assert.equal(relativeDate('2025-12-31', today, 'en-US', true), 'Dec 31, 2025', 'an English date inline still starts with its month');
  assert.equal(relativeDate('2026-09-23', today, 'es-AR', true), '23 sep', 'the future is never relative, inline either');
  assert.equal(relativeDate('nope', today, 'en-AR', true), 'nope');
  const names = new Set(['Hoy', 'Ayer', 'Anteayer', 'Today', 'Yesterday']);
  const now = new Date(today + 'T12:00:00');
  for (const locale of LOCALES) for (let days = -30; days <= 420; days++) {
    const iso = shiftISO(today, -days), row = relativeDate(iso, today, locale);
    assert.equal(relativeDate(iso, today, locale, false), row, 'inline=false is the row form: ' + iso);
    assert.equal(relativeDate(iso, today, locale, true), names.has(row) ? row.toLowerCase() : row, locale + ' ' + iso);
    if (languageOf(locale) === 'es') assert.equal(row, labelFromISO(iso, now), 'the Spanish row form is still the domain\'s label: ' + iso);
  }
});

test('VoiceOver numbers are never grouped in any locale and keep the exact amount, while the screen keeps its grouping', () => {
  const grouped = /[.,]\d{3}(?!\d)/;
  const amounts = [-999999999999999, -100000, -4599, -1, 0, 5, 99, 100, 99999, 100000, 123456, 1e8, 999999999999999];
  for (let minor = -2000000; minor <= 2000000; minor += 9973) amounts.push(minor);
  for (let minor = 1; minor < 1e15; minor = minor * 7 + 3) amounts.push(minor, -minor);
  for (const locale of LOCALES) {
    const decimal = languageOf(locale) === 'en' ? '.' : ',';
    const i18n = bindLocale(locale);
    for (const minor of amounts) {
      const number = spokenNumber(minor, locale);
      const spoken = [number, spokenAmount(minor, 'ARS', locale), spokenMoney(minor, 'ARS', locale), spokenMoney(minor, 'USD', locale),
        i18n.spokenNumber(minor), i18n.spokenAmount(minor, 'USD'), i18n.spokenMoney(minor, 'ARS')];
      for (const text of spoken) assert.doesNotMatch(text, grouped, locale + ': ' + text);
      assert.match(number, decimal === '.' ? /^-?\d+\.\d{2}$/ : /^-?\d+,\d{2}$/, 'the language\'s decimal mark, before exactly two digits: ' + number);
      assert.equal(BigInt(number.replace(decimal, '')), BigInt(minor), 'the same amount, digit for digit: ' + number);
      const visible = formatAmount(minor, locale);
      assert.equal(grouped.test(visible), Math.abs(minor) >= 100000, 'the screen groups thousands: ' + visible);
      assert.equal(grouped.test(moneyText(minor, 'USD', locale)), Math.abs(minor) >= 100000);
      assert.equal(visible.replace(/\D/g, ''), number.replace(/\D/g, ''), 'screen and voice carry the same digits');
    }
    for (let tenths = 0; tenths <= 2000000; tenths += 997) {
      const fraction = tenths / 1000;
      assert.doesNotMatch(spokenPercent(fraction, locale), grouped, locale + ': ' + spokenPercent(fraction, locale));
      assert.doesNotMatch(spokenPercent(-fraction, locale), grouped);
      assert.equal(grouped.test(formatPercent(fraction, locale)), fraction * 100 >= 1000, 'the screen groups a large percentage: ' + formatPercent(fraction, locale));
    }
  }
});
