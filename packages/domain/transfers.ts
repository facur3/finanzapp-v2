import { validateTransfer, type Account, type Transfer } from './ledger.ts';

export interface TransferRecord { transfer: Transfer; revision: number; voided: boolean; updatedAt: string; }
export interface TransferChange { id: string; action: 'edit' | 'void' | 'restore'; before: TransferRecord; after: TransferRecord; }
export const TRANSFER_KEYS = ['id', 'fromAccountId', 'toAccountId', 'amountMinor', 'note', 'dateISO', 'createdAt'] as const;
export function sameTransfer(a: Transfer, b: Transfer): boolean { return TRANSFER_KEYS.every(key => a[key] === b[key]); }
export function sameTransferRecord(a: TransferRecord, b: TransferRecord): boolean {
  return sameTransfer(a.transfer, b.transfer) && a.revision === b.revision && a.voided === b.voided && a.updatedAt === b.updatedAt;
}
export function initialTransferRecord(transfer: Transfer): TransferRecord {
  return { transfer, revision: 0, voided: false, updatedAt: transfer.createdAt };
}
export function validateTransferRecord(record: TransferRecord, accounts: Account[]): void {
  validateTransfer(record.transfer, accounts);
  if (!Number.isSafeInteger(record.revision) || record.revision < 0 || typeof record.voided !== 'boolean'
    || typeof record.updatedAt !== 'string' || !Number.isFinite(Date.parse(record.updatedAt))
    || (record.revision === 0 && (record.voided || record.updatedAt !== record.transfer.createdAt))) throw new Error('Versión de transferencia inválida.');
}
export function makeTransferChange(id: string, before: TransferRecord, action: TransferChange['action'], now: string, transfer = before.transfer): TransferChange {
  return { id, action, before, after: { transfer, revision: before.revision + 1, voided: action === 'void', updatedAt: now } };
}
export function validateTransferChange(change: TransferChange, accounts: Account[]): void {
  const { before, after, action } = change;
  validateTransferRecord(before, accounts);
  validateTransferRecord(after, accounts);
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(change.id) || !['edit', 'void', 'restore'].includes(action)
    || after.revision !== before.revision + 1 || before.transfer.id !== after.transfer.id || before.transfer.createdAt !== after.transfer.createdAt
    || before.voided !== (action === 'restore') || after.voided !== (action === 'void')
    || (action !== 'edit' && !sameTransfer(before.transfer, after.transfer))) throw new Error('La transferencia cambió. Volvé a abrirla.');
  if (accounts.find(a => a.id === before.transfer.fromAccountId)?.currency !== accounts.find(a => a.id === after.transfer.fromAccountId)?.currency) {
    throw new Error('Conservá la moneda original de la transferencia.');
  }
}
