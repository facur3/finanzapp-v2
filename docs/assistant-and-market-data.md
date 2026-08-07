# Assistant and market data

## What the assistant does

The assistant accepts Argentine Spanish by microphone or text and produces a
draft for one of these actions:

- expense or income;
- stored recurring movement, such as salary or a subscription;
- card payment, including the full current statement.

Every draft is checked against the local account, category, card and recurring
IDs. The assistant cannot invent an ID and it never writes a movement until the
user taps **Confirmar y guardar**.

Straightforward commands are parsed on the device. Ambiguous commands may call
`POST /api/assistant`, which uses OpenAI Structured Outputs. The model receives
only the phrase and current date. Account, category, card and recurring names or
IDs never leave the device; textual references from the response are matched
locally. Transaction history, balances, authentication data and the OpenAI key
are not sent to the browser or model. Responses are requested with storage
disabled.

## Server configuration

Set these values in the server/deployment environment:

```text
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-5.6-luna
```

`OPENAI_MODEL` is optional; the value above is the default. Configure both as
server-side deployment variables, never prefix the key with `VITE_`, and never
commit it to the repository.

On the web, dictation uses the browser Web Speech API when available. In the
Capacitor iOS shell it uses `@capacitor-community/speech-recognition`; after
installing dependencies run `npm run build && npx cap sync ios` before opening
the Xcode project.

## Market data boundary

FinanzApp currently updates:

- crypto through CoinGecko and the Argentine crypto-dollar rate;
- CEDEARs and Argentine bonds through public BYMA-oriented feeds, with Yahoo
  Finance fallback for supported symbols;
- FCI unit values through ArgentinaDatos phrase matching;
- historical asset charts through the server-side chart proxy.

Providers can be delayed, unavailable or change format. A visible last-updated
time and manual price correction remain part of the product contract.

There is no direct Cocos account connection. Do not ask users for Cocos passwords
or scrape a signed-in session. A future adapter must use either an official
OAuth/API contract or a stable, documented Cocos export and must reconcile
positions before mutating the portfolio.
