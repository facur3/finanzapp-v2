# Assistant and market data

## What the assistant does

The assistant accepts Argentine Spanish by microphone or text and produces a
draft for one of these actions:

- expense or income;
- stored recurring movement, such as salary or a subscription;
- card payment, including the full current statement;
- creation of a monthly recurrent, budget, category or tag.

Every draft is checked against the local account, category, card and recurring
IDs. The assistant cannot invent an ID and it never writes a movement until the
user taps **Confirmar y guardar**.

All commands are parsed on the device. The deployment has no remote assistant
route or paid model. Account, category, card, recurring, transaction and balance
data stay in the local app. Incomplete commands still produce a safe preview
when possible and clearly list the missing fields.

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
