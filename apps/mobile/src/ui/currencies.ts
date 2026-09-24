import { CURRENCY_CODES, LEDGER_CURRENCIES, currencyRecord, currencyStatus, hasMinorUnit, minorUnitExponent, type Currency, type CurrencyStatus,
  type IsoCurrencyCode } from '@finanzapp/domain';
import { CURRENCY_NAMES } from '../i18n/currencies/index.ts';
import { currencyName, currencyNameForms, currencySymbol } from '../i18n/format.ts';
import { DEFAULT_LOCALE, languageOf, type AppLocale } from '../i18n/locale.ts';

/** The currencies an account can be created in: exactly the ledger's (ARS and USD,
 * `LEDGER_CURRENCIES`). Storage keeps integer minor units in those two only, so a form
 * offers nothing else until Producto 24B makes storage currency-aware; the catalogue
 * below already describes every ISO 4217 currency for that searchable screen. Nothing
 * here fakes a currency the ledger cannot hold. The code is the currency's own; the
 * name follows the interface language and the symbol the region (a bare "$" is the
 * peso in Argentina; elsewhere it carries its prefix). */
export type CurrencyOption = { code: Currency; name: string; symbol: string };

export function currencyOptions(locale: AppLocale = DEFAULT_LOCALE): CurrencyOption[] {
  return LEDGER_CURRENCIES.map(code => ({ code, symbol: currencySymbol(code, locale), name: currencyName(code, locale) }));
}
export const CURRENCIES: readonly CurrencyOption[] = currencyOptions();

export function currencyOption(code: string, locale: AppLocale = DEFAULT_LOCALE): CurrencyOption {
  const options = currencyOptions(locale);
  return options.find(option => option.code === code) ?? options[0];
}

const fold = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** Filter by code or name, accent- and case-insensitive; an empty query lists everything. */
export function searchCurrencies(query: string, options: readonly CurrencyOption[] = CURRENCIES): CurrencyOption[] {
  const needle = fold(query);
  if (!needle) return [...options];
  return options.filter(option => fold(option.code).includes(needle) || fold(option.name).includes(needle));
}

/** One currency as the future searchable currency screen (Producto 24B) lists it.
 * Prepared data only: no screen shows it in 24A, and a currency whose status is not
 * `ledger` must not be offered by a form before storage can hold it. */
export interface CatalogueCurrency {
  code: IsoCurrencyCode;
  /** ISO 4217 numeric code ("032"). */
  numeric: string;
  status: CurrencyStatus;
  /** Decimal places of the minor unit (JPY 0, USD 2, KWD 3); null for an excluded code without one (XAU, XDR, XXX). */
  exponent: number | null;
  /** Plural name in the interface language ("Pesos argentinos"), or the code when CLDR has none. */
  name: string;
  /** What an amount shows ("$", "US$", "€", "JP¥", "KWD"), following the region. */
  symbol: string;
  /** ISO 3166 regions where it is legal tender (CLDR). A hint for search, never a default: the region is not the currency. */
  territories: readonly string[];
  /** Folded search text: code, numeric code, the language's names, symbols, territory codes and names. */
  searchText: string;
}

/** Every ISO 4217 code with one of `statuses` (the ledger's and the ready ones by default;
 * `incomplete` and `excluded` only when asked for, e.g. by a review screen), described in
 * the locale: ledger currencies first, then by folded name. */
export function catalogueCurrencies(locale: AppLocale = DEFAULT_LOCALE,
  statuses: readonly CurrencyStatus[] = ['ledger', 'ready']): CatalogueCurrency[] {
  const language = languageOf(locale);
  const territoryNames = CURRENCY_NAMES[language].territories;
  const list = CURRENCY_CODES.filter(code => statuses.includes(currencyStatus(code))).map(code => {
    const record = currencyRecord(code);
    const forms = currencyNameForms(code, language);
    const name = currencyName(code, locale);
    const symbol = currencySymbol(code, locale);
    const words = [code, record.numeric, name, forms?.name, forms?.one, forms?.other, symbol, record.symbol, record.narrowSymbol,
      ...record.territories, ...record.territories.map(region => territoryNames[region])];
    return { code, numeric: record.numeric, status: currencyStatus(code), exponent: hasMinorUnit(code) ? minorUnitExponent(code) : null, name, symbol,
      territories: record.territories, searchText: fold(words.filter(Boolean).join(' ')) };
  });
  const rank = (item: CatalogueCurrency) => item.status === 'ledger' ? 0 : 1;
  return list.sort((a, b) => rank(a) - rank(b) || (fold(a.name) < fold(b.name) ? -1 : fold(a.name) > fold(b.name) ? 1 : a.code < b.code ? -1 : 1));
}

/** Search for the currency screen: an exact code first ("usd"), then codes that start
 * with the query, then names that start with it, then any other match (a territory, a
 * symbol, part of a name); accent- and case-insensitive. An empty query lists everything. */
export function searchCatalogue(query: string, currencies: readonly CatalogueCurrency[]): CatalogueCurrency[] {
  const needle = fold(query);
  if (!needle) return [...currencies];
  const score = (item: CatalogueCurrency) => {
    const code = item.code.toLowerCase();
    if (code === needle) return 0;
    if (code.startsWith(needle)) return 1;
    if (fold(item.name).startsWith(needle)) return 2;
    return item.searchText.includes(needle) ? 3 : -1;
  };
  return currencies.map((item, index) => ({ item, index, score: score(item) })).filter(entry => entry.score >= 0)
    .sort((a, b) => a.score - b.score || a.index - b.index).map(entry => entry.item);
}
