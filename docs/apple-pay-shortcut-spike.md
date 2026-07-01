# Spike: Apple Pay / iOS Shortcuts capture

**Status:** throwaway proof-of-concept on branch `spike/apple-pay-shortcut`. Not
merged to `master`. Does not change the app architecture and does not migrate to React.

## What this proves (and what it can't)

iOS does **not** expose Apple Pay / Wallet transaction details (amount, merchant)
to a Shortcut or to a web app — that's a privacy boundary. So a fully automatic
"read my Apple Pay purchase and log it" is **not possible** for a PWA (and not for
Argentine banks at all — FinanceKit is US/UK Apple Card only).

What **is** possible, and what this spike does: an iOS Shortcut that runs when you
tap to pay can **open FinanzApp** on a pre-filled "add expense" screen, so logging
the expense you just made takes ~2 seconds of manual typing. This mirrors what
apps like MonAi actually do.

## The mechanism

The app checks the launch URL on boot (`checkShortcutCapture` in `index.html`). If
it sees:

```
https://<your-finanzapp-url>/?quickAdd=expense&source=shortcut
```

it opens the **Add expense** sheet pre-filled with:

- date = **today** ("Hoy")
- amount = **empty** (you type it — Apple can't provide it)
- merchant/note = **empty**
- a visible badge: **"Apple Pay Shortcut capture"**

The query string is then cleared with `history.replaceState` so a manual refresh
doesn't re-trigger the capture.

## How to create the iOS Shortcut

Prerequisite: install FinanzApp to the Home Screen (Safari → Share → *Add to Home
Screen*) so the URL opens the installed PWA.

1. Open the **Shortcuts** app → **Automation** tab → **+** → **Create Personal
   Automation**.
2. Choose the **Transaction** trigger.
   - Set **Card** to the Apple Pay card you want to track (or "Any").
   - Optionally scope by category/amount.
3. Add action **Open URLs** (or **Open App** → then **Open URL**) with:
   ```
   https://<your-finanzapp-url>/?quickAdd=expense&source=shortcut
   ```
4. Turn **Ask Before Running** off (so it runs right after you pay), if your iOS
   version allows it for this trigger.
5. Save. Now: tap to pay with that card → FinanzApp opens straight to a pre-filled
   expense capture.

> Note: the exact trigger options depend on the iOS version. On some versions the
> automation still shows a notification you tap to run.

## How to test locally (no iPhone needed)

```
npm run build && npm run preview
```

Then open the preview URL with the query string, e.g.:

```
http://localhost:4173/?quickAdd=expense&source=shortcut
```

Expected: the app boots and the **Add expense** sheet opens automatically, showing
the "Apple Pay Shortcut capture" badge, amount empty, date "Hoy".

## Verdict / next steps

- If this feels good on a real iPhone, the same URL can point at the deployed PWA.
- A nicer native trigger (App Intent / Siri, background capture) would require a
  Capacitor shell — but the *data* limitation (no amount from Apple) stays the same.
