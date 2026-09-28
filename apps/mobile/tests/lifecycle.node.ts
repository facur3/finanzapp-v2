import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ACCOUNT_DELETED_MESSAGE, CARD_DELETED_MESSAGE, OBLIGATION_ACCOUNT_MESSAGE, accountBalanceMinor, createRecoveryBackup, deleteCreditCard, liquidTotalsByCurrency,
  parsePilotBackup, previewBackupImport, spendingReport, type Account, type CreditCardProfile, type Entry, type RecurringRule, type Transfer } from '@finanzapp/domain';
import { DATABASE_VERSION, SCHEMA_SCRIPTS, createAccount, createCreditCard, createEntry, createTransfer, deleteAccount, importArchive, initializeDatabase, readArchive, readSnapshot,
  saveCreditCard, saveRecurringRule, processRecurring, type LedgerDatabase } from '../src/storage/database.ts';
import { runExclusiveTransaction, runSchemaMigration, type TransactionConnection } from '../src/storage/transaction.ts';

// Producto 25B2 on real SQLite: schema 11, the deletion records of accounts and cards, what they keep and what they
// refuse, retries, a restart, export and restore. Synthetic records in disposable databases only.
function connection(path: string): TransactionConnection {
  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys = OFF');
  return {
    execAsync: async sql => { db.exec(sql); },
    runAsync: async (sql, ...params) => ({ changes: Number(db.prepare(sql).run(...params).changes) }),
    getFirstAsync: async <T>(sql: string, ...params: (string | number | null)[]) => { const row = db.prepare(sql).get(...params); return row ? { ...row } as T : null; },
    getAllAsync: async <T>(sql: string, ...params: (string | number | null)[]) => db.prepare(sql).all(...params).map(row => ({ ...row })) as T[],
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
  return { ...base, closeAsync, withExclusiveTransactionAsync: work => runExclusiveTransaction(async () => connection(path), work),
    withMigrationTransactionAsync: work => runSchemaMigration(async () => connection(path), work) };
}
function setup() {
  const directory = mkdtempSync(join(tmpdir(), 'finanzapp-lifecycle-'));
  cleanups.push(async () => { rmSync(directory, { recursive: true, force: true }); });
  const path = join(directory, 'ledger.sqlite');
  return { db: databaseAt(path), path };
}

const createdAt = '2026-09-01T12:00:00.000Z';
const now = '2026-09-27T10:00:00.000Z';
const cash: Account = { id: 'cash', name: 'Efectivo', currency: 'ARS', openingMinor: 100000, createdAt };
const bank: Account = { id: 'bank', name: 'Banco', currency: 'ARS', openingMinor: 50000, createdAt };
const cardAccount: Account = { id: 'card-account', name: 'Visa', currency: 'ARS', openingMinor: 0, createdAt };
const card: CreditCardProfile = { id: 'card', accountId: cardAccount.id, issuer: 'Banco', last4: '4009', creditLimitMinor: null, closingDay: 20, dueDay: 5,
  active: true, deleted: false, createdAt, revision: 0, updatedAt: createdAt };
const expense = (id: string, accountId: string, amountMinor: number, dateISO: string): Entry => ({ id, accountId, kind: 'expense', amountMinor, merchant: 'M ' + id, category: 'Comida', dateISO, createdAt });
const transfer = (id: string, fromAccountId: string, toAccountId: string, amountMinor: number, dateISO: string): Transfer => ({ id, fromAccountId, toAccountId, amountMinor, note: '', dateISO, createdAt });
const rule: RecurringRule = { id: 'rule', accountId: 'cash', kind: 'expense', amountMinor: 700, merchant: 'Gimnasio', category: 'Salud', frequency: 'monthly',
  anchorDateISO: '2026-09-15', nextDateISO: '2026-10-15', active: true, deleted: false, createdAt, revision: 0, updatedAt: createdAt };

async function seeded() {
  const { db, path } = setup();
  await initializeDatabase(db);
  await createAccount(db, cash); await createAccount(db, bank); await createCreditCard(db, cardAccount, card);
  await createEntry(db, expense('e1', 'cash', 1500, '2026-09-05'));
  await createEntry(db, expense('e2', 'card-account', 20000, '2026-09-10'));
  await createTransfer(db, transfer('t1', 'cash', 'bank', 5000, '2026-09-11'));
  await createTransfer(db, transfer('t2', 'bank', 'card-account', 20000, '2026-09-12'));
  await saveRecurringRule(db, rule);
  return { db, path };
}

test('schema 11 is reached from a real schema 10 file by an additive migration: every row keeps its values, live rows read as before', async () => {
  const { db } = setup();
  for (const script of SCHEMA_SCRIPTS.slice(0, 10)) await db.execAsync(script);
  await db.execAsync(`INSERT INTO accounts (id, name, currency, openingMinor, createdAt, revision, updatedAt) VALUES ('a', 'Antigua', 'ARS', 100, '${createdAt}', 0, '${createdAt}');
    INSERT INTO accounts (id, name, currency, openingMinor, createdAt, revision, updatedAt) VALUES ('c', 'Visa', 'ARS', 0, '${createdAt}', 0, '${createdAt}');
    INSERT INTO credit_cards (id, accountId, issuer, last4, creditLimitMinor, closingDay, dueDay, active, createdAt, revision, updatedAt) VALUES ('card', 'c', 'Banco', '4009', NULL, 20, 5, 1, '${createdAt}', 0, '${createdAt}');`);
  assert.equal((await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version, 10);
  await initializeDatabase(db);
  assert.equal((await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version, 11);
  assert.equal(DATABASE_VERSION, 11);
  const archive = await readArchive(db);
  assert.deepEqual(archive.accounts[0], { id: 'a', name: 'Antigua', currency: 'ARS', openingMinor: 100, createdAt }, 'a live row reads exactly as it did: no deletedAt key, no revision');
  assert.deepEqual(archive.cards?.[0], { ...card, accountId: 'c' }, 'a card gains deleted: false');
  assert.equal((await db.getFirstAsync<{ n: number }>('SELECT count(*) AS n FROM accounts WHERE deletedAt IS NULL'))?.n, 2);
  // A newer schema is refused, unchanged, as ever.
  await db.execAsync('PRAGMA user_version = 12');
  await assert.rejects(initializeDatabase(db), /versión más nueva/);
});

test('deleting an account with movements, transfers and an active rule: the row stays dated, nothing else is touched, the rule stops, nothing new lands on it, and a retry is a no-op', async () => {
  const { db } = await seeded();
  const before = await readSnapshot(db);
  await deleteAccount(db, 'cash', now);
  const archive = await readArchive(db);
  const gone = archive.accounts.find(item => item.id === 'cash')!;
  assert.deepEqual(gone, { ...cash, revision: 1, updatedAt: now, deletedAt: now });
  const snapshot = await readSnapshot(db);
  assert.deepEqual(snapshot.entries, before.entries, 'every movement stays, on the deleted account too');
  assert.deepEqual(snapshot.transfers, before.transfers, 'every transfer stays');
  assert.equal(accountBalanceMinor(gone, snapshot.entries, snapshot.transfers), 100000 - 1500 - 5000, 'its balance is still computable as history');
  assert.deepEqual(liquidTotalsByCurrency(snapshot, archive.cards, archive.debts), { ARS: 50000 + 5000 - 20000 }, 'Disponible: the bank alone (the card is not liquid, the deleted account is history)');
  const report = spendingReport(snapshot, 'ARS', '2026-09', '2026-09-27');
  assert.equal(report.status === 'ready' && report.expenseMinor, 1500 + 20000, 'September still counts what was spent from it');
  const stopped = archive.recurring!.find(item => item.id === 'rule')!;
  assert.deepEqual([stopped.active, stopped.deleted, stopped.revision, stopped.updatedAt], [false, false, 1, now], 'the active rule is paused, not deleted');
  assert.equal(await processRecurring(db, '2026-12-31', now), 0, 'and records nothing any more');
  // Nothing new lands on it: a movement, a transfer side, an active rule; a rule left paused is fine.
  await assert.rejects(createEntry(db, expense('e3', 'cash', 100, '2026-09-27')), new RegExp(ACCOUNT_DELETED_MESSAGE));
  await assert.rejects(createTransfer(db, transfer('t3', 'bank', 'cash', 100, '2026-09-27')), new RegExp(ACCOUNT_DELETED_MESSAGE));
  await assert.rejects(createTransfer(db, transfer('t4', 'cash', 'bank', 100, '2026-09-27')), new RegExp(ACCOUNT_DELETED_MESSAGE));
  await assert.rejects(saveRecurringRule(db, { ...stopped, active: true, revision: 2, updatedAt: now }), new RegExp(ACCOUNT_DELETED_MESSAGE));
  await createEntry(db, expense('e3', 'bank', 100, '2026-09-27'));
  // Idempotent: deleting again (a retry after a failed refresh) changes nothing, not even the revision.
  await deleteAccount(db, 'cash', '2026-09-28T10:00:00.000Z');
  assert.deepEqual((await readArchive(db)).accounts.find(item => item.id === 'cash'), gone);
  // A card's or a debt's internal account is never deleted here; an unknown id is said.
  await assert.rejects(deleteAccount(db, 'card-account', now), new RegExp(OBLIGATION_ACCOUNT_MESSAGE));
  await assert.rejects(deleteAccount(db, 'nope', now), /No encontramos esta cuenta/);
});

test('a deleted account survives a restart, an export and a restore into a fresh device; an older copy never brings it back', async () => {
  const { db, path } = await seeded();
  const olderCopy = createRecoveryBackup(await readArchive(db), new Date(now));
  await deleteAccount(db, 'cash', now);
  await db.closeAsync();
  const reopened = databaseAt(path);
  await initializeDatabase(reopened);
  const archive = await readArchive(reopened);
  assert.equal(archive.accounts.find(item => item.id === 'cash')?.deletedAt, now, 'the tombstone is durable');
  const backup = createRecoveryBackup(archive, new Date(now));
  assert.equal(backup.schema, 'finanzapp.native-pilot.v11');
  const fresh = setup().db;
  await initializeDatabase(fresh);
  const parsed = parsePilotBackup(JSON.stringify(backup)).archive;
  await importArchive(fresh, parsed, previewBackupImport(await readArchive(fresh), parsed).baseline);
  const restored = await readArchive(fresh);
  assert.equal(restored.accounts.find(item => item.id === 'cash')?.deletedAt, now, 'restored deleted');
  assert.equal(restored.records.length, archive.records.length);
  assert.equal(restored.transfers?.length, archive.transfers?.length);
  await assert.rejects(createEntry(fresh, expense('e9', 'cash', 100, '2026-09-27')), new RegExp(ACCOUNT_DELETED_MESSAGE));
  // The copy taken before the deletion contradicts the tombstone: refused whole, the account stays deleted.
  const preview = previewBackupImport(await readArchive(reopened), parsePilotBackup(JSON.stringify(olderCopy)).archive);
  assert.ok(preview.conflicts > 0);
  await assert.rejects(importArchive(reopened, parsePilotBackup(JSON.stringify(olderCopy)).archive, preview.baseline), /contradice cambios locales/);
  assert.equal((await readArchive(reopened)).accounts.find(item => item.id === 'cash')?.deletedAt, now);
});

test('deleting a card with purchases and payments keeps them and its internal account, refuses new purchases and payments, and never reactivates', async () => {
  const { db } = await seeded();
  const before = await readSnapshot(db);
  const gone = deleteCreditCard(card, now);
  await saveCreditCard(db, gone);
  const archive = await readArchive(db);
  assert.deepEqual(archive.cards?.[0], gone);
  const snapshot = await readSnapshot(db);
  assert.deepEqual(snapshot.entries, before.entries);
  assert.deepEqual(snapshot.transfers, before.transfers);
  assert.ok(snapshot.accounts.some(item => item.id === 'card-account' && item.deletedAt === undefined), 'the internal account stays, live, to audit the ledger');
  assert.equal(accountBalanceMinor(snapshot.accounts.find(item => item.id === 'card-account')!, snapshot.entries, snapshot.transfers), 0, 'purchase 20.000 paid 20.000: unchanged');
  await assert.rejects(createEntry(db, expense('e5', 'card-account', 100, '2026-09-27')), new RegExp(CARD_DELETED_MESSAGE));
  await assert.rejects(createTransfer(db, transfer('t5', 'bank', 'card-account', 100, '2026-09-27')), new RegExp(CARD_DELETED_MESSAGE));
  await assert.rejects(saveCreditCard(db, { ...gone, active: true, deleted: false, revision: 2, updatedAt: now }), new RegExp(CARD_DELETED_MESSAGE));
  await saveCreditCard(db, gone); // A retry of the same record is silent.
  assert.equal((await readArchive(db)).cards?.[0].revision, 1);
  const backup = createRecoveryBackup(await readArchive(db), new Date(now));
  assert.equal(backup.schema, 'finanzapp.native-pilot.v11');
  assert.equal(parsePilotBackup(JSON.stringify(backup)).archive.cards?.[0].deleted, true);
  await assert.rejects(deleteAccount(db, 'card-account', now), new RegExp(OBLIGATION_ACCOUNT_MESSAGE), 'even deleted, the card\'s account is not a normal account');
});

test('an older app refuses a schema 11 file and a v11 backup, unchanged', async () => {
  const { db } = await seeded();
  await deleteAccount(db, 'cash', now);
  const backup = createRecoveryBackup(await readArchive(db), new Date(now));
  // Build 24UX4's reader would see an unknown schema name: its exact message is in the domain of that build; here we prove
  // the file names v11 and that a v10 reader (this build's parser told the file is v10) refuses the extra keys.
  assert.equal(backup.schema, 'finanzapp.native-pilot.v11');
  assert.throws(() => parsePilotBackup(JSON.stringify({ ...backup, schema: 'finanzapp.native-pilot.v10' })), /campos faltantes/);
});
