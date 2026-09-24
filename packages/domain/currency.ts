/** The currency catalogue: which ISO 4217 currencies FinanzApp knows, which of
 * them the ledger can hold today, and the scale of each one's minor unit.
 *
 * Five things stay separate (docs/currency.md):
 *   - the amount: integer minor units (`money.ts`);
 *   - the currency: an ISO 4217 code, a property of an account;
 *   - the minor-unit scale: the currency's ledger exponent (ISO 4217's minor unit), fixed
 *     once a currency can be stored, so a stored amount is never reinterpreted;
 *   - the visual format: CLDR display digits, symbols and names (apps/mobile/src/i18n);
 *   - the regional preference: separators and what a bare "$" means, never a currency.
 *
 * Availability, one status per code:
 *   - `ledger`: an account can hold it now (ARS and USD);
 *   - `ready`: a fiat currency with complete data; presentation works, but it is not
 *     stored or offered anywhere until Producto 24B makes storage currency-aware;
 *   - `incomplete`: a fiat currency whose data lacks something (a name in a language
 *     this build carries, or any territory where CLDR lists it as current legal tender:
 *     VED, SVC); never offered until the data is completed or a reviewed decision;
 *   - `excluded`: not money a person spends (ISO funds, precious metals, units of
 *     account, the test code and XXX); never offered.
 * The data is generated (currency-data.ts); this module is the only API over it. */
import { CURRENCY_CODES, CURRENCY_DATA, type CurrencyRecord, type IsoCurrencyCode } from './currency-data.ts';
import type { Currency } from './ledger.ts';

export { CLDR_VERSION, CURRENCY_CODES, ISO_4217_PUBLISHED, type CurrencyDataStatus, type CurrencyKind, type CurrencyRecord,
  type IsoCurrencyCode } from './currency-data.ts';

export type CurrencyStatus = 'ledger' | 'ready' | 'incomplete' | 'excluded';

/** The currencies an account, a budget or a recurring rule can hold today. Adding one
 * here is Producto 24B's decision, after storage records each currency's scale. */
export const LEDGER_CURRENCIES: readonly Currency[] = ['ARS', 'USD'];

/** What an amount written before Producto 24B means: ARS and USD cents. Rows and backups
 * from before 24B carry no scale; they are read with this one, and only for these two
 * currencies, whatever `LEDGER_CURRENCIES` grows to (a EUR row without a scale can only be
 * damaged data, never a legacy row). */
export const LEGACY_EXPONENT = 2;
export const LEGACY_CURRENCIES: readonly Currency[] = ['ARS', 'USD'];

// A ledger currency is always an ISO code with a minor unit (checked at compile time and in the tests).
const ledgerCodes: readonly IsoCurrencyCode[] = LEDGER_CURRENCIES;

export function isIsoCurrencyCode(value: unknown): value is IsoCurrencyCode {
  return typeof value === 'string' && Object.hasOwn(CURRENCY_DATA, value);
}

/** A currency an account can hold today (ARS or USD). */
export function isLedgerCurrency(value: unknown): value is Currency {
  return typeof value === 'string' && (ledgerCodes as readonly string[]).includes(value);
}

export function currencyRecord(code: IsoCurrencyCode): CurrencyRecord {
  if (!isIsoCurrencyCode(code)) throw new Error('Moneda no admitida.');
  return CURRENCY_DATA[code];
}

export function currencyStatus(code: IsoCurrencyCode): CurrencyStatus {
  return isLedgerCurrency(code) ? 'ledger' : currencyRecord(code).status;
}

/** Every code with one of these statuses, in code order. */
export function currenciesWithStatus(...statuses: readonly CurrencyStatus[]): IsoCurrencyCode[] {
  return CURRENCY_CODES.filter(code => statuses.includes(currencyStatus(code)));
}

/** Whether amounts in this currency can be represented at all: it has an ISO minor unit
 * (every fiat currency and the funds; not metals, units of account, XTS or XXX). */
export function hasMinorUnit(code: IsoCurrencyCode): boolean {
  return isIsoCurrencyCode(code) && CURRENCY_DATA[code].minorUnit !== null;
}

/** The ledger exponent: how many decimal places one minor unit is (ISO 4217's minor
 * unit). 1 JPY = 1 minor unit (0), 1 USD = 100 (2), 1 KWD = 1000 (3), 1 CLF = 10000 (4).
 * Throws for a code without one (metals, units of account, XTS, XXX). */
export function minorUnitExponent(code: IsoCurrencyCode): number {
  const exponent = currencyRecord(code).minorUnit;
  if (exponent === null) throw new Error('Moneda no admitida.');
  return exponent;
}

/** The fewest fraction digits a formatted amount shows: CLDR's display digits, never
 * more than the ledger exponent. Iraqi dinars: exponent 3, CLDR 0, so a whole amount
 * reads "1.500" and a stored fraction still shows ("1.500,5"): a recorded value is never
 * rounded away for display. For ARS and USD this is 2, as always. */
export function displayDigits(code: IsoCurrencyCode): number {
  return Math.min(currencyRecord(code).digits, minorUnitExponent(code));
}

/** The scale of a stored amount, for Producto 24B's reads. A row or backup written
 * before 24B has no scale (`stored` null or undefined): only ARS and USD can be such rows,
 * and they are cents. A row with a scale must carry exactly the currency's exponent: a
 * catalogue update that changed an exponent must never silently rescale recorded money,
 * so a disagreement is an error to resolve, not a conversion. */
export function storedExponent(code: IsoCurrencyCode, stored: number | null | undefined): number {
  const exponent = minorUnitExponent(code);
  if (stored === null || stored === undefined) {
    if (!(LEGACY_CURRENCIES as readonly string[]).includes(code) || exponent !== LEGACY_EXPONENT) {
      throw new Error('La escala de la moneda no coincide con el registro.');
    }
    return LEGACY_EXPONENT;
  }
  if (stored !== exponent) throw new Error('La escala de la moneda no coincide con el registro.');
  return exponent;
}
