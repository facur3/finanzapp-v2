import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { test } from 'node:test';
import { parseMinorUnits } from '@finanzapp/domain';
import { bindLocale } from '../src/i18n/bind.ts';
import { groupWhole } from '../src/i18n/grouping.ts';
import { PREVIEW, REGIONS, RELEASED_REGIONS, composeLocale, type RegionCode } from '../src/i18n/locale.ts';
import { REGION_PREFERENCE_KEY, type PreferenceStore } from '../src/i18n/preference.ts';
import { dateFamily, numberFamily } from '../src/i18n/region-release.ts';
import { createLocaleStore } from '../src/i18n/store.ts';
import { AmountInput, readPastedAmount } from '../src/ui/money-input.ts';

// Producto 24R2B: the automated evidence each released region rests on. For every released region, in Spanish and in
// English: amounts and separators (the field types exactly what the formatter writes), the caret, deleting across a
// group separator, pasting back, the refused ambiguous paste, dates, day and month, the clock, the spoken forms and the
// persistence of the choice. Then the generated iPhone sheet (docs/region-families.md) is checked against the code.

function memory() {
  const rows = new Map<string, string>();
  const store: PreferenceStore = { getItemSync: key => rows.get(key) ?? null, setItemSync: (key, value) => { rows.set(key, value); }, removeItemSync: key => rows.delete(key) };
  return { rows, store: () => store };
}

/** Types `keys` at the caret as the iOS pad does. */
function type(input: AmountInput, keys: string) {
  for (const key of keys) input.change(input.view.text.slice(0, input.view.caret) + key + input.view.text.slice(input.view.caret), input.view.caret + 1);
}

/** Reads a date written with `template` back into its numbers, or null when the text does not fit the template. */
function readTemplate(template: string, text: string): Record<string, number> | null {
  const names: string[] = [];
  const source = template.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/y|MM?|dd?|HH?|mm/g, token => { names.push(token[0]); return token.length === 2 ? '(\\d{2})' : '(\\d{1,4})'; });
  const match = new RegExp('^' + source + '$').exec(text);
  return match ? Object.fromEntries(names.map((name, index) => [name, Number(match[index + 1])])) : null;
}

test('every released region, both languages: the amount field types exactly what the formatter writes, keeps the caret, deletes across a group, pastes back and refuses the ambiguous', () => {
  assert.equal(RELEASED_REGIONS.length, 234);
  for (const region of RELEASED_REGIONS) for (const language of ['es', 'en'] as const) {
    const i = bindLocale(composeLocale(language, region));
    const c = REGIONS[region];
    const label = `${language}-${region} (${numberFamily(region)})`;
    // Typing 1234567 and the pad's decimal key (either kind) then 89: the formatter's own string, the caret at its end.
    for (const decimalKey of ['.', ',']) {
      const input = new AmountInput('', i.amountFormat, 'ARS');
      type(input, `1234567${decimalKey}89`);
      assert.equal(input.view.text, i.formatMoneyAmount(123456789, 'ARS'), label);
      assert.equal(input.view.caret, input.view.text.length, label);
      assert.equal(input.draft, '1.234.567,89', 'the ledger notation, whatever the region');
      assert.equal(parseMinorUnits(input.draft), 123456789, label);
    }
    // Separators: the group character appears exactly where the region's grouping puts it.
    assert.equal(i.formatMoneyAmount(123456, 'ARS'), groupWhole('1234', c.group, c) + c.decimal + '56', label);
    assert.equal(i.formatMoneyAmount(-100000000, 'ARS'), '-' + groupWhole('1000000', c.group, c) + c.decimal + '00', label);
    // Deleting the group separator before the last group removes the digit before it, and the caret stays there.
    const input = new AmountInput('1.234.567', i.amountFormat, 'ARS');
    const at = input.view.text.lastIndexOf(c.group);
    const result = input.change(input.view.text.slice(0, at) + input.view.text.slice(at + 1), at);
    assert.equal(input.draft, '123.567', label);
    assert.equal(result.view.text.slice(0, result.view.caret).replace(/\D/g, ''), '123', label + ': the caret after the remaining "123"');
    // The formatter's string pasted back is the same amount; a lone decimal separator before three digits is refused.
    for (const minor of [5, 123456, 100000, 999999999999]) {
      const pasted = readPastedAmount(i.formatMoneyAmount(minor, 'ARS'), i.amountFormat, 'ARS');
      assert.ok(pasted.ok && parseMinorUnits(pasted.canonical) === minor, `${label} ${minor}`);
    }
    const refused = readPastedAmount(`1${c.decimal}000`, i.amountFormat, 'ARS');
    assert.deepEqual(refused.ok ? 'accepted' : refused.reason, 'ambiguous', label);
    // Currencies keep their own decimals in every region.
    assert.equal(i.formatMoneyAmount(150000, 'JPY'), groupWhole('150000', c.group, c), label);
    // VoiceOver: ungrouped, the language's own decimal mark, whatever the region writes.
    assert.equal(i.spokenMoney(123456789, 'ARS'), language === 'es' ? '1234567,89 pesos' : '1234567.89 pesos', label);
  }
});

test('every released region, both languages: dates, day and month and the clock read back to the same numbers through the region\'s templates', () => {
  const days = ['2026-01-02', '2026-09-05', '2026-12-25', '2024-02-29'];
  for (const region of RELEASED_REGIONS) for (const language of ['es', 'en'] as const) {
    const i = bindLocale(composeLocale(language, region));
    const c = REGIONS[region];
    const label = `${language}-${region} (${dateFamily(region)})`;
    for (const day of days) {
      const [y, M, d] = day.split('-').map(Number);
      assert.deepEqual(readTemplate(c.datePattern, i.formatNumericDate(day)), { y, M, d }, label);
      assert.deepEqual(readTemplate(c.dayMonthPattern, i.formatDayMonth(day)), { M, d }, label);
    }
    // A day and month never contradicts the region's own day-first or month-first date.
    const fields = (template: string) => template.replace(/[^dMy]/g, '').replace(/(.)\1+/g, '$1');
    if (fields(c.datePattern)[0] !== 'y') assert.equal(fields(c.dayMonthPattern), fields(c.datePattern).replace('y', ''), label);
    // The clock: 24 hours in the region's template, or 12 with the language's day period after the time.
    for (const [iso, hour] of [['2026-09-22T09:03:00', 9], ['2026-09-22T21:45:00', 21], ['2026-09-22T00:05:00', 0]] as const) {
      const text = i.formatDateTime(iso);
      const date = i.formatNumericDate('2026-09-22');
      assert.ok(text.startsWith(date), label);
      const time = text.slice(date.length).replace(/^(, |\u00A0)/, '');
      if (c.hour12) {
        const period = language === 'en' ? (hour < 12 ? 'AM' : 'PM') : (hour < 12 ? 'a.\u00A0m.' : 'p.\u00A0m.');
        assert.ok(time.endsWith('\u00A0' + period), `${label} ${time}`);
        const clock = readTemplate(c.timePattern.replace(/^HH?/, 'H'), time.slice(0, -(period.length + 1)));
        assert.deepEqual(clock && [clock.H, clock.m], [hour % 12 || 12, Number(iso.slice(14, 16))], `${label} ${time}`);
      } else {
        const clock = readTemplate(c.timePattern, time);
        assert.deepEqual(clock && [clock.H, clock.m], [hour, Number(iso.slice(14, 16))], `${label} ${time}`);
      }
    }
  }
});

test('every released region: the choice is saved before it applies, survives a relaunch, and never follows the device again; language and currency stay untouched', () => {
  const saved = memory();
  let device = { languageTag: 'es-AR', languageCode: 'es', regionCode: 'AR' };
  for (const region of RELEASED_REGIONS) {
    const store = createLocaleStore({ devices: () => ({ source: 'native', locales: [device] }), store: saved.store });
    assert.equal(store.setRegion(region), true, region);
    assert.equal(saved.rows.get(REGION_PREFERENCE_KEY), region);
    device = { languageTag: 'en-GB', languageCode: 'en', regionCode: region === 'JP' ? 'DE' : 'JP' };
    const relaunched = createLocaleStore({ devices: () => ({ source: 'native', locales: [device] }), store: saved.store }).getState();
    assert.deepEqual([relaunched.region, relaunched.preferences.region, relaunched.language], [region, region, 'en'], region + ': manual choice wins; the language follows the device on its own');
    device = { languageTag: 'es-AR', languageCode: 'es', regionCode: 'AR' };
  }
  // "Según el dispositivo": the initial region is the iPhone's Region setting when released.
  for (const region of ['BR', 'JP', 'KR', 'HU', 'IN', 'CH', 'FR', 'PL', 'SE', 'ES', 'GB', 'ZA'] as RegionCode[]) {
    const state = createLocaleStore({ devices: () => ({ source: 'native', locales: [{ languageTag: 'es-AR', regionCode: region }] }), store: memory().store }).getState();
    assert.deepEqual([state.region, state.language], [region, 'es'], region);
  }
  assert.equal(PREVIEW.regions.length - RELEASED_REGIONS.length, 23);
});

test('the iPhone sheet (docs/region-families.md) is the code\'s own output', () => {
  const output = execFileSync(process.execPath, ['--experimental-strip-types', '--no-warnings', new URL('../scripts/regions/families.mjs', import.meta.url).pathname, '--check'], { encoding: 'utf8' });
  assert.match(output, /up to date/);
});

test('no account, ledger or display-currency code reads the region: a region never picks, changes or converts a currency', async () => {
  const { readdirSync, readFileSync } = await import('node:fs');
  const offenders: string[] = [];
  const scan = (path: string) => {
    const url = new URL('../' + path, import.meta.url);
    for (const entry of readdirSync(url, { withFileTypes: true })) {
      const child = path + '/' + entry.name;
      if (entry.isDirectory()) scan(child);
      else if (/\.tsx?$/.test(entry.name) && /regions\/data|REGION_DATA|regionRecord|catalogueConventions|dollarSignCurrency|\bRELEASED_REGIONS\b|\.conventions\b/.test(readFileSync(new URL('../' + child, import.meta.url), 'utf8'))) offenders.push(child);
    }
  };
  scan('src/storage');
  for (const file of ['app/new-account.tsx', 'src/ui/display-currency.ts', 'src/ui/display-currency-provider.tsx', 'src/ui/currencies.ts']) {
    if (/regions\/data|REGION_DATA|dollarSignCurrency|\.region\b|\.conventions\b/.test(readFileSync(new URL('../' + file, import.meta.url), 'utf8'))) offenders.push(file);
  }
  assert.deepEqual(offenders, []);
});
