import { accountBalanceMinor, validateAccount, type Account, type LedgerSnapshot } from './ledger.ts';

export interface AccountChange { id: string; before: Account; after: Account; expectedBalanceMinor: number | null; }
export function makeAccountChange(id: string, before: Account, snapshot: LedgerSnapshot, name: string, targetBalanceMinor: number, now: string): AccountChange {
  if (!Number.isSafeInteger(targetBalanceMinor)) throw new Error('Saldo inválido.');
  const balance = accountBalanceMinor(before, snapshot.entries, snapshot.transfers);
  const opening = BigInt(before.openingMinor) + BigInt(targetBalanceMinor) - BigInt(balance);
  if (opening > BigInt(Number.MAX_SAFE_INTEGER) || opening < -BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('El ajuste supera el rango seguro.');
  return { id, before, expectedBalanceMinor: targetBalanceMinor === balance ? null : balance,
    after: { ...before, name: name.trim(), openingMinor: Number(opening), revision: (before.revision ?? 0) + 1, updatedAt: now } };
}
export function validateAccountChange(change: AccountChange): void {
  const { before, after, expectedBalanceMinor } = change;
  validateAccount(before);
  validateAccount(after);
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(change.id) || before.id !== after.id || before.currency !== after.currency
    || before.createdAt !== after.createdAt || after.revision !== (before.revision ?? 0) + 1
    || (expectedBalanceMinor !== null && !Number.isSafeInteger(expectedBalanceMinor))
    || (before.openingMinor !== after.openingMinor && expectedBalanceMinor === null)) throw new Error('La cuenta cambió. Volvé a abrirla.');
}
