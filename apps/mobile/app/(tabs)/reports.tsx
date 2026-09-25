import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { FlatList, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { dailyAverageMinor, dailySpending, monthlySpendingTrend, spendingComparison, spendingInsights, spendingReport,
  summarizeMonthlyBudgets, topMerchants, type CategorySpending, type Currency, type DailySpending, type Entry, type SpendingInsight } from '@finanzapp/domain';
import { useLedger } from '../../src/storage/LedgerProvider';
import { budgetTone, percentUsed } from '../../src/ui/budget-presentation';
import { AppText, CategoryBadge, Choices, DetailRow, EmptyState, GlyphTile, IconButton, Money, NavigationRow, PressFeedback, SectionTitle, Surface, useStacked } from '../../src/ui/components';
import { withCurrencyCode } from '../../src/i18n/format';
import { CurrencySwitch } from '../../src/ui/currency-switch';
import { useDisplayCurrency } from '../../src/ui/display-currency-provider';
import { displayCurrencyForRoute } from '../../src/ui/display-currency';
import { useI18n } from '../../src/i18n/provider';
import type { Translate } from '../../src/i18n/messages';
import { useCategoryColor, useCategoryLookOf } from '../../src/ui/category-hues';
import { DonutChart, MonthBars, OTHERS_KEY, donutSlices } from '../../src/ui/charts';
import { ValueTransition, selectionHaptic } from '../../src/ui/motion';
import { activityDateLabel, availableCurrencies } from '../../src/ui/presentation';
import { changePercent, reportPeriodLabel, reportSelection, shiftReportMonth } from '../../src/ui/report-presentation';
import { CategoryLegendRow } from '../../src/ui/spending-chart';
import { space, useCurrentDay, usePalette } from '../../src/ui/theme';

/** Reportes answers "¿a dónde fue mi plata?" for one month and one currency:
 * total and daily average, six-month trend, category donut with legend, day by
 * day, budgets, top merchants and factual insights. Every number is recorded
 * spending in that currency; nothing is estimated or converted. */
export default function ReportsScreen() {
  const params = useLocalSearchParams<{ currency?: string | string[]; month?: string | string[] }>();
  const { snapshot, archive } = useLedger();
  const p = usePalette();
  const { t, locale, formatMonth, formatDayMonth, moneyText, spokenMoney } = useI18n();
  const day = useCurrentDay();
  const [monthOverride, setMonth] = useState<string>();
  const [view, setView] = useState<'categories' | 'days'>('categories');
  // The display currency Reportes shares with Inicio (24B6). A route that names a currency an account holds shows it and
  // makes it the shared choice (once, when the parameter arrives); an unknown or unheld one is ignored and the choice stands.
  const held = useMemo(() => availableCurrencies(snapshot?.accounts ?? []), [snapshot?.accounts]);
  const { currency: shared, preferred, setCurrency } = useDisplayCurrency(held);
  const route = displayCurrencyForRoute(snapshot?.accounts ?? [], params.currency, preferred);
  const [applied, setApplied] = useState<unknown>();
  useEffect(() => { if (route.apply) { setCurrency(route.apply); setApplied(params.currency); } }, [params.currency, snapshot === null]);
  // The frame the parameter arrives already shows its currency; from then on the shared choice (the switch changes it).
  const shownCurrency: Currency = route.apply && applied !== params.currency ? route.apply : shared;
  const selection = useMemo(() => snapshot ? reportSelection(snapshot, shownCurrency, monthOverride ?? params.month, day) : null,
    [snapshot, shownCurrency, monthOverride, params.month, day]);
  const report = useMemo(() => snapshot && selection ? spendingReport(snapshot, selection.currency, selection.monthISO, day) : null,
    [snapshot, selection, day]);
  // One function per locale and currency, so the insights below recompute when either changes and only then.
  const money = useMemo(() => (minor: number) => moneyText(minor, selection?.currency ?? 'ARS'), [moneyText, selection?.currency]);
  const spoken = (minor: number) => spokenMoney(minor, selection?.currency ?? 'ARS');
  const lookOf = useCategoryLookOf('expense');
  const trend = useMemo(() => {
    if (!snapshot || !selection) return [];
    try { return monthlySpendingTrend(snapshot, selection.currency, selection.monthISO, day, 6); } catch { return []; }
  }, [snapshot, selection, day]);
  const comparison = useMemo(() => {
    if (!snapshot || !selection) return null;
    try { return spendingComparison(snapshot, selection.currency, selection.monthISO, day); } catch { return null; }
  }, [snapshot, selection, day]);
  const budgets = useMemo(() => {
    if (!snapshot || !selection) return null;
    try { return summarizeMonthlyBudgets(snapshot, archive?.budgets ?? [], selection.currency, selection.monthISO); } catch { return null; }
  }, [snapshot, archive?.budgets, selection]);
  const merchants = useMemo(() => report && report.status === 'ready' && snapshot ? topMerchants(snapshot, report, 5) : [], [snapshot, report]);
  const insights = useMemo(() => {
    if (!snapshot || !selection || !report || report.status !== 'ready') return [];
    return spendingInsights(snapshot, archive?.budgets ?? [], selection.currency, selection.monthISO, day, money);
  }, [snapshot, archive?.budgets, selection, report, day, money]);
  if (!snapshot || !report || !selection) return null;
  const insightText = (insight: SpendingInsight) => localizedInsight(insight, { t, money, dayMonth: formatDayMonth, label: key => lookOf(key).label, budgets, comparison, entries: snapshot.entries });

  const ready = report.status === 'ready';
  const rows: (CategorySpending | DailySpending)[] = view === 'categories' ? report.categories : ready ? dailySpending(snapshot, report) : [];
  const { currency, currencies, monthISO, earliestMonth, currentMonth } = selection;
  const canPrevious = monthISO > earliestMonth;
  const canNext = monthISO < currentMonth;
  const slices = donutSlices(report.categories.map(category => ({ key: category.key, label: lookOf(category.category).label, value: category.amountMinor })), p, key => lookOf(key).hex, t('reports.others'));
  const goToMonth = (month: string | undefined) => { selectionHaptic(); setMonth(month); };
  const average = ready ? dailyAverageMinor(report.expenseMinor, report) : 0;
  const delta = comparison && comparison.status === 'ready' && comparison.previous?.status === 'ready' && comparison.deltaMinor !== null
    ? { minor: comparison.deltaMinor, percent: changePercent(comparison.deltaMinor, comparison.previous.expenseMinor, locale), mode: comparison.mode } : null;
  const deltaText = delta && (() => {
    const reference = t(delta.mode === 'matching-days' ? 'reports.delta.matchingDays' : 'reports.delta.previousMonth');
    return delta.minor === 0 ? t('reports.delta.same', { reference })
      : t(delta.minor > 0 ? 'reports.delta.more' : 'reports.delta.less', { percent: delta.percent, reference });
  })();

  return <FlatList<CategorySpending | DailySpending> data={rows} keyExtractor={item => 'key' in item ? item.key : item.dateISO}
    style={{ flex: 1, backgroundColor: p.background }}
    contentContainerStyle={{ padding: space.xl, paddingBottom: 48, flexGrow: 1 }}
    contentInsetAdjustmentBehavior="automatic" removeClippedSubviews={false}
    initialNumToRender={10} maxToRenderPerBatch={10} windowSize={7}
    ListHeaderComponent={<View style={{ gap: space.xxl, paddingBottom: space.m }}>
      <View style={{ gap: space.m }}>
        {currencies.length > 1 && <CurrencySwitch value={currency} currencies={currencies} onChange={setCurrency} />}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <IconButton name="chevron-back" label={t('reports.previousMonth')} disabled={!canPrevious}
            onPress={() => { if (canPrevious) goToMonth(shiftReportMonth(monthISO, -1)); }} />
          <ValueTransition id={monthISO + '|' + currency} variant="fade" style={{ flex: 1, alignItems: 'center', gap: 2 }}>
            <AppText accessibilityRole="header" variant="title3" style={{ textTransform: 'capitalize', textAlign: 'center' }}>{formatMonth(monthISO)}</AppText>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <AppText secondary variant="caption">{reportPeriodLabel(report, day, t)}</AppText>
              {canNext && <PressFeedback feedback="opacity" accessibilityRole="button" onPress={() => goToMonth(currentMonth)} accessibilityLabel={t('reports.backToCurrentMonth')} style={{ minHeight: 28 }}>
                <AppText variant="caption" style={{ fontWeight: '600', color: p.primary }}>{t('reports.thisMonth')}</AppText>
              </PressFeedback>}
            </View>
          </ValueTransition>
          <IconButton name="chevron-forward" label={t('reports.nextMonth')} disabled={!canNext}
            onPress={() => { if (canNext) goToMonth(shiftReportMonth(monthISO, 1)); }} />
        </View>
      </View>

      {ready ? <>
        <ValueTransition id={monthISO + '|' + currency} style={{ gap: 8 }}>
          <AppText secondary variant="eyebrow">{withCurrencyCode(t('reports.spent'), currency)}</AppText>
          <Money minor={report.expenseMinor} currency={currency} large />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
            <AppText secondary variant="subhead">{report.count === 0 ? t('reports.noRecords') : t('reports.perDay', { amount: money(average) })}</AppText>
            {delta && <>
              <AppText secondary variant="subhead">·</AppText>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <Ionicons name={delta.minor > 0 ? 'trending-up-outline' : delta.minor < 0 ? 'trending-down-outline' : 'remove-outline'} size={15} color={p.secondary} accessible={false} />
                <AppText secondary variant="subhead">{deltaText}</AppText>
              </View>
            </>}
          </View>
        </ValueTransition>

        {trend.length > 0 && trend.some(point => point.amountMinor > 0) && <Surface style={{ gap: 12 }}>
          <AppText secondary variant="caption" style={{ fontWeight: '500' }}>{t('reports.lastSixMonths')}</AppText>
          <MonthBars points={trend} selected={monthISO} onSelect={month => { if (month !== monthISO) goToMonth(month === currentMonth ? undefined : month); }} currency={currency} />
        </Surface>}

        <Choices value={view} onChange={setView} options={[{ value: 'categories', label: t('reports.viewCategories') }, { value: 'days', label: t('reports.viewDays') }]} />

        {view === 'categories' && report.categories.length > 0 && <View style={{ alignItems: 'center', gap: space.m }}>
          <DonutChart slices={slices} total={report.expenseMinor} currency={currency} caption={t('reports.periodTotal')} />
          {slices.some(slice => slice.key === OTHERS_KEY) && <AppText tertiary variant="caption">{t('reports.othersNote')}</AppText>}
        </View>}
        {view === 'days' && rows.length > 0 && <AppText secondary variant="footnote" style={{ paddingHorizontal: 4 }}>{t('reports.daysNote')}</AppText>}
      </> : <EmptyState title={t('reports.outOfRangeTitle')} icon="calculator-outline"
        detail={t('reports.outOfRangeDetail')} />}
    </View>}
    renderItem={({ item, index }) => <View style={{ backgroundColor: p.surface, overflow: 'hidden',
      borderTopLeftRadius: index === 0 ? 16 : 0, borderTopRightRadius: index === 0 ? 16 : 0,
      borderBottomLeftRadius: index === rows.length - 1 ? 16 : 0, borderBottomRightRadius: index === rows.length - 1 ? 16 : 0 }}>
      {'key' in item ? <CategoryLegendRow category={item} totalMinor={ready ? report.expenseMinor : 0}
        currency={currency} last={index === report.categories.length - 1}
        onPress={() => router.push({ pathname: '/report-category', params: { currency, month: monthISO, category: item.key } })} />
        : <DetailRow label={t('reports.dayRow', { date: activityDateLabel(item.dateISO, day, locale), count: t('count.expenses', { count: item.count }) })}
          value={money(item.amountMinor)} spokenValue={spoken(item.amountMinor)} last={index === rows.length - 1}
          onPress={() => router.push({ pathname: '/report-day', params: { currency, date: item.dateISO } })} />}
    </View>}
    ListEmptyComponent={ready ? <EmptyState title={t('reports.emptyTitle')} icon="pie-chart-outline"
      detail={t('reports.emptyDetail')} /> : null}
    ListFooterComponent={<View style={{ gap: space.xxl, paddingTop: space.xxl }}>
      {ready && budgets && (budgets.total || budgets.rows.length > 0) && <View>
        <SectionTitle action={t('reports.budgets.manage')} onAction={() => router.push({ pathname: '/budgets', params: { currency, month: monthISO } })}>{t('reports.budgets.title')}</SectionTitle>
        <Surface grouped>
          {/* The month's ceiling first (all recorded expenses), then the category sublimits. */}
          {budgets.total && <BudgetStatusRow category={t('reports.budgets.general')} spent={budgets.total.spentMinor} limit={budgets.total.budget.amountMinor}
            progress={budgets.total} money={money} spoken={spoken} last={budgets.rows.length === 0}
            onPress={() => router.push({ pathname: '/edit-budget/[id]', params: { id: budgets.total!.budget.id } })} />}
          {budgets.rows.map((row, index) => <BudgetStatusRow key={row.budget.id} category={lookOf(row.budget.category).label} spent={row.spentMinor} limit={row.budget.amountMinor}
            progress={row} money={money} spoken={spoken} last={index === budgets.rows.length - 1}
            onPress={() => router.push({ pathname: '/edit-budget/[id]', params: { id: row.budget.id } })} />)}
        </Surface>
      </View>}
      {ready && merchants.length > 0 && <View>
        <SectionTitle caption={t('reports.merchants.caption')}>{t('reports.merchants.title')}</SectionTitle>
        <Surface grouped>
          {/* Rank stays a number; the tile carries the merchant's category, the one identity it really has. No decorative podium colours. */}
          {merchants.map((merchant, index) => <View key={merchant.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, minHeight: 64,
            borderBottomWidth: index === merchants.length - 1 ? 0 : 0.5, borderBottomColor: p.line }}>
            <AppText tertiary variant="footnote" style={{ width: 16, textAlign: 'center', fontVariant: ['tabular-nums'], fontWeight: '600' }}>{index + 1}</AppText>
            <CategoryBadge category={merchant.category} />
            <MerchantCells merchant={merchant} currency={currency} label={lookOf(merchant.category).label} />
          </View>)}
        </Surface>
      </View>}
      {ready && insights.length > 0 && <View>
        <SectionTitle caption={t('reports.insights.caption')}>{t('reports.insights.title')}</SectionTitle>
        <View style={{ gap: 10 }}>
          {/* A fact about a category looks like that category; a warning or excess keeps its semantic tone. The surface takes only a whisper (8 %) of the colour so the text stays fully readable. */}
          {insights.map(insight => ({ ...insight, ...insightText(insight) })).map(insight => <InsightSurface key={insight.id} tone={insight.tone} category={insight.category}>
            {insight.category && insight.tone === 'neutral' ? <CategoryBadge category={insight.category} />
              : <GlyphTile icon={insight.tone === 'expense' ? 'alert-circle-outline' : insight.tone === 'warning' ? 'speedometer-outline' : insight.id.startsWith('largest') ? 'receipt-outline' : 'trending-up-outline'}
                tone={insight.tone} />}
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <AppText style={{ fontWeight: '500' }}>{insight.title}</AppText>
              <AppText secondary variant="footnote">{insight.detail}</AppText>
            </View>
          </InsightSurface>)}
        </View>
      </View>}
      {ready && <Surface grouped>
        <DetailRow label={t('reports.incomeRecorded')} value={money(report.incomeMinor)} spokenValue={spoken(report.incomeMinor)} icon="add-circle-outline" />
        <DetailRow label={t('reports.netFlow')} value={money(report.incomeMinor - report.expenseMinor)} spokenValue={spoken(report.incomeMinor - report.expenseMinor)} icon="swap-vertical-outline" />
        <NavigationRow title={t('reports.compare')} subtitle={t('reports.compareSubtitle')} icon="git-compare-outline" last
          onPress={() => router.push({ pathname: '/report-comparison', params: { currency, month: monthISO } })} />
      </Surface>}
      <AppText tertiary variant="footnote" style={{ paddingHorizontal: 4 }}>
        {t('reports.footer', { currency })}
      </AppText>
    </View>} />;
}

/** The insight card's surface: a category fact takes the category hue, an
 * expense or warning fact its semantic colour, both at 8 % so the ink keeps
 * its contrast; a plain fact stays on the neutral surface. */
function InsightSurface({ tone, category, children }: { tone: SpendingInsight['tone']; category?: string; children: ReactNode }) {
  const p = usePalette();
  const hue = useCategoryColor(category ?? '');
  const color = tone === 'expense' ? p.expense : tone === 'warning' ? p.warning : tone === 'income' ? p.income : category ? hue : null;
  return <Surface style={[{ flexDirection: 'row', alignItems: 'center', gap: 12 }, color ? { backgroundColor: color + '14' } : null]}>{children}</Surface>;
}

function BudgetStatusRow({ category, spent, limit, progress, money, spoken, last, onPress }: {
  category: string; spent: number; limit: number; progress: { ratio: number; exceeded: boolean }; money: (minor: number) => string; spoken: (minor: number) => string; last: boolean; onPress: () => void;
}) {
  const p = usePalette();
  const { t } = useI18n();
  const { ratio, exceeded } = progress;
  const tone = budgetTone(progress);
  const color = tone === 'expense' ? p.expense : tone === 'warning' ? p.warning : p.text;
  const percent = percentUsed(progress);
  return <PressFeedback feedback="highlight" accessibilityRole="button" accessibilityLabel={t(exceeded ? 'reports.budgets.labelExceeded' : 'reports.budgets.label', { category, spent: spoken(spent), limit: spoken(limit), percent })}
    onPress={onPress} style={{ paddingHorizontal: 16, paddingVertical: 12, gap: 8, borderBottomWidth: last ? 0 : 0.5, borderBottomColor: p.line }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <AppText numberOfLines={2} style={{ fontWeight: '500' }}>{category}</AppText>
        <AppText secondary variant="footnote" style={{ fontVariant: ['tabular-nums'] }}>{t('reports.budgets.progress', { spent: money(spent), limit: money(limit) })}</AppText>
      </View>
      <AppText variant="footnote" style={{ textAlign: 'right', fontWeight: '600', color, fontVariant: ['tabular-nums'] }}>{t('reports.budgets.percent', { percent })}</AppText>
    </View>
    <View accessible={false} style={{ height: 4, borderRadius: 2, backgroundColor: p.inset, overflow: 'hidden' }}>
      <View style={{ width: `${Math.min(100, Math.max(ratio > 0 ? 1.5 : 0, ratio * 100))}%`, height: 4, backgroundColor: color }} />
    </View>
  </PressFeedback>;
}

/** Name and category beside the amount, or the amount under them when the row is narrow for it or the text is large. */
function MerchantCells({ merchant, currency, label }: { merchant: { merchant: string; count: number; amountMinor: number }; currency: Currency; label: string }) {
  const { t } = useI18n();
  const stacked = useStacked({ minor: merchant.amountMinor, currency });
  return <View style={{ flex: 1, minWidth: 0, gap: 8, flexDirection: stacked ? 'column' : 'row', alignItems: stacked ? 'flex-start' : 'center' }}>
    <View style={{ flex: stacked ? undefined : 1, minWidth: 0, gap: 3 }}>
      <AppText numberOfLines={stacked ? undefined : 2} style={{ fontWeight: '500' }}>{merchant.merchant}</AppText>
      <AppText secondary variant="footnote" numberOfLines={stacked ? undefined : 2}>{t('reports.merchants.purchases', { count: merchant.count })} · {label}</AppText>
    </View>
    <View style={{ maxWidth: stacked ? '100%' : '56%', alignItems: stacked ? 'flex-start' : 'flex-end' }}><Money minor={merchant.amountMinor} currency={currency} /></View>
  </View>;
}

type InsightSources = {
  t: Translate; money: (minor: number) => string; dayMonth: (dateISO: string) => string; label: (category: string) => string;
  budgets: ReturnType<typeof summarizeMonthlyBudgets> | null; comparison: ReturnType<typeof spendingComparison> | null; entries: Entry[];
};

/** The words of a domain insight in the interface language. The domain states
 * the fact in Spanish; its id names the kind and the record it is about, so
 * the screen rebuilds the sentence from the same records, with the built-in
 * category's localized name. A fact it cannot trace keeps the domain's text. */
function localizedInsight(insight: SpendingInsight, { t, money, dayMonth, label, budgets, comparison, entries }: InsightSources): { title: string; detail: string } {
  const [kind, ...rest] = insight.id.split(':');
  const id = rest.join(':');
  if (kind === 'over' || kind === 'near') {
    const total = budgets?.total?.budget.id === id ? budgets.total : null;
    const row = total ?? budgets?.rows.find(item => item.budget.id === id);
    if (!row) return insight;
    const category = label(row.budget.category ?? '');
    const limit = money(row.budget.amountMinor);
    return kind === 'over'
      ? { title: total ? t('reports.insights.overTotal') : t('reports.insights.overCategory', { category }), detail: t('reports.insights.overDetail', { amount: money(-row.remainingMinor), limit }) }
      : { title: total ? t('reports.insights.nearTotal') : t('reports.insights.nearCategory', { category }), detail: t('reports.insights.nearDetail', { amount: money(row.remainingMinor), limit }) };
  }
  if (kind === 'largest') {
    const entry = entries.find(item => item.id === id);
    if (!entry) return insight;
    // The day in the region's order: "22/09" in Argentina (the domain's own text), "9/22" in the United States.
    return { title: t('reports.insights.largest', { merchant: entry.merchant }),
      detail: t('reports.insights.largestDetail', { amount: money(entry.amountMinor), category: label(entry.category), date: dayMonth(entry.dateISO) }) };
  }
  if (kind === 'growth') {
    const change = comparison?.categories.find(item => item.key === id);
    if (!change || !comparison) return insight;
    return { title: t('reports.insights.growth', { category: label(change.category), amount: money(change.deltaMinor) }),
      detail: t(comparison.mode === 'matching-days' ? 'reports.insights.growthMatchingDays' : 'reports.insights.growthFullMonth') };
  }
  return insight;
}
