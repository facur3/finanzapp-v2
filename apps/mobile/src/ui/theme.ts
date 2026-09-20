import { createContext, createElement, useContext, useEffect, useState, type ReactNode } from 'react';
import { AccessibilityInfo, AppState, useColorScheme, type TextStyle } from 'react-native';
import { todayKey } from '@finanzapp/domain';

/** Ink-first neutrals plus four semantic colors. Colour carries meaning
 * (expense, income, transfer, warning); everything else is ink on ground. */
const light = {
  background: '#F2F2F6', surface: '#FFFFFF', inset: '#EEEEF3', elevated: '#FFFFFF',
  text: '#0A0A0C', secondary: '#6E7078', tertiary: '#8E9098', line: '#E6E6EC',
  // Primary actions and the active tab are ink; links and interactive text are the blue tint.
  accent: '#0A0A0C', onAccent: '#FFFFFF', accentSoft: '#EEEEF3', tint: '#2563EB',
  expense: '#C42F39', income: '#15804F', transfer: '#2563EB', warning: '#B45309',
  expenseSoft: '#FBE9EA', incomeSoft: '#E6F5EE', transferSoft: '#E8EFFD', warningSoft: '#FCF1E0',
  shadow: 'rgba(10, 10, 12, 0.08)',
};
const dark: typeof light = {
  background: '#000000', surface: '#1C1C1E', inset: '#2C2C2E', elevated: '#242426',
  text: '#F5F5F7', secondary: '#A0A0A8', tertiary: '#7C7C84', line: '#2C2C30',
  accent: '#F5F5F7', onAccent: '#0A0A0C', accentSoft: '#2C2C2E', tint: '#5B9BFF',
  expense: '#F0555C', income: '#3DBE86', transfer: '#5B9BFF', warning: '#E8A030',
  expenseSoft: '#3A1E20', incomeSoft: '#173126', transferSoft: '#172A45', warningSoft: '#3A2C14',
  shadow: 'rgba(0, 0, 0, 0)',
};

export type Palette = typeof light & {
  isDark: boolean;
  /** Aliases kept for existing call sites: income/expense semantics. */
  positive: string; negative: string; positiveSoft: string; negativeSoft: string;
};

export function usePalette(): Palette {
  const isDark = useColorScheme() === 'dark';
  const base = isDark ? dark : light;
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
const DayContext = createContext(todayKey());

// One native accessibility subscription, not one request/listener per row.
export function UIProvider({ children }: { children: ReactNode }) {
  const [reduced, setReduced] = useState(true);
  const [day, setDay] = useState(todayKey);
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (mounted) setReduced(value); }).catch(() => {});
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => { mounted = false; subscription.remove(); };
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
    createElement(DayContext.Provider, { value: day }, children));
}

export const useReduceMotion = () => useContext(ReduceMotionContext);
export const useCurrentDay = () => useContext(DayContext);
