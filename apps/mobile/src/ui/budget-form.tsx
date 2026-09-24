import { useRef, useState } from 'react';
import { Alert, Keyboard, View } from 'react-native';
import { router, Stack } from 'expo-router';
import { randomUUID } from 'expo-crypto';
import * as Haptics from 'expo-haptics';
import { LEDGER_CURRENCIES, editedDraftFits, isLedgerCurrency, minorFromEditedDraft, sameMonthlyBudget, validateMonthlyBudget, type StoredDraft,
  type BudgetScope, type Currency, type MonthlyBudget } from '@finanzapp/domain';
import { useLedger } from '../storage/LedgerProvider';
import { ActionButton, AmountField, AppText, Choices, ErrorMessage, IconButton, Screen } from './components';
import { CurrencySwitch } from './currency-switch';
import { offeredCurrencies } from './currencies';
import { draftFromMinor } from './money-input';
import { CategoryField } from './form-controls';
import { useI18n } from '../i18n/provider';

/** One limit for one month and currency. The first question is what kind of
 * limit: General is the ceiling for all of the month's recorded expenses and
 * has no category; Por categoría is a sublimit inside it for one category.
 * The kind and the currency are fixed once a budget exists; editing changes
 * the amount (and the category of a sublimit). */
export function BudgetForm({ original, monthISO, currency: requestedCurrency, scope: requestedScope }: {
  original?: MonthlyBudget; monthISO: string; currency?: string; scope?: string;
}) {
  const { snapshot, saveBudget, gate = LEDGER_CURRENCIES } = useLedger();
  const { t, formatMonth } = useI18n();
  const [before] = useState(original);
  const [operation] = useState(() => ({ id: randomUUID(), createdAt: new Date().toISOString() }));
  const [scope, setScope] = useState<BudgetScope>(before?.scope ?? (requestedScope === 'total' ? 'total' : 'category'));
  // A new budget's currency comes from the route only when the gate offers it (never coerced from an unknown code); ARS otherwise (decision 7.6.4).
  const [currency, setCurrency] = useState<Currency>(before?.currency ?? (isLedgerCurrency(requestedCurrency, gate) ? requestedCurrency : 'ARS'));
  // An untouched prefill keeps the stored minor units (a stored amount may exceed the entry bound); an edited text is a new entry.
  const [stored] = useState<StoredDraft | null>(() => before ? { minor: before.amountMinor, currency: before.currency, draft: draftFromMinor(before.amountMinor, before.currency) } : null);
  const [amount, setAmount] = useState(stored?.draft ?? '');
  const [category, setCategory] = useState(before?.category ?? '');
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<MonthlyBudget | null>(null);
  const [archivePending, setArchivePending] = useState<MonthlyBudget | null>(null);
  const [error, setError] = useState<string | null>(null);
  const saving = useRef(false);
  const locked = busy || pending !== null || archivePending !== null;
  const close = () => { if (!saving.current) { if (router.canGoBack()) router.back(); else router.replace('/budgets'); } };

  async function save() {
    if (saving.current || !snapshot) return;
    saving.current = true;
    setBusy(true);
    setError(null);
    Keyboard.dismiss();
    try {
      let submission = pending;
      if (!submission) {
        const now = new Date().toISOString();
        const amountMinor = minorFromEditedDraft(amount, currency, stored);
        if (before) {
          // The kind never changes on edit: a total keeps no category, a sublimit keeps one.
          const candidate: MonthlyBudget = before.scope === 'total' ? { ...before, amountMinor }
            : { ...before, category: category.trim(), amountMinor };
          validateMonthlyBudget(candidate);
          if (sameMonthlyBudget(candidate, before)) { saving.current = false; close(); return; }
          submission = { ...candidate, revision: before.revision + 1, updatedAt: now };
        } else {
          const base = { id: operation.id, currency, monthISO, amountMinor, active: true, createdAt: operation.createdAt, revision: 0, updatedAt: operation.createdAt };
          submission = scope === 'total' ? { ...base, scope: 'total' } : { ...base, scope: 'category', category: category.trim() };
        }
        validateMonthlyBudget(submission);
        setPending(submission);
      }
      await saveBudget(submission);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      saving.current = false;
      close();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'budgets.form.saveFailed');
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  async function commitArchive(submission: MonthlyBudget) {
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    setError(null);
    try {
      setArchivePending(submission);
      await saveBudget(submission);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      saving.current = false;
      close();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'budgets.form.deleteFailed');
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  async function archive() {
    if (!before || busy || saving.current) return;
    if (archivePending) {
      await commitArchive(archivePending);
      return;
    }
    const submission: MonthlyBudget = {
      ...before, active: false, revision: before.revision + 1, updatedAt: new Date().toISOString(),
    };
    Alert.alert(t('budgets.form.deleteTitle'), t('budgets.form.deleteMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('budgets.form.deleteConfirm'), style: 'destructive', onPress: () => { void commitArchive(submission); } },
    ]);
  }

  const general = scope === 'total';
  return <Screen>
    <Stack.Screen options={{ title: t(before ? 'nav.titles.editBudget' : 'nav.titles.newBudget'), gestureEnabled: !busy,
      headerLeft: () => <IconButton name="close" label={t('common.close')} onPress={close} disabled={busy} /> }} />
    <View style={{ gap: 4, alignItems: 'center', paddingTop: 8 }}>
      <AppText secondary style={{ fontSize: 14, textTransform: 'capitalize' }}>{formatMonth(before?.monthISO ?? monthISO)}</AppText>
      <AppText variant="title2">{t(general ? 'budgets.form.general' : 'budgets.form.perCategory')}</AppText>
    </View>
    {!before && <Choices<BudgetScope> value={scope} onChange={setScope} disabled={locked}
      options={[{ value: 'total', label: t('budgets.form.scopeGeneral') }, { value: 'category', label: t('budgets.form.scopeCategory') }]} />}
    {!before && <CurrencySwitch value={currency} currencies={offeredCurrencies(gate)} onChange={setCurrency} disabled={locked} />}
    <AmountField label={t('budgets.form.amount')} currency={currency} value={amount} stored={stored ?? undefined}
      onChangeText={value => { setAmount(value); setError(null); }} editable={!locked} />
    {!general && <CategoryField entries={snapshot?.entries ?? []} kind="expense" value={category} onChange={setCategory} disabled={locked} prominent />}
    <AppText secondary variant="footnote" style={{ textAlign: 'center' }}>
      {t(general ? 'budgets.form.generalNote' : 'budgets.form.categoryNote')}
    </AppText>
    <ErrorMessage message={error} />
    {pending && error && <AppText secondary style={{ fontSize: 13, textAlign: 'center' }}>
      {t('budgets.form.retryNote')}
    </AppText>}
    <ActionButton label={pending && error ? t('common.retrySave') : before ? t('common.saveChanges') : t('budgets.form.create')}
      onPress={save} busy={busy} disabled={!amount.trim() || (!general && !category.trim()) || !editedDraftFits(amount, currency, stored).ok} />
    {before && <ActionButton label={t(archivePending && error ? 'budgets.form.retryDelete' : 'budgets.form.delete')}
      onPress={archive} secondary disabled={busy || pending !== null} />}
  </Screen>;
}
