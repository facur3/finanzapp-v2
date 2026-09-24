import type { Currency } from '@finanzapp/domain';
import { currencyName, currencySymbol } from '../i18n/format.ts';
import { DEFAULT_LOCALE, type AppLocale } from '../i18n/locale.ts';

/** The currencies an account can be created in. The financial engine stores
 * integer minor units in ARS and USD only, so these are the two choices; the
 * list shape (code, name, symbol, search text) is what a future searchable
 * currency screen will page through when more currencies arrive with their
 * dated exchange rates. Nothing here fakes a currency the ledger cannot hold.
 * The code is the currency's own; the name follows the interface language and
 * the symbol the region (a bare "$" is the peso in Argentina and the dollar in
 * the United States, so the other one carries its prefix). */
export type CurrencyOption = { code: Currency; name: string; symbol: string };

const CODES: readonly Currency[] = ['ARS', 'USD'];

export function currencyOptions(locale: AppLocale = DEFAULT_LOCALE): CurrencyOption[] {
  return CODES.map(code => ({ code, symbol: currencySymbol(code, locale), name: currencyName(code, locale) }));
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
