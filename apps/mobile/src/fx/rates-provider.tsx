/** The exchange rates as React context (Producto 24C1): one store per app, fed by the rate cache
 * on the device and by the provider (Frankfurter) only when a screen asks for a month it lacks.
 * Without a provider (a screen rendered in isolation) an empty store that never fetches stands in.
 * `useFinanceView` is what screens use: the ledger as the display mode shows it. */
import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { useIsFocused } from 'expo-router';
import { rateBook, todayKey, type Currency } from '@finanzapp/domain';
import { initializeRatesDatabase, readRates, saveRates, type RatesDatabase } from '../storage/rates-database';
import { openRatesDatabase } from '../storage/nativeDatabase';
import { useLedger } from '../storage/LedgerProvider';
import { useDisplayCurrency } from '../ui/display-currency-provider';
import { historyCurrencies } from '../ui/presentation';
import { useCurrentDay } from '../ui/theme';
import { fetchFrankfurter } from './frankfurter';
import { financeView, resolveFinanceTarget, type FinanceView } from './finance-view';
import { createRatesStore, type RateCache, type RatesActivity, type RatesSnapshot, type RatesStore } from './rates-store';

const RatesContext = createContext<RatesStore | null>(null);

/** The rate cache on its own SQLite file. An open that failed is forgotten, so the next read or save opens it again instead
 * of every later save of the session rejecting with the first failure. */
export function nativeCache(): RateCache {
  let database: Promise<{ db: RatesDatabase; writable: boolean }> | null = null;
  const open = () => database ??= openRatesDatabase().then(async db => ({ db, writable: await initializeRatesDatabase(db) }))
    .catch(cause => { database = null; throw cause; });
  return {
    load: async () => { const { db } = await open(); return readRates(db); },
    save: async (rates, coverage) => { const { db, writable } = await open(); if (writable) await saveRates(db, rates, coverage); },
  };
}

// One frozen snapshot: `useSyncExternalStore` compares snapshots by identity, so a fresh object per read would loop.
const IDLE_STATE: RatesSnapshot = Object.freeze({ book: rateBook([]), loaded: true, lastFetchedAt: null });
const idle: RatesStore = { getState: () => IDLE_STATE, subscribe: () => () => {}, ensure: () => {},
  watch: () => () => {}, refresh: () => {}, activity: () => 'idle', settled: async () => {} };

export function RatesProvider({ children, store }: { children: ReactNode; store?: RatesStore }) {
  const [rates] = useState(() => store ?? createRatesStore({ cache: nativeCache(), fetchRates: request => fetchFrankfurter(request, fetch as never) }));
  // A return to the foreground asks again what the watched months are due for (the running month after REFRESH_MS), as the
  // ledger re-reads itself; the store's intervals make a quick return (Control Center) cost nothing.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') rates.refresh(todayKey()); });
    return () => subscription.remove();
  }, [rates]);
  return <RatesContext.Provider value={rates}>{children}</RatesContext.Provider>;
}

export function useRates(): RatesStore {
  return useContext(RatesContext) ?? idle;
}

/** The ledger as the display mode shows it, for `months` (YYYY-MM) that the screen reads: asks the
 * provider for what those months lack (never in `single` mode, never when nothing needs converting).
 * `currency` overrides the shared choice (a route that names one, Presupuestos' own switch). */
export function useFinanceView(months: readonly string[], currency?: Currency): FinanceView & { activity: RatesActivity; loaded: boolean; lastFetchedAt: string | null; book: ReturnType<typeof rateBook>; held: Currency[] } | null {
  const { snapshot } = useLedger();
  const rates = useRates();
  const day = useCurrentDay();
  // Every currency the ledger ever held (deleted accounts included): a deleted account's movements still count and convert.
  const held = useMemo(() => historyCurrencies(snapshot?.accounts ?? []), [snapshot?.accounts]);
  const shared = useDisplayCurrency(held);
  const state = useSyncExternalStore(rates.subscribe, rates.getState, rates.getState);
  const focused = useIsFocused();
  const { mode, currency: target } = resolveFinanceTarget(held, shared, currency);
  const view = useMemo(() => snapshot ? financeView(snapshot, mode, target, state.book) : null, [snapshot, mode, target, state.book]);
  const monthsKey = months.join(','), quotesKey = view?.quotes.join(',') ?? '';
  // The watch lasts while this screen is focused and needs these rates: leaving it, covering it with another screen or tab,
  // or switching to `single` mode (no quotes) releases it, so a failed request is retried only while some view is still
  // waiting for its answer; coming back watches again, which also asks what is due by then.
  useEffect(() => { if (focused && view?.quotes.length) return rates.watch(months, view.quotes, day); }, [rates, monthsKey, quotesKey, day, focused]);
  // `day`: a month the cache does not cover reads «Obteniendo» from the first frame, before the watch effect asks for it.
  const activity = view ? rates.activity(months, view.quotes, day) : 'idle';
  // One object per change of what it carries, so the screens' memos recompute only then.
  return useMemo(() => view ? { ...view, activity, loaded: state.loaded, lastFetchedAt: state.lastFetchedAt, book: state.book, held } : null,
    [view, activity, state, held]);
}
