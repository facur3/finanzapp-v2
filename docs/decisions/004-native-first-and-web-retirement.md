# Decision 004: the native app is the product; the web/Capacitor frontend is retired

Date: 2026-09-25. Status: accepted (Producto 24UX1) and **executed** (Producto 24REP, the same
day: the retirement PR removed the web/Capacitor trees; the tag `web-frontend-final` marks their
last commit). Supersedes in part [decision 001](001-native-mobile.md): its "keep the web
operational until migration" clause. Decisions 002 (spending-first) and 003 (five tabs and
cards) are unchanged.

## Decision

FinanzApp is the native application in `apps/mobile` (Expo, React Native, TypeScript), iOS first,
Android later from the same project. The source of truth is `apps/mobile`, `packages/domain`
(the typed financial rules) and the mobile backend contracts (`packages/integrations`,
`server/mobile`, `api/mobile`). The Vercel web app and its Capacitor shell are not part of the new
product experience: they were frozen when this decision was recorded and retired the same day in
a separate PR that keeps Git history (below, "Execution"). Nothing was deleted in the PR that
recorded this decision.

## Context

Decision 001 (2026-09-11) chose Expo for the new UI and kept the web running as the production
product while the pilot was validated on a device. Since then the native app has shipped the
spending loop, commitments, budgets, cards, the Assistant tab, localization for two languages and
regions, the multi-currency engine (24A–24B6) and the regional infrastructure (24R1), with
device evidence recorded in `docs/mobile-device-checklist.md`. The web tree has not changed since
2026-09-08 (`git log -- src/app index.html public support.js`). Keeping two products doubles the
cost of every rule change and confuses contributors about where the truth lives (`AGENTS.md` and
`README.md` still described the web as production until this decision).

The inventory that backed this decision, `docs/web-retirement-inventory.md`, was removed with the other web-only documents in Producto 25B (2026-09-26; readable in Git history, e.g. `git show 1b6896d:docs/web-retirement-inventory.md`). It showed that:
the native app imports nothing from the web tree except one module re-exported by
`packages/domain/index.ts` (`src/domain/dates.js`), the mobile backend imports nothing from `src/`,
and the same Vercel project deploys both the static web and the mobile API functions.

## Alternatives

| Option | For | Against | Outcome |
| --- | --- | --- | --- |
| Keep both products | No migration work; web users keep their localStorage data | Two rule sets (float money vs integer minor units), two assistants, two release paths; every doc must say which is which | Rejected |
| Retire the web in this PR | One step | Mixes a large deletion with the 24UX1 product work; the hosting of `api/mobile/*` and the bundle identifier need their own review | Rejected |
| Declare the direction now, retire in a separate PR after an inventory | Reviewable deletion with a checklist; the API hosting and the identity are handled deliberately; history kept by tag | **Selected** |

## Consequences

- `AGENTS.md` and `README.md` lead with the native product. The web sections shrink to what is
  needed to keep its CI green until retirement.
- No new feature, fix or dependency goes into `src/app`, `support.js`, `public/`, `ios/` (Capacitor),
  `src/capacitor`, `api/chart.js`, `api/fund-data.js` or the web-only `src/domain` modules. A bug
  there is fixed only if it breaks CI.
- The retirement PR (Producto 24REP) followed §5 of the inventory: tag, `git rm` of the web-only trees, root scripts
  and CI trimmed, `src/domain/dates.js` moved into `packages/domain`, the Vercel project kept for
  `api/mobile/*`, the docs pruned.
- The production bundle identifier (`com.facur3.finanzapp`, owned by the Capacitor shell) is not
  reassigned by the retirement; the definitive identity is decided with TestFlight and publication
  (AGENTS.md rule 3).
- Android uses `apps/mobile` (Expo, the same `app.config.ts` with its Android block). A second
  repository or a second native project needs an architectural reason recorded as a decision.

## Execution (Producto 24REP, 2026-09-25)

- **History.** The annotated tag `web-frontend-final` points at `ac4f038` (the merge of PR #54),
  the last commit that contains the whole web product. No history was rewritten; every removed
  file is readable with `git show web-frontend-final:<path>` (README, "The retired web/Capacitor
  app"). No `archive/` copy exists in the tree, and `npm run check:repo` refuses one.
- **Removed with `git rm`** (the web-only trees of the inventory §2): `index.html`, `support.js`,
  `capacitor.config.ts`, `public/`, root `ios/`, `src/app/`, `src/capacitor/`, all of `src/domain/`
  (`dates.js` after its port), `api/chart.js`, `api/fund-data.js` and their tests,
  `design-reference/`, the three `scripts/build-*.mjs`, `SUPABASE_SETUP.md` and the web-only
  docs (`production-release-checklist`, `mobile-install-qa`, `offline-data-guarantees`,
  `capacitor-ios-spike`).
- **Moved.** `src/domain/dates.js` → `packages/domain/dates.ts`, typed, with only the two functions
  the app consumes (`todayKey`, `labelFromISO`) and their regression tests
  (`packages/domain/dates.test.ts`; parity with the legacy module was proven over every day of
  2024–2027 before the deletion). The web's label parsing, monthly-occurrence helpers and
  `dateLabel` sorting had no native consumer and retired with the web. The web release notes, its
  Assistant and market-data description, its Shortcuts capture recipe and its rebuild roadmap were
  kept under `docs/history/` until Producto 25B removed them (their content stays in Git history and
  at the tag).
- **Root tooling.** `package.json` keeps `test` and `check:repo` with `vitest` and `typescript`;
  the Vite, esbuild and Capacitor dependencies and the web build scripts are gone. The CI `build`
  job became `domain` (`npm ci`, `npm test`, `npm run check:repo`); `mobile` and `mobile_api` are
  unchanged. `scripts/check-repo.mjs` now also fails on the legacy tree reappearing, on a product
  source importing a retired path, and on sensitive files or credential-shaped content.
- **Hosting.** `vercel.json` keeps the project for `api/mobile/*` only: no framework, a static
  output that holds only a plain `404.html` (`/` and every other path answer 404), the functions
  auto-detected from `api/`. Unconfigured, the
  endpoints fail closed (`GET` 405, `POST` 503); configured, a request without a session is 401.
- **Android.** Built later in `apps/mobile` from the same code (navigation, domain, storage
  abstractions, i18n, Assistant, components); platform differences behind `Platform.OS`,
  `.ios.tsx`/`.android.tsx` files or adapter modules. A second repository or native project
  needs a decision here. Not implemented.
- **Not changed by the retirement.** The bundle identifier `com.facur3.finanzapp` (registered
  by the Capacitor app, decided at publication), the app's visible behaviour, the mobile backend
  and its contracts, the EAS configuration, the currency and region catalogues and their licence.

## What is kept, by name

| Kept | Where | Why |
| --- | --- | --- |
| The native financial domain | `packages/domain` (now including `dates.ts`) | Every rule the app runs; 254 tests at the root plus the app's own |
| Backups and migrations | `apps/mobile/src/storage` (SQLite schema 9, backup v9) and `packages/domain/recovery.ts` | Users' data; the one-way upgrades documented in `docs/currency.md` |
| The Assistant contracts | `packages/integrations/contracts.js` (+ `.d.ts`), `server/mobile/openai.js` schema | Shared by the app and the backend; `currency-guards.node.ts` scans them |
| Authentication and quotas | `server/mobile/handlers.js`, `runtime.js`, `schema.sql`, `schema.test.sql` | The `mobile_api` CI job proves ownership, deduplication and quotas on PostgreSQL |
| The mobile endpoints | `api/mobile/assistant.js`, `api/mobile/captures.js` | What the app calls at `/api/mobile/*` |
| Tests | `packages/domain/*.test.ts` (with `dates.test.ts`), `server/mobile/handlers.test.js`, `scripts/check-repo.test.js`, everything under `apps/mobile/tests` | Regression coverage of the product and of the repository guard |
| EAS and Expo configuration | `apps/mobile/eas.json`, `app.config.ts`, `metro.config.js`, `package-lock.json` | The build profiles (development, preview, testflight) and the project link |
| Licences and data | `LICENSES/Unicode-3.0.txt`, `apps/mobile/scripts/{currency,regions}` and their locks | The CLDR-derived catalogues |
| Docs | `docs/mobile-*.md`, `docs/i18n.md`, `docs/currency.md`, `docs/mobile-integrations.md`, `docs/decisions/` | The product's design, checklist, roadmap and contracts (the web documents once under `docs/history/` were removed in 25B) |

## References

- `docs/web-retirement-inventory.md` (removed in 25B; in Git history): the commands and results.
- [Decision 001](001-native-mobile.md): why Expo, the no-Mac workflow, the Apple integrations.
- [Decision 002](002-spending-first.md), [Decision 003](003-five-tabs-and-cards.md).
