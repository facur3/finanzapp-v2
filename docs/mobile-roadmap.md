# FinanzApp mobile: living roadmap

Updated: 2026-09-12. Read with [decision 001](decisions/001-native-mobile.md).
This document supersedes the mobile architecture direction of
`product-rebuild-roadmap.md`; that file still records useful financial work.

## Destination

A real App Store app with a calm, minimal iOS experience: native navigation,
interruptible gestures, readable animated charts, accessible amounts/dates,
reliable financial rules, private local-first data and optional Supabase sync.
No seeded user data, paid AI dependency, fabricated returns or bank-password scraping.

## Status vocabulary

**Implemented** means code exists. **Checked** names the actual test performed.
**Device-verified** requires a recorded physical iPhone result. **Released** means
distributed, not just committed. Do not mark a feature complete from a screenshot,
a bundle export or an API key/configuration being present.

## Current iteration: isolated native foundation

- [x] Architecture decision including the SwiftUI alternative and no-Mac limits.
- [x] Same repo, separate mobile install and app identity; current product preserved.
- [x] `AGENTS.md` links the living plan for future contributors/agents.
- [x] Expo Router native navigation, account and amount sheets, local SQLite pilot.
- [x] Typed shared entry and integer-cent ledger validation/tests.
- [x] Linux typecheck, JS iOS bundle export, storage tests and web regression checks.
- [x] User accepted the first Expo Go pilot on iPhone: entries persisted after
  close/reopen and navigation felt native and fluid (reported 2026-09-12).
- [ ] User links their Expo project; no project ID or signing secret invented.
- [ ] Cloud-signed preview and remaining physical iPhone acceptance checks.

This is **not yet a replacement for the current app**. Do not uninstall it or
re-enter the full portfolio into the pilot. The first use/persistence pilot has
passed; the optimized standalone build and full device checklist remain gates.

## Current visual iteration and next deliverable

Continue with Expo + React Native. The first original, calm visual system is
implemented: available balance and quick actions on Home, date-grouped/searchable
movements, a complete account list, compact account/date selectors and clearer
amount/detail screens. Native navigation remains the only owner of transitions.
See [the mobile design brief](mobile-design.md) and its pending device acceptance.
Next implement posted-entry edit/undo, then a versioned import preview with exact
totals and recovery. Do not make the user manually rebuild the portfolio.

The owner reported **iPhone 14 Pro, iOS 26.6.1**. Next action: update the existing
checkout to `master` and try the new interface, retaining a private backup and
the current app. No Apple membership is needed for this UI/ledger work in Expo Go.
After UI review and basic ledger correction/recovery, link EAS Free and enroll
for the independent signed build before deeper Apple integration; do not wait
until the full migration is done. See [costs and next steps](empezar-en-iphone.md#6-después-del-piloto-aprobado).
Supabase remains in the architecture; mobile sync is still to be implemented.

## Next phases, in order

### M1 — Native foundation and device gate

- [x] Home, accounts, expense/income, activity and detail use native stack/sheets
  (implemented; basic iPhone experience accepted, specific gesture/layout checks pending).
- [ ] Small canceled swipes leave exactly the same screen visible; no redirect.
- [ ] Keyboard, safe areas, dynamic text and reduced motion work on an iPhone.
- [x] SQLite writes, same-operation retry and no silent empty reset (10 real-SQLite
  integration tests; basic close/reopen persistence also reported on iPhone).
- [x] Export pilot data with a distinct format (implemented; native sharing gate pending).
- [ ] Pass [physical device checklist](mobile-device-checklist.md).

### M2 — Safe data migration and complete ledger

- [ ] Immutable operation IDs; reversible/deduplicated posting model.
- [ ] Edit/undo posted entries and account changes, preserving the operation audit trail.
- [ ] Versioned legacy backup importer with dry run and exact before/after totals.
- [ ] Accounts/currencies, cash and liabilities kept separate; no fake FX rate.
- [ ] Transfer recorded once, including different-currency legs and rate/fees.
- [ ] Backup restore, corrupt input handling, interrupted migrations, recovery.
- [ ] Native data-at-rest protection/key recovery decision and privacy review.
- [ ] Cross-check against the existing rules/tests; do not reuse unsafe rounding.

### M3 — Cards, recurrent entries and investment accounting

- [ ] Credit purchase increases card debt, not an immediate cash debit.
- [ ] Closing dates, due dates, partial payments and installments.
- [ ] Early payment and repeated processing cannot debit twice.
- [ ] FCI-funded card payment posts a redemption/payment once, not a second expense.
- [ ] Investment purchase consumes the selected cash account; sale returns proceeds.
- [ ] Reconciliation changes quantities/valuation without invented cash transactions.
- [ ] FCI changes follow verified unit prices; estimated TNA is not a guaranteed yield.
- [ ] Quotes include source/time/currency/units, including bond/ON per-100 convention.
- [ ] Unknown acquisition cost stays unknown; missing prices retain last known data.
- [ ] Scheduled accounting is distinguished from actual bank execution. iOS background
  tasks do not guarantee code runs at an exact due time with the app closed; use
  idempotent catch-up on launch and evaluate an authorized server scheduler later.

### M4 — Reports, dashboard and assistant

- [ ] Clear cash available vs net worth, liabilities and invested value.
- [ ] Readable charts with labeled units/periods, real history and reduced motion.
- [ ] Compare matching portions of months, categories and merchants; no invented causes.
- [ ] Free local Spanish parser; gift/income/loan distinction and amount/merchant split.
- [ ] Answer money questions from actual ledger data, including yesterday and month deltas.
- [ ] Review/edit amount, account, category, date and action before saving.
- [ ] Honest fallback when the local assistant cannot understand; never promise all questions.

### M5 — Apple integration

- [ ] Local daily reminder: opt-in time, disable/edit, timezone changes, no duplicates.
- [ ] Notification action opens the proper entry screen; no sensitive amount by default.
- [ ] Haptics: restrained save/confirm/error feedback, not vibration on every scroll.
- [ ] Face ID plus device-passcode recovery; hide app-switcher snapshot when locked.
- [ ] Sign in with Apple and secure session handling.
- [ ] Siri/App Intents and Action Button quick capture.
- [ ] Wallet/Apple Pay Transaction Shortcut pilot on actual Argentine card/iPhone.
- [ ] Validate provided fields, account mapping, duplicate events, refunds and undo.
- [ ] Widgets with opt-in balance visibility; accessible system appearance.
- [ ] Future FinanceKit only if supported territory/products + entitlement allow it.

### M6 — Supabase and safe multi-device use

- [ ] Keep existing cloud data intact; apply versioned schema migration in staging first.
- [ ] Row-based data with RLS, ownership checks and cross-user isolation tests.
- [ ] Local outbox, deletion records, retry/idempotency and conflict policy.
- [ ] Same-account multi-device tests, offline edits, sign-out/user-change isolation.
- [ ] Account deletion/export, backup restoration and explicit cloud opt-in.
- [ ] Public API keys only in client; server credentials and provider secrets stay server-side.

### M7 — Monetization and release

- [ ] Apple Developer enrollment; verify seller identity and supported iOS version.
- [ ] Separate development/test/store environments and signing credentials.
- [ ] StoreKit subscription, restore purchases, cancellations/expiry/refunds tested.
- [ ] Optional RevenueCat evaluated separately; no paid service enabled automatically.
- [ ] TestFlight beta and performance/accessibility/offline migration acceptance.
- [ ] App icon, App Store screenshots, support/privacy URLs and privacy declarations.
- [ ] Review financial-app scope (tracker, not bank/broker), export compliance and policies.
- [ ] Production switch only after import fidelity and recovery have passed.
- [ ] App Store review and monitoring. Eligibility is not a guarantee of approval.

### Later — Banks and brokers

Galicia/Cocos/other connections require documented APIs/exports, consent and
provider access. Verify availability separately. No account passwords in the app,
no scraping promises, no claims that a local record actually paid a bank/card.

## Motion and visual acceptance rules

- One main number/action per screen; details on demand rather than crowded cards.
- Opaque native screen backgrounds, stable route ownership, real back stack.
- Modal open/close and canceled gestures must be continuous, with no base-tab flash.
- Restrained press/selection/confirmation motion; no looping decoration.
- Never animate a number from an invented balance. Preserve chart scale and meaning.
- Minimum 44-point targets, system text scaling, VoiceOver labels and sufficient contrast.
- Disable non-essential motion with Reduce Motion; no forced fixed-width date inputs.
- Aim for smooth frame pacing on real hardware; measure before claiming 60/120 fps.

## Handoff log (append actual evidence)

### 2026-09-12 — First native visual-system iteration

- Added original system typography, quiet grouped surfaces, semantic colors and
  compact rows. No real user data or seeded sample balances enter the app/repo.
- Home distinguishes available cash by currency from future full net worth.
  Expense/income preselection follows the selected currency or explicit account.
- Activity searches concept/category/account without accent/case sensitivity,
  filters type and uses stable, virtualized date groups. Account detail reuses it.
  Today/yesterday labels refresh at midnight and when returning to the app.
- Account selection no longer renders one button per account inside the form.
  Date selection keeps a separate draft until Listo; Cancelar/swipe discards it.
  iOS amount input includes a keyboard-dismiss action; large-text row layout adapts.
- One accessibility subscription controls restrained press/selection motion;
  stack/sheet transitions remain native. No screenshot overlays or back redirects.
- Checked on Linux: mobile TypeScript, 20 storage/toolchain/presentation tests,
  Metro iOS JavaScript/assets export, 221 domain/web tests and Vite build.
  Expo compatibility checked locally in offline mode; the regular online check
  and clean-install/build jobs remain required in the PR before merging.
- Browser component preview could not be opened by this environment's browser.
  No screenshot/layout approval, UIKit/date-keyboard behavior, canceled gesture
  result, signed build or frame-rate evidence is inferred from compilation.
  The first pilot's approval does not approve this new UI; device checklist pending.
- Recorded the reported iPhone 14 Pro/iOS 26.6.1. Updated the Spanish guide to
  switch old pilot checkouts to `master`, retain SQLite, and explain Expo Go vs
  EAS Build vs an independent preview. Stay free for this step; no build or charge.
- No schema, dependencies, signing configuration, Supabase data or legacy
  production code changed. Next: device feedback, posted-entry edit/undo,
  versioned restore/import preview, then the next migration milestones.

### 2026-09-12 — Expo Go pilot accepted; next milestone defined

- User reports following the guide successfully on their iPhone, registering an
  expense/movement and finding it unchanged after closing and reopening Expo Go.
- User describes the navigation/animations as fluid and native; accepts continuing
  with the chosen architecture and asks for an original minimal iOS visual design.
- Device model, iOS version and tested revision were not provided. No independent
  build, canceled-gesture matrix, accessibility matrix or performance measurement
  is inferred from this report. See the updated device checklist.
- Next scope: design system and first three screens, edit/undo and safe import.
  Cards, investments, reports/assistant, Apple integrations and sync follow their
  existing phases. No Expo/Apple subscription, cloud build or database change was
  initiated. The owner already has a working Expo Go development setup.

### 2026-09-11 — Foundation started

- GitHub access confirmed for existing public `facur3/finanzapp-v2`.
- Remote base: `e299eb3` (same tree as existing local fixes). The user's unrelated
  legacy iOS splash asset change is untouched in its original worktree.
- New work is isolated on `feat/expo-native-foundation`; no cloud build/submission.
- Existing baseline: 192 tests passed. Mobile verification pending implementation.
- User action next: create/sign in to Expo, install Expo Go, then link the project.
  Apple membership is needed for the signed iPhone development/TestFlight build,
  not to begin writing or testing the pure logic.

### 2026-09-11 — First slice implemented and checked on Linux

- Independent Expo SDK 57 / React Native 0.86.3 install and lockfile, with
  isolated development/preview identities. No production/cloud credentials.
- Empty home, ARS/USD accounts, opening balances, editable expense/income drafts,
  activity/detail, system date picker and explicit JSON export.
- Native stack/sheets, tab fade, press feedback, save haptic, light/dark background
  consistency and reduced-motion support implemented. No iPhone result claimed.
- Integer cents and safe-range validation; opening balance is not income.
- Parameterized SQLite, atomic migrations, dedicated transaction connections
  configured before BEGIN, repeated-ID protection and recoverable initialization.
- **Checked:** 221 domain/web regression tests (including 29 new ledger cases),
  10 integration tests using real temporary SQLite files, mobile TypeScript check,
  Metro iOS JS/assets export and existing Vite production build.
- Local Expo dependency check passed in **offline mode only** after the online
  command's network approval was canceled. Added a normal online compatibility
  check and mobile install/typecheck/storage/export job to GitHub Actions.
- Added a nested repository hygiene guard for mobile dependencies, build outputs,
  local databases, environment files and signing files.
- **Not yet checked:** signed Xcode compilation, native SQLite driver on-device,
  gesture smoothness, system sharing, keyboard/date layout and accessibility on iPhone.
- **Not migrated:** current personal data, cards, holdings, reports, assistant or
  Supabase. No new user data was seeded and no paid/cloud service was started.
- Next: follow [the Spanish iPhone guide](empezar-en-iphone.md), record the device
  gate, then implement previewed legacy import and reversible ledger edits.

### 2026-09-12 — Follow-up dependency fixes checked

- Aligned TypeScript to Expo SDK 57's expected `~6.0.3` and explicitly included
  Node/React types. The previous published CI failure was the older TS version.
- Replaced the two vulnerable indirect packages with patched upstream versions.
  The decoder needs a small CommonJS adapter to preserve the router caller's API;
  the scoped UUID override preserves the Xcode generator's CommonJS API. Details
  and removal criteria are in `apps/mobile/compat/README.md`.
- Clean `npm ci` succeeded; the installed dependency tree is valid and the mobile
  `npm audit` snapshot reports zero vulnerabilities. This is not a full security audit.
- Passed: TypeScript, 13 SQLite/toolchain tests, Metro iOS JS/assets export,
  221 domain/web tests, Vite production build and repository hygiene.
- Expo compatibility passed locally in offline mode. The online endpoint timed
  out through the workspace proxy; the normal online check remains enabled in
  GitHub Actions and must pass there before merging the foundation PR.
- No UI or database schema changed in this follow-up. The design brief is a plan
  for the next iteration; the user's Expo Go result predates these dependency fixes.
