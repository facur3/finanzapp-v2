/** Where a region puts its group separators in the whole digits of a number (Producto 24R2A):
 * one rule for every writer, so the formatters (`format.ts`) and the amount field
 * (`ui/money-input.ts`) can never group the same digits two ways.
 *   - the last group has three digits;
 *   - the groups before it have `secondaryGrouping` digits (3 almost everywhere, 2 for the
 *     Indian lakh and crore: "12,34,567");
 *   - no separator at all while the number has fewer than 3 + `minimumGroupingDigits` digits
 *     (CLDR's minimum grouping: Spain and Poland write "1000" and "10 000").
 * The separator itself is the region's (".", ",", "'", a no-break or a narrow no-break space) and
 * is always one character. Pure; digits in, digits out, no number is computed. */

export interface Grouping { secondaryGrouping?: number; minimumGroupingDigits?: number }

const PRIMARY = 3;

/** The positions, counted in digits from the start, after which a separator goes ("1234567" in
 * groups of three → [1, 4]; in lakh → [2, 4]). Ascending; empty below the minimum grouping. */
export function groupBreaks(length: number, grouping: Grouping = {}): number[] {
  const secondary = Math.max(1, grouping.secondaryGrouping ?? PRIMARY);
  const minimum = Math.max(1, grouping.minimumGroupingDigits ?? 1);
  if (length < PRIMARY + minimum) return [];
  const breaks: number[] = [];
  for (let at = length - PRIMARY; at > 0; at -= secondary) breaks.unshift(at);
  return breaks;
}

/** The digits with the separator at every break. */
export function groupWhole(digits: string, separator: string, grouping: Grouping = {}): string {
  let out = '', from = 0;
  for (const at of groupBreaks(digits.length, grouping)) { out += digits.slice(from, at) + separator; from = at; }
  return out + digits.slice(from);
}
