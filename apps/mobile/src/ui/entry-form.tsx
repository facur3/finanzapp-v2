import { useMemo, useRef, useState } from 'react';
import { Keyboard, View } from 'react-native';
import { router, Stack } from 'expo-router';
import { randomUUID } from 'expo-crypto';
import * as Haptics from 'expo-haptics';
import { PLAN_CALENDAR_MESSAGE, accountBalanceMinor, accountKind, categoryKey, editedDraftFits, installmentOccurrenceOf, interestCategoryLabel, keepsHistoricalCardIncome, makeEntryChange, minorFromEditedDraft, postingAccountsFor, sameEntry, summarizeMonthlyBudgets, todayKey, validateEntry, validateEntryChange, type Account, type Entry, type EntryChange, type EntryKind, type EntryRecord, type InstallmentPlan, type StoredDraft } from '@finanzapp/domain';
import { useLedger } from '../storage/LedgerProvider';
import { budgetTone } from './budget-presentation';
import { ActionButton, AmountField, AppText, Choices, DetailRow, EmptyState, ErrorMessage, Field, IconButton, Money, Screen, Surface } from './components';
import { draftFromMinor } from './money-input';
import { prefillDraft, type EntryPrefill } from './entry-prefill';
export type { EntryPrefill } from './entry-prefill';
import { AccountField, CategoryField, DateField } from './form-controls';
import { InstallmentPurchase } from './installment-purchase';
import { accountKindLabel, postingAccounts } from './liability-presentation';
import { initialAccountId } from './presentation';
import { installmentOfEntry } from './installment-presentation';
import { INITIAL_PURCHASE, buildPurchasePlan, purchaseState, type PurchaseDraft } from './purchase-plan';
import { withCurrencyCode } from '../i18n/format';
import { useI18n } from '../i18n/provider';
import { space } from './theme';

/** What a Save sends, frozen once built so a retry resends it unchanged: a movement (new or corrected), or (24T2) the
 * plan of a purchase in instalments, which records no movement of its own. */
type Submission = { entry: Entry; change?: EntryChange; plan?: undefined } | { plan: InstallmentPlan; entry?: undefined; change?: undefined };

type FormKind = EntryKind | 'transfer';

/** One form for creating and correcting a posting. The amount, the kind, the
 * category and the account or card are the four things a user must see; a
 * submitted command stays frozen across retries, including a failed refresh
 * after SQLite committed. Producto 24T2: a new expense on an active credit card
 * adds the «Pago» section (`InstallmentPurchase`): «En cuotas» saves one plan
 * and no movement. The movement of an instalment is corrected in its merchant
 * and category only; its amount, date and card are the plan's. */
export function EntryForm({ original, accountId: requestedAccount, currency, kind: requestedKind, onKindChange, onAccountChange, prefill }: {
  original?: EntryRecord; accountId?: string; currency?: string; kind?: string; prefill?: EntryPrefill;
  /** When a host owns the Gasto / Ingreso / Transferencia switch it passes `kind` and this callback; the form then renders no switch of its own. */
  onKindChange?: (kind: FormKind) => void;
  /** Lets the host carry the chosen account over when the mode changes. */
  onAccountChange?: (accountId: string) => void;
}) {
  const { snapshot, archive, addEntry, updateEntry, addInstallmentPlan } = useLedger();
  const { t, moneyText, formatMoneyAmount, spokenMoney, formatDate } = useI18n();
  // Cash accounts and cards can carry an expense or income; a personal debt only changes through payments.
  const [before] = useState(original);
  // 24T2: an instalment's movement (its id names the plan): the plan fixes its amount, date, card and kind.
  const restricted = !!before && installmentOccurrenceOf(before.entry.id) !== null;
  const accounts = postingAccounts(snapshot?.accounts ?? [], archive?.debts, before?.entry.accountId);
  const [operation] = useState(() => ({ id: randomUUID(), createdAt: new Date().toISOString() }));
  const [ownKind, setKind] = useState<EntryKind>(before?.entry.kind ?? (requestedKind === 'income' ? 'income' : 'expense'));
  const kind: EntryKind = onKindChange ? (requestedKind === 'income' ? 'income' : 'expense') : ownKind;
  const [chosenAccountId, setAccountId] = useState(() => before?.entry.accountId ?? initialAccountId(accounts, requestedAccount, currency));
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
  const [pending, setPending] = useState<Submission | null>(null);
  const saving = useRef(false);
  const [error, setError] = useState<string | null>(null);
  // 24T2: the «Pago» choices, kept while the section is hidden (another account, Ingreso) so coming back restores them.
  const [purchase, setPurchase] = useState<PurchaseDraft>(INITIAL_PURCHASE);
  const cards = archive?.cards ?? [], debts = archive?.debts ?? [];
  const originalCurrency = accounts.find(item => item.id === before?.entry.accountId)?.currency;
  // The accounts this kind may post to (24B6): an expense to cash or a card, an income to cash only. A historical income
  // stored on a card keeps that card offered while it is edited, so it can be corrected in place without moving it.
  const cashAndCards = postingAccountsFor(kind, accounts, cards, debts);
  // 25B2: the same for a movement recorded on an account or a card since deleted: its own row stays offered while it is
  // edited (amount, date, merchant, category are corrected in place), and only that row; nothing new is offered on it.
  const historical = before && (keepsHistoricalCardIncome(before.entry, { kind, accountId: before.entry.accountId }) || kind === before.entry.kind)
    ? accounts.filter(item => item.id === before.entry.accountId && !cashAndCards.some(offered => offered.id === item.id)) : [];
  const offered = historical.length ? cashAndCards.concat(historical) : cashAndCards;
  const eligibleAccounts = before ? offered.filter(item => item.currency === originalCurrency) : offered;
  // A card carried over from Gasto is no place for an income: the form shows a cash account in the same currency instead and
  // keeps the carried choice, so switching back to Gasto finds the card again.
  const accountId = eligibleAccounts.some(item => item.id === chosenAccountId) ? chosenAccountId
    : initialAccountId(eligibleAccounts, undefined, accounts.find(item => item.id === chosenAccountId)?.currency ?? currency);
  const account = accounts.find(item => item.id === accountId);
  const locked = busy || pending !== null;
  const close = () => { if (!saving.current) { if (router.canGoBack()) router.back(); else router.replace('/'); } };
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
  const describeAccount = (item: Account) => optionLine(item, minor => formatMoneyAmount(minor, item.currency));
  const spokenDescribeAccount = (item: Account) => optionLine(item, minor => spokenMoney(minor, item.currency));
  let parsed: number | null = null;
  try { parsed = account ? minorFromEditedDraft(amount, account.currency, stored) : null; } catch { parsed = null; }
  // A draft kept across an account change that the new currency cannot hold exactly blocks Save; the field says why.
  const fit = account ? editedDraftFits(amount, account.currency, stored) : { ok: true as const };
  // 24T2: «Pago» belongs to a new expense on an active credit card. An archived or deleted card takes no new purchase at
  // all (postingAccountsFor never offers it), and an edit never turns a movement into a plan.
  const purchaseCard = !before && kind === 'expense' && account ? cards.find(card => card.accountId === account.id && card.active && !card.deleted) : undefined;
  const today = todayKey();
  const planState = purchaseCard && account ? purchaseState({ draft: purchase, card: purchaseCard, currency: account.currency, cycleDates: archive?.cardCycleDates ?? [],
    purchaseDateISO: todayKey(date), principalMinor: parsed, todayISO: today }) : null;
  const inInstallments = !!planState && purchase.mode === 'installments';

  async function save() {
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    setError(null);
    Keyboard.dismiss();
    try {
      let submission = pending;
      if (!submission) {
        if (restricted && before) {
          // The merchant and the category are all that moves: storage refuses any other change to an instalment's movement.
          const entry: Entry = { ...before.entry, merchant: merchant.trim(), category: category.trim() };
          validateEntry(entry, accounts);
          if (sameEntry(before.entry, entry)) { saving.current = false; close(); return; }
          const change = makeEntryChange(operation.id, before, 'edit', new Date().toISOString(), entry);
          validateEntryChange(change, accounts);
          submission = { entry, change };
        } else {
          const dateISO = todayKey(date);
          // Messages are stored as catalogue keys and translated when shown (ErrorMessage), so they follow a language change.
          if (dateISO > todayKey()) throw new Error('entryForm.futureDate');
          if (!account) throw new Error('errors.domain.existingAccount'); // A catalogue key, translated when shown (ErrorMessage).
          if (inInstallments && purchaseCard) {
            // 24T2: one plan from exactly what the section previewed, and no movement: each instalment is recognised when
            // its statement closes (one already closed is recognised right after the save, by the provider).
            submission = { plan: buildPurchasePlan({ id: operation.id, createdAt: operation.createdAt, card: purchaseCard, cardAccount: account,
              merchant, category, draft: purchase, currency: account.currency, cycleDates: archive?.cardCycleDates ?? [], purchaseDateISO: dateISO,
              principalMinor: minorFromEditedDraft(amount, account.currency, stored), todayISO: todayKey(), interestCategory: interestCategoryLabel(archive?.categories ?? []) }) };
          } else {
            const entry: Entry = { ...(before?.entry ?? operation), kind, accountId, amountMinor: minorFromEditedDraft(amount, account.currency, stored),
              merchant: merchant.trim(), category: category.trim(), dateISO };
            validateEntry(entry, accounts);
            if (before && sameEntry(before.entry, entry)) { saving.current = false; close(); return; }
            const change = before ? makeEntryChange(operation.id, before, 'edit', new Date().toISOString(), entry) : undefined;
            if (change) validateEntryChange(change, accounts);
            submission = { entry, change };
          }
        }
        setPending(submission);
      }
      if (submission.plan) await addInstallmentPlan(submission.plan);
      else if (submission.change) await updateEntry(submission.change);
      else await addEntry(submission.entry);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      saving.current = false;
      close();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'entryForm.saveUnverified');
      // A plan built from a calendar the card no longer has is refused before anything is written: the submission is released
      // so the section shows the card's current statements again, and saving builds the plan anew (with the same id).
      if (cause instanceof Error && cause.message === PLAN_CALENDAR_MESSAGE) setPending(null);
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  const title = t(restricted ? 'entryForm.installmentEdit.title' : before ? 'entryForm.editTitle'
    : kind === 'expense' ? (isCard ? 'entryForm.cardPurchaseTitle' : 'entryForm.expenseTitle') : 'entryForm.incomeTitle');
  // A new movement's Save echoes the amount it records; VoiceOver hears the echo in the spoken form ("Guardar gasto, 1234,50 pesos").
  // In instalments it echoes the price of the purchase, the amount typed ("Guardar en cuotas · $ 1.200.000,00").
  const saveWord = t(inInstallments ? 'entryForm.plan.save' : kind === 'expense' ? 'entryForm.saveExpense' : 'entryForm.saveIncome');
  const submit: { text: string; spoken?: string } = pending && error ? { text: t('common.retrySave') } : before ? { text: t('common.saveChanges') }
    : parsed && parsed > 0 && account ? { text: saveWord + '\u00A0·\u00A0' + moneyText(parsed, account.currency), spoken: saveWord + ', ' + spokenMoney(parsed, account.currency) }
      : { text: saveWord };
  const header = <Stack.Screen options={{ title, gestureEnabled: !busy,
    headerLeft: () => <IconButton name="close" label={t('common.close')} onPress={close} disabled={busy} /> }} />;

  if (restricted && before) {
    // 24T2: the amount, the date and the card are the plan's: shown as facts, never as inputs; there is no Gasto/Ingreso
    // switch. The merchant and the category stay editable, and the category's budget still reads live. An instalment
    // recorded as two movements (principal and interest) names the part this one holds, never «the instalment».
    const fixed = accounts.find(item => item.id === before.entry.accountId);
    const share = installmentOfEntry(before.entry.id, archive?.installmentPlans);
    const amountLabel = t(share && (share.shared || share.component !== 'principal') ? `entryForm.installmentEdit.amountShare.${share.component}` : 'entryForm.installmentEdit.amount');
    return <Screen gap={space.l}>
      {header}
      <View style={{ gap: 6, paddingVertical: 8 }}>
        <AppText secondary variant="footnote" style={{ fontWeight: '500' }}>
          {fixed ? withCurrencyCode(amountLabel, fixed.currency) : amountLabel}
        </AppText>
        {fixed && <Money minor={before.entry.amountMinor} currency={fixed.currency} large size={40} />}
      </View>
      <Surface grouped>
        <DetailRow label={t('entryDetail.card')} value={fixed?.name ?? ''} icon="card-outline" />
        <DetailRow label={t('selection.date')} value={formatDate(before.entry.dateISO, 'dayYear')} spokenValue={formatDate(before.entry.dateISO, 'long')}
          icon="calendar-outline" last />
      </Surface>
      <AppText secondary variant="footnote">{t('entryForm.installmentEdit.note')}</AppText>
      <CategoryField entries={snapshot?.entries ?? []} kind={before.entry.kind} value={category} onChange={setCategory} disabled={locked}
        prominent detail={budget?.text} spokenDetail={budget?.spoken} detailTone={budget?.tone} />
      <Field label={t('entryForm.merchantExpense')} value={merchant} placeholder={t('entryForm.merchantExpensePlaceholder')}
        onChangeText={setMerchant} maxLength={120} autoCapitalize="sentences" editable={!locked} />
      <ErrorMessage message={error} />
      {pending && !busy && error && <AppText secondary variant="footnote">{t('entryForm.retryNote')}</AppText>}
      <ActionButton label={pending && error ? t('common.retrySave') : t('common.saveChanges')} onPress={save} busy={busy}
        disabled={!merchant.trim() || !category.trim()} />
    </Screen>;
  }

  return <Screen gap={space.l}>
    {header}
    {/* The form's own switch stays above the empty state of one kind, so Gasto is one tap away when Ingreso has no account. */}
    {!onKindChange && accounts.length > 0 && <Choices<EntryKind> value={kind} onChange={setKind} disabled={locked}
      options={[{ value: 'expense', label: t('movement.expense') }, { value: 'income', label: t('movement.income') }]} />}
    {!eligibleAccounts.length ? <EmptyState title={t('entryForm.noAccountTitle')}
      /* No account at all, or none this kind may post to (a card-only ledger asked for an income): the action adds a cash
         account, pushed over the draft (the carried card's currency prefilled) so the modal and its fields come back. */
      detail={t(accounts.length ? 'entryForm.noCashAccountDetail' : 'entryForm.noAccountDetail')}
      action={<ActionButton label={t('common.addAccount')} onPress={() => accounts.length
        ? router.push({ pathname: '/new-account', params: { currency: accounts.find(item => item.id === chosenAccountId)?.currency ?? currency ?? accounts[0].currency } })
        : router.replace('/new-account')} />} /> : <>
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
      {/* 24T2: after the date (the statement the first instalment goes to follows from it), and after every field the
          other form tests find first. Hidden, it keeps its choices. */}
      {planState && account && <InstallmentPurchase draft={purchase} onChange={patch => { setPurchase(current => ({ ...current, ...patch })); setError(null); }}
        state={planState} currency={account.currency} todayISO={today} disabled={locked} />}
      {isCard && kind === 'expense' && !before && <AppText secondary variant="footnote" style={{ textAlign: 'center' }}>
        {t(inInstallments ? 'entryForm.plan.note' : 'entryForm.cardNote')}
      </AppText>}
      {before && <AppText secondary variant="footnote" style={{ textAlign: 'center' }}>{t('entryForm.correctionNote')}</AppText>}
      <ErrorMessage message={error} />
      {pending && !busy && error && <AppText secondary variant="footnote">{t(pending?.plan ? 'entryForm.plan.retryNote' : 'entryForm.retryNote')}</AppText>}
      <ActionButton label={submit.text} spokenLabel={submit.spoken}
        onPress={save} busy={busy} disabled={!amount.trim() || !merchant.trim() || !category.trim() || !account || !fit.ok || (inInstallments && planState.blocked)} />
    </>}
  </Screen>;
}
