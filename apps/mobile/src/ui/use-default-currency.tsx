/** The currency a form starts with, as a hook (Producto 25B2). The rule itself is `defaultCurrency`
 * (currency-defaults.ts, pure); this module only feeds it what the app knows: the ledger's live accounts and gate,
 * the display preference, and the region in use, which it reads for rule 4 (a suggestion before any account exists,
 * as the first opening does) and for nothing else: no account, ledger or display-currency code reads the region. */
import { LEDGER_CURRENCIES, currenciesPresent, liveAccounts, type Currency } from '@finanzapp/domain';
import { defaultCurrency } from './currency-defaults';
import { resolveDisplayCurrency } from './display-currency';
import { useDisplayCurrency } from './display-currency-provider';
import { useLedger } from '../storage/LedgerProvider';
import { useLocalePreferences } from '../i18n/provider';

/** The account it belongs to, a route's gated currency, the one currency held, the display currency among several,
 * the region's tender before any account, ARS last. It proposes; the person may change it; nothing saved changes. */
export function useDefaultCurrency(context: { accountCurrency?: Currency | null; requested?: unknown } = {}): Currency {
  const { snapshot, gate = LEDGER_CURRENCIES } = useLedger();
  const accounts = snapshot?.accounts ?? [];
  const held = currenciesPresent(liveAccounts(accounts));
  const { preferred, mode } = useDisplayCurrency(held);
  const region = useLocalePreferences()?.state.region ?? null;
  const displayCurrency = preferred === null ? null : resolveDisplayCurrency(preferred, held, mode);
  return defaultCurrency({ ...context, accounts, displayCurrency, region, gate });
}

