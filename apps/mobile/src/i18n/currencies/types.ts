import type { IsoCurrencyCode } from '@finanzapp/domain';

/** CLDR's names for one currency in one language: the display name ("peso argentino"), the form
 * used with a count of one ("peso argentino") and with any other count ("pesos argentinos"). */
export interface CurrencyNameForms { readonly name: string; readonly one: string; readonly other: string }

/** One language's generated currency data (src/i18n/currencies/<language>.ts). A currency CLDR does
 * not name in this language is absent (its catalogue status is then `incomplete`), never filled in
 * with another language's name. Territory names (ISO 3166 region → name) serve search only. */
export interface CurrencyNames {
  readonly currencies: { readonly [Code in IsoCurrencyCode]?: CurrencyNameForms };
  readonly territories: { readonly [region: string]: string };
}
