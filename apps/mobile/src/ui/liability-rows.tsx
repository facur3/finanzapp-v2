import { router } from 'expo-router';
import { View } from 'react-native';
import { debtOutstandingMinor, type PersonalDebtProfile } from '@finanzapp/domain';
import { useI18n } from '../i18n/provider';
import { useLedger } from '../storage/LedgerProvider';
import { AppText, GlyphTile, Money, PressFeedback, useStacked } from './components';
import { useCurrentDay, usePalette } from './theme';

/** One debt or receivable: who, status and the outstanding amount. Amber marks
 * what I owe, green what they owe me; the amount itself stays ink. */
export function DebtRow({ debt, last }: { debt: PersonalDebtProfile; last: boolean }) {
  const { snapshot } = useLedger();
  const p = usePalette();
  const day = useCurrentDay();
  const { t, relativeDate, spokenNumber } = useI18n();
  const account = snapshot?.accounts.find(item => item.id === debt.accountId);
  if (!snapshot || !account) return null;
  const outstanding = debtOutstandingMinor(debt, snapshot);
  const owed = debt.direction === 'owed_by_me';
  const overdue = !!debt.dueDateISO && debt.dueDateISO < day && outstanding > 0;
  const due = debt.dueDateISO ? relativeDate(debt.dueDateISO, day) : null;
  const stacked = useStacked({ minor: outstanding, currency: account.currency });
  const status = outstanding === 0 ? t('debts.status.settled') : overdue ? t('debts.status.overdue', { date: due! }) : due ? t('debts.status.due', { date: due }) : t('debts.status.noDate');
  return <PressFeedback feedback="highlight" accessibilityRole="button"
    accessibilityLabel={t(owed ? 'debts.row.owedLabel' : 'debts.row.receivableLabel', { name: debt.counterparty, amount: spokenNumber(outstanding), currency: account.currency, status })}
    onPress={() => router.push({ pathname: '/debt/[id]', params: { id: debt.id } })}
    style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 16, minHeight: 64,
      borderBottomWidth: last ? 0 : 0.5, borderBottomColor: p.line }}>
    <GlyphTile icon={owed ? 'arrow-up-outline' : 'arrow-down-outline'} tone={owed ? 'warning' : 'income'} />
    <View style={{ flex: 1, minWidth: 0, gap: 8, flexDirection: stacked ? 'column' : 'row', alignItems: stacked ? 'flex-start' : 'center' }}>
      <View style={{ flex: stacked ? undefined : 1, minWidth: 0, gap: 3 }}>
        <AppText numberOfLines={stacked ? undefined : 2} style={{ fontWeight: '500' }}>{debt.counterparty}</AppText>
        <AppText secondary variant="footnote" style={overdue ? { color: p.expense } : undefined}>{t(owed ? 'debts.list.owed' : 'debts.list.receivable')} · {status}</AppText>
      </View>
      <View style={{ maxWidth: stacked ? '100%' : '56%', alignItems: stacked ? 'flex-start' : 'flex-end' }}><Money minor={outstanding} currency={account.currency} /></View>
    </View>
  </PressFeedback>;
}
