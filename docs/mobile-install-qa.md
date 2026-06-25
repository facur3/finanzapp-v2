# FinanzApp — Real-Device Mobile Install QA

Run this on a real phone against the deployed production URL after each release.
The UI/UX is frozen — the installed app must look and behave identically to the
browser version. Nothing here should require changing the app interface.

## iPhone / iPad (Safari)

- [ ] Open the production URL in **Safari**
- [ ] Tap **Share → Add to Home Screen**
- [ ] Confirm the **FinanzApp icon** (coral "F" on warm off-white) appears on the home screen
- [ ] Open the app **from the home screen icon**
- [ ] Confirm it launches **standalone / fullscreen** (no Safari address bar)
- [ ] Confirm the UI **matches the browser version** exactly (screens, colors, spacing, fonts)
- [ ] Create an account and add a movement
- [ ] Fully close the app (swipe it away from the app switcher)
- [ ] Reopen the app from the home screen
- [ ] Confirm the account/movement is still there (**localStorage persistence**)
- [ ] Turn on **Airplane mode**
- [ ] Reopen the installed app
- [ ] Confirm the **app shell loads offline** — no blank screen, no crash
- [ ] Confirm previously saved data is still visible offline
- [ ] Turn **Airplane mode off**
- [ ] Confirm the app still works normally

## Android / Chrome (if available)

- [ ] Open the production URL in **Chrome**
- [ ] Use **menu → Install app** (or the install prompt)
- [ ] Confirm the **FinanzApp icon** appears in the launcher
- [ ] Open the app from the launcher icon
- [ ] Confirm it launches **standalone / fullscreen**
- [ ] Confirm the UI **matches the browser version**
- [ ] Create an account/movement
- [ ] Close and reopen the app → confirm **localStorage persistence**
- [ ] Turn on **Airplane mode**, reopen → confirm the **app shell loads offline**
- [ ] Turn Airplane mode off → confirm the app still works

## Notes

- iOS has no programmatic install prompt; "Add to Home Screen" is the supported path.
- Offline rendering falls back to system fonts (Google Fonts are not cached) — this
  is expected and does not affect layout.
- The service worker only caches the app shell + vendored runtime; user data lives in
  `localStorage` and is never cached or cleared by the service worker.
