import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { snapshotFromArchive, type Account, type Entry, type EntryChange, type LedgerArchive, type LedgerSnapshot } from '@finanzapp/domain';
import { changeEntry, createAccount, createEntry, importArchive, initializeDatabase, readArchive, type LedgerDatabase } from './database';
import { openLedgerDatabase } from './nativeDatabase';

type LedgerContextValue = {
  snapshot: LedgerSnapshot | null;
  archive: LedgerArchive | null;
  error: string | null;
  retry: () => void;
  addAccount: (account: Account) => Promise<void>;
  addEntry: (entry: Entry) => Promise<void>;
  updateEntry: (change: EntryChange) => Promise<void>;
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
        const next = await readArchive(database.current!);
        if (mounted.current) { setArchive(next); setError(null); }
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
    addAccount: account => mutate(db => createAccount(db, account)),
    addEntry: entry => mutate(db => createEntry(db, entry)),
    updateEntry: change => mutate(db => changeEntry(db, change)),
    restoreBackup: (incoming, baseline) => mutate(db => importArchive(db, incoming, baseline)),
  }}>{children}</LedgerContext.Provider>;
}

export function useLedger() {
  const value = useContext(LedgerContext);
  if (!value) throw new Error('LedgerProvider is required');
  return value;
}
