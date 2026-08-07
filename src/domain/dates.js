// Date utilities. Extracted verbatim from index.html (`_todayKey`, `_parseDate`).
// These become the foundation for the real-date model (Fase 2): today's ISO key
// and parsing human labels like "13 jul" into a Date near a reference date.

export const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export const FULL_MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

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

// Resolve a display label ("Hoy"/"Ayer"/"Anteayer"/"13 jul") to an ISO key
// "YYYY-MM-DD". This is how the app backfills real dates from the legacy
// label-only transactions and stamps new ones. Falls back to today when unknown.
export function isoFromLabel(label, ref = new Date()) {
  const base = new Date(ref);
  base.setHours(0, 0, 0, 0);
  const s = String(label || '').trim().toLowerCase();
  // Native date inputs and imported CSVs use an ISO date. The legacy parser
  // treated the leading year as a day number ("2024-06-05" became day 31),
  // which is why custom dates could later appear as "Hoy".
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const y = Number(iso[1]), m = Number(iso[2]), d = Number(iso[3]);
    const parsed = new Date(y, m - 1, d);
    if (parsed.getFullYear() === y && parsed.getMonth() === m - 1 && parsed.getDate() === d) return s;
    return todayKey(base);
  }
  if (s === '' || s === 'hoy') return todayKey(base);
  if (s === 'ayer') {
    const d = new Date(base);
    d.setDate(d.getDate() - 1);
    return todayKey(d);
  }
  if (s === 'anteayer') {
    const d = new Date(base);
    d.setDate(d.getDate() - 2);
    return todayKey(d);
  }
  const p = parseDate(label, base);
  return p ? todayKey(p) : todayKey(base);
}

// Turn the stored ISO date into a label that is useful *today*. We intentionally
// do not persist "Hoy"/"Ayer": those words go stale after midnight, while the
// ISO date remains correct forever.
export function labelFromISO(iso, ref = new Date()) {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return String(iso || '');
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(date.getTime())) return String(iso || '');
  date.setHours(0, 0, 0, 0);
  const base = new Date(ref);
  base.setHours(0, 0, 0, 0);
  const days = Math.round((base - date) / 86400000);
  if (days === 0) return 'Hoy';
  if (days === 1) return 'Ayer';
  if (days === 2) return 'Anteayer';
  const label = date.getDate() + ' ' + MONTHS[date.getMonth()];
  return date.getFullYear() === base.getFullYear() ? label : label + ' ' + date.getFullYear();
}

// Timeline headers keep the useful relative cue but always expose the real date.
// "Hoy · 7 ago" is harder to misread than a floating "Hoy" and still scans fast.
export function timelineLabelFromISO(iso, ref = new Date()) {
  const relative = labelFromISO(iso, ref);
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return relative;
  const short = Number(m[3]) + ' ' + MONTHS[Number(m[2]) - 1];
  if (relative === 'Hoy' || relative === 'Ayer' || relative === 'Anteayer') return relative + ' · ' + short;
  return relative;
}

export function fullDateLabel(iso) {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return String(iso || '');
  const year = Number(m[1]), month = Number(m[2]), day = Number(m[3]);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return String(iso || '');
  return day + ' de ' + FULL_MONTHS[month - 1] + ' de ' + year;
}

// Persistence order is not a chronology guarantee: imports, edits and legacy
// migrations may append older rows. Always derive list order from the real ISO date.
export function sortTransactionsNewestFirst(transactions, ref = new Date()) {
  return (Array.isArray(transactions) ? transactions : []).map((transaction, index) => ({ transaction, index })).sort((a, b) => {
    const aISO = a.transaction.dateISO || isoFromLabel(a.transaction.dateLabel, ref);
    const bISO = b.transaction.dateISO || isoFromLabel(b.transaction.dateLabel, ref);
    if (aISO !== bISO) return aISO < bISO ? 1 : -1;
    const aId = Number(a.transaction.id), bId = Number(b.transaction.id);
    if (Number.isFinite(aId) && Number.isFinite(bId) && aId !== bId) return bId - aId;
    return a.index - b.index;
  }).map(item => item.transaction);
}
