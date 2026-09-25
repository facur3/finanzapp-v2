/** Which currencies a new account, card, debt or budget may take in this build: the production
 * gate (`LEDGER_CURRENCIES`, ARS and USD) or, only in a development bundle started with
 * `EXPO_PUBLIC_CURRENCY_PREVIEW=1`, the preview set below, so FinanzApp Dev can exercise zero,
 * two and three decimals on a real iPhone (docs/currency.md §7.5, stage 9) without any release
 * bundle ever seeing them: babel-preset-expo inlines `__DEV__` as false in a release, so the
 * expression compiles to the production gate whatever the flag says (tests/currency-preview.node.ts
 * compiles the provider both ways). The gate opens creation only; reading, exporting and restoring
 * a stored currency never consult it. Mirrors the locale preview (`releasedForBuild`). */
import { LEDGER_CURRENCIES, isStorableCurrency, type CurrencyGate, type IsoCurrencyCode } from '@finanzapp/domain';

/** The name of the flag, read by its literal name in `LedgerProvider` so Expo inlines it. */
export const CURRENCY_PREVIEW_FLAG = 'EXPO_PUBLIC_CURRENCY_PREVIEW';

/** ARS and USD plus the test currencies of docs/currency.md: two decimals (EUR, GBP), none (JPY, CLP)
 * and three (KWD). Every code is storable, so the preview can never pin a fund or a metal. */
export const PREVIEW_CURRENCIES: CurrencyGate = ['ARS', 'USD', 'EUR', 'GBP', 'JPY', 'CLP', 'KWD'];

export function currencyGateForBuild(flag: string | undefined, development: boolean): CurrencyGate {
  return development && flag === '1' ? PREVIEW_CURRENCIES : LEDGER_CURRENCIES;
}

/** Whether a gate is wider than the release's: the Más footer says so, so a tester never mistakes a preview for production. */
export function isPreviewGate(gate: CurrencyGate): boolean {
  return gate !== LEDGER_CURRENCIES && (gate.length !== LEDGER_CURRENCIES.length || gate.some((code, index) => code !== LEDGER_CURRENCIES[index]));
}

/** The codes of a gate beyond the release's, for the footer. */
export function previewOnlyCurrencies(gate: CurrencyGate): IsoCurrencyCode[] {
  return gate.filter(code => isStorableCurrency(code) && !(LEDGER_CURRENCIES as readonly string[]).includes(code));
}
