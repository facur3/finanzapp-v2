import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import type { Account, Entry, LedgerSnapshot } from '@finanzapp/domain';
import { createAccount, createEntry, initializeDatabase, readSnapshot, type LedgerDatabase } from './database';
import { openLedgerDatabase } from './nativeDatabase';

type LedgerContextValue = {
  snapshot: LedgerSnapshot | null;
  error: string | null;
  retry: () => void;
  addAccount: (account: Account) => Promise<void>;
  addEntry: (entry: Entry) => Promise<void>;
};
const LedgerContext = createContext<LedgerContextValue | null>(null);

export function LedgerProvider({ children }: { children: ReactNode }) {
  const database = useRef<LedgerDatabase | null>(null);
  const [snapshot, setSnapshot] = useState<LedgerSnapshot | null>(null);
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
      const next = await readSnapshot(db);
      if (!cancelled) setSnapshot(next);
    }).catch(() => {
      if (!cancelled) setError('No pudimos abrir tus datos. No se borró ni reemplazó nada. Probá nuevamente o conservá la app para recuperar la base.');
    });
    return () => { cancelled = true; mounted.current = false; };
  }, [attempt, enqueue]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state !== 'active' || !database.current || !snapshot) return;
      void enqueue(async () => {
        const next = await readSnapshot(database.current!);
        if (mounted.current) { setSnapshot(next); setError(null); }
      }).catch(() => {
        if (mounted.current) setError('No pudimos verificar tus datos locales. No se modificó nada.');
      });
    });
    return () => subscription.remove();
  }, [enqueue, snapshot !== null]);

  const mutate = useCallback((operation: (db: LedgerDatabase) => Promise<void>) => enqueue(async () => {
    if (!database.current) throw new Error('Todavía estamos abriendo tus datos.');
    await operation(database.current);
    // If this read fails after commit, the form keeps the same operation ID;
    // retrying cannot post a duplicate entry.
    const next = await readSnapshot(database.current);
    if (mounted.current) { setSnapshot(next); setError(null); }
  }), [enqueue]);

  return <LedgerContext.Provider value={{
    snapshot, error,
    retry: () => setAttempt(value => value + 1),
    addAccount: account => mutate(db => createAccount(db, account)),
    addEntry: entry => mutate(db => createEntry(db, entry)),
  }}>{children}</LedgerContext.Provider>;
}

export function useLedger() {
  const value = useContext(LedgerContext);
  if (!value) throw new Error('LedgerProvider is required');
  return value;
}
