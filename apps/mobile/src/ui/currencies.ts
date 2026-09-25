import { CURRENCY_CODES, LEDGER_CURRENCIES, LEGACY_CURRENCIES, currencyRecord, currencyStatus, hasMinorUnit, isIsoCurrencyCode, minorUnitExponent, type Currency, type CurrencyGate,
  type CurrencyStatus, type IsoCurrencyCode, type LegacyCurrency } from '@finanzapp/domain';
import { CURRENCY_NAMES } from '../i18n/currencies/index.ts';
import { currencyName, currencyNameForms, currencySymbol } from '../i18n/format.ts';
import { DEFAULT_LOCALE, languageOf, type AppLocale } from '../i18n/locale.ts';
import { nameComparator } from '../i18n/intl-support.ts';
import type { MessageKey, Translate } from '../i18n/messages.ts';

/** The short words FinanzApp has always shown for its first two currencies in a chooser ("Pesos", "Dólares"),
 * a lookup keyed by code (never a two-way condition); every other currency takes CLDR's plural name. */
const SHORT_NAME_KEYS: { readonly [Code in LegacyCurrency]: MessageKey } = { ARS: 'currency.short.ARS', USD: 'currency.short.USD' };

/** "Pesos · ARS", "Dólares · USD", "Yenes japoneses · JPY": one catalogue template (`currency.option`) for every
 * currency a switch or a segmented control names, so no screen writes a per-currency label. */
export function currencyOptionLabel(currency: Currency, t: Translate, locale: AppLocale = DEFAULT_LOCALE): string {
  const short = (SHORT_NAME_KEYS as { readonly [Code in Currency]?: MessageKey })[currency];
  return t('currency.option', { name: short ? t(short) : currencyName(currency, locale), code: currency });
}

/** How a screen lets the person choose among `count` currencies: the segmented control keeps its two-segment
 * layout (one or two currencies); from three on, segments would shrink below a readable width, so a row that
 * opens the currency sheet takes its place (docs/currency.md §7.5, stage 4). */
export function currencySwitchMode(count: number): 'segments' | 'picker' {
  return count <= 2 ? 'segments' : 'picker';
}

/** The currencies an account, card, debt or budget can be created in: the gate's (the release's
 * ARS and USD, `LEDGER_CURRENCIES`, or the preview set of a development build, `src/storage/
 * currency-gate.ts`), never a code the ledger cannot store. The code is the currency's own; the
 * name follows the interface language and the symbol the region (a bare "$" is the peso in
 * Argentina; elsewhere it carries its prefix). */
export type CurrencyOption = { code: Currency; name: string; symbol: string };
/** An option the sheet can search: `searchText` folds the code, numeric code, names, symbols and territories (the catalogue's). */
export type CurrencyChoice = CurrencyOption & { searchText?: string };

export function currencyOptions(locale: AppLocale = DEFAULT_LOCALE, gate: CurrencyGate = LEDGER_CURRENCIES): CurrencyOption[] {
  return gate.map(code => ({ code, symbol: currencySymbol(code, locale), name: currencyName(code, locale) }));
}
export const CURRENCIES: readonly CurrencyOption[] = currencyOptions();
/** The codes a new account, card, debt or budget may take, in the order a chooser lists them: ARS and USD first (the
 * currencies every earlier ledger holds), then the rest by their name in the interface language (24M: 146 currencies,
 * so an order by code would bury "Euros" under "EUR" between "ETB" and "FJD"). Nothing is dropped or added. */
export function offeredCurrencies(gate: CurrencyGate = LEDGER_CURRENCIES, locale: AppLocale = DEFAULT_LOCALE): Currency[] {
  const { compare } = nameComparator(languageOf(locale));
  const rank = (code: Currency) => { const index = (LEGACY_CURRENCIES as readonly string[]).indexOf(code); return index === -1 ? LEGACY_CURRENCIES.length : index; };
  const named = gate.map(code => ({ code, name: currencyName(code, locale) }));
  return named.sort((a, b) => rank(a.code) - rank(b.code) || compare(a.name, b.name) || (a.code < b.code ? -1 : 1)).map(item => item.code);
}

/** A display lookup over the whole catalogue (24B5): the name and symbol of any code the ledger can
 * store, gated or not, so a read-only row (the currency of an existing account) shows a stored EUR as
 * "Euros · EUR · €", never as ARS. A code the catalogue does not know shows itself. */
export function currencyOption(code: string, locale: AppLocale = DEFAULT_LOCALE): CurrencyOption {
  if (isIsoCurrencyCode(code) && hasMinorUnit(code)) return { code, symbol: currencySymbol(code, locale), name: currencyName(code, locale) };
  return { code: code as Currency, symbol: code, name: code };
}

/** A list this long gets a search field in the sheet: fewer fit on one screen without scrolling at the default text size. */
export const SEARCHABLE_FROM = 6;

/** The choices a sheet lists for a set of codes, in the order given (a gate's, or the currencies held):
 * the catalogue's name, symbol and search text (code, numeric code, the language's names, symbols,
 * territory codes and names), so "yen", "japón", "€" or "840" find their currency. */
export function currencyChoices(codes: readonly Currency[], locale: AppLocale = DEFAULT_LOCALE): CurrencyChoice[] {
  const language = languageOf(locale);
  const territoryNames = CURRENCY_NAMES[language].territories;
  return codes.map(code => {
    const option = currencyOption(code, locale);
    if (!isIsoCurrencyCode(code)) return option;
    const record = currencyRecord(code);
    const forms = currencyNameForms(code, language);
    const words = [code, record.numeric, option.name, forms?.name, forms?.one, forms?.other, option.symbol, record.symbol, record.narrowSymbol,
      ...record.territories, ...record.territories.map(region => territoryNames[region])];
    return { ...option, searchText: fold(words.filter(Boolean).join(' ')) };
  });
}

/** Search for a sheet: an exact code first ("usd"), then codes that start with the query, then names that
 * start with it, then any other match in the search text (a territory, a symbol, part of a name);
 * accent- and case-insensitive; the order of the list is kept within a rank. An empty query lists all. */
export function searchChoices<T extends CurrencyChoice>(query: string, choices: readonly T[]): T[] {
  const needle = fold(query);
  if (!needle) return [...choices];
  const score = (item: T) => {
    const code = item.code.toLowerCase();
    if (code === needle) return 0;
    if (code.startsWith(needle)) return 1;
    if (fold(item.name).startsWith(needle)) return 2;
    return (item.searchText ?? fold(item.code + ' ' + item.name)).includes(needle) ? 3 : -1;
  };
  return choices.map((item, index) => ({ item, index, score: score(item) })).filter(entry => entry.score >= 0)
    .sort((a, b) => a.score - b.score || a.index - b.index).map(entry => entry.item);
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
  statuses: readonly CurrencyStatus[] = ['ledger', 'ready'], gate: CurrencyGate = LEDGER_CURRENCIES): CatalogueCurrency[] {
  const language = languageOf(locale);
  const territoryNames = CURRENCY_NAMES[language].territories;
  const list = CURRENCY_CODES.filter(code => statuses.includes(currencyStatus(code, gate))).map(code => {
    const record = currencyRecord(code);
    const forms = currencyNameForms(code, language);
    const name = currencyName(code, locale);
    const symbol = currencySymbol(code, locale);
    const words = [code, record.numeric, name, forms?.name, forms?.one, forms?.other, symbol, record.symbol, record.narrowSymbol,
      ...record.territories, ...record.territories.map(region => territoryNames[region])];
    return { code, numeric: record.numeric, status: currencyStatus(code, gate), exponent: hasMinorUnit(code) ? minorUnitExponent(code) : null, name, symbol,
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
