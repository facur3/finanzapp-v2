/** The language and region preferences, device settings rather than ledger
 * data: they live in expo-sqlite's key-value store (already bundled; no new
 * module), outside the financial database and outside backups, so importing a
 * copy on another phone never changes that phone's language or region, and
 * changing either never rewrites a stored amount, name or date. Each is its
 * own key; "follow the device" is the absence of the key. An unreadable store
 * means "follow the device", never an error and never a reset of anything. */
import { languagePreferenceFrom, regionPreferenceFrom, type LanguagePreference, type LocalePreferences, type RegionPreference } from './locale.ts';

export const LANGUAGE_PREFERENCE_KEY = 'finanzapp.language';
export const REGION_PREFERENCE_KEY = 'finanzapp.region';

export interface PreferenceStore { getItemSync(key: string): string | null; setItemSync(key: string, value: string): void; removeItemSync(key: string): boolean }

export function defaultPreferenceStore(): PreferenceStore {
  return (require('expo-sqlite/kv-store') as { Storage: PreferenceStore }).Storage;
}

function read<T>(key: string, parse: (stored: unknown) => T, fallback: T, store: () => PreferenceStore): T {
  try { return parse(store().getItemSync(key)); } catch { return fallback; }
}

/** Persists a choice; "system" removes the entry so the device decides again.
 * Returns whether the write landed: the caller changes nothing on false. */
function write(key: string, value: string, store: () => PreferenceStore): boolean {
  try {
    if (value === 'system') store().removeItemSync(key);
    else store().setItemSync(key, value);
    return true;
  } catch { return false; }
}

export function readLanguagePreference(store: () => PreferenceStore = defaultPreferenceStore): LanguagePreference {
  return read(LANGUAGE_PREFERENCE_KEY, languagePreferenceFrom, 'system', store);
}
export function readRegionPreference(store: () => PreferenceStore = defaultPreferenceStore): RegionPreference {
  return read(REGION_PREFERENCE_KEY, regionPreferenceFrom, 'system', store);
}
export function readLocalePreferences(store: () => PreferenceStore = defaultPreferenceStore): LocalePreferences {
  return { language: readLanguagePreference(store), region: readRegionPreference(store) };
}

export function writeLanguagePreference(preference: LanguagePreference, store: () => PreferenceStore = defaultPreferenceStore): boolean {
  return write(LANGUAGE_PREFERENCE_KEY, preference, store);
}
export function writeRegionPreference(preference: RegionPreference, store: () => PreferenceStore = defaultPreferenceStore): boolean {
  return write(REGION_PREFERENCE_KEY, preference, store);
}
