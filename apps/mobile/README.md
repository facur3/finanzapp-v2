# FinanzApp (native app)

FinanzApp is a native spending and commitments app: fast capture, understandable
spending, upcoming payments, budgets, cards and debts, with optional manually tracked
accounts. This directory is the product: an Expo + React Native + TypeScript app, iOS
first, Android later from this same project
([decision 004](../../docs/decisions/004-native-first-and-web-retirement.md)). The
previous web/Capacitor app was retired on 2026-09-25 (Producto 24REP); its last version is
the Git tag `web-frontend-final` ([inventory and recovery](../../docs/web-retirement-inventory.md)).
The app never shared data with it: its SQLite file, backups and preferences are its own.

Read before changing anything: [AGENTS.md](../../AGENTS.md), the
[living roadmap](../../docs/mobile-roadmap.md) (status, device QA pending, next
deliveries), the [design direction](../../docs/mobile-design.md), the
[device checklist](../../docs/mobile-device-checklist.md), [docs/i18n.md](../../docs/i18n.md)
for language and region, [docs/currency.md](../../docs/currency.md) for money and
currencies, [docs/mobile-integrations.md](../../docs/mobile-integrations.md) for the
Assistant's backend, and the decisions
[001](../../docs/decisions/001-native-mobile.md) (Expo without a Mac),
[002](../../docs/decisions/002-spending-first.md) (spending first),
[003](../../docs/decisions/003-five-tabs-and-cards.md) (five tabs, cards as accounts) and
[004](../../docs/decisions/004-native-first-and-web-retirement.md) (native first). A
plain-language Spanish walkthrough for the iPhone is
[docs/empezar-en-iphone.md](../../docs/empezar-en-iphone.md). The delivery-by-delivery
history, the former status chronology of this README and the per-delivery test inventory
live in [docs/mobile-roadmap-history.md](../../docs/mobile-roadmap-history.md).

## Architecture and responsibilities

| Where | What it owns |
| --- | --- |
| `app/` | Expo Router routes: the five tabs in `app/(tabs)/` (Inicio, Movimientos, Asistente, Reportes, Más), pushed detail screens, native modal forms, Idioma and Región, backup and recovery. Routes compose; they hold no financial rules. |
| `src/ui/` | The visual system: palette and theme, typography, accessible rows and controls, the amount field (`money-input.ts`), form controls and sheets, the motion language (`motion.tsx`), the material adapter (`material.tsx`, the only door to `expo-glass-effect`), charts, the Home modules, the merchant tile (`merchant-mark.ts`, `MerchantBadge`: the category glyph; brand marks deferred to Producto 25C2) and the searchable chooser. |
| `src/i18n/` | Language and region: the registries and release gates (`locale.ts`), table-based formats (`format.ts`), typed es/en catalogues (`messages/`), the device adapter, the preference store, the provider (`useI18n()`), the generated region catalogue (`regions/`) and its API, the Intl probe. |
| `src/storage/` | The SQLite repository (`database.ts`, schema `DATABASE_VERSION = 9`, atomic migrations, operation IDs), the native driver binding, transactions, the currency gate (`currency-gate.ts`) and `LedgerProvider`. Writes are durable before the UI confirms; a failed write keeps the draft; no error resets storage. |
| `src/assistant/` | The Assistant's pure conversation model, the event-based client boundary, runtime selection and scripted fixtures. The only ledger write is an explicit Confirmar on a draft, validated by the domain. |
| `src/integrations/` | The HTTPS client for the mobile API and the on-device evidence builder. |
| `../../packages/domain` | The typed financial domain the app imports (`@finanzapp/domain`, linked as a `file:` dependency): ledger, budgets, categories, merchant identity, appearance, liabilities, money and the currency catalogue. Amounts are integers in each currency's minor unit; no floating point, no FX. |
| `../../packages/integrations` | The request/response contracts shared with the backend. |
| `../../server/mobile`, `../../api/mobile` | The mobile backend: authenticated Assistant and capture endpoints, provider adapter, pending inbox, quotas. Disabled until the owner configures an account; no paid call is made by this repository. |
| `app.config.ts`, `eas.json` | App identities per variant, plugins, the EAS project link and the build profiles. No credentials. |

Local first: the ledger, the language, region and display-currency preferences and the
backups are on the device. Backups export as JSON v8 while the ledger holds only ARS and
USD and as v9 (adds `currencyUnits`) once another currency is stored; v1–v9 files import
after a review that never overwrites. Cloud is opt-in: the Assistant's remote runtime,
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
| `EXPO_PUBLIC_CURRENCY_PREVIEW=1` | Development bundle only: the forms also offer EUR, GBP, JPY, CLP and KWD; rows created in them stay readable and exportable (v9) when the flag is off. |
| `EXPO_PUBLIC_LOCALE_PREVIEW=1` | Development bundle only: offers every language and region the build carries, released or not (since 23.1C2 the sets are equal, so it changes nothing today). |
| `EXPO_PUBLIC_MERCHANT_MARK_PREVIEW=1` | Development bundle only: a recognized merchant's row draws the brand's initial on a neutral tile instead of its category glyph, to check recognition on the iPhone. No asset, image or dependency; brand marks are deferred to Producto 25C2 (docs/merchant-identity.md). |
| `EXPO_PUBLIC_DISABLE_GLASS=1` | Forces the opaque material everywhere; the glass module is never loaded. |
| `EXPO_PUBLIC_MOBILE_API_ORIGIN` | The origin of the mobile API for the Assistant's remote runtime; unset means disconnected. |
| `EXPO_PUBLIC_EAS_PROJECT_ID` | Overrides the default EAS project link (a fork or a second project). |
| `APP_VARIANT` | Set by the EAS profiles (`development` / `preview`): picks the bundle identifier and the app name. |

## What is released, what is only implemented

| Area | Today |
| --- | --- |
| Languages | Spanish and English released (`RELEASED_LANGUAGES`), declared to iOS by `app.config.ts`; each Más → Idioma choice and "Según el dispositivo" are live. |
| Regions | Argentina and the United States released (`RELEASED_REGIONS`). A 257-region catalogue with CLDR conventions, the device-Region detection and the searchable chooser are implemented (24R1) but not wired: every other region writes Argentine formats and the chooser says so. 24R2 opens regions after device QA. |
| Currencies | ARS and USD in production (`LEDGER_CURRENCIES`). The multi-currency engine (any ISO currency's minor units, SQLite 9, backup v9, presentation in every currency) is implemented behind the preview gate; no other currency is opened, no exchange rate exists, nothing is converted. FX and international purchases are Producto 24C, not built. |
| Assistant | A real conversation with drafts, clarifications and evidence, writing only on Confirmar; fixtures mode for tests; the remote runtime and the cloud provider are opt-in and unconfigured, so this build is disconnected. The multilingual, voice-capable Assistant with analytical answers is Producto 25A, not built. |
| Platforms | iOS only. Android comes later from this same project (roadmap §5), sharing the router, the domain, the storage abstractions, i18n, the Assistant and the components; platform differences go behind `Platform.OS`, `.ios.tsx`/`.android.tsx` files or adapter modules (`DateField` already has its Android path). Nothing Android-specific is tested. |
| Distribution | Ad hoc development builds on the owner's registered iPhone. Nothing is on TestFlight or the App Store. |

Three words mean three things here and in the roadmap: **implemented** is code with its
tests on Linux; **device-tested** is a result the owner recorded on the iPhone; **released**
is distributed to people. Today:

| | What |
| --- | --- |
| Implemented | Everything in the roadmap's §1, up to Producto 24UX2 (the Más footer reads Producto 24UX2). |
| Device-tested | The first Expo Go flow (2026-09-12), the Interfaz 15 motion direction, the per-app Language row on build `1d69d2d4`, and the owner's 24B5/24B6 sessions that produced the 24B6 and 24UX1 corrections. Every later section of the [device checklist](../../docs/mobile-device-checklist.md) is still pending, and no per-item 24B5/24B6 result is recorded. |
| Released | Nothing. No store build, no TestFlight, no production identity. |

## Rules that never bend

- Money is integer minor units per currency; ARS and USD are never mixed without a dated
  rate (none exists); cards, debts and receivables are hidden accounts; a purchase, a
  transfer and a card payment are each counted once.
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
