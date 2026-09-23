/** Which language and regional conventions the interface uses.
 *
 * Four things are kept apart on purpose:
 *   - the locale (this module): the language of the labels and the way dates,
 *     numbers and percentages are written for the reader;
 *   - the region inside it, which only chooses those writing conventions;
 *   - the currency of an account (ARS or USD), a property of the account that
 *     the ledger stores and that never follows the device;
 *   - the stored financial value: integer minor units, untouched by any of this.
 * Translating a label never rewrites data: category names, merchants and
 * amounts in SQLite stay exactly what the person recorded. */

export type AppLocale = 'es-AR' | 'en-US';
export type Language = 'es' | 'en';
export type Region = 'AR' | 'US';

/** The product's home locale: every string exists here first. */
export const DEFAULT_LOCALE: AppLocale = 'es-AR';
/** Locales with a resource catalogue in this build. */
export const SUPPORTED_LOCALES: readonly AppLocale[] = ['es-AR', 'en-US'];
/** Locales whose translation is complete enough to be shown. English joins in
 * Producto 23.1, once every screen has its catalogue; until then an English
 * device still reads Spanish rather than a half-translated app. */
export const RELEASED_LOCALES: readonly AppLocale[] = ['es-AR'];

/** What the person chose, if anything: follow the device, or one locale. */
export type LanguagePreference = 'system' | AppLocale;

/** A device locale as expo-localization (or an Intl fallback) reports it. */
export interface DeviceLocale { languageTag: string; languageCode?: string | null; regionCode?: string | null }

export function languageOf(locale: AppLocale): Language { return locale === 'en-US' ? 'en' : 'es'; }
export function regionOf(locale: AppLocale): Region { return locale === 'en-US' ? 'US' : 'AR'; }

export function isAppLocale(value: unknown): value is AppLocale {
  return typeof value === 'string' && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

/** The app locale a BCP 47 tag maps to: any Spanish variety reads es-AR, any
 * English variety reads en-US (regional spelling differences are not a second
 * catalogue), anything else is unsupported. The tag's own region is not
 * used: a person in Uruguay still gets Argentine conventions until a
 * locale of their own exists. */
export function localeForTag(tag: string | null | undefined): AppLocale | null {
  const language = String(tag ?? '').trim().toLowerCase().split(/[-_]/)[0];
  if (language === 'es') return 'es-AR';
  if (language === 'en') return 'en-US';
  return null;
}

/** The locale to use: an explicit, released preference first; otherwise the
 * first device language that maps to a released locale; otherwise the
 * default. Unreleased locales are ignored even when chosen, so a stored
 * English preference from a later phase can never surface early. */
export function resolveLocale(devices: readonly DeviceLocale[], preference: LanguagePreference = 'system',
  released: readonly AppLocale[] = RELEASED_LOCALES): AppLocale {
  const usable = (locale: AppLocale | null): locale is AppLocale => !!locale && released.includes(locale);
  if (preference !== 'system' && usable(preference)) return preference;
  for (const device of devices) {
    const candidate = localeForTag(device.languageTag) ?? localeForTag(device.languageCode);
    if (usable(candidate)) return candidate;
  }
  return released.includes(DEFAULT_LOCALE) ? DEFAULT_LOCALE : released[0] ?? DEFAULT_LOCALE;
}

/** Reads a stored preference back: anything that is not a known value means "follow the device". */
export function languagePreferenceFrom(stored: unknown): LanguagePreference {
  return stored === 'system' || isAppLocale(stored) ? stored : 'system';
}
