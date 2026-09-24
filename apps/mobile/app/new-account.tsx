import { useRef, useState } from 'react';
import { Keyboard } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { randomUUID } from 'expo-crypto';
import * as Haptics from 'expo-haptics';
import { draftFitsCurrency, isLedgerCurrency, makeAccountAppearance, minorFromLedgerDraft, validateAccount, validateAccountAppearance, type AccountAppearance, type Currency, type Account } from '@finanzapp/domain';
import { useLedger } from '../src/storage/LedgerProvider';
import { ACCOUNT_ICON_CHOICES, COLOR_CHOICES, DEFAULT_LOOK } from '../src/ui/appearance';
import { IconColorPicker } from '../src/ui/appearance-picker';
import { ActionButton, AmountField, AppText, ErrorMessage, Field, FieldNote, IconButton, Screen } from '../src/ui/components';
import { CurrencyField } from '../src/ui/form-controls';
import { useI18n } from '../src/i18n/provider';

/** Nombre, icono, color, moneda, saldo inicial. The look is saved in the same
 * commit as the account; it is presentation only and never a financial field.
 * The currency is a native row with a sheet (ARS or USD, the two the ledger
 * holds), visible and changeable until the account exists. */
export default function NewAccountScreen() {
  const params = useLocalSearchParams<{ currency?: string }>();
  const { addAccount } = useLedger();
  const { t } = useI18n();
  const [operation] = useState(() => ({ id: randomUUID(), createdAt: new Date().toISOString() }));
  const [name, setName] = useState('');
  const [icon, setIcon] = useState<string>(DEFAULT_LOOK.icon);
  const [color, setColor] = useState<string>(DEFAULT_LOOK.color);
  // The route's currency is honoured only when the gate offers it (never coerced from an unknown code); ARS otherwise (decision 7.6.4).
  const [currency, setCurrency] = useState<Currency>(isLedgerCurrency(params.currency) ? params.currency : 'ARS');
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
        const account: Account = { ...operation, name: name.trim(), currency, openingMinor: minorFromLedgerDraft(opening.trim() || '0', currency) };
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
      setError(cause instanceof Error ? cause.message : 'accounts.form.saveFailed');
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  const locked = busy || !!pending;
  return <Screen>
    <Stack.Screen options={{ gestureEnabled: !busy,
      headerLeft: () => <IconButton name="close" label={t('common.close')} onPress={close} disabled={busy} /> }} />
    <Field label={t('accounts.form.name')} value={name} onChangeText={setName} maxLength={80}
      autoCapitalize="words" editable={!locked} placeholder={t('accounts.form.namePlaceholder')} />
    <IconColorPicker icons={ACCOUNT_ICON_CHOICES} colors={COLOR_CHOICES} icon={icon} color={color}
      onIconChange={setIcon} onColorChange={setColor} disabled={locked} previewLabel={name} />
    <CurrencyField value={currency} onChange={setCurrency} disabled={locked} />
    <AmountField label={t('accounts.form.openingBalance')} currency={currency} value={opening} onChangeText={value => { setOpening(value); setError(null); }}
      keyboardType="numbers-and-punctuation" inputMode={undefined} editable={!locked} />
    <FieldNote help={{ title: t('accounts.form.openingBalance'), detail: t('accounts.form.openingHelp') }}>{t('accounts.form.openingNote')}</FieldNote>
    <ErrorMessage message={error} />
    {pending && error && <AppText secondary style={{ fontSize: 13 }}>{t('accounts.form.retryNote')}</AppText>}
    <ActionButton label={pending && error ? t('common.retrySave') : t('accounts.form.save')} onPress={save} busy={busy} disabled={!name.trim() || !draftFitsCurrency(opening, currency).ok} />
  </Screen>;
}
