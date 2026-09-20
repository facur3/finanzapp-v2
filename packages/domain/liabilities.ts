import { accountBalanceMinor, validDateISO, type Account, type Currency, type LedgerSnapshot } from './ledger.ts';

export interface CreditCardProfile {
  id: string;
  accountId: string;
  issuer: string;
  last4: string;
  creditLimitMinor: number | null;
  closingDay: number;
  dueDay: number;
  active: boolean;
  createdAt: string;
  revision: number;
  updatedAt: string;
}

export type DebtDirection = 'owed_by_me' | 'owed_to_me';

export interface PersonalDebtProfile {
  id: string;
  accountId: string;
  direction: DebtDirection;
  counterparty: string;
  dueDateISO: string | null;
  note: string;
  active: boolean;
  createdAt: string;
  revision: number;
  updatedAt: string;
}

const CARD_KEYS = ['id', 'accountId', 'issuer', 'last4', 'creditLimitMinor', 'closingDay', 'dueDay',
  'active', 'createdAt', 'revision', 'updatedAt'] as const;
const DEBT_KEYS = ['id', 'accountId', 'direction', 'counterparty', 'dueDateISO', 'note',
  'active', 'createdAt', 'revision', 'updatedAt'] as const;

function validId(value: string): boolean {
  return typeof value === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(value);
}
function validTimestamp(value: string): boolean {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}
function validRevision(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}
function safeMinor(value: number): boolean {
  return Number.isSafeInteger(value) && Math.abs(value) <= Number.MAX_SAFE_INTEGER;
}
function accountFor(accountId: string, accounts: Account[]): Account {
  const account = accounts.find(item => item.id === accountId);
  if (!account) throw new Error('La obligación debe usar una cuenta interna existente.');
  return account;
}
function validateVersion(createdAt: string, revision: number, updatedAt: string): void {
  if (!validTimestamp(createdAt) || !validTimestamp(updatedAt) || !validRevision(revision)) {
    throw new Error('Estado de obligación inválido.');
  }
  if (revision === 0 && createdAt !== updatedAt) throw new Error('Estado inicial de obligación inválido.');
}

export function validateCreditCardProfile(card: CreditCardProfile, accounts: Account[]): void {
  if (!validId(card.id) || !validId(card.accountId)) throw new Error('Identificador de tarjeta inválido.');
  accountFor(card.accountId, accounts);
  if (typeof card.issuer !== 'string' || card.issuer.length > 80) throw new Error('El emisor debe tener hasta 80 caracteres.');
  if (typeof card.last4 !== 'string' || (card.last4 && !/^\d{4}$/.test(card.last4))) {
    throw new Error('Los últimos cuatro dígitos deben tener exactamente 4 números.');
  }
  if (card.creditLimitMinor !== null && (!safeMinor(card.creditLimitMinor) || card.creditLimitMinor <= 0)) {
    throw new Error('El límite debe ser mayor que cero.');
  }
  if (!Number.isInteger(card.closingDay) || card.closingDay < 1 || card.closingDay > 31
    || !Number.isInteger(card.dueDay) || card.dueDay < 1 || card.dueDay > 31) {
    throw new Error('Elegí días de cierre y vencimiento entre 1 y 31.');
  }
  if (typeof card.active !== 'boolean') throw new Error('Estado de tarjeta inválido.');
  validateVersion(card.createdAt, card.revision, card.updatedAt);
}

export function validatePersonalDebtProfile(debt: PersonalDebtProfile, accounts: Account[]): void {
  if (!validId(debt.id) || !validId(debt.accountId)) throw new Error('Identificador de deuda inválido.');
  accountFor(debt.accountId, accounts);
  if (!['owed_by_me', 'owed_to_me'].includes(debt.direction)) throw new Error('Elegí si debés o te deben.');
  if (typeof debt.counterparty !== 'string' || !debt.counterparty.trim() || debt.counterparty.length > 80) {
    throw new Error('Ingresá una persona o concepto de hasta 80 caracteres.');
  }
  if (debt.dueDateISO !== null && !validDateISO(debt.dueDateISO)) throw new Error('La fecha de vencimiento no es válida.');
  if (typeof debt.note !== 'string' || debt.note.length > 120) throw new Error('La nota debe tener hasta 120 caracteres.');
  if (typeof debt.active !== 'boolean') throw new Error('Estado de deuda inválido.');
  validateVersion(debt.createdAt, debt.revision, debt.updatedAt);
}

export function validateLiabilityProfiles(cards: CreditCardProfile[], debts: PersonalDebtProfile[], accounts: Account[]): void {
  const ids = new Set<string>();
  const accountIds = new Set<string>();
  for (const card of cards) {
    validateCreditCardProfile(card, accounts);
    if (ids.has(card.id)) throw new Error('La copia repite una tarjeta.');
    if (accountIds.has(card.accountId)) throw new Error('Una cuenta interna no puede representar dos obligaciones.');
    ids.add(card.id); accountIds.add(card.accountId);
  }
  for (const debt of debts) {
    validatePersonalDebtProfile(debt, accounts);
    if (ids.has(debt.id)) throw new Error('La copia repite una obligación.');
    if (accountIds.has(debt.accountId)) throw new Error('Una cuenta interna no puede representar dos obligaciones.');
    ids.add(debt.id); accountIds.add(debt.accountId);
  }
}

export function sameCreditCardProfile(a: CreditCardProfile, b: CreditCardProfile): boolean {
  return CARD_KEYS.every(key => a[key] === b[key]);
}
export function samePersonalDebtProfile(a: PersonalDebtProfile, b: PersonalDebtProfile): boolean {
  return DEBT_KEYS.every(key => a[key] === b[key]);
}

export function hiddenLiabilityAccountIds(cards: CreditCardProfile[] = [], debts: PersonalDebtProfile[] = []): Set<string> {
  return new Set([...cards.map(card => card.accountId), ...debts.map(debt => debt.accountId)]);
}

function safeBigInt(value: bigint): number {
  if (value > BigInt(Number.MAX_SAFE_INTEGER) || value < -BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error('El saldo supera el rango seguro.');
  }
  return Number(value);
}

export function liquidTotalsByCurrency(snapshot: LedgerSnapshot, cards: CreditCardProfile[] = [], debts: PersonalDebtProfile[] = []): Partial<Record<Currency, number>> {
  const hidden = hiddenLiabilityAccountIds(cards, debts);
  const totals = new Map<Currency, bigint>();
  for (const account of snapshot.accounts) {
    if (hidden.has(account.id)) continue;
    const balance = BigInt(accountBalanceMinor(account, snapshot.entries, snapshot.transfers));
    totals.set(account.currency, (totals.get(account.currency) ?? 0n) + balance);
  }
  return Object.fromEntries([...totals].map(([currency, value]) => [currency, safeBigInt(value)]));
}

export function cardDebtMinor(card: CreditCardProfile, snapshot: LedgerSnapshot): number {
  const account = accountFor(card.accountId, snapshot.accounts);
  return Math.max(0, -accountBalanceMinor(account, snapshot.entries, snapshot.transfers));
}
export function cardCreditMinor(card: CreditCardProfile, snapshot: LedgerSnapshot): number {
  const account = accountFor(card.accountId, snapshot.accounts);
  return Math.max(0, accountBalanceMinor(account, snapshot.entries, snapshot.transfers));
}
export function cardAvailableLimitMinor(card: CreditCardProfile, snapshot: LedgerSnapshot): number | null {
  if (card.creditLimitMinor === null) return null;
  return card.creditLimitMinor - cardDebtMinor(card, snapshot);
}

export function debtOutstandingMinor(debt: PersonalDebtProfile, snapshot: LedgerSnapshot): number {
  const account = accountFor(debt.accountId, snapshot.accounts);
  const balance = accountBalanceMinor(account, snapshot.entries, snapshot.transfers);
  return debt.direction === 'owed_by_me' ? Math.max(0, -balance) : Math.max(0, balance);
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0, 12).getDate();
}
function iso(year: number, month: number, day: number): string {
  return [year, String(month + 1).padStart(2, '0'), String(day).padStart(2, '0')].join('-');
}
export function nextDayOfMonthISO(referenceISO: string, requestedDay: number): string {
  if (!validDateISO(referenceISO) || !Number.isInteger(requestedDay) || requestedDay < 1 || requestedDay > 31) {
    throw new Error('Fecha mensual inválida.');
  }
  const [year, month, day] = referenceISO.split('-').map(Number);
  let y = year, m = month - 1;
  let candidateDay = Math.min(requestedDay, daysInMonth(y, m));
  let candidate = iso(y, m, candidateDay);
  if (candidate < referenceISO) {
    m += 1;
    if (m > 11) { m = 0; y += 1; }
    candidateDay = Math.min(requestedDay, daysInMonth(y, m));
    candidate = iso(y, m, candidateDay);
  }
  return candidate;
}
