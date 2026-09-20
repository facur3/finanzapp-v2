import {
  initialRecord, previewBackupImport, sameAccount, sameEntry, sameRecord, snapshotFromArchive,
  totalsByCurrency, validateAccount, validateArchive, validateEntry, validateEntryChange,
  type Account, type Entry, type EntryChange, type EntryRecord, type LedgerArchive, type LedgerSnapshot,
  accountBalanceMinor, validateAccountChange, type AccountChange, initialTransferRecord, sameTransferRecord,
  sameTransfer, validateTransfer, validateTransferChange, type Transfer, type TransferChange, type TransferRecord,
  materializeRecurringRule, sameRecurringRule, validateRecurringRule, type RecurringRule,
  sameMonthlyBudget, validateMonthlyBudget, type MonthlyBudget,
  assertPostingAccount, sameCreditCardProfile, samePersonalDebtProfile, validateCreditCardProfile, validatePersonalDebtProfile,
  type CreditCardProfile, type PersonalDebtProfile,
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
export const DATABASE_VERSION = 6;

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

const MIGRATE_V4 = `
  CREATE TABLE recurring_rules (
    id TEXT PRIMARY KEY NOT NULL,
    accountId TEXT NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
    kind TEXT NOT NULL CHECK(kind IN ('expense', 'income')),
    amountMinor INTEGER NOT NULL CHECK(amountMinor > 0 AND amountMinor <= 9007199254740991),
    merchant TEXT NOT NULL CHECK(length(trim(merchant)) BETWEEN 1 AND 120),
    category TEXT NOT NULL CHECK(length(trim(category)) BETWEEN 1 AND 60),
    frequency TEXT NOT NULL CHECK(frequency IN ('weekly', 'monthly', 'yearly')),
    anchorDateISO TEXT NOT NULL,
    nextDateISO TEXT NOT NULL,
    active INTEGER NOT NULL CHECK(active IN (0, 1)),
    createdAt TEXT NOT NULL,
    revision INTEGER NOT NULL DEFAULT 0 CHECK(revision >= 0 AND revision <= 9007199254740991),
    updatedAt TEXT NOT NULL
  ) STRICT;
  CREATE INDEX recurring_next ON recurring_rules(active, nextDateISO);
  CREATE INDEX recurring_account ON recurring_rules(accountId);
  PRAGMA user_version = 4;
`;

const MIGRATE_V5 = `
  CREATE TABLE monthly_budgets (
    id TEXT PRIMARY KEY NOT NULL,
    category TEXT NOT NULL CHECK(length(trim(category)) BETWEEN 1 AND 60),
    currency TEXT NOT NULL CHECK(currency IN ('ARS', 'USD')),
    monthISO TEXT NOT NULL,
    amountMinor INTEGER NOT NULL CHECK(amountMinor > 0 AND amountMinor <= 9007199254740991),
    active INTEGER NOT NULL CHECK(active IN (0, 1)),
    createdAt TEXT NOT NULL,
    revision INTEGER NOT NULL DEFAULT 0 CHECK(revision >= 0 AND revision <= 9007199254740991),
    updatedAt TEXT NOT NULL
  ) STRICT;
  CREATE INDEX budgets_period ON monthly_budgets(currency, monthISO, active);
  PRAGMA user_version = 5;
`;

// Cards and personal debts are profiles over hidden internal accounts. Their
// balances live in the same accounts/entries/transfers tables, so every
// existing balance, audit and backup invariant applies to them unchanged.
const MIGRATE_V6 = `
  CREATE TABLE credit_cards (
    id TEXT PRIMARY KEY NOT NULL,
    accountId TEXT NOT NULL UNIQUE REFERENCES accounts(id) ON DELETE RESTRICT,
    issuer TEXT NOT NULL CHECK(length(issuer) <= 80),
    last4 TEXT NOT NULL CHECK(last4 = '' OR (length(last4) = 4 AND last4 NOT GLOB '*[^0-9]*')),
    creditLimitMinor INTEGER CHECK(creditLimitMinor IS NULL OR (creditLimitMinor > 0 AND creditLimitMinor <= 9007199254740991)),
    closingDay INTEGER NOT NULL CHECK(closingDay BETWEEN 1 AND 31),
    dueDay INTEGER NOT NULL CHECK(dueDay BETWEEN 1 AND 31),
    active INTEGER NOT NULL CHECK(active IN (0, 1)),
    createdAt TEXT NOT NULL,
    revision INTEGER NOT NULL DEFAULT 0 CHECK(revision >= 0 AND revision <= 9007199254740991),
    updatedAt TEXT NOT NULL
  ) STRICT;
  CREATE INDEX cards_active ON credit_cards(active, createdAt);
  CREATE TABLE personal_debts (
    id TEXT PRIMARY KEY NOT NULL,
    accountId TEXT NOT NULL UNIQUE REFERENCES accounts(id) ON DELETE RESTRICT,
    direction TEXT NOT NULL CHECK(direction IN ('owed_by_me', 'owed_to_me')),
    counterparty TEXT NOT NULL CHECK(length(trim(counterparty)) BETWEEN 1 AND 80),
    dueDateISO TEXT,
    note TEXT NOT NULL CHECK(length(note) <= 120),
    active INTEGER NOT NULL CHECK(active IN (0, 1)),
    createdAt TEXT NOT NULL,
    revision INTEGER NOT NULL DEFAULT 0 CHECK(revision >= 0 AND revision <= 9007199254740991),
    updatedAt TEXT NOT NULL
  ) STRICT;
  CREATE INDEX debts_active_due ON personal_debts(active, dueDateISO);
  PRAGMA user_version = 6;
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
    if (version < 4) await tx.execAsync(MIGRATE_V4);
    if (version < 5) await tx.execAsync(MIGRATE_V5);
    if (version < 6) await tx.execAsync(MIGRATE_V6);
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
  const recurringRows = await db.getAllAsync<Omit<RecurringRule, 'active'> & { active: number }>(
    'SELECT * FROM recurring_rules ORDER BY active DESC, nextDateISO, createdAt, id');
  const recurring = recurringRows.map(({ active, ...row }) => {
    if (active !== 0 && active !== 1) throw new Error('Estado de recurrente inválido.');
    const rule = { ...row, active: active === 1 };
    validateRecurringRule(rule, accounts);
    return rule;
  });
  const budgetRows = await db.getAllAsync<Omit<MonthlyBudget, 'active'> & { active: number }>(
    'SELECT * FROM monthly_budgets ORDER BY monthISO DESC, currency, category, createdAt, id');
  const budgets = budgetRows.map(({ active, ...row }) => {
    if (active !== 0 && active !== 1) throw new Error('Estado de presupuesto inválido.');
    const budget = { ...row, active: active === 1 };
    validateMonthlyBudget(budget);
    return budget;
  });
  const cardRows = await db.getAllAsync<Omit<CreditCardProfile, 'active'> & { active: number }>(
    'SELECT * FROM credit_cards ORDER BY active DESC, createdAt, id');
  const cards = cardRows.map(({ active, ...row }) => {
    if (active !== 0 && active !== 1) throw new Error('Estado de tarjeta inválido.');
    const card = { ...row, active: active === 1 };
    validateCreditCardProfile(card, accounts);
    return card;
  });
  const debtRows = await db.getAllAsync<Omit<PersonalDebtProfile, 'active'> & { active: number }>(
    'SELECT * FROM personal_debts ORDER BY active DESC, dueDateISO, createdAt, id');
  const debts = debtRows.map(({ active, ...row }) => {
    if (active !== 0 && active !== 1) throw new Error('Estado de deuda inválido.');
    const debt = { ...row, active: active === 1 };
    validatePersonalDebtProfile(debt, accounts);
    return debt;
  });
  const archive = {
    accounts,
    records,
    ...(transfers.length ? { transfers } : {}),
    ...(recurring.length ? { recurring } : {}),
    ...(budgets.length ? { budgets } : {}),
    ...(cards.length ? { cards } : {}),
    ...(debts.length ? { debts } : {}),
  };
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
    assertPostingAccount(entry.accountId, archive.debts);
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
    assertPostingAccount(change.after.entry.accountId, archive.debts);
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
    if (!plan.accounts.length && !plan.records.length && !plan.transfers.length && !plan.recurring.length
      && !plan.budgets.length && !plan.cards.length && !plan.debts.length) return;
    if (plan.baseline !== baseline) throw new Error('Tus datos cambiaron. Volvé a revisar la copia antes de importar.');
    for (const account of plan.accounts) {
      await tx.runAsync('INSERT INTO accounts (id, name, currency, openingMinor, createdAt, revision, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
        account.id, account.name, account.currency, account.openingMinor, account.createdAt, account.revision ?? 0, account.updatedAt ?? account.createdAt);
    }
    for (const record of plan.records) await insertRecord(tx, record);
    for (const record of plan.transfers) await insertTransferRecord(tx, record);
    for (const rule of plan.recurring) await insertRecurringRule(tx, rule);
    for (const budget of plan.budgets) await insertMonthlyBudget(tx, budget);
    for (const card of plan.cards) await insertCreditCard(tx, card);
    for (const debt of plan.debts) await insertPersonalDebt(tx, debt);
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

async function insertRecurringRule(tx: SqlExecutor, rule: RecurringRule): Promise<void> {
  await tx.runAsync(`INSERT INTO recurring_rules (id, accountId, kind, amountMinor, merchant, category, frequency,
    anchorDateISO, nextDateISO, active, createdAt, revision, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  rule.id, rule.accountId, rule.kind, rule.amountMinor, rule.merchant, rule.category, rule.frequency,
  rule.anchorDateISO, rule.nextDateISO, rule.active ? 1 : 0, rule.createdAt, rule.revision, rule.updatedAt);
}

export async function saveRecurringRule(db: LedgerDatabase, input: RecurringRule): Promise<void> {
  const rule = { ...input, merchant: input.merchant.trim(), category: input.category.trim() };
  await db.withExclusiveTransactionAsync(async tx => {
    const archive = await readArchive(tx);
    validateRecurringRule(rule, archive.accounts);
    assertPostingAccount(rule.accountId, archive.debts);
    const existing = archive.recurring?.find(item => item.id === rule.id);
    if (!existing) {
      if (rule.revision !== 0 || rule.updatedAt !== rule.createdAt) throw new Error('Un recurrente nuevo no puede tener cambios previos.');
      validateArchive({ ...archive, recurring: [...archive.recurring ?? [], rule] });
      await insertRecurringRule(tx, rule);
      return;
    }
    if (sameRecurringRule(existing, rule)) return;
    if (rule.createdAt !== existing.createdAt || rule.revision !== existing.revision + 1) {
      throw new Error('El recurrente cambió desde que lo abriste. Volvé a revisarlo.');
    }
    const beforeAccount = archive.accounts.find(account => account.id === existing.accountId);
    const afterAccount = archive.accounts.find(account => account.id === rule.accountId);
    if (!beforeAccount || !afterAccount || beforeAccount.currency !== afterAccount.currency) {
      throw new Error('Elegí una cuenta de la misma moneda. Cambiar la moneda requiere crear otro recurrente.');
    }
    validateArchive({ ...archive, recurring: archive.recurring!.map(item => item.id === rule.id ? rule : item) });
    await tx.runAsync(`UPDATE recurring_rules SET accountId = ?, kind = ?, amountMinor = ?, merchant = ?, category = ?,
      frequency = ?, anchorDateISO = ?, nextDateISO = ?, active = ?, revision = ?, updatedAt = ? WHERE id = ?`,
    rule.accountId, rule.kind, rule.amountMinor, rule.merchant, rule.category, rule.frequency, rule.anchorDateISO,
    rule.nextDateISO, rule.active ? 1 : 0, rule.revision, rule.updatedAt, rule.id);
  });
}

/** Materialize every due occurrence once. Entry IDs are deterministic and the
 * rule advance is committed atomically with those postings. */
export async function processRecurring(db: LedgerDatabase, throughDateISO: string, nowISO = new Date().toISOString()): Promise<number> {
  let created = 0;
  await db.withExclusiveTransactionAsync(async tx => {
    const archive = await readArchive(tx);
    if (!archive.recurring?.length) return;
    const records = [...archive.records];
    const recurring = [...archive.recurring];
    const inserts: EntryRecord[] = [];
    const updates: RecurringRule[] = [];

    for (let index = 0; index < recurring.length; index++) {
      const current = recurring[index];
      const materialized = materializeRecurringRule(current, archive.accounts, throughDateISO, nowISO);
      if (!materialized.entries.length) continue;
      for (const entry of materialized.entries) {
        const existing = records.find(record => record.entry.id === entry.id);
        if (existing) {
          if (!sameEntry(existing.entry, entry)) throw new Error('Un vencimiento recurrente coincide con otro movimiento distinto.');
          continue; // A restored/voided deterministic occurrence is never duplicated.
        }
        const record = initialRecord(entry);
        records.push(record);
        inserts.push(record);
      }
      recurring[index] = materialized.rule;
      updates.push(materialized.rule);
    }

    if (!updates.length) return;
    validateArchive({ ...archive, records, recurring });
    for (const record of inserts) await insertRecord(tx, record);
    for (const rule of updates) {
      await tx.runAsync('UPDATE recurring_rules SET nextDateISO = ?, revision = ?, updatedAt = ? WHERE id = ?',
        rule.nextDateISO, rule.revision, rule.updatedAt, rule.id);
    }
    created = inserts.length;
  });
  return created;
}


async function insertMonthlyBudget(tx: SqlExecutor, budget: MonthlyBudget): Promise<void> {
  await tx.runAsync(`INSERT INTO monthly_budgets (id, category, currency, monthISO, amountMinor, active, createdAt, revision, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, budget.id, budget.category, budget.currency, budget.monthISO,
  budget.amountMinor, budget.active ? 1 : 0, budget.createdAt, budget.revision, budget.updatedAt);
}

export async function saveMonthlyBudget(db: LedgerDatabase, input: MonthlyBudget): Promise<void> {
  const budget = { ...input, category: input.category.trim() };
  await db.withExclusiveTransactionAsync(async tx => {
    const archive = await readArchive(tx);
    validateMonthlyBudget(budget);
    const existing = archive.budgets?.find(item => item.id === budget.id);
    if (!existing) {
      if (budget.revision !== 0 || budget.updatedAt !== budget.createdAt) {
        throw new Error('Un presupuesto nuevo no puede tener cambios previos.');
      }
      validateArchive({ ...archive, budgets: [...archive.budgets ?? [], budget] });
      await insertMonthlyBudget(tx, budget);
      return;
    }
    if (sameMonthlyBudget(existing, budget)) return;
    if (budget.createdAt !== existing.createdAt || budget.revision !== existing.revision + 1) {
      throw new Error('El presupuesto cambió desde que lo abriste. Volvé a revisarlo.');
    }
    if (budget.currency !== existing.currency) {
      throw new Error('Para cambiar la moneda, creá otro presupuesto.');
    }
    const budgets = (archive.budgets ?? []).map(item => item.id === budget.id ? budget : item);
    validateArchive({ ...archive, budgets });
    await tx.runAsync(`UPDATE monthly_budgets SET category = ?, monthISO = ?, amountMinor = ?, active = ?,
      revision = ?, updatedAt = ? WHERE id = ?`, budget.category, budget.monthISO, budget.amountMinor,
    budget.active ? 1 : 0, budget.revision, budget.updatedAt, budget.id);
  });
}

async function insertCreditCard(tx: SqlExecutor, card: CreditCardProfile): Promise<void> {
  await tx.runAsync(`INSERT INTO credit_cards (id, accountId, issuer, last4, creditLimitMinor, closingDay, dueDay,
    active, createdAt, revision, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  card.id, card.accountId, card.issuer, card.last4, card.creditLimitMinor, card.closingDay, card.dueDay,
  card.active ? 1 : 0, card.createdAt, card.revision, card.updatedAt);
}
async function insertPersonalDebt(tx: SqlExecutor, debt: PersonalDebtProfile): Promise<void> {
  await tx.runAsync(`INSERT INTO personal_debts (id, accountId, direction, counterparty, dueDateISO, note,
    active, createdAt, revision, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  debt.id, debt.accountId, debt.direction, debt.counterparty, debt.dueDateISO, debt.note,
  debt.active ? 1 : 0, debt.createdAt, debt.revision, debt.updatedAt);
}
async function insertInternalAccount(tx: SqlExecutor, account: Account): Promise<void> {
  await tx.runAsync(
    'INSERT INTO accounts (id, name, currency, openingMinor, createdAt, revision, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
    account.id, account.name, account.currency, account.openingMinor, account.createdAt,
    account.revision ?? 0, account.updatedAt ?? account.createdAt,
  );
}

/** A card and its hidden account are created in one commit. The opening
 * balance is the debt already owed (negative) or zero; a card never starts
 * with money in the holder's favour. */
export async function createCreditCard(db: LedgerDatabase, accountInput: Account, cardInput: CreditCardProfile): Promise<void> {
  const account = { ...accountInput, name: accountInput.name.trim() };
  const card = { ...cardInput, issuer: cardInput.issuer.trim(), last4: cardInput.last4.trim() };
  validateAccount(account);
  if ((account.revision ?? 0) !== 0 || account.openingMinor > 0) {
    throw new Error('La tarjeta nueva debe comenzar sin crédito a favor y sin correcciones previas.');
  }
  if (card.accountId !== account.id) throw new Error('La tarjeta no coincide con su cuenta interna.');
  if (card.revision !== 0 || card.updatedAt !== card.createdAt || !card.active) throw new Error('Una tarjeta nueva no puede tener cambios previos.');
  await db.withExclusiveTransactionAsync(async tx => {
    const archive = await readArchive(tx);
    validateCreditCardProfile(card, [...archive.accounts, account]);
    const existingAccount = archive.accounts.find(item => item.id === account.id);
    const existingCard = archive.cards?.find(item => item.id === card.id);
    if (existingAccount || existingCard) {
      if (existingAccount && existingCard && sameAccount(existingAccount, account) && sameCreditCardProfile(existingCard, card)) return;
      throw new Error('Esta tarjeta ya existe con otros datos. Volvé a abrir el formulario.');
    }
    validateArchive({ ...archive, accounts: [...archive.accounts, account], cards: [...archive.cards ?? [], card] });
    await insertInternalAccount(tx, account);
    await insertCreditCard(tx, card);
  });
}

export async function saveCreditCard(db: LedgerDatabase, input: CreditCardProfile): Promise<void> {
  const card = { ...input, issuer: input.issuer.trim(), last4: input.last4.trim() };
  await db.withExclusiveTransactionAsync(async tx => {
    const archive = await readArchive(tx);
    validateCreditCardProfile(card, archive.accounts);
    const existing = archive.cards?.find(item => item.id === card.id);
    if (!existing) throw new Error('No encontramos esta tarjeta.');
    if (sameCreditCardProfile(existing, card)) return; // Committed already; a refresh failed.
    if (card.accountId !== existing.accountId || card.createdAt !== existing.createdAt || card.revision !== existing.revision + 1) {
      throw new Error('La tarjeta cambió desde que la abriste. Volvé a revisarla.');
    }
    validateArchive({ ...archive, cards: archive.cards!.map(item => item.id === card.id ? card : item) });
    await tx.runAsync(`UPDATE credit_cards SET issuer = ?, last4 = ?, creditLimitMinor = ?, closingDay = ?, dueDay = ?,
      active = ?, revision = ?, updatedAt = ? WHERE id = ?`, card.issuer, card.last4, card.creditLimitMinor,
    card.closingDay, card.dueDay, card.active ? 1 : 0, card.revision, card.updatedAt, card.id);
  });
}

/** A debt and its hidden account are created together. "I owe" starts with a
 * negative opening balance; "they owe me" starts positive. */
export async function createPersonalDebt(db: LedgerDatabase, accountInput: Account, debtInput: PersonalDebtProfile): Promise<void> {
  const account = { ...accountInput, name: accountInput.name.trim() };
  const debt = { ...debtInput, counterparty: debtInput.counterparty.trim(), note: debtInput.note.trim() };
  validateAccount(account);
  if ((account.revision ?? 0) !== 0
    || (debt.direction === 'owed_by_me' && account.openingMinor > 0)
    || (debt.direction === 'owed_to_me' && account.openingMinor < 0)) {
    throw new Error('El saldo inicial de la deuda no coincide con su dirección.');
  }
  if (debt.accountId !== account.id) throw new Error('La deuda no coincide con su cuenta interna.');
  if (debt.revision !== 0 || debt.updatedAt !== debt.createdAt || !debt.active) throw new Error('Una deuda nueva no puede tener cambios previos.');
  await db.withExclusiveTransactionAsync(async tx => {
    const archive = await readArchive(tx);
    validatePersonalDebtProfile(debt, [...archive.accounts, account]);
    const existingAccount = archive.accounts.find(item => item.id === account.id);
    const existingDebt = archive.debts?.find(item => item.id === debt.id);
    if (existingAccount || existingDebt) {
      if (existingAccount && existingDebt && sameAccount(existingAccount, account) && samePersonalDebtProfile(existingDebt, debt)) return;
      throw new Error('Esta deuda ya existe con otros datos. Volvé a abrir el formulario.');
    }
    validateArchive({ ...archive, accounts: [...archive.accounts, account], debts: [...archive.debts ?? [], debt] });
    await insertInternalAccount(tx, account);
    await insertPersonalDebt(tx, debt);
  });
}

export async function savePersonalDebt(db: LedgerDatabase, input: PersonalDebtProfile): Promise<void> {
  const debt = { ...input, counterparty: input.counterparty.trim(), note: input.note.trim() };
  await db.withExclusiveTransactionAsync(async tx => {
    const archive = await readArchive(tx);
    validatePersonalDebtProfile(debt, archive.accounts);
    const existing = archive.debts?.find(item => item.id === debt.id);
    if (!existing) throw new Error('No encontramos esta deuda.');
    if (samePersonalDebtProfile(existing, debt)) return;
    if (debt.accountId !== existing.accountId || debt.direction !== existing.direction
      || debt.createdAt !== existing.createdAt || debt.revision !== existing.revision + 1) {
      throw new Error('La deuda cambió desde que la abriste. Volvé a revisarla.');
    }
    validateArchive({ ...archive, debts: archive.debts!.map(item => item.id === debt.id ? debt : item) });
    await tx.runAsync(`UPDATE personal_debts SET counterparty = ?, dueDateISO = ?, note = ?, active = ?,
      revision = ?, updatedAt = ? WHERE id = ?`, debt.counterparty, debt.dueDateISO, debt.note,
    debt.active ? 1 : 0, debt.revision, debt.updatedAt, debt.id);
  });
}
