import { useEffect, useRef } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { formatMinorUnits, type Account, type CategorySpending, type Currency, type MonthlyBudgetSummary, type RecurringRule } from '@finanzapp/domain';
import { AppText, CategoryBadge, Money, PressFeedback, Surface, useStacked } from './components';
import { budgetHomeHeadline, budgetTone, categoriesStatus, percentUsed } from './budget-presentation';
import { washOf } from './category-color';
import { useCategoryLook } from './category-hues';
import { easeOut, timing } from './motion';
import { spendingShare } from './report-presentation';
import { usePalette, useReduceMotion } from './theme';
import { useI18n } from '../i18n/provider';

/** Contextual help for a metric: one native alert with the definition, so the
 * screen itself carries no disclaimer copy. */
export function MetricHelp({ title, detail }: { title: string; detail: string }) {
  const p = usePalette();
  const { t } = useI18n();
  return <PressFeedback feedback="opacity" accessibilityRole="button" accessibilityLabel={t('common.whatIs', { title })} hitSlop={8}
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

/** The biggest categories this month as one quiet distribution. Each row sits
 * on the grouped surface; behind its content a rounded wash of its own hue,
 * inset from the row's edges, runs from the left for exactly its share of the
 * month. The wash is faint (a tenth of the hue) so three rows read as three
 * rows, not a block of colour, and the largest category is a soft highlight
 * rather than a filled bar. The category is one object (glyph on its hue), the
 * amount sits right; no percentages, no bar under the row. Reportes has the
 * full picture. Washes are absolute, childless and behind the content, so
 * the animation costs no layout and never blocks a tap. */
export function CategoryRanking({ categories, totalMinor, currency, limit = 3, onPressCategory }: {
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
  const { t } = useI18n();
  const { hex: color, label: name } = useCategoryLook(category.category);
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
  const stacked = useStacked({ minor: category.amountMinor, currency });
  return <PressFeedback feedback="highlight" accessibilityRole="button" accessibilityHint={t('home.rankingHint')}
    accessibilityLabel={t('home.rankingLabel', { name, amount: formatMinorUnits(category.amountMinor) + ' ' + currency, share: label })}
    onPress={onPress} style={[styles.row, last && styles.rowLast]}
    backdrop={<View pointerEvents="none" accessible={false} style={styles.fillTrack}>
      <Animated.View style={[styles.fill, { backgroundColor: washOf(color, p) }, fill]} />
    </View>}>
    <CategoryBadge category={category.category} />
    <View style={{ flex: 1, minWidth: 0, flexDirection: stacked ? 'column' : 'row', gap: stacked ? 2 : 12, alignItems: stacked ? 'flex-start' : 'center' }}>
      <AppText numberOfLines={stacked ? undefined : 2} style={{ flex: stacked ? undefined : 1, minWidth: 0, fontWeight: '500' }}>{name}</AppText>
      <Money minor={category.amountMinor} currency={currency} />
    </View>
  </PressFeedback>;
}

/** One line of budget truth for the current month. With a total budget it
 * answers "how much of my month have I used": what is left of the ceiling,
 * the share used, and whether any sublimit is over. Without one, the tightest
 * category sublimit stands in, with the count of sublimits beside it. Sublimits
 * are never added up into a monthly total. Tapping opens Presupuestos. */
export function BudgetHomeCard({ summary }: { summary: MonthlyBudgetSummary }) {
  const p = usePalette();
  const reduced = useReduceMotion();
  const { t } = useI18n();
  const headline = budgetHomeHeadline(summary);
  const { currency } = summary;
  const progressValue = headline ? Math.min(1, headline.progress.ratio) : 0;
  const progress = useSharedValue(progressValue);
  useEffect(() => { progress.value = withTiming(progressValue, timing('data', reduced)); }, [progressValue, reduced, progress]);
  const bar = useAnimatedStyle(() => ({ width: `${progress.value === 0 ? 0 : Math.max(1.5, progress.value * 100)}%` as `${number}%` }));
  // Resolved before the early return so the hook order is stable while the card appears and disappears.
  const categoryLabel = useCategoryLook(headline?.kind === 'category' ? headline.progress.budget.category ?? '' : '').label;
  if (!headline) return null;
  const { remainingMinor: remaining, budget } = headline.progress;
  const tone = budgetTone(headline.progress);
  const color = tone === 'expense' ? p.expense : tone === 'warning' ? p.warning : p.text;
  const title = headline.kind === 'total' ? t('home.budget.general') : categoryLabel;
  const percent = percentUsed(headline.progress);
  const status = headline.kind === 'total' ? categoriesStatus(headline.categories, headline.exceededCategories, t)
    : headline.categories > 1 ? t('home.budget.categories', { count: headline.categories })
      + (headline.exceededCategories ? ' · ' + t('home.budget.exceededCount', { count: headline.exceededCategories }) : '') : t('home.budget.perCategory');
  const symbol = currency === 'USD' ? 'US$ ' : '$ ';
  const spoken = t(remaining < 0 ? 'home.budget.labelExceeded' : 'home.budget.labelLeft',
    { title, amount: formatMinorUnits(Math.abs(remaining)) + ' ' + currency, total: formatMinorUnits(budget.amountMinor), percent });
  return <PressFeedback accessibilityRole="button"
    accessibilityLabel={spoken + (status ? ' ' + status : '')}
    onPress={() => router.push({ pathname: '/budgets', params: { currency } })}>
    <Surface style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <AppText secondary variant="caption" numberOfLines={2} style={{ fontWeight: '500' }}>{title} · {remaining < 0 ? t('home.budget.exceeded') : t('home.budget.left')}</AppText>
          <Money minor={Math.abs(remaining)} currency={currency} size={24} weight="700" color={color} />
        </View>
        <View style={{ alignItems: 'flex-end', gap: 2, flexShrink: 1, maxWidth: '50%' }}>
          <AppText secondary variant="caption" style={{ textAlign: 'right' }}>{t('home.budget.of', { amount: symbol + formatMinorUnits(budget.amountMinor), percent })}</AppText>
          {!!status && <AppText variant="footnote" style={{ color: headline.exceededCategories ? p.expense : p.secondary, fontWeight: headline.exceededCategories ? '600' : '400' }}>{status}</AppText>}
        </View>
      </View>
      <View accessible={false} style={{ height: 6, borderRadius: 3, overflow: 'hidden', backgroundColor: p.inset }}>
        <Animated.View style={[{ height: 6, borderRadius: 3, backgroundColor: color }, bar]} />
      </View>
    </Surface>
  </PressFeedback>;
}

export function UpcomingRecurringRow({ rule, account, day, last }: {
  rule: RecurringRule; account: Account; day: string; last: boolean;
}) {
  const p = usePalette();
  const { t, relativeDate } = useI18n();
  const stacked = useStacked({ minor: rule.amountMinor, currency: account.currency });
  const date = relativeDate(rule.nextDateISO, day);
  const days = Math.round((Date.parse(rule.nextDateISO + 'T12:00:00Z') - Date.parse(day + 'T12:00:00Z')) / 86400000);
  const when = days === 0 ? t('home.upcomingRow.today') : days === 1 ? t('home.upcomingRow.tomorrow') : t('home.upcomingRow.inDays', { count: days });
  return <PressFeedback feedback="highlight" accessibilityRole="button"
    accessibilityLabel={t('home.upcomingRow.label', { merchant: rule.merchant, amount: formatMinorUnits(rule.amountMinor) + ' ' + account.currency, date })}
    onPress={() => router.push({ pathname: '/edit-recurring/[id]', params: { id: rule.id } })}
    style={[styles.row, { borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth, borderBottomColor: p.line }]}>
    <CategoryBadge category={rule.category} kind={rule.kind} />
    <View style={{ flex: 1, minWidth: 0, gap: 8, flexDirection: stacked ? 'column' : 'row', alignItems: stacked ? 'flex-start' : 'center' }}>
      <View style={{ flex: stacked ? undefined : 1, minWidth: 0, gap: 3 }}>
        <AppText numberOfLines={stacked ? undefined : 2} style={{ fontWeight: '500' }}>{rule.merchant}</AppText>
        <AppText secondary variant="footnote" numberOfLines={stacked ? undefined : 2}>{date} · {account.name}</AppText>
      </View>
      <View style={{ alignItems: stacked ? 'flex-start' : 'flex-end', gap: 3, maxWidth: stacked ? '100%' : '56%' }}>
        <Money minor={rule.amountMinor} currency={account.currency} />
        <AppText variant="caption" style={{ color: days <= 1 ? p.warning : p.secondary, fontWeight: days <= 1 ? '600' : '400' }}>{when}</AppText>
      </View>
    </View>
  </PressFeedback>;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 16, minHeight: 64 },
  rowLast: { paddingBottom: 12 },
  // The wash lives in a track inset from the row, so it is a rounded shape of its own, never cut by the surface's edges or a separator.
  fillTrack: { position: 'absolute', left: 6, right: 6, top: 5, bottom: 5 },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 12 },
});
