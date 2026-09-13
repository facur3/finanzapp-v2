import { useRef, useState } from 'react';
import { Alert, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { randomUUID } from 'expo-crypto';
import * as Haptics from 'expo-haptics';
import Ionicons from '@expo/vector-icons/Ionicons';
import { formatMinorUnits, makeTransferChange, type Account, type TransferRecord, type TransferChange } from '@finanzapp/domain';
import { useLedger } from '../../src/storage/LedgerProvider';
import { ActionButton, AppText, DetailRow, EmptyState, ErrorMessage, Money, Screen, Surface } from '../../src/ui/components';
import { usePalette } from '../../src/ui/theme';

export default function TransferScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { archive } = useLedger();
  const record = archive?.transfers?.find(r => r.transfer.id === id);
  return record && archive ? <TransferDetail key={id} record={record} accounts={archive.accounts} />
    : <Screen><EmptyState title="No encontramos esta transferencia" detail="Volvé a Movimientos para consultar tus registros." /></Screen>;
}
function TransferDetail({ record, accounts }: { record: TransferRecord; accounts: Account[] }) {
  const { updateTransfer } = useLedger();
  const p = usePalette();
  const t = record.transfer;
  const from = accounts.find(a => a.id === t.fromAccountId)!, to = accounts.find(a => a.id === t.toAccountId)!;
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<TransferChange | null>(null);
  const [error, setError] = useState<string | null>(null);
  const working = useRef(false), confirming = useRef(false);
  async function apply(change: TransferChange) {
    if (working.current) return;
    working.current = true; setBusy(true); setPending(change); setError(null);
    try {
      await updateTransfer(change); setPending(null);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No pudimos verificar el cambio. Reintentá sin duplicarlo.'); }
    finally { working.current = false; setBusy(false); }
  }
  function confirm() {
    if (working.current || confirming.current) return;
    if (pending) { void apply(pending); return; }
    confirming.current = true;
    const change = makeTransferChange(randomUUID(), record, record.voided ? 'restore' : 'void', new Date().toISOString());
    Alert.alert(record.voided ? '¿Recuperar transferencia?' : '¿Deshacer transferencia?',
      `${formatMinorUnits(t.amountMinor)} ${from.currency}: se descontarán de ${record.voided ? from.name : to.name} y se sumarán a ${record.voided ? to.name : from.name}. Solo cambia el registro en esta app, no mueve dinero en el banco.`, [
        { text: 'Cancelar', style: 'cancel', onPress: () => { confirming.current = false; } },
        { text: record.voided ? 'Recuperar' : 'Deshacer', style: record.voided ? 'default' : 'destructive', onPress: () => { confirming.current = false; void apply(change); } },
      ], { cancelable: true, onDismiss: () => { confirming.current = false; } });
  }
  return <Screen>
    <Stack.Screen options={{ title: record.voided ? 'Transferencia deshecha' : 'Transferencia', gestureEnabled: !busy, headerBackVisible: !busy }} />
    <View style={{ alignItems: 'center', gap: 16, paddingVertical: 24 }}>
      <View style={{ backgroundColor: p.accentSoft, borderRadius: 21, padding: 16 }}><Ionicons name="swap-horizontal-outline" color={p.accent} size={28} accessible={false} /></View>
      <View style={{ width: '100%', alignItems: 'center' }}><Money minor={t.amountMinor} currency={from.currency} large /></View>
      <AppText secondary style={{ fontSize: 14 }}>{new Date(t.dateISO + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })}</AppText>
    </View>
    <Surface grouped>
      <DetailRow label="Desde" value={from.name} icon="arrow-up-outline" disabled={busy} onPress={() => router.push({ pathname: '/account/[id]', params: { id: from.id } })} />
      <DetailRow label="Hacia" value={to.name} icon="arrow-down-outline" disabled={busy} onPress={() => router.push({ pathname: '/account/[id]', params: { id: to.id } })} last={!t.note} />
      {!!t.note && <DetailRow label="Nota" value={t.note} last />}
    </Surface>
    <AppText secondary accessibilityLiveRegion="polite" style={{ fontSize: 13, textAlign: 'center' }}>{record.voided ? 'No afecta los saldos. Podés recuperarla.' : 'Mueve saldo entre tus cuentas. No es un gasto ni un ingreso.'}</AppText>
    <ErrorMessage message={error} />
    {!record.voided && <ActionButton label="Editar transferencia" icon="create-outline" disabled={busy || !!pending}
      onPress={() => router.push({ pathname: '/edit-transfer/[id]', params: { id: t.id } })} />}
    <ActionButton label={pending ? 'Reintentar cambio' : record.voided ? 'Recuperar transferencia' : 'Deshacer transferencia'}
      icon={record.voided ? 'arrow-redo-outline' : 'arrow-undo-outline'} busy={busy} secondary={!record.voided} onPress={confirm} />
  </Screen>;
}
