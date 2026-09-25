import { useRef, useState } from 'react';
import { Keyboard, View } from 'react-native';
import { router, Stack } from 'expo-router';
import { randomUUID } from 'expo-crypto';
import * as Haptics from 'expo-haptics';
import { draftFitsCurrency, minorFromLedgerDraft, samePersonalDebtProfile, todayKey, validateAccount, validatePersonalDebtProfile,
  type Account, type Currency, type DebtDirection, type PersonalDebtProfile, LEDGER_CURRENCIES } from '@finanzapp/domain';
import { useI18n } from '../i18n/provider';
import { useLedger } from '../storage/LedgerProvider';
import { ActionButton, AmountField, AppText, Choices, DetailRow, ErrorMessage, Field, IconButton, Screen, Surface } from './components';
import { CurrencySwitch } from './currency-switch';
import { offeredCurrencies } from './currencies';
import { DateField } from './form-controls';
import { space } from './theme';

type DueMode = 'none' | 'dated';
type PendingCreate = { account: Account; debt: PersonalDebtProfile };

/** Creates a debt or receivable with its hidden account (opening balance is
 * the principal) or edits its profile. Amounts change only through payments.
 * Closing, reopening and deleting live on the debt's detail and its row (24UX4). */
export function DebtForm({ original }: { original?: PersonalDebtProfile }) {
  const { snapshot, addDebt, saveDebt, gate = LEDGER_CURRENCIES } = useLedger();
  const { t } = useI18n();
  const account = snapshot?.accounts.find(item => item.id === original?.accountId);
  const [before] = useState(original);
  const [identity] = useState(() => ({ id: randomUUID(), accountId: randomUUID(), createdAt: new Date().toISOString() }));
  const [direction, setDirection] = useState<DebtDirection>(before?.direction ?? 'owed_by_me');
  const [counterparty, setCounterparty] = useState(before?.counterparty ?? '');
  const [currency, setCurrency] = useState<Currency>(account?.currency ?? 'ARS');
  const [amount, setAmount] = useState('');
  const [dueMode, setDueMode] = useState<DueMode>(before?.dueDateISO ? 'dated' : 'none');
  const [dueDate, setDueDate] = useState(() => new Date((before?.dueDateISO ?? todayKey()) + 'T12:00:00'));
  const [note, setNote] = useState(before?.note ?? '');
  const [busy, setBusy] = useState(false);
  const [pendingCreate, setPendingCreate] = useState<PendingCreate | null>(null);
  const [pendingEdit, setPendingEdit] = useState<PersonalDebtProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const saving = useRef(false);
  const locked = busy || !!pendingCreate || !!pendingEdit;
  const owed = (before?.direction ?? direction) === 'owed_by_me';
  const close = () => { if (!saving.current) { if (router.canGoBack()) router.back(); else router.replace('/debts'); } };

  function profileBase() {
    return {
      id: before?.id ?? identity.id,
      accountId: before?.accountId ?? identity.accountId,
      direction: before?.direction ?? direction,
      counterparty: counterparty.trim(),
      dueDateISO: dueMode === 'dated' ? todayKey(dueDate) : null,
      note: note.trim(),
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
          const candidate: PersonalDebtProfile = { ...profileBase(), active: before.active, deleted: before.deleted, revision: before.revision, updatedAt: before.updatedAt };
          validatePersonalDebtProfile(candidate, snapshot.accounts);
          if (samePersonalDebtProfile(candidate, before)) { saving.current = false; close(); return; }
          submission = { ...candidate, revision: before.revision + 1, updatedAt: new Date().toISOString() };
          validatePersonalDebtProfile(submission, snapshot.accounts);
          setPendingEdit(submission);
        }
        await saveDebt(submission);
      } else {
        let submission = pendingCreate;
        if (!submission) {
          const principal = minorFromLedgerDraft(amount, currency);
          if (principal <= 0) throw new Error('debts.form.amountPositive'); // A catalogue key, translated when shown (ErrorMessage).
          const debt: PersonalDebtProfile = { ...profileBase(), active: true, deleted: false, revision: 0, updatedAt: identity.createdAt };
          const newAccount: Account = {
            id: identity.accountId,
            // Stored name of the hidden account, not an interface label: it stays the same in every language.
            name: (direction === 'owed_by_me' ? 'Debo · ' : 'Me deben · ') + counterparty.trim(), // i18n-ignore: stored data
            currency,
            openingMinor: direction === 'owed_by_me' ? -principal : principal,
            createdAt: identity.createdAt,
          };
          validateAccount(newAccount);
          validatePersonalDebtProfile(debt, [...snapshot.accounts, newAccount]);
          submission = { account: newAccount, debt };
          setPendingCreate(submission);
        }
        await addDebt(submission.account, submission.debt);
      }
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      saving.current = false; close();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'debts.form.saveFailed');
    } finally { saving.current = false; setBusy(false); }
  }

  return <Screen>
    <Stack.Screen options={{ title: t(before ? 'nav.titles.editDebt' : 'nav.titles.newDebt'), gestureEnabled: !busy,
      headerLeft: () => <IconButton name="close" label={t('common.close')} onPress={close} disabled={busy} /> }} />

    {before && account ? <Surface grouped>
      <DetailRow label={t(owed ? 'debts.form.owedTo' : 'debts.form.owedBy')} value={before.counterparty} />
      <DetailRow label={t('debts.form.currency')} value={account.currency} last />
    </Surface> : <>
      <Choices value={direction} onChange={setDirection} disabled={locked}
        options={[{ value: 'owed_by_me', label: t('debts.form.owed') }, { value: 'owed_to_me', label: t('debts.form.receivable') }]} />
      {/* The currency before the amount (24B5): the field types with the right decimals from the first key. */}
      <CurrencySwitch value={currency} currencies={offeredCurrencies(gate)} onChange={setCurrency} disabled={locked} />
      <AmountField label={t(owed ? 'debts.form.amountOwed' : 'debts.form.amountReceivable')} currency={currency} value={amount}
        onChangeText={value => { setAmount(value); setError(null); }} editable={!locked} />
    </>}

    <Field label={t(owed ? 'debts.form.counterpartyOwed' : 'debts.form.counterpartyReceivable')} value={counterparty} onChangeText={setCounterparty}
      placeholder={t('debts.form.counterpartyPlaceholder')} maxLength={80} autoCapitalize="words" editable={!locked} />

    <View style={{ gap: space.s }}>
      <AppText secondary variant="footnote" style={{ fontWeight: '500' }}>{t('debts.form.due')}</AppText>
      <Choices value={dueMode} onChange={setDueMode} disabled={locked}
        options={[{ value: 'none', label: t('debts.form.noDate') }, { value: 'dated', label: t('debts.form.dated') }]} />
    </View>
    {dueMode === 'dated' && <Surface grouped>
      <DateField value={dueDate} onChange={setDueDate} disabled={locked} allowFuture label={t('debts.form.dueDate')} />
    </Surface>}

    <Field label={t('debts.form.note')} value={note} onChangeText={setNote} maxLength={120} autoCapitalize="sentences" editable={!locked} />

    <AppText secondary variant="footnote">
      {t(owed ? 'debts.form.explainOwed' : 'debts.form.explainReceivable')}
    </AppText>
    <ErrorMessage message={error} />
    {(pendingCreate || pendingEdit) && error && <AppText secondary variant="footnote">
      {t('debts.form.frozenNote')}
    </AppText>}
    <ActionButton label={error && (pendingCreate || pendingEdit) ? t('common.retrySave') : before ? t('common.saveChanges') : t('debts.form.create')}
      onPress={save} busy={busy} disabled={(before ? !counterparty.trim() : !counterparty.trim() || !amount.trim()) || !draftFitsCurrency(amount, currency).ok} />
  </Screen>;
}
