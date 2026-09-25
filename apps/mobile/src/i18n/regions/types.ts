import type { CatalogueRegionCode } from './data.ts';

/** One language's generated region names (src/i18n/regions/<language>.ts): every catalogue region, from CLDR only. */
export type RegionNames = { readonly [Code in CatalogueRegionCode]: string };
