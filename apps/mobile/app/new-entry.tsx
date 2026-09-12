import { useRef, useState } from 'react';
import { Keyboard, Platform, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { randomUUID } from 'expo-crypto';
import * as Haptics from 'expo-haptics';
import { parseMinorUnits, todayKey, type EntryKind } from '@finanzapp/domain';
import { useLedger } from '../src/storage/LedgerProvider';
import { ActionButton, AppText, Choices, EmptyState, ErrorMessage, Field, IconButton, PressFeedback, Screen } from '../src/ui/components';
import { usePalette } from '../src/ui/theme';

export default function NewEntryScreen() {
  const { snapshot, addEntry } = useLedger();
  const params = useLocalSearchParams<{ accountId?: string; kind?: string }>();
  const p = usePalette();
  const accounts = snapshot?.accounts ?? [];
  const [operation] = useState(() => ({ id: randomUUID(), createdAt: new Date().toISOString() }));
  const [kind, setKind] = useState<EntryKind>(params.kind === 'income' ? 'income' : 'expense');
  const [accountId, setAccountId] = useState(() => accounts.find(account => account.id === params.accountId)?.id ?? accounts[0]?.id ?? '');
  const [amount, setAmount] = useState('');
  const [merchant, setMerchant] = useState('');
  const [category, setCategory] = useState('');
  const [date, setDate] = useState(() => new Date());
  const [showDate, setShowDate] = useState(false);
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
      <Field label={`Monto en ${account?.currency ?? 'ARS'}`} value={amount} onChangeText={setAmount}
        keyboardType="decimal-pad" inputMode="decimal" maxLength={24} editable={!busy}
        style={{ fontSize: 34, fontWeight: '600', fontVariant: ['tabular-nums'] }} />
      <View style={{ gap: 8 }}><AppText secondary>Cuenta</AppText>
        <Choices value={accountId} options={accounts.map(item => ({ value: item.id, label: `${item.name} · ${item.currency}` }))}
          onChange={setAccountId} disabled={busy} />
      </View>
      <Field label={kind === 'expense' ? 'Comercio o concepto' : 'Origen o concepto'} value={merchant}
        onChangeText={setMerchant} maxLength={120} autoCapitalize="sentences" editable={!busy} />
      <Field label="Categoría" value={category} onChangeText={setCategory}
        maxLength={60} autoCapitalize="sentences" editable={!busy} />
      <View style={{ gap: 8 }}><AppText secondary>Fecha</AppText>
        <PressFeedback accessibilityRole="button" accessibilityLabel="Elegir fecha" disabled={busy}
          accessibilityState={{ expanded: showDate, disabled: busy }}
          onPress={() => { Keyboard.dismiss(); setShowDate(value => !value); }}
          style={{ backgroundColor: p.surface, borderRadius: 16, padding: 16 }}>
          <AppText>{date.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })}</AppText>
        </PressFeedback>
        {showDate && <View style={{ width: '100%', overflow: 'hidden' }}>
          <DateTimePicker value={date} mode="date" display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            themeVariant={p.isDark ? 'dark' : 'light'} minimumDate={new Date(1900, 0, 1)} maximumDate={new Date()}
            style={{ width: '100%' }} onChange={(event, next) => {
              if (Platform.OS !== 'ios') setShowDate(false);
              if (event.type === 'set' && next) setDate(next);
            }} />
          {Platform.OS === 'ios' && <ActionButton label="Listo" onPress={() => setShowDate(false)} secondary />}
        </View>}
      </View>
      <ErrorMessage message={error} />
      <ActionButton label={kind === 'expense' ? 'Guardar gasto' : 'Guardar ingreso'} onPress={save} busy={busy}
        disabled={!amount.trim() || !merchant.trim() || !category.trim() || !account} />
    </>}
  </Screen>;
}
