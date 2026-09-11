import { FlatList, View } from 'react-native';
import { router } from 'expo-router';
import { useLedger } from '../../src/storage/LedgerProvider';
import { ActionButton, EmptyState, EntryRow } from '../../src/ui/components';
import { usePalette } from '../../src/ui/theme';

export default function ActivityScreen() {
  const { snapshot } = useLedger();
  const p = usePalette();
  if (!snapshot) return null;
  return <FlatList style={{ flex: 1, backgroundColor: p.background }}
    contentContainerStyle={{ padding: 20, paddingBottom: 36, flexGrow: 1 }}
    contentInsetAdjustmentBehavior="automatic" data={snapshot.entries} keyExtractor={entry => entry.id}
    ListEmptyComponent={<EmptyState title="Todavía no hay movimientos"
      detail="Cada gasto e ingreso que guardes va a aparecer acá, ordenado por fecha."
      action={<ActionButton label={snapshot.accounts.length ? 'Registrar movimiento' : 'Agregar cuenta'}
        onPress={() => router.push(snapshot.accounts.length ? '/new-entry' : '/new-account')} />} />}
    renderItem={({ item }) => <View style={{ backgroundColor: p.surface, paddingHorizontal: 16 }}><EntryRow entry={item}
      account={snapshot.accounts.find(account => account.id === item.accountId)!} /></View>} />;
}
