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

**Producto 23.1A (2026-09-23)** splits the locale into two independent, live
preferences. `src/i18n/locale.ts` has a `LANGUAGES` registry (es, en) and a `REGIONS`
registry (AR, US, each with its separators, numeric date order, clock and the currency a
bare "$" names); `AppLocale` is only their composition (`es-AR`, `en-AR`, `es-US`,
`en-US`), and `resolveLanguage` / `resolveRegion` decide each half from its own stored
preference and the device (languages in order; the region from the device's Region
setting, never from a second language), with separate release gates
(`RELEASED_LANGUAGES = ['es']`, `RELEASED_REGIONS = ['AR']`). In `format.ts` words
follow the language and conventions follow the region; with Argentina every output is
byte-identical to before. Catalogues are per language (`messages/es.ts`,
`messages/en.ts`). `store.ts` is a pure live store (save first, apply second; unreleased
values refused; the state object changes only when something visible changes; the
device is re-read when the app returns to the foreground) and `I18nProvider` subscribes
to it with `useSyncExternalStore`, so a change re-renders only `useI18n()` consumers:
the ledger provider, the navigation, the current screen, a draft and the Assistant
conversation are not remounted. Más → App y datos → **Idioma** (`app/language.tsx`,
`CheckRow`) lists "Según el dispositivo" and Español; English is not offered until the
translation is complete. **Región** (`app/region.tsx`) is built and tested but not
linked from Más until 23.1C, because the amount field still types Argentine separators.
Both preferences live in the expo-sqlite key-value store (`finanzapp.language`,
`finanzapp.region`), outside the ledger and backups. No native change: the installed
FinanzApp Dev with Metro is enough.

**Producto 23.1B1 (2026-09-23)** moves navigation (tab labels, header actions, every
stack header), Inicio, Movimientos, the movement and transfer details and forms, and
the shared rows and selectors to the catalogues; 23.1B2 does the remaining screens.
Rules for new copy: every visible string, placeholder and VoiceOver label is
`t('area.meaning')` from `useI18n()`; counts are plural entries (`{ one, other }` with
`{count}`); a screen title is set from `useI18n()` so it re-titles in place. A form
stores its own error as a catalogue key (`setError('entryForm.saveUnverified')`,
`throw new Error('entryForm.futureDate')`) and `ErrorMessage` translates it when shown;
a domain or storage message is translated when its exact Spanish text is catalogued
under `errors.*` (keep both in sync; a test checks). Built-in categories show
`categories.<kind>.<key>` in the interface language through `useCategoryLook`; the
stored string, key, budgets and history never change, and custom, renamed or
historical categories are never translated. `AccountField` needs `typeOf` (the ledger's
`accountKind`) to draw card and debt glyphs; never infer meaning from a translated
label. English stays unreleased (`RELEASED_LANGUAGES = ['es']`).

**Producto 23.1B2 (2026-09-24)** translates every remaining screen and splits the
catalogues into per-area modules (`src/i18n/messages/<language>/<area>.ts`, composed in
`index.ts`; `messages.ts` stays the typed entry). Plurals follow each language's CLDR
rule. Every domain and storage error is catalogued by its exact text (templates
included). Before a PR that adds copy run `npm run i18n:extract` (copy outside the
catalogue) and `npm run i18n:check` (keys, placeholders, plurals, stale translations);
after reviewing English changes, `npm run i18n:check -- --accept en`. A new language
starts with `npm run i18n:export -- <lang>`. The whole process, the glossary, RTL, the
Crowdin plan, the library evaluation and the error-code migration are in
[`docs/i18n.md`](../../docs/i18n.md).

**Producto 23.1C1 (2026-09-24)** prepares the regional formats without releasing them.
The amount field types and pastes in the region's separators (`src/ui/money-input.ts`,
`AmountInput`; Argentina 1.234,56, United States 1,234.56) while the form's draft stays in
the ledger notation that `parseMinorUnits` reads, so a region change with a form open
keeps the value, the draft and the caret. A paste that could mean two amounts ("1,000"
in Argentina) is refused with a note, never guessed. Every visible amount goes through
`moneyText`/`formatAmount` (region), every VoiceOver amount through `spoken*` (the
interface language's separators), prefills through `draftFromMinor`; a test forbids
`formatMinorUnits` and hand-written currency signs in `app/` and `src/ui/`. The date
picker takes the interface locale. English and the US region stay unreleased (23.1C2
opens them with `supportedLocales`, a new EAS build); to check them on FinanzApp Dev
now, start Metro with `EXPO_PUBLIC_LOCALE_PREVIEW=1 npm run start:dev-client -- --clear`
(development bundles only; Más then lists English and Región). No SQLite, backup, accounting or
native change: FinanzApp Dev runs it from Metro. Details and iOS limits:
[`docs/i18n.md`](../../docs/i18n.md) §9.

**Producto 23.1C2 (2026-09-24)** releases English and the United States
(`RELEASED_LANGUAGES = ['es', 'en']`, `RELEASED_REGIONS = ['AR', 'US']`): Más → App y
datos lists Idioma and Región for everyone, both independent, persistent and live, with
"Según el dispositivo" first. `app.config.ts` declares the released languages to iOS
(`expo-localization` plugin, `supportedLocales: { ios: ['es', 'en'] }`, kept equal to
`RELEASED_LANGUAGES` by a test), makes Spanish iOS's fallback language
(`CFBundleDevelopmentRegion`) and always offers the per-app language row
(`UIPrefersShowingLanguageSettings`): **this needs a new EAS development build**. The
provider re-reads the device on iOS's locale-change event as well as on return to the
foreground, and a failed read keeps the last good one. VoiceOver numbers use the
language's decimal mark without grouping ("1234,56 pesos"), labels built by the generic
rows speak their amounts, and FinanzApp sets `accessibilityLanguage` only when the
interface language differs from the device's. The date wheel takes the language's home
locale (`es_AR`/`en_US`), so its months and column order match the row. The Assistant
shows only its own notes on failure and resolves income chips as income; its request
still carries no language (design in [`docs/i18n.md`](../../docs/i18n.md) §11).
`EXPO_PUBLIC_LOCALE_PREVIEW` no longer changes anything (everything the build carries is
released) and a release bundle cannot use it (`tests/locale-release.node.ts`). A
bilingual review fixed real copy errors in both catalogues. No SQLite, backup, accounting
or currency change. Details, precedence and iOS limits: [`docs/i18n.md`](../../docs/i18n.md) §10.

**Producto 23.2 (2026-09-24)** is stabilization only. The five Expo SDK 57 maintenance
releases that `expo install --check` asked for after the 23.1C2 merge (`expo` 57.0.25,
`expo-glass-effect` 57.0.4, `expo-linking` 57.0.11, `expo-router` 57.0.23, `expo-sharing`
57.0.22, plus the patch releases they require) are installed with `expo install --fix`;
no SDK change and no other dependency moves. It also records the per-app Language
diagnosis. **The installed binary is what counts, not `app.config.ts`**: download the
IPA of the build installed on the iPhone and read its compiled `Info.plist`:

```bash
npx eas-cli@latest build:list --platform ios --limit 5          # the build ID and its commit
npx eas-cli@latest build:view <id> --json                        # artifacts.applicationArchiveUrl
curl -sSL -o app.ipa "<applicationArchiveUrl>" && unzip -qo app.ipa 'Payload/*'
python3 -c "import plistlib,glob; p=plistlib.load(open(glob.glob('Payload/*.app/Info.plist')[0],'rb')); [print(k, type(p.get(k)).__name__, p.get(k)) for k in ('CFBundleLocalizations','CFBundleDevelopmentRegion','UIPrefersShowingLanguageSettings')]"
```

Development build `1d69d2d4` (commit `cc6f6f9`) reads `list ['es', 'en']`, `str es`,
`bool True`; the earlier development builds `bad52629` and `ed369b28` have neither key and
`en` as development region. Every development build reports version 0.1.0 (1), and a
development client runs whatever JavaScript Metro serves, so Más working in English does
**not** identify the binary. iOS's own text does: on a Spanish iPhone the text-field menu
reads Pegar/Copiar only on a binary that declares its languages. Steps:
[device checklist](../../docs/mobile-device-checklist.md) § Producto 23.2.

**Producto 24A (2026-09-24)** lays the foundations of the multi-currency engine
without changing what is stored or shown. `npm run currency:generate` builds the ISO
4217/CLDR catalogue (`packages/domain/currency-data.ts`, `src/i18n/currencies/<lang>.ts`)
from pinned sources (`scripts/currency/sources.lock.json`; `-- --download` refreshes them,
`-- --check` proves the committed files match). `packages/domain/currency.ts` holds the
statuses (`ledger` ARS/USD, `ready`, `incomplete`, `excluded`) and each currency's stored
scale (the ISO minor unit); `money.ts` is the exact amount model (no floating point, no
FX). `format.ts` formats any currency with its own decimals, CLDR symbols and names;
ARS and USD are byte-identical (`tests/currency-presentation.node.ts`). Forms still offer
exactly ARS and USD; SQLite and backups are untouched. Data, licences, limits, the 24B
plan and the 24C contract: [`docs/currency.md`](../../docs/currency.md).

**expo-localization needs a new development build.** It is a native module: Expo Go
already contains it, but a FinanzApp Dev binary compiled before this PR does not, and
Metro cannot add native code. On such a binary the app still starts and works:
`src/i18n/device-runtime.ts` first asks `requireOptionalNativeModule('ExpoLocalization')`
and only evaluates the package when the module is registered, because evaluating it
without the module throws "Cannot find native module 'ExpoLocalization'" and Metro's
development runtime shows that error even when the caller catches it (the first device
run of this PR). Without the module, the **fallback** keeps: the device's primary
language through Hermes `Intl` (since 23.1C2 the bundle-matched language, es or en, with the device region), every
date, percentage and amount format (they come from FinanzApp's own tables, not from the
device), the catalogues and the stored language preference. It loses: the ordered list
of preferred languages beyond the first and the device's Region setting (the region
then comes from the Intl tag; since English and the United States are released this
matters, so use a build that links the module: every FinanzApp Dev since 23.0 does). Changes of the device settings are picked up when the app returns to the
foreground (23.1A) and, since 23.1C2, on the module's locale-change event. The Más footer says which path this launch
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

Since Producto 24B4 the SQLite file is schema 9: the currency CHECKs of `accounts` and
`monthly_budgets` accept any ISO-shaped code (which codes may be stored is the domain's decision)
and `currency_units` pins the minor-unit exponent of every currency other than ARS/USD the ledger
comes to hold, once, with its source and catalogue version. ARS and USD are never pinned and read
as cents. Every read checks that each currency present has its pinned scale and that it equals the
catalogue's; a disagreement refuses to open the data by name, never rescales or resets. The upgrade
from schema 8 runs once, in its own transaction with foreign keys off and a `foreign_key_check`
before commit; **an earlier build refuses a schema 9 file**, so keep a backup before updating a
device. Backups stay v8 while the ledger holds only ARS and USD; a ledger with another currency
exports v9, which adds `currencyUnits`. Production still creates ARS and USD only.

**Testing other currencies on FinanzApp Dev (24B5).** A development bundle started with
`EXPO_PUBLIC_CURRENCY_PREVIEW=1 npm run start:dev-client -- --clear` offers EUR, GBP, JPY, CLP and
KWD in every form (the preview gate, `src/storage/currency-gate.ts`) and says so under the Más
footer. A release or preview build compiles the flag away and offers ARS and USD whatever the
environment says (`tests/currency-preview.node.ts`). Rows created in a preview currency stay
readable, exportable (v9) and restorable when the flag is off; only creating new ones is refused.
Never set the flag in `eas.json`, `app.config.ts` or a committed `.env`.

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
npm run currency:verify                # offline: the committed catalogue matches the lock (CI runs this)
npm run regions:verify                 # offline: the committed region catalogue matches its lock (CI runs this)
npm run regions:generate -- --check    # needs the cached CLDR sources (-- --download once); release checklist
npm run i18n:check                     # catalogues, placeholders, plurals, generated currency-name modules (CI runs this)
npm run currency:generate -- --check   # needs the cached sources (-- --download once); release checklist
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
`src/i18n/provider`. Producto 23.1A rewrites the locale cases of `i18n.node.ts`
(the two registries and the four combinations, tag parsing, language and region
resolution with the release gates, unsupported device languages and regions, both
preference keys with failing reads and writes, words by language and conventions by
region) and adds `locale-switch.node.ts`: the live store (save first, no change on a
failed write, the gate, device refresh) and the real `I18nProvider` and Idioma screen on
a real React reconciler (`react-test-renderer`, a dev dependency): switching language
and region with a form draft and an Assistant conversation mounted changes the labels,
amounts and header title in place with no remount and no re-render of the ledger
provider. Producto 23.1B1 adds `translation.node.ts` (no hard-coded copy left in the
translated files, every key the code asks for exists, parameterless calls have no
placeholders, complete and really-English catalogues, plurals, placeholders, error
localisation and catalogued errors still thrown verbatim, built-in category identities
unchanged, picker and Movimientos search, row dates identical to `labelFromISO`, length
budgets for segments, tabs, buttons and headers) and English cases to
`recovery-routes.node.ts` (a movement saved in English equals the Spanish one, a
mid-draft switch keeps the fields, errors in either language, detail and transfer form),
`navigation.node.ts` and `spending-home.node.ts`; those harnesses read a switchable
locale. Producto 23.1B2 adds English cases to every area's harness (reports, liabilities,
budgets, polish, personalization, more, recovery, material, assistant) and extends
`translation.node.ts` to the whole app: `i18n:extract` finds nothing, `i18n:check
--strict` is clean, CLDR plural categories, the export brief, pseudo-locales, template
errors and debt display names. Producto 23.1C1 rewrites `money-input.node.ts` around the
real `AmountInput` controller (both regions, either decimal key, lagging native text,
pastes accepted and refused, region switches with the caret), adds the four
language × region combinations to `i18n.node.ts` and `typography.node.ts` (Money and the
anchored field with "AR$"), mounts the real `AmountField` under the real provider in
`locale-switch.node.ts`, and checks in `database.node.ts` that an amount typed in either
region is stored as the same integer and that formatting never touches the ledger. Producto
23.1C2 adds `locale-release.node.ts` (the release set, `releasedForBuild` returning it for
any flag in a release bundle, a scan proving only `provider.tsx` reads
`EXPO_PUBLIC_LOCALE_PREVIEW` and no config, `eas.json` profile or `.env` sets it, and
`provider.tsx` compiled with babel-preset-expo for production with and without the flag,
then mounted: an English iPhone reads English), `voiceover.node.ts` (a TypeScript-checker
scan of every accessibility attribute and spoken twin in `app/` and `src/ui/`: no visible
formatter reaches VoiceOver, every focusable element carries `accessibilityLanguage`,
with synthetic self-checks) and `date-field.node.ts` (the wheel's props and locale in the
four combinations, open/cancel/done, a spun day surviving four locale switches, no
deprecated `onChange`); rewrites the gate cases of `i18n.node.ts`, `locale-switch.node.ts`
and `more-routes.node.ts` for the released gate with an explicit narrower gate still
tested; adds iOS's locale event, a throwing device read, relaunch, preview choices, an
explicit region ignoring the device and `speechLanguage` to `locale-switch.node.ts`, the
plugin output and Info.plist keys to `app-config.node.ts`, a v1 no-language pin to
`assistant.node.ts` and `server/mobile/handlers.test.js`, and spoken-twin, inline-date,
template and translated-error cases to the route harnesses. It also updates
the navigation, Más, Cards, composer and quick-action guards for the centre tab, the
pushed Tarjetas screen and the glass branch. These are **not** native rendering/gesture tests;
use the physical checklist. The root suite also tests the shared monthly summary
and spending report, including exact category-to-entry reconciliation.

For the intermittent black-tab report, update to `master`, restart with
`npm start -- --clear` (bundler cache only, not SQLite), reopen from the new QR,
and repeat the **Interfaz 02** tab checks, **Interfaz 03** report checks and
**Interfaz 04/05** correction/recovery and transfer checks, plus **Interfaz 06** daily/comparison reports and **Interfaz 08** recurring/upcoming
checks, plus **Interfaz 10** cards/debts and five-tab checks and **Interfaz 11** Home,
Movimientos and detail checks, **Interfaz 12** form checks, **Interfaz 13** Reportes checks, **Interfaz 14** budgets/recurring/accounts checks, **Interfaz 15** motion checks, **Interfaz 16** cohesion checks, **Interfaz 17** identity and money-input checks **Producto 18** Más / Tarjetas / amount-shortcut checks, **Producto 19** budget checks, **Producto 20** account/category identity checks **Producto 21** Assistant checks, **Producto 22** reachability/material checks, **Producto 22.1** clarity checks, **Producto 23.0** amount-field, row and localization checks, **Producto 23.1A** language-preference checks, **Producto 23.1B1** and **23.1B2** translation checks, **Producto 23.1C1** regional-format checks, **Producto 23.1C2** release checks (new development build), **Producto 23.2** installed-binary and Language-row checks (Producto 24A, 24B1, 24B2, 24B3, 24B4 and 24B5 change nothing visible in production), **Producto 24B6** date-sheet, shared-currency and card-flow checks, **Producto 24R1** the device-Region line. The current footer (Más) says Producto 24R1.
Producto 24B1 adds `currency-guards.node.ts` (the pair-literal scan with a stage-labelled allow-list, storage validating with the domain only, generated modules exempt by header, the offline `--verify` proven against a hand edit), `currency-goldens.node.ts` (ARS/USD goldens for the card face, the spending timeline and the day-net header in the four locales), MonthBars and Home Disponible goldens, and `packages/domain/multi-currency.test.ts` (EUR/JPY/KWD fixtures through every grouping, report, budget, transfer and backup path with an explicit gate; the production gate stays ARS/USD). Producto 24B2 adds `amount-exponents.node.ts` (the real `AmountInput` in JPY, KWD and EUR: typing, pasting, settling, prefills, shortcuts, a draft kept across currency changes, the sweep against `parseMinorUnits`, the `10 **` ban) and cases in `typography` (number pad at exponent 0, kept-draft notes), `report-routes` (strict route currencies), `recovery-routes` (an account change keeps the draft and blocks Save) and `assistant-routes` (the hand-off in minor units); `money-input.node.ts` names ARS in every call and keeps its goldens. Producto 24B3 adds `currency-copy.node.ts` (spoken goldens for ARS, USD, EUR, JPY, KWD, CLP and CAD in both languages; the shared-word rule and `HeldCurrenciesProvider` on a real React tree; `formatWholeUnits`; the `{name} · {code}` template; `CurrencySwitch` with one to seven currencies; the longest amount of every exponent at 320 pt and at large text) and cases in `currency-goldens`, `spending-chart`, `typography` (the field's name per currency, `Money`'s dash), `spending-home`, `report-routes`, `polish-routes` (three currencies with a stored JPY account) and `ui-rows` (the searchable currency sheet); `currency-guards.node.ts` bans currency-less presentation calls, hand-divided cents and hand-written catalogue symbols in screens. Producto 24B4 adds the schema 9 block of `database.node.ts` (a real schema 8 file with every table populated built from `SCHEMA_SCRIPTS`, its upgrade to identical rows and its reopening; an interrupted migration and a `foreign_key_check` refusal leaving schema 8 intact; JPY/KWD/EUR through an explicit gate with their scales pinned once; a disagreeing or missing scale refusing to open; the gate closed again with stored yen still readable, editable, exportable and restorable; a failed v9 restore rolling back scales with rows; replayed copies and duplicated ids never doubling a yen), the v9 block of `packages/domain/multi-currency.test.ts`, a v9 import case in `recovery-routes` and the `SELECT *` ban in `currency-guards`. Producto 24B5 adds `currency-preview.node.ts` (the development currency gate compiled with babel-preset-expo as a release and as a development bundle, and no config, profile or committed `.env` setting the flag), the searchable currency field and sheet in `ui-rows`, the forms through the preview gate in `personalization-routes`, `liabilities-routes` (which now renders the card and debt forms) and `budgets-routes`, the footer note in `more-routes`, and a seven-currency round trip through SQLite 9 and backup v9 in `database.node.ts`. Producto 24B6 adds `display-currency.node.ts` (the shared display currency: the pure store over the key-value store, resolution against the currencies held, the route precedence, and the real provider and hook on a React tree), the compact date sheet in `date-field.node.ts` (persisted hooks and effects: geometry, insets, timings, Reduce Motion, scrim cancel, the list sheets unchanged), Inicio ↔ Reportes on one store in `spending-home`, and the card rules in `packages/domain/liabilities.test.ts`, `database.node.ts` (a plain income never on a card, a historical one editable, transfer sides), `recovery-routes` (the entry, recurring and transfer forms) and `assistant.node.ts`. The review of PR #52 added a Reportes link whose currency is held only later, and card-only and mixed ledgers for the entry and recurring forms (the no-account state per kind). Producto 24R1 adds `region-catalogue.node.ts` (the region catalogue's lock and hashes, the invariants of its 257 records, the registry agreement and the one deliberate deviation, the generator's parsers and a synthetic build, the region API, a cross-check against Node's ICU), `regional-formats.node.ts` (Spanish, English and other languages bound to Japanese, British, Indian, Swiss, German, Korean, Brazilian, Hungarian and Egyptian conventions; the released pairs byte-identical; the Intl probe and its fallbacks; recent choices) and `choice-list.node.ts` (the chooser's rows and the real `ChoiceScreen`), plus the detected-region and travel cases in `locale-switch.node.ts`. The review of PR #53 added `formatDayMonth` through every binding path of Argentina and the United States (the locale, `REGIONS`, `catalogueConventions`, `conventionsForRegion`) beside the explicit Japanese, British, Swiss and Indian strings and `registryRegionOf`/`sameWriting`, and the chooser's no-match, matched and blank searches with a choice made while a search is active.
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
- `src/i18n/`: language and region registries and resolution, table-based formats,
  typed es/en catalogues, device and preference adapters, the live locale store and the
  provider (pure modules except the provider and the runtime adapter, Node-testable).
  `src/i18n/regions/` is the generated region catalogue (`scripts/regions/generate.mjs`) and
  `regions.ts` its API; `intl-support.ts` the Intl probe and fallbacks; `recent.ts` the recent choices.
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
