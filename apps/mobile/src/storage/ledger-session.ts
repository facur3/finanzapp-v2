import type { LedgerArchive } from '@finanzapp/domain';
import { catchUpInstallments, catchUpRecurring, initializeDatabase, readArchive, type LedgerDatabase } from './database.ts';

/** What LedgerProvider shows after opening or returning to the foreground: the archive as stored, the recurring rules
 * set aside for review (their ids), and whether each catch-up could not run. `recurringError` and `installmentError`
 * are independent: one pass failing never hides or skips the other. */
export type LedgerSession = { archive: LedgerArchive; recurringFailures: string[]; recurringError: boolean; installmentError: boolean };

/** Producto 24UX5: recurring rules are recorded automatically on launch and on every return to the foreground
 * (`todayISO` is the device's day), never while the app is closed; a date that passed meanwhile is recorded with its
 * own date, and a long backlog in durable batches (`catchUpRecurring`). The catch-up is not a precondition for opening
 * the data: a rule that cannot be recorded is left unchanged (Recurrentes asks for review), and a catch-up that fails
 * as a whole keeps every step already committed and still opens the ledger. Only initializing or reading the database
 * can fail an open. */
export async function openLedger(db: LedgerDatabase, todayISO: string): Promise<LedgerSession> {
  await initializeDatabase(db);
  return refreshLedger(db, todayISO);
}

/** Producto 24T1: the instalments whose statements closed are recognised in their own pass, after the recurring one.
 * The same contract: a failure (a locked or full database, any write error) rolls its transaction back, keeps whatever
 * was already durable, fabricates nothing and still opens the ledger, but it is **reported** (`installmentError`), because
 * the archive then lacks instalments that are due: the card balance, Reportes and Presupuestos would be understated. The
 * next foreground, or the banner's retry, runs the pass again; a success clears the flag; the deterministic ids make the
 * retry record each instalment once. */
export async function refreshLedger(db: LedgerDatabase, todayISO: string): Promise<LedgerSession> {
  let recurringFailures: string[] = [], recurringError = false, installmentError = false;
  try { recurringFailures = (await catchUpRecurring(db, todayISO)).failed; }
  catch { recurringError = true; }
  try { await catchUpInstallments(db, todayISO); }
  catch { installmentError = true; }
  return { archive: await readArchive(db), recurringFailures, recurringError, installmentError };
}

/** The banner a session needs (a Spanish sentence, translated when shown), or null when both catch-ups ran. The banner
 * carries the retry; the data under it stays open and never claims to be complete while one is shown. */
export function sessionWarning(session: Pick<LedgerSession, 'recurringError' | 'installmentError'>): string | null {
  if (session.recurringError && session.installmentError) {
    return 'No pudimos verificar los vencimientos recurrentes ni registrar las cuotas vencidas de tus tarjetas. El saldo de tus tarjetas, Reportes y Presupuestos pueden estar incompletos. No se modificó nada fuera de una transacción completa.';
  }
  if (session.recurringError) return 'No pudimos verificar tus datos locales ni los vencimientos recurrentes. No se modificó nada fuera de una transacción completa.';
  if (session.installmentError) {
    return 'No pudimos registrar las cuotas vencidas de tus tarjetas. El saldo de tus tarjetas, Reportes y Presupuestos pueden no incluirlas todavía. No se modificó nada fuera de una transacción completa.';
  }
  return null;
}
