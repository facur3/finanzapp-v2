import { useRef, useState } from 'react';
import { Keyboard, View } from 'react-native';
import { router, Stack } from 'expo-router';
import { randomUUID } from 'expo-crypto';
import * as Haptics from 'expo-haptics';
import { accountBalanceMinor, accountKind, hiddenLiabilityAccountIds, makeTransferChange, parseMinorUnits, sameTransfer, todayKey,
  totalsByCurrency, validateTransfer, validateTransferChange, type Account, type Transfer, type TransferChange, type TransferRecord } from '@finanzapp/domain';
import { useLedger } from '../storage/LedgerProvider';
import { ActionButton, AmountField, AmountShortcut, AppText, DetailRow, EmptyState, ErrorMessage, Field, IconButton, Screen, Surface } from './components';
import { amountFromMinor, draftFromMinor } from './money-input';
import { AccountField, DateField, SelectorCard } from './form-controls';
import { initialAccountId } from './presentation';
import { space, usePalette } from './theme';
import { useI18n } from '../i18n/provider';
import { accountDisplayName } from './liability-presentation';

/** One form for three movements that are never spending or income: a transfer
 * between cash accounts, a card payment (cash → card) and a debt payment or
 * collection (cash → debt, receivable → cash). The obligation side is fixed by
 * the caller; only the cash side is chosen here. */
export function TransferForm({ original, accountId, fromAccountId: requestedFrom, toAccountId: requestedTo,
  title, defaultNote, maxAmountMinor, onAccountChange }: {
  original?: TransferRecord; accountId?: string; fromAccountId?: string; toAccountId?: string; title?: string;
  defaultNote?: string; maxAmountMinor?: string;
  /** Lets the host carry the source account over when the mode changes. */
  onAccountChange?: (accountId: string) => void;
}) {
  const { snapshot, archive, addTransfer, updateTransfer } = useLedger();
  const p = usePalette();
  const { t, formatAmount, spokenNumber } = useI18n();
  // A debt's hidden account is named from the debt, in the interface language (see accountDisplayName).
  const nameOf = (account: Account) => accountDisplayName(account, archive?.debts ?? [], t);
  const accounts = snapshot?.accounts ?? [];
  const cards = archive?.cards ?? [], debts = archive?.debts ?? [];
  const hidden = hiddenLiabilityAccountIds(cards, debts);
  const [before] = useState(original);
  const [operation] = useState(() => ({ id: randomUUID(), createdAt: new Date().toISOString() }));
  const requestedTarget = accounts.find(a => a.id === requestedTo);
  const requestedSource = accounts.find(a => a.id === requestedFrom);
  // A card payment or debt settlement fixes the obligation side of the transfer.
  const lockedTo = !before && requestedTarget && hidden.has(requestedTarget.id) ? requestedTarget : null;
  const lockedFrom = !before && requestedSource && hidden.has(requestedSource.id) ? requestedSource : null;
  const cash = accounts.filter(a => !hidden.has(a.id));
  const [fromId, setFromId] = useState(() => before?.transfer.fromAccountId ?? lockedFrom?.id ?? requestedSource?.id
    ?? (lockedTo ? cash.find(a => a.currency === lockedTo.currency)?.id : undefined) ?? initialAccountId(cash, accountId));
  const [toId, setToId] = useState(() => before?.transfer.toAccountId ?? lockedTo?.id ?? requestedTarget?.id
    ?? (lockedFrom ? cash.find(a => a.currency === lockedFrom.currency)?.id : undefined) ?? '');
  const [amount, setAmount] = useState(before ? draftFromMinor(before.transfer.amountMinor) : '');
  // A card payment or a debt settlement writes its own default note in the language active when the form opens
  // (it is then the user's editable text); a caller's note, kept for older deep links, still wins.
  const [note, setNote] = useState(() => {
    if (before) return before.transfer.note;
    if (defaultNote !== undefined) return defaultNote;
    const target = lockedTo ?? lockedFrom;
    if (!target) return '';
    const kind = accountKind(target.id, cards, debts);
    if (kind === 'card') return t('cards.payment.note', { name: target.name });
    if (kind !== 'debt') return '';
    const name = debts.find(debt => debt.accountId === target.id)?.counterparty ?? target.name;
    return t(lockedTo ? 'debts.payment.note' : 'debts.collection.note', { name });
  });
  const [date, setDate] = useState(() => before ? new Date(before.transfer.dateISO + 'T12:00:00') : new Date());
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<{ transfer: Transfer; change?: TransferChange } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const saving = useRef(false);
  const from = accounts.find(a => a.id === fromId), to = accounts.find(a => a.id === toId);
  const originalCurrency = accounts.find(a => a.id === before?.transfer.fromAccountId)?.currency;
  // Editing keeps the original obligation accounts selectable; a new plain transfer only lists cash accounts.
  const allowed = new Set([before?.transfer.fromAccountId, before?.transfer.toAccountId].filter(Boolean));
  const selectable = accounts.filter(a => !hidden.has(a.id) || allowed.has(a.id));
  const sources = before ? selectable.filter(a => a.currency === originalCurrency) : selectable;
  const targets = selectable.filter(a => a.id !== fromId && a.currency === from?.currency);
  const locked = busy || pending !== null;
  const close = () => { if (!saving.current) { if (router.canGoBack()) router.back(); else router.replace('/'); } };
  const contextualMax = maxAmountMinor && /^\d{1,16}$/.test(maxAmountMinor) ? Number(maxAmountMinor) : null;
  const obligation = lockedTo ?? lockedFrom;
  const obligationKind = obligation ? accountKind(obligation.id, cards, debts) : 'cash';
  const typeOf = (id: string) => accountKind(id, cards, debts);
  // The screen names what it records, so the title follows a language change; a `title` parameter only serves older deep links.
  const obligationTitle = obligationKind === 'card' ? t('cards.payment.title')
    : obligationKind === 'debt' ? t(lockedTo ? 'debts.payment.title' : 'debts.collection.title') : undefined;
  const kindLabel = (id: string) => { const kind = typeOf(id); return t(kind === 'card' ? 'accountKinds.card' : kind === 'debt' ? 'accountKinds.debt' : 'accountKinds.account'); };

  function draft(): Transfer {
    return { ...(before?.transfer ?? operation), fromAccountId: fromId, toAccountId: toId, amountMinor: parseMinorUnits(amount), note: note.trim(), dateISO: todayKey(date) };
  }
  function validateContext(transfer: Transfer) {
    if (contextualMax !== null && Number.isSafeInteger(contextualMax) && transfer.amountMinor > contextualMax) {
      // Catalogue keys, translated when shown (ErrorMessage).
      throw new Error(obligationKind === 'card' ? 'transferForm.overCardDebt' : 'transferForm.overObligation');
    }
  }
  // Show the full effect of an edit (remove the old transfer, then apply the new one).
  function proposed(transfer: Transfer) {
    return { accounts, entries: snapshot?.entries ?? [], transfers: [...(snapshot?.transfers ?? []).filter(t => t.id !== before?.transfer.id), transfer] };
  }
  let preview: { from: number; to: number } | null = null;
  try {
    const transfer = draft();
    validateTransfer(transfer, accounts);
    validateContext(transfer);
    const next = proposed(transfer);
    totalsByCurrency(next);
    preview = { from: accountBalanceMinor(from!, next.entries, next.transfers), to: accountBalanceMinor(to!, next.entries, next.transfers) };
  } catch { /* Incomplete input isn't an error until the user submits. */ }
  async function save() {
    if (saving.current || !snapshot) return;
    saving.current = true; setBusy(true); setError(null); Keyboard.dismiss();
    try {
      let submission = pending;
      if (!submission) {
        const transfer = draft();
        validateTransfer(transfer, accounts);
        validateContext(transfer);
        if (transfer.dateISO > todayKey()) throw new Error('transferForm.futureDate');
        totalsByCurrency(proposed(transfer));
        if (before && sameTransfer(before.transfer, transfer)) { saving.current = false; close(); return; }
        const change = before ? makeTransferChange(operation.id, before, 'edit', new Date().toISOString(), transfer) : undefined;
        if (change) validateTransferChange(change, accounts);
        submission = { transfer, change }; setPending(submission);
      }
      if (submission.change) await updateTransfer(submission.change); else await addTransfer(submission.transfer);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      saving.current = false; close();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'transferForm.saveUnverified'); }
    finally { saving.current = false; setBusy(false); }
  }
  // An account's recorded figure with its currency: a card owed or in credit and a debt pending are worded,
  // with the code where the language places it ("Deuda ARS 50,00", "Owed ARS 50.00"); cash is its code and
  // signed amount, joined so the code never ends a line alone. `number` writes the amount: the region's
  // separators on screen (formatAmount), the language's for VoiceOver (spokenNumber).
  const balanceLabel = (account: Account, value: number, number: (minor: number) => string = formatAmount) => {
    const kind = accountKind(account.id, cards, debts), currency = account.currency;
    if (kind === 'card') return t(value < 0 ? 'transferForm.balanceDebt' : 'transferForm.balanceCredit', { currency, amount: number(Math.abs(value)) });
    if (kind === 'debt') return t('transferForm.balancePending', { currency, amount: number(Math.abs(value)) });
    return currency + '\u00A0' + number(value);
  };
  // Paying an obligation only makes sense from cash in the same currency.
  const cashSources = sources.filter(a => !obligation || (a.id !== obligation.id && a.currency === obligation.currency));
  const noCashCounterpart = !!obligation && !cash.some(a => a.currency === obligation.currency);
  const submitLabel = pending && error ? t('common.retrySave') : before ? t('common.saveChanges')
    : t(obligationKind === 'card' ? 'transferForm.recordPayment' : obligationKind === 'debt' ? (lockedTo ? 'transferForm.recordPayment' : 'transferForm.recordCollection') : 'transferForm.recordTransfer');
  // The whole recorded figure a shortcut may fill: the source's positive balance
  // for a transfer, the outstanding obligation for a payment or collection. It is
  // read from the current records (minus the transfer being edited), never from a
  // stale parameter; the caller's cap still bounds it. A negative or zero figure
  // offers no action. The shortcut only fills the field; saving stays explicit.
  const shortcut = (() => {
    if (!snapshot) return null;
    const recorded = (item: Account) => accountBalanceMinor(item, snapshot.entries, (snapshot.transfers ?? []).filter(t => t.id !== before?.transfer.id));
    try {
      const context = lockedTo ? { account: lockedTo, minor: -recorded(lockedTo), label: t(obligationKind === 'card' ? 'transferForm.payTotal' : 'transferForm.settleTotal') }
        : lockedFrom ? { account: lockedFrom, minor: recorded(lockedFrom), label: t('transferForm.collectTotal') }
          : from ? { account: from, minor: recorded(from), label: t('transferForm.useAll') } : null;
      if (!context) return null;
      let fill = Math.max(0, context.minor);
      if (contextualMax !== null && Number.isSafeInteger(contextualMax)) fill = Math.min(fill, contextualMax);
      // A card in credit has nothing to pay; an obligation is pending or settled, never negative; cash is shown as recorded.
      const figure = obligationKind === 'card' ? (context.minor < 0 ? ['transferForm.figureCredit', -context.minor] as const : ['transferForm.figureDebt', context.minor] as const)
        : obligationKind === 'debt' ? ['transferForm.figurePending', Math.max(0, context.minor)] as const : ['transferForm.figureBalance', context.minor] as const;
      const caption = (number: (minor: number) => string) => t('transferForm.figure', { label: t(figure[0]), currency: context.account.currency, amount: number(figure[1]) });
      return { ...context, fill, text: caption(formatAmount), spoken: caption(spokenNumber) };
    } catch { return null; }
  })();
  const balanceDetail = (id: string | undefined, number?: (minor: number) => string) => {
    const item = accounts.find(a => a.id === id);
    if (!item || !snapshot) return undefined;
    return balanceLabel(item, accountBalanceMinor(item, snapshot.entries, snapshot.transfers), number);
  };

  return <Screen gap={space.l}>
    <Stack.Screen options={{ title: before ? t('transferForm.editTitle') : obligationTitle ?? title ?? t('transferForm.title'), gestureEnabled: !busy,
      headerLeft: () => <IconButton name="close" label={t('common.close')} onPress={close} disabled={busy} /> }} />
    {!sources.length || noCashCounterpart ? <EmptyState title={t('entryForm.noAccountTitle')} detail={obligation
      ? t(lockedTo ? 'transferForm.needAccountOut' : 'transferForm.needAccountIn', { currency: obligation.currency })
      : t('transferForm.needAccounts')}
      action={<ActionButton label={t('common.addAccount')} onPress={() => router.replace({ pathname: '/new-account', params: obligation ? { currency: obligation.currency } : {} })} />} /> : <>
      <AmountField label={t(obligationKind === 'card' ? 'transferForm.payment' : obligationKind === 'debt' ? (lockedTo ? 'transferForm.payment' : 'transferForm.collection') : 'transferForm.transfer')}
        currency={(obligation ?? from)?.currency ?? 'ARS'} value={amount} onChangeText={value => { setAmount(value); setError(null); }} editable={!locked} tone="transfer" />
      {shortcut && <AmountShortcut caption={shortcut.text} spokenCaption={shortcut.spoken} label={shortcut.fill > 0 ? shortcut.label : undefined} disabled={locked}
        onPress={shortcut.fill > 0 ? () => { setAmount(amountFromMinor(shortcut.fill)); setError(null); } : undefined} />}
      <View style={{ gap: space.m }}>
        {lockedFrom ? <SelectorCard label={kindLabel(lockedFrom.id)} value={nameOf(lockedFrom)} placeholder="" detail={balanceDetail(lockedFrom.id)} spokenDetail={balanceDetail(lockedFrom.id, spokenNumber)}
          icon={obligationKind === 'card' ? 'card-outline' : 'people-outline'} color={p.primary} disabled onPress={() => {}} />
          : <AccountField label={t('transferForm.from')} accounts={cashSources} value={fromId} disabled={locked} kindOf={kindLabel} typeOf={typeOf} prominent detail={balanceDetail(fromId)} spokenDetail={balanceDetail(fromId, spokenNumber)} onChange={id => {
            setFromId(id);
            onAccountChange?.(id);
            const source = accounts.find(a => a.id === id);
            if (!lockedTo && (toId === id || to?.currency !== source?.currency)) setToId('');
          }} />}
        {lockedTo ? <SelectorCard label={kindLabel(lockedTo.id)} value={nameOf(lockedTo)} placeholder="" detail={balanceDetail(lockedTo.id)} spokenDetail={balanceDetail(lockedTo.id, spokenNumber)}
          icon={obligationKind === 'card' ? 'card-outline' : 'people-outline'} color={p.primary} disabled onPress={() => {}} />
          : <AccountField label={t('transferForm.to')} accounts={lockedFrom ? targets.filter(a => a.id !== lockedFrom.id) : targets} value={toId} onChange={setToId}
            kindOf={kindLabel} typeOf={typeOf}
            prominent detail={balanceDetail(toId)} spokenDetail={balanceDetail(toId, spokenNumber)} disabled={locked || !targets.length} />}
      </View>
      <Surface grouped><DateField value={date} onChange={setDate} disabled={locked} /></Surface>
      {!obligation && !targets.length && <EmptyState title={t('transferForm.missingTitle')} detail={t('transferForm.missingDetail')}
        action={<ActionButton label={t('common.addAccount')} secondary disabled={locked} onPress={() => router.push({ pathname: '/new-account', params: { currency: from?.currency ?? 'ARS' } })} />} />}
      <Field label={t('transferForm.note')} value={note} onChangeText={setNote} maxLength={120} editable={!locked} />
      {preview && from && to && <Surface grouped>
        <DetailRow label={t('transferForm.after', { name: nameOf(from) })} value={balanceLabel(from, preview.from)} spokenValue={balanceLabel(from, preview.from, spokenNumber)} />
        <DetailRow label={t('transferForm.after', { name: nameOf(to) })} value={balanceLabel(to, preview.to)} spokenValue={balanceLabel(to, preview.to, spokenNumber)} last />
      </Surface>}
      {preview && from && to && ((preview.from < 0 && !hidden.has(from.id)) || (preview.to < 0 && !hidden.has(to.id))) && <AppText secondary variant="subhead">
        {t('transferForm.negativeWarning')}
      </AppText>}
      <AppText secondary variant="footnote">
        {t(obligationKind === 'card' ? 'transferForm.explainCard' : obligationKind === 'debt' ? 'transferForm.explainDebt' : 'transferForm.explainTransfer')}
      </AppText>
      <ErrorMessage message={error} />
      {pending && error && <AppText secondary variant="footnote">{t('transferForm.retryNote')}</AppText>}
      <ActionButton label={submitLabel} busy={busy} disabled={!amount.trim() || !from || !to || from.id === to.id || from.currency !== to.currency} onPress={save} />
    </>}
  </Screen>;
}
