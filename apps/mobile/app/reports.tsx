import { useMemo, useState } from 'react';
import { FlatList, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { formatMinorUnits, spendingReport, type CategorySpending, type Currency } from '@finanzapp/domain';
import { useLedger } from '../src/storage/LedgerProvider';
import { AppText, Choices, DetailRow, EmptyState, IconButton, Money, PressFeedback, SectionTitle, Surface } from '../src/ui/components';
import { reportMonthLabel, reportPeriodLabel, reportSelection, shiftReportMonth } from '../src/ui/report-presentation';
import { CategorySpendingRow } from '../src/ui/spending-chart';
import { useCurrentDay, usePalette } from '../src/ui/theme';

export default function ReportsScreen() {
  const params = useLocalSearchParams<{ currency?: string | string[]; month?: string | string[] }>();
  const { snapshot } = useLedger();
  const p = usePalette();
  const day = useCurrentDay();
  const [currencyOverride, setCurrency] = useState<Currency>();
  const [monthOverride, setMonth] = useState<string>();
  const selection = useMemo(() => snapshot ? reportSelection(snapshot, currencyOverride ?? params.currency, monthOverride ?? params.month, day) : null,
    [snapshot, currencyOverride, params.currency, monthOverride, params.month, day]);
  const report = useMemo(() => snapshot && selection ? spendingReport(snapshot, selection.currency, selection.monthISO, day) : null,
    [snapshot, selection, day]);
  if (!snapshot || !report || !selection) return null;
  const { currency, currencies, monthISO, earliestMonth, currentMonth } = selection;
  const canPrevious = monthISO > earliestMonth;
  const canNext = monthISO < currentMonth;

  return <FlatList<CategorySpending> data={report.categories} keyExtractor={category => category.key}
    style={{ flex: 1, backgroundColor: p.background }}
    contentContainerStyle={{ padding: 20, paddingBottom: 40, flexGrow: 1 }}
    contentInsetAdjustmentBehavior="automatic" removeClippedSubviews={false}
    initialNumToRender={10} maxToRenderPerBatch={10} windowSize={7}
    ListHeaderComponent={<View style={{ gap: 24, paddingBottom: 10 }}>
      <View style={{ gap: 12 }}>
        {currencies.length > 1 && <Choices value={currency} onChange={setCurrency}
          options={currencies.map(value => ({ value, label: value === 'ARS' ? 'Pesos · ARS' : 'Dólares · USD' }))} />}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <IconButton name="chevron-back" label="Mes anterior" disabled={!canPrevious}
            onPress={() => { if (canPrevious) setMonth(shiftReportMonth(monthISO, -1)); }} />
          <AppText accessibilityRole="header" style={{ flex: 1, fontSize: 19, fontWeight: '600', textAlign: 'center' }}>{reportMonthLabel(monthISO)}</AppText>
          <IconButton name="chevron-forward" label="Mes siguiente" disabled={!canNext}
            onPress={() => { if (canNext) setMonth(shiftReportMonth(monthISO, 1)); }} />
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', columnGap: 16 }}>
          <AppText secondary style={{ fontSize: 13 }}>{reportPeriodLabel(report, day)}</AppText>
          {canNext && <PressFeedback accessibilityRole="button" onPress={() => setMonth(currentMonth)}
            accessibilityLabel="Volver al mes actual">
            <AppText style={{ fontSize: 13, fontWeight: '600', color: p.accent }}>Este mes</AppText>
          </PressFeedback>}
        </View>
      </View>
      {report.status === 'ready' ? <>
        <View style={{ gap: 10, paddingVertical: 4 }}>
          <AppText secondary style={{ fontSize: 15 }}>Gastos registrados</AppText>
          <Money minor={report.expenseMinor} currency={currency} large />
        </View>
        <Surface grouped><DetailRow label="Ingresos registrados" value={currency + ' ' + formatMinorUnits(report.incomeMinor)} last /></Surface>
        {report.categories.length > 0 && <View>
          <SectionTitle>Por categoría</SectionTitle>
          <AppText secondary style={{ fontSize: 13 }}>Cada barra muestra su proporción del gasto total.</AppText>
        </View>}
      </> : <EmptyState title="El total supera el rango disponible" icon="calculator-outline"
        detail="Tus movimientos siguen guardados. No mostramos un total ni un gráfico redondeado que pueda ser incorrecto." />}
    </View>}
    renderItem={({ item, index }) => <View style={{ backgroundColor: p.surface, overflow: 'hidden',
      borderTopLeftRadius: index === 0 ? 22 : 0, borderTopRightRadius: index === 0 ? 22 : 0,
      borderBottomLeftRadius: index === report.categories.length - 1 ? 22 : 0, borderBottomRightRadius: index === report.categories.length - 1 ? 22 : 0 }}>
      <CategorySpendingRow category={item} totalMinor={report.status === 'ready' ? report.expenseMinor : 0}
        currency={currency} last={index === report.categories.length - 1}
        onPress={() => router.push({ pathname: '/report-category', params: { currency, month: monthISO, category: item.key } })} />
    </View>}
    ListEmptyComponent={report.status === 'ready' ? <EmptyState title="Sin gastos en este período" icon="bar-chart-outline"
      detail="Los gastos registrados en esta moneda aparecerán acá, agrupados por categoría. Podés recorrer los meses con movimientos usando las flechas." /> : null}
    ListFooterComponent={<AppText secondary style={{ fontSize: 12, lineHeight: 18, paddingTop: 20 }}>
      Solo movimientos registrados en {currency}. Los saldos iniciales no se cuentan como ingresos.
    </AppText>} />;
}
