/** Which currencies a new account, card, debt or budget may take in this build: the production
 * gate (`LEDGER_CURRENCIES`: ARS, USD and, since Producto 24M, every ready currency with 0 or 2
 * decimals) or, only in a development bundle started with `EXPO_PUBLIC_CURRENCY_PREVIEW=1`, the
 * preview set below, which adds the held three-decimal currencies so FinanzApp Dev can run their
 * VoiceOver check on a real iPhone without any release bundle ever seeing them: babel-preset-expo
 * inlines `__DEV__` as false in a release, so the expression compiles to the production gate whatever
 * the flag says (tests/currency-preview.node.ts compiles the provider both ways). The gate opens
 * creation only; reading, exporting and restoring a stored currency never consult it. Mirrors the
 * locale preview (`releasedForBuild`). */
import { HELD_CURRENCIES, LEDGER_CURRENCIES, isStorableCurrency, type CurrencyGate, type IsoCurrencyCode } from '@finanzapp/domain';

/** The name of the flag, read by its literal name in `LedgerProvider` so Expo inlines it. */
export const CURRENCY_PREVIEW_FLAG = 'EXPO_PUBLIC_CURRENCY_PREVIEW';

/** The production gate and the held currencies (BHD, IQD, JOD, KWD, LYD, OMR, TND). Every code is storable, so the
 * preview can never pin a fund or a metal. */
export const PREVIEW_CURRENCIES: CurrencyGate = [...LEDGER_CURRENCIES, ...(Object.keys(HELD_CURRENCIES) as IsoCurrencyCode[])];

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
