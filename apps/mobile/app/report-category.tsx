import { useMemo } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { expensesInPeriod, spendingReport } from '@finanzapp/domain';
import { useLedger } from '../src/storage/LedgerProvider';
import { AppText, CategoryBadge, EmptyState, Money, Screen, SectionTitle } from '../src/ui/components';
import { EntryList } from '../src/ui/entry-list';
import { selectEntries } from '../src/ui/presentation';
import { reportMonthLabel, reportPeriodLabel, reportSelection } from '../src/ui/report-presentation';
import { useCurrentDay } from '../src/ui/theme';

export default function ReportCategoryScreen() {
  const params = useLocalSearchParams<{ currency?: string | string[]; month?: string | string[]; category?: string | string[] }>();
  const { snapshot } = useLedger();
  const day = useCurrentDay();
  const key = typeof params.category === 'string' ? params.category : '';
  const selection = useMemo(() => snapshot ? reportSelection(snapshot, params.currency, params.month, day) : null,
    [snapshot, params.currency, params.month, day]);
  const report = useMemo(() => snapshot && selection ? spendingReport(snapshot, selection.currency, selection.monthISO, day) : null,
    [snapshot, selection, day]);
  const entries = useMemo(() => snapshot && report && key
    ? selectEntries(expensesInPeriod(snapshot, report, key), snapshot.accounts) : [], [snapshot, report, key]);
  if (!snapshot || !report || !selection) return null;
  if (!entries.length) return <Screen>
    <AppText secondary>{reportMonthLabel(selection.monthISO)} · {reportPeriodLabel(report, day)}</AppText>
    <EmptyState title="No hay gastos de esta categoría" icon="receipt-outline"
      detail="Volvé al reporte para elegir una categoría con movimientos en esta moneda y período." />
  </Screen>;
  const category = report.categories.find(item => item.key === key);
  const label = category?.category ?? entries[0].category;
  return <EntryList entries={entries} accounts={snapshot.accounts} header={<View style={{ gap: 22 }}>
    <View style={{ gap: 12, paddingTop: 8 }}>
      <CategoryBadge category={label} large />
      <AppText accessibilityRole="header" style={{ fontSize: 28, lineHeight: 35, fontWeight: '700', letterSpacing: -0.5 }}>{label}</AppText>
      <AppText secondary style={{ fontSize: 14 }}>{reportMonthLabel(selection.monthISO)} · {reportPeriodLabel(report, day)}</AppText>
    </View>
    <View style={{ gap: 10 }}>
      {category ? <Money minor={category.amountMinor} currency={selection.currency} large />
        : <AppText secondary>No podemos mostrar este total con precisión. Los movimientos están disponibles abajo.</AppText>}
      <AppText secondary style={{ fontSize: 14 }}>{entries.length === 1 ? '1 gasto registrado' : entries.length + ' gastos registrados'}</AppText>
    </View>
    <SectionTitle>Movimientos</SectionTitle>
  </View>} />;
}
