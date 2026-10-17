/** A separate, empty profile for device QA on the owner's own iPhone (milestone M1, 2026-10-17: «sin poner en riesgo los
 * datos del iPhone»). A development bundle started with `EXPO_PUBLIC_QA_PROFILE=<name>` opens its own ledger, rate and
 * review files (`finanzapp-native-pilot-v1.qa-<name>.sqlite`…) and reads and writes its preferences under keys prefixed
 * `qa-<name>:`, so the app behaves as a new installation (the first opening included) while the person's ledger, rate and
 * review files are never opened and their preference keys never read or written (the profile's prefixed keys live in the
 * same key-value store, and stay there). Restarting Metro without the variable returns to them untouched; restarting with the
 * same name returns to the same test profile. A release or preview bundle compiles the flag away (`__DEV__` is false).
 * Pure, so Node pins it. */
/** The key-value store's three calls (the shape of `PreferenceStore`, kept here so this module depends on nothing). */
type KeyValueStore = { getItemSync(key: string): string | null; setItemSync(key: string, value: string): void; removeItemSync(key: string): boolean };

declare const __DEV__: boolean | undefined;

/** The profile a bundle runs, or null for the person's own data. Any non-empty value names a profile (folded to letters
 * and digits; «qa» when nothing is left), so a mistyped name can never fall through to the real files. */
export function qaProfileForBuild(value: string | undefined, development: boolean): string | null {
  if (!development || !value?.trim()) return null;
  return value.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 16) || 'qa';
}

export const BUILD_QA_PROFILE = qaProfileForBuild(process.env.EXPO_PUBLIC_QA_PROFILE, typeof __DEV__ !== 'undefined' && __DEV__);

/** A database file of the profile: the person's own name without one. */
export function profiledDatabase(name: string, profile: string | null = BUILD_QA_PROFILE): string {
  return profile ? name.replace(/\.sqlite$/, '') + `.qa-${profile}.sqlite` : name;
}

/** The preference store of the profile: every key prefixed, the person's own keys never touched. */
export function profiledStore<T extends KeyValueStore>(store: T, profile: string | null = BUILD_QA_PROFILE): KeyValueStore {
  if (!profile) return store;
  const key = (name: string) => `qa-${profile}:${name}`;
  return {
    getItemSync: name => store.getItemSync(key(name)),
    setItemSync: (name, value) => store.setItemSync(key(name), value),
    removeItemSync: name => store.removeItemSync(key(name)),
  };
}
