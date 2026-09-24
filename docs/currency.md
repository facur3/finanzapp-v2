# FinanzApp mobile: currencies and the multi-currency engine

Updated 2026-09-24 (Producto 24B1). Applies to the Expo app in `apps/mobile` and the
shared `packages/domain`. The web/Capacitor app keeps its own float-based helpers
(`src/domain/currency.js`) and is not changed. Read with [decision 002](decisions/002-spending-first.md)
(ARS/USD kept apart, no invented rates), [docs/i18n.md](i18n.md) §9 and the roadmap's
Producto 24 entries.

## 1. Five things that are never mixed

| Concept | Lives in | Example | Decided by |
| --- | --- | --- | --- |
| **Amount** | integer minor units, a JavaScript safe integer | `123456` | what the person recorded |
| **Currency** | ISO 4217 alphabetic code, a property of an account | `'KWD'` | the account, never the device |
| **Minor-unit scale** | the currency's ledger exponent (ISO 4217 minor unit) | `3` (1 KWD = 1000 fils) | ISO 4217, frozen once storable |
| **Visual format** | CLDR display digits, symbol, name; the region's separators | `KWD 1.234,567` | presentation (`src/i18n`) |
| **Regional preference** | separators, date order, what a bare "$" means | `AR` | the person (Más → Región) |

The language gives words (currency names, spoken units); the region gives separators;
the account gives the currency; the stored value never changes with any of them. A
region never implies a currency (Argentina is not "ARS by default"; `territories` in
the data is a search hint only), and a future **main currency for reports** (§8) is a
fifth, separate preference.

## 2. What Producto 24A delivers

| Layer | File | Responsibility |
| --- | --- | --- |
| Data (generated) | `packages/domain/currency-data.ts` | Every code of ISO 4217 List One: numeric code, minor unit, CLDR display/cash digits and rounding, kind, availability status, language-neutral and narrow symbols, legal-tender territories. |
| Names (generated) | `apps/mobile/src/i18n/currencies/<language>.ts` | CLDR display, singular and plural names of each fiat currency, and territory names for search, one module per language (`index.ts` is typed by `LanguageCode`, so a new language without its module fails to compile). |
| Catalogue API | `packages/domain/currency.ts` | `LEDGER_CURRENCIES`, `currencyStatus`, `minorUnitExponent`, `displayDigits`, `storedExponent` (the 24B persistence contract), `isLedgerCurrency`, `isIsoCurrencyCode`. |
| Amount model | `packages/domain/money.ts` | `MoneyAmount`, `splitMinor`, the canonical machine form (`minorToMajorString`/`majorStringToMinor`), `parseLocalizedAmount` with explicit separators, BigInt-safe `addMoney`/`subtractMoney`/`sumMoney`/`compareMoney`, limits. |
| Presentation | `apps/mobile/src/i18n/format.ts`, `bind.ts` | `formatMoneyAmount`, `spokenMinor`, and `moneyText`/`codedAmount`/`spokenMoney`/`spokenAmount`/`currencySymbol`/`currencyName` for every code with a minor unit (all fiat currencies and funds; metals, units of account, XTS and XXX throw `Moneda no admitida.`), byte-identical for ARS and USD. |
| Selector metadata | `apps/mobile/src/ui/currencies.ts` | `catalogueCurrencies` and `searchCatalogue` for the future searchable screen; `currencyOptions` still lists exactly ARS and USD. |
| Generator | `apps/mobile/scripts/currency/generate.mjs`, `sources.lock.json` | Reproducible generation from pinned sources (§4). |

**Not changed in 24A:** SQLite (schema, migrations, rows), the backup format, the ledger's
validators (`validateAccount` still accepted only ARS and USD), every form, every screen,
the Assistant contract. No stored amount is reinterpreted. No exchange rate exists.

### 2.1 What Producto 24B1 delivers (stages 1 and 2 of §7.5)

| Layer | File | Change |
| --- | --- | --- |
| Gate and read acceptance | `packages/domain/currency.ts` | `LEDGER_CURRENCIES` gates **creation only** and takes an explicit `CurrencyGate` in tests; `isStorableCurrency`/`assertStorableCurrency` (an ISO fiat code with a minor unit, never the gate) is what stored rows, backups and views are checked against; `LegacyCurrency`/`isLegacyCurrency` name the two codes rows and backups written before 24B can carry; `sortCurrencies`/`currenciesPresent` give every grouping one order (ARS, USD, then by code). |
| Ledger | `ledger.ts` | `Currency` is now `IsoCurrencyCode`. `validateAccount` is read acceptance; `validateNewAccount(account, gate?)` adds the gate and is what `createAccount`, `createCreditCard` and `createPersonalDebt` call. `totalsByCurrency` keys every currency present. `accountIdsInCurrency` is the one scope every report and summary filters by. `createPilotBackup` refuses a non-ARS/USD ledger (`LEGACY_EXPORT_MESSAGE`). |
| Budgets | `budgets.ts` | `validateMonthlyBudget` is read acceptance; `validateNewMonthlyBudget(budget, gate?)` gates a new budget in `saveMonthlyBudget`. `summarizeMonthlyBudgets` refuses a non-storable code with "Moneda no admitida." and keeps "Período de presupuesto inválido." for the month. A budget may be in a currency no account holds (decision 7.6.3, allowed). |
| Liabilities | `liabilities.ts` | `liquidTotalsByCurrency` keys every currency a liquid account holds. `debtTotalsByCurrency` sums debts per currency in BigInt with an explicit `out-of-range` status. `validateCreditCardChange`/`validatePersonalDebtChange` are the pure "same internal account" guards storage now calls. |
| Recurring | `recurring.ts` | `validateRecurringRuleChange` (same currency when the account changes, one revision per save) replaces storage's inline check; `recurringForecastByCurrency` is the BigInt 30-day projection with a per-currency status the Recurrentes screen renders. |
| Reports | `spending-overview.ts`, `spending-report.ts`, `report-trend.ts`, `month-summary.ts` | `spendingWindow`, `spendingOverview`, `reportPeriod`, `expensesInPeriod` and `summarizeMonth` refuse a non-storable code with its own error instead of "Período inválido." or a silent `ready` 0; the private `safeSum` is gone (`sumMoney`/`addMoney`). Home wraps `spendingOverview` in `try`. |
| Backups | `recovery.ts` | v1–v8 are frozen to ARS/USD whatever the gate: a file naming another code is refused whole (`LEGACY_IMPORT_MESSAGE`), never read as cents; `createRecoveryBackup` refuses to write v8 for another currency (`LEGACY_EXPORT_MESSAGE`). The v8 bytes and `archiveKey` of an ARS/USD ledger are pinned. |
| Presentation | `src/ui/presentation.ts`, `app/backup-import.tsx`, `app/debts.tsx`, `app/recurring.tsx` | `availableCurrencies` and the import review list the currencies present; debts and recurring totals come from the domain helpers. |
| Assistant | `app/(tabs)/assistant.tsx`, `src/assistant/conversation.ts` | The client never sends a currency contract v1 does not know (a note instead of a request); a parked draft is typed `LegacyCurrency`. Contract v1, the server and the prompts are unchanged. |
| Copy | `errors.accounts.currency` → "Elegí una moneda disponible." / "Choose an available currency."; new `errors.accounts.legacyExport`, `errors.recovery.legacyImport`, `debts.list.outOfRange`, `recurring.list.outOfRange` (es, en, lock). | |
| Reproducibility | `scripts/currency/generate.mjs --verify`, `npm run currency:verify` | Offline integrity of the committed catalogue against the lock (§4); CI runs it and `npm run i18n:check`, which now requires a generated names module per catalogue language. `extract.mjs` exempts `src/i18n/currencies/` by directory and `GENERATED` header. |
| Tests | `packages/domain/multi-currency.test.ts`, `tests/currency-guards.node.ts`, `tests/currency-goldens.node.ts`, plus cases in `currency.test.ts`, `budgets.test.ts`, `spending-chart.node.ts`, `spending-home.node.ts`, `i18n.node.ts` | EUR/JPY/KWD fixtures through every grouping, report, budget, transfer and backup path; the pair-literal scan with its shrinking allow-list; ARS/USD goldens for the card face, the timeline, the day-net header, the MonthBars scale and Home's Disponible; the money scan bans `splitMinor`, `minorToMajorString`, `fmtNum`, `parseMoneyInput` and `Intl.DisplayNames` in screens. |

**Not changed in 24B1:** SQLite (schema 8, CHECKs, migrations, rows), backup v8, every
form and route parameter, the amount field (still exponent 2), the searchable screen,
contract v1 and the server, `currencyOptions` (still ARS and USD), the Más footer apart
from its release label. Production still stores and offers exactly ARS and USD: the SQLite
CHECKs and `LEDGER_CURRENCIES` are two independent nets. No stored amount is reinterpreted.
No exchange rate exists. `packages/domain/index.ts` no longer re-exports the web's float
helpers `fmtNum` and `parseMoneyInput` (they had no native consumer).

**Cost:** the catalogue and the es/en names add 62,074 bytes (1.3%) to the iOS Hermes
bundle (`expo export --platform ios`: 4,806,630 bytes at master 1181ed1, 4,868,704 with
24A). Everything is loaded from committed tables; nothing is read from the device's `Intl`.

### Availability status

| Status | Meaning | Today |
| --- | --- | --- |
| `ledger` | A **new** account, budget or recurring rule can hold it; forms offer it. Since 24B1 this is the creation gate only: a stored row in any fiat currency with a minor unit stays readable and groupable, and export refuses it explicitly, whatever the gate says (`isStorableCurrency`). | ARS, USD |
| `ready` | Fiat currency with complete data (ISO minor unit, CLDR names in every language the build carries, at least one territory where CLDR lists it as current legal tender). Presentation works; **not stored and not offered** until 24B. | 151 |
| `incomplete` | Fiat currency missing data (`missing` lists `name:<language>` or `tender`). Never offered until completed upstream or by a reviewed decision; a missing name falls back to the ISO code, never to another language. | VED (no Spanish name in CLDR 48.2, and CLDR marks it not tender), SVC (ISO-active, but El Salvador uses USD: no territory) |
| `excluded` | Not money a person spends: ISO funds (BOV, CHE, CHW, CLF, COU, MXV, USN, UYI, UYW, XAD), precious metals (XAG, XAU, XPD, XPT), units of account (XBA–XBD, XDR, XSU, XUA), the test code XTS and XXX. Never offered. | 23 |

Legal tender is read on the ISO list's publication date, so a scheduled change (a euro
adoption) counts from its date and the output never depends on the day it is generated.
Adding a currency to `LEDGER_CURRENCIES` is Producto 24B's decision, after storage records
each currency's scale; nothing in 24A offers a third currency. Rows written before 24B
carry no scale and are read as cents only for `LEGACY_CURRENCIES` (ARS, USD), whatever the
ledger set grows to.

## 3. Data: sources, versions and licences

| Source | Version pinned | What FinanzApp takes | Licence / terms |
| --- | --- | --- | --- |
| ISO 4217 List One, published by SIX Financial Information AG as the ISO 4217 maintenance agency ([list-one.xml](https://www.six-group.com/dam/download/financial-information/data-center/iso-currrency/lists/list-one.xml)) | Published 2026-09-17 | Alphabetic and numeric codes, minor units, the fund marker (facts only) | See §3.1 |
| Unicode CLDR, via [unicode-org/cldr-json](https://github.com/unicode-org/cldr-json) at tag `48.2.0` | CLDR 48.2.0 | `cldr-core/supplemental/currencyData.json` (display and cash digits, rounding, legal tender per territory), `cldr-numbers-full/main/{und,es,en}/currencies.json` (symbols, names), `cldr-localenames-full/main/{es,en}/territories.json` (territory names for search) | Unicode License v3 ([LICENSES/Unicode-3.0.txt](../LICENSES/Unicode-3.0.txt), copied verbatim from the pinned tag); the notice must accompany redistributed data, which the generated files reference in their headers |

`apps/mobile/scripts/currency/sources.lock.json` records the URL, sha256, size and
retrieval date of every source file the committed data was generated from.

### 3.1 ISO 4217 terms

SIX describes itself as the official ISO 4217 maintenance agency, acting for ISO and the
Swiss member body SNV, and says it makes the code lists "available online and free of
charge". No licence specific to the lists was found; SIX's general website terms of use
restrict reproducing its content ("presentations, brochures, … texts, designs, charts")
and commercial reuse ([terms of use](https://www.six-group.com/en/services/legal/terms-and-conditions/terms-of-use.html),
[data standards page](https://www.six-group.com/en/products-services/financial-information/market-reference-data/data-standards.html);
iso.org refused automated access). FinanzApp therefore commits **only facts**: the
alphabetic code, numeric code, minor unit and fund marker of each currency, never the
XML, the country list or ISO's entity names. The downloaded sources stay in the
git-ignored cache (`apps/mobile/i18n/work/currency-sources/`) and are identified by
sha256 in the lock. This is a practical reading, not legal advice; the owner may ask SIX
before a commercial release.

### 3.2 Why ISO minor units store, and CLDR digits only format

ISO 4217's minor unit is the normative scale of a currency; CLDR's `digits` is a
formatting recommendation and differs for 16 fiat currencies (CLDR 48.2): IQD (ISO 3,
CLDR 0) and AFN, ALL, COP, HUF, IDR, IRR, KPW, LAK, LBP, MGA, MMK, PKR, SOS, SYP, YER
(ISO 2, CLDR 0). FinanzApp stores with ISO's exponent (never fewer digits than a bank may
report) and shows CLDR's: trailing zeros are dropped down to CLDR's digits, but a recorded
fraction is always shown (in Argentine separators, `IQD 1.500` for 1,500,000 minor units,
`IQD 1.500,5` for 1,500,500). CLDR's cash rounding (CHF 0.05, DKK 0.50, CAD 0.05, HUF 5) is for cash
presentation and never touches the ledger. Exponents today: 0 for 16 fiat currencies
(BIF, CLP, DJF, GNF, ISK, JPY, KMF, KRW, PYG, RWF, UGX, VND, VUV, XAF, XOF, XPF), 3 for
seven (BHD, IQD, JOD, KWD, LYD, OMR, TND), 2 for the rest; 4 only for two funds (CLF, UYW).

**Exponents are frozen once a currency is storable.** `packages/domain/currency.test.ts`
pins every fiat exponent and the fiat code set; a data update that changes an exponent or
withdraws a code fails and needs a reviewed migration decision, never a silent rescale
(`storedExponent` refuses a disagreement). The
generator refuses to run if ARS or USD stop being "ready, minor unit 2".

### 3.3 Research notes (2026-09-24)

- **CLDR release.** npm `cldr-core`/`cldr-numbers-full` "latest" is 48.2.0; the newest
  cldr-json tag is 48.2.2 (2026-09-21), a time-zone-only patch: `currencyData.json` and the
  `und`, `es`, `en` currency files are byte-identical between the two, so the pin stays at
  48.2.0 until a release changes currency data.
- **Symbols.** CLDR's root (`und`) symbols name one fiat currency each (22 explicit ones,
  the code otherwise); narrow symbols collide ("$" is shared by 29 currencies, "¥" by JPY
  and CNY, "kr" by four, "£" by six), which is why they never identify a currency alone.
- **Edge cases.** VED (digital bolívar) is ISO-active but CLDR marks it not tender and has
  no Spanish name; SVC (Salvadoran colón) is ISO-active but no territory uses it (El
  Salvador uses USD). Both are `incomplete`, never offered by default. CLDR also knows
  CNH (offshore yuan), which is not in ISO 4217 and therefore not in the catalogue.
- **Recent ISO changes** (list three and amendments 176–180): BGN → EUR (2026-01-01),
  ANG → XCG (2025), ZWL → ZWG (2024), SLL → SLE (2023), HRK → EUR (2023), CUC withdrawn
  (2021), and XAD added (2025, a fund). A redenomination is a new code, never a new scale
  for an old one.
- **Hermes on iOS (React Native 0.86, `hermes-v250829098.0.17`).** `Intl` defines only
  `getCanonicalLocales`, `Collator`, `DateTimeFormat` and `NumberFormat` (no `DisplayNames`,
  `PluralRules`, `Locale` or `supportedValuesOf`); `NumberFormat` wraps `NSNumberFormatter`,
  takes a double, has no `formatToParts` or narrow symbol on Apple platforms, and its default
  currency digits come from a hand-maintained ISO table that disagrees with CLDR. The device
  cannot be the source of currency metadata, so FinanzApp commits tables and formats integers
  itself; Node tests with full ICU do not predict device `Intl` output, which is another reason
  not to use it.

## 4. Updating the data

Two different operations, never confused:

| Operation | Command | Needs | Proves |
| --- | --- | --- | --- |
| **Regenerate** (refresh from upstream) | `npm run currency:generate -- --download`, then review the diff | network, the pinned URLs | the committed data is what the sources at these URLs say today |
| **Regenerate from the cache** | `npm run currency:generate` (or `-- --check` to compare without writing) | the git-ignored source cache whose sha256 match the lock | the committed data is exactly what the generator writes from the locked bytes |
| **Verify integrity, offline** | `npm run currency:verify` | nothing but the checkout | nobody edited a generated file by hand and the lock is consistent (each output's sha256, its `GENERATED` header, the CLDR tag and the source list); CI runs this on every push, with no cache and no network |

`--verify` never says whether upstream changed; only `--download` does. `--check` is the
release-checklist step (docs/mobile-roadmap.md); `--verify` is the CI step.
`tests/currency-catalogue.node.ts` runs `--check` when the cache exists and the hash check
always; `tests/currency-guards.node.ts` proves `--verify` catches a hand edit, a missing
header, a stale lock and a wrong CLDR tag.

1. `cd apps/mobile && npm run currency:generate -- --download` fetches the pinned URLs into
   the ignored cache and rewrites `sources.lock.json` (sha256, size; the retrieval date
   changes only for bytes that changed).
2. The generator writes `packages/domain/currency-data.ts` and one names module per
   language in `LANGUAGES`. It stops when: an ISO code with minor unit "N.A." has no kind
   (classify it in `NON_NUMERIC_KINDS`), a code is inconsistent across countries, a minor
   unit is outside 0–4, two fiat currencies would share a language-neutral symbol, or ARS
   or USD would stop being `ready` with minor unit 2.
3. Review the diff: new or withdrawn codes, any exponent change (the exponent test fails:
   decide with a migration plan), any status change (`incomplete` ↔ `ready`), symbol and
   name changes for ARS and USD (the presentation tests fail: they are visible strings).
4. To move to a new CLDR release, change `CLDR_TAG` in the generator, run step 1, and
   check the licence text at the new tag (`LICENSES/Unicode-3.0.txt`).
5. `npm run currency:generate -- --check` proves the committed files are exactly what the
   cached sources produce (`tests/currency-catalogue.node.ts` runs it when the cache exists).
   Without the cache (CI), the same test checks the sha256 of every generated file against
   the `outputs` the generator recorded in the lock, so a hand edit fails, plus the data's
   invariants, the provenance and the generator's refusals on synthetic sources.
6. A new language: add it to `LANGUAGES`, regenerate (its `currencies-<lang>.json` and
   `territories-<lang>.json` are fetched), add the module to `src/i18n/currencies/index.ts`.
   Its missing names mark currencies `incomplete`; they are never filled with another
   language. `npm run i18n:check` fails until the generated module exists (a catalogue
   language without `src/i18n/currencies/<lang>.ts`, or a hand-written file there), and
   `npm run i18n:extract` exempts that directory by its `GENERATED` header, so no
   allow-list entry is needed.

## 5. The amount model and its limits

- **No floating point for money.** Text is read digit by digit; scaling uses BigInt; digits
  are written back from the integer (`splitMinor`). Percentages and chart geometry may use
  floats because they are display ratios computed from integers.
- **Representation.** A stored amount is a JavaScript safe integer: `|n| ≤ 2^53 − 1 =
  9,007,199,254,740,991` minor units. SQLite's `INTEGER` holds 64-bit values, but expo-sqlite
  returns JavaScript numbers, and backups are JSON numbers; both are exact only within the
  safe range, so nothing outside it may ever be written (validators refuse it; sums
  accumulate in BigInt and refuse an unsafe result). BigInt or decimal strings in storage
  were rejected: JSON has no BigInt, the SQLite bridge returns numbers, and every existing
  row and backup already uses safe integers.

| Exponent | Largest stored amount (safe integer) | Largest typed or converted amount |
| --- | --- | --- |
| 0 (JPY, CLP, KRW) | 9,007,199,254,740,991 units | 999,999,999,999,999 (15 digits) |
| 2 (ARS, USD, EUR) | 90,071,992,547,409.91 | 9,999,999,999,999.99 (13 whole digits, the amount field since 23.1C1) |
| 3 (KWD, BHD, IQD) | 9,007,199,254,740.991 | 999,999,999,999.999 (12 whole digits) |
| 4 (CLF, UYW funds) | 900,719,925,474.0991 | 99,999,999,999.9999 (11 whole digits) |

- **Entry bound: 15 significant digits in minor units** (`MAX_ENTRY_MINOR = 10^15 − 1`,
  `maxWholeDigits = 15 − exponent`). The same number of minor units in every currency, it
  reproduces the 13-digit limit ARS and USD already have and leaves a factor of nine below
  the safe limit for balances, budgets and report sums. Currencies with large nominal
  values reach it with fewer "real" units; 10^13 units of a two-decimal currency is still
  far beyond a personal ledger.
- **Never rounded.** More decimals than the currency has are refused (`precision`) unless
  they are zeros; `12,5` yen is an error, not 13 yen.
- **Separators are explicit.** `parseLocalizedAmount` takes the region's separators and
  never guesses: `1.234` is a thousand in Argentina and 1.234 KWD (one dinar, 234 fils) in
  the United States. For ARS and USD it agrees with the ledger's `parseMinorUnits`
  wherever both read Argentine separators (a test sweeps the combinations). Text whose
  convention is unknown, such as a paste, is not its job: the amount field's
  `readPastedAmount` refuses the ambiguous shapes ("1,000" in Argentina) instead.
- **One currency per operation.** `addMoney`, `subtractMoney`, `sumMoney` and
  `compareMoney` throw on two currencies. There is no conversion function in 24A.

## 6. Presentation policy

- **Digits:** the currency's exponent, trailing zeros trimmed down to CLDR's display digits
  (never hiding a stored fraction).
- **Symbol:** a bare `$` only for the peso in Argentina; the peso is `AR$` elsewhere
  (FinanzApp's convention: CLDR has no language-neutral peso symbol); every other currency
  uses CLDR's language-neutral (root) symbol, which the generator proves names one fiat
  currency only (`US$`, `CA$`, `MX$`, `€`, `£`, `JP¥`, `CN¥`, `R$`, `₹`, `₩`, `₪`, `₫`, `₱`,
  `FCFA`, `F CFA`, `CFPF`, `EC$`, `NT$`, `HK$`, `NZ$`, `A$`, `Cg.`) or the ISO code (`KWD`,
  `CLP`, `CHF`). The dollar is `US$` in both regions, as before. Narrow symbols (`$`, `¥`,
  `kr`) are ambiguous and are kept only for a future region whose own currency uses one.
- **Names:** CLDR's plural name in the interface language with a capital first letter
  ("Pesos argentinos", "US dollars", "Yenes japoneses"); the ISO code when the language has
  no name.
- **VoiceOver:** the currency's digits with the language's decimal mark and no grouping
  (unchanged rule), then the unit: "pesos", "dólares"/"dollars" for ARS and USD (kept word
  for word), CLDR's plural name otherwise, the singular only for exactly one unit of a
  currency without decimals ("1 yen japonés"). In 24B, when a ledger holds two currencies
  whose spoken unit is the same word (USD and CAD would both be "dólares" if shortened),
  the full CLDR name must be used.
- **Proof:** `tests/currency-presentation.node.ts` keeps the pre-24A implementations
  verbatim and compares every ARS/USD output over more than 3 000 amounts in the four
  locales.

## 7. Audit and the Producto 24B migration plan

24A audited every place where the app assumes exactly two currencies or exactly two decimals, before changing any of them. This section lists those places and gives the order in which 24B removes the assumptions without reinterpreting a stored amount.

### 7.1 Scope and method

Ten auditors each covered one subsystem (read-only, 2026-09-24). A completeness critic then re-read what they had skipped. Line numbers are those of master `1181ed1`, checked with `grep -n`. Files that 24A changes (`format.ts`, `bind.ts`, `currencies.ts`, `errors.ts`, `messages.ts`, `settings.tsx`, `translations.lock.json`, `extract-allow.json`, docs/i18n.md) are cited by symbol, key or section. 24A also touches `packages/domain/index.ts` and `voiceover.node.ts`, but the `index.ts:3`–`:4` and `voiceover.node.ts:63` citations still hold: 24A added its exports after line 5 and edited `VISIBLE` in place. Files new in 24A are cited by test name. Behaviour was confirmed with Node probes on the real modules, never by editing them. For example, `totalsByCurrency` for ARS 5 + JPY 700 returns `{ ARS: 5 }`, and rebuilding `accounts` in `node:sqlite` with foreign keys on fails at `DROP TABLE`.

| Subsystem | Scope | Findings | High | Medium | Low |
| --- | --- | --- | --- | --- | --- |
| Domain ledger | `ledger.ts`, `transfers.ts`, `recovery.ts`, `account-changes.ts`, `month-summary.ts`, `index.ts` | 25 | 9 | 10 | 6 |
| Domain commitments | `budgets.ts`, `recurring.ts`, `liabilities.ts`, `categories.ts`, `appearance.ts` | 17 | 3 | 5 | 9 |
| Domain reports | `spending-report.ts`, `spending-overview.ts`, `report-insights.ts`, `report-trend.ts` | 18 | 1 | 3 | 14 |
| Storage | SQLite v1–v8, CHECKs, transaction helper, provider, backup v1–v8, restore routes | 22 | 7 | 9 | 6 |
| Forms and input | `AmountField`/`AmountInput`, the currency field, every form | 55 | 29 | 15 | 11 |
| Presentation | `src/ui` presentation, rows, charts, card visual, components | 38 | 6 | 12 | 20 |
| Routes | every screen under `apps/mobile/app` | 45 | 13 | 22 | 10 |
| i18n, Assistant, server | `src/i18n`, catalogues and scripts, `src/assistant`, `src/integrations`, `packages/integrations`, `server/mobile` | 42 | 11 | 18 | 13 |
| Legacy boundary | `src/domain/currency.js`, `money.js`, their re-export, currency statements in the docs | 33 | 0 | 9 | 24 |
| Tests and guards | `apps/mobile/tests`, `packages/domain/*.test.ts`, the scanners | 44 | 15 | 22 | 7 |
| Critic (additional) | areas no auditor read | 12 | 0 | 5 | 7 |
| **Total** | | **351** | **94** | **130** | **127** |

By category: `two-decimals` 54, `currency-enum` 48, `contract` 43, `other` 38, `spoken` 28, `safe-integer` 25, `symbol-or-name` 24, `ui-currency-toggle` 20, `amount-input` 18, `cross-currency-aggregation` 17, `float` 16, `backup-format` 11, `storage-constraint` 9.

A finding records one site, the assumption, its effect once a third currency or another exponent exists, and the 24B step. The risk level is the auditor's rating of that effect. One site can appear in several subsystems (`components.tsx:282` does), so the counts are findings, not distinct sites.

The critic added seven missed areas:
- the Assistant's answer and draft rendering
- the region sample
- the senders of `maxAmountMinor`
- the per-currency keys in the translation lock
- the server's contract tests
- the 24A sources
- the explain prompt

The critic also corrected seven citations, and this section uses the corrected sites:
- the `reports.node.ts` pins are at `:16`, `:29`, `:30`, `:51`
- `openai.js:19` holds no "$" rule; the exponent assumptions are at `:20` and `:24`
- `moneyUnit` is written at `recovery.ts:230` and checked at `:259`
- the segmented control's condition lives in its consumers, e.g. `(tabs)/index.tsx:72`
- the unchecked subtotal is `spending-report.ts:45`

**What the audit established.**
- Arithmetic is already exponent-agnostic. Balances, budgets and liabilities sum in BigInt within one currency. No native code adds two currencies: every aggregation filters by the exact code. No native code uses floating point on stored money, except display ratios, chart geometry, the MonthBars scale caption (`charts.tsx:138`, `Math.round(max / 100)`) and a floor average verified exact against BigInt.
- Two decimals are assumed at the text boundary: parsing, prefill, shortcut fills, route parameters, digit limits, spoken numbers, error copy and the Assistant's prompt.
- Two currencies are assumed by:
  - thirteen runtime lists, plus three two-segment option lists in the card, debt and budget forms
  - three route parameters coerced to ARS
  - a handful of binary ternaries
  - two live SQLite CHECKs
  - the backup's single money unit
  - the Assistant contract v1
- The dangerous failures are silent:
  - a third currency's totals vanish, and Home reads the gap as 0
  - an else-branch ternary keeps compiling when the type widens
  - an unknown code becomes ARS or the first held currency

  The loud failures (validators, CHECKs) are today's safety net, and they open last.

### 7.2 What 24A already resolved

- **Data and generator.** `currency-data.ts` holds 178 codes: 153 `ready`, 2 `incomplete`, 23 `excluded`. `currencyStatus` reports ARS and USD as `ledger`, which leaves 151 `ready`. 24A also added the names modules, `generate.mjs`, `sources.lock.json` and the Unicode licence. `currency.test.ts` pins every fiat exponent and the fiat code set itself: a changed exponent or a withdrawn code fails the tests. `currency-catalogue.node.ts` covers the invariants and the generator's refusals. CI checks the generated files against the output hashes in `sources.lock.json`, so hand edits fail. CI cannot regenerate them, because `--check` needs the git-ignored source cache.
- **Catalogue and amount model.** Presentation uses `currencyRecord`, `minorUnitExponent`, `displayDigits` and `splitMinor`. Outside its module, only `currencyOptions` reads `LEDGER_CURRENCIES`. The storage and input parts have no runtime caller yet:
  - `isLedgerCurrency`
  - `storedExponent`, 24B's read contract: no scale means ARS/USD cents, and a disagreeing scale is refused
  - in `money.ts`: `parseLocalizedAmount`, `majorStringToMinor`, `maxWholeDigits`, `MAX_ENTRY_MINOR` and the BigInt `sumMoney`/`addMoney`/`compareMoney`
- **Presentation, catalogue-driven** (`format.ts`):
  - `currencySymbol` was "US$, else the peso"
  - `currencyName` was a two-way ternary
  - `spokenMoney` said "pesos" for every non-USD code; it now uses `SPOKEN_UNITS` for ARS/USD and CLDR plurals for the rest
  - `moneyText`, `codedAmount` and `spokenAmount` now go through the new `formatMoneyAmount` and `spokenMinor`

  `bind.ts` types these functions with `IsoCurrencyCode` and binds `formatMoneyAmount` (not `spokenMinor`). Call sites that already pass a currency are right for any currency, for display only. They are the 29 `<Money>` sites, the 12 `moneyText`/`spokenMoney`/`codedAmount`/`spokenAmount` calls in routes, and the rows and charts built on them (e.g. `accounts.tsx:31`, `entry/[id].tsx:104`, `account/[id].tsx:61`, `report-comparison.tsx:21`, `charts.tsx:154`, `cards.tsx:86`). `tests/currency-presentation.node.ts` proves that ARS/USD output is unchanged.
- **Copy and guards.** `errors.money` catalogues the four new sentences that `currency.ts` and `money.ts` throw; none reaches a screen. `extract-allow.json` exempts the two generated name files. The VoiceOver scan counts `formatMoneyAmount` as visible.
- **Intentionally unchanged.**
  - `Currency` is still `'ARS' | 'USD'`.
  - `formatAmount` and `spokenNumber` stay exponent-2 and currency-less (21 call-site lines), and `amountFormat` stays currency-less.
  - `currencyOptions` lists ARS and USD.
  - Every validator, list and ternary outside `format.ts`.
  - SQLite schema 8 and backup v8.
  - `money-input.ts`, every form and the route parameters.
  - The per-currency message keys.
  - Contract v1 and the server prompts.
  - The `fmtNum`/`parseMoneyInput` re-export.
  - docs/i18n.md §9 ("more, with dated rates, is Producto 24").

  No stored amount is read differently.

### 7.3 Findings by subsystem

Sites are `file:line` at `1181ed1`, shortened to the file name. Domain files are in `packages/domain/`. `database.ts` and `transaction.ts` are in `apps/mobile/src/storage/`. Forms and rows are in `apps/mobile/src/ui/`, and screens are in `apps/mobile/app/`.

| Subsystem | What assumes two currencies / two decimals | Key sites | 24B change |
| --- | --- | --- | --- |
| Domain ledger | `Currency` is a closed pair with no scale (33 files import it). The account gate also runs on every load, restore and `createPilotBackup`. Totals loop over the pair, so a third currency's total disappears and its overflow check is skipped. `parseMinorUnits`/`formatMinorUnits` fix exponent 2 and guess the decimal separator. Errors say "hasta dos decimales". Same-currency transfers and an immutable account currency are correct invariants. | `ledger.ts:3`, `:95`, `:150`, `:44`–`:72`, `:124`, `:159`; `transfers.ts:30` (untested); `account-changes.ts:16`; `recovery.ts:221` (tested only at `database.node.ts:212`) | Widen `Currency` to `IsoCurrencyCode`. Keep `LegacyCurrency = 'ARS' \| 'USD'` for v1–v8 and contract v1. Split `validateAccount`: read acceptance for stored rows, `isLedgerCurrency` only for creation. Totals go over the currencies present (ARS, USD, then by code). Forms parse with `money.ts`, while the two legacy functions stay frozen for ARS/USD. Messages become exponent-neutral. Add tests for both guards. |
| Budgets | A runtime gate that also runs on load and restore (one budget in a new code rejects the whole archive). The summary blames the month for a currency problem. Copy states two decimals. A budget has a currency but no account, so its scale can only come from its code. | `budgets.ts:102`, `:153`, `:105`, `:18`; `database.ts:179`, `:287`, `:687`; `budget-form.tsx:27` (param forced to ARS), `:48`, `:120`; `budgets.tsx:29`, `:57` | The gate applies to creation only; stored budgets and the summary are never checked against it (stage 2). A currency error separate from "Período de presupuesto inválido.". Scale pinned per code. Validated param. Currency chosen before the amount. Decision 7.6.3 on budgets without an account. BigInt sums and `budgetIdentityKey` unchanged. |
| Recurring rules | The amount is copied verbatim into every generated entry, in the account's exponent. "Same currency when the account changes" exists only in SQLite code. The form parses at exponent 2, keeps the draft on an account change and falls back to ARS. The list speaks two decimals. The 30-day projection sums `Number` unguarded. | `recurring.ts:117`; `database.ts:609`; `recurring-form.tsx:25`, `:59`, `:77`, `:113`; `recurring.tsx:108`, `:143` | A pure `validateRecurringRuleChange` used by storage and restore. An exponent-aware form with re-validation. `spokenMinor`. The projection moves to a BigInt domain helper with a per-currency status. Never rescale `amountMinor`. |
| Liabilities (cards, debts) | `liquidTotalsByCurrency` copies only ARS/USD, so Home shows a dropped currency's Disponible as `?? 0`. A card or debt has its hidden account's single currency, and its limit is in that exponent. Forms parse at exponent 2 and switch currency with a two-segment toggle that keeps typed drafts (placed after the amount, for debts). The card's VoiceOver says pesos for any non-USD code. "Pay total"/"settle" pass minor units that the receiver reads as hundredths. Debt totals sum `Number` unguarded. | `liabilities.ts:158`, `:149`, `:13`; `card-form.tsx:29`, `:31`, `:55`, `:80`, `:131`; `debt-form.tsx:27`, `:72`, `:132`; `card-visual.tsx:37`; `card/[id].tsx:68`, `debt/[id].tsx:35` → `new-transfer.tsx:11`, `:15` → `transfer-form.tsx:76`; `debts.tsx:24` | Every present currency, in order. A pure guard that a profile's `accountId` never changes. The currency field comes before the amount, and drafts are re-validated. Labels come from the catalogue, with the ARS/USD keys' words. The receiver reads `maxAmountMinor` (≤ 15 digits) with the target's exponent. BigInt totals. One currency per card stays; a foreign purchase with a rate is 24C. |
| Categories | Nothing about currency, amounts or exponents. Only language/region couplings: category identity and collation are pinned to `es-AR`, the "foreign" account icon is relative to Argentina, and two `localeCompare` calls have no locale. | `spending-report.ts:7`; `budgets.ts:190`; `appearance.ts:57`; `report-insights.ts:59`, `report-trend.ts:54` | None required. Never derive a collation, the icon or `categoryKey` from a currency. Optionally pin the two `localeCompare` calls. |
| Reports | One runtime list: `spendingOverview` throws "Período inválido." for any other code, and Home calls it without `try`, which crashes the render. Every other report skips validation and returns `ready` with 0 for an unknown code. Rows carry `amountMinor` without a currency. The insight formatter receives minor units only. Overflow is a status in some functions and a throw in others. Per-code filtering is correct. | `spending-overview.ts:22`, `:32`; `spending-report.ts:10`, `:13`, `:27`, `:45`; `report-insights.ts:11`; `report-trend.ts:6`, `:65`, `:79`; `(tabs)/index.tsx:33`; `(tabs)/reports.tsx:39` | One gate-independent assertion (a canonical code with a minor unit, with its own error) in `reportPeriod`/`spendingWindow`, reused by `spendingOverview`. One shared `accountsInCurrency`. `sumMoney` replaces the private `safeSum` (both in stage 2). Callers format with the report currency and catch the throwing functions. Row shapes unchanged. |
| Storage (SQLite) | Live CHECKs accept only the pair on `accounts` (STRICT, parent of eight `ON DELETE RESTRICT` references) and on `monthly_budgets`. SQLite cannot alter a CHECK, and every migration runs with foreign keys forced on, so rebuilding `accounts` fails. No row records a scale. `readArchive` spreads `SELECT *` into strict-key objects. Reads re-validate every row against the pair, so one foreign row makes the ledger unopenable. The overflow guard covers only the pair. | `database.ts:33`, `:179` (live), `:119` (V5, replayed, stays), `:26` (file name), `:27`, `:253`, `:255`, `:355`, `:488`, `:517` (receipts), `:609`; `transaction.ts:17` | Schema 9 through a foreign-keys-off rebuild helper checked by `foreign_key_check`. A shape-only currency CHECK. An additive, append-only `currency_units` table (one scale per code). Explicit column lists first. Read acceptance is ARS/USD or a pinned code, independent of the gate. The overflow guard covers the codes present. MIGRATE_V1–V8 and the file name unchanged. |
| Backup format (v1–v8) | One `moneyUnit` per file and no scale: unambiguous only because both codes are cents. Exact key sets: an extra key makes `archiveKey` and export throw while `validateArchive` passes. Account identity would ignore a scale. Only v1–v8 are accepted, in a catalogued sentence. The import preview and archive overflow cover only the pair. Export round-trips through the ARS/USD parser, which fails safely. | `recovery.ts:37`, `:43`, `:52`–`:58`, `:165`, `:168`, `:230`, `:250`–`:251`, `:259`, `:405`; `ledger.ts:159`; `backup.tsx:30`; `backup-import.tsx:105`, `:111`; keys `errors.recovery.version`, `backup.import.formats` | Backup v9 = v8 plus a top-level `currencyUnits` list. Key lists and `moneyUnit` unchanged. Export stays byte-identical v8 while every code is ARS/USD. v1–v8 parsing is frozen to ARS/USD at exponent 2 whatever the gate (from stage 2). v9 import uses read acceptance, so a reverted gate still restores. A scale mismatch is a conflict. The v9 probe (`recovery.test.ts:103`) moves to v10. |
| Forms and the amount field | `MAX_DECIMALS = 2` and `MAX_WHOLE_DIGITS = 13` (13 + 3 digits exceeds 2^53). Drafts are in ledger notation and read by `parseMinorUnits`, whose grouping guess stores a KWD "12,345" as 1 234 500. `draftFromMinor`/`amountFromMinor` assume hundredths in every edit prefill and shortcut fill. Paste knows only ARS/USD markers and reads "1.234" as a thousand. Settle pads to two. `AmountField` ignores a `currency` change, so a draft typed for one currency survives the switch. Parameters coerce anything but USD to ARS. The Assistant hands over a two-decimal draft string. | `money-input.ts:29`, `:30`, `:37`, `:167`, `:185`, `:207`, `:361`, `:393`, `:417`, `:441`; `components.tsx:233`, `:279`; parse sites `entry-form.tsx:93`, `:107`, `transfer-form.tsx:86`, `card-form.tsx:55`, `:80`, `debt-form.tsx:72`, `budget-form.tsx:48`, `recurring-form.tsx:59`, `:77`, `new-account.tsx:43`, `edit-account/[id].tsx:61`; prefill `entry-form.tsx:42` (edit and Assistant), `transfer-form.tsx:48`, `card-form.tsx:31`, `budget-form.tsx:28`, `recurring-form.tsx:25`, `edit-account/[id].tsx:39`; shortcut fill `transfer-form.tsx:183`; kept drafts `entry-form.tsx:147`, `transfer-form.tsx:187`, `new-account.tsx:69`; params `new-account.tsx:26`, `(tabs)/assistant.tsx:118` → `new-entry.tsx:10` | Helpers take the currency and build on `money.ts`: `parseLocalizedAmount` with the ledger separators, never the guess. Per-currency digits and keyboard. Catalogue paste markers. A single separator before three digits is ambiguous at exponent ≥ 3. On a currency change the draft is re-validated, a notice shows and Save is blocked; the draft is never truncated or rescaled. Validated parameters. The Assistant hand-off carries `amountMinor` plus the currency. Exponent 2 stays byte-identical. |
| Presentation and routes | `availableCurrencies` filters the pair, so an account in another currency vanishes from Cuentas, Home, Budgets, Reports and the Assistant. Home's `?? 0` is true today (no liquid account holds the currency) but hides a dropped third currency. Segment labels call any non-ARS code "Dólares · USD", and the card and the amount field name any other currency pesos or dollars. Segmented controls fit two codes. The MonthBars scale divides by 100. 21 call-site lines use the currency-less `formatAmount`/`spokenNumber`. Two drill-downs whitelist the pair, and two silently fall back to the first held currency (ARS when there is none). `Money` and `useStacked` throw on an unsafe integer during render. The read-only currency row falls back to ARS. | `presentation.ts:77`; `accounts.tsx:21`; `(tabs)/index.tsx:30`, `:37`, `:72`; `(tabs)/reports.tsx:86`; `budgets.tsx:57`; `card-visual.tsx:37`; `components.tsx:46` (`useStacked`), `:282`, `:448` (`Money`); `charts.tsx:138`; `spending-timeline.tsx:35`, `:38`; `spending-chart.tsx:42`, `:70`; `liability-rows.tsx:27`; `home-modules.tsx:119`; `transfer-form.tsx:133`–`:205`; `entry-form.tsx:90`; `edit-account/[id].tsx:73`, `:89`; `entry/[id].tsx:61`, `:102`; `transfer/[id].tsx:58`; `recurring.tsx:108`; `report-day.tsx:19`; `spending-detail.tsx:21`; `report-category.tsx:21`; `report-comparison.tsx:18` via `report-presentation.ts:9`; `locale-options.ts:25` (region sample) | Currencies present, ARS and USD first, then by code. 0 only for a currency no liquid account holds; unknown only when out of range. Lookups keyed by code, with the legacy words for ARS/USD. A picker beyond two currencies. Whole units from `splitMinor`. `formatMoneyAmount`/`spokenMinor` everywhere, then the currency-less pair is unbound and banned in screens. One route-currency parser plus a strict drill-down variant. "—" for an unsafe value. A display lookup over the whole catalogue. |
| i18n | One message key per currency, pinned in the lock and in the `same` whitelist. Copy that says pesos or dollars, or two decimals. `formatAmount` and `spokenNumber` stay exponent-2, and `amountFormat` stays currency-less. `spokenMinor` is unbound. `dollarSignCurrency` is typed to the pair. The glossary lacks the engine's terms. Generated name files are exempted one path at a time. Their per-language presence is checked by the type of `CURRENCY_NAMES` and by `currency-catalogue.node.ts`, but not by `npm run i18n:check`. | keys `budgets.currency.*`, `reports.currencyARS`/`currencyUSD`, `cards.form.*`, `debts.form.*`, `cards.face.pesos`/`dollars`, `amount.inPesos`/`inDollars`, `amount.paste.precision`, `selection.currencyNote`, `transferForm.missingDetail`, `errors.domain.twoDecimals`/`positiveAmount`/`transferAmount`, `errors.budgets.amount`, `errors.accounts.currency`; `format.ts` `formatAmount`, `spokenNumber`, `amountFormat`; `locale.ts:47`; `glossary.json:3`; `scripts/i18n/extract.mjs:17`, `lib.mjs:10`; `translation.node.ts:73`–`:75`, `:130`–`:140`; docs/i18n.md §9 | One `{name} · {code}` template with name parameters, keeping the ARS/USD words (same output). `{digits}` and no-decimal variants beside the exact exponent-2 sentences. Currency-neutral notes. `spokenMinor` bound; the currency-less pair unbound but kept in `format.ts` as the pinned exponent-2 path. `amountFormat(currency)` (stage 3). Glossary terms. A directory or `GENERATED`-header exemption (stage 1). §9 rewritten. es, en, the lock and the verbatim test change in the same commit. |
| Assistant, integrations, server | Contract v1 accepts only the pair, with a strict key set (a new field needs a new version). The model schema's enum lists the pair. The parse prompt says amounts are centavos ("15 mil ARS son 1500000 centavos"), and the explain prompt says the facts are. A draft reaches a confirmable card with no exponent check. A parked draft without currency becomes ARS. The types are a second hand-written pair. Staging payloads carry no contract version, and the SQL test stores unversioned ones. One currency per answer is correct. | `packages/integrations/contracts.js:18`, `:22`, `:37`; `contracts.d.ts:3`; `server/mobile/openai.js:6`, `:20`, `:24`; `handlers.test.js:8`–`:10`, `:39`; `schema.sql:9`; `schema.test.sql:19`–`:36`; `conversation.ts:222`, `:245`; `assistant-messages.tsx:149`, `:201`; `evidence.ts:25`; `(tabs)/assistant.tsx:54`, `:71` | Server first. A new version reconciled with docs/i18n.md §11 (stage 7). The server validates a generated superset, not the client gate. Draft amounts become canonical major-unit strings that the client converts and checks. Facts carry an explicit scale that the prompts state instead of "centavos". v1 is frozen (EUR still refused). The staging payload records its version; that change is a reviewed staging migration only, never applied remotely without a release decision. No ARS default. Stubbed server tests, no paid call. |
| Legacy web boundary | `src/domain/money.js` reads and writes float major units with two decimals and Argentine separators (`parseMoneyInput('1.234')` is 1234, a ×1000 error for KWD). `currency.js` turns unknown codes into ARS and passes a value through unconverted when no rate exists. **Native code does not use them.** `packages/domain/index.ts:3` re-exports `fmtNum` and `parseMoneyInput` with zero consumers in `apps/mobile` or `packages` (they still reach the bundle). Native code imports only the date helpers (`index.ts:4`). | `src/domain/money.js:8`, `:48`, `:64`, `:68`; `src/domain/currency.js:2`, `:13`, `:27`; `packages/domain/index.ts:3`, `:4`; `i18n.node.ts:561` (scan does not ban them) | Remove the two re-exports (the web imports `src/domain` directly) and ban the names in the scanner. Never reuse `convertCurrency` or `normalizeCurrency`; 24C has its own rate module. `src/domain` and its goldens stay untouched. |
| Tests and guards | Goldens pin ARS/USD strings, the pair in pickers, backup v8, `user_version` 8 and exact Account, budget and draft shapes. 20 harnessed tests use strict module maps (5 mock `@finanzapp/domain` partially). The VoiceOver scan knows visible formatters by name. Besides `formatMinorUnits` and device number formatters, the money scan bans only three hand-written signs (`$`, `US$`, `AR$`). `src/storage` may not mention `i18n/`. Some probes use EUR to mean "unsupported". | `translation.node.ts:44`; `voiceover.node.ts:63`; `i18n.node.ts:305`, `:561`–`:564`; `ui-rows.node.ts:41`, `:50`, `:283`–`:296`; `typography.node.ts:170`; `money-input.node.ts:448`; `database.node.ts:64`, `:150`, `:1198`; `recovery.test.ts:103`; `budgets.test.ts:69`; `spending-home.node.ts:164`; `personalization-routes.node.ts:125` | Keep every ARS/USD golden. Flip the version and EUR probes on purpose (to v10, and to a code that stays unsupported). Import new helpers through `../i18n/format` or update every mock. New visible formatters join `VISIBLE`. The scans ban catalogue symbols, `minorToMajorString`, `splitMinor` and `Intl.DisplayNames`. Storage validates with `@finanzapp/domain` only. |

### 7.4 Risks, ranked

| # | Risk | How it happens | Mitigation |
| --- | --- | --- | --- |
| 1 | A wrong exponent stores, prefills or proposes 100× (JPY) or 10×–1000× (KWD, IQD) the amount | any path left on exponent 2: the `parseMinorUnits` grouping guess, `draftFromMinor`/`amountFromMinor`, `maxAmountMinor`, the Assistant's centavos, a scale looked up live after a data update | one scale per code, pinned and read through `storedExponent`; every conversion takes the currency as a required parameter, so `tsc` finds callers; the currency-less formatters are unbound and banned in screens; round-trip and property tests; the gate opens last |
| 2 | A third currency's money disappears or reads 0 | loops over the pair (`ledger.ts:150`, `liabilities.ts:158`, and callers such as `database.ts:355`), `presentation.ts:77`, `backup-import.tsx:105`, Home's `?? 0` at `(tabs)/index.tsx:37` hiding a dropped currency, reports returning `ready` 0; overflow guards skipped | loop over the codes present, so a missing key only means no liquid account holds the currency and 0 is true (pinned by the USD-card-only golden); unknown on the out-of-range path; reports refuse a malformed code; a third-currency fixture in every grouping; a source scan against pair literals and binary ternaries |
| 3 | Data lost or unopenable in the SQLite rebuild | foreign keys forced on (the rebuild fails), foreign keys off without a check (orphans), an interrupted migration, a renamed file that opens empty | a dedicated foreign-keys-off helper, `foreign_key_check` before commit, rollback on any error; interrupted-migration and real-v8 upgrade tests; device QA at the end of stage 5 and again in stage 9; never reset storage, never rename the file |
| 4 | Older backups stop restoring, or restore reinterpreted | a v9 rule applied to v1–v8; a hand-edited v1–v8 file naming JPY read at exponent 2; a local scale overwritten by a file | v1–v8 frozen to `LEGACY_CURRENCIES` at 2 from stage 2, whatever the gate; v9 requires a scale per code; a mismatch is a conflict; every existing fixture restores unchanged; v8 export while the ledger holds only ARS/USD |
| 5 | Stored data locked out by a catalogue or gate change | the read path validates against the offered list (`database.ts:255`); a code removed from the gate; a withdrawn code (like HRK, SLL, ZWL) dropped from `CURRENCY_DATA`, after which `storedExponent`, `currencyRecord` and every formatter throw "Moneda no admitida." | read acceptance is "ARS/USD or a pinned scale", never the gate; views check only the code's shape; the fiat code set is pinned (24A); a code that was ever in the gate stays in the catalogue as `historical` (stage 5); a test that shrinking the gate keeps rows readable, displayable, exportable and restorable |
| 6 | A draft survives a currency change and is saved at the new scale | `components.tsx:233` ignores the currency; toggles keep drafts (`card-form.tsx:131`, `debt-form.tsx:132`, `budget-form.tsx:120`); account switches (`entry-form.tsx:147`, `transfer-form.tsx:187`, `recurring-form.tsx:113`); parameters coerced to ARS | re-validation with a notice and Save blocked; never truncate or rescale; the currency before the amount; parameters validated, never coerced |
| 7 | The catalogue's exponent drifts | an ISO or CLDR update changes a minor unit or withdraws a code; CI can check output hashes but cannot regenerate from upstream; ISO and CLDR disagree (IQD 3 vs 0) | ISO's minor unit is stored, and CLDR's digits only format; `currency.test.ts` pins every fiat exponent and the fiat code set, so a change fails the tests; the generator refuses an ARS/USD change; `storedExponent` refuses a stored scale that disagrees; `--check` in the release checklist; a pinned row is never updated |
| 8 | The Assistant scales amounts wrongly | "centavos" at `openai.js:20` and `:24`; explain facts in minor units with no stated scale; `conversation.ts:222` trusts `amountMinor`; the draft card is confirmable | the new version sends major-unit draft strings that the client converts and checks, and facts with an explicit exponent that the prompt states; the server validates a generated superset, never the client gate; non-v1 currencies refused until that version is deployed; stubbed JPY and KWD parse and explain tests |
| 9 | VoiceOver reads an amount ambiguously | "1234,567" is the separator-before-three-digits pattern docs/i18n.md §9 avoids; ARS "pesos" beside another peso, USD "dólares" beside another dollar | device check of exponent-3 amounts with Spanish and English voices before those codes open; stage 4 speaks the full CLDR name for ARS/USD when the ledger holds another currency sharing the word; spoken goldens per exponent |
| 10 | Exact shapes break export, preview and retries | a column spread by `SELECT *`; a new key in `ACCOUNT_KEYS`; receipts compared field by field (`database.ts:517`) | the scale lives in its own table; explicit columns; Account, Entry and Transfer shapes unchanged |
| 11 | A render crash or wrong total near the safe-integer limit | 13 whole + 3 decimal digits exceed 2^53; unguarded `Number` sums (`debts.tsx:24`, `recurring.tsx:143`); `Money` throws on an unsafe value | `maxWholeDigits` (15 − exponent); BigInt helpers with a per-currency status; "—" for an unsafe value |
| 12 | Guards stay blind to new code | partial mocks in harnessed tests; the name-based VoiceOver scan; three banned signs; generated files exempted by exact path | new helpers through `../i18n/format`; `VISIBLE` updated with each formatter; scans driven by the catalogue; a directory or header exemption |

### 7.5 Safe implementation order for 24B

**Status after Producto 24B1 (2026-09-24).**

| Stage | Status | What remains |
| --- | --- | --- |
| 1 Safety net | **complete** | — (the pair-literal allow-list in `tests/currency-guards.node.ts` names each remaining site with its stage) |
| 2 One gate, complete groupings | **complete in the domain, storage validators, groupings, Home's `try`, the Assistant client bound to v1, `Currency` widened** | the route parsers that still whitelist the pair (`report-day.tsx`, `spending-detail.tsx`) and the drill-down fallbacks (`report-category.tsx`, `report-comparison.tsx`, the quick-action receivers): a strict route-currency parser over the held currencies; the four binary ternaries (`components.tsx:282`, `card-visual.tsx:37`, `(tabs)/reports.tsx:86`, `budgets.tsx:57`) go with stage 4's `{name} · {code}` template |
| 3 The amount path by exponent | not started | all |
| 4 Presentation and copy | not started | all |
| 5 SQLite schema 9 | not started, **not authorized** (decision 7.6.5 pending) | all |
| 6 Backup v9 | not started | all |
| 7 Assistant contract, server first | not started | all (v1 refuses EUR; the client refuses to send a non-v1 currency since 24B1) |
| 8 The searchable currency screen | not started | all |
| 9 Device QA, then the gate | not started | all; three-decimal currencies only after the VoiceOver check on an iPhone |

Deliberate golden changes made in 24B1 (the table below listed them for stages 1 and 2):
`budgets.test.ts` and `spending-home.node.ts` probe `XAU`, `ZZZ`, `ars` and a ready code outside the gate (`CHF`);
`currency.test.ts` "the ledger accepts exactly the ledger currencies" became "a new account may hold exactly the gated currencies; a stored row may hold any storable one";
`errors.accounts.currency` is "Elegí una moneda disponible."; `summarizeMonthlyBudgets` and `spendingOverview` answer a bad currency with "Moneda no admitida."; the Más footer says Producto 24B1.

Rules for every stage:
- Production stores or offers no new currency before stage 9.
- No stored amount is rewritten.
- ARS/USD output stays byte-identical (list below).
- Tests open the gate by passing an explicit currency set (an optional parameter defaulting to `LEDGER_CURRENCIES`, or the harness's module map), never by editing the list.
- Groupings, reads and views follow the data. The gate controls only creation and forms.
- Each stage runs the mobile README checks and the root web tests, build and hygiene check, and records its outcome in docs/mobile-roadmap.md.

1. **Safety net (tests and guards).**
   - ARS/USD goldens where none exist:
     - the card's VoiceOver label (`card-visual.tsx:37`)
     - the SpendingTimeline caption and labels (`spending-timeline.tsx:35`, `:38`)
     - the MonthBars scale caption (`charts.tsx:138`)
     - the day-net header (`entry-list.tsx:33`)
     - Home's Disponible "US$ 0,00" for ARS cash plus only a USD card
     - a byte-for-byte v8 export and `archiveKey` of a fixture ledger
     - the transfer currency guard (`transfers.ts:30`) and `recovery.ts:221` in `packages/domain`
   - EUR probes that mean "unsupported" (`budgets.test.ts:69`, `spending-home.node.ts:164`) move to a code that stays unsupported (`ZZZ`, `XAU`), plus one catalogue-driven probe (a `ready` or `incomplete` code outside the gate).
   - `extract.mjs` exempts `src/i18n/currencies/*.ts` by directory or by the `GENERATED` header, instead of by exact path in `extract-allow.json`. A test asserts that every file there is exempt, and `npm run i18n:check` learns the generated modules.
   - A source scan lists today's pair literals (the thirteen lists and the three option lists) and binary ternaries, and fails on any new one. Its allow-list shrinks stage by stage; contract v1 and the ARS symbol rule stay on it.
2. **One gate, complete groupings.** Each list becomes a catalogue predicate. Every site gets exactly one of three meanings:
   - **Entry** (`isLedgerCurrency`): account, card, debt and budget creation (`createAccount`, `createCreditCard`, `createPersonalDebt`, a new budget in `saveMonthlyBudget`, the form checks) and the `new-account.tsx:26` and `budget-form.tsx:27` params.
   - **Stored rows** (read acceptance: ARS/USD, or from stage 5 a pinned scale): `validateAccount` and `validateMonthlyBudget`/`validateBudgetCollection` on the load (`database.ts:255`, `:287`), restore and `validateArchive` paths, plus `createPilotBackup` and export. Each validator splits into a read function and a creation function that adds the gate.
   - **Views** (a canonical code with a minor unit, never the gate, with their own error): `summarizeMonthlyBudgets` (`budgets.ts:153`), `spendingOverview` (`spending-overview.ts:22`), `reportPeriod`/`spendingWindow`. Routes also require an account holding the code: `report-day.tsx:19`, `spending-detail.tsx:21`, `budgets.tsx:29`, `(tabs)/assistant.tsx:54` and the quick-action receivers. Drill-downs (`report-category.tsx:21`, `report-comparison.tsx:18`) refuse anything else instead of falling back. Home wraps `spendingOverview` (`(tabs)/index.tsx:33`) in `try`.

   Imports and totals:
   - v1–v8 records accept exactly `LEGACY_CURRENCIES` at `LEGACY_EXPONENT`, whatever the gate.
   - Per-currency loops (`ledger.ts:150`, `liabilities.ts:158`, `presentation.ts:77`, `backup-import.tsx:105`) take the codes present: ARS, USD, then by code. Their callers (`database.ts:355`, `recovery.ts:165`, `:405`) inherit the fix.
   - Home's `?? 0` stays, because it is now only a true zero; unknown stays the out-of-range path.
   - Reports share one `accountsInCurrency`, and `sumMoney` replaces the private `safeSum`.
   - Debt and recurring totals move to BigInt helpers.

   Binary ternaries become lookups keyed by code, with the legacy words (`components.tsx:282`, `card-visual.tsx:37`, `(tabs)/reports.tsx:86`, `budgets.tsx:57`). New pure guards:
   - `validateRecurringRuleChange`
   - an immutable profile `accountId`
   - a budget currency error apart from the month error
   - a code-neutral `errors.accounts.currency`

   Then `Currency` widens to `IsoCurrencyCode`, with `LegacyCurrency` for v1–v8 and contract v1, and the client refuses to send a non-v1 currency to the Assistant.

   *Tests:*
   - a third currency (JPY, KWD, EUR fixtures) in every per-currency grouping: totals, liquid totals, archive and third-currency overflow, import preview, account sections, Home, Budgets, Reports, backup review
   - a dropped currency never reads 0
   - ARS/USD key order and `{}` for an empty ledger unchanged
   - unknown or lowercase codes refused
   - an explicit gate with JPY still refuses a v8 file naming JPY
3. **The amount path by exponent.**
   - New helpers: `minorFromAmount(draft, currency)` (`parseLocalizedAmount` with the ledger separators), `draftFromMinor(minor, currency)` and `amountFromMinor(minor, currency)`, with `currency` required so `tsc` lists every caller. Also `maxWholeDigits`, and decimals = exponent.
   - `amountFormat` takes the currency, and its decimals come from the exponent.
   - `AmountInput`/`AmountField` take the currency:
     - no decimal key at exponent 0
     - catalogue paste markers (a bare "$" stays non-evidence)
     - a single separator before three digits is ambiguous at exponent ≥ 3
     - settle pads to the exponent
     - a currency change re-validates the draft: a notice shows, Save is blocked and the digits are kept (ARS ↔ USD is a no-op)
   - Every parse, prefill and shortcut site in the forms row moves.
   - `maxAmountMinor` (sent by `card/[id].tsx:68` and `debt/[id].tsx:35`, forwarded by `new-transfer.tsx:11`, `:15`) is capped at 15 digits and read with the target's exponent.
   - The Assistant hand-off passes `amountMinor` and the currency; the old `amount` parameter still reads for old links.
   - Debts choose the currency before the amount.
   - Paste and domain messages gain `{digits}` and no-decimal variants beside the exact exponent-2 sentences.

   *Tests:*
   - round trips `draftFromMinor` → `minorFromAmount` at exponents 0, 2 and 3 (limits, negatives, zero)
   - an exponent-2 property test equal to `parseMinorUnits`/`formatMinorUnits` over the draft corpus
   - paste tables per exponent
   - re-validation of the draft in every form on a currency or account change
   - JPY and KWD shortcut fills
   - the `money-input.node.ts:448` lint also bans `10 **`
4. **Presentation and copy.**
   - The 21 currency-less call-site lines move to `formatMoneyAmount` and a bound `spokenMinor`. The region sample uses `formatMoneyAmount(123456, 'ARS')` (same bytes).
   - `formatAmount` and `spokenNumber` then leave the bound `I18n`, and the scan bans them in screens. They stay in `format.ts` as the pinned exponent-2 path, so their unbound goldens in `i18n.node.ts` are unchanged.
   - `charts.tsx:138` takes whole units from `splitMinor`. `Money` shows "—" for an unsafe value.
   - A picker replaces the segments beyond two currencies; two currencies keep today's layout.
   - The spoken unit takes the set of currencies in the ledger. ARS and USD keep "pesos"/"dólares"/"dollars" unless another held currency shares the word; then they use the full CLDR name.
   - One `{name} · {code}` template replaces the per-currency keys (same output; lock and `same` whitelist updated).
   - `selection.currencyNote` and `transferForm.missingDetail` become currency-neutral.
   - Glossary terms and docs/i18n.md §9.
   - The scans ban catalogue symbols, `minorToMajorString`, `splitMinor`, `Intl.DisplayNames`, `fmtNum` and `parseMoneyInput`, and the two re-exports are removed.

   *Tests:*
   - JPY and KWD visible and spoken goldens at every migrated site
   - ARS/USD-only ledgers byte-identical in speech, plus goldens for ARS+CLP and USD+CAD
   - hero and row fit for "JP¥ 999.999.999.999.999" and "KWD 999.999.999.999,999" at 320 pt
   - a 3-currency Home, Reports and Budgets with the picker
5. **SQLite schema 9.**
   - First commit: `readArchive` and the single-row lookups name their columns.
   - A migration helper on its own connection: `PRAGMA foreign_keys = OFF` before `BEGIN IMMEDIATE`, and `PRAGMA foreign_key_check` must be empty before `COMMIT`, otherwise rollback. `runExclusiveTransaction` stays unchanged for writes.
   - `MIGRATE_V9`:
     - rebuild `accounts` with the same columns and CHECKs, but a shape-only currency CHECK (`length(currency) = 3 AND currency NOT GLOB '*[^A-Z]*'`)
     - rebuild `monthly_budgets` the V7 way
     - create `currency_units`: `currency` primary key, `minorUnitExponent` 0–4, `source`, `catalogVersion`, `createdAt`. Rows are never updated. ARS/USD get no row and read as 2.
     - `DATABASE_VERSION = 9`
   - Account, card, debt and budget creation and import insert the code's row in the same transaction on first use (idempotent).
   - Reads resolve scales with `storedExponent` and refuse a mismatch with a message, never a reset. Its no-scale path already accepts only `LEGACY_CURRENCIES` (ARS/USD; `currency.test.ts` "requires a scale for any other currency"). Keep it.
   - The generator keeps every code that has been in `LEDGER_CURRENCIES`. When ISO withdraws such a code, it gets a `historical` status with a frozen minor unit, symbol and names: displayable, never offered.
   - No build containing schema 9 is installed over real data before decision 7.6.5. At the end of this stage, with the owner's build authorization, device QA of the upgrade runs on a copy restored from a v8 backup, including a forced interruption. Stage 9 repeats it.

   *Tests:*
   - real v8 files with every child table populated upgrade to identical rows and balances
   - a failure injected mid-migration leaves the v8 file intact and reopenable
   - `foreign_key_check` is empty
   - JPY and KWD rows are written, reopened and pinned once
   - a disagreeing pinned scale refuses to open
   - a EUR row without a `currency_units` row refuses to open, even with EUR in an explicit gate
   - shrinking the gate keeps everything working: the database opens, and Home, Budgets, the drill-downs, budget load and export all work
6. **Backup v9.**
   - v9 = v8 plus `currencyUnits: [{ currency, minorUnitExponent, source, catalogVersion }]`: strict keys, one entry per non-ARS/USD code used, equal to the catalogue. Record key lists and `moneyUnit` unchanged.
   - Export writes v8 unless a non-ARS/USD code exists.
   - v1–v8 stay frozen to ARS/USD at 2 (stage 2).
   - v9 import uses read acceptance: any code whose declared scale matches the catalogue, gated or not.
   - Import pins missing units before accounts and budgets, in one transaction.
   - A scale that differs from the local row is a conflict in the preview.
   - The version sentence and `backup.import.formats` say v1 to v9 (es, en, lock).

   *Tests:*
   - every v1–v8 fixture restores unchanged
   - an ARS/USD ledger exports the stage-1 v8 bytes
   - v9 with JPY and KWD round-trips every amount
   - with the gate reverted to ARS/USD, a v9 file with JPY still imports and exports
   - v9 without a unit, v9 with a wrong unit, and a v1–v8 file naming JPY are refused
   - a scale-only difference is a conflict
   - a failed import changes nothing
7. **Assistant contract, server first.** One version carries both docs/i18n.md §11's `locale` and the currency change, and §11 is updated in the same commit. Its sentence "`amountMinor` is integer minor units of the stated currency" becomes: facts keep `amountMinor` at the request's explicit `minorUnitExponent`, and a draft amount is a canonical major-unit string. If §11's v2 ships first, this change is v3, with the same rollout.
   - The server validates the currency against a fixed superset that does not depend on the client gate: every catalogue code whose data status is `ready` (or `historical`). `generate.mjs` emits this list as a JS module that `contracts.js` and the enum at `openai.js:6` import.
   - The parse prompt (`openai.js:20`) and the explain prompt (`:24`) drop "centavos" and state the scale.
   - Staging payloads record their version (`schema.sql:9`). `schema.test.sql:19`–`:36` gains a fixture in which a payload without a version reads as v1. This is a reviewed staging migration only.
   - v1 stays unchanged.
   - After the server is deployed where the build points, the client sends the new version for gated currencies, converts with `majorStringToMinor`, refuses a draft beyond the currency's digits, and drops the ARS default in `conversation.ts:245`.

   *Tests:*
   - stubbed parse and explain cases for JPY and KWD
   - v1 still refuses EUR (`handlers.test.js:39`)
   - ARS answer goldens unchanged (`assistant-ui.node.ts:171`, `:267`, `:343`)

   This stage may land after stage 9 only while stage 2's refusal stands.
8. **The searchable currency screen.** `CurrencyField`'s sheet gains search (`searchCatalogue` over `catalogueCurrencies(locale, ['ledger'])`).
   - Read-only rows use a full-catalogue display lookup that falls back to the ISO code, never ARS (`edit-account/[id].tsx:89`).
   - Card, debt and budget forms use the screen before the amount.
   - It is built from existing wrappers with `accessibilityLanguage`. Any new wrapper is registered in the VoiceOver scan and the harness mocks.

   *Tests:*
   - search, order and selection with an explicit gate of five codes
   - with the production gate, the sheet still lists ARS and USD with today's labels
9. **Device QA, then the gate.** On a development build (with the owner's build authorization), check:
   - the upgrade of a real v8 ledger
   - backup export and restore
   - VoiceOver in Spanish and English on JPY and KWD amounts
   - the number pad at exponent 0
   - the picker at the largest text sizes and at 320 pt
   - Reduce Motion
   - the currency-change notice

   Record the results in docs/mobile-device-checklist.md. Then **one commit** adds the owner's first currencies to `LEDGER_CURRENCIES`. It also updates the tests that pin the production gate (table below) and the counts in docs/currency.md §2, and changes nothing else. The stage 2–8 tests that ran with an explicit gate now also run with the production list. Reverting that commit hides the new currencies from forms, and their rows stay readable, exportable and restorable (stages 2, 5 and 6).

**Byte-identical through every stage:** every existing test except the rows of the table below. Examples:
- the ARS/USD output comparisons in `currency-presentation.node.ts`
- the formatter tables in `i18n.node.ts`
- the `typography`, `ui-rows`, `home-ranking`, `polish-routes`, `recovery-routes`, `report-routes`, `smart-amounts`, `spending-chart`, `liabilities-routes` and `assistant-ui` strings
- `spending-home.node.ts`
- the region samples (`locale-release.node.ts:203`, `locale-switch.node.ts:207`, `:539`, `:555`) and `locale-switch.node.ts:644`
- `presentation.node.ts:60`–`:62`, `:77`–`:82`
- `reports.node.ts:16`, `:29`, `:30`, `:51`
- the `money-input` tables (13 whole digits, two decimals)
- `ledger.test.ts:10`–`:28`, `liabilities.test.ts:69`, `:71`, `recovery.test.ts:117`–`:118` and the other `packages/domain/*.test.ts`
- `database.node.ts:855`, `:925`, `:968`
- totals shapes (`{ ARS, USD }` order, `{}` when empty)
- budget identity keys and report numbers
- the backup v8 schema pins, the v1–v8 fixtures and `archiveKey`
- the Account row (`personalization-routes.node.ts:123`, `:125`) and budget JSON (`budgets-routes.node.ts:90`, `:118`, `:174`)
- the Assistant draft (`assistant-routes.node.ts:268`)
- the web's `src/domain/*.test.js`

| Stage | Deliberate golden change |
| --- | --- |
| 1 | `budgets.test.ts:69`, `spending-home.node.ts:164` probe a code that stays unsupported |
| 2 | `errors.accounts.currency` text (es, en, lock) and the tests that pin it; `currency.test.ts` "the ledger accepts exactly the ledger currencies" moves to the creation validator |
| 3 | `assistant-routes.node.ts:340` parameters gain `amountMinor` |
| 4 | lock entries of retired keys and the `same` whitelist (strings unchanged); `selection.currencyNote` and `transferForm.missingDetail` text (es, en, lock), including `ui-rows.node.ts:165`; `i18n.node.ts:519`–`:528`, `:641` and `database.node.ts:1190` move to `formatMoneyAmount`/`spokenMinor` with `'ARS'` (same expected strings); conditional: ARS/USD spoken units beside a currency sharing the word (no ARS/USD-only golden sees it) |
| 5 | `database.node.ts:64`, `:507`, `:607`, `:737`, `:827`, `:990` `user_version` 8 → 9; `:150`–`:152` probe → `DATABASE_VERSION + 1` |
| 6 | `recovery.test.ts:103` probe v9 → v10; the "v1 a v8" sentences |
| 8 | `ui-rows.node.ts:291` and `currency-presentation.node.ts`'s `currencyOption('EUR')` assertion (no ARS fallback) |
| 9 | `LEDGER_CURRENCIES`, and the assertions that pin the production gate: `currency.test.ts` "keeps ARS and USD exactly as the ledger has always stored them" (the list); `currency-catalogue.node.ts` "the catalogue today…" (ledger and ready counts); `currency-presentation.node.ts` "forms still offer exactly ARS and USD…"; `ui-rows.node.ts:155`, `:157`, `:283`–`:296`; stage 8's production-gate test; the counts in docs/currency.md §2 |

### 7.6 Decisions for the owner before 24B

**Decided on 2026-09-24 (24B1 brief).** The 151 `ready` currencies are prepared and opened
**progressively**, each only when every path it touches is verified; zero- and
three-decimal currencies need their own tests, including VoiceOver on an iPhone, before
they open. The future selector lists only currencies actually enabled (7.6.2: the first
option). A budget may be in a currency the person holds no account in (7.6.3: allowed).
New users choose their first currency in the onboarding; the preferences and data of
existing users are never changed automatically. The irreversible SQLite upgrade (7.6.5) is
**not authorized yet**: compatibility is implemented and verified first. The Assistant stays
limited to ARS/USD until the next server contract is implemented and tested (7.6.6: the
first option). 7.6.1 (which currencies open first) and 7.6.4 (the default when nothing
implies a currency) remain open; ARS stays the pilot's default meanwhile.

1. **The first currencies to open.** Either a curated first list (for example the currencies of the first international users, including one without decimals) or all 151 `ready` currencies at once. Recommendation: curated. Open three-decimal currencies (BHD, IQD, JOD, KWD, LYD, OMR, TND) only after their VoiceOver check on a device.
2. **What the currency screen lists.** Only currencies the ledger can hold (recommended), or also `ready` ones shown as unavailable. Either way, the region stays a search hint and never a preselection.
3. **Budgets in a currency without an account.** Either allowed (a budget keeps its own code, and the scale is pinned per code) or limited to currencies the person holds accounts in.
4. **The default when nothing implies a currency.** Today ARS is preselected for a new account in an empty ledger, a new card or debt, and the empty Home/Reports fallback (`new-account.tsx:26`, `card-form.tsx:29`, `debt-form.tsx:27`, `report-presentation.ts:9`). The options are:
   - keep ARS for the Argentine pilot
   - preselect nothing
   - use the most-used account currency until 24C's `reportCurrency` exists

   Anything other than ARS flips `reports.node.ts:30` and the other empty-ledger fallback goldens.
5. **The one-way upgrade.** Earlier builds cannot open schema 9: they refuse it, unchanged, as designed. Installing a 24B build on a device is therefore not reversible on that device. Backups stay v8 until a new currency is used. This needs an explicit release decision (AGENTS.md rule 3), and stages 5 and 9 need a development build.
6. **The Assistant in new currencies.** Either open the gate with the Assistant limited to ARS and USD until the new contract version is deployed on a server the owner configures, or hold the gate until that version is live.

## 8. Producto 24C contract: exchange rates and a main currency for reports

Designed in 24A, **updated in 24B1 with the owner's decisions of 2026-09-24, not
implemented**. It builds on 24B (currency-aware storage) and on decision 002: currencies
are never summed without a real, dated rate; an unknown rate gives an unknown total, never
a guess; nothing fabricates market history.

**What changed in 24B1's revision.** The preferred experience is that FinanzApp **looks up
a verifiable reference rate automatically** when a person records a purchase in a currency
other than the account's (§9), so that the common form never asks for a rate. Manual entry
of a rate or of the amount the bank actually debited stays as a **secondary, hidden
adjustment** in the detail. A reference rate is an estimate; it never changes a balance.

### 8.1 The rate record

```ts
interface ExchangeRate {
  id: string;                 // operation-style id, stable across devices (sync-ready)
  base: IsoCurrencyCode;      // 1 base …
  quote: IsoCurrencyCode;     // … = `rate` quote   (base ≠ quote, both storable)
  rate: string;               // exact decimal text, "1285.50": ≤ 18 significant digits,
                              // ≤ 12 decimals, > 0; never a float, never rounded on entry
  effectiveDate: string;      // YYYY-MM-DD: the day the rate applies to (not when fetched or typed)
  source: {
    kind: 'provider' | 'manual' | 'statement' | 'official';
    label: string;            // "Frankfurter (ECB reference)", "Mi banco, compra",
                              // "Resumen tarjeta 09/2026"; ≤ 80 chars
    reference?: string;       // provider id or document reference, never credentials
    fetchedAt?: string;       // ISO timestamp for `provider` rates (cache bookkeeping)
  };
  createdAt: string; updatedAt: string; revision: number;
  deletedAt?: string;         // tombstone: a deleted rate stays auditable and syncable
}
```

- **Exact arithmetic.** A conversion multiplies minor units by the rate as a rational number
  in BigInt and rescales by the two exponents: `target = round(minor × rate × 10^(e_target −
  e_source))`. Rounding is **half away from zero, once, on the final converted figure**;
  nothing is rounded on the way, and the unrounded value is never stored.
- **Direction.** A record means `1 base = rate quote`. Using it the other way is allowed and
  exact (the inverse rational), and the converted figure says it was inverted. **No cross
  rates in 24C** unless the provider itself publishes the pair; triangulation would be a
  later, explicit option that shows both rates.
- **History and cache.** Rates are append-only: an edit is a new revision of the same id, a
  deletion a tombstone. A provider rate for a (base, quote, date) is fetched **once** and
  kept: a second purchase on the same day and pair reuses it, and a report for a past
  period reuses what was cached then, so the app never re-asks a provider for history it
  already holds and never back-fills a series it was not given. Future sync carries
  operation ids, revisions and tombstones like movements do (decision 001).

### 8.2 Where rates come from: the provider decision (research before 24C)

Before 24C connects anything, the owner needs a provider review with, for each candidate,
the **effective coverage** (which of the 153 fiat currencies, and which pairs: most
providers publish against one base, so KWD→ARS may be two ECB legs), the **dates**
(daily reference, publication time, weekends and holidays, historical depth), the
**licence and commercial terms** (attribution wording, commercial use, redistribution,
rate limits), **availability** (uptime, an API key or none), **cost** and **caching rules**.
Candidates to review: [Frankfurter](https://www.frankfurter.app) (ECB reference rates, EUR
base, ~30 currencies, free, no key), the ECB's own feed, national central banks (the BCRA
for ARS official rates) and paid aggregators. What the review must not assume: that one
official rate exists for every currency, that a reference rate is what a bank charges
(ARS has several legal rates and card purchases add taxes), or that a provider covers
every day a person records. Whatever is chosen: opt-in, the provider named to the
person, no request without a purchase or a report that needs it, no key in the app
bundle if a key is needed (server-side like the Assistant), and a stored `provider` rate
carries its label, date and `fetchedAt`.

### 8.3 The main currency for reports

- `reportCurrency: IsoCurrencyCode | null`, a key-value preference beside language and
  region, **outside the ledger and outside backups' financial data**, default `null`: reports
  keep showing one total per currency, as today. It is never derived from the region or the
  language, and choosing it never changes an account, a movement or a budget. The
  onboarding will offer it as its own step, after language and region.
- Only reports and summaries convert. Balances, movements, budgets (one currency each),
  recurring rules, cards and debts always show their own currency.

### 8.4 Choosing a rate and the result of a conversion

- **Which rate:** for a total "as of" a day (a balance) or for a period (month spending),
  the rate with the latest `effectiveDate` on or before that day (the period's last day),
  in the direct or inverse direction, from the cache first and from the provider only when
  the cache has nothing for that day and the person opted in. None → **unknown**. A rate
  older than the period is used but shown with its date; a threshold can be added later,
  never a silent substitute.
- **What is converted:** each currency's subtotal is converted once with one rate, then the
  converted subtotals are added; per-movement historical conversion is a later option.
- **Estimated and confirmed are two things.** A figure converted with a `provider` or
  `manual` rate is an **estimate** and is labelled as such; the amount a bank actually
  debited (§9) is a **confirmed** figure in the account's own currency and needs no rate.
  A consolidated total mixes the two only when every part is traceable, and says how much
  of it is estimated.

```ts
type ConvertedTotal =
  | { status: 'single'; currency: IsoCurrencyCode; minor: number }            // one currency, nothing converted
  | { status: 'converted'; currency: IsoCurrencyCode; minor: number;
      estimatedMinor: number; parts: ConvertedPart[] }                        // every part has a rate; estimatedMinor ≤ minor
  | { status: 'unknown'; currency: IsoCurrencyCode; parts: ConvertedPart[];
      missing: { from: IsoCurrencyCode; to: IsoCurrencyCode }[] };          // no total at all

interface ConvertedPart {
  currency: IsoCurrencyCode; minor: number;                                   // the original subtotal
  converted?: { minor: number; rateId: string; revision: number; rate: string;
                effectiveDate: string; source: string; inverted: boolean; estimated: true };
}
```

- **Unknown is unknown.** If any part lacks a rate, there is no total: the screen lists each
  currency's own total and says which rate is missing ("Falta la cotización USD → ARS"),
  with a way to fetch or add it. A partial sum is never shown as if it were the total, and
  a zero is never substituted.
- **Every converted figure carries its provenance** (rate, date, source, inverted or not,
  estimated), visible on the report and read by VoiceOver.
- **Budgets and the Assistant.** A budget stays in one currency; comparing a budget with
  converted spending is not in 24C. The Assistant receives already-computed facts with
  their currency and, when converted, the rate's provenance; it never converts.

### 8.5 Storage and tests 24C must bring

- SQLite: an additive `exchange_rates` table (id, base, quote, rate_text, effective_date,
  source_kind, source_label, reference, fetched_at, created_at, updated_at, revision,
  deleted_at) with CHECKs (`base <> quote`, rate text shape, ISO date); backup: a new backup
  version with an `exchangeRates` array, validated like movements; older backups import
  without rates. The foreign-purchase fields of §9 ride on the same version.
- Tests: exact conversion for exponents 0↔2↔3 in both directions, rounding at every
  half-way case, the 18-digit rate bound, BigInt overflow refusal, latest-rate selection by
  date with ties decided by revision, tombstoned rates ignored, cache reuse (one fetch per
  pair and day, none for a cached past period), unknown totals whenever one part lacks a
  rate, estimated vs confirmed parts, provenance on every converted figure, a stubbed
  provider (no network in tests), and a report whose main currency is unset showing
  today's per-currency totals byte for byte.

## 9. Foreign-currency purchases (design for 24C, not implemented)

A person pays with an account in one currency for something priced in another: USD 30
paid with an ARS account, debited as ARS 45.000 once the bank confirms. This is **one
expense**, never two movements, never a transfer. It is distinct from a currency exchange
(an ARS→USD transfer between two of the person's own accounts, which stays a transfer with
the person's own dated rate) and must not be modelled with one.

### 9.1 The record (conceptual)

| Field | Meaning | Rule |
| --- | --- | --- |
| `accountId` | the account or card that paid | its currency is the **posting currency** |
| `amountMinor`, account currency | what the account is charged: the confirmed debit, or, while pending, the estimate | the only figure balances, budgets and reports count |
| `original: { minor, currency }` | the price as charged by the merchant | kept verbatim; shown as information |
| `settlement: 'pending' \| 'confirmed'` | whether the bank's debit is known | pending never pretends |
| `rate?: { rateId, revision, rate, effectiveDate, source, inverted, estimated }` | the rate used for the estimate, or the effective rate implied by the confirmed debit | provenance, never a bare number |
| `fees?: [{ kind: 'fee' \| 'tax', minor, label }]` | bank fees and taxes identifiable on the debit | part of the confirmed amount, listed once, never added again |

- **Accounting uses the account's real currency and the amount actually debited.** The
  original amount is information about the purchase; it is never posted anywhere, so
  nothing is counted twice and no ARS balance ever contains dollars.
- **While the debit is unknown, nothing is invented.** If a reference rate is available
  (cached or fetched, §8), the movement is stored `pending` with an **estimated** posting
  amount and its provenance; if none is, the movement is stored `pending` with the original
  amount only, the posting amount **unknown**, and every screen says the equivalent is not
  available yet. A pending movement is never shown as confirmed.
- **Confirming** replaces the estimate with the bank's figure (typed by the person from the
  statement, or, later, imported through an authorised channel with consent), records the
  effective rate the debit implies and the fees/taxes, and flips the state. Editing keeps
  the movement's id and revision history like any correction.

### 9.2 The form does not change

- Recording an expense in the account's currency stays the default and the only thing the
  common form shows. The foreign-currency purchase is a **secondary, discreet option**
  (inside "Más opciones" or a contextual row that appears when the person chooses it),
  never a currency selector, rate field or financial explanation on every expense, and
  never a recurring pop-up asking to confirm the account's currency.
- Choosing it adds one row: the original amount with its currency (the searchable
  catalogue screen of stage 8, filtered to enabled currencies). The estimated equivalent,
  when available, appears as secondary text with its source and date; when not, a short
  note says it will be available later. Saving never blocks on a rate.
- The adjustment (the real debit, a different rate, fees) lives in the movement's detail as
  a secondary action, not in the form. Existing components, the discreet micro-animations,
  the cobalt/sapphire palette and the native patterns are reused; no new surface.

### 9.3 Storage, Assistant and later automation

- Schema and backup fields ride on 24C's version (§8.5): additive nullable columns on
  `entries` (`originalMinor`, `originalCurrency`, `settlement`, `rateId`, `rateRevision`)
  and a small `entry_charges` table for fees/taxes; v1–v9 backups import with every
  movement `confirmed` in its account currency, as today.
- The Assistant may propose a foreign purchase as a draft with the original amount and
  currency; the estimate and the posting stay the app's job, after confirmation.
- Later, with the person's consent, authorised ways to bring in confirmed debits can be
  studied (statement import, Apple Pay capture of the amount charged); none assumes access
  to Apple Pay or bank history, and none replaces the person's confirmation.

## 10. Home and reports with several currencies (design)

- Each account shows its balance in the currency it holds; nothing on Home adds two
  currencies. Home's currency switch lists the currencies present (24B1), in the order
  ARS, USD, then by code.
- An expense shows its **posted** amount first (the account's currency) and, when it is a
  foreign purchase, the original amount underneath or in the detail. A pending foreign
  purchase shows the **original amount first** and the estimate second, clearly labelled
  as estimated with its source; once confirmed, the debited amount is the posted figure and
  the original stays in the detail.
- Consolidated reports exist only with a `reportCurrency` and only through traceable
  conversions (§8.4); estimated and confirmed parts are distinguished, a missing rate means
  per-currency subtotals with a visible "no verifiable total" note, and a partial sum is
  never presented as final.
- Automatic rate retrieval is the planned main path (§8.2) and is a separate decision with
  cost, licence, freshness and consent controls; nothing is connected and no rate is
  invented before it.

## 11. The Assistant with several currencies and languages (design)

Contract v1 knows ARS and USD; the client does not send anything else (24B1). The next
version (docs/i18n.md §11, stage 7 of §7.5) carries language and region as two separate
preferences, validates currencies against a generated superset independent of the client
gate, states the scale instead of "centavos", and returns draft amounts as canonical
major-unit strings that the client converts and checks. Beyond that, when real AI arrives:
the model must understand a message written in any language, including one different from
the interface language, and answer in the interface language; voice needs a transcription
provider with proven multilingual coverage; merchant names, custom categories and the
person's own words are copied verbatim, never translated; ambiguous amounts, currencies
and separators ("1.500", "$", "pesos" in a two-peso ledger) are asked about before any
draft; a draft is only ever a proposal confirmed by the person; and the backend enforces
quotas, per-request and per-person spend ceilings, cost telemetry and privacy. None of
this is active in 24B1.
