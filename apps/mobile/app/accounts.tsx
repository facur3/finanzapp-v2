import { SectionList, View } from 'react-native';
import { router, Stack } from 'expo-router';
import { type Account } from '@finanzapp/domain';
import { useLedger } from '../src/storage/LedgerProvider';
import { AccountRow, ActionButton, AppText, EmptyState, IconButton } from '../src/ui/components';
import { availableCurrencies } from '../src/ui/presentation';
import { usePalette } from '../src/ui/theme';

export default function AccountsScreen() {
  const { snapshot } = useLedger();
  const p = usePalette();
  if (!snapshot) return null;
  const sections = availableCurrencies(snapshot.accounts).map(currency => ({ currency, data: snapshot.accounts.filter(account => account.currency === currency) }));
  return <>
    <Stack.Screen options={{ headerRight: () => <IconButton name="add" label="Agregar cuenta" onPress={() => router.push('/new-account')} /> }} />
    <SectionList<Account, typeof sections[number]> sections={sections} keyExtractor={account => account.id}
      style={{ flex: 1, backgroundColor: p.background }} contentContainerStyle={{ padding: 20, paddingBottom: 40, flexGrow: 1 }}
      contentInsetAdjustmentBehavior="automatic" stickySectionHeadersEnabled={false} removeClippedSubviews={false}
      ListEmptyComponent={<EmptyState title="Empezá por una cuenta" detail="Agregá el lugar donde guardás tu dinero y su saldo actual."
        action={<ActionButton label="Agregar cuenta" onPress={() => router.push('/new-account')} />} />}
      renderSectionHeader={({ section }) => <AppText secondary accessibilityRole="header" style={{ fontSize: 14, fontWeight: '500', paddingBottom: 12, paddingTop: 12 }}>
        {section.currency === 'ARS' ? 'Pesos argentinos' : 'Dólares estadounidenses'}
      </AppText>}
      renderItem={({ item, index, section }) => <View style={{ backgroundColor: p.surface, overflow: 'hidden',
        borderTopLeftRadius: index === 0 ? 20 : 0, borderTopRightRadius: index === 0 ? 20 : 0,
        borderBottomLeftRadius: index === section.data.length - 1 ? 20 : 0, borderBottomRightRadius: index === section.data.length - 1 ? 20 : 0 }}>
        <AccountRow account={item} entries={snapshot.entries} last={index === section.data.length - 1} />
      </View>} />
  </>;
}
