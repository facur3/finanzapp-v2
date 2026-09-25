import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { parseMinorUnits } from '@finanzapp/domain';
import { bindLocale } from '../src/i18n/bind.ts';
import { groupBreaks, groupWhole } from '../src/i18n/grouping.ts';
import { PREVIEW, REGIONS, REGION_REGISTRY, RELEASED, RELEASED_REGIONS, composeLocale, isRegionCode, regionPreferenceFrom, resolveRegion, type AppLocale,
  type RegionCode, type ReleasedSets } from '../src/i18n/locale.ts';
import { REGION_PREFERENCE_KEY, type PreferenceStore } from '../src/i18n/preference.ts';
import { readRecent, rememberRecent } from '../src/i18n/recent.ts';
import { REGION_RELEASE_STAGES, dateFamily, numberFamily, releasedByStages, stageFamilies, stageOf } from '../src/i18n/region-release.ts';
import { REGION_CODES, REGION_DATA } from '../src/i18n/regions/index.ts';
import { activeRegionChoice, createLocaleStore, pendingRegionChoice, type DeviceReading } from '../src/i18n/store.ts';
import { buildChoiceRows, filterChoices } from '../src/ui/choice-list.ts';
import { languageChooser, preferenceSummary, regionChooser } from '../src/ui/locale-options.ts';
import { AmountInput, amountFromDraft, amountFromView, displayAmount, draftFromAmount, latinDigits, readPastedAmount, renderAmount, type AmountFormat } from '../src/ui/money-input.ts';

// Producto 24R2A: the catalogue's 257 regions integrated behind the release gate. The registry is derived from the
// catalogue; the device's Region is read from the Region setting only; a region chosen in a development preview is
// kept and shown with its stand-in; every writing family formats, types, pastes and keeps amounts exactly; the
// choosers are ChoiceScreen's inputs. Argentina and the United States stay the only released regions.

const NNBSP = ' ', NBSP = ' ';
function memory(initial: Record<string, string> = {}) {
  const rows = new Map(Object.entries(initial));
  const store: PreferenceStore = { getItemSync: key => rows.get(key) ?? null, setItemSync: (key, value) => { rows.set(key, value); }, removeItemSync: key => rows.delete(key) };
  return { rows, store: () => store };
}
const device = (languageTag: string, regionCode: string | null): DeviceReading => ({ source: 'native', locales: [{ languageTag, languageCode: languageTag.split('-')[0], regionCode }] });
const formatOf = (region: RegionCode): AmountFormat => bindLocale(composeLocale('es', region)).amountFormat;

// ---- The registry, derived ----------------------------------------------------

test('REGIONS is derived from the catalogue: 257 regions, every writing field CLDR\'s, the hand-written registry winning only where it deviates on purpose', () => {
  assert.equal(Object.keys(REGIONS).length, 257);
  assert.deepEqual(Object.keys(REGIONS), [...REGION_CODES]);
  for (const code of REGION_CODES) {
    const record = REGION_DATA[code], conventions = REGIONS[code];
    const expected = { decimal: record.decimal, group: record.group, dateOrder: record.dateOrder, hour12: record.hour12, dollarSignCurrency: record.dollarSignCurrency,
      dateSeparator: record.dateSeparator, paddedDate: record.paddedDate, secondaryGrouping: record.secondaryGrouping, minimumGroupingDigits: record.minimumGroupingDigits,
      weekStart: record.weekStart, ...(REGION_REGISTRY as Record<string, object>)[code] };
    assert.deepEqual({ ...conventions }, expected, code);
    assert.ok(isRegionCode(code));
    assert.equal(Object.isFrozen(conventions), true, 'no caller can change a region\'s writing at run time');
  }
  assert.deepEqual(Object.keys(REGION_REGISTRY), ['AR', 'US']);
  assert.equal(REGIONS.AR.hour12, false, 'the one deliberate deviation: Argentina\'s 24-hour clock (CLDR prefers 12 h)');
  assert.equal(REGION_DATA.AR.hour12, true);
  assert.equal(isRegionCode('EU'), false, 'macro and placeholder codes are not regions');
  assert.equal(isRegionCode('ar'), false, 'codes are exact upper case');
});

test('grouping: groups of three, the Indian lakh and crore, and the minimum grouping of two, one rule for formatters and the amount field', () => {
  assert.deepEqual(groupBreaks(7), [1, 4]);
  assert.deepEqual(groupBreaks(9, { secondaryGrouping: 2 }), [2, 4, 6]);
  assert.deepEqual([groupBreaks(3), groupBreaks(4), groupBreaks(4, { minimumGroupingDigits: 2 }), groupBreaks(5, { minimumGroupingDigits: 2 })], [[], [1], [], [2]]);
  assert.equal(groupWhole('1234567890', ',', { secondaryGrouping: 2 }), '1,23,45,67,890');
  assert.equal(groupWhole('1234', NBSP, { minimumGroupingDigits: 2 }), '1234');
  assert.equal(groupWhole('12345', NBSP, { minimumGroupingDigits: 2 }), '12' + NBSP + '345');
  assert.equal(groupWhole('', '.'), '');
});

// ---- Formats per family and language --------------------------------------------

test('language × region: the words follow the language, every number, date and clock follows the region, VoiceOver keeps the language\'s own decimal and no grouping', () => {
  // Reviewed against CLDR 48.2.0 for the families 24R2B will check on the iPhone. Columns: an amount, one below the
  // minimum grouping, a big one, yen, a negative dollar amount, a numeric date, a day of the period, a time, a count,
  // a percentage, a worded date, VoiceOver, the date wheel.
  const rows: [AppLocale, string][] = [
    ['es-JP', '12,345.67 | 1,234.56 | 1,234,567,890.12 | 150,000 | −US$ 1,234.56 | 2026/09/05 | 09/05 | 2026/09/22, 14:03 | 12,345 | 12.3 % | 22 sep 2026 | 1234,56 pesos | es_AR'],
    ['en-JP', '12,345.67 | 1,234.56 | 1,234,567,890.12 | 150,000 | −US$ 1,234.56 | 2026/09/05 | 09/05 | 2026/09/22, 14:03 | 12,345 | 12.3% | Sep 22, 2026 | 1234.56 pesos | en_US'],
    ['en-IN', '12,345.67 | 1,234.56 | 1,23,45,67,890.12 | 1,50,000 | −US$ 1,234.56 | 5/9/2026 | 5/9 | 22/9/2026, 2:03 PM | 12,345 | 12.3% | Sep 22, 2026 | 1234.56 pesos | en_US'],
    ['es-IN', '12,345.67 | 1,234.56 | 1,23,45,67,890.12 | 1,50,000 | −US$ 1,234.56 | 5/9/2026 | 5/9 | 22/9/2026, 2:03 p. m. | 12,345 | 12.3 % | 22 sep 2026 | 1234,56 pesos | es_AR'],
    ['es-CH', "12'345.67 | 1'234.56 | 1'234'567'890.12 | 150'000 | −US$ 1'234.56 | 05.09.2026 | 05.09 | 22.09.2026, 14:03 | 12'345 | 12.3 % | 22 sep 2026 | 1234,56 pesos | es_AR"],
    ['es-DE', '12.345,67 | 1.234,56 | 1.234.567.890,12 | 150.000 | −US$ 1.234,56 | 05.09.2026 | 05.09 | 22.09.2026, 14:03 | 12.345 | 12,3 % | 22 sep 2026 | 1234,56 pesos | es_AR'],
    ['en-FR', '12 345,67 | 1 234,56 | 1 234 567 890,12 | 150 000 | −US$ 1 234,56 | 05/09/2026 | 05/09 | 22/09/2026, 14:03 | 12 345 | 12,3% | Sep 22, 2026 | 1234.56 pesos | en_US'],
    ['es-PL', '12 345,67 | 1234,56 | 1 234 567 890,12 | 150 000 | −US$ 1234,56 | 05.09.2026 | 05.09 | 22.09.2026, 14:03 | 12 345 | 12,3 % | 22 sep 2026 | 1234,56 pesos | es_AR'],
    ['es-ES', '12.345,67 | 1234,56 | 1.234.567.890,12 | 150.000 | −US$ 1234,56 | 5/9/2026 | 5/9 | 22/9/2026, 14:03 | 12.345 | 12,3 % | 22 sep 2026 | 1234,56 pesos | es_AR'],
    ['en-GB', '12,345.67 | 1,234.56 | 1,234,567,890.12 | 150,000 | −US$ 1,234.56 | 05/09/2026 | 05/09 | 22/09/2026, 14:03 | 12,345 | 12.3% | Sep 22, 2026 | 1234.56 pesos | en_US'],
    ['es-CA', '12,345.67 | 1,234.56 | 1,234,567,890.12 | 150,000 | −US$ 1,234.56 | 2026-09-05 | 09-05 | 2026-09-22, 2:03 p. m. | 12,345 | 12.3 % | 22 sep 2026 | 1234,56 pesos | es_AR'],
    ['en-BR', '12.345,67 | 1.234,56 | 1.234.567.890,12 | 150.000 | −US$ 1.234,56 | 05/09/2026 | 05/09 | 22/09/2026, 14:03 | 12.345 | 12,3% | Sep 22, 2026 | 1234.56 pesos | en_US'],
    ['es-MX', '12,345.67 | 1,234.56 | 1,234,567,890.12 | 150,000 | −US$ 1,234.56 | 05/09/2026 | 05/09 | 22/09/2026, 2:03 p. m. | 12,345 | 12.3 % | 22 sep 2026 | 1234,56 pesos | es_AR'],
    ['en-CR', '12 345,67 | 1 234,56 | 1 234 567 890,12 | 150 000 | −US$ 1 234,56 | 5/9/2026 | 5/9 | 22/9/2026, 2:03 PM | 12 345 | 12,3% | Sep 22, 2026 | 1234.56 pesos | en_US'],
  ];
  const plain = (text: string) => text.replace(/[  ]/g, ' ');
  for (const [locale, expected] of rows) {
    const i = bindLocale(locale);
    const line = [i.formatMoneyAmount(1234567, 'ARS'), i.formatMoneyAmount(123456, 'ARS'), i.formatMoneyAmount(123456789012, 'ARS'), i.formatMoneyAmount(150000, 'JPY'),
      i.moneyText(-123456, 'USD'), i.formatNumericDate('2026-09-05'), i.formatDayMonth('2026-09-05'), i.formatDateTime('2026-09-22T14:03:00'), i.formatCount(12345),
      i.formatPercent(0.1234), i.formatDate('2026-09-22', 'dayYear'), i.spokenMoney(123456, 'ARS'), i.pickerLocale].join(' | ');
    assert.equal(plain(line), expected, locale);
  }
  // The exact space characters: France groups with the narrow no-break space, Poland and Costa Rica with the no-break space.
  assert.equal(bindLocale('en-FR').formatMoneyAmount(1234567, 'ARS'), '12' + NNBSP + '345,67');
  assert.equal(bindLocale('es-PL').formatMoneyAmount(1234567, 'ARS'), '12' + NBSP + '345,67');
  assert.equal(bindLocale('en-CR').formatMoneyAmount(1234567, 'ARS'), '12' + NBSP + '345,67');
  // Argentina and the United States: the strings they always wrote.
  assert.deepEqual(['es-AR', 'en-US', 'en-AR', 'es-US'].map(locale => { const i = bindLocale(locale as AppLocale); return [i.formatMoneyAmount(123456, 'ARS'), i.formatNumericDate('2026-09-05'), i.formatDayMonth('2026-09-05'), i.formatDateTime('2026-09-22T14:03:00')].map(plain).join(' | '); }),
    ['1.234,56 | 5/9/2026 | 5/09 | 22/9/2026, 14:03', '1,234.56 | 9/5/2026 | 9/5 | 9/22/2026, 2:03 PM', '1.234,56 | 5/9/2026 | 5/09 | 22/9/2026, 14:03', '1,234.56 | 9/5/2026 | 9/5 | 9/22/2026, 2:03 p. m.']);
});

test('every catalogue region and both languages: no formatter throws, VoiceOver is never grouped, a spoken amount is the same number in every region', () => {
  for (const region of REGION_CODES) for (const language of ['es', 'en'] as const) {
    const i = bindLocale(composeLocale(language, region));
    assert.equal(i.region, region);
    assert.equal(i.spokenMoney(123456789, 'ARS'), language === 'es' ? '1234567,89 pesos' : '1234567.89 pesos', region);
    assert.equal(i.pickerLocale, language === 'es' ? 'es_AR' : 'en_US', 'the date wheel follows the language');
    assert.ok(i.formatMoneyAmount(-123456789, 'ARS').startsWith('-'));
    assert.match(i.formatNumericDate('2026-09-05'), /2026/);
    assert.match(i.formatDateTime('2026-09-22T14:03:00'), REGIONS[region].hour12 ? /2:03/ : /14:03/);
  }
});

// ---- The amount field in every family -----------------------------------------------

/** Types `keys` one by one at the end, as the iOS pad does, and returns every view the field showed. */
function type(input: AmountInput, keys: string): string[] {
  const shown: string[] = [];
  for (const key of keys) {
    const raw = input.view.text.slice(0, input.view.caret) + key + input.view.text.slice(input.view.caret);
    shown.push(input.change(raw, input.view.caret + 1).view.text);
  }
  return shown;
}

test('typing in each family: lakh, apostrophe, narrow and no-break spaces, the minimum grouping; the caret stays after the last digit and the draft stays in the ledger notation', () => {
  const india = new AmountInput('', formatOf('IN'), 'ARS');
  assert.deepEqual(type(india, '12345678'), ['1', '12', '123', '1,234', '12,345', '1,23,456', '12,34,567', '1,23,45,678']);
  assert.equal(india.view.caret, india.view.text.length);
  assert.equal(india.draft, '12.345.678', 'the ledger notation, whatever the region writes');
  type(india, '.5');
  assert.deepEqual([india.view.text, india.draft], ['1,23,45,678.5', '12.345.678,5']);

  const swiss = new AmountInput('', formatOf('CH'), 'ARS');
  assert.deepEqual(type(swiss, '1234567'), ['1', '12', '123', "1'234", "12'345", "123'456", "1'234'567"]);
  type(swiss, ',25');
  assert.deepEqual([swiss.view.text, swiss.draft], ["1'234'567.25", '1.234.567,25'], 'the pad\'s comma is the decimal separator in Switzerland too (the device\'s key)');

  const france = new AmountInput('', formatOf('FR'), 'ARS');
  assert.deepEqual(type(france, '12345,6'), ['1', '12', '123', '1' + NNBSP + '234', '12' + NNBSP + '345', '12' + NNBSP + '345,', '12' + NNBSP + '345,6']);
  assert.equal(france.draft, '12.345,6');

  const poland = new AmountInput('', formatOf('PL'), 'ARS');
  assert.deepEqual(type(poland, '12345'), ['1', '12', '123', '1234', '12' + NBSP + '345'], 'no separator in "1234": the minimum grouping of two');
  const spain = new AmountInput('', formatOf('ES'), 'ARS');
  assert.deepEqual(type(spain, '12345'), ['1', '12', '123', '1234', '12.345']);
  assert.equal(spain.draft, '12.345');

  const japan = new AmountInput('', formatOf('JP'), 'JPY');
  assert.deepEqual(type(japan, '150000.'), ['1', '15', '150', '1,500', '15,000', '150,000', '150,000'], 'yen: no decimals, the separator key does nothing');
  assert.equal(japan.draft, '150.000');
});

test('the caret around a group separator: a tap between digits, a digit typed there, a backspace over an apostrophe or a narrow space removes the digit before it', () => {
  const india = new AmountInput('1.234.567', formatOf('IN'), 'ARS');
  assert.equal(india.view.text, '12,34,567');
  // The caret after "12,3" (display 4): a "9" typed there.
  assert.equal(india.select(4, '12,34,567'), true);
  const raw = '12,394,567';
  assert.deepEqual([india.change(raw, 5).view, india.draft], [{ text: '1,23,94,567', caret: 6 }, '12.394.567']);
  const swiss = new AmountInput('1.234', formatOf('CH'), 'ARS');
  assert.equal(swiss.view.text, "1'234");
  assert.deepEqual(swiss.change('1234', 1).view, { text: '234', caret: 0 }, 'deleting the apostrophe deletes the "1" before it');
  const france = new AmountInput('1.234', formatOf('FR'), 'ARS');
  assert.deepEqual(france.change('1234', 1).view, { text: '234', caret: 0 }, 'the same over a narrow no-break space');
});

test('pasting: lakh, apostrophes and spaces only group, another script\'s digits are the same digits, and what could mean two amounts is refused, never guessed', () => {
  const read = (text: string, region: RegionCode, currency = 'ARS' as const) => { const r = readPastedAmount(text, formatOf(region), currency); return r.ok ? r.canonical : r.reason; };
  assert.equal(read('12,34,567.89', 'IN'), '1234567,89');
  assert.equal(read('1,00,000', 'IN'), '100000');
  assert.equal(read('12,34,567.89', 'AR'), '1234567,89', 'lakh grouping cannot mean anything else, in any region');
  assert.equal(read("1'234.56", 'CH'), '1234,56');
  assert.equal(read('1’234.56', 'AR'), '1234,56', 'a typographic apostrophe groups too');
  assert.equal(read('1' + NNBSP + '234,56', 'FR'), '1234,56');
  assert.equal(read('1' + NBSP + '234' + NBSP + '567', 'PL'), '1234567');
  assert.equal(read('1234,56', 'ES'), '1234,56');
  assert.equal(read('١٢٣٫٤٥', 'AR'), '123,45', 'Arabic-Indic digits and decimal separator');
  assert.equal(read('۱۲۳۴', 'AR'), '1234', 'Eastern Arabic-Indic digits');
  assert.equal(read('１２３', 'JP'), '123', 'full-width digits');
  assert.equal(read('١٬٢٣٤', 'AR'), '1234', 'the Arabic thousands separator only groups');
  // Refused: one separator before exactly three digits that is not the region's group.
  assert.equal(read('1.000', 'CH'), 'ambiguous', 'in Switzerland a point is the decimal: one, or a thousand?');
  assert.equal(read('1,000', 'FR'), 'ambiguous');
  assert.equal(read('1.000', 'IN'), 'ambiguous');
  assert.equal(read('1,000', 'IN'), '1000', 'the region\'s own group separator');
  assert.equal(read('1.000', 'DE'), '1000');
  assert.equal(read('1.000', 'ES'), '1000');
  assert.equal(read('1.2.3', 'AR'), 'invalid');
  assert.equal(read('12 34', 'FR'), 'invalid');
  assert.equal(read('1,2,34,567', 'IN'), 'invalid', 'a group of one inside the number');
  assert.equal(latinDigits('a١b'), 'a1b', 'one character for one: indexes stay valid');
});

test('an amount shown in its own region and pasted back is the same amount, in all 257 regions: formats never alter a value', () => {
  const amounts = [5, 99, 123456, 100000, 1000000, 123456789012, 9999999999999];
  for (const region of REGION_CODES) {
    const format = formatOf(region), locale = composeLocale('es', region);
    for (const minor of amounts) {
      const shown = bindLocale(locale).formatMoneyAmount(minor, 'ARS');
      const pasted = readPastedAmount(shown, format, 'ARS');
      assert.ok(pasted.ok, `${region} ${shown}`);
      assert.equal(parseMinorUnits(pasted.canonical), minor, `${region} ${shown}`);
    }
  }
});

test('the draft is never rewritten: a ledger draft displayed and read back in any region, and a region change mid-edit, keep the same draft and the same logical caret', () => {
  const drafts = ['1.234.567,89', '-0,5', '12', '1.000', '9.999.999.999.999,99', '0,05'];
  for (const region of REGION_CODES) {
    const format = formatOf(region);
    for (const draft of drafts) {
      const view = renderAmount(amountFromDraft(draft, 'ARS'), format);
      assert.equal(view.text, displayAmount(draft, format, 'ARS'));
      assert.equal(draftFromAmount(amountFromView(view, format, 'ARS')), draft, `${region} ${draft}`);
    }
  }
  // Editing in India, then the Region changes to France and to Switzerland with the caret mid-number.
  const input = new AmountInput('', formatOf('IN'), 'ARS');
  type(input, '1234567');
  input.select(4, input.view.text); // after "12,3"
  const logical = input.state.caret;
  for (const region of ['FR', 'CH', 'PL', 'AR', 'US', 'IN'] as RegionCode[]) {
    input.reformat(formatOf(region));
    assert.equal(input.draft, '1.234.567', region);
    assert.equal(input.state.caret, logical, 'the caret stays between the same digits');
    assert.equal(input.view.text, displayAmount('1.234.567', formatOf(region), 'ARS'));
  }
  assert.deepEqual(input.view, { text: '12,34,567', caret: 4 });
});

// ---- The device's Region, the preferences, the gate ---------------------------------

test('"Según el dispositivo" reads the iPhone\'s Region setting: never the language, never a second language, never a location', () => {
  const read = (reading: DeviceReading) => createLocaleStore({ devices: () => reading, store: memory().store, released: PREVIEW }).getState();
  assert.deepEqual([read(device('es-AR', 'JP')).region, read(device('es-AR', 'JP')).language], ['JP', 'es'], 'Spanish language, Japanese Region: Japanese formats in Spanish');
  assert.equal(read(device('ja-JP', 'AR')).region, 'AR', 'a Japanese-language iPhone set to Argentina writes Argentine formats');
  assert.equal(read({ source: 'native', locales: [{ languageTag: 'es-AR', regionCode: 'CH' }, { languageTag: 'en-GB', regionCode: 'GB' }] }).region, 'CH', 'the first locale\'s Region, never a second language\'s');
  assert.equal(read({ source: 'intl', locales: [{ languageTag: 'de-CH' }] }).region, 'CH', 'only Intl answered (an older binary): the tag it gives');
  assert.equal(read(device('es-AR', 'ZZ')).region, 'AR', 'a Region the catalogue does not know: the default');
  // Released gate: the device's Japan is detected and named, Argentina's formats stand in.
  const release = createLocaleStore({ devices: () => device('es-AR', 'JP'), store: memory().store }).getState();
  assert.deepEqual([release.region, release.device.detectedRegion], ['AR', 'JP']);
  // No location API anywhere in the app.
  const offenders: string[] = [];
  const walk = (dir: URL) => { for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const url = new URL(entry.name + (entry.isDirectory() ? '/' : ''), dir);
    if (entry.isDirectory()) walk(url); else if (/\.tsx?$/.test(entry.name) && /expo-location|geolocation|getCurrentPosition|CLLocation/.test(readFileSync(url, 'utf8'))) offenders.push(entry.name);
  } };
  walk(new URL('../app/', import.meta.url));
  walk(new URL('../src/', import.meta.url));
  assert.deepEqual(offenders, []);
  assert.doesNotMatch(readFileSync(new URL('../package.json', import.meta.url), 'utf8'), /expo-location/);
});

test('a region chosen in a development preview is saved, kept by a release build without being applied, shown with its stand-in, and applied once released', () => {
  const saved = memory();
  const preview = createLocaleStore({ devices: () => device('es-AR', 'AR'), store: saved.store, released: PREVIEW });
  assert.equal(preview.setRegion('JP'), true, 'the preview offers every catalogue region');
  assert.equal(preview.getState().locale, 'es-JP');
  assert.equal(saved.rows.get(REGION_PREFERENCE_KEY), 'JP', 'saved before applied');
  assert.equal(regionPreferenceFrom('JP'), 'JP');
  // The same rows under a release build (RELEASED: AR and US): kept, not applied.
  const release = createLocaleStore({ devices: () => device('es-AR', 'US'), store: saved.store });
  let state = release.getState();
  assert.deepEqual([state.preferences.region, state.region, activeRegionChoice(state), pendingRegionChoice(state)], ['JP', 'US', 'system', 'JP'],
    'the saved Japan waits; the device\'s released Region writes meanwhile');
  assert.equal(saved.rows.get(REGION_PREFERENCE_KEY), 'JP', 'never overwritten by the app');
  assert.equal(release.setRegion('JP'), false, 'a release build never saves an unreleased region');
  const t = bindLocale(state.locale).t;
  assert.equal(preferenceSummary('region', state, t), 'Japón · formatos de Estados Unidos', 'the Más row says what is written');
  const chooser = regionChooser(state, t);
  assert.deepEqual(chooser.options.map(option => [option.value, option.subtitle]), [['AR', '22/9/2026 · 1.234,56'], ['US', '9/22/2026 · 1,234.56'],
    ['JP', 'Todavía no disponible en esta versión · formatos de Estados Unidos']]);
  assert.equal(chooser.selected, 'JP', 'the checkmark on what the person chose, with the stand-in named');
  assert.equal(chooser.acceptRecent('JP'), false, 'an unreleased region is never offered as a recent');
  // The next build releases Japan: the same rows apply with no action.
  const later: ReleasedSets = { languages: RELEASED.languages, regions: [...RELEASED.regions, 'JP'] };
  state = createLocaleStore({ devices: () => device('es-AR', 'US'), store: saved.store, released: later }).getState();
  assert.deepEqual([state.locale, pendingRegionChoice(state), activeRegionChoice(state)], ['es-JP', null, 'JP']);
  // Choosing a released region replaces it; "Según el dispositivo" removes the key.
  assert.equal(release.setRegion('AR'), true);
  assert.deepEqual([release.getState().region, pendingRegionChoice(release.getState())], ['AR', null]);
  assert.equal(release.setRegion('system'), true);
  assert.equal(saved.rows.has(REGION_PREFERENCE_KEY), false);
  assert.equal(resolveRegion([{ languageTag: 'es-AR', regionCode: 'JP' }], 'JP'), 'AR', 'an unreleased choice falls through to the device, then the default');
});

test('language and region stay independent across every combination: changing one never moves the other or the stored rows of the other', () => {
  const saved = memory();
  const store = createLocaleStore({ devices: () => device('es-AR', 'AR'), store: saved.store, released: PREVIEW });
  for (const language of ['en', 'es'] as const) for (const region of ['JP', 'IN', 'CH', 'FR', 'US', 'AR'] as RegionCode[]) {
    assert.equal(store.setLanguage(language), true);
    assert.equal(store.setRegion(region), true);
    assert.equal(store.getState().locale, `${language}-${region}`);
    assert.equal(store.setLanguage(language === 'en' ? 'es' : 'en'), true);
    assert.equal(store.getState().region, region, 'a language change keeps the region');
    assert.equal(saved.rows.get(REGION_PREFERENCE_KEY), region);
  }
});

// ---- The choosers -----------------------------------------------------------

test('the choosers: a short released list is one card; the preview\'s 257 regions are searchable by name, ISO code, alpha-3, numeric code and currency, with recents and sections', () => {
  const release = createLocaleStore({ devices: () => device('es-AR', 'AR'), store: memory().store }).getState();
  const t = bindLocale('es-AR').t;
  const short = regionChooser(release, t);
  assert.deepEqual([short.pinned.value, ...short.options.map(option => option.value)], ['system', 'AR', 'US']);
  assert.doesNotMatch(short.note, /Vista previa/, 'a release says nothing about previews');
  assert.deepEqual(languageChooser(release, t).options.map(option => [option.title, option.language]), [['Español', 'es'], ['English', 'en']], 'autonyms with their own voice');
  assert.deepEqual(filterChoices('english', languageChooser(release, t).options).map(option => option.value), ['en']);

  const preview = createLocaleStore({ devices: () => device('es-AR', 'AR'), store: memory().store, released: PREVIEW }).getState();
  const long = regionChooser(preview, t);
  assert.equal(long.options.length, 257);
  assert.match(long.note, /Vista previa de desarrollo/, 'the preview says its regions are not verified yet');
  const search = (query: string) => filterChoices(query, long.options).slice(0, 3).map(option => option.value);
  assert.deepEqual(search('japon')[0], 'JP', 'by name, accents ignored');
  assert.deepEqual(search('jp')[0], 'JP', 'by alpha-2');
  assert.deepEqual(search('jpn')[0], 'JP', 'by alpha-3');
  assert.deepEqual(search('392')[0], 'JP', 'by numeric code');
  assert.ok(search('chf').includes('CH'), 'by currency');
  assert.equal(long.options.find(option => option.value === 'IN')!.subtitle, '22/9/2026 · 1,234.56', 'each row shows its own formats');
  const rows = buildChoiceRows({ pinned: long.pinned, recent: ['JP', 'IN'], options: long.options, selected: long.selected, recentTitle: 'Recientes' });
  assert.deepEqual(rows.slice(0, 5).map(row => row.kind === 'header' ? '# ' + row.title : row.option.value), ['system', '# Recientes', 'JP', 'IN', '# A']);
  // English interface: CLDR's English names, sections by their initials.
  const english = regionChooser({ ...preview, language: 'en' }, bindLocale('en-AR').t);
  assert.equal(english.options.find(option => option.value === 'DE')!.title, 'Germany');
  assert.equal(filterChoices('alemania', english.options).length, 0, 'searched in the interface language');
});

test('recents: the last three choices, most recent first, only values the chooser still accepts, stored beside the preferences', () => {
  const saved = memory();
  const accept = (value: unknown): value is RegionCode => isRegionCode(value) && value !== 'KP';
  for (const code of ['JP', 'IN', 'JP', 'CH', 'FR']) assert.equal(rememberRecent('region', code as RegionCode, accept, saved.store), true);
  assert.deepEqual(readRecent('region', accept, saved.store), ['FR', 'CH', 'JP']);
  saved.rows.set('finanzapp.recent.region', JSON.stringify(['KP', 'XX', 'IN', 42]));
  assert.deepEqual(readRecent('region', accept, saved.store), ['IN'], 'junk and refused values are skipped');
  saved.rows.set('finanzapp.recent.region', '{');
  assert.deepEqual(readRecent('region', accept, saved.store), []);
});

// ---- The release plan ---------------------------------------------------------

test('the release plan: RELEASED_REGIONS equals the released stages; the stages are disjoint and together cover every number family of the catalogue', () => {
  assert.deepEqual([...releasedByStages()].sort(), [...RELEASED_REGIONS].sort(), 'opening a stage is one commit that flips its status after its device QA');
  assert.deepEqual(REGION_RELEASE_STAGES.filter(stage => stage.status === 'released').map(stage => stage.id), ['home']);
  const planned = REGION_RELEASE_STAGES.flatMap(stage => stage.regions);
  assert.equal(new Set(planned).size, planned.length, 'no region in two stages');
  for (const code of planned) assert.ok(isRegionCode(code), code);
  const families = new Set(REGION_CODES.map(numberFamily));
  assert.equal(families.size, 8, 'eight ways to write a number in the catalogue');
  const covered = new Set(REGION_RELEASE_STAGES.flatMap(stage => stageFamilies(stage).numbers));
  assert.deepEqual([...families].filter(family => !covered.has(family)), [], 'every number family has a stage that checks it on the iPhone');
  assert.deepEqual(stageFamilies(REGION_RELEASE_STAGES.find(stage => stage.id === 'india')!).numbers, ["decimal '.' · group ',' · 3/2 · min 1"]);
  assert.deepEqual(stageFamilies(REGION_RELEASE_STAGES.find(stage => stage.id === 'narrow-space')!).numbers, ["decimal ',' · group 'U+202F' · 3/3 · min 1"]);
  assert.equal(dateFamily('JP'), "ymd '/' · padded · 24 h");
  assert.equal(stageOf('MX')!.id, 'spanish');
  assert.equal(stageOf('KP'), null, 'a region outside every stage stays unreleased until a later stage lists it');
  // The preview offers the catalogue; the release only the released stages.
  assert.equal(PREVIEW.regions.length, 257);
  assert.deepEqual([...RELEASED.regions], ['AR', 'US']);
});
