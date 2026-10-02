import { useRef, useState } from 'react';
import { Keyboard, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { randomUUID } from 'expo-crypto';
import * as Haptics from 'expo-haptics';
import { REFUND_AMOUNT_MESSAGE, isPlanRefund, minorFromEditedDraft, todayKey, type Account, type LedgerArchive } from '@finanzapp/domain';
import { useLedger } from '../src/storage/LedgerProvider';
import { ActionButton, AmountField, AmountShortcut, AppText, DetailRow, EmptyState, ErrorMessage, IconButton, Money, Screen, SectionTitle, Surface } from '../src/ui/components';
import { DateField } from '../src/ui/form-controls';
import { amountFromMinor } from '../src/ui/money-input';
import { previewRefund, refundBounds, type RefundPreview, type RefundTarget } from '../src/ui/operation-presentation';
import { releasesDraft } from '../src/ui/presentation';
import { useAccountNameOf, useCategoryLookOf } from '../src/ui/category-hues';
import { withCurrencyCode } from '../src/i18n/format';
import { useI18n } from '../src/i18n/provider';
import { space, useCurrentDay } from '../src/ui/theme';

type Ready = Extract<RefundPreview, { status: 'ready' }>;

/** Producto 24T3: «Registrar devolución», one modal form for a purchase (`?entryId=`, an ordinary expense) or an instalment
 * plan (`?planId=`, its price only). The purchase is shown as facts on top; the person types what was returned (or fills
 * «Total disponible»), chooses its date between the purchase (a plan: its last recorded instalment) and today, and reads
 * exactly what Save records, computed by the domain on the ledger storage will see (A8, A13). Save echoes the amount and
 * is the confirmation. The operation id is the form's, frozen with the submission: a retry sends the same devolución and
 * never records it twice; a refusal storage decides before writing releases the draft for review (A13). */
export default function NewRefundScreen() {
  const params = useLocalSearchParams<{ entryId?: string; planId?: string }>();
  const target: RefundTarget | null = typeof params.entryId === 'string' && params.entryId ? { entryId: params.entryId }
    : typeof params.planId === 'string' && params.planId ? { planId: params.planId } : null;
  return <RefundForm key={target ? target.entryId ?? target.planId : 'none'} target={target} />;
}

function RefundForm({ target }: { target: RefundTarget | null }) {
  const { archive, addRefund } = useLedger();
  const { t, moneyText, spokenMoney, formatMoneyAmount, spokenMinor, formatDate, formatMonth, errorText } = useI18n();
  const accountName = useAccountNameOf();
  const categoryLook = useCategoryLookOf('expense');
  const [operation] = useState(() => ({ id: randomUUID(), createdAt: new Date().toISOString() }));
  // Every day on this form is a local calendar day at noon (as «Adelantar cuotas»): today's upper bound, the purchase's lower
  // bound and the first value are the same time of day, so a devolución dated today opens with valid bounds at any hour.
  const today = useCurrentDay();
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(() => new Date(today + 'T12:00:00'));
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Ready | null>(null);
  const [error, setError] = useState<string | null>(null);
  const saving = useRef(false);
  const locked = busy || pending !== null;
  const close = () => { if (!saving.current) { if (router.canGoBack()) router.back(); else router.replace('/'); } };
  const header = <Stack.Screen options={{ title: t('operations.refund.title'), gestureEnabled: !busy,
    headerLeft: () => <IconButton name="close" label={t('common.close')} onPress={close} disabled={busy} /> }} />;

  const subject = archive && target ? targetOf(archive, target) : null;
  const bounds = archive && target ? refundBounds(archive, target, today) : null;
  if (!archive || !target || !subject || !bounds) return <Screen>{header}
    <EmptyState title={t('operations.refund.notFoundTitle')} detail={t('operations.refund.notFoundDetail')} icon="arrow-undo-outline" /></Screen>;
  const { account, merchant, priceMinor, purchaseDateISO, plan } = subject;
  const currency = account.currency;
  // A plan, or an ordinary purchase paid with a card: the devolución goes back to the card, and the row says «Tarjeta».
  const onCard = plan || (archive.cards ?? []).some(item => item.accountId === account.id);
  // Nothing to offer: everything returned, or a target the domain refuses whatever the amount (an instalment's movement, a
  // deleted account or card, a stopped plan with nothing recognised). The domain's own reason is shown; no dead form.
  const gate = previewRefund(archive, target, { id: operation.id, amountMinor: bounds.availableMinor, dateISO: today, todayISO: today, createdAt: operation.createdAt });
  if (!pending && (bounds.availableMinor <= 0 || gate.status !== 'ready')) return <Screen>{header}
    <EmptyState title={t(bounds.availableMinor <= 0 ? 'operations.refund.nothingTitle' : 'operations.refund.blockedTitle')} icon="arrow-undo-outline"
      detail={bounds.availableMinor <= 0 ? t(plan ? 'operations.refund.nothingPlan' : 'operations.refund.nothingEntry') : gate.status === 'invalid' ? errorText(gate.message) : ''} /></Screen>;

  let parsed: number | null = null;
  try { parsed = minorFromEditedDraft(amount, currency, null); } catch { parsed = null; }
  const dateISO = todayKey(date);
  const preview: RefundPreview = pending ?? previewRefund(archive, target, { id: operation.id, amountMinor: parsed, dateISO, todayISO: today, createdAt: operation.createdAt });

  async function save() {
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    setError(null);
    Keyboard.dismiss();
    let submission = pending;
    try {
      if (!submission) {
        if (amount.trim() && parsed === null) throw new Error(REFUND_AMOUNT_MESSAGE);
        if (preview.status === 'invalid') throw new Error(preview.message);
        if (preview.status !== 'ready') throw new Error(REFUND_AMOUNT_MESSAGE);
        submission = preview;
        setPending(submission);
      }
      // The submission carries the allocation the person read (A13): storage recomputes it after its catch-up and refuses a
      // different one; a retry with the same id and inputs is a no-op.
      await addRefund(submission.refund);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      saving.current = false;
      close();
    } catch (cause) {
      setError(cause instanceof Error && cause.message ? cause.message : 'operations.refund.saveUnverified');
      if (cause instanceof Error && releasesDraft(cause.message)) setPending(null);
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  // What Save records, said with the region's separators on screen and in the language's spoken form for VoiceOver.
  const sentences = (ready: Ready, money: (minor: number) => string): string[] => {
    const { refund, line } = ready;
    const day = formatDate(refund.dateISO, 'long');
    const month = formatMonth(refund.dateISO.slice(0, 7), 'monthYear');
    const category = line ? categoryLook(line.category).label : '';
    if (!isPlanRefund(refund)) return [t('operations.refund.previewEntry', { amount: money(refund.amountMinor), account: accountName(account), date: day, category, month })];
    const result: string[] = [];
    const planRefund = refund;
    if (planRefund.creditMinor > 0) result.push(t('operations.refund.previewCredit', { amount: money(planRefund.creditMinor), card: accountName(account), date: day, category, month }));
    if (planRefund.reductions.length) {
      const first = planRefund.reductions[0].number, last = planRefund.reductions[planRefund.reductions.length - 1].number;
      const total = planRefund.reductions.reduce((sum, row) => sum + row.minor, 0);
      result.push(first === last ? t('operations.refund.previewTailOne', { from: first, amount: money(total) })
        : t('operations.refund.previewTailMany', { from: first, to: last, amount: money(total) }));
      if (ready.interestOnTail) result.push(t('operations.refund.previewInterest'));
      if (ready.financingStays) result.push(t('operations.refund.previewFinancingStays'));
    }
    return result;
  };
  const shown = preview.status === 'ready' ? sentences(preview, minor => moneyText(minor, currency)) : [];
  const spoken = preview.status === 'ready' ? sentences(preview, minor => spokenMoney(minor, currency)) : [];
  const ready = preview.status === 'ready' ? preview.refund.amountMinor : null;
  const saveWord = t('operations.refund.save');
  const submit = pending && error ? { text: t('common.retrySave') }
    : ready ? { text: saveWord + ' · ' + moneyText(ready, currency), spoken: saveWord + ', ' + spokenMoney(ready, currency) } : { text: saveWord };
  const caption = (number: (minor: number, code: Account['currency']) => string) => t(plan ? 'operations.refund.availablePlanCaption' : 'operations.refund.availableCaption',
    { currency, amount: number(bounds.availableMinor, currency) });
  const minimum = new Date(bounds.minimumISO + 'T12:00:00');
  const maximum = new Date(today + 'T12:00:00');

  return <Screen gap={space.l}>
    {header}
    <View style={{ gap: 6, paddingVertical: 8 }}>
      <AppText secondary variant="footnote" style={{ fontWeight: '500' }}>{withCurrencyCode(t(plan ? 'operations.refund.planPurchase' : 'operations.refund.purchase'), currency)}</AppText>
      <Money minor={priceMinor} currency={currency} large size={40} />
      <AppText variant="title3">{merchant}</AppText>
    </View>
    <Surface grouped>
      <DetailRow label={t(onCard ? 'operations.refund.card' : 'operations.refund.account')} value={accountName(account)} icon={onCard ? 'card-outline' : 'wallet-outline'} />
      <DetailRow label={t('operations.refund.purchaseDate')} value={formatDate(purchaseDateISO, 'dayYear')} spokenValue={formatDate(purchaseDateISO, 'long')}
        icon="calendar-outline" last={bounds.refundedMinor <= 0} />
      {bounds.refundedMinor > 0 && <DetailRow label={t('operations.refund.refunded')} value={moneyText(bounds.refundedMinor, currency)}
        spokenValue={spokenMoney(bounds.refundedMinor, currency)} icon="arrow-undo-outline" last />}
    </Surface>
    <AmountField label={t('operations.refund.amount')} currency={currency} value={amount} editable={!locked}
      onChangeText={value => { setAmount(value); setError(null); }} />
    <AmountShortcut caption={caption(formatMoneyAmount)} spokenCaption={caption(spokenMinor)} label={t('operations.refund.available')} disabled={locked}
      onPress={() => { setAmount(amountFromMinor(bounds.availableMinor, currency)); setError(null); }} />
    <Surface grouped><DateField label={t('operations.refund.date')} value={date} onChange={value => { setDate(value); setError(null); }} disabled={locked}
      minimumDate={minimum} maximumDate={maximum} /></Surface>
    {shown.length > 0 && <View style={{ gap: space.s }}>
      <SectionTitle>{t('operations.refund.previewTitle')}</SectionTitle>
      {shown.map((sentence, index) => <AppText key={index} variant="subhead" accessibilityLabel={spoken[index]}>{sentence}</AppText>)}
    </View>}
    {/* The domain's refusal of the draft, live (over what is left, a date out of range); an amount it cannot read says so too. */}
    <ErrorMessage message={error ?? (!amount.trim() ? null : parsed === null && !pending ? REFUND_AMOUNT_MESSAGE : preview.status === 'invalid' ? preview.message : null)} />
    {pending && !busy && error && <AppText secondary variant="footnote">{t('operations.refund.retryNote')}</AppText>}
    <ActionButton label={submit.text} spokenLabel={submit.spoken} onPress={save} busy={busy} disabled={!pending && preview.status !== 'ready'} />
  </Screen>;
}

/** The purchase a devolución is recorded on: its account (a card's hidden account for a plan), what the hero shows, and
 * the plan when it is one. Null when it is not in this ledger. */
function targetOf(archive: LedgerArchive, target: RefundTarget): { account: Account; merchant: string; priceMinor: number; purchaseDateISO: string; plan: boolean } | null {
  if (target.entryId !== undefined) {
    const record = archive.records.find(item => item.entry.id === target.entryId);
    const account = archive.accounts.find(item => item.id === record?.entry.accountId);
    return record && account ? { account, merchant: record.entry.merchant, priceMinor: record.entry.amountMinor, purchaseDateISO: record.entry.dateISO, plan: false } : null;
  }
  const plan = (archive.installmentPlans ?? []).find(item => item.id === target.planId);
  const card = (archive.cards ?? []).find(item => item.id === plan?.cardId);
  const account = archive.accounts.find(item => item.id === card?.accountId);
  return plan && account && !plan.deleted ? { account, merchant: plan.merchant, priceMinor: plan.principalMinor, purchaseDateISO: plan.purchaseDateISO, plan: true } : null;
}
