import { useLocalSearchParams } from 'expo-router';
import { dailySpending, expensesInPeriod, isStorableCurrency, validDateISO, type ReportPeriod } from '@finanzapp/domain';
import { useMemo } from 'react';
import { useLedger } from '../src/storage/LedgerProvider';
import { useFinanceView } from '../src/fx/rates-provider';
import { listingSnapshot } from '../src/fx/finance-view';
import { AppText, EmptyState, Money, Screen } from '../src/ui/components';
import { withCurrencyCode } from '../src/i18n/format';
import { useI18n } from '../src/i18n/provider';
import { EntryList } from '../src/ui/entry-list';
import { selectEntries } from '../src/ui/presentation';
import { heldCurrency } from '../src/ui/report-presentation';
import { useCurrentDay } from '../src/ui/theme';
import { View } from 'react-native';

export default function ReportDayScreen() {
  const params = useLocalSearchParams<{ currency?: string; date?: string }>();
  const { snapshot: real } = useLedger();
  const today = useCurrentDay();
  const { t, formatDate } = useI18n();
  const { date } = params;
  // 24C1: the day as Reportes counts it (converted in consolidated mode); its rows keep their original amounts.
  const month = typeof date === 'string' ? date.slice(0, 7) : today.slice(0, 7);
  const months = useMemo(() => [month], [month]);
  const view = useFinanceView(months, isStorableCurrency(params.currency) ? params.currency : undefined);
  const snapshot = view?.snapshot;
  if (!snapshot || !real || !view) return null;
  const currency = heldCurrency(snapshot.accounts, params.currency);
  if (!currency || typeof date !== 'string' || !validDateISO(date) || date > today) {
    return <Screen><EmptyState title={t('reports.day.invalidTitle')} detail={t('reports.day.invalidDetail')} /></Screen>;
  }
  const period: ReportPeriod = { currency, startISO: date, endISO: date };
  const entries = selectEntries(expensesInPeriod(listingSnapshot(real, view), period), real.accounts);
  let total: number | null = null;
  try { if (view.complete(date, date, 'expense')) total = dailySpending(snapshot, period)[0]?.amountMinor ?? 0; } catch { /* Keep the records accessible when their sum exceeds the safe range. */ }
  return <EntryList entries={entries} accounts={real.accounts} header={<View style={{ gap: 16 }}>
    <AppText accessibilityRole="header" variant="title2">{formatDate(date, 'long')}</AppText>
    {total !== null ? <Money minor={total} currency={currency} large /> : <AppText>{t('reports.day.totalUnavailable')}</AppText>}
    <AppText secondary>{withCurrencyCode(t('reports.recordedExpenses', { count: entries.length }), currency)}</AppText>
    {!entries.length && <EmptyState title={t('reports.day.emptyTitle')} detail={t('reports.day.emptyDetail')} />}
  </View>} />;
}
