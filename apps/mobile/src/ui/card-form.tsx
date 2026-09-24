import { useRef, useState } from 'react';
import { Alert, Keyboard, View } from 'react-native';
import { router, Stack } from 'expo-router';
import { randomUUID } from 'expo-crypto';
import * as Haptics from 'expo-haptics';
import { parseMinorUnits, sameCreditCardProfile, validateAccount, validateCreditCardProfile,
  type Account, type CreditCardProfile, type Currency } from '@finanzapp/domain';
import { useI18n } from '../i18n/provider';
import type { MessageKey } from '../i18n/messages';
import { useLedger } from '../storage/LedgerProvider';
import { ActionButton, AmountField, AppText, Choices, DetailRow, ErrorMessage, Field, IconButton, Screen, Surface, useStacked } from './components';
import { draftFromMinor } from './money-input';
import { space } from './theme';

type PendingCreate = { account: Account; card: CreditCardProfile };

/** Creates a card with its hidden internal account in one durable commit, or
 * edits the card profile. A submitted command stays frozen across retries. */
export function CardForm({ original }: { original?: CreditCardProfile }) {
  const stacked = useStacked();
  const { t } = useI18n();
  const { snapshot, addCard, saveCard } = useLedger();
  const account = snapshot?.accounts.find(item => item.id === original?.accountId);
  const [before] = useState(original);
  const [identity] = useState(() => ({ id: randomUUID(), accountId: randomUUID(), createdAt: new Date().toISOString() }));
  const [name, setName] = useState(account?.name ?? '');
  const [issuer, setIssuer] = useState(before?.issuer ?? '');
  const [last4, setLast4] = useState(before?.last4 ?? '');
  const [currency, setCurrency] = useState<Currency>(account?.currency ?? 'ARS');
  const [debt, setDebt] = useState('');
  const [limit, setLimit] = useState(before?.creditLimitMinor ? draftFromMinor(before.creditLimitMinor) : '');
  const [closingDay, setClosingDay] = useState(before ? String(before.closingDay) : '');
  const [dueDay, setDueDay] = useState(before ? String(before.dueDay) : '');
  const [busy, setBusy] = useState(false);
  const [pendingCreate, setPendingCreate] = useState<PendingCreate | null>(null);
  const [pendingEdit, setPendingEdit] = useState<CreditCardProfile | null>(null);
  const [pendingArchive, setPendingArchive] = useState<CreditCardProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const saving = useRef(false);
  const locked = busy || !!pendingCreate || !!pendingEdit || !!pendingArchive;
  const close = () => { if (!saving.current) { if (router.canGoBack()) router.back(); else router.replace('/cards'); } };

  // Errors the form raises itself are catalogue keys, translated when shown (ErrorMessage).
  function day(value: string, invalid: MessageKey): number {
    const number = Number(value);
    if (!/^\d{1,2}$/.test(value) || number < 1 || number > 31) throw new Error(invalid);
    return number;
  }
  function profileBase(): Omit<CreditCardProfile, 'revision' | 'updatedAt' | 'active'> {
    return {
      id: before?.id ?? identity.id,
      accountId: before?.accountId ?? identity.accountId,
      issuer: issuer.trim(),
      last4: last4.trim(),
      creditLimitMinor: limit.trim() ? parseMinorUnits(limit) : null,
      closingDay: day(closingDay.trim(), 'cards.form.closingDayInvalid'),
      dueDay: day(dueDay.trim(), 'cards.form.dueDayInvalid'),
      createdAt: before?.createdAt ?? identity.createdAt,
    };
  }

  async function save() {
    if (saving.current || !snapshot) return;
    saving.current = true; setBusy(true); setError(null); Keyboard.dismiss();
    try {
      if (before) {
        let submission = pendingEdit;
        if (!submission) {
          const candidate: CreditCardProfile = { ...profileBase(), active: before.active, revision: before.revision, updatedAt: before.updatedAt };
          validateCreditCardProfile(candidate, snapshot.accounts);
          if (sameCreditCardProfile(candidate, before)) { saving.current = false; close(); return; }
          submission = { ...candidate, revision: before.revision + 1, updatedAt: new Date().toISOString() };
          validateCreditCardProfile(submission, snapshot.accounts);
          setPendingEdit(submission);
        }
        await saveCard(submission);
      } else {
        let submission = pendingCreate;
        if (!submission) {
          const openingDebt = debt.trim() ? parseMinorUnits(debt) : 0;
          if (openingDebt < 0) throw new Error('cards.form.negativeDebt');
          const card: CreditCardProfile = { ...profileBase(), active: true, revision: 0, updatedAt: identity.createdAt };
          const newAccount: Account = { id: identity.accountId, name: name.trim(), currency, openingMinor: -openingDebt, createdAt: identity.createdAt };
          validateAccount(newAccount);
          validateCreditCardProfile(card, [...snapshot.accounts, newAccount]);
          submission = { account: newAccount, card };
          setPendingCreate(submission);
        }
        await addCard(submission.account, submission.card);
      }
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      saving.current = false; close();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'cards.form.saveFailed');
    } finally { saving.current = false; setBusy(false); }
  }

  async function commitArchive(submission: CreditCardProfile) {
    if (saving.current) return;
    saving.current = true; setBusy(true); setError(null);
    try {
      setPendingArchive(submission);
      await saveCard(submission);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      saving.current = false; close();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'cards.form.archiveFailed');
    } finally { saving.current = false; setBusy(false); }
  }
  function archive() {
    if (!before || busy || saving.current) return;
    if (pendingArchive) { void commitArchive(pendingArchive); return; }
    const submission = { ...before, active: !before.active, revision: before.revision + 1, updatedAt: new Date().toISOString() };
    if (!before.active) { void commitArchive(submission); return; }
    Alert.alert(t('cards.form.archiveTitle'), t('cards.form.archiveDetail'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('cards.form.archiveConfirm'), style: 'destructive', onPress: () => { void commitArchive(submission); } },
    ]);
  }

  return <Screen>
    <Stack.Screen options={{ title: t(before ? 'nav.titles.editCard' : 'nav.titles.newCard'), gestureEnabled: !busy,
      headerLeft: () => <IconButton name="close" label={t('common.close')} onPress={close} disabled={busy} /> }} />

    {before && account ? <Surface grouped>
      <DetailRow label={t('cards.form.card')} value={account.name} icon="card-outline" onPress={() => router.push({ pathname: '/edit-account/[id]', params: { id: account.id } })} />
      <DetailRow label={t('cards.form.currency')} value={account.currency} last />
    </Surface> : <>
      <Field label={t('cards.form.name')} value={name} onChangeText={setName}
        placeholder={t('cards.form.namePlaceholder')} maxLength={80} autoCapitalize="words" editable={!locked} />
      <Choices value={currency} onChange={setCurrency} disabled={locked}
        options={[{ value: 'ARS', label: t('cards.form.pesos') }, { value: 'USD', label: t('cards.form.dollars') }]} />
      <AmountField label={t('cards.form.openingDebt')} currency={currency} value={debt}
        onChangeText={value => { setDebt(value); setError(null); }} editable={!locked} />
      <AppText secondary variant="footnote" style={{ marginTop: -space.m }}>{t('cards.form.openingDebtNote')}</AppText>
    </>}

    <View style={{ gap: space.l }}>
      <Field label={t('cards.form.issuer')} value={issuer} onChangeText={setIssuer}
        placeholder={t('cards.form.issuerPlaceholder')} maxLength={80} autoCapitalize="words" editable={!locked} />
      <Field label={t('cards.form.last4')} value={last4} onChangeText={value => setLast4(value.replace(/\D/g, '').slice(0, 4))}
        placeholder="4009" keyboardType="number-pad" maxLength={4} editable={!locked} />
    </View>

    <AmountField label={t('cards.form.limit')} currency={currency} value={limit}
      onChangeText={value => { setLimit(value); setError(null); }} editable={!locked} />

    <View style={{ flexDirection: stacked ? 'column' : 'row', gap: 12 }}>
      <View style={{ flex: stacked ? undefined : 1 }}><Field label={t('cards.form.closingDay')} value={closingDay} onChangeText={value => setClosingDay(value.replace(/\D/g, '').slice(0, 2))}
        placeholder="1–31" keyboardType="number-pad" maxLength={2} editable={!locked} /></View>
      <View style={{ flex: stacked ? undefined : 1 }}><Field label={t('cards.form.dueDay')} value={dueDay} onChangeText={value => setDueDay(value.replace(/\D/g, '').slice(0, 2))}
        placeholder="1–31" keyboardType="number-pad" maxLength={2} editable={!locked} /></View>
    </View>
    <AppText secondary variant="footnote" style={{ marginTop: -space.s }}>
      {t('cards.form.daysNote')}
    </AppText>

    <ErrorMessage message={error} />
    {(pendingCreate || pendingEdit) && error && <AppText secondary variant="footnote">
      {t('cards.form.frozenNote')}
    </AppText>}
    <ActionButton label={error && (pendingCreate || pendingEdit) ? t('common.retrySave') : before ? t('common.saveChanges') : t('cards.form.create')}
      onPress={save} busy={busy} disabled={before ? !closingDay || !dueDay : !name.trim() || !closingDay || !dueDay} />
    {before && <ActionButton label={t(pendingArchive && error ? 'cards.form.retry' : before.active ? 'cards.form.archive' : 'cards.form.reactivate')}
      onPress={archive} secondary disabled={busy || !!pendingEdit} />}
  </Screen>;
}
