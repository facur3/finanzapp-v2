import { useRef, useState } from 'react';
import { Keyboard } from 'react-native';
import { router, Stack } from 'expo-router';
import { randomUUID } from 'expo-crypto';
import * as Haptics from 'expo-haptics';
import { parseMinorUnits, type Currency } from '@finanzapp/domain';
import { useLedger } from '../src/storage/LedgerProvider';
import { ActionButton, AppText, Choices, ErrorMessage, Field, IconButton, Screen } from '../src/ui/components';

export default function NewAccountScreen() {
  const { addAccount } = useLedger();
  const [operation] = useState(() => ({ id: randomUUID(), createdAt: new Date().toISOString() }));
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState<Currency>('ARS');
  const [opening, setOpening] = useState('');
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => { if (router.canGoBack()) router.back(); else router.replace('/'); };
  async function save() {
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    setError(null);
    Keyboard.dismiss();
    try {
      await addAccount({ ...operation, name, currency, openingMinor: parseMinorUnits(opening) });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      close();
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
      autoCapitalize="words" returnKeyType="next" editable={!busy} />
    <AppText secondary>Moneda</AppText>
    <Choices value={currency} onChange={setCurrency} disabled={busy}
      options={[{ value: 'ARS', label: 'Pesos · ARS' }, { value: 'USD', label: 'Dólares · USD' }]} />
    <Field label="Saldo inicial" value={opening} onChangeText={setOpening} maxLength={24}
      keyboardType="numbers-and-punctuation" editable={!busy} />
    <AppText secondary>Es el saldo desde el que vas a empezar a registrar movimientos. No cuenta como ingreso. Escribí 0 si la cuenta está vacía.</AppText>
    <ErrorMessage message={error} />
    <ActionButton label="Guardar cuenta" onPress={save} busy={busy} disabled={!name.trim() || !opening.trim()} />
  </Screen>;
}
