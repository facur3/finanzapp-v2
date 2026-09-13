import type { Account, Currency, Entry, EntryKind, Transfer } from '@finanzapp/domain';

export type EntryFilter = 'all' | EntryKind;
export type EntrySection = { dateISO: string; data: Entry[] };
const searchable = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es-AR');

// Filtering never changes stored data or adds currencies together.
export function selectEntries(entries: Entry[], accounts: Account[], filter: EntryFilter = 'all', query = '', accountId?: string) {
  const names = new Map(accounts.map(account => [account.id, account.name]));
  const terms = searchable(query).trim().split(/\s+/).filter(Boolean);
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
