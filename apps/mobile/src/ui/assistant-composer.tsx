import { useState, type ReactNode } from 'react';
import { Platform, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';
import Animated, { useAnimatedKeyboard, useAnimatedStyle } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText, PressFeedback } from './components';
import { space, usePalette } from './theme';

export const COMPOSER_PLACEHOLDER = 'Preguntá o registrá algo…';
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
 * the home indicator clear when the keyboard is down. */
export function AssistantComposer({ value, onChange, onSend, onStop, busy, disabled = false, note }: {
  value: string; onChange: (text: string) => void; onSend: () => void; onStop: () => void; busy: boolean; disabled?: boolean;
  /** A line under the bar: the disconnected note, the microphone boundary. */
  note?: ReactNode;
}) {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const [micNote, setMicNote] = useState(false);
  const canSend = value.trim().length > 0 && !busy && !disabled;
  const maxHeight = Math.round(LINE_HEIGHT * Math.min(fontScale, 1.6) * COMPOSER_MAX_LINES);
  return <KeyboardSpace bottomInset={insets.bottom}>
    <View style={[styles.bar, { backgroundColor: p.surface, borderColor: p.isDark ? 'rgba(255,255,255,0.10)' : 'rgba(10,10,12,0.08)' },
      p.isDark ? null : styles.barShadow]}>
      <TextInput value={value} onChangeText={onChange} multiline editable={!disabled} placeholder={COMPOSER_PLACEHOLDER} placeholderTextColor={p.tertiary}
        accessibilityLabel="Mensaje para el Asistente" accessibilityHint="Escribí una pregunta sobre tu dinero o un gasto para registrar"
        selectionColor={p.primary} keyboardAppearance={p.isDark ? 'dark' : 'light'} textAlignVertical="center"
        style={[styles.input, { color: p.text, maxHeight, lineHeight: LINE_HEIGHT }]} />
      <PressFeedback feedback="opacity" accessibilityRole="button" accessibilityLabel="Dictar" accessibilityHint="Todavía no disponible en esta versión"
        onPress={() => setMicNote(current => !current)} style={styles.round}>
        <Ionicons name="mic-outline" size={22} color={p.secondary} accessible={false} />
      </PressFeedback>
      {busy
        ? <PressFeedback accessibilityRole="button" accessibilityLabel="Detener respuesta" onPress={onStop} style={styles.round}>
          <View style={[styles.send, { backgroundColor: p.inset }]}><Ionicons name="stop" size={14} color={p.text} accessible={false} /></View>
        </PressFeedback>
        : <PressFeedback accessibilityRole="button" accessibilityLabel="Enviar" accessibilityState={{ disabled: !canSend }} disabled={!canSend}
          onPress={onSend} style={styles.round}>
          <View style={[styles.send, { backgroundColor: canSend ? p.primaryFill : p.inset }]}>
            <Ionicons name="arrow-up" size={18} color={canSend ? p.onPrimary : p.tertiary} accessible={false} />
          </View>
        </PressFeedback>}
    </View>
    {micNote && <AppText secondary variant="footnote" style={styles.note} accessibilityLiveRegion="polite">
      El dictado llega con la versión instalable: la transcripción de voz necesita el development build, no Expo Go.
    </AppText>}
    {note}
  </KeyboardSpace>;
}

/** Bottom padding that follows the keyboard frame exactly, on the UI thread,
 * and never drops below the safe-area inset. `useAnimatedKeyboard` reports
 * the keyboard's height over the window on iOS and Android alike. */
function KeyboardSpace({ children, bottomInset }: { children: ReactNode; bottomInset: number }) {
  const keyboard = useAnimatedKeyboard();
  const style = useAnimatedStyle(() => ({ paddingBottom: Math.max(keyboard.height.value, bottomInset) + space.s }));
  return <Animated.View style={[styles.space, style]}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  space: { paddingHorizontal: space.l, paddingTop: space.s, gap: space.s },
  bar: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, paddingLeft: 16, paddingRight: 6, paddingVertical: 4, borderRadius: 24, minHeight: 48, borderWidth: StyleSheet.hairlineWidth },
  barShadow: { shadowColor: '#0A0A0C', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  input: { flex: 1, fontSize: 17, paddingTop: Platform.OS === 'ios' ? 9 : 6, paddingBottom: Platform.OS === 'ios' ? 9 : 6, minHeight: 40 },
  round: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', minHeight: 40 },
  send: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  note: { paddingHorizontal: space.xs },
});
