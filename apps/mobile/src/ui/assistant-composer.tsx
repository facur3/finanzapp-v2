import { useRef, useState, type ReactNode } from 'react';
import { Platform, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';
import Animated, { useAnimatedKeyboard, useAnimatedStyle } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '../i18n/provider';
import { AppText, PressFeedback } from './components';
import { ControlSurface, useMaterial } from './material';
import { composerBottomPadding } from './material-policy';
import { space, usePalette } from './theme';

/** The placeholder's catalogue key. */
export const COMPOSER_PLACEHOLDER = 'assistant.composer.placeholder' as const;
/** The composer grows with the message up to about five lines, then scrolls inside. */
export const COMPOSER_MAX_LINES = 5;
const LINE_HEIGHT = 22;

/** The bar that will stay when the model is connected: one field, a
 * microphone and a send control. Typing is the only input this build can
 * accept; the microphone is a visible promise that opens a note instead of a
 * recorder, because speech recognition needs the development build.
 *
 * Send is disabled on an empty message and becomes Stop while the Assistant is
 * answering. The whole bar rides the keyboard through Reanimated's keyboard
 * tracker (UI thread, exact frame, interactive dismissal included) and keeps
 * the home indicator clear when the keyboard is down. As a tab root the
 * screen ends above the tab bar, so the bar measures what sits below it and
 * subtracts that from the keyboard: it never floats above an empty strip.
 *
 * The bar is a control layer over content and keyboard, so on iOS 26 it is
 * drawn as native glass; the field, glyphs and the solid send button sit in
 * the glass view's content, so text contrast is theirs, not the material's.
 * Elsewhere, and with Reduce Transparency, it is the opaque surface pill. */
export function AssistantComposer({ value, onChange, onSend, onStop, busy, disabled = false, note }: {
  value: string; onChange: (text: string) => void; onSend: () => void; onStop: () => void; busy: boolean; disabled?: boolean;
  /** A line under the bar: the disconnected note, the microphone boundary. */
  note?: ReactNode;
}) {
  const p = usePalette();
  const { t } = useI18n();
  const material = useMaterial();
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const [micNote, setMicNote] = useState(false);
  const canSend = value.trim().length > 0 && !busy && !disabled;
  const maxHeight = Math.round(LINE_HEIGHT * Math.min(fontScale, 1.6) * COMPOSER_MAX_LINES);
  const opaque = { backgroundColor: p.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: p.isDark ? 'rgba(255,255,255,0.10)' : 'rgba(10,10,12,0.08)',
    ...(p.isDark ? {} : styles.barShadow) };
  return <KeyboardSpace bottomInset={insets.bottom}>
    <ControlSurface material={material} style={styles.bar} opaque={opaque}>
      <TextInput value={value} onChangeText={onChange} multiline editable={!disabled} placeholder={t(COMPOSER_PLACEHOLDER)} placeholderTextColor={p.tertiary}
        accessibilityLabel={t('assistant.composer.label')} accessibilityHint={t('assistant.composer.hint')}
        selectionColor={p.primary} keyboardAppearance={p.isDark ? 'dark' : 'light'} textAlignVertical="center"
        style={[styles.input, { color: p.text, maxHeight, lineHeight: LINE_HEIGHT }]} />
      <PressFeedback feedback="opacity" accessibilityRole="button" accessibilityLabel={t('assistant.composer.dictate')} accessibilityHint={t('assistant.composer.dictateHint')}
        onPress={() => setMicNote(current => !current)} style={styles.round}>
        <Ionicons name="mic-outline" size={22} color={p.secondary} accessible={false} />
      </PressFeedback>
      {busy
        ? <PressFeedback accessibilityRole="button" accessibilityLabel={t('assistant.composer.stop')} onPress={onStop} style={styles.round}>
          <View style={[styles.send, { backgroundColor: p.inset }]}><Ionicons name="stop" size={14} color={p.text} accessible={false} /></View>
        </PressFeedback>
        : <PressFeedback accessibilityRole="button" accessibilityLabel={t('assistant.composer.send')} accessibilityState={{ disabled: !canSend }} disabled={!canSend}
          onPress={onSend} style={styles.round}>
          <View style={[styles.send, { backgroundColor: canSend ? p.primaryFill : p.inset }]}>
            <Ionicons name="arrow-up" size={18} color={canSend ? p.onPrimary : p.tertiary} accessible={false} />
          </View>
        </PressFeedback>}
    </ControlSurface>
    {micNote && <AppText secondary variant="footnote" style={styles.note} accessibilityLiveRegion="polite">
      {t('assistant.composer.dictationNote')}
    </AppText>}
    {note}
  </KeyboardSpace>;
}

/** Bottom padding that follows the keyboard frame exactly, on the UI thread,
 * clears the safe-area inset, and subtracts whatever already sits below this
 * screen (the tab bar, measured in window coordinates on layout; 0 in a
 * stack). `useAnimatedKeyboard` reports the keyboard's height over the
 * window on iOS and Android alike. */
function KeyboardSpace({ children, bottomInset }: { children: ReactNode; bottomInset: number }) {
  const keyboard = useAnimatedKeyboard();
  const { height: windowHeight } = useWindowDimensions();
  const host = useRef<View>(null);
  const [occupied, setOccupied] = useState(0);
  const measure = () => host.current?.measureInWindow((_x, y, _width, height) => {
    const below = Math.max(Math.round(windowHeight - y - height), 0);
    setOccupied(current => current === below ? current : below);
  });
  const style = useAnimatedStyle(() => ({ paddingBottom: composerBottomPadding(keyboard.height.value, bottomInset, occupied) + space.s }), [bottomInset, occupied]);
  return <Animated.View ref={host} onLayout={measure} style={[styles.space, style]}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  space: { paddingHorizontal: space.l, paddingTop: space.s, gap: space.s },
  bar: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, paddingLeft: 16, paddingRight: 6, paddingVertical: 4, borderRadius: 24, minHeight: 48 },
  barShadow: { shadowColor: '#0A0A0C', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  input: { flex: 1, fontSize: 17, paddingTop: Platform.OS === 'ios' ? 9 : 6, paddingBottom: Platform.OS === 'ios' ? 9 : 6, minHeight: 40 },
  round: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', minHeight: 40 },
  send: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  note: { paddingHorizontal: space.xs },
});
