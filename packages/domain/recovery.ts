import { totalsByCurrency, validateAccount, validateEntry, type Account, type Entry, type LedgerSnapshot } from './ledger.ts';
import { TRANSFER_KEYS, sameTransferRecord, validateTransferRecord, type TransferRecord } from './transfers.ts';
import { sameRecurringRule, validateRecurringRule, type RecurringRule } from './recurring.ts';
import { sameMonthlyBudget, validateBudgetCollection, validateMonthlyBudget, type MonthlyBudget } from './budgets.ts';

/** The current version of every entry, including reversible tombstones.
 * Reports consume snapshotFromArchive, never the tombstones themselves. */
export interface EntryRecord {
  entry: Entry;
  revision: number;
  voided: boolean;
  updatedAt: string;
}
export interface LedgerArchive {
  accounts: Account[];
  records: EntryRecord[];
  transfers?: TransferRecord[];
  recurring?: RecurringRule[];
  budgets?: MonthlyBudget[];
}
export interface EntryChange {
  id: string;
  action: 'edit' | 'void' | 'restore';
  before: EntryRecord;
  after: EntryRecord;
}
export const BACKUP_MAX_BYTES = 5 * 1024 * 1024;
const ACCOUNT_KEYS = ['id', 'name', 'currency', 'openingMinor', 'createdAt'] as const;
const ENTRY_KEYS = ['id', 'accountId', 'kind', 'amountMinor', 'merchant', 'category', 'dateISO', 'createdAt'] as const;
const RECURRING_KEYS = ['id', 'accountId', 'kind', 'amountMinor', 'merchant', 'category', 'frequency',
  'anchorDateISO', 'nextDateISO', 'active', 'createdAt', 'revision', 'updatedAt'] as const;
const BUDGET_KEYS = ['id', 'category', 'currency', 'monthISO', 'amountMinor', 'active',
  'createdAt', 'revision', 'updatedAt'] as const;

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
function accountValue(value: unknown, allowRevision = true): Account {
  const keys = allowRevision && value && typeof value === 'object' && Object.hasOwn(value, 'revision')
    ? [...ACCOUNT_KEYS, 'revision', 'updatedAt'] as const : ACCOUNT_KEYS;
  const item = object(value, keys) as unknown as Account;
  validateAccount(item);
  return Object.fromEntries((item.revision === 0 ? ACCOUNT_KEYS : keys).map(key => [key, item[key]])) as unknown as Account;
}
function entryValue(value: unknown, accounts: Account[]): Entry {
  const item = object(value, ENTRY_KEYS) as unknown as Entry;
  validateEntry(item, accounts);
  return Object.fromEntries(ENTRY_KEYS.map(key => [key, item[key]])) as unknown as Entry;
}
function recurringValue(value: unknown, accounts: Account[]): RecurringRule {
  const row = object(value, RECURRING_KEYS);
  const rule = Object.fromEntries(RECURRING_KEYS.map(key => [key, row[key]])) as unknown as RecurringRule;
  validateRecurringRule(rule, accounts);
  return rule;
}
function budgetValue(value: unknown): MonthlyBudget {
  const row = object(value, BUDGET_KEYS);
  const budget = Object.fromEntries(BUDGET_KEYS.map(key => [key, row[key]])) as unknown as MonthlyBudget;
  validateMonthlyBudget(budget);
  return budget;
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
  return { accounts: archive.accounts, entries: archive.records.filter(record => !record.voided).map(record => record.entry),
    ...(archive.transfers?.length ? { transfers: archive.transfers.filter(record => !record.voided).map(record => record.transfer) } : {}) };
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
  const transfers = new Set<string>();
  for (const record of archive.transfers ?? []) {
    validateTransferRecord(record, archive.accounts);
    if (transfers.has(record.transfer.id)) throw new Error('La copia repite una transferencia.');
    transfers.add(record.transfer.id);
  }
  const recurring = new Set<string>();
  for (const rule of archive.recurring ?? []) {
    validateRecurringRule(rule, archive.accounts);
    if (recurring.has(rule.id)) throw new Error('La copia repite un recurrente.');
    recurring.add(rule.id);
  }
  validateBudgetCollection(archive.budgets ?? []);
  totalsByCurrency(snapshotFromArchive(archive));
}
export function sameAccount(a: Account, b: Account): boolean {
  return ACCOUNT_KEYS.every(key => a[key] === b[key]) && (a.revision ?? 0) === (b.revision ?? 0)
    && (a.updatedAt ?? a.createdAt) === (b.updatedAt ?? b.createdAt);
}
export function sameEntry(a: Entry, b: Entry): boolean { return ENTRY_KEYS.every(key => a[key] === b[key]); }
export function sameRecord(a: EntryRecord, b: EntryRecord): boolean {
  return sameEntry(a.entry, b.entry) && a.revision === b.revision && a.voided === b.voided && a.updatedAt === b.updatedAt;
}
function canonicalArchive(archive: LedgerArchive): LedgerArchive {
  return {
    accounts: archive.accounts.map(a => accountValue(a)).sort((a, b) => a.id.localeCompare(b.id)),
    records: archive.records.map(record => ({ entry: entryValue(record.entry, archive.accounts), revision: record.revision,
      voided: record.voided, updatedAt: record.updatedAt })).sort((a, b) => a.entry.id.localeCompare(b.entry.id)),
    ...(archive.transfers?.length ? { transfers: archive.transfers.map(r => transferValue(r, archive.accounts))
      .sort((a, b) => a.transfer.id.localeCompare(b.transfer.id)) } : {}),
    ...(archive.recurring?.length ? { recurring: archive.recurring.map(rule => recurringValue(rule, archive.accounts))
      .sort((a, b) => a.id.localeCompare(b.id)) } : {}),
    ...(archive.budgets?.length ? { budgets: archive.budgets.map(budgetValue)
      .sort((a, b) => a.id.localeCompare(b.id)) } : {}),
  };
}
function transferValue(value: unknown, accounts: Account[]): TransferRecord {
  const row = object(value, ['transfer', 'revision', 'voided', 'updatedAt']);
  const transfer = object(row.transfer, TRANSFER_KEYS);
  const result = { transfer: Object.fromEntries(TRANSFER_KEYS.map(k => [k, transfer[k]])), revision: row.revision,
    voided: row.voided, updatedAt: row.updatedAt } as unknown as TransferRecord;
  validateTransferRecord(result, accounts);
  return result;
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
  const canonical = canonicalArchive(archive);
  return { app: 'FinanzApp', schema: 'finanzapp.native-pilot.v5', exportedAt: now.toISOString(),
    moneyUnit: 'integer-minor-units', ...canonical, transfers: canonical.transfers ?? [],
    recurring: canonical.recurring ?? [], budgets: canonical.budgets ?? [] };
}
export interface ParsedBackup { archive: LedgerArchive; exportedAt: string; }
export function parsePilotBackup(raw: string): ParsedBackup {
  if (!raw || raw.length > BACKUP_MAX_BYTES) throw new Error('Elegí una copia JSON de hasta 5 MB.');
  let value: unknown;
  try { value = JSON.parse(raw.replace(/^\uFEFF/, '')); } catch { throw new Error('El archivo no es una copia JSON válida.'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('El archivo no es una copia de FinanzApp.');
  const header = value as Record<string, unknown>;
  const v1 = header.schema === 'finanzapp.native-pilot.v1';
  const v2 = header.schema === 'finanzapp.native-pilot.v2';
  const v3 = header.schema === 'finanzapp.native-pilot.v3';
  const v4 = header.schema === 'finanzapp.native-pilot.v4';
  const v5 = header.schema === 'finanzapp.native-pilot.v5';
  if (!v1 && !v2 && !v3 && !v4 && !v5) {
    throw new Error('Solo se pueden restaurar copias del piloto nativo v1, v2, v3, v4 o v5. La app web/anterior y otras versiones todavía no son compatibles; conservá el archivo.');
  }
  object(value, ['app', 'schema', 'exportedAt', 'moneyUnit', 'accounts', v1 ? 'entries' : 'records',
    ...(v3 || v4 || v5 ? ['transfers'] : []), ...(v4 || v5 ? ['recurring'] : []), ...(v5 ? ['budgets'] : [])]);
  if (header.app !== 'FinanzApp' || header.moneyUnit !== 'integer-minor-units') throw new Error('Formato o unidad monetaria no compatibles.');
  timestamp(header.exportedAt);
  const rows = v1 ? header.entries : header.records;
  if (!Array.isArray(header.accounts) || !Array.isArray(rows) || header.accounts.length > 1000 || rows.length > 25000) {
    throw new Error('La copia no tiene una lista válida de cuentas y movimientos (máximo 1.000 cuentas y 25.000 movimientos).');
  }
  if ((v3 || v4 || v5) && (!Array.isArray(header.transfers) || header.transfers.length + rows.length > 25000)) {
    throw new Error('La copia supera el límite de movimientos o contiene transferencias inválidas.');
  }
  if ((v4 || v5) && (!Array.isArray(header.recurring) || header.recurring.length > 5000)) {
    throw new Error('La copia contiene demasiados recurrentes o un formato inválido.');
  }
  if (v5 && (!Array.isArray(header.budgets) || header.budgets.length > 5000)) {
    throw new Error('La copia contiene demasiados presupuestos o un formato inválido.');
  }
  const accounts = header.accounts.map(a => accountValue(a, v3 || v4 || v5));
  const records = rows.map((value): EntryRecord => {
    if (v1) return initialRecord(entryValue(value, accounts));
    const record = object(value, ['entry', 'revision', 'voided', 'updatedAt']);
    return { entry: entryValue(record.entry, accounts), revision: record.revision as number, voided: record.voided as boolean, updatedAt: record.updatedAt as string };
  });
  const transfers = v3 || v4 || v5 ? (header.transfers as unknown[]).map(t => transferValue(t, accounts)) : [];
  const recurring = v4 || v5 ? (header.recurring as unknown[]).map(rule => recurringValue(rule, accounts)) : [];
  const budgets = v5 ? (header.budgets as unknown[]).map(budgetValue) : [];
  const archive = { accounts, records, ...(transfers.length ? { transfers } : {}),
    ...(recurring.length ? { recurring } : {}), ...(budgets.length ? { budgets } : {}) };
  validateArchive(archive);
  return { archive, exportedAt: header.exportedAt };
}

export interface ImportPreview {
  baseline: string;
  accounts: Account[];
  records: EntryRecord[];
  transfers: TransferRecord[];
  recurring: RecurringRule[];
  budgets: MonthlyBudget[];
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
  const transferMap = new Map((current.transfers ?? []).map(r => [r.transfer.id, r]));
  const recurringMap = new Map((current.recurring ?? []).map(rule => [rule.id, rule]));
  const budgetMap = new Map((current.budgets ?? []).map(budget => [budget.id, budget]));
  const transfers: TransferRecord[] = [];
  const recurring: RecurringRule[] = [];
  const budgets: MonthlyBudget[] = [];
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
  for (const record of incoming.transfers ?? []) {
    const existing = transferMap.get(record.transfer.id);
    if (!existing) transfers.push(record);
    else if (sameTransferRecord(existing, record)) identical++;
    else conflicts++;
  }
  for (const rule of incoming.recurring ?? []) {
    const existing = recurringMap.get(rule.id);
    if (!existing) recurring.push(rule);
    else if (sameRecurringRule(existing, rule)) identical++;
    else conflicts++;
  }
  for (const budget of incoming.budgets ?? []) {
    const existing = budgetMap.get(budget.id);
    if (!existing) budgets.push(budget);
    else if (sameMonthlyBudget(existing, budget)) identical++;
    else conflicts++;
  }
  const combined = { accounts: [...current.accounts, ...accounts], records: [...current.records, ...records],
    transfers: [...current.transfers ?? [], ...transfers], recurring: [...current.recurring ?? [], ...recurring],
    budgets: [...current.budgets ?? [], ...budgets] };
  if (!conflicts) validateArchive(combined);
  return { baseline: archiveKey(current), accounts, records, transfers, recurring, budgets, identical, conflicts,
    before: totalsByCurrency(snapshotFromArchive(current)), after: conflicts ? null : totalsByCurrency(snapshotFromArchive(combined)) };
}
