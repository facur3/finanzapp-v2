import { useEffect, useState } from 'react';
import { Alert, StyleSheet, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { formatMinorUnits, labelFromISO, type Account, type CategorySpending, type Currency, type MonthlyBudgetSummary, type RecurringRule } from '@finanzapp/domain';
import { AppText, CategoryBadge, Money, PressFeedback, Surface } from './components';
import { categoryColor, othersColor } from './category-color';
import { ValueTransition, timing } from './motion';
import { spendingShare } from './report-presentation';
import { usePalette, useReduceMotion } from './theme';

/** Contextual help for a metric: one native alert with the definition, so the
 * screen itself carries no disclaimer copy. */
export function MetricHelp({ title, detail }: { title: string; detail: string }) {
  const p = usePalette();
  return <PressFeedback feedback="opacity" accessibilityRole="button" accessibilityLabel={'Qué significa ' + title} hitSlop={8}
    onPress={() => Alert.alert(title, detail)} style={{ minHeight: 24, paddingHorizontal: 4 }}>
    <Ionicons name="information-circle-outline" size={18} color={p.tertiary} accessible={false} />
  </PressFeedback>;
}

/** One proportion of the composition bar, drawn with transforms only: the
 * segment is the full bar scaled and shifted on the UI thread, so changing
 * shares never re-runs layout. Square ends stay crisp under scaleX because the
 * rounded corners belong to the clipped container. */
function Segment({ start, share, color, width, last }: { start: number; share: number; color: string; width: number; last: boolean }) {
  const reduced = useReduceMotion();
  const startValue = useSharedValue(start);
  const shareValue = useSharedValue(share);
  useEffect(() => {
    startValue.value = withTiming(start, timing('data', reduced));
    shareValue.value = withTiming(share, timing('data', reduced));
  }, [start, share, reduced, startValue, shareValue]);
  const style = useAnimatedStyle(() => {
    const visible = Math.max(0, shareValue.value * width - (last ? 0 : 2));
    return { transform: [{ translateX: startValue.value * width + visible / 2 - width / 2 }, { scaleX: width > 0 ? visible / width : 0 }] };
  });
  return <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: color }, style]} />;
}

/** Where the period's spending went, at a glance: one stacked bar in category
 * hues, then the top categories as name · amount · share. The long tail is a
 * single neutral row that opens Reportes. When the same categories get new
 * amounts the bar morphs; when the set of categories changes the whole block
 * crossfades instead of morphing one category into another. Nothing here
 * estimates: shares are display-only ratios of recorded amounts. */
export function CategoryComposition({ categories, totalMinor, currency, hues, limit = 3, onPressCategory, onPressOthers }: {
  categories: CategorySpending[]; totalMinor: number; currency: Currency; hues: Map<string, number>; limit?: number;
  onPressCategory: (category: CategorySpending) => void; onPressOthers: () => void;
}) {
  const p = usePalette();
  const { fontScale } = useWindowDimensions();
  const [width, setWidth] = useState(0);
  const stacked = fontScale > 1.3;
  const head = categories.slice(0, limit);
  const tail = categories.slice(limit);
  const othersMinor = tail.reduce((sum, category) => sum + category.amountMinor, 0);
  const segments = [...head.map(category => ({ key: category.key, color: categoryColor(category.key, hues, p), fraction: spendingShare(category.amountMinor, totalMinor).fraction })),
    ...(tail.length ? [{ key: '__others__', color: othersColor(p), fraction: spendingShare(othersMinor, totalMinor).fraction }] : [])];
  let offset = 0;
  const placed = segments.map(segment => { const start = offset; offset += segment.fraction; return { ...segment, start }; });
  const summary = head.map(category => `${category.category} ${spendingShare(category.amountMinor, totalMinor).label}`).join(', ');
  const setId = currency + '|' + segments.map(segment => segment.key).join('|');
  return <ValueTransition id={setId} variant="fade">
    <Surface grouped>
      <View accessible accessibilityRole="image" accessibilityLabel={'Distribución del gasto: ' + summary}
        onLayout={event => setWidth(event.nativeEvent.layout.width)}
        style={{ height: 10, borderRadius: 5, overflow: 'hidden', backgroundColor: p.inset, marginHorizontal: 16, marginTop: 16, marginBottom: 6 }}>
        {width > 0 && placed.map((segment, index) => <Segment key={segment.key} start={segment.start} share={segment.fraction} color={segment.color}
          width={width} last={index === placed.length - 1} />)}
      </View>
      {head.map((category, index) => <CompositionRow key={category.key} label={category.category} color={categoryColor(category.key, hues, p)}
        amountMinor={category.amountMinor} totalMinor={totalMinor} currency={currency} count={category.count} stacked={stacked}
        last={index === head.length - 1 && !tail.length} onPress={() => onPressCategory(category)}
        hint="Abre los movimientos de esta categoría en el período seleccionado" />)}
      {tail.length > 0 && <CompositionRow label={tail.length === 1 ? tail[0].category : `Otras ${tail.length} categorías`} color={othersColor(p)}
        amountMinor={othersMinor} totalMinor={totalMinor} currency={currency} stacked={stacked} last onPress={onPressOthers} hint="Abre Reportes" />}
    </Surface>
  </ValueTransition>;
}

function CompositionRow({ label, color, amountMinor, totalMinor, currency, count, stacked, last, onPress, hint }: {
  label: string; color: string; amountMinor: number; totalMinor: number; currency: Currency; count?: number; stacked: boolean; last: boolean; onPress: () => void; hint: string;
}) {
  const p = usePalette();
  const share = spendingShare(amountMinor, totalMinor).label;
  const detail = count === undefined ? null : count === 1 ? '1 gasto' : count + ' gastos';
  return <PressFeedback feedback="highlight" accessibilityRole="button" accessibilityHint={hint}
    accessibilityLabel={`${label}, ${formatMinorUnits(amountMinor)} ${currency}, ${share} del gasto del período${detail ? ', ' + detail : ''}`}
    onPress={onPress} style={[styles.compositionRow, { borderBottomColor: p.line, borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth }]}>
    <View accessible={false} style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }} />
    <View style={{ flex: 1, minWidth: 0, gap: 8, flexDirection: stacked ? 'column' : 'row', alignItems: stacked ? 'flex-start' : 'center' }}>
      <View style={{ flex: stacked ? undefined : 1, minWidth: 0, gap: 2 }}>
        <AppText numberOfLines={stacked ? undefined : 1} style={{ fontWeight: '500' }}>{label}</AppText>
        {detail && <AppText secondary variant="footnote">{detail}</AppText>}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Money minor={amountMinor} currency={currency} />
        <AppText secondary variant="footnote" style={{ minWidth: 44, textAlign: 'right', fontVariant: ['tabular-nums'] }}>{share}</AppText>
      </View>
    </View>
  </PressFeedback>;
}

/** One line of budget truth for the current month: what is left, of how much,
 * and whether any category is over. Tapping opens Presupuestos. */
export function BudgetHomeCard({ summary }: { summary: MonthlyBudgetSummary }) {
  const p = usePalette();
  const reduced = useReduceMotion();
  const { currency, budgetedMinor: total, spentBudgetedMinor: spent, remainingMinor: remaining } = summary;
  const exceeded = summary.rows.filter(row => row.exceeded).length;
  const ratio = total > 0 ? Math.min(1, spent / total) : 0;
  const progress = useSharedValue(ratio);
  useEffect(() => { progress.value = withTiming(ratio, timing('data', reduced)); }, [ratio, reduced, progress]);
  const bar = useAnimatedStyle(() => ({ width: `${progress.value === 0 ? 0 : Math.max(1.5, progress.value * 100)}%` as `${number}%` }));
  const tone = remaining < 0 ? p.expense : ratio >= 0.85 ? p.warning : p.text;
  const status = exceeded ? `${exceeded} ${exceeded === 1 ? 'categoría excedida' : 'categorías excedidas'}`
    : `${summary.rows.length} ${summary.rows.length === 1 ? 'categoría en orden' : 'categorías en orden'}`;
  return <PressFeedback accessibilityRole="button"
    accessibilityLabel={`Presupuesto del mes: ${remaining < 0 ? 'excedido en ' : 'quedan '}${formatMinorUnits(Math.abs(remaining))} ${currency} de ${formatMinorUnits(total)}. ${status}`}
    onPress={() => router.push({ pathname: '/budgets', params: { currency } })}>
    <Surface style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <AppText secondary variant="caption" style={{ fontWeight: '500' }}>{remaining < 0 ? 'Excedido' : 'Te queda'}</AppText>
          <Money minor={Math.abs(remaining)} currency={currency} size={24} weight="700" color={tone} />
        </View>
        <View style={{ alignItems: 'flex-end', gap: 2 }}>
          <AppText secondary variant="caption">de {currency === 'USD' ? 'US$ ' : '$ '}{formatMinorUnits(total)}</AppText>
          <AppText variant="footnote" style={{ color: exceeded ? p.expense : p.secondary, fontWeight: exceeded ? '600' : '400' }}>{status}</AppText>
        </View>
      </View>
      <View accessible={false} style={{ height: 6, borderRadius: 3, overflow: 'hidden', backgroundColor: p.inset }}>
        <Animated.View style={[{ height: 6, borderRadius: 3, backgroundColor: tone === p.text ? p.text : tone }, bar]} />
      </View>
    </Surface>
  </PressFeedback>;
}

export function UpcomingRecurringRow({ rule, account, day, last }: {
  rule: RecurringRule; account: Account; day: string; last: boolean;
}) {
  const p = usePalette();
  const date = labelFromISO(rule.nextDateISO, new Date(day + 'T12:00:00'));
  const days = Math.round((Date.parse(rule.nextDateISO + 'T12:00:00Z') - Date.parse(day + 'T12:00:00Z')) / 86400000);
  const when = days === 0 ? 'Hoy' : days === 1 ? 'Mañana' : `En ${days} días`;
  return <PressFeedback feedback="highlight" accessibilityRole="button"
    accessibilityLabel={`${rule.merchant}, ${formatMinorUnits(rule.amountMinor)} ${account.currency}, próximo pago ${date}`}
    onPress={() => router.push({ pathname: '/edit-recurring/[id]', params: { id: rule.id } })}
    style={[styles.row, { borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth, borderBottomColor: p.line }]}>
    <CategoryBadge category={rule.category} />
    <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
      <AppText numberOfLines={1} style={{ fontWeight: '500' }}>{rule.merchant}</AppText>
      <AppText secondary variant="footnote" numberOfLines={1}>{date} · {account.name}</AppText>
    </View>
    <View style={{ alignItems: 'flex-end', gap: 3 }}>
      <Money minor={rule.amountMinor} currency={account.currency} />
      <AppText variant="caption" style={{ color: days <= 1 ? p.warning : p.secondary, fontWeight: days <= 1 ? '600' : '400' }}>{when}</AppText>
    </View>
  </PressFeedback>;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 16, minHeight: 64 },
  compositionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 16, minHeight: 52 },
});
