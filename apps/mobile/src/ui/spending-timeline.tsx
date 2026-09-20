import { useEffect } from 'react';
import { ScrollView, View } from 'react-native';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { router } from 'expo-router';
import { formatMinorUnits, type Currency, type ReportPeriod, type SpendingBucket } from '@finanzapp/domain';
import { AppText, PressFeedback } from './components';
import { usePalette, useReduceMotion } from './theme';

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
// Manual abbreviations keep "sep" stable across ICU versions (newer data says "sept").
const dateLabel = (day: string) => Number(day.slice(8, 10)) + ' ' + MONTHS[Number(day.slice(5, 7)) - 1];
export const periodLabel = (p: ReportPeriod) => p.startISO === p.endISO ? dateLabel(p.startISO) : dateLabel(p.startISO) + ' – ' + dateLabel(p.endISO);

function Bar({ fraction }: { fraction: number }) {
  const p = usePalette(), reduced = useReduceMotion();
  const value = useSharedValue(fraction);
  useEffect(() => {
    value.value = withTiming(fraction, { duration: reduced ? 0 : 240 });
    return () => cancelAnimation(value);
  }, [fraction, reduced, value]);
  const style = useAnimatedStyle(() => ({ height: `${value.value * 100}%` as `${number}%` }));
  return <View accessible={false} style={{ height: 90, width: '100%', justifyContent: 'flex-end', borderBottomWidth: 1, borderBottomColor: p.line }}>
    <Animated.View style={[{ backgroundColor: p.accent, borderTopLeftRadius: 7, borderTopRightRadius: 7, marginHorizontal: 8 }, style]} />
  </View>;
}

export function SpendingTimeline({ buckets, currency }: { buckets: SpendingBucket[]; currency: Currency }) {
  const max = Math.max(...buckets.map(b => b.amountMinor), 0);
  if (!max) return null;
  return <View style={{ gap: 8 }}>
    <AppText secondary style={{ fontSize: 12 }}>Gasto registrado · máximo {currency} {formatMinorUnits(max)}</AppText>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1, gap: 4 }}>
      {buckets.map(bucket => <PressFeedback key={bucket.startISO} accessibilityRole="button"
        accessibilityLabel={`${periodLabel(bucket)}, ${formatMinorUnits(bucket.amountMinor)} ${currency}, ${bucket.count} gastos registrados`}
        accessibilityHint="Abre los gastos de estas fechas" containerStyle={{ flex: 1, minWidth: 44 }}
        onPress={() => router.push({ pathname: '/spending-detail', params: { currency, startISO: bucket.startISO, endISO: bucket.endISO } })}
        style={{ gap: 8, paddingTop: 8 }}>
        <Bar fraction={bucket.amountMinor / max} />
        <AppText secondary style={{ textAlign: 'center', fontSize: 11, lineHeight: 16 }}>
          {Number(bucket.startISO.slice(-2))}{bucket.startISO !== bucket.endISO ? '–' + Number(bucket.endISO.slice(-2)) : ''}
        </AppText>
      </PressFeedback>)}
    </ScrollView>
    <AppText secondary style={{ fontSize: 12 }}>Días del período · tocá una barra para ver el detalle</AppText>
  </View>;
}
