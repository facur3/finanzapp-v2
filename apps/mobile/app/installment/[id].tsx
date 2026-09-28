import { useRef, useState } from 'react';
import { Alert, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useLedger } from '../../src/storage/LedgerProvider';
import { ActionButton, AppText, DetailRow, EmptyState, ErrorMessage, MerchantBadge, Money, Screen, SectionTitle, Surface, type IconName } from '../../src/ui/components';
import { ScheduleRow } from '../../src/ui/card-rows';
import { useCategoryLabel } from '../../src/ui/category-hues';
import { planScheduleRows, planSummary } from '../../src/ui/installment-presentation';
import { successHaptic } from '../../src/ui/motion';
import { withCurrencyCode } from '../../src/i18n/format';
import { useI18n } from '../../src/i18n/provider';
import { space, usePalette } from '../../src/ui/theme';

/** A purchase in instalments (24T2), read before anything is done with it, like a movement or a recurring rule: the
 * merchant and the price first, then only what the plan stores and what the ledger says of it (never «pagada»: a card
 * payment is not assigned to an instalment), then its calendar, one row per instalment. The one action here is deleting
 * a plan that recorded nothing yet (created by mistake); cancelling, refunds and early payoff are 24T3. */
export default function InstallmentPlanScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { archive, snapshot, removeInstallmentPlan } = useLedger();
  const p = usePalette();
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
  // Frozen after a failed write: Reintentar sends the same deletion again without asking twice (storage makes it a no-op once committed).
  const [pending, setPending] = useState(false);
  const writing = useRef(false);
  const back = () => { if (router.canGoBack()) router.back(); else router.replace('/cards'); };

  if (!archive || !snapshot || !plan || !card || !account || (plan.deleted && seenLiveId !== plan.id)) return <Screen>
    <EmptyState title={t('installments.detail.notFoundTitle')} detail={t('installments.detail.notFoundDetail')} icon="card-outline" />
  </Screen>;

  const summary = planSummary(plan, archive.records);
  const rows = planScheduleRows(plan, archive.records);
  const { figures, status } = summary;
  const planId = plan.id;
  async function commit() {
    if (writing.current) return;
    writing.current = true;
    setBusy(true);
    setError(null);
    setPending(true);
    try {
      await removeInstallmentPlan(planId);
      setPending(false);
      successHaptic();
      back();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'installments.detail.deleteFailed');
    } finally { writing.current = false; setBusy(false); }
  }
  function remove() {
    if (writing.current) return;
    if (pending) { void commit(); return; }
    Alert.alert(t('installments.detail.deleteTitle'), t('installments.detail.deleteDetail'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('installments.detail.deleteConfirm'), style: 'destructive', onPress: () => { void commit(); } },
    ]);
  }

  const money = (minor: number) => moneyText(minor, plan.currency);
  const spoken = (minor: number) => spokenMoney(minor, plan.currency);
  const stopped = status === 'cancelled';
  const state = status === 'active' ? t('installments.detail.active') : status === 'completed' ? t('installments.detail.completed')
    : stopped ? t('installments.detail.cancelled') : null;
  // Only what the plan and the ledger say; each figure its own row, never merged (decision 003, rule 7).
  const facts: { key: string; label: string; value: string; spokenValue?: string; icon?: IconName; onPress?: () => void }[] = [
    { key: 'card', label: t('installments.detail.card'), value: account.name, icon: 'card-outline', onPress: () => router.push({ pathname: '/card/[id]', params: { id: card.id } }) },
    { key: 'category', label: t('selection.category'), value: category, icon: 'pricetag-outline' },
    { key: 'date', label: t('installments.detail.purchaseDate'), value: formatDate(plan.purchaseDateISO, 'dayYear'), spokenValue: formatDate(plan.purchaseDateISO, 'long'), icon: 'calendar-outline' },
    { key: 'price', label: t('installments.detail.price'), value: money(plan.principalMinor), spokenValue: spoken(plan.principalMinor) },
    ...(summary.financingMinor > 0 ? [{ key: 'financed', label: t('installments.detail.totalFinanced'), value: money(summary.totalFinancedMinor), spokenValue: spoken(summary.totalFinancedMinor) }] : []),
    ...(plan.interestMinor > 0 ? [{ key: 'interest', label: t('installments.detail.interest'), value: money(plan.interestMinor), spokenValue: spoken(plan.interestMinor) }] : []),
    ...(plan.feeMinor > 0 ? [{ key: 'fees', label: t('installments.detail.fees'), value: money(plan.feeMinor), spokenValue: spoken(plan.feeMinor) }] : []),
    ...(plan.taxMinor > 0 ? [{ key: 'taxes', label: t('installments.detail.taxes'), value: money(plan.taxMinor), spokenValue: spoken(plan.taxMinor) }] : []),
    { key: 'count', label: t('installments.detail.recordedCount'), value: t('installments.detail.recordedCountValue', { count: figures.recognisedCount, total: plan.count }) },
    { key: 'recorded', label: t('installments.detail.recorded'), value: money(figures.recognisedMinor), spokenValue: spoken(figures.recognisedMinor) },
    ...(stopped ? [{ key: 'cancelled', label: t('installments.detail.cancelledAmount'), value: money(figures.cancelledMinor), spokenValue: spoken(figures.cancelledMinor) }]
      : [{ key: 'future', label: t('installments.detail.future'), value: money(figures.scheduledMinor), spokenValue: spoken(figures.scheduledMinor) }]),
    { key: 'remaining', label: t('installments.detail.remaining'), value: money(figures.remainingMinor), spokenValue: spoken(figures.remainingMinor) },
    ...(figures.undoneMinor > 0 ? [{ key: 'undone', label: t('installments.detail.undone'), value: money(figures.undoneMinor), spokenValue: spoken(figures.undoneMinor) }] : []),
  ];
  const financing = plan.feeMinor + plan.taxMinor > 0 ? 'financing' : 'interest';

  return <Screen gap={space.xl}>
    {/* A deletion in flight holds the screen, as the movement detail does: no native back, no back swipe. */}
    <Stack.Screen options={{ title: plan.merchant, gestureEnabled: !busy, headerBackVisible: !busy }} />
    <View style={{ gap: 12, alignItems: 'center', paddingTop: 8 }}>
      <MerchantBadge merchant={plan.merchant} category={plan.category} large />
      <AppText secondary variant="footnote" style={{ fontWeight: '500', textAlign: 'center' }}>{withCurrencyCode(t('installments.detail.eyebrow'), plan.currency)}</AppText>
      <Money minor={plan.principalMinor} currency={plan.currency} large size={40} align="center" />
      <AppText secondary variant="subhead" style={{ textAlign: 'center' }}>
        {t(summary.financingMinor > 0 ? 'installments.detail.withInterest' : 'installments.detail.noInterest', { count: plan.count })}</AppText>
      {state && <AppText accessibilityLiveRegion="polite" variant="subhead" style={{ color: status === 'active' ? p.text : p.secondary, fontWeight: '600', textAlign: 'center' }}>{state}</AppText>}
    </View>
    <Surface grouped>
      {facts.map((fact, index) => <DetailRow key={fact.key} label={fact.label} value={fact.value} spokenValue={fact.spokenValue} icon={fact.icon}
        onPress={fact.onPress} disabled={busy} last={index === facts.length - 1} />)}
    </Surface>
    <View>
      <SectionTitle caption={t('installments.detail.scheduleCaption')}>{t('installments.detail.schedule')}</SectionTitle>
      <Surface grouped>
        {rows.map((row, index) => <ScheduleRow key={row.number} row={row} count={plan.count} currency={plan.currency} financing={financing} last={index === rows.length - 1}
          onPress={row.state === 'recognised' || row.state === 'undone' ? () => router.push({ pathname: '/entry/[id]', params: { id: row.entryId } }) : undefined} />)}
      </Surface>
    </View>
    {summary.deletable && <View style={{ gap: space.m }}>
      <ErrorMessage message={error} />
      <ActionButton secondary tone="expense" icon="trash-outline" label={pending ? t('common.retryChange') : t('installments.detail.delete')} busy={busy} onPress={remove} />
    </View>}
  </Screen>;
}
