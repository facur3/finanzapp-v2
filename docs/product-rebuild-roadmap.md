# Product rebuild roadmap

This document turns the broad redesign into verifiable product increments. The
goal is a trustworthy finance app, not a collection of decorative screens.

## Reference review

The Buro reference is strongest where it uses whitespace, one dominant number,
clear bottom navigation, restrained charts and progressive buy/sell flows. Those
principles informed FinanzApp's revised hierarchy and motion. The product now
uses a calm blue action/selection color with separate semantic green and red,
while keeping its broader personal-finance scope and avoiding a visual copy.

The supplied Cocos screens reinforce a second rule: market discovery, portfolio
value and instrument detail are separate jobs. FinanzApp therefore groups
holdings by CEDEAR/ETF, crypto, bond/ON and FCI, gives every asset a dedicated
detail page, and uses a floating bottom bar without copying Cocos branding.

## Delivered in the assistant/experience foundation

- voice and text capture with native iOS and browser dictation;
- deterministic local interpretation plus optional structured model fallback;
- review-before-write and local-ID validation for every assistant command;
- recurring salary/expense recognition and card statement payments;
- native calendar dates, ISO persistence, dynamic labels and CSV date migration;
- animated dashboard ARS/USD switch instead of navigating away;
- normalized mixed-currency totals, reports and cross-currency transfers;
- bonds alongside CEDEARs, crypto and FCI in the portfolio and price adapters;
- clearer chart labels, native system typography and reduced-motion support.
- modular app-shell sources, floating bottom navigation, horizontal push/back
  motion, responsive spacing and separate portfolio sections for CEDEARs/ETFs,
  crypto, bonds/ONs and FCI.

## Next: ledger and reconciliation

1. Introduce a versioned double-entry ledger with integer minor units. Keep a
   migration adapter for existing `localStorage` backups.
2. Separate cash balances, broker cash and marked-to-market holdings. A trade must
   create cash, quantity, fee and realized-result entries instead of only editing
   a portfolio array.
3. Store quote provenance (`provider`, `asOf`, `currency`, `marketStatus`) and mark
   delayed or stale values in the interface.
4. Add an import preview that reconciles duplicates and position differences
   before applying a broker CSV.
5. Add provider contract tests and cached server-side market adapters so a public
   endpoint format change cannot silently corrupt valuations.

## Next: maintainable interface architecture

Keep Vite, TypeScript, the tested domain modules and Capacitor. The generated
single runtime document is now assembled from separate shell, template,
controller and CSS sources. Continue migrating incrementally to React components
rather than rewriting the whole product in a new native framework:

1. extract screen-level templates and reusable design primitives;
2. extract onboarding and the dashboard;
3. extract movement, card and recurring flows;
4. extract portfolio and reports;
5. replace ad-hoc state with a typed store and repository layer;
6. move durable local data to IndexedDB on web and SQLite in the native shell.

This path preserves the PWA and iOS codebase, keeps each migration releasable and
avoids a long feature freeze. React Native or Flutter would only become justified
if product requirements later depend on native APIs that Capacitor cannot provide.

## Cocos integration gate

Do not call a scraper or accept a user's broker password. Direct Cocos sync can be
shipped only after one of these is available and verified:

- an official OAuth/account API;
- an official export with a stable schema;
- an explicit partner integration agreement.

Until then, use a previewed import and reconcile positions without pretending the
app is connected live.

## Release gates

- domain tests, production build and repository hygiene pass;
- mobile visual QA covers onboarding, dashboard, assistant, calendar and trades;
- migration tests open a previous backup without changing its balances;
- market failures show stale/manual states instead of zeroing assets;
- no assistant action writes without a visible confirmation;
- accessibility includes reduced motion, labels, focus order and minimum targets.
