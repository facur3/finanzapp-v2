import { useLocalSearchParams } from 'expo-router';
import { dailySpending, expensesInPeriod, validDateISO, type ReportPeriod } from '@finanzapp/domain';
import { useLedger } from '../src/storage/LedgerProvider';
import { AppText, EmptyState, Money, Screen } from '../src/ui/components';
import { EntryList } from '../src/ui/entry-list';
import { selectEntries } from '../src/ui/presentation';
import { useCurrentDay } from '../src/ui/theme';
import { View } from 'react-native';

export default function ReportDayScreen() {
  const params = useLocalSearchParams<{ currency?: string; date?: string }>();
  const { snapshot } = useLedger();
  const today = useCurrentDay();
  if (!snapshot) return null;
  const { currency, date } = params;
  if ((currency !== 'ARS' && currency !== 'USD') || typeof date !== 'string' || !validDateISO(date) || date > today
    || !snapshot.accounts.some(a => a.currency === currency)) return <Screen><EmptyState title="Día no válido" detail="Volvé al reporte para elegir un día." /></Screen>;
  const period: ReportPeriod = { currency, startISO: date, endISO: date };
  const entries = selectEntries(expensesInPeriod(snapshot, period), snapshot.accounts);
  let total: number | null = null;
  try { total = dailySpending(snapshot, period)[0]?.amountMinor ?? 0; } catch { /* Keep the records accessible when their sum exceeds the safe range. */ }
  return <EntryList entries={entries} accounts={snapshot.accounts} header={<View style={{ gap: 16 }}>
    <AppText accessibilityRole="header" style={{ fontSize: 24, fontWeight: '700' }}>{new Date(date + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })}</AppText>
    {total !== null ? <Money minor={total} currency={currency} large /> : <AppText>No podemos mostrar el total con precisión.</AppText>}
    <AppText secondary>{entries.length} gastos registrados · {currency}</AppText>
    {!entries.length && <EmptyState title="Sin gastos registrados" detail="No hay gastos para este día y moneda." />}
  </View>} />;
}
