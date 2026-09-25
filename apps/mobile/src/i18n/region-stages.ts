/** Which catalogue regions a build releases (Producto 24R2B): the stages, derived from the catalogue itself.
 *
 * 24R2A kept every region but Argentina and the United States behind the gate. 24R2B releases the rest by
 * continent (CLDR's territoryContainment), each continent a stage, on **automated** evidence: every convention
 * family the catalogue holds is exercised by `tests/regions-integration.node.ts` and `tests/region-families.node.ts`
 * (amounts, separators, caret, paste, dates, clock, spoken forms, persistence) in both languages. The owner decided
 * on 2026-09-25, before any public release, to open regions on that evidence and keep the per-family iPhone check
 * (docs/region-families.md) as a gate of the first TestFlight, instead of one delivery per region.
 *
 * One stage stays **blocked**: the regions whose locale writes other digits by default (Arabic, Persian, Bengali,
 * Devanagari, Burmese, Tibetan). FinanzApp writes Latin digits everywhere, but there the iPhone's decimal pad types
 * the native digits and its own decimal key; the amount field reads them (`latinDigits`, tested in Node) and that
 * path has never run on an iPhone. Amount entry is the one thing that must be exact, so those regions write the
 * default region's conventions (and say so) until a device check releases them.
 *
 * Pure data over the generated catalogue; `RELEASED_REGIONS` (locale.ts) is `RELEASED_BY_STAGES`. */
import { REGION_CODES, REGION_DATA, type CatalogueRegionCode, type Continent } from './regions/data.ts';

export type StageStatus = 'released' | 'blocked';

export interface RegionReleaseStage {
  id: 'home' | Continent | 'native-digits';
  /** The delivery that opened (or holds) it. */
  delivery: '23.1C2' | '24R2B';
  status: StageStatus;
  /** What the release rests on: device checks (23.1C2) or the automated family verification (24R2B). */
  evidence: 'device' | 'automated' | null;
  /** Why a blocked stage is not released, and what releases it. */
  blocker: string | null;
  regions: readonly CatalogueRegionCode[];
}

const HOME: readonly CatalogueRegionCode[] = ['AR', 'US'];
/** A region whose locale writes digits other than Latin by default. */
export function writesNativeDigits(code: CatalogueRegionCode): boolean {
  return REGION_DATA[code].defaultDigits !== 'latn';
}
const byContinent = (continent: Continent) => REGION_CODES.filter(code => REGION_DATA[code].continent === continent && !HOME.includes(code) && !writesNativeDigits(code));

export const REGION_RELEASE_STAGES: readonly RegionReleaseStage[] = [
  { id: 'home', delivery: '23.1C2', status: 'released', evidence: 'device', blocker: null, regions: HOME },
  ...(['americas', 'europe', 'asia', 'africa', 'oceania'] as const).map((continent): RegionReleaseStage =>
    ({ id: continent, delivery: '24R2B', status: 'released', evidence: 'automated', blocker: null, regions: byContinent(continent) })),
  { id: 'native-digits', delivery: '24R2B', status: 'blocked', evidence: null, regions: REGION_CODES.filter(writesNativeDigits),
    blocker: 'The iPhone\'s decimal pad types native digits and its own decimal key there; the amount field reads them in Node tests only. Released after an iPhone check of the pad in one Arabic-digit and one Devanagari-digit region (docs/region-families.md).' },
];

/** The regions of the released stages: what `RELEASED_REGIONS` is. */
export const RELEASED_BY_STAGES: readonly CatalogueRegionCode[] = REGION_RELEASE_STAGES.filter(stage => stage.status === 'released').flatMap(stage => stage.regions);
