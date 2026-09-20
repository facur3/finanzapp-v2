import { describe, expect, it } from 'vitest';
import { accountBalanceMinor, createPilotBackup, totalsByCurrency, validateTransfer, type Account, type Entry, type Transfer } from './ledger';
import { archiveKey, createRecoveryBackup, initialRecord, parsePilotBackup, previewBackupImport, snapshotFromArchive, validateArchive } from './recovery';
import { initialTransferRecord, makeTransferChange, validateTransferChange } from './transfers';
import { makeAccountChange, validateAccountChange } from './account-changes';
import { summarizeMonth } from './month-summary';

const time = '2026-09-13T12:00:00Z';
const a: Account = { id: 'a', name: 'Origen', currency: 'ARS', openingMinor: 10000, createdAt: time };
const b: Account = { ...a, id: 'b', name: 'Destino', openingMinor: 2000 };
const usd: Account = { ...b, id: 'usd', currency: 'USD' };
const t: Transfer = { id: 't', fromAccountId: 'a', toAccountId: 'b', amountMinor: 1234, note: '', dateISO: '2026-09-13', createdAt: time };
const e: Entry = { id: 'e', accountId: 'a', kind: 'expense', amountMinor: 100, category: 'Prueba', merchant: 'Prueba', dateISO: t.dateISO, createdAt: time };
const archive = { accounts: [a, b, usd], records: [initialRecord(e)], transfers: [initialTransferRecord(t)] };

describe('internal transfers and account corrections', () => {
  it('moves both legs exactly while preserving currency totals and spending reports', () => {
    const before = { accounts: [a, b, usd], entries: [e] };
    const after = snapshotFromArchive(archive);
    expect(accountBalanceMinor(a, after.entries, after.transfers)).toBe(8666);
    expect(accountBalanceMinor(b, after.entries, after.transfers)).toBe(3234);
    expect(totalsByCurrency(after)).toEqual(totalsByCurrency(before));
    expect(summarizeMonth(after, 'ARS', t.dateISO)).toEqual(summarizeMonth(before, 'ARS', t.dateISO));
  });
  it.each([{ amountMinor: 0 }, { amountMinor: -1 }, { amountMinor: 1.1 }, { amountMinor: Number.MAX_SAFE_INTEGER + 1 },
    { toAccountId: 'a' }, { fromAccountId: 'missing' }, { toAccountId: 'usd' }, { dateISO: '2026-02-30' }, { note: 'x'.repeat(121) }, { id: '' }])('rejects invalid transfer %#', patch => {
    expect(() => validateTransfer({ ...t, ...patch }, archive.accounts)).toThrow();
  });
  it('void and restore are reversible without generating entries', () => {
    const undone = makeTransferChange('undo', initialTransferRecord(t), 'void', time);
    validateTransferChange(undone, archive.accounts);
    expect(totalsByCurrency(snapshotFromArchive({ ...archive, transfers: [undone.after] }))).toEqual({ ARS: 11900, USD: 2000 });
    expect(snapshotFromArchive({ ...archive, transfers: [undone.after] }).transfers).toEqual([]);
    const restored = makeTransferChange('restore', undone.after, 'restore', time);
    validateTransferChange(restored, archive.accounts);
    expect(snapshotFromArchive({ ...archive, transfers: [restored.after] }).transfers).toEqual([t]);
  });
  it('editing cannot replace identity, timestamp, currency or bypass revision/tombstone rules', () => {
    const change = makeTransferChange('edit', initialTransferRecord(t), 'edit', time, { ...t, amountMinor: 200 });
    validateTransferChange(change, archive.accounts);
    for (const after of [{ ...change.after, revision: 0 }, { ...change.after, voided: true },
      { ...change.after, transfer: { ...t, id: 'other' } }, { ...change.after, transfer: { ...t, createdAt: '2026-01-01' } }]) {
      expect(() => validateTransferChange({ ...change, after }, archive.accounts)).toThrow();
    }
    expect(() => validateTransferChange(makeTransferChange('undo', initialTransferRecord(t), 'void', time, { ...t, amountMinor: 1 }), archive.accounts)).toThrow();
  });
  it('checks per-account overflow even though the currency total is unchanged', () => {
    const over = { accounts: [{ ...a, openingMinor: -Number.MAX_SAFE_INTEGER }, b], records: [], transfers: [initialTransferRecord(t)] };
    expect(() => validateArchive(over)).toThrow(/rango seguro/);
  });
  it('corrects current balance through opening balance, without modifying entries/transfers', () => {
    const snapshot = snapshotFromArchive(archive);
    const change = makeAccountChange('edit', a, snapshot, ' Corregida ', 9000, time);
    validateAccountChange(change);
    expect(change.expectedBalanceMinor).toBe(8666);
    expect(change.after.openingMinor).toBe(10334);
    expect(change.after.name).toBe('Corregida');
    expect(accountBalanceMinor(change.after, snapshot.entries, snapshot.transfers)).toBe(9000);
    expect(snapshot.entries).toEqual([e]);
    expect(snapshot.transfers).toEqual([t]);
  });
  it('rename does not require a balance correction, while financial edits need a baseline', () => {
    const snapshot = snapshotFromArchive(archive);
    const change = makeAccountChange('name', a, snapshot, 'Nueva', 8666, time);
    expect(change.expectedBalanceMinor).toBeNull();
    expect(change.after.openingMinor).toBe(a.openingMinor);
    for (const after of [{ ...change.after, currency: 'USD' as const }, { ...change.after, id: 'other' },
      { ...change.after, openingMinor: 0 }, { ...change.after, revision: 0 }]) expect(() => validateAccountChange({ ...change, after })).toThrow();
  });
  it('current backup preserves corrected accounts, transfer revisions and tombstones', () => {
    const change = makeAccountChange('edit', a, snapshotFromArchive(archive), 'Nueva', 5000, time);
    const saved = { ...archive, accounts: [change.after, b, usd], transfers: [makeTransferChange('undo', initialTransferRecord(t), 'void', time).after] };
    const backup = createRecoveryBackup(saved);
    expect(backup.schema).toBe('finanzapp.native-pilot.v6');
    expect(parsePilotBackup(JSON.stringify(backup)).archive).toEqual(saved);
    expect(() => createPilotBackup(snapshotFromArchive(saved))).toThrow();
    const v2 = { ...createRecoveryBackup({ accounts: [a, b], records: [] }), schema: 'finanzapp.native-pilot.v2' };
    delete (v2 as any).transfers;
    delete (v2 as any).recurring;
    delete (v2 as any).budgets;
    delete (v2 as any).cards;
    delete (v2 as any).debts;
    expect(parsePilotBackup(JSON.stringify(v2)).archive).toEqual({ accounts: [a, b], records: [] });
  });
  it('preview includes transfers, refuses stale account metadata and prevents resurrection', () => {
    const empty = { accounts: [], records: [] };
    expect(previewBackupImport(empty, archive).transfers).toHaveLength(1);
    expect(previewBackupImport(archive, archive).identical).toBe(2);
    const saved = { ...archive, transfers: [makeTransferChange('undo', initialTransferRecord(t), 'void', time).after] };
    expect(previewBackupImport(saved, archive).conflicts).toBe(1);
    const changed = { ...archive, accounts: [{ ...a, revision: 2, updatedAt: time }, b, usd] };
    expect(previewBackupImport(changed, archive).conflicts).toBe(1);
    expect(archiveKey(changed)).not.toBe(archiveKey(archive));
  });
  it.each([(copy: any) => { copy.transfers.push(copy.transfers[0]); }, (copy: any) => { copy.transfers[0].revision = -1; },
    (copy: any) => { copy.transfers[0].transfer.amountMinor = '123'; }, (copy: any) => { copy.accounts[0].revision = 1; },
    (copy: any) => { delete copy.transfers; }, (copy: any) => { copy.transfers[0].transfer.fee = 1; }])('rejects corrupt current backups %#', corrupt => {
    const copy = createRecoveryBackup(archive); corrupt(copy);
    expect(() => parsePilotBackup(JSON.stringify(copy))).toThrow();
  });
});
