import { View } from 'react-native';
import { router } from 'expo-router';
import { accountBalanceMinor, totalsByCurrency, type Currency } from '@finanzapp/domain';
import { useLedger } from '../../src/storage/LedgerProvider';
import { ActionButton, AppText, EmptyState, EntryRow, Money, PressFeedback, Screen, SectionTitle, Surface } from '../../src/ui/components';

export default function HomeScreen() {
  const { snapshot } = useLedger();
  if (!snapshot) return null;
  const totals = totalsByCurrency(snapshot);
  return <Screen>
    {!snapshot.accounts.length ? <EmptyState title="Tu dinero, más claro."
      detail="Agregá tu primera cuenta y su saldo actual. Después podés registrar lo que entra y lo que sale."
      action={<ActionButton label="Agregar cuenta" onPress={() => router.push('/new-account')} />} /> : <>
      <View style={{ gap: 16 }}>
        <AppText secondary>Saldo de tus cuentas</AppText>
        {Object.entries(totals).map(([currency, minor]) => <View key={currency} style={{ gap: 5 }}>
          <AppText secondary style={{ fontSize: 13 }}>{currency === 'ARS' ? 'Pesos argentinos' : 'Dólares estadounidenses'}</AppText>
          <Money minor={minor!} currency={currency as Currency} large />
        </View>)}
      </View>
      <ActionButton label="Registrar movimiento" onPress={() => router.push('/new-entry')} />
      <View><SectionTitle>Cuentas</SectionTitle><Surface>
        {snapshot.accounts.map(account => <PressFeedback key={account.id} accessibilityRole="button"
          accessibilityLabel={`Ver cuenta ${account.name}`} onPress={() => router.push({ pathname: '/account/[id]', params: { id: account.id } })}
          style={{ gap: 5, paddingVertical: 10 }}>
          <AppText>{account.name}</AppText><Money minor={accountBalanceMinor(account, snapshot.entries)} currency={account.currency} />
        </PressFeedback>)}
        <ActionButton label="Agregar cuenta" onPress={() => router.push('/new-account')} secondary />
      </Surface></View>
      <View><SectionTitle>Últimos movimientos</SectionTitle>
        {snapshot.entries.length ? <Surface>{snapshot.entries.slice(0, 5).map(entry => <EntryRow key={entry.id} entry={entry}
          account={snapshot.accounts.find(account => account.id === entry.accountId)!} />)}</Surface>
          : <AppText secondary>Acá vas a ver los movimientos que registres.</AppText>}
      </View>
    </>}
  </Screen>;
}
