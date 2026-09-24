import { useRef, useState } from 'react';
import { Alert, Keyboard } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { randomUUID } from 'expo-crypto';
import * as Haptics from 'expo-haptics';
import { accountBalanceMinor, accountLook, makeAccountAppearance, makeAccountChange, minorFromEditedDraft, validateAccountAppearance,
  validateAccountChange, type Account, type AccountAppearance, type AccountChange, type LedgerSnapshot, type StoredDraft } from '@finanzapp/domain';
import { useLedger } from '../../src/storage/LedgerProvider';
import { ACCOUNT_ICON_CHOICES, COLOR_CHOICES } from '../../src/ui/appearance';
import { IconColorPicker } from '../../src/ui/appearance-picker';
import { draftFromMinor } from '../../src/ui/money-input';
import { ActionButton, AmountField, AppText, EmptyState, ErrorMessage, Field, FieldNote, IconButton, Screen } from '../../src/ui/components';
import { CurrencyField } from '../../src/ui/form-controls';
import { useI18n } from '../../src/i18n/provider';

export default function EditAccountScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { snapshot, archive } = useLedger();
  const account = snapshot?.accounts.find(a => a.id === id);
  const current = archive?.appearances?.find(item => item.accountId === id);
  const { t } = useI18n();
  return account && snapshot ? <AccountEditor key={id} account={account} snapshot={snapshot} current={current} />
    : <Screen><EmptyState title={t('accounts.detail.notFoundTitle')} detail={t('accounts.edit.notFoundDetail')} /></Screen>;
}

type Submission = { change: AccountChange | null; appearance: AccountAppearance | null };

/** Display name, icon and colour change how the account is shown; only the
 * balance correction touches a financial field, and it still asks first.
 * Everything is saved in one commit. Currency stays immutable. */
function AccountEditor({ account, snapshot, current }: { account: Account; snapshot: LedgerSnapshot; current?: AccountAppearance }) {
  const { updateAccount, saveAppearance } = useLedger();
  const { t, formatAmount } = useI18n();
  const [original] = useState(() => ({ account, snapshot, current, balance: accountBalanceMinor(account, snapshot.entries, snapshot.transfers),
    look: accountLook(account.id, current ? [current] : []) }));
  const [name, setName] = useState(account.name);
  const [icon, setIcon] = useState<string>(original.look.icon);
  const [color, setColor] = useState<string>(original.look.color);
  // The recorded balance as the field shows it. While the text stays exactly this prefill, saving keeps `original.balance` itself
  // (a balance is a sum of valid movements and may exceed the entry bound); an edited text is read as a new entry with every rule.
  const [stored] = useState<StoredDraft>(() => ({ minor: original.balance, currency: account.currency, draft: draftFromMinor(original.balance, account.currency) }));
  const [balance, setBalance] = useState(stored.draft);
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
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'accounts.edit.saveUnverified'); }
    finally { working.current = false; setBusy(false); }
  }
  function save() {
    if (working.current || confirming.current) return;
    Keyboard.dismiss(); setError(null);
    if (pending) { void apply(pending); return; }
    try {
      const target = minorFromEditedDraft(balance, account.currency, stored);
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
      Alert.alert(t('accounts.edit.correctTitle'), t('accounts.edit.correctMessage', { name: original.account.name, from: formatAmount(original.balance), to: formatAmount(target), currency: account.currency }), [
        { text: t('common.cancel'), style: 'cancel', onPress: () => { confirming.current = false; } },
        { text: t('accounts.edit.correctConfirm'), onPress: () => { confirming.current = false; void apply(submission); } },
      ], { cancelable: true, onDismiss: () => { confirming.current = false; } });
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'accounts.edit.invalid'); }
  }
  const locked = busy || pending !== null;
  return <Screen>
    <Stack.Screen options={{ title: t('nav.titles.editAccount'), gestureEnabled: !busy,
      headerLeft: () => <IconButton name="close" label={t('common.close')} onPress={close} disabled={busy} /> }} />
    <Field label={t('accounts.form.name')} value={name} onChangeText={setName} maxLength={80} editable={!locked} />
    <IconColorPicker icons={ACCOUNT_ICON_CHOICES} colors={COLOR_CHOICES} icon={icon} color={color}
      onIconChange={setIcon} onColorChange={setColor} disabled={locked} previewLabel={name} />
    <AmountField label={t('accounts.edit.recordedBalance')} currency={account.currency} value={balance} onChangeText={setBalance} stored={stored}
      keyboardType="numbers-and-punctuation" inputMode={undefined} editable={!locked} />
    <FieldNote help={{ title: t('accounts.edit.recordedBalance'), detail: t('accounts.edit.balanceHelp') }}>{t('accounts.edit.balanceNote')}</FieldNote>
    <CurrencyField value={account.currency} />
    <FieldNote help={{ title: t('selection.currency'), detail: t('accounts.edit.currencyHelp') }}>{t('accounts.edit.currencyNote')}</FieldNote>
    <ErrorMessage message={error} />
    {pending && error && <AppText secondary style={{ fontSize: 13 }}>{t('accounts.edit.retryNote')}</AppText>}
    <ActionButton label={pending && error ? t('common.retrySave') : t('common.saveChanges')} onPress={save} busy={busy} disabled={!name.trim() || !balance.trim()} />
  </Screen>;
}
