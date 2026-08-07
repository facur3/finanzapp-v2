# FinanzApp

FinanzApp is a personal finance app for Argentina: accounts, movements, cards,
budgets, recurring movements, categories, tags and investments with local
persistence. Its UI currently runs on the **Claude Design runtime** while the
financial rules live in tested domain modules and the editable app shell is
split by responsibility.

## Architecture (read before changing anything)

- `index.html` is generated. Do not edit it directly.
- `src/app/index.shell.html` owns the document/PWA boot shell.
- `src/app/template.html` owns the screen markup, `src/app/component.js` the UI
  controller/state adapter, and `src/app/finanzapp.css` the visual/motion system.
- `scripts/build-app-shell.mjs` assembles those files before dev/build.
- `public/finanzapp.css` is its generated, service-worker-cacheable CSS copy.
- `support.js` is the Design Components runtime. `public/support.js` is the copy
  used by the production build/preview (Vite copies `public/` into `dist/`).
- `design-reference/FinanzApp.dc.html` and `design-reference/support.js` are kept
  as untouched reference files.

This version intentionally **does not** convert the app to React — it runs from the
Claude Design runtime (which uses React internally). `localStorage` is the source of
truth. On top of that baseline the app now also has:

- **Optional cloud sync** via Supabase (email + password auth, one JSONB row per user,
  last-write-wins). Off until configured — see `SUPABASE_SETUP.md`. Without it the app
  is 100% local, exactly as before.
- **One serverless function**: `api/chart.js` proxies Yahoo Finance price history.
  The assistant is entirely local, needs no API key and cannot create token charges.

Future refactors should preserve financial behavior and data migrations one flow
at a time; the interface can continue evolving without tying the product to the
original export.

## Functionality included

- Local state for accounts, movements, cards, categories, tags, investments and settings.
- Local persistence with `localStorage`, so data survives refresh/reopen.
- Empty-first onboarding and optional sample data from the design.
- Category chart tap filters Activity automatically.
- Functional quick-add flows, movement detail, card purchase, card payment,
  investment trade, account/category/tag/card forms, security/reset, settings and filters.
- **Free local voice/text assistant** in Argentine Spanish for expenses, income, stored
  recurring movements (for example “Cobré el sueldo”), card payments, new
  recurrent rules, budgets, categories and tags. Dictation updates the text as
  partial results arrive and every action shows a validated draft before writing.
  It runs without an API key, paid tokens or a remote AI request.
- **Real dates** stored as ISO values, native calendar selection, and dynamic
  “Hoy/Ayer/5 ago” labels that do not become stale after midnight.
- **Investments**: CEDEARs, crypto, Argentine bonds and FCI with live prices (CoinGecko, data912,
  Yahoo, ArgentinaDatos), portfolio donut, per-asset price charts, and USD (dólar
  cripto) valuation.
- Animated ARS/USD conversion by tapping the large dashboard amount.
- Mixed ARS/USD account totals and reports are normalized with the current quote;
  each account and movement still shows its native currency.
- **Budgets** (monthly limit per category), **savings goals**, and a **net-worth
  trend** chart from daily snapshots.
- **Optional cloud sync** (Supabase) so data can follow you across devices.
- CSV export, JSON backup export, JSON backup import.
- **Installable PWA shell** (manifest + service worker) with offline app-shell support.

## Develop

Install dependencies:

```bash
npm install
```

Run the dev server:

```bash
npm run dev
```

Open: http://localhost:5173

### Local assistant (zero cost)

The assistant uses the tested on-device intent engine in `src/domain/assistant.js`.
It does not require an account or API key and it never spends tokens. Clear and
incomplete commands both stay on the device; incomplete drafts explain exactly
which field is missing before the user can confirm them. See
`docs/assistant-and-market-data.md` for the capability and privacy boundary.

## Build

```bash
npm run build
```

Output is written to `dist/`.

## Preview the production build

```bash
npm run preview
```

This serves the built `dist/` directory (the service worker and manifest only
behave fully in `build` + `preview`, not necessarily in `dev`).

## Repository hygiene check

```bash
npm run check:repo
```

Fails if `node_modules/`, `dist/`, `.vite/`, or `.env` are tracked by git.

## Deploy to Vercel

Mostly static, plus `api/chart.js` (auto-detected by Vercel).
`vercel.json` is included and already pins the build settings below.

### One-time setup

1. Push this repo to GitHub (already done on `master`).
2. Go to <https://vercel.com> → **Add New… → Project**.
3. **Import** the `finanzapp-v2` GitHub repository.
4. When prompted for settings (these come from `vercel.json`, but confirm them):
   - **Framework Preset:** Other (static — the project is not auto-detected as a framework)
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
   - **Install Command:** `npm install` (or `npm ci`)
5. Click **Deploy**.
6. No AI key or paid service is required for the assistant.

### After deploy

- Open the production URL Vercel gives you (e.g. `https://finanzapp-v2.vercel.app`).
- Confirm the app loads and looks identical to local.
- Open DevTools → **Application → Manifest**: manifest + icons load.
- DevTools → **Application → Service Workers**: `sw.js` is registered and active.
- DevTools → **Network**: no favicon 404; `/vendor/react*.js` load from your own
  origin (not `unpkg.com`).
- Console: no errors, no `[dc-runtime] logic class eval FAILED`.
- Reload once, then toggle **Network → Offline** and reload again: the app shell
  loads offline.

Every push to `master` triggers an automatic production redeploy. GitHub Actions
(`.github/workflows/ci.yml`) builds and runs the repo-hygiene check on each push/PR.

### Release & QA docs

- `docs/production-release-checklist.md` — full pre-deploy build/PWA/offline/hygiene
  checklist plus step-by-step Vercel deploy.
- `docs/mobile-install-qa.md` — real-device install + offline QA checklist (iPhone/Android).
- `docs/offline-data-guarantees.md` — how data is persisted/loaded, the no-flicker
  startup guarantee, offline behavior, and the future Dexie migration path.

## Install as a PWA

### iPhone / iPad (Safari)

1. Open the deployed app in Safari.
2. Tap the **Share** button.
3. Choose **Add to Home Screen**.
4. Confirm. The app launches fullscreen/standalone with the FinanzApp icon.

> iOS does not support automatic install prompts; "Add to Home Screen" is the
> supported path.

### Android / Chrome

1. Open the deployed app in Chrome.
2. Use the **Install app** option from the browser menu (or the install prompt).
3. The app installs with the FinanzApp icon and launches standalone.

### Desktop Chrome / Edge

Click the **Install** icon in the address bar (where supported).

## Offline behavior

After the first successful online load, the service worker caches the app shell
(`index.html`, `support.js`, the vendored React runtime under `public/vendor/`,
manifest, and icons). On subsequent visits the full app boots and renders
offline, and existing `localStorage` data remains available. User data is never
cached by the service worker.

### Vendored runtime (no critical external CDN dependency)

The Claude Design runtime (`support.js`) loads React/ReactDOM at boot. These are
**vendored locally** under `public/vendor/` and served from the app's own origin,
so the app no longer depends on `unpkg.com` to start. The files are the exact
React 18.3.1 UMD builds — byte-identical to the CDN copies, verified by the
runtime's existing Subresource Integrity (SRI) hashes, which were left unchanged.

## Files that must never be committed

- `node_modules/`
- `dist/`
- `.vite/`
- `.env`, `.env.*`
- logs (`*.log`)
- OS junk (`.DS_Store`, `Thumbs.db`, …)
- local screenshots / temporary QA artifacts

`npm run check:repo` and CI (`.github/workflows/ci.yml`) enforce this.

## Current limitations

- Market data is best-effort and comes from public providers; it is suitable for
  personal tracking, not order execution or accounting statements. Manual price
  overrides and backup/CSV flows remain available.
- Cocos does not expose a documented public OAuth/account API in this integration,
  so FinanzApp does **not** request Cocos credentials or claim to sync holdings.
  Broker reconciliation should be added through an official API or a documented
  export format when one is available.
- Browser voice recognition depends on browser support. The Capacitor iOS shell
  uses a native speech-recognition plugin and declares the required permissions.
- **Babel standalone** (`@babel/standalone`) is still referenced from `unpkg.com`
  in `support.js`, but it is **not a critical dependency**: it is only fetched
  lazily to compile runtime JSX/TSX modules imported via `x-import`, and FinanzApp
  imports none — so it never loads at runtime and never blocks boot or offline use.
  It was intentionally **not** vendored to avoid committing ~2.9 MB of code the app
  never executes. If a future feature adds JSX `x-import` modules, vendor it the
  same way React was vendored.
- There is no custom install banner, update prompt or offline status UI yet.
  Service-worker updates apply on the next load.
- iOS has no programmatic install; users add via "Add to Home Screen".
- The generated runtime document is still consumed by Claude Design and is not
  a conventional React application, but its editable shell, styles, controller
  and tested domain logic are now separate source files.
