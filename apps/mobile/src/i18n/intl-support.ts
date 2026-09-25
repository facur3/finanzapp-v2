/** What this JavaScript engine's `Intl` can do, probed and never assumed
 * (Producto 24R1). Hermes on iOS carries a reduced `Intl` (Collator,
 * DateTimeFormat and NumberFormat; no PluralRules, DisplayNames,
 * RelativeTimeFormat or ListFormat, see docs/i18n.md), and a constructor
 * that exists may still refuse a locale or an option. FinanzApp therefore
 * writes every visible format itself from CLDR tables (`format.ts`, the
 * region catalogue) and uses `Intl` only where a table cannot stand in:
 *   - `Intl.Collator` to order names in the person's language (a chooser),
 *     with a folding comparison when it is missing or refuses the language;
 *   - `Intl.PluralRules` for plural categories (`messages.ts`), with the
 *     one/other rule otherwise;
 *   - `Intl.DateTimeFormat().resolvedOptions().locale` to read the runtime
 *     locale when the native module is absent (`device.ts`).
 * Nothing here formats money: no float ever stands for an amount. Pure. */

export interface IntlCapabilities {
  readonly numberFormat: boolean;
  readonly dateTimeFormat: boolean;
  readonly collator: boolean;
  readonly pluralRules: boolean;
  readonly displayNames: boolean;
  readonly relativeTimeFormat: boolean;
  readonly listFormat: boolean;
  /** `String.prototype.normalize`, which the folding comparison and the search use to drop accents. */
  readonly normalize: boolean;
}

/** The `Intl` object to probe: the runtime's when omitted, a stand-in in tests, `null` for an engine without one. */
type IntlLike = Record<string, unknown> | null | undefined;

const usable = (intl: IntlLike, name: string, construct: (ctor: new (...args: any[]) => unknown) => unknown): boolean => {
  const ctor = intl?.[name];
  if (typeof ctor !== 'function') return false;
  try { construct(ctor as new (...args: any[]) => unknown); return true; } catch { return false; }
};

/** Probes each constructor by building one instance for a sample locale: a constructor that is
 * present but throws counts as absent. `intl` defaults to the runtime's; tests pass a stand-in. */
export function probeIntl(intl: IntlLike = (globalThis as { Intl?: IntlLike }).Intl): IntlCapabilities {
  intl = intl ?? undefined;
  return {
    numberFormat: usable(intl, 'NumberFormat', Ctor => new Ctor('en')),
    dateTimeFormat: usable(intl, 'DateTimeFormat', Ctor => new Ctor('en')),
    collator: usable(intl, 'Collator', Ctor => new Ctor('en', { sensitivity: 'base' })), // i18n-ignore
    pluralRules: usable(intl, 'PluralRules', Ctor => new Ctor('en')),
    displayNames: usable(intl, 'DisplayNames', Ctor => new Ctor('en', { type: 'region' })),
    relativeTimeFormat: usable(intl, 'RelativeTimeFormat', Ctor => new Ctor('en')),
    listFormat: usable(intl, 'ListFormat', Ctor => new Ctor('en')),
    normalize: (() => { try { return 'é'.normalize('NFD').length === 2; } catch { return false; } })(),
  };
}

/** Text folded for search and ordering: accents dropped where the engine can decompose them, then
 * lower case. Without `normalize` the text is only lower-cased, so a search still finds exact spellings. */
export function foldText(text: string): string {
  let base = String(text ?? '');
  try { base = base.normalize('NFD').replace(/[̀-ͯ]/g, ''); } catch { /* No normalize: keep the accents. */ }
  return base.toLowerCase().trim();
}

/** A comparison of names in a language: `Intl.Collator` (base sensitivity: accents and case do not
 * separate "Álava" from "Alava") when the engine has it and accepts the language, otherwise a
 * deterministic folding comparison, so a chooser is alphabetical on every engine. The result names
 * which one is in use, so a screen or a test can say so. */
export function nameComparator(language: string, intl: IntlLike = (globalThis as { Intl?: IntlLike }).Intl): { compare: (a: string, b: string) => number; source: 'collator' | 'fold' } {
  const Collator = (intl ?? undefined)?.Collator;
  if (typeof Collator === 'function') {
    try {
      const collator = new (Collator as new (...args: any[]) => { compare: (a: string, b: string) => number })(language, { sensitivity: 'base', numeric: false }); // i18n-ignore
      const compare = collator.compare.bind(collator);
      compare('a', 'b'); // A collator that exists but cannot compare is treated as absent.
      return { compare, source: 'collator' };
    } catch { /* Fall through to the folding comparison. */ }
  }
  return { source: 'fold', compare: (a, b) => {
    const fa = foldText(a), fb = foldText(b);
    return fa < fb ? -1 : fa > fb ? 1 : a < b ? -1 : a > b ? 1 : 0;
  } };
}
