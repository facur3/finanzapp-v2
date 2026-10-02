import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { debtOutstandingMinor, type PersonalDebtProfile } from '@finanzapp/domain';
import { useI18n } from '../i18n/provider';
import { useLedger } from '../storage/LedgerProvider';
import { AppText, GlyphTile, Money, PressFeedback, useStacked } from './components';
import { debtDueState, spokenDueDay } from './liability-presentation';
import { SwipeRow, swipeAccessibility, type SwipeAction } from './swipe-actions';
import { useCurrentDay, usePalette } from './theme';

/** One debt or receivable: who, status and the outstanding amount. A closed debt
 * says «Cerrada» where its due state would be. Its management actions (24UX4) are
 * trailing swipe actions and VoiceOver custom actions on the same row.
 *
 * 24UX6E: colour marks the due state, never the direction. The tile is neutral (its
 * arrow, the caption word and the section say who owes whom) and the amount stays
 * ink; only the state words of the caption take a tone: overdue in the alert colour,
 * due within three days (a debt I owe) in amber (`debtDueState`). VoiceOver hears the
 * day written out, as on the detail. */
export function DebtRow({ debt, last, actions = [] }: { debt: PersonalDebtProfile; last: boolean; actions?: SwipeAction[] }) {
  const { snapshot } = useLedger();
  const p = usePalette();
  const day = useCurrentDay();
  const { t, relativeDate, spokenMinor, locale } = useI18n();
  const account = snapshot?.accounts.find(item => item.id === debt.accountId);
  const outstanding = snapshot && account ? debtOutstandingMinor(debt, snapshot) : 0;
  // A hook, so it runs before the early return on every render.
  const stacked = useStacked(account ? { minor: outstanding, currency: account.currency } : undefined);
  if (!snapshot || !account) return null;
  const owed = debt.direction === 'owed_by_me';
  const state = debtDueState(debt, outstanding, day);
  // "Vencida · Ayer" names the day after a separator; "Vence hoy" places it inside the sentence.
  const statusWith = (date: (iso: string, inline: boolean) => string) => state === 'closed' ? t('debts.status.closed') : state === 'settled' ? t('debts.status.settled')
    : state === 'none' ? t('debts.status.noDate') : state === 'overdue' ? t('debts.status.overdue', { date: date(debt.dueDateISO!, false) })
      : t('debts.status.due', { date: date(debt.dueDateISO!, true) });
  const status = statusWith((iso, inline) => relativeDate(iso, day, inline));
  const spokenStatus = statusWith((iso, inline) => spokenDueDay(iso, day, locale, inline));
  const tone = state === 'overdue' ? p.expense : state === 'soon' ? p.warning : undefined;
  return <SwipeRow actions={actions}><PressFeedback feedback="highlight" accessibilityRole="button"
    accessibilityLabel={t(owed ? 'debts.row.owedLabel' : 'debts.row.receivableLabel', { name: debt.counterparty, amount: spokenMinor(outstanding, account.currency), currency: account.currency, status: spokenStatus })}
    accessibilityHint={t('debts.row.openHint')}
    {...swipeAccessibility(actions)}
    onPress={() => router.push({ pathname: '/debt/[id]', params: { id: debt.id } })}
    style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 16, minHeight: 64,
      borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth, borderBottomColor: p.line }}>
    <GlyphTile icon={owed ? 'arrow-up-outline' : 'arrow-down-outline'} />
    <View style={{ flex: 1, minWidth: 0, gap: 8, flexDirection: stacked ? 'column' : 'row', alignItems: stacked ? 'flex-start' : 'center' }}>
      <View style={{ flex: stacked ? undefined : 1, minWidth: 0, gap: 3 }}>
        <AppText numberOfLines={stacked ? undefined : 2} style={{ fontWeight: '500' }}>{debt.counterparty}</AppText>
        <AppText secondary variant="footnote">{t(owed ? 'debts.list.owed' : 'debts.list.receivable')} · <AppText secondary={!tone} variant="footnote"
          style={tone ? { color: tone, fontWeight: '500' } : undefined}>{status}</AppText></AppText>
      </View>
      <View style={{ maxWidth: stacked ? '100%' : '56%', alignItems: stacked ? 'flex-start' : 'flex-end' }}><Money minor={outstanding} currency={account.currency} /></View>
    </View>
  </PressFeedback></SwipeRow>;
}
