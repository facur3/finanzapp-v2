# FinanzApp — Production Release / Smoke Checklist

Run through this before shipping a new build. UI/UX must look identical to the
approved Claude Design baseline — this checklist only validates the PWA shell,
build, and repository hygiene.

## 1. Build & preview

- [ ] `npm install`
- [ ] `npm run build` passes with no errors
- [ ] `npm run preview` starts and serves `dist/`
- [ ] App opens at the preview URL and looks unchanged

## 2. PWA shell

- [ ] `/manifest.webmanifest` loads (DevTools → Application → Manifest)
- [ ] Icons load (192, 512, maskable, apple-touch-icon)
- [ ] No favicon 404 in the Network tab
- [ ] Service worker registers (DevTools → Application → Service Workers)
- [ ] `theme-color` / standalone metadata present in `<head>`

## 3. Offline behavior

- [ ] Load the app once online (lets the service worker precache the shell)
- [ ] Go offline (DevTools → Network → Offline) and refresh
- [ ] App shell still loads — no blank screen, no runtime crash
- [ ] No `[dc-runtime] logic class eval FAILED` in the console
- [ ] No unexpected console errors

## 4. Data persistence

- [ ] Add/edit some data, refresh — `localStorage` data persists
- [ ] CSV export works
- [ ] JSON backup export works
- [ ] JSON backup import works

## 5. Install

- [ ] iPhone Safari → Share → "Add to Home Screen" → launches standalone with the FinanzApp icon
- [ ] Android Chrome → install prompt / menu "Install app" works
- [ ] Desktop Chrome → install icon in the address bar works (where supported)

## 6. Git hygiene

- [ ] `git status --short` is clean (no generated files)
- [ ] `npm run check:repo` passes
- [ ] `node_modules/`, `dist/`, `.vite/`, `.env` are NOT tracked
