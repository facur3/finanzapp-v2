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
hierarchy with budget context. The spending-first decision remains authoritative,
with device checks still an explicit gate.

Inicio → Reporte mensual offers Categorías / Día a día and Comparar gastos. Current
months compare equal initial day counts (both capped if the previous month is
shorter); historical months compare full months. Exact date ranges stay visible.
Category totals open only their dated expenses. Missing records are not savings.
Native backup/recovery stays available, but no JSON import is required to start.

## Product scope (Interfaz 11)

[Decision 002](../../docs/decisions/002-spending-first.md) selects spending and
commitments with optional accounts. No native portfolio or market data. The old
MonthCard and balance hero are removed; new period/category drill-downs reuse the
native stack. No SQLite migration or loss of existing records.
Cloud AI replaces the earlier local-parser plan. [Integration contracts/setup](../../docs/mobile-integrations.md)
describe the disabled-by-default API, bounded provider adapter, pending inbox,
and remaining auth/consent/Shortcut/audio UI. No paid calls or remote SQL were run.
The sparkles control opens an explicit preview of the future Assistant; it never
claims a model is active and sends no financial data.

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
remains in Ajustes → Movimientos deshechos, including after closing/reopening.
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

Ajustes → Recurrentes creates weekly, monthly or yearly expense/income rules tied
to a real account. Each rule stores its next date and a stable calendar anchor,
so a January 31 schedule can use February 28 and return to March 31 instead of
drifting permanently. Opening/resuming the app posts due active occurrences into
the normal ledger and advances the rule in the same SQLite transaction. Each
occurrence has a deterministic ID, so retry/restart cannot silently double-charge.
Pausing keeps prior history and reactivation skips dates that elapsed while paused.
Home shows up to three real upcoming expense commitments for the selected currency;
the Recurrentes screen also shows a 30-day forecast without mixing ARS and USD.

Tarjetas holds credit cards, debts and receivables. A card is a hidden internal
account: registering a purchase posts **one expense** to the card (it counts in
Movimientos, Reportes and Presupuestos and raises the card's recorded debt).
**Pagar tarjeta** records a transfer from a cash account into the card: cash goes
down, debt goes down, and no second expense is created. Closing and due dates are
calculated from the days you enter; there is no bank statement, pending state or
card control. A debt ("Debo") or receivable ("Me deben") is also a hidden account
whose opening balance is the principal; each payment or collection is a transfer
capped at the outstanding amount. Expenses, income and recurring rules can never be
posted to a debt account. Home's Disponible excludes cards, debts and receivables.

Ajustes → Presupuestos stores category limits for one month and one currency. Only
recorded expenses consume them; income and internal transfers do not. Budgets can be
edited or archived without changing historical movements or account balances. Home
shows the current-month budget only when meaningful and distinguishes its remaining
limit from the separately calculated account balance.

The current visual iteration includes:

- Home: one large number toggles between recorded period **Gastos** and recorded-account
  **Disponible**, with separate currency semantics. Spending keeps week/month charts,
  top categories and scoped recent entries. Accounts are reached from the header or
  Settings. Opening balance is optional (zero tracking baseline, not bank sync).
  Selecting USD preselects a compatible account in the entry draft.
- Movements: virtualized date groups, accent-insensitive concept/category/account
  search and expense/income filters. Search does not mutate the stored entries.
- Forms: emphasized amount, iOS keyboard Done, compact account chooser and a native
  date sheet with separate draft/confirm/cancel. Save still waits for durable storage.
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
personal_debts. Neither replaces existing balances, entries, transfers or schedules.
Do not revert to older app code after upgrading. A newer DB version is refused
intact; no error deletes the file. No Supabase connection, seeded records, new
runtime dependency or paid service was introduced. Follow the new-iteration section of the
[device checklist](../../docs/mobile-device-checklist.md) before accepting its layout.

Only enter a small amount of data while checking the experience. Do not re-enter
the entire portfolio or uninstall the existing app. Legacy import, card installments,
Supabase sync, Face ID, reminders and Apple Pay capture are separate roadmap
milestones; no disabled decorative buttons imply otherwise.

The pilot exports its own v6 JSON backup through the system sharing sheet and
imports native v1 to v6 backups through Ajustes → Importar copia. Review shows new
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
Export validates its own restore format/size. V6 includes current versions,
tombstones, recurring schedules, monthly budgets and card/debt profiles, **not** full
local account/entry/transfer audit history, settings, attachments or investments. A backup is a snapshot, not a cross-device synchronization.
There is no replace/reset import mode; preserve both copies if conflicts are reported.
File selection/sharing is explicit, not an automatic upload. The selected source
file is never edited/deleted. Export is plain JSON, not encrypted or authenticated;
store privately. SQLite is local storage, not a substitute for a private backup.

## Signed iPhone builds without a Mac

1. Create a free Expo account and enroll in the Apple Developer Program when ready
   for a signed iPhone build. Apple enrollment requires the owner's identity/payment.
2. In this directory run `npx eas-cli@latest login`, then
   `npx eas-cli@latest init` to create/link **your** Expo project. If EAS asks for
   the project ID in the dynamic config, copy the actual UUID shown into a local
   `.env.local` file as `EXPO_PUBLIC_EAS_PROJECT_ID=<your-project-uuid>`.
   Set the same public value in the Expo project's `development` and `preview`
   environments. It identifies a project; it is not a credential. Never invent it.
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
The mobile tests include guards over the real five-tab layout, report/recovery/transfer
handlers, the Cards tab, card/debt detail, the locked card-payment form and
bar-animation configuration. These are **not** native rendering/gesture tests;
use the physical checklist. The root suite also tests the shared monthly summary
and spending report, including exact category-to-entry reconciliation.

For the intermittent black-tab report, update to `master`, restart with
`npm start -- --clear` (bundler cache only, not SQLite), reopen from the new QR,
and repeat the **Interfaz 02** tab checks, **Interfaz 03** report checks and
**Interfaz 04/05** correction/recovery and transfer checks, plus **Interfaz 06** daily/comparison reports and **Interfaz 08** recurring/upcoming
checks, plus **Interfaz 10** cards/debts and five-tab checks and **Interfaz 11** Home,
Movimientos and detail checks. The current footer says Interfaz 11.
Before updating, save a private pilot copy; do not uninstall or add fake movements.

If a storage/refresh error occurs, the form retains the exact submitted command
for retry and locks its inputs, rather than reusing its ID for different data.
A post-commit refresh error also exposes a global verification warning. Retry the
same command or verify the current records before entering anything again. Local
audit receipts prevent a late retry from repeating/reversing a later change.

For dependency changes, also run `npm ls --all` and `npm audit`. Keep the scoped patched
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
- `src/storage/`: SQLite repository and React data provider.
- `../../packages/domain`: pure typed financial helpers, with legacy helpers reused.
- `app.config.ts`: isolated app identities, plugins and optional real Expo project ID.
- `eas.json`: build/distribution profiles; no credentials.

Keep native code local to this app when added. Root `ios/` belongs to Capacitor.
Generated `apps/mobile/ios/` and `android/` are ignored; Expo creates them during
cloud build. No generated app, personal backup or signing secret belongs in Git.
