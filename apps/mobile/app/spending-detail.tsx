import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { expensesInPeriod, spendingOverview, validDateISO, type ReportPeriod } from '@finanzapp/domain';
import { useLedger } from '../src/storage/LedgerProvider';
import { AppText, CategoryBadge, EmptyState, Money, Screen, SectionTitle } from '../src/ui/components';
import { EntryList } from '../src/ui/entry-list';
import { selectEntries } from '../src/ui/presentation';
import { periodLabel } from '../src/ui/spending-timeline';
import { useCategoryLookOf } from '../src/ui/category-hues';
import { useCurrentDay } from '../src/ui/theme';

export default function SpendingDetailScreen() {
  const { snapshot } = useLedger();
  const today = useCurrentDay();
  const lookOf = useCategoryLookOf('expense');
  const { currency, startISO, endISO, category } = useLocalSearchParams<{ currency?: string; startISO?: string; endISO?: string; category?: string }>();
  if (!snapshot) return null;
  if ((currency !== 'ARS' && currency !== 'USD') || typeof startISO !== 'string' || typeof endISO !== 'string'
    || !validDateISO(startISO) || !validDateISO(endISO) || startISO > endISO || endISO > today
    || (Date.parse(endISO) - Date.parse(startISO)) / 86400000 > 30
    || (category !== undefined && (typeof category !== 'string' || !category))
    || !snapshot.accounts.some(a => a.currency === currency)) return <Screen><EmptyState title="Período no válido" detail="Volvé a Inicio para elegir las fechas." /></Screen>;
  const period: ReportPeriod = { currency, startISO, endISO };
  const report = spendingOverview(snapshot, period);
  const entries = selectEntries(expensesInPeriod(snapshot, period, category), snapshot.accounts);
  const group = category ? report.categories.find(c => c.key === category) : undefined;
  const total = report.status === 'ready' ? category ? group?.amountMinor ?? 0 : report.expenseMinor : null;
  // Same header as the report's category screen: the category as its tile, the name, the period, the total.
  return <EntryList entries={entries} accounts={snapshot.accounts} header={<View style={{ gap: 22 }}>
    <View style={{ gap: 12, paddingTop: 8 }}>
      {group && <CategoryBadge category={group.category} large />}
      <AppText accessibilityRole="header" variant="title1">{group ? lookOf(group.category).label : 'Gastos registrados'}</AppText>
      <AppText secondary variant="subhead">{periodLabel(period)} · {currency}</AppText>
    </View>
    <View style={{ gap: 10 }}>
      {total !== null ? <Money minor={total} currency={currency} large /> : <AppText secondary>No podemos mostrar este total con precisión.</AppText>}
      <AppText secondary variant="subhead">{entries.length === 1 ? '1 gasto registrado' : entries.length + ' gastos registrados'}</AppText>
    </View>
    {entries.length ? <SectionTitle>Movimientos</SectionTitle> : <AppText secondary>No hay gastos registrados para estas fechas y moneda.</AppText>}
  </View>} />;
}
