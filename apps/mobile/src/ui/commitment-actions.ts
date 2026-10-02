import { useRef, useState } from 'react';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { assertOpenAccount, cardDebtMinor, cardHasPendingInstallments, closePersonalDebt, debtDeletion, debtOutstandingMinor, deleteRecurringRule, liabilityActivity, pauseRecurringRule, recurringHistory,
  reopenPersonalDebt, resumeRecurringRule, todayKey, type Account, type CreditCardProfile, type PersonalDebtProfile, type RecurringRule } from '@finanzapp/domain';
import { useLedger } from '../storage/LedgerProvider';
import { useI18n } from '../i18n/provider';
import type { SwipeAction } from './swipe-actions';

/** Producto 24UX4: managing commitments from a list row (trailing swipe) and from the detail screen, with one set of
 * rules. Every change is a revision of the stored row, saved before anything confirms it; a failed save keeps the row
 * as it was and says so (`error`, a catalogue key or the thrown message). Deleting asks first and names what stays:
 * the movements, payments and collections already recorded are never touched. `done` runs after a durable save
 * (a detail screen closes itself there). */
export function useRecurringManagement() {
  const { saveRecurring, snapshot, archive } = useLedger();
  const { t } = useI18n();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const writing = useRef(false);

  async function commit(next: RecurringRule, failure: string, feedback: 'selection' | 'success', done?: () => void) {
    if (writing.current) return;
    writing.current = true;
    setBusyId(next.id);
    setError(null);
    try {
      await saveRecurring(next);
      void (feedback === 'success' ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success) : Haptics.selectionAsync()).catch(() => {});
      done?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : failure);
    } finally {
      writing.current = false;
      setBusyId(null);
    }
  }
  const now = () => new Date().toISOString();
  const pause = (rule: RecurringRule, done?: () => void) => commit(pauseRecurringRule(rule, now()), 'recurring.manage.failed', 'selection', done);
  // What fell due while paused is not recorded; a date due today is (see resumeRecurringRule).
  const resume = (rule: RecurringRule, done?: () => void) => commit(resumeRecurringRule(rule, todayKey(), now()), 'recurring.manage.failed', 'selection', done);
  function remove(rule: RecurringRule, done?: () => void) {
    const recorded = recurringHistory(rule, snapshot?.entries ?? []).length;
    Alert.alert(t('recurring.manage.deleteTitle', { merchant: rule.merchant }),
      recorded ? t('recurring.manage.deleteDetail', { count: recorded }) : t('recurring.manage.deleteDetailEmpty'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('recurring.manage.deleteConfirm'), style: 'destructive',
          onPress: () => { void commit(deleteRecurringRule(rule, now()), 'recurring.manage.deleteFailed', 'success', done); } },
      ]);
  }
  /** 25B2: a rule whose account or card was deleted can only be deleted itself; resuming it would post to a closed row.
   * The row's swipe and the rule's detail (25B3) both read it, so they offer the same actions. */
  function closed(rule: RecurringRule): boolean {
    try { assertOpenAccount(rule.accountId, snapshot?.accounts ?? [], archive?.cards, archive?.debts); return false; } catch { return true; }
  }
  /** Pause or resume, then delete (always last, at the far edge). */
  function actions(rule: RecurringRule, done?: () => void): SwipeAction[] {
    const remove_: SwipeAction = { key: 'delete', label: t('recurring.manage.delete'), icon: 'trash', tone: 'destructive', onPress: () => remove(rule, done) };
    if (closed(rule)) return [remove_];
    return [
      rule.active ? { key: 'pause', label: t('recurring.manage.pause'), icon: 'pause', tone: 'neutral', onPress: () => { void pause(rule, done); } }
        : { key: 'resume', label: t('recurring.manage.resume'), icon: 'play', tone: 'accent', onPress: () => { void resume(rule, done); } },
      remove_,
    ];
  }
  return { busyId, error, pause, resume, remove, actions, closed };
}

export function useDebtManagement() {
  const { saveDebt, removeDebt, snapshot } = useLedger();
  const { t, moneyText } = useI18n();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const writing = useRef(false);

  /** `next` is a revision saved as it is; a string is the id of a tracker to delete through its own storage path. */
  async function commit(next: PersonalDebtProfile | string, failure: string, feedback: 'selection' | 'success', done?: () => void) {
    if (writing.current) return;
    writing.current = true;
    setBusyId(typeof next === 'string' ? next : next.id);
    setError(null);
    try {
      await (typeof next === 'string' ? removeDebt(next) : saveDebt(next));
      void (feedback === 'success' ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success) : Haptics.selectionAsync()).catch(() => {});
      done?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : failure);
    } finally {
      writing.current = false;
      setBusyId(null);
    }
  }
  const now = () => new Date().toISOString();
  const accountOf = (debt: PersonalDebtProfile) => snapshot?.accounts.find(item => item.id === debt.accountId);
  const outstandingOf = (debt: PersonalDebtProfile) => snapshot && accountOf(debt) ? debtOutstandingMinor(debt, snapshot) : 0;

  /** «Saldar»: the payment (or collection) of everything outstanding, prefilled in the reviewed transfer form. The person
   * picks the account and confirms there; nothing is marked paid without a recorded transfer. */
  function settle(debt: PersonalDebtProfile) {
    const outstanding = String(outstandingOf(debt));
    router.push({ pathname: '/new-transfer', params: debt.direction === 'owed_by_me'
      ? { toAccountId: debt.accountId, maxAmountMinor: outstanding, amountMinor: outstanding }
      : { fromAccountId: debt.accountId, maxAmountMinor: outstanding, amountMinor: outstanding } });
  }
  /** Closing a settled debt is plain bookkeeping; closing one with a balance left asks first, since it stops showing
   * as pending without recording a payment. */
  function close(debt: PersonalDebtProfile, done?: () => void) {
    const outstanding = outstandingOf(debt), account = accountOf(debt);
    const closed = closePersonalDebt(debt, now());
    if (!outstanding || !account) { void commit(closed, 'debts.manage.failed', 'selection', done); return; }
    Alert.alert(t(debt.direction === 'owed_by_me' ? 'debts.manage.closeTitleOwed' : 'debts.manage.closeTitleReceivable', { name: debt.counterparty }), t('debts.manage.closeDetail', { amount: moneyText(outstanding, account.currency) }), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('debts.manage.closeConfirm'), onPress: () => { void commit(closed, 'debts.manage.failed', 'selection', done); } },
    ]);
  }
  const reopen = (debt: PersonalDebtProfile, done?: () => void) => commit(reopenPersonalDebt(debt, now()), 'debts.manage.failed', 'selection', done);
  /** 25B2 close. Settled: the usual confirmation (the recorded payments stay). A balance with no payment or collection yet
   * (a tracker created by mistake): the confirmation says the balance is not settled and no payment is recorded. A balance
   * with recorded history: not deleted; the dialog names the balance and offers Saldar/Cobrar (the reviewed transfer form)
   * or Cerrar (kept with its balance and history, reopenable). Opening a dialog writes nothing; storage checks the rule again. */
  function remove(debt: PersonalDebtProfile, done?: () => void) {
    const owed = debt.direction === 'owed_by_me', account = accountOf(debt);
    const deletion = snapshot && account ? debtDeletion(debt, snapshot) : { kind: 'settled' as const };
    const name = debt.counterparty;
    if (deletion.kind === 'blocked' && account) {
      const amount = moneyText(deletion.outstandingMinor, account.currency);
      const buttons: Parameters<typeof Alert.alert>[2] = [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t(owed ? 'debts.manage.settle' : 'debts.manage.collect'), onPress: () => settle(debt) },
      ];
      // Closing from here needs no second question: this dialog already says it keeps the balance and records nothing.
      // `done` is the deletion's (a detail goes back); a closed debt stays on screen, as with its own Cerrar button.
      if (debt.active) buttons.push({ text: t('debts.manage.close'), onPress: () => { void commit(closePersonalDebt(debt, now()), 'debts.manage.failed', 'selection'); } });
      Alert.alert(t('debts.manage.blockedTitle'), t(debt.active ? (owed ? 'debts.manage.blockedDetailOwed' : 'debts.manage.blockedDetailReceivable')
        : (owed ? 'debts.manage.blockedDetailClosedOwed' : 'debts.manage.blockedDetailClosedReceivable'), { name, amount }), buttons);
      return;
    }
    const recorded = snapshot ? liabilityActivity(debt.accountId, snapshot).transfers.length : 0;
    const detail = deletion.kind === 'untouched' && account
      ? t(owed ? 'debts.manage.deleteDetailUnpaidOwed' : 'debts.manage.deleteDetailUnpaidReceivable', { amount: moneyText(deletion.outstandingMinor, account.currency) })
      : recorded ? t(owed ? 'debts.manage.deleteDetailPayments' : 'debts.manage.deleteDetailCollections', { count: recorded }) : t('debts.manage.deleteDetailEmpty');
    Alert.alert(t(owed ? 'debts.manage.deleteTitleOwed' : 'debts.manage.deleteTitleReceivable', { name }), detail, [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('debts.manage.deleteConfirm'), style: 'destructive',
        onPress: () => { void commit(debt.id, 'debts.manage.deleteFailed', 'success', done); } },
    ]);
  }
  /** Open with a balance: Saldar. Open and settled: Cerrar. Closed: Reabrir. Then delete, always last. */
  function actions(debt: PersonalDebtProfile, done?: () => void): SwipeAction[] {
    const first: SwipeAction = !debt.active ? { key: 'reopen', label: t('debts.manage.reopen'), icon: 'arrow-undo', tone: 'accent', onPress: () => { void reopen(debt, done); } }
      : outstandingOf(debt) > 0 ? { key: 'settle', label: t('debts.manage.settle'), icon: 'checkmark-done', tone: 'accent', onPress: () => settle(debt) }
        : { key: 'close', label: t('debts.manage.close'), icon: 'checkmark', tone: 'neutral', onPress: () => close(debt, done) };
    return [first, { key: 'delete', label: t('debts.manage.delete'), icon: 'trash', tone: 'destructive', onPress: () => remove(debt, done) }];
  }
  return { busyId, error, settle, close, reopen, remove, actions };
}

/** Producto 25B2: deleting a normal account, from its row (trailing swipe) or from its edit screen, with one rule.
 * The confirmation names what stays (every movement and transfer, with the account's name and currency) and what
 * stops (its active recurring rules); the deletion record is written before anything confirms it, and a failed save
 * keeps the account as it was and says so. A card's or a debt's account is never offered here. */
export function useAccountManagement() {
  const { removeAccount, snapshot, archive } = useLedger();
  const { t } = useI18n();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const writing = useRef(false);

  async function commit(account: Account, done?: () => void) {
    if (writing.current) return;
    writing.current = true;
    setBusyId(account.id);
    setError(null);
    try {
      await removeAccount(account.id);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      done?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'accounts.manage.deleteFailed');
    } finally {
      writing.current = false;
      setBusyId(null);
    }
  }
  /** What deleting would leave and stop, for the confirmation. */
  function consequences(account: Account) {
    const movements = snapshot?.entries.filter(entry => entry.accountId === account.id).length ?? 0;
    const transfers = snapshot?.transfers?.filter(transfer => transfer.fromAccountId === account.id || transfer.toAccountId === account.id).length ?? 0;
    const recurring = archive?.recurring?.filter(rule => rule.accountId === account.id && rule.active && !rule.deleted).length ?? 0;
    return { movements, transfers, recurring };
  }
  function remove(account: Account, done?: () => void) {
    const { movements, transfers, recurring } = consequences(account);
    const detail = (movements || transfers
      ? t('accounts.manage.deleteDetail', { movements: t('accounts.manage.movements', { count: movements }), transfers: t('accounts.manage.transfers', { count: transfers }) })
      : t('accounts.manage.deleteDetailEmpty')) + (recurring ? t('accounts.manage.deleteRecurring', { count: recurring }) : '');
    Alert.alert(t('accounts.manage.deleteTitle', { name: account.name }), detail, [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('accounts.manage.deleteConfirm'), style: 'destructive', onPress: () => { void commit(account, done); } },
    ]);
  }
  /** Delete only: a normal account has no other row action (its edits live on its screen). */
  function actions(account: Account, done?: () => void): SwipeAction[] {
    return [{ key: 'delete', label: t('accounts.manage.delete'), icon: 'trash', tone: 'destructive', onPress: () => remove(account, done) }];
  }
  return { busyId, error, remove, actions, consequences };
}

/** Producto 25B2: deleting a card from its edit screen. The confirmation names the recorded debt, when there is one,
 * and that every purchase and payment stays; the record is written through the same path as an archive. */
/** Producto 25B2: deleting a card from its edit screen. A card with a recorded debt is not deleted: the dialog says so and
 * offers to pay it (the reviewed transfer form, prefilled) or to archive it instead; nothing is cancelled or written
 * silently. Without debt, the confirmation names that every purchase and payment stays, and Eliminar writes the record
 * through `removeCard` (which also stops the card's active rules, in the same commit). */
export function useCardManagement() {
  const { saveCard, removeCard, snapshot, archive: ledger } = useLedger();
  const { t, moneyText } = useI18n();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const writing = useRef(false);

  async function commit(id: string, write: () => Promise<void>, failure: string, done?: () => void) { // i18n-ignore: a type, not copy
    if (writing.current) return;
    writing.current = true;
    setBusyId(id);
    setError(null);
    try {
      await write();
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      done?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : failure);
    } finally {
      writing.current = false;
      setBusyId(null);
    }
  }
  const archive = (card: CreditCardProfile, done?: () => void) =>
    commit(card.id, () => saveCard({ ...card, active: false, revision: card.revision + 1, updatedAt: new Date().toISOString() }), 'cards.form.archiveFailed', done);
  function remove(card: CreditCardProfile, done?: () => void) {
    const account = snapshot?.accounts.find(item => item.id === card.accountId);
    const debt = snapshot && account ? cardDebtMinor(card, snapshot) : 0;
    if (debt > 0 && account) {
      const buttons: Parameters<typeof Alert.alert>[2] = [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('cards.form.blockedPay'), onPress: () => router.push({ pathname: '/new-transfer', params: { toAccountId: account.id, maxAmountMinor: String(debt) } }) },
      ];
      if (card.active) buttons.push({ text: t('cards.form.blockedArchive'), onPress: () => { void archive(card, done); } });
      Alert.alert(t('cards.form.blockedTitle'), t('cards.form.blockedDetail', { amount: moneyText(debt, account.currency) }), buttons);
      return;
    }
    // 24T1: the same rule storage enforces (`assertCardDeletable`): a pending instalment plan is archived with the card, never deleted.
    if (cardHasPendingInstallments(card, ledger?.installmentPlans ?? [], ledger?.records ?? [], ledger?.purchaseOperations ?? [])) {
      const buttons: Parameters<typeof Alert.alert>[2] = [{ text: t('common.cancel'), style: 'cancel' }];
      if (card.active) buttons.push({ text: t('cards.form.blockedArchive'), onPress: () => { void archive(card, done); } });
      Alert.alert(t('cards.form.blockedTitle'), t('cards.form.blockedPlanDetail'), buttons);
      return;
    }
    Alert.alert(t('cards.form.deleteTitle'), t('cards.form.deleteDetail'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('cards.form.deleteConfirm'), style: 'destructive', onPress: () => { void commit(card.id, () => removeCard(card.id), 'cards.form.deleteFailed', done); } },
    ]);
  }
  return { busyId, error, remove };
}
