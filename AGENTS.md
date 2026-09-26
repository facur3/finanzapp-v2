# FinanzApp: read before working

FinanzApp is the native app in `apps/mobile` (Expo, React Native, TypeScript): iOS first,
Android later from the same project. The source of truth is `apps/mobile`, `packages/domain`
and the mobile backend contracts (`packages/integrations`, `server/mobile`, `api/mobile`). There
is no web version of the product ([decision 004](docs/decisions/004-native-first-and-web-retirement.md)).

1. Read `README.md`, `docs/mobile-roadmap.md`, `docs/decisions/001-native-mobile.md`,
   `docs/decisions/002-spending-first.md` and `docs/decisions/004-native-first-and-web-retirement.md`
   before changing architecture or mobile code. Native scope is spending/commitments with
   optional simple accounts; no portfolio, market data or investments.
2. For mobile changes also read `apps/mobile/README.md` and `docs/mobile-device-checklist.md`;
   for UI changes read `docs/mobile-design.md`; for money, currencies or FX read
   `docs/currency.md`; for language or region read `docs/i18n.md`. Keep their status and next
   action current. Older handoffs live in `docs/mobile-roadmap-history.md`.
3. The native app is the product. Never change its bundle identifier, run a database
   migration remotely, make an EAS cloud build, a store submission or a paid subscription
   without an explicit release decision and the owner's authorization for any charge.
4. The frontend retired in 2026 stays retired: never restore a root `src/`, `public/`, `ios/`,
   `index.html`, `support.js`, `capacitor.config.ts`, `api/chart.js`, `api/fund-data.js` or an
   `archive/` copy (its history is the tag `web-frontend-final`). `npm run check:repo` fails if
   they come back or if `apps/mobile`, `packages/`, `server/` or `api/mobile` import from them.
   Nothing under `api/` other than `api/mobile/` is deployed.
5. Preserve unrelated worktree changes. Do not merge all branches blindly. Use a focused
   feature branch/PR and report exactly what was verified.
6. User data starts empty. Never seed balances, holdings, movements or fabricated market
   history. Synthetic fixtures belong only in tests. This repo is public: no financial
   backups, screenshots, tokens, signing keys or bank credentials.
7. `packages/domain` is the typed financial domain the app imports; import pure modules, not
   a browser barrel, and keep every module inside the package (no import reaches outside it).
   Preserve behaviour with regression tests; goldens change only deliberately and are recorded.
8. Money is stored in integer minor units per currency. Do not mix currencies without a dated
   exchange rate. Cash, holdings, liabilities and cost basis are distinct. Purchases, transfers,
   card payments and instalments must not be counted twice: an instalment plan is a finite
   obligation tied to one purchase, never a recurring expense. Unknown cost/quote is unknown,
   not zero or a simulated value.
9. Save locally before confirming success. Failed writes keep the draft. Never reset storage on
   an error. Future sync needs operation IDs, conflict handling and deletion records; adding
   Supabase does not automatically provide offline sync.
10. Native navigation owns push/pop/modal gestures. Honor Reduce Motion, text scaling and safe
    areas. Motion follows `apps/mobile/src/ui/motion.tsx` and the rules in `docs/mobile-design.md`.
11. Face ID, notification delivery, Wallet/Shortcuts, animation feel and gesture quality require
    actual device evidence. A JS bundle/typecheck is not an Xcode build or iPhone QA. Never claim
    App Store approval or a fixed frame rate before verification.
12. The Assistant is a central capability, not a decorative page: it proposes movements and
    changes as reviewed drafts, asks the minimum clarification, and answers analytical questions
    from verifiable ledger data. It never executes a financial write without the person's
    confirmation. Apple Pay capture records an expense; it does not execute bank payments or read
    arbitrary Wallet history. Bank integrations require official access and user consent. Cloud AI
    is opt-in, server-keyed and bounded; no live paid calls until the owner configures their
    account; local manual entry stays offline.
13. Android is built in `apps/mobile`, sharing navigation, domain, storage abstractions, i18n,
    the Assistant and the components. Platform differences live behind `Platform.OS`,
    `.ios.tsx`/`.android.tsx` files or adapter modules, never in a second repository or a second
    native project without an architectural decision recorded in `docs/decisions/`. Android is
    not implemented yet and is not started without a roadmap entry.
15. The first opening (`app/onboarding.tsx`) is shown to a new installation only and every step
    can be skipped; an existing person is marked done silently and nothing of theirs is changed.
    It reuses the language, region and currency choosers; it never requires a connection, an
    account, a bank or a subscription.
14. Before handing off: run the checks listed in `apps/mobile/README.md` (typecheck, real
    SQLite tests, `currency:verify`, `regions:verify`, `i18n:check -- --strict`, `check`,
    `export:ios`) and the root `npm test` and `npm run check:repo`; the `mobile_api` job needs
    PostgreSQL. Record outcomes and blockers in `docs/mobile-roadmap.md`.

Generated native projects (`apps/mobile/ios/`, `apps/mobile/android/`) are git-ignored and created
by EAS; never run `expo prebuild --clean` at the repo root. The Vercel project hosts only
`api/mobile/*` (see README "Hosting"); it serves no web page and gets no static build.
