# FinanzApp mobile: living roadmap

Updated: 2026-09-19. Read [decision 001](decisions/001-native-mobile.md) and
[decision 002](decisions/002-spending-first.md). Decision 002 supersedes earlier
full-finance migration phases and the local-only AI preference. Handoff entries
below are historical evidence, not current product priorities.

## Destination

An iOS spending/commitment app: fast capture, understandable spending, upcoming
payments and optional manually tracked accounts. No native investment portfolio,
market quotes or claim to know complete net worth. Cloud AI is opt-in, bounded and
server-keyed; manual recording and local data work without connectivity. Recurring
expenses, debts, budgets and cards remain in scope. Native navigation, accessible
amounts, real data and recoverable durable writes remain requirements.

## Status and current delivery — Interfaz 07

Implemented is code, checked names a test, device-verified needs a physical result,
and released means distributed. Neither a bundle nor a screenshot is App Store QA.

- [x] Spending-first Home: week/month, separate currencies, recorded expense total.
- [x] Exact chart buckets, category and date drill-downs; scoped recent entries.
- [x] Original warm-white/ink/indigo visual direction inspired by supplied references.
- [x] Accounts stay accessible from the header/Settings; initial balance optional.
- [x] Remove obsolete MonthCard, duplicated monthly flow block and balance-hero colors.
- [x] Cloud contracts, mobile client/evidence builder, disabled API routes and
  Responses provider adapter. No AI key in app, paid request or cloud data migration.
- [x] Staging SQL inbox with owner isolation, unique events and durable daily quotas.
- [ ] Activate/test the integrations with real staging auth, consent and owned keys.
- [ ] Physical visual/gesture review on iPhone. The user accepted only the initial
  Expo Go pilot; later interface iterations have not received device approval.

Local verification: **331 root/domain/API + 92 mobile tests = 423**; TypeScript,
iOS JS/Hermes/assets export, root Vite build and repository hygiene pass. Local
online Expo dependency verification timed out through the proxy; online CI remains
a merge gate. PostgreSQL schema tests run in a new isolated CI job, not the user's
Supabase. Browser layout preview was blocked at localhost (ERR_BLOCKED_BY_CLIENT),
so no rendered layout, native frame pacing or gesture acceptance is claimed.
CI run [35470917523](https://github.com/facur3/finanzapp-v2/actions/runs/35470917523)
passed the web and PostgreSQL jobs but blocked mobile on four newly recommended
SDK 57 patches. Updated Expo to ~57.0.24, Constants to ~57.0.19, Router to ~57.0.22
and Sharing to ~57.0.21; no SDK-major jump, workaround or disabled check. The next
CI run must pass all three jobs before merge. Final result is linked from PR #22.
After those patches, 423 tests, typecheck, dependency-tree integrity and iOS export
pass again locally; the mobile npm audit reports zero known vulnerabilities.

Existing SQLite stays at schema 3. No private data, test fixture, ZIP artwork or
financial screenshot is added to user data or published as a product asset.
The unmerged card-statements experiment is not part of this delivery. The old
web/Capacitor product and data remain available; its used features are not dead code.

## Next deliverables, in order

### 1. Complete the daily tracking loop

- [ ] Review Interfaz 07 on device: small canceled swipes, large text, both themes,
  tiny amounts/long names, Monday/month boundaries and 30–40 tab changes.
- [ ] First-entry onboarding without requiring a named account; preserve current
  recorded-account semantics rather than inventing a bank balance.
- [ ] Budgets by month/category, explicit remaining budget and exceeded state.
- [ ] Recurring expenses/income and subscriptions: next occurrence, pause/edit,
  reminders and per-occurrence identity. Scheduled is not paid; retries cannot duplicate.
- [ ] A small upcoming-payments block only after there is actual stored data.

### 2. Activate smart capture and explanations

Use [integration contracts](mobile-integrations.md) as the implementation boundary.

- [ ] Staging Supabase setup, mobile sign-in and cloud-data consent; no login needed
  for the local core. The existing web snapshot is not a mobile sync engine.
- [ ] Text assistant UI, then audio/transcription with explicit mic permission,
  limits and deletion. Review/edit/undo with no phantom success or discarded draft.
- [ ] Evaluate Spanish phrases, ambiguous categories, currencies, loans/refunds,
  questions and failure handling with owned test data and measured provider usage.
- [ ] Safe auto-registration opt-in only for complete supported operations and
  owned account/card mappings. Ambiguous messages stay drafts.
- [ ] Scoped/revocable Shortcut pairing token; current base endpoint uses session
  JWT and is not a turnkey background Shortcut integration.
- [ ] Durable inbox → SQLite receipt → acknowledgement, repeated delivery after
  edits/deletions and cross-device conflict tests before autonomous ingestion.
- [ ] Actual iPhone Apple Pay transaction trigger, available fields, missing amount,
  duplicate triggers, offline catch-up and cancellation verified without bank execution.
- [ ] Explain only deterministic facts, disclose partial records, and link supporting
  movements. Savings plans need goals/timeframe and explicit assumptions.

### 3. Commitments and cards

- [ ] Debo / me deben, due dates, partial payments and recoverable history.
- [ ] Loan principal is separate from income/consumption; interest/fees have categories.
- [ ] Debit/credit payment method, purchase, installments and due date.
- [ ] Purchase counted once; installment/payment reduces obligation without a second
  expense. Early payment removes that amount from later scheduled payments.
- [ ] Cash outflow, recorded expense and future commitment have distinct labels.
- [ ] No native FCI redemption, broker portfolio or simulated bank/card payment.

### 4. Independent build, Apple and optional sync

- [ ] Link owner's EAS project and enroll Apple when ready for a signed preview;
  the Expo Go design/ledger step does not need a paid build.
- [ ] Local reminders with opt-in time/timezone/deduplication; no amounts by default.
- [ ] Face ID/passcode fallback, background privacy and native data protection.
- [ ] App Intents/widgets/Apple sign-in after signed-device evidence.
- [ ] Optional normalized Supabase sync: outbox, revisions, tombstones, RLS, conflict
  handling and user/session isolation. Reuse durable local operation IDs.
- [ ] Data export/deletion/recovery and provider privacy/retention before cloud release.
- [ ] TestFlight performance/accessibility, subscription economics, StoreKit/restore,
  policy/support/privacy metadata and App Store submission after the release gate.

Legacy import stays optional backlog. Do not require JSON or full portfolio re-entry.
Keep native backup/recovery, integer cents, no fake FX, no silent reset and original
unrelated work. Never merge all branches indiscriminately or enable costs by accident.

## Motion and design rules

One main number, real chart values, calm hierarchy and contextual actions. Native
stack/sheets own transitions. Preserve the mounted-tab mitigation; do not reintroduce
focus fades, detach/freeze combinations or redirect-based back handling. Brief press,
selection and data-change animations respect Reduce Motion; text and financial
values are never hidden until an animation finishes. 44-point targets, VoiceOver,
safe areas, system text and separate currencies apply to every new screen.

## Handoff log (historical evidence)

### 2026-09-19 — Interfaz 07: spending-first direction

Product pivot and dashboard implemented; see status above and decision 002. Manual
local entry remains operational; cloud/Shortcuts base is explicitly disabled until
configured and tested. No remote SQL, API charges or signed build performed.


### 2026-09-14 — Interfaz 06: daily reports and fair comparisons

- Daily amounts open actual expenses. Comparison ranks category differences;
  links retain exact date cutoffs and currency. No extra Home card/tab.
- Equal elapsed days in current months; short February caps both periods with
  explanation. Full historical months disclose unequal lengths. Missing history
  never becomes invented savings. Integer cents and safe aggregate range guards.
- No database writes/schema changes, dependencies, paid services or production
  replacement. Native stack/press feedback and black-tab mitigation preserved.
- Checked locally: **317 domain/web + 85 mobile tests = 402**, TypeScript,
  iOS Metro JS/Hermes/assets export (1691 modules), root Vite build and repository
  hygiene. Online Expo compatibility hit an HTTP proxy timeout; local offline
  compatibility passed with Expo's reduced-reliability warning. Online CI must
  pass before merge. Real iPhone layout/gestures remain pending.
- Legacy import optional per owner; native backup/recovery retained.

### 2026-09-13 — Interfaz 05: account corrections and internal transfers

- Owner asks to continue bounded implementation and will review recent design
  together later. No new device acceptance, paid plan, EAS build or production
  replacement was authorized/started in this delivery.
- Account pencil edits name/current available balance. Explicit correction
  adjusts opening balance with a revision and local audit receipt, not a fake
  expense/income. Currency is immutable. Stale balance corrections reject if a
  posting changed the balance while the form was open. Name-only edits preserve it.
- Same-currency transfers use a single row representing both legs, integer cents,
  safe-range validation and one durable transaction. Edit/undo/recover plus audit
  receipts prevent duplicate effects or late retries reverting later changes.
- Contextual Transferir on account detail; native sheets, shared selectors/date/
  amount controls, both resulting balances and negative-balance warning. No added
  Home action or tab; neutral transfer row instead of fake spending/income color.
- Transfers appear once in mixed activity/recent results and on both accounts;
  reports remain expense/income-only. Undone transfers remain recoverable.
- New-account submission is also frozen across a failed post-commit refresh.
- SQLite 1/2 → 3 migration preserves filename, records, revisions and old receipts.
  Native v3 backup includes corrected accounts and transfer records/tombstones;
  imports v1/v2/v3, validates all data, blocks conflicts, adds atomically. No full
  local audit export, legacy import, actual bank execution or silent FX operation.
- Checked locally: **306 domain/web + 80 mobile tests = 386**, TypeScript,
  Metro iOS JS/Hermes/assets export (1688 modules), root Vite build and repository
  hygiene. Node SQLite tests include real v1/v2 migration interruption/restart,
  transfer/account audit failures, frozen retries, stale drafts and atomic import.
  Route-handler tests cover real handlers with native hosts replaced by descriptors;
  not UIKit rendering, animation frame pacing or gesture evidence.
- Local online Expo dependency check hit proxy timeout; no dependencies changed.
  CI online compatibility and both build/mobile jobs must pass before merge.
- Next: versioned legacy import plan/dry run with explicit supported entities;
  no wholesale re-entry of personal data. Combined iPhone review remains pending.
  [Walkthrough](empezar-en-iphone.md#10-interfaz-05-cuentas-y-transferencias).

### 2026-09-13 — Interfaz 04: contextual correction and native recovery

- Owner asks to continue while they review the design later. Their descriptions
  of categories/Home are not physical or visual acceptance. Keep the existing
  original palette, press/selection feedback, chart-value transitions and native
  stack/sheets. WhatsApp-like shared elements/MonAi scroll ideas are recorded as
  possibilities, not implemented via experimental navigation overlays.
- One reusable form now creates or edits native expenses/income. All fields
  prefill, identity/createdAt stay immutable, no-change saves do nothing, and a
  same-currency account correction recalculates both affected balances once.
  Exact submitted commands are held across retry/refresh failures; stale drafts
  cannot overwrite a newer version. Success/haptics follow durable storage/read.
- Deshacer is a tombstone, not a refund/extra income; Recuperar restores its
  original effect. Both require native confirmation with amount/account impact.
  Detail changes status in place, with no redirect; Settings lists recoverable
  undone entries. Active Home, activity and reports exclude tombstones.
- Local SQLite v1 → v2 migration keeps the same pilot filename and rows; adds
  version/state fields and an atomic local before/after edit audit. Tested restart,
  failed audit writes, interrupted ALTER/import batches, receipt retries and
  stale commands. A downgrade is refused intact; no remote schema is changed.
- V2 native snapshot export includes current revisions/tombstones, not full audit
  history. Native v1/v2 import previews counts and exact available totals by currency,
  skips equal IDs/data and blocks the entire batch on any conflict. It only adds
  missing rows; no reset/replacement/name-based account merging or implicit sync.
  Unsupported legacy/web/future/mixed formats, dangling/duplicate IDs, invalid
  cents/dates and unsafe totals are refused. Limit: 5 MB / 1,000 accounts / 25,000
  movements. No file is uploaded; source file is read-only; exports are not encrypted.
- Regression testing found an order-dependent extreme-balance failure: insertion
  validation could pass but a date-sorted reload overflowed an intermediate Number
  sum. Native balances now accumulate exactly with BigInt and check the final safe
  range, returning integer cents; no BigInt goes to SQLite/JSON or the legacy web.
- Checked: **282 domain/web + 61 mobile tests = 343**, mobile TypeScript, Metro iOS
  JavaScript/Hermes/assets export (1,681 modules), legacy Vite build and repository
  hygiene. Handler/host-descriptor tests include prefilling, cancel, busy/double-tap,
  retry, file review and native-confirmation wiring; they are not rendered iOS tests.
  The local online Expo compatibility request timed out at the environment proxy;
  its bundled offline check and the normal online CI check are recorded separately.
  Both CI jobs must pass before merging.
- No physical iPhone, native Files/sharing, canceled gesture, visual approval,
  signed build or frame-rate evidence for this iteration. No new dependencies,
  EAS build, charge, bank operation, personal-data publication or Supabase write.
  Next: owner checks Interfaz 04/03 and the existing black-tab stress test; then
  account corrections/transfers and versioned legacy import. Do not use the pilot
  as the principal ledger or re-enter the entire portfolio yet.

### 2026-09-13 — Interfaz 03: a focused dashboard and monthly spending report

- Owner asked to continue the original minimal iOS identity with a useful Home,
  categories and reports. This read-only slice does not replace the remaining
  edit/undo, backup restore or legacy import milestones.
- Home retains available cash/ARS-USD, expense/income and three recent movements.
  Account access is integrated into the balance surface instead of duplicating
  an account list. Tu mes adds the three largest categories with explicit partial
  coverage when more exist; all categories are available through Ver reporte.
- New native-stack report and category detail use the existing push/back owner.
  Month/currency remain in the report state and are passed to category detail;
  entry detail returns to its originating category. No redirects, focus reloads,
  fourth tab or new screen fade; the previous black-tab mitigation is preserved.
- Shared domain helper uses integer cents, complete historical calendar months,
  current month through today, and separate ARS/USD. Opening balances/income never
  become spending categories. Unsafe totals withhold the whole chart, not part of it.
  Case/accent/space variants group without rewriting records; exact normalized
  category equality is shared by the bars and their movement filter.
- One-color bars represent share of **total** spending, not share of the largest
  category. Amounts/percentages stay explicit; sub-0.1% values are not labeled zero.
  Transitions only occur when proportions change (260 ms; zero with Reduce Motion),
  without zero-to-total number animation or focus replay. List rows support large
  text, narrow widths, accessible names and virtualized long lists.
- Checked: **249 domain/web tests + 41 mobile tests = 290**, TypeScript,
  Metro iOS JavaScript/assets export and legacy Vite build. Mobile tests include
  report selections, actual route handlers/data scope, chart configuration and
  the existing SQLite/tab safeguards; these are not native rendering/gesture tests.
  Local Expo compatibility passed in offline mode only; online CI remains required
  before merging, together with clean installs, builds and repository hygiene.
- Browser component preview was attempted but returned ERR_BLOCKED_BY_CLIENT for
  the local preview. No alternate browser/network route was used. No screenshot,
  layout approval, physical gesture result, signed iOS build or frame-rate claim.
  Interfaz 03 in Settings identifies the delivery; the Spanish guide includes a
  non-mutating report walkthrough plus the still-open tab-switch stress test.
- No dependency, schema or storage change; no bank/merchant lookup, user-data
  publication, Supabase write, EAS build, paid service or legacy product change.
  Next: iPhone visual/back-navigation feedback, posted-entry edit/undo and recovery.

### 2026-09-12 — Interfaz 02: intermittent black tabs and visual feedback

- User reports completing the requested basic checks successfully, but a tab
  sometimes stays black (Settings/Movements, roughly one in ten switches).
  The visual design is explicitly not approved; the user asks for a more useful,
  distinctive, calm iOS experience and future merchant logos/category recognition.
- Inspected installed Expo Router 57's vendored BottomTabView, forFade and
  react-native-screens fallback. Fade animates scene opacity to/from zero and
  coordinates native inactive activity/detachment. This is a **plausible mechanism,
  not a reproduced physical-iPhone root cause**. No evidence of a lost SQLite record.
- Removed content fade for the three tabs; set detachInactiveScreens=false,
  lazy=false and freezeOnBlur=false. Native detail/modal stack is unchanged.
  No timed redirects, snapshots, focus reloads, forced remounts or global screen
  disabling. The tradeoff is keeping three lightweight roots mounted; lists stay
  virtualized. Source and configuration regression guards live under mobile UI/tests.
- Added a deep-blue available-balance surface, compact ARS/USD selection, category
  badges, searchable/reusable/custom category choice, and Tu mes. Existing strings
  are preserved; arbitrary category text has a safe symbol fallback (including
  object-prototype names). This is not AI classification or a seeded user dataset.
- Shared monthly summary uses recorded entry dates through today, integer cents
  and separate currencies; opening balances are excluded. Unsafe total magnitude
  returns an unavailable state instead of rounding or blanking the Home screen.
- Checked: 230 domain/web tests and 29 mobile tests (including two tab-layout
  configuration guards), TypeScript, Metro iOS JS/assets export and Vite build.
  These guards are not native navigation/performance tests. CI must pass online
  Expo compatibility, clean installs, builds and hygiene before merge.
- Interfaz 02 is visible in Settings. Spanish guide and device checklist specify
  cache-only restart, 30–40 tab switches, search retention, keyboard/background
  cases and non-mutating category draft tests. No local data reset or reinstall.
- No visual preview or native runtime reproduced the intermittent issue here.
  Physical iPhone re-test and visual feedback remain open. Next: resolve any
  remaining native issue, then posted-entry edit/undo and safe restore/import.
- Merchant logos are future verified assets with category/initial fallback;
  do not generate fake marks or send private entry text to lookup providers.
  Reports/charts remain planned around real periods/categories, not decoration.
- No new dependency, DB/schema mutation, cloud write, EAS build, charge or legacy
  production behavior change. Official reference for the affected tab options:
  [React Navigation bottom tabs](https://reactnavigation.org/docs/bottom-tab-navigator/).

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
