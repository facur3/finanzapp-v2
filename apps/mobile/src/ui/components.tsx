import { useEffect, useId, type ReactNode } from 'react';
import { ActivityIndicator, InputAccessoryView, Keyboard, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
  useWindowDimensions, type PressableProps, type StyleProp, type TextInputProps, type TextProps, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { accountBalanceMinor, formatMinorUnits, labelFromISO, type Currency, type Entry, type Account } from '@finanzapp/domain';
import { router } from 'expo-router';
import { useCurrentDay, usePalette, useReduceMotion } from './theme';

type IconName = keyof typeof Ionicons.glyphMap;

export function AppText({ children, style, secondary = false, ...props }: TextProps & { secondary?: boolean }) {
  const p = usePalette();
  return <Text {...props} style={[styles.text, { color: secondary ? p.secondary : p.text }, style]}>{children}</Text>;
}

export function Screen({ children }: { children: ReactNode }) {
  const p = usePalette();
  return <ScrollView style={{ flex: 1, backgroundColor: p.background }}
    contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic"
    automaticallyAdjustKeyboardInsets keyboardShouldPersistTaps="handled"
    keyboardDismissMode="interactive">{children}</ScrollView>;
}

export function Surface({ children, style, grouped = false }: { children: ReactNode; style?: StyleProp<ViewStyle>; grouped?: boolean }) {
  const p = usePalette();
  return <View style={[styles.surface, { backgroundColor: p.surface }, grouped && { padding: 0, gap: 0, overflow: 'hidden' }, style]}>{children}</View>;
}

export function SectionTitle({ children, action, onAction }: { children: ReactNode; action?: string; onAction?: () => void }) {
  const p = usePalette();
  return <View style={styles.sectionHeading}>
    <AppText accessibilityRole="header" style={styles.sectionTitle}>{children}</AppText>
    {action && onAction && <PressFeedback accessibilityRole="button" onPress={onAction} style={{ paddingLeft: 12 }}>
      <AppText style={{ fontSize: 15, color: p.accent, fontWeight: '500' }}>{action}</AppText>
    </PressFeedback>}
  </View>;
}

export function PressFeedback({ children, style, containerStyle, ...props }: PressableProps & {
  children: ReactNode; style?: StyleProp<ViewStyle>; containerStyle?: StyleProp<ViewStyle>;
}) {
  const reduced = useReduceMotion();
  const scale = useSharedValue(1);
  useEffect(() => { if (reduced || props.disabled) scale.value = 1; }, [reduced, props.disabled, scale]);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return <Animated.View style={[containerStyle, animatedStyle]}><Pressable {...props}
    style={[{ minHeight: 44, justifyContent: 'center' }, style]}
    onPressIn={event => { scale.value = reduced ? 1 : withTiming(0.98, { duration: 90 }); props.onPressIn?.(event); }}
    onPressOut={event => { scale.value = withTiming(1, { duration: reduced ? 0 : 160 }); props.onPressOut?.(event); }}>
    {children}
  </Pressable></Animated.View>;
}

export function ActionButton({ label, onPress, disabled = false, busy = false, secondary = false, icon, containerStyle }: {
  label: string; onPress: () => void; disabled?: boolean; busy?: boolean; secondary?: boolean; icon?: IconName; containerStyle?: StyleProp<ViewStyle>;
}) {
  const p = usePalette();
  const color = secondary ? p.accent : p.onAccent;
  return <PressFeedback accessibilityRole="button" accessibilityLabel={label} containerStyle={containerStyle}
    accessibilityState={{ disabled: disabled || busy, busy }} disabled={disabled || busy}
    onPress={onPress} style={[styles.button, { backgroundColor: secondary ? p.accentSoft : p.accent, opacity: disabled || busy ? 0.55 : 1 }]}>
    {busy ? <ActivityIndicator color={color} /> : <>
      {icon && <Ionicons name={icon} size={21} color={color} accessible={false} />}
      <Text style={[styles.buttonText, { color }]}>{label}</Text>
    </>}
  </PressFeedback>;
}

export function IconButton({ name, label, onPress, disabled = false }: { name: IconName; label: string; onPress: () => void; disabled?: boolean }) {
  const p = usePalette();
  return <PressFeedback accessibilityRole="button" accessibilityLabel={label} onPress={onPress}
    disabled={disabled} accessibilityState={{ disabled }}
    style={{ width: 44, alignItems: 'center', opacity: disabled ? 0.4 : 1 }}><Ionicons name={name} size={24} color={p.accent} /></PressFeedback>;
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  const p = usePalette();
  return <View style={{ gap: 8 }}><AppText secondary style={{ fontSize: 14, fontWeight: '500' }}>{label}</AppText>
    <TextInput returnKeyType="done" onSubmitEditing={Keyboard.dismiss} {...props} accessibilityLabel={label} placeholderTextColor={p.secondary}
      selectionColor={p.accent} style={[styles.input, { color: p.text, backgroundColor: p.surface }, props.style]} />
  </View>;
}

export function AmountField({ label = 'Monto', currency, ...props }: TextInputProps & { label?: string; currency: Currency }) {
  const p = usePalette();
  const accessoryId = useId();
  return <View style={{ gap: 12, alignItems: 'center', paddingVertical: 12 }}>
    <AppText secondary style={{ fontSize: 15 }}>{label} · {currency}</AppText>
    <View style={{ width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
      <AppText accessible={false} style={{ fontSize: 30, lineHeight: 40, color: p.secondary }}>{currency === 'USD' ? 'US$' : '$'}</AppText>
      <TextInput keyboardType="decimal-pad" inputMode="decimal" maxLength={24} placeholder="0" {...props}
        accessibilityLabel={label + ' en ' + (currency === 'ARS' ? 'pesos argentinos' : 'dólares')}
        inputAccessoryViewID={Platform.OS === 'ios' ? accessoryId : undefined}
        selectionColor={p.accent} placeholderTextColor={p.secondary}
        style={[styles.amountInput, { color: p.text, fontSize: (props.value?.length ?? 0) > 12 ? 30 : 44 }, props.style]} />
    </View>
    {Platform.OS === 'ios' && <InputAccessoryView nativeID={accessoryId} backgroundColor={p.surface}>
      <View style={{ alignItems: 'flex-end', paddingHorizontal: 20 }}>
        <PressFeedback accessibilityRole="button" accessibilityLabel="Cerrar teclado del monto" onPress={Keyboard.dismiss} style={{ paddingHorizontal: 12 }}>
          <AppText style={{ color: p.accent, fontWeight: '600' }}>Listo</AppText>
        </PressFeedback>
      </View>
    </InputAccessoryView>}
  </View>;
}

function Choice({ label, selected, disabled, onPress }: { label: string; selected: boolean; disabled?: boolean; onPress: () => void }) {
  const p = usePalette();
  const reduced = useReduceMotion();
  const opacity = useSharedValue(selected ? 1 : 0);
  useEffect(() => { opacity.value = withTiming(selected ? 1 : 0, { duration: reduced ? 0 : 160 }); }, [selected, reduced, opacity]);
  const selectionStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <PressFeedback containerStyle={{ flex: 1, flexBasis: 90, minWidth: 90 }}
    accessibilityRole="button" accessibilityState={{ selected, disabled }} disabled={disabled}
    onPress={onPress} style={styles.choice}>
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: 12, backgroundColor: p.surface }, selectionStyle]} />
    <AppText style={{ fontSize: 15, textAlign: 'center', fontWeight: '600', color: selected ? p.text : p.secondary }}>{label}</AppText>
  </PressFeedback>;
}

export function Choices<T extends string>({ value, options, onChange, disabled }: {
  value: T; options: { value: T; label: string }[]; onChange: (value: T) => void; disabled?: boolean;
}) {
  const p = usePalette();
  return <View style={[styles.choices, { backgroundColor: p.inset }]}>
    {options.map(option => <Choice key={option.value} label={option.label} selected={value === option.value}
      disabled={disabled} onPress={() => onChange(option.value)} />)}
  </View>;
}

export function EmptyState({ title, detail, action, icon = 'wallet-outline' }: { title: string; detail: string; action?: ReactNode; icon?: IconName }) {
  const p = usePalette();
  return <Surface style={{ gap: 18, paddingVertical: 28 }}>
    <View style={[styles.emptyIcon, { backgroundColor: p.accentSoft }]}><Ionicons name={icon} color={p.accent} size={28} accessible={false} /></View>
    <AppText accessibilityRole="header" style={{ fontSize: 26, lineHeight: 33, fontWeight: '700', letterSpacing: -0.6 }}>{title}</AppText>
    <AppText secondary>{detail}</AppText>
    {action}
  </Surface>;
}

export function ErrorMessage({ message }: { message: string | null }) {
  const p = usePalette();
  return message ? <View style={{ padding: 14, borderRadius: 14, backgroundColor: p.negativeSoft }}>
    <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={[styles.text, { color: p.negative }]}>{message}</Text>
  </View> : null;
}

export function Money({ minor, currency, large = false, color, signed = false }: {
  minor: number; currency: Currency; large?: boolean; color?: string; signed?: boolean;
}) {
  const p = usePalette();
  const sign = minor < 0 ? '−' : signed && minor > 0 ? '+' : '';
  return <Text accessibilityLabel={(minor < 0 ? 'Menos ' : '') + formatMinorUnits(Math.abs(minor)) + (currency === 'USD' ? ' dólares' : ' pesos')}
    style={{ color: color ?? p.text, fontSize: large ? 42 : 17, fontWeight: large ? '700' : '600',
      letterSpacing: large ? -1.4 : -0.2, fontVariant: ['tabular-nums'], flexShrink: 1, maxWidth: '100%' }}>
    {sign}{currency === 'USD' ? 'US$ ' : '$ '}{formatMinorUnits(Math.abs(minor))}
  </Text>;
}

export function DetailRow({ label, value, icon, onPress, last = false, disabled = false }: {
  label: string; value: string; icon?: IconName; onPress?: () => void; last?: boolean; disabled?: boolean;
}) {
  const p = usePalette();
  const { fontScale } = useWindowDimensions();
  const content = <>
    {icon && <Ionicons name={icon} size={21} color={p.secondary} accessible={false} />}
    <View style={{ flex: 1, minWidth: 0, gap: 4, flexDirection: fontScale > 1.3 ? 'column' : 'row', alignItems: fontScale > 1.3 ? 'flex-start' : 'center' }}>
      <AppText secondary style={{ fontSize: 15, flexShrink: 1 }}>{label}</AppText>
      <AppText style={{ flex: fontScale > 1.3 ? undefined : 1, textAlign: fontScale > 1.3 ? 'left' : 'right', fontSize: 16, flexShrink: 1 }}>{value}</AppText>
    </View>
    {onPress && <Ionicons name="chevron-forward" size={16} color={p.secondary} accessible={false} />}
  </>;
  const style: StyleProp<ViewStyle> = [styles.detailRow, { borderBottomColor: p.line, borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth }];
  return onPress ? <PressFeedback accessibilityRole="button" accessibilityLabel={label + ': ' + value}
    disabled={disabled} accessibilityState={{ disabled }} onPress={onPress} style={style}>{content}</PressFeedback> : <View style={style}>{content}</View>;
}

export function EntryRow({ entry, account, last = false, showDate = true }: { entry: Entry; account: Account; last?: boolean; showDate?: boolean }) {
  const p = usePalette();
  const { fontScale } = useWindowDimensions();
  const day = useCurrentDay();
  const dateLabel = labelFromISO(entry.dateISO, new Date(day + 'T12:00:00'));
  const income = entry.kind === 'income';
  return <PressFeedback accessibilityRole="button"
    accessibilityLabel={[entry.merchant, income ? 'ingreso' : 'gasto', formatMinorUnits(entry.amountMinor) + ' ' + account.currency, entry.category, account.name, dateLabel].join(', ')}
    onPress={() => router.push({ pathname: '/entry/[id]', params: { id: entry.id } })}
    style={[styles.entry, { borderBottomColor: p.line, borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth }]}>
    <View style={[styles.rowIcon, { backgroundColor: income ? p.positiveSoft : p.inset }]}>
      <Ionicons name={income ? 'arrow-down-outline' : 'arrow-up-outline'} size={19} color={income ? p.positive : p.secondary} accessible={false} />
    </View>
    <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
      <View style={{ flexDirection: fontScale > 1.3 ? 'column' : 'row', gap: 6, alignItems: fontScale > 1.3 ? 'flex-start' : 'baseline' }}>
        <AppText numberOfLines={fontScale > 1.3 ? undefined : 1} style={{ flex: fontScale > 1.3 ? undefined : 1, fontWeight: '600' }}>{entry.merchant}</AppText>
        <View style={{ maxWidth: fontScale > 1.3 ? '100%' : '55%' }}><Money minor={income ? entry.amountMinor : -entry.amountMinor}
          currency={account.currency} signed color={income ? p.positive : p.text} /></View>
      </View>
      <AppText secondary numberOfLines={fontScale > 1.3 ? undefined : 2} style={{ fontSize: 13, lineHeight: 19 }}>
        {entry.category} · {account.name}{showDate ? ' · ' + dateLabel : ''}
      </AppText>
    </View>
  </PressFeedback>;
}

export function AccountRow({ account, entries, last = false }: { account: Account; entries: Entry[]; last?: boolean }) {
  const p = usePalette();
  const { fontScale } = useWindowDimensions();
  const balance = accountBalanceMinor(account, entries);
  return <PressFeedback accessibilityRole="button" accessibilityLabel={'Ver cuenta ' + account.name + ', saldo ' + formatMinorUnits(balance) + ' ' + account.currency}
    onPress={() => router.push({ pathname: '/account/[id]', params: { id: account.id } })}
    style={[styles.entry, { borderBottomColor: p.line, borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth }]}>
    <View style={[styles.rowIcon, { backgroundColor: p.accentSoft }]}><Ionicons name="wallet-outline" size={21} color={p.accent} accessible={false} /></View>
    <View style={{ flex: 1, minWidth: 0, gap: 5 }}>
      <AppText numberOfLines={fontScale > 1.3 ? undefined : 1} style={{ fontWeight: '600' }}>{account.name}</AppText>
      <Money minor={balance} currency={account.currency} />
    </View>
    <Ionicons name="chevron-forward" size={16} color={p.secondary} accessible={false} />
  </PressFeedback>;
}

export function EntryActions({ accountId, currency }: { accountId?: string; currency?: Currency }) {
  const { fontScale } = useWindowDimensions();
  return <View style={{ flexDirection: fontScale > 1.3 ? 'column' : 'row', gap: 12 }}>
    <ActionButton label="Gasto" icon="arrow-up-outline" containerStyle={{ flex: 1 }}
      onPress={() => router.push({ pathname: '/new-entry', params: { kind: 'expense', ...(accountId ? { accountId } : {}), ...(currency ? { currency } : {}) } })} />
    <ActionButton label="Ingreso" icon="arrow-down-outline" secondary containerStyle={{ flex: 1 }}
      onPress={() => router.push({ pathname: '/new-entry', params: { kind: 'income', ...(accountId ? { accountId } : {}), ...(currency ? { currency } : {}) } })} />
  </View>;
}

const styles = StyleSheet.create({
  text: { fontSize: 17, lineHeight: 24 },
  content: { padding: 20, paddingBottom: 40, gap: 24, flexGrow: 1 },
  surface: { borderRadius: 22, padding: 20, gap: 12 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, minHeight: 44, marginBottom: 6 },
  sectionTitle: { flex: 1, fontSize: 19, fontWeight: '600', letterSpacing: -0.35 },
  button: { flexDirection: 'row', gap: 8, borderRadius: 18, paddingVertical: 15, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center', minHeight: 54 },
  buttonText: { fontSize: 17, fontWeight: '600', textAlign: 'center', flexShrink: 1 },
  input: { borderRadius: 16, paddingHorizontal: 16, paddingVertical: 15, fontSize: 17, minHeight: 54 },
  amountInput: { minHeight: 64, minWidth: 72, maxWidth: '85%', flexShrink: 1, fontWeight: '600', fontVariant: ['tabular-nums'], paddingVertical: 8, textAlign: 'center' },
  choices: { flexDirection: 'row', flexWrap: 'wrap', borderRadius: 16, padding: 4, gap: 4 },
  choice: { minHeight: 44, paddingHorizontal: 10, paddingVertical: 8, alignItems: 'center' },
  emptyIcon: { width: 56, height: 56, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  entry: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 17, paddingHorizontal: 16 },
  rowIcon: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  detailRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 16 },
});
