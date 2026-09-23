/** The locale bound to one object of translator and formatters, the shape
 * components receive, plus the startup decision. Pure (no React), so the
 * provider stays a thin context and Node can test the binding directly. The
 * financial values a component formats are still integer minor units from
 * the ledger; only their presentation follows the locale. */
import type { Currency } from '@finanzapp/domain';
import { deviceLocales } from './device.ts';
import { currencyName, currencySymbol, formatDate, formatDateTime, formatMonth, formatPercent, moneyText, spokenMoney, type DateStyle } from './format.ts';
import { DEFAULT_LOCALE, resolveLocale, type AppLocale, type LanguagePreference } from './locale.ts';
import { translator, type Translate } from './messages.ts';
import { readLanguagePreference } from './preference.ts';

export interface I18n {
  locale: AppLocale;
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

export function bindLocale(locale: AppLocale): I18n {
  return {
    locale, t: translator(locale),
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

/** Decides the locale for this launch. Injectable for tests; the defaults read the store and the device. */
export function startupLocale(preference: () => LanguagePreference = readLanguagePreference, devices = deviceLocales): AppLocale {
  try { return resolveLocale(devices(), preference()); } catch { return DEFAULT_LOCALE; }
}
