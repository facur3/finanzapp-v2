import { useEffect } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { formatMinorUnits, type CategorySpending, type Currency } from '@finanzapp/domain';
import { AppText, CategoryBadge, Money, PressFeedback } from './components';
import { spendingShare } from './report-presentation';
import { usePalette, useReduceMotion } from './theme';

function ShareBar({ fraction }: { fraction: number }) {
  const p = usePalette();
  const reduced = useReduceMotion();
  // Start at the real proportion. Animate changes between data, never a fake
  // zero balance or a focus-triggered replay when returning from a detail.
  const progress = useSharedValue(fraction);
  useEffect(() => {
    progress.value = withTiming(fraction, { duration: reduced ? 0 : 260 });
    return () => cancelAnimation(progress);
  }, [fraction, reduced, progress]);
  const style = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` as `${number}%` }));
  return <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
    style={{ height: 6, borderRadius: 3, backgroundColor: p.inset, overflow: 'hidden' }}>
    <Animated.View style={[{ height: 6, borderRadius: 3, backgroundColor: p.accent }, style]} />
  </View>;
}

export function CategorySpendingRow({ category, totalMinor, currency, onPress, last = false, compact = false }: {
  category: CategorySpending; totalMinor: number; currency: Currency;
  onPress: () => void; last?: boolean; compact?: boolean;
}) {
  const p = usePalette();
  const { fontScale, width } = useWindowDimensions();
  const { fraction, label } = spendingShare(category.amountMinor, totalMinor);
  const count = category.count === 1 ? '1 gasto' : category.count + ' gastos';
  const stacked = fontScale > 1.3 || width < 360;
  return <PressFeedback accessibilityRole="button"
    accessibilityLabel={`${category.category}, ${formatMinorUnits(category.amountMinor)} ${currency}, ${label} del gasto del mes, ${count}`}
    accessibilityHint="Abre los movimientos de esta categoría en el mes seleccionado"
    onPress={onPress} style={{ paddingHorizontal: 16, paddingVertical: 16, flexDirection: 'row', gap: 12, alignItems: 'center',
      borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth, borderBottomColor: p.line }}>
    <CategoryBadge category={category.category} />
    <View style={{ flex: 1, minWidth: 0, gap: 9 }}>
      <View style={{ flexDirection: stacked ? 'column' : 'row', gap: 6, alignItems: stacked ? 'flex-start' : 'baseline' }}>
        <AppText numberOfLines={stacked ? undefined : 2} style={{ flex: stacked ? undefined : 1, fontWeight: '600', fontSize: 15, lineHeight: 21 }}>{category.category}</AppText>
        <View style={{ maxWidth: stacked ? '100%' : '55%' }}><Money minor={category.amountMinor} currency={currency} size={15} /></View>
      </View>
      <ShareBar fraction={fraction} />
      <AppText secondary style={{ fontSize: 13, lineHeight: 18 }}>{label}{compact ? '' : ' · ' + count}</AppText>
    </View>
    {!compact && <Ionicons name="chevron-forward" size={15} color={p.secondary} accessible={false} />}
  </PressFeedback>;
}
