/** The locale as React context, live. One `LocaleStore` per app holds the two
 * preferences and the device reading; the provider subscribes to it with
 * `useSyncExternalStore`, so a choice made in Más re-renders exactly the
 * components that read `useI18n()` and nothing else:
 *   - the provider never keys or remounts its children, and its children are
 *     the same elements after a change, so the ledger provider (SQLite), the
 *     navigation stack, the current screen, a half-typed form and the
 *     Assistant conversation keep their state; only consumers re-render;
 *   - the context value is rebuilt only when the resolved locale or the
 *     device source changes, so saving a choice that resolves to the same
 *     locale re-renders no screen;
 *   - "follow the device" re-reads the device when the app returns to the
 *     foreground and when iOS says its locale changed: iOS keeps an app
 *     running across a Region change, while a change of the iPhone's
 *     language or of FinanzApp's language in iOS Settings quits the app (the
 *     next launch starts from the new list). Both signals are idempotent;
 *   - VoiceOver's language (`speechLanguage`) is set only when the interface
 *     language differs from the device's first language.
 * Without a provider (a screen rendered in isolation) everything falls back
 * to Spanish with Argentine conventions. */
import { createContext, createElement, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { bindLocale, type I18n } from './bind.ts';
import { readRuntimeDeviceLocales, subscribeRuntimeLocaleChanges } from './device-runtime';
import { DEFAULT_LOCALE, releasedForBuild, type AppLocale } from './locale.ts';
import { defaultPreferenceStore } from './preference.ts';
import { createLocaleStore, type LocaleState, type LocaleStore } from './store.ts';

export type { I18n } from './bind.ts';

const I18nContext = createContext<I18n>(bindLocale(DEFAULT_LOCALE));

export interface LocalePreferencesContext { state: LocaleState; setLanguage: LocaleStore['setLanguage']; setRegion: LocaleStore['setRegion'] }
const PreferencesContext = createContext<LocalePreferencesContext | null>(null);

declare const __DEV__: boolean | undefined;

/** The app's store: the probed device reader, the key-value store and the
 * release gate (widened only for a development preview, see releasedForBuild;
 * the flag is read by its literal name so Expo inlines it). */
export function createRuntimeLocaleStore(): LocaleStore {
  return createLocaleStore({ devices: readRuntimeDeviceLocales, store: defaultPreferenceStore,
    released: releasedForBuild(process.env.EXPO_PUBLIC_LOCALE_PREVIEW, typeof __DEV__ !== 'undefined' && __DEV__) });
}

export function I18nProvider({ children, locale, store }: { children: ReactNode; locale?: AppLocale; store?: LocaleStore }) {
  const [localeStore] = useState(() => store ?? createRuntimeLocaleStore());
  const state = useSyncExternalStore(localeStore.subscribe, localeStore.getState, localeStore.getState);
  useEffect(() => {
    const refresh = () => localeStore.refreshDevice();
    // Two signals, one idempotent re-read: returning to the foreground, and
    // iOS's own locale-change event, which arrives once Foundation has dropped
    // its cached Locale.current (in no documented order with 'active').
    const foreground = AppState.addEventListener('change', status => { if (status === 'active') refresh(); });
    const unsubscribe = subscribeRuntimeLocaleChanges(refresh);
    return () => { foreground.remove(); unsubscribe(); };
  }, [localeStore]);
  const resolved = locale ?? state.locale;
  const value = useMemo(() => bindLocale(resolved, state.device.source, state.device.primaryLanguage),
    [resolved, state.device.source, state.device.primaryLanguage]);
  const preferences = useMemo(() => ({ state, setLanguage: localeStore.setLanguage, setRegion: localeStore.setRegion }), [state, localeStore]);
  return createElement(PreferencesContext.Provider, { value: preferences }, createElement(I18nContext.Provider, { value }, children));
}

export const useI18n = () => useContext(I18nContext);

/** The stored choices and their setters, for the language and region screens. Null outside a provider. */
export const useLocalePreferences = () => useContext(PreferencesContext);
