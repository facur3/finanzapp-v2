import { FlatList, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { spendingComparison, type CategoryChange, type ReportPeriod } from '@finanzapp/domain';
import { useLedger } from '../src/storage/LedgerProvider';
import { AppText, DetailRow, EmptyState, Money, Screen, SectionTitle, Surface } from '../src/ui/components';
import { useCategoryLookOf } from '../src/ui/category-hues';
import { changePercent, dateRangeLabel, strictReportSelection } from '../src/ui/report-presentation';
import { useI18n } from '../src/i18n/provider';
import { useCurrentDay, usePalette } from '../src/ui/theme';

export default function ReportComparisonScreen() {
  const params = useLocalSearchParams<{ currency?: string; month?: string }>();
  const { snapshot } = useLedger();
  const lookOf = useCategoryLookOf('expense');
  const today = useCurrentDay(), p = usePalette();
  const { t, locale, codedAmount, spokenAmount } = useI18n();
  if (!snapshot) return null;
  // A drill-down never falls back to another currency: an unknown or unheld code is an invalid link.
  const selection = strictReportSelection(snapshot, params.currency, params.month, today);
  if (!selection) return <Screen><EmptyState title={t('reports.comparison.invalidTitle')} detail={t('reports.comparison.invalidDetail')} /></Screen>;
  const comparison = spendingComparison(snapshot, selection.currency, selection.monthISO, today);
  const { current, previous, deltaMinor } = comparison;
  const amount = (minor: number) => codedAmount(minor, selection.currency);
  // The VoiceOver twin of `amount`: the language's decimal mark, no grouping ("1234,56 ARS").
  const spoken = (minor: number) => spokenAmount(minor, selection.currency);
  const openCategory = (period: ReportPeriod, key: string) => router.push({ pathname: '/report-category',
    params: { currency: selection.currency, month: period.startISO.slice(0, 7), category: key, through: period.endISO } });
  return <FlatList<CategoryChange> data={comparison.categories} keyExtractor={item => item.key}
    style={{ flex: 1, backgroundColor: p.background }} contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 40 }}
    contentInsetAdjustmentBehavior="automatic" removeClippedSubviews={false}
    ListHeaderComponent={<View style={{ gap: 20 }}>
      <AppText secondary>{t(comparison.mode === 'matching-days' ? 'reports.comparison.matchingDays' : 'reports.comparison.fullMonths')}</AppText>
      {comparison.capped && <AppText secondary>{t('reports.comparison.capped', { day: Number(current.endISO.slice(-2)) })}</AppText>}
      {comparison.status === 'out-of-range' ? <EmptyState title={t('reports.outOfRangeTitle')} detail={t('reports.comparison.outOfRangeDetail')} /> : <>
        {comparison.status === 'ready' && deltaMinor !== null && previous?.status === 'ready' && <View style={{ gap: 10 }}>
          <AppText accessibilityRole="header" variant="title2">{deltaMinor === 0 ? t('reports.comparison.same')
            : t(deltaMinor > 0 ? 'reports.comparison.more' : 'reports.comparison.less', { percent: changePercent(deltaMinor, previous.expenseMinor, locale) })}</AppText>
          <Money minor={deltaMinor} currency={selection.currency} large />
          <AppText secondary>{t('reports.comparison.difference')}</AppText>
        </View>}
        <Surface grouped>
          {current.status === 'ready' && <DetailRow label={dateRangeLabel(current, t, locale)} value={amount(current.expenseMinor)} spokenValue={spoken(current.expenseMinor)} last={!previous} />}
          {previous?.status === 'ready' && <DetailRow label={dateRangeLabel(previous, t, locale)} value={amount(previous.expenseMinor)} spokenValue={spoken(previous.expenseMinor)} last />}
        </Surface>
        {comparison.status === 'insufficient' && <EmptyState title={t('reports.comparison.insufficientTitle')} detail={t('reports.comparison.insufficientDetail')} />}
      </>}
      {comparison.categories.length > 0 && <SectionTitle>{t('reports.comparison.changedTitle')}</SectionTitle>}
    </View>}
    renderItem={({ item }) => <Surface grouped>
      <View style={{ padding: 16, gap: 6 }}>
        <AppText style={{ fontWeight: '600', fontSize: 17 }}>{lookOf(item.category).label}</AppText>
        <AppText secondary>{item.deltaMinor === 0 ? t('reports.comparison.noChange')
          : t(item.deltaMinor > 0 ? 'reports.comparison.amountMore' : 'reports.comparison.amountLess', { amount: amount(Math.abs(item.deltaMinor)) })}</AppText>
      </View>
      <DetailRow label={t('reports.comparison.thisPeriod')} value={amount(item.currentMinor)} spokenValue={spoken(item.currentMinor)} onPress={item.currentCount ? () => openCategory(current, item.key) : undefined} />
      <DetailRow label={t('reports.comparison.previous')} value={amount(item.previousMinor)} spokenValue={spoken(item.previousMinor)} last onPress={item.previousCount && previous ? () => openCategory(previous, item.key) : undefined} />
    </Surface>}
    ListFooterComponent={<AppText secondary style={{ fontSize: 12, lineHeight: 18 }}>{t('reports.comparison.footer', { currency: selection.currency })}</AppText>} />;
}
