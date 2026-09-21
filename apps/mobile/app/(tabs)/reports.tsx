import { useMemo, useState, type ReactNode } from 'react';
import { FlatList, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { dailyAverageMinor, dailySpending, formatMinorUnits, monthlySpendingTrend, spendingComparison, spendingInsights, spendingReport,
  summarizeMonthlyBudgets, topMerchants, type CategorySpending, type Currency, type DailySpending, type SpendingInsight } from '@finanzapp/domain';
import { useLedger } from '../../src/storage/LedgerProvider';
import { AppText, CategoryBadge, Choices, DetailRow, EmptyState, GlyphTile, IconButton, Money, PressFeedback, SectionTitle, Surface } from '../../src/ui/components';
import { assignCategoryHues } from '../../src/ui/category-color';
import { useCategoryColor } from '../../src/ui/category-hues';
import { DonutChart, MonthBars, OTHERS_KEY, donutSlices } from '../../src/ui/charts';
import { ValueTransition, selectionHaptic } from '../../src/ui/motion';
import { activityDateLabel } from '../../src/ui/presentation';
import { changePercent, reportMonthLabel, reportPeriodLabel, reportSelection, shiftReportMonth } from '../../src/ui/report-presentation';
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
  const day = useCurrentDay();
  const [currencyOverride, setCurrency] = useState<Currency>();
  const [monthOverride, setMonth] = useState<string>();
  const [view, setView] = useState<'categories' | 'days'>('categories');
  const selection = useMemo(() => snapshot ? reportSelection(snapshot, currencyOverride ?? params.currency, monthOverride ?? params.month, day) : null,
    [snapshot, currencyOverride, params.currency, monthOverride, params.month, day]);
  const report = useMemo(() => snapshot && selection ? spendingReport(snapshot, selection.currency, selection.monthISO, day) : null,
    [snapshot, selection, day]);
  const money = (minor: number) => (selection?.currency === 'USD' ? 'US$ ' : '$ ') + formatMinorUnits(minor);
  const hues = useMemo(() => assignCategoryHues(snapshot?.entries ?? []), [snapshot?.entries]);
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
  }, [snapshot, archive?.budgets, selection, report, day]);
  if (!snapshot || !report || !selection) return null;

  const ready = report.status === 'ready';
  const rows: (CategorySpending | DailySpending)[] = view === 'categories' ? report.categories : ready ? dailySpending(snapshot, report) : [];
  const { currency, currencies, monthISO, earliestMonth, currentMonth } = selection;
  const canPrevious = monthISO > earliestMonth;
  const canNext = monthISO < currentMonth;
  const slices = donutSlices(report.categories.map(category => ({ key: category.key, label: category.category, value: category.amountMinor })), p, hues);
  const goToMonth = (month: string | undefined) => { selectionHaptic(); setMonth(month); };
  const average = ready ? dailyAverageMinor(report.expenseMinor, report) : 0;
  const delta = comparison && comparison.status === 'ready' && comparison.previous?.status === 'ready' && comparison.deltaMinor !== null
    ? { minor: comparison.deltaMinor, percent: changePercent(comparison.deltaMinor, comparison.previous.expenseMinor), mode: comparison.mode } : null;

  return <FlatList<CategorySpending | DailySpending> data={rows} keyExtractor={item => 'key' in item ? item.key : item.dateISO}
    style={{ flex: 1, backgroundColor: p.background }}
    contentContainerStyle={{ padding: space.xl, paddingBottom: 48, flexGrow: 1 }}
    contentInsetAdjustmentBehavior="automatic" removeClippedSubviews={false}
    initialNumToRender={10} maxToRenderPerBatch={10} windowSize={7}
    ListHeaderComponent={<View style={{ gap: space.xxl, paddingBottom: space.m }}>
      <View style={{ gap: space.m }}>
        {currencies.length > 1 && <Choices value={currency} onChange={setCurrency}
          options={currencies.map(value => ({ value, label: value === 'ARS' ? 'Pesos · ARS' : 'Dólares · USD' }))} />}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <IconButton name="chevron-back" label="Mes anterior" disabled={!canPrevious}
            onPress={() => { if (canPrevious) goToMonth(shiftReportMonth(monthISO, -1)); }} />
          <ValueTransition id={monthISO + '|' + currency} variant="fade" style={{ flex: 1, alignItems: 'center', gap: 2 }}>
            <AppText accessibilityRole="header" variant="title3" style={{ textTransform: 'capitalize', textAlign: 'center' }}>{reportMonthLabel(monthISO)}</AppText>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <AppText secondary variant="caption">{reportPeriodLabel(report, day)}</AppText>
              {canNext && <PressFeedback feedback="opacity" accessibilityRole="button" onPress={() => goToMonth(currentMonth)} accessibilityLabel="Volver al mes actual" style={{ minHeight: 28 }}>
                <AppText variant="caption" style={{ fontWeight: '600', color: p.primary }}>Este mes</AppText>
              </PressFeedback>}
            </View>
          </ValueTransition>
          <IconButton name="chevron-forward" label="Mes siguiente" disabled={!canNext}
            onPress={() => { if (canNext) goToMonth(shiftReportMonth(monthISO, 1)); }} />
        </View>
      </View>

      {ready ? <>
        <ValueTransition id={monthISO + '|' + currency} style={{ gap: 8 }}>
          <AppText secondary variant="eyebrow">Gastado · {currency}</AppText>
          <Money minor={report.expenseMinor} currency={currency} large />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
            <AppText secondary variant="subhead">{report.count === 0 ? 'Sin registros' : `${money(average)} por día`}</AppText>
            {delta && <>
              <AppText secondary variant="subhead">·</AppText>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <Ionicons name={delta.minor > 0 ? 'trending-up-outline' : delta.minor < 0 ? 'trending-down-outline' : 'remove-outline'} size={15} color={p.secondary} accessible={false} />
                <AppText secondary variant="subhead">{delta.minor === 0 ? 'igual que' : delta.percent + (delta.minor > 0 ? ' más que' : ' menos que')} {delta.mode === 'matching-days' ? 'los mismos días del mes anterior' : 'el mes anterior'}</AppText>
              </View>
            </>}
          </View>
        </ValueTransition>

        {trend.length > 0 && trend.some(point => point.amountMinor > 0) && <Surface style={{ gap: 12 }}>
          <AppText secondary variant="caption" style={{ fontWeight: '500' }}>Últimos seis meses</AppText>
          <MonthBars points={trend} selected={monthISO} onSelect={month => { if (month !== monthISO) goToMonth(month === currentMonth ? undefined : month); }} currency={currency} />
        </Surface>}

        <Choices value={view} onChange={setView} options={[{ value: 'categories', label: 'Categorías' }, { value: 'days', label: 'Día a día' }]} />

        {view === 'categories' && report.categories.length > 0 && <View style={{ alignItems: 'center', gap: space.m }}>
          <DonutChart slices={slices} total={report.expenseMinor} currency={currency} caption="Total del período" />
          {slices.some(slice => slice.key === OTHERS_KEY) && <AppText tertiary variant="caption">Las cinco mayores con nombre propio; el resto se agrupa como Otras.</AppText>}
        </View>}
        {view === 'days' && rows.length > 0 && <AppText secondary variant="footnote" style={{ paddingHorizontal: 4 }}>Solo días con gastos registrados. Tocá uno para ver los movimientos.</AppText>}
      </> : <EmptyState title="El total supera el rango disponible" icon="calculator-outline"
        detail="Tus movimientos siguen guardados. No mostramos un total ni un gráfico redondeado que pueda ser incorrecto." />}
    </View>}
    renderItem={({ item, index }) => <View style={{ backgroundColor: p.surface, overflow: 'hidden',
      borderTopLeftRadius: index === 0 ? 16 : 0, borderTopRightRadius: index === 0 ? 16 : 0,
      borderBottomLeftRadius: index === rows.length - 1 ? 16 : 0, borderBottomRightRadius: index === rows.length - 1 ? 16 : 0 }}>
      {'key' in item ? <CategoryLegendRow category={item} totalMinor={ready ? report.expenseMinor : 0}
        currency={currency} last={index === report.categories.length - 1}
        onPress={() => router.push({ pathname: '/report-category', params: { currency, month: monthISO, category: item.key } })} />
        : <DetailRow label={activityDateLabel(item.dateISO, day) + ' · ' + item.count + (item.count === 1 ? ' gasto' : ' gastos')}
          value={money(item.amountMinor)} last={index === rows.length - 1}
          onPress={() => router.push({ pathname: '/report-day', params: { currency, date: item.dateISO } })} />}
    </View>}
    ListEmptyComponent={ready ? <EmptyState title="Sin gastos en este período" icon="pie-chart-outline"
      detail="Los gastos registrados en esta moneda aparecerán acá, agrupados por categoría. Podés recorrer los meses con movimientos usando las flechas." /> : null}
    ListFooterComponent={<View style={{ gap: space.xxl, paddingTop: space.xxl }}>
      {ready && budgets && budgets.rows.length > 0 && <View>
        <SectionTitle action="Administrar" onAction={() => router.push({ pathname: '/budgets', params: { currency, month: monthISO } })}>Presupuestos</SectionTitle>
        <Surface grouped>
          {budgets.rows.map((row, index) => <BudgetStatusRow key={row.budget.id} category={row.budget.category} spent={row.spentMinor} limit={row.budget.amountMinor}
            ratio={row.ratio} exceeded={row.exceeded} money={money} last={index === budgets.rows.length - 1}
            onPress={() => router.push({ pathname: '/edit-budget/[id]', params: { id: row.budget.id } })} />)}
        </Surface>
      </View>}
      {ready && merchants.length > 0 && <View>
        <SectionTitle caption="Por importe registrado en el período">Dónde más gastaste</SectionTitle>
        <Surface grouped>
          {/* Rank stays a number; the tile carries the merchant's category, the one identity it really has. No decorative podium colours. */}
          {merchants.map((merchant, index) => <View key={merchant.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, minHeight: 64,
            borderBottomWidth: index === merchants.length - 1 ? 0 : 0.5, borderBottomColor: p.line }}>
            <AppText tertiary variant="footnote" style={{ width: 16, textAlign: 'center', fontVariant: ['tabular-nums'], fontWeight: '600' }}>{index + 1}</AppText>
            <CategoryBadge category={merchant.category} />
            <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
              <AppText numberOfLines={1} style={{ fontWeight: '500' }}>{merchant.merchant}</AppText>
              <AppText secondary variant="footnote" numberOfLines={1}>{merchant.count === 1 ? '1 compra' : merchant.count + ' compras'} · {merchant.category}</AppText>
            </View>
            <Money minor={merchant.amountMinor} currency={currency} />
          </View>)}
        </Surface>
      </View>}
      {ready && insights.length > 0 && <View>
        <SectionTitle caption="Hechos de tus registros, no consejos">Para tener en cuenta</SectionTitle>
        <View style={{ gap: 10 }}>
          {/* A fact about a category looks like that category; a warning or excess keeps its semantic tone. The surface takes only a whisper (8 %) of the colour so the text stays fully readable. */}
          {insights.map(insight => <InsightSurface key={insight.id} tone={insight.tone} category={insight.category}>
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
        <DetailRow label="Ingresos registrados" value={money(report.incomeMinor)} icon="add-circle-outline" />
        <DetailRow label="Flujo neto" value={(report.incomeMinor - report.expenseMinor < 0 ? '−' : '') + money(Math.abs(report.incomeMinor - report.expenseMinor))} icon="swap-vertical-outline" />
        <DetailRow label="Comparar con el mes anterior" value="Por categoría" icon="git-compare-outline" last
          onPress={() => router.push({ pathname: '/report-comparison', params: { currency, month: monthISO } })} />
      </Surface>}
      <AppText tertiary variant="footnote" style={{ paddingHorizontal: 4 }}>
        Solo movimientos registrados en {currency}. Los saldos iniciales, las transferencias y los pagos de tarjeta no cuentan como ingresos ni gastos. Un mes sin registros no significa que no hayas gastado.
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

function BudgetStatusRow({ category, spent, limit, ratio, exceeded, money, last, onPress }: {
  category: string; spent: number; limit: number; ratio: number; exceeded: boolean; money: (minor: number) => string; last: boolean; onPress: () => void;
}) {
  const p = usePalette();
  const color = exceeded ? p.expense : ratio >= 0.85 ? p.warning : p.text;
  const percent = Math.round(ratio * 100);
  return <PressFeedback feedback="highlight" accessibilityRole="button" accessibilityLabel={`${category}: ${money(spent)} de ${money(limit)}, ${percent} por ciento${exceeded ? ', excedido' : ''}`}
    onPress={onPress} style={{ paddingHorizontal: 16, paddingVertical: 12, gap: 8, borderBottomWidth: last ? 0 : 0.5, borderBottomColor: p.line }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <AppText numberOfLines={1} style={{ flex: 1, fontWeight: '500' }}>{category}</AppText>
      <AppText secondary variant="footnote" style={{ fontVariant: ['tabular-nums'] }}>{money(spent)} de {money(limit)}</AppText>
      <AppText variant="footnote" style={{ width: 44, textAlign: 'right', fontWeight: '600', color, fontVariant: ['tabular-nums'] }}>{percent} %</AppText>
    </View>
    <View accessible={false} style={{ height: 4, borderRadius: 2, backgroundColor: p.inset, overflow: 'hidden' }}>
      <View style={{ width: `${Math.min(100, Math.max(ratio > 0 ? 1.5 : 0, ratio * 100))}%`, height: 4, backgroundColor: color }} />
    </View>
  </PressFeedback>;
}
