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

const MAX_WHOLE_DIGITS = 13; // 9.999.999.999.999,99 stays a safe integer in minor units.
const MAX_DECIMALS = 2;

/** The two separators an amount is written with. */
export interface AmountFormat { decimal: string; group: string }

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

/** Groups whole digits by thousands with the format's separator. */
function group(whole: string, format: AmountFormat): string {
  return whole.replace(/\B(?=(\d{3})+(?!\d))/g, format.group);
}

/** Number of group separators the display puts before the k-th whole digit. */
function groupsBefore(wholeLength: number, digitsBefore: number): number {
  let groups = 0;
  for (let index = 1; index < digitsBefore; index++) if ((wholeLength - index) % 3 === 0) groups++;
  return groups;
}

/** Where a logical caret lands in the display string. A caret right before a
 * group separator stays before it, so typing continues after the digit. */
export function displayCaret(state: AmountEdit, logical: number, format: AmountFormat = LEDGER_FORMAT): number {
  const sign = state.negative ? 1 : 0;
  const caret = Math.max(0, Math.min(logical, canonicalAmount(state).length));
  if (caret <= sign) return caret;
  const digitsBefore = Math.min(caret - sign, state.whole.length);
  const inWhole = sign + digitsBefore + groupsBefore(state.whole.length, digitsBefore) * format.group.length;
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
 * are removed and the fraction keeps its first two digits (a third decimal
 * typed at the end simply does not appear). More than thirteen whole digits
 * gives `null`, so a caller can refuse that edit instead of changing the
 * number. */
export function amountFromCanonical(text: string, caret: number = text.length): AmountEdit | null {
  const negative = /^\s*[-−]/.test(text);
  const body = text.replace(/^\s*[-−]\s*/, '');
  const position = Math.max(0, caret - (text.length - body.length));
  let whole = '', fraction = '', decimal = false, logical = 0;
  let zeroAt = -1; // index of a lone leading zero still standing in `whole`
  for (let index = 0; index < body.length; index++) {
    const char = body[index];
    let kept = false;
    if (char === ',' && !decimal) { decimal = true; kept = true; }
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
  if (whole.length > MAX_WHOLE_DIGITS) return null;
  const state: AmountEdit = { negative, whole, decimal, fraction: fraction.slice(0, MAX_DECIMALS), caret: 0 };
  state.caret = Math.max(0, Math.min((negative ? 1 : 0) + logical, canonicalAmount(state).length));
  return state;
}

/** The state a displayed field holds: its text read in `format`, its caret made logical. */
export function amountFromView(view: AmountView, format: AmountFormat = LEDGER_FORMAT): AmountEdit {
  return amountFromCanonical(canonicalText(view.text, format), logicalCaret(view.text, view.caret, format)) ?? EMPTY_AMOUNT;
}

// ---- Pasted text ------------------------------------------------------------

/** Why a pasted text was not put in the field. Nothing is ever guessed:
 *   - `ambiguous`: one separator before exactly three digits, and it is not the
 *     region's group separator ("1,000" in Argentina, "1.000" in the United
 *     States): a thousand in one convention, one with three decimals in the other;
 *   - `precision`: more than two decimals that are not trailing zeros ("12.345,678");
 *   - `invalid`: not an amount ("abc", "1.000.5", "12 34", a second sign or a
 *     second decimal separator once it lands in the field);
 *   - `tooLong`: more than thirteen whole digits. */
export type PasteRejection = 'ambiguous' | 'precision' | 'invalid' | 'tooLong';
export interface AmountNotice { reason: PasteRejection; text: string }

type PastedAmount = { ok: true; negative: boolean; canonical: string } | { ok: false; reason: PasteRejection };

// Currency marks around a copied amount; the account, not the text, decides the currency.
const CURRENCY_MARKS = /U\$S|US\$|AR\$|\$|\bARS\b|\bUSD\b/gi;
// \s covers the no-break and thin spaces other apps group thousands with.
const SPACES = /\s+/g;

/** A pasted text as a canonical amount ("-1234,5"), read by the separators the
 * text itself uses:
 *   - both "." and "," present: the last one is the decimal separator and the
 *     other one must group thousands correctly ("1.234,56", "1,234.56", in any region);
 *   - one kind, repeated: it groups thousands ("1.234.567", "1,234,567");
 *   - one separator followed by one or two digits (or none): decimals ("12,5", "12.50");
 *   - one separator followed by exactly three digits: a thousand when it is the
 *     region's group separator ("1.000" in Argentina), otherwise ambiguous;
 *   - spaces may group thousands ("1 234,56"); "$", "US$", "AR$", "U$S", "ARS"
 *     and "USD" are ignored, a leading minus is kept.
 * Decimals beyond the second must be zeros. Only the digits are kept: no
 * number is ever computed from the text. */
export function readPastedAmount(text: string, format: AmountFormat = LEDGER_FORMAT): PastedAmount {
  let body = text.replace(CURRENCY_MARKS, ' ').replace(SPACES, ' ').trim();
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
    else if (separators[0] !== format.group) return { ok: false, reason: 'ambiguous' };
  }
  const groups = decimalAt < 0 ? runs : runs.slice(0, decimalAt + 1);
  if (groups.length > 1 && (groups[0].length < 1 || groups[0].length > 3 || groups[0].startsWith('0') || groups.slice(1).some(run => run.length !== 3))) {
    return { ok: false, reason: 'invalid' };
  }
  const whole = groups.join('').replace(/^0+(?=\d)/, '');
  let fraction = decimalAt < 0 ? null : runs[decimalAt + 1];
  if (fraction !== null && fraction.length > MAX_DECIMALS) {
    if (!/^0+$/.test(fraction.slice(MAX_DECIMALS))) return { ok: false, reason: 'precision' };
    fraction = fraction.slice(0, MAX_DECIMALS);
  }
  if (whole.length > MAX_WHOLE_DIGITS) return { ok: false, reason: 'tooLong' };
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
function readPaste(raw: string, a: number, b: number, decimalAt: number, format: AmountFormat, previous: AmountEdit): AmountRead {
  const inserted = raw.slice(a, raw.length - b);
  const refuse = (reason: PasteRejection): AmountRead => ({ state: previous, rejected: { reason, text: inserted.trim() }, raw: null });
  const pasted = readPastedAmount(inserted, format);
  if (!pasted.ok) return refuse(pasted.reason);
  const before = canonicalSlice(raw, 0, a, decimalAt), after = canonicalSlice(raw, raw.length - b, raw.length, decimalAt);
  if (pasted.negative && before !== '') return refuse('invalid');
  const combined = before + pasted.canonical + after;
  if (count(combined, ',') > 1) return refuse('invalid');
  if (combined.includes(',') && combined.length - combined.indexOf(',') - 1 > MAX_DECIMALS) return refuse('precision');
  const state = amountFromCanonical(combined, before.length + pasted.canonical.length);
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
export function readAmountInput(shown: AmountView, raw: string, rawCaret: number | null, format: AmountFormat = LEDGER_FORMAT,
  previousRaw: RawText | null = null): AmountRead {
  const previous = amountFromView(shown, format);
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
  if (inserted.length > 1 && /[^0-9]/.test(inserted)) return readPaste(raw, a, b, decimalAt, format, previous);
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
  const state = amountFromCanonical(canonicalSlice(text, 0, text.length, decimalAt), canonicalSlice(text, 0, caret, decimalAt).length);
  if (state) return { state, rejected: null, raw: { text: raw, decimalAt: rawDecimalAt } };
  // Past the thirteenth whole digit: one keystroke is silently refused, a pasted number says why.
  return { state: previous, rejected: inserted.length > 1 ? { reason: 'tooLong', text: inserted } : null, raw: null };
}

/** When editing ends: no dangling decimal separator, started decimals
 * completed ("2.000,5" → "2.000,50"), a lone sign dropped. A whole amount stays whole. */
export function settleAmount(state: AmountEdit): AmountEdit {
  const settled: AmountEdit = { ...state };
  if (settled.decimal && settled.fraction === '') settled.decimal = false;
  else if (settled.decimal) settled.fraction = settled.fraction.padEnd(MAX_DECIMALS, '0');
  if (settled.whole === '' && !settled.decimal) settled.negative = false;
  settled.caret = canonicalAmount(settled).length;
  return settled;
}

/** The same field in another region: the value and the logical caret are
 * kept, only the separators (and so the display caret) change. */
export function reformatAmount(view: AmountView, from: AmountFormat, to: AmountFormat): AmountView {
  return renderAmount(amountFromView(view, from), to);
}

// ---- Drafts (ledger notation) -----------------------------------------------

/** A draft in the ledger's notation as a state, caret at the end. */
export function amountFromDraft(draft: string): AmountEdit {
  return amountFromCanonical(canonicalText(draft, LEDGER_FORMAT)) ?? EMPTY_AMOUNT;
}

/** The draft a form keeps for a state: the ledger's notation ("-1.234,5"), whatever the region. */
export function draftFromAmount(state: AmountEdit): string {
  return renderAmount(state, LEDGER_FORMAT).text;
}

/** A draft as the field displays it in `format` ("1.234,5" → "1,234.5" in the United States). */
export function displayAmount(draft: string, format: AmountFormat = LEDGER_FORMAT): string {
  return renderAmount(amountFromDraft(draft), format).text;
}

/** A stored amount as a form draft ("123456" minor → "1.234,56"), for prefilling an edit form. */
export function draftFromMinor(minor: number): string {
  if (!Number.isSafeInteger(minor)) return '';
  const digits = String(Math.abs(minor)).padStart(3, '0');
  return draftFromAmount({ negative: minor < 0, whole: digits.slice(0, -2), decimal: true, fraction: digits.slice(-2), caret: 0 });
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
 * "5" → "0,05". Whole amounts stay whole (no ",00"), so a shortcut fills the
 * field the way a person would have typed it. Negative or unsafe values give
 * an empty field: a shortcut never proposes a negative or fabricated amount. */
export function amountFromMinor(minor: number): string {
  if (!Number.isSafeInteger(minor) || minor <= 0) return '';
  // Digits only: the last two are the cents, the rest the whole units.
  const digits = String(minor).padStart(3, '0');
  const whole = digits.slice(0, -2), cents = digits.slice(-2);
  return displayAmount(whole + (cents === '00' ? '' : ',' + cents));
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
  state: AmountEdit;
  view: AmountView;
  private raw: RawText | null = null;

  constructor(draft: string, format: AmountFormat) {
    this.format = format;
    this.state = amountFromDraft(draft);
    this.view = renderAmount(this.state, format);
  }

  get draft(): string { return draftFromAmount(this.state); }

  private show(state: AmountEdit): AmountView {
    this.state = state;
    this.view = renderAmount(state, this.format);
    return this.view;
  }

  change(raw: string, rawCaret: number | null): { view: AmountView; draft: string; rejected: AmountNotice | null } {
    const read = readAmountInput(this.view, raw, rawCaret, this.format, this.raw);
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
    return { view: this.show(settleAmount(this.state)), draft: this.draft };
  }

  adopt(draft: string): AmountView {
    this.raw = null;
    return this.show(amountFromDraft(draft));
  }

  reformat(format: AmountFormat): AmountView {
    if (format.decimal === this.format.decimal && format.group === this.format.group) return this.view;
    this.format = format;
    this.raw = null;
    return this.show(this.state);
  }
}
