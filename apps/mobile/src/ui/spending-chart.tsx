import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { formatMinorUnits, type CategorySpending, type Currency } from '@finanzapp/domain';
import { AppText, CategoryBadge, Money, PressFeedback, useStacked } from './components';
import { useCategoryLook } from './category-hues';
import { spendingShare } from './report-presentation';
import { timing } from './motion';
import { useI18n } from '../i18n/provider';
import { usePalette, useReduceMotion } from './theme';

function ShareBar({ fraction, color }: { fraction: number; color: string }) {
  const p = usePalette();
  const reduced = useReduceMotion();
  // Start at the real proportion. Animate changes between data, never a fake
  // zero balance or a focus-triggered replay when returning from a detail.
  const progress = useSharedValue(fraction);
  useEffect(() => {
    progress.value = withTiming(fraction, timing('data', reduced));
    return () => cancelAnimation(progress);
  }, [fraction, reduced, progress]);
  const style = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` as `${number}%` }));
  return <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
    style={{ height: 6, borderRadius: 3, backgroundColor: p.inset, overflow: 'hidden' }}>
    <Animated.View style={[{ height: 6, borderRadius: 3, backgroundColor: color }, style]} />
  </View>;
}

/** A category's share of the month's spending, with a bar. */
export function CategorySpendingRow({ category, totalMinor, currency, onPress, last = false, compact = false }: {
  category: CategorySpending; totalMinor: number; currency: Currency;
  onPress: () => void; last?: boolean; compact?: boolean;
}) {
  const p = usePalette();
  const { t, locale } = useI18n();
  const { hex: color, label: name } = useCategoryLook(category.category);
  const { fraction, label } = spendingShare(category.amountMinor, totalMinor, locale);
  const count = t('count.expenses', { count: category.count });
  const stacked = useStacked({ minor: category.amountMinor, currency });
  return <PressFeedback feedback="highlight" accessibilityRole="button"
    accessibilityLabel={t('reports.chart.categoryLabel', { name, amount: formatMinorUnits(category.amountMinor), currency, share: label, count })}
    accessibilityHint={t('reports.chart.categoryHint')}
    onPress={onPress} style={{ paddingHorizontal: 16, paddingVertical: 16, flexDirection: 'row', gap: 12, alignItems: 'center',
      borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth, borderBottomColor: p.line }}>
    <CategoryBadge category={category.category} />
    <View style={{ flex: 1, minWidth: 0, gap: 9 }}>
      <View style={{ flexDirection: stacked ? 'column' : 'row', gap: 6, alignItems: stacked ? 'flex-start' : 'baseline' }}>
        <AppText numberOfLines={stacked ? undefined : 2} style={{ flex: stacked ? undefined : 1, fontWeight: '600', fontSize: 15, lineHeight: 21 }}>{name}</AppText>
        <View style={{ maxWidth: stacked ? '100%' : '55%' }}><Money minor={category.amountMinor} currency={currency} size={15} /></View>
      </View>
      <ShareBar fraction={fraction} color={color} />
      <AppText secondary style={{ fontSize: 13, lineHeight: 18 }}>{label}{compact ? '' : ' · ' + count}</AppText>
    </View>
    {!compact && <Ionicons name="chevron-forward" size={15} color={p.secondary} accessible={false} />}
  </PressFeedback>;
}

/** Legend row for the donut: the category tile carries the slice's hue, so the row needs no swatch. */
export function CategoryLegendRow({ category, totalMinor, currency, onPress, last = false }: {
  category: CategorySpending; totalMinor: number; currency: Currency; onPress: () => void; last?: boolean;
}) {
  const p = usePalette();
  const { t, locale } = useI18n();
  const name = useCategoryLook(category.category).label;
  const { label } = spendingShare(category.amountMinor, totalMinor, locale);
  const count = t('count.expenses', { count: category.count });
  const stacked = useStacked({ minor: category.amountMinor, currency });
  return <PressFeedback feedback="highlight" accessibilityRole="button"
    accessibilityLabel={t('reports.chart.categoryLabel', { name, amount: formatMinorUnits(category.amountMinor), currency, share: label, count })}
    accessibilityHint={t('reports.chart.categoryHint')}
    onPress={onPress} style={{ paddingHorizontal: 16, paddingVertical: 12, minHeight: 60, flexDirection: 'row', gap: 12, alignItems: 'center',
      borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth, borderBottomColor: p.line }}>
    <CategoryBadge category={category.category} />
    <View style={{ flex: 1, minWidth: 0, gap: 8, flexDirection: stacked ? 'column' : 'row', alignItems: stacked ? 'flex-start' : 'center' }}>
      <View style={{ flex: stacked ? undefined : 1, minWidth: 0, gap: 3 }}>
        <AppText numberOfLines={stacked ? undefined : 2} style={{ fontWeight: '500' }}>{name}</AppText>
        <AppText secondary variant="footnote">{count}</AppText>
      </View>
      <View style={{ alignItems: stacked ? 'flex-start' : 'flex-end', gap: 3 }}>
        <Money minor={category.amountMinor} currency={currency} />
        <AppText secondary variant="caption" style={{ fontVariant: ['tabular-nums'] }}>{label}</AppText>
      </View>
    </View>
    <Ionicons name="chevron-forward" size={15} color={p.tertiary} accessible={false} />
  </PressFeedback>;
}
