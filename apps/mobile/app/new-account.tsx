import { useRef, useState } from 'react';
import { Keyboard } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { randomUUID } from 'expo-crypto';
import * as Haptics from 'expo-haptics';
import { parseMinorUnits, validateAccount, type Currency, type Account } from '@finanzapp/domain';
import { useLedger } from '../src/storage/LedgerProvider';
import { ActionButton, AmountField, AppText, Choices, ErrorMessage, Field, IconButton, Screen } from '../src/ui/components';

export default function NewAccountScreen() {
  const params = useLocalSearchParams<{ currency?: string }>();
  const { addAccount } = useLedger();
  const [operation] = useState(() => ({ id: randomUUID(), createdAt: new Date().toISOString() }));
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState<Currency>(params.currency === 'USD' ? 'USD' : 'ARS');
  const [opening, setOpening] = useState('');
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Account | null>(null);
  const saving = useRef(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => { if (!saving.current) { if (router.canGoBack()) router.back(); else router.replace('/'); } };
  async function save() {
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    setError(null);
    Keyboard.dismiss();
    try {
      const submission = pending ?? { ...operation, name: name.trim(), currency, openingMinor: parseMinorUnits(opening) };
      validateAccount(submission);
      setPending(submission);
      await addAccount(submission);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      saving.current = false; close();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo guardar. Conservamos lo que escribiste para que puedas reintentar.');
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  return <Screen>
    <Stack.Screen options={{ gestureEnabled: !busy,
      headerLeft: () => <IconButton name="close" label="Cerrar" onPress={close} disabled={busy} /> }} />
    <Field label="Nombre de la cuenta" value={name} onChangeText={setName} maxLength={80}
      autoCapitalize="words" editable={!busy && !pending} />
    <Choices value={currency} onChange={setCurrency} disabled={busy || !!pending}
      options={[{ value: 'ARS', label: 'Pesos · ARS' }, { value: 'USD', label: 'Dólares · USD' }]} />
    <AmountField label="Saldo inicial" currency={currency} value={opening} onChangeText={value => { setOpening(value); setError(null); }}
      keyboardType="numbers-and-punctuation" inputMode={undefined} editable={!busy && !pending} />
    <AppText secondary style={{ fontSize: 14 }}>El saldo que tenés al empezar. No cuenta como ingreso. Escribí 0 si la cuenta está vacía.</AppText>
    <ErrorMessage message={error} />
    {pending && error && <AppText secondary style={{ fontSize: 13 }}>Reintentá el mismo envío para evitar duplicados. Para cambiarlo, cerrá y revisá primero tus cuentas.</AppText>}
    <ActionButton label={pending && error ? 'Reintentar guardado' : 'Guardar cuenta'} onPress={save} busy={busy} disabled={!name.trim() || !opening.trim()} />
  </Screen>;
}
