/** Native pilot ledger. All money uses exact integer cents (ARS/USD only).
 * Existing legacy float rules are deliberately unchanged during migration. */
export type Currency = 'ARS' | 'USD';
export type EntryKind = 'expense' | 'income';

export interface Account {
  id: string;
  name: string;
  currency: Currency;
  openingMinor: number;
  createdAt: string;
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

export function validateAccount(account: Account): void {
  if (!validId(account.id) || typeof account.name !== 'string' || !account.name.trim() || account.name.length > 80) {
    throw new Error('Ingresá un nombre de cuenta de hasta 80 caracteres.');
  }
  if (!['ARS', 'USD'].includes(account.currency)) throw new Error('Elegí ARS o USD.');
  if (!Number.isSafeInteger(account.openingMinor)) throw new Error('Saldo inicial inválido.');
  if (!validTimestamp(account.createdAt)) throw new Error('Fecha de creación inválida.');
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

export function accountBalanceMinor(account: Account, entries: Entry[]): number {
  return entries.filter(entry => entry.accountId === account.id).reduce((total, entry) => {
    const next = total + (entry.kind === 'expense' ? -entry.amountMinor : entry.amountMinor);
    if (!Number.isSafeInteger(next)) throw new Error('El saldo supera el rango seguro.');
    return next;
  }, account.openingMinor);
}

// Never sum currencies without a real exchange rate.
export function totalsByCurrency(snapshot: LedgerSnapshot): Partial<Record<Currency, number>> {
  const result: Partial<Record<Currency, number>> = {};
  for (const account of snapshot.accounts) {
    const next = (result[account.currency] ?? 0) + accountBalanceMinor(account, snapshot.entries);
    if (!Number.isSafeInteger(next)) throw new Error('El total supera el rango seguro.');
    result[account.currency] = next;
  }
  return result;
}

export function createPilotBackup(snapshot: LedgerSnapshot, now: Date = new Date()) {
  snapshot.accounts.forEach(validateAccount);
  snapshot.entries.forEach(entry => validateEntry(entry, snapshot.accounts));
  return {
    app: 'FinanzApp',
    schema: 'finanzapp.native-pilot.v1',
    exportedAt: now.toISOString(),
    moneyUnit: 'integer-minor-units',
    accounts: snapshot.accounts,
    entries: snapshot.entries,
  };
}
