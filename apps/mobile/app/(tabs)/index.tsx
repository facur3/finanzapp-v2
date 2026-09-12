import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { totalsByCurrency, type Currency } from '@finanzapp/domain';
import { useLedger } from '../../src/storage/LedgerProvider';
import { AccountRow, ActionButton, AppText, Choices, EmptyState, EntryActions, EntryRow, Money, Screen, SectionTitle, Surface } from '../../src/ui/components';
import { availableCurrencies, selectEntries } from '../../src/ui/presentation';

export default function HomeScreen() {
  const { snapshot } = useLedger();
  const [selectedCurrency, setCurrency] = useState<Currency>('ARS');
  const recent = useMemo(() => snapshot ? selectEntries(snapshot.entries, snapshot.accounts).slice(0, 4) : [], [snapshot]);
  if (!snapshot) return null;
  const currencies = availableCurrencies(snapshot.accounts);
  const currency = currencies.includes(selectedCurrency) ? selectedCurrency : currencies[0];
  const totals = totalsByCurrency(snapshot);
  const accounts = snapshot.accounts.filter(account => account.currency === currency);
  return <Screen>
    {!snapshot.accounts.length ? <EmptyState title="Tu dinero, más claro."
      detail="Empezá con una cuenta y su saldo actual. Desde ahí vas a poder ver lo que entra y lo que sale."
      action={<ActionButton label="Agregar mi primera cuenta" icon="add-outline" onPress={() => router.push('/new-account')} />} /> : <>
      <View style={{ gap: 14, paddingVertical: 12 }}>
        <AppText secondary style={{ fontSize: 16 }}>Disponible en tus cuentas</AppText>
        {currencies.length > 1 && <Choices value={currency} onChange={setCurrency}
          options={currencies.map(value => ({ value, label: value === 'ARS' ? 'Pesos · ARS' : 'Dólares · USD' }))} />}
        <Money minor={totals[currency]!} currency={currency} large />
        <AppText secondary style={{ fontSize: 14 }}>
          {accounts.length === 1 ? accounts[0].name : accounts.length + ' cuentas'} · {currency}
        </AppText>
      </View>
      <EntryActions currency={currency} />
      <View>
        <SectionTitle action="Ver todos" onAction={() => router.navigate('/activity')}>Movimientos recientes</SectionTitle>
        {recent.length ? <Surface grouped>{recent.map((entry, index) => <EntryRow key={entry.id} entry={entry}
          account={snapshot.accounts.find(account => account.id === entry.accountId)!} last={index === recent.length - 1} />)}</Surface>
          : <Surface><AppText secondary>Todavía no hay movimientos. Registrá un gasto o un ingreso para verlo acá.</AppText></Surface>}
      </View>
      <View>
        <SectionTitle action="Ver todas" onAction={() => router.push('/accounts')}>Tus cuentas</SectionTitle>
        <Surface grouped>{accounts.slice(0, 3).map((account, index) => <AccountRow key={account.id} account={account}
          entries={snapshot.entries} last={index === Math.min(accounts.length, 3) - 1} />)}</Surface>
      </View>
    </>}
  </Screen>;
}
