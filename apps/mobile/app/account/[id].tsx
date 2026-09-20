import { useMemo } from 'react';
import { View } from 'react-native';
import { Redirect, router, Stack, useLocalSearchParams } from 'expo-router';
import { accountBalanceMinor, currentMonthISO, formatMinorUnits } from '@finanzapp/domain';
import { useLedger } from '../../src/storage/LedgerProvider';
import { ActionButton, AppText, DetailRow, EmptyState, IconButton, Money, Screen, SectionTitle, Stat, Surface } from '../../src/ui/components';
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
        <AppText secondary variant="eyebrow">Saldo registrado · {account.currency}</AppText>
        <Money minor={balance} currency={account.currency} large color={balance < 0 ? p.expense : undefined} />
        <AppText secondary variant="subhead">Resultado de lo que registraste. No es sincronización bancaria.</AppText>
      </View>
      {month && <Surface style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
        <Stat label="Gastos este mes"><Money minor={-month.expense} currency={account.currency} size={17} tone="expense" signed={month.expense > 0} /></Stat>
        <Stat label="Ingresos este mes" align="right"><Money minor={month.income} currency={account.currency} size={17} tone={month.income ? 'income' : 'neutral'} signed={month.income > 0} /></Stat>
      </Surface>}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <ActionButton label="Gasto" icon="remove-outline" compact containerStyle={{ flex: 1 }}
          onPress={() => router.push({ pathname: '/new-entry', params: { kind: 'expense', accountId: id } })} />
        <ActionButton label="Ingreso" icon="add-outline" compact secondary containerStyle={{ flex: 1 }}
          onPress={() => router.push({ pathname: '/new-entry', params: { kind: 'income', accountId: id } })} />
        <ActionButton label="Transferir" icon="swap-horizontal-outline" compact secondary containerStyle={{ flex: 1 }}
          onPress={() => router.push({ pathname: '/new-transfer', params: { accountId: id } })} />
      </View>
      <Surface grouped>
        <DetailRow label="Recurrentes" value={recurringCount ? recurringCount + (recurringCount === 1 ? ' activo' : ' activos') : 'Programar'} icon="repeat-outline"
          onPress={() => router.push({ pathname: '/recurring', params: { accountId: id } })} />
        <DetailRow label="Saldo inicial" value={account.currency + ' ' + formatMinorUnits(account.openingMinor)} icon="flag-outline" last />
      </Surface>
      <SectionTitle caption="Solo movimientos de esta cuenta">Movimientos</SectionTitle>
    </View>} empty={<AppText secondary variant="subhead">Todavía no hay movimientos en esta cuenta.</AppText>} />
  </>;
}
