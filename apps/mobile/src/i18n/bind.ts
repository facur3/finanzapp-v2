/** The locale bound to one object of translator and formatters, the shape
 * components receive. Pure (no React), so the provider stays a thin context
 * and Node can test the binding directly. The translator follows the
 * language; the formatters follow the whole locale (words from the language,
 * separators, date order and clock from the region). The financial values a
 * component formats are still integer minor units from the ledger; only their
 * presentation follows the locale. */
import type { IsoCurrencyCode } from '@finanzapp/domain';
import type { LocaleSource } from './device.ts';
import { amountFormat, codedAmount, currencyName, currencySymbol, currencyUnit, formatCount, formatMoneyAmount, formatDate, formatDateTime, formatDayMonth, formatMonth, formatMonthTitle,
  formatNumericDate, formatPercent, formatWholeUnits, moneyText, pickerLocale, relativeDate, spokenAmount, spokenMinor, spokenMoney, spokenPercent, type DateStyle,
  type HeldCurrencies, type RegionAmountFormat } from './format.ts';
import { localizeError } from './errors.ts';
import { completeConventions, conventionsOf, languageOf, regionOf, type AppLocale, type LanguageCode, type RegionCode, type RegionConventions } from './locale.ts';
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
  /** The month as a heading: first letter raised only (24UX5 review). */
  formatMonthTitle: (monthISO: string, style?: 'month' | 'monthYear') => string;
  formatDateTime: (iso: string) => string;
  /** "22/9/2026" or "9/22/2026". */
  formatNumericDate: (dateISO: string) => string;
  /** A day without the year in the region's order: "5/09" or "9/5". */
  formatDayMonth: (dateISO: string) => string;
  formatCount: (value: number) => string;
  formatPercent: (fraction: number) => string;
  /** The number alone with the currency's own decimals ("1.234,56" ARS, "1.500" JPY, "1.234,567" KWD) in the region's separators; visible text only (Producto 24A). */
  formatMoneyAmount: (minor: number, currency: IsoCurrencyCode) => string;
  /** The amount rounded to whole units of its currency, grouped ("1.234.568"): a chart's scale caption, never a ledger figure. */
  formatWholeUnits: (minor: number, currency: IsoCurrencyCode) => string;
  /** Sign, symbol and number ("−US$ 1.234,56"); `signed` adds "+" to a positive amount. Visible text only. */
  moneyText: (minor: number, currency: IsoCurrencyCode, absolute?: boolean, signed?: boolean) => string;
  /** "ARS 1.234,56". */
  codedAmount: (minor: number, currency: IsoCurrencyCode) => string;
  /** VoiceOver: the amount with the currency in words ("1234.56 dollars"), the language's decimal mark, no grouping. ARS and
   * USD keep their short words unless another held currency shares them (`heldCurrencies`); then the full CLDR name. */
  spokenMoney: (minor: number, currency: IsoCurrencyCode) => string;
  /** VoiceOver: the number and its code ("1234,56 ARS"), the language's decimal mark, no grouping. */
  spokenAmount: (minor: number, currency: IsoCurrencyCode) => string;
  /** VoiceOver: the number alone with the currency's own decimals ("1234,56", "1500", "1234.567"), the language's decimal mark, no grouping. */
  spokenMinor: (minor: number, currency: IsoCurrencyCode) => string;
  /** VoiceOver: a percentage, the language's decimal mark, no grouping. */
  spokenPercent: (fraction: number) => string;
  /** A currency as a unit in words for a label: `word` (a catalogued legacy word, "pesos") unless another held currency shares
   * it, then CLDR's plural name in the interface language; without a word, CLDR's plural name ("yenes japoneses"). */
  currencyUnit: (currency: IsoCurrencyCode, word?: string) => string;
  /** The currencies the ledger holds, as `HeldCurrenciesProvider` gave them (empty outside it or in an empty ledger). */
  heldCurrencies: HeldCurrencies;
  /** The separators and grouping the amount field types in. */
  amountFormat: RegionAmountFormat;
  /** The conventions every regional formatter above writes in: the locale's released region, or the explicit ones a caller bound (24R1). */
  conventions: Required<RegionConventions>;
  /** The date wheel's locale identifier: the language with its home region ("es_AR", "en_US"). */
  pickerLocale: string;
  currencySymbol: (currency: IsoCurrencyCode) => string;
  currencyName: (currency: IsoCurrencyCode) => string;
  /** "Hoy", "Ayer", "13 jul" relative to `todayISO`; `inline` for a day inside a sentence ("hoy", "ayer"). */
  relativeDate: (dateISO: string, todayISO: string, inline?: boolean) => string;
  /** A caught or stored error message in the interface language (see errors.ts). */
  errorText: (message: string) => string;
}

/** `deviceLanguage` is the primary language subtag of the device's first
 * locale ("es", "en", "pt"), or null when nothing was read. `held` is the set
 * of currencies the ledger holds (`withHeldCurrencies` rebinds a locale for it):
 * the only ledger fact presentation needs, because a short spoken unit ("pesos")
 * is ambiguous exactly when another held currency shares the word. */
/** `conventions`, when given, are the regional conventions every regional formatter writes in instead
 * of the locale's released region: a catalogue region under test today, the resolved region from 24R2.
 * Words, spoken forms and the date wheel still follow the language; nothing about money changes. */
export function bindLocale(locale: AppLocale, localeSource: LocaleSource = 'none', deviceLanguage: string | null = null, held: HeldCurrencies = [], conventions?: RegionConventions): I18n {
  const language = languageOf(locale);
  const c = conventions ? completeConventions(conventions) : completeConventions(conventionsOf(locale));
  return {
    locale, language, region: regionOf(locale), localeSource, t: translator(language),
    speechLanguage: deviceLanguage && deviceLanguage !== language ? language : undefined,
    formatDate: (dateISO, style) => formatDate(dateISO, style, locale),
    formatMonth: (monthISO, style) => formatMonth(monthISO, locale, style),
    formatMonthTitle: (monthISO, style) => formatMonthTitle(monthISO, locale, style),
    formatDateTime: iso => formatDateTime(iso, locale, conventions),
    formatNumericDate: dateISO => formatNumericDate(dateISO, locale, conventions),
    formatDayMonth: dateISO => formatDayMonth(dateISO, locale, conventions),
    formatCount: value => formatCount(value, locale, conventions),
    formatPercent: fraction => formatPercent(fraction, locale, conventions),
    formatMoneyAmount: (minor, currency) => formatMoneyAmount(minor, currency, locale, conventions),
    formatWholeUnits: (minor, currency) => formatWholeUnits(minor, currency, locale, conventions),
    moneyText: (minor, currency, absolute, signed) => moneyText(minor, currency, locale, absolute, signed, conventions),
    codedAmount: (minor, currency) => codedAmount(minor, currency, locale, conventions),
    spokenMoney: (minor, currency) => spokenMoney(minor, currency, locale, held),
    spokenAmount: (minor, currency) => spokenAmount(minor, currency, locale),
    spokenMinor: (minor, currency) => spokenMinor(minor, currency, locale),
    spokenPercent: fraction => spokenPercent(fraction, locale),
    currencyUnit: (currency, word) => currencyUnit(currency, locale, held, word),
    heldCurrencies: held,
    amountFormat: amountFormat(locale, conventions),
    conventions: c,
    pickerLocale: pickerLocale(locale),
    currencySymbol: currency => currencySymbol(currency, locale, conventions),
    currencyName: currency => currencyName(currency, locale),
    relativeDate: (dateISO, todayISO, inline) => relativeDate(dateISO, todayISO, locale, inline),
    errorText: message => localizeError(language, message),
  };
}

/** The same locale bound for a ledger that holds `held`: only the unit words change
 * (`spokenMoney`, `currencyUnit`, `heldCurrencies`); every other formatter is the
 * same function, so a consumer that formats but never speaks a unit sees no change. */
export function withHeldCurrencies(i18n: I18n, held: HeldCurrencies): I18n {
  const { locale } = i18n;
  return { ...i18n, heldCurrencies: held,
    spokenMoney: (minor, currency) => spokenMoney(minor, currency, locale, held),
    currencyUnit: (currency, word) => currencyUnit(currency, locale, held, word) };
}
