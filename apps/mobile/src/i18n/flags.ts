/** 25O1: the visual marks of a region and of a currency (owner, 2026-10-17: «indicadores visuales de países en el
 * selector de Región y, cuando corresponda, en las cuentas»). Pure, so Node pins every code.
 *
 * Semantics, kept apart on purpose (docs/i18n.md §5a):
 *   - A region is a country or territory: its own flag.
 *   - A currency shows the flag of its issuer, always beside its code («🇺🇸 USD»): a mark of the currency, never a claim
 *     about where an account is (an Argentine bank's dollar account is still in Argentina). ISO 4217 names the issuer in
 *     the code's first two letters; the euro is the European Union's; a supranational code (X…: XOF, XAF, XCD, XCG, XPF)
 *     has no single issuer and gets no flag.
 *   - A language never shows a flag (Spanish is not Spain's): its autonym says it.
 *   - An account has no country (it has a currency); adding one would change what the ledger stores (owner decision D16).
 *
 * Flags are the system's emoji (regional indicator pairs), so they scale with Dynamic Type and look like iOS's own; a
 * mark is decoration beside a name that already says it, so VoiceOver never reads it (marks.tsx). */
import { REGION_CODES } from './regions/data.ts';

/** Catalogue regions whose emoji flag older iOS releases draw as two letters: Sark (CQ) arrived with Emoji 16 (iOS 18.4).
 * They get the neutral mark instead of a pair of boxed letters. */
const FLAGLESS: ReadonlySet<string> = new Set(['CQ']);
const FLAGGED: ReadonlySet<string> = new Set([...REGION_CODES.filter(code => !FLAGLESS.has(code)), 'EU']);

const REGIONAL_INDICATOR_A = 0x1f1e6;

/** The emoji flag of a catalogue region (or of the European Union), or null when there is none to draw. */
export function regionFlag(code: string): string | null {
  if (!FLAGGED.has(code)) return null;
  return String.fromCodePoint(REGIONAL_INDICATOR_A + code.charCodeAt(0) - 65, REGIONAL_INDICATOR_A + code.charCodeAt(1) - 65);
}

/** The region that issues a currency (ISO 4217: its first two letters; the euro: EU), or null for a supranational code. */
export function currencyIssuer(code: string): string | null {
  if (code === 'EUR') return 'EU';
  if (!/^[A-Z]{3}$/.test(code) || code.startsWith('X')) return null;
  const region = code.slice(0, 2);
  return FLAGGED.has(region) ? region : null;
}

/** The flag beside a currency's code, or null (the neutral mark is drawn instead). */
export function currencyFlag(code: string): string | null {
  const issuer = currencyIssuer(code);
  return issuer ? regionFlag(issuer) : null;
}
