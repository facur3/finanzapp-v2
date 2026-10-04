# FinanzApp

FinanzApp is a native personal-finance app for everyday spending and commitments: fast capture,
understandable spending, upcoming payments, budgets, cards and debts, optional simple accounts in
any currency with consolidated totals in one display currency, an Assistant that proposes drafts
and answers questions from the ledger, and local data that works without connectivity. It is built
with **Expo, React Native and TypeScript** in `apps/mobile`: iOS first, Android later from the same
project ([decision 004](docs/decisions/004-native-first-and-web-retirement.md)).

## Dirección del producto

La app se enfoca en **gastos y compromisos cotidianos**, con cuentas simples opcionales. Inicio
muestra el gasto del mes o el dinero disponible; cada cuenta conserva su moneda original y, por
defecto, los totales se consolidan en una moneda elegida con cotizaciones de referencia fechadas,
solo en la vista (nada almacenado se convierte; [docs/currency.md](docs/currency.md) §2.8).
Tarjetas, deudas, recurrentes y presupuestos están en la app; inversiones y patrimonio quedan
fuera del alcance. La primera apertura es breve y nativa: una bienvenida con el idioma y la región
detectados (y una vía secundaria para cambiarlos) y una primera cuenta opcional con la moneda que
sugiere la región; Omitir salta el resto y conserva lo ya elegido, y la app funciona con datos
vacíos. El Asistente es una capacidad central: propone
movimientos y cambios como borradores, pide la aclaración mínima y responde preguntas con datos
verificables del libro; nunca escribe sin confirmación. La IA en la nube es opcional, acotada y
con clave en el servidor; el registro manual y los datos locales funcionan sin conexión.

La app tiene cuatro pestañas (Inicio, Movimientos, Reportes y Más, con Tarjetas dentro de Más) y,
al lado y fuera de ellas, una acción «+» que abre Registrar: Asistente, Gasto, Ingreso y
Transferencia. El Asistente es una pantalla que se abre sobre la app, con la conversación en
memoria mientras la app está abierta. La identidad visual es Forest, un verde pino sobrio
([decisión 005](docs/decisions/005-forest-four-tabs-and-capture.md)).

- [Decisión 002: gastos primero, alternativas y alcance](docs/decisions/002-spending-first.md)
- [Decisión 004: la app nativa es el producto](docs/decisions/004-native-first-and-web-retirement.md)
- [Decisión 005: Forest, cuatro pestañas y una acción de registro](docs/decisions/005-forest-four-tabs-and-capture.md)
- [Base de IA en nube y Atajos: qué funciona y qué falta](docs/mobile-integrations.md)

## Repository structure

| Path | What it is |
| --- | --- |
| `apps/mobile/` | The app: Expo Router screens (`app/`, the four tabs, the Assistant screen, the first opening, detail and form screens), UI, i18n, storage (SQLite, backups, the rate cache), the consolidated views (`src/fx`) and the Assistant client (`src/`), Node tests (`tests/`), catalogue generators (`scripts/`), `app.config.ts`, `eas.json`. Own `package-lock.json`. |
| `packages/domain/` | `@finanzapp/domain`: the typed, side-effect-free financial rules (integer minor units per currency, calendar days, ledger, transfers, budgets, liabilities, reports, recovery, merchant identity, exact FX for views). Imports nothing outside the package. Tested at the root with vitest. |
| `packages/integrations/` | The Assistant and capture contracts shared by the app and the backend. |
| `server/mobile/`, `api/mobile/` | The mobile backend: authenticated handlers, quotas, the capture inbox, the AI responder, the PostgreSQL schema and its tests; the two Vercel function entry points (`/api/mobile/assistant`, `/api/mobile/captures`). Off until the owner configures it. |
| `docs/` | Roadmap, design direction, i18n, currencies, device checklist, decisions, the delivery history. |
| `LICENSES/` | The licence of the CLDR data behind the currency and region catalogues. |
| `scripts/` | Root tooling: `check-repo.mjs` (repository hygiene, run by CI) and its test. |
| `.github/workflows/ci.yml` | CI: the `mobile`, `mobile_api` and `domain` jobs. |
| `package.json`, `package-lock.json` | Root tooling only (vitest, typescript) for `packages/`, `server/` and `scripts/`. |
| `vercel.json` | The Vercel project that hosts `api/mobile/*`; it serves no web page. |

## Platforms

- **iOS** is the platform being built and tested: development builds on the owner's registered
  iPhone through EAS, from Linux or Windows (no Mac). Nothing is on TestFlight or the App Store yet.
- **Android** will be built from this same project, sharing the router, the domain, the storage
  abstractions, i18n, the Assistant and the components. Platform differences live behind
  `Platform.OS`, `.ios.tsx`/`.android.tsx` files or adapter modules (`DateField` and the first
  opening's hardware back already have their Android path), never in a second repository. Nothing
  Android-specific is tested yet; it is a roadmap item, not a promise of a date.

## Run the app

```bash
cd apps/mobile
npm ci
npm run start:dev-client -- --clear     # Metro for the installed FinanzApp Dev build
npm run start                           # Expo Go: a first look only, not the shipping app
```

Everything about the iPhone workflow (EAS development builds, device registration, TestFlight
after the device gate), the verification commands, the preview flags and the test inventory is in
[apps/mobile/README.md](apps/mobile/README.md) and [docs/empezar-en-iphone.md](docs/empezar-en-iphone.md).
No EAS cloud build, subscription or store submission is made without the owner's account setup
and authorization.

## Verify

```bash
cd apps/mobile
npm run typecheck && npm run test:storage        # TypeScript, and the tests over real SQLite
npm run currency:verify && npm run regions:verify
npm run i18n:check -- --strict && npm run check && npm run export:ios
```

From the repository root:

```bash
npm ci
npm test              # vitest: packages/domain, server/mobile and scripts/check-repo
npm run check:repo    # repository hygiene (below)
```

## Read before changing anything

- [AGENTS.md](AGENTS.md): the rules for contributors and agents.
- [docs/mobile-roadmap.md](docs/mobile-roadmap.md): status, device QA pending, next deliveries
  (the real Assistant in focused 25A slices, Wallet Shortcut Capture, international purchases, the remaining regions,
  Android, TestFlight); [docs/mobile-roadmap-history.md](docs/mobile-roadmap-history.md): the detailed
  history of every delivery.
- [docs/mobile-design.md](docs/mobile-design.md): the visual and motion direction;
  [docs/merchant-identity.md](docs/merchant-identity.md): merchants, brand marks and recurring history.
- [docs/competitive-landscape.md](docs/competitive-landscape.md): the competitive capability map, the feature-gap map and the
  research gates (Mercado Pago, bank connections, WhatsApp, shared expenses), discovery only; [docs/brand-brief.md](docs/brand-brief.md):
  the public name and identity brief («FinanzApp» is the working name; no name chosen, no palette change);
  [docs/go-to-market.md](docs/go-to-market.md): positioning, social channels, content, the organic-to-paid loop,
  retention experiments and the funnel, planning only.
- [docs/mobile-device-checklist.md](docs/mobile-device-checklist.md): what only an iPhone can verify.
- [docs/i18n.md](docs/i18n.md) and [docs/currency.md](docs/currency.md): languages, regions,
  currencies, the multi-currency engine and the consolidated views.
- Decisions: [001 native mobile](docs/decisions/001-native-mobile.md),
  [002 spending-first](docs/decisions/002-spending-first.md),
  [003 cards as accounts](docs/decisions/003-five-tabs-and-cards.md) (its five tabs and visual
  system superseded by 005),
  [004 native-first](docs/decisions/004-native-first-and-web-retirement.md),
  [005 Forest, four tabs and the «+» capture action](docs/decisions/005-forest-four-tabs-and-capture.md).

User data starts empty: the app never seeds balances, movements or market history. Money is
stored in integer minor units per currency; currencies are never mixed without a dated, sourced
rate, and only in a view (Inicio, Reportes and their details consolidate totals in a display
currency with reference rates from Frankfurter, exact and per movement date; a missing rate shows
per-currency subtotals, never a partial total). Writes are saved locally before success is
confirmed, and a failed write keeps the draft.

## Continuous integration

`.github/workflows/ci.yml` runs on every push and PR: `mobile` (isolated install, dependency
tree, Expo compatibility, typecheck, the currency and region catalogue locks, the localization
catalogues, the SQLite tests, the iOS JavaScript export), `mobile_api` (the PostgreSQL inbox,
ownership and quota tests) and `domain` (the root vitest suite over `packages/domain`,
`server/mobile` and the repository guard, then `npm run check:repo`).

## Hosting

The Vercel project `finanzapp-v2` deploys `api/mobile/*` as functions from this repository; its
static output holds only a plain `404.html` (Vercel refuses an empty output directory), so `/`
and every other path answer 404 and no web page is served. Without the
owner's configuration (`server/mobile/runtime.js` reads `MOBILE_INTEGRATIONS_ENABLED`,
`MOBILE_SUPABASE_URL`, `MOBILE_SUPABASE_PUBLISHABLE_KEY`, `MOBILE_AI_ENABLED`,
`MOBILE_OPENAI_API_KEY`) every endpoint fails closed: `GET` answers 405, `POST` answers 503;
once configured, a request without a session answers 401. The app's API origin is
`EXPO_PUBLIC_MOBILE_API_ORIGIN` (apps/mobile/README.md).

This project is the mobile API's host on purpose, not a leftover of the retired web frontend: the two functions are the
only thing it serves. Why it stays for the Assistant's staging, how it relates to Supabase and the AI provider, and the
criteria for reconsidering it are in [docs/production-plan.md](docs/production-plan.md) (§2 to §4); the path to
TestFlight and the App Store is in [docs/app-store-launch.md](docs/app-store-launch.md). Both are plans: no production
environment, cloud Assistant, subscription or store listing exists yet.

## Files that must never be committed

- `node_modules/`
- `dist/`, `.expo/`, `apps/mobile/ios/`, `apps/mobile/android/`
- `.env`, `.env.*`
- logs (`*.log`)
- OS junk (`.DS_Store`, `Thumbs.db`, …)
- local screenshots, backups, temporary QA artifacts
- `*.ipa`, `*.apk`, `*.aab`, `*.p12`, `*.p8`, `*.mobileprovision`, `*.keystore`, `*.sqlite*`
- credentials of any kind: private keys, service-account files, provider tokens, a real
  FinanzApp backup

`npm run check:repo` and CI enforce this: the guard fails on tracked generated files, on the
return of the frontend retired in 2026 (its history is the tag `web-frontend-final`; it is not
part of the product and is never restored), on a product source importing a retired path, on
sensitive file names and on credential-shaped content. The repository is public: no financial
backups, screenshots with real data, tokens, signing keys or bank credentials.
