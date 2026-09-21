import { useRef, useState } from 'react';
import { Keyboard } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { randomUUID } from 'expo-crypto';
import * as Haptics from 'expo-haptics';
import { makeAccountAppearance, parseMinorUnits, validateAccount, validateAccountAppearance, type AccountAppearance, type Currency, type Account } from '@finanzapp/domain';
import { useLedger } from '../src/storage/LedgerProvider';
import { ACCOUNT_ICON_CHOICES, COLOR_CHOICES, DEFAULT_LOOK } from '../src/ui/appearance';
import { IconColorPicker } from '../src/ui/appearance-picker';
import { ActionButton, AmountField, AppText, Choices, ErrorMessage, Field, IconButton, Screen } from '../src/ui/components';

/** Nombre, icono, color, moneda, saldo inicial. The look is saved in the same
 * commit as the account; it is presentation only and never a financial field. */
export default function NewAccountScreen() {
  const params = useLocalSearchParams<{ currency?: string }>();
  const { addAccount } = useLedger();
  const [operation] = useState(() => ({ id: randomUUID(), createdAt: new Date().toISOString() }));
  const [name, setName] = useState('');
  const [icon, setIcon] = useState<string>(DEFAULT_LOOK.icon);
  const [color, setColor] = useState<string>(DEFAULT_LOOK.color);
  const [currency, setCurrency] = useState<Currency>(params.currency === 'USD' ? 'USD' : 'ARS');
  const [opening, setOpening] = useState('');
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<{ account: Account; appearance: AccountAppearance } | null>(null);
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
      let submission = pending;
      if (!submission) {
        const account: Account = { ...operation, name: name.trim(), currency, openingMinor: parseMinorUnits(opening.trim() || '0') };
        validateAccount(account);
        const appearance = makeAccountAppearance(account.id, icon as AccountAppearance['icon'], color as AccountAppearance['color'], operation.createdAt);
        validateAccountAppearance(appearance, [account]);
        submission = { account, appearance };
        setPending(submission);
      }
      await addAccount(submission.account, submission.appearance);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      saving.current = false; close();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo guardar. Conservamos lo que escribiste para que puedas reintentar.');
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  const locked = busy || !!pending;
  return <Screen>
    <Stack.Screen options={{ gestureEnabled: !busy,
      headerLeft: () => <IconButton name="close" label="Cerrar" onPress={close} disabled={busy} /> }} />
    <Field label="Nombre de la cuenta" value={name} onChangeText={setName} maxLength={80}
      autoCapitalize="words" editable={!locked} placeholder="Ej. Banco, Efectivo, Cocos" />
    <IconColorPicker icons={ACCOUNT_ICON_CHOICES} colors={COLOR_CHOICES} icon={icon} color={color}
      onIconChange={setIcon} onColorChange={setColor} disabled={locked} previewLabel={name} />
    <Choices value={currency} onChange={setCurrency} disabled={locked}
      options={[{ value: 'ARS', label: 'Pesos · ARS' }, { value: 'USD', label: 'Dólares · USD' }]} />
    <AmountField label="Saldo inicial (opcional)" currency={currency} value={opening} onChangeText={value => { setOpening(value); setError(null); }}
      keyboardType="numbers-and-punctuation" inputMode={undefined} editable={!locked} />
    <AppText secondary style={{ fontSize: 14 }}>Podés dejarlo vacío para registrar desde cero. El saldo registrado será el resultado de tus movimientos; no representa tu saldo bancario. Si cargás un saldo inicial, no cuenta como ingreso.</AppText>
    <ErrorMessage message={error} />
    {pending && error && <AppText secondary style={{ fontSize: 13 }}>Reintentá el mismo envío para evitar duplicados. Para cambiarlo, cerrá y revisá primero tus cuentas.</AppText>}
    <ActionButton label={pending && error ? 'Reintentar guardado' : 'Guardar cuenta'} onPress={save} busy={busy} disabled={!name.trim()} />
  </Screen>;
}
