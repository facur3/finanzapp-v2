# Release Notes

## v54 — Stable data model (2026-07-01)

Tag: `v54-stable-data-model`

This release closes the "stabilization" phase: the financial logic was pulled out
of the single-file app into a tested domain layer, and reporting/budgets now work
off **real transaction dates** instead of display labels. No UI redesign — the app
looks and behaves like v53, only the numbers are now correct per period.

### Current stable features
- **Accounts**: bank / cash / wallet (liquid), investment and debt accounts.
- **Movements**: expense, income, transfer, card purchase (with installments),
  investment buy/sell, recurring movements and card auto-pay.
- **Cards**: credit cards with limits, statements, installments and payments.
- **Investments**: CEDEARs / crypto / fixed income with live prices, portfolio
  donut, per-asset detail with price history chart, and a USD valuation.
- **Reports**: net-worth trend (daily snapshots), spending by category / account /
  card, top merchants, income vs expense — all honoring the period selector.
- **Budgets**: monthly limit per category with a green/amber/red status.
- **Goals** (metas) and **loans** (préstamos) trackers.
- **Data**: localStorage is the source of truth, with optional Supabase cloud
  sync, CSV import/export and JSON backup. Installable PWA with offline shell.

### Data model changes (this release)
- **Financial domain extracted** to `src/domain/` (pure, unit-tested ES modules):
  `money`, `transactions` (apply/reverse), `balances` (net worth), `dates`,
  `reports` (period math). The app (`index.html`) delegates to
  `window.FinanzDomain`, bundled to a classic script via `npm run build:domain`.
- **Real dates**: every transaction now stores `dateISO` ("YYYY-MM-DD"). Legacy
  transactions (which only had a `dateLabel` like "Hoy"/"Ayer") are **migrated
  automatically on load** (`isoFromLabel`), idempotently and crash-safe.
- **Period-correct reporting**: `categoryTotals` / income / expense are now
  computed from transactions filtered by real date. The "Este mes / Esta semana /
  Este año" selector actually filters, and budgets are truly the current month.
- **Vitest** added (`npm test`) — 27 tests covering money formatting, apply/reverse
  invariants, net worth, date parsing/migration and period totals.

### Known limitations
- **Persisted accumulators** (`monthIncome`/`monthExpense`/`categoryTotals`) are
  still written by the ledger and still power the Home summary (kept all-time on
  purpose to stay pixel-identical to v53). They are no longer the source of truth
  for Reports/Budgets.
- **UI is still a single `index.html`** on the Claude Design runtime; `cards` and
  `investments` logic is not yet extracted to `src/domain/`.
- **No automatic bank import**: Apple FinanceKit is US/UK (Apple Card/Cash) only —
  not available for Argentine banks (Galicia/Cocos). Realistic path is CSV/export.
- **No push notifications yet** (needs backend infra: Supabase + cron/VAPID).
- **Apple Pay is not readable**: iOS does not expose Wallet transaction details to
  a PWA. The most that's possible is a Shortcut that *opens* the app for quick
  capture after paying.

### Next recommended spikes (cheap, throwaway — validate before investing)
1. **Apple Pay / Shortcuts capture**: open the app from an iOS Shortcut after a
   Wallet transaction and land on a pre-filled "add expense" sheet (manual amount).
2. **Web Push notifications**: prove push works on the installed PWA (iOS 16.4+)
   for budget/bill alerts, then build the minimal server side.
3. **Only after the above** decide on the React migration — it improves
   maintainability but does not, by itself, unlock any of the native features.
