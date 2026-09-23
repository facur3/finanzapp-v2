/** Typed message lookup. `Messages` is the shape of the Spanish catalogue with
 * every leaf widened to a string (or a plural pair), so the English catalogue
 * must carry exactly the same keys. `t` resolves a dotted key, fills `{name}`
 * placeholders and picks the plural form for `{count}`. Spanish and English
 * share one plural rule (one vs. other), so no Intl.PluralRules is needed on
 * Hermes. Pure: no React, no device access. */
import { es } from './messages/es-AR.ts';
import { en } from './messages/en-US.ts';
import { DEFAULT_LOCALE, type AppLocale } from './locale.ts';

export type PluralForms = { one: string; other: string };
type Widen<T> = T extends string ? string : T extends { one: string; other: string } ? PluralForms : { [K in keyof T]: Widen<T[K]> };
export type Messages = Widen<typeof es>;

type Leaves<T, Prefix extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${Prefix}${K}` : T[K] extends PluralForms ? `${Prefix}${K}` : Leaves<T[K], `${Prefix}${K}.`>;
}[keyof T & string];
/** Every dotted key of the catalogue ("common.cancel", "count.movements"). */
export type MessageKey = Leaves<Messages>;

export type MessageParams = Record<string, string | number>;

const catalogues: Record<AppLocale, Messages> = { 'es-AR': es, 'en-US': en };

export function catalogue(locale: AppLocale): Messages {
  return catalogues[locale] ?? catalogues[DEFAULT_LOCALE];
}

function lookup(messages: Messages, key: string): string | PluralForms | undefined {
  let node: unknown = messages;
  for (const part of key.split('.')) {
    if (!node || typeof node !== 'object' || !(part in (node as object))) return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === 'string' || (node && typeof node === 'object' && 'one' in node) ? node as string | PluralForms : undefined;
}

/** Fills `{name}` placeholders. A placeholder without a value stays visible, so a missing parameter is noticed rather than blank. */
export function interpolate(template: string, params: MessageParams = {}): string {
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, name: string) => name in params ? String(params[name]) : match);
}

/** The message for `key` in `locale`, falling back to Spanish for a key the
 * locale lacks and to the key itself when nothing has it (never an empty
 * label). A plural entry needs `count`. */
export function translate(locale: AppLocale, key: MessageKey, params?: MessageParams): string {
  const entry = lookup(catalogue(locale), key) ?? lookup(es as unknown as Messages, key);
  if (entry === undefined) return key;
  if (typeof entry === 'string') return interpolate(entry, params);
  const count = Number(params?.count);
  return interpolate(count === 1 ? entry.one : entry.other, params);
}

/** A translator bound to one locale, the shape components receive. */
export type Translate = (key: MessageKey, params?: MessageParams) => string;
export function translator(locale: AppLocale): Translate {
  return (key, params) => translate(locale, key, params);
}

/** All dotted keys of a catalogue, for the completeness test. */
export function messageKeys(messages: object, prefix = ''): string[] {
  return Object.entries(messages).flatMap(([key, value]) =>
    typeof value === 'string' || (value && typeof value === 'object' && 'one' in value) ? [prefix + key] : messageKeys(value as object, prefix + key + '.'));
}
