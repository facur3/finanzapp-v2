import { useRef, useState } from 'react';
import { Alert, Keyboard } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { randomUUID } from 'expo-crypto';
import * as Haptics from 'expo-haptics';
import { accountBalanceMinor, formatMinorUnits, makeAccountChange, parseMinorUnits, validateAccountChange, type Account, type AccountChange, type LedgerSnapshot } from '@finanzapp/domain';
import { useLedger } from '../../src/storage/LedgerProvider';
import { ActionButton, AmountField, AppText, DetailRow, EmptyState, ErrorMessage, Field, IconButton, Screen, Surface } from '../../src/ui/components';

export default function EditAccountScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { snapshot } = useLedger();
  const account = snapshot?.accounts.find(a => a.id === id);
  return account && snapshot ? <AccountEditor key={id} account={account} snapshot={snapshot} />
    : <Screen><EmptyState title="No encontramos esta cuenta" detail="Volvé a tus cuentas para revisar los datos guardados." /></Screen>;
}
function AccountEditor({ account, snapshot }: { account: Account; snapshot: LedgerSnapshot }) {
  const { updateAccount } = useLedger();
  const [original] = useState(() => ({ account, snapshot, balance: accountBalanceMinor(account, snapshot.entries, snapshot.transfers) }));
  const [name, setName] = useState(account.name);
  const [balance, setBalance] = useState(formatMinorUnits(original.balance));
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<AccountChange | null>(null);
  const [error, setError] = useState<string | null>(null);
  const working = useRef(false), confirming = useRef(false);
  const close = () => { if (!working.current) { if (router.canGoBack()) router.back(); else router.replace('/accounts'); } };
  async function apply(change: AccountChange) {
    if (working.current) return;
    working.current = true; setBusy(true); setPending(change); setError(null);
    try {
      await updateAccount(change);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      working.current = false; close();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No pudimos verificar el guardado. Reintentá el mismo cambio.'); }
    finally { working.current = false; setBusy(false); }
  }
  function save() {
    if (working.current || confirming.current) return;
    Keyboard.dismiss(); setError(null);
    if (pending) { void apply(pending); return; }
    try {
      const target = parseMinorUnits(balance);
      if (target === original.balance && name.trim() === original.account.name) { close(); return; }
      const change = makeAccountChange(randomUUID(), original.account, original.snapshot, name, target, new Date().toISOString());
      validateAccountChange(change);
      if (change.expectedBalanceMinor === null) { void apply(change); return; }
      confirming.current = true;
      Alert.alert('¿Corregir el saldo?', `${original.account.name}: de ${formatMinorUnits(original.balance)} a ${formatMinorUnits(target)} ${account.currency}. Se ajustará el saldo inicial; tus movimientos no cambian. No es un ingreso ni una transferencia.`, [
        { text: 'Cancelar', style: 'cancel', onPress: () => { confirming.current = false; } },
        { text: 'Corregir saldo', onPress: () => { confirming.current = false; void apply(change); } },
      ], { cancelable: true, onDismiss: () => { confirming.current = false; } });
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Revisá el nombre y el saldo.'); }
  }
  const locked = busy || pending !== null;
  return <Screen>
    <Stack.Screen options={{ title: 'Editar cuenta', gestureEnabled: !busy,
      headerLeft: () => <IconButton name="close" label="Cerrar" onPress={close} disabled={busy} /> }} />
    <Field label="Nombre de la cuenta" value={name} onChangeText={setName} maxLength={80} editable={!locked} />
    <AmountField label="Saldo registrado" currency={account.currency} value={balance} onChangeText={setBalance}
      keyboardType="numbers-and-punctuation" inputMode={undefined} editable={!locked} />
    <Surface grouped><DetailRow label="Moneda" value={account.currency} last /></Surface>
    <AppText secondary style={{ fontSize: 14 }}>Usá esta corrección solo si el saldo está mal cargado. Si recibiste, gastaste o moviste dinero, registrá el movimiento correspondiente.</AppText>
    <AppText secondary style={{ fontSize: 13 }}>La moneda no se cambia para no reinterpretar movimientos anteriores. Una cuenta en otra moneda se agrega por separado.</AppText>
    <ErrorMessage message={error} />
    {pending && error && <AppText secondary style={{ fontSize: 13 }}>Reintentá este mismo cambio. Para editarlo, cerrá y verificá primero el saldo guardado.</AppText>}
    <ActionButton label={pending && error ? 'Reintentar guardado' : 'Guardar cambios'} onPress={save} busy={busy} disabled={!name.trim() || !balance.trim()} />
  </Screen>;
}
