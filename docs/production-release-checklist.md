# FinanzApp — Production Release Checklist

Run before every production deploy. The UI/UX is frozen: it must look and behave
identically to the approved Claude Design baseline. This checklist validates the
build, the PWA shell, the vendored runtime, offline behavior, and repo hygiene.

## 1. Build & local preview

- [ ] `npm install`
- [ ] `npm run build` passes with no errors
- [ ] `npm run check:repo` → "OK: no forbidden generated files are tracked"
- [ ] `npm run preview` serves `dist/` and the app loads

## 2. PWA shell

- [ ] `/manifest.webmanifest` loads (DevTools → Application → Manifest)
- [ ] Icons load (192, 512, maskable, apple-touch-icon, favicon)
- [ ] No favicon 404 in the Network tab
- [ ] Service worker registers and is **active** (Application → Service Workers)
- [ ] `theme-color` / standalone metadata present in `<head>`

## 3. Vendored runtime (no critical CDN dependency)

- [ ] `/vendor/react.production.min.js` loads **from your own origin** (200)
- [ ] `/vendor/react-dom.production.min.js` loads from your own origin (200)
- [ ] No request to `unpkg.com` is required for the app to boot
- [ ] No SRI / integrity error in the console for the vendored files

## 4. Offline behavior

- [ ] Load the app once online (lets the SW precache the shell + vendored React)
- [ ] DevTools → Network → **Offline**, then reload
- [ ] The real app renders offline (not just a static fallback) — no blank screen
- [ ] No runtime crash, no `[dc-runtime] logic class eval FAILED`
- [ ] No unexpected console errors (a blocked Google Fonts request offline is expected)

## 5. Data & flows

- [ ] Add/edit data, refresh → `localStorage` data persists
- [ ] CSV export works
- [ ] JSON backup export works
- [ ] JSON backup import works

## 6. Install

- [ ] iPhone Safari → Share → "Add to Home Screen" → launches standalone with the FinanzApp icon
- [ ] Android Chrome → "Install app" works, launches standalone
- [ ] Desktop Chrome/Edge → address-bar Install works (where supported)

## 7. Visual confirmation

- [ ] Screens, layout, spacing, typography, colors, buttons, cards, charts,
      sheets, modals, navigation, icons, labels, and animations are **unchanged**
- [ ] No new UI elements were added (no install banner / update popup / offline screen)
- [ ] Production app does **not** render the Claude Design device mockup/chrome
      (no fake iPhone frame, no fake status bar/time/battery) — the real device
      provides its own status bar
- [ ] App fills the real viewport; top/bottom content respects the safe areas
- [ ] Dark-mode top safe area is dark (no white strip); light-mode top is light
- [ ] Success/info toasts auto-dismiss (~2s) and never stay stuck

## 8. Git hygiene

- [ ] `git status --short` is clean (no generated files)
- [ ] `git diff --stat` shows only intended changes
- [ ] `npm run check:repo` passes
- [ ] `node_modules/`, `dist/`, `.vite/`, `.env` are NOT tracked

## 9. Deploy to Vercel (step by step)

1. Push the latest `master` to GitHub (`facur3/finanzapp-v2`).
2. Go to <https://vercel.com> → **Add New… → Project**.
3. **Import** the `facur3/finanzapp-v2` repository.
4. Set the **Production Branch** to `master` (Project → Settings → Git).
5. Confirm the build settings (already pinned in `vercel.json`):
   - **Framework Preset:** Other (static)
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
   - **Install Command:** `npm install` (or `npm ci`)
6. Click **Deploy**.
7. Open the production URL Vercel returns (e.g. `https://finanzapp-v2.vercel.app`).
8. On the production URL, verify:
   - [ ] Manifest loads (DevTools → Application → Manifest)
   - [ ] Icons + favicon load, no 404
   - [ ] Service worker registers and is active
   - [ ] `/vendor/react*.js` load from your own origin (no `unpkg.com`)
   - [ ] No console errors, no `[dc-runtime] logic class eval FAILED`
   - [ ] Reload → toggle Network Offline → reload: app shell loads offline
9. Install on a real device:
   - [ ] **iPhone (Safari):** Share → Add to Home Screen → opens standalone
   - [ ] **Android (Chrome):** menu → Install app → opens standalone
10. Run through `docs/mobile-install-qa.md` on at least one real device.

Every push to `master` triggers an automatic production redeploy.
