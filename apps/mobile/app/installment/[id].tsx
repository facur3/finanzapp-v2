import { useRef, useState } from 'react';
import { Alert, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useLedger } from '../../src/storage/LedgerProvider';
import { ActionButton, AppText, DetailRow, EmptyState, ErrorMessage, LifecycleNote, MerchantBadge, Money, Screen, SectionTitle, Surface, type IconName } from '../../src/ui/components';
import { PlanProgressSummary, ScheduleRow } from '../../src/ui/card-rows';
import { useCategoryLabel } from '../../src/ui/category-hues';
import { isPlanWriteRefusal, planActions, planOperationRows, planScheduleRows, planStateWord, planSummary, scheduleRowOpens, type PlanClosings } from '../../src/ui/installment-presentation';
import { numberRanges } from '../../src/ui/operation-presentation';
import { successHaptic } from '../../src/ui/motion';
import { withCurrencyCode } from '../../src/i18n/format';
import { useI18n } from '../../src/i18n/provider';
import { space, useCurrentDay, usePalette } from '../../src/ui/theme';

/** A purchase in instalments (24T2), read before anything is done with it, like a movement or a recurring rule: the
 * merchant and the price first, then only what the plan stores and what the ledger says of it (never «pagada»: a card
 * payment is not assigned to an instalment), then its calendar, one row per instalment.
 *
 * 24UX6D (Forest): a calm hero (the merchant, «Compra en cuotas · ARS», the price, «12 cuotas sin interés», the state),
 * then the schedule's progress flat on the canvas (`PlanProgressSummary`: a bar, «3 de 12 registradas» by the domain's
 * recognised count, the next instalment and, while the plan is live, the principal still to come), then one grouped list
 * with the purchase and the figures not already in that summary, then the Calendario.
 *
 * 24T3: what can be done with the plan, each action offered only when storage would accept it (`planActions`, the
 * domain's dry runs on the caught-up view), primary first and the destructive last:
 * - a live plan: «Registrar devolución» (the reviewed form `/new-refund`), «Registrar adelanto de cuotas» (the reviewed
 *   sheet `/plan-payoff/[id]`) and «Dejar de seguir el plan» (an alert that says what stops and what it is not), or, for a
 *   plan that recorded nothing yet, «Eliminar plan» instead of the stop (never both);
 * - a plan without tracking («Sin seguimiento», said under the hero): «Registrar devolución» while recorded principal is
 *   still returnable, and «Reactivar plan» (an alert naming the past closings recorded now);
 * - a completed plan: «Registrar devolución» while something is returnable.
 * The figures add what devoluciones returned (to the card, and off future instalments), what an adelanto brought forward
 * and the financing it recorded as not charged, each its own row. «Devoluciones y adelantos» lists every operation of the
 * plan, live or undone, each opening its detail (A26): the only way to a devolución made only of reductions (it has no line
 * in Movimientos) or to one whose instalments a later devolución also lowered. A stop, a reactivation or a deletion asks first and is
 * frozen once sent: Reintentar resends it without asking twice; a refusal storage gave before writing anything releases it
 * (A13) and the screen reads the plan again. */
export default function InstallmentPlanScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { archive, snapshot, removeInstallmentPlan, cancelInstallmentPlan, reactivateInstallmentPlan } = useLedger();
  const p = usePalette();
  const day = useCurrentDay();
  const { t, formatDate, moneyText, spokenMoney } = useI18n();
  const plan = archive?.installmentPlans?.find(item => item.id === id);
  const card = archive?.cards?.find(item => item.id === plan?.cardId);
  const account = snapshot?.accounts.find(item => item.id === card?.accountId);
  const category = useCategoryLabel(plan?.category ?? '', 'expense');
  // A deleted plan opens as not found; the one this screen showed live stays drawn, without its action, while the screen
  // closes after its own deletion. Keyed by id; set during render, React's pattern for information from previous renders.
  const [seenLiveId, setSeenLiveId] = useState<string | null>(null);
  if (plan && !plan.deleted && seenLiveId !== plan.id) setSeenLiveId(plan.id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Frozen after a write whose outcome is unknown: Reintentar sends the same deletion, stop or reactivation again (with the
  // revision the person saw) without asking twice; storage makes it a no-op once committed.
  const [pending, setPending] = useState<{ action: 'delete' | 'stop' | 'reactivate'; revision: number } | null>(null);
  const writing = useRef(false);
  const back = () => { if (router.canGoBack()) router.back(); else router.replace('/cards'); };

  if (!archive || !snapshot || !plan || !card || !account || (plan.deleted && seenLiveId !== plan.id)) return <Screen>
    <EmptyState title={t('installments.detail.notFoundTitle')} detail={t('installments.detail.notFoundDetail')} icon="card-outline" />
  </Screen>;

  // A stop or a reactivation sent with an unknown outcome that the ledger now shows done (it committed; a later read brought
  // it): nothing is left to retry. Set during render, like `seenLiveId`.
  if (pending && pending.action !== 'delete' && plan.revision === pending.revision + 1 && (pending.action === 'stop') === (plan.cancelledAt !== null)) {
    setPending(null);
    setError(null);
  }
  const operations = archive.purchaseOperations ?? [];
  const summary = planSummary(plan, archive.records, operations);
  const rows = planScheduleRows(plan, archive.records, operations);
  const planOperations = planOperationRows(plan.id, operations);
  const actions = planActions(archive, plan.id, day, new Date().toISOString());
  const { figures, status } = summary;
  const planId = plan.id;
  const locked = busy || pending !== null;
  const failure = { delete: 'installments.detail.deleteFailed', stop: 'installments.detail.stopFailed', reactivate: 'installments.detail.reactivateFailed' } as const;
  async function commit(next: { action: 'delete' | 'stop' | 'reactivate'; revision: number }) {
    if (writing.current) return;
    writing.current = true;
    setBusy(true);
    setError(null);
    setPending(next);
    try {
      if (next.action === 'delete') await removeInstallmentPlan(planId);
      else if (next.action === 'stop') await cancelInstallmentPlan(planId, next.revision);
      else await reactivateInstallmentPlan(planId, next.revision);
      setPending(null);
      successHaptic();
      // A deleted plan leaves; a stopped or reactivated one stays, its new state said under the hero.
      if (next.action === 'delete') back();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : failure[next.action];
      setError(message);
      // Refused before anything was written (the plan changed, nothing left to stop…): the screen reads the plan again and
      // the next tap asks again. The deletion keeps its 24T2 rule: frozen until it goes through.
      if (next.action !== 'delete' && isPlanWriteRefusal(message)) setPending(null);
    } finally { writing.current = false; setBusy(false); }
  }
  const money = (minor: number) => moneyText(minor, plan.currency);
  const spoken = (minor: number) => spokenMoney(minor, plan.currency);
  const closingDates = (closings: PlanClosings) => closings.firstClosingISO === closings.lastClosingISO ? formatDate(closings.firstClosingISO, 'dayYear')
    : t('installments.detail.datesRange', { from: formatDate(closings.firstClosingISO, 'dayYear'), to: formatDate(closings.lastClosingISO, 'dayYear') });
  function ask(action: 'delete' | 'stop' | 'reactivate') {
    if (writing.current) return;
    if (pending) { if (pending.action === action) void commit(pending); return; }
    const next = { action, revision: plan!.revision };
    if (action === 'delete') {
      Alert.alert(t('installments.detail.deleteTitle'), t('installments.detail.deleteDetail'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('installments.detail.deleteConfirm'), style: 'destructive', onPress: () => { void commit(next); } },
      ]);
    } else if (action === 'stop') {
      // What stops (every share still to come, after the closings recorded first), what stays, and what it is not.
      const first = actions.stopClosings ? t('installments.detail.stopCatchUp', { count: actions.stopClosings.numbers.length,
        numbers: numberRanges(actions.stopClosings.numbers), amount: money(actions.stopClosings.totalMinor) }) + ' ' : '';
      Alert.alert(t('installments.detail.stopTitle'), first + t('installments.detail.stopDetail', { amount: money(actions.stopMinor) }), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('installments.detail.stopConfirm'), style: 'destructive', onPress: () => { void commit(next); } },
      ]);
    } else {
      const closings = actions.reactivateClosings;
      const detail = t('installments.detail.reactivateDetail') + (closings ? ' ' + t('installments.detail.reactivateCatchUp', { count: closings.numbers.length,
        numbers: numberRanges(closings.numbers), amount: money(closings.totalMinor), dates: closingDates(closings) }) : '');
      Alert.alert(t('installments.detail.reactivateTitle'), detail, [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('installments.detail.reactivateConfirm'), onPress: () => { void commit(next); } },
      ]);
    }
  }

  const word = planStateWord(summary);
  const stopped = status === 'cancelled';
  const state = word === 'deleted' ? null : t(word === 'stopped' ? 'installments.detail.cancelled' : `installments.detail.${word}`);
  // Interest only, or a mix with fees or taxes (an older plan): how the financing rows and each instalment name it.
  const financing = plan.feeMinor + plan.taxMinor > 0 ? 'financing' : 'interest';
  // With financing, the plan's figures are its principal and say so; the financing still to come has its own row.
  const financed = summary.financingMinor > 0;
  const futureFinancingMinor = figures.components.interest.scheduledMinor + figures.components.fee.scheduledMinor + figures.components.tax.scheduledMinor;
  const principalLabel = (plain: 'recorded' | 'future' | 'remaining' | 'undone' | 'settled') => t(financed
    ? ({ recorded: 'installments.detail.recordedPrincipal', future: 'installments.detail.futurePrincipal', remaining: 'installments.detail.remainingPrincipal',
      undone: 'installments.detail.undonePrincipal', settled: 'installments.detail.settledPrincipal' } as const)[plain] : (`installments.detail.${plain}` as const));
  const figure = (key: string, label: string, minor: number) => ({ key, label, value: money(minor), spokenValue: spoken(minor) });
  // Only what the plan and the ledger say; each figure its own row, never merged (decision 003, rule 7). The recognised
  // count (and a live plan's remaining principal) are the progress summary's (24UX6D), so they are not repeated here.
  const facts: { key: string; label: string; value: string; spokenValue?: string; icon?: IconName; onPress?: () => void }[] = [
    { key: 'card', label: t('installments.detail.card'), value: account.name, icon: 'card-outline', onPress: () => router.push({ pathname: '/card/[id]', params: { id: card.id } }) },
    { key: 'category', label: t('selection.category'), value: category, icon: 'pricetag-outline' },
    { key: 'date', label: t('installments.detail.purchaseDate'), value: formatDate(plan.purchaseDateISO, 'dayYear'), spokenValue: formatDate(plan.purchaseDateISO, 'long'), icon: 'calendar-outline' },
    figure('price', t('installments.detail.price'), plan.principalMinor),
    ...(summary.financingMinor > 0 ? [figure('financed', t('installments.detail.totalFinanced'), summary.totalFinancedMinor)] : []),
    ...(plan.interestMinor > 0 ? [figure('interest', t('installments.detail.interest'), plan.interestMinor)] : []),
    ...(plan.feeMinor > 0 ? [figure('fees', t('installments.detail.fees'), plan.feeMinor)] : []),
    ...(plan.taxMinor > 0 ? [figure('taxes', t('installments.detail.taxes'), plan.taxMinor)] : []),
    figure('recorded', principalLabel('recorded'), figures.recognisedMinor),
    // 24T3: the part of what is recorded that an adelanto brought forward, on its own date.
    ...(figures.settledMinor > 0 ? [figure('settled', principalLabel('settled'), figures.settledMinor)] : []),
    ...(stopped ? [figure('cancelled', t('installments.detail.cancelledAmount'), figures.cancelledMinor)] : [figure('future', principalLabel('future'), figures.scheduledMinor)]),
    ...(!stopped && futureFinancingMinor > 0 ? [figure('futureFinancing', t(financing === 'financing' ? 'installments.detail.futureFinancing' : 'installments.detail.futureInterest'),
      futureFinancingMinor)] : []),
    ...(figures.financingWaivedMinor > 0 ? [figure('waived', t(financing === 'financing' ? 'installments.detail.waivedFinancing' : 'installments.detail.waivedInterest'),
      figures.financingWaivedMinor)] : []),
    // 24T3: devoluciones, two figures never merged: the credit that reversed recorded principal, the future instalments lowered.
    ...(figures.refundedCreditMinor > 0 ? [figure('refundCredit', t('installments.detail.refundCredit'), figures.refundedCreditMinor)] : []),
    ...(figures.refundedFutureMinor > 0 ? [figure('refundFuture', t('installments.detail.refundFuture'), figures.refundedFutureMinor)] : []),
    // A live plan's remaining principal is in the progress summary above; a completed or stopped one lists it here.
    ...(status !== 'active' ? [figure('remaining', principalLabel('remaining'), figures.remainingMinor)] : []),
    ...(figures.undoneMinor > 0 ? [figure('undone', principalLabel('undone'), figures.undoneMinor)] : []),
  ];
  const live = !plan.deleted;
  // A write waiting for its retry keeps its button, whatever the plan reads now (storage decides on the retry).
  const offers = { stop: actions.stop || pending?.action === 'stop', reactivate: actions.reactivate || pending?.action === 'reactivate',
    remove: actions.remove || pending?.action === 'delete' };
  const any = live && (actions.refund || actions.payoff || offers.stop || offers.reactivate || offers.remove);
  const label = (action: 'delete' | 'stop' | 'reactivate', text: string) => pending?.action === action && error ? t('common.retryChange') : text;

  return <Screen gap={space.xl}>
    {/* A write in flight holds the screen, as the movement detail does: no native back, no back swipe. */}
    <Stack.Screen options={{ title: plan.merchant, gestureEnabled: !busy, headerBackVisible: !busy }} />
    <View style={{ gap: space.m }}>
      <View style={{ gap: 12, alignItems: 'center', paddingTop: 8 }}>
        <MerchantBadge merchant={plan.merchant} category={plan.category} large />
        <AppText secondary variant="footnote" style={{ fontWeight: '500', textAlign: 'center' }}>{withCurrencyCode(t('installments.detail.eyebrow'), plan.currency)}</AppText>
        <Money minor={plan.principalMinor} currency={plan.currency} large size={40} align="center" />
        <AppText secondary variant="subhead" style={{ textAlign: 'center' }}>
          {t(summary.financingMinor > 0 ? 'installments.detail.withInterest' : 'installments.detail.noInterest', { count: plan.count })}</AppText>
        {state && <AppText accessibilityLiveRegion="polite" variant="subhead" style={{ color: status === 'active' ? p.text : p.secondary, fontWeight: '600', textAlign: 'center' }}>{state}</AppText>}
      </View>
      {/* 24T3: a plan without tracking says what that means right under its hero, calmly (the shape of 24UX6E's notes). */}
      {stopped && <LifecycleNote icon="pause-circle-outline" detail={t('installments.detail.stoppedDetail')} />}
    </View>
    <PlanProgressSummary summary={summary} rows={rows} />
    <Surface grouped>
      {facts.map((fact, index) => <DetailRow key={fact.key} label={fact.label} value={fact.value} spokenValue={fact.spokenValue} icon={fact.icon}
        onPress={fact.onPress} disabled={busy} last={index === facts.length - 1} />)}
    </Surface>
    <View>
      <SectionTitle caption={t('installments.detail.scheduleCaption')}>{t('installments.detail.schedule')}</SectionTitle>
      <Surface grouped>
        {rows.map((row, index) => {
          // A row opens its movement while it has one, else the adelanto or the devolución behind its state (A26).
          const opens = scheduleRowOpens(row);
          const onPress = opens === 'entry' ? () => router.push({ pathname: '/entry/[id]', params: { id: row.entryId! } })
            : opens ? () => router.push({ pathname: '/operation/[id]', params: { id: row.operationId! } }) : undefined;
          return <ScheduleRow key={row.number} row={row} count={plan.count} currency={plan.currency} financing={financing} last={index === rows.length - 1} onPress={onPress} />;
        })}
      </Surface>
    </View>
    {planOperations.length > 0 && <View>
      <SectionTitle>{t('installments.detail.operations')}</SectionTitle>
      <Surface grouped>
        {planOperations.map((operation, index) => {
          const key = operation.kind === 'refund' ? (operation.voided ? 'installments.detail.operationRefundUndone' : 'installments.detail.operationRefund')
            : operation.voided ? 'installments.detail.operationPayoffUndone' : 'installments.detail.operationPayoff';
          return <DetailRow key={operation.id} label={t(key, { date: formatDate(operation.dateISO, 'long') })} layout="inline" value={money(operation.amountMinor)}
            spokenValue={spoken(operation.amountMinor)} icon={operation.kind === 'refund' ? 'arrow-undo-outline' : 'play-forward-circle-outline'} disabled={busy}
            last={index === planOperations.length - 1} onPress={() => router.push({ pathname: '/operation/[id]', params: { id: operation.id } })} />;
        })}
      </Surface>
    </View>}
    {any && <View style={{ gap: space.m }}>
      <ErrorMessage message={error} />
      {actions.refund && <ActionButton secondary icon="return-down-back-outline" label={t('installments.detail.refund')} disabled={locked}
        onPress={() => router.push({ pathname: '/new-refund', params: { planId } })} />}
      {actions.payoff && <ActionButton secondary icon="play-forward-circle-outline" label={t('installments.detail.payoff')} disabled={locked}
        onPress={() => router.push({ pathname: '/plan-payoff/[id]', params: { id: planId } })} />}
      {offers.reactivate && <ActionButton secondary icon="play-circle-outline" label={label('reactivate', t('installments.detail.reactivate'))}
        busy={busy && pending?.action === 'reactivate'} disabled={locked && pending?.action !== 'reactivate'} onPress={() => ask('reactivate')} />}
      {offers.stop && <ActionButton secondary tone="expense" icon="stop-circle-outline" label={label('stop', t('installments.detail.stop'))}
        busy={busy && pending?.action === 'stop'} disabled={locked && pending?.action !== 'stop'} onPress={() => ask('stop')} />}
      {offers.remove && <ActionButton secondary tone="expense" icon="trash-outline" label={label('delete', t('installments.detail.delete'))}
        busy={busy && pending?.action === 'delete'} disabled={locked && pending?.action !== 'delete'} onPress={() => ask('delete')} />}
    </View>}
  </Screen>;
}
