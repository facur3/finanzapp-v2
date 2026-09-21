import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { accountBalanceMinor, archiveKey, createRecoveryBackup, initialRecord, makeEntryChange, parsePilotBackup, snapshotFromArchive, totalsByCurrency, type Account, type Entry,
  makeAccountChange, initialTransferRecord, makeTransferChange, type Transfer, type RecurringRule, type MonthlyBudget,
  cardDebtMinor, debtOutstandingMinor, liquidTotalsByCurrency, spendingOverview, type CreditCardProfile, type PersonalDebtProfile } from '@finanzapp/domain';
import { changeEntry, createAccount, createEntry, importArchive, initializeDatabase, readArchive, readSnapshot, changeAccount,
  createTransfer, changeTransfer, saveRecurringRule, processRecurring, saveMonthlyBudget,
  createCreditCard, saveCreditCard, createPersonalDebt, savePersonalDebt, type LedgerDatabase } from '../src/storage/database.ts';
import { runExclusiveTransaction, type TransactionConnection } from '../src/storage/transaction.ts';

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
    withExclusiveTransactionAsync: work => runExclusiveTransaction(async () => connection(path), work) };
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
  assert.equal((await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version, 7);
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
  await db.execAsync('PRAGMA user_version = 8');
  await assert.rejects(initializeDatabase(db), /versión más nueva/);
  assert.equal((await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version, 8);
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
  await db.execAsync('PRAGMA user_version = 3; DROP TABLE IF EXISTS recurring_rules; DROP TABLE IF EXISTS monthly_budgets; DROP TABLE IF EXISTS credit_cards; DROP TABLE IF EXISTS personal_debts;');
  await initializeDatabase(db);
  assert.equal((await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version, 7);
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
  await db.execAsync('DROP TABLE monthly_budgets; DROP TABLE credit_cards; DROP TABLE personal_debts; PRAGMA user_version = 4;');
  await initializeDatabase(db);
  const after = await readArchive(db);
  assert.equal((await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version, 7);
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

test('v5 backup/import preserves active and archived budgets without duplicating them', async () => {
  const { db } = setup();
  await initializeDatabase(db);
  await createAccount(db, account);
  await saveMonthlyBudget(db, monthlyBudget);
  const archived: MonthlyBudget = { ...monthlyBudget, active: false, revision: 1, updatedAt: changedAt };
  await saveMonthlyBudget(db, archived);
  const original = await readArchive(db);
  const backup = createRecoveryBackup(original);
  assert.equal(backup.schema, 'finanzapp.native-pilot.v7');
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
  await db.execAsync('DROP TABLE monthly_budgets;' + V6_BUDGETS_TABLE + " PRAGMA user_version = 6;");
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
  assert.equal((await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version, 7);
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
  assert.equal(backup.schema, 'finanzapp.native-pilot.v7');
  assert.equal(archiveKey(parsePilotBackup(JSON.stringify(backup)).archive), archiveKey(archive));
  const { scope: _scope, ...legacyRow } = monthlyBudget;
  const v6 = { ...createRecoveryBackup({ accounts: archive.accounts, records: archive.records }), schema: 'finanzapp.native-pilot.v6', budgets: [legacyRow] };
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
  await db.execAsync('DROP TABLE credit_cards; DROP TABLE personal_debts; PRAGMA user_version = 5;');
  const failing: LedgerDatabase = { ...db, withExclusiveTransactionAsync: work => db.withExclusiveTransactionAsync(tx => work({ ...tx,
    execAsync: async sql => { await tx.execAsync(sql); if (sql.includes('personal_debts')) throw new Error('Interrupted v6'); },
  })) };
  await assert.rejects(initializeDatabase(failing), /Interrupted v6/);
  assert.equal((await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version, 5);
  await initializeDatabase(db);
  const after = await readArchive(db);
  assert.equal((await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version, 7);
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
  assert.equal(backup.schema, 'finanzapp.native-pilot.v7');
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
