import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CYCLE_HISTORY_MESSAGE, CYCLE_STALE_MESSAGE, LEDGER_CURRENCIES, PLAN_CALENDAR_MESSAGE, cardCycleView, cardCycleDatesOf, categoryCatalog, planFinancingCategories, snapshotFromArchive, createRecoveryBackup, newCardCycle, newInstallmentPlan,
  parsePilotBackup, previewBackupImport, type Account, type CardCycleDates, type CreditCardProfile, type Entry } from '@finanzapp/domain';
import { DATABASE_VERSION, SCHEMA_SCRIPTS, catchUpInstallments, createAccount, createCreditCard, createEntry, createInstallmentPlan, deleteCreditCard, importArchive,
  initializeDatabase, readArchive, saveCreditCard, type LedgerDatabase } from '../src/storage/database.ts';
import { runExclusiveTransaction, runSchemaMigration, type TransactionConnection } from '../src/storage/transaction.ts';

// Producto 24T2 on real SQLite: schema 13 (a card's exact statement dates), the card form's calendar writes (the open
// statement, the due date still to pay, new usual days) planned again inside the transaction so a closed statement never
// moves, instalment plans reading the calendar known at their creation, and backup v13. Disposable databases only.
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
  const directory = mkdtempSync(join(tmpdir(), 'finanzapp-card-cycles-'));
  cleanups.push(async () => { rmSync(directory, { recursive: true, force: true }); });
  const path = join(directory, 'ledger.sqlite');
  return { db: databaseAt(path), path };
}
const version = async (db: LedgerDatabase) => (await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version;

const createdAt = '2026-09-01T12:00:00.000Z';
const bank: Account = { id: 'bank', name: 'Banco', currency: 'ARS', openingMinor: 500000, createdAt };
const cardAccount: Account = { id: 'card-account', name: 'Visa', currency: 'ARS', openingMinor: 0, createdAt };
/** Closing day 28, due day 5: on 2026-10-01 the next due (5 oct) belongs to the statement closed on 28 sep. */
const card: CreditCardProfile = { id: 'card', accountId: cardAccount.id, issuer: 'Banco', last4: '4009', creditLimitMinor: 1000000, closingDay: 28, dueDay: 5,
  active: true, deleted: false, createdAt, revision: 0, updatedAt: createdAt };
const at = (day: string) => `${day}T12:00:00.000Z`;
const edit = (base: CreditCardProfile, revision: number, day: string, change: Partial<CreditCardProfile> = {}): CreditCardProfile =>
  ({ ...base, ...change, revision, updatedAt: at(day) });
const rowsOf = async (db: LedgerDatabase) => cardCycleDatesOf(card.id, (await readArchive(db)).cardCycleDates).map(row => [row.sequence, row.closingISO, row.dueISO, row.revision].join(' '));
const viewOn = async (db: LedgerDatabase, todayISO: string) => {
  const archive = await readArchive(db);
  const stored = archive.cards!.find(item => item.id === card.id)!;
  const view = cardCycleView(stored, cardCycleDatesOf(card.id, archive.cardCycleDates), todayISO);
  return { open: view.open.closingISO, openDue: view.open.dueISO, previous: view.previous.closingISO, nextDue: view.nextDue.dueISO, toPay: view.toPay?.closingISO ?? null };
};
async function seeded() {
  const { db, path } = setup();
  await initializeDatabase(db);
  await createAccount(db, bank);
  await createCreditCard(db, cardAccount, card);
  return { db, path };
}

test('schema 13 is reached from a real schema 12 file by an additive migration: an empty table, every row untouched, no date fabricated; an interrupted step reaches 13 once; a newer file is refused intact', async () => {
  const { db } = setup();
  for (const script of SCHEMA_SCRIPTS.slice(0, 12)) await db.execAsync(script);
  await db.execAsync(`INSERT INTO accounts (id, name, currency, openingMinor, createdAt, revision, updatedAt) VALUES ('card-account', 'Visa', 'ARS', 0, '${createdAt}', 0, '${createdAt}');
    INSERT INTO credit_cards (id, accountId, issuer, last4, creditLimitMinor, closingDay, dueDay, active, deleted, createdAt, revision, updatedAt) VALUES ('card', 'card-account', 'Banco', '4009', 1000000, 28, 5, 1, 0, '${createdAt}', 0, '${createdAt}');
    INSERT INTO entries (id, accountId, kind, amountMinor, merchant, category, dateISO, createdAt, revision, voided, updatedAt) VALUES ('p1', 'card-account', 'expense', 100, 'Súper', 'Comida', '2026-09-10', '${createdAt}', 0, 0, '${createdAt}');`);
  assert.equal(await version(db), 12);
  // A step that fails midway rolls back: the file stays a complete schema 12 file.
  const failing: LedgerDatabase = { ...db, withExclusiveTransactionAsync: work => db.withExclusiveTransactionAsync(tx => work({ ...tx,
    execAsync: async sql => { await tx.execAsync(sql); if (sql.includes('card_cycle_dates')) throw new Error('Interrupted v13'); } })) };
  await assert.rejects(initializeDatabase(failing), /Interrupted v13/);
  assert.equal(await version(db), 12);
  assert.equal((await db.getAllAsync<{ name: string }>("SELECT name FROM sqlite_master WHERE name = 'card_cycle_dates'")).length, 0, 'the table rolled back with its step');
  await initializeDatabase(db);
  assert.equal(await version(db), 13);
  assert.equal(DATABASE_VERSION, 13);
  const archive = await readArchive(db);
  assert.equal(archive.cardCycleDates, undefined, 'old data gets no exact date');
  assert.deepEqual(archive.cards?.[0], card);
  assert.equal(archive.records[0].entry.amountMinor, 100);
  assert.equal((await db.getFirstAsync<{ n: number }>('SELECT count(*) AS n FROM card_cycle_dates'))?.n, 0);
  // IF NOT EXISTS: a file that already has the table (an interrupted step after the CREATE) reaches 13 once more.
  await db.execAsync('PRAGMA user_version = 12');
  await initializeDatabase(db);
  assert.equal(await version(db), 13);
  await db.execAsync('PRAGMA user_version = 14');
  await assert.rejects(initializeDatabase(db), /versión más nueva/);
  assert.equal(await version(db), 14, 'refused unchanged');
  await db.execAsync('PRAGMA user_version = 13');
  // The row needs its card, and a due on or before its closing is refused by the schema itself.
  await assert.rejects(db.withExclusiveTransactionAsync(async tx => { await tx.runAsync(`INSERT INTO card_cycle_dates (cardId, sequence, closingISO, dueISO, closingDay, dueDay, monthISO, createdAt, revision, updatedAt) VALUES ('nope', 0, '2026-10-28', '2026-11-05', 28, 5, '2026-10', '${createdAt}', 0, '${createdAt}')`); }), /FOREIGN KEY/);
  await assert.rejects(db.withExclusiveTransactionAsync(async tx => { await tx.runAsync(`INSERT INTO card_cycle_dates (cardId, sequence, closingISO, dueISO, closingDay, dueDay, monthISO, createdAt, revision, updatedAt) VALUES ('card', 0, '2026-10-28', '2026-10-28', 28, 5, '2026-10', '${createdAt}', 0, '${createdAt}')`); }), /CHECK/);
});

test('a new card stores its first statement exactly only when its usual days cannot produce it, in the card’s own commit; a retry is a no-op and other dates are refused', async () => {
  const { db } = setup();
  await initializeDatabase(db);
  const plain = newCardCycle({ cardId: card.id, closingISO: '2026-10-28', dueISO: '2026-11-05', todayISO: '2026-10-01', nowISO: createdAt });
  assert.deepEqual(plain, { days: { closingDay: 28, dueDay: 5 }, rows: [] });
  const late = newCardCycle({ cardId: card.id, closingISO: '2026-10-28', dueISO: '2026-12-05', todayISO: '2026-10-01', nowISO: createdAt });
  const created = { ...card, ...late.days };
  await createCreditCard(db, cardAccount, created, LEDGER_CURRENCIES, late.rows);
  await createCreditCard(db, cardAccount, created, LEDGER_CURRENCIES, late.rows); // Retry after a failed refresh.
  assert.deepEqual(await rowsOf(db), ['0 2026-09-28 2026-10-05 0', '1 2026-10-28 2026-12-05 0']);
  await assert.rejects(createCreditCard(db, cardAccount, created, LEDGER_CURRENCIES, []), /ya existe/);
  await assert.rejects(createCreditCard(db, { ...cardAccount, id: 'other-account' }, { ...created, id: 'other', accountId: 'other-account' }, LEDGER_CURRENCIES, late.rows), /cambios previos/,
    'rows of another card never ride along');
  assert.deepEqual(await viewOn(db, '2026-10-01'), { open: '2026-10-28', openDue: '2026-12-05', previous: '2026-09-28', nextDue: '2026-10-05', toPay: '2026-09-28' });
});

test('exact dates for the open statement freeze the statement before it in the same commit; the due still to pay moves alone; a stale form and a moved closed statement are refused; new days never move what closed', async () => {
  const { db } = await seeded();
  const first = edit(card, 1, '2026-10-01');
  await saveCreditCard(db, first, { open: { statementClosingISO: '2026-10-28', closingISO: '2026-10-26', dueISO: '2026-11-04' } }, '2026-10-01');
  await saveCreditCard(db, first, { open: { statementClosingISO: '2026-10-28', closingISO: '2026-10-26', dueISO: '2026-11-04' } }, '2026-10-01'); // A retry.
  assert.deepEqual(await rowsOf(db), ['0 2026-09-28 2026-10-05 0', '1 2026-10-26 2026-11-04 0']);
  assert.deepEqual(await viewOn(db, '2026-10-01'), { open: '2026-10-26', openDue: '2026-11-04', previous: '2026-09-28', nextDue: '2026-10-05', toPay: '2026-09-28' });
  // A form still showing 28 oct is stale now: refused, nothing written.
  await assert.rejects(saveCreditCard(db, edit(card, 2, '2026-10-02'), { open: { statementClosingISO: '2026-10-28', closingISO: '2026-10-27', dueISO: '2026-11-04' } }, '2026-10-02'),
    new RegExp(CYCLE_STALE_MESSAGE));
  assert.equal((await readArchive(db)).cards![0].revision, 1);
  // The statement still to pay: its due moves (a weekend shift the person read on the statement), its closing never does.
  await saveCreditCard(db, edit(card, 2, '2026-10-02'), { toPay: { statementClosingISO: '2026-09-28', dueISO: '2026-10-06' } }, '2026-10-02');
  assert.deepEqual(await rowsOf(db), ['0 2026-09-28 2026-10-06 1', '1 2026-10-26 2026-11-04 0']);
  // New usual days: the statements already known keep their dates, the next ones follow the new days.
  await saveCreditCard(db, edit(card, 3, '2026-10-03', { closingDay: 15, dueDay: 25 }), {}, '2026-10-03');
  assert.deepEqual(await rowsOf(db), ['0 2026-09-28 2026-10-06 1', '1 2026-10-26 2026-11-04 0']);
  assert.deepEqual(await viewOn(db, '2026-10-03'), { open: '2026-10-26', openDue: '2026-11-04', previous: '2026-09-28', nextDue: '2026-10-06', toPay: '2026-09-28' });
  assert.deepEqual(await viewOn(db, '2026-10-27'), { open: '2026-11-15', openDue: '2026-11-25', previous: '2026-10-26', nextDue: '2026-11-04', toPay: '2026-10-26' });
  // Weeks later, new days again: the statement that closed on 15 nov and the open one are frozen (the gap too), nothing
  // closed moves, and the new days apply after the open statement.
  await saveCreditCard(db, edit(card, 4, '2026-12-01', { closingDay: 20, dueDay: 30 }), {}, '2026-12-01');
  assert.deepEqual(await rowsOf(db), ['0 2026-09-28 2026-10-06 1', '1 2026-10-26 2026-11-04 0', '2 2026-11-15 2026-11-25 0', '3 2026-12-15 2026-12-25 0']);
  assert.deepEqual(await viewOn(db, '2026-12-01'), { open: '2026-12-15', openDue: '2026-12-25', previous: '2026-11-15', nextDue: '2026-12-25', toPay: null });
  assert.deepEqual(await viewOn(db, '2026-12-16'), { open: '2027-01-20', openDue: '2027-01-30', previous: '2026-12-15', nextDue: '2026-12-25', toPay: '2026-12-15' });
});

test('a card without exact dates keeps working exactly as before: an archive and a reactivation write no date; a days change freezes the statement still to pay and the open one', async () => {
  const { db } = await seeded();
  await saveCreditCard(db, edit(card, 1, '2026-10-01', { active: false }), {}, '2026-10-01');
  await saveCreditCard(db, edit(card, 2, '2026-10-01', { active: true, issuer: 'Otro banco' }), {}, '2026-10-01');
  assert.equal((await readArchive(db)).cardCycleDates, undefined);
  await saveCreditCard(db, edit(card, 3, '2026-10-02', { closingDay: 15, dueDay: 25, issuer: 'Otro banco' }), {}, '2026-10-02');
  assert.deepEqual(await rowsOf(db), ['0 2026-09-28 2026-10-05 0', '1 2026-10-28 2026-11-05 0']);
  assert.deepEqual(await viewOn(db, '2026-10-02'), { open: '2026-10-28', openDue: '2026-11-05', previous: '2026-09-28', nextDue: '2026-10-05', toPay: '2026-09-28' });
  assert.deepEqual(await viewOn(db, '2026-10-29'), { open: '2026-11-15', openDue: '2026-11-25', previous: '2026-10-28', nextDue: '2026-11-05', toPay: '2026-10-28' });
});

test('a plan created after exact dates uses them; one created before keeps its contractual schedule; recognition follows each stored schedule; a restart reads everything back', async () => {
  const { db, path } = await seeded();
  const before = newInstallmentPlan({ id: 'before', card, cardAccount, merchant: 'Electro', category: 'Hogar', purchaseDateISO: '2026-10-10', principalMinor: 3000, count: 3, placement: 'current', createdAt });
  await createInstallmentPlan(db, before);
  await saveCreditCard(db, edit(card, 1, '2026-10-11'), { open: { statementClosingISO: '2026-10-28', closingISO: '2026-10-26', dueISO: '2026-11-04' } }, '2026-10-11');
  const archive = await readArchive(db);
  const after = newInstallmentPlan({ id: 'after', card: archive.cards![0], cardAccount, merchant: 'Notebook', category: 'Tecnología', purchaseDateISO: '2026-10-10', principalMinor: 3000,
    count: 3, placement: 'current', createdAt: at('2026-10-11'), cycleDates: archive.cardCycleDates });
  await createInstallmentPlan(db, after);
  const plans = (await readArchive(db)).installmentPlans!;
  assert.deepEqual(plans.find(plan => plan.id === 'before')!.schedule.map(row => row.billingDateISO), ['2026-10-28', '2026-11-28', '2026-12-28'], 'written once, never realigned');
  assert.deepEqual(plans.find(plan => plan.id === 'after')!.schedule.map(row => [row.billingDateISO, row.dueDateISO].join('/')),
    ['2026-10-26/2026-11-04', '2026-11-28/2026-12-05', '2026-12-28/2027-01-05']);
  // A purchase form opened before the change (its plan built on the old calendar) is refused, never billed on dates the card no longer has.
  const stale = newInstallmentPlan({ id: 'stale', card, cardAccount, merchant: 'Heladera', category: 'Hogar', purchaseDateISO: '2026-10-10', principalMinor: 3000, count: 3, placement: 'current', createdAt: at('2026-10-11') });
  await assert.rejects(createInstallmentPlan(db, stale), new RegExp(PLAN_CALENDAR_MESSAGE));
  await createInstallmentPlan(db, after); // A retry of the committed plan is still a no-op.
  assert.equal(await catchUpInstallments(db, '2026-10-27'), 1, 'the exact closing already passed: that instalment only');
  const recorded = (await readArchive(db)).records.map(record => record.entry.id).filter(id => id.startsWith('inst')).sort();
  assert.deepEqual(recorded, ['inst_after_001']);
  await db.closeAsync();
  const reopened = databaseAt(path);
  await initializeDatabase(reopened);
  assert.deepEqual(await rowsOf(reopened), ['0 2026-09-28 2026-10-05 0', '1 2026-10-26 2026-11-04 0']);
  // Deleting the card (no balance and no pending plan is required; here it is refused) never touches its dates.
  await assert.rejects(deleteCreditCard(reopened, card.id, at('2026-10-27')), /cuotas pendientes|saldo pendiente/);
  assert.deepEqual(await rowsOf(reopened), ['0 2026-09-28 2026-10-05 0', '1 2026-10-26 2026-11-04 0']);
});

test('backup v13: written as soon as a card has exact dates, restored with its card into a fresh device, identical twice, refused when it contradicts the local calendar, and refused by an older build', async () => {
  const { db } = await seeded();
  const plainBackup = createRecoveryBackup(await readArchive(db), new Date(at('2026-10-01')));
  assert.equal(plainBackup.schema, 'finanzapp.native-pilot.v8', 'without an exact date nothing changes');
  await createEntry(db, { id: 'p1', accountId: cardAccount.id, kind: 'expense', amountMinor: 2310, merchant: 'Café', category: 'Comida', dateISO: '2026-09-30', createdAt } satisfies Entry);
  await saveCreditCard(db, edit(card, 1, '2026-10-01'), { open: { statementClosingISO: '2026-10-28', closingISO: '2026-10-26', dueISO: '2026-11-04' } }, '2026-10-01');
  const source = await readArchive(db);
  const backup = createRecoveryBackup(source, new Date(at('2026-10-01')));
  assert.equal(backup.schema, 'finanzapp.native-pilot.v13');
  assert.deepEqual(backup.installmentPlans, [], 'a v13 file always names its plans');
  assert.equal(backup.cardCycleDates!.length, 2);
  const fresh = setup().db;
  await initializeDatabase(fresh);
  const parsed = parsePilotBackup(JSON.stringify(backup));
  const preview = previewBackupImport(await readArchive(fresh), parsed.archive);
  assert.deepEqual([preview.cards.length, preview.cardCycleDates.length, preview.conflicts], [1, 2, 0]);
  await importArchive(fresh, parsed.archive, preview.baseline);
  assert.deepEqual((await readArchive(fresh)).cardCycleDates, source.cardCycleDates);
  assert.deepEqual(await viewOn(fresh, '2026-10-01'), await viewOn(db, '2026-10-01'));
  const again = previewBackupImport(await readArchive(fresh), parsed.archive);
  assert.deepEqual([again.cardCycleDates.length, again.conflicts], [0, 0]);
  await importArchive(fresh, parsed.archive, again.baseline);
  // A copy whose calendar says otherwise for a card already here contradicts local data: nothing is imported.
  const contradicting = { ...parsed.archive, cardCycleDates: parsed.archive.cardCycleDates!.map((row: CardCycleDates) => row.sequence === 1 ? { ...row, dueISO: '2026-11-06' } : row) };
  const refused = previewBackupImport(await readArchive(fresh), contradicting);
  assert.equal(refused.conflicts, 1);
  await assert.rejects(importArchive(fresh, contradicting, refused.baseline), /contradice cambios locales/);
  // The refusal contract of older builds: read as v12 the extra key refuses the file; a v14 file is refused by name.
  assert.throws(() => parsePilotBackup(JSON.stringify({ ...backup, schema: 'finanzapp.native-pilot.v12' })), /campos faltantes/);
  assert.throws(() => parsePilotBackup(JSON.stringify({ ...backup, schema: 'finanzapp.native-pilot.v14' })), /versiones 1 a 13/);
  // A v12-or-older copy still restores into schema 13; its cards follow their usual days.
  const older = setup().db;
  await initializeDatabase(older);
  const oldArchive = parsePilotBackup(JSON.stringify(plainBackup)).archive;
  await importArchive(older, oldArchive, previewBackupImport(await readArchive(older), oldArchive).baseline);
  assert.equal((await readArchive(older)).cardCycleDates, undefined);
});

test('storage plans the change itself: a card saved with other days never skips the freeze, and a row that closed is never rewritten', async () => {
  const { db } = await seeded();
  await saveCreditCard(db, edit(card, 1, '2026-10-01'), { open: { statementClosingISO: '2026-10-28', closingISO: '2026-10-26', dueISO: '2026-11-04' } }, '2026-10-01');
  // On 2026-11-01 the 26 oct statement closed: asking for it as the open statement is stale, and it cannot move.
  await assert.rejects(saveCreditCard(db, edit(card, 2, '2026-11-01'), { open: { statementClosingISO: '2026-10-26', closingISO: '2026-10-25', dueISO: '2026-11-04' } }, '2026-11-01'),
    new RegExp(CYCLE_STALE_MESSAGE));
  await assert.rejects(saveCreditCard(db, edit(card, 2, '2026-11-10'), { toPay: { statementClosingISO: '2026-10-26', dueISO: '2026-11-12' } }, '2026-11-10'),
    new RegExp(CYCLE_STALE_MESSAGE), 'its due passed: nothing left to correct');
  assert.deepEqual(await rowsOf(db), ['0 2026-09-28 2026-10-05 0', '1 2026-10-26 2026-11-04 0']);
  void CYCLE_HISTORY_MESSAGE;
});

test('review round: a calendar change never succeeds silently: an unchanged card with a change it does not show is refused; a committed one retries as a no-op', async () => {
  const { db } = await seeded();
  await assert.rejects(saveCreditCard(db, card, { open: { statementClosingISO: '2026-10-28', closingISO: '2026-10-26', dueISO: '2026-11-04' } }, '2026-10-01'), /cambió desde que la abriste/);
  assert.equal((await readArchive(db)).cardCycleDates, undefined, 'nothing written');
  const moved = edit(card, 1, '2026-10-01');
  const intent = { open: { statementClosingISO: '2026-10-28', closingISO: '2026-10-26', dueISO: '2026-11-04' } };
  await saveCreditCard(db, moved, intent, '2026-10-01');
  await saveCreditCard(db, moved, intent, '2026-10-02'); // The retry after a failed refresh, even the next day.
  assert.deepEqual(await rowsOf(db), ['0 2026-09-28 2026-10-05 0', '1 2026-10-26 2026-11-04 0']);
});

test('review round: after new usual days the history before the chain keeps its calendar: no phantom statement to pay', async () => {
  const { db } = setup();
  await initializeDatabase(db);
  await createAccount(db, bank);
  await createCreditCard(db, cardAccount, { ...card, closingDay: 1, dueDay: 8 });
  await saveCreditCard(db, edit({ ...card, closingDay: 1, dueDay: 8 }, 1, '2026-10-02', { closingDay: 13, dueDay: 2 }), {}, '2026-10-02');
  assert.deepEqual(await rowsOf(db), ['0 2026-10-01 2026-10-08 0', '1 2026-11-01 2026-11-08 0']);
  const archive = await readArchive(db);
  assert.deepEqual(archive.cardCycleDates!.map(row => [row.closingDay, row.dueDay, row.monthISO]), [[1, 8, '2026-10'], [1, 8, '2026-11']],
    'the frozen statements record the calendar and the slot they belong to');
  assert.deepEqual(await viewOn(db, '2026-10-02'), { open: '2026-11-01', openDue: '2026-11-08', previous: '2026-10-01', nextDue: '2026-10-08', toPay: '2026-10-01' });
});

test('review round 2: an open statement moved into new usual days and then moved back keeps every month; the corrected row stores its new days and slot', async () => {
  const { db } = setup();
  await initializeDatabase(db);
  await createAccount(db, bank);
  const fifth: CreditCardProfile = { ...card, closingDay: 5, dueDay: 15 };
  await createCreditCard(db, cardAccount, fifth);
  // On 6 oct the open statement (5 nov) closes on 28 nov instead, and the person makes 28/5 the usual days.
  await saveCreditCard(db, edit(fifth, 1, '2026-10-06', { closingDay: 28, dueDay: 5 }),
    { open: { statementClosingISO: '2026-11-05', closingISO: '2026-11-28', dueISO: '2026-12-05' } }, '2026-10-06');
  assert.deepEqual(await viewOn(db, '2026-10-06'), { open: '2026-11-28', openDue: '2026-12-05', previous: '2026-10-05', nextDue: '2026-10-15', toPay: '2026-10-05' });
  // On 10 oct that same statement is corrected to 28 oct (the usual days stay 28/5): November keeps its statement.
  await saveCreditCard(db, edit(fifth, 2, '2026-10-10', { closingDay: 28, dueDay: 5 }),
    { open: { statementClosingISO: '2026-11-28', closingISO: '2026-10-28', dueISO: '2026-11-05' } }, '2026-10-10');
  const archive = await readArchive(db);
  assert.deepEqual(archive.cardCycleDates!.map(row => [row.sequence, row.closingISO, row.dueISO, row.closingDay, row.dueDay, row.monthISO, row.revision]),
    [[0, '2026-10-05', '2026-10-15', 5, 15, '2026-10', 0], [1, '2026-10-28', '2026-11-05', 28, 5, '2026-10', 1]]);
  assert.deepEqual(await viewOn(db, '2026-10-29'), { open: '2026-11-28', openDue: '2026-12-05', previous: '2026-10-28', nextDue: '2026-11-05', toPay: '2026-10-28' });
});

test('24T2 review: a recorded instalment keeps its link to its plan («Cuota 1 de 3», the plan detail) after a restart and after a backup restored on another device', async () => {
  const { installmentOfEntry } = await import('../src/ui/installment-presentation.ts');
  const { db, path } = await seeded();
  await saveCreditCard(db, edit(card, 1, '2026-10-01'), { open: { statementClosingISO: '2026-10-28', closingISO: '2026-10-26', dueISO: '2026-11-04' } }, '2026-10-01');
  const stored = await readArchive(db);
  const plan = newInstallmentPlan({ id: 'tv', card: stored.cards![0], cardAccount, merchant: 'Electro', category: 'Hogar', purchaseDateISO: '2026-10-10', principalMinor: 3000,
    count: 3, placement: 'current', interestMinor: 300, interestCategory: 'Intereses', createdAt: at('2026-10-11'), cycleDates: stored.cardCycleDates });
  await createInstallmentPlan(db, plan);
  assert.equal(await catchUpInstallments(db, '2026-10-27'), 2, 'the first instalment: its principal and its interest');
  const link = (archive: Awaited<ReturnType<typeof readArchive>>, id: string) => {
    const found = installmentOfEntry(id, archive.installmentPlans);
    return found ? [found.plan.id, found.number, found.count, found.component, found.shared, found.plan.schedule[0].billingDateISO] : null;
  };
  const expected = { principal: ['tv', 1, 3, 'principal', true, '2026-10-26'], interest: ['tv', 1, 3, 'interest', true, '2026-10-26'] };
  assert.deepEqual([link(await readArchive(db), 'inst_tv_001'), link(await readArchive(db), 'insti_tv_001')], [expected.principal, expected.interest]);
  // A restart: the same file opened again.
  await db.closeAsync();
  const reopened = databaseAt(path);
  await initializeDatabase(reopened);
  const afterRestart = await readArchive(reopened);
  assert.deepEqual([link(afterRestart, 'inst_tv_001'), link(afterRestart, 'insti_tv_001')], [expected.principal, expected.interest]);
  // A backup (v13: the card's exact dates and the plan travel together), restored on a fresh device.
  const backup = createRecoveryBackup(afterRestart, new Date(at('2026-10-27')));
  assert.equal(backup.schema, 'finanzapp.native-pilot.v13');
  const fresh = setup().db;
  await initializeDatabase(fresh);
  const parsed = parsePilotBackup(JSON.stringify(backup));
  await importArchive(fresh, parsed.archive, previewBackupImport(await readArchive(fresh), parsed.archive).baseline);
  const restored = await readArchive(fresh);
  assert.deepEqual([link(restored, 'inst_tv_001'), link(restored, 'insti_tv_001')], [expected.principal, expected.interest]);
  assert.equal(await catchUpInstallments(fresh, '2026-10-27'), 0, 'nothing recorded twice after the restore');
  assert.deepEqual(restored.installmentPlans, afterRestart.installmentPlans);
  // 24T2: the latent Intereses category is listed on the restored device as on the original: its movement and its plan need it.
  const listed = (archive: Awaited<ReturnType<typeof readArchive>>) => categoryCatalog('expense', archive.categories ?? [], snapshotFromArchive(archive).entries,
    planFinancingCategories(archive.installmentPlans)).map(row => row.identity.label);
  assert.ok(listed(afterRestart).includes('Intereses'));
  assert.ok(listed(restored).includes('Intereses'));
});

test('24T2 owner decision: a ledger whose plans carry no interest never lists Intereses, before or after a backup restored on a fresh device', async () => {
  const listed = (archive: Awaited<ReturnType<typeof readArchive>>) => categoryCatalog('expense', archive.categories ?? [], snapshotFromArchive(archive).entries,
    planFinancingCategories(archive.installmentPlans)).map(row => row.identity.label);
  const { db } = await seeded();
  assert.equal(listed(await readArchive(db)).includes('Intereses'), false, 'a brand-new ledger');
  await createInstallmentPlan(db, newInstallmentPlan({ id: 'plain', card, cardAccount, merchant: 'Electro', category: 'Hogar', purchaseDateISO: '2026-09-10',
    principalMinor: 3000, count: 3, placement: 'current', createdAt }));
  await catchUpInstallments(db, '2026-10-27');
  const source = await readArchive(db);
  assert.equal(listed(source).includes('Intereses'), false, 'a plan without interest');
  const fresh = setup().db;
  await initializeDatabase(fresh);
  const parsed = parsePilotBackup(JSON.stringify(createRecoveryBackup(source, new Date(at('2026-10-27')))));
  await importArchive(fresh, parsed.archive, previewBackupImport(await readArchive(fresh), parsed.archive).baseline);
  assert.equal(listed(await readArchive(fresh)).includes('Intereses'), false, 'restored');
});
