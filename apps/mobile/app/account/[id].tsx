import { useMemo } from 'react';
import { View } from 'react-native';
import { Redirect, router, Stack, useLocalSearchParams } from 'expo-router';
import { accountBalanceMinor, currentMonthISO } from '@finanzapp/domain';
import { useLedger } from '../../src/storage/LedgerProvider';
import { AccountBadge, AppText, DetailRow, EmptyState, IconButton, Money, Screen, SectionTitle, Stat, Surface, StatRow } from '../../src/ui/components';
import { useI18n } from '../../src/i18n/provider';
import { QuickActions } from '../../src/ui/quick-actions';
import { EntryList } from '../../src/ui/entry-list';
import { selectEntries, selectTransfers } from '../../src/ui/presentation';
import { space, useCurrentDay, usePalette } from '../../src/ui/theme';

/** A cash account as a financial object: its recorded balance, this month's
 * recorded income and expenses, the three actions it supports and its history.
 * Cards and debts redirect to their own screens. */
export default function AccountScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { snapshot, archive } = useLedger();
  const day = useCurrentDay();
  const p = usePalette();
  const { t, codedAmount, spokenAmount } = useI18n();
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
  return <>
    <Stack.Screen options={{ title: account.name, headerRight: () => <IconButton name="create-outline" label={t('accounts.detail.edit')}
      onPress={() => router.push({ pathname: '/edit-account/[id]', params: { id } })} /> }} />
    <EntryList entries={entries} transfers={transfers} accountId={id} accounts={snapshot.accounts} header={<View style={{ gap: space.xl, paddingBottom: 4 }}>
      <View style={{ gap: 8, paddingTop: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <AccountBadge accountId={id} size={32} />
          <AppText secondary variant="subhead" style={{ fontWeight: '500' }}>{t('accounts.detail.recordedBalance')}</AppText>
        </View>
        <Money minor={balance} currency={account.currency} large color={balance < 0 ? p.expense : undefined} />
      </View>
      {month && <Surface><StatRow>
        <Stat label={t('accounts.detail.monthExpenses')}><Money minor={-month.expense} currency={account.currency} size={17} tone="expense" signed={month.expense > 0} /></Stat>
        <Stat label={t('accounts.detail.monthIncome')}><Money minor={month.income} currency={account.currency} size={17} tone={month.income ? 'income' : 'neutral'} signed={month.income > 0} /></Stat>
      </StatRow></Surface>}
      <QuickActions accountId={id} currency={account.currency} />
      <Surface grouped>
        <DetailRow label={t('accounts.detail.recurring')} value={recurringCount ? t('accounts.detail.activeRecurring', { count: recurringCount }) : t('accounts.detail.schedule')} icon="repeat-outline"
          onPress={() => router.push({ pathname: '/recurring', params: { accountId: id } })} />
        <DetailRow label={t('accounts.detail.openingBalance')} value={codedAmount(account.openingMinor, account.currency)}
          spokenValue={spokenAmount(account.openingMinor, account.currency)} icon="flag-outline" last />
      </Surface>
      <SectionTitle>{t('accounts.detail.movements')}</SectionTitle>
    </View>} empty={<AppText secondary variant="subhead">{t('accounts.detail.empty')}</AppText>} />
  </>;
}
