import { useEffect, useMemo, useRef } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { useAnimatedProps, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';
import { AppText, Money, PressFeedback } from './components';
import { useI18n } from '../i18n/provider';
import { categoryColor, othersColor } from './category-color';
import { ROW_STACK_SCALE, amountWidthEm, labelWidthEm } from './geometry';
import { ValueTransition, duration, timing } from './motion';
import { usePalette, useReduceMotion, type Palette } from './theme';
import type { Currency } from '@finanzapp/domain';

/** The grouped tail's key. It starts with a space, which no category key can (`categoryKey` trims), so the synthetic
 * «Otras» slice can never share its identity with a real category, whatever the person names one (Codex, PR #73). */
export const OTHERS_KEY = ' others';

export type DonutSlice = { key: string; label: string; value: number };

/** Groups the tail of a ranked list into one slice named `othersLabel`
 * ("Otras") so the donut keeps at most five readable slices. Each named slice
 * takes its category hue; the tail is neutral because it is not one category.
 * 24T3 (A24): only categories above zero are slices. A category that nets to zero or less (devoluciones of earlier
 * purchases) is listed under the donut, never drawn and never folded into «Otras», whose value would otherwise shrink. */
export function donutSlices(items: DonutSlice[], p: Palette, hues: Map<string, number> | ((key: string) => string), othersLabel: string, max = 5): (DonutSlice & { color: string; count?: number })[] {
  const colorOf = typeof hues === 'function' ? hues : (key: string) => categoryColor(key, hues, p);
  const drawn = items.filter(item => item.value > 0);
  const head = drawn.slice(0, drawn.length > max ? max - 1 : max).map(item => ({ ...item, color: colorOf(item.key) }));
  const tail = drawn.slice(head.length);
  if (!tail.length) return head;
  return [...head, { key: OTHERS_KEY, label: othersLabel, value: tail.reduce((sum, item) => sum + item.value, 0), color: othersColor(p), count: tail.length }];
}

function arcPath(cx: number, cy: number, radius: number, startAngle: number, endAngle: number): string {
  'worklet';
  if (endAngle <= startAngle) return '';
  // A single full slice needs two arcs; SVG cannot draw a 360° arc in one command.
  if (endAngle - startAngle >= Math.PI * 2 - 1e-6) {
    const half = startAngle + Math.PI;
    return arcPath(cx, cy, radius, startAngle, half) + ' ' + arcPath(cx, cy, radius, half, startAngle + Math.PI * 2 - 1e-4);
  }
  const start = { x: cx + radius * Math.cos(startAngle), y: cy + radius * Math.sin(startAngle) };
  const end = { x: cx + radius * Math.cos(endAngle), y: cy + radius * Math.sin(endAngle) };
  const large = endAngle - startAngle > Math.PI ? 1 : 0;
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${large} 1 ${end.x} ${end.y}`;
}

const AnimatedPath = Animated.createAnimatedComponent(Path);

/** One slice drawn up to the sweep clock: as `progress` goes 0 → 1 the clock
 * hand travels once around from twelve, and each slice appears in turn. The
 * static `d` is the finished arc, so the chart is complete even if the
 * animated prop never applies. A chosen slice is drawn a little thicker; the
 * others step back to 30 % while one is chosen (24UX6C2). */
function Slice({ cx, radius, start, end, color, thickness, progress, opacity }: {
  cx: number; radius: number; start: number; end: number; color: string; thickness: number; progress: SharedValue<number>; opacity: number;
}) {
  const animatedProps = useAnimatedProps(() => {
    const hand = -Math.PI / 2 + progress.value * Math.PI * 2;
    return { d: arcPath(cx, cx, radius, start, Math.min(end, hand)) };
  });
  return <AnimatedPath d={arcPath(cx, cx, radius, start, end)} animatedProps={animatedProps} stroke={color} strokeWidth={thickness} strokeOpacity={opacity}
    fill="none" strokeLinecap="butt" />;
}

export type DonutArc = { key: string; start: number; end: number; color: string; radius: number };

/** The extra stroke of a chosen slice, and the room the ring leaves for it inside the chart's square. */
export const CHOSEN_EXTRA = 6;

/** The arcs of a donut: each slice's share of the sum, clockwise from twelve, a 2 px gap between slices. 24T3 (A24): the
 * sum is of the positive slices only, the ones drawn, so the arcs never pass a full turn whatever a caller hands in (a
 * negative value in the sum would shrink it and stretch every other arc past 360°). */
export function donutArcs(slices: readonly { key: string; value: number; color: string }[], size: number, thickness: number): DonutArc[] {
  const drawn = slices.filter(slice => Number.isFinite(slice.value) && slice.value > 0);
  const sum = drawn.reduce((acc, slice) => acc + slice.value, 0);
  if (sum <= 0) return [];
  const radius = (size - thickness - CHOSEN_EXTRA) / 2;
  const gap = drawn.length > 1 ? 2 / radius : 0; // 2 px expressed as an angle.
  let angle = -Math.PI / 2;
  return drawn.map(slice => {
    const sweep = (slice.value / sum) * Math.PI * 2;
    const start = angle + gap / 2, end = angle + sweep - gap / 2;
    angle += sweep;
    return { key: slice.key, start, end, color: slice.color, radius };
  });
}

/** Which slice a touch at (x, y), in the chart's own points, falls on: on the ring (with a few points of slack either
 * side) the slice whose angle holds it, a gap counting as its neighbour; in the hole or outside, none. Pure geometry. */
export function sliceAt(arcs: readonly DonutArc[], x: number, y: number, size: number, thickness: number): string | null {
  if (!arcs.length) return null;
  const c = size / 2, dx = x - c, dy = y - c;
  const distance = Math.hypot(dx, dy);
  const radius = arcs[0].radius, slack = 10;
  if (distance < radius - thickness / 2 - slack || distance > radius + thickness / 2 + slack) return null;
  // Angles measured like the arcs: from twelve o'clock, clockwise, in [-π/2, 3π/2).
  let angle = Math.atan2(dy, dx);
  if (angle < -Math.PI / 2) angle += Math.PI * 2;
  const hit = arcs.find(arc => angle >= arc.start && angle <= arc.end);
  if (hit) return hit.key;
  // In a 2 px gap: the slice that starts right after it (or the first, past the last one's end).
  return (arcs.find(arc => arc.start > angle) ?? arcs[0]).key;
}

/** Reportes' screen padding, both sides (`space.xl` each): the width the donut's row actually has is the window's less this. */
export const DONUT_GUTTER = 40;
/** The ring's stroke. It keeps its 22 pt while the square grows, so the ring is relatively thinner (8.9 % of a 247 pt
 * square, 12.5 % of the old 176 pt one) and the hole, where the total now lives, is bigger. */
export const DONUT_RING = 22;
/** 24UX6D: the donut is the focal point of Categorías, so it takes 70 % of the content width, never under 200 pt nor over
 * 260 pt (nor wider than the content): 247 pt at 393 pt (content 353), 234 pt at 375 pt (content 335), 200 pt at 320 pt,
 * 260 pt from 412 pt up. Pure, for the tests. */
export function donutGeometry(windowWidth: number): { size: number; thickness: number } {
  const content = Number.isFinite(windowWidth) && windowWidth > DONUT_GUTTER ? windowWidth - DONUT_GUTTER : 0;
  const size = content > 0 ? Math.min(content, Math.max(200, Math.min(260, Math.round(content * 0.7)))) : 200;
  return { size, thickness: DONUT_RING };
}

/** The width the centre's text may take on one line: the square less the ring and a 10 pt margin on each side (183 pt in
 * the 247 pt donut, 170 pt in the 234 pt one; the old 176 pt donut had 112 pt). */
export function donutRoom(size: number, thickness: number): number {
  return size - 2 * (thickness + 10);
}

/** The centre amount's sizes, largest first: it steps down 2 pt at a time until the exact amount fits the hole, and
 * never below 18 pt. An amount that does not fit at 18 pt moves under the donut instead (never shrunk further, never
 * truncated, never approximated). */
export const CENTRE_AMOUNT_STEPS = [26, 24, 22, 20, 18] as const;
/** Money's own cap on Dynamic Type for an amount that is not a hero (`ROW_MAX_SCALE` in components.tsx). */
export const MONEY_MAX_SCALE = 1.8;

/** The largest step of `CENTRE_AMOUNT_STEPS` at which `amountText` fits `room` at this text scale, or null when not even
 * the smallest does. */
export function centreAmountSize(amountText: string, room: number, fontScale: number): number | null {
  const scale = Math.max(Number.isFinite(fontScale) ? fontScale : 1, 0.5);
  return CENTRE_AMOUNT_STEPS.find(step => amountWidthEm(amountText) * step * scale <= room) ?? null;
}

/** Category donut (24UX6C2, recomposed in 24UX6D). It is the head of Categorías: the period's total lives in its centre
 * (the «Gastado» KPI above it is gone), so with nothing chosen the centre says «Total del período» quietly over the exact
 * total, the report's own figure (`total`, minor units). A tapped slice is chosen (drawn thicker, the others at 30 %) and
 * the centre shows its name, its exact amount and its share instead. Tapping the chosen slice again, the hole, or the
 * neutral space around the ring (the chart's own full-width row) clears it; the screen clears it too on a month, currency,
 * display mode or Categorías | Día a día change. VoiceOver reaches the same choice without aiming at a slice: the chart is
 * one adjustable element (swipe up or down steps through the categories, and back to none) whose value is the total with
 * none chosen and the category, amount and share with one. The colour is never the only sign of the choice: the centre
 * names it and its row is marked too.
 *
 * The amount in the centre steps from 26 pt down to 18 pt until it fits the hole (`centreAmountSize`). When it cannot, or
 * the text is larger than 1.2× (the centre's own cap), or a name does not fit two lines, the whole readout (the total, or
 * the chosen category's) moves under the donut, uncapped and whole, and the hole stays clear.
 *
 * The first chart sweeps in clockwise (480 ms); after that a month or currency change is one crossfade with the slices
 * already final, and a choice changes the opacity at once. Reduce Motion shows the finished chart at once. */
export function DonutChart({ slices, currency, total, size: sizeProp, thickness: thicknessProp, chosen = null, onChoose, shareOf, caption }: {
  slices: (DonutSlice & { color: string })[]; currency: Currency;
  /** The period's total in minor units, the report's own figure (the slices' sum when absent). */
  total?: number;
  /** The square and the ring; by default from the window's width (`donutGeometry`). */
  size?: number; thickness?: number;
  /** The chosen slice's key (null: none). */
  chosen?: string | null; onChoose?: (key: string | null) => void;
  /** A slice's share of the report's total, as the rows show it («29 %»): one formatter for both, so they always agree. */
  shareOf: (value: number) => { label: string; spoken: string };
  /** What VoiceOver calls the chart. */
  caption: string;
}) {
  const p = usePalette();
  const { t, speechLanguage, spokenMoney, moneyText } = useI18n();
  const { fontScale, width } = useWindowDimensions();
  const geometry = donutGeometry(width);
  const size = sizeProp ?? geometry.size;
  const thickness = thicknessProp ?? geometry.thickness;
  const signature = slices.map(slice => slice.key + ':' + slice.value).join('|');
  const revealed = useRef(false);
  const reveal = !revealed.current;
  useEffect(() => { revealed.current = true; }, []);
  // Where a touch on the neutral space around the ring started: only a tap (under 10 pt of travel) clears the choice.
  const touch = useRef<{ x: number; y: number } | null>(null);
  const arcs = useMemo(() => donutArcs(slices, size, thickness), [slices, size, thickness]);
  const selected = slices.find(slice => slice.key === chosen) ?? null;
  const totalMinor = total ?? slices.reduce((sum, slice) => sum + slice.value, 0);
  const label = slices.map(slice => t('reports.chart.slice', { label: slice.label, percent: shareOf(slice.value).label.replace(/\s?%$/, '') })).join(', ');
  // VoiceOver steps through the slices in order; past either end it returns to none.
  const step = (direction: 1 | -1) => {
    if (!onChoose || !slices.length) return;
    // From none, up starts at the first slice and down at the last.
    const index = selected ? slices.indexOf(selected) : direction === 1 ? -1 : slices.length;
    const next = index + direction;
    onChoose(next < 0 || next >= slices.length ? null : slices[next].key);
  };
  const value = selected ? t('reports.chart.chosen', { name: selected.label, amount: spokenMoney(selected.value, currency), percent: shareOf(selected.value).spoken })
    : t('reports.periodTotalSpoken', { amount: spokenMoney(totalMinor, currency) });
  // The readout (the total, or the chosen category) fits the hole only at ordinary text sizes, when its exact amount fits
  // the hole's width at one of the centre's steps, and when its heading fits two lines (Codex, PR #73: a custom category
  // may be 60 characters long; 0.85 leaves room for where the line breaks fall). Otherwise it moves under the donut
  // (whole, never truncated) and the hole stays clear. The readout is drawn for the eye only: VoiceOver hears it once, as
  // the adjustable element's value.
  const room = donutRoom(size, thickness);
  const shownMinor = selected ? selected.value : totalMinor;
  const amountText = moneyText(shownMinor, currency);
  const heading = selected ? selected.label : t('reports.periodTotal');
  const scale = Math.max(fontScale, 0.5);
  const fitted = fontScale <= ROW_STACK_SCALE ? centreAmountSize(amountText, room, fontScale) : null;
  const centreFits = fitted !== null && labelWidthEm(heading) * 13 * scale <= room * 2 * 0.85;
  // Under the donut the amount has the row's whole width and follows Dynamic Type (up to Money's own cap).
  const belowSize = centreAmountSize(amountText, Math.max(0, width - DONUT_GUTTER), Math.min(fontScale, MONEY_MAX_SCALE)) ?? CENTRE_AMOUNT_STEPS[CENTRE_AMOUNT_STEPS.length - 1];
  const readout = <>
    <AppText numberOfLines={centreFits ? 2 : undefined} maxFontSizeMultiplier={centreFits ? ROW_STACK_SCALE : undefined} variant="footnote" secondary={!selected}
      style={selected ? { fontWeight: '600', textAlign: 'center' } : { textAlign: 'center' }}>{heading}</AppText>
    <Money minor={shownMinor} currency={currency} size={centreFits ? fitted : belowSize} weight="700" align="center" />
    {selected && <AppText secondary maxFontSizeMultiplier={centreFits ? ROW_STACK_SCALE : undefined} variant="caption" style={{ textAlign: 'center' }}>
      {t('reports.chart.share', { percent: shareOf(selected.value).label })}</AppText>}
  </>;
  const clears = !!selected && !!onChoose;
  // 24UX6D: the chart's own full-width row is neutral space. A tap there (not on the ring, which is the Pressable below and
  // claims its own touches first) clears the choice; it is not an accessibility element and answers only while something
  // is chosen, and it lets go of the touch the moment the list starts scrolling.
  return <View style={{ alignSelf: 'stretch', alignItems: 'center', gap: 10 }}
    onStartShouldSetResponder={() => clears}
    onResponderGrant={event => { touch.current = { x: event.nativeEvent.pageX, y: event.nativeEvent.pageY }; }}
    onResponderTerminationRequest={() => true}
    onResponderTerminate={() => { touch.current = null; }}
    onResponderRelease={event => {
      const start = touch.current;
      touch.current = null;
      if (clears && start && Math.hypot(event.nativeEvent.pageX - start.x, event.nativeEvent.pageY - start.y) < 10) onChoose!(null);
    }}>
    <ValueTransition id={signature} variant="fade" style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Pressable accessible accessibilityRole="adjustable" accessibilityLabel={t('reports.chart.donutLabel', { caption, slices: label })}
        accessibilityValue={{ text: value }} accessibilityHint={t('reports.chart.pickHint')} accessibilityLanguage={speechLanguage}
        // Labelled, so iOS (which lists every declared action in its Actions rotor) never shows a raw «increment».
        accessibilityActions={[{ name: 'increment', label: t('reports.chart.next') }, { name: 'decrement', label: t('reports.chart.previous') }]}
        onAccessibilityAction={event => step(event.nativeEvent.actionName === 'increment' ? 1 : -1)}
        // A VoiceOver double-tap activates the element, it does not tap its centre: without this, UIKit's synthetic tap
        // would land in the hole and clear the choice.
        onAccessibilityTap={() => {}}
        onPress={event => {
          if (!onChoose) return;
          const key = sliceAt(arcs, event.nativeEvent.locationX, event.nativeEvent.locationY, size, thickness);
          onChoose(key === null || key === chosen ? null : key);
        }}
        style={{ width: size, height: size }}>
        <Sweep arcs={arcs} size={size} thickness={thickness} ring={p.inset} reveal={reveal} chosen={selected?.key ?? null} />
      </Pressable>
      <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
        style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', gap: 2, paddingHorizontal: thickness + 10 }]}>
        <ValueTransition id={(selected?.key ?? 'total') + (centreFits ? '' : '|below')} variant="fade" style={{ alignItems: 'center', gap: 2 }}>
          {centreFits ? readout : null}
        </ValueTransition>
      </View>
    </ValueTransition>
    {!centreFits && <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ alignItems: 'center', gap: 2, alignSelf: 'stretch' }}>
      {readout}
    </View>}
  </View>;
}

function Sweep({ arcs, size, thickness, ring, reveal, chosen }: {
  arcs: DonutArc[]; size: number; thickness: number; ring: string; reveal: boolean; chosen: string | null;
}) {
  const reduced = useReduceMotion();
  const progress = useSharedValue(reduced || !reveal ? 1 : 0);
  useEffect(() => { progress.value = reduced || !reveal ? 1 : withTiming(1, timing('reveal', false)); }, [reduced, reveal, progress]);
  const radius = arcs[0]?.radius ?? (size - thickness - CHOSEN_EXTRA) / 2;
  return <Svg width={size} height={size}>
    <Circle cx={size / 2} cy={size / 2} r={radius} stroke={ring} strokeWidth={thickness} fill="none" />
    {arcs.map(arc => arc.end > arc.start ? <Slice key={arc.key} cx={size / 2} radius={arc.radius} start={arc.start} end={arc.end} color={arc.color}
      thickness={chosen === arc.key ? thickness + CHOSEN_EXTRA : thickness} opacity={chosen && chosen !== arc.key ? 0.3 : 1} progress={progress} />
      : null)}
  </Svg>;
}

/** The locale's short month name ("sep", "Sep"): its short date of the first, without the day. For the
 * axis only: VoiceOver gets the full name, since a voice may read "mar" or "may" as a word. */
export function shortMonth(monthISO: string, formatDate: (dateISO: string, style: 'day') => string): string {
  return formatDate(monthISO.slice(0, 7) + '-01', 'day').replace(/(^1\s+|\s+1$)/, '');
}

/** The bars of the months that are not shown: the tertiary ink at 70 % in light and 60 % in dark, so each bar holds 3:1
 * against its surface (a chart's marks must read, 24UX6B; the inset grey it replaced held 1.2:1) while the shown
 * month's brand bar stays the one strong mark. */
export function idleBarColor(p: Palette): string {
  return p.tertiary + (p.isDark ? '99' : 'B3');
}

/** A month's point on the bars: its signed net (24T3: devoluciones net in their own month, so it can be ≤ 0) and, from the
 * trend, its purchase lines (`isPurchaseLine`). */
export type MonthPoint = { monthISO: string; amountMinor: number; partial: boolean; count?: number };

/** Six monthly bars on a common zero-to-max scale. The selected month is the
 * brand primary, the rest the idle ink (`idleBarColor`); a partial (current) month is outlined.
 * Tapping a bar selects that month. Bars animate between data sets, never from zero.
 * 24T3 (A24): the scale is zero to the largest positive net; a month whose net is zero or less is drawn at zero (never a
 * bar below the axis), VoiceOver says «sin gasto neto» when the month has records, and when the shown month nets below
 * zero its exact net is written under the bars. */
export function MonthBars({ points, selected, onSelect, currency, height = 120 }: {
  points: MonthPoint[]; selected: string; onSelect: (monthISO: string) => void; currency: Currency; height?: number;
}) {
  const p = usePalette();
  const reduced = useReduceMotion();
  const { t, formatDate, currencySymbol, formatWholeUnits, speechLanguage, moneyText, spokenMoney } = useI18n();
  const max = Math.max(...points.map(point => Math.max(0, point.amountMinor)), 1);
  const current = points.find(point => point.monthISO === selected);
  return <View style={{ gap: 8 }}>
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, height }}>
      {points.map(point => <Bar key={point.monthISO} point={point} fraction={Math.max(0, point.amountMinor) / max} selected={point.monthISO === selected}
        onPress={() => onSelect(point.monthISO)} currency={currency} height={height} />)}
    </View>
    <View style={{ flexDirection: 'row', gap: 6 }}>
      {points.map(point => <Animated.Text key={point.monthISO} accessibilityLanguage={speechLanguage} style={{ flex: 1, fontSize: 12, lineHeight: 16, textAlign: 'center', fontWeight: point.monthISO === selected ? '600' : '400',
        color: point.monthISO === selected ? p.primary : p.secondary, transitionProperty: 'color', transitionDuration: reduced ? 0 : duration.state }}>
        {shortMonth(point.monthISO, formatDate)}
      </Animated.Text>)}
    </View>
    {current && <AppText secondary variant="caption" style={{ textAlign: 'center' }}>
      {t('reports.chart.scale', { status: t(current.partial ? 'reports.chart.partialMonth' : 'reports.period.fullMonth'),
        max: currencySymbol(currency) + '\u00A0' + formatWholeUnits(max, currency) })}
    </AppText>}
    {/* VoiceOver hears the net in spoken numbers (its twin), never the visible «−$ 6,00». */}
    {current && current.amountMinor < 0 && Number.isSafeInteger(current.amountMinor) && <AppText secondary variant="caption" style={{ textAlign: 'center' }}
      accessibilityLabel={t('reports.chart.netBelowZero', { month: formatDate(current.monthISO.slice(0, 7) + '-01', 'month'), amount: spokenMoney(current.amountMinor, currency) })}>
      {t('reports.chart.netBelowZero', { month: capitalize(formatDate(current.monthISO.slice(0, 7) + '-01', 'month')), amount: moneyText(current.amountMinor, currency) })}
    </AppText>}
  </View>;
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** Whether a point nets to zero or less while it has records (24T3): VoiceOver says «sin gasto neto». A month with no
 * record at all is not «no net spending» (a month without records is not a month without spending), so it is not. */
export function noNetSpending(point: { amountMinor: number; count?: number }): boolean {
  return point.amountMinor < 0 || (point.amountMinor === 0 && (point.count ?? 0) > 0);
}

function Bar({ point, fraction, selected, onPress, currency, height }: {
  point: MonthPoint; fraction: number; selected: boolean; onPress: () => void; currency: Currency; height: number;
}) {
  const p = usePalette();
  const reduced = useReduceMotion();
  const { t, formatDate, spokenMoney } = useI18n();
  const value = useSharedValue(fraction);
  useEffect(() => { value.value = withTiming(fraction, timing('data', reduced)); }, [fraction, reduced, value]);
  const style = useAnimatedStyle(() => ({ height: Math.max(point.amountMinor > 0 ? 3 : 0, value.value * (height - 4)) }));
  return <PressFeedback feedback="opacity" accessibilityRole="button" accessibilityState={{ selected }}
    accessibilityLabel={t(noNetSpending(point) ? point.partial ? 'reports.chart.barPartialNoNet' : 'reports.chart.barNoNet' : point.partial ? 'reports.chart.barPartial' : 'reports.chart.bar',
      { month: formatDate(point.monthISO.slice(0, 7) + '-01', 'month'), year: point.monthISO.slice(0, 4), amount: spokenMoney(point.amountMinor, currency) })}
    onPress={onPress} containerStyle={{ flex: 1 }} style={{ height, justifyContent: 'flex-end', minHeight: undefined }}>
    <Animated.View style={[{ borderRadius: 6, backgroundColor: selected ? p.primary : idleBarColor(p), borderWidth: point.partial ? StyleSheet.hairlineWidth * 2 : 0,
      // The month in progress stays outlined: ink on an idle bar (the idle fill is too close to the secondary ink), secondary on the shown one.
      borderColor: selected ? p.secondary : p.text,
      transitionProperty: 'backgroundColor', transitionDuration: reduced ? 0 : duration.state }, style]} />
  </PressFeedback>;
}
