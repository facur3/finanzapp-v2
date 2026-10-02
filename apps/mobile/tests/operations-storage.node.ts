import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as domain from '@finanzapp/domain';
import { CARD_DELETED_MESSAGE, OPERATION_CHANGED_MESSAGE, OPERATION_EXISTS_MESSAGE, OPERATION_ID_MESSAGE, OPERATION_IMPORT_MESSAGE, OPERATION_STATE_MESSAGE,
  PLAN_NOTHING_TO_STOP_MESSAGE, PLAN_OPERATION_HISTORY_MESSAGE, REFUND_DATE_MESSAGE, REFUND_OVER_MESSAGE, accountBalanceMinor, cardDebtMinor, createRecoveryBackup,
  installmentPlanFigures, makeOperationChange, newEntryRefund, newInstallmentPlan, newPlanPayoff, newPlanRefund, operationGuardMessages, parsePilotBackup,
  previewBackupImport, todayKey, type Account, type CreditCardProfile, type Entry, type LedgerArchive, type PurchaseOperation } from '@finanzapp/domain';
import { DATABASE_VERSION, SCHEMA_SCRIPTS, cancelInstallmentPlan, catchUpInstallments, changeEntry, changePurchaseOperation, createAccount, createCreditCard, createEntry, createInstallmentPlan,
  createPurchaseOperation, deleteCreditCard, deleteInstallmentPlan, importArchive, initializeDatabase, reactivateInstallmentPlan, readArchive, readSnapshot,
  type LedgerDatabase } from '../src/storage/database.ts';
import { savePurchaseOperation } from '../src/storage/ledger-session.ts';
import { runExclusiveTransaction, runSchemaMigration, type TransactionConnection } from '../src/storage/transaction.ts';
import { localizeError } from '../src/i18n/errors.ts';

// Producto 24T3 on real SQLite: schema 14 (devoluciones and adelantos de cuotas, `purchase_operations` and the receipts of
// their undo and restore in `operation_changes`), every write in one exclusive transaction with the plan's catch-up inside
// it (A8), retries by id and by receipt, stale previews refused (A13), the stop that records what closed first (bug M3), the
// reactivation, rollbacks, and backup v14. Synthetic records in disposable databases only.
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
  const directory = mkdtempSync(join(tmpdir(), 'finanzapp-operations-'));
  cleanups.push(async () => { rmSync(directory, { recursive: true, force: true }); });
  const path = join(directory, 'ledger.sqlite');
  return { db: databaseAt(path), path };
}
/** The same database with one write refused the way SQLite refuses it, only while armed and `test` matches the statement. */
function failingOn(db: LedgerDatabase, test: (sql: string, params: (string | number | null)[]) => boolean, message: string) {
  let armed = true;
  const wrapped = { ...db, withExclusiveTransactionAsync: (work: Parameters<LedgerDatabase['withExclusiveTransactionAsync']>[0]) =>
    db.withExclusiveTransactionAsync(tx => work({ ...tx, runAsync: async (sql: string, ...params: (string | number | null)[]) => {
      if (armed && test(sql, params)) throw new Error(message);
      return tx.runAsync(sql, ...params);
    } })) } as LedgerDatabase;
  return { db: wrapped, heal: () => { armed = false; } };
}
const insertOf = (prefix: string) => (sql: string, params: (string | number | null)[]) => sql.startsWith('INSERT INTO entries') && String(params[0]).startsWith(prefix);
const operationInsert = (sql: string) => sql.startsWith('INSERT INTO purchase_operations');

const createdAt = '2026-09-01T12:00:00.000Z';
const now = '2026-10-25T15:00:00.000Z';
const bank: Account = { id: 'bank', name: 'Banco', currency: 'ARS', openingMinor: 500000, createdAt };
const cardAccount: Account = { id: 'card-account', name: 'Visa', currency: 'ARS', openingMinor: 0, createdAt };
const card: CreditCardProfile = { id: 'card', accountId: cardAccount.id, issuer: 'Banco', last4: '4009', creditLimitMinor: 1000000, closingDay: 20, dueDay: 5,
  active: true, deleted: false, createdAt, revision: 0, updatedAt: createdAt };
const expense = (id: string, accountId: string, amountMinor: number, dateISO: string): Entry => ({ id, accountId, kind: 'expense', amountMinor, merchant: 'M ' + id, category: 'Comida', dateISO, createdAt });
/** 120.000,00 in 12 × 10.000,00, bought 2026-09-10; the first instalment closes 2026-09-20, then the 20th of each month. */
const tv = newInstallmentPlan({ id: 'tv', card, cardAccount, merchant: 'Electro', category: 'Hogar', purchaseDateISO: '2026-09-10', principalMinor: 120000, count: 12, placement: 'current', createdAt });

async function seeded(throughISO = '2026-10-25') {
  const { db, path } = setup();
  await initializeDatabase(db);
  await createAccount(db, bank);
  await createCreditCard(db, cardAccount, card);
  await createEntry(db, expense('cash1', 'bank', 40000, '2026-10-01'));
  await createEntry(db, expense('p1', 'card-account', 23100, '2026-09-10'));
  await createInstallmentPlan(db, tv);
  await catchUpInstallments(db, throughISO);
  return { db, path };
}
const operationsOf = async (db: LedgerDatabase) => (await readArchive(db)).purchaseOperations ?? [];
const operationOf = async (db: LedgerDatabase, id: string) => (await operationsOf(db)).find(item => item.id === id)!;
const instalmentIds = async (db: LedgerDatabase) => (await readArchive(db)).records.map(record => record.entry.id).filter(id => id.startsWith('inst')).sort();
const count = async (db: LedgerDatabase, table: string) => (await db.getFirstAsync<{ n: number }>(`SELECT count(*) AS n FROM ${table}`))!.n;
const version = async (db: LedgerDatabase) => (await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version;

test('schema 14 is reached from a real schema 13 file by an additive migration: two empty tables, every row untouched, no operation fabricated; an interrupted step reaches 14 once; a newer file is refused intact', async () => {
  const { db } = setup();
  for (const script of SCHEMA_SCRIPTS.slice(0, 13)) await db.execAsync(script);
  await db.execAsync(`INSERT INTO accounts (id, name, currency, openingMinor, createdAt, revision, updatedAt) VALUES ('card-account', 'Visa', 'ARS', 0, '${createdAt}', 0, '${createdAt}');
    INSERT INTO credit_cards (id, accountId, issuer, last4, creditLimitMinor, closingDay, dueDay, active, deleted, createdAt, revision, updatedAt) VALUES ('card', 'card-account', 'Banco', '4009', 1000000, 20, 5, 1, 0, '${createdAt}', 0, '${createdAt}');
    INSERT INTO entries (id, accountId, kind, amountMinor, merchant, category, dateISO, createdAt, revision, voided, updatedAt) VALUES ('p1', 'card-account', 'expense', 100, 'Súper', 'Comida', '2026-09-10', '${createdAt}', 0, 0, '${createdAt}');`);
  assert.equal(await version(db), 13);
  // A step that fails midway rolls back: the file stays a complete schema 13 file.
  const failing: LedgerDatabase = { ...db, withExclusiveTransactionAsync: work => db.withExclusiveTransactionAsync(tx => work({ ...tx,
    execAsync: async sql => { await tx.execAsync(sql); if (sql.includes('purchase_operations')) throw new Error('Interrupted v14'); } })) };
  await assert.rejects(initializeDatabase(failing), /Interrupted v14/);
  assert.equal(await version(db), 13);
  assert.equal((await db.getAllAsync<{ name: string }>("SELECT name FROM sqlite_master WHERE name IN ('purchase_operations', 'operation_changes')")).length, 0, 'the tables rolled back with their step');
  await initializeDatabase(db);
  assert.equal(await version(db), 14);
  assert.equal(DATABASE_VERSION, 14);
  const archive = await readArchive(db);
  assert.equal(archive.purchaseOperations, undefined, 'old data gets no operation: the archive reads exactly as before');
  assert.deepEqual(archive.records[0].entry, { id: 'p1', accountId: 'card-account', kind: 'expense', amountMinor: 100, merchant: 'Súper', category: 'Comida', dateISO: '2026-09-10', createdAt });
  assert.deepEqual([await count(db, 'purchase_operations'), await count(db, 'operation_changes')], [0, 0]);
  // IF NOT EXISTS: a file that already has the tables (an interrupted step after the CREATE) reaches 14 once more.
  await db.execAsync('PRAGMA user_version = 13');
  await initializeDatabase(db);
  assert.equal(await version(db), 14);
  await db.execAsync('PRAGMA user_version = 15');
  await assert.rejects(initializeDatabase(db), /versión más nueva/);
  assert.equal(await version(db), 15, 'refused unchanged');
  await db.execAsync('PRAGMA user_version = 14');
  // The schema holds on its own: a target must exist, exactly one target, an adelanto always targets a plan, credit only on a
  // plan devolución, a first revision is live, a receipt needs its operation.
  const insert = (values: string) => db.withExclusiveTransactionAsync(async tx => { await tx.runAsync(`INSERT INTO purchase_operations (id, kind, targetEntryId, targetPlanId, accountId, currency,
    amountMinor, creditMinor, detailJSON, dateISO, voided, createdAt, revision, updatedAt) VALUES ${values}`); });
  await assert.rejects(insert(`('o1', 'refund', 'nope', NULL, 'card-account', 'ARS', 10, NULL, '{}', '2026-09-11', 0, '${createdAt}', 0, '${createdAt}')`), /FOREIGN KEY/);
  await assert.rejects(insert(`('o1', 'refund', NULL, NULL, 'card-account', 'ARS', 10, NULL, '{}', '2026-09-11', 0, '${createdAt}', 0, '${createdAt}')`), /CHECK/);
  await assert.rejects(insert(`('o1', 'payoff', 'p1', NULL, 'card-account', 'ARS', 10, NULL, '{}', '2026-09-11', 0, '${createdAt}', 0, '${createdAt}')`), /CHECK/);
  await assert.rejects(insert(`('o1', 'refund', 'p1', NULL, 'card-account', 'ARS', 10, 5, '{}', '2026-09-11', 0, '${createdAt}', 0, '${createdAt}')`), /CHECK/);
  await assert.rejects(insert(`('o1', 'refund', 'p1', NULL, 'card-account', 'ARS', 10, NULL, '{}', '2026-09-11', 1, '${createdAt}', 0, '${createdAt}')`), /CHECK/);
  await assert.rejects(insert(`('o1', 'refund', 'p1', NULL, 'card-account', 'ARS', 0, NULL, '{}', '2026-09-11', 0, '${createdAt}', 0, '${createdAt}')`), /CHECK/);
  await insert(`('o1', 'refund', 'p1', NULL, 'card-account', 'ARS', 10, NULL, '{}', '2026-09-11', 0, '${createdAt}', 0, '${createdAt}')`);
  assert.deepEqual((await readArchive(db)).purchaseOperations, [{ id: 'o1', kind: 'refund', target: { entryId: 'p1' }, accountId: 'card-account', currency: 'ARS', amountMinor: 10,
    dateISO: '2026-09-11', voided: false, createdAt, revision: 0, updatedAt: createdAt }], 'SQLite 0/1 reads as a boolean through the one parser');
  await assert.rejects(db.withExclusiveTransactionAsync(async tx => { await tx.runAsync("INSERT INTO operation_changes (id, operationId, action, beforeJSON, afterJSON) VALUES ('c', 'nope', 'void', '{}', '{}')"); }), /FOREIGN KEY/);
  // A row whose detail is malformed refuses the read with the recoverable message; the file is never reset.
  await db.withExclusiveTransactionAsync(async tx => { await tx.runAsync("UPDATE purchase_operations SET detailJSON = '{\"x\":1}' WHERE id = 'o1'"); });
  await assert.rejects(readArchive(db), new RegExp(domain.OPERATION_INVALID_MESSAGE));
  assert.equal(await count(db, 'purchase_operations'), 1);
});

test('a devolución of an ordinary expense: recorded once, retried by id, the same id with other data refused, capped, dated, and its line nets the purchase on its account', async () => {
  const { db } = await seeded();
  const refund = newEntryRefund(await readArchive(db), { id: 'r-cash', entryId: 'cash1', amountMinor: 15000, dateISO: '2026-10-20', todayISO: '2026-10-25', createdAt: now });
  await createPurchaseOperation(db, refund, '2026-10-25');
  assert.deepEqual(await operationOf(db, 'r-cash'), refund);
  const snapshot = await readSnapshot(db);
  assert.equal(accountBalanceMinor(bank, snapshot.entries, snapshot.transfers), 500000 - 40000 + 15000, 'the bank is credited back');
  const line = snapshot.entries.find(entry => entry.id === 'r-cash')!;
  assert.deepEqual([line.kind, line.amountMinor, line.category, line.dateISO, line.refund?.targetEntryId], ['expense', -15000, 'Comida', '2026-10-20', 'cash1'], 'a contra-expense in the purchase’s category');
  // A retry after a commit whose refresh failed: a no-op, even on another day.
  await createPurchaseOperation(db, refund, '2026-10-30');
  assert.equal((await operationsOf(db)).length, 1);
  // The same id with other inputs is refused; nothing changes.
  await assert.rejects(createPurchaseOperation(db, { ...refund, amountMinor: 1000 }, '2026-10-25'), new RegExp(OPERATION_EXISTS_MESSAGE));
  assert.deepEqual(await operationOf(db, 'r-cash'), refund);
  // Capped at what is left of the purchase; dated between the purchase and today (storage checks today too, A6/A14).
  const archive = await readArchive(db);
  const over = { ...refund, id: 'r-over', amountMinor: 25001 };
  await assert.rejects(createPurchaseOperation(db, over, '2026-10-25'), new RegExp(REFUND_OVER_MESSAGE));
  await assert.rejects(createPurchaseOperation(db, { ...refund, id: 'r-late', amountMinor: 100, dateISO: '2026-10-26' }, '2026-10-25'), new RegExp(REFUND_DATE_MESSAGE));
  await assert.rejects(createPurchaseOperation(db, { ...refund, id: 'r-early', amountMinor: 100, dateISO: '2026-09-30' }, '2026-10-25'), new RegExp(REFUND_DATE_MESSAGE));
  assert.equal(newEntryRefund(archive, { id: 'r-rest', entryId: 'cash1', amountMinor: 25000, dateISO: '2026-10-25', todayISO: '2026-10-25', createdAt: now }).amountMinor, 25000);
  assert.equal((await operationsOf(db)).length, 1, 'no refusal wrote anything');
  // A movement never takes an operation's id (createEntry does not run the archive validation).
  await assert.rejects(createEntry(db, expense('r-cash', 'bank', 100, '2026-10-25')), new RegExp(OPERATION_ID_MESSAGE));
  // The refunded purchase keeps what the devolución needs: it cannot be undone or lowered below it while the devolución lives.
  const purchase = (await readArchive(db)).records.find(record => record.entry.id === 'cash1')!;
  await assert.rejects(changeEntry(db, domain.makeEntryChange('undo-cash', purchase, 'void', now)), /devoluciones registradas/);
  await assert.rejects(changeEntry(db, domain.makeEntryChange('lower-cash', purchase, 'edit', now, { ...purchase.entry, amountMinor: 10000 })), /devoluciones registradas/);
});

test('a plan devolución: recognised principal first, then the last instalments; a preview made before a statement closed is refused whole and previews again after the catch-up', async () => {
  const { db } = await seeded('2026-10-25'); // tv 1 and 2 recognised (20.000)
  // The app stayed open across November 20 (no foreground, no catch-up): the form previews on a ledger that lacks tv 3.
  const preview = newPlanRefund(await readArchive(db), { id: 'r-plan', planId: 'tv', amountMinor: 25000, dateISO: '2026-11-21', todayISO: '2026-11-21', createdAt: now });
  assert.equal(preview.kind === 'refund' && 'creditMinor' in preview ? JSON.stringify([preview.creditMinor, preview.reductions]) : '', JSON.stringify([20000, [{ number: 12, minor: 5000 }]]));
  // Storage records tv 3 first, so 25.000 is all credit now. The allocation differs from the preview: refused, and nothing at
  // all is written (not even tv 3: one transaction).
  await assert.rejects(createPurchaseOperation(db, preview, '2026-11-21'), new RegExp(OPERATION_CHANGED_MESSAGE));
  // A date before the statement that closed since is refused by the floor (A6): no credit reverses later recognition.
  await assert.rejects(createPurchaseOperation(db, { ...preview, dateISO: '2026-10-25' }, '2026-11-21'), new RegExp(domain.PLAN_OPERATION_DATE_MESSAGE));
  assert.deepEqual([(await operationsOf(db)).length, (await instalmentIds(db)).length], [0, 2]);
  // Through the session helper the refusal stands, and the whole catch-up runs so the form previews from the new state.
  await assert.rejects(savePurchaseOperation(db, preview, '2026-11-21'), new RegExp(OPERATION_CHANGED_MESSAGE));
  assert.deepEqual(await instalmentIds(db), ['inst_tv_001', 'inst_tv_002', 'inst_tv_003']);
  const again = newPlanRefund(await readArchive(db), { id: 'r-plan', planId: 'tv', amountMinor: 25000, dateISO: '2026-11-21', todayISO: '2026-11-21', createdAt: now });
  await savePurchaseOperation(db, again, '2026-11-21');
  const stored = await operationOf(db, 'r-plan');
  assert.deepEqual(stored, again, 'what is stored is the allocation the person confirmed');
  assert.equal(JSON.stringify(['creditMinor' in stored && stored.creditMinor, 'reductions' in stored && stored.reductions]), JSON.stringify([25000, []]));
  const archive = await readArchive(db);
  const figures = installmentPlanFigures(archive.installmentPlans![0], archive.records, archive.purchaseOperations ?? []);
  assert.deepEqual([figures.recognisedMinor, figures.refundedCreditMinor, figures.scheduledMinor, figures.refundedMinor], [30000, 25000, 90000, 25000]);
  assert.equal(cardDebtMinor(card, await readSnapshot(db)), 23100 + 30000 - 25000);
  // A devolución that reaches the tail: the last instalment is recorded at its reduced amount when its statement closes.
  const tail = newPlanRefund(archive, { id: 'r-tail', planId: 'tv', amountMinor: 17000, dateISO: '2026-11-21', todayISO: '2026-11-21', createdAt: now });
  await createPurchaseOperation(db, tail, '2026-11-21');
  assert.equal(JSON.stringify('reductions' in tail && tail.reductions), JSON.stringify([{ number: 11, minor: 2000 }, { number: 12, minor: 10000 }]), 'credit left 5.000; the rest from the last instalment back');
  await catchUpInstallments(db, '2030-01-01');
  const entries = (await readSnapshot(db)).entries;
  assert.equal(entries.find(entry => entry.id === 'inst_tv_011')!.amountMinor, 8000);
  assert.equal(entries.some(entry => entry.id === 'inst_tv_012'), false, 'refunded to zero: never recorded');
  const done = await readArchive(db);
  assert.equal(installmentPlanFigures(done.installmentPlans![0], done.records, done.purchaseOperations ?? []).status, 'completed');
  // Any operation, undone or not, keeps the plan from being deleted.
  await assert.rejects(deleteInstallmentPlan(db, 'tv', now), /devoluciones o adelantos registrados|registró cuotas/);
});

test('an adelanto de cuotas recognises every share left on its date, once; its projected ids are taken; undo records what closed since on its own dates and restore is then refused; receipts make both idempotent', async () => {
  const { db } = await seeded('2026-10-25');
  const payoff = newPlanPayoff(await readArchive(db), { id: 'adelanto-1', planId: 'tv', financing: 'recognised', dateISO: '2026-10-25', todayISO: '2026-10-25', createdAt: now });
  await createPurchaseOperation(db, payoff, '2026-10-25');
  let snapshot = await readSnapshot(db);
  assert.equal(snapshot.entries.find(entry => entry.id === 'adelanto-1_p')!.amountMinor, 100000);
  assert.equal(cardDebtMinor(card, snapshot), 23100 + 120000, 'the whole price is recognised once: two instalments plus the adelanto');
  assert.equal(await catchUpInstallments(db, '2030-01-01'), 0, 'a share brought forward is never recorded again');
  await assert.rejects(createEntry(db, expense('adelanto-1_p', 'bank', 100, '2026-10-25')), new RegExp(OPERATION_ID_MESSAGE));
  // Undo, on Christmas: the shares come back as owed, and the three statements that closed since are recorded on their dates.
  const undo = makeOperationChange('undo-adelanto-1', payoff, 'void', '2026-12-25T10:00:00.000Z');
  await changePurchaseOperation(db, undo, '2026-12-25');
  assert.deepEqual([(await operationOf(db, 'adelanto-1')).voided, (await operationOf(db, 'adelanto-1')).revision], [true, 1]);
  snapshot = await readSnapshot(db);
  assert.deepEqual(snapshot.entries.filter(entry => entry.id.startsWith('inst_tv')).map(entry => entry.dateISO).sort(), ['2026-09-20', '2026-10-20', '2026-11-20', '2026-12-20']);
  assert.equal(snapshot.entries.some(entry => entry.id.startsWith('adelanto-1')), false);
  // The same receipt again: a no-op (a refresh failed after the commit); the same change id with another change is refused.
  await changePurchaseOperation(db, undo, '2026-12-25');
  assert.deepEqual([(await operationOf(db, 'adelanto-1')).revision, await count(db, 'operation_changes')], [1, 1]);
  await assert.rejects(changePurchaseOperation(db, { ...undo, after: { ...undo.after, updatedAt: '2026-12-26T10:00:00.000Z' } }, '2026-12-25'), new RegExp(OPERATION_EXISTS_MESSAGE));
  // A stale view (another change id, the version before the undo) is refused.
  await assert.rejects(changePurchaseOperation(db, makeOperationChange('undo-again', payoff, 'void', now), '2026-12-25'), new RegExp(OPERATION_STATE_MESSAGE));
  // Restore: instalments covered by the adelanto were recorded meanwhile, so it no longer fits; nothing changes.
  const voided = await operationOf(db, 'adelanto-1');
  await assert.rejects(changePurchaseOperation(db, makeOperationChange('restore-adelanto-1', voided, 'restore', '2026-12-26T10:00:00.000Z'), '2026-12-26'), /registrá un adelanto nuevo/);
  assert.deepEqual([(await operationOf(db, 'adelanto-1')).voided, await count(db, 'operation_changes')], [true, 1]);
});

test('undo and restore of a devolución: receipts in the same commit, idempotent by change id, the balance follows', async () => {
  const { db } = await seeded();
  const refund = newEntryRefund(await readArchive(db), { id: 'r-1', entryId: 'cash1', amountMinor: 40000, dateISO: '2026-10-25', todayISO: '2026-10-25', createdAt: now });
  await createPurchaseOperation(db, refund, '2026-10-25');
  const balance = async () => { const snapshot = await readSnapshot(db); return accountBalanceMinor(bank, snapshot.entries, snapshot.transfers); };
  assert.equal(await balance(), 500000);
  const undo = makeOperationChange('u-1', refund, 'void', '2026-10-26T10:00:00.000Z');
  await changePurchaseOperation(db, undo, '2026-10-26');
  await changePurchaseOperation(db, undo, '2026-10-26');
  assert.equal(await balance(), 460000);
  const restore = makeOperationChange('rs-1', undo.after, 'restore', '2026-10-27T10:00:00.000Z');
  await changePurchaseOperation(db, restore, '2026-10-27');
  await changePurchaseOperation(db, restore, '2026-10-27');
  assert.equal(await balance(), 500000);
  assert.deepEqual([(await operationOf(db, 'r-1')).revision, (await operationOf(db, 'r-1')).voided, await count(db, 'operation_changes')], [2, false, 2]);
  const receipts = await db.getAllAsync<{ id: string; action: string; afterJSON: string }>('SELECT id, action, afterJSON FROM operation_changes ORDER BY id');
  assert.deepEqual(receipts.map(row => [row.id, row.action, JSON.parse(row.afterJSON).revision]), [['rs-1', 'restore', 2], ['u-1', 'void', 1]]);
  // While the devolución lives, a second one cannot take what it uses; undone, the purchase is free again.
  await assert.rejects(createPurchaseOperation(db, { ...refund, id: 'r-2' }, '2026-10-27'), new RegExp(REFUND_OVER_MESSAGE));
});

test('a failure at any statement rolls the whole write back: no caught-up instalment, no operation, no receipt, no stop; the retry records each once', async () => {
  const { db } = await seeded('2026-10-25');
  // The form previews on November 21 from a ledger caught up in memory (tv 3 closed on the 20th); storage catches up in the
  // same transaction as the operation row, which fails: neither tv 3 nor the devolución is written.
  const stale = await readArchive(db);
  const caughtUp = { ...stale, records: [...stale.records, ...domain.planCatchUpInserts(stale, 'tv', '2026-11-21')] };
  const preview = newPlanRefund(caughtUp, { id: 'r-fail', planId: 'tv', amountMinor: 5000, dateISO: '2026-11-21', todayISO: '2026-11-21', createdAt: now });
  const broken = failingOn(db, operationInsert, 'database or disk is full');
  await assert.rejects(createPurchaseOperation(broken.db, preview, '2026-11-21'), /disk is full/);
  assert.deepEqual([(await operationsOf(db)).length, (await instalmentIds(db)).length], [0, 2]);
  broken.heal();
  await createPurchaseOperation(broken.db, preview, '2026-11-21');
  assert.deepEqual([(await operationsOf(db)).length, (await instalmentIds(db)).length], [1, 3]);
  // An undo whose catch-up insert fails (December closed meanwhile): the undo, its receipt and the instalment all roll back.
  const undoing = failingOn(db, insertOf('inst_tv_004'), 'database is locked');
  await assert.rejects(changePurchaseOperation(undoing.db, makeOperationChange('u-fail', preview, 'void', now), '2026-12-21'), /locked/);
  assert.deepEqual([(await operationOf(db, 'r-fail')).voided, await count(db, 'operation_changes'), (await instalmentIds(db)).length], [false, 0, 3]);
  undoing.heal();
  await changePurchaseOperation(undoing.db, makeOperationChange('u-fail', preview, 'void', now), '2026-12-21');
  assert.deepEqual([(await operationOf(db, 'r-fail')).voided, await count(db, 'operation_changes'), (await instalmentIds(db)).length], [true, 1, 4]);
  // A stop whose catch-up insert fails: the plan keeps following, nothing recorded.
  const stopping = failingOn(db, insertOf('inst_tv_005'), 'disk I/O error');
  await assert.rejects(cancelInstallmentPlan(stopping.db, 'tv', 0, '2027-01-21', now), /I\/O/);
  assert.deepEqual([(await readArchive(db)).installmentPlans![0].cancelledAt, (await instalmentIds(db)).length], [null, 4]);
  stopping.heal();
  await cancelInstallmentPlan(stopping.db, 'tv', 0, '2027-01-21', now);
  assert.deepEqual([(await readArchive(db)).installmentPlans![0].cancelledAt, (await instalmentIds(db)).length], [now, 5]);
});

test('bug M3: stopping a plan first records every instalment whose statement closed (on the device’s day), then stops; the stop is retried by revision and refused when stale or with nothing left', async () => {
  const { db } = await seeded('2026-09-25'); // tv 1 recognised; October 20 closes but the app was not opened since
  // 21:30 on October 19 in Buenos Aires is already October 20 in UTC: the device's day is the 19th, and the closing of the 20th
  // has not happened for the person. The day passed to storage is `todayKey()`, never a UTC date.
  const zone = process.env.TZ;
  process.env.TZ = 'America/Argentina/Buenos_Aires';
  let deviceDay: string;
  try { deviceDay = todayKey(new Date('2026-10-20T00:30:00.000Z')); } finally { if (zone === undefined) delete process.env.TZ; else process.env.TZ = zone; }
  assert.equal(deviceDay, '2026-10-19');
  const { db: early } = await seeded('2026-09-25');
  await cancelInstallmentPlan(early, 'tv', 0, deviceDay, '2026-10-20T00:30:00.000Z');
  assert.deepEqual(await instalmentIds(early), ['inst_tv_001'], 'the 20th had not closed on the device: nothing more is recorded');
  // The ordinary case: the stop on October 25 records instalment 2 (closed on the 20th) before stopping.
  await cancelInstallmentPlan(db, 'tv', 0, '2026-10-25', now);
  assert.deepEqual(await instalmentIds(db), ['inst_tv_001', 'inst_tv_002']);
  let archive = await readArchive(db);
  const figures = installmentPlanFigures(archive.installmentPlans![0], archive.records, archive.purchaseOperations ?? []);
  assert.deepEqual([figures.status, figures.recognisedMinor, figures.cancelledMinor, figures.scheduledMinor], ['cancelled', 20000, 100000, 0]);
  // A retry (the revision the screen showed, 0) is a no-op; a stale revision is refused; nothing more is recorded.
  await cancelInstallmentPlan(db, 'tv', 0, '2026-12-25', '2026-10-26T00:00:00.000Z');
  archive = await readArchive(db);
  assert.deepEqual([archive.installmentPlans![0].revision, archive.installmentPlans![0].cancelledAt, (await instalmentIds(db)).length], [1, now, 2]);
  await assert.rejects(cancelInstallmentPlan(db, 'tv', 3, '2026-12-25', now), /cambió desde que lo abriste/);
  // A plan with nothing left to record is not stopped (A9).
  const { db: full } = await seeded('2027-09-25');
  await assert.rejects(cancelInstallmentPlan(full, 'tv', 0, '2027-09-25', now), new RegExp(PLAN_NOTHING_TO_STOP_MESSAGE));
});

test('reactivating a stopped plan records the statements that closed meanwhile, once, on their own dates; a retry is a no-op; a deleted card refuses it', async () => {
  const { db } = await seeded('2026-09-25');
  await cancelInstallmentPlan(db, 'tv', 0, '2026-09-25', now);
  assert.equal(await catchUpInstallments(db, '2026-12-25'), 0, 'stopped: nothing is recorded');
  await reactivateInstallmentPlan(db, 'tv', 1, '2026-12-25', '2026-12-25T10:00:00.000Z');
  const plan = (await readArchive(db)).installmentPlans![0];
  assert.deepEqual([plan.cancelledAt, plan.revision, plan.updatedAt], [null, 2, '2026-12-25T10:00:00.000Z']);
  assert.deepEqual((await readSnapshot(db)).entries.filter(entry => entry.id.startsWith('inst_tv')).map(entry => entry.dateISO).sort(), ['2026-09-20', '2026-10-20', '2026-11-20', '2026-12-20']);
  await reactivateInstallmentPlan(db, 'tv', 1, '2026-12-25', '2026-12-26T10:00:00.000Z');
  assert.deepEqual([(await readArchive(db)).installmentPlans![0].revision, (await instalmentIds(db)).length], [2, 4], 'the retry changes nothing');
  assert.equal(await catchUpInstallments(db, '2026-12-25'), 0);
  await assert.rejects(reactivateInstallmentPlan(db, 'tv', 0, '2026-12-25', now), /cambió desde que lo abriste/);
  // A plan stopped before anything was recorded, on a card then deleted (no balance, no pending plan): it stays stopped.
  const { db: other } = setup();
  await initializeDatabase(other);
  await createCreditCard(other, cardAccount, card);
  await createInstallmentPlan(other, tv);
  await cancelInstallmentPlan(other, 'tv', 0, '2026-09-15', now);
  await deleteCreditCard(other, 'card', now);
  await assert.rejects(reactivateInstallmentPlan(other, 'tv', 1, '2026-12-25', now), new RegExp(CARD_DELETED_MESSAGE));
  assert.notEqual((await readArchive(other)).installmentPlans![0].cancelledAt, null);
});

test('backup v14: every operation travels, undone ones included; a fresh device restores it exactly, twice is identical, an undone devolución stays undone; v13 copies still restore; v15 and a mislabelled copy are refused', async () => {
  const { db } = await seeded('2026-10-25');
  let archive = await readArchive(db);
  const refund = newEntryRefund(archive, { id: 'r-cash', entryId: 'cash1', amountMinor: 1000, dateISO: '2026-10-25', todayISO: '2026-10-25', createdAt: now });
  await createPurchaseOperation(db, refund, '2026-10-25');
  await changePurchaseOperation(db, makeOperationChange('u-cash', refund, 'void', now), '2026-10-25');
  const payoff = newPlanPayoff(await readArchive(db), { id: 'adelanto-1', planId: 'tv', financing: 'recognised', dateISO: '2026-10-25', todayISO: '2026-10-25', createdAt: now });
  await createPurchaseOperation(db, payoff, '2026-10-25');
  archive = await readArchive(db);
  const backup = createRecoveryBackup(archive, new Date(now));
  assert.equal(backup.schema, 'finanzapp.native-pilot.v14');
  assert.deepEqual([backup.purchaseOperations!.map(item => [item.id, item.voided]), backup.cardCycleDates, backup.installmentPlans!.length],
    [[['adelanto-1', false], ['r-cash', true]], [], 1], 'undone ones included; every v13 key present');
  const json = JSON.stringify(backup);
  const parsed = parsePilotBackup(json);
  const fresh = setup().db;
  await initializeDatabase(fresh);
  const preview = previewBackupImport(await readArchive(fresh), parsed.archive);
  assert.deepEqual([preview.purchaseOperations.length, preview.conflicts], [2, 0]);
  await importArchive(fresh, parsed.archive, preview.baseline);
  const restored = await readArchive(fresh);
  assert.deepEqual(restored.purchaseOperations, archive.purchaseOperations);
  assert.equal(cardDebtMinor(card, await readSnapshot(fresh)), cardDebtMinor(card, await readSnapshot(db)));
  assert.equal(await catchUpInstallments(fresh, '2030-01-01'), 0, 'restored shares brought forward are never recorded again');
  // The same copy again: identical, nothing new; the undone devolución is still undone.
  const again = previewBackupImport(await readArchive(fresh), parsed.archive);
  assert.deepEqual([again.purchaseOperations.length, again.records.length, again.conflicts], [0, 0, 0]);
  await importArchive(fresh, parsed.archive, again.baseline);
  assert.equal((await operationOf(fresh, 'r-cash')).voided, true);
  // A copy where the devolución is still live (taken before the undo) contradicts the device: nothing is imported.
  const before = { ...parsed.archive, purchaseOperations: parsed.archive.purchaseOperations!.map((item: PurchaseOperation) => item.id === 'r-cash' ? refund : item) };
  const older = previewBackupImport(await readArchive(fresh), before);
  assert.equal(older.conflicts, 1);
  await assert.rejects(importArchive(fresh, before, older.baseline), /contradice cambios locales/);
  assert.equal((await operationOf(fresh, 'r-cash')).voided, true);
  // The refusal contract: a newer file by name; a v14 file told v13 carries a key a v13 build does not know.
  assert.throws(() => parsePilotBackup(JSON.stringify({ ...backup, schema: 'finanzapp.native-pilot.v15' })), /versiones 1 a 14/);
  assert.throws(() => parsePilotBackup(JSON.stringify({ ...backup, schema: 'finanzapp.native-pilot.v13' })), /campos faltantes/);
  // A v13 copy (the same ledger before any operation) still restores into schema 14, and the operations can follow later.
  const { purchaseOperations: _operations, ...v13 } = { ...backup, schema: 'finanzapp.native-pilot.v13' };
  const v13Archive = parsePilotBackup(JSON.stringify({ ...v13, records: backup.records })).archive;
  const third = setup().db;
  await initializeDatabase(third);
  await importArchive(third, v13Archive, previewBackupImport(await readArchive(third), v13Archive).baseline);
  assert.equal((await readArchive(third)).purchaseOperations, undefined);
  const later = previewBackupImport(await readArchive(third), parsed.archive);
  assert.deepEqual([later.purchaseOperations.length, later.records.length, later.conflicts], [2, 0, 0], 'an import whose only news is operations still imports them');
  await importArchive(third, parsed.archive, later.baseline);
  assert.equal((await operationsOf(third)).length, 2);
  // A ledger without an operation keeps writing the version it wrote before (v12 here: a plan, no exact date).
  const plain = (await readArchive(db));
  assert.equal(createRecoveryBackup({ ...plain, purchaseOperations: undefined }, new Date(now)).schema, 'finanzapp.native-pilot.v12');
});

test('an import whose operations dangle or contradict this device is refused whole', async () => {
  const { db } = await seeded('2026-10-25');
  const payoff = newPlanPayoff(await readArchive(db), { id: 'adelanto-1', planId: 'tv', financing: 'recognised', dateISO: '2026-10-25', todayISO: '2026-10-25', createdAt: now });
  await createPurchaseOperation(db, payoff, '2026-10-25');
  const backup = createRecoveryBackup(await readArchive(db), new Date(now));
  // Dangling: an operation whose purchase is not in the copy.
  const dangling = { ...backup, purchaseOperations: [...backup.purchaseOperations!, { id: 'r-x', kind: 'refund', target: { entryId: 'missing' }, accountId: 'bank', currency: 'ARS',
    amountMinor: 10, dateISO: '2026-10-25', voided: false, createdAt: now, revision: 0, updatedAt: now }] };
  assert.throws(() => parsePilotBackup(JSON.stringify(dangling)), new RegExp(domain.OPERATION_TARGET_MESSAGE));
  // Contradicting: this device has the same plan without the adelanto, and recorded instalment 3 since; the copy's adelanto
  // covers it. Each row is additive, but together they would count instalment 3 twice: nothing is imported.
  const device = setup().db;
  await initializeDatabase(device);
  const { purchaseOperations: _operations, ...withoutOperations } = { ...backup, schema: 'finanzapp.native-pilot.v13' };
  const base = parsePilotBackup(JSON.stringify(withoutOperations)).archive;
  await importArchive(device, base, previewBackupImport(await readArchive(device), base).baseline);
  await catchUpInstallments(device, '2026-11-25');
  const incoming = parsePilotBackup(JSON.stringify(backup)).archive;
  const current = await readArchive(device);
  assert.throws(() => previewBackupImport(current, incoming), new RegExp(OPERATION_IMPORT_MESSAGE));
  await assert.rejects(importArchive(device, incoming, 'any'), new RegExp(OPERATION_IMPORT_MESSAGE));
  assert.deepEqual([(await operationsOf(device)).length, (await instalmentIds(device)).length], [0, 3]);
});

test('every Spanish message of devoluciones, adelantos and the plan lifecycle has its English twin in the errors catalogue', () => {
  const constants = Object.entries(domain).filter(([name, value]) => name.endsWith('_MESSAGE') && typeof value === 'string'
    && /^(OPERATION|REFUND|PAYOFF|PLAN|CARD_CREDIT|PROJECTED|INSTALLMENT_ENTRY)/.test(name)).map(([, value]) => value as string);
  for (const message of [...constants, ...operationGuardMessages(), PLAN_OPERATION_HISTORY_MESSAGE,
    'Solo se pueden restaurar copias de FinanzApp de las versiones 1 a 14. Este archivo no es una de ellas; conservalo.',
    'La copia contiene demasiadas devoluciones o adelantos o un formato inválido.']) {
    assert.notEqual(localizeError('en', message), message, 'catalogued: ' + message);
  }
});

test('createEntry refuses the id of any line an operation projects, and an archive whose ledger is built by hand stays valid with them', async () => {
  const { db } = await seeded('2026-10-25');
  const payoff = newPlanPayoff(await readArchive(db), { id: 'adelanto-9', planId: 'tv', financing: 'recognised', dateISO: '2026-10-25', todayISO: '2026-10-25', createdAt: now });
  await createPurchaseOperation(db, payoff, '2026-10-25');
  for (const id of ['adelanto-9', 'adelanto-9_p', 'adelanto-9_i', 'adelanto-9_f', 'adelanto-9_t']) {
    await assert.rejects(createEntry(db, expense(id, 'bank', 100, '2026-10-25')), new RegExp(OPERATION_ID_MESSAGE), id);
  }
  const archive: LedgerArchive = await readArchive(db);
  assert.equal(archive.purchaseOperations!.length, 1);
});

test('a plan with any operation, even an undone devolución that only lowered future instalments, is never deleted (A16)', async () => {
  const { db } = setup();
  await initializeDatabase(db);
  await createCreditCard(db, cardAccount, card);
  await createInstallmentPlan(db, tv);
  const refund = newPlanRefund(await readArchive(db), { id: 'r-future', planId: 'tv', amountMinor: 15000, dateISO: '2026-09-15', todayISO: '2026-09-15', createdAt: now });
  assert.equal(JSON.stringify(['creditMinor' in refund && refund.creditMinor, 'reductions' in refund && refund.reductions]),
    JSON.stringify([0, [{ number: 11, minor: 5000 }, { number: 12, minor: 10000 }]]), 'nothing recognised yet: the tail only, no ledger line');
  await createPurchaseOperation(db, refund, '2026-09-15');
  assert.equal((await readSnapshot(db)).entries.some(entry => entry.id === 'r-future'), false);
  await changePurchaseOperation(db, makeOperationChange('u-future', refund, 'void', now), '2026-09-15');
  await assert.rejects(deleteInstallmentPlan(db, 'tv', now), new RegExp(PLAN_OPERATION_HISTORY_MESSAGE));
  assert.equal((await readArchive(db)).installmentPlans![0].deleted, false);
});

// ---- Independent verification (24T3 storage lane): adversarial cases ------------------------------------------------

test('verify: a real schema 13 file holding a plan, its instalments and a card migrates to 14 with every row read back identical, and works afterwards', async () => {
  const { db } = await seeded('2026-10-25');
  const before = await readArchive(db);
  const freshSchema = async (target: LedgerDatabase) => (await target.getAllAsync<{ name: string; sql: string | null }>(
    "SELECT name, sql FROM sqlite_master WHERE name IN ('purchase_operations', 'operation_changes', 'purchase_operations_entry', 'purchase_operations_plan') ORDER BY name"));
  const reference = await freshSchema(db);
  // Back to a true schema 13 file: MIGRATE_V14 only added these two tables (and their indexes).
  await db.execAsync('DROP TABLE operation_changes; DROP TABLE purchase_operations; PRAGMA user_version = 13;');
  assert.equal(await version(db), 13);
  await initializeDatabase(db);
  assert.equal(await version(db), 14);
  assert.deepEqual(await freshSchema(db), reference, 'the migrated file has exactly the tables a new file has');
  assert.deepEqual(await readArchive(db), before, 'plans, schedules, instalments and movements unchanged; no operation fabricated');
  // And the file takes the new writes: a catch-up, then an adelanto over what is left.
  assert.equal(await catchUpInstallments(db, '2026-11-25'), 1);
  const payoff = newPlanPayoff(await readArchive(db), { id: 'adelanto-v13', planId: 'tv', financing: 'recognised', dateISO: '2026-11-25', todayISO: '2026-11-25', createdAt: now });
  await createPurchaseOperation(db, payoff, '2026-11-25');
  assert.equal((await operationsOf(db)).length, 1);
});

test('verify: a failure while the create catches up (the instalment insert, not the operation) rolls back both; the same submission then records each once', async () => {
  const { db } = await seeded('2026-10-25');
  const stale = await readArchive(db);
  const caughtUp = { ...stale, records: [...stale.records, ...domain.planCatchUpInserts(stale, 'tv', '2026-11-21')] };
  const preview = newPlanPayoff(caughtUp, { id: 'adelanto-crash', planId: 'tv', financing: 'recognised', dateISO: '2026-11-21', todayISO: '2026-11-21', createdAt: now });
  const broken = failingOn(db, insertOf('inst_tv_003'), 'database or disk is full');
  await assert.rejects(createPurchaseOperation(broken.db, preview, '2026-11-21'), /disk is full/);
  assert.deepEqual([(await operationsOf(db)).length, (await instalmentIds(db)).length], [0, 2]);
  broken.heal();
  await createPurchaseOperation(broken.db, preview, '2026-11-21');
  await createPurchaseOperation(broken.db, preview, '2026-11-21'); // A double tap after a refresh failure: a no-op.
  assert.deepEqual([(await operationsOf(db)).length, (await instalmentIds(db)).length], [1, 3]);
  // A second id for the same adelanto (the form reopened): nothing is left to bring forward.
  await assert.rejects(createPurchaseOperation(db, { ...preview, id: 'adelanto-crash-2' }, '2026-11-21'), new RegExp(domain.PAYOFF_NOTHING_MESSAGE));
  assert.equal((await operationsOf(db)).length, 1);
});

test('verify: an undo whose receipt insert fails and a reactivation whose catch-up fails roll back whole', async () => {
  const { db } = await seeded('2026-10-25');
  const refund = newEntryRefund(await readArchive(db), { id: 'r-receipt', entryId: 'cash1', amountMinor: 1000, dateISO: '2026-10-25', todayISO: '2026-10-25', createdAt: now });
  await createPurchaseOperation(db, refund, '2026-10-25');
  const broken = failingOn(db, sql => sql.startsWith('INSERT INTO operation_changes'), 'disk I/O error');
  const undo = makeOperationChange('u-receipt', refund, 'void', now);
  await assert.rejects(changePurchaseOperation(broken.db, undo, '2026-10-25'), /I\/O/);
  assert.deepEqual([(await operationOf(db, 'r-receipt')).voided, (await operationOf(db, 'r-receipt')).revision, await count(db, 'operation_changes')], [false, 0, 0]);
  broken.heal();
  await changePurchaseOperation(broken.db, undo, '2026-10-25');
  assert.deepEqual([(await operationOf(db, 'r-receipt')).voided, await count(db, 'operation_changes')], [true, 1]);
  // Reactivation: the plan row is updated first, then the catch-up inserts; a failing insert takes the update back too.
  await cancelInstallmentPlan(db, 'tv', 0, '2026-10-25', now);
  const failing = failingOn(db, insertOf('inst_tv_003'), 'database is locked');
  await assert.rejects(reactivateInstallmentPlan(failing.db, 'tv', 1, '2026-11-25', now), /locked/);
  assert.deepEqual([(await readArchive(db)).installmentPlans![0].cancelledAt, (await readArchive(db)).installmentPlans![0].revision, (await instalmentIds(db)).length], [now, 1, 2]);
  failing.heal();
  await reactivateInstallmentPlan(failing.db, 'tv', 1, '2026-11-25', now);
  assert.deepEqual([(await readArchive(db)).installmentPlans![0].cancelledAt, (await instalmentIds(db)).length], [null, 3]);
});

test('verify: restore after the world changed is refused and writes nothing (another devolución took the cap; the purchase was lowered; the purchase was undone)', async () => {
  const { db } = await seeded();
  const archive = await readArchive(db);
  const r1 = newEntryRefund(archive, { id: 'r1', entryId: 'cash1', amountMinor: 40000, dateISO: '2026-10-25', todayISO: '2026-10-25', createdAt: now });
  await createPurchaseOperation(db, r1, '2026-10-25');
  const undo1 = makeOperationChange('u1', r1, 'void', '2026-10-25T16:00:00.000Z');
  await changePurchaseOperation(db, undo1, '2026-10-25');
  const r2 = newEntryRefund(await readArchive(db), { id: 'r2', entryId: 'cash1', amountMinor: 40000, dateISO: '2026-10-25', todayISO: '2026-10-25', createdAt: now });
  await createPurchaseOperation(db, r2, '2026-10-25');
  const restore1 = makeOperationChange('rs1', undo1.after, 'restore', '2026-10-25T17:00:00.000Z');
  await assert.rejects(changePurchaseOperation(db, restore1, '2026-10-25'), /no se puede restaurar/);
  assert.deepEqual([(await operationOf(db, 'r1')).voided, await count(db, 'operation_changes')], [true, 1]);
  // R2 undone, the purchase lowered below R1: restoring R1 would refund more than was spent.
  await changePurchaseOperation(db, makeOperationChange('u2', r2, 'void', '2026-10-25T18:00:00.000Z'), '2026-10-25');
  let purchase = (await readArchive(db)).records.find(record => record.entry.id === 'cash1')!;
  await changeEntry(db, domain.makeEntryChange('lower', purchase, 'edit', '2026-10-25T19:00:00.000Z', { ...purchase.entry, amountMinor: 10000 }));
  await assert.rejects(changePurchaseOperation(db, restore1, '2026-10-25'), /no se puede restaurar/);
  // The purchase undone: restoring is refused too.
  purchase = (await readArchive(db)).records.find(record => record.entry.id === 'cash1')!;
  await changeEntry(db, domain.makeEntryChange('undo-purchase', purchase, 'void', '2026-10-25T20:00:00.000Z'));
  await assert.rejects(changePurchaseOperation(db, restore1, '2026-10-25'), /no se puede restaurar/);
  assert.deepEqual([(await operationOf(db, 'r1')).voided, (await operationOf(db, 'r1')).revision, await count(db, 'operation_changes')], [true, 1, 2]);
  // Every refusal reads in English too.
  for (const message of operationGuardMessages()) assert.notEqual(localizeError('en', message), message);
});

test('verify: a purchase moved to another account after the preview is previewed again, never credited to an account the person did not see', async () => {
  const { db } = await seeded();
  await createAccount(db, { id: 'bank2', name: 'Otro banco', currency: 'ARS', openingMinor: 0, createdAt });
  const preview = newEntryRefund(await readArchive(db), { id: 'r-moved', entryId: 'cash1', amountMinor: 1000, dateISO: '2026-10-25', todayISO: '2026-10-25', createdAt: now });
  assert.equal(preview.accountId, 'bank');
  const purchase = (await readArchive(db)).records.find(record => record.entry.id === 'cash1')!;
  await changeEntry(db, domain.makeEntryChange('move', purchase, 'edit', now, { ...purchase.entry, accountId: 'bank2' }));
  await assert.rejects(createPurchaseOperation(db, preview, '2026-10-25'), new RegExp(OPERATION_CHANGED_MESSAGE));
  assert.equal((await operationsOf(db)).length, 0);
  const again = newEntryRefund(await readArchive(db), { id: 'r-moved', entryId: 'cash1', amountMinor: 1000, dateISO: '2026-10-25', todayISO: '2026-10-25', createdAt: now });
  await createPurchaseOperation(db, again, '2026-10-25');
  assert.equal((await operationOf(db, 'r-moved')).accountId, 'bank2');
});

test('verify: two ids for the same plan devolución are two devoluciones within the cap; the one past the cap is refused, nothing half-written', async () => {
  const { db } = await seeded('2026-10-25'); // 20.000 recognised of 120.000
  const archive = await readArchive(db);
  const first = newPlanRefund(archive, { id: 'r-a', planId: 'tv', amountMinor: 100000, dateISO: '2026-10-25', todayISO: '2026-10-25', createdAt: now });
  await createPurchaseOperation(db, first, '2026-10-25');
  // The same preview under a second id (a second form): the allocation no longer matches (credit used, tail reduced).
  await assert.rejects(createPurchaseOperation(db, { ...first, id: 'r-b' }, '2026-10-25'), new RegExp(`${REFUND_OVER_MESSAGE}|${OPERATION_CHANGED_MESSAGE}`));
  const rest = newPlanRefund(await readArchive(db), { id: 'r-c', planId: 'tv', amountMinor: 20000, dateISO: '2026-10-25', todayISO: '2026-10-25', createdAt: now });
  await createPurchaseOperation(db, rest, '2026-10-25');
  const full = await readArchive(db);
  assert.throws(() => newPlanRefund(full, { id: 'r-d', planId: 'tv', amountMinor: 1, dateISO: '2026-10-25', todayISO: '2026-10-25', createdAt: now }), new RegExp(REFUND_OVER_MESSAGE));
  assert.deepEqual(domain.planRefundAvailability(full, 'tv').availableMinor, 0);
  const figures = installmentPlanFigures(full.installmentPlans![0], full.records, full.purchaseOperations ?? []);
  assert.deepEqual([figures.refundedMinor, figures.status], [120000, 'completed']);
  assert.equal(cardDebtMinor(card, await readSnapshot(db)), 23100, 'the card owes only the ordinary purchase');
  assert.equal(await catchUpInstallments(db, '2030-01-01'), 0, 'every future share refunded to zero: nothing more is recorded');
});

test('verify: imports that contradict the device by id are refused whole (same operation id, other content; an operation id that is a movement here)', async () => {
  const { db } = await seeded('2026-10-25');
  const refund = newEntryRefund(await readArchive(db), { id: 'r-imp', entryId: 'cash1', amountMinor: 1000, dateISO: '2026-10-25', todayISO: '2026-10-25', createdAt: now });
  await createPurchaseOperation(db, refund, '2026-10-25');
  const backup = createRecoveryBackup(await readArchive(db), new Date(now));
  const otherAmount = parsePilotBackup(JSON.stringify({ ...backup, purchaseOperations: backup.purchaseOperations!.map(item => ({ ...item, amountMinor: 2000 })) })).archive;
  const preview = previewBackupImport(await readArchive(db), otherAmount);
  assert.equal(preview.conflicts, 1);
  await assert.rejects(importArchive(db, otherAmount, preview.baseline), /contradice cambios locales/);
  assert.equal((await operationOf(db, 'r-imp')).amountMinor, 1000);
  // A device whose movement already uses the id an incoming operation carries.
  const device = setup().db;
  await initializeDatabase(device);
  await createAccount(device, bank);
  await createEntry(device, expense('r-imp', 'bank', 500, '2026-10-01'));
  const incoming = parsePilotBackup(JSON.stringify(backup)).archive;
  const before = await readArchive(device);
  assert.throws(() => previewBackupImport(before, incoming));
  await assert.rejects(importArchive(device, incoming, 'any'));
  assert.deepEqual(await readArchive(device), before, 'nothing imported');
});

test('verify: the schedule rows and summary read the operations (settled, waived, refunded, reduced; cancellable never beside deletable)', async () => {
  const { db } = setup();
  await initializeDatabase(db);
  await createCreditCard(db, cardAccount, card);
  const fin = newInstallmentPlan({ id: 'fin', card, cardAccount, merchant: 'Electro', category: 'Hogar', purchaseDateISO: '2026-09-10', principalMinor: 30000, count: 3,
    placement: 'current', interestMinor: 3000, interestCategory: 'Intereses', createdAt });
  await createInstallmentPlan(db, fin);
  const { planScheduleRows, planSummary } = await import('../src/ui/installment-presentation.ts');
  let archive = await readArchive(db);
  let summary = planSummary(archive.installmentPlans![0], archive.records, archive.purchaseOperations ?? []);
  assert.deepEqual([summary.deletable, summary.cancellable], [true, false], 'a plan created by mistake is deleted, not stopped');
  // A devolución of 10.000 before anything closes: the last principal goes to zero (its interest stays).
  const refund = newPlanRefund(archive, { id: 'r-row', planId: 'fin', amountMinor: 10000, dateISO: '2026-09-15', todayISO: '2026-09-15', createdAt: now });
  await createPurchaseOperation(db, refund, '2026-09-15');
  archive = await readArchive(db);
  let rows = planScheduleRows(archive.installmentPlans![0], archive.records, archive.purchaseOperations ?? []);
  assert.deepEqual(rows.map(row => [row.state, row.reducedMinor, row.effectiveMinor, row.operationId]),
    [['next', 0, 11000, null], ['future', 0, 11000, null], ['future', 10000, 1000, 'r-row']], 'the reduced row still bills its interest');
  summary = planSummary(archive.installmentPlans![0], archive.records, archive.purchaseOperations ?? []);
  assert.deepEqual([summary.deletable, summary.cancellable], [false, true], 'an operation is history: stopped, not deleted');
  // The first instalment closes; then an adelanto that waives future interest.
  await catchUpInstallments(db, '2026-09-25');
  const payoff = newPlanPayoff(await readArchive(db), { id: 'adelanto-row', planId: 'fin', financing: 'waived', dateISO: '2026-09-25', todayISO: '2026-09-25', createdAt: now });
  await createPurchaseOperation(db, payoff, '2026-09-25');
  archive = await readArchive(db);
  rows = planScheduleRows(archive.installmentPlans![0], archive.records, archive.purchaseOperations ?? []);
  assert.deepEqual(rows.map(row => [row.state, row.recognisedMinor, row.settledMinor, row.waivedMinor, row.operationId]),
    [['recognised', 11000, 0, 0, null], ['settled', 0, 10000, 1000, 'adelanto-row'], ['waived', 0, 0, 1000, 'adelanto-row']]);
  summary = planSummary(archive.installmentPlans![0], archive.records, archive.purchaseOperations ?? []);
  assert.deepEqual([summary.status, summary.deletable, summary.cancellable, summary.next], ['completed', false, false, null]);
  assert.equal(cardDebtMinor(card, await readSnapshot(db)), 11000 + 10000, 'instalment 1 and the principal brought forward; waived interest never counts');
});
