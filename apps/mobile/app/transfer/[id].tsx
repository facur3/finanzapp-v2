import { useRef, useState } from 'react';
import { Alert, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { randomUUID } from 'expo-crypto';
import * as Haptics from 'expo-haptics';
import { accountKind, formatMinorUnits, makeTransferChange, type Account, type TransferRecord, type TransferChange } from '@finanzapp/domain';
import { useLedger } from '../../src/storage/LedgerProvider';
import { ActionButton, AppText, DetailRow, EmptyState, ErrorMessage, GlyphTile, Money, Screen, Surface } from '../../src/ui/components';
import { space, usePalette } from '../../src/ui/theme';

export default function TransferScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { archive } = useLedger();
  const record = archive?.transfers?.find(r => r.transfer.id === id);
  return record && archive ? <TransferDetail key={id} record={record} accounts={archive.accounts} />
    : <Screen><EmptyState title="No encontramos esta transferencia" detail="Volvé a Movimientos para consultar tus registros." /></Screen>;
}

function TransferDetail({ record, accounts }: { record: TransferRecord; accounts: Account[] }) {
  const { updateTransfer, archive } = useLedger();
  const p = usePalette();
  const t = record.transfer;
  const from = accounts.find(a => a.id === t.fromAccountId)!, to = accounts.find(a => a.id === t.toAccountId)!;
  const cards = archive?.cards ?? [], debts = archive?.debts ?? [];
  const toKind = accountKind(to.id, cards, debts), fromKind = accountKind(from.id, cards, debts);
  const kindTitle = toKind === 'card' ? 'Pago de tarjeta' : toKind === 'debt' ? 'Pago de deuda' : fromKind === 'debt' ? 'Cobro' : 'Transferencia';
  const linkFor = (account: Account) => {
    const card = cards.find(item => item.accountId === account.id);
    const debt = debts.find(item => item.accountId === account.id);
    return card ? { pathname: '/card/[id]' as const, params: { id: card.id } } : debt ? { pathname: '/debt/[id]' as const, params: { id: debt.id } }
      : { pathname: '/account/[id]' as const, params: { id: account.id } };
  };
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
  const [year, month, day] = t.dateISO.split('-').map(Number);
  const date = new Date(year, month - 1, day, 12).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const status = record.voided ? 'Deshecha · no afecta los saldos' : kindTitle === 'Transferencia' ? 'Entre tus cuentas · no es gasto ni ingreso'
    : 'Mueve saldo hacia la obligación · no es gasto ni ingreso';
  return <Screen gap={space.xl}>
    <Stack.Screen options={{ title: record.voided ? 'Transferencia deshecha' : kindTitle, gestureEnabled: !busy, headerBackVisible: !busy }} />
    <View style={{ alignItems: 'center', gap: 14, paddingVertical: 12 }}>
      <GlyphTile icon={toKind === 'card' ? 'card-outline' : toKind === 'debt' || fromKind === 'debt' ? 'people-outline' : 'swap-horizontal-outline'} tone="transfer" large />
      <View style={{ alignItems: 'center', gap: 4, width: '100%' }}>
        <Money minor={t.amountMinor} currency={from.currency} large align="center" tone="transfer" color={record.voided ? p.tertiary : undefined} />
        <AppText variant="title3" style={{ textAlign: 'center' }}>{t.note || kindTitle}</AppText>
        <AppText secondary variant="subhead" style={{ textAlign: 'center', textTransform: 'capitalize' }}>{date}</AppText>
      </View>
      <AppText accessibilityLiveRegion="polite" variant="caption" style={{ color: record.voided ? p.warning : p.secondary, fontWeight: '500', textAlign: 'center' }}>{status}</AppText>
    </View>
    <Surface grouped>
      <DetailRow label="Desde" value={from.name} icon="arrow-up-outline" disabled={busy} onPress={() => router.push(linkFor(from))} />
      <DetailRow label="Hacia" value={to.name} icon="arrow-down-outline" disabled={busy} onPress={() => router.push(linkFor(to))} last={!t.note} />
      {!!t.note && <DetailRow label="Nota" value={t.note} last />}
    </Surface>
    <ErrorMessage message={error} />
    <View style={{ gap: 10 }}>
      {!record.voided && <ActionButton label="Editar transferencia" icon="create-outline" disabled={busy || !!pending}
        onPress={() => router.push({ pathname: '/edit-transfer/[id]', params: { id: t.id } })} />}
      <ActionButton label={pending ? 'Reintentar cambio' : record.voided ? 'Recuperar transferencia' : 'Deshacer transferencia'}
        icon={record.voided ? 'arrow-redo-outline' : 'arrow-undo-outline'} busy={busy} secondary={!record.voided} onPress={confirm} />
    </View>
  </Screen>;
}
