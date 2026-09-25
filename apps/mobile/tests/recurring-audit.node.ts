import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { accountBalanceMinor, archiveKey, createRecoveryBackup, deleteRecurringRule, parsePilotBackup, makeEntryChange, pauseRecurringRule, recurringHistory, recurringNeedsReview, resumeRecurringRule, snapshotFromArchive,
  type Account, type RecurringRule } from '@finanzapp/domain';
import { catchUpRecurring, changeEntry, createAccount, importArchive, initializeDatabase, processRecurring, readArchive, saveRecurringRule, type LedgerDatabase } from '../src/storage/database.ts';
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
// rule, and LedgerProvider showed "No pudimos abrir tus datos" on every launch. 24UX5 review (owner's decision): the
// backlog is recorded automatically, in durable batches, with every original date; nothing is dropped.
const weeklyDates = (fromISO: string, count: number) => Array.from({ length: count }, (_, index) => {
  const [y, m, d] = fromISO.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + index * 7)).toISOString().slice(0, 10);
});

test('an extraordinary backlog is recorded automatically in batches, with every original date, and the other rules and data still open', async () => {
  const { db, path } = await ledger();
  // A weekly rule left behind for more than seven years (the form refuses a past date; a long absence or an old
  // restore can still produce it), and a healthy monthly rule.
  await saveRecurringRule(db, rule({ id: 'stale', frequency: 'weekly', anchorDateISO: '2026-01-01', nextDateISO: '2026-01-01' }));
  await saveRecurringRule(db, rule({ id: 'rent', anchorDateISO: '2033-06-01', nextDateISO: '2033-06-01' }));
  const opened = await openLedger(databaseAt(path), '2033-06-02');
  assert.deepEqual(opened.recurringFailures, []);
  assert.equal(opened.recurringError, false);
  assert.deepEqual(await datesOf(db, 'rent'), ['2033-06-01'], 'the healthy rule was recorded');
  const expected = weeklyDates('2026-01-01', 388); // 2026-01-01 … 2033-06-02, every Thursday
  assert.equal(expected.at(-1), '2033-06-02');
  assert.deepEqual(await datesOf(db, 'stale'), expected, 'every date, in order, none dropped past 366');
  const stale = await ruleOf(db, 'stale');
  assert.equal(stale.nextDateISO, '2033-06-09');
  assert.equal(recurringNeedsReview(stale, '2033-06-02'), false, 'nothing is left for the person to review');
  // Idempotent: opening again records nothing more.
  await openLedger(databaseAt(path), '2033-06-02');
  assert.equal((await readArchive(db)).records.length, 389);
});

test('the 366 boundary: 366 dates are one step; 367 and 733 are recorded in full over two and three steps', async () => {
  for (const count of [366, 367, 733]) {
    const { db } = await ledger();
    const dates = weeklyDates('2026-01-01', count);
    await saveRecurringRule(db, rule({ id: 'edge', frequency: 'weekly', anchorDateISO: '2026-01-01', nextDateISO: '2026-01-01' }));
    const result = await catchUpRecurring(db, dates.at(-1)!, '2040-01-01T12:00:00.000Z');
    assert.equal(result.created, count, String(count));
    assert.deepEqual(result.behind, []);
    assert.deepEqual(await datesOf(db, 'edge'), dates);
    // One revision per step: a normal catch-up (one step) is exactly what it was before.
    assert.equal((await ruleOf(db, 'edge')).revision, Math.ceil(count / 366), 'one committed step per 366 dates');
  }
});

test('an interruption between batches keeps the steps already written; the next launch resumes without duplicates', async () => {
  const { db, path } = await ledger();
  await saveRecurringRule(db, rule({ id: 'stale', frequency: 'weekly', anchorDateISO: '2026-01-01', nextDateISO: '2026-01-01' }));
  // The second step dies on disk (an app killed mid catch-up): its transaction rolls back as a whole.
  let steps = 0;
  const failing: LedgerDatabase = { ...db, withExclusiveTransactionAsync: work => {
    steps++;
    return db.withExclusiveTransactionAsync(tx => work(steps < 2 ? tx : { ...tx, runAsync: async (sql, ...params) => {
      if (sql.startsWith('INSERT INTO entries')) throw new Error('Killed mid catch-up');
      return tx.runAsync(sql, ...params);
    } }));
  } };
  await assert.rejects(catchUpRecurring(failing, '2033-06-02', '2033-06-02T12:00:00.000Z', { batchSize: 100 }), /Killed/);
  assert.deepEqual(await datesOf(db, 'stale'), weeklyDates('2026-01-01', 100), 'the first step is durable');
  assert.equal((await ruleOf(db, 'stale')).nextDateISO, weeklyDates('2026-01-01', 101)[100], 'the rule advanced with it, not further');
  // Relaunch: the rest, once.
  await openLedger(databaseAt(path), '2033-06-02');
  assert.deepEqual(await datesOf(db, 'stale'), weeklyDates('2026-01-01', 388));
  assert.equal(new Set((await readArchive(db)).records.map(record => record.entry.id)).size, 388);
});

test('a backlog replayed over occurrences already recorded, edited or undone never duplicates them or undoes the person’s changes', async () => {
  const { db, path } = await ledger();
  await saveRecurringRule(db, rule({ id: 'stale', frequency: 'weekly', anchorDateISO: '2026-01-01', nextDateISO: '2026-01-01' }));
  await catchUpRecurring(db, '2033-06-02', '2033-06-02T12:00:00.000Z', { batchSize: 100, maxSteps: 2 });
  const records = (await readArchive(db)).records;
  assert.equal(records.length, 200, 'two steps, then the pass stops (bounded launch)');
  const edited = records.find(record => record.entry.dateISO === '2026-01-08')!;
  const undone = records.find(record => record.entry.dateISO === '2027-01-07')!;
  await changeEntry(db, makeEntryChange('edit', edited, 'edit', '2033-06-02T13:00:00.000Z', { ...edited.entry, amountMinor: 4321 }));
  await changeEntry(db, makeEntryChange('void', undone, 'void', '2033-06-02T13:00:01.000Z'));
  // The rule is moved back to its first date (an old restore, a manual correction): every date is materialized again.
  const saved = await ruleOf(db, 'stale');
  await saveRecurringRule(db, { ...saved, nextDateISO: '2026-01-01', revision: saved.revision + 1, updatedAt: '2033-06-02T13:01:00.000Z' });
  const opened = await openLedger(databaseAt(path), '2033-06-02');
  assert.deepEqual(opened.recurringFailures, []);
  const after = (await readArchive(db)).records;
  assert.equal(after.length, 388, 'each date exactly once');
  assert.equal(after.find(record => record.entry.id === edited.entry.id)!.entry.amountMinor, 4321, 'the edit stands');
  assert.equal(after.find(record => record.entry.id === undone.entry.id)!.voided, true, 'the undo stands');
});

test('one launch is bounded: a rule still behind after the step limit continues on the next launch, with no date lost', async () => {
  const { db } = await ledger();
  await saveRecurringRule(db, rule({ id: 'stale', frequency: 'weekly', anchorDateISO: '2026-01-01', nextDateISO: '2026-01-01' }));
  const first = await catchUpRecurring(db, '2033-06-02', '2033-06-02T12:00:00.000Z', { batchSize: 50, maxSteps: 3 });
  assert.equal(first.created, 150);
  assert.deepEqual(first.behind, ['stale']);
  const second = await catchUpRecurring(db, '2033-06-02', '2033-06-02T12:00:01.000Z', { batchSize: 50 });
  assert.equal(second.created, 238);
  assert.deepEqual(second.behind, []);
  assert.deepEqual(await datesOf(db, 'stale'), weeklyDates('2026-01-01', 388));
});

test('an ordinary late opening (3 to 11 days) is one step and records the same movements as before', async () => {
  for (const late of [3, 11]) {
    const { db } = await ledger();
    await saveRecurringRule(db, rule({ id: 'm', anchorDateISO: '2026-03-05', nextDateISO: '2026-03-05' }));
    await saveRecurringRule(db, rule({ id: 'salary', kind: 'income', merchant: 'Sueldo', category: 'Sueldo', anchorDateISO: '2026-03-01', nextDateISO: '2026-03-01' }));
    const today = '2026-03-' + String(5 + late).padStart(2, '0');
    const result = await catchUpRecurring(db, today, today + 'T12:00:00.000Z');
    assert.equal(result.created, 2);
    assert.deepEqual([await datesOf(db, 'm'), await datesOf(db, 'salary')], [['2026-03-05'], ['2026-03-01']]);
    assert.equal((await ruleOf(db, 'm')).revision, 1, 'one step');
  }
});

test('an old backup restored years later records its rules’ whole backlog, in batches, once', async () => {
  const { db } = await ledger();
  await saveRecurringRule(db, rule({ id: 'stale', frequency: 'weekly', anchorDateISO: '2026-01-01', nextDateISO: '2026-01-01' }));
  const backup = parsePilotBackup(JSON.stringify(createRecoveryBackup(await readArchive(db)))).archive;
  const { db: fresh } = await ledger();
  await importArchive(fresh, backup, archiveKey(await readArchive(fresh)));
  await openLedger(fresh, '2033-06-02');
  await openLedger(fresh, '2033-06-02');
  assert.deepEqual(await datesOf(fresh, 'stale'), weeklyDates('2026-01-01', 388));
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

// Owner's decision (review of PR #59): recurring expenses and incomes are recorded automatically; there is no per-rule
// confirmation mode, now or on the roadmap. Managing a rule is pause, resume and delete.
test('recurring rules stay automatic: no confirmation mode in the app, the catalogue or the roadmap', () => {
  const read = (path: string) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
  const roadmap = read('../../docs/mobile-roadmap.md'), identity = read('../../docs/merchant-identity.md');
  for (const doc of [roadmap, identity]) {
    assert.doesNotMatch(doc, /«Registrar automáticamente» \(today|Per-rule mode|expected → paid|be \*\*expected\*\* instead/);
  }
  assert.match(roadmap, /Recurring rules stay\s+automatic/);
  for (const file of ['src/i18n/messages/es/recurring.ts', 'src/i18n/messages/en/recurring.ts', 'src/ui/recurring-form.tsx', 'src/ui/commitment-actions.ts']) {
    assert.doesNotMatch(read(file), /Esperar confirmación|Wait for confirmation|confirmationMode|autoRecord/i, file);
  }
});
