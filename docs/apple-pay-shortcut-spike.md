# Apple Pay / iOS Shortcuts capture

**Status:** merged PWA flow. This keeps FinanzApp as a web app and does not add
React migration, Capacitor, Swift, or native iOS code.

## What Apple Provides

iOS does **not** automatically expose full Apple Pay / Wallet transaction data
to this PWA. Do not assume FinanzApp can read the amount, merchant, category, or
account from Apple Pay by itself.

What works well: an iOS Shortcut can open FinanzApp with URL parameters. If the
Shortcut asks you for the amount and merchant, FinanzApp can prefill the expense
form and suggest category/tags from local merchant rules.

## Supported URL

Basic capture:

```text
https://finanzapp-v2-rho.vercel.app/?quickAdd=expense&source=shortcut
```

Prefilled capture:

```text
https://finanzapp-v2-rho.vercel.app/?quickAdd=expense&source=shortcut&amount=12.50&merchant=Starbucks&category=comida&tags=cafe,apple-pay&note=Apple%20Pay
```

Supported optional params:

- `amount=1234.56`
- `merchant=Starbucks`
- `category=comida`
- `account=<account id>`
- `tags=cafe,apple-pay`
- `note=Apple Pay`

Invalid or missing params are ignored safely. After opening the sheet, FinanzApp
cleans the URL with `history.replaceState` so refresh does not reopen capture.

## Behavior

- `quickAdd=expense` opens the Add Expense sheet automatically.
- `source=shortcut` shows the badge **Apple Pay Shortcut capture**.
- `amount` prefills the amount.
- `merchant` prefills the concept/merchant field.
- `category` is selected only if it is valid.
- `account` is selected only if it is valid.
- `tags` are normalized, created in the app tag list, and selected for the expense.
- `note` is saved as the transaction note when the current form can carry it.
- Merchant rules can suggest category and tags, for example Starbucks -> Comida + `#cafe`.

## Recipe A: Basic Shortcut

Use this when you want the fastest setup and will type the amount in FinanzApp.

1. Install FinanzApp to the Home Screen from Safari.
2. Open **Shortcuts** -> **Automation** -> **+** -> **Create Personal Automation**.
3. Choose the **Transaction** trigger.
4. Select the Apple Pay card you want to track, or choose any card if your iOS version supports it.
5. Add action **Open URLs**.
6. Set the URL to:

```text
https://finanzapp-v2-rho.vercel.app/?quickAdd=expense&source=shortcut
```

Expected result: after the Wallet transaction automation runs, FinanzApp opens
to the Add Expense sheet with the shortcut badge. You enter the amount and save.

## Recipe B: Better Shortcut

Use this when you want FinanzApp to open with amount and merchant already filled.

1. Install FinanzApp to the Home Screen from Safari.
2. Open **Shortcuts** -> **Automation** -> **+** -> **Create Personal Automation**.
3. Choose the **Transaction** trigger and select the relevant card.
4. Add **Ask for Input**.
5. Set prompt to `Monto`, input type **Number**.
6. Add another **Ask for Input**.
7. Set prompt to `Comercio`, input type **Text**.
8. Add **URL** or **Text** and build:

```text
https://finanzapp-v2-rho.vercel.app/?quickAdd=expense&source=shortcut&amount=<amount>&merchant=<merchant>
```

9. Use the Shortcut variables from the two prompts for `<amount>` and `<merchant>`.
10. Add **Open URLs** using the built URL.
11. Turn **Ask Before Running** off if your iOS version allows it for Wallet transaction automations.

Expected result: after paying, iOS asks for amount and merchant, then opens
FinanzApp with those fields prefilled. FinanzApp may also suggest category and
tags from merchant rules.

## Manual Test URL

Use the deployed PWA URL, not only localhost:

```text
https://finanzapp-v2-rho.vercel.app/?quickAdd=expense&source=shortcut&amount=12.50&merchant=Starbucks&category=comida&tags=cafe,apple-pay&note=Apple%20Pay
```

Expected result:

- Add Expense sheet opens automatically.
- Badge appears.
- Amount is prefilled.
- Merchant/concept is prefilled.
- Category is selected if valid.
- Tags are applied.
- Refresh does not reopen the sheet.
- Opening **Nuevo gasto** manually does not show the shortcut badge.

## Real iPhone Test

Important: on iOS, **Shortcuts -> Open URL** may open Safari instead of the
installed standalone PWA. Do not assume PWA deep-link behavior. This must be
tested on a real iPhone.

If **Open URL** opens Safari and the desired experience is to open the standalone
installed app, the next technical path is likely a Capacitor/iOS wrapper with
deep links, not React.

Checklist:

1. Install FinanzApp from Safari using **Add to Home Screen**.
2. Open FinanzApp from the Home Screen icon and confirm it opens standalone, without Safari browser bars.
3. Create a Shortcut with **Open URL**:

```text
https://finanzapp-v2-rho.vercel.app/?quickAdd=expense&source=shortcut
```

4. Run the Shortcut manually.
5. Record the result:

- Opens standalone PWA
- Opens Safari
- Opens in another browser

6. If it opens Safari, test whether Shortcuts has an **Open App** action that can select FinanzApp.
7. Record whether **Open App -> FinanzApp** is available.
8. If **Open App** works, document the limitation: it opens the app but cannot pass amount/merchant/category query params.
9. Do not assume PWA deep-link behavior. Document the actual iPhone result.
