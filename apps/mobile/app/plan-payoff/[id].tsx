import { useRef, useState } from 'react';
import { View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { randomUUID } from 'expo-crypto';
import { cardDebtMinor, todayKey, type PayoffFinancing, type PlanPayoff } from '@finanzapp/domain';
import { useLedger } from '../../src/storage/LedgerProvider';
import { ActionButton, AppText, CheckRow, DetailRow, EmptyState, ErrorMessage, GlyphTile, IconButton, LifecycleNote, MerchantBadge, Money, Screen, SectionTitle,
  Surface } from '../../src/ui/components';
import { DateField } from '../../src/ui/form-controls';
import { isPlanWriteRefusal, payoffFigures, payoffPreview, planOperationDate } from '../../src/ui/installment-presentation';
import { numberRanges } from '../../src/ui/operation-presentation';
import { successHaptic } from '../../src/ui/motion';
import { withCurrencyCode } from '../../src/i18n/format';
import { useI18n } from '../../src/i18n/provider';
import { space, useCurrentDay } from '../../src/ui/theme';

/** Producto 24T3: «Registrar adelanto de cuotas», the reviewed sheet over one plan (a modal, registered in `_layout`). An
 * adelanto records that the remaining instalments were brought forward: every share still to come is recognised once, on
 * the adelanto's date, in the card's outstanding balance (owner decision B1); the payment to the card is a separate
 * transfer, never inferred, and nothing is ever «pagada». The sheet shows, before Save, exactly what Save sends
 * (`payoffPreview`, A13): per component what is brought forward, the future financing with an explicit choice and no
 * default (A18: «Los registro ahora» or «El emisor no los cobró»), the date (between the plan's floor and today, A6), the
 * sentence that says what is recorded and what is not, and the undone instalments it leaves pending. Save echoes the
 * amount it records. The submission is frozen once sent (one form id): a write with an unknown outcome is retried
 * unchanged; a refusal storage gave before writing anything releases it and the sheet previews again (A13). Recorded, the
 * sheet offers «Pagar tarjeta» prefilled with the card's outstanding balance (A29). */
export default function PlanPayoffScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { archive, snapshot, addPayoff } = useLedger();
  const day = useCurrentDay();
  const { t, formatDate, moneyText, spokenMoney, errorText } = useI18n();
  const [operation] = useState(() => ({ id: randomUUID(), createdAt: new Date().toISOString() }));
  const [financing, setFinancing] = useState<PayoffFinancing | null>(null);
  const [date, setDate] = useState(() => new Date(day + 'T12:00:00'));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PlanPayoff | null>(null);
  // The adelanto storage recorded: the sheet then shows what comes next instead of the form.
  const [done, setDone] = useState<PlanPayoff | null>(null);
  const saving = useRef(false);
  const close = () => { if (!saving.current) { if (router.canGoBack()) router.back(); else router.replace('/cards'); } };
  const header = (title: string) => <Stack.Screen options={{ title, gestureEnabled: !busy,
    headerLeft: () => <IconButton name="close" label={t('common.close')} onPress={close} disabled={busy} /> }} />;

  const plan = archive?.installmentPlans?.find(item => item.id === id);
  const card = archive?.cards?.find(item => item.id === plan?.cardId);
  const account = snapshot?.accounts.find(item => item.id === card?.accountId);
  if (!archive || !snapshot || !plan || !card || !account) return <Screen>
    {header(t('operations.titles.payoff'))}
    <EmptyState title={t('installments.detail.notFoundTitle')} detail={t('installments.detail.notFoundDetail')} icon="card-outline" />
  </Screen>;
  // An adelanto sent with an unknown outcome that the ledger now holds (it committed; a later read brought it): recorded.
  if (pending && !done && (archive.purchaseOperations ?? []).some(item => item.id === pending.id && !item.voided)) {
    setDone(pending);
    setPending(null);
    setError(null);
  }
  const currency = plan.currency;
  const money = (minor: number) => moneyText(minor, currency);
  const spoken = (minor: number) => spokenMoney(minor, currency);

  if (done) {
    // A29: the card owes the instalments now; its payment is the ordinary «Pagar tarjeta» transfer, capped at the balance.
    const debtMinor = cardDebtMinor(card, snapshot);
    const pay = !card.deleted && debtMinor > 0;
    return <Screen gap={space.xl}>
      {header(t('operations.titles.payoff'))}
      <View style={{ gap: 12, alignItems: 'center', paddingTop: 8 }}>
        <GlyphTile icon="checkmark-done-circle-outline" large />
        <AppText variant="headline" accessibilityRole="header" style={{ textAlign: 'center' }}>{t('installments.payoff.doneTitle')}</AppText>
        <AppText secondary variant="subhead" style={{ textAlign: 'center' }}>{t('installments.payoff.doneDetail', { card: account.name })}</AppText>
      </View>
      <View style={{ gap: space.m }}>
        {pay && <ActionButton label={t('cards.panel.pay')} icon="arrow-forward-outline"
          onPress={() => router.replace({ pathname: '/new-transfer', params: { toAccountId: account.id, maxAmountMinor: String(debtMinor) } })} />}
        <ActionButton secondary={pay} label={t('common.done')} onPress={close} />
      </View>
    </Screen>;
  }

  // The day the sheet shows and sends: the one chosen, kept between the plan's floor and today as they are now (A6).
  const bounds = planOperationDate(archive, plan.id, todayKey(date), day);
  const dateISO = bounds.dateISO;
  const result = payoffPreview(archive, plan.id, { id: operation.id, createdAt: operation.createdAt, financing, dateISO, todayISO: day });
  if (!result.ok && !pending) return <Screen>
    {header(t('operations.titles.payoff'))}
    <EmptyState title={t('installments.payoff.unavailableTitle')} detail={errorText(result.message)} icon="calendar-outline" />
  </Screen>;
  const preview = result.ok ? result.preview : null;
  // What the sheet shows and Save records: the frozen submission once sent (a retry resends exactly it), else the preview.
  const shown = pending ? payoffFigures(pending) : preview!;
  const locked = busy || pending !== null;
  const chosen = pending ? pending.financing : financing;
  // The principal always; the future financing only once the person says it is recorded (never assumed before the choice).
  const recordedMinor = shown.principalMinor + (chosen === 'recognised' ? shown.financingMinor : 0);
  const shownDateISO = pending?.dateISO ?? dateISO;
  const financed = plan.interestMinor + plan.feeMinor + plan.taxMinor > 0;
  const label = { principal: financed ? 'installments.payoff.principal' : 'installments.payoff.amount', interest: 'installments.payoff.interest',
    fee: 'installments.payoff.fee', tax: 'installments.payoff.tax' } as const;
  const sentence = (format: (minor: number) => string, dateText: string) => t('installments.payoff.sentence', { date: dateText, amount: format(recordedMinor) });

  async function save() {
    if (saving.current) return;
    const submission = pending ?? (preview && !preview.choiceNeeded ? preview.payoff : null);
    if (!submission) return;
    saving.current = true;
    setBusy(true);
    setError(null);
    setPending(submission);
    try {
      await addPayoff(submission);
      successHaptic();
      setPending(null);
      setDone(submission);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'installments.payoff.saveFailed';
      setError(message);
      // Refused before anything was written (the instalments changed since the preview, a statement closed, the plan
      // stopped…): released, so the sheet previews the plan as it is now and Save builds the adelanto again (same id).
      if (isPlanWriteRefusal(message)) setPending(null);
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  const saveWord = t('installments.payoff.save');
  const ready = !!pending || (!!preview && !preview.choiceNeeded);
  const submit = pending && error ? { text: t('common.retrySave') } : ready && recordedMinor > 0
    ? { text: saveWord + ' · ' + money(recordedMinor), spoken: saveWord + ', ' + spoken(recordedMinor) } : { text: saveWord };
  const floor = bounds.floorISO ? new Date(bounds.floorISO + 'T12:00:00') : undefined;

  return <Screen gap={space.l}>
    {header(t('operations.titles.payoff'))}
    <View style={{ gap: 12, alignItems: 'center', paddingTop: 8 }}>
      <MerchantBadge merchant={plan.merchant} category={plan.category} large />
      <AppText secondary variant="footnote" style={{ fontWeight: '500', textAlign: 'center' }}>{withCurrencyCode(t('installments.payoff.eyebrow'), currency)}</AppText>
      <Money minor={recordedMinor} currency={currency} large size={40} align="center" />
      <AppText secondary variant="subhead" style={{ textAlign: 'center' }}>{plan.merchant}</AppText>
    </View>
    <View>
      <SectionTitle>{t('installments.payoff.covered')}</SectionTitle>
      <Surface grouped>
        <DetailRow label={t('installments.payoff.numbers', { count: shown.numbers.length })} value={numberRanges(shown.numbers)} />
        {shown.components.map((item, index) => <DetailRow key={item.component} label={t(label[item.component])} value={money(item.minor)} spokenValue={spoken(item.minor)}
          last={index === shown.components.length - 1} />)}
      </Surface>
    </View>
    {shown.financingMinor > 0 && <View>
      {/* A18: two rows, no default: the person says whether the issuer charged the future financing. */}
      <SectionTitle caption={t('installments.payoff.financingCaption')}>{t('installments.payoff.financingTitle')}</SectionTitle>
      <Surface grouped>
        <CheckRow title={t('installments.payoff.recognise')} subtitle={t('installments.payoff.recogniseDetail')} selected={chosen === 'recognised'} disabled={locked}
          onPress={() => { setFinancing('recognised'); setError(null); }} />
        <CheckRow title={t('installments.payoff.waive')} subtitle={t('installments.payoff.waiveDetail')} selected={chosen === 'waived'} disabled={locked}
          onPress={() => { setFinancing('waived'); setError(null); }} last />
      </Surface>
    </View>}
    <Surface grouped>
      <DateField label={t('installments.payoff.date')} value={new Date(shownDateISO + 'T12:00:00')} onChange={next => { setDate(next); setError(null); }} disabled={locked}
        minimumDate={floor} maximumDate={new Date(day + 'T12:00:00')} />
    </Surface>
    {preview && preview.undoneNumbers.length > 0 && <LifecycleNote icon="arrow-undo-circle-outline" tone="warning"
      detail={t('installments.payoff.undone', { count: preview.undoneNumbers.length, numbers: numberRanges(preview.undoneNumbers) })} />}
    <AppText secondary variant="footnote" accessibilityLabel={sentence(spoken, formatDate(shownDateISO, 'long'))}>{sentence(money, formatDate(shownDateISO, 'dayYear'))}</AppText>
    <ErrorMessage message={error} />
    {pending && !busy && error && <AppText secondary variant="footnote">{t('installments.payoff.retryNote')}</AppText>}
    <ActionButton label={submit.text} spokenLabel={submit.spoken} onPress={save} busy={busy} disabled={!ready} />
  </Screen>;
}
