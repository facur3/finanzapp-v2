import { useContext, useEffect, useState } from 'react';
import { BottomTabBarHeightContext } from 'expo-router/tabs';
import { Keyboard, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { dockClearance, dockIndicatorInset } from './dock-geometry.ts';

/** Producto 25UX1: the bottom space a scroller keeps clear of the floating dock. Inside a tab root (the tab navigator
 * provides its bar-height context to each of its scenes, and to nothing else) it is the dock's full height above the
 * window's bottom (`dockClearance`); anywhere else (a pushed screen, a modal, the capture hub) it is 0, so a screen that
 * never shows the dock keeps its padding to the pixel. The shared scrollers (`Screen`, `EntryList`) and the two custom
 * tab roots (Inicio, Reportes) take it through `useDockInset`: one invariant, no padding per screen. */
export function useDockClearance(): number {
  const inTabs = useContext(BottomTabBarHeightContext) !== undefined;
  const insets = useSafeAreaInsets();
  return inTabs ? dockClearance(insets.bottom) : 0;
}

// One counter for every scroller: each mount and each re-assertion takes the next step, so no two consecutive values of
// the indicator inset are equal (`dockIndicatorInset`).
let assertions = 0;
const nextAssertion = () => ++assertions;

/** How a tab root keeps its last row clear of the dock (25OPS1, after the owner's iPhone pass of 25UX1). The clearance
 * is real scrollable space: bottom padding of the scroller's content, on every platform, so the end of the scroll is a
 * layout fact and the last row rests above the dock with no overscroll. 25UX1 handed it to iOS as the scroller's
 * `contentInset` instead, and on the iPhone the content sprang back under the dock: that inset lives in the native view,
 * where React Native applies it only when the prop changes (a recycled native scroll view comes back with its inset
 * cleared and its old props, so an equal inset is never applied again). A tab root therefore passes no `contentInset`.
 *
 * `indicator` (iOS) ends the scroll indicator above the dock. React Native's keyboard handling overwrites the native
 * indicator inset on every scroller that adjusts for the keyboard, so the value is asserted again, one sub-pixel step
 * on, after a keyboard hides and on every mount. Off the tabs: nothing. */
export function useDockInset(): { extraPadding: number; indicator: { bottom: number } | undefined } {
  const clearance = useDockClearance();
  const [assertion, setAssertion] = useState(nextAssertion);
  const native = Platform.OS === 'ios' && clearance > 0;
  useEffect(() => {
    if (!native) return;
    const hidden = Keyboard.addListener('keyboardDidHide', () => setAssertion(nextAssertion()));
    return () => hidden.remove();
  }, [native]);
  if (!clearance) return { extraPadding: 0, indicator: undefined };
  return { extraPadding: clearance, indicator: native ? { bottom: dockIndicatorInset(clearance, assertion) } : undefined };
}
