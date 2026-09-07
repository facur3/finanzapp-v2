# Assistant and market data

## What the assistant does

The assistant accepts Argentine Spanish by microphone or text and produces a
draft for one of these actions:

- expense or income;
- transfer between the user's own accounts;
- card purchase;
- stored recurring movement, such as salary or a subscription;
- card payment, including the full current statement;
- creation of a monthly recurrent, budget, category or tag.

Every draft is checked against the local account, category, card and recurring
IDs. The assistant cannot invent an ID and it never writes a movement until the
user taps **Confirmar**.

The same local engine also answers read-only questions in text. It derives every
answer from the transactions currently stored on the device and supports, among
others:

- `¿En qué gasté ayer?` and spending by day, week, month, category or known merchant;
- `¿Por qué gasté más este mes?`, compared fairly with the same elapsed days of
  the previous month and explained by category deltas;
- income and period balance questions;
- available money, account balances, investments, net worth and card debt/current
  statements.

Transfers are excluded from income/spending analysis. Mixed-currency totals use
the saved USD rate; when that rate is missing, the answer keeps currencies
separate or says that a valid comparison cannot be calculated. Empty or
insufficient history produces an explicit no-data answer instead of a guess.

Before saving, **Editar** opens the normal complete form with the interpreted
values already filled in. The user can change the action type, amount,
source/merchant, category, account, date, note or tags without repeating the
phrase. Income expressions include direct forms (`cobré`, `recibí`, `ingresé`)
and natural incoming-money forms (`me pagaron`, `me ingresaron`, `me dieron`,
`me prestaron`, `me regalaron`, `me devolvieron`, `me reembolsaron`, etc.).
Currency words and category/item terms are removed before deriving the merchant
or income source, so `pesos` and `ropa` do not become business names.

All commands and questions are processed on the device. The deployment has no
remote assistant route or paid model. Account, category, card, recurring,
transaction and balance data stay in the local app. Incomplete commands still
produce a safe preview when possible and clearly list the missing fields.

## Model, tokens and cost

The active assistant is a deterministic local intent engine, not a generative
large language model. It uses no tokens and has no per-command or monthly cost.
This is deliberate: for writing money movements, predictable extraction and a
confirmation step are safer than downloading a large model or relying on a free
quota that can change.

An in-browser generative model remains a future optional enhancement. WebLLM or
Transformers.js can run open models locally, but they require a substantial first
download and compatible device memory/graphics support. They should only be
offered behind an explicit download screen and must never replace the reliable
local parser for the core transaction actions.

There is no remote assistant endpoint in the deployment and no AI API key to
configure. The normal product therefore has no path that can create token
charges.

On the web, dictation uses interim browser Web Speech results so the textarea is
updated while the person is still talking. In the
Capacitor iOS shell it uses `@capacitor-community/speech-recognition`; after
installing dependencies run `npm run build && npx cap sync ios` before opening
the Xcode project.

## Market data boundary

FinanzApp currently updates each imported holding from its configured quantity
and quote convention:

- crypto through Binance public market data, with CoinGecko as a keyless
  fallback, and the Argentine crypto-dollar rate for ARS totals;
- CEDEARs and Argentine bonds through Data912's delayed, educational
  BYMA-oriented feed. Bonds can declare a quote divisor (normally 100 nominal)
  and separate ARS/USD species;
- Cocos Rendimiento Clase A from its official CAFCI regulatory page. The free
  ArgentinaDatos/CAFCI dataset is the fallback and is also used for compatible
  FCI history. CAFCI reports this class per 1,000 quota parts, so the adapter
  normalizes that value before multiplying it by the individual COCORMA units;
- actual 7-day, 30-day and year-to-date FCI returns calculated from official
  CAFCI VCP observations. A broker TNA capture can be shown as a dated reference,
  but it is never treated as the actual return or silently refreshed by scraping;
- historical charts through a provider-aware server adapter.

Every saved quote carries source, observation time, fetch time and quality. A
provider can be delayed, unavailable or change format, so the UI exposes that
state. A failed or older response never replaces a newer broker capture with
zero or stale data; the last known value remains visible with its real status.

An account total is only complete when every holding can be converted to ARS.
Unknown bank balances are shown as pending and make the dashboard total partial
instead of silently treating them as zero.

There is no direct Cocos account connection. Do not ask users for Cocos passwords
or scrape a signed-in session. A future adapter must use either an official
OAuth/API contract or a stable, documented Cocos export and must reconcile
positions before mutating the portfolio.

The app can update the market value of a known quantity. It cannot discover a
new Cocos subscription, rescue or broker-side trade without an official account
API; those quantity-changing events must be registered or imported. For an FCI,
the quantity of units stays fixed while the VCP changes and changes only when
units are subscribed or redeemed.

Use **Conciliar** when the goal is to make the app equal a broker statement. It
sets the observed quantity and total market value without inventing an income,
expense or cash movement. Use **Comprar/Vender** only for an actual operation;
those flows require the cash account that funded or received the trade.
