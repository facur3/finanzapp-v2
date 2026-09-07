// Pure money-formatting helpers. Extracted verbatim from the FinanzApp component
// (index.html) so they can be unit-tested and reused after the React migration.
// Behaviour MUST stay identical to the pre-extraction app (parity vs v53-stable).

// "1234.5" -> "1.234,50"  (AR thousands "." , decimals ",")
export function fmtNum(n) {
  n = Math.abs(n);
  const p = n.toFixed(2).split('.');
  return p[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + p[1];
}

// "1512" -> "1.512" (rounded, no decimals)
export function fmtInt(n) {
  n = Math.abs(Math.round(n));
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

// "78144" -> "78K"  ·  "500" -> "500"
export function abbr(n) {
  n = Math.abs(n);
  if (n >= 1000) return Math.floor(n / 1000) + 'K';
  return '' + Math.round(n);
}

// signed money string, e.g. -1000 -> "-$1.000,00"
export function signed(n) {
  return (n < 0 ? '-' : '+') + '$' + fmtNum(n);
}

// Prettifies a raw user-typed amount string ("1234,5" -> "$1.234,5"), grouping the
// integer part and keeping whatever decimals were typed. "" -> "$0".
export function displayAmount(raw) {
  if (!raw) return '$0';
  const parts = raw.split(',');
  let i = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  let out = '$' + i;
  if (raw.indexOf(',') >= 0) out += ',' + (parts[1] || '');
  return out;
}

// Accept both the app's Argentine display format and machine/US decimal output.
// This is used by CSV import, including files exported by FinanzApp itself where
// JavaScript serializes decimals with a dot (for example, "-12500.5").
export function parseMoneyInput(value) {
  const original = String(value ?? '').trim();
  if (!original) return NaN;
  const negative = /^\s*-/.test(original) || /^\s*\(.*\)\s*$/.test(original);
  const clean = original.replace(/[^0-9.,]/g, '');
  if (!/\d/.test(clean)) return NaN;

  const dot = clean.lastIndexOf('.');
  const comma = clean.lastIndexOf(',');
  let normalized = clean;
  if (dot >= 0 && comma >= 0) {
    const decimal = dot > comma ? '.' : ',';
    const thousands = decimal === '.' ? ',' : '.';
    normalized = clean.split(thousands).join('').replace(decimal, '.');
  } else {
    const separator = dot >= 0 ? '.' : comma >= 0 ? ',' : '';
    if (separator) {
      const groups = clean.split(separator);
      const thousandsOnly = groups.length > 2
        ? groups.slice(1).every(group => group.length === 3)
        : groups[1].length === 3;
      normalized = thousandsOnly ? groups.join('') : groups.slice(0, -1).join('') + '.' + groups[groups.length - 1];
    }
  }
  const number = Number(normalized);
  return Number.isFinite(number) ? (negative ? -Math.abs(number) : number) : NaN;
}
