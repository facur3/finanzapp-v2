// Date utilities. Extracted verbatim from index.html (`_todayKey`, `_parseDate`).
// These become the foundation for the real-date model (Fase 2): today's ISO key
// and parsing human labels like "13 jul" into a Date near a reference date.

export const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

// Local-date ISO key "YYYY-MM-DD" (NOT UTC — matches the app's original behaviour).
export function todayKey(d = new Date()) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

// Parse a loose label ("13 jul", "3", "30 dic") into a normalized Date near `ref`.
// Picks the nearest occurrence within ~6 months (so a December date seen in January
// resolves to the previous year). Returns null when there's no day number.
export function parseDate(label, ref) {
  ref = ref || new Date();
  const m = String(label || '').toLowerCase().match(/(\d{1,2})\s*([a-zé]{3,})?/);
  if (!m) return null;
  const day = Math.min(31, Math.max(1, parseInt(m[1], 10)));
  let mon = ref.getMonth();
  if (m[2]) {
    const i = MONTHS.indexOf(m[2].slice(0, 3));
    if (i >= 0) mon = i;
  }
  let d = new Date(ref.getFullYear(), mon, day);
  d.setHours(0, 0, 0, 0);
  const SIX = 183 * 86400000;
  if (d - ref > SIX) d = new Date(ref.getFullYear() - 1, mon, day);
  else if (ref - d > SIX) d = new Date(ref.getFullYear() + 1, mon, day);
  d.setHours(0, 0, 0, 0);
  return d;
}
