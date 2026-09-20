import { router } from 'expo-router';
import { View } from 'react-native';
import { debtOutstandingMinor, formatMinorUnits, labelFromISO, type PersonalDebtProfile } from '@finanzapp/domain';
import { useLedger } from '../storage/LedgerProvider';
import { AppText, GlyphTile, Money, PressFeedback } from './components';
import { useCurrentDay, usePalette } from './theme';

/** One debt or receivable: who, status and the outstanding amount. Amber marks
 * what I owe, green what they owe me; the amount itself stays ink. */
export function DebtRow({ debt, last }: { debt: PersonalDebtProfile; last: boolean }) {
  const { snapshot } = useLedger();
  const p = usePalette();
  const day = useCurrentDay();
  const account = snapshot?.accounts.find(item => item.id === debt.accountId);
  if (!snapshot || !account) return null;
  const outstanding = debtOutstandingMinor(debt, snapshot);
  const owed = debt.direction === 'owed_by_me';
  const overdue = !!debt.dueDateISO && debt.dueDateISO < day && outstanding > 0;
  const due = debt.dueDateISO ? labelFromISO(debt.dueDateISO, new Date(day + 'T12:00:00')) : null;
  const status = outstanding === 0 ? 'Saldada' : overdue ? 'Vencida · ' + due : due ? 'Vence ' + due : 'Sin fecha';
  return <PressFeedback accessibilityRole="button"
    accessibilityLabel={`${owed ? 'Debo a' : 'Me debe'} ${debt.counterparty}, ${formatMinorUnits(outstanding)} ${account.currency}, ${status}`}
    onPress={() => router.push({ pathname: '/debt/[id]', params: { id: debt.id } })}
    style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 16, minHeight: 64,
      borderBottomWidth: last ? 0 : 0.5, borderBottomColor: p.line }}>
    <GlyphTile icon={owed ? 'arrow-up-outline' : 'arrow-down-outline'} tone={owed ? 'warning' : 'income'} />
    <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
      <AppText numberOfLines={1} style={{ fontWeight: '500' }}>{debt.counterparty}</AppText>
      <AppText secondary variant="footnote" style={overdue ? { color: p.expense } : undefined}>{owed ? 'Debo' : 'Me deben'} · {status}</AppText>
    </View>
    <Money minor={outstanding} currency={account.currency} />
  </PressFeedback>;
}
