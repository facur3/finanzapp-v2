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

/** Thrown when a rebuilt schema would leave a child row pointing nowhere: the migration is rolled back whole. */
export const MIGRATION_REFERENCES_MESSAGE = 'La actualización de los datos dejó referencias incompletas. Se canceló sin modificar nada.';

/** A schema migration that rebuilds a table other tables reference (SQLite cannot alter a
 * CHECK): the documented procedure. Foreign keys are switched OFF on this dedicated connection,
 * before BEGIN (inside a transaction the pragma is a no-op), so the parent table can be dropped
 * and renamed while its children keep their rows; then `PRAGMA foreign_key_check` must report
 * nothing before COMMIT, otherwise the whole migration is rolled back and the file stays at its
 * previous version. Writes never use this helper (`runExclusiveTransaction` keeps foreign keys ON). */
export async function runSchemaMigration(
  open: () => Promise<TransactionConnection>,
  work: (tx: SqlExecutor) => Promise<void>,
): Promise<void> {
  const tx = await open();
  let started = false;
  try {
    await tx.execAsync('PRAGMA foreign_keys = OFF; PRAGMA busy_timeout = 5000;');
    await tx.execAsync('BEGIN IMMEDIATE');
    started = true;
    await work(tx);
    const broken = await tx.getAllAsync<{ table: string; rowid: number; parent: string; fkid: number }>('PRAGMA foreign_key_check');
    if (broken.length) throw new Error(MIGRATION_REFERENCES_MESSAGE);
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
