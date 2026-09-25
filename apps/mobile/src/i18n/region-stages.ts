/** Which catalogue regions a build releases (Producto 24R2B): the stages, derived from the catalogue itself.
 *
 * 24R2A kept every region but Argentina and the United States behind the gate. 24R2B releases the rest by
 * continent (CLDR's territoryContainment), each continent a stage, on **automated** evidence: every convention
 * family the catalogue holds is exercised by `tests/regions-integration.node.ts` and `tests/region-families.node.ts`
 * (amounts, separators, caret, paste, dates, clock, spoken forms, persistence) in both languages. This is a
 * provisional development strategy before launch, not an explicit authorization by the owner: nothing is published
 * yet, and the per-family iPhone sheet (docs/region-families.md) must pass before the first TestFlight; any stage
 * can be set back to blocked in one commit.
 *
 * One stage stays **blocked**: the 23 regions whose locale writes other digits by default (CLDR's
 * defaultNumberingSystem: Arabic-Indic `arab`, Eastern Arabic-Indic `arabext`, Bengali `beng`, Devanagari `deva`,
 * Burmese `mymr`, Tibetan `tibt`). FinanzApp writes Latin digits everywhere. What the iPhone's decimal pad offers
 * there is **not verified**: it may show Latin digits or the native ones (iOS can follow its own Numbers setting
 * rather than CLDR's default), and its decimal key is unknown. `latinDigits` normalizes only `arab`, `arabext` and
 * full-width digits; Bengali, Devanagari, Burmese and Tibetan digits are not read (a paste of them is refused, never
 * guessed; `tests/region-families.node.ts` pins this). Each numbering system opens only after its normalization and
 * tests exist and an iPhone check of its pad passed (docs/region-families.md §4); until then those regions write the
 * default region's conventions and say so.
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
    blocker: 'The locale\'s default digits are not Latin. What the iOS decimal pad types there (Latin or native digits, which decimal key) is unverified; latinDigits reads arab and arabext only, not beng, deva, mymr or tibt. Each numbering system needs its normalization, its tests and an iPhone check of its pad before its regions open (docs/region-families.md §4).' },
];

/** The regions of the released stages: what `RELEASED_REGIONS` is. */
export const RELEASED_BY_STAGES: readonly CatalogueRegionCode[] = REGION_RELEASE_STAGES.filter(stage => stage.status === 'released').flatMap(stage => stage.regions);
