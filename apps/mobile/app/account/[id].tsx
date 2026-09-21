import { useMemo } from 'react';
import { View } from 'react-native';
import { Redirect, router, Stack, useLocalSearchParams } from 'expo-router';
import { accountBalanceMinor, currentMonthISO, formatMinorUnits } from '@finanzapp/domain';
import { useLedger } from '../../src/storage/LedgerProvider';
import { AppText, DetailRow, EmptyState, IconButton, Money, Screen, SectionTitle, Stat, Surface } from '../../src/ui/components';
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
  if (!account || !snapshot) return <Screen><EmptyState title="No encontramos esta cuenta"
    detail="Volvé a tus cuentas para elegir una guardada en este dispositivo." /></Screen>;
  const balance = accountBalanceMinor(account, entries, transfers);
  return <>
    <Stack.Screen options={{ title: account.name, headerRight: () => <IconButton name="create-outline" label="Editar cuenta"
      onPress={() => router.push({ pathname: '/edit-account/[id]', params: { id } })} /> }} />
    <EntryList entries={entries} transfers={transfers} accountId={id} accounts={snapshot.accounts} header={<View style={{ gap: space.xl, paddingBottom: 4 }}>
      <View style={{ gap: 8, paddingTop: 8 }}>
        <AppText secondary variant="subhead" style={{ fontWeight: '500' }}>Saldo registrado</AppText>
        <Money minor={balance} currency={account.currency} large color={balance < 0 ? p.expense : undefined} />
      </View>
      {month && <Surface style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
        <Stat label="Gastos este mes"><Money minor={-month.expense} currency={account.currency} size={17} tone="expense" signed={month.expense > 0} /></Stat>
        <Stat label="Ingresos este mes" align="right"><Money minor={month.income} currency={account.currency} size={17} tone={month.income ? 'income' : 'neutral'} signed={month.income > 0} /></Stat>
      </Surface>}
      <QuickActions accountId={id} currency={account.currency} />
      <Surface grouped>
        <DetailRow label="Recurrentes" value={recurringCount ? recurringCount + (recurringCount === 1 ? ' activo' : ' activos') : 'Programar'} icon="repeat-outline"
          onPress={() => router.push({ pathname: '/recurring', params: { accountId: id } })} />
        <DetailRow label="Saldo inicial" value={account.currency + ' ' + formatMinorUnits(account.openingMinor)} icon="flag-outline" last />
      </Surface>
      <SectionTitle>Movimientos</SectionTitle>
    </View>} empty={<AppText secondary variant="subhead">Todavía no hay movimientos en esta cuenta.</AppText>} />
  </>;
}
