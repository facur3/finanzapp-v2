/** The last choices a chooser saw (Producto 24R1): a few recent regions or
 * languages, listed under "Según el dispositivo" before the alphabetical list,
 * so a person who alternates between two places does not search twice. One
 * key per chooser in the key-value store, beside the preferences and like them
 * outside the ledger and outside backups. A list that cannot be read is empty;
 * a list that cannot be written is simply not remembered: neither is an error,
 * and neither touches a stored amount or a saved preference. Pure. */
import { defaultPreferenceStore, type PreferenceStore } from './preference.ts';

export const RECENT_KEYS = { language: 'finanzapp.recent.language', region: 'finanzapp.recent.region' } as const;
export type RecentKind = keyof typeof RECENT_KEYS;
/** How many recent choices a chooser lists. */
export const RECENT_LIMIT = 3;

/** The recent values of a kind, most recent first, keeping only those `accept` still recognises
 * (a code the catalogue dropped, or junk in the store, is skipped, never shown). */
export function readRecent<T extends string>(kind: RecentKind, accept: (value: unknown) => value is T, store: () => PreferenceStore = defaultPreferenceStore): T[] {
  try {
    const parsed: unknown = JSON.parse(store().getItemSync(RECENT_KEYS[kind]) ?? '[]');
    if (!Array.isArray(parsed)) return [];
    const seen = new Set<T>();
    for (const value of parsed) if (accept(value) && !seen.has(value)) seen.add(value);
    return [...seen].slice(0, RECENT_LIMIT);
  } catch { return []; }
}

/** Puts `value` first (once) and keeps at most `RECENT_LIMIT`. Returns whether the write landed. */
export function rememberRecent<T extends string>(kind: RecentKind, value: T, accept: (value: unknown) => value is T, store: () => PreferenceStore = defaultPreferenceStore): boolean {
  const next = [value, ...readRecent(kind, accept, store).filter(item => item !== value)].slice(0, RECENT_LIMIT);
  try { store().setItemSync(RECENT_KEYS[kind], JSON.stringify(next)); return true; } catch { return false; }
}
