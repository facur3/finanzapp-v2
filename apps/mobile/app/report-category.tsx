import { useMemo } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { expensesInPeriod, spendingReport } from '@finanzapp/domain';
import { useLedger } from '../src/storage/LedgerProvider';
import { AppText, CategoryBadge, EmptyState, Money, Screen, SectionTitle } from '../src/ui/components';
import { EntryList } from '../src/ui/entry-list';
import { selectEntries } from '../src/ui/presentation';
import { reportPeriodLabel, reportSelection, reportCutoff } from '../src/ui/report-presentation';
import { useI18n } from '../src/i18n/provider';
import { useCategoryLookOf } from '../src/ui/category-hues';
import { useCurrentDay } from '../src/ui/theme';

export default function ReportCategoryScreen() {
  const params = useLocalSearchParams<{ currency?: string | string[]; month?: string | string[]; category?: string | string[]; through?: string | string[] }>();
  const { snapshot } = useLedger();
  const day = useCurrentDay();
  const { t, formatMonth } = useI18n();
  const lookOf = useCategoryLookOf('expense');
  const key = typeof params.category === 'string' ? params.category : '';
  const selection = useMemo(() => snapshot ? reportSelection(snapshot, params.currency, params.month, day) : null,
    [snapshot, params.currency, params.month, day]);
  const cutoff = selection ? reportCutoff(selection.monthISO, params.through, day) : null;
  const report = useMemo(() => snapshot && selection && cutoff ? spendingReport(snapshot, selection.currency, selection.monthISO, cutoff) : null,
    [snapshot, selection, cutoff]);
  const entries = useMemo(() => snapshot && report && key
    ? selectEntries(expensesInPeriod(snapshot, report, key), snapshot.accounts) : [], [snapshot, report, key]);
  if (cutoff === null) return <Screen><EmptyState title={t('reports.category.invalidTitle')} detail={t('reports.category.invalidDetail')} /></Screen>;
  if (!snapshot || !report || !selection) return null;
  if (!entries.length) return <Screen>
    <AppText secondary>{formatMonth(selection.monthISO)} · {reportPeriodLabel(report, day, t)}</AppText>
    <EmptyState title={t('reports.category.emptyTitle')} icon="receipt-outline"
      detail={t('reports.category.emptyDetail')} />
  </Screen>;
  const category = report.categories.find(item => item.key === key);
  const label = category?.category ?? entries[0].category;
  return <EntryList entries={entries} accounts={snapshot.accounts} header={<View style={{ gap: 22 }}>
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
