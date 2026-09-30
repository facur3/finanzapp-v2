/** Producto 24UX6A: Más → Apariencia. Which scheme FinanzApp draws: the device's (Sistema, the default), or always light
 * or always dark. Pure (no React, no React Native), so Node tests it directly; `theme.ts` subscribes to it.
 *
 * Rules:
 *   - a device setting, not ledger data: it lives in the same key-value store as the language and the region, outside
 *     the financial database and outside backups, so restoring a copy never changes how this iPhone looks;
 *   - "Sistema" is the absence of the key; an unreadable store follows the system, never an error;
 *   - a choice is saved before it is applied: a refused write changes nothing and `set` returns false;
 *   - iOS is told the same choice (`apply`, `Appearance.setColorScheme` in the app), so what the system draws for the app
 *     (alerts, the keyboard, the date wheel, glass) matches the palette; "Sistema" hands the decision back to the device.
 *     The store applies the stored choice when it is created, before the first frame, so the app never flashes the other
 *     scheme. The native launch screen, drawn before any JavaScript, follows the device; the first frame after it is right. */
import type { PreferenceStore } from '../i18n/preference.ts';

export type ThemePreference = 'system' | 'light' | 'dark';
export type ColorScheme = 'light' | 'dark';
/** What iOS is told: a fixed scheme, or `unspecified` so the device decides (React Native's `Appearance.setColorScheme`). */
export type NativeScheme = ColorScheme | 'unspecified';

export const THEME_PREFERENCES: readonly ThemePreference[] = ['system', 'light', 'dark'];
export const THEME_PREFERENCE_KEY = 'finanzapp.appearance';

export function themePreferenceFrom(stored: unknown): ThemePreference {
  return stored === 'light' || stored === 'dark' ? stored : 'system';
}

/** The scheme the app draws: the person's choice, or the device's while it follows the system (a device that does not
 * say reads as light, the iOS default). */
export function effectiveScheme(preference: ThemePreference, system: string | null | undefined): ColorScheme {
  if (preference !== 'system') return preference;
  return system === 'dark' ? 'dark' : 'light';
}

export function nativeScheme(preference: ThemePreference): NativeScheme {
  return preference === 'system' ? 'unspecified' : preference;
}

export interface ThemePreferenceStore {
  getState: () => ThemePreference;
  subscribe: (listener: () => void) => () => void;
  /** Saves and applies a choice. False when refused or not saved; the state is then unchanged. */
  set: (preference: ThemePreference) => boolean;
}

export function createThemePreferenceStore(store: () => PreferenceStore, apply: (scheme: NativeScheme) => void = () => {}): ThemePreferenceStore {
  let state: ThemePreference;
  try { state = themePreferenceFrom(store().getItemSync(THEME_PREFERENCE_KEY)); } catch { state = 'system'; }
  // A failing native call keeps the palette's own decision; the app still draws the chosen scheme.
  const tell = (preference: ThemePreference) => { try { apply(nativeScheme(preference)); } catch { /* the palette still follows the choice */ } };
  tell(state);
  const listeners = new Set<() => void>();
  return {
    getState: () => state,
    subscribe: listener => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    set: preference => {
      if (!THEME_PREFERENCES.includes(preference)) return false;
      try {
        if (preference === 'system') store().removeItemSync(THEME_PREFERENCE_KEY);
        else store().setItemSync(THEME_PREFERENCE_KEY, preference);
      } catch { return false; }
      tell(preference);
      if (preference !== state) {
        state = preference;
        for (const listener of [...listeners]) listener();
      }
      return true;
    },
  };
}
