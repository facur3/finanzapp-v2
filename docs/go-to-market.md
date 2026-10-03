# Go-to-market: positioning, channels, content, growth and the funnel

**Status.** A planning document, written on 2026-10-03 in Producto 25DISC1. **Nothing in it is implemented, created
or bought.** No social account, handle, domain, ad account, pixel, SDK, campaign, budget or referral feature exists or
is created by this document; no analytics is added to the app. It records how the product is meant to be found,
tried and kept once it exists in public, and separates what is decided from what is a guess to be tested.

- **Order stays in the roadmap.** [mobile-roadmap.md](mobile-roadmap.md) §5 («Marketing, App Store Optimization,
  Instagram…») places this work after real users exist; [app-store-launch.md](app-store-launch.md) holds ASO (§9),
  analytics (§7, §8), market localisation (§10) and the landing page (§14), which this document links to rather than
  repeats. The capability decisions it refers to are in [competitive-landscape.md](competitive-landscape.md) §12.5.
- **«FinanzApp» is the internal working name** ([brand-brief.md](brand-brief.md)). Nothing public (handle, profile,
  domain, video, ad) carries it; every public asset waits for the brand gate (launch §9.4).
- **External facts** (Meta, TikTok, YouTube, Apple) were read from the vendors' own help and developer pages on
  2026-10-03 and are listed in §13. They change often: re-read the source before acting. A fact no primary page
  confirmed is marked *unverified*.

**Labels.** Every statement that is more than a description carries one:

| Label | Meaning here |
| --- | --- |
| **DECIDED** | Already binding: an AGENTS rule, a decision record, the roadmap or the launch plan, cited. |
| **HYPOTHESIS** | What we believe will work; not yet tested, never quoted as a result. |
| **EXPERIMENT** | A measured test with a success criterion, run after launch, with consent where it touches data. |
| **RESEARCH GATE** | An open question (platform, legal, measurement) answered before anything depends on it. |
| **OWNER DECISION** | A commercial, brand or spending choice only the owner makes. |
| **LAUNCH BLOCKER** | Must be closed before the public launch of the corresponding asset. |
| **POST-LAUNCH** | After the App Store launch (Producto 26). |

## 1. Rules that bind every section

- **DECIDED.** Claims only for what the shipped build does (launch §9.1; guideline 2.3). Apple Pay capture, the
  Dynamic Island, voice and several drafts from one message, the calendar and the Assistant appear in public material
  only once each ships; until then they are shown as «coming» only if the owner chooses, never as present.
- **DECIDED.** Real screens with clearly fictional data, never the owner's or a person's ledger (AGENTS rule 6; launch
  §9.2 «Screenshots»). Testimonials, ratings and user counts only when real, verifiable and consented (roadmap §5).
- **DECIDED.** No silent telemetry; product analytics off until the person turns it on, never a condition of any
  feature (launch §7.1). No App Tracking Transparency tracking: no advertising identifier, no third-party data joins
  (launch §7.4). Every funnel stage below that needs in-app data inherits this.
- **DECIDED.** No competitor is attacked, named in an ad, imitated or copied (landscape, «No competitor UI, copy or
  asset was copied»; launch §9.2: «Names of other apps or companies aren't allowed» in keywords).
- **DECIDED.** Not financial advice: education explains how things work (a card cycle, an instalment) and never
  recommends a product, an investment or a credit decision.
- **DECIDED.** No paid acquisition is planned (launch §9.2 «Campaign attribution»); any spend is an owner decision with
  a stated cap (§7).
- **DECIDED** (AGENTS rule 12). Public copy never presents the Assistant as an agent that manages money: it proposes,
  the person confirms.

## 2. Positioning

**HYPOTHESIS.** The positioning emerges from what the product already is, not from a slogan chosen first. The pillars,
in order of how strongly the product supports them today:

| Pillar | What it means in the product | Status in the product (2026-10-03) |
| --- | --- | --- |
| Calm, premium personal finance | Forest composition, restrained colour, motion that follows the system (mobile-design.md) | IMPLEMENTED |
| Truthful accounting | Cards with statements and cycles, instalments recognised one by one, refunds, transfers never counted twice, original currencies kept (decision 003; currency.md) | IMPLEMENTED |
| Commitments ahead | Recurring rules, card due dates, instalments, debts | IMPLEMENTED; the calendar is 25C2 |
| Local-first, offline core, no account | The ledger lives on the iPhone; nothing required to start | IMPLEMENTED |
| Extremely fast capture | The capture hub today; Wallet capture (25A2), voice and several drafts (25A) later | Partly; the strongest moments are not shipped |
| Controlled AI | Drafts the person confirms; answers from their own numbers; no unrestricted chatbot | 25A, in progress |
| Apple-native integration | Shortcuts, widgets, Face ID, Live Activity gate | 25A2, 25D |
| Optional cloud and integrations | Sync, bank or Mercado Pago only by choice and only if compliant | 25E research gates |

- **What it is not**, in public: a bank, a bank connector, an investment tracker, «AI that manages your money», a
  budgeting method to adopt.
- **A one-line candidate**, for testing only (**EXPERIMENT**, never final copy): «Tus gastos, tus tarjetas y tus cuotas,
  claros y en tu iPhone.» The final line is written after the brand gate, in each storefront's language (launch §10).
- **Audience hypothesis.** People in Argentina first (cards, cuotas, two currencies, a month that ends confusingly),
  then Spanish-speaking Latin America, the United States and Spain (launch §10.1). Validated by who actually installs
  and stays, not assumed.

## 3. Social brand system

**Every channel is POST-LAUNCH for content and waits for the brand gate for its identity.** Handles are picked in
brand-brief §3 step F (availability) and only claimed after step H (the owner's selection); no handle is reserved «just
in case» before H (brand-brief §3, «Rules across the steps»). **OWNER DECISION** which channels open at all.

**Shared policy (HYPOTHESIS until the identity exists):**

- **Handle.** The exact public name on every channel; if taken, one consistent suffix everywhere (for example «app»),
  never a different variant per network. Recorded with the naming log.
- **Avatar.** The app icon's symbol, simplified for a circle crop at small size; the same file everywhere; never the
  working name, never a photo.
- **Bio pattern.** One line of what it does, one line of what it is not (no bank connection, data on the iPhone), a
  link. Spanish first; English where the storefront is English.
- **Link.** The landing page (launch §14) or, before it exists, the App Store page with a campaign token per channel
  (§11.2). One link-in-bio page only if several links are truly needed, hosted with the landing page.
- **Typography and colour.** The identity's tokens from the brand gate (brand-brief §4): the same typeface family,
  the same neutrals and accent, light and dark versions. Captions in the system's sans at a size readable on a phone
  without zoom.
- **Motion and logo.** The wordmark appears once, at the end, for about a second; no animated logo intro before the
  hook. Motion in edits follows the app's own calm motion (mobile-design.md): no shakes, no flashing.
- **CTA conventions.** One verb, the same everywhere: «Descargala» / «Get it on the App Store» only when the app is
  live; «Probala en TestFlight» during the beta; «Seguinos» never as the main CTA. Apple's badge only under Apple's
  marketing guidelines.

| Channel | Purpose | Formats and visual templates | Specific notes |
| --- | --- | --- | --- |
| Instagram | The main brand home in Argentina: product demos, education, launch news, replies | Reels (vertical video, §6), carousels for education (one idea, one card per step), Stories for releases and TestFlight calls; a cover template per pillar so the grid reads as a system | Account type and access: §4. Reels over three minutes are not recommended to new audiences (§13); keep Reels short. Licensed music is for non-commercial use; a brand uses Meta's Sound Collection (§13). |
| TikTok | Reach beyond followers with the same short videos | The §6 videos, re-exported natively (no other app's watermark) | A business uses the Commercial Music Library for all commercial activity (§13). Safe zones are published by TikTok as downloadable files: check them per format before exporting (*numbers unverified*). |
| YouTube Shorts | Search-durable home for the same demos and explainers | Vertical video up to three minutes is classified as a Short (§13); a longer horizontal walkthrough only if the owner wants one | The Short's thumbnail is a frame chosen from the video in the YouTube app (§13): design one clean frame (title plus product) into every Short. Channel managed with channel permissions, the owner as Owner (§13). |
| X / Threads | Optional: release notes and replies to people who mention the app | Text plus a short clip | **OWNER DECISION**; open only if there is someone to answer, otherwise reserve the handle and leave it dormant with a pointer bio. |
| Website / landing | The canonical home: what it does, privacy, pricing when Pro exists, support | Launch §14 | Same identity; it hosts the privacy, terms and support pages App Store Connect needs (launch §13, a **LAUNCH BLOCKER** for submission, not for marketing). |

**Video title and subtitle treatment.** A title card is not used; the hook is spoken or shown as the first caption.
Burned-in captions in the identity's typeface, sentence case, two lines at most, high contrast on a solid or blurred
plate, inside the safe zone (§6). Platform auto-captions stay on as well for accessibility.

## 4. Instagram account type and Meta access

**Recommendation (HYPOTHESIS until the owner decides; no account is created here):**

- **A professional Business account for the product brand.** Meta's own guidance: «Business accounts are best for
  retailers, local businesses, brands, organizations and service providers. Creator accounts are best for public
  figures, content producers, artists and influencers» (§13). A Business account has the contact button, category,
  insights and the professional dashboard, can run ads, and is public by nature (professional accounts cannot be set
  to private) (§13). The type can be switched later.
- **A Creator account only for a founder.** If a founder-led, build-in-public strategy later earns its place (§5,
  pillar 4), it is the founder's own personal or Creator account, separate from the brand: the brand account reposts
  or collaborates, never shares the founder's login, and the brand's history does not depend on one person.
- **Music.** Business accounts may not have access to the licensed library; Sound Collection is royalty-free and
  cleared for commercial use, ads included (§13). Every brand video uses cleared audio or none.

**Ownership and access (DECIDED as principle here; set up by the owner when the account is created, OWNER ACTION):**

- **Product-controlled, not person-bound.** The account is registered with a product email address on the product
  domain (not a personal Gmail), with the recovery phone and email the owner controls and documented in a private
  password manager, never in this public repository (AGENTS rule 6).
- **Business portfolio** (formerly Business Manager) in Meta Business Suite holds the Instagram account; an Instagram
  account can belong to one portfolio only, and adding it needs a professional account and full control of the
  portfolio (§13).
- **Roles.** At least two people with **full control** of the portfolio, Meta's own advice so that someone can
  maintain it if one person leaves (§13): the owner and one trusted backup. Everyone else gets **partial access** to
  the specific asset (content, messages, ads), temporary where the work is temporary (Meta allows 3 to 75 days); finance
  access separately and only to whoever manages spend (§13).
- **Security.** Two-factor authentication on every person with access, through an authenticator app rather than SMS
  where possible; the portfolio set to require two-factor for everyone (Meta enforces it for some portfolios older than
  90 days anyway); backup codes stored in the password manager; login alerts on; third-party apps reviewed and revoked
  when unused (§13).
- **Recovery plan, written before launch.** The steps Meta documents: Instagram's login-link flow and «Request a
  security code or support» with identity verification; for a compromised Page or portfolio, the recovery form or
  facebook.com/hacked from a device used before, then undo changes and turn on Advanced Protection (§13). The second
  full-control person is the practical recovery path for the portfolio.
- **A Facebook Page only when needed.** An Instagram professional account and Meta Business Suite work without a Page,
  and boosting a post from Instagram needs none (§13; boosting from inside the iOS app may carry Apple's service fee,
  so it is done from instagram.com). **Ads Manager does need a Page** («You must have a Facebook Page to run ads on
  Instagram», §13). So a minimal Page with the same identity is created only when paid tests in Ads Manager are
  approved (§7), not at launch. *Unverified:* any Ads Manager identity option that works without a Page.

## 5. Content strategy

**HYPOTHESIS.** Six pillars, weighted by what the product can show honestly at each moment. Every piece answers one
question a person actually has; it should be worth watching even without downloading anything.

| Pillar | What it shows | Available when | Notes |
| --- | --- | --- | --- |
| 1. Product «wow» moments | Apple Pay → review; the Dynamic Island review; voice → several drafts; cards, due dates and instalments; the financial calendar; an Assistant answer grounded in the person's own numbers | Each only once shipped (25A2, 25A, 25C2); cards and instalments now | The core of acquisition; real screen recordings only. The Dynamic Island piece only after the 25A2 gate passes on a device. |
| 2. Personal-finance education | Short practical explanations: how a card cycle works, closing versus due date, how cuotas really cost, why a card payment is not a second expense, end-of-month in two numbers | Anytime | Must help without the app; explains, never advises (§1). Accuracy checked against currency.md and decision 003 vocabulary («Saldo pendiente», never «Deuda» for cards). |
| 3. Problem → solution | Forgetting cash expenses, subscription creep, cuotas that pile up, «where did the month go» | Anytime, with the solution shown only as far as shipped | Pain stated as a common experience, never by mocking anyone or naming another app. |
| 4. Build / product story | Tasteful behind the scenes: why the app works offline, why it asks before saving, a design decision | Pre-launch onward | **OWNER DECISION** whether the owner appears on camera. Never internal code, credentials, real data or financial screenshots (AGENTS rule 6). |
| 5. Trust and privacy | Local-first core, no account needed, explicit confirmation, an Assistant without a shell or a bank login | Anytime | Exactly what the privacy policy says (launch §13), never more. |
| 6. Social proof | Real people's stories and reviews | Only once real users exist and consent | Never invented, paid without disclosure, or edited to say more than they said. |

**Cadence (HYPOTHESIS).** Two or three short videos a week on one main channel plus cross-posts beats daily posting
that cannot be sustained; the owner sets the real capacity. Batch production: record several demos in one session from
one fixture dataset.

## 6. Vertical short-form video guideline

**DECIDED for future production** (the rules); the concepts are **HYPOTHESES**.

- **Format.** 9:16 vertical, recorded at least 1080 × 1920 (Meta's Reels ad spec lists 1440 × 2560; Instagram accepts
  ratios between 1.91:1 and 9:16 and needs at least 30 fps and 720 px) (§13). One master export, re-exported per
  platform without watermarks.
- **Length.** As short as the idea allows: most pieces 10–30 seconds; nothing over three minutes (Shorts
  classification limit, and Instagram does not recommend longer Reels to new audiences) (§13).
- **Hook in the first seconds.** The result first («Pagué con Apple Pay y apareció solo»), then how.
- **One idea per video.** One feature, one explanation, one CTA.
- **Real product footage.** Screen recordings of the shipped build with clearly fictional fixture data; no mockups once
  the real screen exists, no device frames showing features the build lacks. Recorded with Reduce Motion off and on to
  check both read well.
- **Readable without sound.** Burned-in captions (§3); every number on screen legible for at least a second.
- **Safe zones.** Keep text, logos and the key UI out of the top 14 %, the bottom 35 % and 6 % on each side (Meta's
  Reels and Stories ad guidance; Meta publishes no organic number, so the ad zone is used for both) (§13). TikTok
  publishes its zones as files: check per export (*unverified numbers*).
- **Voice-over optional.** Spanish (Rioplatense for Argentina) by a real voice or none; no synthetic voice imitating a
  person.
- **Audio.** Cleared commercial audio only (Sound Collection; TikTok's Commercial Music Library) (§13).
- **End frame.** The wordmark and the single CTA (§3), one second.

**Concepts (not ad copy):**

| Concept | Pillar | Needs |
| --- | --- | --- |
| «Pago con Apple Pay y esto aparece solo.» | 1 | 25A2 shipped and its device gate passed |
| «Le digo dos gastos a la app en una frase.» | 1 | 25A voice and several drafts (landscape §8.1) shipped |
| «Por qué pagar la tarjeta no es otro gasto.» | 2 | Now (decision 003) |
| «Qué vence este mes, en diez segundos.» | 1, 3 | 25C2 calendar, or the Cards and commitments screens today |
| «Cómo funcionan realmente las cuotas.» | 2 | Now (24T) |
| «Cuánto suman mis suscripciones por año.» | 3 | 25C2 subscriptions view, if decided |
| «Tus datos no salen de tu iPhone.» | 5 | Now; wording matches the privacy policy |

## 7. Organic before paid

**DECIDED:** no paid acquisition is assumed or budgeted (launch §9.2). **HYPOTHESIS:** the loop

organic content → measure hook, hold, profile visits, link taps and install intent → identify the winners → make
variants of the winners → only then test paid distribution of proven creative.

- **What «winner» means.** Relative to the account's own median (view-through at three seconds and to the end, shares
  and saves, profile or link taps per thousand views, campaign-link downloads from §11.2), never an industry benchmark
  quoted from memory.
- **Paid, when the owner approves a capped test (OWNER DECISION, POST-LAUNCH):**
  - **Meta (Instagram Reels and Stories).** Vertical creative built for those placements, several variants per
    concept, Ads Manager's A/B test (one variable changed, no manual on/off during the test) (§13). Needs a Facebook
    Page (§4).
  - **RESEARCH GATE: measuring Meta app-install ads without tracking.** Meta's app-install optimisation and install
    reporting require the app registered with Meta and its SDK, Conversions or App Events API, or a measurement partner;
    otherwise the ad optimises for link clicks and installs report zero (§13). Meta's iOS 14+ campaigns use AEM or
    SKAdNetwork (§13); Meta's support for Apple's newer AdAttributionKit is *unverified*. None of this is compatible
    with launch §7 as written, so the first paid test is a **traffic** campaign to the App Store page with a campaign
    token (§11.2), measured by App Store Connect downloads per campaign. Adding SKAdNetwork / AdAttributionKit
    postbacks (no user-level data, no ATT prompt needed, §13) is a separate decision that changes the privacy answers
    (launch §9.2).
  - **TikTok.** Same creative; dedicated iOS app campaigns need a measurement partner supporting SKAdNetwork (§13), so
    the same traffic-first approach applies.
  - **Apple Ads** (Apple Search Ads renamed on 2025-04-14) (§13). The most natural paid channel for an App Store app:
    search-intent, attribution through Apple's own AdServices / AdAttributionKit, ad variations that send a keyword
    group to a custom product page (§11.1). Keyword research reuses launch §9.3. **RESEARCH GATE** before spend:
    the Argentina storefront's availability and minimum budgets (*unverified*).
  - **Creators / UGC.** Paid partnerships disclosed as such on each platform's branded-content tools; the creator uses
    the real app with their own fictional data or a fixture; no scripted claims beyond §1. **OWNER DECISION.**
- **No budget is committed.** Each paid test is written down first: channel, cap, duration, creative, success
  criterion, and the attribution it relies on.

## 8. Retention and engagement

**DECIDED** (production-plan §8; launch §9.2 «Ratings»): local notifications, each family opt-in and off by default,
permission asked in context, never at first launch; no dark patterns (no guilt copy, no fake urgency, no badge used to
pull the person back, no streak-loss threats, no notification that hides what it is about).

### 8.1 Mechanisms

| Mechanism | Status | Home | Notes |
| --- | --- | --- | --- |
| End-of-day «¿registraste lo de hoy?» reminder | ACTIVE ROADMAP | 25D | Time chosen by the person; off by default. |
| Upcoming bills, card closing and due, instalments | ACTIVE ROADMAP | 25D | The strongest honest reason to open the app: a real date. |
| Review tray («Para revisar») | ACTIVE ROADMAP | 25A-03 | Captures waiting for confirmation are a natural, non-artificial return. |
| Widgets | ACTIVE ROADMAP | 25D | Glanceable upcoming payments and month spending, amounts hidden by default. |
| Subscription intelligence | ACTIVE ROADMAP / LAUNCH CANDIDATE | 25C2 | Useful findings («these renew next week»), never alarms. |
| Goals | ACTIVE ROADMAP | 25C | Progress from recorded movements only. |
| Weekly summary | **EXPERIMENT** | POST-LAUNCH | A local notification on a day the person picks, opening Reportes' week; values private by default on the Lock Screen. |
| Monthly close / summary | **EXPERIMENT** | POST-LAUNCH | The month in two numbers and what comes next month (commitments); opens Reportes. |
| Progress / check-in concepts | **EXPERIMENT** | POST-LAUNCH | §8.2. |

### 8.2 Streaks: a retention experiment, not a feature

Kesef has a daily logging reminder tied to streaks (landscape §4). That is evidence the pattern exists, **not** a
reason to adopt it (landscape §12.5: parity is not the launch plan).

- **Possible benefit (HYPOTHESIS).** More days with a recorded movement in the first week, which may raise D7 and D30
  retention.
- **Risks.** It rewards entries, not accuracy: people may add meaningless or invented movements to keep a count, which
  corrupts the very ledger the product exists to keep truthful. Money is anxious territory; a broken streak feels like
  a failure on a day with no spending, which is a good day. Gamification sits badly with the calm positioning (§2).
- **A calmer alternative to test first.** A review-based check-in, not an entry count: «Semana al día», «7 de 7 días
  revisados», «Todo revisado». A day counts as reviewed when the person opens the day and confirms nothing is missing
  (zero spending is a valid answer); no loss state, no flame, no notification about a broken run.
- **Gate to promote it to the roadmap.** A written experiment: the variant, the population (opt-in analytics users
  only, launch §7), the primary metric (D7 and D30 retention of people who turn it on versus those offered it who do
  not, read with the selection bias stated), a guard metric (share of entries edited or deleted within a day, as a
  proxy for meaningless entries), the duration and the decision rule. Without that evidence it stays out of the core.

## 9. Referral and sharing

All **EXPERIMENT**, **POST-LAUNCH**; nothing is implemented.

- **Referral links.** A personal link to the App Store page; any reward must follow App Store rules for in-app
  purchases and offers (**RESEARCH GATE**: what Apple allows for referral rewards, e.g. offer codes). No contact-list
  upload, ever.
- **Invite a friend.** The system share sheet with the App Store link; nothing more until the product earns word of
  mouth.
- **Shared-expense invitations.** If groups ever ship (landscape §9.3, POST-LAUNCH), an invitation is the most natural
  referral there is; it inherits §9.2's own-share rules and the 25E identity.
- **TestFlight referrals.** Beta testers can share the public TestFlight link with friends during the beta (§10).
- **Creator affiliate programmes.** Only once paid creators are approved (§7); disclosed.

## 10. Launch content plan (hypothetical sequence)

**HYPOTHESIS.** Dates are set by the roadmap, not here.

**Pre-launch**

- Brand reveal only after the name passes screening and the owner selects it (brand-brief §3, step H). **LAUNCH
  BLOCKER** for every public asset.
- A waitlist or simple landing page if useful (**OWNER DECISION**; launch §14, consent-based email only).
- Teasers built from real screens of what is already shipped (cards, instalments, calm Home).
- TestFlight recruitment: a public link once the beta exists (Producto 26), with the beta's privacy terms.
- Education (pillar 2) from the start, because it does not depend on the product being public.

**Launch**

- App Store announcement on every open channel and the landing page, with the campaign-tokened link (§11.2).
- The strongest real demo the build supports; Apple Pay, voice and the Assistant only if shipped.
- The founder or product story, if the owner chooses to appear (§5, pillar 4).
- The review request: Apple's prompt only, after a successful moment (for example a confirmed capture or a first full
  week), never on first launch, never from a button, at most three times in 365 days (launch §9.2; §13).

**Post-launch**

- Feature demos as each phase ships; education; release notes as short videos.
- Social proof once real and consented.
- The organic → paid loop of §7, one hypothesis at a time.

## 11. Funnel, metrics and the App Store connection

### 11.1 The funnel and who sees each stage

| Stage | Source of the number | Notes |
| --- | --- | --- |
| Impression | Each platform's own insights; App Store Connect impressions | Platform data stays on the platform. |
| Profile / landing / App Store visit | Platform insights; landing analytics only under launch §7's consent rules | |
| Product page view | App Store Connect (launch §8) | |
| Install | App Store Connect: first-time downloads, by source and campaign (launch §8) | Not opt-in. |
| Onboarding | Opt-in product analytics only (`onboarding_*`, launch §7.2) | |
| First useful financial action (activation) | Opt-in product analytics (launch §7.2) | Candidates below. |
| Day 1 / 7 / 30 | App Store Connect retention (opt-in sample, launch §8) | A sample, not a census. |
| Paywall exposure | Opt-in `paywall_viewed` (launch §7.2) | After 25F. |
| Trial → paid → retained paid | App Store Server Notifications and App Store Connect subscription reports (launch §5, §8) | Server-side facts, no client event. |

**Candidate activation events** (from launch §7.2's list, no new event): first expense
(`first_expense_recorded`), first card (`first_card_created`), first recurring commitment (`first_recurring_rule`),
first reviewed Wallet capture (`wallet_capture_received` followed by `review_confirmed` with source wallet), first
useful Assistant result (`assistant_review_succeeded`). **OWNER DECISION** which one is «activation»; **HYPOTHESIS**: a
first expense plus a return within seven days.

**Candidate metrics.** View hold (three-second and completion rate), profile click-through, landing and App Store
click-through, product-page conversion (Apple's «conversion rate»), CPI and CAC once anything is paid, activation rate,
D1 / D7 / D30, trial starts, trial → paid, churn, and LTV only once enough paid cohorts exist. **No benchmark is
quoted** in this repository: targets are set against the product's own first cohorts.

### 11.2 How campaigns connect to the App Store

ASO detail stays in launch §9; this is only the link between campaigns and the store.

- **Campaign links.** Every channel, bio and campaign uses an App Store link with Apple's tokens (`pt` provider, `ct`
  one per campaign, `mt`); App Store Connect then reports downloads within 24 hours of a tap per campaign, with
  privacy thresholds (§13; launch §8: links can be created only once the app has been live for about a day). A naming
  scheme for `ct` (channel, pillar, concept, variant) is written before the first post.
- **Custom product pages.** Up to 70 (launch §9.2): one per message that has a winning concept (cards and cuotas;
  privacy; fast capture), with screenshots matching the video that sent the person there. Apple Ads ad variations can
  send a keyword group to one (§13).
- **Localised screenshots** follow launch §10; a campaign in English lands on the English page.
- **Apple Ads research** reuses launch §9.3's term research; see §7.
- **Ratings and reviews.** Only Apple's prompt (§10); replies by the owner in the reviewer's language (launch §9.2).
  Ratings shown in marketing only as Apple displays them, never rounded up.

## 12. Open owner decisions

| Decision | Where |
| --- | --- |
| Which channels open at launch, and whether X / Threads is reserved only | §3 |
| Business account for the brand; whether a founder account exists and appears | §4, §5 |
| Who holds the second full-control seat in the Meta business portfolio | §4 |
| Whether a waitlist or landing page precedes the launch | §10; launch §14 |
| The activation event | §11.1 |
| Any paid test: channel, cap, attribution method (traffic-only first, or SKAdNetwork / AdAttributionKit with the privacy answers updated) | §7 |
| Whether a weekly summary, a monthly close or the «Semana al día» check-in is run as an experiment | §8 |
| Whether referral rewards are offered at all | §9 |

## 13. Sources

Read 2026-10-03. Meta's help pages were read in their `en_US` locale.

**Meta and Instagram**
- Business vs Creator accounts; switching; optional Page link: https://www.facebook.com/business/help/502981923235522 , https://www.facebook.com/help/instagram/1158274571010880
- Professional account features, cannot be private: https://www.facebook.com/help/instagram/138925576505882
- Music for business accounts; Sound Collection: https://www.facebook.com/business/help/402084904469945
- Instagram API (professional accounts, Page needed only with Facebook Login): https://developers.facebook.com/docs/instagram-platform/overview
- Business Suite without a Page: https://www.facebook.com/business/help/428687951269163
- Adding an Instagram account to a business portfolio: https://www.facebook.com/business/help/368080763391044
- Boosting from Instagram; Apple service fee in the iOS app: https://www.facebook.com/business/help/399076746950660
- A Page is required for Instagram ads in Ads Manager: https://www.facebook.com/business/help/1634705703469129 , https://www.facebook.com/business/help/272348126756182
- Portfolio access levels, partial and temporary access: https://www.facebook.com/business/help/442345745885606 , https://www.facebook.com/business/help/2169003770027706
- More than one full-control person; Security Center: https://www.facebook.com/business/help/216940652189296
- Requiring two-factor in a business portfolio: https://www.facebook.com/business/help/280940009201586
- Instagram two-factor and backup codes: https://www.facebook.com/help/instagram/566810106808145 , https://www.facebook.com/help/instagram/1124604297705184 , https://www.facebook.com/help/instagram/1006568999411025
- Hacked Instagram account: https://www.facebook.com/help/instagram/149494825257596
- Hacked Page or business portfolio: https://www.facebook.com/help/738660629556925
- Login alerts: https://www.facebook.com/business/help/583427765324458
- Reels and Stories ad specs and safe zones: https://www.facebook.com/business/ads-guide/update/video/instagram-reels , https://www.facebook.com/business/ads-guide/update/video/instagram-story
- A/B testing: https://www.facebook.com/business/help/1738164643098669
- iOS 14+ app campaigns, AEM or SKAdNetwork: https://www.facebook.com/business/help/651033805513936 , https://www.facebook.com/business/help/387440828988900
- App-install requirements (SDK, APIs, measurement partners): https://www.facebook.com/business/help/2750680505215705 , https://www.facebook.com/business/help/305102563866933
- Reels length and recommendations; format and cover: https://www.facebook.com/help/instagram/2720958398006062 , https://www.facebook.com/help/instagram/1038071743007909

**TikTok**
- Commercial Music Library: https://ads.tiktok.com/help/article/commercial-music-library
- In-Feed ad specs and safe zones: https://ads.tiktok.com/help/article/tiktok-auction-in-feed-ads?lang=en
- iOS dedicated campaigns: https://ads.tiktok.com/help/article/how-to-create-an-ios-14-5-dedicated-campaign

**YouTube**
- Shorts length and classification: https://support.google.com/youtube/answer/15424877
- Shorts thumbnails: https://support.google.com/youtube/answer/10343433
- Channel permissions: https://support.google.com/youtube/answer/9481328

**Apple**
- Apple Ads rename (2025-04-14) and AdAttributionKit registration: https://ads.apple.com/news
- Ad variations with custom product pages: https://ads.apple.com/app-store/help/ads/0077-create-ad-variations
- Campaign links: https://developer.apple.com/help/app-store-connect-analytics/acquisition/campaign-links
- AdAttributionKit: https://developer.apple.com/documentation/adattributionkit
- Requesting reviews: https://developer.apple.com/documentation/storekit/requestreviewaction

**Unverified** (no primary page confirmed it): an Ads Manager identity without a Facebook Page; Meta's support for
AdAttributionKit; TikTok's numeric safe zones and its business-versus-personal feature list; whether App Analytics
campaign data is limited to opted-in users; Apple Ads' availability and minimums in the Argentina storefront; what
Apple allows for referral rewards.
