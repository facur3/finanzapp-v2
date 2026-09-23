/** The locale bound to one object of translator and formatters, the shape
 * components receive. Pure (no React), so the provider stays a thin context
 * and Node can test the binding directly. The translator follows the
 * language; the formatters follow the whole locale (words from the language,
 * separators, date order and clock from the region). The financial values a
 * component formats are still integer minor units from the ledger; only their
 * presentation follows the locale. */
import type { Currency } from '@finanzapp/domain';
import type { LocaleSource } from './device.ts';
import { currencyName, currencySymbol, formatCount, formatDate, formatDateTime, formatMonth, formatPercent, moneyText, spokenMoney, type DateStyle } from './format.ts';
import { languageOf, regionOf, type AppLocale, type LanguageCode, type RegionCode } from './locale.ts';
import { translator, type Translate } from './messages.ts';

export interface I18n {
  locale: AppLocale;
  language: LanguageCode;
  region: RegionCode;
  /** Where the device languages came from this launch: the native module, Intl, or nothing. Diagnostic only. */
  localeSource: LocaleSource;
  t: Translate;
  formatDate: (dateISO: string, style: DateStyle) => string;
  formatMonth: (monthISO: string, style?: 'month' | 'monthYear') => string;
  formatDateTime: (iso: string) => string;
  formatCount: (value: number) => string;
  formatPercent: (fraction: number) => string;
  moneyText: (minor: number, currency: Currency, absolute?: boolean) => string;
  spokenMoney: (minor: number, currency: Currency) => string;
  currencySymbol: (currency: Currency) => string;
  currencyName: (currency: Currency) => string;
}

export function bindLocale(locale: AppLocale, localeSource: LocaleSource = 'none'): I18n {
  return {
    locale, language: languageOf(locale), region: regionOf(locale), localeSource, t: translator(languageOf(locale)),
    formatDate: (dateISO, style) => formatDate(dateISO, style, locale),
    formatMonth: (monthISO, style) => formatMonth(monthISO, locale, style),
    formatDateTime: iso => formatDateTime(iso, locale),
    formatCount: value => formatCount(value, locale),
    formatPercent: fraction => formatPercent(fraction, locale),
    moneyText: (minor, currency, absolute) => moneyText(minor, currency, locale, absolute),
    spokenMoney: (minor, currency) => spokenMoney(minor, currency, locale),
    currencySymbol: currency => currencySymbol(currency, locale),
    currencyName: currency => currencyName(currency, locale),
  };
}
