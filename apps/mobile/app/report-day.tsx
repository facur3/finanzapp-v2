import { useLocalSearchParams } from 'expo-router';
import { dailySpending, expensesInPeriod, validDateISO, type ReportPeriod } from '@finanzapp/domain';
import { useLedger } from '../src/storage/LedgerProvider';
import { AppText, EmptyState, Money, Screen } from '../src/ui/components';
import { withCurrencyCode } from '../src/i18n/format';
import { useI18n } from '../src/i18n/provider';
import { EntryList } from '../src/ui/entry-list';
import { selectEntries } from '../src/ui/presentation';
import { useCurrentDay } from '../src/ui/theme';
import { View } from 'react-native';

export default function ReportDayScreen() {
  const params = useLocalSearchParams<{ currency?: string; date?: string }>();
  const { snapshot } = useLedger();
  const today = useCurrentDay();
  const { t, formatDate } = useI18n();
  if (!snapshot) return null;
  const { currency, date } = params;
  if ((currency !== 'ARS' && currency !== 'USD') || typeof date !== 'string' || !validDateISO(date) || date > today
    || !snapshot.accounts.some(a => a.currency === currency)) return <Screen><EmptyState title={t('reports.day.invalidTitle')} detail={t('reports.day.invalidDetail')} /></Screen>;
  const period: ReportPeriod = { currency, startISO: date, endISO: date };
  const entries = selectEntries(expensesInPeriod(snapshot, period), snapshot.accounts);
  let total: number | null = null;
  try { total = dailySpending(snapshot, period)[0]?.amountMinor ?? 0; } catch { /* Keep the records accessible when their sum exceeds the safe range. */ }
  return <EntryList entries={entries} accounts={snapshot.accounts} header={<View style={{ gap: 16 }}>
    <AppText accessibilityRole="header" variant="title2">{formatDate(date, 'long')}</AppText>
    {total !== null ? <Money minor={total} currency={currency} large /> : <AppText>{t('reports.day.totalUnavailable')}</AppText>}
    <AppText secondary>{withCurrencyCode(t('reports.recordedExpenses', { count: entries.length }), currency)}</AppText>
    {!entries.length && <EmptyState title={t('reports.day.emptyTitle')} detail={t('reports.day.emptyDetail')} />}
  </View>} />;
}
