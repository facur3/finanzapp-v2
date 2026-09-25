// Calendar-day keys and the Spanish relative day label. Moved from the legacy web's
// src/domain/dates.js (Producto 24REP) with the behaviour the native app consumes;
// the web's label parsing ("Hoy"/"Ayer" → ISO), monthly-occurrence helpers and
// legacy dateLabel sorting retired with the web (tag web-frontend-final).
//
// Days are local calendar days (never UTC): a key is the year, month and day the
// device's clock shows, which is what the ledger stores in `dateISO`.

const SHORT_MONTHS_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'] as const;

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Local-date ISO key "YYYY-MM-DD" for `d` (today by default). Month is 1-based. */
export function todayKey(d: Date = new Date()): string {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

/**
 * The Spanish row label for a stored ISO day, relative to `ref` (today by default):
 * "Hoy", "Ayer", "Anteayer", then "5 jun" within the reference year and "30 dic 2025"
 * outside it. A future day is never relative. Anything that is not a valid
 * "YYYY-MM-DD" string comes back as it was given (as a string), so a bad row is
 * visible instead of silently re-dated.
 */
export function labelFromISO(iso: string | null | undefined, ref: Date = new Date()): string {
  const m = String(iso ?? '').match(ISO_DAY);
  if (!m) return String(iso ?? '');
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(date.getTime())) return String(iso ?? '');
  date.setHours(0, 0, 0, 0);
  const base = new Date(ref);
  base.setHours(0, 0, 0, 0);
  const days = Math.round((base.getTime() - date.getTime()) / 86400000);
  if (days === 0) return 'Hoy';
  if (days === 1) return 'Ayer';
  if (days === 2) return 'Anteayer';
  const label = date.getDate() + ' ' + SHORT_MONTHS_ES[date.getMonth()];
  return date.getFullYear() === base.getFullYear() ? label : label + ' ' + date.getFullYear();
}
