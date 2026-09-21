import { useRef, useState } from 'react';
import { Keyboard, View } from 'react-native';
import { router, Stack } from 'expo-router';
import { randomUUID } from 'expo-crypto';
import * as Haptics from 'expo-haptics';
import { accountBalanceMinor, accountKind, formatMinorUnits, hiddenLiabilityAccountIds, makeTransferChange, parseMinorUnits, sameTransfer, todayKey,
  totalsByCurrency, validateTransfer, validateTransferChange, type Account, type Transfer, type TransferChange, type TransferRecord } from '@finanzapp/domain';
import { useLedger } from '../storage/LedgerProvider';
import { ActionButton, AmountField, AmountShortcut, AppText, DetailRow, EmptyState, ErrorMessage, Field, IconButton, Screen, Surface } from './components';
import { amountFromMinor } from './money-input';
import { AccountField, DateField, SelectorCard } from './form-controls';
import { initialAccountId } from './presentation';
import { space, usePalette } from './theme';

/** One form for three movements that are never spending or income: a transfer
 * between cash accounts, a card payment (cash → card) and a debt payment or
 * collection (cash → debt, receivable → cash). The obligation side is fixed by
 * the caller; only the cash side is chosen here. */
export function TransferForm({ original, accountId, fromAccountId: requestedFrom, toAccountId: requestedTo,
  title = 'Entre mis cuentas', defaultNote = '', maxAmountMinor, onAccountChange }: {
  original?: TransferRecord; accountId?: string; fromAccountId?: string; toAccountId?: string; title?: string;
  defaultNote?: string; maxAmountMinor?: string;
  /** Lets the host carry the source account over when the mode changes. */
  onAccountChange?: (accountId: string) => void;
}) {
  const { snapshot, archive, addTransfer, updateTransfer } = useLedger();
  const p = usePalette();
  const accounts = snapshot?.accounts ?? [];
  const cards = archive?.cards ?? [], debts = archive?.debts ?? [];
  const hidden = hiddenLiabilityAccountIds(cards, debts);
  const [before] = useState(original);
  const [operation] = useState(() => ({ id: randomUUID(), createdAt: new Date().toISOString() }));
  const requestedTarget = accounts.find(a => a.id === requestedTo);
  const requestedSource = accounts.find(a => a.id === requestedFrom);
  // A card payment or debt settlement fixes the obligation side of the transfer.
  const lockedTo = !before && requestedTarget && hidden.has(requestedTarget.id) ? requestedTarget : null;
  const lockedFrom = !before && requestedSource && hidden.has(requestedSource.id) ? requestedSource : null;
  const cash = accounts.filter(a => !hidden.has(a.id));
  const [fromId, setFromId] = useState(() => before?.transfer.fromAccountId ?? lockedFrom?.id ?? requestedSource?.id
    ?? (lockedTo ? cash.find(a => a.currency === lockedTo.currency)?.id : undefined) ?? initialAccountId(cash, accountId));
  const [toId, setToId] = useState(() => before?.transfer.toAccountId ?? lockedTo?.id ?? requestedTarget?.id
    ?? (lockedFrom ? cash.find(a => a.currency === lockedFrom.currency)?.id : undefined) ?? '');
  const [amount, setAmount] = useState(before ? formatMinorUnits(before.transfer.amountMinor) : '');
  const [note, setNote] = useState(before?.transfer.note ?? defaultNote);
  const [date, setDate] = useState(() => before ? new Date(before.transfer.dateISO + 'T12:00:00') : new Date());
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<{ transfer: Transfer; change?: TransferChange } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const saving = useRef(false);
  const from = accounts.find(a => a.id === fromId), to = accounts.find(a => a.id === toId);
  const originalCurrency = accounts.find(a => a.id === before?.transfer.fromAccountId)?.currency;
  // Editing keeps the original obligation accounts selectable; a new plain transfer only lists cash accounts.
  const allowed = new Set([before?.transfer.fromAccountId, before?.transfer.toAccountId].filter(Boolean));
  const selectable = accounts.filter(a => !hidden.has(a.id) || allowed.has(a.id));
  const sources = before ? selectable.filter(a => a.currency === originalCurrency) : selectable;
  const targets = selectable.filter(a => a.id !== fromId && a.currency === from?.currency);
  const locked = busy || pending !== null;
  const close = () => { if (!saving.current) { if (router.canGoBack()) router.back(); else router.replace('/'); } };
  const contextualMax = maxAmountMinor && /^\d{1,16}$/.test(maxAmountMinor) ? Number(maxAmountMinor) : null;
  const obligation = lockedTo ?? lockedFrom;
  const obligationKind = obligation ? accountKind(obligation.id, cards, debts) : 'cash';
  const kindLabel = (id: string) => { const kind = accountKind(id, cards, debts); return kind === 'card' ? 'Tarjeta' : kind === 'debt' ? 'Deuda' : 'Cuenta'; };

  function draft(): Transfer {
    return { ...(before?.transfer ?? operation), fromAccountId: fromId, toAccountId: toId, amountMinor: parseMinorUnits(amount), note: note.trim(), dateISO: todayKey(date) };
  }
  function validateContext(transfer: Transfer) {
    if (contextualMax !== null && Number.isSafeInteger(contextualMax) && transfer.amountMinor > contextualMax) {
      throw new Error(obligationKind === 'card' ? 'El pago supera la deuda registrada de la tarjeta. Si pagaste de más, registrá primero el resumen real.'
        : 'El monto supera el saldo pendiente de esta obligación.');
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
  const balanceLabel = (id: string, value: number) => {
    const kind = accountKind(id, cards, debts);
    if (kind === 'card') return value < 0 ? 'Deuda ' + formatMinorUnits(-value) : 'A favor ' + formatMinorUnits(value);
    if (kind === 'debt') return 'Pendiente ' + formatMinorUnits(Math.abs(value));
    return formatMinorUnits(value);
  };
  // Paying an obligation only makes sense from cash in the same currency.
  const cashSources = sources.filter(a => !obligation || (a.id !== obligation.id && a.currency === obligation.currency));
  const noCashCounterpart = !!obligation && !cash.some(a => a.currency === obligation.currency);
  const submitLabel = pending && error ? 'Reintentar guardado' : before ? 'Guardar cambios'
    : obligationKind === 'card' ? 'Registrar pago' : obligationKind === 'debt' ? (lockedTo ? 'Registrar pago' : 'Registrar cobro') : 'Registrar transferencia';
  // The whole recorded figure a shortcut may fill: the source's positive balance
  // for a transfer, the outstanding obligation for a payment or collection. It is
  // read from the current records (minus the transfer being edited), never from a
  // stale parameter; the caller's cap still bounds it. A negative or zero figure
  // offers no action. The shortcut only fills the field; saving stays explicit.
  const shortcut = (() => {
    if (!snapshot) return null;
    const recorded = (item: Account) => accountBalanceMinor(item, snapshot.entries, (snapshot.transfers ?? []).filter(t => t.id !== before?.transfer.id));
    try {
      const context = lockedTo ? { account: lockedTo, minor: -recorded(lockedTo), label: obligationKind === 'card' ? 'Pagar total' : 'Saldar total' }
        : lockedFrom ? { account: lockedFrom, minor: recorded(lockedFrom), label: 'Cobrar total' }
          : from ? { account: from, minor: recorded(from), label: 'Usar todo' } : null;
      if (!context) return null;
      let fill = Math.max(0, context.minor);
      if (contextualMax !== null && Number.isSafeInteger(contextualMax)) fill = Math.min(fill, contextualMax);
      // A card in credit has nothing to pay; an obligation is pending or settled, never negative; cash is shown as recorded.
      const figure = obligationKind === 'card' ? (context.minor < 0 ? ['A favor', -context.minor] as const : ['Deuda registrada', context.minor] as const)
        : obligationKind === 'debt' ? ['Pendiente', Math.max(0, context.minor)] as const : ['Saldo registrado', context.minor] as const;
      return { ...context, fill, text: `${figure[0]}: ${context.account.currency} ${formatMinorUnits(figure[1])}` };
    } catch { return null; }
  })();
  const balanceDetail = (id: string | undefined) => {
    const item = accounts.find(a => a.id === id);
    if (!item || !snapshot) return undefined;
    return `${item.currency} ${balanceLabel(item.id, accountBalanceMinor(item, snapshot.entries, snapshot.transfers))}`;
  };

  return <Screen gap={space.l}>
    <Stack.Screen options={{ title: before ? 'Editar transferencia' : title, gestureEnabled: !busy,
      headerLeft: () => <IconButton name="close" label="Cerrar" onPress={close} disabled={busy} /> }} />
    {!sources.length || noCashCounterpart ? <EmptyState title="Primero, una cuenta" detail={obligation
      ? `Necesitás una cuenta en ${obligation.currency} desde donde ${lockedTo ? 'sale' : 'entra'} el dinero.`
      : 'Agregá las cuentas entre las que movés tu dinero.'}
      action={<ActionButton label="Agregar cuenta" onPress={() => router.replace({ pathname: '/new-account', params: obligation ? { currency: obligation.currency } : {} })} />} /> : <>
      <AmountField label={obligationKind === 'card' ? 'Pago' : obligationKind === 'debt' ? (lockedTo ? 'Pago' : 'Cobro') : 'Transferencia'}
        currency={(obligation ?? from)?.currency ?? 'ARS'} value={amount} onChangeText={value => { setAmount(value); setError(null); }} editable={!locked} tone="transfer" />
      {shortcut && <AmountShortcut caption={shortcut.text} label={shortcut.fill > 0 ? shortcut.label : undefined} disabled={locked}
        onPress={shortcut.fill > 0 ? () => { setAmount(amountFromMinor(shortcut.fill)); setError(null); } : undefined} />}
      <View style={{ gap: space.m }}>
        {lockedFrom ? <SelectorCard label={kindLabel(lockedFrom.id)} value={lockedFrom.name} placeholder="" detail={balanceDetail(lockedFrom.id)}
          icon={obligationKind === 'card' ? 'card-outline' : 'people-outline'} color={p.primary} disabled onPress={() => {}} />
          : <AccountField label="Desde" accounts={cashSources} value={fromId} disabled={locked} kindOf={kindLabel} prominent detail={balanceDetail(fromId)} onChange={id => {
            setFromId(id);
            onAccountChange?.(id);
            const source = accounts.find(a => a.id === id);
            if (!lockedTo && (toId === id || to?.currency !== source?.currency)) setToId('');
          }} />}
        {lockedTo ? <SelectorCard label={kindLabel(lockedTo.id)} value={lockedTo.name} placeholder="" detail={balanceDetail(lockedTo.id)}
          icon={obligationKind === 'card' ? 'card-outline' : 'people-outline'} color={p.primary} disabled onPress={() => {}} />
          : <AccountField label="Hacia" accounts={lockedFrom ? targets.filter(a => a.id !== lockedFrom.id) : targets} value={toId} onChange={setToId} kindOf={kindLabel}
            prominent detail={balanceDetail(toId)} disabled={locked || !targets.length} />}
      </View>
      <Surface grouped><DateField value={date} onChange={setDate} disabled={locked} /></Surface>
      {!obligation && !targets.length && <EmptyState title="Falta otra cuenta en esta moneda" detail="Las transferencias de esta etapa son entre cuentas en pesos o entre cuentas en dólares, sin conversión."
        action={<ActionButton label="Agregar cuenta" secondary disabled={locked} onPress={() => router.push({ pathname: '/new-account', params: { currency: from?.currency ?? 'ARS' } })} />} />}
      <Field label="Nota (opcional)" value={note} onChangeText={setNote} maxLength={120} editable={!locked} />
      {preview && from && to && <Surface grouped>
        <DetailRow label={from.name + ' después'} value={`${from.currency} ${balanceLabel(from.id, preview.from)}`} />
        <DetailRow label={to.name + ' después'} value={`${to.currency} ${balanceLabel(to.id, preview.to)}`} last />
      </Surface>}
      {preview && from && to && ((preview.from < 0 && !hidden.has(from.id)) || (preview.to < 0 && !hidden.has(to.id))) && <AppText secondary variant="subhead">
        Una cuenta quedará con saldo negativo. Revisá el importe y tus movimientos; podés registrarlo si refleja lo que realmente ocurrió.
      </AppText>}
      <AppText secondary variant="footnote">
        {obligationKind === 'card' ? 'El pago baja la deuda de la tarjeta y el saldo de la cuenta. La compra original ya contó como gasto; esto no lo duplica.'
          : obligationKind === 'debt' ? 'Mueve saldo entre tu cuenta y la obligación. No es un gasto ni un ingreso.'
            : 'Solo registra un movimiento entre tus cuentas. No envía dinero al banco ni cuenta como gasto o ingreso.'}
      </AppText>
      <ErrorMessage message={error} />
      {pending && error && <AppText secondary variant="footnote">El envío quedó fijo para reintentar sin duplicarlo. Antes de cambiarlo, cerrá y revisá Movimientos.</AppText>}
      <ActionButton label={submitLabel} busy={busy} disabled={!amount.trim() || !from || !to || from.id === to.id || from.currency !== to.currency} onPress={save} />
    </>}
  </Screen>;
}
