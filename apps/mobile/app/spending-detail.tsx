import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { expensesInPeriod, spendingOverview, validDateISO, type ReportPeriod } from '@finanzapp/domain';
import { useLedger } from '../src/storage/LedgerProvider';
import { AppText, EmptyState, Money, Screen } from '../src/ui/components';
import { EntryList } from '../src/ui/entry-list';
import { selectEntries } from '../src/ui/presentation';
import { periodLabel } from '../src/ui/spending-timeline';
import { useCurrentDay } from '../src/ui/theme';

export default function SpendingDetailScreen() {
  const { snapshot } = useLedger();
  const today = useCurrentDay();
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
  return <EntryList entries={entries} accounts={snapshot.accounts} header={<View style={{ gap: 14 }}>
    <AppText accessibilityRole="header" style={{ fontSize: 26, fontWeight: '700' }}>{group?.category ?? 'Gastos registrados'}</AppText>
    <AppText secondary>{periodLabel(period)} · {currency}</AppText>
    {total !== null ? <Money minor={total} currency={currency} large /> : <AppText secondary>No podemos mostrar este total con precisión.</AppText>}
    <AppText secondary>{entries.length} gastos registrados</AppText>
    {!entries.length && <AppText secondary>No hay gastos registrados para estas fechas y moneda.</AppText>}
  </View>} />;
}
