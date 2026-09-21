import { describe, expect, it } from 'vitest';
import { accountBalanceMinor, createPilotBackup, totalsByCurrency, type Account, type Entry } from './ledger';
import { archiveKey, BACKUP_MAX_BYTES, createRecoveryBackup, initialRecord, makeEntryChange, parsePilotBackup, previewBackupImport,
  sameRecord, snapshotFromArchive, validateArchive, validateEntryChange, type LedgerArchive } from './recovery';
import { initialTransferRecord } from './transfers';
import type { CreditCardProfile, PersonalDebtProfile } from './liabilities';
import type { MonthlyBudget } from './budgets';
import { makeAccountAppearance } from './appearance';
import { editedCategoryDefinition, newCategoryDefinition, resolveCategory } from './categories';

const account: Account = { id: 'a', name: 'Prueba', currency: 'ARS', openingMinor: 100000, createdAt: '2026-09-11T12:00:00Z' };
const entry: Entry = { id: 'e', accountId: 'a', kind: 'expense', amountMinor: 101, merchant: 'Prueba', category: 'Prueba', dateISO: '2026-09-11', createdAt: account.createdAt };
const archive: LedgerArchive = { accounts: [account], records: [initialRecord(entry)] };
const time = '2026-09-13T12:00:00Z';
const empty = { accounts: [], records: [] };
const cardAccount: Account = { id: 'card-acc', name: 'Visa', currency: 'ARS', openingMinor: -5000, createdAt: account.createdAt };
const debtAccount: Account = { id: 'debt-acc', name: 'Debo \u00B7 Juan', currency: 'ARS', openingMinor: -7000, createdAt: account.createdAt };
const card: CreditCardProfile = { id: 'card', accountId: cardAccount.id, issuer: 'Banco', last4: '1234', creditLimitMinor: 100000,
  closingDay: 28, dueDay: 5, active: true, createdAt: account.createdAt, revision: 0, updatedAt: account.createdAt };
const debt: PersonalDebtProfile = { id: 'debt', accountId: debtAccount.id, direction: 'owed_by_me', counterparty: 'Juan', dueDateISO: null,
  note: '', active: true, createdAt: account.createdAt, revision: 0, updatedAt: account.createdAt };
const liabilities: LedgerArchive = { accounts: [account, cardAccount, debtAccount],
  records: [initialRecord(entry), initialRecord({ ...entry, id: 'purchase', accountId: cardAccount.id, amountMinor: 2000 })],
  transfers: [initialTransferRecord({ id: 't', fromAccountId: account.id, toAccountId: cardAccount.id, amountMinor: 1000, note: 'Pago', dateISO: entry.dateISO, createdAt: account.createdAt })],
  cards: [card], debts: [debt] };

describe('native edit and recovery domain', () => {
  it('roundtrips v1 and current backup without changing a source record', () => {
    expect(parsePilotBackup(JSON.stringify(createPilotBackup(snapshotFromArchive(archive)))).archive).toEqual(archive);
    const restored = parsePilotBackup('\uFEFF' + JSON.stringify(createRecoveryBackup(archive)));
    expect(restored.archive).toEqual(archive);
    expect(archive.records[0].revision).toBe(0);
  });
  it('v7 backups carry scoped budgets; v6 and v5 files still restore, and their budgets become category budgets', () => {
    const backup = createRecoveryBackup(liabilities);
    expect(backup.schema).toBe('finanzapp.native-pilot.v8');
    expect(parsePilotBackup(JSON.stringify(backup)).archive).toEqual(liabilities);
    const total: MonthlyBudget = { id: 'total', scope: 'total', currency: 'ARS', monthISO: '2026-09', amountMinor: 500000, active: true, createdAt: account.createdAt, revision: 0, updatedAt: account.createdAt };
    const food: MonthlyBudget = { id: 'food', scope: 'category', category: 'Comida', currency: 'ARS', monthISO: '2026-09', amountMinor: 150000, active: true, createdAt: account.createdAt, revision: 0, updatedAt: account.createdAt };
    const budgeted: LedgerArchive = { ...archive, budgets: [food, total] }; // canonical order is by id
    const v7 = createRecoveryBackup(budgeted);
    expect(Object.fromEntries(v7.budgets.map(budget => [budget.id, Object.keys(budget).includes('category')]))).toEqual({ total: false, food: true });
    expect(parsePilotBackup(JSON.stringify(v7)).archive).toEqual(budgeted);
    // A v6 file has budgets without scope: they are category budgets, read exactly as written.
    const { scope: _scope, ...legacyFood } = food;
    const { appearances: _a6, categories: _c6, ...v7Shape } = createRecoveryBackup(archive);
    const v6 = { ...v7Shape, schema: 'finanzapp.native-pilot.v6', budgets: [legacyFood] };
    expect(parsePilotBackup(JSON.stringify(v6)).archive.budgets).toEqual([food]);
    // A v6 file cannot smuggle scoped or total budgets, and a total never carries a category.
    expect(() => parsePilotBackup(JSON.stringify({ ...v6, budgets: [food] }))).toThrow();
    expect(() => parsePilotBackup(JSON.stringify({ ...v6, budgets: [{ ...legacyFood, scope: 'total' }] }))).toThrow();
    expect(() => parsePilotBackup(JSON.stringify({ ...v7, budgets: [{ ...total, category: 'General' }] }))).toThrow();
    expect(() => parsePilotBackup(JSON.stringify({ ...v7, budgets: [total, { ...total, id: 'again' }] }))).toThrow(/general activo/);
    const v5 = { ...v7Shape, schema: 'finanzapp.native-pilot.v5' } as Record<string, unknown>;
    delete v5.cards; delete v5.debts;
    expect(parsePilotBackup(JSON.stringify(v5)).archive).toEqual(archive);
    expect(() => parsePilotBackup(JSON.stringify({ ...v5, cards: [] }))).toThrow();
  });
  it('previews import totals as liquid money and detects card/debt conflicts', () => {
    const plan = previewBackupImport(empty, liabilities);
    expect(plan.cards).toEqual([card]);
    expect(plan.debts).toEqual([debt]);
    expect(plan.after).toEqual({ ARS: 100000 - 101 - 1000 });
    expect(previewBackupImport(liabilities, { ...liabilities, cards: [{ ...card, creditLimitMinor: 1, revision: 1, updatedAt: time }] }).conflicts).toBe(1);
    expect(previewBackupImport(liabilities, liabilities)).toMatchObject({ identical: 5, conflicts: 0, cards: [], debts: [] });
    expect(() => validateArchive({ ...liabilities, debts: [{ ...debt, accountId: cardAccount.id }] })).toThrow(/dos obligaciones/);
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

  it('v8 backups round-trip account looks and category definitions; v7 files restore without them', () => {
    const look = makeAccountAppearance(account.id, 'bank', 'azure', time);
    const kiosco = newCategoryDefinition('expense', 'Kiosco', 'cafe', 'ochre', time);
    const renamed = editedCategoryDefinition(resolveCategory('expense', 'Comida'), { label: 'Alimentaci\u00f3n' }, time);
    const dressed: LedgerArchive = { ...archive, appearances: [look], categories: [renamed, kiosco] };
    const v8 = createRecoveryBackup(dressed);
    expect(v8.schema).toBe('finanzapp.native-pilot.v8');
    expect(v8.appearances).toEqual([look]);
    expect(v8.categories.map(item => item.key)).toEqual(['comida', 'kiosco']);
    expect(parsePilotBackup(JSON.stringify(v8)).archive).toEqual(dressed);
    // Every financial array is byte-identical to the v7 export of the same ledger.
    const { appearances: _a, categories: _c, schema: _s, exportedAt: _e, ...rest } = v8;
    const { appearances: _a2, categories: _c2, schema: _s2, exportedAt: _e2, ...plain } = createRecoveryBackup(archive);
    expect(rest).toEqual(plain);
    // A v7 file has neither array: it restores exactly as before, and cannot carry them.
    const v7 = { ...rest, exportedAt: v8.exportedAt, schema: 'finanzapp.native-pilot.v7' };
    expect(parsePilotBackup(JSON.stringify(v7)).archive).toEqual(archive);
    expect(() => parsePilotBackup(JSON.stringify({ ...v7, appearances: [look] }))).toThrow();
    // A v8 file must carry both arrays, and every row is validated.
    expect(() => parsePilotBackup(JSON.stringify({ ...v8, categories: undefined }))).toThrow();
    expect(() => parsePilotBackup(JSON.stringify({ ...v8, appearances: [{ ...look, icon: 'rocket' }] }))).toThrow(/\u00edcono/);
    expect(() => parsePilotBackup(JSON.stringify({ ...v8, appearances: [{ ...look, color: '#FF00FF' }] }))).toThrow(/color/);
    expect(() => parsePilotBackup(JSON.stringify({ ...v8, appearances: [{ ...look, accountId: 'ghost' }] }))).toThrow(/cuenta existente/);
    expect(() => parsePilotBackup(JSON.stringify({ ...v8, appearances: [look, { ...look, color: 'rose' }] }))).toThrow(/repite/);
    expect(() => parsePilotBackup(JSON.stringify({ ...v8, appearances: [{ ...look, openingMinor: 5 }] }))).toThrow(/campos/);
    expect(() => parsePilotBackup(JSON.stringify({ ...v8, categories: [{ ...kiosco, key: 'otra' }] }))).toThrow(/identidad/);
    expect(() => parsePilotBackup(JSON.stringify({ ...v8, categories: [kiosco, { ...kiosco, label: 'Bar' }] }))).toThrow(/repite/);
  });
  it('imports identity rows additively by what they decorate and reports conflicts', () => {
    const look = makeAccountAppearance(account.id, 'bank', 'azure', time);
    const kiosco = newCategoryDefinition('expense', 'Kiosco', 'cafe', 'ochre', time);
    const incoming: LedgerArchive = { ...archive, appearances: [look], categories: [kiosco] };
    const plan = previewBackupImport(archive, incoming);
    expect(plan.appearances).toEqual([look]);
    expect(plan.categories).toEqual([kiosco]);
    expect(plan.conflicts).toBe(0);
    expect(plan.after).toEqual(plan.before);
    const same = previewBackupImport(incoming, incoming);
    expect(same.appearances).toEqual([]);
    expect(same.categories).toEqual([]);
    expect(same.identical).toBe(3);
    // A different look for the same account, or a different definition for the same identity, is a conflict, never an overwrite.
    expect(previewBackupImport(incoming, { ...archive, appearances: [{ ...look, color: 'rose' }] }).conflicts).toBe(1);
    expect(previewBackupImport(incoming, { ...archive, categories: [{ ...kiosco, label: 'Bar' }] }).conflicts).toBe(1);
    // A look for an account the copy does not carry is invalid on its own.
    expect(() => previewBackupImport(archive, { accounts: [], records: [], appearances: [look] })).toThrow(/cuenta existente/);
  });
});
