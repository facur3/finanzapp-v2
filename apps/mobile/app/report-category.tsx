import { useMemo } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { expensesInPeriod, isStorableCurrency, spendingReport } from '@finanzapp/domain';
import { useLedger } from '../src/storage/LedgerProvider';
import { useFinanceView } from '../src/fx/rates-provider';
import { listingSnapshot } from '../src/fx/finance-view';
import { AppText, CategoryBadge, EmptyState, Money, Screen, SectionTitle } from '../src/ui/components';
import { EntryList } from '../src/ui/entry-list';
import { selectEntries } from '../src/ui/presentation';
import { reportPeriodLabel, strictReportSelection, reportCutoff } from '../src/ui/report-presentation';
import { useI18n } from '../src/i18n/provider';
import { useCategoryLookOf } from '../src/ui/category-hues';
import { useCurrentDay } from '../src/ui/theme';

export default function ReportCategoryScreen() {
  const params = useLocalSearchParams<{ currency?: string | string[]; month?: string | string[]; category?: string | string[]; through?: string | string[] }>();
  const { snapshot: real } = useLedger();
  const day = useCurrentDay();
  // 24C1: the category as Reportes counts it (converted in consolidated mode); its rows keep their original amounts.
  const month = typeof params.month === 'string' ? params.month : day.slice(0, 7);
  const months = useMemo(() => [month], [month]);
  const view = useFinanceView(months, isStorableCurrency(params.currency) ? params.currency : undefined);
  const snapshot = view?.snapshot ?? null;
  const { t, formatMonth } = useI18n();
  const lookOf = useCategoryLookOf('expense');
  const key = typeof params.category === 'string' ? params.category : '';
  // A drill-down never falls back to another currency: an unknown or unheld code is an invalid link.
  const selection = useMemo(() => snapshot ? strictReportSelection(snapshot, params.currency, params.month, day) : null,
    [snapshot, params.currency, params.month, day]);
  const cutoff = selection ? reportCutoff(selection.monthISO, params.through, day) : null;
  const report = useMemo(() => snapshot && selection && cutoff ? spendingReport(snapshot, selection.currency, selection.monthISO, cutoff) : null,
    [snapshot, selection, cutoff]);
  const entries = useMemo(() => real && view && report && key
    ? selectEntries(expensesInPeriod(listingSnapshot(real, view), report, key), real.accounts) : [], [real, view?.mode, view?.currency, report, key]);
  if (!snapshot || !real || !view) return null;
  if (cutoff === null || !selection) return <Screen><EmptyState title={t('reports.category.invalidTitle')} detail={t('reports.category.invalidDetail')} /></Screen>;
  if (!report) return null;
  if (!entries.length) return <Screen>
    <AppText secondary>{formatMonth(selection.monthISO)} · {reportPeriodLabel(report, day, t)}</AppText>
    <EmptyState title={t('reports.category.emptyTitle')} icon="receipt-outline"
      detail={t('reports.category.emptyDetail')} />
  </Screen>;
  // A category with a movement that has no rate shows no total rather than a partial one.
  const category = view.complete(report.startISO, report.endISO, 'expense') ? report.categories.find(item => item.key === key) : undefined;
  const label = category?.category ?? entries[0].category;
  return <EntryList entries={entries} accounts={real.accounts} header={<View style={{ gap: 22 }}>
    <View style={{ gap: 12, paddingTop: 8 }}>
      <CategoryBadge category={label} large />
      <AppText accessibilityRole="header" variant="title1">{lookOf(label).label}</AppText>
      <AppText secondary variant="subhead">{formatMonth(selection.monthISO)} · {reportPeriodLabel(report, day, t)}</AppText>
    </View>
    <View style={{ gap: 10 }}>
      {category ? <Money minor={category.amountMinor} currency={selection.currency} large />
        : <AppText secondary>{t('reports.category.totalUnavailable')}</AppText>}
      <AppText secondary variant="subhead">{t('reports.recordedExpenses', { count: entries.length })}</AppText>
    </View>
    <SectionTitle>{t('reports.category.movements')}</SectionTitle>
  </View>} />;
}
