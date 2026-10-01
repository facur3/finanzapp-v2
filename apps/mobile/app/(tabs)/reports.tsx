import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { FlatList, StyleSheet, View, useWindowDimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { dailySpending, monthlySpendingTrend, shiftMonthISO, spendingComparison, spendingInsights, spendingReport,
  summarizeMonthlyBudgets, topMerchants, type CategorySpending, type Currency, type DailySpending, type Entry, type SpendingInsight } from '@finanzapp/domain';
import { useLedger } from '../../src/storage/LedgerProvider';
import { budgetScope, budgetTone, percentUsed } from '../../src/ui/budget-presentation';
import { AppText, CategoryBadge, Choices, DetailRow, EmptyState, GlyphTile, IconButton, InfoButton, Money, NavigationRow, PressFeedback, SectionTitle, Surface, useStacked } from '../../src/ui/components';
import { withCurrencyCode } from '../../src/i18n/format';
import { DisplayCurrencyButton } from '../../src/ui/currency-switch';
import { useFinanceView } from '../../src/fx/rates-provider';
import { spendingFigure } from '../../src/fx/finance-view';
import { reportInfo, shortfallDetail } from '../../src/fx/fx-copy';
import { monthsEnding } from '../../src/fx/rates-store';
import { CurrencyParts } from '../../src/ui/home-modules';
import { useDisplayCurrency } from '../../src/ui/display-currency-provider';
import { displayCurrencyForRoute } from '../../src/ui/display-currency';
import { useI18n } from '../../src/i18n/provider';
import type { Translate } from '../../src/i18n/messages';
import { useCategoryColor, useCategoryLookOf } from '../../src/ui/category-hues';
import { DonutChart, MONEY_MAX_SCALE, MonthBars, OTHERS_KEY, donutSlices } from '../../src/ui/charts';
import { amountWidthEm } from '../../src/ui/geometry';
import { ValueTransition, selectionHaptic } from '../../src/ui/motion';
import { activityDateLabel, historyCurrencies } from '../../src/ui/presentation';
import { changePercent, earliestRecordedMonth, insightsBesideRanking, reportPeriodLabel, reportSelection, requestedReportMonth, shiftReportMonth, spendingShare } from '../../src/ui/report-presentation';
import { CategoryLegendRow } from '../../src/ui/spending-chart';
import { space, useCurrentDay, usePalette, useReduceMotion } from '../../src/ui/theme';

/** Reportes answers "¿a dónde fue mi plata?" for one month and one currency. Every number is recorded spending in that
 * currency; nothing is estimated.
 *
 * Reading order (Producto 24UX6B, the Forest hierarchy of decision 005, recomposed in 24UX6D): the scope and the period
 * (the currency chip with more than one currency, the month and its arrows: Reportes is where past months live, Inicio
 * shows only the current one); then the analysis of that month, categories first or day by day, switched by one segmented
 * control; then the history («Evolución», the last six months, whose bars still open a month); and last the details:
 * budgets, the top merchants, the factual insights, income, net flow and the change against last month, and the
 * comparison. With a single month of history the trend is one quiet line instead of a lone bar. Red stays an alert (a
 * budget exceeded); ordinary spending is ink.
 *
 * 24UX6D: there is no «Gastado · ARS» KPI above the analysis any more, nor its daily average. In Categorías the period's
 * total is the donut's centre («Total del período» over the exact amount, the report's own figure) and the donut is the
 * head of the screen, right under the segmented control, then the category rows. In Día a día, which has no donut, the
 * total is one compact line under the control. The change against last month moved from the KPI's line to a row of the
 * lower facts, beside «Comparar con el mes anterior», which still opens the full comparison. The currency is named on the
 * period line when no chip names it.
 *
 * 24UX5: what the report counts (one currency, no opening balances, transfers or card payments; a month without
 * records is not a month without spending) is one tap away (since 24UX6D beside the period line, in every ready state,
 * empty months included) instead of a permanent paragraph at the end, and an insight that repeats a ranking row right
 * above it is left out (`insightsBesideRanking`).
 *
 * 24C1: Reportes reads the same display mode and currency as Inicio. Consolidated, every figure (total, average,
 * trend, donut, categories, days, budgets, merchants, insights, comparison) comes from one ledger in which each
 * movement was converted with the rate of its own date, so a September total never uses today's rate and every part
 * adds up to the total. A month with a movement that has no rate shows each currency's subtotal instead of a total;
 * the trend and the comparison appear only when every month they cover is complete. Budgets are the exception by
 * design (24C1 review): a budget keeps its currency and is measured on the real ledger against the accounts in that
 * currency, never against the converted total; consolidated, the section names the currency it shows. */
export default function ReportsScreen() {
  const params = useLocalSearchParams<{ currency?: string | string[]; month?: string | string[] }>();
  const { snapshot, archive, gate } = useLedger();
  const p = usePalette();
  const { t, locale, formatMonthTitle, formatDayMonth, formatNumericDate, currencyName, moneyText, spokenMoney, spokenPercent, speechLanguage } = useI18n();
  const day = useCurrentDay();
  const { width: windowWidth, fontScale } = useWindowDimensions();
  const [monthOverride, setMonth] = useState<string>();
  const [tab, setTab] = useState<'categories' | 'days'>('categories');
  // 24UX6C2: the category chosen on the donut, for the month and currency it was chosen in (a new month starts with none).
  const [chosen, setChosen] = useState<{ scope: string; key: string } | null>(null);
  const reduced = useReduceMotion();
  // The history sits under the analysis (24UX6B): a bar that opens another month brings that month's title and total into view.
  const list = useRef<FlatList<CategorySpending | DailySpending>>(null);
  // The display currency Reportes shares with Inicio (24B6). A route that names a currency an account holds shows it and
  // makes it the shared choice (once, when the parameter arrives); an unknown or unheld one is ignored and the choice stands.
  // Every currency the ledger ever held (25B2 review): a month's report keeps a deleted account's movements.
  const held = useMemo(() => historyCurrencies(snapshot?.accounts ?? []), [snapshot?.accounts]);
  const { currency: shared, preferred, mode, setCurrency, setMode } = useDisplayCurrency(held);
  const route = displayCurrencyForRoute(snapshot?.accounts ?? [], params.currency, preferred, mode);
  // `applied` remembers which parameter value was applied. A parameter is applied exactly once: when it arrives held, or
  // later, the moment its first account exists (route.apply turns from null to the code); a parameter already applied
  // is never applied again by a later change of the ledger, so the switch and Inicio decide from then on.
  const [applied, setApplied] = useState<unknown>();
  const pendingRoute = route.apply && applied !== params.currency ? route.apply : null;
  useEffect(() => { if (pendingRoute) { setCurrency(pendingRoute); setApplied(params.currency); } }, [params.currency, pendingRoute]);
  // The frame the parameter arrives (or becomes held) already shows its currency; from then on the shared choice.
  const shownCurrency: Currency = pendingRoute ?? shared;
  // The month shown, and the six the trend covers (the previous one, for the comparison, is among them).
  const shownMonth = requestedReportMonth(monthOverride ?? params.month, day);
  const months = useMemo(() => monthsEnding(shownMonth, 6), [shownMonth]);
  const view = useFinanceView(months, shownCurrency);
  const ledger = view?.snapshot ?? null;
  const selection = useMemo(() => {
    if (!ledger || !snapshot) return null;
    const chosen = reportSelection(ledger, shownCurrency, monthOverride ?? params.month, day);
    // Consolidated, the months without a rate are still months with records: navigation reaches them.
    return view?.mode === 'consolidated' ? { ...chosen, earliestMonth: earliestRecordedMonth(snapshot, day) } : chosen;
  }, [ledger, snapshot, view?.mode, shownCurrency, monthOverride, params.month, day]);
  const report = useMemo(() => ledger && selection ? spendingReport(ledger, selection.currency, selection.monthISO, day) : null,
    [ledger, selection, day]);
  // Complete: every movement of the month (and, for the trend and the comparison, of the months they read) had a rate.
  const complete = !!view && !!report && view.complete(report.startISO, report.endISO, 'expense');
  const incomeComplete = !!view && !!report && view.complete(report.startISO, report.endISO, 'income');
  const previousComplete = !!view && !!selection && view.complete(shiftMonthISO(selection.monthISO, -1) + '-01', shiftMonthISO(selection.monthISO, -1) + '-31', 'expense');
  const trendComplete = !!view && !!report && view.complete(months[0] + '-01', report.endISO, 'expense');
  // One function per locale and currency, so the insights below recompute when either changes and only then.
  const money = useMemo(() => (minor: number) => moneyText(minor, selection?.currency ?? 'ARS'), [moneyText, selection?.currency]);
  const spoken = (minor: number) => spokenMoney(minor, selection?.currency ?? 'ARS');
  const lookOf = useCategoryLookOf('expense');
  const trend = useMemo(() => {
    if (!ledger || !selection || !trendComplete) return [];
    try { return monthlySpendingTrend(ledger, selection.currency, selection.monthISO, day, 6); } catch { return []; }
  }, [ledger, selection, day, trendComplete]);
  const comparison = useMemo(() => {
    if (!ledger || !selection || !previousComplete) return null;
    try { return spendingComparison(ledger, selection.currency, selection.monthISO, day); } catch { return null; }
  }, [ledger, selection, day, previousComplete]);
  const scope = selection && view ? budgetScope(archive?.budgets ?? [], held, view.mode, selection.currency, selection.monthISO) : null;
  const budgetCurrency = scope?.currency ?? selection?.currency ?? 'ARS';
  const budgetMoney = useMemo(() => (minor: number) => moneyText(minor, budgetCurrency), [moneyText, budgetCurrency]);
  const budgetSpoken = (minor: number) => spokenMoney(minor, budgetCurrency);
  // Budgets read the real ledger in their own currency (see the header), whatever the display mode.
  const budgets = useMemo(() => {
    if (!snapshot || !selection || !scope) return null;
    try { return summarizeMonthlyBudgets(snapshot, archive?.budgets ?? [], scope.currency, selection.monthISO); } catch { return null; }
  }, [snapshot, archive?.budgets, scope?.currency, selection]);
  const merchants = useMemo(() => report && report.status === 'ready' && ledger ? topMerchants(ledger, report, 5) : [], [ledger, report]);
  const insights = useMemo(() => {
    if (!snapshot || !ledger || !selection || !report || report.status !== 'ready') return [];
    // Budget facts come from the real ledger in the budget's currency; the largest expense and the growth from the
    // shown ledger. A growth fact reads the previous month: without all of its rates it would compare a partial month.
    const budgetFacts = scope ? spendingInsights(snapshot, archive?.budgets ?? [], scope.currency, selection.monthISO, day, budgetMoney)
      .filter(insight => insight.id.startsWith('over:') || insight.id.startsWith('near:')) : [];
    const facts = spendingInsights(ledger, [], selection.currency, selection.monthISO, day, money).filter(insight => previousComplete || !insight.id.startsWith('growth:'));
    return insightsBesideRanking([...budgetFacts, ...facts].slice(0, 4), merchants, ledger.entries);
  }, [snapshot, ledger, archive?.budgets, scope?.currency, selection, report, day, money, budgetMoney, merchants, previousComplete]);
  // The donut's choice belongs to one month, currency and display mode: any change of them clears it, whatever caused it
  // (Reportes' own controls, a link, or the display currency chosen on Inicio, which Reportes shares while it stays mounted).
  const choiceScope = selection && view ? selection.monthISO + '|' + selection.currency + '|' + view.mode : '';
  useEffect(() => { if (chosen && chosen.scope !== choiceScope) setChosen(null); }, [choiceScope]);
  if (!snapshot || !ledger || !view || !report || !selection) return null;
  const insightText = (insight: SpendingInsight) => localizedInsight(insight, { t, money, budgetMoney, dayMonth: formatDayMonth, label: key => lookOf(key).label, budgets, comparison, entries: ledger.entries });

  const ready = report.status === 'ready' && complete;
  const rows: (CategorySpending | DailySpending)[] = !ready ? [] : tab === 'categories' ? report.categories : dailySpending(ledger, report);
  const { currency, monthISO, earliestMonth, currentMonth } = selection;
  const words = { t, date: formatNumericDate, currencyName };
  const method = view.mode === 'consolidated' ? reportInfo(currency, view.provenance(report.startISO, report.endISO, 'expense'), words) : null;
  const shortfall = !complete && report.status === 'ready' ? spendingFigure(snapshot, view, report, view.activity, view.loaded) : null;
  const canPrevious = monthISO > earliestMonth;
  const canNext = monthISO < currentMonth;
  const slices = donutSlices(report.categories.map(category => ({ key: category.key, label: lookOf(category.category).label, value: category.amountMinor })), p, key => lookOf(key).hex, t('reports.others'));
  // The donut's chosen slice, only within the month and currency it was chosen in. Its share is the rows' own formatter
  // over the report's total in exact minor units, so the centre and the rows always say the same percentage.
  const scopeKey = choiceScope;
  const chosenKey = chosen?.scope === scopeKey && slices.some(slice => slice.key === chosen.key) ? chosen.key : null;
  const shareOf = (value: number) => {
    const { fraction, label } = spendingShare(value, report.status === 'ready' ? report.expenseMinor : 0, locale);
    return { label, spoken: spokenPercent(fraction) };
  };
  // A month or currency change clears the donut's choice (24UX6C2): coming back starts with none, like any new view.
  const goToMonth = (month: string | undefined) => { selectionHaptic(); setChosen(null); setMonth(month); };
  // Categorías | Día a día clears the choice too (24UX6D): coming back to the donut starts with the total in its centre.
  const goToTab = (next: 'categories' | 'days') => { setChosen(null); setTab(next); };
  // The change against last month (24UX6D: a row of the lower facts, since the KPI line that carried it is gone).
  const delta = comparison && comparison.status === 'ready' && comparison.previous?.status === 'ready' && comparison.deltaMinor !== null
    ? { minor: comparison.deltaMinor, percent: changePercent(comparison.deltaMinor, comparison.previous.expenseMinor, locale), mode: comparison.mode } : null;
  const deltaWords = (percent: string) => !delta ? '' : delta.minor === 0 ? t('reports.delta.same')
    : t(delta.minor > 0 ? 'reports.delta.more' : 'reports.delta.less', { percent });
  // The same change for VoiceOver, its share in the language's spoken numbers.
  const previousSpent = comparison?.status === 'ready' && comparison.previous?.status === 'ready' ? comparison.previous.expenseMinor : 0;
  const spokenDelta = delta && previousSpent > 0 ? deltaWords(spokenPercent(Math.abs(delta.minor) / previousSpent)) : undefined;
  // The history: the six months ending at the shown one, as bars once another of them has spending. When the shown month
  // is the only one of its six with spending, one quiet line instead of a lone bar beside five empty ones (the arrows and
  // «Este mes» above lead to later months). Absent when no month of the six has spending, or a month lacks a rate.
  const recordedMonths = trend.filter(point => point.amountMinor > 0);
  const onlyThisMonth = recordedMonths.length === 1 && recordedMonths[0].monthISO === monthISO;
  const showTrend = ready && recordedMonths.length > 0 && !onlyThisMonth;
  const days = tab === 'days';
  // Día a día's total at 20 pt fits the content width (Money caps a row amount's text scale at 1.8), or it takes its own line.
  const dayTotalFits = !ready || !Number.isSafeInteger(report.expenseMinor) || amountWidthEm(moneyText(report.expenseMinor, currency)) * 20 * Math.min(Math.max(fontScale, 0.5), MONEY_MAX_SCALE) <= windowWidth - 2 * space.xl;

  return <FlatList<CategorySpending | DailySpending> ref={list} data={rows} keyExtractor={item => 'key' in item ? item.key : item.dateISO}
    style={{ flex: 1, backgroundColor: p.background }}
    contentContainerStyle={{ padding: space.xl, paddingBottom: 48, flexGrow: 1 }}
    contentInsetAdjustmentBehavior="automatic" removeClippedSubviews={false}
    initialNumToRender={10} maxToRenderPerBatch={10} windowSize={7}
    ListHeaderComponent={<View style={{ gap: space.xxl, paddingBottom: space.m }}>
      <View style={{ gap: space.m }}>
        {held.length > 1 && <DisplayCurrencyButton compact={false} mode={view.mode} currency={currency} held={held} gate={gate} onMode={mode => { setChosen(null); setMode(mode); }} onCurrency={code => { setChosen(null); setCurrency(code); }} />}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <IconButton name="chevron-back" label={t('reports.previousMonth')} disabled={!canPrevious}
            onPress={() => { if (canPrevious) goToMonth(shiftReportMonth(monthISO, -1)); }} />
          <ValueTransition id={monthISO + '|' + currency} variant="fade" style={{ flex: 1, alignItems: 'center', gap: 2 }}>
            <AppText accessibilityRole="header" variant="title3" style={{ textAlign: 'center' }}>{formatMonthTitle(monthISO)}</AppText>
            {/* 24UX6D review: the caption gives way and the row wraps, centred, so at larger text «Este mes» moves under the
                period instead of spilling over the forward chevron, and the info button stays reachable. */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', columnGap: 10, rowGap: 2, maxWidth: '100%' }}>
              {/* 24UX6D: the period names the currency when no chip does («Hasta hoy · ARS»: the «Gastado · ARS» eyebrow that
                  named it is gone), and what the report counts sits beside it, reachable in every ready state. */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, flexShrink: 1, maxWidth: '100%' }}>
                <AppText secondary variant="caption" style={{ flexShrink: 1, textAlign: 'center' }}>{reportPeriodLabel(report, day, t, held.length <= 1)}</AppText>
                {ready && <InfoButton title={t('reports.method.title')} detail={method ?? t('reports.method.detail', { currency })} />}
              </View>
              {canNext && <PressFeedback feedback="opacity" accessibilityRole="button" onPress={() => goToMonth(currentMonth)} accessibilityLabel={t('reports.backToCurrentMonth')} hitSlop={8} style={{ minHeight: 28, justifyContent: 'center' }}>
                <AppText variant="caption" style={{ fontWeight: '600', color: p.primary }}>{t('reports.thisMonth')}</AppText>
              </PressFeedback>}
            </View>
          </ValueTransition>
          <IconButton name="chevron-forward" label={t('reports.nextMonth')} disabled={!canNext}
            onPress={() => { if (canNext) goToMonth(shiftReportMonth(monthISO, 1)); }} />
        </View>
      </View>

      {ready ? <>
        {/* The month's analysis: categories first, or day by day. 24UX6D: no KPI above it; the total is the donut's centre
            in Categorías and one compact line in Día a día. */}
        <View style={{ gap: space.l }}>
          <Choices value={tab} onChange={goToTab} options={[{ value: 'categories', label: t('reports.viewCategories') }, { value: 'days', label: t('reports.viewDays') }]} />
          {/* Día a día has no donut: the period's total as a compact analytical line, never the old hero. The label is
              secondary and the exact amount 20 pt semibold beside it; when the two do not share the line the amount wraps
              under the label (whole, never truncated). VoiceOver hears it once, in spoken numbers. */}
          {days && rows.length > 0 && <ValueTransition id={monthISO + '|' + currency}>
            <View accessible accessibilityLabel={t('reports.periodTotalSpoken', { amount: spoken(report.expenseMinor) })} accessibilityLanguage={speechLanguage}
              style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: 8, rowGap: 2 }}>
              <AppText secondary variant="subhead">{t('reports.dayTotal')}</AppText>
              {/* 24UX6D review: a row amount shrinks at most to 75 % and then truncates; when the exact amount would not fit
                  the content width at 20 pt it renders as a hero that fits its own line (never truncated). */}
              {dayTotalFits ? <Money minor={report.expenseMinor} currency={currency} size={20} weight="600" />
                : <View style={{ flexBasis: '100%' }}><Money minor={report.expenseMinor} currency={currency} large size={28} weight="600" /></View>}
            </View>
          </ValueTransition>}
          {!days && report.categories.length > 0 && <View style={{ alignSelf: 'stretch', alignItems: 'center', gap: space.m, paddingTop: space.s }}>
            {/* 24UX6D: the donut is the head of Categorías and carries the period's total in its centre (the report's own
                figure); a chosen category replaces it there. */}
            <DonutChart slices={slices} currency={currency} total={report.expenseMinor} caption={t('reports.chart.byCategory')} chosen={chosenKey} shareOf={shareOf}
              onChoose={key => setChosen(key ? { scope: scopeKey, key } : null)} />
            {slices.some(slice => slice.key === OTHERS_KEY) && <AppText tertiary variant="caption" style={{ textAlign: 'center' }}>{t('reports.othersNote')}</AppText>}
          </View>}
        </View>
        {rows.length > 0 && <SectionTitle caption={days ? t('reports.daysNote') : undefined}>{t(days ? 'reports.byDay' : 'reports.byCategory')}</SectionTitle>}
      </> : shortfall?.status === 'unavailable'
        ? <CurrencyParts parts={shortfall.parts} line={shortfall.reason === 'fetching' ? t('fx.fetching') : t('fx.unavailable', { currency })} detail={shortfallDetail(shortfall, words)} />
        : <EmptyState title={t('reports.outOfRangeTitle')} icon="calculator-outline" detail={t('reports.outOfRangeDetail')} />}
    </View>}
    renderItem={({ item, index }) => <View style={{ backgroundColor: p.surface, overflow: 'hidden',
      borderTopLeftRadius: index === 0 ? 16 : 0, borderTopRightRadius: index === 0 ? 16 : 0,
      borderBottomLeftRadius: index === rows.length - 1 ? 16 : 0, borderBottomRightRadius: index === rows.length - 1 ? 16 : 0 }}>
      {'key' in item ? <CategoryLegendRow category={item} totalMinor={ready ? report.expenseMinor : 0} chosen={chosenKey === item.key}
        currency={currency} last={index === report.categories.length - 1}
        onPress={() => router.push({ pathname: '/report-category', params: { currency, month: monthISO, category: item.key } })} />
        : <DetailRow label={t('reports.dayRow', { date: activityDateLabel(item.dateISO, day, locale), count: t('count.expenses', { count: item.count }) })}
          value={money(item.amountMinor)} spokenValue={spoken(item.amountMinor)} last={index === rows.length - 1}
          onPress={() => router.push({ pathname: '/report-day', params: { currency, date: item.dateISO } })} />}
    </View>}
    ListEmptyComponent={ready ? <EmptyState title={t('reports.emptyTitle')} icon={days ? 'calendar-outline' : 'pie-chart-outline'}
      detail={t(days ? 'reports.emptyDaysDetail' : 'reports.emptyDetail')} /> : null}
    ListFooterComponent={<View style={{ gap: space.xxl, paddingTop: space.xxl }}>
      {/* The history, after the month's own analysis: six months on one scale; a bar opens its month. */}
      {showTrend && <View>
        <SectionTitle caption={t('reports.history.hint')}>{t('reports.history.title')}</SectionTitle>
        <Surface style={{ gap: 12 }}>
          <AppText secondary variant="caption" style={{ fontWeight: '500' }}>{t('reports.lastSixMonths')}</AppText>
          <MonthBars points={trend} selected={monthISO} currency={currency} onSelect={month => {
            if (month === monthISO) return;
            goToMonth(month === currentMonth ? undefined : month);
            list.current?.scrollToOffset({ offset: 0, animated: !reduced });
          }} />
        </Surface>
      </View>}
      {ready && onlyThisMonth && <View>
        <SectionTitle>{t('reports.history.title')}</SectionTitle>
        <Surface style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <GlyphTile icon="bar-chart-outline" />
          <AppText secondary variant="subhead" style={{ flex: 1, minWidth: 0 }}>{t('reports.history.single')}</AppText>
        </Surface>
      </View>}
      {ready && budgets && scope && (budgets.total || budgets.rows.length > 0) && <View>
        <SectionTitle action={t('reports.budgets.manage')} onAction={() => router.push({ pathname: '/budgets', params: { currency: scope.currency, month: monthISO } })}>
          {scope.labelsCurrency ? withCurrencyCode(t('reports.budgets.title'), scope.currency) : t('reports.budgets.title')}</SectionTitle>
        <Surface grouped>
          {/* The month's ceiling first (all recorded expenses of the budget's currency), then the category sublimits. */}
          {budgets.total && <BudgetStatusRow category={t('reports.budgets.general')} spent={budgets.total.spentMinor} limit={budgets.total.budget.amountMinor}
            progress={budgets.total} money={budgetMoney} spoken={budgetSpoken} last={budgets.rows.length === 0}
            onPress={() => router.push({ pathname: '/edit-budget/[id]', params: { id: budgets.total!.budget.id } })} />}
          {budgets.rows.map((row, index) => <BudgetStatusRow key={row.budget.id} category={lookOf(row.budget.category).label} spent={row.spentMinor} limit={row.budget.amountMinor}
            progress={row} money={budgetMoney} spoken={budgetSpoken} last={index === budgets.rows.length - 1}
            onPress={() => router.push({ pathname: '/edit-budget/[id]', params: { id: row.budget.id } })} />)}
        </Surface>
      </View>}
      {ready && merchants.length > 0 && <View>
        <SectionTitle>{t('reports.merchants.title')}</SectionTitle>
        {/* 24UX3 review: an open ranked list on the ground, not a second slab under the category card. Rank stays a number; the
            tile carries the merchant's category, the one identity it really has. No decorative podium colours. The hairline starts
            under the text. */}
        <View>
          {merchants.map((merchant, index) => <View key={merchant.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60 }}>
            <AppText tertiary variant="footnote" style={{ width: 16, textAlign: 'center', fontVariant: ['tabular-nums'], fontWeight: '600' }}>{index + 1}</AppText>
            <CategoryBadge category={merchant.category} size={32} />
            <View style={{ flex: 1, minWidth: 0, alignSelf: 'stretch', justifyContent: 'center', paddingVertical: 10,
              borderBottomWidth: index === merchants.length - 1 ? 0 : StyleSheet.hairlineWidth, borderBottomColor: p.line }}>
              <MerchantCells merchant={merchant} currency={currency} label={lookOf(merchant.category).label} />
            </View>
          </View>)}
        </View>
      </View>}
      {ready && insights.length > 0 && <View>
        <SectionTitle>{t('reports.insights.title')}</SectionTitle>
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
        {/* Income is converted like spending; a month whose income lacks a rate shows no income or net figure rather than a partial one. */}
        {incomeComplete && <DetailRow label={t('reports.incomeRecorded')} value={money(report.incomeMinor)} spokenValue={spoken(report.incomeMinor)} icon="add-circle-outline" />}
        {incomeComplete && <DetailRow label={t('reports.netFlow')} value={money(report.incomeMinor - report.expenseMinor)} spokenValue={spoken(report.incomeMinor - report.expenseMinor)} icon="swap-vertical-outline" />}
        {/* 24UX6D: the change against last month (the same days, or the full month), only when both months are complete. */}
        {delta && <DetailRow label={t(delta.mode === 'matching-days' ? 'reports.delta.matchingDays' : 'reports.delta.previousMonth')}
          value={deltaWords(delta.percent)} spokenValue={spokenDelta} icon={delta.minor > 0 ? 'trending-up-outline' : delta.minor < 0 ? 'trending-down-outline' : 'remove-outline'} />}
        <NavigationRow title={t('reports.compare')} subtitle={t('reports.compareSubtitle')} icon="git-compare-outline" last
          onPress={() => router.push({ pathname: '/report-comparison', params: { currency, month: monthISO } })} />
      </Surface>}
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
  t: Translate; money: (minor: number) => string; budgetMoney: (minor: number) => string; dayMonth: (dateISO: string) => string; label: (category: string) => string;
  budgets: ReturnType<typeof summarizeMonthlyBudgets> | null; comparison: ReturnType<typeof spendingComparison> | null; entries: Entry[];
};

/** The words of a domain insight in the interface language. The domain states
 * the fact in Spanish; its id names the kind and the record it is about, so
 * the screen rebuilds the sentence from the same records, with the built-in
 * category's localized name. A fact it cannot trace keeps the domain's text. */
function localizedInsight(insight: SpendingInsight, { t, money: shownMoney, budgetMoney, dayMonth, label, budgets, comparison, entries }: InsightSources): { title: string; detail: string } {
  const [kind, ...rest] = insight.id.split(':');
  const id = rest.join(':');
  // A budget fact is written in the budget's currency; every other fact in the shown one.
  const money = kind === 'over' || kind === 'near' ? budgetMoney : shownMoney;
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
