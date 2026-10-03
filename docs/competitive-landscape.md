# Competitive landscape and capability map

**Status.** A discovery document, written on 2026-10-02 in Producto 25DISC1. **It changes nothing in the product:** no
screen, no palette, no integration, no provider, no identifier, no roadmap order. It records what the best relevant
personal-finance apps offer today, what FinanzApp has, plans, gates or excludes for each capability, the decisions
and research gates for capabilities the roadmap had not considered, and the research behind two gates the owner asked
for (Mercado Pago, bank connections). The brand side of the discovery is [brand-brief.md](brand-brief.md).

- **Research date: 2026-10-02.** Every competitor fact was read from a primary source on that date (the current App
  Store listing in the Argentina and United States storefronts with its version history and in-app purchase list, the
  official site, help centre, changelog or terms) by one researcher and re-checked by a second, adversarial reader who
  downgraded anything the source did not actually say. Prices, versions and features change weekly; re-read the source
  (§13) before any decision that depends on one. A claim that could not be confirmed is marked unverified, never
  asserted.
- **No competitor UI, copy or asset was copied.** Descriptions are paraphrases for comparison.
- **Nothing is marked IMPLEMENTED because a competitor has it.** The FinanzApp column comes from the repository (code
  and tests for IMPLEMENTED; the roadmap, the plans and the decisions for the rest), checked by a second reader against
  the files.
- **The financial invariants are preserved**, in particular the original-currency ledger with conversion only in views
  at each movement's own dated rate (docs/currency.md §1, §2.8): several competitors store a converted local value at
  entry; that is recorded as their choice, never as a reason to change ours. The card invariants of decision 003, the
  one write path of production-plan §5.3 and AGENTS rule 12 bind every capability below.
- Labels for FinanzApp, exactly one per capability (phases are the roadmap's: 25A, 25A2, 25C, 25C2, 25D, 25E, 25F, 26):

| Label | Meaning here |
| --- | --- |
| **IMPLEMENTED** | Code on `master` (d0a0be8) with a test, named in §3's notes where it matters. Code on Linux, not device evidence. |
| **ACTIVE ROADMAP** | Scheduled in a named phase of the roadmap with scope text. |
| **LAUNCH CANDIDATE** | Proposed by this document for a phase before 26, or recorded earlier as a «later note»; an owner decision places it. |
| **RESEARCH GATE** | Unknown until research, an experiment or a physical-device proof settles it; nothing is built on the assumed answer. |
| **POST-LAUNCH** | After 26, or deliberately not promoted. |
| **DELIBERATELY EXCLUDED** | Ruled out by a decision record, an AGENTS rule or a platform fact. |

Competitor cells: ● offered · ◐ partial or with a notable limit · ○ not offered (evidence of absence) · ? unverified
(no primary source either way).

## 1. The competitor set

Six products the owner named, plus four added because they expose patterns the six do not (an Argentine expense app
with Mercado Pago and cuotas, an Argentine AI-metered app, the reference splitting product, and an Apple-native indie
app with Live Activities and Wallet capture). Products considered and dropped: Tricount and Settle Up (the splitting
pattern is covered by Splitwise; both are cited in §9), Mobills (Brazil-only open finance), Cashew (local-first is
covered by Kesef; Flutter, no Apple-native lessons), Gasti and Ábaco (Argentine, surfaced by search, not read),
Spendee, Fintonic and Finerio (not read). Copilot and Monarch are not distributed in the Argentina storefront (their
listings answer 404 there); they are included for the Apple-first and household patterns.

| Product | Developer, origin | Platforms | Latest iOS version (read 2026-10-02) | Positioning, paraphrased | Pricing as listed (USD on the AR and US storefronts) | Storefront |
| --- | --- | --- | --- | --- | --- | --- |
| **Kesef** | Gonzalo Nahmias, Argentina (indie) | iPhone, iPad, Mac (iPad app), Android; no web | 2.4.0, about 2026-09-27 («5 days ago»); 2.3.0 of 2026-09-23 added Mercado Pago; 2.0.0 of 2026-08-26 added groups, Shortcuts, widgets | Free, ad-supported, account-optional, offline-capable expense tracker for Latin Americans that combines personal spending with group splitting; capture by voice (several expenses at once), Mercado Pago sync and an Apple Pay Shortcut | Monthly 4.99, yearly 34.99, lifetime 99.99 (US list; the AR list showed monthly and yearly); 14-day trial on annual | AR and US |
| **MonAi** | Florian Vates, Germany (indie) | iPhone, Mac (iPhone app), Vision; Android (separate codebase); no web | 1.10.0, 2026-09-16 (AI Reports, WhatsApp bot, automatic FX conversion); 1.9.0 of 2026-07-09 added pay-cycle periods | Minimalist AI expense tracker: speak, type or let Apple Pay, WhatsApp or notifications log it, then ask questions; no accounts, cards or bank sync by design; «no login, data in your iCloud» plus an optional account for AI Reports and WhatsApp | Basic 3.99 monthly / 24.99 yearly intro, Monthly 7.99, Yearly 71.99, Student 2.99 / 24.99, Family 3.99; 7-day trial; free tier capped at 20 transactions a month and the current month's history | AR and US |
| **Copilot Money** | Copilot Money, Inc., United States | iPhone, iPad, Mac, Vision, web | 8.4.0, 2026-09-17; Money Assistant beta (2026-04) and a read-only MCP (2026-05) | Apple-first, bank-sync-driven all-in-one for US users: per-user ML categorisation, one monthly spending line with rollovers, recurrings, goals, cash flow, investments and net worth; paid only | Monthly 13.00, yearly 95.00; one-month trial; no free tier | US only (AR listing answers 404) |
| **Monarch** | Monarch Money, Inc., United States | iPhone, iPad, Vision, Android, web | 2.0.118, 2026-09-30 | Paid, ad-free «home base for money clarity» for US and Canadian individuals and households: every account aggregated, Flex or category budgets, goals, recurring and bills, AI assistant, free collaboration with a partner or professional | Monthly 14.99, yearly 99.99, yearly Plus 199.99; 7-day trial with a payment method | US and Canada (AR listing answers 404) |
| **YNAB** | You Need A Budget LLC, United States | iPhone, iPad, Apple Watch, Android, web (flagship) | 26.37, 2026-09-30; 26.36 added Card Mode (swipe to approve imports) and Plan Reset | Zero-based, envelope-style planning first: give every dollar a job; bank import in the US, Canada, the UK and Europe; one subscription covers up to six people | 14.99 monthly, 109.00 yearly; 34-day trial on the web | AR and US |
| **Wallet by BudgetBakers** | BudgetBakers s.r.o., Czech Republic (a licensed PSD2 account-information provider) | iPhone, iPad, Mac, Vision, Android, web | 5.7.4, 2026-09-23; 5.5 of 2026-04-15 redesigned the dashboard and the Apple Pay setup | Mass-market all-in-one money manager with bank sync as the hero (Europe and North America), flexible budgets, planned payments, investments, group sharing; Android is its most complete platform | Four unlabelled «Premium» entries (US 5.99 / 14.99 / 24.99 / 29.99; AR 4.99 / 14.99 / 24.99), 3-Year 49.99, Lifetime (US 29.99, AR 24.99); trial exists, length not stated | AR and US |
| **Piggy** (added) | Tomas Altman, Argentina (indie) | iPhone, Android; account mandatory; no web | 1.1.25, 2026-09-15; 1.1.24 of 2026-09-09 redesigned the app and connected ChatGPT and Claude through an MCP server | Argentine expense app: record from the app, WhatsApp, Apple Wallet or synced Mercado Pago and Ripio accounts; card closing and due dates and cuotas before the statement; split bills keeping only the real share in analytics | Pro weekly 1.99, monthly 4.99, yearly 49.99 (site: Pro Max 10.99 / 109.90, not on the App Store list); free forever with volume caps | AR (also loads on US and CL) |
| **Finy** (added) | Gonzalo Tarnofsky, Argentina (indie) | iPhone, iPad, Android; no web | 2.0.2, 2026-09-18 («Pro para siempre» one-time purchase); 2.0 of 2026-08-27 added a monthly AI advisor | Argentine AI capture app: voice, text, receipt photo, screenshot, PDF statement, Mercado Pago sync in seven countries; metered AI usage per month with ads on the free tier; shared spaces for couples | Plus 2.99 monthly / 24.99 yearly, Pro 4.99 / 39.99, Pro para siempre 99.99; 14 days of Pro on install; free 100 movements, 10 AI queries, 2 scans a month | AR and US |
| **Splitwise** (added) | Splitwise, Inc., United States | iPhone, iPad, Vision, Android, web | 26.9.1, 2026-09-20 (release notes generic; roughly two releases a month) | The shared-expense ledger: groups, per-person balances, debt simplification, settle-ups; explicitly not a personal-finance manager; US-only wallet and card products | «Splitwise Pro» tiers sharing one name (US 2.99 / 3.99 / 4.99 monthly, 29.99 / 39.99 yearly; AR up to 59.99); free tier capped at four expenses a day with ads | AR and US |
| **MoneyCoach** (added) | MoneyCoach UG, Germany (indie) | iPhone, iPad, Mac, Apple Watch, Vision; Android deprecated; no web | 12.1, about 2026-09-27; 12.0 of 2026-09-12 added Siri with Apple Intelligence and payday schedules | Apple-native, privacy-first money manager without a login: manual or Apple Pay capture, Live Activities since 2022, iCloud and Family sync, optional European bank sync, on-device Apple Intelligence | Unlabelled «Individual» entries (AR 3.99 / 8.99 monthly, 26.99 to 69.99 yearly; US 4.99 to 9.99, 49.99 to 69.99), Family 43.99, Premium Max 5.99, Lifetime 179.99 (AR) / 199.99 (US); trial exists | AR and US |

Dates: the App Store shows only the day and month for the current year; «2026» is inferred from the version
history's order and corroborated by Google Play or the vendor's changelog where one exists. Storefront prices are the
in-app purchase lists as rendered on 2026-10-02 and are not a price comparison: several vendors do not label which entry
is monthly or annual.

## 2. How to read the matrix

Each group below is one table: the capability, FinanzApp's label and phase, then one cell per competitor. Notes after
each table record the mechanism where it matters (how a thing works, not only that it exists), the invariant that binds
FinanzApp's version, and what the verification changed. Verification re-read the sources of 10 of the 10 products and changed or added 107 cells and notes; the per-capability evidence (status after verification, a one-line paraphrase of the source and its URL) is the durable record [competitive-evidence.md](competitive-evidence.md), which a future contributor uses to trace any cell; §13 lists every source read.

### 2.1 Limits of this research

A completeness critic read the whole set after verification. What it found, so nobody over-reads the matrix:

- **Desk research only.** Store pages, official sites, help centres, changelogs and terms; no installs, no screenshots
  of real flows, paywalls, widgets or Live Activities; no review mining; no scale data beyond store rating counts.
- **Weak rows.** Live Activity, Quick Actions, Lock Screen widgets, App Intents beyond Apple Pay, accessibility
  declarations, FX rate source and historical-rate retention, trial lengths and the mapping of unlabelled in-app
  purchase entries to plans are unverified for more than half the products; a «?» there means the vendor does not
  document it, not that it is absent. The «iOS-native» differentiation therefore rests on FinanzApp's own rules, not
  on a proven gap in the field.
- **Dates.** The brief's research date is 2026-10-02; the second-reader pass re-read several storefronts on
  2026-10-03, and the App Store shows only relative or day-month dates, so exact release days carry a one-day
  uncertainty where no vendor changelog or iTunes lookup fixed them.
- **Prices** are the storefront lists in USD; what an Argentine person is charged at the in-app paywall (in pesos or
  not) was not observed.
- **Not audited as feature competitors:** Mercado Pago's own app, Ualá and the other Argentine incumbents; they are
  integration targets here, and an owner may want a separate read of them later.
- **Contradictions inside vendors' own sources** are recorded where found (Kesef's free-versus-Pro export, Piggy's Pro
  Max absent from the store, Wallet's lifetime cheaper than its three-year plan, YNAB's 30- versus 34-day trial) and
  left unresolved.
- **The Mercado Pago empirical test** (§7.2, step 3) was not run; it is the gate's next action, and it is the owner's.

## 3. Capability matrix

### 3.1 Capture

| Capability | FinanzApp | Kesef | MonAi | Copilot | Monarch | YNAB | Wallet | Piggy | Finy | Splitwise | MoneyCoach |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Manual entry | **IMPLEMENTED** | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● |
| Voice capture | **ACTIVE ROADMAP** · 25A (last slice) | ● | ● | ? | ? | ◐ | ○ | ◐ | ● | ? | ● |
| Several movements in one utterance | **LAUNCH CANDIDATE** · 25A (§8) | ● | ● | ? | ? | ○ | ○ | ? | ◐ | ? | ? |
| AI categorisation | **ACTIVE ROADMAP** · 25A (suggestion), 25C / 25C2 (local rules) | ◐ | ● | ● | ● | ◐ | ● | ● | ● | ○ | ● |
| Apple Pay / Wallet Shortcut capture | **ACTIVE ROADMAP** · 25A2 | ● | ● | ◐ | ◐ | ◐ | ● | ● | ? | ○ | ● |
| Dynamic Island / Live Activity | **RESEARCH GATE** · 25A2 | ○ | ? | ? | ? | ? | ? | ? | ? | ? | ● |
| WhatsApp / messaging capture | **RESEARCH GATE** · 25E (§8) | ○ | ● | ? | ○ | ○ | ○ | ● | ? | ○ | ○ |
| Widgets (Home, Lock Screen) | **ACTIVE ROADMAP** · 25D | ◐ | ◐ | ◐ | ◐ | ● | ? | ◐ | ● | ? | ● |
| Quick Actions (icon long-press) | **LAUNCH CANDIDATE** · 25D (§6) | ● | ? | ? | ◐ | ● | ? | ? | ● | ? | ● |
| Shortcuts, App Intents, integrations | **ACTIVE ROADMAP** · 25A2 (capture intent), 25D (Siri, Spotlight, Action Button) | ● | ● | ◐ | ◐ | ● | ● | ● | ◐ | ◐ | ● |

Notes.
- **Voice.** Kesef and MonAi send audio or its transcription to a cloud provider (Groq for Kesef; Apple's speech framework on the device then MonAi's backend and OpenAI for MonAi); MonAi saves voice entries *without* confirmation unless the person opts out. FinanzApp's rule is the opposite and already decided: every utterance ends in a draft the person confirms (AGENTS rule 12). MoneyCoach's voice is Siri with App Intents, which asks follow-ups and confirms. Piggy accepts voice notes only through WhatsApp.
- **Apple Pay capture.** Kesef, MonAi, Wallet, Piggy and MoneyCoach all use the same mechanism FinanzApp plans for 25A2: the person's own Shortcuts automation on the Wallet «Transaction» trigger calling the app's Shortcut action with amount and merchant (MonAi: tap-to-pay at a terminal only; MoneyCoach maps card to account, merchant to payee). Copilot, Monarch and YNAB instead sync Apple Card, Apple Cash and Savings as accounts (FinanceKit-style, US and UK only). Nobody claims to read Wallet history.
- **Dynamic Island.** Only MoneyCoach ships a Live Activity (since 8.1, 2022: the amount just added shows in the island and on the Lock Screen; long-press expands to compare the category with the previous period). Evidence that an indie app can ship the surface; FinanzApp's gate is different and stricter: Confirmar from the island on the one write path (production-plan §8.3).
- **WhatsApp.** MonAi (1.10.0, pairing code, a daily counter) and Piggy (an official number through a provider, text, voice notes, receipt photos, PDF statements and CSV, drafts reviewed in the app) have it; Kesef does not. §8.3.
- **Widgets and Quick Actions.** Kesef (2.0.0), YNAB, Finy and MoneyCoach have Home Screen widgets and icon Quick Actions; Lock Screen widgets are documented only by MoneyCoach and YNAB. Copilot hides its widgets when Face ID lock is on. FinanzApp: widgets in 25D with amounts hidden by default; Quick Actions proposed for 25D (§6).


### 3.2 Organisation

| Capability | FinanzApp | Kesef | MonAi | Copilot | Monarch | YNAB | Wallet | Piggy | Finy | Splitwise | MoneyCoach |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Categories | **IMPLEMENTED** | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● |
| Custom categories | **IMPLEMENTED** | ● | ● | ● | ● | ● | ◐ | ● | ● | ? | ● |
| Tags | **ACTIVE ROADMAP** · 25C | ● | ● | ● | ● | ◐ | ● | ? | ? | ○ | ● |
| Subcategories | **POST-LAUNCH** (§6) | ○ | ? | ◐ | ◐ | ◐ | ● | ? | ? | ? | ● |
| Search | **IMPLEMENTED** (saved searches: 25C) | ? | ● | ● | ● | ● | ● | ? | ◐ | ◐ | ● |
| Filters | **IMPLEMENTED** (type) · **ACTIVE ROADMAP** 25C (account, category, period) | ● | ◐ | ● | ● | ● | ● | ◐ | ● | ◐ | ● |
| Merchant intelligence (normalisation, marks, rules) | **IMPLEMENTED** (normalisation, catalogue) · **ACTIVE ROADMAP** 25C / 25C2 (rules), 25C2 (marks) | ◐ | ◐ | ● | ● | ◐ | ◐ | ◐ | ? | ○ | ◐ |
| Notes | **IMPLEMENTED** (transfers, debts) · **ACTIVE ROADMAP** 25C (expenses, incomes) | ● | ◐ | ◐ | ● | ● | ● | ● | ? | ● | ● |
| Attachments, receipts | **POST-LAUNCH** (§6) | ○ | ◐ | ? | ● | ● | ● | ◐ | ◐ | ◐ | ● |

Notes.
- **Tags, not subcategories.** Kesef (three free), MonAi (hashtags), Copilot, Monarch, Wallet (five labels) and MoneyCoach have tags; YNAB has one coloured flag. Two-level categories exist in Copilot, Monarch and YNAB (groups), Wallet and MoneyCoach (real subcategories); Kesef and MonAi point people to tags, which is FinanzApp's 25C answer (§6).
- **Merchant intelligence.** The bank-sync apps normalise merchant names from statements and apply rules (Copilot: exact or partial match rules rewriting past and future; Monarch: rules on the original statement text). FinanzApp already normalises typed merchants by exact alias without rewriting the record (24UX2) and plans rules that only pre-fill (25C2); nobody documents a logo source freely usable, which is why marks stay a 25C2 gate.
- **Notes and attachments.** Everyone has a note or memo; FinanzApp has it on transfers and debts and adds it to expenses and incomes in 25C. Attachments (Monarch up to three images, YNAB one photo, Wallet and MoneyCoach receipts, Splitwise Pro OCR) are post-launch here (§6).
- **Search.** FinanzApp's search reads merchant, stored and localised category and account; Monarch and MoneyCoach search notes too (25C adds notes). Splitwise gates search behind Pro.


### 3.3 Spending and money

| Capability | FinanzApp | Kesef | MonAi | Copilot | Monarch | YNAB | Wallet | Piggy | Finy | Splitwise | MoneyCoach |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Accounts | **IMPLEMENTED** | ◐ | ○ | ● | ● | ● | ● | ● | ● | ○ | ● |
| Credit cards | **IMPLEMENTED** | ? | ○ | ● | ● | ● | ● | ● | ◐ | ○ | ● |
| Statement cycles (closing, due) | **IMPLEMENTED** | ○ | ○ | ○ | ◐ | ○ | ◐ | ● | ○ | ○ | ● |
| Instalments (cuotas) | **IMPLEMENTED** | ◐ | ? | ◐ | ○ | ? | ○ | ● | ● | ○ | ○ |
| Refunds (devoluciones) | **IMPLEMENTED** | ? | ? | ◐ | ◐ | ● | ◐ | ? | ? | ◐ | ● |
| Early instalment payoff | **IMPLEMENTED** (full payoff; a partial advance is recorded as deferred) | ○ | ? | ○ | ○ | ? | ○ | ● | ? | ○ | ○ |
| Recurring expenses | **IMPLEMENTED** | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● |
| Subscriptions | **IMPLEMENTED** (as recurring rules) · **LAUNCH CANDIDATE** 25C2 (subscriptions view, §6) | ◐ | ◐ | ● | ● | ◐ | ◐ | ● | ◐ | ○ | ● |
| Debts and receivables | **IMPLEMENTED** | ◐ | ? | ◐ | ◐ | ◐ | ◐ | ◐ | ◐ | ● | ◐ |
| Several currencies | **IMPLEMENTED** | ● | ● | ○ | ○ | ○ | ● | ● | ● | ● | ● |
| FX semantics (stored original vs converted; rate) | **IMPLEMENTED** (original currency kept; conversion only in views, at each movement's own date) · 24C2 optional | ● | ◐ | ○ | ○ | ○ | ◐ | ◐ | ◐ | ◐ | ◐ |
| Cash flow | **IMPLEMENTED** (month net flow) · 25C2 (calendar) | ◐ | ◐ | ● | ● | ◐ | ● | ◐ | ◐ | ◐ | ● |
| Future commitments | **IMPLEMENTED** (30-day window, forecast) · 25C2 (calendar), 25D (reminders) | ◐ | ◐ | ● | ● | ● | ● | ● | ◐ | ◐ | ● |

Notes.
- **Cards, cycles, cuotas, refunds, payoff: the field is thin.** no official Kesef page describes a card entity (a review asks that card spending not be deducted from the balance; a developer reply hints at something, so it is unverified) and spreads a cuota as an N-month recurrence; MonAi has neither accounts nor cards; Copilot has no statement concept and no instalment object (a purchase can be split over 3, 6 or 12 months); Monarch pulls statement balances and due dates through a US credit-report service; YNAB pairs each card with a payment category; Wallet has a due day only; Splitwise none. **Piggy** is the only one with FinanzApp's shape: per-card closing and due day, purchases allocated to the cycle by closing date, cuotas with the first in the current period and the rest scheduled, an early cancellation that settles the remaining cuotas in the current month, the statement payment as a transfer. **MoneyCoach** has opening and due dates per card with reminders. Refunds: Copilot and YNAB record a refund as an inflow in the original category; Wallet records it as income (and marks a reimbursement feature «in progress»); nobody links it to the purchase and nets it in the purchase's month and category as FinanzApp does (24T3). This is where FinanzApp already exceeds every product in the set.
- **FX semantics.** Kesef stores each movement in the currency it was paid in and freezes a conversion taken at entry, never recalculated (its multicurrency page; Mercado Pago imports convert at that day's rate); MonAi converts at entry into the list's base currency; Copilot receives USD already converted by the data provider; MoneyCoach stores in the account's currency and converts totals with a live rate the person may override; Wallet keeps one currency per account with rates refreshed overnight; Piggy and Splitwise keep the original currency (Splitwise Pro's one-shot conversion rewrites every expense, a destructive re-rate). FinanzApp keeps every amount in its account's currency for ever and converts only in views, each movement at the published rate of its own date, with unknown shown as unknown (currency.md §2.8). **Not changed.**
- **Debts and receivables.** Only FinanzApp, Splitwise (IOUs as its core) and Wallet on Android model a personal debt in both directions; Kesef and Piggy have them only as group balances; Copilot, Monarch and YNAB have loan accounts; MoneyCoach records lent money as an expense with the person as payee. FinanzApp's debt moving only by transfers, never mixed with a card, is decision 003.
- **Subscriptions and commitments.** Copilot, Monarch, Piggy and MoneyCoach have a subscriptions surface (paid versus left to pay, annualised cost, cancellation links, pre-due reminders); Wallet and YNAB handle them as planned or scheduled transactions; FinanzApp has recurring rules, a 30-day window on Inicio and the Recurrentes forecast, and proposes a subscriptions view for 25C2 (§6).


### 3.4 Budgeting and planning

| Capability | FinanzApp | Kesef | MonAi | Copilot | Monarch | YNAB | Wallet | Piggy | Finy | Splitwise | MoneyCoach |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Total budget | **IMPLEMENTED** | ? | ? | ● | ● | ● | ◐ | ○ | ◐ | ○ | ◐ |
| Category budgets | **IMPLEMENTED** | ● | ● | ● | ● | ● | ● | ● | ● | ○ | ● |
| Goals | **ACTIVE ROADMAP** · 25C | ○ | ? | ● | ● | ● | ◐ | ◐ | ● | ○ | ● |
| Flexible / fixed, rollover | **ACTIVE ROADMAP** · 25C (rollover) | ◐ | ◐ | ● | ● | ● | ◐ | ○ | ? | ○ | ● |
| Pay-cycle periods | **LAUNCH CANDIDATE** · 25C (§6) | ○ | ● | ? | ○ | ○ | ◐ | ○ | ◐ | ○ | ● |
| Calendar | **ACTIVE ROADMAP** · 25C2 | ○ | ? | ? | ● | ○ | ◐ | ? | ? | ○ | ● |
| Projections | **IMPLEMENTED** (commitments) · **LAUNCH CANDIDATE** (spending pace, §6) | ● | ? | ◐ | ◐ | ◐ | ● | ● | ◐ | ○ | ◐ |
| Reminders | **ACTIVE ROADMAP** · 25D | ● | ◐ | ◐ | ● | ◐ | ● | ● | ● | ◐ | ● |

Notes.
- **Total budget.** Copilot's single monthly spending line with rollover, Monarch's cash-flow budget, YNAB's zero-based plan; Kesef and MonAi have category budgets only. FinanzApp has both the general monthly budget and category sublimits per currency (never converted), with warning and exceeded states on Inicio.
- **Rollover and goals.** Copilot (per category, cumulative), Monarch (formula rollover), YNAB (always rolls forward), MoneyCoach (toggle per category) have rollover; FinanzApp's 25C has it as explicit and reversible. Goals exist in Copilot, Monarch, YNAB, Finy and MoneyCoach (pace, deadline, per-goal currency); Wallet's are Android-only; Kesef and MonAi have none. FinanzApp's 25C goals compute progress from recorded movements only, no simulated returns.
- **Pay-cycle periods.** MonAi (weekly, biweekly, quincena, custom start day), MoneyCoach (payday settings, 12.0), Wallet on Android (initial day of the month); Copilot, Kesef and YNAB are calendar-month only. FinanzApp: a 25C candidate (§6).
- **Calendar and projections.** MoneyCoach and Monarch have a calendar with daily totals and upcoming bills; Wallet has a recurring-payments calendar widget. Projections: Kesef Pro's end-of-month balance, Wallet's forecasted spend per budget, MoneyCoach's remaining-for-period pace, Monarch Plus's full forecasting; YNAB is philosophically against forecasting. FinanzApp: the calendar is 25C2 (four kinds never blurred); a pace estimate is an owner decision (§6).
- **Reminders.** Bill-due and card reminders in Monarch, Wallet, Piggy, Finy and MoneyCoach; Kesef's is a daily logging reminder tied to streaks; Copilot has no bill-due reminders. FinanzApp's 25D families and the «a date reached is never a payment made» wording are decided.


### 3.5 Reporting

| Capability | FinanzApp | Kesef | MonAi | Copilot | Monarch | YNAB | Wallet | Piggy | Finy | Splitwise | MoneyCoach |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| By category | **IMPLEMENTED** | ● | ● | ● | ● | ● | ● | ● | ● | ◐ | ● |
| Daily | **IMPLEMENTED** | ◐ | ◐ | ◐ | ● | ○ | ◐ | ● | ? | ○ | ◐ |
| Trends | **IMPLEMENTED** (six months) | ◐ | ◐ | ● | ● | ● | ● | ◐ | ● | ◐ | ● |
| Comparisons | **IMPLEMENTED** (month vs previous) | ● | ◐ | ● | ◐ | ◐ | ● | ● | ● | ? | ● |
| By merchant | **IMPLEMENTED** (top five) · 25C2 | ○ | ? | ◐ | ● | ◐ | ? | ◐ | ? | ○ | ● |
| Subscriptions report | **LAUNCH CANDIDATE** · 25C2 (§6) | ◐ | ? | ◐ | ◐ | ○ | ◐ | ● | ? | ○ | ● |
| Calendar report | **ACTIVE ROADMAP** · 25C2 | ○ | ? | ? | ◐ | ○ | ◐ | ? | ? | ○ | ● |
| Custom ranges | **ACTIVE ROADMAP** · 25C | ? | ● | ◐ | ● | ● | ● | ? | ● | ○ | ● |
| AI reports | **ACTIVE ROADMAP** · 25A (grounded, §8) | ◐ | ● | ◐ | ● | ○ | ◐ | ◐ | ● | ○ | ◐ |
| Explain / query in natural language | **ACTIVE ROADMAP** · 25A | ● | ● | ◐ | ● | ○ | ◐ | ● | ● | ○ | ● |

Notes.
- **Breadth.** Monarch (Sankey, treemap, trend bars, merchant pages, saved reports), Copilot (cash flow with presets, category history), Wallet (period-over-period cards) and MoneyCoach (category insights, payees, subscriptions, calendar, yearly projection) are the deep reporting products; Kesef, MonAi, Finy and Piggy are lighter. FinanzApp's Reportes (categories with the period total in the donut, day by day, six-month trend, previous-month comparison on equal elapsed days, top merchants, insights, net flow) sit between the two groups, with one rule none of them states: every chart, list and budget adds up to the same displayed total, and a devolución nets in its month without a negative slice.
- **Custom ranges and comparisons.** Custom ranges are common (MonAi, Monarch, YNAB web, Wallet, Finy, MoneyCoach); FinanzApp adds them in 25C. Explicit period comparisons are rarer than they look: Copilot overlays the previous equal period; Wallet shows percentage change; Monarch and YNAB compare only through trend bars or the assistant.
- **AI reports and questions.** MonAi's AI Reports (a question returns a report with numbers; Claude models; the list is uploaded), Finy's monthly advisor (a story of last month and one action), Copilot's Money Assistant (approval-gated edits, charts in chat), Monarch's assistant and weekly recap, Kesef's chat (2.2.0), MoneyCoach's on-device Apple Intelligence; Piggy and Wallet delegate questions to external assistants through a read-only MCP server. FinanzApp's design is stricter than all of them (production-plan §5.2: the device computes, the model cites fact ids; no tool writes); Copilot's «edits only after approval» is the closest in spirit.


### 3.6 Collaboration

| Capability | FinanzApp | Kesef | MonAi | Copilot | Monarch | YNAB | Wallet | Piggy | Finy | Splitwise | MoneyCoach |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Split expenses | **LAUNCH CANDIDATE** · 25C (local split, §9) | ● | ◐ | ○ | ◐ | ◐ | ◐ | ● | ● | ● | ? |
| Equal | **LAUNCH CANDIDATE** · 25C (§9) | ● | ● | ○ | ○ | ◐ | ◐ | ● | ? | ● | ? |
| Percentages | **LAUNCH CANDIDATE** · 25C (§9) | ● | ○ | ○ | ◐ | ○ | ◐ | ● | ? | ● | ? |
| Shares | **LAUNCH CANDIDATE** · 25C (§9) | ● | ○ | ○ | ○ | ○ | ◐ | ○ | ? | ● | ? |
| Exact amounts | **LAUNCH CANDIDATE** · 25C (§9) | ● | ○ | ○ | ◐ | ◐ | ◐ | ● | ? | ● | ? |
| Groups | **POST-LAUNCH** unless promoted (§9) | ● | ◐ | ○ | ○ | ◐ | ◐ | ◐ | ● | ● | ○ |
| Invitations, people without an account | **LAUNCH CANDIDATE** (placeholder people, 25C) · **POST-LAUNCH** (invitations) | ● | ◐ | ○ | ○ | ○ | ◐ | ● | ◐ | ● | ○ |
| Household / partner | **POST-LAUNCH** (§9) | ◐ | ● | ◐ | ● | ● | ● | ◐ | ● | ◐ | ● |
| Debt simplification | **POST-LAUNCH** (§9) | ● | ? | ○ | ○ | ○ | ◐ | ○ | ? | ● | ? |

Notes.
- **Two different things share the word «split».** Copilot, Monarch and YNAB split one transaction across *categories* (equal parts, amounts, percentages, or across months), never between people. Splitwise, Kesef, Piggy and, lightly, MonAi and Finy split between *people*. §9 keeps them apart.
- **The own-share rule.** Kesef and Piggy state it (only the person's share is their expense; the rest is a receivable); Splitwise has no personal ledger; Copilot's and Monarch's workaround is to net a partner's reimbursement into the original category. FinanzApp's rule is in §9.2.
- **People without an account.** Kesef (name first, claim later), Piggy (phone contacts who never install the app, WhatsApp summaries as reminders), Splitwise (placeholder friends, web only), MonAi and Finy (the other person must install the app). Household ledgers (Monarch, YNAB Together up to six, MoneyCoach Family Sync, Wallet group sharing with per-account permissions) are a different model from splitting and stay post-launch here.


### 3.7 Automation

| Capability | FinanzApp | Kesef | MonAi | Copilot | Monarch | YNAB | Wallet | Piggy | Finy | Splitwise | MoneyCoach |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Apple Pay capture | **ACTIVE ROADMAP** · 25A2 | ● | ● | ◐ | ◐ | ◐ | ● | ● | ? | ○ | ● |
| Mercado Pago | **RESEARCH GATE** · 25E (§7) | ● | ○ | ○ | ○ | ○ | ? | ● | ● | ○ | ○ |
| Bank sync | **RESEARCH GATE** · 25E (§11) | ○ | ○ | ● | ● | ● | ● | ○ | ○ | ◐ | ● |
| Imports | **ACTIVE ROADMAP** · 25C | ● | ◐ | ○ | ● | ● | ● | ● | ● | ○ | ● |
| CSV | **ACTIVE ROADMAP** · 25C (import) · **LAUNCH CANDIDATE** (export, §6) | ◐ | ● | ◐ | ● | ● | ● | ◐ | ◐ | ◐ | ● |
| Excel | **POST-LAUNCH** (§6) | ● | ○ | ○ | ○ | ○ | ● | ? | ◐ | ◐ | ○ |
| JSON | **IMPLEMENTED** (the backup, v14) | ● | ○ | ○ | ○ | ◐ | ○ | ? | ? | ◐ | ○ |
| Notification automation | **DELIBERATELY EXCLUDED** (§6) | ○ | ● | ◐ | ○ | ? | ◐ | ○ | ◐ | ○ | ○ |
| Recurring detection | **ACTIVE ROADMAP** · 25C2 | ○ | ? | ● | ● | ? | ◐ | ? | ◐ | ○ | ● |

Notes.
- **Mercado Pago.** Kesef (Pro, 2.3.0), Piggy (read-only OAuth, imports the last 30 days then ongoing) and Finy (seven countries, cuotas imported month by month, balance shown) advertise it; MonAi, Copilot, Monarch, YNAB, Splitwise and MoneyCoach do not; Wallet's institution list is visible only in-app after sign-up, so it is unverified. None documents the mechanism; §7 records what the official documentation supports.
- **Bank sync.** Copilot, Monarch (US and Canada through Plaid, Finicity and MX), YNAB (plus Europe), Wallet (its own PSD2 licence, Europe and North America), MoneyCoach (GoCardless, 30 European countries) and Splitwise Pro (US card import) have it; none covers Argentina; Kesef argues against it for LatAm; MonAi rules it out. §11.
- **Imports and exports.** CSV export is near-universal (Kesef, MonAi, Copilot, Monarch, YNAB, Wallet, Finy, Splitwise, MoneyCoach); CSV import with column mapping in Monarch, YNAB, Wallet (web) and MoneyCoach; MonAi imports only its own format; Finy and Piggy import PDF statements through AI with a review step; Kesef imports XLSX. FinanzApp has the JSON backup today, CSV import as reviewed drafts in 25C and CSV export as a candidate (§6).
- **Notification reading.** MonAi and Wallet read payment notifications on Android only; on iOS MonAi falls back to Shortcuts automations over SMS and email, and Finy reads bank emails through its AI. iOS offers no notification-listener API, so this is excluded (§6).
- **Recurring detection.** Copilot and Monarch detect recurring merchants from synced data; MoneyCoach removed its automatic detection in 2026-01 for a user-controlled «repeat» toggle; Wallet claims suggestions; Kesef, MonAi and Finy set rules by hand. FinanzApp's 25C2 detection proposes a rule the person confirms.


### 3.8 Privacy and platform

| Capability | FinanzApp | Kesef | MonAi | Copilot | Monarch | YNAB | Wallet | Piggy | Finy | Splitwise | MoneyCoach |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Local-first | **IMPLEMENTED** | ● | ◐ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ◐ |
| Account required | **IMPLEMENTED** (none; never for the local core) | ○ | ◐ | ● | ● | ● | ● | ● | ● | ● | ○ |
| Cloud sync | **ACTIVE ROADMAP** · 25E (owner decision whether) | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● |
| iCloud / CloudKit | **RESEARCH GATE** · 26 (backup inclusion), 25E (CloudKit as a sync engine, §6) | ○ | ● | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ● |
| Face ID | **ACTIVE ROADMAP** · 25D | ● | ● | ● | ? | ● | ● | ● | ● | ◐ | ● |
| Hidden amounts | **LAUNCH CANDIDATE** · beside 25D (contract decided, placement open) | ○ | ? | ? | ◐ | ● | ◐ | ? | ? | ○ | ● |
| Apple Watch | **ACTIVE ROADMAP** · 25D | ○ | ○ | ○ | ○ | ● | ○ | ? | ? | ○ | ● |
| Widgets | **ACTIVE ROADMAP** · 25D | ● | ● | ● | ● | ● | ? | ◐ | ● | ? | ● |
| Accessibility | **IMPLEMENTED** (store-build pass in 26) | ◐ | ? | ◐ | ? | ● | ? | ○ | ? | ? | ◐ |
| Localisation | **IMPLEMENTED** (es, en; 234 regions) · 24R3, 26 | ● | ● | ○ | ◐ | ◐ | ● | ◐ | ◐ | ● | ● |
| Android | **POST-LAUNCH** | ● | ● | ○ | ● | ● | ● | ● | ● | ● | ○ |
| Web | **DELIBERATELY EXCLUDED** (decision 004) | ○ | ○ | ● | ● | ● | ● | ○ | ○ | ● | ○ |

Notes.
- **Local-first is rare.** Kesef (no account, data on the phone, optional sync through its own Supabase backend), MonAi (CloudKit in the person's iCloud, an optional account for AI and WhatsApp, but every AI entry processed by its backend) and MoneyCoach (no login, optional iCloud sync) are the three; Copilot, Monarch, YNAB, Wallet, Piggy, Finy and Splitwise require an account and live in the cloud. FinanzApp requires no account and never will for the local core (production-plan §1).
- **Face ID and hidden amounts.** Face ID locks exist in Kesef, MonAi, Copilot, YNAB, Wallet, Piggy (a biometric sign-in), Finy and MoneyCoach; Splitwise has a passcode; Monarch documents only login MFA. A global hide-amounts mode exists in YNAB (six dots, on the web too) and in Wallet on Android only; MoneyCoach names an «Incognito Mode» without documenting what it hides; Monarch hides amounts on its budget widget. FinanzApp's contract is decided and unplaced (beside 25D).
- **Apple Watch** apps: YNAB and MoneyCoach only (Piggy's is mentioned in old notes only). **Accessibility:** YNAB declares VoiceOver, Voice Control and larger text; MoneyCoach larger text and contrast; Kesef contrast and reduced motion; Copilot states Dynamic Type is unsupported; MonAi, Monarch and Finy declare nothing. FinanzApp's VoiceOver twins, spoken formatters, Reduce Motion and Dynamic Type are implemented and partly device-verified; the store-build pass is 26.
- **Localisation.** Wallet (48 App Store languages) and MoneyCoach (15) are the broad ones; Copilot, Monarch and YNAB are English-only; Kesef, MonAi, Piggy and Finy are Spanish-first. FinanzApp ships Spanish and English with 234 formatting regions and the three-way separation of language, region and storefront (launch §10).


### 3.9 Monetisation

| Capability | FinanzApp | Kesef | MonAi | Copilot | Monarch | YNAB | Wallet | Piggy | Finy | Splitwise | MoneyCoach |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Free tier | **ACTIVE ROADMAP** · 25F | ● | ● | ○ | ○ | ○ | ◐ | ● | ● | ● | ◐ |
| Trial | **ACTIVE ROADMAP** · 25F (owner decision) | ● | ● | ● | ● | ● | ● | ○ | ● | ◐ | ● |
| Monthly | **ACTIVE ROADMAP** · 25F | ● | ● | ● | ● | ● | ◐ | ● | ● | ◐ | ◐ |
| Annual | **ACTIVE ROADMAP** · 25F | ● | ● | ● | ● | ● | ◐ | ● | ● | ◐ | ◐ |
| Lifetime | **LAUNCH CANDIDATE** · 25F (owner decision, §6) | ● | ○ | ○ | ○ | ○ | ● | ○ | ● | ○ | ● |
| Pro boundary | **ACTIVE ROADMAP** · 25F | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● |

Notes.
- **Shapes of pricing.** Subscription-only with no free tier (Copilot, Monarch, YNAB, at USD 95 to 200 a year); freemium with volume caps (MonAi 20 transactions a month; Splitwise four expenses a day; Finy 100 movements, 10 AI queries and 2 scans a month with ads; Piggy six months of history, caps on wallets and automations); freemium with automation and convenience behind Pro (Kesef: Mercado Pago, unlimited voice, tags and budgets, insights, exports; MoneyCoach: category budgets, multi-currency, credit cards, sync and bank sync; Wallet: bank sync, unlimited accounts, export). Lifetime prices: Kesef 99.99, Finy 99.99, MoneyCoach 179.99 to 199.99, Wallet 24.99 to 29.99, Settle Up per group.
- **Metered AI.** Finy and MonAi price AI by monthly quotas (queries, scans, credits); Copilot and Monarch include it in the subscription as a beta. FinanzApp's rule (launch §1.2): the Assistant is the one capability with a real marginal cost and the natural Pro boundary, with the allowance and the quota set from measured costs; data safety, recovery and privacy are never behind the paywall. The trend confirms the plan.


### 3.10 Future finance

| Capability | FinanzApp | Kesef | MonAi | Copilot | Monarch | YNAB | Wallet | Piggy | Finy | Splitwise | MoneyCoach |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Savings goals | **ACTIVE ROADMAP** · 25C | ○ | ? | ● | ● | ● | ◐ | ◐ | ● | ○ | ● |
| Investments | **POST-LAUNCH** | ○ | ? | ● | ● | ◐ | ● | ◐ | ○ | ○ | ○ |
| Net worth | **POST-LAUNCH** | ○ | ? | ● | ● | ● | ● | ◐ | ? | ○ | ● |
| Loans | **IMPLEMENTED** (personal debts) · **POST-LAUNCH** (amortising loans) | ○ | ? | ● | ● | ● | ◐ | ○ | ○ | ◐ | ◐ |
| Assets | **POST-LAUNCH** | ○ | ? | ● | ● | ◐ | ◐ | ○ | ? | ○ | ? |

Notes.
- Investments, net worth, loans and assets are the all-in-one products' territory (Copilot, Monarch, Wallet, with property and vehicle valuations through Zillow and VinAudit in the US); MoneyCoach has net worth and a yearly projection; YNAB tracks assets by manual balance; Kesef, MonAi, Finy and Splitwise have none; Piggy values crypto wallets at market quotes. FinanzApp stays expense-first (§11.3).


## 4. The brief's Kesef and MonAi claims, verified

Each claim the owner's brief attributed to a competitor was checked against the product's current App Store listing,
version history and official site on 2026-10-02. «Verified» means a primary source says it; «partly» means the source
says something narrower; «not found» means no primary source mentions it.

| Claim | Kesef | Source read |
| --- | --- | --- |
| Voice with several movements in one utterance | Verified: 1.2.0 (2026-03-30) and the listing describe one phrase becoming several categorised expenses; voice is Pro with a trial. Audio and the person's category names go to a transcription service (the privacy policy names Groq). | App Store AR/US listing and version history; getkesef.app privacy |
| Tags | Verified (1.2.0): three tags free, unlimited in Pro. | Listing; site pricing |
| Streaks | Verified: a daily logging reminder tied to streaks (at most once a day). | Listing; site |
| Group expense splitting | Verified (2.1.0, 2026-09-07): equal, percentage, shares, exact; invite by link or eight-character code; people added by name before they join; debt simplification; only the person's share counts in their own ledger. Groups are free. | Listing; site FAQ and the Splitwise comparison page |
| Multi-currency | Verified: a currency per movement (55+ on the listing, 150+ on the site), a display currency for totals; rates from DolarApp. The multicurrency page states that every movement is stored in the currency it was paid in and that the conversion is taken at the moment of entry and frozen, never recalculated; Mercado Pago imports convert at that day's rate. FinanzApp instead converts only in views at each movement's dated rate (§5.3). | Listing; site multimoneda page |
| Budgets | Partly: per-category monthly budgets (three free, unlimited in Pro) with alerts; a total budget is not described; no rollover. | Site; listing |
| Reports | Verified as «insights» (basic free, detailed Pro: weekly, monthly, yearly groupings, comparisons, an end-of-month projection) and a home chart by category; no merchant report, no calendar. | Site; listing |
| Recurring and subscriptions | Verified: recurring expenses and incomes, free and unlimited; subscriptions are recurring expenses with brand logos; no subscriptions manager. | Site; listing |
| Import and export | Verified with a contradiction: XLSX import from other apps and a JSON backup (free); CSV, JSON and XLSX export (the homepage says free, the FAQ says Pro). | Site homepage, pricing and FAQ |
| Reminders | Verified for the daily logging reminder and group nudges; no bill-due reminders. | Site |
| Shortcuts | Verified (2.0.0): «Integración con Atajos»; which intents are exposed is not documented. | Version history |
| Widgets | Verified (2.0.0) for Home Screen widgets; Lock Screen widgets not mentioned. | Version history |
| Quick Actions | Verified (2.0.0, more in 2.4.0). | Version history |
| AI chat | Verified (2.2.0, 2026-09-15): a chat module over the person's data; provider, limits and Pro gating not documented. | Version history |
| Mercado Pago | Verified as a Pro feature (2.3.0, 2026-09-23): authorisation on Mercado Pago's page, read-only, payments visible 10–30 minutes later, optional 30- or 90-day backfill, seven countries. The mechanism is not documented and the privacy policy does not mention Mercado Pago (§7). | Site integrations page; listing |
| Face ID | Verified (2.3.0): Face ID, fingerprint or passcode lock on open and after a minute in the background. | Version history |
| Apple Pay Shortcut capture | Verified (2.4.0): a Shortcuts automation on Apple Pay transactions logs amount, merchant and date; a Transaction automation, not Wallet access. | Version history |

| Claim | MonAi | Source read |
| --- | --- | --- |
| Voice capture | Verified: Apple's speech framework transcribes on the device, the text goes to MonAi's backend and OpenAI for interpretation; since 1.8.3 voice entries save without confirmation unless the person opts out. | Site FAQ; version history; privacy policy |
| AI categorisation and splitting one utterance | Verified: one sentence with two purchases becomes two transactions; server-side categorisation that learns from corrections. | Site FAQ; listing |
| iCloud and local privacy direction | Partly: data in the person's own iCloud (CloudKit) with no developer server for basic use; an optional MonAi Account (Appwrite, Frankfurt) is required for AI Reports, WhatsApp and reliable sharing, and every voice, text or WhatsApp entry is processed by the backend and OpenAI. | Site FAQ; privacy policy |
| AI reports grounded in numbers | Verified (1.10.0): «AI Reports», a plain-language question returns a report with the numbers; uses Anthropic Claude Haiku 4.5 (Sonnet in thorough mode); the list's transactions, budgets and tags are uploaded; needs an account and AI credits. | Version history; privacy policy; site |
| WhatsApp text and voice capture | Verified (1.10.0): the person starts the link from Settings with a MonAi Account; a pairing code ties their WhatsApp identity; text or voice note becomes a transaction; a daily message counter exists. The bot's number and the tier that includes it were not found. | Version history; privacy policy |
| FX conversion | Verified as conversion at entry into the list's base currency (the «Currency Converter» since 1.6.7, automatic since 1.10). Whether the original amount stays visible, the rate source and whether the rate is historical were not found. | Version history; site FAQ |
| Apple Pay Shortcut automation | Verified: a guided setup installs a Shortcuts automation that logs a tap-to-pay transaction at a terminal (not online purchases), in the background with a fallback and pending state; categorisation uses the merchant and, since 1.8.5, the card. | Site; version history |
| Budgets and widgets | Verified: category budgets since 1.8.1 with progress, remaining-while-entering, overspend notifications and widgets; no total budget; a global rollover. | Version history; site |
| CSV and recurring import and export | Verified: CSV import and export of MonAi's own format, recurring transactions included since 1.10. | Version history; site FAQ |
| Configurable pay and reporting periods | Verified (1.9.0, 2026-07-09): weekly, biweekly, semimonthly («quincena») and monthly with a custom start day, plus custom ranges. | Version history |

## 5. Feature-gap map

Read with the matrix above. «Exceeds» means FinanzApp's implemented behaviour is stricter, more complete or more
faithful to the money than any product in the set; «gap» means several relevant products offer it and FinanzApp does
not yet (with where it lands); «parity planned» means the roadmap already covers it.

### 5.1 Where FinanzApp already exceeds the set

- **Credit cards as accounts with the eight invariants** (decision 003): one expense per purchase, the payment a transfer, «Saldo pendiente», no debit-card ledger; exact closing and due dates per statement, current versus future balances, the Tarjetas deck. Only Piggy and MoneyCoach model cards and cycles at all; neither pins the invariants.
- **Instalments as a finite plan** recognised instalment by instalment, never the full price up front; the adelanto that recognises the remaining instalments once on its date with the card payment a separate transfer; «Dejar de seguir» and «Reactivar». Kesef spreads a cuota as a recurrence; Copilot splits over months; Piggy settles remaining cuotas in the current month; nobody separates recognised principal from the payment.
- **Refunds that net** in the purchase's month and category, capped at the price, reversing recognised principal first on a plan, never an income; every reader nets without a negative slice. Copilot, YNAB and Wallet record a refund as an inflow or an income.
- **The original-currency ledger** with conversion only in views at each movement's own published rate, unknown shown as unknown, every aggregate the integer sum of once-rounded movements. Kesef freezes an entry-time conversion, MonAi converts at entry, Copilot receives converted values; MoneyCoach converts with a live rate.
- **No account for the core, ever**, and a review store that freezes one write id per draft so an interruption never writes twice; MoneyCoach and MonAi are the only local-first peers, and MonAi saves AI entries without confirmation.
- **Personal debts and receivables** moving only by transfers, never mixed with a card; Kesef and Piggy have them only inside groups.
- **Reports that add up**: one displayed total that every chart, row and budget sums to; the previous-month comparison on equal elapsed days with explicit guards. The deep reporting products do not state this rule.
- **Language, region and storefront kept apart**, with VoiceOver that never reads a region-formatted number; only Wallet and MoneyCoach localise broadly, and the US products are English-only.

### 5.2 Major gaps, with where each lands

| Gap | Who has it | FinanzApp |
| --- | --- | --- |
| Voice capture, and several movements in one utterance | Kesef, MonAi (both), Finy, MoneyCoach (Siri) | 25A, last slice; the multi-draft contract a 25A decision (§8.1) |
| Apple Pay Shortcut capture | Kesef, MonAi, Wallet, Piggy, MoneyCoach | 25A2 (already placed) |
| Live Activity on capture | MoneyCoach | 25A2 proof-of-concept gate |
| Tags, advanced filters, saved searches, custom ranges, notes on expenses | most of the set | 25C (already placed) |
| Pay-cycle periods | MonAi, MoneyCoach, Wallet (Android) | 25C candidate (§6) |
| Goals, rollover | Copilot, Monarch, YNAB, Finy, MoneyCoach | 25C (already placed) |
| Calendar of commitments; subscriptions view; recurring detection | Monarch, MoneyCoach, Piggy, Copilot | 25C2 (calendar and detection placed; subscriptions view a candidate, §6) |
| Face ID, hidden amounts, reminders, widgets, Quick Actions, Siri, Watch | YNAB, MoneyCoach, Kesef, Wallet, Copilot, Monarch | 25D (placed; Quick Actions a candidate; hide amounts beside 25D) |
| Split expenses between people with the own-share rule | Kesef, Piggy, Splitwise | 25C candidate for the local half (§9.3); groups post-launch |
| WhatsApp capture | MonAi, Piggy | 25E research gate (§8.3) |
| Mercado Pago sync | Kesef, Piggy, Finy | 25E research gate (§7); the person's export through the 25C importer meanwhile |
| Bank sync | the US and European products | 25E research gate; nothing covers Argentina compliantly (§11) |
| CSV export | nearly everyone | 25C candidate (§6) |
| Cloud sync, household sharing | the cloud products | 25E (sync, owner decision); household post-launch |
| Lifetime price | Kesef, Finy, MoneyCoach, Wallet | 25F owner decision |
| Attachments, subcategories, Excel, investments, net worth, assets | the all-in-one products | post-launch |

### 5.3 What the set does and FinanzApp deliberately does not

- Save an AI-captured movement without confirmation (MonAi's default). Every capture is a draft (AGENTS rule 12).
- Freeze a conversion at the moment of entry (Kesef), convert at entry into a base currency (MonAi) or receive amounts already converted by a data provider (Copilot). The ledger keeps the original currency and converts only in views at the movement's dated rate (currency.md §1, §2.8).
- Spread a cuota as a recurring expense (Kesef) or settle remaining cuotas as spending (Piggy). A plan is a finite obligation tied to one purchase (decision 003).
- Record a refund as income (Wallet) or as an inflow category line (Copilot, YNAB). A devolución is a purchase operation (24T3).
- Require an account to use the app (Copilot, Monarch, YNAB, Wallet, Piggy, Finy, Splitwise). Never for the local core.
- Read payment notifications (MonAi and Wallet on Android) or share bank credentials with a scraping aggregator. Excluded (§6, §11).
- Rewrite history with a one-shot currency conversion (Splitwise Pro). Excluded.
- Re-rate, round twice or sum across currencies without a dated rate in any report. Excluded (AGENTS rule 8).

## 6. Capabilities the roadmap had not considered: decisions and gates

The repository inventory found these capabilities mentioned nowhere in the roadmap, the decisions or the plans. Each
gets a classification here so it is never «forgotten» or «assumed»; every placement is a proposal for the owner unless
it follows from an existing rule.

| Capability | Classification | Placement and reasoning | What binds it |
| --- | --- | --- | --- |
| Several movements in one utterance or message | **LAUNCH CANDIDATE** | 25A, as a contract v2 decision (§8.1). | One draft → one write; each draft its own review item and Confirmar. |
| WhatsApp / messaging capture | **RESEARCH GATE** | 25E, optional cloud capture producer (§8.3). | Draft-first; pairing; consent naming Meta and the transcription provider; the inbox's quotas and dedupe. |
| Mercado Pago consumer sync | **RESEARCH GATE** | 25E (§7); the person's own export through the 25C importer as the compliant stand-in. | §7.3. |
| Quick Actions (icon long-press) | **LAUNCH CANDIDATE** | 25D, with the broader App Intents: three static actions (Gasto, Ingreso, Asistente) that open the capture hub or the Assistant; a few lines of native configuration, no new screen. | Opens a form or a draft, never writes (decision 005; AGENTS rule 12). |
| Subcategories | **POST-LAUNCH** | Kesef and MonAi point people to tags instead; 25C's tags and the existing budget sublimits cover the need without a category hierarchy, which would change category identity, budgets, reports and the Assistant's category matching. Revisit after launch only with evidence that tags were not enough. | Category identity (merchant-identity.md §1); schema and backup versions. |
| Attachments / receipts | **POST-LAUNCH** | Splitwise and Wallet offer it; MonAi reads a receipt through a Shortcut and OCR rather than storing it. Storing images changes the backup's size and the data-protection decision of 25D (production-plan §11.3). A photo → draft Shortcut on the capture path would be the cheaper first step if ever wanted. | Data protection; backups; nothing leaves the device without consent. |
| Pay-cycle periods (custom month start, quincena, weekly) | **LAUNCH CANDIDATE** | 25C, beside custom ranges and saved searches: a preference for the Home and Reportes period (calendar month, custom start day, semimonthly, weekly), with the month staying the budget's period until budgets are redesigned. MonAi ships it (1.9.1); Argentine salaries are monthly but many people think in quincenas. | A card's statement cycle is a different concept and never confused with a budget period (decision 003); a period change never rewrites a movement. |
| Spending-pace projection («a este ritmo…») | **LAUNCH CANDIDATE** | Owner decision; Kesef (Pro) and Copilot show one. It is an estimate from recorded movements, labelled as such, never a claim; Reportes' composition is frozen (decision 005, 24UX6D), so it needs an amendment or a place in the day-by-day view. | No simulated value presented as fact; per currency. |
| Subscriptions view | **LAUNCH CANDIDATE** | 25C2 with the suggested recurring detection: one list of the active recurring expenses that look like subscriptions (merchant, amount, next date, yearly cost), read from the rules; Copilot, Monarch and Wallet have one; Kesef answers it through chat. Not a new record type. | A subscription is a recurring rule, never an instalment plan; a scheduled payment is never a movement. |
| AI-generated reports | **ACTIVE ROADMAP** | 25A's READ class (§8.2). | production-plan §5.2. |
| Split modes, groups, invitations, household, simplification | **LAUNCH CANDIDATE / POST-LAUNCH** | §9.3. | §9.2. |
| Notification-based automation (reading bank or payment notifications) | **DELIBERATELY EXCLUDED** | iOS gives a third-party app no way to read another app's notifications; MonAi does it on Android only and on iOS falls back to Shortcuts automations over SMS and email. FinanzApp's equivalents are the Wallet capture (25A2) and, later, Shortcuts that hand text to the Assistant (25D). Android, when it exists, would need its own decision. | AGENTS rule 12 (no arbitrary history reads); draft-first. |
| CSV export | **LAUNCH CANDIDATE** | 25C beside CSV import: a plain export of movements (date, type, account, merchant, category, amount, currency, note) in the person's region's separators. Kesef, MonAi, Copilot, Wallet and MoneyCoach export CSV; data safety and the way out are never behind a paywall (launch §1.1), so it stays free. | The JSON backup remains the recovery format; a CSV is a reading, never a backup. |
| Excel (XLSX) | **POST-LAUNCH** | Kesef imports XLSX and exports a three-sheet workbook; CSV opens in Excel and Numbers and needs no dependency. Revisit only if asked. | — |
| CloudKit as a sync engine | **RESEARCH GATE** | 25E: MonAi stores data in the person's own iCloud with no developer server, which is the privacy story closest to FinanzApp's; 25E specifies Supabase for sync and identity. Whether CloudKit (no account of ours, no server cost, Apple's privacy posture, but no Android and weaker conflict tooling) is a better engine for the one-person multi-device case is a research question for 25E, not a decision here. | Operation ids, conflict handling, deletion records (AGENTS rule 9) whichever engine. |
| Lifetime price | **LAUNCH CANDIDATE** | 25F owner decision: Kesef (USD 99.99), Wallet, MoneyCoach, Finy («Pro para siempre») and Settle Up sell one; it conflicts with a Pro whose main cost is per-request AI unless the lifetime tier excludes or caps AI. | Measured costs before any price (roadmap 25F). |
| Amortising loans, mortgages; assets (property, vehicles); investments; net worth | **POST-LAUNCH** | §11.3; Copilot, Monarch and Wallet have them, the expense-first products do not. | Decision 002. |

## 7. Mercado Pago Consumer Sync — RESEARCH GATE

**Status: RESEARCH GATE, OWNER DECISION, NOT IMPLEMENTED.** Nothing in the repository mentions Mercado Pago as a data
source today (it appears only as a merchant brand alias in [merchant-identity.md](merchant-identity.md)). Kesef
advertises a read-only Mercado Pago connection (§4); **that does not mean the same access is available to FinanzApp**,
and the official developer documentation, read on 2026-10-02, does not confirm it. Placement if it ever passes the
gate: **25E** (the integration gate, beside bank connections and the optional cloud capture producers), never earlier.

### 7.1 What the official documentation says

Read on 2026-10-02 from the Mercado Pago developer sites (Argentina, with the Brazil, Mexico and Peru mirrors where the
Argentine page answered 404); the URLs are in §13.

| Area | Verified on an official page | What it means for a consumer feed |
| --- | --- | --- |
| OAuth 2.0 | Authorization Code (redirect, optional PKCE S256, `state`), Refresh Token and Client Credentials grants; the token endpoint takes `client_id`, `client_secret`, `grant_type`, `code`, `redirect_uri`, `code_verifier`, `refresh_token`, `test_token`; the `redirect_uri` must be static HTTPS. Scopes are only `read`, `write` and `offline_access` (set per application in the Developer Panel, all on by default); no finer scope such as movements, balance or transfers exists. Every OAuth page defines the access token as **an authorization granted by a seller** to a client application over **the seller's protected resources**; no page says whether a personal (consumer) account may authorise an application, and none describes a consumer-data scope. A dedicated scopes page answered 404. | The grant is designed for merchants. A personal account may be able to complete the flow (unverified), but nothing documents what its token then reaches. |
| Tokens and security | The authorization code lasts ten minutes and is single-use; an access token from the authorization-code grant lasts 180 days; the refresh token lasts six months, needs `offline_access`, and **rotates on every renewal** (the new one must be stored); client-credential tokens last six hours. Tokens die on expiry, on the seller changing their password, on the seller revoking the application from their account (all grants deleted), on fraud-prevention credential updates, on session clean-up and on deleting the application; there is no public revoke endpoint, and the `mp-connect` webhook topic reports when a seller authorises or deauthorises the application (the pages name no action strings). The access token and the client secret are **private backend keys**: never in a public parameter, never in client code, sent only as a Bearer header; the public key alone belongs in a frontend. PCI: both parties are responsible; integrators never store card data. The developer terms (cl. 7.2) forbid robots, harvesters, spiders, scraping, storing card data and capturing user credentials; cl. 10 asks for ISO 27001 / 27552 alignment and PCI-DSS or an annual SAQ; cl. 15 lets Mercado Pago revoke access at any time without cause. | Confirms the architectural rule of §7.3: the token and the client secret live on the FinanzApp backend only; nothing of them in the app bundle or a Shortcut. Credential capture (asking for the person's Mercado Pago password) is prohibited outright. PKCE is optional and «recommended», S256 «where possible» (the creation page). |
| Webhooks | Topics: `orders` / `order`, `payment`, `subscription_authorized_payment`, `subscription_preapproval`, `subscription_preapproval_plan`, `mp-connect`, `wallet_connect`, `stop_delivery_op_wh`, `topic_claims_integration_wh`, `topic_card_id_wh`, `topic_merchant_order_wh` / `merchant_order`, `topic_chargebacks_wh`, `point_integration_wh`. Configured per application; signed with an `x-signature` header and an application secret. | **No topic covers money sent or received by a consumer wallet** (no transfer, movement, balance or yield topic). `wallet_connect` carries the agreement events of a wallet linked to an integrator (its own webhooks page: «notifies the integrator when a user confirms the link»); Wallet Connect payments arrive under `payment`. Whether a `payment` notification fires for an authorised user who is the payer is not stated anywhere. |
| Payments search (`GET /v1/payments/search`) | «Returns the payments made in the last twelve months from the date of the query», with `collector.id` and `payer.id` among the filters; the reference never says whose payments a token sees. The Argentine reference page answered 404; the Peru and Brazil mirrors were read. | That it lists a **collector's** payments is an inference from the rest of the documentation, not a stated fact. Whether a personal account's token returns the payments it *made* is documented nowhere and tested by no source read. |
| Reports (`/v1/account/settlement_report`, «Todas las transacciones»; `/v1/account/release_report`, «Liberaciones») | Asynchronous CSV / XLSX reports over the account's money, scheduled or on demand, each covering at most 60 days of data, dates selected in UTC through the API and displayed in a configurable zone; documented transaction types `SETTLEMENT`, `REFUND`, `CHARGEBACK`, `DISPUTE`, `WITHDRAWAL`, `CASHBACK` and their shipping variants. Described for merchants and reconciliation. | No documented type for a purchase made as a buyer, a transfer sent or received, or yields («rendimientos»). Whether a personal account can generate it is not stated. **Unofficial, single-account evidence** (an open-source project using its owner's own production token, not OAuth) reports that a personal account's «Todas las transacciones» report *does* contain the person's own outgoing QR, card, direct-debit and subscription payments as negative settlement rows, transfers to other Mercado Pago accounts, inflows from the person's bank, daily yields, and transfers to other banks as `PAYOUTS` rows (a type absent from the official list), with only the recipient names of transfers to other banks missing; and that `GET /v1/payments/{id}` returns the payments the account made as payer. It also reports that a movements-search endpoint and `/v1/payouts/{id}` answer 403 to ordinary applications. |
| Account balance | A legacy `/users/{id}/mercadopago_account/balance` endpoint is reported by third parties as «Public access not allowed»; it is not in the current documentation. | Not available. |
| Wallet Connect | A buyer links their wallet to an integrator so the integrator can charge it; needs prior contact with Mercado Pago, a Mercado Pago user account and an application with credentials. | A payment product, not a data-access product. |
| Partner programmes | The Partners / Developer Program certifies agencies and developers who integrate checkouts and plugins for sellers; there is no open-finance, consumer-data or aggregation track on the developer site. | No partner route to a consumer feed is documented. |
| The person's own exports | The help centre documents the «Resumen de cuenta» (Tu dinero → Consultar más movimientos → Generar Resumen de cuenta, or Informes → Reportes de conciliación contable), generated manually per closed period with an email or push when ready; a personal-data export under privacy rights (Tu perfil → Privacidad); and the «Todas las transacciones» CSV / XLSX from the account's web. The file format of the Resumen is not named on the help page (secondary sources say PDF, CSV or Excel). | **This is the one compliant path available today**: the person exports their own activity and FinanzApp imports it as reviewed drafts (25C's CSV importer). |
| Argentina's open-finance regime | Decreto 353/2025 created the Sistema de Finanzas Abiertas with the BCRA as authority; data recipients are entities registered with the BCRA; the BCRA's 2026 objectives say it will form technical working groups during 2026; no technical standard, consent mechanic, participant registry or Comunicación «A» exists as of 2026-10-02 (§11.2). | No regulatory route obliges Mercado Pago to expose consumer movements to an unregulated app, and none is scheduled. |

**Conclusion.** A compliant consumer personal-wallet movement feed **cannot be confirmed** from the official
documentation. Everything Mercado Pago documents for third parties is merchant-side; the one precedent that reports
payer-side rows in a personal account's own report is unofficial, single-account and obtained with the owner's own
token rather than through OAuth, and nothing tests `payments/search` in the payer role. Kesef's shipped integration
(hosted authorisation on Mercado Pago's page, «your password never passes through Kesef», read-only, imports QR
payments, purchases paid with Mercado Pago and transfers sent and received, each new payment visible 10–30 minutes
later, an optional 30- or 90-day backfill, seven countries, Pro only) shows that *something* works in practice for
personal accounts, but neither Kesef nor Mercado Pago documents the mechanism, Kesef's privacy policy does not mention
Mercado Pago, and the one open-source precedent found uses the owner's own production token plus a manually exported
«Resumen de cuenta» only for the recipient names of transfers to other banks. The most likely reading (an inference, not a fact): the
Authorization Code flow with a personal account, the token held on Kesef's server, then polling or reports. It rests on
undocumented behaviour that Mercado Pago may change or revoke under its terms.

### 7.2 What closes the gate

In this order, each recorded in the roadmap entry that runs it; none of them is scheduled by this document:

1. **OWNER DECISION** whether a Mercado Pago connection is wanted at all, given that it needs a backend holding
   long-lived tokens for each person (a new class of sensitive server state, with retention, deletion and breach
   obligations under the developer terms cl. 6 and Ley 25.326), and given that the same value is reachable sooner by
   the person's own export plus the 25C importer.
2. **OWNER ACTION, REMOTE SETUP:** a Mercado Pago application created by the owner in their own developer panel, in a
   staging configuration, with test accounts; never from a commit.
3. **RESEARCH GATE, the empirical test:** with a real personal account the owner controls, does the Authorization Code
   flow complete for a personal account; under that **OAuth** token (not the owner's own application token), do the
   «Todas las transacciones» report and `GET /v1/payments/{id}` return **payer-side** movements (QR payments, card
   purchases, direct debits, transfers in and out, yields), with which fields, which latency and which gaps; and,
   separately, does `GET /v1/payments/search` return anything in the payer role? The result is written down with the
   raw field list, as 25A2 does for the Wallet trigger. A positive result still rests on undocumented behaviour that
   Mercado Pago may change or revoke (developer terms cl. 15).
4. **A written compliance read** of the developer terms against the use (an app acting for a consumer rather than a
   merchant) and of the data-processing obligations, with professional advice where the owner wants it; a contact with
   Mercado Pago's partner or commercial team if the terms are ambiguous for this use.
5. Only then an architecture slice under 25E, bound by §7.3.

### 7.3 Target architecture, if official and compliant access exists

```
Mercado Pago authorisation (OAuth Authorization Code with PKCE, on Mercado Pago's own page)
  → FinanzApp backend (holds the token and the client secret; never the app bundle, never a Shortcut)
  → event (webhook, if a topic ever covers it) or authorised periodic sync (reports or search), deduplicated by
    Mercado Pago's own ids
  → ReviewDraft (packages/domain/review-drafts.ts): amount, currency, merchant or counterpart, date, the mapped
    FinanzApp account; a gap for anything missing, never a guess
  → the review tray (25A-03), through the remote capture inbox (`/api/mobile/captures`) as the durable hand-over
  → optional alert that a movement awaits review (a 25D review alert, or a Live Activity if 25A2 proves one)
  → the person's explicit Confirmar
  → the local ledger, one write per draft
```

Rules that bind this path, all already decided for every external source (AGENTS rule 12; roadmap 25D «FinanceKit and
external financial transactions»; production-plan §5.3):

- **Never** remote event → silent ledger write. A Mercado Pago movement is a draft until the person confirms it.
- **Never** a Mercado Pago access token, refresh token or client secret in the mobile bundle, in a Shortcut, in a URL
  or in a log. The app talks to the FinanzApp backend with its own session; the backend talks to Mercado Pago.
- **Explicit mapping:** the person chooses which FinanzApp account a Mercado Pago account money balance maps to, once,
  editable; a Mercado Pago card purchase maps to the FinanzApp card the person chooses; a currency never identifies a
  destination.
- **Instalments are never assumed** from a Mercado Pago purchase; the draft is an ordinary purchase the person can
  turn into a plan with the count they choose.
- **Deduplication** by Mercado Pago's own payment or movement id, never by a fuzzy match; a repeated delivery is
  acknowledged, never written twice (the capture inbox's 200-on-repeat and 409-on-conflict contract).
- **Transfers between the person's own accounts** (bank ↔ Mercado Pago) become transfer drafts, never an expense and
  an income; the person confirms the other side.
- **Original currency kept.** A movement in another currency keeps its currency; nothing is converted on import.
- **Revocation** from the Mercado Pago account (the `mp-connect` deauthorised event) stops the sync and deletes the
  token; the drafts already in the tray stay the person's.
- **The notification** that a movement awaits review is a product decision for later: a local or remote notification
  or a Live Activity are candidates; none is chosen here.
- Manual capture, the Wallet capture of 25A2 and the person's own export remain complete without any of this.

### 7.4 What can be offered before the gate

- **The person's own Mercado Pago export** (Resumen de cuenta or «Todas las transacciones») imported through the 25C
  CSV importer as reviewed drafts, with a mapping template for Mercado Pago's columns once a real file has been read
  (the exact columns are not documented publicly; the owner's own export is the fixture). **LAUNCH CANDIDATE** inside
  25C, no backend, no token, no terms-of-use exposure.
- **The Wallet capture (25A2)** already covers Apple Pay purchases made with a Mercado Pago card added to Wallet, on
  the device, if the trigger supplies them (a 25A2 research gate).

## 8. Voice, messaging and grounded reports

### 8.1 Voice capture → 25A

Already placed: 25A's last slice, «voice last, after the text path is proven on the iPhone», with a transcription
provider of proven multilingual coverage, explicit microphone permission, limits and deletion, and every utterance
ending in a draft (roadmap «Producto 25A», Scope and Slices). What the landscape adds:

- **Several movements in one utterance** («pagué 30 en el super y 12 de estacionamiento») is what Kesef and MonAi
  advertise and what a person says naturally. The current wire contract and the review store are one draft per item.
  **LAUNCH CANDIDATE inside 25A, owner decision:** the Assistant's contract v2 may return a *list* of drafts for one
  message, each becoming its own review item with its own write id and its own Confirmar (never a batch write); the
  tray shows them together, and a person can confirm one and discard another. This changes no invariant: one draft
  still produces exactly one write. It needs the contract change before the first paid slice, so the decision is
  cheaper now than later. Recommended: yes, in 25A's contract v2 (server first).
- **The voice path is the text path.** Transcription produces text; the same parser, gaps and tray apply. No
  separate voice-only logic, no on-device «voice to ledger».
- **Free or Pro** for voice stays the 25F owner decision (launch §1.2).

### 8.2 Grounded AI reports → 25A

MonAi advertises AI reports «grounded in numbers» and an AI chat; Copilot and Monarch offer assistants over synced
data. FinanzApp's rule is stricter and already decided (production-plan §5.2): the model may only restate facts the
device computed and cited. A «report» is therefore a presentation of the READ class, not a new capability: the device
computes the period's facts (totals, categories, merchants, comparison, budgets, commitments) and the model writes
prose that cites them, every number linkable to its fact. **ACTIVE ROADMAP · 25A** as part of the explain capability;
whether a periodic «resumen del mes» surface exists in Reportes is an owner decision for after the text path works,
and it never replaces the deterministic insights («Para tener en cuenta») that exist today.

### 8.3 WhatsApp / messaging capture → optional cloud capture producer, RESEARCH GATE in 25E

MonAi and the Argentine apps (Piggy, Finy; §4) accept expenses sent by WhatsApp text or voice note. Nothing in the
repository mentions messaging as a capture channel. Evaluation:

```
WhatsApp text / voice note
  → the WhatsApp Business Platform (Cloud API) webhook on the FinanzApp backend
  → authenticated mapping of the sender's phone number to a FinanzApp person (a pairing the person completes
    in the app, revocable; never a phone number typed by a stranger)
  → transcription (voice) and the same parser as the Assistant
  → ReviewDraft → the remote capture inbox (`/api/mobile/captures`) → the review tray (25A-03)
  → the person's Confirmar → the local ledger
```

What makes it a research gate rather than a plan: it needs a Meta business account, a verified business phone number,
the WhatsApp Business Platform terms and per-conversation pricing (facts to be read when it is considered; none were
read for this document), server-side handling of a person's messages (retention, deletion, consent naming Meta and the
transcription provider), a pairing flow, abuse limits (the inbox already has per-user and global quotas), and the
Assistant's cloud consent. It depends on 25A's inbox consumer and session, so it cannot precede 25E. It never writes
the ledger on its own, and the same message arriving twice is one draft (the inbox's stable request id). **Placement:
25E, with Mercado Pago and bank connections, as an optional cloud capture producer; OWNER DECISION whether it is
worth a Meta business relationship at all.** Alternatives that need no Meta relationship and are already planned: the
iOS share sheet into the capture hub (a Shortcut or share extension that hands text to the Assistant, 25D's broader
App Intents), and Siri.

## 9. Shared expenses: a real product candidate

Kesef (groups since its 2.0.0 of 2026-08), Splitwise, Tricount and Settle Up define the pattern; Monarch and Copilot do
not split between people, they share one ledger or net reimbursements into a category. Nothing in the repository
specifies a split model: 25C's scope has the three words «split expenses and free tags». This section records the
candidate so it is not forgotten, with the domain rules it would have to respect. **Nothing is implemented, and no
schema, screen or sync is designed here.**

### 9.1 The patterns (research of 2026-10-02, sources in §13)

| Pattern | What the products do |
| --- | --- |
| Split modes | Equal (default everywhere); exact amounts (must sum to the total); percentages (sum to 100); shares or weights (an integer weight per person; Settle Up also keeps a persistent per-member weight so a couple counts as two); Splitwise adds an adjustment mode (fixed plus or minus for some, the rest equal) and itemised splits with tax and tip, receipt scanning being the paid part; Kesef offers equal, percentage, shares and exact, with a per-group default any expense overrides. Several payers for one expense exist in Splitwise and Settle Up. |
| Rounding | Tricount is the only one that publishes a rule: minor-unit precision, 100 / 3 = 33.34 + 33.33 + 33.33, one participant absorbs the remainder. Splitwise's own export notes admit cent drift when balances are rounded separately. |
| People without an account | The norm: Tricount names participants before anyone installs the app and a joiner picks who they are; Settle Up members are names and a link or QR lets a person claim one; Kesef adds a person by name, logs expenses for them and lets them claim the spot later with full history; Splitwise's placeholder friends are web-only and get no reminders. |
| Invitations | A link plus a short code (Kesef, eight characters), a link or QR (Settle Up), a share link (Tricount), email or phone (Splitwise). Joining is free everywhere. |
| Groups | Trip, home, couple; a group currency; an activity feed; recurring group expenses; archive when settled (Kesef closes a group when everyone is square). |
| Debt simplification | All four describe the same thing: take each member's net balance per currency and propose the fewest transfers so every balance reaches zero without changing any net balance; a per-group toggle in Splitwise and Settle Up; none publishes the algorithm (the descriptions match the classic greedy largest-debtor-to-largest-creditor matching, at most n − 1 transfers). Splitwise warns that turning it off after real payments «unravels» the suggested paths. |
| Currencies inside a group | Two models: separate balances per currency with an optional one-shot conversion of every expense at today's rate (Splitwise Pro; destructive); or a group base currency with the expense kept in its own currency and a dated rate at entry, editable (Tricount, Settle Up, Kesef). |
| The person's own share | Only Kesef states the rule a personal-finance app needs: only the person's share of a group expense appears in their transactions, summary and insights; what they paid for others never inflates their totals; the group never sees their personal ledger. Copilot's recommended workaround (recategorise the reimbursement into the original category so the category nets out) is the symptom of lacking the concept. |
| Pricing | Splitwise gates volume (a few free expenses a day) and conversion, itemisation, search and charts behind Pro; Tricount is free without limits (bank-funded); Settle Up sells a personal premium and a per-group, time-boxed premium; Kesef keeps groups and unlimited expenses free and monetises personal features; Monarch and Copilot include household access in one subscription. |

### 9.2 The domain rules FinanzApp would bind it to

These follow from decisions 002 and 003, AGENTS rule 8 and the liabilities domain that exists; they are recorded so a
future delivery starts from them:

- **The person's share is the expense.** Whoever paid, the ledger records the person's own share as the expense, in its
  category and month, consuming budgets. Nothing else of a shared bill is spending.
- **What the person paid for others is a receivable; what others paid for the person is a payable.** Both are
  personal debts per counterparty and per currency (`packages/domain/liabilities.ts` already models a debt in one
  direction with a counterparty), never mixed with a card's balance (decision 003), never income or expense.
  When the person pays the whole bill from an account: the account moves by the total, the expense is the share, the
  rest is a receivable. When someone else pays: no account moves, the expense is the share, a payable is recorded.
- **A settlement is a transfer** between the person's account and the debt, with no category; never an expense, never
  an income (the rule a devolución already follows).
- **Resolved integer shares are the facts.** Percentages, weights and items are editor inputs kept only to re-render
  the editor; the ledger stores minor-unit shares that sum exactly to the total, with the remainder distributed in a
  deterministic order and rounded once per expense (the house pattern of `packages/domain/installments.ts`).
- **Simplification is a derived view** over net balances per currency, never stored; a settlement recorded from a
  suggestion is still one transfer between two people, and the view recomputes.
- **One currency per expense; a group in another currency keeps the original amount and a dated rate**, never a
  silent re-rate (docs/currency.md §1). A one-shot conversion of history is excluded.
- **Local first.** A split expense with placeholder people is complete without any network: the person records their
  share, their receivables and their settlements on the device. Sharing a group with other people is a later, optional
  layer that needs 25E's operation ids, conflict handling and deletion records (AGENTS rule 9) and an account; it is
  never required to split a bill.
- **Confirmation stays explicit.** A member's entry in a shared group becomes a draft in the person's tray, never a
  silent write into their ledger.

### 9.3 Recommended placement

- **LAUNCH CANDIDATE · 25C, the local split:** an expense form option «Compartido» with equal, percentages, shares and
  exact amounts, placeholder people, the person's share as the expense and the rest as receivables in Deudas y cobros,
  settlements as transfers. It needs a schema and backup version (a share record linked to the expense and the debt),
  domain tests for the rounding and the own-share rule, and no server. It fits 25C where the owner already wrote «split
  expenses». **OWNER DECISION** whether it stays in 25C or moves after launch; the landscape's argument for 25C is that
  Kesef, the closest Argentine competitor, leads with it, and that the local half is small once Deudas y cobros exists.
- **POST-LAUNCH unless promoted: groups, invitations, debt simplification across a group, a shared activity feed.** They
  need accounts, sync and a product decision about what a group member may see (never the personal ledger). If 25E's
  sync is built, groups are its first multi-person use; if 25E is not built, groups do not exist.
- **Household / partner shared finances** (one ledger seen by two people, Monarch-style) is a different product
  decision from splitting and stays **POST-LAUNCH**; it conflicts with the single-person isolation 25E's RLS assumes
  and would need its own decision record.

## 10. Brand landscape

The visual identities of the products the owner named and of the base set were read on 2026-10-02 for one purpose:
to know what an original identity must stay away from. The descriptions, the crowded and open territories and the
naming observations are recorded in [brand-brief.md](brand-brief.md) §5 (what to avoid) and feed its §2 (naming
criteria) and §4 (the exploration brief); the sources are in §13 here. Two facts worth repeating in the landscape:
Wise's deep green and Kesef's teal mean the Forest identity must earn its distance with a symbol and a typographic
voice rather than with green; and «Wallet by BudgetBakers» is the cautionary example of a generic name (it collides
with Apple Wallet and Apple's marketing rules forbid Apple trademarks in an app name), which is one more reason the
working name «FinanzApp», a descriptive compound, is not the public brand.

## 11. Bank connections, open finance and investments

### 11.1 Generic bank sync, kept apart from Mercado Pago

**RESEARCH GATE · 25E; nothing implemented, no provider selected.** Roadmap 25E already binds it: «authorised bank
connections only through official, consented access where it exists (open banking APIs or an aggregator with a
contract), read-only, each import a reviewed draft; none exists today and none is implied». The feasibility read of
2026-10-02 (sources in §13):

| Route | What was verified | Argentina |
| --- | --- | --- |
| Belvo | Official API spec lists institutions in Brazil, Colombia and Mexico only; two integration types, `credentials` («Belvo's scraping technology, combined with user credentials») and `openfinance` (Brazil's regulated Open Finance); production needs a paid plan (a Launch plan is listed at USD 1,000 a month). | Not covered. |
| Pluggy | Brazil only: Open Finance Brasil connectors plus credential connectors. | Not covered. |
| Fintoc | Chile and Mexico; the Movements product lists Chilean institutions; credential-based. | Not covered. |
| Finerio Connect | Its own aggregation page shows Mexico and Colombia; directories claim more (unverified). | Not on its own page. |
| Prometeo (Uruguay) | The only aggregator with any evidence of Argentine coverage (a secondary directory: business and corporate accounts); its product and coverage pages answered HTTP 500 and its documentation is password-protected, so the connection model and any consumer coverage could not be read. | Unverified. |
| Plaid, Yapily, TrueLayer | North America and Europe only. | Not covered. |
| Apple FinanceKit | United States (Apple Card, Apple Cash, Savings; iOS 17.4) and United Kingdom (open banking, iOS 18.4) only; needs an organisation-level developer account, a Finance-category App Store app in those markets and a managed entitlement per bundle id; transactions carry a merchant category code, merchant name, amounts and dates. | Not available; stays the 25D research gate for those markets only. |

What binds the decision when it comes: every route that reaches Argentina today is credential-based scraping, and the
wallets' own terms forbid it (Ualá's terms make credentials personal and non-transferable and prohibit using them so a
third party receives information; Mercado Pago's developer terms ban scraping). That conflicts with AGENTS rule 12
(«Bank integrations require official access and user consent») and with decision 001's security target, so **no
credential-sharing aggregator is acceptable whatever its coverage**. The regulated route is Argentina's Sistema de
Finanzas Abiertas (§11.2), which does not exist technically yet. Costs are B2B and sales-led; none offers an indie
tier. Data residency (Ley 25.326 art. 12: the United States is not on Argentina's adequacy list) affects any backend
that would hold Argentine transaction data. The manual, offline core stays complete without bank access (decision
001), and the near-term equivalents are the person's own exports through the 25C importer and the Wallet capture of
25A2.

### 11.2 Argentina's open finance, as of 2026-10-02

Decreto 353/2025 (Boletín Oficial 2025-05-23) created the Sistema de Finanzas Abiertas: people and companies may, by
express consent, share their information with entities of the financial system registered with the BCRA, for credit,
competition and inclusion; the BCRA is the implementing authority. The BCRA's own 2026 objectives document records
2025 meetings with the bank and payment-provider chambers and, for 2026, «technical groups to delineate the necessary
infrastructure». No technical standard, consent mechanism, participant registry, sandbox or Comunicación «A» on the
system was found; press (secondary) expects first tests late 2026 and first products in the first half of 2027, with
mandatory participants being the larger banks and the wallets Mercado Pago, Ualá and Personal Pay. Transferencias 3.0
is the instant-payments and interoperable-QR scheme and grants no third-party data access. Recipients under the decree
are BCRA-registered entities: a plain app is not one, so FinanzApp would need to sit behind a registered participant or
wait for rules that admit non-financial third parties. **RESEARCH GATE, re-read before any 25E decision.**

### 11.3 Investments and net worth stay post-launch

Wallet by BudgetBakers, Monarch and Copilot track investments and net worth; Kesef, MonAi, Piggy, Finy and MoneyCoach
mostly do not. The product's direction is unchanged (decision 002; roadmap «Later notes recorded in 24UX6A»): no
portfolio, market data, quotes or simulated returns; if the owner ever schedules investments, cash leaves an account by
a transfer into an asset account that may be excluded from Disponible while counting in a future net-worth view;
accounts are never called «patrimonio» and the app never claims to know complete net worth. **POST-LAUNCH**, and only
by a new owner decision. FinanzApp is not a brokerage or a market-data product.

## 12. Roadmap mapping, deviations and suggested priority changes

### 12.1 Where each newly surfaced capability lands

The brief's mapping was applied unless repository evidence suggested a cleaner one; every deviation is listed in 12.2.
Nothing here changes the binding order (roadmap §3): 25A → 25A2 → 25C → 25C2 → 25D → 25E → 25F → 26.

| Phase | From the brief | Kept or added here, with the reason |
| --- | --- | --- |
| **25A** | Assistant; grounded AI reports; voice capture | Kept. Added as candidates inside 25A's existing scope: several drafts from one message (§8.1, a contract v2 decision), the «resumen» presentation of the READ class (§8.2). |
| **25A2** | Apple Pay / Wallet Shortcuts; Dynamic Island | Kept (already placed by the owner on 2026-10-02). MoneyCoach's shipped Live Activity on transaction add is evidence that the surface is feasible for an indie app; the proof-of-concept gate of production-plan §8.3 stands. |
| **25C** | tags; advanced filters and search; possibly custom ranges and pay-cycle productivity | Kept (tags, filters, saved searches and custom ranges are already there). Added as candidates: pay-cycle periods (§6), the local split (§9.3), CSV export beside CSV import (§6), the Mercado Pago export template for the importer (§7.4). |
| **25C2** | calendar; merchant and subscription intelligence | Kept (calendar, rules, suggested recurring detection, marks). Added as a candidate: a subscriptions view over the recurring rules and the detected candidates (§6). |
| **25D** | Face ID; hide amounts; notifications; widgets; Quick Actions; broader Apple integration | Kept. Hide amounts stays «beside 25D, placement open» as the owner recorded; Quick Actions added as a candidate (§6). |
| **25E / the integration gate** | Mercado Pago; optional bank and cloud integrations; optional WhatsApp capture; sync | Kept: Mercado Pago (§7), bank connections (§11), WhatsApp (§8.3) are research gates placed here, each an owner decision; sync as written. |
| **25F** | subscription and paywall | Kept. Added: the lifetime price as an owner decision with the evidence of §3 (Kesef, Wallet, MoneyCoach and Finy sell one; MonAi does not; it sits badly with per-request AI cost). |
| **26** | final brand implementation; public name; icon and identity; landing; ASO and launch | Kept; the brand brief defines the work (brand-brief.md); the naming workflow may start earlier because it needs no code. |
| **Post-launch** | shared groups if not promoted earlier; investments and net worth; other large expansions | Kept: groups, invitations and household (§9.3), investments and net worth (§11.3), Android, subcategories, attachments, Excel, amortising loans and assets (§6). |

### 12.2 Deviations from the brief's mapping

- **The local split is proposed for 25C, not post-launch.** The brief lists shared groups under post-launch «if not
  promoted earlier»; the repository already has «split expenses» in 25C's scope and a debts domain, so the half that
  needs no server (the person's share, receivables, settlements, placeholder people) is cheaper there than later, and
  Kesef leads with it in Argentina. Groups, invitations and simplification across a group stay post-launch.
- **Grounded AI reports are not a new capability** but a presentation of 25A's READ class under production-plan §5.2;
  no «AI report» that invents a number is ever possible.
- **Mercado Pago is a research gate under 25E with a compliant stand-in in 25C** (the person's own export through the
  importer), rather than a planned integration anywhere.
- **Hide amounts** is not moved into 25D: the owner's note keeps its placement open beside 25D, and this document
  keeps it there.

### 12.3 Suggested priority changes (owner decisions; none applied)

1. **Decide the multi-draft contract before 25A's server lane** (§8.1): a cheap decision now, an expensive one after
   the first paid slice.
2. **Promote the local split into 25C explicitly** (§9.3), or record that it waits; either way replace the three words
   in 25C's scope with the rules of §9.2 when 25C is planned.
3. **Record pay-cycle periods and the subscriptions view as 25C / 25C2 candidates** (§6): both are the most-cited
   gaps against MonAi, Wallet and the Argentine apps that cost no backend.
4. **Start the naming workflow early** (brand-brief.md §3): it needs no code and its screening takes calendar time.
5. **Do not pursue a Mercado Pago or bank connection before 25E**, and not at all through credential sharing (§7,
   §11); offer the person's own export through the importer instead.
6. **Keep Home as it is.** No capability in this document is added to Inicio for parity; Inicio's composition is the
   owner's (decision 005), and the gaps found live in Reportes, Más, the capture flow or the Assistant.

### 12.4 Open owner decisions

| Decision | Where |
| --- | --- |
| Whether 25A's contract v2 returns several drafts for one message | §8.1 |
| Whether the local split (own share, receivables, placeholder people) goes into 25C or waits | §9.3 |
| Pay-cycle periods and the subscriptions view as 25C / 25C2 candidates, or not | §6 |
| A spending-pace estimate, which needs an amendment to Reportes' frozen composition | §6 |
| Quick Actions and CSV export as 25C / 25D candidates | §6 |
| Whether a Mercado Pago connection is wanted at all, and who runs the empirical test | §7.2 |
| Whether WhatsApp capture is worth a Meta business relationship | §8.3 |
| CloudKit versus Supabase as the one-person sync engine, when 25E is decided | §6 |
| A lifetime price, and whether it excludes or caps AI | §6 |
| When the naming workflow starts, who runs the visual exploration, whether Forest is one territory | brand-brief.md §6 |
| Whether Mercado Pago's app, Ualá and the other incumbents get their own feature audit | §2.1 |

### 12.5 Capability decision register

**Parity is not the launch plan.** A capability a competitor ships is evidence of demand, never a reason to build it
before launch, and nothing here is added to Inicio to match the field (§12.3, item 6; decision 005). The launch rests on
what already differentiates FinanzApp: the trustworthy financial domain, cards with statements and instalments,
commitments, the local-first manual core with no account, Apple-native capture and the controlled Assistant. Everything
else waits for its phase, its gate or its evidence.

One status (the labels at the top of this document) and one home per capability. The priority tier is this document's
suggestion for the owner, not a decision:

- **CORE / LAUNCH**: implemented, or scheduled before 26 in the binding order; the launch depends on it.
- **LAUNCH CANDIDATE**: worth deciding before 26; launches without it if the owner says so.
- **POST-LAUNCH**: after 26, revisited with evidence from real people.
- **RESEARCH**: an open question (platform, legal, provider or device) that is answered before any build.
- **EXPERIMENT**: built only as a measured test with a stated success criterion, after launch and with the consent
  rules of launch §7; never promoted to the roadmap without its evidence ([go-to-market.md](go-to-market.md) §8).

| Group | Capability | Status | Home | Priority |
| --- | --- | --- | --- | --- |
| Capture / AI | Voice as an Assistant input (always ending in drafts the person confirms) | ACTIVE ROADMAP | 25A, last slice (§8.1) | CORE / LAUNCH |
| Capture / AI | Several drafts from one voice or text message | LAUNCH CANDIDATE | 25A contract v2 decision (§8.1) | LAUNCH CANDIDATE |
| Capture / AI | Grounded AI reports (the READ class, cited facts only) | ACTIVE ROADMAP | 25A (§8.2) | CORE / LAUNCH |
| Capture / AI | WhatsApp capture (optional cloud producer of drafts) | RESEARCH GATE | 25E (§8.3) | RESEARCH |
| Data portability | Robust CSV import (previewed drafts, rules that only pre-fill) | ACTIVE ROADMAP | 25C | CORE / LAUNCH |
| Data portability | CSV export, never behind a paywall | LAUNCH CANDIDATE | 25C beside the import (§6) | LAUNCH CANDIDATE |
| Data portability | Excel-friendly export (the CSV in the region's separators and an encoding Excel opens directly) | LAUNCH CANDIDATE | 25C, part of the CSV export | LAUNCH CANDIDATE |
| Data portability | XLSX and further formats | POST-LAUNCH | Only on demand (§6) | POST-LAUNCH |
| Organisation | Tags (never replacing the category) | ACTIVE ROADMAP | 25C | CORE / LAUNCH |
| Organisation | Advanced search (saved searches; notes searchable) | ACTIVE ROADMAP | 25C (today's search is IMPLEMENTED) | CORE / LAUNCH |
| Organisation | Advanced filters (account, category, period, custom period) | ACTIVE ROADMAP | 25C | CORE / LAUNCH |
| Organisation | Notes on expenses and incomes | ACTIVE ROADMAP | 25C | CORE / LAUNCH |
| Organisation | Attachments and receipts | POST-LAUNCH | §6; a photo → draft Shortcut first | POST-LAUNCH |
| Planning | Configurable reporting and pay cycles | LAUNCH CANDIDATE | 25C (§6) | LAUNCH CANDIDATE |
| Planning | Financial calendar | ACTIVE ROADMAP | 25C2 (production-plan §10) | CORE / LAUNCH |
| Planning | Subscription intelligence (suggested recurring detection) | ACTIVE ROADMAP | 25C2 | CORE / LAUNCH |
| Planning | Subscriptions view over the recurring rules | LAUNCH CANDIDATE | 25C2 (§6) | LAUNCH CANDIDATE |
| Planning | Savings goals (progress from recorded movements, no simulated returns) | ACTIVE ROADMAP | 25C | CORE / LAUNCH |
| Planning | Rollover budgets (explicit, reversible) | ACTIVE ROADMAP | 25C | CORE / LAUNCH |
| Platform | Widgets (Home and Lock Screen, amounts hidden by default) | ACTIVE ROADMAP | 25D | CORE / LAUNCH |
| Platform | Quick Actions | LAUNCH CANDIDATE | 25D (§6) | LAUNCH CANDIDATE |
| Platform | Apple Watch (focused capture and read, never a replica) | ACTIVE ROADMAP | 25D, «explicit future surface» | RESEARCH (a separate native target; feasibility and device evidence first) |
| Platform | Face ID | ACTIVE ROADMAP | 25D | CORE / LAUNCH |
| Platform | Hide amounts | LAUNCH CANDIDATE | Beside 25D, placement open | LAUNCH CANDIDATE |
| Integrations | Apple Wallet capture through the person's Shortcuts automation | ACTIVE ROADMAP | 25A2 | CORE / LAUNCH |
| Integrations | Live Activity / Dynamic Island review | RESEARCH GATE | 25A2 proof of concept (production-plan §8.3) | RESEARCH |
| Integrations | Mercado Pago Consumer Sync | RESEARCH GATE | 25E (§7); the person's own export through the 25C importer meanwhile | RESEARCH |
| Integrations | Generic bank sync | RESEARCH GATE | 25E (§11.1) | RESEARCH |
| Integrations | Cloud sync and its engine (Supabase, or an Apple-specific alternative such as CloudKit) | ACTIVE ROADMAP (whether) · RESEARCH GATE (engine) | 25E, its own owner decision (§6) | RESEARCH |
| Social finance | Local expense splitting with own-share accounting (receivables, settlements, placeholder people) | LAUNCH CANDIDATE | Proposed for 25C (§9.3, §12.2) | LAUNCH CANDIDATE |
| Social finance | Groups and households | POST-LAUNCH | §9.3 | POST-LAUNCH |
| Social finance | Participant invitations | POST-LAUNCH | §9.3; needs 25E's identity | POST-LAUNCH |
| Social finance | Debt simplification across a group | POST-LAUNCH | §9.3 | POST-LAUNCH |
| Growth | End-of-day and bill / card reminders (local, opt-in, off by default) | ACTIVE ROADMAP | 25D (production-plan §8) | CORE / LAUNCH |
| Growth | Streaks and check-ins (calmer form: «Semana al día») | POST-LAUNCH | [go-to-market.md](go-to-market.md) §8.2 | EXPERIMENT |
| Growth | Referrals and invitations | POST-LAUNCH | [go-to-market.md](go-to-market.md) §9 | EXPERIMENT |
| Growth | Lifecycle summaries (weekly summary, monthly close) | POST-LAUNCH | [go-to-market.md](go-to-market.md) §8.1 | EXPERIMENT |
| Future | Investments and net worth | POST-LAUNCH | §11.3; decision 002; only if the owner explicitly promotes them | POST-LAUNCH |

## 13. Sources

Every page read on 2026-10-02 and 2026-10-03 (the verification pass), grouped by subject. Pages that answered 404, 403 or 500 are kept in the list with that note where the researcher recorded it, so a reader knows what was not read.

- **Kesef (App Store: "Kesef: Gestor de gastos" on AR storefront, "Kesef: Expense Tracker" on US; Google Play: com.kesef.app)**: https://apps.apple.com/ar/app/kesef-gestor-de-gastos/id6758053806 ; https://apps.apple.com/us/app/kesef-expense-tracker/id6758053806 ; https://play.google.com/store/apps/details?id=com.kesef.app ; https://www.getkesef.app/ ; https://www.getkesef.app/preguntas-frecuentes ; https://www.getkesef.app/privacy ; https://www.getkesef.app/terms ; https://www.getkesef.app/blog ; https://www.getkesef.app/kesef-vs-splitwise ; https://www.getkesef.app/kesef-vs-tricount ; https://www.getkesef.app/blog/controlar-gastos-en-argentina ; https://www.getkesef.app/blog/cargar-gastos-por-voz-cuando-conviene ; https://www.getkesef.app/blog/cuotas-sin-interes ; https://www.getkesef.app/blog/entender-el-resumen-de-la-tarjeta ; https://www.getkesef.app/blog/exportar-tus-gastos ; https://www.getkesef.app/blog/controlar-gastos-sin-conectar-el-banco ; https://www.getkesef.app/blog/gastos-recurrentes
- **Expense Tracker - MonAi (AR storefront title: "Finanzas personales - MonAi")**: https://apps.apple.com/us/app/expense-tracker-monai/id6447112647 ; https://apps.apple.com/ar/app/expense-tracker-monai/id6447112647 ; https://get-monai.app/ ; https://get-monai.app/faq ; https://get-monai.app/whats-new ; https://get-monai.app/terms.html ; https://get-monai.app/impressum.html ; https://get-monai.app/blog ; https://get-monai.app/download ; https://get-monai.app/sitemap.xml ; https://get-monai.app/blog/apple-wallet-automation-expense-tracking ; https://get-monai.app/blog/how-to-make-apple-pay-automatic ; https://get-monai.app/blog/mobile_expense_app_for_travelers ; https://get-monai.app/blog/how-to-automate-expense-tracking ; https://get-monai.app/blog/ai-powered-expense-tracking-that-sticks ; https://play.google.com/store/apps/details?id=app.getmonai.android ; https://www.producthunt.com/products/monai-2
- **Copilot: Track & Budget Money (Copilot Money)**: https://apps.apple.com/us/app/copilot-track-budget-money/id1447330651 ; https://apps.apple.com/us/app/copilot-track-budget-money/id1447330651?see-all=version-history ; https://apps.apple.com/us/app/copilot-track-budget-money/id1447330651?platform=mac ; https://apps.apple.com/ar/app/copilot-track-budget-money/id1447330651 (404) ; https://apps.apple.com/ar/app/id1447330651 (404) ; https://apps.apple.com/ar/app/copilot-track-budget-money/id1447330651?l=es (404) ; https://copilot.money ; https://copilot.money/pricing ; https://www.copilot.money/sign-up ; https://www.copilot.money/dispatch ; https://www.copilot.money/dispatch/beta-introducing-your-money-assistant ; https://copilot.money/privacy-policy/ ; https://help.copilot.money ; https://help.copilot.money/en/ ; https://help.copilot.money/en/collections/12265868-getting-started ; https://help.copilot.money/en/collections/12296785-copilot-account ; https://help.copilot.money/en/collections/3377753-copilot-labs ; https://help.copilot.money/en/collections/10367164-accessibility ; https://help.copilot.money/en/collections/3738578-platforms ; https://help.copilot.money/en/collections/2199953-recurrings ; https://help.copilot.money/en/collections/12508175-goals ; https://help.copilot.money/en/collections/10261166-cash-flow ; https://help.copilot.money/en/collections/3136877-investments ; https://help.copilot.money/en/articles/11780342-copilot-money-for-web ; https://help.copilot.money/en/articles/13157382-web-faq ; https://help.copilot.money/en/articles/6778561-copilot-money-for-macos ; https://help.copilot.money/en/articles/11157550-quick-start-guide ; https://help.copilot.money/en/articles/8182433-copilot-intelligence-for-spending ; https://help.copilot.money/en/articles/10715424-international-currency ; https://help.copilot.money/en/articles/5325255-splitting-transactions ; https://help.copilot.money/en/articles/5944414-exporting-your-transaction-data ; https://help.copilot.money/en/articles/4523792-sharing-your-account-with-a-partner ; https://help.copilot.money/en/articles/9834331-adding-widgets ; https://help.copilot.money/en/articles/10671399-notifications ; https://help.copilot.money/en/articles/11062072-settings-overview ; https://help.copilot.money/en/articles/9554412-transactions-tab-overview ; https://help.copilot.money/en/articles/3790828-budget-rollovers ; https://help.copilot.money/en/articles/4537532-creating-manual-accounts ; https://help.copilot.money/en/articles/10682991-understanding-manual-accounts ; https://help.copilot.money/en/articles/4038706-creating-manual-transactions ; https://help.copilot.money/en/articles/10768078-how-do-you-get-my-financial-data ; https://help.copilot.money/en/articles/5325170-refund-and-reimbursement-transactions ; https://help.copilot.money/en/articles/3971270-transaction-name-rules-for-categorization ; https://help.copilot.money/en/articles/10216528-categories-faq ; https://help.copilot.money/en/articles/3767655-groups-of-categories ; https://help.copilot.money/en/articles/9504513-categories-tab-overview ; https://help.copilot.money/en/articles/6206293-editing-budgets-by-month ; https://help.copilot.money/en/articles/3971267-transaction-types ; https://help.copilot.money/en/articles/9981768-privacy-and-security ; https://help.copilot.money/en/articles/9554370-creative-ways-to-use-tags ; https://help.copilot.money/en/articles/6045480-dashboard-tab-overview ; https://help.copilot.money/en/articles/10684135-account-management-faq ; https://help.copilot.money/en/articles/6213732-accounts-tab-overview ; https://help.copilot.money/en/articles/10310069-credit-utilization ; https://help.copilot.money/en/articles/10760871-tracking-your-car-and-other-physical-assets ; https://help.copilot.money/en/articles/8047816-real-estate-accounts ; https://help.copilot.money/en/articles/9682232-cash-flow-tab-overview ; https://help.copilot.money/en/articles/11139571-goals-faq ; https://help.copilot.money/en/articles/10310024-month-and-year-in-review ; https://help.copilot.money/en/articles/9828946-display-settings-for-vision ; https://help.copilot.money/en/articles/6860727-managing-your-copilot-subscription ; https://help.copilot.money/en/articles/3971255-venmo-integration-faq ; https://help.copilot.money/en/articles/5569639-amazon-integration ; https://help.copilot.money/en/articles/9829510-logging-into-copilot ; https://help.copilot.money/en/articles/5377645-investments-tab-overview ; https://help.copilot.money/en/articles/9778259-recurrings-tab-overview ; https://help.copilot.money/en/articles/3760068-creating-recurrings ; https://help.copilot.money/en/articles/5324776-shared-recurring-expenses ; https://help.copilot.money/en/articles/10244751-recurrings-faq ; https://help.copilot.money/en/articles/9922978-clearing-local-cache-in-copilot ; https://developer.apple.com/articles/copilot-money/
- **Monarch (App Store name: "Monarch: Budget & Track Money"; company Monarch Money, Inc.)**: https://apps.apple.com/us/app/monarch-budget-track-money/id1459319842 ; https://apps.apple.com/ar/app/monarch-budget-track-money/id1459319842 ; https://itunes.apple.com/lookup?id=1459319842&country=us ; https://itunes.apple.com/lookup?id=1459319842&country=ar ; https://itunes.apple.com/lookup?id=1459319842&country=ca ; https://play.google.com/store/apps/details?id=com.monarchmoney.mobile&hl=en&gl=US ; https://www.monarch.com/ ; https://www.monarch.com/download ; https://www.monarch.com/pricing ; https://www.monarch.com/features/tracking ; https://www.monarch.com/features/budgeting ; https://www.monarch.com/features/planning ; https://www.monarch.com/whats-new ; https://www.monarch.com/blog/september-product-update ; https://www.monarch.com/blog/july-product-update ; https://www.monarch.com/canada ; https://help.monarch.com/hc/en-us/articles/19985735202068-Monarch-FAQs ; https://help.monarch.com/hc/en-us/articles/9136169422996-Pricing ; https://help.monarch.com/hc/en-us/articles/48349699981972-Monarch-Plus-Tier ; https://help.monarch.com/hc/en-us/articles/16116906962452-About-Monarch-s-AI-Features ; https://help.monarch.com/hc/en-us/articles/37526856682260-AI-in-Monarch ; https://help.monarch.com/hc/en-us/articles/33707613533972-Understanding-Data-Providers-and-Connections ; https://help.monarch.com/hc/en-us/articles/360048393272-Getting-Started-with-Monarch ; https://help.monarch.com/hc/en-us/articles/360048393552-International-Accounts-and-Currency ; https://help.monarch.com/hc/en-us/articles/8611706513684-Using-Mobile-Widgets ; https://help.monarch.com/hc/en-us/articles/20926382202004-Monarch-for-Couples-and-Households ; https://help.monarch.com/hc/en-us/articles/42228648365076-Shared-Views-in-Monarch ; https://help.monarch.com/hc/en-us/articles/4890751141908-Tracking-Recurring-Expenses-and-Bills ; https://help.monarch.com/hc/en-us/articles/360058441811-Creating-Manual-Transactions ; https://help.monarch.com/hc/en-us/articles/15526600975764-Downloading-Transaction-or-Account-History ; https://help.monarch.com/hc/en-us/articles/4409682789908-Importing-Transactions-Manually ; https://help.monarch.com/hc/en-us/articles/360048883631-Creating-Your-Budget-in-Monarch ; https://help.monarch.com/hc/en-us/articles/4411119762196-Rollover-Budgets ; https://help.monarch.com/hc/en-us/articles/4404739126548-Tracking-your-property-vehicles-and-valuables ; https://help.monarch.com/hc/en-us/articles/44244210547860-Importing-Receipts-into-Monarch ; https://help.monarch.com/hc/en-us/articles/360048393372-Transaction-Rules ; https://help.monarch.com/hc/en-us/articles/360056422791-Adding-Notes-and-Attachments-to-a-Transaction ; https://help.monarch.com/hc/en-us/articles/360048883771-Creating-Custom-Categories-and-Groups ; https://help.monarch.com/hc/en-us/articles/48344305092244-Forecasting-in-Monarch ; https://help.monarch.com/hc/en-us/articles/41855507661076-Investments-in-Monarch ; https://help.monarch.com/hc/en-us/articles/44373110771860-Introducing-Goals-3-0 ; https://help.monarch.com/hc/en-us/articles/44373293932052-Using-Pay-Down-Goals ; https://help.monarch.com/hc/en-us/articles/4409690120596-Organizing-Transactions-with-Tags ; https://help.monarch.com/hc/en-us/articles/5528707082516-Reviewing-Transactions ; https://help.monarch.com/hc/en-us/articles/36463599367188-Using-the-Retail-Sync-Extension ; https://help.monarch.com/hc/en-us/articles/21846787088916-Using-Reports ; https://help.monarch.com/hc/en-us/articles/20504904768020-Cash-Flow ; https://help.monarch.com/hc/en-us/articles/29446697869076-Getting-Started-with-Bill-Sync ; https://help.monarch.com/hc/en-us/articles/29446751546516-Connecting-to-Spinwheel ; https://help.monarch.com/hc/en-us/articles/24178098173076-Syncing-Your-Apple-Card-Cash-and-Savings ; https://help.monarch.com/hc/en-us/articles/38610714553108-CommandK-Search-Bar-and-Shortcuts ; https://help.monarch.com/hc/en-us/articles/4402543752468-Monthly-Progress-Report ; https://help.monarch.com/hc/en-us/articles/360048393572-Privacy-and-Security ; https://help.monarch.com/hc/en-us/articles/360048393292-Transfers-and-Credit-Card-Payments ; https://help.monarch.com/hc/en-us/articles/4407859794580-Hiding-an-Account ; https://help.monarch.com/hc/en-us/sections/32460956885780-Sign-in-Security ; https://help.monarch.com/hc/en-us/search?query=Face%20ID ; https://help.monarch.com/hc/en-us/search?query=Splitwise ; https://help.monarch.com/hc/en-us/search?query=voice ; https://help.monarch.com/hc/en-us/search?query=Apple%20Watch
- **YNAB (You Need A Budget)**: https://apps.apple.com/us/app/ynab/id1010865877 ; https://apps.apple.com/ar/app/ynab/id1010865877 ; https://apps.apple.com/us/app/ynab/id1010865877?see-all=version-history ; https://www.ynab.com/ ; https://www.ynab.com/pricing ; https://www.ynab.com/features ; https://www.ynab.com/features/subscription-sharing ; https://www.ynab.com/our-app-lineup ; https://www.ynab.com/release-notes ; https://www.ynab.com/whats-new ; https://www.ynab.com/whats-new/meet-card-mode-transactions-meant-to-be-swiped ; https://www.ynab.com/whats-new/give-your-priorities-a-reset ; https://www.ynab.com/whats-new/file-based-import-elevated ; https://www.ynab.com/whats-new/categorization-that-matches-your-habits ; https://www.ynab.com/whats-new/credit-card-payments-have-met-their-match ; https://www.ynab.com/whats-new/show-your-plan-hide-the-amounts ; https://www.ynab.com/whats-new/the-clearest-way-to-enter-transactions ; https://api.ynab.com/ ; https://support.ynab.com/sitemap.xml ; https://support.ynab.com/en_us/shortcuts-on-ios-a-guide-Bk_lHa5Aq ; https://support.ynab.com/en_us/ynab-widget-for-mobile-a-guide-HJPEEQYR9 ; https://support.ynab.com/en_us/how-to-add-transactions-in-ynab-HyDwA_byi ; https://support.ynab.com/en_us/how-to-enable-and-disable-touch-id-face-id-and-app-lock-SyjrFNtR5 ; https://support.ynab.com/en_us/using-multiple-currencies-in-ynab-a-guide-SyBF6PHno ; https://support.ynab.com/en_us/direct-import-in-europe-Syae1z_A9 ; https://support.ynab.com/en_us/how-direct-import-works-H1IGYLgnxl ; https://support.ynab.com/en_us/apple-connections-rkShEfrUh ; https://support.ynab.com/en_us/apple-third-party-H1gE_0CRyg ; https://support.ynab.com/en_us/how-to-export-plan-data-Sy_CouWA9 ; https://support.ynab.com/en_us/how-to-export-reflection-data-Bykou09 ; https://support.ynab.com/en_us/file-based-import-a-guide-Bkj4Sszyo ; https://support.ynab.com/en_us/account-types-an-overview-BkmGM0qCq ; https://support.ynab.com/en_us/credit-card-activity-an-overview-Sk2mLluA9 ; https://support.ynab.com/en_us/loan-accounts-a-guide-HkNSkPHJi ; https://support.ynab.com/en_us/tracking-investment-accounts-a-guide-r1Bzjxd05 ; https://support.ynab.com/en_us/managing-shared-credit-cards-a-guide-Hkm6ob_Cq ; https://support.ynab.com/en_us/scheduled-transactions-a-guide-BygrAIFA9 ; https://support.ynab.com/en_us/split-transactions-a-guide-SJLEKwY0q ; https://support.ynab.com/en_us/splitwise-and-ynab-a-guide-H1GwOyuCq ; https://support.ynab.com/en_us/flags-a-guide-Skh8Xb4kj ; https://support.ynab.com/en_us/searching-transactions-a-guide-r1gxyQryj ; https://support.ynab.com/en_us/hide-amounts-ry0jgLaOJg ; https://support.ynab.com/en_us/reflect-in-ynab-B1GJsrWkj ; https://support.ynab.com/en_us/spending-breakdown-H1H7YxmD0 ; https://support.ynab.com/en_us/spending-trends-H1inlhzAc ; https://support.ynab.com/en_us/income-v-expense-Byu1BYWRq ; https://support.ynab.com/en_us/net-worth-BkwQO5WA5 ; https://support.ynab.com/en_us/age-of-money-H1ZS84W1s ; https://support.ynab.com/en_us/getting-started-with-targets-ryAEP08xC ; https://support.ynab.com/en_us/how-to-use-targets-rk5kkI9ks ; https://support.ynab.com/en_us/plan-and-adjust-with-edit-plan-and-cost-to-be-me-ByR7vpqPyx ; https://support.ynab.com/en_us/plan-resets-and-fresh-starts-HkXYR_c0q ; https://support.ynab.com/en_us/approving-and-matching-transactions-a-guide-ByYNZaQ1i ; https://support.ynab.com/en_us/how-to-rename-payees-BkotNUSyo ; https://support.ynab.com/en_us/how-to-add-edit-and-delete-payees-rkxMu4Skj ; https://support.ynab.com/en_us/my-payees-are-wrong-rJS5xITwxx ; https://support.ynab.com/en_us/geo-payees-on-mobile-a-guide-SJTbcVks ; https://support.ynab.com/en_us/managing-notifications-a-guide-HySdCwtCc ; https://support.ynab.com/en_us/ynab-together-B1nS78Cki ; https://support.ynab.com/en_us/the-ynab-api-an-overview-BJMgQ3zAq ; https://support.ynab.com/en_us/spaces-in-the-mobile-app-S1iIZQoqgg ; https://support.ynab.com/en_us/loading-your-data-in-the-ynab-app-S1F63hUDWl ; https://support.ynab.com/en_us/using-ynab-on-an-ipad-a-guide-BkzOqBdAq ; https://support.ynab.com/en_us/how-to-choose-a-custom-app-icon-on-ios-H1ewFB_Ac ; https://support.ynab.com/en_us/category-templates-HknjS_RA ; https://support.ynab.com/en_us/how-to-manage-your-subscription-BJXBVDb0q ; https://support.ynab.com/en_us/your-ynab-trial-ry87vWAc ; https://support.ynab.com/en_us/ynab-glossary-a-guide-BJd80SORq
- **Wallet by BudgetBakers (App Store title: "Wallet - Daily Budget & Profit" on /us, "Wallet - Money Management" on /ar; Android package com.droid4you.application.wallet)**: https://apps.apple.com/ar/app/wallet-daily-budget-profit/id1032467659 ; https://apps.apple.com/us/app/wallet-daily-budget-profit/id1032467659 ; https://apps.apple.com/us/app/wallet-daily-budget-profit/id1032467659?see-all=version-history ; https://itunes.apple.com/lookup?id=1032467659&country=us ; https://itunes.apple.com/lookup?id=1032467659&country=ar ; https://budgetbakers.com/ ; https://budgetbakers.com/en/products/wallet/ ; https://budgetbakers.com/en/products/wallet/download/ ; https://budgetbakers.com/en/products/wallet/features/ ; https://budgetbakers.com/en/products/wallet/features/budgets/ ; https://budgetbakers.com/en/products/wallet/features/bank-sync/ ; https://budgetbakers.com/en/products/wallet/features/planned-payments/ ; https://budgetbakers.com/en/products/wallet/integrations/mcp/ ; https://budgetbakers.com/en/products/sharecost/ ; https://budgetbakers.com/en/products/aisp-open-banking/ ; https://budgetbakers.com/en/security/ ; https://budgetbakers.com/en/support/ ; https://budgetbakers.com/en/pricing/ (404) ; https://play.google.com/store/apps/details?id=com.droid4you.application.wallet&hl=en&gl=AR ; https://feedback.budgetbakers.com/ ; https://support.budgetbakers.com/api/v2/help_center/en-us/articles.json ; https://support.budgetbakers.com/hc/en-us/articles/7151349344018-Everything-about-Premium ; https://support.budgetbakers.com/hc/en-us/articles/7149394922002-Everything-about-Group-Sharing ; https://support.budgetbakers.com/hc/en-us/articles/26593713953554-Apple-Pay-Integration ; https://support.budgetbakers.com/hc/en-us/articles/27454807191058-Google-Pay-Integration ; https://support.budgetbakers.com/hc/en-us/articles/27357560590098-Notification-Access-Permission ; https://support.budgetbakers.com/hc/en-us/articles/7149418777746-Multiple-Currencies-Exchange-Rates ; https://support.budgetbakers.com/hc/en-us/articles/7149520322706-Setting-up-Debts-and-Loans ; https://support.budgetbakers.com/hc/en-us/articles/7149523920786-Setup-Planned-Payments ; https://support.budgetbakers.com/hc/en-us/articles/7184048333842-Planned-Transfers ; https://support.budgetbakers.com/hc/en-us/articles/7076953735314-Setup-Budgets ; https://support.budgetbakers.com/hc/en-us/articles/7181571852690-Setting-up-Goals ; https://support.budgetbakers.com/hc/en-us/articles/7077082048146-All-about-Categories-and-Subcategories ; https://support.budgetbakers.com/hc/en-us/articles/7076564578066-Utilising-Labels ; https://support.budgetbakers.com/hc/en-us/articles/7076754432146-Working-with-Filters ; https://support.budgetbakers.com/hc/en-us/articles/7150077480850-Add-or-Modify-Dashboard-Cards-Widgets ; https://support.budgetbakers.com/hc/en-us/articles/7184052562578-Hide-Account-Balance ; https://support.budgetbakers.com/hc/en-us/articles/12212663489298-Setup-Initial-day-of-the-month ; https://support.budgetbakers.com/hc/en-us/articles/7149271363090-Everything-About-Transactions-Add-edit-clone-split-duplicates ; https://support.budgetbakers.com/hc/en-us/articles/6950259945362-Adding-a-Credit-Card ; https://support.budgetbakers.com/hc/en-us/articles/7148318384530-Overdraft-Account-Types ; https://support.budgetbakers.com/hc/en-us/articles/7077275632274-Import-your-transactions-or-files ; https://support.budgetbakers.com/hc/en-us/articles/7151606064018-How-to-export-transactions-from-Wallet ; https://support.budgetbakers.com/hc/en-us/articles/10761479741586-Rest-API-MCP ; https://support.budgetbakers.com/hc/en-us/articles/14785418453522-Investments-Stocks-ETF ; https://support.budgetbakers.com/hc/en-us/articles/12211695770130-Crypto-Support ; https://support.budgetbakers.com/hc/en-us/articles/7149319175826-Automatic-Rules ; https://support.budgetbakers.com/hc/en-us/articles/26911037277586-OCR ; https://support.budgetbakers.com/hc/en-us/articles/31001090941970-Understanding-Your-Wallet-Statistics ; https://support.budgetbakers.com/hc/en-us/articles/36546774821778-What-does-the-percentage-next-to-Income-Expenses-mean ; https://support.budgetbakers.com/hc/en-us/articles/36544649033618-How-to-exclude-an-account-records-or-transfers-from-your-statistics ; https://support.budgetbakers.com/hc/en-us/articles/7181476227474-Setup-Fingerprint-or-Face-ID-recognition ; https://support.budgetbakers.com/hc/en-us/articles/14905550660754-Enable-Change-or-Reset-your-PIN ; https://support.budgetbakers.com/hc/en-us/articles/16543490978194-Mortgage-How-to-effectively-manage-it-in-Wallet ; https://support.budgetbakers.com/hc/en-us/articles/7152012249618-How-often-does-my-bank-account-data-update ; https://support.budgetbakers.com/hc/en-us/articles/7183726011538-How-many-transactions-will-appear-in-Wallet-when-I-first-connect-to-my-bank ; https://support.budgetbakers.com/hc/en-us/articles/7182879110290-Is-it-safe-to-connect-my-bank-account-with-Wallet ; https://support.budgetbakers.com/hc/en-us/articles/7076796545554-Connect-disconnect-or-reconnect-your-bank ; https://support.budgetbakers.com/hc/en-us/articles/7150530312722-I-cannot-connect-my-bank-account ; https://support.budgetbakers.com/hc/en-us/articles/7150175717138-Bank-is-missing-Bank-is-not-listed ; https://support.budgetbakers.com/hc/en-us/articles/12212428113810-What-is-the-Wallet-app ; https://support.budgetbakers.com/hc/en-us/articles/7151352625938-Getting-Started-with-Wallet ; https://support.budgetbakers.com/hc/en-us/articles/34453128217618-Adding-an-Account ; https://support.budgetbakers.com/hc/en-us/articles/7181432342034-Wallet-Web-App ; https://support.budgetbakers.com/hc/en-us/articles/10105401036690-Backup-Measures-and-Data-Loss ; https://support.budgetbakers.com/hc/en-us/articles/7183819864850-Data-not-syncing-between-devices ; https://support.budgetbakers.com/hc/en-us/articles/27741215736722-Account-Security-Mandatory-Email-Verification ; https://support.budgetbakers.com/hc/en-us/articles/12212009575442-How-to-change-the-app-language ; https://support.budgetbakers.com/hc/en-us/articles/7077050225042-Using-Templates ; https://support.budgetbakers.com/hc/en-us/articles/7151701340050-Shopping-List ; https://support.budgetbakers.com/hc/en-us/articles/7077030698386-Warranties ; https://support.budgetbakers.com/hc/en-us/articles/7002928224786-Clone-Transactions ; https://support.budgetbakers.com/hc/en-us/articles/7150568033938-Bulk-Edit-Records ; https://support.budgetbakers.com/hc/en-us/articles/9740038391186-Record-Confirmation-Green-check-mark ; https://support.budgetbakers.com/hc/en-us/articles/7148334559762-Bank-Transfers ; https://support.budgetbakers.com/hc/en-us/articles/7149421504146-Uncleared-Records ; https://support.budgetbakers.com/hc/en-us/articles/11224785367826-Missing-Merchant-Details ; https://support.budgetbakers.com/hc/en-us/articles/34607304316562-Printing-Your-Reports-and-Transactions ; https://support.budgetbakers.com/hc/en-us/articles/28215376280466-Why-isn-t-an-asset-purchase-stocks-ETFs-cryptocurrencies-reflected-as-an-expense-in-Wallet
- **Piggy: Gastos Diarios (App Store title; subtitle "Dividir cuentas con amigos"; Google Play title "Piggy: Organizador de gastos"; package com.eraia)**: https://apps.apple.com/ar/app/piggy-control-de-gastos/id6740286427 ; https://apps.apple.com/us/app/piggy-control-de-gastos/id6740286427 ; https://play.google.com/store/apps/details?id=com.eraia&hl=en_US ; https://piggy.com.ar/ ; https://piggy.com.ar/llms.txt ; https://piggy.com.ar/sitemap.xml ; https://piggy.com.ar/precios/ ; https://piggy.com.ar/privacy.html ; https://piggy.com.ar/integraciones/ ; https://piggy.com.ar/integraciones/whatsapp/ ; https://piggy.com.ar/integraciones/mercado-pago/ ; https://piggy.com.ar/integraciones/chatgpt/ ; https://piggy.com.ar/integraciones/claude/ ; https://piggy.com.ar/guias/mejor-app-finanzas-personales-argentina/ ; https://piggy.com.ar/guias/mejor-app-finanzas-personales-uruguay/ ; https://piggy.com.ar/comparativas/money-manager/ ; https://piggy.com.ar/piggy-vs-splitwise.html ; https://piggy.com.ar/foto-ticket/ ; https://piggy.com.ar/gastos-compartidos/ ; https://piggy.com.ar/suscripciones/ ; https://piggy.com.ar/wallet-manager/ ; https://piggy.com.ar/blog/tutorial-apple-wallet.html ; https://piggy.com.ar/blog/cuanto-voy-a-pagar-tarjeta.html ; https://piggy.com.ar/ayuda/ ; https://piggy.com.ar/ayuda/piggy-pro/ ; https://piggy.com.ar/ayuda/seguridad/ ; https://piggy.com.ar/ayuda/primeros-pasos/como-empezar-en-piggy/ ; https://piggy.com.ar/ayuda/primeros-pasos/como-navegar-tu-balance-mensual/ ; https://piggy.com.ar/ayuda/primeros-pasos/como-personalizar-pantalla-estadisticas-con-widgets/ ; https://piggy.com.ar/ayuda/gastos-e-ingresos/ ; https://piggy.com.ar/ayuda/gastos-e-ingresos/como-se-calculan-gastos/ ; https://piggy.com.ar/ayuda/billeteras/ ; https://piggy.com.ar/ayuda/billeteras/como-funcionan-las-monedas/ ; https://piggy.com.ar/ayuda/billeteras/compra-venta-dolares/ ; https://piggy.com.ar/ayuda/monedas/que-monedas-soporta-piggy/ ; https://piggy.com.ar/ayuda/monedas/operaciones-multimoneda-y-cambio-de-divisas/ ; https://piggy.com.ar/ayuda/tarjetas-de-credito/configurar-cierre-y-vencimiento/ ; https://piggy.com.ar/ayuda/tarjetas-de-credito/como-pagar-el-resumen-de-tarjeta/ ; https://piggy.com.ar/ayuda/tarjetas-de-credito/como-importar-resumen-de-tarjeta/ ; https://piggy.com.ar/ayuda/tarjetas-de-credito/como-funcionan-las-monedas-en-tarjetas-de-credito/ ; https://piggy.com.ar/ayuda/cuotas/como-registrar-compras-en-cuotas/ ; https://piggy.com.ar/ayuda/cuotas/impacto-de-cuotas-en-meses-futuros/ ; https://piggy.com.ar/ayuda/cuotas/que-pasa-si-elimino-una-compra-en-cuotas/ ; https://piggy.com.ar/ayuda/gastos-compartidos/como-registrar-y-dividir-un-gasto/ ; https://piggy.com.ar/ayuda/gastos-compartidos/como-saldar-o-perdonar-una-deuda/ ; https://piggy.com.ar/ayuda/gastos-compartidos/como-se-calculan-los-saldos/ ; https://piggy.com.ar/ayuda/pagos-recurrentes/como-funcionan-los-pagos-recurrentes/ ; https://piggy.com.ar/ayuda/objetivos/ ; https://piggy.com.ar/ayuda/objetivos/como-crear-un-objetivo-de-gasto/ ; https://piggy.com.ar/ayuda/whatsapp/cargar-gasto-por-whatsapp/ ; https://piggy.com.ar/ayuda/integraciones/configurar-apple-pay-con-atajos/ ; https://piggy.com.ar/ayuda/integraciones/seguridad-y-privacidad-ia/ ; https://piggy.com.ar/ayuda/integraciones/prompts-y-consultas-ia/ ; https://piggy.com.ar/ayuda/mercado-pago/que-datos-importa-mercado-pago/ ; https://piggy.com.ar/ayuda/ripio/que-datos-importa-ripio/
- **Finy - Finanzas con IA (App Store title; US-locale subtitle "Control de gastos con IA"; Google Play title "Finy: Control de gastos con IA", package com.finy.app)**: https://apps.apple.com/ar/app/finy-control-de-gastos-con-ia/id6760370721 ; https://apps.apple.com/ar/app/finy-control-de-gastos-con-ia/id6760370721?l=es ; https://apps.apple.com/us/app/finy-control-de-gastos-con-ia/id6760370721 ; https://apps.apple.com/us/app/finy-control-de-gastos-con-ia/id6760370721?l=es ; https://www.finyapp.io/ ; https://www.finyapp.io/preguntas-frecuentes ; https://www.finyapp.io/politica-privacidad ; https://www.finyapp.io/condiciones-servicios ; https://www.finyapp.io/taller ; https://www.finyapp.io/guias ; https://www.finyapp.io/guias/mejor-app-de-gastos-argentina ; https://www.finyapp.io/guias/mejor-app-de-gastos-colombia ; https://www.finyapp.io/guias/mejor-app-de-gastos-mexico ; https://www.finyapp.io/guias/apps-para-dividir-gastos-con-tu-pareja ; https://www.finyapp.io/guias/apps-de-gastos-con-inteligencia-artificial ; https://www.finyapp.io/comparativas ; https://www.finyapp.io/comparativas/finy-vs-excel ; https://www.finyapp.io/comparativas/finy-vs-abaco ; https://www.finyapp.io/comparativas/finy-vs-splitwise ; https://www.finyapp.io/comparativas/finy-vs-mobills
- **Splitwise**: https://apps.apple.com/ar/app/splitwise/id458023433 ; https://apps.apple.com/us/app/splitwise/id458023433 ; https://play.google.com/store/apps/details?id=com.Splitwise.SplitwiseMobile&hl=en&gl=US ; https://www.splitwise.com/ ; https://www.splitwise.com/pro ; https://www.splitwise.com/pay ; https://www.splitwise.com/card ; https://www.splitwise.com/press ; https://www.splitwise.com/privacy ; https://assets.splitwise.com/assets/motel-387139a1fd1be16e7f862f4fbf6d3e1477be040b1cc7d3bc800dabad590ad05c.css ; https://feedback.splitwise.com/knowledgebase ; https://feedback.splitwise.com/knowledgebase/articles/all ; https://feedback.splitwise.com/knowledgebase/topics/50750-mobile ; https://feedback.splitwise.com/knowledgebase/topics/50754-general ; https://feedback.splitwise.com/knowledgebase/topics/50753-payments ; https://feedback.splitwise.com/knowledgebase/articles/2010350 ; https://feedback.splitwise.com/knowledgebase/articles/174427 ; https://feedback.splitwise.com/knowledgebase/articles/436667 ; https://feedback.splitwise.com/knowledgebase/articles/425469 ; https://kb.splitwise.com/ ; https://kb.splitwise.com/balances-and-expenses ; https://kb.splitwise.com/getting-started ; https://kb.splitwise.com/account-issues ; https://kb.splitwise.com/groups ; https://kb.splitwise.com/payment-integrations ; https://kb.splitwise.com/pro ; https://kb.splitwise.com/splitwise-pay ; https://kb.splitwise.com/balances-and-expenses/how-can-i-manage-a-friendship-or-group-with-multiple-currencies ; https://kb.splitwise.com/balances-and-expenses/what-is-simplify-debts ; https://kb.splitwise.com/balances-and-expenses/what-are-different-ways-i-can-split-an-expense ; https://kb.splitwise.com/balances-and-expenses/how-can-i-double-check-my-balances ; https://kb.splitwise.com/balances-and-expenses/how-do-i-add-a-refund-or-reimbursement ; https://kb.splitwise.com/balances-and-expenses/how-can-i-manage-recurring-expenses ; https://kb.splitwise.com/balances-and-expenses/can-you-explain-the-totals-screen ; https://kb.splitwise.com/getting-started/can-i-add-a-friend-without-adding-their-email-address-or-phone-number ; https://kb.splitwise.com/getting-started/can-i-use-splitwise-to-track-my-personal-expenses ; https://kb.splitwise.com/getting-started/how-do-i-use-splitwise ; https://kb.splitwise.com/account-issues/how-do-i-export-my-splitwise-data ; https://kb.splitwise.com/account-issues/why-am-i-not-receiving-email-notifications ; https://kb.splitwise.com/account-issues/how-can-i-set-my-default-currency ; https://kb.splitwise.com/account-issues/how-can-i-deactivate-or-delete-my-account ; https://kb.splitwise.com/groups/how-do-i-create-a-group ; https://kb.splitwise.com/groups/can-i-prevent-group-members-from-changing-expenses-or-set-permissions ; https://kb.splitwise.com/groups/how-do-i-split-an-expense-for-a-couple-that-is-sharing-costs ; https://kb.splitwise.com/payment-integrations/how-do-i-send-money-to-someone-on-splitwise ; https://kb.splitwise.com/pro/what-is-splitwise-pro ; https://kb.splitwise.com/pro/how-are-exchange-rates-calculated-for-currency-conversion ; https://kb.splitwise.com/pro/how-can-i-cancel-my-splitwise-pro-subscription-and-get-a-refund ; https://kb.splitwise.com/splitwise-pay/how-do-i-set-up-splitwise-pay ; https://kb.splitwise.com/splitwise-pay/how-do-i-connect-a-funding-source ; https://blog.splitwise.com/ ; https://blog.splitwise.com/2026/05/18/dark-mode-announcement/ ; https://blog.splitwise.com/2019/07/
- **MoneyCoach (App Store titles: AR "Finanzas Personales MoneyCoach", US "MoneyCoach AI Budget Planner")**: https://apps.apple.com/ar/app/moneycoach-budget-planner/id989642198 ; https://apps.apple.com/us/app/moneycoach-budget-planner/id989642198 ; https://moneycoach.ai/ ; https://moneycoach.ai/features ; https://moneycoach.ai/changelog ; https://moneycoach.ai/faqs ; https://moneycoach.ai/online-banking ; https://moneycoach.ai/bank-coverage ; https://moneycoach.ai/category-budgets ; https://moneycoach.ai/financial-reports ; https://moneycoach.ai/privacy-first-budgeting-app ; https://moneycoach.ai/legal/privacy-policy ; https://moneycoach.ai/support ; https://moneycoach.ai/blog ; https://moneycoach.ai/blog/moneycoach-gets-live-activities-support ; https://moneycoach.ai/blog/introducing-moneycoach-11-for-ios26 ; https://moneycoach.ai/best-budgeting-app-for-apple-watch ; https://moneycoach.ai/best-budgeting-app-for-iphone ; https://moneycoach.ai/best-budgeting-app-for-mac ; https://moneycoach.ai/best-budgeting-app-for-couples-iphone ; https://moneycoach.ai/best-subscription-manager-app-for-iphone ; https://moneycoach.ai/budgeting-app-without-bank-linking ; https://moneycoach.ai/moneycoach-10-on-ios-18 ; https://moneycoach.ai/moneycoach-intelligence ; https://moneycoach.ai/mcp ; https://moneycoach.ai/moneyspaces ; https://moneycoach.ai/apps ; https://moneycoach.ai/why-moneycoach ; https://moneycoach.ai/about-us/press-kit ; https://moneycoach.ai/features/goals ; https://moneycoach.ai/guides/how-to-use-multi-currency ; https://moneycoach.ai/guides/how-to-track-debts ; https://moneycoach.ai/guides/how-to-handle-refunds-cashback-repayments ; https://moneycoach.ai/guides/how-to-plan-better-using-the-calendar ; https://moneycoach.ai/guides/how-to-add-description-tags-payee-to-transactions-transfers ; https://moneycoach.ai/guides/how-to-use-quick-entry ; https://moneycoach.ai/guides/how-to-add-transactions-with-siri-in-moneycoach ; https://moneycoach.ai/guides/how-do-interactive-widgets-work-ios-17 ; https://moneycoach.ai/guides/how-to-import-apple-pay-wallet-transactions-to-moneycoach ; https://moneycoach.ai/guides/how-to-activate-family-sync ; https://moneycoach.ai/guides/how-to-customize-your-payday-in-moneycoach-app ; https://moneycoach.ai/guides/how-to-track-and-manage-credit-cards ; https://moneycoach.ai/guides/can-you-sync-moneycoach-android-and-mac-apps ; https://moneycoach.ai/guides/how-to-scan-invoices-receipts ; https://moneycoach.ai/guides/import-csv-files-in-moneycoach ; https://moneycoach.ai/guides/how-to-export-transactions-as-csv-in-moneycoach ; https://moneycoach.ai/guides/how-the-new-backup-restore-works ; https://moneycoach.ai/guides/getting-started-how-to-use-the-repeating-transactions-feature ; https://moneycoach.ai/guides/understanding-future-transactions-in-moneycoach ; https://moneycoach.ai/guides/how-to-deactivate-live-activities ; https://moneycoach.ai/guides/how-to-setup-dynamic-shortcuts ; https://moneycoach.ai/guides/how-to-setup-a-mortgage-account-in-moneycoach ; https://moneycoach.ai/guides/getting-started-how-to-create-a-budget ; https://moneycoach.ai/guides/upgrade-to-family-plan ; https://moneycoach.ai/guides/how-does-the-daily-limit-works ; https://moneycoach.ai/guides/how-to-activate-cloud-sync ; https://moneycoach.ai/sitemap-0.xml
- **Mercado Pago (official developer documentation, help centre, terms; third-party precedents)**: https://www.mercadopago.com.ar/developers/es/docs/security/oauth/introduction ; https://www.mercadopago.com.ar/developers/es/docs/security/oauth/creation ; https://www.mercadopago.com.ar/developers/es/docs/security/oauth/renewal ; https://www.mercadopago.com.ar/developers/es/docs/security/oauth/best-practices ; https://www.mercadopago.com.ar/developers/en/docs/security/oauth ; https://www.mercadopago.com.ar/developers/en/docs/subscriptions/additional-content/security/oauth/introduction ; https://www.mercadopago.com.ar/developers/en/docs/split-payments/additional-content/security/oauth/management ; https://www.mercadopago.com.br/developers/en/reference/authentication/oauth/_oauth_token/post ; https://www.mercadopago.com.ar/developers/es/news/2024/06/14/OAuth-documentation-has-been-renewed ; https://www.mercadopago.com.ar/developers/es/docs/subscriptions/additional-content/your-integrations/notifications/webhooks ; https://www.mercadopago.com.mx/developers/es/docs/checkout-bricks/additional-content/your-integrations/notifications ; https://www.mercadopago.com.pe/developers/es/reference/online-payments/checkout-api-payments/search-payments/get ; https://www.mercadopago.com.br/developers/en/reference/online-payments/checkout-pro-preferences/search-payments/get ; https://www.mercadopago.com.ar/developers/es/docs/reports/account-money/introduction ; https://www.mercadopago.com.ar/developers/es/docs/reports/account-money/generate ; https://www.mercadopago.com.ar/developers/es/docs/checkout-pro/additional-content/reports/account-money/api ; https://www.mercadopago.com.ar/developers/es/docs/checkout-pro/additional-content/reports/account-money/how-to-use ; https://www.mercadopago.com.ar/developers/es/docs/checkout-pro/additional-content/reports/introduction ; https://www.mercadopago.com.ar/developers/es/docs/subscriptions/additional-content/reports/released-money/api ; https://www.mercadopago.com.ar/developers/es/docs/wallet-connect/overview ; https://www.mercadopago.com.ar/developers/es/docs/your-integrations/test/accounts ; https://www.mercadopago.com.ar/developers/es/docs/your-integrations/credentials ; https://www.mercadopago.com.ar/developers/es/docs/your-integrations/application-details ; https://www.mercadopago.com.ar/developers/es/docs/your-integrations/dashboard ; https://www.mercadopago.com.ar/developers/es/docs/subscriptions/resources/credentials-best-practices/secure-credentials ; https://www.mercadopago.com.ar/developers/es/docs/security/pci ; https://www.mercadopago.com.ar/developers/es/docs/resources/legal/terms-and-conditions ; https://www.mercadopago.com.ar/ayuda/32978 ; https://www.mercadopago.com.ar/ayuda/17220 ; https://www.mercadopago.com.mx/blog/como-sacar-un-estado-de-cuenta ; https://www.getkesef.app/ ; https://getkesef.app/index.md ; https://www.getkesef.app/privacy ; https://apps.apple.com/ar/app/kesef-gestor-de-gastos/id6758053806 ; https://apps.apple.com/us/app/kesef-expense-tracker/id6758053806 ; https://github.com/francur7i/finanzas ; https://github.com/fguinez/el-chanchito/issues/10 ; https://kpmg.com/ar/es/tendencias/novedades-tax/2025/05/23-de-mayo.html ; https://www.palabrasdelderecho.com.ar/articulo/5954/Crearon-el-Sistema-de-Finanzas-Abiertas ; NOT READ (fetch failed, listed for transparency): https://www.mercadopago.com.ar/developers/es/reference/payments/_payments_search/get (404), https://www.mercadopago.com.ar/developers/es/docs/your-integrations/notifications/webhooks (404), https://www.mercadopago.com.ar/developers/es/docs/security/oauth/scopes (404), https://www.argentina.gob.ar/normativa/nacional/decreto-353-2025-413071/texto (500), https://www.boletinoficial.gob.ar/detalleAviso/primera/325726/20250523 (timeout), https://groups.google.com/g/mercadopago-developers/c/iWV1ttfrCRU (content unavailable), https://www.mercadopago.com.mx/blog/descargar-reportes-de-cuenta-para-contador (403), https://www.bcra.gob.ar/archivos/Pdfs/Institucional/objetivos-planes-bcra-2026.pdf (search snippet only)
- **Bank connections, Argentine open finance, FinanceKit**: https://prometeoapi.com/ ; https://prometeoapi.com/en/ ; https://prometeoapi.com/blog/elegir-plataforma-open-banking ; https://thepaypers.com/payments/company-information/prometeo-open-banking ; https://www.financialcontent.com/article/bizwire-2026-9-29-prometeo-expands-account-verification-into-a-global-trust-layer-with-110-country-coverage-and-new-risk-intelligence ; https://pluggy.ai/ ; https://docs.pluggy.ai/docs/introduction ; https://docs.pluggy.ai/en/docs/open-finance/overview ; https://fintoc.com/ ; https://fintoc.com/cl ; https://docs.fintoc.com/ ; https://docs.fintoc.com/llms.txt ; https://docs.fintoc.com/docs/products-and-institutions-movements ; https://intercom.help/fintoc/es/articles/6164074-con-que-bancos-se-puede-usar-fintoc ; https://finerioconnect.com/ ; https://finerioconnect.com/products/bank-aggregation ; https://belvo.com/ ; https://belvo.com/es/preguntas-frecuentes/ ; https://belvo.com/plans-and-pricing/ ; https://developers.belvo.com/apis/belvoopenapispec/institutions/listinstitutions ; https://plaid.com/global/ ; https://www.yapily.com/coverage ; https://truelayer.com/ ; https://developer.apple.com/financekit/ ; https://developer.apple.com/tutorials/data/documentation/financekit.json ; https://developer.apple.com/tutorials/data/documentation/bundleresources/entitlements/com.apple.developer.financekit.json ; https://developer.apple.com/videos/play/wwdc2024/2023/ ; https://www.boletinoficial.gob.ar/detalleAviso/primera/325767/20250523 ; https://www.bcra.gob.ar/archivos/Pdfs/Institucional/objetivos-planes-bcra-2026.pdf ; https://www.bcra.gob.ar/en/transfers-3-0/ ; https://www.fiskil.com/open-finance-tracker/argentina ; https://www.infobae.com/economia/2025/09/01/open-finance-en-la-argentina-como-es-el-plan-del-bcra-para-facilitar-el-acceso-al-credito/ ; https://www.infobae.com/economia/2025/11/05/open-finance-que-ventajas-puede-traer-el-plan-del-gobierno-y-como-esta-la-argentina-frente-al-resto-de-la-region/ ; https://www.lanacion.com.ar/economia/prestar-mas-y-mejor-como-funciona-el-open-finance-la-herramienta-que-impulsa-el-bcra-y-busca-revivir-nid12112025/ ; https://www.cronista.com/finanzas-mercados/el-modelo-open-finance-se-abre-paso-y-tiene-fecha-de-salida-cuando-sera-unna-realidad-en-la-argentina/ ; https://www.argentina.gob.ar/transferencias-internacionales ; https://www.mercadopago.com.ar/developers/es/docs/wallet-connect/landing ; https://www.mercadopago.com.ar/developers/es/docs/resources/legal/terms-and-conditions ; https://assets.ctfassets.net/t5yal6u1wvnw/2Ttjz3Gdx4xdxMcu3ndK8U/b375fb7b17866e7e0ec2023eb7c05129/2024.06.04_Terminos_y_Condiciones_de_la_App__VF__-_Nueva_Plantilla_Pie_de_pa_gina.pdf
- **Shared expenses**: https://apps.apple.com/us/app/splitwise/id458023433 ; https://apps.apple.com/ar/app/splitwise/id458023433 ; https://apps.apple.com/us/app/splitwise/id458023433?see-all=version-history ; https://www.splitwise.com/pro ; https://kb.splitwise.com/balances-and-expenses/what-is-simplify-debts ; https://kb.splitwise.com/balances-and-expenses/what-are-different-ways-i-can-split-an-expense ; https://kb.splitwise.com/getting-started/can-i-add-a-friend-without-adding-their-email-address-or-phone-number ; https://kb.splitwise.com/balances-and-expenses/how-can-i-manage-a-friendship-or-group-with-multiple-currencies ; https://kb.splitwise.com/groups/how-do-i-join-an-existing-group ; https://kb.splitwise.com/pro/what-is-splitwise-pro ; https://kb.splitwise.com/pro/what-is-splitwise-pro-and-who-can-use-it ; https://kb.splitwise.com/balances-and-expenses/how-do-i-add-a-refund-or-reimbursement ; https://kb.splitwise.com/balances-and-expenses/how-can-i-double-check-my-balances ; https://apps.apple.com/us/app/tricount-split-settle-bills/id349866256 ; https://apps.apple.com/ar/app/tricount-split-settle-bills/id349866256 ; https://tricount.com/ ; https://help.tricount.com/articles/how-can-i-manage-my-tricounts-and-expenses ; https://help.tricount.com/articles/tricount-faqs ; https://tricount.com/en-us/expense-tracker-features/custom-split-expenses ; https://tricount.com/en-us/expense-tracker-features/multi-currency-support ; https://help.tricount.com/categories/knowledge ; https://apps.apple.com/us/app/settle-up-group-expenses/id737534985 ; https://apps.apple.com/ar/app/settle-up-group-expenses/id737534985 ; https://apps.apple.com/us/app/settle-up-group-expenses/id737534985?see-all=version-history ; https://settleup.io/ ; https://settleup.io/tips ; https://apps.apple.com/us/app/kesef-expense-tracker/id6758053806 ; https://apps.apple.com/ar/app/kesef-expense-tracker/id6758053806 ; https://apps.apple.com/us/app/kesef-expense-tracker/id6758053806?see-all=version-history ; https://www.getkesef.app/en ; https://www.getkesef.app/en/faq ; https://www.getkesef.app/en/blog/splitwise-alternatives ; https://apps.apple.com/us/app/monarch-budget-track-money/id1459319842 ; https://www.monarch.com/ ; https://www.monarch.com/pricing ; https://apps.apple.com/us/app/copilot-track-budget-money/id1447330651 ; https://help.copilot.money/en/articles/5325255-splitting-transactions ; https://help.copilot.money/en/articles/4523792-sharing-your-account-with-a-partner ; https://help.copilot.money/en/articles/5325170-refund-and-reimbursement-transactions ; NOT FETCHED (403): https://help.monarch.com/hc/en-us/articles/20926382202004-Monarch-for-Couples-and-Households ; NOT FETCHED (403): https://help.monarch.com/hc/en-us/articles/360050178492-Splitting-Transactions ; NOT FETCHED (403): https://help.monarch.com/hc/en-us/articles/42228648365076-Shared-Views-in-Monarch ; NOT FETCHED (404): https://apps.apple.com/ar/app/monarch-budget-track-money/id1459319842 ; NOT FETCHED (404): https://apps.apple.com/ar/app/copilot-track-budget-money/id1447330651 ; NOT FETCHED (404): https://www.copilot.money/pricing ; NOT FETCHED (404): https://settleup.io/docs/ ; NOT FETCHED (empty): https://play.google.com/store/apps/details?id=cz.destil.settleup&hl=en_US ; NOT FETCHED (302 to blog index): https://blog.tricount.com/en/set-parts-to-split-expenses-unevenly
- **Brand landscape and naming rules**: https://apps.apple.com/us/app/kesef-expense-tracker/id6758053806 ; https://apps.apple.com/ar/app/kesef-expense-tracker/id6758053806 ; https://www.getkesef.app/ ; https://apps.apple.com/us/app/expense-tracker-monai/id6447112647 ; https://apps.apple.com/ar/app/expense-tracker-monai/id6447112647 ; https://get-monai.app/ ; https://apps.apple.com/us/app/revolut-send-spend-and-save/id932493382 ; https://apps.apple.com/ar/app/revolut-send-spend-and-save/id932493382 ; https://www.revolut.com/ (HTTP 403, not read) ; https://www.revolut.com/news/ (HTTP 403, not read) ; https://www.underconsideration.com/brandnew/archives/new_logo_for_revolut_2023.php (paywalled; only date 2023-12-13 read) ; https://monzo.com/ ; https://monzo.com/tone-of-voice ; https://monzo.com/blog/weve-had-a-little-makeover ; https://apps.apple.com/us/app/monzo-mobile-banking/id1052238659 ; https://apps.apple.com/ar/app/monzo-mobile-banking/id1052238659 ; https://wise.com/ ; https://wise.com/community/en-US/brand-new-look ; https://wise.design/ (navigation only) ; https://docs.wise.design/ (redirects to 404) ; https://apps.apple.com/us/app/wise-international-money/id612261027 ; https://apps.apple.com/ar/app/wise-global-money-transfer/id612261027 ; https://copilot.money/ ; https://apps.apple.com/us/app/copilot-track-budget-money/id1447330651 ; https://apps.apple.com/ar/app/copilot-track-budget-money/id1447330651 (404, not available in AR) ; https://www.apple.com/apple-card/ ; https://www.apple.com/wallet/ ; https://apps.apple.com/us/app/apple-wallet/id1160481993 ; https://developer.apple.com/design/human-interface-guidelines/wallet (title only returned) ; https://www.monarchmoney.com/ (301 to monarch.com) ; https://www.monarch.com/ ; https://apps.apple.com/us/app/monarch-budget-track-money/id1459319842 ; https://apps.apple.com/ar/app/monarch-budget-track-money/id1459319842 (404, not available in AR) ; https://www.ynab.com/ ; https://www.ynab.com/press ; https://www.ynab.com/brand (404) ; https://apps.apple.com/us/app/ynab/id1010865877 ; https://apps.apple.com/ar/app/ynab/id1010865877 ; https://budgetbakers.com/ ; https://apps.apple.com/us/app/wallet-budget-money-tracker/id1032467659 ; https://apps.apple.com/ar/app/wallet-budget-money-tracker/id1032467659 ; https://developer.apple.com/app-store/review/guidelines/#intellectual-property ; https://developer.apple.com/help/app-store-connect/reference/app-information/ ; https://developer.apple.com/help/app-store-connect/reference/app-information/platform-version-information ; https://developer.apple.com/app-store/marketing/guidelines/ ; https://www.argentina.gob.ar/inpi/marcas ; https://www.argentina.gob.ar/inpi/marcas/tramites-de-marcas ; https://www.argentina.gob.ar/inpi/marcas/preguntas-frecuentes-de-marcas-0 ; https://portaltramites.inpi.gob.ar/ ; https://portaltramites.inpi.gob.ar/marcasconsultas/busqueda (HTTP 503 at research time) ; https://www.wipo.int/en/web/global-brand-database ; https://www.wipo.int/en/web/madrid-system ; https://www.wipo.int/en/web/madrid-system/members ; https://www.wipo.int/documents/d/treaties/docs-en-madrid_marks.pdf (member list; Argentina and Uruguay absent, Brazil/Chile/Mexico/US present) ; WebSearch summaries (secondary, used only to locate primary pages): Wise newsroom hex values #9FE870/#163300 and Wise Sans; Revolut Aeonik Pro and 2023-10-10 refresh; Monzo 2022 makeover details
