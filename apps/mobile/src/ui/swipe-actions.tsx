import { useRef, type ReactNode } from 'react';
import { Pressable, View, type AccessibilityActionEvent } from 'react-native';
import Swipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useI18n } from '../i18n/provider';
import { AppText, type IconName } from './components';
import { usePalette } from './theme';

/** One trailing action of a list row (24UX4). `destructive` is the red one and always the last (the far edge, as in
 * Mail and Reminders); `neutral` is a reversible change (pause, close); `accent` moves forward (resume, pay).
 * A destructive action asks before it writes: the row only reveals it, `onPress` owns the confirmation. */
export type SwipeAction = { key: string; label: string; icon: IconName; tone: 'destructive' | 'neutral' | 'accent'; onPress: () => void };

/** The row that is open now: iOS keeps at most one row's actions showing, so opening another closes it. */
let openRow: SwipeableMethods | null = null;

/** Width of one action: room for a two-word label at the default size; a larger text size widens it. */
const ACTION_WIDTH = 76;

/** A grouped-list row with iOS trailing swipe actions. The finger drives the row (Gesture Handler on the UI thread);
 * releasing past half the actions opens it, a shorter drag closes it; a full swipe never runs an action by itself,
 * so nothing destructive happens without a tap and its confirmation. Tapping an action closes the row first. The
 * same actions reach VoiceOver as the row's custom actions (`swipeAccessibility`), since a swipe is not a gesture
 * VoiceOver users can make on one row. The row's own content must be opaque (`background`), or the actions would
 * show through it at rest. */
export function SwipeRow({ actions, children, background }: { actions: SwipeAction[]; children: ReactNode; background?: string }) {
  const p = usePalette();
  const { speechLanguage } = useI18n();
  const methods = useRef<SwipeableMethods | null>(null);
  if (!actions.length) return <>{children}</>;
  const fill = (tone: SwipeAction['tone']) => tone === 'destructive' ? p.swipeDestructive : tone === 'accent' ? p.swipeAccent : p.swipeNeutral;
  return <Swipeable ref={methods} friction={1} overshootRight={false} rightThreshold={(ACTION_WIDTH * actions.length) / 2}
    childrenContainerStyle={{ backgroundColor: background ?? p.surface }}
    onSwipeableWillOpen={() => { if (openRow && openRow !== methods.current) openRow.close(); openRow = methods.current; }}
    onSwipeableClose={() => { if (openRow === methods.current) openRow = null; }}
    renderRightActions={(_progress, _translation, swipeable) => <View style={{ flexDirection: 'row' }}>
      {actions.map(action => <Pressable key={action.key} accessibilityRole="button" accessibilityLabel={action.label} accessibilityLanguage={speechLanguage}
        onPress={() => { swipeable.close(); action.onPress(); }}
        style={({ pressed }) => ({ minWidth: ACTION_WIDTH, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center', gap: 4,
          backgroundColor: fill(action.tone), opacity: pressed ? 0.8 : 1 })}>
        <Ionicons name={action.icon} size={20} color="#FFFFFF" accessible={false} />
        <AppText variant="caption" numberOfLines={1} style={{ color: '#FFFFFF', fontWeight: '600' }}>{action.label}</AppText>
      </Pressable>)}
    </View>}>
    {children}
  </Swipeable>;
}

/** The row's actions as VoiceOver custom actions («Acciones» in the rotor), the accessible twin of the swipe. */
export function swipeAccessibility(actions: SwipeAction[]) {
  return {
    accessibilityActions: actions.map(action => ({ name: action.key, label: action.label })),
    onAccessibilityAction: (event: AccessibilityActionEvent) => actions.find(action => action.key === event.nativeEvent.actionName)?.onPress(),
  };
}
