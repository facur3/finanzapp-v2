/** The progressive release of the catalogue's regions (Producto 24R2A prepares it, 24R2B opens it).
 *
 * Every region already has its conventions (`REGIONS`, derived from CLDR), but a region is released
 * only after the iPhone has shown its conventions working: the amount field typing and pasting in
 * its separators, its numeric dates, its clock, the spoken forms. Checking 257 regions one by one
 * would be theatre; checking none would publish CLDR untested. So regions are released by
 * **convention family**: regions that write numbers the same way (decimal, group character,
 * grouping, minimum grouping) share every amount-field behaviour, and regions that write dates the
 * same way (order, separator, padding, clock) share every date string. A stage names the regions it
 * opens; its families are what the device QA must cover (docs/mobile-device-checklist.md, 24R2B).
 *
 * `RELEASED_REGIONS` (locale.ts) stays the one gate the app reads; a test keeps it equal to the
 * regions of the stages marked released, so opening a stage is one commit that flips its status and
 * adds its regions, after the evidence is recorded. Pure data and helpers; no React. */
import { REGIONS, type RegionCode } from './locale.ts';

export type StageStatus = 'released' | 'pendingDeviceQa';

export interface RegionReleaseStage {
  id: string;
  /** The delivery that opens it. */
  delivery: '23.1C2' | '24R2B';
  /** What the stage proves, for the checklist. */
  purpose: string;
  regions: readonly RegionCode[];
  status: StageStatus;
}

/** The stages, in release order. The first is what every build has written since 23.1C2; the others are
 * the 24R2B proposal (docs/i18n.md §11a.5): the Spanish-speaking Americas and Spain, the United Kingdom and
 * Canada, Brazil, Japan, India, Germany, Switzerland, then the two space-grouping families nobody else
 * covers (France's narrow no-break space; Poland and Portugal's no-break space with a minimum grouping of
 * two). Together they cover every number family of the catalogue (tested); a region outside every stage
 * stays unreleased until a later stage lists it, after its own families are verified. */
export const REGION_RELEASE_STAGES: readonly RegionReleaseStage[] = [
  { id: 'home', delivery: '23.1C2', purpose: 'Argentina and the United States: the registry, checked on the iPhone since 23.1C2.',
    regions: ['AR', 'US'], status: 'released' },
  { id: 'spanish', delivery: '24R2B', purpose: 'The Spanish-speaking regions: comma and point decimals, a no-break space group (Costa Rica), a minimum grouping of two (Spain), hyphenated and padded dates (Chile), month-first dates (Panama, Puerto Rico), 12-hour clocks.',
    regions: ['BO', 'CL', 'CO', 'CR', 'CU', 'DO', 'EA', 'EC', 'ES', 'GQ', 'GT', 'HN', 'IC', 'MX', 'NI', 'PA', 'PE', 'PR', 'SV', 'UY', 'VE'], status: 'pendingDeviceQa' },
  { id: 'uk-canada', delivery: '24R2B', purpose: 'Point decimals with padded day-first dates and a 24-hour clock (United Kingdom); year-first hyphenated dates (Canada).',
    regions: ['GB', 'CA'], status: 'pendingDeviceQa' },
  { id: 'brazil', delivery: '24R2B', purpose: 'Comma decimals, point groups, padded day-first dates, 24-hour clock.',
    regions: ['BR'], status: 'pendingDeviceQa' },
  { id: 'japan', delivery: '24R2B', purpose: 'Year-first padded dates with a slash, 24-hour clock.',
    regions: ['JP'], status: 'pendingDeviceQa' },
  { id: 'india', delivery: '24R2B', purpose: 'Lakh and crore grouping (12,34,567.89) typed, pasted and read back.',
    regions: ['IN'], status: 'pendingDeviceQa' },
  { id: 'germany', delivery: '24R2B', purpose: 'Comma decimals, point groups, dotted padded dates.',
    regions: ['DE'], status: 'pendingDeviceQa' },
  { id: 'switzerland', delivery: '24R2B', purpose: "An apostrophe group (1'234.56) typed and pasted; dotted dates.",
    regions: ['CH'], status: 'pendingDeviceQa' },
  { id: 'narrow-space', delivery: '24R2B', purpose: 'A narrow no-break space group (U+202F) drawn, typed around and pasted.',
    regions: ['FR'], status: 'pendingDeviceQa' },
  { id: 'space-minimum-two', delivery: '24R2B', purpose: 'A no-break space group with a minimum grouping of two ("1000", "10 000").',
    regions: ['PL', 'PT'], status: 'pendingDeviceQa' },
];

/** A separator as it can be read in a report: ".", ",", "'" as themselves, a space by its code point. */
const visible = (char: string) => /^[.,']$/.test(char) ? char : 'U+' + char.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0');

/** How a region writes numbers: "decimal ',' · group '.' · 3/3 · min 1". Regions with one number family type,
 * paste and group amounts identically, so one of them on the iPhone checks them all. */
export function numberFamily(code: RegionCode): string {
  const c = REGIONS[code];
  return `decimal '${c.decimal}' · group '${visible(c.group)}' · 3/${c.secondaryGrouping} · min ${c.minimumGroupingDigits}`;
}

/** How a region writes dates and times: "dmy '/' · unpadded · 24 h". */
export function dateFamily(code: RegionCode): string {
  const c = REGIONS[code];
  return `${c.dateOrder} '${c.dateSeparator}' · ${c.paddedDate ? 'padded' : 'unpadded'} · ${c.hour12 ? '12 h' : '24 h'}`;
}

/** The families a stage's device QA covers. */
export function stageFamilies(stage: RegionReleaseStage): { numbers: string[]; dates: string[] } {
  return { numbers: [...new Set(stage.regions.map(numberFamily))].sort(), dates: [...new Set(stage.regions.map(dateFamily))].sort() };
}

/** The regions of the stages already released: what `RELEASED_REGIONS` must equal. */
export function releasedByStages(stages: readonly RegionReleaseStage[] = REGION_RELEASE_STAGES): RegionCode[] {
  return stages.filter(stage => stage.status === 'released').flatMap(stage => stage.regions);
}

/** The stage a region is planned in, if any. */
export function stageOf(code: RegionCode, stages: readonly RegionReleaseStage[] = REGION_RELEASE_STAGES): RegionReleaseStage | null {
  return stages.find(stage => stage.regions.includes(code)) ?? null;
}
