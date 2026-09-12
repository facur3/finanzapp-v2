import type { SqlExecutor } from './database.ts';

export interface TransactionConnection extends SqlExecutor {
  closeAsync(): Promise<void>;
}

// PRAGMAs are connection-local. Configure the dedicated connection BEFORE
// BEGIN: setting foreign_keys inside an active transaction has no effect.
// This helper is shared by Expo SQLite and the actual SQLite integration tests.
export async function runExclusiveTransaction(
  open: () => Promise<TransactionConnection>,
  work: (tx: SqlExecutor) => Promise<void>,
): Promise<void> {
  const tx = await open();
  let started = false;
  try {
    await tx.execAsync('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
    await tx.execAsync('BEGIN IMMEDIATE');
    started = true;
    await work(tx);
    await tx.execAsync('COMMIT');
    started = false;
  } catch (error) {
    if (started) {
      try { await tx.execAsync('ROLLBACK'); } catch { /* Closing also abandons an uncommitted transaction. */ }
    }
    throw error;
  } finally {
    await tx.closeAsync();
  }
}
