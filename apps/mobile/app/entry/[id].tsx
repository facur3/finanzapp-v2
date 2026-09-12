import { View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useLedger } from '../../src/storage/LedgerProvider';
import { AppText, DetailRow, EmptyState, Money, Screen, Surface } from '../../src/ui/components';
import { usePalette } from '../../src/ui/theme';

export default function EntryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { snapshot } = useLedger();
  const p = usePalette();
  const entry = snapshot?.entries.find(item => item.id === id);
  const account = snapshot?.accounts.find(item => item.id === entry?.accountId);
  if (!entry || !account) return <Screen><EmptyState title="No encontramos este movimiento"
    detail="Volvé a Movimientos para consultar lo que guardaste en este dispositivo." /></Screen>;
  const income = entry.kind === 'income';
  const [year, month, day] = entry.dateISO.split('-').map(Number);
  const date = new Date(year, month - 1, day, 12).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });
  return <Screen>
    <Stack.Screen options={{ title: income ? 'Ingreso' : 'Gasto' }} />
    <View style={{ gap: 16, alignItems: 'center', paddingVertical: 24 }}>
      <View style={{ width: 60, height: 60, borderRadius: 22, justifyContent: 'center', alignItems: 'center', backgroundColor: income ? p.positiveSoft : p.inset }}>
        <Ionicons name={income ? 'arrow-down-outline' : 'arrow-up-outline'} size={27} color={income ? p.positive : p.secondary} accessible={false} />
      </View>
      <View style={{ width: '100%', alignItems: 'center' }}><Money minor={income ? entry.amountMinor : -entry.amountMinor}
        currency={account.currency} large signed color={income ? p.positive : p.text} /></View>
      <AppText style={{ fontSize: 23, lineHeight: 30, fontWeight: '600', textAlign: 'center' }}>{entry.merchant}</AppText>
      <AppText secondary style={{ fontSize: 14, textAlign: 'center' }}>{date}</AppText>
    </View>
    <Surface grouped>
      <DetailRow label="Cuenta" value={account.name} icon="wallet-outline"
        onPress={() => router.push({ pathname: '/account/[id]', params: { id: account.id } })} />
      <DetailRow label="Categoría" value={entry.category} icon="pricetag-outline" />
      <DetailRow label="Moneda" value={account.currency === 'ARS' ? 'Pesos argentinos' : 'Dólares estadounidenses'} last />
    </Surface>
    <AppText secondary style={{ textAlign: 'center', fontSize: 13 }}>Movimiento registrado</AppText>
  </Screen>;
}
