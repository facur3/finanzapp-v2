/** The display currency Inicio and Reportes share (Producto 24B6), and since Producto 24C1 the
 * display **mode**: a consolidated total of every account in one chosen currency, or one of the
 * currencies held on its own (the 24B6 filter). The currency is which of the currencies the ledger
 * holds those two screens show in `single` mode, and the currency the totals are expressed in in
 * `consolidated` mode. One preference, a device
 * setting like the language and the region: it lives in the key-value store,
 * outside the financial database and outside backups, so restoring a copy on
 * another phone never changes what that phone shows and choosing a currency
 * never rewrites an account, a movement or a budget. In `single` mode it is a filter: the
 * screens show the amounts recorded in that currency and convert nothing. In `consolidated` mode
 * the screens convert, for the view only, with dated reference rates (docs/currency.md §8); the
 * stored amounts never change either way. Since 24C1 this one key is the "main currency for
 * reports" of §8.3: a second key was never written, so there is nothing to migrate.
 *
 * Mode (24C1, `finanzapp.displayMode`): `consolidated` is the default of a new installation. A
 * device that already chose a display currency under 24B6 (the key exists, the mode does not)
 * keeps what it showed: it is read as `single` with that currency, and that reading is written
 * once, so the person meets the consolidated total only by choosing it in the sheet. A device that
 * never chose one had nothing to keep and starts consolidated.
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
export const DISPLAY_MODE_KEY = 'finanzapp.displayMode';
export type DisplayMode = 'consolidated' | 'single';

const isDisplayMode = (value: unknown): value is DisplayMode => value === 'consolidated' || value === 'single';

/** The stored mode, or the transition of a device that has none (see the header): `single` when a
 * 24B6 display currency exists, else `consolidated`. The transition is written once (best effort:
 * an unwritable store gives the same answer on the next read). */
export function readDisplayMode(store: () => PreferenceStore = defaultPreferenceStore): DisplayMode {
  let stored: string | null = null, legacy = false;
  try {
    stored = store().getItemSync(DISPLAY_MODE_KEY);
    if (isDisplayMode(stored)) return stored;
    legacy = isStorableCurrency(store().getItemSync(DISPLAY_CURRENCY_KEY));
  } catch { return 'consolidated'; }
  const mode: DisplayMode = legacy ? 'single' : 'consolidated';
  try { store().setItemSync(DISPLAY_MODE_KEY, mode); } catch { /* read again next time, same answer */ }
  return mode;
}

export function writeDisplayMode(mode: DisplayMode, store: () => PreferenceStore = defaultPreferenceStore): boolean {
  try { store().setItemSync(DISPLAY_MODE_KEY, mode); return true; } catch { return false; }
}

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

/** The currency a screen shows: the preference when an account holds it, else the first held currency, else ARS.
 * In `consolidated` mode any storable preference stands (the totals are expressed in it, whether an account holds
 * it or not). */
export function resolveDisplayCurrency(preferred: Currency | null, held: readonly Currency[], mode: DisplayMode = 'single'): Currency {
  if (mode === 'consolidated' && preferred !== null && isStorableCurrency(preferred)) return preferred;
  return preferred !== null && held.includes(preferred) ? preferred : held[0] ?? 'ARS';
}

/** The precedence for Reportes opened with a route currency: an explicit currency an account
 * holds is what the screen shows and what the shared preference becomes (`apply`); a missing,
 * malformed or unheld parameter shows the shared preference and changes nothing (`apply` null).
 * In `consolidated` mode (24C1) any storable code is a currency the totals can be expressed in. */
export function displayCurrencyForRoute(accounts: readonly Account[], param: unknown, preferred: Currency | null, mode: DisplayMode = 'single'): { currency: Currency; apply: Currency | null } {
  const explicit = mode === 'consolidated' ? (isStorableCurrency(param) ? param : null) : heldCurrency(accounts, param);
  const held = [...new Set(accounts.map(account => account.currency))];
  return explicit ? { currency: explicit, apply: explicit } : { currency: resolveDisplayCurrency(preferred, held.length ? held : [], mode), apply: null };
}

export interface DisplayCurrencyStore {
  /** The stored preference as read, or null: what the screens resolve against the currencies held. */
  getState: () => Currency | null;
  /** The display mode (24C1). */
  getMode: () => DisplayMode;
  subscribe: (listener: () => void) => () => void;
  /** Applies and persists a choice. False when the store could not be written (the choice still shows this session). */
  set: (currency: Currency) => boolean;
  /** Applies and persists a mode, the same way. */
  setMode: (mode: DisplayMode) => boolean;
}

export function createDisplayCurrencyStore(store: () => PreferenceStore = defaultPreferenceStore): DisplayCurrencyStore {
  let current = readDisplayCurrency(store);
  let mode = readDisplayMode(store);
  const listeners = new Set<() => void>();
  return {
    getState: () => current,
    getMode: () => mode,
    setMode: next => {
      if (!isDisplayMode(next)) return false;
      if (next === mode) return true;
      mode = next;
      const saved = writeDisplayMode(next, store);
      for (const listener of [...listeners]) listener();
      return saved;
    },
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
