import { totalsByCurrency, validateAccount, validateEntry, type Account, type Entry, type LedgerSnapshot } from './ledger.ts';
import { TRANSFER_KEYS, sameTransferRecord, validateTransferRecord, type TransferRecord } from './transfers.ts';
import { sameRecurringRule, validateRecurringRule, type RecurringRule } from './recurring.ts';
import { sameMonthlyBudget, scopedMonthlyBudget, validateBudgetCollection, validateMonthlyBudget, type MonthlyBudget } from './budgets.ts';
import { liquidTotalsByCurrency, sameCreditCardProfile, samePersonalDebtProfile, validateCreditCardProfile, validateLiabilityProfiles,
  validatePersonalDebtProfile, type CreditCardProfile, type PersonalDebtProfile } from './liabilities.ts';
import { APPEARANCE_KEYS, sameAccountAppearance, validateAccountAppearance, validateAccountAppearances, type AccountAppearance } from './appearance.ts';
import { CATEGORY_DEFINITION_KEYS, sameCategoryDefinition, validateCategoryDefinition, validateCategoryDefinitions, type CategoryDefinition } from './categories.ts';

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
  cards?: CreditCardProfile[];
  debts?: PersonalDebtProfile[];
  /** Producto 20: presentation metadata. Neither changes a balance. */
  appearances?: AccountAppearance[];
  categories?: CategoryDefinition[];
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
// v5/v6 budgets had no scope: every one of them is a category budget. v7 adds
// `scope`; a total budget carries no `category` key at all.
const LEGACY_BUDGET_KEYS = ['id', 'category', 'currency', 'monthISO', 'amountMinor', 'active',
  'createdAt', 'revision', 'updatedAt'] as const;
const BUDGET_BASE_KEYS = ['id', 'scope', 'currency', 'monthISO', 'amountMinor', 'active',
  'createdAt', 'revision', 'updatedAt'] as const;
const CARD_KEYS = ['id', 'accountId', 'issuer', 'last4', 'creditLimitMinor', 'closingDay', 'dueDay',
  'active', 'createdAt', 'revision', 'updatedAt'] as const;
const DEBT_KEYS = ['id', 'accountId', 'direction', 'counterparty', 'dueDateISO', 'note',
  'active', 'createdAt', 'revision', 'updatedAt'] as const;

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
function budgetValue(value: unknown, legacy = false): MonthlyBudget {
  const scoped = !legacy && !!value && typeof value === 'object' && Object.hasOwn(value, 'scope');
  if (legacy || !scoped) {
    const row = object(value, LEGACY_BUDGET_KEYS);
    const budget = scopedMonthlyBudget(Object.fromEntries(LEGACY_BUDGET_KEYS.map(key => [key, row[key]])) as unknown as Parameters<typeof scopedMonthlyBudget>[0]);
    validateMonthlyBudget(budget);
    return budget;
  }
  const keys = (value as { scope?: unknown }).scope === 'total' ? BUDGET_BASE_KEYS : [...BUDGET_BASE_KEYS, 'category'] as const;
  const row = object(value, keys);
  const budget = Object.fromEntries(keys.map(key => [key, row[key]])) as unknown as MonthlyBudget;
  validateMonthlyBudget(budget);
  return budget;
}
function cardValue(value: unknown, accounts: Account[]): CreditCardProfile {
  const row = object(value, CARD_KEYS);
  const card = Object.fromEntries(CARD_KEYS.map(key => [key, row[key]])) as unknown as CreditCardProfile;
  validateCreditCardProfile(card, accounts);
  return card;
}
function debtValue(value: unknown, accounts: Account[]): PersonalDebtProfile {
  const row = object(value, DEBT_KEYS);
  const debt = Object.fromEntries(DEBT_KEYS.map(key => [key, row[key]])) as unknown as PersonalDebtProfile;
  validatePersonalDebtProfile(debt, accounts);
  return debt;
}
function appearanceValue(value: unknown, accounts: Account[]): AccountAppearance {
  const row = object(value, APPEARANCE_KEYS);
  const appearance = Object.fromEntries(APPEARANCE_KEYS.map(key => [key, row[key]])) as unknown as AccountAppearance;
  validateAccountAppearance(appearance, accounts);
  return appearance;
}
function categoryValue(value: unknown): CategoryDefinition {
  const row = object(value, CATEGORY_DEFINITION_KEYS);
  const definition = Object.fromEntries(CATEGORY_DEFINITION_KEYS.map(key => [key, row[key]])) as unknown as CategoryDefinition;
  validateCategoryDefinition(definition);
  return definition;
}
const categoryIdentity = (definition: CategoryDefinition) => definition.kind + '|' + definition.key;
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
  validateLiabilityProfiles(archive.cards ?? [], archive.debts ?? [], archive.accounts);
  validateAccountAppearances(archive.appearances ?? [], archive.accounts);
  validateCategoryDefinitions(archive.categories ?? []);
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
    ...(archive.budgets?.length ? { budgets: archive.budgets.map(budget => budgetValue(budget))
      .sort((a, b) => a.id.localeCompare(b.id)) } : {}),
    ...(archive.cards?.length ? { cards: archive.cards.map(card => cardValue(card, archive.accounts))
      .sort((a, b) => a.id.localeCompare(b.id)) } : {}),
    ...(archive.debts?.length ? { debts: archive.debts.map(debt => debtValue(debt, archive.accounts))
      .sort((a, b) => a.id.localeCompare(b.id)) } : {}),
    ...(archive.appearances?.length ? { appearances: archive.appearances.map(item => appearanceValue(item, archive.accounts))
      .sort((a, b) => a.accountId.localeCompare(b.accountId)) } : {}),
    ...(archive.categories?.length ? { categories: archive.categories.map(item => categoryValue(item))
      .sort((a, b) => categoryIdentity(a).localeCompare(categoryIdentity(b))) } : {}),
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
  return { app: 'FinanzApp', schema: 'finanzapp.native-pilot.v8', exportedAt: now.toISOString(),
    moneyUnit: 'integer-minor-units', ...canonical, transfers: canonical.transfers ?? [],
    recurring: canonical.recurring ?? [], budgets: canonical.budgets ?? [],
    cards: canonical.cards ?? [], debts: canonical.debts ?? [],
    appearances: canonical.appearances ?? [], categories: canonical.categories ?? [] };
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
  const v6 = header.schema === 'finanzapp.native-pilot.v6';
  const v7 = header.schema === 'finanzapp.native-pilot.v7';
  const v8 = header.schema === 'finanzapp.native-pilot.v8';
  if (!v1 && !v2 && !v3 && !v4 && !v5 && !v6 && !v7 && !v8) {
    throw new Error('Solo se pueden restaurar copias del piloto nativo v1 a v8. La app web/anterior y otras versiones todavía no son compatibles; conservá el archivo.');
  }
  const hasTransfers = v3 || v4 || v5 || v6 || v7 || v8, hasRecurring = v4 || v5 || v6 || v7 || v8, hasBudgets = v5 || v6 || v7 || v8;
  const hasLiabilities = v6 || v7 || v8, hasScopedBudgets = v7 || v8, hasIdentity = v8;
  object(value, ['app', 'schema', 'exportedAt', 'moneyUnit', 'accounts', v1 ? 'entries' : 'records',
    ...(hasTransfers ? ['transfers'] : []), ...(hasRecurring ? ['recurring'] : []),
    ...(hasBudgets ? ['budgets'] : []), ...(hasLiabilities ? ['cards', 'debts'] : []),
    ...(hasIdentity ? ['appearances', 'categories'] : [])]);
  if (header.app !== 'FinanzApp' || header.moneyUnit !== 'integer-minor-units') throw new Error('Formato o unidad monetaria no compatibles.');
  timestamp(header.exportedAt);
  const rows = v1 ? header.entries : header.records;
  if (!Array.isArray(header.accounts) || !Array.isArray(rows) || header.accounts.length > 1000 || rows.length > 25000) {
    throw new Error('La copia no tiene una lista válida de cuentas y movimientos (máximo 1.000 cuentas y 25.000 movimientos).');
  }
  if (hasTransfers && (!Array.isArray(header.transfers) || header.transfers.length + rows.length > 25000)) {
    throw new Error('La copia supera el límite de movimientos o contiene transferencias inválidas.');
  }
  if (hasRecurring && (!Array.isArray(header.recurring) || header.recurring.length > 5000)) {
    throw new Error('La copia contiene demasiados recurrentes o un formato inválido.');
  }
  if (hasBudgets && (!Array.isArray(header.budgets) || header.budgets.length > 5000)) {
    throw new Error('La copia contiene demasiados presupuestos o un formato inválido.');
  }
  if (hasLiabilities && (!Array.isArray(header.cards) || !Array.isArray(header.debts) || header.cards.length + header.debts.length > 1000)) {
    throw new Error('La copia contiene demasiadas tarjetas/deudas o un formato inválido.');
  }
  if (hasIdentity && (!Array.isArray(header.appearances) || !Array.isArray(header.categories)
    || header.appearances.length > 1000 || header.categories.length > 2000)) {
    throw new Error('La copia contiene demasiadas apariencias/categorías o un formato inválido.');
  }
  const accounts = header.accounts.map(a => accountValue(a, hasTransfers));
  const records = rows.map((value): EntryRecord => {
    if (v1) return initialRecord(entryValue(value, accounts));
    const record = object(value, ['entry', 'revision', 'voided', 'updatedAt']);
    return { entry: entryValue(record.entry, accounts), revision: record.revision as number, voided: record.voided as boolean, updatedAt: record.updatedAt as string };
  });
  const transfers = hasTransfers ? (header.transfers as unknown[]).map(t => transferValue(t, accounts)) : [];
  const recurring = hasRecurring ? (header.recurring as unknown[]).map(rule => recurringValue(rule, accounts)) : [];
  // Only a v7+ file may carry scoped budgets; v5/v6 budgets are read as category budgets.
  const budgets = hasBudgets ? (header.budgets as unknown[]).map(budget => budgetValue(budget, !hasScopedBudgets)) : [];
  const cards = hasLiabilities ? (header.cards as unknown[]).map(card => cardValue(card, accounts)) : [];
  const debts = hasLiabilities ? (header.debts as unknown[]).map(debt => debtValue(debt, accounts)) : [];
  // v1–v7 files carry no identity: their accounts show the default look and their categories resolve to presets or history.
  const appearances = hasIdentity ? (header.appearances as unknown[]).map(item => appearanceValue(item, accounts)) : [];
  const categories = hasIdentity ? (header.categories as unknown[]).map(item => categoryValue(item)) : [];
  const archive = { accounts, records, ...(transfers.length ? { transfers } : {}),
    ...(recurring.length ? { recurring } : {}), ...(budgets.length ? { budgets } : {}),
    ...(cards.length ? { cards } : {}), ...(debts.length ? { debts } : {}),
    ...(appearances.length ? { appearances } : {}), ...(categories.length ? { categories } : {}) };
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
  cards: CreditCardProfile[];
  debts: PersonalDebtProfile[];
  appearances: AccountAppearance[];
  categories: CategoryDefinition[];
  identical: number;
  conflicts: number;
  /** Recorded liquid money by currency (cards and personal debts excluded). */
  before: ReturnType<typeof liquidTotalsByCurrency>;
  after: ReturnType<typeof liquidTotalsByCurrency> | null;
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
  const cardMap = new Map((current.cards ?? []).map(card => [card.id, card]));
  const debtMap = new Map((current.debts ?? []).map(debt => [debt.id, debt]));
  const appearanceMap = new Map((current.appearances ?? []).map(item => [item.accountId, item]));
  const categoryMap = new Map((current.categories ?? []).map(item => [categoryIdentity(item), item]));
  const transfers: TransferRecord[] = [];
  const recurring: RecurringRule[] = [];
  const budgets: MonthlyBudget[] = [];
  const cards: CreditCardProfile[] = [];
  const debts: PersonalDebtProfile[] = [];
  const appearances: AccountAppearance[] = [];
  const categories: CategoryDefinition[] = [];
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
  for (const card of incoming.cards ?? []) {
    const existing = cardMap.get(card.id);
    if (!existing) cards.push(card);
    else if (sameCreditCardProfile(existing, card)) identical++;
    else conflicts++;
  }
  for (const debt of incoming.debts ?? []) {
    const existing = debtMap.get(debt.id);
    if (!existing) debts.push(debt);
    else if (samePersonalDebtProfile(existing, debt)) identical++;
    else conflicts++;
  }
  // Appearance and category rows are keyed by what they decorate, so two devices
  // that dressed the same account or category are compared, never duplicated.
  for (const appearance of incoming.appearances ?? []) {
    const existing = appearanceMap.get(appearance.accountId);
    if (!existing) appearances.push(appearance);
    else if (sameAccountAppearance(existing, appearance)) identical++;
    else conflicts++;
  }
  for (const definition of incoming.categories ?? []) {
    const existing = categoryMap.get(categoryIdentity(definition));
    if (!existing) categories.push(definition);
    else if (sameCategoryDefinition(existing, definition)) identical++;
    else conflicts++;
  }
  const combined = { accounts: [...current.accounts, ...accounts], records: [...current.records, ...records],
    transfers: [...current.transfers ?? [], ...transfers], recurring: [...current.recurring ?? [], ...recurring],
    budgets: [...current.budgets ?? [], ...budgets], cards: [...current.cards ?? [], ...cards],
    debts: [...current.debts ?? [], ...debts], appearances: [...current.appearances ?? [], ...appearances],
    categories: [...current.categories ?? [], ...categories] };
  if (!conflicts) validateArchive(combined);
  return { baseline: archiveKey(current), accounts, records, transfers, recurring, budgets, cards, debts, appearances, categories, identical, conflicts,
    before: liquidTotalsByCurrency(snapshotFromArchive(current), current.cards, current.debts),
    after: conflicts ? null : liquidTotalsByCurrency(snapshotFromArchive(combined), combined.cards, combined.debts) };
}
