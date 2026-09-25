# FinanzApp mobile: living roadmap

Updated: 2026-09-25 (Producto 24C1). Read [decision 001](decisions/001-native-mobile.md),
[decision 002](decisions/002-spending-first.md),
[decision 003](decisions/003-five-tabs-and-cards.md) and
[decision 004](decisions/004-native-first-and-web-retirement.md). Decision 002 supersedes
earlier full-finance migration phases and the local-only AI preference; decision 004 makes
the native app the product; the web/Capacitor frontend was retired on 2026-09-25 (Producto
24REP; its last version is the tag `web-frontend-final`). This file
holds what exists, what still needs the iPhone and what comes next. The technical history of
every delivery up to Producto 24R1 (the "Previous delivery" sections and the handoff log,
moved verbatim on 2026-09-25) is in [mobile-roadmap-history.md](mobile-roadmap-history.md);
the physical checks are in [mobile-device-checklist.md](mobile-device-checklist.md).

Implemented is code, checked names a test, device-verified needs a physical result, and
released means distributed. Neither a bundle nor a screenshot is App Store QA.

## Destination

An iOS spending/commitment app: fast capture, understandable spending, upcoming
payments and optional manually tracked accounts. No native investment portfolio,
market quotes or claim to know complete net worth. Cloud AI is opt-in, bounded and
server-keyed; manual recording and local data work without connectivity. Recurring
expenses, debts, budgets and cards remain in scope. Native navigation, accessible
amounts, real data and recoverable durable writes remain requirements.

## Decisions that still bind

Architectural decisions that are not derivable from the code. Each has its source; the
history file keeps the evidence of when and why.

- **Native is the product** (decision 004, 2026-09-25). `apps/mobile`, `packages/domain` and
  the mobile backend contracts (`server/mobile`, docs/mobile-integrations.md) are the source of
  truth. The web/Capacitor frontend was retired on 2026-09-25 (Producto 24REP) with Git history
  preserved: the tag `web-frontend-final` marks its last commit, the tree holds no copy of it and
  `npm run check:repo` refuses its return (docs/web-retirement-inventory.md §0 has the recovery
  commands). Android will come from the same Expo/React Native project, sharing navigation,
  domain, storage abstractions, i18n, the Assistant and the components, with platform
  differences behind `Platform.OS`, `.ios.tsx`/`.android.tsx` files or adapter modules; no
  second repository without an architectural reason recorded as a decision.
- **Expo + React Native + TypeScript, Swift only for targeted Apple integrations**, a no-Mac
  workflow through EAS development builds on a registered iPhone (decision 001). No EAS cloud
  build, subscription or store submission without the owner's account setup and authorisation
  for the charge or the release.
- **Spending and commitments first, accounts optional** (decision 002): gasto registrado,
  ingreso, saldo manual, presupuesto restante and deuda are distinct concepts; internal
  transfers and balance corrections are neither expense nor income; no investment portfolio,
  quotes, FCI, broker or bank execution in the native scope.
- **Five tabs, each with one meaning, the Assistant in the centre** (decision 003 and Producto
  22): Inicio, Movimientos, Asistente, Reportes, Más (Tarjetas as the second row of Más →
  Finanzas). The mounted-tab mitigation stays; no fade/detach/freeze; native stack and sheets
  own every screen transition. Tabs never slide.
- **Cards and debts are internal accounts** (decision 003): a purchase is one expense on the
  card, a payment is a transfer that lowers cash and debt and is never a second expense; a debt
  or receivable moves only by transfers; Disponible excludes cards, debts and receivables; a
  card never carries a plain income and is never a transfer's source (24B6).
- **Instalments are finite obligations tied to one purchase**, never several expenses and never
  an unlimited recurring rule; refunds tie to the purchase (Producto 24T, design reviewed before
  code).
- **Money is integer minor units** per currency (ISO 4217 exponent, CLDR display digits), no
  floating point anywhere near an amount, no `10 **`, sums in BigInt; each account keeps its
  own currency for ever; storage never converts; the amount field and the formatters go through
  `money-input.ts` and `src/i18n/format.ts` (docs/currency.md §1, §5, §6).
- **No FX without a real, dated, sourced rate; unknown is unknown.** One original currency per
  account for ever; one display currency for the totals; conversions **only in the views** (24C1),
  each movement at the reference rate of its own date, exact BigInt arithmetic rounded once, the rate
  stored with its source and date; nothing stored is ever converted and the person never types a rate.
  A missing or stale rate gives per-currency subtotals with a discreet note, never a partial total or a
  guess; no fabricated market history. Rates come automatically from Frankfurter (free, no key, named in
  the info button), only when a view needs a month it lacks (docs/currency.md §2.8, §8).
- **Three gates:** `RELEASED_LANGUAGES` (es, en) opens only after device QA, in its own commit.
  `LEDGER_CURRENCIES` holds 146 currencies since 24M (ARS, USD and every ready currency with 0 or 2
  decimals; the seven three-decimal ones held for their VoiceOver check, docs/currency.md §2.7).
  `RELEASED_REGIONS` is the released stages of `region-stages.ts` (234 of 257 since 24R2B). Opening
  regions and currencies on automated verification is a provisional development strategy before launch
  (24R2B, 24M), not an explicit authorization by the owner:
  nothing is published, the short per-family iPhone sheet (docs/region-families.md) must pass before the
  first TestFlight, and any stage can be set back to blocked in one commit; a stage with a known defect or
  an unverified amount-entry path stays blocked (the 23 native-digit regions). A preview flag
  (`EXPO_PUBLIC_LOCALE_PREVIEW`, `EXPO_PUBLIC_CURRENCY_PREVIEW`) exists only in a development
  bundle. Language, region and each account's currency are three independent things: a region
  never implies a currency, a language never changes an amount (docs/i18n.md, docs/currency.md).
- **User data starts empty.** Nothing seeds balances, movements, holdings or market history;
  synthetic fixtures live only in tests; the repository is public and carries no financial
  backups, screenshots with real data, tokens, signing keys or bank credentials.
- **Durable local writes, drafts kept on failure, never a reset on error.** SQLite is the ledger
  (schema 10, backups v10 once a deletion record exists, older backups still import); a write is
  confirmed only after it landed; deleting a recurring rule or a debt tracker keeps its row as a
  deletion record and never touches the movements it produced (24UX4);
  edits are audited and undoable; future sync needs operation IDs, revisions, tombstones,
  conflict handling and RLS (nothing in Supabase provides offline sync by itself).
- **Every AI-generated movement is a draft until the person confirms it explicitly.**
  Confirmar on the draft card is the only path that writes an Entry; Apple Pay captures,
  Shortcut messages, transcriptions and inbox deliveries fill a review tray, never ledger rows;
  there is no auto-registration mode (withdrawn 2026-09-22). The Assistant has no authority over
  balances: its proposals pass the domain validators and its explanations cite checkable facts.
- **Cloud AI is opt-in, server-keyed and bounded.** No provider key in the app, quotas reserved
  before a call, spend ceilings, cost telemetry without content, a kill switch; no live paid
  call until the owner configures and approves the provider account; manual entry stays offline
  and free (docs/mobile-integrations.md, docs/currency.md §11.4).
- **Apple Pay capture records an expense draft; it never executes bank payments or reads
  arbitrary Wallet history.** Bank integrations need official access and consent. FinanceKit
  is not available for Argentine cards. Reminders never claim a bank did not receive a payment.
- **Device evidence rules.** Face ID, notification delivery, Wallet/Shortcuts, gesture quality,
  frame rate and VoiceOver order require a physical iPhone; a typecheck or an iOS export is not
  an Xcode build; no frame-rate or App Store claim before verification.
- **Interface rules.** Native navigation gestures, safe areas, Dynamic Type, Reduce Motion and
  Reduce Transparency honoured everywhere; Liquid Glass only on the two control surfaces with
  the opaque fallback; the cobalt/sapphire primary marks interaction only and keeps 4.5:1;
  semantic colours carry meaning; 44 pt targets; no decorative glassmorphism, no large currency
  selector beside the main amount, no new navigation without a decision.
- **Legacy import stays optional backlog.** Never require JSON or a full portfolio re-entry;
  data was never shared between the retired web app and the native app.
- **Never merge all branches indiscriminately, never enable costs by accident**; one focused
  branch and PR per delivery, CI green, the checks recorded in this file at handoff.

## 1. Implemented (current state)

What exists in code on `master` as of Producto 24UX4 (PR #58), plus Producto 24UX5 on its branch
(marked). Per area, without test inventories (those are in apps/mobile/README.md and the history
file).

- **Product shape.** Five native tabs with the Assistant in the centre and Más as the grouped
  hub (Finanzas / App y datos: Cuentas, Tarjetas, Presupuestos, Recurrentes, Deudas y cobros,
  Categorías, Idioma, Región, Apariencia, backup, the Assistant's data note); a Más version line
  («FinanzApp 0.1.0 (24UX5)»; 24UX5 on its branch: the material and locale diagnostics only in a development
  build). Liquid Glass on
  Inicio's movement pills, its Assistant entry and the Assistant composer only in a development build on iOS 26 with
  the API present and without Reduce Transparency; opaque material otherwise.
- **Inicio.** One main number (gasto registrado of the month, or Disponible: cash in normal
  accounts only), the Gastos / Disponible segment, the period, a discreet currency switch only
  when more than one currency is held (segment with two, compact row with three or more), and
  (24UX3) a hierarchy of one focal point: a compact header, a 48 pt number with room around it,
  three compact movement pills (Gasto, Ingreso, Transferir) and one wide Assistant entry below
  them, then three sections with their own shape: ranked category washes as a compact summary
  card, then two open lists on the ground that differ by density: the upcoming payments (only
  with real recurring data; category as the caption, the due day once) as a tight agenda, recent
  movements as a full-height open ledger (the account named only when another of the currency
  exists; an empty month says so once). Section links
  (Reportes keeps the currency, Ver todos) are quiet. 24UX5 (on its branch): the links take the slate `link`
  token; both lists draw the same 40 pt mark (the agenda stays tighter); the Home rows (`EntryRow
  variant="home"`) caption the date alone and add the category or the account only when needed to tell a row
  apart (`homeNamesCategory`; the account only when the visible rows of that list come from more than one
  account, `visibleNamesAccount`); VoiceOver keeps every field.
- **Recording.** Gasto / Ingreso / Transferencia on one control; kind and amount first; the
  amount field anchored with tabular digits, typing and pasting in the region's separators,
  per-currency exponent (0, 2, 3), 15-digit bound, paste markers, shortcuts (Usar todo, Pagar
  total, Saldar total, Cobrar total) that only fill the amount; Categoría and Pagado con /
  Ingresa en as stacked selection rows; the date wheel in a compact bottom sheet on iOS (24B6;
  its entrance is corrected in 24UX1); edit, undo, contextual account correction and recovery;
  a draft kept when a save fails; historical card incomes still editable.
- **Ledger and storage.** SQLite schema 10 (24UX4: a `deleted` flag on recurring rules
  and debt profiles; schema 9 added `currency_units`), durable writes, audited
  edits, same-currency internal transfers, balance corrections, accounts with identity
  (display rename, archive-first), category identity (presets in code, definitions per kind,
  normalised key, schema 8), cards and debts as internal accounts with profiles (issuer, last
  four digits, limit, closing and due days; counterparty, direction, due date), card rules
  (24B6). Backups v8/v9 export as before; v10 (24UX4) only once a rule or debt is
  deleted, carrying its deletion record; v1–v10 import; a failed restore rolls back.
- **Commitments.** Weekly/monthly/yearly recurring rules with next occurrence, pause, edit,
  per-occurrence identity (scheduled is not paid; retries cannot duplicate); debts and
  receivables with partial payments; card purchases and payments; closing and due dates from
  the user's days. 24UX2: a rule's detail lists the movements it recorded (read by their
  deterministic id, never the scheduled dates), a recorded movement links back to its rule, a paused
  rule reads "Pausado" at full contrast. 24UX4: a rule pauses, resumes (never
  recording what fell due while paused) or is deleted, and a debt is settled (the reviewed payment
  form, prefilled), closed (listed under Cerradas), reopened or deleted, from a trailing swipe on
  its row or from its detail; deleting asks first and leaves every recorded movement, payment and
  collection in the ledger. 24UX5 (on its branch): the catch-up runs on launch and on every return to the
  foreground and is pinned by real-SQLite tests; a long backlog is recorded automatically in durable batches
  with its original dates (one rule can no longer keep the ledger or Recurrentes closed), and an occurrence
  already in the ledger counts as recorded even after the person edited or undid it. No instalment plans yet.
- **Merchant identity (24UX2).** `packages/domain/merchants.ts`: normalized merchant keys, a
  curated catalogue of 35 unambiguous brands matched only by exact alias, never a category; the
  typed name is never rewritten; bare common words (Apple, Steam, Adobe, Despegar) stay
  unrecognized. Typed metadata only: `MerchantBadge` draws the category glyph for every merchant;
  brand marks are deferred to 25C2 (no logo API, bundled brand asset, upload or provider key); a
  development-only initial preview checks recognition (docs/merchant-identity.md).
- **Budgets and reports.** A monthly total budget plus category sublimits (schema 7); explicit
  remaining and exceeded states; Reportes with trend, donut and legend, day-by-day, budgets, top
  merchants, insights, previous-month and category comparison with explicit ranges and
  missing-history guards; one display mode and currency shared by Inicio and Reportes
  (`finanzapp.displayMode`, `finanzapp.displayCurrency`, outside the ledger and backups): since 24C1 a
  consolidated total converted in the view (each movement at its own date's rate) or one currency on
  its own; charts, categories, merchants, budgets and comparisons add up to the same total.
- **Assistant.** The conversational screen (Producto 21/22): composer with a visible voice
  affordance, streaming-ready event client over the authenticated integration client, draft
  cards with explicit Confirmar, clarification chips, evidence rows and links from cited facts,
  a disconnected state; `runtime.ts` returns disconnected because no session provider exists;
  development fixtures (`EXPO_PUBLIC_ASSISTANT_FIXTURES=1`). Server side (`server/mobile`):
  authenticated endpoints, the durable `needs_review` inbox for Shortcut captures, quota
  reservations (30 AI queries per user per day, 300 global; 120/2 000 captures), an OpenAI
  Responses adapter prepared (`gpt-5-mini`, strict JSON, `store:false`), the PostgreSQL schema
  tests; request contract v1 without a language. No paid call has ever been made.
- **Internationalization.** Spanish and English released; 234 of the 257 catalogue regions
  released (Argentina and the United States since 23.1C2, the rest in 24R2B); language and region chosen independently ("Según el dispositivo" or one value), both
  reactive without restart; every screen through modular catalogues with `i18n:check`,
  `i18n:extract`, `i18n:export`; regional money, date and percentage formats from tables;
  VoiceOver amounts in the language's own decimal mark; the date wheel in the language's home
  locale; `supportedLocales` declared to iOS. Producto 24R1 added the generated region catalogue
  (257 regions from cldr-json 48.2.0, pinned and verified offline in CI, the one deliberate
  deviation documented), independent detection of the device Region kept as
  `device.detectedRegion` ("Ahora: Japón (formatos de Argentina)" when unreleased), explicit
  conventions in every formatter and in `bindLocale` (separator, padding, secondary grouping,
  minimum grouping, week start; ten cross combinations pinned), `Intl` probing with a folding
  collator fallback, the reusable searchable `ChoiceScreen` and `choice-list.ts` (pinned option,
  recents, alphabetical sections, ranked search, the no-match sentence) not yet mounted, and
  `recent.ts` for the last three choices per chooser. The review of PR #53 made `formatDayMonth`
  path-independent (`registryRegionOf`, `sameWriting`) and fixed the chooser's no-match state.
  Producto 24R2B released 234 regions by continent on automated per-family evidence (23
  native-digit regions blocked), with CLDR's spaced dates, time separators, unpadded hours and
  day-month order audited and fixed.
  Producto 24R2A derived `REGIONS` and `RegionCode` from the catalogue (the hand-written
  `REGION_REGISTRY` keeps AR/US byte-identical), mounted `ChoiceScreen` behind Más → Idioma and →
  Región (`LocaleChooser`, reusable by the onboarding), kept a region chosen in the development
  preview across release builds with its stand-in named, taught the amount field every group family
  (lakh, minimum grouping, apostrophe, narrow and no-break spaces, other scripts' digits on paste)
  through one grouping rule, and wrote the release plan by convention family (`region-release.ts`);
  AR and US are still the only released regions.
- **Currencies.** The ISO 4217/CLDR catalogue (178 codes, pinned, `currency:verify` offline in
  CI); the pure amount model for exponents 0–4; presentation, copy and spoken forms for any
  currency with ARS/USD byte-identical goldens; storage and forms currency-aware (24B1–24B5:
  the safety net, one creation gate with read acceptance apart, strict route currencies, the
  amount path by exponent, schema 9 and backup v9, the searchable currency screen, the
  currency chosen before the amount in card, debt and budget forms); since 24M the ledger gate
  offers 146 currencies (144 new: 128 with two decimals, 16 without), the three-decimal ones only on
  a development preview; the Assistant stays ARS/USD (contract v1). Since 24C1: reference rates from
  Frankfurter v2 in a separate SQLite cache (`finanzapp-rates-v1.sqlite`), exact conversion in
  `packages/domain/fx.ts`, consolidated views on Inicio, Reportes, their drill-downs and Presupuestos;
  nothing stored converts; purchases paid from an account in another currency are 24C2.
- **Motion and material.** `src/ui/motion.tsx` (strong ease-out, named durations, value
  crossfades, reflow, haptic helpers), press feedback, segmented control, category washes,
  the card carousel on the UI thread, Reduce Motion everywhere (rules in §6).
- **Builds and tooling.** Expo SDK 57 / React Native 0.86 / Reanimated 4 with an independent
  lockfile; EAS project `@facur3/finanzapp-mobile` linked; development builds installed on the
  owner's iPhone (FinanzApp Dev, `com.facur3.finanzapp.dev`); Metro from the branch for QA. CI:
  root tests/build/hygiene, mobile `npm ls`, `expo install --check`, typecheck, currency and
  region catalogue verification, strict localization check, the SQLite tests, the iOS export;
  the mobile API's PostgreSQL tests.

## 2. Device QA pending

Nothing below is verified until the owner records the result on the iPhone (with the language
it was checked in). Metro from the branch on the installed FinanzApp Dev build serves every
item unless a section says a new native build is needed. The checklist sections are in
[mobile-device-checklist.md](mobile-device-checklist.md).

- **24C1 — consolidated finances:** the checklist section Producto 24C1 (accounts in ARS, USD, EUR and JPY;
  the display sheet; the consolidated total in four currencies; a past month against its own dates; flight mode;
  the info buttons; single mode; VoiceOver and the largest text on the subtotals). Required before the first
  TestFlight, not before the merge.
- **24UX5 — visual consistency, copy and the recurring audit:** the slate links in both themes, the
  40 pt marks on both Home lists, the date-only captions and the cases that bring the category or the account
  back, «By category», Reportes' information button and the insight no longer repeating the ranking, the
  Más version line, the recurring catch-up on open and foreground with a due date passed while closed,
  VoiceOver in both languages, the largest text size, a currency switch without flicker (checklist,
  Producto 24UX5).
- **24UX4 — managing recurring rules and debts:** the trailing swipe (feel, threshold, one row
  open at a time, the native back swipe untouched, scroll vs swipe), the action colours in both
  themes, the confirmations, VoiceOver's Actions rotor on the rows, Dynamic Type on the action
  labels, Reduce Motion, the detail buttons, Saldar's prefilled payment, Cerradas, and the schema 10
  upgrade of FinanzApp Dev's data with a backup first (checklist, Producto 24UX4).
- **24UX3 — Home hierarchy:** first-glance clarity, the compact header, the 48 pt number, the
  three pills and the Assistant entry (prominence, reach, not read as search), the three section
  shapes, the cobalt balance, Dynamic Type, VoiceOver and Reduce Motion, in both themes and both
  materials (checklist, Producto 24UX3).
- **24UX2 — the Home refinement and the merchant mark:** the lighter actions in both themes and
  materials, the upcoming and Recurrentes rows with the date once, the single empty sentence, the
  Registrados history and the Recurrente row, paused rules at full contrast, the tab bar's
  secondary labels, and the development monogram preview (checklist, Producto 24UX2).
- **24UX1 — the date sheet's corrected entrance and the darker light-mode inks:** the card comes
  from below the edge over about 300 ms on the iOS sheet curve with no frame already in place;
  fast opens and closes, Cancelar/Listo/the scrim, keyboard, theme change, VoiceOver, Dynamic Type
  and safe areas; Reduce Motion as a timed fade; the darker light `secondary`/`tertiary` inks on the
  Home captions and the hero's cents (checklist, Producto 24UX1). No EAS build was made; judge the
  feel in at least the development build, ideally a release build.
- **24M — 144 currencies opened:** the checklist section Producto 24M (the sheet over 146 currencies, one account,
  card, budget and recurring rule each in EUR, JPY and COP, a backup round trip, VoiceOver per exponent; the
  three-decimal VoiceOver check on the preview that decides the held seven).
- **24R2B — 234 regions released:** the short sheet in docs/region-families.md (eight number families,
  fifteen date writings, Spanish and English) and the chooser with 234 rows (search, recents, sections,
  keyboard and safe areas, the largest Dynamic Type, VoiceOver, scrolling at 60/120 Hz) (checklist,
  Producto 24R2B). Required before the first TestFlight, not before the merge.
- **24R2A — the native choosers and the preview regions:** Más → Idioma and → Región as
  `ChoiceScreen`, the kept preview choice in a release build (checklist, Producto 24R2A).
- **24R1 — the device-Region line:** an iPhone whose Region is an unreleased country shows
  "Ahora: … (formatos de Argentina)" in Más → Región.
- **24B6 — the date sheet, one display currency, the card rules:** the compact card over the
  scrim (geometry, inset, Dark Mode, Dynamic Type, VoiceOver order, Escape), Cancelar / Listo /
  scrim semantics, Reduce Motion; the display currency travelling between Inicio and Reportes
  and surviving a force-quit; card flows (no income on a card, Pagar tarjeta, transfers never
  listing a card). The gate-opening commit of 24M waits for this evidence.
- **24B5 — the currency screen (preview gate):** the searchable sheet over 150 currencies,
  the currency before the amount, the number pad per exponent, the VoiceOver units, the switch
  with three or more currencies.
- **24B4 — schema 9 and backup v9:** the one-way upgrade on the owner's test data, export and
  restore, a v8 copy still importing.
- **24A, 24B1–24B3:** regression spot-checks only; nothing visible in production.
- **23.2 — which binary is installed and the per-app Language row** (new build `1d69d2d4`).
- **23.1C2 — English and the United States released** (new development build; `supportedLocales`);
  **23.1C1** regional formats and the amount field; **23.1B1 / 23.1B2** translations of every
  screen; **23.1A** language and region architecture; **23.0** the amount field, rows and the
  localization foundation.
- **22.1, 22, 21, 20, 19, 18** and **Interfaz 17 → 06**: the visual, navigation, Assistant UI,
  identity, budget and reports checks listed per section; the **first device gate** (native
  navigation and cancelled back-swipes, keyboard/date/money sheets, cold start, data after a
  force quit, denied permissions, Reduce Motion and large text) and the **later Apple gates**
  (Face ID, notifications, Wallet trigger) remain open; the **release gate** applies before any
  TestFlight.

## 3. Next deliveries

In order. Each is one focused PR, CI green, merged before the next starts; each records its
checks here and its device evidence in the checklist. The names from Producto 25A on are a
proposal for ordering, not a commitment to dates. Standing in every delivery: no paid service,
no new currency, no FX provider and no new language enabled unless the delivery says so and
the owner authorises it; no EAS build or store submission without the owner.

### Producto 24UX1 — date-sheet polish, native-first direction and roadmap (PR #54)

- **Goal.** The compact date sheet enters from the bottom edge without a jump (the modal is
  mounted and measured before the rise starts; a timed fade under Reduce Motion; the card never
  vanishes before its exit ends and never leaves an invisible modal); an audit of Inicio without
  a general redesign (hierarchy, sizes, spacing, empty states, legibility, accessibility, the
  four actions and the central Assistant, one-handed reach, redundancy) with only small
  demonstrable fixes and tests; AGENTS.md and README.md rewritten for the native-first direction;
  decision 004 and the verifiable web-retirement inventory; this roadmap reorganised with the
  history moved out.
- **Out of scope.** Any other sheet, the financial semantics of dates, a Home redesign, deleting
  web code, 24R2.
- **Gates.** Typecheck, the SQLite tests, currency and region verification, strict i18n, Expo
  check, the iOS export and CI; the date sheet's feel and the Home findings that need the eye
  are recorded as device QA (§2).
- **Status.** Delivered on this branch (2026-09-25), not device-verified.
  - The sheet: `BottomSheet` (`src/ui/form-controls.tsx`) mounts the modal with the card a window
    height below the edge and the scrim clear, and starts the rise only once iOS has presented the
    modal (`onShow`) and measured the card (`onLayout`), in either order; `easeSheet`
    (0.32, 0.72, 0, 1), `duration.sheet` 300 ms and `duration.sheetExit` 200 ms in `motion.tsx`;
    `sheetTiming` keeps the durations under Reduce Motion (a fade in place) and carries
    Reanimated's explicit `ReduceMotion.Never`: without it the device setting makes a timing land
    on its target in one frame, so the fade would have been instant (review of PR #54; the test
    emulates the runtime's policy with the installed package's enum). Diagnosis with
    evidence in docs/mobile-design.md (Producto 24UX1): the 24B6 effect started `withTiming` in the
    same effect that mounted the modal, RN's `Modal` renders nothing while hidden and presents in
    `didMoveToWindow`, and the ease-out curve covered 60 % of the travel in two frames, so the first
    painted frame already showed the card up. Tests in `date-field.node.ts`: both event orders, a
    close before the presentation and a stale `onShow`, a reopen mid-exit that never unmounts, a
    finished exit that always does, Reduce Motion as a timed fade with no displacement.
  - Inicio: the light `secondary` (#66686F) and `tertiary` (#84868D) inks now pass 4.5:1 and 3:1
    on the background, surface and inset (they were 4.4:1 and 2.9:1 on the background); the
    Disponible help glyph is drawn in secondary. Documented, not changed: the Assistant present
    twice on Home, Gasto outside one-handed reach, the two near-duplicate empty sentences of a
    currency without data, the tab bar's 10 pt inactive labels; each with the visual comparison
    a later iteration needs (docs/mobile-design.md, Producto 24UX1).
  - Direction: AGENTS.md and README.md rewritten (native is the product; the web tree frozen
    legacy until its retirement PR), decision 004, `docs/web-retirement-inventory.md` with the
    commands and results; decision 001 marked superseded in part. Nothing deleted.
  - This roadmap: history moved verbatim to `docs/mobile-roadmap-history.md` (29 previous
    deliveries, 42 handoff entries, 3 notes); the Más footer reads Producto 24UX1.
  - `apps/mobile/README.md` rewritten native-first (architecture, Fedora and iPhone setup, EAS
    profiles, verification, test flags, the real status of languages, regions, currencies, the
    Assistant and Android, and implemented / device-tested / released kept apart); its former
    chronology and test inventory moved verbatim to the history file (review of PR #54).
  - **Checked on Linux:** root `npm test` 448/448, `npm run build`, `npm run check:repo`; mobile
    `npm run typecheck`, `npm run test:storage` 577/577 (real SQLite), `npm run currency:verify`,
    `npm run regions:verify`, `npm run i18n:check -- --strict` (0 errors, 0 stale), `npm run check`
    (up to date), `npm run export:ios` (4,970,840 bytes). No EAS build; the iPhone was not modified;
    no paid service, currency or FX provider enabled.
  - **Pending:** the device QA of §2 (24UX1); the retirement PR of decision 004 is 24REP, below.

### Producto 24REP — native-first consolidation and retirement of the web/Capacitor frontend (PR #55)

- **Goal.** One PR that executes decision 004: the web/Capacitor frontend leaves the tree with
  Git history preserved, the last native dependency on `src/` moves into `packages/domain`, the
  root keeps only the tooling the product uses, the repository guard refuses the legacy tree and
  imports from it, Vercel keeps `api/mobile/*` only, and the docs describe the repository as it is.
- **Out of scope.** 24R2, any visible change to the app, the bundle identifier, Vercel
  environment variables, Android.
- **Gates.** Root `npm test` and `npm run check:repo`; every mobile check; the PostgreSQL schema
  tests; CI green; a Vercel preview whose API fails closed and serves no page.
- **Status.** Delivered on this branch (2026-09-25). Nothing to verify on the iPhone: the native
  bundle imported nothing from the web tree.
  - History: annotated tag `web-frontend-final` → `ac4f038` (the merge of PR #54), no rewrite.
    Recovery commands in docs/web-retirement-inventory.md §0.
  - Removed with `git rm`: `index.html`, `support.js`, `capacitor.config.ts`, `public/`, root
    `ios/`, `src/` (app, capacitor, domain), `api/chart.js`, `api/fund-data.js` and tests,
    `design-reference/`, the three web build scripts, `SUPABASE_SETUP.md`, four web-only docs.
    Moved: `src/domain/dates.js` → `packages/domain/dates.ts` (`todayKey`, `labelFromISO`, typed,
    parity proven before the deletion; the web-only functions retired); `RELEASE_NOTES.md` and
    three web docs → `docs/history/` with history headers.
  - Root: `package.json` keeps `test` and `check:repo` (vitest, typescript); Vite, esbuild and the
    Capacitor packages gone; `scripts/check-repo.mjs` guards generated files, the legacy tree, imports
    from retired paths, sensitive files and credential-shaped content (`check-repo.test.js`). CI:
    `build` → `domain` without the Vite build; `mobile` and `mobile_api` unchanged. `vercel.json`:
    functions only, a static output holding one plain `404.html`.
  - Docs: README, AGENTS, apps/mobile/README, decisions 001 and 004, the inventory (§0 executed),
    currency.md and empezar-en-iphone.md no longer describe the web as present; Android's
    shared-code rule recorded (AGENTS rule 13, README, §5 below).
  - **Checked on Linux:** root `npm test` 270/270 (was 448: −192 retired tests in 19 files, of
    which 173 web-only and 19 legacy date tests; +8 `dates.test.ts`, +6 guard tests), `npm run check:repo`; mobile `npm run typecheck`,
    `npm run test:storage` 577/577, `currency:verify`, `regions:verify`, `i18n:check -- --strict`
    (0 errors, 0 stale), `i18n:extract` (no change), `check` (up to date), `export:ios` (5 MB
    bundle); `schema.test.sql` on postgres:17 in a container. CI green on PR #55 (`domain`,
    `mobile`, `mobile_api`). Vercel preview of the branch (SSO-protected, probed with its share
    token): `/`, `/index.html`, `/support.js`, `/sw.js`, `/manifest.webmanifest` → the plain 404
    page; `/api/chart`, `/api/fund-data` → 404 (no function); `GET /api/mobile/{assistant,captures}`
    → 405; `POST` without or with a made-up token → 503 fail closed, no data in the body. No EAS
    build; the iPhone was not modified; no paid service, secret or Vercel setting changed.
  - **Merged** on 2026-09-25 (`f341ab0`); the post-merge CI on `master` passed (run 36146008339:
    `domain`, `mobile`, `mobile_api`).

### Producto 24UX2 — merchant identity and Home refinement (PR #56)

- **Goal.** Better merchant identity and a calmer Home hierarchy without adding modules or
  touching the ledger: an audit of Inicio with incremental fixes; two alternatives for the quick
  actions (A, four actions with less weight, implemented; B, three movements plus a conversational
  Assistant row, documented for the owner's approval); a typed, tested merchant identity layer
  independent of categories with a curated catalogue and exact matching, kept as metadata (brand
  marks deferred to 25C2; the provider review done as its input, nothing connected); recurring states told apart (estimated,
  recorded, paused, history); this roadmap extended.
- **Out of scope.** SQLite, backups, new currencies or regions, the AI, any logo API, report
  calculations, instalments, EAS builds; Home alternative B until approved; the web's
  `merchantRules` (not reintroduced; the native layer suggests no category).
- **Gates.** Typecheck, the SQLite tests, currency and region verification, strict i18n, Expo
  check, the iOS export, root tests and the guard, CI; the visual changes are device QA (§2).
- **Status.** Delivered on this branch (2026-09-25), not device-verified.
  - Domain: `merchants.ts` (`merchantKey`, `MERCHANT_CATALOG` with 35 brands, `AMBIGUOUS_MERCHANT_WORDS`,
    `validateMerchantCatalog`, `merchantIndex`, `resolveMerchant`) and, in `recurring.ts`,
    `recurringOccurrenceOf` and `recurringHistory` (read-only). Tests: 14 merchant, 2 recurring.
  - App: `src/ui/merchant-mark.ts` (`merchantMark`: the category glyph, or the development-only
    initial preview behind `EXPO_PUBLIC_MERCHANT_MARK_PREVIEW`), `MerchantBadge` in `components.tsx` used by
    `EntryRow`, the movement detail, Recurrentes and the upcoming rows; `dueWhen` and `namesAccount`
    in `presentation.ts`; the Registrados section in `recurring-form.tsx`; the Recurrente row in the
    movement detail; the lighter `quick-actions.tsx`; Inicio's single empty sentence and account
    names; the tab bar's secondary inactive labels; new copy in es/en (English reviewed).
  - Docs: docs/merchant-identity.md (model, catalogue criteria, the brand-mark decision and the
    provider review with coverage, licence, attribution, cache, privacy and cost as input for 25C2;
    the future expected/paid/skipped reconciliation),
    docs/mobile-design.md (audit, alternatives A/B, what changed), the device checklist.
  - **Checked on Linux:** root `npm test` 286/286 (was 270: +14 `merchants.test.ts`, +2 recurring
    history), `npm run check:repo`; mobile `npm run typecheck`, `npm run test:storage` 592/592 (was
    577: +4 `merchant-mark.node.ts`, +3 `ui-rows`, +3 `spending-home`, +4 `recovery-routes`, +1
    `home-ranking`; existing Recurrentes, upcoming-row and quick-action tests updated to the new
    captions, labels and sizes), `currency:verify`, `regions:verify`, `i18n:check -- --strict` (0
    errors, 0 stale; English reviewed and accepted), `i18n:extract` (no copy outside the catalogue),
    `check` (up to date), `export:ios` (4,978,057-byte bundle). Figures after the review of PR #56. No EAS build; the iPhone was not
    modified; no SQLite or backup change; no paid service, key, logo API, currency or region enabled.
  - **Review of PR #56:** the recurring history names each row's own account unless every row
    shown is in the rule's current account (a rule moved within its currency, or an occurrence
    corrected onto another account, never reads as the current account's); the bare aliases
    `apple`, `steam`, `adobe` and `despegar` removed and refused as ambiguous, their qualified
    aliases kept; the owner deferred brand display to 25C2, so the logo adapter was removed and the
    category glyph is the production presentation.
  - **Pending:** the device QA of §2. Alternative B was approved by the owner and delivered in 24UX3.

### Producto 24UX3 — Home hierarchy (PR #57)

- **Goal.** A calmer, clearer Home with one focal point, without new modules, navigation targets
  or product scope: the owner's brief asked for a quieter header, a number that breathes, the
  movements as compact pills with the Assistant as its own wide entry below them (24UX2's
  alternative B), three sections that stop repeating one block pattern, quieter section links and
  less competing cobalt.
- **Out of scope.** The data model, SQLite, backups, currencies, regions, recurring logic, report
  calculations, backend/API contracts, logos or remote assets, the Assistant's own screen (no
  focused-composer parameter), Android, EAS builds.
- **Status.** Delivered on this branch (2026-09-25), not device-verified.
  - App: `quick-actions.tsx` (`QuickActions` is three 40 pt pills, shared with account detail;
    new `AssistantEntry`, a 52 pt capsule on `primaryWash` with a hairline cobalt edge, the
    sparkles glyph on a small cobalt disc and "Contale al Asistente" / "Ask the Assistant");
    `components.tsx` (`Choices compact`: 32 pt, ink selected label; `SectionTitle quiet`:
    footnote secondary link with a chevron, 44 pt target); `currency-switch.tsx` (`compact`);
    `palette.ts` (`primaryWash`); `home-modules.tsx` (52 pt summary rows with 32 pt glyphs and
    15 pt text; the upcoming rows as an open agenda with inset hairlines); Inicio's spacing
    (32 pt between blocks, 28 pt above the number) and its 48 pt number. Copy: the two Reportes
    captions under «Dónde más gastaste» and «Para tener en cuenta» removed (one restated the
    title, the other was disclaimer copy); the Assistant quick-action strings replaced by the
    entry's label and VoiceOver hint (English reviewed and accepted).
  - **Owner's iPhone review (same PR):** the card → list → card rhythm on Inicio and the two
    matching slabs in Reportes resolved: `EntryRow plain` makes Últimos movimientos an open ledger
    (64 pt rows, 40 pt marks, signed amounts; the agenda keeps 56 pt rows and 32 pt marks);
    Reportes' «Dónde más gastaste» is an open ranked list (32 pt marks, hairline under the text);
    the compact segment's thumb is a new `thumb` token (#3A3A3E dark) with a hairline edge, the
    chosen label semibold and the others medium; the three-or-more currency chip gets a hairline
    edge; the quiet links' chevron is secondary. The Assistant entry is unchanged.
  - Docs: docs/mobile-design.md (Producto 24UX3), the device checklist.
  - **Checked on Linux:** root `npm test` 286/286, `npm run check:repo`; mobile `npm run
    typecheck`, `npm run test:storage` 596/596 (was 592: +1 `spending-home`, +1 `home-ranking`,
    +1 `ui-rows` for the plain ledger row, +1 `report-routes` for the open merchant list;
    the quick-action test in `motion.node.ts` rewritten for pills + entry; `theme.node.ts` pins
    the wash's and the thumb's contrast in both themes; Home/Assistant route tests updated), `currency:verify`,
    `regions:verify`, `i18n:check -- --strict` (0 errors, 0 stale), `check` (up to date),
    `export:ios` (iOS bundle exported, 5 MB). No EAS build; the iPhone was not touched.
  - **Pending:** the device QA of §2 (checklist, Producto 24UX3). Whether the Assistant entry
    should open the composer focused is a later decision with the Assistant's own delivery (25A).
  - **Merged** on 2026-09-25 (`d5bdcfd`).

### Producto 24UX4 — managing recurring rules and debts (PR #58)

- **Goal.** Native-feeling management of commitments: pause, resume and delete a recurring rule;
  settle, close, reopen and delete a debt tracker; from an iOS trailing swipe on the list row and
  from the detail screen, with a confirmation before anything destructive, and without deleting,
  voiding or rewriting a single recorded movement, payment or collection.
- **Out of scope.** Undo of a deletion (the record is kept, so a later restore is possible, but no
  screen offers it), instalments, cards, budgets, Home and Reportes layouts, Android, EAS builds.
- **Decisions.**
  - *Deletion is a record, not a `DELETE`.* `RecurringRule.deleted` and
    `PersonalDebtProfile.deleted` (a deleted row is never active and never changes again). A debt's
    profile must survive its deletion: it is what keeps its hidden account a debt, so its payments
    keep their «Debo · Juan» side, stay out of Disponible and never turn into a plain account. A
    rule's row survives so an older backup cannot resurrect it: the import sees a conflict, not a
    new rule, and nothing catches up the dates it would have recorded. This is the tombstone the
    future sync needs (rule 9).
  - *Schema 10 is additive* (`ALTER TABLE … ADD COLUMN deleted … CHECK (deleted = 0 OR active =
    0)` on both tables, in the ordinary exclusive transaction); like schema 9 it is one-way: earlier
    builds refuse a schema 10 file, unchanged.
  - *Backup v10 only when needed.* Without a deletion record the file stays v8/v9 byte for byte (the
    goldens are unchanged); with one it is v10 (v9 plus `deleted` on every rule and debt, and
    `currencyUnits` always present). v1–v9 files read every rule and debt as not deleted.
  - *Closing a debt* is the former «Archivar» (`active = false`), renamed and made reachable: closed
    debts are listed under Cerradas, where they reopen or are deleted. Closing a settled debt needs
    no confirmation; closing one with a balance left asks, since it stops showing as pending
    without a payment. *«Saldar»* (mark as paid) opens the reviewed payment or collection form
    with the whole balance typed in; nothing is marked paid without a recorded transfer.
  - *The row's pause switch is gone*: pause/resume is a swipe action and a detail button, so a row
    carries one control surface; the detail's actions write the stored rule, not the draft above
    them, then close the form.
  - *Resuming* never records what fell due while paused: the next date moves along the rule's own
    calendar to today or later (`resumeRecurringRule`, the rule the list already applied).
- **Status.** Delivered on this branch (2026-09-25), not device-verified.
  - Domain: `recurring.ts` (`deleted`, `pauseRecurringRule`, `resumeRecurringRule`,
    `deleteRecurringRule`; a deleted rule refuses any change), `liabilities.ts` (`deleted`,
    `closePersonalDebt`, `reopenPersonalDebt`, `deletePersonalDebt`; `assertTransferSides` refuses a
    new payment into a deleted tracker, historical ones stay editable in place), `recovery.ts`
    (`BACKUP_SCHEMA_V10`, legacy key sets for v4–v9).
  - Storage: `MIGRATE_V10`, `DATABASE_VERSION = 10`, the `deleted` column read, inserted and updated
    by the existing `saveRecurringRule` / `savePersonalDebt` (no new write path, no row ever removed).
  - App: `src/ui/swipe-actions.tsx` (`SwipeRow` over Gesture Handler's `ReanimatedSwipeable`:
    trailing only, 76 pt actions, no overshoot so a full swipe never acts, one open row at a time,
    a tap closes the row first; `swipeAccessibility` gives the same actions to VoiceOver as custom
    actions), `src/ui/commitment-actions.ts` (`useRecurringManagement`, `useDebtManagement`: the
    confirmations, the saves, the haptics and the error), Recurrentes and Deudas rows with swipe
    actions, the rule detail's Pausar/Reanudar and red Eliminar recurrente, the debt detail's
    Cerrar/Reabrir and Eliminar deuda (an `EntryList` footer), Cerradas in Deudas, `amountMinor` on
    the payment form, `palette.ts` (`swipeDestructive`, `swipeNeutral`, `swipeAccent`, white text
    ≥ 4.5:1 in both themes); deleted rules and debts leave every list, deep links and the movement
    and transfer details (which keep showing the movement, without a link). The debt form lost its
    archive button. Copy in es/en (English reviewed and accepted); the backup formats note and the
    version error say v1 to v10.
  - **Checked on Linux:** root `npm test` 297/297 (was 286: +4 recurring pause/resume/delete, +3 debt
    close/reopen/delete and the deleted tracker's payments, +4 backup v10), `npm run check:repo`;
    mobile `npm run typecheck`, `npm run test:storage` 617/617 (was 596: +4 real-SQLite in
    `database.node.ts` (a real schema 9 file to 10, pause/resume through `processRecurring`, a
    deletion keeping every entry byte for byte and surviving backup and an older copy's import,
    a debt tracker's close/reopen/delete leaving accounts, transfers and Disponible unchanged), +4
    `polish-routes`, +5 `liabilities-routes`, +3 `recovery-routes`, +1 `smart-amounts`, +4 new
    `swipe-actions.node.ts`; the Recurrentes switch tests rewritten for the swipe; fixtures gained
    `deleted: false`; the v8→v9 file test compares the v8 columns), `currency:verify`,
    `regions:verify`, `i18n:check -- --strict` (0 errors, 0 stale; English reviewed and accepted),
    `i18n:extract` (no copy outside the catalogue), `check` (up to date), `export:ios` (5,021,900-byte
    bundle); `server/mobile/schema.test.sql` on postgres:17 in a local container (unchanged code,
    passes). No EAS build; the iPhone was not touched; no paid service, currency or region enabled.
  - **Review of PR #58:** both detail screens (rule, debt) remembered whether they had opened on a
    live item with a one-time state initializer, which froze at «not seen» when a cold deep link
    mounted before the ledger hydrated; after the item loaded, deleting it from its own detail could
    flash «not found» before the pop. They now record, keyed by id, that they have *ever* shown the
    item live (updated during render); a link to an already-deleted item is still not found, and a
    deleted item's screen offers no edit, save or restore while it closes. Regression tests cover
    null → live → deleted and a cold link to a deleted item on both screens.
  - **Pending:** the device QA of §2 (checklist, Producto 24UX4). Installing this build upgrades
    FinanzApp Dev's ledger to schema 10 (additive, one-way): export a backup first.
  - **Merged** on 2026-09-25 (`dfa1fc8`); CI green on the merge commit.

### Producto 24UX5 — final visual consistency, copy and recurring audit (PR #59)

- **Goal.** Finish the direction the owner approved on the iPhone in 24UX3 without a redesign: a token for
  secondary links, one mark size across Inicio's two lists, a Home-only row presentation with less text,
  shorter copy in es/en, a lighter Reportes, Más as a settings screen, and the recurring behaviour pinned
  by tests, including the states the screenshots never showed.
- **Out of scope.** Any new Home module or card (debts stay off Inicio), a schema or backup change,
  background tasks, bank connections, FX, notes on expenses/incomes, EAS builds, 24R2.
- **Recurring audit (what the code did, what the tests now pin).** `tests/recurring-audit.node.ts` runs
  against a real SQLite file: an active rule records on open (`openLedger`) and on every return to the
  foreground (`refreshLedger`, the two paths LedgerProvider takes); a date that passed while the app was
  closed is recorded with the due date; expenses and incomes both; five opens and foregrounds never record
  twice; pausing then resuming never records the paused dates; deleting never records again and keeps the
  recorded history; weekly, monthly and yearly calendars across month ends, a leap day, the turn of the
  year and an open several days late; the 366-date boundary and backlogs of 367 and 733 dates recorded in
  full; an interruption between batches; a backlog replayed over edited and undone occurrences; the per-launch
  step bound; an old backup restored years later. Nothing runs while the app is closed: the catch-up happens
  on the next open or foreground, dated on the due day.
- **Found and fixed.**
  - *One rule could keep every screen closed.* `recurringOccurrencesThrough` throws past 366 pending dates
    (a weekly rule untouched for seven years, an old restore), and `processRecurring` ran every rule in one
    transaction whose failure made LedgerProvider show «No pudimos abrir tus datos» on every launch.
    **Final implementation (after the review of `2a04d76`, owner's decision: automatic, nothing dropped):**
    `catchUpRecurring` records any backlog automatically in **batches** of at most `RECURRING_BATCH_SIZE`
    (366) dates per rule (`recurringDueBatch`, `materializeRecurringRule(…, limit)`), oldest first, each date
    with its original due date and deterministic id. Each batch is one exclusive transaction (movements and
    the rule's advance together), so an interruption keeps the batches already written and the next launch
    resumes from the saved next date, never duplicating (an id already in the ledger, edited, moved or undone,
    counts as recorded). A normal catch-up (a few days) is one batch, as before. One launch runs at most 64
    batches (about 23,000 dates per rule); a rule still behind continues on the next launch or foreground.
    Memory per batch is bounded by the batch, not the backlog. Materialization is isolated per rule: a rule
    whose dates cannot be materialized (a real failure; no known input reaches it) is left unchanged and
    reported, the others are recorded. A rule that fails validation is refused earlier by `readArchive` (as
    before). `openLedger`/`refreshLedger` (`src/storage/ledger-session.ts`) never let the catch-up fail an
    open: a failing batch rolls back alone, the earlier ones stay, and the existing «No pudimos verificar…»
    banner shows over the open app. Only a rule left behind by a real failure reads «Revisar» in Recurrentes
    (`recurringNeedsReview`; it used to say «Hoy»), with «Continuar desde hoy» (`resumeRecurringRule`) as the
    person's explicit choice.
  - *Recurrentes crashed on the same rule.* `recurringForecastByCurrency` walked each rule's whole backlog
    with the 366 guard during render, so the screen threw exactly when a rule was far behind (review thread
    on `recurring.tsx`). The projection now counts only dates inside its window
    (`recurringOccurrencesBetween`: past dates are walked, never collected) and leaves out, per rule, one it
    cannot read; the other rules stay listed. A rendered-screen test covers a rule 800+ dates behind beside a
    normal one.
  - *An edited occurrence could also block the app.* A rule moved back onto a day it had already recorded
    (the price changed: edit today's movement, then the rule with a new amount and today's date) threw «Un
    vencimiento recurrente coincide con otro movimiento distinto» inside the same catch-up, on every launch.
    The occurrence id is the rule and the date, so an id already in the ledger *is* that occurrence: it now
    counts as recorded whatever the person did to it (edited, moved, undone), is never recorded twice and
    never stops the catch-up. The retired error string left the catalogue.
- **Three words, three facts** (copy and docs): a movement **recorded by FinanzApp** (a normal movement it
  adds when the date arrives and the app opens), a **bank payment or collection** (never confirmed or
  executed by the app), and the **next due date** (an estimate). The Recurrentes empty state, the form's
  note and the Registrados caption now say so; nothing claims a local rule pays money or runs on time with
  the app closed.
- **Decisions.** Link token `link` #4A6390 / #8EA7D8 (measured contrast, desaturated, apart from the cobalt
  and the transfer azure) on Inicio's quiet links only. Home rows via an explicit `variant="home"`; the
  category returns to a caption for short, letterless or generic names and for glyphs shared on screen
  (`homeNamesCategory`, `sharedGlyphs`), the account only when a list's visible rows come from two accounts
  (`visibleNamesAccount`, review of PR #59). «Where your money
  went» → «By category»; «En qué gastaste», «Próximos compromisos» and «Últimos movimientos» kept (natural,
  wrap instead of truncating). Reportes' methodology behind an `InfoButton`; «Tu mayor gasto» dropped only
  when the ranking shows that same single purchase (`insightsBesideRanking`). Más: a version line, the
  diagnostics only in `__DEV__`. `IconButton` 44 × 44. Details in docs/mobile-design.md (Producto 24UX5).
- **Status.** Delivered on this branch (2026-09-25), not device-verified.
  - **Checked on Linux:** root `npm test` 299/299 (was 297: +2 `recurringNeedsReview`; the backup version
    error's wording updated in its test), `npm run check:repo`; mobile `npm run typecheck`, `npm run
    test:storage` 643/643 (was 617: +13 new `recurring-audit.node.ts` on real SQLite, +3 `spending-home`
    (row captions, accounts and link targets, the composition with no/one/several accounts, two
    currencies, 3+ categories, an exceeded general budget, active/paused/deleted rules, a 13-digit amount
    and a currency switch), +2 `presentation` (search fields; `homeNamesCategory`/`sharedGlyphs`), +2
    `report-routes` (the insight rule, the information button), +1 `home-ranking`, +2 `theme` (the link
    token in both themes; `appearance.node.ts` imports its contrast helper and so runs them again: +2
    there), +1 `more-routes` (a release build shows no diagnostics); existing Home, rows, Más and report
    tests updated), `currency:verify`, `regions:verify`, `i18n:check -- --strict` (0 errors, 0 stale;
    English reviewed and accepted), `i18n:extract` (no copy outside the catalogue), `check` (up to date),
    `export:ios` (iOS bundle exported, 5 MB); `server/mobile/schema.test.sql` on postgres:17 in a local
    container (unchanged code, passes). No EAS build; the iPhone was not touched; no schema change.
  - **Review of PR #59** (owner's iPhone screenshots): the Reportes heading read «Septiembre De 2026» (a
    style-level `capitalize`); `formatMonthTitle` now raises the first letter only, also in Presupuestos, its
    form and the long date of the movement and transfer details. The period line no longer repeats «· ARS»
    (the chip and «Gastado · ARS» name it; the category detail keeps it). Home rows repeated «· a ·» when two
    ARS accounts were owned but every visible row was in one: each Home list now names accounts only when its
    visible rows come from more than one (`visibleNamesAccount`), Próximos compromisos independently; «f» and
    «aa» keep their category; VoiceOver on an upcoming row always says the account. The per-rule confirmation
    mode was removed from 25C2 and docs/merchant-identity.md: recurring rules stay automatic. Checked:
    mobile `test:storage` 647/647 (+1 `report-routes`, +1 `reports`, +1 `presentation`, +1
    `recurring-audit`; the Home account test rewritten for the visible-rows rule), root `npm test` 299/299,
    `check:repo`, `typecheck`, `currency:verify`, `regions:verify`, `i18n:check -- --strict`, `i18n:extract`,
    `check`, `export:ios`.
  - **Review of `2a04d76`** (two review threads): Recurrentes no longer crashes on a rule far behind (the
    forecast counts only its window, per rule, defensively), and a backlog past 366 dates is recorded
    automatically in durable batches with its original dates instead of being set aside (details above).
    Checked: root `npm test` 302/302 (+3 `recurring.test.ts`: batches, materialization to completion, the
    windowed forecast), mobile `test:storage` 653/653 (+5 net in `recurring-audit.node.ts` on real SQLite:
    the backlog recorded in full, 366/367/733, an interruption between batches, a replay over edited and undone
    occurrences, the per-launch bound, an ordinary 3–11-day late opening, an old backup restored years later;
    +1 `polish-routes`: the rendered Recurrentes screen with a stale and a normal rule, which fails on the
    previous code), plus every other gate below.
  - **Pending:** the device QA of §2 (checklist, Producto 24UX5).

### Producto 24R2A — regions integrated, native choosers, formats for every family (PR #60)

- **Goal.** Everything a region needs, integrated and tested for all 257 catalogue regions, with the
  release gate unchanged: Spanish and English, Argentina and the United States stay the only published
  values; every other region is a development preview until its family passes the iPhone QA of 24R2B.
  Language, region and each account's currency stay three independent preferences.
- **Delivered.**
  - *The registry derived from the catalogue* (`src/i18n/locale.ts`): `RegionCode` is the catalogue's
    257 codes; `REGIONS` is built from `regions/data.ts` (CLDR 48.2.0) with the hand-written
    `REGION_REGISTRY` (Argentina and the United States, 23.1) winning field by field, so AR/US write
    byte-identical strings (Argentina's 24-hour clock stays the one deliberate deviation; the generator
    now checks the registry, not the derived map). `AppLocale` covers every language × region pair.
    `registryRegionOf` (the ledger's "5/09") is limited to the registry.
  - *The gate and the preview*: `RELEASED_REGIONS = ['AR', 'US']` unchanged; `PREVIEW.regions` is the
    whole catalogue, reachable only in a development bundle started with `EXPO_PUBLIC_LOCALE_PREVIEW=1`
    (a release bundle compiles the flag away; the export contains no `LOCALE_PREVIEW`).
    `src/i18n/region-release.ts` holds the release plan: ten stages by convention family (the
    released `home` stage, then Spanish-speaking regions, UK/Canada, Brazil, Japan, India, Germany,
    Switzerland, France's narrow space, Poland/Portugal's space with minimum grouping two), covering the
    eight number families of the catalogue; a test keeps `RELEASED_REGIONS` equal to the stages marked
    released, so opening a stage is one commit after its evidence.
  - *Device and preferences*: "Según el dispositivo" reads iOS's Region setting (expo-localization's
    `regionCode` is `Locale.current`'s region), never a language, never a second language, never a
    location (a test scans for location APIs). A manual choice is saved before it is applied and wins.
    A region chosen in the preview is **kept** by a release build (`regionPreferenceFrom` accepts any
    catalogue code), never applied or overwritten; formats fall through to the device, then Argentina;
    Más says «Japón · formatos de Estados Unidos» and Región lists it, checked, «Todavía no disponible en
    esta versión · formatos de …»; it applies by itself once released (`pendingRegionChoice`).
  - *Choosers*: Más → Idioma and → Región are `ChoiceScreen` (`src/ui/locale-choosers.tsx`,
    `LocaleChooser` with an `onChosen` for the onboarding): «Según el dispositivo» pinned; a short list
    (two languages, two regions) is one grouped card; from six options a search field (name, alpha-2,
    alpha-3, numeric code, currency; accent-insensitive), the last three choices and alphabetical
    sections; autonyms spoken in their own language; header rows with the header role; one virtualized
    list, no fixed row height (Dynamic Type). `locale-preference.tsx` was removed.
  - *Formats and the amount field*: one grouping rule (`src/i18n/grouping.ts`) for the formatters and
    `money-input.ts`: lakh/crore, minimum grouping two, and any one-character group (point, comma,
    apostrophe, no-break or narrow no-break space). Typing keeps the caret on its digit; a backspace over
    any group separator removes the digit before it; either pad key is the decimal; a paste reads lakh,
    apostrophes and spaces as grouping only, Arabic-Indic, Eastern Arabic-Indic and full-width digits as
    the same digits, and still refuses a lone separator before three digits that is not the region's
    group. A region change mid-edit keeps the draft (ledger notation) and the logical caret.
- **Not changed.** SQLite, backups, accounting rules, enabled currencies, FX, the Home and Reportes
  design, any language (es/en only), `supportedLocales`, the bundle identifier. No new dependency.
- **Status.** Merged (PR #60, 2026-09-25), not device-verified.
  - **Checked on Linux:** mobile `npm run typecheck`; `npm run test:storage` 669/669 (was 653: +15 new
    `regions-integration.node.ts` — the derived registry, grouping, 14 language × region goldens,
    every region × both languages, typing per family, the caret around a group, pasting, the 257-region
    display→paste round trip and draft round trip, a region change mid-edit, the device Region, the
    kept preview choice, the combinations, the choosers, recents, the release plan; +1 `locale-switch`:
    the real `AmountField` under the real provider across India, Switzerland, France and a device
    change to Poland; the chooser, gate and registry tests updated); `currency:verify`, `regions:verify`,
    `regions:generate -- --check`, `currency:generate -- --check`, `i18n:check -- --strict` (English
    reviewed and accepted), `i18n:extract`, `check`, `export:ios` (5 MB, no `LOCALE_PREVIEW`); root
    `npm test` 302/302 and `npm run check:repo`. No EAS build; the iPhone was not touched.
  - **Review of PR #60:** `ChoiceScreen`'s list is now the screen's scroll view with the project's inset
    mechanism (`contentInsetAdjustmentBehavior="automatic"`, `automaticallyAdjustKeyboardInsets`, interactive
    keyboard dismissal, as `Screen` and the activity list): the navigation bar, the home indicator and the
    keyboard no longer cover the last region, the error or the footnote. `LocaleChooser`'s `onChosen` also
    fires when the checked value is tapped (`ChoiceScreen.onConfirm`), writing nothing, so the onboarding
    can continue with it; Más passes no `onChosen` and stays inert. Checked: mobile `test:storage` 671/671
    (+1 `choice-list`: insets and confirmation; +1 `locale-switch`: the real chooser confirms without a write,
    re-render or recent, Más stays inert), typecheck, `i18n:check -- --strict`, `i18n:extract`,
    `currency:verify`, `regions:verify`, `regions:generate -- --check`, `check`, `export:ios`; root `npm test`
    302/302, `check:repo`.
  - **Pending:** the device QA of §2 and the checklist section Producto 24R2A.

### Producto 24R2B — international regions released (PR #61)

- **Goal.** Use every catalogue region's conventions in the published app, faster than one delivery per
  region, without risking an amount: 234 of the 257 regions released in one PR, by continent, on automated
  per-family evidence; the rest blocked with a named reason.
- **Audit and fixes (formats).** The catalogue records what FinanzApp writes as numeric templates
  (`datePattern`, `dayMonthPattern`, `timePattern`, from CLDR's short date and its Md and Hm skeletons):
  - *spaced dates and closing periods* (Korea «2026. 9. 22.», Hungary «2026. 09. 22.», Croatia, Serbia,
    Bosnia, Montenegro, Slovakia, Slovenia) are written as CLDR writes them, spaces as no-break spaces,
    and a date ending in a period is followed by the time after a space, not «, »;
  - *the time separator* is the region's (Finland, Denmark, Indonesia, Sri Lanka, Greenland write «9.03»),
    and *the 24-hour hour* is unpadded where CLDR says so (Spain, Czechia, Japan: «9:03»);
  - *words in another script* are dropped with their period (Bulgarian «г.», «ч.», Thai «น.»): the words
    follow the interface language;
  - *the day and month* come from CLDR's Md («5.9.» in Germany, «9/5» in Japan) except where the locale
    inherits an order that contradicts its own date (Ghana, Niger, Eritrea, Somalia, Malta inherit «M/d»
    from English beside a day-first date): there the short date without its year is written, so «9/5» can
    never be read the wrong way round.
- **Stages** (`src/i18n/region-stages.ts`, derived from the catalogue): `home` (AR, US; device evidence,
  23.1C2), `americas` 55, `europe` 53, `asia` 34, `africa` 56, `oceania` 34 (automated evidence, 24R2B,
  continents from CLDR's territoryContainment, now a pinned generator source), and `native-digits` 23
  **blocked**. `RELEASED_REGIONS` is the released stages (234); a test keeps every region in exactly one
  stage and the continent stages exactly their continent.
- **Pending and why.** Afghanistan, Bahrain, Bangladesh, Bhutan, Chad, Comoros, Egypt, Iran, Iraq, Jordan,
  Kuwait, Lebanon, Mauritania, Myanmar, Nepal, Oman, Palestine, Qatar, Saudi Arabia, South Sudan, Sudan,
  Syria and Yemen: CLDR's default digits for their locale are Arabic-Indic, Eastern Arabic-Indic, Bengali,
  Devanagari, Burmese or Tibetan. What the iOS decimal pad offers there is an unverified hypothesis (Latin or
  native digits, possibly following iOS's own Numbers setting; which decimal key). `latinDigits` reads only
  Arabic-Indic and Eastern Arabic-Indic digits (Node tests); Bengali, Devanagari, Burmese and Tibetan digits are
  not normalized, so a paste of them is refused and typing them enters nothing (pinned by a test). Each numbering
  system opens separately after its normalization, its tests and an iPhone check of its pad
  (docs/region-families.md §4 lists the six systems and where to check each). Until then they write Argentine
  formats and say so; a person there can still choose any released region manually.
- **Automated evidence** (`tests/region-families.node.ts`, every released region × es/en): the amount field
  types exactly what the formatter writes with either pad key, keeps the caret, deletes across the group
  separator, pastes the formatter's output back to the same minor units and refuses the ambiguous
  «1{decimal}000»; yen keeps no decimals; VoiceOver is ungrouped in the language's mark; dates, day-month
  and the clock read back to the same numbers through the region's templates; a day-month never
  contradicts its date; the choice is saved first, survives a relaunch and beats the device; the initial
  region comes from the device; no ledger, account or display-currency code reads the region. The iPhone
  sheet `docs/region-families.md` is generated from the same code (`npm run regions:families`) and a test
  fails when it is stale.
- **Deliberate, documented writings** (docs/i18n.md §11a.7): Latin digits everywhere, a four-digit year,
  the currency symbol before the amount, the day period after the time in the interface language, the
  Gregorian calendar.
- **Not changed.** SQLite, backups, accounting, enabled currencies (ARS, USD), FX, languages (es, en), the
  Home and Reportes design, native configuration. No new dependency.
- **Status.** Merged (PR #61, 2026-09-25), not device-verified.
  - **Checked on Linux:** mobile `npm run typecheck`; `npm run test:storage` 677/677 (was 671: +5
    `region-families.node.ts`, +1 `regions-integration` date audit; the gate, chooser and catalogue tests
    updated to the released stages, the two-region chooser tests pinned to the 23.1C2 gate explicitly);
    `regions:verify`, `regions:generate -- --check`, `regions:families -- --check`, `currency:verify`,
    `i18n:check -- --strict`, `i18n:extract`, `check`, `export:ios`; root `npm test` and `check:repo`.
    No EAS build; the iPhone was not touched.
  - **Pending:** the checklist section Producto 24R2B before the first TestFlight; per numbering system,
    the normalization of `beng`, `deva`, `mymr` and `tibt`, the tests, and the iPhone check of all six.
  - **Review of PR #61:** the claim that the amount field reads every blocked region's digits was wrong
    (only `arab` and `arabext`); the docs, the blocker text and the PR now say so, the iPhone pad is a
    hypothesis to verify, the plan is per numbering system, and a test pins today's normalization per
    system. The region-QA strategy is described as provisional, not as the owner's authorization.

### Producto 24C1 — consolidated multicurrency finances (this PR)

- **Goal.** Accounts in different currencies and one chosen currency to see the total money and all spending,
  converted automatically in the views only; the owner's simplified model of 2026-09-25 (docs/currency.md §2.8).
- **Delivered.** `packages/domain/fx.ts` (exact rational conversion, rounding once half away from zero, USD-pivot
  cross rates with both legs of the same day, a rate book with a 7-day age limit, a consolidated ledger per target
  with each movement at its own date's rate and the unconverted ones listed, balances converted at the day's
  rate); Frankfurter v2 chosen after the provider review (§8.2: all 146 + 7 currencies covered, daily history,
  free for commercial use, no key; ECB lacks ARS, Open Exchange Rates is paid for this use, ExchangeRate-API has
  no history on its free endpoint); a separate rate cache on SQLite (`finanzapp-rates-v1.sqlite`, schema 1;
  provisional same-day rates replaced, final ones never rewritten) and a request policy (cache first; one
  request per month and missing quotes; final months never again; 6 h refresh of the running month; 60 s back-off
  after a failure; nothing when nothing needs converting); the display mode `finanzapp.displayMode`
  (`consolidated` for new installations; a device with a 24B6 display currency keeps `single`, written once);
  Inicio (same composition; the chip now always present, "EUR" or "Solo EUR", opening one sheet: Total
  consolidado · Ver solamente una moneda · Moneda de visualización; an info button with source and date; per-
  currency subtotals and the reason when a rate is missing), Reportes and its drill-downs, Presupuestos (budgets
  measured against the consolidated spending in their currency), es/en copy.
- **Not changed.** The ledger (schema 10), backups v8–v10, accounts' and movements' amounts and currencies, the
  146 + 7 currencies, every form, transfers (still one currency), the Assistant (contract v1, it receives the
  display currency as before), navigation, Inicio's design.
- **Status.** Delivered on this branch (2026-09-25), not device-verified.
  - **Checked on Linux:** root `npm test` 318/318 (+15 `packages/domain/fx.test.ts`); mobile `npm run typecheck`,
    `npm run test:storage` 718/718 (+18 `tests/fx-rates.node.ts`: the provider adapter with a stub, the cache on
    real SQLite, the request policy, offline and failing caches, the preference transition, consolidated figures in
    ARS, USD, EUR and JPY, negative balances, stale and missing rates; +5 route tests in `spending-home.node.ts`
    and `report-routes.node.ts`: Inicio and Reportes consolidated, a past month at its own dates, the drill-down
    rows' original amounts, subtotals without a rate, no request for a one-currency ledger; the 24B6 harnesses
    now run in `single` mode and use the new chip), `currency:verify`, `regions:verify`, `i18n:check -- --strict`,
    `i18n:extract`, `check`, `export:ios` (Hermes bundle 5,117,746 bytes). The live API was read on 2026-09-25 for
    the review only; tests use a stub provider and fixed rates. No EAS build; the iPhone was not touched.
  - **Pending:** the checklist section Producto 24C1 before the first TestFlight; the privacy policy naming the
    rate provider (Producto 26).

### Producto 24M — global currency release (PR #62)

- **Goal.** Every ISO 4217 fiat currency that is really ready, in one delivery grouped by exponent, without
  risking an amount.
- **Audit** (docs/currency.md §2.7): 178 codes; 153 ready fiat, 2 incomplete (SVC, VED), 23 excluded (funds,
  metals, units of account, XTS, XXX). Ready by exponent: 2 (130, of which 15 are shown without decimals), 0 (16),
  3 (7). No two fiat currencies share a root symbol.
- **Delivered.** `LEDGER_CURRENCIES` 146: ARS, USD and **144 new** currencies (128 with two decimals, 16 without),
  written out and compared with the catalogue by a test. The **seven three-decimal currencies** (BHD, IQD, JOD, KWD,
  LYD, OMR, TND) are **held** (`HELD_CURRENCIES`): VoiceOver reads "1234,567", which a voice reading the mark as a
  thousands separator would speak a thousand times larger; they open after the iPhone check below, in their own
  commit, and are what the development preview adds. New account, card, debt and budget offer the 146 through the
  searchable sheet (code, localized name, symbol, numeric code, country), ARS and USD first, then by name in the
  interface language; the list is windowed, insets for the keyboard, and each form builds it once per gate and
  language. Inicio and Reportes keep one currency at a time (the display-currency switch over the currencies held);
  nothing is converted or summed.
- **Not changed.** SQLite 10, backups (v8 bytes for ARS/USD-only ledgers, v9/v10 otherwise), `currency_units`,
  accounting rules, ARS/USD goldens, language and region, FX (24C), the Assistant (contract v1, ARS/USD only; with
  another display currency it does not send and says it is not available; 25A). The default currency of a new
  account stays ARS.
- **Status.** Delivered on this branch (2026-09-25), not device-verified.
  - **Checked on Linux:** root `npm test` 303/303 (+1 the 24M gate against the catalogue; gate tests updated);
    mobile `npm run typecheck`, `npm run test:storage` 695/695 (+17 `currency-release.node.ts`: eleven currencies
    across exponents 0/2/3 and display digits 0/2 through every flow on real SQLite — accounts, movements, edit,
    undo, a negative balance, transfers and a refused cross-currency transfer that writes nothing, a card purchase
    and payment, a debt payment, general and category budgets, a recurring rule recorded and deleted, Home and
    Reportes totals per currency, backup v10 export and restore with the tombstone and the pinned scale — the
    limits per exponent, rounding, symbols, the eight regional number families in both languages, the chooser
    order; the gate, sheet, form and preview tests updated), `currency:verify`, `regions:verify`,
    `i18n:check -- --strict`, `i18n:extract`, `check`, `export:ios`. No EAS build; the iPhone was not touched.
  - **Pending:** the checklist section Producto 24M before the first TestFlight; the three-decimal commit after its
    VoiceOver evidence.

### Producto 24R3 — the 23 native-digit regions (before the international launch)

- **Goal.** Release the regions whose locale defaults to non-Latin digits (AF, BD, BH, BT, EG, IQ, IR, JO, KM, KW, LB,
  MM, MR, NP, OM, PS, QA, SA, SD, SS, SY, TD, YE), one numbering system at a time, before FinanzApp is launched outside
  its first regions. Not enabled by 24M.
- **Scope** (docs/region-families.md §4): per system (`arab`, `arabext`, `beng`, `deva`, `mymr`, `tibt`) the
  normalization in `latinDigits` (today only `arab` and `arabext`), its tests (typing, pasting, caret, refusal of
  mixed text), and the iPhone check of what the decimal pad really offers (Latin or native digits, with iOS's Numbers
  setting both ways, and which decimal key), VoiceOver included; then the `native-digits` stage splits by system and
  each opens in its own commit.
- **Out of scope.** Writing non-Latin digits (the interface languages are Spanish and English), right-to-left layout.
- **Depends on.** 24R2B (merged).

### Producto 24C2 — international purchases (optional)

- **Goal.** A purchase priced in one currency and paid from an account in another, recorded once, per
  docs/currency.md §9: the account debited in its own currency, the original amount and currency kept as
  information, pending (estimated with 24C1's rates) and confirmed (the bank's figure) kept apart, fees and
  taxes once, the manual adjustment only in the detail.
- **Out of scope.** Bank debits read from any source; instalment plans (24T); trading; changing 24C1's views.
- **Gates.** The owner decides whether it is needed; schema and backup changes reviewed first; no paid
  service.
- **Depends on.** 24C1 (rates, cache and views).

### Producto 25A — the real Assistant: multilingual, voice, analytical questions, drafts and confirmation

- **Goal.** The Assistant becomes the central capability, not a decorative page: it proposes
  movements and edits as drafts, asks the minimum, answers analytical questions with verifiable
  figures from the ledger, in the released languages and by voice.
- **Scope.** Request contract v2 (docs/i18n.md §11: `locale` as two codes, language-neutral
  facts; the server accepts v1 and v2, the app sends v2 only where deployed) and the currency
  contract of docs/currency.md §11 ("Gasté 30 dólares en Steam": merchant, amount and currency
  read by the model, the category matched to the person's own identities, the paying account
  decided by the app with one question when several fit, a foreign purchase proposed when no
  account holds the currency, the rate looked up by the app never the model; "¿Por qué gasté
  más este mes?": aggregations the code computed, never a causal claim); understanding a message
  in any language and answering in the interface language, names and custom categories kept
  verbatim; a transcription provider with proven multilingual coverage before voice is offered,
  with explicit microphone permission, limits and deletion; edit-and-modify drafts (change an
  existing movement through a draft, same confirmation); the cost and abuse controls before the
  first paid call (per-model cost evaluation with owned data, daily and monthly limits per user
  shown before they are hit, a token budget per request and conversation with a hard stop,
  provider quotas mapped to graceful states, per-user and per-device rate limits, request
  signing, anomaly cut-offs, the owner's kill switch, a monthly spend ceiling with alerts);
  staging Supabase, mobile sign-in and cloud-data consent (no login for the local core); the
  scoped, revocable Shortcut pairing token; the durable inbox → local review tray →
  acknowledgement path with repeated-delivery and conflict tests.
- **Rules.** Never a financial write without the person's confirmation; complete and ambiguous
  messages alike become drafts; owned account/card mappings only pre-fill; explanations cite
  facts and disclose partial records.
- **Out of scope.** Automatic capture without consent; bank access; any paid call before the
  owner configures and approves the provider account.
- **Gates.** An evaluation set of real phrases (written by the owner, anonymised, no real ledger)
  and deliberately ambiguous ones ("pagué 30 en el super", "lo de Juan", "la cuota", a merchant and
  a category with the same name, two accounts that fit, a currency never held) with the expected
  draft or clarification for each, run and recorded before every model or prompt change; accuracy,
  clarification rate and wrong-write rate (must be zero: every write is confirmed) reported;
  owned test data for currencies, loans, refunds, questions and failures; measured provider usage
  and cost per request; the disconnected and
  quota states on the iPhone; the consent screen naming what travels.
- **Depends on.** 24C1 for rates and consolidated facts, 24C2 for foreign purchases; 24M for currencies in v2; a session
  provider (staging) the owner sets up.

### Producto 24T — instalments and complete cards

- **Goal.** A financed purchase is one expense and one finite obligation plan.
- **Scope** (design reviewed before code): the plan records the number of instalments, the
  total, principal, interest and fees (each with its own category, so interest is never
  consumption); distributes the cents exactly at the currency's precision (integer minor units,
  the remainder on named instalments, the sum proven equal to the total); ties each instalment
  to the statement it closes in and the due date it is paid on; real closing and due dates per
  statement; short months, leap years and the issuer's rules (last-day closings, a due day
  before the closing day, weekend and holiday shifts as stated); per-period summaries, pending
  balance and partial payments; early payments, cancellations, refunds and adjustments without a
  second expense; refunds of any purchase (card or cash) linked to the original movement (lowering
  the category for the refund's month, and the card's debt when paid by card, never an income;
  a partial refund keeps the rest; the link survives edits, undo and backups); international instalment purchases with the rate
  of each debit (24C2's record, provenance on every converted figure); optional reminders for
  closings, due dates and instalments that never claim a bank did not receive a payment; a
  clearer card form with a real calendar for closing and due days.
- **Rules.** Never duplicate an expense through a recurring rule; scheduled is not paid; the
  purchase is counted once in reports and budgets.
- **Out of scope.** Bank statements, disputes, freezing a card, FCI redemptions.
- **Gates.** Domain tests first: cent distribution for exponents 0, 2 and 3, cycle assignment
  across year ends and February, early payment against later instalments, refund against a
  partly paid plan; schema and backup versions with a rollback test; Tarjetas and Deudas on the
  iPhone.
- **Depends on.** 24C1 for the rates of international instalments (a same-currency plan could
  land first if the owner prefers).

### Producto 25B — global onboarding and preferences

- **Goal.** A first launch anywhere: language, region, the main currency and an optional first
  account, nothing seeded.
- **Scope.** The first-launch flow reusing `ChoiceScreen` (language and region detected and
  shown, changeable, "Según el dispositivo" available), the first account's currency chosen from
  the catalogue (the region may suggest, the person decides; an existing account's currency never
  changes), the display currency (24C1) as its own step, skippable, existing users' data and
  preferences untouched; Más → preferences consolidated (Idioma, Región, Apariencia, currency,
  reminders when they exist).
- **Out of scope.** Any account requirement, telemetry, a paywall.
- **Gates.** A fresh install and an upgrade on the iPhone, both languages, VoiceOver through the
  whole flow, nothing written until the person finishes.
- **Depends on.** 24R2B (regions), 24M (currencies); 24C1 for the display-currency step.

### Producto 25C — budgets with rollover, goals, CSV and productivity

- **Scope** (the owner's ordered backlog): rollover budgets (unused budget carried to the next
  month, explicit and reversible); financial goals (target, date, progress from recorded
  movements; no simulated returns); split expenses and free tags (never replacing the category);
  CSV import with a reviewed draft before anything is written and categorisation rules that only
  pre-fill; reports and search improvements (account and custom-period filters, saved
  searches); legacy web import as an optional, previewed importer. **Searchable notes on expenses and
  incomes** (24UX5 audit): today only a transfer carries a note, and the search reads merchant, category
  (stored and localized) and account; a note on an `Entry` needs a schema and backup version, the form field,
  the detail row, indexing in `selectEntries`, the Assistant's evidence (never sent without consent) and
  its VoiceOver order.
- **Rules.** Every write through the validators; imports are drafts; no invented balances.
- **Gates.** Domain tests per feature; schema/backup version bumps with rollback tests; the
  import preview on the iPhone with the owner's own CSV.
- **Depends on.** Nothing outside 24M for currencies in imported rows.

### Producto 25C2 — merchants, categorisation rules and commitments history

Ordered after 25C and before 25D (its widgets read these records). Design in
docs/merchant-identity.md.

- **Scope.** Brand marks, deferred here by the owner (2026-09-25): before any code, resolve the
  licence (each brand's or a provider's terms), privacy (nothing about a person's merchants leaves
  the device without consent; no key in the bundle), maintenance (keeping marks current,
  correcting a wrong one) and visual coherence with the category hues and semantic colours, using
  the review in docs/merchant-identity.md §4; then the chosen source, attribution where required,
  an on-device cache, a switch to turn marks off; recognized brands only, the category glyph on any
  failure; catalogue growth by reviewed PRs. Local categorisation
  rules: a merchant key pre-fills the category the person chose before, only pre-fills, visible and
  editable in Categorías, never rewrites a stored movement. Suggested recurring detection: the same
  merchant key, account, currency and amount repeating at a regular interval proposes a rule the
  person confirms; nothing is created silently. A calendar of commitments read from the rules and the
  movements they already recorded, per currency, never summed across currencies. **Recurring rules stay
  automatic** (owner's decision, review of PR #59): expenses and incomes are recorded on their date (on
  launch or foreground when the app was closed); managing a rule is pause, resume and delete only. No
  per-rule confirmation mode, expected-occurrence state or reconciliation screen is planned. Reviewing
  drafts belongs to the Assistant's captures, a separate workflow.
- **Rules.** The typed name stays; the category stays the classification; no ambiguous match; a
  scheduled payment is never a movement; no connection to a merchant or a bank is implied.
- **Gates.** Domain tests (matching, suggestions never applied without confirmation, the calendar
  per currency), schema and backup versions with rollback tests if any record is added, the history
  and calendar on the iPhone with VoiceOver and large text.
- **Depends on.** 24UX2 (merged); the owner's decision on the brand-mark source after the four
  questions above.

### Producto 25D — Face ID, notifications and Apple integrations

- **Scope.** Face ID with the device-passcode fallback, background privacy and Apple file
  protection reviewed (a Face ID prompt does not encrypt SQLite); local reminders opt-in with
  time zone, deduplication and no amounts by default (card closings and due dates, upcoming
  recurring payments, instalments); the Apple Pay/Wallet transaction trigger through a
  Shortcut/App Intent producing drafts only (available fields, missing amount, duplicates,
  offline catch-up and cancellation verified on the iPhone without bank execution); App Intents
  and Apple Shortcuts ("registrar un gasto", "¿cuánto gasté este mes?", each a draft or a read);
  widgets of upcoming payments and of the month's spending that hide amounts by default and read
  the 25C2 commitments; Apple sign-in; each permission requested only when its
  feature is enabled.
- **Out of scope.** FinanceKit (not available for Argentine cards), any bank credential.
- **Gates.** Signed development build evidence per integration; denied-permission paths; the
  private-content default checked on the lock screen.
- **Depends on.** 25A for the capture path (tray and pairing token).

### Producto 25E — optional sync and privacy

- **Scope.** Optional normalized Supabase sync: an outbox with durable operation IDs, revisions,
  tombstones, conflict handling, RLS and user/session isolation; data export, deletion and
  recovery; provider privacy and retention documented; no mandatory account for local use; the
  consent screen; the web's last-write-wins JSON snapshot is not reused as a sync engine.
  Authorised bank connections only through official, consented access where it exists (open
  banking APIs or an aggregator with a contract), read-only, each import a reviewed draft; none
  exists today and none is implied.
- **Gates.** Two devices with conflicting edits, an offline queue replayed once, a deleted row
  staying deleted, a restore after reinstall; RLS proven with a second user.
- **Depends on.** 25A's session provider; decision 001's data and security target.

### Producto 25F — monetisation, StoreKit and AI cost control

- **Scope.** Premium AI with per-user quotas, server-side cost ceilings (per request, per
  person, global), consumption telemetry (usage and cost, not content) and margins calculated
  from measured costs before any price; StoreKit subscriptions with restore, receipts validated
  server-side, the free local core untouched; a paywall with testimonials only from real,
  verifiable users with consent; the App Store rating request only after a satisfying moment
  through Apple's prompt, never on first launch and never required; no silent telemetry.
- **Gates.** Sandbox purchases and restores on the iPhone; the quota and ceiling states shown
  before they are hit; a measured-cost report (cost per request, per active person and per month,
  by model, from real usage in 25A) and a privacy review of what each request carries, before the
  owner's pricing decision.
- **Depends on.** 25A in production use with measured costs.

## 4. Launch

### Producto 26 — TestFlight, the definitive identity and publication

- **Scope.** The definitive bundle identifier and app identity (the pilot id and deep-link
  scheme are distinct from Capacitor's; changing the production identifier is a release
  decision), app icon and store assets, privacy labels and the data-use answers matching what
  the app does, support and policy pages, the accessibility and performance pass on a TestFlight
  build (an optimised build, not development mode: cold start, memory, dropped frames, VoiceOver,
  large text, Reduce Motion), the release checklist, App Store review; a rollback plan.
- **Rules.** No submission, subscription or charge without the owner's authorisation; Apple's
  acceptance is separate from a submission; no claim of approval before it exists.
- **Gates.** The release gate of the checklist; every open device gate above closed or
  consciously deferred by the owner.

## 5. After launch

### Android from the same shared code

- The same Expo/React Native project (`apps/mobile`) and the same domain, sharing the router and
  navigation, `packages/domain`, the storage abstractions (`src/storage`), i18n, the Assistant and
  the components where they fit; `DateField` already has its Android path (the system dialog).
  Platform differences live behind `Platform.OS`, `.ios.tsx`/`.android.tsx` files or adapter
  modules such as `src/ui/material.tsx`, never in a second repository or native project
  (decision 004, AGENTS rule 13). Still to do: a Material-free, platform-neutral press feedback;
  Play Store identity, signing and data safety answers; device evidence on real Android hardware
  (the slowest supported device, a release build). Not started until its roadmap entry.

### Marketing, App Store Optimization, Instagram, advertising materials and conversion tests

Only after real users exist (TestFlight or the App Store): demonstration videos from real screens
with clearly marked fixture data, testimonials only from real, consenting users.

- App Store listing (name, subtitle, keywords, screenshots per language and region, preview
  video from real screens with fixture data clearly marked, never a real user's ledger); the
  Instagram presence and advertising materials built on the same visual system; landing and
  support pages; conversion tests only with consent and without silent telemetry; testimonials
  and user counts only when real and verifiable; measure repeated use, time to record,
  Assistant corrections and willingness to pay before any claim.

## 6. Motion and design rules

One main number, real chart values, calm hierarchy and contextual actions. Native
stack/sheets own transitions. Preserve the mounted-tab mitigation; do not reintroduce
focus fades, detach/freeze combinations or redirect-based back handling. Motion is
driven by data or touch, never by a screen gaining focus: use `src/ui/motion.tsx`
(ease-out, named durations, `ValueTransition`, `Reflow`, haptic helpers) instead of
ad-hoc timings. Brief press, selection and data-change animations respect Reduce
Motion; text and financial values are never hidden until an animation finishes. The
amount field does not animate layout at all: its symbol is anchored and its digits
grow from a fixed origin. One
haptic per user action, always paired with a visual. Category hues come from
`src/ui/category-color.ts` and never replace a name. Colour tokens live in
`src/ui/palette.ts`: the cobalt primary marks interaction and selection only, the
semantic colours carry meaning, normal text stays neutral, and any new use of the
primary must keep 4.5:1 (see `tests/theme.node.ts`). Money input goes through
`src/ui/money-input.ts` and the domain parser; never format with floats. Dates,
percentages and prose amounts go through `src/i18n/format.ts` (tables, non-breaking
joins), labels through the `src/i18n` catalogues; a row that puts a name beside an
amount uses `useStacked()` and gives the name two lines. 44-point targets, VoiceOver,
safe areas, system text and separate currencies apply to every new screen.

## 7. History

- [mobile-roadmap-history.md](mobile-roadmap-history.md): the "Previous delivery" sections of every
  delivery from the foundation to Producto 24B6 and the handoff log with the checks, blockers and
  decisions recorded at each handoff (newest first), moved there verbatim on 2026-09-25.
- [mobile-device-checklist.md](mobile-device-checklist.md): the physical iPhone checks per delivery
  and their recorded results.
- [web-retirement-inventory.md](web-retirement-inventory.md) and [history/](history/): what the
  retired web app was, how to read it from the tag `web-frontend-final`, and its documents kept
  for the record.
- [mobile-design.md](mobile-design.md): the visual direction and the per-delivery design notes;
  [i18n.md](i18n.md), [currency.md](currency.md), [mobile-integrations.md](mobile-integrations.md):
  the contracts the deliveries above implement.
