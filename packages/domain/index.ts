// A typed, side-effect-free entry for native clients. The legacy UI continues
// using src/domain. Move implementations only after both clients have parity.
export { fmtNum, parseMoneyInput } from '../../src/domain/money.js';
export { todayKey, labelFromISO } from '../../src/domain/dates.js';
export * from './ledger.ts';
export * from './month-summary.ts';
export * from './spending-report.ts';
