import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { accountBalanceMinor, type Account, type Entry } from '@finanzapp/domain';
import { createAccount, createEntry, initializeDatabase, readSnapshot, type LedgerDatabase } from '../src/storage/database.ts';
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
  assert.equal((await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version, 1);
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
    await tx.runAsync(`INSERT INTO entries VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
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
  await db.execAsync('PRAGMA user_version = 2');
  await assert.rejects(initializeDatabase(db), /versión más nueva/);
  assert.equal((await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version, 2);
  assert.deepEqual((await readSnapshot(db)).accounts, [account]);
});

test('an invalid stored date blocks reading balances and retains the original rows', async () => {
  const { db } = setup();
  await initializeDatabase(db);
  await createAccount(db, account);
  await db.runAsync('INSERT INTO entries VALUES (?, ?, ?, ?, ?, ?, ?, ?)', expense.id, account.id,
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
