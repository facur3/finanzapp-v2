# FinanzApp

FinanzApp is a native personal-finance app for everyday spending and commitments: fast capture,
understandable spending, upcoming payments, budgets, cards and debts, optional simple accounts,
an Assistant that proposes drafts and answers questions from the ledger, and local data that
works without connectivity. It is built with **Expo, React Native and TypeScript** in
`apps/mobile`, iOS first, Android later from the same project. Since 2026-09-25 the native app is
the product; the old web app is frozen legacy until its retirement (see below).

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

## Where things live

| Path | What it is |
| --- | --- |
| `apps/mobile/` | The app: Expo Router screens (`app/`), UI, i18n, storage (SQLite, backups) and the Assistant client (`src/`), Node tests (`tests/`), catalogue generators (`scripts/`), `app.config.ts`, `eas.json`. Own `package-lock.json`. |
| `packages/domain/` | `@finanzapp/domain`: the typed, side-effect-free financial rules (integer minor units per currency, ledger, transfers, budgets, liabilities, reports, recovery). Tested at the root with vitest. |
| `packages/integrations/` | The Assistant and capture contracts shared by the app and the backend. |
| `server/mobile/`, `api/mobile/` | The mobile backend: authenticated handlers, quotas, the capture inbox, the AI responder, the PostgreSQL schema and its tests; the two Vercel function entry points. Off until the owner configures it. |
| `docs/` | Roadmap, design direction, i18n, currencies, device checklist, decisions (below). |
| `index.html`, `src/app`, `src/domain`, `support.js`, `public/`, `ios/`, `src/capacitor`, `api/chart.js`, `api/fund-data.js` | The legacy web/Capacitor app (frozen; see "Legacy web"). |

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
ownership and quota tests) and `build` (the root vitest suite over `packages/domain`,
`server/mobile` and the legacy domain, the legacy web build, and the hygiene check).

## Legacy web/Capacitor (frozen, retirement planned)

The previous product was a web app on the Claude Design runtime with `localStorage` data, an
installable PWA shell, a Capacitor iOS wrapper and market-data proxies, deployed to Vercel. It is
not part of the new product: it receives no features, and a separate PR will remove it while
keeping Git history. What it depends on, what the native product keeps and the steps of that PR
are in [docs/web-retirement-inventory.md](docs/web-retirement-inventory.md). Until then its CI
must stay green:

```bash
npm ci
npm test              # vitest: packages/domain, server/mobile and the legacy src/domain
npm run build         # the legacy Vite build (index.html is generated from src/app; never hand-edit it)
npm run check:repo    # fails if node_modules/, dist/, .vite/, .expo/, .playwright-mcp/, .env or generated native projects are tracked
```

Vercel builds `dist/` from `npm run build` and serves `api/**` as functions; the same project
hosts `api/mobile/*`, which the retirement keeps. Legacy documents: `SUPABASE_SETUP.md`,
`docs/production-release-checklist.md`, `docs/mobile-install-qa.md`,
`docs/offline-data-guarantees.md`, `docs/capacitor-ios-spike.md`, `RELEASE_NOTES.md`.

## Files that must never be committed

- `node_modules/`
- `dist/`, `.vite/`, `.expo/`, `apps/mobile/ios/`, `apps/mobile/android/`
- `.env`, `.env.*`
- logs (`*.log`)
- OS junk (`.DS_Store`, `Thumbs.db`, …)
- local screenshots, backups, temporary QA artifacts, `.playwright-mcp/`
- `*.ipa`, `*.apk`, `*.aab`, `*.p12`, `*.p8`, `*.mobileprovision`, `*.sqlite*`

`npm run check:repo` and CI enforce this. The repository is public: no financial backups,
screenshots with real data, tokens, signing keys or bank credentials.
