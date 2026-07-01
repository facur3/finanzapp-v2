# Capacitor iOS Wrapper Spike

**Status:** spike branch only. Do not merge until web checks are green, generated
files are reviewed, and real iPhone testing is planned on macOS/Xcode.

## What This Is

This is **not** a Swift rewrite and **not** a React migration. It wraps the
existing Vite/PWA app in a native iOS shell using Capacitor. The FinanzApp UI and
data logic still live in the existing web app, mostly in `index.html` plus the
small tested helpers under `src/domain/`.

The Capacitor config uses the built Vite output from `dist`:

```ts
webDir: 'dist'
```

## Why This Is Needed

Real iPhone testing showed the PWA limit:

- FinanzApp installed from Safari opens as a standalone PWA from the Home Screen.
- iOS Shortcuts -> **Open URL** opens Safari, not the installed standalone PWA.
- iOS Shortcuts -> **Open App** does not list FinanzApp as an available app.

That means PWA-only is not enough for the Apple Pay / Wallet automation flow.
The native iOS shell gives FinanzApp a real app identity and a custom URL scheme:

```text
finanzapp://
```

## Deep Link Contract

The native app registers this iOS URL scheme in `ios/App/App/Info.plist`:

```text
finanzapp://quick-add-expense
```

Target Shortcut URL:

```text
finanzapp://quick-add-expense?amount=<amount>&merchant=<merchant>&source=shortcut
```

Full manual test URL:

```text
finanzapp://quick-add-expense?amount=12.50&merchant=Starbucks&category=comida&tags=cafe,apple-pay&note=Apple%20Pay&source=shortcut
```

The Capacitor bridge listens with `@capacitor/app`:

- `App.addListener('appUrlOpen', ...)`
- `App.getLaunchUrl()` on startup

It converts native deep links into the same Shortcut Capture v2 query used by
the PWA:

```text
?quickAdd=expense&source=shortcut&amount=12.50&merchant=Starbucks
```

Then the existing `parseShortcutCaptureParams()` and Add Expense sheet flow are
used. Shortcut parsing is not duplicated.

## Shortcut Recipe

Wallet transaction trigger:

1. Ask for amount.
2. Ask for merchant.
3. Open URL:

```text
finanzapp://quick-add-expense?amount=<amount>&merchant=<merchant>&source=shortcut
```

Expected behavior after the native iOS wrapper is installed:

- FinanzApp opens as a real iOS app.
- Add Expense sheet opens automatically.
- The Apple Pay Shortcut capture badge appears.
- Amount and merchant are prefilled.
- Category and tags may be suggested from merchant rules.

## What Can And Cannot Be Automatic

Apple Pay / Wallet still does **not** provide full amount, merchant, category,
or account data directly to this app.

What can work:

- Shortcut asks the user for amount.
- Shortcut asks the user for merchant.
- Shortcut opens `finanzapp://quick-add-expense?...`.
- FinanzApp prefills the expense form.
- FinanzApp infers category/tags from merchant rules.

What cannot be assumed:

- Apple Pay automatically gives this app amount.
- Apple Pay automatically gives this app merchant.
- A PWA URL reliably opens the standalone installed PWA from Shortcuts.

## Linux / Fedora Limitation

These files can be created and reviewed on Linux:

- `capacitor.config.ts`
- `ios/` project files
- web bridge code
- URL normalization tests

But iOS build/run requires macOS + Xcode:

- CocoaPods was not available in this Linux environment.
- `xcodebuild` was not available in this Linux environment.
- No real iPhone device test was performed here.

Real verification must happen later on a Mac or macOS CI runner with Xcode.

## Tracked vs Generated Files

Track the Capacitor/iOS project source files needed to open the wrapper in Xcode:

- `capacitor.config.ts`
- `ios/.gitignore`
- `ios/App/Podfile`
- `ios/App/App.xcodeproj/`
- `ios/App/App.xcworkspace/`
- `ios/App/App/Info.plist`
- `ios/App/App/AppDelegate.swift`
- `ios/App/App/Base.lproj/`
- `ios/App/App/Assets.xcassets/`

Do not track synced/generated native build output:

- `ios/App/App/public/`
- `ios/App/App/capacitor.config.json`
- `ios/App/App/config.xml`
- `ios/App/Pods/`
- `ios/App/build/`
- `ios/capacitor-cordova-ios-plugins/`

Before a production iOS branch is merged from macOS, run CocoaPods and review
whether `ios/App/Podfile.lock` should be generated and tracked to pin native
dependency resolution.

## Mac/Xcode Real-Device Verification

Use these exact steps on a Mac with Xcode installed:

```bash
git checkout capacitor-ios-spike
npm ci
npm run build
npx cap sync ios
npx cap open ios
```

In Xcode:

1. Select a real iPhone as the run destination.
2. Configure signing team if Xcode asks for it.
3. Confirm or adjust the bundle id if needed: `com.facur3.finanzapp`.
4. Run the app on the device.
5. Open the installed native app manually and confirm the existing FinanzApp UI loads.

Do not use simulator-only results as final proof. The target behavior depends on
iOS Shortcuts opening the installed app through the custom URL scheme on real
hardware.

## iPhone Shortcut Test

Create a manual Shortcut on the same iPhone:

1. Open **Shortcuts**.
2. Create a new Shortcut.
3. Add action **URL**.
4. Set the URL to:

```text
finanzapp://quick-add-expense?source=shortcut&amount=12.50&merchant=Starbucks&category=comida&tags=cafe,apple-pay&note=Apple%20Pay
```

5. Add action **Open URLs**.
6. Run the Shortcut manually.

Expected result:

- Native FinanzApp opens, not Safari.
- Add Expense opens automatically.
- The Apple Pay Shortcut capture badge appears.
- Amount is prefilled: `12.50`.
- Merchant/concept is prefilled: `Starbucks`.
- Category is selected if valid: `comida`.
- Tags are applied if valid: `cafe`, `apple-pay`.

After the main Shortcut test:

1. Close and reopen FinanzApp manually and confirm it does not repeatedly reopen stale capture.
2. Open **Nuevo gasto** manually and confirm the shortcut badge is hidden.
3. Type `Uber` manually and confirm category/tag suggestions apply.

## Troubleshooting

- If Safari opens, the `finanzapp://` URL scheme is not registered or the native app is not installed correctly. Check the installed build and `ios/App/App/Info.plist` URL Types.
- If nothing opens, check `ios/App/App/Info.plist` -> `CFBundleURLTypes` -> `CFBundleURLSchemes` includes `finanzapp`.
- If the app opens but the Add Expense sheet does not, check the Capacitor bridge in `src/capacitor/deepLinks.js`, specifically `appUrlOpen` and `getLaunchUrl` handling.
- If the native build fails, check CocoaPods installation, Xcode version, signing team, provisioning profile, and bundle id configuration.

## Decision Criteria

- Merge this spike only after the real iPhone Shortcut test passes.
- If the real iPhone test passes, the next feature should be Local Notifications.
- If the real iPhone test fails, fix the deep link path before adding anything else.

Do not mark the iOS spike as device-verified until this checklist is completed
on real iPhone hardware.
