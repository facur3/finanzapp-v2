/** Region names per language, generated from CLDR (scripts/regions/generate.mjs). A language added
 * to LANGUAGES must add its generated module here: the record type makes a missing one a compile error. */
import type { LanguageCode } from '../locale.ts';
import { en } from './en.ts';
import { es } from './es.ts';
import type { RegionNames } from './types.ts';

export const REGION_NAMES: Readonly<Record<LanguageCode, RegionNames>> = { es, en };
export { CLDR_REGIONS_VERSION, REGION_CODES, REGION_DATA, type CatalogueRegionCode, type DateOrder, type RegionRecord } from './data.ts';
