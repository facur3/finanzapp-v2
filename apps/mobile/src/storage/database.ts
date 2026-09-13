import {
  initialRecord, previewBackupImport, sameAccount, sameEntry, sameRecord, snapshotFromArchive,
  totalsByCurrency, validateAccount, validateArchive, validateEntry, validateEntryChange,
  type Account, type Entry, type EntryChange, type EntryRecord, type LedgerArchive, type LedgerSnapshot,
  accountBalanceMinor, validateAccountChange, type AccountChange, initialTransferRecord, sameTransferRecord,
  sameTransfer, validateTransfer, validateTransferChange, type Transfer, type TransferChange, type TransferRecord,
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
export const DATABASE_VERSION = 3;

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

const MIGRATE_V3 = `
  ALTER TABLE accounts ADD COLUMN revision INTEGER NOT NULL DEFAULT 0 CHECK(revision >= 0 AND revision <= 9007199254740991);
  ALTER TABLE accounts ADD COLUMN updatedAt TEXT NOT NULL DEFAULT '';
  UPDATE accounts SET updatedAt = createdAt;
  CREATE TABLE account_changes (
    id TEXT PRIMARY KEY NOT NULL, accountId TEXT NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
    beforeJSON TEXT NOT NULL, afterJSON TEXT NOT NULL, expectedBalanceMinor INTEGER
  ) STRICT;
  CREATE TABLE transfers (
    id TEXT PRIMARY KEY NOT NULL,
    fromAccountId TEXT NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
    toAccountId TEXT NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT CHECK(toAccountId != fromAccountId),
    amountMinor INTEGER NOT NULL CHECK(amountMinor > 0 AND amountMinor <= 9007199254740991),
    note TEXT NOT NULL CHECK(length(note) <= 120), dateISO TEXT NOT NULL, createdAt TEXT NOT NULL,
    revision INTEGER NOT NULL DEFAULT 0 CHECK(revision >= 0 AND revision <= 9007199254740991),
    voided INTEGER NOT NULL DEFAULT 0 CHECK(voided IN (0, 1)), updatedAt TEXT NOT NULL
  ) STRICT;
  CREATE INDEX transfers_from ON transfers(fromAccountId);
  CREATE INDEX transfers_to ON transfers(toAccountId);
  CREATE INDEX transfers_date ON transfers(dateISO DESC, createdAt DESC);
  CREATE TABLE transfer_changes (
    id TEXT PRIMARY KEY NOT NULL, transferId TEXT NOT NULL REFERENCES transfers(id) ON DELETE RESTRICT,
    action TEXT NOT NULL CHECK(action IN ('edit', 'void', 'restore')), beforeJSON TEXT NOT NULL, afterJSON TEXT NOT NULL
  ) STRICT;
  PRAGMA user_version = 3;
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
    if (version < 3) await tx.execAsync(MIGRATE_V3);
  });
  await readSnapshot(db); // Validate before showing a balance, not after a render.
}

export async function readSnapshot(db: SqlExecutor): Promise<LedgerSnapshot> {
  return snapshotFromArchive(await readArchive(db));
}

export async function readArchive(db: SqlExecutor): Promise<LedgerArchive> {
  const accountRows = await db.getAllAsync<Account>('SELECT * FROM accounts ORDER BY createdAt, id');
  const accounts = accountRows.map(row => {
    validateAccount(row);
    const { revision, updatedAt, ...account } = row;
    return revision === 0 ? account : row;
  });
  const rows = await db.getAllAsync<Entry & { revision: number; voided: number; updatedAt: string }>(
    'SELECT * FROM entries ORDER BY dateISO DESC, createdAt DESC, id DESC');
  const records = rows.map(({ revision, voided, updatedAt, ...entry }) => {
    if (voided !== 0 && voided !== 1) throw new Error('Estado de movimiento inválido.');
    return { entry, revision, voided: voided === 1, updatedAt };
  });
  const transferRows = await db.getAllAsync<Transfer & { revision: number; voided: number; updatedAt: string }>(
    'SELECT * FROM transfers ORDER BY dateISO DESC, createdAt DESC, id DESC');
  const transfers = transferRows.map(({ revision, voided, updatedAt, ...transfer }) => {
    if (voided !== 0 && voided !== 1) throw new Error('Estado de transferencia inválido.');
    return { transfer, revision, voided: voided === 1, updatedAt };
  });
  const archive = { accounts, records, ...(transfers.length ? { transfers } : {}) };
  validateArchive(archive); // Including tombstones and safe integer totals.
  return archive;
}

export async function createAccount(db: LedgerDatabase, input: Account): Promise<void> {
  const account = { ...input, name: input.name.trim() };
  validateAccount(account);
  if ((account.revision ?? 0) !== 0) throw new Error('Una cuenta nueva no puede tener correcciones previas.');
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
      'INSERT INTO accounts (id, name, currency, openingMinor, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
      account.id, account.name, account.currency, account.openingMinor, account.createdAt, account.createdAt,
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
    if (!plan.accounts.length && !plan.records.length && !plan.transfers.length) return; // Re-import or retry after commit: already present.
    if (plan.baseline !== baseline) throw new Error('Tus datos cambiaron. Volvé a revisar la copia antes de importar.');
    for (const account of plan.accounts) {
      await tx.runAsync('INSERT INTO accounts (id, name, currency, openingMinor, createdAt, revision, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
        account.id, account.name, account.currency, account.openingMinor, account.createdAt, account.revision ?? 0, account.updatedAt ?? account.createdAt);
    }
    for (const record of plan.records) await insertRecord(tx, record);
    for (const record of plan.transfers) await insertTransferRecord(tx, record);
    // No existing rows are updated or deleted. Any failure rolls back the batch.
  });
}

export async function changeAccount(db: LedgerDatabase, change: AccountChange): Promise<void> {
  validateAccountChange(change);
  await db.withExclusiveTransactionAsync(async tx => {
    const archive = await readArchive(tx);
    const receipt = await tx.getFirstAsync<{ beforeJSON: string; afterJSON: string; expectedBalanceMinor: number | null }>(
      'SELECT beforeJSON, afterJSON, expectedBalanceMinor FROM account_changes WHERE id = ?', change.id);
    if (receipt) {
      if (!sameAccount(JSON.parse(receipt.beforeJSON), change.before) || !sameAccount(JSON.parse(receipt.afterJSON), change.after)
        || receipt.expectedBalanceMinor !== change.expectedBalanceMinor) throw new Error('Esta operación ya existe con otros datos.');
      return;
    }
    const current = archive.accounts.find(a => a.id === change.before.id);
    const snapshot = snapshotFromArchive(archive);
    if (!current || !sameAccount(current, change.before) || (change.expectedBalanceMinor !== null
      && accountBalanceMinor(current, snapshot.entries, snapshot.transfers) !== change.expectedBalanceMinor)) {
      throw new Error('La cuenta o su saldo cambió. Cerrá el formulario y revisá el saldo actual antes de corregirlo.');
    }
    validateArchive({ ...archive, accounts: archive.accounts.map(a => a.id === current.id ? change.after : a) });
    await tx.runAsync('UPDATE accounts SET name = ?, openingMinor = ?, revision = ?, updatedAt = ? WHERE id = ?',
      change.after.name, change.after.openingMinor, change.after.revision!, change.after.updatedAt!, current.id);
    await tx.runAsync('INSERT INTO account_changes (id, accountId, beforeJSON, afterJSON, expectedBalanceMinor) VALUES (?, ?, ?, ?, ?)',
      change.id, current.id, JSON.stringify(change.before), JSON.stringify(change.after), change.expectedBalanceMinor);
  });
}

async function insertTransferRecord(tx: SqlExecutor, record: TransferRecord): Promise<void> {
  const t = record.transfer;
  await tx.runAsync(`INSERT INTO transfers (id, fromAccountId, toAccountId, amountMinor, note, dateISO, createdAt, revision, voided, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, t.id, t.fromAccountId, t.toAccountId, t.amountMinor, t.note, t.dateISO, t.createdAt,
  record.revision, record.voided ? 1 : 0, record.updatedAt);
}

export async function createTransfer(db: LedgerDatabase, input: Transfer): Promise<void> {
  const transfer = { ...input, note: input.note.trim() };
  await db.withExclusiveTransactionAsync(async tx => {
    const archive = await readArchive(tx);
    validateTransfer(transfer, archive.accounts);
    const existing = archive.transfers?.find(r => r.transfer.id === transfer.id);
    if (existing) {
      if (existing.revision !== 0 || !sameTransfer(existing.transfer, transfer)) throw new Error('Esta transferencia ya existe con otros datos.');
      return;
    }
    const record = initialTransferRecord(transfer);
    validateArchive({ ...archive, transfers: [...archive.transfers ?? [], record] });
    await insertTransferRecord(tx, record);
  });
}

export async function changeTransfer(db: LedgerDatabase, change: TransferChange): Promise<void> {
  await db.withExclusiveTransactionAsync(async tx => {
    const archive = await readArchive(tx);
    validateTransferChange(change, archive.accounts);
    const receipt = await tx.getFirstAsync<{ action: string; beforeJSON: string; afterJSON: string }>(
      'SELECT action, beforeJSON, afterJSON FROM transfer_changes WHERE id = ?', change.id);
    if (receipt) {
      if (receipt.action !== change.action || !sameTransferRecord(JSON.parse(receipt.beforeJSON), change.before)
        || !sameTransferRecord(JSON.parse(receipt.afterJSON), change.after)) throw new Error('Esta operación ya existe con otros datos.');
      return;
    }
    const current = archive.transfers?.find(r => r.transfer.id === change.before.transfer.id);
    if (!current || !sameTransferRecord(current, change.before)) throw new Error('La transferencia cambió. Cerrá el formulario y volvé a abrirla.');
    validateArchive({ ...archive, transfers: archive.transfers!.map(r => r === current ? change.after : r) });
    const { transfer: t, revision, voided, updatedAt } = change.after;
    await tx.runAsync(`UPDATE transfers SET fromAccountId = ?, toAccountId = ?, amountMinor = ?, note = ?, dateISO = ?,
      revision = ?, voided = ?, updatedAt = ? WHERE id = ?`, t.fromAccountId, t.toAccountId, t.amountMinor, t.note, t.dateISO,
    revision, voided ? 1 : 0, updatedAt, t.id);
    await tx.runAsync('INSERT INTO transfer_changes (id, transferId, action, beforeJSON, afterJSON) VALUES (?, ?, ?, ?, ?)',
      change.id, t.id, change.action, JSON.stringify(change.before), JSON.stringify(change.after));
  });
}
