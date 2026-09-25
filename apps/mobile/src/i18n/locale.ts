/** Which language the interface speaks and which regional conventions it writes in.
 *
 * Five things are kept apart on purpose:
 *   - the language (this module): the words of the labels, month and weekday
 *     names, the phrasing of a long date, what VoiceOver says;
 *   - the region (this module): how numbers, amounts, numeric dates and times
 *     are written for the reader (separators, day/month order, 24 h or AM/PM,
 *     which currency a bare "$" means);
 *   - the currency of an account (ARS or USD), a property of the account that
 *     the ledger stores and that never follows the device or the region;
 *   - a future main currency for reports (Producto 24), also not a region;
 *   - the stored financial value: integer minor units, untouched by any of this.
 * Language and region are chosen independently ("follow the device" by
 * default), so English with Argentine formats and Spanish with US formats are
 * both valid. Translating a label never rewrites data: category names,
 * merchants and amounts in SQLite stay exactly what the person recorded.
 *
 * Adding a language is one entry in `LANGUAGES` plus its catalogue. Every
 * region of the CLDR catalogue already has its conventions (`REGIONS`, derived);
 * which ones a build releases is `region-stages.ts`. Nothing else enumerates them. */

import { REGION_CODES, REGION_DATA, type CatalogueRegionCode } from './regions/data.ts';
import { RELEASED_BY_STAGES } from './region-stages.ts';

/** Languages with a catalogue in this build, keyed by ISO 639-1 code. `name` is
 * the language's own name (an autonym), the way iOS lists languages. */
export const LANGUAGES = {
  es: { name: 'Español' },
  en: { name: 'English' },
} as const;
export type LanguageCode = keyof typeof LANGUAGES;

/** A language's home region. It gives the decimal mark of a VoiceOver string
 * (written for a voice of the interface language: "1234,56 pesos" in Spanish,
 * "1234.56 dollars" in English, never grouped, whatever region the screen
 * writes numbers in) and the region of the date wheel's locale ("es_AR",
 * "en_US"), whose month names and column order follow the language. A new
 * language names its region here. */
export const SPEECH_REGIONS: Record<LanguageCode, RegionCode> = { es: 'AR', en: 'US' };

/** How a region writes numbers, dates and times. Words stay with the language.
 * The first five fields are the registry's since 23.1; the optional ones came with the
 * region catalogue (24R1, `src/i18n/regions.ts`) and default to what Argentina and the
 * United States write (`completeConventions`), so the released registry is unchanged. */
export interface RegionConventions {
  /** Decimal and thousands separators of an amount, a count or a percentage. */
  decimal: string;
  group: string;
  /** Order of a numeric date ("22/9/2026", "9/22/2026" or "2026/9/22"). */
  dateOrder: 'dmy' | 'mdy' | 'ymd';
  /** A 12-hour clock with a day-period marker instead of 24 hours. */
  hour12: boolean;
  /** The currency a bare "$" names in this region (ISO code), or null where none is tender; any other "$" currency carries its prefix. */
  dollarSignCurrency: 'ARS' | 'USD' | (string & {}) | null;
  /** The separator between the fields of a numeric date ("/", ".", "-"). */
  dateSeparator?: string;
  /** Whether day and month are zero-padded in a numeric date ("2026/09/22"). */
  paddedDate?: boolean;
  /** Digits per group before the last group of three (2 for the Indian lakh and crore). */
  secondaryGrouping?: number;
  /** Whole digits needed before the first group separator appears (2 where "1000" stays unbroken). */
  minimumGroupingDigits?: number;
  /** First day of the week, 0 = Sunday … 6 = Saturday. */
  weekStart?: number;
  /** The templates dates and times are written with (24R2B, from CLDR through the catalogue): fields d/dd, M/MM,
   * y, H/HH, mm between literal separators ("d/M/y", "y.\u00A0MM.\u00A0dd.", "d.M.", "H.mm"). Absent, they follow
   * the order, separator and padding above, and the 24-hour time is "HH:mm", as the registry always wrote. */
  datePattern?: string;
  dayMonthPattern?: string;
  timePattern?: string;
}

/** The conventions with every optional field filled the way the released regions write. */
export function completeConventions(conventions: RegionConventions): Required<RegionConventions> {
  const base = { dateSeparator: '/', paddedDate: false, secondaryGrouping: 3, minimumGroupingDigits: 1, weekStart: 1, ...conventions };
  const day = base.paddedDate ? 'dd' : 'd', month = base.paddedDate ? 'MM' : 'M';
  const order = base.dateOrder === 'mdy' ? [month, day, 'y'] : base.dateOrder === 'ymd' ? ['y', month, day] : [day, month, 'y'];
  return { datePattern: order.join(base.dateSeparator), dayMonthPattern: order.filter(field => field !== 'y').join(base.dateSeparator), timePattern: 'HH:mm', ...base };
}

/** The fields a formatter reads. `weekStart` is data for a calendar, not a writing: the catalogue's
 * view of the United States starts the week on Sunday while the registry's default is Monday, and
 * both write every string alike. */
const WRITING_FIELDS = ['decimal', 'group', 'dateOrder', 'hour12', 'dollarSignCurrency', 'dateSeparator', 'paddedDate', 'secondaryGrouping', 'minimumGroupingDigits',
  'datePattern', 'dayMonthPattern', 'timePattern'] as const satisfies readonly (keyof RegionConventions)[];

/** Whether two sets of conventions write the same strings: every writing field equal once both are
 * complete, so the registry's entry, the catalogue's view of the same region and a resolved region
 * are the same writing whichever object carries them. */
export function sameWriting(a: RegionConventions, b: RegionConventions): boolean {
  const x = completeConventions(a), y = completeConventions(b);
  return WRITING_FIELDS.every(field => x[field] === y[field]);
}

/** The hand-written registry (Producto 23.1): the regions whose writing was checked on the iPhone
 * before the catalogue existed, with the deliberate deviations from CLDR (Argentina's 24-hour clock,
 * listed in the generator's `DELIBERATE_DEVIATIONS`). Each field here wins over the catalogue's
 * value; the region generator stops when any other field disagrees with CLDR. It also names the
 * regions whose day-and-month writing is the ledger's own ("5/09", `registryRegionOf`). */
export const REGION_REGISTRY = {
  AR: { decimal: ',', group: '.', dateOrder: 'dmy', hour12: false, dollarSignCurrency: 'ARS' },
  US: { decimal: '.', group: ',', dateOrder: 'mdy', hour12: true, dollarSignCurrency: 'USD' },
} as const satisfies Partial<Record<CatalogueRegionCode, RegionConventions>>;
export type RegistryRegionCode = keyof typeof REGION_REGISTRY;

/** Every country and territory of the catalogue (Producto 24R2A): ISO 3166-1 alpha-2 codes, 257. */
export type RegionCode = CatalogueRegionCode;

function isRegistryRegion(code: string): code is RegistryRegionCode {
  return Object.hasOwn(REGION_REGISTRY, code);
}

/** Every region's conventions, derived from the catalogue (`regions/data.ts`, CLDR 48.2.0), with the
 * registry's deliberate values winning field by field. Knowing a region's conventions is not
 * releasing it: `RELEASED_REGIONS` decides which ones a build writes in. */
export const REGIONS: Readonly<Record<RegionCode, Required<RegionConventions>>> = Object.freeze(Object.fromEntries(REGION_CODES.map(code => {
  const record = REGION_DATA[code];
  const fromCldr: Required<RegionConventions> = {
    decimal: record.decimal, group: record.group, dateOrder: record.dateOrder, hour12: record.hour12,
    dollarSignCurrency: record.dollarSignCurrency, dateSeparator: record.dateSeparator, paddedDate: record.paddedDate,
    secondaryGrouping: record.secondaryGrouping, minimumGroupingDigits: record.minimumGroupingDigits, weekStart: record.weekStart,
    datePattern: record.datePattern, dayMonthPattern: record.dayMonthPattern, timePattern: record.timePattern,
  };
  return [code, Object.freeze(isRegistryRegion(code) ? { ...fromCldr, ...REGION_REGISTRY[code] } : fromCldr)];
})) as Record<RegionCode, Required<RegionConventions>>);

/** A resolved pair, written as a BCP 47 tag ("es-AR", "en-AR", "es-US", "en-US").
 * It is only ever the composition of an independently chosen language and region. */
export type AppLocale = `${LanguageCode}-${RegionCode}`;

export const DEFAULT_LANGUAGE: LanguageCode = 'es';
export const DEFAULT_REGION: RegionCode = 'AR';
/** The product's home locale: every string exists in Spanish first. */
export const DEFAULT_LOCALE: AppLocale = 'es-AR';

export const SUPPORTED_LANGUAGES = Object.keys(LANGUAGES) as LanguageCode[];
/** Every region this build knows (the catalogue), released or not. */
export const SUPPORTED_REGIONS: readonly RegionCode[] = REGION_CODES;

/** Languages complete enough to be shown and chosen. English was released in
 * Producto 23.1C2, once every screen had its catalogue (23.1B) and the formats
 * were checked (23.1C1). A language in `LANGUAGES` but not here (a catalogue
 * still being translated) is never offered and never applied, even when the
 * device or a stored choice asks for it. This list is also what iOS declares:
 * `supportedLocales.ios` in app.config.ts must name exactly these languages
 * (tests/app-config.node.ts keeps them equal), and changing it needs a new
 * native build. */
export const RELEASED_LANGUAGES: readonly LanguageCode[] = ['es', 'en'];
/** Regions whose conventions the whole app honours, the amount field included (`money-input.ts`): the released
 * stages of `region-stages.ts`. Argentina and the United States since 23.1C2 (device-checked); since 24R2B every
 * catalogue region whose locale writes Latin digits, by continent, on the automated family verification; the 23
 * native-digit regions stay blocked until each numbering system is normalized, tested and checked on an iPhone. */
export const RELEASED_REGIONS: readonly RegionCode[] = RELEASED_BY_STAGES;

export interface ReleasedSets { languages: readonly LanguageCode[]; regions: readonly RegionCode[] }
export const RELEASED: ReleasedSets = { languages: RELEASED_LANGUAGES, regions: RELEASED_REGIONS };
/** Every language and region this build carries, released or not: since 24R2A the 257 catalogue
 * regions, so a development preview can check a family before its release. */
export const PREVIEW: ReleasedSets = { languages: SUPPORTED_LANGUAGES, regions: SUPPORTED_REGIONS };

/** What a bundle may show: the release gate; or, only in a development bundle
 * started with `EXPO_PUBLIC_LOCALE_PREVIEW=1`, every language and region this
 * build carries, so a catalogue that is not released yet can be checked on the
 * iPhone from FinanzApp Dev. Since 23.1C2 everything the build carries is
 * released (`PREVIEW` equals `RELEASED`), so the flag changes nothing; it stays
 * for the next language. A release bundle can never use it: babel-preset-expo
 * inlines `__DEV__` as false (tests/locale-release.node.ts). A choice saved
 * during a preview is applied only once its value is released. */
export function releasedForBuild(flag: string | undefined, development: boolean): ReleasedSets {
  return development && flag === '1' ? PREVIEW : RELEASED;
}

/** What the person chose for each, if anything: follow the device, or one value. */
export type LanguagePreference = 'system' | LanguageCode;
export type RegionPreference = 'system' | RegionCode;
export interface LocalePreferences { language: LanguagePreference; region: RegionPreference }
export const SYSTEM_PREFERENCES: LocalePreferences = { language: 'system', region: 'system' };

/** A device locale as expo-localization (or an Intl fallback) reports it. On
 * iOS `regionCode` is the Region setting under Language & Region, which is
 * independent of the preferred languages. */
export interface DeviceLocale { languageTag: string; languageCode?: string | null; regionCode?: string | null }

export function isLanguageCode(value: unknown): value is LanguageCode {
  return typeof value === 'string' && Object.hasOwn(LANGUAGES, value);
}
export function isRegionCode(value: unknown): value is RegionCode {
  return typeof value === 'string' && Object.hasOwn(REGION_DATA, value);
}

export function composeLocale(language: LanguageCode, region: RegionCode): AppLocale { return `${language}-${region}`; }
/** The language half of a locale; anything unknown reads as the default. */
export function languageOf(locale: AppLocale): LanguageCode {
  const language = String(locale).split('-')[0];
  return isLanguageCode(language) ? language : DEFAULT_LANGUAGE;
}
/** The region half of a locale; anything unknown reads as the default. */
export function regionOf(locale: AppLocale): RegionCode {
  const region = String(locale).split('-')[1];
  return isRegionCode(region) ? region : DEFAULT_REGION;
}
export function conventionsOf(locale: AppLocale): RegionConventions { return REGIONS[regionOf(locale)]; }
/** The registry region whose writing these conventions are (`sameWriting`), or null for a catalogue
 * region's own. It is what decides a writing the registry keeps for the ledger's sake
 * (`formatDayMonth`'s "5/09"), so the answer is the same for `REGIONS.AR`, `catalogueConventions('AR')`
 * and `conventionsForRegion('AR').conventions`, never a matter of which path bound them. */
export function registryRegionOf(conventions: RegionConventions): RegistryRegionCode | null {
  return (Object.keys(REGION_REGISTRY) as RegistryRegionCode[]).find(code => sameWriting(REGIONS[code], conventions)) ?? null;
}

/** The supported language a BCP 47 tag names: any Spanish variety is Spanish,
 * any English variety is English (regional spelling differences are not a
 * second catalogue), anything else is unsupported. */
export function languageForTag(tag: string | null | undefined): LanguageCode | null {
  const language = String(tag ?? '').trim().toLowerCase().split(/[-_]/)[0];
  return isLanguageCode(language) ? language : null;
}

/** The catalogue region a bare region code names ("us" → US, "UY" → UY, "EU" → none): known, not necessarily released. */
export function regionForCode(code: string | null | undefined): RegionCode | null {
  const upper = String(code ?? '').trim().toUpperCase();
  return isRegionCode(upper) ? upper : null;
}

/** The supported region inside a BCP 47 tag ("en-US" → US, "zh-Hant-TW" →
 * unsupported, "ar" → none). The first subtag is always the language, so the
 * Arabic tag "ar" is never read as Argentina; script and numeric subtags are skipped. */
export function regionForTag(tag: string | null | undefined): RegionCode | null {
  for (const part of String(tag ?? '').trim().split(/[-_]/).slice(1)) {
    if (/^[A-Za-z]{2}$/.test(part)) return regionForCode(part);
  }
  return null;
}

/** The language to use: an explicit, released preference first; otherwise the
 * first device language that is released; otherwise the default. An
 * unreleased language is ignored even when chosen, so a stored preference can
 * never surface before its release. A device whose languages are all
 * unsupported (Portuguese, French) reads Spanish, which is also iOS's fallback
 * for the app's own system text (`CFBundleDevelopmentRegion` 'es'). On iOS the
 * device list already starts with the language chosen for FinanzApp in
 * Settings (a per-app language), so "follow the device" follows that too. */
export function resolveLanguage(devices: readonly DeviceLocale[], preference: LanguagePreference = 'system',
  released: readonly LanguageCode[] = RELEASED_LANGUAGES): LanguageCode {
  const usable = (language: LanguageCode | null): language is LanguageCode => !!language && released.includes(language);
  if (preference !== 'system' && usable(preference)) return preference;
  for (const device of devices) {
    const candidate = languageForTag(device.languageTag) ?? languageForTag(device.languageCode);
    if (usable(candidate)) return candidate;
  }
  return released.includes(DEFAULT_LANGUAGE) ? DEFAULT_LANGUAGE : released[0] ?? DEFAULT_LANGUAGE;
}

/** The region to use: an explicit, released preference first; otherwise the
 * device's region setting (the first locale's `regionCode`, or the region of
 * its tag when only Intl answered) when it is released; otherwise the default.
 * The region never comes from a second preferred language: that is a
 * language the person reads, not where they are. A region that is not
 * released (Uruguay, Spain), chosen or read from the device, is not applied:
 * the next rule answers (a stored choice falls through to the device, the
 * device to the default), and the chooser names the stand-in. A stored choice
 * is kept and applies by itself once its region is released. */
export function resolveRegion(devices: readonly DeviceLocale[], preference: RegionPreference = 'system',
  released: readonly RegionCode[] = RELEASED_REGIONS): RegionCode {
  const usable = (region: RegionCode | null): region is RegionCode => !!region && released.includes(region);
  if (preference !== 'system' && usable(preference)) return preference;
  const device = devices[0];
  const candidate = device ? (device.regionCode ? regionForCode(device.regionCode) : regionForTag(device.languageTag)) : null;
  if (usable(candidate)) return candidate;
  return released.includes(DEFAULT_REGION) ? DEFAULT_REGION : released[0] ?? DEFAULT_REGION;
}

export interface ResolvedLocale { language: LanguageCode; region: RegionCode; locale: AppLocale }

/** Both halves, each resolved on its own, and their composition. */
export function resolveLocale(devices: readonly DeviceLocale[], preferences: LocalePreferences = SYSTEM_PREFERENCES,
  released: ReleasedSets = RELEASED): ResolvedLocale {
  const language = resolveLanguage(devices, preferences.language, released.languages);
  const region = resolveRegion(devices, preferences.region, released.regions);
  return { language, region, locale: composeLocale(language, region) };
}

/** Reads a stored language preference back. Anything that is not a supported
 * language means "follow the device". A full tag ("es-AR", the 23.0 value
 * shape) keeps only its language: the region is its own preference now. */
export function languagePreferenceFrom(stored: unknown): LanguagePreference {
  if (stored === 'system' || isLanguageCode(stored)) return stored;
  if (typeof stored === 'string' && /^[a-z]{2}-[A-Z]{2}$/.test(stored)) return languageForTag(stored) ?? 'system';
  return 'system';
}

/** Reads a stored region preference back. Any catalogue region is kept, released or not (a choice
 * made in a development preview waits for its release, as a previewed language does); anything
 * else follows the device. */
export function regionPreferenceFrom(stored: unknown): RegionPreference {
  return stored === 'system' || isRegionCode(stored) ? stored : 'system';
}
