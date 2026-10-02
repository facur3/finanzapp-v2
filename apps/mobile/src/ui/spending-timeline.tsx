import { useEffect } from 'react';
import { ScrollView, View } from 'react-native';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { router } from 'expo-router';
import { type Currency, type ReportPeriod, type SpendingBucket } from '@finanzapp/domain';
import { AppText, PressFeedback } from './components';
import { timing } from './motion';
import { usePalette, useReduceMotion } from './theme';
import { formatDate } from '../i18n/format';
import { DEFAULT_LOCALE, type AppLocale } from '../i18n/locale';
import { useI18n } from '../i18n/provider';

// The locale tables keep "sep" stable across ICU versions (newer data says "sept").
export const periodLabel = (p: ReportPeriod, locale: AppLocale = DEFAULT_LOCALE) => p.startISO === p.endISO ? formatDate(p.startISO, 'day', locale)
  : formatDate(p.startISO, 'day', locale) + ' – ' + formatDate(p.endISO, 'day', locale);

function Bar({ fraction }: { fraction: number }) {
  const p = usePalette(), reduced = useReduceMotion();
  const value = useSharedValue(fraction);
  useEffect(() => {
    value.value = withTiming(fraction, timing('data', reduced));
    return () => cancelAnimation(value);
  }, [fraction, reduced, value]);
  const style = useAnimatedStyle(() => ({ height: `${value.value * 100}%` as `${number}%` }));
  return <View accessible={false} style={{ height: 90, width: '100%', justifyContent: 'flex-end', borderBottomWidth: 1, borderBottomColor: p.line }}>
    <Animated.View style={[{ backgroundColor: p.text, borderTopLeftRadius: 7, borderTopRightRadius: 7, marginHorizontal: 8 }, style]} />
  </View>;
}

/** Whether a span nets to zero or less while it has records (24T3: devoluciones net in their own dates). An empty span is
 * not «no net spending»: no records is not no spending. */
function noNet(bucket: SpendingBucket): boolean {
  return bucket.amountMinor < 0 || (bucket.amountMinor === 0 && bucket.count > 0);
}

/** The period's spans as bars on a zero-to-max scale. 24T3 (A24): the scale is zero to the largest positive net; a span
 * whose net is zero or less is drawn at zero (never below the axis) and VoiceOver says «sin gasto neto» with its exact
 * net; when no span nets above zero the line over the bars says so instead of a maximum. Absent when no span has records. */
export function SpendingTimeline({ buckets, currency }: { buckets: SpendingBucket[]; currency: Currency }) {
  const { t, locale, formatMoneyAmount, spokenMinor } = useI18n();
  const max = Math.max(...buckets.map(b => b.amountMinor), 0);
  if (!max && !buckets.some(noNet)) return null;
  return <View style={{ gap: 8 }}>
    <AppText secondary style={{ fontSize: 12 }}>{max ? t('reports.chart.timelineMax', { currency, amount: formatMoneyAmount(max, currency) }) : t('reports.chart.timelineNoNet')}</AppText>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1, gap: 4 }}>
      {buckets.map(bucket => <PressFeedback key={bucket.startISO} feedback="opacity" accessibilityRole="button"
        accessibilityLabel={t(noNet(bucket) ? 'reports.chart.timelineBarNoNet' : 'reports.chart.timelineBar', { period: periodLabel(bucket, locale), amount: spokenMinor(bucket.amountMinor, currency), currency,
          count: t('reports.recordedExpenses', { count: bucket.count }) })}
        accessibilityHint={t('reports.chart.timelineHint')} containerStyle={{ flex: 1, minWidth: 44 }}
        onPress={() => router.push({ pathname: '/spending-detail', params: { currency, startISO: bucket.startISO, endISO: bucket.endISO } })}
        style={{ gap: 8, paddingTop: 8 }}>
        <Bar fraction={max ? Math.max(0, bucket.amountMinor) / max : 0} />
        <AppText secondary style={{ textAlign: 'center', fontSize: 11, lineHeight: 16 }}>
          {Number(bucket.startISO.slice(-2))}{bucket.startISO !== bucket.endISO ? '–' + Number(bucket.endISO.slice(-2)) : ''}
        </AppText>
      </PressFeedback>)}
    </ScrollView>
    <AppText secondary style={{ fontSize: 12 }}>{t('reports.chart.timelineFooter')}</AppText>
  </View>;
}
