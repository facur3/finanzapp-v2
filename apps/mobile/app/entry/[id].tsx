import { useRef, useState } from 'react';
import { Alert, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { randomUUID } from 'expo-crypto';
import * as Haptics from 'expo-haptics';
import { categoryKey, formatMinorUnits, makeEntryChange, summarizeMonthlyBudgets, type EntryChange, type EntryRecord, type Account } from '@finanzapp/domain';
import { useLedger } from '../../src/storage/LedgerProvider';
import { ActionButton, AppText, CategoryBadge, DetailRow, EmptyState, ErrorMessage, Money, Screen, Surface } from '../../src/ui/components';
import { space, usePalette } from '../../src/ui/theme';

export default function EntryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { archive } = useLedger();
  const record = archive?.records.find(item => item.entry.id === id);
  const account = archive?.accounts.find(item => item.id === record?.entry.accountId);
  if (!record || !account) return <Screen><EmptyState title="No encontramos este movimiento"
    detail="Volvé a Movimientos para consultar lo que guardaste en este dispositivo." /></Screen>;
  return <EntryDetail key={id} record={record} account={account} />;
}

/** Wallet-like detail: the amount and merchant first, then only facts FinanzApp
 * actually stores. No bank reference, merchant location or authorization state. */
function EntryDetail({ record, account }: { record: EntryRecord; account: Account }) {
  const { updateEntry, archive, snapshot } = useLedger();
  const p = usePalette();
  const { entry } = record;
  const card = archive?.cards?.find(item => item.accountId === account.id);
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
  const date = new Date(year, month - 1, day, 12).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  // Budget context only when a matching active budget exists for this month, currency and category.
  let budget: { ratio: number; remainingMinor: number; exceeded: boolean } | null = null;
  if (!income && !record.voided && snapshot) {
    try {
      const row = summarizeMonthlyBudgets(snapshot, archive?.budgets ?? [], account.currency, entry.dateISO.slice(0, 7)).rows
        .find(item => categoryKey(item.budget.category) === categoryKey(entry.category));
      if (row) budget = { ratio: row.ratio, remainingMinor: row.remainingMinor, exceeded: row.exceeded };
    } catch { budget = null; }
  }
  const status = record.voided ? 'Deshecho · no cuenta en saldos ni reportes' : record.revision > 0 ? 'Registrado · corregido' : 'Registrado';

  return <Screen gap={space.xl}>
    <Stack.Screen options={{ title: record.voided ? 'Movimiento deshecho' : income ? 'Ingreso' : card ? 'Compra con tarjeta' : 'Gasto', gestureEnabled: !busy, headerBackVisible: !busy }} />
    <View style={{ gap: 14, alignItems: 'center', paddingVertical: 12 }}>
      <CategoryBadge category={entry.category} large tone={income ? 'income' : 'neutral'} />
      <View style={{ alignItems: 'center', gap: 4, width: '100%' }}>
        <Money minor={income ? entry.amountMinor : -entry.amountMinor} currency={account.currency} large signed
          tone={income ? 'income' : 'expense'} color={record.voided ? p.tertiary : undefined} />
        <AppText variant="title3" style={{ textAlign: 'center' }}>{entry.merchant}</AppText>
        <AppText secondary variant="subhead" style={{ textAlign: 'center', textTransform: 'capitalize' }}>{date}</AppText>
      </View>
      <AppText accessibilityLiveRegion="polite" variant="caption" style={{ color: record.voided ? p.warning : p.secondary, fontWeight: '500', textAlign: 'center' }}>{status}</AppText>
    </View>
    <Surface grouped>
      <DetailRow label="Categoría" value={entry.category} icon="pricetag-outline" />
      <DetailRow label={card ? 'Tarjeta' : 'Cuenta'} value={account.name} icon={card ? 'card-outline' : 'wallet-outline'}
        disabled={busy}
        onPress={() => router.push(card ? { pathname: '/card/[id]', params: { id: card.id } } : { pathname: '/account/[id]', params: { id: account.id } })} />
      {budget && <DetailRow label="Presupuesto" icon="speedometer-outline" tone={budget.exceeded ? 'expense' : budget.ratio >= 0.85 ? 'warning' : 'neutral'}
        value={budget.exceeded ? `Excedido por ${formatMinorUnits(-budget.remainingMinor)}` : `${Math.round(budget.ratio * 100)} % usado · quedan ${formatMinorUnits(budget.remainingMinor)}`}
        onPress={() => router.push({ pathname: '/budgets', params: { currency: account.currency, month: entry.dateISO.slice(0, 7) } })} />}
      <DetailRow label="Moneda" value={account.currency === 'ARS' ? 'Pesos argentinos' : 'Dólares estadounidenses'} last />
    </Surface>
    {card && !income && <AppText secondary variant="footnote" style={{ textAlign: 'center' }}>
      Contó como gasto una sola vez y aumentó la deuda de la tarjeta. Pagar la tarjeta no lo vuelve a sumar.
    </AppText>}
    <ErrorMessage message={error} />
    <View style={{ gap: 10 }}>
      {!record.voided && <ActionButton label="Editar movimiento" icon="create-outline" disabled={busy || !!pending}
        onPress={() => router.push({ pathname: '/edit-entry/[id]', params: { id: entry.id } })} />}
      <ActionButton label={pending ? 'Reintentar cambio' : record.voided ? 'Recuperar movimiento' : 'Deshacer movimiento'}
        icon={record.voided ? 'arrow-redo-outline' : 'arrow-undo-outline'} onPress={confirm} busy={busy} secondary={!record.voided} />
    </View>
  </Screen>;
}
