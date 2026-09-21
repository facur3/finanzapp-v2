/** Argentine amount entry as a canonical edit state.
 *
 * The field shows "2.000.000,50" while the user types: dots group thousands,
 * one comma starts up to two decimals. Everything here is presentation: the
 * form still hands the display string to the domain's parseMinorUnits, which
 * returns integer minor units, and no floating-point number exists on the path.
 *
 * The model is a canonical state, never the display string:
 *
 *   sign · whole digits · optional decimal comma · decimal digits · caret
 *
 * where the caret is a logical index into the canonical string ("-1234,5"),
 * one that grouping cannot move. The display string and the display caret are
 * derived from that state (renderAmount). Each native change is read back into
 * the state (readAmountChange) from the digits and commas the native text
 * contains, so a dot that FinanzApp inserted itself is never mistaken for a
 * decimal separator, even when the native text lags behind the last render.
 * A period counts as a decimal separator only when it is explicit input: one
 * more dot than the screen had, or a pasted number whose own separators say
 * so. */

const MAX_WHOLE_DIGITS = 13; // 9.999.999.999.999,99 stays a safe integer in minor units.
const MAX_DECIMALS = 2;

export interface AmountEdit {
  negative: boolean;
  /** Whole digits with no leading zeros ("" for an empty field, "0" before a comma). */
  whole: string;
  /** Whether the decimal comma has been entered. */
  decimal: boolean;
  fraction: string;
  /** Logical caret: an index into canonicalAmount(state). */
  caret: number;
}

export const EMPTY_AMOUNT: AmountEdit = { negative: false, whole: '', decimal: false, fraction: '', caret: 0 };

/** "-1234,5": the state as digits, at most one comma and an optional sign. */
export function canonicalAmount(state: AmountEdit): string {
  return (state.negative ? '-' : '') + state.whole + (state.decimal ? ',' + state.fraction : '');
}

/** Groups whole digits by thousands with dots. */
function group(whole: string): string {
  return whole.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** Number of grouping dots the display puts before the k-th whole digit. */
function dotsBefore(wholeLength: number, digitsBefore: number): number {
  let dots = 0;
  for (let index = 1; index < digitsBefore; index++) if ((wholeLength - index) % 3 === 0) dots++;
  return dots;
}

/** Where a logical caret lands in the display string. A caret right before a
 * grouping dot stays before it, so typing continues after the digit. */
export function displayCaret(state: AmountEdit, logical: number): number {
  const sign = state.negative ? 1 : 0;
  const caret = Math.max(0, Math.min(logical, canonicalAmount(state).length));
  if (caret <= sign) return caret;
  const digitsBefore = Math.min(caret - sign, state.whole.length);
  const inWhole = sign + digitsBefore + dotsBefore(state.whole.length, digitsBefore);
  if (caret - sign <= state.whole.length) return inWhole;
  // Past the whole: the comma and the fraction have no grouping.
  return sign + group(state.whole).length + (caret - sign - state.whole.length);
}

/** The display string and where the caret sits in it. */
export function renderAmount(state: AmountEdit): { text: string; caret: number } {
  const text = (state.negative ? '-' : '') + group(state.whole) + (state.decimal ? ',' + state.fraction : '');
  return { text, caret: displayCaret(state, state.caret) };
}

/** The logical position of a display index: display characters minus the grouping dots before it. */
export function logicalCaret(display: string, index: number): number {
  const clamped = Math.max(0, Math.min(index, display.length));
  return clamped - (display.slice(0, clamped).match(/\./g)?.length ?? 0);
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

/** Digits with a comma as the only separator, read from pasted text by the
 * separators that text itself uses: "2,000,000.50" and "2.000.000,50" both
 * mean the same amount; a lone dot before three digits is a group, any other
 * dot is a decimal separator. */
function normalizePaste(text: string): string {
  const clean = text.replace(/[^0-9.,]/g, '');
  const lastComma = clean.lastIndexOf(',');
  const lastDot = clean.lastIndexOf('.');
  if (lastComma >= 0 && lastDot >= 0) {
    const decimalAt = Math.max(lastComma, lastDot);
    return clean.slice(0, decimalAt).replace(/[.,]/g, '') + ',' + clean.slice(decimalAt + 1).replace(/[.,]/g, '');
  }
  if (lastComma >= 0) return clean.slice(0, lastComma).replace(/,/g, '') + ',' + clean.slice(lastComma + 1);
  if (lastDot >= 0) {
    const groups = clean.split('.');
    if (groups.slice(1).every(part => part.length === 3)) return groups.join('');
    return clean.slice(0, lastDot).replace(/\./g, '') + ',' + clean.slice(lastDot + 1).replace(/\./g, '');
  }
  return clean;
}

const count = (text: string, char: string) => text.split(char).length - 1;

/** Common prefix and suffix of two strings: where an edit happened. */
function edit(before: string, after: string): { a: number; b: number } {
  let a = 0;
  while (a < before.length && a < after.length && before[a] === after[a]) a++;
  let b = 0;
  while (b < before.length - a && b < after.length - a && before[before.length - 1 - b] === after[after.length - 1 - b]) b++;
  return { a, b };
}

/** The state after the native field changed from `shown` (the display last
 * rendered) to `raw`, with the native caret at `rawCaret` when known.
 *
 * Digits and the comma in `raw` are the truth; dots are grouping unless they
 * are explicit input. Backspace over a grouping dot removes the digit before
 * it. A second comma is dropped. An edit that would need a fourteenth whole
 * digit is refused: the previous state comes back so the field can be
 * restored; a third decimal simply does not appear. */
export function readAmountChange(shown: { text: string; caret: number }, raw: string, rawCaret: number | null): AmountEdit {
  const previous = amountFromCanonical(shown.text.replace(/\./g, ''), logicalCaret(shown.text, shown.caret)) ?? EMPTY_AMOUNT;
  let text = raw;
  let caret = rawCaret ?? raw.length;
  // Backspace over a grouping dot: the user meant the digit before it.
  if (raw.length === shown.text.length - 1) {
    const { a } = edit(shown.text, raw);
    if (shown.text[a] === '.' && shown.text.slice(0, a) + shown.text.slice(a + 1) === raw && /[0-9]/.test(shown.text[a - 1] ?? '')) {
      text = shown.text.slice(0, a - 1) + shown.text.slice(a + 1);
      caret = a - 1;
    }
  }
  // The sign is read first so that neither dot rule sees it.
  const negative = /^\s*[-−]/.test(text);
  const signLength = text.length - text.replace(/^\s*[-−]\s*/, '').length;
  text = text.slice(signLength);
  caret = Math.max(0, caret - signLength);
  const shownBody = shown.text.replace(/^-/, '');
  const extraDots = count(text, '.') - count(shownBody, '.');
  if (extraDots === 1 && text.length === shownBody.length + 1) {
    // One typed period: the one under the caret, otherwise the last one. It is a decimal comma.
    const at = caret > 0 && text[caret - 1] === '.' ? caret - 1 : text.lastIndexOf('.');
    text = text.slice(0, at) + ',' + text.slice(at + 1);
  } else if (extraDots > 0) {
    // Pasted text with its own separators: normalise only the inserted part.
    const { a, b } = edit(shownBody, text);
    const inserted = normalizePaste(text.slice(a, text.length - b));
    const afterInsert = caret > a;
    text = text.slice(0, a) + inserted + text.slice(text.length - b);
    if (afterInsert) caret = Math.min(caret, a + inserted.length);
  }
  // A second comma is not a new decimal point: the one just typed is dropped and the caret steps back over it.
  if (count(text, ',') > 1) {
    const typed = caret > 0 && text[caret - 1] === ',' ? caret - 1 : text.lastIndexOf(',');
    text = text.slice(0, typed) + text.slice(typed + 1);
    if (caret > typed) caret--;
  }
  const sign = negative ? '-' : '';
  return amountFromCanonical(sign + text.replace(/\./g, ''), sign.length + logicalCaret(text, caret)) ?? previous;
}

/** When editing ends: no dangling comma, started decimals completed
 * ("2.000,5" → "2.000,50"), a lone sign dropped. A whole amount stays whole. */
export function settleAmount(state: AmountEdit): AmountEdit {
  const settled: AmountEdit = { ...state };
  if (settled.decimal && settled.fraction === '') settled.decimal = false;
  else if (settled.decimal) settled.fraction = settled.fraction.padEnd(MAX_DECIMALS, '0');
  if (settled.whole === '' && !settled.decimal) settled.negative = false;
  settled.caret = canonicalAmount(settled).length;
  return settled;
}

/** A stored or typed string as the field displays it ("-1.234,56" stays
 * "-1.234,56"); used to prefill a form from formatMinorUnits. */
export function displayAmount(text: string): string {
  return renderAmount(amountFromCanonical(text.replace(/\./g, '')) ?? EMPTY_AMOUNT).text;
}

/** A formatted amount ("−US$ 1.234,56") in the three parts a hero colours
 * differently. They always concatenate back to the same string. */
export function splitAmount(text: string): { prefix: string; whole: string; decimals: string } {
  const match = /^([^0-9]*)([0-9.]*)(,[0-9]*)?$/.exec(text);
  if (!match) return { prefix: '', whole: text, decimals: '' };
  return { prefix: match[1], whole: match[2], decimals: match[3] ?? '' };
}
