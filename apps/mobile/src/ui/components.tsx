import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
  type PressableProps, type StyleProp, type TextInputProps, type TextStyle, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { formatMinorUnits, labelFromISO, type Currency, type Entry, type Account } from '@finanzapp/domain';
import { router } from 'expo-router';
import { usePalette, useReduceMotion } from './theme';

export function AppText({ children, style, secondary = false }: { children: ReactNode; style?: StyleProp<TextStyle>; secondary?: boolean }) {
  const p = usePalette();
  return <Text style={[styles.text, { color: secondary ? p.secondary : p.text }, style]}>{children}</Text>;
}

export function Screen({ children }: { children: ReactNode }) {
  const p = usePalette();
  return <ScrollView style={{ flex: 1, backgroundColor: p.background }}
    contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic"
    automaticallyAdjustKeyboardInsets keyboardShouldPersistTaps="handled"
    keyboardDismissMode="interactive">{children}</ScrollView>;
}

export function Surface({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const p = usePalette();
  return <View style={[styles.surface, { backgroundColor: p.surface }, style]}>{children}</View>;
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <AppText style={styles.sectionTitle}>{children}</AppText>;
}

export function PressFeedback({ children, style, ...props }: PressableProps & { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const reduced = useReduceMotion();
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return <Animated.View style={animatedStyle}><Pressable {...props}
    style={[{ minHeight: 44, justifyContent: 'center' }, style]}
    onPressIn={event => { scale.value = reduced ? 1 : withTiming(0.98, { duration: 100 }); props.onPressIn?.(event); }}
    onPressOut={event => { scale.value = withTiming(1, { duration: reduced ? 0 : 150 }); props.onPressOut?.(event); }}>
    {children}
  </Pressable></Animated.View>;
}

export function ActionButton({ label, onPress, disabled = false, busy = false, secondary = false }: {
  label: string; onPress: () => void; disabled?: boolean; busy?: boolean; secondary?: boolean;
}) {
  const p = usePalette();
  const color = secondary ? p.accent : p.onAccent;
  return <PressFeedback accessibilityRole="button" accessibilityLabel={label}
    accessibilityState={{ disabled: disabled || busy, busy }} disabled={disabled || busy}
    onPress={onPress} style={[styles.button, { backgroundColor: secondary ? p.inset : p.accent, opacity: disabled || busy ? 0.55 : 1 }]}>
    {busy ? <ActivityIndicator color={color} /> : <Text style={[styles.buttonText, { color }]}>{label}</Text>}
  </PressFeedback>;
}

export function IconButton({ name, label, onPress, disabled = false }: { name: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; disabled?: boolean }) {
  const p = usePalette();
  return <PressFeedback accessibilityRole="button" accessibilityLabel={label} onPress={onPress}
    disabled={disabled} accessibilityState={{ disabled }}
    style={{ width: 44, alignItems: 'center', opacity: disabled ? 0.4 : 1 }}><Ionicons name={name} size={25} color={p.accent} /></PressFeedback>;
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  const p = usePalette();
  return <View style={{ gap: 8 }}><AppText secondary style={{ fontSize: 14 }}>{label}</AppText>
    <TextInput {...props} accessibilityLabel={label} placeholderTextColor={p.secondary}
      selectionColor={p.accent} style={[styles.input, { color: p.text, backgroundColor: p.surface }, props.style]} />
  </View>;
}

export function Choices<T extends string>({ value, options, onChange, disabled }: {
  value: T; options: { value: T; label: string }[]; onChange: (value: T) => void; disabled?: boolean;
}) {
  const p = usePalette();
  return <View style={[styles.choices, { backgroundColor: p.inset }]}>
    {options.map(option => <Pressable key={option.value} accessibilityRole="button"
      accessibilityState={{ selected: value === option.value, disabled }} disabled={disabled}
      onPress={() => onChange(option.value)} style={[styles.choice, { backgroundColor: value === option.value ? p.surface : 'transparent' }]}>
      <AppText style={{ fontWeight: '600', color: value === option.value ? p.text : p.secondary }}>{option.label}</AppText>
    </Pressable>)}
  </View>;
}

export function EmptyState({ title, detail, action }: { title: string; detail: string; action?: ReactNode }) {
  return <Surface style={{ gap: 16, paddingVertical: 28 }}>
    <AppText style={{ fontSize: 25, fontWeight: '700' }}>{title}</AppText>
    <AppText secondary>{detail}</AppText>
    {action}
  </Surface>;
}

export function ErrorMessage({ message }: { message: string | null }) {
  const p = usePalette();
  return message ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite"
    style={[styles.text, { color: p.negative }]}>{message}</Text> : null;
}

export function Money({ minor, currency, large = false, color }: { minor: number; currency: Currency; large?: boolean; color?: string }) {
  const p = usePalette();
  return <Text style={{ color: color ?? p.text, fontSize: large ? 36 : 19, fontWeight: large ? '700' : '600',
    fontVariant: ['tabular-nums'], flexShrink: 1 }}>
    {currency === 'USD' ? 'US$ ' : '$ '}{formatMinorUnits(minor)}
  </Text>;
}

export function EntryRow({ entry, account }: { entry: Entry; account: Account }) {
  const p = usePalette();
  return <PressFeedback accessibilityRole="button"
    accessibilityLabel={`${entry.merchant}, ${entry.kind === 'expense' ? 'gasto' : 'ingreso'}, ${formatMinorUnits(entry.amountMinor)} ${account.currency}, ${labelFromISO(entry.dateISO)}`}
    onPress={() => router.push({ pathname: '/entry/[id]', params: { id: entry.id } })}
    style={[styles.entry, { borderBottomColor: p.line }]}>
    <View style={{ flex: 1, gap: 5 }}>
      <AppText style={{ fontWeight: '600' }}>{entry.merchant}</AppText>
      <AppText secondary style={{ fontSize: 14 }}>{entry.category} · {labelFromISO(entry.dateISO)}</AppText>
      <AppText secondary style={{ fontSize: 13 }}>{account.name}</AppText>
    </View>
    <View style={{ maxWidth: '50%', alignItems: 'flex-end' }}>
      <Money minor={entry.kind === 'expense' ? -entry.amountMinor : entry.amountMinor} currency={account.currency}
        color={entry.kind === 'income' ? p.positive : p.text} />
    </View>
  </PressFeedback>;
}

const styles = StyleSheet.create({
  text: { fontSize: 17, lineHeight: 25 },
  content: { padding: 20, paddingBottom: 36, gap: 22, flexGrow: 1 },
  surface: { borderRadius: 24, padding: 20, gap: 10 },
  sectionTitle: { fontSize: 20, fontWeight: '700', marginBottom: 12 },
  button: { borderRadius: 18, paddingVertical: 16, paddingHorizontal: 20, alignItems: 'center', minHeight: 54 },
  buttonText: { fontSize: 17, fontWeight: '600', textAlign: 'center' },
  input: { borderRadius: 16, paddingHorizontal: 16, paddingVertical: 15, fontSize: 18, minHeight: 54 },
  choices: { flexDirection: 'row', flexWrap: 'wrap', borderRadius: 18, padding: 4, gap: 4 },
  choice: { flex: 1, minWidth: 100, minHeight: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center', padding: 10 },
  entry: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth },
});
