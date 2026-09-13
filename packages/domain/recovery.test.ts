import { describe, expect, it } from 'vitest';
import { accountBalanceMinor, createPilotBackup, totalsByCurrency, type Account, type Entry } from './ledger';
import { archiveKey, BACKUP_MAX_BYTES, createRecoveryBackup, initialRecord, makeEntryChange, parsePilotBackup, previewBackupImport,
  sameRecord, snapshotFromArchive, validateArchive, validateEntryChange, type LedgerArchive } from './recovery';

const account: Account = { id: 'a', name: 'Prueba', currency: 'ARS', openingMinor: 100000, createdAt: '2026-09-11T12:00:00Z' };
const entry: Entry = { id: 'e', accountId: 'a', kind: 'expense', amountMinor: 101, merchant: 'Prueba', category: 'Prueba', dateISO: '2026-09-11', createdAt: account.createdAt };
const archive: LedgerArchive = { accounts: [account], records: [initialRecord(entry)] };
const time = '2026-09-13T12:00:00Z';
const empty = { accounts: [], records: [] };

describe('native edit and recovery domain', () => {
  it('roundtrips v1 and v2 without changing a source record', () => {
    expect(parsePilotBackup(JSON.stringify(createPilotBackup(snapshotFromArchive(archive)))).archive).toEqual(archive);
    const restored = parsePilotBackup('\uFEFF' + JSON.stringify(createRecoveryBackup(archive)));
    expect(restored.archive).toEqual(archive);
    expect(archive.records[0].revision).toBe(0);
  });
  it('preserves revisions and tombstones in a backup, but excludes undone entries from every balance/report', () => {
    const undo = makeEntryChange('undo', archive.records[0], 'void', time);
    validateEntryChange(undo, archive.accounts);
    const saved = { ...archive, records: [undo.after] };
    expect(parsePilotBackup(JSON.stringify(createRecoveryBackup(saved))).archive).toEqual(saved);
    expect(snapshotFromArchive(saved).entries).toEqual([]);
    expect(totalsByCurrency(snapshotFromArchive(saved))).toEqual({ ARS: 100000 });
  });
  it('only offers an additive plan; neither preview nor cancel mutates data', () => {
    const before = JSON.stringify(archive);
    const plan = previewBackupImport(empty, archive);
    expect(plan.accounts).toHaveLength(1);
    expect(plan.records).toHaveLength(1);
    expect(plan.before).toEqual({});
    expect(plan.after).toEqual({ ARS: 99899 });
    expect(JSON.stringify(archive)).toBe(before);
    expect(empty).toEqual({ accounts: [], records: [] });
  });
  it('recognizes identical imports regardless of JSON property/row order', () => {
    const reversed = JSON.parse(JSON.stringify(createRecoveryBackup(archive)), (_key, value) => value && !Array.isArray(value) && typeof value === 'object'
      ? Object.fromEntries(Object.entries(value).reverse()) : value);
    const incoming = parsePilotBackup(JSON.stringify(reversed)).archive;
    expect(archiveKey(incoming)).toBe(archiveKey(archive));
    expect(previewBackupImport(archive, incoming)).toMatchObject({ accounts: [], records: [], identical: 1, conflicts: 0 });
  });
  it('refuses changed accounts, edited movements and resurrection even when incoming revision is higher', () => {
    for (const incoming of [
      { ...archive, accounts: [{ ...account, openingMinor: 0 }] },
      { ...archive, records: [makeEntryChange('edit', archive.records[0], 'edit', time, { ...entry, amountMinor: 200 }).after] },
      { ...archive, records: [makeEntryChange('undo', archive.records[0], 'void', time).after] },
    ]) {
      expect(previewBackupImport(archive, incoming).conflicts).toBe(1);
      expect(previewBackupImport(incoming, archive).after).toBeNull();
    }
  });
  it.each(['not json', 'null', '[]', '{}', JSON.stringify({ schema: 'finanzapp.native-pilot.v9' }),
    JSON.stringify({ version: 1, transactions: [], investments: [] }), 'x'.repeat(BACKUP_MAX_BYTES + 1)])('rejects unsupported input (%#)', raw => {
    expect(() => parsePilotBackup(raw)).toThrow();
  });
  it.each([
    (b: any) => { b.records[0].entry.amountMinor = 1.5; },
    (b: any) => { b.records[0].entry.accountId = 'missing'; },
    (b: any) => { b.records[0].entry.dateISO = '2026-02-30'; },
    (b: any) => { b.records[0].revision = -1; },
    (b: any) => { b.records[0].voided = 1; },
    (b: any) => { b.records[0].voided = true; },
    (b: any) => { b.records[0].updatedAt = 'invalid'; },
    (b: any) => { b.accounts.push(b.accounts[0]); },
    (b: any) => { b.records.push(b.records[0]); },
    (b: any) => { b.accounts[0].currency = 'BTC'; },
    (b: any) => { b.moneyUnit = 'pesos'; },
    (b: any) => { b.app = 'Other'; },
    (b: any) => { b.records[0].entry.installments = 12; },
    (b: any) => { b.investments = []; },
    (b: any) => { b.records = [null]; },
    (b: any) => { b.accounts = [null]; },
    (b: any) => { b.exportedAt = null; },
  ])('validates every field and rejects mixed formats before a preview (%#)', corrupt => {
    const backup = createRecoveryBackup(archive);
    corrupt(backup);
    expect(() => parsePilotBackup(JSON.stringify(backup))).toThrow();
  });
  it('blocks overflow in a combined import even if each individual archive fits', () => {
    const current = { accounts: [{ ...account, openingMinor: Number.MAX_SAFE_INTEGER }], records: [] };
    const incoming = { accounts: [{ ...account, id: 'other', openingMinor: 1 }], records: [] };
    expect(() => previewBackupImport(current, incoming)).toThrow(/rango seguro/);
  });
  it('IDs named like object properties are treated as ordinary IDs', () => {
    const data = { accounts: [{ ...account, id: '__proto__' }], records: [initialRecord({ ...entry, id: 'constructor', accountId: '__proto__' })] };
    validateArchive(data);
    expect(previewBackupImport(empty, data).records).toHaveLength(1);
  });
  it('balances do not depend on insertion, backup or date-sorted read order', () => {
    const large = { ...account, openingMinor: -Number.MAX_SAFE_INTEGER };
    const positive = { ...entry, kind: 'income' as const, amountMinor: 1 };
    const negative = { ...entry, amountMinor: 1 };
    expect(accountBalanceMinor(large, [positive, negative])).toBe(-Number.MAX_SAFE_INTEGER);
    expect(accountBalanceMinor(large, [negative, positive])).toBe(-Number.MAX_SAFE_INTEGER);
    const accounts = [large, { ...account, id: 'b', openingMinor: -1 }, { ...account, id: 'c', openingMinor: 1 }];
    expect(totalsByCurrency({ accounts, entries: [] })).toEqual({ ARS: -Number.MAX_SAFE_INTEGER });
  });
  it('edits cannot replace identity, creation date, revision, currency or secretly void a record', () => {
    const good = makeEntryChange('edit', archive.records[0], 'edit', time, { ...entry, amountMinor: 99 });
    validateEntryChange(good, [account]);
    for (const after of [
      { ...good.after, entry: { ...entry, id: 'another' } },
      { ...good.after, entry: { ...entry, createdAt: time } },
      { ...good.after, revision: 0 }, { ...good.after, voided: true },
    ]) expect(() => validateEntryChange({ ...good, after }, [account])).toThrow();
    expect(sameRecord(good.before, good.after)).toBe(false);
  });
});
