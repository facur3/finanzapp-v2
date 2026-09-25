/** The rows of a searchable single-choice list (Producto 24R1): what the
 * future Región and Idioma choosers show, computed without React so every
 * arrangement is testable in Node.
 *
 *   - a pinned option first ("Según el dispositivo"), always visible, never
 *     filtered out and never in a lettered section;
 *   - then, without a query, the recent choices under one header;
 *   - then the options in alphabetical sections by the initial of their name
 *     (folded: "Álava" sits under A), ordered as the caller ordered them
 *     (the region catalogue uses the language's collator);
 *   - with a query, one flat list of the matches in the caller's ranking, no
 *     headers, the pinned option still first; nothing at all when nothing
 *     matches (the screen shows its empty sentence).
 * A search field is worth showing only from `SEARCHABLE_CHOICES` options: two
 * languages or two regions are read, not searched. Rows carry their position
 * inside their group so a virtualized list can draw grouped corners. */
import { foldText } from '../i18n/intl-support.ts';

export interface ChoiceOption<T extends string = string> {
  value: T;
  title: string;
  subtitle?: string;
  /** The language the title is in when it is an autonym ("English"): VoiceOver speaks it with that voice. */
  language?: string;
  /** Folded text a search matches; the folded title when absent. */
  searchText?: string;
}

export type GroupPosition = 'only' | 'first' | 'middle' | 'last';
export type ChoiceRow<T extends string = string> =
  | { kind: 'header'; key: string; title: string }
  | { kind: 'choice'; key: string; option: ChoiceOption<T>; position: GroupPosition; selected: boolean };

/** From how many options a chooser shows its search field. */
export const SEARCHABLE_CHOICES = 6;

/** The initial a name files under: its first letter without accents, upper case; "#" when it has none. */
export function sectionInitial(title: string): string {
  const first = foldText(title).replace(/[^a-z0-9]/g, '')[0];
  return first && /[a-z]/.test(first) ? first.toUpperCase() : '#';
}

/** Options whose title, value or search text contains the folded query, in the given order, ranked
 * like the currency and region searches: exact value, value prefix, title prefix, any match. */
export function filterChoices<T extends string>(query: string, options: readonly ChoiceOption<T>[]): ChoiceOption<T>[] {
  const needle = foldText(query);
  if (!needle) return [...options];
  const score = (option: ChoiceOption<T>) => {
    const value = option.value.toLowerCase();
    if (value === needle) return 0;
    if (value.startsWith(needle)) return 1;
    if (foldText(option.title).startsWith(needle)) return 2;
    return (option.searchText ?? foldText(option.title)).includes(needle) ? 3 : -1;
  };
  return options.map((option, index) => ({ option, index, score: score(option) })).filter(entry => entry.score >= 0)
    .sort((a, b) => a.score - b.score || a.index - b.index).map(entry => entry.option);
}

function grouped<T extends string>(options: readonly ChoiceOption<T>[], selected: T | null, prefix: string): ChoiceRow<T>[] {
  return options.map((option, index) => ({ kind: 'choice', key: prefix + option.value, option, selected: option.value === selected,
    position: options.length === 1 ? 'only' : index === 0 ? 'first' : index === options.length - 1 ? 'last' : 'middle' }));
}

export function buildChoiceRows<T extends string>({ pinned, recent = [], options, selected, query = '', recentTitle }: {
  /** The option shown first, outside every section ("Según el dispositivo"). */
  pinned?: ChoiceOption<T>;
  /** Values to list under "Recientes" (most recent first); unknown values are skipped. */
  recent?: readonly T[];
  options: readonly ChoiceOption<T>[];
  selected: T | null;
  query?: string;
  recentTitle: string;
}): ChoiceRow<T>[] {
  const rows: ChoiceRow<T>[] = [];
  if (pinned) rows.push(...grouped([pinned], selected, 'pinned:'));
  const trimmed = query.trim();
  if (trimmed) {
    rows.push(...grouped(filterChoices(trimmed, options), selected, 'match:'));
    return rows;
  }
  const byValue = new Map(options.map(option => [option.value, option]));
  const recentOptions = recent.map(value => byValue.get(value)).filter((option): option is ChoiceOption<T> => option !== undefined);
  if (recentOptions.length) {
    rows.push({ kind: 'header', key: 'header:recent', title: recentTitle });
    rows.push(...grouped(recentOptions, selected, 'recent:'));
  }
  const sections = new Map<string, ChoiceOption<T>[]>();
  for (const option of options) {
    const initial = sectionInitial(option.title);
    if (!sections.has(initial)) sections.set(initial, []);
    sections.get(initial)!.push(option);
  }
  for (const [initial, members] of sections) {
    rows.push({ kind: 'header', key: 'header:' + initial, title: initial });
    rows.push(...grouped(members, selected, initial + ':'));
  }
  return rows;
}
