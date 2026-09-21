import { useEffect, useRef } from 'react';
import { Alert, StyleSheet, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { formatMinorUnits, labelFromISO, type Account, type CategorySpending, type Currency, type MonthlyBudgetSummary, type RecurringRule } from '@finanzapp/domain';
import { AppText, CategoryBadge, Money, PressFeedback, Surface } from './components';
import { tintOf } from './category-color';
import { useCategoryColor } from './category-hues';
import { easeOut, timing } from './motion';
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

/** How the row fill reveals: from zero on the first data, 300 ms ease-out with
 * a 50 ms stagger per row; later changes interpolate from the previous share
 * with no delay. Reduce Motion removes the width motion and keeps a 200 ms
 * fade of the fill, so the state is still explained without movement. Widths
 * are honest: a 0,1 % category gets a hairline, never an invented minimum. */
export const RANKING_REVEAL = { duration: 300, stagger: 50, fade: 200 } as const;

/** The biggest categories this month as one distribution: a grouped surface
 * whose rows are each filled, from the left, in a tint of their own hue for
 * exactly their share of the month. The category is one object (glyph on its
 * hue), the amount sits right; no percentages, no bar under the row. Reportes
 * has the full picture. Fills are absolute, childless and behind the content,
 * so the animation costs no layout and never blocks a tap. */
export function CategoryRanking({ categories, totalMinor, currency, limit = 4, onPressCategory }: {
  categories: CategorySpending[]; totalMinor: number; currency: Currency; limit?: number; onPressCategory: (category: CategorySpending) => void;
}) {
  const head = categories.slice(0, limit);
  return <Surface grouped>
    {head.map((category, index) => <RankedRow key={category.key} category={category} totalMinor={totalMinor} currency={currency} index={index}
      last={index === head.length - 1} onPress={() => onPressCategory(category)} />)}
  </Surface>;
}

function RankedRow({ category, totalMinor, currency, index, last, onPress }: {
  category: CategorySpending; totalMinor: number; currency: Currency; index: number; last: boolean; onPress: () => void;
}) {
  const p = usePalette();
  const reduced = useReduceMotion();
  const color = useCategoryColor(category.category);
  const { fontScale } = useWindowDimensions();
  const { fraction, label } = spendingShare(category.amountMinor, totalMinor);
  // First data: the fill grows from zero (or, under Reduce Motion, fades in already sized). Later data: the fill moves to the new share.
  const progress = useSharedValue(reduced ? fraction : 0);
  const opacity = useSharedValue(reduced ? 0 : 1);
  const revealed = useRef(false);
  useEffect(() => {
    if (!revealed.current) {
      revealed.current = true;
      if (reduced) { opacity.value = withTiming(1, { duration: RANKING_REVEAL.fade, easing: easeOut }); return; }
      progress.value = withDelay(index * RANKING_REVEAL.stagger, withTiming(fraction, { duration: RANKING_REVEAL.duration, easing: easeOut }));
      return;
    }
    opacity.value = 1;
    progress.value = withTiming(fraction, timing('data', reduced));
  }, [fraction, reduced, index, progress, opacity]);
  const fill = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` as `${number}%`, opacity: opacity.value }));
  const stacked = fontScale > 1.3;
  return <PressFeedback feedback="highlight" accessibilityRole="button" accessibilityHint="Abre los movimientos de esta categoría este mes"
    accessibilityLabel={`${category.category}, ${formatMinorUnits(category.amountMinor)} ${currency}, ${label} del gasto del mes`}
    onPress={onPress} style={[styles.row, { borderBottomColor: p.line, borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth }]}
    backdrop={<Animated.View pointerEvents="none" accessible={false} style={[styles.fill, { backgroundColor: tintOf(color, p) }, fill]} />}>
    <CategoryBadge category={category.category} />
    <View style={{ flex: 1, minWidth: 0, flexDirection: stacked ? 'column' : 'row', gap: stacked ? 2 : 12, alignItems: stacked ? 'flex-start' : 'center' }}>
      <AppText numberOfLines={1} style={{ flex: stacked ? undefined : 1, minWidth: 0, fontWeight: '500' }}>{category.category}</AppText>
      <Money minor={category.amountMinor} currency={currency} />
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
  // The fill's right edge is softened; its left and outer corners are clipped by the grouped surface.
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderTopRightRadius: 6, borderBottomRightRadius: 6 },
});
