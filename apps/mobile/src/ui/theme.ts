import { useEffect, useState } from 'react';
import { AccessibilityInfo, useColorScheme } from 'react-native';

const light = {
  background: '#F5F6F8', surface: '#FFFFFF', inset: '#ECEFF4',
  text: '#101722', secondary: '#5B6678', line: '#DEE3EB',
  accent: '#1468D4', onAccent: '#FFFFFF', positive: '#13794D', negative: '#BD3548',
};
const dark: typeof light = {
  background: '#080B10', surface: '#151A22', inset: '#202733',
  text: '#F4F6FA', secondary: '#A6B0C0', line: '#2B3544',
  accent: '#7AB3FF', onAccent: '#09203B', positive: '#73D6A7', negative: '#FF909E',
};

export function usePalette() {
  const isDark = useColorScheme() === 'dark';
  return { ...(isDark ? dark : light), isDark };
}

export function useReduceMotion() {
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (mounted) setReduced(value); }).catch(() => {});
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => { mounted = false; subscription.remove(); };
  }, []);
  return reduced;
}
