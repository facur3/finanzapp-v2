import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bindLocale } from '../src/i18n/bind.ts';
import { formatCount, formatDateTime, formatDayMonth, formatMoneyAmount, formatNumericDate, formatPercent, moneyText, spokenMoney } from '../src/i18n/format.ts';
import { foldText, nameComparator, probeIntl } from '../src/i18n/intl-support.ts';
import { REGIONS, completeConventions, type AppLocale } from '../src/i18n/locale.ts';
import { RECENT_KEYS, RECENT_LIMIT, readRecent, rememberRecent } from '../src/i18n/recent.ts';
import { catalogueConventions, isCatalogueRegion } from '../src/i18n/regions.ts';
import type { PreferenceStore } from '../src/i18n/preference.ts';

// Producto 24R1: the formatters written in a catalogue region's conventions, bound explicitly
// (language × region × currency, none implying another), the Intl probe and its fallbacks, and
// the recent-choice store. The released four combinations are pinned in i18n.node.ts; here they
// are only checked to be untouched by the explicit path.
const NBSP = ' ';

test('a language with another region\'s conventions: Spanish in Japan, English in Argentina, Spanish in the United Kingdom, English in India, and more', () => {
  const es = (region: string) => bindLocale('es-AR', 'none', null, [], catalogueConventions(region as never));
  const en = (region: string) => bindLocale('en-US', 'none', null, [], catalogueConventions(region as never));
  const japan = es('JP');
  assert.deepEqual([japan.formatNumericDate('2026-09-22'), japan.formatDayMonth('2026-09-05'), japan.formatDateTime('2026-09-22T14:03:05')], ['2026/09/22', '09/05', '2026/09/22, 14:03'], 'year first, zero-padded, 24 h');
  assert.deepEqual([japan.formatMoneyAmount(123456, 'ARS'), japan.moneyText(123456, 'ARS'), japan.moneyText(-123456, 'USD'), japan.formatCount(1234567), japan.formatPercent(0.1235)],
    ['1,234.56', 'AR$' + NBSP + '1,234.56', '−US$' + NBSP + '1,234.56', '1,234,567', '12.4' + NBSP + '%'], 'Japanese separators; no bare $ in Japan, so the peso is AR$; the Spanish % keeps its space');
  assert.deepEqual([japan.formatMoneyAmount(150000, 'JPY'), japan.formatMoneyAmount(1234567, 'KWD'), japan.formatMoneyAmount(1500, 'IQD')], ['150,000', '1,234.567', '1.5'], 'each currency keeps its own decimals whatever the region (IQD: three ISO decimals shown down to CLDR\'s none)');
  assert.deepEqual([japan.formatDate('2026-09-22', 'long'), japan.formatDate('2026-09-22', 'day'), japan.pickerLocale, japan.language, japan.region], ['22 de septiembre de 2026', '22 sep', 'es_AR', 'es', 'AR'], 'words and the wheel stay with the language; the bound locale is still the released one');
  assert.deepEqual([japan.spokenMoney(123456, 'ARS'), japan.spokenMoney(150000, 'JPY'), japan.spokenMinor(1234567, 'KWD')], ['1234,56 pesos', '150000 yenes japoneses', '1234,567'], 'VoiceOver keeps the language\'s decimal mark and no grouping in every region');
  assert.deepEqual(japan.amountFormat, { decimal: '.', group: ',' }, 'the amount field would type Japanese separators');
  assert.deepEqual([japan.conventions.weekStart, japan.conventions.dateSeparator, japan.conventions.paddedDate], [0, '/', true]);

  const britain = es('GB');
  assert.deepEqual([britain.formatNumericDate('2026-09-22'), britain.formatDayMonth('2026-09-05'), britain.formatDateTime('2026-09-22T14:03:05'), britain.formatMoneyAmount(123456, 'ARS'), britain.moneyText(5, 'GBP')],
    ['22/09/2026', '05/09', '22/09/2026, 14:03', '1,234.56', '£' + NBSP + '0.05']);
  const india = en('IN');
  assert.deepEqual([india.formatMoneyAmount(123456750, 'INR'), india.formatCount(1234567), india.formatCount(999), india.formatCount(1000), india.formatMoneyAmount(12345678901, 'INR'), india.formatNumericDate('2026-09-22'), india.formatDateTime('2026-09-22T14:03:05')],
    ['12,34,567.50', '12,34,567', '999', '1,000', '12,34,56,789.01', '22/9/2026', '22/9/2026, 2:03' + NBSP + 'PM'], 'lakh and crore, 12-hour clock with the English day period');
  const swiss = es('CH');
  assert.deepEqual([swiss.formatMoneyAmount(123456, 'CHF'), swiss.formatNumericDate('2026-09-22'), swiss.formatDateTime('2026-09-02T09:05:00'), swiss.moneyText(123456, 'CHF')], ["1'234.56", '22.09.2026', '22.09.2026'.replace('22', '02') + ', 09:05', 'CHF' + NBSP + "1'234.56"]);
  const germany = en('DE');
  assert.deepEqual([germany.formatMoneyAmount(123456, 'EUR'), germany.formatNumericDate('2026-09-22'), germany.formatDayMonth('2026-09-05'), germany.formatPercent(0.1235), germany.moneyText(-123456, 'EUR')], ['1.234,56', '22.09.2026', '05.09', '12,4%', '−€' + NBSP + '1.234,56']);
  const korea = es('KR');
  assert.deepEqual([korea.formatNumericDate('2026-09-22'), korea.formatDateTime('2026-09-22T14:03:05'), korea.formatMoneyAmount(1234567, 'KRW')], ['2026.9.22', '2026.9.22, 2:03' + NBSP + 'p.' + NBSP + 'm.', '1,234,567']);
  const brazil = en('BR');
  assert.deepEqual([brazil.formatMoneyAmount(123456, 'BRL'), brazil.formatNumericDate('2026-09-22'), brazil.formatDateTime('2026-09-22T14:03:05'), brazil.moneyText(123456, 'BRL')], ['1.234,56', '22/09/2026', '22/09/2026, 14:03', 'R$' + NBSP + '1.234,56']);
  const hungary = es('HU');
  assert.deepEqual([hungary.formatCount(1234), hungary.formatCount(12345), hungary.formatNumericDate('2026-09-22')], ['1234', '12' + NBSP + '345', '2026.09.22'], 'two digits before the first separator: "1234" stays unbroken');
  const egypt = en('EG');
  assert.deepEqual([egypt.formatMoneyAmount(123456, 'EGP'), egypt.formatNumericDate('2026-09-22')], ['1,234.56', '22/9/2026'], 'Latin digits and symbols even where the locale defaults to Arabic-script ones');
  // Argentina through the explicit path is Argentina: the registry's own value, the deliberate 24-hour clock included.
  const argentina = en('AR');
  assert.deepEqual([argentina.formatDateTime('2026-09-22T14:03:05'), argentina.formatMoneyAmount(123456, 'ARS'), argentina.moneyText(123456, 'ARS')], ['22/9/2026, 14:03', '1.234,56', '$' + NBSP + '1.234,56']);
  assert.equal(bindLocale('en-AR').formatDateTime('2026-09-22T14:03:05'), argentina.formatDateTime('2026-09-22T14:03:05'), 'the released pair and the explicit conventions agree');
});

test('the released four combinations are byte-identical with and without explicit conventions; a region change never changes a ledger amount', () => {
  const samples: [string, (i18n: ReturnType<typeof bindLocale>) => string][] = [
    ['amount', i18n => i18n.formatMoneyAmount(123456, 'ARS')], ['money', i18n => i18n.moneyText(-123456, 'USD')], ['coded', i18n => i18n.codedAmount(123456, 'ARS')],
    ['count', i18n => i18n.formatCount(1234567)], ['percent', i18n => i18n.formatPercent(0.1235)], ['numeric', i18n => i18n.formatNumericDate('2026-09-22')],
    ['dayMonth', i18n => i18n.formatDayMonth('2026-09-05')], ['time', i18n => i18n.formatDateTime('2026-09-22T14:03:05')], ['whole', i18n => i18n.formatWholeUnits(123456, 'ARS')],
    ['symbol', i18n => i18n.currencySymbol('ARS')], ['spoken', i18n => i18n.spokenMoney(123456, 'ARS')],
  ];
  for (const locale of ['es-AR', 'en-AR', 'es-US', 'en-US'] as AppLocale[]) {
    const implicit = bindLocale(locale), explicit = bindLocale(locale, 'none', null, [], REGIONS[locale.endsWith('AR') ? 'AR' : 'US']);
    for (const [name, sample] of samples) assert.equal(sample(explicit), sample(implicit), `${locale} ${name}`);
    assert.deepEqual(implicit.conventions, completeConventions(REGIONS[locale.endsWith('AR') ? 'AR' : 'US']));
  }
  assert.equal(formatDayMonth('2026-09-05', 'es-AR'), '5/09', 'the ledger\'s own day/month writing is untouched');
  assert.equal(formatDayMonth('2026-09-05', 'en-US'), '9/5');
  assert.equal(formatNumericDate('2026-09-22', 'es-AR'), '22/9/2026');
  assert.equal(formatDateTime('2026-09-22T14:03:05', 'en-US'), '9/22/2026, 2:03' + NBSP + 'PM');
  // Every catalogue region formats the same minor units: the digits never change, only the writing.
  const digits = (text: string) => text.replace(/[^0-9]/g, '');
  for (const code of ['JP', 'IN', 'CH', 'DE', 'KR', 'BR', 'HU', 'EG', 'FR', 'SA', 'ZA', 'RU']) {
    assert.ok(isCatalogueRegion(code));
    const c = catalogueConventions(code);
    assert.equal(digits(formatMoneyAmount(123456789, 'ARS', 'es-AR', c)), '123456789', code);
    assert.equal(digits(formatMoneyAmount(123456789, 'KWD', 'es-AR', c)), '123456789', code);
    assert.equal(digits(formatMoneyAmount(123456789, 'JPY', 'es-AR', c)), '123456789', code);
    assert.equal(digits(formatCount(1234567, 'es-AR', c)), '1234567', code);
    assert.equal(digits(formatPercent(0.1235, 'es-AR', c)), '124', code);
    assert.equal(spokenMoney(123456, 'ARS', 'es-AR'), '1234,56 pesos', code + ': the spoken form has no region');
    assert.equal(moneyText(100, 'ARS', 'en-US', false, false, c) !== moneyText(100, 'USD', 'en-US', false, false, c), true, code + ': pesos and dollars never look alike');
  }
});

test('the Intl probe never assumes a constructor: absent, present or present-but-throwing, each is reported; the name comparison falls back to folding and orders the same', () => {
  const none = probeIntl(null);
  assert.deepEqual(Object.values(none).filter(Boolean), [true], 'without Intl only normalize (a String method) remains');
  assert.equal(none.normalize, true);
  assert.deepEqual(probeIntl({}), none, 'an empty Intl object is the same as none');
  class Ok { constructor(_locale?: unknown, _options?: unknown) {} format() { return ''; } compare() { return 0; } }
  class Throws { constructor() { throw new RangeError('unsupported'); } }
  const hermesLike = probeIntl({ NumberFormat: Ok, DateTimeFormat: Ok, Collator: Ok });
  assert.deepEqual(hermesLike, { numberFormat: true, dateTimeFormat: true, collator: true, pluralRules: false, displayNames: false, relativeTimeFormat: false, listFormat: false, normalize: true }, 'Hermes on iOS: three constructors, nothing else');
  assert.equal(probeIntl({ Collator: Throws, PluralRules: Ok }).collator, false, 'a constructor that throws counts as absent');
  assert.equal(probeIntl({ Collator: Throws, PluralRules: Ok }).pluralRules, true);
  const real = probeIntl();
  assert.ok(real.numberFormat && real.dateTimeFormat && real.collator, 'this Node has them');
  // Folding: accents dropped, case ignored, trimmed; without normalize the text keeps its accents but still lower-cases.
  assert.deepEqual([foldText(' Álava '), foldText('Ñandú'), foldText('Åland'), foldText('日本')], ['alava', 'nandu', 'aland', '日本']);
  const names = ['Zambia', 'Åland', 'alemania', 'Andorra', 'Ávila', 'Austria'];
  const folded = nameComparator('es', null);
  assert.equal(folded.source, 'fold');
  assert.deepEqual([...names].sort(folded.compare), ['Åland', 'alemania', 'Andorra', 'Austria', 'Ávila', 'Zambia']);
  const collated = nameComparator('es');
  assert.equal(collated.source, 'collator');
  assert.deepEqual([...names].sort(collated.compare), [...names].sort(folded.compare), 'the collator and the fallback agree on this list');
  assert.equal(nameComparator('es', { Collator: Throws }).source, 'fold', 'a collator that refuses the language gives way to the fallback');
  class NoCompare { constructor(_l?: unknown, _o?: unknown) {} compare() { throw new Error('no'); } }
  assert.equal(nameComparator('es', { Collator: NoCompare }).source, 'fold', 'a collator that cannot compare too');
  assert.equal(folded.compare('a', 'a'), 0);
  assert.ok(folded.compare('a', 'A') !== 0, 'equal folds are ordered by their raw text so the order is total');
});

test('recent choices: most recent first, once each, at most three, junk skipped, an unreadable or unwritable store harmless, one key per chooser outside the ledger', () => {
  const rows = new Map<string, string>();
  const faults = { get: false, set: false };
  const store = (): PreferenceStore => ({
    getItemSync: key => { if (faults.get) throw new Error('locked'); return rows.get(key) ?? null; },
    setItemSync: (key, value) => { if (faults.set) throw new Error('full'); rows.set(key, value); },
    removeItemSync: key => rows.delete(key),
  });
  const region = (value: unknown): value is string => typeof value === 'string' && /^[A-Z]{2}$/.test(value);
  assert.deepEqual(readRecent('region', region, store), []);
  assert.equal(rememberRecent('region', 'JP', region, store), true);
  assert.equal(rememberRecent('region', 'GB', region, store), true);
  assert.equal(rememberRecent('region', 'JP', region, store), true);
  assert.deepEqual(readRecent('region', region, store), ['JP', 'GB'], 'JP moved to the front, once');
  rememberRecent('region', 'DE', region, store); rememberRecent('region', 'FR', region, store);
  assert.deepEqual(readRecent('region', region, store), ['FR', 'DE', 'JP'], 'at most ' + RECENT_LIMIT);
  assert.deepEqual([...rows.keys()], [RECENT_KEYS.region], 'one key, none of the preference or ledger keys');
  assert.equal(rows.get(RECENT_KEYS.region), '["FR","DE","JP"]');
  rows.set(RECENT_KEYS.region, '["XX","jp",42,"GB","GB",null,"US"]');
  assert.deepEqual(readRecent('region', region, store), ['XX', 'GB', 'US'], 'only accepted values, once each');
  rows.set(RECENT_KEYS.region, '{"not":"a list"}');
  assert.deepEqual(readRecent('region', region, store), []);
  rows.set(RECENT_KEYS.region, 'not json');
  assert.deepEqual(readRecent('region', region, store), []);
  faults.get = true;
  assert.deepEqual(readRecent('region', region, store), [], 'unreadable: empty, never a throw');
  faults.get = false; faults.set = true;
  rows.set(RECENT_KEYS.region, '["GB"]');
  assert.equal(rememberRecent('region', 'JP', region, store), false, 'unwritable: not remembered, and says so');
  assert.equal(rows.get(RECENT_KEYS.region), '["GB"]', 'the stored list is untouched');
  assert.equal(RECENT_KEYS.language, 'finanzapp.recent.language');
});
