import { FlatList, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { spendingComparison, type CategoryChange, type ReportPeriod } from '@finanzapp/domain';
import { useLedger } from '../src/storage/LedgerProvider';
import { AppText, DetailRow, EmptyState, Money, SectionTitle, Surface } from '../src/ui/components';
import { codedAmount } from '../src/i18n/format';
import { useCategoryLookOf } from '../src/ui/category-hues';
import { changePercent, dateRangeLabel, reportSelection } from '../src/ui/report-presentation';
import { useCurrentDay, usePalette } from '../src/ui/theme';

export default function ReportComparisonScreen() {
  const params = useLocalSearchParams<{ currency?: string; month?: string }>();
  const { snapshot } = useLedger();
  const lookOf = useCategoryLookOf('expense');
  const today = useCurrentDay(), p = usePalette();
  if (!snapshot) return null;
  const selection = reportSelection(snapshot, params.currency, params.month, today);
  const comparison = spendingComparison(snapshot, selection.currency, selection.monthISO, today);
  const { current, previous, deltaMinor } = comparison;
  const amount = (minor: number) => codedAmount(minor, selection.currency);
  const openCategory = (period: ReportPeriod, key: string) => router.push({ pathname: '/report-category',
    params: { currency: selection.currency, month: period.startISO.slice(0, 7), category: key, through: period.endISO } });
  return <FlatList<CategoryChange> data={comparison.categories} keyExtractor={item => item.key}
    style={{ flex: 1, backgroundColor: p.background }} contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 40 }}
    contentInsetAdjustmentBehavior="automatic" removeClippedSubviews={false}
    ListHeaderComponent={<View style={{ gap: 20 }}>
      <AppText secondary>{comparison.mode === 'matching-days' ? 'La misma cantidad de días de cada mes' : 'Meses completos · pueden tener distinta cantidad de días'}</AppText>
      {comparison.capped && <AppText secondary>Esta comparación llega hasta el día {Number(current.endISO.slice(-2))} en ambos meses porque el anterior fue más corto. El reporte mensual conserva todos los días.</AppText>}
      {comparison.status === 'out-of-range' ? <EmptyState title="El total supera el rango disponible" detail="Tus movimientos siguen guardados. No mostramos una comparación imprecisa." /> : <>
        {comparison.status === 'ready' && deltaMinor !== null && previous?.status === 'ready' && <View style={{ gap: 10 }}>
          <AppText accessibilityRole="header" variant="title2">{deltaMinor === 0 ? 'El mismo gasto registrado' : changePercent(deltaMinor, previous.expenseMinor) + (deltaMinor > 0 ? ' más registrado' : ' menos registrado')}</AppText>
          <Money minor={deltaMinor} currency={selection.currency} large />
          <AppText secondary>Diferencia respecto del período anterior</AppText>
        </View>}
        <Surface grouped>
          {current.status === 'ready' && <DetailRow label={dateRangeLabel(current)} value={amount(current.expenseMinor)} last={!previous} />}
          {previous?.status === 'ready' && <DetailRow label={dateRangeLabel(previous)} value={amount(previous.expenseMinor)} last />}
        </Surface>
        {comparison.status === 'insufficient' && <EmptyState title="Todavía no hay suficiente información" detail="La comparación necesita gastos registrados en ambos períodos. Que no haya registros no significa que no hayas gastado." />}
      </>}
      {comparison.categories.length > 0 && <SectionTitle>Qué categorías cambiaron</SectionTitle>}
    </View>}
    renderItem={({ item }) => <Surface grouped>
      <View style={{ padding: 16, gap: 6 }}>
        <AppText style={{ fontWeight: '600', fontSize: 17 }}>{lookOf(item.category).label}</AppText>
        <AppText secondary>{item.deltaMinor === 0 ? 'Sin cambio' : amount(Math.abs(item.deltaMinor)) + (item.deltaMinor > 0 ? ' más' : ' menos')}</AppText>
      </View>
      <DetailRow label="Este período" value={amount(item.currentMinor)} onPress={item.currentCount ? () => openCategory(current, item.key) : undefined} />
      <DetailRow label="Anterior" value={amount(item.previousMinor)} last onPress={item.previousCount && previous ? () => openCategory(previous, item.key) : undefined} />
    </Surface>}
    ListFooterComponent={<AppText secondary style={{ fontSize: 12, lineHeight: 18 }}>Solo gastos registrados en {selection.currency}, sin transferencias ni saldos iniciales. Las diferencias describen tus registros, no los motivos de tus gastos ni un ahorro confirmado.</AppText>} />;
}
