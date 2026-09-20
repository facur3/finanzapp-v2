import { useRef, useState } from 'react';
import { Keyboard } from 'react-native';
import { router, Stack } from 'expo-router';
import { randomUUID } from 'expo-crypto';
import * as Haptics from 'expo-haptics';
import { formatMinorUnits, makeEntryChange, parseMinorUnits, sameEntry, todayKey, validateEntry, validateEntryChange,
  type Entry, type EntryChange, type EntryKind, type EntryRecord } from '@finanzapp/domain';
import { useLedger } from '../storage/LedgerProvider';
import { ActionButton, AmountField, AppText, Choices, EmptyState, ErrorMessage, Field, IconButton, Screen, Surface } from './components';
import { AccountField, CategoryField, DateField } from './form-controls';
import { initialAccountId } from './presentation';

/** One form for creating and correcting a posting. A submitted command stays
 * frozen across retries, including a failed refresh after SQLite committed. */
export function EntryForm({ original, accountId: requestedAccount, currency, kind: requestedKind }: {
  original?: EntryRecord; accountId?: string; currency?: string; kind?: string;
}) {
  const { snapshot, archive, addEntry, updateEntry } = useLedger();
  const accounts = snapshot?.accounts ?? [];
  const [before] = useState(original);
  const [operation] = useState(() => ({ id: randomUUID(), createdAt: new Date().toISOString() }));
  const [kind, setKind] = useState<EntryKind>(before?.entry.kind ?? (requestedKind === 'income' ? 'income' : 'expense'));
  const [accountId, setAccountId] = useState(() => before?.entry.accountId ?? initialAccountId(accounts, requestedAccount, currency));
  const [amount, setAmount] = useState(before ? formatMinorUnits(before.entry.amountMinor) : '');
  const [merchant, setMerchant] = useState(before?.entry.merchant ?? '');
  const [category, setCategory] = useState(before?.entry.category ?? '');
  const [date, setDate] = useState(() => before ? new Date(before.entry.dateISO + 'T12:00:00') : new Date());
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<{ entry: Entry; change?: EntryChange } | null>(null);
  const saving = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const account = accounts.find(item => item.id === accountId);
  const originalCurrency = accounts.find(item => item.id === before?.entry.accountId)?.currency;
  const debtAccounts = new Set((archive?.debts ?? []).map(debt => debt.accountId));
  const spendAccounts = accounts.filter(item => !debtAccounts.has(item.id) || item.id === before?.entry.accountId);
  const eligibleAccounts = before ? spendAccounts.filter(item => item.currency === originalCurrency) : spendAccounts;
  const locked = busy || pending !== null;
  const close = () => { if (!saving.current) { if (router.canGoBack()) router.back(); else router.replace('/'); } };

  async function save() {
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    setError(null);
    Keyboard.dismiss();
    try {
      let submission = pending;
      if (!submission) {
        const dateISO = todayKey(date);
        if (dateISO > todayKey()) throw new Error('Elegí hoy o una fecha anterior. Los movimientos programados llegan en otra etapa.');
        const entry: Entry = { ...(before?.entry ?? operation), kind, accountId, amountMinor: parseMinorUnits(amount),
          merchant: merchant.trim(), category: category.trim(), dateISO };
        validateEntry(entry, accounts);
        if (before && sameEntry(before.entry, entry)) { saving.current = false; close(); return; }
        const change = before ? makeEntryChange(operation.id, before, 'edit', new Date().toISOString(), entry) : undefined;
        if (change) validateEntryChange(change, accounts);
        submission = { entry, change };
        setPending(submission);
      }
      if (submission.change) await updateEntry(submission.change);
      else await addEntry(submission.entry);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      saving.current = false;
      close();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No pudimos verificar el guardado. Reintentá con este mismo movimiento.');
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  return <Screen>
    <Stack.Screen options={{ title: before ? 'Editar movimiento' : kind === 'expense' ? 'Registrar gasto' : 'Registrar ingreso', gestureEnabled: !busy,
      headerLeft: () => <IconButton name="close" label="Cerrar" onPress={close} disabled={busy} /> }} />
    {!accounts.length ? <EmptyState title="Primero, una cuenta" detail="Cada movimiento necesita una cuenta para actualizar su saldo."
      action={<ActionButton label="Agregar cuenta" onPress={() => router.replace('/new-account')} />} /> : <>
      <Choices value={kind} onChange={setKind} disabled={locked}
        options={[{ value: 'expense', label: 'Gasto' }, { value: 'income', label: 'Ingreso' }]} />
      <AmountField currency={account?.currency ?? 'ARS'} value={amount} onChangeText={value => { setAmount(value); setError(null); }} editable={!locked} />
      <Field label={kind === 'expense' ? 'Comercio o concepto' : 'Origen o concepto'} value={merchant}
        onChangeText={setMerchant} maxLength={120} autoCapitalize="sentences" editable={!locked} />
      <Surface grouped>
        <CategoryField entries={snapshot?.entries ?? []} kind={kind} value={category} onChange={setCategory} disabled={locked} />
        <AccountField label="Cuenta o tarjeta" accounts={eligibleAccounts} value={accountId} onChange={setAccountId} disabled={locked} />
        <DateField value={date} onChange={setDate} disabled={locked} />
      </Surface>
      {before && <AppText secondary style={{ fontSize: 13, textAlign: 'center' }}>Corregís el movimiento original. No se registra otro gasto o ingreso.</AppText>}
      <ErrorMessage message={error} />
      {pending && !busy && error && <AppText secondary style={{ fontSize: 13 }}>Conservamos el envío para reintentar sin duplicarlo. Para cambiar los datos, cerrá y revisá primero Movimientos.</AppText>}
      <ActionButton label={pending && error ? 'Reintentar guardado' : before ? 'Guardar cambios' : kind === 'expense' ? 'Guardar gasto' : 'Guardar ingreso'} onPress={save} busy={busy}
        disabled={!amount.trim() || !merchant.trim() || !category.trim() || !account} />
    </>}
  </Screen>;
}
