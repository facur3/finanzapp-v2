import { useMemo, useRef, useState } from 'react';
import { Keyboard, View } from 'react-native';
import { router, Stack } from 'expo-router';
import { randomUUID } from 'expo-crypto';
import * as Haptics from 'expo-haptics';
import { accountBalanceMinor, accountKind, categoryKey, editedDraftFits, makeEntryChange, minorFromEditedDraft, sameEntry, summarizeMonthlyBudgets, todayKey, validateEntry, validateEntryChange, type Account, type Entry, type EntryChange, type EntryKind, type EntryRecord, type StoredDraft } from '@finanzapp/domain';
import { useLedger } from '../storage/LedgerProvider';
import { budgetTone } from './budget-presentation';
import { ActionButton, AmountField, AppText, Choices, EmptyState, ErrorMessage, Field, IconButton, Screen, Surface } from './components';
import { draftFromMinor } from './money-input';
import { prefillDraft, type EntryPrefill } from './entry-prefill';
export type { EntryPrefill } from './entry-prefill';
import { AccountField, CategoryField, DateField } from './form-controls';
import { accountKindLabel, postingAccounts } from './liability-presentation';
import { initialAccountId } from './presentation';
import { useI18n } from '../i18n/provider';
import { space } from './theme';

type FormKind = EntryKind | 'transfer';

/** One form for creating and correcting a posting. The amount, the kind, the
 * category and the account or card are the four things a user must see; a
 * submitted command stays frozen across retries, including a failed refresh
 * after SQLite committed. */
export function EntryForm({ original, accountId: requestedAccount, currency, kind: requestedKind, onKindChange, onAccountChange, prefill }: {
  original?: EntryRecord; accountId?: string; currency?: string; kind?: string; prefill?: EntryPrefill;
  /** When a host owns the Gasto / Ingreso / Transferencia switch it passes `kind` and this callback; the form then renders no switch of its own. */
  onKindChange?: (kind: FormKind) => void;
  /** Lets the host carry the chosen account over when the mode changes. */
  onAccountChange?: (accountId: string) => void;
}) {
  const { snapshot, archive, addEntry, updateEntry } = useLedger();
  const { t, moneyText, formatAmount, spokenMoney } = useI18n();
  // Cash accounts and cards can carry an expense or income; a personal debt only changes through payments.
  const accounts = postingAccounts(snapshot?.accounts ?? [], archive?.debts);
  const [before] = useState(original);
  const [operation] = useState(() => ({ id: randomUUID(), createdAt: new Date().toISOString() }));
  const [ownKind, setKind] = useState<EntryKind>(before?.entry.kind ?? (requestedKind === 'income' ? 'income' : 'expense'));
  const kind: EntryKind = onKindChange ? (requestedKind === 'income' ? 'income' : 'expense') : ownKind;
  const [accountId, setAccountId] = useState(() => before?.entry.accountId ?? initialAccountId(accounts, requestedAccount, currency));
  // An edit is prefilled in the movement's own currency (its account's); a prefill in another currency is never reinterpreted.
  // While the text stays exactly that prefill (same currency), saving keeps the stored minor units themselves: a stored amount
  // may exceed the entry bound (a restored backup), and re-reading it would lock every other correction.
  const [stored] = useState<StoredDraft | null>(() => {
    const own = before ? accounts.find(item => item.id === before.entry.accountId)?.currency : undefined;
    return before && own ? { minor: before.entry.amountMinor, currency: own, draft: draftFromMinor(before.entry.amountMinor, own) } : null;
  });
  const [amount, setAmount] = useState(() => before ? stored?.draft ?? '' : prefillDraft(prefill));
  const [merchant, setMerchant] = useState(before?.entry.merchant ?? prefill?.merchant ?? '');
  const [category, setCategory] = useState(before?.entry.category ?? prefill?.category ?? '');
  const [date, setDate] = useState(() => before ? new Date(before.entry.dateISO + 'T12:00:00') : prefill?.dateISO ? new Date(prefill.dateISO + 'T12:00:00') : new Date());
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<{ entry: Entry; change?: EntryChange } | null>(null);
  const saving = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const account = accounts.find(item => item.id === accountId);
  const originalCurrency = accounts.find(item => item.id === before?.entry.accountId)?.currency;
  const eligibleAccounts = before ? accounts.filter(item => item.currency === originalCurrency) : accounts;
  const locked = busy || pending !== null;
  const close = () => { if (!saving.current) { if (router.canGoBack()) router.back(); else router.replace('/'); } };
  const cards = archive?.cards ?? [], debts = archive?.debts ?? [];
  const kindOf = (id: string) => { const found = accounts.find(item => item.id === id); return found ? accountKindLabel(found, cards, debts, t) : t('accountKinds.account'); };
  const typeOf = (id: string) => accountKind(id, cards, debts);
  const isCard = !!account && cards.some(card => card.accountId === account.id);

  // Live context for the two prominent selectors: recorded balance or card debt, and the category budget for that month.
  // Each line has a VoiceOver twin, the same sentence with the amount in the language's spoken form (spokenMoney).
  const accountDetail = useMemo(() => {
    if (!account || !snapshot) return undefined;
    const balance = accountBalanceMinor(account, snapshot.entries, snapshot.transfers);
    const line = (money: (minor: number) => string) => isCard ? balance < 0 ? t('entryForm.cardDebt', { amount: money(-balance) })
      : balance > 0 ? t('entryForm.cardCredit', { amount: money(balance) }) : t('entryForm.cardClear')
      : t('entryForm.recordedBalance', { amount: money(balance) });
    return { text: line(minor => moneyText(minor, account.currency)), spoken: line(minor => spokenMoney(minor, account.currency)) };
  }, [account, snapshot, isCard, t, moneyText, spokenMoney]);
  const budget = useMemo(() => {
    if (!account || !snapshot || kind !== 'expense' || !category.trim()) return null;
    try {
      const row = summarizeMonthlyBudgets(snapshot, archive?.budgets ?? [], account.currency, todayKey(date).slice(0, 7)).rows
        .find(item => categoryKey(item.budget.category) === categoryKey(category));
      if (!row) return null;
      const line = (money: (minor: number) => string) => row.exceeded ? t('entryForm.budgetExceeded', { amount: money(-row.remainingMinor) })
        : t('entryForm.budgetUsed', { spent: money(row.spentMinor), total: money(row.budget.amountMinor) });
      return { text: line(minor => moneyText(minor, account.currency)), spoken: line(minor => spokenMoney(minor, account.currency)), tone: budgetTone(row) };
    } catch { return null; }
  }, [account, snapshot, archive?.budgets, kind, category, date, t, moneyText, spokenMoney]);
  // Each option in the account sheet reads like the card it would select: cash with its signed balance, a card as owed, in credit or clear.
  // `figure` writes the amount: the region's separators on screen, where the line already names the currency; for VoiceOver the
  // spoken form with the currency in words, as the selected card's spoken detail says it.
  const optionLine = (item: Account, figure: (minor: number) => string) => {
    const balance = snapshot ? accountBalanceMinor(item, snapshot.entries, snapshot.transfers) : 0;
    if (!cards.some(card => card.accountId === item.id)) return t('entryForm.optionBalance', { amount: figure(balance) });
    return balance < 0 ? t('entryForm.optionDebt', { amount: figure(-balance) })
      : balance > 0 ? t('entryForm.optionCredit', { amount: figure(balance) }) : t('entryForm.optionClear');
  };
  const describeAccount = (item: Account) => optionLine(item, formatAmount);
  const spokenDescribeAccount = (item: Account) => optionLine(item, minor => spokenMoney(minor, item.currency));
  let parsed: number | null = null;
  try { parsed = account ? minorFromEditedDraft(amount, account.currency, stored) : null; } catch { parsed = null; }
  // A draft kept across an account change that the new currency cannot hold exactly blocks Save; the field says why.
  const fit = account ? editedDraftFits(amount, account.currency, stored) : { ok: true as const };

  async function save() {
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    setError(null);
    Keyboard.dismiss();
    try {
      let submission = pending;
      if (!submission) {
        const dateISO = todayKey(date);
        // Messages are stored as catalogue keys and translated when shown (ErrorMessage), so they follow a language change.
        if (dateISO > todayKey()) throw new Error('entryForm.futureDate');
        if (!account) throw new Error('errors.domain.existingAccount'); // A catalogue key, translated when shown (ErrorMessage).
        const entry: Entry = { ...(before?.entry ?? operation), kind, accountId, amountMinor: minorFromEditedDraft(amount, account.currency, stored),
          merchant: merchant.trim(), category: category.trim(), dateISO };
        validateEntry(entry, accounts);
        if (before && sameEntry(before.entry, entry)) { saving.current = false; close(); return; }
        const change = before ? makeEntryChange(operation.id, before, 'edit', new Date().toISOString(), entry) : undefined;
        if (change) validateEntryChange(change, accounts);
        submission = { entry, change };
        setPending(submission);
      }
      if (submission.change) await updateEntry(submission.change);
      else await addEntry(submission.entry);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      saving.current = false;
      close();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'entryForm.saveUnverified');
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  const title = t(before ? 'entryForm.editTitle' : kind === 'expense' ? (isCard ? 'entryForm.cardPurchaseTitle' : 'entryForm.expenseTitle') : 'entryForm.incomeTitle');
  // A new movement's Save echoes the amount it records; VoiceOver hears the echo in the spoken form ("Guardar gasto, 1234,50 pesos").
  const saveWord = t(kind === 'expense' ? 'entryForm.saveExpense' : 'entryForm.saveIncome');
  const submit: { text: string; spoken?: string } = pending && error ? { text: t('common.retrySave') } : before ? { text: t('common.saveChanges') }
    : parsed && parsed > 0 && account ? { text: saveWord + '\u00A0·\u00A0' + moneyText(parsed, account.currency), spoken: saveWord + ', ' + spokenMoney(parsed, account.currency) }
      : { text: saveWord };
  return <Screen gap={space.l}>
    <Stack.Screen options={{ title, gestureEnabled: !busy,
      headerLeft: () => <IconButton name="close" label={t('common.close')} onPress={close} disabled={busy} /> }} />
    {!accounts.length ? <EmptyState title={t('entryForm.noAccountTitle')} detail={t('entryForm.noAccountDetail')}
      action={<ActionButton label={t('common.addAccount')} onPress={() => router.replace('/new-account')} />} /> : <>
      {!onKindChange && <Choices<EntryKind> value={kind} onChange={setKind} disabled={locked}
        options={[{ value: 'expense', label: t('movement.expense') }, { value: 'income', label: t('movement.income') }]} />}
      <AmountField currency={account?.currency ?? 'ARS'} value={amount} onChangeText={value => { setAmount(value); setError(null); }} editable={!locked} stored={stored ?? undefined}
        tone={kind === 'income' ? 'income' : 'neutral'} label={t(kind === 'expense' ? 'movement.expense' : 'movement.income')} />
      <View style={{ gap: space.m }}>
        <CategoryField entries={snapshot?.entries ?? []} kind={kind} value={category} onChange={setCategory} disabled={locked}
          prominent detail={budget?.text} spokenDetail={budget?.spoken} detailTone={budget?.tone} />
        <AccountField label={t(kind === 'expense' ? 'entryForm.paidWith' : 'entryForm.receivedIn')} accounts={eligibleAccounts} value={accountId} onChange={id => { setAccountId(id); onAccountChange?.(id); }} disabled={locked}
          prominent kindOf={kindOf} typeOf={typeOf} detail={accountDetail?.text} spokenDetail={accountDetail?.spoken} describe={describeAccount} spokenDescribe={spokenDescribeAccount} />
      </View>
      <Field label={t(kind === 'expense' ? 'entryForm.merchantExpense' : 'entryForm.merchantIncome')} value={merchant}
        placeholder={t(kind === 'expense' ? 'entryForm.merchantExpensePlaceholder' : 'entryForm.merchantIncomePlaceholder')}
        onChangeText={setMerchant} maxLength={120} autoCapitalize="sentences" editable={!locked} />
      <Surface grouped><DateField value={date} onChange={setDate} disabled={locked} /></Surface>
      {isCard && kind === 'expense' && !before && <AppText secondary variant="footnote" style={{ textAlign: 'center' }}>
        {t('entryForm.cardNote')}
      </AppText>}
      {before && <AppText secondary variant="footnote" style={{ textAlign: 'center' }}>{t('entryForm.correctionNote')}</AppText>}
      <ErrorMessage message={error} />
      {pending && !busy && error && <AppText secondary variant="footnote">{t('entryForm.retryNote')}</AppText>}
      <ActionButton label={submit.text} spokenLabel={submit.spoken}
        onPress={save} busy={busy} disabled={!amount.trim() || !merchant.trim() || !category.trim() || !account || !fit.ok} />
    </>}
  </Screen>;
}
