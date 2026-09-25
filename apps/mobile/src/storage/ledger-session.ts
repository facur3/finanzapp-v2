import type { LedgerArchive } from '@finanzapp/domain';
import { catchUpRecurring, initializeDatabase, readArchive, type LedgerDatabase } from './database.ts';

/** What LedgerProvider shows after opening or returning to the foreground: the archive as stored, the recurring rules
 * set aside for review (their ids), and whether the recurring catch-up itself could not run. */
export type LedgerSession = { archive: LedgerArchive; recurringFailures: string[]; recurringError: boolean };

/** Producto 24UX5: recurring rules are recorded on launch and on every return to the foreground (`todayISO` is the
 * device's day), never while the app is closed. The catch-up is not a precondition for opening the data: a rule that
 * cannot be recorded is set aside (Recurrentes asks for review), and a catch-up that fails as a whole leaves the
 * ledger as it was (one transaction) and still opens it. Only initializing or reading the database can fail an open. */
export async function openLedger(db: LedgerDatabase, todayISO: string): Promise<LedgerSession> {
  await initializeDatabase(db);
  return refreshLedger(db, todayISO);
}

export async function refreshLedger(db: LedgerDatabase, todayISO: string): Promise<LedgerSession> {
  let recurringFailures: string[] = [], recurringError = false;
  try { recurringFailures = (await catchUpRecurring(db, todayISO)).failed; }
  catch { recurringError = true; }
  return { archive: await readArchive(db), recurringFailures, recurringError };
}
