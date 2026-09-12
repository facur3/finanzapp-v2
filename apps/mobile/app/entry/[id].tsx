import { View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useLedger } from '../../src/storage/LedgerProvider';
import { AppText, EmptyState, Money, Screen, Surface } from '../../src/ui/components';
import { usePalette } from '../../src/ui/theme';

export default function EntryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { snapshot } = useLedger();
  const p = usePalette();
  const entry = snapshot?.entries.find(item => item.id === id);
  const account = snapshot?.accounts.find(item => item.id === entry?.accountId);
  if (!entry || !account) return <Screen><EmptyState title="No encontramos este movimiento"
    detail="Volvé a Actividad para consultar los movimientos guardados en este dispositivo." /></Screen>;
  const [year, month, day] = entry.dateISO.split('-').map(Number);
  const date = new Date(year, month - 1, day, 12).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });
  return <Screen>
    <Stack.Screen options={{ title: entry.kind === 'expense' ? 'Gasto' : 'Ingreso' }} />
    <View style={{ gap: 10 }}>
      <AppText style={{ fontSize: 25, fontWeight: '700' }}>{entry.merchant}</AppText>
      <Money minor={entry.kind === 'expense' ? -entry.amountMinor : entry.amountMinor} currency={account.currency}
        large color={entry.kind === 'income' ? p.positive : p.text} />
    </View>
    <Surface style={{ gap: 20 }}>
      {[['Cuenta', account.name], ['Categoría', entry.category], ['Fecha', date]].map(([label, value]) => <View key={label} style={{ gap: 5 }}>
        <AppText secondary style={{ fontSize: 14 }}>{label}</AppText><AppText>{value}</AppText>
      </View>)}
    </Surface>
    <AppText secondary style={{ fontSize: 14 }}>Guardado en este dispositivo.</AppText>
  </Screen>;
}
