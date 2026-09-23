import { useRef, useState } from 'react';
import { Alert, Keyboard } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { randomUUID } from 'expo-crypto';
import * as Haptics from 'expo-haptics';
import { accountBalanceMinor, accountLook, formatMinorUnits, makeAccountAppearance, makeAccountChange, parseMinorUnits, validateAccountAppearance,
  validateAccountChange, type Account, type AccountAppearance, type AccountChange, type LedgerSnapshot } from '@finanzapp/domain';
import { useLedger } from '../../src/storage/LedgerProvider';
import { ACCOUNT_ICON_CHOICES, COLOR_CHOICES } from '../../src/ui/appearance';
import { IconColorPicker } from '../../src/ui/appearance-picker';
import { ActionButton, AmountField, AppText, EmptyState, ErrorMessage, Field, FieldNote, IconButton, Screen } from '../../src/ui/components';
import { CurrencyField } from '../../src/ui/form-controls';

const BALANCE_HELP = 'El ícono y el color solo cambian cómo se ve la cuenta. Usá la corrección de saldo únicamente si está mal cargado: '
  + 'queda un recibo de corrección, no un ingreso ni un gasto. Si recibiste, gastaste o moviste dinero, registrá el movimiento correspondiente.';
const CURRENCY_HELP = 'La moneda no se cambia para no reinterpretar los movimientos anteriores. Una cuenta en otra moneda se agrega por separado.';

export default function EditAccountScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { snapshot, archive } = useLedger();
  const account = snapshot?.accounts.find(a => a.id === id);
  const current = archive?.appearances?.find(item => item.accountId === id);
  return account && snapshot ? <AccountEditor key={id} account={account} snapshot={snapshot} current={current} />
    : <Screen><EmptyState title="No encontramos esta cuenta" detail="Volvé a tus cuentas para revisar los datos guardados." /></Screen>;
}

type Submission = { change: AccountChange | null; appearance: AccountAppearance | null };

/** Display name, icon and colour change how the account is shown; only the
 * balance correction touches a financial field, and it still asks first.
 * Everything is saved in one commit. Currency stays immutable. */
function AccountEditor({ account, snapshot, current }: { account: Account; snapshot: LedgerSnapshot; current?: AccountAppearance }) {
  const { updateAccount, saveAppearance } = useLedger();
  const [original] = useState(() => ({ account, snapshot, current, balance: accountBalanceMinor(account, snapshot.entries, snapshot.transfers),
    look: accountLook(account.id, current ? [current] : []) }));
  const [name, setName] = useState(account.name);
  const [icon, setIcon] = useState<string>(original.look.icon);
  const [color, setColor] = useState<string>(original.look.color);
  const [balance, setBalance] = useState(formatMinorUnits(original.balance));
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Submission | null>(null);
  const [error, setError] = useState<string | null>(null);
  const working = useRef(false), confirming = useRef(false);
  const close = () => { if (!working.current) { if (router.canGoBack()) router.back(); else router.replace('/accounts'); } };
  async function apply(submission: Submission) {
    if (working.current) return;
    working.current = true; setBusy(true); setPending(submission); setError(null);
    try {
      if (submission.change) await updateAccount(submission.change, submission.appearance ?? undefined);
      else if (submission.appearance) await saveAppearance(submission.appearance);
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
      const now = new Date().toISOString();
      const lookChanged = icon !== original.look.icon || color !== original.look.color;
      const appearance = lookChanged ? makeAccountAppearance(account.id, icon as AccountAppearance['icon'], color as AccountAppearance['color'], now, original.current) : null;
      if (appearance) validateAccountAppearance(appearance, [original.account]);
      const financial = target !== original.balance || name.trim() !== original.account.name;
      if (!financial && !appearance) { close(); return; }
      const change = financial ? makeAccountChange(randomUUID(), original.account, original.snapshot, name, target, now) : null;
      if (change) validateAccountChange(change);
      const submission = { change, appearance };
      if (!change || change.expectedBalanceMinor === null) { void apply(submission); return; }
      confirming.current = true;
      Alert.alert('¿Corregir el saldo?', `${original.account.name}: de ${formatMinorUnits(original.balance)} a ${formatMinorUnits(target)} ${account.currency}. Se ajustará el saldo inicial; tus movimientos no cambian. No es un ingreso ni una transferencia.`, [
        { text: 'Cancelar', style: 'cancel', onPress: () => { confirming.current = false; } },
        { text: 'Corregir saldo', onPress: () => { confirming.current = false; void apply(submission); } },
      ], { cancelable: true, onDismiss: () => { confirming.current = false; } });
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Revisá el nombre y el saldo.'); }
  }
  const locked = busy || pending !== null;
  return <Screen>
    <Stack.Screen options={{ title: 'Editar cuenta', gestureEnabled: !busy,
      headerLeft: () => <IconButton name="close" label="Cerrar" onPress={close} disabled={busy} /> }} />
    <Field label="Nombre de la cuenta" value={name} onChangeText={setName} maxLength={80} editable={!locked} />
    <IconColorPicker icons={ACCOUNT_ICON_CHOICES} colors={COLOR_CHOICES} icon={icon} color={color}
      onIconChange={setIcon} onColorChange={setColor} disabled={locked} previewLabel={name} />
    <AmountField label="Saldo registrado" currency={account.currency} value={balance} onChangeText={setBalance}
      keyboardType="numbers-and-punctuation" inputMode={undefined} editable={!locked} />
    <FieldNote help={{ title: 'Saldo registrado', detail: BALANCE_HELP }}>Solo para corregir un saldo mal cargado.</FieldNote>
    <CurrencyField value={account.currency} />
    <FieldNote help={{ title: 'Moneda', detail: CURRENCY_HELP }}>La moneda de una cuenta no se cambia.</FieldNote>
    <ErrorMessage message={error} />
    {pending && error && <AppText secondary style={{ fontSize: 13 }}>Reintentá este mismo cambio. Para editarlo, cerrá y verificá primero el saldo guardado.</AppText>}
    <ActionButton label={pending && error ? 'Reintentar guardado' : 'Guardar cambios'} onPress={save} busy={busy} disabled={!name.trim() || !balance.trim()} />
  </Screen>;
}
