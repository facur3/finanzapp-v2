import { useRef, useState } from 'react';
import { Alert, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { randomUUID } from 'expo-crypto';
import * as Haptics from 'expo-haptics';
import { formatMinorUnits, makeEntryChange, type EntryChange, type EntryRecord, type Account } from '@finanzapp/domain';
import { useLedger } from '../../src/storage/LedgerProvider';
import { ActionButton, AppText, CategoryBadge, DetailRow, EmptyState, ErrorMessage, Money, Screen, Surface } from '../../src/ui/components';
import { usePalette } from '../../src/ui/theme';

export default function EntryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { archive } = useLedger();
  const record = archive?.records.find(item => item.entry.id === id);
  const account = archive?.accounts.find(item => item.id === record?.entry.accountId);
  if (!record || !account) return <Screen><EmptyState title="No encontramos este movimiento"
    detail="Volvé a Movimientos para consultar lo que guardaste en este dispositivo." /></Screen>;
  return <EntryDetail key={id} record={record} account={account} />;
}

function EntryDetail({ record, account }: { record: EntryRecord; account: Account }) {
  const { updateEntry } = useLedger();
  const p = usePalette();
  const { entry } = record;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<EntryChange | null>(null);
  const saving = useRef(false);
  const confirming = useRef(false);
  async function apply(change: EntryChange) {
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    setError(null);
    setPending(change);
    try {
      await updateEntry(change);
      setPending(null);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No pudimos verificar el cambio. Podés reintentarlo sin duplicar su efecto.');
    } finally { saving.current = false; setBusy(false); }
  }
  function confirm() {
    if (saving.current || confirming.current) return;
    if (pending) { void apply(pending); return; }
    confirming.current = true;
    const restore = record.voided;
    const change = makeEntryChange(randomUUID(), record, restore ? 'restore' : 'void', new Date().toISOString());
    const adds = restore ? entry.kind === 'income' : entry.kind === 'expense';
    Alert.alert(restore ? '¿Recuperar movimiento?' : '¿Deshacer movimiento?',
      `${adds ? 'Se sumarán' : 'Se descontarán'} ${formatMinorUnits(entry.amountMinor)} ${account.currency} ${adds ? 'a' : 'de'} ${account.name}. `
      + (restore ? 'Volverá a aparecer en tus movimientos y reportes.' : 'Dejará de contar en tus saldos y reportes. Podés recuperarlo después.'), [
        { text: 'Cancelar', style: 'cancel', onPress: () => { confirming.current = false; } },
        { text: restore ? 'Recuperar' : 'Deshacer', style: restore ? 'default' : 'destructive', onPress: () => { confirming.current = false; void apply(change); } },
      ], { cancelable: true, onDismiss: () => { confirming.current = false; } });
  }
  const income = entry.kind === 'income';
  const [year, month, day] = entry.dateISO.split('-').map(Number);
  const date = new Date(year, month - 1, day, 12).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });
  return <Screen>
    <Stack.Screen options={{ title: record.voided ? 'Movimiento deshecho' : income ? 'Ingreso' : 'Gasto', gestureEnabled: !busy, headerBackVisible: !busy }} />
    <View style={{ gap: 16, alignItems: 'center', paddingVertical: 24 }}>
      <CategoryBadge category={entry.category} large />
      <View style={{ width: '100%', alignItems: 'center' }}><Money minor={income ? entry.amountMinor : -entry.amountMinor}
        currency={account.currency} large signed color={income ? p.positive : p.text} /></View>
      <AppText style={{ fontSize: 23, lineHeight: 30, fontWeight: '600', textAlign: 'center' }}>{entry.merchant}</AppText>
      <AppText secondary style={{ fontSize: 14, textAlign: 'center' }}>{date}</AppText>
    </View>
    <Surface grouped>
      <DetailRow label="Cuenta" value={account.name} icon="wallet-outline"
        disabled={busy}
        onPress={() => router.push({ pathname: '/account/[id]', params: { id: account.id } })} />
      <DetailRow label="Categoría" value={entry.category} icon="pricetag-outline" />
      <DetailRow label="Moneda" value={account.currency === 'ARS' ? 'Pesos argentinos' : 'Dólares estadounidenses'} last />
    </Surface>
    <AppText secondary accessibilityLiveRegion="polite" style={{ textAlign: 'center', fontSize: 13 }}>
      {record.voided ? 'No cuenta en tus saldos ni reportes.' : record.revision > 0 ? 'Movimiento actualizado' : 'Movimiento registrado'}
    </AppText>
    <ErrorMessage message={error} />
    {!record.voided && <ActionButton label="Editar movimiento" icon="create-outline" disabled={busy || !!pending}
      onPress={() => router.push({ pathname: '/edit-entry/[id]', params: { id: entry.id } })} />}
    <ActionButton label={pending ? 'Reintentar cambio' : record.voided ? 'Recuperar movimiento' : 'Deshacer movimiento'}
      icon={record.voided ? 'arrow-redo-outline' : 'arrow-undo-outline'} onPress={confirm} busy={busy} secondary={!record.voided} />
  </Screen>;
}
