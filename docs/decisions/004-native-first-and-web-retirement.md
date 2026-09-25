# Decision 004: the native app is the product; the web/Capacitor frontend is retired

Date: 2026-09-25. Status: accepted (Producto 24UX1). Supersedes in part
[decision 001](001-native-mobile.md): its "keep the web operational until migration" clause.
Decisions 002 (spending-first) and 003 (five tabs and cards) are unchanged.

## Decision

FinanzApp is the native application in `apps/mobile` (Expo, React Native, TypeScript), iOS first,
Android later from the same project. The source of truth is `apps/mobile`, `packages/domain`
(the typed financial rules) and the mobile backend contracts (`packages/integrations`,
`server/mobile`, `api/mobile`). The Vercel web app and its Capacitor shell are not part of the new
product experience: they are frozen legacy, receive no features, and are retired in a separate PR
that keeps Git history. Nothing is deleted in the PR that records this decision.

## Context

Decision 001 (2026-09-11) chose Expo for the new UI and kept the web running as the production
product while the pilot was validated on a device. Since then the native app has shipped the
spending loop, commitments, budgets, cards, the Assistant tab, localization for two languages and
regions, the multi-currency engine (24A–24B6) and the regional infrastructure (24R1), with
device evidence recorded in `docs/mobile-device-checklist.md`. The web tree has not changed since
2026-09-08 (`git log -- src/app index.html public support.js`). Keeping two products doubles the
cost of every rule change and confuses contributors about where the truth lives (`AGENTS.md` and
`README.md` still described the web as production until this decision).

The inventory that backs this decision is [docs/web-retirement-inventory.md](../web-retirement-inventory.md):
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
- The retirement PR follows §5 of the inventory: tag, `git rm` of the web-only trees, root scripts
  and CI trimmed, `src/domain/dates.js` moved into `packages/domain`, the Vercel project kept for
  `api/mobile/*`, the docs pruned.
- The production bundle identifier (`com.facur3.finanzapp`, owned by the Capacitor shell) is not
  reassigned by the retirement; the definitive identity is decided with TestFlight and publication
  (AGENTS.md rule 3).
- Android uses `apps/mobile` (Expo, the same `app.config.ts` with its Android block). A second
  repository or a second native project needs an architectural reason recorded as a decision.

## What is kept, by name

| Kept | Where | Why |
| --- | --- | --- |
| The native financial domain | `packages/domain` (+ `src/domain/dates.js` until moved) | Every rule the app runs; 246 tests at the root plus the app's own |
| Backups and migrations | `apps/mobile/src/storage` (SQLite schema 9, backup v9) and `packages/domain/recovery.ts` | Users' data; the one-way upgrades documented in `docs/currency.md` |
| The Assistant contracts | `packages/integrations/contracts.js` (+ `.d.ts`), `server/mobile/openai.js` schema | Shared by the app and the backend; `currency-guards.node.ts` scans them |
| Authentication and quotas | `server/mobile/handlers.js`, `runtime.js`, `schema.sql`, `schema.test.sql` | The `mobile_api` CI job proves ownership, deduplication and quotas on PostgreSQL |
| The mobile endpoints | `api/mobile/assistant.js`, `api/mobile/captures.js` | What the app calls at `/api/mobile/*` |
| Tests | `packages/domain/*.test.ts`, `server/mobile/handlers.test.js`, `src/domain/dates.test.js`, everything under `apps/mobile/tests` | Regression coverage of the product |
| EAS and Expo configuration | `apps/mobile/eas.json`, `app.config.ts`, `metro.config.js`, `package-lock.json` | The build profiles (development, preview, testflight) and the project link |
| Licences and data | `LICENSES/Unicode-3.0.txt`, `apps/mobile/scripts/{currency,regions}` and their locks | The CLDR-derived catalogues |
| Docs | `docs/mobile-*.md`, `docs/i18n.md`, `docs/currency.md`, `docs/mobile-integrations.md`, `docs/decisions/` | The product's design, checklist, roadmap and contracts |

## References

- [docs/web-retirement-inventory.md](../web-retirement-inventory.md): the commands and results.
- [Decision 001](001-native-mobile.md): why Expo, the no-Mac workflow, the Apple integrations.
- [Decision 002](002-spending-first.md), [Decision 003](003-five-tabs-and-cards.md).
