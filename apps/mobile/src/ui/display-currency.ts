/** The display currency Inicio and Reportes share (Producto 24B6): which of the
 * currencies the ledger holds those two screens show. One preference, a device
 * setting like the language and the region: it lives in the key-value store,
 * outside the financial database and outside backups, so restoring a copy on
 * another phone never changes what that phone shows and choosing a currency
 * never rewrites an account, a movement or a budget. It is a filter only: the
 * screens show the amounts recorded in that currency and convert nothing
 * (docs/currency.md §10). It is not the future `reportCurrency` of §8.3,
 * which will drive conversions; that one stays a separate key.
 *
 * Rules:
 *   - the stored value is read as a storable ISO code or ignored, never coerced;
 *   - what a screen shows is resolved against the currencies held right now:
 *     a preference no account holds any more (the last account of a currency
 *     removed, a restored copy) falls back to the first currency present, in
 *     grouping order, and to ARS in an empty ledger (decision 7.6.4). The stored
 *     value is kept as it is, so the currency comes back when an account does;
 *   - a choice is applied to every subscriber at once and written to the store;
 *     an unwritable store keeps the choice for this session (the person asked
 *     to see that currency; a full disk must not refuse the view) and reports it;
 *   - a route that arrives with a currency (a deep link into Reportes) is applied
 *     to the shared preference only when the code is one an account holds;
 *     anything else is ignored and the preference stands. Pure: no React. */
import { isStorableCurrency, type Account, type Currency } from '@finanzapp/domain';
import { defaultPreferenceStore, type PreferenceStore } from '../i18n/preference.ts';
import { heldCurrency } from './report-presentation.ts';

export const DISPLAY_CURRENCY_KEY = 'finanzapp.displayCurrency';

export function readDisplayCurrency(store: () => PreferenceStore = defaultPreferenceStore): Currency | null {
  try {
    const stored = store().getItemSync(DISPLAY_CURRENCY_KEY);
    return isStorableCurrency(stored) ? stored : null;
  } catch { return null; }
}

/** Returns whether the write landed; the caller's in-memory choice stands either way. */
export function writeDisplayCurrency(currency: Currency, store: () => PreferenceStore = defaultPreferenceStore): boolean {
  try { store().setItemSync(DISPLAY_CURRENCY_KEY, currency); return true; } catch { return false; }
}

/** The currency a screen shows: the preference when an account holds it, else the first held currency, else ARS. */
export function resolveDisplayCurrency(preferred: Currency | null, held: readonly Currency[]): Currency {
  return preferred !== null && held.includes(preferred) ? preferred : held[0] ?? 'ARS';
}

/** The precedence for Reportes opened with a route currency: an explicit currency an account
 * holds is what the screen shows and what the shared preference becomes (`apply`); a missing,
 * malformed or unheld parameter shows the shared preference and changes nothing (`apply` null). */
export function displayCurrencyForRoute(accounts: readonly Account[], param: unknown, preferred: Currency | null): { currency: Currency; apply: Currency | null } {
  const explicit = heldCurrency(accounts, param);
  const held = [...new Set(accounts.map(account => account.currency))];
  return explicit ? { currency: explicit, apply: explicit } : { currency: resolveDisplayCurrency(preferred, held.length ? held : []), apply: null };
}

export interface DisplayCurrencyStore {
  /** The stored preference as read, or null: what the screens resolve against the currencies held. */
  getState: () => Currency | null;
  subscribe: (listener: () => void) => () => void;
  /** Applies and persists a choice. False when the store could not be written (the choice still shows this session). */
  set: (currency: Currency) => boolean;
}

export function createDisplayCurrencyStore(store: () => PreferenceStore = defaultPreferenceStore): DisplayCurrencyStore {
  let current = readDisplayCurrency(store);
  const listeners = new Set<() => void>();
  return {
    getState: () => current,
    subscribe: listener => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    set: currency => {
      if (!isStorableCurrency(currency)) return false;
      if (currency === current) return true;
      current = currency;
      const saved = writeDisplayCurrency(currency, store);
      for (const listener of [...listeners]) listener();
      return saved;
    },
  };
}
