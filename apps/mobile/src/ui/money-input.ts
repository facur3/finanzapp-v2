/** Argentine display formatting for the amount field, as pure string edits.
 *
 * The field shows "2.000.000,50" while the user types: dots group thousands,
 * one comma starts up to two decimals. This module only produces that display
 * string. The form still hands it to the domain's parseMinorUnits, which
 * returns integer minor units, so presentation never touches the value and no
 * floating-point number exists anywhere on the path.
 *
 * A formatted field cannot be re-parsed from its text alone: after "12.345"
 * loses its "5", the "12.34" that remains looks like a decimal. So each change
 * is read as an edit of the previous display (common prefix and suffix locate
 * it), and only the inserted text is interpreted. Grouping dots are never part
 * of what the user typed, so a dot in the inserted text is a decimal
 * separator, unless the inserted text is a whole pasted number whose dots all
 * sit before three-digit groups. */

const MAX_WHOLE_DIGITS = 13; // 9.999.999.999.999,99 stays a safe integer in minor units.
const MAX_DECIMALS = 2;

/** The display without its grouping dots: digits and at most one comma. */
function canonical(display: string): string {
  return display.replace(/\./g, '');
}

/** Digits with a comma as the only separator, read from typed or pasted text. */
function normalizeInsert(text: string): string {
  const clean = text.replace(/[^0-9.,]/g, '');
  const lastComma = clean.lastIndexOf(',');
  const lastDot = clean.lastIndexOf('.');
  if (lastComma >= 0 && lastDot >= 0) {
    // "2,000,000.50" or "2.000.000,50": whichever separator comes last is the decimal one.
    const decimalAt = Math.max(lastComma, lastDot);
    return clean.slice(0, decimalAt).replace(/[.,]/g, '') + ',' + clean.slice(decimalAt + 1).replace(/[.,]/g, '');
  }
  if (lastComma >= 0) return clean.slice(0, lastComma).replace(/,/g, '') + ',' + clean.slice(lastComma + 1);
  if (lastDot >= 0) {
    const groups = clean.split('.');
    const grouping = groups.slice(1).every(group => group.length === 3);
    if (grouping) return groups.join('');
    return clean.slice(0, lastDot).replace(/\./g, '') + ',' + clean.slice(lastDot + 1).replace(/\./g, '');
  }
  return clean;
}

/** Groups the canonical digits for display; `previous` is returned when the
 * edit would exceed the whole-digit limit, so the field simply refuses it. */
function formatCanonical(body: string, previous: string): string {
  const commaAt = body.indexOf(',');
  let whole = (commaAt >= 0 ? body.slice(0, commaAt) : body).replace(/[^0-9]/g, '');
  const decimals = commaAt >= 0 ? body.slice(commaAt + 1).replace(/[^0-9]/g, '').slice(0, MAX_DECIMALS) : null;
  whole = whole.replace(/^0+(?=\d)/, '');
  if (whole.length > MAX_WHOLE_DIGITS) return previous;
  if (!whole && decimals === null) return '';
  const grouped = (whole || '0').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return decimals === null ? grouped : grouped + ',' + decimals;
}

/** The display after the user changed the field from `previous` to `raw`.
 * A leading minus is kept as typed: a corrected account balance can be
 * negative, and the domain, not the field, decides whether a sign is valid. */
export function editAmountInput(previous: string, raw: string): string {
  if (raw === previous) return previous;
  const sign = /^\s*[-−]/.test(raw) ? '-' : '';
  const body = editBody(previous.replace(/^-/, ''), raw.replace(/^\s*[-−]\s*/, ''));
  return body ? sign + body : sign;
}

function editBody(previous: string, raw: string): string {
  if (raw === previous) return previous;
  let a = 0;
  while (a < previous.length && a < raw.length && previous[a] === raw[a]) a++;
  let b = 0;
  while (b < previous.length - a && b < raw.length - a && previous[previous.length - 1 - b] === raw[raw.length - 1 - b]) b++;
  const removed = previous.slice(a, previous.length - b);
  const inserted = raw.slice(a, raw.length - b);
  let head = canonical(previous.slice(0, a));
  // Backspace over a grouping dot means the digit before it: "12.|345" → "1.345".
  if (removed === '.' && inserted === '') head = head.slice(0, -1);
  return formatCanonical(head + normalizeInsert(inserted) + canonical(previous.slice(previous.length - b)), previous);
}

/** When editing ends: no dangling comma, and started decimals are completed
 * ("2.000,5" → "2.000,50"). A whole amount stays whole. */
export function settleAmountInput(display: string): string {
  if (display === '-') return '';
  const commaAt = display.indexOf(',');
  if (commaAt < 0) return display;
  const decimals = display.slice(commaAt + 1);
  if (!decimals) return display.slice(0, commaAt);
  return display.slice(0, commaAt) + ',' + decimals.padEnd(MAX_DECIMALS, '0');
}

/** A formatted amount ("−US$ 1.234,56") in the three parts a hero colours
 * differently. They always concatenate back to the same string. */
export function splitAmount(text: string): { prefix: string; whole: string; decimals: string } {
  const match = /^([^0-9]*)([0-9.]*)(,[0-9]*)?$/.exec(text);
  if (!match) return { prefix: '', whole: text, decimals: '' };
  return { prefix: match[1], whole: match[2], decimals: match[3] ?? '' };
}
