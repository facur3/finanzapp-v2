import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { categoryKey, expensesInPeriod, isStorableCurrency, spendingOverview, validDateISO, type ReportPeriod } from '@finanzapp/domain';
import { useMemo } from 'react';
import { useLedger } from '../src/storage/LedgerProvider';
import { useFinanceView } from '../src/fx/rates-provider';
import { lineCounts, listingSnapshot, recordedCountLabel, spendingFigure } from '../src/fx/finance-view';
import { shortfallLine } from '../src/fx/fx-copy';
import { CurrencyParts } from '../src/ui/home-modules';
import { AppText, CategoryBadge, EmptyState, Money, Screen, SectionTitle } from '../src/ui/components';
import { withCurrencyCode } from '../src/i18n/format';
import { useI18n } from '../src/i18n/provider';
import { EntryList } from '../src/ui/entry-list';
import { selectEntries } from '../src/ui/presentation';
import { periodLabel } from '../src/ui/spending-timeline';
import { useCategoryLookOf } from '../src/ui/category-hues';
import { useCurrentDay } from '../src/ui/theme';
import { heldCurrency, requestedReportMonth } from '../src/ui/report-presentation';

export default function SpendingDetailScreen() {
  const { snapshot: real } = useLedger();
  const today = useCurrentDay();
  const lookOf = useCategoryLookOf('expense');
  const { t, locale, formatNumericDate, currencyName } = useI18n();
  const params = useLocalSearchParams<{ currency?: string; startISO?: string; endISO?: string; category?: string }>();
  const { startISO, endISO, category } = params;
  // 24C1: the period as Inicio counts it (converted in consolidated mode); its rows keep their original amounts.
  // A malformed date never becomes a month the rate store is asked for (the screen says the period is invalid below).
  const month = requestedReportMonth(typeof startISO === 'string' ? startISO.slice(0, 7) : undefined, today);
  const months = useMemo(() => [month], [month]);
  const view = useFinanceView(months, isStorableCurrency(params.currency) ? params.currency : undefined);
  const snapshot = view?.snapshot;
  if (!snapshot || !real || !view) return null;
  const currency = heldCurrency(snapshot.accounts, params.currency);
  if (!currency || typeof startISO !== 'string' || typeof endISO !== 'string'
    || !validDateISO(startISO) || !validDateISO(endISO) || startISO > endISO || endISO > today
    || (Date.parse(endISO) - Date.parse(startISO)) / 86400000 > 30
    || (category !== undefined && (typeof category !== 'string' || !category.trim()))) return <Screen><EmptyState title={t('spendingDetail.invalidTitle')} detail={t('spendingDetail.invalidDetail')} /></Screen>;
  const period: ReportPeriod = { currency, startISO, endISO };
  const report = spendingOverview(snapshot, period);
  // 25Q1: a link may carry a category as it is stored («Supermercado», the Assistant's evidence) or as its key; both
  // compare as the key, as the report does, so the figure it opens is the one it cites, never a «$ 0,00».
  const key = category ? categoryKey(category) : undefined;
  const entries = selectEntries(expensesInPeriod(listingSnapshot(real, view), period, key), real.accounts);
  const group = key ? report.categories.find(c => c.key === key) : undefined;
  const complete = view.complete(startISO, endISO, 'expense');
  const total = report.status === 'ready' && complete ? category ? group?.amountMinor ?? 0 : report.expenseMinor : null;
  // 25R1: a missing rate is said as Reportes says it (with its reason behind ⓘ); the precision sentence is for an overflow only.
  const shortfall = complete ? null : shortfallLine(spendingFigure(real, view, { startISO, endISO }, view.activity, view.loaded), { t, date: formatNumericDate, currencyName });
  // Same header as the report's category screen: the category as its tile, the name, the period, the total.
  // The day headings carry no «Neto del día»: these rows are one category's (or all) expenses, not the day's movements.
  return <EntryList entries={entries} accounts={real.accounts} dayNet={false} header={<View style={{ gap: 22 }}>
    <View style={{ gap: 12, paddingTop: 8 }}>
      {/* A category with no line in the period keeps its own name and tile over its true zero, never «Gastos registrados». */}
      {category && <CategoryBadge category={group?.category ?? category.trim()} large />}
      <AppText accessibilityRole="header" variant="title1">{category ? lookOf(group?.category ?? category.trim()).label : t('spendingDetail.allExpenses')}</AppText>
      <AppText secondary variant="subhead">{withCurrencyCode(periodLabel(period, locale), currency)}</AppText>
    </View>
    <View style={{ gap: 10 }}>
      {total !== null ? <Money minor={total} currency={currency} large /> : shortfall ? <CurrencyParts parts={[]} line={shortfall.line} detail={shortfall.detail} />
        : <AppText secondary>{t('spendingDetail.totalUnavailable')}</AppText>}
      {/* 24T3 (A23): purchases and devoluciones counted apart (the same words as Reportes' drill-downs); every line stays listed. */}
      <AppText secondary variant="subhead">{recordedCountLabel(lineCounts(entries), t)}</AppText>
    </View>
    {entries.length ? <SectionTitle>{t('spendingDetail.movements')}</SectionTitle> : <AppText secondary>{t('spendingDetail.none')}</AppText>}
  </View>} />;
}
