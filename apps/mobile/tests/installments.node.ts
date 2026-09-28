import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CARD_DELETED_MESSAGE, CARD_PLAN_MESSAGE, INSTALLMENT_DRIFT_MESSAGE, INSTALLMENT_ENTRY_MESSAGE, INSTALLMENT_ID_MESSAGE, PLAN_CHANGE_MESSAGE, PLAN_DELETE_PATH_MESSAGE,
  PLAN_EXISTS_MESSAGE, PLAN_HISTORY_MESSAGE, PLAN_MISSING_MESSAGE, accountBalanceMinor, cardAvailableLimitMinor, cardCommittedMinor, cardDebtMinor, createRecoveryBackup, debtTotalsByCurrency,
  installmentPlanFigures, liquidTotalsByCurrency, makeEntryChange, newInstallmentPlan, parsePilotBackup, previewBackupImport, recurringHistory, spendingReport, summarizeMonthlyBudgets,
  type Account, type CreditCardProfile, type Entry, type InstallmentPlan, type MonthlyBudget, type PersonalDebtProfile, type RecurringRule, type Transfer } from '@finanzapp/domain';
import { DATABASE_VERSION, SCHEMA_SCRIPTS, cancelInstallmentPlan, catchUpInstallments, changeEntry, createAccount, createCreditCard, createEntry, createInstallmentPlan, createPersonalDebt,
  createTransfer, deleteCreditCard, deleteInstallmentPlan, importArchive, initializeDatabase, processRecurring, readArchive, readSnapshot, saveCreditCard, saveInstallmentPlan, saveMonthlyBudget,
  saveRecurringRule, type LedgerDatabase } from '../src/storage/database.ts';
import { openLedger, refreshLedger } from '../src/storage/ledger-session.ts';
import { runExclusiveTransaction, runSchemaMigration, type TransactionConnection } from '../src/storage/transaction.ts';

// Producto 24T1 on real SQLite: schema 12, a purchase in instalments recognised statement by statement, exactly once,
// through catch-ups, restarts, retries, duplicated invocations and a backup round trip; the card, recurring, debt,
// budget and report rules around it. Synthetic records in disposable databases only.
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
  const directory = mkdtempSync(join(tmpdir(), 'finanzapp-installments-'));
  cleanups.push(async () => { rmSync(directory, { recursive: true, force: true }); });
  const path = join(directory, 'ledger.sqlite');
  return { db: databaseAt(path), path };
}

const createdAt = '2026-09-01T12:00:00.000Z';
const now = '2026-09-28T10:00:00.000Z';
const bank: Account = { id: 'bank', name: 'Banco', currency: 'ARS', openingMinor: 500000, createdAt };
const cardAccount: Account = { id: 'card-account', name: 'Visa', currency: 'ARS', openingMinor: 0, createdAt };
const card: CreditCardProfile = { id: 'card', accountId: cardAccount.id, issuer: 'Banco', last4: '4009', creditLimitMinor: 1000000, closingDay: 20, dueDay: 5,
  active: true, deleted: false, createdAt, revision: 0, updatedAt: createdAt };
const debtAccount: Account = { id: 'debt-account', name: 'Debo · Juan', currency: 'ARS', openingMinor: -30000, createdAt };
const debt: PersonalDebtProfile = { id: 'debt', accountId: debtAccount.id, direction: 'owed_by_me', counterparty: 'Juan', dueDateISO: null, note: '',
  active: true, deleted: false, createdAt, revision: 0, updatedAt: createdAt };
const expense = (id: string, accountId: string, amountMinor: number, dateISO: string): Entry => ({ id, accountId, kind: 'expense', amountMinor, merchant: 'M ' + id, category: 'Comida', dateISO, createdAt });
const transfer = (id: string, fromAccountId: string, toAccountId: string, amountMinor: number, dateISO: string): Transfer => ({ id, fromAccountId, toAccountId, amountMinor, note: '', dateISO, createdAt });
/** 120.000,00 in 12 × 10.000,00, bought 2026-09-10, first instalment on the statement closing 2026-09-20. */
const tv = newInstallmentPlan({ id: 'tv', card, cardAccount, merchant: 'Electro', category: 'Hogar', purchaseDateISO: '2026-09-10', principalMinor: 120000, count: 12, placement: 'current', createdAt });
const financed = newInstallmentPlan({ id: 'fin', card, cardAccount, merchant: 'Notebook', category: 'Tecnología', purchaseDateISO: '2026-09-10', principalMinor: 30000, count: 3, placement: 'next',
  interestMinor: 300, financingCategory: 'Intereses', createdAt });

async function seeded() {
  const { db, path } = setup();
  await initializeDatabase(db);
  await createAccount(db, bank);
  await createCreditCard(db, cardAccount, card);
  await createEntry(db, expense('p1', 'card-account', 23100, '2026-09-10'));
  await createInstallmentPlan(db, tv);
  return { db, path };
}
const planOf = async (db: LedgerDatabase, id: string) => (await readArchive(db)).installmentPlans!.find(item => item.id === id)!;
const instalmentIds = async (db: LedgerDatabase) => (await readArchive(db)).records.map(record => record.entry.id).filter(id => id.startsWith('inst')).sort();

test('schema 12 is reached from a real schema 11 file by an additive migration: two empty tables, every row untouched, no fabricated plan; a newer schema is refused intact', async () => {
  const { db } = setup();
  for (const script of SCHEMA_SCRIPTS.slice(0, 11)) await db.execAsync(script);
  await db.execAsync(`INSERT INTO accounts (id, name, currency, openingMinor, createdAt, revision, updatedAt) VALUES ('c', 'Visa', 'ARS', 0, '${createdAt}', 0, '${createdAt}');
    INSERT INTO credit_cards (id, accountId, issuer, last4, creditLimitMinor, closingDay, dueDay, active, deleted, createdAt, revision, updatedAt) VALUES ('card', 'c', 'Banco', '4009', NULL, 20, 5, 1, 0, '${createdAt}', 0, '${createdAt}');
    INSERT INTO entries (id, accountId, kind, amountMinor, merchant, category, dateISO, createdAt, revision, voided, updatedAt) VALUES ('p1', 'c', 'expense', 100, 'Súper', 'Comida', '2026-09-10', '${createdAt}', 0, 0, '${createdAt}');`);
  assert.equal((await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version, 11);
  await initializeDatabase(db);
  assert.equal((await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version, 12);
  assert.equal(DATABASE_VERSION, 12);
  const archive = await readArchive(db);
  assert.equal(archive.installmentPlans, undefined, 'old data gets no plan');
  assert.deepEqual(archive.cards?.[0], { ...card, accountId: 'c', creditLimitMinor: null });
  assert.equal(archive.records[0].entry.amountMinor, 100);
  assert.equal((await db.getFirstAsync<{ n: number }>('SELECT count(*) AS n FROM installment_plans'))?.n, 0);
  // Idempotent: the step runs again on a file that already has the tables (an interrupted step), and reaches 12 once more.
  await db.execAsync('PRAGMA user_version = 11');
  await initializeDatabase(db);
  assert.equal((await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version, 12);
  await db.execAsync('PRAGMA user_version = 13');
  await assert.rejects(initializeDatabase(db), /versión más nueva/);
  // The foreign keys hold: an instalment row needs its plan, a plan its card.
  await assert.rejects(db.withExclusiveTransactionAsync(async tx => { await tx.runAsync("INSERT INTO installments (planId, number, billingDateISO, dueDateISO, principalMinor, financingMinor) VALUES ('nope', 1, '2026-09-20', '2026-10-05', 1, 0)"); }), /FOREIGN KEY/);
});

test('a plan is created without moving any account or recording anything; the catch-up recognises each instalment on its statement, exactly once, through restarts, retries and duplicated invocations', async () => {
  const { db, path } = await seeded();
  let snapshot = await readSnapshot(db);
  assert.equal(cardDebtMinor(card, snapshot), 23100, 'the plain purchase only');
  assert.equal(accountBalanceMinor(bank, snapshot.entries, snapshot.transfers), 500000);
  assert.deepEqual((await planOf(db, 'tv')), tv);
  // Retry of the same creation: a no-op; the same id with other data: refused.
  await createInstallmentPlan(db, tv);
  await assert.rejects(createInstallmentPlan(db, { ...tv, merchant: 'Otro' }), new RegExp(PLAN_EXISTS_MESSAGE));
  assert.equal((await readArchive(db)).installmentPlans!.length, 1);
  // Before the first closing: nothing. On it: instalment 1, dated on the statement.
  assert.equal(await catchUpInstallments(db, '2026-09-19'), 0);
  assert.equal(await catchUpInstallments(db, '2026-09-20'), 1);
  assert.equal(await catchUpInstallments(db, '2026-09-20'), 0, 'run again: nothing');
  assert.equal(await catchUpInstallments(db, '2026-09-20'), 0, 'and again');
  snapshot = await readSnapshot(db);
  const first = snapshot.entries.find(entry => entry.id === 'inst_tv_001')!;
  assert.deepEqual(first, { id: 'inst_tv_001', accountId: 'card-account', kind: 'expense', amountMinor: 10000, merchant: 'Electro', category: 'Hogar', dateISO: '2026-09-20', createdAt: '2026-09-20T12:00:00.000Z' });
  assert.equal(cardDebtMinor(card, snapshot), 33100);
  // The app stays closed until January: four statements closed meanwhile, each recorded with its own date, in one pass.
  await db.closeAsync();
  const reopened = databaseAt(path);
  const session = await openLedger(reopened, '2027-01-25');
  assert.equal(session.recurringError, false);
  assert.deepEqual(await instalmentIds(reopened), ['inst_tv_001', 'inst_tv_002', 'inst_tv_003', 'inst_tv_004', 'inst_tv_005']);
  assert.deepEqual((await readSnapshot(reopened)).entries.filter(entry => entry.id.startsWith('inst')).map(entry => entry.dateISO).sort(), ['2026-09-20', '2026-10-20', '2026-11-20', '2026-12-20', '2027-01-20']);
  // Every foreground: nothing new until the next closing.
  await refreshLedger(reopened, '2027-01-25');
  await refreshLedger(reopened, '2027-02-19');
  assert.equal((await instalmentIds(reopened)).length, 5);
  await refreshLedger(reopened, '2027-02-20');
  assert.equal((await instalmentIds(reopened)).length, 6);
  // Through the end and beyond: twelve, no more; the plan reads completed and its figures add up.
  assert.equal(await catchUpInstallments(reopened, '2030-01-01'), 6);
  assert.equal(await catchUpInstallments(reopened, '2030-01-01'), 0);
  const archive = await readArchive(reopened);
  const figures = installmentPlanFigures(archive.installmentPlans![0], archive.records);
  assert.deepEqual([figures.status, figures.recognisedMinor, figures.remainingMinor, figures.scheduledMinor, figures.recognisedCount], ['completed', 120000, 0, 0, 12]);
  assert.equal(archive.records.filter(record => record.entry.id.startsWith('inst_tv')).reduce((sum, record) => sum + record.entry.amountMinor, 0), 120000, 'the recognised principal is exactly the price');
  assert.equal(cardDebtMinor(card, await readSnapshot(reopened)), 23100 + 120000);
  assert.equal(accountBalanceMinor(bank, (await readSnapshot(reopened)).entries, (await readSnapshot(reopened)).transfers), 500000, 'no cash account ever moved');
});

test('a crash after the insert but before the refresh, and a write that fails midway, never record an instalment twice or half a batch', async () => {
  const { db, path } = await seeded();
  // The commit happened but the app did not read it: the next open finds the ids and records nothing more.
  await catchUpInstallments(db, '2026-10-25');
  assert.deepEqual(await instalmentIds(db), ['inst_tv_001', 'inst_tv_002']);
  await db.closeAsync();
  const reopened = databaseAt(path);
  await openLedger(reopened, '2026-10-25');
  assert.deepEqual(await instalmentIds(reopened), ['inst_tv_001', 'inst_tv_002']);
  // A failing transaction rolls the whole batch back: a plan whose card is gone from the archive cannot exist, so force a
  // failure with a conflicting row and check nothing partial stays.
  await reopened.withExclusiveTransactionAsync(async tx => {
    await tx.runAsync(`INSERT INTO entries (id, accountId, kind, amountMinor, merchant, category, dateISO, createdAt, revision, voided, updatedAt) VALUES ('blocker', 'card-account', 'expense', 1, 'x', 'x', '2026-11-20', '${createdAt}', 0, 0, '${createdAt}')`);
  });
  const failing = { ...reopened, withExclusiveTransactionAsync: (work: (tx: Parameters<Parameters<LedgerDatabase['withExclusiveTransactionAsync']>[0]>[0]) => Promise<void>) =>
    reopened.withExclusiveTransactionAsync(async tx => { await work({ ...tx, runAsync: async (sql: string, ...params: (string | number | null)[]) => {
      if (sql.startsWith('INSERT INTO entries') && params[0] === 'inst_tv_004') throw new Error('disk full');
      return tx.runAsync(sql, ...params);
    } }); }) } as LedgerDatabase;
  await assert.rejects(catchUpInstallments(failing, '2026-12-25'), /disk full/);
  assert.deepEqual(await instalmentIds(reopened), ['inst_tv_001', 'inst_tv_002'], 'instalment 3 was rolled back with the failed batch');
  assert.equal(await catchUpInstallments(reopened, '2026-12-25'), 2, 'the retry records both, once');
  assert.deepEqual(await instalmentIds(reopened), ['inst_tv_001', 'inst_tv_002', 'inst_tv_003', 'inst_tv_004']);
});

test('financing is recognised beside each instalment in its own category; reports, the month summary and budgets count a recognised instalment exactly once, in its statement month, and a future one nowhere', async () => {
  const { db } = await seeded();
  await createInstallmentPlan(db, financed);
  await catchUpInstallments(db, '2026-10-25');
  const snapshot = await readSnapshot(db);
  // September: the plain purchase (23100) and tv 1 (10000). October: tv 2 (10000) and fin 1 (10000 + 100 interest: «next» statement).
  const september = spendingReport(snapshot, 'ARS', '2026-09', '2026-09-30');
  assert.equal(september.status === 'ready' && september.expenseMinor, 33100);
  const october = spendingReport(snapshot, 'ARS', '2026-10', '2026-10-31');
  assert.equal(october.status === 'ready' && october.expenseMinor, 20100);
  assert.deepEqual(october.categories.map(group => [group.category, group.amountMinor]), [['Hogar', 10000], ['Tecnología', 10000], ['Intereses', 100]]);
  const november = spendingReport(snapshot, 'ARS', '2026-11', '2026-11-30');
  assert.equal(november.status === 'ready' && november.expenseMinor, 0, 'a future instalment is not an expense');
  const budget: MonthlyBudget = { id: 'b', scope: 'total', currency: 'ARS', monthISO: '2026-10', amountMinor: 50000, active: true, createdAt, revision: 0, updatedAt: createdAt };
  await saveMonthlyBudget(db, budget);
  assert.equal(summarizeMonthlyBudgets(snapshot, [budget], 'ARS', '2026-10').totalSpentMinor, 20100);
  assert.equal(cardDebtMinor(card, snapshot), 23100 + 20000 + 10100);
  const archive = await readArchive(db);
  assert.equal(cardCommittedMinor(card, archive.installmentPlans, archive.records), 100000 + 20000, 'the future principal, beside the balance due, never inside it');
  assert.equal(cardAvailableLimitMinor(card, snapshot, archive.installmentPlans, archive.records), null, 'the issuer-reservation gate');
  assert.equal(installmentPlanFigures(archive.installmentPlans!.find(plan => plan.id === 'fin')!, archive.records).financingRecognisedMinor, 100);
});

test('a card payment lowers the balance due and assigns no instalment; the movements a plan recorded keep their amount, date and card, may be relabelled, undone (never recreated) and restored', async () => {
  const { db } = await seeded();
  await catchUpInstallments(db, '2026-10-25');
  await createTransfer(db, transfer('pay', 'bank', 'card-account', 30000, '2026-10-26'));
  let archive = await readArchive(db);
  assert.equal(cardDebtMinor(card, await readSnapshot(db)), 23100 + 20000 - 30000);
  const figuresBefore = installmentPlanFigures(archive.installmentPlans![0], archive.records);
  assert.deepEqual([figuresBefore.recognisedMinor, figuresBefore.remainingMinor], [20000, 100000], 'a payment changes no plan figure');
  const record = archive.records.find(item => item.entry.id === 'inst_tv_002')!;
  await assert.rejects(changeEntry(db, makeEntryChange('op1', record, 'edit', now, { ...record.entry, amountMinor: 9999 })), new RegExp(INSTALLMENT_ENTRY_MESSAGE));
  await assert.rejects(changeEntry(db, makeEntryChange('op2', record, 'edit', now, { ...record.entry, dateISO: '2026-10-21' })), new RegExp(INSTALLMENT_ENTRY_MESSAGE));
  await changeEntry(db, makeEntryChange('op3', record, 'edit', now, { ...record.entry, merchant: 'Electro Hogar', category: 'Electrodomésticos' }));
  const relabelled = (await readArchive(db)).records.find(item => item.entry.id === 'inst_tv_002')!;
  assert.deepEqual([relabelled.entry.merchant, relabelled.entry.amountMinor, relabelled.revision], ['Electro Hogar', 10000, 1]);
  // Undo: the instalment counts nowhere, the obligation stays open, the catch-up never recreates it.
  await changeEntry(db, makeEntryChange('op4', relabelled, 'void', now));
  assert.equal(await catchUpInstallments(db, '2026-10-25'), 0);
  archive = await readArchive(db);
  const undone = installmentPlanFigures(archive.installmentPlans![0], archive.records);
  assert.deepEqual([undone.recognisedMinor, undone.undoneMinor, undone.remainingMinor, undone.status], [10000, 10000, 110000, 'active']);
  assert.equal(cardDebtMinor(card, await readSnapshot(db)), 23100 + 10000 - 30000);
  await assert.rejects(deleteInstallmentPlan(db, 'tv', now), new RegExp(PLAN_HISTORY_MESSAGE), 'an undone instalment is history too');
  // Restore brings it back; a plain new movement can never take an instalment id.
  const voided = archive.records.find(item => item.entry.id === 'inst_tv_002')!;
  await changeEntry(db, makeEntryChange('op5', voided, 'restore', now));
  archive = await readArchive(db);
  assert.equal(installmentPlanFigures(archive.installmentPlans![0], archive.records).recognisedMinor, 20000);
  await assert.rejects(createEntry(db, { ...expense('inst_tv_003', 'card-account', 10000, '2026-11-20') }), new RegExp(INSTALLMENT_ID_MESSAGE));
  await assert.rejects(createEntry(db, { ...expense('instc_tv_003', 'card-account', 10000, '2026-11-20') }), new RegExp(INSTALLMENT_ID_MESSAGE));
  // Drift is refused at the door: a row rewritten behind the app's back makes the archive unreadable rather than wrong.
  await db.withExclusiveTransactionAsync(async tx => { await tx.runAsync("UPDATE entries SET amountMinor = 1 WHERE id = 'inst_tv_001'"); });
  await assert.rejects(readArchive(db), new RegExp(INSTALLMENT_DRIFT_MESSAGE));
});

test('the plan lifecycle: cancelled keeps the recognised instalments and stops the future ones; deleted only without history; the fields never change through a save; retries are no-ops', async () => {
  const { db } = await seeded();
  await createInstallmentPlan(db, financed);
  await catchUpInstallments(db, '2026-10-25');
  await cancelInstallmentPlan(db, 'tv', now);
  const cancelled = await planOf(db, 'tv');
  assert.deepEqual([cancelled.cancelledAt, cancelled.revision, cancelled.updatedAt], [now, 1, now]);
  assert.equal(await catchUpInstallments(db, '2030-01-01'), 4, 'fin 2 and fin 3 only (principal and interest each): tv records nothing more');
  assert.deepEqual((await instalmentIds(db)).filter(id => id.includes('tv')), ['inst_tv_001', 'inst_tv_002'], 'the recognised instalments stay');
  await cancelInstallmentPlan(db, 'tv', '2026-09-29T10:00:00.000Z');
  assert.deepEqual(await planOf(db, 'tv'), cancelled, 'a retry changes nothing');
  await assert.rejects(deleteInstallmentPlan(db, 'tv', now), new RegExp(PLAN_HISTORY_MESSAGE));
  await assert.rejects(deleteInstallmentPlan(db, 'fin', now), new RegExp(PLAN_HISTORY_MESSAGE));
  await assert.rejects(cancelInstallmentPlan(db, 'nope', now), new RegExp(PLAN_MISSING_MESSAGE));
  // A plan created by mistake, nothing recorded yet: deleted (a tombstone; the row and its schedule stay); twice is a no-op.
  const mistake = newInstallmentPlan({ id: 'oops', card, cardAccount, merchant: 'Error', category: 'Otros', purchaseDateISO: '2026-11-01', principalMinor: 900, count: 3, placement: 'next', createdAt: now });
  await createInstallmentPlan(db, mistake);
  await deleteInstallmentPlan(db, 'oops', now);
  const gone = await planOf(db, 'oops');
  assert.deepEqual([gone.deleted, gone.cancelledAt, gone.revision, gone.schedule.length], [true, null, 1, 3]);
  await deleteInstallmentPlan(db, 'oops', '2026-09-30T10:00:00.000Z');
  assert.deepEqual(await planOf(db, 'oops'), gone);
  assert.equal(await catchUpInstallments(db, '2030-01-01'), 0);
  assert.equal((await db.getFirstAsync<{ n: number }>('SELECT count(*) AS n FROM installments'))?.n, 12 + 3 + 3, 'no row is ever DELETEd');
  // No save path rewrites price, count or dates; a lifecycle flag through a save is refused too.
  await assert.rejects(saveInstallmentPlan(db, { ...cancelled, principalMinor: 110000, revision: 2, updatedAt: now }), new RegExp(PLAN_CHANGE_MESSAGE));
  const fin = await planOf(db, 'fin');
  await assert.rejects(saveInstallmentPlan(db, { ...fin, deleted: true, revision: 1, updatedAt: now }), new RegExp(PLAN_DELETE_PATH_MESSAGE));
  await assert.rejects(saveInstallmentPlan(db, { ...fin, cancelledAt: now, revision: 1, updatedAt: now }), new RegExp(PLAN_DELETE_PATH_MESSAGE));
  await saveInstallmentPlan(db, cancelled); // Identical: a no-op.
});

test('the card lifecycle with plans: archived keeps recording and paying; deletion is refused with a pending plan and allowed once every instalment is recognised and paid; a deleted card takes nothing', async () => {
  const { db } = await seeded();
  await createTransfer(db, transfer('pay0', 'bank', 'card-account', 23100, '2026-09-11'));
  assert.equal(cardDebtMinor(card, await readSnapshot(db)), 0);
  await assert.rejects(deleteCreditCard(db, 'card', now), new RegExp(CARD_PLAN_MESSAGE), 'no balance due, but a pending plan');
  assert.equal((await planOf(db, 'tv')).deleted, false);
  assert.equal((await readArchive(db)).cards![0].deleted, false, 'the card is untouched by the refusal');
  // Archived: instalments keep coming due and payments keep landing.
  await saveCreditCard(db, { ...card, active: false, revision: 1, updatedAt: now });
  assert.equal(await catchUpInstallments(db, '2026-11-25'), 3);
  await createTransfer(db, transfer('pay1', 'bank', 'card-account', 30000, '2026-11-26'));
  assert.equal(cardDebtMinor(card, await readSnapshot(db)), 0);
  await assert.rejects(deleteCreditCard(db, 'card', now), new RegExp(CARD_PLAN_MESSAGE));
  // Reactivated, run to the end, paid: deletable; the finished plan stays with the deleted card.
  await saveCreditCard(db, { ...card, active: true, revision: 2, updatedAt: now });
  assert.equal(await catchUpInstallments(db, '2027-08-20'), 9);
  await createTransfer(db, transfer('pay2', 'bank', 'card-account', 90000, '2027-08-21'));
  await deleteCreditCard(db, 'card', now);
  const archive = await readArchive(db);
  assert.equal(archive.cards![0].deleted, true);
  assert.deepEqual([archive.installmentPlans![0].id, installmentPlanFigures(archive.installmentPlans![0], archive.records).status], ['tv', 'completed']);
  assert.equal(archive.records.filter(record => record.entry.id.startsWith('inst_tv')).length, 12, 'history intact');
  await assert.rejects(createInstallmentPlan(db, { ...financed, id: 'late' }), new RegExp(CARD_DELETED_MESSAGE));
  await assert.rejects(createTransfer(db, transfer('pay3', 'bank', 'card-account', 1, '2027-08-22')), new RegExp(CARD_DELETED_MESSAGE));
  assert.equal(await catchUpInstallments(db, '2030-01-01'), 0);
});

test('a plan is not a recurring rule and not a personal debt: the recurring catch-up never records an instalment, the same merchant/amount/date coexist, pausing the rule or settling the debt touches no plan, and deleting a cash account leaves it whole', async () => {
  const { db } = await seeded();
  const rule: RecurringRule = { id: 'tv', accountId: 'card-account', kind: 'expense', amountMinor: 10000, merchant: 'Electro', category: 'Hogar', frequency: 'monthly',
    anchorDateISO: '2026-09-20', nextDateISO: '2026-09-20', active: true, deleted: false, createdAt, revision: 0, updatedAt: createdAt };
  await saveRecurringRule(db, rule);
  await createPersonalDebt(db, debtAccount, debt);
  assert.equal(await processRecurring(db, '2026-10-25', now), 2, 'the rule\'s own two dates');
  assert.deepEqual(await instalmentIds(db), [], 'the recurring catch-up recorded no instalment');
  assert.equal(await catchUpInstallments(db, '2026-10-25'), 2);
  let archive = await readArchive(db);
  assert.deepEqual(archive.records.map(record => record.entry.id).filter(id => /^(rec|inst)_/.test(id)).sort(), ['inst_tv_001', 'inst_tv_002', 'rec_tv_20260920', 'rec_tv_20261020']);
  assert.equal(recurringHistory(rule, (await readSnapshot(db)).entries).length, 2, 'the rule claims only its own');
  assert.equal(cardDebtMinor(card, await readSnapshot(db)), 23100 + 20000 + 20000, 'two facts, never one');
  // The rule paused: the plan keeps going; the debt settled: the plan does not move; the debt totals never see the card.
  const { pauseRecurringRule } = await import('@finanzapp/domain');
  await saveRecurringRule(db, pauseRecurringRule((await readArchive(db)).recurring!.find(item => item.id === 'tv')!, now));
  assert.equal(await processRecurring(db, '2026-11-25', now), 0);
  assert.equal(await catchUpInstallments(db, '2026-11-25'), 1);
  await createTransfer(db, transfer('settle', 'bank', 'debt-account', 30000, '2026-11-26'));
  archive = await readArchive(db);
  const snapshot = await readSnapshot(db);
  assert.deepEqual(debtTotalsByCurrency(archive.debts!, snapshot), [{ status: 'ready', currency: 'ARS', owedMinor: 0, receivableMinor: 0 }]);
  assert.equal(installmentPlanFigures(archive.installmentPlans![0], archive.records).recognisedMinor, 30000);
  assert.deepEqual(liquidTotalsByCurrency(snapshot, archive.cards, archive.debts), { ARS: 500000 - 30000 }, 'Disponible: cash only, no instalment, no debt');
  // A plan needs a card: a cash account or a debt is refused; deleting a cash account changes nothing of the plan.
  await assert.rejects(createInstallmentPlan(db, { ...financed, id: 'x', cardId: 'debt' }), /tarjeta de crédito existente/);
  await createAccount(db, { ...bank, id: 'wallet', name: 'Billetera' });
  const { deleteAccount } = await import('../src/storage/database.ts');
  await deleteAccount(db, 'wallet', now);
  assert.deepEqual(await planOf(db, 'tv'), tv);
  assert.equal(await catchUpInstallments(db, '2026-12-25'), 1);
});

test('backup v12: export, restore into a fresh device (nothing recorded twice, the catch-up finds the ids), a duplicated restore, a conflicting copy, and the older-build refusal contract', async () => {
  const { db } = await seeded();
  await createInstallmentPlan(db, financed);
  await catchUpInstallments(db, '2026-10-25');
  await cancelInstallmentPlan(db, 'fin', now);
  const source = await readArchive(db);
  const backup = createRecoveryBackup(source, new Date(now));
  assert.equal(backup.schema, 'finanzapp.native-pilot.v12');
  assert.equal(backup.installmentPlans!.length, 2);
  assert.equal(backup.installmentPlans!.find(plan => plan.id === 'fin')!.cancelledAt, now);
  assert.equal(JSON.stringify(backup).length < 5 * 1024 * 1024, true);
  // A fresh device: the plans arrive with their schedules and their recorded instalments; the catch-up adds nothing already there.
  const fresh = setup().db;
  await initializeDatabase(fresh);
  const parsed = parsePilotBackup(JSON.stringify(backup));
  const preview = previewBackupImport(await readArchive(fresh), parsed.archive);
  assert.deepEqual([preview.installmentPlans.length, preview.records.length, preview.conflicts], [2, 5, 0], 'the plain purchase, tv 1 and 2, fin 1 and its interest');
  await importArchive(fresh, parsed.archive, preview.baseline);
  const restored = await readArchive(fresh);
  assert.deepEqual(restored.installmentPlans, source.installmentPlans);
  assert.deepEqual(await instalmentIds(fresh), await instalmentIds(db));
  assert.equal(await catchUpInstallments(fresh, '2026-10-25'), 0, 'restored instalments are known: nothing twice');
  assert.equal(await catchUpInstallments(fresh, '2026-11-25'), 1, 'tv 3 (fin is cancelled)');
  // The same copy again: identical, nothing to import.
  const again = previewBackupImport(await readArchive(fresh), parsed.archive);
  assert.deepEqual([again.installmentPlans.length, again.records.length, again.conflicts], [0, 0, 0]);
  await importArchive(fresh, parsed.archive, again.baseline);
  // A copy where the plan differs (the version before its cancellation) contradicts local changes: nothing imported.
  const olderArchive = { ...parsed.archive, installmentPlans: parsed.archive.installmentPlans!.map(plan => plan.id === 'fin' ? { ...plan, cancelledAt: null, revision: 0, updatedAt: plan.createdAt } : plan) };
  const older = previewBackupImport(await readArchive(fresh), olderArchive);
  assert.equal(older.conflicts, 1);
  await assert.rejects(importArchive(fresh, olderArchive, older.baseline), /contradice cambios locales/);
  assert.equal((await planOf(fresh, 'fin')).cancelledAt, now, 'the local cancellation stands');
  // The refusal contract: a v12 file read by a build that knows up to v11 (its parser told the file is v11) refuses the extra key; a v13 file is refused by name.
  assert.throws(() => parsePilotBackup(JSON.stringify({ ...backup, schema: 'finanzapp.native-pilot.v11' })), /campos faltantes/);
  assert.throws(() => parsePilotBackup(JSON.stringify({ ...backup, schema: 'finanzapp.native-pilot.v13' })), /versiones 1 a 12/);
  // Without a plan the file stays as before (v11 here: the seeded card is live, so v8 with no plan).
  const plainDb = setup().db;
  await initializeDatabase(plainDb);
  await createAccount(plainDb, bank);
  await createCreditCard(plainDb, cardAccount, card);
  assert.equal(createRecoveryBackup(await readArchive(plainDb), new Date(now)).schema, 'finanzapp.native-pilot.v8');
});
