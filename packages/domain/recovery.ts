import { totalsByCurrency, validateAccount, validateEntry, type Account, type Entry, type LedgerSnapshot } from './ledger.ts';

/** The current version of every entry, including reversible tombstones.
 * Reports consume snapshotFromArchive, never the tombstones themselves. */
export interface EntryRecord {
  entry: Entry;
  revision: number;
  voided: boolean;
  updatedAt: string;
}
export interface LedgerArchive { accounts: Account[]; records: EntryRecord[]; }
export interface EntryChange {
  id: string;
  action: 'edit' | 'void' | 'restore';
  before: EntryRecord;
  after: EntryRecord;
}
export const BACKUP_MAX_BYTES = 5 * 1024 * 1024;
const ACCOUNT_KEYS = ['id', 'name', 'currency', 'openingMinor', 'createdAt'] as const;
const ENTRY_KEYS = ['id', 'accountId', 'kind', 'amountMinor', 'merchant', 'category', 'dateISO', 'createdAt'] as const;

function object(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).length !== keys.length || keys.some(key => !Object.hasOwn(value, key))) {
    throw new Error('La copia contiene campos faltantes o no compatibles. No se importó nada.');
  }
  return value as Record<string, unknown>;
}
function timestamp(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) throw new Error('Fecha de modificación inválida.');
}
function accountValue(value: unknown): Account {
  const item = object(value, ACCOUNT_KEYS) as unknown as Account;
  validateAccount(item);
  return Object.fromEntries(ACCOUNT_KEYS.map(key => [key, item[key]])) as unknown as Account;
}
function entryValue(value: unknown, accounts: Account[]): Entry {
  const item = object(value, ENTRY_KEYS) as unknown as Entry;
  validateEntry(item, accounts);
  return Object.fromEntries(ENTRY_KEYS.map(key => [key, item[key]])) as unknown as Entry;
}
export function initialRecord(entry: Entry): EntryRecord {
  return { entry, revision: 0, voided: false, updatedAt: entry.createdAt };
}
export function validateRecord(record: EntryRecord, accounts: Account[]): void {
  validateEntry(record.entry, accounts);
  if (!Number.isSafeInteger(record.revision) || record.revision < 0 || typeof record.voided !== 'boolean') {
    throw new Error('Versión de movimiento inválida.');
  }
  timestamp(record.updatedAt);
  if (record.revision === 0 && (record.voided || record.updatedAt !== record.entry.createdAt)) {
    throw new Error('Estado inicial de movimiento inválido.');
  }
}
export function snapshotFromArchive(archive: LedgerArchive): LedgerSnapshot {
  return { accounts: archive.accounts, entries: archive.records.filter(record => !record.voided).map(record => record.entry) };
}
export function validateArchive(archive: LedgerArchive): void {
  const accounts = new Set<string>();
  for (const account of archive.accounts) {
    validateAccount(account);
    if (accounts.has(account.id)) throw new Error('La copia repite una cuenta. No se importó nada.');
    accounts.add(account.id);
  }
  const entries = new Set<string>();
  for (const record of archive.records) {
    validateRecord(record, archive.accounts);
    if (entries.has(record.entry.id)) throw new Error('La copia repite un movimiento. No se importó nada.');
    entries.add(record.entry.id);
  }
  totalsByCurrency(snapshotFromArchive(archive));
}
export function sameAccount(a: Account, b: Account): boolean { return ACCOUNT_KEYS.every(key => a[key] === b[key]); }
export function sameEntry(a: Entry, b: Entry): boolean { return ENTRY_KEYS.every(key => a[key] === b[key]); }
export function sameRecord(a: EntryRecord, b: EntryRecord): boolean {
  return sameEntry(a.entry, b.entry) && a.revision === b.revision && a.voided === b.voided && a.updatedAt === b.updatedAt;
}
function canonicalArchive(archive: LedgerArchive): LedgerArchive {
  return {
    accounts: archive.accounts.map(accountValue).sort((a, b) => a.id.localeCompare(b.id)),
    records: archive.records.map(record => ({ entry: entryValue(record.entry, archive.accounts), revision: record.revision,
      voided: record.voided, updatedAt: record.updatedAt })).sort((a, b) => a.entry.id.localeCompare(b.entry.id)),
  };
}
/** Local optimistic concurrency token, not a cryptographic authenticity check. */
export function archiveKey(archive: LedgerArchive): string { return JSON.stringify(canonicalArchive(archive)); }

export function makeEntryChange(id: string, before: EntryRecord, action: EntryChange['action'], now: string, entry = before.entry): EntryChange {
  return { id, action, before, after: { entry, revision: before.revision + 1, voided: action === 'void', updatedAt: now } };
}
export function validateEntryChange(change: EntryChange, accounts: Account[]): void {
  const { before, after, action } = change;
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(change.id)) throw new Error('Identificador de operación inválido.');
  validateRecord(before, accounts);
  validateRecord(after, accounts);
  if (after.revision !== before.revision + 1 || after.entry.id !== before.entry.id || after.entry.createdAt !== before.entry.createdAt
    || !['edit', 'void', 'restore'].includes(action) || before.voided !== (action === 'restore')
    || after.voided !== (action === 'void') || (action !== 'edit' && !sameEntry(before.entry, after.entry))) {
    throw new Error('El cambio no corresponde al estado del movimiento. Volvé a abrirlo.');
  }
  // Changing ARS to USD cannot silently reinterpret an unchanged nominal amount.
  if (action === 'edit' && accounts.find(a => a.id === before.entry.accountId)?.currency !== accounts.find(a => a.id === after.entry.accountId)?.currency) {
    throw new Error('Elegí una cuenta de la misma moneda. Un cambio de moneda necesita una operación separada.');
  }
}

export function createRecoveryBackup(archive: LedgerArchive, now = new Date()) {
  validateArchive(archive);
  return { app: 'FinanzApp', schema: 'finanzapp.native-pilot.v2', exportedAt: now.toISOString(),
    moneyUnit: 'integer-minor-units', ...canonicalArchive(archive) };
}
export interface ParsedBackup { archive: LedgerArchive; exportedAt: string; }
export function parsePilotBackup(raw: string): ParsedBackup {
  if (!raw || raw.length > BACKUP_MAX_BYTES) throw new Error('Elegí una copia JSON de hasta 5 MB.');
  let value: unknown;
  try { value = JSON.parse(raw.replace(/^\uFEFF/, '')); } catch { throw new Error('El archivo no es una copia JSON válida.'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('El archivo no es una copia de FinanzApp.');
  const header = value as Record<string, unknown>;
  const v1 = header.schema === 'finanzapp.native-pilot.v1';
  if (!v1 && header.schema !== 'finanzapp.native-pilot.v2') {
    throw new Error('Solo se pueden restaurar copias del piloto nativo v1 o v2. La app web/anterior y otras versiones todavía no son compatibles; conservá el archivo.');
  }
  object(value, ['app', 'schema', 'exportedAt', 'moneyUnit', 'accounts', v1 ? 'entries' : 'records']);
  if (header.app !== 'FinanzApp' || header.moneyUnit !== 'integer-minor-units') throw new Error('Formato o unidad monetaria no compatibles.');
  timestamp(header.exportedAt);
  const rows = v1 ? header.entries : header.records;
  if (!Array.isArray(header.accounts) || !Array.isArray(rows) || header.accounts.length > 1000 || rows.length > 25000) {
    throw new Error('La copia no tiene una lista válida de cuentas y movimientos (máximo 1.000 cuentas y 25.000 movimientos).');
  }
  const accounts = header.accounts.map(accountValue);
  const records = rows.map((value): EntryRecord => {
    if (v1) return initialRecord(entryValue(value, accounts));
    const record = object(value, ['entry', 'revision', 'voided', 'updatedAt']);
    return { entry: entryValue(record.entry, accounts), revision: record.revision as number, voided: record.voided as boolean, updatedAt: record.updatedAt as string };
  });
  const archive = { accounts, records };
  validateArchive(archive);
  return { archive, exportedAt: header.exportedAt };
}

export interface ImportPreview {
  baseline: string;
  accounts: Account[];
  records: EntryRecord[];
  identical: number;
  conflicts: number;
  before: ReturnType<typeof totalsByCurrency>;
  after: ReturnType<typeof totalsByCurrency> | null;
}
/** Additive restore: never replace local edits or resurrect a voided entry. */
export function previewBackupImport(current: LedgerArchive, incoming: LedgerArchive): ImportPreview {
  validateArchive(current);
  validateArchive(incoming);
  const accountMap = new Map(current.accounts.map(account => [account.id, account]));
  const recordMap = new Map(current.records.map(record => [record.entry.id, record]));
  const accounts: Account[] = [], records: EntryRecord[] = [];
  let conflicts = 0, identical = 0;
  for (const account of incoming.accounts) {
    const existing = accountMap.get(account.id);
    if (!existing) accounts.push(account);
    else if (!sameAccount(existing, account)) conflicts++;
  }
  for (const record of incoming.records) {
    const existing = recordMap.get(record.entry.id);
    if (!existing) records.push(record);
    else if (sameRecord(existing, record)) identical++;
    else conflicts++;
  }
  const combined = { accounts: [...current.accounts, ...accounts], records: [...current.records, ...records] };
  if (!conflicts) validateArchive(combined);
  return { baseline: archiveKey(current), accounts, records, identical, conflicts,
    before: totalsByCurrency(snapshotFromArchive(current)), after: conflicts ? null : totalsByCurrency(snapshotFromArchive(combined)) };
}
