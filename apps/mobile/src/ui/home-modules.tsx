import { useEffect } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { formatMinorUnits, labelFromISO, type Account, type CategorySpending, type Currency, type MonthlyBudgetSummary, type RecurringRule } from '@finanzapp/domain';
import { AppText, CategoryBadge, Money, PressFeedback, Surface } from './components';
import { spendingShare } from './report-presentation';
import { usePalette, useReduceMotion } from './theme';

/** Compact category line for Home: name, count, amount and share. The full
 * proportional bars live in Reportes, where there is room to compare. */
export function CategoryHomeRow({ category, totalMinor, currency, onPress, last = false }: {
  category: CategorySpending; totalMinor: number; currency: Currency; onPress: () => void; last?: boolean;
}) {
  const p = usePalette();
  const { fontScale } = useWindowDimensions();
  const { fraction, label } = spendingShare(category.amountMinor, totalMinor);
  const count = category.count === 1 ? '1 gasto' : category.count + ' gastos';
  const stacked = fontScale > 1.3;
  return <PressFeedback accessibilityRole="button"
    accessibilityLabel={`${category.category}, ${formatMinorUnits(category.amountMinor)} ${currency}, ${label} del gasto del período, ${count}`}
    accessibilityHint="Abre los movimientos de esta categoría en el período seleccionado"
    onPress={onPress} style={[styles.row, { borderBottomColor: p.line, borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth }]}>
    <CategoryBadge category={category.category} />
    <View style={{ flex: 1, minWidth: 0, gap: 8, flexDirection: stacked ? 'column' : 'row', alignItems: stacked ? 'flex-start' : 'center' }}>
      <View style={{ flex: stacked ? undefined : 1, minWidth: 0, gap: 3 }}>
        <AppText numberOfLines={stacked ? undefined : 1} style={{ fontWeight: '500' }}>{category.category}</AppText>
        <AppText secondary variant="footnote">{count}</AppText>
      </View>
      <View style={{ alignItems: stacked ? 'flex-start' : 'flex-end', gap: 3 }}>
        <Money minor={category.amountMinor} currency={currency} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View accessible={false} style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: p.inset, overflow: 'hidden' }}>
            <View style={{ width: `${Math.max(fraction * 100, fraction > 0 ? 4 : 0)}%`, height: 4, backgroundColor: p.text }} />
          </View>
          <AppText secondary variant="caption" style={{ fontVariant: ['tabular-nums'] }}>{label}</AppText>
        </View>
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
  useEffect(() => { progress.value = withTiming(ratio, { duration: reduced ? 0 : 420 }); }, [ratio, reduced, progress]);
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
  return <PressFeedback accessibilityRole="button"
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
});
