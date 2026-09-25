# The retired web/Capacitor frontend: inventory, execution and recovery

Date: 2026-09-25. Companion to [decision 004](decisions/004-native-first-and-web-retirement.md).
Written by Producto 24UX1 as the inventory a retirement PR had to follow; executed the same day by
Producto 24REP. §0 records what was done and how to recover anything; §1–§6 are the inventory as
it was established before the deletion (its commands were run on the tree at the tag
`web-frontend-final`; the paths they name no longer exist on `master`).

## 0. Executed (Producto 24REP)

- **Tag.** `web-frontend-final` (annotated) → `ac4f0385cb600889122146c8c9997d0ce264e5d7`, the merge
  of PR #54: the last commit on `master` that contains the whole web product. Nothing was
  rewritten, squashed or force-pushed.
- **Recover a file or a tree** (never into this working tree, never as an `archive/` folder):

  ```bash
  git show web-frontend-final:src/domain/assistant.js                # print one file
  git show web-frontend-final:index.html > /tmp/index.html           # save one file
  git ls-tree -r --name-only web-frontend-final -- src/app public ios # list a tree
  git log --oneline web-frontend-final -- src/domain/dates.js        # a file's history
  git worktree add /tmp/finanzapp-web web-frontend-final             # the whole product aside
  git diff web-frontend-final master --stat                          # everything the retirement changed
  ```

- **Removed with `git rm`** (all confirmed web-only by §1–§2 and by a fresh scan of consumers
  before the deletion; no native or backend consumer was found): `index.html`, `support.js`,
  `capacitor.config.ts`, `public/` (11 files), root `ios/` (15), `src/app/` (5), `src/capacitor/`
  (1), `src/domain/` (32, incl. `dates.js` after its port), `api/chart.js`, `api/chart.test.js`,
  `api/fund-data.js`, `api/fund-data.test.js`, `design-reference/` (2), `scripts/build-app-shell.mjs`,
  `scripts/build-domain.mjs`, `scripts/build-capacitor-bridge.mjs`, `SUPABASE_SETUP.md` (the web's
  `user_data` JSON table and email login; the mobile backend has its own `server/mobile/schema.sql`
  and [mobile-integrations.md](mobile-integrations.md)), `docs/production-release-checklist.md`,
  `docs/mobile-install-qa.md`, `docs/offline-data-guarantees.md`, `docs/capacitor-ios-spike.md`.
- **Moved.** `src/domain/dates.js` → `packages/domain/dates.ts` (typed; `todayKey` and
  `labelFromISO`, the two exports the app consumes; the other seven functions were web-only and
  retired) with `packages/domain/dates.test.ts` (8 tests: the legacy cases for those two functions
  verbatim plus the app's edges; parity with the legacy module was checked over every day of
  2024–2027 and on junk input before the deletion). `RELEASE_NOTES.md` →
  `docs/history/web-release-notes.md`; `docs/assistant-and-market-data.md` →
  `docs/history/web-assistant-and-market-data.md`; `docs/apple-pay-shortcut-spike.md` →
  `docs/history/web-apple-pay-shortcut-capture.md`; `docs/product-rebuild-roadmap.md` →
  `docs/history/web-product-rebuild-roadmap.md` (each with a header saying it is history).
- **Root `package.json`.** Scripts: `test`, `check:repo`. Dependencies removed: `@capacitor/cli`,
  `@capacitor/ios`, `@capacitor/app`, `@capacitor/core`, `@capacitor-community/speech-recognition`,
  `vite`, `esbuild` (esbuild stays only as vitest's transitive dependency). Kept: `vitest`,
  `typescript`. `package-lock.json` regenerated (266 → 116 `node_modules` entries).
- **Guard.** `scripts/check-repo.mjs` fails on tracked generated files, on any path of the retired
  tree or an `archive/` copy, on a product source (`apps/mobile`, `packages/`, `server/`,
  `api/mobile/`) importing `src/…`, `support.js`, `window.FinanzDomain`, `api/chart`,
  `api/fund-data` or `@capacitor/*`, on sensitive file names and on credential-shaped content;
  `scripts/check-repo.test.js` (6 tests) pins each rule.
- **CI.** `build` → `domain` (`npm ci`, `npm test`, `npm run check:repo`; the Vite build step is
  gone); `mobile` and `mobile_api` unchanged.
- **Vercel.** `vercel.json`: `framework: null`, `buildCommand: mkdir -p dist`, `outputDirectory:
  dist`; the functions come from `api/mobile/` (nothing else remains under `api/`). Unconfigured,
  `GET /api/mobile/*` → 405 and `POST` → 503 (fail closed, `server/mobile/handlers.js`); configured,
  a request without a session → 401. `/` → 404: no web page is served. The environment variables
  of `server/mobile/runtime.js` are unchanged.
- **Tests.** Root `npm test`: 448 → 270 (246 domain + 10 handlers + 8 dates + 6 guard; the 192
  web-only tests of §3 and the 19 legacy date tests left with the web). Mobile `test:storage`:
  577, unchanged. `schema.test.sql`: unchanged, runs in `mobile_api`.
- **Not done here** (by design): the bundle identifier, any Vercel environment variable, any
  paid service, 24R2.



## 1. What the native product is made of

| Tree | Tracked files | Role |
| --- | --- | --- |
| `apps/mobile/` | 230 | The Expo/React Native app (iOS today, Android from the same project), its tests, scripts, `app.config.ts`, `eas.json`, `metro.config.js`. |
| `packages/domain/` | 35 | `@finanzapp/domain`: the typed, side-effect-free financial rules the app imports (18 modules including the entry and the currency data, 17 test files). |
| `packages/integrations/` | 2 | `contracts.js` + `contracts.d.ts`: the Assistant and capture contracts shared by the app and the backend. |
| `server/mobile/` | 6 | The mobile backend: `handlers.js` (auth, quotas, validation), `runtime.js`, `openai.js`, `schema.sql`, `schema.test.sql`, `handlers.test.js`. |
| `api/mobile/` | 2 | The two Vercel function entry points the app calls: `assistant.js`, `captures.js`. |
| `src/domain/dates.js` | 1 (+ its test) | The one legacy module the native entry still re-exports (`todayKey`, `labelFromISO`). |
| `.github/workflows/ci.yml` | 1 | The `mobile` and `mobile_api` jobs. |
| `LICENSES/Unicode-3.0.txt` | 1 | The licence of the CLDR data behind `apps/mobile/src/i18n/{currencies,regions}`. |

Counts: `for d in src/app src/domain src/capacitor api server packages apps/mobile public design-reference ios scripts docs; do printf "%s: " $d; git ls-files $d | wc -l; done`
→ `src/app: 5`, `src/domain: 32`, `src/capacitor: 1`, `api: 6`, `server: 6`, `packages: 37` (domain 35 + integrations 2),
`apps/mobile: 230`, `public: 11`, `design-reference: 2`, `ios: 15`, `scripts: 4`, `docs: 18`.

### 1a. How the app reaches the shared code

- `apps/mobile/package.json` line 34: `"@finanzapp/domain": "file:../../packages/domain"`; installed as a
  symlink (`ls -la apps/mobile/node_modules/@finanzapp` → `domain -> ../../../../packages/domain`).
- `apps/mobile/metro.config.js` line 7: `config.watchFolders = [repositoryRoot]` (Metro follows the
  symlink out of `apps/mobile`); line 8 keeps `nodeModulesPaths` inside `apps/mobile`.
- `apps/mobile/tsconfig.json` line 11: `"include": ["**/*.ts", "**/*.tsx", "../../packages/domain/**/*.ts"]`.
- Direct relative imports out of `apps/mobile` (`grep -rn "\.\./\.\./\.\./" apps/mobile/src apps/mobile/app apps/mobile/tests`):
  - `packages/integrations/contracts.js` from `src/integrations/{evidence,client}.ts`, `src/assistant/{fixtures,client,conversation}.ts`, `tests/assistant.node.ts`;
  - `packages/domain/currency-data.ts` from `tests/region-catalogue.node.ts`.
  Nothing under `apps/mobile` imports `src/app`, `src/capacitor`, `support.js`, `public/` or `api/chart.js`.
- The one legacy edge: `packages/domain/index.ts` line 5, `export { todayKey, labelFromISO } from '../../src/domain/dates.js'`.
  `src/domain/dates.js` has no imports of its own (`grep -n "^import" src/domain/dates.js` → nothing).
  No other `packages/domain/*.ts` reaches `src/` (`grep -n "src/domain" packages/domain/*.ts` → only that line and its comment).
- A scan test reads a backend file by path: `apps/mobile/tests/currency-guards.node.ts` line 41 lists
  `server/mobile/openai.js` (the contract-v1 currency enum). The backend stays, so this keeps working.
- The app calls `POST <origin>/api/mobile/<path>` (`apps/mobile/src/integrations/client.ts` line 21;
  `tests/assistant.node.ts` line 253 pins `/api/mobile/assistant`).

### 1b. The backend's own edges

- `api/mobile/assistant.js` and `api/mobile/captures.js` import only `server/mobile/handlers.js` and `server/mobile/runtime.js`.
- `server/mobile/handlers.js` imports `packages/integrations/contracts.js`; `runtime.js` and `openai.js` import each other and `handlers.js`; nothing in `server/` or `api/mobile/` imports `src/`.
- `packages/integrations/contracts.js` has no imports.
- `server/mobile/handlers.test.js` (vitest, 10 tests) imports `api/mobile/captures.js` as the "disabled capture" fixture; `schema.test.sql` runs in the `mobile_api` CI job against PostgreSQL 17.
- `api/chart.js` imports `api/fund-data.js` only; neither is imported by anything under `apps/`, `server/` or `packages/` (`grep -rn "chart.js\|fund-data" apps/mobile/src server packages` → nothing). They are the legacy web's market-data proxies.

## 2. What is web-only

Established with `git ls-files` and the import scans above.

| Path | What it is | Evidence |
| --- | --- | --- |
| `index.html` (generated), `src/app/{index.shell.html,template.html,component.js,finanzapp.css,motion.test.js}` | The Claude Design runtime document and its editable shell | `scripts/build-app-shell.mjs` header; `component.js` references `window.FinanzDomain` 92 times |
| `support.js`, `public/support.js`, `public/vendor` (React UMD), `design-reference/` | The Design Components runtime and its untouched reference | README "Architecture" (pre-24UX1) |
| `public/{sw.js,manifest.webmanifest,icons,finanzapp.css}` | PWA shell | `vercel.json` headers for `sw.js` and the manifest |
| `public/domain.iife.js`, `public/capacitor-deep-links.iife.js` (git-ignored) | Generated by `scripts/build-domain.mjs` and `scripts/build-capacitor-bridge.mjs` | `.gitignore` |
| `scripts/build-app-shell.mjs`, `scripts/build-domain.mjs`, `scripts/build-capacitor-bridge.mjs` | Web build steps (`predev`/`prebuild` in root `package.json`) | root `package.json` scripts |
| `src/domain/index.js` | The barrel that sets `window.FinanzDomain` for the web document | its header comment |
| `src/domain/*.js` except `dates.js` | The legacy web rules: `assistant`, `assistantQueries`, `balances`, `cards`, `cloudSync`, `currency`, `investments`, `merchantRules`, `money`, `persistence`, `reports`, `setupImport`, `shortcutCapture`, `transactions` (+ `shortcutDeepLinks.test.js`) | not imported by `packages/`, `server/`, `api/mobile/` or `apps/mobile/` (`grep -rn "src/domain" server apps/mobile/src packages/integrations` → nothing); `packages/domain/index.ts` re-exports only `dates.js` |
| `src/capacitor/deepLinks.js`, `capacitor.config.ts`, `ios/` (15 files), the `@capacitor/*` and speech-recognition dependencies | The Capacitor iOS shell (`appId` `com.facur3.finanzapp`, `webDir: dist`) | `capacitor.config.ts`; `docs/capacitor-ios-spike.md` ("spike branch only") |
| `api/chart.js`, `api/fund-data.js` and their tests | Market-data proxies for the web investments feature | §1b |
| `vercel.json` (static build of `dist/`, `sw.js` headers) | The web deployment; note that the same Vercel project serves `api/mobile/*` (§4) | file contents |
| `SUPABASE_SETUP.md`, `src/domain/cloudSync.js` | The web's last-write-wins JSON cloud sync | decision 001 "Data and security target" |
| `docs/production-release-checklist.md`, `docs/mobile-install-qa.md`, `docs/offline-data-guarantees.md`, `docs/capacitor-ios-spike.md`, `docs/assistant-and-market-data.md`, `RELEASE_NOTES.md` (v54 web releases) | Web release, PWA and localStorage documentation | their first lines |
| `docs/product-rebuild-roadmap.md` | Historical web rebuild plan; its own header says the mobile roadmap supersedes it, but its financial-accuracy notes remain relevant | its header |
| CI job `build` (`npm test`, `npm run build`, `npm run check:repo`) | Runs the root vitest suite (web + shared), the Vite build and the hygiene check | `.github/workflows/ci.yml` lines 10-32 |

Web-only dependencies in the root `package.json`: `@capacitor/cli`, `@capacitor/ios`, `@capacitor/app`,
`@capacitor/core`, `@capacitor-community/speech-recognition`, `vite`, `esbuild`. Shared: `vitest`
(runs `packages/domain` and `server/mobile` tests too), `typescript`.

## 3. The root test suite, split

`npm test` (vitest at the root) ran 448 tests in 36 files on this branch. By tree:

| Tree | Files | Tests | After retirement |
| --- | --- | --- | --- |
| `packages/domain/*.test.ts` | 17 | 246 | Keep: these are the native rules (ledger 29, recovery 37, transfers 24, multi-currency 19, spending-report 19, categories 18, money 16, liabilities 15, budgets 14, currency 12, report-insights 11, appearance 9, month-summary 9, recurring 5, spending-overview 5, report-trend 4). |
| `server/mobile/handlers.test.js` | 1 | 10 | Keep (mobile backend). `schema.test.sql` runs separately in `mobile_api`. |
| `src/domain/dates.test.js` | 1 | 19 | Keep as long as `dates.js` is re-exported; move with it (§5 step 6). |
| `src/domain/*.test.js` (the other 15) | 15 | 161 | Web-only rules: `assistant` 44, `assistantQueries` 15, `investments` 15, `cards` 12, `money` 11, `reports` 11, `transactions` 10, `cloudSync` 9, `persistence` 8, `setupImport` 8, `balances` 4, `currency` 4, `shortcutDeepLinks` 4, `merchantRules` 3, `shortcutCapture` 3. They test the web's float-based money and localStorage persistence, which the native app deliberately does not share (`packages/domain/index.ts` header). Retire with the web, or archive; do not port. |
| `api/chart.test.js`, `api/fund-data.test.js` | 2 | 9 | Web-only (market data). |
| `src/app/motion.test.js` | 1 | 3 | Web-only (the DOM transition layer). |

Per-file counts: from the vitest report of `npm test` on this branch (`✓ <file> (<n> tests)` lines).

## 4. Hosting: the one shared deployment

`vercel.json` builds the static web (`npm run build` → `dist/`) and Vercel auto-detects `api/**` as
functions, so **the mobile backend (`api/mobile/*`) is deployed by the web project today**. Retiring
the web must not remove that deployment: keep `api/mobile/` and `server/mobile/` where Vercel finds
them, replace the static build with a no-op or a minimal placeholder, and keep the environment
variables the handlers read (`server/mobile/runtime.js`). The mobile app's origin for the API is
configured on the app side (`src/integrations/client.ts`), not derived from the web.

## 5. The retirement PR (separate, after 24UX1)

Order of work; each step has a check that must stay green.

1. **Tag the last web commit** on master (`git tag web-frontend-final <sha>`; push the tag) so the
   history stays reachable by name. Git history is never rewritten.
2. **Freeze first, remove second.** Confirm `git log --oneline -- src/app index.html public support.js`
   shows no change since 2026-09-08 (`e299eb3`), as today.
3. **Remove the web-only trees** listed in §2 with `git rm` (history preserved) rather than moving
   them to an archive folder: an archive folder keeps dead code in the working tree, in editor search
   and in CI checkout, and `git show web-frontend-final:<path>` serves the same purpose. If the owner
   prefers a visible archive, `archive/web/` is the fallback, excluded from CI and lint.
4. **Root `package.json`:** drop `build:app-shell`, `build:domain`, `build:capacitor-bridge`,
   `predev`, `dev`, `prebuild`, `build`, `preview` and the web-only dependencies (§2); keep `test`
   (vitest over `packages/` and `server/`) and `check:repo`. Update `scripts/check-repo.mjs` only if
   its forbidden list mentions removed paths (today it does not).
5. **CI:** in the `build` job keep `npm ci`, `npm test`, `npm run check:repo`; drop `npm run build`.
   Keep `mobile` and `mobile_api` unchanged.
6. **`src/domain/dates.js`:** move it (and `dates.test.js`) into `packages/domain` as a typed module
   in the same PR or the next one, keeping every test green; then `packages/domain/index.ts` has no
   reference outside `packages/`. This is the only code the native product still takes from `src/`.
7. **`vercel.json`:** keep the project for `api/mobile/*`; the static output becomes a minimal
   placeholder or the project is switched to functions-only. Verify with a preview deployment that
   `POST /api/mobile/assistant` still answers 401 without a token (the handlers' behaviour).
8. **Docs:** remove or mark as historical the web-only docs (§2); keep `docs/mobile-integrations.md`
   and `docs/currency.md` (they describe the mobile backend contracts); update `AGENTS.md`, `README.md`
   and `docs/decisions/004` "consequences" once the removal lands.
9. **Checks after the PR:** root `npm test` (expected 275 tests: 246 domain + 10 handlers + 19 dates),
   `npm run check:repo`; mobile `npm run typecheck`, `test:storage`, `currency:verify`,
   `regions:verify`, `i18n:check -- --strict`, `check`, `export:ios`; the `mobile_api` job; a Vercel
   preview of the API. The iPhone is not affected: the native bundle imports nothing from the web tree.

### Risks

- **The production bundle identifier.** The Capacitor shell owns `com.facur3.finanzapp`; the Expo app
  uses `.dev` and `.preview` (`apps/mobile/app.config.ts` lines 29 and 42). Retiring the web does not
  free or reassign the identifier by itself; the definitive identity is a release decision
  (AGENTS.md rule 3) and belongs to the TestFlight/publication delivery, not to the retirement PR.
- **Data.** Web users' `localStorage` and the Supabase JSON snapshot are not imported by the native
  app (decision 001 "Reuse boundaries"). Retiring the web removes the only UI that reads them; if a
  migration path is wanted, it must exist before the web disappears, as a previewed importer.
- **The Assistant's web engine.** `src/domain/assistant.js` (44 tests) is the free on-device intent
  engine of the web; the native Assistant uses the server contract. Nothing in `apps/mobile` imports
  it (§1a), so no native capability is lost, but its parsing heuristics may be worth reading before
  the native multilingual Assistant is built.
- **Vercel functions.** If the project is deleted instead of trimmed, `api/mobile/*` disappears with
  it (§4).

## 6. Not verified here

- Whether the Vercel project has environment variables beyond those `server/mobile/runtime.js` reads
  (requires the Vercel dashboard or CLI; the CLI is not installed in this environment).
- Whether any external consumer calls `api/chart.js` or `api/fund-data.js` (only the web UI is known
  to; there is no access log in the repository).
- Whether the Capacitor app was ever distributed outside the spike branch (the docs say it was not).
