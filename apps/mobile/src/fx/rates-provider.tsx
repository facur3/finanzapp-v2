/** The exchange rates as React context (Producto 24C1): one store per app, fed by the rate cache
 * on the device and by the provider (Frankfurter) only when a screen asks for a month it lacks.
 * Without a provider (a screen rendered in isolation) an empty store that never fetches stands in.
 * `useFinanceView` is what screens use: the ledger as the display mode shows it. */
import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { rateBook, type Currency, type ExchangeRate } from '@finanzapp/domain';
import { initializeRatesDatabase, readRates, saveRates, type RatesDatabase } from '../storage/rates-database';
import { openRatesDatabase } from '../storage/nativeDatabase';
import { useLedger } from '../storage/LedgerProvider';
import { useDisplayCurrency } from '../ui/display-currency-provider';
import { availableCurrencies } from '../ui/presentation';
import { useCurrentDay } from '../ui/theme';
import { fetchFrankfurter } from './frankfurter';
import { financeView, type FinanceView } from './finance-view';
import { createRatesStore, type RateCache, type RatesActivity, type RatesStore } from './rates-store';

const RatesContext = createContext<RatesStore | null>(null);

function nativeCache(): RateCache {
  let database: Promise<{ db: RatesDatabase; writable: boolean }> | null = null;
  const open = () => database ??= openRatesDatabase().then(async db => ({ db, writable: await initializeRatesDatabase(db) }));
  return {
    load: async () => { const { db } = await open(); return readRates(db); },
    save: async (rates, coverage) => { const { db, writable } = await open(); if (writable) await saveRates(db, rates, coverage); },
  };
}

const idle: RatesStore = { getState: () => ({ book: rateBook([]), loaded: true, lastFetchedAt: null }), subscribe: () => () => {}, ensure: () => {},
  activity: () => 'idle', settled: async () => {} };

export function RatesProvider({ children, store }: { children: ReactNode; store?: RatesStore }) {
  const [rates] = useState(() => store ?? createRatesStore({ cache: nativeCache(), fetchRates: request => fetchFrankfurter(request, fetch as never) }));
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
  const held = useMemo(() => availableCurrencies(snapshot?.accounts ?? []), [snapshot?.accounts]);
  const shared = useDisplayCurrency(held);
  const state = useSyncExternalStore(rates.subscribe, rates.getState, rates.getState);
  const target = currency ?? shared.currency;
  const view = useMemo(() => snapshot ? financeView(snapshot, shared.mode, target, state.book) : null, [snapshot, shared.mode, target, state.book]);
  const monthsKey = months.join(','), quotesKey = view?.quotes.join(',') ?? '';
  useEffect(() => { if (view?.quotes.length) rates.ensure(months, view.quotes, day); }, [rates, monthsKey, quotesKey, day]);
  const activity = view ? rates.activity(months, view.quotes) : 'idle';
  // One object per change of what it carries, so the screens' memos recompute only then.
  return useMemo(() => view ? { ...view, activity, loaded: state.loaded, lastFetchedAt: state.lastFetchedAt, book: state.book, held } : null,
    [view, activity, state, held]);
}
