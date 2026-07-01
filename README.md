# FinanzApp

FinanzApp is a personal finance app (accounts, movements, cards, categories,
tags, investments and settings) with local persistence. It is currently built
from the **Claude Design runtime** export as the exact, approved UI/UX baseline.

## Architecture (read before changing anything)

- `index.html` is the running app, based directly on `design-reference/FinanzApp.dc.html`.
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
- **One serverless function** (`api/chart.js` on Vercel) that proxies Yahoo Finance
  price history for the investment charts. No other backend.

Future refactors must be parity-safe: one screen/flow at a time, with the Claude
Design behavior preserved exactly after every commit.

## Functionality included

- Local state for accounts, movements, cards, categories, tags, investments and settings.
- Local persistence with `localStorage`, so data survives refresh/reopen.
- Empty-first onboarding and optional sample data from the design.
- Category chart tap filters Activity automatically.
- Functional quick-add flows, movement detail, card purchase, card payment,
  investment trade, account/category/tag/card forms, security/reset, settings and filters.
- **Investments**: CEDEARs, crypto and FCI with live prices (CoinGecko, data912,
  Yahoo, ArgentinaDatos), portfolio donut, per-asset price charts, and USD (dólar
  cripto) valuation.
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

Mostly static, plus one serverless function (`api/chart.js`, auto-detected by
Vercel) that proxies price history. `vercel.json` is included and already pins the
build settings below.

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
- `.env`, `.env.*` (except `.env.example`)
- logs (`*.log`)
- OS junk (`.DS_Store`, `Thumbs.db`, …)
- local screenshots / temporary QA artifacts

`npm run check:repo` and CI (`.github/workflows/ci.yml`) enforce this.

## Current limitations

- **Google Fonts (Poppins)** are still loaded cross-origin and are not cached, so
  offline rendering falls back to system fonts. Vendoring fonts would require
  touching the design's `<helmet>` font links, which is out of scope under the
  UI/UX freeze.
- **Babel standalone** (`@babel/standalone`) is still referenced from `unpkg.com`
  in `support.js`, but it is **not a critical dependency**: it is only fetched
  lazily to compile runtime JSX/TSX modules imported via `x-import`, and FinanzApp
  imports none — so it never loads at runtime and never blocks boot or offline use.
  It was intentionally **not** vendored to avoid committing ~2.9 MB of code the app
  never executes. If a future feature adds JSX `x-import` modules, vendor it the
  same way React was vendored.
- No custom install banner, update prompt, or offline UI — by design (UI/UX freeze).
  Service-worker updates apply on the next load without a disruptive prompt.
- iOS has no programmatic install; users add via "Add to Home Screen".
- The app intentionally runs from the single-file Claude Design runtime; it is not
  a React application (even though that runtime uses React internally).
