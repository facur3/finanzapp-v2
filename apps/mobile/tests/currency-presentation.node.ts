import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { LEDGER_CURRENCIES, currenciesWithStatus, formatMinorUnits, type Currency, type IsoCurrencyCode } from '@finanzapp/domain';
import { bindLocale } from '../src/i18n/bind.ts';
import { codedAmount, currencyName, currencyNameForms, currencySymbol, formatAmount, formatMoneyAmount, moneyText, speechLocale, spokenAmount,
  spokenMinor, spokenMoney, spokenNumber } from '../src/i18n/format.ts';
import { conventionsOf, languageOf, type AppLocale } from '../src/i18n/locale.ts';
import { sourceFiles } from '../scripts/i18n/lib.mjs';
import { CURRENCIES, catalogueCurrencies, currencyOption, currencyOptions, searchCatalogue, searchCurrencies } from '../src/ui/currencies.ts';

// Producto 24A moves money presentation onto the catalogue (the currency's own decimals, CLDR
// symbols and names). ARS and USD must read exactly as before: the functions below are the
// pre-24A implementations, copied verbatim from master (997b3b8…1181ed1), and every output is
// compared with the new code over a corpus of amounts in the four released locales.
const NBSP = ' ';
const legacy = {
  currencySymbol(currency: Currency, locale: AppLocale): string {
    if (currency === 'USD') return 'US$';
    return conventionsOf(locale).dollarSignCurrency === currency ? '$' : 'AR$';
  },
  formatAmount(minor: number, locale: AppLocale): string {
    const text = formatMinorUnits(minor);
    const { decimal, group } = conventionsOf(locale);
    if (decimal === ',' && group === '.') return text;
    return text.replace(/[.,]/g, char => char === '.' ? group : decimal);
  },
  moneyText(minor: number, currency: Currency, locale: AppLocale, absolute = false, signed = false): string {
    const value = absolute ? Math.abs(minor) : minor;
    const sign = value < 0 ? '−' : signed && value > 0 ? '+' : '';
    return sign + legacy.currencySymbol(currency, locale) + NBSP + legacy.formatAmount(Math.abs(value), locale);
  },
  codedAmount(minor: number, currency: Currency, locale: AppLocale): string {
    return currency + NBSP + legacy.formatAmount(minor, locale);
  },
  spokenNumber(minor: number, locale: AppLocale): string {
    return formatMinorUnits(minor).replace(/\./g, '').replace(',', conventionsOf(speechLocale(locale)).decimal);
  },
  spokenAmount(minor: number, currency: Currency, locale: AppLocale): string {
    return legacy.spokenNumber(minor, locale) + ' ' + currency;
  },
  spokenMoney(minor: number, currency: Currency, locale: AppLocale): string {
    const en = languageOf(locale) === 'en';
    const unit = currency === 'USD' ? (en ? 'dollars' : 'dólares') : 'pesos';
    return (minor < 0 ? (en ? 'Minus ' : 'Menos ') : '') + legacy.spokenNumber(Math.abs(minor), locale) + ' ' + unit;
  },
  currencyName(currency: Currency, locale: AppLocale): string {
    const en = languageOf(locale) === 'en';
    return currency === 'USD' ? (en ? 'US dollars' : 'Dólares estadounidenses') : (en ? 'Argentine pesos' : 'Pesos argentinos');
  },
};

const LOCALES: AppLocale[] = ['es-AR', 'en-AR', 'es-US', 'en-US'];
/** Deterministic pseudo-random safe integers (a linear congruential sequence), plus the edges. */
function corpus(): number[] {
  const values = [0, 1, -1, 5, 9, 10, 50, 99, 100, 101, 999, 1000, 99999, 100000, 123456, -123456, 100000000, 999999999999999,
    -999999999999999, 1000000000000000, Number.MAX_SAFE_INTEGER, -Number.MAX_SAFE_INTEGER, 2 ** 31, 2 ** 32 + 7];
  for (let power = 1, index = 0; index < 16; index++, power *= 10) values.push(power, power - 1, -power, power + 1);
  let seed = 20260924n;
  for (let index = 0; index < 400; index++) {
    seed = (seed * 6364136223846793005n + 1442695040888963407n) % (1n << 64n);
    const value = Number(seed % BigInt(Number.MAX_SAFE_INTEGER));
    values.push(index % 2 ? value : -value, Number(seed % 100000000n));
  }
  return values;
}

test('ARS and USD read exactly as before 24A: symbols, amounts, codes, VoiceOver and names, in the four locales', () => {
  let compared = 0;
  for (const locale of LOCALES) for (const currency of ['ARS', 'USD'] as const) {
    assert.equal(currencySymbol(currency, locale), legacy.currencySymbol(currency, locale), `${currency} ${locale}`);
    assert.equal(currencyName(currency, locale), legacy.currencyName(currency, locale), `${currency} ${locale}`);
    for (const minor of corpus()) {
      const where = `${minor} ${currency} ${locale}`;
      assert.equal(formatMoneyAmount(minor, currency, locale), legacy.formatAmount(minor, locale), where);
      assert.equal(formatAmount(minor, locale), legacy.formatAmount(minor, locale), where);
      for (const [absolute, signed] of [[false, false], [true, false], [false, true], [true, true]]) {
        assert.equal(moneyText(minor, currency, locale, absolute, signed), legacy.moneyText(minor, currency, locale, absolute, signed), where);
      }
      assert.equal(codedAmount(minor, currency, locale), legacy.codedAmount(minor, currency, locale), where);
      assert.equal(spokenNumber(minor, locale), legacy.spokenNumber(minor, locale), where);
      assert.equal(spokenMinor(minor, currency, locale), legacy.spokenNumber(minor, locale), where);
      assert.equal(spokenAmount(minor, currency, locale), legacy.spokenAmount(minor, currency, locale), where);
      assert.equal(spokenMoney(minor, currency, locale), legacy.spokenMoney(minor, currency, locale), where);
      compared++;
    }
  }
  assert.ok(compared > 3000, `compared ${compared} amounts`);
  // An unsafe amount is refused exactly as before.
  for (const bad of [Number.MAX_SAFE_INTEGER + 1, 0.5, NaN]) {
    assert.throws(() => moneyText(bad, 'ARS', 'es-AR'), /Monto inválido/);
    assert.throws(() => legacy.moneyText(bad, 'ARS', 'es-AR'), /Monto inválido/);
  }
});

test('other currencies show their own decimals, never rounded, in the region\'s separators', () => {
  const cases: [number, IsoCurrencyCode, string, string][] = [
    [150000, 'JPY', 'JP¥ 150.000', 'JP¥ 150,000'],
    [-1, 'JPY', '−JP¥ 1', '−JP¥ 1'],
    [1234567, 'KWD', 'KWD 1.234,567', 'KWD 1,234.567'],
    [5, 'KWD', 'KWD 0,005', 'KWD 0.005'],
    [1500000, 'IQD', 'IQD 1.500', 'IQD 1,500'], // ISO 3 decimals, CLDR shows none
    [1500500, 'IQD', 'IQD 1.500,5', 'IQD 1,500.5'], // …but a recorded fraction is never hidden
    [1500001, 'IQD', 'IQD 1.500,001', 'IQD 1,500.001'],
    [99, 'EUR', '€ 0,99', '€ 0.99'],
    [123456, 'GBP', '£ 1.234,56', '£ 1,234.56'],
    [123456, 'CAD', 'CA$ 1.234,56', 'CA$ 1,234.56'],
    [123456, 'MXN', 'MX$ 1.234,56', 'MX$ 1,234.56'],
    [123456, 'BRL', 'R$ 1.234,56', 'R$ 1,234.56'],
    [1000, 'CLP', 'CLP 1.000', 'CLP 1,000'],
    [12345, 'CLF', 'CLF 1,2345', 'CLF 1.2345'], // four decimals (a fund: formatted, never offered)
    [Number.MAX_SAFE_INTEGER, 'JPY', 'JP¥ 9.007.199.254.740.991', 'JP¥ 9,007,199,254,740,991'],
  ];
  for (const [minor, currency, ar, us] of cases) {
    assert.equal(moneyText(minor, currency, 'es-AR'), ar.replace(' ', NBSP), `${currency} es-AR`);
    assert.equal(moneyText(minor, currency, 'en-US'), us.replace(' ', NBSP), `${currency} en-US`);
    assert.equal(moneyText(minor, currency, 'en-AR'), ar.replace(' ', NBSP), 'the region decides, not the language');
  }
  assert.equal(codedAmount(1234567, 'KWD', 'es-AR'), 'KWD' + NBSP + '1.234,567');
  assert.equal(formatMoneyAmount(-150000, 'JPY', 'es-AR'), '-150.000');
  assert.throws(() => moneyText(1, 'XAU', 'es-AR'), /Moneda no admitida/);
});

test('a symbol never depends on the language and names one currency; a bare "$" is only the peso in Argentina', () => {
  const shown = new Map<string, string>();
  for (const code of currenciesWithStatus('ledger', 'ready', 'incomplete')) {
    const ar = currencySymbol(code, 'es-AR'), us = currencySymbol(code, 'en-US');
    assert.equal(currencySymbol(code, 'en-AR'), ar);
    assert.equal(currencySymbol(code, 'es-US'), us);
    if (code !== 'ARS') assert.equal(ar, us, `${code}: only the peso changes with the region`);
    if (ar === '$') assert.equal(code, 'ARS');
    assert.ok(!shown.has(us) || us === code, `${us} would name ${shown.get(us)} and ${code}`);
    shown.set(us, code);
  }
  assert.equal(currencySymbol('ARS', 'es-AR'), '$');
  assert.equal(currencySymbol('ARS', 'en-US'), 'AR$');
  assert.equal(currencySymbol('USD', 'en-US'), 'US$', 'the dollar keeps its prefix even in the United States');
});

test('names and spoken units come from CLDR in the interface language, never from another language', () => {
  assert.equal(currencyName('JPY', 'es-AR'), 'Yenes japoneses');
  assert.equal(currencyName('JPY', 'en-US'), 'Japanese yen');
  assert.equal(currencyName('EUR', 'es-US'), 'Euros');
  assert.equal(currencyName('KWD', 'en-AR'), 'Kuwaiti dinars');
  assert.equal(currencyName('VED', 'es-AR'), 'VED', 'CLDR has no Spanish name: the code, not the English name');
  assert.equal(currencyNameForms('VED', 'es'), null);
  assert.equal(spokenMoney(1, 'JPY', 'es-AR'), '1 yen japonés', 'one unit of a currency without decimals');
  assert.equal(spokenMoney(1000, 'IQD', 'es-AR'), '1 dinar iraquí', 'one dinar: three ISO decimals shown down to none');
  assert.equal(spokenMoney(1500, 'IQD', 'en-US'), '1.5 Iraqi dinars');
  assert.equal(spokenMoney(100, 'COP', 'es-AR'), '1 peso colombiano');
  assert.equal(spokenMoney(101, 'COP', 'es-AR'), '1,01 pesos colombianos');
  assert.equal(spokenMoney(100, 'USD', 'es-AR'), '1,00 dólares', 'ARS and USD keep their two decimals and their words');
  assert.equal(spokenMoney(2, 'JPY', 'es-AR'), '2 yenes japoneses');
  assert.equal(spokenMoney(-150000, 'JPY', 'en-US'), 'Minus 150000 Japanese yen');
  assert.equal(spokenMoney(1234567, 'KWD', 'es-AR'), '1234,567 dinares kuwaitíes');
  assert.equal(spokenMoney(1234567, 'KWD', 'en-AR'), '1234.567 Kuwaiti dinars', 'VoiceOver uses the language\'s decimal mark');
  assert.equal(spokenMoney(100, 'EUR', 'es-US'), '1,00 euros');
  assert.equal(spokenMoney(100, 'VED', 'es-AR'), '1,00 VED');
  assert.equal(spokenAmount(1500500, 'IQD', 'es-AR'), '1500,5 IQD');
  assert.equal(spokenMinor(1500000, 'IQD', 'en-US'), '1500');
  for (const minor of [7, 1000000, -123456789]) for (const locale of LOCALES) {
    assert.ok(!/[.,]\d{3}(?!\d)/.test(spokenMinor(minor, 'USD', locale)), 'no group separator is ever spoken');
  }
});

test('forms still offer exactly ARS and USD; the catalogue is prepared for the currency screen, not shown', () => {
  for (const locale of LOCALES) {
    assert.deepEqual(currencyOptions(locale).map(option => option.code), ['ARS', 'USD']);
    assert.deepEqual(currencyOptions(locale).map(option => option.name), LEDGER_CURRENCIES.map(code => legacy.currencyName(code, locale)));
    assert.deepEqual(currencyOptions(locale).map(option => option.symbol), LEDGER_CURRENCIES.map(code => legacy.currencySymbol(code, locale)));
  }
  assert.deepEqual(CURRENCIES.map(option => option.code), ['ARS', 'USD']);
  assert.equal(currencyOption('EUR').code, 'ARS', 'an unknown or unreleased code never becomes a choice');
  assert.deepEqual(searchCurrencies('euro').map(option => option.code), []);
  assert.deepEqual(searchCurrencies('dól').map(option => option.code), ['USD']);

  const all = catalogueCurrencies('es-AR');
  assert.equal(all.length, currenciesWithStatus('ledger', 'ready').length);
  assert.deepEqual(all.slice(0, 2).map(item => item.code), ['USD', 'ARS'], 'the ledger\'s currencies first, by name');
  assert.ok(!all.some(item => item.status === 'excluded' || item.status === 'incomplete'));
  assert.deepEqual(catalogueCurrencies('es-AR', ['incomplete']).map(item => item.code), ['SVC', 'VED']);
  const excluded = catalogueCurrencies('en-US', ['excluded']);
  assert.equal(excluded.length, 23, 'a review list can include the excluded codes');
  assert.equal(excluded.find(item => item.code === 'XAU')?.exponent, null, 'gold has no minor unit');
  assert.equal(excluded.find(item => item.code === 'CLF')?.exponent, 4);
  const byCode = (code: string) => all.find(item => item.code === code)!;
  assert.deepEqual({ ...byCode('KWD'), searchText: undefined },
    { code: 'KWD', numeric: '414', status: 'ready', exponent: 3, name: 'Dinares kuwaitíes', symbol: 'KWD', territories: ['KW'], searchText: undefined });
  const find = (query: string, locale: AppLocale = 'es-AR') => searchCatalogue(query, catalogueCurrencies(locale)).map(item => item.code);
  assert.equal(find('usd')[0], 'USD', 'an exact code first');
  assert.equal(find('eur')[0], 'EUR');
  assert.ok(find('argentina').includes('ARS'), 'a territory name finds its currency');
  assert.ok(find('españa').includes('EUR'));
  assert.ok(find('spain', 'en-US').includes('EUR'));
  assert.ok(!find('spain').includes('EUR'), 'territory names are the interface language\'s');
  assert.ok(find('yen').includes('JPY'));
  assert.ok(find('YÉN').includes('JPY'), 'accent- and case-insensitive');
  assert.ok(find('€').includes('EUR'));
  assert.ok(find('840').includes('USD'));
  assert.deepEqual(find('zzzz'), []);
  assert.equal(find('').length, all.length);

  // Prepared only: no screen or component reaches the catalogue in 24A.
  const users = sourceFiles('app', 'src/ui').filter((file: string) => file !== 'src/ui/currencies.ts')
    .filter((file: string) => /catalogueCurrencies|searchCatalogue|currenciesWithStatus/.test(readFileSync(new URL('../' + file, import.meta.url), 'utf8')));
  assert.deepEqual(users, []);
});

test('the bound locale exposes the currency-aware formatter, and the region never changes a currency', () => {
  const ar = bindLocale('es-AR'), us = bindLocale('en-US');
  assert.equal(ar.formatMoneyAmount(1234567, 'KWD'), '1.234,567');
  assert.equal(us.formatMoneyAmount(1234567, 'KWD'), '1,234.567');
  assert.equal(ar.moneyText(150000, 'JPY'), 'JP¥' + NBSP + '150.000');
  assert.equal(us.currencyName('EUR'), 'Euros');
  // The same stored amount in the same currency, four ways: only separators and words move.
  for (const locale of LOCALES) {
    const digits = formatMoneyAmount(1234567, 'KWD', locale).replace(/\D/g, '');
    assert.equal(digits, '1234567', locale);
  }
});
