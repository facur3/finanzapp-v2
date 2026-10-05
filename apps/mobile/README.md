# FinanzApp (native app)

FinanzApp is a native spending and commitments app: fast capture, understandable
spending, upcoming payments, budgets, cards and debts, with optional manually tracked
accounts in any currency and consolidated totals in one display currency. This directory is
the product: an Expo + React Native + TypeScript app, iOS first, Android later from this same
project ([decision 004](../../docs/decisions/004-native-first-and-web-retirement.md)). Its
SQLite file, backups and preferences are its own; there is no web version.

Read before changing anything: [AGENTS.md](../../AGENTS.md), the
[living roadmap](../../docs/mobile-roadmap.md) (status, device QA pending, next
deliveries), the [design direction](../../docs/mobile-design.md), the
[device checklist](../../docs/mobile-device-checklist.md), [docs/i18n.md](../../docs/i18n.md)
for language and region, [docs/currency.md](../../docs/currency.md) for money and
currencies, [docs/mobile-integrations.md](../../docs/mobile-integrations.md) for the
Assistant's backend, and the decisions
[001](../../docs/decisions/001-native-mobile.md) (Expo without a Mac),
[002](../../docs/decisions/002-spending-first.md) (spending first),
[003](../../docs/decisions/003-five-tabs-and-cards.md) (cards as accounts; its five tabs and
visual system superseded by 005),
[004](../../docs/decisions/004-native-first-and-web-retirement.md) (native first) and
[005](../../docs/decisions/005-forest-four-tabs-and-capture.md) (Forest, four tabs and the «+»
capture action). A
plain-language Spanish walkthrough for the iPhone is
[docs/empezar-en-iphone.md](../../docs/empezar-en-iphone.md). The delivery-by-delivery
history, the former status chronology of this README and the per-delivery test inventory
live in [docs/mobile-roadmap-history.md](../../docs/mobile-roadmap-history.md).

## Architecture and responsibilities

| Where | What it owns |
| --- | --- |
| `app/` | Expo Router routes: the four tabs in `app/(tabs)/` (Inicio, Movimientos, Reportes, Más; decision 005), the Assistant as a root-stack screen (`assistant.tsx`, pushed from the capture hub, 24UX6A), the first opening (`onboarding.tsx`, Producto 25B: a welcome with the detected language and region and an optional first account with the region's suggested currency; Omitir skips the rest and keeps what was saved; shown once, to a new installation only, and refused to anyone else even through a link), pushed detail screens (every financial object is read before it is edited, since 25B3 a recurring rule too: `recurring/[id].tsx`), native modal forms, Idioma, Región and Apariencia (`appearance.tsx`, 24UX6A), backup and recovery. Routes compose; they hold no financial rules. |
| `src/ui/` | The visual system: palette and theme, typography, accessible rows and controls, the amount field (`money-input.ts`), form controls and sheets, the motion language (`motion.tsx`), the material adapter (`material.tsx`, the only door to `expo-glass-effect`), charts, the Home modules (24UX6A: the pure selections of what Inicio shows, `home-focus.ts`, and its field parts, `home-modules.tsx`), the dock (`floating-tab-bar.tsx`: the icon-only pill of four tabs and, outside the tab list, the «+»; its pure geometry in `dock-geometry.ts`), the capture hub the «+» opens (`capture-hub.tsx`: Asistente, Gasto, Ingreso, Transferencia), the Apariencia preference (`theme-preference.ts`: Sistema, Claro or Oscuro, outside the ledger and its backups), the merchant tile (`merchant-mark.ts`, `MerchantBadge`: the category glyph; brand marks deferred to Producto 25C2), the searchable chooser, the first opening's rules (`onboarding-flow.ts`), the one rule for the currency a form starts with (`currency-defaults.ts`, `use-default-currency.tsx`, Producto 25B2) and a recurring rule's recorded history (`recurring-history.tsx`, shown on its detail, Producto 25B3). |
| `src/i18n/` | Language and region: the registries and release gates (`locale.ts`), table-based formats (`format.ts`), typed es/en catalogues (`messages/`), the device adapter, the preference store, the provider (`useI18n()`), the generated region catalogue (`regions/`) and its API, the Intl probe. |
| `src/storage/` | The SQLite repository (`database.ts`, schema `DATABASE_VERSION = 14`, atomic migrations, operation IDs, deletion records for recurring rules, debts, cards and normal accounts, the instalment plans and their schedules of Producto 24T1, and the cards' exact statement dates of Producto 24T2: `card_cycle_dates`, one chain of statements per card, each a closing and its due date, and Producto 24T3's purchase operations: `purchase_operations`, the devoluciones and adelantos de cuotas, and `operation_changes`, the receipts of their undo and restore), the exchange-rate cache in its own file (`rates-database.ts`, `finanzapp-rates-v1.sqlite`, 24C1), the native driver binding, transactions, the currency gate (`currency-gate.ts`), the open/foreground session (`ledger-session.ts`: the recurring catch-up per rule and the instalment catch-up per plan, in separate passes, never a precondition for opening the data; and `savePurchasePlan`, 24T2: a purchase in instalments saved with its first recognition, whose failure is a banner, never a failed save; `savePurchaseOperation`, 24T3) and `LedgerProvider` (24T3: `addRefund`, `addPayoff`, `voidOperation`, `restoreOperation`, `cancelInstallmentPlan` and `reactivateInstallmentPlan`, each in one exclusive transaction with the plan's catch-up). Since 25A-02 one id is one kind of write (`createEntry`, `createInstallmentPlan` and `createTransfer` refuse an id another kind owns), and `review-database.ts` keeps review items in their own file (`finanzapp-review-v1.sqlite`, never in the ledger or a backup). Writes are durable before the UI confirms; a failed write keeps the draft; no error resets storage. |
| `src/fx/` | Consolidated views (Producto 24C1): the Frankfurter adapter (`frankfurter.ts`, no key), the rate store and its request policy (`rates-store.ts`), the provider and `useFinanceView` (`rates-provider.tsx`), the pure view and its figures (`finance-view.ts`) and their words (`fx-copy.ts`). Nothing here writes to the ledger. |
| `src/assistant/` | The Assistant's pure conversation model, the app-session conversation (`session.ts`, 24UX6A: one in-memory conversation per app process, never persisted, cleared by Nuevo chat or by closing the app), the event-based client boundary, runtime selection, scripted fixtures, and (25A-04) `review-proposal.ts`, the adapter from a resolved draft to the canonical review draft. The Assistant never writes the ledger: its proposals are captured into the review store and confirmed only in «Para revisar». |
| `src/integrations/` | The HTTPS client for the mobile API and the on-device evidence builder. |
| `../../packages/domain` | The typed financial domain the app imports (`@finanzapp/domain`, linked as a `file:` dependency): ledger, budgets, categories, merchant identity, appearance, liabilities, purchases in instalments (`installments.ts`, 24T1: one purchase, one finite plan, instalments recognised statement by statement), the card's statement calendar (`card-cycles.ts`, 24T2: each statement a closing and its own due date; usual days plus exact dates that never move a closed statement), purchase operations (`operations.ts`, 24T3: a devolución or an adelanto de cuotas as an append-only record projected into the ledger as derived lines, never an income or a second expense), review drafts (`review-drafts.ts`, 25A-01: the typed proposal an Assistant, Wallet or inbox producer ends in, with explicit gaps, destination rules, stale-basis detection and exactly one deterministic write; not used by a screen yet), money, the currency catalogue and exact conversion for views (`fx.ts`, 24C1). Amounts are integers in each currency's minor unit; no floating point; nothing stored is converted. |
| `../../packages/integrations` | The request/response contracts shared with the backend. |
| `../../server/mobile`, `../../api/mobile` | The mobile backend: authenticated Assistant and capture endpoints, provider adapter, pending inbox, quotas. Disabled until the owner configures an account; no paid call is made by this repository. |
| `app.config.ts`, `eas.json` | App identities per variant, plugins, the EAS project link and the build profiles. No credentials. |

Local first: the ledger, the language, region and display preferences (currency and mode), the
first-opening mark (`finanzapp.onboarding`), the exchange-rate cache and the backups are on the device.
Backups export as JSON v8 while the ledger holds only ARS and USD, v9 once another currency is stored,
v10 once a recurring rule or a debt is deleted, v11 once an account or a card is deleted (Producto
25B2), v12 once a purchase in instalments exists (Producto 24T1), and v13 once a card holds an exact statement date
(Producto 24T2), and v14 once a devolución or an adelanto de cuotas exists, an undone one included (Producto 24T3);
v1–v14 files import after a review that never overwrites, and an older build refuses a v14 file or a schema 14
database unchanged. The only network call without the owner's
backend is the reference-rate download from Frankfurter (24C1): a date window and currency codes, no
key, no amount, no account, only when a consolidated view needs a month it lacks. Cloud is opt-in: the Assistant's remote runtime,
future sync and any AI provider need the owner's setup and consent; nothing leaves the
device otherwise.

## Development setup

### Fedora (or any Linux/Windows)

Node.js 24 (CI) or 22.22+, Git and VS Code. The app has its own lockfile, so its
dependency graph never changes the root install:

```bash
cd apps/mobile
npm ci
npm start                       # Metro for Expo Go
npm run start:dev-client        # Metro for the installed FinanzApp Dev build
```

Add `-- --clear` to reset Metro's cache (never the SQLite data) and `-- --tunnel` when
the iPhone cannot reach the computer over the LAN (it may ask to install Expo's tunnel
dependency). Use the Expo SDK version in the lockfile; do not mix React Native
versions. `npm audit fix --force` is forbidden: it replaces Expo packages with
incompatible majors (see [compat/](compat/README.md) for the scoped patches).

**Expo Go** (App Store) is a first look with Expo's bundled natives: it always draws the
opaque material, has no `expo-glass-effect`, and cannot exercise Face ID or custom
modules. The **development build** (FinanzApp Dev, `com.facur3.finanzapp.dev`) is the
real client: it links every native module of this app and runs whatever JavaScript Metro
serves, so TypeScript-only changes need no new cloud build; a change to native
libraries or `app.config.ts` does.

### iPhone

1. Register the phone once: `npx eas-cli@latest device:create`, open the registration
   URL on the iPhone, then enable Developer Mode (Settings → Privacy & Security).
2. Install FinanzApp Dev from its EAS build page (QR or link), or Expo Go for a first look.
3. `npm run start:dev-client -- --clear`, put the iPhone on the same Wi-Fi, open
   FinanzApp Dev and pick the Metro server (or scan the QR with the Camera app). Allow
   local network access if iOS asks. If Expo Go asks for a login on both ends, use the
   same free Expo account in the app and in `npx expo login`.
4. Use real, small data. Keep a private backup (Más → Copia de seguridad) before
   installing a build that changes the schema; an older build refuses a newer database
   and never deletes it. Never seed fake movements.

## EAS builds and profiles

The app is linked to the owner's EAS project **@facur3/finanzapp-mobile**
(`b1cd9780-7e6a-4de3-9248-d446d0c77520`), set as the default in `app.config.ts`; a
fork sets `EXPO_PUBLIC_EAS_PROJECT_ID=<uuid>` to override it (an invalid value is
refused at config time). A project ID identifies a project and grants nothing.

```bash
npx eas-cli@latest login
npx eas-cli@latest whoami                        # facur3
npx eas-cli@latest project:info                  # confirms the link
npx eas-cli@latest build --platform ios --profile development
npx eas-cli@latest build:list --platform ios --limit 5
```

| Profile | Distribution | Bundle identifier | Metro needed | Use |
| --- | --- | --- | --- | --- |
| `development` | Ad hoc, registered iPhone | `com.facur3.finanzapp.dev` | Yes | Daily iteration with the dev client |
| `preview` | Ad hoc, registered iPhone | `com.facur3.finanzapp.preview` | No | Optimized standalone check, computer off |
| `testflight` | App Store Connect / TestFlight | `com.facur3.finanzapp.preview` | No | Store distribution after the device gate (`eas submit --profile testflight`) |

EAS compiles on hosted macOS; there is no local Xcode on Linux. **No EAS build, TestFlight
submission, subscription or any paid step is started without the owner's explicit
authorization**; committing to this repository never triggers one. The definitive
production identity is a launch decision (roadmap, Producto 26); `com.facur3.finanzapp`
was registered by the retired Capacitor app and is not reassigned by the retirement. To know
which binary is installed, read the IPA's
compiled `Info.plist` (device checklist, Producto 23.2), not `app.config.ts`.

## Verification

From `apps/mobile`:

```bash
npm run typecheck
npm run test:storage                   # every *.node.ts test, real SQLite through Node's driver
npm run currency:verify                # offline: the committed currency catalogue matches its lock (CI)
npm run regions:verify                 # offline: the committed region catalogue matches its lock (CI)
npm run i18n:check -- --strict         # catalogues, placeholders, plurals, generated names (CI runs the non-strict form)
npm run check                          # Expo dependency compatibility (EXPO_OFFLINE=1 for the bundled data only)
npm run export:ios                     # Metro bundle for iOS: not an Xcode build, not a signed .ipa
npm run regions:generate -- --check    # release checklist; needs the cached CLDR sources (-- --download once)
npm run regions:families               # regenerates docs/region-families.md, the per-family iPhone sheet (tests check it)
npm run currency:generate -- --check   # release checklist; same sources
npm run i18n:extract                   # copy outside the catalogue (before a PR that adds copy)
npm run i18n:check -- --accept en      # after reviewing English changes
npm run i18n:export -- <lang>          # the brief for a new language
```

From the repository root: `npm ci`, `npm test` (`packages/domain`, `server/mobile` and the
repository guard) and `npm run check:repo`. CI (`.github/workflows/ci.yml`) runs the
`mobile` job (isolated `npm ci`, `npm ls --all`, `check`, `typecheck`, `currency:verify`,
`regions:verify`, `i18n:check`, `test:storage`, `export:ios`), the `mobile_api` job (the
PostgreSQL inbox tests) and the root `domain` job (`npm test`, `npm run check:repo`).

`test:storage` runs the storage repository against a real temporary SQLite database
(persistence, rejected writes, atomic migrations, repeated operation IDs) and the route
harnesses, which render the real screens with every import mocked; a new module under
`src/ui` needs a mock in each harness that loads it. None of it is a rendered iPhone:
gestures, VoiceOver, Dynamic Type, motion feel and Face ID are device checks. The
per-delivery inventory of what each test file covers is in
[docs/mobile-roadmap-history.md](../../docs/mobile-roadmap-history.md#mobile-readme-former-test-inventory-and-status-chronology-moved-2026-09-25).

## Test flags

All are UI flags, never secrets. The three preview gates are compiled away by
`babel-preset-expo` in a release or preview bundle (`__DEV__` is false), so a store or
`preview` build offers exactly the released set whatever the environment says; tests
prove it (`locale-release.node.ts`, `currency-preview.node.ts`). Never set them in
`eas.json`, `app.config.ts` or a committed `.env`.

| Variable | Effect |
| --- | --- |
| `EXPO_PUBLIC_ASSISTANT_FIXTURES=1` | Development bundle only: scripted Assistant conversations behind a visible "Vista de prueba" banner; nothing is saved. |
| `EXPO_PUBLIC_CURRENCY_PREVIEW=1` | Development bundle only: adds the seven held three-decimal currencies (BHD, IQD, JOD, KWD, LYD, OMR, TND) to the 146 of the release, for their VoiceOver check; Más names them under the footer. A release bundle never sees them. |
| `EXPO_PUBLIC_LOCALE_PREVIEW=1` | Development bundle only: offers every language and region the build carries, released or not: since 24R2B that adds the 23 blocked native-digit regions, to gather evidence per numbering system; the Región footnote says the preview is unverified. Start Metro with `--clear` after changing it. |
| `EXPO_PUBLIC_MERCHANT_MARK_PREVIEW=1` | Development bundle only: a recognized merchant's row draws the brand's initial on a neutral tile instead of its category glyph, to check recognition on the iPhone. No asset, image or dependency; brand marks are deferred to Producto 25C2 (docs/merchant-identity.md). |
| `EXPO_PUBLIC_DISABLE_GLASS=1` | Forces the opaque material everywhere; the glass module is never loaded. |
| `EXPO_PUBLIC_MOBILE_API_ORIGIN` | The origin of the mobile API for the Assistant's remote runtime; unset means disconnected. |
| `EXPO_PUBLIC_EAS_PROJECT_ID` | Overrides the default EAS project link (a fork or a second project). |
| `APP_VARIANT` | Set by the EAS profiles (`development` / `preview`): picks the bundle identifier and the app name. |

## What is released, what is only implemented

| Area | Today |
| --- | --- |
| Languages | Spanish and English released (`RELEASED_LANGUAGES`), declared to iOS by `app.config.ts`; each Más → Idioma choice and "Según el dispositivo" are live. |
| Regions | 234 of the 257 catalogue regions released (Producto 24R2B): Argentina and the United States since 23.1C2, the rest by continent on automated per-family evidence (`src/i18n/region-stages.ts`, `tests/region-families.node.ts`). The 23 regions whose locale defaults to non-Latin digits are blocked until each numbering system is normalized, tested and checked on an iPhone (the amount field reads only Arabic-Indic and Eastern Arabic-Indic digits today); they write Argentine formats and say so. Más → Idioma and → Región are the searchable `ChoiceScreen`. The per-family iPhone sheet is [docs/region-families.md](../../docs/region-families.md) (`npm run regions:families`). |
| Currencies | 146 currencies can be created since Producto 24M (`LEDGER_CURRENCIES`): ARS, USD and every ISO 4217 fiat currency with complete data and 0 or 2 decimals (144 new). The seven three-decimal currencies (BHD, IQD, JOD, KWD, LYD, OMR, TND) are held until an iPhone VoiceOver check and exist only on a development preview; SVC and VED (incomplete data), funds, metals and units of account are never offered. Every amount keeps its currency's own exponent. Since 24C1 Inicio, Reportes and Presupuestos consolidate totals in a display currency (each movement at its own date's reference rate, Frankfurter, exact, in the view only; subtotals per currency when a rate is missing); purchases paid from another currency are 24C2; the Assistant stays ARS/USD (25A). See [docs/currency.md](../../docs/currency.md) §2.7. |
| Assistant | A real conversation with proposals, clarifications and evidence; a proposal is captured into «Para revisar» and confirmed only there (25A-04); a root-stack screen opened from the «+» hub, its conversation kept in memory for the app session (24UX6A); fixtures mode for tests; the remote runtime and the cloud provider are opt-in and unconfigured, so this build is disconnected. The multilingual, voice-capable Assistant with analytical answers is Producto 25A, delivered in focused slices: 25A-01 (the review-draft domain model, PR #77), 25A-02 (the durable local review store, PR #78 and #79) and 25A-03 («Para revisar», PR #84) are merged, and 25A-04 (the Assistant's proposals into «Para revisar») is on its branch; nothing else is built. |
| Platforms | iOS only. Android comes later from this same project (roadmap §5), sharing the router, the domain, the storage abstractions, i18n, the Assistant and the components; platform differences go behind `Platform.OS`, `.ios.tsx`/`.android.tsx` files or adapter modules (`DateField` and the first opening's hardware back already have their Android path). Nothing Android-specific is tested. |
| Distribution | Ad hoc development builds on the owner's registered iPhone. Nothing is on TestFlight or the App Store. |

Three words mean three things here and in the roadmap: **implemented** is code with its
tests on Linux; **device-tested** is a result the owner recorded on the iPhone; **released**
is distributed to people. Today:

| | What |
| --- | --- |
| Implemented | Everything in the roadmap's §1, up to Producto 25A-04 (25A-04: the Assistant has no ledger write path; every resolved Assistant draft is adapted to the canonical review draft (`src/assistant/review-proposal.ts`, nothing invented) and captured into the review store with ids fixed once (`captureReview`), its chat card (`ProposalCard`) reads the review item and leads to «Para revisar», New chat never removes it, and the fixture view captures nothing; 25A-03: «Para revisar», the tray over the local review store: `/review` from a Más row and a pending count on the dock's Más tab, `/review/[id]` with Confirmar (only through the store's frozen write and reconciliation, in the ledger's queue), Editar (`/edit-review/[id]`, nothing preset, same item and write id) and Descartar, plus the hero amount's symbol and cents in solid graphite on Inicio's field (`heroMoneySymbol`, `heroMoneyCents`, `Money onField`); no schema 14 or backup v14 change; 25VIS1: Electric Lime, the current product palette accepted by the owner on the iPhone, colour tokens only in `src/ui/palette.ts` (lime field on Inicio with ink, the dock's «+» and the filled call to action; graphite dock; neutral canvases; transfer slate; `toggle` and `heroStatusBar` tokens), no layout or financial change; 25OPS1: a tab root's last row rests above the floating dock, the clearance being bottom padding of the content on every platform (`useDockInset`) after the native inset of 25UX1 failed on the owner's iPhone; plus the production and launch plan, documentation only: `docs/production-plan.md`, `docs/app-store-launch.md`; 25UX1, interaction: the dock floats with no rectangle behind it and the tab roots keep their last row clear of it through one shared clearance (`useDockClearance`); Tarjetas opens idle, a first tap selects a card and shows its compact snapshot (one Pagar tarjeta action), a tap on the selected card opens its detail, where Movimientos come before Cuotas; Reportes lists the donut's chosen category first while chosen, its row travelling up and back; 25A-02, infrastructure: `src/storage/review-database.ts`, the durable local review store in its own file `finanzapp-review-v1.sqlite` (review schema 1, never in a backup; pending → confirmed or dismissed; a frozen write id; a confirmation that freezes its one write before the ledger is asked and reconciles an interruption from the ledger), and the ledger's create functions refusing one id as two kinds of write (`packages/domain/write-ids.ts`); opened by LedgerProvider since 25A-03; 25A-01, pure domain: `packages/domain/review-drafts.ts`, the review draft every future Assistant, Wallet or inbox proposal ends in, and `boundary.test.ts`; no screen, storage, schema or backup change; 24UX6A, decision 005: the Forest palette (Electric Lime since 25VIS1), four icon-only tabs with a separate «+» that opens the capture hub, the Assistant as a root-stack screen with an in-memory session conversation, Inicio's financial field with upcoming commitments and recent activity, and Más → Apariencia; 24UX6B: Reportes read top to bottom as the period, the month's total with one spoken summary line, the category analysis (donut and «Por categoría», or «Por día»), then «Evolución» with the six months' bars, then budgets, merchants, insights, net flow and Comparar; 24UX6C, presentation only: a movement's amount shown as stored with «+» only for an income and a transfer in a blue-teal tone (`src/ui/movement-amount.ts`; computed signs such as negative balances and day nets keep theirs), Movimientos without a header «+» and with a shared search pill, Inicio without the line under the number, tinted hub tiles, the Assistant without the permanent disconnected caption or the composer microphone, Más with small caps group labels; 24UX6C2, a small polish: Inicio's recent activity includes this month's transfers, each once as an origin → destination row in the transfer tone (Gastado unchanged), «Próximos compromisos» over a rolling 30-day window, one contextual general-budget row only when the month's general budget is at 85 % or more, and a choosable category in Reportes' donut (the slice thicker and the row marked; adjustable for VoiceOver), with category rows stacking when a long name and a large amount do not fit together; 24UX6D, presentation only: Reportes Categorías without the «Gastado» KPI, its amount or the daily average, the period total in the donut's centre («Total del período», a 200–260 pt donut, 247 pt at 393 pt) replaced there by a chosen category, cleared also by a tap on the neutral space around the ring or a Categorías ↔ Día a día switch, Día a día with one compact «Total» line and the change against last month as a row of the lower facts; Inicio's budget attention as compact progress rows («Presupuesto» and «91 %», a 6 pt bar clamped at the full track, «Quedan $ …» / «Límite alcanzado» / «$ … por encima»), refined by the owner to the month's general budget and category budgets in warning (85–100 %) or exceeded, each in its own currency and never converted, at most two rows in one grouped surface (exceeded first, the general before a category, then the higher ratio; `homeBudgets`), a category row titled by its localized name in ink, never a permanent card or dashboard; Reportes' composition frozen as binding; Tarjetas, the card detail and the plan detail in Forest (one card always in front, 50 pt strips up to four cards and 44 pt from the fifth, the balance and the facts flat on the canvas with Vence · Cierra on one row and Disponible on its own, an archived or deleted card's lifecycle note, the plan's progress bar with «3 de 12 registradas», never «pagadas»); no card accounting, schema 13 or backup v13 change since 24T2; 24UX6E, presentation and lifecycle polish plus bug fixes: Cuentas, Presupuestos, Recurrentes, Deudas y cobros and Categorías in Forest with flat summaries on the canvas (the account's balance and month facts, the general budget with its hero in ink unless exceeded, Recurrentes' 30-day forecast with «Gastos» on its own line, Deudas' totals), one shared `LifecycleNote` for a deleted account, a paused, closed or review rule, a closed debt and an archived category, colour marking state rather than direction or identity (neutral debt tiles, the budget tile as identity only, Recurrentes' amber for an expense only), no chevron on rows that open a modal editor, archived categories no longer dimmed; bugs fixed: Presupuestos on a malformed or unsummable month, a duplicate budget and a category name clash now editable errors instead of a frozen retry, an untouched historical category save recolouring it, a closed debt drawn overdue, the forecast cut at 375 pt, edit modals without a close button, «Eliminar cuenta» / «Eliminar tarjeta» returning with `dismissTo`, the chooser's pinned card touching the options and Movimientos deshechos' day net; no domain, storage, schema or backup change; 24T3, refunds, early payoff and the instalment lifecycle: a devolución of any purchase (never an income: its own month, the purchase's category, credited to the purchase's account; on a plan, recorded principal first, then the last instalments), the adelanto de cuotas (the remaining instalments recognised once on its date, the card payment a separate transfer, future interest recorded or «no se cobró» by the person's choice), «Dejar de seguir el plan» recording closed instalments first and «Reactivar plan», a card holding a credit archived and never deleted, `/new-refund`, `/plan-payoff/[id]` and `/operation/[id]` with undo and restore, readers that net devoluciones without drawing a negative slice or bar or sending a negative fact, SQLite schema 14 and backup v14, and the carry-in of Reportes' «Categorías | Día a día» switch at 15/20 with no shrink-to-fit; the version line at the end of Más reads «FinanzApp 0.1.0 (25A-04)»; a development build adds the material and locale diagnostics under it). |
| Device-tested | The first Expo Go flow (2026-09-12), the Interfaz 15 motion direction, the per-app Language row on build `1d69d2d4`, and the owner's 24B5/24B6 sessions that produced the 24B6 and 24UX1 corrections. The section Producto 24T2 was completed by the owner on an iPhone 14 Pro with a fresh development build (2026-09-29). Every other later section of the [device checklist](../../docs/mobile-device-checklist.md) is still pending, and no per-item 24B5/24B6 result is recorded. |
| Released | Nothing. No store build, no TestFlight, no production identity. |

## Rules that never bend

- Money is integer minor units per currency; currencies are never mixed without a dated,
  sourced rate, and only in a view (24C1): stored amounts are never converted; a form's starting
  currency comes from one rule (`defaultCurrency`, 25B2) and never changes anything already saved;
- Deleting a normal account or a card writes a deletion record (25B2): the row, every movement and
  every transfer stay, readable as that account's; nothing new lands on it; history is never erased; cards, debts and receivables are hidden accounts; a purchase, a
  transfer and a card payment are each counted once. A debt or receivable with a balance and a recorded
  payment or collection is settled or closed, never deleted (`assertDebtDeletable`, 25B2 close); a card is
  deleted only with no balance due, no pending instalment plan (24T1) and no credit in the holder's favour (24T3); a change of a card's dates or usual days
  never moves a statement that already closed (24T2).
- Save locally before confirming; a failed write keeps the draft and its exact command
  for retry; no error resets storage; a newer database is refused intact.
- User data starts empty. No seeded balances, movements or sample history, ever.
- Every visible string is `t('area.meaning')` from `useI18n()`; every visible amount goes
  through `moneyText` / `formatMoneyAmount`; VoiceOver amounts through `spoken*`; the
  guards in `translation.node.ts`, `voiceover.node.ts` and `currency-guards.node.ts` fail
  otherwise.
- Native navigation owns transitions; motion follows `src/ui/motion.tsx` and the rules in
  [docs/mobile-design.md](../../docs/mobile-design.md); Reduce Motion, Dynamic Type and
  safe areas are honoured everywhere.
- Native code stays local to this app. The generated `apps/mobile/ios/` and `android/`
  projects are ignored and created by EAS; there is no other native project in the
  repository. No generated app, personal backup, screenshot or signing secret belongs in Git.
