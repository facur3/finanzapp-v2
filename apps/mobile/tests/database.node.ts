import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { accountBalanceMinor, archiveKey, createRecoveryBackup, initialRecord, makeEntryChange, parsePilotBackup, snapshotFromArchive, totalsByCurrency, type Account, type Entry,
  makeAccountChange, initialTransferRecord, makeTransferChange, type Transfer, type RecurringRule, type MonthlyBudget,
  cardDebtMinor, debtOutstandingMinor, liquidTotalsByCurrency, spendingOverview, type CreditCardProfile, type PersonalDebtProfile,
  makeAccountAppearance, accountLook, newCategoryDefinition, editedCategoryDefinition, resolveCategory, categoryOptions, spendingReport,
  summarizeMonthlyBudgets, type AccountAppearance } from '@finanzapp/domain';
import { changeEntry, createAccount, createEntry, importArchive, initializeDatabase, readArchive, readSnapshot, changeAccount,
  createTransfer, changeTransfer, saveRecurringRule, processRecurring, saveMonthlyBudget,
  createCreditCard, saveCreditCard, createPersonalDebt, savePersonalDebt, saveAccountAppearance, saveCategoryDefinition, DATABASE_VERSION, SCHEMA_SCRIPTS, type LedgerDatabase } from '../src/storage/database.ts';
import { MIGRATION_REFERENCES_MESSAGE, runExclusiveTransaction, runSchemaMigration, type TransactionConnection } from '../src/storage/transaction.ts';

// Synthetic records in disposable databases only. Nothing seeds a user's app.
const account: Account = { id: 'test-account', name: 'Test', currency: 'ARS', openingMinor: 100000,
  createdAt: '2026-09-11T12:00:00.000Z' };
const expense: Entry = { id: 'test-entry', accountId: account.id, kind: 'expense', amountMinor: 12345,
  merchant: 'Fixture', category: 'Fixture', dateISO: '2026-09-11', createdAt: account.createdAt };

function connection(path: string): TransactionConnection {
  const db = new DatabaseSync(path);
  // Node enables this by default. Start like an unconfigured native connection
  // so the transaction helper must really enable referential integrity.
  db.exec('PRAGMA foreign_keys = OFF');
  return {
    execAsync: async sql => { db.exec(sql); },
    runAsync: async (sql, ...params) => ({ changes: Number(db.prepare(sql).run(...params).changes) }),
    getFirstAsync: async <T>(sql: string, ...params: (string | number | null)[]) => {
      const row = db.prepare(sql).get(...params);
      return row ? { ...row } as T : null;
    },
    getAllAsync: async <T>(sql: string, ...params: (string | number | null)[]) =>
      db.prepare(sql).all(...params).map(row => ({ ...row })) as T[],
    closeAsync: async () => { db.close(); },
  };
}

const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => { for (const cleanup of cleanups.splice(0).reverse()) await cleanup(); });

function databaseAt(path: string): LedgerDatabase & { closeAsync(): Promise<void> } {
  const base = connection(path);
  let closed = false;
  const closeAsync = async () => { if (!closed) { closed = true; await base.closeAsync(); } };
  cleanups.push(closeAsync);
  return { ...base, closeAsync,
    withExclusiveTransactionAsync: work => runExclusiveTransaction(async () => connection(path), work),
    withMigrationTransactionAsync: work => runSchemaMigration(async () => connection(path), work) };
}

function setup() {
  const directory = mkdtempSync(join(tmpdir(), 'finanzapp-storage-'));
  cleanups.push(async () => { rmSync(directory, { recursive: true, force: true }); });
  const path = join(directory, 'ledger.sqlite');
  return { db: databaseAt(path), path };
}

test('new install is empty; initialization can repeat without deleting data', async () => {
  const { db } = setup();
  await initializeDatabase(db);
  assert.deepEqual(await readSnapshot(db), { accounts: [], entries: [] });
  assert.equal((await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version, DATABASE_VERSION);
  await createAccount(db, account);
  await initializeDatabase(db);
  assert.deepEqual((await readSnapshot(db)).accounts, [account]);
});

test('expense and income remain exact after closing and reopening the SQLite file', async () => {
  const { db, path } = setup();
  await initializeDatabase(db);
  await createAccount(db, account);
  await createEntry(db, expense);
  await createEntry(db, { ...expense, id: 'income', kind: 'income', amountMinor: 1 });
  await db.closeAsync();
  const reopened = databaseAt(path);
  await initializeDatabase(reopened);
  const saved = await readSnapshot(reopened);
  assert.equal(saved.entries.length, 2);
  assert.equal(accountBalanceMinor(saved.accounts[0], saved.entries), 87656);
});

test('retrying the same operation ID does not duplicate an account or debit', async () => {
  const { db } = setup();
  await initializeDatabase(db);
  await createAccount(db, account);
  await createAccount(db, account);
  await createEntry(db, expense);
  await createEntry(db, expense);
  const saved = await readSnapshot(db);
  assert.equal(saved.accounts.length, 1);
  assert.equal(saved.entries.length, 1);
  assert.equal(accountBalanceMinor(account, saved.entries), 87655);
  await assert.rejects(createAccount(db, { ...account, openingMinor: 20 }), /ya existe/);
  await assert.rejects(createEntry(db, { ...expense, amountMinor: 20 }), /ya existe/);
  assert.deepEqual(await readSnapshot(db), saved);
});

test('invalid account, amount and calendar date never post a movement', async () => {
  const { db } = setup();
  await initializeDatabase(db);
  await createAccount(db, account);
  for (const bad of [{ ...expense, accountId: 'missing' }, { ...expense, amountMinor: 0 },
    { ...expense, amountMinor: -1 }, { ...expense, amountMinor: 1.5 }, { ...expense, dateISO: '2026-02-30' }]) {
    await assert.rejects(createEntry(db, bad));
  }
  assert.deepEqual((await readSnapshot(db)).entries, []);
});

test('foreign key constraints are enabled on the dedicated transaction connection', async () => {
  const { db } = setup();
  await initializeDatabase(db);
  await assert.rejects(db.withExclusiveTransactionAsync(async tx => {
    assert.equal((await tx.getFirstAsync<{ foreign_keys: number }>('PRAGMA foreign_keys'))?.foreign_keys, 1);
    await tx.runAsync(`INSERT INTO entries (id, accountId, kind, amountMinor, merchant, category, dateISO, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      expense.id, 'missing', expense.kind, expense.amountMinor, expense.merchant,
      expense.category, expense.dateISO, expense.createdAt);
  }), /FOREIGN KEY constraint failed/);
  assert.equal((await readSnapshot(db)).entries.length, 0);
});

test('a failed transaction rolls back all earlier statements', async () => {
  const { db } = setup();
  await initializeDatabase(db);
  await assert.rejects(db.withExclusiveTransactionAsync(async tx => {
    await tx.runAsync('INSERT INTO accounts (id, name, currency, openingMinor, createdAt) VALUES (?, ?, ?, ?, ?)', account.id, account.name, account.currency, account.openingMinor, account.createdAt);
    throw new Error('Simulated interrupted operation');
  }), /interrupted/);
  assert.deepEqual(await readSnapshot(db), { accounts: [], entries: [] });
  await createAccount(db, account); // A failed transaction does not poison retry.
});

test('interrupted schema migration leaves neither partial tables nor a bumped version', async () => {
  const { db } = setup();
  const failing: LedgerDatabase = { ...db, withExclusiveTransactionAsync: work => db.withExclusiveTransactionAsync(tx => work({ ...tx,
    execAsync: async sql => { await tx.execAsync(sql); if (sql.includes('CREATE TABLE')) throw new Error('Interrupted migration'); },
  })) };
  await assert.rejects(initializeDatabase(failing), /Interrupted migration/);
  assert.equal((await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version, 0);
  assert.equal((await db.getAllAsync("SELECT name FROM sqlite_master WHERE type = 'table'")).length, 0);
  await initializeDatabase(db);
  assert.deepEqual(await readSnapshot(db), { accounts: [], entries: [] });
});

test('newer database schema is refused intact instead of reset or downgraded', async () => {
  const { db } = setup();
  await initializeDatabase(db);
  await createAccount(db, account);
  await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION + 1}`);
  await assert.rejects(initializeDatabase(db), /versión más nueva/);
  assert.equal((await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version, DATABASE_VERSION + 1);
  assert.deepEqual((await readSnapshot(db)).accounts, [account]);
});

test('an invalid stored date blocks reading balances and retains the original rows', async () => {
  const { db } = setup();
  await initializeDatabase(db);
  await createAccount(db, account);
  await db.runAsync('INSERT INTO entries (id, accountId, kind, amountMinor, merchant, category, dateISO, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', expense.id, account.id,
    expense.kind, expense.amountMinor, expense.merchant, expense.category, '2026-02-30', expense.createdAt);
  await assert.rejects(readSnapshot(db), /fecha válida/);
  await assert.rejects(initializeDatabase(db), /fecha válida/);
  assert.equal((await db.getAllAsync('SELECT id FROM entries')).length, 1);
});

test('overflow rejects the whole posting, and text uses bound parameters', async () => {
  const { db } = setup();
  await initializeDatabase(db);
  const named = { ...account, openingMinor: Number.MAX_SAFE_INTEGER, name: "Test'); DROP TABLE accounts; --" };
  await createAccount(db, named);
  await assert.rejects(createEntry(db, { ...expense, kind: 'income', amountMinor: 1 }), /rango seguro/);
  assert.deepEqual(await readSnapshot(db), { accounts: [named], entries: [] });
});

const changedAt = '2026-09-13T12:00:00.000Z';
async function funded() {
  const setupResult = setup();
  await initializeDatabase(setupResult.db);
  await createAccount(setupResult.db, account);
  await createEntry(setupResult.db, expense);
  return setupResult;
}

test('editing amount, account, kind and labels replaces one posting; retry keeps one audit record', async () => {
  const { db, path } = await funded();
  const second = { ...account, id: 'second', openingMinor: 5000 };
  await createAccount(db, second);
  const edit = makeEntryChange('edit', initialRecord(expense), 'edit', changedAt,
    { ...expense, accountId: second.id, amountMinor: 201, kind: 'income', merchant: 'Corregido', category: 'Otra', dateISO: '2026-08-31' });
  await changeEntry(db, edit);
  await changeEntry(db, edit);
  const snapshot = await readSnapshot(db);
  assert.equal(snapshot.entries.length, 1);
  assert.equal(accountBalanceMinor(account, snapshot.entries), 100000);
  assert.equal(accountBalanceMinor(second, snapshot.entries), 5201);
  assert.equal((await db.getAllAsync('SELECT id FROM entry_changes')).length, 1);
  await db.closeAsync();
  const reopened = databaseAt(path);
  await initializeDatabase(reopened);
  assert.deepEqual((await readArchive(reopened)).records, [edit.after]);
});

test('stale drafts, mutated operation IDs and cross-currency edits leave current data intact', async () => {
  const { db } = await funded();
  await createAccount(db, { ...account, id: 'usd', currency: 'USD' });
  const edit = makeEntryChange('edit', initialRecord(expense), 'edit', changedAt, { ...expense, amountMinor: 200 });
  await changeEntry(db, edit);
  const saved = await readArchive(db);
  await assert.rejects(changeEntry(db, { ...edit, id: 'stale' }), /cambió/);
  await assert.rejects(changeEntry(db, { ...edit, after: { ...edit.after, entry: { ...expense, amountMinor: 201 } } }), /ya existe/);
  await assert.rejects(changeEntry(db, makeEntryChange('usd-edit', edit.after, 'edit', changedAt, { ...edit.after.entry, accountId: 'usd' })), /misma moneda/);
  assert.deepEqual(await readArchive(db), saved);
});

test('undo is a persistent tombstone, not income; restoring it once re-applies the original posting', async () => {
  const { db, path } = await funded();
  const undo = makeEntryChange('undo', initialRecord(expense), 'void', changedAt);
  await changeEntry(db, undo);
  await changeEntry(db, undo);
  assert.equal((await readSnapshot(db)).entries.length, 0);
  assert.equal(accountBalanceMinor(account, (await readSnapshot(db)).entries), 100000);
  await assert.rejects(createEntry(db, expense), /ya existe/);
  await db.closeAsync();
  const reopened = databaseAt(path);
  await initializeDatabase(reopened);
  assert.equal((await readArchive(reopened)).records[0].voided, true);
  const restore = makeEntryChange('restore', undo.after, 'restore', changedAt);
  await changeEntry(reopened, restore);
  await changeEntry(reopened, restore);
  // A late retry of an earlier operation must not undo the subsequent restore.
  await changeEntry(reopened, undo);
  assert.deepEqual((await readSnapshot(reopened)).entries, [expense]);
  assert.equal((await reopened.getAllAsync('SELECT id FROM entry_changes')).length, 2);
});

test('failed audit write rolls back an edit and allows the exact command to retry', async () => {
  const { db } = await funded();
  const edit = makeEntryChange('edit', initialRecord(expense), 'edit', changedAt, { ...expense, amountMinor: 200 });
  const failing: LedgerDatabase = { ...db, withExclusiveTransactionAsync: work => db.withExclusiveTransactionAsync(tx => work({ ...tx,
    runAsync: async (sql, ...params) => { if (sql.includes('INSERT INTO entry_changes')) throw new Error('Disk failure'); return tx.runAsync(sql, ...params); },
  })) };
  await assert.rejects(changeEntry(failing, edit), /Disk failure/);
  assert.deepEqual((await readArchive(db)).records, [initialRecord(expense)]);
  assert.equal((await db.getAllAsync('SELECT id FROM entry_changes')).length, 0);
  await changeEntry(db, edit);
  assert.deepEqual((await readArchive(db)).records, [edit.after]);
});

test('undoing an income or restoring an expense checks safe balance range before changing state', async () => {
  const { db } = setup();
  await initializeDatabase(db);
  const large = { ...account, openingMinor: -Number.MAX_SAFE_INTEGER };
  await createAccount(db, large);
  const income = { ...expense, id: 'income', kind: 'income' as const, amountMinor: 1 };
  await createEntry(db, income);
  await createEntry(db, { ...expense, amountMinor: 1 });
  await assert.rejects(changeEntry(db, makeEntryChange('undo', initialRecord(income), 'void', changedAt)), /rango seguro/);
  assert.equal((await readSnapshot(db)).entries.length, 2);
});

test('current backup restores edited and undone entries into a new database and re-import never doubles balances', async () => {
  const { db } = await funded();
  await changeEntry(db, makeEntryChange('undo', initialRecord(expense), 'void', changedAt));
  await createEntry(db, { ...expense, id: 'active' });
  const original = await readArchive(db);
  const imported = parsePilotBackup(JSON.stringify(createRecoveryBackup(original))).archive;
  const other = setup().db;
  await initializeDatabase(other);
  const baseline = archiveKey(await readArchive(other));
  await importArchive(other, imported, baseline);
  await importArchive(other, imported, baseline); // Same frozen review after commit/refresh failure.
  assert.equal(archiveKey(await readArchive(other)), archiveKey(original));
  assert.deepEqual(totalsByCurrency(await readSnapshot(other)), totalsByCurrency(snapshotFromArchive(original)));
});

test('old backups cannot overwrite an edit or resurrect an undone entry, even with extra new rows', async () => {
  const { db } = await funded();
  const incoming = await readArchive(db);
  incoming.records.push(initialRecord({ ...expense, id: 'new-from-copy' }));
  const baseline = archiveKey(await readArchive(db));
  await changeEntry(db, makeEntryChange('undo', initialRecord(expense), 'void', changedAt));
  const saved = await readArchive(db);
  await assert.rejects(importArchive(db, incoming, baseline), /contradice/);
  assert.deepEqual(await readArchive(db), saved);
});

test('a new movement after preview requires another review before adding anything', async () => {
  const { db } = await funded();
  const baseline = archiveKey(await readArchive(db));
  const incoming = { accounts: [account], records: [initialRecord({ ...expense, id: 'imported' })] };
  await createEntry(db, { ...expense, id: 'local' });
  await assert.rejects(importArchive(db, incoming, baseline), /Volvé a revisar/);
  assert.equal((await readArchive(db)).records.length, 2);
  await importArchive(db, incoming, archiveKey(await readArchive(db)));
  assert.equal((await readArchive(db)).records.length, 3);
});

test('mid-import failure rolls back accounts AND movements; retry adds the full batch once', async () => {
  const { db } = setup();
  await initializeDatabase(db);
  const incoming = { accounts: [account], records: [initialRecord(expense), initialRecord({ ...expense, id: 'last' })] };
  const baseline = archiveKey(await readArchive(db));
  const failing: LedgerDatabase = { ...db, withExclusiveTransactionAsync: work => db.withExclusiveTransactionAsync(tx => work({ ...tx,
    runAsync: async (sql, ...params) => { if (params[0] === 'last') throw new Error('Interrupted import'); return tx.runAsync(sql, ...params); },
  })) };
  await assert.rejects(importArchive(failing, incoming, baseline), /Interrupted import/);
  assert.equal(archiveKey(await readArchive(db)), baseline);
  await importArchive(db, incoming, baseline);
  assert.equal((await readArchive(db)).records.length, 2);
});

test('migration from actual v1 records preserves cents; interruption rolls back ALTERs and can retry', async () => {
  const { db } = setup();
  await db.execAsync(`CREATE TABLE accounts (id TEXT PRIMARY KEY, name TEXT, currency TEXT, openingMinor INTEGER, createdAt TEXT) STRICT;
    CREATE TABLE entries (id TEXT PRIMARY KEY, accountId TEXT REFERENCES accounts(id), kind TEXT, amountMinor INTEGER,
      merchant TEXT, category TEXT, dateISO TEXT, createdAt TEXT) STRICT; PRAGMA user_version = 1;`);
  await db.runAsync('INSERT INTO accounts VALUES (?, ?, ?, ?, ?)', account.id, account.name, account.currency, account.openingMinor, account.createdAt);
  await db.runAsync('INSERT INTO entries VALUES (?, ?, ?, ?, ?, ?, ?, ?)', expense.id, expense.accountId, expense.kind,
    expense.amountMinor, expense.merchant, expense.category, expense.dateISO, expense.createdAt);
  const failing: LedgerDatabase = { ...db, withExclusiveTransactionAsync: work => db.withExclusiveTransactionAsync(tx => work({ ...tx,
    execAsync: async sql => { await tx.execAsync(sql); if (sql.includes('ALTER TABLE')) throw new Error('Interrupted upgrade'); },
  })) };
  await assert.rejects(initializeDatabase(failing), /Interrupted upgrade/);
  assert.equal((await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version, 1);
  assert.deepEqual(await db.getFirstAsync('SELECT * FROM entries'), expense);
  await initializeDatabase(db);
  await initializeDatabase(db);
  assert.deepEqual(await readSnapshot(db), { accounts: [account], entries: [expense] });
  assert.deepEqual((await readArchive(db)).records, [initialRecord(expense)]);
});

const secondAccount: Account = { ...account, id: 'destination', name: 'Destino', openingMinor: 0 };
const transfer: Transfer = { id: 'transfer', fromAccountId: account.id, toAccountId: secondAccount.id, amountMinor: 1000,
  note: 'Prueba', dateISO: expense.dateISO, createdAt: account.createdAt };
async function transferReady() {
  const result = await funded();
  await createAccount(result.db, secondAccount);
  return result;
}
test('a transfer persists both legs once after retry and restart without adding an income or expense', async () => {
  const { db, path } = await transferReady();
  await createTransfer(db, transfer);
  await createTransfer(db, transfer);
  await db.closeAsync();
  const reopened = databaseAt(path);
  await initializeDatabase(reopened);
  const saved = await readSnapshot(reopened);
  assert.equal(saved.entries.length, 1);
  assert.equal(saved.transfers!.length, 1);
  assert.equal(accountBalanceMinor(account, saved.entries, saved.transfers), 86655);
  assert.equal(accountBalanceMinor(secondAccount, saved.entries, saved.transfers), 1000);
  assert.deepEqual(totalsByCurrency(saved), { ARS: 87655 });
  await assert.rejects(createTransfer(reopened, { ...transfer, amountMinor: 2000 }), /ya existe/);
});
test('invalid transfer currency, missing destination and overflow leave both accounts unchanged', async () => {
  const { db } = await transferReady();
  await createAccount(db, { ...secondAccount, id: 'usd', currency: 'USD' });
  const before = await readArchive(db);
  for (const patch of [{ toAccountId: 'missing' }, { toAccountId: account.id }, { toAccountId: 'usd' }, { amountMinor: -1 }, { amountMinor: Number.MAX_SAFE_INTEGER + 1 }]) {
    await assert.rejects(createTransfer(db, { ...transfer, ...patch }));
    assert.deepEqual(await readArchive(db), before);
  }
});
test('editing, undoing and restoring a transfer is atomic and stale/late retries do not repeat either leg', async () => {
  const { db } = await transferReady();
  await createTransfer(db, transfer);
  const edit = makeTransferChange('edit-transfer', initialTransferRecord(transfer), 'edit', changedAt, { ...transfer, amountMinor: 2000 });
  await changeTransfer(db, edit);
  await changeTransfer(db, edit);
  await assert.rejects(changeTransfer(db, { ...edit, id: 'stale-transfer' }), /cambió/);
  const undo = makeTransferChange('undo-transfer', edit.after, 'void', changedAt);
  await changeTransfer(db, undo);
  assert.deepEqual((await readSnapshot(db)).transfers, []);
  await assert.rejects(createTransfer(db, transfer), /ya existe/);
  const restore = makeTransferChange('restore-transfer', undo.after, 'restore', changedAt);
  await changeTransfer(db, restore);
  await changeTransfer(db, undo);
  await changeTransfer(db, edit);
  assert.deepEqual((await readArchive(db)).transfers, [restore.after]);
  assert.equal((await db.getAllAsync('SELECT id FROM transfer_changes')).length, 3);
});
test('transfer audit failure rolls back its changed balance; exact retry succeeds', async () => {
  const { db } = await transferReady();
  await createTransfer(db, transfer);
  const undo = makeTransferChange('undo-transfer', initialTransferRecord(transfer), 'void', changedAt);
  const failing: LedgerDatabase = { ...db, withExclusiveTransactionAsync: work => db.withExclusiveTransactionAsync(tx => work({ ...tx,
    runAsync: async (sql, ...params) => { if (sql.includes('INSERT INTO transfer_changes')) throw new Error('Disk full'); return tx.runAsync(sql, ...params); },
  })) };
  const before = await readArchive(db);
  await assert.rejects(changeTransfer(failing, undo), /Disk full/);
  assert.deepEqual(await readArchive(db), before);
  await changeTransfer(db, undo);
  assert.deepEqual((await readSnapshot(db)).transfers, []);
});
test('correcting balance preserves entries/transfers and survives restart with one receipt', async () => {
  const { db, path } = await transferReady();
  await createTransfer(db, transfer);
  const snapshot = await readSnapshot(db);
  const change = makeAccountChange('correction', account, snapshot, 'Nombre corregido', 50000, changedAt);
  await changeAccount(db, change);
  await changeAccount(db, change);
  await db.closeAsync();
  const reopened = databaseAt(path);
  await initializeDatabase(reopened);
  const saved = await readSnapshot(reopened);
  assert.equal(accountBalanceMinor(saved.accounts.find(a => a.id === account.id)!, saved.entries, saved.transfers), 50000);
  assert.deepEqual(saved.entries, snapshot.entries);
  assert.deepEqual(saved.transfers, snapshot.transfers);
  assert.deepEqual(saved.accounts.find(a => a.id === account.id), change.after);
  assert.equal((await reopened.getAllAsync('SELECT id FROM account_changes')).length, 1);
});
test('a stale balance correction is rejected after a new transfer; a name-only edit preserves the new balance', async () => {
  const { db } = await transferReady();
  const snapshot = await readSnapshot(db);
  const correction = makeAccountChange('balance', account, snapshot, account.name, 100, changedAt);
  const rename = makeAccountChange('name', account, snapshot, 'Renombrada', accountBalanceMinor(account, snapshot.entries), changedAt);
  await createTransfer(db, transfer);
  await assert.rejects(changeAccount(db, correction), /saldo cambió/);
  await changeAccount(db, rename);
  const saved = await readSnapshot(db);
  assert.equal(accountBalanceMinor(saved.accounts.find(a => a.id === account.id)!, saved.entries, saved.transfers), 86655);
  const next = makeAccountChange('name-again', rename.after, saved, 'Otra', 86655, changedAt);
  await changeAccount(db, next);
  await changeAccount(db, rename); // Late receipt, not a name rollback.
  assert.equal((await readSnapshot(db)).accounts.find(a => a.id === account.id)!.name, 'Otra');
  await assert.rejects(changeAccount(db, { ...rename, id: 'stale-name' }), /cambió/);
});
test('account audit failure rolls back its correction and can retry; altered receipt IDs cannot overwrite', async () => {
  const { db } = await funded();
  const change = makeAccountChange('balance', account, await readSnapshot(db), account.name, 1000, changedAt);
  const failing: LedgerDatabase = { ...db, withExclusiveTransactionAsync: work => db.withExclusiveTransactionAsync(tx => work({ ...tx,
    runAsync: async (sql, ...params) => { if (sql.includes('INSERT INTO account_changes')) throw new Error('Disk full'); return tx.runAsync(sql, ...params); },
  })) };
  await assert.rejects(changeAccount(failing, change), /Disk full/);
  assert.deepEqual((await readSnapshot(db)).accounts, [account]);
  await changeAccount(db, change);
  await assert.rejects(changeAccount(db, { ...change, after: { ...change.after, name: 'Alterada' } }), /ya existe/);
  assert.deepEqual((await readSnapshot(db)).accounts, [change.after]);
});
test('v3 import is atomic across accounts, entries and transfers, and preserves tombstones and corrections', async () => {
  const { db } = await transferReady();
  await createTransfer(db, transfer);
  await changeTransfer(db, makeTransferChange('undo', initialTransferRecord(transfer), 'void', changedAt));
  await changeAccount(db, makeAccountChange('correct', account, await readSnapshot(db), 'Corregida', 1000, changedAt));
  const incoming = parsePilotBackup(JSON.stringify(createRecoveryBackup(await readArchive(db)))).archive;
  const other = setup().db;
  await initializeDatabase(other);
  const baseline = archiveKey(await readArchive(other));
  const failing: LedgerDatabase = { ...other, withExclusiveTransactionAsync: work => other.withExclusiveTransactionAsync(tx => work({ ...tx,
    runAsync: async (sql, ...params) => { if (sql.includes('INSERT INTO transfers')) throw new Error('Interrupted transfer import'); return tx.runAsync(sql, ...params); },
  })) };
  await assert.rejects(importArchive(failing, incoming, baseline), /Interrupted/);
  assert.equal(archiveKey(await readArchive(other)), baseline);
  await importArchive(other, incoming, baseline);
  await importArchive(other, incoming, baseline);
  assert.equal(archiveKey(await readArchive(other)), archiveKey(incoming));
  assert.deepEqual((await readSnapshot(other)).transfers, []);
});
test('actual v2 database upgrades atomically and preserves entry revisions and audit history', async () => {
  const { db } = setup();
  await db.execAsync(`CREATE TABLE accounts (id TEXT PRIMARY KEY, name TEXT, currency TEXT, openingMinor INTEGER, createdAt TEXT) STRICT;
    CREATE TABLE entries (id TEXT PRIMARY KEY, accountId TEXT REFERENCES accounts(id), kind TEXT, amountMinor INTEGER,
      merchant TEXT, category TEXT, dateISO TEXT, createdAt TEXT, revision INTEGER, voided INTEGER, updatedAt TEXT) STRICT;
    CREATE TABLE entry_changes (id TEXT PRIMARY KEY, entryId TEXT REFERENCES entries(id), action TEXT, beforeJSON TEXT, afterJSON TEXT) STRICT;
    PRAGMA user_version = 2;`);
  await db.runAsync('INSERT INTO accounts VALUES (?, ?, ?, ?, ?)', account.id, account.name, account.currency, account.openingMinor, account.createdAt);
  const undo = makeEntryChange('undo', initialRecord(expense), 'void', changedAt);
  await db.runAsync('INSERT INTO entries VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', expense.id, account.id, expense.kind, expense.amountMinor,
    expense.merchant, expense.category, expense.dateISO, expense.createdAt, 1, 1, changedAt);
  await db.runAsync('INSERT INTO entry_changes VALUES (?, ?, ?, ?, ?)', undo.id, expense.id, 'void', JSON.stringify(undo.before), JSON.stringify(undo.after));
  const failing: LedgerDatabase = { ...db, withExclusiveTransactionAsync: work => db.withExclusiveTransactionAsync(tx => work({ ...tx,
    execAsync: async sql => { await tx.execAsync(sql); if (sql.includes('ALTER TABLE accounts')) throw new Error('Interrupted v3'); },
  })) };
  await assert.rejects(initializeDatabase(failing), /Interrupted v3/);
  assert.equal((await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version, 2);
  assert.deepEqual(await db.getFirstAsync('SELECT * FROM accounts'), account);
  await initializeDatabase(db);
  assert.deepEqual((await readArchive(db)).records, [undo.after]);
  await changeEntry(db, undo); // Existing v2 receipt still recognizes a retry.
  assert.equal((await db.getAllAsync('SELECT id FROM entry_changes')).length, 1);
});


const recurring: RecurringRule = {
  id: 'recurring-rent',
  accountId: account.id,
  kind: 'expense',
  amountMinor: 5000,
  merchant: 'Alquiler',
  category: 'Vivienda',
  frequency: 'monthly',
  anchorDateISO: '2026-01-31',
  nextDateISO: '2026-01-31',
  active: true,
  createdAt: '2026-01-01T12:00:00.000Z',
  revision: 0,
  updatedAt: '2026-01-01T12:00:00.000Z',
};

test('v3 database upgrades through recurring and budget schemas without changing existing balances', async () => {
  const { db } = await transferReady();
  await createTransfer(db, transfer);
  const before = await readSnapshot(db);
  await db.execAsync('PRAGMA user_version = 3; DROP TABLE IF EXISTS currency_units; DROP TABLE IF EXISTS account_appearances; DROP TABLE IF EXISTS category_definitions; DROP TABLE IF EXISTS recurring_rules; DROP TABLE IF EXISTS monthly_budgets; DROP TABLE IF EXISTS credit_cards; DROP TABLE IF EXISTS personal_debts;');
  await initializeDatabase(db);
  assert.equal((await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version, DATABASE_VERSION);
  assert.deepEqual(await readSnapshot(db), before);
  assert.deepEqual((await readArchive(db)).recurring ?? [], []);
  assert.deepEqual((await readArchive(db)).budgets ?? [], []);
});

test('recurring catch-up posts each due date once and retry/restart never double debits', async () => {
  const { db, path } = setup();
  await initializeDatabase(db);
  await createAccount(db, account);
  await saveRecurringRule(db, recurring);
  assert.equal(await processRecurring(db, '2026-03-31', '2026-04-01T00:00:00.000Z'), 3);
  assert.equal(await processRecurring(db, '2026-03-31', '2026-04-01T00:00:01.000Z'), 0);
  let archive = await readArchive(db);
  assert.deepEqual(archive.records.map(record => record.entry.dateISO).sort(), ['2026-01-31', '2026-02-28', '2026-03-31']);
  assert.equal(archive.recurring![0].nextDateISO, '2026-04-30');
  assert.equal(accountBalanceMinor(account, snapshotFromArchive(archive).entries), 85000);

  await db.closeAsync();
  const reopened = databaseAt(path);
  await initializeDatabase(reopened);
  assert.equal(await processRecurring(reopened, '2026-03-31'), 0);
  archive = await readArchive(reopened);
  assert.equal(archive.records.length, 3);
  assert.equal(accountBalanceMinor(account, snapshotFromArchive(archive).entries), 85000);
});

test('recurring posting and schedule advance roll back together on disk failure', async () => {
  const { db } = setup();
  await initializeDatabase(db);
  await createAccount(db, account);
  await saveRecurringRule(db, recurring);
  const before = await readArchive(db);
  const failing: LedgerDatabase = { ...db, withExclusiveTransactionAsync: work => db.withExclusiveTransactionAsync(tx => work({ ...tx,
    runAsync: async (sql, ...params) => {
      if (sql.startsWith('UPDATE recurring_rules')) throw new Error('Disk full after posting');
      return tx.runAsync(sql, ...params);
    },
  })) };
  await assert.rejects(processRecurring(failing, '2026-01-31'), /Disk full/);
  assert.equal(archiveKey(await readArchive(db)), archiveKey(before));
  assert.equal(await processRecurring(db, '2026-01-31'), 1);
});

test('pausing preserves history and reactivation can safely skip paused dates before catch-up', async () => {
  const { db } = setup();
  await initializeDatabase(db);
  await createAccount(db, account);
  await saveRecurringRule(db, recurring);
  await processRecurring(db, '2026-01-31');
  const saved = (await readArchive(db)).recurring![0];
  const paused = { ...saved, active: false, revision: saved.revision + 1, updatedAt: '2026-02-01T00:00:00.000Z' };
  await saveRecurringRule(db, paused);
  assert.equal(await processRecurring(db, '2026-03-31'), 0);
  assert.equal((await readSnapshot(db)).entries.length, 1);
});

test('current backup roundtrip and additive import preserve recurring rules without duplicate generated entries', async () => {
  const { db } = setup();
  await initializeDatabase(db);
  await createAccount(db, account);
  await saveRecurringRule(db, recurring);
  await processRecurring(db, '2026-01-31');
  const original = await readArchive(db);
  const incoming = parsePilotBackup(JSON.stringify(createRecoveryBackup(original))).archive;
  assert.deepEqual(incoming.recurring, original.recurring);

  const other = setup().db;
  await initializeDatabase(other);
  const baseline = archiveKey(await readArchive(other));
  await importArchive(other, incoming, baseline);
  await importArchive(other, incoming, baseline);
  assert.equal(archiveKey(await readArchive(other)), archiveKey(incoming));
  assert.equal(await processRecurring(other, '2026-01-31'), 0);
  assert.equal((await readSnapshot(other)).entries.length, 1);
});


const monthlyBudget: MonthlyBudget = {
  id: 'budget-fixture',
  scope: 'category',
  category: 'Fixture',
  currency: 'ARS',
  monthISO: '2026-09',
  amountMinor: 20000,
  active: true,
  createdAt: '2026-09-01T12:00:00.000Z',
  revision: 0,
  updatedAt: '2026-09-01T12:00:00.000Z',
};

test('schema 4 upgrades to budget schema 5 without changing recurring rules or balances', async () => {
  const { db } = setup();
  await initializeDatabase(db);
  await createAccount(db, account);
  await saveRecurringRule(db, recurring);
  const before = await readArchive(db);
  await db.execAsync('DROP TABLE IF EXISTS currency_units; DROP TABLE IF EXISTS account_appearances; DROP TABLE IF EXISTS category_definitions; DROP TABLE monthly_budgets; DROP TABLE credit_cards; DROP TABLE personal_debts; PRAGMA user_version = 4;');
  await initializeDatabase(db);
  const after = await readArchive(db);
  assert.equal((await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version, DATABASE_VERSION);
  assert.deepEqual(after.accounts, before.accounts);
  assert.deepEqual(after.records, before.records);
  assert.deepEqual(after.recurring, before.recurring);
  assert.deepEqual(after.budgets ?? [], []);
});

test('monthly budget create/edit/archive is retry-safe and never changes account balances', async () => {
  const { db, path } = await funded();
  const beforeBalance = accountBalanceMinor(account, (await readSnapshot(db)).entries);
  await saveMonthlyBudget(db, monthlyBudget);
  await saveMonthlyBudget(db, monthlyBudget);
  let archive = await readArchive(db);
  assert.deepEqual(archive.budgets, [monthlyBudget]);
  assert.equal(accountBalanceMinor(account, (await readSnapshot(db)).entries), beforeBalance);

  const edited: MonthlyBudget = { ...monthlyBudget, amountMinor: 25000, revision: 1, updatedAt: changedAt };
  await saveMonthlyBudget(db, edited);
  await saveMonthlyBudget(db, edited);
  archive = await readArchive(db);
  assert.deepEqual(archive.budgets, [edited]);

  await db.closeAsync();
  const reopened = databaseAt(path);
  await initializeDatabase(reopened);
  assert.deepEqual((await readArchive(reopened)).budgets, [edited]);

  const archived: MonthlyBudget = { ...edited, active: false, revision: 2, updatedAt: '2026-09-14T12:00:00.000Z' };
  await saveMonthlyBudget(reopened, archived);
  await saveMonthlyBudget(reopened, archived);
  assert.deepEqual((await readArchive(reopened)).budgets, [archived]);
  assert.equal(accountBalanceMinor(account, (await readSnapshot(reopened)).entries), beforeBalance);
});

test('duplicate active budget identity, stale revision and cross-currency edit are rejected intact', async () => {
  const { db } = setup();
  await initializeDatabase(db);
  await createAccount(db, account);
  await saveMonthlyBudget(db, monthlyBudget);
  const before = await readArchive(db);
  await assert.rejects(saveMonthlyBudget(db, { ...monthlyBudget, id: 'duplicate-budget', category: ' fÍxture ' }), /Ya existe/);
  await assert.rejects(saveMonthlyBudget(db, { ...monthlyBudget, amountMinor: 30000, revision: 0 }), /cambió/);
  await assert.rejects(saveMonthlyBudget(db, { ...monthlyBudget, currency: 'USD', revision: 1, updatedAt: changedAt }), /cambiar la moneda/);
  assert.equal(archiveKey(await readArchive(db)), archiveKey(before));
});

test('23.1C2: a second active budget is refused with the domain sentence, which reads in English for an English interface', async () => {
  const { bindLocale } = await import('../src/i18n/bind.ts');
  const { db } = setup();
  await initializeDatabase(db);
  await createAccount(db, account);
  const overall: MonthlyBudget = { ...monthlyBudget, id: 'overall', scope: 'total', category: undefined, amountMinor: 50000 };
  await saveMonthlyBudget(db, monthlyBudget);
  await saveMonthlyBudget(db, overall);
  const before = await readArchive(db);
  const refusal = async (budget: MonthlyBudget) => { try { await saveMonthlyBudget(db, budget); } catch (cause) { return (cause as Error).message; } return ''; };
  const category = await refusal({ ...monthlyBudget, id: 'second-category', category: ' fÍxture ' });
  const general = await refusal({ ...overall, id: 'second-overall' });
  // The storage layer keeps the domain's Spanish; the form translates it when shown (ErrorMessage, errorText).
  assert.equal(category, 'Ya existe un presupuesto activo para esa categoría, moneda y mes.');
  assert.equal(general, 'Ya existe un presupuesto general activo para esa moneda y mes.');
  assert.equal(bindLocale('en-US').errorText(category), 'An active budget already exists for this category, currency and month.');
  assert.equal(bindLocale('en-AR').errorText(general), 'An active overall budget already exists for this currency and month.');
  assert.equal(bindLocale('es-US').errorText(category), category, 'Spanish shows the thrown sentence itself');
  assert.equal(bindLocale('es-AR').errorText(general), general);
  assert.equal(archiveKey(await readArchive(db)), archiveKey(before), 'nothing was written');
});

test('v5 backup/import preserves active and archived budgets without duplicating them', async () => {
  const { db } = setup();
  await initializeDatabase(db);
  await createAccount(db, account);
  await saveMonthlyBudget(db, monthlyBudget);
  const archived: MonthlyBudget = { ...monthlyBudget, active: false, revision: 1, updatedAt: changedAt };
  await saveMonthlyBudget(db, archived);
  const original = await readArchive(db);
  const backup = createRecoveryBackup(original);
  assert.equal(backup.schema, 'finanzapp.native-pilot.v8');
  const incoming = parsePilotBackup(JSON.stringify(backup)).archive;
  assert.deepEqual(incoming.budgets, [archived]);

  const other = setup().db;
  await initializeDatabase(other);
  const baseline = archiveKey(await readArchive(other));
  await importArchive(other, incoming, baseline);
  await importArchive(other, incoming, baseline);
  assert.equal(archiveKey(await readArchive(other)), archiveKey(incoming));
});


const totalBudget: MonthlyBudget = { id: 'total-fixture', scope: 'total', currency: 'ARS', monthISO: '2026-09', amountMinor: 500000, active: true,
  createdAt: '2026-09-01T12:00:00.000Z', revision: 0, updatedAt: '2026-09-01T12:00:00.000Z' };
const V6_BUDGETS_TABLE = `
  CREATE TABLE monthly_budgets (
    id TEXT PRIMARY KEY NOT NULL,
    category TEXT NOT NULL CHECK(length(trim(category)) BETWEEN 1 AND 60),
    currency TEXT NOT NULL CHECK(currency IN ('ARS', 'USD')),
    monthISO TEXT NOT NULL,
    amountMinor INTEGER NOT NULL CHECK(amountMinor > 0 AND amountMinor <= 9007199254740991),
    active INTEGER NOT NULL CHECK(active IN (0, 1)),
    createdAt TEXT NOT NULL,
    revision INTEGER NOT NULL DEFAULT 0 CHECK(revision >= 0 AND revision <= 9007199254740991),
    updatedAt TEXT NOT NULL
  ) STRICT;
  CREATE INDEX budgets_period ON monthly_budgets(currency, monthISO, active);`;

test('schema 6 upgrades to scoped budget schema 7: every old budget survives exactly as a category budget', async () => {
  const { db, path } = await funded();
  await saveRecurringRule(db, recurring);
  const before = await readArchive(db);
  // Rebuild the v6 table by hand and insert rows the old way (no scope column), including an archived one and an odd spelling.
  await db.execAsync('DROP TABLE IF EXISTS currency_units; DROP TABLE IF EXISTS account_appearances; DROP TABLE IF EXISTS category_definitions; DROP TABLE monthly_budgets;' + V6_BUDGETS_TABLE + " PRAGMA user_version = 6;");
  const legacy = [
    { ...monthlyBudget },
    { ...monthlyBudget, id: 'archived-fixture', category: ' fÍxture ', active: false, revision: 3, updatedAt: changedAt },
    { ...monthlyBudget, id: 'usd-fixture', category: 'Viajes', currency: 'USD' as const, amountMinor: 123456 },
  ];
  for (const row of legacy) {
    await db.runAsync('INSERT INTO monthly_budgets (id, category, currency, monthISO, amountMinor, active, createdAt, revision, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      row.id, row.category!, row.currency, row.monthISO, row.amountMinor, row.active ? 1 : 0, row.createdAt, row.revision, row.updatedAt);
  }
  // An interrupted migration leaves the v6 table, its rows and the version untouched.
  const failing: LedgerDatabase = { ...db, withExclusiveTransactionAsync: work => db.withExclusiveTransactionAsync(tx => work({ ...tx,
    execAsync: async sql => { await tx.execAsync(sql); if (sql.includes('monthly_budgets_v7')) throw new Error('Interrupted v7'); },
  })) };
  await assert.rejects(initializeDatabase(failing), /Interrupted v7/);
  assert.equal((await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version, 6);
  assert.equal((await db.getFirstAsync<{ n: number }>('SELECT count(*) AS n FROM monthly_budgets'))?.n, 3);
  await initializeDatabase(db);
  await initializeDatabase(db); // idempotent: a v7 file is not rebuilt again
  assert.equal((await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version, DATABASE_VERSION);
  const after = await readArchive(db);
  assert.deepEqual(after.accounts, before.accounts);
  assert.deepEqual(after.records, before.records);
  assert.deepEqual(after.recurring, before.recurring);
  const byId = Object.fromEntries((after.budgets ?? []).map(budget => [budget.id, budget]));
  for (const row of legacy) assert.deepEqual(byId[row.id], { ...row, scope: 'category' }, row.id + ' keeps id, category, month, currency, amount, state, revision and timestamps');
  assert.equal(Object.keys(byId).length, 3);
  // The rebuilt table enforces the scope rule: a total row cannot carry a category and a sublimit cannot lack one.
  await assert.rejects(db.runAsync("INSERT INTO monthly_budgets (id, scope, category, currency, monthISO, amountMinor, active, createdAt, revision, updatedAt) VALUES ('bad', 'total', 'General', 'ARS', '2026-09', 1, 1, '2026-09-01T12:00:00.000Z', 0, '2026-09-01T12:00:00.000Z')"));
  await assert.rejects(db.runAsync("INSERT INTO monthly_budgets (id, scope, category, currency, monthISO, amountMinor, active, createdAt, revision, updatedAt) VALUES ('bad', 'category', NULL, 'ARS', '2026-09', 1, 1, '2026-09-01T12:00:00.000Z', 0, '2026-09-01T12:00:00.000Z')"));
  await db.closeAsync();
  const reopened = databaseAt(path);
  await initializeDatabase(reopened);
  assert.equal(archiveKey(await readArchive(reopened)), archiveKey(after));
});

test('a total budget persists without a category, beside sublimits, once per currency and month, and never changes balances', async () => {
  const { db, path } = await funded();
  const beforeBalance = accountBalanceMinor(account, (await readSnapshot(db)).entries);
  await saveMonthlyBudget(db, totalBudget);
  await saveMonthlyBudget(db, totalBudget); // retry-safe
  await saveMonthlyBudget(db, monthlyBudget);
  let archive = await readArchive(db);
  assert.deepEqual(archive.budgets, [totalBudget, monthlyBudget], 'the total sorts before its month\'s sublimits');
  assert.equal(Object.hasOwn(archive.budgets![0], 'category'), false, 'no fake category on a total');
  assert.equal((await db.getFirstAsync<{ category: string | null; scope: string }>('SELECT category, scope FROM monthly_budgets WHERE id = ?', totalBudget.id))?.category, null);
  assert.equal(accountBalanceMinor(account, (await readSnapshot(db)).entries), beforeBalance);
  const before = archiveKey(archive);
  // A second active total for the same currency and month is refused; other months and currencies are fine.
  await assert.rejects(saveMonthlyBudget(db, { ...totalBudget, id: 'second-total' }), /general activo/);
  await assert.rejects(saveMonthlyBudget(db, { ...totalBudget, id: 'fake-category', category: 'General' } as unknown as MonthlyBudget), /no lleva categoría/);
  await assert.rejects(saveMonthlyBudget(db, { ...totalBudget, id: 'zero', amountMinor: 0 }), /mayor que cero/);
  await assert.rejects(saveMonthlyBudget(db, { ...totalBudget, id: 'negative', amountMinor: -1 }), /mayor que cero/);
  // Editing keeps identity: the kind cannot flip, a stale revision is refused, an amount edit is retry-safe.
  await assert.rejects(saveMonthlyBudget(db, { ...monthlyBudget, scope: 'total', category: undefined, revision: 1, updatedAt: changedAt } as MonthlyBudget), /general y por categoría/);
  await assert.rejects(saveMonthlyBudget(db, { ...totalBudget, amountMinor: 1, revision: 0 }), /cambió/);
  assert.equal(archiveKey(await readArchive(db)), before, 'nothing changed on rejection');
  await saveMonthlyBudget(db, { ...totalBudget, id: 'october', monthISO: '2026-10' });
  await saveMonthlyBudget(db, { ...totalBudget, id: 'usd', currency: 'USD', amountMinor: 30000 });
  const edited: MonthlyBudget = { ...totalBudget, amountMinor: 600000, revision: 1, updatedAt: changedAt };
  await saveMonthlyBudget(db, edited);
  await saveMonthlyBudget(db, edited);
  // Archiving the total lets a new one take its place; history keeps the archived row.
  const archived: MonthlyBudget = { ...edited, active: false, revision: 2, updatedAt: '2026-09-14T12:00:00.000Z' };
  await saveMonthlyBudget(db, archived);
  await saveMonthlyBudget(db, { ...totalBudget, id: 'replacement', amountMinor: 450000 });
  await db.closeAsync();
  const reopened = databaseAt(path);
  await initializeDatabase(reopened);
  archive = await readArchive(reopened);
  assert.deepEqual(archive.budgets!.map(budget => [budget.id, budget.scope, budget.active, budget.amountMinor]),
    [['october', 'total', true, 500000], ['replacement', 'total', true, 450000], ['total-fixture', 'total', false, 600000], ['budget-fixture', 'category', true, 20000], ['usd', 'total', true, 30000]]);
  // v7 backups round-trip totals; a v6 file with the same category budget still imports, as a category budget.
  const backup = createRecoveryBackup(archive);
  assert.equal(backup.schema, 'finanzapp.native-pilot.v8');
  assert.equal(archiveKey(parsePilotBackup(JSON.stringify(backup)).archive), archiveKey(archive));
  const { scope: _scope, ...legacyRow } = monthlyBudget;
  const { appearances: _a6, categories: _c6, ...v7Shape } = createRecoveryBackup({ accounts: archive.accounts, records: archive.records });
  const v6 = { ...v7Shape, schema: 'finanzapp.native-pilot.v6', budgets: [legacyRow] };
  const other = setup().db;
  await initializeDatabase(other);
  const incoming = parsePilotBackup(JSON.stringify(v6)).archive;
  await importArchive(other, incoming, archiveKey(await readArchive(other)));
  assert.deepEqual((await readArchive(other)).budgets, [monthlyBudget]);
});

const cardAccount: Account = { id: 'card-account', name: 'Visa Gold', currency: 'ARS', openingMinor: -20000, createdAt: account.createdAt };
const card: CreditCardProfile = { id: 'card-fixture', accountId: cardAccount.id, issuer: 'Banco', last4: '4009', creditLimitMinor: 500000,
  closingDay: 28, dueDay: 5, active: true, createdAt: account.createdAt, revision: 0, updatedAt: account.createdAt };
const purchase: Entry = { ...expense, id: 'card-purchase', accountId: cardAccount.id, amountMinor: 23100, merchant: 'Starbucks', category: 'Café' };
const cardPayment: Transfer = { id: 'card-payment', fromAccountId: account.id, toAccountId: cardAccount.id, amountMinor: 30000,
  note: 'Pago Visa Gold', dateISO: '2026-09-15', createdAt: account.createdAt };
const debtAccount: Account = { id: 'debt-account', name: 'Debo · Juan', currency: 'ARS', openingMinor: -30000, createdAt: account.createdAt };
const debt: PersonalDebtProfile = { id: 'debt-fixture', accountId: debtAccount.id, direction: 'owed_by_me', counterparty: 'Juan',
  dueDateISO: '2026-10-01', note: '', active: true, createdAt: account.createdAt, revision: 0, updatedAt: account.createdAt };

test('schema 5 upgrades to card/debt schema 6 preserving budgets, recurring rules and balances', async () => {
  const { db } = await funded();
  await saveRecurringRule(db, recurring);
  await saveMonthlyBudget(db, monthlyBudget);
  const before = await readArchive(db);
  await db.execAsync('DROP TABLE IF EXISTS currency_units; DROP TABLE IF EXISTS account_appearances; DROP TABLE IF EXISTS category_definitions; DROP TABLE credit_cards; DROP TABLE personal_debts; PRAGMA user_version = 5;');
  const failing: LedgerDatabase = { ...db, withExclusiveTransactionAsync: work => db.withExclusiveTransactionAsync(tx => work({ ...tx,
    execAsync: async sql => { await tx.execAsync(sql); if (sql.includes('personal_debts')) throw new Error('Interrupted v6'); },
  })) };
  await assert.rejects(initializeDatabase(failing), /Interrupted v6/);
  assert.equal((await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version, 5);
  await initializeDatabase(db);
  const after = await readArchive(db);
  assert.equal((await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version, DATABASE_VERSION);
  assert.equal(archiveKey(after), archiveKey(before));
  assert.deepEqual(after.cards ?? [], []);
  assert.deepEqual(after.debts ?? [], []);
});

test('card purchase is one expense; paying the card moves cash into the card without a second expense', async () => {
  const { db, path } = await funded();
  await createCreditCard(db, cardAccount, card);
  await createCreditCard(db, cardAccount, card); // Retry after a failed refresh.
  await assert.rejects(createCreditCard(db, cardAccount, { ...card, last4: '0000' }), /ya existe/);
  await createEntry(db, purchase);
  let snapshot = await readSnapshot(db);
  assert.equal(cardDebtMinor(card, snapshot), 20000 + 23100);
  assert.equal(accountBalanceMinor(account, snapshot.entries, snapshot.transfers), 100000 - 12345);
  await createTransfer(db, cardPayment);
  await createTransfer(db, cardPayment);
  await db.closeAsync();
  const reopened = databaseAt(path);
  await initializeDatabase(reopened);
  snapshot = await readSnapshot(reopened);
  const archive = await readArchive(reopened);
  assert.equal((await reopened.getAllAsync('SELECT id FROM credit_cards')).length, 1);
  assert.equal(cardDebtMinor(card, snapshot), 20000 + 23100 - 30000);
  assert.equal(accountBalanceMinor(account, snapshot.entries, snapshot.transfers), 100000 - 12345 - 30000);
  const overview = spendingOverview(snapshot, { currency: 'ARS', startISO: '2026-09-01', endISO: '2026-09-30' });
  assert.equal(overview.status === 'ready' && overview.expenseMinor, 12345 + 23100);
  assert.equal(overview.status === 'ready' && overview.expenseCount, 2);
  assert.deepEqual(liquidTotalsByCurrency(snapshot, archive.cards, archive.debts), { ARS: 100000 - 12345 - 30000 });
  assert.deepEqual(totalsByCurrency(snapshot), { ARS: 100000 - 12345 - 20000 - 23100 });
});

test('a card cannot start with credit in the holder favour, or reuse an account that already has another obligation', async () => {
  const { db } = await funded();
  await assert.rejects(createCreditCard(db, { ...cardAccount, openingMinor: 1 }, card), /crédito a favor/);
  await assert.rejects(createCreditCard(db, cardAccount, { ...card, accountId: 'other' }), /no coincide/);
  await createCreditCard(db, cardAccount, card);
  await assert.rejects(createPersonalDebt(db, { ...debtAccount, id: cardAccount.id }, { ...debt, accountId: cardAccount.id }), /ya existe/);
  await assert.rejects(createCreditCard(db, { ...cardAccount, id: 'second-card-account' }, { ...card, id: 'second-card', accountId: cardAccount.id }), /no coincide/);
  assert.equal((await readArchive(db)).cards!.length, 1);
});

test('editing and archiving a card is retry-safe, keeps its account and never changes balances', async () => {
  const { db } = await funded();
  await createCreditCard(db, cardAccount, card);
  await createEntry(db, purchase);
  const balanceBefore = cardDebtMinor(card, await readSnapshot(db));
  const edited: CreditCardProfile = { ...card, creditLimitMinor: 800000, dueDay: 10, revision: 1, updatedAt: changedAt };
  await saveCreditCard(db, edited);
  await saveCreditCard(db, edited);
  await assert.rejects(saveCreditCard(db, { ...edited, accountId: account.id }), /no puede representar dos|cambió/);
  await assert.rejects(saveCreditCard(db, { ...card, dueDay: 12, revision: 5, updatedAt: changedAt }), /cambió/);
  await assert.rejects(saveCreditCard(db, { ...edited, id: 'missing' }), /No encontramos/);
  const archived: CreditCardProfile = { ...edited, active: false, revision: 2, updatedAt: '2026-09-14T12:00:00.000Z' };
  await saveCreditCard(db, archived);
  const archive = await readArchive(db);
  assert.deepEqual(archive.cards, [archived]);
  assert.equal(cardDebtMinor(card, snapshotFromArchive(archive)), balanceBefore);
  assert.equal(archive.records.length, 2);
});

test('personal debt: partial payments reduce it through transfers; direct expenses or income on it are refused', async () => {
  const { db, path } = await funded();
  await createPersonalDebt(db, debtAccount, debt);
  await createPersonalDebt(db, debtAccount, debt);
  await assert.rejects(createPersonalDebt(db, { ...debtAccount, openingMinor: 5 }, debt), /no coincide con su dirección/);
  await assert.rejects(createEntry(db, { ...expense, id: 'debt-expense', accountId: debtAccount.id }), /pagos o cobros/);
  await assert.rejects(createEntry(db, { ...expense, id: 'debt-income', kind: 'income', accountId: debtAccount.id }), /pagos o cobros/);
  await assert.rejects(changeEntry(db, makeEntryChange('move', initialRecord(expense), 'edit', changedAt, { ...expense, accountId: debtAccount.id })), /pagos o cobros/);
  await assert.rejects(saveRecurringRule(db, { ...recurring, accountId: debtAccount.id }), /pagos o cobros/);
  const payment: Transfer = { id: 'debt-payment', fromAccountId: account.id, toAccountId: debtAccount.id, amountMinor: 10000, note: 'Pago a Juan', dateISO: '2026-09-15', createdAt: account.createdAt };
  await createTransfer(db, payment);
  await createTransfer(db, payment);
  await db.closeAsync();
  const reopened = databaseAt(path);
  await initializeDatabase(reopened);
  const snapshot = await readSnapshot(reopened);
  assert.equal(debtOutstandingMinor(debt, snapshot), 20000);
  assert.equal(accountBalanceMinor(account, snapshot.entries, snapshot.transfers), 100000 - 12345 - 10000);
  assert.equal(snapshot.entries.length, 1); // The payment is not an expense.
  const settled: PersonalDebtProfile = { ...debt, active: false, revision: 1, updatedAt: changedAt };
  await savePersonalDebt(reopened, settled);
  await savePersonalDebt(reopened, settled);
  await assert.rejects(savePersonalDebt(reopened, { ...settled, direction: 'owed_to_me', revision: 2 }), /cambió/);
  assert.deepEqual((await readArchive(reopened)).debts, [settled]);
});

test('receivable: "they owe me" starts positive and collections move money into cash', async () => {
  const { db } = await funded();
  const receivableAccount: Account = { id: 'receivable-account', name: 'Me deben · Ana', currency: 'ARS', openingMinor: 15000, createdAt: account.createdAt };
  const receivable: PersonalDebtProfile = { ...debt, id: 'receivable', accountId: receivableAccount.id, direction: 'owed_to_me', counterparty: 'Ana', dueDateISO: null };
  await assert.rejects(createPersonalDebt(db, { ...receivableAccount, openingMinor: -1 }, receivable), /no coincide con su dirección/);
  await createPersonalDebt(db, receivableAccount, receivable);
  await createTransfer(db, { id: 'collection', fromAccountId: receivableAccount.id, toAccountId: account.id, amountMinor: 5000, note: 'Cobro de Ana', dateISO: '2026-09-16', createdAt: account.createdAt });
  const snapshot = await readSnapshot(db);
  assert.equal(debtOutstandingMinor(receivable, snapshot), 10000);
  assert.equal(accountBalanceMinor(account, snapshot.entries, snapshot.transfers), 100000 - 12345 + 5000);
  const archive = await readArchive(db);
  assert.deepEqual(liquidTotalsByCurrency(snapshot, archive.cards, archive.debts), { ARS: 100000 - 12345 + 5000 });
});

test('card creation rolls back its account when the profile insert fails, and retry adds both once', async () => {
  const { db } = await funded();
  const failing: LedgerDatabase = { ...db, withExclusiveTransactionAsync: work => db.withExclusiveTransactionAsync(tx => work({ ...tx,
    runAsync: async (sql, ...params) => { if (sql.includes('INSERT INTO credit_cards')) throw new Error('Disk full'); return tx.runAsync(sql, ...params); },
  })) };
  await assert.rejects(createCreditCard(failing, cardAccount, card), /Disk full/);
  assert.equal((await readSnapshot(db)).accounts.length, 1);
  await createCreditCard(db, cardAccount, card);
  const archive = await readArchive(db);
  assert.equal(archive.accounts.length, 2);
  assert.deepEqual(archive.cards, [card]);
});

test('v6 backup roundtrips cards and debts; additive import never duplicates their accounts or balances', async () => {
  const { db } = await funded();
  await createCreditCard(db, cardAccount, card);
  await createEntry(db, purchase);
  await createTransfer(db, cardPayment);
  await createPersonalDebt(db, debtAccount, debt);
  const original = await readArchive(db);
  const backup = createRecoveryBackup(original);
  assert.equal(backup.schema, 'finanzapp.native-pilot.v8');
  const incoming = parsePilotBackup(JSON.stringify(backup)).archive;
  assert.deepEqual(incoming.cards, original.cards);
  assert.deepEqual(incoming.debts, original.debts);

  const other = setup().db;
  await initializeDatabase(other);
  const baseline = archiveKey(await readArchive(other));
  const failing: LedgerDatabase = { ...other, withExclusiveTransactionAsync: work => other.withExclusiveTransactionAsync(tx => work({ ...tx,
    runAsync: async (sql, ...params) => { if (sql.includes('INSERT INTO personal_debts')) throw new Error('Interrupted debt import'); return tx.runAsync(sql, ...params); },
  })) };
  await assert.rejects(importArchive(failing, incoming, baseline), /Interrupted/);
  assert.equal(archiveKey(await readArchive(other)), baseline);
  await importArchive(other, incoming, baseline);
  await importArchive(other, incoming, baseline);
  const restored = await readArchive(other);
  assert.equal(archiveKey(restored), archiveKey(original));
  assert.equal(cardDebtMinor(card, snapshotFromArchive(restored)), 20000 + 23100 - 30000);
  assert.equal(debtOutstandingMinor(debt, snapshotFromArchive(restored)), 30000);
  assert.deepEqual(liquidTotalsByCurrency(snapshotFromArchive(restored), restored.cards, restored.debts), { ARS: 100000 - 12345 - 30000 });
});

// Producto 20: presentation identity. Every test below checks that balances,
// entries, transfers, budgets and rules are byte-identical before and after.
const financialKey = (archive: Awaited<ReturnType<typeof readArchive>>) => archiveKey({ accounts: archive.accounts, records: archive.records,
  transfers: archive.transfers, recurring: archive.recurring, budgets: archive.budgets, cards: archive.cards, debts: archive.debts });

test('schema 7 upgrades to identity schema 8 additively: existing accounts keep the default look, nothing is seeded, interruption is safe', async () => {
  const { db, path } = await funded();
  await saveRecurringRule(db, recurring);
  await saveMonthlyBudget(db, monthlyBudget);
  const before = await readArchive(db);
  await db.execAsync('DROP TABLE currency_units; DROP TABLE account_appearances; DROP TABLE category_definitions; PRAGMA user_version = 7;');
  const failing: LedgerDatabase = { ...db, withExclusiveTransactionAsync: work => db.withExclusiveTransactionAsync(tx => work({ ...tx,
    execAsync: async sql => { await tx.execAsync(sql); if (sql.includes('category_definitions')) throw new Error('Interrupted v8'); },
  })) };
  await assert.rejects(initializeDatabase(failing), /Interrupted v8/);
  assert.equal((await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version, 7);
  assert.equal((await db.getAllAsync("SELECT name FROM sqlite_master WHERE name IN ('account_appearances', 'category_definitions')")).length, 0);
  await initializeDatabase(db);
  await initializeDatabase(db); // idempotent
  assert.equal((await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version, DATABASE_VERSION);
  const after = await readArchive(db);
  assert.equal(archiveKey(after), archiveKey(before), 'no financial row changed and no appearance/category row was seeded');
  assert.equal(after.appearances, undefined);
  assert.equal(after.categories, undefined);
  assert.deepEqual(accountLook(account.id, after.appearances), { icon: 'wallet', color: 'cobalt' });
  await db.closeAsync();
  const reopened = databaseAt(path);
  await initializeDatabase(reopened);
  assert.equal(archiveKey(await readArchive(reopened)), archiveKey(before));
});

test('an account look is created with the account, persists across restart, and retries without duplicating either', async () => {
  const { db, path } = setup();
  await initializeDatabase(db);
  const look = makeAccountAppearance(account.id, 'bank', 'azure', account.createdAt);
  await createAccount(db, account, look);
  await createAccount(db, account, look); // same command again
  const saved = await readArchive(db);
  assert.deepEqual(saved.accounts, [account]);
  assert.deepEqual(saved.appearances, [look]);
  await assert.rejects(createAccount(db, account, { ...look, color: 'rose' }), /ya existe/);
  await assert.rejects(createAccount(db, { ...account, id: 'plain' }, { ...look, accountId: 'plain', icon: 'rocket' as never }), /ícono/);
  await assert.rejects(createAccount(db, { ...account, id: 'plain' }, { ...look, accountId: 'plain', color: '#FF0000' as never }), /color/);
  assert.equal((await readArchive(db)).accounts.length, 1, 'an invalid look never creates the account either');
  await createAccount(db, { ...account, id: 'plain' }); // a look is optional
  await db.closeAsync();
  const reopened = databaseAt(path);
  await initializeDatabase(reopened);
  const archive = await readArchive(reopened);
  assert.deepEqual(archive.appearances, [look]);
  assert.deepEqual(accountLook('plain', archive.appearances), { icon: 'wallet', color: 'cobalt' });
});

test('editing a look changes no financial field, no account revision and no audit; a stale look is refused', async () => {
  const { db } = await funded();
  await createTransfer(db, { ...transfer, toAccountId: account.id, fromAccountId: 'x' }).catch(() => {});
  const before = await readArchive(db);
  const first = makeAccountAppearance(account.id, 'cash', 'green', changedAt);
  await saveAccountAppearance(db, first);
  await saveAccountAppearance(db, first);
  const next = makeAccountAppearance(account.id, 'savings', 'teal', '2026-09-14T12:00:00.000Z', first);
  await saveAccountAppearance(db, next);
  await saveAccountAppearance(db, next);
  await assert.rejects(saveAccountAppearance(db, next.revision === 1 ? { ...first, icon: 'safe' } : next), /cambió/);
  await assert.rejects(saveAccountAppearance(db, { ...next, accountId: 'ghost' }), /cuenta existente/);
  const after = await readArchive(db);
  assert.equal(financialKey(after), financialKey(before));
  assert.deepEqual(after.accounts, before.accounts, 'the account row keeps revision 0 and its name/opening balance');
  assert.equal((await db.getAllAsync('SELECT id FROM account_changes')).length, 0, 'a look is not an account correction');
  assert.deepEqual(after.appearances, [next]);
  assert.equal(accountBalanceMinor(after.accounts[0], snapshotFromArchive(after).entries), 100000 - 12345);
  // Renaming and re-dressing in one commit: the correction receipt never includes the look.
  const change = makeAccountChange('rename', after.accounts[0], snapshotFromArchive(after), 'Cuenta renombrada', 100000 - 12345, changedAt);
  const look = makeAccountAppearance(account.id, 'bank', 'cobalt', changedAt, next);
  await changeAccount(db, change, look);
  await changeAccount(db, change, look);
  const renamed = await readArchive(db);
  assert.equal(renamed.accounts[0].name, 'Cuenta renombrada');
  assert.deepEqual(renamed.appearances, [look]);
  const receipt = await db.getFirstAsync<{ afterJSON: string }>('SELECT afterJSON FROM account_changes WHERE id = ?', 'rename');
  assert.equal(JSON.parse(receipt!.afterJSON).icon, undefined);
  assert.equal(accountBalanceMinor(renamed.accounts[0], snapshotFromArchive(renamed).entries), 100000 - 12345);
});

test('a look for a hidden card or debt account is rejected by the forms, and an orphan look row cannot exist', async () => {
  const { db } = await funded();
  await assert.rejects(db.withExclusiveTransactionAsync(tx => tx.runAsync(
    "INSERT INTO account_appearances (accountId, icon, color, createdAt, revision, updatedAt) VALUES ('ghost', 'wallet', 'cobalt', '2026-09-01T12:00:00.000Z', 0, '2026-09-01T12:00:00.000Z')")
    .then(() => {})), /FOREIGN KEY/);
  assert.equal((await readArchive(db)).appearances, undefined);
});

test('categories: create, rename as display identity, change icon/colour and archive without rewriting any entry, budget or rule', async () => {
  const { db, path } = await funded();
  await createEntry(db, { ...expense, id: 'food-1', category: 'Comida', amountMinor: 700 });
  await createEntry(db, { ...expense, id: 'food-2', category: 'COMIDA', amountMinor: 300 });
  await createEntry(db, { ...expense, id: 'legacy', category: 'sjsjn', amountMinor: 100 });
  await saveRecurringRule(db, { ...recurring, category: 'Comida' });
  await saveMonthlyBudget(db, { ...monthlyBudget, category: 'Comida' });
  const before = await readArchive(db);
  const kiosco = newCategoryDefinition('expense', ' Kiosco ', 'cafe', 'ochre', changedAt);
  await saveCategoryDefinition(db, kiosco);
  await saveCategoryDefinition(db, kiosco);
  await assert.rejects(saveCategoryDefinition(db, { ...kiosco, color: 'rose' }), /cambió/, 'a second first-revision write with other data is stale');
  await assert.rejects(saveCategoryDefinition(db, newCategoryDefinition('expense', 'Bar', 'emoji' as never, 'ochre', changedAt)), /ícono/);
  await assert.rejects(saveCategoryDefinition(db, newCategoryDefinition('expense', 'Bar', 'cafe', 'neon' as never, changedAt)), /color/);
  await assert.rejects(saveCategoryDefinition(db, { ...newCategoryDefinition('expense', 'Bar', 'cafe', 'ochre', changedAt), label: 'Supermercado' }), /otra categoría/);
  // Rename the preset "Comida": the definition adopts the key and keeps recording "Comida".
  const renamed = editedCategoryDefinition(resolveCategory('expense', 'Comida', (await readArchive(db)).categories), { label: 'Alimentación', color: 'green' }, changedAt);
  await saveCategoryDefinition(db, renamed);
  await saveCategoryDefinition(db, renamed);
  const again = editedCategoryDefinition(resolveCategory('expense', 'Comida', (await readArchive(db)).categories), { icon: 'restaurant' }, '2026-09-14T12:00:00.000Z');
  await saveCategoryDefinition(db, again);
  await assert.rejects(saveCategoryDefinition(db, { ...again, storedLabel: 'Alimentación', key: 'alimentacion' }), /cambió|identidad|previos/, 'the stored spelling never changes: a different key is another (new) identity');
  await assert.rejects(saveCategoryDefinition(db, { ...again, label: 'Kiosco', revision: again.revision + 1 }), /otra categoría/);
  // Archive the historical "sjsjn".
  const archived = editedCategoryDefinition(resolveCategory('expense', 'sjsjn'), { archived: true }, changedAt);
  await saveCategoryDefinition(db, archived);
  const after = await readArchive(db);
  assert.equal(financialKey(after), financialKey(before), 'entries, budgets and rules are byte-identical');
  assert.deepEqual(after.records.map(record => record.entry.category), before.records.map(record => record.entry.category));
  assert.deepEqual(after.categories!.map(item => [item.key, item.label, item.icon, item.color, item.archived, item.revision]),
    [['comida', 'Alimentación', 'restaurant', 'green', false, 1], ['kiosco', 'Kiosco', 'cafe', 'ochre', false, 0], ['sjsjn', 'sjsjn', 'other', 'graphite', true, 0]]);
  // Reports keep one group for Comida/COMIDA and the display name follows the definition; budgets and rules resolve to it too.
  const snapshot = snapshotFromArchive(after);
  const report = spendingReport(snapshot, 'ARS', '2026-09', '2026-09-30');
  const food = report.categories.find(item => item.key === 'comida')!;
  assert.equal(food.amountMinor, 1000);
  assert.equal(resolveCategory('expense', food.category, after.categories).label, 'Alimentación');
  assert.equal(summarizeMonthlyBudgets(snapshot, after.budgets!, 'ARS', '2026-09').rows.find(row => row.budget.category === 'Comida')?.spentMinor, 1000);
  assert.equal(resolveCategory('expense', after.recurring![0].category, after.categories).label, 'Alimentación');
  // The picker offers the renamed identity (recording "Comida"), the custom one, and hides the archived string unless it is the current value.
  const options = categoryOptions('expense', after.categories, snapshot.entries);
  assert.deepEqual(options.find(item => item.key === 'comida')!.storedLabel, 'Comida');
  assert.ok(options.some(item => item.label === 'Kiosco'));
  assert.ok(!options.some(item => item.key === 'sjsjn'));
  assert.equal(categoryOptions('expense', after.categories, snapshot.entries, '', 'sjsjn')[0].label, 'sjsjn');
  assert.equal(resolveCategory('expense', 'sjsjn', after.categories).archived, true, 'historical movements still resolve');
  await db.closeAsync();
  const reopened = databaseAt(path);
  await initializeDatabase(reopened);
  assert.equal(archiveKey(await readArchive(reopened)), archiveKey(after));
});

test('v8 backup round-trips looks and categories; v7 files import without them; identity rows import additively and conflicts block', async () => {
  const { db } = await funded();
  const look = makeAccountAppearance(account.id, 'bank', 'azure', changedAt);
  await saveAccountAppearance(db, look);
  await saveCategoryDefinition(db, newCategoryDefinition('expense', 'Kiosco', 'cafe', 'ochre', changedAt));
  const original = await readArchive(db);
  const backup = createRecoveryBackup(original);
  assert.equal(backup.schema, 'finanzapp.native-pilot.v8');
  assert.deepEqual(backup.appearances, [look]);
  assert.equal(backup.categories.length, 1);
  const incoming = parsePilotBackup(JSON.stringify(backup)).archive;
  assert.equal(archiveKey(incoming), archiveKey(original));

  const other = setup().db;
  await initializeDatabase(other);
  const baseline = archiveKey(await readArchive(other));
  const failing: LedgerDatabase = { ...other, withExclusiveTransactionAsync: work => other.withExclusiveTransactionAsync(tx => work({ ...tx,
    runAsync: async (sql, ...params) => { if (sql.includes('INSERT INTO category_definitions')) throw new Error('Interrupted identity import'); return tx.runAsync(sql, ...params); },
  })) };
  await assert.rejects(importArchive(failing, incoming, baseline), /Interrupted/);
  assert.equal(archiveKey(await readArchive(other)), baseline);
  await importArchive(other, incoming, baseline);
  await importArchive(other, incoming, baseline);
  const restored = await readArchive(other);
  assert.equal(archiveKey(restored), archiveKey(original));
  assert.deepEqual(totalsByCurrency(snapshotFromArchive(restored)), totalsByCurrency(snapshotFromArchive(original)));
  // A different look for the same account in a copy is a conflict: the local choice is never overwritten.
  await assert.rejects(importArchive(other, { ...incoming, appearances: [{ ...look, color: 'rose' }] }, archiveKey(restored)), /contradice/);
  assert.deepEqual((await readArchive(other)).appearances, [look]);
  // A v7 file (no identity arrays) still imports; the account then shows the default look.
  const { appearances: _a, categories: _c, ...rest } = backup;
  const v7 = parsePilotBackup(JSON.stringify({ ...rest, schema: 'finanzapp.native-pilot.v7' })).archive;
  assert.equal(v7.appearances, undefined);
  const third = setup().db;
  await initializeDatabase(third);
  await importArchive(third, v7, archiveKey(await readArchive(third)));
  const plain = await readArchive(third);
  assert.deepEqual(plain.accounts, original.accounts);
  assert.deepEqual(accountLook(account.id, plain.appearances), { icon: 'wallet', color: 'cobalt' });
  // Invalid identity rows are refused before anything is written.
  assert.throws(() => parsePilotBackup(JSON.stringify({ ...backup, appearances: [{ ...look, icon: 'rocket' }] })), /ícono/);
  assert.throws(() => parsePilotBackup(JSON.stringify({ ...backup, categories: [{ ...backup.categories[0], color: 'neon' }] })), /color/);
});

test('Producto 23.1C1: an amount typed with Argentine or US separators is stored as the same integer, and formatting in four locales never touches the ledger', async () => {
  const { AmountInput } = await import('../src/ui/money-input.ts');
  const { bindLocale } = await import('../src/i18n/bind.ts');
  const { parseMinorUnits } = await import('@finanzapp/domain');
  const typed = (format: { decimal: string; group: string }, keys: string) => {
    const field = new AmountInput('', format, 'ARS');
    for (const key of keys) {
      const { text, caret } = field.view;
      field.change(text.slice(0, caret) + key + text.slice(caret), caret + 1);
    }
    return field.settle().draft;
  };
  const { db } = setup();
  await initializeDatabase(db);
  const dollars: Account = { ...account, id: 'usd-account', name: 'Dólares', currency: 'USD', openingMinor: 0 };
  await createAccount(db, account);
  await createAccount(db, dollars);
  const argentine = typed({ decimal: ',', group: '.' }, '1234567,89');
  const american = typed({ decimal: '.', group: ',' }, '1234567.89');
  assert.equal(argentine, '1.234.567,89');
  assert.equal(american, argentine, 'the draft is the ledger notation in both regions');
  await createEntry(db, { ...expense, id: 'typed-ar', amountMinor: parseMinorUnits(argentine) });
  await createEntry(db, { ...expense, id: 'typed-us', accountId: dollars.id, amountMinor: parseMinorUnits(american) });
  const before = await readArchive(db);
  const version = (await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version;
  assert.deepEqual(before.records.map(record => [record.entry.id, record.entry.amountMinor]).sort(), [['typed-ar', 123456789], ['typed-us', 123456789]]);
  // Presenting everything in every combination is read-only: no write, no migration, no rounding.
  for (const locale of ['es-AR', 'en-AR', 'es-US', 'en-US'] as const) {
    const i18n = bindLocale(locale);
    for (const record of before.records) {
      const currency = record.entry.accountId === dollars.id ? 'USD' : 'ARS';
      assert.equal(i18n.formatMoneyAmount(record.entry.amountMinor, currency).replace(/[.,]/g, ''), '123456789');
      assert.ok(i18n.moneyText(record.entry.amountMinor, currency).length > 0);
      assert.ok(i18n.spokenMoney(record.entry.amountMinor, currency).length > 0);
    }
  }
  assert.deepEqual(await readArchive(db), before, 'the ledger is exactly as it was');
  assert.equal((await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version, version, 'no schema change');
  const tables = (await db.getAllAsync<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table'")).map(row => row.name);
  assert.equal(tables.some(name => /locale|language|region|preference/i.test(name)), false, 'language and region live outside the ledger');
  // Each account keeps its own currency: nothing converts pesos and dollars, in any locale.
  await assert.rejects(createTransfer(db, { id: 'cross', fromAccountId: account.id, toAccountId: dollars.id, amountMinor: parseMinorUnits(american),
    note: '', dateISO: '2026-09-11', createdAt: account.createdAt }), /misma moneda/);
  const saved = await readSnapshot(db);
  assert.deepEqual(saved.accounts.map(item => [item.id, item.currency]).sort(), [['test-account', 'ARS'], ['usd-account', 'USD']]);
  assert.equal(saved.entries.length, 2, 'a refused transfer records nothing, and no transfer is ever an expense');
  assert.equal((saved.transfers ?? []).length, 0);
});

// ---- Producto 24B4: SQLite schema 9 and backup v9 --------------------------------------------
// Real files at schema 8 are built from the app's own scripts (never a hand-written copy of an
// old schema), populated through raw SQL with every child table, then opened by the current code.
// The gate is opened per call (an explicit currency set) and never edited: production still
// offers exactly ARS and USD, and the tests below also prove a closed gate keeps stored yen readable.
import { CURRENCY_UNIT_SOURCE, ISO_4217_PUBLISHED, SCALE_CONFLICT_MESSAGE, archiveExponents, catalogueUnit, previewBackupImport, sameEntry, type IsoCurrencyCode, type MonthlyBudget as Budget } from '@finanzapp/domain';
const GATE: readonly IsoCurrencyCode[] = ['ARS', 'USD', 'EUR', 'JPY', 'KWD'];
const V8_SCRIPTS = SCHEMA_SCRIPTS.slice(0, 8);

/** A real schema 8 file with every table populated: two cash accounts, a card, a debt, an entry with an
 * edit and a tombstone, a transfer with a void, a recurring rule, a total and a category budget, a look and
 * a category. Returns the database handle and the raw rows for later comparison. */
async function realV8File() {
  const { db, path } = setup();
  await runExclusiveTransaction(async () => connection(path), async tx => { for (const script of V8_SCRIPTS) await tx.execAsync(script); });
  assert.equal((await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version, 8);
  const at = '2026-09-10T12:00:00.000Z', later = '2026-09-12T12:00:00.000Z';
  await db.withExclusiveTransactionAsync(async tx => {
    // The schema 8 CHECK is the real one: a yen account cannot exist in this file.
    await assert.rejects(tx.runAsync('INSERT INTO accounts (id, name, currency, openingMinor, createdAt, revision, updatedAt) VALUES (?, ?, ?, ?, ?, 0, ?)', 'yen', 'Yen', 'JPY', 0, at, at), /CHECK constraint failed/);
    for (const [id, name, currency, opening] of [['cash', 'Banco', 'ARS', 100000], ['usd', 'Dólares', 'USD', 500], ['card-acc', 'Visa', 'ARS', -20000], ['debt-acc', 'Debo · Ana', 'USD', -300]] as const) {
      await tx.runAsync('INSERT INTO accounts (id, name, currency, openingMinor, createdAt, revision, updatedAt) VALUES (?, ?, ?, ?, ?, 0, ?)', id, name, currency, opening, at, at);
    }
    await tx.runAsync('UPDATE accounts SET name = ?, revision = 1, updatedAt = ? WHERE id = ?', 'Banco Nación', later, 'cash');
    await tx.runAsync('INSERT INTO account_changes (id, accountId, beforeJSON, afterJSON, expectedBalanceMinor) VALUES (?, ?, ?, ?, NULL)', 'ac', 'cash',
      JSON.stringify({ id: 'cash', name: 'Banco', currency: 'ARS', openingMinor: 100000, createdAt: at }), JSON.stringify({ id: 'cash', name: 'Banco Nación', currency: 'ARS', openingMinor: 100000, createdAt: at, revision: 1, updatedAt: later }));
    await tx.runAsync('INSERT INTO entries (id, accountId, kind, amountMinor, merchant, category, dateISO, createdAt, revision, voided, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', 'e1', 'cash', 'expense', 12345, 'Súper', 'Comida', '2026-09-10', at, 0, 0, at);
    await tx.runAsync('INSERT INTO entries (id, accountId, kind, amountMinor, merchant, category, dateISO, createdAt, revision, voided, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', 'e2', 'cash', 'income', 5000, 'Sueldo', 'Sueldo', '2026-09-11', at, 1, 1, later);
    await tx.runAsync('INSERT INTO entries (id, accountId, kind, amountMinor, merchant, category, dateISO, createdAt, revision, voided, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', 'e3', 'card-acc', 'expense', 999, 'Kiosco', 'Comida', '2026-09-11', at, 0, 0, at);
    await tx.runAsync('INSERT INTO entry_changes (id, entryId, action, beforeJSON, afterJSON) VALUES (?, ?, ?, ?, ?)', 'ec', 'e2', 'void', '{}', '{}');
    await tx.runAsync('INSERT INTO transfers (id, fromAccountId, toAccountId, amountMinor, note, dateISO, createdAt, revision, voided, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', 't1', 'cash', 'card-acc', 1000, 'Pago', '2026-09-11', at, 0, 0, at);
    await tx.runAsync('INSERT INTO transfers (id, fromAccountId, toAccountId, amountMinor, note, dateISO, createdAt, revision, voided, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', 't2', 'usd', 'debt-acc', 100, 'Cuota', '2026-09-11', at, 1, 1, later);
    await tx.runAsync('INSERT INTO transfer_changes (id, transferId, action, beforeJSON, afterJSON) VALUES (?, ?, ?, ?, ?)', 'tc', 't2', 'void', '{}', '{}');
    await tx.runAsync('INSERT INTO recurring_rules (id, accountId, kind, amountMinor, merchant, category, frequency, anchorDateISO, nextDateISO, active, createdAt, revision, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', 'r1', 'cash', 'expense', 40000, 'Alquiler', 'Hogar', 'monthly', '2026-10-01', '2026-10-01', 1, at, 0, at);
    await tx.runAsync('INSERT INTO monthly_budgets (id, scope, category, currency, monthISO, amountMinor, active, createdAt, revision, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', 'b-total', 'total', null, 'ARS', '2026-09', 500000, 1, at, 0, at);
    await tx.runAsync('INSERT INTO monthly_budgets (id, scope, category, currency, monthISO, amountMinor, active, createdAt, revision, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', 'b-food', 'category', 'Comida', 'ARS', '2026-09', 150000, 0, at, 1, later);
    await assert.rejects(tx.runAsync('INSERT INTO monthly_budgets (id, scope, category, currency, monthISO, amountMinor, active, createdAt, revision, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', 'b-yen', 'total', null, 'JPY', '2026-09', 1, 1, at, 0, at), /CHECK constraint failed/);
    await tx.runAsync('INSERT INTO credit_cards (id, accountId, issuer, last4, creditLimitMinor, closingDay, dueDay, active, createdAt, revision, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', 'card', 'card-acc', 'Galicia', '4009', 300000, 28, 5, 1, at, 0, at);
    await tx.runAsync('INSERT INTO personal_debts (id, accountId, direction, counterparty, dueDateISO, note, active, createdAt, revision, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', 'debt', 'debt-acc', 'owed_by_me', 'Ana', '2026-10-01', '', 1, at, 0, at);
    await tx.runAsync('INSERT INTO account_appearances (accountId, icon, color, createdAt, revision, updatedAt) VALUES (?, ?, ?, ?, ?, ?)', 'cash', 'bank', 'azure', at, 0, at);
    await tx.runAsync('INSERT INTO category_definitions (kind, key, storedLabel, label, icon, color, archived, createdAt, revision, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', 'expense', 'kiosco', 'Kiosco', 'Kiosco', 'cafe', 'ochre', 0, at, 0, at);
  });
  const dump = async () => {
    const rows: Record<string, unknown[]> = {};
    for (const table of ['accounts', 'entries', 'entry_changes', 'account_changes', 'transfers', 'transfer_changes', 'recurring_rules', 'monthly_budgets', 'credit_cards', 'personal_debts', 'account_appearances', 'category_definitions']) {
      rows[table] = await db.getAllAsync(`SELECT * FROM ${table} ORDER BY 1, 2`);
    }
    return rows;
  };
  return { db, path, before: await dump(), dump };
}

test('24B4: a real schema 8 file with every table populated upgrades to schema 9 with identical rows, balances and identity, and reopens', async () => {
  const { db, path, before, dump } = await realV8File();
  await initializeDatabase(db);
  assert.equal((await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version, 9);
  assert.deepEqual(await dump(), before, 'every row of every table, byte for byte, including audit receipts and tombstones');
  assert.deepEqual(await db.getAllAsync('SELECT * FROM currency_units'), [], 'ARS and USD are never pinned: their rows stay cents');
  const archive = await readArchive(db);
  assert.deepEqual(archive.currencyUnits, []);
  assert.deepEqual(archiveExponents(archive), { ARS: 2, USD: 2 });
  const snapshot = snapshotFromArchive(archive);
  assert.deepEqual(totalsByCurrency(snapshot), { ARS: 100000 - 12345 - 20000 - 999, USD: 500 - 300 });
  assert.equal(accountBalanceMinor(snapshot.accounts.find(a => a.id === 'cash')!, snapshot.entries, snapshot.transfers), 100000 - 12345 - 1000);
  assert.deepEqual(archive.accounts.find(a => a.id === 'cash'), { id: 'cash', name: 'Banco Nación', currency: 'ARS', openingMinor: 100000, createdAt: '2026-09-10T12:00:00.000Z', revision: 1, updatedAt: '2026-09-12T12:00:00.000Z' });
  assert.deepEqual(archive.records.map(record => [record.entry.id, record.voided, record.revision]).sort(), [['e1', false, 0], ['e2', true, 1], ['e3', false, 0]]);
  assert.deepEqual(archive.transfers!.map(record => [record.transfer.id, record.voided]).sort(), [['t1', false], ['t2', true]]);
  assert.deepEqual(archive.budgets!.map(budget => [budget.id, budget.scope, budget.active]), [['b-total', 'total', true], ['b-food', 'category', false]]);
  assert.equal(archive.cards![0].id, 'card'); assert.equal(archive.debts![0].id, 'debt'); assert.equal(archive.appearances![0].color, 'azure'); assert.equal(archive.categories![0].key, 'kiosco');
  // The shape CHECK admits any ISO-shaped code; what a row may hold is decided by the domain, not the schema.
  await db.withExclusiveTransactionAsync(async tx => {
    await assert.rejects(tx.runAsync('INSERT INTO accounts (id, name, currency, openingMinor, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)', 'bad', 'x', 'ars', 0, 'now', 'now'), /CHECK constraint failed/);
    await assert.rejects(tx.runAsync('INSERT INTO accounts (id, name, currency, openingMinor, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)', 'bad', 'x', 'EURO', 0, 'now', 'now'), /CHECK constraint failed/);
    await assert.rejects(tx.runAsync('INSERT INTO accounts (id, name, currency, openingMinor, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)', 'bad', '', 'ARS', 0, 'now', 'now'), /CHECK constraint failed/, 'the other CHECKs survived the rebuild');
    await assert.rejects(tx.runAsync('INSERT INTO entries (id, accountId, kind, amountMinor, merchant, category, dateISO, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', 'orphan', 'missing', 'expense', 1, 'x', 'x', '2026-09-11', 'now', 'now'), /FOREIGN KEY constraint failed/, 'children still reference the rebuilt parent');
  });
  // Close and reopen: schema 9 is read as is, nothing migrates twice, nothing changes.
  await db.closeAsync();
  const reopened = databaseAt(path);
  await initializeDatabase(reopened);
  assert.equal((await reopened.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version, 9);
  assert.equal(archiveKey(await readArchive(reopened)), archiveKey(archive));
  assert.deepEqual((await reopened.getAllAsync<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE '%_v9'")), [], 'no scratch table survives');
  const indexes = (await reopened.getAllAsync<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'budgets_period'"));
  assert.equal(indexes.length, 1);
});

test('24B4: an interrupted schema 9 migration leaves the schema 8 file intact and reopenable; a broken reference is refused before COMMIT', async () => {
  const { db, before, dump } = await realV8File();
  // A stale scratch table makes the budgets rebuild fail after the accounts rebuild already ran inside the transaction.
  await db.execAsync('CREATE TABLE monthly_budgets_v9 (x INTEGER) STRICT');
  await assert.rejects(initializeDatabase(db), /already exists/);
  assert.equal((await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version, 8);
  assert.deepEqual(await dump(), before, 'the accounts rebuild was rolled back with everything else');
  await db.withExclusiveTransactionAsync(async tx => {
    await assert.rejects(tx.runAsync('INSERT INTO accounts (id, name, currency, openingMinor, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)', 'yen', 'Yen', 'JPY', 0, 'now', 'now'), /CHECK constraint failed/, 'still the schema 8 CHECK');
  });
  assert.equal((await db.getAllAsync("SELECT name FROM sqlite_master WHERE name IN ('accounts_v9', 'currency_units')")).length, 0);
  await db.execAsync('DROP TABLE monthly_budgets_v9');
  await initializeDatabase(db);
  assert.equal((await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version, 9);
  assert.deepEqual(await dump(), before);

  // A schema 8 file holding a child row that points nowhere (foreign keys were off when it was written) never
  // reaches schema 9: foreign_key_check refuses it before COMMIT and the file stays as it was.
  const damaged = await realV8File();
  const raw = connection(damaged.path);
  await raw.execAsync("INSERT INTO entries (id, accountId, kind, amountMinor, merchant, category, dateISO, createdAt, revision, voided, updatedAt) VALUES ('orphan', 'gone', 'expense', 1, 'x', 'x', '2026-09-11', 'now', 0, 0, 'now')");
  await raw.closeAsync();
  await assert.rejects(initializeDatabase(damaged.db), new RegExp(MIGRATION_REFERENCES_MESSAGE.slice(0, 30)));
  assert.equal((await damaged.db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version, 8);
  assert.equal((await damaged.db.getAllAsync("SELECT name FROM sqlite_master WHERE name IN ('accounts_v9', 'monthly_budgets_v9', 'currency_units')")).length, 0);
  await damaged.db.execAsync("DELETE FROM entries WHERE id = 'orphan'");
  await initializeDatabase(damaged.db);
  assert.equal((await damaged.db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version, 9);
});

test('24B4: an older schema (v3) still migrates through every step to schema 9 in one go', async () => {
  const { db, path } = setup();
  await runExclusiveTransaction(async () => connection(path), async tx => { for (const script of SCHEMA_SCRIPTS.slice(0, 3)) await tx.execAsync(script); });
  await db.withExclusiveTransactionAsync(async tx => {
    await tx.runAsync('INSERT INTO accounts (id, name, currency, openingMinor, createdAt, revision, updatedAt) VALUES (?, ?, ?, ?, ?, 0, ?)', 'a', 'Caja', 'ARS', 700, account.createdAt, account.createdAt);
  });
  await initializeDatabase(db);
  assert.equal((await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version, 9);
  assert.deepEqual(totalsByCurrency(await readSnapshot(db)), { ARS: 700 });
});

const yen: Account = { id: 'yen', name: 'Yenes', currency: 'JPY', openingMinor: 1500, createdAt: account.createdAt };
const dinar: Account = { id: 'dinar', name: 'Dinares', currency: 'KWD', openingMinor: 1234567, createdAt: account.createdAt };
const euro: Account = { id: 'euro', name: 'Euros', currency: 'EUR', openingMinor: 5000, createdAt: account.createdAt };
const yenExpense: Entry = { ...expense, id: 'yen-1', accountId: yen.id, amountMinor: 700 };
const filExpense: Entry = { ...expense, id: 'fil-1', accountId: dinar.id, amountMinor: 5 };
const yenBudget: Budget = { id: 'b-yen', scope: 'total', currency: 'JPY', monthISO: '2026-09', amountMinor: 20000, active: true, createdAt: account.createdAt, revision: 0, updatedAt: account.createdAt };

/** A schema 9 ledger holding ARS, JPY (0 decimals), KWD (3) and EUR (2) through the explicit test gate. */
async function threeCurrencies() {
  const { db, path } = setup();
  await initializeDatabase(db);
  await createAccount(db, account);
  await createAccount(db, yen, undefined, GATE);
  await createAccount(db, dinar, undefined, GATE);
  await createAccount(db, euro, undefined, GATE);
  await createEntry(db, expense);
  await createEntry(db, yenExpense);
  await createEntry(db, filExpense);
  await saveMonthlyBudget(db, yenBudget, GATE);
  return { db, path };
}

test('24B4: a currency beyond ARS/USD is pinned once, on its first row, with its source and catalogue version; the gate stays closed in production', async () => {
  const { db } = setup();
  await initializeDatabase(db);
  await assert.rejects(createAccount(db, yen), /moneda disponible/, 'the production gate refuses a yen account');
  await assert.rejects(saveMonthlyBudget(db, yenBudget), /moneda disponible/);
  assert.deepEqual(await db.getAllAsync('SELECT * FROM currency_units'), [], 'a refused creation pins nothing');
  await createAccount(db, yen, undefined, GATE);
  await createAccount(db, yen, undefined, GATE); // A retry finds the row it wrote.
  const units = await db.getAllAsync<{ currency: string; minorUnitExponent: number; source: string; catalogVersion: string; createdAt: string }>('SELECT * FROM currency_units');
  assert.deepEqual(units, [{ currency: 'JPY', minorUnitExponent: 0, source: CURRENCY_UNIT_SOURCE, catalogVersion: ISO_4217_PUBLISHED, createdAt: yen.createdAt }]);
  await createAccount(db, { ...yen, id: 'yen-2', name: 'Otra' }, undefined, GATE);
  assert.equal((await db.getAllAsync('SELECT * FROM currency_units')).length, 1, 'one row per currency, never one per account');
  await saveMonthlyBudget(db, { ...yenBudget, id: 'b-kwd', currency: 'KWD', amountMinor: 1000 }, GATE);
  assert.deepEqual((await db.getAllAsync<{ currency: string; minorUnitExponent: number }>('SELECT currency, minorUnitExponent FROM currency_units ORDER BY currency')), [{ currency: 'JPY', minorUnitExponent: 0 }, { currency: 'KWD', minorUnitExponent: 3 }], 'a budget pins its own code');
  const archive = await readArchive(db);
  assert.deepEqual(archive.currencyUnits, [catalogueUnit('JPY'), catalogueUnit('KWD')]);
  assert.deepEqual(archiveExponents(archive), { JPY: 0, KWD: 3 }, 'only the currencies present');
  // Stored ARS/USD rows never gain a unit row, whatever else is pinned.
  await createAccount(db, account);
  assert.equal((await db.getAllAsync('SELECT * FROM currency_units')).length, 2);
});

test('24B4: yen are stored and read as yen, fils as fils: no amount is ever read as cents, and each balance is exact in its own exponent', async () => {
  const { db, path } = await threeCurrencies();
  const snapshot = await readSnapshot(db);
  assert.deepEqual(totalsByCurrency(snapshot), { ARS: 100000 - 12345, EUR: 5000, JPY: 1500 - 700, KWD: 1234567 - 5 });
  assert.equal(snapshot.entries.find(e => e.id === 'yen-1')!.amountMinor, 700, '700 yen, not 7.00');
  assert.equal(snapshot.entries.find(e => e.id === 'fil-1')!.amountMinor, 5, '5 fils, not 0.05 dinars');
  assert.deepEqual(archiveExponents(await readArchive(db)), { ARS: 2, EUR: 2, JPY: 0, KWD: 3 });
  // A transfer in yen moves 300 yen exactly; a cross-currency one is refused by the domain as before.
  await createAccount(db, { ...yen, id: 'yen-2', name: 'Otra', openingMinor: 0 }, undefined, GATE);
  await createTransfer(db, { id: 'ty', fromAccountId: yen.id, toAccountId: 'yen-2', amountMinor: 300, note: '', dateISO: expense.dateISO, createdAt: account.createdAt });
  await assert.rejects(createTransfer(db, { id: 'tx', fromAccountId: yen.id, toAccountId: dinar.id, amountMinor: 300, note: '', dateISO: expense.dateISO, createdAt: account.createdAt }), /misma moneda/);
  const after = await readSnapshot(db);
  assert.equal(accountBalanceMinor(after.accounts.find(a => a.id === yen.id)!, after.entries, after.transfers), 1500 - 700 - 300);
  assert.equal(accountBalanceMinor(after.accounts.find(a => a.id === 'yen-2')!, after.entries, after.transfers), 300);
  // Close and reopen: the pinned scales are re-read, the totals are the same integers.
  await db.closeAsync();
  const reopened = databaseAt(path);
  await initializeDatabase(reopened);
  assert.deepEqual(totalsByCurrency(await readSnapshot(reopened)), { ARS: 100000 - 12345, EUR: 5000, JPY: 1500 - 700, KWD: 1234567 - 5 });
});

test('24B4: a pinned scale that disagrees with the catalogue, or a row whose currency was never pinned, refuses to open by name and changes nothing', async () => {
  const { db } = await threeCurrencies();
  const before = await db.getAllAsync('SELECT * FROM entries ORDER BY id');
  // A hand-edited unit (what a catalogue that changed an exponent would look like): refused, never rescaled.
  await db.execAsync("UPDATE currency_units SET minorUnitExponent = 2 WHERE currency = 'JPY'");
  await assert.rejects(readArchive(db), new RegExp(SCALE_CONFLICT_MESSAGE.slice(0, 20)));
  await assert.rejects(initializeDatabase(db), new RegExp(SCALE_CONFLICT_MESSAGE.slice(0, 20)));
  await assert.rejects(createEntry(db, { ...yenExpense, id: 'yen-2' }), new RegExp(SCALE_CONFLICT_MESSAGE.slice(0, 20)), 'no write while the scale is in doubt');
  assert.deepEqual(await db.getAllAsync('SELECT * FROM entries ORDER BY id'), before, 'nothing was rewritten or reset');
  assert.equal((await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version, 9);
  await db.execAsync("UPDATE currency_units SET minorUnitExponent = 0 WHERE currency = 'JPY'");
  assert.deepEqual(archiveExponents(await readArchive(db)), { ARS: 2, EUR: 2, JPY: 0, KWD: 3 });
  // A row in a currency with no pinned scale (written by hand with foreign keys and the domain bypassed), even with the gate open.
  await db.execAsync("DELETE FROM currency_units WHERE currency = 'EUR'");
  await assert.rejects(readArchive(db), /La moneda EUR no tiene una escala registrada/);
  await assert.rejects(createAccount(db, { ...euro, id: 'euro-2' }, undefined, GATE), /La moneda EUR no tiene una escala registrada/);
  assert.equal((await db.getAllAsync("SELECT * FROM accounts WHERE id = 'euro-2'")).length, 0);
  // A legacy code with a spurious row: harmless at 2, a conflict at anything else.
  await db.execAsync(`INSERT INTO currency_units (currency, minorUnitExponent, source, catalogVersion, createdAt) VALUES ('EUR', 2, 'x', 'y', 'now')`);
  await readArchive(db);
  await db.execAsync(`INSERT INTO currency_units (currency, minorUnitExponent, source, catalogVersion, createdAt) VALUES ('ARS', 2, 'x', 'y', 'now')`);
  await assert.rejects(readArchive(db), /no la necesita/, 'ARS is never pinned: a row for it is not the app\'s');
});

test('24B4: closing the gate again keeps stored yen readable, editable, exportable (v9) and restorable; ARS/USD-only ledgers still export v8 bytes', async () => {
  const { db } = await threeCurrencies();
  // Every operation below runs with the production gate (ARS/USD): the stored currencies are untouched by it.
  await createEntry(db, { ...yenExpense, id: 'yen-2', amountMinor: 100 });
  const record = (await readArchive(db)).records.find(item => item.entry.id === 'yen-1')!;
  await changeEntry(db, makeEntryChange('edit-yen', record, 'edit', changedAt, { ...record.entry, amountMinor: 650 }));
  await saveMonthlyBudget(db, { ...yenBudget, amountMinor: 25000, revision: 1, updatedAt: changedAt });
  await assert.rejects(saveMonthlyBudget(db, { ...yenBudget, id: 'b-yen-2', monthISO: '2026-10' }), /moneda disponible/, 'a NEW yen budget needs the gate');
  await assert.rejects(createAccount(db, { ...yen, id: 'yen-3' }), /moneda disponible/, 'a NEW yen account needs the gate');
  const archive = await readArchive(db);
  assert.equal(snapshotFromArchive(archive).entries.find(e => e.id === 'yen-1')!.amountMinor, 650);
  const backup = createRecoveryBackup(archive);
  assert.equal(backup.schema, 'finanzapp.native-pilot.v9');
  assert.deepEqual(backup.currencyUnits!.map(unit => [unit.currency, unit.minorUnitExponent]), [['EUR', 2], ['JPY', 0], ['KWD', 3]]);
  const incoming = parsePilotBackup(JSON.stringify(backup)).archive;
  assert.equal(archiveKey(incoming), archiveKey(archive));
  // Restore into a fresh device with the production gate: the copy's scales are pinned first, in the same transaction.
  const other = setup().db;
  await initializeDatabase(other);
  const baseline = archiveKey(await readArchive(other));
  const plan = previewBackupImport(await readArchive(other), incoming);
  assert.deepEqual(plan.currencyUnits.map(unit => unit.currency), ['EUR', 'JPY', 'KWD']);
  assert.deepEqual(plan.scaleConflicts, []);
  await importArchive(other, incoming, baseline);
  await importArchive(other, incoming, baseline); // The same frozen review after a failed refresh adds nothing twice.
  const restored = await readArchive(other);
  assert.equal(archiveKey(restored), archiveKey(archive));
  assert.deepEqual(totalsByCurrency(snapshotFromArchive(restored)), totalsByCurrency(snapshotFromArchive(archive)));
  assert.deepEqual((await other.getAllAsync<{ currency: string; minorUnitExponent: number }>('SELECT currency, minorUnitExponent FROM currency_units ORDER BY currency')), [{ currency: 'EUR', minorUnitExponent: 2 }, { currency: 'JPY', minorUnitExponent: 0 }, { currency: 'KWD', minorUnitExponent: 3 }]);
  assert.equal(snapshotFromArchive(restored).entries.find(e => e.id === 'fil-1')!.amountMinor, 5, 'fils restored as fils');
  // An ARS/USD ledger keeps the v8 format, byte for byte the shape 24B1 pinned.
  const legacy = setup().db;
  await initializeDatabase(legacy);
  await createAccount(legacy, account);
  await createEntry(legacy, expense);
  const v8 = createRecoveryBackup(await readArchive(legacy));
  assert.equal(v8.schema, 'finanzapp.native-pilot.v8');
  assert.equal('currencyUnits' in v8, false);
  assert.deepEqual(Object.keys(v8), ['app', 'schema', 'exportedAt', 'moneyUnit', 'accounts', 'records', 'transfers', 'recurring', 'budgets', 'cards', 'debts', 'appearances', 'categories']);
});

test('24B4: a failed v9 restore rolls back the pinned scales with the rows; a repeated restore is identical; a wrong or missing unit is refused before anything is written', async () => {
  const source = await threeCurrencies();
  const backup = createRecoveryBackup(await readArchive(source.db));
  const incoming = parsePilotBackup(JSON.stringify(backup)).archive;
  const { db } = setup();
  await initializeDatabase(db);
  const baseline = archiveKey(await readArchive(db));
  const failing: LedgerDatabase = { ...db, withExclusiveTransactionAsync: work => db.withExclusiveTransactionAsync(tx => work({ ...tx,
    runAsync: async (sql, ...params) => { if (params[0] === 'dinar') throw new Error('Interrupted v9 import'); return tx.runAsync(sql, ...params); },
  })) };
  await assert.rejects(importArchive(failing, incoming, baseline), /Interrupted v9 import/);
  assert.equal(archiveKey(await readArchive(db)), baseline);
  assert.deepEqual(await db.getAllAsync('SELECT * FROM currency_units'), [], 'the scales pinned before the failing row were rolled back with it');
  assert.deepEqual(await db.getAllAsync('SELECT id FROM accounts'), [], 'no partial restore');
  await importArchive(db, incoming, baseline);
  const once = await readArchive(db);
  await importArchive(db, incoming, baseline);
  assert.equal(archiveKey(await readArchive(db)), archiveKey(once), 'a repeated restore adds nothing');
  assert.equal(previewBackupImport(once, incoming).identical, incoming.records.length + (incoming.transfers?.length ?? 0) + (incoming.budgets?.length ?? 0) + incoming.currencyUnits!.length);
  // Files that lie about a scale never produce a partial restore: refused at parse, before a preview exists.
  const units = backup.currencyUnits!;
  assert.throws(() => parsePilotBackup(JSON.stringify({ ...backup, currencyUnits: units.map(unit => unit.currency === 'KWD' ? { ...unit, minorUnitExponent: 2 } : unit) })), new RegExp(SCALE_CONFLICT_MESSAGE.slice(0, 20)));
  assert.throws(() => parsePilotBackup(JSON.stringify({ ...backup, currencyUnits: units.filter(unit => unit.currency !== 'JPY') })), /La moneda JPY no tiene una escala registrada/);
  assert.throws(() => parsePilotBackup(JSON.stringify({ ...backup, schema: 'finanzapp.native-pilot.v8', currencyUnits: undefined })), /v1 a v8 solo pueden contener/, 'a v8 file naming yen is still refused whole');
  assert.equal(archiveKey(await readArchive(db)), archiveKey(once));
  // A copy that pins a scale this device already pinned is identical, never re-inserted; the row keeps its first provenance.
  const pinnedAt = (await db.getAllAsync<{ createdAt: string }>("SELECT createdAt FROM currency_units WHERE currency = 'JPY'"))[0].createdAt;
  await createAccount(db, { ...yen, id: 'yen-local', name: 'Local' }, undefined, GATE);
  assert.equal((await db.getAllAsync<{ createdAt: string }>("SELECT createdAt FROM currency_units WHERE currency = 'JPY'"))[0].createdAt, pinnedAt);
});

test('24B4: adversarial: duplicated ids, a retry after a commit and a copy replayed twice never double a yen movement or a fil', async () => {
  const { db } = await threeCurrencies();
  await createEntry(db, yenExpense); // Same id: committed already.
  await assert.rejects(createEntry(db, { ...yenExpense, amountMinor: 701 }), /ya existe/);
  await createEntry(db, filExpense);
  const failingRefresh: LedgerDatabase = { ...db, withExclusiveTransactionAsync: work => db.withExclusiveTransactionAsync(async tx => { await work(tx); }) };
  await createEntry(failingRefresh, { ...filExpense, id: 'fil-2', amountMinor: 1 });
  await createEntry(db, { ...filExpense, id: 'fil-2', amountMinor: 1 });
  const snapshot = await readSnapshot(db);
  assert.equal(snapshot.entries.filter(e => e.accountId === yen.id).length, 1);
  assert.equal(snapshot.entries.filter(e => e.accountId === dinar.id).length, 2);
  assert.deepEqual(totalsByCurrency(snapshot), { ARS: 100000 - 12345, EUR: 5000, JPY: 800, KWD: 1234567 - 6 });
  assert.ok(sameEntry(snapshot.entries.find(e => e.id === 'fil-2')!, { ...filExpense, id: 'fil-2', amountMinor: 1 }));
  // Exponent confusion: a 13-digit yen amount is a valid safe integer of yen, never rescaled on the way in or out.
  await createEntry(db, { ...yenExpense, id: 'yen-big', kind: 'income', amountMinor: 9999999999999 });
  const big = (await readSnapshot(db)).entries.find(e => e.id === 'yen-big')!;
  assert.equal(big.amountMinor, 9999999999999);
  const restored = parsePilotBackup(JSON.stringify(createRecoveryBackup(await readArchive(db)))).archive;
  assert.equal(snapshotFromArchive(restored).entries.find(e => e.id === 'yen-big')!.amountMinor, 9999999999999);
  assert.deepEqual(archiveExponents(restored), { ARS: 2, EUR: 2, JPY: 0, KWD: 3 });
});

test('24B5: seven currencies with zero, two and three decimals through the preview gate: create, edit, export v9, restore into a fresh device and reopen, without changing one amount or currency', async () => {
  const { PREVIEW_CURRENCIES } = await import('../src/storage/currency-gate.ts');
  const { db, path } = setup();
  await initializeDatabase(db);
  const openings: Record<string, number> = { ARS: 100000, USD: 500, EUR: 123456, GBP: 99, JPY: 1500, CLP: 25000, KWD: 1234567 };
  const spends: Record<string, number> = { ARS: 12345, USD: 1, EUR: 6789, GBP: 99, JPY: 700, CLP: 990, KWD: 5 };
  for (const code of PREVIEW_CURRENCIES) {
    await createAccount(db, { id: 'acc-' + code, name: 'Caja ' + code, currency: code, openingMinor: openings[code], createdAt: account.createdAt }, undefined, PREVIEW_CURRENCIES);
    await createEntry(db, { ...expense, id: 'e-' + code, accountId: 'acc-' + code, amountMinor: spends[code] });
  }
  await saveMonthlyBudget(db, { id: 'b-clp', scope: 'total', currency: 'CLP', monthISO: '2026-09', amountMinor: 30000, active: true, createdAt: account.createdAt, revision: 0, updatedAt: account.createdAt }, PREVIEW_CURRENCIES);
  const kwd = (await readArchive(db)).records.find(record => record.entry.id === 'e-KWD')!;
  await changeEntry(db, makeEntryChange('edit-kwd', kwd, 'edit', changedAt, { ...kwd.entry, amountMinor: 7 }));
  const expected = Object.fromEntries(PREVIEW_CURRENCIES.map(code => [code, openings[code] - (code === 'KWD' ? 7 : spends[code])]));
  const archive = await readArchive(db);
  assert.deepEqual(totalsByCurrency(snapshotFromArchive(archive)), expected);
  assert.deepEqual(archiveExponents(archive), { ARS: 2, USD: 2, CLP: 0, EUR: 2, GBP: 2, JPY: 0, KWD: 3 });
  assert.deepEqual(archive.currencyUnits!.map(unit => [unit.currency, unit.minorUnitExponent]), [['CLP', 0], ['EUR', 2], ['GBP', 2], ['JPY', 0], ['KWD', 3]]);
  const backup = createRecoveryBackup(archive);
  assert.equal(backup.schema, 'finanzapp.native-pilot.v9');
  const incoming = parsePilotBackup(JSON.stringify(backup)).archive;
  const other = setup().db;
  await initializeDatabase(other);
  await importArchive(other, incoming, archiveKey(await readArchive(other))); // The release gate: restoring never consults it.
  const restored = await readArchive(other);
  assert.equal(archiveKey(restored), archiveKey(archive));
  assert.deepEqual(totalsByCurrency(snapshotFromArchive(restored)), expected);
  assert.deepEqual(restored.records.map(record => [record.entry.id, record.entry.amountMinor]).sort(), archive.records.map(record => [record.entry.id, record.entry.amountMinor]).sort());
  assert.deepEqual(restored.accounts.map(item => [item.id, item.currency]).sort(), archive.accounts.map(item => [item.id, item.currency]).sort());
  await db.closeAsync();
  const reopened = databaseAt(path);
  await initializeDatabase(reopened);
  assert.equal(archiveKey(await readArchive(reopened)), archiveKey(archive), 'reopening changes nothing');
  // With the release gate the stored currencies keep working; only creating a NEW record in them is refused.
  await createEntry(reopened, { ...expense, id: 'e-GBP-2', accountId: 'acc-GBP', amountMinor: 1 });
  await assert.rejects(createAccount(reopened, { id: 'acc-GBP-2', name: 'x', currency: 'GBP', openingMinor: 0, createdAt: account.createdAt }), /moneda disponible/);
  assert.equal(totalsByCurrency(await readSnapshot(reopened)).GBP, expected.GBP - 1);
});

// ---- Producto 24B6: what a card may carry, in real SQLite ------------------------------------------------

test('24B6: a plain income never lands on a card (new, edited onto it, turned into one, or recurring); a purchase and a payment still do what they did', async () => {
  const { db } = await funded();
  await createCreditCard(db, cardAccount, card);
  await createPersonalDebt(db, debtAccount, debt);
  const income: Entry = { ...expense, id: 'salary', kind: 'income', amountMinor: 500000, merchant: 'Sueldo', category: 'Sueldo' };
  await assert.rejects(createEntry(db, { ...income, accountId: cardAccount.id }), /Un ingreso se registra en una cuenta normal, no en una tarjeta\./);
  await assert.rejects(createEntry(db, { ...income, accountId: debtAccount.id }), /pagos o cobros/, 'the debt refusal is unchanged');
  await createEntry(db, income);
  await assert.rejects(changeEntry(db, makeEntryChange('onto-card', initialRecord(income), 'edit', changedAt, { ...income, accountId: cardAccount.id })), /no en una tarjeta/, 'an income cannot be moved onto a card');
  await createEntry(db, purchase);
  await assert.rejects(changeEntry(db, makeEntryChange('into-income', initialRecord(purchase), 'edit', changedAt, { ...purchase, kind: 'income' })), /no en una tarjeta/, 'a purchase cannot become a card income');
  await assert.rejects(saveRecurringRule(db, { ...recurring, id: 'card-salary', kind: 'income', accountId: cardAccount.id }), /no en una tarjeta/);
  await saveRecurringRule(db, { ...recurring, id: 'card-subscription', accountId: cardAccount.id }); // A recurring purchase on the card is fine.
  await createTransfer(db, cardPayment);
  const snapshot = await readSnapshot(db);
  assert.deepEqual(snapshot.entries.map(entry => entry.id).sort(), ['card-purchase', 'salary', 'test-entry'], 'nothing refused was written');
  assert.equal(cardDebtMinor(card, snapshot), 20000 + 23100 - 30000);
  assert.equal(accountBalanceMinor(account, snapshot.entries, snapshot.transfers), 100000 - 12345 + 500000 - 30000);
  const overview = spendingOverview(snapshot, { currency: 'ARS', startISO: '2026-09-01', endISO: '2026-09-30' });
  assert.equal(overview.status === 'ready' && overview.expenseMinor, 12345 + 23100, 'the purchase counts once; the payment never');
});

test('24B6: a historical income stored on a card (a restored copy) stays readable, correctable in place, undoable and restorable; moving it to cash is allowed, onto another card is not', async () => {
  const { db, path } = await funded();
  await createCreditCard(db, cardAccount, card);
  const otherCardAccount: Account = { ...cardAccount, id: 'card-two', name: 'Master' };
  await createCreditCard(db, otherCardAccount, { ...card, id: 'card-two-fixture', accountId: otherCardAccount.id });
  // The refund arrived through a backup made before 24B6: the import reads rows as they are.
  const refund: Entry = { ...expense, id: 'refund', kind: 'income', accountId: cardAccount.id, amountMinor: 2500, merchant: 'Devolución Starbucks', category: 'Café' };
  const before = await readArchive(db);
  const copy = { ...before, records: [...before.records, initialRecord(refund)] };
  await importArchive(db, copy, archiveKey(before));
  let snapshot = await readSnapshot(db);
  assert.equal(cardDebtMinor(card, snapshot), 20000 - 2500, 'the refund lowers the card debt as before');
  const corrected: Entry = { ...refund, amountMinor: 2600, merchant: 'Devolución Starbucks (ajuste)' };
  await changeEntry(db, makeEntryChange('fix-refund', initialRecord(refund), 'edit', changedAt, corrected));
  await changeEntry(db, makeEntryChange('fix-refund', initialRecord(refund), 'edit', changedAt, corrected)); // Retry after a failed refresh.
  snapshot = await readSnapshot(db);
  assert.equal(cardDebtMinor(card, snapshot), 20000 - 2600, 'corrected in place, on the card');
  const current = (await readArchive(db)).records.find(record => record.entry.id === 'refund')!;
  await assert.rejects(changeEntry(db, makeEntryChange('to-other-card', current, 'edit', changedAt, { ...corrected, accountId: otherCardAccount.id })), /no en una tarjeta/);
  await changeEntry(db, makeEntryChange('undo-refund', current, 'void', changedAt));
  const voided = (await readArchive(db)).records.find(record => record.entry.id === 'refund')!;
  assert.equal(voided.voided, true);
  await changeEntry(db, makeEntryChange('restore-refund', voided, 'restore', '2026-09-14T12:00:00.000Z'));
  const restored = (await readArchive(db)).records.find(record => record.entry.id === 'refund')!;
  assert.equal(restored.voided, false, 'restoring a historical card income is allowed: it stays where it was');
  await changeEntry(db, makeEntryChange('to-cash', restored, 'edit', '2026-09-14T13:00:00.000Z', { ...corrected, accountId: account.id }));
  await db.closeAsync();
  const reopened = databaseAt(path);
  await initializeDatabase(reopened);
  snapshot = await readSnapshot(reopened);
  assert.equal(snapshot.entries.find(entry => entry.id === 'refund')?.accountId, account.id, 'an income may always move to cash');
  assert.equal(cardDebtMinor(card, snapshot), 20000);
  assert.equal(accountBalanceMinor(account, snapshot.entries, snapshot.transfers), 100000 - 12345 + 2600);
});

test('24B6: a new transfer never leaves a card or joins two obligations; card and debt payments and collections still work; a historical card-source transfer stays editable and restorable but cannot take new invalid sides', async () => {
  const { db } = await funded();
  await createCreditCard(db, cardAccount, card);
  await createPersonalDebt(db, debtAccount, debt);
  const receivableAccount: Account = { id: 'receivable-account', name: 'Me deben · Ana', currency: 'ARS', openingMinor: 15000, createdAt: account.createdAt };
  await createPersonalDebt(db, receivableAccount, { ...debt, id: 'receivable', accountId: receivableAccount.id, direction: 'owed_to_me', counterparty: 'Ana', dueDateISO: null });
  const transfer = (id: string, fromAccountId: string, toAccountId: string, amountMinor = 1000): Transfer => ({ id, fromAccountId, toAccountId, amountMinor, note: id, dateISO: '2026-09-15', createdAt: account.createdAt });
  await assert.rejects(createTransfer(db, transfer('cash-advance', cardAccount.id, account.id)), /Una tarjeta se paga desde una cuenta; no puede ser el origen de una transferencia\./);
  await assert.rejects(createTransfer(db, transfer('card-to-debt', cardAccount.id, debtAccount.id)), /no puede ser el origen/);
  await assert.rejects(createTransfer(db, transfer('debt-to-card', debtAccount.id, cardAccount.id)), /Una transferencia entre dos obligaciones no se puede registrar\./);
  await assert.rejects(createTransfer(db, transfer('receivable-to-debt', receivableAccount.id, debtAccount.id)), /entre dos obligaciones/);
  await createTransfer(db, transfer('card-payment', account.id, cardAccount.id, 15000));
  await createTransfer(db, transfer('debt-payment', account.id, debtAccount.id, 10000));
  await createTransfer(db, transfer('collection', receivableAccount.id, account.id, 5000));
  let snapshot = await readSnapshot(db);
  assert.deepEqual((snapshot.transfers ?? []).map(item => item.id).sort(), ['card-payment', 'collection', 'debt-payment'], 'nothing refused was written');
  assert.equal(cardDebtMinor(card, snapshot), 20000 - 15000, 'the card payment lowered the opening debt');
  assert.equal(accountBalanceMinor(account, snapshot.entries, snapshot.transfers), 100000 - 12345 - 15000 - 10000 + 5000);
  // A card-source transfer from before 24B6 arrives through a copy: read as it is.
  const archive = await readArchive(db);
  const legacy = transfer('legacy-advance', cardAccount.id, account.id, 700);
  await importArchive(db, { ...archive, transfers: [...archive.transfers ?? [], initialTransferRecord(legacy)] }, archiveKey(archive));
  snapshot = await readSnapshot(db);
  assert.equal(cardDebtMinor(card, snapshot), 5000 + 700, 'the historical row counts as stored: money left the card');
  await changeTransfer(db, makeTransferChange('fix-legacy', initialTransferRecord(legacy), 'edit', changedAt, { ...legacy, amountMinor: 800 }));
  const fixed = (await readArchive(db)).transfers!.find(item => item.transfer.id === 'legacy-advance')!;
  assert.equal(fixed.transfer.amountMinor, 800, 'its amount can be corrected with its sides kept');
  await assert.rejects(changeTransfer(db, makeTransferChange('legacy-to-debt', fixed, 'edit', '2026-09-14T12:00:00.000Z', { ...fixed.transfer, toAccountId: debtAccount.id })), /no puede ser el origen/, 'new sides must be sides a new transfer could have');
  await changeTransfer(db, makeTransferChange('undo-legacy', fixed, 'void', '2026-09-14T12:00:00.000Z'));
  const voided = (await readArchive(db)).transfers!.find(item => item.transfer.id === 'legacy-advance')!;
  await changeTransfer(db, makeTransferChange('restore-legacy', voided, 'restore', '2026-09-14T13:00:00.000Z'));
  assert.equal((await readArchive(db)).transfers!.find(item => item.transfer.id === 'legacy-advance')!.voided, false, 'undo and restore keep working on a historical row');
  await changeTransfer(db, makeTransferChange('legacy-fixed-sides', (await readArchive(db)).transfers!.find(item => item.transfer.id === 'legacy-advance')!, 'edit', '2026-09-14T14:00:00.000Z', { ...fixed.transfer, fromAccountId: account.id, toAccountId: cardAccount.id }));
  assert.equal(cardDebtMinor(card, await readSnapshot(db)), 5000 - 800, 'turned into the payment it should have been');
});
