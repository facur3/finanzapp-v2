import { View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { accountBalanceMinor } from '@finanzapp/domain';
import { useLedger } from '../../src/storage/LedgerProvider';
import { ActionButton, AppText, EmptyState, EntryRow, Money, Screen, SectionTitle, Surface } from '../../src/ui/components';

export default function AccountScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { snapshot } = useLedger();
  const account = snapshot?.accounts.find(item => item.id === id);
  if (!account || !snapshot) return <Screen><EmptyState title="No encontramos esta cuenta"
    detail="Volvé a la lista de cuentas para elegir una que esté guardada en este dispositivo." /></Screen>;
  const entries = snapshot.entries.filter(entry => entry.accountId === id);
  return <Screen>
    <Stack.Screen options={{ title: account.name }} />
    <View style={{ gap: 8 }}><AppText secondary>Saldo actual · {account.currency}</AppText>
      <Money minor={accountBalanceMinor(account, entries)} currency={account.currency} large /></View>
    <ActionButton label="Registrar movimiento" onPress={() => router.push({ pathname: '/new-entry', params: { accountId: id } })} />
    <View><SectionTitle>Movimientos</SectionTitle>
      {entries.length ? <Surface>{entries.map(entry => <EntryRow key={entry.id} entry={entry} account={account} />)}</Surface>
        : <AppText secondary>Todavía no registraste movimientos en esta cuenta.</AppText>}
    </View>
    <Surface><AppText secondary>Saldo inicial</AppText><Money minor={account.openingMinor} currency={account.currency} />
      <AppText secondary style={{ fontSize: 14 }}>El punto de partida de esta cuenta. No se suma como ingreso.</AppText></Surface>
  </Screen>;
}
