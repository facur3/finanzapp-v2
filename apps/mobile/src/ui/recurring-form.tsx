import { useRef, useState } from 'react';
import { Keyboard, View } from 'react-native';
import { router, Stack } from 'expo-router';
import { randomUUID } from 'expo-crypto';
import * as Haptics from 'expo-haptics';
import { accountKind, editedDraftFits, keepsHistoricalCardIncome, minorFromEditedDraft, postingAccountsFor, recurringHistory, sameRecurringRule, todayKey, validateRecurringRule, type StoredDraft,
  type EntryKind, type RecurringFrequency, type RecurringRule } from '@finanzapp/domain';
import { useLedger } from '../storage/LedgerProvider';
import { ActionButton, AmountField, AppText, Choices, EmptyState, EntryRow, ErrorMessage, Field, IconButton, Screen, SectionTitle, Surface } from './components';
import { draftFromMinor } from './money-input';
import { AccountField, CategoryField, DateField } from './form-controls';
import { accountKindLabel, postingAccounts } from './liability-presentation';
import { historyNamesAccount, initialAccountId } from './presentation';
import { space } from './theme';
import { useI18n } from '../i18n/provider';

export function RecurringForm({ original, accountId: requestedAccount }: { original?: RecurringRule; accountId?: string }) {
  const { snapshot, archive, saveRecurring } = useLedger();
  const { t } = useI18n();
  const accounts = postingAccounts(snapshot?.accounts ?? [], archive?.debts);
  const [before] = useState(original);
  const [operation] = useState(() => ({ id: randomUUID(), createdAt: new Date().toISOString() }));
  const [kind, setKind] = useState<EntryKind>(before?.kind ?? 'expense');
  const [chosenAccountId, setAccountId] = useState(() => before?.accountId ?? initialAccountId(accounts, requestedAccount));
  // An untouched prefill keeps the stored minor units (a stored amount may exceed the entry bound); an edited text is a new entry.
  const [stored] = useState<StoredDraft | null>(() => {
    const own = before ? accounts.find(item => item.id === before.accountId)?.currency : undefined;
    return before && own ? { minor: before.amountMinor, currency: own, draft: draftFromMinor(before.amountMinor, own) } : null;
  });
  const [amount, setAmount] = useState(stored?.draft ?? '');
  const [merchant, setMerchant] = useState(before?.merchant ?? '');
  const [category, setCategory] = useState(before?.category ?? '');
  const [frequency, setFrequency] = useState<RecurringFrequency>(before?.frequency ?? 'monthly');
  const [date, setDate] = useState(() => new Date((before?.nextDateISO ?? todayKey()) + 'T12:00:00'));
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<RecurringRule | null>(null);
  const saving = useRef(false);
  const [error, setError] = useState<string | null>(null);

  // The accounts this kind may use (24B6): an expense to cash or a card, an income to cash only; a rule already paying an
  // income into a card keeps that card offered while it is edited. A card carried from Gasto gives way to cash for an income.
  const cashAndCards = postingAccountsFor(kind, accounts, archive?.cards, archive?.debts);
  const historicalCard = before && kind === 'income' && keepsHistoricalCardIncome(before, { kind, accountId: before.accountId })
    ? accounts.filter(item => item.id === before.accountId && !cashAndCards.some(offered => offered.id === item.id)) : [];
  const offered = historicalCard.length ? cashAndCards.concat(historicalCard) : cashAndCards;
  const originalCurrency = accounts.find(item => item.id === before?.accountId)?.currency;
  const eligibleAccounts = before ? offered.filter(item => item.currency === originalCurrency) : offered;
  const accountId = eligibleAccounts.some(item => item.id === chosenAccountId) ? chosenAccountId
    : initialAccountId(eligibleAccounts, undefined, accounts.find(item => item.id === chosenAccountId)?.currency);
  const account = accounts.find(item => item.id === accountId);
  // The rule's amount is minor units of its account's currency; a draft kept across an account change that the new
  // currency cannot hold exactly blocks Save (the field says why).
  const ruleCurrency = () => { if (!account) throw new Error('errors.recurring.account'); return account.currency; }; // A catalogue key, translated when shown.
  const fit = account ? editedDraftFits(amount, account.currency, stored) : { ok: true as const };
  const locked = busy || pending !== null;
  const close = () => { if (!saving.current) { if (router.canGoBack()) router.back(); else router.replace('/recurring'); } };

  async function save() {
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    setError(null);
    Keyboard.dismiss();
    try {
      let submission = pending;
      if (!submission) {
        const nextDateISO = todayKey(date);
        if (nextDateISO < todayKey()) throw new Error('recurring.form.pastDate');
        const now = new Date().toISOString();
        if (before) {
          const anchorDateISO = nextDateISO === before.nextDateISO && frequency === before.frequency ? before.anchorDateISO : nextDateISO;
          const candidate: RecurringRule = {
            ...before,
            accountId,
            kind,
            amountMinor: minorFromEditedDraft(amount, ruleCurrency(), stored),
            merchant: merchant.trim(),
            category: category.trim(),
            frequency,
            anchorDateISO,
            nextDateISO,
          };
          validateRecurringRule(candidate, accounts);
          if (sameRecurringRule(candidate, before)) { saving.current = false; close(); return; }
          submission = { ...candidate, revision: before.revision + 1, updatedAt: now };
        } else {
          submission = {
            id: operation.id,
            createdAt: operation.createdAt,
            updatedAt: operation.createdAt,
            revision: 0,
            accountId,
            kind,
            amountMinor: minorFromEditedDraft(amount, ruleCurrency(), stored),
            merchant: merchant.trim(),
            category: category.trim(),
            frequency,
            anchorDateISO: nextDateISO,
            nextDateISO,
            active: true,
          };
        }
        validateRecurringRule(submission, accounts);
        setPending(submission);
      }
      await saveRecurring(submission);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      saving.current = false;
      close();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'recurring.form.saveFailed');
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  return <Screen gap={space.l}>
    <Stack.Screen options={{ title: t(before ? 'nav.titles.editRecurring' : 'nav.titles.newRecurring'), gestureEnabled: !busy,
      headerLeft: () => <IconButton name="close" label={t('common.close')} onPress={close} disabled={busy} /> }} />
    {/* The switch stays above the empty state of one kind, so Gasto is one tap away when Ingreso has no account. */}
    {accounts.length > 0 && <Choices value={kind} onChange={setKind} disabled={locked}
      options={[{ value: 'expense', label: t('movement.expense') }, { value: 'income', label: t('movement.income') }]} />}
    {!eligibleAccounts.length ? <EmptyState title={t('recurring.form.noAccountTitle')}
      /* No account at all, or none this kind may use (a card-only ledger asked for a recurring income): the action adds a
         cash account, pushed over the draft with the carried card's currency prefilled, so the form and its fields come back. */
      detail={t(accounts.length ? 'recurring.form.noCashAccountDetail' : 'recurring.form.noAccountDetail')}
      action={<ActionButton label={t('common.addAccount')} onPress={() => accounts.length
        ? router.push({ pathname: '/new-account', params: { currency: accounts.find(item => item.id === chosenAccountId)?.currency ?? accounts[0].currency } })
        : router.replace('/new-account')} />} /> : <>
      {/* The account (and so the currency) before the amount (24B5): the field types with the right decimals from the first key. */}
      <AccountField label={t(kind === 'expense' ? 'entryForm.paidWith' : 'entryForm.receivedIn')} accounts={eligibleAccounts} value={accountId} onChange={setAccountId} disabled={locked} prominent
        kindOf={id => { const found = accounts.find(item => item.id === id); return found ? accountKindLabel(found, archive?.cards, archive?.debts, t) : t('accountKinds.account'); }}
        typeOf={id => accountKind(id, archive?.cards, archive?.debts)} />
      <AmountField currency={account?.currency ?? 'ARS'} value={amount} label={t(kind === 'expense' ? 'recurring.form.expenseAmount' : 'recurring.form.incomeAmount')} stored={stored ?? undefined}
        onChangeText={value => { setAmount(value); setError(null); }} editable={!locked} tone={kind === 'income' ? 'income' : 'neutral'} />
      <View style={{ gap: space.m }}>
        <CategoryField entries={snapshot?.entries ?? []} kind={kind} value={category} onChange={setCategory} disabled={locked} prominent />
      </View>
      <Field label={t(kind === 'expense' ? 'entryForm.merchantExpense' : 'entryForm.merchantIncome')} value={merchant}
        placeholder={t(kind === 'expense' ? 'recurring.form.merchantExpensePlaceholder' : 'recurring.form.merchantIncomePlaceholder')}
        onChangeText={setMerchant} maxLength={120} autoCapitalize="sentences" editable={!locked} />
      <ViewFrequency value={frequency} onChange={setFrequency} disabled={locked} />
      <Surface grouped><DateField value={date} onChange={setDate} disabled={locked} allowFuture label={t('recurring.form.nextDate')} /></Surface>
      <AppText secondary style={{ fontSize: 13, textAlign: 'center' }}>
        {t('recurring.form.todayNote')}
      </AppText>
      <ErrorMessage message={error} />
      {pending && !busy && error && <AppText secondary style={{ fontSize: 13, textAlign: 'center' }}>
        {t('recurring.form.retryNote')}
      </AppText>}
      <ActionButton label={pending && error ? t('common.retrySave') : before ? t('common.saveChanges') : t('recurring.form.create')}
        onPress={save} busy={busy} disabled={!amount.trim() || !merchant.trim() || !category.trim() || !account || !fit.ok} />
      {before && <RecurringHistory ruleId={before.id} ruleAccountId={before.accountId} />}
    </>}
  </Screen>;
}

/** How many recorded movements the detail lists before pointing to Movimientos. */
export const RECURRING_HISTORY_LIMIT = 12;

/** What a rule actually recorded (24UX2), newest first: real movements from the ledger, read by their
 * deterministic occurrence id, never the scheduled dates. Each row opens the movement itself; nothing here writes,
 * merges or infers a payment. */
function RecurringHistory({ ruleId, ruleAccountId }: { ruleId: string; ruleAccountId: string }) {
  const { snapshot } = useLedger();
  const { t } = useI18n();
  const accounts = snapshot?.accounts ?? [];
  const history = recurringHistory({ id: ruleId }, snapshot?.entries ?? []).filter(entry => accounts.some(item => item.id === entry.accountId));
  const shown = history.slice(0, RECURRING_HISTORY_LIMIT);
  const older = history.length - shown.length;
  // The form above shows the rule's current account; a row may leave its account out only when that says it truly.
  const showAccount = historyNamesAccount(shown, ruleAccountId);
  return <View style={{ marginTop: space.l }}>
    <SectionTitle caption={t('recurring.history.caption')}>{t('recurring.history.title')}</SectionTitle>
    {shown.length ? <Surface grouped>{shown.map((entry, index) => <EntryRow key={entry.id} entry={entry} showAccount={showAccount}
      account={accounts.find(item => item.id === entry.accountId)!} last={index === shown.length - 1} />)}</Surface>
      : <AppText secondary variant="subhead">{t('recurring.history.empty')}</AppText>}
    {!!older && <AppText secondary variant="footnote" style={{ marginTop: space.s }}>{t('recurring.history.older', { count: older })}</AppText>}
  </View>;
}

function ViewFrequency({ value, onChange, disabled }: {
  value: RecurringFrequency; onChange: (value: RecurringFrequency) => void; disabled: boolean;
}) {
  const { t } = useI18n();
  return <>
    <AppText secondary style={{ fontSize: 14, fontWeight: '500' }}>{t('recurring.form.frequency')}</AppText>
    <Choices value={value} onChange={onChange} disabled={disabled}
      options={[
        { value: 'weekly', label: t('recurring.frequency.weekly') },
        { value: 'monthly', label: t('recurring.frequency.monthly') },
        { value: 'yearly', label: t('recurring.frequency.yearly') },
      ]} />
  </>;
}
