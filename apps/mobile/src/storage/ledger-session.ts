import { OPERATION_CHANGED_MESSAGE, type InstallmentPlan, type LedgerArchive, type PurchaseOperation } from '@finanzapp/domain';
import { NEWER_SCHEMA_MESSAGE, catchUpInstallments, catchUpRecurring, createInstallmentPlan, createPurchaseOperation, importArchive, initializeDatabase, readArchive, type CreateGuard,
  type LedgerDatabase } from './database.ts';
import { MIGRATION_REFERENCES_MESSAGE } from './transaction.ts';

/** What LedgerProvider shows after opening or returning to the foreground: the archive as stored, the recurring rules
 * set aside for review (their ids), and whether each catch-up could not run. `recurringError` and `installmentError`
 * are independent: one pass failing never hides or skips the other. */
export type LedgerSession = { archive: LedgerArchive; recurringFailures: string[]; recurringError: boolean; installmentError: boolean };
/** 25Q4: which catch-up pass last failed: the banner's two halves. */
export type CatchUps = Pick<LedgerSession, 'recurringError' | 'installmentError'>;

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
  return { ...await runCatchUps(db, todayISO), archive: await readArchive(db) };
}

/** Both passes, each on its own: one failing never hides or skips the other. */
async function runCatchUps(db: LedgerDatabase, todayISO: string): Promise<Omit<LedgerSession, 'archive'>> {
  let recurringFailures: string[] = [], recurringError = false, installmentError = false;
  try { recurringFailures = (await catchUpRecurring(db, todayISO)).failed; }
  catch { recurringError = true; }
  try { await catchUpInstallments(db, todayISO); }
  catch { installmentError = true; }
  return { recurringFailures, recurringError, installmentError };
}

/** 25Q4: a restore. The import is the write: a refusal (conflict, scale, changed baseline) or a failed transaction rolls back
 * and reaches the review. Then both catch-ups record what fell due since the copy (automatic, owner decision), each in its
 * own transactions, as on open: a failing catch-up never turns the committed import into a failure; it returns its flag,
 * for the banner and its retry. */
export async function restoreFromBackup(db: LedgerDatabase, incoming: LedgerArchive, baseline: string, todayISO: string): Promise<CatchUps> {
  await importArchive(db, incoming, baseline);
  const { recurringError, installmentError } = await runCatchUps(db, todayISO);
  return { recurringError, installmentError };
}

/** The banner a session needs (a Spanish sentence, translated when shown), or null when both catch-ups ran. The banner
 * carries the retry; the data under it stays open and never claims to be complete while one is shown. */
export function sessionWarning(session: CatchUps): string | null {
  if (session.recurringError && session.installmentError) {
    return 'No pudimos verificar los vencimientos recurrentes ni registrar las cuotas vencidas de tus tarjetas. El saldo de tus tarjetas, Reportes y Presupuestos pueden estar incompletos. No se modificó nada fuera de una transacción completa.';
  }
  if (session.recurringError) return 'No pudimos verificar tus datos locales ni los vencimientos recurrentes. No se modificó nada fuera de una transacción completa.';
  if (session.installmentError) {
    return 'No pudimos registrar las cuotas vencidas de tus tarjetas. El saldo de tus tarjetas, Reportes y Presupuestos pueden no incluirlas todavía. No se modificó nada fuera de una transacción completa.';
  }
  return null;
}

/** 25Q4: what the launch screen says when the data cannot open. The two refusals storage guarantees left the file untouched,
 * and that name their own remedy, are said as themselves. Anything else (a locked or unreadable file, a stored row that fails
 * validation, an engine's error) gets the calm open sentence, never the engine's text. */
export function openFailureMessage(cause: unknown): string {
  const message = (cause as { message?: unknown } | null | undefined)?.message;
  return typeof message === 'string' && (message === NEWER_SCHEMA_MESSAGE || message === MIGRATION_REFERENCES_MESSAGE) ? message
    : 'No pudimos abrir tus datos. No se borró ni reemplazó nada. Probá nuevamente o conservá la app para recuperar la base.';
}

/** Producto 24T2: a purchase in instalments saved from the form. The plan is created in its own commit (a retry of the
 * same plan is a no-op there); then a first instalment whose statement already closed is recognised at once. A failing
 * recognition never fails the save: the plan is durable, and a failed save would invite the person to create it again.
 * It returns the banner instead (the next pass, or the banner's retry, records the instalment once: deterministic ids). */
export async function savePurchasePlan(db: LedgerDatabase, plan: InstallmentPlan, todayISO: string, guard?: CreateGuard): Promise<string | null> {
  await createInstallmentPlan(db, plan, guard);
  try { await catchUpInstallments(db, todayISO); return null; }
  catch { return sessionWarning({ recurringError: false, installmentError: true }); }
}

/** Producto 24T3: a devolución or an adelanto de cuotas confirmed in its form. Storage runs the plan's catch-up, recomputes
 * the allocation and records both in one commit (`createPurchaseOperation`). When the allocation changed since the preview
 * («Las cuotas cambiaron…», A13) nothing was written; the whole instalment catch-up then runs (best effort: its failure keeps
 * the refusal), so the view the form previews again holds the instalments whose statements closed meanwhile. The refusal
 * always reaches the form, which releases its draft and previews again. */
export async function savePurchaseOperation(db: LedgerDatabase, operation: PurchaseOperation, todayISO: string): Promise<void> {
  try { await createPurchaseOperation(db, operation, todayISO); }
  catch (cause) {
    if (cause instanceof Error && cause.message === OPERATION_CHANGED_MESSAGE) { try { await catchUpInstallments(db, todayISO); } catch { /* The refusal stands either way. */ } }
    throw cause;
  }
}
