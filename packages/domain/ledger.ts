/** Native pilot ledger. All money uses exact integer minor units of one currency per
 * account (cents for ARS and USD, the only currencies production offers today).
 * Existing legacy float rules are deliberately unchanged during migration. */
import { LEDGER_CURRENCIES, assertLedgerCurrency, assertStorableCurrency, isLegacyCurrency, sortCurrencies,
  type CurrencyGate, type IsoCurrencyCode } from './currency.ts';

/** The currency of an account: any ISO 4217 code the catalogue knows. Which codes a row may
 * actually hold is decided by `validateAccount` (read acceptance: a storable fiat currency)
 * and `validateNewAccount` (the creation gate); `LegacyCurrency` names the two that rows and
 * backups from before Producto 24B can carry. */
export type Currency = IsoCurrencyCode;
export type { LegacyCurrency } from './currency.ts';
export type EntryKind = 'expense' | 'income';

/** Thrown when an export format that records no scale (backup v1 and v8) meets a currency
 * other than ARS or USD: the file would be misread as cents. Producto 24B's backup v9 lifts it. */
export const LEGACY_EXPORT_MESSAGE = 'Esta versión exporta copias solo con cuentas y presupuestos en ARS o USD. No se exportó nada.';

export interface Account {
  id: string;
  name: string;
  currency: Currency;
  openingMinor: number;
  createdAt: string;
  revision?: number;
  updatedAt?: string;
}

export interface Entry {
  id: string;
  accountId: string;
  kind: EntryKind;
  amountMinor: number;
  merchant: string;
  category: string;
  dateISO: string;
  createdAt: string;
}

export interface LedgerSnapshot {
  accounts: Account[];
  entries: Entry[];
  transfers?: Transfer[];
}

/** A single internal transfer owns both legs; it is never spending or income. */
export interface Transfer {
  id: string;
  fromAccountId: string;
  toAccountId: string;
  amountMinor: number;
  note: string;
  dateISO: string;
  createdAt: string;
}

export function formatMinorUnits(minor: number): string {
  if (!Number.isSafeInteger(minor)) throw new Error('Monto inválido.');
  const absolute = Math.abs(minor);
  const whole = Math.floor(absolute / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${minor < 0 ? '-' : ''}${whole},${String(absolute % 100).padStart(2, '0')}`;
}

// Strict monetary input: don't turn letters, malformed grouping or extra
// decimals into an accidental debit. Decimal keyboard: comma OR dot supported.
export function parseMinorUnits(raw: string): number {
  const input = raw.trim();
  if (!input || input.length > 24) throw new Error('Ingresá un monto válido.');
  const negative = input.startsWith('-');
  const unsigned = negative ? input.slice(1) : input;
  let normalized: string;
  if (/^\d+(?:[.,]\d{1,2})?$/.test(unsigned)) {
    normalized = unsigned.replace(',', '.');
  } else if (/^[1-9]\d{0,2}(?:\.\d{3})+(?:,\d{1,2})?$/.test(unsigned)) {
    normalized = unsigned.replace(/\./g, '').replace(',', '.');
  } else if (/^[1-9]\d{0,2}(?:,\d{3})+(?:\.\d{1,2})?$/.test(unsigned)) {
    normalized = unsigned.replace(/,/g, '');
  } else {
    throw new Error('Usá números con hasta dos decimales.');
  }
  const [whole, fraction = ''] = normalized.split('.');
  const minor = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(minor)) throw new Error('El monto es demasiado grande.');
  return negative ? -minor : minor;
}

export function validDateISO(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(year, month - 1, day, 12);
  return year >= 1900 && year <= 9999 && date.getFullYear() === year
    && date.getMonth() === month - 1 && date.getDate() === day;
}

function validId(value: string): boolean {
  return typeof value === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(value);
}

function validTimestamp(value: string): boolean {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

/** Read acceptance: what a stored account (a SQLite row, a backup, a validated archive) may
 * look like. The currency must be a storable ISO fiat code, never checked against the
 * creation gate, so a currency that stops being offered keeps its rows readable. */
export function validateAccount(account: Account): void {
  if (!validId(account.id) || typeof account.name !== 'string' || !account.name.trim() || account.name.length > 80) {
    throw new Error('Ingresá un nombre de cuenta de hasta 80 caracteres.');
  }
  assertStorableCurrency(account.currency);
  if (!Number.isSafeInteger(account.openingMinor)) throw new Error('Saldo inicial inválido.');
  if (!validTimestamp(account.createdAt)) throw new Error('Fecha de creación inválida.');
  if (account.revision !== undefined || account.updatedAt !== undefined) {
    if (!Number.isSafeInteger(account.revision) || account.revision! < 0 || !validTimestamp(account.updatedAt!)
      || (account.revision === 0 && account.updatedAt !== account.createdAt)) throw new Error('Versión de cuenta inválida.');
  }
}

/** The creation gate on top of read acceptance: a new account, card or debt may only hold a
 * currency the gate offers (`LEDGER_CURRENCIES` in production; tests pass an explicit set). */
export function validateNewAccount(account: Account, gate: CurrencyGate = LEDGER_CURRENCIES): void {
  validateAccount(account);
  assertLedgerCurrency(account.currency, gate);
}

/** The ids of the accounts held in one currency: the scope every report, budget summary and
 * month summary filters by. A code that is not storable is refused with its own error. */
export function accountIdsInCurrency(accounts: readonly Account[], currency: Currency): Set<string> {
  assertStorableCurrency(currency);
  return new Set(accounts.filter(account => account.currency === currency).map(account => account.id));
}

export function validateEntry(entry: Entry, accounts: Account[]): void {
  if (!validId(entry.id) || !validId(entry.accountId)) throw new Error('Identificador inválido.');
  if (!accounts.some(account => account.id === entry.accountId)) throw new Error('Elegí una cuenta existente.');
  if (!['expense', 'income'].includes(entry.kind)) throw new Error('Elegí gasto o ingreso.');
  if (!Number.isSafeInteger(entry.amountMinor) || entry.amountMinor <= 0) {
    throw new Error('El monto debe ser mayor que cero y tener hasta dos decimales.');
  }
  if (typeof entry.merchant !== 'string' || !entry.merchant.trim() || entry.merchant.length > 120) {
    throw new Error('Ingresá un comercio o concepto de hasta 120 caracteres.');
  }
  if (typeof entry.category !== 'string' || !entry.category.trim() || entry.category.length > 60) {
    throw new Error('Ingresá una categoría de hasta 60 caracteres.');
  }
  if (!validDateISO(entry.dateISO) || !validTimestamp(entry.createdAt)) throw new Error('Elegí una fecha válida.');
}

export function validateTransfer(transfer: Transfer, accounts: Account[]): void {
  if (![transfer.id, transfer.fromAccountId, transfer.toAccountId].every(validId)) throw new Error('Identificador inválido.');
  const from = accounts.find(a => a.id === transfer.fromAccountId), to = accounts.find(a => a.id === transfer.toAccountId);
  if (!from || !to || from.id === to.id) throw new Error('Elegí dos cuentas distintas.');
  if (from.currency !== to.currency) throw new Error('Las dos cuentas deben tener la misma moneda.');
  if (!Number.isSafeInteger(transfer.amountMinor) || transfer.amountMinor <= 0) throw new Error('Ingresá un monto mayor que cero y con hasta dos decimales.');
  if (typeof transfer.note !== 'string' || transfer.note.length > 120) throw new Error('Usá una nota de hasta 120 caracteres.');
  if (!validDateISO(transfer.dateISO) || !validTimestamp(transfer.createdAt)) throw new Error('Elegí una fecha válida.');
}

export function accountBalanceMinor(account: Account, entries: Entry[], transfers: Transfer[] = []): number {
  // Exact accumulation is order independent, including near the safe boundary.
  // Otherwise insertion order can validate a balance that date-sorted reads reject.
  let total = entries.filter(entry => entry.accountId === account.id).reduce((sum, entry) =>
    sum + BigInt(entry.kind === 'expense' ? -entry.amountMinor : entry.amountMinor), BigInt(account.openingMinor));
  for (const transfer of transfers) {
    if (transfer.fromAccountId === account.id) total -= BigInt(transfer.amountMinor);
    if (transfer.toAccountId === account.id) total += BigInt(transfer.amountMinor);
  }
  if (total > BigInt(Number.MAX_SAFE_INTEGER) || total < -BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('El saldo supera el rango seguro.');
  return Number(total);
}

/** One total per currency present in the ledger, keyed in grouping order (ARS, USD, then by
 * code). Currencies are never added together: a rate is Producto 24C's job. Every currency's
 * total is checked against the safe range, and a currency with accounts always has a key, so
 * a missing key means "no account holds it", never a dropped total. */
export function totalsByCurrency(snapshot: LedgerSnapshot): Partial<Record<Currency, number>> {
  const sums = new Map<Currency, bigint>();
  for (const account of snapshot.accounts) {
    assertStorableCurrency(account.currency);
    sums.set(account.currency, (sums.get(account.currency) ?? 0n) + BigInt(accountBalanceMinor(account, snapshot.entries, snapshot.transfers)));
  }
  const result: Partial<Record<Currency, number>> = {};
  for (const currency of sortCurrencies(sums.keys())) {
    const total = sums.get(currency)!;
    if (total > BigInt(Number.MAX_SAFE_INTEGER) || total < -BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('El total supera el rango seguro.');
    result[currency] = Number(total);
  }
  return result;
}

export function createPilotBackup(snapshot: LedgerSnapshot, now: Date = new Date()) {
  if (snapshot.transfers?.length || snapshot.accounts.some(a => a.revision !== undefined || a.updatedAt !== undefined)) {
    throw new Error('Usá la copia actual para conservar transferencias y correcciones de cuentas.');
  }
  snapshot.accounts.forEach(validateAccount);
  snapshot.entries.forEach(entry => validateEntry(entry, snapshot.accounts));
  // The v1 file records one money unit and no scale: only ARS/USD cents can be written to it.
  if (snapshot.accounts.some(account => !isLegacyCurrency(account.currency))) throw new Error(LEGACY_EXPORT_MESSAGE);
  return {
    app: 'FinanzApp',
    schema: 'finanzapp.native-pilot.v1',
    exportedAt: now.toISOString(),
    moneyUnit: 'integer-minor-units',
    accounts: snapshot.accounts,
    entries: snapshot.entries,
  };
}
