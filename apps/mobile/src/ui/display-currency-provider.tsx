/** The shared display currency as React context (24B6). One store per app; the
 * provider subscribes with `useSyncExternalStore`, so a choice made on Inicio
 * re-renders Reportes (mounted or not: it reads the store when it next renders)
 * and the other way round, with no remount and nothing above the tabs touched.
 * Without a provider (a screen rendered in isolation) a module-level in-memory
 * store stands in, so nothing throws and nothing is persisted. */
import { createContext, useContext, useState, useSyncExternalStore, type ReactNode } from 'react';
import type { Currency } from '@finanzapp/domain';
import { createDisplayCurrencyStore, resolveDisplayCurrency, type DisplayCurrencyStore, type DisplayMode } from './display-currency';
import type { PreferenceStore } from '../i18n/preference';

const DisplayCurrencyContext = createContext<DisplayCurrencyStore | null>(null);

let fallback: DisplayCurrencyStore | null = null;
const memoryStore = (): PreferenceStore => { const rows = new Map<string, string>(); return { getItemSync: key => rows.get(key) ?? null, setItemSync: (key, value) => { rows.set(key, value); }, removeItemSync: key => rows.delete(key) }; };

export function DisplayCurrencyProvider({ children, store }: { children: ReactNode; store?: DisplayCurrencyStore }) {
  const [displayStore] = useState(() => store ?? createDisplayCurrencyStore());
  return <DisplayCurrencyContext.Provider value={displayStore}>{children}</DisplayCurrencyContext.Provider>;
}

/** The currency a screen shows among the currencies it can show (`held`, the ledger's, in
 * grouping order), the display mode (24C1), and the setters both Inicio and Reportes share.
 * Choosing never changes a stored amount; in `consolidated` mode the screens convert for the view. */
export function useDisplayCurrency(held: readonly Currency[]): { currency: Currency; preferred: Currency | null; mode: DisplayMode;
  setCurrency: (currency: Currency) => void; setMode: (mode: DisplayMode) => void } {
  const store = useContext(DisplayCurrencyContext) ?? (fallback ??= createDisplayCurrencyStore(memoryStore));
  const preferred = useSyncExternalStore(store.subscribe, store.getState, store.getState);
  const mode = useSyncExternalStore(store.subscribe, store.getMode, store.getMode);
  return { currency: resolveDisplayCurrency(preferred, held, mode), preferred, mode,
    setCurrency: currency => { store.set(currency); }, setMode: next => { store.setMode(next); } };
}
