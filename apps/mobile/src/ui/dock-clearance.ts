import { useContext } from 'react';
import { BottomTabBarHeightContext } from 'expo-router/tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { dockClearance } from './dock-geometry.ts';

/** Producto 25UX1: the bottom space a scroller keeps clear of the floating dock. Inside a tab root (the tab navigator
 * provides its bar-height context to each of its scenes, and to nothing else) it is the dock's full height above the
 * window's bottom (`dockClearance`); anywhere else (a pushed screen, a modal, the capture hub) it is 0, so a screen that
 * never shows the dock keeps its padding to the pixel. The shared scrollers (`Screen`, `EntryList`) and the two custom
 * tab roots (Inicio, Reportes) add it to their bottom padding and to their scroll indicator: one invariant, no padding per
 * screen. */
export function useDockClearance(): number {
  const inTabs = useContext(BottomTabBarHeightContext) !== undefined;
  const insets = useSafeAreaInsets();
  return inTabs ? dockClearance(insets.bottom) : 0;
}
