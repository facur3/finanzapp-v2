/** 25O1: which flag marks a region, a currency or a language (owner, 2026-10-17: «indicadores visuales de países en el
 * selector de Región y, cuando corresponda, en las cuentas»; then: round graphic flags, and a representative one for
 * Idioma). Each function answers with the region whose round flag to draw (`flag-art.ts`, drawn by `src/ui/marks.tsx`),
 * or null. Pure, so Node pins every code.
 *
 * Semantics, kept apart on purpose (docs/i18n.md §11a.2, docs/currency.md §1):
 *   - A region is a country or territory: its own flag.
 *   - A currency shows the flag of its issuer, always beside its code (USD with the United States'): a mark of the
 *     currency, never a claim about where an account is (an Argentine bank's dollar account is still in Argentina). ISO
 *     4217 names the issuer in the code's first two letters; the euro is the European Union's; a supranational code (X…:
 *     XOF, XAF, XCD, XCG, XPF) has no single issuer and gets no flag.
 *   - A language shows the flag of the variety its catalogue is written in (`SPEECH_REGIONS`: the Spanish copy is
 *     rioplatense, with voseo, so Argentina's; the English copy is American), and the Idioma chooser says so in words under
 *     each language; elsewhere (Más, the first opening's pill) the flag sits beside the language's name. Never the flag of
 *     a country the language merely comes from.
 *   - An account has no country (it has a currency); adding one would change what the ledger stores (an open owner decision).
 *
 * The flags are vector art, the same on every iOS release (Sark included, which the system's emoji drew as two letters
 * before iOS 18.4); a mark is decoration beside a name that already says it, so VoiceOver never reads it. */
import { FLAG_ART } from './flag-art.ts';
import { SPEECH_REGIONS, type LanguageCode, type RegionCode } from './locale.ts';

/** The region whose flag marks a catalogue region (itself) or the European Union, or null when there is none to draw. */
export function regionFlag(code: string): string | null {
  return Object.hasOwn(FLAG_ART, code) ? code : null;
}

/** The region that issues a currency (ISO 4217: its first two letters; the euro: EU), or null for a supranational code. */
export function currencyIssuer(code: string): string | null {
  if (code === 'EUR') return 'EU';
  if (!/^[A-Z]{3}$/.test(code) || code.startsWith('X')) return null;
  return regionFlag(code.slice(0, 2));
}

/** The flag beside a currency's code: its issuer's, or null (the neutral mark is drawn instead). */
export const currencyFlag = currencyIssuer;

/** The flag of a language: the region whose variety its catalogue is written in. */
export function languageFlag(language: LanguageCode): RegionCode {
  return SPEECH_REGIONS[language];
}
