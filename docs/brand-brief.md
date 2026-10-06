# Brand identity brief: the public name and the original visual identity

**Status.** A discovery document, written on 2026-10-02 in Producto 25DISC1. **Nothing in it is implemented and nothing
in it is chosen.** No name is selected, no palette changes in code, no icon or artwork is produced, no domain, handle or
trademark is registered, and the repository, bundle identifier and release marker keep the working name. It defines
the criteria, the workflow and the exploration brief that the brand, naming and identity gate of
[app-store-launch.md §9.4](app-store-launch.md#94-brand-naming-and-identity-gate) needs before Producto 26 commits any
public asset. The labels are those of [production-plan.md](production-plan.md) («Labels»).

- **Binding (owner, 2026-10-02, PR #81 and this brief): «FinanzApp» is an internal working name only.** The public
  product requires a different, original name. Every «FinanzApp» in the repository, the version line, the Expo slug,
  the URL schemes and the development build names means the working name; none of them has to change until the
  public name exists (launch §9.4: a repository or an identifier does not have to carry the public name).
- The competitive context (who the product is compared with, which visual territories are crowded) is in
  [competitive-landscape.md](competitive-landscape.md) §10. Nothing there is copied: the landscape says what to stay
  away from, never what to borrow.
- How the identity is carried into social channels, video and the launch sequence is
  [go-to-market.md](go-to-market.md) §3–§6 and §10; handles are chosen only after the naming workflow (§3, steps F and H).
- Sequencing: this work belongs to **Producto 26** (the definitive identity), before any public metadata, landing page
  or marketing asset, and after 25F only if the owner keeps that order ([production-plan.md §13](production-plan.md#13-roadmap-mapping):
  25F's sandbox purchases need the app record, so the identity decision may be needed before 25F's sandbox gate). The
  owner may run the naming workflow (§3) earlier, in parallel with 25A–25E, because it needs no code; the visual
  exploration (§4) may also run early as design work, but **no palette or icon change lands in the app before step C
  of launch §9.4 (the owner's selection)**.

## 1. What the brand must do

The product it names ([decision 002](decisions/002-spending-first.md), [decision 005](decisions/005-forest-four-tabs-and-capture.md),
roadmap «Destination»): an iOS-first app for recording spending in seconds, understanding it, and seeing what is
coming (cards, cuotas, recurring payments, debts), with an Assistant that proposes and never writes on its own, a
local ledger that works without an account, and several currencies kept apart until a view converts them. Argentina
first; Spanish-speaking Latin America, the United States and Spain as later storefronts (launch §10.1).

Requirements the owner set (2026-10-02), each with what it means in practice:

| Requirement | What it means for the name and the identity |
| --- | --- |
| Premium | Restraint: few colours, generous space, exact typography, no decoration that does not carry meaning; the quality of a well-made instrument, not of a promotion. |
| Calm | Nothing shouts. No urgency devices, no red for ordinary spending (the semantic rule of decision 005 and 24UX6C stands in every territory), no countdowns, no confetti. Motion follows `docs/mobile-design.md` and `src/ui/motion.tsx`. |
| Trustworthy | Honest numbers, legible at every size, consistent light and dark, a name that does not promise what the app does not do (it is not a bank, it does not move money, it does not predict). |
| Modern | Current iOS material and typography, an icon that belongs on an iOS 26 Home Screen, no skeuomorphic coins, wallets, safes or piggy banks. |
| Distinctly iOS | Native navigation, SF Pro with tabular figures for every amount, system materials where decision 005 allows glass (controls only), widgets and Live Activities that look at home on the Lock Screen and in the Dynamic Island. |
| Understandable without feeling like a bank | The name and the symbol should say «my money, in order» in a personal register; never a vault, a shield, a column, a serif bank wordmark, a navy-and-gold scheme. |
| Works in Argentina and LatAm, pronounceable internationally | Spanish-first pronunciation that an English, Portuguese or Italian speaker reads the same way; no Rioplatense slang that does not travel; no Anglicism that reads awkwardly in Spanish. |
| Can expand beyond expense tracking | Not anchored in «gastos», «spend», «budget» or «cuotas»; it must still fit when goals, calendars, shared groups or (post-launch) net worth exist. |
| Not a crypto or trading aesthetic | No neon gradients on black, no candlesticks, no hexagons, no «to the moon» register, no glow. |
| Not childish | No mascot, no diminutives, no rounded-bubble typography, no primary-colour palette, no cartoon illustrations. |
| Not visually derivative | Not recognisably close to Kesef, MonAi, Revolut, Monzo, Wise, Copilot Money or Apple's own apps, by name, icon, palette, composition or wordmark (§5). |

## 2. Naming criteria

The criteria are the test every candidate passes before the shortlist. They decide nothing here. **No name is proposed
in this document on purpose** (owner's instruction): the ideation of §3 starts from a blank page, so that no early
candidate anchors the owner.

| # | Criterion | Pass condition |
| --- | --- | --- |
| N1 | Original | A coined word or an ordinary word used in a new sense; never a generic descriptor used as the whole name («Finanzas», «Gastos», «Money», «Cash», «Budget», «Wallet», «Pay», «Coin», «Bank» or their compounds). The working name fails this criterion, which is one reason it is not the public name. |
| N2 | Short | Two or three syllables; eight letters or fewer preferred; always within the App Store name field (launch §9.2) with room for nothing else, since the subtitle carries the descriptor. |
| N3 | One pronunciation | Read the same way by a Spanish, English and Portuguese speaker. Avoid letters whose sound differs between them (j, g before e/i, ll, y, z, h, w, ñ, final -tion/-ción), consonant clusters at the end, and vowels that English reduces. Open vowels (a, e, o) travel best. |
| N4 | One spelling | After hearing it once, there is one obvious way to type it in Spanish and in English (no double letters that could be single, no k/c or b/v ambiguity, no silent letters). |
| N5 | Clean meaning | No negative, vulgar, medical or slang reading in Rioplatense Spanish (including lunfardo), Mexican and Peninsular Spanish, Brazilian Portuguese, English and Italian; no religious or political load; no existing well-known product, person or place with that name. |
| N6 | Personal register | It should sound like something a person says about their own money, not an institution's name: no «Banco», «Capital», «Trust», «Fund», «Pay» connotation; no bank-like gravitas. |
| N7 | Not a diminutive, not a mascot | No «-ito/-ita», no pet names, no onomatopoeia. |
| N8 | Expandable | Still right if the app one day shows goals, calendars, shared groups or net worth; not tied to one feature or one country. |
| N9 | Distinct from the field | Phonetically and visually far from the apps a person in the target markets already knows: Kesef, MonAi, Copilot, Monarch, YNAB, Wallet (BudgetBakers), Revolut, Monzo, Wise, Ualá, Mercado Pago, Brubank, Naranja X, Lemon, Belo, Modo, Personal Pay, Cuenta DNI, Fintonic, Mobills, Cocos; and from Apple's own names (nothing with Pay, Wallet, Cash or an «i» prefix). The list is extended by the App Store search of §3, step C. |
| N10 | Available | The App Store name field free in the Argentina and United States storefronts at least (and the subtitle free of conflicts); a `.com` or `.app` domain and the `.com.ar` or `.ar` equivalent obtainable; the handles the owner cares about (Instagram, X, TikTok, YouTube, GitHub if public) free or acquirable; no identical or confusingly similar mark in the relevant classes (software, financial services, SaaS) in Argentina, the United States and the European Union (§3, steps D–F). |
| N11 | A wordmark can be drawn | Letterforms balance in a single word (no awkward pairs such as «rn» that read as «m», no descender collisions), and the word works in all-lowercase and in title case; a one- or two-letter monogram is possible but not required for the icon. |
| N12 | Works in a sentence | «Registralo en ___», «Record it in ___», «___ Pro», «___ para iPhone» all read naturally; it does not need an article or a gender in Spanish. |

Scoring for the shortlist: each criterion pass/fail; a fail on N1, N5, N9 or N10 eliminates; among the rest the owner
chooses, and the record says why.

## 3. Naming workflow

**OWNER DECISION** at every selection; the rest can be prepared by an agent or a designer. Nothing in the repository is
renamed before step I. Each step produces a written record; the record is kept with the gate (a future
`docs/brand-naming-log.md`, created when the workflow starts, never in this document).

| Step | Name | Description | Output | Gate |
| --- | --- | --- | --- | --- |
| A | Broad ideation | At least 100 candidates across several routes: coined words; Spanish and Latin roots about order, clarity, calm, rhythm and the everyday (never about wealth, growth or banking); words for light, paper, notebooks, pockets and days; short invented words with open vowels; a few bilingual words that are identical in Spanish and English. Each with its route and a one-line rationale. No candidate is checked yet. | The long list | None |
| B | First cut and shortlist | N1–N9 applied to the long list; at most 12 survive, each with its pronunciation written in Spanish and English, its best and worst reading (N5) and a quick note on how a wordmark could look (N11). | The shortlist | The owner removes anything they dislike before the checks, so no effort goes into a name they would never choose |
| C | App Store search | For each shortlist name: the Argentina and the United States storefronts (and Mexico, Spain, Brazil if cheap), searched as the exact word and as its obvious misspellings; any app with the same or a close name is recorded with its category, developer and whether it is finance. A finance app with a close name eliminates the candidate; a non-finance app with the exact name is an owner call. | A table per name | Eliminations |
| D | Web search | The exact word and the word plus «app», «finanzas», «finance»: companies, products, trademarks in the news, domains in use, negative meanings found. | Notes per name | Eliminations |
| E | Domain search | `.com`, `.app`, `.com.ar`, `.ar` and the owner's preferred extra extensions; whether registered, parked for sale (price), or free. **No purchase yet.** | Availability per name | Prices for the owner |
| F | Handles | The social handles the owner wants; free, taken by an inactive account, or taken by an active brand. | Availability per name | — |
| G | Trademark and confusing-similarity screening | Identical and similar marks in classes 9 (software), 36 (financial services) and 42 (SaaS) in Argentina (INPI), the United States (USPTO), the European Union (EUIPO) and WIPO's Global Brand Database; phonetic similarity, not only spelling. A hit in a finance class is a probable conflict; a professional opinion is obtained before the final choice when anything is close (launch §9.4 «Screening»). Apple's App Review guideline 5.2 (intellectual property) binds the listing. | A screening memo per surviving name | **OWNER ACTION** to engage a professional when warranted |
| H | Owner selection | The owner picks one name (and a fallback) from what survived A–G, with the record of why. | The decision, recorded in a decision document (`docs/decisions/006-public-name-and-identity.md` when it exists) | **OWNER DECISION** |
| I | Only then: product and repository rename | The App Store name per localization, the domain purchase and its public email aliases (launch §13.1), the handles, the trademark filing where the owner decides, the landing page; and in the code only what must carry the public name (display name, scheme, store metadata; the bundle identifier is its own release decision, launch §11.3, AGENTS rule 3). The internal working name may live on in the repository and the release marker. | A focused delivery in 26 | AGENTS rule 3 |

Rules across the steps: no candidate is tested with real users under the working name; no domain, handle or mark is
bought «just in case» before H; the screening is repeated once, right before I, because availability changes.

## 4. Visual exploration brief

For Claude Design or any other design process. The deliverable is a comparison the owner can decide from (launch §9.4,
steps A–C), not a finished system; the chosen territory is then developed into tokens, artwork and screens in 26.

### 4.1 What is being designed

The identity of an iOS personal-finance app whose product is already built and whose composition is frozen: four
icon-only tabs and a separate «+» in a floating dock, Inicio as a financial field with the month's number, Movimientos,
Reportes with a donut and a day-by-day view, Tarjetas as a stacked deck with flat facts, Más as grouped lists, a capture
hub, review cards for drafts, and later a Dynamic Island / Live Activity, widgets and a landing page (decision 005;
production-plan §7, §8, §10, §11; launch §14). The exploration changes the identity (name direction, symbol,
wordmark, icon, palette, typography, materials), **not the composition, the navigation, the copy or the financial
semantics**.

### 4.2 Territories

**At least three, preferably four, genuinely distinct identity territories.** A territory is a different idea of what
the brand is, with its own symbol, palette family, typographic voice and material; **colour variants of one idea do not
count as territories**. The existing Forest identity (a pine brand in the 158–168° hue window, mineral grey-green ground,
true-black dark mode, a sage-mint accent on the «+»; decision 005, `src/ui/palette.ts`) **may appear as one evolved
option**; every other territory is allowed to depart substantially from green, and at least two must. Territories are
proposed by the design process; the seeds below only show the kind of distance expected between them and bind nothing:

| Seed (an example of distance, not a request) | Idea | Where it could go wrong |
| --- | --- | --- |
| Forest, evolved | The pine brand kept, given a symbol, a wordmark and a sharper material story; the icon the brand never had. | Reads as «another green finance app» if the symbol is weak (the landscape notes green is crowded). |
| Paper and ink | A warm, tactile ledger: paper-toned surfaces, ink text, an accent as a single pen colour; editorial typography on the marketing side, SF Pro inside. | Skews nostalgic or «notebook app» if the paper is literal. |
| Graphite instrument | Near-monochrome, one luminous accent used only for the brand mark and the primary action; the precision of a measuring tool. | Slides into the crypto/trading look if the accent glows or the black is pure on light surfaces. |
| Warm mineral | Clay, sand and terracotta neutrals with one deep accent; Latin warmth without folklore. | Reads as lifestyle or food rather than money if the neutrals are too saturated. |
| Ink only | A monochrome brand where the only colours on screen are the semantic ones (income, transfer, warning, negative); the identity carried by the symbol and the type. | Cold or unfinished if the symbol does not carry it. |

### 4.3 What each territory must deliver

For every territory, the same set, so they can be compared side by side:

1. **Public-name direction** (not a name): the register the territory implies (a coined word, a plain word, a Latin
   root), its length and sound, how it would sit as a wordmark; with the criteria of §2 in view.
2. **Positioning** in one sentence and the tone of voice in three adjectives, with an example of a notification
   line and of the empty state of Inicio in that voice (Spanish first, English second).
3. **Symbol**: an original mark, meaningful at 1024 pt and still readable at 29 pt; no currency sign as the whole
   idea (a «$» names many things and is generic), no coin, bill, wallet, pig, safe, chart arrow or bank column.
4. **Wordmark**: the name direction set in the territory's typeface, in one colour; lowercase and title-case tests.
5. **App icon**: light, dark and tinted variants (iOS 18 and later let the person tint icons; the mark must survive
   tinting), the 1024 master with no transparency and no text, and how it reads among typical neighbours on a Home
   Screen.
6. **Full palette**: canvas, surface, inset, elevated, ink levels (primary, secondary, tertiary), line, brand text and
   brand fill with their «on» colours, a soft brand tint, the hero field, the dock and its active capsule, the accent of
   the «+», a scrim; light and dark, with the dark canvas true black unless the territory argues otherwise; every text
   pair at 4.5:1 or more and large text at 3:1 or more (these are checked by `tests/theme.node.ts` once tokens land).
7. **Typography**: SF Pro (and SF Rounded or New York only if argued) inside the app with tabular figures for every
   amount; an optional brand typeface for the wordmark and marketing only, with its licence for app embedding stated
   if it is ever to appear in the app. The type scale of `src/ui/theme.ts` is not redesigned.
8. **Surfaces and material**: solid rows, cards, balances and charts; glass only as a control layer (dock, «+», hub,
   compact controls, menus, composer) as decision 005 fixes; shadows, radii and borders per territory.
9. **Semantic finance colours**: income (positive), transfer (restrained, distinct from the brand), the negative tone
   (destructive, overdue, over a limit), warning; an ordinary expense is ink without a sign. The category hue family
   (`src/ui/category-color.ts`) stays a separate family and is not restyled; the territory shows the brand beside it.
10. **Inicio (Home)**: the financial field with the month's number, its scope chip, the upcoming commitments and the
    recent activity; light and dark.
11. **Reportes (Reports)**: the period, the donut with the total in its centre, the category rows and the six-month
    bars; the chosen-category state.
12. **Tarjetas (Cards)**: the deck with one card in front, the card face (name, issuer, last digits, «Saldo
    pendiente», never «Deuda»), the flat snapshot.
13. **Más (More)**: grouped lists, small-caps group labels, the version line.
14. **Capture and review card**: the «+» and the capture hub; a review draft card with Confirmar / Editar / Descartar,
    including an incomplete draft that asks for what is missing.
15. **Dynamic Island / Live Activity**: compact leading and trailing, minimal, expanded, and the Lock Screen
    presentation of a Wallet capture awaiting confirmation (production-plan §8), with amounts hidden on the Lock Screen
    by default (§11 there) and the system's background, not a brand-coloured island.
16. **Widget**: a small and a medium Home Screen widget (the month's spending, the next commitments) and a Lock Screen
    accessory, amounts hidden by default, legible in the system's tinted and clear widget modes.
17. **Landing-page hero**: the public name direction, one sentence, one device frame, the download call to action;
    light and dark; what it looks like on a phone.
18. **App Store screenshots**: a set of five for the first market, with fictional data clearly marked, in the
    territory's voice (launch §9.2), plus how the set would localise.

Everything is produced on **fictional data** (never a real ledger, AGENTS rule 6), in Spanish first, with the
composition the app already has.

### 4.4 Constraints that bind every territory

- **Originality** (launch §9.4): no element recognisably taken from the apps in §5 or from Apple's apps; common
  platform patterns (rounded groups, a bottom dock, a donut chart) are not anyone's property and are not by
  themselves a reason to differ.
- **Meaning never rides on colour alone**; red never means «spent» (decision 005, amended by 24UX6C).
- **Accessibility**: contrast as in 4.3 item 6; Dynamic Type up to the accessibility sizes; VoiceOver labels unchanged;
  Reduce Motion and Reduce Transparency respected; the identity may not depend on an animation.
- **Native**: no custom tab bar metaphor, no custom navigation chrome; the dock's geometry (`src/ui/dock-geometry.ts`)
  is a fact, its colours are the territory's.
- **No palette change in code before the owner's selection**; the territory's tokens are delivered as a sheet that maps
  one to one onto the names of `src/ui/palette.ts`, so the implementation in 26 is a token change plus the icon and
  artwork, not a redesign.
- **Nothing is claimed as final**: the territories are explorations; a comparison board is not a brand.

### 4.5 How the territories are compared

Each territory is scored by the owner (and by anyone they ask) on the comparison set of 4.3, one to five on each row;
the record of the scores and the comments goes with the decision.

| Criterion | Question |
| --- | --- |
| Distinctive | Would a person recognise it among the apps of §5 and the LatAm wallets with the brand hidden? |
| Calm and premium | Does Inicio feel quiet with real-looking data, in both themes? |
| Trustworthy | Do the numbers lead; does nothing look like a promotion or a game? |
| iOS fit | Does it sit naturally beside Apple's apps, on the Lock Screen and in the Dynamic Island? |
| Argentina and beyond | Does it feel at home in Buenos Aires and still right in Mexico City, Madrid and Miami? |
| Expandable | Would it hold goals, a calendar, shared groups, a net-worth view without strain? |
| Accessible | Contrast, Dynamic Type, hidden amounts, tinted icons all pass? |
| Implementable | Does the token sheet map onto the existing names without new concepts; is any typeface licensed for the app? |

### 4.6 Deliverable format

A board per territory (PNG or a Figma file the owner can open), a token sheet per territory (the names of
`src/ui/palette.ts`, light and dark, with contrast ratios), the icon masters, a one-page rationale per territory, the
licence status of every typeface or asset, and a statement that nothing was traced or copied from another product. The
designer or agent names the references consulted (as this brief names §5) and shows the distance from them.

### 4.7 Owner feedback after the second exploration (2026-10-03)

Recorded as decisions; the exploration boards are not copied into the repository (there is no asset workflow for them).

- **Structure is frozen; the open question is colour and brand identity.** The current Forest product structure is the
  selected structural baseline. Brand exploration is **not** permission for another broad UI redesign. Preserved:
  rounded iOS surfaces, the current navigation, Inicio's composition, Reportes' hierarchy, the Wallet-style Tarjetas
  interaction, the floating dock and the current information-density principles.
- **Inicio stays as it is.** Its hierarchy (the amount, Gastado / Disponible → upcoming commitments → recent activity)
  is sufficient and the product deliberately removed visual noise. **No** month arc, month progress line, «Día X de Y»,
  spending-pace visualisation or additional month chart is added to Inicio. The Alba / month-pattern exploration was
  useful research; nothing from it is selected for Inicio. Spending pace or month progress may be reconsidered later
  inside Reportes, the calendar or a future insight surface if it gives a clear financial decision benefit; it does not
  return to Inicio because it looked good on a concept board.
- **Palettes: research, not a selection.** Pino / Forest remains a strong baseline. Pino + albaricoque is a promising
  evolution (a restrained second tone, the product unchanged). Zafiro + arena is the strongest genuinely different
  challenger and stays in the final comparison. Grafito + categorías and Petróleo + oro arena are not preferred. **No
  palette is selected**; a final, broader palette-only exploration runs outside this PR, and no palette is implemented
  until the owner chooses one.
- **Naming.** «FinanzApp» is only the internal working name. No name from the Claude Design shortlist is approved, and
  none is promoted to the roadmap or the product configuration before the availability and conflict screening of §3.

### 4.8 Electric Lime, the current product palette (Producto 25VIS1, 2026-10-03)

After the palette-only exploration the owner preferred an Electric Lime direction and asked to see it on the real
iPhone. 25VIS1 implemented it as a token trial on the existing product (`apps/mobile/src/ui/palette.ts`; mobile-design.md,
«Producto 25VIS1»), and after reviewing it on the iPhone in light and dark (2026-10-03) the owner **kept it as the
current product palette**, as implemented. It is the selected product visual direction; it is **not** a finished public
name, logo or brand identity: the naming, trademark and confusing-similarity gate below stays future work.

- **A colour direction, not an imitation of Wise.** The lime is paired with neutral ink, graphite and mineral
  off-white, never with a deep forest green as the brand pair, and sits on the yellow side of a bright green. The
  identity does not reproduce Wise's Bright Green + Forest Green pairing, its logo, lettering, icon system, global-currency
  motifs, copy or distinctive brand compositions.
- **The research's caution still applies.** §5 lists «acid green on deep green» as crowded and lime as a poor default
  accent; pairing with ink instead of green answers part of it, not all of it. Final public naming, logo, trademark and
  confusing-similarity screening stay in the existing brand, naming and identity launch gate (§3 and
  [app-store-launch.md §9.4](app-store-launch.md)); nothing
  here is a legal assessment.
- **Theme packs: a pre-launch 25F Pro candidate (owner decision, 2026-10-04).** Promoted from a post-launch idea:
  optional visual themes (for example Forest and Sapphire) may become selectable once the StoreKit entitlement and
  paywall exist (roadmap, «Producto 25F»; app-store-launch.md §1.2). Electric Lime stays the default and current
  identity; no selector is built now. Every theme multiplies visual and accessibility QA and must pass light, dark,
  accessibility and semantic-colour QA before launch; the launch still needs one recognisable default identity.

## 5. What the identity must stay away from

The current identities of the products the owner named, described at a high level for differentiation only, from the
research of 2026-10-02 recorded in [competitive-landscape.md](competitive-landscape.md) §10 (sources there). An original
identity does not echo their symbol, their palette as a brand idea, their icon composition or their wordmark style.
Common platform patterns are not on this list.

| Product | Identity as read on 2026-10-02 (paraphrased; see the landscape's sources) | Do not echo |
| --- | --- | --- |
| Kesef | Light-first, white surfaces with one teal-turquoise accent; casual, irreverent Rioplatense voice (voseo); a Hebrew word for «money» as the name; privacy, offline and voice capture as the selling points. | A single teal accent on white; an irreverent voseo voice; a «foreign word for money» naming genre. |
| MonAi | Neutral whites and greys with accents on interactive elements; emoji as category markers; the voice note as the hero of the marketing; «Mon» + «AI» as the name. | A money-root plus «AI» coinage; emoji category icons; voice-note-as-hero marketing; the sparkle vocabulary of AI assistants. |
| Revolut | Black and white luxury with glossy 3D renders and a metal card as the hero object; capitalised slogans; an open «R» mark on dark. *(The official site could not be read; secondary sources.)* | Black-glass premium; a metal or physical card as the hero; caps-lock headlines. |
| Monzo | Hot coral on deep navy, with teal, pink and yellow-green as secondary; a rounded grotesk for headlines and a custom sans for the interface; «straightforward kindness» and wit as published tone; the coral card as the icon. | A coral or salmon accent on navy; warm rounded grotesk with witty copy; the physical card as the identity. |
| Wise | Bright acid green on a deep forest green; a bespoke sans inspired by scripts from many alphabets; a flag-shaped mark; multi-script letterform play; «money without borders». | Lime or acid green on dark green; multi-alphabet letterform play; a flag mark. (Wise's dark green is also the reason the Forest territory must earn its distance with a symbol, not with green.) |
| Copilot Money | Dark-mode-first marketing, glossy dashboards, elegant allocation charts; «beautifully organized» as the promise; multi-device mockup walls. | A dark glass dashboard; «beautiful charts» as the product; mockup walls. |
| Apple (Wallet, Apple Card) | White space and SF Pro; colour reserved for data; the fanned stack of cards as the Wallet icon; the white titanium card; the payment wheel whose colour shifts with the amount. | The fanned-card icon; a white titanium card; a ring or wheel control; any Apple product name or an «i» prefix (App Review 5.2.4 and 5.2.5; Apple's marketing guidelines forbid «Wallet», «Apple Pay» and «iPhone» in an app name). |
| Monarch | Deep teal and navy with bright cyan accents; aggregated dashboards, upward-trend imagery, connected-accounts iconography, couples photography. | Navy plus cyan fintech; the «command centre for the household» framing. |
| YNAB | A blue-purple («blurple») with a buttermilk cream; a tree mark; organic flowing line illustrations, scribbles and blobs; an empowering, method-driven voice. | Blue-purple plus cream; a tree or plant-growth metaphor; scribble illustration. |
| Wallet by BudgetBakers | Neutral marketing with chart accents, dense dashboards, certification badges and bank-connection counts; a generic name that collides with Apple Wallet and dozens of others. | A generic noun as a name; a wall of trust badges; chart-dense screenshots. |

What the research found crowded, and therefore a poor default for a new identity: navy-and-teal «trustworthy fintech»; dark glass with 3D renders and metal cards; a single warm accent on white with a witty grotesk; acid green on deep green; AI purple, gradients and sparkles with «Mon-» / «Fin-» / «-AI» coinages; dashboards and charts as the hero with trust badges; blue-purple with organic illustration; generic nouns as names; Apple-adjacent devices (fanned cards, titanium, rings). What it found open for an expense-first, offline-capable, Spanish-first iOS app: warm neutral, paper or stone surfaces with one saturated accent that is not teal, coral or lime, used only where it carries meaning; large tabular numerals as the hero instead of dashboards or cards; light-first with a true dark mode rather than dark-first marketing; a calm, declarative Spanish without irreverence; an icon built from one abstract geometric mark rather than a card, wallet, coin, tree, flag, crown or a letter in a rounded square; and, as a secondary open space, «commitments and instalments as a calendar» as a visual motif none of the ten brands make primary. These are observations for the exploration, not a selected direction.

## 6. Open owner decisions

| Decision | Options | When |
| --- | --- | --- |
| When the naming workflow runs | Now, in parallel with 25A–25E (it needs no code); or in 26 with the identity. Never chosen or accelerated for cloud setup: operational accounts stay brand-neutral (owner, 2026-10-05; production-plan.md §2.6) | Any time; before 25F's sandbox gate if the app record needs the public name |
| Who runs the visual exploration | Claude Design, a designer, both as independent attempts | Before 26 |
| Whether Forest is one of the territories | Yes as an evolved option (recommended, it is the owner's own 2026-09-30 decision and costs nothing to show); or excluded to avoid anchoring | At the start of §4 |
| Budget for professional trademark review and for a typeface licence | None at first; a review only if a screening hit is close; a licence only if a territory needs a brand typeface in the app | Step G; after step C of launch §9.4 |
| The first market's voice | Rioplatense, neutral Latin American Spanish, or neutral with an Argentine example set (launch §10.1) | With the name, since the name's sound and the voice go together |
| Whether the working name survives inside the repository | Keep «FinanzApp» as the internal name and release marker (recommended; no churn, no risk to tests and guards); or rename the repository after step I | Step I |

## 7. Sources

External facts read on 2026-10-02 (re-read before relying on them):

- Apple App Store Connect, app information reference (name and subtitle lengths): https://developer.apple.com/help/app-store-connect/reference/app-information/ and https://developer.apple.com/help/app-store-connect/reference/app-information/platform-version-information
- Apple App Review Guidelines, 2.3 accurate metadata and 5.2 intellectual property (5.2.1 ownership, 5.2.4 no implied Apple endorsement, 5.2.5 no confusing resemblance to Apple apps): https://developer.apple.com/app-store/review/guidelines/#intellectual-property
- Apple marketing guidelines (Apple trademarks never in an app name): https://developer.apple.com/app-store/marketing/guidelines/
- Apple Human Interface Guidelines for app icons, Live Activities and widgets (the constraints of 4.3 items 5, 15 and 16): https://developer.apple.com/design/human-interface-guidelines/app-icons , https://developer.apple.com/design/human-interface-guidelines/live-activities , https://developer.apple.com/design/human-interface-guidelines/widgets *(not re-read on 2026-10-02; re-read before the exploration starts)*
- INPI Argentina, marcas (classes, the free denominación search, the Boletín de Marcas opposition window, ten-year validity): https://www.argentina.gob.ar/inpi/marcas , https://www.argentina.gob.ar/inpi/marcas/tramites-de-marcas , https://www.argentina.gob.ar/inpi/marcas/preguntas-frecuentes-de-marcas-0 ; the search portal https://portaltramites.inpi.gob.ar/marcasconsultas/busqueda answered HTTP 503 on 2026-10-02
- WIPO Global Brand Database and the Madrid System (Argentina and Uruguay are not Madrid members, so a US or EU filing through Madrid does not reach Argentina; Brazil, Chile, Mexico and the United States are members): https://www.wipo.int/en/web/global-brand-database , https://www.wipo.int/en/web/madrid-system/members , https://www.wipo.int/documents/d/treaties/docs-en-madrid_marks.pdf
- The competitor identities of §5: the App Store listings and official sites listed in [competitive-landscape.md](competitive-landscape.md) §13 (Kesef, MonAi, Revolut, Monzo, Wise, Copilot Money, Apple Wallet and Apple Card, Monarch, YNAB, Wallet by BudgetBakers); Revolut's official pages answered HTTP 403 and its identity is recorded from secondary coverage.
