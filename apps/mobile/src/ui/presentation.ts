import { CARD_DELETED_MESSAGE, OPERATION_ACCOUNT_DELETED_MESSAGE, OPERATION_CHANGED_MESSAGE, OPERATION_HISTORY_DELETED_MESSAGE, OPERATION_PLAN_STOPPED_MESSAGE, OPERATION_STATE_MESSAGE, OPERATION_TARGET_MESSAGE, PLAN_CALENDAR_MESSAGE,
  PLAN_CARD_MESSAGE, PLAN_DELETED_MESSAGE, PLAN_MISSING_MESSAGE, PLAN_OPERATION_DATE_MESSAGE, REFUND_AMOUNT_MESSAGE, REFUND_DATE_MESSAGE, REFUND_OVER_MESSAGE,
  REFUND_TARGET_MESSAGE, currenciesPresent, currentMonthISO, liveAccounts, labelFromISO, operationGuardMessages, type Account, type Currency, type Entry, type EntryKind,
  type Transfer } from '@finanzapp/domain';
import { dateFromISO, daysAgo, formatDate, relativeDayName } from '../i18n/format.ts';
import { DEFAULT_LOCALE, type AppLocale } from '../i18n/locale.ts';

export type EntryFilter = 'all' | EntryKind | 'transfer';

/** Section label for an activity date: Hoy · 20 sep, Ayer · 19 sep, a weekday
 * within the last week, then the plain date (with the year when it differs).
 * Names come from the locale tables, never from the device's ICU data. */
export function activityDateLabel(dateISO: string, todayISO: string, locale: AppLocale = DEFAULT_LOCALE): string {
  const date = dateFromISO(dateISO);
  if (!date) return labelFromISO(dateISO, new Date(todayISO + 'T12:00:00'));
  const days = daysAgo(dateISO, todayISO);
  const short = formatDate(dateISO, 'day', locale);
  // relativeDayName gives Hoy / Ayer / Anteayer (Today / Yesterday / a weekday) and weekdays within the week.
  if (days !== null && days >= 0 && days < 7) return relativeDayName(dateISO, todayISO, locale) + ' · ' + short;
  const today = dateFromISO(todayISO);
  return today && today.year === date.year ? short : formatDate(dateISO, 'dayYear', locale);
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

/** What a cash account's month says about its expenses (24T3, A24). Devoluciones are negative expense lines in the
 * month and account they are dated in, so the month's expense total is a net that can fall below zero when they exceed
 * what was bought. The value is never clamped or turned into income: below zero it is presented as «Devoluciones netas
 * este mes» with its magnitude (`netRefunds`), at zero or above as the ordinary «Gastos este mes» (`spent`). */
export type MonthSpending = { kind: 'spent' | 'netRefunds'; minor: number };
export function monthSpending(netExpenseMinor: number): MonthSpending {
  return netExpenseMinor < 0 ? { kind: 'netRefunds', minor: -netExpenseMinor } : { kind: 'spent', minor: netExpenseMinor };
}

/** An account's facts for the month of `todayISO`, from its own lines (already filtered to it): the net of its expense
 * lines (purchases minus the devoluciones dated this month, `monthSpending`) and its income, up to today. Summed exactly
 * (BigInt, as `dayNetMinor`): with negative devolución lines a running sum can pass the safe range and come back, so only
 * the exact totals are checked. Null when one leaves the safe integer range (never a misleading number). */
export function accountMonthFacts(entries: readonly Entry[], todayISO: string): { spending: MonthSpending; incomeMinor: number } | null {
  const monthISO = currentMonthISO(todayISO);
  let expense = 0n, income = 0n;
  for (const entry of entries) {
    if (entry.dateISO.slice(0, 7) !== monthISO || entry.dateISO > todayISO) continue;
    if (!Number.isSafeInteger(entry.amountMinor)) return null;
    if (entry.kind === 'expense') expense += BigInt(entry.amountMinor); else income += BigInt(entry.amountMinor);
  }
  const limit = BigInt(Number.MAX_SAFE_INTEGER);
  const safe = (total: bigint) => !(total > limit || -total > limit);
  return safe(expense) && safe(income) ? { spending: monthSpending(Number(expense)), incomeMinor: Number(income) } : null;
}
const searchable = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es-AR');

/** 24T3: the words a devolución's or an adelanto's line answers to in the search besides its merchant and category: the
 * kind word in Spanish and in English (the two catalogue languages), and `operationWords` for the interface language. */
const REFUND_WORDS = 'devolucion refund';
const PAYOFF_WORDS = 'adelanto de cuotas installments brought forward';

// Filtering never changes stored data or adds currencies together. `categoryLabel`
// adds the name a category shows (a built-in one in the interface language) to the
// searchable text, so "food" finds a Comida movement when the app reads English.
// 24T3: a devolución or an adelanto de cuotas is an expense line (a contra-expense, a recognised purchase): it is listed
// under «Gastos» and «Todos», never under «Ingresos», and the search finds it by its kind word too.
export function selectEntries(entries: Entry[], accounts: Account[], filter: EntryFilter = 'all', query = '', accountId?: string,
  categoryLabel?: (entry: Entry) => string, operationWords?: { refund: string; payoff: string }) {
  const names = new Map(accounts.map(account => [account.id, account.name]));
  const terms = searchable(query).trim().split(/\s+/).filter(Boolean);
  if (filter === 'transfer') return [];
  return entries.filter(entry => {
    if ((filter !== 'all' && entry.kind !== filter) || (accountId && entry.accountId !== accountId)) return false;
    const kindWords = entry.refund ? REFUND_WORDS + ' ' + (operationWords?.refund ?? '') : entry.payoff ? PAYOFF_WORDS + ' ' + (operationWords?.payoff ?? '') : '';
    const text = searchable([entry.merchant, entry.category, categoryLabel?.(entry) ?? '', names.get(entry.accountId) ?? '', kindWords].join(' '));
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

/** The currencies the ledger actually holds, in grouping order (ARS, USD, then by code): what
 * Home, Reportes, Presupuestos and the Assistant let the person switch between. Never a
 * fixed pair, so an account in any stored currency is always reachable. */
export function availableCurrencies(accounts: Account[]): Currency[] {
  // 25B2: the currencies the live accounts hold: what a new record, Disponible and the default rule work with.
  return currenciesPresent(liveAccounts(accounts));
}

/** Every currency the ledger ever held, deleted accounts included (25B2 review): the scope of Inicio's and Reportes'
 * view and of its chip, so the history of a currency whose last account was deleted stays counted (converted at its
 * dates in the consolidated total, filterable with "Solo …"), never dropped with the account. */
export function historyCurrencies(accounts: Account[]): Currency[] {
  return currenciesPresent(accounts);
}

export type ActivityItem = { type: 'entry'; key: string; value: Entry } | { type: 'transfer'; key: string; value: Transfer };
/** `transferWord` is the word a transfer answers to in the interface language, besides the Spanish one. */
export function selectTransfers(transfers: Transfer[], accounts: Account[], query = '', accountId?: string, transferWord = ''): Transfer[] {
  const names = new Map(accounts.map(a => [a.id, a.name]));
  const terms = searchable(query).trim().split(/\s+/).filter(Boolean);
  return transfers.filter(t => (!accountId || t.fromAccountId === accountId || t.toAccountId === accountId)
    && terms.every(term => searchable(['transferencia', transferWord, t.note, names.get(t.fromAccountId), names.get(t.toAccountId)].join(' ')).includes(term)));
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

/** When a scheduled commitment falls due, as the caption beside its amount says it (24UX2): today, tomorrow,
 * within a week as a count of days, and beyond that the date itself (relative counts like "in 300 days" read
 * worse than "3 oct"). A date already past (a paused rule) is `due`, never a negative count. */
export type DueWhen = { kind: 'today' } | { kind: 'tomorrow' } | { kind: 'soon'; days: number } | { kind: 'date' } | { kind: 'due' };
export function dueWhen(dateISO: string, todayISO: string): DueWhen {
  const ago = daysAgo(dateISO, todayISO);
  if (ago === null) return { kind: 'date' };
  const days = -ago;
  if (days < 0) return { kind: 'due' };
  if (days === 0) return { kind: 'today' };
  if (days === 1) return { kind: 'tomorrow' };
  return days <= 7 ? { kind: 'soon', days } : { kind: 'date' };
}

/** Inicio's lists (24UX5 review): a row names its account only when the rows on screen come from more than one
 * account. Owning a second account of the currency is not enough: when every visible row is from the same one, its
 * name on each row says nothing. Each list decides on its own rows. VoiceOver, the detail and the search keep it. */
export function visibleNamesAccount(rows: readonly { accountId: string }[]): boolean {
  return new Set(rows.map(row => row.accountId)).size > 1;
}

/** Whether a row should name its account: only when more than one account of that currency could be meant.
 * With one account the name repeats on every row and says nothing (24UX2). Cards count (a purchase on a card and one
 * in cash are different facts); a personal debt's hidden account never pays an expense, so it does not. */
export function namesAccount(accounts: readonly Account[], currency: Currency, debtAccountIds: ReadonlySet<string> = new Set()): boolean {
  return accounts.filter(account => account.currency === currency && !debtAccountIds.has(account.id)).length > 1;
}

/** Whether the rows of a recurring rule's history must name their account (24UX2 review). They may leave it out
 * only when every row shown was recorded in one account and that account is the rule's current one, the account
 * the form above already shows. A rule moved to another account of the same currency, or one occurrence corrected
 * onto another account, names the account on every row, so an old payment never reads as the current account's. */
export function historyNamesAccount(entries: readonly Pick<Entry, 'accountId'>[], ruleAccountId: string): boolean {
  return entries.some(entry => entry.accountId !== ruleAccountId);
}

/** Names that say nothing about what a movement was for (compared after `searchable`): with them the category is the
 * only way to tell rows apart, so Inicio keeps it in the caption. Short on purpose; a real name never matches. */
const GENERIC_NAMES = new Set(['varios', 'compra', 'compras', 'pago', 'pagos', 'gasto', 'gastos', 'ingreso', 'ingresos', 'otro', 'otros',
  'otra', 'otras', 'sin nombre', 'desconocido', 'misc', 'various', 'purchase', 'payment', 'expense', 'income', 'other', 'unknown', 'n/a', 'test', 'prueba']);

/** Inicio's rows (24UX5) leave the category out of the caption when the glyph already says it, and keep it where the
 * row would be ambiguous without it: a name too short or with no letter ("f", "a", "123"), a generic name ("Varios",
 * "Pago"), or a glyph that another category on the same screen also draws. A name that is the category itself
 * ("Comida" in Comida) never repeats it. VoiceOver, the detail, the filters and the search keep the category always. */
export function homeNamesCategory(merchant: string, categoryLabel: string, glyphShared: boolean): boolean {
  const name = searchable(merchant).trim().replace(/\s+/g, ' ');
  if (name === searchable(categoryLabel).trim().replace(/\s+/g, ' ')) return false;
  return glyphShared || name.length < 3 || !/\p{L}/u.test(name) || GENERIC_NAMES.has(name);
}

/** The glyphs that stand for more than one category among the rows on one screen. */
export function sharedGlyphs(rows: readonly { category: string; glyph: string }[]): Set<string> {
  const categories = new Map<string, Set<string>>();
  for (const row of rows) categories.set(row.glyph, (categories.get(row.glyph) ?? new Set()).add(row.category));
  return new Set([...categories].filter(([, names]) => names.size > 1).map(([glyph]) => glyph));
}

/** 24T3 (A13): the refusals that storage decides before writing anything and that a new attempt can resolve once the person
 * reviews the draft (the card's calendar changed, the instalments changed, an amount over what can be returned, a date out
 * of range, a purchase with devoluciones, a deleted account, card or plan, a stopped plan, an undo or restore of a devolución
 * or adelanto that changed since it was shown). A form that gets one releases its
 * frozen submission so the fields unlock and the next Save builds it again from the current ledger, with the same id.
 * Anything else (a refresh that failed after the commit, an unknown outcome) keeps the submission frozen for an exact retry. */
const DETERMINISTIC_REFUSALS = new Set<string>([PLAN_CALENDAR_MESSAGE, OPERATION_CHANGED_MESSAGE, REFUND_OVER_MESSAGE, REFUND_AMOUNT_MESSAGE, REFUND_DATE_MESSAGE,
  REFUND_TARGET_MESSAGE, PLAN_OPERATION_DATE_MESSAGE, OPERATION_ACCOUNT_DELETED_MESSAGE, OPERATION_PLAN_STOPPED_MESSAGE, OPERATION_TARGET_MESSAGE,
  CARD_DELETED_MESSAGE, PLAN_CARD_MESSAGE, PLAN_DELETED_MESSAGE, PLAN_MISSING_MESSAGE, OPERATION_STATE_MESSAGE, OPERATION_HISTORY_DELETED_MESSAGE,
  ...operationGuardMessages()]);
export function releasesDraft(message: string): boolean {
  return DETERMINISTIC_REFUSALS.has(message);
}
