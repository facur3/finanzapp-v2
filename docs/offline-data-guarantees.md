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
  `{ app:"FinanzApp", schema:"finanzapp.local.v3", version:3, savedAt, revision, checksum, state:{…} }`.
- Each write is verified before and after promotion from a temporary key. The last
  valid primary snapshot is retained at `finanzapp:v2:state:backup`.
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
signed in. `localStorage` remains the immediate source of truth and the app stays
fully functional offline; the cloud is a mirror, not a dependency. Failed uploads
remain marked as pending across reloads and retry when connectivity returns. If the
cloud and the device both changed since their last successful sync, neither snapshot
is overwritten automatically: the account screen asks which complete copy to keep.

The JSON backup is the lossless restore format for the complete state. CSV remains
useful for analysis and for importing simple income/expense rows; linked card
payments, transfers and investment operations require JSON because a flat row does
not contain enough state to rebuild both sides safely.

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

- The v3 checksum detects truncated or modified snapshots before they are trusted.
- Startup tries the valid primary snapshot first, then a verified interrupted-write
  snapshot, the previous-good backup and finally the legacy v2 key.
- If the primary payload is damaged, it is preserved at
  `finanzapp:v2:state:corrupt` for diagnosis rather than silently overwritten.
- When recovery succeeds, the app opens with the recovered real data, explains that
  a backup was restored and promotes it back to the verified v3 format.
- If every candidate is invalid, the app **does not crash or blank-screen**: it boots
  with safe defaults and shows the damaged-data notice.
- If `localStorage` is entirely unavailable (for example, disabled), startup falls
  back to defaults without throwing.

## Limitations

- **First load must be online** (inherent to web PWAs).
- **Storage is per-origin, per-browser, per-device.** Cross-device continuity is
  available only through the optional Supabase cloud sync; without it, storage stays
  local to each browser/device.
- The checksum detects corruption but is not encryption or authentication. Device
  access and browser-profile security still protect local data.
- Fonts (Google Fonts / Poppins) are loaded cross-origin and not cached, so
  offline rendering falls back to system fonts (layout is unaffected).

## Optional future durability path

If richer storage is needed later, migrate persistence to **IndexedDB via Dexie**
as a separate phase:

1. Keep `localStorage` as a read fallback / one-time importer.
2. Move the persistent snapshot into a Dexie table, preserving the same
   `coercePersistedState` validation and the synchronous-bootstrap guarantee
   (hydrate the first render from an in-memory cache seeded before mount).
3. Preserve the existing checksum, previous-good backup and corruption quarantine
   semantics in the IndexedDB records.

This is intentionally **out of scope** for the current local-first architecture.
