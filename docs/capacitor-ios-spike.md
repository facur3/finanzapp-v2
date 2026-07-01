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

## Real iPhone Verification Checklist

1. On macOS, run `npm install`.
2. Run `npm run build`.
3. Run `npx cap sync ios`.
4. Open `ios/App/App.xcworkspace` in Xcode.
5. Set signing team / bundle settings as needed.
6. Build and install on a real iPhone.
7. Open the app manually and confirm the existing FinanzApp UI loads.
8. In Shortcuts, create **Open URL** with:

```text
finanzapp://quick-add-expense?amount=12.50&merchant=Starbucks&category=comida&tags=cafe,apple-pay&note=Apple%20Pay&source=shortcut
```

9. Run the Shortcut manually.
10. Confirm the Add Expense sheet opens with amount, merchant, category, tags, and badge.
11. Refresh/reopen the app and confirm it does not repeatedly reopen stale capture.
12. Test a manual **Nuevo gasto** and confirm the shortcut badge is hidden.
13. Type `Uber` manually and confirm category/tag suggestions apply.

Do not mark the iOS spike as device-verified until this checklist is completed
on real iPhone hardware.
