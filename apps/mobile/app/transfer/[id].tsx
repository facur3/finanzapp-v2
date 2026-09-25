import { useRef, useState } from 'react';
import { Alert, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { randomUUID } from 'expo-crypto';
import * as Haptics from 'expo-haptics';
import { accountKind, makeTransferChange, type Account, type TransferRecord, type TransferChange } from '@finanzapp/domain';
import { useLedger } from '../../src/storage/LedgerProvider';
import { AccountBadge, ActionButton, AppText, DetailRow, EmptyState, ErrorMessage, GlyphTile, Money, Screen, Surface } from '../../src/ui/components';
import { useI18n } from '../../src/i18n/provider';
import { useAccountNameOf } from '../../src/ui/category-hues';
import { space, usePalette } from '../../src/ui/theme';

export default function TransferScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { archive } = useLedger();
  const record = archive?.transfers?.find(r => r.transfer.id === id);
  const { t } = useI18n();
  return record && archive ? <TransferDetail key={id} record={record} accounts={archive.accounts} />
    : <Screen><EmptyState title={t('transferDetail.notFoundTitle')} detail={t('transferDetail.notFoundDetail')} /></Screen>;
}

function TransferDetail({ record, accounts }: { record: TransferRecord; accounts: Account[] }) {
  const { updateTransfer, archive } = useLedger();
  const p = usePalette();
  const { t: tr, formatDate, formatMoneyAmount } = useI18n();
  const nameOf = useAccountNameOf();
  const t = record.transfer;
  const from = accounts.find(a => a.id === t.fromAccountId)!, to = accounts.find(a => a.id === t.toAccountId)!;
  const cards = archive?.cards ?? [], debts = archive?.debts ?? [];
  const toKind = accountKind(to.id, cards, debts), fromKind = accountKind(from.id, cards, debts);
  const kindId = toKind === 'card' ? 'cardPayment' : toKind === 'debt' ? 'debtPayment' : fromKind === 'debt' ? 'collection' : 'transfer';
  const kindTitle = tr(`transferDetail.${kindId}`);
  // A deleted debt tracker (24UX4) keeps naming its side of the payment, but there is no screen to open.
  const linkFor = (account: Account) => {
    const card = cards.find(item => item.accountId === account.id);
    const debt = debts.find(item => item.accountId === account.id);
    if (debt?.deleted) return null;
    return card ? { pathname: '/card/[id]' as const, params: { id: card.id } } : debt ? { pathname: '/debt/[id]' as const, params: { id: debt.id } }
      : { pathname: '/account/[id]' as const, params: { id: account.id } };
  };
  const fromLink = linkFor(from), toLink = linkFor(to);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<TransferChange | null>(null);
  const [error, setError] = useState<string | null>(null);
  const working = useRef(false), confirming = useRef(false);
  async function apply(change: TransferChange) {
    if (working.current) return;
    working.current = true; setBusy(true); setPending(change); setError(null);
    try {
      await updateTransfer(change); setPending(null);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'transferDetail.changeUnverified'); }
    finally { working.current = false; setBusy(false); }
  }
  function confirm() {
    if (working.current || confirming.current) return;
    if (pending) { void apply(pending); return; }
    confirming.current = true;
    const change = makeTransferChange(randomUUID(), record, record.voided ? 'restore' : 'void', new Date().toISOString());
    Alert.alert(tr(record.voided ? 'transferDetail.restoreQuestion' : 'transferDetail.voidQuestion'),
      tr('transferDetail.effect', { amount: formatMoneyAmount(t.amountMinor, from.currency) + ' ' + from.currency,
        from: nameOf(record.voided ? from : to), to: nameOf(record.voided ? to : from) }), [
        { text: tr('common.cancel'), style: 'cancel', onPress: () => { confirming.current = false; } },
        { text: tr(record.voided ? 'entryDetail.restore' : 'entryDetail.void'), style: record.voided ? 'default' : 'destructive', onPress: () => { confirming.current = false; void apply(change); } },
      ], { cancelable: true, onDismiss: () => { confirming.current = false; } });
  }
  const [year, month, day] = t.dateISO.split('-').map(Number);
  const date = formatDate(t.dateISO, 'weekdayLong');
  const status = tr(record.voided ? 'transferDetail.statusVoided' : kindId === 'transfer' ? 'transferDetail.statusBetween' : 'transferDetail.statusObligation');
  return <Screen gap={space.xl}>
    <Stack.Screen options={{ title: record.voided ? tr('transferDetail.voidedTitle') : kindTitle, gestureEnabled: !busy, headerBackVisible: !busy }} />
    <View style={{ alignItems: 'center', gap: 14, paddingVertical: 12 }}>
      <GlyphTile icon={toKind === 'card' ? 'card-outline' : toKind === 'debt' || fromKind === 'debt' ? 'people-outline' : 'swap-horizontal-outline'} tone="transfer" large />
      <View style={{ alignItems: 'center', gap: 4, width: '100%' }}>
        <Money minor={t.amountMinor} currency={from.currency} large align="center" tone="transfer" color={record.voided ? p.tertiary : undefined} />
        <AppText variant="title3" style={{ textAlign: 'center' }}>{t.note || kindTitle}</AppText>
        <AppText secondary variant="subhead" style={{ textAlign: 'center', textTransform: 'capitalize' }}>{date}</AppText>
      </View>
      <AppText accessibilityLiveRegion="polite" variant="caption" style={{ color: record.voided ? p.warning : p.secondary, fontWeight: '500', textAlign: 'center' }}>{status}</AppText>
    </View>
    <Surface grouped>
      <DetailRow label={tr('transferForm.from')} value={nameOf(from)} icon="arrow-up-outline" leading={fromKind === 'cash' ? <AccountBadge accountId={from.id} size={28} /> : undefined} disabled={busy} onPress={fromLink ? () => router.push(fromLink) : undefined} />
      <DetailRow label={tr('transferForm.to')} value={nameOf(to)} icon="arrow-down-outline" leading={toKind === 'cash' ? <AccountBadge accountId={to.id} size={28} /> : undefined} disabled={busy} onPress={toLink ? () => router.push(toLink) : undefined} last={!t.note} />
      {!!t.note && <DetailRow label={tr('transferDetail.note')} value={t.note} last />}
    </Surface>
    <ErrorMessage message={error} />
    <View style={{ gap: 10 }}>
      {!record.voided && <ActionButton label={tr('transferDetail.edit')} icon="create-outline" disabled={busy || !!pending}
        onPress={() => router.push({ pathname: '/edit-transfer/[id]', params: { id: t.id } })} />}
      <ActionButton label={pending ? tr('common.retryChange') : tr(record.voided ? 'transferDetail.restoreAction' : 'transferDetail.voidAction')}
        icon={record.voided ? 'arrow-redo-outline' : 'arrow-undo-outline'} busy={busy} secondary={!record.voided} onPress={confirm} />
    </View>
  </Screen>;
}
