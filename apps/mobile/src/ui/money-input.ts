/** Amount entry as a canonical edit state, written with the region's separators.
 *
 * The field shows "2.000.000,50" (Argentina) or "2,000,000.50" (United
 * States) while the user types: the region's group separator between
 * thousands, its decimal separator before up to two decimals. Everything here
 * is presentation. The form keeps its draft in the ledger's notation
 * (`LEDGER_FORMAT`, the separators formatMinorUnits writes and parseMinorUnits
 * reads) whatever the region, so the domain still turns it into integer minor
 * units, no floating-point number exists on the path, and a region change
 * never rewrites a draft.
 *
 * The model is a canonical state, never the display string:
 *
 *   sign · whole digits · optional decimal mark · decimal digits · caret
 *
 * where the caret is a logical index into the canonical string ("-1234,5"; the
 * canonical decimal mark is always a comma), one that grouping cannot move.
 * The display string and the display caret are derived from that state and a
 * format (renderAmount). Each native change is read back into the state
 * (readAmountInput) from the digits and decimal separators the native text
 * contains, so a group separator FinanzApp inserted itself is never mistaken
 * for a decimal separator, even when the native text lags behind the last
 * render. The other separator counts as a decimal only when it is explicit
 * input: one keystroke (the iOS decimal pad shows the device's separator,
 * which may not be the app region's), or a pasted number whose own separators
 * say so unambiguously. A pasted number that could mean two amounts is
 * refused with a reason instead of guessed. */
import { CURRENCY_CODES, currencyRecord, isStorableCurrency, maxWholeDigits, minorUnitExponent, splitMinor, type Currency } from '@finanzapp/domain';
import { groupBreaks, groupWhole, type Grouping } from '../i18n/grouping.ts';

/** How many digits an amount in a currency may have: its ISO exponent as decimals (0 for JPY,
 * 2 for ARS/USD/EUR, 3 for KWD) and 15 − exponent whole digits (docs/currency.md §5: 13 for
 * ARS and USD, as always). Every reader, writer and settle step takes the currency explicitly,
 * so no site can assume two decimals by omission. */
export interface AmountPrecision { readonly decimals: number; readonly wholeDigits: number }
export function precisionOf(currency: Currency): AmountPrecision {
  return { decimals: minorUnitExponent(currency), wholeDigits: maxWholeDigits(currency) };
}

/** The two separators an amount is written with and where the group separator goes (Producto 24R2A:
 * any catalogue region's grouping, `grouping.ts`): "1.234.567,5", "1,234,567.5", "12,34,567.5" (lakh),
 * "1'234'567.5", "1 234 567,5" with a no-break or a narrow no-break space, "1000" unbroken where the
 * region's minimum grouping says so. The group separator is always one character. */
export interface AmountFormat extends Grouping { decimal: string; group: string }

/** The ledger's notation ("-1.234,56"): what formatMinorUnits writes and
 * parseMinorUnits reads. Form drafts are kept in it in every region. */
export const LEDGER_FORMAT: AmountFormat = { decimal: ',', group: '.' };

export interface AmountEdit {
  negative: boolean;
  /** Whole digits with no leading zeros ("" for an empty field, "0" before a decimal mark). */
  whole: string;
  /** Whether the decimal separator has been entered. */
  decimal: boolean;
  fraction: string;
  /** Logical caret: an index into canonicalAmount(state). */
  caret: number;
}

/** The text a field shows and where its caret is, both in display coordinates. */
export interface AmountView { text: string; caret: number }

export const EMPTY_AMOUNT: AmountEdit = { negative: false, whole: '', decimal: false, fraction: '', caret: 0 };

/** "-1234,5": the state as digits, at most one decimal comma and an optional sign. */
export function canonicalAmount(state: AmountEdit): string {
  return (state.negative ? '-' : '') + state.whole + (state.decimal ? ',' + state.fraction : '');
}

/** Groups whole digits with the format's separator and grouping. */
function group(whole: string, format: AmountFormat): string {
  return groupWhole(whole, format.group, format);
}

/** Number of group separators the display puts before the k-th whole digit (a separator right after it is not counted). */
function groupsBefore(wholeLength: number, digitsBefore: number, format: AmountFormat): number {
  return groupBreaks(wholeLength, format).filter(at => at < digitsBefore).length;
}

/** Where a logical caret lands in the display string. A caret right before a
 * group separator stays before it, so typing continues after the digit. */
export function displayCaret(state: AmountEdit, logical: number, format: AmountFormat = LEDGER_FORMAT): number {
  const sign = state.negative ? 1 : 0;
  const caret = Math.max(0, Math.min(logical, canonicalAmount(state).length));
  if (caret <= sign) return caret;
  const digitsBefore = Math.min(caret - sign, state.whole.length);
  const inWhole = sign + digitsBefore + groupsBefore(state.whole.length, digitsBefore, format) * format.group.length;
  if (caret - sign <= state.whole.length) return inWhole;
  // Past the whole: the decimal separator and the fraction have no grouping.
  return sign + group(state.whole, format).length + (caret - sign - state.whole.length - 1) + format.decimal.length;
}

/** The display string and where the caret sits in it. */
export function renderAmount(state: AmountEdit, format: AmountFormat = LEDGER_FORMAT): AmountView {
  const text = (state.negative ? '-' : '') + group(state.whole, format) + (state.decimal ? format.decimal + state.fraction : '');
  return { text, caret: displayCaret(state, state.caret, format) };
}

/** The logical position of a display index: display characters minus the group separators before it. */
export function logicalCaret(display: string, index: number, format: AmountFormat = LEDGER_FORMAT): number {
  const clamped = Math.max(0, Math.min(index, display.length));
  return clamped - count(display.slice(0, clamped), format.group);
}

/** Display text in canonical notation: group separators dropped, the decimal separator as a comma. */
function canonicalText(display: string, format: AmountFormat): string {
  let text = '';
  for (const char of display) {
    if (char === format.group) continue;
    text += char === format.decimal ? ',' : char;
  }
  return text;
}

/** Reads a canonical-looking string (digits, one comma, optional sign; other
 * characters are dropped) into a state, with a logical caret. Leading zeros
 * are removed and the fraction keeps the currency's decimals (a digit typed
 * past them simply does not appear; at zero decimals a comma is not kept).
 * More whole digits than the currency allows gives `null`, so a caller can
 * refuse that edit instead of changing the number. */
export function amountFromCanonical(text: string, caret: number, currency: Currency): AmountEdit | null {
  return readCanonical(text, caret, precisionOf(currency));
}

function readCanonical(text: string, caret: number, precision: AmountPrecision): AmountEdit | null {
  const negative = /^\s*[-−]/.test(text);
  const body = text.replace(/^\s*[-−]\s*/, '');
  const position = Math.max(0, caret - (text.length - body.length));
  let whole = '', fraction = '', decimal = false, logical = 0;
  let zeroAt = -1; // index of a lone leading zero still standing in `whole`
  for (let index = 0; index < body.length; index++) {
    const char = body[index];
    let kept = false;
    if (char === ',' && !decimal && precision.decimals > 0) { decimal = true; kept = true; }
    else if (/[0-9]/.test(char)) {
      kept = true;
      if (decimal) fraction += char;
      else if (whole === '0') {
        // "07" is "7": the lone zero leaves, and so does its place before the caret.
        if (zeroAt < position) logical--;
        whole = char;
        zeroAt = char === '0' ? index : -1;
      } else {
        whole += char;
        if (whole === '0') zeroAt = index;
      }
    }
    if (kept && index < position) logical++;
  }
  if (decimal && whole === '') { whole = '0'; if (position > 0) logical++; }
  if (whole.length > precision.wholeDigits) return null;
  const state: AmountEdit = { negative, whole, decimal, fraction: fraction.slice(0, precision.decimals), caret: 0 };
  state.caret = Math.max(0, Math.min((negative ? 1 : 0) + logical, canonicalAmount(state).length));
  return state;
}

/** The state a displayed field holds: its text read in `format`, its caret made logical. */
export function amountFromView(view: AmountView, format: AmountFormat, currency: Currency): AmountEdit {
  return viewState(view, format, precisionOf(currency));
}
function viewState(view: AmountView, format: AmountFormat, precision: AmountPrecision): AmountEdit {
  return readCanonical(canonicalText(view.text, format), logicalCaret(view.text, view.caret, format), precision) ?? EMPTY_AMOUNT;
}

// ---- Pasted text ------------------------------------------------------------

/** Why a pasted text was not put in the field. Nothing is ever guessed:
 *   - `ambiguous`: one separator before exactly three digits, and it is not the
 *     region's group separator ("1,000" in Argentina, "1.000" in the United
 *     States): a thousand in one convention, one with three decimals in the other.
 *     In a currency with three decimals (KWD) that shape is ambiguous whatever the
 *     separator: "1.234" may be a thousand dinars or one dinar and 234 fils;
 *   - `precision`: more decimals than the currency has that are not trailing zeros
 *     ("12.345,678" in pesos, "12,5" in yen);
 *   - `invalid`: not an amount ("abc", "1.000.5", "12 34", a second sign or a
 *     second decimal separator once it lands in the field);
 *   - `tooLong`: more whole digits than the currency allows (13 for ARS and USD);
 *   - `currencyMismatch`: an explicit currency conflicts with the account's currency. */
export type PasteRejection = 'ambiguous' | 'precision' | 'invalid' | 'tooLong' | 'currencyMismatch';
export interface AmountNotice { reason: PasteRejection; text: string }

type PastedAmount = { ok: true; negative: boolean; canonical: string } | { ok: false; reason: PasteRejection };

// Explicit currency markers must match the account: every storable ISO code and every
// language-neutral symbol of the catalogue that names one currency ("US$", "€", "JP¥",
// "KWD"), plus FinanzApp's "AR$" and the older "U$S". A bare "$" names nothing (29
// currencies use it): it is stripped, never taken as evidence. Built once from the catalogue.
const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const marks = (() => {
  const byMark = new Map<string, Currency>([['AR$', 'ARS'], ['U$S', 'USD']]);
  for (const code of CURRENCY_CODES) {
    if (!isStorableCurrency(code)) continue;
    byMark.set(code, code);
    const { symbol } = currencyRecord(code);
    if (symbol !== code && !byMark.has(symbol.toUpperCase())) byMark.set(symbol.toUpperCase(), code);
  }
  const letter = /[A-Za-z]/;
  const alternatives = [...byMark.keys()].sort((a, b) => b.length - a.length).map(mark =>
    (letter.test(mark[0]) ? '(?<![A-Za-z])' : '') + escapeRegExp(mark) + (letter.test(mark[mark.length - 1]) ? '(?![A-Za-z])' : ''));
  return { byMark, explicit: new RegExp(alternatives.join('|'), 'gi'), all: new RegExp(alternatives.join('|') + '|\\$', 'gi') };
})();
/** The currency an explicit marker names, or null for text that is not one. */
export function currencyOfMark(text: string): Currency | null {
  return marks.byMark.get(text.toUpperCase()) ?? null;
}
// \s covers the no-break, narrow no-break and thin spaces other apps group thousands with.
const SPACES = /\s+/g;
// An apostrophe only ever groups ("1'234.56", "1’234.56" in Switzerland): read like a space, never a decimal.
const APOSTROPHES = /['\u2019\u02BC]/g;

/** Digits another script's keyboard or a pasted text may carry, read as the same digits: Arabic-Indic and
 * Eastern Arabic-Indic (an iPhone whose Region writes them shows them on the decimal pad) and full-width digits;
 * the Arabic decimal separator is a decimal point and the Arabic thousands separator an apostrophe (grouping
 * only). One UTF-16 unit for one, so every index into the text stays valid. Nothing is guessed: each of these
 * characters has one meaning. */
export function latinDigits(text: string): string {
  return text.replace(/[\u0660-\u0669\u06F0-\u06F9\uFF10-\uFF19\u066B\u066C]/g, char => {
    const code = char.charCodeAt(0);
    if (code === 0x066B) return '.';
    if (code === 0x066C) return "'";
    return String(code - (code >= 0xFF10 ? 0xFF10 : code >= 0x06F0 ? 0x06F0 : 0x0660));
  });
}

/** Whether whole-digit groups are written the way some region writes them: groups of three after a first
 * group of one to three digits ("1.234.567"), or the Indian lakh and crore, a last group of three after groups
 * of two ("12,34,567"). Either way the digits are the number; anything else ("1.2.3", "12 34") is not an amount. */
function wellGrouped(groups: readonly string[]): boolean {
  const first = groups[0], rest = groups.slice(1), last = groups[groups.length - 1];
  if (!first || first.startsWith('0')) return false;
  if (first.length <= 3 && rest.every(run => run.length === 3)) return true;
  return first.length <= 2 && last.length === 3 && groups.slice(1, -1).every(run => run.length === 2);
}

/** A pasted text as a canonical amount ("-1234,5"), read by the separators the
 * text itself uses:
 *   - both "." and "," present: the last one is the decimal separator and the
 *     other one must group thousands correctly ("1.234,56", "1,234.56", in any region);
 *   - one kind, repeated: it groups thousands ("1.234.567", "1,234,567");
 *   - one separator followed by one or two digits (or none): decimals ("12,5", "12.50");
 *   - one separator followed by exactly three digits: a thousand when it is the
 *     region's group separator ("1.000" in Argentina), otherwise ambiguous;
 *   - spaces and apostrophes only ever group ("1 234,56", "1'234.56"), lakh grouping is read
 *     ("12,34,567.50"), and digits of another script are read as the same digits (`latinDigits`);
 *     "$", "US$", "AR$", "U$S", "ARS"
 *     and "USD" are stripped only after checking their explicit currency against the account;
 *     a mismatched currency is refused, never converted. A leading minus is kept.
 * Decimals beyond the second must be zeros. Only the digits are kept: no
 * number is ever computed from the text. */
export function readPastedAmount(text: string, format: AmountFormat, currency: Currency): PastedAmount {
  return readPaste(text, format, precisionOf(currency), currency);
}
function readPaste(text: string, format: AmountFormat, precision: AmountPrecision, currency: Currency): PastedAmount {
  const explicit = [...text.matchAll(marks.explicit)].map(match => currencyOfMark(match[0]));
  if (explicit.length > 1) return { ok: false, reason: 'invalid' };
  if (explicit.some(code => code !== currency)) return { ok: false, reason: 'currencyMismatch' };
  let body = latinDigits(text).replace(marks.all, ' ').replace(APOSTROPHES, ' ').replace(SPACES, ' ').trim();
  const negative = /^[-−]/.test(body);
  if (negative) body = body.slice(1).trim();
  if (!/^[0-9., ]+$/.test(body) || !/[0-9]/.test(body)) return { ok: false, reason: 'invalid' };
  const runs = body.split(/[., ]/);
  const separators = body.replace(/[0-9]/g, '').split('');
  // Two separators in a row, or one at an edge other than a decimal: not a number.
  if (runs.slice(1, -1).some(run => run === '')) return { ok: false, reason: 'invalid' };
  const kinds = new Set(separators);
  let decimalAt = -1; // index into `separators` of the decimal separator, or -1
  if (kinds.size > 2) return { ok: false, reason: 'invalid' };
  if (kinds.size === 2) {
    const last = separators[separators.length - 1];
    if (last === ' ' || separators.filter(char => char === last).length !== 1) return { ok: false, reason: 'invalid' };
    decimalAt = separators.length - 1;
  } else if (kinds.size === 1 && separators[0] !== ' ' && separators.length === 1) {
    const [before, after] = runs;
    const couldGroup = after.length === 3 && before.length >= 1 && before.length <= 3 && !before.startsWith('0');
    if (!couldGroup) decimalAt = 0;
    // Three digits after the region's group separator are a thousand, unless the currency itself has three decimals.
    else if (separators[0] !== format.group || precision.decimals >= 3) return { ok: false, reason: 'ambiguous' };
  }
  const groups = decimalAt < 0 ? runs : runs.slice(0, decimalAt + 1);
  if (groups.length > 1 && !wellGrouped(groups)) return { ok: false, reason: 'invalid' };
  const whole = groups.join('').replace(/^0+(?=\d)/, '');
  let fraction = decimalAt < 0 ? null : runs[decimalAt + 1];
  if (fraction !== null && fraction.length > precision.decimals) {
    if (!/^0+$/.test(fraction.slice(precision.decimals))) return { ok: false, reason: 'precision' };
    fraction = precision.decimals === 0 ? null : fraction.slice(0, precision.decimals);
  }
  if (whole.length > precision.wholeDigits) return { ok: false, reason: 'tooLong' };
  return { ok: true, negative, canonical: (negative ? '-' : '') + whole + (fraction === null ? '' : ',' + fraction) };
}

// ---- Reading a native change ------------------------------------------------

const count = (text: string, char: string) => char ? text.split(char).length - 1 : 0;
const isSeparator = (char: string) => char === '.' || char === ',';

/** Common prefix and suffix of two strings: where an edit happened. */
function edit(before: string, after: string): { a: number; b: number } {
  let a = 0;
  while (a < before.length && a < after.length && before[a] === after[a]) a++;
  let b = 0;
  while (b < before.length - a && b < after.length - a && before[before.length - 1 - b] === after[after.length - 1 - b]) b++;
  return { a, b };
}

/** A text the native view may hold and the index of the character that is
 * its decimal separator (-1 when it has none). For the last render that is
 * the format's decimal separator; for a raw text still on screen it is the
 * character the previous read took as the decimal, which may be the other
 * separator (the device's decimal key). */
export interface RawText { text: string; decimalAt: number }

export interface AmountRead {
  state: AmountEdit;
  /** A paste that was not put in the field, and why. */
  rejected: AmountNotice | null;
  /** The raw text as read, for the next change while the native view still holds it; null when it must not be trusted. */
  raw: RawText | null;
}

/** Canonical characters of `text[from, to)`: the decimal separator at `decimalAt` as a comma, digits, a sign at the very start. */
function canonicalSlice(text: string, from: number, to: number, decimalAt: number): string {
  let out = '';
  for (let index = from; index < to; index++) {
    const char = text[index];
    if (index === decimalAt) out += ',';
    else if (/[0-9]/.test(char)) out += char;
    else if (index === 0 && (char === '-' || char === '−')) out += '-';
  }
  return out;
}

/** Where a reference's decimal separator is after the edit, or -1 when the edit removed it. */
function carried(reference: RawText, raw: string, a: number, b: number): number {
  const at = reference.decimalAt;
  if (at < 0) return -1;
  if (at < a) return at;
  if (at >= reference.text.length - b) return at + raw.length - reference.text.length;
  return -1;
}

/** A paste: the inserted text read on its own, then put between the canonical
 * text before and after it. Refused as a whole (the field keeps its previous
 * state) when the text is not an unambiguous amount, or when it would give the
 * field a second sign, a second decimal separator, a third decimal or a
 * fourteenth whole digit. */
function readPastedChange(raw: string, a: number, b: number, decimalAt: number, format: AmountFormat, previous: AmountEdit,
  precision: AmountPrecision, currency: Currency): AmountRead {
  const inserted = raw.slice(a, raw.length - b);
  const refuse = (reason: PasteRejection): AmountRead => ({ state: previous, rejected: { reason, text: inserted.trim() }, raw: null });
  const pasted = readPaste(inserted, format, precision, currency);
  if (!pasted.ok) return refuse(pasted.reason);
  const before = canonicalSlice(raw, 0, a, decimalAt), after = canonicalSlice(raw, raw.length - b, raw.length, decimalAt);
  if (pasted.negative && before !== '') return refuse('invalid');
  const combined = before + pasted.canonical + after;
  if (count(combined, ',') > 1) return refuse('invalid');
  if (combined.includes(',') && combined.length - combined.indexOf(',') - 1 > precision.decimals) return refuse('precision');
  const state = readCanonical(combined, before.length + pasted.canonical.length, precision);
  if (!state) return refuse('tooLong');
  // The pasted decimal separator, when there is one, is the last "." or "," it contains.
  const own = pasted.canonical.includes(',') ? a + Math.max(inserted.lastIndexOf('.'), inserted.lastIndexOf(',')) : -1;
  return { state, rejected: null, raw: { text: raw, decimalAt: own >= 0 ? own : decimalAt } };
}

/** The state after the native field changed to `raw`, with the native caret
 * at `rawCaret` when known. `shown` is the display last rendered in `format`;
 * `previousRaw` the raw text of the previous change, which the native view
 * still holds while the controlled update has not landed (it is ignored when
 * null). The edit is measured against whichever of the two explains it with
 * the smallest insertion, so a keystroke typed faster than the render still
 * reads as one keystroke.
 *
 * Digits are the truth. The reference's decimal separator stays the decimal
 * separator wherever the edit moved it; group separators are dropped. One
 * typed separator, of either kind, is the decimal separator (the iOS decimal
 * pad shows the device's, which may not be the region's); a second one is
 * dropped. Backspace over a group separator removes the digit before it. An
 * edit that would need a fourteenth whole digit is refused: the previous state
 * comes back so the field can be restored; a third decimal simply does not
 * appear. An insertion of more than one character with separators or other
 * characters is a paste (readPaste), refused with a reason rather than
 * guessed when it is ambiguous. */
export function readAmountInput(shown: AmountView, raw: string, rawCaret: number | null, format: AmountFormat,
  previousRaw: RawText | null, currency: Currency): AmountRead {
  return readChange(shown, raw, rawCaret, format, previousRaw, precisionOf(currency), currency);
}
function readChange(shown: AmountView, raw: string, rawCaret: number | null, format: AmountFormat,
  previousRaw: RawText | null, precision: AmountPrecision, currency: Currency): AmountRead {
  raw = latinDigits(raw);
  const previous = viewState(shown, format, precision);
  const references: RawText[] = [{ text: shown.text, decimalAt: shown.text.indexOf(format.decimal) }];
  if (previousRaw && previousRaw.text !== shown.text) references.push(previousRaw);
  let best: { reference: RawText; a: number; b: number; inserted: string } | null = null;
  for (const reference of references) {
    const { a, b } = edit(reference.text, raw);
    const inserted = raw.slice(a, raw.length - b);
    if (!best || inserted.length < best.inserted.length) best = { reference, a, b, inserted };
  }
  const { reference, a, b, inserted } = best!;
  let decimalAt = carried(reference, raw, a, b);
  if (inserted.length > 1 && /[^0-9]/.test(inserted)) return readPastedChange(raw, a, b, decimalAt, format, previous, precision, currency);
  let text = raw;
  let caret = rawCaret ?? raw.length;
  const deleted = reference.text.slice(a, reference.text.length - b);
  let rawDecimalAt = decimalAt;
  if (inserted === '' && deleted === format.group && reference.decimalAt !== a && /[0-9]/.test(reference.text[a - 1] ?? '')) {
    // Backspace over a group separator: the user meant the digit before it.
    text = reference.text.slice(0, a - 1) + reference.text.slice(a + 1);
    caret = a - 1;
    decimalAt = reference.decimalAt > a ? reference.decimalAt - 2 : reference.decimalAt;
  } else if (inserted.length === 1 && isSeparator(inserted)) {
    // One typed separator: the one just before the caret when the caret says so (two equal characters side by side).
    const typed = caret > 0 && raw[caret - 1] === inserted && caret - 1 !== decimalAt ? caret - 1 : a;
    if (decimalAt < 0) { decimalAt = typed; rawDecimalAt = typed; }
    else {
      // A second decimal separator is not a new decimal point: the one just typed is dropped and the caret steps back over it.
      text = raw.slice(0, typed) + raw.slice(typed + 1);
      if (caret > typed) caret--;
      if (decimalAt > typed) decimalAt--;
    }
  }
  const state = readCanonical(canonicalSlice(text, 0, text.length, decimalAt), canonicalSlice(text, 0, caret, decimalAt).length, precision);
  if (state) return { state, rejected: null, raw: { text: raw, decimalAt: rawDecimalAt } };
  // Past the last whole digit the currency allows: one keystroke is silently refused, a pasted number says why.
  return { state: previous, rejected: inserted.length > 1 ? { reason: 'tooLong', text: inserted } : null, raw: null };
}

/** When editing ends: no dangling decimal separator, started decimals
 * completed to the currency's ("2.000,5" → "2.000,50" in pesos, "1,2" → "1,200" in
 * dinars), a lone sign dropped. A whole amount stays whole. A fraction longer than the
 * currency's (a draft kept across a currency change) is left as it is: never truncated. */
export function settleAmount(state: AmountEdit, currency: Currency): AmountEdit {
  const { decimals } = precisionOf(currency);
  const settled: AmountEdit = { ...state };
  if (settled.decimal && settled.fraction === '') settled.decimal = false;
  else if (settled.decimal && settled.fraction.length < decimals) settled.fraction = settled.fraction.padEnd(decimals, '0');
  if (settled.whole === '' && !settled.decimal) settled.negative = false;
  settled.caret = canonicalAmount(settled).length;
  return settled;
}

/** The same field in another region: the value and the logical caret are
 * kept, only the separators (and so the display caret) change. */
export function reformatAmount(view: AmountView, from: AmountFormat, to: AmountFormat, currency: Currency): AmountView {
  return renderAmount(amountFromView(view, from, currency), to);
}

/** Whether two formats write every amount alike: the separators and the grouping. */
export function sameAmountFormat(a: AmountFormat, b: AmountFormat): boolean {
  return a.decimal === b.decimal && a.group === b.group && (a.secondaryGrouping ?? 3) === (b.secondaryGrouping ?? 3)
    && (a.minimumGroupingDigits ?? 1) === (b.minimumGroupingDigits ?? 1);
}

// ---- Drafts (ledger notation) -----------------------------------------------

/** A draft in the ledger's notation as a state, caret at the end, read with the
 * currency's precision (a draft that does not fit is read as far as it fits; the form
 * keeps the draft string itself and refuses to save it, `draftFitsCurrency`). */
export function amountFromDraft(draft: string, currency: Currency): AmountEdit {
  return readDraft(draft, precisionOf(currency));
}
function readDraft(draft: string, precision: AmountPrecision): AmountEdit {
  const canonical = canonicalText(draft, LEDGER_FORMAT);
  return readCanonical(canonical, canonical.length, precision) ?? EMPTY_AMOUNT;
}

/** The draft a form keeps for a state: the ledger's notation ("-1.234,5"), whatever the region. */
export function draftFromAmount(state: AmountEdit): string {
  return renderAmount(state, LEDGER_FORMAT).text;
}

/** A draft as the field displays it in `format` ("1.234,5" → "1,234.5" in the United
 * States). A draft with more decimals than the currency has is shown whole, never cut:
 * the person sees exactly what they typed while the form says it cannot be saved as is. */
export function displayAmount(draft: string, format: AmountFormat, currency: Currency): string {
  return renderAmount(readDraft(draft, keeping(draft, currency)), format).text;
}

/** The currency's precision widened to what a draft already holds, so reading it back
 * never drops a digit: the form, not the model, decides that such a draft cannot be saved. */
function keeping(draft: string, currency: Currency): AmountPrecision {
  const base = precisionOf(currency);
  const canonical = canonicalText(draft, LEDGER_FORMAT).replace(/^-/, '');
  const at = canonical.indexOf(',');
  const whole = (at < 0 ? canonical : canonical.slice(0, at)).replace(/[^0-9]/g, '').replace(/^0+(?=\d)/, '');
  const fraction = at < 0 ? '' : canonical.slice(at + 1).replace(/[^0-9]/g, '');
  return { decimals: Math.max(base.decimals, fraction.length), wholeDigits: Math.max(base.wholeDigits, whole.length) };
}

/** A stored amount as a form draft ("123456" minor → "1.234,56" in pesos, "1500" → "1.500"
 * in yen, "1234567" → "1.234,567" in dinars), for prefilling an edit form. The currency's
 * exponent decides where the decimal mark goes; a wrong currency would misplace it by 10×
 * or 100×, which is why it is a required parameter. */
export function draftFromMinor(minor: number, currency: Currency): string {
  if (!Number.isSafeInteger(minor)) return '';
  const { negative, whole, fraction } = splitMinor(minor, currency);
  return draftFromAmount({ negative, whole, decimal: fraction.length > 0, fraction, caret: 0 });
}

/** A formatted amount ("−US$ 1.234,56", "$ 1,234.56") in the three parts a
 * hero colours differently, with the format's decimal separator. They always
 * concatenate back to the same string. */
export function splitAmount(text: string, format: AmountFormat = LEDGER_FORMAT): { prefix: string; whole: string; decimals: string } {
  const prefix = /^[^0-9]*/.exec(text)![0];
  const rest = text.slice(prefix.length);
  const at = rest.indexOf(format.decimal);
  const whole = at < 0 ? rest : rest.slice(0, at), decimals = at < 0 ? '' : rest.slice(at);
  if (!/^[0-9]*$/.test(canonicalText(whole, format)) || !/^[0-9]*$/.test(decimals.slice(format.decimal.length))) return { prefix: '', whole: text, decimals: '' };
  return { prefix, whole, decimals };
}

/** Integer minor units as the field would hold them after the user typed the
 * amount, as a draft: "19016200" → "190.162", "19016250" → "190.162,50",
 * "5" → "0,05" in pesos; "1500" → "1.500" in yen; "1234500" → "1.234,500" in
 * dinars. Whole amounts stay whole (no ",00"), so a shortcut fills the field the
 * way a person would have typed it. Negative or unsafe values give an empty
 * field: a shortcut never proposes a negative or fabricated amount. */
export function amountFromMinor(minor: number, currency: Currency): string {
  if (!Number.isSafeInteger(minor) || minor <= 0) return '';
  // Digits only, split by the currency's exponent: no number is computed from them.
  const { whole, fraction } = splitMinor(minor, currency);
  return displayAmount(whole + (/^0*$/.test(fraction) ? '' : ',' + fraction), LEDGER_FORMAT, currency);
}

// ---- The field's controller -------------------------------------------------

/** Everything AmountField does with the text, without React: the state, the
 * rendered view, the region's format and the raw text the native view may
 * still hold. The component keeps one instance per field and only forwards
 * native events, so the tests drive exactly what runs on the iPhone.
 *   - `change` reads a native change and returns the view to show, the draft
 *     for the form (ledger notation) and a refused paste, if any;
 *   - `select` records a caret the person placed;
 *   - `settle` completes the decimals when editing ends;
 *   - `adopt` takes a draft the form set itself (a prefill, a shortcut, a reset);
 *   - `reformat` rewrites the field for another region: same value, same
 *     logical caret, same draft. */
export class AmountInput {
  format: AmountFormat;
  currency: Currency;
  state: AmountEdit;
  view: AmountView;
  private raw: RawText | null = null;

  constructor(draft: string, format: AmountFormat, currency: Currency) {
    this.format = format;
    this.currency = currency;
    this.state = readDraft(draft, keeping(draft, currency));
    this.view = renderAmount(this.state, format);
  }

  get draft(): string { return draftFromAmount(this.state); }

  /** The currency's precision, widened to whatever the field already holds: a draft kept
   * across a currency change is never truncated by the model (the form refuses to save
   * it instead), and it can only shrink from there, never grow past the currency's digits. */
  private precision(): AmountPrecision {
    const base = precisionOf(this.currency);
    return { decimals: Math.max(base.decimals, this.state.fraction.length), wholeDigits: Math.max(base.wholeDigits, this.state.whole.length) };
  }

  private show(state: AmountEdit): AmountView {
    this.state = state;
    this.view = renderAmount(state, this.format);
    return this.view;
  }

  change(raw: string, rawCaret: number | null): { view: AmountView; draft: string; rejected: AmountNotice | null } {
    const read = readChange(this.view, raw, rawCaret, this.format, this.raw, this.precision(), this.currency);
    this.raw = read.raw;
    return { view: this.show(read.state), draft: this.draft, rejected: read.rejected };
  }

  /** A caret the person placed, in display coordinates. False when the event describes text the field no longer shows. */
  select(caret: number, text?: string): boolean {
    if (text !== undefined && text !== this.view.text) return false;
    this.view = { ...this.view, caret };
    this.state = { ...this.state, caret: logicalCaret(this.view.text, caret, this.format) };
    return true;
  }

  settle(): { view: AmountView; draft: string } {
    this.raw = null;
    return { view: this.show(settleAmount(this.state, this.currency)), draft: this.draft };
  }

  adopt(draft: string): AmountView {
    this.raw = null;
    return this.show(readDraft(draft, keeping(draft, this.currency)));
  }

  /** The field now belongs to another currency (the account or the currency choice changed):
   * the digits, the draft and the caret stay exactly as they are (ARS ↔ USD changes nothing at
   * all); only the precision of the next keystroke, paste or settle changes. Whether the kept
   * draft can be saved in the new currency is the form's question (`draftFitsCurrency`). */
  retarget(currency: Currency): AmountView {
    if (currency === this.currency) return this.view;
    this.currency = currency;
    this.raw = null;
    return this.view;
  }

  reformat(format: AmountFormat): AmountView {
    if (sameAmountFormat(format, this.format)) return this.view;
    this.format = format;
    this.raw = null;
    return this.show(this.state);
  }
}
