import { useRef, useState } from 'react';
import { Keyboard } from 'react-native';
import { router, Stack } from 'expo-router';
import { randomUUID } from 'expo-crypto';
import * as Haptics from 'expo-haptics';
import { accountBalanceMinor, formatMinorUnits, hiddenLiabilityAccountIds, makeTransferChange, parseMinorUnits, sameTransfer, todayKey,
  totalsByCurrency, validateTransfer, validateTransferChange, type Transfer, type TransferChange, type TransferRecord } from '@finanzapp/domain';
import { useLedger } from '../storage/LedgerProvider';
import { ActionButton, AmountField, AppText, DetailRow, EmptyState, ErrorMessage, Field, IconButton, Screen, Surface } from './components';
import { AccountField, DateField } from './form-controls';
import { initialAccountId } from './presentation';

export function TransferForm({ original, accountId, fromAccountId: requestedFrom, toAccountId: requestedTo,
  title = 'Entre mis cuentas', defaultNote = '', maxAmountMinor }: {
  original?: TransferRecord; accountId?: string; fromAccountId?: string; toAccountId?: string; title?: string;
  defaultNote?: string; maxAmountMinor?: string;
}) {
  const { snapshot, archive, addTransfer, updateTransfer } = useLedger();
  const accounts = snapshot?.accounts ?? [];
  const [before] = useState(original);
  const [operation] = useState(() => ({ id: randomUUID(), createdAt: new Date().toISOString() }));
  const hidden = hiddenLiabilityAccountIds(archive?.cards ?? [], archive?.debts ?? []);
  const requestedTarget = accounts.find(a => a.id === requestedTo);
  const requestedSource = accounts.find(a => a.id === requestedFrom);
  const [fromId, setFromId] = useState(() => before?.transfer.fromAccountId
    ?? requestedSource?.id
    ?? (requestedTarget ? accounts.find(a => !hidden.has(a.id) && a.id !== requestedTarget.id && a.currency === requestedTarget.currency)?.id : undefined)
    ?? initialAccountId(accounts.filter(a => !hidden.has(a.id)), accountId));
  const [toId, setToId] = useState(() => before?.transfer.toAccountId
    ?? requestedTarget?.id
    ?? (requestedSource ? accounts.find(a => !hidden.has(a.id) && a.id !== requestedSource.id && a.currency === requestedSource.currency)?.id : '')
    ?? '');
  const [amount, setAmount] = useState(before ? formatMinorUnits(before.transfer.amountMinor) : '');
  const [note, setNote] = useState(before?.transfer.note ?? defaultNote);
  const [date, setDate] = useState(() => before ? new Date(before.transfer.dateISO + 'T12:00:00') : new Date());
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<{ transfer: Transfer; change?: TransferChange } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const saving = useRef(false);
  const from = accounts.find(a => a.id === fromId), to = accounts.find(a => a.id === toId);
  const originalCurrency = accounts.find(a => a.id === before?.transfer.fromAccountId)?.currency;
  const allowedHidden = new Set([before?.transfer.fromAccountId, before?.transfer.toAccountId, requestedFrom, requestedTo].filter(Boolean));
  const visibleForTransfer = accounts.filter(a => !hidden.has(a.id) || allowedHidden.has(a.id));
  const sources = before ? visibleForTransfer.filter(a => a.currency === originalCurrency) : visibleForTransfer;
  const targets = visibleForTransfer.filter(a => a.id !== fromId && a.currency === from?.currency);
  const locked = busy || pending !== null;
  const close = () => { if (!saving.current) { if (router.canGoBack()) router.back(); else router.replace('/'); } };
  const contextualMax = maxAmountMinor && /^\d+$/.test(maxAmountMinor) ? Number(maxAmountMinor) : null;
  function draft(): Transfer {
    return { ...(before?.transfer ?? operation), fromAccountId: fromId, toAccountId: toId, amountMinor: parseMinorUnits(amount), note: note.trim(), dateISO: todayKey(date) };
  }
  function validateContext(transfer: Transfer) {
    if (contextualMax !== null && Number.isSafeInteger(contextualMax) && contextualMax >= 0 && transfer.amountMinor > contextualMax) {
      throw new Error('El monto supera el saldo pendiente de esta obligación.');
    }
  }
  // Show the full effect of an edit (remove the old transfer, then apply the new one).
  function proposed(transfer: Transfer) {
    return { accounts, entries: snapshot?.entries ?? [], transfers: [...(snapshot?.transfers ?? []).filter(t => t.id !== before?.transfer.id), transfer] };
  }
  let preview: { from: number; to: number } | null = null;
  try {
    const transfer = draft();
    validateTransfer(transfer, accounts);
    validateContext(transfer);
    const next = proposed(transfer);
    totalsByCurrency(next);
    preview = { from: accountBalanceMinor(from!, next.entries, next.transfers), to: accountBalanceMinor(to!, next.entries, next.transfers) };
  } catch { /* Incomplete input isn't an error until the user submits. */ }
  async function save() {
    if (saving.current || !snapshot) return;
    saving.current = true; setBusy(true); setError(null); Keyboard.dismiss();
    try {
      let submission = pending;
      if (!submission) {
        const transfer = draft();
        validateTransfer(transfer, accounts);
        validateContext(transfer);
        if (transfer.dateISO > todayKey()) throw new Error('Elegí hoy o una fecha anterior.');
        totalsByCurrency(proposed(transfer));
        if (before && sameTransfer(before.transfer, transfer)) { saving.current = false; close(); return; }
        const change = before ? makeTransferChange(operation.id, before, 'edit', new Date().toISOString(), transfer) : undefined;
        if (change) validateTransferChange(change, accounts);
        submission = { transfer, change }; setPending(submission);
      }
      if (submission.change) await updateTransfer(submission.change); else await addTransfer(submission.transfer);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      saving.current = false; close();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No pudimos verificar el guardado. Reintentá este mismo envío.'); }
    finally { saving.current = false; setBusy(false); }
  }
  return <Screen>
    <Stack.Screen options={{ title: before ? 'Editar transferencia' : title, gestureEnabled: !busy,
      headerLeft: () => <IconButton name="close" label="Cerrar" onPress={close} disabled={busy} /> }} />
    {!sources.length ? <EmptyState title="Primero, una cuenta" detail="Agregá las cuentas entre las que movés tu dinero."
      action={<ActionButton label="Agregar cuenta" onPress={() => router.replace('/new-account')} />} /> : <>
      <AmountField currency={from?.currency ?? 'ARS'} value={amount} onChangeText={setAmount} editable={!locked} />
      <Surface grouped>
        <AccountField label="Desde" accounts={sources} value={fromId} disabled={locked} onChange={id => {
          setFromId(id);
          const source = accounts.find(a => a.id === id);
          if (toId === id || to?.currency !== source?.currency) setToId('');
        }} />
        <AccountField label="Hacia" accounts={targets} value={toId} onChange={setToId} disabled={locked || !targets.length} />
        <DateField value={date} onChange={setDate} disabled={locked} />
      </Surface>
      {!targets.length && <EmptyState title="Falta otra cuenta en esta moneda" detail="Las transferencias de esta etapa son entre cuentas en pesos o entre cuentas en dólares, sin conversión."
        action={<ActionButton label="Agregar cuenta" secondary disabled={locked} onPress={() => router.push({ pathname: '/new-account', params: { currency: from?.currency ?? 'ARS' } })} />} />}
      <Field label="Nota (opcional)" value={note} onChangeText={setNote} maxLength={120} editable={!locked} />
      {preview && from && to && <Surface grouped>
        <DetailRow label={from.name + ' después'} value={`${from.currency} ${formatMinorUnits(preview.from)}`} />
        <DetailRow label={to.name + ' después'} value={`${to.currency} ${formatMinorUnits(preview.to)}`} last />
      </Surface>}
      {preview && (preview.from < 0 || preview.to < 0) && <AppText secondary style={{ fontSize: 14 }}>Una cuenta quedará con saldo negativo. Revisá el importe y tus movimientos; podés registrar la transferencia si refleja lo que realmente ocurrió.</AppText>}
      <AppText secondary style={{ fontSize: 13 }}>Este movimiento mueve saldo entre registros. No envía dinero al banco ni cuenta como gasto o ingreso.</AppText>
      <ErrorMessage message={error} />
      {pending && error && <AppText secondary style={{ fontSize: 13 }}>El envío quedó fijo para reintentar sin duplicarlo. Antes de cambiarlo, cerrá y revisá Movimientos.</AppText>}
      <ActionButton label={pending && error ? 'Reintentar guardado' : before ? 'Guardar cambios' : 'Registrar transferencia'} busy={busy}
        disabled={!amount.trim() || !from || !targets.some(a => a.id === toId)} onPress={save} />
    </>}
  </Screen>;
}
