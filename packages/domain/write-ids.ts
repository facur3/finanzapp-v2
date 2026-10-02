import { operationLineIds } from './operations.ts';
import type { LedgerArchive } from './recovery.ts';

/** Producto 25A-02: one id, one kind of financial write. A movement, a transfer, an instalment plan and a purchase operation
 * (with the ids its projected lines take) are kept in separate tables, each idempotent by its own id, so a retry of the
 * same write is a no-op there. Nothing kept one id from landing in two of them: a write retried under the same id as
 * another kind (a «Una vez» purchase confirmed, then the same proposal confirmed in cuotas) would have recorded the
 * purchase twice. The create functions of storage refuse that with `assertWriteIdAvailable`, inside their transaction,
 * before the same-id idempotency check. Only new writes are checked: reading an archive or a backup never is, so data
 * already stored stays readable whatever it holds. */
export type LedgerWriteKind = 'entry' | 'transfer' | 'plan' | 'operation';

export const WRITE_ID_TAKEN_MESSAGE = 'Este identificador ya corresponde a otro tipo de registro. No se modificó nada.';

/** The kinds of write that already own `id` in this archive, in a fixed order (empty when none does). An operation owns
 * its own id and the ids of the lines it projects. */
export function ledgerIdOwners(archive: Pick<LedgerArchive, 'records' | 'transfers' | 'installmentPlans' | 'purchaseOperations'>, id: string): LedgerWriteKind[] {
  const owners: LedgerWriteKind[] = [];
  if (archive.records.some(record => record.entry.id === id)) owners.push('entry');
  if ((archive.transfers ?? []).some(record => record.transfer.id === id)) owners.push('transfer');
  if ((archive.installmentPlans ?? []).some(plan => plan.id === id)) owners.push('plan');
  if ((archive.purchaseOperations ?? []).some(operation => operation.id === id || operationLineIds(operation).includes(id))) owners.push('operation');
  return owners;
}

/** Refuses a new write of `kind` whose id another kind already owns. The same kind owning it is the caller's idempotency
 * question (a retry, or other data under the same id), answered by its own check. */
export function assertWriteIdAvailable(archive: Pick<LedgerArchive, 'records' | 'transfers' | 'installmentPlans' | 'purchaseOperations'>, id: string, kind: LedgerWriteKind): void {
  if (ledgerIdOwners(archive, id).some(owner => owner !== kind)) throw new Error(WRITE_ID_TAKEN_MESSAGE);
}
