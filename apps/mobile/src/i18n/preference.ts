/** The language preference, a device setting rather than ledger data: it
 * lives in expo-sqlite's key-value store (already bundled; no new module),
 * outside the financial database and outside backups, so importing a copy on
 * another phone never changes that phone's language. The next phase adds the
 * screen that writes it; this one only reads and validates it. An unreadable
 * store means "follow the device", never an error. */
import { languagePreferenceFrom, type LanguagePreference } from './locale.ts';

export const LANGUAGE_PREFERENCE_KEY = 'finanzapp.language';

export interface PreferenceStore { getItemSync(key: string): string | null; setItemSync(key: string, value: string): void; removeItemSync(key: string): boolean }

function defaultStore(): PreferenceStore {
  return (require('expo-sqlite/kv-store') as { Storage: PreferenceStore }).Storage;
}

export function readLanguagePreference(store: () => PreferenceStore = defaultStore): LanguagePreference {
  try { return languagePreferenceFrom(store().getItemSync(LANGUAGE_PREFERENCE_KEY)); } catch { return 'system'; }
}

/** Persists a choice; "system" removes the entry so the device decides again. Returns whether the write landed. */
export function writeLanguagePreference(preference: LanguagePreference, store: () => PreferenceStore = defaultStore): boolean {
  try {
    if (preference === 'system') store().removeItemSync(LANGUAGE_PREFERENCE_KEY);
    else store().setItemSync(LANGUAGE_PREFERENCE_KEY, preference);
    return true;
  } catch { return false; }
}
