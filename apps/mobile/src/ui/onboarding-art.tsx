import { useEffect, useRef, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedProps, useAnimatedStyle, useSharedValue, withDelay, withSequence, withTiming, type SharedValue } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import Ionicons from '@expo/vector-icons/Ionicons';
import { addDaysISO, minorUnitExponent, type Currency } from '@finanzapp/domain';
import { AppText, GlyphTile, Money, Surface, type IconName } from './components';
import { shortMonth } from './charts';
import { fitFontSize } from './geometry';
import { amountFromMinor, displayAmount } from './money-input';
import { duration, easeOut, sheetTiming } from './motion';
import { artScale, countUp, sampleFigures, storyCalendar, typingFrames } from './onboarding-flow';
import { lightPalette } from './palette';
import { radius, useCurrentDay, usePalette, useReduceMotion } from './theme';
import { useI18n } from '../i18n/provider';

/** 25O1: the first opening's illustrations. Each is a small scene of the app itself, drawn with its own components from
 * fixed sample figures in the suggested currency and the person's formats (`sampleFigures`; drawn, never stored), at a
 * fixed size and scaled down (never up) to the room its page leaves; below `ART_MIN_HEIGHT` it is not drawn at all. Its
 * words are part of the picture: they do not grow with Dynamic Type, and VoiceOver skips the whole scene (the headline
 * under it says what it shows).
 *
 * Motion (motion.tsx's curves, no springs, nothing loops): a scene plays once, the first time its page is the current
 * one (`play`); `still` (a page seen before this mount) and Reduce Motion draw the final state at once. The account card of
 * the close plays when it appears; under Reduce Motion it only fades and its check is drawn. */
type ArtProps = { play: boolean; still: boolean; currency: Currency };
type Size = { width: number; height: number };

/** Every scene is drawn for the widest phone column (393 pt less the page's 24 pt sides). */
const ART_WIDTH = 345;
const RECORD: Size = { width: ART_WIDTH, height: 320 };
const COMMITMENTS: Size = { width: ART_WIDTH, height: 228 };
const AVAILABLE: Size = { width: ART_WIDTH, height: 150 };
const ART_SIDE = 24;
/** A scene starts a moment after its page arrives, so a page the button slides in is in place before it moves. */
const ART_START = 240;
/** The recording scene: one keystroke per 90 ms, then the caret blinks twice (250 ms off, 250 ms on) and stays. */
const KEYSTROKE = 90, BLINK = 250;
/** The commitments scene: the paid dots and the current month's ring one after another. */
const DOT_STAGGER = 60;
/** What-is-left: the figure counts up while the spent share of the bar grows. */
const COUNT = 520, FILL = 400, SPENT_SHARE = 0.22;
/** The close's check draws itself after the card has started to rise. */
const CHECK = 360, CHECK_DELAY = 160;
/** The check's path and its length (two strokes, 9.2 + 18.8 pt), dashed by that length to be drawn from its start. */
const CHECK_PATH = 'M8 18 L14.5 24.5 L27 10.5', CHECK_LENGTH = 28.5;

/** The room a page leaves its scene, and the scene at its scale (none below the minimum height). */
function ArtBox({ size, children }: { size: Size; children: ReactNode }) {
  const [room, setRoom] = useState<Size | null>(null);
  const scale = room ? artScale(room, size) : 0;
  return <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
    style={{ flex: 1, paddingHorizontal: ART_SIDE, alignItems: 'center', justifyContent: 'center' }}
    onLayout={event => { const { width, height } = event.nativeEvent.layout; setRoom({ width: width - 2 * ART_SIDE, height }); }}>
    {scale > 0 && <View style={{ width: size.width * scale, height: size.height * scale, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: size.width, height: size.height, justifyContent: 'center', transform: [{ scale }] }}>{children}</View>
    </View>}
  </View>;
}

/** Starts a scene once, when its page first becomes current; a scene shown still (or under Reduce Motion) is drawn final.
 * `run` returns the cleanup of what it scheduled; the cleanup lets the scene start again if it is torn down half-way. */
function usePlayOnce(play: boolean, instant: boolean, finish: () => void, run: () => () => void) {
  const started = useRef(false);
  useEffect(() => {
    if (!play) return;
    if (instant) { started.current = true; finish(); return; }
    if (started.current) return;
    started.current = true;
    const stop = run();
    return () => { stop(); started.current = false; };
  }, [play, instant]);
}

/** One movement as the lists draw it: the glyph tile, the name over its detail, the amount on the right. */
function ArtRow({ icon, title, detail, amount }: { icon: IconName; title: string; detail: string; amount: string }) {
  const p = usePalette();
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
    <GlyphTile icon={icon} color={p.primary} />
    <View style={{ flex: 1, minWidth: 0 }}>
      <AppText allowFontScaling={false} numberOfLines={1} style={{ fontWeight: '500' }}>{title}</AppText>
      <AppText allowFontScaling={false} numberOfLines={1} secondary variant="subhead">{detail}</AppText>
    </View>
    <AppText allowFontScaling={false} style={{ fontWeight: '600', fontVariant: ['tabular-nums'] }}>{amount}</AppText>
  </View>;
}

const ROW_CARD = { paddingVertical: 12, paddingHorizontal: 14 } as const;

/** 1 · «Anotá un gasto en segundos.»: an amount typed key by key into the field's own shape, then the movement it becomes,
 * in front of the two recorded before it. */
function Record({ play, still, currency }: ArtProps) {
  const p = usePalette();
  const reduced = useReduceMotion();
  const day = useCurrentDay();
  const { t, amountFormat, currencySymbol, moneyText, relativeDate } = useI18n();
  const figures = sampleFigures(currency);
  const frames = typingFrames(amountFromMinor(figures.coffee, currency));
  const instant = still || reduced;
  const [typed, setTyped] = useState(instant ? frames.length : 0);
  const caret = useSharedValue(1);
  const front = useSharedValue(instant ? 1 : 0);
  const behind = useSharedValue(instant ? 1 : 0);
  usePlayOnce(play, instant, () => { setTyped(frames.length); front.value = 1; behind.value = 1; caret.value = 1; }, () => {
    setTyped(0);
    const keys = frames.map((_, index) => setTimeout(() => setTyped(index + 1), ART_START + index * KEYSTROKE));
    const typedAt = ART_START + (frames.length - 1) * KEYSTROKE;
    const off = () => withTiming(0, { duration: 0 }), on = () => withTiming(1, { duration: 0 });
    caret.value = withDelay(typedAt + BLINK, withSequence(off(), withDelay(BLINK, on()), withDelay(BLINK, off()), withDelay(BLINK, on())));
    front.value = withDelay(typedAt + 120, withTiming(1, { duration: duration.data, easing: easeOut }));
    behind.value = withDelay(typedAt + 240, withTiming(1, { duration: duration.data, easing: easeOut }));
    return () => keys.forEach(clearTimeout);
  });
  const caretStyle = useAnimatedStyle(() => ({ opacity: caret.value }));
  const frontStyle = useAnimatedStyle(() => ({ opacity: front.value, transform: [{ translateY: (1 - front.value) * 12 }] }));
  const nearStyle = useAnimatedStyle(() => ({ opacity: 0.55 * behind.value }));
  const farStyle = useAnimatedStyle(() => ({ opacity: 0.28 * behind.value }));
  const yesterday = relativeDate(addDaysISO(day, -1), day);
  return <View style={{ gap: 12 }}>
    <View style={{ paddingHorizontal: 6, marginBottom: 6 }}>
      <AppText allowFontScaling={false} variant="eyebrow" secondary>{t('movement.expense')}</AppText>
      <View style={{ flexDirection: 'row', alignItems: 'center', height: 64 }}>
        <AppText allowFontScaling={false} style={{ fontSize: 56, lineHeight: 64, fontWeight: '700', letterSpacing: -1.3, fontVariant: ['tabular-nums'] }}>
          <AppText allowFontScaling={false} style={{ fontSize: 34, lineHeight: 64, fontWeight: '600', color: p.secondary }}>{currencySymbol(currency) + ' '}</AppText>
          {typed > 0 ? displayAmount(frames[typed - 1], amountFormat, currency) : ''}
        </AppText>
        <Animated.View style={[{ width: 2, height: 40, borderRadius: 1, marginLeft: 3, backgroundColor: p.primary }, caretStyle]} />
      </View>
    </View>
    <Animated.View style={frontStyle}>
      <Surface style={ROW_CARD}><ArtRow icon="cafe-outline" title={t('onboarding.art.coffee')} detail={relativeDate(day, day) + ' · ' + t('onboarding.presets.cash.name')}
        amount={moneyText(figures.coffee, currency)} /></Surface>
    </Animated.View>
    <Animated.View style={[{ marginHorizontal: 10 }, nearStyle]}>
      <Surface style={ROW_CARD}><ArtRow icon="cart-outline" title={t('onboarding.art.groceries')} detail={yesterday} amount={moneyText(figures.groceries, currency)} /></Surface>
    </Animated.View>
    <Animated.View style={[{ marginHorizontal: 20 }, farStyle]}>
      <Surface style={ROW_CARD}><ArtRow icon="bus-outline" title={t('onboarding.art.transport')} detail={yesterday} amount={moneyText(figures.transport, currency)} /></Surface>
    </Animated.View>
  </View>;
}

/** A calendar mark appearing: from 60 % and transparent to whole. */
function Pop({ value, children }: { value: SharedValue<number>; children: ReactNode }) {
  const style = useAnimatedStyle(() => ({ opacity: value.value, transform: [{ scale: 0.6 + 0.4 * value.value }] }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

/** 2 · «Tarjetas y cuotas, mes a mes.»: a purchase in six instalments as a calendar, the brand's commitments motif: the
 * paid months filled, this month's ring, the two to come as quiet rings, and when this month's instalment falls due
 * (`storyCalendar`: never a day already past). */
function Commitments({ play, still, currency }: ArtProps) {
  const p = usePalette();
  const reduced = useReduceMotion();
  const day = useCurrentDay();
  const { t, formatCount, formatDate, moneyText } = useI18n();
  const { months, current, due } = storyCalendar(day);
  const instant = still || reduced;
  const initial = instant ? 1 : 0;
  // The three paid months and this month's ring, in that order, then the pill.
  const marks = [useSharedValue(initial), useSharedValue(initial), useSharedValue(initial), useSharedValue(initial)];
  const pill = useSharedValue(initial);
  usePlayOnce(play, instant, () => { marks.forEach(mark => { mark.value = 1; }); pill.value = 1; }, () => {
    marks.forEach((mark, index) => { mark.value = withDelay(ART_START + index * DOT_STAGGER, withTiming(1, { duration: duration.enter, easing: easeOut })); });
    pill.value = withDelay(ART_START + marks.length * DOT_STAGGER + 120, withTiming(1, { duration: duration.data, easing: easeOut }));
    return () => {};
  });
  const pillStyle = useAnimatedStyle(() => ({ opacity: pill.value, transform: [{ translateY: (1 - pill.value) * 6 }] }));
  return <Surface style={{ paddingTop: 20, paddingHorizontal: 18, paddingBottom: 18, gap: 0 }}>
    <AppText allowFontScaling={false} variant="eyebrow" secondary>{t('onboarding.art.plan', { total: formatCount(months.length) })}</AppText>
    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 4 }}>
      <AppText allowFontScaling={false} style={{ fontSize: 28, lineHeight: 34, fontWeight: '700', letterSpacing: -0.6, fontVariant: ['tabular-nums'] }}>
        {moneyText(sampleFigures(currency).instalment, currency)}</AppText>
      <AppText allowFontScaling={false} variant="subhead" secondary style={{ fontWeight: '500' }}>{t('onboarding.art.perMonth')}</AppText>
    </View>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 22 }}>
      {months.map((month, index) => <View key={month} style={{ width: 44, alignItems: 'center', gap: 8 }}>
        <View style={{ width: 28, height: 28, alignItems: 'center', justifyContent: 'center' }}>
          {index < current ? <Pop value={marks[index]}><View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: p.primary }} /></Pop>
            : index === current ? <Pop value={marks[current]}>
              <View style={{ width: 28, height: 28, borderRadius: 14, borderWidth: 2.5, borderColor: p.primary, alignItems: 'center', justifyContent: 'center' }}>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: p.primary }} />
              </View>
            </Pop>
            : <View style={{ width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: p.line }} />}
        </View>
        <AppText allowFontScaling={false} variant="footnote" secondary={index !== current}
          style={index === current ? { color: p.primary, fontWeight: '600' } : undefined}>{shortMonth(month, formatDate)}</AppText>
      </View>)}
    </View>
    <Animated.View style={[{ marginTop: 20, flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 10, paddingHorizontal: 12,
      borderRadius: 12, backgroundColor: p.primarySoft }, pillStyle]}>
      <AppText allowFontScaling={false} variant="subhead" style={{ color: p.primary, fontWeight: '600' }}>
        {t('onboarding.art.instalment', { current: formatCount(current + 1), total: formatCount(months.length) })}</AppText>
      <AppText allowFontScaling={false} variant="subhead" secondary numberOfLines={1} style={{ flexShrink: 1 }}>{t('onboarding.art.due', { date: formatDate(due, 'day') })}</AppText>
    </Animated.View>
  </Surface>;
}

/** 3 · «Sabé cuánto te queda.»: Disponible as Inicio draws it, counting up to the figure while this month's spending fills
 * its share of the bar under it. */
function Available({ play, still, currency }: ArtProps) {
  const p = usePalette();
  const reduced = useReduceMotion();
  const day = useCurrentDay();
  const { t, formatDate, moneyText } = useI18n();
  const figures = sampleFigures(currency);
  const instant = still || reduced;
  const [shown, setShown] = useState(instant ? figures.available : 0);
  const fill = useSharedValue(instant ? SPENT_SHARE : 0);
  usePlayOnce(play, instant, () => { setShown(figures.available); fill.value = SPENT_SHARE; }, () => {
    fill.value = withDelay(ART_START, withTiming(SPENT_SHARE, { duration: FILL, easing: easeOut }));
    // JS frames, on the app's ease-out curve, ending exactly on the figure.
    const curve = easeOut.factory();
    const exponent = minorUnitExponent(currency);
    const begin = Date.now() + ART_START;
    let frame = 0;
    const tick = () => {
      const progress = Math.max(0, Date.now() - begin) / COUNT;
      setShown(countUp(figures.available, progress >= 1 ? 1 : curve(progress), exponent));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  });
  const fillStyle = useAnimatedStyle(() => ({ width: `${fill.value * 100}%` }));
  // Sized once, for the figure it ends on: a hero fits its own text, and a figure growing digit by digit would shrink midway.
  const heroSize = fitFontSize(moneyText(figures.available, currency), AVAILABLE.width - 12, 56, 28);
  return <View style={{ paddingHorizontal: 6 }}>
    <AppText allowFontScaling={false} variant="eyebrow" secondary>{t('home.available')}</AppText>
    <Money minor={shown} currency={currency} size={heroSize} large />
    <View style={{ height: 10, borderRadius: 5, marginTop: 28, overflow: 'hidden', backgroundColor: p.inset }}>
      <Animated.View style={[{ height: 10, borderRadius: 5, backgroundColor: p.primary }, fillStyle]} />
    </View>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginTop: 10 }}>
      <AppText allowFontScaling={false} variant="subhead" secondary numberOfLines={1} style={{ flexShrink: 1 }}>
        {t('onboarding.art.spentIn', { month: formatDate(day, 'month') })}</AppText>
      <AppText allowFontScaling={false} variant="subhead" style={{ fontWeight: '600', fontVariant: ['tabular-nums'] }}>{moneyText(figures.spent, currency)}</AppText>
    </View>
  </View>;
}

// 25O1 review: a scene's state belongs to one currency (keyed by it): when the iPhone's Region changes under the story, the
// scene starts again from the new currency's figures, never a stale keystroke count or figure. The box keeps its room.
export function RecordArt(props: ArtProps) { return <ArtBox size={RECORD}><Record key={props.currency} {...props} /></ArtBox>; }
export function CommitmentsArt(props: ArtProps) { return <ArtBox size={COMMITMENTS}><Commitments {...props} /></ArtBox>; }
export function AvailableArt(props: ArtProps) { return <ArtBox size={AVAILABLE}><Available key={props.currency} {...props} /></ArtBox>; }

const AnimatedPath = Animated.createAnimatedComponent(Path);

/** The close: the account just created as a sand-white card on the sapphire field (the card stays light in both themes, as
 * Inicio's chosen segment does, so its ink comes from the light palette), under a check that draws itself. One VoiceOver
 * element: «Efectivo, saldo 50000 pesos». */
export function AccountCard({ name, glyph, minor, currency }: { name: string; glyph: IconName; minor: number; currency: Currency }) {
  const p = usePalette();
  const reduced = useReduceMotion();
  const { t, spokenMoney, speechLanguage } = useI18n();
  const rise = useSharedValue(0);
  const check = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    rise.value = withTiming(1, sheetTiming('sheet', reduced));
    check.value = reduced ? 1 : withDelay(CHECK_DELAY, withTiming(1, { duration: CHECK, easing: easeOut }));
  }, []);
  const cardStyle = useAnimatedStyle(() => ({ opacity: rise.value, transform: [{ translateY: reduced ? 0 : (1 - rise.value) * 16 }] }));
  const checkProps = useAnimatedProps(() => ({ strokeDashoffset: CHECK_LENGTH * (1 - check.value) }));
  return <Animated.View accessible accessibilityLabel={t('onboarding.done.card', { name, amount: spokenMoney(minor, currency) })} accessibilityLanguage={speechLanguage}
    style={[{ alignSelf: 'stretch' }, cardStyle]}>
    <View style={{ borderRadius: radius.sheet, paddingTop: 46, paddingBottom: 22, paddingHorizontal: 20, alignItems: 'center', gap: 4, backgroundColor: p.heroThumb }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, maxWidth: '100%' }}>
        <Ionicons name={glyph} size={17} color={lightPalette.primary} />
        <AppText variant="subhead" style={{ color: lightPalette.secondary, textAlign: 'center', flexShrink: 1 }}>{name}</AppText>
      </View>
      <Money minor={minor} currency={currency} size={44} large align="center" color={p.heroThumbInk} />
    </View>
    <View style={{ position: 'absolute', top: -42, left: '50%', marginLeft: -42, width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center',
      backgroundColor: p.hero }}>
      <View style={{ width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center', backgroundColor: p.heroThumb }}>
        <Svg width={34} height={34} viewBox="0 0 34 34">
          <AnimatedPath d={CHECK_PATH} fill="none" stroke={p.hero} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round"
            strokeDasharray={[CHECK_LENGTH, CHECK_LENGTH]} animatedProps={checkProps} />
        </Svg>
      </View>
    </View>
  </Animated.View>;
}
