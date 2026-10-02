import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { REVIEW_DRAFT_INVALID_MESSAGE, REVIEW_INCOMPLETE_MESSAGE, REVIEW_STALE_MESSAGE, WRITE_ID_TAKEN_MESSAGE, makeAccountChange, makeEntryChange, newInstallmentPlan, reviewBasis,
  snapshotFromArchive,
  type Account, type CreditCardProfile, type Entry, type ReviewArchive, type ReviewDraft, type Transfer } from '@finanzapp/domain';
import { createAccount, createCreditCard, createEntry, createInstallmentPlan, createTransfer, changeAccount, changeEntry, initializeDatabase, readArchive,
  cancelInstallmentPlan, type LedgerDatabase, type SqlExecutor } from '../src/storage/database.ts';
import { REVIEW_CAPTURE_CONFLICT_MESSAGE, REVIEW_DATABASE_VERSION, REVIEW_INPUT_MESSAGE, REVIEW_ITEM_CHANGED_MESSAGE, REVIEW_ITEM_CLOSED_MESSAGE, REVIEW_ITEM_MISSING_MESSAGE,
  REVIEW_ITEM_UNREADABLE_MESSAGE, REVIEW_READ_ONLY_MESSAGE, REVIEW_WRITE_CONFLICT_MESSAGE, initializeReviewDatabase, openReviewStore,
  type ReviewDatabase, type ReviewStore } from '../src/storage/review-database.ts';
import { runExclusiveTransaction, runSchemaMigration, type TransactionConnection } from '../src/storage/transaction.ts';

// Producto 25A-02 on real SQLite: the review store is its own file; every transition, capture key, frozen write id,
// interrupted confirmation and corrupt row; and the ledger's new rule that one id is one kind of write. Synthetic records
// in disposable databases only.
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
function opened(path: string) {
  const base = connection(path);
  let closed = false;
  const closeAsync = async () => { if (!closed) { closed = true; await base.closeAsync(); } };
  cleanups.push(closeAsync);
  return { ...base, closeAsync };
}
function ledgerAt(path: string): LedgerDatabase & { closeAsync(): Promise<void> } {
  return { ...opened(path), withExclusiveTransactionAsync: work => runExclusiveTransaction(async () => connection(path), work),
    withMigrationTransactionAsync: work => runSchemaMigration(async () => connection(path), work) };
}
function reviewAt(path: string): ReviewDatabase & { closeAsync(): Promise<void> } {
  return { ...opened(path), withExclusiveTransactionAsync: work => runExclusiveTransaction(async () => connection(path), work) };
}
function directory() {
  const dir = mkdtempSync(join(tmpdir(), 'finanzapp-review-'));
  cleanups.push(async () => { rmSync(dir, { recursive: true, force: true }); });
  return { ledgerPath: join(dir, 'ledger.sqlite'), reviewPath: join(dir, 'review.sqlite') };
}

const createdAt = '2026-09-01T12:00:00.000Z';
const now = '2026-09-28T10:00:00.000Z';
const later = '2026-09-28T10:05:00.000Z';
const today = '2026-09-28';
const bank: Account = { id: 'bank', name: 'Banco', currency: 'ARS', openingMinor: 500000, createdAt };
const savings: Account = { id: 'savings', name: 'Ahorro', currency: 'ARS', openingMinor: 0, createdAt };
const cardAccount: Account = { id: 'visa-acc', name: 'Visa', currency: 'ARS', openingMinor: 0, createdAt };
const card: CreditCardProfile = { id: 'visa', accountId: cardAccount.id, issuer: 'Banco', last4: '4009', creditLimitMinor: 1000000, closingDay: 20, dueDay: 5,
  active: true, deleted: false, createdAt, revision: 0, updatedAt: createdAt };

async function ledgerWithCard(path: string) {
  const ledger = ledgerAt(path);
  await initializeDatabase(ledger);
  await createAccount(ledger, bank);
  await createAccount(ledger, savings);
  await createCreditCard(ledger, cardAccount, card);
  return ledger;
}
async function setup() {
  const { ledgerPath, reviewPath } = directory();
  const ledger = await ledgerWithCard(ledgerPath);
  const db = reviewAt(reviewPath);
  const store = await openReviewStore(db, ledger);
  return { ledger, db, store, ledgerPath, reviewPath };
}
/** A draft reviewed against the ledger as it is now. */
async function drafted(ledger: LedgerDatabase, change: Partial<ReviewDraft> = {}): Promise<ReviewDraft> {
  const base: ReviewDraft = { version: 1, source: 'assistant', capturedAt: now, kind: 'expense', amountMinor: 1500000, currency: 'ARS', merchant: 'Coto',
    category: 'Supermercado', dateISO: '2026-09-27', destinationId: bank.id, purchase: null, basis: [], ...change };
  return { ...base, basis: reviewBasis(base, await readArchive(ledger) as ReviewArchive) };
}
const capture = (store: ReviewStore, draft: unknown, id = 'item-1', writeId = 'write-1', captureKey: string | null = null) =>
  store.capture({ id, writeId, captureKey, draft, at: now });
const ledgerRows = async (ledger: LedgerDatabase) => {
  const archive = await readArchive(ledger);
  return { entries: archive.records.map(record => record.entry.id).sort(), plans: (archive.installmentPlans ?? []).map(plan => plan.id).sort(),
    transfers: (archive.transfers ?? []).map(record => record.transfer.id).sort() };
};
/** A connection whose transactions fail on the given call numbers (1-based), as a crash or a full disk would. */
function failing<T extends { withExclusiveTransactionAsync(task: (tx: SqlExecutor) => Promise<void>): Promise<void> }>(db: T, fail: (call: number) => boolean): T {
  let calls = 0;
  return { ...db, withExclusiveTransactionAsync: (task: (tx: SqlExecutor) => Promise<void>) => {
    calls += 1;
    if (fail(calls)) return Promise.reject(new Error('disk I/O error'));
    return db.withExclusiveTransactionAsync(task);
  } };
}

// ---- the file --------------------------------------------------------------------------------------------------------

test('a new review file is created at its own version, apart from the ledger, and opening it again changes nothing', async () => {
  const { ledger, db, store, reviewPath } = await setup();
  assert.equal(store.writable, true);
  assert.equal((await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version, REVIEW_DATABASE_VERSION);
  assert.deepEqual(await store.listPending(), { items: [], unreadable: [] });
  assert.equal(await ledger.getFirstAsync("SELECT name FROM sqlite_master WHERE name = 'review_items'"), null, 'the ledger holds no review table');
  assert.equal((await ledger.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version, 14, 'the ledger stays at schema 14');
  await capture(store, await drafted(ledger));
  await initializeReviewDatabase(db);
  const again = await openReviewStore(reviewAt(reviewPath), ledger);
  assert.equal((await again.listPending()).items.length, 1, 'initializing again keeps every item');
});

test('a review file from a newer build is read and never written', async () => {
  const { ledgerPath, reviewPath } = directory();
  const ledger = await ledgerWithCard(ledgerPath);
  const first = await openReviewStore(reviewAt(reviewPath), ledger);
  await capture(first, await drafted(ledger));
  const raw = new DatabaseSync(reviewPath); raw.exec('PRAGMA user_version = 2'); raw.close();
  const db = reviewAt(reviewPath);
  const store = await openReviewStore(db, ledger);
  assert.equal(store.writable, false);
  assert.equal((await store.get('item-1'))?.status, 'pending', 'still readable');
  await assert.rejects(capture(store, await drafted(ledger), 'item-2', 'write-2'), { message: REVIEW_READ_ONLY_MESSAGE });
  await assert.rejects(store.confirm('item-1', { expectedRevision: 0, todayISO: today, at: later }), { message: REVIEW_READ_ONLY_MESSAGE });
  await assert.rejects(store.dismiss('item-1', 0, later), { message: REVIEW_READ_ONLY_MESSAGE });
  assert.equal((await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version, 2, 'never migrated down');
  assert.deepEqual((await ledgerRows(ledger)).entries, []);
});

test('a corrupt review file never stops, resets or changes the ledger, and is never rewritten', async () => {
  const { ledgerPath, reviewPath } = directory();
  const ledger = await ledgerWithCard(ledgerPath);
  await createEntry(ledger, { id: 'before', accountId: bank.id, kind: 'expense', amountMinor: 100, merchant: 'Feria', category: 'Comida', dateISO: '2026-09-20', createdAt });
  const garbage = Buffer.from('this is not a database '.repeat(400));
  writeFileSync(reviewPath, garbage);
  await assert.rejects(openReviewStore(reviewAt(reviewPath), ledger));
  assert.deepEqual(readFileSync(reviewPath), garbage, 'the review file is left exactly as it was');
  const reopened = ledgerAt(ledgerPath);
  await initializeDatabase(reopened);
  assert.deepEqual((await ledgerRows(reopened)).entries, ['before'], 'the ledger opens and keeps its data');
  await createEntry(reopened, { id: 'after', accountId: bank.id, kind: 'expense', amountMinor: 200, merchant: 'Feria', category: 'Comida', dateISO: '2026-09-21', createdAt });
  assert.deepEqual((await ledgerRows(reopened)).entries, ['after', 'before'], 'and keeps taking writes');
});

// ---- capture, persistence and strict reading ---------------------------------------------------------------------------

test('an item round-trips through a restart: its draft, frozen write id and state', async () => {
  const { ledgerPath, reviewPath } = directory();
  const ledger = await ledgerWithCard(ledgerPath);
  const draft = await drafted(ledger, { source: 'wallet' });
  const { item, duplicate } = await capture(await openReviewStore(reviewAt(reviewPath), ledger), draft, 'item-1', 'write-1', 'wallet:tx-1');
  assert.equal(duplicate, false);
  assert.deepEqual(item, { id: 'item-1', source: 'wallet', captureKey: 'wallet:tx-1', draft, writeId: 'write-1', status: 'pending', attempt: null, receipt: null,
    createdAt: now, updatedAt: now, revision: 0 });
  const reopened = await openReviewStore(reviewAt(reviewPath), ledger);
  assert.deepEqual(await reopened.get('item-1'), item);
  assert.deepEqual(await reopened.listPending(), { items: [item], unreadable: [] });
  assert.equal(await reopened.get('nope'), null);
});

test('capture parses the draft strictly and refuses malformed ids, keys and times, storing nothing', async () => {
  const { ledger, store } = await setup();
  const draft = await drafted(ledger);
  await assert.rejects(capture(store, { ...draft, accountName: 'Banco' }), { message: REVIEW_DRAFT_INVALID_MESSAGE });
  await assert.rejects(capture(store, { ...draft, amountMinor: 1.5 }), { message: REVIEW_DRAFT_INVALID_MESSAGE });
  await assert.rejects(capture(store, { ...draft, currency: 'XAU' }), { message: REVIEW_DRAFT_INVALID_MESSAGE });
  for (const [id, writeId] of [['', 'w'], ['item_1', 'w'], ['i', 'inst_tv_001'], ['i', 'x'.repeat(71)]]) {
    await assert.rejects(capture(store, draft, id, writeId), { message: REVIEW_INPUT_MESSAGE }, `${id} / ${writeId}`);
  }
  await assert.rejects(capture(store, draft, 'i', 'w', ''), { message: REVIEW_INPUT_MESSAGE });
  await assert.rejects(capture(store, draft, 'i', 'w', 'k'.repeat(201)), { message: REVIEW_INPUT_MESSAGE });
  await assert.rejects(store.capture({ id: 'i', writeId: 'w', captureKey: null, draft, at: 'yesterday' }), { message: REVIEW_INPUT_MESSAGE });
  assert.deepEqual(await store.listPending(), { items: [], unreadable: [] });
});

test('a capture key makes a repeated delivery idempotent, refuses the same key with other data, and never merges look-alikes', async () => {
  const { ledger, store } = await setup();
  const draft = await drafted(ledger, { source: 'wallet' });
  const first = await capture(store, draft, 'item-1', 'write-1', 'k-1');
  const repeated = await capture(store, structuredClone(draft), 'item-1', 'write-1', 'k-1');
  assert.equal(repeated.duplicate, true);
  assert.deepEqual(repeated.item, first.item);
  await assert.rejects(capture(store, { ...draft, amountMinor: 1500001 }, 'item-1', 'write-1', 'k-1'), { message: REVIEW_CAPTURE_CONFLICT_MESSAGE });
  await assert.rejects(capture(store, draft, 'item-2', 'write-2', 'k-1'), { message: REVIEW_CAPTURE_CONFLICT_MESSAGE }, 'the key names one item');
  await assert.rejects(capture(store, draft, 'item-1', 'write-9', null), { message: REVIEW_CAPTURE_CONFLICT_MESSAGE }, 'the id names one item');
  await assert.rejects(capture(store, draft, 'item-3', 'write-1', null), { message: REVIEW_CAPTURE_CONFLICT_MESSAGE }, 'a write id belongs to one item');
  // Two real, identical purchases: two keys (or none) are two items. Nothing compares amounts or merchants.
  await capture(store, draft, 'item-4', 'write-4', 'k-2');
  await capture(store, draft, 'item-5', 'write-5', null);
  await capture(store, draft, 'item-6', 'write-6', null);
  assert.deepEqual((await store.listPending()).items.map(item => item.id), ['item-1', 'item-4', 'item-5', 'item-6']);
});

test('a corrupt or unsupported row is set apart: unreadable, never confirmed, never written', async () => {
  const { ledger, db, store } = await setup();
  await capture(store, await drafted(ledger), 'good', 'write-good');
  await capture(store, await drafted(ledger), 'bad', 'write-bad');
  await capture(store, await drafted(ledger), 'odd', 'write-odd');
  await db.runAsync("UPDATE review_items SET draftJSON = ? WHERE id = 'bad'", JSON.stringify({ version: 1, kind: 'expense' }));
  await db.runAsync("UPDATE review_items SET draftVersion = 2 WHERE id = 'odd'");
  const listed = await store.listPending();
  assert.deepEqual(listed.items.map(item => item.id), ['good']);
  assert.deepEqual(listed.unreadable, ['bad', 'odd']);
  await assert.rejects(store.get('bad'), { message: REVIEW_ITEM_UNREADABLE_MESSAGE });
  await assert.rejects(store.confirm('bad', { expectedRevision: 0, todayISO: today, at: later }), { message: REVIEW_ITEM_UNREADABLE_MESSAGE });
  await assert.rejects(store.dismiss('odd', 0, later), { message: REVIEW_ITEM_UNREADABLE_MESSAGE });
  assert.deepEqual((await store.reconcile(later)).unreadable, ['bad', 'odd']);
  assert.deepEqual((await ledgerRows(ledger)).entries, [], 'nothing reached the ledger');
  await db.runAsync("UPDATE review_items SET attemptJSON = ? WHERE id = 'good'", JSON.stringify({ type: 'entry', entry: { id: 'other-id' } }));
  await assert.rejects(store.confirm('good', { expectedRevision: 0, todayISO: today, at: later }), { message: REVIEW_ITEM_UNREADABLE_MESSAGE }, 'a malformed frozen write');
  assert.deepEqual((await ledgerRows(ledger)).entries, []);
});

// ---- transitions -------------------------------------------------------------------------------------------------------

test('pending → confirmed writes exactly one movement under the frozen write id, with a receipt; a confirmed item never reopens', async () => {
  const { ledger, store } = await setup();
  await capture(store, await drafted(ledger));
  const { item, warning, recorded } = await store.confirm('item-1', { expectedRevision: 0, todayISO: today, at: later });
  assert.equal(recorded, true);
  assert.equal(warning, null);
  assert.equal(item.status, 'confirmed');
  assert.deepEqual(item.receipt, { type: 'entry', writeId: 'write-1', how: 'confirmed', at: later });
  assert.deepEqual(item.attempt, { type: 'entry', entry: { id: 'write-1', accountId: bank.id, kind: 'expense', amountMinor: 1500000, merchant: 'Coto',
    category: 'Supermercado', dateISO: '2026-09-27', createdAt: later } });
  assert.deepEqual((await readArchive(ledger)).records.map(record => record.entry), [item.attempt!.type === 'entry' ? item.attempt!.entry : null]);
  assert.deepEqual(await store.get('item-1'), item, 'durable');
  await assert.rejects(store.confirm('item-1', { expectedRevision: item.revision, todayISO: today, at: later }), { message: REVIEW_ITEM_CLOSED_MESSAGE });
  await assert.rejects(store.dismiss('item-1', item.revision, later), { message: REVIEW_ITEM_CLOSED_MESSAGE });
  await assert.rejects(store.updateDraft('item-1', item.revision, await drafted(ledger), later), { message: REVIEW_ITEM_CLOSED_MESSAGE });
  assert.deepEqual((await store.listPending()).items, []);
  assert.deepEqual((await ledgerRows(ledger)).entries, ['write-1'], 'still one movement');
});

test('pending → dismissed writes nothing to the ledger and never reopens', async () => {
  const { ledger, store } = await setup();
  await capture(store, await drafted(ledger));
  const dismissed = await store.dismiss('item-1', 0, later);
  assert.deepEqual([dismissed.status, dismissed.attempt, dismissed.receipt, dismissed.revision], ['dismissed', null, null, 1]);
  await assert.rejects(store.confirm('item-1', { expectedRevision: 1, todayISO: today, at: later }), { message: REVIEW_ITEM_CLOSED_MESSAGE });
  await assert.rejects(store.updateDraft('item-1', 1, await drafted(ledger), later), { message: REVIEW_ITEM_CLOSED_MESSAGE });
  await assert.rejects(store.dismiss('item-1', 1, later), { message: REVIEW_ITEM_CLOSED_MESSAGE });
  assert.equal((await store.get('item-1'))?.status, 'dismissed', 'the row stays as a tombstone');
  assert.deepEqual(await ledgerRows(ledger), { entries: [], plans: [], transfers: [] });
});

test('updating a draft keeps the item and its write id; a stale revision, a missing item and another source are refused', async () => {
  const { ledger, store } = await setup();
  await capture(store, await drafted(ledger, { currency: null }));
  const edited = await store.updateDraft('item-1', 0, await drafted(ledger), later);
  assert.deepEqual([edited.id, edited.writeId, edited.revision, edited.status, edited.draft.currency], ['item-1', 'write-1', 1, 'pending', 'ARS']);
  await assert.rejects(store.updateDraft('item-1', 0, await drafted(ledger), later), { message: REVIEW_ITEM_CHANGED_MESSAGE });
  await assert.rejects(store.dismiss('item-1', 0, later), { message: REVIEW_ITEM_CHANGED_MESSAGE });
  await assert.rejects(store.confirm('item-1', { expectedRevision: 0, todayISO: today, at: later }), { message: REVIEW_ITEM_CHANGED_MESSAGE });
  await assert.rejects(store.updateDraft('missing', 0, await drafted(ledger), later), { message: REVIEW_ITEM_MISSING_MESSAGE });
  await assert.rejects(store.updateDraft('item-1', 1, await drafted(ledger, { source: 'wallet' }), later), { message: REVIEW_INPUT_MESSAGE });
  await assert.rejects(store.updateDraft('item-1', 1, { nope: true }, later), { message: REVIEW_DRAFT_INVALID_MESSAGE });
  const { item } = await store.confirm('item-1', { expectedRevision: 1, todayISO: today, at: later });
  assert.deepEqual((await ledgerRows(ledger)).entries, [item.writeId]);
});

test('a confirmation the domain refuses (a gap, a stale basis) keeps the draft, freezes nothing and writes nothing', async () => {
  const { ledger, store } = await setup();
  await capture(store, await drafted(ledger, { currency: null }), 'gap', 'write-gap');
  await capture(store, { ...(await drafted(ledger)), basis: [] }, 'stale', 'write-stale');
  await assert.rejects(store.confirm('gap', { expectedRevision: 0, todayISO: today, at: later }), { message: REVIEW_INCOMPLETE_MESSAGE });
  await assert.rejects(store.confirm('stale', { expectedRevision: 0, todayISO: today, at: later }), { message: REVIEW_STALE_MESSAGE });
  for (const id of ['gap', 'stale']) assert.deepEqual(await store.get(id).then(item => [item?.status, item?.attempt, item?.revision]), ['pending', null, 0]);
  assert.deepEqual(await ledgerRows(ledger), { entries: [], plans: [], transfers: [] });
});

test('cuotas confirm as exactly one plan, and the frozen plan reconciles even after it was stopped', async () => {
  const { ledger, db, store } = await setup();
  await capture(store, await drafted(ledger, { destinationId: cardAccount.id, purchase: { mode: 'installments', count: 3, placement: 'current' } }));
  // The review side fails right after the ledger committed: the confirmation reports it, never as a failure.
  const crashing = await openReviewStore(failing(db, call => call === 2), ledger);
  const { recorded, item } = await crashing.confirm('item-1', { expectedRevision: 0, todayISO: today, at: later });
  assert.equal(recorded, false);
  assert.deepEqual([item.status, item.attempt?.type], ['pending', 'plan']);
  assert.deepEqual(await ledgerRows(ledger), { entries: (await ledgerRows(ledger)).entries, plans: ['write-1'], transfers: [] });
  assert.ok((await ledgerRows(ledger)).entries.every(id => id.startsWith('inst_write-1_')), 'only the plan\'s own instalments, never a purchase-date movement');
  const plan = (await readArchive(ledger)).installmentPlans!.find(row => row.id === 'write-1')!;
  await cancelInstallmentPlan(ledger, plan.id, plan.revision, today, later);
  const report = await store.reconcile(later);
  assert.deepEqual(report, { confirmed: ['item-1'], released: [], conflicts: [], unreadable: [] });
  assert.deepEqual((await store.get('item-1'))?.receipt, { type: 'plan', writeId: 'write-1', how: 'reconciled', at: later });
  assert.deepEqual((await ledgerRows(ledger)).plans, ['write-1'], 'still one plan');
});

// ---- interrupted confirmations ------------------------------------------------------------------------------------------

test('the ledger write succeeded but the app stopped before the item was marked: a restart reconciles it, never writes twice', async () => {
  const { ledgerPath, reviewPath } = directory();
  const ledger = await ledgerWithCard(ledgerPath);
  const db = reviewAt(reviewPath);
  await capture(await openReviewStore(db, ledger), await drafted(ledger));
  // Call 1 freezes the write; call 2 (marking it confirmed) is where the app "terminates".
  const result = await (await openReviewStore(failing(db, call => call === 2), ledger)).confirm('item-1', { expectedRevision: 0, todayISO: today, at: later });
  assert.equal(result.recorded, false);
  assert.deepEqual((await ledgerRows(ledger)).entries, ['write-1']);
  // Restart: a new store over the same files.
  const restarted = await openReviewStore(reviewAt(reviewPath), ledgerAt(ledgerPath));
  const pending = await restarted.get('item-1');
  assert.deepEqual([pending?.status, pending?.attempt?.type], ['pending', 'entry'], 'the frozen write survived the restart');
  // A second confirm (the person taps again) recognises the committed write.
  const again = await restarted.confirm('item-1', { expectedRevision: pending!.revision, todayISO: today, at: '2026-09-28T11:00:00.000Z' });
  assert.deepEqual([again.item.status, again.item.receipt?.how], ['confirmed', 'reconciled']);
  assert.deepEqual((await ledgerRows(ledger)).entries, ['write-1'], 'exactly one movement');
});

test('reconciliation after an interruption: committed confirms, never landed releases, edited after commit still confirms', async () => {
  const { ledger, db, store } = await setup();
  for (const n of [1, 2, 3]) await capture(store, await drafted(ledger, { amountMinor: 1000 * n }), `item-${n}`, `write-${n}`);
  // 1: ledger committed, item not marked. 2: frozen, then the ledger write never happened (crash before it). 3: committed,
  // then edited by the person in Movimientos before the tray caught up.
  await (await openReviewStore(failing(db, call => call === 2), ledger)).confirm('item-1', { expectedRevision: 0, todayISO: today, at: later });
  const blocked = failing(ledger, () => true);
  await assert.rejects((await openReviewStore(db, { ...blocked, getFirstAsync: ledger.getFirstAsync, getAllAsync: async () => { throw new Error('locked'); } }))
    .confirm('item-2', { expectedRevision: 0, todayISO: today, at: later }));
  assert.equal((await store.get('item-2'))?.attempt?.type, undefined, 'an unreadable ledger before freezing leaves nothing frozen');
  const freezeOnly = failing(ledger, () => true);
  await assert.rejects((await openReviewStore(db, freezeOnly)).confirm('item-2', { expectedRevision: 0, todayISO: today, at: later }), /disk I\/O error/);
  assert.equal((await store.get('item-2'))?.attempt, null, 'a ledger refusal with nothing written releases the frozen write at once');
  await (await openReviewStore(failing(db, call => call === 2), ledger)).confirm('item-3', { expectedRevision: 0, todayISO: today, at: later });
  const record = (await readArchive(ledger)).records.find(row => row.entry.id === 'write-3')!;
  await changeEntry(ledger, makeEntryChange('edit-3', record, 'edit', later, { ...record.entry, merchant: 'Coto Centro', amountMinor: 3100 }));
  const report = await store.reconcile('2026-09-28T12:00:00.000Z');
  assert.deepEqual(report, { confirmed: ['item-1', 'item-3'], released: [], conflicts: [], unreadable: [] });
  assert.deepEqual((await ledgerRows(ledger)).entries, ['write-1', 'write-3']);
  const retried = await store.confirm('item-2', { expectedRevision: (await store.get('item-2'))!.revision, todayISO: today, at: later });
  assert.equal(retried.item.status, 'confirmed');
  assert.deepEqual((await ledgerRows(ledger)).entries, ['write-1', 'write-2', 'write-3'], 'each item wrote once');
});

test('an outcome the store cannot verify keeps the frozen write; the next reconciliation settles it either way', async () => {
  const { ledger, db, store } = await setup();
  await capture(store, await drafted(ledger));
  // The ledger write fails and the ledger cannot be read afterwards: the outcome is unknown.
  let attempted = false;
  const flaky: LedgerDatabase = { ...ledger,
    withExclusiveTransactionAsync: async () => { attempted = true; throw new Error('disk I/O error'); },
    getAllAsync: async <T>(sql: string, ...params: (string | number | null)[]) => {
      if (attempted) throw new Error('database is locked');
      return ledger.getAllAsync<T>(sql, ...params);
    } };
  await assert.rejects((await openReviewStore(db, flaky)).confirm('item-1', { expectedRevision: 0, todayISO: today, at: later }));
  const kept = await store.get('item-1');
  assert.equal(kept?.attempt?.type, 'entry', 'unknown outcome: the frozen write stays for reconciliation');
  assert.deepEqual(await store.reconcile(later), { confirmed: [], released: ['item-1'], conflicts: [], unreadable: [] });
  assert.equal((await store.get('item-1'))?.attempt, null);
  assert.deepEqual((await ledgerRows(ledger)).entries, []);
});

test('an update or a dismissal of an item whose write already landed confirms it instead', async () => {
  const { ledger, db, store } = await setup();
  await capture(store, await drafted(ledger), 'a', 'write-a');
  await capture(store, await drafted(ledger), 'b', 'write-b');
  await (await openReviewStore(failing(db, call => call === 2), ledger)).confirm('a', { expectedRevision: 0, todayISO: today, at: later });
  await (await openReviewStore(failing(db, call => call === 2), ledger)).confirm('b', { expectedRevision: 0, todayISO: today, at: later });
  // The carry-forward of 25A-01: the person switches a confirmed-but-unmarked «Una vez» purchase to cuotas.
  const cuotas = await drafted(ledger, { destinationId: cardAccount.id, purchase: { mode: 'installments', count: 3, placement: 'current' } });
  await assert.rejects(store.updateDraft('a', 1, cuotas, later), { message: REVIEW_ITEM_CLOSED_MESSAGE });
  await assert.rejects(store.dismiss('b', 1, later), { message: REVIEW_ITEM_CLOSED_MESSAGE });
  assert.deepEqual(await Promise.all(['a', 'b'].map(id => store.get(id).then(item => [item?.status, item?.receipt?.how]))), [['confirmed', 'reconciled'], ['confirmed', 'reconciled']]);
  assert.deepEqual(await ledgerRows(ledger), { entries: ['write-a', 'write-b'], plans: [], transfers: [] }, 'no plan was ever added');
});

test('two confirmations of one item in flight write once (the store runs one operation at a time)', async () => {
  const { ledger, store } = await setup();
  await capture(store, await drafted(ledger));
  const results = await Promise.allSettled([0, 0, 0].map(revision => store.confirm('item-1', { expectedRevision: revision, todayISO: today, at: later })));
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.deepEqual((await ledgerRows(ledger)).entries, ['write-1']);
});

// ---- one id, one kind of write ------------------------------------------------------------------------------------------

test('the ledger refuses one id as two kinds of write: a movement, a plan or a transfer', async () => {
  const { ledgerPath } = directory();
  const ledger = await ledgerWithCard(ledgerPath);
  const entry: Entry = { id: 'shared', accountId: cardAccount.id, kind: 'expense', amountMinor: 30000, merchant: 'Electro', category: 'Hogar', dateISO: '2026-09-10', createdAt };
  const plan = newInstallmentPlan({ id: 'shared', card, cardAccount, merchant: 'Electro', category: 'Hogar', purchaseDateISO: '2026-09-10', principalMinor: 30000, count: 3,
    placement: 'current', createdAt });
  const transfer: Transfer = { id: 'shared', fromAccountId: bank.id, toAccountId: savings.id, amountMinor: 100, note: '', dateISO: '2026-09-10', createdAt };
  await createEntry(ledger, entry);
  await createEntry(ledger, entry); // The same write again: a no-op, as before.
  await assert.rejects(createInstallmentPlan(ledger, plan), { message: WRITE_ID_TAKEN_MESSAGE });
  await assert.rejects(createTransfer(ledger, transfer), { message: WRITE_ID_TAKEN_MESSAGE });
  const other = await ledgerWithCard(directory().ledgerPath);
  await createInstallmentPlan(other, plan);
  await createInstallmentPlan(other, plan); // Idempotent for the same plan.
  await assert.rejects(createEntry(other, entry), { message: WRITE_ID_TAKEN_MESSAGE });
  await assert.rejects(createTransfer(other, transfer), { message: WRITE_ID_TAKEN_MESSAGE });
  const third = await ledgerWithCard(directory().ledgerPath);
  await createTransfer(third, transfer);
  await assert.rejects(createEntry(third, { ...entry, accountId: bank.id }), { message: WRITE_ID_TAKEN_MESSAGE });
  await assert.rejects(createInstallmentPlan(third, plan), { message: WRITE_ID_TAKEN_MESSAGE });
  assert.deepEqual(await ledgerRows(ledger), { entries: ['shared'], plans: [], transfers: [] });
  assert.deepEqual((await ledgerRows(other)).plans, ['shared']);
  assert.deepEqual((await ledgerRows(third)).transfers, ['shared']);
});

test('an item whose write id the ledger holds as another kind, or with other content, is a conflict: nothing is written or lost', async () => {
  const { ledger, store } = await setup();
  await createInstallmentPlan(ledger, newInstallmentPlan({ id: 'write-1', card, cardAccount, merchant: 'Electro', category: 'Hogar', purchaseDateISO: '2026-09-10',
    principalMinor: 30000, count: 3, placement: 'current', createdAt }));
  await createEntry(ledger, { id: 'write-2', accountId: bank.id, kind: 'expense', amountMinor: 1, merchant: 'Otro', category: 'Comida', dateISO: '2026-09-20', createdAt });
  await capture(store, await drafted(ledger), 'item-1', 'write-1');
  await capture(store, await drafted(ledger), 'item-2', 'write-2');
  const before = await readArchive(ledger);
  for (const id of ['item-1', 'item-2']) {
    await assert.rejects(store.confirm(id, { expectedRevision: 0, todayISO: today, at: later }), { message: REVIEW_WRITE_CONFLICT_MESSAGE }, id);
    assert.deepEqual(await store.get(id).then(item => [item?.status, item?.attempt, item?.revision]), ['pending', null, 0], 'the draft is kept untouched');
  }
  assert.deepEqual(await store.reconcile(later), { confirmed: [], released: [], conflicts: ['item-1', 'item-2'], unreadable: [] });
  assert.deepEqual(await readArchive(ledger), before, 'the ledger is exactly as it was');
  const dismissed = await store.dismiss('item-1', 0, later);
  assert.equal(dismissed.status, 'dismissed', 'a conflicting proposal can still be dismissed');
});

// ---- review fixes (25A-02) ----------------------------------------------------------------------------------------------

test('timestamps are one shape (toISOString), so «oldest first» is the order the text sorts in', async () => {
  const { ledger, store } = await setup();
  const draft = await drafted(ledger);
  for (const at of ['2026-09-28T10:00:00Z', '2026-09-28T10:00:00.000+03:00', '2026-09-28T07:00:00.000-03:00', '2026-02-30T10:00:00.000Z', 'Mon, 28 Sep 2026 10:00:00 GMT']) {
    await assert.rejects(store.capture({ id: 'i', writeId: 'w', captureKey: null, draft, at }), { message: REVIEW_INPUT_MESSAGE }, at);
  }
  await store.capture({ id: 'late', writeId: 'w-late', captureKey: null, draft, at: '2026-09-28T11:00:00.000Z' });
  await store.capture({ id: 'early', writeId: 'w-early', captureKey: null, draft, at: '2026-09-28T09:00:00.000Z' });
  assert.deepEqual((await store.listPending()).items.map(item => item.id), ['early', 'late']);
});

test('a confirmation that finds its write already in the ledger never fails when the item cannot be marked', async () => {
  const { ledger, db, store } = await setup();
  await capture(store, await drafted(ledger));
  await (await openReviewStore(failing(db, call => call === 2), ledger)).confirm('item-1', { expectedRevision: 0, todayISO: today, at: later });
  const pending = (await store.get('item-1'))!;
  const result = await (await openReviewStore(failing(db, () => true), ledger)).confirm('item-1', { expectedRevision: pending.revision, todayISO: today, at: later });
  assert.deepEqual([result.recorded, result.item.status], [false, 'pending']);
  assert.deepEqual((await ledgerRows(ledger)).entries, ['write-1']);
});

test('a frozen plan with a mistyped field is unreadable, never a raw error and never written', async () => {
  const { ledger, db, store } = await setup();
  await capture(store, await drafted(ledger, { destinationId: cardAccount.id, purchase: { mode: 'installments', count: 3, placement: 'current' } }));
  const plan = newInstallmentPlan({ id: 'write-1', card, cardAccount, merchant: 'Coto', category: 'Supermercado', purchaseDateISO: '2026-09-27', principalMinor: 1500000,
    count: 3, placement: 'current', createdAt: later });
  for (const broken of [{ ...plan, principalMinor: '1500000' }, { ...plan, merchant: null }, { ...plan, schedule: plan.schedule.map(row => ({ ...row, billingDateISO: 20260930 })) }]) {
    await db.runAsync("UPDATE review_items SET attemptJSON = ? WHERE id = 'item-1'", JSON.stringify({ type: 'plan', plan: broken }));
    await assert.rejects(store.get('item-1'), { message: REVIEW_ITEM_UNREADABLE_MESSAGE });
    await assert.rejects(store.confirm('item-1', { expectedRevision: 0, todayISO: today, at: later }), { message: REVIEW_ITEM_UNREADABLE_MESSAGE });
  }
  assert.deepEqual(await ledgerRows(ledger), { entries: [], plans: [], transfers: [] });
});

test('a review file from a newer build keeps even its journal mode', async () => {
  const { ledgerPath, reviewPath } = directory();
  const ledger = await ledgerWithCard(ledgerPath);
  const raw = new DatabaseSync(reviewPath);
  raw.exec('PRAGMA journal_mode = DELETE; CREATE TABLE future (x INTEGER); INSERT INTO future VALUES (1); PRAGMA user_version = 7;');
  raw.close();
  const before = readFileSync(reviewPath);
  const store = await openReviewStore(reviewAt(reviewPath), ledger);
  assert.equal(store.writable, false);
  assert.deepEqual(readFileSync(reviewPath), before, 'not one byte changed');
});

test('two stores over one file never race: a reconciliation waits for a confirmation in flight', async () => {
  const { ledgerPath, reviewPath } = directory();
  const ledger = await ledgerWithCard(ledgerPath);
  const first = await openReviewStore(reviewAt(reviewPath), ledger);
  await capture(first, await drafted(ledger));
  let open!: () => void;
  const gate = new Promise<void>(resolve => { open = resolve; });
  const slow: LedgerDatabase = { ...ledger, withExclusiveTransactionAsync: async task => { await gate; return ledger.withExclusiveTransactionAsync(task); } };
  const confirming = (await openReviewStore(reviewAt(reviewPath), slow)).confirm('item-1', { expectedRevision: 0, todayISO: today, at: later });
  const second = await Promise.race([openReviewStore(reviewAt(reviewPath), ledger), new Promise<null>(resolve => setTimeout(() => resolve(null), 50))]);
  assert.equal(second, null, 'even opening a second store waits for the confirmation in flight');
  const reconciling = first.reconcile(later);
  open();
  const [confirmation, report] = await Promise.all([confirming, reconciling]);
  assert.deepEqual([confirmation.recorded, confirmation.item.status], [true, 'confirmed']);
  assert.deepEqual(report, { confirmed: [], released: [], conflicts: [], unreadable: [] });
  assert.deepEqual((await ledgerRows(ledger)).entries, ['write-1']);
});

// ---- Codex review of #78: the basis is checked inside the ledger's own transaction ------------------------------------

/** A ledger whose first write transaction is preceded by `change`: something the person (or another screen) does after
 * the confirmation read the ledger and before its write transaction starts. */
function changedInBetween(ledger: LedgerDatabase, change: () => Promise<void>): LedgerDatabase {
  let first = true;
  return { ...ledger, withExclusiveTransactionAsync: async task => {
    if (first) { first = false; await change(); }
    return ledger.withExclusiveTransactionAsync(task);
  } };
}
const renameBank = (ledger: LedgerDatabase) => async () => {
  const archive = await readArchive(ledger);
  const account = archive.accounts.find(row => row.id === bank.id)!;
  const snapshot = snapshotFromArchive(archive);
  await changeAccount(ledger, makeAccountChange('rename-bank', account, snapshot, 'Galicia', account.openingMinor, '2026-09-28T10:01:00.000Z'));
};

test('a change between the confirmation\'s read and the ledger\'s write transaction is refused inside that transaction', async () => {
  const { ledger, db } = await setup();
  const store = await openReviewStore(db, changedInBetween(ledger, renameBank(ledger)));
  await capture(store, await drafted(ledger));
  await assert.rejects(store.confirm('item-1', { expectedRevision: 0, todayISO: today, at: later }), { message: REVIEW_STALE_MESSAGE });
  assert.deepEqual((await ledgerRows(ledger)).entries, [], 'nothing was written');
  const item = await store.get('item-1');
  assert.deepEqual([item?.status, item?.attempt], ['pending', null], 'the draft is kept and the frozen write released');
});

test('an interrupted attempt retried after the ledger changed is refused, never written against a basis nobody reviewed', async () => {
  const { ledger, db, store } = await setup();
  await capture(store, await drafted(ledger));
  // Crash before the ledger write: the frozen write stays (the ledger cannot even be read after the failure).
  let attempted = false;
  const crashing: LedgerDatabase = { ...ledger,
    withExclusiveTransactionAsync: async () => { attempted = true; throw new Error('disk I/O error'); },
    getAllAsync: async <T>(sql: string, ...params: (string | number | null)[]) => {
      if (attempted) throw new Error('database is locked');
      return ledger.getAllAsync<T>(sql, ...params);
    } };
  await assert.rejects((await openReviewStore(db, crashing)).confirm('item-1', { expectedRevision: 0, todayISO: today, at: later }));
  const frozen = (await store.get('item-1'))!;
  assert.equal(frozen.attempt?.type, 'entry');
  await renameBank(ledger)();
  await assert.rejects(store.confirm('item-1', { expectedRevision: frozen.revision, todayISO: today, at: later }), { message: REVIEW_STALE_MESSAGE });
  assert.deepEqual((await ledgerRows(ledger)).entries, []);
  assert.equal((await store.get('item-1'))?.attempt, null);
});

test('the same guard protects cuotas: a card renamed in between is refused inside the plan\'s transaction', async () => {
  const { ledger, db } = await setup();
  const renameCard = async () => {
    const { saveCreditCard } = await import('../src/storage/database.ts');
    const current = (await readArchive(ledger)).cards!.find(row => row.id === card.id)!;
    await saveCreditCard(ledger, { ...current, issuer: 'Galicia', revision: current.revision + 1, updatedAt: '2026-09-28T10:01:00.000Z' });
  };
  const store = await openReviewStore(db, changedInBetween(ledger, renameCard));
  await capture(store, await drafted(ledger, { destinationId: cardAccount.id, purchase: { mode: 'installments', count: 3, placement: 'current' } }));
  await assert.rejects(store.confirm('item-1', { expectedRevision: 0, todayISO: today, at: later }), { message: REVIEW_STALE_MESSAGE });
  assert.deepEqual((await ledgerRows(ledger)).plans, [], 'no plan was written');
  assert.equal((await store.get('item-1'))?.status, 'pending');
});
