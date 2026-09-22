import { createContext, createElement, useContext, useEffect, useState, type ReactNode } from 'react';
import { AccessibilityInfo, AppState, useColorScheme, type TextStyle } from 'react-native';
import { todayKey } from '@finanzapp/domain';

import { subscribeReduceTransparency } from './material-policy';
import { darkPalette, lightPalette, type PaletteColors } from './palette';

export type Palette = PaletteColors & {
  isDark: boolean;
  /** Aliases kept for existing call sites: income/expense semantics. */
  positive: string; negative: string; positiveSoft: string; negativeSoft: string;
};

export function usePalette(): Palette {
  const isDark = useColorScheme() === 'dark';
  const base = isDark ? darkPalette : lightPalette;
  return { ...base, isDark, positive: base.income, negative: base.expense, positiveSoft: base.incomeSoft, negativeSoft: base.expenseSoft };
}

/** System font (SF Pro on iOS). Numbers are always tabular so amounts align. */
export const type = {
  hero: { fontSize: 44, lineHeight: 52, fontWeight: '700', letterSpacing: -1.3, fontVariant: ['tabular-nums'] } as TextStyle,
  largeTitle: { fontSize: 34, lineHeight: 41, fontWeight: '700', letterSpacing: -0.8 } as TextStyle,
  title1: { fontSize: 28, lineHeight: 34, fontWeight: '700', letterSpacing: -0.6 } as TextStyle,
  title2: { fontSize: 22, lineHeight: 28, fontWeight: '700', letterSpacing: -0.4 } as TextStyle,
  title3: { fontSize: 20, lineHeight: 25, fontWeight: '600', letterSpacing: -0.3 } as TextStyle,
  headline: { fontSize: 17, lineHeight: 22, fontWeight: '600', letterSpacing: -0.2 } as TextStyle,
  body: { fontSize: 17, lineHeight: 22 } as TextStyle,
  subhead: { fontSize: 15, lineHeight: 20 } as TextStyle,
  footnote: { fontSize: 13, lineHeight: 18 } as TextStyle,
  caption: { fontSize: 12, lineHeight: 16 } as TextStyle,
  eyebrow: { fontSize: 12, lineHeight: 16, fontWeight: '600', letterSpacing: 0.7, textTransform: 'uppercase' } as TextStyle,
};

export const radius = { chip: 14, tile: 12, group: 16, card: 20, sheet: 24, creditCard: 18, button: 14 };
export const space = { xs: 4, s: 8, m: 12, l: 16, xl: 20, xxl: 24, xxxl: 32 };

const ReduceMotionContext = createContext(true);
// Defaults to true: until iOS answers, a control is drawn on its opaque material, never on a missing effect.
const ReduceTransparencyContext = createContext(true);
const DayContext = createContext(todayKey());

// One native accessibility subscription per setting, not one request/listener per row.
export function UIProvider({ children }: { children: ReactNode }) {
  const [reduced, setReduced] = useState(true);
  const [reducedTransparency, setReducedTransparency] = useState(true);
  const [day, setDay] = useState(todayKey);
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (mounted) setReduced(value); }).catch(() => {});
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    // iOS only, and feature-detected: an older or mismatched runtime without the API, or one that throws, keeps the opaque material.
    const transparency = subscribeReduceTransparency(AccessibilityInfo as Parameters<typeof subscribeReduceTransparency>[0], setReducedTransparency);
    return () => { mounted = false; subscription.remove(); transparency(); };
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
      createElement(DayContext.Provider, { value: day }, children)));
}

export const useReduceMotion = () => useContext(ReduceMotionContext);
/** The iOS "Reduce Transparency" setting: when on, no glass material is drawn anywhere. */
export const useReduceTransparency = () => useContext(ReduceTransparencyContext);
export const useCurrentDay = () => useContext(DayContext);
