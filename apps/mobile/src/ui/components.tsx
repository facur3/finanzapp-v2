import { Children, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Alert, InputAccessoryView, Keyboard, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
  useWindowDimensions, type PressableProps, type StyleProp, type TextInputProps, type TextProps, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { accountBalanceMinor, formatMinorUnits, type Currency, type Entry, type EntryKind, type Account, type Transfer } from '@finanzapp/domain';
import type { ActivityItem } from './presentation';
import { router } from 'expo-router';
import { radius, space, type, useCurrentDay, usePalette, useReduceMotion, type Palette } from './theme';
import type { IconName } from './categories';
import { tintOf } from './category-color';
import { useAccountLook, useCategoryLook } from './category-hues';
import { AMOUNT_FIELD, ROW_STACK_SCALE, SEGMENT_GAP, SEGMENT_PADDING, amountFieldLayout, fitFontSize, rowStacks, segmentLayout } from './geometry';
import { duration, easeOut, selectionHaptic, timing } from './motion';
import { EMPTY_AMOUNT, amountFromCanonical, readAmountChange, renderAmount, settleAmount, splitAmount } from './money-input';
import { useI18n } from '../i18n/provider';

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

/** Whether a row should stack its label and value (or name and amount) as
 * two lines instead of sharing one: at large Dynamic Type sizes a name and a
 * money value no longer fit side by side, and truncating either would hide
 * data. With an amount, the row also stacks on a screen too narrow for that
 * amount beside a name (rowStacks), so a 13-digit price or a long currency
 * prefix gets the whole row instead of shrinking or clipping. One rule for
 * every row, so the interface changes shape for one reason, not row by row. */
export const STACK_AT_SCALE = ROW_STACK_SCALE;
export function useStacked(amount?: { minor: number; currency: Currency; signed?: boolean }): boolean {
  const { fontScale, width } = useWindowDimensions();
  return rowStacks(width, fontScale, amount ? rowAmountText(amount.minor, amount.currency, amount.signed ?? false) : undefined);
}

/** The string a row amount renders (sign, symbol, grouped number), for width estimates. */
export function rowAmountText(minor: number, currency: Currency, signed = false): string {
  const sign = minor < 0 ? '−' : signed && minor > 0 ? '+' : '';
  return sign + (currency === 'USD' ? 'US$ ' : '$ ') + formatMinorUnits(Math.abs(minor));
}

/** Text in one of the named styles. A larger `fontSize` in `style` without
 * its own `lineHeight` gets a line box that fits it, instead of inheriting the
 * variant's smaller one; on iOS a glyph taller than its line box is clipped
 * at the top ("Comida" lost its ascenders on the category detail). */
export function AppText({ children, style, secondary = false, tertiary = false, variant = 'body', ...props }: TextProps & {
  secondary?: boolean; tertiary?: boolean; variant?: keyof typeof type;
}) {
  const p = usePalette();
  const flat = StyleSheet.flatten(style);
  const fits = flat?.fontSize && !flat.lineHeight ? { lineHeight: Math.round(flat.fontSize * 1.25) } : null;
  return <Text {...props} style={[type[variant], { color: tertiary ? p.tertiary : secondary ? p.secondary : p.text }, style, fits]}>{children}</Text>;
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
      <AppText variant="subhead" style={{ color: p.primary, fontWeight: '500' }}>{action}</AppText>
    </PressFeedback>}
  </View>;
}

/** Feedback on press-in, commit on press-out, in 100 ms so the interface
 * answers the finger before the tap completes. Three native treatments:
 * `scale` (0.97) for buttons, cards and chips; `highlight` (a translucent
 * tint over the row, like a table cell) for full-width rows, which must not
 * shrink; `opacity` (0.4) for bare text and icon buttons, like a bar button. */
export type PressTreatment = 'scale' | 'highlight' | 'opacity';

export function PressFeedback({ children, style, containerStyle, feedback = 'scale', backdrop, ...props }: PressableProps & {
  children: ReactNode; style?: StyleProp<ViewStyle>; containerStyle?: StyleProp<ViewStyle>; feedback?: PressTreatment;
  /** Drawn under the highlight and the content: a proportional fill behind a row. */
  backdrop?: ReactNode;
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
    {backdrop}
    {feedback === 'highlight' && <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: p.isDark ? 'rgba(255,255,255,0.07)' : 'rgba(10,10,12,0.05)' }, highlightStyle]} />}
    {children}
  </Pressable></Animated.View>;
}

/** The one filled call to action on a screen is the brand primary with white
 * text. Secondary actions stay ink on the inset fill, so a screen has at most
 * one blue button; a semantic tone (a transfer, an income) still wins. */
export function ActionButton({ label, onPress, disabled = false, busy = false, secondary = false, tone, icon, containerStyle, compact = false }: {
  label: string; onPress: () => void; disabled?: boolean; busy?: boolean; secondary?: boolean; tone?: Exclude<Tone, 'neutral'>;
  icon?: IconName; containerStyle?: StyleProp<ViewStyle>; compact?: boolean;
}) {
  const p = usePalette();
  const semantic = tone ? toneColors(p, tone) : null;
  const background = semantic ? (secondary ? semantic.soft : semantic.color) : secondary ? p.inset : p.primaryFill;
  const color = semantic ? (secondary ? semantic.color : '#FFFFFF') : secondary ? p.text : p.onPrimary;
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
      selectionColor={p.primary} style={[styles.input, { color: p.text, backgroundColor: p.surface }, props.style]} />
  </View>;
}

type Caret = { start: number; end: number };

/** The amount, formatted as the user types: "2000000" reads "2.000.000" and
 * "2000,5" reads "2.000,5". The value the form holds is that display string;
 * it still goes through parseMinorUnits, so the stored amount is the same
 * integer whether the user typed a comma or a period.
 *
 * Editing is a canonical state (money-input.ts), not the display string. Each
 * native change event carries the new text and the native caret; both are
 * read into the state (digits and comma are the truth, a dot is grouping
 * unless it is explicit input), and the display text and display caret are
 * rendered from it and pushed back as the controlled `value` and `selection`
 * in one update. The caret is therefore a logical position among the digits,
 * which a grouping dot cannot move, and a change that arrives while the
 * native text still shows the previous, unformatted keystroke reads the same
 * digits. Selection events are mirrored into the state so a tap moves the
 * caret; one that describes a text other than the one shown (the raw text of
 * a keystroke being formatted) is ignored. A refused edit re-renders the same
 * value and caret, and React Native restores both natively.
 *
 * Geometry: the symbol is anchored at the left edge of the row and the
 * digits grow to the right from a fixed origin, in tabular figures, like a
 * ledger column. Nothing that is already on screen moves when a digit or a
 * grouping dot appears ("999" → "1.000", "999.999" → "1.000.000"): no
 * centring, no estimated symbol position, no layout animation per
 * keystroke. Only the font size steps down, and only when the whole amount
 * would no longer fit beside the symbol (amountFieldLayout). The row reads
 * left-aligned like the hero amounts of Inicio and the detail screens. No
 * negative tracking: on iOS it draws the last glyph past the measured width,
 * under the caret. */
export function AmountField({ label, currency, tone, value = '', onChangeText, ...props }: TextInputProps & { label?: string; currency: Currency; tone?: Tone }) {
  const p = usePalette();
  const { t } = useI18n();
  const accessoryId = useId();
  const { fontScale } = useWindowDimensions();
  const [rowWidth, setRowWidth] = useState(0);
  const [selection, setSelection] = useState<Caret>();
  // What the field shows and where its caret is, kept in a ref so a second keystroke in the same frame reads the latest render.
  const shown = useRef({ text: value, caret: value.length });
  const emitted = useRef(value);
  useEffect(() => {
    if (value === emitted.current) return;
    // The form changed the value itself (a prefill or a reset): adopt it and let the caret settle at the end.
    emitted.current = value;
    shown.current = { text: value, caret: value.length };
    setSelection(undefined);
  }, [value]);
  const title = label ?? t('amount.label');
  const symbol = currency === 'USD' ? 'US$' : '$';
  const { fontSize, symbolSize } = amountFieldLayout(value, rowWidth, symbol, AMOUNT_GAP, Math.min(fontScale, HERO_MAX_SCALE));
  const color = tone && tone !== 'neutral' ? toneColors(p, tone).color : p.text;
  const show = (rendered: { text: string; caret: number }) => {
    shown.current = rendered;
    setSelection({ start: rendered.caret, end: rendered.caret });
    if (rendered.text !== emitted.current) { emitted.current = rendered.text; onChangeText?.(rendered.text); }
  };
  const change = (event: { nativeEvent: { text: string; selection?: Caret } }) => {
    const { text, selection: native } = event.nativeEvent;
    show(renderAmount(readAmountChange(shown.current, text, native ? native.end : null)));
  };
  const select = (event: { nativeEvent: { selection: Caret; text?: string } }) => {
    const { selection: native, text } = event.nativeEvent;
    if (text !== undefined && text !== shown.current.text) return;
    shown.current = { ...shown.current, caret: native.end };
    setSelection(native);
  };
  const settle = () => show(renderAmount(settleAmount(amountFromCanonical(shown.current.text.replace(/\./g, '')) ?? EMPTY_AMOUNT)));
  return <View style={{ gap: 6, paddingVertical: 8 }}>
    <AppText secondary variant="footnote" style={{ fontWeight: '500' }}>{title} · {currency}</AppText>
    <View style={styles.amountRow} onLayout={event => setRowWidth(event.nativeEvent.layout.width)}>
      <AppText accessible={false} maxFontSizeMultiplier={HERO_MAX_SCALE}
        style={{ fontSize: symbolSize, lineHeight: Math.round(symbolSize * 1.25), color: p.secondary, fontWeight: '500' }}>{symbol}</AppText>
      <TextInput keyboardType="decimal-pad" inputMode="decimal" maxLength={24} placeholder="0" {...props} value={value} onChange={change}
        selection={selection} onSelectionChange={select}
        onBlur={event => { settle(); props.onBlur?.(event); }} onSubmitEditing={event => { settle(); props.onSubmitEditing?.(event); }}
        accessibilityLabel={t('amount.accessibility', { label: title, currency: t(currency === 'ARS' ? 'amount.inPesos' : 'amount.inDollars') })}
        inputAccessoryViewID={Platform.OS === 'ios' ? accessoryId : undefined}
        selectionColor={p.primary} placeholderTextColor={p.tertiary} maxFontSizeMultiplier={HERO_MAX_SCALE}
        style={[styles.amountInput, { color, fontSize, paddingRight: AMOUNT_FIELD.caret }, props.style]} />
    </View>
    {Platform.OS === 'ios' && <InputAccessoryView nativeID={accessoryId} backgroundColor={p.surface}>
      <View style={{ alignItems: 'flex-end', paddingHorizontal: 20 }}>
        <PressFeedback feedback="opacity" accessibilityRole="button" accessibilityLabel={t('common.closeAmountKeyboard')} onPress={Keyboard.dismiss} style={{ paddingHorizontal: 12 }}>
          <AppText style={{ color: p.primary, fontWeight: '600' }}>{t('common.done')}</AppText>
        </PressFeedback>
      </View>
    </InputAccessoryView>}
  </View>;
}

/** A quiet contextual action under an amount ("Usar todo", "Pagar total"):
 * a footnote with the recorded figure and a text button that only fills the
 * field. Saving stays with the primary button, so the person still reviews. */
export function AmountShortcut({ label, caption, onPress, disabled = false }: { label?: string; caption: string; onPress?: () => void; disabled?: boolean }) {
  const p = usePalette();
  return <View style={{ flexDirection: 'row', justifyContent: 'flex-start', alignItems: 'center', flexWrap: 'wrap', gap: 4, marginTop: -8 }}>
    <AppText secondary variant="footnote">{caption}{label && onPress ? ' ·' : ''}</AppText>
    {label && onPress && <PressFeedback feedback="opacity" accessibilityRole="button" accessibilityLabel={label + ', ' + caption}
      onPress={onPress} disabled={disabled} accessibilityState={{ disabled }} hitSlop={8}
      style={{ paddingVertical: 6, paddingHorizontal: 4, opacity: disabled ? 0.5 : 1 }}>
      <AppText variant="footnote" style={{ color: p.primary, fontWeight: '600' }}>{label}</AppText>
    </PressFeedback>}
  </View>;
}

function Choice({ label, selected, disabled, onPress }: { label: string; selected: boolean; disabled?: boolean; onPress: () => void }) {
  const p = usePalette();
  const reduced = useReduceMotion();
  return <Pressable accessibilityRole="button" accessibilityState={{ selected, disabled }} disabled={disabled}
    onPress={onPress} style={styles.choice} hitSlop={4}>
    <Animated.Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} maxFontSizeMultiplier={1.3}
      style={{ fontSize: 13, lineHeight: 18, textAlign: 'center', fontWeight: '600', color: selected ? p.primary : p.secondary,
        transitionProperty: 'color', transitionDuration: reduced ? 0 : duration.state }}>{label}</Animated.Text>
  </Pressable>;
}

/** Native-style segmented control: one thumb slides to the chosen segment
 * (interruptible, 200 ms ease-out, none under Reduce Motion) and the change
 * ticks with a selection haptic. The chosen label is the brand primary on a
 * neutral thumb: selection reads as selection without a filled blue block.
 * Tapping the current value does nothing. */
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

/** An empty or missing state as one calm card: a 44 pt glyph, a headline and
 * one line of guidance, never a full-screen illustration. */
export function EmptyState({ title, detail, action, icon = 'wallet-outline' }: { title: string; detail: string; action?: ReactNode; icon?: IconName }) {
  return <Surface style={{ gap: 12, paddingVertical: 22 }}>
    <GlyphTile icon={icon} size={44} />
    <AppText accessibilityRole="header" variant="title3">{title}</AppText>
    <AppText secondary variant="subhead">{detail}</AppText>
    {action && <View style={{ marginTop: 4 }}>{action}</View>}
  </Surface>;
}

/** Contextual help behind an information glyph: the full explanation lives in
 * a native alert, so a form keeps one short line next to the field. */
export function InfoButton({ title, detail, label }: { title: string; detail: string; label?: string }) {
  const p = usePalette();
  const { t } = useI18n();
  return <PressFeedback feedback="opacity" accessibilityRole="button" accessibilityLabel={label ?? t('common.moreInfoAbout', { title: title.toLowerCase() })} hitSlop={8}
    onPress={() => Alert.alert(title, detail)} style={{ minHeight: 28, minWidth: 28, alignItems: 'center', justifyContent: 'center' }}>
    <Ionicons name="information-circle-outline" size={18} color={p.tertiary} accessible={false} />
  </PressFeedback>;
}

/** A short note under a field with its help glyph: "Opcional. No cuenta como ingreso." and the full story one tap away. */
export function FieldNote({ children, help }: { children: string; help?: { title: string; detail: string } }) {
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: -space.s }}>
    <AppText secondary variant="footnote" style={{ flexShrink: 1 }}>{children}</AppText>
    {help && <InfoButton title={help.title} detail={help.detail} />}
  </View>;
}

/** A caught or stored error, shown in the interface language: a catalogue key
 * or a known thrown message is translated here, at display time, so an error
 * already on screen follows a language change (see `src/i18n/errors.ts`). */
export function ErrorMessage({ message }: { message: string | null }) {
  const p = usePalette();
  const { errorText } = useI18n();
  return message ? <View style={{ padding: 14, borderRadius: radius.button, backgroundColor: p.expenseSoft }}>
    <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={[type.subhead, { color: p.expense }]}>{errorText(message)}</Text>
  </View> : null;
}

const HERO_MAX_SCALE = 1.4, ROW_MAX_SCALE = 1.8;
const AMOUNT_GAP = 6;
/** The widest share of a row an amount may take beside a name before the row stacks: a full ARS price fits whole, the name still has half the row. */
const AMOUNT_COLUMN = '56%';

/** Amounts are ink by default. Income is green with a plus; an explicit negative
 * value shows a minus. Colour never replaces the sign or the label. An amount is
 * always one line. A hero (28 pt and up) measures the width it was given and
 * takes the largest size, down to half of its base, at which the whole string
 * fits; a short value stays at full size and a long one shrinks only as much as
 * it must. This replaces the native shrink-to-fit, which on iOS also fits the
 * measured height and collapsed long amounts to a few points. Row amounts keep
 * the native fit with a 3/4 floor and no fixed line height. Dynamic Type still
 * applies, capped so a hero cannot outgrow the screen. */
export function Money({ minor, currency, large = false, color, signed = false, size, tone = 'neutral', weight, align = 'left' }: {
  minor: number; currency: Currency; large?: boolean; color?: string; signed?: boolean; size?: number; tone?: Tone; weight?: '500' | '600' | '700';
  align?: 'left' | 'center';
}) {
  const p = usePalette();
  const { fontScale } = useWindowDimensions();
  const { spokenMoney } = useI18n();
  const [width, setWidth] = useState(0);
  const semantic = tone === 'income' ? p.income : tone === 'expense' ? p.text : tone === 'transfer' ? p.transfer : tone === 'warning' ? p.warning : p.text;
  const base = size ?? (large ? 44 : 17);
  const hero = base >= 28;
  const text = rowAmountText(minor, currency, signed);
  const fontSize = hero ? fitFontSize(text, width, base, Math.round(base / 2), Math.min(fontScale, HERO_MAX_SCALE)) : base;
  const label = spokenMoney(minor, currency);
  const ink = color ?? semantic;
  // A hero is one amount in three weights of the same colour: the symbol and
  // the cents step back so the whole units carry the number. Same size, same
  // baseline, one accessibility label; nested spans keep it one line.
  const parts = hero ? splitAmount(text) : null;
  const quiet = ink === p.text ? { symbol: p.secondary, cents: p.tertiary } : { symbol: ink + 'B3', cents: ink + '8C' };
  const body = <Text accessibilityLabel={label} numberOfLines={1} adjustsFontSizeToFit={!hero} minimumFontScale={0.75}
    maxFontSizeMultiplier={hero ? HERO_MAX_SCALE : ROW_MAX_SCALE}
    style={{ color: ink, fontSize, lineHeight: hero ? Math.round(fontSize * 1.18) : undefined, fontWeight: weight ?? (large ? '700' : '600'),
      letterSpacing: hero ? -fontSize * 0.03 : -0.2, fontVariant: ['tabular-nums'], flexShrink: 1, maxWidth: '100%', textAlign: align }}>
    {parts ? <>
      <Text style={{ color: quiet.symbol, fontWeight: '600' }}>{parts.prefix}</Text>
      {parts.whole}
      <Text style={{ color: quiet.cents, fontWeight: '600' }}>{parts.decimals}</Text>
    </> : text}
  </Text>;
  // The wrapper spans its container so the measured width is the space available, never the text's own width.
  return hero ? <View style={{ alignSelf: 'stretch' }} onLayout={event => setWidth(event.nativeEvent.layout.width)}>{body}</View> : body;
}

/** Label and value longer than this, together, no longer share one line on a
 * phone: the value moves under the label rather than wrapping right-aligned
 * into short fragments (the currency code or the amount alone on a line). */
export const DETAIL_INLINE_LIMIT = 30;

export function DetailRow({ label, value, icon, leading, onPress, last = false, disabled = false, tone = 'neutral', layout = 'auto' }: {
  label: string; value: string; icon?: IconName; onPress?: () => void; last?: boolean; disabled?: boolean; tone?: Tone;
  /** An identity tile (an account's look, a Más row) in place of the bare glyph. */
  leading?: ReactNode;
  /** `auto` stacks at large text or when the pair is long; `stacked` always; `inline` only at large text. */
  layout?: 'auto' | 'stacked' | 'inline';
}) {
  const p = usePalette();
  const large = useStacked();
  const stacked = layout === 'stacked' || large || (layout === 'auto' && label.length + value.length > DETAIL_INLINE_LIMIT);
  const content = <>
    {leading ?? (icon && <Ionicons name={icon} size={20} color={tone === 'neutral' ? p.secondary : toneColors(p, tone).color} accessible={false} />)}
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

/** A row that leads somewhere: a tinted identity tile or a neutral glyph, the
 * title as the primary line, the description underneath it in the secondary
 * colour, and a chevron. Title and subtitle never compete for one line, so a
 * long title ("Deudas y cobros") and a long description ("Debo · me deben")
 * both fit at any text size; each may wrap to two lines before truncating. */
export function NavigationRow({ title, subtitle, icon, leading, onPress, last = false, disabled = false }: {
  title: string; subtitle?: string; icon?: IconName; leading?: ReactNode; onPress: () => void; last?: boolean; disabled?: boolean;
}) {
  const p = usePalette();
  return <PressFeedback feedback="highlight" accessibilityRole="button" accessibilityLabel={subtitle ? title + ', ' + subtitle : title}
    disabled={disabled} accessibilityState={{ disabled }} onPress={onPress}
    style={[styles.navigationRow, { borderBottomColor: p.line, borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth, opacity: disabled ? 0.6 : 1 }]}>
    {leading ?? (icon && <View style={styles.navigationGlyph}><Ionicons name={icon} size={22} color={p.secondary} accessible={false} /></View>)}
    <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
      <AppText numberOfLines={2} style={{ fontWeight: '600' }}>{title}</AppText>
      {!!subtitle && <AppText secondary variant="footnote" numberOfLines={2}>{subtitle}</AppText>}
    </View>
    <Ionicons name="chevron-forward" size={16} color={p.tertiary} accessible={false} />
  </PressFeedback>;
}

/** One option of a list where exactly one is chosen (Idioma, Región): the
 * NavigationRow shape (title over a footnote subtitle, each up to two lines,
 * 60 pt minimum) with a checkmark on the chosen option instead of a chevron,
 * because pressing it chooses rather than navigates. VoiceOver reads the
 * title and subtitle as one label and "selected" on the chosen one. */
export function CheckRow({ title, subtitle, selected, onPress, last = false, disabled = false }: {
  title: string; subtitle?: string; selected: boolean; onPress: () => void; last?: boolean; disabled?: boolean;
}) {
  const p = usePalette();
  return <PressFeedback feedback="highlight" accessibilityRole="button" accessibilityLabel={subtitle ? title + ', ' + subtitle : title}
    disabled={disabled} accessibilityState={{ disabled, selected }} onPress={onPress}
    style={[styles.navigationRow, { borderBottomColor: p.line, borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth, opacity: disabled ? 0.6 : 1 }]}>
    <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
      <AppText numberOfLines={2} style={{ fontWeight: '600' }}>{title}</AppText>
      {!!subtitle && <AppText secondary variant="footnote" numberOfLines={2}>{subtitle}</AppText>}
    </View>
    <View style={styles.navigationGlyph}>{selected && <Ionicons name="checkmark" size={22} color={p.primary} accessible={false} />}</View>
  </PressFeedback>;
}

/** A row that holds a chosen value and, when pressed, opens its chooser: a
 * glyph or identity tile, the field label as a caption, the value as the
 * primary line and an optional detail line (a currency code and symbol, an
 * account's kind), then a chevron. Everything is stacked vertically, so a
 * long value ("Dólares estadounidenses", a long account name) wraps under
 * the label and its code keeps its own line instead of being pushed to a
 * lone right-aligned fragment. Without `onPress` it is a read-only fact in
 * the same shape (the currency of an existing account). */
export function SelectionRow({ label, value, detail, icon, leading, onPress, last = false, disabled = false, placeholder = false }: {
  label: string; value: string; detail?: string; icon?: IconName; leading?: ReactNode; onPress?: () => void; last?: boolean; disabled?: boolean;
  /** The value is a prompt ("Elegir cuenta"), drawn in the primary colour. */
  placeholder?: boolean;
}) {
  const p = usePalette();
  const content = <>
    {leading ?? (icon && <View style={styles.navigationGlyph}><Ionicons name={icon} size={22} color={p.secondary} accessible={false} /></View>)}
    <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
      <AppText secondary variant="footnote" style={{ fontWeight: '500' }}>{label}</AppText>
      <AppText numberOfLines={3} style={{ fontWeight: '600', color: placeholder ? p.primary : p.text }}>{value}</AppText>
      {!!detail && <AppText secondary variant="footnote" numberOfLines={2}>{detail}</AppText>}
    </View>
    {onPress && <Ionicons name="chevron-forward" size={16} color={p.tertiary} accessible={false} />}
  </>;
  const style: StyleProp<ViewStyle> = [styles.selectionRow, { borderBottomColor: p.line, borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth, opacity: disabled ? 0.6 : 1 }];
  const accessibilityLabel = label + ': ' + value + (detail ? ', ' + detail : '');
  return onPress ? <PressFeedback feedback="highlight" accessibilityRole="button" accessibilityLabel={accessibilityLabel}
    disabled={disabled} accessibilityState={{ disabled }} onPress={onPress} style={style}>{content}</PressFeedback>
    : <View accessible accessibilityLabel={accessibilityLabel} style={style}>{content}</View>;
}

/** Compact statistic: eyebrow label over a value. It may shrink and wrap, so
 * two or three in a row never push past the card's edge. */
export function Stat({ label, children, align = 'left' }: { label: string; children: ReactNode; align?: 'left' | 'right' }) {
  return <View style={{ gap: 3, alignItems: align === 'right' ? 'flex-end' : 'flex-start', minWidth: 0, flexShrink: 1 }}>
    <AppText secondary variant="caption" style={{ fontWeight: '500' }}>{label}</AppText>
    {children}
  </View>;
}

/** Two or three statistics side by side at normal text sizes, one under the
 * other at large sizes: an amount and a date each keep their whole text. Every
 * child gets an equal share of the row and may shrink; an absent child leaves
 * no empty column. */
export function StatRow({ children }: { children: ReactNode }) {
  const stacked = useStacked();
  return <View style={{ flexDirection: stacked ? 'column' : 'row', gap: stacked ? space.m : space.l }}>
    {Children.map(children, child => child ? <View style={{ flex: stacked ? undefined : 1, minWidth: 0 }}>{child}</View> : null)}
  </View>;
}

/** The category as one designed object: its glyph on its own colour, resolved
 * from the stored string through the identity (definition, preset or
 * historical fallback). Income and warning tones override the colour because
 * that meaning matters more. */
export function CategoryBadge({ category, kind = 'expense', large = false, tone = 'neutral', size }: {
  category: string; kind?: EntryKind; large?: boolean; tone?: Tone; size?: number;
}) {
  const look = useCategoryLook(category, kind);
  return <GlyphTile icon={look.glyph} large={large} size={size} tone={tone} color={tone === 'neutral' ? look.hex : undefined} />;
}

/** A liquid account as one designed object: its chosen glyph on its chosen
 * colour, the same wherever the account appears. Cards and debts keep their
 * own glyphs and tones. */
export function AccountBadge({ accountId, large = false, size }: { accountId: string; large?: boolean; size?: number }) {
  const look = useAccountLook(accountId);
  return <GlyphTile icon={look.glyph} large={large} size={size} color={look.hex} />;
}

/** One transaction line: merchant, then category · account · date; amount on the right. */
export function EntryRow({ entry, account, last = false, showDate = true, showAccount = true }: {
  entry: Entry; account: Account; last?: boolean; showDate?: boolean; showAccount?: boolean;
}) {
  const p = usePalette();
  const day = useCurrentDay();
  const { t, relativeDate } = useI18n();
  const dateLabel = relativeDate(entry.dateISO, day);
  const income = entry.kind === 'income';
  const stacked = useStacked({ minor: entry.amountMinor, currency: account.currency, signed: true });
  const category = useCategoryLook(entry.category, entry.kind).label;
  const detail = [category, showAccount ? account.name : null, showDate ? dateLabel : null].filter(Boolean).join(' · ');
  return <PressFeedback feedback="highlight" accessibilityRole="button"
    accessibilityLabel={[entry.merchant, t(income ? 'movement.incomeWord' : 'movement.expenseWord'), formatMinorUnits(entry.amountMinor) + ' ' + account.currency, category, account.name, dateLabel].join(', ')}
    onPress={() => router.push({ pathname: '/entry/[id]', params: { id: entry.id } })}
    style={[styles.row, { borderBottomColor: p.line, borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth }]}>
    <CategoryBadge category={entry.category} kind={entry.kind} tone={income ? 'income' : 'neutral'} />
    <View style={{ flex: 1, minWidth: 0, gap: 8, flexDirection: stacked ? 'column' : 'row', alignItems: stacked ? 'flex-start' : 'center' }}>
      <View style={{ flex: stacked ? undefined : 1, minWidth: 0, gap: 3 }}>
        <AppText numberOfLines={stacked ? undefined : 2} style={{ fontWeight: '500' }}>{entry.merchant}</AppText>
        <AppText secondary variant="footnote" numberOfLines={stacked ? undefined : 2}>{detail}</AppText>
      </View>
      <View style={{ maxWidth: stacked ? '100%' : AMOUNT_COLUMN, alignItems: 'flex-end' }}>
        <Money minor={income ? entry.amountMinor : -entry.amountMinor} currency={account.currency} signed tone={income ? 'income' : 'expense'} />
      </View>
    </View>
  </PressFeedback>;
}

export function AccountRow({ account, entries, transfers, last = false, kindLabel }: {
  account: Account; entries: Entry[]; transfers?: Transfer[]; last?: boolean; kindLabel?: string;
}) {
  const p = usePalette();
  const { t } = useI18n();
  const balance = accountBalanceMinor(account, entries, transfers);
  const stacked = useStacked({ minor: balance, currency: account.currency });
  return <PressFeedback feedback="highlight" accessibilityRole="button" accessibilityLabel={t('rows.accountLabel', { name: account.name, amount: formatMinorUnits(balance) + ' ' + account.currency })}
    onPress={() => router.push({ pathname: '/account/[id]', params: { id: account.id } })}
    style={[styles.row, { borderBottomColor: p.line, borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth }]}>
    <AccountBadge accountId={account.id} />
    <View style={{ flex: 1, minWidth: 0, gap: 8, flexDirection: stacked ? 'column' : 'row', alignItems: stacked ? 'flex-start' : 'center' }}>
      <View style={{ flex: stacked ? undefined : 1, minWidth: 0, gap: 3 }}>
        <AppText numberOfLines={stacked ? undefined : 2} style={{ fontWeight: '500' }}>{account.name}</AppText>
        <AppText secondary variant="footnote">{kindLabel ?? t('accountKinds.account')} · {account.currency}</AppText>
      </View>
      <View style={{ maxWidth: stacked ? '100%' : AMOUNT_COLUMN, alignItems: 'flex-end' }}>
        <Money minor={balance} currency={account.currency} color={balance < 0 ? p.expense : undefined} />
      </View>
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
  const day = useCurrentDay();
  const { t: tr, relativeDate } = useI18n();
  const from = accounts.find(a => a.id === t.fromAccountId)!, to = accounts.find(a => a.id === t.toAccountId)!;
  const date = relativeDate(t.dateISO, day);
  const outgoing = accountId === from.id;
  const incoming = accountId === to.id;
  const title = context === 'card' ? tr(incoming ? 'rows.cardPayment' : 'rows.transfer') : context === 'debt' ? tr(incoming ? 'rows.payment' : 'rows.collection') : t.note || tr('rows.transfer');
  const detail = context ? [t.note && t.note !== title ? t.note : null, incoming ? tr('rows.fromAccount', { name: from.name }) : tr('rows.toAccount', { name: to.name }), showDate ? date : null].filter(Boolean).join(' · ')
    : `${from.name} → ${to.name}${showDate ? ' · ' + date : ''}`;
  const signed = !!accountId && !context;
  const stacked = useStacked({ minor: signed && outgoing ? -t.amountMinor : t.amountMinor, currency: from.currency, signed });
  return <PressFeedback feedback="highlight" accessibilityRole="button"
    accessibilityLabel={tr('rows.transferLabel', { title, from: from.name, to: to.name, amount: formatMinorUnits(t.amountMinor) + ' ' + from.currency, date }) + (t.note ? ', ' + t.note : '')}
    onPress={() => router.push({ pathname: '/transfer/[id]', params: { id: t.id } })}
    style={[styles.row, { borderBottomColor: p.line, borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth }]}>
    <GlyphTile icon={context === 'card' ? 'card-outline' : context === 'debt' ? 'people-outline' : 'swap-horizontal-outline'} tone="transfer" />
    <View style={{ flex: 1, minWidth: 0, gap: 8, flexDirection: stacked ? 'column' : 'row', alignItems: stacked ? 'flex-start' : 'center' }}>
      <View style={{ flex: stacked ? undefined : 1, minWidth: 0, gap: 3 }}>
        <AppText numberOfLines={stacked ? undefined : 2} style={{ fontWeight: '500' }}>{title}</AppText>
        <AppText secondary variant="footnote" numberOfLines={stacked ? undefined : 2}>{detail}</AppText>
      </View>
      <View style={{ maxWidth: stacked ? '100%' : AMOUNT_COLUMN, alignItems: 'flex-end' }}>
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
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: AMOUNT_GAP, width: '100%' },
  amountInput: { flex: 1, minWidth: 0, minHeight: 60, fontWeight: '700', letterSpacing: 0, fontVariant: ['tabular-nums'], paddingVertical: 6, paddingLeft: 0, textAlign: 'left' },
  choices: { flexDirection: 'row', borderRadius: 10, padding: SEGMENT_PADDING, gap: SEGMENT_GAP },
  thumb: { position: 'absolute', top: SEGMENT_PADDING, bottom: SEGMENT_PADDING, left: 0, borderRadius: 8 },
  choice: { flex: 1, minWidth: 72, minHeight: 32, paddingHorizontal: 8, paddingVertical: 6, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 16, minHeight: 64 },
  detailRow: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  navigationRow: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 11 },
  navigationGlyph: { width: 30, alignItems: 'center' },
  selectionRow: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 10 },
});
