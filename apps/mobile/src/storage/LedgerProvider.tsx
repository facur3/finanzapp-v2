import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { OPERATION_STATE_MESSAGE, PLAN_CALENDAR_MESSAGE, snapshotFromArchive, todayKey, type Account, type Entry, type EntryChange, type LedgerArchive, type LedgerSnapshot,
  type AccountChange, type Transfer, type TransferChange, type RecurringRule, type MonthlyBudget,
  type CreditCardProfile, type PersonalDebtProfile, type AccountAppearance, type CategoryDefinition, type InstallmentPlan,
  type CardCycleDates, type CardCycleIntent, type EntryRefund, type OperationChange, type PlanPayoff, type PlanRefund } from '@finanzapp/domain';
import type { CurrencyGate } from '@finanzapp/domain';
import { currencyGateForBuild } from './currency-gate';
import { changeEntry, createAccount, createEntry, deleteAccount, deleteCreditCard, readArchive, changeAccount,
  createTransfer, changeTransfer, saveMonthlyBudget,
  createCreditCard, saveCreditCard, createPersonalDebt, savePersonalDebt, deletePersonalDebt, saveAccountAppearance, saveCategoryDefinition,
  cancelInstallmentPlan, deleteInstallmentPlan, catchUpInstallments, changePurchaseOperation, reactivateInstallmentPlan,
  type LedgerDatabase } from './database';
import { VIEW_REFRESH_MESSAGE, openFailureMessage, openLedger, refreshLedger, restoreFromBackup, saveRecurring, savePurchaseOperation, savePurchasePlan, sessionWarning,
  shouldRefreshOnActive, type CatchUps, type LastPass, type LedgerSession } from './ledger-session';
import { useCurrentDay } from '../ui/theme';
import { openLedgerDatabase, openReviewDatabase } from './nativeDatabase';
import { loadReviewTray, openReviewStore, type ReviewCapture, type ReviewDatabase, type ReviewItem, type ReviewStore, type ReviewTray } from './review-database';

declare const __DEV__: boolean | undefined;
/** The creation gate of this build (docs/currency.md §7.5, stage 9): the production ARS/USD, or the preview set in a
 * development bundle started with the flag, read by its literal name so a release bundle inlines the constant. */
export const BUILD_CURRENCY_GATE: CurrencyGate = currencyGateForBuild(process.env.EXPO_PUBLIC_CURRENCY_PREVIEW, typeof __DEV__ !== 'undefined' && __DEV__);

type LedgerContextValue = {
  /** The currencies a new account, card, debt or budget may take in this build. Reads never consult it. */
  gate: CurrencyGate;
  snapshot: LedgerSnapshot | null;
  archive: LedgerArchive | null;
  /** The device's day the archive's catch-ups last ran through (open, foreground, a change of day), or null before the open.
   * Recurrentes asks for review only against it: a rule due since then is not «behind» until a pass for today ran. */
  asOfISO: string | null;
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
  /** 25A-04: a producer's proposal stored as a pending item (the Assistant's). Idempotent: the same capture again returns
   * the stored item (an item edited since is kept as edited); the same id or key with other data is refused. Writes
   * nothing to the ledger; the tray and the badge are read again afterwards. */
  captureReview: (input: ReviewCapture) => Promise<ReviewItem>;
  /** 25A-04: one item whatever its state (confirmed, dismissed), for a producer that shows it again; null when absent. */
  getReviewItem: (id: string) => Promise<ReviewItem | null>;
  /** Reads the tray again (reconciling first), in the ledger's queue; a failure keeps the tray shown. */
  refreshReview: () => Promise<void>;
  /** Counts the review operations this session has run (a confirmation, an edit, a dismissal, a capture), whether or not
   * the tray could be read again after them: a screen that reads an item from the store (a stale tray) reads it again
   * when it changes. A reload alone never changes it, so a failing reload cannot loop. */
  reviewVersion: number;
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
  /** 25Q4: which catch-up last failed, as the open or foreground pass left it and as a write that ran a pass updated it. The
   * banner after a write is built from it, so a failure stays said, with its retry, until its own pass succeeds. */
  const catchUps = useRef<CatchUps>({ recurringError: false, installmentError: false });
  const reviewStore = useRef<ReviewStore | null>(null);
  const reviewDatabase = useRef<ReviewDatabase | null>(null);
  const [review, setReview] = useState<ReviewTray | 'unavailable' | null>(null);
  const [reviewVersion, setReviewVersion] = useState(0);
  const [asOfISO, setAsOfISO] = useState<string | null>(null);
  // 25R1: the pass bookkeeping. `lastPass`: the day and outcome of the last pass run; `passFor`: the day of the pass last
  // started, so a day change and a foreground on the same new day run it once; `pending`: one is queued or running.
  const lastPass = useRef<LastPass | null>(null);
  const passFor = useRef<string | null>(null);
  const pending = useRef(false);
  const previousState = useRef<string | null>(AppState.currentState ?? null);
  const day = useCurrentDay();

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
      const today = todayKey();
      passFor.current = today;
      const session = await openLedger(db, today);
      if (cancelled) return;
      adopt(session, today);
      await loadReview(db);
    }).catch(cause => {
      if (!cancelled) setError(openFailureMessage(cause));
    });
    return () => { cancelled = true; mounted.current = false; };
  }, [attempt, enqueue]);

  /** A pass's outcome becomes the view: the archive, the day it is current to, the banner (a success clears its warning). */
  function adopt(session: LedgerSession, today: string) {
    catchUps.current = { recurringError: session.recurringError, installmentError: session.installmentError };
    lastPass.current = { day: today, failed: session.recurringError || session.installmentError };
    setArchive(session.archive);
    setAsOfISO(today);
    setError(sessionWarning(session));
  }
  /** One catch-up pass in the queue, for the day it runs on. Coalesced: while one is queued or running, another request adds
   * nothing (several quick returns, or a return and the change of day it brings). */
  const runPass = () => {
    if (!database.current || pending.current) return;
    pending.current = true;
    passFor.current = todayKey();
    void enqueue(async () => {
      const today = todayKey();
      passFor.current = today;
      const session = await refreshLedger(database.current!, today);
      if (!mounted.current) return;
      adopt(session, today);
      await loadReview(database.current!);
    }).catch(() => {
      // The pass could not be read back: nothing says it completed.
      lastPass.current = { day: passFor.current ?? '', failed: true };
      catchUps.current = { ...catchUps.current, recurringError: true };
      if (mounted.current) setError(sessionWarning(catchUps.current));
    }).finally(() => { pending.current = false; });
  };

  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      const previous = previousState.current;
      previousState.current = state;
      if (state !== 'active' || !database.current || !snapshot) return;
      // 25R1: a pull of Control Center on a day already caught up costs nothing; a return from the background always runs.
      if (shouldRefreshOnActive({ previous, today: todayKey(), lastPass: lastPass.current, queued: pending.current })) runPass();
    });
    return () => subscription.remove();
  }, [enqueue, snapshot !== null]);

  // 25R1: midnight with the app open (the UI's day changes on its own timer) runs the pass once for the new day; a day change
  // that a foreground return already queued or ran a pass for adds nothing.
  useEffect(() => {
    if (snapshot && passFor.current !== null && passFor.current !== day) runPass();
  }, [day, snapshot !== null]);

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
    await operation(database.current);
    // If this read fails after commit, the form keeps the same operation ID;
    // retrying cannot post a duplicate entry.
    try {
      const next = await readArchive(database.current);
      // 25Q4: a write never clears a catch-up banner it did not earn: one that ran no pass leaves a failed pass said; a pass
      // it ran updated its own half.
      if (mounted.current) { setArchive(next); setError(sessionWarning(catchUps.current)); }
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
      try { result = await work(reviewStore.current); done = true; } finally {
        await loadReview(db);
        if (mounted.current) setReviewVersion(value => value + 1);
      }
    }).then(() => result, cause => {
      if (done && cause instanceof Error && cause.message === VIEW_REFRESH_MESSAGE) return result;
      throw cause;
    });
  };

  return <LedgerContext.Provider value={{
    gate: BUILD_CURRENCY_GATE, snapshot, archive, asOfISO, error, review, reviewVersion,
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
    // 25Q4: the rule is durable before its catch-up: a catch-up that fails after it is said in the banner (its retry runs it
    // again), never as a failed save, as a plan's recognition (24T2). 25R1: the composite is storage's (`saveRecurring`).
    saveRecurring: rule => mutate(async db => {
      const { recurringError } = await saveRecurring(db, rule, todayKey());
      catchUps.current = { ...catchUps.current, recurringError };
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
      try {
        const warning = await savePurchasePlan(db, plan, todayKey());
        catchUps.current = { ...catchUps.current, installmentError: warning !== null };
      } catch (cause) {
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
    // 25Q4: a refused deletion (an instalment or an operation recorded since the screen was drawn) re-reads the plan too.
    // 25R1: judged on the plan caught up through the device's day, as the other plan actions.
    removeInstallmentPlan: planId => rereadOnRefusal(db => deleteInstallmentPlan(db, planId, new Date().toISOString(), todayKey())),
    addRefund: refund => rereadOnRefusal(db => savePurchaseOperation(db, refund, todayKey())),
    addPayoff: payoff => rereadOnRefusal(db => savePurchaseOperation(db, payoff, todayKey())),
    voidOperation: change => changeOperation(change, 'void'),
    restoreOperation: change => changeOperation(change, 'restore'),
    // 25Q4: a refused import re-reads the archive before the error reaches the review, so «Volver a revisar» previews from the
    // stored ledger; a committed one adopts both catch-ups' outcome, whatever the banner said before.
    restoreBackup: (incoming, baseline) => rereadOnRefusal(async db => { catchUps.current = await restoreFromBackup(db, incoming, baseline, todayKey()); }),
    confirmReview: (id, expectedRevision) => reviewOperation(async store => {
      const result = await store.confirm(id, { expectedRevision, todayISO: todayKey(), at: new Date().toISOString() });
      // A plan whose first instalments could not be recognised right away is saved: its catch-up banner, as for the form. A null
      // warning does not say a pass ran (an entry runs none), so it leaves the half as it was.
      if (result.warning) catchUps.current = { ...catchUps.current, installmentError: true };
      return { recorded: result.recorded };
    }),
    updateReview: (id, expectedRevision, draft) => reviewOperation(store => store.updateDraft(id, expectedRevision, draft, new Date().toISOString())),
    dismissReview: (id, expectedRevision) => reviewOperation(async store => { await store.dismiss(id, expectedRevision, new Date().toISOString()); }),
    captureReview: input => reviewOperation(async store => (await store.capture(input)).item),
    refreshReview: () => enqueue(async () => { if (database.current) await loadReview(database.current); }),
    getReviewItem: async id => {
      if (!reviewStore.current) throw new Error('review.unavailable');
      return reviewStore.current.get(id);
    },
  }}>{children}</LedgerContext.Provider>;
}

export function useLedger() {
  const value = useContext(LedgerContext);
  if (!value) throw new Error('LedgerProvider is required');
  return value;
}
