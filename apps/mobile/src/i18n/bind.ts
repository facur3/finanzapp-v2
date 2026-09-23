/** The locale bound to one object of translator and formatters, the shape
 * components receive, plus the startup decision. Pure (no React), so the
 * provider stays a thin context and Node can test the binding directly. The
 * financial values a component formats are still integer minor units from
 * the ledger; only their presentation follows the locale. */
import type { Currency } from '@finanzapp/domain';
import type { LocaleSource } from './device.ts';
import type { DeviceLocale } from './locale.ts';
import { currencyName, currencySymbol, formatDate, formatDateTime, formatMonth, formatPercent, moneyText, spokenMoney, type DateStyle } from './format.ts';
import { resolveLocale, type AppLocale, type LanguagePreference } from './locale.ts';
import { translator, type Translate } from './messages.ts';
import { readLanguagePreference } from './preference.ts';

export interface I18n {
  locale: AppLocale;
  /** Where the device languages came from this launch: the native module, Intl, or nothing. Diagnostic only. */
  localeSource: LocaleSource;
  t: Translate;
  formatDate: (dateISO: string, style: DateStyle) => string;
  formatMonth: (monthISO: string, style?: 'month' | 'monthYear') => string;
  formatDateTime: (iso: string) => string;
  formatPercent: (fraction: number) => string;
  moneyText: (minor: number, currency: Currency, absolute?: boolean) => string;
  spokenMoney: (minor: number, currency: Currency) => string;
  currencySymbol: (currency: Currency) => string;
  currencyName: (currency: Currency) => string;
}

export function bindLocale(locale: AppLocale, localeSource: LocaleSource = 'none'): I18n {
  return {
    locale, localeSource, t: translator(locale),
    formatDate: (dateISO, style) => formatDate(dateISO, style, locale),
    formatMonth: (monthISO, style) => formatMonth(monthISO, locale, style),
    formatDateTime: iso => formatDateTime(iso, locale),
    formatPercent: fraction => formatPercent(fraction, locale),
    moneyText: (minor, currency, absolute) => moneyText(minor, currency, locale, absolute),
    spokenMoney: (minor, currency) => spokenMoney(minor, currency, locale),
    currencySymbol: currency => currencySymbol(currency, locale),
    currencyName: currency => currencyName(currency, locale),
  };
}

/** Decides the locale for this launch from the stored preference and the
 * device list, and says where the device list came from. The preference
 * reader already treats an unreadable store as "follow the device"; nothing
 * else is caught here, so a fault in a registered native module is not
 * disguised as a missing one. */
export function startupLocale(devices: () => { source: LocaleSource; locales: DeviceLocale[] },
  preference: () => LanguagePreference = readLanguagePreference): { locale: AppLocale; source: LocaleSource } {
  const { source, locales } = devices();
  return { locale: resolveLocale(locales, preference()), source };
}
