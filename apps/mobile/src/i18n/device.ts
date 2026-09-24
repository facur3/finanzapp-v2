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

/** The primary language subtag of the device's first locale ("es", "en",
 * "pt"), whether or not the app has a catalogue for it; null when nothing was
 * read. Compared with the interface language to decide VoiceOver's language. */
export function primaryLanguageOf(locales: readonly DeviceLocale[]): string | null {
  const first = locales[0];
  const code = String(first?.languageTag || first?.languageCode || '').trim().toLowerCase().split(/[-_]/)[0];
  return /^[a-z]{2,3}$/.test(code) ? code : null;
}

/** The event expo-localization's native module sends when iOS posts
 * NSCurrentLocaleDidChangeNotification: a Region, calendar or clock change
 * made while the app kept running (queued while suspended and delivered on
 * resume, in no documented order with becoming active), once Foundation has
 * dropped its cached `Locale.current`. A change of the iPhone's language or of
 * FinanzApp's own language in iOS Settings quits the app instead; the next
 * launch reads the new list. */
export const LOCALE_CHANGED_EVENT = 'onLocaleSettingsChanged';
export interface LocaleEventSource { addListener: (event: typeof LOCALE_CHANGED_EVENT, listener: () => void) => { remove: () => void } }

/** Subscribes to that event when `module` is a registered native module that
 * emits events; otherwise (an older binary, Node) a no-op. Returns the
 * unsubscribe, safe to call twice. `addListener` is called as a method: the
 * native emitter needs its `this`. */
export function subscribeDeviceLocaleChanges(module: unknown, listener: () => void): () => void {
  const source = module as Partial<LocaleEventSource> | null | undefined;
  if (!source || typeof source.addListener !== 'function') return () => {};
  const subscription = source.addListener(LOCALE_CHANGED_EVENT, () => listener());
  let active = true;
  return () => { if (active) { active = false; subscription.remove(); } };
}
