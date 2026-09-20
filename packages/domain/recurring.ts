import { validDateISO, validateEntry, type Account, type Entry, type EntryKind } from './ledger.ts';

export type RecurringFrequency = 'weekly' | 'monthly' | 'yearly';

export interface RecurringRule {
  id: string;
  accountId: string;
  kind: EntryKind;
  amountMinor: number;
  merchant: string;
  category: string;
  frequency: RecurringFrequency;
  anchorDateISO: string;
  nextDateISO: string;
  active: boolean;
  createdAt: string;
  revision: number;
  updatedAt: string;
}

const RECURRING_KEYS = ['id', 'accountId', 'kind', 'amountMinor', 'merchant', 'category', 'frequency',
  'anchorDateISO', 'nextDateISO', 'active', 'createdAt', 'revision', 'updatedAt'] as const;

function validId(value: string): boolean {
  return typeof value === 'string' && /^[a-zA-Z0-9_-]{1,70}$/.test(value);
}
function validTimestamp(value: string): boolean {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}
function fromISO(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}
function toISO(date: Date): string {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}
function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0, 12).getDate();
}

export function validateRecurringRule(rule: RecurringRule, accounts: Account[]): void {
  if (!validId(rule.id) || !validId(rule.accountId)) throw new Error('Identificador de recurrente inválido.');
  if (!accounts.some(account => account.id === rule.accountId)) throw new Error('Elegí una cuenta existente para el recurrente.');
  if (!['expense', 'income'].includes(rule.kind)) throw new Error('Elegí gasto o ingreso.');
  if (!Number.isSafeInteger(rule.amountMinor) || rule.amountMinor <= 0) throw new Error('El monto recurrente debe ser mayor que cero.');
  if (typeof rule.merchant !== 'string' || !rule.merchant.trim() || rule.merchant.length > 120) {
    throw new Error('Ingresá un concepto de hasta 120 caracteres.');
  }
  if (typeof rule.category !== 'string' || !rule.category.trim() || rule.category.length > 60) {
    throw new Error('Ingresá una categoría de hasta 60 caracteres.');
  }
  if (!['weekly', 'monthly', 'yearly'].includes(rule.frequency)) throw new Error('Elegí una frecuencia válida.');
  if (!validDateISO(rule.anchorDateISO) || !validDateISO(rule.nextDateISO) || rule.nextDateISO < rule.anchorDateISO) {
    throw new Error('Elegí una próxima fecha válida.');
  }
  if (typeof rule.active !== 'boolean' || !Number.isSafeInteger(rule.revision) || rule.revision < 0
    || !validTimestamp(rule.createdAt) || !validTimestamp(rule.updatedAt)) {
    throw new Error('Estado de recurrente inválido.');
  }
  if (rule.revision === 0 && rule.updatedAt !== rule.createdAt) throw new Error('Estado inicial de recurrente inválido.');
}

export function sameRecurringRule(a: RecurringRule, b: RecurringRule): boolean {
  return RECURRING_KEYS.every(key => a[key] === b[key]);
}

export function advanceRecurringDate(currentISO: string, frequency: RecurringFrequency, anchorISO: string): string {
  if (!validDateISO(currentISO) || !validDateISO(anchorISO)) throw new Error('Fecha recurrente inválida.');
  const current = fromISO(currentISO);
  const anchor = fromISO(anchorISO);
  if (frequency === 'weekly') {
    current.setDate(current.getDate() + 7);
    return toISO(current);
  }
  if (frequency === 'monthly') {
    const nextMonth = current.getMonth() + 1;
    const year = current.getFullYear() + Math.floor(nextMonth / 12);
    const month = ((nextMonth % 12) + 12) % 12;
    return toISO(new Date(year, month, Math.min(anchor.getDate(), daysInMonth(year, month)), 12));
  }
  const year = current.getFullYear() + 1;
  const month = anchor.getMonth();
  return toISO(new Date(year, month, Math.min(anchor.getDate(), daysInMonth(year, month)), 12));
}

export function recurringOccurrencesThrough(rule: RecurringRule, throughDateISO: string, limit = 366): string[] {
  if (!validDateISO(throughDateISO)) throw new Error('Fecha de procesamiento inválida.');
  if (!rule.active || rule.nextDateISO > throughDateISO) return [];
  const dates: string[] = [];
  let next = rule.nextDateISO;
  while (next <= throughDateISO) {
    dates.push(next);
    if (dates.length > limit) throw new Error('Hay demasiados vencimientos pendientes. Revisá la próxima fecha del recurrente.');
    const advanced = advanceRecurringDate(next, rule.frequency, rule.anchorDateISO);
    if (advanced <= next) throw new Error('La frecuencia recurrente no avanza.');
    next = advanced;
  }
  return dates;
}

export function recurringEntryId(ruleId: string, occurrenceDateISO: string): string {
  const value = `rec_${ruleId}_${occurrenceDateISO.replace(/-/g, '')}`;
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(value)) throw new Error('Identificador recurrente demasiado largo.');
  return value;
}

export function materializeRecurringRule(rule: RecurringRule, accounts: Account[], throughDateISO: string, nowISO: string) {
  validateRecurringRule(rule, accounts);
  if (!validTimestamp(nowISO)) throw new Error('Fecha de actualización inválida.');
  const dates = recurringOccurrencesThrough(rule, throughDateISO);
  if (!dates.length) return { entries: [] as Entry[], rule };
  const entries = dates.map(dateISO => {
    const entry: Entry = {
      id: recurringEntryId(rule.id, dateISO),
      accountId: rule.accountId,
      kind: rule.kind,
      amountMinor: rule.amountMinor,
      merchant: rule.merchant.trim(),
      category: rule.category.trim(),
      dateISO,
      createdAt: dateISO + 'T12:00:00.000Z',
    };
    validateEntry(entry, accounts);
    return entry;
  });
  let nextDateISO = rule.nextDateISO;
  for (let index = 0; index < dates.length; index++) {
    nextDateISO = advanceRecurringDate(nextDateISO, rule.frequency, rule.anchorDateISO);
  }
  const nextRule: RecurringRule = { ...rule, nextDateISO, revision: rule.revision + 1, updatedAt: nowISO };
  validateRecurringRule(nextRule, accounts);
  return { entries, rule: nextRule };
}

export function moveRecurringForward(rule: RecurringRule, throughDateISO: string, nowISO: string, accounts: Account[]): RecurringRule {
  validateRecurringRule(rule, accounts);
  if (!validDateISO(throughDateISO) || !validTimestamp(nowISO)) throw new Error('Fecha de recurrente inválida.');
  let nextDateISO = rule.nextDateISO;
  while (nextDateISO < throughDateISO) nextDateISO = advanceRecurringDate(nextDateISO, rule.frequency, rule.anchorDateISO);
  if (nextDateISO === rule.nextDateISO) return rule;
  const next = { ...rule, nextDateISO, revision: rule.revision + 1, updatedAt: nowISO };
  validateRecurringRule(next, accounts);
  return next;
}
