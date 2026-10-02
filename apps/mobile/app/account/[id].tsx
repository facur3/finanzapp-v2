import { useMemo } from 'react';
import { View } from 'react-native';
import { Redirect, router, Stack, useLocalSearchParams } from 'expo-router';
import { accountBalanceMinor, currentMonthISO, isLiveAccount } from '@finanzapp/domain';
import { useLedger } from '../../src/storage/LedgerProvider';
import { AccountBadge, AppText, DetailRow, EmptyState, IconButton, LifecycleNote, Money, Screen, SectionTitle, Stat, Surface, StatRow } from '../../src/ui/components';
import { withCurrencyCode } from '../../src/i18n/format';
import { useI18n } from '../../src/i18n/provider';
import { QuickActions } from '../../src/ui/quick-actions';
import { EntryList } from '../../src/ui/entry-list';
import { selectEntries, selectTransfers } from '../../src/ui/presentation';
import { space, useCurrentDay, usePalette } from '../../src/ui/theme';

/** A cash account as a financial object: its recorded balance, this month's
 * recorded income and expenses, the three actions it supports and its history.
 * Cards and debts redirect to their own screens. The opening balance (25B3) is
 * part of the ledger (`openingMinor`: stored, backed up, the start of every
 * balance) but not a daily figure, so it has no row here; the recorded balance
 * already carries it, and the backup file keeps it readable for an audit.
 *
 * 24UX6E: the balance and this month's facts are one flat status block on the canvas (the shape of a card's
 * `CardStatusBlock`): «Saldo registrado · ARS» with the badge, the balance at 40 pt (the expense tone only when it is
 * really negative), then Gastos · Ingresos este mes with no surface of their own. «Gastos este mes» is a labelled sum
 * of expenses, unsigned in ink like Recurrentes' «Gastos» (24UX6C keeps signs for balances, nets and differences);
 * «Ingresos este mes» keeps its «+» in green. A deleted account says so once, calmly, in a `LifecycleNote` at the top
 * (the state, under the navigation title that names it); its balance keeps its label and its month facts stay, as
 * history. */
export default function AccountScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { snapshot, archive } = useLedger();
  const day = useCurrentDay();
  const p = usePalette();
  const { t } = useI18n();
  const entries = useMemo(() => snapshot ? selectEntries(snapshot.entries, snapshot.accounts, 'all', '', id) : [], [snapshot, id]);
  const transfers = useMemo(() => snapshot ? selectTransfers(snapshot.transfers ?? [], snapshot.accounts, '', id) : [], [snapshot, id]);
  const account = snapshot?.accounts.find(item => item.id === id);
  const recurringCount = archive?.recurring?.filter(rule => rule.accountId === id && rule.active).length ?? 0;
  const card = archive?.cards?.find(item => item.accountId === id);
  const debt = archive?.debts?.find(item => item.accountId === id);
  const month = useMemo(() => {
    const monthISO = currentMonthISO(day);
    let expense = 0, income = 0;
    for (const entry of entries) {
      if (entry.dateISO.slice(0, 7) !== monthISO || entry.dateISO > day) continue;
      if (entry.kind === 'expense') expense += entry.amountMinor; else income += entry.amountMinor;
    }
    return Number.isSafeInteger(expense) && Number.isSafeInteger(income) ? { expense, income } : null;
  }, [entries, day]);
  if (card) return <Redirect href={{ pathname: '/card/[id]', params: { id: card.id } }} />;
  if (debt) return <Redirect href={{ pathname: '/debt/[id]', params: { id: debt.id } }} />;
  if (!account || !snapshot) return <Screen><EmptyState title={t('accounts.detail.notFoundTitle')}
    detail={t('accounts.detail.notFoundDetail')} /></Screen>;
  const balance = accountBalanceMinor(account, entries, transfers);
  // 25B2: a deleted account is read, never edited or posted to; its history and balance stay exactly as recorded.
  const live = isLiveAccount(account);
  return <>
    <Stack.Screen options={{ title: account.name, headerRight: live ? () => <IconButton name="create-outline" label={t('accounts.detail.edit')}
      onPress={() => router.push({ pathname: '/edit-account/[id]', params: { id } })} /> : undefined }} />
    <EntryList entries={entries} transfers={transfers} accountId={id} accounts={snapshot.accounts} header={<View style={{ gap: space.xl, paddingTop: space.s, paddingBottom: 4 }}>
      {!live && <LifecycleNote icon="trash-outline" title={t('accounts.manage.deletedTitle')} detail={t('accounts.manage.deletedNote')} />}
      <View style={{ gap: space.xl }}>
        <View style={{ gap: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <AccountBadge accountId={id} size={32} />
            <AppText secondary variant="footnote" style={{ flexShrink: 1, fontWeight: '500' }}>{withCurrencyCode(t('accounts.detail.recordedBalance'), account.currency)}</AppText>
          </View>
          <Money minor={balance} currency={account.currency} large size={40} color={balance < 0 ? p.expense : undefined} />
        </View>
        {month && <StatRow>
          <Stat label={t('accounts.detail.monthExpenses')}><Money minor={month.expense} currency={account.currency} size={17} /></Stat>
          <Stat label={t('accounts.detail.monthIncome')}><Money minor={month.income} currency={account.currency} size={17} tone={month.income ? 'income' : 'neutral'} signed={month.income > 0} /></Stat>
        </StatRow>}
      </View>
      {live && <QuickActions accountId={id} currency={account.currency} />}
      {live && <Surface grouped>
        <DetailRow label={t('accounts.detail.recurring')} value={recurringCount ? t('accounts.detail.activeRecurring', { count: recurringCount }) : t('accounts.detail.schedule')} icon="repeat-outline"
          onPress={() => router.push({ pathname: '/recurring', params: { accountId: id } })} last />
      </Surface>}
      <SectionTitle>{t('accounts.detail.movements')}</SectionTitle>
    </View>} empty={<AppText secondary variant="subhead">{t('accounts.detail.empty')}</AppText>} />
  </>;
}
