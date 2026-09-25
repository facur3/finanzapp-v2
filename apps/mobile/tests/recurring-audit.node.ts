import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { accountBalanceMinor, deleteRecurringRule, makeEntryChange, pauseRecurringRule, recurringHistory, resumeRecurringRule, snapshotFromArchive,
  type Account, type RecurringRule } from '@finanzapp/domain';
import { changeEntry, createAccount, initializeDatabase, processRecurring, readArchive, saveRecurringRule, type LedgerDatabase } from '../src/storage/database.ts';
import { openLedger, refreshLedger } from '../src/storage/ledger-session.ts';
import { runExclusiveTransaction, runSchemaMigration, type TransactionConnection } from '../src/storage/transaction.ts';

/** Producto 24UX5: what a recurring rule does today, pinned against a real SQLite file. Synthetic records in disposable
 * databases only; nothing seeds a user's app. A rule records a normal movement on its due date; "recorded by FinanzApp"
 * is never a bank payment, and nothing runs while the app is closed: the catch-up happens on the next open or return
 * to the foreground (`openLedger` / `refreshLedger`, the two paths LedgerProvider takes). */

function connection(path: string): TransactionConnection {
  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys = OFF');
  return {
    execAsync: async sql => { db.exec(sql); },
    runAsync: async (sql, ...params) => ({ changes: Number(db.prepare(sql).run(...params).changes) }),
    getFirstAsync: async <T>(sql: string, ...params: (string | number | null)[]) => {
      const row = db.prepare(sql).get(...params);
      return row ? { ...row } as T : null;
    },
    getAllAsync: async <T>(sql: string, ...params: (string | number | null)[]) => db.prepare(sql).all(...params).map(row => ({ ...row })) as T[],
    closeAsync: async () => { db.close(); },
  };
}
const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => { for (const cleanup of cleanups.splice(0).reverse()) await cleanup(); });
function databaseAt(path: string): LedgerDatabase {
  const base = connection(path);
  let closed = false;
  cleanups.push(async () => { if (!closed) { closed = true; await base.closeAsync(); } });
  return { ...base,
    withExclusiveTransactionAsync: work => runExclusiveTransaction(async () => connection(path), work),
    withMigrationTransactionAsync: work => runSchemaMigration(async () => connection(path), work) };
}
async function ledger() {
  const directory = mkdtempSync(join(tmpdir(), 'finanzapp-recurring-'));
  cleanups.push(async () => { rmSync(directory, { recursive: true, force: true }); });
  const path = join(directory, 'ledger.sqlite');
  const db = databaseAt(path);
  await initializeDatabase(db);
  await createAccount(db, cash);
  return { db, path };
}

const cash: Account = { id: 'cash', name: 'Efectivo', currency: 'ARS', openingMinor: 1_000_000, createdAt: '2026-01-01T12:00:00.000Z' };
const at = '2026-01-01T12:00:00.000Z';
function rule(overrides: Partial<RecurringRule>): RecurringRule {
  return { id: 'rule', accountId: cash.id, kind: 'expense', amountMinor: 1000, merchant: 'Netflix', category: 'Suscripciones', frequency: 'monthly',
    anchorDateISO: '2026-01-15', nextDateISO: '2026-01-15', active: true, deleted: false, createdAt: at, revision: 0, updatedAt: at, ...overrides };
}
const datesOf = async (db: LedgerDatabase, ruleId = 'rule') => recurringHistory({ id: ruleId }, snapshotFromArchive(await readArchive(db)).entries).map(entry => entry.dateISO).reverse();
const ruleOf = async (db: LedgerDatabase, id = 'rule') => (await readArchive(db)).recurring!.find(item => item.id === id)!;

test('an active rule is processed when the ledger opens, and again when the app returns to the foreground', async () => {
  const { db, path } = await ledger();
  await saveRecurringRule(db, rule({}));
  // Opening a fresh connection on the due day records it, dated on the due date.
  const opened = await openLedger(databaseAt(path), '2026-01-15');
  assert.equal(opened.archive.records.length, 1);
  assert.equal(opened.archive.records[0].entry.dateISO, '2026-01-15');
  assert.deepEqual(opened.recurringFailures, []);
  // The app stayed in memory a month; coming back to the foreground records February on its own date.
  const refreshed = await refreshLedger(db, '2026-02-20');
  assert.deepEqual(refreshed.archive.records.map(record => record.entry.dateISO).sort(), ['2026-01-15', '2026-02-15']);
  assert.equal((await ruleOf(db)).nextDateISO, '2026-03-15');
});

test('a date that passed while the app was closed is recorded with the due date, not the opening date', async () => {
  const { db, path } = await ledger();
  await saveRecurringRule(db, rule({ nextDateISO: '2026-03-15', anchorDateISO: '2026-03-15' }));
  await openLedger(databaseAt(path), '2026-03-19'); // opened four days late
  assert.deepEqual(await datesOf(db), ['2026-03-15']);
  const entry = (await readArchive(db)).records[0].entry;
  assert.equal(entry.createdAt, '2026-03-15T12:00:00.000Z', 'the movement belongs to its due day');
});

test('expenses and incomes are both recorded, each with its own sign on the balance', async () => {
  const { db } = await ledger();
  await saveRecurringRule(db, rule({ id: 'rent', amountMinor: 50_000 }));
  await saveRecurringRule(db, rule({ id: 'salary', kind: 'income', amountMinor: 200_000, merchant: 'Sueldo', category: 'Sueldo' }));
  assert.equal(await processRecurring(db, '2026-01-15'), 2);
  const archive = await readArchive(db);
  assert.deepEqual(archive.records.map(record => record.entry.kind).sort(), ['expense', 'income']);
  assert.equal(accountBalanceMinor(cash, snapshotFromArchive(archive).entries), 1_000_000 - 50_000 + 200_000);
});

test('many openings and foregrounds never record an occurrence twice', async () => {
  const { db, path } = await ledger();
  await saveRecurringRule(db, rule({}));
  for (let index = 0; index < 5; index++) {
    await openLedger(databaseAt(path), '2026-02-16');
    await refreshLedger(db, '2026-02-16');
  }
  assert.deepEqual(await datesOf(db), ['2026-01-15', '2026-02-15']);
});

test('pausing and resuming never records the dates that fell due during the pause', async () => {
  const { db } = await ledger();
  await saveRecurringRule(db, rule({}));
  await processRecurring(db, '2026-01-15');
  await saveRecurringRule(db, pauseRecurringRule(await ruleOf(db), '2026-01-20T12:00:00.000Z'));
  await processRecurring(db, '2026-04-10'); // February and March fall due while paused
  assert.deepEqual(await datesOf(db), ['2026-01-15']);
  await saveRecurringRule(db, resumeRecurringRule(await ruleOf(db), '2026-04-10', '2026-04-10T12:00:00.000Z'));
  assert.equal((await ruleOf(db)).nextDateISO, '2026-04-15', 'the next date moves forward along the anchor day');
  await processRecurring(db, '2026-04-15');
  assert.deepEqual(await datesOf(db), ['2026-01-15', '2026-04-15']);
});

test('deleting a rule never records again, and what it recorded keeps its history', async () => {
  const { db } = await ledger();
  await saveRecurringRule(db, rule({}));
  await processRecurring(db, '2026-02-15');
  await saveRecurringRule(db, deleteRecurringRule(await ruleOf(db), '2026-02-16T12:00:00.000Z'));
  assert.equal(await processRecurring(db, '2027-12-31'), 0);
  assert.deepEqual(await datesOf(db), ['2026-01-15', '2026-02-15'], 'the recorded movements stay and still name their rule');
  assert.equal((await readArchive(db)).records.every(record => !record.voided), true);
});

test('weekly, monthly and yearly calendars: month ends, leap years and the turn of the year', async () => {
  const { db } = await ledger();
  await saveRecurringRule(db, rule({ id: 'weekly', frequency: 'weekly', anchorDateISO: '2026-12-24', nextDateISO: '2026-12-24' }));
  await saveRecurringRule(db, rule({ id: 'month-end', anchorDateISO: '2026-10-31', nextDateISO: '2026-10-31' }));
  await saveRecurringRule(db, rule({ id: 'leap', frequency: 'yearly', anchorDateISO: '2028-02-29', nextDateISO: '2028-02-29' }));
  await processRecurring(db, '2027-01-14');
  assert.deepEqual(await datesOf(db, 'weekly'), ['2026-12-24', '2026-12-31', '2027-01-07', '2027-01-14']);
  assert.deepEqual(await datesOf(db, 'month-end'), ['2026-10-31', '2026-11-30', '2026-12-31']);
  assert.equal((await ruleOf(db, 'month-end')).nextDateISO, '2027-01-31');
  await processRecurring(db, '2032-03-01');
  assert.deepEqual((await datesOf(db, 'month-end')).slice(3, 5), ['2027-01-31', '2027-02-28'], 'February ends early, the anchor day comes back');
  assert.deepEqual(await datesOf(db, 'leap'), ['2028-02-29', '2029-02-28', '2030-02-28', '2031-02-28', '2032-02-29']);
});

test('opening several days late records every missed date once, in order', async () => {
  const { db } = await ledger();
  await saveRecurringRule(db, rule({ frequency: 'weekly', anchorDateISO: '2026-05-01', nextDateISO: '2026-05-01' }));
  assert.equal(await processRecurring(db, '2026-05-26'), 4);
  assert.deepEqual(await datesOf(db), ['2026-05-01', '2026-05-08', '2026-05-15', '2026-05-22']);
  assert.equal((await ruleOf(db)).nextDateISO, '2026-05-29');
});

// Before 24UX5 one rule with more than 366 pending dates threw inside the single transaction that processes every
// rule, and LedgerProvider showed "No pudimos abrir tus datos" on every launch: no screen could be opened at all.
test('a rule with an extraordinary backlog is set aside for review; every other rule and all the data still open', async () => {
  const { db, path } = await ledger();
  // A weekly rule left behind for more than seven years (the form refuses a past date; a long absence or an old
  // restore can still produce it).
  await saveRecurringRule(db, rule({ id: 'stale', frequency: 'weekly', anchorDateISO: '2026-01-01', nextDateISO: '2026-01-01' }));
  await saveRecurringRule(db, rule({ id: 'rent', anchorDateISO: '2033-06-01', nextDateISO: '2033-06-01' }));
  const opened = await openLedger(databaseAt(path), '2033-06-02');
  assert.deepEqual(opened.recurringFailures, ['stale']);
  assert.deepEqual(await datesOf(db, 'rent'), ['2033-06-01'], 'the healthy rule was recorded');
  assert.deepEqual(await datesOf(db, 'stale'), [], 'nothing of the stale rule was recorded');
  const stale = await ruleOf(db, 'stale');
  assert.equal(stale.nextDateISO, '2026-01-01', 'the stale rule is untouched, waiting for the person');
  assert.equal(stale.active, true);
  // Controlled recovery: "Continuar desde hoy" is resume from today; the backlog is never recorded.
  await saveRecurringRule(db, resumeRecurringRule(stale, '2033-06-02', '2033-06-02T12:00:00.000Z'));
  const next = await openLedger(databaseAt(path), '2033-06-02');
  assert.deepEqual(next.recurringFailures, []);
  assert.equal((await ruleOf(db, 'stale')).nextDateISO, '2033-06-09', 'today was recorded; the rule runs on its weekday again');
  assert.deepEqual(await datesOf(db, 'stale'), ['2033-06-02']);
});

test('the 366 limit is the boundary: 366 pending dates are recorded, 367 are set aside', async () => {
  const { db } = await ledger();
  // 2026-01-01 + 365 weeks = the 366th weekly date.
  const day366 = new Date(Date.UTC(2026, 0, 1 + 365 * 7)).toISOString().slice(0, 10);
  await saveRecurringRule(db, rule({ id: 'edge', frequency: 'weekly', anchorDateISO: '2026-01-01', nextDateISO: '2026-01-01' }));
  assert.equal(await processRecurring(db, day366), 366);
  const { db: other } = await ledger();
  const day367 = new Date(Date.UTC(2026, 0, 1 + 366 * 7)).toISOString().slice(0, 10);
  await saveRecurringRule(other, rule({ id: 'edge', frequency: 'weekly', anchorDateISO: '2026-01-01', nextDateISO: '2026-01-01' }));
  assert.equal(await processRecurring(other, day367), 0);
  assert.equal((await ruleOf(other, 'edge')).nextDateISO, '2026-01-01');
});

// Before 24UX5: a rule whose next date was set back onto a day it had already recorded, after the person edited that
// movement, threw "Un vencimiento recurrente coincide con otro movimiento distinto" and blocked the app on every launch.
test('an occurrence already recorded (even edited by the person) counts as recorded: never duplicated, never blocking', async () => {
  const { db, path } = await ledger();
  await saveRecurringRule(db, rule({ nextDateISO: '2026-09-25', anchorDateISO: '2026-09-25' }));
  await processRecurring(db, '2026-09-25');
  const recorded = (await readArchive(db)).records[0];
  // The price went up: the person edits today's movement...
  await changeEntry(db, makeEntryChange('price-change', recorded, 'edit', '2026-09-25T13:00:00.000Z', { ...recorded.entry, amountMinor: 1500 }));
  // ...and moves the rule back to today with a new amount of its own.
  const saved = await ruleOf(db);
  await saveRecurringRule(db, { ...saved, amountMinor: 1600, nextDateISO: '2026-09-25', revision: saved.revision + 1, updatedAt: '2026-09-25T13:01:00.000Z' });
  const opened = await openLedger(databaseAt(path), '2026-09-25');
  assert.deepEqual(opened.recurringFailures, []);
  assert.equal(opened.archive.records.length, 1, 'no second movement for the same day');
  assert.equal(opened.archive.records[0].entry.amountMinor, 1500, 'the person’s edit stands');
  assert.equal((await ruleOf(db)).nextDateISO, '2026-10-25');
});

test('an undone recorded occurrence is not recorded again', async () => {
  const { db } = await ledger();
  await saveRecurringRule(db, rule({}));
  await processRecurring(db, '2026-01-15');
  const recorded = (await readArchive(db)).records[0];
  await changeEntry(db, makeEntryChange('undo', recorded, 'void', '2026-01-16T12:00:00.000Z'));
  const saved = await ruleOf(db);
  await saveRecurringRule(db, { ...saved, nextDateISO: '2026-01-15', revision: saved.revision + 1, updatedAt: '2026-01-16T12:00:01.000Z' });
  assert.equal(await processRecurring(db, '2026-01-16'), 0);
  const archive = await readArchive(db);
  assert.equal(archive.records.length, 1);
  assert.equal(archive.records[0].voided, true);
});

test('LedgerProvider opens and returns to the foreground through the session functions, and a recurring failure never hides the data', () => {
  const source = readFileSync(new URL('../src/storage/LedgerProvider.tsx', import.meta.url), 'utf8');
  assert.match(source, /await openLedger\(db, todayKey\(\)\)/);
  assert.match(source, /state !== 'active'[\s\S]*?await refreshLedger\(database\.current!, todayKey\(\)\)/);
  assert.doesNotMatch(source, /await processRecurring\(db, todayKey\(\)\);\s*const next = await readArchive/, 'opening no longer depends on processing succeeding');
});
