// A typed, side-effect-free entry for native clients. The legacy UI continues
// using src/domain. Move implementations only after both clients have parity.
// The float-based web money helpers (fmtNum, parseMoneyInput) are deliberately not
// re-exported: native money is integer minor units per currency (money.ts).
export { todayKey, labelFromISO } from '../../src/domain/dates.js';
export * from './ledger.ts';
export * from './currency.ts';
export * from './money.ts';
export * from './month-summary.ts';
export * from './spending-report.ts';
export * from './recovery.ts';
export * from './transfers.ts';
export * from './account-changes.ts';
export * from './report-insights.ts';
export * from './spending-overview.ts';
export * from './recurring.ts';
export * from './budgets.ts';
export * from './liabilities.ts';
export * from './report-trend.ts';
export * from './appearance.ts';
export * from './categories.ts';
