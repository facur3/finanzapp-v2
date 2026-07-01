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
