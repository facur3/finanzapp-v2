import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { accountBalanceMinor, archiveKey, createRecoveryBackup, initialRecord, makeEntryChange, parsePilotBackup, snapshotFromArchive, totalsByCurrency, type Account, type Entry } from '@finanzapp/domain';
import { changeEntry, createAccount, createEntry, importArchive, initializeDatabase, readArchive, readSnapshot, type LedgerDatabase } from '../src/storage/database.ts';
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
  assert.equal((await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version, 2);
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
    await tx.runAsync('INSERT INTO accounts VALUES (?, ?, ?, ?, ?)', account.id, account.name, account.currency, account.openingMinor, account.createdAt);
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
  await db.execAsync('PRAGMA user_version = 3');
  await assert.rejects(initializeDatabase(db), /versión más nueva/);
  assert.equal((await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version, 3);
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

test('v2 backup restores edited and undone entries into a new database and re-import never doubles balances', async () => {
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
