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

This version intentionally **does not** convert the app to React. It runs from the
Claude Design runtime. There is **no React, no Dexie, no Supabase, no Capacitor,
and no backend.** Future refactors must be parity-safe: one screen/flow at a time,
with the Claude Design behavior preserved exactly after every commit.

## Functionality included

- Local state for accounts, movements, cards, categories, tags, investments and settings.
- Local persistence with `localStorage`, so data survives refresh/reopen.
- Empty-first onboarding and optional sample data from the design.
- Category chart tap filters Activity automatically.
- Functional quick-add flows, movement detail, card purchase, card payment,
  investment trade, account/category/tag/card forms, security/reset, settings and filters.
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

Static deployment, no backend required. `vercel.json` is included.

- **Framework preset:** Other / Static (the project is not detected as a framework)
- **Build command:** `npm run build`
- **Output directory:** `dist`
- **Install command:** `npm install` (or `npm ci`)

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
(`index.html`, `support.js`, manifest, icons). On subsequent visits the app shell
loads offline, and existing `localStorage` data remains available. User data is
never cached by the service worker.

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

- The PWA is an **app-shell** cache only: web fonts (Google Fonts) are not cached,
  so offline rendering falls back to system fonts.
- No custom install banner, update prompt, or offline UI — by design (UI/UX freeze).
  Service-worker updates apply on the next load without a disruptive prompt.
- iOS has no programmatic install; users add via "Add to Home Screen".
- The app is still the single-file Claude Design runtime, not a React app.
