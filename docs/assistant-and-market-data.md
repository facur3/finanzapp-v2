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

Straightforward commands are parsed on the device. Ambiguous commands may call
`POST /api/assistant`, which uses OpenAI Structured Outputs. The model receives
only the phrase and current date. Account, category, card and recurring names or
IDs and stored catalogs never leave the device; a name is sent only if the user
included it in the phrase itself. Textual references from the response are
matched locally. Transaction history, balances and authentication data are not
sent to the model, and the OpenAI key never reaches the browser. Responses are
requested with storage disabled. A small server-side rate limit defaults to 30
requests per minute per client; `ASSISTANT_RATE_LIMIT_PER_MINUTE` can lower it.

## Model, tokens and cost

The optional fallback defaults to `gpt-5.6-luna` because this task is short,
structured extraction rather than financial advice or long-form reasoning. It
supports Structured Outputs and is priced for high-volume, cost-sensitive work.

At the current published price, `gpt-5.6-luna` costs US$0.20 per million input
tokens and US$1.20 per million output tokens. The endpoint reads the actual
`usage` returned by OpenAI and sends the token count plus an estimate to the UI.
For example, 500 input + 120 output tokens is about US$0.000244. Actual totals
depend on phrase/output size. Configure project spend limits/alerts and verify
that enforcement is enabled: a notification-only budget is a soft threshold and
does not stop requests by itself.

The OpenAI model page does not list a supported free API tier for this model.
FinanzApp therefore never requires it: clear commands use the local parser with
zero API tokens, and the app remains functional when no key is configured.

## Server configuration

Set these values in the server/deployment environment:

```text
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-5.6-luna
ASSISTANT_RATE_LIMIT_PER_MINUTE=30
```

`OPENAI_MODEL` is optional; the value above is the default. Configure both as
server-side deployment variables, never prefix the key with `VITE_`, and never
commit it to the repository.

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
