import { useMemo } from 'react';
import { View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { accountBalanceMinor, formatMinorUnits } from '@finanzapp/domain';
import { useLedger } from '../../src/storage/LedgerProvider';
import { AppText, DetailRow, EmptyState, EntryActions, Money, Screen, SectionTitle, Surface } from '../../src/ui/components';
import { EntryList } from '../../src/ui/entry-list';
import { selectEntries } from '../../src/ui/presentation';

export default function AccountScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { snapshot } = useLedger();
  const entries = useMemo(() => snapshot ? selectEntries(snapshot.entries, snapshot.accounts, 'all', '', id) : [], [snapshot, id]);
  const account = snapshot?.accounts.find(item => item.id === id);
  if (!account || !snapshot) return <Screen><EmptyState title="No encontramos esta cuenta"
    detail="Volvé a tus cuentas para elegir una guardada en este dispositivo." /></Screen>;
  return <>
    <Stack.Screen options={{ title: account.name }} />
    <EntryList entries={entries} accounts={snapshot.accounts} header={<View style={{ gap: 24 }}>
      <View style={{ gap: 12, paddingVertical: 12 }}><AppText secondary>Saldo disponible · {account.currency}</AppText>
        <Money minor={accountBalanceMinor(account, entries)} currency={account.currency} large /></View>
      <EntryActions accountId={id} />
      <View><Surface grouped><DetailRow label="Saldo inicial" value={account.currency + ' ' + formatMinorUnits(account.openingMinor)} last /></Surface>
        <AppText secondary style={{ fontSize: 13, paddingTop: 8 }}>Tu punto de partida. No se cuenta como ingreso.</AppText></View>
      <SectionTitle>Movimientos</SectionTitle>
    </View>} empty={<AppText secondary>Todavía no hay movimientos en esta cuenta.</AppText>} />
  </>;
}
