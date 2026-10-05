import { useRef, useState } from 'react';
import { Keyboard, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { accountKind, editedDraftFits, minorFromEditedDraft, todayKey, type ReviewArchive, type ReviewKind, type ReviewPurchase, type StatementPlacement } from '@finanzapp/domain';
import { useLedger } from '../../src/storage/LedgerProvider';
import type { ReviewItem } from '../../src/storage/review-database';
import { ActionButton, AmountField, AppText, Choices, EmptyState, ErrorMessage, Field, IconButton, Screen, Surface } from '../../src/ui/components';
import { AccountField, CategoryField, DateField } from '../../src/ui/form-controls';
import { QUICK_COUNTS, type CountChoice } from '../../src/ui/purchase-plan';
import { parseInstallmentCount, placementOptions } from '../../src/ui/installment-presentation';
import { accountKindLabel } from '../../src/ui/liability-presentation';
import { draftFromMinor } from '../../src/ui/money-input';
import { editedReviewDraft, editorDestinations } from '../../src/ui/review-presentation';
import { space } from '../../src/ui/theme';
import { useI18n } from '../../src/i18n/provider';

/** Producto 25A-03, Editar: the proposal's fields in the app's own controls (the account, category and date selectors and
 * the amount field of a movement; the «Pago» choices of a card purchase), saved as the same review item: its id, write id,
 * source and capture are kept, and the revision the editor opened is the one the store must still hold. Nothing is filled
 * in for the person: a kind, a destination, a card's purchase mode and an instalment count stay unchosen until chosen,
 * and the amount is entered in the destination's currency (a producer's currency is never reinterpreted). Saving writes
 * the review file only; the detail then says whether the proposal can be confirmed. */
export default function EditReviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { review } = useLedger();
  const { t } = useI18n();
  const item = review && review !== 'unavailable' && review.writable ? review.items.find(row => row.id === id) : undefined;
  if (!item) return <Screen><EmptyState icon="file-tray-outline" title={t('review.detail.notFoundTitle')} detail={t('review.detail.notFoundDetail')} /></Screen>;
  return <ReviewEditor key={item.id} item={item} />;
}

/** The count segment a stored count shows: one of the quick counts, «Otra» with the number typed, or nothing chosen. */
function countChoiceOf(count: number | null): { choice: CountChoice | null; typed: string } {
  if (count === null) return { choice: null, typed: '' };
  return QUICK_COUNTS.includes(count) ? { choice: `${count}` as CountChoice, typed: '' } : { choice: 'other', typed: String(count) };
}

function ReviewEditor({ item }: { item: ReviewItem }) {
  const { archive, snapshot, updateReview } = useLedger();
  const { t, formatDate } = useI18n();
  // The revision this editor opened: a proposal changed since (another edit, a reconciliation) is refused, never overwritten.
  const [opened] = useState(item);
  const draft = opened.draft;
  const [kind, setKind] = useState<ReviewKind | null>(draft.kind);
  const [destinationId, setDestinationId] = useState<string | null>(draft.destinationId);
  const [merchant, setMerchant] = useState(draft.merchant ?? '');
  const [category, setCategory] = useState(draft.category ?? '');
  const [date, setDate] = useState<Date | null>(draft.dateISO ? new Date(draft.dateISO + 'T12:00:00') : null);
  const [mode, setMode] = useState<ReviewPurchase['mode'] | null>(draft.purchase?.mode ?? null);
  const initialCount = countChoiceOf(draft.purchase?.mode === 'installments' ? draft.purchase.count : null);
  const [countChoice, setCountChoice] = useState<CountChoice | null>(initialCount.choice);
  const [typedCount, setTypedCount] = useState(initialCount.typed);
  const [placement, setPlacement] = useState<StatementPlacement>(draft.purchase?.mode === 'installments' ? draft.purchase.placement : 'current');
  // The proposal's amount, prefilled in its own currency only: an amount without a currency has no scale and starts empty.
  const [stored] = useState(() => draft.amountMinor !== null && draft.currency !== null
    ? { minor: draft.amountMinor, currency: draft.currency, draft: draftFromMinor(draft.amountMinor, draft.currency) } : null);
  const [amount, setAmount] = useState(stored?.draft ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const saving = useRef(false);
  if (!archive) return <Screen>{null}</Screen>;
  const reviewArchive = archive as ReviewArchive;
  const cards = archive.cards ?? [], debts = archive.debts ?? [];

  const destinations = editorDestinations(kind, draft.currency, reviewArchive);
  const destination = archive.accounts.find(account => account.id === destinationId) ?? null;
  const card = destination ? cards.find(row => row.accountId === destination.id && row.active && !row.deleted) ?? null : null;
  // The amount's currency: the proposal's own, else the chosen destination's. Without either, no amount can be entered.
  const currency = draft.currency ?? destination?.currency ?? null;
  const fit = currency && amount.trim() ? editedDraftFits(amount, currency, stored) : { ok: true as const };
  const showsPurchase = !!card && kind !== 'income';
  const typedOrQuick = countChoice === 'other' ? parseInstallmentCount(typedCount) : countChoice === null ? null : Number(countChoice);
  const dateISO = date ? todayKey(date) : null;
  const statements = card && dateISO ? placementOptions(card, archive.cardCycleDates ?? [], dateISO) : null;
  const close = () => { if (!saving.current) { if (router.canGoBack()) router.back(); else router.replace('/review'); } };

  async function save() {
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    setError(null);
    Keyboard.dismiss();
    try {
      const amountMinor = currency && amount.trim() ? minorFromEditedDraft(amount, currency, stored) : null;
      const purchase: ReviewPurchase | null = !showsPurchase || mode === null ? null
        : mode === 'once' ? { mode: 'once' } : { mode: 'installments', count: typedOrQuick, placement };
      const next = editedReviewDraft(draft, {
        kind, amountMinor, currency: amountMinor === null ? draft.currency : currency, merchant, category, dateISO, destinationId, purchase,
      }, reviewArchive);
      await updateReview(opened.id, opened.revision, next);
      saving.current = false;
      close();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'review.unavailable');
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  const header = <Stack.Screen options={{ title: t('nav.titles.editReview'), gestureEnabled: !busy,
    headerLeft: () => <IconButton name="close" label={t('common.close')} onPress={close} disabled={busy} /> }} />;
  const counts = QUICK_COUNTS.map(value => ({ value: `${value}` as CountChoice, label: `${value}` })).concat([{ value: 'other' as CountChoice, label: t('entryForm.plan.countOther') }]);
  return <Screen gap={space.l}>
    {header}
    <Choices<ReviewKind> value={kind} onChange={setKind} disabled={busy}
      options={[{ value: 'expense', label: t('movement.expense') }, { value: 'income', label: t('movement.income') }]} />
    {currency ? <AmountField currency={currency} value={amount} onChangeText={value => { setAmount(value); setError(null); }} editable={!busy}
      stored={stored ?? undefined} tone={kind === 'income' ? 'income' : 'neutral'} label={t('review.fields.amount')} />
      : <AppText secondary variant="footnote">{t('review.edit.amountNeedsDestination')}</AppText>}
    {!fit.ok && <AppText variant="footnote" secondary>{t('review.gaps.amount')}</AppText>}
    <View style={{ gap: space.m }}>
      <View style={{ gap: space.s }}>
        <CategoryField entries={snapshot?.entries ?? []} kind={kind ?? 'expense'} value={category} onChange={setCategory} disabled={busy} prominent allowCreate={false} />
        <AppText secondary variant="footnote">{t('review.edit.categoryNote')}</AppText>
      </View>
      {destinations.length ? <AccountField label={t('review.fields.destination')} accounts={destinations} value={destinationId ?? ''} disabled={busy} prominent
        onChange={id => {
          // An amount typed for one destination's currency is never carried into another currency's scale: it is cleared.
          const next = archive.accounts.find(row => row.id === id)?.currency;
          if (draft.currency === null && next !== currency) setAmount('');
          setDestinationId(id); setError(null);
        }}
        kindOf={id => { const found = archive.accounts.find(row => row.id === id); return found ? accountKindLabel(found, cards, debts, t) : t('accountKinds.account'); }}
        typeOf={id => accountKind(id, cards, debts)} />
        : <AppText secondary variant="footnote">{t('review.edit.noDestination', { currency: draft.currency ?? '' })}</AppText>}
    </View>
    <Field label={t(kind === 'income' ? 'entryForm.merchantIncome' : 'entryForm.merchantExpense')} value={merchant}
      placeholder={t(kind === 'income' ? 'entryForm.merchantIncomePlaceholder' : 'entryForm.merchantExpensePlaceholder')}
      onChangeText={setMerchant} maxLength={120} autoCapitalize="sentences" editable={!busy} />
    <Surface grouped><DateField value={date} onChange={setDate} disabled={busy} /></Surface>
    {/* «Pago», on an expense paid with an active card only. Nothing is preselected: «Una vez» or «En cuotas» is the
        person's choice, and so is the count (never 12 or any other default). No financing from here. */}
    {showsPurchase && <View style={{ gap: space.m }}>
      <View style={{ gap: space.s }}>
        <AppText secondary variant="footnote" style={{ fontWeight: '500' }}>{t('review.fields.purchase')}</AppText>
        <Choices<ReviewPurchase['mode']> value={mode} onChange={setMode} disabled={busy}
          options={[{ value: 'once', label: t('entryForm.plan.once') }, { value: 'installments', label: t('entryForm.plan.installments') }]} />
      </View>
      {mode === 'installments' && <>
        <View style={{ gap: space.s }}>
          <AppText secondary variant="footnote" style={{ fontWeight: '500' }}>{t('review.edit.countLabel')}</AppText>
          <Choices<CountChoice> compact value={countChoice} onChange={setCountChoice} disabled={busy} options={counts} />
          {countChoice === 'other' && <Field label={t('entryForm.plan.countField')} value={typedCount} placeholder={t('entryForm.plan.countPlaceholder')}
            onChangeText={value => setTypedCount(value.replace(/\D/g, '').slice(0, 3))} keyboardType="number-pad" maxLength={3} editable={!busy} />}
        </View>
        <View style={{ gap: space.s }}>
          <AppText secondary variant="footnote" style={{ fontWeight: '500' }}>{t('review.edit.placement')}</AppText>
          <Choices<StatementPlacement> compact value={placement} onChange={setPlacement} disabled={busy}
            options={(['current', 'next'] as const).map(value => statements
              ? { value, label: formatDate(statements[value].closingISO, 'day'), spokenLabel: t('entryForm.plan.statement', { closing: formatDate(statements[value].closingISO, 'long'), due: formatDate(statements[value].dueISO, 'long') }) }
              : { value, label: t(value === 'current' ? 'review.edit.placementCurrent' : 'review.edit.placementNext') })} />
        </View>
        <AppText secondary variant="footnote">{t('review.edit.noInterest')}</AppText>
      </>}
    </View>}
    <ErrorMessage message={error} />
    <ActionButton label={t('common.saveChanges')} onPress={save} busy={busy} disabled={!fit.ok} />
  </Screen>;
}
