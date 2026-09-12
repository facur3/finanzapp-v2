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
its focused physical re-test is pending. Next: posted-entry edit/undo and safe import.

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
The draft can be changed before Save; editing/deleting posted entries and transfers
are part of the next ledger milestone, not implemented controls in this pilot.

The current visual iteration includes:

- Home: available balance by currency, expense/income actions, recent records and
  a short account list. The full account list groups by currency. Selecting USD
  on Home preselects an existing USD account when opening the draft.
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
- A distinctive balance surface, category symbols and a searchable chooser that
  reuses existing category strings or accepts a custom one. No auto-reclassification.
- Tu mes: exact recorded income/expenses by currency, through today. No opening
  balance counted as income; unsafe aggregate totals get an unavailable state.

No database migration, Supabase connection, seeded records or native paid service
was introduced by this UI change. Follow the new-iteration section of the
[device checklist](../../docs/mobile-device-checklist.md) before accepting its layout.

Only enter a small amount of data while checking the experience. Do not re-enter
the entire portfolio or uninstall the existing app. Legacy import, complete card/
investment accounting, Supabase sync, Face ID, reminders and Apple Pay capture
are separate roadmap milestones; no disabled decorative buttons imply otherwise.

The pilot can export its own JSON backup through the system sharing sheet. It is
**not** the legacy web backup format; restore/import is still a later milestone.
Export/share is an explicit user action, never an automatic upload. SQLite is
local storage, not a backup or a claim of application-level encryption.

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
The 29 mobile tests include a configuration regression guard over the real tab
layout. This guard is **not** a native tab-switch test; use the physical checklist.
The root suite also tests the shared monthly summary.

For the intermittent black-tab report, update to `master`, restart with
`npm start -- --clear` (bundler cache only, not SQLite), reopen from the new QR,
and follow the **Interfaz 02** section of the device checklist. Do not uninstall.

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
