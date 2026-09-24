/** The amount model: integer minor units in one currency, exact for every ISO 4217
 * exponent (0, 2, 3 and 4 today). No floating-point value ever stands for money here:
 * text is read digit by digit, scaled with BigInt, and written back from digits.
 *
 * Limits (docs/currency.md §5). A stored amount is a JavaScript safe integer
 * (|n| ≤ 2^53 − 1 = 9,007,199,254,740,991 minor units): what SQLite's INTEGER, JSON
 * and the ledger's arithmetic all hold exactly. **Typed or converted amounts** are
 * bounded tighter, at 15 significant digits in minor units (below 10^15): every
 * such amount is exact with room left for sums, and the bound is the same number of
 * minor units in every currency (15 − exponent whole digits: 13 for ARS and USD, the
 * amount field's limit since 23.1C1; 15 for JPY; 12 for KWD). Sums and balances
 * accumulate in BigInt and refuse a result outside the safe range instead of rounding.
 *
 * Nothing here converts between currencies. Combining two currencies is an error:
 * a conversion needs a dated, sourced rate (Producto 24C), never a guess. */
import { LEGACY_EXPONENT, minorUnitExponent, type IsoCurrencyCode } from './currency.ts';

export interface MoneyAmount {
  /** Integer minor units: cents of a dollar, fils of a dinar, whole yen. */
  readonly minor: number;
  readonly currency: IsoCurrencyCode;
}

/** Significant digits of a typed or converted amount, in minor units (below 10^15). */
export const MAX_AMOUNT_DIGITS = 15;
/** The largest typed or converted amount, in minor units, for every currency. */
export const MAX_ENTRY_MINOR = 10 ** MAX_AMOUNT_DIGITS - 1;

const SAFE = BigInt(Number.MAX_SAFE_INTEGER);

/** Whole digits an amount in this currency may have when typed or converted: 13 for
 * ARS and USD, 15 for JPY, 12 for KWD, 11 for a four-decimal fund. */
export function maxWholeDigits(currency: IsoCurrencyCode): number {
  return MAX_AMOUNT_DIGITS - minorUnitExponent(currency);
}

/** A stored amount's range: any safe integer (never reinterpreted, never clamped). */
export function isStorableMinor(minor: unknown): minor is number {
  return Number.isSafeInteger(minor);
}

/** A typed or converted amount's range: at most 15 significant digits in minor units. */
export function isEntryMinor(minor: unknown): minor is number {
  return Number.isSafeInteger(minor) && Math.abs(minor as number) <= MAX_ENTRY_MINOR;
}

/** An amount in a currency. Refuses a non-integer or unsafe number and a currency
 * without a minor unit; normalises −0 to 0. */
export function moneyAmount(minor: number, currency: IsoCurrencyCode): MoneyAmount {
  minorUnitExponent(currency);
  if (!isStorableMinor(minor)) throw new Error('Monto inválido.');
  return { minor: minor === 0 ? 0 : minor, currency };
}

/** The digits of an amount: sign, whole units (no grouping) and exactly `exponent`
 * fraction digits. 123456 USD → 1234 / 56; 1500 IQD → 1 / 500; 1500 JPY → 1500 / "". */
export function splitMinor(minor: number, currency: IsoCurrencyCode): { negative: boolean; whole: string; fraction: string } {
  const exponent = minorUnitExponent(currency);
  if (!isStorableMinor(minor)) throw new Error('Monto inválido.');
  const digits = String(Math.abs(minor)).padStart(exponent + 1, '0');
  return { negative: minor < 0, whole: digits.slice(0, digits.length - exponent), fraction: digits.slice(digits.length - exponent) };
}

/** The canonical machine form of an amount: "-1234.56", "1500" (JPY), "1.500" (IQD).
 * A dot, no grouping, exactly the currency's decimals: for data, never for a screen. */
export function minorToMajorString(minor: number, currency: IsoCurrencyCode): string {
  const { negative, whole, fraction } = splitMinor(minor, currency);
  return (negative ? '-' : '') + whole + (fraction ? '.' + fraction : '');
}

/** Why a text is not an amount: nothing typed, not a number, more decimals than the
 * currency has (never rounded), or more digits than an amount may have. */
export type AmountRejection = 'empty' | 'invalid' | 'precision' | 'tooLong';
export type AmountReading = { ok: true; minor: number } | { ok: false; reason: AmountRejection };

/** Whole and fraction digit strings (already validated as digits) → minor units. */
function scaled(negative: boolean, whole: string, fraction: string, exponent: number): AmountReading {
  const significant = whole.replace(/^0+(?=\d)/, '');
  const extra = fraction.slice(exponent);
  // More decimals than the currency has are accepted only when they are zeros ("12.50" JPY is not 12.5 yen).
  if (/[^0]/.test(extra)) return { ok: false, reason: 'precision' };
  if (significant.length > MAX_AMOUNT_DIGITS - exponent) return { ok: false, reason: 'tooLong' };
  const minor = BigInt(significant + fraction.slice(0, exponent).padEnd(exponent, '0'));
  const value = Number(negative ? -minor : minor);
  return { ok: true, minor: value === 0 ? 0 : value };
}

/** Reads the canonical machine form ("-1234.567", "1500", "0.5"): an optional minus, digits,
 * an optional dot and digits. Anything else is `invalid`; nothing is guessed or rounded. */
export function majorStringToMinor(text: string, currency: IsoCurrencyCode): AmountReading {
  const exponent = minorUnitExponent(currency);
  const input = String(text ?? '').trim();
  if (!input) return { ok: false, reason: 'empty' };
  if (input.length > 64) return { ok: false, reason: 'tooLong' };
  const match = /^(-)?(\d+)(?:\.(\d+))?$/.exec(input);
  if (!match) return { ok: false, reason: 'invalid' };
  return scaled(!!match[1], match[2], match[3] ?? '', exponent);
}

/** The separators a person reads and types amounts with (a region's). */
export interface AmountSeparators { readonly decimal: string; readonly group: string }

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Reads an amount written in explicit separators: digits, the group separator only
 * where it groups thousands ("1.234.567", never "12.34"), at most one decimal separator
 * followed by digits, an optional leading minus ("-" or "−"). The separators are given,
 * never guessed: "1.234" is a thousand with Argentine separators and 1.234 (one unit and
 * 234 thousandths: fils of a KWD, or `precision` for USD) with US ones. More decimals than
 * the currency has are `precision` unless they are zeros ("1,000" JPY with Argentine
 * separators is one yen). Text whose convention is unknown (a paste) is the amount field's
 * job (`ui/money-input.ts` `readPastedAmount`), which refuses the ambiguous shapes. */
export function parseLocalizedAmount(text: string, currency: IsoCurrencyCode, separators: AmountSeparators): AmountReading {
  const exponent = minorUnitExponent(currency);
  const { decimal, group } = separators;
  if (!decimal || !group || decimal === group || /[\d\-−]/.test(decimal + group)) throw new Error('Separadores inválidos.');
  const input = String(text ?? '').trim();
  if (!input) return { ok: false, reason: 'empty' };
  if (input.length > 64) return { ok: false, reason: 'tooLong' };
  const negative = input.startsWith('-') || input.startsWith('−');
  const unsigned = negative ? input.slice(1) : input;
  const parts = unsigned.split(decimal);
  if (parts.length > 2) return { ok: false, reason: 'invalid' };
  const [wholeText, fraction = null] = parts;
  if (fraction !== null && !/^\d+$/.test(fraction)) return { ok: false, reason: 'invalid' };
  let whole: string;
  if (/^\d+$/.test(wholeText)) whole = wholeText;
  else if (new RegExp(`^[1-9]\\d{0,2}(?:${escapeRegExp(group)}\\d{3})+$`).test(wholeText)) whole = wholeText.split(group).join('');
  else return { ok: false, reason: 'invalid' };
  return scaled(negative, whole, fraction ?? '', exponent);
}

/** The separators form drafts are kept in, whatever the region: what `formatMinorUnits`
 * writes and `parseMinorUnits` reads ("-1.234,56"). Presentation reformats for the screen. */
export const LEDGER_SEPARATORS: AmountSeparators = { decimal: ',', group: '.' };

/** Why a ledger-notation draft is not an amount in `currency`, as the sentence the form shows.
 * For ARS and USD the sentences are exactly `parseMinorUnits`'s; other exponents get their
 * own ("hasta 3 decimales", "números enteros"). Never a rounding, never a guess. */
export function draftRejectionMessage(reason: AmountRejection, currency: IsoCurrencyCode): string {
  const digits = minorUnitExponent(currency);
  if (reason === 'empty') return 'Ingresá un monto válido.';
  if (reason === 'tooLong') return 'El monto es demasiado grande.';
  if (digits === LEGACY_EXPONENT) return 'Usá números con hasta dos decimales.';
  if (digits === 0) return 'Usá números enteros: esta moneda no tiene decimales.';
  return `Usá números con hasta ${digits} decimales.`;
}

/** A form draft in the ledger's notation ("1.234,56", "1500", "-0,5") as integer minor units of
 * `currency`, exactly: more decimals than the currency has are refused (never rounded), more
 * digits than an amount may have are refused. This replaces `parseMinorUnits` in the forms; for
 * ARS and USD it accepts and refuses the same drafts with the same sentences (a test sweeps them),
 * except that it never guesses a separator: a draft is always ledger notation. */
export function minorFromLedgerDraft(draft: string, currency: IsoCurrencyCode): number {
  // The amount field holds at most 24 characters; a longer text is not a draft at all (parseMinorUnits's rule, kept).
  if (String(draft ?? '').trim().length > 24) throw new Error('Ingresá un monto válido.');
  const reading = parseLocalizedAmount(draft, currency, LEDGER_SEPARATORS);
  if (!reading.ok) throw new Error(draftRejectionMessage(reading.reason, currency));
  return reading.minor;
}

/** Whether a ledger-notation draft can be kept exactly in `currency`: an empty draft can, a
 * draft with more decimals than the currency has cannot (it came from another currency), and
 * so cannot one with more digits than the currency's entry bound. Text that is not an amount at
 * all is not this function's concern (`minorFromLedgerDraft` refuses it when saving). */
export function draftFitsCurrency(draft: string, currency: IsoCurrencyCode): { ok: true } | { ok: false; reason: 'precision' | 'tooLong' } {
  const reading = parseLocalizedAmount(draft, currency, LEDGER_SEPARATORS);
  if (reading.ok || reading.reason === 'empty' || reading.reason === 'invalid') return { ok: true };
  return { ok: false, reason: reading.reason };
}

/** A stored amount shown for editing: the minor units a record already holds, the currency
 * they are in, and the draft the form prefilled from them (`draftFromMinor`). */
export interface StoredDraft { readonly minor: number; readonly currency: IsoCurrencyCode; readonly draft: string }

/** Whether a draft is still exactly the prefilled stored amount, in the same currency: then the
 * stored minor units are kept as they are. A stored amount may legitimately exceed the entry
 * bound (a balance is a sum of valid movements; a backup may carry any safe integer), so
 * re-reading its own prefill as a new entry would refuse it and lock every other edit. Any
 * change to the text, or a different currency, makes it a new entry again. */
export function isUnchangedStoredDraft(draft: string, currency: IsoCurrencyCode, stored: StoredDraft | null | undefined): stored is StoredDraft {
  return !!stored && stored.currency === currency && draft === stored.draft;
}

/** `minorFromLedgerDraft` for an edit form: the stored minor units when the draft is the
 * untouched prefill in its own currency (still required to be a storable safe integer),
 * otherwise the draft read as a new entry with every entry rule (the bound, the decimals,
 * never rounded). A stored amount is never rescaled by this path. */
export function minorFromEditedDraft(draft: string, currency: IsoCurrencyCode, stored: StoredDraft | null | undefined): number {
  if (isUnchangedStoredDraft(draft, currency, stored)) {
    if (!isStorableMinor(stored.minor)) throw new Error('Monto inválido.');
    return stored.minor;
  }
  return minorFromLedgerDraft(draft, currency);
}

/** `draftFitsCurrency` for an edit form: an untouched stored prefill always fits (it is what
 * the record holds); anything edited must fit as a new entry. */
export function editedDraftFits(draft: string, currency: IsoCurrencyCode, stored: StoredDraft | null | undefined): ReturnType<typeof draftFitsCurrency> {
  return isUnchangedStoredDraft(draft, currency, stored) ? { ok: true } : draftFitsCurrency(draft, currency);
}

/** An operand must be a safe integer in a currency with a minor unit: a hand-built
 * `{ minor: 2 ** 53 }` or `{ minor: NaN }` is refused, never computed with. */
function checked(a: MoneyAmount): MoneyAmount {
  minorUnitExponent(a.currency);
  if (!isStorableMinor(a.minor)) throw new Error('Monto inválido.');
  return a;
}

function sameCurrency(a: MoneyAmount, b: MoneyAmount): void {
  checked(a);
  checked(b);
  if (a.currency !== b.currency) throw new Error('No se pueden combinar importes de monedas distintas sin una cotización.');
}

function safe(value: bigint): number {
  if (value > SAFE || value < -SAFE) throw new Error('El total supera el rango seguro.');
  const number = Number(value);
  return number === 0 ? 0 : number;
}

export function addMoney(a: MoneyAmount, b: MoneyAmount): MoneyAmount {
  sameCurrency(a, b);
  return moneyAmount(safe(BigInt(a.minor) + BigInt(b.minor)), a.currency);
}

export function subtractMoney(a: MoneyAmount, b: MoneyAmount): MoneyAmount {
  sameCurrency(a, b);
  return moneyAmount(safe(BigInt(a.minor) - BigInt(b.minor)), a.currency);
}

export function negateMoney(a: MoneyAmount): MoneyAmount {
  return moneyAmount(safe(-BigInt(checked(a).minor)), a.currency);
}

/** The exact total of amounts that must all be in `currency` (an empty list is zero).
 * Intermediate sums may exceed the safe range; only the result must fit. */
export function sumMoney(items: readonly MoneyAmount[], currency: IsoCurrencyCode): MoneyAmount {
  const zero = moneyAmount(0, currency);
  let total = 0n;
  for (const item of items) {
    sameCurrency(zero, item);
    total += BigInt(item.minor);
  }
  return moneyAmount(safe(total), currency);
}

/** −1, 0 or 1; comparing two currencies is an error, like adding them. */
export function compareMoney(a: MoneyAmount, b: MoneyAmount): -1 | 0 | 1 {
  sameCurrency(a, b);
  return a.minor < b.minor ? -1 : a.minor > b.minor ? 1 : 0;
}
