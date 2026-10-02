import { useRef, useState } from 'react';
import { Alert } from 'react-native';
import { randomUUID } from 'expo-crypto';
import * as Haptics from 'expo-haptics';
import { entryRefundSummary, isEntryRefund, isPlanPayoff, isPlanRefund, makeOperationChange, todayKey, type EntryRecord, type OperationChange, type PurchaseOperation } from '@finanzapp/domain';
import { useLedger } from '../storage/LedgerProvider';
import { useI18n } from '../i18n/provider';
import { useAccountNameOf, useCategoryLookOf } from './category-hues';
import { checkOperationChange, numberRanges, recordedShares, type OperationCheck } from './operation-presentation';
import { releasesDraft } from './presentation';

/** Producto 24T3: «Deshacer devolución / adelanto» and «Restaurar», shared by the operation's detail and Movimientos
 * deshechos. The action is offered only when the domain's dry run passes (`check`, the same `applyOperationChange` storage
 * runs, with the plan's catch-up); otherwise the screen shows the dry run's reason. The confirmation is a native alert that
 * names the outcome of that dry run: the money that stops (or starts again) counting (a purchase's other live devoluciones
 * stay, so it counts in full again only when the last one is undone), the instalments its catch-up records
 * on their own closings, and that an adelanto undone after one of its instalments is recorded cannot come back (A8).
 * The change is built once, when the person confirms, and kept while its outcome is unknown: «Reintentar cambio» sends
 * exactly it again without asking twice (a refresh that failed after the commit). A refusal storage decides before
 * writing (the dry run passed on a stale view) releases it; the screen then shows the reason the next dry run gives. */
export function useOperationChange() {
  const { archive, voidOperation, restoreOperation } = useLedger();
  const { t, moneyText, formatDate } = useI18n();
  const accountName = useAccountNameOf();
  const categoryLook = useCategoryLookOf('expense');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<{ id: string; message: string } | null>(null);
  const [pending, setPending] = useState<OperationChange | null>(null);
  const writing = useRef(false);
  const confirming = useRef(false);

  const check = (operation: PurchaseOperation): OperationCheck => archive
    ? checkOperationChange(archive, operation, todayKey(), new Date().toISOString()) : { ok: false, reason: '' };

  function outcome(operation: PurchaseOperation, inserts: readonly EntryRecord[]): string {
    const money = (minor: number) => moneyText(minor, operation.currency);
    const restore = operation.voided;
    const account = archive?.accounts.find(item => item.id === operation.accountId);
    const date = formatDate(operation.dateISO, 'long');
    const parts: string[] = [];
    if (isEntryRefund(operation)) {
      const purchase = archive?.records.find(record => record.entry.id === operation.target.entryId);
      // The purchase counts in full again only when this is its last live devolución; otherwise the others stay and only
      // this one's amount counts again.
      const others = !restore && archive ? entryRefundSummary(archive, operation.target.entryId).refunds.filter(refund => refund.id !== operation.id).length : 0;
      const values = { amount: money(operation.amountMinor), account: account ? accountName(account) : '' };
      parts.push(restore ? t('operations.change.restoreEntryRefund', { ...values, date })
        : others ? t('operations.change.voidEntryRefundOthers', { ...values, count: others, category: purchase ? categoryLook(purchase.entry.category).label : '' })
        : t('operations.change.voidEntryRefund', { ...values, category: purchase ? categoryLook(purchase.entry.category).label : '' }));
    } else if (isPlanRefund(operation)) {
      if (restore) parts.push(t('operations.change.restorePlanRefund', { amount: money(operation.amountMinor), date }));
      else {
        if (operation.creditMinor > 0) parts.push(t('operations.change.voidPlanCredit', { amount: money(operation.creditMinor) }));
        if (operation.reductions.length) parts.push(t('operations.change.voidPlanReductions',
          { count: operation.reductions.length, range: numberRanges(operation.reductions.map(row => row.number)) }));
      }
    } else if (isPlanPayoff(operation)) {
      parts.push(restore ? t('operations.change.restorePayoff', { date, amount: money(operation.amountMinor) })
        : t('operations.change.voidPayoff', { amount: money(operation.amountMinor) }));
    }
    if (inserts.length) {
      const shares = recordedShares(inserts);
      parts.push(t('operations.change.recordsShares', { count: shares.numbers.length, range: numberRanges(shares.numbers), amount: money(shares.amountMinor) }));
      if (!restore && isPlanPayoff(operation)) parts.push(t('operations.change.payoffNotRestorable'));
    } else if (!restore) parts.push(t(isPlanPayoff(operation) ? 'operations.change.voidPayoffEffect' : 'operations.change.voidEffect'));
    return parts.join(' ');
  }

  async function apply(change: OperationChange) {
    if (writing.current) return;
    writing.current = true;
    setBusyId(change.after.id);
    setError(null);
    setPending(change);
    try {
      await (change.action === 'void' ? voidOperation(change) : restoreOperation(change));
      setPending(null);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (cause) {
      const message = cause instanceof Error && cause.message ? cause.message : 'operations.change.failed';
      setError({ id: change.after.id, message });
      // Storage refused before writing (the view was stale): nothing to resend; the next dry run says why.
      if (cause instanceof Error && releasesDraft(cause.message)) setPending(null);
    } finally { writing.current = false; setBusyId(null); }
  }

  /** Undo (a live operation) or restore (an undone one), confirmed first; a frozen change is resent as it is. */
  function ask(operation: PurchaseOperation) {
    if (writing.current || confirming.current) return;
    if (pending && pending.after.id === operation.id) { void apply(pending); return; }
    const result = check(operation);
    if (!result.ok) { setError({ id: operation.id, message: result.reason }); return; }
    const restore = operation.voided;
    const payoff = isPlanPayoff(operation);
    const change = makeOperationChange(randomUUID(), operation, restore ? 'restore' : 'void', new Date().toISOString());
    confirming.current = true;
    Alert.alert(t(restore ? (payoff ? 'operations.change.restorePayoffQuestion' : 'operations.change.restoreRefundQuestion')
      : payoff ? 'operations.change.voidPayoffQuestion' : 'operations.change.voidRefundQuestion'), outcome(operation, result.inserts), [
      { text: t('common.cancel'), style: 'cancel', onPress: () => { confirming.current = false; } },
      { text: t(restore ? 'operations.change.restore' : 'operations.change.void'), style: restore ? 'default' : 'destructive',
        onPress: () => { confirming.current = false; void apply(change); } },
    ], { cancelable: true, onDismiss: () => { confirming.current = false; } });
  }

  return { busyId, error, pending, check, ask };
}
