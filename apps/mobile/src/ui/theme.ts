import { createContext, createElement, useContext, useEffect, useState, type ReactNode } from 'react';
import { AccessibilityInfo, AppState, useColorScheme } from 'react-native';
import { todayKey } from '@finanzapp/domain';

const light = {
  background: '#F5F6F8', surface: '#FFFFFF', inset: '#ECEFF4',
  text: '#141A24', secondary: '#606B7A', line: '#E1E5EC',
  accent: '#2467DC', onAccent: '#FFFFFF', positive: '#13794D', negative: '#BD3548',
  accentSoft: '#E9F0FD', positiveSoft: '#E8F5EE', negativeSoft: '#FCECEF',
};
const dark: typeof light = {
  background: '#080B10', surface: '#151A22', inset: '#202733',
  text: '#F4F6FA', secondary: '#A6B0C0', line: '#2B3544',
  accent: '#7AB3FF', onAccent: '#09203B', positive: '#73D6A7', negative: '#FF909E',
  accentSoft: '#1A2B44', positiveSoft: '#173329', negativeSoft: '#38212B',
};

export function usePalette() {
  const isDark = useColorScheme() === 'dark';
  return { ...(isDark ? dark : light), isDark };
}

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
