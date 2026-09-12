import { useMemo } from 'react';
import { View, useWindowDimensions } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { summarizeMonth, type Currency, type LedgerSnapshot } from '@finanzapp/domain';
import { AppText, Money, Surface } from './components';
import { useCurrentDay, usePalette } from './theme';

export function MonthCard({ snapshot, currency }: { snapshot: LedgerSnapshot; currency: Currency }) {
  const p = usePalette();
  const day = useCurrentDay();
  const { fontScale } = useWindowDimensions();
  const summary = useMemo(() => summarizeMonth(snapshot, currency, day), [snapshot, currency, day]);
  const month = new Date(day + 'T12:00:00').toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
  return <Surface style={{ gap: 18 }}>
    <View style={{ gap: 2 }}>
      <AppText accessibilityRole="header" style={{ fontSize: 19, fontWeight: '600' }}>Tu mes</AppText>
      <AppText secondary style={{ fontSize: 13 }}>{month} · {currency} · hasta hoy</AppText>
    </View>
    {summary.status !== 'ready' ? <AppText secondary>Los movimientos están guardados, pero el total del mes supera el rango que podemos mostrar con precisión.</AppText>
      : !summary.count ? <AppText secondary style={{ fontSize: 15 }}>Todavía no registraste movimientos este mes.</AppText>
      : <>
        <View style={{ flexDirection: fontScale > 1.3 ? 'column' : 'row', gap: 20 }}>
          <View style={{ flex: 1, gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Ionicons name="arrow-down" size={16} color={p.positive} accessible={false} /><AppText secondary style={{ fontSize: 14 }}>Ingresos</AppText></View>
            <Money minor={summary.incomeMinor} currency={currency} size={20} />
          </View>
          <View style={{ flex: 1, gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Ionicons name="arrow-up" size={16} color={p.secondary} accessible={false} /><AppText secondary style={{ fontSize: 14 }}>Gastos</AppText></View>
            <Money minor={summary.expenseMinor} currency={currency} size={20} />
          </View>
        </View>
        <AppText secondary style={{ fontSize: 12, lineHeight: 18 }}>Solo movimientos registrados. No incluye saldos iniciales.</AppText>
      </>}
  </Surface>;
}
