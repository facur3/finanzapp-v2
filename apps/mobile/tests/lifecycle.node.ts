import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ACCOUNT_DELETED_MESSAGE, CARD_DEBT_MESSAGE, CARD_DELETED_MESSAGE, CARD_DELETE_PATH_MESSAGE, OBLIGATION_ACCOUNT_MESSAGE, accountBalanceMinor, cardDebtMinor, createRecoveryBackup,
  deleteCreditCard as cardTombstone, liquidTotalsByCurrency, makeEntryChange, parsePilotBackup, previewBackupImport, spendingReport, type Account, type CreditCardProfile, type Entry, type RecurringRule, type Transfer } from '@finanzapp/domain';
import { DATABASE_VERSION, SCHEMA_SCRIPTS, changeEntry, createAccount, createCreditCard, createEntry, createTransfer, deleteAccount, deleteCreditCard, importArchive, initializeDatabase, readArchive, readSnapshot,
  saveCreditCard, saveRecurringRule, processRecurring, type LedgerDatabase } from '../src/storage/database.ts';
import { availableCurrencies, historyCurrencies } from '../src/ui/presentation.ts';
import { reportSelection } from '../src/ui/report-presentation.ts';
import { financeView } from '../src/fx/finance-view.ts';
import { rateBook } from '@finanzapp/domain';
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

const cardRule: RecurringRule = { ...rule, id: 'card-rule', accountId: 'card-account', merchant: 'Streaming', amountMinor: 1200, anchorDateISO: '2026-09-20', nextDateISO: '2026-10-20' };

async function seeded() {
  const { db, path } = setup();
  await initializeDatabase(db);
  await createAccount(db, cash); await createAccount(db, bank); await createCreditCard(db, cardAccount, card);
  await createEntry(db, expense('e1', 'cash', 1500, '2026-09-05'));
  await createEntry(db, expense('e2', 'card-account', 20000, '2026-09-10'));
  await createTransfer(db, transfer('t1', 'cash', 'bank', 5000, '2026-09-11'));
  await createTransfer(db, transfer('t2', 'bank', 'card-account', 20000, '2026-09-12'));
  await saveRecurringRule(db, rule);
  await saveRecurringRule(db, cardRule);
  return { db, path };
}
const ruleOf = async (db: LedgerDatabase, id: string) => (await readArchive(db)).recurring!.find(item => item.id === id)!;

test('schema 11 is reached from a real schema 10 file by an additive migration: every row keeps its values, live rows read as before', async () => {
  const { db } = setup();
  for (const script of SCHEMA_SCRIPTS.slice(0, 10)) await db.execAsync(script);
  await db.execAsync(`INSERT INTO accounts (id, name, currency, openingMinor, createdAt, revision, updatedAt) VALUES ('a', 'Antigua', 'ARS', 100, '${createdAt}', 0, '${createdAt}');
    INSERT INTO accounts (id, name, currency, openingMinor, createdAt, revision, updatedAt) VALUES ('c', 'Visa', 'ARS', 0, '${createdAt}', 0, '${createdAt}');
    INSERT INTO credit_cards (id, accountId, issuer, last4, creditLimitMinor, closingDay, dueDay, active, createdAt, revision, updatedAt) VALUES ('card', 'c', 'Banco', '4009', NULL, 20, 5, 1, '${createdAt}', 0, '${createdAt}');`);
  assert.equal((await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version, 10);
  await initializeDatabase(db);
  assert.equal((await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version, 12, '24T1: the file continues to schema 12 (two empty instalment tables)');
  assert.equal(DATABASE_VERSION, 12);
  const archive = await readArchive(db);
  assert.deepEqual(archive.accounts[0], { id: 'a', name: 'Antigua', currency: 'ARS', openingMinor: 100, createdAt }, 'a live row reads exactly as it did: no deletedAt key, no revision');
  assert.deepEqual(archive.cards?.[0], { ...card, accountId: 'c' }, 'a card gains deleted: false');
  assert.equal((await db.getFirstAsync<{ n: number }>('SELECT count(*) AS n FROM accounts WHERE deletedAt IS NULL'))?.n, 2);
  // A newer schema is refused, unchanged, as ever.
  await db.execAsync('PRAGMA user_version = 13');
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
  assert.equal(await processRecurring(db, '2026-12-31', now), 3, 'the card rule alone (October to December): nothing more on the deleted account');
  assert.equal((await readSnapshot(db)).entries.filter(entry => entry.accountId === 'cash').length, 1);
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
  const gone = cardTombstone(card, now);
  await deleteCreditCard(db, 'card', now);
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
  await assert.rejects(saveCreditCard(db, { ...gone, issuer: 'Otro', revision: 2, updatedAt: now }), new RegExp(CARD_DELETED_MESSAGE), 'never edited');
  await saveCreditCard(db, gone); // A retry of the same record is silent.
  await deleteCreditCard(db, 'card', '2026-09-28T10:00:00.000Z'); // Deleting again (a retry after a failed refresh) is silent too.
  assert.equal((await readArchive(db)).cards?.[0].revision, 1);
  await assert.rejects(deleteCreditCard(db, 'nope', now), /No encontramos esta tarjeta/);
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

// ---- 25B2 review ---------------------------------------------------------------------------------------------

test('review 1: deleting a card stops its active rules in the same commit; a restart and a return to the foreground record nothing on it; a plain save never deletes', async () => {
  const { db, path } = await seeded();
  assert.equal((await ruleOf(db, 'card-rule')).active, true);
  await deleteCreditCard(db, 'card', now);
  const stopped = await ruleOf(db, 'card-rule');
  assert.deepEqual([stopped.active, stopped.deleted, stopped.revision, stopped.updatedAt], [false, false, 1, now], 'paused in the same commit, not deleted');
  assert.equal((await ruleOf(db, 'rule')).active, true, 'the cash rule is untouched');
  // A restart: the catch-up on opening; then the foreground catch-up; then a run far into the future. Only the cash rule records.
  await db.closeAsync();
  const reopened = databaseAt(path);
  await initializeDatabase(reopened);
  assert.equal(await processRecurring(reopened, '2026-10-25', now), 1, 'the cash rule of the 15th, nothing on the card');
  assert.equal(await processRecurring(reopened, '2026-10-25', now), 0, 'foreground: nothing more');
  const snapshot = await readSnapshot(reopened);
  assert.deepEqual(snapshot.entries.filter(entry => entry.accountId === 'card-account').map(entry => entry.id), ['e2'], 'the card keeps its previous purchase only');
  assert.equal((await ruleOf(reopened, 'card-rule')).nextDateISO, '2026-10-20', 'the paused rule keeps its place');
  // Nothing revives it: resuming is refused; a save that flips `deleted` is refused (the deletion has its own path).
  await assert.rejects(saveRecurringRule(reopened, { ...stopped, active: true, revision: 2, updatedAt: now }), new RegExp(CARD_DELETED_MESSAGE));
  await createCreditCard(reopened, { ...cardAccount, id: 'card-account-2', name: 'Master' }, { ...card, id: 'card-2', accountId: 'card-account-2', last4: '0002' });
  await assert.rejects(saveCreditCard(reopened, { ...card, id: 'card-2', accountId: 'card-account-2', last4: '0002', deleted: true, active: false, revision: 1, updatedAt: now }), new RegExp(CARD_DELETE_PATH_MESSAGE));
  assert.equal((await readArchive(reopened)).cards?.find(item => item.id === 'card-2')?.deleted, false);
  // The second net: a rule an older copy left active on a deleted card (the row forced by hand here) still records nothing.
  await reopened.withExclusiveTransactionAsync(async tx => { await tx.runAsync('UPDATE recurring_rules SET active = 1 WHERE id = ?', 'card-rule'); });
  assert.equal((await ruleOf(reopened, 'card-rule')).active, true);
  assert.equal(await processRecurring(reopened, '2026-12-31', now), 2, 'the cash rule for November and December only');
  assert.deepEqual((await readSnapshot(reopened)).entries.filter(entry => entry.accountId === 'card-account').map(entry => entry.id), ['e2']);
});

test('review 4: a card with a recorded debt is not deleted, and nothing changes; once paid, it is', async () => {
  const { db } = await seeded();
  await createEntry(db, expense('e3', 'card-account', 3000, '2026-09-20'));
  assert.equal(cardDebtMinor(card, await readSnapshot(db)), 3000);
  await assert.rejects(deleteCreditCard(db, 'card', now), new RegExp(CARD_DEBT_MESSAGE));
  const archive = await readArchive(db);
  assert.deepEqual([archive.cards?.[0].deleted, archive.cards?.[0].active, archive.cards?.[0].revision], [false, true, 0], 'the card stays live');
  assert.equal((await ruleOf(db, 'card-rule')).active, true, 'its rules keep running');
  // Archiving is the alternative: the card leaves Tarjetas, keeps the debt, still takes the payment, and comes back if wanted.
  await saveCreditCard(db, { ...card, active: false, revision: 1, updatedAt: now });
  await createTransfer(db, transfer('t3', 'bank', 'card-account', 3000, '2026-09-27'));
  assert.equal(cardDebtMinor({ ...card, active: false }, await readSnapshot(db)), 0);
  await deleteCreditCard(db, 'card', now);
  assert.deepEqual([(await readArchive(db)).cards?.[0].deleted, (await ruleOf(db, 'card-rule')).active], [true, false]);
});

test('review 3: a movement on a deleted account is corrected in place (amount, merchant, date) and can move to a live account, never onto a deleted row', async () => {
  const { db } = await seeded();
  await deleteAccount(db, 'cash', now);
  const stored = (await readArchive(db)).records.find(record => record.entry.id === 'e1')!;
  const corrected = { ...stored.entry, amountMinor: 1800, merchant: 'Kiosco de la esquina', dateISO: '2026-09-04' };
  await changeEntry(db, makeEntryChange('op-1', stored, 'edit', now, corrected));
  const after = (await readSnapshot(db)).entries.find(entry => entry.id === 'e1')!;
  assert.deepEqual([after.accountId, after.amountMinor, after.merchant, after.dateISO], ['cash', 1800, 'Kiosco de la esquina', '2026-09-04'], 'same account and currency, corrected values');
  const snapshot = await readSnapshot(db);
  assert.equal(accountBalanceMinor(snapshot.accounts.find(item => item.id === 'cash')!, snapshot.entries, snapshot.transfers), 100000 - 1800 - 5000);
  // Moving the corrected movement onto the live bank is allowed; moving one from the bank onto the deleted account is not.
  const again = (await readArchive(db)).records.find(record => record.entry.id === 'e1')!;
  await changeEntry(db, makeEntryChange('op-2', again, 'edit', now, { ...again.entry, accountId: 'bank' }));
  const moved = (await readArchive(db)).records.find(record => record.entry.id === 'e1')!;
  await assert.rejects(changeEntry(db, makeEntryChange('op-3', moved, 'edit', now, { ...moved.entry, accountId: 'cash' })), new RegExp(ACCOUNT_DELETED_MESSAGE));
  assert.equal((await readSnapshot(db)).entries.find(entry => entry.id === 'e1')!.accountId, 'bank');
});

test('review 2: deleting the last account of a currency keeps that currency in the history (Inicio, Reportes, filters, previous months, missing rates), not in Disponible or the forms', async () => {
  const { db } = await seeded();
  const usd: Account = { id: 'usd', name: 'Dólares', currency: 'USD', openingMinor: 50000, createdAt };
  await createAccount(db, usd);
  await createEntry(db, expense('u1', 'usd', 1000, '2026-08-20'));
  await createEntry(db, expense('u2', 'usd', 2000, '2026-09-15'));
  await deleteAccount(db, 'usd', now);
  const snapshot = await readSnapshot(db);
  assert.deepEqual(availableCurrencies(snapshot.accounts), ['ARS'], 'the forms, Disponible and the default rule: ARS alone');
  assert.deepEqual(historyCurrencies(snapshot.accounts), ['ARS', 'USD'], 'the view and its chip: both, because the history holds both');
  assert.deepEqual(liquidTotalsByCurrency(snapshot, (await readArchive(db)).cards), { ARS: 100000 - 1500 - 5000 + 50000 + 5000 - 20000 }, 'Disponible has no USD line');
  // Reportes: "Solo USD" for September and for the previous month still reads the deleted account's movements.
  assert.deepEqual(reportSelection(snapshot, 'USD', '2026-09', '2026-09-27').currencies, ['ARS', 'USD']);
  const september = spendingReport(snapshot, 'USD', '2026-09', '2026-09-27');
  assert.equal(september.status === 'ready' && september.expenseMinor, 2000);
  const august = spendingReport(snapshot, 'USD', '2026-08', '2026-09-27');
  assert.equal(august.status === 'ready' && august.expenseMinor, 1000);
  assert.equal(reportSelection(snapshot, 'USD', undefined, '2026-09-27').earliestMonth, '2026-08', 'navigation reaches the previous month');
  // Inicio consolidated in ARS: the USD expense converts at its own date; without that day's rate the total is not partial.
  const book = rateBook([{ base: 'USD', quote: 'ARS', rate: '1000', effectiveDate: '2026-09-15', source: 'Frankfurter', fetchedAt: now }]);
  const consolidated = financeView(snapshot, 'consolidated', 'ARS', book);
  const total = spendingReport(consolidated.snapshot, 'ARS', '2026-09', '2026-09-27');
  assert.equal(total.status === 'ready' && total.expenseMinor, 1500 + 20000 + 2000 * 1000, 'ARS 15,00 + 200,00 + USD 20,00 at 1000');
  assert.equal(consolidated.complete('2026-09-01', '2026-09-30', 'expense'), true);
  const withoutRate = financeView(snapshot, 'consolidated', 'ARS', rateBook([]));
  assert.equal(withoutRate.complete('2026-09-01', '2026-09-30', 'expense'), false, 'no rate: the screen shows per-currency parts, never a partial sum');
  assert.equal(withoutRate.quotes.length > 0, true, 'and still asks the provider for the deleted account\'s currency');
});
