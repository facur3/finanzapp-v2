import { totalsByCurrency, validateAccount, validateEntry, type Account, type Entry, type LedgerSnapshot } from './ledger.ts';
import { CURRENCY_UNIT_KEYS, catalogueUnit, currenciesNeedingUnits, isLegacyCurrency, sortCurrencies, storedExponent, validateCurrencyUnit, validateCurrencyUnits, type CurrencyUnit,
  type IsoCurrencyCode } from './currency.ts';
import { TRANSFER_KEYS, sameTransferRecord, validateTransferRecord, type TransferRecord } from './transfers.ts';
import { sameRecurringRule, validateRecurringRule, type RecurringRule } from './recurring.ts';
import { sameMonthlyBudget, scopedMonthlyBudget, validateBudgetCollection, validateMonthlyBudget, type MonthlyBudget } from './budgets.ts';
import { liquidTotalsByCurrency, sameCreditCardProfile, samePersonalDebtProfile, validateCreditCardProfile, validateLiabilityProfiles,
  validatePersonalDebtProfile, type CreditCardProfile, type PersonalDebtProfile } from './liabilities.ts';
import { APPEARANCE_KEYS, sameAccountAppearance, validateAccountAppearance, validateAccountAppearances, type AccountAppearance } from './appearance.ts';
import { CATEGORY_DEFINITION_KEYS, sameCategoryDefinition, validateCategoryDefinition, validateCategoryDefinitions, type CategoryDefinition } from './categories.ts';
import { INSTALLMENT_KEYS, INSTALLMENT_PLAN_KEYS, planCatchUpInserts, sameInstallmentPlan, validateInstallmentPlans, type Installment, type InstallmentPlan } from './installments.ts';
import { CARD_CYCLE_DATE_KEYS, sameCardCycleDate, validateCardCycleDates, type CardCycleDates } from './card-cycles.ts';
import { OPERATION_CHANGED_MESSAGE, OPERATION_EXISTS_MESSAGE, OPERATION_INVALID_MESSAGE, OPERATION_STATE_MESSAGE, assertOperationApplicable, operationPlanId, parsePurchaseOperation, projectOperationLines,
  samePurchaseOperation, validateOperationChange, validatePurchaseOperation, validatePurchaseOperationLinks, withOperation, type OperationChange,
  type OperationContext, type PurchaseOperation } from './operations.ts';

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
  /** Producto 24B4: the scale pinned for each currency other than ARS/USD the rows use. Present
   * when the archive knows its scales (read from SQLite 9, parsed from a v9 file); absent in an
   * archive built by hand or parsed from a v1–v8 file, which can only hold ARS/USD cents. */
  currencyUnits?: CurrencyUnit[];
  /** Producto 24T1: purchases in instalments, each with its exact schedule. The movements they recognised are ordinary
   * records above (their ids name the plan and the instalment). */
  installmentPlans?: InstallmentPlan[];
  /** Producto 24T2: the exact statement dates of cards (each a closing and its due), one chain per card (card-cycles.ts). */
  cardCycleDates?: CardCycleDates[];
  /** Producto 24T3: devoluciones and adelantos de cuotas (operations.ts), undone ones included. Absent (read as []) in an
   * archive from before 24T3. Their money effect is projected by `snapshotFromArchive`, never stored as movements. */
  purchaseOperations?: PurchaseOperation[];
}
export interface EntryChange {
  id: string;
  action: 'edit' | 'void' | 'restore';
  before: EntryRecord;
  after: EntryRecord;
}
export const BACKUP_MAX_BYTES = 5 * 1024 * 1024;
/** The newest backup format this build writes and reads: v9 = v8 plus `currencyUnits`; v10 = v9 plus the
 * `deleted` flag of every recurring rule and debt (Producto 24UX4); v11 = v10 plus the `deleted` flag of every
 * card and the `deletedAt` of a deleted account (Producto 25B2). */
export const BACKUP_SCHEMA_V8 = 'finanzapp.native-pilot.v8';
export const BACKUP_SCHEMA_V9 = 'finanzapp.native-pilot.v9';
export const BACKUP_SCHEMA_V10 = 'finanzapp.native-pilot.v10';
export const BACKUP_SCHEMA_V11 = 'finanzapp.native-pilot.v11';
/** v12 = v11 plus `installmentPlans` (Producto 24T1), written as soon as a plan exists. */
export const BACKUP_SCHEMA_V12 = 'finanzapp.native-pilot.v12';
/** v13 = v12 plus `cardCycleDates` (Producto 24T2: a card's exact statement dates), written as soon as one exists; a v13
 * file always carries `installmentPlans` too (possibly empty). */
export const BACKUP_SCHEMA_V13 = 'finanzapp.native-pilot.v13';
/** v14 = v13 plus `purchaseOperations` (Producto 24T3: devoluciones and adelantos de cuotas, undone ones included), written as
 * soon as one exists; a v14 file always carries `installmentPlans` and `cardCycleDates` too (possibly empty). */
export const BACKUP_SCHEMA_V14 = 'finanzapp.native-pilot.v14';
/** 24T3: at most this many operations in a copy; each also counts toward the 25.000-movement budget (an adelanto as four,
 * one per line it can project). */
export const MAX_BACKUP_OPERATIONS = 25000;
export const MAX_BACKUP_CURRENCY_UNITS = 200;
/** Backups v1–v8 record one money unit and no scale per currency: they can only ever name
 * ARS and USD cents, whatever the creation gate offers when the file is read. A file naming
 * another code is refused whole (never read as cents); backup v9 (24B4) carries scales. */
export const LEGACY_IMPORT_MESSAGE = 'Las copias v1 a v8 solo pueden contener cuentas y presupuestos en ARS o USD. No se importó nada; conservá el archivo.';
function assertLegacyCurrencies(archive: Pick<LedgerArchive, 'accounts' | 'budgets'>, message: string): void {
  if (archive.accounts.some(account => !isLegacyCurrency(account.currency))
    || (archive.budgets ?? []).some(budget => !isLegacyCurrency(budget.currency))) throw new Error(message);
}
const ACCOUNT_KEYS = ['id', 'name', 'currency', 'openingMinor', 'createdAt'] as const;
// v5–v10 cards carry no `deleted` key: every one of them is live (deleted: false). v11 files carry it.
const LEGACY_CARD_KEYS = ['id', 'accountId', 'issuer', 'last4', 'creditLimitMinor', 'closingDay', 'dueDay', 'active', 'createdAt', 'revision', 'updatedAt'] as const;
const CARD_KEYS = [...LEGACY_CARD_KEYS.slice(0, 8), 'deleted', ...LEGACY_CARD_KEYS.slice(8)] as const;
const ENTRY_KEYS = ['id', 'accountId', 'kind', 'amountMinor', 'merchant', 'category', 'dateISO', 'createdAt'] as const;
// v4–v9 rules and v6–v9 debts carry no `deleted` key: every one of them is live (deleted: false).
const LEGACY_RECURRING_KEYS = ['id', 'accountId', 'kind', 'amountMinor', 'merchant', 'category', 'frequency',
  'anchorDateISO', 'nextDateISO', 'active', 'createdAt', 'revision', 'updatedAt'] as const;
const RECURRING_KEYS = [...LEGACY_RECURRING_KEYS, 'deleted'] as const;
// v5/v6 budgets had no scope: every one of them is a category budget. v7 adds
// `scope`; a total budget carries no `category` key at all.
const LEGACY_BUDGET_KEYS = ['id', 'category', 'currency', 'monthISO', 'amountMinor', 'active',
  'createdAt', 'revision', 'updatedAt'] as const;
const BUDGET_BASE_KEYS = ['id', 'scope', 'currency', 'monthISO', 'amountMinor', 'active',
  'createdAt', 'revision', 'updatedAt'] as const;
const LEGACY_DEBT_KEYS = ['id', 'accountId', 'direction', 'counterparty', 'dueDateISO', 'note',
  'active', 'createdAt', 'revision', 'updatedAt'] as const;
const DEBT_KEYS = [...LEGACY_DEBT_KEYS, 'deleted'] as const;

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
function accountValue(value: unknown, allowRevision = true, allowDeleted = true): Account {
  const revised = allowRevision && !!value && typeof value === 'object' && Object.hasOwn(value, 'revision');
  // A deletion record (25B2) rides on a revised row only; a file older than v11 never carries one.
  const deleted = allowDeleted && revised && Object.hasOwn(value as object, 'deletedAt');
  const keys = revised ? deleted ? [...ACCOUNT_KEYS, 'revision', 'updatedAt', 'deletedAt'] as const : [...ACCOUNT_KEYS, 'revision', 'updatedAt'] as const : ACCOUNT_KEYS;
  const item = object(value, keys) as unknown as Account;
  validateAccount(item);
  return Object.fromEntries((item.revision === 0 ? ACCOUNT_KEYS : keys).map(key => [key, item[key]])) as unknown as Account;
}
function entryValue(value: unknown, accounts: Account[]): Entry {
  const item = object(value, ENTRY_KEYS) as unknown as Entry;
  validateEntry(item, accounts);
  return Object.fromEntries(ENTRY_KEYS.map(key => [key, item[key]])) as unknown as Entry;
}
function recurringValue(value: unknown, accounts: Account[], legacy = false): RecurringRule {
  const row = object(value, legacy ? LEGACY_RECURRING_KEYS : RECURRING_KEYS);
  const rule = Object.fromEntries(RECURRING_KEYS.map(key => [key, key === 'deleted' && legacy ? false : row[key]])) as unknown as RecurringRule;
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
function cardValue(value: unknown, accounts: Account[], legacy = false): CreditCardProfile {
  const row = object(value, legacy ? LEGACY_CARD_KEYS : CARD_KEYS);
  const card = Object.fromEntries(CARD_KEYS.map(key => [key, key === 'deleted' && legacy ? false : row[key]])) as unknown as CreditCardProfile;
  validateCreditCardProfile(card, accounts);
  return card;
}
function debtValue(value: unknown, accounts: Account[], legacy = false): PersonalDebtProfile {
  const row = object(value, legacy ? LEGACY_DEBT_KEYS : DEBT_KEYS);
  const debt = Object.fromEntries(DEBT_KEYS.map(key => [key, key === 'deleted' && legacy ? false : row[key]])) as unknown as PersonalDebtProfile;
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
function cycleDateValue(value: unknown): CardCycleDates {
  const row = object(value, CARD_CYCLE_DATE_KEYS);
  return Object.fromEntries(CARD_CYCLE_DATE_KEYS.map(key => [key, row[key]])) as unknown as CardCycleDates;
}
function installmentPlanValue(value: unknown): InstallmentPlan {
  const row = object(value, INSTALLMENT_PLAN_KEYS);
  if (!Array.isArray(row.schedule) || row.schedule.length > 120) throw new Error('El calendario de cuotas no coincide con el plan.');
  const schedule = row.schedule.map(item => { const installment = object(item, INSTALLMENT_KEYS); return Object.fromEntries(INSTALLMENT_KEYS.map(key => [key, installment[key]])) as unknown as Installment; });
  return { ...Object.fromEntries(INSTALLMENT_PLAN_KEYS.filter(key => key !== 'schedule').map(key => [key, row[key]])), schedule } as unknown as InstallmentPlan;
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
/** The ledger every reader uses: live movements, then (24T3) the lines live devoluciones and adelantos project
 * (`projectOperationLines`, deterministic order), and live transfers. */
export function snapshotFromArchive(archive: LedgerArchive): LedgerSnapshot {
  const entries = archive.records.filter(record => !record.voided).map(record => record.entry);
  if (archive.purchaseOperations?.length) entries.push(...projectOperationLines(archive));
  return { accounts: archive.accounts, entries,
    ...(archive.transfers?.length ? { transfers: archive.transfers.filter(record => !record.voided).map(record => record.transfer) } : {}) };
}
/** Every invariant of an archive. `context` (24T3, A22) only chooses how a guard involving a devolución or an adelanto is
 * worded (an undo, a restore, an import…); it never changes what is accepted. */
export function validateArchive(archive: LedgerArchive, context?: OperationContext): void {
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
  // 24T3: every operation's shape first (the plan checks below read their rows).
  const operations = archive.purchaseOperations ?? [];
  operations.forEach(validatePurchaseOperation);
  // 24T1: each plan against its card, and the ledger against every plan (an instalment movement matches its schedule;
  // since 24T3 its effective share, after live reductions, with the operation-aware refusals first).
  validateInstallmentPlans(archive.installmentPlans ?? [], archive.cards ?? [], archive.accounts, archive.records, operations, context);
  // 24T2: each card's exact statement dates, one ordered chain per card. A plan's schedule is contractual and is never
  // compared with them (it was written with the calendar known when the plan was created).
  validateCardCycleDates(archive.cardCycleDates ?? [], archive.cards ?? []);
  // 24T3: every link between the operations and the ledger (ids, targets, caps, A4, A5, A10, A11), maps built once.
  validatePurchaseOperationLinks(archive, context);
  // An archive that knows its scales pins every currency its rows use beyond ARS/USD; each pinned
  // scale must be the catalogue's. Storage tolerates a pinned code no row uses (append-only rows).
  if (archive.currencyUnits) validateCurrencyUnits(archive.currencyUnits, currenciesNeedingUnits(archive));
  totalsByCurrency(snapshotFromArchive(archive));
}
/** The scale every stored amount of an archive is read with, by currency: a precision check apart
 * from read acceptance (the row shapes) and from the creation gate. ARS/USD without a unit are
 * cents; any other code needs its pinned unit, equal to the catalogue's. Never reads as cents by
 * default. */
export function archiveExponents(archive: Pick<LedgerArchive, 'accounts' | 'budgets' | 'currencyUnits'>): Partial<Record<IsoCurrencyCode, number>> {
  const units = archive.currencyUnits ?? [];
  const result: Partial<Record<IsoCurrencyCode, number>> = {};
  for (const code of sortCurrencies([...archive.accounts, ...archive.budgets ?? []].map(row => row.currency))) {
    const unit = units.find(item => item.currency === code);
    if (!unit && !isLegacyCurrency(code)) throw new Error(`La moneda ${code} no tiene una escala registrada. No se modificó nada.`);
    result[code] = storedExponent(code, unit?.minorUnitExponent);
  }
  return result;
}
export function sameAccount(a: Account, b: Account): boolean {
  return ACCOUNT_KEYS.every(key => a[key] === b[key]) && (a.revision ?? 0) === (b.revision ?? 0)
    && (a.updatedAt ?? a.createdAt) === (b.updatedAt ?? b.createdAt) && (a.deletedAt ?? null) === (b.deletedAt ?? null);
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
    ...(archive.currencyUnits?.length ? { currencyUnits: archive.currencyUnits.map(unit => unitValue(unit))
      .sort((a, b) => a.currency.localeCompare(b.currency)) } : {}),
    ...(archive.installmentPlans?.length ? { installmentPlans: archive.installmentPlans.map(plan => installmentPlanValue(plan))
      .sort((a, b) => a.id.localeCompare(b.id)) } : {}),
    ...(archive.cardCycleDates?.length ? { cardCycleDates: archive.cardCycleDates.map(row => cycleDateValue(row))
      .sort((a, b) => a.cardId.localeCompare(b.cardId) || a.sequence - b.sequence) } : {}),
    ...(archive.purchaseOperations?.length ? { purchaseOperations: archive.purchaseOperations.map(operation => parsePurchaseOperation(operation))
      .sort((a, b) => a.id.localeCompare(b.id)) } : {}),
  };
}
function unitValue(value: unknown): CurrencyUnit {
  const row = object(value, CURRENCY_UNIT_KEYS);
  const unit = Object.fromEntries(CURRENCY_UNIT_KEYS.map(key => [key, row[key]])) as unknown as CurrencyUnit;
  validateCurrencyUnit(unit);
  return unit;
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

/** The backup this build writes: v8, byte for byte as before, while every row is in ARS or USD
 * (v8 has no scale, and those two are cents); v9 as soon as another currency is used, with
 * `currencyUnits` naming the pinned scale of each such currency (the archive's own units when it
 * knows them, the catalogue's otherwise: they are equal, `validateArchive` proved it); v10 (24UX4)
 * as soon as a recurring rule or a debt is deleted, so its deletion record travels with the copy
 * and an import never brings it back. v10 always has `currencyUnits` (empty when only ARS/USD). v11 (25B2) as soon
 * as an account or a card is deleted: cards carry `deleted`, a deleted account carries `deletedAt`. */
export interface RecoveryBackup {
  app: string; schema: string; exportedAt: string; moneyUnit: string;
  accounts: Account[]; records: EntryRecord[]; transfers: TransferRecord[]; recurring: RecurringRule[]; budgets: MonthlyBudget[];
  cards: CreditCardProfile[]; debts: PersonalDebtProfile[]; appearances: AccountAppearance[]; categories: CategoryDefinition[];
  /** v9 and v10: the pinned scale of every currency the rows use beyond ARS/USD. A v8 file has no such key. */
  currencyUnits?: CurrencyUnit[];
  /** v12 (24T1): every instalment plan with its schedule. Older files have no such key. */
  installmentPlans?: InstallmentPlan[];
  /** v13 (24T2): every card's exact statement dates. Older files have no such key. */
  cardCycleDates?: CardCycleDates[];
  /** v14 (24T3): every devolución and adelanto de cuotas, undone ones included. Older files have no such key. */
  purchaseOperations?: PurchaseOperation[];
}
function withoutDeleted<T extends { deleted: boolean }>(row: T): Omit<T, 'deleted'> {
  const { deleted: _deleted, ...rest } = row;
  return rest;
}
export function createRecoveryBackup(archive: LedgerArchive, now = new Date()): RecoveryBackup {
  validateArchive(archive);
  const needed = currenciesNeedingUnits(archive);
  const canonical = canonicalArchive(archive);
  const { currencyUnits: _units, installmentPlans, cardCycleDates, purchaseOperations, ...rows } = canonical;
  // 25B2: a deleted account or card makes the file v11; without one, cards carry no `deleted` key (a v10 or older
  // file, byte for byte) and no account carries `deletedAt`.
  const lifecycle = canonical.accounts.some(account => account.deletedAt !== undefined) || (canonical.cards ?? []).some(card => card.deleted);
  const tombstones = lifecycle || (canonical.recurring ?? []).some(rule => rule.deleted) || (canonical.debts ?? []).some(debt => debt.deleted);
  // Without a deletion record the file stays v8/v9 byte for byte: its rules and debts carry no `deleted` key.
  const recurring = tombstones ? canonical.recurring ?? [] : (canonical.recurring ?? []).map(withoutDeleted) as RecurringRule[];
  const debts = tombstones ? canonical.debts ?? [] : (canonical.debts ?? []).map(withoutDeleted) as PersonalDebtProfile[];
  const cards = lifecycle ? canonical.cards ?? [] : (canonical.cards ?? []).map(withoutDeleted) as CreditCardProfile[];
  // 24T1: a plan makes the file v12 (it carries `installmentPlans` and every lifecycle key); without one the file is v11 or older, byte for byte.
  // 24T2: an exact statement date makes it v13 (every v12 key, `installmentPlans` even when empty, and `cardCycleDates`).
  // 24T3: an operation makes it v14 (every v13 key, `installmentPlans` and `cardCycleDates` even when empty, and
  // `purchaseOperations`, undone ones included): the lowest version that holds the archive is written.
  const operations = !!purchaseOperations?.length;
  const cycles = !!cardCycleDates?.length || operations;
  const plans = !!installmentPlans?.length || cycles;
  const schema = operations ? BACKUP_SCHEMA_V14 : cycles ? BACKUP_SCHEMA_V13 : plans ? BACKUP_SCHEMA_V12 : lifecycle ? BACKUP_SCHEMA_V11 : tombstones ? BACKUP_SCHEMA_V10 : needed.length ? BACKUP_SCHEMA_V9 : BACKUP_SCHEMA_V8;
  const base: RecoveryBackup = { app: 'FinanzApp', schema, exportedAt: now.toISOString(),
    moneyUnit: 'integer-minor-units', ...rows, transfers: canonical.transfers ?? [],
    recurring: plans ? canonical.recurring ?? [] : recurring, budgets: canonical.budgets ?? [],
    cards: plans ? canonical.cards ?? [] : cards, debts: plans ? canonical.debts ?? [] : debts,
    appearances: canonical.appearances ?? [], categories: canonical.categories ?? [] };
  const withPlans = (backup: RecoveryBackup): RecoveryBackup => !plans ? backup
    : cycles ? { ...backup, installmentPlans: installmentPlans ?? [], cardCycleDates: cardCycleDates ?? [], ...(operations ? { purchaseOperations } : {}) }
      : { ...backup, installmentPlans };
  if (!needed.length) return withPlans(tombstones || plans ? { ...base, currencyUnits: [] } : base);
  const known = new Map((canonical.currencyUnits ?? []).map(unit => [unit.currency, unit]));
  const currencyUnits = needed.map(code => known.get(code) ?? catalogueUnit(code));
  validateCurrencyUnits(currencyUnits, needed, true);
  return withPlans({ ...base, currencyUnits });
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
  const v8 = header.schema === BACKUP_SCHEMA_V8;
  const v9 = header.schema === BACKUP_SCHEMA_V9;
  const v10 = header.schema === BACKUP_SCHEMA_V10;
  const v11 = header.schema === BACKUP_SCHEMA_V11;
  const v12 = header.schema === BACKUP_SCHEMA_V12;
  const v13 = header.schema === BACKUP_SCHEMA_V13;
  const v14 = header.schema === BACKUP_SCHEMA_V14;
  if (!v1 && !v2 && !v3 && !v4 && !v5 && !v6 && !v7 && !v8 && !v9 && !v10 && !v11 && !v12 && !v13 && !v14) {
    throw new Error('Solo se pueden restaurar copias de FinanzApp de las versiones 1 a 14. Este archivo no es una de ellas; conservalo.');
  }
  const hasTransfers = !v1 && !v2, hasRecurring = hasTransfers && !v3, hasBudgets = hasRecurring && !v4;
  const hasLiabilities = hasBudgets && !v5, hasScopedBudgets = hasLiabilities && !v6, hasIdentity = v8 || v9 || v10 || v11 || v12 || v13 || v14, hasUnits = v9 || v10 || v11 || v12 || v13 || v14;
  const hasDeletions = v10 || v11 || v12 || v13 || v14;
  // v11 (25B2): cards carry `deleted`; a deleted account carries `deletedAt`. Older files carry neither.
  const hasLifecycle = v11 || v12 || v13 || v14;
  // v12 (24T1): instalment plans with their schedules. Older files carry none, and a v1–v11 file never holds an instalment movement.
  const hasPlans = v12 || v13 || v14;
  // v13 (24T2): the cards' exact statement dates. Older files carry none: their cards follow their usual days.
  const hasCycles = v13 || v14;
  // v14 (24T3): devoluciones and adelantos de cuotas. Older files carry none.
  const hasOperations = v14;
  object(value, ['app', 'schema', 'exportedAt', 'moneyUnit', 'accounts', v1 ? 'entries' : 'records',
    ...(hasTransfers ? ['transfers'] : []), ...(hasRecurring ? ['recurring'] : []),
    ...(hasBudgets ? ['budgets'] : []), ...(hasLiabilities ? ['cards', 'debts'] : []),
    ...(hasIdentity ? ['appearances', 'categories'] : []), ...(hasUnits ? ['currencyUnits'] : []), ...(hasPlans ? ['installmentPlans'] : []),
    ...(hasCycles ? ['cardCycleDates'] : []), ...(hasOperations ? ['purchaseOperations'] : [])]);
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
  if (hasUnits && (!Array.isArray(header.currencyUnits) || header.currencyUnits.length > MAX_BACKUP_CURRENCY_UNITS)) {
    throw new Error('La copia contiene demasiadas escalas de moneda o un formato inválido.');
  }
  if (hasPlans && (!Array.isArray(header.installmentPlans) || header.installmentPlans.length > 5000)) {
    throw new Error('La copia contiene demasiados planes de cuotas o un formato inválido.');
  }
  if (hasCycles && (!Array.isArray(header.cardCycleDates) || header.cardCycleDates.length > 20000)) {
    throw new Error('La copia contiene demasiadas fechas de ciclo de tarjetas o un formato inválido.');
  }
  if (hasOperations) {
    const operations = header.purchaseOperations;
    if (!Array.isArray(operations) || operations.length > MAX_BACKUP_OPERATIONS) throw new Error('La copia contiene demasiadas devoluciones o adelantos o un formato inválido.');
    const weight = operations.reduce((sum: number, item) => sum + ((item as { kind?: unknown })?.kind === 'payoff' ? 4 : 1), 0);
    if (rows.length + (header.transfers as unknown[]).length + weight > 25000) throw new Error('La copia supera el límite de movimientos o contiene transferencias inválidas.');
  }
  const accounts = header.accounts.map(a => accountValue(a, hasTransfers, hasLifecycle));
  const records = rows.map((value): EntryRecord => {
    if (v1) return initialRecord(entryValue(value, accounts));
    const record = object(value, ['entry', 'revision', 'voided', 'updatedAt']);
    return { entry: entryValue(record.entry, accounts), revision: record.revision as number, voided: record.voided as boolean, updatedAt: record.updatedAt as string };
  });
  const transfers = hasTransfers ? (header.transfers as unknown[]).map(t => transferValue(t, accounts)) : [];
  const recurring = hasRecurring ? (header.recurring as unknown[]).map(rule => recurringValue(rule, accounts, !hasDeletions)) : [];
  // Only a v7+ file may carry scoped budgets; v5/v6 budgets are read as category budgets.
  const budgets = hasBudgets ? (header.budgets as unknown[]).map(budget => budgetValue(budget, !hasScopedBudgets)) : [];
  const cards = hasLiabilities ? (header.cards as unknown[]).map(card => cardValue(card, accounts, !hasLifecycle)) : [];
  const debts = hasLiabilities ? (header.debts as unknown[]).map(debt => debtValue(debt, accounts, !hasDeletions)) : [];
  // v1–v7 files carry no identity: their accounts show the default look and their categories resolve to presets or history.
  const appearances = hasIdentity ? (header.appearances as unknown[]).map(item => appearanceValue(item, accounts)) : [];
  const categories = hasIdentity ? (header.categories as unknown[]).map(item => categoryValue(item)) : [];
  // A v9 file names the scale of every currency it uses beyond ARS/USD, and nothing else: the
  // units are validated against the catalogue (a disagreeing exponent refuses the file whole)
  // before any amount is read; a v1–v8 file stays frozen to ARS/USD cents.
  const currencyUnits = hasUnits ? (header.currencyUnits as unknown[]).map(unit => unitValue(unit)) : [];
  const installmentPlans = hasPlans ? (header.installmentPlans as unknown[]).map(plan => installmentPlanValue(plan)) : [];
  const cardCycleDates = hasCycles ? (header.cardCycleDates as unknown[]).map(row => cycleDateValue(row)) : [];
  const purchaseOperations = hasOperations ? (header.purchaseOperations as unknown[]).map(row => parsePurchaseOperation(row)) : [];
  const archive: LedgerArchive = { accounts, records, ...(transfers.length ? { transfers } : {}),
    ...(recurring.length ? { recurring } : {}), ...(budgets.length ? { budgets } : {}),
    ...(cards.length ? { cards } : {}), ...(debts.length ? { debts } : {}),
    ...(appearances.length ? { appearances } : {}), ...(categories.length ? { categories } : {}),
    ...(hasUnits ? { currencyUnits } : {}), ...(installmentPlans.length ? { installmentPlans } : {}),
    ...(cardCycleDates.length ? { cardCycleDates } : {}), ...(purchaseOperations.length ? { purchaseOperations } : {}) };
  if (!hasUnits) assertLegacyCurrencies(archive, LEGACY_IMPORT_MESSAGE);
  else validateCurrencyUnits(currencyUnits, currenciesNeedingUnits(archive), true);
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
  /** Scales the copy pins that this device has not pinned yet: written before any row that needs them, in the same transaction. */
  currencyUnits: CurrencyUnit[];
  /** Currencies whose pinned scale differs between the copy and this device: nothing is imported while any exists. */
  scaleConflicts: IsoCurrencyCode[];
  /** 24T1: plans the copy holds and this device lacks, with their schedules. */
  installmentPlans: InstallmentPlan[];
  /** 24T2: the exact statement dates of the cards this copy adds (a card already on this device keeps its own). */
  cardCycleDates: CardCycleDates[];
  /** 24T3: devoluciones and adelantos the copy holds and this device lacks (inserted after records and plans). */
  purchaseOperations: PurchaseOperation[];
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
  const planMap = new Map((current.installmentPlans ?? []).map(plan => [plan.id, plan]));
  const installmentPlans: InstallmentPlan[] = [];
  const transfers: TransferRecord[] = [];
  const recurring: RecurringRule[] = [];
  const budgets: MonthlyBudget[] = [];
  const cards: CreditCardProfile[] = [];
  const debts: PersonalDebtProfile[] = [];
  const appearances: AccountAppearance[] = [];
  const categories: CategoryDefinition[] = [];
  const currencyUnits: CurrencyUnit[] = [];
  const scaleConflicts: IsoCurrencyCode[] = [];
  const accounts: Account[] = [], records: EntryRecord[] = [];
  let conflicts = 0, identical = 0;
  // Scales first: a copy that pins a currency at another exponent than this device is a conflict,
  // never a conversion; a scale this device lacks is pinned by the import; a shared scale is identical.
  const localUnits = new Map((current.currencyUnits ?? []).map(unit => [unit.currency, unit]));
  for (const unit of incoming.currencyUnits ?? []) {
    const existing = localUnits.get(unit.currency);
    if (!existing) currencyUnits.push(unit);
    else if (existing.minorUnitExponent === unit.minorUnitExponent) identical++;
    else { conflicts++; scaleConflicts.push(unit.currency); }
  }
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
  for (const plan of incoming.installmentPlans ?? []) {
    const existing = planMap.get(plan.id);
    if (!existing) installmentPlans.push(plan);
    else if (sameInstallmentPlan(existing, plan)) identical++;
    else conflicts++;
  }
  // 24T2: a card's chain travels with the card. For a card this copy adds, its rows are added; for a card already here,
  // an identical row is identical and any other row contradicts the local calendar (the card's revision moves with each
  // calendar change, so an identical card already has the same chain).
  const addedCards = new Set(cards.map(card => card.id));
  const localCycles = new Map((current.cardCycleDates ?? []).map(row => [row.cardId + '|' + row.sequence, row]));
  const cardCycleDates: CardCycleDates[] = [];
  for (const row of incoming.cardCycleDates ?? []) {
    const existing = localCycles.get(row.cardId + '|' + row.sequence);
    if (existing && sameCardCycleDate(existing, row)) identical++;
    else if (!existing && addedCards.has(row.cardId)) cardCycleDates.push(row);
    else conflicts++;
  }
  // 24T3: operations are additive by id; the same id with another revision or undone state is a conflict, like a movement.
  const operationMap = new Map((current.purchaseOperations ?? []).map(operation => [operation.id, operation]));
  const purchaseOperations: PurchaseOperation[] = [];
  for (const operation of incoming.purchaseOperations ?? []) {
    const existing = operationMap.get(operation.id);
    if (!existing) purchaseOperations.push(operation);
    else if (samePurchaseOperation(existing, operation)) identical++;
    else conflicts++;
  }
  const combined: LedgerArchive = { accounts: [...current.accounts, ...accounts], records: [...current.records, ...records],
    transfers: [...current.transfers ?? [], ...transfers], recurring: [...current.recurring ?? [], ...recurring],
    budgets: [...current.budgets ?? [], ...budgets], cards: [...current.cards ?? [], ...cards],
    debts: [...current.debts ?? [], ...debts], appearances: [...current.appearances ?? [], ...appearances],
    categories: [...current.categories ?? [], ...categories],
    ...(current.currencyUnits || incoming.currencyUnits ? { currencyUnits: [...current.currencyUnits ?? [], ...currencyUnits] } : {}),
    ...(current.installmentPlans?.length || installmentPlans.length ? { installmentPlans: [...current.installmentPlans ?? [], ...installmentPlans] } : {}),
    ...(current.cardCycleDates?.length || cardCycleDates.length ? { cardCycleDates: [...current.cardCycleDates ?? [], ...cardCycleDates] } : {}),
    ...(current.purchaseOperations?.length || purchaseOperations.length ? { purchaseOperations: [...current.purchaseOperations ?? [], ...purchaseOperations] } : {}) };
  // A guard that involves a devolución or an adelanto reads as the one import refusal (A20).
  if (!conflicts) validateArchive(combined, 'import');
  return { baseline: archiveKey(current), accounts, records, transfers, recurring, budgets, cards, debts, appearances, categories, currencyUnits, scaleConflicts, installmentPlans, cardCycleDates,
    purchaseOperations, identical, conflicts,
    before: liquidTotalsByCurrency(snapshotFromArchive(current), current.cards, current.debts),
    after: conflicts ? null : liquidTotalsByCurrency(snapshotFromArchive(combined), combined.cards, combined.debts) };
}

// ---- 24T3: purchase operations, written as one pure step (storage runs it inside one exclusive transaction) ----------

/** A new devolución or adelanto (A8): `archive` is the ledger after the plan's catch-up through `todayISO` (the creation
 * helpers allocated against it); the id must be new (a retry with the same inputs is answered by storage before this,
 * `sameOperationInputs`); the creation-only checks run, then `validateArchive` once on the result. */
export function applyNewOperation(archive: LedgerArchive, operation: PurchaseOperation, todayISO: string): LedgerArchive {
  if ((archive.purchaseOperations ?? []).some(item => item.id === operation.id)) throw new Error(OPERATION_EXISTS_MESSAGE);
  // A new operation is live at its first revision (an undo or a restore is `applyOperationChange`).
  if (operation.revision !== 0 || operation.voided) throw new Error(OPERATION_INVALID_MESSAGE);
  assertOperationApplicable(archive, operation, 'create', todayISO);
  // A8: a plan operation is allocated on the plan caught up through today. A share whose statement closed and is still
  // unrecorded would otherwise be reduced or brought forward as future (a past statement rewritten): the allocation was
  // computed on a stale ledger, so the person reviews it again.
  const planId = operationPlanId(operation);
  if (planId !== null && planCatchUpInserts(archive, planId, todayISO).length) throw new Error(OPERATION_CHANGED_MESSAGE);
  const next = withOperation(archive, operation);
  validateArchive(next, 'create');
  return next;
}

/** An undo or a restore (A8): the creation-only checks for the action (A7, A9), the change applied, the plan's catch-up
 * through `todayISO` appended (shares whose closing passed are recorded on their own closing dates, once), and
 * `validateArchive` once on the result, worded for the action. Returns the next archive and the movements storage inserts
 * beside the operation row. The same call is the UI's canUndo/canRestore dry run. */
export function applyOperationChange(archive: LedgerArchive, change: OperationChange, todayISO: string): { archive: LedgerArchive; inserts: EntryRecord[] } {
  validateOperationChange(change);
  const stored = (archive.purchaseOperations ?? []).find(item => item.id === change.before.id);
  if (!stored || !samePurchaseOperation(stored, change.before)) throw new Error(OPERATION_STATE_MESSAGE);
  assertOperationApplicable(archive, change.after, change.action, todayISO);
  const next = withOperation(archive, change.after);
  const planId = operationPlanId(change.after);
  const inserts = planId === null ? [] : planCatchUpInserts(next, planId, todayISO);
  const result = inserts.length ? { ...next, records: [...next.records, ...inserts] } : next;
  validateArchive(result, change.action);
  return { archive: result, inserts };
}
