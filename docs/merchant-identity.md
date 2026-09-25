# Merchant identity, logos and recurring payment history

Producto 24UX2 · 2026-09-25. Status: the identity layer and the logo adapter are implemented and
tested on Linux; **no logo provider is connected** and no logo ships in the bundle, so every row
still draws its category glyph in production. Nothing here is device-verified.

## 1. Merchant, category and recurrence are three different things

| Concept | Example | Where it lives | Who decides |
| --- | --- | --- | --- |
| Merchant: who was paid | Netflix | `Entry.merchant`, `RecurringRule.merchant` (free text, stored verbatim) | The person types it |
| Category: what it was for | Ocio, Suscripciones | `Entry.category` (free text grouped by `categoryKey`), category identities | The person chooses it |
| Recurrence: how often it repeats | Mensual | `RecurringRule.frequency` | The person creates the rule |
| Brand: a recognized merchant | `netflix` → Netflix, netflix.com | `packages/domain/merchants.ts` (code, not data) | The curated catalogue |
| Logo: a picture of the brand | none yet | a `MerchantLogoProvider` (`apps/mobile/src/ui/merchant-mark.ts`) | A future, reviewed provider |

The category stays the financial classification: reports, budgets and the Assistant group by it,
and every row keeps the category name in its caption. The merchant mark only replaces the
*picture* in the leading tile, never the category as data. Nothing in this delivery changes a
stored movement, a rule, SQLite or a backup.

## 2. The identity layer (`packages/domain/merchants.ts`)

- `merchantKey(name)`: NFKD, accents removed, lowercase, `+` read as "plus", apostrophes dropped,
  every other run of non-alphanumeric characters one space. "Disney+" and "Disney Plus" meet at
  `disney plus`; "McDonald's" is `mcdonalds`; "Netflix.com" is `netflix com`. The typed name is
  never rewritten: screens always show `entry.merchant` as written.
- `MERCHANT_CATALOG`: 35 brands common in Argentina and the United States (streaming, software,
  games, marketplaces, mobility and delivery, fuel, utilities, telecom, retail). Each brand has an
  id, its own spelling, the normalized aliases that name it, and its primary domain (the key a
  logo provider would be asked for; never a link the app opens). **No category**: suggesting a
  category from a merchant is a separate feature (§6).
- `resolveMerchant(name)`: an **exact** lookup of the normalized name in the alias index. There
  is no substring, prefix, token, fuzzy or edit-distance match. "Pago Netflix", "Netflix y
  Spotify", "Netflixx", "Uber a Palermo" and "Supermercado Carrefour Express" stay
  unrecognized. A miss costs nothing (the category glyph); a wrong brand would be a false fact.
- `validateMerchantCatalog` refuses: an alias shared by two brands, an alias that is not already
  normalized, an alias in `AMBIGUOUS_MERCHANT_WORDS`, repeated or malformed ids, a domain that is
  not a bare host. Sibling brands are separate entries (Uber / Uber Eats, Mercado Libre / Mercado
  Pago), never one alias of another.
- **Deliberately left out** because the payee name is an ordinary word or ambiguous: Personal,
  Claro, Día, Coto, Disco, Vea, Jumbo, Shell, Max, and the bare umbrella names Amazon, Google and
  Microsoft (a charge from "Amazon" may be retail, Prime or AWS). Their specific products are in
  when the product name is unambiguous (Prime Video, Google One, Microsoft 365).

Criteria for adding a brand (each addition is a reviewed PR with tests): the alias names one
payee and is not an ordinary word in Spanish or English; the domain is the brand's own; the brand
is common enough in the released regions to matter; no category or price is attached.

## 3. The mark a row draws (`apps/mobile/src/ui/merchant-mark.ts`, `MerchantBadge`)

Order, fixed: a licensed logo from the build's provider → the category glyph. An unrecognized
name, a provider with nothing, a provider that throws, a source that is not `https://` or a
bundled asset, and a logo that fails to load (remembered, never retried in a loop) all give the
category glyph. The logo tile has the category tile's size (40 pt, 56 pt in a detail), a white
ground with a hairline edge in both themes, and is hidden from VoiceOver: the row's sentence
already names merchant and category.

`BUILD_LOGO_PROVIDER` is `NO_LOGOS`. A development bundle started with
`EXPO_PUBLIC_MERCHANT_MARK_PREVIEW=1` draws the brand's initial on a neutral tile for recognized
names, only to judge on the iPhone which rows are recognized and how the tile sits; `__DEV__`
false (release, preview) never draws it. It is not a logo and never ships.

Where it appears: movement rows (Inicio, Movimientos, account, card and category details, the
recurring history), the movement detail (large), Recurrentes rows and Inicio's upcoming
commitments.

## 4. Logo providers: review before connecting anything

Checked 2026-09-25 from the providers' public pages; terms change, so the decision must re-read
them. No account was created, no key requested, no request made.

| Option | Coverage | Licence and terms | Attribution | Cache | Cost | Key / privacy |
| --- | --- | --- | --- | --- | --- | --- |
| Clearbit Logo API | — | Shut down on 2025-12-08 (deprecated 2025-03-18) | — | — | — | Not an option |
| Logo.dev | Claims 50M+ companies, by domain | Hotlink its CDN (`img.logo.dev`) with a publishable key | Free plan: commercial use needs a visible "Logos provided by Logo.dev" link; paid plans remove it | Their CDN; storing copies to be checked in the terms | Free tier 500K requests/month; about USD 50/month to remove attribution | The key travels in every image URL from the device; each request tells the provider which merchant the person pays, from their IP |
| Brandfetch Logo API | Large, by domain | Logos must be hotlinked in the app; programmatic access and caching need a custom agreement; cannot replicate Brandfetch | Their guidelines page says none is required (third-party pages disagree: confirm in writing) | Not allowed without a custom setup | Free up to about 1M requests/month (docs), rate limits per IP | Client id in every URL; same privacy leak as above |
| Bundled, curated marks | Only the catalogue (35 brands) | Each brand's own guidelines; nominative use of a trademark to identify the payee; some brands forbid altering or recolouring | Per brand | In the bundle, versioned | Design time; no running cost | No key, no request, nothing leaves the device |
| Server-side fetch through `api/mobile` | As the provider | Must be allowed by the provider (Brandfetch: not without an agreement) | As the provider | Server cache with a TTL, served to the app | Provider cost plus hosting | No key in the bundle; the server learns the brand id (not the typed name) only if the person has cloud features on |

**Recommendation for the owner's decision (not taken here):** start with bundled, curated marks
for the catalogue only, after a per-brand licence check, because it needs no key, sends nothing
and matches the "recognized brands only" rule; keep the provider adapter for a later, opt-in
server-side option if coverage beyond the catalogue proves valuable. Any hotlinking provider
would send each person's merchant list to a third party and put a key in the bundle, which the
repository rules forbid (AGENTS rules 6 and 12). The adapter already enforces the parts that do
not depend on the choice: `https` or bundled sources only, recognized brands only (an
unrecognized typed name is never sent anywhere), a failure falls back to the category glyph.

Before any provider: the owner's decision and account; the terms re-read; a privacy note in the
app naming what travels (if anything); the attribution placed where the terms require; a cache
policy (on-device file cache keyed by brand id and scheme, a TTL, no refetch loop on failure);
a switch to turn it off; the App Store privacy answers updated.

## 5. Recurring rules: scheduled is not paid

Today (unchanged by 24UX2): a rule posts one normal movement when its date arrives
(`processRecurring`, on launch, when the app returns to the foreground and after a rule or a restore is saved), with a deterministic id
`rec_<ruleId>_<yyyymmdd>`; a retry, a restore or a second device session can never post it twice
(the storage refuses a different movement with the same id). The rule then advances its next
date. Pausing stops the postings.

How the screens now tell the states apart:

| State | Where | How it reads |
| --- | --- | --- |
| Next payment, estimated | Inicio (Próximos compromisos), Recurrentes | Amount with "Hoy", "Mañana", "En 3 días" or the date beside it; the date appears once. Nothing is recorded. |
| Payment recorded | Movimientos, the rule's detail (Registrados), the movement detail | A normal movement. The rule's detail lists the movements the rule recorded (newest first, twelve, then a count), read from the ledger by id; the movement detail links back to its rule ("Recurrente · Mensual"). |
| Paused rule | Recurrentes (Pausados) | Full-contrast ink (it used to be drawn at 60 % opacity), "Pausado" instead of a due day, VoiceOver says "pausado" and no next date. |
| Payment history | The rule's detail | Only movements in the ledger; a movement the person moved to another day or edited still belongs to its rule; an undone one is not listed; a typed movement with the same merchant is **not** claimed. |

What is *not* done, on purpose: no movement is created, merged or deduplicated by presenting or
scheduling a commitment; no guess links a typed "Netflix" movement to the Netflix rule; no
connection to Netflix, Spotify or a bank exists or is implied.

### Future: history and reconciliation (roadmap, not built)

The current model registers on the due date, which is right for fixed debits and wrong when the
amount or the day varies (a utility bill, a card statement). A later delivery should let a rule
be **expected** instead of **auto-registered**:

1. An expected occurrence is a local record `(ruleId, dueDateISO, status)` with status
   `expected → paid | skipped | late`, never a movement. It carries no amount in reports.
2. **Paid** is a link from the occurrence to one real movement: either the person confirms "Lo
   pagué" (which creates the movement with the rule's defaults, editable, one write, operation
   id), or picks an existing movement from suggestions. Suggestions come from the same account
   and currency, a merchant key equal to the rule's, and a date window around the due date; they
   are proposals, confirmed by the person, never applied silently. A movement links to at most
   one occurrence.
3. **Skipped** keeps the history honest (a paused month, a cancelled delivery). **Late** is a
   display state for an expected occurrence past its date; reminders (25D) never claim a bank did
   not receive a payment.
4. The history of a rule is then its occurrences with their state and linked movement; a calendar
   of commitments (per month, per day, per currency, never summed across currencies) is built on
   the same records.
5. Schema and backup version bump, migration with rollback tests; existing auto-registered
   movements become `paid` occurrences by their deterministic id; sync (25E) carries occurrences
   with operation ids and tombstones.

## 6. Related roadmap items

Local categorisation rules (a merchant key pre-fills a category the person chose before, only
pre-fills, never rewrites), suggested recurring detection (the same merchant key, account and
amount repeating at a regular interval proposes a rule; never creates one), the payment history
and commitments calendar above, widgets of upcoming payments (25D, amounts hidden by default) and
the logo provider decision. See docs/mobile-roadmap.md §3.
