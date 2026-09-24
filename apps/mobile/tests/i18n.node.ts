import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatMinorUnits } from '@finanzapp/domain';
import { readdirSync, readFileSync } from 'node:fs';
import { deviceLocales, readDeviceLocales } from '../src/i18n/device.ts';
import { codedAmount, currencyName, currencySymbol, dateFromISO, daysAgo, formatAmount, formatCount, formatDate, formatDateTime, formatMonth, formatNumericDate, formatPercent,
  moneyText, relativeDayName, spokenMoney, withCurrencyCode } from '../src/i18n/format.ts';
import { DEFAULT_LOCALE, LANGUAGES, REGIONS, RELEASED_LANGUAGES, RELEASED_REGIONS, SUPPORTED_LANGUAGES, SUPPORTED_REGIONS, composeLocale, languageForTag, languageOf,
  languagePreferenceFrom, regionForCode, regionForTag, regionOf, regionPreferenceFrom, resolveLanguage, resolveLocale, resolveRegion, type AppLocale } from '../src/i18n/locale.ts';
import { catalogue, interpolate, messageKeys, translate, translator } from '../src/i18n/messages.ts';
import { es } from '../src/i18n/messages/es/index.ts';
import { en } from '../src/i18n/messages/en/index.ts';
import { LANGUAGE_PREFERENCE_KEY, REGION_PREFERENCE_KEY, readLanguagePreference, readLocalePreferences, readRegionPreference, writeLanguagePreference, writeRegionPreference,
  type PreferenceStore } from '../src/i18n/preference.ts';
import { bindLocale } from '../src/i18n/bind.ts';

// Producto 23.0: the localization foundation. Language, region, an account's
// currency and the stored amount are four separate things; translating a
// label never touches SQLite. English exists as a catalogue but is not
// released until every screen has one.

const ALL = { languages: ['es', 'en'], regions: ['AR', 'US'] } as const;

test('language and region are two registries; a locale is only their composition, and the four combinations exist', () => {
  assert.deepEqual(SUPPORTED_LANGUAGES, ['es', 'en']);
  assert.deepEqual(SUPPORTED_REGIONS, ['AR', 'US']);
  assert.equal(LANGUAGES.es.name, 'Español', 'a language is listed by its own name');
  assert.equal(LANGUAGES.en.name, 'English');
  assert.deepEqual([...RELEASED_LANGUAGES], ['es'], 'English is not offered until 23.1B translates every screen and 23.1C releases it');
  assert.deepEqual([...RELEASED_REGIONS], ['AR'], 'the US region waits for 23.1C, when the amount field types US separators');
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

test('language resolution: a released preference wins, then the first released device language, then Spanish; English cannot surface before its release', () => {
  const english = [{ languageTag: 'en-US', languageCode: 'en', regionCode: 'US' }];
  assert.equal(resolveLanguage(english), 'es', 'today an English iPhone still reads Spanish rather than half an app');
  assert.equal(resolveLanguage(english, 'en'), 'es', 'a stored English preference is ignored while English is unreleased');
  assert.equal(resolveLanguage([], 'system'), 'es');
  assert.equal(resolveLanguage(english, 'system', ALL.languages), 'en', 'once released, the device language decides');
  assert.equal(resolveLanguage([{ languageTag: 'es-AR' }, { languageTag: 'en-US' }], 'system', ALL.languages), 'es', 'the first preferred language wins');
  assert.equal(resolveLanguage([{ languageTag: 'pt-BR' }, { languageTag: 'en-GB' }], 'system', ALL.languages), 'en', 'an unsupported first language falls through to the next');
  assert.equal(resolveLanguage([{ languageTag: 'pt-BR' }, { languageTag: 'fr-FR' }], 'system', ALL.languages), 'es', 'no supported device language: Spanish');
  assert.equal(resolveLanguage(english, 'es', ALL.languages), 'es', 'an explicit preference beats the device');
  assert.equal(resolveLanguage([{ languageTag: 'es-AR' }], 'en', ALL.languages), 'en');
  assert.equal(resolveLanguage([{ languageTag: '', languageCode: 'en' }], 'system', ALL.languages), 'en', 'a bare language code still counts');
});

test('region resolution: a released preference wins, then the device region setting, then Argentina; never the region of a second language', () => {
  const usIPhone = [{ languageTag: 'es-AR', languageCode: 'es', regionCode: 'US' }];
  assert.equal(resolveRegion(usIPhone), 'AR', 'while the US region is unreleased, Argentine conventions everywhere');
  assert.equal(resolveRegion(usIPhone, 'US'), 'AR', 'a stored US preference is ignored while unreleased');
  assert.equal(resolveRegion(usIPhone, 'system', ALL.regions), 'US', 'the Region setting, not the language tag, decides');
  assert.equal(resolveRegion([{ languageTag: 'en-US', regionCode: 'AR' }], 'system', ALL.regions), 'AR', 'English language, Argentine region');
  assert.equal(resolveRegion([{ languageTag: 'en-US' }], 'system', ALL.regions), 'US', 'Intl only: the tag carries the region');
  assert.equal(resolveRegion([{ languageTag: 'es-UY', regionCode: 'UY' }, { languageTag: 'en-US', regionCode: 'US' }], 'system', ALL.regions), 'AR',
    'an unsupported device region reads the default, not the region of the next language');
  assert.equal(resolveRegion([], 'system', ALL.regions), 'AR');
  assert.equal(resolveRegion(usIPhone, 'AR', ALL.regions), 'AR', 'an explicit region beats the device');
  assert.equal(resolveRegion([{ languageTag: 'es-AR', regionCode: 'AR' }], 'US', ALL.regions), 'US');
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
    const resolved = resolveLocale(devices, preferences, ALL);
    assert.equal(resolved.locale, expected, JSON.stringify([devices, preferences]));
    assert.equal(resolved.language + '-' + resolved.region, expected);
  }
  for (const [devices, preferences] of cases) assert.equal(resolveLocale(devices, preferences).locale, 'es-AR', 'with the release gate closed every case is es-AR');
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

test('the runtime wiring probes with requireOptionalNativeModule and only then requires expo-localization; nothing imports it statically', () => {
  const runtime = readFileSync(new URL('../src/i18n/device-runtime.ts', import.meta.url), 'utf8');
  assert.match(runtime, /import \{ requireOptionalNativeModule \} from 'expo';/, 'the official optional probe from the expo package');
  assert.match(runtime, /nativeRegistered: \(\) => requireOptionalNativeModule\('ExpoLocalization'\) != null/);
  assert.match(runtime, /load: \(\) => require\('expo-localization'\)/, 'a lazy require inside the loader, evaluated only when called');
  assert.equal(/^import [^\n]*'expo-localization'/m.test(runtime), false);
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
  assert.match(provider, /createLocaleStore\(\{ devices: readRuntimeDeviceLocales, store: defaultPreferenceStore \}\)/, 'the app reads the device through the probed adapter');
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
  assert.equal(spokenMoney(123456, 'ARS'), '1.234,56 pesos');
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
  assert.equal(spokenMoney(-100, 'USD', 'en-AR'), 'Minus 1,00 dollars');
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
  assert.equal(spokenMoney(123456, 'ARS', 'es-US'), '1,234.56 pesos');
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
  assert.equal(es.spokenMoney(150000, 'USD'), '1.500,00 dólares');
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
});
