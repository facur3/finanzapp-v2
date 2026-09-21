import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { snapshotFromArchive, todayKey, type Account, type Entry, type EntryChange, type LedgerArchive, type LedgerSnapshot,
  type AccountChange, type Transfer, type TransferChange, type RecurringRule, type MonthlyBudget,
  type CreditCardProfile, type PersonalDebtProfile, type AccountAppearance, type CategoryDefinition } from '@finanzapp/domain';
import { changeEntry, createAccount, createEntry, importArchive, initializeDatabase, readArchive, changeAccount,
  createTransfer, changeTransfer, saveRecurringRule, processRecurring, saveMonthlyBudget,
  createCreditCard, saveCreditCard, createPersonalDebt, savePersonalDebt, saveAccountAppearance, saveCategoryDefinition,
  type LedgerDatabase } from './database';
import { openLedgerDatabase } from './nativeDatabase';

type LedgerContextValue = {
  snapshot: LedgerSnapshot | null;
  archive: LedgerArchive | null;
  error: string | null;
  retry: () => void;
  addAccount: (account: Account, appearance?: AccountAppearance) => Promise<void>;
  addEntry: (entry: Entry) => Promise<void>;
  updateEntry: (change: EntryChange) => Promise<void>;
  updateAccount: (change: AccountChange, appearance?: AccountAppearance) => Promise<void>;
  saveAppearance: (appearance: AccountAppearance) => Promise<void>;
  saveCategory: (definition: CategoryDefinition) => Promise<void>;
  addTransfer: (transfer: Transfer) => Promise<void>;
  updateTransfer: (change: TransferChange) => Promise<void>;
  saveRecurring: (rule: RecurringRule) => Promise<void>;
  saveBudget: (budget: MonthlyBudget) => Promise<void>;
  addCard: (account: Account, card: CreditCardProfile) => Promise<void>;
  saveCard: (card: CreditCardProfile) => Promise<void>;
  addDebt: (account: Account, debt: PersonalDebtProfile) => Promise<void>;
  saveDebt: (debt: PersonalDebtProfile) => Promise<void>;
  restoreBackup: (incoming: LedgerArchive, baseline: string) => Promise<void>;
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
      await initializeDatabase(db);
      await processRecurring(db, todayKey());
      const next = await readArchive(db);
      if (!cancelled) setArchive(next);
    }).catch(() => {
      if (!cancelled) setError('No pudimos abrir tus datos. No se borró ni reemplazó nada. Probá nuevamente o conservá la app para recuperar la base.');
    });
    return () => { cancelled = true; mounted.current = false; };
  }, [attempt, enqueue]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state !== 'active' || !database.current || !snapshot) return;
      void enqueue(async () => {
        await processRecurring(database.current!, todayKey());
        const next = await readArchive(database.current!);
        if (mounted.current) { setArchive(next); setError(null); }
      }).catch(() => {
        if (mounted.current) setError('No pudimos verificar tus datos locales ni los vencimientos recurrentes. No se modificó nada fuera de una transacción completa.');
      });
    });
    return () => subscription.remove();
  }, [enqueue, snapshot !== null]);

  const mutate = useCallback((operation: (db: LedgerDatabase) => Promise<void>) => enqueue(async () => {
    if (!database.current) throw new Error('Todavía estamos abriendo tus datos.');
    await operation(database.current);
    // If this read fails after commit, the form keeps the same operation ID;
    // retrying cannot post a duplicate entry.
    try {
      const next = await readArchive(database.current);
      if (mounted.current) { setArchive(next); setError(null); }
    } catch {
      const message = 'El guardado terminó, pero no pudimos actualizar la vista. Verificá de nuevo antes de registrar otro movimiento; no lo cargues otra vez.';
      if (mounted.current) setError(message);
      throw new Error(message);
    }
  }), [enqueue]);

  return <LedgerContext.Provider value={{
    snapshot, archive, error,
    retry: () => setAttempt(value => value + 1),
    addAccount: (account, appearance) => mutate(db => createAccount(db, account, appearance)),
    addEntry: entry => mutate(db => createEntry(db, entry)),
    updateEntry: change => mutate(db => changeEntry(db, change)),
    updateAccount: (change, appearance) => mutate(db => changeAccount(db, change, appearance)),
    saveAppearance: appearance => mutate(db => saveAccountAppearance(db, appearance)),
    saveCategory: definition => mutate(db => saveCategoryDefinition(db, definition)),
    addTransfer: transfer => mutate(db => createTransfer(db, transfer)),
    updateTransfer: change => mutate(db => changeTransfer(db, change)),
    saveRecurring: rule => mutate(async db => {
      await saveRecurringRule(db, rule);
      await processRecurring(db, todayKey());
    }),
    saveBudget: budget => mutate(db => saveMonthlyBudget(db, budget)),
    addCard: (account, card) => mutate(db => createCreditCard(db, account, card)),
    saveCard: card => mutate(db => saveCreditCard(db, card)),
    addDebt: (account, debt) => mutate(db => createPersonalDebt(db, account, debt)),
    saveDebt: debt => mutate(db => savePersonalDebt(db, debt)),
    restoreBackup: (incoming, baseline) => mutate(async db => {
      await importArchive(db, incoming, baseline);
      await processRecurring(db, todayKey());
    }),
  }}>{children}</LedgerContext.Provider>;
}

export function useLedger() {
  const value = useContext(LedgerContext);
  if (!value) throw new Error('LedgerProvider is required');
  return value;
}
