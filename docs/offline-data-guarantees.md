# FinanzApp — Offline & Persisted-Data Guarantees

This document describes how FinanzApp loads, persists, and renders data, and the
guarantees (and limits) of its offline-first startup.

## App shell offline behavior

After the **first successful online load**, the service worker (`public/sw.js`)
precaches the app shell:

- `/` and `/index.html`
- `/support.js` (Claude Design runtime)
- `/vendor/react.production.min.js` and `/vendor/react-dom.production.min.js`
- manifest and icons

On later visits the full app boots and renders **offline** from this cache. The
React runtime is vendored locally, so startup never depends on `unpkg.com`.

> A web PWA cannot be installed/cached before its first online load. The very
> first visit must be online; everything after that can be offline.

## Persisted data: localStorage is the source of truth

- App state is stored in `localStorage` under **`finanzapp:v2:state`**
  (legacy key `finanzapp.v2.state` is still read as a fallback).
- The payload is a versioned envelope:
  `{ app:"FinanzApp", schema:"finanzapp.local.v2", version:2, savedAt, state:{…} }`.
- Only a fixed set of **persistent keys** is stored (accounts, balances, txns,
  categories, cards, totals, theme, privacy mode, etc.) — transient UI state
  (open sheets/modals, current tab, drafts) is never persisted.
- The service worker **never** caches or clears `localStorage`; user data is
  independent of the shell cache.

### Same-origin / same-browser rule

`localStorage` is scoped to the **origin** and to the **specific browser/profile**.
Data saved in Safari is not visible in Chrome, and data on one device is not on
another. Installing via "Add to Home Screen" keeps the same origin, so the
installed app shares storage with that browser.

**Optional cloud sync** (Supabase, see `SUPABASE_SETUP.md`) can bridge devices when
signed in: the persistent snapshot is mirrored to a single JSONB row per user with
last-write-wins by timestamp. `localStorage` remains the local source of truth and
the app stays fully functional offline; the cloud is a mirror, not a dependency.

## No-flicker startup guarantee

When valid saved data exists, the app renders **immediately with the real data**
on the first visible frame. There is no transient default/empty phase such as
"Patrimonio total: 0" that updates a moment later.

How this is enforced:

- Saved state is read **synchronously in the component constructor**
  (`readPersistedState()`), validated/migrated (`coercePersistedState()`), and
  merged into the initial state **before the first render**.
- It is **not** initialized with empty/sample/default data and then replaced in
  `componentDidMount`. `componentDidMount` only surfaces the corrupted-data notice
  (which cannot be shown before the first render).
- This covers the home net-worth/patrimonio total, account balances, card
  balances, investments, the Activity list, category totals, and
  theme/privacy/settings — all derive from the synchronously-loaded state.

The fix is purely an **initialization-order** change — no loading screen,
skeleton, or visual masking was added, and the UI is unchanged.

## Corrupted / unavailable storage

- If the saved payload is unparseable, the app **does not crash or blank-screen**:
  it boots with safe defaults and shows the existing toast
  "Datos locales dañados · se inició en modo seguro".
- If `localStorage` is entirely unavailable (e.g. disabled), startup falls back to
  defaults without throwing.

## Limitations

- **First load must be online** (inherent to web PWAs).
- **Storage is per-origin, per-browser, per-device.** Cross-device continuity is
  available only through the optional Supabase cloud sync; without it, storage stays
  local to each browser/device.
- A corrupted payload currently falls back to defaults; the next successful save
  overwrites the corrupted value. There is **no automatic quarantine/backup** of a
  corrupted payload today (the app has no existing pattern for it). See the
  migration path below if stronger durability is desired.
- Fonts (Google Fonts / Poppins) are loaded cross-origin and not cached, so
  offline rendering falls back to system fonts (layout is unaffected).

## Future durability path (not implemented — documented only)

If richer storage is needed later, migrate persistence to **IndexedDB via Dexie**
as a separate phase:

1. Keep `localStorage` as a read fallback / one-time importer.
2. Move the persistent snapshot into a Dexie table, preserving the same
   `coercePersistedState` validation and the synchronous-bootstrap guarantee
   (hydrate the first render from an in-memory cache seeded before mount).
3. Optionally add a quarantine table for corrupted payloads before overwrite.

This is intentionally **out of scope** for the current local-first architecture.
