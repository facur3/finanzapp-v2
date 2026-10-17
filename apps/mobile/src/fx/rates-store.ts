/** The rates the app holds and the rule for asking the provider (Producto 24C1). Pure: no React,
 * no SQLite, no network of its own; the cache and the fetch are injected, so tests drive it with
 * a stub provider and an in-memory cache.
 *
 * When a request is made (docs/currency.md §8.2):
 *   - only when a screen needs a month in a currency it holds and the target differs
 *     (`quotesNeeded`); a ledger in one currency shown in that currency never asks anything;
 *   - one request per calendar month for the currencies that month still lacks, over the month
 *     plus the week before it (the first days of a month may take the last publication of the
 *     previous one), through today at most;
 *   - a month asked after it ended is final and never asked again, provided the rates held reach its
 *     last days (a row within RATE_MAX_AGE_DAYS of its end); one sealed short (an empty answer, a
 *     clock that ran ahead) is asked again once a day (RESEAL_MS). The current month (or one asked
 *     while it was still running) is asked again at most every REFRESH_MS, when a view watches it,
 *     comes back into focus or the app returns to the foreground (`refresh`);
 *   - a failure (offline, provider error) is remembered and backed off (RETRY_STEPS_MS: 1, 2, 5, 15,
 *     then every 30 minutes; longer when the provider sends Retry-After; a success resets it), so a
 *     screen that re-renders never hammers the provider; the cached rates keep working meanwhile.
 *     Once the back-off has passed the store retries by itself, but only while a view still
 *     **watches** those months and quotes (`watch` registers interest and its release withdraws it):
 *     a screen left, or switched to `single` mode, schedules nothing and cancels what it had scheduled;
 *   - a request the provider refuses (a 4xx: a code it does not know) is split once into one request
 *     per quote, so the valid ones recover; the refused quote is not asked again for UNSUPPORTED_MS
 *     and reads as a missing rate, never as an outage to retry.
 * The cache is read before anything is asked. A cache that cannot be read or written leaves the
 * rates of this session in memory; nothing is deleted. A month that is not a calendar month
 * (a malformed link) is never asked for. */
import { rateBook, shiftMonthISO, validMonthISO, type Currency, type ExchangeRate, type RateBook } from '@finanzapp/domain';
import type { RateCoverage } from '../storage/rates-database.ts';
import { RateFetchError, type RateRequest } from './frankfurter.ts';

export const REFRESH_MS = 6 * 60 * 60 * 1000;
export const RETRY_MS = 60 * 1000;
/** The back-off of consecutive failures of one (quote, month): the last step repeats. */
export const RETRY_STEPS_MS = [RETRY_MS, 2 * 60 * 1000, 5 * 60 * 1000, 15 * 60 * 1000, 30 * 60 * 1000] as const;
/** How long a quote the provider refused is left alone. */
export const UNSUPPORTED_MS = 24 * 60 * 60 * 1000;
/** How often a past month sealed without rates near its end is asked again. */
export const RESEAL_MS = 24 * 60 * 60 * 1000;
/** The furthest back a screen can ask for (a person's records may start earlier; those months simply have no total). */
export const EARLIEST_RATE_MONTH = '1999-01';

export interface RateCache {
  load(): Promise<{ rates: ExchangeRate[]; coverage: RateCoverage[] }>;
  save(rates: readonly ExchangeRate[], coverage: readonly RateCoverage[]): Promise<void>;
}

export type RatesActivity = 'idle' | 'loading' | 'fetching' | 'offline' | 'provider';

export interface RatesSnapshot {
  book: RateBook;
  /** False until the cache has been read: a screen shows "obteniendo" instead of "falta" meanwhile. */
  loaded: boolean;
  /** When the last successful download happened (ISO), or null. */
  lastFetchedAt: string | null;
}

export interface RatesStore {
  getState(): RatesSnapshot;
  subscribe(listener: () => void): () => void;
  /** Asks for whatever `months` × `quotes` still needs; returns at once (the answer arrives through `subscribe`). */
  ensure(months: readonly string[], quotes: readonly Currency[], today: string): void;
  /** `ensure`, plus interest: failures are retried while the watch is held. The release withdraws it. */
  watch(months: readonly string[], quotes: readonly Currency[], today: string): () => void;
  /** `ensure` again for every watch held, on `today` (the app came back to the foreground): the intervals above decide
   * whether anything is asked, so a quick return costs nothing. */
  refresh(today: string): void;
  /** What is happening for these months and quotes: a request in flight, a recent failure, or nothing. With `today`, a key
   * the cache does not cover and that a watch would ask for now already reads `fetching` (the first frame, before the
   * watch effect runs), never «Sin cotización». */
  activity(months: readonly string[], quotes: readonly Currency[], today?: string): RatesActivity;
  /** Resolves when every request started so far has settled (tests; a pull-to-refresh). */
  settled(): Promise<void>;
}

function monthEnd(monthISO: string): string {
  const [year, month] = monthISO.split('-').map(Number);
  return monthISO + '-' + String(new Date(year, month, 0, 12).getDate()).padStart(2, '0');
}

function dayBefore(dateISO: string, days: number): string {
  return new Date(Date.parse(dateISO + 'T12:00:00Z') - days * 86400000).toISOString().slice(0, 10);
}

/** Whether a (quote, month) needs a request now. `tail`: the rates held for that quote reach the month's last days (a
 * row within RATE_MAX_AGE_DAYS of its end, or of the day it was asked through); a month asked after it ended is final
 * only then. A `fetchedAt` later than now (a clock that ran ahead, then back) is due. */
export function needsFetch(coverage: RateCoverage | undefined, monthISO: string, today: string, now: Date, tail = true): boolean {
  if (!validMonthISO(monthISO) || monthISO > today.slice(0, 7) || monthISO < EARLIEST_RATE_MONTH) return false;
  if (!coverage) return true;
  const fetched = Date.parse(coverage.fetchedAt);
  if (!Number.isFinite(fetched) || fetched > now.getTime()) return true;
  const end = monthEnd(monthISO);
  // Asked after the month ended: final, unless what came back stops short of its end.
  if (coverage.fetchedAt.slice(0, 10) > end && coverage.throughISO >= end) return !tail && now.getTime() - fetched >= RESEAL_MS;
  return now.getTime() - fetched >= REFRESH_MS;
}

/** The request for one month: the month and the week before it, through today at most. */
export function monthRequest(monthISO: string, quotes: readonly Currency[], today: string): RateRequest {
  const end = monthEnd(monthISO);
  return { from: dayBefore(monthISO + '-01', 7), to: end < today ? end : today, quotes: [...quotes].sort() };
}

/** The months of a report window: `count` months ending at `monthISO`, oldest first. */
export function monthsEnding(monthISO: string, count: number): string[] {
  return Array.from({ length: count }, (_, index) => shiftMonthISO(monthISO, index - count + 1));
}

/** A cancellable timer that never keeps a Node test process alive (React Native's timers have no `unref`). */
function laterTimer(run: () => void, ms: number): () => void {
  const handle = setTimeout(run, ms) as unknown as { unref?: () => void };
  handle.unref?.();
  return () => clearTimeout(handle as unknown as ReturnType<typeof setTimeout>);
}

export function createRatesStore({ cache, fetchRates, now = () => new Date(), schedule = laterTimer }: {
  cache: RateCache;
  fetchRates: (request: RateRequest) => Promise<ExchangeRate[]>;
  now?: () => Date;
  /** Runs the retry of a failed request once its back-off has passed; returns its cancel (injected by tests). */
  schedule?: (run: () => void, ms: number) => () => void;
}): RatesStore {
  let rates: ExchangeRate[] = [];
  const coverage = new Map<string, RateCoverage>();
  let state: RatesSnapshot = { book: rateBook([]), loaded: false, lastFetchedAt: null };
  const listeners = new Set<() => void>();
  // In flight and failed are tracked per (quote, month): a request for EUR in September never blocks one for JPY
  // in September started while it is pending (two screens, or two quick changes of the display currency).
  const inFlight = new Map<string, Promise<void>>(); // by request (month and its quotes)
  const pendingQuotes = new Set<string>();           // quote|month keys being fetched
  // A failure is said (`kind`) until a success replaces it; it is asked again from `until` (the back-off, `attempt` steps in).
  const failures = new Map<string, { until: number; attempt: number; kind: 'offline' | 'provider' }>(); // by quote|month
  const unsupported = new Map<string, number>(); // quote|month → until when a refused quote is left alone
  const waiting: { months: string[]; quotes: Currency[]; today: string }[] = [];
  // Views that currently need rates, and the retry timer of each month that failed while one of them watched it.
  const watchers = new Set<{ months: string[]; quotes: Currency[]; today: string }>();
  const retries = new Map<string, () => void>(); // by month: cancel
  const watched = (month: string) => {
    const quotes = new Set<Currency>();
    let today = '';
    for (const watcher of watchers) if (watcher.months.includes(month)) { for (const quote of watcher.quotes) quotes.add(quote); if (watcher.today > today) today = watcher.today; }
    return { quotes: [...quotes], today };
  };
  const cancelRetry = (month: string) => { retries.get(month)?.(); retries.delete(month); };
  const key = (quote: Currency, month: string) => quote + '|' + month;
  /** Whether a request for (quote, month) would be made now: not in flight, not backing off, not refused, and due. */
  const due = (quote: Currency, month: string, today: string, moment: Date) => {
    const item = key(quote, month), failure = failures.get(item), refused = unsupported.get(item);
    if (pendingQuotes.has(item) || (failure && moment.getTime() < failure.until) || (refused !== undefined && moment.getTime() < refused)) return false;
    const covered = coverage.get(item);
    if (!covered) return needsFetch(undefined, month, today, moment);
    const last = monthEnd(month) < covered.throughISO ? monthEnd(month) : covered.throughISO;
    return needsFetch(covered, month, today, moment, state.book.lookup(quote, last).status === 'ok');
  };
  // Every notification carries a new snapshot object (same book when only the activity changed), so a
  // `useSyncExternalStore` subscriber re-renders for "fetching" and "offline" too, not only for new rates.
  const emit = () => { state = { ...state }; for (const listener of [...listeners]) listener(); };
  const publish = (lastFetchedAt = state.lastFetchedAt) => { state = { book: rateBook(rates), loaded: true, lastFetchedAt }; for (const listener of [...listeners]) listener(); };

  const loading = cache.load().then(loaded => {
    rates = loaded.rates;
    for (const item of loaded.coverage) coverage.set(key(item.quote, item.monthISO), item);
    const latest = loaded.coverage.reduce<string | null>((best, item) => best === null || item.fetchedAt > best ? item.fetchedAt : best, null);
    publish(latest);
  }, () => { publish(); }).then(() => {
    for (const request of waiting.splice(0)) store.ensure(request.months, request.quotes, request.today);
  });

  const fetchMonth = (month: string, quotes: Currency[], today: string) => {
    const keys = quotes.map(quote => key(quote, month));
    for (const item of keys) pendingQuotes.add(item);
    const requestKey = month + ':' + [...quotes].sort().join(',');
    const task = (async () => {
      let split: Currency[] = [];
      try {
        // Inside the try: a month that cannot become a request is a remembered failure, never a throw in a screen's effect.
        const request = monthRequest(month, quotes, today);
        const fetched = await fetchRates(request);
        const fetchedAt = now().toISOString();
        const covered = quotes.map(quote => ({ quote, monthISO: month, throughISO: request.to, fetchedAt }));
        // Memory first: the session sees the rates even if the cache cannot be written.
        const replaced = new Map(rates.map(rate => [rate.quote + '|' + rate.effectiveDate, rate]));
        for (const rate of fetched) {
          const previous = replaced.get(rate.quote + '|' + rate.effectiveDate);
          if (!previous || previous.fetchedAt.slice(0, 10) <= previous.effectiveDate) replaced.set(rate.quote + '|' + rate.effectiveDate, rate);
        }
        rates = [...replaced.values()];
        for (const item of covered) coverage.set(key(item.quote, item.monthISO), item);
        for (const item of keys) { failures.delete(item); unsupported.delete(item); }
        try { await cache.save(fetched, covered); } catch { /* kept in memory for this session */ }
        publish(fetchedAt);
      } catch (error) {
        const at = now().getTime();
        if (error instanceof RateFetchError && error.rejected) {
          // A refused request names a code the provider does not know: one request per quote finds it, once; a refused
          // single quote is left alone (a missing rate, no retry), so the other currencies of the month still recover.
          if (quotes.length > 1) split = quotes;
          else { for (const item of keys) { unsupported.set(item, at + UNSUPPORTED_MS); failures.delete(item); } emit(); }
          return;
        }
        let wait = 0;
        for (const item of keys) {
          const attempt = (failures.get(item)?.attempt ?? 0) + 1;
          const step = RETRY_STEPS_MS[Math.min(attempt, RETRY_STEPS_MS.length) - 1];
          const ms = Math.max(step, error instanceof RateFetchError ? error.retryAfterMs ?? 0 : 0);
          failures.set(item, { until: at + ms, attempt, kind: error instanceof RateFetchError ? error.kind : 'provider' });
          wait = Math.max(wait, ms);
        }
        emit();
        // The screen that asked stays mounted with the same months and quotes, so nothing would ask again: the store
        // retries by itself once the back-off has passed, for the quotes some view still watches (a second failure
        // schedules the next one; a view that left cancels it, and one that leaves meanwhile finds nothing to ask).
        const interest = watched(month);
        if (interest.quotes.some(quote => quotes.includes(quote))) {
          cancelRetry(month);
          retries.set(month, schedule(() => {
            retries.delete(month);
            const current = watched(month);
            if (current.quotes.length) store.ensure([month], current.quotes, current.today);
          }, wait));
        }
      } finally {
        inFlight.delete(requestKey);
        for (const item of keys) pendingQuotes.delete(item);
        for (const quote of split) fetchMonth(month, [quote], today);
      }
    })();
    inFlight.set(requestKey, task);
    emit();
  };

  const store: RatesStore = {
    getState: () => state,
    subscribe: listener => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    ensure(months, quotes, today) {
      if (!quotes.length || !months.length) return;
      if (!state.loaded) { waiting.push({ months: [...months], quotes: [...quotes], today }); return; }
      const moment = now();
      for (const month of new Set(months)) {
        if (!validMonthISO(month)) continue;
        const missing = quotes.filter(quote => due(quote, month, today, moment));
        if (missing.length) fetchMonth(month, missing, today);
      }
    },
    watch(months, quotes, today) {
      const watcher = { months: [...months], quotes: [...quotes], today };
      watchers.add(watcher);
      store.ensure(months, quotes, today);
      return () => {
        watchers.delete(watcher);
        for (const month of watcher.months) if (retries.has(month) && !watched(month).quotes.length) cancelRetry(month);
      };
    },
    refresh(today) {
      for (const watcher of [...watchers]) { watcher.today = today; store.ensure(watcher.months, watcher.quotes, today); }
    },
    activity(months, quotes, today) {
      if (!quotes.length) return 'idle';
      if (!state.loaded) return 'loading';
      const valid = months.filter(validMonthISO);
      const keys = valid.flatMap(month => quotes.map(quote => key(quote, month)));
      if (keys.some(item => pendingQuotes.has(item))) return 'fetching';
      const failure = keys.map(item => failures.get(item)).find(Boolean);
      if (failure) return failure.kind;
      // Only a key with no coverage at all: a covered month due again keeps saying what its rates lack (missing, stale).
      const moment = now();
      if (today && valid.some(month => quotes.some(quote => !coverage.has(key(quote, month)) && due(quote, month, today, moment)))) return 'fetching';
      return 'idle';
    },
    async settled() {
      await loading;
      while (inFlight.size) await Promise.all([...inFlight.values()]);
    },
  };
  return store;
}
