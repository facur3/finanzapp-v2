/** The locale bound to one object of translator and formatters, the shape
 * components receive. Pure (no React), so the provider stays a thin context
 * and Node can test the binding directly. The translator follows the
 * language; the formatters follow the whole locale (words from the language,
 * separators, date order and clock from the region). The financial values a
 * component formats are still integer minor units from the ledger; only their
 * presentation follows the locale. */
import type { Currency } from '@finanzapp/domain';
import type { LocaleSource } from './device.ts';
import { amountFormat, codedAmount, currencyName, currencySymbol, formatAmount, formatCount, formatDate, formatDateTime, formatDayMonth, formatMonth,
  formatNumericDate, formatPercent, moneyText, pickerLocale, relativeDate, spokenAmount, spokenMoney, spokenNumber, spokenPercent, type DateStyle } from './format.ts';
import { localizeError } from './errors.ts';
import { languageOf, regionOf, type AppLocale, type LanguageCode, type RegionCode } from './locale.ts';
import { translator, type Translate } from './messages.ts';

export interface I18n {
  locale: AppLocale;
  language: LanguageCode;
  region: RegionCode;
  /** Where the device languages came from this launch: the native module, Intl, or nothing. Diagnostic only. */
  localeSource: LocaleSource;
  /** The language VoiceOver should speak the app's own elements in (`accessibilityLanguage`), set only
   * when the interface language differs from the device's first language (English chosen in Más on a
   * Spanish iPhone, or Spanish on a Portuguese one). Undefined when they match, so a person whose
   * device and app agree keeps exactly the voice they chose in iOS Settings. */
  speechLanguage?: LanguageCode;
  t: Translate;
  formatDate: (dateISO: string, style: DateStyle) => string;
  formatMonth: (monthISO: string, style?: 'month' | 'monthYear') => string;
  formatDateTime: (iso: string) => string;
  /** "22/9/2026" or "9/22/2026". */
  formatNumericDate: (dateISO: string) => string;
  /** A day without the year in the region's order: "5/09" or "9/5". */
  formatDayMonth: (dateISO: string) => string;
  formatCount: (value: number) => string;
  formatPercent: (fraction: number) => string;
  /** The number alone in the region's separators ("1.234,56", "1,234.56"); visible text only. */
  formatAmount: (minor: number) => string;
  /** Sign, symbol and number ("−US$ 1.234,56"); `signed` adds "+" to a positive amount. Visible text only. */
  moneyText: (minor: number, currency: Currency, absolute?: boolean, signed?: boolean) => string;
  /** "ARS 1.234,56". */
  codedAmount: (minor: number, currency: Currency) => string;
  /** VoiceOver: the amount with the currency in words ("1234.56 dollars"), the language's decimal mark, no grouping. */
  spokenMoney: (minor: number, currency: Currency) => string;
  /** VoiceOver: the number and its code ("1234,56 ARS"), the language's decimal mark, no grouping. */
  spokenAmount: (minor: number, currency: Currency) => string;
  /** VoiceOver: the number alone, the language's decimal mark, no grouping. */
  spokenNumber: (minor: number) => string;
  /** VoiceOver: a percentage, the language's decimal mark, no grouping. */
  spokenPercent: (fraction: number) => string;
  /** The separators the amount field types in. */
  amountFormat: { decimal: string; group: string };
  /** The date wheel's locale identifier: the language with its home region ("es_AR", "en_US"). */
  pickerLocale: string;
  currencySymbol: (currency: Currency) => string;
  currencyName: (currency: Currency) => string;
  /** "Hoy", "Ayer", "13 jul" relative to `todayISO`; `inline` for a day inside a sentence ("hoy", "ayer"). */
  relativeDate: (dateISO: string, todayISO: string, inline?: boolean) => string;
  /** A caught or stored error message in the interface language (see errors.ts). */
  errorText: (message: string) => string;
}

/** `deviceLanguage` is the primary language subtag of the device's first
 * locale ("es", "en", "pt"), or null when nothing was read. */
export function bindLocale(locale: AppLocale, localeSource: LocaleSource = 'none', deviceLanguage: string | null = null): I18n {
  const language = languageOf(locale);
  return {
    locale, language, region: regionOf(locale), localeSource, t: translator(language),
    speechLanguage: deviceLanguage && deviceLanguage !== language ? language : undefined,
    formatDate: (dateISO, style) => formatDate(dateISO, style, locale),
    formatMonth: (monthISO, style) => formatMonth(monthISO, locale, style),
    formatDateTime: iso => formatDateTime(iso, locale),
    formatNumericDate: dateISO => formatNumericDate(dateISO, locale),
    formatDayMonth: dateISO => formatDayMonth(dateISO, locale),
    formatCount: value => formatCount(value, locale),
    formatPercent: fraction => formatPercent(fraction, locale),
    formatAmount: minor => formatAmount(minor, locale),
    moneyText: (minor, currency, absolute, signed) => moneyText(minor, currency, locale, absolute, signed),
    codedAmount: (minor, currency) => codedAmount(minor, currency, locale),
    spokenMoney: (minor, currency) => spokenMoney(minor, currency, locale),
    spokenAmount: (minor, currency) => spokenAmount(minor, currency, locale),
    spokenNumber: minor => spokenNumber(minor, locale),
    spokenPercent: fraction => spokenPercent(fraction, locale),
    amountFormat: amountFormat(locale),
    pickerLocale: pickerLocale(locale),
    currencySymbol: currency => currencySymbol(currency, locale),
    currencyName: currency => currencyName(currency, locale),
    relativeDate: (dateISO, todayISO, inline) => relativeDate(dateISO, todayISO, locale, inline),
    errorText: message => localizeError(language, message),
  };
}
