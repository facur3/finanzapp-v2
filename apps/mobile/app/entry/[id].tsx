import { useRef, useState } from 'react';
import { Alert, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { randomUUID } from 'expo-crypto';
import * as Haptics from 'expo-haptics';
import { categoryKey, makeEntryChange, recurringOccurrenceOf, summarizeMonthlyBudgets, type EntryChange, type EntryRecord, type Account } from '@finanzapp/domain';
import { useLedger } from '../../src/storage/LedgerProvider';
import { budgetTone } from '../../src/ui/budget-presentation';
import { AccountBadge, ActionButton, AppText, DetailRow, EmptyState, ErrorMessage, MerchantBadge, Money, Screen, Surface } from '../../src/ui/components';
import { useI18n } from '../../src/i18n/provider';
import { useCategoryLabel } from '../../src/ui/category-hues';
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
  const { t, formatDate, currencyName, formatMoneyAmount, spokenMoney } = useI18n();
  const { entry } = record;
  const card = archive?.cards?.find(item => item.accountId === account.id);
  const categoryLabel = useCategoryLabel(entry.category, entry.kind);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<EntryChange | null>(null);
  const saving = useRef(false);
  const confirming = useRef(false);
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
    confirming.current = true;
    const restore = record.voided;
    const change = makeEntryChange(randomUUID(), record, restore ? 'restore' : 'void', new Date().toISOString());
    const adds = restore ? entry.kind === 'income' : entry.kind === 'expense';
    Alert.alert(t(restore ? 'entryDetail.restoreQuestion' : 'entryDetail.voidQuestion'),
      t(adds ? 'entryDetail.willAdd' : 'entryDetail.willSubtract', { amount: formatMoneyAmount(entry.amountMinor, account.currency) + ' ' + account.currency, account: account.name }) + ' '
      + t(restore ? 'entryDetail.restoreEffect' : 'entryDetail.voidEffect'), [
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
  // A movement a recurring rule recorded links back to its rule (24UX2); a rule deleted since (24UX4: its deletion
  // record stays in storage) leaves a plain movement, unchanged.
  const occurrence = recurringOccurrenceOf(entry.id);
  const rule = occurrence ? archive?.recurring?.find(item => item.id === occurrence.ruleId && !item.deleted) : undefined;
  const status = t(record.voided ? 'entryDetail.statusVoided' : record.revision > 0 ? 'entryDetail.statusCorrected' : 'entryDetail.statusRecorded');
  // The budget row on screen (the region's separators) and for VoiceOver (the amount in the language's words).
  const budgetLine = (row: NonNullable<typeof budget>, money: (minor: number) => string) => row.exceeded ? t('entryDetail.budgetExceeded', { amount: money(-row.remainingMinor) })
    : t('entryDetail.budgetUsed', { percent: Math.round(row.ratio * 100), amount: money(row.remainingMinor) });

  return <Screen gap={space.xl}>
    <Stack.Screen options={{ title: t(record.voided ? 'entryDetail.voidedTitle' : income ? 'movement.income' : card ? 'entryForm.cardPurchaseTitle' : 'movement.expense'), gestureEnabled: !busy, headerBackVisible: !busy }} />
    <View style={{ gap: 14, alignItems: 'center', paddingVertical: 12 }}>
      <MerchantBadge merchant={entry.merchant} category={entry.category} kind={entry.kind} large tone={income ? 'income' : 'neutral'} />
      <View style={{ alignItems: 'center', gap: 4, width: '100%' }}>
        <Money minor={income ? entry.amountMinor : -entry.amountMinor} currency={account.currency} large signed align="center"
          tone={income ? 'income' : 'expense'} color={record.voided ? p.tertiary : undefined} />
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
      {budget && <DetailRow label={t('entryDetail.budget')} icon="speedometer-outline" tone={budgetTone(budget)}
        value={budgetLine(budget, minor => formatMoneyAmount(minor, account.currency))} spokenValue={budgetLine(budget, minor => spokenMoney(minor, account.currency))}
        onPress={() => router.push({ pathname: '/budgets', params: { currency: account.currency, month: entry.dateISO.slice(0, 7) } })} />}
      {rule && <DetailRow label={t('entryDetail.recurring')} value={t(`recurring.frequency.${rule.frequency}`)} icon="repeat-outline" disabled={busy}
        onPress={() => router.push({ pathname: '/edit-recurring/[id]', params: { id: rule.id } })} />}
      <DetailRow label={t('selection.currency')} value={currencyName(account.currency)} last />
    </Surface>
    <ErrorMessage message={error} />
    <View style={{ gap: 10 }}>
      {!record.voided && <ActionButton label={t('entryDetail.edit')} icon="create-outline" disabled={busy || !!pending}
        onPress={() => router.push({ pathname: '/edit-entry/[id]', params: { id: entry.id } })} />}
      <ActionButton label={pending ? t('common.retryChange') : t(record.voided ? 'entryDetail.restoreAction' : 'entryDetail.voidAction')}
        icon={record.voided ? 'arrow-redo-outline' : 'arrow-undo-outline'} onPress={confirm} busy={busy} secondary={!record.voided} />
    </View>
  </Screen>;
}
