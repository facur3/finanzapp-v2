import { useMemo, useState } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { totalsByCurrency, type Currency } from '@finanzapp/domain';
import { useLedger } from '../../src/storage/LedgerProvider';
import { AccountRow, ActionButton, AppText, EmptyState, EntryActions, EntryRow, Money, PressFeedback, Screen, SectionTitle, Surface } from '../../src/ui/components';
import { availableCurrencies, selectEntries } from '../../src/ui/presentation';
import { MonthCard } from '../../src/ui/month-card';
import { usePalette } from '../../src/ui/theme';

export default function HomeScreen() {
  const { snapshot } = useLedger();
  const p = usePalette();
  const { fontScale } = useWindowDimensions();
  const [selectedCurrency, setCurrency] = useState<Currency>('ARS');
  const recent = useMemo(() => snapshot ? selectEntries(snapshot.entries, snapshot.accounts).slice(0, 3) : [], [snapshot]);
  if (!snapshot) return null;
  const currencies = availableCurrencies(snapshot.accounts);
  const currency = currencies.includes(selectedCurrency) ? selectedCurrency : currencies[0];
  const totals = totalsByCurrency(snapshot);
  const accounts = snapshot.accounts.filter(account => account.currency === currency);
  return <Screen>
    {!snapshot.accounts.length ? <EmptyState title="Tu dinero, más claro."
      detail="Empezá con una cuenta y su saldo actual. Desde ahí vas a poder ver lo que entra y lo que sale."
      action={<ActionButton label="Agregar mi primera cuenta" icon="add-outline" onPress={() => router.push('/new-account')} />} /> : <>
      <Surface style={{ backgroundColor: p.hero, padding: 24, gap: 18 }}>
        <View style={{ flexDirection: fontScale > 1.3 ? 'column' : 'row', gap: 12, alignItems: fontScale > 1.3 ? 'flex-start' : 'center', justifyContent: 'space-between' }}>
          <AppText style={{ color: p.heroSecondary, fontSize: 15, fontWeight: '500' }}>Disponible</AppText>
          {currencies.length > 1 && <View style={{ flexDirection: 'row', padding: 3, gap: 3, borderRadius: 16, backgroundColor: '#FFFFFF14' }}>
            {currencies.map(option => <PressFeedback key={option} accessibilityRole="button"
              accessibilityLabel={option === 'ARS' ? 'Ver disponible en pesos' : 'Ver disponible en dólares'} accessibilityState={{ selected: currency === option }}
              onPress={() => setCurrency(option)} style={{ paddingHorizontal: 13, borderRadius: 13, backgroundColor: currency === option ? p.heroText : 'transparent' }}>
              <AppText style={{ fontSize: 14, fontWeight: '600', color: currency === option ? p.hero : p.heroText }}>{option}</AppText>
            </PressFeedback>)}
          </View>}
        </View>
        <Money minor={totals[currency]!} currency={currency} large color={p.heroText} />
        <AppText style={{ color: p.heroSecondary, fontSize: 14 }}>
          {accounts.length === 1 ? accounts[0].name : accounts.length + ' cuentas'} · {currency}
        </AppText>
      </Surface>
      <EntryActions currency={currency} />
      <View>
        <SectionTitle action="Ver todos" onAction={() => router.navigate('/activity')}>Movimientos recientes</SectionTitle>
        {recent.length ? <Surface grouped>{recent.map((entry, index) => <EntryRow key={entry.id} entry={entry}
          account={snapshot.accounts.find(account => account.id === entry.accountId)!} last={index === recent.length - 1} />)}</Surface>
          : <Surface><AppText secondary>Todavía no hay movimientos. Registrá un gasto o un ingreso para verlo acá.</AppText></Surface>}
      </View>
      <MonthCard snapshot={snapshot} currency={currency} />
      <View>
        <SectionTitle action="Ver todas" onAction={() => router.push('/accounts')}>Tus cuentas</SectionTitle>
        <Surface grouped>{accounts.slice(0, 3).map((account, index) => <AccountRow key={account.id} account={account}
          entries={snapshot.entries} last={index === Math.min(accounts.length, 3) - 1} />)}</Surface>
      </View>
    </>}
  </Screen>;
}
