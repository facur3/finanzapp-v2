// The typed, side-effect-free entry of the financial domain the native app imports.
// Everything here lives under packages/domain: nothing is taken from outside the
// package (scripts/check-repo.mjs fails the build if an import reaches out).
// Money is integer minor units per currency (money.ts); there are no float helpers.
export * from './dates.ts';
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
