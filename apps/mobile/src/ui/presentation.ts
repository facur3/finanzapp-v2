import { labelFromISO, type Account, type Currency, type Entry, type EntryKind, type Transfer } from '@finanzapp/domain';

export type EntryFilter = 'all' | EntryKind | 'transfer';
const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
// Same abbreviations as the ledger's date labels, independent of the device ICU data.
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** Section label for an activity date: Hoy · 20 sep, Ayer · 19 sep, a weekday
 * within the last week, then the plain date (with the year when it differs). */
export function activityDateLabel(dateISO: string, todayISO: string): string {
  const relative = labelFromISO(dateISO, new Date(todayISO + 'T12:00:00'));
  const [year, month, day] = dateISO.split('-').map(Number);
  const date = new Date(year, month - 1, day, 12);
  if (Number.isNaN(date.getTime())) return relative;
  const short = day + ' ' + MONTHS[month - 1];
  const days = Math.round((Date.parse(todayISO + 'T12:00:00Z') - Date.parse(dateISO + 'T12:00:00Z')) / 86400000);
  if (days === 0) return 'Hoy · ' + short;
  if (days === 1) return 'Ayer · ' + short;
  if (days > 1 && days < 7) return WEEKDAYS[date.getDay()] + ' · ' + short;
  return relative;
}

/** Net recorded flow of one day's entries in one currency (income minus
 * expenses, transfers excluded). Null when the day mixes currencies. */
export function dayNetMinor(entries: Entry[], accounts: Account[]): { currency: Currency; minor: number } | null {
  const currencies = new Map(accounts.map(account => [account.id, account.currency]));
  let currency: Currency | null = null;
  let total = 0n;
  for (const entry of entries) {
    const own = currencies.get(entry.accountId);
    if (!own) return null;
    if (currency && own !== currency) return null;
    currency = own;
    total += BigInt(entry.kind === 'income' ? entry.amountMinor : -entry.amountMinor);
  }
  if (!currency || total > BigInt(Number.MAX_SAFE_INTEGER) || total < -BigInt(Number.MAX_SAFE_INTEGER)) return null;
  return { currency, minor: Number(total) };
}
export type EntrySection = { dateISO: string; data: Entry[] };
const searchable = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es-AR');

// Filtering never changes stored data or adds currencies together.
export function selectEntries(entries: Entry[], accounts: Account[], filter: EntryFilter = 'all', query = '', accountId?: string) {
  const names = new Map(accounts.map(account => [account.id, account.name]));
  const terms = searchable(query).trim().split(/\s+/).filter(Boolean);
  if (filter === 'transfer') return [];
  return entries.filter(entry => {
    if ((filter !== 'all' && entry.kind !== filter) || (accountId && entry.accountId !== accountId)) return false;
    const text = searchable([entry.merchant, entry.category, names.get(entry.accountId) ?? ''].join(' '));
    return terms.every(term => text.includes(term));
  }).sort((a, b) => {
    if (a.dateISO !== b.dateISO) return a.dateISO < b.dateISO ? 1 : -1;
    const created = Date.parse(b.createdAt) - Date.parse(a.createdAt);
    return created || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0);
  });
}

export function groupEntries(entries: Entry[]): EntrySection[] {
  const sections: EntrySection[] = [];
  for (const entry of entries) {
    const last = sections[sections.length - 1];
    if (last?.dateISO === entry.dateISO) last.data.push(entry);
    else sections.push({ dateISO: entry.dateISO, data: [entry] });
  }
  return sections;
}

// A selected USD balance must not open a draft silently defaulting to ARS.
export function initialAccountId(accounts: Account[], accountId?: string, currency?: string): string {
  return accounts.find(account => account.id === accountId)?.id
    ?? accounts.find(account => account.currency === currency)?.id
    ?? accounts[0]?.id ?? '';
}

export function availableCurrencies(accounts: Account[]): Currency[] {
  return (['ARS', 'USD'] as Currency[]).filter(currency => accounts.some(account => account.currency === currency));
}

export type ActivityItem = { type: 'entry'; key: string; value: Entry } | { type: 'transfer'; key: string; value: Transfer };
export function selectTransfers(transfers: Transfer[], accounts: Account[], query = '', accountId?: string): Transfer[] {
  const names = new Map(accounts.map(a => [a.id, a.name]));
  const terms = searchable(query).trim().split(/\s+/).filter(Boolean);
  return transfers.filter(t => (!accountId || t.fromAccountId === accountId || t.toAccountId === accountId)
    && terms.every(term => searchable(['transferencia', t.note, names.get(t.fromAccountId), names.get(t.toAccountId)].join(' ')).includes(term)));
}
export function mergeActivity(entries: Entry[], transfers: Transfer[] = []): ActivityItem[] {
  const items: ActivityItem[] = [...entries.map(value => ({ type: 'entry' as const, key: 'entry-' + value.id, value })),
    ...transfers.map(value => ({ type: 'transfer' as const, key: 'transfer-' + value.id, value }))];
  return items.sort((a, b) => a.value.dateISO !== b.value.dateISO ? (a.value.dateISO < b.value.dateISO ? 1 : -1)
    : Date.parse(b.value.createdAt) - Date.parse(a.value.createdAt) || b.key.localeCompare(a.key));
}
export function groupActivity(items: ActivityItem[]): { dateISO: string; data: ActivityItem[] }[] {
  const sections: { dateISO: string; data: ActivityItem[] }[] = [];
  for (const item of items) {
    const last = sections[sections.length - 1];
    if (last?.dateISO === item.value.dateISO) last.data.push(item);
    else sections.push({ dateISO: item.value.dateISO, data: [item] });
  }
  return sections;
}
