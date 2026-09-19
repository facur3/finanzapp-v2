import { useMemo } from 'react';
import { View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { accountBalanceMinor, formatMinorUnits } from '@finanzapp/domain';
import { useLedger } from '../../src/storage/LedgerProvider';
import { AppText, DetailRow, EmptyState, EntryActions, IconButton, Money, Screen, SectionTitle, Surface } from '../../src/ui/components';
import { EntryList } from '../../src/ui/entry-list';
import { selectEntries, selectTransfers } from '../../src/ui/presentation';

export default function AccountScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { snapshot } = useLedger();
  const entries = useMemo(() => snapshot ? selectEntries(snapshot.entries, snapshot.accounts, 'all', '', id) : [], [snapshot, id]);
  const transfers = useMemo(() => snapshot ? selectTransfers(snapshot.transfers ?? [], snapshot.accounts, '', id) : [], [snapshot, id]);
  const account = snapshot?.accounts.find(item => item.id === id);
  if (!account || !snapshot) return <Screen><EmptyState title="No encontramos esta cuenta"
    detail="Volvé a tus cuentas para elegir una guardada en este dispositivo." /></Screen>;
  return <>
    <Stack.Screen options={{ title: account.name, headerRight: () => <IconButton name="create-outline" label="Editar cuenta"
      onPress={() => router.push({ pathname: '/edit-account/[id]', params: { id } })} /> }} />
    <EntryList entries={entries} transfers={transfers} accountId={id} accounts={snapshot.accounts} header={<View style={{ gap: 24 }}>
      <View style={{ gap: 12, paddingVertical: 12 }}><AppText secondary>Saldo registrado · {account.currency}</AppText>
        <Money minor={accountBalanceMinor(account, entries, transfers)} currency={account.currency} large /></View>
      <EntryActions accountId={id} />
      <View><Surface grouped>
        <DetailRow label="Transferir" value="Entre mis cuentas" icon="swap-horizontal-outline" onPress={() => router.push({ pathname: '/new-transfer', params: { accountId: id } })} />
        <DetailRow label="Saldo inicial" value={account.currency + ' ' + formatMinorUnits(account.openingMinor)} last /></Surface>
        <AppText secondary style={{ fontSize: 13, paddingTop: 8 }}>Tu punto de partida. No se cuenta como ingreso.</AppText></View>
      <SectionTitle>Movimientos</SectionTitle>
    </View>} empty={<AppText secondary>Todavía no hay movimientos en esta cuenta.</AppText>} />
  </>;
}
