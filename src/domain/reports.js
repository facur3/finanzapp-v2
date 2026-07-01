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

// Is an ISO "YYYY-MM-DD" within the given period relative to `ref`?
export function inPeriod(dateISO, periodIdx, ref = new Date()) {
  if (!dateISO) return false;
  const [y, m, d] = String(dateISO).split('-').map(Number);
  if (!y || !m || !d) return false;
  const dt = new Date(y, m - 1, d);
  dt.setHours(0, 0, 0, 0);
  const r = new Date(ref);
  r.setHours(0, 0, 0, 0);
  if (periodIdx === 1) {
    const s = startOfWeek(r);
    const e = new Date(s);
    e.setDate(e.getDate() + 7);
    return dt >= s && dt < e;
  }
  if (periodIdx === 2) {
    return y === r.getFullYear();
  }
  // Este mes (default)
  return y === r.getFullYear() && m - 1 === r.getMonth();
}

export function periodTxns(txns, periodIdx, ref = new Date()) {
  return txns.filter((t) => inPeriod(effectiveISO(t), periodIdx, ref));
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
