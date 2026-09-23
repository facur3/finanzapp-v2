/** The locale as React context. Resolved once at startup from the stored
 * preference and the device languages (iOS restarts an app whose language
 * changes, so a live subscription is not needed yet). Components read
 * `useI18n()` for the translator and the formatters bound to that locale;
 * without a provider (a screen rendered in isolation) everything falls back
 * to Spanish. */
import { createContext, createElement, useContext, useMemo, type ReactNode } from 'react';
import { bindLocale, startupLocale, type I18n } from './bind.ts';
import { DEFAULT_LOCALE, type AppLocale } from './locale.ts';

export type { I18n } from './bind.ts';

const I18nContext = createContext<I18n>(bindLocale(DEFAULT_LOCALE));

export function I18nProvider({ children, locale }: { children: ReactNode; locale?: AppLocale }) {
  const value = useMemo(() => bindLocale(locale ?? startupLocale()), [locale]);
  return createElement(I18nContext.Provider, { value }, children);
}

export const useI18n = () => useContext(I18nContext);
