import { useRef, useState } from 'react';
import { Alert, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { randomUUID } from 'expo-crypto';
import * as Haptics from 'expo-haptics';
import { categoryKey, entryRefundSummary, makeEntryChange, recurringOccurrenceOf, summarizeMonthlyBudgets, todayKey, type EntryChange, type EntryRecord, type Account } from '@finanzapp/domain';
import { useLedger } from '../../src/storage/LedgerProvider';
import { budgetTone } from '../../src/ui/budget-presentation';
import { AccountBadge, ActionButton, AppText, DetailRow, EmptyState, ErrorMessage, MerchantBadge, Money, Screen, SectionTitle, Surface } from '../../src/ui/components';
import { presentedAmount } from '../../src/ui/movement-amount';
import { useI18n } from '../../src/i18n/provider';
import { useCategoryLabel } from '../../src/ui/category-hues';
import { installmentOfEntry } from '../../src/ui/installment-presentation';
import { canRefundEntry } from '../../src/ui/operation-presentation';
import { space, usePalette } from '../../src/ui/theme';

export default function EntryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { archive } = useLedger();
  const record = archive?.records.find(item => item.entry.id === id);
  const account = archive?.accounts.find(item => item.id === record?.entry.accountId);
  const { t } = useI18n();
  if (!record || !account) return <Screen><EmptyState title={t('entryDetail.notFoundTitle')}
    detail={t('entryDetail.notFoundDetail')} /></Screen>;
  return <EntryDetail key={id} record={record} account={account} />;
}

/** Wallet-like detail: the amount and merchant first, then only facts FinanzApp
 * actually stores. No bank reference, merchant location or authorization state. */
function EntryDetail({ record, account }: { record: EntryRecord; account: Account }) {
  const { updateEntry, archive, snapshot } = useLedger();
  const p = usePalette();
  const { t, formatDate, currencyName, formatMoneyAmount, spokenMoney, moneyText } = useI18n();
  const { entry } = record;
  const card = archive?.cards?.find(item => item.accountId === account.id);
  // 24T2: a movement an instalment plan recorded (a share of one instalment: its principal, or its interest, fee or tax).
  const instalment = installmentOfEntry(entry.id, archive?.installmentPlans);
  const categoryLabel = useCategoryLabel(entry.category, entry.kind);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<EntryChange | null>(null);
  const saving = useRef(false);
  const confirming = useRef(false);
  // 24T3: the devoluciones of an ordinary purchase (A26): listed here, with what was returned of the price, and the action
  // to record another only when the domain would accept one now (a dry run with what is still returnable).
  const refunds = archive ? entryRefundSummary(archive, entry.id) : null;
  const liveRefunds = refunds ? [...refunds.refunds].sort((a, b) => b.dateISO.localeCompare(a.dateISO) || b.createdAt.localeCompare(a.createdAt)) : [];
  const refundable = !!archive && !record.voided && !pending && canRefundEntry(archive, entry.id, todayKey(), new Date().toISOString());
  async function apply(change: EntryChange) {
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    setError(null);
    setPending(change);
    try {
      await updateEntry(change);
      setPending(null);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'entryDetail.changeUnverified');
    } finally { saving.current = false; setBusy(false); }
  }
  function confirm() {
    if (saving.current || confirming.current) return;
    if (pending) { void apply(pending); return; }
    const restore = record.voided;
    // 24T3 (A26): a purchase with live devoluciones is not undone (storage refuses it). Said before any confirmation, with
    // the way to its devoluciones; nothing is built or sent.
    if (!restore && liveRefunds.length) {
      confirming.current = true;
      const latest = liveRefunds[0];
      Alert.alert(t('operations.entry.blockedTitle'), t('operations.entry.blockedDetail', { count: liveRefunds.length }), [
        { text: t('common.cancel'), style: 'cancel', onPress: () => { confirming.current = false; } },
        { text: t('operations.entry.viewRefunds'), onPress: () => { confirming.current = false; router.push({ pathname: '/operation/[id]', params: { id: latest.id } }); } },
      ], { cancelable: true, onDismiss: () => { confirming.current = false; } });
      return;
    }
    confirming.current = true;
    const change = makeEntryChange(randomUUID(), record, restore ? 'restore' : 'void', new Date().toISOString());
    const adds = restore ? entry.kind === 'income' : entry.kind === 'expense';
    Alert.alert(t(restore ? 'entryDetail.restoreQuestion' : 'entryDetail.voidQuestion'),
      t(adds ? 'entryDetail.willAdd' : 'entryDetail.willSubtract', { amount: formatMoneyAmount(entry.amountMinor, account.currency) + ' ' + account.currency, account: account.name }) + ' '
      + t(restore ? 'entryDetail.restoreEffect' : 'entryDetail.voidEffect')
      // An undone instalment is never recreated by the catch-up and its obligation stays open in the plan (24T1). A share of
      // an instalment that has another (its principal and its interest) is undone alone: the note says so.
      + (instalment && !restore ? ' ' + t(instalment.shared ? 'entryDetail.installmentShareVoidNote' : 'entryDetail.installmentVoidNote') : ''), [
        { text: t('common.cancel'), style: 'cancel', onPress: () => { confirming.current = false; } },
        { text: t(restore ? 'entryDetail.restore' : 'entryDetail.void'), style: restore ? 'default' : 'destructive', onPress: () => { confirming.current = false; void apply(change); } },
      ], { cancelable: true, onDismiss: () => { confirming.current = false; } });
  }
  const income = entry.kind === 'income';
  // First letter only (24UX5 review): a style-level capitalize drew «Martes, 22 De Septiembre De 2026».
  const long = formatDate(entry.dateISO, 'weekdayLong');
  const date = long.charAt(0).toLocaleUpperCase() + long.slice(1);
  // Budget context only when a matching active budget exists for this month, currency and category.
  let budget: { ratio: number; remainingMinor: number; exceeded: boolean } | null = null;
  if (!income && !record.voided && snapshot) {
    try {
      const row = summarizeMonthlyBudgets(snapshot, archive?.budgets ?? [], account.currency, entry.dateISO.slice(0, 7)).rows
        .find(item => categoryKey(item.budget.category) === categoryKey(entry.category));
      if (row) budget = { ratio: row.ratio, remainingMinor: row.remainingMinor, exceeded: row.exceeded };
    } catch { budget = null; }
  }
  // A movement a recurring rule recorded links back to its rule's detail (24UX2, 25B3); a rule deleted since (24UX4:
  // its deletion record stays in storage) leaves a plain movement, unchanged.
  const occurrence = recurringOccurrenceOf(entry.id);
  const rule = occurrence ? archive?.recurring?.find(item => item.id === occurrence.ruleId && !item.deleted) : undefined;
  const status = t(record.voided ? 'entryDetail.statusVoided' : record.revision > 0 ? 'entryDetail.statusCorrected' : 'entryDetail.statusRecorded');
  // The budget row on screen (the region's separators) and for VoiceOver (the amount in the language's words).
  const budgetLine = (row: NonNullable<typeof budget>, money: (minor: number) => string) => row.exceeded ? t('entryDetail.budgetExceeded', { amount: money(-row.remainingMinor) })
    : t('entryDetail.budgetUsed', { percent: Math.round(row.ratio * 100), amount: money(row.remainingMinor) });

  const shown = presentedAmount(entry.kind, entry.amountMinor);
  return <Screen gap={space.xl}>
    <Stack.Screen options={{ title: t(record.voided ? 'entryDetail.voidedTitle' : income ? 'movement.income'
      : instalment ? (instalment.component === 'principal' ? 'entryDetail.installmentTitle' : `entryDetail.installmentShareTitle.${instalment.component}`)
      : card ? 'entryForm.cardPurchaseTitle' : 'movement.expense'),
      gestureEnabled: !busy, headerBackVisible: !busy }} />
    <View style={{ gap: 14, alignItems: 'center', paddingVertical: 12 }}>
      <MerchantBadge merchant={entry.merchant} category={entry.category} kind={entry.kind} large tone={income ? 'income' : 'neutral'} />
      <View style={{ alignItems: 'center', gap: 4, width: '100%' }}>
        {/* 24UX6C: shown as stored, the kind in the title (no minus on an expense, «+» on an income; movement-amount.ts). */}
        <Money minor={shown.minor} currency={account.currency} large signed={shown.signed} align="center"
          tone={shown.tone} color={record.voided ? p.tertiary : undefined} />
        <AppText variant="title3" style={{ textAlign: 'center' }}>{entry.merchant}</AppText>
        <AppText secondary variant="subhead" style={{ textAlign: 'center' }}>{date}</AppText>
      </View>
      <AppText accessibilityLiveRegion="polite" variant="caption" style={{ color: record.voided ? p.warning : p.secondary, fontWeight: '500', textAlign: 'center' }}>{status}</AppText>
    </View>
    <Surface grouped>
      <DetailRow label={t('selection.category')} value={categoryLabel} icon="pricetag-outline" />
      <DetailRow label={t(card ? 'entryDetail.card' : 'selection.account')} value={account.name} icon={card ? 'card-outline' : 'wallet-outline'}
        leading={card ? undefined : <AccountBadge accountId={account.id} size={28} />}
        disabled={busy}
        onPress={() => router.push(card ? { pathname: '/card/[id]', params: { id: card.id } } : { pathname: '/account/[id]', params: { id: account.id } })} />
      {/* 24T2: which instalment of which plan recorded it: "3 de 12" (a financing share says so: "3 de 12 · interés"). */}
      {instalment && <DetailRow label={t('entryDetail.installment')} icon="layers-outline" disabled={busy}
        value={t(instalment.component === 'principal' ? 'entryDetail.installmentOf' : `entryDetail.installmentShare.${instalment.component}`, { number: instalment.number, count: instalment.count })}
        onPress={() => router.push({ pathname: '/installment/[id]', params: { id: instalment.plan.id } })} />}
      {budget && <DetailRow label={t('entryDetail.budget')} icon="speedometer-outline" tone={budgetTone(budget)}
        value={budgetLine(budget, minor => formatMoneyAmount(minor, account.currency))} spokenValue={budgetLine(budget, minor => spokenMoney(minor, account.currency))}
        onPress={() => router.push({ pathname: '/budgets', params: { currency: account.currency, month: entry.dateISO.slice(0, 7) } })} />}
      {rule && <DetailRow label={t('entryDetail.recurring')} value={t(`recurring.frequency.${rule.frequency}`)} icon="repeat-outline" disabled={busy}
        onPress={() => router.push({ pathname: '/recurring/[id]', params: { id: rule.id } })} />}
      <DetailRow label={t('selection.currency')} value={currencyName(account.currency)} last />
    </Surface>
    {/* 24T3: «Devuelto $ X de $ Y», then one row per devolución (newest first), each opening its own detail. */}
    {refunds && liveRefunds.length > 0 && <View>
      <SectionTitle caption={t('operations.entry.refunded', { amount: moneyText(refunds.refundedMinor, account.currency), total: moneyText(entry.amountMinor, account.currency) })}
        captionLabel={t('operations.entry.refunded', { amount: spokenMoney(refunds.refundedMinor, account.currency), total: spokenMoney(entry.amountMinor, account.currency) })}>
        {t('operations.entry.refunds')}
      </SectionTitle>
      <Surface grouped>
        {/* The date written out: the row's label is also what VoiceOver reads first (no abbreviated month). */}
        {liveRefunds.map((refund, index) => <DetailRow key={refund.id} label={formatDate(refund.dateISO, 'long')} layout="inline" value={moneyText(refund.amountMinor, account.currency)}
          spokenValue={spokenMoney(refund.amountMinor, account.currency)} icon="arrow-undo-outline" disabled={busy} last={index === liveRefunds.length - 1}
          onPress={() => router.push({ pathname: '/operation/[id]', params: { id: refund.id } })} />)}
      </Surface>
    </View>}
    <ErrorMessage message={error} />
    <View style={{ gap: 10 }}>
      {!record.voided && <ActionButton label={t('entryDetail.edit')} icon="create-outline" disabled={busy || !!pending}
        onPress={() => router.push({ pathname: '/edit-entry/[id]', params: { id: entry.id } })} />}
      {refundable && <ActionButton label={t('operations.entry.refund')} icon="arrow-undo-outline" secondary disabled={busy}
        onPress={() => router.push({ pathname: '/new-refund', params: { entryId: entry.id } })} />}
      <ActionButton label={pending ? t('common.retryChange') : t(record.voided ? 'entryDetail.restoreAction' : 'entryDetail.voidAction')}
        icon={record.voided ? 'arrow-redo-outline' : 'arrow-undo-outline'} onPress={confirm} busy={busy} secondary={!record.voided} />
    </View>
  </Screen>;
}
