/** The one rule for the currency a form starts with (Producto 25B2). Pure: no React, so Node tests
 * every branch; `useDefaultCurrency` (display-currency-provider.tsx) feeds it what the app knows.
 *
 * Precedence, first match wins:
 *   1. the form belongs to an existing account (or a route names a currency the gate offers): that currency;
 *   2. the live accounts hold exactly one currency: that one;
 *   3. they hold several: the display currency when an account holds it, else the first currency held;
 *   4. no account yet: the legal tender of the region in use, when the build offers it (as the first opening does);
 *   5. the technical fallback, ARS.
 * The rule proposes; it never changes the currency of anything already saved (an account, a card, a debt, a
 * movement, a budget keep theirs for ever). Recurring rules and movements take their account's currency and
 * consult nothing here. */
import { LEDGER_CURRENCIES, isLedgerCurrency, liveAccounts, sortCurrencies, type Account, type Currency, type CurrencyGate } from '@finanzapp/domain';
import { regionRecord, type CatalogueRegionCode } from '../i18n/regions.ts';

export interface CurrencyDefaultContext {
  /** The account the form belongs to, when there is one (an edit, a card's or debt's own account): rule 1. */
  accountCurrency?: Currency | null;
  /** A route parameter naming a currency: honoured only when the gate offers it (never coerced from an unknown code). */
  requested?: unknown;
  /** Every account of the ledger, deleted ones included (they are left out here). */
  accounts: readonly Account[];
  /** The display currency as resolved for the screens (24C1), or null when none is stored. */
  displayCurrency: Currency | null;
  /** The region in use (the preference, else the device's), or null. */
  region: CatalogueRegionCode | null;
  gate?: CurrencyGate;
}

/** The currency the region suggests: its legal tender when the build offers it (the first one CLDR lists that the
 * gate holds), else the app's default. Only a suggestion: the person chooses in the form. */
export function suggestedCurrency(region: CatalogueRegionCode | null, gate: CurrencyGate = LEDGER_CURRENCIES): Currency {
  const tender = region ? regionRecord(region).currencies : [];
  return (tender as readonly string[]).find((code): code is Currency => (gate as readonly string[]).includes(code)) ?? 'ARS';
}

export function defaultCurrency({ accountCurrency, requested, accounts, displayCurrency, region, gate = LEDGER_CURRENCIES }: CurrencyDefaultContext): Currency {
  if (accountCurrency) return accountCurrency;
  if (isLedgerCurrency(requested, gate)) return requested;
  const held = sortCurrencies(liveAccounts(accounts).map(account => account.currency));
  if (held.length === 1) return held[0];
  if (held.length > 1) return displayCurrency !== null && held.includes(displayCurrency) ? displayCurrency : held[0];
  return suggestedCurrency(region, gate);
}
