# FinanzApp

FinanzApp is currently built from the Claude Design runtime export as the exact UI/UX baseline.

## Source of truth

- `index.html` is the running app, based directly on `FinanzApp.dc.html`.
- `support.js` is the Design Components runtime.
- `design-reference/FinanzApp.dc.html` and `design-reference/support.js` are kept as the untouched reference files.

This version intentionally does **not** convert the app to React yet. The priority is exact parity with the Claude Design UI/UX: screens, sheets, pushed views, charts, filters, category behavior, quick actions, cards, accounts, investments, settings, export/import, privacy and onboarding.

## Functionality included

- Local state for accounts, movements, cards, categories, tags, investments and settings.
- Local persistence with `localStorage`, so data survives refresh/reopen.
- Empty-first onboarding and optional sample data from the design.
- Category chart tap filters Activity automatically.
- Functional quick-add flows, movement detail, card purchase, card payment, investment trade, account/category/tag/card forms, security/reset, settings and filters.
- CSV export.
- JSON backup export.
- JSON backup import.

## Run locally

```bash
npm install
npm run dev
```

Open:

```text
http://localhost:5173
```

## Build

```bash
npm run build
npm run preview
```

## Important rule

Do not rewrite this into React in one large pass. Future refactors must be parity-safe: one screen/flow at a time, with the Claude Design behavior preserved exactly after every commit.
