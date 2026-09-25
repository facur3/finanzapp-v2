/** The region catalogue as the app reads it (Producto 24R1): every country and
 * territory CLDR describes, with the conventions its likely locale writes in,
 * its names in the published languages, and the rule that decides which
 * conventions a build actually honours.
 *
 * Three layers, kept apart:
 *   - the catalogue (`regions/data.ts`, generated): 257 regions, what CLDR
 *     says about each; data, never a promise;
 *   - the released registry (`REGIONS` in locale.ts, hand-written): the
 *     regions whose conventions the whole app honours today, the amount
 *     field, the goldens and the device checks included (Argentina and the
 *     United States); a deliberate deviation from CLDR lives there and is
 *     listed in the generator (`DELIBERATE_DEVIATIONS`);
 *   - the fallback (`conventionsForRegion`): a region the catalogue knows but
 *     the build does not honour yet writes the default region's conventions
 *     and is *shown as such* ("Japón (formatos de Argentina)"), never as if
 *     its own formats were in use. A region the catalogue does not know is
 *     not offered.
 * A region never implies an account's currency, a language never implies a
 * region (docs/currency.md §1); the catalogue's `currencies` are search
 * aliases and the bare "$" rule only. Pure: no React, no device access. */
import { DEFAULT_REGION, REGIONS, RELEASED_REGIONS, completeConventions, isRegionCode, type DeviceLocale, type LanguageCode, type RegionCode, type RegionConventions } from './locale.ts';
import { foldText, nameComparator } from './intl-support.ts';
import { REGION_CODES, REGION_DATA, REGION_NAMES, type CatalogueRegionCode, type RegionRecord } from './regions/index.ts';

export type { CatalogueRegionCode, RegionRecord } from './regions/index.ts';

export function isCatalogueRegion(code: unknown): code is CatalogueRegionCode {
  return typeof code === 'string' && Object.hasOwn(REGION_DATA, code);
}

/** The catalogue code a value names ("jp", " AR ") or null; never the default. */
export function catalogueRegionCode(value: unknown): CatalogueRegionCode | null {
  if (typeof value !== 'string') return null;
  const code = value.trim().toUpperCase();
  return isCatalogueRegion(code) ? code : null;
}

export function regionRecord(code: CatalogueRegionCode): RegionRecord {
  return REGION_DATA[code];
}

/** What CLDR says a region writes in, as the app's conventions. For a released region the
 * hand-written registry wins field by field (its deliberate deviations are documented). */
export function catalogueConventions(code: CatalogueRegionCode): Required<RegionConventions> {
  const record = REGION_DATA[code];
  const fromCldr: Required<RegionConventions> = {
    decimal: record.decimal, group: record.group, dateOrder: record.dateOrder, hour12: record.hour12,
    dollarSignCurrency: record.dollarSignCurrency, dateSeparator: record.dateSeparator, paddedDate: record.paddedDate,
    secondaryGrouping: record.secondaryGrouping, minimumGroupingDigits: record.minimumGroupingDigits, weekStart: record.weekStart,
  };
  return isRegionCode(code) ? { ...fromCldr, ...REGIONS[code] } : fromCldr;
}

export type RegionStatus = 'released' | 'catalogue' | 'unknown';

/** released: the build honours the region's own conventions; catalogue: known, named and searchable,
 * writes the default conventions until its release; unknown: not a catalogue region. */
export function regionStatus(code: unknown, released: readonly RegionCode[] = RELEASED_REGIONS): RegionStatus {
  const region = catalogueRegionCode(code);
  if (!region) return 'unknown';
  return isRegionCode(region) && released.includes(region) ? 'released' : 'catalogue';
}

export interface RegionResolution {
  /** The region whose conventions are written: the requested one when released, else the default. */
  region: RegionCode;
  conventions: Required<RegionConventions>;
  /** Whether the conventions are the requested region's own or the default region's standing in. */
  source: 'released' | 'default';
  /** The catalogue region that was asked for, when the catalogue knows it (so a screen can name it). */
  requested: CatalogueRegionCode | null;
}

/** The conventions a build writes for a requested region: its own when released, the default
 * region's otherwise, and which of the two it is. Never invented conventions, never silent. */
export function conventionsForRegion(code: unknown, released: readonly RegionCode[] = RELEASED_REGIONS): RegionResolution {
  const requested = catalogueRegionCode(code);
  if (requested && isRegionCode(requested) && released.includes(requested)) {
    return { region: requested, conventions: completeConventions(REGIONS[requested]), source: 'released', requested };
  }
  const region: RegionCode = released.includes(DEFAULT_REGION) ? DEFAULT_REGION : released[0] ?? DEFAULT_REGION;
  return { region, conventions: completeConventions(REGIONS[region]), source: 'default', requested };
}

/** The name of a catalogue region in a published language, from CLDR ("Japón", "Japan"). */
export function regionDisplayName(code: CatalogueRegionCode, language: LanguageCode): string {
  return REGION_NAMES[language][code];
}

/** The device's Region setting as a catalogue code (the first locale's `regionCode`, or the
 * region subtag of its tag when only Intl answered), or null when unknown to the catalogue.
 * Read from the device's preferences only: never from location, never inferred from a language. */
export function deviceRegion(locales: readonly DeviceLocale[]): CatalogueRegionCode | null {
  const first = locales[0];
  if (!first) return null;
  if (first.regionCode) return catalogueRegionCode(first.regionCode);
  for (const part of String(first.languageTag ?? '').split(/[-_]/).slice(1)) if (/^[A-Za-z]{2}$/.test(part)) return catalogueRegionCode(part);
  return null;
}

export interface RegionChoice {
  code: CatalogueRegionCode;
  name: string;
  /** Folded text a search matches: the name, the codes (alpha-2, alpha-3, numeric) and the tender currencies. */
  searchText: string;
}

/** The chooser's list: every catalogue region (or `codes`) named in the language and ordered by that
 * name with the engine's collator, or a folding comparison where the engine has none. */
export function regionChoices(language: LanguageCode, codes: readonly CatalogueRegionCode[] = REGION_CODES): RegionChoice[] {
  const { compare } = nameComparator(language);
  return codes.map(code => {
    const record = REGION_DATA[code], name = regionDisplayName(code, language);
    return { code, name, searchText: foldText([name, code, record.alpha3 ?? '', record.numeric ?? '', ...record.currencies].join(' ')) };
  }).sort((a, b) => compare(a.name, b.name) || (a.code < b.code ? -1 : 1));
}

/** Search by name, code, alpha-3, numeric code or tender currency, accent- and case-insensitive:
 * an exact code first, then a code prefix, then a name prefix, then any match; ties keep the
 * alphabetical order. An empty query lists everything. */
export function searchRegions<T extends RegionChoice>(query: string, choices: readonly T[]): T[] {
  const needle = foldText(query);
  if (!needle) return [...choices];
  const score = (item: T) => {
    const record = REGION_DATA[item.code];
    const codes = [item.code, record.alpha3 ?? '', record.numeric ?? ''].map(code => code.toLowerCase());
    if (codes.includes(needle)) return 0;
    if (item.code.toLowerCase().startsWith(needle)) return 1;
    if (foldText(item.name).startsWith(needle)) return 2;
    return item.searchText.includes(needle) ? 3 : -1;
  };
  return choices.map((item, index) => ({ item, index, score: score(item) })).filter(entry => entry.score >= 0)
    .sort((a, b) => a.score - b.score || a.index - b.index).map(entry => entry.item);
}
