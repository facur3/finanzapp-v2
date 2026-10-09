# FinanzApp: AI staging runbook (Producto 25A-06)

Written 2026-10-05 for Producto 25A-06 «AI Staging Activation», **Phase A** (repository preflight). This is the one
durable checklist for bringing up the Assistant's **staging** backend from this repository. It is specific to this
repository: its file names, variables, scripts and SQL. It holds **no secret value**, and none may ever be added. Values go
only in the services' own settings and in local env files outside the repository (§0.3).

**Status.** Phase A (this document, the guards and the scripts) is code and documentation only:
- nothing was created, configured or applied on any service;
- no key exists;
- no provider was called.

**Phase A merged as PR #87** (merge commit ce4b4b3, 2026-10-05): checkpoint A passed. **Phase B** proceeds only
through the checkpoints of §0.2, in order, once the owner has read this runbook. Each Phase B step names who acts. Production is out of scope: no step here touches it, enables AI there or decides its numbers.

**Phase B progress (recorded 2026-10-07, owner-verified):** B1–B6 passed (B1 under the revised scope of §2, after the
legacy decommission of §0.6). **B7 runs #1 and #2 completed 2026-10-08 UTC: `gpt-6-luna` FAILED adoption both times**
(run #1 five thresholds, 7 818 µUSD; run #2, from merged PR #92, four thresholds, 7 836 µUSD; thresholds unchanged); the
second, separate one-run approval of 2026-10-08 (200 000 µUSD) was consumed by run #2; the first (2026-10-07) by run #1;
neither authorizes a further run; B8 is blocked
and any further live run needs a new owner spend approval (§11). B2–B6 were carried out before B1 closed. The results, with no account address, key, token, project ref or secret, are in
[mobile-roadmap.md](mobile-roadmap.md), «Producto 25A-06», «Phase B record»; the resources to keep and to clean up later
are in §0.5.

Related: [production-plan.md](production-plan.md) (§2 environments, §3 Vercel, §4 Supabase, §5 the Assistant, §6 cost,
§14.1 audits), [decision 006](decisions/006-cloud-identity.md) (the cloud identity), [mobile-roadmap.md](mobile-roadmap.md)
(«Producto 25A-06»).

## 0. How to use this runbook

### 0.1 Who acts

- **AUTOMATED / CLAUDE** — something the repository's code or scripts do, or an agent may run, with no credential and no
  spend. An agent never holds a staging secret, never runs SQL on a remote project and never spends money (AGENTS rules 3
  and 12).
- **OWNER** — needs an account, a credential, billing or an explicit approval. Only the owner does it. When the owner
  runs a repository script, the script reads values from the owner's local env files and prints none of them.
- **OWNER CHECK** — look at a dashboard and record the answer in the roadmap. Changes nothing. The repository cannot
  know the answer (§2).

### 0.2 Activation order (checkpoints)

Each checkpoint must pass before the next one starts. Do not skip ahead.

| # | Checkpoint | Who | Passes when |
| --- | --- | --- | --- |
| A | Phase A PR reviewed and merged | Owner | **Passed**: PR #87 merged by the owner, 2026-10-05 |
| B1 | Remote inventory recorded (§2) | Owner checks | **Passed** 2026-10-07 (revised scope, §2): inventory recorded, both legacy resources decommissioned, probes PASS again (§0.6). Every OWNER CHECK of §2 answered in the roadmap; the legacy resources retired by owner decision deleted and verified absent (§0.6); then `probe.js boundary` and `probe.js api` PASS again against staging. Nothing else deleted |
| B2 | OpenAI staging project, service accounts and limits, under the operations identity (§7) | Owner | **Passed** 2026-10-07. Key in a password manager only; limits, budget and alerts set; auto-recharge off |
| B3 | Supabase staging project and auth settings, under the operations identity (§5, §6.1) | Owner | **Passed** 2026-10-07. Settings of §5.3 set; keys of §6.2 created |
| B4 | Schema applied and verified (§6.3, §6.4) | Owner | **Passed** 2026-10-07. `verify.sql` prints `STAGING_VERIFY_OK` |
| B5 | Boundary probe (§6.5) | Owner runs a script | **Passed** 2026-10-07. Every line PASS |
| B6 | Vercel staging project deployed, AI off in the database (§4) | Owner | **Passed** 2026-10-07. `probe.js api` all PASS |
| B7 | Real Luna evaluation (§11) | Owner approves the spend and runs it | Every threshold passes, or the run is recorded as a failure, never re-graded. **RUN #1 completed 2026-10-08 UTC: FAILED** (exit 1; `schemaValidRate`, `intentAccuracy`, `clarificationAccuracy`, `groundedEvidenceAccuracy`, `hallucinatedFactRate`; 7 818 µUSD). **RUN #2 completed 2026-10-08 UTC from merged PR #92: FAILED** (exit 1; `schemaValidRate` 0.9806, `intentAccuracy` 0.9417, `clarificationAccuracy` 0.8696, `groundedEvidenceAccuracy` 0.9; 7 836 µUSD). Two one-run approvals, 2026-10-07 (consumed by run #1) and 2026-10-08 (consumed by run #2), each 200 000 µUSD; neither authorizes a further run. Any further run needs a **new** written owner spend approval covering the worst case recomputed by the script, after the local fixes and the decisions recorded in the roadmap |
| B8 | AI enabled on staging, failure drills (§12), race (§6.6) | Owner | Every drill as expected; race PASS; kill switch tested |
| B9 | Cost reconciliation (§9.3) | Owner runs a script | No day `investigate`; `estimate_exceeded` = 0 |
| B10 | Focused `/security_audit`, then `/security_review` (§14) | Claude, on the owner's request | No open High or Medium; findings fixed or recorded |
| B11 | Results recorded; 25A-06 marked done | Claude, owner confirms | Roadmap and production-plan.md updated |

Only after B11 does **25A-07** start. 25A2 (Wallet) and production activation are separate later decisions.

### 0.3 Local env files (owner)

Scripts run from the owner's machine and read values with Node's `--env-file`. Keep two files **outside the repository**,
readable only by the owner (`chmod 600`). Split by privilege: the eval file is the only one with the provider key.

`~/.config/finanzapp/staging-db.env` (Supabase and probe; names only shown here):

```
MOBILE_ENVIRONMENT=staging
MOBILE_SUPABASE_URL=https://<staging-ref>.supabase.co
MOBILE_SUPABASE_PUBLISHABLE_KEY=<sb_publishable_…>
MOBILE_SUPABASE_SECRET_KEY=<sb_secret_… — the probe key of §6.2, not the API's>
STAGING_API_ORIGIN=https://<staging-domain>
STAGING_PROBE_A_EMAIL=<test person A>
STAGING_PROBE_A_PASSWORD=<…>
STAGING_PROBE_B_EMAIL=<test person B>
STAGING_PROBE_B_PASSWORD=<…>
```

`~/.config/finanzapp/staging-ai.env` (only for §11):

```
MOBILE_ENVIRONMENT=staging
MOBILE_AI_ENABLED=true
MOBILE_AI_PROVIDER=openai
MOBILE_AI_MODEL=gpt-6-luna
MOBILE_AI_REASONING_EFFORT=low
MOBILE_AI_API_KEY=<sk-proj-… — the eval key of §7.2, not the API's>
MOBILE_AI_PROVIDER_PROJECT=<proj_…>
```

Never put `VERCEL_ENV` in either file: the scripts refuse to run when it is set. Never put a production value in either
file. Never commit them: `.env*` files are ignored, and `npm run check:repo` fails on credential shapes. A path outside
the repository is safer still.

### 0.4 What must NOT be deleted or enabled, until which checkpoint

| Do not… | Until |
| --- | --- |
| Delete, rename or reuse a staging resource or credential (§0.5, «Keep») | Never in 25A-06 |
| Promote, rename or copy a staging resource or credential into production | Never: production gets its own (§0.5) |
| Reuse the deleted legacy projects' names or credentials for the API | Never: both were deleted by owner decision 2026-10-07 (§0.6), which superseded «keep `finanzapp-v2` until B11» |
| Delete any OpenAI project, key or organization | Never delete one in use by something else |
| Delete remote Git branches | Never as part of 25A-06 (§2.3 gives the safe alternative) |
| Put any variable in a **Preview** or **Development** scope on Vercel | Never, in any project |
| Enable public sign-ups, anonymous sign-ins or any social provider on staging Supabase | Never in 25A-06 (§5) |
| Turn on OpenAI auto-recharge | Never on staging (§8) |
| Set `mobile_ai_control.enabled = true` | B8, after B5–B7 pass |
| Raise any ceiling in `mobile_ai_control` above the placeholders | Never without a recorded owner approval (production-plan.md §6.2) |
| Run `run.js --live` | B7, with an approved amount |
| Point an app build at staging | Never in 25A-06 (§13) |
| Apply `schema.sql` anywhere but the new staging project | Never in 25A-06 |
| Use the production bundle identifier or make an EAS build | Never in 25A-06 (AGENTS rule 3) |

### 0.5 Staging resource register (keep, removed, later decision)

So no temporary resource is forgotten. Names only; no address, ref, key or value. Being unused today is never by itself
a reason to delete something (§2.1).

| Resource | State |
| --- | --- |
| `~/.config/finanzapp/staging-db.env`, `~/.config/finanzapp/staging-ai.env` (§0.3) | **Keep** through B10/B11 or later staging work |
| Staging Supabase test people A and B | **Keep** through B10/B11; later decision when no longer needed |
| Staging Supabase probe key and API secret key (§6.2) | **Keep** through B10/B11; rotate or revoke when their purpose ends |
| OpenAI service accounts `finanzapp-staging-api`, `finanzapp-staging-eval` | **Keep** through B10/B11; rotate or revoke when their purpose ends |
| Supabase project `finanzapp-staging` | **Keep** (staging) |
| OpenAI project `finanzapp-staging` | **Keep** (staging) |
| Vercel project `finanzapp-api-staging` | **Keep** (staging) |
| `~/.config/finanzapp/vercel-staging.env` | **Already removed** (owner, 2026-10-07, after its one-time Vercel import) |
| Legacy Vercel project `finanzapp-v2`, with its deployments, domains, aliases, variables and settings | **Decommissioned** 2026-10-07 (§0.6) |
| Legacy Supabase project (ref prefix `mtij`), with its endpoint and public legacy `anon` key | **Decommissioned** 2026-10-07; the endpoint and key are retired with it (§0.6) |
| Synthetic probe and capture rows in staging (§6.5) | **Later decision** |
| Saved SQL-editor verification queries in staging | **Later decision**, if the owner wants them gone |
| A default Supabase secret key on staging | **Later decision**, only if verified unused |

Production gets its own projects and credentials; a staging credential is never promoted or copied into production.

### 0.6 Legacy decommission (owner decision, 2026-10-07; done)

**Owner attestation.** Both resources below belonged only to the retired web/PWA experiment. They hold no data the
owner wants or needs to preserve, and the iOS product will not reuse them. The owner deliberately chose **permanent
deletion** over export, retention or rotation. Only the owner deletes, by hand; no agent touches either service.

**Legacy Supabase project** (identified only by its ref prefix `mtij`, the project whose legacy `anon` JWT is in public
Git history, §2.1):
- [x] Decision recorded (2026-10-07).
- [x] The owner deleted the project in the Supabase dashboard (2026-10-07).
- [x] Verified: it no longer appears in the project list, and its old API endpoint no longer answers with the legacy
  key (the key is unusable).

**Legacy Vercel project `finanzapp-v2`:**
- [x] Decision recorded (2026-10-07). It is not the production host.
- [x] Before deleting: note its environment variable **names** (never values). Deleting a project removes its
  variables but **does not revoke the credentials** they hold: any provider or Supabase credential found there that is
  still live is revoked at its issuer (one belonging to the legacy Supabase project dies with that project). Owner:
  checked, none live.
- [x] The owner deleted the project in the Vercel dashboard (2026-10-07; its deployments, domains, aliases, variables
  and settings went with it).
- [x] Verified: it no longer appears in the project list, and `finanzapp-v2.vercel.app` no longer serves it.
- [x] Verified after both deletions (owner, 2026-10-07): the surviving projects are Supabase `finanzapp-staging`, Vercel
  `finanzapp-api-staging` and OpenAI `finanzapp-staging`; `finanzapp-api-staging` still builds from `master`, and `probe.js boundary` and
  `probe.js api` (§6.5, §4.6) PASS again against the surviving staging resources. Result: `boundary` every line PASS;
  `api` every line PASS, including the intended 503 while the database AI switch stays off.

**B1 passed** (2026-10-07): every box above is checked. The future production API is a separate new project (working name
`finanzapp-api-production` until the naming gate), never `finanzapp-v2`; the public landing page is not the API backend
and is not coupled to any API project (launch, brand and go-to-market slices).

## 1. What Phase A added to the repository (AUTOMATED / CLAUDE)

- [x] **Environment identity, fail closed** (`server/mobile/runtime.js`, `environmentOf`). A route runs only when every
  one of these holds:
  - `MOBILE_ENVIRONMENT=staging`, the only enabled environment (`ENABLED_ENVIRONMENTS`). Production joins that list only
    by a reviewed code change, never by configuration.
  - Vercel's own `VERCEL_ENV=production`. Staging is the Production environment of its own Vercel project, so a Preview
    deployment, `vercel dev`, or a deployment that hides Vercel's system variables stays closed whatever variables it
    holds.
  - Off Vercel (the eval and probe scripts), `VERCEL_ENV` must be absent.
- [x] **Database environment binding** (`server/mobile/schema.sql`):
  - `mobile_ai_control.environment` records `staging`.
  - `mobile_ai_reserve` and `mobile_receive_capture` receive the deployment's environment and answer `environment`
    (503) on a mismatch, before the kill switch, any budget or the inbox. A staging deployment wired to another
    environment's database fails closed there too.
- [x] **Key kinds:**
  - Only `sb_publishable_…` and `sb_secret_…` Supabase keys, each in its own slot. A legacy `anon` or `service_role` JWT
    is refused, and so is a swapped pair.
  - Only a project-scoped OpenAI key (`sk-proj-…`, or a project service account's `sk-svcacct-…`), together with its
    project id (`MOBILE_AI_PROVIDER_PROJECT`, `proj_…`), sent as the `OpenAI-Project` header. A key of another project is
    refused by OpenAI (401 `mismatched_project`). A user, legacy or admin key is refused by the server.
- [x] **Cheap token rejection** (`plausibleAccessToken`). A bearer value that is not a Supabase access token of this
  project, for a signed-in person, unexpired and not anonymous, is refused without a network call. `/auth/v1/user`
  remains the only authority (§10.2).
- [x] **Vercel configuration** (`vercel.json`): `ignoreCommand` builds only Production deployments, so Previews are
  skipped; one region `gru1` (São Paulo); `maxDuration` 60 s for `api/mobile/*.js`. Root `package.json` declares `engines.node`
  `24.x`.
- [x] **Evaluation** (`server/mobile/evals/`):
  - `estimateExceededCount` (threshold `max: 0`), `servedModels`, `servedTiers`, token totals, `costTotalMicroUsd`,
    the date and the price table's age.
  - `--live` additionally needs staging identity, a fresh price table and `--approve-micro-usd` covering the run's
    worst case (§11).
- [x] **Staging scripts** (`server/mobile/staging/`):
  - `verify.sql` (§6.4) and `usage-report.sql` (§9.3), both also run by CI on disposable PostgreSQL;
  - `probe.js` (§6.5, §6.6, §12);
  - `reconcile.js` (§9.3);
  - tests in `staging.test.js` with a fake network only.
- [x] **Price freshness** (`server/mobile/pricing.js`, `PRICING_MAX_AGE_DAYS` = 30) (§9.1).
- [x] **Repository guard:** the reconciliation admin key name and the probe password names may not appear in the app.

## 2. Existing remote resources: inventory (OWNER CHECK, change nothing)

The repository cannot see dashboards. Everything below comes from repository files and Git history. Each item lists
what only the owner can confirm. **Do not delete anything in 25A-06** except the legacy resources retired by owner
decision (§0.4, §0.6). Record each answer in the roadmap's 25A-06 section.

**Scope of B1 (revised by owner decision, 2026-10-07).** B1 inventories the resources materially connected to the
FinanzApp mobile app, its staging or production, its secrets or data that might need preserving; not unrelated personal
cloud or provider resources. A legacy disposable resource needs no table-by-table inventory when the owner attests it
holds no data to preserve and elects permanent deletion; instead the roadmap records the attestation, the safe
identity, the decision, the deletion and the post-deletion verification (§0.6).

### 2.1 Supabase

Repository truth, from the inventory of 2026-10-05:
- The current tree holds no Supabase URL, project ref or key.
- There is no `supabase/` folder, no `config.toml`, no `.env*` file, and no env file in any commit.
- **Git history (this repository is public)** holds a legacy project ref (20 characters, beginning `mtij`) and that
  project's **legacy `anon` JWT** (role `anon`, expiry 2036). They are in commits 0046425, ecfa529 and 555e39f
  (`index.html`) and d189b1e and d18f8dc (`src/app/component.js`), removed in 2e63ef0, and still reachable at the tag
  `web-frontend-final`.
- No `service_role` key was ever committed.
- The retired web's `SUPABASE_SETUP.md`, reachable from that tag, describes magic-link auth with that anon key and the
  old Vercel URL as Site URL.

- [x] **OWNER CHECK — the legacy project.** Replaced by the owner's attestation and deletion decision (2026-10-07,
  §0.6): no data to preserve, never reused; permanently deleted 2026-10-07.
- [x] **OWNER CHECK — other projects** connected to FinanzApp: the staging project `finanzapp-staging` (§6.1).
- The owner's decision (2026-10-07) among the options below was **delete** (§0.6). The options were:
  - **ignore** it (nothing in the product reads it);
  - **retain** it (for example to export old data);
  - **rotate** its legacy key (it is public in Git history: anyone can call its API with `anon` privileges, so its RLS
    is its only protection);
  - **delete** it after an export.

  Rules for that decision:
  - It is **never reused as staging**: the staging project is new and empty (§6.1).
  - It is **never deleted merely because the code no longer references it**: absence from code is not proof it is
    unused.
  - If it holds real data, an export (and the owner's own copy) comes first.

### 2.2 Vercel

Repository truth:
- `vercel.json` (now §4.4). No `.vercel/` folder, no `VERCEL_*` variable and no deploy step in CI.
- README «Hosting» names the project **`finanzapp-v2`**, which deploys `api/mobile/*` from this repository. It is the
  same project that hosted the retired PWA: history shows `finanzapp-v2.vercel.app` and a `-rho` alias, and an old
  `vercel.json` with service-worker headers.
- A local QA log of 2026-07-01 shows Git branch Preview deployments behind Deployment Protection.
- 79 remote branches exist; 63 contain `api/mobile/assistant.js`. One, `origin/feat/producto-24rep-native-first-web-retirement`,
  carries the **pre-25A-05 runtime**: it reads `MOBILE_OPENAI_API_KEY` and calls Supabase RPCs with the person's token.

- [x] **OWNER CHECK — `finanzapp-v2`:** replaced by the owner's retirement and deletion decision (2026-10-07, §0.6).
  Its variable names are noted before deletion and any live credential revoked at its issuer (§0.6).
- [x] **OWNER CHECK — other Vercel projects:** `finanzapp-api-staging` (§4).
- [x] **OWNER CHECK — Preview deployments:** no Preview or Development variable in `finanzapp-api-staging`;
  `finanzapp-v2`'s go with its deletion (§0.6).
- **Role (owner decision 2026-10-07, superseding «production host after B11»):** `finanzapp-v2` was deleted (2026-10-07);
  production gets a separate new project (§0.6).

### 2.3 Git branches

Old branches are inert unless a deployment builds them with secrets. The protection is layered:
1. No variable in a Preview scope (§0.4).
2. `ignoreCommand` on master skips Preview builds for every branch created from master after this PR.
3. Previews of older branches can still build with their old `vercel.json`. Setting the project's **Ignored Build Step**
   to the same command in the dashboard (§4.3) stops those too.
4. The runtime guard (§1) applies only to code from this PR on.

- [ ] **OWNER (optional, recommended):** set the Ignored Build Step on `finanzapp-api-staging` (§4.3). Deleting branches is
  not part of 25A-06. If the owner wants it later, archive with a tag first.

### 2.4 OpenAI

Repository truth:
- No OpenAI project id, key or organization is referenced anywhere.
- `server/mobile/pricing.js` prices `gpt-6-luna` (candidate) and `gpt-5.6-luna` (comparison only), read 2026-10-05.

- [x] **OWNER CHECK** (narrowed to FinanzApp, 2026-10-07): the staging project `finanzapp-staging` under the private
  operations identity; its two service accounts; small prepaid balance, auto-reload off; `gpt-6-luna` allowed (§7.2).
  Unrelated personal API use is out of scope.

### 2.5 Expo / EAS and GitHub

- [x] **OWNER CHECK:** EAS environment variables of the project `@facur3/finanzapp-mobile` (environments `development`,
  `preview`, `production`): names and visibility only. **None** at the owner's check (2026-10-07). None may hold a server secret. A publishable value is allowed
  but not needed in 25A-06 (§13).
- [x] **OWNER CHECK:** GitHub repository secrets and variables (names only): **none** of either (2026-10-07). CI uses none. A Vercel or Supabase token
  there would be unexpected.

### 2.6 Environment names in the repository

- **App variants:** `development` (`com.facur3.finanzapp.dev`) and `preview` (`com.facur3.finanzapp.preview`). There is
  no production variant (AGENTS rule 3).
- **EAS profiles:** `development`, `preview`, `testflight`.
- **Server:** `MOBILE_ENVIRONMENT` with the single enabled value `staging`.
- **Vercel's own** `VERCEL_ENV`: `production`, `preview` or `development`.
- **Database:** `mobile_ai_control.environment`, `staging` or `production`.

«Preview» means three different things: an app variant, an EAS profile and a Vercel scope. None of them is a backend
environment.

## 3. The environment contract

| | Development / local | Preview (Vercel Preview, any branch) | Staging | Production |
| --- | --- | --- | --- | --- |
| Runs where | The owner's Mac, Metro, CI on Linux | A non-production Vercel deployment | The **Production** environment of the Vercel project `finanzapp-api-staging` (§4.1) | The Production environment of a separate new production project (later; working name `finanzapp-api-production`) |
| `MOBILE_ENVIRONMENT` | unset | unset | `staging` | `production` (refused by code today) |
| Supabase | none; CI's disposable PostgreSQL | **none** | its own new project (§6.1) | its own project (later) |
| Supabase keys | none; fixtures in tests | **none** | a publishable key and **one secret key for the API** (plus one for the owner's probe) | its own (later) |
| AI provider | fixtures (`EXPO_PUBLIC_ASSISTANT_FIXTURES`, dev bundles) and fake fetch in tests | **none** | the project `finanzapp-staging` (§7), its own key | a separate project and key (later) |
| AI budget state | none | none | `staging` database's `mobile_ai_control` and reservations | production's own |
| Vercel variable scope | none | **no variable may be scoped here** | Production scope of `finanzapp-api-staging` only | Production scope of the production project only |
| App build that may call it | none | none | none in 25A-06 (§13) | none until a release decision |
| Logs | console | n/a (no build) | telemetry lines only (§4.7) | same rule |

**Never shared between staging and production:**
- the Supabase project and database;
- any Supabase secret key;
- the provider project and API key;
- the quota and budget state (it lives in each database).

The code makes the last three **structural**:
- the environment binding refuses a cross-wired database;
- the `OpenAI-Project` header refuses another project's key;
- each database holds its own budgets.

The first one, separate projects, is the owner's setup and is checked by B1 and by verify.sql, which requires `staging`.

**Fail closed.** Each of these returns 503 (the route has no dependencies) and calls nothing:
- a missing or unknown `MOBILE_ENVIRONMENT`;
- `VERCEL_ENV` other than `production` on a route;
- a legacy or swapped key;
- a non-project key;
- a missing project id.

A database that records another environment answers `environment`. Tests pin each case:
`server/mobile/handlers.test.js`, «environment identity and key kinds fail closed», and `schema.test.sql` (o).

## 4. Vercel

### 4.1 Which deployment hosts staging

**Decision (production-plan.md §2.4's default):** a **second Vercel project** for staging, `finanzapp-api-staging`,
connected to this same repository, production branch `master`. Its **Production** environment *is* staging: its
production domain (for example `finanzapp-api-staging.vercel.app`) is the staging API origin.

Why this option:
- it gives staging its own variable store, logs, domain and settings (rule 3 made structural);
- it works on the Hobby plan;
- a phone can reach it without a protection-bypass secret.

The rejected alternatives and why are in production-plan.md §2.4:
- a custom `staging` environment needs Pro;
- a preview branch needs a bypass secret in the binary;
- a staged production deployment uses production variables.

The staging production domain is public by necessity: the app will call it. It is safe because every route requires a
verified session, and nothing runs without the database's own switch.

### 4.2 Region

**Owner decision (2026-10-05):** Vercel Functions in **`gru1` (São Paulo)**, set in `vercel.json` for both projects,
with the staging Supabase project in the specific region **`sa-east-1` (South America, São Paulo)** (§6.1). The
product is Argentina-first, and the choice follows three reasons:
- **compute next to its database:** the function makes three sequential calls to Supabase per request (session,
  reservation, settlement), so it sits in the same AWS region as the database;
- **lower client latency for the initial Argentina market:** the person's own round trip goes to São Paulo instead of
  the US East coast;
- **a representative staging:** it matches the intended initial production topology, so staging's latencies mean
  something for production.

The trade-off, accepted and measured in staging: the single provider call per request (OpenAI) leaves South America.
Staging records p50/p95 broken down by leg (production-plan.md §3.5) before production confirms the topology.

What this is not:
- not a legal requirement;
- not a data-residency claim: request content still reaches the AI provider under its own documented terms
  (production-plan.md §5.7), and nothing about provider data residency changes.

Plan check (read on Vercel's documentation, 2026-10-05):
- `gru1` is a compute-capable Vercel region (AWS sa-east-1);
- the Hobby plan may select any **single** region, so no plan limitation prevents it;
- regional pricing differs by region (**OWNER CHECK** at B1, Vercel's regional pricing page).

If the owner creates Supabase in another region, `vercel.json`'s region must change to match before B6, in a reviewed
PR.

### 4.3 Project settings for `finanzapp-api-staging` (OWNER, at B6)

- [ ] Create the project: import this repository, root directory `/`, framework «Other». `vercel.json` supplies the
  build.
- [ ] Production branch `master`. Node.js version **24.x**: the root `package.json` declares it.
- [ ] Settings → Environment Variables → "Automatically expose System Environment Variables": **on**. The code
  requires `VERCEL_ENV=production`; without it every route stays closed.
- [ ] Settings → Git → Ignored Build Step: custom command `[ "$VERCEL_ENV" != production ]`. This also stops Previews of
  old branches whose `vercel.json` predates it. (`finanzapp-v2` is retired, §0.6.)
- [ ] Deployment Protection: keep Vercel Authentication on for Previews. Previews are not built anyway. The production
  domain stays public (§4.1).
- [ ] Functions: Fluid compute either way. `maxDuration` comes from `vercel.json` (§4.5).
- [ ] Do **not** add a custom domain, a rewrite, a cron, a firewall rule or a variable outside §4.4 without a reviewed
  change to this runbook.

### 4.4 Variables of `finanzapp-api-staging`: Production scope ONLY (OWNER, at B6)

Every variable below is added with **only "Production" ticked**: never Preview, never Development. Mark the three
secrets **Sensitive**, which makes them unreadable after saving.

| Name | Value (shape only) | Kind |
| --- | --- | --- |
| `MOBILE_ENVIRONMENT` | `staging` | plain |
| `MOBILE_INTEGRATIONS_ENABLED` | `true` | plain |
| `MOBILE_SUPABASE_URL` | `https://<staging-ref>.supabase.co` | plain |
| `MOBILE_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_…` | plain (public by design, kept server-side) |
| `MOBILE_SUPABASE_SECRET_KEY` | `sb_secret_…`, the **`mobile-api-staging`** key of §6.2 | **Sensitive** |
| `MOBILE_AI_ENABLED` | `true` (the database switch stays off until B8, §12) | plain |
| `MOBILE_AI_PROVIDER` | `openai` | plain |
| `MOBILE_AI_MODEL` | `gpt-6-luna` | plain |
| `MOBILE_AI_REASONING_EFFORT` | `low` | plain |
| `MOBILE_AI_API_KEY` | `sk-proj-…`, the **`finanzapp-staging-api`** key of §7.2 | **Sensitive** |
| `MOBILE_AI_PROVIDER_PROJECT` | `proj_…` of `finanzapp-staging` | plain (an id, not a secret) |

Rules:
- Leave `MOBILE_AI_MAX_INPUT_TOKENS` and `MOBILE_AI_MAX_OUTPUT_TOKENS` unset: the defaults are 32 000 and 1 500.
- **Never** set `MOBILE_AI_EVAL_LIVE` on any deployment.
- A variable change takes effect only on a new deployment: Deployments → … → Redeploy.
- `finanzapp-v2` was deleted (§0.6).

### 4.5 Function duration

- The handler's budget is 34 s, never retried: session 5 s + reservation 5 s + provider 20 s + settlement 4 s
  (`TIMEOUTS_MS`).
- The app waits 35 s.
- `vercel.json` sets `maxDuration` **60 s** for `api/mobile/*.js`: above both, and within every plan's
  maximum (Hobby allows 300 s with Fluid compute; the older non-Fluid Hobby limit was 60 s), so it holds on any plan. `staging.test.js` pins it.
- If a function is ever killed mid-request, its reservation stays `reserved` at the maximum and keeps counting. That is
  safe and never freed.

### 4.6 Testing `/api/mobile/assistant` without leaking credentials

Use the probe (§6.5, §12). Do not use `curl` with a token pasted on the command line, where the shell history and the
process list keep it. The probe:
- signs the two test people in itself;
- holds their tokens only in memory;
- prints one PASS/FAIL line per check, never a token, key, password or response body.

If a manual request is ever needed, put the token in a file read with `curl -H @file`, never in an argument, and delete
the file after.

### 4.7 Logs that are safe to inspect (OWNER, from B6)

Vercel → the staging project → Logs (Runtime). Each request writes **one JSON line**. It has only the keys of
`telemetryEvent` (`server/mobile/handlers.js`):
- `route`, `requestId`, `userId` (a uuid), `status`, `category`, `latencyMs`;
- `model`, `tier`, the token counts, `inputTokenBound`;
- `reservedMicroUsd`, `chargedMicroUsd`, `settlement`.

Every string is identifier-shaped and every number a non-negative integer.

- **Safe:** those lines, Vercel's own request metadata (path, status, duration, region), and build logs.
- **Never expected:** a prompt, an amount of the person's money, a merchant, a key or a bearer token. Seeing one is an
  incident: switch AI off in the database (§12, kill switch), then open a security review.
- Supabase's own logs (API, Auth) carry IP addresses, user ids and e-mails of the test people: inspect them only in
  the dashboard, never export them into the repository or a chat.
- Hobby keeps runtime logs for about one hour, so read a drill's lines right after it.

## 5. Supabase auth contract

### 5.1 Recommendation for the 25A launch architecture

**[Decision 006](decisions/006-cloud-identity.md)** has the comparison and the migration and StoreKit implications.

**Recommended for launch:** **Sign in with Apple** is the one cloud identity. It uses Supabase's native ID-token flow
(`signInWithIdToken`, provider `apple`, with a nonce):
- requested only when the person turns on a cloud feature (the Assistant first);
- never for the local core, which keeps working with no account, forever;
- no e-mail and password, no magic link, no anonymous users and no social provider at launch.

**For 25A-06 (staging) only:** no product sign-in is built. Two or three **test people** are created by the owner in
the staging dashboard, e-mail and password, confirmed on creation, with **public sign-ups disabled**. The probe signs
them in.

Why Sign in with Apple is not built in 25A-06:
- it needs the native module and a new development build (EAS is excluded here, AGENTS rule 3);
- it needs the Sign in with Apple capability on the bundle identifier and an Apple key for the Supabase provider and
  for token revocation (owner actions in the Apple Developer account);
- it needs an in-app account deletion that also revokes the Apple token (App Review guideline 5.1.1(v)).

It is a slice of its own, with its own security review. It comes after 25A-06 and before any build calls the cloud
Assistant (decision 006, «Consequences»).

**Anonymous Supabase users are insufficient** for abuse resistance. Anyone can mint unlimited identities with one
request each, so per-user ceilings mean nothing and only the global breaker would bound spend. The server and the
database already refuse them (`is_anonymous`).

### 5.2 Why e-mail is not the launch method

- Cheap multi-account abuse: disposable addresses.
- E-mail confirmation and CAPTCHA would be mandatory.
- Supabase's built-in mail is rate-limited and meant for testing, so production needs a custom SMTP provider: another
  vendor and another secret.

In staging, e-mail serves only for owner-created test people.

### 5.3 Staging auth settings (OWNER, at B3)

Authentication → Sign In / Providers and → Settings in the staging project. Set each and record "done" in the roadmap.

- [ ] **Allow new users to sign up: off.** Only the owner creates people, in the dashboard.
- [ ] **Allow anonymous sign-ins: off.**
- [ ] **E-mail provider: on**, only so the test people can sign in with a password; **confirm e-mail: on**. Create each
  test person with "Auto Confirm User".
- [ ] **Every other provider: off**, Apple included until its slice.
- [ ] **CAPTCHA:** not needed while sign-ups are off; nobody can create an account. It becomes **required** before any
  sign-up path opens (Turnstile or hCaptcha, decided in the sign-in slice), and with Sign in with Apple it is replaced
  by Apple's own account friction plus the server's per-user ceilings.
- [ ] **Rate limits** (Authentication → Rate Limits): keep the defaults. Record the values for sign-in, token refresh
  and OTP.
- [ ] **JWT expiry:** keep the default (3 600 s). Record it.
- [ ] **JWT signing keys:** record whether the project uses the asymmetric signing keys (the default for new projects).
  §10.2 explains why the server still calls `/auth/v1/user`.
- [ ] **Site URL / redirect URLs:** leave the default; no web flow exists.
- [ ] Create **test person A** and **test person B**, and optionally C. Use addresses the owner controls (plus-addressing
  of the owner's own mailbox works). Use strong unique passwords, stored only in the password manager and the local env
  file (§0.3). No real financial data is ever used with them.

## 6. Supabase schema and verification

### 6.1 Project (OWNER, at B3)

- [ ] **Owner identity:** the Supabase organization is owned by the private product-operations identity
  ([production-plan.md](production-plan.md) §2.6), never a public support address; its address is not written here.
- [ ] **New project** in that organization, named `finanzapp-staging`, specific region **South America
  (São Paulo), `sa-east-1`** (§4.2), Free plan acceptable for staging. A Free project pauses after a week without activity: resume it from the
  dashboard. Database password into the password manager.
- [ ] It is **empty**. Never point staging at the legacy project (§2.1) or at any project with data.

### 6.2 API keys (OWNER, at B3)

Project Settings → API Keys.
- [ ] The **publishable** key (default) → `MOBILE_SUPABASE_PUBLISHABLE_KEY`.
- [ ] Create **two secret keys**:
  - `mobile-api-staging`, only for the Vercel staging project (§4.4);
  - `owner-probe-staging`, only for the owner's local `staging-db.env`.

  Revoking one never breaks the other. Each is a `service_role` credential: it never goes in an app, an `EXPO_PUBLIC_*`
  variable, a chat or the repository.
- [ ] **Legacy API keys** (`anon`, `service_role` JWTs): disable them in this project if the dashboard offers it, and
  record. The server refuses them anyway (§1).

### 6.3 Apply the schema (OWNER, at B4)

What the review of `server/mobile/schema.sql` found for a **new empty project**:

| Item | Finding |
| --- | --- |
| Extensions | None needed. `gen_random_uuid()` is core PostgreSQL (13+); `dblink` is used only by CI's test file, never here. |
| Supabase objects it relies on | `auth.users` with `is_anonymous` (present in current projects); the roles `anon`, `authenticated`, `service_role`. |
| Tables | `mobile_capture_inbox`, `mobile_api_usage`, `mobile_ai_control` (one row, `environment = 'staging'`, `enabled = false`), `mobile_ai_reservations`. All with RLS on. |
| Grants | Supabase's default privileges grant every new table and function to the API roles; the script **revokes them explicitly** and grants execute on three functions to `service_role` only. `service_role` has no table privilege at all: it reaches data only through the functions. |
| Secret-key assumption | A `sb_secret_…` key in the `apikey` header runs as the `service_role` Postgres role, with no user token: exactly the role the functions are granted to. |
| Control row | Inserted **disabled**, bound to `staging`, with the staging placeholders (production-plan.md §6.2). |
| Reapplication | **Not idempotent by design.** It is one transaction (`begin … commit`): run twice, the first `create table` fails and the whole second run rolls back, so nothing changes. Never edit it to "make it rerunnable". |
| Migrations | Applied once. Every later change is a new ordered file (`supabase/migrations/` layout, production-plan.md §4.4), reviewed and tested in CI first. |
| Rollback / recovery | A failed application leaves nothing (one transaction). A bad applied state on staging: delete and recreate the staging project (it holds only test people), never hand-edit the functions. Production is never recovered this way. |

Steps:
- [ ] SQL Editor → New query → paste the **whole** of `server/mobile/schema.sql` from the merged `master` → Run. Expect
  "Success. No rows returned".
- [ ] Do **not** run `server/mobile/schema.test.sql` on Supabase: it creates its own `auth` schema and is for disposable
  PostgreSQL only.

### 6.4 Verify it (OWNER, at B4)

- [ ] SQL Editor → New query → paste the whole of `server/mobile/staging/verify.sql` → Run, with AI still **disabled**.
  The result is one row: **`STAGING_VERIFY_OK`**. Any failure stops with «FAIL: …». It keeps nothing either way: three
  throwaway people and their rows are undone by a deliberate rollback of its block.
- It proves, on the real roles and grants:
  - AI installed **disabled** and bound to **staging**;
  - RLS on every table;
  - no table or column privilege (including TRUNCATE, REFERENCES and TRIGGER) for `anon` or `service_role`, and for
    `authenticated` only reading their own inbox; `anon` actually refused on the inbox;
  - a capture naming another environment refused;
  - no client role may execute any function (by grant, and by actually calling `mobile_ai_reserve`, `mobile_ai_settle`
    and `mobile_receive_capture` as `anon` and `authenticated`), nor flip the kill switch;
  - every function is `security definer` with an empty `search_path`;
  - no chat-history table exists;
  - the server path refuses while disabled, refuses another environment, refuses an anonymous owner and cannot read the
    tables directly;
  - person B sees none of A's inbox;
  - B cannot settle A's reservation, and settlement happens exactly once;
  - a duplicate request id is refused;
  - the per-user **day**, per-user **month**, global **day** and global **month** ceilings each fit exactly and refuse
    at +1 µUSD.
- CI runs the same file on every push (job `mobile_api`). 13 planted faults were each caught while it was written:
  an execute grant to `authenticated`; a table grant to `service_role`; column grants to `anon` (with an open policy)
  and to `authenticated`; TRUNCATE to `authenticated`; REFERENCES to `service_role`; AI enabled; RLS off; an open inbox
  policy; a chat table; a reset `search_path`; a `security invoker` function; another environment's control row.

### 6.5 Boundary probe from the network (OWNER, at B5)

```
node --env-file=$HOME/.config/finanzapp/staging-db.env server/mobile/staging/probe.js boundary
```

It writes exactly one row, ever: a capture for test person B with the fixed request id `stagingprobe-inbox-0001` (a
repeat run is a duplicate), so the inbox isolation is checked against a row that exists. It checks, through Supabase's
real API gateway:
- the two test people sign in;
- anonymous sign-in is refused **for that reason** (`anonymous_provider_disabled` or `signup_disabled`, not a rate
  limit or an outage);
- neither the publishable key alone nor a signed-in person can execute any of the four functions or read the control
  row, the reservations or the counters;
- the server path stores B's probe capture; A does not see it, B does, and the publishable key alone reads nothing of
  the inbox;
- the server path (the secret key alone) answers `disabled`, and `environment` for another name.

Every line must be PASS (exit 0). The probe capture may stay; to remove it:
`delete from public.mobile_capture_inbox where request_id = 'stagingprobe-inbox-0001';`.

### 6.6 Concurrency race on staging (OWNER, at B8, after AI was enabled once)

CI proves the race with two real connections (`schema.test.sql` (m)). This repeats it through the real PostgREST. No
provider is called.

1. [ ] SQL Editor, the race setup: AI stays enabled, every limit is raised for the race, and test person A's month is
   sized to 3 requests of 1 000 µUSD. The ceiling for A is relative to what A already holds this month.

   ```sql
   update public.mobile_ai_control set user_per_minute = 1000, user_per_hour = 1000, user_per_day = 1000,
     user_per_month = 1000, user_concurrency = 1000, global_concurrency = 1000, max_request_micro_usd = 1000,
     user_day_ceiling_micro_usd = 100000000, global_day_ceiling_micro_usd = 100000000, global_month_ceiling_micro_usd = 100000000,
     user_month_ceiling_micro_usd = 3000 + (select coalesce(sum(charged_micro_usd), 0) from public.mobile_ai_reservations
       where user_id = (select id from auth.users where email = '<test person A e-mail>')
       and month_key = date_trunc('month', now() at time zone 'UTC')::date);
   ```

2. [ ] `node --env-file=$HOME/.config/finanzapp/staging-db.env server/mobile/staging/probe.js race --max 1000 --ceiling 3000`.
   It sends 8 reservations at once; PASS means exactly 3 were granted.
3. [ ] Cleanup, the same query tab. The race rows never reached a provider, so deleting them releases no real spend:

   ```sql
   delete from public.mobile_ai_reservations where request_id like 'stagingprobe-race-%';
   ```

   Then restore the staging values (the placeholders of `schema.sql`, with the global month as set in §7.2):

   ```sql
   update public.mobile_ai_control set user_month_ceiling_micro_usd = 2000000, user_day_ceiling_micro_usd = 250000,
     global_day_ceiling_micro_usd = 1000000, global_month_ceiling_micro_usd = <as recorded at B8>, max_request_micro_usd = 10000,
     user_per_minute = 6, user_per_hour = 60, user_per_day = 200, user_per_month = 2000, user_concurrency = 2, global_concurrency = 10;
   ```

## 7. OpenAI staging project

### 7.1 Facts that shape the setup (re-read in the dashboard at B2)

- Billing (prepaid credits, auto-recharge) is per **organization**. Projects carry their own **budgets and alerts**, and
  where offered, model and rate limits.
- The staging organization and project are created under the private product-operations identity
  ([production-plan.md](production-plan.md) §2.6), never a public support address; its address is not written here. If
  other API use shares that organization (§2.4), the project limits are the only isolation of staging's spend.
- OpenAI says a project spend limit's enforcement is not instantaneous, so the server's ceilings stay **below** it
  (production-plan.md §5.7).

### 7.2 Steps (OWNER, at B2)

- [ ] **Project** `finanzapp-staging`, separate from the default project and from any personal use. Record its id
  (`proj_…`) → `MOBILE_AI_PROVIDER_PROJECT`.
- [ ] **Model access** (project → Limits), where offered: allow only `gpt-6-luna`, plus `gpt-5.6-luna` only if §11
  needs the comparison.
- [ ] **Keys:** prefer two project **service accounts**, each with its own key, so machine access belongs to no
  person's login:
  - `finanzapp-staging-api` → Vercel only (§4.4);
  - `finanzapp-staging-eval` → the owner's `staging-ai.env` only (§0.3).

  Only if the console offers no service account, two project-scoped keys with the same names.

  Permissions **Restricted**, where offered: the Responses API (`/v1/responses`) write, nothing else; Models read only
  if the console requires it. Never an organization admin key in any FinanzApp setting. Each key goes into the
  password manager the moment it is shown.
- [ ] **Budget / hard limit** for the project: the smallest the console allows that still covers §11 and §12 (for
  example **USD 5 per month**). Record it as `L`. The server must stop first: at B8, before enabling AI, the owner sets
  `global_month_ceiling_micro_usd` to at most 80 % of `L` (with `L` = USD 5: `4000000`). Lowering a ceiling needs no
  special approval; raising one does (production-plan.md §6.2).
- [ ] **Alerts:** project budget alert e-mails at 50 % and 80 %, to the owner.
- [ ] **Organization billing:** prepaid balance **small** (for example USD 5–10); **auto-recharge OFF**.
- [ ] **Data controls:** record the organization's data retention settings. `store: false` is sent on every request;
  zero data retention is not assumed (production-plan.md §5.7).
- [ ] **Never** put a key in Expo, EAS, `app.config.ts`, an `EXPO_PUBLIC_*` variable, a Vercel Preview or Development
  scope, the repository or a chat. The model stays server configuration (`MOBILE_AI_MODEL`): changing it is a Vercel
  variable change plus a redeploy, never an app build.

## 8. Billing and scale operations

The principle (production-plan.md §6.6, unchanged): billing settings are availability and a last backstop, never the
cost boundary. The boundary is the database's atomic reservation; the provider's hard limit stands behind it,
independently.

**Staging:**
- tiny prepaid balance;
- auto-recharge off;
- the smallest provider hard limit;
- the server's ceilings below it.

The staging placeholders in `mobile_ai_control` are the server's ceilings: USD 2 per person per month, USD 0.25 per
person per day, USD 1 app-wide per day, USD 5 app-wide per month, USD 0.01 per request.

**Production (later, not decided here):**
- auto-recharge, if enabled, only keeps the service available between deliberate top-ups;
- every recharge has an amount and a frequency bound;
- no unlimited recharge;
- the internal ceilings are always the first boundary;
- the provider's hard cap is set independently;
- alerts and both kill switches never depend on billing;
- no permanent business-wide dollar constant.

**How production ceilings will be scaled (operations, recorded now, numbers later):**

| Input | Source | Used for |
| --- | --- | --- |
| Paying people `P` (active subscriptions) | App Store Connect / the entitlement mirror (25F) | the size of the global ceilings |
| Measured cost per paying person per month: p50 `c50` and p95 `c95` | Settled reservations (`usage-report.sql`), reconciled against the provider (§9.3) | per-person ceilings and the global estimate |
| App Store net proceeds per paying person per month `N` | App Store Connect, after Apple's commission and taxes | the money available for AI |
| Target AI cost of goods `k` (a fraction of `N`) | Owner decision (25F) | the affordable spend per person |
| Observed abuse | Rejections by category (`rate`, `busy`, `user_budget`), accounts near ceilings, reconciliation anomalies | whether a ceiling rises or falls |

- **Per-person month ceiling:** at least `c95` (legitimate heavy use is not cut off) and at most `k × N`, unless the
  owner accepts a loss on the heaviest users. The day ceiling bounds one bad day for one account.
- **Global month ceiling:** about `P × c50 × headroom`, with headroom for growth inside the review interval, re-sized
  at every review. It is a breaker against bugs and abuse, never a cap on growth (§6.6).
- **Provider hard limit:** above the global month ceiling, so the server stops first, and below what the owner could
  absorb if the server failed open.
- **Review cadence:** at least monthly and after any jump in `P`. Each change is an owner-approved SQL update recorded
  in the roadmap (production-plan.md §6.2, «Raising a cap»).

**Alerts in staging:**
- the provider's budget e-mails (§7.2);
- the daily `usage-report.sql` while drills run (§9.3).

An automated owner alert (a scheduled job and a push or e-mail) is **NOT IMPLEMENTED**. It is required before
production and scoped with 25A-07 or 25F; no job runs in staging.

## 9. Price freshness and provider reconciliation

### 9.1 Price table freshness (AUTOMATED)

`server/mobile/pricing.js` carries `readOn` and `source`. `PRICING_MAX_AGE_DAYS` is 30. The policy:
- `run.js --live` **refuses** (exit 2, before any provider exists) when the table is older than 30 days, or dated in the
  future;
- the fixture run and every report print `pricing: { readOn, ageDays, maxAgeDays }`, and the fixture run warns when it
  is stale;
- a **release** re-reads the prices and the deprecation pages too (production-plan.md §5.8).

Refreshing means a person re-reads the provider's pricing page and the model page, then updates the numbers if they
changed. `readOn` and `source` go into a **reviewed commit** that states what was read. Moving the date without a re-read
defeats the check. Changing a price to make an evaluation pass is never allowed.

### 9.2 Settlement inside FinanzApp (already in 25A-05)

- Every request reserves its worst case before the call.
- It settles from trusted usage: the configured model and tier, consistent integers.
- A higher actual cost is **recorded**, never capped (`outcome = 'estimate_exceeded'`).
- An unknown cost stays at its maximum.

### 9.3 Reconciliation against the provider (OWNER runs, at B9)

1. [ ] SQL Editor: run `server/mobile/staging/usage-report.sql` after editing its two dates to the period. Save the
   single JSON value to `~/finanzapp-staging/usage.json`, outside the repository. It holds counts, tokens and integer
   µUSD only, no user id.
2. [ ] Provider side. OpenAI's **Costs API** (`GET https://api.openai.com/v1/organization/costs`) needs an **organization
   admin key**, which only the owner holds and which is never stored in any FinanzApp setting. Create it for this,
   revoke it after.

   ```
   curl -s "https://api.openai.com/v1/organization/costs?start_time=<unix>&end_time=<unix>&bucket_width=1d&group_by=project_id&limit=31" \
     -H @$HOME/finanzapp-staging/admin-header.txt > $HOME/finanzapp-staging/costs.json
   ```

   `admin-header.txt` holds one line, `Authorization: Bearer <admin key>`, and is deleted afterwards. Alternatively,
   export the usage from the dashboard and rebuild the same JSON by hand. The script needs only `data[].start_time` and
   `data[].results[].amount` / `project_id`.
3. [ ] `node server/mobile/staging/reconcile.js --ours ~/finanzapp-staging/usage.json --provider ~/finanzapp-staging/costs.json --project proj_<staging> [--eval ~/finanzapp-staging/eval.json]`
   - `--project` is required.
   - `--eval` adds a live evaluation's cost to its day, because the eval calls bypass the reservations. The eval report
     must name the same provider project and must not cross UTC midnight; otherwise reconcile those days by hand.
   - **Refused (exit 2)** rather than reported, because the comparison would be meaningless:
     - no provider result for the project (a mistyped id, or the spend billed elsewhere);
     - a result without a project id (fetched without `group_by=project_id`);
     - a truncated page (`has_more`);
     - a non-numeric or non-USD amount;
     - a bucket that is not one UTC day.
   - Each day is `ok`, `pending` (no provider data yet; costs can lag a day), `over_estimate` (FinanzApp settled more
     than 5 % + USD 0.001 above the bill: expected to be small, because estimates round up) or **`investigate`**.
   - A day is `investigate` when the provider billed more than FinanzApp can have spent, or when any `estimate_exceeded`
     row exists. The script exits 1. What FinanzApp can have spent counts unsettled and stale requests at their maximum
     (`chargedMicroUsd`), so a drill's unsettled rows never hide an overbilled day.
   - A request reserved in a day's last minute may run, and be billed, after UTC midnight. The report carries that
     minute's cost (`nearMidnightMicroUsd`), and the next day's bound includes it, so such a crossing is never flagged
     as overbilling.
4. [ ] **`estimate_exceeded` must be zero.** One means the input-token bound or the price table under-reserves, so the
   ceilings would not bound spend. Stop: switch AI off in the database, open an investigation, and fix the bound or
   the table in a reviewed PR. Never adjust a number to make the report pass.

## 10. Auth abuse preflight

### 10.1 Controls and their state

| Control | State in Phase A | Owner step |
| --- | --- | --- |
| E-mail confirmation | Not applicable: no sign-up path is open; test people are confirmed on creation | §5.3 |
| CAPTCHA / bot friction | Not needed while sign-ups are off; required before any sign-up opens; with Sign in with Apple, Apple's account friction plus per-user ceilings (decision 006) | §5.3 |
| Supabase Auth rate limits | Defaults kept and recorded | §5.3 |
| Cheap multi-account quota abuse | Anonymous identities refused (server, database, Auth setting); sign-ups closed in staging; at launch one Sign in with Apple identity per Apple Account; per-user and global ceilings in the database; later a Pro entitlement (25F) as the strongest boundary | §5.3; decision 006 |
| Malformed bearer cheaply rejected | **Done:** `plausibleAccessToken` refuses non-JWT shapes, another project's issuer, a wrong audience or role, anonymous or expired tokens before any network call | none |
| Local JWT/JWKS verification | Evaluated, not added (§10.2) | none |
| Vercel firewall / rate control | Defense in depth only; the database's rate windows are the real limit | optional, §10.3 |

### 10.2 Local JWKS verification, evaluated

Supabase projects can sign access tokens with asymmetric keys and publish them at `/auth/v1/.well-known/jwks.json`. A
local signature check would reject forged tokens without calling Supabase.

It does **not** preserve revocation:
- a signed-out session, a deleted account or a banned person keeps a validly signed token until it expires (one hour by
  default);
- `/auth/v1/user` checks that the session still exists.

So local verification could only ever come **before** the remote call, never replace it. With the claim precheck
already refusing every unsigned shape, expired or anonymous token, what remains is a well-formed forged token, which
costs the attacker nothing to make and costs FinanzApp one Supabase call. That is bounded by Vercel's and Supabase's own
limits and does not reach the reservation.

**Decision:** not added in 25A-06. Revisit with staging measurements when either holds:
- `/auth/v1/user` is a material share of p95 (production-plan.md §3.5);
- forged-token traffic appears in the logs (`category: auth` at volume).

If added, it needs:
- a JWKS cache with rotation;
- ES256 verification;
- the remote check kept after it.

### 10.3 Vercel firewall (OWNER, optional)

Vercel's firewall can add a rate rule on `/api/mobile/*` per IP, as defense in depth against floods that never reach
the database. Whether a custom rate rule is available depends on the plan: **OWNER CHECK**. Nothing in this runbook
depends on it. If set, use a generous limit (for example 60 requests per minute per IP) so drills (§12) still run.

## 11. The real Luna evaluation (OWNER-APPROVED SPEND, at B7)

Every real run is an owner-approved spend. Its worst case is computed by the script itself (`worstCaseMicroUsd`:
every case at its reservation maximum, every input token at the highest rate, cache writes included, each request
rounded up), and it changes with the instructions and the configuration, so it is recomputed at the commit a run uses,
never estimated per byte.
- **179 588 µUSD (about USD 0.18)** for the 103 committed cases on `gpt-6-luna` at the 2026-10-05 table, after the B7
  instruction rules of PR #94, the no-model-arithmetic rule of decision B (PR #96), the protocol v3 reply language and
  the protocol v4 decimal amount (145 272 at Phase A; 151 469 at PR #92; 166 834 at PR #94; 169 803 at PR #96; 176 364
  at PR #97).
- For comparison, 390 025 µUSD on `gpt-5.6-luna` (321 388 at Phase A; 333 787 at PR #92; 364 519 at PR #94; 370 455
  at PR #96; 383 574 at PR #97).
- The real cost is a fraction of that (runs #1 and #2: 7 818 and 7 836 µUSD).

The eval calls the provider **directly**: they bypass the database reservations. They are bounded by the
`--approve-micro-usd` amount (refused below the worst case) and by the provider project's hard limit (§7.2).

- [x] The owner approves an amount, for example `--approve-micro-usd 200000` (USD 0.20), in writing, in the roadmap.
  **Approved 2026-10-07:** 200 000 µUSD for one run (roadmap, «Producto 25A-06», «Phase B record»); consumed by run #1.
  **Approved again 2026-10-08, separately, for the second run:** 200 000 µUSD for one run («Autorizo una segunda evaluación live de GPT-6 Luna, con un máximo aprobado de 200000 micro-USD (USD 0,20) para una sola corrida.»);
  consumed by run #2. Neither authorizes a further run: each further run needs its own written approval covering the
  complete corpus worst case recomputed with `worstCaseMicroUsd` by the committed evaluator after any prompt or
  configuration change (the script refuses an approval below it).
- [x] Run, from the merged `master`, with no personal financial data (the corpus is synthetic). **Run #1, 2026-10-08
  UTC, exit 1: `gpt-6-luna` FAILED adoption**; 7 818 µUSD under the 2026-10-07 approval. **Run #2, 2026-10-08 UTC,
  from merged PR #92 (b1c0136), under the separate 2026-10-08 approval, exit 1: FAILED adoption**; worst case
  151 469 µUSD, measured 7 836 µUSD. The numbers and the case-by-case diagnoses
  are in the roadmap («Producto 25A-06», «Phase B record», B7). Any further run repeats this step only after a **new**
  written approval, after the local fixes and the owner decisions the run #2 record lists (with the protocol as it is,
  `schemaValidRate` cannot pass on the corpus as committed); the worst case is recomputed by the script:

  ```
  MOBILE_AI_EVAL_LIVE=1 node --env-file=$HOME/.config/finanzapp/staging-ai.env server/mobile/evals/run.js \
    --live --approve-micro-usd 200000 > $HOME/finanzapp-staging/eval.json
  echo "exit $?"
  ```

  - Exit 0: every threshold passed.
  - Exit 1: at least one failed; the report says which.
  - Exit 2: refused, nothing sent. Possible causes: a missing gate, a non-staging environment, `VERCEL_ENV` present,
    a key that is not project-scoped, a missing project id, a stale price table, an insufficient approval, or a corpus
    case above `MOBILE_AI_MAX_INPUT_TOKENS` (the server would answer 413 and never send it).
- The report records:

  | What | Where in the report |
  | --- | --- |
  | Model actually served, per case | `metrics.servedModels` |
  | Tier, per case | `metrics.servedTiers` |
  | Schema-valid rate | `metrics.schemaValidRate` |
  | Intent accuracy | `metrics.intentAccuracy` |
  | Capture accuracy | `metrics.captureFieldAccuracy` |
  | Clarification accuracy | `metrics.clarificationAccuracy` |
  | Payment-reference preservation | `metrics.destinationReferencePreservation` |
  | Refusal and jailbreak scores | `metrics.unsupportedRefusalRate`, `metrics.jailbreakProposalRate` |
  | Refusals' prose, for a person to read | `refusals` |
  | Grounding and hallucination | `metrics.groundedEvidenceAccuracy`, `metrics.hallucinatedFactRate` |
  | Reply language (protocol v3, since 2026-10-09) | `metrics.replyLanguageAccuracy`; the flagged cases carry `reply_language:<asked>` in `imperfect` |
  | Boundary recovery of a refused output (decision A, since 2026-10-09) | `metrics.recoveredProposalCount` (a count, no threshold); such a case carries `boundary_dropped:<field>` and `imperfect[].recovery` beside its raw verdict, which the rates read |
  | p50 and p95 latency | `metrics.latencyP50Ms`, `metrics.latencyP95Ms` |
  | Token usage | `metrics.tokens`, means and p95 |
  | Cost in µUSD | `metrics.costMeanMicroUsd`, `costP95MicroUsd`, `costMaxMicroUsd`, `costTotalMicroUsd` |
  | `estimate_exceeded` count | `metrics.estimateExceededCount` |
  | Served as configured | `metrics.servedAsConfiguredRate` |
  | Date, environment, project, price table, approval | `ranOnUTC`, `finishedOnUTC`, `environment`, `providerProject`, `pricing`, `approvedMicroUsd`, `worstCaseMicroUsd` |

- **Adoption rule:** `gpt-6-luna` is adopted **only if every threshold in `server/mobile/evals/thresholds.js` passes**
  on the corpus as committed: the 25A-05 bar plus `estimateExceededCount` = 0.
  - **Thresholds are never lowered because a real model fails.**
  - If Luna fails a required bound, `gpt-5.6-luna` is evaluated the same way, as a comparison (a second approved spend).
  - If both fail, nothing is adopted and 25A-06 records the failure.
- [x] Keep `eval.json` outside the repository. Claude records its numbers in the roadmap: no prose of refusals, no
  token counts per case. Since run #1 the report lists every case that costs a metric, with the metrics it costs
  (`imperfect[].misses`) and the parsed output the adapter returned (`imperfect[].output`, synthetic), so a failed run
  can be diagnosed without another one; it stays outside the repository like the rest. A response the adapter itself
  rejected (`provider_<category>` in the flags) has no output to show: the port keeps no partial or unparsed body. Since
  decision A (2026-10-09) a refused output the server boundary would recover (an over-long merchant or category) also
  shows `imperfect[].recovery` (the names dropped and the recovered draft's field scores) beside its raw verdict; the
  rates and the verdict read the raw output only.

## 12. Staging smoke and failure drills (OWNER, at B8)

**Start state:**
- Vercel staging deployed (§4.4, `MOBILE_AI_ENABLED=true`);
- the database switch **off**;
- `probe.js api` all PASS;
- the global month ceiling below the provider limit (§7.2);
- then: `update public.mobile_ai_control set enabled = true;`.

The placeholders stay as installed unless a drill says otherwise. After each drill, restore what it changed, and read
the telemetry line (§4.7).

In 25A-06 no app build calls staging (§13), so the manual local app is untouched by every drill by construction:
- the ledger lives on the iPhone;
- the server has no ledger;
- a proposal becomes a movement only when the person confirms it in the review sheet (25A-04).

The device-side behavior on failures (an error message, nothing written, manual entry available) is pinned by the app's
tests. It is checked on the iPhone only when a build connects (25A-07).

Base commands:
- `P=node --env-file=$HOME/.config/finanzapp/staging-db.env server/mobile/staging/probe.js`
- `$P api --ai-enabled`: two billed requests, about USD 0.001.

| Drill | How to cause it | Expect |
| --- | --- | --- |
| AI disabled (database) | `update public.mobile_ai_control set enabled = false;` then `$P api` | 503; telemetry `category: disabled`; no provider call |
| AI disabled (deployment) | Vercel: `MOBILE_AI_ENABLED=false`, redeploy | 503 «La integración todavía no está habilitada.», no telemetry line (no dependencies); restore and redeploy |
| Kill switch during active testing | Run `$P api --ai-enabled`; flip the database switch off between two runs | the next request 503 `disabled`; an in-flight one completes and settles; no new reservation |
| Bad or missing API key | (a) Vercel: delete `MOBILE_AI_API_KEY`, redeploy. (b) Create a third key, set it, redeploy, **revoke it** in OpenAI | (a) 503, route closed. (b) 502 `provider_http`; the reservation `unsettled` at its maximum |
| Bad Supabase secret | Create a third secret key, set it, redeploy, **revoke it** | 503 `database` on reservation («La integración no está disponible…»); nothing reaches the provider. `$P api` fails its 503 check here: it requires the reservation's own words |
| Invalid user token | `$P api` | 401 on no session, a malformed bearer and a forged token |
| Anonymous user | Not reproducible while anonymous sign-ins stay off (the boundary probe checks that); the server's refusal is unit-tested | do not enable anonymous sign-ins to test it |
| User daily money ceiling | `update … set user_day_ceiling_micro_usd = 1;` then `$P api --ai-enabled` | 429 `user_budget`; restore 250000 |
| User monthly money ceiling | `update … set user_day_ceiling_micro_usd = 250000, user_month_ceiling_micro_usd = 1;` | 429 `user_budget`; restore 2000000 |
| Global daily ceiling | `update … set global_day_ceiling_micro_usd = 1;` | 503 `global_budget`; restore 1000000 |
| Global monthly ceiling | `update … set global_month_ceiling_micro_usd = 1;` | 503 `global_budget`; restore 5000000 |
| Request rate limit | `update … set user_per_minute = 1;` then `$P api --ai-enabled` | the second request in the minute 429 `rate`; restore 6 |
| Concurrency limit | `update … set user_concurrency = 0;` | 429 `busy`; restore 2. True concurrency: §6.6 |
| Duplicate request id | `$P api --ai-enabled` | the repeated id 409 `duplicate` |
| Provider timeout | Not inducible on staging without a fault flag, which production code does not carry. Unit-tested (`provider.test.js`: `timeout`) | recorded as unit evidence only |
| Invalid provider schema | Not inducible with a strict schema. Unit-tested (`invalid`, `output_invalid`) | unit evidence only |
| Model or tier mismatch | Not inducible by configuration. Unit-tested; the evaluation's `servedAsConfiguredRate` = 1 | unit and eval evidence |
| Unknown usage, unsettled reservation | Produced by the revoked-key drill above | `select state, count(*) from public.mobile_ai_reservations group by state;` shows `unsettled` rows counted at their maximum, never freed |
| Wrong environment | Vercel: `MOBILE_ENVIRONMENT=production`, redeploy | 503, route closed (code refuses production); restore |

No drill writes a ledger. The API has no ledger. An AI reply is a draft until the person confirms it on the device.

## 13. Mobile staging connection (prepared, NOT published)

- **What a development build will eventually know**, and nothing else:
  - `EXPO_PUBLIC_MOBILE_API_ORIGIN=https://<staging-domain>`;
  - for the sign-in slice, the staging Supabase URL and its **publishable** key, the only Supabase values a client
    may hold.
- **Never in Expo or EAS:** a secret key, a provider key, a project secret, `MOBILE_*` server variables.
  `npm run check:repo` and the bundle scan in CI (`scripts/check-bundle-secrets.mjs`) fail on server secret names, on
  `sb_secret_…` and on `sk-…` in the app or its exported bundle.
- **Why it stays disconnected in 25A-06:** `assistantForBuild` passes no session provider, so even with an origin the
  Assistant is `disconnected('session')`.
- **Gates before any build points at staging (later slices):**
  - Sign in with Apple and the session storage (decision 006);
  - the cloud consent screen (production-plan.md §5.7);
  - the literal `process.env.EXPO_PUBLIC_MOBILE_API_ORIGIN` read, verified in an exported bundle (production-plan.md
    §4.7). Today it is read through an `env` object, which Expo does not inline.
- **Nothing is set in EAS now.** When it is, the variables go in the EAS environment `development` only, visibility
  "plain text" (they are public), never `preview` or `production`.

## 14. Security audit phase (Phase B, before 25A-06 is done)

After B9, the owner asks Claude for:

1. **`/security_audit`**, focused on:
   - the actual Vercel variable scoping of both projects, from the owner's screenshots of names and scopes (never
     values) or the Vercel MCP read tools;
   - the real Supabase auth settings, RLS and grants (verify.sql's result and the boundary probe);
   - secret and key placement (Vercel, the owner's env files, EAS, GitHub);
   - the staging API's behavior (the probe and drill results);
   - the real provider boundary (project, key permissions, limits, `store: false`);
   - quota and cost behavior (the drills, the race, the reconciliation);
   - live logs (telemetry lines only);
   - the client bundle (the CI bundle scan of the merged commit).
2. **`/security_review`** on the final 25A-06 diff.

25A-06 is not marked done before both pass, with no open High or Medium finding.

## 15. Chat history (unchanged decision)

**One ephemeral current Assistant conversation:**
- «New chat» resets it;
- ReviewItems are durable independently, in the device's review store;
- the provider gets `store: false` and no `previous_response_id` or `conversation`, so no provider-side thread exists;
- Supabase has no `messages`, `threads` or `conversations` table.

verify.sql and `staging.test.js` fail if a chat-history table appears. Local history on the device, if ever wanted, is
a separate privacy and storage decision, not part of 25A.

## 16. Card network metadata (25A2, not here)

Unchanged. Optional card network metadata (Visa, Mastercard, Amex, Cabal, Other, Unspecified) gets its own reviewed
storage and backup migration **before** any Wallet mapping (roadmap «Producto 25A2», production-plan.md §7.3). Nothing
in 25A-06 touches the ledger schema (14), the backup format (v14) or the review store (1).
