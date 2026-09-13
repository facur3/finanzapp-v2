import { useMemo } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { spendingReport, type Currency, type LedgerSnapshot } from '@finanzapp/domain';
import { AppText, Money, SectionTitle, Surface } from './components';
import { reportMonthLabel } from './report-presentation';
import { CategorySpendingRow } from './spending-chart';
import { useCurrentDay } from './theme';

export function MonthCard({ snapshot, currency }: { snapshot: LedgerSnapshot; currency: Currency }) {
  const day = useCurrentDay();
  const { fontScale } = useWindowDimensions();
  const monthISO = day.slice(0, 7);
  const summary = useMemo(() => spendingReport(snapshot, currency, monthISO, day), [snapshot, currency, monthISO, day]);
  const categories = summary.categories.slice(0, 3);
  return <View>
    <SectionTitle action="Ver reporte" onAction={() => router.push({ pathname: '/reports', params: { currency } })}>Tu mes</SectionTitle>
    <Surface grouped>
      <View style={{ padding: 20, gap: 18 }}>
        <AppText secondary style={{ fontSize: 13 }}>{reportMonthLabel(monthISO)} · {currency} · hasta hoy</AppText>
        {summary.status !== 'ready' ? <AppText secondary>Los movimientos están guardados, pero el total del mes supera el rango que podemos mostrar con precisión.</AppText>
          : !summary.count ? <AppText secondary style={{ fontSize: 15 }}>Todavía no registraste movimientos este mes.</AppText>
          : <>
            <View style={{ flexDirection: fontScale > 1.3 ? 'column' : 'row', gap: 20 }}>
              <View style={{ flex: fontScale > 1.3 ? undefined : 1, minWidth: 0, gap: 8 }}>
                <AppText secondary style={{ fontSize: 14 }}>Ingresos</AppText>
                <Money minor={summary.incomeMinor} currency={currency} size={20} />
              </View>
              <View style={{ flex: fontScale > 1.3 ? undefined : 1, minWidth: 0, gap: 8 }}>
                <AppText secondary style={{ fontSize: 14 }}>Gastos</AppText>
                <Money minor={summary.expenseMinor} currency={currency} size={20} />
              </View>
            </View>
            {!categories.length && <AppText secondary style={{ fontSize: 14 }}>Todavía no registraste gastos este mes.</AppText>}
          </>}
      </View>
      {summary.status === 'ready' && categories.length > 0 && <>
        <View style={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 2 }}>
          <AppText secondary style={{ fontSize: 13 }}>Gastos por categoría · % del total</AppText>
        </View>
        {categories.map((category, index) => <CategorySpendingRow key={category.key} category={category}
          totalMinor={summary.expenseMinor} currency={currency} compact last={index === categories.length - 1}
          onPress={() => router.push({ pathname: '/report-category', params: { currency, month: monthISO, category: category.key } })} />)}
        {summary.categories.length > 3 && <AppText secondary style={{ paddingHorizontal: 20, paddingBottom: 18, fontSize: 12 }}>
          Las 3 principales de {summary.categories.length} categorías. El resto está en el reporte.
        </AppText>}
      </>}
    </Surface>
  </View>;
}
