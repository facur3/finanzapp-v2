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

export { CLDR_VERSION, CURRENCY_CODES, ISO_4217_PUBLISHED, type CurrencyDataStatus, type CurrencyKind, type CurrencyRecord,
  type IsoCurrencyCode } from './currency-data.ts';

export type CurrencyStatus = 'ledger' | 'ready' | 'incomplete' | 'excluded';

/** The two currencies every row and backup written before Producto 24B can name. They are
 * the only codes a scale-less record may carry (`storedExponent`) and the only ones the
 * backup formats v1–v8 and the Assistant contract v1 accept, whatever the gate grows to. */
export type LegacyCurrency = 'ARS' | 'USD';
export const LEGACY_CURRENCIES: readonly LegacyCurrency[] = ['ARS', 'USD'];
/** What an amount written before Producto 24B means: ARS and USD cents. */
export const LEGACY_EXPONENT = 2;

/** The currencies an account, a budget or a recurring rule can hold today. Adding one
 * here is Producto 24B's decision (stage 9 of docs/currency.md §7.5), after storage
 * records each currency's scale. This list gates **creation only**; reading a stored
 * row never consults it (`isStorableCurrency`). */
export const LEDGER_CURRENCIES: readonly IsoCurrencyCode[] = ['ARS', 'USD'];

/** A set of currencies offered for new records: the production gate, or the explicit set
 * a test passes. A gate never widens what can be read, exported or restored. */
export type CurrencyGate = readonly IsoCurrencyCode[];

export function isIsoCurrencyCode(value: unknown): value is IsoCurrencyCode {
  return typeof value === 'string' && Object.hasOwn(CURRENCY_DATA, value);
}

export function isLegacyCurrency(value: unknown): value is LegacyCurrency {
  return typeof value === 'string' && (LEGACY_CURRENCIES as readonly string[]).includes(value);
}

/** Read acceptance: a currency a stored row, a backup or a view may name. An ISO 4217
 * fiat currency with a minor unit, whatever its availability status and whatever the
 * gate says: a code that stops being offered for new accounts keeps every recorded
 * movement readable. Funds, metals, units of account, XTS and XXX are never money here. */
export function isStorableCurrency(value: unknown): value is IsoCurrencyCode {
  if (!isIsoCurrencyCode(value)) return false;
  const record = CURRENCY_DATA[value];
  return record.kind === 'fiat' && record.minorUnit !== null;
}

export function assertStorableCurrency(value: unknown): asserts value is IsoCurrencyCode {
  if (!isStorableCurrency(value)) throw new Error('Moneda no admitida.');
}

/** Creation gate: a currency a **new** account, card, debt or budget may hold. The
 * production gate is `LEDGER_CURRENCIES` (ARS and USD); tests pass an explicit set. A
 * gated code must also be storable, so a gate can never open a fund or a metal. */
export function isLedgerCurrency(value: unknown, gate: CurrencyGate = LEDGER_CURRENCIES): value is IsoCurrencyCode {
  return isStorableCurrency(value) && (gate as readonly string[]).includes(value);
}

export function assertLedgerCurrency(value: unknown, gate: CurrencyGate = LEDGER_CURRENCIES): asserts value is IsoCurrencyCode {
  if (!isLedgerCurrency(value, gate)) throw new Error('Elegí una moneda disponible.');
}

/** The order groupings list currencies in: ARS, USD (as every total has always been keyed),
 * then the remaining codes alphabetically. Duplicates collapse; nothing is dropped. */
export function sortCurrencies(codes: Iterable<IsoCurrencyCode>): IsoCurrencyCode[] {
  const rank = (code: string) => { const index = (LEGACY_CURRENCIES as readonly string[]).indexOf(code); return index === -1 ? LEGACY_CURRENCIES.length : index; };
  return [...new Set(codes)].sort((a, b) => rank(a) - rank(b) || (a < b ? -1 : a > b ? 1 : 0));
}

/** The currencies actually present in a list of accounts, in grouping order. */
export function currenciesPresent(accounts: readonly { currency: IsoCurrencyCode }[]): IsoCurrencyCode[] {
  return sortCurrencies(accounts.map(account => account.currency));
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
    if (!isLegacyCurrency(code) || exponent !== LEGACY_EXPONENT) {
      throw new Error('La escala de la moneda no coincide con el registro.');
    }
    return LEGACY_EXPONENT;
  }
  if (stored !== exponent) throw new Error('La escala de la moneda no coincide con el registro.');
  return exponent;
}
