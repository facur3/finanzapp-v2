import { useMemo, useRef, useState } from 'react';
import { Alert, Keyboard, View } from 'react-native';
import { router, Stack } from 'expo-router';
import { randomUUID } from 'expo-crypto';
import * as Haptics from 'expo-haptics';
import { addDaysISO, cardCycleDatesOf, cardCycleView, draftFitsCurrency, editedDraftFits, minorFromEditedDraft, minorFromLedgerDraft, newCardCycle, planCardCycle,
  sameCreditCardProfile, todayKey, validateAccount, validateCreditCardProfile, type StoredDraft, type Account, type CardCycleDates, type CardCycleDays,
  type CardCycleIntent, type CreditCardProfile, type Currency, LEDGER_CURRENCIES } from '@finanzapp/domain';
import { useI18n } from '../i18n/provider';
import { useLedger } from '../storage/LedgerProvider';
import { ActionButton, AmountField, AppText, DetailRow, ErrorMessage, Field, IconButton, Screen, Surface } from './components';
import { cycleEditResult, daysOfDates } from './card-cycle-form';
import { CurrencySwitch } from './currency-switch';
import { useDefaultCurrency } from './use-default-currency';
import { useCardManagement } from './commitment-actions';
import { offeredCurrencies } from './currencies';
import { DateField } from './form-controls';
import { draftFromMinor } from './money-input';
import { SwitchRow } from './switch-row';
import { space, useCurrentDay } from './theme';

type PendingCreate = { account: Account; card: CreditCardProfile; rows: CardCycleDates[] };
/** 24T2: an edit sends the profile (its usual days included) and the exact dates the person changed, together. */
type PendingEdit = { card: CreditCardProfile; intent: Omit<CardCycleIntent, 'days'> };

/** A day key as a date picker holds it: noon of that local day, never near a midnight a time zone could move. */
const atNoon = (dateISO: string) => new Date(dateISO + 'T12:00:00');
/** The first moment of a local day: a picker's lower bound that still offers that day. */
const atStart = (dateISO: string) => new Date(dateISO + 'T00:00:00');

/** Creates a card with its hidden internal account in one durable commit, or
 * edits the card profile. A submitted command stays frozen across retries.
 *
 * Producto 24T2: the statement dates on a full calendar instead of two day numbers. A new card asks its next closing
 * (today or later) and the due date of that closing; their days become the card's usual days, and `newCardCycle` adds the
 * exact dates when those days alone would not produce them. Both start unchosen: a guessed date that a person confirms
 * without reading their statement would silently misplace every instalment scheduled later. An existing card shows its
 * open statement (and, while one is still to pay, the closed statement's due date, whose closing never moves); a change
 * corrects that statement only, unless «Usar estos días todos los meses» makes its days the usual ones (forced when the
 * closing moved more than half a month: that is a new calendar, not a one-off shift). The save names the statement the
 * form showed and is planned locally first (`planCardCycle`, the same plan storage computes again), so a form left open
 * past a closing, or an impossible date, is refused before anything is sent. */
export function CardForm({ original }: { original?: CreditCardProfile }) {
  const { t, locale, formatDate } = useI18n();
  const { snapshot, archive: ledger, addCard, saveCard, gate = LEDGER_CURRENCIES } = useLedger();
  const today = useCurrentDay();
  // 146 currencies since 24M: ordered and named once per gate and language, not on every keystroke.
  const offered = useMemo(() => offeredCurrencies(gate, locale), [gate, locale]);
  const account = snapshot?.accounts.find(item => item.id === original?.accountId);
  const [before] = useState(original);
  const [identity] = useState(() => ({ id: randomUUID(), accountId: randomUUID(), createdAt: new Date().toISOString() }));
  const [name, setName] = useState(account?.name ?? '');
  const [issuer, setIssuer] = useState(before?.issuer ?? '');
  const [last4, setLast4] = useState(before?.last4 ?? '');
  // 25B2: a new card starts in the currency the one rule proposes (`useDefaultCurrency`); an existing card keeps its account's.
  const suggested = useDefaultCurrency({ accountCurrency: account?.currency });
  const [currency, setCurrency] = useState<Currency>(suggested);
  const [debt, setDebt] = useState('');
  // An untouched limit prefill keeps the stored minor units (a stored amount may exceed the entry bound); an edited text is a new entry.
  const [storedLimit] = useState<StoredDraft | null>(() => before?.creditLimitMinor && account
    ? { minor: before.creditLimitMinor, currency: account.currency, draft: draftFromMinor(before.creditLimitMinor, account.currency) } : null);
  const [limit, setLimit] = useState(storedLimit?.draft ?? '');
  // 24T2: the statement the form opened on, kept as shown: the save names it, so the planner refuses a stale form.
  const [shown] = useState(() => before ? cardCycleView(before, cardCycleDatesOf(before.id, ledger?.cardCycleDates), today) : null);
  const [closing, setClosing] = useState<string | null>(shown?.open.closingISO ?? null);
  const [due, setDue] = useState<string | null>(shown?.open.dueISO ?? null);
  const [toPayDue, setToPayDue] = useState<string | null>(shown?.toPay?.dueISO ?? null);
  const [everyMonth, setEveryMonth] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pendingCreate, setPendingCreate] = useState<PendingCreate | null>(null);
  const [pendingEdit, setPendingEdit] = useState<PendingEdit | null>(null);
  const [pendingArchive, setPendingArchive] = useState<CreditCardProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const saving = useRef(false);
  const locked = busy || !!pendingCreate || !!pendingEdit || !!pendingArchive;
  const manage = useCardManagement();
  // Drafts survive a currency switch untouched; one the new currency cannot hold exactly blocks Save (the field says why).
  const fitsCurrency = draftFitsCurrency(debt, currency).ok && editedDraftFits(limit, currency, storedLimit).ok;
  const close = () => { if (!saving.current) { if (router.canGoBack()) router.back(); else router.replace('/cards'); } };
  // What the dates mean for the card: an edit's result (the usual days after the save, whether they are forced), or a
  // new card's usual days, once both dates are chosen.
  const edit = before && shown && closing && due ? cycleEditResult(before, shown, { closingISO: closing, dueISO: due, toPayDueISO: toPayDue, everyMonth }) : null;
  const days: CardCycleDays | null = edit ? edit.days : !before && closing && due ? daysOfDates(closing, due) : null;
  // A statement of another year carries its year; this year's reads as a short day.
  const shortDate = (dateISO: string) => formatDate(dateISO, dateISO.slice(0, 4) === today.slice(0, 4) ? 'day' : 'dayYear');

  function profileBase(usual: CardCycleDays): Omit<CreditCardProfile, 'revision' | 'updatedAt' | 'active'> {
    return {
      id: before?.id ?? identity.id,
      deleted: before?.deleted ?? false,
      accountId: before?.accountId ?? identity.accountId,
      issuer: issuer.trim(),
      last4: last4.trim(),
      creditLimitMinor: limit.trim() ? minorFromEditedDraft(limit, currency, storedLimit) : null,
      closingDay: usual.closingDay,
      dueDay: usual.dueDay,
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
          if (!edit || !shown) throw new Error('errors.cycles.invalid'); // Both dates are always set on an existing card.
          const candidate: CreditCardProfile = { ...profileBase(edit.days), active: before.active, revision: before.revision, updatedAt: before.updatedAt };
          validateCreditCardProfile(candidate, snapshot.accounts);
          if (sameCreditCardProfile(candidate, before) && !edit.intent.open && !edit.intent.toPay) { saving.current = false; close(); return; }
          const card: CreditCardProfile = { ...candidate, revision: before.revision + 1, updatedAt: new Date().toISOString() };
          validateCreditCardProfile(card, snapshot.accounts);
          // The plan storage computes again in its transaction, run here first: a stale form (the day passed the closing it
          // showed, or its dates changed elsewhere) or an impossible date is refused with its catalogued sentence, unsent.
          planCardCycle({ cardId: card.id, days: { closingDay: before.closingDay, dueDay: before.dueDay }, rows: cardCycleDatesOf(card.id, ledger?.cardCycleDates),
            todayISO: today, nowISO: card.updatedAt, intent: { ...edit.intent, days: edit.days } });
          submission = { card, intent: edit.intent };
          setPendingEdit(submission);
        }
        await saveCard(submission.card, submission.intent);
      } else {
        let submission = pendingCreate;
        if (!submission) {
          if (!closing || !due) throw new Error('errors.cycles.invalid'); // Save waits for both dates.
          const openingDebt = debt.trim() ? minorFromLedgerDraft(debt, currency) : 0;
          if (openingDebt < 0) throw new Error('cards.form.negativeDebt');
          // The next closing (today or later) and its due: the usual days, and the exact rows when those days cannot produce them.
          const cycle = newCardCycle({ cardId: identity.id, closingISO: closing, dueISO: due, todayISO: today, nowISO: identity.createdAt });
          const card: CreditCardProfile = { ...profileBase(cycle.days), active: true, revision: 0, updatedAt: identity.createdAt };
          const newAccount: Account = { id: identity.accountId, name: name.trim(), currency, openingMinor: -openingDebt, createdAt: identity.createdAt };
          validateAccount(newAccount);
          validateCreditCardProfile(card, [...snapshot.accounts, newAccount]);
          submission = { account: newAccount, card, rows: cycle.rows };
          setPendingCreate(submission);
        }
        await addCard(submission.account, submission.card, submission.rows);
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

  const pick = (set: (dateISO: string) => void) => (value: Date) => { set(todayKey(value)); setError(null); };
  return <Screen>
    <Stack.Screen options={{ title: t(before ? 'nav.titles.editCard' : 'nav.titles.newCard'), gestureEnabled: !busy,
      headerLeft: () => <IconButton name="close" label={t('common.close')} onPress={close} disabled={busy} /> }} />

    {before && account ? <Surface grouped>
      <DetailRow label={t('cards.form.card')} value={account.name} icon="card-outline" onPress={() => router.push({ pathname: '/edit-account/[id]', params: { id: account.id } })} />
      <DetailRow label={t('cards.form.currency')} value={account.currency} last />
    </Surface> : <>
      <Field label={t('cards.form.name')} value={name} onChangeText={setName}
        placeholder={t('cards.form.namePlaceholder')} maxLength={80} autoCapitalize="words" editable={!locked} />
      <CurrencySwitch value={currency} currencies={offered} onChange={setCurrency} disabled={locked} />
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

    <AmountField label={t('cards.form.limit')} currency={currency} value={limit} stored={storedLimit ?? undefined}
      onChangeText={value => { setLimit(value); setError(null); }} editable={!locked} />

    {/* 24T2: the statement still to pay first (its due is the next one), then the open statement: two separate facts. */}
    {shown?.toPay && <Surface grouped>
      <DateField label={t('cards.form.toPayDue', { date: shortDate(shown.toPay.closingISO) })} value={toPayDue ? atNoon(toPayDue) : null}
        onChange={pick(setToPayDue)} disabled={locked} allowFuture minimumDate={atStart(addDaysISO(shown.toPay.closingISO, 1))} />
    </Surface>}
    <View style={{ gap: space.s }}>
      <Surface grouped>
        <DateField label={t('cards.form.nextClosing')} value={closing ? atNoon(closing) : null} onChange={pick(setClosing)} disabled={locked} allowFuture last={false}
          minimumDate={atStart(shown ? addDaysISO(shown.previous.closingISO, 1) : today)} />
        <DateField label={t('cards.form.due')} value={due ? atNoon(due) : null} onChange={pick(setDue)} disabled={locked} allowFuture last={!edit}
          minimumDate={atStart(addDaysISO(closing ?? today, 1))} />
        {edit && <SwitchRow label={t('cards.form.everyMonth')} value={edit.repeats} onValueChange={value => { setEveryMonth(value); setError(null); }}
          disabled={locked || edit.forced} detail={edit.forced ? t('cards.form.calendarChange') : undefined} last />}
      </Surface>
      <AppText secondary variant="footnote">
        {days ? t('cards.form.datesNote') + ' ' + t('cards.form.usualDays', { closing: days.closingDay, due: days.dueDay }) : t('cards.form.datesNote')}
      </AppText>
    </View>

    <ErrorMessage message={error} />
    {(pendingCreate || pendingEdit) && error && <AppText secondary variant="footnote">
      {t('cards.form.frozenNote')}
    </AppText>}
    <ActionButton label={error && (pendingCreate || pendingEdit) ? t('common.retrySave') : before ? t('common.saveChanges') : t('cards.form.create')}
      onPress={save} busy={busy} disabled={(before ? false : !name.trim()) || !closing || !due || !fitsCurrency} />
    {before && <ActionButton label={t(pendingArchive && error ? 'cards.form.retry' : before.active ? 'cards.form.archive' : 'cards.form.reactivate')}
      onPress={archive} secondary disabled={busy || !!pendingEdit} />}
    {/* 25B2: deleting is the last, clearly destructive action; the confirmation names the recorded debt and what stays. */}
    {before && <>
      <ErrorMessage message={manage.error} />
      <ActionButton label={t('cards.form.delete')} icon="trash-outline" secondary tone="expense" disabled={locked || manage.busyId === before.id}
        onPress={() => manage.remove(before, () => { (router as { dismissAll?: () => void }).dismissAll?.(); router.replace('/cards'); })} />
    </>}
  </Screen>;
}
