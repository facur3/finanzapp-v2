# Merchant identity, brand marks and recurring payment history

Producto 24UX2 · 2026-09-25. Status: the identity layer is implemented and tested on Linux as
typed metadata. **Owner's decision (review of PR #56): categories and their glyphs are the
production presentation; showing brands is deferred to Producto 25C2.** No logo API is connected,
no brand logo or asset is bundled, no user upload exists and no provider key is in the app.
Nothing here is device-verified.

## 1. Merchant, category and recurrence are three different things

| Concept | Example | Where it lives | Who decides |
| --- | --- | --- | --- |
| Merchant: who was paid | Netflix | `Entry.merchant`, `RecurringRule.merchant` (free text, stored verbatim) | The person types it |
| Category: what it was for | Ocio, Suscripciones | `Entry.category` (free text grouped by `categoryKey`), category identities | The person chooses it |
| Recurrence: how often it repeats | Mensual | `RecurringRule.frequency` | The person creates the rule |
| Brand: a recognized merchant | `netflix` → Netflix, netflix.com | `packages/domain/merchants.ts` (code, not data) | The curated catalogue |
| Logo: a picture of the brand | none (deferred to 25C2) | nothing in the app | The owner, after §4 |

The category stays the financial classification: reports, budgets and the Assistant group by it,
and every row keeps the category name in its caption; the leading tile is the category glyph.
Exception (Producto 24UX5): Inicio's two short lists caption the date alone and bring the category
back only when the name and the glyph do not say it (a name of one or two characters, with no letter or
generic, or a glyph another category on screen also draws); VoiceOver, the detail, the filters and the
search always keep it (docs/mobile-design.md, Producto 24UX5). Nothing in this delivery changes a
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
- **Brands whose bare name is a common word** (review of PR #56): the merchant field also takes a
  free description, so "Apple" may be fruit, "Steam" a sauna or a laundry, "Adobe" a building
  material and "Despegar" a verb. The bare words are in `AMBIGUOUS_MERCHANT_WORDS` and stay
  unrecognized; the brands keep only qualified aliases (`apple com`, `icloud`, `apple music`,
  `apple tv`, `app store`; `steampowered`, `steampowered com`, `steam games`; `adobe com`,
  `adobe creative cloud`; `despegar com`). The other bare aliases were reviewed and kept because,
  as a payee name, they name one company and are not an ordinary Spanish or English word:
  netflix, spotify, dropbox, duolingo, playstation, xbox, uber, cabify, rappi, pedidosya, ypf,
  axion, edenor, edesur, metrogas, aysa, movistar, starbucks, mcdonalds, carrefour, farmacity,
  chatgpt, openai, icloud, mercadolibre, mercadopago, hbomax, disneyplus, ubereats. No brand
  was added.

Criteria for adding a brand (each addition is a reviewed PR with tests): the alias names one
payee and is not an ordinary word in Spanish or English; the domain is the brand's own; the brand
is common enough in the released regions to matter; no category or price is attached.

## 3. What a row draws (`apps/mobile/src/ui/merchant-mark.ts`, `MerchantBadge`)

The category glyph, for every merchant, recognized or not: it is the production presentation, not
a fallback waiting for logos. `MerchantBadge` sits where rows used to call `CategoryBadge`
(movement rows, the movement detail, Recurrentes and Inicio's upcoming commitments) so a future
delivery changes one component, not every screen.

A development bundle started with `EXPO_PUBLIC_MERCHANT_MARK_PREVIEW=1` draws a recognized
brand's initial on a neutral tile, only to check on the iPhone which typed names the catalogue
recognizes (for example that "Apple" is not recognized and "App Store" is). It uses no asset,
image or dependency, is hidden from VoiceOver, and `__DEV__` false (release, preview) never draws
it. There is no image path, provider interface, bundled brand asset or upload anywhere in the app;
`tests/merchant-mark.node.ts` fails if one appears.

## 4. Brand marks: deferred to Producto 25C2

**Decision (2026-09-25, review of PR #56):** no brand is shown in this stage. Activating brand
marks is Producto 25C2 and needs, before any code: the **licence** (each brand's terms, or a
provider's, for showing its mark to identify a payee), **privacy** (nothing about a person's
merchants leaves the device without consent; no key in the bundle), **maintenance** (who keeps
marks current when brands change them, how a wrong mark is corrected) and **visual coherence**
(multicoloured marks beside the muted category hues and the semantic colours; both themes;
Reduce Transparency). Not allowed until then: bundled logos or brand assets, user uploads, keys
of Logo.dev, Brandfetch or any other provider in the app, any logo request.

The review below is the input for that decision. Checked 2026-09-25 from the providers' public pages; terms change, so the decision must re-read
them. No account was created, no key requested, no request made.

| Option | Coverage | Licence and terms | Attribution | Cache | Cost | Key / privacy |
| --- | --- | --- | --- | --- | --- | --- |
| Clearbit Logo API | — | Shut down on 2025-12-08 (deprecated 2025-03-18) | — | — | — | Not an option |
| Logo.dev | Claims 50M+ companies, by domain | Hotlink its CDN (`img.logo.dev`) with a publishable key | Free plan: commercial use needs a visible "Logos provided by Logo.dev" link; paid plans remove it | Their CDN; storing copies to be checked in the terms | Free tier 500K requests/month; about USD 50/month to remove attribution | The key travels in every image URL from the device; each request tells the provider which merchant the person pays, from their IP |
| Brandfetch Logo API | Large, by domain | Logos must be hotlinked in the app; programmatic access and caching need a custom agreement; cannot replicate Brandfetch | Their guidelines page says none is required (third-party pages disagree: confirm in writing) | Not allowed without a custom setup | Free up to about 1M requests/month (docs), rate limits per IP | Client id in every URL; same privacy leak as above |
| Bundled, curated marks | Only the catalogue (35 brands) | Each brand's own guidelines; nominative use of a trademark to identify the payee; some brands forbid altering or recolouring | Per brand | In the bundle, versioned | Design time; no running cost | No key, no request, nothing leaves the device |
| Server-side fetch through `api/mobile` | As the provider | Must be allowed by the provider (Brandfetch: not without an agreement) | As the provider | Server cache with a TTL, served to the app | Provider cost plus hosting | No key in the bundle; the server learns the brand id (not the typed name) only if the person has cloud features on |

Observations for 25C2: any hotlinking provider would send each person's merchant list to a third
party and put a key in the bundle, which the repository rules forbid (AGENTS rules 6 and 12);
bundled marks avoid both but carry the licence and maintenance cost of every brand. Whatever is
chosen must show marks for recognized brands only (an unrecognized typed name is never sent
anywhere) and fall back to the category glyph on any failure.

Before any source: the owner's decision and account; the terms re-read; a privacy note in the
app naming what travels (if anything); the attribution placed where the terms require; a cache
policy (on-device file cache keyed by brand id and scheme, a TTL, no refetch loop on failure);
a switch to turn it off; the App Store privacy answers updated.

## 5. Recurring rules: scheduled is not paid

Today (unchanged by 24UX2; audited and pinned by `tests/recurring-audit.node.ts` in 24UX5): a rule posts one normal movement when its date arrives
(`catchUpRecurring` through `processRecurring`, on launch, when the app returns to the foreground and after a rule or a restore is saved; never while the app is closed: a date passed meanwhile is recorded on the next open, dated on its due day), with a deterministic id
`rec_<ruleId>_<yyyymmdd>`; a retry, a restore or a second device session can never post it twice
(an occurrence whose id is already in the ledger counts as recorded, even if the person edited or undid
it). The rule then advances its next date. Pausing stops the postings. A rule the catch-up cannot record
because of a real failure is left unchanged, never blocks the other rules, Recurrentes or the opening of
the data, and reads «Revisar» in Recurrentes until the person continues it from today. A long backlog is
not a failure: it is recorded automatically in durable batches of at most 366 dates, each with its original
date and id, resuming after an interruption without duplicates (24UX5 review). «Recorded by
FinanzApp» is never «paid by the bank»: the app executes and confirms no payment.

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

### Recurring rules stay automatic (owner's decision, review of PR #59)

A rule records its movement on its date, expenses and incomes alike; if the app was closed, on the
next launch or return to the foreground, dated on the due day. The person manages a rule by pausing,
resuming or deleting it, and edits a recorded movement like any other (a changed bill amount is an
edit of that movement). An earlier exploratory design (an «expected» occurrence the person confirms,
skips or links, and a per-rule «Esperar confirmación» mode) is **not approved** and not on the
roadmap. Reviewing drafts before they are written is the Assistant's workflow for captures, a separate
thing.

## 6. Related roadmap items

Local categorisation rules (a merchant key pre-fills a category the person chose before, only
pre-fills, never rewrites), suggested recurring detection (the same merchant key, account and
amount repeating at a regular interval proposes a rule; never creates one), the commitments calendar
(read from the rules and what they recorded), widgets of upcoming payments (25D, amounts hidden by default) and
the brand-mark decision. See docs/mobile-roadmap.md §3 (Producto 25C2).
