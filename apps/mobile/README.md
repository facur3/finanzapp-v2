# FinanzApp native pilot

The new Expo/React Native app lives here. It has an independent dependency install
and app identity; it does not replace the web/Capacitor product or share its data.
See [the living roadmap](../../docs/mobile-roadmap.md) for implemented vs pending
features and [decision 001](../../docs/decisions/001-native-mobile.md) for why.
For a plain-language Spanish walkthrough, start with
[Probarlo en tu iPhone](../../docs/empezar-en-iphone.md).

**2026-09-12:** the user accepted the first Expo Go pilot on iPhone, reporting
fluid native navigation and records preserved after closing/reopening. Remaining
gesture/accessibility checks and an optimized signed build are still pending.
The reported device is an **iPhone 14 Pro running iOS 26.6.1**; its tested commit
is unknown. The first [original visual-system iteration](../../docs/mobile-design.md)
is implemented. The user reported the requested basic flow working, but Settings
or Movements intermittently stayed black on tab changes and the visual style
is not yet approved. **Interfaz 02** addresses this risk and refines the design;
its focused physical re-test is pending. **Interfaz 03 (2026-09-13)** builds on it
with a compact dashboard and read-only monthly category reports. Physical/visual
acceptance remains open. **Interfaz 04** adds posted-entry edit/undo/recovery and
native-backup review/import. Neither this delivery nor Interfaz 03 has new physical
acceptance evidence. **Interfaz 05** adds account corrections and same-currency
transfers with editing/undo/recovery. The owner is deferring a combined review;
there is no new physical acceptance. **Interfaz 06** adds daily expense drill-down
and monthly/category comparisons. Interfaz 07 supersedes the balance-first Home. **Interfaz 08 (2026-09-20)** adds
native recurring commitments, automatic due-date materialization and a real upcoming
payments block. **Interfaz 09 (2026-09-20)** adds monthly category budgets, a clear
Gastos / Disponible Home hero and a non-networked Assistant preview. **Interfaz 10
(2026-09-20)** restructures navigation into five tabs (Inicio, Movimientos, Reportes,
Tarjetas, Ajustes), adds credit cards, personal debts and receivables with correct
accounting, and replaces the purple accent with a neutral, semantic visual system.
**Interfaz 11 (2026-09-20)** makes Home compact (one hero, compact controls, budget
line, top categories, upcoming, recent), adds a transfer filter, relative section
labels and day nets to Movimientos, and gives transaction detail the Wallet
hierarchy with budget context. **Interfaz 12 (2026-09-20)** gives the entry, transfer
and recurring forms a clear hierarchy: kind, large amount, then Categoría and Pagado
con / Ingresa en as full-width selector cards with the live balance, card debt or month
budget. **Interfaz 13 (2026-09-20)** turns Reportes into the analysis surface: trend,
category donut with legend, day by day, budgets, top merchants, factual insights and
net cash flow. **Interfaz 14 (2026-09-20)** polishes Presupuestos (dense rows with
percentage), Recurrentes (30-day statistics, relative dates) and Cuentas (per-currency
totals, account detail with month in/out and actions). **Interfaz 15 (2026-09-20)**
adds the motion system (sliding segmented thumb, value crossfades, reflow, haptics),
stable category hues, the clockwise donut sweep and a UI-thread card carousel; the
owner reviewed it on the iPhone and accepted the direction. **Interfaz 16
(2026-09-20)** is the subtraction pass that followed: category hue inside the tile,
a month-only Home with round actions and ranked categories, one-line responsive
amounts, a quieter card hierarchy and the disclaimer copy removed. The spending-first
decision remains authoritative, with device checks still an explicit gate.
**Interfaz 17 (2026-09-21)** adds the visual identity: a cobalt primary for
interaction and selection, transfer on a distinct azure, Home categories as one
tinted-fill distribution, Argentine digit grouping while typing an amount (display
only; storage stays integer minor units) and hero amounts in three colour levels.
**Producto 18 (2026-09-21)** is product architecture, not a redesign: the fifth tab
is **Más**, a grouped hub (Finanzas: Cuentas, Presupuestos, Recurrentes, Deudas y
cobros, Categorías; App y datos: Asistente preview, Copia de seguridad, Movimientos
deshechos); Tarjetas holds only credit cards; the Home sparkles shortcut is gone
while the Assistant is a preview; and the transfer form offers fill-only amount
shortcuts — Usar todo, Pagar total, Saldar total, Cobrar total — computed from the
recorded balance or obligation, never submitting on their own.
**Producto 19 (2026-09-21)** completes budgets: a **general** monthly budget (the
ceiling for every recorded expense of the month in one currency) beside **category**
sublimits that never add up to it; a scoped model (`scope: 'total' | 'category'`,
no fake "General" category), SQLite schema 7 (the budgets table is rebuilt and every
old budget survives exactly as a category budget), backup format v7 (v5/v6 files
still import), a hierarchical Presupuestos screen, a Home card that answers "how much
of my month have I used" and one shared set of states (calm / warning / exceeded).
**Producto 20 (2026-09-21)** adds user-controlled identity, not a redesign: liquid
accounts choose a name, icon and colour (Cuentas, account detail, every account
selector, Pagado con / Ingresa en, Desde / Hacia, recurring forms and the detail rows
all show the same tile); categories can be created, renamed, re-iconed, recoloured and
archived from Más → Categorías without touching a single movement. Identity is
presentation metadata in two additive tables (SQLite schema 8): a look per account
beside the account row, and a definition per `(kind, normalised key)` that decorates
the free category string entries already carry. Renaming changes only the display
name: the string new movements record (`storedLabel`) is fixed at creation, so history,
budgets, recurring rules and reports keep grouping under one key. Presets are code, not
rows (nothing is seeded); historical strings such as test categories keep their spelling
and get a deterministic fallback glyph and hue until the user dresses or archives them.
Backup format is v8 (v1–v7 files still import; their accounts show the default look).
One shared icon-and-colour picker (curated Ionicons glyphs, eleven restrained colours
with accessible Spanish names) serves both; Más → Finanzas rows carry soft tinted tiles.
**Producto 21 (2026-09-21)** is the Assistant experience: the production-intent
conversational interface, built before the cloud model is connected and honest about
it. Home's quick actions become four equal columns — **Asistente**, Gasto, Ingreso,
Transferir — on a restrained opaque material (hairline edge, soft shadow in light, a
light edge in dark; the Assistant on a cobalt wash with a thin cobalt ring). The
brochure preview is gone: `/assistant` is a real conversation (quiet empty state with
four suggestions, a composer with microphone and send/stop, user pills, plain
Assistant text, streaming and "Pensando…" states, structured **draft cards** with
Confirmar / Editar / Descartar, **clarification chips** when the account, kind or
category is unknown, **answers with evidence rows and links** to Movimientos /
categoría / Presupuestos, and calm inline notes for not connected / offline / limit /
failed). The conversation model is pure (`src/assistant/conversation.ts`), the client
boundary is event-based and streaming-ready (`src/assistant/client.ts`, wrapping the
existing `integrationClient` and POST `/api/mobile/assistant`), and this build's runtime
is **disconnected**: nothing leaves the device, a sent message returns to the composer
under one note. The only ledger write is an explicit Confirmar on a draft, validated by
the domain and saved through the same repository as the form; Editar opens the entry
form prefilled. Voice is a visible affordance only (the microphone explains that
transcription needs the development build). Scripted fixtures exist for tests and,
under `EXPO_PUBLIC_ASSISTANT_FIXTURES=1` in a development bundle only, for seeing the
states on the iPhone behind a visible "Vista de prueba" banner that never saves.
**Producto 23.0 (2026-09-22)** is interaction polish and the localization foundation:
the currency selector is a stacked `SelectionRow` ("Moneda / Dólares estadounidenses /
USD · US$", the same row read-only in Editar cuenta) and the compact account and
category selectors share it; `DetailRow` stacks a long label/value pair instead of
wrapping the value into right-aligned fragments; the amount field anchors its symbol at
the left and lets the digits grow from a fixed origin in tabular figures, so nothing on
screen moves at "999 → 1.000" or "999.999 → 1.000.000" and the size steps down only
when the whole amount would not fit (`amountFieldLayout` returns a size, never a
position); a shared `useStacked()` threshold, `Stat`/`StatRow`, capped segmented labels,
two-line names beside bounded amount columns and non-breaking joins for currency codes
fix the overflow audit's shared patterns. `src/i18n/` holds the locale (es-AR, en-US;
`resolveLocale` from the device and a stored preference, English gated by
`RELEASED_LOCALES` until 23.1), table-based date/number/percent/amount presentation
(`format.ts`, Spanish money output identical to `formatMinorUnits`), typed catalogues,
the expo-localization/Intl device adapter, the key-value-store preference and the
`I18nProvider`/`useI18n()` used by the shared components and every date label. New
dependency `expo-localization`; its config plugin is not enabled). No domain, schema,
backup, cloud or financial change.

**expo-localization needs a new development build.** It is a native module: Expo Go
already contains it, but a FinanzApp Dev binary compiled before this PR does not, and
Metro cannot add native code. On such a binary the app still starts and works:
`src/i18n/device-runtime.ts` first asks `requireOptionalNativeModule('ExpoLocalization')`
and only evaluates the package when the module is registered, because evaluating it
without the module throws "Cannot find native module 'ExpoLocalization'" and Metro's
development runtime shows that error even when the caller catches it (the first device
run of this PR). Without the module, the **fallback** keeps: the device's primary
language through Hermes `Intl` (enough while Spanish is the only released locale), every
date, percentage and amount format (they come from FinanzApp's own tables, not from the
device), the catalogues and the stored language preference. It loses: the ordered list
of preferred languages beyond the first, the device's region code, and live locale
change events (none are used before 23.1). The Más footer says which path this launch
took: "Idioma: módulo nativo" (the build links expo-localization), "Idioma: Intl (sin
módulo nativo)" (an older build) or "Idioma: predeterminado" (neither answered). A fault
inside a registered module is not treated as absence and still surfaces.

Rebuild FinanzApp Dev (profile `development`, bundle identifier
`com.facur3.finanzapp.dev`; the preview app is untouched), from `apps/mobile`:

```bash
npx eas-cli@latest whoami                       # logged in as facur3
npx eas-cli@latest build --profile development --platform ios
# install: open the build page URL (or scan its QR) on the iPhone, tap Install;
# the iPhone must be registered (npx eas-cli@latest device:create) and in
# Developer Mode (Settings → Privacy & Security → Developer Mode)
npm run start:dev-client -- --clear               # Metro for the dev client
```

Then open FinanzApp Dev on the iPhone (same Wi-Fi as the computer) and pick the Metro
server, or scan the QR Metro prints with the Camera app.

**Producto 22.1 (2026-09-22)** is clarity and form polish, not a redesign: Más → Finanzas
and App y datos rows, the Reportes "Comparar con el mes anterior" row and the backup
import row use one `NavigationRow` (tinted tile or neutral glyph, the title as the primary
line, the description under it, a chevron), so "Deudas y cobros / Debo · me deben" no
longer compete on one line and nothing clips; Nueva cuenta keeps one short line under
Saldo inicial ("Opcional. No cuenta como ingreso.") with the full explanation behind an
information glyph (`FieldNote` / `InfoButton`), and its currency is a native row
(`CurrencyField`: name and code, a page sheet listing the two ledger currencies with a
checkmark, ready to become the searchable currency screen; `src/ui/currencies.ts` holds
the list and the search helper); Editar cuenta uses the same short notes; empty states
are one calm card (44 pt glyph, title3). No domain, schema, backup, cloud or native change.

**Producto 22 (2026-09-21)** is reachability and material, not features: the Assistant
becomes the **centre tab** (Inicio, Movimientos, Asistente, Reportes, Más), so either
thumb reaches it from any screen; the Home quick action stays as a discoverability
shortcut and lands on the same tab (`router.navigate`, never a stacked copy). Tarjetas
leaves the bar and is the second Finanzas row under Más, pushed as its own screen with
its "+" in the header; nothing about cards changed. The four Home actions and the
Assistant composer become **control surfaces** (`src/ui/material.tsx`, the only door to
`expo-glass-effect`). **Expo Go always draws the opaque material of Producto 21 and never
evaluates the glass module**: the first device run of Producto 22 closed Expo Go right
after loading, and mounting a native view the running binary cannot create ends in a
native `fatalError` inside Expo's Fabric initializer that no JavaScript try/catch can
reach. So the module is required lazily, once, and only when four conditions hold: not
Expo Go (`expo-constants`), not switched off (`EXPO_PUBLIC_DISABLE_GLASS=1`, a UI flag,
not a secret), iOS, and the running binary has registered `ExpoGlassEffect.GlassView`
(read from the module registry, which answers null instead of throwing). Only then does
it ask `isLiquidGlassAvailable()` and `isGlassEffectAPIAvailable()`, and Reduce
Transparency (feature-detected, live) still wins. Native Liquid Glass is therefore a
**development build** capability (regular glass, a cobalt wash on the Assistant, no
ring); Expo Go, older iOS, Android, web, a beta without the API, a missing module or
Reduce Transparency keep the opaque material unchanged. Glass is never drawn on rows,
chips, lists, cards or the tab bar. Más's footer names the active material and why
("Material opaco (Expo Go)", "Liquid Glass"). The composer measures what sits below it
(the tab bar) so it rests on the bar with the keyboard down and rises exactly to the
keyboard when it opens.

Two ways to run the pilot while checking the material:

```bash
# A. Diagnostic: opaque material forced everywhere, glass module never loaded.
EXPO_PUBLIC_DISABLE_GLASS=1 npm start -- --clear
# B. Normal automatic mode (Expo Go: opaque; a development build on iOS 26: glass).
npm start -- --clear
```

The Reportes tab shows, for one month and currency, the recorded total with its daily
average and change against the same elapsed days of the previous month, a six-month
trend, a category donut with a legend (Categorías) or a Día a día list, budget status,
top merchants, factual insights, recorded income and net cash flow, plus Comparar.
Current months compare equal initial day counts (both capped if the previous month is
shorter); historical months compare full months. Exact date ranges stay visible.
Category totals open only their dated expenses. Missing records are not savings.
Native backup/recovery stays available, but no JSON import is required to start.

## Product scope (Producto 18)

[Decision 002](../../docs/decisions/002-spending-first.md) selects spending and
commitments with optional accounts. No native portfolio or market data. The old
MonthCard and balance hero are removed; new period/category drill-downs reuse the
native stack. No SQLite migration or loss of existing records.
Cloud AI replaces the earlier local-parser plan. [Integration contracts/setup](../../docs/mobile-integrations.md)
describe the disabled-by-default API, bounded provider adapter, pending inbox,
and remaining auth/consent/Shortcut/audio UI. No paid calls or remote SQL were run.
Inicio → Asistente (first quick action) and Más → Asistente open the real Assistant
conversation. In this build it is disconnected: it never claims a model is active and
sends no financial data; the interface, the draft/clarification/evidence states and the
client boundary are ready for the activation phase (session, consent, server origin).

## First start on Linux or Windows

Install Node.js LTS (22.22 or newer; development/CI uses Node 24), Git and VS Code.
From the repository root on the updated `master` branch:

```bash
cd apps/mobile
npm ci
npm start
```

Install **Expo Go** from the App Store. Put the computer and iPhone on the same
network, scan the terminal QR with the iPhone camera and open Expo Go. Allow local
network access if iOS asks. If LAN access is unavailable, `npm start -- --tunnel`
uses an optional network tunnel and may ask to install Expo's tunnel dependency.

If Expo Go asks you to sign in on both ends, use the same free **Expo account**
in Expo Go and `npx expo login`. This is separate from an Apple ID or GitHub login.
Create it at [expo.dev/signup](https://expo.dev/signup) if needed, or reset its
password through Expo. Do not paste passwords into issues or chat. Opening the
project chooser's Expo Go option is the intended first-pilot route.

This first preview requires a running development server. It is not a signed
standalone app, and it cannot validate every future native Apple feature.
Use the Expo SDK version in the lockfile; do not mix arbitrary React Native versions.

## Accounts and data in this pilot

The first functional slice is accounts, expense/income, activity and detail,
with native navigation and SQLite. It starts empty. Opening balances are explicit
and are not income. ARS and USD are shown separately without fabricated rates.
Drafts and posted entries can be edited. Open a movement → Editar movimiento;
change amount, kind, concept, category, date or account **within the same currency**.
Deshacer removes its effect without a fake refund/income. Its recoverable record
remains in Más → Movimientos deshechos, including after closing/reopening.
Open an account → pencil to rename it or correct its **recorded balance**.
A correction changes opening balance with a local revision/audit receipt, not
an expense/income. Confirmation shows the previous and new balance. Concurrent
balance changes reject a stale correction; a rename alone preserves new movements.
Currency cannot be changed on an existing account.

Account → Transferir records one internal transfer between distinct accounts in
the **same currency**. A single stored record affects both balances atomically.
The form previews both resulting balances (including removal of the prior effect
when editing). Negative balances are allowed for truthful tracking but warned.
It **does not send money to a bank**. Transfers appear once in full activity,
on both account details and in recovery; they never appear as income/spending in
reports. Cross-currency operations, fees and bank execution remain separate work.

Más → Recurrentes creates weekly, monthly or yearly expense/income rules tied
to a real account. Each rule stores its next date and a stable calendar anchor,
so a January 31 schedule can use February 28 and return to March 31 instead of
drifting permanently. Opening/resuming the app posts due active occurrences into
the normal ledger and advances the rule in the same SQLite transaction. Each
occurrence has a deterministic ID, so retry/restart cannot silently double-charge.
Pausing keeps prior history and reactivation skips dates that elapsed while paused.
Home shows up to three real upcoming expense commitments for the selected currency;
the Recurrentes screen also shows a 30-day forecast without mixing ARS and USD.

Más → Tarjetas holds credit cards only; personal debts and receivables live under
Más → Deudas y cobros. A card is a hidden internal account: registering a purchase posts **one expense** to the card (it counts in
Movimientos, Reportes and Presupuestos and raises the card's recorded debt).
**Pagar tarjeta** records a transfer from a cash account into the card: cash goes
down, debt goes down, and no second expense is created. Its form offers **Pagar
total**, which only fills the amount with the recorded debt (never more); a plain
transfer offers **Usar todo** (the source's positive recorded balance) and a debt
offers **Saldar total** / **Cobrar total**. Saving stays explicit in every case. Closing and due dates are
calculated from the days you enter; there is no bank statement, pending state or
card control. A debt ("Debo") or receivable ("Me deben") is also a hidden account
whose opening balance is the principal; each payment or collection is a transfer
capped at the outstanding amount. Expenses, income and recurring rules can never be
posted to a debt account. Home's Disponible excludes cards, debts and receivables.

Más → Presupuestos stores planning limits for one month and one currency, in two
kinds. A **general** budget is the ceiling for every recorded expense of that month
and currency: cash and card purchases count once, exactly as in Reportes; income,
internal transfers, card payments and debt settlements never count; voided entries
are gone. A **category** budget is a sublimit for one normalised category inside it.
Sublimits are never summed: "General 500.000, Comida 150.000, Ocio 50.000" plans
500.000. At most one active general budget per currency and month, and one active
sublimit per category, currency and month; editing never flips the kind or the
currency. Budgets can be edited or archived without changing historical movements or
account balances. States are shared everywhere: calm below 85 %, warning from 85 %
up to and including the limit, exceeded past it. Home leads with the general budget
when one exists (what is left, the share used, how many sublimits are over) and
otherwise with the tightest sublimit, never with a sum of sublimits. ARS and USD stay
separate; a USD budget only sees USD expenses.

The current visual iteration includes:

- Home: one large number toggles between recorded period **Gastos** and recorded-account
  **Disponible**, with separate currency semantics. Spending keeps week/month charts,
  top categories and scoped recent entries. Accounts are reached from the header or
  Settings. Opening balance is optional (zero tracking baseline, not bank sync).
  Selecting USD preselects a compatible account in the entry draft.
- Movements: virtualized date groups, accent-insensitive concept/category/account
  search and expense/income filters. Search does not mutate the stored entries.
- Forms: Gasto / Ingreso / Transferencia switch, emphasized amount, iOS keyboard Done,
  full-width Categoría and Pagado con / Ingresa en selector cards with live balance,
  card debt and budget context, and a native date sheet with separate
  draft/confirm/cancel. Save still waits for durable storage.
- System appearance, accessible labels and restrained press/selection feedback.
  A single shared accessibility subscription controls reduced motion; native
  navigation alone owns screen transitions. Date labels refresh after midnight/resume.
- Interfaz 02: stable mounted tab roots with no content fade, lazy mounting or
  freezing. Detail/modal stack animations remain native. Keeping three roots
  mounted uses more memory; activity remains virtualized. Do not globally disable
  react-native-screens or add focus-triggered reloads to hide the symptom.
- Category symbols and a searchable chooser that
  reuses existing category strings or accepts a custom one. No auto-reclassification.
- Exact recorded income/expenses by currency, through today. No opening balance
  counted as income; unsafe aggregate totals get an unavailable state.
- Interfaz 03: top three expense categories on Home; Reporte mensual opens all of
  them, month/currency controls and each category's actual entries. Reports live
  in the native stack, not an extra tab. Historical months include all their days;
  future dates never inflate the through-today chart. Category identity ignores
  case/accents/extra spaces without editing the stored strings.
- Accessible single-color bars, explicit amounts and percentage of total spend.
  Changes animate for 260 ms, never replay on focus or animate a fabricated balance.
  Reduce Motion removes the transition. Lists remain virtualized and empty periods
  have no fake categories, trends or sample data.

Interfaz 05 migrated the existing pilot SQLite file from schema 1/2 to 3, atomically,
preserving its filename/rows and entry audit. Interfaz 08 added schema 4 recurring_rules;
Interfaz 09 added schema 5 monthly_budgets; Interfaz 10 adds schema 6 credit_cards and
personal_debts; Producto 19 adds schema 7, which rebuilds monthly_budgets with a
`scope` column and a nullable `category` (every existing row is copied as a category
budget with its id, amount, month, currency, state, revision and timestamps unchanged,
in one exclusive transaction; an interruption leaves the schema 6 table intact).
Producto 20 adds schema 8: two additive tables, `account_appearances` (one look per
account, foreign key to accounts) and `category_definitions` (primary key kind + key),
with no seeded rows; an account without a row shows wallet on cobalt. None of
them replaces existing balances, entries, transfers or schedules.
Do not revert to older app code after upgrading. A newer DB version is refused
intact; no error deletes the file. No Supabase connection, seeded records, new
runtime dependency or paid service was introduced. Follow the new-iteration section of the
[device checklist](../../docs/mobile-device-checklist.md) before accepting its layout.

Only enter a small amount of data while checking the experience. Do not re-enter
the entire portfolio or uninstall the existing app. Legacy import, card installments,
Supabase sync, Face ID, reminders and Apple Pay capture are separate roadmap
milestones; no disabled decorative buttons imply otherwise.

The pilot exports its own v8 JSON backup through the system sharing sheet and
imports native v1 to v8 backups through Más → Copia de seguridad → Importar copia. A v8
file adds `appearances` and `categories`; v1–v7 files have neither, and import as before
(accounts then show the default look, categories resolve to presets or history). A look
or a definition for the same account/identity that differs from the local one is a
conflict, never an overwrite. A v7
budget carries its `scope`; a general budget has no `category` key. Budgets in v5/v6
files have no scope and are read as category budgets, exactly as written. Review shows new
accounts, cards, debts, active/undone entries, transfers, recurring rules and budgets,
identical records and exact before/after liquid totals for ARS/USD separately (cards
and debts are excluded from those totals). Confirmation adds only missing IDs in one transaction.
Identical IDs/data are skipped; any conflict blocks the whole import, including
old copies that would resurrect a tombstone. No silent overwrite or account merging
by name. Local changes after preview require another review. Reimport/retry is safe.

Native JSON is **not** the legacy web backup format: unsupported schema/entities,
invalid cents/dates/references, duplicate IDs, unsafe totals, extra fields and files
over 5 MB are rejected before import. Limits: 1,000 accounts, 25,000 combined
entry/transfer records, 5,000 recurring rules and 5,000 budgets.
Export validates its own restore format/size. V7 includes current versions,
tombstones, recurring schedules, monthly budgets and card/debt profiles, **not** full
local account/entry/transfer audit history, settings, attachments or investments. A backup is a snapshot, not a cross-device synchronization.
There is no replace/reset import mode; preserve both copies if conflicts are reported.
File selection/sharing is explicit, not an automatic upload. The selected source
file is never edited/deleted. Export is plain JSON, not encrypted or authenticated;
store privately. SQLite is local storage, not a substitute for a private backup.

## Signed iPhone builds without a Mac

1. Create a free Expo account and enroll in the Apple Developer Program when ready
   for a signed iPhone build. Apple enrollment requires the owner's identity/payment.
2. The pilot is linked to the owner's EAS project **@facur3/finanzapp-mobile**
   (`b1cd9780-7e6a-4de3-9248-d446d0c77520`, created 2026-09-21): `app.config.ts`
   carries that ID and `owner: 'facur3'` as its defaults, so no terminal export is
   needed. A project ID identifies a project and grants nothing; it is not a
   credential. Log in with `npx eas-cli@latest login` and confirm the link with
   `npx eas-cli@latest project:info`. A fork or a second project sets
   `EXPO_PUBLIC_EAS_PROJECT_ID=<its-uuid>` (a local `.env.local` works) to override the
   default; an invalid value is refused at config time. Never invent an ID.
3. Register the phone with `npx eas-cli@latest device:create`. Open its registration
   URL on the iPhone, complete registration and enable iOS Developer Mode.
4. Run `npx eas-cli@latest build --platform ios --profile development`.
5. Install via the build page's QR code. Start `npm run start:dev-client`, scan its
   QR and iterate. Most TypeScript-only edits refresh without a new cloud build;
   changing native libraries/configuration needs a rebuild.
6. For a standalone optimized test on your registered phone, build the `preview`
   profile. It includes JavaScript and can run with the computer off.

Cloud signing/builds require account setup and may consume plan quota. No build
or paid service has been started by committing this scaffold. There is no local
Xcode/iOS simulator on Linux or Windows; EAS compiles on hosted macOS.

| Profile | Distribution | App ID | Requires Metro while testing |
| --- | --- | --- | --- |
| `development` | Ad hoc, registered iPhone | `com.facur3.finanzapp.dev` | Yes, for live editing |
| `preview` | Ad hoc, registered iPhone | `com.facur3.finanzapp.preview` | No |
| `testflight` | App Store Connect/TestFlight | `com.facur3.finanzapp.preview` | No |

All profiles remain isolated from the existing `com.facur3.finanzapp` app. A
future production identity/profile is intentionally not enabled in this pilot.
`preview` and `testflight` use the same pilot identity and replace each other on
that device; they do not replace the legacy production app.

## TestFlight, after the device gate

Create the corresponding pilot app in App Store Connect (same preview bundle ID),
then use store distribution rather than submitting the ad hoc development build:

```bash
npx eas-cli@latest build --platform ios --profile testflight
npx eas-cli@latest submit --platform ios --profile testflight
```

Choose the matching **store** build when prompted. EAS uploads the binary; it
does not complete App Store review or guarantee approval. Configure testers,
export compliance and app details in App Store Connect. Native integrations,
privacy, migrations and optimized performance must pass the
[device checklist](../../docs/mobile-device-checklist.md) before production.

## Verification

From `apps/mobile`:

```bash
npm run typecheck
npm run test:storage
npm run check
npm run export:ios
```

`test:storage` uses a real temporary SQLite database through Node's SQLite driver,
with the same storage repository. It checks persistence, rejected writes, atomic
migrations and repeated operation IDs. It also tests the actual query-string and
Xcode-generator integrations affected by the temporary dependency fixes in
[`compat/`](compat/README.md). It does not replace native-device testing.
It also covers the actual presentation helpers: filtering/search, stable ordering,
date grouping, available currencies, account preselection and category handling.
The mobile tests include guards over the real five-tab layout (Más, no Home sparkles),
report/recovery/transfer handlers, the Cards tab (no personal debts), card/debt detail,
the locked card-payment form, the fill-only amount shortcuts (Usar todo, Pagar total,
Saldar total, Cobrar total), the Más hub (tinted Finanzas tiles), backup and the
categories management screen, historical custom categories, the scoped budget form, the
hierarchical Presupuestos screen, the Home budget card, the schema 7 and 8 migrations,
account looks (create/edit/retry, selectors), the category form (create/rename/archive),
the shared icon-and-colour picker (VoiceOver names, haptics, Reduce Motion), every
curated glyph against the bundled Ionicons font, palette contrast, and bar-animation
configuration. Producto 21 adds `assistant.node.ts` (conversation reducer, intent
classification, draft resolution and clarification, evidence rows/links, the
disconnected/remote/fixture clients and the runtime's fixture gate),
`assistant-routes.node.ts` (the screen: empty state, suggestions, composer state,
disconnected note that preserves the text, streaming and Stop, answers with links, a
draft that writes nothing until Confirmar and then exactly once with a domain-validated
Entry, retry with the same id, Editar hand-off, clarification chips, Reintentar, the
fixture banner that never writes, autoscroll gating, Reduce Motion, New chat) and
`assistant-ui.node.ts` (composer labels and states, keyboard-tracking structure, draft
card rows and gaps, chips, thinking pulse under Reduce Motion, evidence rendering), plus
the four-column quick actions guard in `motion.node.ts`. Producto 22 adds
`material.node.ts` (the glass/opaque decision matrix, the composer padding formula,
`useMaterial` never throwing, `ControlSurface` in both materials, and a guard that only
the two control surfaces import the material, that only the adapter names
`expo-glass-effect` and only through a lazy `require`), the startup-safety cases (Expo Go,
the kill switch, an unregistered view, a module that fails to load or throws, a missing
or throwing Reduce Transparency API: opaque every time, the module never evaluated on an
unsafe path), `ui-rows.node.ts` (NavigationRow hierarchy and labels, FieldNote and its information
alert, the calmer EmptyState, the currency row and sheet, the ARS/USD list and search
helper), `worklets.node.ts` (every animated file compiled with `babel-preset-expo`
as Metro does for iOS; a function captured by a UI-runtime callback must be a worklet,
which is what `composerBottomPadding` was missing on the first device run). Producto 23.0
adds `i18n.node.ts` (locale mapping and resolution with the release gate, the device
adapter's fallbacks, the stored preference, table-based dates and relative names in both
locales, counts and percentages, money presentation byte-identical to the domain in
Spanish, catalogue completeness and placeholders, the bound translator), rewrites the
amount-field cases in `typography.node.ts` (a size-only layout, identical at "999 → 1.000"
and "999.999 → 1.000.000", the anchored row with no transform, the caret after the
formatted digit, the catalogue label) and extends `ui-rows.node.ts` (SelectionRow,
the stacked currency row and its read-only form, DetailRow stacking, Stat/StatRow at
large text, segmented caps, and EntryRow / AccountRow / TransferRow with two-line names
and amount-aware stacking through `rowStacks`); every route harness mocks `src/i18n/format` and
`src/i18n/provider`. It also updates
the navigation, Más, Cards, composer and quick-action guards for the centre tab, the
pushed Tarjetas screen and the glass branch. These are **not** native rendering/gesture tests;
use the physical checklist. The root suite also tests the shared monthly summary
and spending report, including exact category-to-entry reconciliation.

For the intermittent black-tab report, update to `master`, restart with
`npm start -- --clear` (bundler cache only, not SQLite), reopen from the new QR,
and repeat the **Interfaz 02** tab checks, **Interfaz 03** report checks and
**Interfaz 04/05** correction/recovery and transfer checks, plus **Interfaz 06** daily/comparison reports and **Interfaz 08** recurring/upcoming
checks, plus **Interfaz 10** cards/debts and five-tab checks and **Interfaz 11** Home,
Movimientos and detail checks, **Interfaz 12** form checks, **Interfaz 13** Reportes checks, **Interfaz 14** budgets/recurring/accounts checks, **Interfaz 15** motion checks, **Interfaz 16** cohesion checks, **Interfaz 17** identity and money-input checks **Producto 18** Más / Tarjetas / amount-shortcut checks, **Producto 19** budget checks, **Producto 20** account/category identity checks **Producto 21** Assistant checks, **Producto 22** reachability/material checks, **Producto 22.1** clarity checks and **Producto 23.0** amount-field, row and localization checks. The current footer (Más) says Producto 23.0.
Before updating, save a private pilot copy; do not uninstall or add fake movements.

If a storage/refresh error occurs, the form retains the exact submitted command
for retry and locks its inputs, rather than reusing its ID for different data.
A post-commit refresh error also exposes a global verification warning. Retry the
same command or verify the current records before entering anything again. Local
audit receipts prevent a late retry from repeating/reversing a later change.

`react-native-svg` is pinned to the Expo SDK 57 bundled version (15.15.4) and draws
only the category donut; it works in Expo Go. For dependency changes, also run `npm ls --all` and `npm audit`. Keep the scoped patched
decoder/UUID compatibility intact; do not run `npm audit fix --force`, which can
replace Expo packages with incompatible major versions.

`export:ios` bundles JavaScript/assets for iOS with Metro. It is **not** an Xcode
compile, signed `.ipa`, simulator run or evidence of gesture/Face ID behavior.
If network access blocks Expo's compatibility endpoint, `EXPO_OFFLINE=1 npm run check`
only checks the locally bundled compatibility information; Expo labels that result
less reliable. The GitHub job also runs the normal online check.

From the repository root, also run the existing web checks:

```bash
npm ci
npm test
npm run build
npm run check:repo
```

## Source map

- `app/`: Expo Router routes, tabs, detail screens and native modal forms.
- `src/ui/`: shared theme, accessible controls and restrained motion.
- `src/i18n/`: locale resolution, table-based formats, typed es-AR/en-US catalogues,
  device and preference adapters and the provider (pure modules, Node-testable).
- `src/assistant/`: the Assistant conversation model, client boundary, runtime selection
  and test fixtures (no React, no network in the model).
- `src/integrations/`: the HTTPS integration client and the on-device evidence builder.
- `src/storage/`: SQLite repository and React data provider.
- `../../packages/domain`: pure typed financial helpers, with legacy helpers reused.
- `app.config.ts`: isolated app identities, plugins and optional real Expo project ID.
- `eas.json`: build/distribution profiles; no credentials.

Keep native code local to this app when added. Root `ios/` belongs to Capacitor.
Generated `apps/mobile/ios/` and `android/` are ignored; Expo creates them during
cloud build. No generated app, personal backup or signing secret belongs in Git.
