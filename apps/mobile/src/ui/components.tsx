import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, InputAccessoryView, Keyboard, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
  useWindowDimensions, type PressableProps, type StyleProp, type TextInputProps, type TextProps, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { accountBalanceMinor, formatMinorUnits, labelFromISO, type Currency, type Entry, type Account, type Transfer } from '@finanzapp/domain';
import type { ActivityItem } from './presentation';
import { router } from 'expo-router';
import { radius, space, type, useCurrentDay, usePalette, useReduceMotion, type Palette } from './theme';
import { categoryIcon, type IconName } from './categories';
import { tintOf } from './category-color';
import { useCategoryColor } from './category-hues';
import { SEGMENT_GAP, SEGMENT_PADDING, segmentLayout } from './geometry';
import { duration, easeOut, selectionHaptic, timing } from './motion';

export type { IconName } from './categories';
/** Colour carries meaning. Neutral is ink on fill; the rest are the four semantic tints. */
export type Tone = 'neutral' | 'expense' | 'income' | 'transfer' | 'warning';

export function toneColors(p: Palette, tone: Tone): { color: string; soft: string } {
  switch (tone) {
    case 'expense': return { color: p.expense, soft: p.expenseSoft };
    case 'income': return { color: p.income, soft: p.incomeSoft };
    case 'transfer': return { color: p.transfer, soft: p.transferSoft };
    case 'warning': return { color: p.warning, soft: p.warningSoft };
    default: return { color: p.text, soft: p.inset };
  }
}

export function AppText({ children, style, secondary = false, tertiary = false, variant = 'body', ...props }: TextProps & {
  secondary?: boolean; tertiary?: boolean; variant?: keyof typeof type;
}) {
  const p = usePalette();
  return <Text {...props} style={[type[variant], { color: tertiary ? p.tertiary : secondary ? p.secondary : p.text }, style]}>{children}</Text>;
}

export function Screen({ children, gap = space.xl }: { children: ReactNode; gap?: number }) {
  const p = usePalette();
  return <ScrollView style={{ flex: 1, backgroundColor: p.background }}
    contentContainerStyle={[styles.content, { gap }]} contentInsetAdjustmentBehavior="automatic"
    automaticallyAdjustKeyboardInsets keyboardShouldPersistTaps="handled"
    keyboardDismissMode="interactive">{children}</ScrollView>;
}

/** Light: white card with a soft shadow. Dark: a surface step, no shadow. */
export function surfaceShadow(p: Palette): ViewStyle {
  return p.isDark ? {} : { shadowColor: '#0A0A0C', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } };
}

/** A card (padded, soft shadow in light) or a grouped list (flat, clipped rows,
 * like an inset grouped table). */
export function Surface({ children, style, grouped = false }: { children: ReactNode; style?: StyleProp<ViewStyle>; grouped?: boolean }) {
  const p = usePalette();
  return <View style={[styles.surface, { backgroundColor: p.surface }, grouped ? { padding: 0, gap: 0, overflow: 'hidden', borderRadius: radius.group } : surfaceShadow(p), style]}>{children}</View>;
}

export function SectionTitle({ children, action, onAction, caption }: { children: ReactNode; action?: string; onAction?: () => void; caption?: string }) {
  const p = usePalette();
  return <View style={styles.sectionHeading}>
    <View style={{ flex: 1, gap: 2 }}>
      <AppText accessibilityRole="header" variant="headline">{children}</AppText>
      {caption && <AppText secondary variant="footnote">{caption}</AppText>}
    </View>
    {action && onAction && <PressFeedback feedback="opacity" accessibilityRole="button" accessibilityLabel={action} onPress={onAction} style={{ paddingLeft: 12, minHeight: 36 }}>
      <AppText variant="subhead" style={{ color: p.tint, fontWeight: '500' }}>{action}</AppText>
    </PressFeedback>}
  </View>;
}

/** Feedback on press-in, commit on press-out, in 100 ms so the interface
 * answers the finger before the tap completes. Three native treatments:
 * `scale` (0.97) for buttons, cards and chips; `highlight` (a translucent
 * tint over the row, like a table cell) for full-width rows, which must not
 * shrink; `opacity` (0.4) for bare text and icon buttons, like a bar button. */
export type PressTreatment = 'scale' | 'highlight' | 'opacity';

export function PressFeedback({ children, style, containerStyle, feedback = 'scale', ...props }: PressableProps & {
  children: ReactNode; style?: StyleProp<ViewStyle>; containerStyle?: StyleProp<ViewStyle>; feedback?: PressTreatment;
}) {
  const p = usePalette();
  const reduced = useReduceMotion();
  const pressed = useSharedValue(0);
  useEffect(() => { if (props.disabled) pressed.value = 0; }, [props.disabled, pressed]);
  const animatedStyle = useAnimatedStyle(() => feedback === 'scale' ? { transform: [{ scale: 1 - 0.03 * pressed.value }] }
    : feedback === 'opacity' ? { opacity: 1 - 0.6 * pressed.value } : {});
  const highlightStyle = useAnimatedStyle(() => ({ opacity: pressed.value }));
  // Reduce Motion drops the scale but keeps the tint and dim: a colour change is not movement.
  const active = feedback !== 'scale' || !reduced;
  return <Animated.View style={[containerStyle, animatedStyle]}><Pressable {...props}
    style={[{ minHeight: 44, justifyContent: 'center' }, style]} pressRetentionOffset={12}
    onPressIn={event => { pressed.value = active ? withTiming(1, { duration: duration.press, easing: easeOut }) : 0; props.onPressIn?.(event); }}
    onPressOut={event => { pressed.value = withTiming(0, { duration: active ? duration.release : 0, easing: easeOut }); props.onPressOut?.(event); }}>
    {feedback === 'highlight' && <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: p.isDark ? 'rgba(255,255,255,0.07)' : 'rgba(10,10,12,0.05)' }, highlightStyle]} />}
    {children}
  </Pressable></Animated.View>;
}

export function ActionButton({ label, onPress, disabled = false, busy = false, secondary = false, tone, icon, containerStyle, compact = false }: {
  label: string; onPress: () => void; disabled?: boolean; busy?: boolean; secondary?: boolean; tone?: Exclude<Tone, 'neutral'>;
  icon?: IconName; containerStyle?: StyleProp<ViewStyle>; compact?: boolean;
}) {
  const p = usePalette();
  const semantic = tone ? toneColors(p, tone) : null;
  const background = semantic ? (secondary ? semantic.soft : semantic.color) : secondary ? p.accentSoft : p.accent;
  const color = semantic ? (secondary ? semantic.color : '#FFFFFF') : secondary ? p.text : p.onAccent;
  return <PressFeedback accessibilityRole="button" accessibilityLabel={label} containerStyle={containerStyle}
    accessibilityState={{ disabled: disabled || busy, busy }} disabled={disabled || busy}
    onPress={onPress} style={[styles.button, compact && styles.buttonCompact, { backgroundColor: background, opacity: disabled || busy ? 0.5 : 1 }]}>
    {busy ? <ActivityIndicator color={color} /> : <>
      {icon && <Ionicons name={icon} size={compact ? 18 : 20} color={color} accessible={false} />}
      <Text style={[styles.buttonText, compact && { fontSize: 15 }, { color }]}>{label}</Text>
    </>}
  </PressFeedback>;
}

export function IconButton({ name, label, onPress, disabled = false, color }: { name: IconName; label: string; onPress: () => void; disabled?: boolean; color?: string }) {
  const p = usePalette();
  return <PressFeedback feedback="opacity" accessibilityRole="button" accessibilityLabel={label} onPress={onPress}
    disabled={disabled} accessibilityState={{ disabled }}
    style={{ width: 44, alignItems: 'center', opacity: disabled ? 0.35 : 1 }}><Ionicons name={name} size={24} color={color ?? p.text} /></PressFeedback>;
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  const p = usePalette();
  return <View style={{ gap: 8 }}><AppText secondary variant="footnote" style={{ fontWeight: '500' }}>{label}</AppText>
    <TextInput returnKeyType="done" onSubmitEditing={Keyboard.dismiss} {...props} accessibilityLabel={label} placeholderTextColor={p.tertiary}
      selectionColor={p.tint} style={[styles.input, { color: p.text, backgroundColor: p.surface }, props.style]} />
  </View>;
}

export function AmountField({ label = 'Monto', currency, tone, ...props }: TextInputProps & { label?: string; currency: Currency; tone?: Tone }) {
  const p = usePalette();
  const accessoryId = useId();
  const length = props.value?.length ?? 0;
  const long = length > 11;
  const amountSize = length > 17 ? 24 : long ? 32 : 46;
  const color = tone && tone !== 'neutral' ? toneColors(p, tone).color : p.text;
  return <View style={{ gap: 10, alignItems: 'center', paddingVertical: 8 }}>
    <AppText secondary variant="footnote" style={{ fontWeight: '500' }}>{label} · {currency}</AppText>
    <View style={{ width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
      <AppText accessible={false} style={{ fontSize: long ? 26 : 32, lineHeight: long ? 34 : 40, color: p.secondary, fontWeight: '500' }}>{currency === 'USD' ? 'US$' : '$'}</AppText>
      <TextInput keyboardType="decimal-pad" inputMode="decimal" maxLength={24} placeholder="0" {...props}
        accessibilityLabel={label + ' en ' + (currency === 'ARS' ? 'pesos argentinos' : 'dólares')}
        inputAccessoryViewID={Platform.OS === 'ios' ? accessoryId : undefined}
        selectionColor={p.tint} placeholderTextColor={p.tertiary}
        style={[styles.amountInput, { color, fontSize: amountSize }, props.style]} />
    </View>
    {Platform.OS === 'ios' && <InputAccessoryView nativeID={accessoryId} backgroundColor={p.surface}>
      <View style={{ alignItems: 'flex-end', paddingHorizontal: 20 }}>
        <PressFeedback feedback="opacity" accessibilityRole="button" accessibilityLabel="Cerrar teclado del monto" onPress={Keyboard.dismiss} style={{ paddingHorizontal: 12 }}>
          <AppText style={{ color: p.tint, fontWeight: '600' }}>Listo</AppText>
        </PressFeedback>
      </View>
    </InputAccessoryView>}
  </View>;
}

function Choice({ label, selected, disabled, onPress }: { label: string; selected: boolean; disabled?: boolean; onPress: () => void }) {
  const p = usePalette();
  const reduced = useReduceMotion();
  return <Pressable accessibilityRole="button" accessibilityState={{ selected, disabled }} disabled={disabled}
    onPress={onPress} style={styles.choice} hitSlop={4}>
    <Animated.Text numberOfLines={1} style={{ fontSize: 13, lineHeight: 18, textAlign: 'center', fontWeight: '600', color: selected ? p.text : p.secondary,
      transitionProperty: 'color', transitionDuration: reduced ? 0 : duration.state }}>{label}</Animated.Text>
  </Pressable>;
}

/** Native-style segmented control: one thumb slides to the chosen segment
 * (interruptible, 200 ms ease-out, none under Reduce Motion) and the change
 * ticks with a selection haptic. Tapping the current value does nothing. */
export function Choices<T extends string>({ value, options, onChange, disabled }: {
  value: T; options: { value: T; label: string }[]; onChange: (value: T) => void; disabled?: boolean;
}) {
  const p = usePalette();
  const reduced = useReduceMotion();
  const [trackWidth, setTrackWidth] = useState(0);
  const index = Math.max(0, options.findIndex(option => option.value === value));
  const { width, offset } = segmentLayout(trackWidth, options.length, index);
  const x = useSharedValue(offset);
  const measured = useRef(false);
  useEffect(() => {
    // The first measurement places the thumb; later changes slide it.
    if (!measured.current || reduced) { x.value = offset; measured.current = trackWidth > 0; return; }
    x.value = withTiming(offset, timing('state', reduced));
  }, [offset, reduced, trackWidth, x]);
  const thumbStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  return <View style={[styles.choices, { backgroundColor: p.inset }]} onLayout={event => setTrackWidth(event.nativeEvent.layout.width)}>
    {width > 0 && <Animated.View pointerEvents="none" style={[styles.thumb, { width, backgroundColor: p.isDark ? p.elevated : p.surface },
      p.isDark ? {} : { shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } }, thumbStyle]} />}
    {options.map(option => <Choice key={option.value} label={option.label} selected={value === option.value}
      disabled={disabled} onPress={() => { if (option.value !== value) { selectionHaptic(); onChange(option.value); } }} />)}
  </View>;
}

/** A glyph on a soft tile. `color` gives the tile an identity (a category
 * hue); otherwise the tone decides. The tile is one object: hue in the glyph
 * and in its background, never a separate swatch beside it. */
export function GlyphTile({ icon, tone = 'neutral', large = false, size, color }: { icon: IconName; tone?: Tone; large?: boolean; size?: number; color?: string }) {
  const p = usePalette();
  const colors = color ? { color, soft: tintOf(color, p) } : toneColors(p, tone);
  const side = size ?? (large ? 56 : 40);
  return <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
    style={{ width: side, height: side, borderRadius: large ? 16 : radius.tile, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.soft }}>
    <Ionicons name={icon} size={large ? 26 : 20} color={colors.color} />
  </View>;
}

export function EmptyState({ title, detail, action, icon = 'wallet-outline' }: { title: string; detail: string; action?: ReactNode; icon?: IconName }) {
  return <Surface style={{ gap: 16, paddingVertical: 28 }}>
    <GlyphTile icon={icon} large />
    <AppText accessibilityRole="header" variant="title2">{title}</AppText>
    <AppText secondary variant="subhead">{detail}</AppText>
    {action}
  </Surface>;
}

export function ErrorMessage({ message }: { message: string | null }) {
  const p = usePalette();
  return message ? <View style={{ padding: 14, borderRadius: radius.button, backgroundColor: p.expenseSoft }}>
    <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={[type.subhead, { color: p.expense }]}>{message}</Text>
  </View> : null;
}

/** Amounts are ink by default. Income is green with a plus; an explicit negative
 * value shows a minus. Colour never replaces the sign or the label. An amount is
 * always one line: a short value stays large and a long one scales down to fit
 * its container (to half size for a hero, three quarters in a row) instead of
 * wrapping or clipping. Dynamic Type still applies, capped so a hero cannot
 * outgrow the screen. */
export function Money({ minor, currency, large = false, color, signed = false, size, tone = 'neutral', weight }: {
  minor: number; currency: Currency; large?: boolean; color?: string; signed?: boolean; size?: number; tone?: Tone; weight?: '500' | '600' | '700';
}) {
  const p = usePalette();
  const sign = minor < 0 ? '−' : signed && minor > 0 ? '+' : '';
  const semantic = tone === 'income' ? p.income : tone === 'expense' ? p.text : tone === 'transfer' ? p.transfer : tone === 'warning' ? p.warning : p.text;
  const fontSize = size ?? (large ? 44 : 17);
  const hero = fontSize >= 28;
  return <Text accessibilityLabel={(minor < 0 ? 'Menos ' : '') + formatMinorUnits(Math.abs(minor)) + (currency === 'USD' ? ' dólares' : ' pesos')}
    numberOfLines={1} adjustsFontSizeToFit minimumFontScale={hero ? 0.5 : 0.75} maxFontSizeMultiplier={hero ? 1.4 : 1.8}
    style={{ color: color ?? semantic, fontSize, lineHeight: Math.round(fontSize * 1.18), fontWeight: weight ?? (large ? '700' : '600'),
      letterSpacing: hero ? -fontSize * 0.03 : -0.2, fontVariant: ['tabular-nums'], flexShrink: 1, maxWidth: '100%' }}>
    {sign}{currency === 'USD' ? 'US$ ' : '$ '}{formatMinorUnits(Math.abs(minor))}
  </Text>;
}

export function DetailRow({ label, value, icon, onPress, last = false, disabled = false, tone = 'neutral' }: {
  label: string; value: string; icon?: IconName; onPress?: () => void; last?: boolean; disabled?: boolean; tone?: Tone;
}) {
  const p = usePalette();
  const { fontScale } = useWindowDimensions();
  const stacked = fontScale > 1.3;
  const content = <>
    {icon && <Ionicons name={icon} size={20} color={tone === 'neutral' ? p.secondary : toneColors(p, tone).color} accessible={false} />}
    <View style={{ flex: 1, minWidth: 0, gap: 3, flexDirection: stacked ? 'column' : 'row', alignItems: stacked ? 'flex-start' : 'center' }}>
      <AppText secondary variant="subhead" style={{ flexShrink: 1 }}>{label}</AppText>
      <AppText style={{ flex: stacked ? undefined : 1, textAlign: stacked ? 'left' : 'right', flexShrink: 1 }}>{value}</AppText>
    </View>
    {onPress && <Ionicons name="chevron-forward" size={16} color={p.tertiary} accessible={false} />}
  </>;
  const style: StyleProp<ViewStyle> = [styles.detailRow, { borderBottomColor: p.line, borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth }];
  return onPress ? <PressFeedback feedback="highlight" accessibilityRole="button" accessibilityLabel={label + ': ' + value}
    disabled={disabled} accessibilityState={{ disabled }} onPress={onPress} style={style}>{content}</PressFeedback> : <View style={style}>{content}</View>;
}

/** Compact statistic: eyebrow label over a value. */
export function Stat({ label, children, align = 'left' }: { label: string; children: ReactNode; align?: 'left' | 'right' }) {
  return <View style={{ gap: 3, alignItems: align === 'right' ? 'flex-end' : 'flex-start', minWidth: 0 }}>
    <AppText secondary variant="caption" style={{ fontWeight: '500' }}>{label}</AppText>
    {children}
  </View>;
}

/** The category as one designed object: its glyph on its own hue. Income and
 * warning tones override the hue because that meaning matters more. */
export function CategoryBadge({ category, large = false, tone = 'neutral' }: { category: string; large?: boolean; tone?: Tone }) {
  const color = useCategoryColor(category);
  return <GlyphTile icon={categoryIcon(category)} large={large} tone={tone} color={tone === 'neutral' ? color : undefined} />;
}

/** One transaction line: merchant, then category · account · date; amount on the right. */
export function EntryRow({ entry, account, last = false, showDate = true, showAccount = true }: {
  entry: Entry; account: Account; last?: boolean; showDate?: boolean; showAccount?: boolean;
}) {
  const p = usePalette();
  const { fontScale } = useWindowDimensions();
  const day = useCurrentDay();
  const dateLabel = labelFromISO(entry.dateISO, new Date(day + 'T12:00:00'));
  const income = entry.kind === 'income';
  const stacked = fontScale > 1.3;
  const detail = [entry.category, showAccount ? account.name : null, showDate ? dateLabel : null].filter(Boolean).join(' · ');
  return <PressFeedback feedback="highlight" accessibilityRole="button"
    accessibilityLabel={[entry.merchant, income ? 'ingreso' : 'gasto', formatMinorUnits(entry.amountMinor) + ' ' + account.currency, entry.category, account.name, dateLabel].join(', ')}
    onPress={() => router.push({ pathname: '/entry/[id]', params: { id: entry.id } })}
    style={[styles.row, { borderBottomColor: p.line, borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth }]}>
    <CategoryBadge category={entry.category} tone={income ? 'income' : 'neutral'} />
    <View style={{ flex: 1, minWidth: 0, gap: 8, flexDirection: stacked ? 'column' : 'row', alignItems: stacked ? 'flex-start' : 'center' }}>
      <View style={{ flex: stacked ? undefined : 1, minWidth: 0, gap: 3 }}>
        <AppText numberOfLines={stacked ? undefined : 1} style={{ fontWeight: '500' }}>{entry.merchant}</AppText>
        <AppText secondary variant="footnote" numberOfLines={stacked ? undefined : 1}>{detail}</AppText>
      </View>
      <View style={{ maxWidth: stacked ? '100%' : '48%', alignItems: 'flex-end' }}>
        <Money minor={income ? entry.amountMinor : -entry.amountMinor} currency={account.currency} signed tone={income ? 'income' : 'expense'} />
      </View>
    </View>
  </PressFeedback>;
}

export function AccountRow({ account, entries, transfers, last = false, kindLabel = 'Cuenta' }: {
  account: Account; entries: Entry[]; transfers?: Transfer[]; last?: boolean; kindLabel?: string;
}) {
  const p = usePalette();
  const { fontScale } = useWindowDimensions();
  const balance = accountBalanceMinor(account, entries, transfers);
  const stacked = fontScale > 1.3;
  return <PressFeedback feedback="highlight" accessibilityRole="button" accessibilityLabel={'Ver cuenta ' + account.name + ', saldo ' + formatMinorUnits(balance) + ' ' + account.currency}
    onPress={() => router.push({ pathname: '/account/[id]', params: { id: account.id } })}
    style={[styles.row, { borderBottomColor: p.line, borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth }]}>
    <GlyphTile icon="wallet-outline" />
    <View style={{ flex: 1, minWidth: 0, gap: 8, flexDirection: stacked ? 'column' : 'row', alignItems: stacked ? 'flex-start' : 'center' }}>
      <View style={{ flex: stacked ? undefined : 1, minWidth: 0, gap: 3 }}>
        <AppText numberOfLines={stacked ? undefined : 1} style={{ fontWeight: '500' }}>{account.name}</AppText>
        <AppText secondary variant="footnote">{kindLabel} · {account.currency}</AppText>
      </View>
      <Money minor={balance} currency={account.currency} color={balance < 0 ? p.expense : undefined} />
    </View>
    <Ionicons name="chevron-forward" size={16} color={p.tertiary} accessible={false} />
  </PressFeedback>;
}

/** `context` describes the screen the row sits on: inside a card or a debt,
 * a transfer is a payment/collection and reads better without a +/− sign. */
export type RowContext = 'card' | 'debt';

export function MovementRow({ item, accounts, accountId, last, showDate = true, context }: {
  item: ActivityItem; accounts: Account[]; accountId?: string; last?: boolean; showDate?: boolean; context?: RowContext;
}) {
  return item.type === 'entry' ? <EntryRow entry={item.value} account={accounts.find(a => a.id === item.value.accountId)!} last={last} showDate={showDate} showAccount={!accountId} />
    : <TransferRow transfer={item.value} accounts={accounts} accountId={accountId} last={last} showDate={showDate} context={context} />;
}

export function TransferRow({ transfer: t, accounts, accountId, last = false, showDate = true, context }: {
  transfer: Transfer; accounts: Account[]; accountId?: string; last?: boolean; showDate?: boolean; context?: RowContext;
}) {
  const p = usePalette();
  const { fontScale } = useWindowDimensions();
  const day = useCurrentDay();
  const from = accounts.find(a => a.id === t.fromAccountId)!, to = accounts.find(a => a.id === t.toAccountId)!;
  const date = labelFromISO(t.dateISO, new Date(day + 'T12:00:00'));
  const stacked = fontScale > 1.3;
  const outgoing = accountId === from.id;
  const incoming = accountId === to.id;
  const title = context === 'card' ? (incoming ? 'Pago de tarjeta' : 'Transferencia') : context === 'debt' ? (incoming ? 'Pago' : 'Cobro') : t.note || 'Transferencia';
  const detail = context ? [t.note && t.note !== title ? t.note : null, incoming ? 'desde ' + from.name : 'hacia ' + to.name, showDate ? date : null].filter(Boolean).join(' · ')
    : `${from.name} → ${to.name}${showDate ? ' · ' + date : ''}`;
  const signed = !!accountId && !context;
  return <PressFeedback feedback="highlight" accessibilityRole="button"
    accessibilityLabel={`${title}, de ${from.name} a ${to.name}, ${formatMinorUnits(t.amountMinor)} ${from.currency}, ${date}${t.note ? ', ' + t.note : ''}`}
    onPress={() => router.push({ pathname: '/transfer/[id]', params: { id: t.id } })}
    style={[styles.row, { borderBottomColor: p.line, borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth }]}>
    <GlyphTile icon={context === 'card' ? 'card-outline' : context === 'debt' ? 'people-outline' : 'swap-horizontal-outline'} tone="transfer" />
    <View style={{ flex: 1, minWidth: 0, gap: 8, flexDirection: stacked ? 'column' : 'row', alignItems: stacked ? 'flex-start' : 'center' }}>
      <View style={{ flex: stacked ? undefined : 1, minWidth: 0, gap: 3 }}>
        <AppText numberOfLines={stacked ? undefined : 1} style={{ fontWeight: '500' }}>{title}</AppText>
        <AppText secondary variant="footnote" numberOfLines={stacked ? undefined : 1}>{detail}</AppText>
      </View>
      <View style={{ maxWidth: stacked ? '100%' : '48%', alignItems: 'flex-end' }}>
        <Money minor={signed && outgoing ? -t.amountMinor : t.amountMinor} currency={from.currency} signed={signed} tone="transfer"
          color={accountId ? undefined : p.text} />
      </View>
    </View>
  </PressFeedback>;
}

const styles = StyleSheet.create({
  content: { padding: space.xl, paddingBottom: 48, flexGrow: 1 },
  surface: { borderRadius: radius.card, padding: space.l, gap: space.m },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, minHeight: 36, marginBottom: 8 },
  button: { flexDirection: 'row', gap: 8, borderRadius: radius.button, paddingVertical: 14, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center', minHeight: 52 },
  buttonCompact: { minHeight: 44, paddingVertical: 10, paddingHorizontal: 14 },
  buttonText: { fontSize: 17, fontWeight: '600', textAlign: 'center', flexShrink: 1 },
  input: { borderRadius: radius.button, paddingHorizontal: 16, paddingVertical: 14, fontSize: 17, minHeight: 52 },
  amountInput: { minHeight: 60, minWidth: 72, maxWidth: '85%', flexShrink: 1, fontWeight: '700', letterSpacing: -1.2, fontVariant: ['tabular-nums'], paddingVertical: 6, textAlign: 'center' },
  choices: { flexDirection: 'row', borderRadius: 10, padding: SEGMENT_PADDING, gap: SEGMENT_GAP },
  thumb: { position: 'absolute', top: SEGMENT_PADDING, bottom: SEGMENT_PADDING, left: 0, borderRadius: 8 },
  choice: { flex: 1, minWidth: 72, minHeight: 32, paddingHorizontal: 8, paddingVertical: 6, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 16, minHeight: 64 },
  detailRow: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
});
