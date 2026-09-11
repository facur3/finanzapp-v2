import {
  totalsByCurrency, validateAccount, validateEntry,
  type Account, type Entry, type LedgerSnapshot,
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
export const DATABASE_VERSION = 1;

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
  });
  await readSnapshot(db); // Validate before showing a balance, not after a render.
}

export async function readSnapshot(db: SqlExecutor): Promise<LedgerSnapshot> {
  const accounts = await db.getAllAsync<Account>('SELECT * FROM accounts ORDER BY createdAt, id');
  const entries = await db.getAllAsync<Entry>('SELECT * FROM entries ORDER BY dateISO DESC, createdAt DESC, id DESC');
  accounts.forEach(validateAccount);
  entries.forEach(entry => validateEntry(entry, accounts));
  const snapshot = { accounts, entries };
  totalsByCurrency(snapshot); // Check safe integer totals, never display a rounded overflow.
  return snapshot;
}

export async function createAccount(db: LedgerDatabase, input: Account): Promise<void> {
  const account = { ...input, name: input.name.trim() };
  validateAccount(account);
  await db.withExclusiveTransactionAsync(async tx => {
    const existing = await tx.getFirstAsync<Account>('SELECT * FROM accounts WHERE id = ?', account.id);
    if (existing) {
      if (Object.keys(account).some(key => existing[key as keyof Account] !== account[key as keyof Account])) {
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
    const snapshot = await readSnapshot(tx);
    validateEntry(entry, snapshot.accounts);
    const existing = snapshot.entries.find(item => item.id === entry.id);
    if (existing) {
      if (Object.keys(entry).some(key => existing[key as keyof Entry] !== entry[key as keyof Entry])) {
        throw new Error('Esta operación ya existe con otros datos. Revisá tus movimientos.');
      }
      return;
    }
    totalsByCurrency({ ...snapshot, entries: [...snapshot.entries, entry] });
    await tx.runAsync(
      `INSERT INTO entries (id, accountId, kind, amountMinor, merchant, category, dateISO, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      entry.id, entry.accountId, entry.kind, entry.amountMinor,
      entry.merchant, entry.category, entry.dateISO, entry.createdAt,
    );
  });
}
