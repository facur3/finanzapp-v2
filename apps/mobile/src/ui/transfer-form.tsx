import { useRef, useState } from 'react';
import { Keyboard, View } from 'react-native';
import { router, Stack } from 'expo-router';
import { randomUUID } from 'expo-crypto';
import { accountBalanceMinor, accountKind, assertTransferSides, editedDraftFits, hiddenLiabilityAccountIds, isLiveAccount, makeTransferChange, minorFromEditedDraft, sameTransfer, todayKey, type StoredDraft,
  totalsByCurrency, validateTransfer, validateTransferChange, type Account, type Transfer, type TransferChange, type TransferRecord } from '@finanzapp/domain';
import { useLedger } from '../storage/LedgerProvider';
import { ActionButton, AmountField, AmountShortcut, AppText, DetailRow, EmptyState, ErrorMessage, Field, IconButton, Screen, Surface } from './components';
import { amountFromMinor, draftFromMinor } from './money-input';
import { AccountField, DateField, SelectorCard } from './form-controls';
import { errorHaptic, successHaptic, warningHaptic } from './motion';
import { initialAccountId, releasesDraft } from './presentation';
import { space, usePalette } from './theme';
import { useI18n } from '../i18n/provider';
import { accountDisplayName } from './liability-presentation';

/** One form for three movements that are never spending or income: a transfer
 * between cash accounts, a card payment (cash → card) and a debt payment or
 * collection (cash → debt, receivable → cash). The obligation side is fixed by
 * the caller, or by the stored transfer an edit opens; only the cash side is chosen here. */
export function TransferForm({ original, accountId, fromAccountId: requestedFrom, toAccountId: requestedTo,
  title, defaultNote, maxAmountMinor, amountMinor, onAccountChange, onLockedChange }: {
  original?: TransferRecord; accountId?: string; fromAccountId?: string; toAccountId?: string; title?: string;
  defaultNote?: string; maxAmountMinor?: string;
  /** 24UX4 («Saldar»): a debt's whole outstanding balance, prefilled in its own minor units and still editable. */
  amountMinor?: string;
  /** Lets the host carry the source account over when the mode changes. */
  onAccountChange?: (accountId: string) => void;
  /** 25VIS2: tells the host when a save is in flight or frozen for retry (exactly `busy || pending !== null`), so its switch locks. */
  onLockedChange?: (locked: boolean) => void;
}) {
  const { snapshot, archive, addTransfer, updateTransfer } = useLedger();
  const p = usePalette();
  const { t, formatMoneyAmount, moneyText, spokenMinor, spokenMoney, failureMessage } = useI18n();
  // A debt's hidden account is named from the debt, in the interface language (see accountDisplayName).
  const nameOf = (account: Account) => accountDisplayName(account, archive?.debts ?? [], t);
  const accounts = snapshot?.accounts ?? [];
  const cards = archive?.cards ?? [], debts = archive?.debts ?? [];
  const hidden = hiddenLiabilityAccountIds(cards, debts);
  const [before] = useState(original);
  const [operation] = useState(() => ({ id: randomUUID(), createdAt: new Date().toISOString() }));
  // 25B2: a link naming a deleted account or card opens a plain transfer instead; the sides of a stored transfer stay selectable while it is edited.
  const open = (a: Account) => isLiveAccount(a) && !cards.some(card => card.deleted && card.accountId === a.id) && !debts.some(debt => debt.deleted && debt.accountId === a.id);
  const requestedTarget = accounts.find(a => a.id === requestedTo && open(a));
  // A card is never a source (24B6): a link asking to transfer out of one opens a plain transfer instead.
  const requestedSource = accounts.find(a => a.id === requestedFrom && accountKind(a.id, cards, debts) !== 'card' && open(a));
  const typeOf = (id: string) => accountKind(id, cards, debts);
  const storedFrom = accounts.find(a => a.id === before?.transfer.fromAccountId), storedTo = accounts.find(a => a.id === before?.transfer.toAccountId);
  // A card payment or debt settlement fixes the obligation side. 25Q4: an edit keeps the stored one fixed (cash → card or
  // debt is a payment, debt → cash a collection), so it stays the same kind of transfer. Any other stored shape (out of a
  // card, between two obligations) keeps the generic form. A stored side is never checked with `open`: a payment to a
  // deleted card or debt still opens.
  const lockedTo = before ? (storedFrom && storedTo && typeOf(storedFrom.id) === 'cash' && typeOf(storedTo.id) !== 'cash' ? storedTo : null)
    : requestedTarget && hidden.has(requestedTarget.id) ? requestedTarget : null;
  const lockedFrom = before ? (storedFrom && storedTo && typeOf(storedFrom.id) === 'debt' && typeOf(storedTo.id) === 'cash' ? storedFrom : null)
    : requestedSource && hidden.has(requestedSource.id) ? requestedSource : null;
  // 25B2: a deleted account is never a side of a new transfer.
  const cash = accounts.filter(a => !hidden.has(a.id) && isLiveAccount(a));
  const [fromId, setFromId] = useState(() => before?.transfer.fromAccountId ?? lockedFrom?.id ?? requestedSource?.id
    ?? (lockedTo ? cash.find(a => a.currency === lockedTo.currency)?.id : undefined) ?? initialAccountId(cash, accountId));
  const [toId, setToId] = useState(() => before?.transfer.toAccountId ?? lockedTo?.id ?? requestedTarget?.id
    ?? (lockedFrom ? cash.find(a => a.currency === lockedFrom.currency)?.id : undefined) ?? '');
  // An untouched prefill keeps the stored minor units (a stored amount may exceed the entry bound); an edited text is a new entry.
  const [stored] = useState<StoredDraft | null>(() => {
    const own = before ? accounts.find(a => a.id === before.transfer.fromAccountId)?.currency : undefined;
    if (before && own) return { minor: before.transfer.amountMinor, currency: own, draft: draftFromMinor(before.transfer.amountMinor, own) };
    // Only a debt settlement is prefilled, in the debt's currency; any other or malformed request starts empty.
    const debtSide = lockedTo ?? lockedFrom;
    const prefill = amountMinor && /^\d{1,15}$/.test(amountMinor) ? Number(amountMinor) : 0;
    if (!before && debtSide && prefill > 0 && accountKind(debtSide.id, cards, debts) === 'debt') {
      return { minor: prefill, currency: debtSide.currency, draft: draftFromMinor(prefill, debtSide.currency) };
    }
    return null;
  });
  const [amount, setAmount] = useState(stored?.draft ?? '');
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
  // Editing keeps the stored sides selectable; the obligation is fixed above. A new plain transfer only lists cash accounts.
  const allowed = new Set([before?.transfer.fromAccountId, before?.transfer.toAccountId].filter(Boolean));
  const selectable = accounts.filter(a => (!hidden.has(a.id) && isLiveAccount(a)) || allowed.has(a.id));
  const sources = before ? selectable.filter(a => a.currency === originalCurrency) : selectable;
  // 25Q4: an edit offers another side only when storage would accept the new pair. changeTransfer runs assertTransferSides
  // on changed sides: no deleted account, card or debt; never a card as the source; never two obligations. The stored pair
  // always stays, so no choice ends in a refusal that freezes the form.
  const storable = (fromAccountId: string, toAccountId: string) => {
    if (!before || (fromAccountId === before.transfer.fromAccountId && toAccountId === before.transfer.toAccountId)) return true;
    try { assertTransferSides({ fromAccountId, toAccountId }, cards, debts, accounts); return true; } catch { return false; }
  };
  const targets = selectable.filter(a => a.id !== fromId && a.currency === from?.currency && storable(fromId, a.id));
  const locked = busy || pending !== null;
  const close = () => { if (!saving.current) { if (router.canGoBack()) router.back(); else router.replace('/'); } };
  const amountCurrency = (lockedTo ?? lockedFrom ?? from)?.currency;
  const fit = amountCurrency ? editedDraftFits(amount, amountCurrency, stored) : { ok: true as const };
  const obligation = lockedTo ?? lockedFrom;
  const obligationKind = obligation ? accountKind(obligation.id, cards, debts) : 'cash';
  // An account's recorded figure without the transfer being edited (the shortcut and the debt cap read it).
  const recorded = (item: Account) => accountBalanceMinor(item, snapshot?.entries ?? [], (snapshot?.transfers ?? []).filter(t => t.id !== before?.transfer.id));
  // Minor units of the obligation's own currency, at most 15 digits (the entry bound): never read as hundredths.
  const paramCap = maxAmountMinor && /^\d{1,15}$/.test(maxAmountMinor) ? Number(maxAmountMinor) : null;
  // 25Q4: paying what I owe or collecting what I am owed settles at most what is pending without the transfer being edited.
  // It is read from the records, as «Saldar» and the shortcut read it, for new and edited payments alike, so the cap no
  // longer lives only in a route parameter. An edit of an older overpayment may keep its stored amount but never raise it.
  // A card keeps only its caller's cap (its credit is modelled).
  const debtCap = (() => {
    if (!obligation || obligationKind !== 'debt' || !debts.some(debt => debt.accountId === obligation.id && debt.direction === (lockedTo ? 'owed_by_me' : 'owed_to_me'))) return null;
    try {
      const outstanding = Math.max(0, lockedTo ? -recorded(obligation) : recorded(obligation));
      return before ? Math.max(before.transfer.amountMinor, outstanding) : outstanding;
    } catch { return null; }
  })();
  const contextualMax = paramCap === null ? debtCap : debtCap === null ? paramCap : Math.min(paramCap, debtCap);
  // The screen names what it records, so the title follows a language change; a `title` parameter only serves older deep links.
  const obligationTitle = obligationKind === 'card' ? t('cards.payment.title')
    : obligationKind === 'debt' ? t(lockedTo ? 'debts.payment.title' : 'debts.collection.title') : undefined;
  const kindLabel = (id: string) => { const kind = typeOf(id); return t(kind === 'card' ? 'accountKinds.card' : kind === 'debt' ? 'accountKinds.debt' : 'accountKinds.account'); };

  function draft(): Transfer {
    if (!amountCurrency) throw new Error('errors.domain.twoAccounts'); // A catalogue key, translated when shown (ErrorMessage).
    return { ...(before?.transfer ?? operation), fromAccountId: fromId, toAccountId: toId, amountMinor: minorFromEditedDraft(amount, amountCurrency, stored), note: note.trim(), dateISO: todayKey(date) };
  }
  // The refusal of an amount over the cap: catalogue keys, translated when shown (ErrorMessage).
  const overKey = obligationKind === 'card' ? 'transferForm.overCardDebt' : 'transferForm.overObligation';
  const overCap = (minor: number) => contextualMax !== null && Number.isSafeInteger(contextualMax) && minor > contextualMax;
  function validateContext(transfer: Transfer) { if (overCap(transfer.amountMinor)) throw new Error(overKey); }
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
    // 25VIS2: the host's switch stays locked while this runs and for as long as a submission stays frozen afterwards.
    onLockedChange?.(true);
    let frozen = pending !== null;
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
        submission = { transfer, change }; setPending(submission); frozen = true;
      }
      if (submission.change) await updateTransfer(submission.change); else await addTransfer(submission.transfer);
      successHaptic();
      saving.current = false; close();
    } catch (cause) {
      setError(failureMessage(cause, 'transferForm.saveUnverified'));
      // 25VIS2 (V4): a refusal (before the submission froze, or one storage decided before writing) taps Error; an outcome
      // that may have been written taps Warning. Either way a frozen submission stays frozen here, for the exact retry.
      const refused = !frozen || (cause instanceof Error && releasesDraft(cause.message));
      if (refused) errorHaptic(); else warningHaptic();
    }
    finally { saving.current = false; setBusy(false); onLockedChange?.(frozen); }
  }
  // An account's recorded figure with its currency: a card owed or in credit and a debt pending are worded,
  // with the code where the language places it ("Saldo pendiente ARS 50,00", "Outstanding ARS 50.00"); cash is its
  // code and signed amount, joined so the code never ends a line alone. 25Q4: a debt with nothing pending, or past
  // zero, reads «Saldada», as every debt screen clamps it, never an overpayment under «Pendiente». `number` writes the
  // amount: the region's separators and the currency's decimals on screen (formatMoneyAmount), the language's for
  // VoiceOver (spokenMinor).
  const balanceLabel = (account: Account, value: number, number: (minor: number, currency: Account['currency']) => string = formatMoneyAmount) => {
    const kind = accountKind(account.id, cards, debts), currency = account.currency;
    if (kind === 'card') return value === 0 ? t('transferForm.balanceClear')
      : t(value < 0 ? 'transferForm.balanceDebt' : 'transferForm.balanceCredit', { currency, amount: number(Math.abs(value), currency) });
    if (kind === 'debt') {
      const outstanding = debts.find(debt => debt.accountId === account.id)?.direction === 'owed_to_me' ? value : -value;
      return outstanding > 0 ? t('transferForm.balancePending', { currency, amount: number(outstanding, currency) }) : t('debts.status.settled');
    }
    return currency + '\u00A0' + number(value, currency);
  };
  // Paying an obligation only makes sense from cash in the same currency.
  const cashSources = sources.filter(a => (!obligation || (a.id !== obligation.id && a.currency === obligation.currency)) && storable(a.id, toId));
  // An edit keeps its stored cash side even when it was deleted since, so only a new payment needs one to exist.
  const noCashCounterpart = !before && !!obligation && !cash.some(a => a.currency === obligation.currency);
  const submitLabel = pending && error ? t('common.retrySave') : before ? t('common.saveChanges')
    : t(obligationKind === 'card' ? 'transferForm.recordPayment' : obligationKind === 'debt' ? (lockedTo ? 'transferForm.recordPayment' : 'transferForm.recordCollection') : 'transferForm.recordTransfer');
  // 25VIS2: a new transfer, payment or collection echoes the amount it records, as a new expense or income does
  // ("Registrar transferencia · $ 1.234,50"; VoiceOver hears the spoken form). Read exactly as the save reads it; an
  // edit or a retry keeps its plain words.
  let parsed: number | null = null;
  try { parsed = amountCurrency ? minorFromEditedDraft(amount, amountCurrency, stored) : null; } catch { parsed = null; }
  const submit: { text: string; spoken?: string } = !before && !(pending && error) && parsed && parsed > 0 && amountCurrency
    ? { text: submitLabel + '\u00A0·\u00A0' + moneyText(parsed, amountCurrency), spoken: submitLabel + ', ' + spokenMoney(parsed, amountCurrency) }
    : { text: submitLabel };
  // The whole recorded figure a shortcut may fill: the source's positive balance
  // for a transfer, the outstanding obligation for a payment or collection. It is
  // read from the current records (minus the transfer being edited), never from a
  // stale parameter; the caller's cap still bounds it. A negative or zero figure
  // offers no action. The shortcut only fills the field; saving stays explicit.
  const shortcut = (() => {
    if (!snapshot) return null;
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
      const caption = (number: (minor: number, currency: Account['currency']) => string) => t('transferForm.figure', { label: t(figure[0]), currency: context.account.currency, amount: number(figure[1], context.account.currency) });
      return { ...context, fill, text: caption(formatMoneyAmount), spoken: caption(spokenMinor) };
    } catch { return null; }
  })();
  const balanceDetail = (id: string | undefined, number?: (minor: number, currency: Account['currency']) => string) => {
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
        currency={(obligation ?? from)?.currency ?? 'ARS'} value={amount} onChangeText={value => { setAmount(value); setError(null); }} editable={!locked} tone="transfer" stored={stored ?? undefined} />
      {shortcut && <AmountShortcut caption={shortcut.text} spokenCaption={shortcut.spoken} label={shortcut.fill > 0 ? shortcut.label : undefined} disabled={locked}
        onPress={shortcut.fill > 0 && amountCurrency ? () => { setAmount(amountFromMinor(shortcut.fill, amountCurrency)); setError(null); } : undefined} />}
      <View style={{ gap: space.m }}>
        {lockedFrom ? <SelectorCard label={kindLabel(lockedFrom.id)} value={nameOf(lockedFrom)} placeholder="" detail={balanceDetail(lockedFrom.id)} spokenDetail={balanceDetail(lockedFrom.id, spokenMinor)}
          icon={obligationKind === 'card' ? 'card-outline' : 'people-outline'} color={p.primary} fixed />
          : <AccountField label={t('transferForm.from')} accounts={cashSources} value={fromId} disabled={locked} kindOf={kindLabel} typeOf={typeOf} prominent detail={balanceDetail(fromId)} spokenDetail={balanceDetail(fromId, spokenMinor)} onChange={id => {
            setFromId(id);
            onAccountChange?.(id);
            const source = accounts.find(a => a.id === id);
            if (!lockedTo && (toId === id || to?.currency !== source?.currency)) setToId('');
          }} />}
        {lockedTo ? <SelectorCard label={kindLabel(lockedTo.id)} value={nameOf(lockedTo)} placeholder="" detail={balanceDetail(lockedTo.id)} spokenDetail={balanceDetail(lockedTo.id, spokenMinor)}
          icon={obligationKind === 'card' ? 'card-outline' : 'people-outline'} color={p.primary} fixed />
          : <AccountField label={t('transferForm.to')} accounts={lockedFrom ? targets.filter(a => a.id !== lockedFrom.id) : targets} value={toId} onChange={setToId}
            kindOf={kindLabel} typeOf={typeOf}
            prominent detail={balanceDetail(toId)} spokenDetail={balanceDetail(toId, spokenMinor)} disabled={locked || !targets.length} />}
      </View>
      <Surface grouped><DateField value={date} onChange={setDate} disabled={locked} /></Surface>
      {!obligation && !targets.length && <EmptyState title={t('transferForm.missingTitle')} detail={t('transferForm.missingDetail')}
        action={<ActionButton label={t('common.addAccount')} secondary disabled={locked} onPress={() => router.push({ pathname: '/new-account', params: { currency: from?.currency ?? 'ARS' } })} />} />}
      <Field label={t('transferForm.note')} value={note} onChangeText={setNote} maxLength={120} editable={!locked} />
      {preview && from && to && <Surface grouped>
        <DetailRow label={t('transferForm.after', { name: nameOf(from) })} value={balanceLabel(from, preview.from)} spokenValue={balanceLabel(from, preview.from, spokenMinor)} />
        <DetailRow label={t('transferForm.after', { name: nameOf(to) })} value={balanceLabel(to, preview.to)} spokenValue={balanceLabel(to, preview.to, spokenMinor)} last />
      </Surface>}
      {preview && from && to && ((preview.from < 0 && !hidden.has(from.id)) || (preview.to < 0 && !hidden.has(to.id))) && <AppText secondary variant="subhead">
        {t('transferForm.negativeWarning')}
      </AppText>}
      <AppText secondary variant="footnote">
        {t(obligationKind === 'card' ? 'transferForm.explainCard' : obligationKind === 'debt' ? 'transferForm.explainDebt' : 'transferForm.explainTransfer')}
      </AppText>
      {/* 25Q4: an amount over the cap is said while it is typed: shown, not spoken (VoiceOver hears what Save refused), as the
        devolución form does. Save stays enabled and refuses it with the same sentence, one Error tap and the announcement. */}
      <ErrorMessage message={error ?? (!pending && parsed !== null && overCap(parsed) ? overKey : null)} announce={error !== null} />
      {pending && error && <AppText secondary variant="footnote">{t('transferForm.retryNote')}</AppText>}
      <ActionButton label={submit.text} spokenLabel={submit.spoken} busy={busy} disabled={!amount.trim() || !from || !to || from.id === to.id || from.currency !== to.currency || !fit.ok} onPress={save} />
    </>}
  </Screen>;
}
