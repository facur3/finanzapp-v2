# Decision 006: the cloud identity — Sign in with Apple for cloud features, never for the local core

Date: 2026-10-05. Status: **accepted**: recommended in Producto 25A-06 Phase A and accepted by the owner's merge of
PR #87 (merge commit ce4b4b3, 2026-10-05). It resolves the open «OWNER DECISION — the sign-in
method» of [production-plan.md](../production-plan.md) §12.2. Nothing in this decision is implemented. The staging
arrangement of 25A-06 is in [ai-staging-runbook.md](../ai-staging-runbook.md) §5.

## Context

What the product requires:
- **The local financial core works without an account, forever** ([decision 001](001-native-mobile.md), AGENTS rule 12).
  Manual entry is offline; nothing local waits for a server.
- **Cloud AI needs a server-verifiable identity.** The database's per-person money ceilings, rate windows and
  concurrency (production-plan.md §6) bound abuse only if one person cannot cheaply become many.
- **Pro and StoreKit (25F):** a subscription must attach to the same identity across the person's devices, verifiable
  on the server through the App Store Server API.
- **Multi-device (25E, optional):** the same identity on the person's iPhone and later iPad or Android.
- **Account deletion:** once accounts exist, App Review guideline 5.1.1(v) requires in-app deletion. For Sign in with
  Apple, that includes revoking the person's Apple tokens.
- **App Review guideline 4.8:** an app that offers a third-party or social login must also offer an equivalent
  privacy-preserving option. Sign in with Apple satisfies it.
- **Guideline 5.1.1(v):** an app must not require a login for features that do not need one.

Facts in the code today:
- the server refuses anonymous sessions (`server/mobile/runtime.js`);
- the database refuses anonymous owners (`server/mobile/schema.sql`);
- the app has no sign-in and no session storage.

## Options compared

| Option | Abuse resistance | Friction | StoreKit / multi-device | Deletion | Verdict |
| --- | --- | --- | --- | --- | --- |
| Supabase **anonymous** users | **None**: one request mints an identity, so per-person ceilings mean nothing | none | an anonymous user can be linked later, but the subscription would hang on a device-bound identity | trivial | **Rejected**, insufficient for abuse resistance; already refused by server and database |
| **E-mail** OTP / magic link / password | Weak: disposable addresses; needs e-mail confirmation and CAPTCHA | typing an address and switching to mail | portable | Supabase admin delete | Rejected for launch; needs a custom SMTP vendor and a CAPTCHA vendor (two more secrets and dashboards) |
| **Sign in with Apple** (native, `signInWithIdToken`) | Better: one identity per Apple Account, which Apple gates with its own verification; stable `sub` per developer team | one Face ID tap, in context | the same Apple Account on every Apple device; `appAccountToken` = the Supabase user id links App Store transactions | admin delete **plus** Apple token revocation (needs an Apple key server-side) | **Recommended** |
| Google or other social login | Like Apple's, outside iOS | one tap | portable, incl. Android | per provider | Later, Android only; guideline 4.8 is satisfied because Apple is offered |
| **App Attest** device attestation with no account | Strong per device, not per person | none | device-bound: no multi-device, no subscription portability | n/a | Not an identity. A possible **later complement** against automated abuse |
| StoreKit-only (subscription as identity) | Strongest: paying | purchase first | Apple-only; nothing before purchase (trial, staging) | n/a | Not an identity on its own; the Pro entitlement becomes an **additional gate** (25F) |

## Decision

1. **Sign in with Apple is the one cloud identity at launch.** It uses Supabase's native ID-token flow
   (`signInWithIdToken` with provider `apple` and a hashed nonce), from the Expo Apple Authentication module.
2. **Sign-in is requested only when the person turns on a cloud feature** (first, the Assistant's cloud mode, together
   with the cloud consent of production-plan.md §5.7). The manual local core never asks for it, never waits on it and
   never loses anything without it.
3. **No anonymous users, no e-mail or password sign-in and no social provider at launch.** Public sign-ups stay closed
   on every Supabase project, except through the Apple provider.
4. **The abuse boundary is layered:**
   - one Apple identity per Apple Account;
   - the per-person day and month money ceilings, rates and concurrency in the database;
   - the global breaker;
   - the provider's hard limit.

   When Pro exists (25F), cloud AI also requires the entitlement or trial the owner decides. App Attest is added only if
   staging or production shows automated abuse.
5. **For 25A-06 (staging), no product sign-in is built.** The owner creates two or three test people (e-mail and
   password) in the staging dashboard, with public sign-ups disabled. Only the staging probe uses them. They are never a
   product sign-in method.

### Why Sign in with Apple is not introduced in 25A-06

1. It needs the native module in a **new development build**, and 25A-06 makes no EAS build (AGENTS rule 3).
2. It needs **owner actions in the Apple Developer account**:
   - the Sign in with Apple capability on the bundle identifier `com.facur3.finanzapp.dev`;
   - a Services ID and key for the Supabase Apple provider and for token revocation.
3. Account deletion with Apple token revocation must ship **with** sign-in (guideline 5.1.1(v)).
4. It is the app's first secret on the device: the session goes in the Keychain (production-plan.md §4.6, §11.5) and
   deserves its own security review.

It is therefore a **slice of its own** (the session slice). It is scheduled after 25A-06 and before any build calls the
cloud Assistant (roadmap «Producto 25A»).

## Consequences

**For the session slice (later):**
- add Expo Apple Authentication;
- configure the Apple provider in each Supabase project (the bundle id as an authorized client id);
- store the session in the Keychain;
- refresh it;
- sign out;
- provide in-app **account deletion**:
  - a server route with its own narrowly scoped Supabase secret key (production-plan.md §4.6);
  - Apple's `/auth/revoke` with a client secret signed by the Apple key, server-side only;
  - deletion cascades the inbox and usage rows and keeps the reservations' charges unowned (`on delete set null`);
- the e-mail Apple relays (possibly a private relay address) is not used for anything in 25A.

**StoreKit (25F):**
- set `appAccountToken` to the Supabase user id at purchase;
- the server verifies transactions with the App Store Server API and mirrors the entitlement per user id;
- App Store Server Notifications keep it current;
- a person who later deletes the account keeps the subscription with Apple (Apple's rule), and the entitlement mirror
  row goes with the account.

**Migration:**
- no ledger, backup or review-store change: the identity never touches the local data;
- a later second provider (Google, for Android) links to the same Supabase user through identity linking, never by
  matching e-mails;
- the staging test people are deleted when the session slice reaches staging.

**Staging and production:** each Supabase project has its own Apple provider configuration and its own users. A staging
identity never grants anything in production (production-plan.md §2.3, rule 4).

**What would reopen this:**
- Apple's policy on Sign in with Apple changes;
- Android launches (adds a provider; it does not replace Apple);
- staging or production evidence of multi-account abuse that ceilings and the entitlement do not contain (App Attest).
