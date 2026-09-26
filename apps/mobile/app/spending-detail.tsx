import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { expensesInPeriod, isStorableCurrency, spendingOverview, validDateISO, type ReportPeriod } from '@finanzapp/domain';
import { useMemo } from 'react';
import { useLedger } from '../src/storage/LedgerProvider';
import { useFinanceView } from '../src/fx/rates-provider';
import { listingSnapshot } from '../src/fx/finance-view';
import { AppText, CategoryBadge, EmptyState, Money, Screen, SectionTitle } from '../src/ui/components';
import { withCurrencyCode } from '../src/i18n/format';
import { useI18n } from '../src/i18n/provider';
import { EntryList } from '../src/ui/entry-list';
import { selectEntries } from '../src/ui/presentation';
import { periodLabel } from '../src/ui/spending-timeline';
import { useCategoryLookOf } from '../src/ui/category-hues';
import { useCurrentDay } from '../src/ui/theme';
import { heldCurrency } from '../src/ui/report-presentation';

export default function SpendingDetailScreen() {
  const { snapshot: real } = useLedger();
  const today = useCurrentDay();
  const lookOf = useCategoryLookOf('expense');
  const { t, locale } = useI18n();
  const params = useLocalSearchParams<{ currency?: string; startISO?: string; endISO?: string; category?: string }>();
  const { startISO, endISO, category } = params;
  // 24C1: the period as Inicio counts it (converted in consolidated mode); its rows keep their original amounts.
  const month = typeof startISO === 'string' ? startISO.slice(0, 7) : today.slice(0, 7);
  const months = useMemo(() => [month], [month]);
  const view = useFinanceView(months, isStorableCurrency(params.currency) ? params.currency : undefined);
  const snapshot = view?.snapshot;
  if (!snapshot || !real || !view) return null;
  const currency = heldCurrency(snapshot.accounts, params.currency);
  if (!currency || typeof startISO !== 'string' || typeof endISO !== 'string'
    || !validDateISO(startISO) || !validDateISO(endISO) || startISO > endISO || endISO > today
    || (Date.parse(endISO) - Date.parse(startISO)) / 86400000 > 30
    || (category !== undefined && (typeof category !== 'string' || !category))) return <Screen><EmptyState title={t('spendingDetail.invalidTitle')} detail={t('spendingDetail.invalidDetail')} /></Screen>;
  const period: ReportPeriod = { currency, startISO, endISO };
  const report = spendingOverview(snapshot, period);
  const entries = selectEntries(expensesInPeriod(listingSnapshot(real, view), period, category), real.accounts);
  const group = category ? report.categories.find(c => c.key === category) : undefined;
  const total = report.status === 'ready' && view.complete(startISO, endISO, 'expense') ? category ? group?.amountMinor ?? 0 : report.expenseMinor : null;
  // Same header as the report's category screen: the category as its tile, the name, the period, the total.
  return <EntryList entries={entries} accounts={real.accounts} header={<View style={{ gap: 22 }}>
    <View style={{ gap: 12, paddingTop: 8 }}>
      {group && <CategoryBadge category={group.category} large />}
      <AppText accessibilityRole="header" variant="title1">{group ? lookOf(group.category).label : t('spendingDetail.allExpenses')}</AppText>
      <AppText secondary variant="subhead">{withCurrencyCode(periodLabel(period, locale), currency)}</AppText>
    </View>
    <View style={{ gap: 10 }}>
      {total !== null ? <Money minor={total} currency={currency} large /> : <AppText secondary>{t('spendingDetail.totalUnavailable')}</AppText>}
      <AppText secondary variant="subhead">{t('spendingDetail.count', { count: entries.length })}</AppText>
    </View>
    {entries.length ? <SectionTitle>{t('spendingDetail.movements')}</SectionTitle> : <AppText secondary>{t('spendingDetail.none')}</AppText>}
  </View>} />;
}
