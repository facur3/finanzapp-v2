import { createContext, createElement, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { AccessibilityInfo, AppState, Appearance, useColorScheme } from 'react-native';
import { todayKey } from '@finanzapp/domain';

import { defaultPreferenceStore } from '../i18n/preference';
import { subscribeIncreaseContrast, subscribeReduceTransparency } from './material-policy';
import { darkPalette, lightPalette, type PaletteColors } from './palette';
import { createThemePreferenceStore, effectiveScheme, type ThemePreference, type ThemePreferenceStore } from './theme-preference';

export type Palette = PaletteColors & {
  isDark: boolean;
  /** 25D1: iOS's Increase Contrast is on: what is drawn quieter for composition (a hero's symbol and cents) is drawn at
   * full strength. Absent where no provider answers (a test palette), which reads as off. */
  increaseContrast?: boolean;
};

/** The four palettes a screen can draw (scheme × Increase Contrast), built once, so every render hands out the same object. */
const built = (base: PaletteColors, isDark: boolean): readonly [Palette, Palette] => [{ ...base, isDark, increaseContrast: false }, { ...base, isDark, increaseContrast: true }];
const LIGHT = built(lightPalette, false), DARK = built(darkPalette, true);

let themeStore: ThemePreferenceStore | null = null;
/** The app's one Apariencia preference (24UX6A), created on first use and applied to iOS then: the root layout creates
 * it before its first render, so the first frame is already in the chosen scheme. */
export function themePreferenceStore(): ThemePreferenceStore {
  return themeStore ??= createThemePreferenceStore(defaultPreferenceStore, scheme => Appearance.setColorScheme(scheme));
}

/** The Apariencia choice and its setter (Más → Apariencia). `system` is the device's scheme, meaningful while the
 * choice is Sistema (a fixed choice overrides what iOS reports). */
export function useThemePreference(): { preference: ThemePreference; setPreference: (preference: ThemePreference) => boolean; system: 'light' | 'dark' } {
  const store = themePreferenceStore();
  const preference = useSyncExternalStore(store.subscribe, store.getState, store.getState);
  return { preference, setPreference: store.set, system: useColorScheme() === 'dark' ? 'dark' : 'light' };
}

/** Every screen's colours: the scheme is the Apariencia choice, or the device's while it follows the system. */
export function usePalette(): Palette {
  const store = themePreferenceStore();
  const preference = useSyncExternalStore(store.subscribe, store.getState, store.getState);
  const isDark = effectiveScheme(preference, useColorScheme()) === 'dark';
  const increaseContrast = useContext(IncreaseContrastContext);
  return (isDark ? DARK : LIGHT)[increaseContrast ? 1 : 0];
}

export { radius, space, type } from './tokens';

const ReduceMotionContext = createContext(true);
// Defaults to true: until iOS answers, a control is drawn on its opaque material, never on a missing effect.
const ReduceTransparencyContext = createContext(true);
// Defaults to false: the design as drawn until iOS says Increase Contrast is on.
const IncreaseContrastContext = createContext(false);
const DayContext = createContext(todayKey());

// One native accessibility subscription per setting, not one request/listener per row.
export function UIProvider({ children }: { children: ReactNode }) {
  const [reduced, setReduced] = useState(true);
  const [reducedTransparency, setReducedTransparency] = useState(true);
  const [increaseContrast, setIncreaseContrast] = useState(false);
  const [day, setDay] = useState(todayKey);
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (mounted) setReduced(value); }).catch(() => {});
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    // iOS only, and feature-detected: an older or mismatched runtime without the API, or one that throws, keeps the opaque material.
    const transparency = subscribeReduceTransparency(AccessibilityInfo as Parameters<typeof subscribeReduceTransparency>[0], setReducedTransparency);
    const contrast = subscribeIncreaseContrast(AccessibilityInfo as Parameters<typeof subscribeIncreaseContrast>[0], setIncreaseContrast);
    return () => { mounted = false; subscription.remove(); transparency(); contrast(); };
  }, []);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const update = () => {
      clearTimeout(timer);
      const now = new Date();
      setDay(todayKey(now));
      const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      timer = setTimeout(update, next.getTime() - now.getTime() + 100);
    };
    update();
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') update(); });
    return () => { clearTimeout(timer); subscription.remove(); };
  }, []);
  return createElement(ReduceMotionContext.Provider, { value: reduced },
    createElement(ReduceTransparencyContext.Provider, { value: reducedTransparency },
      createElement(IncreaseContrastContext.Provider, { value: increaseContrast },
        createElement(DayContext.Provider, { value: day }, children))));
}

export const useReduceMotion = () => useContext(ReduceMotionContext);
/** The iOS "Reduce Transparency" setting: when on, no glass material is drawn anywhere. */
export const useReduceTransparency = () => useContext(ReduceTransparencyContext);
export const useCurrentDay = () => useContext(DayContext);
