import {
  initialRecord, previewBackupImport, sameAccount, sameEntry, sameRecord, snapshotFromArchive,
  totalsByCurrency, validateAccount, validateArchive, validateEntry, validateEntryChange,
  type Account, type Entry, type EntryChange, type EntryRecord, type LedgerArchive, type LedgerSnapshot,
} from '@finanzapp/domain';

type SqlValue = string | number | null;
export interface SqlExecutor {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, ...params: SqlValue[]): Promise<{ changes: number }>;
  getFirstAsync<T>(sql: string, ...params: SqlValue[]): Promise<T | null>;
  getAllAsync<T>(sql: string, ...params: SqlValue[]): Promise<T[]>;
}
export interface LedgerDatabase extends SqlExecutor {
  withExclusiveTransactionAsync(task: (tx: SqlExecutor) => Promise<void>): Promise<void>;
}

export const DATABASE_NAME = 'finanzapp-native-pilot-v1.sqlite';
export const DATABASE_VERSION = 2;

const SCHEMA = `
  CREATE TABLE accounts (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 80),
    currency TEXT NOT NULL CHECK(currency IN ('ARS', 'USD')),
    openingMinor INTEGER NOT NULL CHECK(abs(openingMinor) <= 9007199254740991),
    createdAt TEXT NOT NULL
  ) STRICT;
  CREATE TABLE entries (
    id TEXT PRIMARY KEY NOT NULL,
    accountId TEXT NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
    kind TEXT NOT NULL CHECK(kind IN ('expense', 'income')),
    amountMinor INTEGER NOT NULL CHECK(amountMinor > 0 AND amountMinor <= 9007199254740991),
    merchant TEXT NOT NULL CHECK(length(trim(merchant)) BETWEEN 1 AND 120),
    category TEXT NOT NULL CHECK(length(trim(category)) BETWEEN 1 AND 60),
    dateISO TEXT NOT NULL,
    createdAt TEXT NOT NULL
  ) STRICT;
  CREATE INDEX entries_account ON entries(accountId);
  CREATE INDEX entries_date ON entries(dateISO DESC, createdAt DESC);
  PRAGMA user_version = 1;
`;

const MIGRATE_V2 = `
  ALTER TABLE entries ADD COLUMN revision INTEGER NOT NULL DEFAULT 0 CHECK(revision >= 0 AND revision <= 9007199254740991);
  ALTER TABLE entries ADD COLUMN voided INTEGER NOT NULL DEFAULT 0 CHECK(voided IN (0, 1));
  ALTER TABLE entries ADD COLUMN updatedAt TEXT NOT NULL DEFAULT '';
  UPDATE entries SET updatedAt = createdAt;
  CREATE TABLE entry_changes (
    id TEXT PRIMARY KEY NOT NULL,
    entryId TEXT NOT NULL REFERENCES entries(id) ON DELETE RESTRICT,
    action TEXT NOT NULL CHECK(action IN ('edit', 'void', 'restore')),
    beforeJSON TEXT NOT NULL,
    afterJSON TEXT NOT NULL
  ) STRICT;
  PRAGMA user_version = 2;
`;

export async function initializeDatabase(db: LedgerDatabase): Promise<void> {
  // Set before opening a transaction; foreign_keys is connection-local.
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  await db.withExclusiveTransactionAsync(async tx => {
    const row = await tx.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    const version = row?.user_version ?? 0;
    if (version > DATABASE_VERSION) {
      throw new Error('Estos datos requieren una versión más nueva de FinanzApp. No se modificaron.');
    }
    if (version === 0) await tx.execAsync(SCHEMA);
    if (version < 2) await tx.execAsync(MIGRATE_V2);
  });
  await readSnapshot(db); // Validate before showing a balance, not after a render.
}

export async function readSnapshot(db: SqlExecutor): Promise<LedgerSnapshot> {
  return snapshotFromArchive(await readArchive(db));
}

export async function readArchive(db: SqlExecutor): Promise<LedgerArchive> {
  const accounts = await db.getAllAsync<Account>('SELECT * FROM accounts ORDER BY createdAt, id');
  const rows = await db.getAllAsync<Entry & { revision: number; voided: number; updatedAt: string }>(
    'SELECT * FROM entries ORDER BY dateISO DESC, createdAt DESC, id DESC');
  const records = rows.map(({ revision, voided, updatedAt, ...entry }) => {
    if (voided !== 0 && voided !== 1) throw new Error('Estado de movimiento inválido.');
    return { entry, revision, voided: voided === 1, updatedAt };
  });
  const archive = { accounts, records };
  validateArchive(archive); // Including tombstones and safe integer totals.
  return archive;
}

export async function createAccount(db: LedgerDatabase, input: Account): Promise<void> {
  const account = { ...input, name: input.name.trim() };
  validateAccount(account);
  await db.withExclusiveTransactionAsync(async tx => {
    const existing = await tx.getFirstAsync<Account>('SELECT * FROM accounts WHERE id = ?', account.id);
    if (existing) {
      if (!sameAccount(existing, account)) {
        throw new Error('Esta operación ya existe con otros datos. Volvé a abrir el formulario.');
      }
      return; // Retrying a committed operation is safe.
    }
    const snapshot = await readSnapshot(tx);
    totalsByCurrency({ ...snapshot, accounts: [...snapshot.accounts, account] });
    await tx.runAsync(
      'INSERT INTO accounts (id, name, currency, openingMinor, createdAt) VALUES (?, ?, ?, ?, ?)',
      account.id, account.name, account.currency, account.openingMinor, account.createdAt,
    );
  });
}

export async function createEntry(db: LedgerDatabase, input: Entry): Promise<void> {
  const entry = { ...input, merchant: input.merchant.trim(), category: input.category.trim() };
  await db.withExclusiveTransactionAsync(async tx => {
    const archive = await readArchive(tx);
    const snapshot = snapshotFromArchive(archive);
    validateEntry(entry, snapshot.accounts);
    const existing = archive.records.find(item => item.entry.id === entry.id);
    if (existing) {
      if (existing.revision !== 0 || !sameEntry(existing.entry, entry)) {
        throw new Error('Esta operación ya existe con otros datos. Revisá tus movimientos.');
      }
      return;
    }
    totalsByCurrency({ ...snapshot, entries: [...snapshot.entries, entry] });
    await insertRecord(tx, initialRecord(entry));
  });
}

async function insertRecord(tx: SqlExecutor, record: EntryRecord): Promise<void> {
  const entry = record.entry;
  await tx.runAsync(`INSERT INTO entries (id, accountId, kind, amountMinor, merchant, category, dateISO, createdAt, revision, voided, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, entry.id, entry.accountId, entry.kind, entry.amountMinor,
  entry.merchant, entry.category, entry.dateISO, entry.createdAt, record.revision, record.voided ? 1 : 0, record.updatedAt);
}

/** Record the edit/reversal and its audit receipt in the SAME durable commit. */
export async function changeEntry(db: LedgerDatabase, change: EntryChange): Promise<void> {
  await db.withExclusiveTransactionAsync(async tx => {
    const archive = await readArchive(tx);
    validateEntryChange(change, archive.accounts);
    const beforeJSON = JSON.stringify(change.before), afterJSON = JSON.stringify(change.after);
    const receipt = await tx.getFirstAsync<{ action: string; beforeJSON: string; afterJSON: string }>(
      'SELECT action, beforeJSON, afterJSON FROM entry_changes WHERE id = ?', change.id);
    if (receipt) {
      if (receipt.action !== change.action || !sameRecord(JSON.parse(receipt.beforeJSON), change.before)
        || !sameRecord(JSON.parse(receipt.afterJSON), change.after)) throw new Error('Esta operación ya existe con otros datos. Volvé a abrir el movimiento.');
      return; // A refresh failed after the commit. Never apply the debit twice.
    }
    const current = archive.records.find(record => record.entry.id === change.before.entry.id);
    if (!current || !sameRecord(current, change.before)) {
      throw new Error('El movimiento cambió desde que lo abriste. Cerrá este formulario y revisá la versión actual.');
    }
    validateArchive({ ...archive, records: archive.records.map(record => record === current ? change.after : record) });
    const { entry, revision, voided, updatedAt } = change.after;
    await tx.runAsync(`UPDATE entries SET accountId = ?, kind = ?, amountMinor = ?, merchant = ?, category = ?, dateISO = ?,
      revision = ?, voided = ?, updatedAt = ? WHERE id = ?`, entry.accountId, entry.kind, entry.amountMinor, entry.merchant,
    entry.category, entry.dateISO, revision, voided ? 1 : 0, updatedAt, entry.id);
    await tx.runAsync('INSERT INTO entry_changes (id, entryId, action, beforeJSON, afterJSON) VALUES (?, ?, ?, ?, ?)',
      change.id, entry.id, change.action, beforeJSON, afterJSON);
  });
}

export async function importArchive(db: LedgerDatabase, incoming: LedgerArchive, baseline: string): Promise<void> {
  await db.withExclusiveTransactionAsync(async tx => {
    const current = await readArchive(tx);
    const plan = previewBackupImport(current, incoming);
    if (plan.conflicts) throw new Error('La copia contradice cambios locales. No se importó nada. Conservá ambas versiones.');
    if (!plan.accounts.length && !plan.records.length) return; // Re-import or retry after commit: already present.
    if (plan.baseline !== baseline) throw new Error('Tus datos cambiaron. Volvé a revisar la copia antes de importar.');
    for (const account of plan.accounts) {
      await tx.runAsync('INSERT INTO accounts (id, name, currency, openingMinor, createdAt) VALUES (?, ?, ?, ?, ?)',
        account.id, account.name, account.currency, account.openingMinor, account.createdAt);
    }
    for (const record of plan.records) await insertRecord(tx, record);
    // No existing rows are updated or deleted. Any failure rolls back the batch.
  });
}
