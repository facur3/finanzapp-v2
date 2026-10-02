import { useContext } from 'react';
import { BottomTabBarHeightContext } from 'expo-router/tabs';
import { Platform } from 'react-native';
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

/** How a tab root keeps its last row clear of the dock (25UX1 review). On iOS the clearance is the scroller's own
 * `contentInset` (and its indicator's): React Native's keyboard handling restores the inset as the larger of the
 * keyboard and that prop, so the clearance comes back after any keyboard (a scroll indicator inset alone was wiped), and
 * UIKit keeps a VoiceOver focus inside the inset area, never under the dock. Elsewhere (no `contentInset`) the clearance
 * is bottom padding. Off the tabs: nothing. */
export function useDockInset(): { extraPadding: number; inset: { bottom: number } | undefined } {
  const clearance = useDockClearance();
  if (!clearance) return { extraPadding: 0, inset: undefined };
  return Platform.OS === 'ios' ? { extraPadding: 0, inset: { bottom: clearance } } : { extraPadding: clearance, inset: undefined };
}
