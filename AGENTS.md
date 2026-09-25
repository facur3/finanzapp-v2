# FinanzApp: read before working

FinanzApp is the native app in `apps/mobile` (Expo, React Native, TypeScript): iOS first,
Android later from the same project. The source of truth is `apps/mobile`, `packages/domain`
and the mobile backend contracts (`packages/integrations`, `server/mobile`, `api/mobile`).
The old Vercel web app and its Capacitor shell are frozen legacy until a separate retirement
PR removes them ([decision 004](docs/decisions/004-native-first-and-web-retirement.md),
[inventory](docs/web-retirement-inventory.md)).

1. Read `README.md`, `docs/mobile-roadmap.md`, `docs/decisions/001-native-mobile.md`,
   `docs/decisions/002-spending-first.md` and `docs/decisions/004-native-first-and-web-retirement.md`
   before changing architecture or mobile code. Native scope is spending/commitments with
   optional simple accounts; the web's portfolio/market-data hub is not migrated.
2. For mobile changes also read `apps/mobile/README.md` and `docs/mobile-device-checklist.md`;
   for UI changes read `docs/mobile-design.md`; for money, currencies or FX read
   `docs/currency.md`; for language or region read `docs/i18n.md`. Keep their status and next
   action current. Older handoffs live in `docs/mobile-roadmap-history.md`.
3. The native app is the product. Never change its bundle identifier, run a database
   migration remotely, make an EAS cloud build, a store submission or a paid subscription
   without an explicit release decision and the owner's authorization for any charge. The
   legacy web tree (`index.html`, `src/app`, `support.js`, `public/`, `src/capacitor`, root
   `ios/`, `api/chart.js`, `api/fund-data.js`, the web-only `src/domain` modules) gets no
   features, no new dependencies and no refactors; fix it only when its CI breaks, until the
   retirement PR. Do not delete or move it outside that PR.
4. Preserve unrelated worktree changes. Do not merge all branches blindly. Use a focused
   feature branch/PR and report exactly what was verified.
5. User data starts empty. Never seed balances, holdings, movements or fabricated market
   history. Synthetic fixtures belong only in tests. This repo is public: no financial
   backups, screenshots, tokens, signing keys or bank credentials.
6. `packages/domain` is the typed financial domain the app imports; import pure modules, not
   a browser barrel. `src/domain` is the legacy web's rules: only `dates.js` is still
   re-exported by `packages/domain/index.ts`, and it moves there in the retirement PR.
   Preserve behaviour with regression tests; goldens change only deliberately and are recorded.
7. Money is stored in integer minor units per currency. Do not mix currencies without a dated
   exchange rate. Cash, holdings, liabilities and cost basis are distinct. Purchases, transfers,
   card payments and instalments must not be counted twice: an instalment plan is a finite
   obligation tied to one purchase, never a recurring expense. Unknown cost/quote is unknown,
   not zero or a simulated value.
8. Save locally before confirming success. Failed writes keep the draft. Never reset storage on
   an error. Future sync needs operation IDs, conflict handling and deletion records; adding
   Supabase does not automatically provide offline sync.
9. Native navigation owns push/pop/modal gestures. Do not reproduce the legacy DOM
   snapshot/redirect animation. Honor Reduce Motion, text scaling and safe areas. Motion follows
   `apps/mobile/src/ui/motion.tsx` and the rules in `docs/mobile-design.md`.
10. Face ID, notification delivery, Wallet/Shortcuts, animation feel and gesture quality require
    actual device evidence. A JS bundle/typecheck is not an Xcode build or iPhone QA. Never claim
    App Store approval or a fixed frame rate before verification.
11. The Assistant is a central capability, not a decorative page: it proposes movements and
    changes as reviewed drafts, asks the minimum clarification, and answers analytical questions
    from verifiable ledger data. It never executes a financial write without the person's
    confirmation. Apple Pay capture records an expense; it does not execute bank payments or read
    arbitrary Wallet history. Bank integrations require official access and user consent. Cloud AI
    is opt-in, server-keyed and bounded; no live paid calls until the owner configures their
    account; local manual entry stays offline.
12. Before handing off: run the checks listed in `apps/mobile/README.md` (typecheck, real
    SQLite tests, `currency:verify`, `regions:verify`, `i18n:check -- --strict`, `check`,
    `export:ios`) and the root `npm test` and `npm run check:repo`; the legacy `npm run build`
    must stay green until retirement. Record outcomes and blockers in `docs/mobile-roadmap.md`.

The root `index.html` and `public/finanzapp.css` are generated from `src/app` while the web
exists; do not hand-edit them. Keep root `ios/` (Capacitor, legacy) separate from the generated
`apps/mobile/ios/` (Expo, git-ignored). Never run `expo prebuild --clean` at the repo root.
