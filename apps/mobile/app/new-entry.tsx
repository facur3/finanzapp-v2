import { useRef, useState } from 'react';
import { Keyboard } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { randomUUID } from 'expo-crypto';
import * as Haptics from 'expo-haptics';
import { parseMinorUnits, todayKey, type EntryKind } from '@finanzapp/domain';
import { useLedger } from '../src/storage/LedgerProvider';
import { ActionButton, AmountField, Choices, EmptyState, ErrorMessage, Field, IconButton, Screen, Surface } from '../src/ui/components';
import { AccountField, CategoryField, DateField } from '../src/ui/form-controls';
import { initialAccountId } from '../src/ui/presentation';

export default function NewEntryScreen() {
  const { snapshot, addEntry } = useLedger();
  const params = useLocalSearchParams<{ accountId?: string; kind?: string; currency?: string }>();
  const accounts = snapshot?.accounts ?? [];
  const [operation] = useState(() => ({ id: randomUUID(), createdAt: new Date().toISOString() }));
  const [kind, setKind] = useState<EntryKind>(params.kind === 'income' ? 'income' : 'expense');
  const [accountId, setAccountId] = useState(() => initialAccountId(accounts, params.accountId, params.currency));
  const [amount, setAmount] = useState('');
  const [merchant, setMerchant] = useState('');
  const [category, setCategory] = useState('');
  const [date, setDate] = useState(() => new Date());
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const account = accounts.find(item => item.id === accountId);
  const close = () => { if (router.canGoBack()) router.back(); else router.replace('/'); };

  async function save() {
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    setError(null);
    Keyboard.dismiss();
    try {
      const dateISO = todayKey(date);
      if (dateISO > todayKey()) throw new Error('Elegí hoy o una fecha anterior. Los movimientos programados llegan en otra etapa.');
      await addEntry({ ...operation, kind, accountId, amountMinor: parseMinorUnits(amount), merchant, category, dateISO });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      close();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo guardar. Conservamos el movimiento para que puedas reintentar.');
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  return <Screen>
    <Stack.Screen options={{ title: kind === 'expense' ? 'Registrar gasto' : 'Registrar ingreso', gestureEnabled: !busy,
      headerLeft: () => <IconButton name="close" label="Cerrar" onPress={close} disabled={busy} /> }} />
    {!accounts.length ? <EmptyState title="Primero, una cuenta"
      detail="Cada movimiento necesita una cuenta para actualizar su saldo."
      action={<ActionButton label="Agregar cuenta" onPress={() => router.replace('/new-account')} />} /> : <>
      <Choices value={kind} onChange={setKind} disabled={busy}
        options={[{ value: 'expense', label: 'Gasto' }, { value: 'income', label: 'Ingreso' }]} />
      <AmountField currency={account?.currency ?? 'ARS'} value={amount} onChangeText={value => { setAmount(value); setError(null); }} editable={!busy} />
      <Field label={kind === 'expense' ? 'Comercio o concepto' : 'Origen o concepto'} value={merchant}
        onChangeText={setMerchant} maxLength={120} autoCapitalize="sentences" editable={!busy} />
      <Surface grouped>
        <CategoryField entries={snapshot?.entries ?? []} kind={kind} value={category} onChange={setCategory} disabled={busy} />
        <AccountField accounts={accounts} value={accountId} onChange={setAccountId} disabled={busy} />
        <DateField value={date} onChange={setDate} disabled={busy} />
      </Surface>
      <ErrorMessage message={error} />
      <ActionButton label={kind === 'expense' ? 'Guardar gasto' : 'Guardar ingreso'} onPress={save} busy={busy}
        disabled={!amount.trim() || !merchant.trim() || !category.trim() || !account} />
    </>}
  </Screen>;
}
