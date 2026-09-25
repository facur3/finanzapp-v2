# FinanzApp

FinanzApp is a native personal-finance app for everyday spending and commitments: fast capture,
understandable spending, upcoming payments, budgets, cards and debts, optional simple accounts,
an Assistant that proposes drafts and answers questions from the ledger, and local data that
works without connectivity. It is built with **Expo, React Native and TypeScript** in
`apps/mobile`, iOS first, Android later from the same project. The native app is the product
(decision 004, 2026-09-25); the previous web/Capacitor app was retired on 2026-09-25 (Producto
24REP) and its last version is preserved in Git under the tag `web-frontend-final`.

## Dirección del producto

La app se enfoca en **gastos y compromisos cotidianos**, con cuentas simples opcionales. Inicio
muestra el gasto de la semana y del mes; tarjetas, deudas, recurrentes y presupuestos están en
la app; inversiones y patrimonio quedan fuera del alcance. El Asistente es una capacidad central:
propone movimientos y cambios como borradores, pide la aclaración mínima y responde preguntas
con datos verificables del libro; nunca escribe sin confirmación. La IA en la nube es opcional,
acotada y con clave en el servidor; el registro manual y los datos locales funcionan sin conexión.

- [Decisión 002: gastos primero, alternativas y alcance](docs/decisions/002-spending-first.md)
- [Decisión 004: la app nativa es el producto; retiro de la web](docs/decisions/004-native-first-and-web-retirement.md)
- [Base de IA en nube y Atajos: qué funciona y qué falta](docs/mobile-integrations.md)

## Repository structure

| Path | What it is |
| --- | --- |
| `apps/mobile/` | The app: Expo Router screens (`app/`), UI, i18n, storage (SQLite, backups) and the Assistant client (`src/`), Node tests (`tests/`), catalogue generators (`scripts/`), `app.config.ts`, `eas.json`. Own `package-lock.json`. |
| `packages/domain/` | `@finanzapp/domain`: the typed, side-effect-free financial rules (integer minor units per currency, calendar days, ledger, transfers, budgets, liabilities, reports, recovery). Imports nothing outside the package. Tested at the root with vitest. |
| `packages/integrations/` | The Assistant and capture contracts shared by the app and the backend. |
| `server/mobile/`, `api/mobile/` | The mobile backend: authenticated handlers, quotas, the capture inbox, the AI responder, the PostgreSQL schema and its tests; the two Vercel function entry points (`/api/mobile/assistant`, `/api/mobile/captures`). Off until the owner configures it. |
| `docs/` | Roadmap, design direction, i18n, currencies, device checklist, decisions; `docs/history/` holds documents kept for the record only. |
| `LICENSES/` | The licence of the CLDR data behind the currency and region catalogues. |
| `scripts/` | Root tooling: `check-repo.mjs` (repository hygiene, run by CI) and its test. |
| `.github/workflows/ci.yml` | CI: the `mobile`, `mobile_api` and `domain` jobs. |
| `package.json`, `package-lock.json` | Root tooling only (vitest, typescript) for `packages/`, `server/` and `scripts/`. |
| `vercel.json` | The Vercel project that hosts `api/mobile/*`; it serves no web page. |

Android will be built in `apps/mobile` from the same code (navigation, domain, storage
abstractions, i18n, Assistant and the shared components): platform differences live behind
`Platform.OS`, `.ios.tsx`/`.android.tsx` files or adapter modules, never in a second repository
(decision 004). Nothing Android-specific is implemented yet.

## Run the app

```bash
cd apps/mobile
npm ci
npm run start:dev-client -- --clear     # Metro for the installed FinanzApp Dev build
npm run start                           # Expo Go: a first look only, not the shipping app
```

Everything about the iPhone workflow from Linux or Windows (EAS development builds, device
registration, TestFlight after the device gate), the verification commands, the preview flags
and the test inventory is in [apps/mobile/README.md](apps/mobile/README.md) and
[docs/empezar-en-iphone.md](docs/empezar-en-iphone.md). No EAS cloud build, subscription or
store submission is made without the owner's account setup and authorization.

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
- [docs/mobile-roadmap.md](docs/mobile-roadmap.md): status, device QA pending, next deliveries,
  launch, post-launch; [docs/mobile-roadmap-history.md](docs/mobile-roadmap-history.md): the
  detailed history of every delivery.
- [docs/mobile-design.md](docs/mobile-design.md): the visual and motion direction.
- [docs/mobile-device-checklist.md](docs/mobile-device-checklist.md): what only an iPhone can verify.
- [docs/i18n.md](docs/i18n.md) and [docs/currency.md](docs/currency.md): languages, regions,
  currencies and the multi-currency engine.
- Decisions: [001 native mobile](docs/decisions/001-native-mobile.md),
  [002 spending-first](docs/decisions/002-spending-first.md),
  [003 five tabs and cards](docs/decisions/003-five-tabs-and-cards.md),
  [004 native-first and web retirement](docs/decisions/004-native-first-and-web-retirement.md).

User data starts empty: the app never seeds balances, movements or market history. Money is
stored in integer minor units per currency; currencies are never mixed without a dated rate.
Writes are saved locally before success is confirmed, and a failed write keeps the draft.

## Continuous integration

`.github/workflows/ci.yml` runs on every push and PR: `mobile` (isolated install, dependency
tree, Expo compatibility, typecheck, the currency and region catalogue locks, the localization
catalogues, the SQLite tests, the iOS JavaScript export), `mobile_api` (the PostgreSQL inbox,
ownership and quota tests) and `domain` (the root vitest suite over `packages/domain`,
`server/mobile` and the repository guard, then `npm run check:repo`).

## Hosting

The Vercel project `finanzapp-v2` deploys `api/mobile/*` as functions from this repository; its
static output is an empty directory, so `/` answers 404 and no web page is served. Without the
owner's configuration (`server/mobile/runtime.js` reads `MOBILE_INTEGRATIONS_ENABLED`,
`MOBILE_SUPABASE_URL`, `MOBILE_SUPABASE_PUBLISHABLE_KEY`, `MOBILE_AI_ENABLED`,
`MOBILE_OPENAI_API_KEY`) every endpoint fails closed: `GET` answers 405, `POST` answers 503;
once configured, a request without a session answers 401. The app's API origin is
`EXPO_PUBLIC_MOBILE_API_ORIGIN` (apps/mobile/README.md), never derived from a web page.

## The retired web/Capacitor app

The previous product was a web app on the Claude Design runtime with `localStorage` data, an
installable PWA shell, a Capacitor iOS wrapper and market-data proxies, deployed to Vercel. It
was retired on 2026-09-25 (Producto 24REP, [decision 004](docs/decisions/004-native-first-and-web-retirement.md)):
its trees were removed with `git rm`, so every file stays in Git history, and the annotated tag
`web-frontend-final` (commit `ac4f038`) marks the last commit that contains the whole web product.
The verifiable inventory of what was removed, what was kept and what was moved is
[docs/web-retirement-inventory.md](docs/web-retirement-inventory.md); the web's release notes,
its Assistant and market-data description, its Shortcuts capture recipe and its rebuild roadmap
are kept for the record in `docs/history/`.

```bash
git show web-frontend-final:index.html > /tmp/index.html          # one file, as it was
git show web-frontend-final:src/domain/assistant.js               # the web's intent engine
git ls-tree -r --name-only web-frontend-final -- src/app public   # what a tree contained
git log --oneline web-frontend-final -- src/domain/dates.js       # a file's history
git worktree add /tmp/finanzapp-web web-frontend-final            # the whole product, checked out aside
```

Nothing is restored into this tree: `npm run check:repo` fails if a retired path reappears, if a
product source imports from one, or if an `archive/` copy is added. The native app never imports
web data; the web's `localStorage` and Supabase JSON snapshot are not migrated (decision 001).

## Files that must never be committed

- `node_modules/`
- `dist/`, `.expo/`, `apps/mobile/ios/`, `apps/mobile/android/`
- `.env`, `.env.*`
- logs (`*.log`)
- OS junk (`.DS_Store`, `Thumbs.db`, …)
- local screenshots, backups, temporary QA artifacts, `.playwright-mcp/`
- `*.ipa`, `*.apk`, `*.aab`, `*.p12`, `*.p8`, `*.mobileprovision`, `*.keystore`, `*.sqlite*`
- credentials of any kind: private keys, service-account files, provider tokens, a real
  FinanzApp backup

`npm run check:repo` and CI enforce this: the guard fails on tracked generated files, on the
retired web tree, on a product source importing a retired path, on sensitive file names and on
credential-shaped content. The repository is public: no financial backups, screenshots with real
data, tokens, signing keys or bank credentials.
