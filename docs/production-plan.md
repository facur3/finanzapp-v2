# FinanzApp: production plan

**Status.** Planning document, written 2026-10-02 in Producto 25OPS1. Nothing described here is implemented unless it
is marked **EXISTS TODAY**. No environment was created, no remote migration was run, no EAS build was made and no paid
provider was called to write it.

- External facts (Apple, Expo, Supabase, Vercel, AI providers) were read on **2026-10-02** from the sources in §16.
  Prices, limits, model names and OS behaviour change; re-read the source before any decision that depends on one.
  Where a fact could not be confirmed on a primary page it is written as *unverified* with what would verify it.
- The sibling document is [app-store-launch.md](app-store-launch.md): monetisation, subscriptions, App Store money,
  analytics, ASO, market localization, the release pipeline, App Review and the legal deliverables.
- Sequencing stays in [mobile-roadmap.md](mobile-roadmap.md) (§3 «Next deliveries», §4 «Launch»). This document
  explains the architecture and the gates behind those phases; it does not reorder them. The binding rules are
  [AGENTS.md](../AGENTS.md) and [decisions/](decisions/) 001 to 005. When this document and one of those disagree,
  they win and this document is corrected.

## Labels

| Label | Meaning |
| --- | --- |
| **EXISTS TODAY** | In the repository at Producto 25OPS1, with the file named. "Exists" is code and tests on Linux, not device evidence. |
| **DECIDED** | A binding rule already in AGENTS.md, a decision record or the roadmap, or stated as binding in the owner's 25OPS1 brief. The source is cited. |
| **RESEARCH GATE** | Unknown until an experiment or a physical-device proof settles it. Nothing may be built on the assumed answer. |
| **IMPLEMENTATION GATE** | Must be built and tested before the next step may start. |
| **OWNER DECISION** | A product, commercial or risk choice only the owner makes. |
| **OWNER ACTION** | Something only the owner can do: an account, a payment, a dashboard setting, an authorization. |
| **REMOTE SETUP** | A remote resource (a project, a key, an environment) that does not exist yet. Never created by an agent without an explicit release decision (AGENTS rule 3). |
| **DEVICE QA** | Needs a recorded result on a physical iPhone (AGENTS rule 11). |
| **NOT IMPLEMENTED** | No code exists. |
| **LAUNCH BLOCKER** | Must be closed, or consciously deferred by the owner, before a public release. |

---

## 1. Data ownership and storage

**DECIDED** (AGENTS rules 6, 8, 9; decision 001, «Data and security target»; decision 004): the person's financial
records live on their iPhone. The local SQLite ledger is the source of truth. Financial writes are local first: saved
on the device before success is shown, and never dependent on a connection, an account, a bank or a subscription.

### 1.1 What lives on the device today

| Store | **EXISTS TODAY** | What it holds | In a backup |
| --- | --- | --- | --- |
| Financial ledger | `finanzapp-native-pilot-v1.sqlite`, schema 14 (`apps/mobile/src/storage/database.ts`) | Accounts, movements, transfers, recurring rules, budgets, cards, debts, instalment plans, purchase operations, categories, audit and undo records. Money in integer minor units per currency. | Yes (JSON, up to v14) |
| Review store | `finanzapp-review-v1.sqlite`, version 1 (`apps/mobile/src/storage/review-database.ts`) | Review items (pending, confirmed, dismissed) with a frozen write id. **No screen opens it yet** (`nativeDatabase.ts` says so). | No, by design |
| Rate cache | `finanzapp-rates-v1.sqlite`, version 1 (`apps/mobile/src/storage/rates-database.ts`) | Reference exchange rates per day, base USD. Reference data anyone can download again. | No |
| Preferences | expo-sqlite's key-value store | Language, region, recent choices, appearance, display currency and mode, the first-opening mark. | No |
| Backup files | A JSON document built on demand (`apps/mobile/app/backup.tsx`, `packages/domain/recovery.ts`) | The ledger archive, lowest schema that fits (v8 to v14), 5 MB cap. Plain, unencrypted. | It is the backup |
| Assistant conversation | Memory only (`apps/mobile/src/assistant/session.ts`) | The current session's messages and one parked draft. Closing the app erases it. | No |

Not present today (**NOT IMPLEMENTED**): Keychain or SecureStore use, any session or token, an outbox or sync queue,
an encrypted database, an explicit iOS data-protection class, an automatic or cloud backup. The app holds no secret
because it has no session, no token and no API key. The candidates for the Keychain, when they exist, are small
secrets only: a session token (25A), a database key if encryption is adopted (§11.3), and nothing of the ledger
itself (§11.5).

### 1.2 What works offline, and what leaves the device

- **Completely offline (EXISTS TODAY):** recording and editing expenses, incomes, transfers, card purchases and
  instalments, devoluciones, budgets, recurring rules, debts, reports, search, backup export and import, language and
  region. None of it needs an account.
- **The one network call today (EXISTS TODAY):** the reference-rate download from Frankfurter
  (`apps/mobile/src/fx/frankfurter.ts`). A request names a date window and currency codes. It carries no amount, no
  account and no identifier, and it is made only when a consolidated view needs a month the cache lacks. The person's
  IP address and the set of currencies they hold reach that third party; [currency.md](currency.md) §8 records that
  the privacy policy must name it before the first TestFlight.
- **Never needs to leave the device (DECIDED):** the ledger rows, account names, merchants, balances, the review store
  and the preferences. Manual entry never contacts a server (AGENTS rule 12).
- **Leaves only with explicit consent (DECIDED, NOT IMPLEMENTED):** the text of an Assistant request and, for an
  analytical question, the aggregated facts of §5.4; later, if 25E is built, the rows the person chooses to sync or
  back up to their own cloud account. Consent is asked when the person turns the feature on, names what travels and
  to whom, and can be withdrawn.

### 1.3 Uninstall, backup, recovery, deletion

- **Uninstall risk (EXISTS TODAY).** Deleting the app deletes the ledger. A local database is not a backup (decision
  001). The only recovery today is a backup file the person exported and kept. This must be said in the app before
  launch (see [app-store-launch.md](app-store-launch.md) §13).
- **Whether iOS device or iCloud backups include the ledger** is *unverified*: expo-sqlite's source places databases
  under `Documents/SQLite`, which iOS normally includes in device backups, but neither Expo's documentation nor a device
  check confirms it. **RESEARCH GATE, DEVICE QA:** restore an iPhone backup to a second device and record whether the
  ledger arrives. Until then the app must not claim that iCloud protects the data.
- **Local backup and export (EXISTS TODAY).** A JSON file through the iOS share sheet; where it lands is the person's
  choice. Import accepts v1 to v14 through a reviewed merge that never overwrites and rolls back on failure.
- **Recovery after a failed write (EXISTS TODAY).** A failed write keeps the draft; storage is never reset on an error
  (AGENTS rule 9). A file from a newer build is refused untouched.
- **Deletion (EXISTS TODAY, partly).** Movements are voided and restorable; accounts, cards, recurring rules, debts
  and plans keep a deletion record. There is no "erase everything" action in the app. **OWNER DECISION** before launch:
  whether to offer one, and its wording, given that deleting the app already erases local data.
- **Server-side data.** Nothing of the person's is on a server today. When 25A adds a session, the server will hold an
  identity, usage counters and, if the remote capture inbox is used, capture payloads. Export and deletion of that data
  are specified in §4.6.

### 1.4 Future cloud, and what Supabase does not do

**DECIDED** (decision 001; roadmap «Producto 25E»): cloud is optional. It may hold identity, Assistant requests in
transit, quota and admin metadata, a subscription entitlement tied to an account, and, only if the owner still wants
it at 25E, an optional backup or multi-device sync. No account is ever mandatory for local use.

**Supabase does not provide offline sync by itself.** Storing rows in Postgres gives none of the following. Each is an
**IMPLEMENTATION GATE** of 25E:

| Requirement | Why | What exists locally today |
| --- | --- | --- |
| Operation IDs | Every change is an identified operation that can be replayed exactly once. | Client-generated UUID per row; creates idempotent by id; one id is one kind of write (`packages/domain/write-ids.ts`). |
| Revisions | Detect that two devices changed the same row. | A local `revision` column per row; no server revision. |
| Tombstones | A deleted row must stay deleted on every device. | Deletion records for accounts, cards, rules, debts and plans; movements are `voided`, with no per-row tombstone. |
| Outbox | Changes made offline wait durably and are sent once. | None. |
| Conflict policy | A written rule for concurrent edits, tested with two devices. The retired web app's last-write-wins JSON snapshot is not reused. | None. |
| Idempotency | A retried upload never doubles a movement, a transfer or an instalment. | Local only. |
| RLS | A user reads and writes only their own rows; proven with a second user. | Only for the capture inbox and usage tables (§4). |
| Recovery | Restore after reinstall; a partial sync never corrupts the ledger. | Local backup import only. |
| Deletion and export | The person can export and delete the cloud copy. | Local export only. |

Until that work exists and passes its gates (two devices with conflicting edits, an offline queue replayed once, a
deleted row staying deleted, a restore after reinstall), FinanzApp claims neither sync nor cloud backup.

---

## 2. Environments

No environment is created by this document. The matrix is the target; the "today" column is the truth.

### 2.1 What exists today

- **EXISTS TODAY:** two app variants, selected by `APP_VARIANT` in `apps/mobile/app.config.ts`, which throws for any
  other value: `development` (`com.facur3.finanzapp.dev`, "FinanzApp Dev") and `preview`
  (`com.facur3.finanzapp.preview`, "FinanzApp Preview"). There is **no production variant**.
- **EXISTS TODAY:** three EAS build profiles in `apps/mobile/eas.json`: `development` (development client, internal),
  `preview` (internal, bundled JavaScript) and `testflight` (store distribution). The `testflight` profile sets
  `APP_VARIANT=preview`, so today it would upload the `.preview` identity under the name "FinanzApp Preview". There is
  no `production` profile. Details and the fix are in [app-store-launch.md](app-store-launch.md) §11.
- **EXISTS TODAY:** one Vercel project that serves the two mobile API routes (§3). Whether it has any environment
  variable set was not inspected; unconfigured, both routes answer 503.
- **NOT IMPLEMENTED, REMOTE SETUP:** no Supabase project is recorded in the repository, no AI provider project, no
  staging or production backend, no StoreKit configuration, no analytics.

### 2.2 Target matrix

| | Local / development | Staging | Production |
| --- | --- | --- | --- |
| Purpose | Daily work on the owner's registered iPhone with Metro; CI on Linux. | The first place a network feature runs end to end, with test accounts only. | Real people. |
| Expo / EAS profile | `development` (exists) | `preview` (exists) for ad hoc installs; an internal TestFlight build once the identity is decided | A `production` profile that does not exist yet (**IMPLEMENTATION GATE**, Producto 26) |
| App identity | `com.facur3.finanzapp.dev` | `com.facur3.finanzapp.preview` | **OWNER DECISION** at Producto 26. `com.facur3.finanzapp` was registered by the retired Capacitor app and is not reassigned by default (decision 004; AGENTS rule 3). |
| Backend origin | None, or a local server with fakes. Never production. | A staging origin of the mobile API (§2.4) | The production origin of the mobile API |
| Supabase project | None, or the CI PostgreSQL job | A staging project of its own | A production project of its own |
| AI project and key | Deterministic fakes; fixtures (`EXPO_PUBLIC_ASSISTANT_FIXTURES`, development bundles only) | A dedicated provider project or workspace with its own key and a very small hard cap | A separate dedicated project or workspace, key and cap |
| StoreKit environment | StoreKit testing or none | Sandbox (TestFlight purchases are not charged) | Production |
| Analytics | Off | Off, or sent to a staging stream that production reports never read | On only after consent rules are decided ([app-store-launch.md](app-store-launch.md) §7) |
| Logging | Console | Server logs without prompts, amounts or tokens | Same rule, shorter retention where the plan allows |
| Request quotas | Not applicable | The existing per-user and global counters, set low | Set from measured staging use |
| Monetary limits | None spent | A provider hard cap far below production; server ceiling lower still (§6) | Owner-approved ceilings (§6) |
| Feature flags | Development-only preview flags, compiled out of release bundles | Server flags (`MOBILE_INTEGRATIONS_ENABLED`, `MOBILE_AI_ENABLED`) | The same flags, with their own values |
| Secrets | None in the repository; none in the app | Server environment of the staging deployment only | Server environment of the production deployment only |

### 2.3 Rules

**DECIDED** (owner's 25OPS1 brief): staging and production never silently share a database, provider credentials, an
AI budget, StoreKit assumptions or admin data. The five rules below are this plan's implementation of that decision:

1. A build can reach exactly one backend origin, fixed at build time by `EXPO_PUBLIC_MOBILE_API_ORIGIN`. A staging
   build can never be pointed at production by a runtime switch, and the reverse. (Today the app reads that name
   through an `env` object; the literal read that makes it a build-time constant is a gate, §4.7.)
2. `EXPO_PUBLIC_*` values are compiled into the app and readable by anyone with the binary. No secret is ever one.
3. Each environment has its own Supabase project, its own provider key and its own budget. A key is never copied
   between them.
4. A staging account, entitlement or quota row never grants anything in production.
5. Every server-side enable flag defaults to off. A missing variable disables the feature; it never falls back to
   another environment.

### 2.4 Staging access on Vercel

**RESEARCH GATE, OWNER DECISION.** Vercel's Standard Deployment Protection puts an authentication wall in front of
every non-production URL, which a phone app cannot pass. The options (the last three are Vercel's documented staging
patterns as read on 2026-10-02; the first is this plan's own proposal, to be confirmed against plan limits and cost):

| Option | Trade-off |
| --- | --- |
| A second Vercel project for staging, with its own production domain and variables | Cleanest isolation. One more project to keep. |
| A custom environment named `staging` on the same project | Needs the Pro plan (one custom environment per project). The URL still needs a protection decision. |
| A preview branch with a protection-bypass secret | The secret would ship inside a staging binary. Rejected unless nothing else works. |
| A "staged production deployment" | Uses production variables, so it can reach production data. **Not allowed** for staging. |

The first option is the default recommendation because it makes rule 3 structural. It is the owner's call because it
may carry a plan cost (§3.4).

### 2.5 Promotion and rollback

- **Promotion.** A change reaches production only after it ran in staging with the same schema version and the same
  server build. The order is always: schema (additive, compatible with the running server) then server then app.
- **Server rollback.** Vercel can roll a production deployment back to an earlier one. A rollback restores code and the
  variables baked into that deployment; it does not roll back a database schema. Therefore every schema change must
  remain compatible with the previous server build.
- **Schema rollback.** Forward-only. A bad migration is fixed by a new migration, never by editing an applied one.
- **App rollback.** A released binary cannot be recalled. The emergency controls are the server flags (turning cloud
  features off leaves the offline app complete) and the release controls in
  [app-store-launch.md](app-store-launch.md) §11.
- **Local data.** No server change can require or cause a reset of the local ledger.

---

## 3. Backend hosting: Vercel today and when to reconsider

### 3.1 What Vercel is here

**EXISTS TODAY, DECIDED** (decision 004; README «Hosting»; AGENTS rule 4). The Vercel project is the mobile API's host
and nothing else. It is not leftover web infrastructure: the web product was retired on 2026-09-25, its tree cannot
return (`npm run check:repo`), and `vercel.json` builds only a plain `404.html` because Vercel refuses an empty output.

Exactly two routes are deployed:

| Route | File | What it does |
| --- | --- | --- |
| `POST /api/mobile/assistant` | `api/mobile/assistant.js` → `server/mobile/handlers.js` | Validates an Assistant request, reserves quota, calls the provider once, validates the answer. Never writes a ledger. |
| `POST /api/mobile/captures` | `api/mobile/captures.js` → `server/mobile/handlers.js` | Stores a capture in a durable inbox as `needs_review`. A receipt is not a saved expense. |

Both fail closed. Without configuration `GET` answers 405 and `POST` answers 503; configured, a request without a
verified session answers 401. The handlers are ES modules that use the platform's `fetch` and no SDK; the root
`package.json` has no runtime dependency.

```
iPhone (FinanzApp)
   │  HTTPS, bearer session token, JSON ≤ 24 000 bytes
   ▼
Mobile API on Vercel   (/api/mobile/assistant, /api/mobile/captures)
   │  verifies the session, calls RPCs with the user's own token
   ▼
Supabase   (Auth; Postgres with RLS: capture inbox, usage counters)
   │  only on the assistant route, only when AI is enabled
   ▼
AI provider   (one bounded call, no tools, strict JSON back)
```

The ledger is not in this picture. It stays on the iPhone.

### 3.2 Decision for 25A staging

**DECIDED** (owner's 25OPS1 brief): keep the current Vercel mobile API for the 25A staging plan. Nothing in the
repository or in the platform limits read on 2026-10-02 is a concrete blocker: the handlers already run there, the
tests and CI already cover them, and the documented limits (300 s default duration, 4.5 MB body) are far above this
workload (a 25 s provider timeout, a 24 KB body). Nothing is deleted or migrated in 25OPS1. No migration is made merely
to reduce the number of providers.

### 3.3 Vercel Functions and Supabase Edge Functions compared

Facts as documented by each vendor on 2026-10-02. "Measure" marks what only staging can answer.

| Dimension | Vercel Functions (current) | Supabase Edge Functions (alternative) |
| --- | --- | --- |
| Runtime | Node.js (24.x default). Existing handlers run unchanged. | Deno-compatible runtime. The handlers need a port from `(req, res)` to `Request → Response`, `process.env` to `Deno.env`, and a home under `supabase/functions/`. Effort: measure with a spike. |
| Distance to the database | One region, chosen to match the Supabase project. Auth and RPC over HTTPS. | Runs near the caller by default; can be pinned to the database region. Latency: measure. |
| Session check | Today one extra call to Supabase Auth per request. | The platform validates the JWT before the handler. |
| Cold starts | Bytecode caching and in-instance concurrency; pre-warming on paid plans only. | "Cold starts are possible"; warm period plan-dependent, no figure published. Measure. |
| Duration and CPU | 300 s default. CPU is a billed meter, not a cap. | 150 s wall clock on Free, 400 s paid; 2 s CPU per request; 256 MB memory. |
| Streaming | Supported; the duration cap includes the stream. | Supported. Whether React Native on iOS delivers chunks incrementally: **DEVICE QA** for both. |
| Secrets | Per-environment variables, encrypted, optionally non-readable; a change needs a new deployment. | Per-project secrets, read without a redeploy; a secret (RLS-bypassing) key is injected into every function by default, which the current design does not hold at all. |
| Rollback | Instant rollback to an earlier production deployment. | No rollback or version history described on the deploy page (*unverified* that none exists); redeploy the previous commit. |
| Logs | 1 hour on Hobby, 1 day on Pro, 30 days with a paid add-on. | Dashboard logs; retention follows the plan (1 day Free, 7 days Pro for API and database logs; function logs not stated separately). |
| Cost model | Active CPU, memory-time and invocations. Waiting on the provider bills memory, not CPU. | Invocations only. |
| Spend stop | Pro: spend management can pause production, with minutes of lag. | Pro: the spend cap covers function invocations. |
| Vendor surface | Two vendors, two dashboards, two secret stores. | One vendor; database, auth and functions fail together. |

Neither platform's documented limits block the workload. At this size both platform bills are small next to the AI
bill. The choice turns on porting cost, plan cost and measured latency.

### 3.4 Facts that need the owner now

- **OWNER ACTION, LAUNCH BLOCKER — plan.** Vercel's fair-use guidelines restrict the Hobby plan to "non-commercial
  personal use only". A backend for an app that sells a subscription is commercial use; that needs the Pro plan before
  monetisation. Which plan the project is on today was not inspected. Supabase's Free plan pauses a project after a week
  without activity and has no backups, so it is not a production backend either. Each is a paid subscription and needs
  the owner's authorization (AGENTS rule 3).
- **OWNER ACTION — Node version.** Vercel disabled Node.js 20 for new deployments on 2026-10-01. The root
  `package.json` (what the Vercel project reads) declares no `engines` (`apps/mobile/package.json` declares one for the
  app's tooling only), so the project setting decides. Check it before the next deployment; adding `engines.node` to
  the root `package.json` is the durable fix and belongs to the next server slice.
- **IMPLEMENTATION GATE — Supabase keys.** Supabase states it is deprecating the `anon` and `service_role` keys by the
  end of 2026 in favour of publishable and secret keys. The server already reads a publishable key
  (`MOBILE_SUPABASE_PUBLISHABLE_KEY`); any future admin path must be designed for the new secret keys.
- **OWNER ACTION — region.** No region is set in `vercel.json`, so functions run in Vercel's default region. The region
  must be set to the one nearest the Supabase project when that project is created.

### 3.5 Exit criteria: when to re-evaluate Vercel

Re-evaluate after staging has real measurements, not before. A consolidation onto Supabase Edge Functions is opened as
its own decision record only if at least one criterion below fails and the spike shows the port fixes it.

| Criterion | What is measured in staging | A result that reopens the question |
| --- | --- | --- |
| Operational complexity | Count of incidents and hours caused by having two dashboards, two secret stores, two deploy paths. | Repeated incidents whose cause is the split itself. |
| Latency | p50 and p95 for both routes from an iPhone on a mobile network in the main launch market, broken into phone → API, API → Supabase, API → provider. | The API → Supabase legs are a material share of a slow p95. |
| Cold starts | First-request latency after 15 minutes, 1 hour and 24 hours idle, on the plan actually used. | A cold start that makes the Assistant feel broken and that the other platform demonstrably avoids. |
| Observability | Whether a failed request can be traced end to end within the log retention available, without logging content. | A production incident that could not be diagnosed. |
| Deployment reliability | Failed or surprising deployments; time to roll back. | Rollbacks that are slow or unsafe. |
| Quotas and rate limits | Platform limits hit under expected load. | A limit that cannot be raised at a reasonable cost. |
| Cost | The monthly platform bill against the AI bill and against the single-vendor alternative. | The second vendor's fixed cost is not justified by anything above. |
| Developer experience | Time to add a route, run it locally and test it in CI. | The Deno toolchain proves simpler for the same tests. |

---

## 4. Supabase

### 4.1 What it is for, and what it is not for

| | Use |
| --- | --- |
| **Near term (25A), DECIDED** (roadmap «Producto 25A»; [mobile-integrations.md](mobile-integrations.md)) | Mobile identity and session for the cloud features only. PostgreSQL where server state is required. Row Level Security. The Assistant's quota and, when built, its cost accounting and admin state. The durable capture inbox for a future remote capture. |
| **Later (25E), only if the owner still chooses it** | Optional cloud backup or multi-device sync, with everything in §1.4. |
| **Later (25F)** | The entitlement mirror for subscriptions ([app-store-launch.md](app-store-launch.md) §5). |
| **Not for** | The source of truth of the ledger. Financial calculations. A place where a model can run SQL. A requirement for using the app. Offline sync "for free". |

### 4.2 What exists today

**EXISTS TODAY:** `server/mobile/schema.sql`, headed "STAGING ONLY. Apply explicitly after review; never runs from app
startup/build." It defines two tables and two functions:

- `mobile_capture_inbox`: one row per capture, unique per user and request id, status fixed to `needs_review`; RLS on;
  a user can only select their own rows; inserts happen only through `mobile_receive_capture`.
- `mobile_api_usage`: per user, UTC day and kind; RLS on with no policy and no grant, so only the function touches it.
- `mobile_reserve_usage(kind)`: reserves one request, serialised by an advisory lock. Limits are request counts per
  UTC day: Assistant 30 per user and 300 for the whole app; captures 120 per user and 2 000 for the whole app.
- Both functions are `security definer` with an empty `search_path` and are executable by `authenticated` only. The
  server calls them **with the user's own token**. No service-role or secret key exists anywhere in the system.

The CI job `mobile_api` applies the schema to a disposable PostgreSQL 17 and runs `server/mobile/schema.test.sql`
(deduplication, conflict, direct insert refused, cross-user isolation, anonymous refused, per-user and global limits).
That proves the SQL, not any real Supabase project. **No agent and no CI job has applied this schema to a remote
project**, and the repository holds no migration history or Supabase configuration.

Known weakness to fix in the server lane (**IMPLEMENTATION GATE**): `mobile_reserve_usage` is granted to every
authenticated user, so a signed-in client can call it directly through PostgREST and burn its own and the global
request quota without ever reaching the API. It cannot raise a limit or spend money, but it can deny service.

### 4.3 Projects and environments

**DECIDED** (owner's 25OPS1 brief; §2.3): staging and production are two separate Supabase projects. Supabase's own
guidance for a staging environment is a new project; Branching exists, is a paid feature billed per branch-hour and is
not covered by the spend cap, so it is not the staging mechanism here. **REMOTE SETUP, OWNER ACTION:** creating either
project, choosing its region and its plan.

### 4.4 Schema deployment procedure

**DECIDED** (AGENTS rule 3): a database migration is never run remotely without an explicit release decision, and
never by an agent on its own initiative. The procedure when a project exists:

1. The change is a reviewed SQL file in the repository. `schema.sql` is today an initial, non-repeatable script; moving
   to ordered migration files (the Supabase CLI's `supabase/migrations/` layout) is the first change of the server lane
   that needs a second schema version.
2. CI applies it to disposable PostgreSQL and runs the SQL tests, including the negative cases, before anyone applies
   it anywhere.
3. The owner, or a person the owner authorizes, applies it to **staging** deliberately. It never runs from app start,
   from a build or from a deployment hook.
4. Staging is verified (§4.5) with the server build that will ship.
5. The same file is applied to **production** as a recorded release step, after a backup exists. Production migrations
   are additive and compatible with the currently deployed server (§2.5).
6. The roadmap records what was applied, where and by whom.

### 4.5 RLS validation

**IMPLEMENTATION GATE** before any real account exists, repeated after every policy change, in staging:

- at least two real test users; each proves it can read and write its own rows and **cannot** read, write, count or
  infer the other's;
- an unauthenticated caller and an anonymous-session caller are refused (the server already rejects `is_anonymous`);
- every table in an exposed schema has RLS enabled and each policy names its role;
- every `security definer` function is reviewed for what a hostile authenticated caller can do by calling it directly;
- the negative cases live in the SQL tests so CI keeps them.

### 4.6 Secrets, retention, deletion, logging

- **Service-role isolation.** **EXISTS TODAY:** no RLS-bypassing key is used. **DECIDED** (decision 001): no secret or
  service-role key is ever in the app. The first operation that needs one is account deletion (Supabase's admin
  `deleteUser`). When it is built, that key lives only in the server environment of one narrowly scoped function, is
  never an `EXPO_PUBLIC_*` value, and is never used for an ordinary request path.
- **Data retention (OWNER DECISION, IMPLEMENTATION GATE).** Capture payloads and usage counters need a written
  retention period and a purge job. Today nothing purges them. The period must appear in the privacy policy.
- **User deletion and export (LAUNCH BLOCKER once accounts exist).** App Review guideline 5.1.1(v) requires that an app
  which lets people create an account also lets them delete it in the app. Deleting the account removes the identity
  and, by `on delete cascade`, the inbox and usage rows. Supabase notes that a deleted user's token stays valid until
  it expires; the server's per-request session check covers that. Export of server-side data is an endpoint the app
  defines; none exists.
- **Logging privacy (DECIDED: roadmap «Producto 25F», "consumption telemetry (usage and cost, not content)"; owner's
  25OPS1 brief, logging privacy).** No prompt text, amount, merchant, token or provider body is logged
  (`server/mobile/handlers.js` already echoes none). Both Supabase and Vercel retain IP address, user agent, path and
  query string for their log window, and Supabase's auth logs carry the user id and e-mail. Therefore no identifier
  and no money ever goes in a URL or a query string.
- **Session storage in the app (IMPLEMENTATION GATE).** A session token is the app's first secret. It goes in the
  Keychain (§11.5). Supabase's documented pattern for Expo stores an encryption key in SecureStore because a session
  exceeds SecureStore's size limit; the exact wiring is decided in the session slice.

### 4.7 Environment variables, by name only

Values are never written in the repository, in a document or in a chat.

| Name | Where it is read | Status |
| --- | --- | --- |
| `MOBILE_INTEGRATIONS_ENABLED` | `server/mobile/runtime.js` | **EXISTS TODAY.** Master switch for both routes. |
| `MOBILE_SUPABASE_URL` | `server/mobile/runtime.js` | **EXISTS TODAY.** Must be a bare https origin. |
| `MOBILE_SUPABASE_PUBLISHABLE_KEY` | `server/mobile/runtime.js` | **EXISTS TODAY.** A publishable key, safe to expose but kept server-side. |
| `MOBILE_AI_ENABLED` | `server/mobile/runtime.js` | **EXISTS TODAY.** Assistant route only. The first kill switch. |
| `MOBILE_OPENAI_API_KEY` | `server/mobile/runtime.js` | **EXISTS TODAY.** A secret. The name is provider-specific; the provider port (§5.5) replaces it with a neutral name. |
| `EXPO_PUBLIC_MOBILE_API_ORIGIN` | `apps/mobile/src/assistant/client.ts` | **EXISTS TODAY** as a name, read through a passed `env` object, not a literal `process.env.EXPO_PUBLIC_MOBILE_API_ORIGIN`; Expo inlines only literal reads into a release bundle, so rule 1 of §2.3 needs the literal read (**IMPLEMENTATION GATE**, roadmap 25A server lane, "literal env reads"), verified in an exported release bundle. Public by construction; unset means disconnected. |
| `APP_VARIANT`, `EXPO_PUBLIC_EAS_PROJECT_ID` | `apps/mobile/app.config.ts`, `eas.json` | **EXISTS TODAY.** Build identity; not secrets. |
| Model id, reasoning effort, service tier, per-request token caps | to be added | **NOT IMPLEMENTED.** Today the model id is a default parameter in code. Names are fixed in the slice that adds them. |
| Monetary ceilings (per user, global daily, global monthly) and alert thresholds | to be added | **NOT IMPLEMENTED** (§6). |
| A Supabase secret key for account deletion | to be added | **NOT IMPLEMENTED.** Server only; see above. |

---

## 5. The Assistant: a constrained financial interface

### 5.1 The binding rule

**DECIDED** (owner's 25OPS1 brief; AGENTS rule 12; roadmap «Decisions that still bind»):

> The FinanzApp Assistant is a constrained financial interface, not a general agent.

It must never be given a generic capability. The list is closed:

- no shell or terminal;
- no filesystem access;
- no arbitrary code execution;
- no GitHub or repository access;
- no computer control;
- no arbitrary HTTP request and no browser;
- no server administration;
- no SQL console;
- no installation of arbitrary plugins or tools.

A person who writes "ignore your instructions and modify the repository" must be harmless, and the reason must be that
the model has no capability that could do it, not that a prompt told it to refuse. Security comes from capability
boundaries and strict contracts. The system prompt holds no secret and no authorization logic, and is assumed to leak.
This matches the OWASP guidance for LLM applications read on 2026-10-02 (prompt injection, excessive agency, system
prompt leakage): authorization is enforced in downstream systems, never delegated to the model.

**EXISTS TODAY:** the model has **no tools at all**. `server/mobile/openai.js` sends one request with no `tools` key
and receives one JSON object constrained by a strict schema with four fields (`kind`, `message`, `draft`, `factIds`).
The request body is passed as untrusted data, and the instructions say so. That is a stronger position than any
allowlist of tools, and the default is to keep it: add a tool only when a capability below cannot be met by sending
facts in the request.

### 5.2 Capability allowlist

Three classes, and nothing else. In every row the numbers come from the deterministic domain on the device
(`packages/domain`, `apps/mobile/src/fx`), never from model prose.

| Class | Capability | Who computes it | What the model may see | Result |
| --- | --- | --- | --- | --- |
| READ | Query spending | The device, from the ledger | Aggregated facts with ids (totals, counts, periods, category names) | An answer that cites fact ids |
| READ | Query income | The device | Aggregated facts with ids | Same |
| READ | Query budgets | The device (`budgetState`) | Budget facts with ids (**NOT IMPLEMENTED**) | Same |
| READ | Query card state | The device (card invariants, statement calendar) | Card facts with ids (**NOT IMPLEMENTED**) | Same |
| READ | Query upcoming commitments | The device (recurring rules, instalments) | Commitment facts with ids (**NOT IMPLEMENTED**) | Same |
| READ | Explain FinanzApp's financial data | The device supplies the figures | The same facts | Prose that may only restate cited facts |
| PROPOSE | A proposed expense | The model extracts fields from the person's words | The person's text | A draft; never a write |
| PROPOSE | A proposed income | Same | Same | A draft; never a write |
| PROPOSE | Later, explicitly supported operations (a card purchase in cuotas, a transfer, a card payment, a devolución, an edit) | Same, each added by its own slice with its own validators | Same | A draft; never a write |
| CONTROL | Clarification | The model asks; the app also asks on its own when a field is missing | — | A question |
| CONTROL | Out of scope | The model or the server | — | A fixed refusal; no draft |

Rules that follow:

- **No model tool writes the ledger.** There is no write capability to call. The model cannot read the ledger either:
  it sees only what the device chose to send in that one request.
- If READ capabilities are ever offered as tools instead of pre-computed facts, each tool is a named, typed, read-only
  query executed by the device's domain code against the local ledger, returning the same fact shape. It is never a
  query language, never a free-form filter and never executed on a server against someone's data.
- Financial calculations and invariants stay in the deterministic domain. A total, a balance, a rate conversion, an
  instalment schedule or a budget state is never taken from the model's text. An answer's rows and links are built
  from the cited fact ids over local evidence (`answerContent` in `apps/mobile/src/assistant/conversation.ts`), never
  parsed out of prose.

### 5.3 The one write path

**DECIDED** (AGENTS rule 12; roadmap «Producto 25A»): any proposed financial write ends as the same typed
`ReviewDraft` and takes one path.

```
untrusted model output
  → strict parser            parseReviewDraft: exact keys and types, nothing defaulted, trimmed or converted
  → domain validation        reviewGaps, reviewDestinations, isStaleReviewDraft: gaps are explicit, never guessed
  → durable review item      captureReviewItem: a pending item with a write id fixed at capture
  → explicit confirmation    the person's Confirmar on the review card
  → local ledger write       confirmReviewItem → writeForReviewDraft → createEntry or savePurchasePlan,
                             the write frozen before the ledger is asked, checked again inside the transaction
```

**EXISTS TODAY:** the domain model (`packages/domain/review-drafts.ts`, 25A-01) and the durable store
(`apps/mobile/src/storage/review-database.ts`, 25A-02) with their tests: one deterministic write per draft, a stale
draft never writes, an interrupted confirmation is reconciled from the ledger and never writes twice.

**Honest state (25A-04, on its branch).** The Assistant screen is **on that path**: its older in-memory confirmation
(`resolveDraft` → `entryFromDraft` → `validateEntry` → `addEntry`) is removed; a resolved draft is adapted to
`ReviewDraft` (`reviewDraftFromAssistant`) and durably captured into the review store with its ids fixed once, then
confirmed in the review sheet presented over the Assistant (or later in «Para revisar»), through the store's frozen
write. The reconciled differences: an unstated date is today by the capture rule (the device's local day at capture);
an unstated currency comes only from a destination the person named or chose, otherwise it is a gap; a merchant or
category the draft cannot hold is missing; a card gets «Una vez» and an income never a card. Still open: the wire contract knows only ARS and USD (contract v2), and the
Assistant stays disconnected in every build until its own slices; the deferred 24T3 device pass is a release blocker,
not a merge gate (owner decision, 2026-10-04: roadmap §2).

### 5.4 Minimal context: what leaves the device

**EXISTS TODAY, by design** (`apps/mobile/src/integrations/evidence.ts`, `packages/integrations/contracts.js`). Today
nothing is sent, because the client is disconnected. When connected, a request carries only:

| Action | Sent | Not sent |
| --- | --- | --- |
| `parse` (record something) | The person's text (up to 2 000 characters), today's local date, the screen's currency. **No facts.** | Any ledger data. |
| `explain` (an analytical question) | The text, the date, the currency, and at most 60 aggregated facts: month-to-date and the comparable previous period, as totals and counts of expenses, income and refunds, and, for each of the two periods, up to 26 category totals labelled with the person's category names. | Merchants, account names, balances, individual movements, cards, debts, budgets, any identifier. |

Using AI does not upload the ledger. A custom category name is the most personal thing an `explain` request carries.
The consent screen must say exactly this. New fact kinds (budgets, cards, commitments) are added one at a time, each
with a reason, each visible in the consent text; "send everything and let the model sort it out" is not an option.

**Evidence and fact ids.** Every fact has an id. The server refuses an answer that cites an id not in the request
(`validateAssistantResult`), requires at least one citation on an `explain` answer, and returns the cited facts. This
proves provenance, not that every sentence is correct; the evaluation in §5.8 measures that.

### 5.5 Provider abstraction and structured output

- **EXISTS TODAY:** one adapter, `server/mobile/openai.js`: OpenAI Responses API by plain `fetch`, strict JSON schema,
  `store: false`, 1 800 output tokens, reasoning effort low, a 25 s timeout, no retry, no tools. The model id
  `gpt-5-mini` is a default parameter in code that the runtime never overrides.
- **That model must not be treated as chosen.** OpenAI's deprecations page lists its only snapshot,
  `gpt-5-mini-2025-08-07`, for removal from the API on **2026-12-11**. What the bare alias does after that date is
  *unverified*. The adapter's behaviour will change on that date without a code change.
- **IMPLEMENTATION GATE (25A server lane):** a provider port with deterministic fakes, so every handler test runs
  without a network; the model id, reasoning effort and service tier as server configuration checked against an
  allowlist; the provider-specific key name replaced by a neutral one. The contract and the ledger do not change when
  the provider does.
- **Structured outputs.** A closed schema with every field required and nullable where unknown is the only output
  channel. Schema validity is not a security boundary and not a correctness guarantee: the server validates the result
  independently (integer minor units in range, currency in the supported set, dates in range, cited ids from the
  request), and the device validates again. A truncated or refused response is "no draft", never parsed as a partial
  one. Unknown stays unknown, never zero.
- **Schema portability.** Vendors support different subsets of JSON Schema (for example, one documents no numeric or
  length bounds). The portable schema uses only the common subset; bounds are enforced by the server's validators.

### 5.6 Streaming, cancellation, timeouts, retries, offline, outage

| Concern | State and rule |
| --- | --- |
| Streaming | **NOT IMPLEMENTED.** The client is already event-shaped (`delta`, `result`, `error`). Streaming is for prose only; a draft is acted on only when complete and validated. Whether iOS delivers chunks incrementally is **DEVICE QA**. |
| Cancellation | The person can cancel a request; the app aborts it and keeps the typed text. A cancelled request may still have consumed quota and money. |
| Timeouts | **EXISTS TODAY:** provider 25 s, Supabase calls 10 s each, app client 35 s. **IMPLEMENTATION GATE:** one explicit timeout budget for the whole handler, and an explicit function duration, so the chain cannot exceed what the client waits for. |
| Retries | **EXISTS TODAY, DECIDED:** none automatic, on the server or the client. A retry is always the person's action. A provider spend-limit error is never retried. |
| Offline | The Assistant says it needs a connection and returns the typed text to the composer. Manual entry is unaffected. |
| Provider outage or quota | A fixed, honest state ("not available right now"); the text is kept. No silent fallback to another model: a different model is a different evaluated configuration (§5.8). No local model stands in silently. |

### 5.7 Consent, retention, prompt injection

- **Consent (LAUNCH BLOCKER, NOT IMPLEMENTED).** Cloud AI is opt-in (AGENTS rule 12). App Review guideline 5.1.2(i)
  requires clear disclosure and explicit permission before personal data is shared with a third-party AI. The consent
  screen names the provider, what is sent (§5.4), what is not, and how to turn it off; it is shown when the person
  enables the Assistant's cloud features, not at first launch (§12). Today "consent" exists only in code comments.
- **Retention.** `store: false` stops the provider from storing the response for later retrieval. It is **not** zero
  retention: OpenAI documents abuse-monitoring logs kept for up to 30 days, and zero data retention only by prior
  approval. Other providers have their own terms; a free tier that uses submitted content to improve products (as
  Google documents for the unpaid Gemini tier) must never receive real user text. The privacy policy states the chosen
  provider's actual terms, re-read on the day it is written. Never write "nothing is retained".
- **Prompt-injection boundary.** Three surfaces carry untrusted text: what the person types, text they paste
  (a receipt, a bank message), and later, only if a remote-inbox capture is ever sent for parsing with consent, its
  payload (a Wallet capture, §7, is never sent to a model). All of it travels as data in the user message, JSON-encoded,
  never concatenated into instructions. Because of §5.1 to §5.3 the worst a successful injection can do is produce a
  wrong or misleading **draft or answer**, which the person sees before anything is written. It cannot write, read
  other data, call a network or spend beyond the request's own cap.
- **Adversarial inputs** are part of the evaluation set, with a mechanical pass criterion: no output field leaves its
  allowed set and no write occurs without confirmation, whatever the model says.

### 5.8 Model selection: a repeatable evaluation, not a choice

**DECIDED** (owner's 25OPS1 brief; roadmap «Producto 25A», Gates): no model is blessed because existing code names
it. A model is chosen by running a recorded evaluation, and re-chosen the same way whenever the model, the prompt or
the schema changes. **No paid evaluation was run for this document**; the first one is the single paid slice of 25A
and needs the owner's configured account and approval.

**The evaluation set** is made of real phrases written by the owner and anonymised, plus deliberately ambiguous and
adversarial ones (roadmap «Producto 25A», Gates); its ledger facts and fixtures are synthetic (AGENTS rule 6: no real
ledger). Each case has the
expected draft, the expected clarification, or the expected refusal:

| Group | Examples of what it covers |
| --- | --- |
| Spanish from Argentina | Voseo, "lucas", "k", "mangos", comma decimals, "ayer", "el finde". |
| English | The same intents in English; mixed-language sentences; names and custom categories kept verbatim. |
| Malformed amounts | "1.234,56" and "1,234.56", "mil quinientos", a missing amount, two candidate amounts. |
| Ambiguous currencies | "30" with no currency, "dólares" with no dollar account, a symbol shared by several currencies. Expected: the conversational Assistant asks for the currency (or the destination) before the review sheet, never a guess; an unambiguous regional word resolved through the configured region and a named destination's own currency are deterministic rules, not guesses (owner, 2026-10-04); a non-conversational producer leaves a gap. |
| Negations | "no gasté nada", "al final no lo compré". Expected: no draft. |
| Multiple expenses | Two purchases in one message. |
| Card versus cash | "con la Visa", "en efectivo", an unnamed means of payment. |
| Instalments | "en 6 cuotas", "en cuotas" with no count. Expected: the count is the person's, never inferred. |
| Refunds | A devolución versus a bank reintegro. |
| Recurrent payments | "todos los meses pago…". Expected: no recurring rule created by a draft. |
| Jailbreaks | Requests to ignore instructions, to run programming or server commands, to reveal the prompt, to act as a general chatbot; injected instructions inside pasted text. |
| Grounded questions | Analytical questions answerable from the supplied facts, questions the facts cannot answer, questions inviting a causal claim. Expected: cited facts only, or a clarification. |

**Selection criteria**, each measured and recorded per candidate: schema and tool reliability (valid output rate;
truncation and refusal rate under the real token cap), latency (p50 and p95 from the deployed region against the
timeout, including a first request), cost (measured `usage` per request and per completed draft, reasoning tokens
included), multilingual behaviour, financial extraction quality (exact match on amount in minor units, currency, date,
category and instalment count), hallucination rate (a value invented where "unknown" was correct; a claim not backed by
a cited fact), availability and lifecycle (published retirement dates), and the provider's privacy and retention
controls. The wrong-write rate must be zero by construction: every write is confirmed.

**Candidates read on 2026-10-02.** This table is an input to that evaluation, **not a recommendation and not a
choice**. Prices are USD per million tokens, input / output, standard tier, from each vendor's pricing page on that
date; several pages were read through a summarising fetch, so re-read the page before using a number. No latency was
measured and no vendor publishes Spanish-quality figures.

| Candidate | Price in / out | Lifecycle note | Source |
| --- | --- | --- | --- |
| OpenAI `gpt-5-mini` (in code today; baseline only) | 0.25 / 2.00 | Only snapshot removed 2026-12-11 | developers.openai.com pricing and deprecations |
| OpenAI `gpt-6-luna` | 0.10 / 0.50 | None announced | same |
| OpenAI `gpt-5.6-luna` | 0.20 / 1.20 | None announced | same |
| OpenAI `gpt-5.6-terra` | 2.00 / 12.00 | The vendor's named replacement for `gpt-5-mini` | same |
| Anthropic `claude-haiku-4-5` | 1 / 5 | Published retirement floor "not sooner than October 15, 2026"; no notice or successor published | platform.claude.com pricing and model pages |
| Anthropic `claude-sonnet-5-5` | 2 / 10 | "Not sooner than September 28, 2027" | same |
| Google `gemini-2.5-flash-lite` | 0.10 / 0.40 | None announced | ai.google.dev pricing and deprecations |
| Google `gemini-3.5-flash-lite` | 0.30 / 2.50 | None announced | same |
| Google `gemini-3.8-flash` | 0.75 / 3.75 until 2026-12-31, then 1.50 / 7.50 | Price doubles 2027-01-01 | same |

Per-token prices are not comparable across vendors (tokenizers differ, reasoning tokens bill as output); only measured
cost per request is. Small models are retired quickly at every vendor, so the model id is configuration, the
deprecation pages are re-read at every release, and a retirement notice triggers a new evaluation.

---

## 6. AI cost and monetary safety

### 6.1 What exists and what is missing

**EXISTS TODAY:** request-count reservations (`mobile_reserve_usage`): 30 Assistant requests per user per UTC day and
300 for the whole app, reserved before the model call and not refunded on failure; a 24 000-byte request body; a
2 000-character text limit; at most 60 facts; 1 800 output tokens; no automatic retry; two enable flags
(`MOBILE_INTEGRATIONS_ENABLED`, `MOBILE_AI_ENABLED`) that turn the route off.

**That is not sufficient by itself** (owner's 25OPS1 brief). A request count is not money: it does not know the model's
price, the tokens actually used or the reasoning tokens billed. **NOT IMPLEMENTED:** token and cost accounting, any
monetary ceiling, alerts, a kill switch other than the two flags, provider-side budgets, and any record of what a
request cost.

### 6.2 The production safety stack

Every layer is server-side. **No client-side limit is a security boundary**: the app shows no permanent counter (a
warning appears only near a real limit, owner decision 2026-10-04), and a modified client must not be able to spend
more.

| Layer | Rule | Status |
| --- | --- | --- |
| Per-request maximum input | Body, text and fact limits as today; an explicit input-token estimate before the call. | Size limits **EXIST TODAY**; token estimate **NOT IMPLEMENTED** |
| Per-request maximum output | An explicit output cap per model and effort. On OpenAI the cap includes reasoning tokens, so a low cap with a reasoning model can end the response before any JSON appears; the cap and the effort are tested together (§5.8). | Cap **EXISTS TODAY**; the pairing is an **IMPLEMENTATION GATE** |
| Per-user request quota | Daily, reserved before the call. | **EXISTS TODAY** |
| Per-user monetary ceiling | A budget per user per day and month in server configuration. Each request **reserves its maximum possible cost atomically** against it before the provider is called, and the reservation is settled to the actual cost afterwards (§6.3). | **NOT IMPLEMENTED** |
| Global daily and monthly monetary ceiling | The same reservation against the app-wide budget, in the same transaction. When capacity for the request's maximum cost cannot be reserved, the route answers "not available" until the period ends or the owner raises the ceiling; it never admits a request that could cross it. | **NOT IMPLEMENTED** |
| Provider-project hard budget and alert | A dedicated project or workspace and key for the Assistant only, with the provider's hard limit set **below** the owner's tolerated monthly amount and alerts at lower thresholds. | **OWNER ACTION, REMOTE SETUP** |
| Server-side usage accounting | Per request: model, tier actually served, input, output and reasoning tokens, estimated cost, outcome. No content. | **NOT IMPLEMENTED** |
| No unlimited automatic retries | None at all today; that stays. | **EXISTS TODAY** |
| Circuit breaker and kill switch | An automatic stop on anomalies (error rate, cost per request far above the estimate, a burst from one account), and a manual switch the owner can flip without a deployment. | Flags **EXIST TODAY** but need a redeploy to change on Vercel; the rest **NOT IMPLEMENTED** |
| Staging budget | Dramatically below production: the smallest hard cap the provider allows, a handful of test users. | **OWNER ACTION** |
| Alerts | To the owner, at fractions of each ceiling, and on any spend-limit error from the provider. | **NOT IMPLEMENTED** |
| Raising a cap | Only with the owner's recorded approval. No code path, script or agent raises a monetary cap. | **DECIDED** (AGENTS rules 3, 12) |

### 6.3 Atomic reservation of a request's maximum cost

**DECIDED** (owner, 2026-10-02, PR #81 review): a monetary ceiling is not a check of accumulated spend before the call.
Checking "has the ceiling been reached" admits a request whose maximum charge crosses it when the remaining capacity is
smaller than that maximum, and concurrent requests all pass the same check. The ceiling is enforced the way the request
quota already is (`mobile_reserve_usage`: reserved before the call, serialised by a lock), but in money and for the
request's worst case. **NOT IMPLEMENTED**; an **IMPLEMENTATION GATE** of the 25A server lane, tripped deliberately in
staging before AI is enabled anywhere.

1. **Estimate the maximum cost before the provider is invoked.** On the server, from the validated request: the
   input-token estimate (or the hard input limit when no tokenizer is available), plus the model's output cap including
   reasoning tokens, priced with the server's own price table for the pinned model and tier. The estimate is an upper
   bound by construction; a request whose bound cannot be computed (an unknown model or tier) is refused.
2. **Reserve atomically.** One database transaction, serialised per budget (an advisory lock or a row lock on the
   per-user and the global budget rows), checks that `reserved + spent + maximum ≤ ceiling` for the user's day, the
   user's month, the global day and the global month, writes a reservation row (`id`, user, maximum, period keys,
   `created_at`, state `reserved`) and only then commits. Concurrent requests compete against that one authoritative
   state: the second one either fits in what is left or is refused. No in-memory counter in a stateless function ever
   stands in for it.
3. **Refuse when capacity cannot be reserved.** The route answers the "not available" state of §6.5; nothing is sent to
   the provider, no quota count is consumed for that request, and nothing queues it for later.
4. **Call, then settle.** After the provider answers, the reservation is settled in a second transaction from the
   reserved maximum to the actual cost computed from the provider's `usage` (input, output and reasoning tokens, the tier
   actually served) with the same price table; the difference returns to the period's capacity and the usage row of
   §6.2 is written in the same transaction. Settlement never raises a reservation above its maximum: if the actual usage
   exceeds the estimate, the request is logged as an estimation defect, the maximum stands as spent, and the estimator
   is corrected.
5. **When usage cannot be reconciled immediately** (no `usage` in the response, a streamed response cut off, a parse
   failure, a timeout after the request may have reached the provider), the reservation stays at its **maximum** and is
   marked `unsettled`. It is never released on failure: an unknown cost is counted as the worst case, which is the only
   direction that cannot double-spend. A later reconciliation job may settle it from the provider's cost report, and
   only downwards.
6. **Timeout and crash recovery.** A reservation left `reserved` past the handler's whole timeout budget plus a margin
   (the function may have died after the provider call) is treated as spent at its maximum, never silently dropped. A
   periodic sweep settles stale reservations against the provider's report where that is possible and marks the rest
   spent; the sweep is idempotent (a reservation moves `reserved → settled | spent` exactly once, guarded by its state).
7. **No release that could double-spend.** Capacity returns to the period only through a settlement that lowers a
   reservation to an actual cost known from the provider, or through the period rolling over. Nothing releases a
   reservation because a client disconnected, cancelled, retried or because an error was shown: the person's retry is a
   new reservation.
8. **The provider's project limit stays the backstop.** It is set below the owner's tolerated amount (§6.2) and catches
   a bug in this machinery; it is not the primary control, because it is neither atomic per request nor instantaneous
   (§6.4). The monthly reconciliation of settled costs against the provider's cost report catches drift in the price
   table and the estimator.

A reservation also fixes the per-request worst case: the app shows no permanent message counter and warns only near a
real limit (owner decision, 2026-10-04), and the server's reservation is the only thing that decides.

### 6.4 Why the server's own accounting is the primary control

Read on 2026-10-02: the three model vendors checked each offer a hard spend limit. OpenAI's guide says enforcement
"is not instantaneous" and spend can slightly exceed the limit; Google's project spend cap is described as experimental
with roughly ten minutes of latency; whether Anthropic's customer-set limit can overshoot is not stated (*unverified*).
Vercel's AI Gateway budget is documented as "a soft cap, not a hard limit". Of the usage and cost reports, Anthropic's
cost report is daily (its usage report has minute, hour and day buckets); OpenAI's costs endpoint is reported as
daily-only but its reference page was not opened (*unverified*); nothing was read for Google. The plan therefore treats
every provider report as a reconciliation tool, not a real-time cap.

So the order is: the server's own reservation (§6.3) stops the call first; the provider's hard limit is the backstop for
a bug in that machinery; the monthly reconciliation against the provider's cost report catches drift in the price table. The
worst case per request is always bounded by input size plus the output cap, and the worst case per day by the global
ceiling.

A request should also pin the provider's service tier explicitly and log the tier actually used, because a project
setting can otherwise move traffic to a premium tier without a code change.

### 6.5 After a ceiling is reached

**DECIDED** (owner's 25OPS1 brief; AGENTS rule 12): manual, offline FinanzApp keeps working completely. The Assistant
shows a plain state that says cloud assistance is unavailable for now, keeps what the person typed, and offers the
manual forms. Nothing queues requests to be sent later, nothing retries in the background, and no path exists that
opens unlimited consumption when a counter or the quota database fails: a failed quota check or a failed reservation
blocks the call.

---

## 7. Wallet and Apple Pay capture (25A2)

Roadmap: [mobile-roadmap.md](mobile-roadmap.md) «Producto 25A2 — Wallet Shortcut Capture». **NOT IMPLEMENTED.** No
Apple integration package, App Intent, widget or extension exists in the repository; `wallet` exists only as a
`ReviewDraft` source name.

### 7.1 Target flow

**DECIDED** (roadmap «Producto 25A2», «Target flow»; owner's 25OPS1 brief):

```
Apple Pay / Wallet transaction
  → the person's own Wallet Transaction Automation (iOS Shortcuts)
  → a FinanzApp Shortcut action (an App Intent in the app)
  → local capture adapter (a small native spool, drained by the app)
  → strict ReviewDraft (parseReviewDraft; source "wallet")
  → the separate local review SQLite (captureReviewItem)
  → Dynamic Island / Live Activity when available (§8): Confirmar / Editar / Descartar
  → if ignored or the presentation fails: the item stays in «Para revisar» (25A-03), the durable inbox
```

**Presentation over one item (25A-04, owner decision 2026-10-04).** The Dynamic Island / Live Activity, the Assistant's
review sheet (`/review-sheet/[id]`) and «Para revisar» are presentation layers over the same durable review item and the
same confirmation dispatcher (the review store's frozen write); none writes the ledger by itself, and ignoring one never
discards the item. «Para revisar» is the recovery surface, not a required step.

The path uses no network, no login, no paid AI and no remote inbox. It works offline like manual entry. FinanzApp
cannot create the automation for the person; it explains the steps, per iOS version, because Apple's own instructions
differ between iOS 17/18 and later versions.

### 7.2 What Apple gives, and what it does not

- **DECIDED** (AGENTS rule 12; roadmap 25D): ordinary PassKit APIs are **not** access to Apple Pay history. PassKit
  lets an app take a payment and manage its own passes; no API returning the person's card transactions is documented.
  FinanceKit covers Apple Card, Apple Cash and Savings in the United States and a list of UK banks, behind a managed
  entitlement; it is a later, optional research gate of 25D and never a dependency.
- **The near-term mechanism is the person's own Wallet Transaction Automation.** Apple's entire documentation of the
  trigger is: "When I tap: Select a card to trigger an automation whenever it's tapped." It is on Apple's list of
  automations that can run without asking. Automations are per device and arrive disabled on a second device.
- **Everything else is undocumented by Apple** and is a **RESEARCH GATE with DEVICE QA** on the owner's iPhone, with the
  owner's real cards:

| To verify on the device | Why it matters |
| --- | --- |
| The exact properties of the automation's input and their types | The adapter must read real fields, not assumed ones. |
| **Amount**: a number or a formatted string, in which locale | Parsed to integer minor units only when unambiguous. |
| **Merchant**: present, and its quality | Kept when present, normalised as in [merchant-identity.md](merchant-identity.md); otherwise editable. |
| **Wallet card or pass**: its name string, and whether it is stable | It is the mapping key (§7.3). |
| **Date and time**: supplied, or only the device's clock at capture | The capture time is recorded as informative; the movement's date is a field the person can correct. |
| **Currency**: supplied at all, as an ISO code or only a symbol, on a foreign purchase | A currency is never guessed from a symbol ([currency.md](currency.md)). If not reliably supplied it is a gap. |
| Any other data (a transaction identifier, a status) | An identifier would be the deduplication key (§7.5). |
| Declined payments, refunds, late and repeated deliveries | Forum reports (not Apple) say the trigger can fire for a declined payment and can time out since iOS 18. |
| Which cards and issuers appear in the picker | Not every bank or card supports it; none may be promised. |
| Apple Watch payments, online and in-app Apple Pay | Apple says "on iPhone or iPad" and "whenever it's tapped"; nothing says a Watch or online payment fires it. |

### 7.3 Mapping a Wallet card to a FinanzApp destination

**DECIDED** (roadmap «Producto 25A2», «Explicit mapping»; decision 003): one explicit, person-chosen, editable
mapping.

```
Wallet card / pass   ↔   one FinanzApp credit card, or one FinanzApp account
```

- A **debit** card maps to its normal account: the capture becomes an ordinary **account expense** draft. There is no
  debit-card ledger.
- A **credit** card maps to a FinanzApp credit card: the capture becomes a **card purchase** draft. The cash account
  moves only when a card payment is recorded, as a transfer.
- The mapping is never inferred from a currency or from a similar name. Without a mapping the draft's destination is a
  gap and the review card asks.
- A Wallet capture is presented and defaulted as **«Una vez»**. Instalments require the person's explicit choice and
  count; nothing about a Wallet transaction implies a plan.

### 7.4 Unknown stays unknown

Never guessed: **currency**, **the local account or card**, **the category**, **instalments**. A category may be
suggested locally from the person's own rules (25C2), shown as a suggestion and corrected before confirming; the
Wallet merchant is never sent to a model on this path. FinanzApp never says Wallet supplied a category.

### 7.5 Deduplication

**DECIDED** (owner's 25OPS1 brief): repeated Shortcut deliveries are deduplicated by a **stable producer or capture
key**, which the review store already supports (`captureKey`, unique; the same key with the same draft is idempotent,
the same key with other content is refused). There is **no fuzzy** "same merchant and amount means duplicate" logic:
two real coffees at the same place are two expenses.

**RESEARCH GATE:** Apple documents no transaction identifier in the automation's input. If the device shows one, it is
the key. If it shows none, a repeated delivery cannot be told from a second identical purchase, and both arrive as
separate drafts for the person to dismiss; the app does not merge them on its own.

### 7.6 Cases

| Case | Behaviour |
| --- | --- |
| Automation not installed | Nothing is captured. The app offers the setup explanation where the feature is enabled; manual entry is unaffected. |
| Automation denied, or left on "ask before running" | iOS asks or does nothing. The app cannot detect it and claims nothing. |
| Apple Watch purchase | Not assumed to trigger. Verified separately; until then the setup text says only iPhone taps are covered. |
| Repeated event | Same capture key: one review item. No key: two drafts, never an automatic merge. |
| Late event | Becomes a draft when it arrives, with its capture time; the person sets the date. |
| App terminated | The intent runs in the background and appends to the native spool; the draft appears when the app next drains the spool. Whether React Native's runtime starts on that launch is a research gate (§8.3). |
| Device offline | No effect. The path uses no network. |
| Mapping missing | A draft with a destination gap; Editar only. |
| Capture incomplete (no amount, unusable merchant) | An incomplete draft in the tray, never dropped, never filled in. |
| Unsupported Wallet card | It does not appear in the automation picker, or delivers no details. Nothing is promised. |
| Archived or deleted FinanzApp destination | The draft's basis is stale; it cannot be confirmed until the person chooses a live destination (`isStaleReviewDraft`). |

**DECIDED:** manual entry stays complete and first-class without Wallet. No setting, screen or copy treats Wallet
capture as required, and no claim is made that every Apple Pay transaction is captured.

---

## 8. Dynamic Island and Live Activity (25A2)

**NOT IMPLEMENTED.** A real product target, not a notification idea (roadmap «Producto 25A2», «Target flow»; owner's
25OPS1 brief).

### 8.1 Target

```
Wallet Transaction Automation
  → ReviewDraft (durable, in the review store, before anything is shown)
  → a short-lived Live Activity / Dynamic Island presentation
  → Editar      opens the app on that exact review item
  → Confirmar   the one confirmation path
```

It shows, when safely known: the merchant, the amount, the mapped card or account, and the date and time as
appropriate. **A Live Activity is not a notification** and is not classified, permissioned or designed as one (§9).

### 8.2 What the platform allows (read 2026-10-02)

- A Live Activity normally starts from a foreground app. From the background it can start only from an App Intent that
  conforms to `LiveActivityIntent` (iOS 17 and later), or by an APNs push-to-start, which needs a server and is off
  this offline path. Apple: the system "launches your app process without opening the app, performs the intent, and
  starts the Live Activity".
- Buttons exist only in the **expanded** Dynamic Island presentation and on the **Lock Screen** presentation, not in
  the compact or minimal ones. A button backed by a `LiveActivityIntent` runs **in the app's process**, not in the
  widget extension. A plain App Intent button runs in the extension, which has no React Native runtime and no access to
  the app's database.
- "On a locked device, buttons and toggles are inactive and the system doesn't perform actions unless a person
  authenticates and unlocks their device."
- The person can turn Live Activities off for the app in Settings, and can swipe one away at any time.
- Apple's design guidance: avoid sensitive information in a Live Activity (it shows on the Lock Screen, the Always-On
  display, and mirrors to a paired Watch, Mac and CarPlay); prefer a single interactive element; end the activity when
  the task ends; do not send a notification alongside a Live Activity for the same thing.

### 8.3 The proof-of-concept gate

**RESEARCH GATE, DEVICE QA, IMPLEMENTATION GATE — the critical gate of 25A2.** The requirement is **one confirmation
path**, not a second accounting engine in Swift.

The question to settle on a physical iPhone, with a throwaway development build: *can a Live Activity action reach the
same confirmation dispatcher and the durable review item and ledger flow while the app is not in the foreground?*

Concretely, with the app terminated, suspended and freshly unlocked, each repeated many times:

1. A `LiveActivityIntent` run as the action of a Shortcuts automation is allowed to start a Live Activity. Apple
   documents the capability generically; it does not say it holds for an automation run without asking.
2. Before the activity is requested, with the app terminated, the JavaScript runtime parses the spooled capture into a
   `ReviewDraft` in the review store (`parseReviewDraft`, `captureReviewItem`), so what the activity shows and whether
   it may offer Confirmar come from the domain, never from Swift. If that cannot run in time, no activity content or
   Confirmar is derived in Swift: the fallback is the review rescue notification (§9.5) or the tray.
3. The Confirmar button's intent launches the app process, React Native's JavaScript runtime starts, the app's own
   TypeScript confirmation (`confirmReviewItem`, the same function the review card of 25A-03 will call; no screen calls
   it today) runs and commits to SQLite, and it finishes well inside the roughly 30 seconds Apple gives a background
   intent. Nothing documents whether the runtime is ready in time.
4. The activity shows success only **after** the commit (AGENTS rule 9: save locally before confirming success).
5. Failure cases each leave exactly one movement or none, and the draft intact on failure: the process killed
   mid-confirm, a failed write, the item already confirmed or dismissed in the app, a double tap, a draft that became
   stale.

**Decision rule.**

- If complete, immediate confirmation from the Dynamic Island is proven safe, and the owner takes the decision the
  roadmap's 25A2 section reserves (whether Confirmar may write from outside the review card), Confirmar there uses **the same frozen
  write and idempotency machinery** as the review card will (the write id fixed at capture, the write frozen before the
  ledger is asked, reconciliation after an interruption).
- If it is not proven, or is flaky, Confirmar **authenticates and opens the exact review item**, and the one existing
  dispatcher completes it in the foreground. That is still one path.
- Either way, an **incomplete** capture (a gap, a missing mapping, a stale basis) never offers Confirmar there: it
  offers or forces **Editar / review** only.

**DECIDED:** no financial domain or accounting rule is duplicated in Swift. Swift may receive the raw capture, append
it to the spool, start and end the activity, and hand an action to the app. Parsing, gaps, destinations, card
invariants, instalments and the write itself stay in `packages/domain` and the app's storage.

### 8.4 Implementation boundary with Expo

| Piece | Likely boundary | Notes |
| --- | --- | --- |
| The Live Activity's interface | `expo-widgets` (official; stable since Expo SDK 56; iOS only) | Needs its config plugin, a prebuild and a new development build; adds a widget extension target with its own bundle identifier and an app group. Its code runs in an isolated runtime with props only. |
| Starting the activity from the background | **Custom Swift** | `expo-widgets` starts an activity from JavaScript only, which Apple allows only in the foreground. It has no background start except push-to-start. |
| The Shortcuts action ("capture a Wallet transaction") | **Custom Swift App Intent in the app target** (a local Expo module or a config plugin) | Expo documents no API for App Intents, and `expo-widgets` exposes nothing to the Shortcuts app. Whether an intent in a local module is discovered by Shortcuts is a build-level research gate. |
| The Confirmar button | `expo-widgets`' button, or a hand-written `LiveActivityIntent` | `expo-widgets` delivers the tap to JavaScript as an in-process event with no documented guarantee on a cold background launch. If the event can be lost, the button must be hand-written. |
| A fully hand-written activity | A community target plugin (`@bacons/apple-targets`) | Only if the official path cannot carry the flow. `expo-live-activity` is deprecated and is not an option. |

Consequences to plan for: iOS 17 is the practical floor for the whole flow (on older supported versions the feature is
absent, not broken); adding an extension identifier and an app group is a signing change that needs the owner's
decision before any EAS build (AGENTS rule 3); and Expo calls its app-extension support in EAS Build experimental.

### 8.5 Fallbacks

The review tray **always** keeps the draft, whatever happens to the presentation.

| Situation | Behaviour |
| --- | --- |
| Device has no Dynamic Island | The Lock Screen presentation, or a brief banner when unlocked only if the start or update carries an alert configuration (**DEVICE QA**). No persistent control while the phone is in use; the tray holds the draft. |
| Live Activities disabled in Settings | No activity. A review rescue notification (§9.5) if notifications are permitted; otherwise the tray and its badge. |
| App terminated | The intent spools the capture; presentation depends on gates 1 and 2 above. The capture is kept in the spool regardless; the draft exists once the app drains it. |
| Locked device | The activity appears on the Lock Screen with private content; buttons act only after the person authenticates. |
| Authentication required | Confirmar always passes the device's authentication, and the app's own lock (§11) if enabled. Never a write from a locked phone. |
| The person dismisses the activity | Nothing is written and nothing is discarded. The draft stays pending. |
| Missing capture data | Editar only (§8.3). |
| The Live Activity request fails | Logged without content; the fallback is the review rescue notification (§9.5) or the tray. Never both an activity and a notification for one capture. |
| Older supported iOS | The feature is absent; captures, if the automation exists there at all, go to the tray. |
| Apple Watch payment | Not assumed to trigger anything (§7.2). |

**OWNER DECISION** before 25A2 ships, informed by Apple's guidance in §8.2: whether the amount and the merchant appear
on the Lock Screen or only an innocuous summary until the phone is unlocked (default: private); whether the activity
has two buttons or one; the in-app switch that turns the activity off; and the unverified question of whether App
Review accepts a Live Activity used as a one-shot confirmation.

---

## 9. Notifications and push (25D)

Roadmap: «Producto 25D — Face ID, notifications and Apple integrations», including its notification-semantics matrix,
which this section does not restate and never contradicts. **NOT IMPLEMENTED:** no notification package is installed.

### 9.1 Live Activities are not notifications

They have a separate system setting, a separate presentation and a separate purpose. The Wallet capture's Dynamic
Island belongs to 25A2. The only link is the **review rescue notification** (§9.5), which follows only when a review
presentation was missed and the item is still pending, used *instead of* it, never *in addition*.

### 9.2 Local first

**DECIDED** (roadmap 25D; owner's 25OPS1 brief): facts already known on the device are announced by **local**
notifications, scheduled on the device, working with no server and no account.

| Family | Trigger known on the device | Default |
| --- | --- | --- |
| Upcoming recurring expense | The rule's next date minus the chosen lead time | Off |
| Recurring due today | The rule's date | Off |
| Card closing soon | The card's configured closing date | Off |
| Card due soon | The card's configured due date | Off |
| Card payment reminder | The due date with nothing recorded as paid | Off |
| Instalment or commitment reminder, where useful | The plan's schedule; a debt's due date | Off |
| End-of-day "did you record today's spending?" | A time the person chooses | Off |
| Review rescue (§9.5) | A review item still pending after its primary presentation was missed: the Assistant's review sheet (background or termination) or 25A2's Dynamic Island (missed, dismissed or ended). Never for «Ahora no», never while a review surface is active | Off until the person allows it, asked in context |
| Budget warning | A state change of the general budget | Only if the product later chooses it (roadmap 25D, «Budget state notification») |

Requirements, each a gate of 25D:

- **Opt-in**, per family, configurable.
- **Permission requested in context**: when the person turns a family on, with the reason shown first. Never at first
  launch (§12).
- **Time-zone aware.** *Unverified* on Apple's pages: how a calendar trigger behaves when the device changes time zone.
  **DEVICE QA:** schedule a due-date reminder, change the time zone, compare.
- **Rescheduled after edits.** Changing a rule, a card's dates or a plan cancels or replaces every pending
  notification tied to the old value in the same step.
- **Deduplicated.** One per object, kind and cycle.
- **Deep-links to the exact destination**: the rule, the card, the review item.
- **No notification after the state resolves.** A recorded payment cancels its reminder; a confirmed or dismissed draft
  cancels its alert.
- **A date reached is never a payment made.** A reminder speaks about what is planned; only a real record in the
  ledger is described as recorded (the roadmap's matrix).
- A rolling window is scheduled rather than every future date: the older iOS API documented a limit of 64 pending
  local notifications; the current API's pages do not restate it (*unverified*), so the design assumes it holds.

### 9.3 Privacy

**DECIDED** (roadmap 25D; decision 001): financial amounts and merchants are **hidden from the Lock Screen by
default** and shown only if the person opts in. What the platform allows: whether previews show is the person's iOS
setting, which the app can read but not force. The app controls what it puts in the title and body, so by default it
puts no amount and no merchant there, and it can set the placeholder shown when previews are hidden.

### 9.4 When remote push is justified

**DECIDED** (roadmap 25D, «Remote push (APNs)»): only for server-originated state that cannot be scheduled correctly
on the device. Examples that would qualify, none of which exists today: a capture that arrived in the remote inbox
from another device, a sync conflict (25E), a subscription or entitlement event the phone cannot learn otherwise
(25F). Push infrastructure is not built because it exists. Local reminders never depend on it. Adding it needs the
push capability, a device token, a provider server and a privacy review, and belongs to 25E or later.

### 9.5 Review rescue notification (owner decision, 2026-10-04)

**DECIDED, NOT IMPLEMENTED** (25D, with 25A2 for the Wallet case). «Para revisar» is the durable fallback inbox, not
the primary review surface, and a review notification is a **rescue**, not a notice for every proposal.

- **Assistant.** The review item is durably stored and the review sheet is the primary presentation (25A-04). Only if
  that immediate presentation was missed (the app went to the background or was terminated before or during it) and
  the item is still pending, one local notification may follow after a short delay.
- **Wallet / 25A2.** The review item is durably stored and the Dynamic Island / Live Activity is the primary
  presentation. Only if that presentation was missed, dismissed or ended, or otherwise left the item pending, one local
  rescue notification may follow.
- **Never a duplicate.** No notification while a review surface is normally active for that item (the sheet, the
  Dynamic Island); never an activity and a notification for one capture at the same time.
- **«Ahora no» is not a trigger.** Closing the review sheet on purpose leaves the item pending with the tray and the
  Más badge as its fallback; it schedules nothing now. Any later reminder policy for postponed items is decided in 25D.
- **Cancelled on resolution.** Confirming or dismissing the item cancels its notification.
- **Deep link.** A tap opens that exact review item in the review sheet (`/review-sheet/[id]`), never Más first. If
  the item is no longer pending (confirmed or dismissed meanwhile, or unreadable), the app says its current state
  calmly («ya no está pendiente», or the recorded movement) instead of an error.
- **Lock Screen privacy.** By default the copy carries no amount, merchant, account or other financial detail, for
  example «Tenés una revisión pendiente» / «Abrí FinanzApp para revisarla.»
- **Permission.** Requested in context (when the person first enables the review family or when the rescue first
  matters, with the reason shown first), never at first launch, and never required for the app to work.

---

## 10. Financial calendar (25C2)

Roadmap: «Producto 25C2», and «Later notes recorded in 24UX6A» (Calendar). **NOT IMPLEMENTED.** This section fixes what
"calendar" means so it stops being a vague word.

### 10.1 Where it lives

**DECIDED** (roadmap; decision 005): in Reportes or a Reportes-adjacent surface. **Not a fifth tab**, unless future
evidence changes the decision through a decision record.

### 10.2 What it may show

Recorded expenses and incomes; upcoming occurrences of recurring rules; instalments; card closing dates; card due
dates; debts and receivables where relevant; other commitments.

### 10.3 Four kinds, never blurred

| Kind | Meaning | Examples | Must never read as |
| --- | --- | --- | --- |
| **Recorded / realized** | A movement that exists in the ledger. | A purchase, an income, a recorded instalment, a recorded card payment. | — |
| **Scheduled** | An occurrence a rule will record on its date. | Next month's rent from a recurring rule. | Already spent. |
| **Due / closing** | A date configured on a card or a debt. No money moves by itself. | A card's closing date; its due date. | A payment made, or a statement amount the bank did not supply. |
| **Future commitment** | An obligation that already exists and falls later. | Instalments 4 to 12 of a plan. | Spent or paid. |

The distinction is visual and semantic, never by colour alone, and is spoken by VoiceOver. **A future instalment never
looks spent or paid.** Its principal is recognised instalment by instalment (AGENTS rule 8; decision 003).

### 10.4 Selection and day detail

- The month is the default view; selecting a day opens that day's detail below or over the grid, without leaving
  Reportes' context.
- The day detail lists its items grouped by the four kinds, recorded first. Each item opens its real destination: the
  movement, the rule, the card, the plan.
- A day's marker says which kinds it holds, not a single net figure that would mix recorded and future money.
- Empty days and months are intentional states, not zeroes.

### 10.5 Currencies

**DECIDED** ([currency.md](currency.md); roadmap 25C2): per currency, never summed across currencies. A day with pesos
and dollars shows two subtotals. The consolidated view of 24C1 applies only to recorded movements and only with a
dated rate; scheduled and future items are shown in their own currency and never converted at a rate that does not
exist yet. An unknown rate is unknown, not zero.

### 10.6 Gates

Domain tests (the four kinds; nothing future counted as spent; per-currency totals), schema and backup versions with
rollback tests if any record is added, and the calendar on the iPhone with VoiceOver and large text.

---

## 11. Privacy: hide amounts, Face ID and data protection (25D)

Roadmap: «Producto 25D», «Security and privacy», and «Later note recorded in 24UX6C» (Ocultar importes).
**NOT IMPLEMENTED.** None of the native packages involved is installed.

### 11.1 The global eye: hide financial values

**DECIDED** (roadmap, «Ocultar importes» note):

- One control hides every amount on every surface that shows one: Inicio, Cuentas, Movimientos, Tarjetas, Reportes,
  Deudas y cobros, Recurrentes, and later widgets, notifications and the Live Activity. No screen keeps its own copy of
  the rule; amounts are masked where they are presented.
- Revealing is deliberate. A temporary reveal returns to hidden on its own. A scroll, a tab switch or a notification
  never reveals.
- It never alters data: no stored amount, sign, computation, backup or export changes. An export is the person's
  explicit act and contains the real figures.
- **VoiceOver-safe.** A hidden amount is announced as hidden («Importe oculto»), never read aloud, never spoken as
  zero or as an empty label. Charts and summaries follow the same rule.
- One preference outside the ledger, saved before it applies, not in a backup.
- **OWNER DECISION:** its place in the order. It sits beside 25D's privacy work and does not enlarge that scope.

### 11.2 App lock with Face ID

- Opt-in. Face ID or Touch ID through the system's local authentication, with the **device-passcode fallback** as the
  recovery path. There is no separate FinanzApp password to forget.
- A failed or cancelled prompt never resets and never reveals data. Biometrics unavailable, not enrolled or locked out
  each have a defined state.
- **Lock timing (OWNER DECISION):** immediately on leaving the app, or after a short interval.
- **Foreground and background:** returning from the background after the interval asks again. System interruptions
  (a call, Control Center, the Face ID prompt itself) do not trigger a lock loop.
- The lock also gates a Confirmar that arrives from outside the app (§8.5).

> **A Face ID prompt does not encrypt SQLite.** It is a gate on the interface. The database file is exactly as
> readable as it was before, to anything that can read the app's container.

### 11.3 Data protection and encryption, evaluated separately

**DECIDED** (decision 001; roadmap 25D): the protection of the files is decided and verified on its own, before
production use of sensitive data. **RESEARCH GATE, DEVICE QA:**

- **What applies today.** Expo's source opens the database with no file-protection flag, so it should inherit iOS's
  default class ("complete until first user authentication"), which protects data after a reboot until the first
  unlock and only when the device has a passcode. This is inferred from source and Apple's default, not documented by
  Expo and not checked on a device. First step: read the actual protection class of the database, its WAL and SHM
  files, the backup's temporary file and any exported file on a real install.
- **Raising it.** The stricter class ("complete") makes files unreadable while the device is locked. That would break
  any write made while locked: exactly the Wallet capture intent of §7. The decision must be made together with 25A2,
  possibly with different classes for the ledger and the capture spool.
- **SQLCipher.** expo-sqlite documents a SQLCipher build option. Not documented: migrating an existing plaintext
  database, key rotation, performance. Open questions that make it a gate of its own: the migration must never reset
  or lose a ledger (AGENTS rule 9); where the key lives and what happens to it on reinstall, on restoring a backup to a
  new phone and on re-enrolling Face ID (a device-only or biometric-bound key can make a restored database
  unreadable); and the export-compliance answer, which changes if non-exempt encryption is shipped
  ([app-store-launch.md](app-store-launch.md) §12).
- **Key recovery.** If encryption is adopted, a lost key is lost data. The recovery story is designed before the
  feature, not after.

### 11.4 Other surfaces

| Surface | Rule |
| --- | --- |
| App-switcher snapshot | A neutral cover replaces the interface when the app leaves the foreground, so the system's snapshot holds no amounts. **DEVICE QA:** the cover is in place before the snapshot, including on a fast swipe. |
| Local notifications | No amount or merchant on the Lock Screen by default (§9.3). |
| Widgets | Amounts hidden by default; they follow the global eye. |
| Live Activity | Private by default on the Lock Screen (§8.5); mirrors to other devices, so the default must be safe there too. |
| Screenshots and recordings | The person's own act; not blocked by default. **OWNER DECISION** whether hidden mode should also prevent capture. The system snapshot is the case that must be covered. |
| Backups and exports | Plain JSON today. The export screen says so. An encrypted export is a separate decision. |

### 11.5 Keychain and SecureStore

For small secrets only (decision 001): a session token when one exists, a database key if SQLCipher is adopted.
Never the ledger, and never the only copy of anything irreplaceable; Expo's documentation says not to rely on it as a
single source of truth. The accessibility class is chosen per item: a token the Wallet intent needs while the phone is
locked cannot use the strictest class.

### 11.6 Native dependencies and device QA

Each capability adds a native module and needs a new development build, which is an owner-authorized EAS build
(AGENTS rule 3): local authentication (with its Face ID usage description), secure storage, screen-capture or
app-switcher protection, notifications, widgets. A JavaScript bundle or a typecheck is not evidence for any of them
(AGENTS rule 11). Per integration: the denied-permission path, the private-content default seen on a real Lock Screen
and app switcher, and behaviour across a restart.

---

## 12. Onboarding

### 12.1 What exists

**EXISTS TODAY, DECIDED** (AGENTS rule 15; roadmap «Producto 25B»; `apps/mobile/app/onboarding.tsx`): the first
opening is shown to a new installation only. An existing person is marked done silently and nothing of theirs
changes. It has exactly two stages:

1. **Welcome**, with the language and region rows that open the same choosers as Más.
2. **An optional first account**: name, the currency the region suggests, an optional opening balance.

Omitir is on both stages; it skips the rest and keeps every choice already saved. It requires no connection, account,
bank or subscription. Nothing else is in it: no sign-in, no permission prompt, no privacy or terms screen, no paywall.
The roadmap says the first opening is implemented and not reopened; this document does not redesign it.

### 12.2 Production onboarding: what is added, and where

The rule is that every later ask happens at the moment its value is clear, not on the first screen.

| Item | When it is asked | Status |
| --- | --- | --- |
| First opening, language, region, optional first account | First launch of a new installation | **EXISTS TODAY** |
| Using the app with no account | Always possible | **DECIDED** |
| The uninstall and backup explanation | Near the first account or the first backup prompt; not a gate | **OWNER DECISION** on placement ([app-store-launch.md](app-store-launch.md) §13) |
| Notification permission | When the person turns on a notification family, after the app explains what it will send (§9) | **NOT IMPLEMENTED** |
| AI consent | When the person enables the Assistant's cloud features, never before (§5.7) | **NOT IMPLEMENTED** |
| Sign-in | Only when a cloud feature needs an account: the Assistant's session (25A), sync (25E), an entitlement across devices (25F) | **NOT IMPLEMENTED** |
| Wallet automation setup | Optional, later: an education screen reached from the capture hub or Más once 25A2 exists | **NOT IMPLEMENTED** |
| Face ID lock, hide amounts | From Más, when the person wants them | **NOT IMPLEMENTED** |
| Paywall | Never before the person understands the core product ([app-store-launch.md](app-store-launch.md) §3) | **NOT IMPLEMENTED** |

**OWNER DECISION — the sign-in method.** The roadmap's 25A scope needs "mobile sign-in" for the staging session, while
25D defers Sign in with Apple to 25E "when an account exists". These are reconciled when the session slice is
specified: either Sign in with Apple arrives with 25A's session, or 25A uses another verified method first. Facts that
bear on it: the server refuses anonymous sessions today; App Review guideline 4.8 requires an equivalent privacy-
preserving login option only when a third-party or social login is offered; guideline 5.1.1(v) forbids forcing a login
for features that do not need one and requires in-app account deletion once accounts exist.

---

## 13. Roadmap mapping

Every production item belongs to an existing phase of [mobile-roadmap.md](mobile-roadmap.md). The binding order there
is unchanged: 25A → 25A2 → 25C → 25C2 → 25D → 25E → 25F → 26. Section references with "launch" point to
[app-store-launch.md](app-store-launch.md).

| Phase | Production items | Where |
| --- | --- | --- |
| **25A** — the real Assistant | Local review: the tray (25A-03) and the Assistant's drafts through it (25A-04). Server lane without paid calls: provider port and fakes, contract v2, one timeout budget, model id as configuration, money-based cost controls, kill switch and ceilings. Session and consent: staging Supabase project, sign-in, the cloud-consent screen, session storage in the Keychain. Evaluation: the synthetic set and harness, then the one paid slice on staging. Environments: the staging backend. | §2, §3, §4, §5, §6, §12 |
| **25A2** — Wallet Shortcut Capture | The Wallet Transaction Automation, the Shortcut App Intent and native spool, the card mapping, deduplication by capture key, the Dynamic Island / Live Activity proof of concept and, if it passes, its delivery; the fallbacks. | §7, §8 |
| **25C** — budgets, goals, CSV, productivity | Advanced search and filters, saved searches, notes, imports as reviewed drafts. Unchanged by this document. | roadmap «Producto 25C» |
| **25C2** — merchants, rules, commitments | The financial calendar; local categorisation rules (which also pre-fill Wallet drafts); suggested recurring detection; merchant marks. | §10 |
| **25D** — Face ID, notifications, Apple integrations | Hide amounts; Face ID lock; the data-protection and SQLCipher evaluation; the app-switcher cover; the local notification families and the review rescue notification (§9.5); widgets; broader App Intents, Siri and Spotlight; Apple Watch; the FinanceKit research gate. | §9, §11 |
| **25E** — optional sync and privacy | Only if still chosen: the account, the outbox and sync requirements, cloud backup, export and deletion of cloud data, remote push if a server event justifies it, Sign in with Apple if not already delivered. | §1.4, §4, §9.4 |
| **25F** — monetisation | Free and Pro, StoreKit and subscriptions, the paywall, the subscriber backend and admin view, App Store Server Notifications, premium AI quotas tied to an entitlement. Its sandbox gate needs the Paid Apps Agreement, tax and banking (launch §6) and the app record, so the identity decision of 26 must be taken before 25F's sandbox purchases, or the owner records a different 25F/26 order. | launch §1 to §6; §6 here |
| **26** — TestFlight and publication | The brand, naming and identity gate before any public asset (launch §9.4); the production identity and profile, TestFlight, App Review, privacy labels, support, privacy and legal pages, the store listing and its localization, analytics decisions, banking and tax readiness, the landing page as a launch asset (its privacy, terms and support pages are required to submit; the marketing page itself may follow), the launch itself. | launch §6 to §14 |
| **After launch** (roadmap §5) | Conversion tests, advertising, iterations of the landing page, Android. | launch §9, §14 |

Reconciliation notes:

- The roadmap places marketing, ASO experiments and the landing page after real users exist. The store listing itself
  (name, subtitle, keywords, screenshots, privacy and support URLs) is required to submit, so it is part of 26; tests
  and campaigns stay after launch. The owner's 25OPS1 brief places the landing page in 26; the roadmap's «After launch»
  section keeps its conversion tests and advertising. **OWNER DECISION** whether the marketing page ships with 1.0 or
  after it.
- The roadmap's 25F says receipts are "validated server-side". The current Apple mechanism is signed transactions and
  server notifications (launch §5); the intent is the same.
- 25OPS1 itself adds no phase. It documents the gates of the phases above and corrects one dock behaviour.

---

## 14. Readiness

Nothing below is complete unless it says **EXISTS TODAY**. "Launch §n" is a section of
[app-store-launch.md](app-store-launch.md).

| Item | Phase | Status | What closes it |
| --- | --- | --- | --- |
| Local ledger, offline core, backup and import | done | **EXISTS TODAY**; open **DEVICE QA** sections in the checklist | The pre-TestFlight device passes the roadmap lists |
| Review-draft model and durable review store | 25A-01, 25A-02 | **EXISTS TODAY** (no screen uses the store) | 25A-03 |
| Review tray; Assistant drafts on the one write path | 25A-03, 25A-04 | **NOT IMPLEMENTED**, **IMPLEMENTATION GATE**, **DEVICE QA** | The slices; their device QA and the deferred 24T3 pass join the pre-release device gate (owner decision, 2026-10-04) |
| Data ownership rules; no mandatory account | all | **DECIDED** | — |
| iOS backup inclusion of the ledger | 26 | **RESEARCH GATE**, **DEVICE QA** | A restore test on a second device |
| Environment separation rules | 25A | **DECIDED**; **REMOTE SETUP**, **OWNER ACTION** | Staging and production projects created by the owner |
| Production app variant and EAS profile | 26 | **NOT IMPLEMENTED**, **OWNER DECISION**, **LAUNCH BLOCKER** | The identity decision; launch §11 |
| Vercel as the mobile API host | 25A | **DECIDED** to keep for staging; **EXISTS TODAY** | Re-evaluated only by the exit criteria of §3.5 |
| Vercel plan and Node version; Supabase plan | 25A, 26 | **OWNER ACTION**, **LAUNCH BLOCKER** for monetisation | The owner checks and authorizes the plans |
| Staging access through deployment protection | 25A | **RESEARCH GATE**, **OWNER DECISION** | §2.4 |
| Supabase staging and production projects | 25A, 26 | **NOT IMPLEMENTED**, **REMOTE SETUP** | Created and migrated by the owner's decision |
| Migration files and the deployment procedure | 25A | **DECIDED** rule (AGENTS rule 3); procedure proposed; **IMPLEMENTATION GATE** | The server lane |
| RLS validation with two users | 25A | **IMPLEMENTATION GATE** | Run in staging, kept in SQL tests |
| Direct callability of `mobile_reserve_usage` | 25A | **IMPLEMENTATION GATE** | Fixed in the server lane |
| Sign-in, session storage, account deletion | 25A, 25E | **NOT IMPLEMENTED**, **OWNER DECISION** (method), **LAUNCH BLOCKER** once accounts exist | The session slice |
| Assistant capability boundary (no generic tools) | all | **DECIDED**; **EXISTS TODAY** (no tools) | Kept by review of every Assistant change |
| Cloud-AI consent screen | 25A | **NOT IMPLEMENTED**, **LAUNCH BLOCKER** | Built and shown before any send |
| Provider port, model as configuration | 25A | **NOT IMPLEMENTED**, **IMPLEMENTATION GATE** | The server lane |
| Model evaluation and choice | 25A | **RESEARCH GATE**, **OWNER ACTION** (paid) | The evaluation harness, then the one paid slice |
| Replacement of `gpt-5-mini` before 2026-12-11 | 25A | **IMPLEMENTATION GATE** | Model as configuration plus the evaluation |
| Monetary ceilings as atomic pre-call reservations, settlement, usage accounting, alerts, kill switch | 25A | **NOT IMPLEMENTED**, **IMPLEMENTATION GATE**, **LAUNCH BLOCKER** for enabling AI | Built and tripped deliberately in staging, including two concurrent requests against the last unit of capacity (§6.3) |
| Provider hard budget | 25A | **OWNER ACTION**, **REMOTE SETUP** | Set by the owner below the tolerated amount |
| Wallet trigger: fields, currency, timing, Watch | 25A2 | **RESEARCH GATE**, **DEVICE QA** | A raw-input capture on the owner's iPhone |
| Shortcut App Intent in an Expo app | 25A2 | **RESEARCH GATE**, **NOT IMPLEMENTED** | A build-level spike |
| Card mapping, capture-key deduplication | 25A2 | **DECIDED** design; **NOT IMPLEMENTED** | After 25A-03 |
| Live Activity start from the automation | 25A2 | **RESEARCH GATE**, **DEVICE QA** | §8.3, gate 1 |
| Confirmar from the Dynamic Island on the one path | 25A2 | **RESEARCH GATE**, **DEVICE QA**, **IMPLEMENTATION GATE** | §8.3, gates 2 to 4; otherwise the open-the-item fallback |
| Lock Screen content of the activity | 25A2 | **OWNER DECISION** | §8.5 |
| Extension target and app group signing | 25A2 | **OWNER DECISION**, **OWNER ACTION** | Authorization before the build |
| Financial calendar | 25C2 | **DECIDED** placement and semantics; **NOT IMPLEMENTED** | §10.6 |
| Local notification families | 25D | **DECIDED** families and privacy; **NOT IMPLEMENTED**, **DEVICE QA** | §9.2 |
| Remote push | 25E or later | **DECIDED** rule; **NOT IMPLEMENTED** | A server event that justifies it |
| Hide amounts | 25D (placement open) | **DECIDED** contract; **OWNER DECISION** on order; **NOT IMPLEMENTED** | §11.1 |
| Face ID lock, app-switcher cover | 25D | **NOT IMPLEMENTED**, **DEVICE QA** | §11.2, §11.4 |
| Data-protection class; SQLCipher and key recovery | 25D, before production | **RESEARCH GATE**, **DEVICE QA**, **LAUNCH BLOCKER** until evaluated | §11.3 |
| Onboarding additions (consent, permissions, sign-in in context) | with each feature | **DECIDED** rule; **NOT IMPLEMENTED** | §12.2 |
| Optional sync and cloud backup | 25E | **OWNER DECISION** (whether); **NOT IMPLEMENTED** | §1.4 |
| Free and Pro boundaries, prices | 25F | **OWNER DECISION**, **RESEARCH GATE** (measured costs) | Launch §1 |
| StoreKit or RevenueCat | 25F | **RESEARCH GATE**, **OWNER DECISION** | Launch §2 |
| Paywall | 25F | **NOT IMPLEMENTED** | Launch §3 |
| Subscriber identity, admin view, complimentary access | 25F | **NOT IMPLEMENTED**, **OWNER DECISION** | Launch §4 |
| App Store Server Notifications and entitlements | 25F | **NOT IMPLEMENTED**, **IMPLEMENTATION GATE** | Launch §5 |
| Paid Apps Agreement, banking, tax forms | 25F (before its sandbox gate), 26 | **OWNER ACTION**, **LAUNCH BLOCKER** for paid features; needs qualified advice | Launch §6 |
| Product analytics | 26 | **OWNER DECISION**; **NOT IMPLEMENTED** | Launch §7 |
| App Store Connect analytics | 26 | **NOT IMPLEMENTED** (no app record), **REMOTE SETUP** | The app record and the first release; launch §8 |
| Brand, naming and identity gate (the public name is not assumed to be «FinanzApp») | before 26's public assets | **RESEARCH GATE**, **OWNER DECISION**, **LAUNCH BLOCKER** for public metadata, the landing page and marketing assets | Launch §9.4 |
| ASO and store listing | 26 | **NOT IMPLEMENTED**, **OWNER DECISION**; after the brand gate | Launch §9 |
| Market launch matrix | 26 | **OWNER DECISION** | Launch §10 |
| TestFlight and release pipeline | 26 | **NOT IMPLEMENTED**, **OWNER ACTION** | Launch §11 |
| App Review checklist | 26 | **LAUNCH BLOCKER** items listed there | Launch §12 |
| Privacy policy, support page, terms | 26 | **NOT IMPLEMENTED**, **LAUNCH BLOCKER**; legal review | Launch §13 |
| Landing page | 26 (the marketing page may follow launch) | **NOT IMPLEMENTED**, **OWNER DECISION** | Launch §14 |

---

## 15. Questions this document answers

| Question | Answer in |
| --- | --- |
| Do we need Vercel? | §3.1, §3.2: yes, it hosts the two mobile API routes; kept for 25A staging; re-evaluated by §3.5. |
| What is Supabase for? | §4.1. |
| Where does the ledger live? | §1.1: on the iPhone, in SQLite. |
| Does using AI upload all financial data? | §5.4: no. |
| Which model do we use and how is it chosen? | §5.5, §5.8: none is chosen; the model in code is being retired; a recorded evaluation chooses. |
| Can the Assistant execute code or server commands? | §5.1: no; it has no such capability. |
| What prevents prompt injection from becoming an execution vulnerability? | §5.1 to §5.3, §5.7: no tools, one strict output, one confirmed write path. |
| What is the AI spend ceiling? | §6: none exists in money yet; request counts only; the stack, the atomic reservation that enforces it (§6.3) and who sets the amounts. |
| How does Wallet capture work? | §7.1, §7.2. |
| How does a credit-card Wallet pass map to a FinanzApp card? | §7.3. |
| What happens when data is incomplete? | §7.4, §7.6, §8.3. |
| Is Dynamic Island a notification? | §8.1, §9.1: no. |
| How does Confirm from Dynamic Island reach the same write path? | §8.3. |
| What happens without Dynamic Island? | §8.5. |
| Which reminders are local notifications? | §9.2. |
| When would push be required? | §9.4. |
| How does Face ID differ from encryption? | §11.2, §11.3. |
| What does the global hide-amounts eye do? | §11.1. |
| What will the calendar show? | §10. |
| What remains a gate rather than a completed capability? | §14. |
| What is Free vs Pro? StoreKit or RevenueCat? Where is the paywall? How do subscriptions restore? | [app-store-launch.md](app-store-launch.md) §1, §2, §3. |
| How do we know who has Pro? Do we know a subscriber's Apple email? How can the owner or testers receive access? | [app-store-launch.md](app-store-launch.md) §4, §5. |
| Where does Apple send the money? What still needs banking or tax setup? | [app-store-launch.md](app-store-launch.md) §6. |
| Which analytics come from Apple? What product analytics do we collect? How do we avoid uploading financial details? | [app-store-launch.md](app-store-launch.md) §7, §8. |
| What is our ASO process? Which markets and languages launch first? | [app-store-launch.md](app-store-launch.md) §9, §10. |
| What is required for TestFlight and for App Review? | [app-store-launch.md](app-store-launch.md) §11, §12. |
| What support, privacy and legal pages are required? | [app-store-launch.md](app-store-launch.md) §13. |

---

## 16. Sources

All read on **2026-10-02**. Pages on supabase.com, developers.openai.com, ai.google.dev, genai.owasp.org and some on
platform.claude.com were read through a summarising fetch; re-read the page before quoting it or relying on a number. Facts about the repository
were read from the files named in the text.

**Apple**

- Shortcuts User Guide, Transaction triggers: https://support.apple.com/guide/shortcuts/transaction-trigger-apd65c67538a/ios
- Shortcuts User Guide, running automations without asking:
  https://support.apple.com/guide/shortcuts/enable-or-disable-a-personal-automation-apd602971e63/8.0/ios/18.0 and
  https://support.apple.com/guide/shortcuts/add-automations-apdfbdbd7123/ios
- Shortcuts User Guide, intro to automation: https://support.apple.com/guide/shortcuts/intro-to-automation-shortcuts-apd690170742/ios
- App Intents: https://developer.apple.com/documentation/appintents/appintent ,
  https://developer.apple.com/documentation/appintents/liveactivityintent ,
  https://developer.apple.com/documentation/appintents/appintent/authenticationpolicy ,
  https://developer.apple.com/documentation/appintents/longrunningintent ,
  https://developer.apple.com/documentation/appintents/getting-started-with-the-app-intents-framework
- ActivityKit: https://developer.apple.com/documentation/activitykit/displaying-live-data-with-live-activities ,
  https://developer.apple.com/documentation/activitykit/starting-and-updating-live-activities-with-activitykit-push-notifications
- WidgetKit interactivity: https://developer.apple.com/documentation/widgetkit/adding-interactivity-to-widgets-and-live-activities
- Human Interface Guidelines, Live Activities: https://developer.apple.com/design/human-interface-guidelines/live-activities
- PassKit and FinanceKit: https://developer.apple.com/documentation/passkit ,
  https://developer.apple.com/documentation/financekit , https://developer.apple.com/financekit/
- Data protection: https://developer.apple.com/documentation/uikit/encrypting-your-app-s-files ,
  https://support.apple.com/guide/security/data-protection-classes-secb010e978a/web
- App switcher: https://developer.apple.com/documentation/uikit/preparing-your-ui-to-run-in-the-background
- Notifications: https://developer.apple.com/documentation/usernotifications/asking-permission-to-use-notifications ,
  https://developer.apple.com/documentation/usernotifications/registering-your-app-with-apns ,
  https://developer.apple.com/documentation/uikit/uilocalnotification
- Local authentication: https://developer.apple.com/documentation/localauthentication/lapolicy/deviceownerauthentication
- Keychain accessibility: https://developer.apple.com/documentation/security/restricting-keychain-item-accessibility
- App Review Guidelines (5.1.1(v), 5.1.2(i), 4.8): https://developer.apple.com/app-store/review/guidelines/
- Developer Forums threads on the Transaction trigger (user reports, no Apple reply):
  https://developer.apple.com/forums/thread/765516 , https://developer.apple.com/forums/thread/758053 ,
  https://developer.apple.com/forums/thread/773745 , https://developer.apple.com/forums/thread/819473

**Expo**

- Widgets and Live Activities: https://docs.expo.dev/versions/v57.0.0/sdk/widgets/ ,
  https://expo.dev/changelog/sdk-56 , https://expo.dev/changelog/sdk-57 ,
  https://expo.dev/blog/ios-widgets-and-live-activities-in-expo ,
  https://docs.expo.dev/build-reference/app-extensions/
- Notifications: https://docs.expo.dev/versions/v57.0.0/sdk/notifications/
- SQLite and SQLCipher: https://docs.expo.dev/versions/latest/sdk/sqlite/
- SecureStore: https://docs.expo.dev/versions/latest/sdk/securestore/
- Local authentication: https://docs.expo.dev/versions/latest/sdk/local-authentication/
- Screen capture and app-switcher protection: https://docs.expo.dev/versions/latest/sdk/screen-capture/
- Source read for defaults: https://github.com/expo/expo/blob/sdk-57/packages/expo-sqlite/ios/SQLiteModule.swift ,
  https://github.com/expo/expo/blob/sdk-57/packages/expo-notifications/ios/ExpoNotifications/Notifications/TriggerRecords.swift
- Community (secondary): https://github.com/EvanBacon/expo-apple-targets ,
  https://github.com/software-mansion-labs/expo-live-activity

**Supabase**

- Auth: https://supabase.com/docs/guides/auth/social-login/auth-apple ,
  https://supabase.com/docs/guides/auth/auth-anonymous , https://supabase.com/docs/guides/auth/sessions ,
  https://supabase.com/docs/guides/auth/signing-keys , https://supabase.com/docs/guides/auth/managing-user-data ,
  https://supabase.com/docs/reference/javascript/auth-admin-deleteuser
- API keys: https://supabase.com/docs/guides/api/api-keys
- Row Level Security and testing: https://supabase.com/docs/guides/database/postgres/row-level-security ,
  https://supabase.com/docs/guides/local-development/testing/overview
- Environments, branching, migrations: https://supabase.com/docs/guides/deployment/managing-environments ,
  https://supabase.com/docs/guides/deployment/branching
- Backups, logs, production checklist: https://supabase.com/docs/guides/platform/backups ,
  https://supabase.com/docs/guides/telemetry/logs , https://supabase.com/docs/guides/deployment/going-into-prod
- Edge Functions: https://supabase.com/docs/guides/functions , https://supabase.com/docs/guides/functions/limits ,
  https://supabase.com/docs/guides/functions/deploy
- Pricing and cost control: https://supabase.com/pricing , https://supabase.com/docs/guides/platform/cost-control

**Vercel**

- Functions: https://vercel.com/docs/fluid-compute , https://vercel.com/docs/functions/limitations ,
  https://vercel.com/docs/functions/runtimes/node-js/node-js-versions ,
  https://vercel.com/changelog/node-js-20-is-being-deprecated ,
  https://vercel.com/docs/functions/streaming-functions ,
  https://vercel.com/docs/functions/configuring-functions/region , https://vercel.com/docs/functions/usage-and-pricing
- Plans and fair use: https://vercel.com/docs/limits/fair-use-guidelines , https://vercel.com/docs/plans/hobby ,
  https://vercel.com/docs/plans/pro-plan
- Environments, protection, rollback, logs, spend: https://vercel.com/docs/environment-variables ,
  https://vercel.com/docs/deployments/environments , https://vercel.com/docs/deployment-protection ,
  https://vercel.com/docs/instant-rollback , https://vercel.com/docs/logs/runtime ,
  https://vercel.com/docs/spend-management
- AI Gateway (an option only): https://vercel.com/docs/ai-gateway ,
  https://vercel.com/docs/ai-gateway/observability-and-spend/budgets

**AI providers and security**

- OpenAI: https://developers.openai.com/api/docs/pricing , https://developers.openai.com/api/docs/deprecations ,
  https://developers.openai.com/api/docs/models/gpt-5-mini ,
  https://developers.openai.com/api/docs/guides/structured-outputs ,
  https://developers.openai.com/api/docs/guides/your-data , https://developers.openai.com/api/docs/guides/spend-limits ,
  https://developers.openai.com/api/docs/guides/reasoning ,
  https://developers.openai.com/api/reference/resources/responses/methods/create.md
- Anthropic: https://platform.claude.com/docs/en/about-claude/pricing ,
  https://platform.claude.com/docs/en/about-claude/models/overview.md ,
  https://platform.claude.com/docs/en/about-claude/model-deprecations.md ,
  https://platform.claude.com/docs/en/build-with-claude/structured-outputs.md ,
  https://platform.claude.com/docs/en/api/rate-limits.md ,
  https://platform.claude.com/docs/en/test-and-evaluate/strengthen-guardrails/mitigate-jailbreaks.md
- Google: https://ai.google.dev/gemini-api/docs/pricing , https://ai.google.dev/gemini-api/docs/deprecations ,
  https://ai.google.dev/gemini-api/terms , https://ai.google.dev/gemini-api/docs/billing
- OWASP Top 10 for LLM Applications 2025: https://genai.owasp.org/llmrisk/llm01-prompt-injection/ ,
  https://genai.owasp.org/llmrisk/llm062025-excessive-agency/ ,
  https://genai.owasp.org/llmrisk/llm072025-system-prompt-leakage/
