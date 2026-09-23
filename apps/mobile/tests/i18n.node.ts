import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatMinorUnits } from '@finanzapp/domain';
import { deviceLocales } from '../src/i18n/device.ts';
import { codedAmount, currencyName, currencySymbol, dateFromISO, daysAgo, formatAmount, formatCount, formatDate, formatDateTime, formatMonth, formatPercent,
  moneyText, relativeDayName, spokenMoney, withCurrencyCode } from '../src/i18n/format.ts';
import { DEFAULT_LOCALE, RELEASED_LOCALES, SUPPORTED_LOCALES, languagePreferenceFrom, localeForTag, resolveLocale } from '../src/i18n/locale.ts';
import { catalogue, interpolate, messageKeys, translate, translator } from '../src/i18n/messages.ts';
import { es } from '../src/i18n/messages/es-AR.ts';
import { en } from '../src/i18n/messages/en-US.ts';
import { LANGUAGE_PREFERENCE_KEY, readLanguagePreference, writeLanguagePreference, type PreferenceStore } from '../src/i18n/preference.ts';
import { bindLocale, startupLocale } from '../src/i18n/bind.ts';

// Producto 23.0: the localization foundation. Language, region, an account's
// currency and the stored amount are four separate things; translating a
// label never touches SQLite. English exists as a catalogue but is not
// released until every screen has one.

test('a device language maps to a supported locale by language only, and unknown languages map to nothing', () => {
  assert.equal(localeForTag('es-AR'), 'es-AR');
  assert.equal(localeForTag('es-MX'), 'es-AR', 'every Spanish variety reads the Argentine catalogue for now');
  assert.equal(localeForTag('es'), 'es-AR');
  assert.equal(localeForTag('en-GB'), 'en-US');
  assert.equal(localeForTag('EN_us'), 'en-US');
  assert.equal(localeForTag('pt-BR'), null);
  assert.equal(localeForTag(''), null);
  assert.equal(localeForTag(undefined), null);
  assert.deepEqual([...SUPPORTED_LOCALES], ['es-AR', 'en-US']);
  assert.deepEqual([...RELEASED_LOCALES], ['es-AR'], 'English is not shown until Producto 23.1 completes the translation');
});

test('resolution: a released preference wins, then the first released device language, then Spanish; English cannot surface before its release', () => {
  const english = [{ languageTag: 'en-US', languageCode: 'en', regionCode: 'US' }];
  const spanishFirst = [{ languageTag: 'es-AR' }, { languageTag: 'en-US' }];
  const portugueseThenEnglish = [{ languageTag: 'pt-BR' }, { languageTag: 'en-GB' }];
  assert.equal(resolveLocale(english), 'es-AR', 'today an English iPhone still reads Spanish rather than half an app');
  assert.equal(resolveLocale(english, 'en-US'), 'es-AR', 'a stored English preference is ignored while English is unreleased');
  assert.equal(resolveLocale([], 'system'), DEFAULT_LOCALE);
  const all = ['es-AR', 'en-US'] as const;
  assert.equal(resolveLocale(english, 'system', all), 'en-US', 'once released, the device language decides');
  assert.equal(resolveLocale(spanishFirst, 'system', all), 'es-AR', 'the first preferred language wins');
  assert.equal(resolveLocale(portugueseThenEnglish, 'system', all), 'en-US', 'an unsupported first language falls through to the next');
  assert.equal(resolveLocale(english, 'es-AR', all), 'es-AR', 'an explicit preference beats the device');
  assert.equal(resolveLocale([{ languageTag: 'pt-BR' }], 'system', all), 'es-AR', 'nothing usable: the product default');
  assert.equal(resolveLocale([{ languageTag: '', languageCode: 'en' }], 'system', all), 'en-US', 'a bare language code still counts');
  assert.equal(languagePreferenceFrom('en-US'), 'en-US');
  assert.equal(languagePreferenceFrom('system'), 'system');
  assert.equal(languagePreferenceFrom('fr-FR'), 'system', 'an unknown stored value follows the device');
  assert.equal(languagePreferenceFrom(null), 'system');
});

test('device locales come from expo-localization when present, else Intl, else nothing; never a throw', () => {
  const native = deviceLocales(() => ({ getLocales: () => [{ languageTag: 'en-US', languageCode: 'en', regionCode: 'US' }, { languageTag: 'es-AR', languageCode: 'es', regionCode: 'AR' }] }));
  assert.deepEqual(native.map(locale => locale.languageTag).join(','), 'en-US,es-AR');
  assert.equal(native[0].regionCode, 'US');
  const fallback = deviceLocales(() => { throw new Error('Cannot find native module ExpoLocalization'); }, () => 'es-AR');
  assert.deepEqual(fallback.map(locale => locale.languageTag).join(','), 'es-AR', 'a binary without the module reads Intl');
  assert.deepEqual(deviceLocales(() => ({ getLocales: () => [] }), () => 'en-US').map(locale => locale.languageTag).join(','), 'en-US', 'an empty native list also falls back');
  assert.deepEqual(deviceLocales(() => { throw new Error('x'); }, () => { throw new Error('y'); }), [], 'both failing: an empty list, and resolution picks the default');
  assert.equal(resolveLocale(deviceLocales(() => { throw new Error('x'); }, () => undefined)), 'es-AR');
});

test('the language preference lives in the key-value store, validated on read; a broken store means "follow the device"', () => {
  const rows = new Map<string, string>();
  const store: PreferenceStore = { getItemSync: key => rows.get(key) ?? null, setItemSync: (key, value) => { rows.set(key, value); }, removeItemSync: key => rows.delete(key) };
  assert.equal(readLanguagePreference(() => store), 'system');
  assert.equal(writeLanguagePreference('en-US', () => store), true);
  assert.equal(rows.get(LANGUAGE_PREFERENCE_KEY), 'en-US');
  assert.equal(readLanguagePreference(() => store), 'en-US');
  assert.equal(writeLanguagePreference('system', () => store), true);
  assert.equal(rows.has(LANGUAGE_PREFERENCE_KEY), false, '"system" removes the entry');
  rows.set(LANGUAGE_PREFERENCE_KEY, 'klingon');
  assert.equal(readLanguagePreference(() => store), 'system', 'garbage in the store is not a locale');
  const broken = () => { throw new Error('database locked'); };
  assert.equal(readLanguagePreference(broken), 'system');
  assert.equal(writeLanguagePreference('es-AR', broken), false, 'a failed write reports false instead of throwing');
  assert.equal(startupLocale(() => 'en-US', () => [{ languageTag: 'en-US' }]), 'es-AR', 'startup honours the release gate');
  assert.equal(startupLocale(() => { throw new Error('x'); }, () => { throw new Error('y'); }), 'es-AR', 'startup never throws');
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
  assert.equal(formatDateTime('2026-09-22T09:03:05', 'en-US'), '9/22/2026, 9:03 AM');
  assert.equal(formatDateTime('2026-09-22T00:30:00', 'en-US'), '9/22/2026, 12:30 AM');
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
  assert.equal(currencySymbol('ARS', 'en-US'), 'AR$', 'in English a bare "$" would read as dollars');
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

test('both catalogues carry the same keys with the same placeholders, and lookups interpolate, pluralise and fall back', () => {
  const keys = messageKeys(es);
  assert.deepEqual(messageKeys(en).join('\n'), keys.join('\n'), 'the English catalogue matches the Spanish one key for key');
  assert.ok(keys.length >= 20);
  const placeholders = (text: string) => [...text.matchAll(/\{([a-zA-Z0-9_]+)\}/g)].map(match => match[1]).sort().join(',');
  for (const key of keys) {
    const a = translate('es-AR', key as never, { count: 2 }), b = translate('en-US', key as never, { count: 2 });
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
  assert.equal(translate('es-AR', 'common.cancel'), 'Cancelar');
  assert.equal(translate('en-US', 'common.cancel'), 'Cancel');
  assert.equal(translate('es-AR', 'common.moreInfoAbout', { title: 'saldo inicial' }), 'Más información sobre saldo inicial');
  assert.equal(translate('es-AR', 'count.movements', { count: 1 }), '1 movimiento');
  assert.equal(translate('es-AR', 'count.movements', { count: 3 }), '3 movimientos');
  assert.equal(translate('en-US', 'count.expenses', { count: 0 }), '0 expenses');
  assert.equal(translate('es-AR', 'amount.accessibility', { label: 'Gasto', currency: translate('es-AR', 'amount.inPesos') }), 'Gasto en pesos argentinos');
  assert.equal(interpolate('Hola {name}, {missing}', { name: 'Ana' }), 'Hola Ana, {missing}', 'a missing parameter stays visible rather than blank');
  assert.equal(translate('es-AR', 'no.such.key' as never), 'no.such.key', 'an unknown key shows itself, never an empty label');
  const t = translator('en-US');
  assert.equal(t('selection.chooseCurrency'), 'Choose currency');
  assert.equal(catalogue('en-US').common.done, 'Done');
});

test('a bound locale gives components one object of translator and formatters', () => {
  const es = bindLocale('es-AR');
  assert.equal(es.locale, 'es-AR');
  assert.equal(es.t('common.done'), 'Listo');
  assert.equal(es.formatDate('2026-09-22', 'dayYear'), '22 sep 2026');
  assert.equal(es.formatMonth('2026-09'), 'septiembre de 2026');
  assert.equal(es.formatPercent(0.5), '50\u00A0%');
  assert.equal(es.moneyText(150000, 'USD'), 'US$\u00A01.500,00');
  assert.equal(es.spokenMoney(150000, 'USD'), '1.500,00 dólares');
  assert.equal(es.currencyName('USD'), 'Dólares estadounidenses');
  const en = bindLocale('en-US');
  assert.equal(en.t('common.done'), 'Done');
  assert.equal(en.formatDate('2026-09-22', 'weekdayLong'), 'Tuesday, September 22, 2026');
  assert.equal(en.moneyText(150000, 'ARS'), 'AR$\u00A01,500.00');
});
