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
import { CURRENCY_CODES, CURRENCY_DATA, ISO_4217_PUBLISHED, type CurrencyRecord, type IsoCurrencyCode } from './currency-data.ts';

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
      throw new Error(SCALE_CONFLICT_MESSAGE);
    }
    return LEGACY_EXPONENT;
  }
  if (stored !== exponent) throw new Error(SCALE_CONFLICT_MESSAGE);
  return exponent;
}

/** A stored scale that disagrees with the catalogue: never rescaled, never reset, an error to resolve. */
export const SCALE_CONFLICT_MESSAGE = 'La escala de la moneda no coincide con el registro.';
/** A stored row in a currency other than ARS/USD whose scale was never pinned (`{code}` is the currency). */
export const scaleMissingMessage = (code: string) => `La moneda ${code} no tiene una escala registrada. No se modificó nada.`;
/** A scale pinned for a currency that never needs one (ARS, USD) or that no row uses (a v9 file lists exactly the codes it uses). */
export const UNIT_UNNEEDED_MESSAGE = 'La copia registra una escala para una moneda que no la necesita. No se importó nada.';

/** The scale of one currency as storage pins it the first time a row in that currency is written
 * (SQLite `currency_units`, backup v9 `currencyUnits`; Producto 24B4). Append-only and never
 * updated: the exponent is ISO 4217's minor unit at the catalogue version named, so a later
 * catalogue that disagrees is detected (`storedExponent`) instead of silently rescaling money.
 * ARS and USD are never pinned: rows and backups from before 24B carry them as cents. */
export interface CurrencyUnit {
  currency: IsoCurrencyCode;
  /** 0–4: ISO 4217's minor unit (JPY 0, USD 2, KWD 3, CLF 4). */
  minorUnitExponent: number;
  /** Which authority the exponent came from. */
  source: string;
  /** That authority's publication the catalogue was generated from (ISO 4217 List One's date). */
  catalogVersion: string;
}
export const CURRENCY_UNIT_KEYS = ['currency', 'minorUnitExponent', 'source', 'catalogVersion'] as const;
export const CURRENCY_UNIT_SOURCE = 'ISO 4217 List One';
export const MAX_UNIT_EXPONENT = 4;

/** The unit the catalogue pins for a storable currency today. Throws for a code that cannot be stored. */
export function catalogueUnit(code: IsoCurrencyCode): CurrencyUnit {
  assertStorableCurrency(code);
  return { currency: code, minorUnitExponent: minorUnitExponent(code), source: CURRENCY_UNIT_SOURCE, catalogVersion: ISO_4217_PUBLISHED };
}

/** Read acceptance for one pinned unit: the exact key set, a storable code that is not ARS or
 * USD, an integer exponent 0–4 that equals the catalogue's (anything else is `SCALE_CONFLICT_MESSAGE`),
 * and non-empty provenance strings. The provenance is recorded, never compared: a unit pinned from
 * an older catalogue version with the same exponent is the same scale. */
export function validateCurrencyUnit(value: unknown): asserts value is CurrencyUnit {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).length !== CURRENCY_UNIT_KEYS.length || CURRENCY_UNIT_KEYS.some(key => !Object.hasOwn(value, key))) {
    throw new Error('La copia contiene campos faltantes o no compatibles. No se importó nada.');
  }
  const unit = value as Record<string, unknown>;
  assertStorableCurrency(unit.currency);
  if (isLegacyCurrency(unit.currency)) throw new Error(UNIT_UNNEEDED_MESSAGE);
  if (!Number.isInteger(unit.minorUnitExponent) || (unit.minorUnitExponent as number) < 0 || (unit.minorUnitExponent as number) > MAX_UNIT_EXPONENT) {
    throw new Error(SCALE_CONFLICT_MESSAGE);
  }
  storedExponent(unit.currency, unit.minorUnitExponent as number);
  for (const key of ['source', 'catalogVersion'] as const) {
    if (typeof unit[key] !== 'string' || !(unit[key] as string).trim() || (unit[key] as string).length > 80) throw new Error('Origen de la escala inválido.');
  }
}

/** The currencies of a set of accounts and budgets that need a pinned scale: every storable code
 * present other than ARS and USD, in grouping order. */
export function currenciesNeedingUnits(rows: { accounts: readonly { currency: IsoCurrencyCode }[]; budgets?: readonly { currency: IsoCurrencyCode }[] }): IsoCurrencyCode[] {
  return sortCurrencies([...rows.accounts, ...rows.budgets ?? []].map(row => row.currency).filter(code => !isLegacyCurrency(code)));
}

/** A collection of pinned units against the currencies that use them: each unit valid, no code
 * twice, every code in `used` pinned (`scaleMissingMessage`). With `exact`, a unit for a code that
 * is not used is refused too (a backup lists exactly what it uses); storage tolerates one. */
export function validateCurrencyUnits(units: readonly CurrencyUnit[], used: Iterable<IsoCurrencyCode>, exact = false): void {
  const seen = new Set<string>();
  for (const unit of units) {
    validateCurrencyUnit(unit);
    if (seen.has(unit.currency)) throw new Error('La copia repite la escala de una moneda. No se importó nada.');
    seen.add(unit.currency);
  }
  const needed = new Set<string>();
  for (const code of used) {
    if (isLegacyCurrency(code)) continue;
    needed.add(code);
    if (!seen.has(code)) throw new Error(scaleMissingMessage(code));
  }
  if (exact) for (const code of seen) if (!needed.has(code)) throw new Error(UNIT_UNNEEDED_MESSAGE);
}

/** The exponent a stored row in `code` is read with: ARS/USD cents without a unit, otherwise the
 * pinned unit's exponent, which must equal the catalogue's (`storedExponent`). A code without a
 * pinned unit is refused by name: nothing is ever read as cents by default. */
export function pinnedExponent(code: IsoCurrencyCode, units: readonly CurrencyUnit[]): number {
  const unit = units.find(item => item.currency === code);
  if (!unit && !isLegacyCurrency(code)) throw new Error(scaleMissingMessage(code));
  return storedExponent(code, unit?.minorUnitExponent);
}
