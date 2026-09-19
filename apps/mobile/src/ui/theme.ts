import { createContext, createElement, useContext, useEffect, useState, type ReactNode } from 'react';
import { AccessibilityInfo, AppState, useColorScheme } from 'react-native';
import { todayKey } from '@finanzapp/domain';

const light = {
  background: '#F8F7FA', surface: '#FFFFFF', inset: '#EFEDF5',
  text: '#1C1B25', secondary: '#696575', line: '#E4E1EB',
  accent: '#4B3BDB', onAccent: '#FFFFFF', positive: '#13794D', negative: '#BD3548',
  accentSoft: '#EFECFF', positiveSoft: '#E8F5EE', negativeSoft: '#FCECEF',
};
const dark: typeof light = {
  background: '#101014', surface: '#1B1B23', inset: '#282731',
  text: '#F4F6FA', secondary: '#A6B0C0', line: '#2B3544',
  accent: '#B4AAFF', onAccent: '#20184E', positive: '#73D6A7', negative: '#FF909E',
  accentSoft: '#2C2547', positiveSoft: '#173329', negativeSoft: '#38212B',
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
