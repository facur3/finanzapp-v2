import type { Currency } from '@finanzapp/domain';

/** The currencies an account can be created in. The financial engine stores
 * integer minor units in ARS and USD only, so these are the two choices; the
 * list shape (code, name, symbol, search text) is what a future searchable
 * currency screen will page through when more currencies arrive with their
 * dated exchange rates. Nothing here fakes a currency the ledger cannot hold. */
export type CurrencyOption = { code: Currency; name: string; symbol: string };

export const CURRENCIES: readonly CurrencyOption[] = [
  { code: 'ARS', name: 'Pesos argentinos', symbol: '$' },
  { code: 'USD', name: 'Dólares estadounidenses', symbol: 'US$' },
];

export function currencyOption(code: string): CurrencyOption {
  return CURRENCIES.find(option => option.code === code) ?? CURRENCIES[0];
}

const fold = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** Filter by code or name, accent- and case-insensitive; an empty query lists everything. */
export function searchCurrencies(query: string, options: readonly CurrencyOption[] = CURRENCIES): CurrencyOption[] {
  const needle = fold(query);
  if (!needle) return [...options];
  return options.filter(option => fold(option.code).includes(needle) || fold(option.name).includes(needle));
}
