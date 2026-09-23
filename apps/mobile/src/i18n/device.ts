/** The device's language list, read through expo-localization when its
 * native module is present (Expo Go bundles it; a development build gets it
 * on its next native build) and through Hermes's Intl otherwise. Either way
 * a failure yields the Spanish default, never a throw at startup: locale
 * detection is a decoration on the app, not a dependency of it. The lazy
 * `require` follows the glass adapter: the module is bound only when asked. */
import type { DeviceLocale } from './locale.ts';

type LocalizationModule = { getLocales: () => DeviceLocale[] };

export function deviceLocales(load: () => LocalizationModule = () => require('expo-localization') as LocalizationModule,
  intlLocale: () => string | undefined = () => Intl.DateTimeFormat().resolvedOptions().locale): DeviceLocale[] {
  try {
    const locales = load().getLocales();
    if (Array.isArray(locales) && locales.length && locales.every(locale => typeof locale?.languageTag === 'string')) {
      return locales.map(locale => ({ languageTag: locale.languageTag, languageCode: locale.languageCode ?? null, regionCode: locale.regionCode ?? null }));
    }
  } catch { /* no native module in this binary: fall through */ }
  try {
    const tag = intlLocale();
    if (typeof tag === 'string' && tag) return [{ languageTag: tag }];
  } catch { /* an Intl without locale data */ }
  return [];
}
