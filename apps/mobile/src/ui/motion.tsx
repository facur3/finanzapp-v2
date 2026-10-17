import { useEffect, useRef, type ReactNode } from 'react';
import { AccessibilityInfo, Platform, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, FadeIn, FadeInUp, FadeOut, LinearTransition, ReduceMotion, cubicBezier, type WithTimingConfig } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useReduceMotion } from './theme';

/** One motion language for the whole app: fast, ease-out, interruptible and
 * driven by data or touch, never by a screen gaining focus. Reduce Motion keeps
 * the opacity changes that explain a state and drops movement and reveals. */
export const easeOut = Easing.bezier(0.23, 1, 0.32, 1);
export const easeInOut = Easing.bezier(0.77, 0, 0.175, 1);
/** `easeOut` for a CSS transition (`transitionTimingFunction`), which takes Reanimated's CSS easing, not an `Easing`
 * function: without it a colour transition runs the default «ease» beside a thumb on `easeOut`. */
export const easeOutCss = cubicBezier(0.23, 1, 0.32, 1);
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

/** The one ambient loop: the Assistant's «Pensando…» dot, 600 ms each way on a symmetric curve (it never settles, so it
 * has no ease-out end). Static under Reduce Motion: the caller does not start it. */
export const pulseTiming: WithTimingConfig = { duration: 600, easing: Easing.inOut(Easing.quad) };

/** How long the Assistant waits before it shows that it is waiting: «Pensando…» appears, and Enviar becomes Detener, only
 * after this, so an instant reply (or the disconnected note) never flashes them and a second tap on Enviar never lands on
 * a Detener that just took its place. A delay, not a motion: Reduce Motion keeps it. */
export const WAIT_REVEAL_MS = 400;

/** Timing config for a data or state change; zero-length when motion is reduced. */
export function timing(kind: Duration, reduced: boolean): WithTimingConfig {
  return { duration: reduced ? 0 : duration[kind], easing: easeOut };
}

/** Timing config for a sheet's own entrance or exit. Unlike `timing`, Reduce Motion keeps
 * the duration: the sheet then fades in place instead of rising, and a fade needs its time
 * (an instant appearance is the jarring change the fade is there to prevent). The curve is
 * the sheet's when the card moves, the plain ease-out for the fade. The policy is explicit:
 * a `withTiming` without one follows the device setting (`ReduceMotion.System`) and, with
 * Reduce Motion on, lands on its target in one frame whatever the duration says (Reanimated
 * 4, `animation/util.ts` onStart), which would make the fade instant. `Never` leaves the
 * decision to the caller, who already drops the movement from its own reading (PR #54). */
export function sheetTiming(kind: 'sheet' | 'sheetExit', reduced: boolean): WithTimingConfig {
  return { duration: duration[kind], easing: reduced ? easeOut : easeSheet, reduceMotion: ReduceMotion.Never };
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

/** 25Q4: a write the person asked for failed and no unverified submission waits for «Reintentar»: refused before sending, or
 * by storage before writing, or offered again as new. Once, in its catch, after the error is set; never while typing. */
export function errorHaptic() {
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
}

/** 25Q4: a write the person asked for failed with an outcome the app cannot verify, and the screen keeps the exact submission
 * frozen for «Reintentar». Once, in its catch, after the error is set. */
export function warningHaptic() {
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
}

/** Producto 25D2: how long a screen takes to leave (a sheet's dismissal, a pop) before an outcome said over it is posted. */
export const LEAVE_DELAY = 500;

/** Producto 25D2: what just happened, told to VoiceOver in the app's own words: the outcome of a write the person asked
 * for (beside its haptic) or a change made in place away from the control they touched (a month stepped, a reply that
 * finished). iOS has no live regions, so this is how VoiceOver hears it. Android posts nothing: TalkBack reads the live
 * region such a line carries there, and announcing too would say it twice (AGENTS rule 13). Queued behind what VoiceOver
 * is saying (the control's own reply), never cutting it off. `after: 'leave'` for an outcome whose screen closes with it:
 * posted once the destination is up, so its first reading does not swallow it. The caller passes spoken forms only
 * (tests/voiceover.node.ts follows the argument like any label) and calls it once per outcome, from the handler that
 * caused it, never from a mount (a screen coming back would repeat its history). */
export function announce(text: string, after: 'now' | 'leave' = 'now') {
  if (Platform.OS !== 'ios' || !text) return;
  const say = () => AccessibilityInfo.announceForAccessibilityWithOptions(text, { queue: true });
  if (after === 'leave') setTimeout(say, LEAVE_DELAY); else say();
}

const rise = FadeInUp.duration(duration.enter).easing(easeOut).withInitialValues({ opacity: 0, transform: [{ translateY: 6 }] });
// A fade is what Reduce Motion keeps (it explains a change without moving anything), so its policy is explicit, as for
// the sheet (`sheetTiming`): without one, Reanimated follows the device setting and lands in one frame, and every
// crossfade below would be an instant swap. The callers already drop the rise and the reflow from their own reading.
const fadeIn = FadeIn.duration(duration.enter).easing(easeOut).reduceMotion(ReduceMotion.Never);
const fadeOut = FadeOut.duration(duration.exit).easing(easeOut).reduceMotion(ReduceMotion.Never);
const reflow = LinearTransition.duration(duration.state).easing(easeOut);
/** Producto 25UX1: a list row travelling to its new place when the list's order changes (Reportes' chosen category rising
 * to the top and the rows around it making room, then returning): the data move of the app's one curve, no spring. The
 * caller drops it under Reduce Motion, so the order changes at once. */
export const rowReorder = LinearTransition.duration(duration.data).easing(easeOut);

/** Crossfades its content whenever `id` changes: the old value fades out in
 * 100 ms while the new one fades in over 200 ms, rising 6 pt in the `rise`
 * variant. Nothing animates on first mount (the tab roots stay mounted, so a
 * mount reveal would play unseen). Reduce Motion keeps the crossfade and drops
 * the rise, so the state change is still explained without movement. */
export function ValueTransition({ id, children, style, variant = 'rise', exit = true }: {
  id: string; children: ReactNode; style?: StyleProp<ViewStyle>; variant?: 'rise' | 'fade';
  /** 25UX1: false where the old value must never be seen beside the new one (Tarjetas' snapshot when another card is
   * selected): the old value leaves at once and only the new one fades or rises in. */
  exit?: boolean;
}) {
  const reduced = useReduceMotion();
  const mounted = useRef(false);
  useEffect(() => { mounted.current = true; }, []);
  const animate = mounted.current;
  return <Animated.View key={id} style={style} entering={animate ? (variant === 'rise' && !reduced ? rise : fadeIn) : undefined}
    exiting={animate && exit ? fadeOut : undefined}>{children}</Animated.View>;
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
