import { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';
import { AppText, Money, PressFeedback } from './components';
import { usePalette, useReduceMotion, type Palette } from './theme';
import type { Currency } from '@finanzapp/domain';

/** Share is rank, not identity: one ink hue in five lightness steps, largest
 * first. Names live in the legend rows, so colour is never the only cue. */
export function inkRamp(p: Palette): string[] {
  return p.isDark ? ['#F5F5F7', '#C4C4CB', '#93939B', '#66666E', '#43434A'] : ['#0A0A0C', '#3C3C42', '#6E7078', '#A0A2AA', '#CBCBD2'];
}
export const OTHERS_KEY = '__others__';

export type DonutSlice = { key: string; label: string; value: number };

/** Groups the tail of a ranked list into "Otras" so the donut keeps at most
 * five readable slices. Returns the same shape with a colour per slice. */
export function donutSlices(items: DonutSlice[], p: Palette, max = 5): (DonutSlice & { color: string; count?: number })[] {
  const ramp = inkRamp(p);
  const head = items.slice(0, items.length > max ? max - 1 : max).map((item, index) => ({ ...item, color: ramp[index] }));
  const tail = items.slice(head.length);
  if (!tail.length) return head;
  return [...head, { key: OTHERS_KEY, label: 'Otras', value: tail.reduce((sum, item) => sum + item.value, 0), color: ramp[max - 1], count: tail.length }];
}

function arcPath(cx: number, cy: number, radius: number, startAngle: number, endAngle: number): string {
  const start = { x: cx + radius * Math.cos(startAngle), y: cy + radius * Math.sin(startAngle) };
  const end = { x: cx + radius * Math.cos(endAngle), y: cy + radius * Math.sin(endAngle) };
  const large = endAngle - startAngle > Math.PI ? 1 : 0;
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${large} 1 ${end.x} ${end.y}`;
}

/** Category donut with a 2 px gap between slices and the total in the middle.
 * The chart fades in on data changes; Reduce Motion shows it immediately. */
export function DonutChart({ slices, total, currency, size = 176, thickness = 22, caption }: {
  slices: (DonutSlice & { color: string })[]; total: number; currency: Currency; size?: number; thickness?: number; caption: string;
}) {
  const p = usePalette();
  const reduced = useReduceMotion();
  const signature = slices.map(slice => slice.key + ':' + slice.value).join('|');
  const opacity = useSharedValue(reduced ? 1 : 0);
  useEffect(() => { opacity.value = 0; opacity.value = withTiming(1, { duration: reduced ? 0 : 320 }); }, [signature, reduced, opacity]);
  const fade = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const paths = useMemo(() => {
    const sum = slices.reduce((acc, slice) => acc + slice.value, 0);
    if (sum <= 0) return [];
    const radius = (size - thickness) / 2;
    const gap = slices.length > 1 ? 2 / radius : 0; // 2 px expressed as an angle.
    let angle = -Math.PI / 2;
    return slices.filter(slice => slice.value > 0).map(slice => {
      const sweep = (slice.value / sum) * Math.PI * 2;
      const start = angle + gap / 2, end = angle + sweep - gap / 2;
      angle += sweep;
      if (end <= start) return { key: slice.key, d: '', color: slice.color };
      // A single full slice needs two arcs; SVG cannot draw a 360° arc in one command.
      const d = sweep >= Math.PI * 2 - 1e-6
        ? arcPath(size / 2, size / 2, radius, start, start + Math.PI) + ' ' + arcPath(size / 2, size / 2, radius, start + Math.PI, start + Math.PI * 2 - 1e-4)
        : arcPath(size / 2, size / 2, radius, start, end);
      return { key: slice.key, d, color: slice.color };
    });
  }, [slices, size, thickness]);
  const label = slices.map(slice => `${slice.label} ${Math.round(slice.value / Math.max(1, total) * 100)} %`).join(', ');
  return <Animated.View accessible accessibilityRole="image" accessibilityLabel={`${caption}: ${label}`} style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, fade]}>
    <Svg width={size} height={size}>
      <Circle cx={size / 2} cy={size / 2} r={(size - thickness) / 2} stroke={p.inset} strokeWidth={thickness} fill="none" />
      {paths.map(path => path.d ? <Path key={path.key} d={path.d} stroke={path.color} strokeWidth={thickness} fill="none" strokeLinecap="butt" /> : null)}
    </Svg>
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', gap: 2, paddingHorizontal: thickness + 8 }]}>
      <AppText secondary variant="caption" style={{ fontWeight: '500' }}>{caption}</AppText>
      <Money minor={total} currency={currency} size={size >= 176 ? 20 : 17} weight="700" />
    </View>
  </Animated.View>;
}

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** Six monthly bars on a common zero-to-max scale. The selected month is ink,
 * the rest are tertiary; a partial (current) month is outlined. Tapping a bar
 * selects that month. Bars animate between data sets, never from zero. */
export function MonthBars({ points, selected, onSelect, currency, height = 120 }: {
  points: { monthISO: string; amountMinor: number; partial: boolean }[]; selected: string; onSelect: (monthISO: string) => void; currency: Currency; height?: number;
}) {
  const p = usePalette();
  const max = Math.max(...points.map(point => point.amountMinor), 1);
  const current = points.find(point => point.monthISO === selected);
  return <View style={{ gap: 8 }}>
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, height }}>
      {points.map(point => <Bar key={point.monthISO} point={point} fraction={point.amountMinor / max} selected={point.monthISO === selected}
        onPress={() => onSelect(point.monthISO)} currency={currency} height={height} />)}
    </View>
    <View style={{ flexDirection: 'row', gap: 6 }}>
      {points.map(point => <AppText key={point.monthISO} variant="caption" style={{ flex: 1, textAlign: 'center', fontWeight: point.monthISO === selected ? '600' : '400', color: point.monthISO === selected ? p.text : p.secondary }}>
        {MONTHS[Number(point.monthISO.slice(5, 7)) - 1]}
      </AppText>)}
    </View>
    {current && <AppText secondary variant="caption" style={{ textAlign: 'center' }}>
      {current.partial ? 'Mes en curso hasta hoy' : 'Mes completo'} · escala de 0 a {currency === 'USD' ? 'US$ ' : '$ '}{(max / 100).toLocaleString('es-AR', { maximumFractionDigits: 0 })}
    </AppText>}
  </View>;
}

function Bar({ point, fraction, selected, onPress, currency, height }: {
  point: { monthISO: string; amountMinor: number; partial: boolean }; fraction: number; selected: boolean; onPress: () => void; currency: Currency; height: number;
}) {
  const p = usePalette();
  const reduced = useReduceMotion();
  const value = useSharedValue(fraction);
  useEffect(() => { value.value = withTiming(fraction, { duration: reduced ? 0 : 280 }); }, [fraction, reduced, value]);
  const style = useAnimatedStyle(() => ({ height: Math.max(point.amountMinor > 0 ? 3 : 0, value.value * (height - 4)) }));
  return <PressFeedback accessibilityRole="button" accessibilityState={{ selected }}
    accessibilityLabel={`${MONTHS[Number(point.monthISO.slice(5, 7)) - 1]} ${point.monthISO.slice(0, 4)}, ${(point.amountMinor / 100).toLocaleString('es-AR', { minimumFractionDigits: 2 })} ${currency}${point.partial ? ', mes en curso' : ''}`}
    onPress={onPress} containerStyle={{ flex: 1 }} style={{ height, justifyContent: 'flex-end', minHeight: undefined }}>
    <Animated.View style={[{ borderRadius: 6, backgroundColor: selected ? p.text : p.inset, borderWidth: point.partial ? StyleSheet.hairlineWidth * 2 : 0, borderColor: p.secondary }, style]} />
  </PressFeedback>;
}
