import { useLocalSearchParams } from 'expo-router';
import { dailySpending, expensesInPeriod, isStorableCurrency, validDateISO, type ReportPeriod } from '@finanzapp/domain';
import { useMemo } from 'react';
import { useLedger } from '../src/storage/LedgerProvider';
import { useFinanceView } from '../src/fx/rates-provider';
import { lineCounts, listingSnapshot, recordedCountLabel, spendingFigure } from '../src/fx/finance-view';
import { shortfallLine } from '../src/fx/fx-copy';
import { CurrencyParts } from '../src/ui/home-modules';
import { AppText, EmptyState, Money, Screen } from '../src/ui/components';
import { withCurrencyCode } from '../src/i18n/format';
import { useI18n } from '../src/i18n/provider';
import { EntryList } from '../src/ui/entry-list';
import { selectEntries } from '../src/ui/presentation';
import { heldCurrency, requestedReportMonth } from '../src/ui/report-presentation';
import { useCurrentDay } from '../src/ui/theme';
import { View } from 'react-native';

export default function ReportDayScreen() {
  const params = useLocalSearchParams<{ currency?: string; date?: string }>();
  const { snapshot: real } = useLedger();
  const today = useCurrentDay();
  const { t, formatDate, formatNumericDate, currencyName } = useI18n();
  const { date } = params;
  // 24C1: the day as Reportes counts it (converted in consolidated mode); its rows keep their original amounts.
  // A malformed date never becomes a month the rate store is asked for (the screen says the day is invalid below).
  const month = requestedReportMonth(typeof date === 'string' ? date.slice(0, 7) : undefined, today);
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
  const complete = view.complete(date, date, 'expense');
  try { if (complete) total = dailySpending(snapshot, period)[0]?.amountMinor ?? 0; } catch { /* Keep the records accessible when their sum exceeds the safe range. */ }
  // 25R1: a missing rate is said as Reportes says it (with its reason behind ⓘ); the precision sentence is for an overflow only.
  const shortfall = complete ? null : shortfallLine(spendingFigure(real, view, { startISO: date, endISO: date }, view.activity, view.loaded),
    { t, date: formatNumericDate, currencyName });
  // 25Q1: no «Neto del día» on the heading: these rows are the day's expenses, whose total is the hero above.
  return <EntryList entries={entries} accounts={real.accounts} dayNet={false} header={<View style={{ gap: 16 }}>
    <AppText accessibilityRole="header" variant="title2">{formatDate(date, 'long')}</AppText>
    {total !== null ? <Money minor={total} currency={currency} large /> : shortfall ? <CurrencyParts parts={[]} line={shortfall.line} detail={shortfall.detail} />
      : <AppText>{t('reports.day.totalUnavailable')}</AppText>}
    {/* 24T3 (A23): purchases and devoluciones counted apart; every line stays listed below. */}
    <AppText secondary>{withCurrencyCode(recordedCountLabel(lineCounts(entries), t), currency)}</AppText>
    {!entries.length && <EmptyState title={t('reports.day.emptyTitle')} detail={t('reports.day.emptyDetail')} />}
  </View>} />;
}
