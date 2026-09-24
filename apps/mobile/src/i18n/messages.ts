/** Typed message lookup. Catalogues belong to a language, not to a locale:
 * the region never changes a word, so English with Argentine formats and
 * English with US formats read the same catalogue. `Messages` is the shape of the Spanish catalogue with
 * every leaf widened to a string (or a plural pair), so the English catalogue
 * must carry exactly the same keys. `t` resolves a dotted key, fills `{name}`
 * placeholders and picks the plural form for `{count}` by the language's CLDR
 * rule (`pluralCategory`). Pure: no React, no device access. */
import { es } from './messages/es/index.ts';
import { en } from './messages/en/index.ts';
import { DEFAULT_LANGUAGE, type LanguageCode } from './locale.ts';

/** A plural entry: `one` and `other` always (the Spanish reference has both);
 * a language whose CLDR rule has more categories (Arabic, Polish, Russian…)
 * adds `zero`, `two`, `few` or `many`. A missing category reads `other`. */
export type PluralCategory = 'zero' | 'one' | 'two' | 'few' | 'many' | 'other';
export type PluralForms = { one: string; other: string } & Partial<Record<Exclude<PluralCategory, 'one' | 'other'>, string>>;
type Widen<T> = T extends string ? string : T extends { one: string; other: string } ? PluralForms : { [K in keyof T]: Widen<T[K]> };
export type Messages = Widen<typeof es>;

type Leaves<T, Prefix extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${Prefix}${K}` : T[K] extends PluralForms ? `${Prefix}${K}` : Leaves<T[K], `${Prefix}${K}.`>;
}[keyof T & string];
/** Every dotted key of the catalogue ("common.cancel", "count.movements"). */
export type MessageKey = Leaves<Messages>;

export type MessageParams = Record<string, string | number>;

/** One catalogue per language in `LANGUAGES`: a language without one is a compile error. */
const catalogues: Record<LanguageCode, Messages> = { es, en };

const CATEGORIES = new Set<string>(['zero', 'one', 'two', 'few', 'many', 'other']);
/** A plural entry: an object whose keys are all CLDR categories, `other` among them, each a string. A
 * namespace that happens to hold an id called "other" (an icon, a category) is not a plural. */
export function isPluralEntry(value: unknown): value is PluralForms {
  if (!value || typeof value !== 'object' || typeof (value as { other?: unknown }).other !== 'string') return false;
  return Object.entries(value).every(([key, text]) => CATEGORIES.has(key) && typeof text === 'string');
}

export function catalogue(language: LanguageCode): Messages {
  return catalogues[language] ?? catalogues[DEFAULT_LANGUAGE];
}

function lookup(messages: Messages, key: string): string | PluralForms | undefined {
  let node: unknown = messages;
  for (const part of key.split('.')) {
    if (!node || typeof node !== 'object' || !(part in (node as object))) return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === 'string' || isPluralEntry(node) ? node as string | PluralForms : undefined;
}

/** Fills `{name}` placeholders. A placeholder without a value stays visible, so a missing parameter is noticed rather than blank. */
export function interpolate(template: string, params: MessageParams = {}): string {
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, name: string) => name in params ? String(params[name]) : match);
}

/** The message for `key` in `language`, falling back to Spanish for a key the
 * language lacks and to the key itself when nothing has it (never an empty
 * label). A plural entry needs `count`. */
export function translate(language: LanguageCode, key: MessageKey, params?: MessageParams): string {
  const entry = lookup(catalogue(language), key) ?? lookup(es as unknown as Messages, key);
  if (entry === undefined) return key;
  if (typeof entry === 'string') return interpolate(entry, params);
  const category = pluralCategory(language, Number(params?.count));
  return interpolate(entry[category] ?? (category === 'one' ? entry.one : entry.other), params);
}

const rules = new Map<string, Intl.PluralRules | null>();
/** The CLDR plural category of `count` in `language`, from `Intl.PluralRules`
 * when the engine has it (Node does; Hermes on iOS does not: its Intl has only
 * Collator, DateTimeFormat and NumberFormat, checked at hermes-v250829098.0.17).
 * Without it, or for a value it cannot classify, the one/other rule Spanish and
 * English share: exactly 1 is "one". A language with more categories needs a
 * committed CLDR rule table before its release (docs/i18n.md §1). */
export function pluralCategory(language: string, count: number): PluralCategory {
  if (!rules.has(language)) {
    try { rules.set(language, typeof Intl !== 'undefined' && Intl.PluralRules ? new Intl.PluralRules(language) : null); }
    catch { rules.set(language, null); }
  }
  const rule = rules.get(language);
  if (rule && Number.isFinite(count)) {
    try { return rule.select(count) as PluralCategory; } catch { /* fall through */ }
  }
  return count === 1 ? 'one' : 'other';
}

/** A translator bound to one language, the shape components receive. */
export type Translate = (key: MessageKey, params?: MessageParams) => string;
export function translator(language: LanguageCode): Translate {
  return (key, params) => translate(language, key, params);
}

/** All dotted keys of a catalogue, for the completeness test. */
export function messageKeys(messages: object, prefix = ''): string[] {
  return Object.entries(messages).flatMap(([key, value]) =>
    typeof value === 'string' || isPluralEntry(value) ? [prefix + key] : messageKeys(value as object, prefix + key + '.'));
}
