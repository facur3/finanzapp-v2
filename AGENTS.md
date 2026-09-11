# FinanzApp: read before working

1. Read `README.md`, `docs/mobile-roadmap.md` and
   `docs/decisions/001-native-mobile.md` before changing architecture or mobile code.
2. For mobile changes also read `apps/mobile/README.md` and
   `docs/mobile-device-checklist.md`. Keep their status and next action current.
3. The current web/Capacitor app remains the production product. The Expo app in
   `apps/mobile` is an isolated pilot, not a complete migration. Never replace
   production, change its bundle identifier or run a database migration remotely
   without an explicit release decision.
4. Preserve unrelated worktree changes. Do not merge all branches blindly.
   Use a focused feature branch/PR and report exactly what was verified.
5. User data starts empty. Never seed balances, holdings, movements or fabricated
   market history. Synthetic fixtures belong only in tests. This repo is public:
   no financial backups, screenshots, tokens, signing keys or bank credentials.
6. `src/domain` contains the existing financial rules. `packages/domain` is the
   shared typed entry; import pure modules, not the browser barrel that writes
   `window.FinanzDomain`. Preserve legacy behavior with regression tests.
7. Money is stored in integer minor units in the native ledger. Do not mix ARS
   and USD without a dated exchange rate. Cash, holdings, liabilities and cost
   basis are distinct. Purchases, transfers and card payments must not be counted
   twice. Unknown cost/quote is unknown, not zero or a simulated return.
8. Save locally before confirming success. Failed writes keep the draft. Never
   reset storage on an error. Future sync needs operation IDs, conflict handling
   and deletion records; adding Supabase does not automatically provide offline sync.
9. Native navigation owns push/pop/modal gestures. Do not reproduce the legacy
   DOM snapshot/redirect animation. Honor Reduce Motion, text scaling and safe areas.
10. Face ID, notification delivery, Wallet/Shortcuts and gesture quality require
    actual device evidence. A JS bundle/typecheck is not an Xcode build or iPhone QA.
    Never claim App Store approval or a fixed frame rate before verification.
11. Apple Pay capture records an expense; it does not execute bank payments or
    read arbitrary Wallet history. Default external/AI input to a reviewed draft.
    Bank integrations require official access and user consent. No paid AI by default.
12. Before handing off: run the relevant checks listed in the mobile README and
    the existing web tests/build/hygiene check. Record outcomes and blockers in
    `docs/mobile-roadmap.md`. No EAS cloud builds, subscriptions or store submissions
    without the user's account setup and authorization for any charge/release.

The root `index.html` and `public/finanzapp.css` are generated from `src/app`.
Do not hand-edit them. Keep root `ios/` (Capacitor) separate from generated
`apps/mobile/ios/` (Expo). Never run `expo prebuild --clean` at the repo root.
