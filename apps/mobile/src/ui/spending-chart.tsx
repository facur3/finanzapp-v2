import { useEffect } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { type CategorySpending, type Currency } from '@finanzapp/domain';
import { AppText, CategoryBadge, Money, PressFeedback, rowAmountText, useStacked } from './components';
import { ROW_CHROME, labelAmountStacks } from './geometry';
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

/** What a category row says about its share (24T3, A24): a category above zero, its share of `totalMinor` (the positive
 * categories' sum, the donut's own base); one that nets to zero or less (devoluciones of earlier purchases) has no share and
 * reads «Sin gasto neto», visibly and for VoiceOver, never «0 %» or a dash. */
export function categoryShare(category: CategorySpending, totalMinor: number, currency: Currency, count: string,
  { t, locale, spokenMinor, spokenPercent }: Pick<ReturnType<typeof useI18n>, 't' | 'locale' | 'spokenMinor' | 'spokenPercent'>, name: string): { fraction: number; label: string; spoken: string } {
  if (category.amountMinor <= 0) return { fraction: 0, label: t('reports.chart.noNet'),
    spoken: t('reports.chart.categoryNoNetLabel', { name, amount: spokenMinor(category.amountMinor, currency), currency, count }) };
  const { fraction, label } = spendingShare(category.amountMinor, totalMinor, locale);
  return { fraction, label, spoken: t('reports.chart.categoryLabel', { name, amount: spokenMinor(category.amountMinor, currency), currency, share: spokenPercent(fraction), count }) };
}

/** A category's share of the month's spending, with a bar. `countLabel` (24T3) names its purchases and devoluciones; by
 * default its purchase lines (`category.count`). */
export function CategorySpendingRow({ category, totalMinor, currency, onPress, last = false, compact = false, countLabel }: {
  category: CategorySpending; totalMinor: number; currency: Currency;
  onPress: () => void; last?: boolean; compact?: boolean; countLabel?: string;
}) {
  const p = usePalette();
  const i18n = useI18n();
  const { hex: color, label: name } = useCategoryLook(category.category);
  const count = countLabel ?? i18n.t('count.expenses', { count: category.count });
  const { fraction, label, spoken } = categoryShare(category, totalMinor, currency, count, i18n, name);
  // 24UX6C2: the same name-and-amount rule as the legend rows (this row has its chevron unless compact).
  const stacked = useCategoryRowStacks(name, category.amountMinor, currency, ROW_CHROME + (compact ? 0 : LEGEND_CHEVRON));
  return <PressFeedback feedback="highlight" accessibilityRole="button"
    accessibilityLabel={spoken}
    accessibilityHint={i18n.t('reports.chart.categoryHint')}
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

/** The fixed parts of a legend row beyond a list row's (ROW_CHROME): its chevron and the gap before it. */
const LEGEND_CHEVRON = 15 + 12;

/** Whether a category row puts its amount (and share) under the name (24UX6C2): at large text, when the amount alone is
 * too wide for its column, or when the name and the amount cannot share one line on this screen. Stacking is preferred
 * to wrapping the name into a stray last letter («Supermercad / o») or shrinking the money. */
export function useCategoryRowStacks(name: string, minor: number, currency: Currency, chrome = ROW_CHROME + LEGEND_CHEVRON): boolean {
  const { fontScale, width } = useWindowDimensions();
  const { locale } = useI18n();
  const amountStacks = useStacked({ minor, currency });
  return amountStacks || labelAmountStacks(width, fontScale, name, rowAmountText(minor, currency, false, locale), chrome);
}

/** Legend row for the donut: the category tile carries the slice's hue, so the row needs no swatch. 24UX6C2: a category
 * chosen on the donut is marked here too, never by colour alone: a bold name, a 1.5 pt outline in the category's hue
 * and the selected state for VoiceOver. 24T3 (A24): `totalMinor` is the positive categories' sum (the donut's base), and
 * a category at zero or less reads «Sin gasto neto» instead of a share (`categoryShare`); `countLabel` names its
 * purchases and devoluciones. */
export function CategoryLegendRow({ category, totalMinor, currency, onPress, last = false, chosen = false, countLabel }: {
  category: CategorySpending; totalMinor: number; currency: Currency; onPress: () => void; last?: boolean; chosen?: boolean; countLabel?: string;
}) {
  const p = usePalette();
  const i18n = useI18n();
  const { t } = i18n;
  const look = useCategoryLook(category.category);
  const name = look.label;
  const count = countLabel ?? t('count.expenses', { count: category.count });
  const { label, spoken } = categoryShare(category, totalMinor, currency, count, i18n, name);
  const stacked = useCategoryRowStacks(name, category.amountMinor, currency);
  return <PressFeedback feedback="highlight" accessibilityRole="button" accessibilityState={{ selected: chosen }}
    accessibilityLabel={spoken}
    accessibilityHint={t('reports.chart.categoryHint')}
    onPress={onPress} style={[{ paddingHorizontal: 16, paddingVertical: 12, minHeight: 60, flexDirection: 'row', gap: 12, alignItems: 'center',
      borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth, borderBottomColor: p.line },
      chosen ? { borderWidth: 1.5, borderColor: look.hex, borderBottomWidth: 1.5, borderBottomColor: look.hex, borderRadius: 14, backgroundColor: look.hex + '14' } : null]}>
    <CategoryBadge category={category.category} />
    <View style={{ flex: 1, minWidth: 0, gap: 8, flexDirection: stacked ? 'column' : 'row', alignItems: stacked ? 'flex-start' : 'center' }}>
      <View style={{ flex: stacked ? undefined : 1, minWidth: 0, gap: 3 }}>
        <AppText numberOfLines={stacked ? undefined : 2} style={{ fontWeight: chosen ? '700' : '500' }}>{name}</AppText>
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
