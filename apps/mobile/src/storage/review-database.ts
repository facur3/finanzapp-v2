/** Producto 25A-02: the durable local review store. Every proposal of a financial write (an Assistant draft, later a Wallet
 * capture or an inbox delivery) waits here as a review item until the person confirms or dismisses it.
 *
 * - **Its own file, apart from the ledger.** `finanzapp-review-v1.sqlite`, with its own version (`REVIEW_DATABASE_VERSION`)
 *   and migrations. The ledger's schema (14), its backups (v14), its migrations and `importArchive` never read or write it,
 *   and nothing here ever writes the ledger except through the ledger's own create functions. A review file that cannot
 *   be opened, is corrupt or comes from a newer build is never reset, deleted or rewritten, and it never stops the ledger
 *   from opening: the ledger stays the source of truth. A newer file is read and never written.
 * - **Strict on both sides of the boundary.** A draft is parsed by `parseReviewDraft` (25A-01) when it is stored and again
 *   when it is read; a row that does not parse (a corrupt or unsupported draft, a malformed frozen write) is reported as
 *   unreadable and is never turned into a write.
 * - **One frozen write id per item.** `writeId` is fixed when the item is captured and never changes: updating the draft
 *   keeps it, a retry reuses it, a new id is never minted.
 * - **The write is frozen before the ledger is touched.** Confirming builds the one write (`writeForReviewDraft`), records
 *   it on the item (`attempt`) in its own commit, then asks the ledger to create it (`createEntry`, or `savePurchasePlan`
 *   for cuotas). The ledger's create functions are idempotent by id and, since 25A-02, refuse an id another kind of
 *   write owns (`assertWriteIdAvailable`). A crash between the ledger's commit and the item's status is reconciled from
 *   the ledger: the frozen write found there (by id and content) marks the item confirmed; nothing is written twice. An
 *   id the ledger holds with other content or another kind is a conflict: the item stays pending and nothing is written.
 *   A ledger refusal (nothing written) releases the frozen write and keeps the draft.
 * - **States.** pending → confirmed (a receipt names the write) and pending → dismissed; neither ever returns to pending.
 *   An update or a dismissal first settles a frozen write: if the ledger has it, the item is confirmed instead.
 * - **Capture keys.** A producer may supply a key (`captureKey`): a second capture with the same key and the same draft
 *   returns the first item (a repeated delivery); the same key with another draft is refused, never merged or dropped.
 *   What a key is for a Wallet capture is 25A2's decision; nothing here compares amounts or merchants.
 * - **One operation at a time.** Every store of the process shares one queue (`openReviewStore`), so two confirmations
 *   of one item, or a reconciliation and a confirmation in flight, never race. */
import {
  INSTALLMENT_KEYS, INSTALLMENT_PLAN_KEYS, REVIEW_SOURCES, REVIEW_WRITE_ID, isStorableCurrency, ledgerIdOwners, parseReviewDraft, sameEntry,
  sameInstallmentPlan, writeForReviewDraft, type Entry, type EntryRecord, type InstallmentPlan, type LedgerArchive, type ReviewDraft,
  type ReviewSource, type ReviewWrite,
} from '@finanzapp/domain';
import { createEntry, readArchive, type LedgerDatabase, type SqlExecutor } from './database.ts';
import { savePurchasePlan } from './ledger-session.ts';

export const REVIEW_DATABASE_NAME = 'finanzapp-review-v1.sqlite';
export const REVIEW_DATABASE_VERSION = 1;

export interface ReviewDatabase extends SqlExecutor {
  withExclusiveTransactionAsync(task: (tx: SqlExecutor) => Promise<void>): Promise<void>;
}

export type ReviewStatus = 'pending' | 'confirmed' | 'dismissed';
/** What the ledger holds for a confirmed item: the kind and id of its one write, and whether this item's confirmation
 * wrote it (`confirmed`) or found it already committed after an interruption (`reconciled`). */
export interface ReviewReceipt { type: ReviewWrite['type']; writeId: string; how: 'confirmed' | 'reconciled'; at: string }
export interface ReviewItem {
  id: string;
  source: ReviewSource;
  /** The producer's deduplication key, when it supplied one. */
  captureKey: string | null;
  draft: ReviewDraft;
  /** Fixed at capture; the id of the item's one ledger write, whatever the draft becomes. */
  writeId: string;
  status: ReviewStatus;
  /** The write being (or that was) confirmed, frozen before the ledger is asked; null while none is in flight. Kept on a
   * confirmed item as the record of what was written. */
  attempt: ReviewWrite | null;
  receipt: ReviewReceipt | null;
  createdAt: string;
  updatedAt: string;
  revision: number;
}

export const REVIEW_ITEM_MISSING_MESSAGE = 'No encontramos esta propuesta.';
export const REVIEW_ITEM_UNREADABLE_MESSAGE = 'Esta propuesta no se puede leer. No se registró nada.';
export const REVIEW_ITEM_CHANGED_MESSAGE = 'Esta propuesta cambió desde que la abriste. Volvé a abrirla.';
export const REVIEW_ITEM_CLOSED_MESSAGE = 'Esta propuesta ya se confirmó o se descartó.';
export const REVIEW_CAPTURE_CONFLICT_MESSAGE = 'Esta captura ya existe con otros datos. No se registró nada.';
export const REVIEW_WRITE_CONFLICT_MESSAGE = 'El registro de esta propuesta ya existe con otros datos. No se registró nada.';
export const REVIEW_READ_ONLY_MESSAGE = 'Estas propuestas requieren una versión más nueva de FinanzApp. No se modificaron.';
export const REVIEW_INPUT_MESSAGE = 'Datos de propuesta inválidos. No se registró nada.';

const MAX_DRAFT_JSON = 32000;
const MAX_WRITE_JSON = 200000;
const MAX_CAPTURE_KEY = 200;
const ITEM_COLUMNS = 'id, source, captureKey, capturedJSON, draftVersion, draftJSON, writeId, status, attemptJSON, receiptJSON, createdAt, updatedAt, revision';

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS review_items (
    id TEXT PRIMARY KEY NOT NULL CHECK(length(id) BETWEEN 1 AND 70 AND id NOT GLOB '*[^A-Za-z0-9-]*'),
    source TEXT NOT NULL CHECK(source IN ('assistant', 'wallet', 'inbox', 'fixture')),
    captureKey TEXT UNIQUE CHECK(captureKey IS NULL OR length(captureKey) BETWEEN 1 AND ${MAX_CAPTURE_KEY}),
    capturedJSON TEXT NOT NULL CHECK(length(capturedJSON) BETWEEN 2 AND ${MAX_DRAFT_JSON}),
    draftVersion INTEGER NOT NULL CHECK(draftVersion >= 1),
    draftJSON TEXT NOT NULL CHECK(length(draftJSON) BETWEEN 2 AND ${MAX_DRAFT_JSON}),
    writeId TEXT NOT NULL UNIQUE CHECK(length(writeId) BETWEEN 1 AND 70 AND writeId NOT GLOB '*[^A-Za-z0-9-]*'),
    status TEXT NOT NULL CHECK(status IN ('pending', 'confirmed', 'dismissed')),
    attemptJSON TEXT CHECK(attemptJSON IS NULL OR length(attemptJSON) BETWEEN 2 AND ${MAX_WRITE_JSON}),
    receiptJSON TEXT CHECK(receiptJSON IS NULL OR length(receiptJSON) BETWEEN 2 AND 1000),
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    revision INTEGER NOT NULL CHECK(revision >= 0 AND revision <= 9007199254740991),
    CHECK((status = 'confirmed') = (receiptJSON IS NOT NULL)),
    CHECK(status <> 'confirmed' OR attemptJSON IS NOT NULL),
    CHECK(status <> 'dismissed' OR attemptJSON IS NULL)
  ) STRICT;
  CREATE INDEX IF NOT EXISTS review_items_by_status ON review_items(status, createdAt, id);
`;

/** Opens the store's schema: creates it on a new file, migrates an older one in one transaction, and leaves a file from a
 * newer build untouched (read only). Throws (changing nothing) when the file cannot be read; the caller keeps the ledger
 * open regardless. */
export async function initializeReviewDatabase(db: ReviewDatabase): Promise<{ writable: boolean }> {
  await db.execAsync('PRAGMA busy_timeout = 5000;');
  const version = (await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version ?? 0;
  if (version > REVIEW_DATABASE_VERSION) return { writable: false }; // Not even its journal mode is changed.
  await db.execAsync('PRAGMA journal_mode = WAL;');
  if (version < REVIEW_DATABASE_VERSION) {
    await db.withExclusiveTransactionAsync(async tx => {
      // Read again inside the transaction: two openers racing never migrate twice.
      const current = (await tx.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version ?? 0;
      if (current < 1) await tx.execAsync(SCHEMA + 'PRAGMA user_version = 1;');
    });
  }
  return { writable: true };
}

// ---- rows ------------------------------------------------------------------------------------------------------------

type ItemRow = {
  id: string; source: string; captureKey: string | null; capturedJSON: string; draftVersion: number; draftJSON: string; writeId: string;
  status: string; attemptJSON: string | null; receiptJSON: string | null; createdAt: string; updatedAt: string; revision: number;
};

const ENTRY_KEYS = ['id', 'accountId', 'kind', 'amountMinor', 'merchant', 'category', 'dateISO', 'createdAt'] as const;
const exact = (value: unknown, keys: readonly string[]): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
/** An ISO 8601 UTC timestamp as `Date.prototype.toISOString` writes it, on a real calendar day: items are ordered by this
 * text, so one shape only (an offset or a local form would sort wrongly). */
const TIMESTAMP = /^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):[0-5]\d:[0-5]\d\.\d{3}Z$/;
const timestamp = (value: unknown): value is string => {
  if (typeof value !== 'string') return false;
  const match = TIMESTAMP.exec(value);
  if (!match) return false;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString() === value;
};

/** The frozen write of a row: exactly an Entry or an InstallmentPlan, shaped as `writeForReviewDraft` builds them, under
 * the item's own write id. Its money and accounts are checked again by the ledger when it is written; here only its shape. */
function writeFromJSON(text: string, writeId: string): ReviewWrite {
  const value: unknown = JSON.parse(text);
  if (exact(value, ['type', 'entry']) && value.type === 'entry' && exact(value.entry, ENTRY_KEYS)) {
    const entry = value.entry;
    if (entry.id !== writeId || (entry.kind !== 'expense' && entry.kind !== 'income') || !Number.isSafeInteger(entry.amountMinor)
      || ['accountId', 'merchant', 'category', 'dateISO', 'createdAt'].some(key => typeof entry[key] !== 'string')) throw new Error(REVIEW_ITEM_UNREADABLE_MESSAGE);
    return { type: 'entry', entry: entry as unknown as Entry };
  }
  if (exact(value, ['type', 'plan']) && value.type === 'plan' && exact(value.plan, INSTALLMENT_PLAN_KEYS)) {
    const plan = value.plan;
    const strings = ['id', 'cardId', 'merchant', 'category', 'purchaseDateISO', 'interestCategory', 'feeCategory', 'taxCategory', 'createdAt', 'updatedAt'];
    const integers = ['principalMinor', 'count', 'interestMinor', 'feeMinor', 'taxMinor', 'revision'];
    if (plan.id !== writeId || !isStorableCurrency(plan.currency) || strings.some(key => typeof plan[key] !== 'string')
      || integers.some(key => !Number.isSafeInteger(plan[key])) || (plan.cancelledAt !== null && typeof plan.cancelledAt !== 'string')
      || typeof plan.deleted !== 'boolean' || !Array.isArray(plan.schedule) || plan.schedule.length !== plan.count
      || !plan.schedule.every(row => exact(row, INSTALLMENT_KEYS) && typeof row.billingDateISO === 'string' && typeof row.dueDateISO === 'string'
        && ['number', 'principalMinor', 'interestMinor', 'feeMinor', 'taxMinor'].every(key => Number.isSafeInteger(row[key])))) throw new Error(REVIEW_ITEM_UNREADABLE_MESSAGE);
    return { type: 'plan', plan: plan as unknown as InstallmentPlan };
  }
  throw new Error(REVIEW_ITEM_UNREADABLE_MESSAGE);
}
function receiptFromJSON(text: string, writeId: string): ReviewReceipt {
  const value: unknown = JSON.parse(text);
  if (!exact(value, ['type', 'writeId', 'how', 'at']) || (value.type !== 'entry' && value.type !== 'plan') || value.writeId !== writeId
    || (value.how !== 'confirmed' && value.how !== 'reconciled') || !timestamp(value.at)) throw new Error(REVIEW_ITEM_UNREADABLE_MESSAGE);
  return { type: value.type, writeId, how: value.how, at: value.at };
}

/** A row as an item, or a refusal: every column checked, the draft parsed strictly, its version and source the row's. */
function itemFromRow(row: ItemRow): ReviewItem {
  try {
    if (!(REVIEW_SOURCES as readonly string[]).includes(row.source) || !['pending', 'confirmed', 'dismissed'].includes(row.status)
      || !REVIEW_WRITE_ID.test(row.id) || !REVIEW_WRITE_ID.test(row.writeId) || !timestamp(row.createdAt) || !timestamp(row.updatedAt)
      || !Number.isSafeInteger(row.revision) || row.revision < 0) throw new Error(REVIEW_ITEM_UNREADABLE_MESSAGE);
    const draft = parseReviewDraft(JSON.parse(row.draftJSON));
    parseReviewDraft(JSON.parse(row.capturedJSON));
    if (draft.version !== row.draftVersion || draft.source !== row.source) throw new Error(REVIEW_ITEM_UNREADABLE_MESSAGE);
    const attempt = row.attemptJSON === null ? null : writeFromJSON(row.attemptJSON, row.writeId);
    const receipt = row.receiptJSON === null ? null : receiptFromJSON(row.receiptJSON, row.writeId);
    if ((row.status === 'confirmed') !== (receipt !== null) || (row.status === 'confirmed' && (attempt === null || attempt.type !== receipt!.type))
      || (row.status === 'dismissed' && attempt !== null)) throw new Error(REVIEW_ITEM_UNREADABLE_MESSAGE);
    return { id: row.id, source: row.source as ReviewSource, captureKey: row.captureKey, draft, writeId: row.writeId, status: row.status as ReviewStatus,
      attempt, receipt, createdAt: row.createdAt, updatedAt: row.updatedAt, revision: row.revision };
  } catch {
    throw new Error(REVIEW_ITEM_UNREADABLE_MESSAGE);
  }
}

async function readRow(db: SqlExecutor, id: string): Promise<ItemRow | null> {
  return db.getFirstAsync<ItemRow>(`SELECT ${ITEM_COLUMNS} FROM review_items WHERE id = ?`, id);
}

/** One item, or null when there is none with that id. An unreadable row is refused (`REVIEW_ITEM_UNREADABLE_MESSAGE`). */
export async function getReviewItem(db: SqlExecutor, id: string): Promise<ReviewItem | null> {
  const row = await readRow(db, id);
  return row ? itemFromRow(row) : null;
}

/** The pending items, oldest first, and the ids of the pending rows that cannot be read: those are set apart, never
 * shown as a proposal and never written. */
export async function listPendingReviewItems(db: SqlExecutor): Promise<{ items: ReviewItem[]; unreadable: string[] }> {
  const rows = await db.getAllAsync<ItemRow>(`SELECT ${ITEM_COLUMNS} FROM review_items WHERE status = 'pending' ORDER BY createdAt, id`);
  const items: ReviewItem[] = [], unreadable: string[] = [];
  for (const row of rows) {
    try { items.push(itemFromRow(row)); } catch { unreadable.push(row.id); }
  }
  return { items, unreadable };
}

const draftJSON = (draft: ReviewDraft) => JSON.stringify(draft);

async function writeItem(tx: SqlExecutor, item: ReviewItem, before: ReviewItem): Promise<void> {
  const { changes } = await tx.runAsync(`UPDATE review_items SET draftVersion = ?, draftJSON = ?, status = ?, attemptJSON = ?, receiptJSON = ?, updatedAt = ?, revision = ?
    WHERE id = ? AND revision = ? AND status = ?`, item.draft.version, draftJSON(item.draft), item.status, item.attempt === null ? null : JSON.stringify(item.attempt),
  item.receipt === null ? null : JSON.stringify(item.receipt), item.updatedAt, item.revision, item.id, before.revision, before.status);
  if (changes !== 1) throw new Error(REVIEW_ITEM_CHANGED_MESSAGE);
}
const next = (item: ReviewItem, at: string, change: Partial<Pick<ReviewItem, 'draft' | 'status' | 'attempt' | 'receipt'>>): ReviewItem =>
  ({ ...item, ...change, updatedAt: at, revision: item.revision + 1 });

// ---- capture -----------------------------------------------------------------------------------------------------------

export interface ReviewCapture {
  /** The item's id and its write's id: fixed by the producer (a UUID each), never derived from the draft. */
  id: string;
  writeId: string;
  captureKey: string | null;
  /** Untrusted: parsed by `parseReviewDraft` before anything is stored. */
  draft: unknown;
  at: string;
}

/** Stores a new pending item. Idempotent: the same capture again (same id, or same capture key, with the same draft)
 * returns the stored item with `duplicate: true`; the same id or key with another draft or write id is refused
 * (`REVIEW_CAPTURE_CONFLICT_MESSAGE`). */
export async function captureReviewItem(db: ReviewDatabase, input: ReviewCapture): Promise<{ item: ReviewItem; duplicate: boolean }> {
  const draft = parseReviewDraft(input.draft);
  if (typeof input.id !== 'string' || !REVIEW_WRITE_ID.test(input.id) || typeof input.writeId !== 'string' || !REVIEW_WRITE_ID.test(input.writeId)
    || !timestamp(input.at) || (input.captureKey !== null && (typeof input.captureKey !== 'string' || !input.captureKey || input.captureKey.length > MAX_CAPTURE_KEY))) {
    throw new Error(REVIEW_INPUT_MESSAGE);
  }
  const captured = draftJSON(draft);
  if (captured.length > MAX_DRAFT_JSON) throw new Error(REVIEW_INPUT_MESSAGE);
  let result: { item: ReviewItem; duplicate: boolean } | null = null;
  await db.withExclusiveTransactionAsync(async tx => {
    const same = await tx.getAllAsync<ItemRow>(`SELECT ${ITEM_COLUMNS} FROM review_items WHERE id = ? OR writeId = ? OR (captureKey IS NOT NULL AND captureKey = ?)`,
      input.id, input.writeId, input.captureKey);
    if (same.length) {
      const row = same[0];
      if (same.length === 1 && row.id === input.id && row.writeId === input.writeId && row.captureKey === input.captureKey && row.capturedJSON === captured) {
        result = { item: itemFromRow(row), duplicate: true };
        return;
      }
      throw new Error(REVIEW_CAPTURE_CONFLICT_MESSAGE);
    }
    await tx.runAsync(`INSERT INTO review_items (${ITEM_COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', NULL, NULL, ?, ?, 0)`,
      input.id, draft.source, input.captureKey, captured, draft.version, captured, input.writeId, input.at, input.at);
    result = { item: { id: input.id, source: draft.source, captureKey: input.captureKey, draft, writeId: input.writeId, status: 'pending', attempt: null, receipt: null,
      createdAt: input.at, updatedAt: input.at, revision: 0 }, duplicate: false };
  });
  return result!;
}

// ---- the ledger side: is the frozen write there? ------------------------------------------------------------------------

/** What the ledger holds under an item's write id: nothing (`absent`), its frozen write (`committed`, after later edits,
 * an undo or a stop included), or something else (`conflict`: another kind, other content, or a write this item never
 * froze). */
export type LedgerWriteState = 'absent' | 'committed' | 'conflict';

/** The movement as it was first recorded: the record itself while unedited, otherwise the `before` of its first change
 * (the audit receipts keep every version). */
async function originalEntry(ledger: SqlExecutor, archive: LedgerArchive, id: string): Promise<Entry | null> {
  const record = archive.records.find(item => item.entry.id === id);
  if (!record) return null;
  if (record.revision === 0) return record.entry;
  const changes = await ledger.getAllAsync<{ beforeJSON: string }>('SELECT beforeJSON FROM entry_changes WHERE entryId = ?', id);
  for (const change of changes) {
    const before = JSON.parse(change.beforeJSON) as EntryRecord;
    if (before.revision === 0 && before.entry?.id === id) return before.entry;
  }
  return null;
}

export async function ledgerWriteState(ledger: SqlExecutor, archive: LedgerArchive, item: Pick<ReviewItem, 'writeId' | 'attempt'>): Promise<LedgerWriteState> {
  const owners = ledgerIdOwners(archive, item.writeId);
  if (!owners.length) return 'absent';
  const attempt = item.attempt;
  if (!attempt || owners.length !== 1 || owners[0] !== attempt.type) return 'conflict';
  if (attempt.type === 'entry') {
    const original = await originalEntry(ledger, archive, item.writeId);
    return original && sameEntry(original, attempt.entry) ? 'committed' : 'conflict';
  }
  const plan = (archive.installmentPlans ?? []).find(row => row.id === item.writeId)!;
  // A plan's lifecycle (stopped, reactivated, deleted) moves after it is written; its identity, money and calendar never do.
  const frozen = { ...attempt.plan, cancelledAt: plan.cancelledAt, deleted: plan.deleted, revision: plan.revision, updatedAt: plan.updatedAt };
  return sameInstallmentPlan(plan, frozen) ? 'committed' : 'conflict';
}

// ---- transitions -------------------------------------------------------------------------------------------------------

async function pendingItem(db: SqlExecutor, id: string, expectedRevision: number): Promise<ReviewItem> {
  const row = await readRow(db, id);
  if (!row) throw new Error(REVIEW_ITEM_MISSING_MESSAGE);
  const item = itemFromRow(row);
  if (item.status !== 'pending') throw new Error(REVIEW_ITEM_CLOSED_MESSAGE);
  if (item.revision !== expectedRevision) throw new Error(REVIEW_ITEM_CHANGED_MESSAGE);
  return item;
}
async function save(db: ReviewDatabase, item: ReviewItem, before: ReviewItem): Promise<ReviewItem> {
  await db.withExclusiveTransactionAsync(tx => writeItem(tx, item, before));
  return item;
}
const confirmed = (item: ReviewItem, attempt: ReviewWrite, how: ReviewReceipt['how'], at: string) =>
  next(item, at, { status: 'confirmed', attempt, receipt: { type: attempt.type, writeId: item.writeId, how, at } });

/** Settles a frozen write before the item changes: the ledger has it → the item is confirmed (`reconciled`) and returned;
 * the ledger does not → the frozen write is released (it never landed) and the item stays pending; a conflict is
 * refused and nothing changes. No frozen write → nothing to settle. */
async function settle(db: ReviewDatabase, ledger: LedgerDatabase, item: ReviewItem, at: string): Promise<ReviewItem> {
  if (!item.attempt) return item;
  const state = await ledgerWriteState(ledger, await readArchive(ledger), item);
  if (state === 'conflict') throw new Error(REVIEW_WRITE_CONFLICT_MESSAGE);
  return save(db, state === 'committed' ? confirmed(item, item.attempt, 'reconciled', at) : next(item, at, { attempt: null }), item);
}

/** Replaces a pending item's draft (an edit in the tray), keeping its id, source and write id. The new draft is parsed
 * strictly and must keep the item's source. A frozen write is settled first: if it reached the ledger, the item is
 * confirmed instead and the edit is refused (`REVIEW_ITEM_CLOSED_MESSAGE`). */
export async function updateReviewDraft(db: ReviewDatabase, ledger: LedgerDatabase, id: string, expectedRevision: number, value: unknown, at: string): Promise<ReviewItem> {
  const draft = parseReviewDraft(value);
  if (!timestamp(at) || draftJSON(draft).length > MAX_DRAFT_JSON) throw new Error(REVIEW_INPUT_MESSAGE);
  const item = await settle(db, ledger, await pendingItem(db, id, expectedRevision), at);
  if (item.status !== 'pending') throw new Error(REVIEW_ITEM_CLOSED_MESSAGE);
  if (draft.source !== item.source) throw new Error(REVIEW_INPUT_MESSAGE);
  return save(db, next(item, at, { draft }), item);
}

/** Dismisses a pending item (a tombstone: the row stays, never pending again). A frozen write is settled first: if it
 * reached the ledger, the item is confirmed instead and the dismissal is refused. */
export async function dismissReviewItem(db: ReviewDatabase, ledger: LedgerDatabase, id: string, expectedRevision: number, at: string): Promise<ReviewItem> {
  if (!timestamp(at)) throw new Error(REVIEW_INPUT_MESSAGE);
  const item = await settle(db, ledger, await pendingItem(db, id, expectedRevision), at);
  if (item.status !== 'pending') throw new Error(REVIEW_ITEM_CLOSED_MESSAGE);
  return save(db, next(item, at, { status: 'dismissed' }), item);
}

export interface ReviewConfirmation {
  item: ReviewItem;
  /** The catch-up banner when a plan's first instalments could not be recognised right away (the plan is saved). */
  warning: string | null;
  /** False when the ledger write landed but the item could not be marked: it stays pending with its frozen write, and the
   * next reconciliation confirms it. The movement is saved either way; never report this as a failure. */
  recorded: boolean;
}

/** Confirms a pending item: its one write reaches the ledger once.
 * 1. The item must be pending at `expectedRevision` (the version the person saw).
 * 2. The ledger is read. Its write already there → the item is confirmed (`reconciled`), nothing is written; another
 *    kind or other content under the id → `REVIEW_WRITE_CONFLICT_MESSAGE`, nothing changes.
 * 3. Otherwise the write is the frozen one (an interrupted attempt is retried exactly), or is built now by
 *    `writeForReviewDraft` (gaps, a stale basis or an invalid draft refuse here, nothing stored) and frozen on the item in
 *    its own commit before the ledger is asked.
 * 4. `createEntry`, or `savePurchasePlan` for cuotas. Success → the item is confirmed (`confirmed`). Failure → the ledger
 *    is read again: the write there → confirmed; not there → the frozen write is released and the error is thrown with
 *    the draft kept; the ledger unreadable → the error is thrown and the frozen write stays for reconciliation. */
export async function confirmReviewItem(db: ReviewDatabase, ledger: LedgerDatabase, id: string,
  options: { expectedRevision: number; todayISO: string; at: string }): Promise<ReviewConfirmation> {
  if (!timestamp(options.at)) throw new Error(REVIEW_INPUT_MESSAGE);
  let item = await pendingItem(db, id, options.expectedRevision);
  const archive = await readArchive(ledger);
  const state = await ledgerWriteState(ledger, archive, item);
  if (state === 'conflict') throw new Error(REVIEW_WRITE_CONFLICT_MESSAGE);
  if (state === 'committed') {
    try { return { item: await save(db, confirmed(item, item.attempt!, 'reconciled', options.at), item), warning: null, recorded: true }; }
    catch { return { item, warning: null, recorded: false }; } // Already in the ledger: never a failure; the next reconcile marks it.
  }
  if (!item.attempt) {
    const write = writeForReviewDraft(item.draft, archive, { writeId: item.writeId, createdAt: options.at, todayISO: options.todayISO });
    item = await save(db, next(item, options.at, { attempt: write }), item);
  }
  const attempt = item.attempt!;
  let warning: string | null = null;
  try {
    if (attempt.type === 'entry') await createEntry(ledger, attempt.entry);
    else warning = await savePurchasePlan(ledger, attempt.plan, options.todayISO);
  } catch (cause) {
    let after: LedgerWriteState;
    try { after = await ledgerWriteState(ledger, await readArchive(ledger), item); }
    catch { throw cause; } // Unknown outcome: the frozen write stays for reconciliation.
    if (after !== 'committed') {
      if (after === 'absent') { try { await save(db, next(item, options.at, { attempt: null }), item); } catch { /* Released at the next settle. */ } }
      throw cause;
    }
  }
  try {
    return { item: await save(db, confirmed(item, attempt, 'confirmed', options.at), item), warning, recorded: true };
  } catch {
    return { item, warning, recorded: false };
  }
}

export interface ReviewReconciliation { confirmed: string[]; released: string[]; conflicts: string[]; unreadable: string[] }

/** After a launch or an interruption: every pending item is checked against the ledger. A frozen write the ledger holds
 * confirms its item (`reconciled`); one it does not hold is released (it never landed; the draft stays pending); an id
 * the ledger holds with other content or another kind is reported as a conflict and left as it is; an unreadable row is
 * reported and left as it is. Run it when no confirmation is in flight (a store's queue guarantees that). */
export async function reconcileReviewItems(db: ReviewDatabase, ledger: LedgerDatabase, at: string): Promise<ReviewReconciliation> {
  if (!timestamp(at)) throw new Error(REVIEW_INPUT_MESSAGE);
  const report: ReviewReconciliation = { confirmed: [], released: [], conflicts: [], unreadable: [] };
  const { items, unreadable } = await listPendingReviewItems(db);
  report.unreadable.push(...unreadable);
  const archive = await readArchive(ledger);
  for (const item of items) {
    const state = await ledgerWriteState(ledger, archive, item);
    if (state === 'conflict') { report.conflicts.push(item.id); continue; }
    if (!item.attempt) continue;
    if (state === 'committed') { await save(db, confirmed(item, item.attempt, 'reconciled', at), item); report.confirmed.push(item.id); }
    else { await save(db, next(item, at, { attempt: null }), item); report.released.push(item.id); }
  }
  return report;
}

// ---- the store -----------------------------------------------------------------------------------------------------------

export interface ReviewStore {
  readonly writable: boolean;
  capture(input: ReviewCapture): Promise<{ item: ReviewItem; duplicate: boolean }>;
  get(id: string): Promise<ReviewItem | null>;
  listPending(): Promise<{ items: ReviewItem[]; unreadable: string[] }>;
  updateDraft(id: string, expectedRevision: number, draft: unknown, at: string): Promise<ReviewItem>;
  dismiss(id: string, expectedRevision: number, at: string): Promise<ReviewItem>;
  confirm(id: string, options: { expectedRevision: number; todayISO: string; at: string }): Promise<ReviewConfirmation>;
  reconcile(at: string): Promise<ReviewReconciliation>;
}

/** Initializes the review file and returns its operations, run one at a time in call order. A file from a newer build is
 * readable and every write is refused (`REVIEW_READ_ONLY_MESSAGE`). Initialization errors propagate: the caller shows the
 * ledger without a review tray, and never resets either file. */
let tail: Promise<unknown> = Promise.resolve();
/** One queue for every store of this process (the app has one review file): a second store opened over the same file,
 * a remount for instance, never settles or reconciles an item while another store's confirmation of it is in flight. */
function serial<T>(work: () => Promise<T>): Promise<T> {
  const run = tail.then(work, work);
  tail = run.catch(() => undefined);
  return run;
}

export async function openReviewStore(db: ReviewDatabase, ledger: LedgerDatabase): Promise<ReviewStore> {
  const { writable } = await serial(() => initializeReviewDatabase(db));
  const write = <T>(work: () => Promise<T>): Promise<T> => serial(() => {
    if (!writable) throw new Error(REVIEW_READ_ONLY_MESSAGE);
    return work();
  });
  return {
    writable,
    capture: input => write(() => captureReviewItem(db, input)),
    get: id => serial(() => getReviewItem(db, id)),
    listPending: () => serial(() => listPendingReviewItems(db)),
    updateDraft: (id, expectedRevision, draft, at) => write(() => updateReviewDraft(db, ledger, id, expectedRevision, draft, at)),
    dismiss: (id, expectedRevision, at) => write(() => dismissReviewItem(db, ledger, id, expectedRevision, at)),
    confirm: (id, options) => write(() => confirmReviewItem(db, ledger, id, options)),
    reconcile: at => write(() => reconcileReviewItems(db, ledger, at)),
  };
}
