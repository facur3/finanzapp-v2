import { useEffect, useRef, type ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { Easing, FadeIn, FadeInUp, FadeOut, LinearTransition, type WithTimingConfig } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useReduceMotion } from './theme';

/** One motion language for the whole app: fast, ease-out, interruptible and
 * driven by data or touch, never by a screen gaining focus. Reduce Motion keeps
 * the opacity changes that explain a state and drops movement and reveals. */
export const easeOut = Easing.bezier(0.23, 1, 0.32, 1);
export const easeInOut = Easing.bezier(0.77, 0, 0.175, 1);
/** iOS's own sheet curve: a quick start that settles long, the way a presented sheet
 * rises. `easeOut` covers 60 % of a travel in its first 33 ms, right for a value or a
 * thumb, too abrupt for a card the eye follows from the bottom edge (24UX1). */
export const easeSheet = Easing.bezier(0.32, 0.72, 0, 1);

export const duration = {
  /** Press-in on a control. */
  press: 100,
  /** Release after a press. */
  release: 160,
  /** A control changing state: segmented thumb, selection colour. */
  state: 200,
  /** A value or proportion changing after new data. */
  data: 260,
  /** A new value arriving in place of an old one. */
  enter: 200,
  /** The old value leaving; shorter than the entrance so the two barely overlap. */
  exit: 100,
  /** A chart drawn for the first time. */
  reveal: 480,
  /** A sheet rising from the bottom edge (about what iOS gives its own sheets). */
  sheet: 300,
  /** A sheet leaving: shorter than its rise, so the form is back at once, long enough to be seen going. */
  sheetExit: 200,
} as const;

export type Duration = keyof typeof duration;

/** Timing config for a data or state change; zero-length when motion is reduced. */
export function timing(kind: Duration, reduced: boolean): WithTimingConfig {
  return { duration: reduced ? 0 : duration[kind], easing: easeOut };
}

/** Timing config for a sheet's own entrance or exit. Unlike `timing`, Reduce Motion keeps
 * the duration: the sheet then fades in place instead of rising, and a fade needs its time
 * (an instant appearance is the jarring change the fade is there to prevent). The curve is
 * the sheet's when the card moves, the plain ease-out for the fade. */
export function sheetTiming(kind: 'sheet' | 'sheetExit', reduced: boolean): WithTimingConfig {
  return { duration: duration[kind], easing: reduced ? easeOut : easeSheet };
}

/** A value ticked past a step: segmented control, month arrow, picker row. */
export function selectionHaptic() {
  void Haptics.selectionAsync().catch(() => {});
}

/** Something snapped home: a card settling in the carousel; a message leaving the composer. */
export function impactHaptic() {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

/** A durable write was accepted: a saved movement, a confirmed draft. */
export function successHaptic() {
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

const rise = FadeInUp.duration(duration.enter).easing(easeOut).withInitialValues({ opacity: 0, transform: [{ translateY: 6 }] });
const fadeIn = FadeIn.duration(duration.enter).easing(easeOut);
const fadeOut = FadeOut.duration(duration.exit).easing(easeOut);
const reflow = LinearTransition.duration(220).easing(easeOut);

/** Crossfades its content whenever `id` changes: the old value fades out in
 * 100 ms while the new one fades in over 200 ms, rising 6 pt in the `rise`
 * variant. Nothing animates on first mount (the tab roots stay mounted, so a
 * mount reveal would play unseen). Reduce Motion keeps the crossfade and drops
 * the rise, so the state change is still explained without movement. */
export function ValueTransition({ id, children, style, variant = 'rise' }: {
  id: string; children: ReactNode; style?: StyleProp<ViewStyle>; variant?: 'rise' | 'fade';
}) {
  const reduced = useReduceMotion();
  const mounted = useRef(false);
  useEffect(() => { mounted.current = true; }, []);
  const animate = mounted.current;
  return <Animated.View key={id} style={style} entering={animate ? (variant === 'rise' && !reduced ? rise : fadeIn) : undefined}
    exiting={animate ? fadeOut : undefined}>{children}</Animated.View>;
}

/** A block whose presence follows data (a budget line, a commitments list).
 * Siblings slide instead of jumping when it appears or leaves; with `fade`, the
 * block itself fades in and out. Reduce Motion keeps the fade and drops the
 * slide. Use it on tab roots, where data changes are the only reason a block
 * appears; a pushed screen already has the native transition. */
export function Reflow({ children, style, fade = false }: { children: ReactNode; style?: StyleProp<ViewStyle>; fade?: boolean }) {
  const reduced = useReduceMotion();
  return <Animated.View style={style} layout={reduced ? undefined : reflow}
    entering={fade ? fadeIn : undefined} exiting={fade ? fadeOut : undefined}>{children}</Animated.View>;
}

/** A block that arrives after the screen is already up (a new message, a draft
 * card): it rises 6 pt in 200 ms, or only fades under Reduce Motion. Unlike
 * ValueTransition it animates on mount, because arriving is the event. */
export function Appear({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const reduced = useReduceMotion();
  return <Animated.View style={style} entering={reduced ? fadeIn : rise} exiting={fadeOut}>{children}</Animated.View>;
}
