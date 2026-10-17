import { useRef, useState } from 'react';
import { Alert, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { randomUUID } from 'expo-crypto';
import { accountKind, debtOutstandingMinor, makeTransferChange, snapshotFromArchive, type Account, type TransferRecord, type TransferChange } from '@finanzapp/domain';
import { useLedger } from '../../src/storage/LedgerProvider';
import { AccountBadge, ActionButton, AppText, DetailRow, EmptyState, ErrorMessage, GlyphTile, Money, Screen, Surface } from '../../src/ui/components';
import { useI18n } from '../../src/i18n/provider';
import { useAccountNameOf } from '../../src/ui/category-hues';
import { balanceAfterSentence } from '../../src/ui/liability-presentation';
import { errorHaptic, successHaptic, warningHaptic } from '../../src/ui/motion';
import { releasesDraft } from '../../src/ui/presentation';
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
  const { updateTransfer, archive, snapshot } = useLedger();
  const p = usePalette();
  const { t: tr, formatDate, formatMoneyAmount, failureMessage } = useI18n();
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
  const money = (minor: number) => formatMoneyAmount(minor, from.currency) + ' ' + from.currency;
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<TransferChange | null>(null);
  const [error, setError] = useState<string | null>(null);
  const working = useRef(false), confirming = useRef(false);
  // 25R1: the ledger already shows the change sent with an unknown outcome (it committed; a later read brought it): nothing
  // is left to retry. Set during render.
  if (pending && !busy && record.revision === pending.after.revision && record.voided === pending.after.voided) { setPending(null); setError(null); }
  async function apply(change: TransferChange) {
    if (working.current) return;
    working.current = true; setBusy(true); setPending(change); setError(null);
    try {
      await updateTransfer(change); setPending(null);
      successHaptic();
    } catch (cause) {
      setError(failureMessage(cause, 'transferDetail.changeUnverified'));
      // 25Q4: the change stays frozen for «Reintentar cambio» either way (as in TransferForm); a refusal storage decided
      // before writing taps Error, an outcome that may have been written taps Warning.
      if (cause instanceof Error && releasesDraft(cause.message)) errorHaptic(); else warningHaptic();
    }
    finally { working.current = false; setBusy(false); }
  }
  /** 25Q4: a restored debt payment or collection may settle at most what is pending now, the ceiling a new one has (the
   * snapshot already leaves the undone transfer out). Null when nothing caps it: an undo, a card, a plain transfer. */
  function restoreOverrun(): { message: string; link: ReturnType<typeof linkFor> } | null {
    if (!record.voided || !snapshot) return null;
    const debt = debts.find(item => (item.accountId === to.id && item.direction === 'owed_by_me') || (item.accountId === from.id && item.direction === 'owed_to_me'));
    if (!debt) return null;
    let outstanding: number;
    try { outstanding = debtOutstandingMinor(debt, snapshot); } catch { return null; }
    if (t.amountMinor <= outstanding) return null;
    const payment = debt.accountId === to.id;
    return { message: tr(payment ? 'transferDetail.restoreOverPayment' : 'transferDetail.restoreOverCollection', { name: debt.counterparty, amount: money(outstanding) }),
      link: linkFor(payment ? to : from) };
  }
  /** 25Q4: what an undo or a restore changes, in each side's words. With one cash side and one card or debt, cash is added or
   * taken and the obligation says how it will read; two cash accounts, or an older shape between two obligations, keep the
   * plain sentence. Only an undo says where it can be restored. */
  function effect(change: TransferChange): string {
    const restore = record.voided;
    const cash = toKind === 'cash' && fromKind !== 'cash' ? to : fromKind === 'cash' && toKind !== 'cash' ? from : null;
    let lines: (string | null)[];
    if (!cash) lines = [tr('transferDetail.effect', { amount: money(t.amountMinor), from: nameOf(restore ? from : to), to: nameOf(restore ? to : from) })];
    else {
      const obligation = cash.id === to.id ? from : to;
      let after: string | null = null;
      try {
        after = archive ? balanceAfterSentence(obligation, snapshotFromArchive({ ...archive, transfers: (archive.transfers ?? []).map(item => item.transfer.id === t.id ? change.after : item) }),
          cards, debts, money, tr) : null;
      } catch { after = null; }
      // An undone payment gives the cash back; a restored collection brings it in.
      lines = [tr(restore === (cash.id === to.id) ? 'entryDetail.willAdd' : 'entryDetail.willSubtract', { amount: money(t.amountMinor), account: nameOf(cash) }), after];
    }
    return [...lines, tr('transferDetail.recordOnly'), restore ? null : tr('transferDetail.voidRecovery')].filter(Boolean).join(' ');
  }
  function confirm() {
    if (working.current || confirming.current) return;
    if (pending) { void apply(pending); return; }
    confirming.current = true;
    const release = () => { confirming.current = false; };
    // 25Q4: a restore that would overpay is said before any confirmation, with the way to the debt; nothing is built or sent,
    // as with the movement detail's voidRefusal.
    const over = restoreOverrun();
    if (over) {
      const link = over.link;
      Alert.alert(tr('transferDetail.restoreBlockedTitle'), over.message, [
        { text: tr('common.cancel'), style: 'cancel', onPress: release },
        ...(link ? [{ text: tr('transferDetail.viewDebt'), onPress: () => { release(); router.push(link); } }] : []),
      ], { cancelable: true, onDismiss: release });
      return;
    }
    const change = makeTransferChange(randomUUID(), record, record.voided ? 'restore' : 'void', new Date().toISOString());
    Alert.alert(tr(record.voided ? 'transferDetail.restoreQuestion' : 'transferDetail.voidQuestion'), effect(change), [
      { text: tr('common.cancel'), style: 'cancel', onPress: release },
      { text: tr(record.voided ? 'entryDetail.restore' : 'entryDetail.void'), style: 'default', onPress: () => { release(); void apply(change); } }, // reversible: never red
    ], { cancelable: true, onDismiss: release });
  }
  const [year, month, day] = t.dateISO.split('-').map(Number);
  // First letter only (24UX5 review): a style-level capitalize drew «Martes, 22 De Septiembre De 2026».
  const long = formatDate(t.dateISO, 'weekdayLong');
  const date = long.charAt(0).toLocaleUpperCase() + long.slice(1);
  const status = tr(record.voided ? 'transferDetail.statusVoided' : kindId === 'transfer' ? 'transferDetail.statusBetween' : 'transferDetail.statusObligation');
  return <Screen gap={space.xl}>
    <Stack.Screen options={{ title: record.voided ? tr('transferDetail.voidedTitle') : kindTitle, gestureEnabled: !busy, headerBackVisible: !busy }} />
    <View style={{ alignItems: 'center', gap: 14, paddingVertical: 12 }}>
      <GlyphTile icon={toKind === 'card' ? 'card-outline' : toKind === 'debt' || fromKind === 'debt' ? 'people-outline' : 'swap-horizontal-outline'} tone="transfer" large />
      <View style={{ alignItems: 'center', gap: 4, width: '100%' }}>
        <Money minor={t.amountMinor} currency={from.currency} large align="center" tone="transfer" color={record.voided ? p.tertiary : undefined} />
        <AppText variant="title3" style={{ textAlign: 'center' }}>{t.note || kindTitle}</AppText>
        <AppText secondary variant="subhead" style={{ textAlign: 'center' }}>{date}</AppText>
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
        busy={busy} secondary={!record.voided} onPress={confirm} />
    </View>
  </Screen>;
}
