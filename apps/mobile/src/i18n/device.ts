/** The device's language list.
 *
 * expo-localization binds its native module while the package is being
 * evaluated (`requireNativeModule('ExpoLocalization')` at the top of its
 * build). In a binary compiled before the dependency was added (a FinanzApp
 * Dev build from Producto 22.1 or earlier) that call throws, and Metro's
 * development runtime reports a throw during module initialisation to the
 * error overlay even when the caller catches it: wrapping the package's
 * lazy load in a try/catch is not enough (the device report of
 * "Cannot find native module 'ExpoLocalization'").
 *
 * So the order is: ask Expo whether the native module is registered
 * (`requireOptionalNativeModule`, which returns null instead of throwing),
 * and only when it is, evaluate the package and read its locales (the
 * wiring lives in `device-runtime.ts`; this file stays pure for Node). When it is
 * absent (an older development build), the expected, silent fallback is
 * Hermes's Intl, which still gives the device's primary language; with no
 * usable locale either, the list is empty and resolution picks Spanish.
 * Nothing else is swallowed: an error from a registered module is a real
 * fault and propagates. */
import type { DeviceLocale } from './locale.ts';

export type LocaleSource = 'native' | 'intl' | 'none';

export type LocalizationModule = { getLocales: () => DeviceLocale[] };

export interface DeviceLocaleDeps {
  /** Whether the ExpoLocalization native module is registered in this binary. Must not throw. */
  nativeRegistered: () => boolean;
  /** Evaluates expo-localization. Called only after `nativeRegistered()` is true. */
  load: () => LocalizationModule;
  /** The runtime's default locale tag through Intl, or undefined when Intl has none. */
  intlLocale: () => string | undefined;
}

/** Reads the runtime default locale through Intl. */
export function intlLocale(): string | undefined {
  // An engine without Intl is an expected environment, not a fault: check instead of catching.
  if (typeof Intl === 'undefined' || typeof Intl.DateTimeFormat !== 'function') return undefined;
  const tag = Intl.DateTimeFormat().resolvedOptions().locale;
  return typeof tag === 'string' && tag ? tag : undefined;
}

/** The locales and where they came from, for diagnostics and tests. */
export function readDeviceLocales(deps: DeviceLocaleDeps): { source: LocaleSource; locales: DeviceLocale[] } {
  if (deps.nativeRegistered()) {
    const locales = deps.load().getLocales();
    if (Array.isArray(locales) && locales.length && locales.every(locale => typeof locale?.languageTag === 'string')) {
      return { source: 'native', locales: locales.map(locale => ({ languageTag: locale.languageTag, languageCode: locale.languageCode ?? null, regionCode: locale.regionCode ?? null })) };
    }
  }
  const tag = deps.intlLocale();
  if (tag) return { source: 'intl', locales: [{ languageTag: tag }] };
  return { source: 'none', locales: [] };
}

export function deviceLocales(deps: DeviceLocaleDeps): DeviceLocale[] {
  return readDeviceLocales(deps).locales;
}
