import { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedProps, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';
import { AppText, Money, PressFeedback } from './components';
import { useI18n } from '../i18n/provider';
import { categoryColor, othersColor } from './category-color';
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
 * animated prop never applies. */
function Slice({ cx, radius, start, end, color, thickness, progress }: {
  cx: number; radius: number; start: number; end: number; color: string; thickness: number; progress: SharedValue<number>;
}) {
  const animatedProps = useAnimatedProps(() => {
    const hand = -Math.PI / 2 + progress.value * Math.PI * 2;
    return { d: arcPath(cx, cx, radius, start, Math.min(end, hand)) };
  });
  return <AnimatedPath d={arcPath(cx, cx, radius, start, end)} animatedProps={animatedProps} stroke={color} strokeWidth={thickness} fill="none" strokeLinecap="butt" />;
}

/** Category donut with a 2 px gap between slices and the total in the middle.
 * The first chart sweeps in clockwise (480 ms); after that a month or currency
 * change is one crossfade with the slices already final, so the change reads
 * as one state replacing another rather than a redraw. Reduce Motion shows the
 * finished chart at once. */
export function DonutChart({ slices, total, currency, size = 176, thickness = 22, caption }: {
  slices: (DonutSlice & { color: string })[]; total: number; currency: Currency; size?: number; thickness?: number; caption: string;
}) {
  const p = usePalette();
  const { t, speechLanguage } = useI18n();
  const signature = slices.map(slice => slice.key + ':' + slice.value).join('|');
  const revealed = useRef(false);
  const reveal = !revealed.current;
  useEffect(() => { revealed.current = true; }, []);
  const arcs = useMemo(() => {
    const sum = slices.reduce((acc, slice) => acc + slice.value, 0);
    if (sum <= 0) return [];
    const radius = (size - thickness) / 2;
    const gap = slices.length > 1 ? 2 / radius : 0; // 2 px expressed as an angle.
    let angle = -Math.PI / 2;
    return slices.filter(slice => slice.value > 0).map(slice => {
      const sweep = (slice.value / sum) * Math.PI * 2;
      const start = angle + gap / 2, end = angle + sweep - gap / 2;
      angle += sweep;
      return { key: slice.key, start, end, color: slice.color, radius };
    });
  }, [slices, size, thickness]);
  const label = slices.map(slice => t('reports.chart.slice', { label: slice.label, percent: Math.round(slice.value / Math.max(1, total) * 100) })).join(', ');
  return <ValueTransition id={signature} variant="fade" style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
    <View accessible accessibilityRole="image" accessibilityLabel={t('reports.chart.donutLabel', { caption, slices: label })} accessibilityLanguage={speechLanguage} style={{ width: size, height: size }}>
      <Sweep arcs={arcs} size={size} thickness={thickness} ring={p.inset} reveal={reveal} />
    </View>
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', gap: 2, paddingHorizontal: thickness + 8 }]}>
      <AppText secondary variant="caption" style={{ fontWeight: '500' }}>{caption}</AppText>
      <Money minor={total} currency={currency} size={size >= 176 ? 20 : 17} weight="700" />
    </View>
  </ValueTransition>;
}

function Sweep({ arcs, size, thickness, ring, reveal }: {
  arcs: { key: string; start: number; end: number; color: string; radius: number }[]; size: number; thickness: number; ring: string; reveal: boolean;
}) {
  const reduced = useReduceMotion();
  const progress = useSharedValue(reduced || !reveal ? 1 : 0);
  useEffect(() => { progress.value = reduced || !reveal ? 1 : withTiming(1, timing('reveal', false)); }, [reduced, reveal, progress]);
  return <Svg width={size} height={size}>
    <Circle cx={size / 2} cy={size / 2} r={(size - thickness) / 2} stroke={ring} strokeWidth={thickness} fill="none" />
    {arcs.map(arc => arc.end > arc.start ? <Slice key={arc.key} cx={size / 2} radius={arc.radius} start={arc.start} end={arc.end} color={arc.color} thickness={thickness} progress={progress} /> : null)}
  </Svg>;
}

/** The locale's short month name ("sep", "Sep"): its short date of the first, without the day. For the
 * axis only: VoiceOver gets the full name, since a voice may read "mar" or "may" as a word. */
export function shortMonth(monthISO: string, formatDate: (dateISO: string, style: 'day') => string): string {
  return formatDate(monthISO.slice(0, 7) + '-01', 'day').replace(/(^1\s+|\s+1$)/, '');
}

/** Six monthly bars on a common zero-to-max scale. The selected month is the
 * brand primary, the rest are graphite; a partial (current) month is outlined.
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
    <Animated.View style={[{ borderRadius: 6, backgroundColor: selected ? p.primary : p.inset, borderWidth: point.partial ? StyleSheet.hairlineWidth * 2 : 0, borderColor: p.secondary,
      transitionProperty: 'backgroundColor', transitionDuration: reduced ? 0 : duration.state }, style]} />
  </PressFeedback>;
}
