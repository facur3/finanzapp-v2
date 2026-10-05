# FinanzApp: App Store launch plan

**Status.** A planning document, written on 2026-10-02 in Producto 25OPS1. **Nothing in it is implemented.** There is no
subscription, no paywall, no StoreKit code, no purchase or analytics SDK, no production identity, no TestFlight build and
no store listing. No account was created, no agreement signed, no build made and no charge incurred to write it.

- **External facts** (Apple, Expo, RevenueCat) were read from the vendors' own pages on **2026-10-02** and are listed
  in §16. Prices, limits and guideline wording change: re-read the source before any decision that depends on one. A
  fact that could not be confirmed on a primary page is written as *unverified*, with what would verify it.
- **Sibling document:** [production-plan.md](production-plan.md) holds the data, backend, Assistant, Apple-integration
  and privacy architecture, the roadmap mapping (its §13) and the readiness table (its §14).
- **Sequencing stays in the roadmap.** [mobile-roadmap.md](mobile-roadmap.md) is the source of order and status; this
  document details what «Producto 25F — monetisation, StoreKit and AI cost control», «Producto 26 — TestFlight, the
  definitive identity and publication» and «Marketing, App Store Optimization, Instagram, advertising materials and
  conversion tests» need, and never reorders them. "No paywall before 25F; no TestFlight or App Store submission before
  26" (roadmap §3) binds everything below.
- **Not legal, tax or accounting advice.** §6 and §13 say only what Apple's pages state and mark what needs a qualified
  professional.
- **«FinanzApp» is the internal working name.** It is not assumed to be the final public App Store brand: other
  products use the name, including a personal-finance app already on the App Store (owner's research, 2026-10-02). The
  brand, naming and identity gate is §9.4; every mention of the name in these documents means the working name.
- **How people find and keep the app** (positioning, social channels, content, the organic-to-paid loop, retention
  experiments, the funnel) is [go-to-market.md](go-to-market.md); ASO detail stays here (§9), analytics rules here (§7).

**Labels.** Each statement that is more than a description carries one of these:

| Label | Meaning |
| --- | --- |
| **EXISTS TODAY** | In the repository now, verified against the file named. |
| **DECIDED** | A binding rule already in `AGENTS.md`, a decision record or the roadmap, or stated as binding in the 25OPS1 brief; the source is cited. |
| **RESEARCH GATE** | An open question that needs reading, a sandbox account or an experiment before a decision can rest on it. |
| **IMPLEMENTATION GATE** | Something that must be built and proven (tests, a development build) before the next step. |
| **OWNER DECISION** | A product, commercial or legal choice only the owner makes. |
| **OWNER ACTION** | A step only the owner can perform (an agreement, a bank form, an account, an authorization of a charge). |
| **REMOTE SETUP** | Configuration of an external service (App Store Connect, EAS, a provider), never done from a commit. |
| **DEVICE QA** | A result that needs a physical iPhone (AGENTS rule 11). |
| **NOT IMPLEMENTED** | Planned only; no code, configuration or account exists. |
| **LAUNCH BLOCKER** | The app cannot be submitted or sold until it is closed. |

---

## 1. Free and Pro

**NOT IMPLEMENTED.** This is a framework for the owner's decision in 25F, not a price list. The roadmap fixes the
order of the work: "margins calculated from measured costs before any price" and "the free local core untouched"
(roadmap, «Producto 25F»). 25F depends on 25A being in real use with measured costs.

### 1.1 Rules that bind the boundary

- **DECIDED (25OPS1 brief; roadmap 25F "the free local core untouched"; decision 001's local-first target).** The
  offline financial core is useful without a subscription: recording and editing expenses, incomes and transfers,
  accounts, cards and instalments, budgets, recurring rules, debts and receivables, Reportes, search, languages, regions
  and currencies.
- **DECIDED (25OPS1 brief).** Data safety and recovery are never behind a paywall: local backup, export, import,
  undo, deletion, and (if cloud sync ever exists) the export and deletion of whatever the cloud holds. A person whose
  subscription ends keeps every record and every way to take it out.
- **DECIDED (AGENTS rule 12; roadmap «Decisions that still bind»).** Local manual entry stays offline and complete.
  Cloud AI is opt-in. A ceiling or an expired subscription degrades to the manual app, never to a locked app.
- **Apple, guideline 4.10:** "You may not monetize built-in capabilities provided by the hardware or operating system,
  such as Push Notifications, the camera…". Face ID lock and notification delivery are therefore not Pro features as
  such.
- **Apple, guideline 3.1.2(a):** a subscription "must provide ongoing value to the customer", last at least seven days
  "and be available across all of the user's devices"; and "you should not take away the primary functionality existing
  users have already paid for". Whatever is free at launch is hard to move behind the paywall later; start the free tier
  where it is meant to stay.
- **Apple, guideline 5.1.1(ii):** "Paid functionality must not be dependent on or require a user to grant access to
  this data" (usage data). Pro never requires analytics consent.

### 1.2 Candidate boundary

| Capability | Free | Pro candidate | Why |
| --- | --- | --- | --- |
| Manual capture, accounts, cards, cuotas, devoluciones, budgets, recurring rules, debts, Reportes, search | Always | No | The core (rules above). No marginal cost: it runs on the device. |
| Local backup, export, import, undo, deletion | Always | Never | Data safety and recovery (rule above). |
| Hide amounts, Face ID lock, app-switcher cover (25D) | Always | No (owner, 2026-10-04: essential privacy and safety are never paywalled) | Privacy protections, and guideline 4.10 for Face ID. |
| Local reminders (25D) | Always | No | Guideline 4.10 (notifications); they run on the device at no cost. |
| Assistant, cloud AI (25A) | No permanent free allowance is promised (owner, 2026-10-04); whether acquisition uses no trial, a StoreKit introductory Pro trial or another compliant introductory offer is a 25F **OWNER DECISION** | **Pro candidate** (owner, 2026-10-04) | The one capability with a real marginal cost per request. Pro is **generous fair use** with invisible anti-abuse controls and monetary ceilings: no permanent message counter, and a warning only near a real limit. The limits come from 25A's AI evaluation and the measured-cost report of 25F, never from a guess. Server-side ceilings apply to every request (production-plan.md §6). |
| Voice input for the Assistant (25A, last slice) | **OWNER DECISION** | Candidate (owner, 2026-10-04: in the Pro candidate bundle) | A transcription provider adds its own cost per request. |
| Theme packs (25F) | Electric Lime, the default and current identity | **Pre-launch Pro launch candidate** (owner, 2026-10-04) | Additional themes (for example Forest, Sapphire) selectable once the StoreKit entitlement and paywall exist; each passes light, dark, accessibility and semantic-colour QA before launch. Not built; does not block 25A; before the Mercado Pago consumer-sync research if the schedule allows. |
| Advanced Excel-friendly export and report package | Basic CSV / export, always (data portability is never hostage to Pro) | Candidate (owner, 2026-10-04) | The advanced presentation is the Pro value; the person's data always leaves freely. |
| Optional cloud backup and multi-device sync (25E) | Export and deletion of cloud data, and restoring a cloud backup that already exists, always | Candidate (new cloud backups and live sync) | Ongoing storage and operations cost; fits Apple's "cloud support" example of an acceptable subscription. Only if 25E is still chosen. |
| Wallet capture and its Live Activity (25A2) | **OWNER DECISION** | Candidate ("advanced automation") | It runs on the device with no marginal cost, and it is the product's fastest capture. Charging for it trades reach for revenue; decide with usage evidence. |
| Widgets, Apple Watch surface (25D) | **OWNER DECISION** | Candidate | No marginal cost. Check guideline 4.10 before charging for an OS surface. |
| Financial calendar, saved searches, advanced filters, rollover budgets, goals, CSV import (25C, 25C2) | **OWNER DECISION** | Candidates ("advanced analytics and features") | Development cost only. Each one moved to Pro narrows the free product; none is required for the core to be useful. |
| Authorised bank connections (25E, if they ever exist) | — | Candidate | An aggregator contract would carry a per-connection cost. None exists and none is implied. |

**Current owner position (2026-10-04, candidates, not final entitlements or prices).** Free: the manual financial core,
essential privacy and safety (Face ID, «Ocultar importes»), basic data portability and CSV. Pro candidates: the
Assistant / AI and future voice AI; theme packs (pre-launch, 25F); the advanced Excel / report export; future paid sync
or automation where justified. No permanent free AI allowance and no permanent message counter are promised.

**OWNER DECISION.** Which candidates become Pro. The framework for choosing: (1) does it cost money per use (AI,
cloud storage, an aggregator)? Those are the natural Pro capabilities and can carry the subscription alone. (2) Is it a
safety, privacy or recovery function? Then it stays free. (3) Everything else is a commercial judgment made with the
evidence of real use, after TestFlight.

### 1.3 Subscription mechanics: what Apple provides and what we decide

| Item | What Apple provides (verified, §16) | What we must decide or build |
| --- | --- | --- |
| Monthly | A standard duration (Schedule 2 §3.8: weekly, monthly, bi-monthly, tri-monthly, semi-annual, annual). | **OWNER DECISION:** offer it, and at what price. |
| Annual | Same; shown with the monthly plan in one subscription group so a person holds only one. A monthly plan with a 12-month commitment also exists outside the US and Singapore since 2026-04-27; its payload fields are documented only as stubs (*unverified* details). | **OWNER DECISION:** annual price and its discount against monthly. |
| Optional trial | Introductory offers: free trial, pay as you go or pay up front. "Customers can redeem one introductory offer per subscription group." Configured per subscription and territory in App Store Connect. | **OWNER DECISION (25F product/experiment):** no trial, a StoreKit introductory Pro trial, or another compliant introductory offer, and its length; not decided by 25A-04. With AI as the paid capability a trial has a real cost per trial user; the measured-cost report decides. |
| Regional pricing | "Up to 800 price points"; a base storefront generates prices for "the other 174 storefronts and 43 currencies". For auto-renewable subscriptions "Apple will not make price adjustments" on its own after tax or FX movements. | **OWNER DECISION:** the base storefront and any manual prices per storefront (§10). Subscription prices need our own periodic review. |
| Introductory, promotional and win-back offers | Introductory (new subscribers); promotional (existing or former subscribers, needs a server-generated signature); win-back (churned subscribers, eligibility set in App Store Connect); offer codes (§4.5). | Start with none or with one introductory offer. Promotional offers need server signing: **NOT IMPLEMENTED**, not needed for launch. |
| Upgrade / downgrade | Within one subscription group Apple handles the change: an upgrade is immediate, a downgrade applies at the next renewal (`DID_CHANGE_RENEWAL_PREF`). Guideline 3.1.2(b): people "should not be able to inadvertently subscribe to multiple variations of the same thing". | One subscription group, one entitlement ("Pro"), monthly and annual as its two products. |
| Restore purchases | `AppStore.sync()`; and "When users reinstall your app or download it on a new device, the app automatically has all transactions available to it upon initial launch." Guideline 3.1.1 requires a restore mechanism. | A «Restaurar compras» action on the paywall and in Más (§3). |
| Cancellation | Done in the system's subscription settings; `AppStore.showManageSubscriptions(in:)` opens them in the app. Refunds are Apple's (Program License Agreement, Attachment 2 §3.4). | A «Administrar suscripción» row that opens Apple's sheet. Never a custom cancellation flow, never an obstacle. |
| Grace period | Opt-in in App Store Connect: 3, 16 or 28 days. During it "ensure that you provide full service". | **OWNER DECISION:** enable it and for how long. Recommended on: it avoids cutting access for a card problem. |
| Billing retry | "The App Store attempts to collect payment for up to 60 days"; since iOS 16.4 a system sheet asks the person to fix billing on launch. | After the grace period Pro capabilities stop; the local app is unaffected. Copy points to Apple's billing page, no nagging. |
| Family Sharing | Opt-in per product, and one-way: "After you enable Family Sharing for an Apple In-App Purchase, you can't turn it off." Up to five family members. | **OWNER DECISION**, default **off**: with AI as the paid capability one payment would fund up to six people's usage, and the switch cannot be undone. Revisit only with cost data. |
| Multiseat purchases | "Multiseat purchases are turned on by default for all auto-renewable subscriptions" created now. | **REMOTE SETUP:** review this setting when the products are created and switch it off unless seats are wanted. |

---

## 2. StoreKit or RevenueCat

**NOT IMPLEMENTED.** No purchase library is installed (`apps/mobile/package.json` has none) and none is added by this
document. The comparison below is a research deliverable for the owner's decision in 25F.

**What Expo provides (verified 2026-10-02).** Expo ships no first-party in-app purchase module. Its guide names two
libraries: `react-native-purchases` (RevenueCat's SDK) and the community `expo-iap`. Both need native code, so both need
a new development build; neither runs in Expo Go, and a JS bundle cannot exercise a purchase. Option A below therefore
also depends on a third-party open-source library (`expo-iap`, which wraps StoreKit 2) or on our own Expo module in
Swift.

- **A. Direct:** StoreKit 2 on the device (through `expo-iap` or an own module), the App Store Server API and App Store
  Server Notifications V2 received by our backend (`api/mobile`), our own entitlement table.
- **B. RevenueCat:** `react-native-purchases` on the device; RevenueCat's backend receives Apple's notifications,
  keeps the entitlement state and offers a dashboard, webhooks and an API. StoreKit and Apple remain underneath.

| Axis | A. Direct StoreKit 2 + our backend | B. RevenueCat |
| --- | --- | --- |
| Implementation complexity | Highest. Client purchase, restore and `Transaction.updates` handling; a notification endpoint with JWS verification (Apple's App Store Server Library); idempotency, reconciliation, an entitlement table and an admin view (§4, §5): all ours to build, test and operate. | Lower. The SDK and their backend cover purchase, restore, lifecycle and entitlement; we write the paywall, the «Restaurar» action and a small webhook consumer if the server needs the state (it does, for AI quotas). |
| Entitlement reliability | As good as our implementation. Apple is authoritative; mistakes in ordering, duplicates or missed notifications are our bugs. On-device `currentEntitlements` works without any server. | Their core product, used at scale; adds a dependency on their availability. "Trusted Entitlements" verification is informational: the app must check it. |
| Dashboard | None unless built. App Store Connect's Sales and Trends gives aggregates, not a per-customer view. | Customer lists and history, searchable by app user ID, transaction ID or Apple order ID. |
| Webhooks | Apple's notifications directly: five retries in production (1, 12, 24, 48, 72 hours), one attempt in sandbox, 180 days of history to backfill. | RevenueCat webhooks (HMAC-signed, up to five retries) on top of Apple's; RevenueCat asks to be Apple's notification URL and can forward the raw events to us. |
| Experiments, paywalls | None. Apple's Product Page Optimization tests the store page, not the paywall. | Remote paywalls and price experiments. A remotely configured paywall would sit outside `docs/mobile-design.md`; optional and not assumed. |
| Analytics | App Store Connect subscription reports (§8) plus whatever we compute from notifications. | Charts for subscription metrics, on top of App Store Connect. |
| Cost (read 2026-10-02; changes) | No vendor fee. Our hosting and our time. | Free "for up to $2,500 in monthly tracked revenue", then "1% of what you track"; tracked revenue is "measured before store commission and taxes", and past the threshold the 1% applies to all of it, not only the excess ([pricing](https://www.revenuecat.com/pricing/), [billing](https://www.revenuecat.com/docs/welcome/set-up-revenuecat/account-management)). A charge needs the owner's authorization (AGENTS rule 3). |
| Vendor lock-in | None beyond the client library. | Subscriptions always live with Apple. Leaving means rebuilding the client code, the server verification and the entitlement store, re-mapping their app user IDs to Apple transactions, and losing any RevenueCat-granted entitlements (they exist only there). Receipt export is by request to their support. |
| Privacy | Purchase state reaches only Apple and our backend. | A third party receives purchase history and an app user ID. Their guidance: declare **Purchases**; **User ID** if a custom ID is used; no payment information is collected. Their sub-processors, data residency and retention were not read in detail (*unverified*; **RESEARCH GATE**). |
| Debugging | Full visibility, full responsibility; sandbox quirks are ours to learn. | Their dashboard shows each customer's events; an extra layer when something differs from Apple's state. |
| Android later | A second, separate implementation for Google Play Billing, and a second server integration. | The same SDK call and entitlement cover Google Play. |

### Recommendation and its status

**Recommendation: B, RevenueCat, behind our own small entitlement port, for the first paid release.** Reasons:

1. The app is built and operated by one person. Option A's server side (verified ingestion, idempotency, grace and
   retry states, refunds, reconciliation, an admin view) is a subscription backend to build and keep correct; it is
   exactly the work §4 and §5 describe, and none of it is product.
2. It answers the operational questions of §4 ("who has Pro, on which plan, in which state") on day one.
3. It costs nothing until the app earns more than the threshold above, and then a known percentage.
4. Android (roadmap §5) reuses it.

Conditions that make this acceptable in a local-first app: the SDK is initialized only where a purchase or an
entitlement check needs it; the app user ID is an opaque random identifier, never an email or a name; no customer
attributes are sent; the app keeps reading the entitlement through one module (`entitlements`, to be designed) so that
replacing B with A changes one adapter; and the server-side AI quota reads the entitlement from our own table, fed by
webhooks, never from the client's word.

**Status: a recommendation, not a decision.** It becomes a decision only by the **OWNER DECISION** in 25F. These gates
can change it:

- **RESEARCH GATE: library trial.** `react-native-purchases` on Expo SDK 57 / React Native 0.86 with the New
  Architecture is *unverified* (only its peer range `react-native >= 0.73.0` was read). `expo-iap` states SDK 57 as its
  validated baseline, which is the library's own claim. Try each in a development build before choosing: the build
  succeeds, a sandbox purchase and restore work, `appAccountToken` and the signed transaction are reachable. No
  `expo prebuild --clean` at the repo root (AGENTS).
- **RESEARCH GATE: data processing.** Read RevenueCat's DPA, sub-processor list and retention before sending any
  purchase to it; they feed the privacy policy and the App Privacy label (§13).
- **OWNER DECISION: the privacy stance.** If "no third party other than Apple sees a purchase" is a requirement, the
  answer is A, and its cost is the server work above.
- **OWNER DECISION: scope of Pro.** If Pro at launch were only on-device features with no server-side quota, a third
  path exists: StoreKit 2 on the device alone (`Transaction.currentEntitlements`), no backend mirror and no vendor. It
  stops being enough the moment the server must know who is Pro, which AI quotas require.
- **Either way, 25F's gate stands:** sandbox purchases and restores on the iPhone (**DEVICE QA**), and "receipts
  validated server-side" (roadmap 25F), which in B is RevenueCat's verification plus our webhook check.

---

## 3. Paywall

**NOT IMPLEMENTED.** No UI is designed here; when it is, it follows `docs/mobile-design.md` and gets its own section
there.

### 3.1 Where it can appear and what triggers it

- **DECIDED (25OPS1 brief; production-plan.md §12).** Never during the first opening. The first opening explains the
  product and optionally creates an account (AGENTS rule 15); a paywall there would block understanding the core.
- **Contextual, at the moment of value.** The paywall opens only because the person intentionally asked for a Pro
  capability (the Assistant or voice without Pro, a theme pack, the advanced export), or tapped the «FinanzApp Pro» row
  in Más. It is always the result of the person's own action. There is no permanent free AI allowance or message
  counter to run out (owner decision, 2026-10-04); a Pro subscriber is warned only near a real fair-use limit.
- **One permanent, quiet entry:** a «FinanzApp Pro» row in Más, which shows the plans to a free user and the status to
  a subscriber.
- **Never:** on first launch, on a timer, between tabs, over a form in progress, as a full-screen interruption of manual
  capture, as any unrelated interruption, or as a notification.
- **Onboarding versus later.** Onboarding may mention, in one line at most, that the app is free and Pro exists; the
  offer itself is contextual and later. **OWNER DECISION** if even that line is wanted.

### 3.2 What the paywall shows

Apple's requirements (guideline 3.1.2(c), Schedule 2 §3.8, and "Clearly describing subscriptions"):

- the subscription's name and what it includes, in concrete terms («El Asistente y la voz, con uso amplio», «Temas
  adicionales», «Exportación avanzada para Excel», not "Premium"); never a monthly message count (§1.2: generous fair
  use, no permanent counter);
- each plan's duration and **full renewal price**, localized, as "the most prominent pricing element"; the annual
  plan's per-month equivalent, if shown, is subordinate in position and size;
- for a trial: "how long the free trial lasts and the price billed once the free trial is over";
- that it renews automatically until cancelled, and where to cancel (Apple's subscription settings);
- **«Restaurar compras»**;
- links to the **Terms of Use** and the **Privacy Policy**, inside the app; the same two links go in the App Store
  metadata (§12).

FinanzApp's own rule: a visible close control, and closing returns to exactly where the person was.

Monthly and annual are shown side by side with honest arithmetic; no preselected plan disguised as the only one, no
countdown, no false scarcity, no "No thanks, I don't want to save money" wording, no repeated prompts after a refusal,
no testimonial that is not from a real, consenting user (roadmap 25F). The price shown is the one StoreKit returns for
the person's storefront, never a hard-coded string.

### 3.3 States

| State | Behaviour |
| --- | --- |
| Closed without buying | Everything free keeps working. The capability that opened the paywall stays unavailable and says why, once. |
| StoreKit unavailable or offline | The paywall says purchases are unavailable right now and offers to retry; no price is invented. The manual app is unaffected. A person who is already Pro is not locked out by being offline: the last verified entitlement is used (**RESEARCH GATE:** `currentEntitlements` with no network after a prior verified launch). |
| Purchase pending (Ask to Buy, bank approval) | "Pending" is shown; the entitlement arrives later through the transaction listener. |
| Purchased | The paywall closes to where the person was; Más shows the plan, the renewal date and «Administrar suscripción». |
| In grace period | Pro stays on; a discreet line says the payment needs attention and links to Apple's billing page. |
| Billing retry after grace, or expired | Pro capabilities stop; the row in Más says the subscription ended and offers to resubscribe. No data is removed or hidden; anything created with Pro stays readable and exportable. |
| Refunded or revoked | As expired. |

### 3.4 Accessibility, localization and regional pricing

- VoiceOver reads each plan as one element: name, duration, price and renewal, with spoken amounts built by the app's
  spoken formatters (the `voiceover.node.ts` guard applies). Large Text does not truncate the price or the renewal
  terms; targets are 44 pt; Reduce Motion is honoured; the screen works in light and dark.
- Every string comes from the catalogues (`t('…')`), in Spanish and English, with the legal lines reviewed in both.
  Product display names and descriptions are also localized in App Store Connect (35 and 55 characters).
- Prices, currency and period come from StoreKit's localized product, so a person sees their storefront's price. The
  app's own money formatting (`moneyText`) is for ledger amounts, not for store prices.
- **DEVICE QA:** the paywall, a sandbox purchase, a restore and each state above on the iPhone, in both languages.

---

## 4. Subscriber identity and admin

**NOT IMPLEMENTED.** This section defines the identity chain and the minimum operational state, whichever option of §2
is chosen.

### 4.1 What Apple tells us about the buyer

**Apple does not give the developer the buyer's Apple Account email or name.** Apple's own statement: "The receipts
provided to developers do not include personal data; however, developers could seek to associate them with personal
data from your use and download of their apps, if you have provided it to them" ([App Store & Privacy](https://www.apple.com/legal/privacy/data/en/app-store/)).
The signed transaction's fields are identifiers, product, dates, price, ownership, offer and revocation data; none is a
name or an email. The one contractual exception (periodical content, Schedule 2 §3.12) does not apply. Sign in with
Apple is a separate system: it gives a stable user identifier and an email that the person may replace with a relay
address, and nothing links it to the Apple Account that paid.

So a subscriber cannot be looked up "by their Apple email". Support starts from an identifier the person can read to
us from the app.

### 4.2 The identity chain

| Link | What it is | Limits |
| --- | --- | --- |
| FinanzApp account id | Exists only if and when cloud features create an account (25A's session, 25E). The durable handle across devices. | No account exists today, and none is required for the local core (AGENTS rule 15; guideline 5.1.1(v)). Pro must work without one unless the Pro capability itself needs the account. |
| `appAccountToken` | "A UUID you create at the time of purchase that associates the transaction with a customer on your own service." Returned in the transaction, the renewal info and the notifications. | We generate it; it authenticates nobody. Absent on purchases made outside the app (an offer code redeemed in the App Store) until set with the server endpoint *Set App Account Token*. Not supported for Family Sharing members. |
| `originalTransactionId` | Apple's identifier of the subscription: "save the original transaction identifier to uniquely identify auto-renewable subscriptions". The key of the server-side record. | Identifies a subscription, not a person. |
| `appTransactionId` | "A single, globally unique appTransactionID for each Apple Account that downloads your app"; stable across reinstall, refund and storefront change; exists before any purchase. | Still not a personal identity. Stability across reinstall and two devices is a **RESEARCH GATE** to confirm in sandbox. |
| Server entitlement state | Our mirror: which account or anonymous purchaser holds Pro, from which product, until when (§5). | A mirror. Apple is authoritative. |
| App Store Server Notifications V2 | Apple's signed lifecycle events, which keep the mirror current (§5). | One URL per environment; with RevenueCat that URL is theirs and they forward. |

Before an account exists, the purchaser is anonymous: the server record is keyed by `originalTransactionId` (and, with
RevenueCat, by its anonymous app user ID, which is regenerated if the app is deleted and reinstalled; a restore
reconnects the purchase). When an account exists, the app sets the `appAccountToken` (or logs the app user ID in) so
the subscription follows the account. The mapping between an account and a purchase is made by the device that holds
both; the server accepts it only together with a verified signed transaction.

A proposal for support, **NOT IMPLEMENTED**: a «ID de soporte» line in Más that the person can copy, showing the
identifier the admin view is keyed by. No email is needed to help someone.

### 4.3 The operational questions

| Question | Answer |
| --- | --- |
| How do I know who has Pro? | The server entitlement record (below), kept current by notifications, lists every active entitlement. "Who" is an account id when one exists, otherwise an anonymous purchaser identified by `originalTransactionId`. In option B the RevenueCat dashboard shows the same list. Never a name or an Apple email. |
| How do I know who pays? | The record's `source` and `ownership`: an App Store purchase (`PURCHASED`) pays; a Family Sharing member (`FAMILY_SHARED`), a free offer code and a complimentary grant do not. Money itself is only in App Store Connect's reports (§6); the signed transaction's `price` is not accounting data (Apple: "Don't use the price or currency values for any revenue reconciliation"). |
| How do I see monthly versus annual? | The record's `productId`; `autoRenewProductId` in the renewal info shows a pending change of plan. Aggregates: App Store Connect → Sales and Trends → Subscriptions (§8). |
| How do I know trial, cancelled, billing retry, expired? | Apple's status per subscription: 1 active, 2 expired, 3 billing retry, 4 grace period, 5 revoked; plus `offerType`/`offerDiscountType` (a trial or an offer) and `autoRenewStatus` (off means cancelled but still paid through the period). They arrive by notification and can be re-read with *Get All Subscription Statuses*. |
| How do I give myself or a tester complimentary access? | §4.5. |

### 4.4 The minimum admin record

One row per entitlement, in the backend database of the environment (production-plan.md §2, §4); **NOT IMPLEMENTED**.
An internal, read-mostly view over it is the whole "admin" this plan asks for, and with option B the RevenueCat
dashboard may be that view.

| Field | Content |
| --- | --- |
| User / account | The FinanzApp account id, or null for an anonymous purchaser; the `appAccountToken` if set; the `appTransactionId` if known. |
| Entitlement | `pro` (one entitlement at launch). |
| Source | `app_store`, `offer_code`, `family_shared`, `internal_grant` (§4.5), `sandbox`. |
| Product | The product id (monthly or annual) and, if different, the product it will renew as. |
| Original transaction | `originalTransactionId`, and the latest `transactionId`. |
| Status | Apple's status: active, grace period, billing retry, expired, revoked. |
| Renewal state | Auto-renew on or off; the expiration intent when it lapsed. |
| Expiration | `expiresDate` of the current period; the grace period's end when in grace. |
| Trial / offer | Whether the current period is a trial or an offer, which one, and when it ends. |
| Grace / billing retry | `gracePeriodExpiresDate`, `isInBillingRetryPeriod`. |
| Environment | `Production` or `Sandbox`; the two are never mixed in one table view. |
| AI quota / usage | The person's quota for the period and what was used: counts and cost, never prompt content (production-plan.md §6). |
| Audit | The last notification applied (`notificationUUID`, type, signed date), and for an internal grant who granted it, why, and when it ends. |

The table sits behind row-level security; nothing in the app or any client can read other people's rows, and only a
server-side role writes it (production-plan.md §4).

### 4.5 Testing and complimentary access

**Developer and tester purchases.**

- **Sandbox** needs App Store Connect configuration and a signed Paid Apps Agreement, charges nothing, and renews fast
  (by default one month is five minutes, up to 12 renewals).
- **TestFlight** builds "always run in the sandbox environment": purchases are free, and "each subscription is renewed
  daily, up to 6 times within a 1-week period, regardless of the subscription's duration". A tester's Pro therefore ends
  after about a week unless bought again. Billing retry can only be tested with a Sandbox Apple Account.
- Sandbox and TestFlight transactions carry `environment: Sandbox` and reach the sandbox notification URL; they never
  grant anything in production (production-plan.md §2).

**Complimentary access for real users on the App Store build.**

| Mechanism | Status |
| --- | --- |
| **Subscription offer codes** (free, optionally non-renewing) | The Apple-endorsed path. One-time-use codes or a custom code; "customers are limited to redeeming one code per offer"; up to 1 million redemptions per app per quarter; the app must be available on the App Store; proceeds are waived for the free period and the codes may not be sold (Schedule 2 §3.13). Suitable for the owner, friendly testers and support cases. |
| In-app purchase promo codes | Ended: "March 27, 2026 — Promo codes for In-App Purchases are no longer supported" ([App Store Connect release notes](https://developer.apple.com/help/app-store-connect/release-notes/)). App-level promo codes still exist but give a free copy of a paid app, which is irrelevant to a free app with a subscription. |
| Renewal-date extension | For someone already subscribed: twice per calendar year, up to 90 days each. A support tool, not a grant. |
| **Controlled internal entitlement override** | **OWNER DECISION**, with a stated uncertainty. A server-side row with `source = internal_grant` (or a RevenueCat granted entitlement, which RevenueCat positions for "beta users" and "customer support issues"). Guideline 3.1.1 says "Apps may not use their own mechanisms to unlock content or functionality, such as license keys… QR codes…"; no Apple page read addresses a grant made silently from a developer's backend, so its compliance is *unverified*. If the owner allows it, the limits are: development and staff accounts only, a named short list, each grant with a reason and an end date in the audit fields, no user-facing way to obtain one (no code field, no key, no hidden gesture), and review at each release. |

**Never an unrestricted production backdoor.** No build contains a secret switch, debug menu or redeem box that
unlocks Pro; no environment variable turns Pro on for everyone; the staging override list never applies to production.

---

## 5. App Store Server Notifications and entitlements

**NOT IMPLEMENTED.** With option A of §2 this is our own code in `api/mobile`; with option B RevenueCat performs the
ingestion and we consume its webhooks under the same rules (verify, deduplicate, re-read, then write). The contract is
the same either way.

**Authority. DECIDED (25OPS1 brief).** Apple and StoreKit are authoritative for App Store transactions. Our backend
only mirrors the entitlement so that server-side features (AI quota) and, later, other devices of the same account can
read it. When the mirror and Apple disagree, Apple wins and the mirror is corrected. The mirror is never a place to
edit a subscription, and an entitlement is never taken from a value the client sends without a verified signed
transaction.

**Ingestion.**

1. Apple posts `signedPayload` (a JWS) to our HTTPS endpoint: one URL for production and one for sandbox, each landing
   in its own environment's database (production-plan.md §2). New implementations use Version 2.
2. **Verify before reading.** The current Apple recommendation is its App Store Server Library, whose
   `SignedDataVerifier` checks the JWS signature and the `x5c` certificate chain against the Apple root certificates
   downloaded from Apple PKI, and checks the bundle id and environment. (That the chain ends at "Apple Root CA - G3"
   specifically is stated by Apple PKI's list, not in words by the docs: *unverified*; **RESEARCH GATE** to confirm by
   decoding a sandbox payload, and that the library runs in the `api/mobile` runtime.) An unverified payload is rejected
   and logged without its content.
3. **Idempotency.** `notificationUUID` is stored with a unique constraint: "Use this value to identify, and ignore,
   duplicate notifications." A duplicate answers 200 and changes nothing.
4. **Ordering.** Notifications can arrive late or out of order (Apple retries for days). The record keeps the latest
   `signedDate` applied and ignores an older event for the same subscription; when in doubt the handler calls *Get All
   Subscription Statuses* and writes what Apple says now.
5. **Response.** 200 only after the event is durably recorded; a failure answers 5xx so Apple retries (five times in
   production, at 1, 12, 24, 48 and 72 hours; once in sandbox).
6. **Logging.** Type, subtype, environment, identifiers and outcome; never the full payload in logs.

**Entitlement updates by event.**

| Event | `notificationType` / subtype | Entitlement |
| --- | --- | --- |
| First purchase, or an offer code as first purchase | `SUBSCRIBED` / `INITIAL_BUY` | Grant; create the record. |
| Resubscribe after expiry | `SUBSCRIBED` / `RESUBSCRIBE` | Grant. |
| Renewal | `DID_RENEW` | Keep; move the expiration. |
| Recovered from billing retry | `DID_RENEW` / `BILLING_RECOVERY` | Restore. |
| Cancellation (auto-renew turned off) or turned back on | `DID_CHANGE_RENEWAL_STATUS` / `AUTO_RENEW_DISABLED`, `AUTO_RENEW_ENABLED` | No change yet: paid through the period. Record the renewal state. |
| Plan change | `DID_CHANGE_RENEWAL_PREF` / `UPGRADE`, `DOWNGRADE` | Upgrade now; downgrade at the next renewal. |
| Renewal failed, grace period on | `DID_FAIL_TO_RENEW` / `GRACE_PERIOD` | Keep full service through the grace period. |
| Renewal failed, no grace | `DID_FAIL_TO_RENEW` | Billing retry: Pro may stop; Apple retries for up to 60 days. |
| Grace period ended | `GRACE_PERIOD_EXPIRED` | Stop Pro; retry continues. |
| Expiration | `EXPIRED` / `VOLUNTARY`, `BILLING_RETRY`, `PRICE_INCREASE`, `PRODUCT_NOT_FOR_SALE` | Revoke; keep the record. |
| Refund | `REFUND` | Revoke (`revocationDate`, `revocationReason`). |
| Refund reversed | `REFUND_REVERSED` | Reinstate. |
| Family access lost | `REVOKE` | Revoke for that member (only if Family Sharing is ever enabled). |
| Offer redeemed on an active subscription | `OFFER_REDEEMED` | Per subtype. |
| Price increase | `PRICE_INCREASE` / `PENDING`, `ACCEPTED` | None; record it. |
| Renewal date extended by us | `RENEWAL_EXTENDED` | Extend. |
| Test | `TEST` | None; proves the endpoint. |

**Restore and reconciliation.**

- **On the device:** StoreKit delivers existing transactions on a new install; «Restaurar compras» calls
  `AppStore.sync()` only on the person's tap. The app sends the verified signed transaction to the backend, which
  verifies it again and attaches the subscription to the current account or anonymous purchaser.
- **On the server:** a scheduled reconciliation re-reads *Get All Subscription Statuses* for records that are active
  but past their expiration, in grace or in retry; and *Get Notification History* (180 days in production, 30 in
  sandbox) backfills after an outage of our endpoint.
- **In the app:** a server-side Pro check that fails for a network reason never locks the manual app, and an on-device
  verified entitlement is enough to show Pro's local features offline.

**IMPLEMENTATION GATE (25F), in sandbox:** a duplicate `notificationUUID`; out-of-order delivery; a `TEST` round trip;
grace then recovery, and grace then expiry; refund then reversal; an offer code redeemed in the App Store with the app
closed (no `appAccountToken`) and its later association; the backfill from notification history.

---

## 6. Money: proceeds, banking and tax

**NOT IMPLEMENTED; nothing is sold.** This section states what Apple's pages say. It draws no tax or legal conclusion.

### 6.1 The flow

```
customer
  → Apple In-App Purchase (Apple acts as the developer's agent or commissionaire under Schedule 2 §1 and Exhibit A;
    Apple collects the payment and issues refunds; who the seller is for tax purposes is for the accountant)
  → Apple's commission, and the taxes and adjustments Apple applies in that storefront
  → App Store Connect financial reports (per fiscal month, Apple's fiscal calendar)
  → proceeds (consolidated per currency, converted by Apple's bank to the bank account's currency)
  → the one bank account configured in App Store Connect
```

Facts, each from the page cited in §16 (read 2026-10-02):

- **Commission.** Standard: "thirty percent (30%) of all prices payable by each End-User", and 15% for an
  auto-renewing subscription's renewals after "greater than one year of paid subscription service" (Schedule 2 §3.4).
  **App Store Small Business Program:** "a reduced commission rate of 15% on paid apps and Apple In-App Purchases" for
  developers with up to 1 million USD in proceeds in the prior calendar year "as well as developers new to the App
  Store"; it requires enrollment by the Account Holder and is not automatic. Prices are "net of any and all taxes
  collected". "Different commission rates and fees may apply" in Brazil, the European Union, Japan, the Netherlands,
  Russia and South Korea.
- **Taxes.** In the regions listed in Schedule 2's Exhibit B, Apple collects and remits the taxes on sales to end
  users; for regions not listed, "You shall be solely responsible for the collection and remittance of such taxes as
  may be required by local law." Withholding taxes on the developer's remittances are "solely for Your account".
- **Refunds** are issued by Apple, not by the developer.
- **Reports.** Financial reports arrive "by the first Friday of the current fiscal month" for the previous fiscal
  month and "only include paid transactions". Their payment fields: Earned, Taxes and Adjustments, Total Owed, Exchange
  Rate, Proceeds, Payment Date. "App Store Connect reporting is your source of record for financial and accounting
  purposes."
- **Payment.** With the Paid Apps Agreement in effect, banking information provided and the minimum threshold
  exceeded, "payments are made to the bank account and the currency you provided within 45 days of the last day of the
  fiscal month in which the transaction was completed": one payment per fiscal month. The default minimum threshold is
  40 USD where the bank country and currency are not in Apple's table.
- **FX and fees.** "Our bank converts payment amounts into the currency of your bank account. The exchange rate is
  established by our bank"; currency differentials or fees of Apple's bank "may be deducted"; "You remain responsible
  for any fees (e.g., wire transfer fees) charged by Your bank or any intermediary banks."
- **RevenueCat, if used,** does not touch this flow: money goes from Apple to the developer. RevenueCat bills its own
  fee separately (§2).

### 6.2 Pre-launch checklist (App Store Connect → Agreements, Tax, and Banking)

All **OWNER ACTION**; all **LAUNCH BLOCKER** for anything paid (and the Paid Apps Agreement is a prerequisite even for
sandbox purchase testing). None is done from the repository. Some are irreversible.

| Step | What Apple says | Notes |
| --- | --- | --- |
| Paid Apps Agreement | "The Account Holder must sign the Paid Apps Agreement." "Once you've accepted the terms of this agreement, you can't undo this action." | First, before tax forms and banking. |
| Contact and legal identity | The agreement is with the enrolled legal entity or individual; contacts (legal, finance) are entered in App Store Connect. | Whether the developer account should be an individual or an organization is an **OWNER DECISION** with legal weight (see §12, guidelines 3.2.1(viii) and 5.1.1(ix), and the DSA trader status). |
| Tax forms | "All developers must complete a US tax form"; outside the United States "the W-8BEN, W-8BEN-E, or W-8ECI may be required" after a questionnaire. "Once you submit this information, you won't be able to make any changes in App Store Connect." | Which form applies and what to answer is a question for a qualified accountant, before submitting. |
| Banking | One bank account: "You may only receive payments at one bank." The account holder name "exactly as it appears on your bank account". "If you can't identify your bank in App Store Connect, it may be that Apple can't send payments to that bank." | Apple's two banking pages differ on whether the account must belong to the enrolled entity (one says the account number "of the legal entity or individual enrolled", the other that the holder name "doesn't have to match the legal entity name"). *Unverified*; resolve with Apple Support before relying on either. |
| Payout currency | The bank account's currency "is also the currency you will be paid in". | Decided by the bank account chosen (gate below). |
| Small Business Program | Enrollment by the Account Holder. | Do it before the first sale. |
| Reconciliation | Monthly: financial report ↔ payment received ↔ our own count of active subscriptions. | The ledger of record is Apple's report, not the transaction `price` field. |
| Reports access | Roles Admin, Finance, Sales in App Store Connect. | Download and keep each month's report outside the repository (it is public). |

### 6.3 The owner, tax and banking gate

**OWNER DECISION, future, with qualified review.** No destination is chosen or recommended here: not a particular
bank, not a foreign-currency account, not a fintech or payout service. The comparison is to be made only among
destinations that Apple supports (those that can be found and saved in App Store Connect's banking form), on these
criteria:

| Criterion | Destination A | Destination B | Destination C |
| --- | --- | --- | --- |
| Account ownership / holder-name requirement versus the enrolled developer | | | |
| Supported country and currency in App Store Connect | | | |
| FX conversion: who converts, at what rate, and when | | | |
| Receiving fees | | | |
| Intermediary-bank deductions or delays | | | |
| Accounting and tax consequences (for the accountant) | | | |
| Settlement speed after Apple's payment date | | | |
| Reporting and statements for reconciliation | | | |

**Argentina.** Apple's pages mention Argentina in three places: its end users are served by Apple Services LATAM LLC
as agent (Schedule 2, Exhibit A); it belongs to the "Latin America and the Caribbean" report region, with report
currency USD; and it is **not** in Exhibit B's list of regions where Apple collects and remits taxes, nor in the
tax-forms page's country sections, nor in the minimum-threshold table. No Argentina-specific constraint on banking,
documents or payout currency was found on Apple's pages; that is an absence in the pages read, not proof that none
exists. Everything about Argentine tax, FX settlement and invoicing is **for a qualified accountant** and deliberately
not answered here.

---

## 7. Product analytics

**NOT IMPLEMENTED. EXISTS TODAY:** the app sends no analytics, has no analytics SDK and makes one network call, the
exchange-rate download (§13). **DECIDED:** "no silent telemetry" and "consumption telemetry (usage and cost, not
content)" (roadmap, «Producto 25F»); "cost telemetry without content" (roadmap, «Decisions that still bind»); conversion
tests "only with consent and without silent telemetry" (roadmap §5).

### 7.1 Principles

- **Product analytics and ledger content are separate things.** An analytics event says that something happened ("a
  first expense was recorded"); it never says what the expense was. The ledger never leaves the device for analytics.
- **Consent first.** Apple, guideline 5.1.1(ii): "Apps that collect user or usage data must secure user consent for
  the collection, even if such data is considered to be anonymous." Analytics is off until the person turns it on, is
  explained in plain words, can be turned off in Más at any time, and is never a condition of any feature, free or paid.
- **Answer a question or do not collect.** Each event exists because a named product question needs it (roadmap §5:
  "measure repeated use, time to record, Assistant corrections and willingness to pay before any claim").
- **Apple's data first** (§8): what App Store Connect already reports is not collected again.
- **Server-side facts need no client event.** Subscription events arrive from Apple (§5); AI usage and cost are
  accounted on the server (production-plan.md §6).

### 7.2 Candidate events

A candidate list for the day analytics is decided; none is implemented. "Properties allowed" is the complete list:
anything not named is not sent.

| Event | When | Properties allowed |
| --- | --- | --- |
| `onboarding_started` / `onboarding_completed` | The first opening starts; ends by finishing or by Omitir | `outcome` (completed, skipped), stage reached |
| `first_account_created` | The first account exists | account kind (cash, card); never its name or balance |
| `first_expense_recorded` | The first expense is saved | entry path (manual, Assistant, Wallet); never amount, merchant or category name |
| `first_recurring_rule` | The first recurring rule is saved | rule kind (expense, income) |
| `first_card_created` | The first card exists | — |
| `assistant_opened` | The Assistant screen opens | connected or disconnected |
| `assistant_review_succeeded` | An Assistant draft is confirmed | whether it was edited first; draft kind |
| `wallet_automation_connected` | The first Wallet capture arrives after setup | — |
| `wallet_capture_received` | A Wallet capture creates a review item | complete or incomplete; mapped or unmapped |
| `review_confirmed` / `review_edited` / `review_dismissed` | A review item is resolved | source (assistant, wallet, inbox) |
| `live_activity_shown` / `live_activity_fallback` | A capture is presented, or falls back to the tray | fallback reason (unavailable, disabled, incomplete, failed) |
| `notification_permission` | The system prompt is answered | granted, denied, provisional; the reminder family that asked |
| `paywall_viewed` | The paywall opens | trigger (the Pro capability requested: Assistant, voice, theme pack, advanced export; or the Más row) |
| `trial_started`, `subscription_purchased`, `subscription_restored` | From Apple's notifications, server side | product id, offer type; no client event needed |

**Never sent:** an exact financial amount; merchant text; account, card or category names; transaction
descriptions or notes; whole or partial ledger rows; balances; the text of an Assistant message; a backup. Not as
event properties, not as "context", not in error reports. Amount buckets are not sent either unless a later, recorded
decision names the question that needs them.

Shared properties on every event, and nothing else: event name, schema version, app version and release marker,
platform and OS major version, interface language, formatting region, the environment (§7.4), a coarse timestamp, and
an identifier (below).

### 7.3 First-party or third-party

**OWNER DECISION**, taken when the first real question cannot be answered from §8.

| | No own analytics (Apple only) | First-party (our `api/mobile` + our database) | Third-party SDK |
| --- | --- | --- | --- |
| What it gives | Store funnel, downloads, opt-in usage and retention, subscription reports | The events of §7.2, in our own tables | The same, with dashboards and cohort tools ready-made |
| Data leaves the device to | Apple only | Our backend (and its hosts, production-plan.md §3, §4) | A further company, under its terms |
| App Privacy label | "Data Not Collected" stays possible for the local build | **Usage Data** (Product Interaction), and **Identifiers** if an install or account id is attached; declared as linked or not linked to identity according to what the id is | The same, plus whatever the SDK itself collects; its privacy manifest and, for listed SDKs, its signature are required |
| Consent | — | In-app consent (5.1.1(ii)) | In-app consent; the SDK must not start before it |
| Cost and work | None | An endpoint, a table, queries | A vendor account; a possible charge (AGENTS rule 3) |
| Lock-in | None | None | The vendor's event store |

**Recommended direction** (not a decision): launch with Apple's analytics and the server-side facts only; add
first-party, opt-in events when a specific question needs them; consider a third-party SDK only if first-party
tooling proves insufficient. This keeps the launch build's privacy label minimal and honest.

A crash-reporting SDK is a separate **OWNER DECISION** on the same axes; without one, crashes come from TestFlight
feedback and App Store Connect's opt-in crash data (§8, §11).

### 7.4 If events are ever collected

- **Identifier.** A random install identifier created on the device for analytics only, resettable, never derived from
  hardware, never the advertising identifier, never joined to third-party data (so no "tracking" in Apple's sense and
  no App Tracking Transparency prompt). When an account exists the events may carry the account id only if the consent
  text says so; that makes the data linked to identity in the label.
- **Schema and versioning.** One typed definition of every event and its allowed properties in the repository; a
  `schemaVersion` on each event; the server rejects unknown events and unknown properties (the same exact-key rule as
  `packages/integrations`), so a careless client change cannot start sending something new. A test pins the list.
- **Staging filtering.** Every event carries its environment; development, preview and TestFlight builds write to the
  staging project only (production-plan.md §2), and production queries never include them.
- **Deletion and account requests.** Turning analytics off stops collection and, on request, deletes the events of
  that identifier; deleting an account deletes its events. The privacy policy describes both (§13).
- **Retention.** Raw events are kept for a short, stated period and then only aggregates remain; the period is an
  **OWNER DECISION** written into the privacy policy.
- **Sampling.** Not needed at launch volumes; if ever used, it is by install identifier, never by content.
- **Offline.** Events queue on the device in their own small store (never the ledger, never a backup), are capped, and
  are dropped rather than retried forever. A failure to send never affects the app.

---

## 8. App Store Connect analytics

**EXISTS TODAY: nothing** (no app record, no data). What Apple provides once the app is live, read 2026-10-02:

| Area | Metrics | Notes |
| --- | --- | --- |
| Discovery | Impressions and unique impressions; product-page views | Shown once the app has at least five first-time downloads. |
| Acquisition | First-time downloads, redownloads, total downloads, updates, pre-orders; **conversion rate** ("total downloads and pre-orders divided by unique device impressions") | Not opt-in: counted by the App Store. |
| Sources and campaigns | App Store Browse, App Store Search, app referrers, web referrers; **campaign links** with a token of up to 30 characters | A campaign link cannot be generated until the app "has data" (live for at least 24 hours), so launch-day links cannot be prepared in advance. |
| Usage | Installations, sessions, active devices, active in the last 30 days, deletions, crashes | **Opt-in only:** "Usage data totals are based on App Store users who opt-in to share their data with you." A sample, not a census. |
| Retention and cohorts | Retention by day after download; cohorts and filters (2026 additions) | Opt-in only. |
| Money | Sales, proceeds, paying users, in-app purchases, refunds | In App Analytics sales are in USD at a rolling average rate; the accounting source is the financial report (§6). |
| Subscriptions | Sales and Trends → Subscriptions: Summary, Retention, State and Event pages (activations, cancellations, conversions to standard price, reactivations, refunds, renewals) | Shown in Pacific Time; App Analytics is in UTC. Subscription metrics appear once one subscription has been sold. |
| Benchmarks | Conversion rate, retention, crash rate, proceeds per paying user against a peer group | |
| Export | Analytics Reports API | Apple adds noise or withholds small counts for privacy. |

TestFlight: App Analytics excludes sales from TestFlight builds; Sales and Trends includes them.

**How it complements §7.** Apple answers "how many people see the page, download, keep the app and pay"; it does so
without any code in the app and without any data leaving the device to us, and "You are not responsible for disclosing
data collected by Apple" in the privacy label. Product analytics (§7), if ever enabled, answers only what Apple cannot
see: what happens inside the app (was a first expense recorded, are review items confirmed or dismissed, does the
paywall convert from an intentional Pro request (the Assistant, a theme pack, the advanced export) or from Más). Nothing Apple already reports (downloads, sessions, retention by day,
subscription events) is collected a second time.

---

## 9. App Store Optimization

**NOT IMPLEMENTED; no listing exists.** The roadmap places listing and marketing work "only after real users exist
(TestFlight or the App Store)" (roadmap §5); the store metadata itself is part of Producto 26. This section is the
strategy and the process, not the final copy.

### 9.1 Positioning

What the listing may say, because the product does it: recording spending fast; cards, instalments (cuotas) and
«Saldo pendiente»; budgets; recurring commitments; several currencies; privacy and local-first (the data lives on the
iPhone, the app works offline, no account is needed); the Assistant as controlled help that proposes drafts the person
confirms. Each claim appears only once the capability is in the shipped build.

What the listing never says: bank connectivity or synchronization with a bank; automatic reading of Wallet or Apple
Pay history (Wallet capture, when it exists, is described as an automation the person sets up, and only once it ships);
"AI that manages your money"; investment, credit or financial advice; any user count, rating or testimonial that is not
real and verifiable (roadmap §5); any award or Apple endorsement. Guideline 2.3: metadata must "accurately reflect the
app's core experience"; 2.3.1(a): no "hidden, dormant, or undocumented features".

### 9.2 Fields

Limits as Apple states them (read 2026-10-02):

| Field | Limit | Plan |
| --- | --- | --- |
| App name | 2 to 30 characters; changes need a new version | The final public name, decided in the brand gate (§9.4): «FinanzApp» is the working name and is already used by other products, including a personal-finance app on the App Store. **OWNER DECISION**; the name must be available in App Store Connect per localization and screened for trademark conflicts (professional review when warranted). |
| Subtitle | 30 characters; new version | The plain benefit in the storefront's language (spending, cards, budgets). Indexed for search. |
| Keyword field | Apple's reference says "up to 100 bytes", its marketing pages "100 characters": plan for **bytes**. Accented letters and ñ take two bytes in UTF-8, so Spanish fits fewer than 100 characters. Comma-separated, no spaces. | From the research process below. "Don't repeat any words… included in your app name, subtitle, or category"; "Names of other apps or companies aren't allowed". |
| Primary / secondary category | One each | Primary **Finance** (Apple's definition includes "personal financial management… bill reminders, budgets, debt management"). Secondary: **OWNER DECISION** (Productivity is the natural candidate) or none. |
| Description | 4000 characters; new version; not listed by Apple as a search-ranking input | Written for a person deciding, not for search: what it does, what stays on the device, what Pro adds and costs (guideline 2.3.2: say which features need a purchase). |
| Promotional text | 170 characters; editable without a new version; does not affect ranking | The current news (a new capability, a language). |
| What's New | 4000 characters | Honest release notes (§11). |
| Screenshots | 1 to 10 per localization. One 6.9-inch iPhone set is sufficient for an iPhone-only app (`supportsTablet` is `false` in `app.config.ts`). | Real screens "in use" (2.3.3) with **fictional** data (2.3.9) clearly synthetic: never the owner's or a user's ledger (AGENTS rule 6; roadmap §5 "fixture data clearly marked"). The first three carry the message, since they show in search results. Each in light or dark consistently, each localized. |
| App Preview (video) | Up to three, 15 to 30 seconds, screen captures of the app itself | Optional. Useful to show fast capture; only after the UI is stable. **OWNER DECISION.** |
| Icon | In the binary; alternates for tests must ship in the binary too | Part of Producto 26's identity work. |
| Ratings and reviews | Apple's prompt only (guideline 5.6.1); "a maximum of three times within a 365-day period"; not in response to a button tap; no effect in TestFlight | **DECIDED** (roadmap 25F): "only after a satisfying moment through Apple's prompt, never on first launch and never required". Replies to reviews are the owner's, in the reviewer's language. |
| Localized metadata | Per App Store localization | §10. |
| Custom product pages | Up to 70; vary screenshots, promotional text and previews; can be assigned keywords | Later: one page per message (cards and cuotas; budgets; privacy), linked from the matching campaign. |
| Product Page Optimization | Tests icon, screenshots and previews; up to three treatments; up to 90 days | Later, once traffic exists. Name, subtitle, description and keywords cannot be A/B tested. |
| Campaign attribution | Campaign links (§8). AdServices and AdAttributionKit only matter with paid Apple Ads or ad networks | No paid acquisition is planned; if ever bought, attribution adds a network call that the privacy answers must reflect. |

### 9.3 Finding the terms people actually search

A repeatable process, run per language, before each metadata change:

1. **Seed list from the product, in the person's words.** How people in the target market name the problem: for
   Spanish in Argentina and Latin America, words such as gastos, control de gastos, presupuesto, tarjeta, cuotas,
   finanzas personales; for English, expense tracker, budget, spending. The financial vocabulary differs by country
   (§10): cuotas is not the word everywhere.
2. **Observe, do not guess.** Type each seed into the App Store's own search on an iPhone set to the target storefront
   and record the suggestions it completes: those are real queries. Note which apps rank and how they phrase names and
   subtitles (to learn the vocabulary, never to copy names: competitor names are not allowed as keywords).
3. **Check relevance honestly.** Keep a term only if a person searching it would be satisfied by FinanzApp as shipped.
   "Bank", "invertir", "préstamos", "crypto", or another app's name fail this test and are excluded; so is any
   capability not in the build. "Improper use of keywords is a common reason for App Store rejections."
4. **Place terms by weight.** Apple names the title, subtitle, keyword field and primary category as text-relevance
   inputs. The most important term goes in the name or subtitle, the rest in the keyword field without repeating words
   already there, counted in bytes.
5. **Measure and iterate.** After launch, read impressions, product-page views and conversion by source (§8) per
   storefront; change one thing per release; keep a dated log of each metadata version and its effect. Paid ASO tools
   are optional and a charge (AGENTS rule 3).

Whether keywords entered in one localization are indexed in other storefronts that list it ("cross-localization") is
stated only by ASO vendors, not by Apple: *unverified*; do not build the plan on it.

### 9.4 Brand, naming and identity gate

**DECIDED** (owner, 2026-10-02, PR #81): the internal working name «FinanzApp» is **not** assumed to be the final public
App Store brand. The owner's research found existing products using the name, including a personal-finance application
already distributed in the App Store. Before any public launch asset is committed (final App Store metadata, the
landing page, marketing assets), the product passes a deliberate naming and brand gate. **RESEARCH GATE, OWNER
DECISION, LAUNCH BLOCKER** for those assets; **NOT IMPLEMENTED**; nothing in the app is redesigned by this record.

What the gate covers:

| Area | What is decided or produced |
| --- | --- |
| Name | The final public product name; App Store name availability per localization (the 30-character field, §9.2); domain availability; social and marketing handles where relevant. |
| Screening | Trademark and confusing-similarity screening, with professional review when warranted; differentiation from Kesef and the other personal-finance apps found in the research. |
| Originality | No copying of a competitor's logo, icon, illustrations, copy, distinctive screen compositions or brand identity. Common platform patterns (rounded cards, bottom navigation, charts, native iOS conventions) are not a competitor's property and are not, by themselves, a reason for change. |
| Identity system | Visual palette review; a wordmark; an original symbol; vector master artwork; the App Store icon; light and dark variants; legibility at small sizes; the launch and splash identity; reusable brand and design tokens (`src/ui/palette.ts` is where the app's tokens live today). |
| Surfaces | The landing-page identity (§14); the App Store screenshot and preview visual system (§9.2); marketing, social and press assets; consistency across the app, the Dynamic Island and Live Activities (production-plan.md §8), widgets (25D) and the future Android app (roadmap §5). |

The design workflow, in this order:

- **A.** Explore several genuinely distinct visual identity directions before any code.
- **B.** Compare them on one small representative set: Home, Reports, Cards, Settings/More, the Wallet / Live Activity
  capture presentation, and the landing-page hero.
- **C.** The owner selects one.
- **D.** Only then decide whether the current Forest palette (decision 005) needs a broad change.

Rules: the Forest palette is **not** changed merely because another finance app uses green; the goal is an
independently recognizable brand, not arbitrary difference; and no cosmetic churn is made in the app before step C.
Sequencing: the gate sits in 26 before the public metadata (§9, §10), the landing page (§14) and the marketing assets,
and must be passed before TestFlight builds carry a public name; it changes no earlier phase. The release marker, the
bundle identifier decision (§11.3) and the working name in the repository are separate matters: a repository or an
identifier does not have to carry the public name.

---

## 10. Market localization

Three different things, kept apart:

| Concept | What it is | Where it is set | Today |
| --- | --- | --- | --- |
| **Interface language** | The language of the app's own text | Más → Idioma; `RELEASED_LANGUAGES` | Spanish and English (`docs/i18n.md`) |
| **Formatting region** | How dates, numbers and amounts are written | Más → Región; `RELEASED_REGIONS` | 234 of 257 catalogue regions open in a build; 23 native-digit regions blocked until Producto 24R3 (`docs/region-families.md`) |
| **App Store storefront / market** | Where the app is offered and sold, with which metadata, price, support and legal terms | App Store Connect: availability, localizations, pricing | Nothing: no listing exists |

They do not imply one another. A person in Germany can use the app in Spanish with German formats; that does not make
Germany a launch market. Being able to format a region's dates is engineering; selling in a storefront is a commercial
commitment (metadata, price, support, tax and legal exposure).

**The repository's gates stay as written.** The in-app regions and the 146 creatable currencies were opened on
automated evidence as "a provisional development strategy before launch, not an explicit authorization by the owner"
(`docs/i18n.md` §11a; roadmap, «Decisions that still bind»): the per-family iPhone sheet (`docs/region-families.md`)
must pass before the first TestFlight, and a stage can be blocked again in one commit. The seven three-decimal
currencies stay held until their VoiceOver check, and the 23 native-digit regions until 24R3 (`docs/currency.md`).
None of that is a list of commercial markets, and this document changes none of it. Currency display in the app
follows the ledger's own rules (integer minor units per currency, never mixed without a dated rate); it is unrelated to
the storefront's price currency.

### 10.1 Launch matrix

Rows are candidate storefronts; the cells say what must exist before that storefront is switched on. **OWNER
DECISION:** which row is the first market, and when each further row opens. Nothing is selected here.

| Candidate storefront | Metadata localization Apple shows there | Name, subtitle, keywords | Screenshots | Description | Pricing | Support | Privacy and legal | Terminology |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **Argentina** | **Spanish (Mexico)** by default, English (U.K.) additional ([App Store localizations](https://developer.apple.com/help/app-store-connect/reference/app-information/app-store-localizations/)) | Spanish, in the Spanish (Mexico) slot | Spanish, ARS examples | Spanish | Price for the storefront. Apple's report currency for Argentina is USD; the currency a customer there sees was not found stated (*unverified*); local taxes on the charge are outside Apple's pages | Spanish | Policy and terms in Spanish; tax position for the accountant (§6) | Rioplatense: cuotas, «Saldo pendiente», gastos |
| Mexico, Chile, Colombia, Peru, Paraguay, Bolivia and other Spanish-speaking Latin America (Uruguay is listed by Apple as English (U.K.) first, Spanish (Mexico) additional) | Spanish (Mexico) (the same slot Argentina uses) | The same Spanish copy: it must read well outside Argentina too, or stay neutral | Spanish; a local currency in the examples, if targeted | Spanish | Per storefront | Spanish | As above; Apple remits tax in some (Exhibit B) | "Cuotas" is "meses sin intereses" or "mensualidades" elsewhere; voseo reads as Argentine |
| Spain | Spanish (Spain), with Catalan and English (U.K.) additional | A separate Spanish (Spain) localization, or none (then another language is shown) | Spanish (Spain), EUR examples | Spanish (Spain) | EUR | Spanish | EU: DSA trader status, consumer law; professional review | Peninsular vocabulary (tarjeta de crédito, plazos) |
| United States | English (U.S.), with Spanish (Mexico) among the additional languages | English (U.S.) | English, USD examples | English | USD (a natural base storefront) | English | Policy and terms in English | Installments are less central; lead with expense tracking and budgets |
| Other English-speaking storefronts | English (U.K.) is the usual additional language outside the US | English (U.K.) localization or fall back to the primary language | English | English | Per storefront | English | Per country | Spelling and currency examples |
| European Union (any member state) | Per country | Needs that country's language to be credible | Localized | Localized | EUR and others | In a language we can actually answer | **DSA trader status** must be declared even to stay out of the EU; a trader's address, phone and email are shown on the product page | A language the app does not have is not a launch market |
| Rest of the 175 storefronts | Per Apple's table | Primary-language fallback | — | — | Auto-generated from the base price unless set | — | — | Off until deliberately chosen |

Rules:

- **Do not switch on every storefront because the app can format its region.** Availability is selected per country or
  region in App Store Connect; start with the storefronts whose row is complete.
- **A storefront is ready when:** its metadata localization is written and reviewed by someone fluent; its screenshots
  are in that language with fictional data; its price is set deliberately; support can be answered in its language; the
  privacy policy and terms exist in a language its users read; and its tax and legal questions (§6, §13) have an answer.
- **The app's primary language** in App Store Connect is the fallback shown where no localization matches: an **OWNER
  DECISION** that follows the first market.
- **Interface languages beyond Spanish and English** follow `docs/i18n.md` §12 (a complete catalogue, native review, a
  device pass). A storefront whose language the app does not speak is not a launch market, whatever its region support.
- **The Spanish (Mexico) slot is shared** by Argentina, most of Spanish-speaking Latin America and Spanish-language
  users in the United States: copy written in strongly Argentine voice will be read in all of them. Decide the voice
  with the first market in mind.

---

## 11. TestFlight, EAS and the release pipeline

**No build is made by this document, and none without the owner's authorization** (AGENTS rule 3; README; roadmap,
«Decisions that still bind»).

### 11.1 The lifecycle

```
development build  (dev client, ad hoc, the owner's registered iPhone, Metro)
  → preview build where useful  (optimized standalone, ad hoc, no Metro)
  → internal TestFlight  (store-signed build, App Store Connect users)
  → external TestFlight if needed  (invited testers, Beta App Review)
  → production build  (the definitive identity)
  → EAS Submit → App Store Connect
  → App Review
  → release: manual or automatic; phased for later updates
```

### 11.2 What exists today

**EXISTS TODAY** (`apps/mobile/eas.json`, `apps/mobile/app.config.ts`, `apps/mobile/README.md` «EAS builds and
profiles»):

| EAS profile | Distribution | EAS environment | `APP_VARIANT` | Bundle identifier | App name |
| --- | --- | --- | --- | --- | --- |
| `development` | internal (ad hoc), development client | `development` | `development` | `com.facur3.finanzapp.dev` | FinanzApp Dev |
| `preview` | internal (ad hoc), `autoIncrement` | `preview` | `preview` | `com.facur3.finanzapp.preview` | FinanzApp Preview |
| `testflight` | store, `autoIncrement` | `preview` | `preview` | `com.facur3.finanzapp.preview` | FinanzApp Preview |

- `cli.appVersionSource` is `remote`; `submit` has one profile, `testflight`, with no options.
- The EAS project is `@facur3/finanzapp-mobile`; its id is public configuration in `app.config.ts`.
- `version` is `0.1.0`; `extra.pilot` is `true`; `supportsTablet` is `false`; iOS only.
- **There is no `production` profile and no production variant:** `app.config.ts` throws for any `APP_VARIANT` other
  than `development` or `preview`. The `testflight` profile would upload the `.preview` identifier under the name
  "FinanzApp Preview".
- Distribution so far: ad hoc development builds on the owner's registered iPhone. "Nothing is on TestFlight or the App
  Store" (`apps/mobile/README.md`).
- `expo-updates` (EAS Update) is not installed.

### 11.3 What production needs

| Item | State | Notes |
| --- | --- | --- |
| The definitive bundle identifier and app identity | **OWNER DECISION**, **LAUNCH BLOCKER**; Producto 26 | AGENTS rule 3: never changed without an explicit release decision. `com.facur3.finanzapp` "was registered by the retired Capacitor app and is not reassigned by the retirement" (`apps/mobile/README.md`); whether production reuses it or takes a new identifier is that decision. Apple: the bundle ID of an app record can't be changed after a build is uploaded; subscriptions, the app group and the URL scheme hang from it. Decide before the first TestFlight build that is meant to become the store app, because TestFlight testers, sandbox purchases and App Store Connect records belong to one identifier. |
| A `production` variant in `app.config.ts` and a `production` profile in `eas.json` | **NOT IMPLEMENTED** | Store distribution, EAS environment `production`, the definitive name and scheme, `pilot` removed; pinned by a test beside the existing `tests/app-config.node.ts`. |
| The `testflight` profile's purpose | To settle with the identity | Today it is a store-signed build of the *preview* identity: usable for an internal pilot of that identity, not the path to the store listing. After the decision, either it becomes the staging lane (its own identifier and backend) or it is replaced by `production`. |
| Environment separation | **NOT IMPLEMENTED** | A profile's EAS environment selects its variables. Staging and production never share a backend origin, database or provider key (production-plan.md §2). |
| `ITSAppUsesNonExemptEncryption` | **NOT IMPLEMENTED** | Roadmap, «Later notes recorded in 24UX6A», "Native config cleanup": set it explicitly at the latest before the first TestFlight, with the owner confirming the app uses only exempt encryption (§12). |

### 11.4 Versions and build numbers

- The marketing version (`CFBundleShortVersionString`) is `version` in `app.config.ts`, bumped by hand. The release
  marker in Más («FinanzApp 0.1.0 (25OPS1)») is the app's own line, not Apple's build number.
- Build numbers (`CFBundleVersion`) come from EAS: `appVersionSource: remote` with `autoIncrement`, so the number in
  the app config is ignored and never reused. Apple: for each version, a new build needs a higher build number, and
  version numbers cannot be reused.
- Before the first production build: decide the first public version (**OWNER DECISION**; 1.0.0 is conventional) and
  seed the remote build number if needed (`eas build:version:set`, an EAS command only the owner authorizes).
- To know which binary is installed, read the IPA's compiled `Info.plist` (device checklist, «Producto 23.2»), not
  `app.config.ts`.

### 11.5 Signing

- EAS manages the iOS credentials (distribution certificate, provisioning profile) after a sign-in with an Apple
  Developer Program membership (99 USD per year, per Apple's page: a charge the owner already carries or authorizes).
  Credentials are stored encrypted on Expo's servers.
- EAS Submit uses an App Store Connect API key; "only an Account Holder or Admin can create" it. **OWNER ACTION**,
  **REMOTE SETUP**.
- Without an `ascAppId`, the first `eas submit` creates the app record in App Store Connect automatically: a remote,
  outward-facing act that needs the release decision (AGENTS rule 3).
- No certificate, profile, `.p8`, `.p12` or `.ipa` is ever committed (README, «Files that must never be committed»;
  `npm run check:repo`).

### 11.6 Environment variables and secrets (names only)

| Where | Names | Rule |
| --- | --- | --- |
| EAS build profile | `APP_VARIANT` | Selects identity and name. |
| App, public by design | `EXPO_PUBLIC_EAS_PROJECT_ID`, `EXPO_PUBLIC_MOBILE_API_ORIGIN` | Anything `EXPO_PUBLIC_` is "visible in plain-text in your compiled application": never a secret. The API origin differs per environment. |
| App, development only | `EXPO_PUBLIC_ASSISTANT_FIXTURES`, `EXPO_PUBLIC_LOCALE_PREVIEW`, `EXPO_PUBLIC_CURRENCY_PREVIEW`, `EXPO_PUBLIC_MERCHANT_MARK_PREVIEW` | Compiled away outside a development bundle; "never set them in `eas.json`, `app.config.ts` or a committed `.env`" (`apps/mobile/README.md`, «Test flags»). |
| App, build-time switch | `EXPO_PUBLIC_DISABLE_GLASS` | A build-time kill switch for the glass material. |
| Server (`server/mobile/runtime.js`) | `MOBILE_INTEGRATIONS_ENABLED`, `MOBILE_SUPABASE_URL`, `MOBILE_SUPABASE_PUBLISHABLE_KEY`, `MOBILE_AI_ENABLED`, `MOBILE_OPENAI_API_KEY` | Set in the hosting project per environment, never in the app, never in the repository (production-plan.md §2, §3). |
| Future (25F) | An App Store Server API key, the notification endpoint's configuration, a purchase-SDK public key if option B | Named when they exist. Server-side keys follow the server rule; an SDK's public app key is public by design. |

EAS environment variables have three visibilities (plain text, sensitive, secret); none makes a value safe once it is
embedded in the app. The AI provider key is server-only (AGENTS rule 12).

### 11.7 StoreKit sandbox

Purchases cannot be exercised in Expo Go or a JS bundle. The order of environments: StoreKit Testing in Xcode (local,
signed by Xcode; whether it is workable with a generated Expo project and no Mac is a **RESEARCH GATE**) → Sandbox on
a development build (needs the products in App Store Connect and the Paid Apps Agreement) → TestFlight, which is
sandbox with daily renewals (§4.5). Sandbox notifications go to the staging backend only.

### 11.8 TestFlight

| | Internal testers | External testers |
| --- | --- | --- |
| Who | Up to 100 App Store Connect users with a role on the team | Up to 10,000 people, by email or a public link |
| Review | No Beta App Review step is described for internal groups | "A review is required only for the first build" added to a group; later builds may not need a full one |
| Needs | A build with `distribution: store` ("internal distribution is not internal testing") | Beta App Description, feedback email; a test account only if the app has a login |
| Build life | 90 days | 90 days |

- **Groups:** start with one internal group (the owner). An external group, if wanted, is a small invited list with
  its own "What to Test" notes; a public link is a later **OWNER DECISION**.
- **Before the first TestFlight** (all already recorded in the roadmap and the device checklist): the checklist's
  «Release gate», including the consolidated physical-device regression (the deferred 24T3 pass and the 25A / 25A2
  device items; owner decision, 2026-10-04: required before the first external or public TestFlight candidate and
  before App Store submission); the per-family iPhone sheet (`docs/region-families.md`); the 24C1, 24M and 24R2B sections; the
  privacy policy naming the exchange-rate provider (`docs/currency.md` §8.2); the encryption key in the config; every
  open device gate "closed or consciously deferred by the owner" (roadmap, «Producto 26»).
- **Crash and performance validation:** TestFlight collects crash reports and screenshot feedback from testers. The
  roadmap requires "the accessibility and performance pass on a TestFlight build (an optimised build, not development
  mode: cold start, memory, dropped frames, VoiceOver, large text, Reduce Motion)" (Producto 26). A JS export or a
  development build is not that evidence (AGENTS rule 11). **DEVICE QA.**
- A TestFlight build is a real distribution of the financial app to other people: their data stays on their devices,
  and the build's backend is staging (no production data, no production AI budget).

### 11.9 Release, rollback and kill switches

- **Release option.** **OWNER DECISION** per version: manual release after approval (recommended for 1.0 and for any
  version that turns on a server capability, so the backend is switched on at the same moment), or automatic.
- **Phased release** applies to automatic updates of *version updates* only: 1%, 2%, 5%, 10%, 20%, 50%, 100% over
  seven days, pausable for up to 30 days. Anyone can still get the update manually, and version 1.0 cannot be phased.
  It slows exposure; it is not a kill switch.
- **There is no binary rollback.** A live version with a problem is fixed by submitting an update ("you must submit an
  app update"); an expedited review can be requested for a critical bug. So: the previous version's source stays
  buildable (a tag per release), and every release is preceded by the upgrade test on a copy of real-shaped data.
- **Storage makes rollback one-way.** A newer database is refused intact by an older build (`apps/mobile/README.md`,
  «Rules that never bend»), so a schema-changing release cannot be undone by an older binary. A release that migrates
  the schema gets the migration test, the backup round trip and a device pass on the owner's data before submission.
- **EAS Update (over-the-air JavaScript)** is **NOT IMPLEMENTED** (`expo-updates` is not a dependency) and adding it is
  an **OWNER DECISION** with a native build. If added: for JavaScript-only bug and copy fixes within what was reviewed,
  never for new features or a change in data flows (guideline 2.5.2; Expo: "changes to your app's behavior need to be
  reviewed"), and **never for a schema migration**: `expo-updates` "will only fix forward and will not roll back" once
  an update has run, and SQLite changes persist. An update reaches a person on the second launch after publishing.
- **Emergency kill switches. EXISTS TODAY:** the server flags `MOBILE_INTEGRATIONS_ENABLED` (off: both routes answer
  503) and `MOBILE_AI_ENABLED` (off: only `/api/mobile/assistant` answers 503; the capture inbox stays on). The app
  falls back to manual entry; no app build is needed, but
  on Vercel a changed variable takes effect only with a new deployment of the server (production-plan.md §6.2). They
  stop cloud capabilities, the only parts that can cost money; the reference-rate download has no remote switch. **NOT IMPLEMENTED:** the monetary
  circuit breaker of production-plan.md §6, and any remote switch for an app-side feature. A purely local feature has
  no kill switch but a new build; that is one more reason local features ship only after device QA.
- **Removing the app from sale** takes it off the store within 24 hours; existing installs keep working, which for a
  local-first app means people keep their data.

### 11.10 Release notes

- **App Store "What's New":** what changed, in plain words, in each storefront language (guideline 2.3.12).
- **Notes for Review:** every new capability described "with specificity" (2.3.1(a)), up to 4000 bytes: the
  empty-by-design first run, how to reach the paywall and a sandbox purchase, how the Assistant's consent appears, and
  how to see Wallet capture without a real card payment (§12).
- **TestFlight "What to Test":** the checklist items a tester should try, per build.
- **In the repository:** the roadmap's delivery section and the device checklist remain the engineering record; a
  release adds its version, build number, commit and date there.

---

## 12. App Review and launch checklist

"Status today" is as of 2026-10-02. "Blocked until" names the phase that unblocks the item; an item with no blocker
still needs the owner's release decision. Apple's acceptance is separate from a submission, and nothing here claims
approval (roadmap, «Producto 26»).

| Item | Requirement and source | Status today | Blocked until |
| --- | --- | --- | --- |
| Final bundle identity | A definitive bundle identifier, name and scheme; a production variant and profile (§11.3). AGENTS rule 3. | **LAUNCH BLOCKER**; only `.dev` and `.preview` exist | Producto 26, **OWNER DECISION** |
| Version and build | A public version; build numbers from EAS (§11.4) | `0.1.0`, remote build numbers | Producto 26 |
| Developer account type | Individual or organization. Guidelines 3.2.1(viii) and 5.1.1(ix) reserve "financial trading, investing, or money management" and "highly regulated fields" for the institution or legal entity; whether a manual expense tracker is in scope is not defined by Apple (*unverified*). | **OWNER DECISION**, **RESEARCH GATE** | Before the app record is created; professional advice if in doubt |
| Privacy policy URL | "Required"; linked in App Store Connect and "within the app in an easily accessible manner" (5.1.1(i)); must state data collected, third parties, retention and deletion | **LAUNCH BLOCKER**; none exists | Producto 26 (§13); already owed for the rate provider before TestFlight |
| Support URL / contact | "Must lead to actual contact information" | **LAUNCH BLOCKER**; none exists | Producto 26 (§13, §14) |
| Terms / EULA decision | Apple's standard EULA applies unless a custom one is provided. A subscription needs Terms of Use and Privacy Policy links in the app and in the metadata | **OWNER DECISION** (standard EULA or custom); none exists | 26 for the EULA choice; 25F for the subscription terms |
| Age rating | The questionnaire (2025 system: 4+, 9+, 13+, 16+, 18+), considering "AI assistants and chatbot functionality"; an in-app browser raises it; a provider's minimum age can force an override | **NOT IMPLEMENTED** | 26; re-answered when the Assistant goes live (25A) |
| App Privacy labels | Answers must match what the shipped build does, including third-party code. On-device-only data is "not collected" | Today's build could answer "data not collected" except for what the rate download implies; to verify at submission | 26; re-answered with 25A (AI provider retention), 25E (accounts), 25F (purchase SDK), analytics (§7) |
| Privacy manifest | `PrivacyInfo.xcprivacy` reasons for required-reason APIs; Expo: static pods' manifests may need to be repeated in the app config | **IMPLEMENTATION GATE**: check Apple's upload email after the first store-signed build | First store-signed build |
| Encryption / export compliance | `ITSAppUsesNonExemptEncryption` set explicitly; `false` only if the app and its libraries use just exempt encryption (HTTPS, the system's). SQLCipher, if ever adopted, would need this re-answered (*unverified* classification; production-plan.md §11) | **NOT IMPLEMENTED**; roadmap «Native config cleanup» | The next native config change, at the latest before the first TestFlight; owner confirms |
| Third-party AI disclosure and permission | 5.1.2(i): "clearly disclose where personal data will be shared with third parties, including with third-party AI, and obtain explicit permission before doing so" | **NOT IMPLEMENTED**; the Assistant is disconnected | 25A (the consent screen naming the provider and what travels; production-plan.md §5) |
| Sign in with Apple / login services | 4.8 applies only if a third-party or social login is offered; then an equivalent privacy-preserving option is required. 5.1.1(v): "let people use it without a login" when account features are not significant | No account exists; nothing required | 25A's session / 25E, only if a third-party login is added (production-plan.md §12) |
| Account deletion | 5.1.1(v): "If your app supports account creation, you must also offer account deletion within the app"; with Sign in with Apple, revoke its tokens | Not applicable: no accounts | The first build with accounts (25A session or 25E) |
| Subscription metadata | Products, subscription group, localized display names and descriptions, prices per storefront, review screenshot; multiseat and Family Sharing settings | **NOT IMPLEMENTED** | 25F; needs the Paid Apps Agreement (§6) |
| Restore purchases | 3.1.1: "a restore mechanism for any restorable in-app purchases" | **NOT IMPLEMENTED** | 25F |
| Subscription review | 2.1(b): purchases "complete, up-to-date, visible to the reviewer and functional"; the paywall meets §3.2 | **NOT IMPLEMENTED** | 25F; sandbox on the iPhone first |
| Review notes | Every capability explained; contact details | **NOT IMPLEMENTED** | 26 |
| Demo credentials / instructions | 2.1(a): a demo account only "if your app includes a login". The app starts empty by rule (AGENTS rule 6): the notes walk the reviewer through creating an account and an expense in a minute, instead of seeded data | Not needed while there is no login | 26 for the walkthrough; credentials only when accounts exist |
| Screenshots | One 6.9-inch iPhone set, fictional data, per localization (§9) | **NOT IMPLEMENTED** | 26 |
| Localized metadata | Per launch storefront (§10) | **NOT IMPLEMENTED** | 26, after the first-market decision |
| Brand, naming and identity | The final public name and identity system (§9.4): name availability per localization, trademark screening, original icon and artwork | **RESEARCH GATE**, **OWNER DECISION**; the working name is not assumed final | 26, before any public metadata, landing page or marketing asset |
| Notification purpose | Permission asked in context, never at launch; the app may not require notifications to function (5.1.2(i)); reminder copy never claims a payment happened | **NOT IMPLEMENTED** | 25D (production-plan.md §9) |
| Live Activity purpose | Explained in the notes; `NSSupportsLiveActivities`; whether App Review accepts a Live Activity used as a one-shot confirmation is *unverified* | **NOT IMPLEMENTED**, **RESEARCH GATE** | 25A2 (production-plan.md §8) |
| Wallet / Shortcut setup explanation | The reviewer cannot make an Apple Pay payment with the person's card: the notes explain the automation, and the feature must be demonstrable another way (running the Shortcut action by hand); no claim of reading Wallet history | **NOT IMPLEMENTED** | 25A2 (production-plan.md §7) |
| Face ID purpose string | `NSFaceIDUsageDescription` when Face ID is used | **NOT IMPLEMENTED** | 25D |
| Accessibility | VoiceOver, Large Text and Reduce Motion pass on the store-signed build; Accessibility Nutrition Labels are voluntary for now and may be claimed only for features that complete every common task | Guards exist in tests; device results mostly pending | 26's accessibility pass; labels after a per-feature device audit |
| Crash-free launch | A cold launch on a clean install and on an upgrade, on the optimized build; 2.1 is the most common rejection reason | Not measured on a store-signed build | 26 (TestFlight pass) |
| Offline behaviour | The core works with no network; cloud features degrade with a clear state; no login required | **EXISTS TODAY** for the local core | Re-verified on the TestFlight build |
| Backup / export | Local backup, export and import work and are free | **EXISTS TODAY** (backup v14) | Re-verified on the TestFlight build |
| Legal copy | Subscription terms on the paywall; consent texts; no claim of bank connectivity or financial advice (§9.1) | **NOT IMPLEMENTED** | 25F, 25A; professional review (§13) |
| DSA trader status | Must be declared in App Store Connect even without EU distribution; a trader's contact details are shown in the EU | **OWNER DECISION**, **OWNER ACTION** | Before submission; legal judgment |
| Paid Apps Agreement, tax, banking | §6.2 | **OWNER ACTION**, **LAUNCH BLOCKER** for anything paid | Before 25F's sandbox testing |
| Region and currency gates | The provisional in-app openings pass their iPhone sheets or are set back (§10) | Pending | Before the first TestFlight (roadmap) |
| Open device gates | "Every open device gate above closed or consciously deferred by the owner" (roadmap, Producto 26) | Most checklist sections pending | 26 |
| Release strategy | Manual or automatic release; phased for updates; storefronts selected (§10, §11.9) | **OWNER DECISION** | 26 |
| Chatbot guideline 4.7 | Whether a first-party assistant falls under 4.7's "chatbots" is *unverified*; if it does, 4.7.1 asks for content filtering | **RESEARCH GATE** | 25A, before the first build with a live Assistant |

A free launch without Pro is possible: every 25F row then drops out, and with it the Paid Apps Agreement as a blocker.
**OWNER DECISION** whether 1.0 ships free-only or with Pro; the roadmap's order (25F before 26) assumes Pro exists.

---

## 13. Support, privacy and legal

**NOT IMPLEMENTED: none of these documents or pages exists.** They are deliverables of Producto 26 (and of the phase
that first needs each). "Professional review" means a qualified lawyer or accountant; this plan invents no guarantee
and promises no compliance.

| Deliverable | What it must cover (product requirement) | Needed by | Needs professional legal/tax review |
| --- | --- | --- | --- |
| Privacy policy | What stays on the device (the ledger, review items, preferences, backups); what leaves and when: the exchange-rate request (below), and only with opt-in the Assistant's text and aggregated facts, account data, purchase state, analytics; each provider; retention; how to revoke consent and request deletion (5.1.1(i)). In Spanish and English | The first TestFlight (the rate provider is already owed, `docs/currency.md` §8.2) | **Yes** |
| Support page and contact | A reachable contact (Apple: "actual contact information"), how to back up and restore, how to report a problem without sending financial data | Submission | No (contact details are an owner decision; the DSA may impose some) |
| Terms of use | Apple's standard EULA or a custom one; if custom, the app is a record-keeping tool, not financial advice | Submission (**OWNER DECISION**) | **Yes** if custom |
| Subscription terms | Title, length, price, renewal, cancellation, trial terms (Schedule 2 §3.8; §3.2 above); what Pro includes; what happens to data when it ends | 25F | **Yes** |
| Data deletion and export instructions | Local: export a backup, delete the app's data, what uninstalling does (production-plan.md §1). Cloud, once it exists: export and delete from inside the app | Submission (local); 25A/25E (cloud) | Review the wording |
| AI data disclosure and consent | Before any send: which provider, what travels (the person's text; for analytical questions, aggregated facts with category names), what never travels, retention as the provider states it, how to turn it off. Once the provider and tier are chosen, state its actual training and retention terms as re-read that day (for OpenAI's API as read on 2026-10-02: not used for training by default; prompts and outputs may be held in abuse-monitoring logs for a limited time; `store: false` is not zero retention). It may not say "nothing is retained" (production-plan.md §5) | 25A, before the first live call | **Yes** (consent wording) |
| Analytics disclosure | What events are, that they carry no financial content, opt-in, how to turn off and delete (§7) | Only if analytics is ever enabled | Review the wording |
| Notification privacy | Amounts and merchants hidden on the Lock Screen by default; what a reminder says (production-plan.md §9) | 25D | No |
| Account deletion | In-app deletion of the account and its cloud data; token revocation with Sign in with Apple; what remains on the device | The first build with accounts | Review the wording |
| Retention policy | Per data class and provider: server logs, quota and usage rows, capture inbox rows, entitlement records, analytics | With each class's first use | **Yes** |
| Subprocessors / providers list | Below; kept current in the policy | TestFlight, then each phase | Review |
| App Store privacy labels | The label answers, re-derived at each phase from what the build really does (§12) | Submission, then each phase | No, but they must match the policy |
| Tax and banking position | §6 | Before anything is sold | **Yes** (accountant) |
| Trader status (EU DSA), consumer-law terms | §12 | Before submission | **Yes** |

**Providers that receive data.**

| Provider | When | What it receives | Status |
| --- | --- | --- | --- |
| Frankfurter (`api.frankfurter.dev`) | Only when a consolidated view needs a month's reference rates it does not have | A date window and currency codes, and the device's IP address as with any request; no key, no amount, no account | **EXISTS TODAY**: "the only network call without the owner's backend" (`apps/mobile/README.md`). To be named in the privacy policy before TestFlight (`docs/currency.md` §8.2) |
| Apple | Always, as the platform | Downloads, purchases, opt-in diagnostics: Apple's own collection, which the developer does not declare | — |
| Expo (EAS) | Build time | Source and credentials to build and sign; nothing from users. EAS Update, if ever added, would see update requests from installs | Build service only |
| Vercel (mobile API host) | Only once the owner configures the backend and the person uses a cloud capability | Requests to `api/mobile/*` | **NOT IMPLEMENTED** as a live service: unconfigured and failing closed |
| Supabase (identity, database) | Same | Session, quota rows, capture inbox rows; later entitlement and optional sync data | **NOT IMPLEMENTED** |
| AI provider (the adapter in code targets OpenAI; the choice is open, production-plan.md §5) | Only with the person's consent, per request | The person's message (which may itself name a merchant or an amount); for analytical questions aggregated facts with category names; never the ledger's merchants, account names, balances or movements | **NOT IMPLEMENTED**: no key, no live call |
| RevenueCat | Only if chosen in 25F | Purchase history and an app user ID | **NOT IMPLEMENTED**; DPA and sub-processors to read first (§2) |
| An analytics vendor | Only if chosen (§7) | Events without financial content | **NOT IMPLEMENTED** |

Rules for all of them: a provider is added to the policy and the label **before** the build that uses it ships; each
has its own staging and production credentials (production-plan.md §2); logs never contain prompts, amounts or tokens;
and the repository, being public, never holds a policy draft with personal contact data that the owner has not chosen
to publish.

---

## 14. Landing page

**NOT IMPLEMENTED, and not built in this delivery.** A launch asset: the support, privacy and terms pages are needed to
submit (Producto 26); whether the marketing page ships with 1.0 or after it is an **OWNER DECISION** (roadmap §5:
"landing and support pages").

- **The retired product web app does not return. DECIDED** (decision 004; AGENTS rule 4). The marketing site is a
  separate, simple marketing surface, not a web version of FinanzApp: no ledger, no login, no account data, nothing
  from `packages/domain` running in a browser.
- **Where it lives.** Outside the retired paths: never a root `src/`, `public/`, `index.html` or any path
  `npm run check:repo` guards, and never deployed from the Vercel project that hosts `api/mobile` (README, «Hosting»:
  that project "serves no web page"). Either its own repository or a clearly separate directory with its own project,
  recorded in a decision when it starts. **OWNER DECISION.**
- **Technology.** A static site: Next.js or another static or web framework appropriate at the time. Chosen when it is
  built.
- **Possible content:** a hero with the iPhone and one sentence; spending and budgets; cards and cuotas; Wallet capture
  (only once it ships, described as the person's own automation); the controlled Assistant (drafts the person confirms);
  privacy and local-first; pricing (only when Pro exists, matching the App Store exactly); FAQ; support and privacy
  links; the App Store call to action (Apple's badge under its marketing guidelines).
- **It also hosts** the privacy policy, terms and support pages that App Store Connect needs as URLs (§13); those are
  needed before the marketing page and can ship first as plain pages.
- **Design references.** Refero or manually collected references may be used for inspiration; no paid Refero MCP or
  other paid tool is assumed.
- **The brand gate first** (§9.4): the page carries the final public name and identity, never the working name or
  placeholder artwork.
- **The same honesty rules as the listing** (§9.1): real screens with clearly fictional data, no invented testimonials
  or numbers, no bank or Wallet-history claims. Any site analytics follows §7's principles and its own consent rules.

---

## 15. Questions this document answers

| Question | Where |
| --- | --- |
| What is Free vs Pro? | §1 (a framework; the boundary is an owner decision in 25F) |
| StoreKit or RevenueCat? | §2 (comparison, a recommendation and the gates that could change it) |
| Where is the paywall? | §3 |
| How do subscriptions restore? | §1.3, §3.2, §5 «Restore and reconciliation» |
| How do we know who has Pro? | §4.3, §4.4 |
| Do we know a subscriber's Apple email? | No: §4.1 |
| How can the owner or testers receive access? | §4.5 |
| Where does Apple send the money? | §6.1 |
| What still needs banking or tax setup? | §6.2, §6.3 |
| Which analytics come from Apple? | §8 |
| What product analytics do we collect? | None today; candidates and rules in §7 |
| How do we avoid uploading financial details to analytics? | §7.1, §7.2 «Never sent», §7.4 |
| What is our ASO process? | §9 |
| Is «FinanzApp» the final name? | No, not assumed: §9.4 (the brand, naming and identity gate) |
| Which markets and languages launch first? | §10 (the matrix; the first market is an owner decision) |
| What is required for TestFlight? | §11.8, §11.3 |
| What is required for App Review? | §12 |
| What support, privacy and legal pages are required? | §13 |
| What remains a gate rather than a completed capability? | Every label in this document; the summary is production-plan.md §14 |
| Do we need Vercel? What is Supabase for? Where does the ledger live? | production-plan.md §3, §4, §1 |
| Does using AI upload all financial data? Which model, and how is it chosen? Can the Assistant execute code? What prevents prompt injection from becoming execution? | production-plan.md §5 |
| What is the AI spend ceiling? | production-plan.md §6 |
| How does Wallet capture work, and how does a Wallet card map to a FinanzApp card? What happens when data is incomplete? | production-plan.md §7 |
| Is Dynamic Island a notification? How does Confirm reach the same write path? What happens without it? | production-plan.md §8 |
| Which reminders are local notifications? When would push be required? | production-plan.md §9 |
| What will the calendar show? | production-plan.md §10 |
| How does Face ID differ from encryption? What does the hide-amounts eye do? | production-plan.md §11 |

---

## 16. Sources

External pages read on **2026-10-02**. Wording quoted in this document comes from these pages as fetched that day;
re-read before relying on any of it.

**Apple: App Store Connect, agreements and business**

- App Review Guidelines (page marked "Last Updated: June 8, 2026"): https://developer.apple.com/app-store/review/guidelines/
- Guideline update of 2025-11-13 (5.1.2(i), third-party AI): https://developer.apple.com/news/?id=ey6d8onl
- Apple Developer Program License Agreement, Schedules 1 to 3 and exhibits: https://developer.apple.com/support/terms/apple-developer-program-license-agreement/
- Auto-renewable subscriptions (commission, grace period, describing subscriptions): https://developer.apple.com/app-store/subscriptions/
- App Store Small Business Program: https://developer.apple.com/app-store/small-business-program/
- Program membership, fee and commission: https://developer.apple.com/programs/whats-included/
- App Store Connect release notes (promo codes ended, offer codes extended, commitment plans): https://developer.apple.com/help/app-store-connect/release-notes/
- Sign and update agreements: https://developer.apple.com/help/app-store-connect/manage-agreements/sign-and-update-agreements
- Provide tax information: https://developer.apple.com/help/app-store-connect/manage-tax-information/provide-tax-information
- Enter banking information: https://developer.apple.com/help/app-store-connect/manage-banking-information/enter-banking-information
- Banking information reference: https://developer.apple.com/help/app-store-connect/reference/reporting/banking-information
- Overview of receiving payments: https://developer.apple.com/help/app-store-connect/getting-paid/overview-of-receiving-payments
- Minimum payment threshold: https://developer.apple.com/help/app-store-connect/reference/reporting/minimum-payment-threshold
- Payment information fields: https://developer.apple.com/help/app-store-connect/reference/reporting/payment-information
- Financial report regions and currencies: https://developer.apple.com/help/app-store-connect/reference/reporting/financial-report-regions-and-currencies
- Apple legal entities: https://developer.apple.com/help/app-store-connect/reference/reporting/apple-legal-entities
- Set a price; pricing for auto-renewable subscriptions: https://developer.apple.com/help/app-store-connect/manage-app-pricing/set-a-price/ , https://developer.apple.com/help/app-store-connect/manage-subscriptions/manage-pricing-for-auto-renewable-subscriptions/
- Subscription offer codes: https://developer.apple.com/help/app-store-connect/manage-subscriptions/set-up-subscription-offer-codes
- Billing Grace Period: https://developer.apple.com/help/app-store-connect/manage-subscriptions/enable-billing-grace-period-for-auto-renewable-subscriptions
- Purchase options (multiseat): https://developer.apple.com/help/app-store-connect/manage-subscriptions/manage-purchase-options-for-auto-renewable-subscriptions
- Family Sharing for in-app purchases: https://developer.apple.com/help/app-store-connect/configure-in-app-purchase-settings/turn-on-family-sharing-for-in-app-purchases
- App promo codes: https://developer.apple.com/help/app-store-connect/offer-promo-codes/request-and-manage-promo-codes
- App Store & Privacy (what developers receive): https://www.apple.com/legal/privacy/data/en/app-store/
- Apple PKI (root certificates): https://www.apple.com/certificateauthority/

**Apple: StoreKit, App Store Server API and Notifications**

- VerificationResult and server verification: https://developer.apple.com/documentation/storekit/verificationresult
- App Store Server Library: https://developer.apple.com/documentation/appstoreserverapi/simplifying-your-implementation-by-using-the-app-store-server-library , https://github.com/apple/app-store-server-library-node
- JWSTransaction, decoded header and payload: https://developer.apple.com/documentation/appstoreserverapi/jwstransaction , https://developer.apple.com/documentation/appstoreserverapi/jwsdecodedheader , https://developer.apple.com/documentation/appstoreserverapi/jwstransactiondecodedpayload
- Renewal info payload: https://developer.apple.com/documentation/appstoreserverapi/jwsrenewalinfodecodedpayload
- appAccountToken, Set App Account Token: https://developer.apple.com/documentation/appstoreserverapi/appaccounttoken , https://developer.apple.com/documentation/appstoreserverapi/set-app-account-token
- originalTransactionId, appTransactionId: https://developer.apple.com/documentation/appstoreserverapi/originaltransactionid , https://developer.apple.com/documentation/storekit/apptransaction/apptransactionid
- Get All Subscription Statuses, status values, environment: https://developer.apple.com/documentation/appstoreserverapi/get-all-subscription-statuses , https://developer.apple.com/documentation/appstoreserverapi/status , https://developer.apple.com/documentation/appstoreserverapi/environment
- Get Notification History: https://developer.apple.com/documentation/appstoreserverapi/get-notification-history
- Enabling and responding to notifications; notificationUUID; types and subtypes: https://developer.apple.com/documentation/appstoreservernotifications/enabling-app-store-server-notifications , https://developer.apple.com/documentation/appstoreservernotifications/responding-to-app-store-server-notifications , https://developer.apple.com/documentation/appstoreservernotifications/notificationuuid , https://developer.apple.com/documentation/appstoreservernotifications/notificationtype
- currentEntitlements, renewal state, Transaction.updates: https://developer.apple.com/documentation/storekit/transaction/currententitlements , https://developer.apple.com/documentation/storekit/product/subscriptioninfo/renewalstate , https://developer.apple.com/documentation/storekit/transaction/updates
- AppStore.sync(), showManageSubscriptions: https://developer.apple.com/documentation/storekit/appstore/sync() , https://developer.apple.com/documentation/storekit/appstore/showmanagesubscriptions(in:)
- Billing retry and involuntary churn: https://developer.apple.com/documentation/storekit/reducing-involuntary-subscriber-churn
- Family Sharing in StoreKit: https://developer.apple.com/documentation/storekit/supporting-family-sharing-in-your-app
- Introductory, promotional, offer-code and win-back offers: https://developer.apple.com/documentation/storekit/implementing-introductory-offers-in-your-app , https://developer.apple.com/documentation/storekit/implementing-promotional-offers-in-your-app , https://developer.apple.com/documentation/storekit/supporting-offer-codes-in-your-app , https://developer.apple.com/documentation/storekit/supporting-win-back-offers-in-your-app
- Testing with Xcode and the sandbox; sandbox account settings; TestFlight purchases: https://developer.apple.com/documentation/storekit/testing-at-all-stages-of-development-with-xcode-and-the-sandbox , https://developer.apple.com/help/app-store-connect/test-in-app-purchases/manage-sandbox-apple-account-settings , https://developer.apple.com/help/app-store-connect/test-a-beta-version/testing-subscriptions-and-in-app-purchases-in-testflight
- Sign in with Apple (identifier, private relay): https://developer.apple.com/documentation/signinwithapple/authenticating-users-with-sign-in-with-apple , https://developer.apple.com/documentation/signinwithapple/communicating-using-the-private-email-relay-service
- Account deletion: https://developer.apple.com/support/offering-account-deletion-in-your-app/
- Requesting reviews: https://developer.apple.com/documentation/storekit/requestreviewaction

**Apple: release, metadata, privacy and analytics**

- TestFlight overview: https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview/ , https://developer.apple.com/testflight/
- Release options; phased release; availability; making a version unavailable: https://developer.apple.com/help/app-store-connect/manage-your-apps-availability/select-an-app-store-version-release-option/ , https://developer.apple.com/help/app-store-connect/update-your-app/release-a-version-update-in-phases/ , https://developer.apple.com/help/app-store-connect/manage-your-apps-availability/manage-availability-for-your-app-on-the-app-store/ , https://developer.apple.com/help/app-store-connect/manage-your-apps-availability/make-a-version-unavailable-for-download/
- App Review and expedited review: https://developer.apple.com/distribute/app-review/
- Version and build numbers (TN2420): https://developer.apple.com/library/archive/technotes/tn2420/_index.html
- App information and platform version information (field limits, URLs): https://developer.apple.com/help/app-store-connect/reference/app-information/app-information/ , https://developer.apple.com/help/app-store-connect/reference/app-information/platform-version-information/
- Product page and search guidance: https://developer.apple.com/app-store/product-page/ , https://developer.apple.com/app-store/search/
- Screenshot and app preview specifications: https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/ , https://developer.apple.com/help/app-store-connect/reference/app-information/app-preview-specifications/
- Categories: https://developer.apple.com/app-store/categories/
- App Store localizations per storefront: https://developer.apple.com/help/app-store-connect/reference/app-information/app-store-localizations/
- Custom product pages; Product Page Optimization: https://developer.apple.com/app-store/custom-product-pages/ , https://developer.apple.com/app-store/product-page-optimization/
- Ratings and reviews: https://developer.apple.com/app-store/ratings-and-reviews/
- App privacy details (labels): https://developer.apple.com/app-store/app-privacy-details/
- Privacy manifest files; third-party SDK requirements: https://developer.apple.com/documentation/bundleresources/privacy-manifest-files , https://developer.apple.com/support/third-party-SDK-requirements/
- Export compliance: https://developer.apple.com/documentation/security/complying-with-encryption-export-regulations , https://developer.apple.com/help/app-store-connect/reference/app-information/export-compliance-documentation-for-encryption/
- Age ratings: https://developer.apple.com/help/app-store-connect/reference/app-information/age-ratings-values-and-definitions/ , https://developer.apple.com/news/?id=ks775ehf
- Custom license agreement (EULA): https://developer.apple.com/help/app-store-connect/manage-app-information/provide-a-custom-license-agreement/
- EU Digital Services Act trader requirements: https://developer.apple.com/help/app-store-connect/manage-compliance-information/manage-european-union-digital-services-act-trader-requirements/
- Accessibility Nutrition Labels: https://developer.apple.com/help/app-store-connect/manage-app-accessibility/overview-of-accessibility-nutrition-labels/
- App Analytics and metric definitions; reporting tools; campaign links; subscription data; Analytics Reports API: https://developer.apple.com/app-store-connect/analytics/ , https://developer.apple.com/help/app-store-connect-analytics/reference/metrics-definitions/ , https://developer.apple.com/help/app-store-connect/measure-app-performance/overview-of-reporting-tools/ , https://developer.apple.com/help/app-store-connect-analytics/acquisition/campaign-links , https://developer.apple.com/help/app-store-connect/measure-app-performance/view-subscription-data/ , https://developer.apple.com/documentation/appstoreconnectapi/analytics
- Upcoming requirements (Xcode and SDK minimums): https://developer.apple.com/news/upcoming-requirements/

**Expo**

- In-app purchases guide: https://docs.expo.dev/guides/in-app-purchases/
- `eas.json` and build profiles; internal distribution: https://docs.expo.dev/build/eas-json/ , https://docs.expo.dev/build/internal-distribution/
- App versions: https://docs.expo.dev/build-reference/app-versions/
- Managed credentials and security: https://docs.expo.dev/app-signing/managed-credentials/ , https://docs.expo.dev/app-signing/security/
- EAS Submit for iOS and TestFlight: https://docs.expo.dev/submit/ios/ , https://docs.expo.dev/submit/testflight/
- EAS environment variables: https://docs.expo.dev/eas/environment-variables/ , https://docs.expo.dev/guides/environment-variables/
- EAS Update (introduction, runtime versions, rollbacks, error recovery): https://docs.expo.dev/eas-update/introduction/ , https://docs.expo.dev/eas-update/rollbacks/ , https://docs.expo.dev/eas-update/error-recovery/
- Apple privacy manifests in Expo: https://docs.expo.dev/guides/apple-privacy/
- EAS pricing and plans: https://expo.dev/pricing , https://docs.expo.dev/billing/plans/

**RevenueCat**

- Pricing: https://www.revenuecat.com/pricing/
- Billing and account management (tracked revenue, export, project deletion): https://www.revenuecat.com/docs/welcome/set-up-revenuecat/account-management
- Expo installation: https://www.revenuecat.com/docs/getting-started/installation/expo
- Entitlements; identifying customers; customer lists and profiles (granted entitlements): https://www.revenuecat.com/docs/getting-started/entitlements , https://www.revenuecat.com/docs/customers/identifying-customers , https://www.revenuecat.com/docs/dashboard-and-metrics/customer-lists , https://www.revenuecat.com/docs/dashboard-and-metrics/customer-profile
- Webhooks; Apple server notifications: https://www.revenuecat.com/docs/integrations/webhooks , https://www.revenuecat.com/docs/platform-resources/server-notifications/apple-server-notifications
- Apple App Privacy guidance; DPA: https://www.revenuecat.com/docs/platform-resources/apple-platform-resources/apple-app-privacy , https://www.revenuecat.com/dpa
- Migration and SDK-less integration: https://www.revenuecat.com/docs/migrating-to-revenuecat/migrating-existing-subscriptions , https://www.revenuecat.com/docs/migrating-to-revenuecat/sdk-or-not/sdk-less-integration
- Trusted Entitlements: https://www.revenuecat.com/docs/customers/trusted-entitlements

**Community library (not Apple or Expo)**

- `expo-iap` / OpenIAP setup for Expo: https://openiap.dev/docs/setup/expo

**Repository documents this plan reconciles with**

- [mobile-roadmap.md](mobile-roadmap.md): «Decisions that still bind», «Producto 25E», «Producto 25F», «Producto 26»,
  «After launch», «Later notes recorded in 24UX6A».
- [decisions/001-native-mobile.md](decisions/001-native-mobile.md), [decisions/004-native-first-and-web-retirement.md](decisions/004-native-first-and-web-retirement.md),
  [decisions/005-forest-four-tabs-and-capture.md](decisions/005-forest-four-tabs-and-capture.md).
- [i18n.md](i18n.md), [currency.md](currency.md), [region-families.md](region-families.md),
  [mobile-device-checklist.md](mobile-device-checklist.md), [mobile-integrations.md](mobile-integrations.md).
- `AGENTS.md`, `README.md`, `apps/mobile/README.md`, `apps/mobile/eas.json`, `apps/mobile/app.config.ts`.
