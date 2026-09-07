// Period-scoped reporting computed FROM transactions by real date — the Fase 2
// correctness fix. Before this, reports/budgets read persisted accumulators
// (monthIncome/monthExpense/categoryTotals) that were never actually scoped to a
// period, so the "Este mes / Esta semana / Este año" selector did nothing.
//
// periodIdx: 0 = Este mes, 1 = Esta semana (Mon–Sun), 2 = Este año.
import { isoFromLabel } from './dates.js';

// Effective ISO date of a transaction: prefer the stored dateISO, else derive it
// from the legacy dateLabel on the fly (so it works before the load-time backfill).
export function effectiveISO(t) {
  return t.dateISO || isoFromLabel(t.dateLabel);
}

function startOfWeek(ref) {
  const d = new Date(ref);
  d.setHours(0, 0, 0, 0);
  const dow = (d.getDay() + 6) % 7; // 0 = Monday
  d.setDate(d.getDate() - dow);
  return d;
}

const localISO = date => [
  date.getFullYear(),
  String(date.getMonth() + 1).padStart(2, '0'),
  String(date.getDate()).padStart(2, '0'),
].join('-');

const parseLocalISO = value => {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  date.setHours(0, 0, 0, 0);
  return Number.isNaN(date.getTime()) ? null : date;
};

// Inclusive start and exclusive end for a current or previous reporting period.
// `offset = -1` means the immediately preceding comparable week/month/year.
export function periodBounds(periodIdx, ref = new Date(), offset = 0) {
  const base = new Date(ref);
  base.setHours(0, 0, 0, 0);
  const delta = Number.isFinite(Number(offset)) ? Math.trunc(Number(offset)) : 0;
  let start;
  let end;
  if (periodIdx === 1) {
    start = startOfWeek(base);
    start.setDate(start.getDate() + delta * 7);
    end = new Date(start);
    end.setDate(end.getDate() + 7);
  } else if (periodIdx === 2) {
    start = new Date(base.getFullYear() + delta, 0, 1);
    end = new Date(base.getFullYear() + delta + 1, 0, 1);
  } else {
    start = new Date(base.getFullYear(), base.getMonth() + delta, 1);
    end = new Date(base.getFullYear(), base.getMonth() + delta + 1, 1);
  }
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  return { start, end, startISO: localISO(start), endISO: localISO(end) };
}

// Is an ISO "YYYY-MM-DD" within the given period relative to `ref`?
export function inPeriod(dateISO, periodIdx, ref = new Date()) {
  const dt = parseLocalISO(dateISO);
  if (!dt) return false;
  const { start, end } = periodBounds(periodIdx, ref);
  return dt >= start && dt < end;
}

export function periodTxns(txns, periodIdx, ref = new Date()) {
  return txns.filter((t) => inPeriod(effectiveISO(t), periodIdx, ref));
}

export function periodTxnsOffset(txns, periodIdx, offset = 0, ref = new Date()) {
  const { start, end } = periodBounds(periodIdx, ref, offset);
  return txns.filter(t => {
    const date = parseLocalISO(effectiveISO(t));
    return !!date && date >= start && date < end;
  });
}

// The active week/month/year is normally incomplete. Comparing it against an
// entire previous period gives a misleading result, so mirror only the elapsed
// calendar days in the immediately preceding period.
export function comparablePreviousPeriodBounds(periodIdx, ref = new Date()) {
  const base = new Date(ref);
  base.setHours(0, 0, 0, 0);
  const current = periodBounds(periodIdx, base);
  const previous = periodBounds(periodIdx, base, -1);
  const tomorrow = new Date(base);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const currentCutoff = tomorrow < current.end ? tomorrow : current.end;
  const utcDay = date => Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const elapsedDays = Math.max(0, Math.round((utcDay(currentCutoff) - utcDay(current.start)) / 86400000));
  const end = new Date(previous.start);
  end.setDate(end.getDate() + elapsedDays);
  if (end > previous.end) end.setTime(previous.end.getTime());
  return { start: previous.start, end, startISO: localISO(previous.start), endISO: localISO(end), elapsedDays };
}

export function comparablePreviousPeriodTxns(txns, periodIdx, ref = new Date()) {
  const { start, end } = comparablePreviousPeriodBounds(periodIdx, ref);
  return txns.filter(t => {
    const date = parseLocalISO(effectiveISO(t));
    return !!date && date >= start && date < end;
  });
}

// Calm, predictable chart buckets: days for a week, 7-day blocks for a month,
// and calendar months for a year. The caller supplies the value so mixed ARS/USD
// movements can be converted with the app's current exchange rate first.
export function reportBuckets(txns, periodIdx, ref = new Date(), valueForTxn = t => {
  if (Number(t && t.amount) < 0) return Math.abs(Number(t.amount));
  return t && t.type === 'gasto' ? Math.abs(Number(t.val) || 0) : 0;
}) {
  const { start, end } = periodBounds(periodIdx, ref);
  const DAY = 86400000;
  const rows = [];
  if (periodIdx === 1) {
    const labels = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
    for (let i = 0; i < 7; i += 1) {
      const from = new Date(start); from.setDate(from.getDate() + i);
      const to = new Date(from); to.setDate(to.getDate() + 1);
      rows.push({ label: labels[i], from, to, value: 0 });
    }
  } else if (periodIdx === 2) {
    const labels = ['E', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
    for (let i = 0; i < 12; i += 1) {
      rows.push({ label: labels[i], from: new Date(start.getFullYear(), i, 1), to: new Date(start.getFullYear(), i + 1, 1), value: 0 });
    }
  } else {
    const days = Math.round((end - start) / DAY);
    for (let first = 1; first <= days; first += 7) {
      const last = Math.min(days, first + 6);
      rows.push({ label: first === last ? String(first) : first + '–' + last, from: new Date(start.getFullYear(), start.getMonth(), first), to: new Date(start.getFullYear(), start.getMonth(), last + 1), value: 0 });
    }
  }
  for (const txn of Array.isArray(txns) ? txns : []) {
    const date = parseLocalISO(effectiveISO(txn));
    if (!date || date < start || date >= end) continue;
    const bucket = rows.find(row => date >= row.from && date < row.to);
    if (bucket) bucket.value += Math.max(0, Number(valueForTxn(txn)) || 0);
  }
  return rows.map(row => ({ label: row.label, fromISO: localISO(row.from), value: row.value }));
}

// Spending per category (expenses only), matching the app's accumulator semantics
// (only type 'gasto' contributes to categoryTotals).
export function categoryTotals(txns) {
  const ct = {};
  for (const t of txns) {
    if (t.type === 'gasto') ct[t.cat] = (ct[t.cat] || 0) + t.val;
  }
  return ct;
}

// Income / expense sums, matching monthIncome/monthExpense semantics.
export function incomeExpense(txns) {
  let income = 0;
  let expense = 0;
  for (const t of txns) {
    if (t.type === 'ingreso') income += t.val;
    else if (t.type === 'gasto') expense += t.val;
  }
  return { income, expense };
}
