import { useEffect, useMemo, useRef } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { useAnimatedProps, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';
import { AppText, Money, PressFeedback } from './components';
import { useI18n } from '../i18n/provider';
import { categoryColor, othersColor } from './category-color';
import { ROW_STACK_SCALE, amountWidthEm } from './geometry';
import { ValueTransition, duration, timing } from './motion';
import { usePalette, useReduceMotion, type Palette } from './theme';
import type { Currency } from '@finanzapp/domain';

export const OTHERS_KEY = '__others__';

export type DonutSlice = { key: string; label: string; value: number };

/** Groups the tail of a ranked list into one slice named `othersLabel`
 * ("Otras") so the donut keeps at most five readable slices. Each named slice
 * takes its category hue; the tail is neutral because it is not one category. */
export function donutSlices(items: DonutSlice[], p: Palette, hues: Map<string, number> | ((key: string) => string), othersLabel: string, max = 5): (DonutSlice & { color: string; count?: number })[] {
  const colorOf = typeof hues === 'function' ? hues : (key: string) => categoryColor(key, hues, p);
  const head = items.slice(0, items.length > max ? max - 1 : max).map(item => ({ ...item, color: colorOf(item.key) }));
  const tail = items.slice(head.length);
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

/** The arcs of a donut: each slice's share of the sum, clockwise from twelve, a 2 px gap between slices. */
export function donutArcs(slices: readonly { key: string; value: number; color: string }[], size: number, thickness: number): DonutArc[] {
  const sum = slices.reduce((acc, slice) => acc + slice.value, 0);
  if (sum <= 0) return [];
  const radius = (size - thickness - CHOSEN_EXTRA) / 2;
  const gap = slices.length > 1 ? 2 / radius : 0; // 2 px expressed as an angle.
  let angle = -Math.PI / 2;
  return slices.filter(slice => slice.value > 0).map(slice => {
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

/** Category donut (24UX6C2). The month's total is the report's own figure above it, so the centre never repeats it:
 * until a category is chosen it says, quietly, that a category can be tapped; a tapped slice is chosen (drawn thicker,
 * the others at 30 %), and the centre shows its name, its exact amount and its share. Tapping the chosen slice again, or
 * the hole, clears it. VoiceOver reaches the same choice without aiming at a slice: the chart is one adjustable element
 * (swipe up or down steps through the categories, and back to none) whose value says the chosen category, amount and
 * share. The colour is never the only sign of the choice: the centre names it and its row is marked too.
 *
 * The first chart sweeps in clockwise (480 ms); after that a month or currency change is one crossfade with the slices
 * already final, and a choice changes the opacity at once. Reduce Motion shows the finished chart at once. */
export function DonutChart({ slices, currency, size = 176, thickness = 22, chosen = null, onChoose, shareOf, caption }: {
  slices: (DonutSlice & { color: string })[]; currency: Currency; size?: number; thickness?: number;
  /** The chosen slice's key (null: none). */
  chosen?: string | null; onChoose?: (key: string | null) => void;
  /** A slice's share of the report's total, as the rows show it («29 %»): one formatter for both, so they always agree. */
  shareOf: (value: number) => { label: string; spoken: string };
  /** What VoiceOver calls the chart. */
  caption: string;
}) {
  const p = usePalette();
  const { t, speechLanguage, spokenMoney, moneyText } = useI18n();
  const { fontScale } = useWindowDimensions();
  const signature = slices.map(slice => slice.key + ':' + slice.value).join('|');
  const revealed = useRef(false);
  const reveal = !revealed.current;
  useEffect(() => { revealed.current = true; }, []);
  const arcs = useMemo(() => donutArcs(slices, size, thickness), [slices, size, thickness]);
  const selected = slices.find(slice => slice.key === chosen) ?? null;
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
    : t('reports.chart.noneChosen');
  // The chosen readout fits the hole only at ordinary text sizes and when its amount fits the hole's width at the centre's
  // size; otherwise it moves under the donut (whole, never truncated) and the hole stays clear. The readout is drawn for
  // the eye only: VoiceOver hears the same choice once, as the adjustable element's value.
  const amountSize = size >= 176 ? 18 : 16;
  const hole = size - 2 * (thickness + 10);
  const centreFits = !selected || (fontScale <= ROW_STACK_SCALE
    && amountWidthEm(moneyText(selected.value, currency)) * amountSize * Math.max(fontScale, 0.5) <= hole);
  const readout = selected ? <>
    <AppText numberOfLines={centreFits ? 2 : undefined} maxFontSizeMultiplier={centreFits ? ROW_STACK_SCALE : undefined} variant="footnote"
      style={{ fontWeight: '600', textAlign: 'center' }}>{selected.label}</AppText>
    <Money minor={selected.value} currency={currency} size={amountSize} weight="700" align="center" />
    <AppText secondary maxFontSizeMultiplier={centreFits ? ROW_STACK_SCALE : undefined} variant="caption" style={{ textAlign: 'center' }}>
      {t('reports.chart.share', { percent: shareOf(selected.value).label })}</AppText>
  </> : null;
  return <View style={{ alignItems: 'center', gap: 10 }}>
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
        <ValueTransition id={(selected?.key ?? 'none') + (centreFits ? '' : '|below')} variant="fade" style={{ alignItems: 'center', gap: 2 }}>
          {!selected ? <AppText secondary maxFontSizeMultiplier={ROW_STACK_SCALE} variant="footnote" style={{ textAlign: 'center' }}>{t('reports.chart.pick')}</AppText>
            : centreFits ? readout : null}
        </ValueTransition>
      </View>
    </ValueTransition>
    {selected && !centreFits && <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ alignItems: 'center', gap: 2, alignSelf: 'stretch' }}>
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

/** Six monthly bars on a common zero-to-max scale. The selected month is the
 * brand primary, the rest the idle ink (`idleBarColor`); a partial (current) month is outlined.
 * Tapping a bar selects that month. Bars animate between data sets, never from zero. */
export function MonthBars({ points, selected, onSelect, currency, height = 120 }: {
  points: { monthISO: string; amountMinor: number; partial: boolean }[]; selected: string; onSelect: (monthISO: string) => void; currency: Currency; height?: number;
}) {
  const p = usePalette();
  const reduced = useReduceMotion();
  const { t, formatDate, currencySymbol, formatWholeUnits, speechLanguage } = useI18n();
  const max = Math.max(...points.map(point => point.amountMinor), 1);
  const current = points.find(point => point.monthISO === selected);
  return <View style={{ gap: 8 }}>
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, height }}>
      {points.map(point => <Bar key={point.monthISO} point={point} fraction={point.amountMinor / max} selected={point.monthISO === selected}
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
  </View>;
}

function Bar({ point, fraction, selected, onPress, currency, height }: {
  point: { monthISO: string; amountMinor: number; partial: boolean }; fraction: number; selected: boolean; onPress: () => void; currency: Currency; height: number;
}) {
  const p = usePalette();
  const reduced = useReduceMotion();
  const { t, formatDate, spokenMoney } = useI18n();
  const value = useSharedValue(fraction);
  useEffect(() => { value.value = withTiming(fraction, timing('data', reduced)); }, [fraction, reduced, value]);
  const style = useAnimatedStyle(() => ({ height: Math.max(point.amountMinor > 0 ? 3 : 0, value.value * (height - 4)) }));
  return <PressFeedback feedback="opacity" accessibilityRole="button" accessibilityState={{ selected }}
    accessibilityLabel={t(point.partial ? 'reports.chart.barPartial' : 'reports.chart.bar',
      { month: formatDate(point.monthISO.slice(0, 7) + '-01', 'month'), year: point.monthISO.slice(0, 4), amount: spokenMoney(point.amountMinor, currency) })}
    onPress={onPress} containerStyle={{ flex: 1 }} style={{ height, justifyContent: 'flex-end', minHeight: undefined }}>
    <Animated.View style={[{ borderRadius: 6, backgroundColor: selected ? p.primary : idleBarColor(p), borderWidth: point.partial ? StyleSheet.hairlineWidth * 2 : 0,
      // The month in progress stays outlined: ink on an idle bar (the idle fill is too close to the secondary ink), secondary on the shown one.
      borderColor: selected ? p.secondary : p.text,
      transitionProperty: 'backgroundColor', transitionDuration: reduced ? 0 : duration.state }, style]} />
  </PressFeedback>;
}
