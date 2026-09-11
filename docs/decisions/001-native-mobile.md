# Decision 001: the native mobile application

Date: 2026-09-11. Status: accepted for a device-validated pilot.

## Decision

Build the new mobile UI with Expo, React Native and TypeScript. Use Swift for
targeted Apple integrations when needed. Keep the current web/Capacitor app
operational until migration and real-device acceptance are complete.

This decision is not based only on reuse. Even for a new product, the decisive
constraint is maintaining a fast development loop on Linux/Windows with a physical
iPhone and without owning a Mac. Android portability is a secondary benefit,
not a reason to compromise the iOS experience.

## Alternatives, honestly

| Choice | Strength | Cost/constraint | Decision |
| --- | --- | --- | --- |
| SwiftUI + Swift | Direct Apple APIs, first-class Xcode previews and profiling, best alignment for an Apple-only team | Local iOS compile/debug requires macOS. On Linux/Windows an interactive remote Mac is needed for that experience; CI builds alone do not replace it | Valid alternative if the team chooses recurring remote-Mac access or Apple-specific features dominate |
| Expo + React Native | Native views/navigation, TypeScript iteration from Linux/Windows, cloud builds, optional Swift modules | Still needs cloud macOS for iOS compilation; custom native issues can require remote Xcode; performance must be measured | Selected |
| Capacitor | Installable App Store app with the existing web interface | UI is still a WebView; retaining it does not by itself address the desired native navigation/interaction model | Keep current product/fallback, not the new mobile UI |

There is no promise of "100% perfect" from a framework. React Native does not
turn all JavaScript into Swift and not every UI component is an Apple system
control. We choose native stack navigation and standard inputs where useful,
then test behavior, accessibility, memory and dropped frames on real hardware.

## No-Mac workflow

- Develop TypeScript in VS Code on Linux or Windows.
- Expo Go is an optional first look using its bundled native libraries, not the
  shipping app and not sufficient for testing Face ID/custom modules.
- An EAS **development** build is an ad hoc install on registered devices. It
  requires Apple Developer membership, device registration and Developer Mode.
  It connects to Metro (the local JavaScript development server) for iteration.
- An EAS **preview** build is also ad hoc but has bundled JavaScript and needs no
  running computer. Use it for offline/performance checks on the registered phone.
- A **testflight** build uses store distribution, not the internal development
  profile. EAS Submit uploads it to App Store Connect; TestFlight installs it.
- A future production build uses the production app identity only after the
  migration gate. App Store submission is separate from acceptance by Apple.
- EAS Simulator is optional limited-access preview; it is not Expo or EAS Build,
  and not a prerequisite for this plan. Xcode does not run on Linux/Windows.
- Cloud build quotas/queues and future remote-Mac troubleshooting have costs.
  Apple Developer membership is ordinarily USD 99/year (regional price may vary).

## Reuse boundaries and repository

Use the same GitHub repository, with an independent `apps/mobile/package-lock.json`
so the mobile dependency graph does not change the existing Vercel install/build.
Use `packages/domain` as a pure typed entry over existing helpers; do not move all
rules in one unreviewable patch. The current screen HTML/CSS/controller is not
portable native UI. Rebuild screens and storage adapters.

The pilot app ID and deep-link scheme are distinct from Capacitor. It cannot read
Safari/PWA localStorage or another app's container. Existing data requires a
previewed, versioned importer or validated cloud migration; it does not appear
automatically merely because the code is in the same repository.

## Data and security target

- SQLite local database, durable writes and schema migrations; offline core.
- SecureStore/Keychain for small secrets. SQLite is not automatically encrypted
  by using SecureStore or showing a Face ID prompt. Evaluate SQLCipher/key recovery
  and Apple file-protection policy before production use of sensitive data.
- Supabase stays for optional identity, backup and multi-device sync. Existing
  web cloud storage is a last-write-wins JSON snapshot, not a row-based sync engine.
- Normalized cloud entities plus an operation outbox, server validation,
  idempotency, tombstones and conflict policy must be implemented and tested.
- RLS must isolate users. Never place secret/service-role keys in the app.
- No mandatory account for basic local use. Explain loss risks of uninstalling
  without a backup. A local database is not a backup.

## Apple integrations

Ship reminders, haptics, Face ID (with device-passcode recovery), Apple sign-in,
Shortcuts/App Intents, sharing and widgets in stages. Only request a permission
when the user enables the corresponding feature. Hide financial amounts in
notifications/lock-screen widgets by default.

Apple Wallet's Transaction automation can trigger our Shortcut/App Intent; it
does not grant unrestricted access to all card history. Inspect the actual
amount/merchant/card fields provided on the user's iPhone. Missing information
must remain a draft, not a guessed debit. Match a selected card to a local account,
deduplicate repeated deliveries and offer undo. Prefer App Intents over sensitive
data in URLs. Do not put bank tokens in a Shortcut or URL.

FinanceKit currently documents supported US products and UK banks, not general
Argentine card history. It requires Apple approval and user authorization.
Writing Swift does not bypass entitlements or regional restrictions.

## Acceptance / reconsideration gate

Before migrating every section, install the pilot on a physical iPhone and test:
native navigation and canceled back-swipes; keyboard/date/money sheets; cold
start; saved data after force quit; denied permissions; reduced motion and large
text. Compare an optimized preview/TestFlight build, not only development mode.

If the pilot cannot meet the agreed iOS experience or Apple module requirements
without excessive glue, reconsider SwiftUI plus an interactive remote Mac before
the full migration. Keep test evidence and remaining issues in the roadmap.

## Primary references (verified 2026-09-11; recheck before release)

- [React Native native components](https://reactnative.dev/docs/intro-react-native-components)
- [Expo development builds](https://docs.expo.dev/develop/development-builds/introduction/)
- [EAS builds for a physical iPhone](https://docs.expo.dev/tutorial/eas/ios-development-build-for-devices/)
- [EAS Build](https://docs.expo.dev/build/introduction/)
- [EAS Simulator preview](https://docs.expo.dev/preview/eas-simulator/introduction/)
- [Xcode system requirements](https://developer.apple.com/xcode/system-requirements/)
- [Apple enrollment](https://developer.apple.com/programs/enroll/)
- [SQLite](https://docs.expo.dev/versions/latest/sdk/sqlite/) and [SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/)
- [Supabase and Expo](https://supabase.com/docs/guides/getting-started/tutorials/with-expo-react-native)
- [Apple Transaction trigger](https://support.apple.com/guide/shortcuts/transaction-trigger-apd65c67538a/ios)
- [FinanceKit availability](https://developer.apple.com/financekit/)
- [App Store rules](https://developer.apple.com/app-store/review/guidelines/)
