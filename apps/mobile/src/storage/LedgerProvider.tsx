import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { OPERATION_STATE_MESSAGE, PLAN_CALENDAR_MESSAGE, snapshotFromArchive, todayKey, type Account, type Entry, type EntryChange, type LedgerArchive, type LedgerSnapshot,
  type AccountChange, type Transfer, type TransferChange, type RecurringRule, type MonthlyBudget,
  type CreditCardProfile, type PersonalDebtProfile, type AccountAppearance, type CategoryDefinition, type InstallmentPlan,
  type CardCycleDates, type CardCycleIntent, type EntryRefund, type OperationChange, type PlanPayoff, type PlanRefund } from '@finanzapp/domain';
import type { CurrencyGate } from '@finanzapp/domain';
import { currencyGateForBuild } from './currency-gate';
import { changeEntry, createAccount, createEntry, deleteAccount, deleteCreditCard, importArchive, readArchive, changeAccount,
  createTransfer, changeTransfer, saveRecurringRule, processRecurring, saveMonthlyBudget,
  createCreditCard, saveCreditCard, createPersonalDebt, savePersonalDebt, deletePersonalDebt, saveAccountAppearance, saveCategoryDefinition,
  cancelInstallmentPlan, deleteInstallmentPlan, catchUpInstallments, changePurchaseOperation, reactivateInstallmentPlan,
  type LedgerDatabase } from './database';
import { openLedger, refreshLedger, savePurchaseOperation, savePurchasePlan, sessionWarning } from './ledger-session';
import { openLedgerDatabase, openReviewDatabase } from './nativeDatabase';
import { loadReviewTray, openReviewStore, type ReviewCapture, type ReviewDatabase, type ReviewItem, type ReviewStore, type ReviewTray } from './review-database';

declare const __DEV__: boolean | undefined;
/** The creation gate of this build (docs/currency.md §7.5, stage 9): the production ARS/USD, or the preview set in a
 * development bundle started with the flag, read by its literal name so a release bundle inlines the constant. */
export const BUILD_CURRENCY_GATE: CurrencyGate = currencyGateForBuild(process.env.EXPO_PUBLIC_CURRENCY_PREVIEW, typeof __DEV__ !== 'undefined' && __DEV__);

/** A write committed but the view could not be read again: said in the banner, never as a failed write. */
const VIEW_REFRESH_MESSAGE = 'El guardado terminó, pero no pudimos actualizar la vista. Verificá de nuevo antes de registrar otro movimiento; no lo cargues otra vez.';

type LedgerContextValue = {
  /** The currencies a new account, card, debt or budget may take in this build. Reads never consult it. */
  gate: CurrencyGate;
  snapshot: LedgerSnapshot | null;
  archive: LedgerArchive | null;
  error: string | null;
  retry: () => void;
  addAccount: (account: Account, appearance?: AccountAppearance) => Promise<void>;
  addEntry: (entry: Entry) => Promise<void>;
  updateEntry: (change: EntryChange) => Promise<void>;
  updateAccount: (change: AccountChange, appearance?: AccountAppearance) => Promise<void>;
  /** Producto 25B2: the deletion record of a normal account (its movements stay; its active rules stop). */
  removeAccount: (accountId: string) => Promise<void>;
  saveAppearance: (appearance: AccountAppearance) => Promise<void>;
  saveCategory: (definition: CategoryDefinition) => Promise<void>;
  addTransfer: (transfer: Transfer) => Promise<void>;
  updateTransfer: (change: TransferChange) => Promise<void>;
  saveRecurring: (rule: RecurringRule) => Promise<void>;
  saveBudget: (budget: MonthlyBudget) => Promise<void>;
  /** 24T2: with the exact dates of its first statement when the usual days cannot produce them (`newCardCycle`). */
  addCard: (account: Account, card: CreditCardProfile, cycleDates?: readonly CardCycleDates[]) => Promise<void>;
  /** 24T2: the card's own `closingDay`/`dueDay` are its usual days; `cycle` names the exact dates the form asked for.
   * Storage plans the calendar again on today's date, freezing every statement that already closed. */
  saveCard: (card: CreditCardProfile, cycle?: Omit<CardCycleIntent, 'days'>) => Promise<void>;
  /** Producto 25B2: the deletion record of a card (refused with a recorded debt; its active rules stop). */
  removeCard: (cardId: string) => Promise<void>;
  addDebt: (account: Account, debt: PersonalDebtProfile) => Promise<void>;
  saveDebt: (debt: PersonalDebtProfile) => Promise<void>;
  /** 25B2 close: the deletion record of a debt tracker; refused with a balance left and recorded payments or collections. */
  removeDebt: (debtId: string) => Promise<void>;
  /** Producto 24T1: a purchase in instalments (the plan only; its instalments are recognised as their statements close). */
  addInstallmentPlan: (plan: InstallmentPlan) => Promise<void>;
  /** «Dejar de seguir el plan» (24T3: the plan's catch-up through today runs first, in the same commit). `expectedRevision`
   * is the plan's revision the screen showed: a retry of the committed stop is a no-op, another revision is refused. */
  cancelInstallmentPlan: (planId: string, expectedRevision: number) => Promise<void>;
  /** 24T3 «Reactivar plan»: the stop undone; instalments whose statements closed meanwhile are recorded on their own dates. */
  reactivateInstallmentPlan: (planId: string, expectedRevision: number) => Promise<void>;
  /** Only a plan that recorded nothing and has no devolución or adelanto; one with history is stopped. */
  removeInstallmentPlan: (planId: string) => Promise<void>;
  /** 24T3: a devolución as the form previewed it (`newEntryRefund` / `newPlanRefund`, its id frozen in the draft). Storage
   * recomputes the allocation after the plan's catch-up and refuses a different one (`OPERATION_CHANGED_MESSAGE`; the view
   * is read again so the form can preview once more); a retry with the same id and inputs is a no-op. */
  addRefund: (refund: EntryRefund | PlanRefund) => Promise<void>;
  /** 24T3: an adelanto de cuotas as the form previewed it (`newPlanPayoff`), with the same contract as `addRefund`. */
  addPayoff: (payoff: PlanPayoff) => Promise<void>;
  /** 24T3: undo of a devolución or an adelanto (`makeOperationChange(id, operation, 'void', now)`, the change frozen for retries). */
  voidOperation: (change: OperationChange) => Promise<void>;
  /** 24T3: restore of an undone devolución or adelanto (`makeOperationChange(id, operation, 'restore', now)`). */
  restoreOperation: (change: OperationChange) => Promise<void>;
  restoreBackup: (incoming: LedgerArchive, baseline: string) => Promise<void>;
  /** Producto 25A-03, «Para revisar»: the review store's pending items (its own file, 25A-02). `null` while it opens;
   * `'unavailable'` when its file cannot be opened: the ledger works regardless and neither file is reset. */
  review: ReviewTray | 'unavailable' | null;
  /** The store's confirmation (its frozen write, then the ledger's own create), run in the ledger's queue; the view is read
   * again after it. `recorded: false`: the movement is saved and the item is marked at the next reconciliation. */
  confirmReview: (id: string, expectedRevision: number) => Promise<{ recorded: boolean }>;
  /** The edited draft, at the revision the editor opened (a newer one is refused). Writes nothing to the ledger. */
  updateReview: (id: string, expectedRevision: number, draft: unknown) => Promise<ReviewItem>;
  /** pending → dismissed. Writes nothing to the ledger. */
  dismissReview: (id: string, expectedRevision: number) => Promise<void>;
  /** A new pending item (a producer; in 25A-03 only the development fixture). Writes nothing to the ledger. */
  captureReview: (input: ReviewCapture) => Promise<void>;
};
const LedgerContext = createContext<LedgerContextValue | null>(null);

export function LedgerProvider({ children }: { children: ReactNode }) {
  const database = useRef<LedgerDatabase | null>(null);
  const [archive, setArchive] = useState<LedgerArchive | null>(null);
  const snapshot = useMemo(() => archive ? snapshotFromArchive(archive) : null, [archive]);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const mounted = useRef(true);
  // Serializing client writes and reads avoids stale snapshots replacing a
  // newer balance. SQLite exclusive transactions provide durable atomicity.
  const queue = useRef<Promise<void>>(Promise.resolve());
  /** 24T1: a warning a write left behind (its instalment recognition failed after the save): shown instead of clearing the banner. */
  const pendingWarning = useRef<string | null>(null);
  const reviewStore = useRef<ReviewStore | null>(null);
  const reviewDatabase = useRef<ReviewDatabase | null>(null);
  const [review, setReview] = useState<ReviewTray | 'unavailable' | null>(null);

  const enqueue = useCallback((work: () => Promise<void>) => {
    const next = queue.current.then(work);
    queue.current = next.catch(() => {});
    return next;
  }, []);

  useEffect(() => {
    let cancelled = false;
    mounted.current = true;
    setError(null);
    void enqueue(async () => {
      const db = database.current ?? await openLedgerDatabase();
      database.current = db;
      // 24UX5: the recurring catch-up never keeps the data closed. A rule it cannot record waits in Recurrentes for
      // review; a catch-up that failed as a whole is said in the banner, over the open app, with its retry. 24T1: the
      // same for the instalment catch-up, on its own flag (the retry reopens and runs both passes again).
      const session = await openLedger(db, todayKey());
      if (cancelled) return;
      setArchive(session.archive);
      setError(sessionWarning(session));
      await loadReview(db);
    }).catch(() => {
      if (!cancelled) setError('No pudimos abrir tus datos. No se borró ni reemplazó nada. Probá nuevamente o conservá la app para recuperar la base.');
    });
    return () => { cancelled = true; mounted.current = false; };
  }, [attempt, enqueue]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state !== 'active' || !database.current || !snapshot) return;
      void enqueue(async () => {
        const session = await refreshLedger(database.current!, todayKey());
        if (!mounted.current) return;
        setArchive(session.archive);
        setError(sessionWarning(session)); // A successful pass clears its warning; a failing one keeps it.
        await loadReview(database.current!);
      }).catch(() => {
        if (mounted.current) setError('No pudimos verificar tus datos locales ni los vencimientos recurrentes. No se modificó nada fuera de una transacción completa.');
      });
    });
    return () => subscription.remove();
  }, [enqueue, snapshot !== null]);

  /** 25A-03: opens the review file once (again after a failure) and reads the tray, reconciling first. Never throws: a review
   * file that cannot be opened or read leaves the ledger as it is; a tray already shown stays until a read succeeds. */
  const loadReview = async (db: LedgerDatabase) => {
    try {
      // One connection for the session: a store that failed to open is retried over it, never over a new one each time.
      reviewDatabase.current ??= await openReviewDatabase();
      reviewStore.current ??= await openReviewStore(reviewDatabase.current, db);
      const tray = await loadReviewTray(reviewStore.current, new Date().toISOString());
      if (mounted.current) setReview(tray);
    } catch {
      if (mounted.current) setReview(current => current && current !== 'unavailable' ? current : 'unavailable');
    }
  };

  const mutate = useCallback((operation: (db: LedgerDatabase) => Promise<void>) => enqueue(async () => {
    if (!database.current) throw new Error('Todavía estamos abriendo tus datos.');
    pendingWarning.current = null;
    await operation(database.current);
    // If this read fails after commit, the form keeps the same operation ID;
    // retrying cannot post a duplicate entry.
    try {
      const next = await readArchive(database.current);
      if (mounted.current) { setArchive(next); setError(pendingWarning.current); }
    } catch {
      if (mounted.current) setError(VIEW_REFRESH_MESSAGE);
      throw new Error(VIEW_REFRESH_MESSAGE);
    }
  }), [enqueue]);

  /** 24T3: a refused operation or plan lifecycle write left the view possibly stale (another revision, a statement that
   * closed since the preview): the archive is read again before the refusal reaches the screen, so it previews from the
   * stored state. Nothing was written; a failed re-read leaves the refusal as it was. The instalment catch-up (the one the
   * foreground runs, idempotent) goes first: the refused write rolled back its own catch-up, and a view that still lacks a
   * statement that closed would offer the same refused action again (a stop with nothing left once that share is recorded). */
  const rereadOnRefusal = (work: (db: LedgerDatabase) => Promise<void>) => mutate(async db => {
    try { await work(db); } catch (cause) {
      try { await catchUpInstallments(db, todayKey()); } catch { /* Best effort: the foreground retries it and says so. */ }
      try { const fresh = await readArchive(db); if (mounted.current) setArchive(fresh); } catch { /* The refusal stands either way. */ }
      throw cause;
    }
  });
  const changeOperation = (change: OperationChange, action: OperationChange['action']) => rereadOnRefusal(db => {
    if (change.action !== action) throw new Error(OPERATION_STATE_MESSAGE);
    return changePurchaseOperation(db, change, todayKey());
  });

  /** A review operation in the ledger's queue (a confirmation writes the ledger through its own create functions); the tray
   * is read again afterwards, whatever happened, so a refused or reconciled item never shows a stale state. */
  /** A refusal (stale, changed, closed) re-reads the archive first, so the screen judges from the stored ledger again. An
   * operation that succeeded but whose view refresh failed is a success: the banner already says to verify before retrying. */
  const reviewOperation = <T,>(work: (store: ReviewStore) => Promise<T>): Promise<T> => {
    let result: T, done = false;
    return rereadOnRefusal(async db => {
      if (!reviewStore.current) throw new Error('review.unavailable');
      try { result = await work(reviewStore.current); done = true; } finally { await loadReview(db); }
    }).then(() => result, cause => {
      if (done && cause instanceof Error && cause.message === VIEW_REFRESH_MESSAGE) return result;
      throw cause;
    });
  };

  return <LedgerContext.Provider value={{
    gate: BUILD_CURRENCY_GATE, snapshot, archive, error, review,
    retry: () => setAttempt(value => value + 1),
    addAccount: (account, appearance) => mutate(db => createAccount(db, account, appearance, BUILD_CURRENCY_GATE)),
    addEntry: entry => mutate(db => createEntry(db, entry)),
    updateEntry: change => mutate(db => changeEntry(db, change)),
    updateAccount: (change, appearance) => mutate(db => changeAccount(db, change, appearance)),
    removeAccount: accountId => mutate(db => deleteAccount(db, accountId, new Date().toISOString())),
    saveAppearance: appearance => mutate(db => saveAccountAppearance(db, appearance)),
    saveCategory: definition => mutate(db => saveCategoryDefinition(db, definition)),
    addTransfer: transfer => mutate(db => createTransfer(db, transfer)),
    updateTransfer: change => mutate(db => changeTransfer(db, change)),
    saveRecurring: rule => mutate(async db => {
      await saveRecurringRule(db, rule);
      await processRecurring(db, todayKey());
    }),
    saveBudget: budget => mutate(db => saveMonthlyBudget(db, budget, BUILD_CURRENCY_GATE)),
    addCard: (account, card, cycleDates = []) => mutate(db => createCreditCard(db, account, card, BUILD_CURRENCY_GATE, cycleDates)),
    saveCard: (card, cycle = {}) => mutate(db => saveCreditCard(db, card, cycle, todayKey())),
    removeCard: cardId => mutate(db => deleteCreditCard(db, cardId, new Date().toISOString())),
    addDebt: (account, debt) => mutate(db => createPersonalDebt(db, account, debt, BUILD_CURRENCY_GATE)),
    saveDebt: debt => mutate(db => savePersonalDebt(db, debt)),
    removeDebt: debtId => mutate(db => deletePersonalDebt(db, debtId, new Date().toISOString())),
    addInstallmentPlan: plan => mutate(async db => {
      // A first instalment on a statement already closed is recognised at once. The plan is saved either way: a failing
      // recognition is reported in the banner (never as a failed save that would invite a duplicate) and retried.
      try { pendingWarning.current = await savePurchasePlan(db, plan, todayKey()); } catch (cause) {
        // 24T2: a plan built from a calendar this view no longer holds (a card change whose refresh failed) is refused before
        // anything is written; the view is read again so the form rebuilds the plan from the card's current statements.
        if (cause instanceof Error && cause.message === PLAN_CALENDAR_MESSAGE) {
          try { const fresh = await readArchive(db); if (mounted.current) setArchive(fresh); } catch { /* The refusal stands either way. */ }
        }
        throw cause;
      }
    }),
    // 24T3 (A14): the catch-up runs through the device's day (`todayKey()`), never a UTC timestamp's date.
    cancelInstallmentPlan: (planId, expectedRevision) => rereadOnRefusal(db => cancelInstallmentPlan(db, planId, expectedRevision, todayKey(), new Date().toISOString())),
    reactivateInstallmentPlan: (planId, expectedRevision) => rereadOnRefusal(db => reactivateInstallmentPlan(db, planId, expectedRevision, todayKey(), new Date().toISOString())),
    removeInstallmentPlan: planId => mutate(db => deleteInstallmentPlan(db, planId, new Date().toISOString())),
    addRefund: refund => rereadOnRefusal(db => savePurchaseOperation(db, refund, todayKey())),
    addPayoff: payoff => rereadOnRefusal(db => savePurchaseOperation(db, payoff, todayKey())),
    voidOperation: change => changeOperation(change, 'void'),
    restoreOperation: change => changeOperation(change, 'restore'),
    restoreBackup: (incoming, baseline) => mutate(async db => {
      await importArchive(db, incoming, baseline);
      await processRecurring(db, todayKey());
      try { await catchUpInstallments(db, todayKey()); } catch { pendingWarning.current = sessionWarning({ recurringError: false, installmentError: true }); }
    }),
    confirmReview: (id, expectedRevision) => reviewOperation(async store => {
      const result = await store.confirm(id, { expectedRevision, todayISO: todayKey(), at: new Date().toISOString() });
      // A plan whose first instalments could not be recognised right away is saved: its catch-up banner, as for the form.
      pendingWarning.current = result.warning;
      return { recorded: result.recorded };
    }),
    updateReview: (id, expectedRevision, draft) => reviewOperation(store => store.updateDraft(id, expectedRevision, draft, new Date().toISOString())),
    dismissReview: (id, expectedRevision) => reviewOperation(async store => { await store.dismiss(id, expectedRevision, new Date().toISOString()); }),
    captureReview: input => reviewOperation(async store => { await store.capture(input); }),
  }}>{children}</LedgerContext.Provider>;
}

export function useLedger() {
  const value = useContext(LedgerContext);
  if (!value) throw new Error('LedgerProvider is required');
  return value;
}
